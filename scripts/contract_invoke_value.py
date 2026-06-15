#!/usr/bin/env python3
import ast
import json
import re
import subprocess
import sys
import time


def extract_json(raw: str):
    raw = raw.strip()
    if not raw:
        raise ValueError("empty output")

    candidates = [raw]
    lines = [line.strip() for line in raw.splitlines() if line.strip()]
    if lines:
        candidates.append(lines[-1])
        candidates.extend(lines)
    for candidate in list(candidates):
        if candidate.startswith('"') and candidate.endswith('"'):
            candidates.append(candidate[1:-1])
        if "{" in candidate and "}" in candidate:
            inner = candidate[candidate.find("{"):candidate.rfind("}") + 1]
            candidates.append(inner)
            candidates.append(re.sub(r'([A-Za-z_][A-Za-z0-9_]*)\s*:', r'"\1":', inner))

    for candidate in candidates:
        for parser in (
            lambda value: json.loads(value),
            lambda value: ast.literal_eval(value),
        ):
            try:
                parsed = parser(candidate)
            except Exception:
                continue
            if isinstance(parsed, (dict, list)):
                return parsed
            if isinstance(parsed, str):
                try:
                    reparsed = json.loads(parsed)
                except Exception:
                    continue
                if isinstance(reparsed, (dict, list)):
                    return reparsed

    raise ValueError("no structured json payload found")


def extract_scalar(raw: str) -> str:
    lines = [line.strip() for line in raw.splitlines() if line.strip()]
    for line in reversed(lines):
        if line.startswith("ℹ️") or line.startswith("Usage") or line.startswith("Options:"):
            continue
        return line.strip('"')
    raise ValueError("no scalar value found")


def main() -> int:
    if len(sys.argv) < 6:
        raise SystemExit(
            "usage: contract_invoke_value.py <contract_id> <source_account> <rpc_url> <network_passphrase> <fn_name> [args ...]"
        )

    contract_id, source_account, rpc_url, network_passphrase, fn_name = sys.argv[1:6]
    fn_args = sys.argv[6:]
    attempts = 10
    last_output = ""

    for _ in range(attempts):
        proc = subprocess.run(
            [
                "stellar",
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
                "--send=default",
                "--",
                fn_name,
                *fn_args,
            ],
            capture_output=True,
            text=True,
        )
        combined = "\n".join(part for part in (proc.stdout.strip(), proc.stderr.strip()) if part).strip()
        last_output = combined
        if proc.returncode == 0:
            try:
                structured = extract_json(combined)
            except ValueError:
                try:
                    print(extract_scalar(combined))
                    return 0
                except ValueError:
                    time.sleep(3)
                    continue
            else:
                print(json.dumps(structured))
                return 0
        time.sleep(3)

    print(last_output or "invoke produced no output", file=sys.stderr)
    return 1


if __name__ == "__main__":
    raise SystemExit(main())
