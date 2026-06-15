#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/../.." && pwd)"
DEPLOY_JSON="${DEPLOY_JSON:-$ROOT_DIR/deployments.${NETWORK:-testnet}.json}"
NETWORK_NAME="${NETWORK:-testnet}"
ADMIN_ALIAS="${ADMIN_ALIAS:-arka-admin}"

POOL_ID="${POOL_ID:-1}"
PHOENIX_POOL="${PHOENIX_POOL:-}"
MAX_SPREAD_BPS="${MAX_SPREAD_BPS:-100}"
MAX_ALLOWED_FEE_BPS="${MAX_ALLOWED_FEE_BPS:-100}"
ENABLE_AUTO="${ENABLE_AUTO:-false}"

if ! command -v jq >/dev/null 2>&1; then
  echo "ERROR: jq is required" >&2
  exit 1
fi

if [[ ! -f "$DEPLOY_JSON" ]]; then
  echo "ERROR: deployments file not found: $DEPLOY_JSON" >&2
  exit 1
fi

read_json() { jq -r "$1" "$DEPLOY_JSON"; }

ADAPTER_ID="${PHOENIX_ADAPTER:-$(read_json '.contracts.adapterPhoenix // empty')}"
ARKA_ID="$(read_json '.contracts.arka // empty')"
SOROSWAP_ADAPTER="$(read_json '.contracts.adapterSoroswap // empty')"
AQUARIUS_ADAPTER="$(read_json '.contracts.adapterAquarius // empty')"
TOKEN_IN="${TOKEN_IN:-$(read_json '.tokens.ARKA1 // empty')}"
TOKEN_OUT="${TOKEN_OUT:-$(read_json '.tokens.ARKA2 // empty')}"

if [[ -z "$ADAPTER_ID" || "$ADAPTER_ID" == "null" ]]; then
  echo "ERROR: missing Phoenix adapter id. Set PHOENIX_ADAPTER or deployments.contracts.adapterPhoenix." >&2
  exit 1
fi
if [[ -z "$PHOENIX_POOL" ]]; then
  echo "ERROR: set PHOENIX_POOL to a real Phoenix pool contract id before configuring AUTO." >&2
  exit 1
fi
if [[ -z "$TOKEN_IN" || -z "$TOKEN_OUT" || "$TOKEN_IN" == "null" || "$TOKEN_OUT" == "null" ]]; then
  echo "ERROR: missing TOKEN_IN/TOKEN_OUT or deployments tokens." >&2
  exit 1
fi

ADMIN_PUB="$(stellar keys public-key "$ADMIN_ALIAS" | tr -d '\n')"

echo "Network: $NETWORK_NAME"
echo "Adapter: $ADAPTER_ID"
echo "Pool id: $POOL_ID"
echo "Phoenix pool: $PHOENIX_POOL"
echo "Route: $TOKEN_IN -> $TOKEN_OUT"

ROUTE_OUT="$(
  stellar contract invoke \
    --id "$ADAPTER_ID" \
    --network "$NETWORK_NAME" \
    --source-account "$ADMIN_ALIAS" \
    --send yes -- set_pool_route \
    --caller "$ADMIN_PUB" \
    --pool_id "$POOL_ID" \
    --pool "$PHOENIX_POOL" \
    --token_in "$TOKEN_IN" \
    --token_out "$TOKEN_OUT" \
    --max_spread_bps "$MAX_SPREAD_BPS" \
    --max_allowed_fee_bps "$MAX_ALLOWED_FEE_BPS" 2>&1
)"
printf '%s\n' "$ROUTE_OUT"
ROUTE_TX="$(printf '%s\n' "$ROUTE_OUT" | grep -Eo '[A-Fa-f0-9]{64}' | tail -1)"

stellar contract invoke \
  --id "$ADAPTER_ID" \
  --network "$NETWORK_NAME" \
  --source-account "$ADMIN_ALIAS" -- pool_route \
  --pool_id "$POOL_ID"

if [[ "$ENABLE_AUTO" == "true" ]]; then
  if [[ -z "$ARKA_ID" || -z "$SOROSWAP_ADAPTER" || -z "$AQUARIUS_ADAPTER" ]]; then
    echo "ERROR: cannot enable AUTO without Arka, SoroSwap and Aquarius adapter ids in deployments." >&2
    exit 1
  fi
  echo "Enabling Phoenix in Arka allowed_adapters..."
  stellar contract invoke \
    --id "$ARKA_ID" \
    --network "$NETWORK_NAME" \
    --source-account "$ADMIN_ALIAS" \
    --send yes -- set_allowed_venues \
    --caller "$ADMIN_PUB" \
    --allowed_routers "[]" \
    --allowed_adapters "[\"$SOROSWAP_ADAPTER\",\"$AQUARIUS_ADAPTER\",\"$ADAPTER_ID\"]"
fi

tmpfile="$(mktemp)"
jq \
  --arg pool "$PHOENIX_POOL" \
  --arg tx "$ROUTE_TX" \
  '.contracts.phoenixPool_ARKA1_ARKA2=$pool
   | .txs.adapterPhoenix = (.txs.adapterPhoenix // {})
   | .txs.adapterPhoenix.set_pool_route=$tx' \
  "$DEPLOY_JSON" > "$tmpfile" && mv "$tmpfile" "$DEPLOY_JSON"

echo "Done. Phoenix remains outside AUTO unless ENABLE_AUTO=true was used."
