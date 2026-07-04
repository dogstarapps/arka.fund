#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
NETWORK_PASSPHRASE="${REBALANCE_NETWORK_PASSPHRASE:-Test SDF Network ; September 2015}"
RPC_URL="${REBALANCE_RPC_URL:-https://soroban-testnet.stellar.org}"
NETWORK_NAME="${NETWORK_NAME:-testnet}"
MANAGER_IDENTITY="${MANAGER_IDENTITY:-arka-holder}"
ADMIN_IDENTITY="${ADMIN_IDENTITY:-arka-admin}"
AQUARIUS_ROUTER_ID="${AQUARIUS_ROUTER_ID:-CBCFTQSPDBAIZ6R6PJQKSQWKNKWH2QIV3I4J72SHWBIK3ADRRAM5A6GD}"
SOROSWAP_ROUTER_ID="${SOROSWAP_ROUTER_ID:-CCJUD55AG6W5HAI5LRVNKAE5WDP5XGZBUDS5WNTIVDU7O264UZZE7BRD}"
SOROSWAP_FACTORY_ID="${SOROSWAP_FACTORY_ID:-CDP3HMUH6SMS3S7NPGNDJLULCOXXEPSHY4JKUKMBNQMATHDHWXRRJTBY}"
ARKA_WASM_PATH="${ARKA_WASM_PATH:-$ROOT_DIR/artifacts/arka.wasm}"
TOKEN_WASM_PATH="${TOKEN_WASM_PATH:-$ROOT_DIR/artifacts/test-token.wasm}"
MINT_AMOUNT="${MINT_AMOUNT:-20000000}"
LIQUIDITY_AMOUNT="${LIQUIDITY_AMOUNT:-5000000}"
SWAP_AMOUNT="${SWAP_AMOUNT:-100000}"
OUT_JSON="${OUT_JSON:-$ROOT_DIR/tmp/rebalance-live-validation.json}"
APPROVAL_EXPIRATION_LEDGER="${APPROVAL_EXPIRATION_LEDGER:-3000000}"

mkdir -p "$(dirname "$OUT_JSON")"

if [[ ! -f "$ARKA_WASM_PATH" || ! -f "$TOKEN_WASM_PATH" ]]; then
  echo "ERROR: missing wasm artifacts. Expected $ARKA_WASM_PATH and $TOKEN_WASM_PATH" >&2
  exit 1
fi

ADMIN_SECRET="${ADMIN_SECRET:-$(stellar keys secret "$ADMIN_IDENTITY")}"
MANAGER_ADDR="${MANAGER_ADDR:-$(stellar keys address "$MANAGER_IDENTITY")}"
ADMIN_ADDR="${ADMIN_ADDR:-$(stellar keys address "$ADMIN_IDENTITY")}"

deploy_contract() {
  local wasm_path="$1"
  stellar contract deploy \
    --wasm "$wasm_path" \
    --source-account "$ADMIN_SECRET" \
    --rpc-url "$RPC_URL" \
    --network-passphrase "$NETWORK_PASSPHRASE" \
    --ignore-checks | tail -n1
}

invoke() {
  local contract_id="$1"
  shift
  stellar contract invoke \
    --id "$contract_id" \
    --source-account "$MANAGER_IDENTITY" \
    --rpc-url "$RPC_URL" \
    --network-passphrase "$NETWORK_PASSPHRASE" \
    "$@"
}

admin_invoke() {
  local contract_id="$1"
  shift
  stellar contract invoke \
    --id "$contract_id" \
    --source-account "$ADMIN_SECRET" \
    --rpc-url "$RPC_URL" \
    --network-passphrase "$NETWORK_PASSPHRASE" \
    "$@"
}

trim_quotes() {
  tr -d '"'
}

approve_token() {
  local token_id="$1"
  local spender="$2"
  local amount="$3"
  invoke \
    "$token_id" \
    --send=yes -- approve \
    --owner "$MANAGER_ADDR" \
    --spender "$spender" \
    --amount "$amount" \
    --expiration_ledger "$APPROVAL_EXPIRATION_LEDGER" >/dev/null
}

parse_first_pool_key() {
  python3 -c 'import json,sys; data=json.loads(sys.stdin.read()); print(next(iter(data.keys()), "").strip("\""))'
}

echo "1) Deploy live test tokens"
TOKEN_A="$(deploy_contract "$TOKEN_WASM_PATH")"
TOKEN_B="$(deploy_contract "$TOKEN_WASM_PATH")"
echo "   TOKEN_A=$TOKEN_A"
echo "   TOKEN_B=$TOKEN_B"

echo "2) Init token admins"
for token in "$TOKEN_A" "$TOKEN_B"; do
  admin_invoke \
    "$token" \
    --send=yes -- init --admin "$ADMIN_ADDR" >/dev/null
done

echo "3) Mint manager balances"
for token in "$TOKEN_A" "$TOKEN_B"; do
  admin_invoke \
    "$token" \
    --send=yes -- mint --to "$MANAGER_ADDR" --amount "$MINT_AMOUNT" >/dev/null
done

echo "4) Resolve Aquarius init-pool fee"
PAY_TOKEN="$(invoke "$AQUARIUS_ROUTER_ID" -- get_init_pool_payment_token | tail -n1 | trim_quotes)"
PAY_ADDR="$(invoke "$AQUARIUS_ROUTER_ID" -- get_init_pool_payment_address | tail -n1 | trim_quotes)"
PAY_AMOUNT="$(invoke "$AQUARIUS_ROUTER_ID" -- get_standard_pool_payment_amount | tail -n1 | trim_quotes)"
echo "   PAY_TOKEN=$PAY_TOKEN"
echo "   PAY_ADDR=$PAY_ADDR"
echo "   PAY_AMOUNT=$PAY_AMOUNT"

SYMBOL="$(invoke "$PAY_TOKEN" -- symbol | tail -n1 | trim_quotes || true)"
PAY_ADMIN="$(invoke "$PAY_TOKEN" -- admin | tail -n1 | trim_quotes || true)"
if [[ -n "$SYMBOL" && -n "$PAY_ADMIN" ]]; then
  stellar tx new change-trust \
    --source-account "$MANAGER_IDENTITY" \
    --network "$NETWORK_NAME" \
    --line "$SYMBOL:$PAY_ADMIN" >/dev/null || true
fi

echo "5) Acquire and pay Aquarius pool-init fee if needed"
set +e
PAY_BALANCE="$(invoke "$PAY_TOKEN" -- balance --id "$MANAGER_ADDR" 2>/dev/null | tail -n1 | trim_quotes)"
set -e
if [[ -z "$PAY_BALANCE" || "$PAY_BALANCE" == "0" || "$PAY_BALANCE" -lt "$PAY_AMOUNT" ]]; then
  XLM_ID="$(stellar contract id asset --asset native --network "$NETWORK_NAME" | tail -n1)"
  FEE_POOL_INDEX="$(
    invoke "$AQUARIUS_ROUTER_ID" -- get_pools --tokens "[\"$XLM_ID\",\"$PAY_TOKEN\"]" | parse_first_pool_key
  )"
  if [[ -z "$FEE_POOL_INDEX" ]]; then
    echo "ERROR: Aquarius XLM/payment-token pool not found" >&2
    exit 1
  fi
  stellar contract invoke \
    --id "$XLM_ID" \
    --source-account "$MANAGER_IDENTITY" \
    --rpc-url "$RPC_URL" \
    --network-passphrase "$NETWORK_PASSPHRASE" \
    --send=yes -- approve \
    --from "$MANAGER_ADDR" \
    --spender "$AQUARIUS_ROUTER_ID" \
    --amount 10000000 \
    --expiration_ledger 3000000 >/dev/null
  invoke \
    "$AQUARIUS_ROUTER_ID" \
    --send=yes -- swap \
    --token_in "$XLM_ID" \
    --token_out "$PAY_TOKEN" \
    --in_amount 10000000 \
    --out_min 1 \
    --tokens "[\"$XLM_ID\",\"$PAY_TOKEN\"]" \
    --user "$MANAGER_ADDR" \
    --pool_index "$FEE_POOL_INDEX" >/dev/null
fi
invoke \
  "$PAY_TOKEN" \
  --send=yes -- transfer \
  --from "$MANAGER_ADDR" \
  --to "$PAY_ADDR" \
  --amount "$PAY_AMOUNT" >/dev/null

echo "6) Create Aquarius pool and add liquidity"
SORTED_A="$TOKEN_A"
SORTED_B="$TOKEN_B"
if [[ "$TOKEN_A" > "$TOKEN_B" ]]; then
  SORTED_A="$TOKEN_B"
  SORTED_B="$TOKEN_A"
fi

invoke \
  "$AQUARIUS_ROUTER_ID" \
  --send=yes -- init_standard_pool \
  --fee_fraction 30 \
  --user "$MANAGER_ADDR" \
  --tokens "[\"$SORTED_A\",\"$SORTED_B\"]" >/dev/null || true

POOL_INDEX="$(
  invoke "$AQUARIUS_ROUTER_ID" -- get_pools --tokens "[\"$SORTED_A\",\"$SORTED_B\"]" | parse_first_pool_key
)"
if [[ -z "$POOL_INDEX" ]]; then
  echo "ERROR: Aquarius pool index not found for validation tokens" >&2
  exit 1
fi

for token in "$TOKEN_A" "$TOKEN_B"; do
  approve_token "$token" "$AQUARIUS_ROUTER_ID" "$LIQUIDITY_AMOUNT"
done

invoke \
  "$AQUARIUS_ROUTER_ID" \
  --send=yes -- deposit \
  --tokens "[\"$SORTED_A\",\"$SORTED_B\"]" \
  --desired_amounts "[\"$LIQUIDITY_AMOUNT\",\"$LIQUIDITY_AMOUNT\"]" \
  --min_shares 1 \
  --user "$MANAGER_ADDR" \
  --pool_index "$POOL_INDEX" >/dev/null

echo "7) Create SoroSwap pair and add liquidity"
for token in "$TOKEN_A" "$TOKEN_B"; do
  approve_token "$token" "$SOROSWAP_ROUTER_ID" "$LIQUIDITY_AMOUNT"
done

SOROSWAP_DEADLINE="$(($(date +%s)+1800))"
invoke \
  "$SOROSWAP_ROUTER_ID" \
  --send=yes -- add_liquidity \
  --token_a "$TOKEN_A" \
  --token_b "$TOKEN_B" \
  --amount_a_desired "$LIQUIDITY_AMOUNT" \
  --amount_b_desired "$LIQUIDITY_AMOUNT" \
  --amount_a_min 1 \
  --amount_b_min 1 \
  --to "$MANAGER_ADDR" \
  --deadline "$SOROSWAP_DEADLINE" >/dev/null

echo "8) Deploy and init Arka"
ARKA_ID="$(deploy_contract "$ARKA_WASM_PATH")"
WHITELIST_JSON="$(jq -cn --arg a "$TOKEN_A" --arg b "$TOKEN_B" '[$a, $b]')"
admin_invoke \
  "$ARKA_ID" \
  --send=yes -- init \
  --denomination_contract "$TOKEN_B" \
  --mgmt_bps 0 \
  --perf_bps 0 \
  --deposit_bps 0 \
  --redeem_bps 0 \
  --whitelist_contracts "$WHITELIST_JSON" \
  --manager "$MANAGER_ADDR" >/dev/null

invoke \
  "$TOKEN_B" \
  --send=yes -- approve \
  --owner "$MANAGER_ADDR" \
  --spender "$ARKA_ID" \
  --amount "$MINT_AMOUNT" \
  --expiration_ledger "$APPROVAL_EXPIRATION_LEDGER" >/dev/null

BEFORE_OUT_BALANCE="$(
  invoke "$ARKA_ID" -- liquid_balance --asset "$TOKEN_B" | tail -n1 | trim_quotes
)"
BEFORE_IN_BALANCE="$(
  invoke "$ARKA_ID" -- liquid_balance --asset "$TOKEN_A" | tail -n1 | trim_quotes
)"

echo "9) Execute Aquarius wallet swap + deposit-to-Arka flow"
approve_token "$TOKEN_A" "$AQUARIUS_ROUTER_ID" "$SWAP_AMOUNT"

WALLET_OUT_BEFORE="$(
  invoke "$TOKEN_B" -- balance --owner "$MANAGER_ADDR" | tail -n1 | trim_quotes
)"

invoke \
  "$AQUARIUS_ROUTER_ID" \
  --send=yes -- swap \
  --token_in "$TOKEN_A" \
  --token_out "$TOKEN_B" \
  --in_amount "$SWAP_AMOUNT" \
  --out_min 1 \
  --tokens "[\"$SORTED_A\",\"$SORTED_B\"]" \
  --user "$MANAGER_ADDR" \
  --pool_index "$POOL_INDEX" >/dev/null

WALLET_OUT_AFTER="$(
  invoke "$TOKEN_B" -- balance --owner "$MANAGER_ADDR" | tail -n1 | trim_quotes
)"
DELTA_OUT="$((WALLET_OUT_AFTER - WALLET_OUT_BEFORE))"
if (( DELTA_OUT <= 0 )); then
  echo "rebalance validation failed: Aquarius swap produced no token_out delta" >&2
  exit 1
fi

invoke \
  "$ARKA_ID" \
  --send=yes -- deposit \
  --user "$MANAGER_ADDR" \
  --asset "{\"contract\":\"$TOKEN_B\"}" \
  --amount "$DELTA_OUT" >/dev/null

AFTER_OUT_BALANCE="$(
  invoke "$ARKA_ID" -- liquid_balance --asset "$TOKEN_B" | tail -n1 | trim_quotes
)"
AFTER_IN_BALANCE="$(
  invoke "$ARKA_ID" -- liquid_balance --asset "$TOKEN_A" | tail -n1 | trim_quotes
)"

if (( AFTER_OUT_BALANCE <= BEFORE_OUT_BALANCE )); then
  echo "rebalance validation failed: arka token_out balance did not increase" >&2
  exit 1
fi

cat >"$OUT_JSON" <<JSON
{
  "arka": "$ARKA_ID",
  "manager": "$MANAGER_ADDR",
  "protocol": "AQUARIUS",
  "router": "$AQUARIUS_ROUTER_ID",
  "aquariusRouter": "$AQUARIUS_ROUTER_ID",
  "soroswapRouter": "$SOROSWAP_ROUTER_ID",
  "soroswapFactory": "$SOROSWAP_FACTORY_ID",
  "tokenIn": "$TOKEN_A",
  "tokenOut": "$TOKEN_B",
  "poolIndex": "$POOL_INDEX",
  "swapAmount": "$SWAP_AMOUNT",
  "walletOutDelta": "$DELTA_OUT",
  "beforeInputBalance": "$BEFORE_IN_BALANCE",
  "beforeOutputBalance": "$BEFORE_OUT_BALANCE",
  "afterInputBalance": "$AFTER_IN_BALANCE",
  "afterOutputBalance": "$AFTER_OUT_BALANCE"
}
JSON

echo "9) Wrote environment summary to $OUT_JSON"
