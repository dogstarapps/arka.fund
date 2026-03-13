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

ADAPTER_ID="${ADAPTER_ID:-$(jq -r '.contracts.adapterBalanced // empty' "$DEPLOY_JSON")}"
ROUTER_ID="${ROUTER_ID:-$(jq -r '.contracts.cometPool // .contracts.balancedRouterMock // empty' "$DEPLOY_JSON")}"
TOKEN_IN="${TOKEN_IN:-CB22KRA3YZVCNCQI64JQ5WE7UY2VAV7WFLK6A2JN3HEX56T2EDAFO7QF}"
TOKEN_OUT="${TOKEN_OUT:-CAQCFVLOBK5GIULPNZRGATJJMIZL5BSP7X5YJVMGCPTUEPFM4AVSRCJU}"
ADMIN_ADDR="${ADMIN_ADDR:-$(stellar keys address "$ADMIN_IDENTITY")}"
RECEIVER_ADDR="${RECEIVER_ADDR:-$(stellar keys address "$RECEIVER_IDENTITY")}"

if [[ -z "$ADAPTER_ID" || -z "$ROUTER_ID" ]]; then
  echo "ERROR: ADAPTER_ID and ROUTER_ID are required (or set in deployments)." >&2
  exit 1
fi

echo "Balanced Adapter: $ADAPTER_ID"
echo "Balanced Router (real Comet pool preferred): $ROUTER_ID"
echo "Admin: $ADMIN_ADDR"
echo "Receiver: $RECEIVER_ADDR"

echo "1) Init adapter with admin/router"
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

echo "2) Configure real pair mapping and verify routing"
stellar contract invoke \
  --id "$ADAPTER_ID" \
  --source-account "$ADMIN_IDENTITY" \
  --rpc-url "$RPC_URL" \
  --network-passphrase "$NETWORK_PASSPHRASE" \
  -- router

stellar contract invoke \
  --id "$ADAPTER_ID" \
  --source-account "$ADMIN_IDENTITY" \
  --rpc-url "$RPC_URL" \
  --network-passphrase "$NETWORK_PASSPHRASE" \
  --send=yes -- set_pair \
  --caller "$ADMIN_ADDR" \
  --pool_id 1 \
  --token_in "$TOKEN_IN" \
  --token_out "$TOKEN_OUT" \
  --max_price 1000000000000000000

stellar contract invoke \
  --id "$ADAPTER_ID" \
  --source-account "$ADMIN_IDENTITY" \
  --rpc-url "$RPC_URL" \
  --network-passphrase "$NETWORK_PASSPHRASE" \
  -- pair_of --pool_id 1

stellar contract invoke \
  --id "$ROUTER_ID" \
  --source-account "$ADMIN_IDENTITY" \
  --rpc-url "$RPC_URL" \
  --network-passphrase "$NETWORK_PASSPHRASE" \
  -- get_spot_price --token_in "$TOKEN_IN" --token_out "$TOKEN_OUT"

echo "3) Optional live swap check (requires token_in balance on caller):"
echo "   stellar contract invoke --id $ADAPTER_ID ... --execute --pool_id 1 --amount_in 1000000 --min_out 1 --receiver $RECEIVER_ADDR"
echo "Balanced adapter E2E complete."
