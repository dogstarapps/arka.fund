#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
ARTIFACTS_DIR="$ROOT_DIR/artifacts"

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

echo "🌐 Using network: $NETWORK_NAME ($RPC_URL)"

deploy_contract() {
  local wasm="$1"
  echo "  • Uploading $wasm"
  stellar contract deploy \
    --wasm "$ARTIFACTS_DIR/$wasm" \
    --source-account "$ADMIN_SECRET" \
    --rpc-url "$RPC_URL" \
    --network-passphrase "$NETWORK_PASSPHRASE" \
    --ignore-checks
}

echo "🚀 Deploying core contracts..."
ARKA_ID=$(deploy_contract arka.wasm | tail -1)
FACTORY_ID=$(deploy_contract arka-factory.wasm | tail -1)
ROUTER_ID=$(deploy_contract router.wasm | tail -1)

echo "🔗 Deployed IDs:"
echo "  ARKA: $ARKA_ID"
echo "  FACTORY: $FACTORY_ID"
echo "  ROUTER: $ROUTER_ID"

echo "💾 Writing to $ROOT_DIR/deployments.$NETWORK_NAME.json"
cat > "$ROOT_DIR/deployments.$NETWORK_NAME.json" <<JSON
{
  "network": "$NETWORK_NAME",
  "rpcUrl": "$RPC_URL",
  "contracts": {
    "arka": "$ARKA_ID",
    "arkaFactory": "$FACTORY_ID",
    "router": "$ROUTER_ID"
  }
}
JSON

echo "✅ Done"


