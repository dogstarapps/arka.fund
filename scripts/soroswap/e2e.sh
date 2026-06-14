#!/usr/bin/env bash
set -euo pipefail

# SoroSwap end-to-end helper: add liquidity and perform a swap

ROOT_DIR="$(cd "$(dirname "$0")/../.." && pwd)"
DEPLOY_JSON="$ROOT_DIR/deployments.${NETWORK:-testnet}.json"
REBALANCE_JSON="${REBALANCE_JSON:-$ROOT_DIR/tmp/rebalance-live-validation.json}"
NETWORK_NAME="${NETWORK:-testnet}"
HOLDER_ALIAS="${HOLDER_ALIAS:-arka-holder}"

if [[ ! -f "$DEPLOY_JSON" ]]; then
  echo "❌ Deployments file not found: $DEPLOY_JSON" >&2; exit 1
fi

read_json() { jq -r "$1" "$DEPLOY_JSON"; }
read_optional_json() {
  local file_path="$1"
  local query="$2"
  [[ -f "$file_path" ]] || return 0
  jq -er "$query // empty" "$file_path" 2>/dev/null || true
}

ROUTER_ID="${ROUTER_ID_OVERRIDE:-$(read_optional_json "$REBALANCE_JSON" '.soroswapRouter')}"
FACTORY_ID="${FACTORY_ID_OVERRIDE:-$(read_optional_json "$REBALANCE_JSON" '.soroswapFactory')}"
TOKEN_A="${TOKEN_A_OVERRIDE:-$(read_optional_json "$REBALANCE_JSON" '.tokenIn')}"
TOKEN_B="${TOKEN_B_OVERRIDE:-$(read_optional_json "$REBALANCE_JSON" '.tokenOut')}"
HOLDER_PUB=$(stellar keys public-key "$HOLDER_ALIAS" | tr -d '\n')

ROUTER_ID="${ROUTER_ID:-$(read_json '.contracts.soroswapRouter')}"
FACTORY_ID="${FACTORY_ID:-$(read_json '.contracts.soroswapFactory')}"
TOKEN_A="${TOKEN_A:-$(read_json '.tokens.ARKA1')}"
TOKEN_B="${TOKEN_B:-$(read_json '.tokens.ARKA2')}"

echo "🌐 Network: $NETWORK_NAME"
echo "👤 Holder:  $HOLDER_ALIAS ($HOLDER_PUB)"
echo "🔗 SoroSwap Router:  $ROUTER_ID"
echo "🏭 SoroSwap Factory: $FACTORY_ID"
echo "🪙 Tokens:  ARKA1=$TOKEN_A  ARKA2=$TOKEN_B"

echo "💼 Approving allowances to router..."
stellar contract invoke --id "$TOKEN_A" --network "$NETWORK_NAME" --source-account "$HOLDER_ALIAS" --send yes -- approve \
  --owner "$HOLDER_PUB" --spender "$ROUTER_ID" --amount 10000000 >/dev/null
stellar contract invoke --id "$TOKEN_B" --network "$NETWORK_NAME" --source-account "$HOLDER_ALIAS" --send yes -- approve \
  --owner "$HOLDER_PUB" --spender "$ROUTER_ID" --amount 10000000 >/dev/null

echo "🏗️  Adding liquidity (may create pair if needed)..."
DEADLINE=$(($(date +%s)+1800))
stellar contract invoke --id "$ROUTER_ID" --network "$NETWORK_NAME" --source-account "$HOLDER_ALIAS" --send yes -- add_liquidity \
  --token_a "$TOKEN_A" --token_b "$TOKEN_B" \
  --amount_a_desired 5000 --amount_b_desired 5000 \
  --amount_a_min 0 --amount_b_min 0 \
  --to "$HOLDER_PUB" --deadline "$DEADLINE" >/dev/null || true

echo "🔁 Swap ARKA1→ARKA2 (exact-in 100)..."
stellar contract invoke --id "$ROUTER_ID" --network "$NETWORK_NAME" --source-account "$HOLDER_ALIAS" --send yes -- swap_exact_tokens_for_tokens \
  --amount_in 100 --amount_out_min 1 \
  --path "[\"$TOKEN_A\",\"$TOKEN_B\"]" \
  --to "$HOLDER_PUB" --deadline "$DEADLINE"

echo "✅ SoroSwap E2E completed"


