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

TOKEN_ID="${TOKEN_ID:-$(jq -r '.contracts.coverageTestToken // empty' "$DEPLOY_JSON")}"
VAULT_ID="${VAULT_ID:-$(jq -r '.contracts.coverageVault // empty' "$DEPLOY_JSON")}"
ADMIN_ADDR="${ADMIN_ADDR:-$(stellar keys address "$ADMIN_IDENTITY")}"
RECEIVER_ADDR="${RECEIVER_ADDR:-$(stellar keys address "$RECEIVER_IDENTITY")}"

if [[ -z "$TOKEN_ID" || -z "$VAULT_ID" ]]; then
  echo "ERROR: TOKEN_ID and VAULT_ID are required (or set in deployments)." >&2
  exit 1
fi

echo "Coverage Token: $TOKEN_ID"
echo "Coverage Vault: $VAULT_ID"
echo "Admin: $ADMIN_ADDR"
echo "Receiver: $RECEIVER_ADDR"

echo "1) Initialize token and vault"
set +e
TOKEN_INIT_OUTPUT=$(stellar contract invoke \
  --id "$TOKEN_ID" \
  --source-account "$ADMIN_IDENTITY" \
  --rpc-url "$RPC_URL" \
  --network-passphrase "$NETWORK_PASSPHRASE" \
  --send=yes -- init --admin "$ADMIN_ADDR" 2>&1)
TOKEN_INIT_RC=$?
set -e
if [[ $TOKEN_INIT_RC -ne 0 ]]; then
  if printf '%s' "$TOKEN_INIT_OUTPUT" | grep -Eq "InvalidAction|Error\\(Contract, #1\\)|already"; then
    echo "   token already initialized; skipping init"
  else
    echo "$TOKEN_INIT_OUTPUT" >&2
    exit 1
  fi
fi

set +e
VAULT_INIT_OUTPUT=$(stellar contract invoke \
  --id "$VAULT_ID" \
  --source-account "$ADMIN_IDENTITY" \
  --rpc-url "$RPC_URL" \
  --network-passphrase "$NETWORK_PASSPHRASE" \
  --send=yes -- init --manager "$ADMIN_ADDR" --token "$TOKEN_ID" --lock_bps 2000 2>&1)
VAULT_INIT_RC=$?
set -e
if [[ $VAULT_INIT_RC -ne 0 ]]; then
  if printf '%s' "$VAULT_INIT_OUTPUT" | grep -Eq "Error\\(Contract, #1\\)|already"; then
    echo "   vault already initialized; skipping init"
  else
    echo "$VAULT_INIT_OUTPUT" >&2
    exit 1
  fi
fi

echo "2) Mint and approve token"
stellar contract invoke \
  --id "$TOKEN_ID" \
  --source-account "$ADMIN_IDENTITY" \
  --rpc-url "$RPC_URL" \
  --network-passphrase "$NETWORK_PASSPHRASE" \
  --send=yes -- mint --to "$ADMIN_ADDR" --amount 1000

stellar contract invoke \
  --id "$TOKEN_ID" \
  --source-account "$ADMIN_IDENTITY" \
  --rpc-url "$RPC_URL" \
  --network-passphrase "$NETWORK_PASSPHRASE" \
  --send=yes -- approve --owner "$ADMIN_ADDR" --spender "$VAULT_ID" --amount 1000

echo "3) Deposit and enable governor policy"
stellar contract invoke \
  --id "$VAULT_ID" \
  --source-account "$ADMIN_IDENTITY" \
  --rpc-url "$RPC_URL" \
  --network-passphrase "$NETWORK_PASSPHRASE" \
  --send=yes -- deposit --from "$ADMIN_ADDR" --amount 1000

stellar contract invoke \
  --id "$VAULT_ID" \
  --source-account "$ADMIN_IDENTITY" \
  --rpc-url "$RPC_URL" \
  --network-passphrase "$NETWORK_PASSPHRASE" \
  --send=yes -- set_governor --caller "$ADMIN_ADDR" --governor "$ADMIN_ADDR"

stellar contract invoke \
  --id "$VAULT_ID" \
  --source-account "$ADMIN_IDENTITY" \
  --rpc-url "$RPC_URL" \
  --network-passphrase "$NETWORK_PASSPHRASE" \
  --send=yes -- set_lock_bps --caller "$ADMIN_ADDR" --lock_bps 3000

echo "4) Query state and withdraw within allowed limit"
stellar contract invoke \
  --id "$VAULT_ID" \
  --source-account "$ADMIN_IDENTITY" \
  --rpc-url "$RPC_URL" \
  --network-passphrase "$NETWORK_PASSPHRASE" \
  -- balance

stellar contract invoke \
  --id "$VAULT_ID" \
  --source-account "$ADMIN_IDENTITY" \
  --rpc-url "$RPC_URL" \
  --network-passphrase "$NETWORK_PASSPHRASE" \
  -- max_withdrawable

stellar contract invoke \
  --id "$VAULT_ID" \
  --source-account "$ADMIN_IDENTITY" \
  --rpc-url "$RPC_URL" \
  --network-passphrase "$NETWORK_PASSPHRASE" \
  --send=yes -- withdraw --caller "$ADMIN_ADDR" --to "$RECEIVER_ADDR" --amount 700

echo "5) Verify post-withdraw balances"
stellar contract invoke \
  --id "$TOKEN_ID" \
  --source-account "$ADMIN_IDENTITY" \
  --rpc-url "$RPC_URL" \
  --network-passphrase "$NETWORK_PASSPHRASE" \
  -- balance --owner "$RECEIVER_ADDR"

stellar contract invoke \
  --id "$VAULT_ID" \
  --source-account "$ADMIN_IDENTITY" \
  --rpc-url "$RPC_URL" \
  --network-passphrase "$NETWORK_PASSPHRASE" \
  -- balance

echo "Coverage vault E2E complete."
