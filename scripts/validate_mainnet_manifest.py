#!/usr/bin/env python3
"""Fail-closed validation for the Arka mainnet deployment manifest."""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import re
import sys
from pathlib import Path
from typing import Any


ROOT_DIR = Path(__file__).resolve().parents[1]

CONTRACT_ID_RE = re.compile(r"^C[A-Z2-7]{55}$")
ACCOUNT_RE = re.compile(r"^G[A-Z2-7]{55}$")
HASH_RE = re.compile(r"^[0-9a-fA-F]{64}$")

REQUIRED_ASSETS = ["USDC", "XLM", "EURC", "AQUA", "XTAR", "BLND", "SHX", "XRF", "VELO", "YBX"]
REQUIRED_ARTIFACTS = {
    "adapter-aquarius.wasm",
    "adapter-balanced.wasm",
    "adapter-blend.wasm",
    "adapter-phoenix.wasm",
    "adapter-soroswap.wasm",
    "arka-factory.wasm",
    "arka-registry.wasm",
    "arka-token.wasm",
    "arka-vesting.wasm",
    "arka.wasm",
    "claims-manager.wasm",
    "coverage-fund.wasm",
    "coverage-vault.wasm",
    "emissions-controller.wasm",
    "governance-executor.wasm",
    "governance-token.wasm",
    "locked-arka.wasm",
    "manager-tier.wasm",
    "oracle-guard.wasm",
    "router.wasm",
    "share-token.wasm",
    "venue-registry.wasm",
}
FORBIDDEN_MAINNET_ARTIFACT_PREFIXES = ("test-",)
FORBIDDEN_MAINNET_ARTIFACTS = {
    "adapter-comet.wasm",
    "balanced-router-mock.wasm",
    "blend-router-mock.wasm",
}
REQUIRED_DOCS = [
    "docs/ARKA_LISTING_AND_DISCOVERY_POLICY_2026-06-10.md",
    "docs/MAINNET_DEPLOY_SECURITY_READINESS_2026-06-10.md",
]


def account(value: Any) -> bool:
    return isinstance(value, str) and ACCOUNT_RE.match(value) is not None


def contract_id(value: Any) -> bool:
    return isinstance(value, str) and CONTRACT_ID_RE.match(value) is not None


def hash_value(value: Any) -> bool:
    return isinstance(value, str) and HASH_RE.match(value) is not None


def present(value: Any) -> bool:
    if value is None:
        return False
    if isinstance(value, str):
        return bool(value.strip())
    if isinstance(value, (list, dict)):
        return bool(value)
    return True


def positive_amount(value: Any) -> bool:
    try:
        return int(value) > 0
    except (TypeError, ValueError):
        return False


def add(errors: list[str], path: str, detail: str) -> None:
    errors.append(f"{path}: {detail}")


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as fh:
        for chunk in iter(lambda: fh.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def manifest_contract_entries(manifest: dict[str, Any]) -> list[dict[str, Any]]:
    entries = manifest.get("deploymentPlan", {}).get("contracts", [])
    return entries if isinstance(entries, list) else []


def validate_common(manifest: dict[str, Any], errors: list[str], *, check_env: bool) -> None:
    if manifest.get("network") != "mainnet":
        add(errors, "network", "must be mainnet")
    if manifest.get("networkPassphrase") != "Public Global Stellar Network ; September 2015":
        add(errors, "networkPassphrase", "must be Stellar public network passphrase")

    admin = manifest.get("admin", {})
    secret_env = admin.get("secretEnvVar")
    if not present(secret_env):
        add(errors, "admin.secretEnvVar", "missing secret env var name")
    elif check_env and not os.environ.get(str(secret_env)):
        add(errors, f"env.{secret_env}", "secret env var is not exported")
    if not account(admin.get("publicKey")):
        add(errors, "admin.publicKey", "missing or invalid admin public key")
    if not isinstance(admin.get("bootstrapExpiryUnix"), int) or admin["bootstrapExpiryUnix"] <= 0:
        add(errors, "admin.bootstrapExpiryUnix", "missing bootstrap expiry")
    if admin.get("plannedBootstrapWindowDays") != 365:
        add(errors, "admin.plannedBootstrapWindowDays", "must be explicitly set to 365")
    if admin.get("handoffTarget") != "dao_governor":
        add(errors, "admin.handoffTarget", "must target DAO governor handoff")

    launch = manifest.get("launchPolicy", {})
    if launch.get("creationMode") != "paid_permissionless":
        add(errors, "launchPolicy.creationMode", "mainnet launch must be paid_permissionless")
    creation_fee = launch.get("creationFee", {})
    if creation_fee.get("token") != "USDC":
        add(errors, "launchPolicy.creationFee.token", "creation fee must be denominated in USDC")
    if not contract_id(creation_fee.get("tokenContract")):
        add(errors, "launchPolicy.creationFee.tokenContract", "missing USDC SAC contract id")
    if not positive_amount(creation_fee.get("amount")):
        add(errors, "launchPolicy.creationFee.amount", "must be a positive base-unit amount")
    if not account(launch.get("protocolTreasury", {}).get("address")):
        add(errors, "launchPolicy.protocolTreasury.address", "missing treasury account for creation fee")
    if launch.get("freeCreation", {}).get("enabled") is not False:
        add(errors, "launchPolicy.freeCreation.enabled", "must be false for mainnet v1")

    for doc in REQUIRED_DOCS:
        if not (ROOT_DIR / doc).is_file():
            add(errors, doc, "required readiness document is missing")

    assets = manifest.get("assets", {})
    contract_ids = assets.get("contractIds", {})
    tokens = assets.get("tokens", [])
    by_symbol = {token.get("symbol"): token for token in tokens if isinstance(token, dict)}
    if set(assets.get("admittedSymbols", [])) != set(REQUIRED_ASSETS):
        add(errors, "assets.admittedSymbols", "must match the launch asset universe exactly")
    for symbol in REQUIRED_ASSETS:
        if not contract_id(contract_ids.get(symbol)):
            add(errors, f"assets.contractIds.{symbol}", "missing mainnet SAC id")
        token = by_symbol.get(symbol)
        if not isinstance(token, dict):
            add(errors, f"assets.tokens.{symbol}", "missing token record")
            continue
        if token.get("contractId") != contract_ids.get(symbol):
            add(errors, f"assets.tokens.{symbol}.contractId", "does not match assets.contractIds")
        if token.get("verified") is not True:
            add(errors, f"assets.tokens.{symbol}.verified", "must be verified before mainnet")
        if symbol != "XLM" and not account(token.get("issuer")):
            add(errors, f"assets.tokens.{symbol}.issuer", "missing issuer account")

    deployment_plan = manifest.get("deploymentPlan", {})
    if deployment_plan.get("buildCommand") != "BUILD_CONTRACT_SET=production bash scripts/build-wasm.sh":
        add(errors, "deploymentPlan.buildCommand", "must build the production contract set")
    entries = manifest_contract_entries(manifest)
    if not entries:
        add(errors, "deploymentPlan.contracts", "missing production contract plan")
    artifacts = set()
    names = set()
    for idx, entry in enumerate(entries):
        name = entry.get("name")
        artifact = entry.get("artifact")
        path = f"deploymentPlan.contracts[{idx}]"
        if not present(name):
            add(errors, f"{path}.name", "missing contract plan name")
        elif name in names:
            add(errors, f"{path}.name", "duplicate contract plan name")
        names.add(name)
        if not present(artifact):
            add(errors, f"{path}.artifact", "missing artifact path")
            continue
        artifact_name = Path(str(artifact)).name
        artifacts.add(artifact_name)
        if artifact_name.startswith(FORBIDDEN_MAINNET_ARTIFACT_PREFIXES) or artifact_name in FORBIDDEN_MAINNET_ARTIFACTS:
            add(errors, f"{path}.artifact", "test/mock/retired artifact cannot be in mainnet plan")
        artifact_path = ROOT_DIR / str(artifact)
        if not artifact_path.is_file():
            add(errors, f"{path}.artifact", f"artifact not found: {artifact}")
            continue
        expected_sha = entry.get("sha256")
        if not hash_value(expected_sha):
            add(errors, f"{path}.sha256", "missing local artifact sha256")
        elif sha256(artifact_path).lower() != str(expected_sha).lower():
            add(errors, f"{path}.sha256", "does not match current artifact")
        if entry.get("deploy") is False and not present(entry.get("deferredReason")):
            add(errors, f"{path}.deferredReason", "artifact-only contracts must state why deployment is deferred")
    missing_artifacts = REQUIRED_ARTIFACTS - artifacts
    for artifact in sorted(missing_artifacts):
        add(errors, "deploymentPlan.contracts", f"missing required artifact {artifact}")

    oracle = manifest.get("oracle", {})
    for provider in ["primaryProvider", "secondaryProvider", "fiatProvider"]:
        if not contract_id(oracle.get(provider)):
            add(errors, f"oracle.{provider}", "missing SEP-40 provider contract")
    policies = oracle.get("assetPolicies", {})
    for symbol in REQUIRED_ASSETS:
        policy = policies.get(symbol)
        if not isinstance(policy, dict):
            add(errors, f"oracle.assetPolicies.{symbol}", "missing per-asset oracle policy")
            continue
        if policy.get("mode") not in {"dual_provider_fail_closed", "fiat_provider", "single_provider_exception"}:
            add(errors, f"oracle.assetPolicies.{symbol}.mode", "unsupported oracle policy mode")
        if not isinstance(policy.get("maxAgeSeconds"), int) or policy["maxAgeSeconds"] <= 0:
            add(errors, f"oracle.assetPolicies.{symbol}.maxAgeSeconds", "must be positive")
        if not isinstance(policy.get("maxDivergenceBps"), int) or policy["maxDivergenceBps"] < 0:
            add(errors, f"oracle.assetPolicies.{symbol}.maxDivergenceBps", "must be non-negative")

    venues = manifest.get("executionVenues", {})
    for venue in ["soroswap", "aquarius", "phoenix", "blend", "balancedSodax"]:
        config = venues.get(venue)
        if not isinstance(config, dict):
            add(errors, f"executionVenues.{venue}", "missing venue config")
            continue
        if config.get("autoEnabled") is True and config.get("mainnetCanaryPassed") is not True:
            add(errors, f"executionVenues.{venue}.mainnetCanaryPassed", "AUTO requires a passed mainnet canary")
        if config.get("autoEnabled") is not True and not present(config.get("status")):
            add(errors, f"executionVenues.{venue}.status", "disabled venues must state why")
    balanced = venues.get("balancedSodax", {})
    if isinstance(balanced, dict) and balanced.get("autoEnabled") is True:
        driver = balanced.get("serverDriver", {})
        for field in ["quote", "status", "receipt", "refund", "expiry", "walletBacked"]:
            if driver.get(field) is not True:
                add(errors, f"executionVenues.balancedSodax.serverDriver.{field}", "required before Balanced AUTO")

    governance = manifest.get("governance", {})
    if governance.get("bootstrapAdminCanUpgrade") is not True:
        add(errors, "governance.bootstrapAdminCanUpgrade", "must explicitly state bootstrap upgrade authority")
    if governance.get("daoGovernor") not in (None, "deferred_until_dao_bootstrap") and not contract_id(
        governance.get("daoGovernor")
    ):
        add(errors, "governance.daoGovernor", "must be a contract id or explicit deferred marker")
    if governance.get("upgradePolicy") != "bootstrap_admin_until_expiry_then_governor_dao":
        add(errors, "governance.upgradePolicy", "unexpected upgrade policy")


def validate_predeploy(manifest: dict[str, Any], *, check_env: bool) -> list[str]:
    errors: list[str] = []
    validate_common(manifest, errors, check_env=check_env)
    if manifest.get("status") not in {"predeploy_ready", "predeploy"}:
        add(errors, "status", "must be predeploy_ready or predeploy before deployment")
    init_plan = manifest.get("initializationPlan", {})
    for section in ["singletons", "factory", "venues", "oracle", "postDeployGates"]:
        if not present(init_plan.get(section)):
            add(errors, f"initializationPlan.{section}", "missing initialization plan section")
    return errors


def validate_postdeploy(manifest: dict[str, Any], *, check_env: bool) -> list[str]:
    errors: list[str] = []
    validate_common(manifest, errors, check_env=check_env)
    contracts = manifest.get("contracts", {})
    wasm_hashes = manifest.get("wasmHashes", {})
    for entry in manifest_contract_entries(manifest):
        if entry.get("deploy") is not True:
            continue
        name = entry.get("name")
        if not contract_id(contracts.get(name)):
            add(errors, f"contracts.{name}", "missing deployed mainnet contract id")
        if not hash_value(wasm_hashes.get(name)):
            add(errors, f"wasmHashes.{name}", "missing uploaded ledger wasm hash")
    validations = manifest.get("validations", {})
    if validations.get("contractsDeployed") is not True:
        add(errors, "validations.contractsDeployed", "must be true after deployment")
    if validations.get("contractsConfigured") is not True:
        add(errors, "validations.contractsConfigured", "must be true after configuration")
    if validations.get("storageLifecycleDryRun") is not True:
        add(errors, "validations.storageLifecycleDryRun", "strict mainnet dry-run must pass")
    if validations.get("releaseGate") is not True:
        add(errors, "validations.releaseGate", "release gate must pass")
    return errors


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--manifest", default="deployments.mainnet.json", help="Path to deployments.mainnet.json")
    parser.add_argument("--phase", choices=["predeploy", "postdeploy"], default="predeploy")
    parser.add_argument("--check-env", action="store_true", help="Require the admin secret env var to be exported")
    args = parser.parse_args()

    manifest_path = Path(args.manifest)
    manifest = json.loads(manifest_path.read_text())
    if args.phase == "predeploy":
        errors = validate_predeploy(manifest, check_env=args.check_env)
    else:
        errors = validate_postdeploy(manifest, check_env=args.check_env)

    if errors:
        print(f"mainnet manifest is NOT {args.phase}-ready: {len(errors)} blocking issue(s)")
        for error in errors:
            print(f"- {error}")
        return 1

    print(f"mainnet manifest is {args.phase}-ready")
    return 0


if __name__ == "__main__":
    sys.exit(main())
