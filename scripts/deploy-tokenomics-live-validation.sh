#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
DEPLOY_JSON="${DEPLOY_JSON:-$ROOT_DIR/deployments.testnet.json}"
OUT_JSON="${OUT_JSON:-$ROOT_DIR/tmp/tokenomics-live-validation.json}"
NETWORK_PASSPHRASE="${VALIDATION_NETWORK_PASSPHRASE:-Test SDF Network ; September 2015}"
RPC_URL="${VALIDATION_RPC_URL:-https://soroban-testnet.stellar.org}"
ADMIN_IDENTITY="${ADMIN_IDENTITY:-arka-admin}"
TEAM_IDENTITY="${TEAM_IDENTITY:-arka-holder}"
TREASURY_IDENTITY="${TREASURY_IDENTITY:?Set TREASURY_IDENTITY to a Stellar CLI identity}"
ECOSYSTEM_IDENTITY="${ECOSYSTEM_IDENTITY:?Set ECOSYSTEM_IDENTITY to a Stellar CLI identity}"

TS_NODE_TRANSPILE_ONLY="${TS_NODE_TRANSPILE_ONLY:-1}"
TS_NODE_COMPILER_OPTIONS="${TS_NODE_COMPILER_OPTIONS:-{\"module\":\"nodenext\",\"moduleResolution\":\"nodenext\",\"allowImportingTsExtensions\":true}}"

ARKA_TOKEN_WASM_PATH="${ARKA_TOKEN_WASM_PATH:-$ROOT_DIR/artifacts/arka-token.wasm}"
LOCKED_ARKA_WASM_PATH="${LOCKED_ARKA_WASM_PATH:-$ROOT_DIR/artifacts/locked-arka.wasm}"
EXECUTOR_WASM_PATH="${EXECUTOR_WASM_PATH:-$ROOT_DIR/artifacts/governance-executor.wasm}"
VESTING_WASM_PATH="${VESTING_WASM_PATH:-$ROOT_DIR/artifacts/arka-vesting.wasm}"
EMISSIONS_WASM_PATH="${EMISSIONS_WASM_PATH:-$ROOT_DIR/artifacts/emissions-controller.wasm}"
INVOKE_HELPER="${INVOKE_HELPER:-$ROOT_DIR/scripts/contract_invoke_value.py}"

TREASURY_MINT="${TREASURY_MINT:-10000}"
GRANT_AMOUNT="${GRANT_AMOUNT:-3000}"
EMISSION_AMOUNT="${EMISSION_AMOUNT:-2400}"
LOCK_AMOUNT="${LOCK_AMOUNT:-1000}"
EXECUTOR_MIN_DELAY="${EXECUTOR_MIN_DELAY:-2}"
EXECUTOR_GRACE_PERIOD="${EXECUTOR_GRACE_PERIOD:-30}"
LOCK_MIN_WINDOW="${LOCK_MIN_WINDOW:-5}"
LOCK_MAX_WINDOW="${LOCK_MAX_WINDOW:-5000}"
LOCK_EXTENSION="${LOCK_EXTENSION:-100}"

mkdir -p "$(dirname "$OUT_JSON")"

for path in \
  "$ARKA_TOKEN_WASM_PATH" \
  "$LOCKED_ARKA_WASM_PATH" \
  "$EXECUTOR_WASM_PATH" \
  "$VESTING_WASM_PATH" \
  "$EMISSIONS_WASM_PATH" \
  "$INVOKE_HELPER"
do
  if [[ ! -f "$path" ]]; then
    echo "ERROR: missing dependency: $path" >&2
    exit 1
  fi
done

if ! command -v jq >/dev/null 2>&1; then
  echo "ERROR: jq is required" >&2
  exit 1
fi

ADMIN_ADDR="$(stellar keys address "$ADMIN_IDENTITY")"
ADMIN_SECRET="$(stellar keys secret "$ADMIN_IDENTITY")"
TEAM_ADDR="$(stellar keys address "$TEAM_IDENTITY")"
TREASURY_ADDR="$(stellar keys address "$TREASURY_IDENTITY")"
ECOSYSTEM_ADDR="$(stellar keys address "$ECOSYSTEM_IDENTITY")"

deploy_contract() {
  local wasm_path="$1"
  local output=""
  local attempt=1
  while [[ "$attempt" -le 5 ]]; do
    if output="$(
      stellar contract deploy \
        --wasm "$wasm_path" \
        --source-account "$ADMIN_IDENTITY" \
        --rpc-url "$RPC_URL" \
        --network-passphrase "$NETWORK_PASSPHRASE" \
        --ignore-checks 2>&1
    )"; then
      printf '%s\n' "$output" >&2
      python3 - <<'PY' "$output"
import re
import sys

raw = sys.argv[1]
match = re.search(r'contract/([A-Z0-9]{56})', raw)
if match:
    print(match.group(1))
    raise SystemExit(0)
for line in reversed([line.strip() for line in raw.splitlines() if line.strip()]):
    if re.fullmatch(r'[A-Z0-9]{56}', line):
        print(line)
        raise SystemExit(0)
raise SystemExit("failed to extract deployed contract id")
PY
      return 0
    fi
    printf '%s\n' "$output" >&2
    sleep 4
    attempt="$((attempt + 1))"
  done
  return 1
}

invoke_send() {
  invoke_send_as "$ADMIN_IDENTITY" "$@"
}

invoke_send_as() {
  local source_identity="$1"
  shift
  local contract_id="$1"
  shift
  local output=""
  local attempt=1
  while [[ "$attempt" -le 5 ]]; do
    if output="$(
      stellar contract invoke \
        --id "$contract_id" \
        --source-account "$source_identity" \
        --rpc-url "$RPC_URL" \
        --network-passphrase "$NETWORK_PASSPHRASE" \
        --send=yes -- "$@" 2>&1
    )"; then
      if [[ -n "$output" ]]; then
        printf '%s\n' "$output" >&2
      fi
      sleep 2
      return 0
    fi
    printf '%s\n' "$output" >&2
    sleep 4
    attempt="$((attempt + 1))"
  done
  return 1
}

invoke_value() {
  python3 "$INVOKE_HELPER" "$@"
}

get_latest_ledger() {
  curl -s -X POST "$RPC_URL" \
    -H 'content-type: application/json' \
    -d '{"jsonrpc":"2.0","id":1,"method":"getLatestLedger"}' \
    | python3 -c 'import json,sys; print(int(json.load(sys.stdin).get("result",{}).get("sequence",0)))'
}

get_latest_close_time() {
  curl -s -X POST "$RPC_URL" \
    -H 'content-type: application/json' \
    -d '{"jsonrpc":"2.0","id":1,"method":"getLatestLedger"}' \
    | python3 -c 'import json,sys; print(int(json.load(sys.stdin).get("result",{}).get("closeTime",0)))'
}

wait_until_ledger() {
  local target="$1"
  local latest
  latest="$(get_latest_ledger)"
  while [[ "$latest" -lt "$target" ]]; do
    sleep 5
    latest="$(get_latest_ledger)"
  done
}

wait_until_close_time() {
  local target="$1"
  local latest
  latest="$(get_latest_close_time)"
  while [[ "$latest" -lt "$target" ]]; do
    sleep 5
    latest="$(get_latest_close_time)"
  done
}

assert_gt_zero() {
  local value="$1"
  local label="$2"
  python3 - "$value" "$label" <<'PY'
import sys
value = int(sys.argv[1])
if value <= 0:
    raise SystemExit(f"ERROR: {sys.argv[2]} expected > 0, got {value}")
PY
}

assert_eq() {
  local left="$1"
  local right="$2"
  local label="$3"
  python3 - "$left" "$right" "$label" <<'PY'
import sys
if sys.argv[1] != sys.argv[2]:
    raise SystemExit(f"ERROR: {sys.argv[3]} expected {sys.argv[2]}, got {sys.argv[1]}")
PY
}

echo "1) Deploy isolated tokenomics validation stack"
ARKA_TOKEN_ID="$(deploy_contract "$ARKA_TOKEN_WASM_PATH")"
LOCKED_ARKA_ID="$(deploy_contract "$LOCKED_ARKA_WASM_PATH")"
EXECUTOR_ID="$(deploy_contract "$EXECUTOR_WASM_PATH")"
VESTING_ID="$(deploy_contract "$VESTING_WASM_PATH")"
EMISSIONS_ID="$(deploy_contract "$EMISSIONS_WASM_PATH")"
echo "   ARKA_TOKEN_ID=$ARKA_TOKEN_ID"
echo "   LOCKED_ARKA_ID=$LOCKED_ARKA_ID"
echo "   EXECUTOR_ID=$EXECUTOR_ID"
echo "   VESTING_ID=$VESTING_ID"
echo "   EMISSIONS_ID=$EMISSIONS_ID"

echo "2) Initialize token, lock, executor, vesting, and emissions"
invoke_send "$ARKA_TOKEN_ID" init \
  --admin "$ADMIN_ADDR" \
  --name "Arka Tokenomics Validation" \
  --symbol "ARKATK" \
  --decimals 7 \
  --max_supply 1000000
invoke_send "$LOCKED_ARKA_ID" init \
  --admin "$ADMIN_ADDR" \
  --token "$ARKA_TOKEN_ID" \
  --min_lock_ledgers "$LOCK_MIN_WINDOW" \
  --max_lock_ledgers "$LOCK_MAX_WINDOW" \
  --name "Locked Arka Tokenomics" \
  --symbol "lARKATK"
invoke_send "$EXECUTOR_ID" init \
  --admin "$ADMIN_ADDR" \
  --min_delay "$EXECUTOR_MIN_DELAY" \
  --grace_period "$EXECUTOR_GRACE_PERIOD"
invoke_send "$VESTING_ID" init --admin "$ADMIN_ADDR" --token "$ARKA_TOKEN_ID"
invoke_send "$EMISSIONS_ID" init --admin "$ADMIN_ADDR" --token "$ARKA_TOKEN_ID"
invoke_send "$VESTING_ID" set_governor --caller "$ADMIN_ADDR" --governor "$EXECUTOR_ID"
invoke_send "$EMISSIONS_ID" set_governor --caller "$ADMIN_ADDR" --governor "$EXECUTOR_ID"

echo "3) Fund treasury and approve tokenomics programs"
invoke_send "$ARKA_TOKEN_ID" mint --to "$TREASURY_ADDR" --amount "$TREASURY_MINT"
invoke_send_as "$TREASURY_IDENTITY" "$ARKA_TOKEN_ID" approve --owner "$TREASURY_ADDR" --spender "$VESTING_ID" --amount "$GRANT_AMOUNT"
invoke_send_as "$TREASURY_IDENTITY" "$ARKA_TOKEN_ID" approve --owner "$TREASURY_ADDR" --spender "$EMISSIONS_ID" --amount "$EMISSION_AMOUNT"

BASE_CLOSE_TIME="$(get_latest_close_time)"
GRANT_START="$((BASE_CLOSE_TIME + 5))"
GRANT_CLIFF="$((BASE_CLOSE_TIME + 10))"
GRANT_END="$((BASE_CLOSE_TIME + 30))"
EMISSION_START="$((BASE_CLOSE_TIME + 5))"
EMISSION_END="$((BASE_CLOSE_TIME + 25))"
CREATE_OP_ID_HEX="$(python3 - <<'PY'
import os, hashlib, time
print(hashlib.sha256(f"tokenomics-create-{time.time_ns()}-{os.getpid()}".encode()).hexdigest())
PY
)"

echo "4) Schedule governed creation of vesting and emissions programs"
(
  cd "$ROOT_DIR/scripts/js" && \
    TS_NODE_TRANSPILE_ONLY="$TS_NODE_TRANSPILE_ONLY" \
    TS_NODE_COMPILER_OPTIONS="$TS_NODE_COMPILER_OPTIONS" \
    SIGNER_SECRET="$ADMIN_SECRET" \
    ACTION_MODE="initial" \
    EXECUTOR_ID="$EXECUTOR_ID" \
    VESTING_ID="$VESTING_ID" \
    EMISSIONS_ID="$EMISSIONS_ID" \
    SCHEDULER_ADDRESS="$ADMIN_ADDR" \
    TREASURY_ADDRESS="$TREASURY_ADDR" \
    TEAM_ADDRESS="$TEAM_ADDR" \
    ECOSYSTEM_ADDRESS="$ECOSYSTEM_ADDR" \
    OPERATION_ID_HEX="$CREATE_OP_ID_HEX" \
    GRANT_START="$GRANT_START" \
    GRANT_CLIFF="$GRANT_CLIFF" \
    GRANT_END="$GRANT_END" \
    GRANT_AMOUNT="$GRANT_AMOUNT" \
    EMISSION_START="$EMISSION_START" \
    EMISSION_END="$EMISSION_END" \
    EMISSION_AMOUNT="$EMISSION_AMOUNT" \
    node --loader ts-node/esm scheduleExecutorTokenomics.ts
)

SCHEDULE_LEDGER="$(get_latest_ledger)"
wait_until_ledger "$((SCHEDULE_LEDGER + EXECUTOR_MIN_DELAY))"
invoke_send "$EXECUTOR_ID" execute --operation_id "$CREATE_OP_ID_HEX"

GRANT_IDS_JSON="$(invoke_value "$VESTING_ID" "$ADMIN_IDENTITY" "$RPC_URL" "$NETWORK_PASSPHRASE" grant_ids --beneficiary "$TEAM_ADDR")"
STREAM_IDS_JSON="$(invoke_value "$EMISSIONS_ID" "$ADMIN_IDENTITY" "$RPC_URL" "$NETWORK_PASSPHRASE" stream_ids --recipient "$ECOSYSTEM_ADDR")"
assert_eq "$GRANT_IDS_JSON" "[1]" "grant ids"
assert_eq "$STREAM_IDS_JSON" "[1]" "stream ids"

echo "5) Wait for partial accrual and claim live amounts"
PARTIAL_TARGET_TIME="$((BASE_CLOSE_TIME + 20))"
wait_until_close_time "$PARTIAL_TARGET_TIME"

TEAM_CLAIMABLE="$(invoke_value "$VESTING_ID" "$ADMIN_IDENTITY" "$RPC_URL" "$NETWORK_PASSPHRASE" claimable --grant_id 1)"
ECOSYSTEM_RELEASABLE="$(invoke_value "$EMISSIONS_ID" "$ADMIN_IDENTITY" "$RPC_URL" "$NETWORK_PASSPHRASE" releasable --stream_id 1)"
assert_gt_zero "$TEAM_CLAIMABLE" "team claimable"
assert_gt_zero "$ECOSYSTEM_RELEASABLE" "ecosystem releasable"

TEAM_CLAIMED="$(invoke_value "$VESTING_ID" "$ADMIN_IDENTITY" "$RPC_URL" "$NETWORK_PASSPHRASE" claim --grant_id 1)"
ECOSYSTEM_RELEASED="$(invoke_value "$EMISSIONS_ID" "$ADMIN_IDENTITY" "$RPC_URL" "$NETWORK_PASSPHRASE" release --stream_id 1)"
TEAM_BALANCE_AFTER_FIRST_CLAIM="$(invoke_value "$ARKA_TOKEN_ID" "$ADMIN_IDENTITY" "$RPC_URL" "$NETWORK_PASSPHRASE" balance --owner "$TEAM_ADDR")"
ECOSYSTEM_BALANCE_AFTER_FIRST_RELEASE="$(invoke_value "$ARKA_TOKEN_ID" "$ADMIN_IDENTITY" "$RPC_URL" "$NETWORK_PASSPHRASE" balance --owner "$ECOSYSTEM_ADDR")"
assert_eq "$TEAM_CLAIMED" "$TEAM_BALANCE_AFTER_FIRST_CLAIM" "team balance after first claim"
assert_eq "$ECOSYSTEM_RELEASED" "$ECOSYSTEM_BALANCE_AFTER_FIRST_RELEASE" "ecosystem balance after first release"

UNWIND_OP_ID_HEX="$(python3 - <<'PY'
import os, hashlib, time
print(hashlib.sha256(f"tokenomics-unwind-{time.time_ns()}-{os.getpid()}".encode()).hexdigest())
PY
)"

echo "6) Schedule governed revoke/cancel and execute after delay"
(
  cd "$ROOT_DIR/scripts/js" && \
    TS_NODE_TRANSPILE_ONLY="$TS_NODE_TRANSPILE_ONLY" \
    TS_NODE_COMPILER_OPTIONS="$TS_NODE_COMPILER_OPTIONS" \
    SIGNER_SECRET="$ADMIN_SECRET" \
    ACTION_MODE="unwind" \
    EXECUTOR_ID="$EXECUTOR_ID" \
    VESTING_ID="$VESTING_ID" \
    EMISSIONS_ID="$EMISSIONS_ID" \
    SCHEDULER_ADDRESS="$ADMIN_ADDR" \
    REFUND_ADDRESS="$TREASURY_ADDR" \
    GRANT_ID="1" \
    STREAM_ID="1" \
    OPERATION_ID_HEX="$UNWIND_OP_ID_HEX" \
    node --loader ts-node/esm scheduleExecutorTokenomics.ts
)

UNWIND_LEDGER="$(get_latest_ledger)"
wait_until_ledger "$((UNWIND_LEDGER + EXECUTOR_MIN_DELAY))"
invoke_send "$EXECUTOR_ID" execute --operation_id "$UNWIND_OP_ID_HEX"

GRANT_JSON="$(invoke_value "$VESTING_ID" "$ADMIN_IDENTITY" "$RPC_URL" "$NETWORK_PASSPHRASE" grant --grant_id 1)"
STREAM_JSON="$(invoke_value "$EMISSIONS_ID" "$ADMIN_IDENTITY" "$RPC_URL" "$NETWORK_PASSPHRASE" stream --stream_id 1)"
TEAM_CLAIMABLE_FINAL="$(invoke_value "$VESTING_ID" "$ADMIN_IDENTITY" "$RPC_URL" "$NETWORK_PASSPHRASE" claimable --grant_id 1)"
ECOSYSTEM_RELEASABLE_FINAL="$(invoke_value "$EMISSIONS_ID" "$ADMIN_IDENTITY" "$RPC_URL" "$NETWORK_PASSPHRASE" releasable --stream_id 1)"

TEAM_CLAIMED_FINAL=0
if [[ "$TEAM_CLAIMABLE_FINAL" != "0" ]]; then
  TEAM_CLAIMED_FINAL="$(invoke_value "$VESTING_ID" "$ADMIN_IDENTITY" "$RPC_URL" "$NETWORK_PASSPHRASE" claim --grant_id 1)"
fi
ECOSYSTEM_RELEASED_FINAL=0
if [[ "$ECOSYSTEM_RELEASABLE_FINAL" != "0" ]]; then
  ECOSYSTEM_RELEASED_FINAL="$(invoke_value "$EMISSIONS_ID" "$ADMIN_IDENTITY" "$RPC_URL" "$NETWORK_PASSPHRASE" release --stream_id 1)"
fi

TEAM_BALANCE_FINAL="$(invoke_value "$ARKA_TOKEN_ID" "$ADMIN_IDENTITY" "$RPC_URL" "$NETWORK_PASSPHRASE" balance --owner "$TEAM_ADDR")"
ECOSYSTEM_BALANCE_FINAL="$(invoke_value "$ARKA_TOKEN_ID" "$ADMIN_IDENTITY" "$RPC_URL" "$NETWORK_PASSPHRASE" balance --owner "$ECOSYSTEM_ADDR")"
TREASURY_BALANCE_FINAL="$(invoke_value "$ARKA_TOKEN_ID" "$ADMIN_IDENTITY" "$RPC_URL" "$NETWORK_PASSPHRASE" balance --owner "$TREASURY_ADDR")"
TEAM_VESTED_FINAL="$(invoke_value "$VESTING_ID" "$ADMIN_IDENTITY" "$RPC_URL" "$NETWORK_PASSPHRASE" vested_amount --grant_id 1)"
assert_eq "$TEAM_BALANCE_FINAL" "$TEAM_VESTED_FINAL" "team final vested balance"
assert_gt_zero "$TREASURY_BALANCE_FINAL" "treasury final balance"

echo "7) Lock released team tokens into voting power"
invoke_send_as "$TEAM_IDENTITY" "$ARKA_TOKEN_ID" approve --owner "$TEAM_ADDR" --spender "$LOCKED_ARKA_ID" --amount "$LOCK_AMOUNT"
UNLOCK_LEDGER="$(( $(get_latest_ledger) + LOCK_EXTENSION ))"
invoke_send_as "$TEAM_IDENTITY" "$LOCKED_ARKA_ID" create_lock --account "$TEAM_ADDR" --amount "$LOCK_AMOUNT" --unlock_ledger "$UNLOCK_LEDGER"
LOCKED_BALANCE_FINAL="$(invoke_value "$LOCKED_ARKA_ID" "$ADMIN_IDENTITY" "$RPC_URL" "$NETWORK_PASSPHRASE" locked_balance --account "$TEAM_ADDR")"
TEAM_VOTES_FINAL="$(invoke_value "$LOCKED_ARKA_ID" "$ADMIN_IDENTITY" "$RPC_URL" "$NETWORK_PASSPHRASE" get_votes --account "$TEAM_ADDR")"
TEAM_LIQUID_AFTER_LOCK="$(invoke_value "$ARKA_TOKEN_ID" "$ADMIN_IDENTITY" "$RPC_URL" "$NETWORK_PASSPHRASE" balance --owner "$TEAM_ADDR")"
assert_eq "$LOCKED_BALANCE_FINAL" "$LOCK_AMOUNT" "locked balance final"
assert_eq "$TEAM_VOTES_FINAL" "$LOCK_AMOUNT" "team votes final"

python3 - <<'PY' \
  "$OUT_JSON" \
  "$DEPLOY_JSON" \
  "$RPC_URL" \
  "$ADMIN_IDENTITY" \
  "$TEAM_IDENTITY" \
  "$TREASURY_IDENTITY" \
  "$ECOSYSTEM_IDENTITY" \
  "$ARKA_TOKEN_ID" \
  "$LOCKED_ARKA_ID" \
  "$EXECUTOR_ID" \
  "$VESTING_ID" \
  "$EMISSIONS_ID" \
  "$GRANT_JSON" \
  "$STREAM_JSON" \
  "$TEAM_CLAIMED" \
  "$ECOSYSTEM_RELEASED" \
  "$TEAM_CLAIMED_FINAL" \
  "$ECOSYSTEM_RELEASED_FINAL" \
  "$TEAM_BALANCE_FINAL" \
  "$ECOSYSTEM_BALANCE_FINAL" \
  "$TREASURY_BALANCE_FINAL" \
  "$TEAM_VESTED_FINAL" \
  "$LOCKED_BALANCE_FINAL" \
  "$TEAM_VOTES_FINAL" \
  "$TEAM_LIQUID_AFTER_LOCK"
import json
import sys

def parse_any(value: str):
    try:
        return json.loads(value)
    except Exception:
        if value in ("true", "false"):
            return value == "true"
        return value

(
    out_path,
    deploy_path,
    rpc_url,
    admin_identity,
    team_identity,
    treasury_identity,
    ecosystem_identity,
    arka_token_id,
    locked_arka_id,
    executor_id,
    vesting_id,
    emissions_id,
    grant_json,
    stream_json,
    team_claimed,
    ecosystem_released,
    team_claimed_final,
    ecosystem_released_final,
    team_balance_final,
    ecosystem_balance_final,
    treasury_balance_final,
    team_vested_final,
    locked_balance_final,
    team_votes_final,
    team_liquid_after_lock,
) = sys.argv[1:]

record = {
    "validatedAt": "2026-03-28",
    "network": "testnet",
    "rpcUrl": rpc_url,
    "identities": {
        "admin": admin_identity,
        "team": team_identity,
        "treasury": treasury_identity,
        "ecosystem": ecosystem_identity,
    },
    "contracts": {
        "arkaToken": arka_token_id,
        "lockedArka": locked_arka_id,
        "governanceExecutor": executor_id,
        "arkaVesting": vesting_id,
        "emissionsController": emissions_id,
    },
    "results": {
        "grant": parse_any(grant_json),
        "stream": parse_any(stream_json),
        "teamClaimedInitial": parse_any(team_claimed),
        "ecosystemReleasedInitial": parse_any(ecosystem_released),
        "teamClaimedFinal": parse_any(team_claimed_final),
        "ecosystemReleasedFinal": parse_any(ecosystem_released_final),
        "teamBalanceFinal": parse_any(team_balance_final),
        "ecosystemBalanceFinal": parse_any(ecosystem_balance_final),
        "treasuryBalanceFinal": parse_any(treasury_balance_final),
        "teamVestedFinal": parse_any(team_vested_final),
        "lockedBalanceFinal": parse_any(locked_balance_final),
        "teamVotesFinal": parse_any(team_votes_final),
        "teamLiquidAfterLock": parse_any(team_liquid_after_lock),
    },
}

with open(out_path, "w", encoding="utf-8") as fh:
    json.dump(record, fh, indent=2)
    fh.write("\n")

with open(deploy_path, "r", encoding="utf-8") as fh:
    deploy = json.load(fh)

deploy.setdefault("validations", {})
deploy["validations"]["tokenomics"] = record

with open(deploy_path, "w", encoding="utf-8") as fh:
    json.dump(deploy, fh, indent=2)
    fh.write("\n")
PY

echo "✅ Tokenomics live validation complete"
echo "   report: $OUT_JSON"
