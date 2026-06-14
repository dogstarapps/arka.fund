#!/usr/bin/env python3
from __future__ import annotations

import argparse
import copy
import datetime as dt
import json
import os
import subprocess
import sys
import time
from dataclasses import dataclass
from pathlib import Path
from typing import Any


ROOT_DIR = Path(__file__).resolve().parent.parent
DAPP_DIR = ROOT_DIR.parent / "arkafund-dapp"
SDK_DIR = ROOT_DIR / "sdk" / "typescript"
CATALOG_DIR = ROOT_DIR / "services" / "catalog-api"
DEFAULT_REPORT = ROOT_DIR / "tmp" / "release-gate.json"
DEFAULT_DEPLOYMENTS = ROOT_DIR / "deployments.testnet.json"
DEFAULT_NETWORK = "testnet"
DEFAULT_RPC_URL = "https://soroban-testnet.stellar.org"


@dataclass
class Step:
    step_id: str
    label: str
    cwd: str
    command: list[str]
    kind: str

    @classmethod
    def from_dict(cls, payload: dict[str, Any]) -> "Step":
        return cls(
            step_id=payload["step_id"],
            label=payload["label"],
            cwd=payload["cwd"],
            command=list(payload["command"]),
            kind=payload.get("kind", "command"),
        )

    def to_dict(self) -> dict[str, Any]:
        return {
            "step_id": self.step_id,
            "label": self.label,
            "cwd": self.cwd,
            "command": self.command,
            "kind": self.kind,
        }


def iso_now() -> str:
    return dt.datetime.now(dt.timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def tail(text: str, limit: int = 4000) -> str:
    if len(text) <= limit:
        return text
    return text[-limit:]


def load_json(path: Path) -> dict[str, Any]:
    return json.loads(path.read_text())


def write_json(path: Path, payload: dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, indent=2) + "\n")


def default_steps() -> list[Step]:
    return [
        Step(
            step_id="contracts_build",
            label="Build WASM artifacts",
            cwd=str(ROOT_DIR),
            command=["bash", str(ROOT_DIR / "scripts" / "build-wasm.sh")],
            kind="contracts",
        ),
        Step(
            step_id="contracts_registry_tests",
            label="Registry and factory tests",
            cwd=str(ROOT_DIR / "contracts"),
            command=["cargo", "test", "-p", "arka-registry", "-p", "arka-factory", "--tests"],
            kind="contracts",
        ),
        Step(
            step_id="contracts_core_tests",
            label="Governance, coverage, claims, oracle and Balanced tests",
            cwd=str(ROOT_DIR / "contracts"),
            command=[
                "cargo",
                "test",
                "-p",
                "governance-executor",
                "-p",
                "arka-token",
                "-p",
                "locked-arka",
                "-p",
                "coverage-fund",
                "-p",
                "claims-manager",
                "-p",
                "oracle-guard",
                "-p",
                "adapter-balanced",
                "--tests",
            ],
            kind="contracts",
        ),
        Step(
            step_id="contracts_arka_tests",
            label="Arka tests",
            cwd=str(ROOT_DIR / "contracts"),
            command=["cargo", "test", "-p", "arka", "--tests"],
            kind="contracts",
        ),
        Step(
            step_id="internal_security_audit",
            label="Internal security audit inventory",
            cwd=str(ROOT_DIR),
            command=["bash", str(ROOT_DIR / "scripts" / "run-internal-security-audit.sh")],
            kind="security",
        ),
        Step(
            step_id="storage_lifecycle_audit",
            label="Storage lifecycle extend audit (dry-run)",
            cwd=str(ROOT_DIR),
            command=[
                sys.executable,
                str(ROOT_DIR / "scripts" / "storage_lifecycle_extend.py"),
                "--deployments",
                str(DEFAULT_DEPLOYMENTS),
                "--out-json",
                str(ROOT_DIR / "tmp" / "storage-lifecycle-audit.json"),
                "--dry-run",
                "--strict",
            ],
            kind="security",
        ),
        Step(
            step_id="balanced_readiness",
            label="Balanced readiness validation on testnet",
            cwd=str(ROOT_DIR),
            command=["bash", str(ROOT_DIR / "scripts" / "deploy-balanced-readiness-validation.sh")],
            kind="testnet",
        ),
        Step(
            step_id="balanced_official_surface",
            label="Balanced official surface verification",
            cwd=str(ROOT_DIR),
            command=["bash", str(ROOT_DIR / "scripts" / "deploy-balanced-official-surface-validation.sh")],
            kind="research",
        ),
        Step(
            step_id="canonical_registry_promote",
            label="Promote canonical testnet module registry",
            cwd=str(ROOT_DIR),
            command=["bash", str(ROOT_DIR / "scripts" / "promote-canonical-testnet-registry.sh")],
            kind="testnet",
        ),
        Step(
            step_id="canonical_registry_verify",
            label="Verify canonical testnet module registry",
            cwd=str(ROOT_DIR),
            command=["bash", str(ROOT_DIR / "scripts" / "verify-canonical-testnet-registry.sh")],
            kind="testnet",
        ),
        Step(
            step_id="indexer_event_surface",
            label="Indexer-ready event surface validation on testnet",
            cwd=str(ROOT_DIR),
            command=["bash", str(ROOT_DIR / "scripts" / "deploy-indexer-event-surface-live-validation.sh")],
            kind="testnet",
        ),
        Step(
            step_id="create_live_validation",
            label="Create live validation on testnet",
            cwd=str(ROOT_DIR),
            command=["bash", str(ROOT_DIR / "scripts" / "deploy-create-live-validation.sh")],
            kind="testnet",
        ),
        Step(
            step_id="deposit_redeem_live_validation",
            label="Deposit/redeem live validation on testnet",
            cwd=str(ROOT_DIR),
            command=["bash", str(ROOT_DIR / "scripts" / "deploy-deposit-redeem-live-validation.sh")],
            kind="testnet",
        ),
        Step(
            step_id="sdk_unit",
            label="SDK unit tests",
            cwd=str(SDK_DIR),
            command=["npm", "run", "test:unit"],
            kind="sdk",
        ),
        Step(
            step_id="sdk_integration",
            label="SDK integration tests",
            cwd=str(SDK_DIR),
            command=["npm", "run", "test:integration"],
            kind="sdk",
        ),
        Step(
            step_id="sdk_e2e",
            label="SDK end-to-end tests",
            cwd=str(SDK_DIR),
            command=["npm", "run", "test:e2e"],
            kind="sdk",
        ),
        Step(
            step_id="catalog_unit",
            label="Catalog API unit tests",
            cwd=str(CATALOG_DIR),
            command=["npm", "run", "test:unit"],
            kind="catalog",
        ),
        Step(
            step_id="catalog_integration",
            label="Catalog API integration tests",
            cwd=str(CATALOG_DIR),
            command=["npm", "run", "test:integration"],
            kind="catalog",
        ),
        Step(
            step_id="catalog_e2e",
            label="Catalog API end-to-end tests",
            cwd=str(CATALOG_DIR),
            command=["npm", "run", "test:e2e"],
            kind="catalog",
        ),
        Step(
            step_id="dapp_build",
            label="Dapp build",
            cwd=str(DAPP_DIR),
            command=["npm", "run", "build"],
            kind="frontend",
        ),
        Step(
            step_id="dapp_unit",
            label="Dapp unit tests",
            cwd=str(DAPP_DIR),
            command=["npm", "run", "test:unit"],
            kind="frontend",
        ),
        Step(
            step_id="dapp_integration",
            label="Dapp integration tests",
            cwd=str(DAPP_DIR),
            command=["npm", "run", "test:integration"],
            kind="frontend",
        ),
        Step(
            step_id="dapp_playwright",
            label="Dapp Playwright validation",
            cwd=str(DAPP_DIR),
            command=[
                "npx",
                "playwright",
                "test",
                "e2e/smoke.spec.ts",
                "e2e/product-surfaces.spec.ts",
                "e2e/explorers.spec.ts",
                "e2e/vault-profile.spec.ts",
                "e2e/workflow-ia.spec.ts",
                "e2e/vault-entrypoints.spec.ts",
                "e2e/live-ops-surfaces.spec.ts",
            ],
            kind="frontend",
        ),
        Step(
            step_id="dapp_design_audit",
            label="Dapp design audit",
            cwd=str(DAPP_DIR),
            command=["npm", "run", "design:audit"],
            kind="frontend",
        ),
        Step(
            step_id="offchain_public_stack",
            label="Off-chain testnet stack validation",
            cwd=str(ROOT_DIR),
            command=["bash", str(ROOT_DIR / "scripts" / "deploy-offchain-testnet-stack.sh")],
            kind="offchain",
        ),
        Step(
            step_id="graphql_backend_parity",
            label="GraphQL backend parity validation",
            cwd=str(ROOT_DIR),
            command=["bash", str(ROOT_DIR / "scripts" / "deploy-graphql-backend-parity-validation.sh")],
            kind="offchain",
        ),
        Step(
            step_id="subquery_backend_parity",
            label="SubQuery-compatible backend parity validation",
            cwd=str(ROOT_DIR),
            command=["bash", str(ROOT_DIR / "scripts" / "deploy-subquery-backend-parity-validation.sh")],
            kind="offchain",
        ),
    ]


def default_plan() -> dict[str, Any]:
    return {
        "name": "Testnet Release Gate",
        "network": DEFAULT_NETWORK,
        "rpcUrl": DEFAULT_RPC_URL,
        "steps": [step.to_dict() for step in default_steps()],
    }


def load_plan(path: Path | None) -> dict[str, Any]:
    if path is None:
        return default_plan()
    return json.loads(path.read_text())


def run_step(step: Step, *, dry_run: bool = False) -> dict[str, Any]:
    started_at = iso_now()
    started_perf = time.perf_counter()
    if dry_run:
        finished_at = iso_now()
        return {
            "step_id": step.step_id,
            "label": step.label,
            "kind": step.kind,
            "cwd": step.cwd,
            "command": step.command,
            "status": "dry_run",
            "startedAt": started_at,
            "finishedAt": finished_at,
            "durationSeconds": 0.0,
            "stdoutTail": "",
            "stderrTail": "",
            "returncode": 0,
        }

    proc = subprocess.run(
        step.command,
        cwd=step.cwd,
        text=True,
        capture_output=True,
    )
    finished_at = iso_now()
    duration = round(time.perf_counter() - started_perf, 3)
    return {
        "step_id": step.step_id,
        "label": step.label,
        "kind": step.kind,
        "cwd": step.cwd,
        "command": step.command,
        "status": "passed" if proc.returncode == 0 else "failed",
        "startedAt": started_at,
        "finishedAt": finished_at,
        "durationSeconds": duration,
        "stdoutTail": tail(proc.stdout),
        "stderrTail": tail(proc.stderr),
        "returncode": proc.returncode,
    }


def build_report(plan: dict[str, Any], results: list[dict[str, Any]], deployments_path: Path) -> dict[str, Any]:
    status = "passed" if all(result["status"] in {"passed", "dry_run"} for result in results) else "failed"
    validated_modules = load_json(deployments_path).get("validatedModules", {})
    return {
        "name": plan["name"],
        "network": plan.get("network", DEFAULT_NETWORK),
        "rpcUrl": plan.get("rpcUrl", DEFAULT_RPC_URL),
        "startedAt": results[0]["startedAt"] if results else iso_now(),
        "finishedAt": results[-1]["finishedAt"] if results else iso_now(),
        "status": status,
        "stepCount": len(results),
        "passedSteps": sum(1 for result in results if result["status"] in {"passed", "dry_run"}),
        "failedSteps": sum(1 for result in results if result["status"] == "failed"),
        "validatedModules": sorted(validated_modules.keys()),
        "results": results,
        "artifacts": {
            "deployments": str(deployments_path),
            "canonicalRegistryScript": str(ROOT_DIR / "scripts" / "canonical_testnet_registry.py"),
            "createLiveValidation": str(ROOT_DIR / "tmp" / "create-live-validation.json"),
            "depositRedeemLiveValidation": str(ROOT_DIR / "tmp" / "deposit-redeem-live-validation.json"),
            "designAuditReport": str(ROOT_DIR / "tmp" / "design-audit" / "report.md"),
            "feeEngineValidation": str(ROOT_DIR / "tmp" / "fee-engine-live-validation.json"),
            "coverageClaimsValidation": str(ROOT_DIR / "tmp" / "coverage-claims-live-validation.json"),
            "tokenomicsValidation": str(ROOT_DIR / "tmp" / "tokenomics-live-validation.json"),
            "offchainPublicStack": str(ROOT_DIR / "tmp" / "offchain-testnet-stack.json"),
            "graphqlBackendParity": str(ROOT_DIR / "tmp" / "graphql-backend-parity.json"),
            "subqueryBackendParity": str(ROOT_DIR / "tmp" / "subquery-backend-parity.json"),
            "indexerEventSurface": str(ROOT_DIR / "tmp" / "indexer-event-surface-live-validation.json"),
            "balancedReadiness": str(ROOT_DIR / "tmp" / "balanced-readiness-validation.json"),
        },
    }


def update_deployments_validation(deployments_path: Path, report_path: Path, report: dict[str, Any]) -> None:
    deployments = load_json(deployments_path)
    validations = deployments.setdefault("validations", {})
    validations["releaseGate"] = {
        "validatedAt": dt.date.today().isoformat(),
        "network": report["network"],
        "rpcUrl": report["rpcUrl"],
        "status": report["status"],
        "report": str(report_path),
        "validatedModules": report["validatedModules"],
        "steps": [
            {
                "step_id": item["step_id"],
                "status": item["status"],
                "durationSeconds": item["durationSeconds"],
            }
            for item in report["results"]
        ],
    }
    write_json(deployments_path, deployments)


def run_plan(plan: dict[str, Any], *, deployments_path: Path, report_path: Path, update_deployments: bool, dry_run: bool) -> int:
    results: list[dict[str, Any]] = []
    for payload in plan["steps"]:
        step = Step.from_dict(payload)
        result = run_step(step, dry_run=dry_run)
        results.append(result)
        if result["status"] == "failed":
            break

    report = build_report(plan, results, deployments_path)
    write_json(report_path, report)
    if update_deployments:
        update_deployments_validation(deployments_path, report_path, report)
    return 0 if report["status"] == "passed" else 1


def parse_args(argv: list[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Run the integrated Arkafund testnet release gate.")
    subparsers = parser.add_subparsers(dest="command", required=True)

    run = subparsers.add_parser("run", help="Run the release gate")
    run.add_argument("--plan", type=Path, default=None)
    run.add_argument("--report", type=Path, default=DEFAULT_REPORT)
    run.add_argument("--deployments", type=Path, default=DEFAULT_DEPLOYMENTS)
    run.add_argument("--update-deployments", action="store_true")
    run.add_argument("--dry-run", action="store_true")

    show = subparsers.add_parser("show-default-plan", help="Print the built-in release plan")
    show.add_argument("--json", action="store_true")
    return parser.parse_args(argv)


def main(argv: list[str] | None = None) -> int:
    args = parse_args(argv)
    if args.command == "show-default-plan":
        plan = default_plan()
        if args.json:
            print(json.dumps(plan, indent=2))
        else:
            for step in plan["steps"]:
                print(step["step_id"])
        return 0

    if args.command == "run":
        plan = load_plan(args.plan)
        return run_plan(
            plan,
            deployments_path=args.deployments.resolve(),
            report_path=args.report.resolve(),
            update_deployments=args.update_deployments,
            dry_run=args.dry_run,
        )

    raise SystemExit("unsupported command")


if __name__ == "__main__":
    raise SystemExit(main())
