#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
MANIFEST="${MANIFEST:-$ROOT_DIR/deployments.mainnet.json}"
CONFIRM_VALUE="configure-arka-mainnet"

if [[ "${CONFIRM_MAINNET_CONFIGURE:-}" != "$CONFIRM_VALUE" ]]; then
  echo "Refusing mainnet configuration. Set CONFIRM_MAINNET_CONFIGURE=$CONFIRM_VALUE to continue." >&2
  exit 1
fi

SECRET_ENV="$(jq -r '.admin.secretEnvVar' "$MANIFEST")"
ADMIN_SECRET="${!SECRET_ENV:-}"
if [[ -z "$ADMIN_SECRET" && -f "$HOME/.zshrc" ]]; then
  ADMIN_SECRET="$(SECRET_ENV="$SECRET_ENV" zsh -lc 'source "$HOME/.zshrc" >/dev/null 2>&1 || true; eval "printf %s \"\${$SECRET_ENV:-}\""' 2>/dev/null || true)"
fi
if [[ -z "$ADMIN_SECRET" ]]; then
  echo "Missing admin secret env var: $SECRET_ENV" >&2
  exit 1
fi
export "$SECRET_ENV=$ADMIN_SECRET"

RPC_URL="$(jq -r '.rpcUrl' "$MANIFEST")"
NETWORK_PASSPHRASE="$(jq -r '.networkPassphrase' "$MANIFEST")"
ADMIN="$(jq -r '.admin.publicKey' "$MANIFEST")"
EXPIRY="$(jq -r '.admin.bootstrapExpiryUnix' "$MANIFEST")"
TREASURY="$(jq -r '.launchPolicy.protocolTreasury.address' "$MANIFEST")"
CREATION_FEE="$(jq -r '.launchPolicy.creationFee.amount' "$MANIFEST")"
ADMIN_OPTION_JSON="\"$ADMIN\""
TREASURY_OPTION_JSON="\"$TREASURY\""

contract() {
  jq -r --arg name "$1" '.contracts[$name] // empty' "$MANIFEST"
}

asset() {
  jq -r --arg symbol "$1" '.assets.contractIds[$symbol] // empty' "$MANIFEST"
}

external() {
  jq -r "$1" "$MANIFEST"
}

require_contract() {
  local name="$1"
  local value
  value="$(contract "$name")"
  if [[ ! "$value" =~ ^C[A-Z2-7]{55}$ ]]; then
    echo "Missing deployed contract id for $name in $MANIFEST" >&2
    exit 1
  fi
  printf '%s' "$value"
}

invoke() {
  local id="$1"
  shift
  stellar contract invoke \
    --id "$id" \
    --source-account "$ADMIN_SECRET" \
    --rpc-url "$RPC_URL" \
    --network-passphrase "$NETWORK_PASSPHRASE" \
    --send yes \
    -- "$@"
}

set_bootstrap_expiry() {
  local id="$1"
  invoke "$id" set_bootstrap_admin_expiry --caller "$ADMIN" --expires_at "$EXPIRY"
}

set_governor_to_admin() {
  local id="$1"
  invoke "$id" set_governor --caller "$ADMIN" --governor "$ADMIN"
}

set_governor_option_to_admin() {
  local id="$1"
  invoke "$id" set_governor --caller "$ADMIN" --governor "$ADMIN_OPTION_JSON"
}

json_update() {
  local filter="$1"
  shift
  local tmp
  tmp="$(mktemp "${TMPDIR:-/tmp}/arka-mainnet-config.XXXXXX.json")"
  jq "$@" "$filter" "$MANIFEST" > "$tmp"
  mv "$tmp" "$MANIFEST"
}

ARKA_FACTORY="$(require_contract arkaFactory)"
ARKA_REGISTRY="$(require_contract arkaRegistry)"
ROUTER="$(require_contract router)"
VENUE_REGISTRY="$(require_contract venueRegistry)"
ADAPTER_AQUARIUS="$(require_contract adapterAquarius)"
ADAPTER_SOROSWAP="$(require_contract adapterSoroswap)"
ADAPTER_PHOENIX="$(require_contract adapterPhoenix)"
ADAPTER_BLEND_FIXED="$(require_contract adapterBlendFixedXlmUsdc)"
ADAPTER_BLEND_YIELDBLOX="$(require_contract adapterBlendYieldBlox)"
ORACLE_GUARD="$(require_contract oracleGuard)"
COVERAGE_FUND="$(require_contract coverageFund)"
CLAIMS_MANAGER="$(require_contract claimsManager)"
MANAGER_TIER="$(require_contract managerTier)"
ARKA_TOKEN="$(require_contract arkaToken)"
LOCKED_ARKA="$(require_contract lockedArka)"
GOVERNANCE_TOKEN="$(require_contract governanceToken)"
GOVERNANCE_EXECUTOR="$(require_contract governanceExecutor)"
ARKA_VESTING="$(require_contract arkaVesting)"
EMISSIONS_CONTROLLER="$(require_contract emissionsController)"

USDC="$(asset USDC)"
XLM="$(asset XLM)"
XTAR="$(asset XTAR)"
ARKA_WASM_HASH="$(jq -r '.wasmHashes.arka' "$MANIFEST")"
SHARE_TOKEN_WASM_HASH="$(jq -r '.wasmHashes.shareToken' "$MANIFEST")"
SOROSWAP_ROUTER="$(external '.externalContracts.soroswap.router')"
AQUARIUS_ROUTER="$(external '.externalContracts.aquarius.router')"
BLEND_FIXED_POOL="$(external '.externalContracts.blend.fixedXlmUsdcPool')"
BLEND_YIELDBLOX_POOL="$(external '.externalContracts.blend.yieldBloxPool')"

echo "Initializing core singletons..."
invoke "$ARKA_REGISTRY" init_admin --admin "$ADMIN"
set_governor_option_to_admin "$ARKA_REGISTRY"
set_bootstrap_expiry "$ARKA_REGISTRY"
invoke "$ROUTER" init_upgrade_authority --admin "$ADMIN" --governor "$ADMIN_OPTION_JSON" --expires_at "$EXPIRY"
invoke "$VENUE_REGISTRY" init --admin "$ADMIN" --governor "$ADMIN_OPTION_JSON" --expires_at "$EXPIRY"
invoke "$VENUE_REGISTRY" set_guardian --caller "$ADMIN" --guardian "$ADMIN_OPTION_JSON"
invoke "$ORACLE_GUARD" init --admin "$ADMIN"
set_governor_option_to_admin "$ORACLE_GUARD"
set_bootstrap_expiry "$ORACLE_GUARD"
invoke "$ORACLE_GUARD" set_guardian --caller "$ADMIN" --guardian "$ADMIN" --expires_at "$EXPIRY"
invoke "$MANAGER_TIER" init --admin "$ADMIN" --tier1_threshold 100 --tier2_threshold 1000 --tier3_threshold 10000
set_governor_to_admin "$MANAGER_TIER"
set_bootstrap_expiry "$MANAGER_TIER"
invoke "$COVERAGE_FUND" init --admin "$ADMIN" --reserve_token "$USDC" --bootstrap_token "$XTAR"
set_governor_to_admin "$COVERAGE_FUND"
set_bootstrap_expiry "$COVERAGE_FUND"
invoke "$CLAIMS_MANAGER" init --admin "$ADMIN" --reserve_token "$USDC" --treasury "$TREASURY_OPTION_JSON"
set_governor_to_admin "$CLAIMS_MANAGER"
set_bootstrap_expiry "$CLAIMS_MANAGER"
invoke "$GOVERNANCE_EXECUTOR" init --admin "$ADMIN" --min_delay 86400 --grace_period 604800
set_governor_option_to_admin "$GOVERNANCE_EXECUTOR"
set_bootstrap_expiry "$GOVERNANCE_EXECUTOR"
invoke "$ARKA_TOKEN" init --admin "$ADMIN" --name "Arka Fund" --symbol "ARKA" --decimals 7 --max_supply 1000000000000000
set_governor_option_to_admin "$ARKA_TOKEN"
set_bootstrap_expiry "$ARKA_TOKEN"
invoke "$LOCKED_ARKA" init --admin "$ADMIN" --token "$ARKA_TOKEN" --min_lock_ledgers 120960 --max_lock_ledgers 6307200 --name "Locked Arka" --symbol "lARKA"
set_governor_to_admin "$LOCKED_ARKA"
set_bootstrap_expiry "$LOCKED_ARKA"
invoke "$GOVERNANCE_TOKEN" init --admin "$ADMIN"
set_governor_option_to_admin "$GOVERNANCE_TOKEN"
set_bootstrap_expiry "$GOVERNANCE_TOKEN"
invoke "$ARKA_VESTING" init --admin "$ADMIN" --token "$ARKA_TOKEN"
set_governor_option_to_admin "$ARKA_VESTING"
set_bootstrap_expiry "$ARKA_VESTING"
invoke "$EMISSIONS_CONTROLLER" init --admin "$ADMIN" --token "$ARKA_TOKEN"
set_governor_option_to_admin "$EMISSIONS_CONTROLLER"
set_bootstrap_expiry "$EMISSIONS_CONTROLLER"

echo "Configuring factory, registry and paid creation..."
invoke "$ARKA_FACTORY" set_governor --governor "$ADMIN"
invoke "$ARKA_FACTORY" set_bootstrap_admin --caller "$ADMIN" --admin "$ADMIN" --expires_at "$EXPIRY"
invoke "$ARKA_FACTORY" set_implementation_controlled --caller "$ADMIN" --impl_wasm_hash "$ARKA_WASM_HASH"
invoke "$ARKA_FACTORY" set_share_impl_controlled --caller "$ADMIN" --impl_wasm_hash "$SHARE_TOKEN_WASM_HASH"
invoke "$ARKA_FACTORY" set_registry --registry "$ARKA_REGISTRY"
invoke "$ARKA_FACTORY" set_protocol_treasury --treasury "$TREASURY"
invoke "$ARKA_FACTORY" set_creation_fee --token "$USDC" --amount "$CREATION_FEE"
invoke "$ARKA_REGISTRY" set_registrar --caller "$ADMIN" --registrar "$ARKA_FACTORY" --allowed true

echo "Initializing execution venues with AUTO still disabled..."
invoke "$ADAPTER_AQUARIUS" init --admin "$ADMIN" --router "$AQUARIUS_ROUTER"
set_governor_option_to_admin "$ADAPTER_AQUARIUS"
set_bootstrap_expiry "$ADAPTER_AQUARIUS"
invoke "$ADAPTER_SOROSWAP" init --admin "$ADMIN" --router "$SOROSWAP_ROUTER" --path "[\"$XLM\",\"$USDC\"]"
set_governor_option_to_admin "$ADAPTER_SOROSWAP"
set_bootstrap_expiry "$ADAPTER_SOROSWAP"
invoke "$ADAPTER_SOROSWAP" set_path_for_pool --caller "$ADMIN" --pool_id 1 --path "[\"$XLM\",\"$USDC\"]"
invoke "$ADAPTER_SOROSWAP" set_path_for_pool --caller "$ADMIN" --pool_id 2 --path "[\"$USDC\",\"$XLM\"]"
jq -c '.executionVenues.aquarius.poolRoutes[]?' "$MANIFEST" | while IFS= read -r route; do
  pool_id="$(jq -r '.poolId' <<<"$route")"
  token_in="$(jq -r '.tokenIn' <<<"$route")"
  token_out="$(jq -r '.tokenOut' <<<"$route")"
  tokens="$(jq -c '.tokens' <<<"$route")"
  pool_index="$(jq -r '.poolIndex' <<<"$route")"
  invoke "$ADAPTER_AQUARIUS" set_pool_route \
    --caller "$ADMIN" \
    --pool_id "$pool_id" \
    --token_in "$token_in" \
    --token_out "$token_out" \
    --tokens "$tokens" \
    --pool_index "$pool_index"
done
invoke "$ADAPTER_PHOENIX" init --admin "$ADMIN"
set_governor_option_to_admin "$ADAPTER_PHOENIX"
set_bootstrap_expiry "$ADAPTER_PHOENIX"
jq -c '.executionVenues.phoenix.poolRoutes[]' "$MANIFEST" | while IFS= read -r route; do
  pool_id="$(jq -r '.poolId' <<<"$route")"
  pool="$(jq -r '.pool' <<<"$route")"
  token_in="$(jq -r '.tokenIn' <<<"$route")"
  token_out="$(jq -r '.tokenOut' <<<"$route")"
  max_spread="$(jq -r '.maxSpreadBps' <<<"$route")"
  max_fee="$(jq -r '.maxAllowedFeeBps' <<<"$route")"
  invoke "$ADAPTER_PHOENIX" set_pool_route \
    --caller "$ADMIN" \
    --pool_id "$pool_id" \
    --pool "$pool" \
    --token_in "$token_in" \
    --token_out "$token_out" \
    --max_spread_bps "$max_spread" \
    --max_allowed_fee_bps "$max_fee"
done
invoke "$ADAPTER_BLEND_FIXED" init --admin "$ADMIN" --router "$BLEND_FIXED_POOL"
set_governor_option_to_admin "$ADAPTER_BLEND_FIXED"
set_bootstrap_expiry "$ADAPTER_BLEND_FIXED"
invoke "$ADAPTER_BLEND_YIELDBLOX" init --admin "$ADMIN" --router "$BLEND_YIELDBLOX_POOL"
set_governor_option_to_admin "$ADAPTER_BLEND_YIELDBLOX"
set_bootstrap_expiry "$ADAPTER_BLEND_YIELDBLOX"

echo "Configuring governed global venue registry..."
invoke "$VENUE_REGISTRY" set_venue_status --caller "$ADMIN" --venue "$ADAPTER_SOROSWAP" --status 1
invoke "$VENUE_REGISTRY" set_venue_status --caller "$ADMIN" --venue "$ADAPTER_AQUARIUS" --status 1
invoke "$VENUE_REGISTRY" set_venue_status --caller "$ADMIN" --venue "$ADAPTER_PHOENIX" --status 1
invoke "$VENUE_REGISTRY" set_venue_status --caller "$ADMIN" --venue "$ADAPTER_BLEND_FIXED" --status 1
invoke "$VENUE_REGISTRY" set_venue_status --caller "$ADMIN" --venue "$ADAPTER_BLEND_YIELDBLOX" --status 1

echo "Configuring factory defaults for newly created Arkas..."
invoke "$ARKA_FACTORY" set_default_venue_registry --registry "$VENUE_REGISTRY"
invoke "$ARKA_FACTORY" set_default_swap_oracle --oracle "$ORACLE_GUARD"
invoke "$ARKA_FACTORY" set_default_allowed_venues \
  --allowed_routers "[]" \
  --allowed_adapters "[\"$ADAPTER_SOROSWAP\",\"$ADAPTER_AQUARIUS\",\"$ADAPTER_PHOENIX\"]"
invoke "$ARKA_FACTORY" set_default_swap_risk_policy \
  --enabled true \
  --oracle_checks_enabled true \
  --max_price_impact_bps 300 \
  --max_slippage_bps 300 \
  --max_twap_deviation_bps 350 \
  --max_oracle_age_seconds 900 \
  --max_trade_size_bps 2500

echo "Configuring OracleGuard asset policies..."
PRIMARY="$(jq -r '.oracle.primaryProvider' "$MANIFEST")"
SECONDARY="$(jq -r '.oracle.secondaryProvider' "$MANIFEST")"
jq -r '.assets.admittedSymbols[]' "$MANIFEST" | while IFS= read -r symbol; do
  token_contract="$(asset "$symbol")"
  max_age="$(jq -r --arg symbol "$symbol" '.oracle.assetPolicies[$symbol].maxAgeSeconds' "$MANIFEST")"
  max_divergence="$(jq -r --arg symbol "$symbol" '.oracle.assetPolicies[$symbol].maxDivergenceBps' "$MANIFEST")"
  mode="$(jq -r --arg symbol "$symbol" '.oracle.assetPolicies[$symbol].mode' "$MANIFEST")"
  override_provider="$(jq -r --arg symbol "$symbol" '.oracle.providerAssetOverrides[$symbol].provider // empty' "$MANIFEST")"
  override_asset="$(jq -c --arg symbol "$symbol" '.oracle.providerAssetOverrides[$symbol].providerAsset // empty' "$MANIFEST")"
  if [[ -n "$override_provider" && "$override_asset" != "null" && "$override_asset" != "" ]]; then
    if [[ "$mode" == "single_provider_exception" ]]; then
      invoke "$ORACLE_GUARD" set_stellar_asset_policy \
        --caller "$ADMIN" \
        --asset "$token_contract" \
        --primary "$override_provider" \
        --secondary "$override_provider" \
        --has_secondary false \
        --max_price_age "$max_age" \
        --max_deviation_bps "$max_divergence" \
        --require_secondary false \
        --divergence_mode 0
    else
      invoke "$ORACLE_GUARD" set_stellar_asset_policy \
        --caller "$ADMIN" \
        --asset "$token_contract" \
        --primary "$PRIMARY" \
        --secondary "$override_provider" \
        --has_secondary true \
        --max_price_age "$max_age" \
        --max_deviation_bps "$max_divergence" \
        --require_secondary true \
        --divergence_mode 0
    fi
    invoke "$ORACLE_GUARD" set_stellar_provider_asset \
      --caller "$ADMIN" \
      --asset "$token_contract" \
      --provider "$override_provider" \
      --provider_asset "$override_asset"
    continue
  fi
  if [[ "$mode" == "single_provider_exception" ]]; then
    invoke "$ORACLE_GUARD" set_stellar_asset_policy \
      --caller "$ADMIN" \
      --asset "$token_contract" \
      --primary "$PRIMARY" \
      --secondary "$PRIMARY" \
      --has_secondary false \
      --max_price_age "$max_age" \
      --max_deviation_bps "$max_divergence" \
      --require_secondary false \
      --divergence_mode 0
  else
    invoke "$ORACLE_GUARD" set_stellar_asset_policy \
      --caller "$ADMIN" \
      --asset "$token_contract" \
      --primary "$PRIMARY" \
      --secondary "$SECONDARY" \
      --has_secondary true \
      --max_price_age "$max_age" \
      --max_deviation_bps "$max_divergence" \
      --require_secondary true \
      --divergence_mode 0
  fi
done

json_update '
  .status = "configured_pending_postdeploy_gates"
  | .updatedAt = (now | todate)
  | .validations.contractsConfigured = true
'

echo "Mainnet contracts configured. Run storage lifecycle dry-run, canaries and release gate before public capital."
