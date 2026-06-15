import json
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import internal_security_audit


class InternalSecurityAuditTests(unittest.TestCase):
    def test_extract_functions_handles_nested_braces(self):
        source = """
#[contractimpl]
impl Demo {
    pub fn view(env: Env) -> i128 {
        if true {
            return 1;
        }
        0
    }

    pub fn execute(env: Env, caller: Address) -> i128 {
        caller.require_auth();
        let data = "{\"quoted\": true}";
        if data.len() > 0 {
            env.events().publish(("exec",), 1i128);
        }
        7
    }
}
"""
        functions = internal_security_audit.extract_functions(source)
        self.assertEqual([fn.name for fn in functions if fn.is_public], ["view", "execute"])
        self.assertIn("caller.require_auth()", functions[1].body)

    def test_generate_report_covers_active_surface(self):
        report = internal_security_audit.generate_report()
        crates = {contract["crate"] for contract in report["contracts"]}
        self.assertIn("arka", crates)
        self.assertIn("adapter-aquarius", crates)
        self.assertIn("adapter-soroswap", crates)
        self.assertIn("adapter-blend", crates)

        by_crate = {contract["crate"]: contract for contract in report["contracts"]}
        for crate in ("adapter-aquarius", "adapter-soroswap", "adapter-blend"):
            execute_fn = next((fn for fn in by_crate[crate]["functions"] if fn["name"] == "execute"), None)
            self.assertIsNotNone(execute_fn, crate)
            self.assertTrue(execute_fn["invokes_external"], crate)

        self.assertTrue(
            next(fn for fn in by_crate["adapter-aquarius"]["functions"] if fn["name"] == "execute")["requires_auth"]
        )
        self.assertTrue(
            next(fn for fn in by_crate["adapter-blend"]["functions"] if fn["name"] == "execute")["requires_auth"]
        )

        high_findings = [finding for finding in report["findings"] if finding["severity"] == "high"]
        self.assertEqual(high_findings, [])

    def test_analyze_contract_tracks_transitive_auth_and_external_symbols(self):
        source = """
#[contractimpl]
impl Demo {
    pub fn execute(env: Env, caller: Address) -> i128 {
        Self::stage_one(env, caller)
    }

    fn stage_one(env: Env, caller: Address) -> i128 {
        Self::stage_two(env, caller)
    }

    fn stage_two(env: Env, caller: Address) -> i128 {
        caller.require_auth();
        env.invoke_contract(
            &caller,
            &symbol_short!("swap"),
            ().into_val(&env),
        );
        1
    }
}
"""
        with tempfile.TemporaryDirectory() as tmpdir:
            source_path = Path(tmpdir) / "lib.rs"
            source_path.write_text(source, encoding="utf-8")
            audit = internal_security_audit.analyze_contract(
                "adapter-aquarius",
                source_path,
            )

        execute_fn = next(fn for fn in audit.functions if fn.name == "execute")
        self.assertTrue(execute_fn.requires_auth)
        self.assertTrue(execute_fn.invokes_external)
        self.assertIn("swap", execute_fn.external_symbols)

    def test_generate_report_accepts_custom_workspace_manifest(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            root = Path(tmpdir)
            contracts_dir = root / "contracts"
            demo_src = contracts_dir / "demo" / "src"
            demo_src.mkdir(parents=True, exist_ok=True)
            (contracts_dir / "Cargo.toml").write_text(
                """
[workspace]
members = ["demo"]
resolver = "2"
""".strip()
                + "\n",
                encoding="utf-8",
            )
            (demo_src / "lib.rs").write_text(
                """
#[contractimpl]
impl Demo {
    pub fn view(_env: Env) -> i128 {
        1
    }
}
""".strip()
                + "\n",
                encoding="utf-8",
            )

            report = internal_security_audit.generate_report(
                contracts_dir=contracts_dir,
                workspace_manifest=contracts_dir / "Cargo.toml",
            )

        crates = {contract["crate"] for contract in report["contracts"]}
        self.assertEqual(crates, {"demo"})
        self.assertEqual(report["summary"]["workspaceMembers"], 1)
        self.assertEqual(report["summary"]["contractsAnalyzed"], 1)
        self.assertEqual(report["summary"]["missingSources"], [])

    def test_cli_writes_reports_and_exits_cleanly(self):
        script = Path(__file__).resolve().parents[1] / "internal_security_audit.py"
        with tempfile.TemporaryDirectory() as tmpdir:
            tmp = Path(tmpdir)
            report_json = tmp / "report.json"
            report_md = tmp / "report.md"
            proc = subprocess.run(
                [
                    sys.executable,
                    str(script),
                    "--report-json",
                    str(report_json),
                    "--report-md",
                    str(report_md),
                    "--strict",
                ],
                capture_output=True,
                text=True,
                check=True,
            )
            payload = json.loads(proc.stdout)
            self.assertEqual(payload["status"], "passed")
            self.assertTrue(report_json.exists())
            self.assertTrue(report_md.exists())
            report = json.loads(report_json.read_text())
            self.assertEqual(report["summary"]["highFindings"], 0)
            self.assertIn("Internal Security Audit", report_md.read_text())


if __name__ == "__main__":
    unittest.main()
