#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
ARTIFACTS_DIR="$ROOT_DIR/artifacts"
DEPLOYMENTS_JSON="$ROOT_DIR/deployments.${NETWORK:-testnet}.json"

if ! command -v soroban >/dev/null 2>&1; then
  echo "❌ soroban CLI not found. Install from Stellar docs."
  exit 1
fi

NETWORK_NAME="${NETWORK:-testnet}"
RPC_URL="${RPC_URL:-https://soroban-testnet.stellar.org}"
NETWORK_PASSPHRASE="${NETWORK_PASSPHRASE:-}"
ADMIN_SECRET="${ADMIN_SECRET:-}"
ADMIN_ADDRESS="${ADMIN_ADDRESS:-}"

if [[ -z "$ADMIN_SECRET" || -z "$ADMIN_ADDRESS" ]]; then
  echo "❌ Set ADMIN_SECRET and ADMIN_ADDRESS in environment."
  exit 1
fi

if [[ -z "$NETWORK_PASSPHRASE" ]]; then
  echo "❌ Set NETWORK_PASSPHRASE (e.g. Test SDF Network ; September 2015)."
  exit 1
fi

if [[ ! -f "$DEPLOYMENTS_JSON" ]]; then
  echo "❌ Deployments file not found: $DEPLOYMENTS_JSON"
  exit 1
fi

FACTORY_ID=$(jq -r '.contracts.arkaFactory' "$DEPLOYMENTS_JSON")
if [[ -z "$FACTORY_ID" || "$FACTORY_ID" == "null" ]]; then
  echo "❌ Factory ID not found in $DEPLOYMENTS_JSON"
  exit 1
fi

echo "🏭 Factory: $FACTORY_ID"

echo "📦 Installing Arka logic wasm to obtain hash..."
ARKA_WASM_HASH=$(stellar contract upload \
  --wasm "$ARTIFACTS_DIR/arka.wasm" \
  --source-account "$ADMIN_SECRET" \
  --rpc-url "$RPC_URL" \
  --network-passphrase "$NETWORK_PASSPHRASE" \
  | tail -1)

echo "🔐 Setting factory governor to admin (bootstrap)..."
stellar contract invoke \
  --id "$FACTORY_ID" \
  --source-account "$ADMIN_SECRET" \
  --rpc-url "$RPC_URL" \
  --network-passphrase "$NETWORK_PASSPHRASE" \
  -- set_governor \
  --governor "$ADMIN_ADDRESS"

echo "🧩 Setting implementation hash on factory..."
stellar contract invoke \
  --id "$FACTORY_ID" \
  --source-account "$ADMIN_SECRET" \
  --rpc-url "$RPC_URL" \
  --network-passphrase "$NETWORK_PASSPHRASE" \
  -- set_implementation \
  --impl_wasm_hash "$ARKA_WASM_HASH"

if [[ "${CREATE_FIRST_ARKA:-false}" == "true" ]]; then
  echo "🌱 Creating first Arka instance via factory..."
  SALT_HEX=$(openssl rand -hex 32)
  stellar contract invoke \
    --id "$FACTORY_ID" \
    --source-account "$ADMIN_SECRET" \
    --rpc-url "$RPC_URL" \
    --network-passphrase "$NETWORK_PASSPHRASE" \
    -- create_arka \
    --salt "$SALT_HEX"
fi

echo "✅ Factory initialized. Governor can later be moved to Timelock."

