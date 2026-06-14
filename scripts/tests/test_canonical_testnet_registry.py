import json
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import canonical_testnet_registry as registry


FIXTURE = {
    "contracts": {"arka": "CORE"},
    "validations": {
        "governanceHandoff": {
            "network": "testnet",
            "rpcUrl": "https://rpc",
            "validatedAt": "2026-03-28",
            "adminIdentity": "admin",
            "holderIdentity": "holder",
            "contracts": {
                "governor": "GOV",
                "governanceExecutor": "EXEC",
                "arkaToken": "TOKEN",
                "lockedArka": "LOCK",
            },
            "results": {"currentVotes": 220, "liquidBalance": 0, "lockedBalance": 220},
        },
        "oracleGuard": {
            "network": "testnet",
            "rpcUrl": "https://rpc",
            "validatedAt": "2026-03-28",
            "adminIdentity": "admin",
            "contracts": {
                "oracleGuard": "ORACLE",
                "primaryOracle": "P",
                "secondaryOracle": "S",
                "validationAsset": "ASSET",
            },
            "results": {"secondarySelection": {"selected_source": 2}},
        },
        "feeEngine": {
            "network": "testnet",
            "rpcUrl": "https://rpc",
            "validatedAt": "2026-03-28",
            "identities": {"admin": "admin", "holder": "holder", "treasury": "treasury"},
            "contracts": {"arka": "ARKA", "token": "FEE_TOKEN", "router": "ROUTER", "profitAdapter": "ADAPTER"},
            "results": {
                "treasurySharesAfterProfit": "7",
                "managerSharesAfterProfit": "9",
                "holderBalanceFinal": "12",
            },
        },
        "coverageEconomics": {
            "network": "testnet",
            "rpcUrl": "https://rpc",
            "validatedAt": "2026-03-28",
            "identities": {
                "admin": "admin",
                "staker": "holder",
                "treasury": "treasury",
                "coveredVault": "vault",
                "payout": "holder",
            },
            "contracts": {
                "reserveToken": "RESERVE",
                "bootstrapToken": "BOOT",
                "coverageVault": "COV_VAULT",
                "coverageFund": "COV_FUND",
                "claimsManager": "CLAIMS",
            },
            "results": {"holderReserveAfterClaim": 84},
        },
        "claimsCircuit": {
            "network": "testnet",
            "rpcUrl": "https://rpc",
            "validatedAt": "2026-03-28",
            "identities": {
                "admin": "admin",
                "staker": "holder",
                "treasury": "treasury",
                "coveredVault": "vault",
                "payout": "holder",
            },
            "contracts": {
                "reserveToken": "RESERVE",
                "bootstrapToken": "BOOT",
                "coverageVault": "COV_VAULT",
                "coverageFund": "COV_FUND",
                "claimsManager": "CLAIMS",
            },
            "results": {
                "approvedIncidentId": 2,
                "approvedPlan": {"approved_payout": "1000"},
                "holderReserveFinal": 1084,
                "treasuryReserveFinal": 456,
                "fundClaimCapacityFinal": 0,
            },
        },
        "tokenomics": {
            "network": "testnet",
            "rpcUrl": "https://rpc",
            "validatedAt": "2026-03-28",
            "identities": {"admin": "admin", "team": "holder", "treasury": "treasury", "ecosystem": "eco"},
            "contracts": {
                "arkaToken": "TOK2",
                "lockedArka": "LOCK2",
                "governanceExecutor": "EXEC2",
                "arkaVesting": "VEST",
                "emissionsController": "EMIT",
            },
            "results": {
                "teamVotesFinal": 1000,
                "teamLiquidAfterLock": 2000,
                "teamVestedFinal": 3000,
                "ecosystemReleasedInitial": 2400,
            },
        },
        "balancedReadiness": {
            "network": "testnet",
            "rpcUrl": "https://rpc",
            "validatedAt": "2026-03-30",
            "adapterBalanced": "BAL_ADAPTER",
            "poolId": 1,
            "supportStatus": "blocked",
            "readyForDappExecution": False,
            "laneMode": "legacy_comet",
            "blockingReasons": ["legacy router"],
            "observedRouter": "COMET",
            "expectedRouter": None,
            "poolSupported": False,
            "pairConfigured": True,
        },
    },
}


class CanonicalRegistryTests(unittest.TestCase):
    def test_derive_validated_modules_collects_expected_sources(self):
        modules = registry.derive_validated_modules(FIXTURE)
        self.assertEqual(modules["governanceFoundation"]["contracts"]["governor"], "GOV")
        self.assertEqual(modules["governanceFoundation"]["checks"]["holderVotes"], 220)
        self.assertEqual(modules["coverageClaims"]["sourceValidations"], ["coverageEconomics", "claimsCircuit"])
        self.assertEqual(modules["tokenomicsFoundation"]["contracts"]["arkaVesting"], "VEST")
        self.assertEqual(modules["oracleSafety"]["provenance"]["oracleGuard"], "validations.oracleGuard.contracts.oracleGuard")
        self.assertNotIn("balancedExecution", modules)

    def test_derive_validated_modules_promotes_balanced_when_ready(self):
        fixture = json.loads(json.dumps(FIXTURE))
        fixture["validations"]["balancedReadiness"].update(
            {
                "supportStatus": "ready",
                "readyForDappExecution": True,
                "laneMode": "expected_router",
                "expectedRouter": "BAL_ROUTER",
                "poolSupported": True,
            }
        )
        modules = registry.derive_validated_modules(fixture)
        self.assertIn("balancedExecution", modules)
        self.assertEqual(modules["balancedExecution"]["contracts"]["adapterBalanced"], "BAL_ADAPTER")
        self.assertEqual(modules["balancedExecution"]["contracts"]["router"], "BAL_ROUTER")
        self.assertEqual(modules["balancedExecution"]["checks"]["poolId"], 1)
        self.assertEqual(modules["balancedExecution"]["sourceValidations"], ["balancedReadiness"])

    def test_promote_cli_writes_synced_validated_modules(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            path = Path(tmpdir) / "deployments.testnet.json"
            path.write_text(json.dumps(FIXTURE, indent=2))
            subprocess.run(
                [sys.executable, str(registry.ROOT_DIR / "scripts" / "canonical_testnet_registry.py"), "promote", "--deployments", str(path)],
                check=True,
                capture_output=True,
                text=True,
            )
            promoted = json.loads(path.read_text())
            self.assertIn("validatedModules", promoted)
            self.assertEqual(promoted["contracts"]["arka"], "CORE")
            modules = registry.assert_validated_modules_synced(promoted)
            self.assertEqual(modules["feeEngine"]["contracts"]["profitAdapter"], "ADAPTER")

    def test_verify_dispatch_includes_balanced_execution(self):
        self.assertIn("balancedExecution", registry.VERIFY_DISPATCH)


if __name__ == "__main__":
    unittest.main()
