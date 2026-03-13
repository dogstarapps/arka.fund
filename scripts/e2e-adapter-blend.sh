#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
DEPLOY_JSON="${DEPLOY_JSON:-$ROOT_DIR/deployments.testnet.json}"
NETWORK_PASSPHRASE="${NETWORK_PASSPHRASE:-Test SDF Network ; September 2015}"
RPC_URL="${RPC_URL:-https://soroban-testnet.stellar.org}"
ADMIN_IDENTITY="${ADMIN_IDENTITY:-arka-admin}"
RECEIVER_IDENTITY="${RECEIVER_IDENTITY:-arka-holder}"

if [[ ! -f "$DEPLOY_JSON" ]]; then
  echo "ERROR: deployments file not found: $DEPLOY_JSON" >&2
  exit 1
fi

ADAPTER_ID="${ADAPTER_ID:-$(jq -r '.contracts.adapterBlend // empty' "$DEPLOY_JSON")}"
ROUTER_ID="${ROUTER_ID:-$(jq -r '.contracts.blendPool // .contracts.blendRouterMock // empty' "$DEPLOY_JSON")}"
MARKET_ID="${MARKET_ID:-7}"
ASSET_ID="${ASSET_ID:-CAQCFVLOBK5GIULPNZRGATJJMIZL5BSP7X5YJVMGCPTUEPFM4AVSRCJU}"
ADMIN_ADDR="${ADMIN_ADDR:-$(stellar keys address "$ADMIN_IDENTITY")}"
RECEIVER_ADDR="${RECEIVER_ADDR:-$(stellar keys address "$RECEIVER_IDENTITY")}"

if [[ -z "$ADAPTER_ID" || -z "$ROUTER_ID" ]]; then
  echo "ERROR: ADAPTER_ID and ROUTER_ID are required (or set in deployments)." >&2
  exit 1
fi

echo "Blend Adapter: $ADAPTER_ID"
echo "Blend Router (real pool preferred): $ROUTER_ID"
echo "Admin: $ADMIN_ADDR"
echo "Receiver: $RECEIVER_ADDR"

echo "1) Init adapter"
if stellar contract invoke \
  --id "$ADAPTER_ID" \
  --source-account "$ADMIN_IDENTITY" \
  --rpc-url "$RPC_URL" \
  --network-passphrase "$NETWORK_PASSPHRASE" \
  -- router >/dev/null 2>&1; then
  echo "   already initialized; skipping init"
else
  stellar contract invoke \
    --id "$ADAPTER_ID" \
    --source-account "$ADMIN_IDENTITY" \
    --rpc-url "$RPC_URL" \
    --network-passphrase "$NETWORK_PASSPHRASE" \
    --send=yes -- init --admin "$ADMIN_ADDR" --router "$ROUTER_ID"
fi

echo "2) Configure market asset and verify live pool endpoint"
stellar contract invoke \
  --id "$ADAPTER_ID" \
  --source-account "$ADMIN_IDENTITY" \
  --rpc-url "$RPC_URL" \
  --network-passphrase "$NETWORK_PASSPHRASE" \
  --send=yes -- set_market_asset --caller "$ADMIN_ADDR" --market_id "$MARKET_ID" --asset "$ASSET_ID"

stellar contract invoke \
  --id "$ADAPTER_ID" \
  --source-account "$ADMIN_IDENTITY" \
  --rpc-url "$RPC_URL" \
  --network-passphrase "$NETWORK_PASSPHRASE" \
  -- market_asset --market_id "$MARKET_ID"

stellar contract invoke \
  --id "$ROUTER_ID" \
  --source-account "$ADMIN_IDENTITY" \
  --rpc-url "$RPC_URL" \
  --network-passphrase "$NETWORK_PASSPHRASE" \
  -- get_config

echo "3) Optional live action check (requires funded/healthy account):"
echo "   stellar contract invoke --id $ADAPTER_ID ... --execute --caller $ADMIN_ADDR --action Borrow --market_id $MARKET_ID --amount 1000000 --receiver $RECEIVER_ADDR"
echo "Blend adapter E2E complete."
