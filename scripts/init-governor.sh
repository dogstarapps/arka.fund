#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
DEPLOYMENTS_JSON="$ROOT_DIR/deployments.${NETWORK:-testnet}.json"

if ! command -v soroban >/dev/null 2>&1; then
  echo "❌ soroban CLI not found."
  exit 1
fi

NETWORK_NAME="${NETWORK:-testnet}"
RPC_URL="${RPC_URL:-https://soroban-testnet.stellar.org}"
NETWORK_PASSPHRASE="${NETWORK_PASSPHRASE:-}"
ADMIN_SECRET="${ADMIN_SECRET:-}"
ADMIN_ADDRESS="${ADMIN_ADDRESS:-}"

COUNCIL_ADDRESS="${COUNCIL_ADDRESS:-$ADMIN_ADDRESS}"

PROPOSAL_THRESHOLD="${PROPOSAL_THRESHOLD:-1}"
VOTE_DELAY="${VOTE_DELAY:-0}"
VOTE_PERIOD="${VOTE_PERIOD:-10}"
TIMELOCK="${TIMELOCK:-5}"
GRACE_PERIOD="${GRACE_PERIOD:-20}"
QUORUM_BPS="${QUORUM_BPS:-1000}"
COUNTING_TYPE="${COUNTING_TYPE:-5}"
VOTE_THRESHOLD_BPS="${VOTE_THRESHOLD_BPS:-5000}"

if [[ -z "$ADMIN_SECRET" || -z "$ADMIN_ADDRESS" ]]; then
  echo "❌ Set ADMIN_SECRET and ADMIN_ADDRESS in environment."
  exit 1
fi

if [[ -z "$NETWORK_PASSPHRASE" ]]; then
  echo "❌ Set NETWORK_PASSPHRASE (e.g. Test SDF Network ; September 2015)."
  exit 1
fi

if [[ ! -f "$DEPLOYMENTS_JSON" ]]; then
  echo "❌ Deployments file not found: $DEPLOYMENTS_JSON"
  exit 1
fi

VOTES_ID=$(jq -r '.contracts.votes' "$DEPLOYMENTS_JSON")
GOVERNOR_ID=$(jq -r '.contracts.governor' "$DEPLOYMENTS_JSON")

if [[ -z "$VOTES_ID" || "$VOTES_ID" == "null" ]]; then
  echo "❌ Votes ID not found in $DEPLOYMENTS_JSON"; exit 1; fi
if [[ -z "$GOVERNOR_ID" || "$GOVERNOR_ID" == "null" ]]; then
  echo "❌ Governor ID not found in $DEPLOYMENTS_JSON"; exit 1; fi

echo "🏁 Initializing Votes (Admin mode)..."
stellar contract invoke \
  --id "$VOTES_ID" \
  --source-account "$ADMIN_SECRET" \
  --rpc-url "$RPC_URL" \
  --network-passphrase "$NETWORK_PASSPHRASE" \
  -- initialize \
  --admin "$ADMIN_ADDRESS" \
  --governor "$GOVERNOR_ID" \
  --decimal 7 \
  --name "Arka Votes" \
  --symbol "ARKV"

echo "⚙️ Initializing Governor..."
stellar contract invoke \
  --id "$GOVERNOR_ID" \
  --source-account "$ADMIN_SECRET" \
  --rpc-url "$RPC_URL" \
  --network-passphrase "$NETWORK_PASSPHRASE" \
  -- initialize \
  --votes "$VOTES_ID" \
  --council "$COUNCIL_ADDRESS" \
  --settings "{\"proposal_threshold\":$PROPOSAL_THRESHOLD,\"vote_delay\":$VOTE_DELAY,\"vote_period\":$VOTE_PERIOD,\"timelock\":$TIMELOCK,\"grace_period\":$GRACE_PERIOD,\"quorum\":$QUORUM_BPS,\"counting_type\":$COUNTING_TYPE,\"vote_threshold\":$VOTE_THRESHOLD_BPS}"

echo "✅ Governor and Votes initialized"


