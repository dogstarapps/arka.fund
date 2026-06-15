#!/usr/bin/env python3
from __future__ import annotations

import argparse
import datetime as dt
import json
import re
import subprocess
import sys
from dataclasses import dataclass
from pathlib import Path
from typing import Any


ROOT_DIR = Path(__file__).resolve().parent.parent
DEFAULT_DEPLOYMENTS = ROOT_DIR / "deployments.testnet.json"
DEFAULT_OUT = ROOT_DIR / "tmp" / "storage-lifecycle-extend.json"
DEFAULT_NETWORK = "testnet"
DEFAULT_RPC_URL = "https://soroban-testnet.stellar.org"
DEFAULT_NETWORK_PASSPHRASE = "Test SDF Network ; September 2015"
DEFAULT_SOURCE_ACCOUNT = "arka-admin"
DEFAULT_LEDGERS_TO_EXTEND = 120_960
CONTRACT_ID_RE = re.compile(r"^C[A-Z0-9]{55}$")


@dataclass(slots=True)
class ExtendTarget:
    contract_key: str
    contract_id: str


def iso_now() -> str:
    return dt.datetime.now(dt.timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def load_json(path: Path) -> dict[str, Any]:
    return json.loads(path.read_text(encoding="utf-8"))


def write_json(path: Path, payload: dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, indent=2) + "\n", encoding="utf-8")


def split_csv(raw: str) -> list[str]:
    return [item.strip() for item in raw.split(",") if item.strip()]


def extract_extend_targets(
    deployments: dict[str, Any],
    *,
    include_keys: list[str] | None = None,
    exclude_keys: list[str] | None = None,
) -> list[ExtendTarget]:
    contracts_raw = deployments.get("contracts", {})
    if not isinstance(contracts_raw, dict):
        raise ValueError("deployments.contracts must be a map of contract keys to contract ids")

    excludes = set(exclude_keys or [])
    ordered_keys = include_keys or list(contracts_raw.keys())
    missing_includes = [key for key in ordered_keys if key not in contracts_raw]
    if missing_includes:
        raise ValueError(
            f"include-contract-keys contains unknown entries: {', '.join(sorted(missing_includes))}"
        )

    seen_contract_ids: set[str] = set()
    targets: list[ExtendTarget] = []
    for key in ordered_keys:
        if key in excludes:
            continue
        value = contracts_raw.get(key)
        if not isinstance(value, str):
            continue
        contract_id = value.strip()
        if not CONTRACT_ID_RE.fullmatch(contract_id):
            continue
        if contract_id in seen_contract_ids:
            continue
        seen_contract_ids.add(contract_id)
        targets.append(ExtendTarget(contract_key=key, contract_id=contract_id))
    return targets


def build_extend_command(
    target: ExtendTarget,
    *,
    ledgers_to_extend: int,
    source_account: str,
    rpc_url: str,
    network_passphrase: str,
) -> list[str]:
    return [
        "stellar",
        "contract",
        "extend",
        "--id",
        target.contract_id,
        "--ledgers-to-extend",
        str(ledgers_to_extend),
        "--source-account",
        source_account,
        "--rpc-url",
        rpc_url,
        "--network-passphrase",
        network_passphrase,
    ]


def run_command(command: list[str], *, cwd: Path = ROOT_DIR) -> tuple[int, str, str]:
    proc = subprocess.run(
        command,
        cwd=str(cwd),
        text=True,
        capture_output=True,
        check=False,
    )
    return proc.returncode, proc.stdout.strip(), proc.stderr.strip()


def execute_extend_plan(
    targets: list[ExtendTarget],
    *,
    ledgers_to_extend: int,
    source_account: str,
    rpc_url: str,
    network_passphrase: str,
    dry_run: bool,
) -> list[dict[str, Any]]:
    results: list[dict[str, Any]] = []
    for target in targets:
        command = build_extend_command(
            target,
            ledgers_to_extend=ledgers_to_extend,
            source_account=source_account,
            rpc_url=rpc_url,
            network_passphrase=network_passphrase,
        )
        if dry_run:
            results.append(
                {
                    "contractKey": target.contract_key,
                    "contractId": target.contract_id,
                    "status": "dry_run",
                    "command": command,
                    "stdout": "",
                    "stderr": "",
                    "ttlLedger": None,
                }
            )
            continue

        returncode, stdout, stderr = run_command(command)
        ttl_ledger: int | None = None
        if returncode == 0:
            lines = [line.strip().strip('"') for line in stdout.splitlines() if line.strip()]
            if lines:
                try:
                    ttl_ledger = int(lines[-1])
                except ValueError:
                    ttl_ledger = None
        results.append(
            {
                "contractKey": target.contract_key,
                "contractId": target.contract_id,
                "status": "extended" if returncode == 0 else "failed",
                "command": command,
                "stdout": stdout,
                "stderr": stderr,
                "ttlLedger": ttl_ledger,
            }
        )
    return results


def update_deployments_validation(
    deployments: dict[str, Any],
    *,
    network: str,
    rpc_url: str,
    source_account: str,
    ledgers_to_extend: int,
    dry_run: bool,
    results: list[dict[str, Any]],
) -> dict[str, Any]:
    validations = deployments.setdefault("validations", {})
    passed = [item for item in results if item["status"] in {"extended", "dry_run"}]
    failed = [item for item in results if item["status"] == "failed"]
    status = "failed" if failed else ("dry_run" if dry_run else "passed")
    validations["storageLifecycle"] = {
        "validatedAt": dt.date.today().isoformat(),
        "network": network,
        "rpcUrl": rpc_url,
        "sourceAccount": source_account,
        "ledgersToExtend": ledgers_to_extend,
        "dryRun": dry_run,
        "status": status,
        "extendedContracts": [item["contractId"] for item in passed],
        "failedContracts": [item["contractId"] for item in failed],
        "results": results,
    }
    if not failed and dry_run:
        validations["storageLifecycleDryRun"] = True
    if not failed and not dry_run:
        validations["storageLifecycleExtended"] = True
    return deployments


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="Extend TTL lifecycle for canonical contract instances from deployments manifest."
    )
    parser.add_argument("--deployments", type=Path, default=DEFAULT_DEPLOYMENTS)
    parser.add_argument("--out-json", type=Path, default=DEFAULT_OUT)
    parser.add_argument("--network", default=DEFAULT_NETWORK)
    parser.add_argument("--rpc-url", default=DEFAULT_RPC_URL)
    parser.add_argument("--network-passphrase", default=DEFAULT_NETWORK_PASSPHRASE)
    parser.add_argument("--source-account", default=DEFAULT_SOURCE_ACCOUNT)
    parser.add_argument("--ledgers-to-extend", type=int, default=DEFAULT_LEDGERS_TO_EXTEND)
    parser.add_argument("--include-contract-keys", default="")
    parser.add_argument("--exclude-contract-keys", default="")
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--strict", action="store_true")
    parser.add_argument("--update-deployments", action="store_true")
    return parser


def main(argv: list[str] | None = None) -> int:
    args = build_parser().parse_args(argv)
    if args.ledgers_to_extend <= 0:
        raise SystemExit("--ledgers-to-extend must be > 0")

    include_keys = split_csv(args.include_contract_keys)
    exclude_keys = split_csv(args.exclude_contract_keys)
    deployments = load_json(args.deployments)
    targets = extract_extend_targets(
        deployments,
        include_keys=include_keys or None,
        exclude_keys=exclude_keys or None,
    )
    if not targets:
        raise SystemExit("no eligible contract targets found in deployments manifest")

    results = execute_extend_plan(
        targets,
        ledgers_to_extend=args.ledgers_to_extend,
        source_account=args.source_account,
        rpc_url=args.rpc_url,
        network_passphrase=args.network_passphrase,
        dry_run=args.dry_run,
    )
    failed_results = [item for item in results if item["status"] == "failed"]
    status = "failed" if failed_results else ("dry_run" if args.dry_run else "passed")
    report = {
        "validatedAt": iso_now(),
        "network": args.network,
        "rpcUrl": args.rpc_url,
        "deployments": str(args.deployments),
        "outJson": str(args.out_json),
        "sourceAccount": args.source_account,
        "ledgersToExtend": args.ledgers_to_extend,
        "dryRun": args.dry_run,
        "status": status,
        "targetsCount": len(targets),
        "failedCount": len(failed_results),
        "results": results,
    }
    write_json(args.out_json, report)

    if args.update_deployments:
        updated = update_deployments_validation(
            deployments,
            network=args.network,
            rpc_url=args.rpc_url,
            source_account=args.source_account,
            ledgers_to_extend=args.ledgers_to_extend,
            dry_run=args.dry_run,
            results=results,
        )
        write_json(args.deployments, updated)

    print(json.dumps(report, indent=2))
    if args.strict and failed_results:
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
