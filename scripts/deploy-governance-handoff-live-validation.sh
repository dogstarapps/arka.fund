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

GOVERNOR_WASM_PATH="${GOVERNOR_WASM_PATH:-$ROOT_DIR/artifacts/governor.wasm}"
EXECUTOR_WASM_PATH="${EXECUTOR_WASM_PATH:-$ROOT_DIR/artifacts/governance-executor.wasm}"
ARKA_TOKEN_WASM_PATH="${ARKA_TOKEN_WASM_PATH:-$ROOT_DIR/artifacts/arka-token.wasm}"
LOCKED_ARKA_WASM_PATH="${LOCKED_ARKA_WASM_PATH:-$ROOT_DIR/artifacts/locked-arka.wasm}"

PROPOSAL_THRESHOLD="${PROPOSAL_THRESHOLD:-1}"
VOTE_DELAY="${VOTE_DELAY:-1}"
VOTE_PERIOD="${VOTE_PERIOD:-720}"
GOV_TIMELOCK="${GOV_TIMELOCK:-2}"
GOV_GRACE_PERIOD="${GOV_GRACE_PERIOD:-17280}"
QUORUM_BPS="${QUORUM_BPS:-100}"
COUNTING_TYPE="${COUNTING_TYPE:-2}"
VOTE_THRESHOLD_BPS="${VOTE_THRESHOLD_BPS:-5100}"
EXECUTOR_MIN_DELAY="${EXECUTOR_MIN_DELAY:-2}"
EXECUTOR_GRACE_PERIOD="${EXECUTOR_GRACE_PERIOD:-30}"

INITIAL_MINT="${INITIAL_MINT:-100}"
EXECUTOR_MINT="${EXECUTOR_MINT:-120}"
LOCK_EXTENSION="${LOCK_EXTENSION:-2000}"
LOCK_MIN_WINDOW="${LOCK_MIN_WINDOW:-5}"
LOCK_MAX_WINDOW="${LOCK_MAX_WINDOW:-5000}"
INCREASE_AMOUNT="${INCREASE_AMOUNT:-100}"
RELOCK_EXTENSION="${RELOCK_EXTENSION:-400}"

mkdir -p "$(dirname "$OUT_JSON")"

for wasm in \
  "$GOVERNOR_WASM_PATH" \
  "$EXECUTOR_WASM_PATH" \
  "$ARKA_TOKEN_WASM_PATH" \
  "$LOCKED_ARKA_WASM_PATH"
do
  if [[ ! -f "$wasm" ]]; then
    echo "ERROR: missing wasm artifact: $wasm" >&2
    exit 1
  fi
done

ADMIN_ADDR="$(stellar keys address "$ADMIN_IDENTITY")"
HOLDER_ADDR="$(stellar keys address "$HOLDER_IDENTITY")"
HOLDER_SECRET="$(stellar keys secret "$HOLDER_IDENTITY")"

deploy_contract() {
  local wasm_path="$1"
  stellar contract deploy \
    --wasm "$wasm_path" \
    --source-account "$ADMIN_IDENTITY" \
    --rpc-url "$RPC_URL" \
    --network-passphrase "$NETWORK_PASSPHRASE" \
    --ignore-checks | tail -n1
}

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
  local proposal_id="$1"
  (
    cd "$ROOT_DIR/scripts/js" && \
      TS_NODE_TRANSPILE_ONLY="$TS_NODE_TRANSPILE_ONLY" \
      TS_NODE_COMPILER_OPTIONS="$TS_NODE_COMPILER_OPTIONS" \
      PUBLIC_KEY="$ADMIN_ADDR" \
      GOV_ID="$GOVERNOR_ID" \
      PROPOSAL_ID="$proposal_id" \
      node --loader ts-node/esm getGovernorProposal.ts
  )
}

echo "1) Deploy isolated contracts for governance handoff validation"
ARKA_TOKEN_ID="$(deploy_contract "$ARKA_TOKEN_WASM_PATH")"
LOCKED_ARKA_ID="$(deploy_contract "$LOCKED_ARKA_WASM_PATH")"
GOVERNANCE_EXECUTOR_ID="$(deploy_contract "$EXECUTOR_WASM_PATH")"
GOVERNOR_ID="$(deploy_contract "$GOVERNOR_WASM_PATH")"
echo "   ARKA_TOKEN_ID=$ARKA_TOKEN_ID"
echo "   LOCKED_ARKA_ID=$LOCKED_ARKA_ID"
echo "   GOVERNANCE_EXECUTOR_ID=$GOVERNANCE_EXECUTOR_ID"
echo "   GOVERNOR_ID=$GOVERNOR_ID"

echo "2) Initialize liquid token and locked voting power"
stellar contract invoke \
  --id "$ARKA_TOKEN_ID" \
  --source-account "$ADMIN_IDENTITY" \
  --rpc-url "$RPC_URL" \
  --network-passphrase "$NETWORK_PASSPHRASE" \
  --send=yes -- init \
  --admin "$ADMIN_ADDR" \
  --name "Arka Token Validation" \
  --symbol "ARKATV" \
  --decimals 7 \
  --max_supply 1000000000 >/dev/null

stellar contract invoke \
  --id "$ARKA_TOKEN_ID" \
  --source-account "$ADMIN_IDENTITY" \
  --rpc-url "$RPC_URL" \
  --network-passphrase "$NETWORK_PASSPHRASE" \
  --send=yes -- mint \
  --to "$HOLDER_ADDR" \
  --amount "$INITIAL_MINT" >/dev/null

stellar contract invoke \
  --id "$LOCKED_ARKA_ID" \
  --source-account "$ADMIN_IDENTITY" \
  --rpc-url "$RPC_URL" \
  --network-passphrase "$NETWORK_PASSPHRASE" \
  --send=yes -- init \
  --admin "$ADMIN_ADDR" \
  --token "$ARKA_TOKEN_ID" \
  --min_lock_ledgers "$LOCK_MIN_WINDOW" \
  --max_lock_ledgers "$LOCK_MAX_WINDOW" \
  --name "Locked Arka Validation" \
  --symbol "lARKATV" >/dev/null

UNLOCK_LEDGER="$(( $(get_latest_ledger) + LOCK_EXTENSION ))"
stellar contract invoke \
  --id "$LOCKED_ARKA_ID" \
  --source-account "$HOLDER_IDENTITY" \
  --rpc-url "$RPC_URL" \
  --network-passphrase "$NETWORK_PASSPHRASE" \
  --send=yes -- create_lock \
  --account "$HOLDER_ADDR" \
  --amount "$INITIAL_MINT" \
  --unlock_ledger "$UNLOCK_LEDGER" >/dev/null

echo "3) Initialize governor and executor"
stellar contract invoke \
  --id "$GOVERNOR_ID" \
  --source-account "$ADMIN_IDENTITY" \
  --rpc-url "$RPC_URL" \
  --network-passphrase "$NETWORK_PASSPHRASE" \
  --send=yes -- initialize_simple \
  --votes "$LOCKED_ARKA_ID" \
  --council "$ADMIN_ADDR" \
  --proposal_threshold "$PROPOSAL_THRESHOLD" \
  --vote_delay "$VOTE_DELAY" \
  --vote_period "$VOTE_PERIOD" \
  --timelock "$GOV_TIMELOCK" \
  --grace_period "$GOV_GRACE_PERIOD" \
  --quorum "$QUORUM_BPS" \
  --counting_type "$COUNTING_TYPE" \
  --vote_threshold "$VOTE_THRESHOLD_BPS" >/dev/null

stellar contract invoke \
  --id "$GOVERNANCE_EXECUTOR_ID" \
  --source-account "$ADMIN_IDENTITY" \
  --rpc-url "$RPC_URL" \
  --network-passphrase "$NETWORK_PASSPHRASE" \
  --send=yes -- init \
  --admin "$ADMIN_ADDR" \
  --min_delay "$EXECUTOR_MIN_DELAY" \
  --grace_period "$EXECUTOR_GRACE_PERIOD" >/dev/null

stellar contract invoke \
  --id "$GOVERNANCE_EXECUTOR_ID" \
  --source-account "$ADMIN_IDENTITY" \
  --rpc-url "$RPC_URL" \
  --network-passphrase "$NETWORK_PASSPHRASE" \
  --send=yes -- set_governor \
  --caller "$ADMIN_ADDR" \
  --governor "$GOVERNOR_ID" >/dev/null

echo "4) Hand target admin roles to executor"
stellar contract invoke \
  --id "$LOCKED_ARKA_ID" \
  --source-account "$ADMIN_IDENTITY" \
  --rpc-url "$RPC_URL" \
  --network-passphrase "$NETWORK_PASSPHRASE" \
  --send=yes -- set_governor \
  --caller "$ADMIN_ADDR" \
  --governor "$GOVERNOR_ID" >/dev/null

stellar contract invoke \
  --id "$ARKA_TOKEN_ID" \
  --source-account "$ADMIN_IDENTITY" \
  --rpc-url "$RPC_URL" \
  --network-passphrase "$NETWORK_PASSPHRASE" \
  --send=yes -- set_admin \
  --caller "$ADMIN_ADDR" \
  --admin "$GOVERNANCE_EXECUTOR_ID" >/dev/null

stellar contract invoke \
  --id "$LOCKED_ARKA_ID" \
  --source-account "$ADMIN_IDENTITY" \
  --rpc-url "$RPC_URL" \
  --network-passphrase "$NETWORK_PASSPHRASE" \
  --send=yes -- set_admin \
  --caller "$ADMIN_ADDR" \
  --admin "$GOVERNANCE_EXECUTOR_ID" >/dev/null

OPERATION_ID_HEX="$(python3 - <<'PY'
import os,hashlib,time
seed=f"{time.time_ns()}-{os.getpid()}".encode()
print(hashlib.sha256(seed).hexdigest())
PY
)"

echo "5) Propose executor schedule through live governor"
PROPOSE_OUT="$(
  cd "$ROOT_DIR/scripts/js" && \
    TS_NODE_TRANSPILE_ONLY="$TS_NODE_TRANSPILE_ONLY" \
    TS_NODE_COMPILER_OPTIONS="$TS_NODE_COMPILER_OPTIONS" \
    SIGNER_SECRET="$HOLDER_SECRET" \
    CREATOR_ADDRESS="$HOLDER_ADDR" \
    GOV_ID="$GOVERNOR_ID" \
    EXECUTOR_ID="$GOVERNANCE_EXECUTOR_ID" \
    ARKA_TOKEN_ID="$ARKA_TOKEN_ID" \
    LOCKED_ARKA_ID="$LOCKED_ARKA_ID" \
    BENEFICIARY_ADDRESS="$HOLDER_ADDR" \
    OPERATION_ID_HEX="$OPERATION_ID_HEX" \
    MINT_AMOUNT="$EXECUTOR_MINT" \
    node --loader ts-node/esm proposeExecutorScheduleTokenPower.ts
)"
printf '%s\n' "$PROPOSE_OUT"
PROPOSAL_ID="$(printf '%s\n' "$PROPOSE_OUT" | awk -F= '/^PROPOSAL_ID=/{print $2}' | tail -n1)"
PROPOSAL_TX_HASH="$(printf '%s\n' "$PROPOSE_OUT" | awk -F= '/^TX_HASH=/{print $2}' | tail -n1)"
if [[ -z "$PROPOSAL_ID" ]]; then
  echo "ERROR: could not parse proposal id" >&2
  exit 1
fi

echo "6) Vote, close, and execute the governor proposal"
PJSON="$(get_proposal_json "$PROPOSAL_ID")"
VOTE_START="$(python3 - "$PJSON" <<'PY'
import json,sys
j=json.loads(sys.argv[1])
print(j["data"]["vote_start"])
PY
)"
wait_until_ledger "$(( VOTE_START + 1 ))" "vote_start+1"

stellar contract invoke \
  --id "$GOVERNOR_ID" \
  --source-account "$HOLDER_IDENTITY" \
  --rpc-url "$RPC_URL" \
  --network-passphrase "$NETWORK_PASSPHRASE" \
  --send=yes -- vote \
  --voter "$HOLDER_ADDR" \
  --proposal_id "$PROPOSAL_ID" \
  --support 1 >/dev/null

PJSON="$(get_proposal_json "$PROPOSAL_ID")"
VOTE_END="$(python3 - "$PJSON" <<'PY'
import json,sys
j=json.loads(sys.argv[1])
print(j["data"]["vote_end"])
PY
)"
wait_until_ledger "$(( VOTE_END + 1 ))" "vote_end+1"

stellar contract invoke \
  --id "$GOVERNOR_ID" \
  --source-account "$ADMIN_IDENTITY" \
  --rpc-url "$RPC_URL" \
  --network-passphrase "$NETWORK_PASSPHRASE" \
  --send=yes -- close \
  --proposal_id "$PROPOSAL_ID" >/dev/null

PJSON="$(get_proposal_json "$PROPOSAL_ID")"
ETA="$(python3 - "$PJSON" <<'PY'
import json,sys
j=json.loads(sys.argv[1])
print(j["data"]["eta"])
PY
)"
wait_until_ledger "$ETA" "eta"

stellar contract invoke \
  --id "$GOVERNOR_ID" \
  --source-account "$ADMIN_IDENTITY" \
  --rpc-url "$RPC_URL" \
  --network-passphrase "$NETWORK_PASSPHRASE" \
  --send=yes -- execute \
  --proposal_id "$PROPOSAL_ID" >/dev/null

SCHEDULE_LEDGER="$(get_latest_ledger)"
wait_until_ledger "$(( SCHEDULE_LEDGER + EXECUTOR_MIN_DELAY ))" "executor_ready"

echo "7) Execute queued executor action and verify token-power updates"
stellar contract invoke \
  --id "$GOVERNANCE_EXECUTOR_ID" \
  --source-account "$ADMIN_IDENTITY" \
  --rpc-url "$RPC_URL" \
  --network-passphrase "$NETWORK_PASSPHRASE" \
  --send=yes -- execute \
  --operation_id "$OPERATION_ID_HEX" >/dev/null

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

python3 - "$OUT_JSON" "$DEPLOY_JSON" <<PY
import json, sys
out_path, deploy_path = sys.argv[1], sys.argv[2]
record = {
  "validatedAt": "2026-03-28",
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

echo "8) Validation complete"
echo "   report=$OUT_JSON"
