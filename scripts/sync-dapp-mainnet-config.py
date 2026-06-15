#!/usr/bin/env python3
"""Sync Arka contract mainnet manifest into the dApp runtime config.

This script is intentionally postdeploy-only by default: it refuses to write a
frontend mainnet config until the deployment manifest contains real contract IDs.
"""

from __future__ import annotations

import argparse
import json
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


ROOT_DIR = Path(__file__).resolve().parents[1]
DEFAULT_MANIFEST = ROOT_DIR / "deployments.mainnet.json"
DEFAULT_OUTPUT = ROOT_DIR.parent / "arkafund-dapp" / "config" / "deployments.mainnet.json"


def contract_id(value: Any) -> bool:
    return isinstance(value, str) and value.startswith("C") and len(value) == 56


def build_dapp_config(manifest: dict[str, Any], *, allow_predeploy: bool) -> dict[str, Any]:
    contracts = manifest.get("contracts", {})
    deploy_entries = [
        entry for entry in manifest.get("deploymentPlan", {}).get("contracts", []) if entry.get("deploy") is True
    ]
    missing = [entry["name"] for entry in deploy_entries if not contract_id(contracts.get(entry["name"]))]
    if missing and not allow_predeploy:
        raise SystemExit(
            "Refusing to sync dApp mainnet config before deployed contract IDs exist: "
            + ", ".join(sorted(missing))
        )

    oracle = manifest.get("oracle", {})
    contract_ids = manifest.get("assets", {}).get("contractIds", {})
    now = datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")
    oracle_guard = contracts.get("oracleGuard") if contract_id(contracts.get("oracleGuard")) else None
    venue_registry = contracts.get("venueRegistry") if contract_id(contracts.get("venueRegistry")) else None
    execution_venues = manifest.get("executionVenues", {})
    source_validations = manifest.get("validations", {})
    mainnet_release_gate = manifest.get("validations", {}).get("mainnetReleaseGate", {})
    canary_validated_at = (
        mainnet_release_gate.get("validatedAt")
        if isinstance(mainnet_release_gate, dict) and isinstance(mainnet_release_gate.get("validatedAt"), str)
        else now
    )
    oracle_providers = {
        "provider": "Reflector Network",
        "primary": "Reflector DEX Oracle",
        "secondary": "Reflector External CEX/DEX Oracle",
        "fiat": "Reflector Fiat Oracle",
    }
    oracle_thresholds = {
        **(oracle.get("defaultPolicy", {}) if isinstance(oracle.get("defaultPolicy"), dict) else {}),
        "minProviderCount": 2,
    }
    routing_canary_cases = []
    for venue_key, venue_name in [
        ("soroswap", "SOROSWAP"),
        ("aquarius", "AQUARIUS"),
        ("phoenix", "PHOENIX"),
    ]:
        venue = execution_venues.get(venue_key, {}) if isinstance(execution_venues, dict) else {}
        canary = venue.get("mainnetCanary", {}) if isinstance(venue, dict) else {}
        if not isinstance(canary, dict):
            continue
        tx = canary.get("tx")
        routing_canary_cases.append(
            {
                "id": f"{venue_key}-usdc-xlm-mainnet",
                "venue": venue_name,
                "tokenIn": canary.get("assetIn", "USDC"),
                "tokenOut": canary.get("assetOut", "XLM"),
                "amountBase": canary.get("amountIn"),
                "quoteOutBase": canary.get("amountOut"),
                "selectedPath": [canary.get("assetIn", "USDC"), venue_name, canary.get("assetOut", "XLM")],
                "candidateUniverseSize": 1,
                "quotedPathCount": 1,
                "minEfficiencyBps": 0,
                "plannerEfficiencyBps": None,
                "passed": canary.get("amountOut") is not None and venue.get("mainnetCanaryPassed") is True,
                "evidence": {
                    "mode": "live_mainnet_execution",
                    "collectedAt": canary_validated_at,
                    "source": f"mainnet-{venue_key}-swap:{tx}" if isinstance(tx, str) else f"mainnet-{venue_key}-swap",
                    "liveMainnet": True,
                },
            }
        )
    routing_canary = {
        "network": "mainnet",
        "validatedAt": canary_validated_at,
        "maxAgeHours": 24,
        "evidenceMode": "live_mainnet_execution",
        "requiredVenues": ["SOROSWAP", "AQUARIUS", "PHOENIX"],
        "cases": routing_canary_cases,
    }

    return {
        "network": "mainnet",
        "networkPassphrase": manifest["networkPassphrase"],
        "rpcUrl": manifest["rpcUrl"],
        "source": "arkafund-mainnet-manifest",
        "generatedAt": now,
        "contracts": contracts,
        "assets": {
            "displayCurrency": manifest.get("assets", {}).get("displayCurrency", "USD"),
            "pricingDenomination": manifest.get("assets", {}).get("pricingDenomination", "USDC"),
            "contractIds": contract_ids,
            "admittedSymbols": manifest.get("assets", {}).get("admittedSymbols", []),
            "tokens": manifest.get("assets", {}).get("tokens", []),
        },
        "oracle": {
            **oracle,
            "oracleGuard": oracle_guard,
        },
        "launchPolicy": manifest.get("launchPolicy", {}),
        "executionVenues": manifest.get("executionVenues", {}),
        "validations": {
            "mainnetManifest": {
                "status": manifest.get("status"),
                "contractsDeployed": manifest.get("validations", {}).get("contractsDeployed") is True,
                "contractsConfigured": manifest.get("validations", {}).get("contractsConfigured") is True,
                "storageLifecycleDryRun": manifest.get("validations", {}).get("storageLifecycleDryRun") is True,
                "releaseGate": manifest.get("validations", {}).get("releaseGate") is True,
            },
            "oracleGuard": {
                "validatedAt": now,
                "network": "mainnet",
                "rpcUrl": manifest["rpcUrl"],
                "mode": "oracle_guard",
                "provider": "Reflector Network",
                "providers": oracle_providers,
                "contracts": {
                    "oracleGuard": oracle_guard,
                    "primaryOracle": oracle.get("primaryProvider"),
                    "secondaryOracle": oracle.get("secondaryProvider"),
                    "fiatOracle": oracle.get("fiatProvider"),
                    "validationAsset": contract_ids.get("XLM"),
                },
                "thresholds": oracle_thresholds,
                "providerAssetOverrides": oracle.get("providerAssetOverrides", {}),
                "status": "ready" if oracle_guard else "blocked_until_arkafund_oracle_guard_mainnet_deploy",
            },
            "routingCanary": routing_canary,
            "globalVenuePolicy": {
                "validatedAt": now,
                "network": "mainnet",
                "contracts": {
                    "venueRegistry": venue_registry,
                    "router": contracts.get("router") if contract_id(contracts.get("router")) else None,
                    "adapterSoroswap": contracts.get("adapterSoroswap")
                    if contract_id(contracts.get("adapterSoroswap"))
                    else None,
                    "adapterAquarius": contracts.get("adapterAquarius")
                    if contract_id(contracts.get("adapterAquarius"))
                    else None,
                    "adapterPhoenix": contracts.get("adapterPhoenix")
                    if contract_id(contracts.get("adapterPhoenix"))
                    else None,
                    "adapterBlendFixedXlmUsdc": contracts.get("adapterBlendFixedXlmUsdc")
                    if contract_id(contracts.get("adapterBlendFixedXlmUsdc"))
                    else None,
                    "adapterBlendYieldBlox": contracts.get("adapterBlendYieldBlox")
                    if contract_id(contracts.get("adapterBlendYieldBlox"))
                    else None,
                },
                "factoryDefaults": {
                    "venueRegistry": venue_registry,
                    "swapOracle": oracle_guard,
                    "swapRiskPolicy": {
                        "enabled": True,
                        "oracleChecksEnabled": True,
                        "maxPriceImpactBps": 300,
                        "maxSlippageBps": 300,
                        "maxTwapDeviationBps": 350,
                        "maxOracleAgeSeconds": 900,
                        "maxTradeSizeBps": 2500,
                    },
                },
                "status": "ready" if venue_registry else "blocked_until_venue_registry_mainnet_deploy",
            },
            **(
                {"balancedReadiness": source_validations["balancedReadiness"]}
                if isinstance(source_validations.get("balancedReadiness"), dict)
                else {}
            ),
            **(
                {"balancedOfficialSurface": source_validations["balancedOfficialSurface"]}
                if isinstance(source_validations.get("balancedOfficialSurface"), dict)
                else {}
            ),
        },
        "validatedModules": {
            "oracleSafety": {
                "network": "mainnet",
                "rpcUrl": manifest["rpcUrl"],
                "validatedAt": now,
                "provider": "Reflector Network",
                "providers": oracle_providers,
                "contracts": {
                    "oracleGuard": oracle_guard,
                    "primaryOracle": oracle.get("primaryProvider"),
                    "secondaryOracle": oracle.get("secondaryProvider"),
                    "fiatOracle": oracle.get("fiatProvider"),
                    "validationAsset": contract_ids.get("XLM"),
                },
                "thresholds": oracle_thresholds,
                "providerAssetOverrides": oracle.get("providerAssetOverrides", {}),
                "checks": {
                    "providerContractFamily": "reflector-mainnet-sep40",
                    "releaseState": "ready" if oracle_guard else "blocked_until_oracle_guard_mainnet_deploy",
                },
            },
            "globalVenuePolicy": {
                "network": "mainnet",
                "validatedAt": now,
                "contracts": {
                    "venueRegistry": venue_registry,
                    "router": contracts.get("router") if contract_id(contracts.get("router")) else None,
                },
                "checks": {
                    "globalVenueKillSwitch": "ready"
                    if venue_registry
                    else "blocked_until_venue_registry_mainnet_deploy",
                    "newArkaFactoryDefaults": "ready"
                    if venue_registry and oracle_guard
                    else "blocked_until_factory_default_policy_config",
                },
            },
            "balancedExecution": manifest.get("executionVenues", {}).get("balancedSodax"),
            "routingCanary": routing_canary,
        },
    }


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--manifest", type=Path, default=DEFAULT_MANIFEST)
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT)
    parser.add_argument("--allow-predeploy", action="store_true")
    args = parser.parse_args()

    manifest = json.loads(args.manifest.read_text())
    if manifest.get("network") != "mainnet":
        raise SystemExit("manifest is not mainnet")

    config = build_dapp_config(manifest, allow_predeploy=args.allow_predeploy)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(config, indent=2, sort_keys=False) + "\n")
    print(f"wrote {args.output}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
