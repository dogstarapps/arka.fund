#!/usr/bin/env python3
"""Read-only preflight for a governed Blend V2 borrowing activation.

This check does not sign or submit a transaction. It verifies that the official
Blend V2 factory recognises the proposed Fixed pool and that the pool exposes
the configuration and reserve reads Arka uses for credit risk controls.
"""

from __future__ import annotations

import argparse
import datetime as dt
import json
import subprocess
import sys
from pathlib import Path
from typing import Any, Callable


ROOT_DIR = Path(__file__).resolve().parents[1]
BLEND_V2_FACTORY = "CDSYOAVXFY7SM5S64IZPPPYB4GVGGLMQVFREPSQQEZVIWXX5R23G4QSU"
BLEND_V2_FIXED_POOL = "CAJJZSGMMM3PD7N33TAPHGBUGTB43OC73HVIK2L2G6BNGGGYOSSYBXBD"


def iso_now() -> str:
    return dt.datetime.now(dt.UTC).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def load_manifest(path: Path) -> dict[str, Any]:
    data = json.loads(path.read_text())
    if not isinstance(data, dict):
        raise ValueError("manifest must be a JSON object")
    return data


def parse_stellar_value(output: str) -> Any:
    lines = [line.strip() for line in output.splitlines() if line.strip() and not line.startswith("ℹ️")]
    if not lines:
        raise ValueError("stellar CLI returned no contract value")
    try:
        return json.loads(lines[-1])
    except json.JSONDecodeError:
        return lines[-1]


def invoke_read(
    manifest: dict[str, Any],
    contract: str,
    method: str,
    arguments: list[str],
    runner: Callable[..., subprocess.CompletedProcess[str]] = subprocess.run,
) -> dict[str, Any]:
    command = [
        "stellar",
        "contract",
        "invoke",
        "--id",
        contract,
        "--rpc-url",
        str(manifest["rpcUrl"]),
        "--network-passphrase",
        str(manifest["networkPassphrase"]),
        "--source-account",
        str(manifest["admin"]["publicKey"]),
        "--",
        method,
        *arguments,
    ]
    result = runner(command, text=True, capture_output=True, check=False)
    if result.returncode != 0:
        return {
            "ok": False,
            "error": result.stderr.strip() or result.stdout.strip() or "unknown stellar CLI error",
        }
    try:
        return {"ok": True, "value": parse_stellar_value(result.stdout)}
    except ValueError as error:
        return {"ok": False, "error": str(error)}


def read_reserve_list_contains(result: dict[str, Any], asset: str) -> bool:
    if not result.get("ok"):
        return False
    value = result.get("value")
    if isinstance(value, list):
        return asset in value
    return False


def pool_status(result: dict[str, Any]) -> int | None:
    if not result.get("ok") or not isinstance(result.get("value"), dict):
        return None
    status = result["value"].get("status")
    try:
        return int(status)
    except (TypeError, ValueError):
        return None


def inspect_mainnet(
    manifest: dict[str, Any],
    reader: Callable[[dict[str, Any], str, str, list[str]], dict[str, Any]] = invoke_read,
) -> dict[str, Any]:
    assets = manifest.get("assets", {}).get("contractIds", {})
    xlm = assets.get("XLM")
    usdc = assets.get("USDC")
    if not isinstance(xlm, str) or not isinstance(usdc, str):
        raise ValueError("manifest must define XLM and USDC contract ids")
    return {
        "factory": BLEND_V2_FACTORY,
        "pool": BLEND_V2_FIXED_POOL,
        "assets": {"XLM": xlm, "USDC": usdc},
        "factoryPoolCheck": reader(
            manifest,
            BLEND_V2_FACTORY,
            "is_pool",
            ["--pool-address", BLEND_V2_FIXED_POOL],
        ),
        "poolConfig": reader(manifest, BLEND_V2_FIXED_POOL, "get_config", []),
        "reserveList": reader(manifest, BLEND_V2_FIXED_POOL, "get_reserve_list", []),
        "xlmReserve": reader(manifest, BLEND_V2_FIXED_POOL, "get_reserve", ["--asset", xlm]),
        "usdcReserve": reader(manifest, BLEND_V2_FIXED_POOL, "get_reserve", ["--asset", usdc]),
    }


def build_report(manifest: dict[str, Any], facts: dict[str, Any]) -> dict[str, Any]:
    blockers: list[str] = []
    if facts["factoryPoolCheck"].get("value") is not True:
        blockers.append("the Blend V2 factory does not recognise the proposed pool")
    status = pool_status(facts["poolConfig"])
    if status is None:
        blockers.append("the Blend V2 pool configuration is unavailable")
    elif status > 1:
        blockers.append("the Blend V2 pool is not active for new borrowing")
    if not read_reserve_list_contains(facts["reserveList"], facts["assets"]["XLM"]):
        blockers.append("the Blend V2 pool does not list XLM as a reserve")
    if not read_reserve_list_contains(facts["reserveList"], facts["assets"]["USDC"]):
        blockers.append("the Blend V2 pool does not list USDC as a reserve")
    if not facts["xlmReserve"].get("ok"):
        blockers.append("the Blend V2 XLM reserve cannot be read")
    if not facts["usdcReserve"].get("ok"):
        blockers.append("the Blend V2 USDC reserve cannot be read")

    return {
        "kind": "mainnet_blend_v2_borrow_preflight",
        "network": manifest.get("network"),
        "validatedAt": iso_now(),
        "status": "candidate_verified" if not blockers else "blocked",
        "scope": {
            "protocol": "Blend V2",
            "pool": "Fixed XLM-USDC",
            "assets": ["XLM", "USDC"],
        },
        "facts": facts,
        "blockers": blockers,
        "requiredBeforeActivation": [
            "Deploy a dedicated Blend V2 adapter and bind it to a new governed Blend market without changing the existing V1 market.",
            "Set the Blend V2 factory source, external diagnostics, per-asset borrowing limits and enabled market capabilities through governance.",
            "Create a separate capped Arka canary and verify supply, borrow, repay, withdrawal, debt readback and health checks.",
            "Verify that disabling the Blend adapter blocks new borrowing and that repayment remains available only under the governed policy.",
        ],
    }


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--manifest", type=Path, default=ROOT_DIR / "deployments.mainnet.json")
    parser.add_argument("--report", type=Path, default=ROOT_DIR / "tmp/mainnet-blend-v2-borrow-readiness.json")
    args = parser.parse_args()

    try:
        manifest = load_manifest(args.manifest)
        if manifest.get("network") != "mainnet":
            raise ValueError("preflight only accepts a mainnet manifest")
        report = build_report(manifest, inspect_mainnet(manifest))
    except (OSError, RuntimeError, ValueError, json.JSONDecodeError, KeyError) as error:
        print(f"Blend V2 borrow preflight failed: {error}", file=sys.stderr)
        return 1

    args.report.parent.mkdir(parents=True, exist_ok=True)
    args.report.write_text(json.dumps(report, indent=2) + "\n")
    print(f"Blend V2 borrow preflight {report['status']}; report: {args.report}")
    for blocker in report["blockers"]:
        print(f"- {blocker}")
    return 0 if report["status"] == "candidate_verified" else 1


if __name__ == "__main__":
    sys.exit(main())
