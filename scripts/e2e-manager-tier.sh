#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
DEPLOY_JSON="${DEPLOY_JSON:-$ROOT_DIR/deployments.testnet.json}"
NETWORK_PASSPHRASE="${NETWORK_PASSPHRASE:-Test SDF Network ; September 2015}"
RPC_URL="${RPC_URL:-https://soroban-testnet.stellar.org}"
ADMIN_IDENTITY="${ADMIN_IDENTITY:-arka-admin}"
MANAGER_IDENTITY="${MANAGER_IDENTITY:-arka-holder}"

if [[ ! -f "$DEPLOY_JSON" ]]; then
  echo "ERROR: deployments file not found: $DEPLOY_JSON" >&2
  exit 1
fi

MANAGER_TIER_ID="${MANAGER_TIER_ID:-$(jq -r '.contracts.managerTier // empty' "$DEPLOY_JSON")}"
ADMIN_ADDR="${ADMIN_ADDR:-$(stellar keys address "$ADMIN_IDENTITY")}"
MANAGER_ADDR="${MANAGER_ADDR:-$(stellar keys address "$MANAGER_IDENTITY")}"

if [[ -z "$MANAGER_TIER_ID" ]]; then
  echo "ERROR: managerTier contract id missing." >&2
  exit 1
fi

echo "ManagerTier: $MANAGER_TIER_ID"
echo "Admin: $ADMIN_ADDR"
echo "Manager: $MANAGER_ADDR"

echo "1) Initialize and set governor"
if stellar contract invoke \
  --id "$MANAGER_TIER_ID" \
  --source-account "$ADMIN_IDENTITY" \
  --rpc-url "$RPC_URL" \
  --network-passphrase "$NETWORK_PASSPHRASE" \
  -- thresholds >/dev/null 2>&1; then
  echo "   already initialized; skipping init"
else
  stellar contract invoke \
    --id "$MANAGER_TIER_ID" \
    --source-account "$ADMIN_IDENTITY" \
    --rpc-url "$RPC_URL" \
    --network-passphrase "$NETWORK_PASSPHRASE" \
    --send=yes -- init --admin "$ADMIN_ADDR" --tier1_threshold 100 --tier2_threshold 500 --tier3_threshold 1000
fi

stellar contract invoke \
  --id "$MANAGER_TIER_ID" \
  --source-account "$ADMIN_IDENTITY" \
  --rpc-url "$RPC_URL" \
  --network-passphrase "$NETWORK_PASSPHRASE" \
  --send=yes -- set_governor --caller "$ADMIN_ADDR" --governor "$ADMIN_ADDR"

echo "2) Add points and verify tier progression"
stellar contract invoke \
  --id "$MANAGER_TIER_ID" \
  --source-account "$ADMIN_IDENTITY" \
  --rpc-url "$RPC_URL" \
  --network-passphrase "$NETWORK_PASSPHRASE" \
  --send=yes -- add_points --caller "$ADMIN_ADDR" --manager "$MANAGER_ADDR" --delta 120

stellar contract invoke \
  --id "$MANAGER_TIER_ID" \
  --source-account "$ADMIN_IDENTITY" \
  --rpc-url "$RPC_URL" \
  --network-passphrase "$NETWORK_PASSPHRASE" \
  -- tier_of --manager "$MANAGER_ADDR"

stellar contract invoke \
  --id "$MANAGER_TIER_ID" \
  --source-account "$ADMIN_IDENTITY" \
  --rpc-url "$RPC_URL" \
  --network-passphrase "$NETWORK_PASSPHRASE" \
  --send=yes -- add_points --caller "$ADMIN_ADDR" --manager "$MANAGER_ADDR" --delta 900

stellar contract invoke \
  --id "$MANAGER_TIER_ID" \
  --source-account "$ADMIN_IDENTITY" \
  --rpc-url "$RPC_URL" \
  --network-passphrase "$NETWORK_PASSPHRASE" \
  -- points_of --manager "$MANAGER_ADDR"

stellar contract invoke \
  --id "$MANAGER_TIER_ID" \
  --source-account "$ADMIN_IDENTITY" \
  --rpc-url "$RPC_URL" \
  --network-passphrase "$NETWORK_PASSPHRASE" \
  -- tier_of --manager "$MANAGER_ADDR"

echo "3) Optional negative check (expected failure): invalid thresholds"
echo "   stellar contract invoke --id $MANAGER_TIER_ID ... --set_thresholds --tier1_threshold 500 --tier2_threshold 100 --tier3_threshold 1000"
echo "Manager tier E2E complete."
