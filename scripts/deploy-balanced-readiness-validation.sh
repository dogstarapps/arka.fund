#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
DEPLOY_JSON="${DEPLOY_JSON:-$ROOT_DIR/deployments.testnet.json}"
OUT_JSON="${OUT_JSON:-$ROOT_DIR/tmp/balanced-readiness-validation.json}"
NETWORK="${BALANCED_NETWORK:-testnet}"
NETWORK_PASSPHRASE="${BALANCED_NETWORK_PASSPHRASE:-Test SDF Network ; September 2015}"
RPC_URL="${BALANCED_RPC_URL:-https://soroban-testnet.stellar.org}"
SOURCE_ACCOUNT="${BALANCED_SOURCE_ACCOUNT:-arka-admin}"
POOL_ID="${BALANCED_POOL_ID:-1}"
EXPECTED_ROUTER="${BALANCED_EXPECTED_ROUTER:-}"

ARGS=(
  --deployments "$DEPLOY_JSON"
  --out-json "$OUT_JSON"
  --network "$NETWORK"
  --rpc-url "$RPC_URL"
  --network-passphrase "$NETWORK_PASSPHRASE"
  --source-account "$SOURCE_ACCOUNT"
  --pool-id "$POOL_ID"
  --update-deployments
)

if [[ -n "$EXPECTED_ROUTER" ]]; then
  ARGS+=(--expected-router "$EXPECTED_ROUTER")
fi

python3 "$ROOT_DIR/scripts/validate_balanced_readiness.py" "${ARGS[@]}"
