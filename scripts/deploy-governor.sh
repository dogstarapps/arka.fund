#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
ARTIFACTS_DIR="$ROOT_DIR/artifacts"

if ! command -v soroban >/dev/null 2>&1; then
  echo "❌ soroban CLI not found."
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

deploy() {
  local wasm="$1"
  stellar contract deploy \
    --wasm "$ARTIFACTS_DIR/$wasm" \
    --source-account "$ADMIN_SECRET" \
    --rpc-url "$RPC_URL" \
    --network-passphrase "$NETWORK_PASSPHRASE" \
    --ignore-checks | tail -1
}

echo "🚀 Deploying Votes and Governor..."
VOTES_ID=$(deploy votes.wasm)
GOVERNOR_ID=$(deploy governor.wasm)

echo "🔗 Deployed:" 
echo "  votes:    $VOTES_ID"
echo "  governor: $GOVERNOR_ID"

echo "💾 Writing to $ROOT_DIR/deployments.$NETWORK_NAME.json"
jq \
  --arg votes "$VOTES_ID" \
  --arg governor "$GOVERNOR_ID" \
  '.contracts.votes=$votes | .contracts.governor=$governor' \
  "$ROOT_DIR/deployments.$NETWORK_NAME.json" > "$ROOT_DIR/deployments.$NETWORK_NAME.json.tmp"
mv "$ROOT_DIR/deployments.$NETWORK_NAME.json.tmp" "$ROOT_DIR/deployments.$NETWORK_NAME.json"

echo "✅ Done"


