#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
REPORT_PATH="${REPORT_PATH:-$ROOT_DIR/tmp/release-gate.json}"
DEPLOY_JSON="${DEPLOY_JSON:-$ROOT_DIR/deployments.testnet.json}"

python3 "$ROOT_DIR/scripts/release_gate.py" run \
  --deployments "$DEPLOY_JSON" \
  --report "$REPORT_PATH" \
  --update-deployments
