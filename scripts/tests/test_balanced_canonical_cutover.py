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

import balanced_canonical_cutover as cutover


def base_fixture() -> dict:
    return {
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
        },
        "legacyContracts": {
            "adapterBalanced": "CBAL_LEGACY",
            "balancedRouterMock": "CMOCK",
            "cometPool": "CCOMET",
        },
    }


class BalancedCanonicalCutoverTests(unittest.TestCase):
    def test_apply_cutover_updates_canonical_contracts_and_archives_legacy(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            deployments = Path(tmpdir) / "deployments.json"
            deployments.write_text(json.dumps(base_fixture(), indent=2), encoding="utf-8")

            updated = cutover.apply_cutover_to_deployments(
                deployments,
                adapter_id="CBAL_CANONICAL",
                router_id="CROUTER",
            )

            self.assertEqual(updated["contracts"]["adapterBalanced"], "CBAL_CANONICAL")
            self.assertEqual(updated["contracts"]["balancedRouter"], "CROUTER")
            self.assertEqual(updated["legacyContracts"]["adapterBalanced"], "CBAL_LEGACY")
            self.assertEqual(updated["legacyContracts"]["adapterBalancedLegacy"], "CBAL_LEGACY")

    def test_cutover_cli_deploys_configures_validates_and_promotes(self):
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
                    if args[:2] == ["keys", "address"]:
                        print("GADMINADDRESS")
                        raise SystemExit(0)
                    if args[:2] == ["contract", "deploy"]:
                        print("CBAL_CANONICAL")
                        raise SystemExit(0)
                    if args[:2] == ["contract", "invoke"]:
                        if "--" not in args:
                            raise SystemExit("missing function separator")
                        fn_name = args[args.index("--") + 1]
                        if fn_name in ("init", "set_supported_pool"):
                            print("ok")
                            raise SystemExit(0)
                        if fn_name == "router":
                            print("CROUTER")
                            raise SystemExit(0)
                        if fn_name == "pool_supported":
                            print("true")
                            raise SystemExit(0)
                        print("null")
                        raise SystemExit(0)
                    raise SystemExit("unsupported stellar invocation: " + " ".join(args))
                    """
                ),
                encoding="utf-8",
            )
            stellar_path.chmod(stellar_path.stat().st_mode | stat.S_IEXEC)

            deployments = tmp / "deployments.json"
            deployments.write_text(json.dumps(base_fixture(), indent=2), encoding="utf-8")
            out_json = tmp / "cutover.json"
            readiness_json = tmp / "readiness.json"
            wasm_path = tmp / "adapter-balanced.wasm"
            wasm_path.write_bytes(b"\0asm")

            env = dict(os.environ)
            env["PATH"] = f"{fake_bin}:{env['PATH']}"

            subprocess.run(
                [
                    sys.executable,
                    str(cutover.ROOT_DIR / "scripts" / "balanced_canonical_cutover.py"),
                    "--deployments",
                    str(deployments),
                    "--out-json",
                    str(out_json),
                    "--readiness-out-json",
                    str(readiness_json),
                    "--wasm-path",
                    str(wasm_path),
                    "--router",
                    "CROUTER",
                    "--pool-id",
                    "1",
                    "--source-account",
                    "arka-admin",
                    "--rpc-url",
                    "https://rpc",
                    "--network-passphrase",
                    "Test SDF Network ; September 2015",
                ],
                check=True,
                env=env,
                cwd=str(cutover.ROOT_DIR),
                capture_output=True,
                text=True,
            )

            updated = json.loads(deployments.read_text(encoding="utf-8"))
            self.assertEqual(updated["contracts"]["adapterBalanced"], "CBAL_CANONICAL")
            self.assertEqual(updated["contracts"]["balancedRouter"], "CROUTER")
            self.assertEqual(updated["validations"]["balancedReadiness"]["supportStatus"], "ready")
            self.assertTrue(updated["validations"]["balancedReadiness"]["readyForDappExecution"])
            self.assertIn("balancedExecution", updated["validatedModules"])
            self.assertEqual(
                updated["validatedModules"]["balancedExecution"]["contracts"]["router"],
                "CROUTER",
            )

            report = json.loads(out_json.read_text(encoding="utf-8"))
            self.assertTrue(report["validatedModulePresent"])
            self.assertEqual(report["readiness"]["supportStatus"], "ready")

            invocations = log_path.read_text(encoding="utf-8")
            self.assertIn("contract deploy", invocations)
            self.assertIn(" set_supported_pool ", f" {invocations} ")


if __name__ == "__main__":
    unittest.main()
