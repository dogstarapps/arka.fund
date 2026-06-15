#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
ARTIFACTS_DIR="$ROOT_DIR/artifacts"
DEPLOY_JSON="${DEPLOY_JSON:-$ROOT_DIR/deployments.${NETWORK:-testnet}.json}"
NETWORK_NAME="${NETWORK:-testnet}"
ADMIN_ALIAS="${ADMIN_ALIAS:-arka-admin}"
MANAGER_ALIAS="${MANAGER_ALIAS:-arka-holder}"

SOROSWAP_ROUTER_ID="${SOROSWAP_ROUTER_ID:-$(jq -r '.contracts.soroswapRouter' "$DEPLOY_JSON")}"
SOROSWAP_FACTORY_ID="${SOROSWAP_FACTORY_ID:-$(jq -r '.contracts.soroswapFactory' "$DEPLOY_JSON")}"
AQUARIUS_ROUTER_ID="${AQUARIUS_ROUTER_ID:-$(jq -r '.contracts.aquariusRouter' "$DEPLOY_JSON")}"

MINT_AMOUNT="${MINT_AMOUNT:-100000000000}"
LIQUIDITY_AMOUNT="${LIQUIDITY_AMOUNT:-5000000000}"
DEPOSIT_AMOUNT="${DEPOSIT_AMOUNT:-1000000000}"
VALIDATION_SWAP_AMOUNT="${VALIDATION_SWAP_AMOUNT:-1000000}"
APPROVAL_EXPIRATION_LEDGER="${APPROVAL_EXPIRATION_LEDGER:-999999999}"
SLEEP_AFTER_DEPLOY_SECONDS="${SLEEP_AFTER_DEPLOY_SECONDS:-2}"

if [[ ! -f "$DEPLOY_JSON" ]]; then
  echo "Missing deployments file: $DEPLOY_JSON" >&2
  exit 1
fi

ADMIN_PUB="$(stellar keys public-key "$ADMIN_ALIAS" | tr -d '\n')"
MANAGER_PUB="$(stellar keys public-key "$MANAGER_ALIAS" | tr -d '\n')"

deploy_contract() {
  local wasm_name="$1"
  stellar contract deploy \
    --wasm "$ARTIFACTS_DIR/$wasm_name" \
    --source-account "$ADMIN_ALIAS" \
    --network "$NETWORK_NAME" | tail -n1 | tr -d '\n'
}

invoke_admin() {
  local contract_id="$1"
  shift
  stellar contract invoke --id "$contract_id" --network "$NETWORK_NAME" \
    --source-account "$ADMIN_ALIAS" --send yes -- "$@"
}

invoke_manager() {
  local contract_id="$1"
  shift
  stellar contract invoke --id "$contract_id" --network "$NETWORK_NAME" \
    --source-account "$MANAGER_ALIAS" --send yes -- "$@"
}

token_approve() {
  local token_id="$1"
  local owner="$2"
  local spender="$3"
  local amount="$4"
  local source_alias="$5"
  stellar contract invoke --id "$token_id" --network "$NETWORK_NAME" \
    --source-account "$source_alias" --send yes -- approve \
    --owner "$owner" \
    --spender "$spender" \
    --amount "$amount" \
    --expiration_ledger "$APPROVAL_EXPIRATION_LEDGER" >/dev/null
}

parse_first_pool_key() {
  python3 -c 'import json,sys; data=json.loads(sys.stdin.read()); print(next(iter(data.keys()), "").strip("\""))'
}

echo "Network: $NETWORK_NAME"
echo "Admin:   $ADMIN_ALIAS ($ADMIN_PUB)"
echo "Manager: $MANAGER_ALIAS ($MANAGER_PUB)"

for artifact in test-token.wasm router.wasm arka.wasm adapter-soroswap.wasm adapter-aquarius.wasm; do
  if [[ ! -f "$ARTIFACTS_DIR/$artifact" ]]; then
    echo "Missing artifact $ARTIFACTS_DIR/$artifact. Run scripts/build-wasm.sh first." >&2
    exit 1
  fi
done

echo "1) Deploy tokens, router, Arka and AMM adapters"
TOKEN_A_ID="$(deploy_contract test-token.wasm)"
TOKEN_B_ID="$(deploy_contract test-token.wasm)"
ROUTER_ID="$(deploy_contract router.wasm)"
ARKA_ID="$(deploy_contract arka.wasm)"
SOROSWAP_ADAPTER_ID="$(deploy_contract adapter-soroswap.wasm)"
AQUARIUS_ADAPTER_ID="$(deploy_contract adapter-aquarius.wasm)"
sleep "$SLEEP_AFTER_DEPLOY_SECONDS"

echo "   TOKEN_A=$TOKEN_A_ID"
echo "   TOKEN_B=$TOKEN_B_ID"
echo "   ROUTER=$ROUTER_ID"
echo "   ARKA=$ARKA_ID"
echo "   SOROSWAP_ADAPTER=$SOROSWAP_ADAPTER_ID"
echo "   AQUARIUS_ADAPTER=$AQUARIUS_ADAPTER_ID"

echo "2) Init tokens and mint manager inventory"
invoke_admin "$TOKEN_A_ID" init --admin "$ADMIN_PUB" >/dev/null
invoke_admin "$TOKEN_B_ID" init --admin "$ADMIN_PUB" >/dev/null
invoke_admin "$TOKEN_A_ID" mint --to "$MANAGER_PUB" --amount "$MINT_AMOUNT" >/dev/null
invoke_admin "$TOKEN_B_ID" mint --to "$MANAGER_PUB" --amount "$MINT_AMOUNT" >/dev/null

echo "3) Init Arka and bind internal router"
invoke_admin "$ARKA_ID" init \
  --denomination_contract "$TOKEN_A_ID" \
  --mgmt_bps 0 \
  --perf_bps 0 \
  --deposit_bps 0 \
  --redeem_bps 0 \
  --whitelist_contracts "[\"$TOKEN_A_ID\",\"$TOKEN_B_ID\"]" \
  --manager "$MANAGER_PUB" >/dev/null
invoke_manager "$ARKA_ID" set_router --caller "$MANAGER_PUB" --router "$ROUTER_ID" >/dev/null
invoke_manager "$ARKA_ID" set_allowed_venues \
  --caller "$MANAGER_PUB" \
  --allowed_routers "[]" \
  --allowed_adapters "[\"$SOROSWAP_ADAPTER_ID\",\"$AQUARIUS_ADAPTER_ID\"]" >/dev/null
invoke_manager "$ARKA_ID" set_swap_risk_policy \
  --caller "$MANAGER_PUB" \
  --enabled true \
  --oracle_checks_enabled false \
  --max_price_impact_bps 1000 \
  --max_slippage_bps 1000 \
  --max_twap_deviation_bps 1000 \
  --max_oracle_age_seconds 600 \
  --max_trade_size_bps 10000 >/dev/null

echo "4) Init adapters"
invoke_admin "$SOROSWAP_ADAPTER_ID" init \
  --admin "$ADMIN_PUB" \
  --router "$SOROSWAP_ROUTER_ID" \
  --path "[\"$TOKEN_A_ID\",\"$TOKEN_B_ID\"]" >/dev/null
invoke_admin "$SOROSWAP_ADAPTER_ID" set_path_for_pool \
  --caller "$ADMIN_PUB" \
  --pool_id 1 \
  --path "[\"$TOKEN_A_ID\",\"$TOKEN_B_ID\"]" >/dev/null
invoke_admin "$AQUARIUS_ADAPTER_ID" init \
  --admin "$ADMIN_PUB" \
  --router "$AQUARIUS_ROUTER_ID" >/dev/null

echo "5) Create SoroSwap liquidity and verify quote"
token_approve "$TOKEN_A_ID" "$MANAGER_PUB" "$SOROSWAP_ROUTER_ID" "$LIQUIDITY_AMOUNT" "$MANAGER_ALIAS"
token_approve "$TOKEN_B_ID" "$MANAGER_PUB" "$SOROSWAP_ROUTER_ID" "$LIQUIDITY_AMOUNT" "$MANAGER_ALIAS"
SOROSWAP_DEADLINE="$(($(date +%s)+1800))"
stellar contract invoke --id "$SOROSWAP_ROUTER_ID" --network "$NETWORK_NAME" \
  --source-account "$MANAGER_ALIAS" --send yes -- add_liquidity \
  --token_a "$TOKEN_A_ID" \
  --token_b "$TOKEN_B_ID" \
  --amount_a_desired "$LIQUIDITY_AMOUNT" \
  --amount_b_desired "$LIQUIDITY_AMOUNT" \
  --amount_a_min 1 \
  --amount_b_min 1 \
  --to "$MANAGER_PUB" \
  --deadline "$SOROSWAP_DEADLINE" >/dev/null
SOROSWAP_QUOTE="$(stellar contract invoke --id "$SOROSWAP_ROUTER_ID" --network "$NETWORK_NAME" \
  --source-account "$MANAGER_ALIAS" -- router_get_amounts_out \
  --amount_in "$VALIDATION_SWAP_AMOUNT" \
  --path "[\"$TOKEN_A_ID\",\"$TOKEN_B_ID\"]" | tail -n1)"
echo "   SoroSwap quote: $SOROSWAP_QUOTE"

echo "6) Create Aquarius liquidity, configure adapter route and verify quote"
PAY_TOKEN="$(stellar contract invoke --id "$AQUARIUS_ROUTER_ID" --network "$NETWORK_NAME" --source-account "$MANAGER_ALIAS" -- get_init_pool_payment_token | tail -n1 | tr -d '"')"
PAY_ADDR="$(stellar contract invoke --id "$AQUARIUS_ROUTER_ID" --network "$NETWORK_NAME" --source-account "$MANAGER_ALIAS" -- get_init_pool_payment_address | tail -n1 | tr -d '"')"
PAY_AMOUNT="$(stellar contract invoke --id "$AQUARIUS_ROUTER_ID" --network "$NETWORK_NAME" --source-account "$MANAGER_ALIAS" -- get_standard_pool_payment_amount | tail -n1 | tr -d '"')"
set +e
PAY_BALANCE="$(stellar contract invoke --id "$PAY_TOKEN" --network "$NETWORK_NAME" --source-account "$MANAGER_ALIAS" -- balance --id "$MANAGER_PUB" 2>/dev/null | tail -n1 | tr -d '"')"
set -e
if [[ -z "$PAY_BALANCE" || "$PAY_BALANCE" == "0" || "$PAY_BALANCE" -lt "$PAY_AMOUNT" ]]; then
  XLM_ID="$(stellar contract id asset --asset native --network "$NETWORK_NAME" | tail -n1)"
  FEE_POOL_INDEX="$(stellar contract invoke --id "$AQUARIUS_ROUTER_ID" --network "$NETWORK_NAME" --source-account "$MANAGER_ALIAS" -- get_pools --tokens "[\"$XLM_ID\",\"$PAY_TOKEN\"]" | parse_first_pool_key)"
  if [[ -z "$FEE_POOL_INDEX" ]]; then
    echo "Aquarius XLM/payment-token pool not found; cannot pay pool-init fee." >&2
    exit 1
  fi
  stellar contract invoke --id "$XLM_ID" --network "$NETWORK_NAME" \
    --source-account "$MANAGER_ALIAS" --send yes -- approve \
    --from "$MANAGER_PUB" \
    --spender "$AQUARIUS_ROUTER_ID" \
    --amount 10000000 \
    --expiration_ledger "$APPROVAL_EXPIRATION_LEDGER" >/dev/null
  stellar contract invoke --id "$AQUARIUS_ROUTER_ID" --network "$NETWORK_NAME" \
    --source-account "$MANAGER_ALIAS" --send yes -- swap \
    --token_in "$XLM_ID" \
    --token_out "$PAY_TOKEN" \
    --in_amount 10000000 \
    --out_min 1 \
    --tokens "[\"$XLM_ID\",\"$PAY_TOKEN\"]" \
    --user "$MANAGER_PUB" \
    --pool_index "$FEE_POOL_INDEX" >/dev/null
fi
stellar contract invoke --id "$PAY_TOKEN" --network "$NETWORK_NAME" \
  --source-account "$MANAGER_ALIAS" --send yes -- transfer \
  --from "$MANAGER_PUB" \
  --to "$PAY_ADDR" \
  --amount "$PAY_AMOUNT" >/dev/null

SORTED_A="$TOKEN_A_ID"
SORTED_B="$TOKEN_B_ID"
if [[ "$TOKEN_A_ID" > "$TOKEN_B_ID" ]]; then
  SORTED_A="$TOKEN_B_ID"
  SORTED_B="$TOKEN_A_ID"
fi
stellar contract invoke --id "$AQUARIUS_ROUTER_ID" --network "$NETWORK_NAME" \
  --source-account "$MANAGER_ALIAS" --send yes -- init_standard_pool \
  --fee_fraction 30 \
  --user "$MANAGER_PUB" \
  --tokens "[\"$SORTED_A\",\"$SORTED_B\"]" >/dev/null || true
AQUARIUS_POOL_INDEX="$(stellar contract invoke --id "$AQUARIUS_ROUTER_ID" --network "$NETWORK_NAME" --source-account "$MANAGER_ALIAS" -- get_pools --tokens "[\"$SORTED_A\",\"$SORTED_B\"]" | parse_first_pool_key)"
if [[ -z "$AQUARIUS_POOL_INDEX" ]]; then
  echo "Aquarius pool index not found after init." >&2
  exit 1
fi
token_approve "$TOKEN_A_ID" "$MANAGER_PUB" "$AQUARIUS_ROUTER_ID" "$LIQUIDITY_AMOUNT" "$MANAGER_ALIAS"
token_approve "$TOKEN_B_ID" "$MANAGER_PUB" "$AQUARIUS_ROUTER_ID" "$LIQUIDITY_AMOUNT" "$MANAGER_ALIAS"
stellar contract invoke --id "$AQUARIUS_ROUTER_ID" --network "$NETWORK_NAME" \
  --source-account "$MANAGER_ALIAS" --send yes -- deposit \
  --tokens "[\"$SORTED_A\",\"$SORTED_B\"]" \
  --desired_amounts "[\"$LIQUIDITY_AMOUNT\",\"$LIQUIDITY_AMOUNT\"]" \
  --min_shares 1 \
  --user "$MANAGER_PUB" \
  --pool_index "$AQUARIUS_POOL_INDEX" >/dev/null
invoke_admin "$AQUARIUS_ADAPTER_ID" set_pool_route \
  --caller "$ADMIN_PUB" \
  --pool_id 1 \
  --token_in "$TOKEN_A_ID" \
  --token_out "$TOKEN_B_ID" \
  --tokens "[\"$SORTED_A\",\"$SORTED_B\"]" \
  --pool_index "$AQUARIUS_POOL_INDEX" >/dev/null
AQUARIUS_QUOTE="$(stellar contract invoke --id "$AQUARIUS_ROUTER_ID" --network "$NETWORK_NAME" \
  --source-account "$MANAGER_ALIAS" -- estimate_swap \
  --tokens "[\"$SORTED_A\",\"$SORTED_B\"]" \
  --token_in "$TOKEN_A_ID" \
  --token_out "$TOKEN_B_ID" \
  --pool_index "$AQUARIUS_POOL_INDEX" \
  --in_amount "$VALIDATION_SWAP_AMOUNT" | tail -n1)"
echo "   Aquarius pool: $AQUARIUS_POOL_INDEX"
echo "   Aquarius quote: $AQUARIUS_QUOTE"

echo "7) Fund Arka with vault-owned inventory"
token_approve "$TOKEN_A_ID" "$MANAGER_PUB" "$ARKA_ID" "$DEPOSIT_AMOUNT" "$MANAGER_ALIAS"
invoke_manager "$ARKA_ID" deposit \
  --user "$MANAGER_PUB" \
  --asset "{\"contract\":\"$TOKEN_A_ID\"}" \
  --amount "$DEPOSIT_AMOUNT" >/dev/null

echo "8) Write deployments manifest"
tmpfile="$(mktemp)"
jq \
  --arg arka "$ARKA_ID" \
  --arg router "$ROUTER_ID" \
  --arg token_a "$TOKEN_A_ID" \
  --arg token_b "$TOKEN_B_ID" \
  --arg soroswap_adapter "$SOROSWAP_ADAPTER_ID" \
  --arg aquarius_adapter "$AQUARIUS_ADAPTER_ID" \
  --arg aquarius_pool "$AQUARIUS_POOL_INDEX" \
  --arg soroswap_factory "$SOROSWAP_FACTORY_ID" \
  --arg manager "$MANAGER_PUB" \
  --arg deployed_at "$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
  '.contracts.arka=$arka
    | .contracts.router=$router
    | .contracts.adapterSoroswap=$soroswap_adapter
    | .contracts.adapterAquarius=$aquarius_adapter
    | .contracts.soroswapFactory=$soroswap_factory
    | .tokens.ARKA1=$token_a
    | .tokens.ARKA2=$token_b
    | .validations.ammTestnetRedeploy={
        deployedAt:$deployed_at,
        manager:$manager,
        arka:$arka,
        router:$router,
        adapterSoroswap:$soroswap_adapter,
        adapterAquarius:$aquarius_adapter,
        soroswapPoolId:1,
        aquariusPoolId:1,
        aquariusPoolIndex:$aquarius_pool
      }' "$DEPLOY_JSON" > "$tmpfile" && mv "$tmpfile" "$DEPLOY_JSON"

echo "Done."
echo "ARKA=$ARKA_ID"
echo "ROUTER=$ROUTER_ID"
echo "ARKA1=$TOKEN_A_ID"
echo "ARKA2=$TOKEN_B_ID"
echo "SOROSWAP_ADAPTER=$SOROSWAP_ADAPTER_ID"
echo "AQUARIUS_ADAPTER=$AQUARIUS_ADAPTER_ID"
echo "AQUARIUS_POOL_INDEX=$AQUARIUS_POOL_INDEX"
