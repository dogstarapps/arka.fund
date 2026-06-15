#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
DEPLOY_JSON="${DEPLOY_JSON:-$ROOT_DIR/deployments.testnet.json}"

python3 "$ROOT_DIR/scripts/canonical_testnet_registry.py" promote --deployments "$DEPLOY_JSON"
