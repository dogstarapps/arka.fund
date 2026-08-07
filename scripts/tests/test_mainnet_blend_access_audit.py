import importlib.util
import json
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
MODULE_PATH = ROOT / "scripts" / "mainnet_blend_access_audit.py"
spec = importlib.util.spec_from_file_location("mainnet_blend_access_audit", MODULE_PATH)
audit = importlib.util.module_from_spec(spec)
assert spec.loader is not None
spec.loader.exec_module(audit)


class MainnetBlendAccessAuditTests(unittest.TestCase):
    def manifest(self):
        return json.loads((ROOT / "deployments.mainnet.json").read_text())

    def reader(self, manifest, contract, method, arguments):
        registry = manifest["contracts"]["arkaRegistry"]
        venue_registry = manifest["contracts"]["venueRegistry"]
        if contract == registry and method == "count":
            return {"ok": True, "value": 2}
        if contract == registry and method == "get_arkas":
            return {"ok": True, "value": ["ARKA_ONE", "ARKA_TWO"]}
        if contract in {"ARKA_ONE", "ARKA_TWO"} and method == "manager":
            return {"ok": True, "value": f"MANAGER_{contract}"}
        if contract in {"ARKA_ONE", "ARKA_TWO"} and method == "venue_registry":
            return {"ok": True, "value": venue_registry}
        if contract == "ARKA_ONE" and method == "credit_market_configs":
            return {
                "ok": True,
                "value": [
                    {
                        "adapter": "OFFICIAL_ADAPTER",
                        "allow_borrow": False,
                        "allow_repay": False,
                        "allow_supply": True,
                        "allow_withdraw": True,
                        "enabled": True,
                        "market_id": "1",
                        "protocol": "Blend",
                    }
                ],
            }
        if contract == "ARKA_TWO" and method == "credit_market_configs":
            return {"ok": True, "value": []}
        if contract == venue_registry and method == "venue_config":
            return {"ok": True, "value": {"status": 1}}
        self.fail(f"unexpected read: {contract} {method} {arguments}")

    def test_reports_explicit_per_arka_access_without_granting_borrow(self):
        report = audit.build_report(self.manifest(), self.reader)

        self.assertEqual(report["status"], "passed")
        self.assertEqual(report["summary"], {"registeredArkas": 2, "arkasWithBlend": 1, "arkasWithBorrow": 0})
        self.assertEqual(report["arkas"][0]["blendMarkets"][0]["actions"]["supply"], True)
        self.assertEqual(report["arkas"][0]["blendMarkets"][0]["actions"]["borrow"], False)
        self.assertEqual(report["arkas"][1]["blendMarkets"], [])

    def test_requires_the_canonical_venue_registry(self):
        def wrong_registry(manifest, contract, method, arguments):
            result = self.reader(manifest, contract, method, arguments)
            if contract == "ARKA_TWO" and method == "venue_registry":
                return {"ok": True, "value": "WRONG_REGISTRY"}
            return result

        report = audit.build_report(self.manifest(), wrong_registry)

        self.assertEqual(report["status"], "review_required")
        self.assertIn("does not reference the canonical venue registry", report["findings"][0])

    def test_requires_each_referenced_adapter_to_be_globally_registered(self):
        def absent_adapter(manifest, contract, method, arguments):
            result = self.reader(manifest, contract, method, arguments)
            if method == "venue_config":
                return {"ok": True, "value": None}
            return result

        report = audit.build_report(self.manifest(), absent_adapter)

        self.assertEqual(report["status"], "review_required")
        self.assertIn("absent from the global venue registry", report["findings"][0])

    def test_pages_the_registry_without_assuming_a_fixed_maximum(self):
        manifest = self.manifest()
        registry = manifest["contracts"]["arkaRegistry"]
        seen_offsets = []

        def paged_reader(manifest, contract, method, arguments):
            if contract == registry and method == "count":
                return {"ok": True, "value": 51}
            if contract == registry and method == "get_arkas":
                offset = int(arguments[1])
                seen_offsets.append(offset)
                return {
                    "ok": True,
                    "value": [f"ARKA_{index}" for index in range(offset, min(offset + 50, 51))],
                }
            if contract.startswith("ARKA_") and method == "manager":
                return {"ok": True, "value": "MANAGER"}
            if contract.startswith("ARKA_") and method == "venue_registry":
                return {"ok": True, "value": manifest["contracts"]["venueRegistry"]}
            if contract.startswith("ARKA_") and method == "credit_market_configs":
                return {"ok": True, "value": []}
            self.fail(f"unexpected read: {contract} {method} {arguments}")

        report = audit.build_report(manifest, paged_reader)

        self.assertEqual(report["status"], "passed")
        self.assertEqual(seen_offsets, [0, 50])


if __name__ == "__main__":
    unittest.main()
