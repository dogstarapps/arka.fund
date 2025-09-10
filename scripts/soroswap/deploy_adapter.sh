#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/../.." && pwd)"
ARTIFACTS_DIR="$ROOT_DIR/artifacts"
DEPLOY_JSON="$ROOT_DIR/deployments.${NETWORK:-testnet}.json"
NETWORK_NAME="${NETWORK:-testnet}"
ADMIN_ALIAS="${ADMIN_ALIAS:-arka-admin}"

if ! command -v stellar >/dev/null 2>&1; then
  echo "❌ 'stellar' CLI not found. Install from SDF CLI." >&2; exit 1
fi

if [[ ! -f "$ARTIFACTS_DIR/adapter-soroswap.wasm" ]]; then
  echo "🔨 Building adapter-soroswap WASM..." >&2
  "$ROOT_DIR/scripts/build-wasm.sh"
fi

read_json() { jq -r "$1" "$DEPLOY_JSON"; }

if [[ ! -f "$DEPLOY_JSON" ]]; then
  echo "❌ Deployments file not found: $DEPLOY_JSON" >&2; exit 1
fi

ROUTER_ID="$(read_json '.contracts.soroswapRouter')"
TOKEN_A="$(read_json '.tokens.ARKA1')"
TOKEN_B="$(read_json '.tokens.ARKA2')"
if [[ -z "$ROUTER_ID" || -z "$TOKEN_A" || -z "$TOKEN_B" || "$ROUTER_ID" == "null" ]]; then
  echo "❌ Missing router/tokens in $DEPLOY_JSON" >&2; exit 1
fi

echo "🌐 Network: $NETWORK_NAME"
echo "👤 Admin alias: $ADMIN_ALIAS"
echo "🔗 Router: $ROUTER_ID"
printf "🪙 Path: [%s,%s]\n" "$TOKEN_A" "$TOKEN_B"

echo "🚀 Deploying adapter-soroswap..."
ADAPTER_ID=$(stellar contract deploy \
  --wasm "$ARTIFACTS_DIR/adapter-soroswap.wasm" \
  --source-account "$ADMIN_ALIAS" \
  --network "$NETWORK_NAME" | tail -1 | tr -d '\n')

if [[ -z "$ADAPTER_ID" ]]; then
  echo "❌ Failed to deploy adapter" >&2; exit 1
fi

echo "🆔 Adapter ID: $ADAPTER_ID"

ADMIN_PUB="$(stellar keys public-key "$ADMIN_ALIAS" | tr -d '\n')"

echo "⚙️  Initializing adapter..."
INIT_OUT=$(stellar contract invoke --id "$ADAPTER_ID" --network "$NETWORK_NAME" \
  --source-account "$ADMIN_ALIAS" --send yes -- init \
  --admin "$ADMIN_PUB" \
  --router "$ROUTER_ID" \
  --path "[\"$TOKEN_A\",\"$TOKEN_B\"]" 2>&1)
INIT_HASH=$(echo "$INIT_OUT" | grep -Eo '[A-Fa-f0-9]{64}' | tail -1)

echo "🛠️  Setting path (idempotent)..."
SETPATH_OUT=$(stellar contract invoke --id "$ADAPTER_ID" --network "$NETWORK_NAME" \
  --source-account "$ADMIN_ALIAS" --send yes -- set_path \
  --caller "$ADMIN_PUB" \
  --path "[\"$TOKEN_A\",\"$TOKEN_B\"]" 2>&1)
SETPATH_HASH=$(echo "$SETPATH_OUT" | grep -Eo '[A-Fa-f0-9]{64}' | tail -1)

echo "💾 Updating $DEPLOY_JSON"
tmpfile=$(mktemp)
jq \
  --arg id "$ADAPTER_ID" \
  --arg init "$INIT_HASH" \
  --arg setpath "$SETPATH_HASH" \
  '.contracts.adapterSoroswap=$id | .txs.adapterSoroswap={init:$init,set_path:$setpath}' \
  "$DEPLOY_JSON" > "$tmpfile" && mv "$tmpfile" "$DEPLOY_JSON"

echo "✅ Done"
echo "Adapter ID: $ADAPTER_ID"
echo "TX init: ${INIT_HASH:-}"
echo "TX set_path: ${SETPATH_HASH:-}"


