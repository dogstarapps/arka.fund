import copy
import importlib.util
import json
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
MODULE_PATH = ROOT / "scripts" / "mainnet_release_gate.py"
spec = importlib.util.spec_from_file_location("mainnet_release_gate", MODULE_PATH)
gate = importlib.util.module_from_spec(spec)
assert spec.loader is not None
spec.loader.exec_module(gate)


class MainnetReleaseGateTests(unittest.TestCase):
    def load_manifest(self):
        return json.loads((ROOT / "deployments.mainnet.json").read_text())

    def load_create_evidence(self):
        return json.loads((ROOT / "tmp" / "mainnet-canary-create-deposit-redeem.json").read_text())

    def load_routing_evidence(self):
        return json.loads((ROOT / "tmp" / "mainnet-routing-canary.json").read_text())

    def test_current_manifest_accepts_balanced_auto_with_production_canary(self):
        manifest = self.load_manifest()
        create = self.load_create_evidence()
        routing = self.load_routing_evidence()
        errors = []

        gate.require_mainnet_basics(manifest, errors)
        canary_arka, _ = gate.require_canary_create(manifest, create, errors)
        gate.require_routing_canary(
            manifest,
            routing,
            canary_arka,
            errors,
            manifest_dir=ROOT,
        )

        self.assertEqual(errors, [])

    def test_balanced_auto_requires_full_driver_and_settled_canary(self):
        manifest = self.load_manifest()
        balanced = manifest["executionVenues"]["balancedSodax"]
        broken = copy.deepcopy(manifest)
        broken_balanced = broken["executionVenues"]["balancedSodax"]
        broken_balanced["serverDriver"]["receipt"] = False
        broken_balanced["mainnetCanaryPassed"] = False
        broken_balanced["mainnetCanary"]["status"] = "submitted"

        errors = []
        gate.require_balanced_sodax_auto_canary(broken, errors, manifest_dir=ROOT)

        self.assertTrue(any("serverDriver.receipt" in error for error in errors))
        self.assertTrue(any("mainnetCanaryPassed" in error for error in errors))
        self.assertTrue(any("mainnetCanary.status" in error for error in errors))
        self.assertEqual(balanced["autoEnabled"], True)

    def test_balanced_auto_requires_evidence_file(self):
        manifest = self.load_manifest()
        broken = copy.deepcopy(manifest)
        broken["executionVenues"]["balancedSodax"]["mainnetCanary"]["evidence"] = "tmp/missing-balanced-canary.json"

        errors = []
        gate.require_balanced_sodax_auto_canary(broken, errors, manifest_dir=ROOT)

        self.assertTrue(any("missing evidence file" in error for error in errors))


if __name__ == "__main__":
    unittest.main()
