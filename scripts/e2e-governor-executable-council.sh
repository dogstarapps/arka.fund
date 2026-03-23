#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
DEPLOY_JSON="${DEPLOY_JSON:-$ROOT_DIR/deployments.testnet.json}"
NETWORK_PASSPHRASE="${NETWORK_PASSPHRASE:-Test SDF Network ; September 2015}"
RPC_URL="${RPC_URL:-https://soroban-testnet.stellar.org}"
ADMIN_IDENTITY="${ADMIN_IDENTITY:-arka-admin}"
FOR_IDENTITY="${FOR_IDENTITY:-arka-holder}"

if [[ ! -f "$DEPLOY_JSON" ]]; then
  echo "ERROR: deployments file not found: $DEPLOY_JSON" >&2
  exit 1
fi

GOV_ID="${GOV_ID:-$(jq -r '.contracts.governor // empty' "$DEPLOY_JSON")}"
VOTES_ID="${VOTES_ID:-$(jq -r '.contracts.votes // empty' "$DEPLOY_JSON")}"
ADMIN_ADDR="${ADMIN_ADDR:-$(stellar keys address "$ADMIN_IDENTITY")}"
FOR_ADDR="${FOR_ADDR:-$(stellar keys address "$FOR_IDENTITY")}"

if [[ -z "$GOV_ID" || -z "$VOTES_ID" ]]; then
  echo "ERROR: GOV_ID and VOTES_ID are required." >&2
  exit 1
fi

get_latest_ledger() {
  curl -s -X POST "$RPC_URL" \
    -H 'content-type: application/json' \
    -d '{"jsonrpc":"2.0","id":1,"method":"getLatestLedger"}' \
    | python3 -c 'import sys,json; print(json.load(sys.stdin).get("result",{}).get("sequence",0))'
}

get_proposal_json() {
  local pid="$1"
  stellar contract invoke \
    --id "$GOV_ID" \
    --source-account "$ADMIN_IDENTITY" \
    --rpc-url "$RPC_URL" \
    --network-passphrase "$NETWORK_PASSPHRASE" \
    -- get_proposal --proposal_id "$pid" 2>/dev/null | tail -n1
}

wait_and_close() {
  local pid="$1"
  local pjson="$2"
  local vote_end
  vote_end=$(python3 - "$pjson" <<'PY'
import json,sys
j=json.loads(sys.argv[1])
print(j["data"]["vote_end"])
PY
)
  echo "Waiting vote_end for proposal $pid (vote_end=$vote_end)..."
  local latest
  latest="$(get_latest_ledger)"
  while [[ "$latest" -le "$vote_end" ]]; do
    echo "  latest=$latest <= vote_end=$vote_end; sleeping 15s"
    sleep 15
    latest="$(get_latest_ledger)"
  done

  set +e
  local close_out
  close_out=$(stellar contract invoke \
    --id "$GOV_ID" \
    --source-account "$ADMIN_IDENTITY" \
    --rpc-url "$RPC_URL" \
    --network-passphrase "$NETWORK_PASSPHRASE" \
    --send=yes -- close --proposal_id "$pid" 2>&1)
  local close_rc=$?
  set -e
  if [[ $close_rc -ne 0 ]]; then
    echo "$close_out" >&2
    exit 1
  fi
}

echo "Governor: $GOV_ID"
echo "Votes: $VOTES_ID"
echo "Admin voter (abstain): $ADMIN_ADDR"
echo "For voter: $FOR_ADDR"

echo "0) Ensure voting units for both voters"
stellar contract invoke \
  --id "$VOTES_ID" \
  --source-account "$ADMIN_IDENTITY" \
  --rpc-url "$RPC_URL" \
  --network-passphrase "$NETWORK_PASSPHRASE" \
  --send=yes -- mint --to "$ADMIN_ADDR" --amount 1 >/dev/null

stellar contract invoke \
  --id "$VOTES_ID" \
  --source-account "$ADMIN_IDENTITY" \
  --rpc-url "$RPC_URL" \
  --network-passphrase "$NETWORK_PASSPHRASE" \
  --send=yes -- mint --to "$FOR_ADDR" --amount 1 >/dev/null

echo "1) Close existing open proposal for creator (if any)"
for pid in $(seq 0 50); do
  pjson="$(get_proposal_json "$pid" || true)"
  if [[ -z "$pjson" ]]; then
    continue
  fi
  is_open_creator=$(python3 - "$pjson" "$ADMIN_ADDR" <<'PY'
import json,sys
j=json.loads(sys.argv[1]); creator=sys.argv[2]
d=j.get("data",{})
print("1" if d.get("creator")==creator and d.get("status")==0 else "0")
PY
)
  if [[ "$is_open_creator" == "1" ]]; then
    echo "  found open proposal id=$pid for creator=$ADMIN_ADDR"
    wait_and_close "$pid" "$pjson"
  fi
done

echo "2) Propose executable council action"
PROPOSAL_ID=$(stellar contract invoke \
  --id "$GOV_ID" \
  --source-account "$ADMIN_IDENTITY" \
  --rpc-url "$RPC_URL" \
  --network-passphrase "$NETWORK_PASSPHRASE" \
  --send=yes -- propose_council --creator "$ADMIN_ADDR" --new_council "$ADMIN_ADDR" | tr -d '"' | tr -dc '0-9')

if [[ -z "$PROPOSAL_ID" ]]; then
  echo "ERROR: failed to parse executable proposal id" >&2
  exit 1
fi
echo "Executable proposal id: $PROPOSAL_ID"

echo "3) Vote to satisfy both threshold and quorum"
stellar contract invoke \
  --id "$GOV_ID" \
  --source-account "$ADMIN_IDENTITY" \
  --rpc-url "$RPC_URL" \
  --network-passphrase "$NETWORK_PASSPHRASE" \
  --send=yes -- vote --voter "$ADMIN_ADDR" --proposal_id "$PROPOSAL_ID" --support 2 >/dev/null

stellar contract invoke \
  --id "$GOV_ID" \
  --source-account "$FOR_IDENTITY" \
  --rpc-url "$RPC_URL" \
  --network-passphrase "$NETWORK_PASSPHRASE" \
  --send=yes -- vote --voter "$FOR_ADDR" --proposal_id "$PROPOSAL_ID" --support 1 >/dev/null

echo "4) Close proposal after vote period"
PJSON="$(get_proposal_json "$PROPOSAL_ID")"
wait_and_close "$PROPOSAL_ID" "$PJSON"

echo "5) Execute proposal"
stellar contract invoke \
  --id "$GOV_ID" \
  --source-account "$ADMIN_IDENTITY" \
  --rpc-url "$RPC_URL" \
  --network-passphrase "$NETWORK_PASSPHRASE" \
  --send=yes -- execute --proposal_id "$PROPOSAL_ID"

echo "6) Verify final proposal state"
stellar contract invoke \
  --id "$GOV_ID" \
  --source-account "$ADMIN_IDENTITY" \
  --rpc-url "$RPC_URL" \
  --network-passphrase "$NETWORK_PASSPHRASE" \
  -- get_proposal --proposal_id "$PROPOSAL_ID"

echo "Governor executable council E2E complete."
