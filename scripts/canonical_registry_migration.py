#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import subprocess
import sys
import time
from dataclasses import dataclass
from pathlib import Path
from typing import Any


ROOT_DIR = Path(__file__).resolve().parents[1]
DEFAULT_RPC_URL = "https://soroban-testnet.stellar.org"
DEFAULT_NETWORK_PASSPHRASE = "Test SDF Network ; September 2015"


class CliError(RuntimeError):
    pass


@dataclass(frozen=True)
class ArkaEntry:
    arka: str
    manager: str
    curated: bool = False
    delisted: bool = False


def parse_contract_output(raw: str) -> Any:
    lines = []
    for line in raw.splitlines():
        stripped = line.strip()
        if not stripped:
            continue
        if stripped.startswith(("ℹ️", "⚠️", "✅")):
            continue
        lines.append(stripped)
    if not lines:
        raise CliError("empty contract output")
    candidate = lines[-1]
    try:
        return json.loads(candidate)
    except json.JSONDecodeError:
        return candidate.strip('"')


def run_command(
    cmd: list[str],
    *,
    capture: bool = True,
    retries: int = 0,
    retry_delay_seconds: float = 3.0,
    timeout_seconds: float | None = None,
) -> str:
    last_error = "command failed"
    for attempt in range(retries + 1):
        try:
            completed = subprocess.run(
                cmd,
                check=False,
                text=True,
                capture_output=capture,
                timeout=timeout_seconds,
            )
        except subprocess.TimeoutExpired:
            last_error = f"command timed out after {timeout_seconds}s"
            if attempt >= retries:
                break
            time.sleep(retry_delay_seconds * (attempt + 1))
            continue
        if completed.returncode == 0:
            return completed.stdout if capture else ""
        last_error = completed.stderr.strip() or completed.stdout.strip() or "command failed"
        if attempt >= retries or not should_retry_error(last_error):
            break
        time.sleep(retry_delay_seconds * (attempt + 1))
    raise CliError(last_error)


def should_retry_error(message: str) -> bool:
    lower = message.lower()
    return any(
        marker in lower
        for marker in (
            "transaction submission timeout",
            "timed out",
            "service unavailable",
            "temporarily unavailable",
            "502 bad gateway",
            "503 service unavailable",
            "gateway timeout",
        )
    )


def stellar_base_cmd(config_dir: str | None) -> list[str]:
    cmd = ["stellar"]
    if config_dir:
        cmd.extend(["--config-dir", config_dir])
    return cmd


def soroban_base_cmd() -> list[str]:
    return ["soroban"]


def contract_invoke(
    *,
    contract_id: str,
    source_account: str,
    rpc_url: str,
    network_passphrase: str,
    function: str,
    args: dict[str, Any] | None = None,
    send: bool = False,
    config_dir: str | None = None,
) -> Any:
    if send:
        cmd = stellar_base_cmd(config_dir)
        cmd.extend(
            [
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
                function,
            ]
        )
    elif function in {"manager", "get_arkas", "count"}:
        cmd = soroban_base_cmd()
        cmd.extend(
            [
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
                "--",
                function,
            ]
        )
    else:
        cmd = stellar_base_cmd(config_dir)
        cmd.extend(
            [
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
                "--",
                function,
            ]
        )
    for key, value in (args or {}).items():
        cmd.extend([f"--{key}", normalize_arg(value)])
    stdout = run_command(cmd, retries=3 if send else 0, timeout_seconds=40 if send else 20)
    if send and not stdout.strip():
        return None
    return parse_contract_output(stdout)


def deploy_contract(
    *,
    wasm_path: str,
    source_account: str,
    rpc_url: str,
    network_passphrase: str,
    config_dir: str | None = None,
) -> str:
    cmd = stellar_base_cmd(config_dir)
    cmd.extend(
        [
            "contract",
            "deploy",
            "--wasm",
            wasm_path,
            "--source-account",
            source_account,
            "--rpc-url",
            rpc_url,
            "--network-passphrase",
            network_passphrase,
            "--ignore-checks",
        ]
    )
    return str(parse_contract_output(run_command(cmd, retries=3, timeout_seconds=40)))


def key_address(identity: str, *, config_dir: str | None = None) -> str:
    cmd = stellar_base_cmd(config_dir)
    cmd.extend(["keys", "address", identity])
    return run_command(cmd).strip()


def normalize_arg(value: Any) -> str:
    if isinstance(value, bool):
        return "true" if value else "false"
    if isinstance(value, (int, float)):
        return str(value)
    if isinstance(value, (list, dict)):
        return json.dumps(value, separators=(",", ":"))
    return str(value)


def load_json(path: Path) -> dict[str, Any]:
    return json.loads(path.read_text(encoding="utf-8"))


def save_json(path: Path, payload: dict[str, Any]) -> None:
    path.write_text(json.dumps(payload, indent=2) + "\n", encoding="utf-8")


def list_factory_arkas(
    *,
    factory_id: str,
    source_account: str,
    rpc_url: str,
    network_passphrase: str,
    page_size: int,
    config_dir: str | None,
) -> list[str]:
    arkas: list[str] = []
    offset = 0
    while True:
        page = contract_invoke(
            contract_id=factory_id,
            source_account=source_account,
            rpc_url=rpc_url,
            network_passphrase=network_passphrase,
            function="get_arkas",
            args={"offset": offset, "limit": page_size},
            config_dir=config_dir,
        )
        if not isinstance(page, list):
            raise CliError(f"unexpected get_arkas response: {page!r}")
        if not page:
            break
        arkas.extend(str(item) for item in page)
        if len(page) < page_size:
            break
        offset += page_size
    return dedupe_preserve(arkas)


def dedupe_preserve(values: list[str]) -> list[str]:
    seen: set[str] = set()
    out: list[str] = []
    for value in values:
        if value in seen:
            continue
        seen.add(value)
        out.append(value)
    return out


def fetch_manager(
    *,
    arka_id: str,
    source_account: str,
    rpc_url: str,
    network_passphrase: str,
    config_dir: str | None,
) -> str:
    manager = contract_invoke(
        contract_id=arka_id,
        source_account=source_account,
        rpc_url=rpc_url,
        network_passphrase=network_passphrase,
        function="manager",
        config_dir=config_dir,
    )
    return str(manager)


def try_copy_flags(
    *,
    source_registry_id: str | None,
    entries: list[ArkaEntry],
    source_account: str,
    rpc_url: str,
    network_passphrase: str,
    config_dir: str | None,
) -> tuple[list[ArkaEntry], bool]:
    if not source_registry_id:
        return entries, False
    try:
        curated_by_manager: dict[str, bool] = {}
        delisted_by_arka: dict[str, bool] = {}
        for entry in entries:
            if entry.manager not in curated_by_manager:
                curated_by_manager[entry.manager] = bool(
                    contract_invoke(
                        contract_id=source_registry_id,
                        source_account=source_account,
                        rpc_url=rpc_url,
                        network_passphrase=network_passphrase,
                        function="is_manager_curated",
                        args={"manager": entry.manager},
                        config_dir=config_dir,
                    )
                )
            delisted_by_arka[entry.arka] = bool(
                contract_invoke(
                    contract_id=source_registry_id,
                    source_account=source_account,
                    rpc_url=rpc_url,
                    network_passphrase=network_passphrase,
                    function="is_delisted",
                    args={"arka": entry.arka},
                    config_dir=config_dir,
                )
            )
        copied = [
            ArkaEntry(
                arka=entry.arka,
                manager=entry.manager,
                curated=curated_by_manager[entry.manager],
                delisted=delisted_by_arka[entry.arka],
            )
            for entry in entries
        ]
        return copied, True
    except CliError:
        return entries, False


def apply_manifest(entries: list[ArkaEntry], manifest_path: Path | None) -> list[ArkaEntry]:
    if manifest_path is None:
        return entries
    manifest = load_json(manifest_path)
    curated_managers = set(manifest.get("curatedManagers", []))
    delisted_arkas = set(manifest.get("delistedArkas", []))
    return [
        ArkaEntry(
            arka=entry.arka,
            manager=entry.manager,
            curated=entry.curated or entry.manager in curated_managers,
            delisted=entry.delisted or entry.arka in delisted_arkas,
        )
        for entry in entries
    ]


def group_active(entries: list[ArkaEntry]) -> dict[str, list[str]]:
    grouped: dict[str, list[str]] = {}
    for entry in entries:
        if entry.delisted:
            continue
        grouped.setdefault(entry.manager, []).append(entry.arka)
    return grouped


def registry_get_arkas(
    *,
    registry_id: str,
    source_account: str,
    rpc_url: str,
    network_passphrase: str,
    config_dir: str | None,
    manager: str | None = None,
    page_size: int = 100,
) -> list[str]:
    out: list[str] = []
    offset = 0
    fn_name = "get_arkas_by_manager" if manager else "get_arkas"
    while True:
        args: dict[str, Any] = {"offset": offset, "limit": page_size}
        if manager:
            args["manager"] = manager
        page = contract_invoke(
            contract_id=registry_id,
            source_account=source_account,
            rpc_url=rpc_url,
            network_passphrase=network_passphrase,
            function=fn_name,
            args=args,
            config_dir=config_dir,
        )
        if not isinstance(page, list):
            raise CliError(f"unexpected {fn_name} response: {page!r}")
        if not page:
            break
        out.extend(str(item) for item in page)
        if len(page) < page_size:
            break
        offset += page_size
    return dedupe_preserve(out)


def validate_registry(
    *,
    registry_id: str,
    source_account: str,
    rpc_url: str,
    network_passphrase: str,
    config_dir: str | None,
    entries: list[ArkaEntry],
) -> dict[str, Any]:
    active_entries = [entry for entry in entries if not entry.delisted]
    expected_active = [entry.arka for entry in active_entries]
    expected_by_manager = group_active(entries)
    count = int(
        contract_invoke(
            contract_id=registry_id,
            source_account=source_account,
            rpc_url=rpc_url,
            network_passphrase=network_passphrase,
            function="count",
            config_dir=config_dir,
        )
    )
    if count != len(expected_active):
        raise CliError(f"registry count mismatch: expected {len(expected_active)} got {count}")

    actual_arkas = registry_get_arkas(
        registry_id=registry_id,
        source_account=source_account,
        rpc_url=rpc_url,
        network_passphrase=network_passphrase,
        config_dir=config_dir,
    )
    if set(actual_arkas) != set(expected_active):
        raise CliError("registry active Arka set mismatch")

    for manager, expected in expected_by_manager.items():
        actual = registry_get_arkas(
            registry_id=registry_id,
            source_account=source_account,
            rpc_url=rpc_url,
            network_passphrase=network_passphrase,
            config_dir=config_dir,
            manager=manager,
        )
        if set(actual) != set(expected):
            raise CliError(f"registry manager listing mismatch for {manager}")

    curated_managers = sorted({entry.manager for entry in entries if entry.curated})
    delisted_arkas = sorted({entry.arka for entry in entries if entry.delisted})
    for manager in curated_managers:
        curated = bool(
            contract_invoke(
                contract_id=registry_id,
                source_account=source_account,
                rpc_url=rpc_url,
                network_passphrase=network_passphrase,
                function="is_manager_curated",
                args={"manager": manager},
                config_dir=config_dir,
            )
        )
        if not curated:
            raise CliError(f"curated manager missing on target registry: {manager}")
    for arka in delisted_arkas:
        delisted = bool(
            contract_invoke(
                contract_id=registry_id,
                source_account=source_account,
                rpc_url=rpc_url,
                network_passphrase=network_passphrase,
                function="is_delisted",
                args={"arka": arka},
                config_dir=config_dir,
            )
        )
        if not delisted:
            raise CliError(f"delisted arka missing on target registry: {arka}")

    return {
        "count": count,
        "activeArkas": sorted(actual_arkas),
        "activeManagers": sorted(expected_by_manager.keys()),
        "curatedManagers": curated_managers,
        "delistedArkas": delisted_arkas,
    }


def promote_deployments(
    *,
    deploy_json_path: Path,
    target_registry_id: str,
    previous_registry_id: str | None,
    report: dict[str, Any],
) -> None:
    deployments = load_json(deploy_json_path)
    contracts = deployments.setdefault("contracts", {})
    validations = deployments.setdefault("validations", {})
    legacy = deployments.setdefault("legacyContracts", {})
    if previous_registry_id and previous_registry_id != target_registry_id:
        legacy["arkaRegistry"] = previous_registry_id
    contracts["arkaRegistry"] = target_registry_id
    validations["canonicalRegistryMigration"] = report
    save_json(deploy_json_path, deployments)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Migrate or reconcile a canonical Arka registry.")
    parser.add_argument("--deploy-json", type=Path, default=ROOT_DIR / "deployments.testnet.json")
    parser.add_argument("--out-json", type=Path, default=ROOT_DIR / "tmp" / "canonical-registry-migration.json")
    parser.add_argument("--rpc-url", default=DEFAULT_RPC_URL)
    parser.add_argument("--network-passphrase", default=DEFAULT_NETWORK_PASSPHRASE)
    parser.add_argument("--admin-identity", default="arka-admin")
    parser.add_argument("--factory-id")
    parser.add_argument("--source-registry-id")
    parser.add_argument("--target-registry-id")
    parser.add_argument("--registry-wasm-path", type=Path, default=ROOT_DIR / "artifacts" / "arka-registry.wasm")
    parser.add_argument("--curation-manifest", type=Path)
    parser.add_argument("--page-size", type=int, default=50)
    parser.add_argument("--config-dir")
    parser.add_argument("--promote", action="store_true")
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    args.out_json.parent.mkdir(parents=True, exist_ok=True)

    deploy_json = load_json(args.deploy_json) if args.deploy_json.exists() else {}
    previous_registry_id = args.source_registry_id or deploy_json.get("contracts", {}).get("arkaRegistry")
    factory_id = args.factory_id or deploy_json.get("contracts", {}).get("arkaFactory")
    if not factory_id:
        raise SystemExit("Missing factory id. Provide --factory-id or deployments.testnet.json contracts.arkaFactory.")

    admin_addr = key_address(args.admin_identity, config_dir=args.config_dir)
    target_registry_id = args.target_registry_id
    deployed_new_registry = False
    if not target_registry_id:
        if not args.registry_wasm_path.exists():
            raise SystemExit(f"Missing registry wasm artifact: {args.registry_wasm_path}")
        target_registry_id = deploy_contract(
            wasm_path=str(args.registry_wasm_path),
            source_account=args.admin_identity,
            rpc_url=args.rpc_url,
            network_passphrase=args.network_passphrase,
            config_dir=args.config_dir,
        )
        deployed_new_registry = True

    # Safe to call repeatedly. Contract returns early once admin is set.
    contract_invoke(
        contract_id=target_registry_id,
        source_account=args.admin_identity,
        rpc_url=args.rpc_url,
        network_passphrase=args.network_passphrase,
        function="init_admin",
        args={"admin": admin_addr},
        send=True,
        config_dir=args.config_dir,
    )
    contract_invoke(
        contract_id=target_registry_id,
        source_account=args.admin_identity,
        rpc_url=args.rpc_url,
        network_passphrase=args.network_passphrase,
        function="set_registrar",
        args={"caller": admin_addr, "registrar": factory_id, "allowed": True},
        send=True,
        config_dir=args.config_dir,
    )

    arkas = list_factory_arkas(
        factory_id=factory_id,
        source_account=args.admin_identity,
        rpc_url=args.rpc_url,
        network_passphrase=args.network_passphrase,
        page_size=args.page_size,
        config_dir=args.config_dir,
    )
    entries = [
        ArkaEntry(
            arka=arka_id,
            manager=fetch_manager(
            arka_id=arka_id,
            source_account=args.admin_identity,
            rpc_url=args.rpc_url,
            network_passphrase=args.network_passphrase,
            config_dir=args.config_dir,
            ),
        )
        for arka_id in arkas
    ]
    entries, source_registry_reachable = try_copy_flags(
        source_registry_id=previous_registry_id,
        entries=entries,
        source_account=args.admin_identity,
        rpc_url=args.rpc_url,
        network_passphrase=args.network_passphrase,
        config_dir=args.config_dir,
    )
    entries = apply_manifest(entries, args.curation_manifest)

    for entry in entries:
        contract_invoke(
            contract_id=target_registry_id,
            source_account=args.admin_identity,
            rpc_url=args.rpc_url,
            network_passphrase=args.network_passphrase,
            function="register_admin",
            args={"caller": admin_addr, "manager": entry.manager, "arka": entry.arka},
            send=True,
            config_dir=args.config_dir,
        )

    for manager in sorted({entry.manager for entry in entries if entry.curated}):
        contract_invoke(
            contract_id=target_registry_id,
            source_account=args.admin_identity,
            rpc_url=args.rpc_url,
            network_passphrase=args.network_passphrase,
            function="set_manager_curated",
            args={"caller": admin_addr, "manager": manager, "curated": True},
            send=True,
            config_dir=args.config_dir,
        )
    for arka in sorted({entry.arka for entry in entries if entry.delisted}):
        contract_invoke(
            contract_id=target_registry_id,
            source_account=args.admin_identity,
            rpc_url=args.rpc_url,
            network_passphrase=args.network_passphrase,
            function="set_delisted",
            args={"caller": admin_addr, "arka": arka, "delisted": True},
            send=True,
            config_dir=args.config_dir,
        )

    validation = validate_registry(
        registry_id=target_registry_id,
        source_account=args.admin_identity,
        rpc_url=args.rpc_url,
        network_passphrase=args.network_passphrase,
        config_dir=args.config_dir,
        entries=entries,
    )

    report = {
        "validatedAt": subprocess.check_output(["date", "-u", "+%Y-%m-%dT%H:%M:%SZ"], text=True).strip(),
        "network": "local" if "Standalone Network" in args.network_passphrase else "testnet",
        "rpcUrl": args.rpc_url,
        "factoryId": factory_id,
        "sourceRegistryId": previous_registry_id,
        "sourceRegistryReachable": source_registry_reachable,
        "targetRegistryId": target_registry_id,
        "deployedNewRegistry": deployed_new_registry,
        "copiedCuratedManagers": len(validation["curatedManagers"]),
        "copiedDelistedArkas": len(validation["delistedArkas"]),
        "totalArkas": len(entries),
        "activeArkas": validation["count"],
        "totalManagers": len({entry.manager for entry in entries}),
        "validation": validation,
    }
    args.out_json.write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")

    if args.promote and args.deploy_json:
        promote_deployments(
            deploy_json_path=args.deploy_json,
            target_registry_id=target_registry_id,
            previous_registry_id=previous_registry_id,
            report=report,
        )

    print(json.dumps(report, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
