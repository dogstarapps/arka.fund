#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
DEPLOY_JSON="${DEPLOY_JSON:-$ROOT_DIR/deployments.testnet.json}"
OUT_JSON="${OUT_JSON:-$ROOT_DIR/tmp/oracle-guard-live-validation.json}"
NETWORK_PASSPHRASE="${VALIDATION_NETWORK_PASSPHRASE:-Test SDF Network ; September 2015}"
RPC_URL="${VALIDATION_RPC_URL:-https://soroban-testnet.stellar.org}"
ADMIN_IDENTITY="${ADMIN_IDENTITY:-arka-admin}"

ORACLE_GUARD_WASM_PATH="${ORACLE_GUARD_WASM_PATH:-$ROOT_DIR/artifacts/oracle-guard.wasm}"
TEST_ORACLE_WASM_PATH="${TEST_ORACLE_WASM_PATH:-$ROOT_DIR/artifacts/test-oracle.wasm}"
TEST_TOKEN_WASM_PATH="${TEST_TOKEN_WASM_PATH:-$ROOT_DIR/artifacts/test-token.wasm}"
INSPECT_HELPER="${INSPECT_HELPER:-$ROOT_DIR/scripts/oracle_guard_inspect.py}"

MAX_PRICE_AGE="${MAX_PRICE_AGE:-120}"
MAX_DEVIATION_BPS="${MAX_DEVIATION_BPS:-500}"

mkdir -p "$(dirname "$OUT_JSON")"

for wasm in "$ORACLE_GUARD_WASM_PATH" "$TEST_ORACLE_WASM_PATH" "$TEST_TOKEN_WASM_PATH"; do
  if [[ ! -f "$wasm" ]]; then
    echo "ERROR: missing wasm artifact: $wasm" >&2
    exit 1
  fi
done

if [[ ! -f "$INSPECT_HELPER" ]]; then
  echo "ERROR: missing inspect helper: $INSPECT_HELPER" >&2
  exit 1
fi

if ! command -v jq >/dev/null 2>&1; then
  echo "ERROR: jq is required" >&2
  exit 1
fi

ADMIN_ADDR="$(stellar keys address "$ADMIN_IDENTITY")"

deploy_contract() {
  local wasm_path="$1"
  local attempt=1
  local output=""
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
      printf '%s\n' "$output" | tail -n1
      return 0
    fi
    printf '%s\n' "$output" >&2
    sleep 4
    attempt="$((attempt + 1))"
  done
  return 1
}

invoke_send() {
  local contract_id="$1"
  shift
  local attempt=1
  local output=""
  while [[ "$attempt" -le 5 ]]; do
    if output="$(
      stellar contract invoke \
        --id "$contract_id" \
        --source-account "$ADMIN_IDENTITY" \
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

get_latest_close_time() {
  curl -s -X POST "$RPC_URL" \
    -H 'content-type: application/json' \
    -d '{"jsonrpc":"2.0","id":1,"method":"getLatestLedger"}' \
    | python3 -c 'import json,sys; print(int(json.load(sys.stdin).get("result",{}).get("closeTime",0)))'
}

json_field() {
  local field="$1"
  local payload="$2"
  python3 - "$field" "$payload" <<'PY'
import json
import sys

payload = json.loads(sys.argv[2])
value = payload
for part in sys.argv[1].split("."):
    value = value[part]
if isinstance(value, bool):
    print("true" if value else "false")
else:
    print(value)
PY
}

assert_equals() {
  local expected="$1"
  local actual="$2"
  local label="$3"
  if [[ "$expected" != "$actual" ]]; then
    echo "ERROR: $label expected '$expected' but got '$actual'" >&2
    exit 1
  fi
}

echo "1) Deploy isolated oracle validation contracts"
ASSET_ID="$(deploy_contract "$TEST_TOKEN_WASM_PATH")"
PRIMARY_ORACLE_ID="$(deploy_contract "$TEST_ORACLE_WASM_PATH")"
SECONDARY_ORACLE_ID="$(deploy_contract "$TEST_ORACLE_WASM_PATH")"
ORACLE_GUARD_ID="$(deploy_contract "$ORACLE_GUARD_WASM_PATH")"
echo "   ASSET_ID=$ASSET_ID"
echo "   PRIMARY_ORACLE_ID=$PRIMARY_ORACLE_ID"
echo "   SECONDARY_ORACLE_ID=$SECONDARY_ORACLE_ID"
echo "   ORACLE_GUARD_ID=$ORACLE_GUARD_ID"

echo "2) Initialize contracts"
invoke_send "$ASSET_ID" init --admin "$ADMIN_ADDR" >/dev/null
invoke_send "$PRIMARY_ORACLE_ID" init --admin "$ADMIN_ADDR" >/dev/null
invoke_send "$SECONDARY_ORACLE_ID" init --admin "$ADMIN_ADDR" >/dev/null
invoke_send "$ORACLE_GUARD_ID" init --admin "$ADMIN_ADDR" >/dev/null

NOW_TS="$(get_latest_close_time)"
PRIMARY_TS="$((NOW_TS - 20))"
SECONDARY_TS="$((NOW_TS - 5))"
STALE_TS="$((NOW_TS - MAX_PRICE_AGE - 60))"
PRIMARY_PRICE=11000000
SECONDARY_PRICE=10000000

echo "3) Divergent feeds in secondary-selection mode"
invoke_send "$PRIMARY_ORACLE_ID" set_stellar_price \
  --caller "$ADMIN_ADDR" \
  --asset "$ASSET_ID" \
  --price "$PRIMARY_PRICE" \
  --timestamp "$PRIMARY_TS" >/dev/null
invoke_send "$SECONDARY_ORACLE_ID" set_stellar_price \
  --caller "$ADMIN_ADDR" \
  --asset "$ASSET_ID" \
  --price "$SECONDARY_PRICE" \
  --timestamp "$SECONDARY_TS" >/dev/null
invoke_send "$ORACLE_GUARD_ID" set_stellar_asset_policy \
  --caller "$ADMIN_ADDR" \
  --asset "$ASSET_ID" \
  --primary "$PRIMARY_ORACLE_ID" \
  --secondary "$SECONDARY_ORACLE_ID" \
  --has_secondary true \
  --max_price_age "$MAX_PRICE_AGE" \
  --max_deviation_bps "$MAX_DEVIATION_BPS" \
  --require_secondary false \
  --divergence_mode 1 >/dev/null

SECONDARY_MODE_JSON="$(python3 "$INSPECT_HELPER" "$ORACLE_GUARD_ID" "$ADMIN_IDENTITY" "$RPC_URL" "$NETWORK_PASSPHRASE" "$ASSET_ID")"
assert_equals "2" "$(json_field selected_source "$SECONDARY_MODE_JSON")" "secondary selection source"
assert_equals "$SECONDARY_PRICE" "$(json_field price "$SECONDARY_MODE_JSON")" "secondary selection price"
assert_equals "true" "$(json_field diverged "$SECONDARY_MODE_JSON")" "secondary selection divergence"

echo "4) Primary stale fallback to secondary"
invoke_send "$PRIMARY_ORACLE_ID" set_stellar_price \
  --caller "$ADMIN_ADDR" \
  --asset "$ASSET_ID" \
  --price "$SECONDARY_PRICE" \
  --timestamp "$STALE_TS" >/dev/null
invoke_send "$SECONDARY_ORACLE_ID" set_stellar_price \
  --caller "$ADMIN_ADDR" \
  --asset "$ASSET_ID" \
  --price "$SECONDARY_PRICE" \
  --timestamp "$SECONDARY_TS" >/dev/null

STALE_MODE_JSON="$(python3 "$INSPECT_HELPER" "$ORACLE_GUARD_ID" "$ADMIN_IDENTITY" "$RPC_URL" "$NETWORK_PASSPHRASE" "$ASSET_ID")"
assert_equals "2" "$(json_field selected_source "$STALE_MODE_JSON")" "stale fallback source"
assert_equals "false" "$(json_field primary_usable "$STALE_MODE_JSON")" "stale fallback primary usable"
assert_equals "true" "$(json_field secondary_usable "$STALE_MODE_JSON")" "stale fallback secondary usable"
assert_equals "$SECONDARY_PRICE" "$(json_field price "$STALE_MODE_JSON")" "stale fallback price"

echo "5) Divergent feeds in fail-closed mode"
invoke_send "$PRIMARY_ORACLE_ID" set_stellar_price \
  --caller "$ADMIN_ADDR" \
  --asset "$ASSET_ID" \
  --price "$PRIMARY_PRICE" \
  --timestamp "$PRIMARY_TS" >/dev/null
invoke_send "$SECONDARY_ORACLE_ID" set_stellar_price \
  --caller "$ADMIN_ADDR" \
  --asset "$ASSET_ID" \
  --price "$SECONDARY_PRICE" \
  --timestamp "$SECONDARY_TS" >/dev/null
invoke_send "$ORACLE_GUARD_ID" set_stellar_asset_policy \
  --caller "$ADMIN_ADDR" \
  --asset "$ASSET_ID" \
  --primary "$PRIMARY_ORACLE_ID" \
  --secondary "$SECONDARY_ORACLE_ID" \
  --has_secondary true \
  --max_price_age "$MAX_PRICE_AGE" \
  --max_deviation_bps "$MAX_DEVIATION_BPS" \
  --require_secondary false \
  --divergence_mode 0 >/dev/null

FAIL_CLOSED_JSON="$(python3 "$INSPECT_HELPER" "$ORACLE_GUARD_ID" "$ADMIN_IDENTITY" "$RPC_URL" "$NETWORK_PASSPHRASE" "$ASSET_ID")"
assert_equals "0" "$(json_field selected_source "$FAIL_CLOSED_JSON")" "fail-closed source"
assert_equals "0" "$(json_field price "$FAIL_CLOSED_JSON")" "fail-closed price"
assert_equals "true" "$(json_field diverged "$FAIL_CLOSED_JSON")" "fail-closed divergence"

python3 - <<'PY' "$OUT_JSON" "$DEPLOY_JSON" "$ADMIN_IDENTITY" "$RPC_URL" "$ASSET_ID" "$PRIMARY_ORACLE_ID" "$SECONDARY_ORACLE_ID" "$ORACLE_GUARD_ID" "$SECONDARY_MODE_JSON" "$STALE_MODE_JSON" "$FAIL_CLOSED_JSON"
import json
import sys

out_path = sys.argv[1]
deploy_path = sys.argv[2]
admin_identity = sys.argv[3]
rpc_url = sys.argv[4]
asset_id = sys.argv[5]
primary_oracle_id = sys.argv[6]
secondary_oracle_id = sys.argv[7]
oracle_guard_id = sys.argv[8]
secondary_mode = json.loads(sys.argv[9])
stale_mode = json.loads(sys.argv[10])
fail_closed_mode = json.loads(sys.argv[11])

record = {
    "validatedAt": "2026-03-28",
    "network": "testnet",
    "rpcUrl": rpc_url,
    "adminIdentity": admin_identity,
    "contracts": {
        "oracleGuard": oracle_guard_id,
        "primaryOracle": primary_oracle_id,
        "secondaryOracle": secondary_oracle_id,
        "validationAsset": asset_id,
    },
    "results": {
        "secondarySelection": secondary_mode,
        "staleFallback": stale_mode,
        "failClosed": fail_closed_mode,
    },
}

with open(out_path, "w", encoding="utf-8") as fh:
    json.dump(record, fh, indent=2)
    fh.write("\n")

with open(deploy_path, "r", encoding="utf-8") as fh:
    deploy = json.load(fh)

deploy.setdefault("contracts", {})
deploy["contracts"]["oracleGuard"] = oracle_guard_id
deploy.setdefault("validations", {})
deploy["validations"]["oracleGuard"] = record

with open(deploy_path, "w", encoding="utf-8") as fh:
    json.dump(deploy, fh, indent=2)
    fh.write("\n")
PY

echo "✅ Oracle guard live validation complete"
echo "   report: $OUT_JSON"
