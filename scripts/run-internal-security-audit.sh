#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"

python3 "$ROOT_DIR/scripts/internal_security_audit.py" \
  --contracts-dir "$ROOT_DIR/contracts" \
  --report-json "$ROOT_DIR/tmp/internal-security-audit.json" \
  --report-md "$ROOT_DIR/tmp/internal-security-audit.md" \
  --strict
