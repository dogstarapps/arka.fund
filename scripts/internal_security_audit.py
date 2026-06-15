#!/usr/bin/env python3
from __future__ import annotations

import argparse
import dataclasses
import datetime as dt
import json
import re
import sys
import tomllib
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any


ROOT_DIR = Path(__file__).resolve().parent.parent
CONTRACTS_DIR = ROOT_DIR / "contracts"
WORKSPACE_MANIFEST = CONTRACTS_DIR / "Cargo.toml"
DEFAULT_REPORT_JSON = ROOT_DIR / "tmp" / "internal-security-audit.json"
DEFAULT_REPORT_MD = ROOT_DIR / "tmp" / "internal-security-audit.md"

AUDIT_SCOPE: dict[str, dict[str, str]] = {
    "arka": {"tier": "critical", "area": "vault core"},
    "arka-factory": {"tier": "critical", "area": "factory and migrations"},
    "coverage-fund": {"tier": "critical", "area": "coverage reserves"},
    "claims-manager": {"tier": "critical", "area": "claims approvals"},
    "governance-executor": {"tier": "critical", "area": "queued execution"},
    "oracle-guard": {"tier": "high", "area": "oracle safety"},
    "arka-registry": {"tier": "high", "area": "discovery and indexing"},
    "adapter-aquarius": {"tier": "high", "area": "AMM adapter"},
    "adapter-soroswap": {"tier": "high", "area": "AMM adapter"},
    "adapter-blend": {"tier": "high", "area": "credit adapter"},
    "locked-arka": {"tier": "high", "area": "governance voting escrow"},
    "arka-token": {"tier": "high", "area": "governance token"},
    "manager-tier": {"tier": "medium", "area": "manager permissions"},
}

ACTIVE_ADAPTERS = ("adapter-aquarius", "adapter-soroswap", "adapter-blend")
ALLOW_UNAUTH_MUTATIONS = {"init"}
AUTH_PATTERNS = (
    ".require_auth(",
    ".require_auth();",
    ".require_auth_for_args(",
)
EXTERNAL_CALL_PATTERNS = (
    "invoke_contract(",
    "try_invoke_contract(",
)
STORAGE_MUTATION_PATTERNS = (
    ".storage().instance().set(",
    ".storage().persistent().set(",
    ".storage().temporary().set(",
    ".storage().instance().remove(",
    ".storage().persistent().remove(",
    ".storage().temporary().remove(",
    ".storage().instance().extend_ttl(",
    ".storage().persistent().extend_ttl(",
    ".storage().temporary().extend_ttl(",
)


@dataclass(slots=True)
class FunctionAudit:
    name: str
    line: int
    signature: str
    requires_auth: bool
    mutates_storage: bool
    invokes_external: bool
    external_symbols: list[str] = field(default_factory=list)
    emits_events: bool = False

    def to_dict(self) -> dict[str, Any]:
        return dataclasses.asdict(self)


@dataclass(slots=True)
class ParsedFunction:
    name: str
    line: int
    signature: str
    body: str
    is_public: bool
    requires_auth: bool = False
    mutates_storage: bool = False
    invokes_external: bool = False
    external_symbols: list[str] = field(default_factory=list)
    emits_events: bool = False
    called_functions: set[str] = field(default_factory=set)


@dataclass(slots=True)
class ContractAudit:
    crate: str
    source_path: str
    tier: str
    area: str
    functions: list[FunctionAudit]

    def to_dict(self) -> dict[str, Any]:
        payload = dataclasses.asdict(self)
        payload["summary"] = {
            "publicEntrypoints": len(self.functions),
            "privilegedEntrypoints": sum(1 for fn in self.functions if fn.requires_auth),
            "storageMutations": sum(1 for fn in self.functions if fn.mutates_storage),
            "externalCalls": sum(1 for fn in self.functions if fn.invokes_external),
        }
        return payload


@dataclass(slots=True)
class Finding:
    severity: str
    crate: str
    function: str
    line: int
    title: str
    detail: str

    def to_dict(self) -> dict[str, Any]:
        return dataclasses.asdict(self)


def iso_now() -> str:
    return dt.datetime.now(dt.timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def load_workspace_members(path: Path = WORKSPACE_MANIFEST) -> list[str]:
    payload = tomllib.loads(path.read_text())
    workspace = payload.get("workspace", {})
    members = workspace.get("members", [])
    return [str(member) for member in members]


def normalise_source(source: str) -> str:
    if "#[cfg(test)]" in source:
        source = source.split("#[cfg(test)]", 1)[0]
    return source


def skip_quoted(text: str, index: int, quote: str) -> int:
    index += 1
    while index < len(text):
        if text[index] == "\\":
            index += 2
            continue
        if text[index] == quote:
            return index + 1
        index += 1
    return index


def skip_line_comment(text: str, index: int) -> int:
    while index < len(text) and text[index] != "\n":
        index += 1
    return index


def skip_block_comment(text: str, index: int) -> int:
    depth = 1
    index += 2
    while index < len(text) and depth > 0:
        if text.startswith("/*", index):
            depth += 1
            index += 2
            continue
        if text.startswith("*/", index):
            depth -= 1
            index += 2
            continue
        index += 1
    return index


def find_matching_brace(text: str, open_index: int) -> int:
    depth = 0
    index = open_index
    while index < len(text):
        if text.startswith("//", index):
            index = skip_line_comment(text, index)
            continue
        if text.startswith("/*", index):
            index = skip_block_comment(text, index)
            continue
        if text[index] == '"':
            index = skip_quoted(text, index, '"')
            continue
        if text[index] == "'":
            index = skip_quoted(text, index, "'")
            continue
        if text[index] == "{":
            depth += 1
        elif text[index] == "}":
            depth -= 1
            if depth == 0:
                return index
        index += 1
    raise ValueError("unmatched brace while parsing Rust source")


def extract_functions(source: str) -> list[ParsedFunction]:
    functions: list[ParsedFunction] = []
    for match in re.finditer(r"(?m)^\s*(pub\s+)?fn\s+([A-Za-z0-9_]+)\s*\(", source):
        is_public = bool(match.group(1))
        name = match.group(2)
        line = source.count("\n", 0, match.start()) + 1
        brace_index = source.find("{", match.end())
        if brace_index == -1:
            continue
        close_index = find_matching_brace(source, brace_index)
        signature = " ".join(source[match.start():brace_index].split())
        body = source[brace_index:close_index + 1]
        functions.append(
            ParsedFunction(
                name=name,
                line=line,
                signature=signature,
                body=body,
                is_public=is_public,
            )
        )
    return functions


def extract_external_symbols(body: str) -> list[str]:
    symbols = set(re.findall(r'Symbol::new\([^,]+,\s*"([^"]+)"\)', body))
    symbols.update(re.findall(r'symbol_short!\("([^"]+)"\)', body))
    return sorted(symbols)


def local_calls(body: str, names: set[str], current: str) -> set[str]:
    calls: set[str] = set()
    for name in names:
        if name == current:
            continue
        if re.search(rf"\bSelf::{re.escape(name)}\s*\(", body) or re.search(rf"\b{re.escape(name)}\s*\(", body):
            calls.add(name)
    return calls


def collect_call_closure(
    functions: dict[str, ParsedFunction],
    root_name: str,
) -> set[str]:
    reachable: set[str] = set()
    stack = [root_name]
    while stack:
        name = stack.pop()
        if name in reachable:
            continue
        fn = functions.get(name)
        if fn is None:
            continue
        reachable.add(name)
        stack.extend(called for called in fn.called_functions if called not in reachable)
    return reachable


def resolve_effective(functions: dict[str, ParsedFunction], name: str, field_name: str) -> bool:
    reachable = collect_call_closure(functions, name)
    return any(bool(getattr(functions[reachable_name], field_name)) for reachable_name in reachable)


def analyze_contract(crate: str, source_path: Path) -> ContractAudit:
    scope = AUDIT_SCOPE.get(crate, {})
    tier = scope.get("tier", "inventory")
    area = scope.get("area", "workspace contract")
    source = normalise_source(source_path.read_text())
    parsed_functions = extract_functions(source)
    function_map: dict[str, ParsedFunction] = {fn.name: fn for fn in parsed_functions}
    names = set(function_map)
    for fn in parsed_functions:
        fn.requires_auth = any(pattern in fn.body for pattern in AUTH_PATTERNS)
        fn.mutates_storage = any(pattern in fn.body for pattern in STORAGE_MUTATION_PATTERNS)
        fn.invokes_external = any(pattern in fn.body for pattern in EXTERNAL_CALL_PATTERNS)
        fn.external_symbols = extract_external_symbols(fn.body)
        fn.emits_events = ".events().publish(" in fn.body
        fn.called_functions = local_calls(fn.body, names, fn.name)

    functions = []
    for fn in parsed_functions:
        if not fn.is_public:
            continue
        functions.append(
            FunctionAudit(
                name=fn.name,
                line=fn.line,
                signature=fn.signature,
                requires_auth=resolve_effective(function_map, fn.name, "requires_auth"),
                mutates_storage=resolve_effective(function_map, fn.name, "mutates_storage"),
                invokes_external=resolve_effective(function_map, fn.name, "invokes_external"),
                external_symbols=sorted(
                    {
                        symbol
                        for reachable_name in collect_call_closure(function_map, fn.name)
                        for symbol in function_map[reachable_name].external_symbols
                    }
                ),
                emits_events=resolve_effective(function_map, fn.name, "emits_events"),
            )
        )
    return ContractAudit(
        crate=crate,
        source_path=str(source_path),
        tier=tier,
        area=area,
        functions=functions,
    )


def build_findings(contracts: list[ContractAudit]) -> list[Finding]:
    findings: list[Finding] = []
    by_crate = {contract.crate: contract for contract in contracts}

    for crate in ACTIVE_ADAPTERS:
        contract = by_crate.get(crate)
        if contract is None:
            findings.append(
                Finding(
                    severity="high",
                    crate=crate,
                    function="*",
                    line=0,
                    title="Active adapter missing from audit scope",
                    detail="The active public adapter is not present in the workspace audit inventory.",
                )
            )
            continue
        execute_fn = next((fn for fn in contract.functions if fn.name == "execute"), None)
        if execute_fn is None:
            findings.append(
                Finding(
                    severity="high",
                    crate=crate,
                    function="execute",
                    line=0,
                    title="Adapter execute entrypoint missing",
                    detail="Active adapters must expose a unified execute entrypoint for router-driven vault execution.",
                )
            )
            continue
        if not execute_fn.requires_auth:
            findings.append(
                Finding(
                    severity="review",
                    crate=crate,
                    function="execute",
                    line=execute_fn.line,
                    title="Adapter execute lacks explicit auth",
                    detail=(
                        "The execute path on an active adapter does not expose a local explicit auth marker. "
                        "That may be intentional for contract-owned routing, but it deserves manual review."
                    ),
                )
            )
        if not execute_fn.invokes_external:
            findings.append(
                Finding(
                    severity="high",
                    crate=crate,
                    function="execute",
                    line=execute_fn.line,
                    title="Adapter execute never reaches external protocol",
                    detail="The active adapter execute path should route to an external protocol surface rather than acting as a local no-op.",
                )
            )

    for contract in contracts:
        for fn in contract.functions:
            if fn.name in ALLOW_UNAUTH_MUTATIONS:
                continue
            if (fn.mutates_storage or fn.invokes_external) and not fn.requires_auth and contract.tier in {"critical", "high"}:
                findings.append(
                    Finding(
                        severity="review",
                        crate=contract.crate,
                        function=fn.name,
                        line=fn.line,
                        title="Mutating or external entrypoint without explicit auth marker",
                        detail=(
                            "This entrypoint mutates storage or invokes another contract without a local "
                            "`require_auth` marker. It may still be safe, but it needs manual review."
                        ),
                    )
                )
    return findings


def generate_report(
    contracts_dir: Path = CONTRACTS_DIR,
    workspace_manifest: Path | None = None,
) -> dict[str, Any]:
    manifest_path = workspace_manifest or contracts_dir / "Cargo.toml"
    if not manifest_path.exists():
        manifest_path = WORKSPACE_MANIFEST
    members = load_workspace_members(manifest_path)
    audits: list[ContractAudit] = []
    missing_sources: list[str] = []
    for crate in members:
        source_path = contracts_dir / crate / "src" / "lib.rs"
        if source_path.exists():
            audits.append(analyze_contract(crate, source_path))
        else:
            missing_sources.append(crate)

    audits.sort(key=lambda item: (item.tier != "critical", item.crate))
    findings = build_findings(audits)
    summary = {
        "contractsAnalyzed": len(audits),
        "workspaceMembers": len(members),
        "publicEntrypoints": sum(len(contract.functions) for contract in audits),
        "privilegedEntrypoints": sum(1 for contract in audits for fn in contract.functions if fn.requires_auth),
        "externalCallEntrypoints": sum(1 for contract in audits for fn in contract.functions if fn.invokes_external),
        "highFindings": sum(1 for finding in findings if finding.severity == "high"),
        "reviewFindings": sum(1 for finding in findings if finding.severity == "review"),
        "missingSources": missing_sources,
    }
    return {
        "generatedAt": iso_now(),
        "rootDir": str(ROOT_DIR),
        "contractsDir": str(contracts_dir),
        "activePublicSurface": ["Aquarius", "SoroSwap", "Blend"],
        "auditedScope": AUDIT_SCOPE,
        "summary": summary,
        "contracts": [contract.to_dict() for contract in audits],
        "findings": [finding.to_dict() for finding in findings],
    }


def render_markdown(report: dict[str, Any]) -> str:
    lines = [
        "# Internal Security Audit",
        "",
        f"- Generated at: `{report['generatedAt']}`",
        f"- Contracts analyzed: `{report['summary']['contractsAnalyzed']}`",
        f"- Public entrypoints: `{report['summary']['publicEntrypoints']}`",
        f"- Privileged entrypoints: `{report['summary']['privilegedEntrypoints']}`",
        f"- External-call entrypoints: `{report['summary']['externalCallEntrypoints']}`",
        f"- High findings: `{report['summary']['highFindings']}`",
        f"- Review findings: `{report['summary']['reviewFindings']}`",
        "",
        "## Scope",
        "",
        "| Contract | Tier | Area | Public fns | Privileged | External calls |",
        "| --- | --- | --- | ---: | ---: | ---: |",
    ]
    for contract in report["contracts"]:
        summary = contract["summary"]
        lines.append(
            f"| `{contract['crate']}` | {contract['tier']} | {contract['area']} | "
            f"{summary['publicEntrypoints']} | {summary['privilegedEntrypoints']} | {summary['externalCalls']} |"
        )

    lines.extend(["", "## Findings", ""])
    if not report["findings"]:
        lines.append("- No findings.")
    else:
        for finding in report["findings"]:
            lines.append(
                f"- **{finding['severity'].upper()}** `{finding['crate']}::{finding['function']}` "
                f"(line {finding['line']}): {finding['title']}. {finding['detail']}"
            )
    lines.extend(["", "## Active Surface Check", ""])
    lines.append(
        "- The active public support surface expected by this audit is `Aquarius`, `SoroSwap`, and `Blend`."
    )
    lines.append(
        "- `Balanced`, `Comet`, and `Phoenix` remain outside the active validation matrix until reopened through a dedicated product block."
    )
    return "\n".join(lines) + "\n"


def write_outputs(report: dict[str, Any], json_path: Path, markdown_path: Path) -> None:
    json_path.parent.mkdir(parents=True, exist_ok=True)
    markdown_path.parent.mkdir(parents=True, exist_ok=True)
    json_path.write_text(json.dumps(report, indent=2) + "\n")
    markdown_path.write_text(render_markdown(report))


def parse_args(argv: list[str]) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Generate the internal security audit inventory for Arkafund contracts.")
    parser.add_argument("--contracts-dir", type=Path, default=CONTRACTS_DIR)
    parser.add_argument("--report-json", type=Path, default=DEFAULT_REPORT_JSON)
    parser.add_argument("--report-md", type=Path, default=DEFAULT_REPORT_MD)
    parser.add_argument(
        "--strict",
        action="store_true",
        help="Exit non-zero when high-severity findings are present.",
    )
    return parser.parse_args(argv)


def main(argv: list[str] | None = None) -> int:
    args = parse_args(argv or sys.argv[1:])
    report = generate_report(args.contracts_dir)
    write_outputs(report, args.report_json, args.report_md)
    high_findings = report["summary"]["highFindings"]
    if args.strict and high_findings:
        print(f"internal security audit failed with {high_findings} high findings", file=sys.stderr)
        return 1
    print(
        json.dumps(
            {
                "status": "passed" if high_findings == 0 else "review_required",
                "reportJson": str(args.report_json),
                "reportMarkdown": str(args.report_md),
                "highFindings": high_findings,
                "reviewFindings": report["summary"]["reviewFindings"],
            }
        )
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
