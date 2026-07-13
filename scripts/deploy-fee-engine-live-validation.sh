#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
DEPLOY_JSON="${DEPLOY_JSON:-$ROOT_DIR/deployments.testnet.json}"
OUT_JSON="${OUT_JSON:-$ROOT_DIR/tmp/fee-engine-live-validation.json}"
NETWORK_PASSPHRASE="${VALIDATION_NETWORK_PASSPHRASE:-Test SDF Network ; September 2015}"
RPC_URL="${VALIDATION_RPC_URL:-https://soroban-testnet.stellar.org}"
ADMIN_IDENTITY="${ADMIN_IDENTITY:-arka-admin}"
HOLDER_IDENTITY="${HOLDER_IDENTITY:-arka-holder}"
TREASURY_IDENTITY="${TREASURY_IDENTITY:?Set TREASURY_IDENTITY to a Stellar CLI identity}"

ARKA_WASM_PATH="${ARKA_WASM_PATH:-$ROOT_DIR/artifacts/arka.wasm}"
ROUTER_WASM_PATH="${ROUTER_WASM_PATH:-$ROOT_DIR/artifacts/router.wasm}"
TOKEN_WASM_PATH="${TOKEN_WASM_PATH:-$ROOT_DIR/artifacts/test-token.wasm}"
PROFIT_ADAPTER_WASM_PATH="${PROFIT_ADAPTER_WASM_PATH:-$ROOT_DIR/artifacts/test-profit-adapter.wasm}"
INVOKE_HELPER="${INVOKE_HELPER:-$ROOT_DIR/scripts/contract_invoke_value.py}"

HOLDER_MINT_AMOUNT="${HOLDER_MINT_AMOUNT:-1500000000}"
ADAPTER_PROFIT_POOL="${ADAPTER_PROFIT_POOL:-200000000}"
DEPOSIT_AMOUNT="${DEPOSIT_AMOUNT:-1000000000}"
REBALANCE_AMOUNT_IN="${REBALANCE_AMOUNT_IN:-100000000}"
PROFIT_BONUS="${PROFIT_BONUS:-80000000}"
MGMT_BPS="${MGMT_BPS:-10000}"
PERF_BPS="${PERF_BPS:-2000}"
MGMT_PROTOCOL_BPS="${MGMT_PROTOCOL_BPS:-2500}"
PERF_PROTOCOL_BPS="${PERF_PROTOCOL_BPS:-5000}"
WAIT_SECONDS_FOR_MGMT="${WAIT_SECONDS_FOR_MGMT:-25}"

mkdir -p "$(dirname "$OUT_JSON")"

for path in "$ARKA_WASM_PATH" "$ROUTER_WASM_PATH" "$TOKEN_WASM_PATH" "$PROFIT_ADAPTER_WASM_PATH" "$INVOKE_HELPER"; do
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
HOLDER_ADDR="$(stellar keys address "$HOLDER_IDENTITY")"
TREASURY_ADDR="$(stellar keys address "$TREASURY_IDENTITY")"

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
  invoke_send_as "$ADMIN_IDENTITY" "$@"
}

invoke_send_as() {
  local source_identity="$1"
  shift
  local contract_id="$1"
  shift
  local attempt=1
  local output=""
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

get_latest_close_time() {
  curl -s -X POST "$RPC_URL" \
    -H 'content-type: application/json' \
    -d '{"jsonrpc":"2.0","id":1,"method":"getLatestLedger"}' \
    | python3 -c 'import json,sys; print(int(json.load(sys.stdin).get("result",{}).get("closeTime",0)))'
}

wait_until_close_time() {
  local target="$1"
  local now
  now="$(get_latest_close_time)"
  while [[ "$now" -lt "$target" ]]; do
    sleep 5
    now="$(get_latest_close_time)"
  done
}

json_field() {
  local field="$1"
  local payload="$2"
  python3 - "$field" "$payload" <<'PY'
import json
import sys

value = json.loads(sys.argv[2])
for part in sys.argv[1].split("."):
    value = value[part]
if isinstance(value, bool):
    print("true" if value else "false")
else:
    print(value)
PY
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

assert_gt() {
  local left="$1"
  local right="$2"
  local label="$3"
  python3 - "$left" "$right" "$label" <<'PY'
import sys
left = int(sys.argv[1])
right = int(sys.argv[2])
if left <= right:
    raise SystemExit(f"ERROR: {sys.argv[3]} expected {left} > {right}")
PY
}

echo "1) Deploy isolated fee-validation stack"
TOKEN_ID="$(deploy_contract "$TOKEN_WASM_PATH")"
ROUTER_ID="$(deploy_contract "$ROUTER_WASM_PATH")"
PROFIT_ADAPTER_ID="$(deploy_contract "$PROFIT_ADAPTER_WASM_PATH")"
ARKA_ID="$(deploy_contract "$ARKA_WASM_PATH")"
echo "   TOKEN_ID=$TOKEN_ID"
echo "   ROUTER_ID=$ROUTER_ID"
echo "   PROFIT_ADAPTER_ID=$PROFIT_ADAPTER_ID"
echo "   ARKA_ID=$ARKA_ID"

echo "2) Initialize token, adapter, and Arka"
invoke_send "$TOKEN_ID" init --admin "$ADMIN_ADDR"
invoke_send "$PROFIT_ADAPTER_ID" init \
  --admin "$ADMIN_ADDR" \
  --router "$ROUTER_ID" \
  --profit_token "$TOKEN_ID" \
  --default_bonus "$PROFIT_BONUS"

WHITELIST_JSON="$(jq -cn --arg token "$TOKEN_ID" '[$token]')"
invoke_send "$ARKA_ID" init \
  --denomination_contract "$TOKEN_ID" \
  --mgmt_bps "$MGMT_BPS" \
  --perf_bps "$PERF_BPS" \
  --deposit_bps 0 \
  --redeem_bps 0 \
  --whitelist_contracts "$WHITELIST_JSON" \
  --manager "$ADMIN_ADDR"
invoke_send "$ARKA_ID" set_router --caller "$ADMIN_ADDR" --router "$ROUTER_ID"
invoke_send "$ARKA_ID" set_protocol_fee_policy \
  --caller "$ADMIN_ADDR" \
  --treasury "$TREASURY_ADDR" \
  --mgmt_protocol_bps "$MGMT_PROTOCOL_BPS" \
  --perf_protocol_bps "$PERF_PROTOCOL_BPS"

echo "3) Fund holder and profit adapter"
invoke_send "$TOKEN_ID" mint --to "$HOLDER_ADDR" --amount "$HOLDER_MINT_AMOUNT"
invoke_send "$TOKEN_ID" mint --to "$PROFIT_ADAPTER_ID" --amount "$ADAPTER_PROFIT_POOL"

echo "4) Deposit holder capital"
invoke_send_as "$HOLDER_IDENTITY" "$TOKEN_ID" approve --owner "$HOLDER_ADDR" --spender "$ARKA_ID" --amount "$DEPOSIT_AMOUNT"
stellar contract invoke \
  --id "$ARKA_ID" \
  --source-account "$HOLDER_IDENTITY" \
  --rpc-url "$RPC_URL" \
  --network-passphrase "$NETWORK_PASSPHRASE" \
  --send=yes -- deposit \
  --user "$HOLDER_ADDR" \
  --asset "{\"contract\":\"$TOKEN_ID\"}" \
  --amount "$DEPOSIT_AMOUNT" >/dev/null

echo "5) Wait for management fee accrual"
TARGET_CLOSE_TIME="$(( $(get_latest_close_time) + WAIT_SECONDS_FOR_MGMT ))"
wait_until_close_time "$TARGET_CLOSE_TIME"

PREVIEW_JSON="$(invoke_value "$ARKA_ID" "$ADMIN_IDENTITY" "$RPC_URL" "$NETWORK_PASSPHRASE" preview_fee_settlement)"
PREVIEW_MGMT_SHARES="$(json_field management_fee_shares "$PREVIEW_JSON")"
PREVIEW_PROTOCOL_SHARES="$(json_field protocol_fee_shares "$PREVIEW_JSON")"
assert_gt_zero "$PREVIEW_MGMT_SHARES" "preview management_fee_shares"
assert_gt_zero "$PREVIEW_PROTOCOL_SHARES" "preview protocol_fee_shares"

echo "6) Settle management fees"
SETTLE_JSON="$(invoke_value "$ARKA_ID" "$ADMIN_IDENTITY" "$RPC_URL" "$NETWORK_PASSPHRASE" settle_fees)"
SETTLE_MANAGER_FEE_SHARES="$(json_field manager_fee_shares "$SETTLE_JSON")"
SETTLE_PROTOCOL_FEE_SHARES="$(json_field protocol_fee_shares "$SETTLE_JSON")"
assert_gt_zero "$SETTLE_MANAGER_FEE_SHARES" "settle manager_fee_shares"
assert_gt_zero "$SETTLE_PROTOCOL_FEE_SHARES" "settle protocol_fee_shares"

MANAGER_SHARES_AFTER_MGMT="$(invoke_value "$ARKA_ID" "$ADMIN_IDENTITY" "$RPC_URL" "$NETWORK_PASSPHRASE" shares_of --user "$ADMIN_ADDR")"
TREASURY_SHARES_AFTER_MGMT="$(invoke_value "$ARKA_ID" "$ADMIN_IDENTITY" "$RPC_URL" "$NETWORK_PASSPHRASE" shares_of --user "$TREASURY_ADDR")"
assert_gt_zero "$MANAGER_SHARES_AFTER_MGMT" "manager shares after management settlement"
assert_gt_zero "$TREASURY_SHARES_AFTER_MGMT" "treasury shares after management settlement"

echo "7) Realize profit through controlled rebalance"
STEPS_JSON="$(jq -cn \
  --arg adapter "$PROFIT_ADAPTER_ID" \
  --arg token "$TOKEN_ID" \
  --arg router "$ROUTER_ID" \
  --arg amount "$REBALANCE_AMOUNT_IN" \
  '[{"adapter":$adapter,"pool_id":"7","asset_in":{"contract":$token},"amount_in":$amount,"min_out":$amount,"asset_out":{"contract":$token},"router_addr":$router}]'
)"
invoke_send "$ARKA_ID" rebalance --manager "$ADMIN_ADDR" --steps "$STEPS_JSON"

FEE_STATE_AFTER_PROFIT_JSON="$(invoke_value "$ARKA_ID" "$ADMIN_IDENTITY" "$RPC_URL" "$NETWORK_PASSPHRASE" fee_state)"
PERF_SHARES="$(json_field cumulative_performance_shares "$FEE_STATE_AFTER_PROFIT_JSON")"
MANAGER_SHARES_AFTER_PROFIT="$(invoke_value "$ARKA_ID" "$ADMIN_IDENTITY" "$RPC_URL" "$NETWORK_PASSPHRASE" shares_of --user "$ADMIN_ADDR")"
TREASURY_SHARES_AFTER_PROFIT="$(invoke_value "$ARKA_ID" "$ADMIN_IDENTITY" "$RPC_URL" "$NETWORK_PASSPHRASE" shares_of --user "$TREASURY_ADDR")"
NAV_AFTER_PROFIT="$(invoke_value "$ARKA_ID" "$ADMIN_IDENTITY" "$RPC_URL" "$NETWORK_PASSPHRASE" nav)"
assert_gt_zero "$PERF_SHARES" "cumulative performance shares"
assert_gt "$MANAGER_SHARES_AFTER_PROFIT" "$MANAGER_SHARES_AFTER_MGMT" "manager shares after profit"
assert_gt "$TREASURY_SHARES_AFTER_PROFIT" "$TREASURY_SHARES_AFTER_MGMT" "treasury shares after profit"

echo "8) Redeem all depositor shares and verify fee ownership remains"
USER_SHARES_BEFORE_REDEEM="$(invoke_value "$ARKA_ID" "$HOLDER_IDENTITY" "$RPC_URL" "$NETWORK_PASSPHRASE" shares_of --user "$HOLDER_ADDR")"
stellar contract invoke \
  --id "$ARKA_ID" \
  --source-account "$HOLDER_IDENTITY" \
  --rpc-url "$RPC_URL" \
  --network-passphrase "$NETWORK_PASSPHRASE" \
  --send=yes -- redeem \
  --user "$HOLDER_ADDR" \
  --shares "$USER_SHARES_BEFORE_REDEEM" >/dev/null

USER_SHARES_AFTER_REDEEM="$(invoke_value "$ARKA_ID" "$HOLDER_IDENTITY" "$RPC_URL" "$NETWORK_PASSPHRASE" shares_of --user "$HOLDER_ADDR")"
MANAGER_SHARES_FINAL="$(invoke_value "$ARKA_ID" "$ADMIN_IDENTITY" "$RPC_URL" "$NETWORK_PASSPHRASE" shares_of --user "$ADMIN_ADDR")"
TREASURY_SHARES_FINAL="$(invoke_value "$ARKA_ID" "$ADMIN_IDENTITY" "$RPC_URL" "$NETWORK_PASSPHRASE" shares_of --user "$TREASURY_ADDR")"
NAV_FINAL="$(invoke_value "$ARKA_ID" "$ADMIN_IDENTITY" "$RPC_URL" "$NETWORK_PASSPHRASE" nav)"
HOLDER_BALANCE_FINAL="$(invoke_value "$TOKEN_ID" "$HOLDER_IDENTITY" "$RPC_URL" "$NETWORK_PASSPHRASE" balance --owner "$HOLDER_ADDR")"
assert_gt_zero "$MANAGER_SHARES_FINAL" "final manager shares"
assert_gt_zero "$TREASURY_SHARES_FINAL" "final treasury shares"

python3 - <<'PY' "$OUT_JSON" "$DEPLOY_JSON" "$RPC_URL" "$ADMIN_IDENTITY" "$HOLDER_IDENTITY" "$TREASURY_IDENTITY" "$TOKEN_ID" "$ROUTER_ID" "$PROFIT_ADAPTER_ID" "$ARKA_ID" "$PREVIEW_JSON" "$SETTLE_JSON" "$FEE_STATE_AFTER_PROFIT_JSON" "$MANAGER_SHARES_AFTER_MGMT" "$TREASURY_SHARES_AFTER_MGMT" "$MANAGER_SHARES_AFTER_PROFIT" "$TREASURY_SHARES_AFTER_PROFIT" "$USER_SHARES_BEFORE_REDEEM" "$USER_SHARES_AFTER_REDEEM" "$MANAGER_SHARES_FINAL" "$TREASURY_SHARES_FINAL" "$NAV_AFTER_PROFIT" "$NAV_FINAL" "$HOLDER_BALANCE_FINAL"
import json
import sys

(
    out_path,
    deploy_path,
    rpc_url,
    admin_identity,
    holder_identity,
    treasury_identity,
    token_id,
    router_id,
    profit_adapter_id,
    arka_id,
    preview_json,
    settle_json,
    fee_state_after_profit_json,
    manager_shares_after_mgmt,
    treasury_shares_after_mgmt,
    manager_shares_after_profit,
    treasury_shares_after_profit,
    user_shares_before_redeem,
    user_shares_after_redeem,
    manager_shares_final,
    treasury_shares_final,
    nav_after_profit,
    nav_final,
    holder_balance_final,
) = sys.argv[1:]

record = {
    "validatedAt": "2026-03-28",
    "network": "testnet",
    "rpcUrl": rpc_url,
    "identities": {
        "admin": admin_identity,
        "holder": holder_identity,
        "treasury": treasury_identity,
    },
    "contracts": {
        "arka": arka_id,
        "token": token_id,
        "router": router_id,
        "profitAdapter": profit_adapter_id,
    },
    "results": {
        "preview": json.loads(preview_json),
        "settlement": json.loads(settle_json),
        "feeStateAfterProfit": json.loads(fee_state_after_profit_json),
        "managerSharesAfterManagement": manager_shares_after_mgmt,
        "treasurySharesAfterManagement": treasury_shares_after_mgmt,
        "managerSharesAfterProfit": manager_shares_after_profit,
        "treasurySharesAfterProfit": treasury_shares_after_profit,
        "userSharesBeforeRedeem": user_shares_before_redeem,
        "userSharesAfterRedeem": user_shares_after_redeem,
        "managerSharesFinal": manager_shares_final,
        "treasurySharesFinal": treasury_shares_final,
        "navAfterProfit": nav_after_profit,
        "navFinal": nav_final,
        "holderBalanceFinal": holder_balance_final,
    },
}

with open(out_path, "w", encoding="utf-8") as fh:
    json.dump(record, fh, indent=2)
    fh.write("\n")

with open(deploy_path, "r", encoding="utf-8") as fh:
    deploy = json.load(fh)

deploy.setdefault("validations", {})
deploy["validations"]["feeEngine"] = record

with open(deploy_path, "w", encoding="utf-8") as fh:
    json.dump(deploy, fh, indent=2)
    fh.write("\n")
PY

echo "✅ Fee engine live validation complete"
echo "   report: $OUT_JSON"
