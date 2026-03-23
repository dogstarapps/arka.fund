#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
DEPLOY_JSON="${DEPLOY_JSON:-$ROOT_DIR/deployments.testnet.json}"
NETWORK_PASSPHRASE="${NETWORK_PASSPHRASE:-Test SDF Network ; September 2015}"
RPC_URL="${RPC_URL:-https://soroban-testnet.stellar.org}"
MANAGER_IDENTITY="${MANAGER_IDENTITY:-arka-admin}"

ARKA_ID="${ARKA_ID:-$(jq -r '.contracts.arka // empty' "$DEPLOY_JSON")}"
ADAPTER_ID="${ADAPTER_ID:-$(jq -r '.contracts.adapterBlend // empty' "$DEPLOY_JSON")}"
MARKET_ID="${MARKET_ID:-0}"
AMOUNT="${AMOUNT:-1000000}"
SECOND_ASSET_ID="${SECOND_ASSET_ID:-}"
SECOND_AMOUNT="${SECOND_AMOUNT:-$AMOUNT}"
BORROW_AMOUNT="${BORROW_AMOUNT:-100000}"
REPAY_AMOUNT="${REPAY_AMOUNT:-50000}"
WITHDRAW_AMOUNT="${WITHDRAW_AMOUNT:-50000}"
MANAGER_ADDR="${MANAGER_ADDR:-$(stellar keys address "$MANAGER_IDENTITY")}"

if [[ -z "$ARKA_ID" || -z "$ADAPTER_ID" ]]; then
  echo "ERROR: ARKA_ID and ADAPTER_ID are required." >&2
  exit 1
fi

if [[ -z "${ASSET_ID:-}" ]]; then
  MARKET_ASSET_RAW="$(
    stellar contract invoke \
      --id "$ADAPTER_ID" \
      --source-account "$MANAGER_IDENTITY" \
      --rpc-url "$RPC_URL" \
      --network-passphrase "$NETWORK_PASSPHRASE" \
      -- market_asset --market_id "$MARKET_ID" 2>/dev/null || true
  )"
  MARKET_ASSET="$(printf '%s' "$MARKET_ASSET_RAW" | tr -d '"')"
  if [[ -n "$MARKET_ASSET" && "$MARKET_ASSET" != "null" ]]; then
    ASSET_ID="$MARKET_ASSET"
  else
    ASSET_ID="$(jq -r '.tokens.ARKA1 // empty' "$DEPLOY_JSON")"
  fi
fi

invoke_arka() {
  stellar contract invoke \
    --id "$ARKA_ID" \
    --source-account "$MANAGER_IDENTITY" \
    --rpc-url "$RPC_URL" \
    --network-passphrase "$NETWORK_PASSPHRASE" \
    "$@"
}

echo "Arka: $ARKA_ID"
echo "Blend Adapter: $ADAPTER_ID"
echo "Market: $MARKET_ID"
echo "Asset: $ASSET_ID"
if [[ -n "$SECOND_ASSET_ID" ]]; then
  echo "Second asset: $SECOND_ASSET_ID"
fi
echo "Manager: $MANAGER_ADDR"

echo "0) Pre-state"
invoke_arka -- nav
invoke_arka -- liquid_balance --asset "$ASSET_ID"
invoke_arka -- blend_risk_policy --market_id "$MARKET_ID" || true
invoke_arka -- blend_market_status --market_id "$MARKET_ID" || true
invoke_arka -- blend_market_assets --market_id "$MARKET_ID" || true
invoke_arka -- blend_position --market_id "$MARKET_ID" --asset "$ASSET_ID" || true
invoke_arka -- blend_position_value --market_id "$MARKET_ID" --asset "$ASSET_ID" || true
invoke_arka -- blend_position_values --market_id "$MARKET_ID" || true
invoke_arka -- blend_market_value --market_id "$MARKET_ID" || true
invoke_arka -- blend_health_factor --market_id "$MARKET_ID" || true

echo "1) Lend from vault"
invoke_arka \
  --send=yes -- blend_lend \
  --manager "$MANAGER_ADDR" \
  --adapter "$ADAPTER_ID" \
  --market_id "$MARKET_ID" \
  --asset "$ASSET_ID" \
  --amount "$AMOUNT"
invoke_arka -- blend_position --market_id "$MARKET_ID" --asset "$ASSET_ID"

echo "2) Borrow into vault"
invoke_arka \
  --send=yes -- blend_borrow \
  --manager "$MANAGER_ADDR" \
  --adapter "$ADAPTER_ID" \
  --market_id "$MARKET_ID" \
  --asset "$ASSET_ID" \
  --amount "$BORROW_AMOUNT"
invoke_arka -- blend_position --market_id "$MARKET_ID" --asset "$ASSET_ID"

echo "3) Repay from vault"
invoke_arka \
  --send=yes -- blend_repay \
  --manager "$MANAGER_ADDR" \
  --adapter "$ADAPTER_ID" \
  --market_id "$MARKET_ID" \
  --asset "$ASSET_ID" \
  --amount "$REPAY_AMOUNT"
invoke_arka -- blend_position --market_id "$MARKET_ID" --asset "$ASSET_ID"

echo "4) Withdraw collateral back to vault"
invoke_arka \
  --send=yes -- blend_withdraw \
  --manager "$MANAGER_ADDR" \
  --adapter "$ADAPTER_ID" \
  --market_id "$MARKET_ID" \
  --asset "$ASSET_ID" \
  --amount "$WITHDRAW_AMOUNT"
invoke_arka -- blend_position --market_id "$MARKET_ID" --asset "$ASSET_ID" || true

if [[ -n "$SECOND_ASSET_ID" ]]; then
  echo "4b) Second asset lend into same market"
  invoke_arka \
    --send=yes -- blend_lend \
    --manager "$MANAGER_ADDR" \
    --adapter "$ADAPTER_ID" \
    --market_id "$MARKET_ID" \
    --asset "$SECOND_ASSET_ID" \
    --amount "$SECOND_AMOUNT"
  invoke_arka -- blend_position --market_id "$MARKET_ID" --asset "$SECOND_ASSET_ID"
fi

echo "5) Post-state"
invoke_arka -- nav
invoke_arka -- liquid_balance --asset "$ASSET_ID"
if [[ -n "$SECOND_ASSET_ID" ]]; then
  invoke_arka -- liquid_balance --asset "$SECOND_ASSET_ID"
  invoke_arka -- blend_position_value --market_id "$MARKET_ID" --asset "$SECOND_ASSET_ID" || true
fi
invoke_arka -- blend_risk_policy --market_id "$MARKET_ID" || true
invoke_arka -- blend_market_status --market_id "$MARKET_ID" || true
invoke_arka -- blend_market_assets --market_id "$MARKET_ID" || true
invoke_arka -- blend_position_values --market_id "$MARKET_ID" || true
invoke_arka -- blend_market_value --market_id "$MARKET_ID" || true
invoke_arka -- blend_position_value --market_id "$MARKET_ID" --asset "$ASSET_ID" || true
invoke_arka -- blend_health_factor --market_id "$MARKET_ID" || true

echo "Blend vault position E2E complete."
