#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import sys
from dataclasses import dataclass, asdict
from pathlib import Path
from typing import Any

import internal_security_audit


ROOT_DIR = Path(__file__).resolve().parent.parent
DEFAULT_REPORT_JSON = ROOT_DIR / "tmp" / "contract-api-surface.json"
DEFAULT_REPORT_MD = ROOT_DIR / "tmp" / "contract-api-surface.md"


@dataclass(frozen=True)
class CompatibilityGroup:
    contract: str
    operation: str
    canonical: str
    compatibility: tuple[str, ...]
    kind: str
    frontend_direct_calls_allowed: bool
    planned_resolution: str
    rationale: str


COMPATIBILITY_GROUPS: tuple[CompatibilityGroup, ...] = (
    CompatibilityGroup(
        contract="arka",
        operation="credit.supply",
        canonical="credit_supply",
        compatibility=("blend_lend",),
        kind="write",
        frontend_direct_calls_allowed=False,
        planned_resolution="Remove or make internal in the next ABI-breaking Arka contract release.",
        rationale="Managers should route lending through protocol-agnostic credit actions.",
    ),
    CompatibilityGroup(
        contract="arka",
        operation="credit.borrow",
        canonical="credit_borrow",
        compatibility=("blend_borrow",),
        kind="write",
        frontend_direct_calls_allowed=False,
        planned_resolution="Remove or make internal in the next ABI-breaking Arka contract release.",
        rationale="Managers should route borrowing through protocol-agnostic credit actions.",
    ),
    CompatibilityGroup(
        contract="arka",
        operation="credit.repay",
        canonical="credit_repay",
        compatibility=("blend_repay",),
        kind="write",
        frontend_direct_calls_allowed=False,
        planned_resolution="Remove or make internal in the next ABI-breaking Arka contract release.",
        rationale="Managers should route repayments through protocol-agnostic credit actions.",
    ),
    CompatibilityGroup(
        contract="arka",
        operation="credit.withdraw",
        canonical="credit_withdraw",
        compatibility=("blend_withdraw",),
        kind="write",
        frontend_direct_calls_allowed=False,
        planned_resolution="Remove or make internal in the next ABI-breaking Arka contract release.",
        rationale="Managers should route collateral withdrawals through protocol-agnostic credit actions.",
    ),
    CompatibilityGroup(
        contract="arka",
        operation="credit.market_assets",
        canonical="credit_market_assets",
        compatibility=("blend_market_assets",),
        kind="read",
        frontend_direct_calls_allowed=False,
        planned_resolution="Remove or keep as documented protocol-specific read compatibility after ABI review.",
        rationale="The app can read market assets through the credit namespace.",
    ),
    CompatibilityGroup(
        contract="arka",
        operation="credit.position",
        canonical="credit_position",
        compatibility=("blend_position",),
        kind="read",
        frontend_direct_calls_allowed=False,
        planned_resolution="Remove or keep as documented protocol-specific read compatibility after ABI review.",
        rationale="The app can read single positions through the credit namespace.",
    ),
    CompatibilityGroup(
        contract="arka",
        operation="credit.positions",
        canonical="credit_positions",
        compatibility=("blend_positions",),
        kind="read",
        frontend_direct_calls_allowed=False,
        planned_resolution="Remove or keep as documented protocol-specific read compatibility after ABI review.",
        rationale="The app can read position lists through the credit namespace.",
    ),
    CompatibilityGroup(
        contract="arka",
        operation="credit.position_value",
        canonical="credit_position_value",
        compatibility=("blend_position_value",),
        kind="read",
        frontend_direct_calls_allowed=False,
        planned_resolution="Remove or keep as documented protocol-specific read compatibility after ABI review.",
        rationale="The app can read single position valuations through the credit namespace.",
    ),
    CompatibilityGroup(
        contract="arka",
        operation="credit.position_values",
        canonical="credit_position_values",
        compatibility=("blend_position_values",),
        kind="read",
        frontend_direct_calls_allowed=False,
        planned_resolution="Remove or keep as documented protocol-specific read compatibility after ABI review.",
        rationale="The app can read position valuation lists through the credit namespace.",
    ),
    CompatibilityGroup(
        contract="arka",
        operation="credit.market_value",
        canonical="credit_market_value",
        compatibility=("blend_market_value",),
        kind="read",
        frontend_direct_calls_allowed=False,
        planned_resolution="Remove or keep as documented protocol-specific read compatibility after ABI review.",
        rationale="The app can read market valuation through the credit namespace.",
    ),
    CompatibilityGroup(
        contract="arka",
        operation="credit.health_factor",
        canonical="credit_health_factor",
        compatibility=("blend_health_factor",),
        kind="read",
        frontend_direct_calls_allowed=False,
        planned_resolution="Remove or keep as documented protocol-specific read compatibility after ABI review.",
        rationale="The app can read health factor through the credit namespace.",
    ),
    CompatibilityGroup(
        contract="arka",
        operation="credit.risk_policy",
        canonical="credit_risk_policy",
        compatibility=("blend_risk_policy",),
        kind="read",
        frontend_direct_calls_allowed=False,
        planned_resolution="Add a generic governed credit-risk setter before removing the Blend-specific read/write pair.",
        rationale="Risk policy reads have a generic credit view; writes are still protocol-specific.",
    ),
    CompatibilityGroup(
        contract="arka",
        operation="credit.market_status",
        canonical="credit_market_status",
        compatibility=("blend_market_status",),
        kind="read",
        frontend_direct_calls_allowed=False,
        planned_resolution="Remove or keep as documented protocol-specific read compatibility after ABI review.",
        rationale="The app can read status through the credit namespace.",
    ),
    CompatibilityGroup(
        contract="arka-factory",
        operation="factory.set_arka_implementation",
        canonical="set_implementation_controlled",
        compatibility=("set_implementation",),
        kind="governance-write",
        frontend_direct_calls_allowed=False,
        planned_resolution="Keep only the caller-explicit controlled method after the governance/operator migration window.",
        rationale="The controlled variant expresses caller and bootstrap/DAO authority explicitly.",
    ),
    CompatibilityGroup(
        contract="arka-factory",
        operation="factory.set_share_token_implementation",
        canonical="set_share_impl_controlled",
        compatibility=("set_share_token_implementation",),
        kind="governance-write",
        frontend_direct_calls_allowed=False,
        planned_resolution="Keep only the caller-explicit controlled method after the governance/operator migration window.",
        rationale="The controlled variant expresses caller and bootstrap/DAO authority explicitly.",
    ),
)

PROTOCOL_SPECIFIC_PUBLIC_METHODS = {
    ("arka", "blend_markets"),
    ("arka", "blend_external_diagnostics"),
    ("arka", "set_blend_risk_policy"),
    ("arka", "set_blend_external_diagnostics"),
}


def public_methods_by_contract() -> dict[str, set[str]]:
    report = internal_security_audit.generate_report()
    methods: dict[str, set[str]] = {}
    for contract in report["contracts"]:
        methods[contract["crate"]] = {fn["name"] for fn in contract["functions"]}
    return methods


def group_payload(group: CompatibilityGroup, methods: dict[str, set[str]]) -> dict[str, Any]:
    contract_methods = methods.get(group.contract, set())
    missing = [
        name
        for name in (group.canonical, *group.compatibility)
        if name not in contract_methods
    ]
    payload = asdict(group)
    payload["compatibility"] = list(group.compatibility)
    payload["present"] = not missing
    payload["missingMethods"] = missing
    return payload


def build_report() -> dict[str, Any]:
    methods = public_methods_by_contract()
    groups = [group_payload(group, methods) for group in COMPATIBILITY_GROUPS]
    grouped_methods = {
        (group.contract, group.canonical)
        for group in COMPATIBILITY_GROUPS
    } | {
        (group.contract, method)
        for group in COMPATIBILITY_GROUPS
        for method in group.compatibility
    }

    arka_blend_methods = {
        ("arka", method)
        for method in methods.get("arka", set())
        if method.startswith("blend_") or method.startswith("set_blend_")
    }
    unclassified_protocol_methods = sorted(
        f"{contract}.{method}"
        for contract, method in arka_blend_methods - grouped_methods - PROTOCOL_SPECIFIC_PUBLIC_METHODS
    )

    missing_groups = [
        f"{group['contract']}.{method}"
        for group in groups
        for method in group["missingMethods"]
    ]
    frontend_allowed_legacy = [
        f"{group.contract}.{method}"
        for group in COMPATIBILITY_GROUPS
        if group.frontend_direct_calls_allowed
        for method in group.compatibility
    ]

    errors = []
    if missing_groups:
        errors.append({"kind": "missing_declared_methods", "items": missing_groups})
    if unclassified_protocol_methods:
        errors.append({"kind": "unclassified_protocol_methods", "items": unclassified_protocol_methods})
    if frontend_allowed_legacy:
        errors.append({"kind": "frontend_legacy_calls_allowed", "items": frontend_allowed_legacy})

    return {
        "status": "passed" if not errors else "failed",
        "summary": {
            "compatibilityGroups": len(groups),
            "legacyMethodsBlockedForFrontend": sum(len(group.compatibility) for group in COMPATIBILITY_GROUPS),
            "protocolSpecificPublicMethods": sorted(
                f"{contract}.{method}" for contract, method in PROTOCOL_SPECIFIC_PUBLIC_METHODS
            ),
            "errors": len(errors),
        },
        "groups": groups,
        "errors": errors,
    }


def render_markdown(report: dict[str, Any]) -> str:
    lines = [
        "# Contract API Surface Gate",
        "",
        f"- Status: `{report['status']}`",
        f"- Compatibility groups: `{report['summary']['compatibilityGroups']}`",
        f"- Legacy methods blocked for frontend: `{report['summary']['legacyMethodsBlockedForFrontend']}`",
        "",
        "## Compatibility Groups",
        "",
        "| Contract | Operation | Canonical | Compatibility | Kind | Frontend direct calls | Resolution |",
        "| --- | --- | --- | --- | --- | --- | --- |",
    ]
    for group in report["groups"]:
        compatibility = ", ".join(f"`{method}`" for method in group["compatibility"])
        lines.append(
            f"| `{group['contract']}` | {group['operation']} | `{group['canonical']}` | "
            f"{compatibility} | {group['kind']} | "
            f"{'allowed' if group['frontend_direct_calls_allowed'] else 'blocked'} | "
            f"{group['planned_resolution']} |"
        )

    lines.extend(["", "## Protocol-Specific Methods", ""])
    for item in report["summary"]["protocolSpecificPublicMethods"]:
        lines.append(f"- `{item}`")

    if report["errors"]:
        lines.extend(["", "## Errors", ""])
        for error in report["errors"]:
            lines.append(f"- `{error['kind']}`: {', '.join(error['items'])}")
    return "\n".join(lines) + "\n"


def parse_args(argv: list[str]) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Validate Arka contract API compatibility surface.")
    parser.add_argument("--report-json", type=Path, default=DEFAULT_REPORT_JSON)
    parser.add_argument("--report-md", type=Path, default=DEFAULT_REPORT_MD)
    parser.add_argument("--strict", action="store_true")
    return parser.parse_args(argv)


def main(argv: list[str] | None = None) -> int:
    args = parse_args(argv or sys.argv[1:])
    report = build_report()
    args.report_json.parent.mkdir(parents=True, exist_ok=True)
    args.report_json.write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
    args.report_md.parent.mkdir(parents=True, exist_ok=True)
    args.report_md.write_text(render_markdown(report), encoding="utf-8")
    print(json.dumps({"status": report["status"], "reportJson": str(args.report_json), "reportMarkdown": str(args.report_md)}))
    if args.strict and report["status"] != "passed":
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
