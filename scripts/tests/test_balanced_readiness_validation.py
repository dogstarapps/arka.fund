import json
import sys
import tempfile
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import validate_balanced_readiness as balanced_readiness


class BalancedReadinessValidationTests(unittest.TestCase):
    def test_resolve_balanced_targets_prefers_canonical_contracts(self):
        deployments = {
            "contracts": {
                "adapterBalanced": "CBAL_CANONICAL",
                "balancedRouter": "CROUTER",
            },
            "legacyContracts": {
                "adapterBalanced": "CBAL_LEGACY",
                "cometPool": "CCOMET",
                "balancedRouterMock": "CMOCK",
            },
        }
        self.assertEqual(
            balanced_readiness.resolve_balanced_targets(deployments),
            ("CBAL_CANONICAL", "CROUTER", "CCOMET", "CMOCK"),
        )

    def test_normalize_pair_config_accepts_valid_payload(self):
        pair = balanced_readiness.normalize_pair_config(
            {
                "token_in": "CA",
                "token_out": "CB",
                "max_price": "1000000000",
            }
        )
        self.assertEqual(
            pair,
            {
                "tokenIn": "CA",
                "tokenOut": "CB",
                "maxPrice": "1000000000",
            },
        )

    def test_derive_readiness_blocks_legacy_comet_lane(self):
        report = balanced_readiness.derive_readiness(
            observed_router="CCOMET",
            expected_router=None,
            legacy_comet_router="CCOMET",
            legacy_mock_router="CMOCK",
            pool_supported=False,
            pair_config={"tokenIn": "CA", "tokenOut": "CB", "maxPrice": "1"},
        )
        self.assertEqual(report["supportStatus"], "blocked")
        self.assertEqual(report["laneMode"], "legacy_comet")
        self.assertIn("retired Comet-coupled router", " ".join(report["blockingReasons"]))

    def test_derive_readiness_requires_expected_router_and_pair(self):
        report = balanced_readiness.derive_readiness(
            observed_router="CBAL",
            expected_router="CBAL",
            legacy_comet_router="CCOMET",
            legacy_mock_router="CMOCK",
            pool_supported=True,
            pair_config={"tokenIn": "CA", "tokenOut": "CB", "maxPrice": "1"},
        )
        self.assertTrue(report["readyForDappExecution"])
        self.assertEqual(report["supportStatus"], "ready")

        blocked = balanced_readiness.derive_readiness(
            observed_router="CBAL",
            expected_router="CBAL",
            legacy_comet_router="CCOMET",
            legacy_mock_router="CMOCK",
            pool_supported=False,
            pair_config=None,
        )
        self.assertFalse(blocked["readyForDappExecution"])
        self.assertIn("pool activation is missing", " ".join(blocked["blockingReasons"]))

    def test_update_deployments_persists_balanced_validation(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            tmp = Path(tmpdir)
            deployments = tmp / "deployments.json"
            deployments.write_text(json.dumps({"validations": {}}, indent=2), encoding="utf-8")
            out_json = tmp / "balanced.json"
            report = {
                "validatedAt": "2026-03-30",
                "network": "testnet",
                "rpcUrl": "https://rpc",
                "poolId": 1,
                "contracts": {"adapterBalanced": "CADAPTER"},
                "supportStatus": "blocked",
                "readyForDappExecution": False,
                "laneMode": "legacy_comet",
                "blockingReasons": ["still points to comet"],
                "observedRouter": "CCOMET",
                "expectedRouter": None,
                "poolSupported": False,
                "pairConfigured": True,
            }
            balanced_readiness.update_deployments_validation(deployments, out_json=out_json, report=report)
            updated = json.loads(deployments.read_text(encoding="utf-8"))
            self.assertEqual(updated["validations"]["balancedReadiness"]["supportStatus"], "blocked")
            self.assertEqual(updated["validations"]["balancedReadiness"]["report"], str(out_json))


if __name__ == "__main__":
    unittest.main()
