#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
NETWORK_PASSPHRASE="${GOVERNANCE_NETWORK_PASSPHRASE:-Test SDF Network ; September 2015}"
RPC_URL="${GOVERNANCE_RPC_URL:-https://soroban-testnet.stellar.org}"
ADMIN_IDENTITY="${ADMIN_IDENTITY:-arka-admin}"
FOR_IDENTITY="${FOR_IDENTITY:-arka-holder}"
VOTES_WASM_PATH="${VOTES_WASM_PATH:-$ROOT_DIR/artifacts/votes.wasm}"
GOVERNOR_WASM_PATH="${GOVERNOR_WASM_PATH:-$ROOT_DIR/artifacts/governor.wasm}"
OUT_JSON="${OUT_JSON:-$ROOT_DIR/tmp/governance-live-validation.json}"
DEPLOY_JSON="${DEPLOY_JSON:-$ROOT_DIR/deployments.testnet.json}"

PROPOSAL_THRESHOLD="${PROPOSAL_THRESHOLD:-1}"
VOTE_DELAY="${VOTE_DELAY:-0}"
VOTE_PERIOD="${VOTE_PERIOD:-720}"
TIMELOCK="${TIMELOCK:-5}"
GRACE_PERIOD="${GRACE_PERIOD:-17280}"
QUORUM_BPS="${QUORUM_BPS:-100}"
COUNTING_TYPE="${COUNTING_TYPE:-5}"
VOTE_THRESHOLD_BPS="${VOTE_THRESHOLD_BPS:-5100}"

mkdir -p "$(dirname "$OUT_JSON")"

if [[ ! -f "$VOTES_WASM_PATH" || ! -f "$GOVERNOR_WASM_PATH" ]]; then
  echo "ERROR: missing wasm artifacts. Expected $VOTES_WASM_PATH and $GOVERNOR_WASM_PATH" >&2
  exit 1
fi

ADMIN_SECRET="$(stellar keys secret "$ADMIN_IDENTITY")"
ADMIN_ADDR="$(stellar keys address "$ADMIN_IDENTITY")"
FOR_ADDR="$(stellar keys address "$FOR_IDENTITY")"
COUNCIL_ADDR="${COUNCIL_ADDR:-$(jq -r '.contracts.arkaFactory // empty' "$DEPLOY_JSON" 2>/dev/null)}"
if [[ -z "$COUNCIL_ADDR" || "$COUNCIL_ADDR" == "null" ]]; then
  COUNCIL_ADDR="$ADMIN_ADDR"
fi

deploy_contract() {
  local wasm_path="$1"
  stellar contract deploy \
    --wasm "$wasm_path" \
    --source-account "$ADMIN_SECRET" \
    --rpc-url "$RPC_URL" \
    --network-passphrase "$NETWORK_PASSPHRASE" \
    --ignore-checks | tail -n1
}

echo "1) Deploy Votes and Governor"
VOTES_ID="$(deploy_contract "$VOTES_WASM_PATH")"
GOVERNOR_ID="$(deploy_contract "$GOVERNOR_WASM_PATH")"
echo "   VOTES_ID=$VOTES_ID"
echo "   GOVERNOR_ID=$GOVERNOR_ID"

echo "2) Initialize Votes"
stellar contract invoke \
  --id "$VOTES_ID" \
  --source-account "$ADMIN_SECRET" \
  --rpc-url "$RPC_URL" \
  --network-passphrase "$NETWORK_PASSPHRASE" \
  --send=yes -- initialize \
  --admin "$ADMIN_ADDR" \
  --governor "$GOVERNOR_ID" \
  --decimal 7 \
  --name "Arka Votes E2E" \
  --symbol "ARKVE2E" >/dev/null

echo "3) Initialize Governor"
stellar contract invoke \
  --id "$GOVERNOR_ID" \
  --source-account "$ADMIN_SECRET" \
  --rpc-url "$RPC_URL" \
  --network-passphrase "$NETWORK_PASSPHRASE" \
  --send=yes -- initialize_simple \
  --votes "$VOTES_ID" \
  --council "$COUNCIL_ADDR" \
  --proposal_threshold "$PROPOSAL_THRESHOLD" \
  --vote_delay "$VOTE_DELAY" \
  --vote_period "$VOTE_PERIOD" \
  --timelock "$TIMELOCK" \
  --grace_period "$GRACE_PERIOD" \
  --quorum "$QUORUM_BPS" \
  --counting_type "$COUNTING_TYPE" \
  --vote_threshold "$VOTE_THRESHOLD_BPS" >/dev/null

echo "4) Mint voting units"
stellar contract invoke \
  --id "$VOTES_ID" \
  --source-account "$ADMIN_SECRET" \
  --rpc-url "$RPC_URL" \
  --network-passphrase "$NETWORK_PASSPHRASE" \
  --send=yes -- mint --to "$ADMIN_ADDR" --amount 1 >/dev/null

stellar contract invoke \
  --id "$VOTES_ID" \
  --source-account "$ADMIN_SECRET" \
  --rpc-url "$RPC_URL" \
  --network-passphrase "$NETWORK_PASSPHRASE" \
  --send=yes -- mint --to "$FOR_ADDR" --amount 1 >/dev/null

cat >"$OUT_JSON" <<JSON
{
  "governor": "$GOVERNOR_ID",
  "votes": "$VOTES_ID",
  "council": "$COUNCIL_ADDR",
  "proposerAddress": "$ADMIN_ADDR",
  "forVoterAddress": "$FOR_ADDR",
  "proposalThreshold": $PROPOSAL_THRESHOLD,
  "voteDelay": $VOTE_DELAY,
  "votePeriod": $VOTE_PERIOD,
  "timelock": $TIMELOCK,
  "gracePeriod": $GRACE_PERIOD,
  "quorumBps": $QUORUM_BPS,
  "countingType": $COUNTING_TYPE,
  "voteThresholdBps": $VOTE_THRESHOLD_BPS
}
JSON

echo "5) Wrote environment summary to $OUT_JSON"
