#!/usr/bin/env python3
"""Validate Arka's mainnet launch evidence and optionally mark the manifest ready.

The gate checks production contracts, a real Arka canary, manual AMM venue
canaries, the global venue kill-switch, and any venue admitted to AUTO. Balanced
/ SODAX is allowed in AUTO only when the manifest points to production canary
evidence that proves the full intent lifecycle.
"""

from __future__ import annotations

import argparse
import datetime as dt
import json
import re
import sys
from pathlib import Path
from typing import Any


CONTRACT_ID_RE = re.compile(r"^C[A-Z2-7]{55}$")
ACCOUNT_RE = re.compile(r"^G[A-Z2-7]{55}$")
HASH_RE = re.compile(r"^[0-9a-fA-F]{64}$")
EVM_HASH_RE = re.compile(r"^0x[0-9a-fA-F]{64}$")
REQUIRED_MANUAL_SWAP_VENUES = ("phoenix", "soroswap", "aquarius")
BALANCED_DRIVER_FIELDS = (
    "quote",
    "build",
    "relay",
    "submit",
    "status",
    "receipt",
    "refund",
    "expiry",
    "walletBacked",
    "productionCanary",
)


def iso_now() -> str:
    return dt.datetime.now(dt.UTC).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def load_json(path: Path) -> dict[str, Any]:
    try:
        data = json.loads(path.read_text())
    except FileNotFoundError:
        raise SystemExit(f"missing required evidence file: {path}") from None
    if not isinstance(data, dict):
        raise SystemExit(f"expected object JSON in {path}")
    return data


def write_json(path: Path, data: dict[str, Any]) -> None:
    path.write_text(json.dumps(data, indent=2, sort_keys=False) + "\n")


def contract_id(value: Any) -> bool:
    return isinstance(value, str) and CONTRACT_ID_RE.match(value) is not None


def account(value: Any) -> bool:
    return isinstance(value, str) and ACCOUNT_RE.match(value) is not None


def hash_value(value: Any) -> bool:
    return isinstance(value, str) and HASH_RE.match(value) is not None


def evm_hash(value: Any) -> bool:
    return isinstance(value, str) and EVM_HASH_RE.match(value) is not None


def add(errors: list[str], path: str, detail: str) -> None:
    errors.append(f"{path}: {detail}")


def tx(value: Any) -> bool:
    return isinstance(value, str) and len(value) == 64 and all(ch in "0123456789abcdefABCDEF" for ch in value)


def positive_int_string(value: Any) -> bool:
    try:
        return int(value) > 0
    except (TypeError, ValueError):
        return False


def evidence_path(manifest_dir: Path, value: Any) -> Path | None:
    if not isinstance(value, str) or not value:
        return None
    path = Path(value)
    if path.is_absolute():
        return path
    return manifest_dir / path


def require_mainnet_basics(manifest: dict[str, Any], errors: list[str]) -> None:
    if manifest.get("network") != "mainnet":
        add(errors, "network", "must be mainnet")
    if manifest.get("networkPassphrase") != "Public Global Stellar Network ; September 2015":
        add(errors, "networkPassphrase", "must be Stellar public network")

    admin = manifest.get("admin", {})
    if not account(admin.get("publicKey")):
        add(errors, "admin.publicKey", "invalid admin account")
    if admin.get("plannedBootstrapWindowDays") != 365:
        add(errors, "admin.plannedBootstrapWindowDays", "must stay at 365")
    if admin.get("handoffTarget") != "dao_governor":
        add(errors, "admin.handoffTarget", "must target DAO governor")

    validations = manifest.get("validations", {})
    for flag in ("artifactBuild", "contractsDeployed", "contractsConfigured", "storageLifecycleDryRun"):
        if validations.get(flag) is not True:
            add(errors, f"validations.{flag}", "must be true")

    contracts = manifest.get("contracts", {})
    wasm_hashes = manifest.get("wasmHashes", {})
    for entry in manifest.get("deploymentPlan", {}).get("contracts", []):
        if not isinstance(entry, dict) or entry.get("deploy") is not True:
            continue
        name = entry.get("name")
        if not contract_id(contracts.get(name)):
            add(errors, f"contracts.{name}", "missing deployed contract id")
        if not hash_value(wasm_hashes.get(name)):
            add(errors, f"wasmHashes.{name}", "missing deployed wasm hash")


def require_canary_create(
    manifest: dict[str, Any], create_evidence: dict[str, Any], errors: list[str]
) -> tuple[str | None, str | None]:
    if create_evidence.get("network") != "mainnet":
        add(errors, "createEvidence.network", "must be mainnet")
    if create_evidence.get("status") != "passed":
        add(errors, "createEvidence.status", "must be passed")
    if create_evidence.get("admin") != manifest.get("admin", {}).get("publicKey"):
        add(errors, "createEvidence.admin", "must match manifest admin")

    arka = create_evidence.get("arka")
    share_token = create_evidence.get("shareToken")
    if not contract_id(arka):
        add(errors, "createEvidence.arka", "invalid canary Arka id")
    if not contract_id(share_token):
        add(errors, "createEvidence.shareToken", "invalid canary share token id")

    configured = create_evidence.get("configuredContracts", {})
    expected_contracts = {
        "factory": "arkaFactory",
        "router": "router",
        "venueRegistry": "venueRegistry",
        "swapOracle": "oracleGuard",
    }
    for evidence_key, manifest_key in expected_contracts.items():
        if configured.get(evidence_key) != manifest.get("contracts", {}).get(manifest_key):
            add(errors, f"createEvidence.configuredContracts.{evidence_key}", "must match manifest contract")

    transactions = create_evidence.get("transactions", {})
    for field in (
        "creationFeeApproval",
        "createAndInit",
        "depositRoundTripApproval",
        "depositRoundTrip",
        "redeemRoundTrip",
        "finalSeedApproval",
        "finalSeedDeposit",
    ):
        if not tx(transactions.get(field)):
            add(errors, f"createEvidence.transactions.{field}", "missing transaction hash")

    final_state = create_evidence.get("finalState", {})
    if not positive_int_string(final_state.get("liquidUsdcBaseUnits")):
        add(errors, "createEvidence.finalState.liquidUsdcBaseUnits", "must keep seeded USDC")
    if not positive_int_string(final_state.get("sharesOfAdmin")):
        add(errors, "createEvidence.finalState.sharesOfAdmin", "must mint shares")

    return arka if isinstance(arka, str) else None, share_token if isinstance(share_token, str) else None


def require_routing_canary(
    manifest: dict[str, Any],
    routing_evidence: dict[str, Any],
    canary_arka: str | None,
    errors: list[str],
    *,
    manifest_dir: Path,
) -> None:
    if routing_evidence.get("network") != "mainnet":
        add(errors, "routingEvidence.network", "must be mainnet")
    if routing_evidence.get("status") != "passed_manual_execution":
        add(errors, "routingEvidence.status", "must be passed_manual_execution")
    if routing_evidence.get("admin") != manifest.get("admin", {}).get("publicKey"):
        add(errors, "routingEvidence.admin", "must match manifest admin")
    if canary_arka and routing_evidence.get("arka") != canary_arka:
        add(errors, "routingEvidence.arka", "must match create/deposit/redeem canary")

    oracle = routing_evidence.get("oracleGuard", {})
    if oracle.get("contract") != manifest.get("contracts", {}).get("oracleGuard"):
        add(errors, "routingEvidence.oracleGuard.contract", "must match manifest oracle guard")
    if oracle.get("wasmHash") != manifest.get("wasmHashes", {}).get("oracleGuard"):
        add(errors, "routingEvidence.oracleGuard.wasmHash", "must match manifest oracle wasm hash")
    if not tx(oracle.get("uploadTx")):
        add(errors, "routingEvidence.oracleGuard.uploadTx", "missing upload tx")
    if not tx(oracle.get("upgradeTx")):
        add(errors, "routingEvidence.oracleGuard.upgradeTx", "missing upgrade tx")

    policy = routing_evidence.get("canaryPolicyUpdate", {}).get("swapRiskPolicy", {})
    if policy.get("enabled") is not True or policy.get("oracleChecksEnabled") is not True:
        add(errors, "routingEvidence.canaryPolicyUpdate.swapRiskPolicy", "risk policy must be enabled")
    if policy.get("maxOracleAgeSeconds") != 900:
        add(errors, "routingEvidence.canaryPolicyUpdate.swapRiskPolicy.maxOracleAgeSeconds", "must be 900")
    if routing_evidence.get("factoryPolicyUpdate", {}).get("maxOracleAgeSeconds") != 900:
        add(errors, "routingEvidence.factoryPolicyUpdate.maxOracleAgeSeconds", "factory default must be 900")

    manifest_venues = manifest.get("executionVenues", {})
    venue_canaries = routing_evidence.get("venueCanaries", {})
    for venue in REQUIRED_MANUAL_SWAP_VENUES:
        evidence = venue_canaries.get(venue, {})
        config = manifest_venues.get(venue, {})
        if evidence.get("status") != "passed":
            add(errors, f"routingEvidence.venueCanaries.{venue}.status", "must be passed")
        if not tx(evidence.get("tx")):
            add(errors, f"routingEvidence.venueCanaries.{venue}.tx", "missing swap tx")
        if not positive_int_string(evidence.get("amountIn")):
            add(errors, f"routingEvidence.venueCanaries.{venue}.amountIn", "must be positive")
        if not positive_int_string(evidence.get("amountOut")):
            add(errors, f"routingEvidence.venueCanaries.{venue}.amountOut", "must be positive")
        if config.get("mainnetCanaryPassed") is not True:
            add(errors, f"executionVenues.{venue}.mainnetCanaryPassed", "must be true")
        manifest_tx = config.get("mainnetCanary", {}).get("tx")
        if manifest_tx != evidence.get("tx"):
            add(errors, f"executionVenues.{venue}.mainnetCanary.tx", "must match routing evidence")
        if config.get("autoEnabled") is True:
            add(errors, f"executionVenues.{venue}.autoEnabled", "manual launch gate requires AUTO disabled")

    kill_switch = routing_evidence.get("killSwitchCanary", {})
    if kill_switch.get("venue") not in REQUIRED_MANUAL_SWAP_VENUES:
        add(errors, "routingEvidence.killSwitchCanary.venue", "unexpected venue")
    if not tx(kill_switch.get("disableTx")) or not tx(kill_switch.get("reenableTx")):
        add(errors, "routingEvidence.killSwitchCanary", "missing disable/reenable tx")
    blocked = kill_switch.get("blockedSimulation", {})
    if blocked.get("status") != "passed" or blocked.get("expectedError") != "SwapVenueNotAllowed":
        add(errors, "routingEvidence.killSwitchCanary.blockedSimulation", "must prove venue block")
    if kill_switch.get("finalStatus") != "manual_only":
        add(errors, "routingEvidence.killSwitchCanary.finalStatus", "must return to manual_only")

    final_venues = routing_evidence.get("finalState", {}).get("venues", {})
    for venue in REQUIRED_MANUAL_SWAP_VENUES:
        final = final_venues.get(venue, {})
        if final.get("isAllowed") is not True or final.get("isAutoAllowed") is not False:
            add(errors, f"routingEvidence.finalState.venues.{venue}", "must end allowed/manual-only")

    require_balanced_sodax_auto_canary(manifest, errors, manifest_dir=manifest_dir)
    if manifest_venues.get("blend", {}).get("autoEnabled") is True:
        add(errors, "executionVenues.blend.autoEnabled", "Blend AUTO needs separate credit canary")


def require_balanced_sodax_auto_canary(
    manifest: dict[str, Any], errors: list[str], *, manifest_dir: Path
) -> None:
    config = manifest.get("executionVenues", {}).get("balancedSodax", {})
    if not isinstance(config, dict) or config.get("autoEnabled") is not True:
        return

    if config.get("status") != "ready":
        add(errors, "executionVenues.balancedSodax.status", "AUTO requires ready status")
    if config.get("mainnetCanaryPassed") is not True:
        add(errors, "executionVenues.balancedSodax.mainnetCanaryPassed", "AUTO requires a passed production canary")
    if config.get("mode") != "intent_sdk_server_side":
        add(errors, "executionVenues.balancedSodax.mode", "AUTO must use the server-side SODAX intent driver")

    driver = config.get("serverDriver", {})
    if not isinstance(driver, dict):
        add(errors, "executionVenues.balancedSodax.serverDriver", "missing server driver readiness")
        driver = {}
    for field in BALANCED_DRIVER_FIELDS:
        if driver.get(field) is not True:
            add(errors, f"executionVenues.balancedSodax.serverDriver.{field}", "required before Balanced/SODAX AUTO")

    manifest_canary = config.get("mainnetCanary", {})
    if not isinstance(manifest_canary, dict):
        add(errors, "executionVenues.balancedSodax.mainnetCanary", "missing production canary metadata")
        manifest_canary = {}
    if not tx(manifest_canary.get("tx")):
        add(errors, "executionVenues.balancedSodax.mainnetCanary.tx", "missing Stellar transaction hash")
    if not evm_hash(manifest_canary.get("canonicalIntentTxHash")):
        add(errors, "executionVenues.balancedSodax.mainnetCanary.canonicalIntentTxHash", "missing canonical intent hash")
    if not evm_hash(manifest_canary.get("fillTxHash")):
        add(errors, "executionVenues.balancedSodax.mainnetCanary.fillTxHash", "missing fill transaction hash")
    if manifest_canary.get("status") != "settled":
        add(errors, "executionVenues.balancedSodax.mainnetCanary.status", "must be settled")

    path = evidence_path(manifest_dir, manifest_canary.get("evidence"))
    if path is None:
        add(errors, "executionVenues.balancedSodax.mainnetCanary.evidence", "missing evidence path")
        return
    try:
        evidence = load_json(path)
    except SystemExit:
        add(errors, "executionVenues.balancedSodax.mainnetCanary.evidence", f"missing evidence file: {path}")
        return

    if evidence.get("network") != "mainnet":
        add(errors, "balancedSodaxEvidence.network", "must be mainnet")
    if evidence.get("venue") != "BALANCED":
        add(errors, "balancedSodaxEvidence.venue", "must be BALANCED")
    if evidence.get("mode") != "sodax_intent_wallet_backed_mainnet_canary":
        add(errors, "balancedSodaxEvidence.mode", "must be wallet-backed mainnet canary")
    if evidence.get("sourceAccount") != manifest.get("admin", {}).get("publicKey"):
        add(errors, "balancedSodaxEvidence.sourceAccount", "must match manifest admin")
    if evidence.get("passed") is not True or evidence.get("statusSummary") != "settled":
        add(errors, "balancedSodaxEvidence.statusSummary", "must be passed and settled")
    if evidence.get("blockingReason") not in (None, ""):
        add(errors, "balancedSodaxEvidence.blockingReason", "must be empty")
    if evidence.get("tx") != manifest_canary.get("tx") or not tx(evidence.get("tx")):
        add(errors, "balancedSodaxEvidence.tx", "must match manifest canary tx")
    if evidence.get("canonicalIntentTxHash") != manifest_canary.get("canonicalIntentTxHash"):
        add(errors, "balancedSodaxEvidence.canonicalIntentTxHash", "must match manifest canary")
    if not positive_int_string(evidence.get("amountInBase")):
        add(errors, "balancedSodaxEvidence.amountInBase", "must be positive")
    if not positive_int_string(evidence.get("quotedAmountBase")):
        add(errors, "balancedSodaxEvidence.quotedAmountBase", "must be positive")
    if not positive_int_string(evidence.get("minOutputAmountBase")):
        add(errors, "balancedSodaxEvidence.minOutputAmountBase", "must be positive")

    stellar = evidence.get("stellar", {})
    if stellar.get("submitted") is not True or stellar.get("tx") != evidence.get("tx"):
        add(errors, "balancedSodaxEvidence.stellar", "must prove submitted Stellar tx")
    quote = evidence.get("quote", {})
    if quote.get("ok") is not True:
        add(errors, "balancedSodaxEvidence.quote.ok", "quote must be available")
    build = evidence.get("build", {})
    if build.get("ok") is not True or not evm_hash(build.get("intentHash")) or not isinstance(build.get("expiresAt"), str):
        add(errors, "balancedSodaxEvidence.build", "build must include intent hash and expiry")
    relay = evidence.get("relay", {})
    if relay.get("ok") is not True or relay.get("success") is not True:
        add(errors, "balancedSodaxEvidence.relay", "relay must succeed")
    submit = evidence.get("submit", {})
    if submit.get("ok") is not True:
        add(errors, "balancedSodaxEvidence.submit.ok", "submit must succeed")
    status = evidence.get("status", {})
    if status.get("ok") is not True or status.get("terminal") is not True or status.get("statusLabel") != "SOLVED":
        add(errors, "balancedSodaxEvidence.status", "status must be terminal SOLVED")
    if status.get("fillTxHash") != manifest_canary.get("fillTxHash"):
        add(errors, "balancedSodaxEvidence.status.fillTxHash", "must match manifest fill tx")
    receipt = evidence.get("receipt", {})
    if receipt.get("ok") is not True or receipt.get("receiptState") != "settled" or receipt.get("terminal") is not True:
        add(errors, "balancedSodaxEvidence.receipt", "receipt must be settled and terminal")
    if receipt.get("fillTxHash") != manifest_canary.get("fillTxHash"):
        add(errors, "balancedSodaxEvidence.receipt.fillTxHash", "must match manifest fill tx")
    refund = evidence.get("refund", {})
    if refund.get("required") is not False or refund.get("mode") != "none":
        add(errors, "balancedSodaxEvidence.refund", "settled canary must require no refund")


def build_report(
    manifest_path: Path,
    create_path: Path,
    routing_path: Path,
    errors: list[str],
    *,
    canary_arka: str | None,
    canary_share_token: str | None,
) -> dict[str, Any]:
    return {
        "name": "arka-mainnet-manual-release-gate",
        "network": "mainnet",
        "validatedAt": iso_now(),
        "status": "passed" if not errors else "failed",
        "scope": "manual AMM venue launch; Balanced/SODAX AUTO requires production intent canary",
        "canaryArka": canary_arka,
        "canaryShareToken": canary_share_token,
        "requiredManualSwapVenues": list(REQUIRED_MANUAL_SWAP_VENUES),
        "artifacts": {
            "manifest": str(manifest_path),
            "createDepositRedeem": str(create_path),
            "routingCanary": str(routing_path),
        },
        "errors": errors,
    }


def update_manifest(manifest_path: Path, manifest: dict[str, Any], report_path: Path, report: dict[str, Any]) -> None:
    validations = manifest.setdefault("validations", {})
    validations["releaseGate"] = report["status"] == "passed"
    validations["mainnetReleaseGate"] = {
        "validatedAt": report["validatedAt"],
        "status": report["status"],
        "scope": report["scope"],
        "report": str(report_path),
        "canaryArka": report["canaryArka"],
        "canaryShareToken": report["canaryShareToken"],
        "manualVenues": report["requiredManualSwapVenues"],
    }
    manifest["evidence"] = report["artifacts"]
    if report["status"] == "passed":
        manifest["status"] = "mainnet_manual_release_ready"
    manifest["updatedAt"] = report["validatedAt"]
    write_json(manifest_path, manifest)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--manifest", type=Path, default=Path("deployments.mainnet.json"))
    parser.add_argument("--create-evidence", type=Path, default=Path("tmp/mainnet-canary-create-deposit-redeem.json"))
    parser.add_argument("--routing-evidence", type=Path, default=Path("tmp/mainnet-routing-canary.json"))
    parser.add_argument("--report", type=Path, default=Path("tmp/mainnet-release-gate.json"))
    parser.add_argument("--update-manifest", action="store_true")
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    manifest_path = args.manifest.resolve()
    create_path = args.create_evidence.resolve()
    routing_path = args.routing_evidence.resolve()
    report_path = args.report.resolve()

    manifest = load_json(manifest_path)
    create_evidence = load_json(create_path)
    routing_evidence = load_json(routing_path)

    errors: list[str] = []
    require_mainnet_basics(manifest, errors)
    canary_arka, canary_share_token = require_canary_create(manifest, create_evidence, errors)
    require_routing_canary(
        manifest,
        routing_evidence,
        canary_arka,
        errors,
        manifest_dir=manifest_path.parent,
    )

    report = build_report(
        manifest_path,
        create_path,
        routing_path,
        errors,
        canary_arka=canary_arka,
        canary_share_token=canary_share_token,
    )
    write_json(report_path, report)

    if args.update_manifest:
        update_manifest(manifest_path, manifest, report_path, report)

    if errors:
        print(f"mainnet release gate failed: {len(errors)} blocking issue(s)")
        for error in errors:
            print(f"- {error}")
        return 1

    print(f"mainnet release gate passed; report: {report_path}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
