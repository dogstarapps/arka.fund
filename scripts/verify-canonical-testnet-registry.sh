#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
DEPLOY_JSON="${DEPLOY_JSON:-$ROOT_DIR/deployments.testnet.json}"
NETWORK_PASSPHRASE="${VALIDATION_NETWORK_PASSPHRASE:-Test SDF Network ; September 2015}"

python3 "$ROOT_DIR/scripts/canonical_testnet_registry.py" verify \
  --deployments "$DEPLOY_JSON" \
  --network-passphrase "$NETWORK_PASSPHRASE"
