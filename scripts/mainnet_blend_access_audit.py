#!/usr/bin/env python3
"""Read the Mainnet Arka registry and report effective Blend market access.

The audit submits no transaction. It verifies that an Arka only gains access to
a Blend market when its own on-chain policy explicitly references an adapter,
and records the global venue status for every adapter that is in use.
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
BLEND_PROTOCOL = "Blend"
PAGE_SIZE = 50


def iso_now() -> str:
    return dt.datetime.now(dt.UTC).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def load_manifest(path: Path) -> dict[str, Any]:
    document = json.loads(path.read_text())
    if not isinstance(document, dict) or document.get("network") != "mainnet":
        raise ValueError("audit only accepts a Mainnet deployment manifest")
    return document


def parse_stellar_value(output: str) -> Any:
    lines = [line.strip() for line in output.splitlines() if line.strip() and not line.startswith("ℹ️")]
    if not lines:
        raise ValueError("stellar CLI returned no contract value")
    return json.loads(lines[-1])


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
        return {"ok": False, "error": result.stderr.strip() or result.stdout.strip() or "stellar CLI failed"}
    try:
        return {"ok": True, "value": parse_stellar_value(result.stdout)}
    except (ValueError, json.JSONDecodeError) as error:
        return {"ok": False, "error": str(error)}


def read_arkas(
    manifest: dict[str, Any],
    reader: Callable[[dict[str, Any], str, str, list[str]], dict[str, Any]],
) -> list[str]:
    registry = str(manifest["contracts"]["arkaRegistry"])
    count_result = reader(manifest, registry, "count", [])
    if not count_result.get("ok") or not isinstance(count_result.get("value"), int):
        raise ValueError("could not read the Mainnet Arka registry count")
    total = count_result["value"]
    arkas: list[str] = []
    offset = 0
    while offset < total:
        page = reader(
            manifest,
            registry,
            "get_arkas",
            ["--offset", str(offset), "--limit", str(min(PAGE_SIZE, total - offset))],
        )
        if not page.get("ok") or not isinstance(page.get("value"), list):
            raise ValueError("could not read the Mainnet Arka registry entries")
        entries = page["value"]
        if not entries or not all(isinstance(arka, str) for arka in entries):
            raise ValueError("Mainnet Arka registry pagination returned an invalid page")
        arkas.extend(entries)
        offset += len(entries)
    if len(arkas) != total:
        raise ValueError("Mainnet Arka registry count and entries do not agree")
    return arkas


def normalize_blend_configs(value: Any) -> list[dict[str, Any]]:
    if not isinstance(value, list):
        raise ValueError("credit_market_configs did not return a list")
    configs: list[dict[str, Any]] = []
    for entry in value:
        if not isinstance(entry, dict) or entry.get("protocol") != BLEND_PROTOCOL:
            raise ValueError("credit_market_configs returned an invalid Blend entry")
        adapter = entry.get("adapter")
        market_id = entry.get("market_id")
        if not isinstance(adapter, str) or not isinstance(market_id, str):
            raise ValueError("Blend market entry is missing adapter or market id")
        configs.append(
            {
                "marketId": market_id,
                "adapter": adapter,
                "enabled": entry.get("enabled") is True,
                "actions": {
                    "supply": entry.get("allow_supply") is True,
                    "withdraw": entry.get("allow_withdraw") is True,
                    "borrow": entry.get("allow_borrow") is True,
                    "repay": entry.get("allow_repay") is True,
                },
            }
        )
    return configs


def venue_status(value: Any) -> int | None:
    if not isinstance(value, dict):
        return None
    status = value.get("status")
    return status if isinstance(status, int) else None


def build_report(
    manifest: dict[str, Any],
    reader: Callable[[dict[str, Any], str, str, list[str]], dict[str, Any]] = invoke_read,
) -> dict[str, Any]:
    registry = str(manifest["contracts"]["arkaRegistry"])
    venue_registry = str(manifest["contracts"]["venueRegistry"])
    arkas = read_arkas(manifest, reader)
    findings: list[str] = []
    records: list[dict[str, Any]] = []
    adapter_statuses: dict[str, int | None] = {}

    for arka in arkas:
        manager = reader(manifest, arka, "manager", [])
        arka_venue_registry = reader(manifest, arka, "venue_registry", [])
        markets = reader(manifest, arka, "credit_market_configs", ["--protocol", BLEND_PROTOCOL])
        if not manager.get("ok") or not isinstance(manager.get("value"), str):
            findings.append(f"{arka}: manager could not be read")
            continue
        if not arka_venue_registry.get("ok") or arka_venue_registry.get("value") != venue_registry:
            findings.append(f"{arka}: does not reference the canonical venue registry")
            continue
        if not markets.get("ok"):
            findings.append(f"{arka}: Blend market configuration could not be read")
            continue
        try:
            configurations = normalize_blend_configs(markets["value"])
        except ValueError as error:
            findings.append(f"{arka}: {error}")
            continue
        for configuration in configurations:
            adapter = configuration["adapter"]
            if adapter not in adapter_statuses:
                config = reader(manifest, venue_registry, "venue_config", ["--venue", adapter])
                adapter_statuses[adapter] = venue_status(config.get("value")) if config.get("ok") else None
            configuration["globalVenueStatus"] = adapter_statuses[adapter]
            if configuration["globalVenueStatus"] is None:
                findings.append(f"{arka}: adapter {adapter} is absent from the global venue registry")
        records.append({"arka": arka, "manager": manager["value"], "blendMarkets": configurations})

    return {
        "kind": "mainnet_blend_access_audit",
        "network": "mainnet",
        "validatedAt": iso_now(),
        "registry": registry,
        "venueRegistry": venue_registry,
        "status": "passed" if not findings else "review_required",
        "summary": {
            "registeredArkas": len(arkas),
            "arkasWithBlend": sum(1 for record in records if record["blendMarkets"]),
            "arkasWithBorrow": sum(
                1
                for record in records
                if any(market["actions"]["borrow"] for market in record["blendMarkets"])
            ),
        },
        "arkas": records,
        "adapterStatuses": adapter_statuses,
        "findings": findings,
        "promotionRule": (
            "A Blend market is usable only when the Arka explicitly configures its adapter and actions, "
            "and the shared adapter remains allowed by the global venue registry. Existing Arkas are never "
            "granted a new market automatically."
        ),
    }


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--manifest", type=Path, default=ROOT_DIR / "deployments.mainnet.json")
    parser.add_argument("--report", type=Path, default=ROOT_DIR / "tmp/mainnet-blend-access-audit.json")
    args = parser.parse_args()
    try:
        report = build_report(load_manifest(args.manifest))
    except (OSError, ValueError, json.JSONDecodeError, KeyError) as error:
        print(f"Mainnet Blend access audit failed: {error}", file=sys.stderr)
        return 1
    args.report.parent.mkdir(parents=True, exist_ok=True)
    args.report.write_text(json.dumps(report, indent=2) + "\n")
    print(f"Mainnet Blend access audit {report['status']}; report: {args.report}")
    for finding in report["findings"]:
        print(f"- {finding}")
    return 0 if report["status"] == "passed" else 1


if __name__ == "__main__":
    sys.exit(main())
