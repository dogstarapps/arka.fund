#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
DEPLOY_JSON="${DEPLOY_JSON:-$ROOT_DIR/deployments.testnet.json}"
NETWORK_PASSPHRASE="${NETWORK_PASSPHRASE:-Test SDF Network ; September 2015}"
RPC_URL="${RPC_URL:-https://soroban-testnet.stellar.org}"
ADMIN_IDENTITY="${ADMIN_IDENTITY:-arka-admin}"

if [[ ! -f "$DEPLOY_JSON" ]]; then
  echo "ERROR: deployments file not found: $DEPLOY_JSON" >&2
  exit 1
fi

GOV_ID="${GOV_ID:-$(jq -r '.contracts.governor // empty' "$DEPLOY_JSON")}"
ADMIN_ADDR="${ADMIN_ADDR:-$(stellar keys address "$ADMIN_IDENTITY")}"

if [[ -z "$GOV_ID" ]]; then
  echo "ERROR: GOV_ID missing in deployments." >&2
  exit 1
fi

echo "Governor: $GOV_ID"
echo "Admin: $ADMIN_ADDR"

echo "1) Propose snapshot"
set +e
PROPOSAL_OUTPUT=$(stellar contract invoke \
  --id "$GOV_ID" \
  --source-account "$ADMIN_IDENTITY" \
  --rpc-url "$RPC_URL" \
  --network-passphrase "$NETWORK_PASSPHRASE" \
  --send=yes -- propose_snapshot_self --creator "$ADMIN_ADDR" 2>&1)
PROPOSE_RC=$?
set -e

PROPOSAL_ID=""
if [[ $PROPOSE_RC -eq 0 ]]; then
  PROPOSAL_ID=$(printf '%s\n' "$PROPOSAL_OUTPUT" | awk '/^[[:space:]]*"?[0-9]+"?[[:space:]]*$/ {print}' | tail -n1 | tr -d '"' | tr -d ' ')
else
  if printf '%s' "$PROPOSAL_OUTPUT" | grep -Eq "ProposalAlreadyOpenError|Error\\(Contract, #211\\)"; then
    echo "   proposal already open; locating existing open proposal for creator..."
    for pid in $(seq 0 50); do
      set +e
      PJSON=$(stellar contract invoke \
        --id "$GOV_ID" \
        --source-account "$ADMIN_IDENTITY" \
        --rpc-url "$RPC_URL" \
        --network-passphrase "$NETWORK_PASSPHRASE" \
        -- get_proposal --proposal_id "$pid" 2>/dev/null)
      PRC=$?
      set -e
      if [[ $PRC -ne 0 || -z "$PJSON" ]]; then
        continue
      fi
      MATCH=$(python3 - "$PJSON" "$ADMIN_ADDR" <<'PY'
import json,sys
raw=sys.argv[1]
creator=sys.argv[2]
try:
    j=json.loads(raw.strip().splitlines()[-1])
    if j.get("data",{}).get("creator")==creator and j.get("data",{}).get("status")==0:
        print(j.get("id"))
except Exception:
    pass
PY
)
      if [[ -n "$MATCH" ]]; then
        PROPOSAL_ID="$MATCH"
      fi
    done
  else
    echo "$PROPOSAL_OUTPUT" >&2
    exit 1
  fi
fi

if [[ -z "$PROPOSAL_ID" ]]; then
  echo "ERROR: could not determine proposal id." >&2
  exit 1
fi
echo "Proposal ID: $PROPOSAL_ID"

echo "2) Vote FOR"
set +e
VOTE_OUTPUT=$(stellar contract invoke \
  --id "$GOV_ID" \
  --source-account "$ADMIN_IDENTITY" \
  --rpc-url "$RPC_URL" \
  --network-passphrase "$NETWORK_PASSPHRASE" \
  --send=yes -- vote --voter "$ADMIN_ADDR" --proposal_id "$PROPOSAL_ID" --support 1 2>&1)
VOTE_RC=$?
set -e
if [[ $VOTE_RC -ne 0 ]]; then
  if printf '%s' "$VOTE_OUTPUT" | grep -Eq "AlreadyVotedError|Error\\(Contract, #209\\)"; then
    echo "   already voted; continuing"
  else
    echo "$VOTE_OUTPUT" >&2
    exit 1
  fi
fi

echo "3) Close when vote period is finished"
CLOSED=0
for attempt in $(seq 1 40); do
  set +e
  CLOSE_OUTPUT=$(stellar contract invoke \
    --id "$GOV_ID" \
    --source-account "$ADMIN_IDENTITY" \
    --rpc-url "$RPC_URL" \
    --network-passphrase "$NETWORK_PASSPHRASE" \
    --send=yes -- close --proposal_id "$PROPOSAL_ID" 2>&1)
  CLOSE_RC=$?
  set -e
  if [[ $CLOSE_RC -eq 0 ]]; then
    echo "Closed proposal on attempt $attempt"
    CLOSED=1
    break
  fi
  if printf '%s' "$CLOSE_OUTPUT" | grep -Eq "VotePeriodNotFinishedError|Error\\(Contract, #204\\)"; then
    echo "   vote period still open (attempt $attempt), retrying..."
    sleep 3
    continue
  fi
  echo "$CLOSE_OUTPUT" >&2
  exit 1
done

if [[ $CLOSED -eq 0 ]]; then
  echo "Close not executed yet (vote period still open within retry window); this is expected for long vote periods."
fi

echo "4) Verify proposal and vote state"
stellar contract invoke \
  --id "$GOV_ID" \
  --source-account "$ADMIN_IDENTITY" \
  --rpc-url "$RPC_URL" \
  --network-passphrase "$NETWORK_PASSPHRASE" \
  -- get_vote --voter "$ADMIN_ADDR" --proposal_id "$PROPOSAL_ID"

stellar contract invoke \
  --id "$GOV_ID" \
  --source-account "$ADMIN_IDENTITY" \
  --rpc-url "$RPC_URL" \
  --network-passphrase "$NETWORK_PASSPHRASE" \
  -- get_proposal --proposal_id "$PROPOSAL_ID"

echo "Governor snapshot E2E complete."
