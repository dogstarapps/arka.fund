import importlib.util
import json
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
MODULE_PATH = ROOT / "scripts" / "contract_api_surface_gate.py"
sys.path.insert(0, str(ROOT / "scripts"))
spec = importlib.util.spec_from_file_location("contract_api_surface_gate", MODULE_PATH)
gate = importlib.util.module_from_spec(spec)
assert spec.loader is not None
sys.modules[spec.name] = gate
spec.loader.exec_module(gate)


class ContractApiSurfaceGateTests(unittest.TestCase):
    def test_current_surface_has_no_unclassified_protocol_aliases(self):
        report = gate.build_report()

        self.assertEqual(report["status"], "passed")
        self.assertEqual(report["errors"], [])
        operations = {group["operation"] for group in report["groups"]}
        self.assertIn("credit.supply", operations)
        self.assertIn("credit.market_status", operations)
        self.assertIn("factory.set_arka_implementation", operations)

    def test_legacy_aliases_are_blocked_for_direct_frontend_calls(self):
        report = gate.build_report()
        legacy_groups = [
            group
            for group in report["groups"]
            if group["compatibility"]
        ]

        self.assertGreaterEqual(len(legacy_groups), 10)
        for group in legacy_groups:
            self.assertFalse(group["frontend_direct_calls_allowed"], group)
            self.assertTrue(group["planned_resolution"].strip(), group)
            self.assertTrue(group["rationale"].strip(), group)

    def test_cli_writes_machine_and_human_reports(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            tmp = Path(tmpdir)
            report_json = tmp / "api-surface.json"
            report_md = tmp / "api-surface.md"
            proc = subprocess.run(
                [
                    sys.executable,
                    str(MODULE_PATH),
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
            self.assertIn("Contract API Surface Gate", report_md.read_text())


if __name__ == "__main__":
    unittest.main()
