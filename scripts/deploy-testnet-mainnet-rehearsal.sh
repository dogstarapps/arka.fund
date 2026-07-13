#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
MAINNET_MANIFEST="${MAINNET_MANIFEST:-$ROOT_DIR/deployments.mainnet.json}"
DEPLOY_JSON="${DEPLOY_JSON:-$ROOT_DIR/tmp/mainnet-rehearsal-testnet.json}"
NETWORK_NAME="${NETWORK_NAME:-testnet}"
ADMIN_ALIAS="${ADMIN_ALIAS:-arka-admin}"
MANAGER_ALIAS="${MANAGER_ALIAS:-arka-holder}"
TREASURY_ALIAS="${TREASURY_ALIAS:?Set TREASURY_ALIAS to a Stellar CLI identity}"
CREATE_FEE_AMOUNT="${CREATE_FEE_AMOUNT:-100000000}"
MANAGER_MINT_AMOUNT="${MANAGER_MINT_AMOUNT:-500000000}"
VALIDATION_DEPOSIT_AMOUNT="${VALIDATION_DEPOSIT_AMOUNT:-1000000}"
VALIDATION_REDEEM_SHARES="${VALIDATION_REDEEM_SHARES:-50000}"
VALIDATION_REBALANCE_AMOUNT="${VALIDATION_REBALANCE_AMOUNT:-100000}"
VALIDATION_MIN_OUT="${VALIDATION_MIN_OUT:-99000}"
APPROVAL_EXPIRATION_LEDGER="${APPROVAL_EXPIRATION_LEDGER:-999999999}"

if [[ "$NETWORK_NAME" != "testnet" ]]; then
  echo "Refusing rehearsal outside testnet. NETWORK_NAME must be testnet." >&2
  exit 1
fi

if [[ ! -f "$MAINNET_MANIFEST" ]]; then
  echo "Missing mainnet manifest: $MAINNET_MANIFEST" >&2
  exit 1
fi

mkdir -p "$(dirname "$DEPLOY_JSON")"
WORK_DIR="$(mktemp -d "${TMPDIR:-/tmp}/arka-mainnet-rehearsal.XXXXXX")"
HASH_TSV="$WORK_DIR/hashes.tsv"
CONTRACT_TSV="$WORK_DIR/contracts.tsv"
CHECK_TSV="$WORK_DIR/checks.tsv"
UPGRADE_TSV="$WORK_DIR/upgrades.tsv"
: >"$HASH_TSV"
: >"$CONTRACT_TSV"
: >"$CHECK_TSV"
: >"$UPGRADE_TSV"

ADMIN_ADDR="$(stellar keys address "$ADMIN_ALIAS")"
MANAGER_ADDR="$(stellar keys address "$MANAGER_ALIAS")"
TREASURY_ADDR="$(stellar keys address "$TREASURY_ALIAS")"
ADMIN_ADDR_JSON="\"$ADMIN_ADDR\""
TREASURY_ADDR_JSON="\"$TREASURY_ADDR\""
EXPIRY="$(python3 - <<'PY'
import time
print(int(time.time()) + 365 * 24 * 60 * 60)
PY
)"

record_check() {
  printf '%s\t%s\n' "$1" "$2" >>"$CHECK_TSV"
}

record_contract() {
  printf '%s\t%s\t%s\n' "$1" "$2" "$3" >>"$CONTRACT_TSV"
}

record_upgrade() {
  printf '%s\t%s\t%s\n' "$1" "$2" "$3" >>"$UPGRADE_TSV"
}

retry() {
  local attempt=1
  local max_attempts="${RETRY_ATTEMPTS:-5}"
  local delay="${RETRY_DELAY_SECONDS:-4}"
  while true; do
    if "$@"; then
      return 0
    fi
    if [[ "$attempt" -ge "$max_attempts" ]]; then
      return 1
    fi
    attempt="$((attempt + 1))"
    sleep "$delay"
  done
}

stellar_send() {
  stellar contract invoke \
    --id "$1" \
    --source-account "$2" \
    --network "$NETWORK_NAME" \
    --send yes \
    -- "${@:3}"
}

stellar_view() {
  stellar contract invoke \
    --id "$1" \
    --source-account "$2" \
    --network "$NETWORK_NAME" \
    --send no \
    -- "${@:3}"
}

deploy_by_hash() {
  local name="$1"
  local artifact="$2"
  local hash="$3"
  local id
  echo "  deploy $name"
  id="$(
    stellar contract deploy \
      --wasm-hash "$hash" \
      --source-account "$ADMIN_ALIAS" \
      --network "$NETWORK_NAME" \
      | tail -n1 \
      | tr -d '"'
  )"
  if [[ ! "$id" =~ ^C[A-Z2-7]{55}$ ]]; then
    echo "Deploy did not return a contract id for $name: $id" >&2
    exit 1
  fi
  record_contract "$name" "$id" "$artifact"
}

contract_id() {
  awk -F'\t' -v key="$1" '$1 == key {print $2}' "$CONTRACT_TSV" | tail -n1
}

artifact_hash() {
  awk -F'\t' -v artifact="$1" '$1 == artifact {print $2}' "$HASH_TSV" | tail -n1
}

contract_hash() {
  local name="$1"
  local artifact
  artifact="$(awk -F'\t' -v key="$name" '$1 == key {print $3}' "$CONTRACT_TSV" | tail -n1)"
  artifact_hash "$artifact"
}

set_expiry() {
  local contract="$1"
  retry stellar_send "$contract" "$ADMIN_ALIAS" set_bootstrap_admin_expiry \
    --caller "$ADMIN_ADDR" \
    --expires_at "$EXPIRY" >/dev/null
}

set_governor_option() {
  local contract="$1"
  retry stellar_send "$contract" "$ADMIN_ALIAS" set_governor \
    --caller "$ADMIN_ADDR" \
    --governor "$ADMIN_ADDR_JSON" >/dev/null
}

set_governor_plain() {
  local contract="$1"
  retry stellar_send "$contract" "$ADMIN_ALIAS" set_governor \
    --caller "$ADMIN_ADDR" \
    --governor "$ADMIN_ADDR" >/dev/null
}

latest_ledger_close_time() {
  local rpc_url
  rpc_url="$(stellar network inspect "$NETWORK_NAME" 2>/dev/null | awk -F': ' '/RPC URL/ {print $2; exit}')"
  if [[ -z "$rpc_url" ]]; then
    rpc_url="https://soroban-testnet.stellar.org"
  fi
  curl -s -X POST "$rpc_url" \
    -H 'content-type: application/json' \
    -d '{"jsonrpc":"2.0","id":1,"method":"getLatestLedger"}' \
    | python3 -c 'import json,sys; print(int(json.load(sys.stdin).get("result",{}).get("closeTime",0)))'
}

echo "Rehearsal network: $NETWORK_NAME"
echo "Admin:   $ADMIN_ALIAS ($ADMIN_ADDR)"
echo "Manager: $MANAGER_ALIAS ($MANAGER_ADDR)"

stellar keys fund "$ADMIN_ALIAS" --network "$NETWORK_NAME" >/dev/null 2>&1 || true
stellar keys fund "$MANAGER_ALIAS" --network "$NETWORK_NAME" >/dev/null 2>&1 || true
stellar keys fund "$TREASURY_ALIAS" --network "$NETWORK_NAME" >/dev/null 2>&1 || true

if [[ "${SKIP_BUILD:-false}" != "true" ]]; then
  BUILD_CONTRACT_SET=production bash "$ROOT_DIR/scripts/build-wasm.sh" >/dev/null
  BUILD_CONTRACT_SET=test bash "$ROOT_DIR/scripts/build-wasm.sh" >/dev/null
fi
record_check "build" "ok"

echo "Uploading production and rehearsal helper WASM..."
while IFS= read -r artifact; do
  [[ -n "$artifact" ]] || continue
  wasm_path="$ROOT_DIR/$artifact"
  if [[ ! -f "$wasm_path" ]]; then
    echo "Missing artifact: $artifact" >&2
    exit 1
  fi
  echo "  upload $artifact"
  hash="$(
    stellar contract upload \
      --wasm "$wasm_path" \
      --source-account "$ADMIN_ALIAS" \
      --network "$NETWORK_NAME" \
      --ignore-checks \
      | tail -n1 \
      | tr -d '"'
  )"
  if [[ ! "$hash" =~ ^[0-9a-fA-F]{64}$ ]]; then
    echo "Upload did not return a wasm hash for $artifact: $hash" >&2
    exit 1
  fi
  printf '%s\t%s\n' "$artifact" "$hash" >>"$HASH_TSV"
done < <(
  {
    jq -r '.deploymentPlan.contracts[].artifact' "$MAINNET_MANIFEST"
    printf '%s\n' \
      "artifacts/test-token.wasm" \
      "artifacts/test-oracle.wasm" \
      "artifacts/test-profit-adapter.wasm"
  } | sort -u
)
record_check "upload" "ok"

echo "Deploying planned production instances..."
while IFS=$'\t' read -r name artifact; do
  deploy_by_hash "$name" "$artifact" "$(artifact_hash "$artifact")"
done < <(jq -r '.deploymentPlan.contracts[] | select(.deploy == true) | [.name, .artifact] | @tsv' "$MAINNET_MANIFEST")

echo "Deploying rehearsal helper contracts..."
deploy_by_hash "testUsdc" "artifacts/test-token.wasm" "$(artifact_hash "artifacts/test-token.wasm")"
deploy_by_hash "testXlm" "artifacts/test-token.wasm" "$(artifact_hash "artifacts/test-token.wasm")"
deploy_by_hash "testOraclePrimary" "artifacts/test-oracle.wasm" "$(artifact_hash "artifacts/test-oracle.wasm")"
deploy_by_hash "testOracleSecondary" "artifacts/test-oracle.wasm" "$(artifact_hash "artifacts/test-oracle.wasm")"
deploy_by_hash "testProfitAdapter" "artifacts/test-profit-adapter.wasm" "$(artifact_hash "artifacts/test-profit-adapter.wasm")"
record_check "deploy" "ok"

ARKA_FACTORY="$(contract_id arkaFactory)"
ARKA_REGISTRY="$(contract_id arkaRegistry)"
ROUTER="$(contract_id router)"
VENUE_REGISTRY="$(contract_id venueRegistry)"
ADAPTER_AQUARIUS="$(contract_id adapterAquarius)"
ADAPTER_SOROSWAP="$(contract_id adapterSoroswap)"
ADAPTER_PHOENIX="$(contract_id adapterPhoenix)"
ADAPTER_BLEND_FIXED="$(contract_id adapterBlendFixedXlmUsdc)"
ADAPTER_BLEND_YIELDBLOX="$(contract_id adapterBlendYieldBlox)"
ORACLE_GUARD="$(contract_id oracleGuard)"
COVERAGE_FUND="$(contract_id coverageFund)"
CLAIMS_MANAGER="$(contract_id claimsManager)"
MANAGER_TIER="$(contract_id managerTier)"
ARKA_TOKEN="$(contract_id arkaToken)"
LOCKED_ARKA="$(contract_id lockedArka)"
GOVERNANCE_TOKEN="$(contract_id governanceToken)"
GOVERNANCE_EXECUTOR="$(contract_id governanceExecutor)"
ARKA_VESTING="$(contract_id arkaVesting)"
EMISSIONS_CONTROLLER="$(contract_id emissionsController)"
TEST_USDC="$(contract_id testUsdc)"
TEST_XLM="$(contract_id testXlm)"
TEST_ORACLE_PRIMARY="$(contract_id testOraclePrimary)"
TEST_ORACLE_SECONDARY="$(contract_id testOracleSecondary)"
TEST_PROFIT_ADAPTER="$(contract_id testProfitAdapter)"

SOROSWAP_ROUTER="$(jq -r '.contracts.soroswapRouter // empty' "$ROOT_DIR/deployments.testnet.json")"
AQUARIUS_ROUTER="$(jq -r '.contracts.aquariusRouter // empty' "$ROOT_DIR/deployments.testnet.json")"
if [[ ! "$SOROSWAP_ROUTER" =~ ^C[A-Z2-7]{55}$ ]]; then
  SOROSWAP_ROUTER="$ROUTER"
fi
if [[ ! "$AQUARIUS_ROUTER" =~ ^C[A-Z2-7]{55}$ ]]; then
  AQUARIUS_ROUTER="$ROUTER"
fi

echo "Initializing rehearsal helper contracts..."
retry stellar_send "$TEST_USDC" "$ADMIN_ALIAS" init --admin "$ADMIN_ADDR" >/dev/null
retry stellar_send "$TEST_XLM" "$ADMIN_ALIAS" init --admin "$ADMIN_ADDR" >/dev/null
retry stellar_send "$TEST_USDC" "$ADMIN_ALIAS" mint --to "$MANAGER_ADDR" --amount "$MANAGER_MINT_AMOUNT" >/dev/null
retry stellar_send "$TEST_XLM" "$ADMIN_ALIAS" mint --to "$TEST_PROFIT_ADAPTER" --amount "$MANAGER_MINT_AMOUNT" >/dev/null
retry stellar_send "$TEST_ORACLE_PRIMARY" "$ADMIN_ALIAS" init --admin "$ADMIN_ADDR" >/dev/null
retry stellar_send "$TEST_ORACLE_SECONDARY" "$ADMIN_ALIAS" init --admin "$ADMIN_ADDR" >/dev/null
retry stellar_send "$TEST_PROFIT_ADAPTER" "$ADMIN_ALIAS" init \
  --admin "$ADMIN_ADDR" \
  --router "$ROUTER" \
  --profit_token "$TEST_XLM" \
  --default_bonus 0 >/dev/null

NOW_TS="$(latest_ledger_close_time)"
for oracle in "$TEST_ORACLE_PRIMARY" "$TEST_ORACLE_SECONDARY"; do
  retry stellar_send "$oracle" "$ADMIN_ALIAS" set_stellar_price \
    --caller "$ADMIN_ADDR" \
    --asset "$TEST_USDC" \
    --price 10000000 \
    --timestamp "$NOW_TS" >/dev/null
  retry stellar_send "$oracle" "$ADMIN_ALIAS" set_stellar_price \
    --caller "$ADMIN_ADDR" \
    --asset "$TEST_XLM" \
    --price 10000000 \
    --timestamp "$NOW_TS" >/dev/null
done
record_check "helpersInitialized" "ok"

echo "Configuring production stack on testnet..."
retry stellar_send "$ARKA_REGISTRY" "$ADMIN_ALIAS" init_admin --admin "$ADMIN_ADDR" >/dev/null
retry stellar_send "$ARKA_REGISTRY" "$ADMIN_ALIAS" set_bootstrap_admin_expiry --caller "$ADMIN_ADDR" --expires_at "$EXPIRY" >/dev/null
retry stellar_send "$ROUTER" "$ADMIN_ALIAS" init_upgrade_authority --admin "$ADMIN_ADDR" --governor "$ADMIN_ADDR_JSON" --expires_at "$EXPIRY" >/dev/null
retry stellar_send "$VENUE_REGISTRY" "$ADMIN_ALIAS" init --admin "$ADMIN_ADDR" --governor "$ADMIN_ADDR_JSON" --expires_at "$EXPIRY" >/dev/null
retry stellar_send "$VENUE_REGISTRY" "$ADMIN_ALIAS" set_guardian --caller "$ADMIN_ADDR" --guardian "$ADMIN_ADDR_JSON" >/dev/null
retry stellar_send "$ORACLE_GUARD" "$ADMIN_ALIAS" init --admin "$ADMIN_ADDR" >/dev/null
retry stellar_send "$ORACLE_GUARD" "$ADMIN_ALIAS" set_governor --caller "$ADMIN_ADDR" --governor "$ADMIN_ADDR_JSON" >/dev/null
retry stellar_send "$ORACLE_GUARD" "$ADMIN_ALIAS" set_bootstrap_admin_expiry --caller "$ADMIN_ADDR" --expires_at "$EXPIRY" >/dev/null
retry stellar_send "$ORACLE_GUARD" "$ADMIN_ALIAS" set_guardian --caller "$ADMIN_ADDR" --guardian "$ADMIN_ADDR" --expires_at "$EXPIRY" >/dev/null

retry stellar_send "$MANAGER_TIER" "$ADMIN_ALIAS" init --admin "$ADMIN_ADDR" --tier1_threshold 100 --tier2_threshold 1000 --tier3_threshold 10000 >/dev/null
set_governor_plain "$MANAGER_TIER"
set_expiry "$MANAGER_TIER"
retry stellar_send "$COVERAGE_FUND" "$ADMIN_ALIAS" init --admin "$ADMIN_ADDR" --reserve_token "$TEST_USDC" --bootstrap_token "$TEST_XLM" >/dev/null
set_governor_plain "$COVERAGE_FUND"
set_expiry "$COVERAGE_FUND"
retry stellar_send "$CLAIMS_MANAGER" "$ADMIN_ALIAS" init --admin "$ADMIN_ADDR" --reserve_token "$TEST_USDC" --treasury "$TREASURY_ADDR_JSON" >/dev/null
set_governor_plain "$CLAIMS_MANAGER"
set_expiry "$CLAIMS_MANAGER"
retry stellar_send "$GOVERNANCE_EXECUTOR" "$ADMIN_ALIAS" init --admin "$ADMIN_ADDR" --min_delay 5 --grace_period 120 >/dev/null
set_governor_option "$GOVERNANCE_EXECUTOR"
set_expiry "$GOVERNANCE_EXECUTOR"

retry stellar_send "$ARKA_TOKEN" "$ADMIN_ALIAS" init --admin "$ADMIN_ADDR" --name "Arka Fund" --symbol "ARKA" --decimals 7 --max_supply 1000000000000000 >/dev/null
set_governor_option "$ARKA_TOKEN"
set_expiry "$ARKA_TOKEN"
retry stellar_send "$LOCKED_ARKA" "$ADMIN_ALIAS" init --admin "$ADMIN_ADDR" --token "$ARKA_TOKEN" --min_lock_ledgers 120 --max_lock_ledgers 1200 --name "Locked Arka" --symbol "lARKA" >/dev/null
set_governor_plain "$LOCKED_ARKA"
set_expiry "$LOCKED_ARKA"
retry stellar_send "$GOVERNANCE_TOKEN" "$ADMIN_ALIAS" init --admin "$ADMIN_ADDR" >/dev/null
set_governor_option "$GOVERNANCE_TOKEN"
set_expiry "$GOVERNANCE_TOKEN"
retry stellar_send "$ARKA_VESTING" "$ADMIN_ALIAS" init --admin "$ADMIN_ADDR" --token "$ARKA_TOKEN" >/dev/null
set_governor_option "$ARKA_VESTING"
set_expiry "$ARKA_VESTING"
retry stellar_send "$EMISSIONS_CONTROLLER" "$ADMIN_ALIAS" init --admin "$ADMIN_ADDR" --token "$ARKA_TOKEN" >/dev/null
set_governor_option "$EMISSIONS_CONTROLLER"
set_expiry "$EMISSIONS_CONTROLLER"

retry stellar_send "$ADAPTER_AQUARIUS" "$ADMIN_ALIAS" init --admin "$ADMIN_ADDR" --router "$AQUARIUS_ROUTER" >/dev/null
set_governor_option "$ADAPTER_AQUARIUS"
set_expiry "$ADAPTER_AQUARIUS"
retry stellar_send "$ADAPTER_SOROSWAP" "$ADMIN_ALIAS" init --admin "$ADMIN_ADDR" --router "$SOROSWAP_ROUTER" --path "[\"$TEST_USDC\",\"$TEST_XLM\"]" >/dev/null
set_governor_option "$ADAPTER_SOROSWAP"
set_expiry "$ADAPTER_SOROSWAP"
retry stellar_send "$ADAPTER_SOROSWAP" "$ADMIN_ALIAS" set_path_for_pool --caller "$ADMIN_ADDR" --pool_id 1 --path "[\"$TEST_USDC\",\"$TEST_XLM\"]" >/dev/null
retry stellar_send "$ADAPTER_PHOENIX" "$ADMIN_ALIAS" init --admin "$ADMIN_ADDR" >/dev/null
set_governor_option "$ADAPTER_PHOENIX"
set_expiry "$ADAPTER_PHOENIX"
retry stellar_send "$ADAPTER_PHOENIX" "$ADMIN_ALIAS" set_pool_route \
  --caller "$ADMIN_ADDR" \
  --pool_id 1 \
  --pool "$TEST_PROFIT_ADAPTER" \
  --token_in "$TEST_USDC" \
  --token_out "$TEST_XLM" \
  --max_spread_bps 100 \
  --max_allowed_fee_bps 50 >/dev/null
retry stellar_send "$ADAPTER_BLEND_FIXED" "$ADMIN_ALIAS" init --admin "$ADMIN_ADDR" --router "$ROUTER" >/dev/null
set_governor_option "$ADAPTER_BLEND_FIXED"
set_expiry "$ADAPTER_BLEND_FIXED"
retry stellar_send "$ADAPTER_BLEND_YIELDBLOX" "$ADMIN_ALIAS" init --admin "$ADMIN_ADDR" --router "$ROUTER" >/dev/null
set_governor_option "$ADAPTER_BLEND_YIELDBLOX"
set_expiry "$ADAPTER_BLEND_YIELDBLOX"

retry stellar_send "$VENUE_REGISTRY" "$ADMIN_ALIAS" set_venue_status --caller "$ADMIN_ADDR" --venue "$ADAPTER_SOROSWAP" --status 2 >/dev/null
retry stellar_send "$VENUE_REGISTRY" "$ADMIN_ALIAS" set_venue_status --caller "$ADMIN_ADDR" --venue "$ADAPTER_AQUARIUS" --status 2 >/dev/null
retry stellar_send "$VENUE_REGISTRY" "$ADMIN_ALIAS" set_venue_status --caller "$ADMIN_ADDR" --venue "$ADAPTER_PHOENIX" --status 2 >/dev/null
retry stellar_send "$VENUE_REGISTRY" "$ADMIN_ALIAS" set_venue_status --caller "$ADMIN_ADDR" --venue "$ADAPTER_BLEND_FIXED" --status 1 >/dev/null
retry stellar_send "$VENUE_REGISTRY" "$ADMIN_ALIAS" set_venue_status --caller "$ADMIN_ADDR" --venue "$ADAPTER_BLEND_YIELDBLOX" --status 1 >/dev/null
retry stellar_send "$VENUE_REGISTRY" "$ADMIN_ALIAS" set_venue_status --caller "$ADMIN_ADDR" --venue "$TEST_PROFIT_ADAPTER" --status 2 >/dev/null

retry stellar_send "$ORACLE_GUARD" "$ADMIN_ALIAS" set_stellar_asset_policy \
  --caller "$ADMIN_ADDR" \
  --asset "$TEST_USDC" \
  --primary "$TEST_ORACLE_PRIMARY" \
  --secondary "$TEST_ORACLE_SECONDARY" \
  --has_secondary true \
  --max_price_age 600 \
  --max_deviation_bps 300 \
  --require_secondary true \
  --divergence_mode 0 >/dev/null
retry stellar_send "$ORACLE_GUARD" "$ADMIN_ALIAS" set_stellar_asset_policy \
  --caller "$ADMIN_ADDR" \
  --asset "$TEST_XLM" \
  --primary "$TEST_ORACLE_PRIMARY" \
  --secondary "$TEST_ORACLE_SECONDARY" \
  --has_secondary true \
  --max_price_age 600 \
  --max_deviation_bps 300 \
  --require_secondary true \
  --divergence_mode 0 >/dev/null

ARKA_WASM_HASH="$(artifact_hash "artifacts/arka.wasm")"
SHARE_TOKEN_WASM_HASH="$(artifact_hash "artifacts/share-token.wasm")"
retry stellar_send "$ARKA_FACTORY" "$ADMIN_ALIAS" set_governor --governor "$ADMIN_ADDR" >/dev/null
retry stellar_send "$ARKA_FACTORY" "$ADMIN_ALIAS" set_bootstrap_admin --caller "$ADMIN_ADDR" --admin "$ADMIN_ADDR" --expires_at "$EXPIRY" >/dev/null
retry stellar_send "$ARKA_FACTORY" "$ADMIN_ALIAS" set_implementation_controlled --caller "$ADMIN_ADDR" --impl_wasm_hash "$ARKA_WASM_HASH" >/dev/null
retry stellar_send "$ARKA_FACTORY" "$ADMIN_ALIAS" set_share_impl_controlled --caller "$ADMIN_ADDR" --impl_wasm_hash "$SHARE_TOKEN_WASM_HASH" >/dev/null
retry stellar_send "$ARKA_FACTORY" "$ADMIN_ALIAS" set_registry --registry "$ARKA_REGISTRY" >/dev/null
retry stellar_send "$ARKA_FACTORY" "$ADMIN_ALIAS" set_protocol_treasury --treasury "$TREASURY_ADDR" >/dev/null
retry stellar_send "$ARKA_FACTORY" "$ADMIN_ALIAS" set_creation_fee --token "$TEST_USDC" --amount "$CREATE_FEE_AMOUNT" >/dev/null
retry stellar_send "$ARKA_REGISTRY" "$ADMIN_ALIAS" set_registrar --caller "$ADMIN_ADDR" --registrar "$ARKA_FACTORY" --allowed true >/dev/null
retry stellar_send "$ARKA_FACTORY" "$ADMIN_ALIAS" set_default_venue_registry --registry "$VENUE_REGISTRY" >/dev/null
retry stellar_send "$ARKA_FACTORY" "$ADMIN_ALIAS" set_default_swap_oracle --oracle "$ORACLE_GUARD" >/dev/null
retry stellar_send "$ARKA_FACTORY" "$ADMIN_ALIAS" set_default_allowed_venues \
  --allowed_routers "[]" \
  --allowed_adapters "[\"$ADAPTER_SOROSWAP\",\"$ADAPTER_AQUARIUS\",\"$ADAPTER_PHOENIX\"]" >/dev/null
retry stellar_send "$ARKA_FACTORY" "$ADMIN_ALIAS" set_default_swap_risk_policy \
  --enabled true \
  --oracle_checks_enabled true \
  --max_price_impact_bps 300 \
  --max_slippage_bps 300 \
  --max_twap_deviation_bps 350 \
  --max_oracle_age_seconds 600 \
  --max_trade_size_bps 2500 >/dev/null
record_check "configured" "ok"

echo "Creating canary Arka via factory..."
retry stellar_send "$TEST_USDC" "$MANAGER_ALIAS" approve \
  --owner "$MANAGER_ADDR" \
  --spender "$ARKA_FACTORY" \
  --amount "$CREATE_FEE_AMOUNT" \
  --expiration_ledger "$APPROVAL_EXPIRATION_LEDGER" >/dev/null
SALT_HEX="$(openssl rand -hex 32)"
CANARY_ARKA="$(
  stellar_send "$ARKA_FACTORY" "$MANAGER_ALIAS" create_and_init \
    --salt "$SALT_HEX" \
    --manager "$MANAGER_ADDR" \
    --denomination "$TEST_USDC" \
    --mgmt_bps 0 \
    --perf_bps 0 \
    --deposit_bps 0 \
    --redeem_bps 0 \
    --whitelist "[\"$TEST_USDC\",\"$TEST_XLM\"]" \
    --router "$ROUTER" \
    | tail -n1 \
    | tr -d '"'
)"
if [[ ! "$CANARY_ARKA" =~ ^C[A-Z2-7]{55}$ ]]; then
  echo "Factory did not return a canary Arka id: $CANARY_ARKA" >&2
  exit 1
fi
record_contract "canaryArka" "$CANARY_ARKA" "artifacts/arka.wasm"
CANARY_SHARE_TOKEN="$(stellar_view "$ARKA_FACTORY" "$ADMIN_ALIAS" share_token_of --arka "$CANARY_ARKA" | tail -n1 | tr -d '"')"
record_contract "canaryShareToken" "$CANARY_SHARE_TOKEN" "artifacts/share-token.wasm"
record_check "factoryCreate" "$CANARY_ARKA"

echo "Running canary deposit/redeem/smart-routing path..."
retry stellar_send "$CANARY_ARKA" "$ADMIN_ALIAS" set_allowed_venues \
  --caller "$ADMIN_ADDR" \
  --allowed_routers "[]" \
  --allowed_adapters "[\"$TEST_PROFIT_ADAPTER\"]" >/dev/null
retry stellar_send "$TEST_USDC" "$MANAGER_ALIAS" approve \
  --owner "$MANAGER_ADDR" \
  --spender "$CANARY_ARKA" \
  --amount "$VALIDATION_DEPOSIT_AMOUNT" \
  --expiration_ledger "$APPROVAL_EXPIRATION_LEDGER" >/dev/null
DEPOSIT_OUT="$(stellar_send "$CANARY_ARKA" "$MANAGER_ALIAS" deposit --user "$MANAGER_ADDR" --asset "{\"contract\":\"$TEST_USDC\"}" --amount "$VALIDATION_DEPOSIT_AMOUNT" | tail -n1 | tr -d '"')"
REDEEM_OUT="$(stellar_send "$CANARY_ARKA" "$MANAGER_ALIAS" redeem --user "$MANAGER_ADDR" --shares "$VALIDATION_REDEEM_SHARES" | tail -n1 | tr -d '"')"
retry stellar_send "$TEST_USDC" "$MANAGER_ALIAS" approve \
  --owner "$MANAGER_ADDR" \
  --spender "$CANARY_ARKA" \
  --amount "$VALIDATION_DEPOSIT_AMOUNT" \
  --expiration_ledger "$APPROVAL_EXPIRATION_LEDGER" >/dev/null
stellar_send "$CANARY_ARKA" "$MANAGER_ALIAS" deposit --user "$MANAGER_ADDR" --asset "{\"contract\":\"$TEST_USDC\"}" --amount "$VALIDATION_DEPOSIT_AMOUNT" >/dev/null

NOW_TS="$(latest_ledger_close_time)"
for oracle in "$TEST_ORACLE_PRIMARY" "$TEST_ORACLE_SECONDARY"; do
  retry stellar_send "$oracle" "$ADMIN_ALIAS" set_stellar_price \
    --caller "$ADMIN_ADDR" \
    --asset "$TEST_USDC" \
    --price 10000000 \
    --timestamp "$NOW_TS" >/dev/null
  retry stellar_send "$oracle" "$ADMIN_ALIAS" set_stellar_price \
    --caller "$ADMIN_ADDR" \
    --asset "$TEST_XLM" \
    --price 10000000 \
    --timestamp "$NOW_TS" >/dev/null
done

STEPS_JSON="[{\"adapter\":\"$TEST_PROFIT_ADAPTER\",\"pool_id\":\"1\",\"asset_in\":{\"contract\":\"$TEST_USDC\"},\"amount_in\":\"$VALIDATION_REBALANCE_AMOUNT\",\"min_out\":\"$VALIDATION_MIN_OUT\",\"asset_out\":{\"contract\":\"$TEST_XLM\"},\"router_addr\":\"$ROUTER\"}]"
REBALANCE_OUT="$(stellar_send "$CANARY_ARKA" "$MANAGER_ALIAS" rebalance --manager "$MANAGER_ADDR" --steps "$STEPS_JSON" | tail -n1 | tr -d '"')"
record_check "deposit" "$DEPOSIT_OUT"
record_check "redeem" "$REDEEM_OUT"
record_check "rebalance" "$REBALANCE_OUT"

echo "Testing global venue kill switch..."
retry stellar_send "$VENUE_REGISTRY" "$ADMIN_ALIAS" disable_venue --caller "$ADMIN_ADDR" --venue "$TEST_PROFIT_ADAPTER" >/dev/null
set +e
BLOCKED_OUTPUT="$(
  stellar contract invoke \
    --id "$CANARY_ARKA" \
    --source-account "$MANAGER_ALIAS" \
    --network "$NETWORK_NAME" \
    --send yes \
    -- rebalance \
    --manager "$MANAGER_ADDR" \
    --steps "$STEPS_JSON" 2>&1
)"
BLOCKED_STATUS=$?
set -e
if [[ "$BLOCKED_STATUS" -eq 0 ]]; then
  echo "Expected rebalance to fail after global venue disable." >&2
  exit 1
fi
record_check "globalVenueDisableBlocksRebalance" "ok"

echo "Re-enabling canary venue and testing upgrades..."
retry stellar_send "$VENUE_REGISTRY" "$ADMIN_ALIAS" set_venue_status --caller "$ADMIN_ADDR" --venue "$TEST_PROFIT_ADAPTER" --status 2 >/dev/null

while IFS=$'\t' read -r name contract artifact; do
  hash="$(artifact_hash "$artifact")"
  if [[ -z "$hash" ]]; then
    continue
  fi
  echo "  upgrade $name"
  retry stellar_send "$contract" "$ADMIN_ALIAS" upgrade --caller "$ADMIN_ADDR" --new_wasm_hash "$hash" >/dev/null
  last="$(stellar_view "$contract" "$ADMIN_ALIAS" last_wasm_hash 2>/dev/null | tail -n1 | tr -d '\" ' || true)"
  record_upgrade "$name" "$contract" "${last:-submitted}"
done < <(awk -F'\t' '$1 !~ /^test/ && $1 != "canaryShareToken" {print $1 "\t" $2 "\t" $3}' "$CONTRACT_TSV")
record_check "upgrade" "ok"

echo "Writing rehearsal evidence..."
python3 - <<'PY' "$DEPLOY_JSON" "$MAINNET_MANIFEST" "$HASH_TSV" "$CONTRACT_TSV" "$CHECK_TSV" "$UPGRADE_TSV" "$ADMIN_ALIAS" "$ADMIN_ADDR" "$MANAGER_ALIAS" "$MANAGER_ADDR" "$TREASURY_ALIAS" "$TREASURY_ADDR" "$EXPIRY" "$BLOCKED_STATUS" "$BLOCKED_OUTPUT"
import json
import sys
from datetime import datetime, timezone
from pathlib import Path

(
    out_path,
    manifest_path,
    hash_tsv,
    contract_tsv,
    check_tsv,
    upgrade_tsv,
    admin_alias,
    admin_addr,
    manager_alias,
    manager_addr,
    treasury_alias,
    treasury_addr,
    expiry,
    blocked_status,
    blocked_output,
) = sys.argv[1:]

def read_tsv(path, cols):
    rows = []
    for line in Path(path).read_text(encoding="utf-8").splitlines():
        if not line:
            continue
        parts = line.split("\t")
        rows.append(dict(zip(cols, parts)))
    return rows

hashes = {row["artifact"]: row["hash"] for row in read_tsv(hash_tsv, ["artifact", "hash"])}
contracts = {
    row["name"]: {"id": row["id"], "artifact": row["artifact"]}
    for row in read_tsv(contract_tsv, ["name", "id", "artifact"])
}
checks = {row["name"]: row["value"] for row in read_tsv(check_tsv, ["name", "value"])}
upgrades = read_tsv(upgrade_tsv, ["name", "id", "lastWasmHash"])

manifest = json.loads(Path(manifest_path).read_text(encoding="utf-8"))
payload = {
    "validatedAt": datetime.now(timezone.utc).isoformat(),
    "purpose": "mainnet deployment rehearsal on Stellar testnet",
    "sourceManifest": str(Path(manifest_path).resolve()),
    "network": "testnet",
    "admin": {"alias": admin_alias, "publicKey": admin_addr},
    "manager": {"alias": manager_alias, "publicKey": manager_addr},
    "treasury": {"alias": treasury_alias, "publicKey": treasury_addr},
    "bootstrapExpiryUnix": int(expiry),
    "sourceDeploymentPlanCount": len(manifest.get("deploymentPlan", {}).get("contracts", [])),
    "uploadedArtifacts": hashes,
    "contracts": contracts,
    "checks": checks,
    "upgrades": upgrades,
    "blockedVenueNegativePath": {
        "status": int(blocked_status),
        "passed": int(blocked_status) != 0,
        "outputExcerpt": blocked_output[-1200:],
    },
}
Path(out_path).write_text(json.dumps(payload, indent=2), encoding="utf-8")
PY

echo "Rehearsal complete: $DEPLOY_JSON"
