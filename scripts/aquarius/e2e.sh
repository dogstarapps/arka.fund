#!/usr/bin/env bash
set -euo pipefail

# Aquarius end-to-end helper: fee → pool create → deposit → swap (and adapter swap)

ROOT_DIR="$(cd "$(dirname "$0")/../.." && pwd)"
DEPLOY_JSON="$ROOT_DIR/deployments.${NETWORK:-testnet}.json"
NETWORK_NAME="${NETWORK:-testnet}"
HOLDER_ALIAS="${HOLDER_ALIAS:-arka-holder}"

if [[ ! -f "$DEPLOY_JSON" ]]; then
  echo "❌ Deployments file not found: $DEPLOY_JSON" >&2; exit 1
fi

read_json() { jq -r "$1" "$DEPLOY_JSON"; }

ROUTER_ID=$(read_json '.contracts.aquariusRouter')
ADAPTER_ID=$(read_json '.contracts.adapterAquarius')
TOKEN_A=$(read_json '.tokens.ARKA1')
TOKEN_B=$(read_json '.tokens.ARKA2')
HOLDER_PUB=$(stellar keys public-key "$HOLDER_ALIAS" | tr -d '\n')

echo "🌐 Network: $NETWORK_NAME"
echo "👤 Holder:  $HOLDER_ALIAS ($HOLDER_PUB)"
echo "🔗 Router:  $ROUTER_ID"
echo "🧩 Adapter: $ADAPTER_ID"
echo "🪙 Tokens:  ARKA1=$TOKEN_A  ARKA2=$TOKEN_B"

echo "🔎 Fetching Aquarius pool-init payment info..."
PAY_TOKEN=$(stellar contract invoke --id "$ROUTER_ID" --network "$NETWORK_NAME" --source-account "$HOLDER_ALIAS" -- get_init_pool_payment_token | tail -1 | tr -d '"')
PAY_ADDR=$(stellar contract invoke --id "$ROUTER_ID" --network "$NETWORK_NAME" --source-account "$HOLDER_ALIAS" -- get_init_pool_payment_address | tail -1 | tr -d '"')
PAY_AMOUNT=$(stellar contract invoke --id "$ROUTER_ID" --network "$NETWORK_NAME" --source-account "$HOLDER_ALIAS" -- get_standard_pool_payment_amount | tail -1 | tr -d '"')
echo "   • pay_token=$PAY_TOKEN  pay_addr=$PAY_ADDR  amount=$PAY_AMOUNT"

echo "🔎 Ensuring classic trustline for AQUA wrapper..."
SYMBOL=$(stellar contract invoke --id "$PAY_TOKEN" --network "$NETWORK_NAME" --source-account "$HOLDER_ALIAS" -- symbol | tail -1 | tr -d '"')
ADMIN=$(stellar contract invoke --id "$PAY_TOKEN" --network "$NETWORK_NAME" --source-account "$HOLDER_ALIAS" -- admin | tail -1 | tr -d '"')
if [[ -n "$SYMBOL" && -n "$ADMIN" ]]; then
  stellar tx new change-trust --source-account "$HOLDER_ALIAS" --network "$NETWORK_NAME" --line "$SYMBOL:$ADMIN" >/dev/null
  echo "   • Trustline ensured for $SYMBOL:$ADMIN"
fi

echo "💳 Paying pool-init fee if needed..."
# Try a small balance read; if it fails we still attempt transfer
set +e
HAS_BAL=$(stellar contract invoke --id "$PAY_TOKEN" --network "$NETWORK_NAME" --source-account "$HOLDER_ALIAS" -- balance --id "$HOLDER_PUB" 2>/dev/null | tail -1 | tr -d '"')
set -e
if [[ -z "$HAS_BAL" || "$HAS_BAL" == "0" || "$HAS_BAL" -lt "$PAY_AMOUNT" ]]; then
  echo "   • Acquiring AQUA via XLM→AQUA swap (1 XLM)..."
  XLM_ID=$(stellar contract id asset --asset native --network "$NETWORK_NAME" | tail -1)
  # Discover pool index for XLM/AQUA
  POOL_INDEX=$(stellar contract invoke --id "$ROUTER_ID" --network "$NETWORK_NAME" --source-account "$HOLDER_ALIAS" -- get_pools --tokens "[\"$XLM_ID\",\"$PAY_TOKEN\"]" | python3 -c 'import sys,json; d=json.loads(sys.stdin.read()); print(list(d.keys())[0].strip("\""))')
  stellar contract invoke --id "$XLM_ID" --network "$NETWORK_NAME" --source-account "$HOLDER_ALIAS" --send yes -- approve \
    --from "$HOLDER_PUB" --spender "$ROUTER_ID" --amount 10000000 --expiration_ledger 3000000 >/dev/null
  stellar contract invoke --id "$ROUTER_ID" --network "$NETWORK_NAME" --source-account "$HOLDER_ALIAS" --send yes -- swap \
    --token_in "$XLM_ID" --token_out "$PAY_TOKEN" \
    --in_amount 10000000 --out_min 1 \
    --tokens "[\"$XLM_ID\",\"$PAY_TOKEN\"]" \
    --user "$HOLDER_PUB" --pool_index "$POOL_INDEX" >/dev/null
fi
stellar contract invoke --id "$PAY_TOKEN" --network "$NETWORK_NAME" --source-account "$HOLDER_ALIAS" --send yes -- transfer \
  --from "$HOLDER_PUB" --to "$PAY_ADDR" --amount "$PAY_AMOUNT" >/dev/null
echo "   • Fee paid"

echo "🏗️  Creating pool ARKA1/ARKA2 (sorted by address)..."
TOK_A_SORT="$TOKEN_A"
TOK_B_SORT="$TOKEN_B"
if [[ "$TOKEN_A" < "$TOKEN_B" ]]; then TOK_A_SORT="$TOKEN_A"; TOK_B_SORT="$TOKEN_B"; else TOK_A_SORT="$TOKEN_B"; TOK_B_SORT="$TOKEN_A"; fi
stellar contract invoke --id "$ROUTER_ID" --network "$NETWORK_NAME" --source-account "$HOLDER_ALIAS" --send yes -- init_standard_pool \
  --fee_fraction 30 --user "$HOLDER_PUB" --tokens "[\"$TOK_A_SORT\",\"$TOK_B_SORT\"]" >/dev/null || true

POOL_INDEX=$(stellar contract invoke --id "$ROUTER_ID" --network "$NETWORK_NAME" --source-account "$HOLDER_ALIAS" -- get_pools --tokens "[\"$TOK_A_SORT\",\"$TOK_B_SORT\"]" | python3 -c 'import sys,json; d=json.loads(sys.stdin.read()); print(list(d.keys())[0].strip("\""))')
echo "   • Pool index: $POOL_INDEX"

echo "💼 Approving allowances and depositing liquidity (5000/5000)..."
stellar contract invoke --id "$TOKEN_A" --network "$NETWORK_NAME" --source-account "$HOLDER_ALIAS" --send yes -- approve \
  --from "$HOLDER_PUB" --spender "$ROUTER_ID" --amount 5000 --expiration_ledger 3000000 >/dev/null
stellar contract invoke --id "$TOKEN_B" --network "$NETWORK_NAME" --source-account "$HOLDER_ALIAS" --send yes -- approve \
  --from "$HOLDER_PUB" --spender "$ROUTER_ID" --amount 5000 --expiration_ledger 3000000 >/dev/null
stellar contract invoke --id "$ROUTER_ID" --network "$NETWORK_NAME" --source-account "$HOLDER_ALIAS" --send yes -- deposit \
  --tokens "[\"$TOK_A_SORT\",\"$TOK_B_SORT\"]" \
  --desired_amounts "[\"5000\",\"5000\"]" \
  --min_shares 1 --user "$HOLDER_PUB" --pool_index "$POOL_INDEX" >/dev/null
echo "   • Liquidity added"

echo "🔁 Swap test via adapter (ARKA1→ARKA2, in=200, min_out=1)..."
stellar contract invoke --id "$ADAPTER_ID" --network "$NETWORK_NAME" --source-account "$HOLDER_ALIAS" --send yes -- init --admin "$HOLDER_PUB" --router "$ROUTER_ID" >/dev/null || true
stellar contract invoke --id "$ADAPTER_ID" --network "$NETWORK_NAME" --source-account "$HOLDER_ALIAS" --send yes -- swap_with_tokens \
  --caller "$HOLDER_PUB" --token_in "$TOKEN_A" --token_out "$TOKEN_B" \
  --tokens "[\"$TOK_A_SORT\",\"$TOK_B_SORT\"]" \
  --pool_index "$POOL_INDEX" --in_amount 200 --out_min 1 --receiver "$HOLDER_PUB"

echo "✅ Aquarius E2E completed"



