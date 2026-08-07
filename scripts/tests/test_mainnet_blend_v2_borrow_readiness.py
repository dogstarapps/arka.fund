import importlib.util
import json
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
MODULE_PATH = ROOT / "scripts" / "mainnet_blend_v2_borrow_readiness.py"
spec = importlib.util.spec_from_file_location("mainnet_blend_v2_borrow_readiness", MODULE_PATH)
readiness = importlib.util.module_from_spec(spec)
assert spec.loader is not None
spec.loader.exec_module(readiness)


class MainnetBlendV2BorrowReadinessTests(unittest.TestCase):
    def manifest(self):
        return json.loads((ROOT / "deployments.mainnet.json").read_text())

    def facts(self, *, status=1, recognised=True, xlm_reserve=True, usdc_reserve=True):
        assets = self.manifest()["assets"]["contractIds"]
        reserves = [assets["XLM"], assets["USDC"]]
        return {
            "factory": readiness.BLEND_V2_FACTORY,
            "pool": readiness.BLEND_V2_FIXED_POOL,
            "assets": {"XLM": assets["XLM"], "USDC": assets["USDC"]},
            "factoryPoolCheck": {"ok": True, "value": recognised},
            "poolConfig": {"ok": True, "value": {"status": status}},
            "reserveList": {"ok": True, "value": reserves},
            "xlmReserve": {"ok": xlm_reserve, "value": {} if xlm_reserve else None},
            "usdcReserve": {"ok": usdc_reserve, "value": {} if usdc_reserve else None},
        }

    def test_permissionless_active_pool_is_a_valid_candidate(self):
        report = readiness.build_report(self.manifest(), self.facts(status=1))

        self.assertEqual(report["status"], "candidate_verified")
        self.assertEqual(report["blockers"], [])

    def test_rejects_unrecognised_pool(self):
        report = readiness.build_report(self.manifest(), self.facts(recognised=False))

        self.assertEqual(report["status"], "blocked")
        self.assertTrue(any("does not recognise" in blocker for blocker in report["blockers"]))

    def test_rejects_non_active_pool_and_missing_reserve_read(self):
        report = readiness.build_report(self.manifest(), self.facts(status=2, usdc_reserve=False))

        self.assertEqual(report["status"], "blocked")
        self.assertTrue(any("not active" in blocker for blocker in report["blockers"]))
        self.assertTrue(any("USDC reserve" in blocker for blocker in report["blockers"]))


if __name__ == "__main__":
    unittest.main()
