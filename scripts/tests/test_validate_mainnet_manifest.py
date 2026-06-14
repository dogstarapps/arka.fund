import copy
import importlib.util
import json
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
MODULE_PATH = ROOT / "scripts" / "validate_mainnet_manifest.py"
spec = importlib.util.spec_from_file_location("validate_mainnet_manifest", MODULE_PATH)
validator = importlib.util.module_from_spec(spec)
assert spec.loader is not None
spec.loader.exec_module(validator)


class MainnetManifestValidationTests(unittest.TestCase):
    def load_manifest(self):
        return json.loads((ROOT / "deployments.mainnet.json").read_text())

    def test_current_manifest_matches_current_lifecycle_phase(self):
        manifest = self.load_manifest()
        if manifest.get("status") in {"predeploy_ready", "predeploy"}:
            errors = validator.validate_predeploy(manifest, check_env=False)
        else:
            errors = validator.validate_postdeploy(manifest, check_env=False)
            if manifest.get("validations", {}).get("releaseGate") is not True:
                errors = [
                    error
                    for error in errors
                    if not error.startswith("validations.releaseGate")
                ]
        self.assertEqual(errors, [])

    def test_artifact_hash_mismatch_blocks_predeploy(self):
        manifest = self.load_manifest()
        manifest["deploymentPlan"]["contracts"][0]["sha256"] = "0" * 64
        errors = validator.validate_predeploy(manifest, check_env=False)
        self.assertTrue(any("deploymentPlan.contracts[0].sha256" in error for error in errors))

    def test_postdeploy_requires_deployed_contract_ids(self):
        manifest = self.load_manifest()
        manifest["contracts"].pop("arkaFactory", None)
        manifest["validations"]["contractsDeployed"] = False
        errors = validator.validate_postdeploy(manifest, check_env=False)
        self.assertTrue(any(error.startswith("contracts.arkaFactory") for error in errors))
        self.assertTrue(any(error.startswith("validations.contractsDeployed") for error in errors))

    def test_test_artifact_is_rejected_for_mainnet_plan(self):
        manifest = self.load_manifest()
        mutated = copy.deepcopy(manifest["deploymentPlan"]["contracts"][0])
        mutated["name"] = "badTestToken"
        mutated["artifact"] = "artifacts/test-token.wasm"
        mutated["sha256"] = "0" * 64
        manifest["deploymentPlan"]["contracts"].append(mutated)
        errors = validator.validate_predeploy(manifest, check_env=False)
        self.assertTrue(any("test/mock/retired artifact" in error for error in errors))


if __name__ == "__main__":
    unittest.main()
