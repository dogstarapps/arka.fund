#!/usr/bin/env python3
from __future__ import annotations

import argparse
import datetime as dt
import json
import subprocess
import sys
from pathlib import Path
from typing import Any


ROOT_DIR = Path(__file__).resolve().parent.parent
DEFAULT_DEPLOYMENTS = ROOT_DIR / "deployments.testnet.json"
DEFAULT_OUT = ROOT_DIR / "tmp" / "balanced-readiness-validation.json"
DEFAULT_NETWORK = "testnet"
DEFAULT_NETWORK_PASSPHRASE = "Test SDF Network ; September 2015"
DEFAULT_RPC_URL = "https://soroban-testnet.stellar.org"
DEFAULT_SOURCE = "arka-admin"
HELPER = ROOT_DIR / "scripts" / "contract_invoke_value.py"


def load_json(path: Path) -> dict[str, Any]:
    return json.loads(path.read_text(encoding="utf-8"))


def write_json(path: Path, payload: dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, indent=2) + "\n", encoding="utf-8")


def resolve_balanced_targets(
    deployments: dict[str, Any],
    *,
    adapter_id: str = "",
    expected_router: str = "",
    legacy_comet_router: str = "",
    legacy_mock_router: str = "",
) -> tuple[str, str, str, str]:
    contracts = deployments.get("contracts", {})
    legacy_contracts = deployments.get("legacyContracts", {})
    resolved_adapter = (
        adapter_id
        or contracts.get("adapterBalanced", "")
        or legacy_contracts.get("adapterBalanced", "")
    )
    resolved_expected_router = expected_router or contracts.get("balancedRouter", "") or ""
    resolved_legacy_comet_router = legacy_comet_router or legacy_contracts.get("cometPool", "")
    resolved_legacy_mock_router = legacy_mock_router or legacy_contracts.get("balancedRouterMock", "")
    return (
        resolved_adapter,
        resolved_expected_router,
        resolved_legacy_comet_router,
        resolved_legacy_mock_router,
    )


def invoke_value(
    contract_id: str,
    fn_name: str,
    *,
    source_account: str,
    rpc_url: str,
    network_passphrase: str,
    args: list[str] | None = None,
) -> Any:
    proc = subprocess.run(
        [
            sys.executable,
            str(HELPER),
            contract_id,
            source_account,
            rpc_url,
            network_passphrase,
            fn_name,
            *(args or []),
        ],
        cwd=str(ROOT_DIR),
        text=True,
        capture_output=True,
        check=False,
    )
    if proc.returncode != 0:
        raise RuntimeError(proc.stderr.strip() or proc.stdout.strip() or f"invoke failed: {fn_name}")
    raw = proc.stdout.strip()
    if not raw:
        return None
    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        return raw.strip().strip('"')


def normalize_pair_config(payload: Any) -> dict[str, Any] | None:
    if not isinstance(payload, dict):
        return None
    token_in = payload.get("token_in")
    token_out = payload.get("token_out")
    max_price = payload.get("max_price")
    if not isinstance(token_in, str) or not isinstance(token_out, str):
        return None
    try:
        max_price_int = int(str(max_price))
    except (TypeError, ValueError):
        return None
    if max_price_int <= 0:
        return None
    return {
        "tokenIn": token_in,
        "tokenOut": token_out,
        "maxPrice": str(max_price_int),
    }


def derive_readiness(
    *,
    observed_router: str | None,
    expected_router: str | None,
    legacy_comet_router: str | None,
    legacy_mock_router: str | None,
    pool_supported: bool,
    pair_config: dict[str, Any] | None,
) -> dict[str, Any]:
    reasons: list[str] = []
    lane_mode = "unknown"

    if not observed_router:
        reasons.append("adapter router is unreadable on-chain")
    elif expected_router and observed_router == expected_router:
        lane_mode = "expected_router"
    elif legacy_comet_router and observed_router == legacy_comet_router:
        lane_mode = "legacy_comet"
        reasons.append("adapter still points to the retired Comet-coupled router")
    elif legacy_mock_router and observed_router == legacy_mock_router:
        lane_mode = "legacy_mock"
        reasons.append("adapter still points to the historical mock router")
    else:
        lane_mode = "router_mismatch"
        if expected_router:
            reasons.append("adapter router does not match the expected Balanced router")
        else:
            reasons.append("adapter router is not mapped to a canonical Balanced endpoint")

    if not pool_supported and pair_config is None:
        reasons.append("pool activation is missing on-chain")

    ready = lane_mode == "expected_router" and pool_supported and not reasons
    return {
        "supportStatus": "ready" if ready else "blocked",
        "readyForDappExecution": ready,
        "laneMode": lane_mode,
        "blockingReasons": reasons,
    }


def update_deployments_validation(
    deployments_path: Path,
    *,
    out_json: Path,
    report: dict[str, Any],
) -> None:
    deployments = load_json(deployments_path)
    validations = deployments.setdefault("validations", {})
    validations["balancedReadiness"] = {
        "validatedAt": report["validatedAt"],
        "network": report["network"],
        "rpcUrl": report["rpcUrl"],
        "report": str(out_json),
        "adapterBalanced": report["contracts"]["adapterBalanced"],
        "poolId": report["poolId"],
        "supportStatus": report["supportStatus"],
        "readyForDappExecution": report["readyForDappExecution"],
        "laneMode": report["laneMode"],
        "blockingReasons": report["blockingReasons"],
        "observedRouter": report["observedRouter"],
        "expectedRouter": report["expectedRouter"],
        "poolSupported": report["poolSupported"],
        "pairConfigured": report["pairConfigured"],
    }
    write_json(deployments_path, deployments)


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Validate current Balanced lane readiness on testnet.")
    parser.add_argument("--deployments", type=Path, default=DEFAULT_DEPLOYMENTS)
    parser.add_argument("--out-json", type=Path, default=DEFAULT_OUT)
    parser.add_argument("--network", default=DEFAULT_NETWORK)
    parser.add_argument("--rpc-url", default=DEFAULT_RPC_URL)
    parser.add_argument("--network-passphrase", default=DEFAULT_NETWORK_PASSPHRASE)
    parser.add_argument("--source-account", default=DEFAULT_SOURCE)
    parser.add_argument("--adapter-id", default="")
    parser.add_argument("--expected-router", default="")
    parser.add_argument("--legacy-comet-router", default="")
    parser.add_argument("--legacy-mock-router", default="")
    parser.add_argument("--pool-id", type=int, default=1)
    parser.add_argument("--update-deployments", action="store_true")
    return parser


def main(argv: list[str] | None = None) -> int:
    args = build_parser().parse_args(argv)
    deployments = load_json(args.deployments)
    adapter_id, expected_router, legacy_comet_router, legacy_mock_router = resolve_balanced_targets(
        deployments,
        adapter_id=args.adapter_id,
        expected_router=args.expected_router,
        legacy_comet_router=args.legacy_comet_router,
        legacy_mock_router=args.legacy_mock_router,
    )
    if not adapter_id:
        raise SystemExit(
            "missing adapterBalanced id; pass --adapter-id or set deployments contracts.adapterBalanced / legacyContracts.adapterBalanced"
        )

    observed_router_raw = invoke_value(
        adapter_id,
        "router",
        source_account=args.source_account,
        rpc_url=args.rpc_url,
        network_passphrase=args.network_passphrase,
    )
    observed_router = observed_router_raw if isinstance(observed_router_raw, str) else None

    try:
        pair_payload = invoke_value(
            adapter_id,
            "pair_of",
            source_account=args.source_account,
            rpc_url=args.rpc_url,
            network_passphrase=args.network_passphrase,
            args=["--pool_id", str(args.pool_id)],
        )
    except RuntimeError:
        pair_payload = None
    pair_config = normalize_pair_config(pair_payload)
    try:
        pool_supported_raw = invoke_value(
            adapter_id,
            "pool_supported",
            source_account=args.source_account,
            rpc_url=args.rpc_url,
            network_passphrase=args.network_passphrase,
            args=["--pool_id", str(args.pool_id)],
        )
    except RuntimeError:
        pool_supported_raw = None
    if isinstance(pool_supported_raw, bool):
        pool_supported = pool_supported_raw
    elif isinstance(pool_supported_raw, str):
        pool_supported = pool_supported_raw.lower() == "true"
    else:
        pool_supported = False

    readiness = derive_readiness(
        observed_router=observed_router,
        expected_router=expected_router or None,
        legacy_comet_router=legacy_comet_router or None,
        legacy_mock_router=legacy_mock_router or None,
        pool_supported=pool_supported,
        pair_config=pair_config,
    )

    report = {
        "validatedAt": dt.date.today().isoformat(),
        "network": args.network,
        "rpcUrl": args.rpc_url,
        "sourceAccount": args.source_account,
        "poolId": args.pool_id,
        "contracts": {
            "adapterBalanced": adapter_id,
            "expectedRouter": expected_router or None,
            "legacyCometRouter": legacy_comet_router or None,
            "legacyMockRouter": legacy_mock_router or None,
        },
        "observedRouter": observed_router,
        "expectedRouter": expected_router or None,
        "poolSupported": pool_supported,
        "pairConfigured": pair_config is not None,
        "pairConfig": pair_config,
        **readiness,
    }

    write_json(args.out_json, report)
    if args.update_deployments:
        update_deployments_validation(args.deployments, out_json=args.out_json, report=report)

    print(json.dumps(report, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
