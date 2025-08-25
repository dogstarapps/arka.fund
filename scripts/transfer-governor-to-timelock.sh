#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
DEPLOYMENTS_JSON="$ROOT_DIR/deployments.${NETWORK:-testnet}.json"

if ! command -v soroban >/dev/null 2>&1; then
  echo "❌ soroban CLI not found."
  exit 1
fi

NETWORK_NAME="${NETWORK:-testnet}"
RPC_URL="${RPC_URL:-https://soroban-testnet.stellar.org}"
NETWORK_PASSPHRASE="${NETWORK_PASSPHRASE:-}"
ADMIN_SECRET="${ADMIN_SECRET:-}"
ADMIN_ADDRESS="${ADMIN_ADDRESS:-}"
TIMELOCK_ADDRESS="${TIMELOCK_ADDRESS:-}"

if [[ -z "$ADMIN_SECRET" || -z "$ADMIN_ADDRESS" || -z "$TIMELOCK_ADDRESS" ]]; then
  echo "❌ Set ADMIN_SECRET, ADMIN_ADDRESS and TIMELOCK_ADDRESS in environment."
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

echo "⏭️ Transferring factory governor to Timelock..."
stellar contract invoke \
  --id "$FACTORY_ID" \
  --source-account "$ADMIN_SECRET" \
  --rpc-url "$RPC_URL" \
  --network-passphrase "$NETWORK_PASSPHRASE" \
  -- set_governor \
  --governor "$TIMELOCK_ADDRESS"

echo "✅ Governor set to Timelock: $TIMELOCK_ADDRESS"

