#!/usr/bin/env python3
import argparse
import copy
import json
import subprocess
import sys
from pathlib import Path
from typing import Any


ROOT_DIR = Path(__file__).resolve().parent.parent
DEFAULT_DEPLOYMENTS = ROOT_DIR / "deployments.testnet.json"
INVOKE_HELPER = ROOT_DIR / "scripts" / "contract_invoke_value.py"
DEFAULT_NETWORK_PASSPHRASE = "Test SDF Network ; September 2015"
DEFAULT_RPC_URL = "https://soroban-testnet.stellar.org"


def load_json(path: Path) -> dict[str, Any]:
    return json.loads(path.read_text())


def write_json(path: Path, payload: dict[str, Any]) -> None:
    path.write_text(json.dumps(payload, indent=2) + "\n")


def _require_validation(doc: dict[str, Any], key: str) -> dict[str, Any]:
    validation = doc.get("validations", {}).get(key)
    if not isinstance(validation, dict):
        raise ValueError(f"missing required validation: {key}")
    return validation


def _optional_validation(doc: dict[str, Any], key: str) -> dict[str, Any] | None:
    validation = doc.get("validations", {}).get(key)
    return validation if isinstance(validation, dict) else None


def derive_balanced_module(doc: dict[str, Any]) -> dict[str, Any] | None:
    balanced = _optional_validation(doc, "balancedReadiness")
    if not balanced:
        return None
    if balanced.get("supportStatus") != "ready":
        return None
    if not balanced.get("readyForDappExecution"):
        return None
    expected_router = balanced.get("expectedRouter")
    adapter_id = balanced.get("adapterBalanced")
    if not isinstance(expected_router, str) or not expected_router:
        return None
    if not isinstance(adapter_id, str) or not adapter_id:
        return None

    return {
        "network": balanced["network"],
        "rpcUrl": balanced["rpcUrl"],
        "validatedAt": balanced["validatedAt"],
        "sourceValidations": ["balancedReadiness"],
        "contracts": {
            "adapterBalanced": adapter_id,
            "router": expected_router,
        },
        "identities": {
            "source": "arka-admin",
        },
        "checks": {
            "poolId": balanced["poolId"],
            "readyForDappExecution": True,
            "poolSupported": bool(balanced.get("poolSupported")),
            "laneMode": balanced.get("laneMode", "expected_router"),
        },
        "provenance": {
            "adapterBalanced": "validations.balancedReadiness.adapterBalanced",
            "router": "validations.balancedReadiness.expectedRouter",
            "poolId": "validations.balancedReadiness.poolId",
            "poolSupported": "validations.balancedReadiness.poolSupported",
        },
    }


def derive_validated_modules(doc: dict[str, Any]) -> dict[str, Any]:
    governance = _require_validation(doc, "governanceHandoff")
    oracle = _require_validation(doc, "oracleGuard")
    fee_engine = _require_validation(doc, "feeEngine")
    coverage = _require_validation(doc, "coverageEconomics")
    claims = _require_validation(doc, "claimsCircuit")
    tokenomics = _require_validation(doc, "tokenomics")

    if coverage.get("contracts") != claims.get("contracts"):
        raise ValueError("coverageEconomics and claimsCircuit contracts diverged")

    modules = {
        "governanceFoundation": {
            "network": governance["network"],
            "rpcUrl": governance["rpcUrl"],
            "validatedAt": governance["validatedAt"],
            "sourceValidations": ["governanceHandoff"],
            "contracts": copy.deepcopy(governance["contracts"]),
            "identities": {
                "admin": governance["adminIdentity"],
                "holder": governance["holderIdentity"],
            },
            "checks": {
                "holderVotes": governance["results"]["currentVotes"],
                "holderLiquidBalance": governance["results"]["liquidBalance"],
                "holderLockedBalance": governance["results"]["lockedBalance"],
            },
            "provenance": {
                "governor": "validations.governanceHandoff.contracts.governor",
                "governanceExecutor": "validations.governanceHandoff.contracts.governanceExecutor",
                "arkaToken": "validations.governanceHandoff.contracts.arkaToken",
                "lockedArka": "validations.governanceHandoff.contracts.lockedArka",
            },
        },
        "oracleSafety": {
            "network": oracle["network"],
            "rpcUrl": oracle["rpcUrl"],
            "validatedAt": oracle["validatedAt"],
            "sourceValidations": ["oracleGuard"],
            "contracts": copy.deepcopy(oracle["contracts"]),
            "identities": {
                "admin": oracle["adminIdentity"],
            },
            "checks": {
                "validationAsset": oracle["contracts"]["validationAsset"],
                "selectedSourceUnderDivergence": oracle["results"]["secondarySelection"]["selected_source"],
            },
            "provenance": {
                "oracleGuard": "validations.oracleGuard.contracts.oracleGuard",
                "primaryOracle": "validations.oracleGuard.contracts.primaryOracle",
                "secondaryOracle": "validations.oracleGuard.contracts.secondaryOracle",
                "validationAsset": "validations.oracleGuard.contracts.validationAsset",
            },
        },
        "feeEngine": {
            "network": fee_engine["network"],
            "rpcUrl": fee_engine["rpcUrl"],
            "validatedAt": fee_engine["validatedAt"],
            "sourceValidations": ["feeEngine"],
            "contracts": copy.deepcopy(fee_engine["contracts"]),
            "identities": copy.deepcopy(fee_engine["identities"]),
            "checks": {
                "protocolTreasuryShares": fee_engine["results"]["treasurySharesAfterProfit"],
                "managerSharesAfterProfit": fee_engine["results"]["managerSharesAfterProfit"],
                "holderBalanceFinal": fee_engine["results"]["holderBalanceFinal"],
            },
            "provenance": {
                "arka": "validations.feeEngine.contracts.arka",
                "token": "validations.feeEngine.contracts.token",
                "router": "validations.feeEngine.contracts.router",
                "profitAdapter": "validations.feeEngine.contracts.profitAdapter",
            },
        },
        "coverageClaims": {
            "network": claims["network"],
            "rpcUrl": claims["rpcUrl"],
            "validatedAt": claims["validatedAt"],
            "sourceValidations": ["coverageEconomics", "claimsCircuit"],
            "contracts": copy.deepcopy(claims["contracts"]),
            "identities": copy.deepcopy(claims["identities"]),
            "checks": {
                "approvedIncidentId": claims["results"]["approvedIncidentId"],
                "approvedPayout": claims["results"]["approvedPlan"]["approved_payout"],
                "holderReserveFinal": claims["results"]["holderReserveFinal"],
                "treasuryReserveFinal": claims["results"]["treasuryReserveFinal"],
                "fundClaimCapacityFinal": claims["results"]["fundClaimCapacityFinal"],
            },
            "provenance": {
                "coverageVault": "validations.claimsCircuit.contracts.coverageVault",
                "coverageFund": "validations.claimsCircuit.contracts.coverageFund",
                "claimsManager": "validations.claimsCircuit.contracts.claimsManager",
                "reserveToken": "validations.claimsCircuit.contracts.reserveToken",
                "bootstrapToken": "validations.claimsCircuit.contracts.bootstrapToken",
            },
        },
        "tokenomicsFoundation": {
            "network": tokenomics["network"],
            "rpcUrl": tokenomics["rpcUrl"],
            "validatedAt": tokenomics["validatedAt"],
            "sourceValidations": ["tokenomics"],
            "contracts": copy.deepcopy(tokenomics["contracts"]),
            "identities": copy.deepcopy(tokenomics["identities"]),
            "checks": {
                "teamVotesFinal": tokenomics["results"]["teamVotesFinal"],
                "teamLiquidAfterLock": tokenomics["results"]["teamLiquidAfterLock"],
                "teamVestedFinal": tokenomics["results"]["teamVestedFinal"],
                "ecosystemReleasedInitial": tokenomics["results"]["ecosystemReleasedInitial"],
            },
            "provenance": {
                "arkaToken": "validations.tokenomics.contracts.arkaToken",
                "lockedArka": "validations.tokenomics.contracts.lockedArka",
                "governanceExecutor": "validations.tokenomics.contracts.governanceExecutor",
                "arkaVesting": "validations.tokenomics.contracts.arkaVesting",
                "emissionsController": "validations.tokenomics.contracts.emissionsController",
            },
        },
    }
    balanced_module = derive_balanced_module(doc)
    if balanced_module:
        modules["balancedExecution"] = balanced_module
    return modules


def promote_modules(doc: dict[str, Any]) -> dict[str, Any]:
    promoted = copy.deepcopy(doc)
    promoted["validatedModules"] = derive_validated_modules(promoted)
    return promoted


def assert_validated_modules_synced(doc: dict[str, Any]) -> dict[str, Any]:
    derived = derive_validated_modules(doc)
    current = doc.get("validatedModules")
    if current != derived:
        raise AssertionError("validatedModules is missing or out of sync with validations")
    return derived


def stellar_address(identity: str) -> str:
    proc = subprocess.run(
        ["stellar", "keys", "address", identity],
        capture_output=True,
        text=True,
        check=True,
    )
    return proc.stdout.strip()


def invoke_value(
    contract_id: str,
    source_identity: str,
    rpc_url: str,
    network_passphrase: str,
    fn_name: str,
    *fn_args: str,
) -> Any:
    proc = subprocess.run(
        [
            sys.executable,
            str(INVOKE_HELPER),
            contract_id,
            source_identity,
            rpc_url,
            network_passphrase,
            fn_name,
            *fn_args,
        ],
        capture_output=True,
        text=True,
        check=True,
    )
    raw = proc.stdout.strip()
    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        return raw


def _expect(condition: bool, message: str) -> None:
    if not condition:
        raise AssertionError(message)


def _as_int(value: Any) -> int:
    if isinstance(value, bool):
        return int(value)
    if isinstance(value, int):
        return value
    return int(str(value))


def verify_governance(module: dict[str, Any], network_passphrase: str) -> None:
    admin_addr = stellar_address(module["identities"]["admin"])
    holder_addr = stellar_address(module["identities"]["holder"])
    rpc_url = module["rpcUrl"]
    contracts = module["contracts"]

    config = invoke_value(contracts["governanceExecutor"], module["identities"]["admin"], rpc_url, network_passphrase, "config")
    _expect(config["admin"] == admin_addr, "governance executor admin mismatch")
    _expect(config["governor"] == contracts["governor"], "governance executor governor mismatch")

    holder_balance = _as_int(
        invoke_value(
            contracts["arkaToken"],
            module["identities"]["admin"],
            rpc_url,
            network_passphrase,
            "balance",
            "--owner",
            holder_addr,
        )
    )
    _expect(holder_balance == _as_int(module["checks"]["holderLiquidBalance"]), "governance holder liquid balance mismatch")

    lock_cfg = invoke_value(contracts["lockedArka"], module["identities"]["admin"], rpc_url, network_passphrase, "config")
    _expect(lock_cfg["token"] == contracts["arkaToken"], "locked ARKA token mismatch")
    votes = _as_int(
        invoke_value(
            contracts["lockedArka"],
            module["identities"]["admin"],
            rpc_url,
            network_passphrase,
            "get_votes",
            "--account",
            holder_addr,
        )
    )
    _expect(votes == _as_int(module["checks"]["holderVotes"]), "locked ARKA votes mismatch")


def verify_oracle(module: dict[str, Any], network_passphrase: str) -> None:
    admin_addr = stellar_address(module["identities"]["admin"])
    admin = invoke_value(
        module["contracts"]["oracleGuard"],
        module["identities"]["admin"],
        module["rpcUrl"],
        network_passphrase,
        "admin",
    )
    _expect(admin == admin_addr, "oracle guard admin mismatch")


def verify_fee_engine(module: dict[str, Any], network_passphrase: str) -> None:
    treasury_addr = stellar_address(module["identities"]["treasury"])
    rpc_url = module["rpcUrl"]
    contracts = module["contracts"]
    protocol_treasury = invoke_value(
        contracts["arka"],
        module["identities"]["admin"],
        rpc_url,
        network_passphrase,
        "protocol_treasury",
    )
    _expect(protocol_treasury == treasury_addr, "fee engine treasury mismatch")
    fee_state = invoke_value(contracts["arka"], module["identities"]["admin"], rpc_url, network_passphrase, "fee_state")
    _expect(_as_int(fee_state["cumulative_manager_shares"]) > 0, "manager shares did not accrue")
    _expect(_as_int(fee_state["cumulative_protocol_shares"]) > 0, "protocol shares did not accrue")
    nav = _as_int(invoke_value(contracts["arka"], module["identities"]["admin"], rpc_url, network_passphrase, "nav"))
    _expect(nav > 0, "fee engine NAV must be positive")


def verify_coverage_claims(module: dict[str, Any], network_passphrase: str) -> None:
    treasury_addr = stellar_address(module["identities"]["treasury"])
    covered_vault_addr = stellar_address(module["identities"]["coveredVault"])
    rpc_url = module["rpcUrl"]
    contracts = module["contracts"]

    fund_treasury = invoke_value(contracts["coverageFund"], module["identities"]["admin"], rpc_url, network_passphrase, "treasury")
    _expect(fund_treasury == treasury_addr, "coverage fund treasury mismatch")

    claims_treasury = invoke_value(contracts["claimsManager"], module["identities"]["admin"], rpc_url, network_passphrase, "treasury")
    _expect(claims_treasury == treasury_addr, "claims manager treasury mismatch")

    covered_vault = invoke_value(
        contracts["claimsManager"],
        module["identities"]["admin"],
        rpc_url,
        network_passphrase,
        "covered_vault",
        "--vault",
        covered_vault_addr,
    )
    _expect(covered_vault["community_fund"] == contracts["coverageFund"], "claims manager coverage fund mismatch")
    _expect(covered_vault["manager_vault"] == contracts["coverageVault"], "claims manager coverage vault mismatch")

    incident = invoke_value(
        contracts["claimsManager"],
        module["identities"]["admin"],
        rpc_url,
        network_passphrase,
        "incident",
        "--incident_id",
        str(module["checks"]["approvedIncidentId"]),
    )
    _expect(incident["status"] == 3, "approved incident is not executed")
    _expect(_as_int(incident["approved_payout"]) == _as_int(module["checks"]["approvedPayout"]), "approved payout mismatch")

    fund_claim_capacity = _as_int(
        invoke_value(
            contracts["coverageFund"],
            module["identities"]["admin"],
            rpc_url,
            network_passphrase,
            "claim_capacity",
        )
    )
    _expect(fund_claim_capacity == _as_int(module["checks"]["fundClaimCapacityFinal"]), "coverage fund claim capacity mismatch")

    vault_claim_capacity = _as_int(
        invoke_value(
            contracts["coverageVault"],
            module["identities"]["admin"],
            rpc_url,
            network_passphrase,
            "claim_capacity",
        )
    )
    _expect(vault_claim_capacity == 0, "coverage vault claim capacity expected to be exhausted")


def verify_tokenomics(module: dict[str, Any], network_passphrase: str) -> None:
    rpc_url = module["rpcUrl"]
    contracts = module["contracts"]
    team_addr = stellar_address(module["identities"]["team"])
    ecosystem_addr = stellar_address(module["identities"]["ecosystem"])

    vesting_token = invoke_value(contracts["arkaVesting"], module["identities"]["admin"], rpc_url, network_passphrase, "token")
    _expect(vesting_token == contracts["arkaToken"], "vesting token mismatch")
    vesting_governor = invoke_value(contracts["arkaVesting"], module["identities"]["admin"], rpc_url, network_passphrase, "governor")
    _expect(vesting_governor == contracts["governanceExecutor"], "vesting governor mismatch")
    grant_ids = invoke_value(
        contracts["arkaVesting"],
        module["identities"]["admin"],
        rpc_url,
        network_passphrase,
        "grant_ids",
        "--beneficiary",
        team_addr,
    )
    _expect(grant_ids == [1], "vesting grant id set mismatch")

    emissions_token = invoke_value(contracts["emissionsController"], module["identities"]["admin"], rpc_url, network_passphrase, "token")
    _expect(emissions_token == contracts["arkaToken"], "emissions token mismatch")
    emissions_governor = invoke_value(contracts["emissionsController"], module["identities"]["admin"], rpc_url, network_passphrase, "governor")
    _expect(emissions_governor == contracts["governanceExecutor"], "emissions governor mismatch")
    stream_ids = invoke_value(
        contracts["emissionsController"],
        module["identities"]["admin"],
        rpc_url,
        network_passphrase,
        "stream_ids",
        "--recipient",
        ecosystem_addr,
    )
    _expect(stream_ids == [1], "emissions stream id set mismatch")

    team_liquid = _as_int(
        invoke_value(
            contracts["arkaToken"],
            module["identities"]["admin"],
            rpc_url,
            network_passphrase,
            "balance",
            "--owner",
            team_addr,
        )
    )
    _expect(team_liquid == _as_int(module["checks"]["teamLiquidAfterLock"]), "team liquid balance mismatch")

    team_votes = _as_int(
        invoke_value(
            contracts["lockedArka"],
            module["identities"]["admin"],
            rpc_url,
            network_passphrase,
            "get_votes",
            "--account",
            team_addr,
        )
    )
    _expect(team_votes == _as_int(module["checks"]["teamVotesFinal"]), "team votes mismatch")


def verify_balanced(module: dict[str, Any], network_passphrase: str) -> None:
    rpc_url = module["rpcUrl"]
    source_identity = module["identities"]["source"]
    contracts = module["contracts"]
    router = invoke_value(
        contracts["adapterBalanced"],
        source_identity,
        rpc_url,
        network_passphrase,
        "router",
    )
    _expect(router == contracts["router"], "balanced router mismatch")
    pool_supported = invoke_value(
        contracts["adapterBalanced"],
        source_identity,
        rpc_url,
        network_passphrase,
        "pool_supported",
        "--pool_id",
        str(module["checks"]["poolId"]),
    )
    _expect(bool(pool_supported), "balanced pool is not active on-chain")


VERIFY_DISPATCH = {
    "governanceFoundation": verify_governance,
    "oracleSafety": verify_oracle,
    "feeEngine": verify_fee_engine,
    "coverageClaims": verify_coverage_claims,
    "tokenomicsFoundation": verify_tokenomics,
    "balancedExecution": verify_balanced,
}


def command_promote(args: argparse.Namespace) -> int:
    path = Path(args.deployments).resolve()
    promoted = promote_modules(load_json(path))
    write_json(path, promoted)
    print(json.dumps(promoted["validatedModules"], indent=2))
    return 0


def command_verify(args: argparse.Namespace) -> int:
    path = Path(args.deployments).resolve()
    doc = load_json(path)
    modules = assert_validated_modules_synced(doc)
    for module_name in args.module or list(modules.keys()):
        VERIFY_DISPATCH[module_name](modules[module_name], args.network_passphrase)
    print(json.dumps({"verifiedModules": args.module or list(modules.keys())}, indent=2))
    return 0


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Promote and verify canonical validated testnet modules.")
    subparsers = parser.add_subparsers(dest="command", required=True)

    promote = subparsers.add_parser("promote", help="Promote validated modules into deployments.testnet.json")
    promote.add_argument("--deployments", default=str(DEFAULT_DEPLOYMENTS))
    promote.set_defaults(func=command_promote)

    verify = subparsers.add_parser("verify", help="Verify promoted validated modules live against testnet")
    verify.add_argument("--deployments", default=str(DEFAULT_DEPLOYMENTS))
    verify.add_argument("--network-passphrase", default=DEFAULT_NETWORK_PASSPHRASE)
    verify.add_argument(
        "--module",
        action="append",
        choices=sorted(VERIFY_DISPATCH.keys()),
        help="Limit verification to one or more validated modules",
    )
    verify.set_defaults(func=command_verify)
    return parser


def main(argv: list[str] | None = None) -> int:
    parser = build_parser()
    args = parser.parse_args(argv)
    return args.func(args)


if __name__ == "__main__":
    raise SystemExit(main())
