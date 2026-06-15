import json
import os
import stat
import subprocess
import sys
import tempfile
import textwrap
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import storage_lifecycle_extend as storage_extend


def make_contract_id(fill: str) -> str:
    return "C" + (fill * 55)


def fixture_deployments() -> dict:
    return {
        "network": "testnet",
        "rpcUrl": "https://rpc",
        "contracts": {
            "arka": make_contract_id("A"),
            "router": make_contract_id("B"),
            "duplicateArkaAlias": make_contract_id("A"),
            "invalidEntry": "not-a-contract-id",
        },
    }


class StorageLifecycleExtendTests(unittest.TestCase):
    def test_extract_extend_targets_filters_invalid_and_deduplicates(self):
        targets = storage_extend.extract_extend_targets(fixture_deployments())
        self.assertEqual([target.contract_key for target in targets], ["arka", "router"])
        self.assertEqual([target.contract_id for target in targets], [make_contract_id("A"), make_contract_id("B")])

        scoped = storage_extend.extract_extend_targets(
            fixture_deployments(),
            include_keys=["router", "invalidEntry", "arka"],
            exclude_keys=["arka"],
        )
        self.assertEqual([target.contract_key for target in scoped], ["router"])

        with self.assertRaisesRegex(ValueError, "unknown entries"):
            storage_extend.extract_extend_targets(
                fixture_deployments(),
                include_keys=["missing"],
            )

    def test_cli_dry_run_writes_report_and_updates_deployments(self):
        script = storage_extend.ROOT_DIR / "scripts" / "storage_lifecycle_extend.py"
        with tempfile.TemporaryDirectory() as tmpdir:
            tmp = Path(tmpdir)
            deployments = tmp / "deployments.json"
            deployments.write_text(json.dumps(fixture_deployments(), indent=2), encoding="utf-8")
            out_json = tmp / "storage-report.json"

            proc = subprocess.run(
                [
                    sys.executable,
                    str(script),
                    "--deployments",
                    str(deployments),
                    "--out-json",
                    str(out_json),
                    "--dry-run",
                    "--strict",
                    "--update-deployments",
                ],
                capture_output=True,
                text=True,
                check=True,
            )
            payload = json.loads(proc.stdout)
            self.assertEqual(payload["status"], "dry_run")
            self.assertEqual(payload["failedCount"], 0)
            self.assertEqual(payload["targetsCount"], 2)
            self.assertTrue(out_json.exists())

            updated = json.loads(deployments.read_text(encoding="utf-8"))
            validation = updated["validations"]["storageLifecycle"]
            self.assertEqual(validation["status"], "dry_run")
            self.assertTrue(validation["dryRun"])
            self.assertEqual(len(validation["extendedContracts"]), 2)

    def test_cli_execute_with_fake_stellar_and_updates_deployments(self):
        script = storage_extend.ROOT_DIR / "scripts" / "storage_lifecycle_extend.py"
        with tempfile.TemporaryDirectory() as tmpdir:
            tmp = Path(tmpdir)
            fake_bin = tmp / "bin"
            fake_bin.mkdir()
            log_path = tmp / "stellar-log.txt"
            stellar_path = fake_bin / "stellar"
            stellar_path.write_text(
                textwrap.dedent(
                    f"""\
                    #!/usr/bin/env python3
                    import sys
                    args = sys.argv[1:]
                    with open({str(log_path)!r}, "a", encoding="utf-8") as handle:
                        handle.write(" ".join(args) + "\\n")
                    if args[:2] == ["contract", "extend"]:
                        print("123456")
                        raise SystemExit(0)
                    raise SystemExit("unsupported stellar invocation: " + " ".join(args))
                    """
                ),
                encoding="utf-8",
            )
            stellar_path.chmod(stellar_path.stat().st_mode | stat.S_IEXEC)

            deployments = tmp / "deployments.json"
            deployments.write_text(json.dumps(fixture_deployments(), indent=2), encoding="utf-8")
            out_json = tmp / "storage-report.json"
            env = dict(os.environ)
            env["PATH"] = f"{fake_bin}:{env['PATH']}"

            proc = subprocess.run(
                [
                    sys.executable,
                    str(script),
                    "--deployments",
                    str(deployments),
                    "--out-json",
                    str(out_json),
                    "--include-contract-keys",
                    "arka,router",
                    "--strict",
                    "--update-deployments",
                ],
                cwd=str(storage_extend.ROOT_DIR),
                capture_output=True,
                text=True,
                check=True,
                env=env,
            )
            payload = json.loads(proc.stdout)
            self.assertEqual(payload["status"], "passed")
            self.assertEqual(payload["targetsCount"], 2)
            self.assertEqual(payload["failedCount"], 0)
            self.assertTrue(all(item["status"] == "extended" for item in payload["results"]))
            self.assertTrue(all(item["ttlLedger"] == 123456 for item in payload["results"]))

            invocations = log_path.read_text(encoding="utf-8")
            self.assertIn(f"--id {make_contract_id('A')}", invocations)
            self.assertIn(f"--id {make_contract_id('B')}", invocations)

    def test_cli_strict_fails_when_any_extension_command_fails(self):
        script = storage_extend.ROOT_DIR / "scripts" / "storage_lifecycle_extend.py"
        with tempfile.TemporaryDirectory() as tmpdir:
            tmp = Path(tmpdir)
            fake_bin = tmp / "bin"
            fake_bin.mkdir()
            stellar_path = fake_bin / "stellar"
            fail_id = make_contract_id("B")
            stellar_path.write_text(
                textwrap.dedent(
                    f"""\
                    #!/usr/bin/env python3
                    import sys
                    args = sys.argv[1:]
                    target = args[args.index("--id") + 1]
                    if target == {fail_id!r}:
                        print("boom", file=sys.stderr)
                        raise SystemExit(1)
                    print("123")
                    raise SystemExit(0)
                    """
                ),
                encoding="utf-8",
            )
            stellar_path.chmod(stellar_path.stat().st_mode | stat.S_IEXEC)

            deployments = tmp / "deployments.json"
            deployments.write_text(json.dumps(fixture_deployments(), indent=2), encoding="utf-8")
            out_json = tmp / "storage-report.json"
            env = dict(os.environ)
            env["PATH"] = f"{fake_bin}:{env['PATH']}"

            proc = subprocess.run(
                [
                    sys.executable,
                    str(script),
                    "--deployments",
                    str(deployments),
                    "--out-json",
                    str(out_json),
                    "--strict",
                ],
                cwd=str(storage_extend.ROOT_DIR),
                capture_output=True,
                text=True,
                check=False,
                env=env,
            )
            self.assertEqual(proc.returncode, 1)
            payload = json.loads(out_json.read_text(encoding="utf-8"))
            self.assertEqual(payload["status"], "failed")
            self.assertEqual(payload["failedCount"], 1)


if __name__ == "__main__":
    unittest.main()
