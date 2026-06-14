#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
DEPLOY_JSON="${DEPLOY_JSON:-$ROOT_DIR/deployments.testnet.json}"
OUT_JSON="${OUT_JSON:-$ROOT_DIR/tmp/governance-handoff-live-validation.json}"
NETWORK_PASSPHRASE="${VALIDATION_NETWORK_PASSPHRASE:-Test SDF Network ; September 2015}"
RPC_URL="${VALIDATION_RPC_URL:-https://soroban-testnet.stellar.org}"
ADMIN_IDENTITY="${ADMIN_IDENTITY:-arka-admin}"
HOLDER_IDENTITY="${HOLDER_IDENTITY:-arka-holder}"
TS_NODE_TRANSPILE_ONLY="${TS_NODE_TRANSPILE_ONLY:-1}"
TS_NODE_COMPILER_OPTIONS="${TS_NODE_COMPILER_OPTIONS:-{\"module\":\"nodenext\",\"moduleResolution\":\"nodenext\",\"allowImportingTsExtensions\":true}}"

GOVERNOR_ID="${GOVERNOR_ID:?missing GOVERNOR_ID}"
GOVERNANCE_EXECUTOR_ID="${GOVERNANCE_EXECUTOR_ID:?missing GOVERNANCE_EXECUTOR_ID}"
ARKA_TOKEN_ID="${ARKA_TOKEN_ID:?missing ARKA_TOKEN_ID}"
LOCKED_ARKA_ID="${LOCKED_ARKA_ID:?missing LOCKED_ARKA_ID}"
PROPOSAL_ID="${PROPOSAL_ID:?missing PROPOSAL_ID}"
OPERATION_ID_HEX="${OPERATION_ID_HEX:?missing OPERATION_ID_HEX}"
PROPOSAL_TX_HASH="${PROPOSAL_TX_HASH:-}"

INITIAL_MINT="${INITIAL_MINT:-100}"
EXECUTOR_MINT="${EXECUTOR_MINT:-120}"
INCREASE_AMOUNT="${INCREASE_AMOUNT:-100}"
EXECUTOR_MIN_DELAY="${EXECUTOR_MIN_DELAY:-2}"
RELOCK_EXTENSION="${RELOCK_EXTENSION:-400}"

mkdir -p "$(dirname "$OUT_JSON")"

ADMIN_ADDR="$(stellar keys address "$ADMIN_IDENTITY")"
HOLDER_ADDR="$(stellar keys address "$HOLDER_IDENTITY")"

get_latest_ledger() {
  curl -s -X POST "$RPC_URL" \
    -H 'content-type: application/json' \
    -d '{"jsonrpc":"2.0","id":1,"method":"getLatestLedger"}' \
    | python3 -c 'import json,sys; print(json.load(sys.stdin).get("result",{}).get("sequence",0))'
}

wait_until_ledger() {
  local target="$1"
  local label="$2"
  local latest
  latest="$(get_latest_ledger)"
  while [[ "$latest" -lt "$target" ]]; do
    echo "  latest=$latest < $label=$target; sleeping 5s"
    sleep 5
    latest="$(get_latest_ledger)"
  done
}

get_proposal_json() {
  (
    cd "$ROOT_DIR/scripts/js" && \
      TS_NODE_TRANSPILE_ONLY="$TS_NODE_TRANSPILE_ONLY" \
      TS_NODE_COMPILER_OPTIONS="$TS_NODE_COMPILER_OPTIONS" \
      PUBLIC_KEY="$ADMIN_ADDR" \
      GOV_ID="$GOVERNOR_ID" \
      PROPOSAL_ID="$PROPOSAL_ID" \
      node --loader ts-node/esm getGovernorProposal.ts
  )
}

echo "1) Resume governance handoff validation from existing live proposal"
echo "   GOVERNOR_ID=$GOVERNOR_ID"
echo "   GOVERNANCE_EXECUTOR_ID=$GOVERNANCE_EXECUTOR_ID"
echo "   ARKA_TOKEN_ID=$ARKA_TOKEN_ID"
echo "   LOCKED_ARKA_ID=$LOCKED_ARKA_ID"
echo "   PROPOSAL_ID=$PROPOSAL_ID"

PJSON="$(get_proposal_json)"
PROPOSAL_STATUS="$(python3 - "$PJSON" <<'PY'
import json,sys
j=json.loads(sys.argv[1])
print(j["data"]["status"])
PY
)"
VOTE_END="$(python3 - "$PJSON" <<'PY'
import json,sys
j=json.loads(sys.argv[1])
print(j["data"]["vote_end"])
PY
)"

if [[ "$PROPOSAL_STATUS" == "0" ]]; then
  echo "2) Wait for vote window to end and close the proposal"
  wait_until_ledger "$(( VOTE_END + 1 ))" "vote_end+1"

  stellar contract invoke \
    --id "$GOVERNOR_ID" \
    --source-account "$ADMIN_IDENTITY" \
    --rpc-url "$RPC_URL" \
    --network-passphrase "$NETWORK_PASSPHRASE" \
    --send=yes -- close \
    --proposal_id "$PROPOSAL_ID" >/dev/null

  PJSON="$(get_proposal_json)"
  PROPOSAL_STATUS="$(python3 - "$PJSON" <<'PY'
import json,sys
j=json.loads(sys.argv[1])
print(j["data"]["status"])
PY
)"
fi

if [[ "$PROPOSAL_STATUS" == "1" ]]; then
  ETA="$(python3 - "$PJSON" <<'PY'
import json,sys
j=json.loads(sys.argv[1])
print(j["data"]["eta"])
PY
)"

  echo "3) Wait for governor ETA and execute the proposal"
  wait_until_ledger "$ETA" "eta"

  stellar contract invoke \
    --id "$GOVERNOR_ID" \
    --source-account "$ADMIN_IDENTITY" \
    --rpc-url "$RPC_URL" \
    --network-passphrase "$NETWORK_PASSPHRASE" \
    --send=yes -- execute \
    --proposal_id "$PROPOSAL_ID" >/dev/null

  SCHEDULE_LEDGER="$(get_latest_ledger)"
elif [[ "$PROPOSAL_STATUS" == "4" ]]; then
  echo "2) Proposal already executed on testnet; resuming post-execution verification"
  SCHEDULE_LEDGER="$(get_latest_ledger)"
else
  echo "ERROR: unsupported proposal status for resume: $PROPOSAL_STATUS" >&2
  exit 1
fi

echo "4) Wait for executor delay and execute the queued operation"
if [[ "$PROPOSAL_STATUS" == "1" ]]; then
  wait_until_ledger "$(( SCHEDULE_LEDGER + EXECUTOR_MIN_DELAY ))" "executor_ready"

  stellar contract invoke \
    --id "$GOVERNANCE_EXECUTOR_ID" \
    --source-account "$ADMIN_IDENTITY" \
    --rpc-url "$RPC_URL" \
    --network-passphrase "$NETWORK_PASSPHRASE" \
    --send=yes -- execute \
    --operation_id "$OPERATION_ID_HEX" >/dev/null
else
  echo "   executor action already scheduled/executed; continuing"
fi

echo "5) Lock newly minted ARKA and verify live voting power"
LIQUID_BEFORE="$(stellar contract invoke \
  --id "$ARKA_TOKEN_ID" \
  --source-account "$ADMIN_IDENTITY" \
  --rpc-url "$RPC_URL" \
  --network-passphrase "$NETWORK_PASSPHRASE" \
  -- balance --owner "$HOLDER_ADDR" | tail -n1 | tr -d '\" ')"

LOCKED_BEFORE="$(stellar contract invoke \
  --id "$LOCKED_ARKA_ID" \
  --source-account "$ADMIN_IDENTITY" \
  --rpc-url "$RPC_URL" \
  --network-passphrase "$NETWORK_PASSPHRASE" \
  -- locked_balance --account "$HOLDER_ADDR" | tail -n1 | tr -d '\" ')"

if stellar contract invoke \
  --id "$LOCKED_ARKA_ID" \
  --source-account "$HOLDER_IDENTITY" \
  --rpc-url "$RPC_URL" \
  --network-passphrase "$NETWORK_PASSPHRASE" \
  --send=yes -- increase_amount \
  --account "$HOLDER_ADDR" \
  --amount "$INCREASE_AMOUNT" >/dev/null 2>&1; then
  EXPECTED_CURRENT="$(( LOCKED_BEFORE + INCREASE_AMOUNT ))"
  EXPECTED_LIQUID="$(( LIQUID_BEFORE - INCREASE_AMOUNT ))"
else
  TOTAL_RELOCK="$(( LIQUID_BEFORE + LOCKED_BEFORE ))"
  if [[ "$LOCKED_BEFORE" -gt 0 ]]; then
    stellar contract invoke \
      --id "$LOCKED_ARKA_ID" \
      --source-account "$HOLDER_IDENTITY" \
      --rpc-url "$RPC_URL" \
      --network-passphrase "$NETWORK_PASSPHRASE" \
      --send=yes -- withdraw \
      --account "$HOLDER_ADDR" >/dev/null
  fi
  if [[ "$TOTAL_RELOCK" -le 0 ]]; then
    echo "ERROR: cannot relock zero balance after executor execution" >&2
    exit 1
  fi
  NEW_UNLOCK_LEDGER="$(( $(get_latest_ledger) + RELOCK_EXTENSION ))"
  stellar contract invoke \
    --id "$LOCKED_ARKA_ID" \
    --source-account "$HOLDER_IDENTITY" \
    --rpc-url "$RPC_URL" \
    --network-passphrase "$NETWORK_PASSPHRASE" \
    --send=yes -- create_lock \
    --account "$HOLDER_ADDR" \
    --amount "$TOTAL_RELOCK" \
    --unlock_ledger "$NEW_UNLOCK_LEDGER" >/dev/null
  EXPECTED_CURRENT="$TOTAL_RELOCK"
  EXPECTED_LIQUID="0"
fi

CURRENT_VOTES="$(stellar contract invoke \
  --id "$LOCKED_ARKA_ID" \
  --source-account "$ADMIN_IDENTITY" \
  --rpc-url "$RPC_URL" \
  --network-passphrase "$NETWORK_PASSPHRASE" \
  -- get_votes --account "$HOLDER_ADDR" | tail -n1 | tr -d '\" ')"

LIQUID_BALANCE="$(stellar contract invoke \
  --id "$ARKA_TOKEN_ID" \
  --source-account "$ADMIN_IDENTITY" \
  --rpc-url "$RPC_URL" \
  --network-passphrase "$NETWORK_PASSPHRASE" \
  -- balance --owner "$HOLDER_ADDR" | tail -n1 | tr -d '\" ')"

LOCKED_BALANCE="$(stellar contract invoke \
  --id "$LOCKED_ARKA_ID" \
  --source-account "$ADMIN_IDENTITY" \
  --rpc-url "$RPC_URL" \
  --network-passphrase "$NETWORK_PASSPHRASE" \
  -- locked_balance --account "$HOLDER_ADDR" | tail -n1 | tr -d '\" ')"

if [[ "$CURRENT_VOTES" != "$EXPECTED_CURRENT" ]]; then
  echo "ERROR: current votes $CURRENT_VOTES != expected $EXPECTED_CURRENT" >&2
  exit 1
fi
if [[ "$LIQUID_BALANCE" != "$EXPECTED_LIQUID" ]]; then
  echo "ERROR: liquid balance $LIQUID_BALANCE != expected $EXPECTED_LIQUID" >&2
  exit 1
fi
if [[ "$LOCKED_BALANCE" != "$EXPECTED_CURRENT" ]]; then
  echo "ERROR: locked balance $LOCKED_BALANCE != expected $EXPECTED_CURRENT" >&2
  exit 1
fi

VALIDATED_AT="$(date -u '+%Y-%m-%d')"
python3 - "$OUT_JSON" "$DEPLOY_JSON" <<PY
import json, sys
out_path, deploy_path = sys.argv[1], sys.argv[2]
record = {
  "validatedAt": "${VALIDATED_AT}",
  "network": "testnet",
  "rpcUrl": "${RPC_URL}",
  "adminIdentity": "${ADMIN_IDENTITY}",
  "holderIdentity": "${HOLDER_IDENTITY}",
  "contracts": {
    "governor": "${GOVERNOR_ID}",
    "governanceExecutor": "${GOVERNANCE_EXECUTOR_ID}",
    "arkaToken": "${ARKA_TOKEN_ID}",
    "lockedArka": "${LOCKED_ARKA_ID}",
  },
  "proposal": {
    "proposalId": int("${PROPOSAL_ID}"),
    "proposalTxHash": "${PROPOSAL_TX_HASH}",
    "operationIdHex": "${OPERATION_ID_HEX}",
  },
  "results": {
    "currentVotes": int("${CURRENT_VOTES}"),
    "liquidBalance": int("${LIQUID_BALANCE}"),
    "lockedBalance": int("${LOCKED_BALANCE}"),
  },
}
with open(out_path, "w") as fh:
    json.dump(record, fh, indent=2)

with open(deploy_path) as fh:
    deploy = json.load(fh)
deploy.setdefault("validations", {})
deploy["validations"]["governanceHandoff"] = record
with open(deploy_path, "w") as fh:
    json.dump(deploy, fh, indent=2)
    fh.write("\n")
PY

echo "6) Validation complete"
echo "   report=$OUT_JSON"
