#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
NETWORK_PASSPHRASE="${BLEND_NETWORK_PASSPHRASE:-Test SDF Network ; September 2015}"
RPC_URL="${BLEND_RPC_URL:-https://soroban-testnet.stellar.org}"
ADMIN_IDENTITY="${ADMIN_IDENTITY:-arka-admin}"
ADMIN_SECRET="${ADMIN_SECRET:-}"
BLEND_POOL_ID="${BLEND_POOL_ID:-CCEBVDYM32YNYCVNRXQKDFFPISJJCV557CDZEIRBEE4NCV4KHPQ44HGF}"
ASSET_ID="${ASSET_ID:-CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC}"
SECOND_ASSET_ID="${SECOND_ASSET_ID:-}"
DEPOSIT_AMOUNT="${DEPOSIT_AMOUNT:-10000000}"
ACTION_AMOUNT="${ACTION_AMOUNT:-1000000}"
APPROVAL_EXPIRATION_LEDGER="${APPROVAL_EXPIRATION_LEDGER:-3000000}"
BLEND_MAX_ORACLE_AGE="${BLEND_MAX_ORACLE_AGE:-3600}"
BLEND_MIN_HEALTH_FACTOR="${BLEND_MIN_HEALTH_FACTOR:-12500000}"
ARKA_WASM_PATH="${ARKA_WASM_PATH:-$ROOT_DIR/artifacts/arka.live.optimized.wasm}"
ADAPTER_WASM_PATH="${ADAPTER_WASM_PATH:-$ROOT_DIR/artifacts/adapter-blend.live.optimized.wasm}"
OUT_JSON="${OUT_JSON:-$ROOT_DIR/tmp/blend-live-validation.json}"

mkdir -p "$(dirname "$OUT_JSON")"

if [[ ! -f "$ARKA_WASM_PATH" || ! -f "$ADAPTER_WASM_PATH" ]]; then
  echo "ERROR: missing wasm artifacts. Build arka and adapter-blend first." >&2
  exit 1
fi

if [[ -z "$ADMIN_SECRET" ]]; then
  ADMIN_SECRET="$(stellar keys secret "$ADMIN_IDENTITY")"
fi
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

echo "1) Deploy adapter-blend"
ADAPTER_ID="$(deploy_contract "$ADAPTER_WASM_PATH")"
echo "   ADAPTER_ID=$ADAPTER_ID"

echo "2) Init adapter against live Blend pool"
stellar contract invoke \
  --id "$ADAPTER_ID" \
  --source-account "$ADMIN_SECRET" \
  --rpc-url "$RPC_URL" \
  --network-passphrase "$NETWORK_PASSPHRASE" \
  --send=yes -- init --admin "$ADMIN_ADDR" --router "$BLEND_POOL_ID" >/dev/null

stellar contract invoke \
  --id "$ADAPTER_ID" \
  --source-account "$ADMIN_SECRET" \
  --rpc-url "$RPC_URL" \
  --network-passphrase "$NETWORK_PASSPHRASE" \
  --send=yes -- set_market_asset --caller "$ADMIN_ADDR" --market_id 0 --asset "$ASSET_ID" >/dev/null

echo "3) Deploy Arka"
ARKA_ID="$(deploy_contract "$ARKA_WASM_PATH")"
echo "   ARKA_ID=$ARKA_ID"

echo "4) Init Arka with Blend asset whitelist"
if [[ -n "$SECOND_ASSET_ID" ]]; then
  WHITELIST_JSON="$(jq -cn --arg a "$ASSET_ID" --arg b "$SECOND_ASSET_ID" '[$a, $b]')"
else
  WHITELIST_JSON="$(jq -cn --arg a "$ASSET_ID" '[$a]')"
fi

stellar contract invoke \
  --id "$ARKA_ID" \
  --source-account "$ADMIN_SECRET" \
  --rpc-url "$RPC_URL" \
  --network-passphrase "$NETWORK_PASSPHRASE" \
  --send=yes -- init \
  --denomination_contract "$ASSET_ID" \
  --mgmt_bps 0 \
  --perf_bps 0 \
  --deposit_bps 0 \
  --redeem_bps 0 \
  --whitelist_contracts "$WHITELIST_JSON" \
  --manager "$ADMIN_ADDR" >/dev/null

echo "5) Approve and deposit into Arka"
stellar contract invoke \
  --id "$ASSET_ID" \
  --source-account "$ADMIN_SECRET" \
  --rpc-url "$RPC_URL" \
  --network-passphrase "$NETWORK_PASSPHRASE" \
  --send=yes -- approve --from "$ADMIN_ADDR" --spender "$ARKA_ID" --amount "$DEPOSIT_AMOUNT" --expiration_ledger "$APPROVAL_EXPIRATION_LEDGER" >/dev/null

stellar contract invoke \
  --id "$ARKA_ID" \
  --source-account "$ADMIN_SECRET" \
  --rpc-url "$RPC_URL" \
  --network-passphrase "$NETWORK_PASSPHRASE" \
  --send=yes -- deposit --user "$ADMIN_ADDR" --asset "{\"contract\":\"$ASSET_ID\"}" --amount "$DEPOSIT_AMOUNT" >/dev/null

echo "6) Configure Blend risk policy"
stellar contract invoke \
  --id "$ARKA_ID" \
  --source-account "$ADMIN_SECRET" \
  --rpc-url "$RPC_URL" \
  --network-passphrase "$NETWORK_PASSPHRASE" \
  --send=yes -- set_blend_risk_policy \
  --caller "$ADMIN_ADDR" \
  --market_id 0 \
  --max_oracle_age "$BLEND_MAX_ORACLE_AGE" \
  --min_health_factor "$BLEND_MIN_HEALTH_FACTOR" \
  --fail_close_nav true \
  --fail_close_actions true >/dev/null

echo "7) Execute Blend live validation"
ARKA_ID="$ARKA_ID" \
ADAPTER_ID="$ADAPTER_ID" \
ASSET_ID="$ASSET_ID" \
SECOND_ASSET_ID="$SECOND_ASSET_ID" \
AMOUNT="$ACTION_AMOUNT" \
SECOND_AMOUNT="$ACTION_AMOUNT" \
MANAGER_IDENTITY="$ADMIN_IDENTITY" \
NETWORK_PASSPHRASE="$NETWORK_PASSPHRASE" \
RPC_URL="$RPC_URL" \
bash "$ROOT_DIR/scripts/e2e-blend-vault-position.sh"

cat >"$OUT_JSON" <<JSON
{
  "arka": "$ARKA_ID",
  "adapterBlend": "$ADAPTER_ID",
  "blendPool": "$BLEND_POOL_ID",
  "asset": "$ASSET_ID",
  "secondAsset": "$SECOND_ASSET_ID",
  "depositAmount": "$DEPOSIT_AMOUNT",
  "actionAmount": "$ACTION_AMOUNT",
  "blendMaxOracleAge": "$BLEND_MAX_ORACLE_AGE",
  "blendMinHealthFactor": "$BLEND_MIN_HEALTH_FACTOR"
}
JSON

echo "8) Wrote environment summary to $OUT_JSON"
