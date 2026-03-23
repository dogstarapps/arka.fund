#!/usr/bin/env bash
set -euo pipefail

# Admin-gated operations for SoroSwap adapter: set router and path

ROOT_DIR="$(cd "$(dirname "$0")/../.." && pwd)"
DEPLOY_JSON="$ROOT_DIR/deployments.${NETWORK:-testnet}.json"
NETWORK_NAME="${NETWORK:-testnet}"
ADMIN_ALIAS="${ADMIN_ALIAS:-arka-admin}"

if ! command -v stellar >/dev/null 2>&1; then
  echo "❌ 'stellar' CLI not found. Install from SDF CLI." >&2; exit 1
fi

read_json() { jq -r "$1" "$DEPLOY_JSON"; }

if [[ -z "${ADAPTER_ID:-}" ]]; then
  if [[ -f "$DEPLOY_JSON" ]]; then
    ADAPTER_ID="$(read_json '.contracts.adapterSoroswap // empty')"
  fi
fi

ROUTER_ID_DEFAULT=""
if [[ -f "$DEPLOY_JSON" ]]; then
  ROUTER_ID_DEFAULT="$(read_json '.contracts.soroswapRouter')"
fi

if [[ -z "${ROUTER_ID:-}" ]]; then
  ROUTER_ID="${ROUTER_ID_DEFAULT}"
fi

if [[ -z "$ADAPTER_ID" ]]; then
  echo "❌ Provide ADAPTER_ID env var or add .contracts.adapterSoroswap to $DEPLOY_JSON" >&2; exit 1
fi

if [[ -z "${TOKEN_A:-}" || -z "${TOKEN_B:-}" ]]; then
  if [[ -f "$DEPLOY_JSON" ]]; then
    TOKEN_A="${TOKEN_A:-$(read_json '.tokens.ARKA1')}"
    TOKEN_B="${TOKEN_B:-$(read_json '.tokens.ARKA2')}"
  fi
fi

if [[ -z "$ROUTER_ID" || -z "$TOKEN_A" || -z "$TOKEN_B" ]]; then
  echo "❌ Missing ROUTER_ID/TOKEN_A/TOKEN_B. Set env vars or ensure $DEPLOY_JSON has soroswapRouter and tokens." >&2; exit 1
fi

ADMIN_PUB="$(stellar keys public-key "$ADMIN_ALIAS" | tr -d '\n')"

echo "🌐 Network: $NETWORK_NAME"
echo "🧰 Adapter: $ADAPTER_ID"
echo "🔗 Router:  $ROUTER_ID"
printf "🪙 Path:    [%s,%s]\n" "$TOKEN_A" "$TOKEN_B"

echo "\n👤 Admin:   $ADMIN_ALIAS ($ADMIN_PUB)"

extract_hash() {
  # Grep a 64-hex hash from output
  grep -Eo '[A-Fa-f0-9]{64}' | tail -1 || true
}

invoke_and_capture() {
  local fn_name="$1"; shift
  set +e
  local out
  out=$(stellar contract invoke --id "$ADAPTER_ID" --network "$NETWORK_NAME" --source-account "$ADMIN_ALIAS" --send yes -- "$fn_name" "$@" 2>&1)
  local code=$?
  set -e
  echo "$out"
  if [[ $code -ne 0 ]]; then
    return $code
  fi
  echo "$out" | extract_hash
  return 0
}

# Try set_router; if not initialized, run init then retry
echo "🔧 Setting router on adapter..."
if ! set_hash_router=$(invoke_and_capture set_router --caller "$ADMIN_PUB" --router "$ROUTER_ID"); then
  echo "ℹ️  set_router failed, attempting init..."
  stellar contract invoke --id "$ADAPTER_ID" --network "$NETWORK_NAME" \
    --source-account "$ADMIN_ALIAS" --send yes -- init \
    --admin "$ADMIN_PUB" --router "$ROUTER_ID" --path "[\"$TOKEN_A\",\"$TOKEN_B\"]"
  echo "🔁 Retrying set_router..."
  set_hash_router=$(invoke_and_capture set_router --caller "$ADMIN_PUB" --router "$ROUTER_ID")
fi

echo "🛣️  Setting path on adapter..."
set_hash_path=$(invoke_and_capture set_path --caller "$ADMIN_PUB" --path "[\"$TOKEN_A\",\"$TOKEN_B\"]")

# Echo hashes in a parseable way
if [[ -n "$set_hash_router" ]]; then echo "TX set_router: $set_hash_router"; fi
if [[ -n "$set_hash_path" ]]; then echo "TX set_path: $set_hash_path"; fi

echo "✅ Adapter admin setup completed"


