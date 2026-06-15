import json
import sys
import tempfile
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import canonical_registry_migration as migration


class ParseContractOutputTest(unittest.TestCase):
    def test_parses_read_only_json_payload(self):
        raw = 'ℹ️ Simulation identified as read-only. Send by rerunning with `--send=yes`.\n["A","B"]\n'
        self.assertEqual(migration.parse_contract_output(raw), ["A", "B"])

    def test_parses_scalar_string_payload(self):
        raw = 'ℹ️ Signing transaction: deadbeef\n"CCABC"\n'
        self.assertEqual(migration.parse_contract_output(raw), "CCABC")


class ApplyManifestTest(unittest.TestCase):
    def test_manifest_overrides_are_applied(self):
        entries = [
            migration.ArkaEntry(arka="C1", manager="G1"),
            migration.ArkaEntry(arka="C2", manager="G2", curated=True),
        ]
        with tempfile.TemporaryDirectory() as tmpdir:
            manifest_path = Path(tmpdir) / "manifest.json"
            manifest_path.write_text(
                json.dumps(
                    {
                        "curatedManagers": ["G1"],
                        "delistedArkas": ["C2"],
                    }
                ),
                encoding="utf-8",
            )
            result = migration.apply_manifest(entries, manifest_path)
        self.assertEqual(result[0], migration.ArkaEntry(arka="C1", manager="G1", curated=True, delisted=False))
        self.assertEqual(result[1], migration.ArkaEntry(arka="C2", manager="G2", curated=True, delisted=True))


class PromoteDeploymentsTest(unittest.TestCase):
    def test_promotes_target_registry_and_preserves_legacy(self):
        payload = {
            "contracts": {
                "arkaRegistry": "OLD",
            },
            "validations": {},
        }
        report = {"targetRegistryId": "NEW", "totalArkas": 2}
        with tempfile.TemporaryDirectory() as tmpdir:
            deploy_path = Path(tmpdir) / "deployments.testnet.json"
            deploy_path.write_text(json.dumps(payload), encoding="utf-8")
            migration.promote_deployments(
                deploy_json_path=deploy_path,
                target_registry_id="NEW",
                previous_registry_id="OLD",
                report=report,
            )
            promoted = json.loads(deploy_path.read_text(encoding="utf-8"))
        self.assertEqual(promoted["contracts"]["arkaRegistry"], "NEW")
        self.assertEqual(promoted["legacyContracts"]["arkaRegistry"], "OLD")
        self.assertEqual(promoted["validations"]["canonicalRegistryMigration"], report)


class GroupActiveTest(unittest.TestCase):
    def test_groups_only_active_entries(self):
        grouped = migration.group_active(
            [
                migration.ArkaEntry(arka="C1", manager="G1"),
                migration.ArkaEntry(arka="C2", manager="G1", delisted=True),
                migration.ArkaEntry(arka="C3", manager="G2"),
            ]
        )
        self.assertEqual(grouped, {"G1": ["C1"], "G2": ["C3"]})


if __name__ == "__main__":
    unittest.main()
