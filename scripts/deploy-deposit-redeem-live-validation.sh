#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
NETWORK_PASSPHRASE="${DEPOSIT_NETWORK_PASSPHRASE:-Test SDF Network ; September 2015}"
RPC_URL="${DEPOSIT_RPC_URL:-https://soroban-testnet.stellar.org}"
ADMIN_IDENTITY="${ADMIN_IDENTITY:-arka-admin}"
HOLDER_IDENTITY="${HOLDER_IDENTITY:-arka-holder}"
HOLDER_MINT_AMOUNT="${HOLDER_MINT_AMOUNT:-5000000}"
VALIDATION_DEPOSIT_AMOUNT="${VALIDATION_DEPOSIT_AMOUNT:-100000}"
VALIDATION_REDEEM_SHARES="${VALIDATION_REDEEM_SHARES:-50000}"
ARKA_WASM_PATH="${ARKA_WASM_PATH:-$ROOT_DIR/artifacts/arka.live.optimized.wasm}"
TOKEN_WASM_PATH="${TOKEN_WASM_PATH:-$ROOT_DIR/artifacts/test-token.wasm}"
OUT_JSON="${OUT_JSON:-$ROOT_DIR/tmp/deposit-redeem-live-validation.json}"

mkdir -p "$(dirname "$OUT_JSON")"

if [[ ! -f "$ARKA_WASM_PATH" || ! -f "$TOKEN_WASM_PATH" ]]; then
  echo "ERROR: missing wasm artifacts. Expected $ARKA_WASM_PATH and $TOKEN_WASM_PATH" >&2
  exit 1
fi

ADMIN_SECRET="${ADMIN_SECRET:-$(stellar keys secret "$ADMIN_IDENTITY")}"
ADMIN_ADDR="${ADMIN_ADDR:-$(stellar keys address "$ADMIN_IDENTITY")}"
HOLDER_ADDR="${HOLDER_ADDR:-$(stellar keys address "$HOLDER_IDENTITY")}"

deploy_contract() {
  local wasm_path="$1"
  stellar contract deploy \
    --wasm "$wasm_path" \
    --source-account "$ADMIN_SECRET" \
    --rpc-url "$RPC_URL" \
    --network-passphrase "$NETWORK_PASSPHRASE" \
    --ignore-checks | tail -n1
}

echo "1) Deploy test token"
TOKEN_ID="$(deploy_contract "$TOKEN_WASM_PATH")"
echo "   TOKEN_ID=$TOKEN_ID"

echo "2) Init token admin"
stellar contract invoke \
  --id "$TOKEN_ID" \
  --source-account "$ADMIN_SECRET" \
  --rpc-url "$RPC_URL" \
  --network-passphrase "$NETWORK_PASSPHRASE" \
  --send=yes -- init --admin "$ADMIN_ADDR" >/dev/null

echo "3) Deploy Arka"
ARKA_ID="$(deploy_contract "$ARKA_WASM_PATH")"
echo "   ARKA_ID=$ARKA_ID"

echo "4) Init Arka for token deposit/redeem validation"
WHITELIST_JSON="$(jq -cn --arg token "$TOKEN_ID" '[$token]')"
stellar contract invoke \
  --id "$ARKA_ID" \
  --source-account "$ADMIN_SECRET" \
  --rpc-url "$RPC_URL" \
  --network-passphrase "$NETWORK_PASSPHRASE" \
  --send=yes -- init \
  --denomination_contract "$TOKEN_ID" \
  --mgmt_bps 0 \
  --perf_bps 0 \
  --deposit_bps 0 \
  --redeem_bps 0 \
  --whitelist_contracts "$WHITELIST_JSON" \
  --manager "$ADMIN_ADDR" >/dev/null

echo "5) Mint holder balance"
stellar contract invoke \
  --id "$TOKEN_ID" \
  --source-account "$ADMIN_SECRET" \
  --rpc-url "$RPC_URL" \
  --network-passphrase "$NETWORK_PASSPHRASE" \
  --send=yes -- mint --to "$HOLDER_ADDR" --amount "$HOLDER_MINT_AMOUNT" >/dev/null

echo "6) Validate direct deposit/redeem on testnet"
stellar contract invoke \
  --id "$TOKEN_ID" \
  --source-account "$HOLDER_IDENTITY" \
  --rpc-url "$RPC_URL" \
  --network-passphrase "$NETWORK_PASSPHRASE" \
  --send=yes -- approve --owner "$HOLDER_ADDR" --spender "$ARKA_ID" --amount "$VALIDATION_DEPOSIT_AMOUNT" >/dev/null

stellar contract invoke \
  --id "$ARKA_ID" \
  --source-account "$HOLDER_IDENTITY" \
  --rpc-url "$RPC_URL" \
  --network-passphrase "$NETWORK_PASSPHRASE" \
  --send=yes -- deposit --user "$HOLDER_ADDR" --asset "{\"contract\":\"$TOKEN_ID\"}" --amount "$VALIDATION_DEPOSIT_AMOUNT" >/dev/null

stellar contract invoke \
  --id "$ARKA_ID" \
  --source-account "$HOLDER_IDENTITY" \
  --rpc-url "$RPC_URL" \
  --network-passphrase "$NETWORK_PASSPHRASE" \
  --send=yes -- redeem --user "$HOLDER_ADDR" --shares "$VALIDATION_REDEEM_SHARES" >/dev/null

HOLDER_BALANCE="$(
  stellar contract invoke \
    --id "$TOKEN_ID" \
    --source-account "$HOLDER_IDENTITY" \
    --rpc-url "$RPC_URL" \
    --network-passphrase "$NETWORK_PASSPHRASE" \
    -- balance --owner "$HOLDER_ADDR" | tr -d '"'
)"

HOLDER_SHARES="$(
  stellar contract invoke \
    --id "$ARKA_ID" \
    --source-account "$HOLDER_IDENTITY" \
    --rpc-url "$RPC_URL" \
    --network-passphrase "$NETWORK_PASSPHRASE" \
    -- shares_of --user "$HOLDER_ADDR" | tr -d '"'
)"

ARKA_NAV="$(
  stellar contract invoke \
    --id "$ARKA_ID" \
    --source-account "$HOLDER_IDENTITY" \
    --rpc-url "$RPC_URL" \
    --network-passphrase "$NETWORK_PASSPHRASE" \
    -- nav | tr -d '"'
)"

ARKA_LIQUID="$(
  stellar contract invoke \
    --id "$ARKA_ID" \
    --source-account "$HOLDER_IDENTITY" \
    --rpc-url "$RPC_URL" \
    --network-passphrase "$NETWORK_PASSPHRASE" \
    -- liquid_balance --asset "$TOKEN_ID" | tr -d '"'
)"

cat >"$OUT_JSON" <<JSON
{
  "arka": "$ARKA_ID",
  "token": "$TOKEN_ID",
  "admin": "$ADMIN_ADDR",
  "holder": "$HOLDER_ADDR",
  "holderMintAmount": "$HOLDER_MINT_AMOUNT",
  "validationDepositAmount": "$VALIDATION_DEPOSIT_AMOUNT",
  "validationRedeemShares": "$VALIDATION_REDEEM_SHARES",
  "holderBalance": "$HOLDER_BALANCE",
  "holderShares": "$HOLDER_SHARES",
  "arkaNav": "$ARKA_NAV",
  "arkaLiquidBalance": "$ARKA_LIQUID"
}
JSON

echo "7) Wrote environment summary to $OUT_JSON"
