#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
DEPLOYMENTS="${DEPLOYMENTS:-$ROOT_DIR/deployments.testnet.json}"
OUT_JSON="${OUT_JSON:-$ROOT_DIR/tmp/balanced-canonical-cutover.json}"
READINESS_OUT_JSON="${READINESS_OUT_JSON:-$ROOT_DIR/tmp/balanced-readiness-validation.json}"
WASM_PATH="${BALANCED_WASM_PATH:-$ROOT_DIR/artifacts/adapter-balanced.wasm}"
NETWORK="${BALANCED_NETWORK:-testnet}"
RPC_URL="${BALANCED_RPC_URL:-https://soroban-testnet.stellar.org}"
NETWORK_PASSPHRASE="${BALANCED_NETWORK_PASSPHRASE:-Test SDF Network ; September 2015}"
SOURCE_ACCOUNT="${BALANCED_SOURCE_ACCOUNT:-arka-admin}"
ADMIN_ADDRESS="${BALANCED_ADMIN_ADDRESS:-}"
BALANCED_ROUTER="${BALANCED_ROUTER:-${BALANCED_EXPECTED_ROUTER:-}}"
POOL_ID="${BALANCED_POOL_ID:-1}"
ADAPTER_ID="${BALANCED_ADAPTER_ID:-}"

if [[ -z "$BALANCED_ROUTER" ]]; then
  echo "ERROR: set BALANCED_ROUTER or BALANCED_EXPECTED_ROUTER to the canonical Balanced router id." >&2
  exit 1
fi

ARGS=(
  "$ROOT_DIR/scripts/balanced_canonical_cutover.py"
  --deployments "$DEPLOYMENTS"
  --out-json "$OUT_JSON"
  --readiness-out-json "$READINESS_OUT_JSON"
  --wasm-path "$WASM_PATH"
  --network "$NETWORK"
  --rpc-url "$RPC_URL"
  --network-passphrase "$NETWORK_PASSPHRASE"
  --source-account "$SOURCE_ACCOUNT"
  --router "$BALANCED_ROUTER"
  --pool-id "$POOL_ID"
)

if [[ -n "$ADMIN_ADDRESS" ]]; then
  ARGS+=(--admin-address "$ADMIN_ADDRESS")
fi

if [[ -n "$ADAPTER_ID" ]]; then
  ARGS+=(--adapter-id "$ADAPTER_ID")
fi

python3 "${ARGS[@]}"
