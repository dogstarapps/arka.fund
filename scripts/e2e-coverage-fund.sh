#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
DEPLOY_JSON="${DEPLOY_JSON:-$ROOT_DIR/deployments.testnet.json}"
NETWORK_PASSPHRASE="${NETWORK_PASSPHRASE:-Test SDF Network ; September 2015}"
RPC_URL="${RPC_URL:-https://soroban-testnet.stellar.org}"
ADMIN_IDENTITY="${ADMIN_IDENTITY:-arka-admin}"
STAKER_IDENTITY="${STAKER_IDENTITY:-arka-holder}"

if [[ ! -f "$DEPLOY_JSON" ]]; then
  echo "ERROR: deployments file not found: $DEPLOY_JSON" >&2
  exit 1
fi

TOKEN_ID="${TOKEN_ID:-$(jq -r '.contracts.coverageTestToken // empty' "$DEPLOY_JSON")}"
FUND_ID="${FUND_ID:-$(jq -r '.contracts.coverageFund // empty' "$DEPLOY_JSON")}"
ADMIN_ADDR="${ADMIN_ADDR:-$(stellar keys address "$ADMIN_IDENTITY")}"
STAKER_ADDR="${STAKER_ADDR:-$(stellar keys address "$STAKER_IDENTITY")}"

if [[ -z "$TOKEN_ID" || -z "$FUND_ID" ]]; then
  echo "ERROR: TOKEN_ID and FUND_ID are required (or set in deployments)." >&2
  exit 1
fi

echo "Coverage Token: $TOKEN_ID"
echo "Coverage Fund: $FUND_ID"
echo "Admin: $ADMIN_ADDR"
echo "Staker: $STAKER_ADDR"

echo "1) Initialize fund"
if stellar contract invoke \
  --id "$FUND_ID" \
  --source-account "$ADMIN_IDENTITY" \
  --rpc-url "$RPC_URL" \
  --network-passphrase "$NETWORK_PASSPHRASE" \
  -- total_staked >/dev/null 2>&1; then
  echo "   already initialized; skipping init"
else
  stellar contract invoke \
    --id "$FUND_ID" \
    --source-account "$ADMIN_IDENTITY" \
    --rpc-url "$RPC_URL" \
    --network-passphrase "$NETWORK_PASSPHRASE" \
    --send=yes -- init --admin "$ADMIN_ADDR" --stake_token "$TOKEN_ID" --reward_token "$TOKEN_ID"
fi

echo "2) Mint and approve stake/reward token"
stellar contract invoke \
  --id "$TOKEN_ID" \
  --source-account "$ADMIN_IDENTITY" \
  --rpc-url "$RPC_URL" \
  --network-passphrase "$NETWORK_PASSPHRASE" \
  --send=yes -- mint --to "$STAKER_ADDR" --amount 500

stellar contract invoke \
  --id "$TOKEN_ID" \
  --source-account "$ADMIN_IDENTITY" \
  --rpc-url "$RPC_URL" \
  --network-passphrase "$NETWORK_PASSPHRASE" \
  --send=yes -- mint --to "$ADMIN_ADDR" --amount 300

stellar contract invoke \
  --id "$TOKEN_ID" \
  --source-account "$STAKER_IDENTITY" \
  --rpc-url "$RPC_URL" \
  --network-passphrase "$NETWORK_PASSPHRASE" \
  --send=yes -- approve --owner "$STAKER_ADDR" --spender "$FUND_ID" --amount 500

stellar contract invoke \
  --id "$TOKEN_ID" \
  --source-account "$ADMIN_IDENTITY" \
  --rpc-url "$RPC_URL" \
  --network-passphrase "$NETWORK_PASSPHRASE" \
  --send=yes -- approve --owner "$ADMIN_ADDR" --spender "$FUND_ID" --amount 300

echo "3) Stake and add rewards"
stellar contract invoke \
  --id "$FUND_ID" \
  --source-account "$STAKER_IDENTITY" \
  --rpc-url "$RPC_URL" \
  --network-passphrase "$NETWORK_PASSPHRASE" \
  --send=yes -- stake --user "$STAKER_ADDR" --amount 500

stellar contract invoke \
  --id "$FUND_ID" \
  --source-account "$ADMIN_IDENTITY" \
  --rpc-url "$RPC_URL" \
  --network-passphrase "$NETWORK_PASSPHRASE" \
  --send=yes -- add_rewards --caller "$ADMIN_ADDR" --amount 200

echo "4) Claim rewards and unstake part"
stellar contract invoke \
  --id "$FUND_ID" \
  --source-account "$STAKER_IDENTITY" \
  --rpc-url "$RPC_URL" \
  --network-passphrase "$NETWORK_PASSPHRASE" \
  -- pending_reward --user "$STAKER_ADDR"

stellar contract invoke \
  --id "$FUND_ID" \
  --source-account "$STAKER_IDENTITY" \
  --rpc-url "$RPC_URL" \
  --network-passphrase "$NETWORK_PASSPHRASE" \
  --send=yes -- claim --user "$STAKER_ADDR"

stellar contract invoke \
  --id "$FUND_ID" \
  --source-account "$STAKER_IDENTITY" \
  --rpc-url "$RPC_URL" \
  --network-passphrase "$NETWORK_PASSPHRASE" \
  --send=yes -- unstake --user "$STAKER_ADDR" --amount 100

echo "5) Verify state"
stellar contract invoke \
  --id "$TOKEN_ID" \
  --source-account "$ADMIN_IDENTITY" \
  --rpc-url "$RPC_URL" \
  --network-passphrase "$NETWORK_PASSPHRASE" \
  -- balance --owner "$STAKER_ADDR"

stellar contract invoke \
  --id "$FUND_ID" \
  --source-account "$ADMIN_IDENTITY" \
  --rpc-url "$RPC_URL" \
  --network-passphrase "$NETWORK_PASSPHRASE" \
  -- stake_of --user "$STAKER_ADDR"

echo "Coverage fund E2E complete."
