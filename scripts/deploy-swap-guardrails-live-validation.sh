#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
DEPLOY_JSON="${DEPLOY_JSON:-$ROOT_DIR/deployments.testnet.json}"
OUT_JSON="${OUT_JSON:-$ROOT_DIR/tmp/swap-guardrails-live-validation.json}"
VALIDATED_AT="${VALIDATED_AT:-$(date -u +%F)}"
NETWORK_PASSPHRASE="${VALIDATION_NETWORK_PASSPHRASE:-Test SDF Network ; September 2015}"
RPC_URL="${VALIDATION_RPC_URL:-https://soroban-testnet.stellar.org}"
ADMIN_IDENTITY="${ADMIN_IDENTITY:-arka-admin}"
MANAGER_IDENTITY="${MANAGER_IDENTITY:-arka-admin}"

ARKA_WASM_PATH="${ARKA_WASM_PATH:-$ROOT_DIR/artifacts/arka.wasm}"
ROUTER_WASM_PATH="${ROUTER_WASM_PATH:-$ROOT_DIR/artifacts/router.wasm}"
TOKEN_WASM_PATH="${TOKEN_WASM_PATH:-$ROOT_DIR/artifacts/test-token.wasm}"
PROFIT_ADAPTER_WASM_PATH="${PROFIT_ADAPTER_WASM_PATH:-$ROOT_DIR/artifacts/test-profit-adapter.wasm}"
ORACLE_WASM_PATH="${ORACLE_WASM_PATH:-$ROOT_DIR/artifacts/test-oracle.wasm}"
INVOKE_HELPER="${INVOKE_HELPER:-$ROOT_DIR/scripts/contract_invoke_value.py}"

DEPOSIT_AMOUNT="${DEPOSIT_AMOUNT:-1000000}"
REBALANCE_AMOUNT="${REBALANCE_AMOUNT:-100000}"
SUCCESS_MIN_OUT="${SUCCESS_MIN_OUT:-99000}"
FAIL_MIN_OUT="${FAIL_MIN_OUT:-90000}"
PRICE_SCALE="${PRICE_SCALE:-10000000}"

mkdir -p "$(dirname "$OUT_JSON")"

for path in "$ARKA_WASM_PATH" "$ROUTER_WASM_PATH" "$TOKEN_WASM_PATH" "$PROFIT_ADAPTER_WASM_PATH" "$ORACLE_WASM_PATH" "$INVOKE_HELPER"; do
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
MANAGER_ADDR="$(stellar keys address "$MANAGER_IDENTITY")"

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
      printf '%s\n' "$output"
      sleep 2
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

invoke_send_manager() {
  invoke_send_as "$MANAGER_IDENTITY" "$@"
}

invoke_value() {
  python3 "$INVOKE_HELPER" "$@"
}

latest_ledger_close_time() {
  curl -s -X POST "$RPC_URL" \
    -H 'content-type: application/json' \
    -d '{"jsonrpc":"2.0","id":1,"method":"getLatestLedger"}' \
    | python3 -c 'import json,sys; print(int(json.load(sys.stdin).get("result",{}).get("closeTime",0)))'
}

echo "1) Deploy isolated swap-guardrails validation stack"
TOKEN_ID="$(deploy_contract "$TOKEN_WASM_PATH")"
ROUTER_ID="$(deploy_contract "$ROUTER_WASM_PATH")"
PROFIT_ADAPTER_ID="$(deploy_contract "$PROFIT_ADAPTER_WASM_PATH")"
ORACLE_ID="$(deploy_contract "$ORACLE_WASM_PATH")"
ARKA_ID="$(deploy_contract "$ARKA_WASM_PATH")"

echo "2) Initialize contracts"
invoke_send "$TOKEN_ID" init --admin "$ADMIN_ADDR" >/dev/null
invoke_send "$TOKEN_ID" mint --to "$MANAGER_ADDR" --amount "$DEPOSIT_AMOUNT" >/dev/null
invoke_send "$PROFIT_ADAPTER_ID" init \
  --admin "$ADMIN_ADDR" \
  --router "$ROUTER_ID" \
  --profit_token "$TOKEN_ID" \
  --default_bonus 0 >/dev/null
invoke_send "$ORACLE_ID" init --admin "$ADMIN_ADDR" >/dev/null

NOW_TS="$(latest_ledger_close_time)"
invoke_send "$ORACLE_ID" set_stellar_price \
  --caller "$ADMIN_ADDR" \
  --asset "$TOKEN_ID" \
  --price "$PRICE_SCALE" \
  --timestamp "$NOW_TS" >/dev/null

WHITELIST_JSON="$(jq -cn --arg token "$TOKEN_ID" '[$token]')"
invoke_send "$ARKA_ID" init \
  --denomination_contract "$TOKEN_ID" \
  --mgmt_bps 0 \
  --perf_bps 0 \
  --deposit_bps 0 \
  --redeem_bps 0 \
  --whitelist_contracts "$WHITELIST_JSON" \
  --manager "$MANAGER_ADDR" >/dev/null
invoke_send_manager "$ARKA_ID" set_router --caller "$MANAGER_ADDR" --router "$ROUTER_ID" >/dev/null
invoke_send_manager "$ARKA_ID" set_swap_oracle --caller "$MANAGER_ADDR" --oracle "$ORACLE_ID" >/dev/null
invoke_send_manager "$ARKA_ID" set_allowed_venues \
  --caller "$MANAGER_ADDR" \
  --allowed_routers "[]" \
  --allowed_adapters "[\"$PROFIT_ADAPTER_ID\"]" >/dev/null
invoke_send_manager "$ARKA_ID" set_swap_risk_policy \
  --caller "$MANAGER_ADDR" \
  --enabled true \
  --oracle_checks_enabled true \
  --max_price_impact_bps 300 \
  --max_slippage_bps 300 \
  --max_twap_deviation_bps 350 \
  --max_oracle_age_seconds 120 \
  --max_trade_size_bps 5000 >/dev/null

echo "3) Deposit and run successful rebalance under policy"
invoke_send_manager "$TOKEN_ID" approve \
  --owner "$MANAGER_ADDR" \
  --spender "$ARKA_ID" \
  --amount "$DEPOSIT_AMOUNT" >/dev/null
invoke_send_manager "$ARKA_ID" deposit \
  --user "$MANAGER_ADDR" \
  --asset "{\"contract\":\"$TOKEN_ID\"}" \
  --amount "$DEPOSIT_AMOUNT" >/dev/null

SUCCESS_STEPS_JSON="$(jq -cn \
  --arg adapter "$PROFIT_ADAPTER_ID" \
  --arg token "$TOKEN_ID" \
  --arg router "$ROUTER_ID" \
  --arg amount "$REBALANCE_AMOUNT" \
  --arg minOut "$SUCCESS_MIN_OUT" \
  '[{"adapter":$adapter,"pool_id":"1","asset_in":{"contract":$token},"amount_in":$amount,"min_out":$minOut,"asset_out":{"contract":$token},"router_addr":$router}]'
)"
SUCCESS_OUT="$(invoke_send_manager "$ARKA_ID" rebalance --manager "$MANAGER_ADDR" --steps "$SUCCESS_STEPS_JSON" | tail -n1 | tr -d '"')"

echo "4) Validate denial path: disallowed adapter"
invoke_send_manager "$ARKA_ID" set_allowed_venues \
  --caller "$MANAGER_ADDR" \
  --allowed_routers "[]" \
  --allowed_adapters "[\"$MANAGER_ADDR\"]" >/dev/null

set +e
DISALLOWED_OUT="$(
  stellar contract invoke \
    --id "$ARKA_ID" \
    --source-account "$MANAGER_IDENTITY" \
    --rpc-url "$RPC_URL" \
    --network-passphrase "$NETWORK_PASSPHRASE" \
    --send=yes -- rebalance \
    --manager "$MANAGER_ADDR" \
    --steps "$SUCCESS_STEPS_JSON" 2>&1
)"
DISALLOWED_STATUS=$?
set -e

if [[ "$DISALLOWED_STATUS" -eq 0 ]]; then
  echo "ERROR: expected disallowed-adapter rebalance to fail" >&2
  exit 1
fi

echo "5) Validate denial path: price impact cap"
invoke_send_manager "$ARKA_ID" set_allowed_venues \
  --caller "$MANAGER_ADDR" \
  --allowed_routers "[]" \
  --allowed_adapters "[\"$PROFIT_ADAPTER_ID\"]" >/dev/null
NOW_TS="$(latest_ledger_close_time)"
invoke_send "$ORACLE_ID" set_stellar_price \
  --caller "$ADMIN_ADDR" \
  --asset "$TOKEN_ID" \
  --price "$PRICE_SCALE" \
  --timestamp "$NOW_TS" >/dev/null
invoke_send_manager "$ARKA_ID" set_swap_risk_policy \
  --caller "$MANAGER_ADDR" \
  --enabled true \
  --oracle_checks_enabled true \
  --max_price_impact_bps 50 \
  --max_slippage_bps 10000 \
  --max_twap_deviation_bps 10000 \
  --max_oracle_age_seconds 120 \
  --max_trade_size_bps 5000 >/dev/null

FAIL_STEPS_JSON="$(jq -cn \
  --arg adapter "$PROFIT_ADAPTER_ID" \
  --arg token "$TOKEN_ID" \
  --arg router "$ROUTER_ID" \
  --arg amount "$REBALANCE_AMOUNT" \
  --arg minOut "$FAIL_MIN_OUT" \
  '[{"adapter":$adapter,"pool_id":"2","asset_in":{"contract":$token},"amount_in":$amount,"min_out":$minOut,"asset_out":{"contract":$token},"router_addr":$router}]'
)"

set +e
PRICE_IMPACT_OUT="$(
  stellar contract invoke \
    --id "$ARKA_ID" \
    --source-account "$MANAGER_IDENTITY" \
    --rpc-url "$RPC_URL" \
    --network-passphrase "$NETWORK_PASSPHRASE" \
    --send=yes -- rebalance \
    --manager "$MANAGER_ADDR" \
    --steps "$FAIL_STEPS_JSON" 2>&1
)"
PRICE_IMPACT_STATUS=$?
set -e

if [[ "$PRICE_IMPACT_STATUS" -eq 0 ]]; then
  echo "ERROR: expected price-impact rebalance to fail" >&2
  exit 1
fi

POLICY_JSON="$(invoke_value "$ARKA_ID" "$ADMIN_IDENTITY" "$RPC_URL" "$NETWORK_PASSPHRASE" swap_risk_policy)"

python3 - <<'PY' \
  "$OUT_JSON" "$DEPLOY_JSON" "$VALIDATED_AT" "$RPC_URL" "$ADMIN_IDENTITY" "$MANAGER_IDENTITY" \
  "$ARKA_ID" "$TOKEN_ID" "$ROUTER_ID" "$PROFIT_ADAPTER_ID" "$ORACLE_ID" \
  "$SUCCESS_OUT" "$POLICY_JSON" \
  "$DISALLOWED_STATUS" "$DISALLOWED_OUT" \
  "$PRICE_IMPACT_STATUS" "$PRICE_IMPACT_OUT"
import json
import re
import sys

(
    out_path,
    deploy_path,
    validated_at,
    rpc_url,
    admin_identity,
    manager_identity,
    arka_id,
    token_id,
    router_id,
    adapter_id,
    oracle_id,
    success_out,
    policy_json,
    disallowed_status,
    disallowed_out,
    price_impact_status,
    price_impact_out,
) = sys.argv[1:]

disallowed_status = int(disallowed_status)
price_impact_status = int(price_impact_status)

def extract_contract_error_code(raw: str):
    for pattern in (
        r"Error\(Contract,\s*#(\d+)\)",
        r"ContractError\((\d+)\)",
        r"Contract,\s*#(\d+)",
    ):
        match = re.search(pattern, raw)
        if match:
            return int(match.group(1))
    return None

disallowed_code = extract_contract_error_code(disallowed_out)
price_impact_code = extract_contract_error_code(price_impact_out)

if disallowed_status == 0:
    raise SystemExit("expected disallowed-adapter path to fail")
if price_impact_status == 0:
    raise SystemExit("expected price-impact path to fail")

if disallowed_code is not None and disallowed_code != 24:
    raise SystemExit(f"disallowed-adapter failed with unexpected code: {disallowed_code} (expected 24)")
if price_impact_code is not None and price_impact_code != 29:
    raise SystemExit(f"price-impact failed with unexpected code: {price_impact_code} (expected 29)")

record = {
    "validatedAt": validated_at,
    "network": "testnet",
    "rpcUrl": rpc_url,
    "identities": {
        "admin": admin_identity,
        "manager": manager_identity,
    },
    "contracts": {
        "arka": arka_id,
        "token": token_id,
        "router": router_id,
        "profitAdapter": adapter_id,
        "swapOracle": oracle_id,
    },
    "results": {
        "successfulRebalanceOut": success_out,
        "policySnapshot": json.loads(policy_json),
        "blockedDisallowedAdapter": disallowed_status != 0,
        "blockedPriceImpact": price_impact_status != 0,
        "disallowedAdapterErrorCode": disallowed_code,
        "priceImpactErrorCode": price_impact_code,
    },
}

with open(out_path, "w", encoding="utf-8") as fh:
    json.dump(record, fh, indent=2)
    fh.write("\n")

with open(deploy_path, "r", encoding="utf-8") as fh:
    deploy = json.load(fh)

deploy.setdefault("validations", {})
deploy["validations"]["swapGuardrails"] = record

with open(deploy_path, "w", encoding="utf-8") as fh:
    json.dump(deploy, fh, indent=2)
    fh.write("\n")
PY

echo "✅ Swap guardrails live validation complete"
echo "   report: $OUT_JSON"
