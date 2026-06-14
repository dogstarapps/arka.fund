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
DEFAULT_WASM = ROOT_DIR / "artifacts" / "adapter-balanced.wasm"
DEFAULT_OUT = ROOT_DIR / "tmp" / "balanced-canonical-cutover.json"
DEFAULT_NETWORK = "testnet"
DEFAULT_NETWORK_PASSPHRASE = "Test SDF Network ; September 2015"
DEFAULT_RPC_URL = "https://soroban-testnet.stellar.org"
DEFAULT_SOURCE = "arka-admin"
READINESS_SCRIPT = ROOT_DIR / "scripts" / "validate_balanced_readiness.py"
PROMOTE_SCRIPT = ROOT_DIR / "scripts" / "canonical_testnet_registry.py"


def load_json(path: Path) -> dict[str, Any]:
    return json.loads(path.read_text(encoding="utf-8"))


def write_json(path: Path, payload: dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, indent=2) + "\n", encoding="utf-8")


def run_command(command: list[str], *, cwd: Path = ROOT_DIR) -> str:
    proc = subprocess.run(
        command,
        cwd=str(cwd),
        text=True,
        capture_output=True,
        check=False,
    )
    if proc.returncode != 0:
        raise RuntimeError(proc.stderr.strip() or proc.stdout.strip() or "command failed")
    return proc.stdout.strip()


def extract_last_line(raw: str) -> str:
    lines = [line.strip().strip('"') for line in raw.splitlines() if line.strip()]
    if not lines:
        raise RuntimeError("command returned no output")
    return lines[-1]


def stellar_address(identity: str) -> str:
    return extract_last_line(run_command(["stellar", "keys", "address", identity]))


def deploy_contract(
    *,
    wasm_path: Path,
    source_account: str,
    rpc_url: str,
    network_passphrase: str,
) -> str:
    output = run_command(
        [
            "stellar",
            "contract",
            "deploy",
            "--wasm",
            str(wasm_path),
            "--source-account",
            source_account,
            "--rpc-url",
            rpc_url,
            "--network-passphrase",
            network_passphrase,
            "--ignore-checks",
        ]
    )
    return extract_last_line(output)


def invoke_contract(
    *,
    contract_id: str,
    source_account: str,
    rpc_url: str,
    network_passphrase: str,
    fn_name: str,
    fn_args: list[str],
) -> None:
    run_command(
        [
            "stellar",
            "contract",
            "invoke",
            "--id",
            contract_id,
            "--source-account",
            source_account,
            "--rpc-url",
            rpc_url,
            "--network-passphrase",
            network_passphrase,
            "--send=yes",
            "--",
            fn_name,
            *fn_args,
        ]
    )


def apply_cutover_to_deployments(
    deployments_path: Path,
    *,
    adapter_id: str,
    router_id: str,
) -> dict[str, Any]:
    deployments = load_json(deployments_path)
    contracts = deployments.setdefault("contracts", {})
    legacy_contracts = deployments.setdefault("legacyContracts", {})

    current_canonical_adapter = contracts.get("adapterBalanced")
    if isinstance(current_canonical_adapter, str) and current_canonical_adapter and current_canonical_adapter != adapter_id:
        legacy_contracts.setdefault("adapterBalancedPreviousCanonical", current_canonical_adapter)

    current_legacy_adapter = legacy_contracts.get("adapterBalanced")
    if isinstance(current_legacy_adapter, str) and current_legacy_adapter and current_legacy_adapter != adapter_id:
        legacy_contracts.setdefault("adapterBalancedLegacy", current_legacy_adapter)

    current_canonical_router = contracts.get("balancedRouter")
    if isinstance(current_canonical_router, str) and current_canonical_router and current_canonical_router != router_id:
        legacy_contracts.setdefault("balancedRouterPreviousCanonical", current_canonical_router)

    contracts["adapterBalanced"] = adapter_id
    contracts["balancedRouter"] = router_id
    write_json(deployments_path, deployments)
    return deployments


def run_readiness_validation(
    *,
    deployments_path: Path,
    adapter_id: str,
    router_id: str,
    pool_id: int,
    network: str,
    rpc_url: str,
    network_passphrase: str,
    source_account: str,
    out_json: Path,
) -> dict[str, Any]:
    run_command(
        [
            sys.executable,
            str(READINESS_SCRIPT),
            "--deployments",
            str(deployments_path),
            "--adapter-id",
            adapter_id,
            "--expected-router",
            router_id,
            "--pool-id",
            str(pool_id),
            "--network",
            network,
            "--rpc-url",
            rpc_url,
            "--network-passphrase",
            network_passphrase,
            "--source-account",
            source_account,
            "--out-json",
            str(out_json),
            "--update-deployments",
        ]
    )
    return load_json(out_json)


def promote_canonical_registry(*, deployments_path: Path) -> dict[str, Any]:
    run_command(
        [
            sys.executable,
            str(PROMOTE_SCRIPT),
            "promote",
            "--deployments",
            str(deployments_path),
        ]
    )
    return load_json(deployments_path)


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Deploy and promote the canonical Balanced lane.")
    parser.add_argument("--deployments", type=Path, default=DEFAULT_DEPLOYMENTS)
    parser.add_argument("--out-json", type=Path, default=DEFAULT_OUT)
    parser.add_argument("--readiness-out-json", type=Path, default=ROOT_DIR / "tmp" / "balanced-readiness-validation.json")
    parser.add_argument("--wasm-path", type=Path, default=DEFAULT_WASM)
    parser.add_argument("--network", default=DEFAULT_NETWORK)
    parser.add_argument("--rpc-url", default=DEFAULT_RPC_URL)
    parser.add_argument("--network-passphrase", default=DEFAULT_NETWORK_PASSPHRASE)
    parser.add_argument("--source-account", default=DEFAULT_SOURCE)
    parser.add_argument("--admin-address", default="")
    parser.add_argument("--router", required=True)
    parser.add_argument("--pool-id", type=int, default=1)
    parser.add_argument("--adapter-id", default="")
    parser.add_argument("--skip-init", action="store_true")
    parser.add_argument("--skip-pool-activation", action="store_true")
    return parser


def main(argv: list[str] | None = None) -> int:
    args = build_parser().parse_args(argv)
    if not args.adapter_id and not args.wasm_path.is_file():
        raise SystemExit(f"missing adapter wasm: {args.wasm_path}")

    admin_address = args.admin_address or stellar_address(args.source_account)
    adapter_id = args.adapter_id or deploy_contract(
        wasm_path=args.wasm_path,
        source_account=args.source_account,
        rpc_url=args.rpc_url,
        network_passphrase=args.network_passphrase,
    )

    if not args.skip_init:
        invoke_contract(
            contract_id=adapter_id,
            source_account=args.source_account,
            rpc_url=args.rpc_url,
            network_passphrase=args.network_passphrase,
            fn_name="init",
            fn_args=["--admin", admin_address, "--router", args.router],
        )

    if not args.skip_pool_activation:
        invoke_contract(
            contract_id=adapter_id,
            source_account=args.source_account,
            rpc_url=args.rpc_url,
            network_passphrase=args.network_passphrase,
            fn_name="set_supported_pool",
            fn_args=[
                "--caller",
                admin_address,
                "--pool_id",
                str(args.pool_id),
                "--supported",
                "true",
            ],
        )

    apply_cutover_to_deployments(
        args.deployments,
        adapter_id=adapter_id,
        router_id=args.router,
    )
    readiness = run_readiness_validation(
        deployments_path=args.deployments,
        adapter_id=adapter_id,
        router_id=args.router,
        pool_id=args.pool_id,
        network=args.network,
        rpc_url=args.rpc_url,
        network_passphrase=args.network_passphrase,
        source_account=args.source_account,
        out_json=args.readiness_out_json,
    )
    promoted = promote_canonical_registry(deployments_path=args.deployments)

    summary = {
        "validatedAt": dt.date.today().isoformat(),
        "network": args.network,
        "rpcUrl": args.rpc_url,
        "sourceAccount": args.source_account,
        "adminAddress": admin_address,
        "adapterBalanced": adapter_id,
        "router": args.router,
        "poolId": args.pool_id,
        "deployments": str(args.deployments),
        "readinessReport": str(args.readiness_out_json),
        "readiness": readiness,
        "validatedModulePresent": "balancedExecution" in promoted.get("validatedModules", {}),
    }
    write_json(args.out_json, summary)
    print(json.dumps(summary, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
