import json
import sys
import tempfile
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import release_gate


class ReleaseGateTests(unittest.TestCase):
    def test_default_plan_contains_expected_release_steps(self):
        plan = release_gate.default_plan()
        step_ids = [step["step_id"] for step in plan["steps"]]
        self.assertIn("canonical_registry_verify", step_ids)
        self.assertIn("internal_security_audit", step_ids)
        self.assertIn("storage_lifecycle_audit", step_ids)
        self.assertIn("balanced_readiness", step_ids)
        self.assertIn("balanced_official_surface", step_ids)
        self.assertIn("indexer_event_surface", step_ids)
        self.assertIn("create_live_validation", step_ids)
        self.assertIn("sdk_e2e", step_ids)
        self.assertIn("catalog_e2e", step_ids)
        self.assertIn("dapp_design_audit", step_ids)
        self.assertIn("offchain_public_stack", step_ids)
        self.assertIn("subquery_backend_parity", step_ids)

    def test_run_plan_writes_success_report_and_updates_deployments(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            tmp = Path(tmpdir)
            deployments = tmp / "deployments.json"
            deployments.write_text(json.dumps({"validatedModules": {"governanceFoundation": {}, "feeEngine": {}}}, indent=2))
            report = tmp / "report.json"
            success_command = [sys.executable, "-c", "print('ok')"]
            plan = {
                "name": "fixture",
                "network": "testnet",
                "rpcUrl": "https://rpc",
                "steps": [
                    {"step_id": "one", "label": "one", "cwd": tmpdir, "command": success_command, "kind": "fixture"},
                    {"step_id": "two", "label": "two", "cwd": tmpdir, "command": success_command, "kind": "fixture"},
                ],
            }

            rc = release_gate.run_plan(
                plan,
                deployments_path=deployments,
                report_path=report,
                update_deployments=True,
                dry_run=False,
            )
            self.assertEqual(rc, 0)
            report_payload = json.loads(report.read_text())
            self.assertEqual(report_payload["status"], "passed")
            self.assertEqual(report_payload["passedSteps"], 2)
            updated = json.loads(deployments.read_text())
            self.assertEqual(updated["validations"]["releaseGate"]["status"], "passed")
            self.assertEqual(updated["validations"]["releaseGate"]["validatedModules"], ["feeEngine", "governanceFoundation"])

    def test_run_plan_stops_on_failure_and_marks_report_failed(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            tmp = Path(tmpdir)
            deployments = tmp / "deployments.json"
            deployments.write_text(json.dumps({"validatedModules": {}}, indent=2))
            report = tmp / "report.json"
            plan = {
                "name": "fixture",
                "network": "testnet",
                "rpcUrl": "https://rpc",
                "steps": [
                    {"step_id": "ok", "label": "ok", "cwd": tmpdir, "command": [sys.executable, "-c", "print('ok')"], "kind": "fixture"},
                    {"step_id": "boom", "label": "boom", "cwd": tmpdir, "command": [sys.executable, "-c", "import sys; sys.exit(7)"], "kind": "fixture"},
                    {"step_id": "skipped", "label": "skipped", "cwd": tmpdir, "command": [sys.executable, "-c", "print('never')"], "kind": "fixture"},
                ],
            }

            rc = release_gate.run_plan(
                plan,
                deployments_path=deployments,
                report_path=report,
                update_deployments=False,
                dry_run=False,
            )
            self.assertEqual(rc, 1)
            report_payload = json.loads(report.read_text())
            self.assertEqual(report_payload["status"], "failed")
            self.assertEqual([item["step_id"] for item in report_payload["results"]], ["ok", "boom"])


if __name__ == "__main__":
    unittest.main()
