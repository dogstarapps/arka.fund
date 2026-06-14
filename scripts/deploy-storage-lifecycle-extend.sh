#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
DEPLOYMENTS="${DEPLOYMENTS:-$ROOT_DIR/deployments.testnet.json}"
OUT_JSON="${OUT_JSON:-$ROOT_DIR/tmp/storage-lifecycle-extend.json}"
NETWORK="${STORAGE_LIFECYCLE_NETWORK:-testnet}"
RPC_URL="${STORAGE_LIFECYCLE_RPC_URL:-https://soroban-testnet.stellar.org}"
NETWORK_PASSPHRASE="${STORAGE_LIFECYCLE_NETWORK_PASSPHRASE:-Test SDF Network ; September 2015}"
SOURCE_ACCOUNT="${STORAGE_LIFECYCLE_SOURCE_ACCOUNT:-arka-admin}"
LEDGERS_TO_EXTEND="${STORAGE_LIFECYCLE_LEDGERS_TO_EXTEND:-120960}"
INCLUDE_KEYS="${STORAGE_LIFECYCLE_INCLUDE_KEYS:-}"
EXCLUDE_KEYS="${STORAGE_LIFECYCLE_EXCLUDE_KEYS:-}"
DRY_RUN="${STORAGE_LIFECYCLE_DRY_RUN:-false}"
STRICT="${STORAGE_LIFECYCLE_STRICT:-true}"
UPDATE_DEPLOYMENTS="${STORAGE_LIFECYCLE_UPDATE_DEPLOYMENTS:-true}"

ARGS=(
  "$ROOT_DIR/scripts/storage_lifecycle_extend.py"
  --deployments "$DEPLOYMENTS"
  --out-json "$OUT_JSON"
  --network "$NETWORK"
  --rpc-url "$RPC_URL"
  --network-passphrase "$NETWORK_PASSPHRASE"
  --source-account "$SOURCE_ACCOUNT"
  --ledgers-to-extend "$LEDGERS_TO_EXTEND"
)

if [[ -n "$INCLUDE_KEYS" ]]; then
  ARGS+=(--include-contract-keys "$INCLUDE_KEYS")
fi
if [[ -n "$EXCLUDE_KEYS" ]]; then
  ARGS+=(--exclude-contract-keys "$EXCLUDE_KEYS")
fi
if [[ "$DRY_RUN" == "true" ]]; then
  ARGS+=(--dry-run)
fi
if [[ "$STRICT" == "true" ]]; then
  ARGS+=(--strict)
fi
if [[ "$UPDATE_DEPLOYMENTS" == "true" ]]; then
  ARGS+=(--update-deployments)
fi

python3 "${ARGS[@]}"
