#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
DEPLOY_JSON="${DEPLOY_JSON:-$ROOT_DIR/deployments.testnet.json}"
OUT_JSON="${OUT_JSON:-$ROOT_DIR/tmp/coverage-claims-live-validation.json}"
NETWORK_PASSPHRASE="${VALIDATION_NETWORK_PASSPHRASE:-Test SDF Network ; September 2015}"
RPC_URL="${VALIDATION_RPC_URL:-https://soroban-testnet.stellar.org}"
ADMIN_IDENTITY="${ADMIN_IDENTITY:-arka-admin}"
STAKER_IDENTITY="${STAKER_IDENTITY:-arka-holder}"
TREASURY_IDENTITY="${TREASURY_IDENTITY:-dogstar}"
COVERED_VAULT_IDENTITY="${COVERED_VAULT_IDENTITY:-marcos}"
PAYOUT_IDENTITY="${PAYOUT_IDENTITY:-$STAKER_IDENTITY}"

TOKEN_WASM_PATH="${TOKEN_WASM_PATH:-$ROOT_DIR/artifacts/test-token.wasm}"
COVERAGE_VAULT_WASM_PATH="${COVERAGE_VAULT_WASM_PATH:-$ROOT_DIR/artifacts/coverage-vault.wasm}"
COVERAGE_FUND_WASM_PATH="${COVERAGE_FUND_WASM_PATH:-$ROOT_DIR/artifacts/coverage-fund.wasm}"
CLAIMS_MANAGER_WASM_PATH="${CLAIMS_MANAGER_WASM_PATH:-$ROOT_DIR/artifacts/claims-manager.wasm}"
INVOKE_HELPER="${INVOKE_HELPER:-$ROOT_DIR/scripts/contract_invoke_value.py}"

MANAGER_DEPOSIT="${MANAGER_DEPOSIT:-200}"
STAKER_STAKE="${STAKER_STAKE:-600}"
TREASURY_BUFFER="${TREASURY_BUFFER:-500}"
BOOTSTRAP_REWARD="${BOOTSTRAP_REWARD:-300}"
COVERED_NAV="${COVERED_NAV:-8000}"
COVERAGE_LIMIT="${COVERAGE_LIMIT:-20000}"
PREMIUM_ANNUAL_BPS="${PREMIUM_ANNUAL_BPS:-1200}"
PREMIUM_PERIOD_BPS="${PREMIUM_PERIOD_BPS:-2500}"
RESERVE_RETAIN_BPS="${RESERVE_RETAIN_BPS:-6000}"
TREASURY_SHARE_BPS="${TREASURY_SHARE_BPS:-500}"
RESERVE_TARGET_BPS="${RESERVE_TARGET_BPS:-2500}"
REJECTED_LOSS="${REJECTED_LOSS:-300}"
APPROVED_LOSS="${APPROVED_LOSS:-1000}"
APPROVED_PAYOUT="${APPROVED_PAYOUT:-1000}"
VAULT_LOCK_BPS="${VAULT_LOCK_BPS:-2000}"

EXPECTED_PREMIUM="${EXPECTED_PREMIUM:-240}"
EXPECTED_RETAINED="${EXPECTED_RETAINED:-156}"
EXPECTED_RESERVE_REWARD="${EXPECTED_RESERVE_REWARD:-84}"
EXPECTED_TREASURY_PREMIUM="${EXPECTED_TREASURY_PREMIUM:-0}"
EXPECTED_RESERVE_CAPITAL_AFTER_PREMIUM="${EXPECTED_RESERVE_CAPITAL_AFTER_PREMIUM:-756}"
EXPECTED_RESERVE_RATIO_AFTER_PREMIUM="${EXPECTED_RESERVE_RATIO_AFTER_PREMIUM:-945}"
EXPECTED_MANAGER_PAYOUT="${EXPECTED_MANAGER_PAYOUT:-200}"
EXPECTED_FUND_PAYOUT="${EXPECTED_FUND_PAYOUT:-756}"
EXPECTED_TREASURY_PAYOUT="${EXPECTED_TREASURY_PAYOUT:-44}"
EXPECTED_HOLDER_RESERVE_AFTER_CLAIM="${EXPECTED_HOLDER_RESERVE_AFTER_CLAIM:-84}"
EXPECTED_HOLDER_BOOT_AFTER_CLAIM="${EXPECTED_HOLDER_BOOT_AFTER_CLAIM:-300}"
EXPECTED_HOLDER_RESERVE_FINAL="${EXPECTED_HOLDER_RESERVE_FINAL:-1084}"
EXPECTED_TREASURY_RESERVE_FINAL="${EXPECTED_TREASURY_RESERVE_FINAL:-456}"

mkdir -p "$(dirname "$OUT_JSON")"

for path in \
  "$TOKEN_WASM_PATH" \
  "$COVERAGE_VAULT_WASM_PATH" \
  "$COVERAGE_FUND_WASM_PATH" \
  "$CLAIMS_MANAGER_WASM_PATH" \
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
STAKER_ADDR="$(stellar keys address "$STAKER_IDENTITY")"
TREASURY_ADDR="$(stellar keys address "$TREASURY_IDENTITY")"
COVERED_VAULT_ADDR="$(stellar keys address "$COVERED_VAULT_IDENTITY")"
PAYOUT_ADDR="$(stellar keys address "$PAYOUT_IDENTITY")"

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

assert_eq() {
  local left="$1"
  local right="$2"
  local label="$3"
  python3 - "$left" "$right" "$label" <<'PY'
import sys
left = sys.argv[1]
right = sys.argv[2]
if left != right:
    raise SystemExit(f"ERROR: {sys.argv[3]} expected {right}, got {left}")
PY
}

assert_true() {
  local value="$1"
  local label="$2"
  if [[ "$value" != "true" ]]; then
    echo "ERROR: $label expected true, got $value" >&2
    exit 1
  fi
}

assert_false() {
  local value="$1"
  local label="$2"
  if [[ "$value" != "false" ]]; then
    echo "ERROR: $label expected false, got $value" >&2
    exit 1
  fi
}

echo "1) Deploy isolated coverage + claims validation stack"
RESERVE_TOKEN_ID="$(deploy_contract "$TOKEN_WASM_PATH")"
BOOT_TOKEN_ID="$(deploy_contract "$TOKEN_WASM_PATH")"
COVERAGE_VAULT_ID="$(deploy_contract "$COVERAGE_VAULT_WASM_PATH")"
COVERAGE_FUND_ID="$(deploy_contract "$COVERAGE_FUND_WASM_PATH")"
CLAIMS_MANAGER_ID="$(deploy_contract "$CLAIMS_MANAGER_WASM_PATH")"
echo "   RESERVE_TOKEN_ID=$RESERVE_TOKEN_ID"
echo "   BOOT_TOKEN_ID=$BOOT_TOKEN_ID"
echo "   COVERAGE_VAULT_ID=$COVERAGE_VAULT_ID"
echo "   COVERAGE_FUND_ID=$COVERAGE_FUND_ID"
echo "   CLAIMS_MANAGER_ID=$CLAIMS_MANAGER_ID"

echo "2) Initialize contracts and policy"
invoke_send "$RESERVE_TOKEN_ID" init --admin "$ADMIN_ADDR"
invoke_send "$BOOT_TOKEN_ID" init --admin "$ADMIN_ADDR"
invoke_send "$COVERAGE_VAULT_ID" init --manager "$ADMIN_ADDR" --token "$RESERVE_TOKEN_ID" --lock_bps "$VAULT_LOCK_BPS"
invoke_send "$COVERAGE_FUND_ID" init --admin "$ADMIN_ADDR" --reserve_token "$RESERVE_TOKEN_ID" --bootstrap_token "$BOOT_TOKEN_ID"
invoke_send "$COVERAGE_FUND_ID" set_treasury --caller "$ADMIN_ADDR" --treasury "$TREASURY_ADDR"
invoke_send "$COVERAGE_FUND_ID" set_economics_policy \
  --caller "$ADMIN_ADDR" \
  --reserve_retain_bps "$RESERVE_RETAIN_BPS" \
  --treasury_share_bps "$TREASURY_SHARE_BPS" \
  --reserve_target_bps "$RESERVE_TARGET_BPS"
invoke_send "$COVERAGE_FUND_ID" set_covered_vault_policy \
  --caller "$ADMIN_ADDR" \
  --vault "$COVERED_VAULT_ADDR" \
  --annual_premium_bps "$PREMIUM_ANNUAL_BPS" \
  --coverage_limit "$COVERAGE_LIMIT"
invoke_send "$CLAIMS_MANAGER_ID" init --admin "$ADMIN_ADDR" --reserve_token "$RESERVE_TOKEN_ID" --treasury "$TREASURY_ADDR"
invoke_send "$COVERAGE_FUND_ID" set_claims_manager --caller "$ADMIN_ADDR" --claims_manager "$CLAIMS_MANAGER_ID"
invoke_send "$COVERAGE_VAULT_ID" set_claims_manager --caller "$ADMIN_ADDR" --claims_manager "$CLAIMS_MANAGER_ID"
invoke_send "$CLAIMS_MANAGER_ID" register_covered_vault \
  --caller "$ADMIN_ADDR" \
  --vault "$COVERED_VAULT_ADDR" \
  --manager_vault "$COVERAGE_VAULT_ID" \
  --community_fund "$COVERAGE_FUND_ID" \
  --recipient "$PAYOUT_ADDR"

echo "3) Fund accounts and approvals"
invoke_send "$RESERVE_TOKEN_ID" mint --to "$ADMIN_ADDR" --amount "$((MANAGER_DEPOSIT + EXPECTED_PREMIUM))"
invoke_send "$RESERVE_TOKEN_ID" mint --to "$STAKER_ADDR" --amount "$STAKER_STAKE"
invoke_send "$RESERVE_TOKEN_ID" mint --to "$TREASURY_ADDR" --amount "$TREASURY_BUFFER"
invoke_send "$BOOT_TOKEN_ID" mint --to "$ADMIN_ADDR" --amount "$BOOTSTRAP_REWARD"

invoke_send_as "$ADMIN_IDENTITY" "$RESERVE_TOKEN_ID" approve --owner "$ADMIN_ADDR" --spender "$COVERAGE_VAULT_ID" --amount "$MANAGER_DEPOSIT"
invoke_send_as "$ADMIN_IDENTITY" "$RESERVE_TOKEN_ID" approve --owner "$ADMIN_ADDR" --spender "$COVERAGE_FUND_ID" --amount "$EXPECTED_PREMIUM"
invoke_send_as "$STAKER_IDENTITY" "$RESERVE_TOKEN_ID" approve --owner "$STAKER_ADDR" --spender "$COVERAGE_FUND_ID" --amount "$STAKER_STAKE"
invoke_send_as "$TREASURY_IDENTITY" "$RESERVE_TOKEN_ID" approve --owner "$TREASURY_ADDR" --spender "$CLAIMS_MANAGER_ID" --amount "$TREASURY_BUFFER"
invoke_send_as "$ADMIN_IDENTITY" "$BOOT_TOKEN_ID" approve --owner "$ADMIN_ADDR" --spender "$COVERAGE_FUND_ID" --amount "$BOOTSTRAP_REWARD"

echo "4) Validate coverage economics"
invoke_send "$COVERAGE_VAULT_ID" deposit --from "$ADMIN_ADDR" --amount "$MANAGER_DEPOSIT"
invoke_send_as "$STAKER_IDENTITY" "$COVERAGE_FUND_ID" stake --user "$STAKER_ADDR" --amount "$STAKER_STAKE"
PREMIUM_JSON="$(invoke_value "$COVERAGE_FUND_ID" "$ADMIN_IDENTITY" "$RPC_URL" "$NETWORK_PASSPHRASE" pay_premium \
  --payer "$ADMIN_ADDR" \
  --vault "$COVERED_VAULT_ADDR" \
  --covered_nav "$COVERED_NAV" \
  --coverage_period_bps "$PREMIUM_PERIOD_BPS")"
invoke_send "$COVERAGE_FUND_ID" fund_bootstrap_rewards --caller "$ADMIN_ADDR" --amount "$BOOTSTRAP_REWARD"
CLAIM_JSON="$(invoke_value "$COVERAGE_FUND_ID" "$STAKER_IDENTITY" "$RPC_URL" "$NETWORK_PASSPHRASE" claim_all --user "$STAKER_ADDR")"
FUND_METRICS_AFTER_PREMIUM_JSON="$(invoke_value "$COVERAGE_FUND_ID" "$ADMIN_IDENTITY" "$RPC_URL" "$NETWORK_PASSPHRASE" metrics)"
PREMIUMS_PAID_BY_VAULT="$(invoke_value "$COVERAGE_FUND_ID" "$ADMIN_IDENTITY" "$RPC_URL" "$NETWORK_PASSPHRASE" premiums_paid_by_vault --vault "$COVERED_VAULT_ADDR")"
HOLDER_RESERVE_AFTER_CLAIM="$(invoke_value "$RESERVE_TOKEN_ID" "$ADMIN_IDENTITY" "$RPC_URL" "$NETWORK_PASSPHRASE" balance --owner "$STAKER_ADDR")"
HOLDER_BOOT_AFTER_CLAIM="$(invoke_value "$BOOT_TOKEN_ID" "$ADMIN_IDENTITY" "$RPC_URL" "$NETWORK_PASSPHRASE" balance --owner "$STAKER_ADDR")"

assert_eq "$(json_field premium_amount "$PREMIUM_JSON")" "$EXPECTED_PREMIUM" "premium amount"
assert_eq "$(json_field retained_amount "$PREMIUM_JSON")" "$EXPECTED_RETAINED" "retained premium amount"
assert_eq "$(json_field reserve_reward_amount "$PREMIUM_JSON")" "$EXPECTED_RESERVE_REWARD" "reserve reward amount"
assert_eq "$(json_field treasury_amount "$PREMIUM_JSON")" "$EXPECTED_TREASURY_PREMIUM" "treasury premium amount"
assert_eq "$(json_field reserve_reward "$CLAIM_JSON")" "$EXPECTED_RESERVE_REWARD" "reserve reward claim"
assert_eq "$(json_field bootstrap_reward "$CLAIM_JSON")" "$BOOTSTRAP_REWARD" "bootstrap reward claim"
assert_eq "$(json_field reserve_capital "$FUND_METRICS_AFTER_PREMIUM_JSON")" "$EXPECTED_RESERVE_CAPITAL_AFTER_PREMIUM" "reserve capital after premium"
assert_eq "$(json_field reserve_ratio_bps "$FUND_METRICS_AFTER_PREMIUM_JSON")" "$EXPECTED_RESERVE_RATIO_AFTER_PREMIUM" "reserve ratio after premium"
assert_eq "$(json_field total_premiums "$FUND_METRICS_AFTER_PREMIUM_JSON")" "$EXPECTED_PREMIUM" "total premiums after premium"
assert_eq "$(json_field total_retained_prem "$FUND_METRICS_AFTER_PREMIUM_JSON")" "$EXPECTED_RETAINED" "total retained premium"
assert_eq "$(json_field premiums_to_treas "$FUND_METRICS_AFTER_PREMIUM_JSON")" "$EXPECTED_TREASURY_PREMIUM" "premiums to treasury"
assert_eq "$(json_field total_covered_nav "$FUND_METRICS_AFTER_PREMIUM_JSON")" "$COVERED_NAV" "covered nav after premium"
assert_eq "$PREMIUMS_PAID_BY_VAULT" "$EXPECTED_PREMIUM" "premium paid by vault"
assert_eq "$HOLDER_RESERVE_AFTER_CLAIM" "$EXPECTED_HOLDER_RESERVE_AFTER_CLAIM" "holder reserve balance after reward claim"
assert_eq "$HOLDER_BOOT_AFTER_CLAIM" "$EXPECTED_HOLDER_BOOT_AFTER_CLAIM" "holder bootstrap balance after reward claim"

echo "5) Validate claims circuit"
REJECTED_INCIDENT_ID="$(invoke_value "$CLAIMS_MANAGER_ID" "$ADMIN_IDENTITY" "$RPC_URL" "$NETWORK_PASSPHRASE" trigger_incident \
  --caller "$ADMIN_ADDR" \
  --vault "$COVERED_VAULT_ADDR" \
  --kind 4 \
  --reported_loss "$REJECTED_LOSS" \
  --covered_nav "$COVERED_NAV" \
  --meta_hash 0101010101010101010101010101010101010101010101010101010101010101)"
assert_true "$(invoke_value "$CLAIMS_MANAGER_ID" "$ADMIN_IDENTITY" "$RPC_URL" "$NETWORK_PASSPHRASE" is_vault_frozen --vault "$COVERED_VAULT_ADDR")" "vault frozen after first trigger"
invoke_send "$CLAIMS_MANAGER_ID" reject_incident --caller "$ADMIN_ADDR" --incident_id "$REJECTED_INCIDENT_ID" --reason_code 11
assert_false "$(invoke_value "$CLAIMS_MANAGER_ID" "$ADMIN_IDENTITY" "$RPC_URL" "$NETWORK_PASSPHRASE" is_vault_frozen --vault "$COVERED_VAULT_ADDR")" "vault frozen after reject"
REJECTED_INCIDENT_JSON="$(invoke_value "$CLAIMS_MANAGER_ID" "$ADMIN_IDENTITY" "$RPC_URL" "$NETWORK_PASSPHRASE" incident --incident_id "$REJECTED_INCIDENT_ID")"

LIVE_INCIDENT_ID="$(invoke_value "$CLAIMS_MANAGER_ID" "$ADMIN_IDENTITY" "$RPC_URL" "$NETWORK_PASSPHRASE" trigger_incident \
  --caller "$ADMIN_ADDR" \
  --vault "$COVERED_VAULT_ADDR" \
  --kind 3 \
  --reported_loss "$APPROVED_LOSS" \
  --covered_nav "$COVERED_NAV" \
  --meta_hash 0202020202020202020202020202020202020202020202020202020202020202)"
APPROVED_PLAN_JSON="$(invoke_value "$CLAIMS_MANAGER_ID" "$ADMIN_IDENTITY" "$RPC_URL" "$NETWORK_PASSPHRASE" approve_incident \
  --caller "$ADMIN_ADDR" \
  --incident_id "$LIVE_INCIDENT_ID" \
  --approved_payout "$APPROVED_PAYOUT" \
  --recipient "$PAYOUT_ADDR" \
  --reason_code 12)"
assert_eq "$(json_field mgr_payout "$APPROVED_PLAN_JSON")" "$EXPECTED_MANAGER_PAYOUT" "manager payout plan"
assert_eq "$(json_field fund_payout "$APPROVED_PLAN_JSON")" "$EXPECTED_FUND_PAYOUT" "fund payout plan"
assert_eq "$(json_field treasury_payout "$APPROVED_PLAN_JSON")" "$EXPECTED_TREASURY_PAYOUT" "treasury payout plan"

EXECUTED_INCIDENT_JSON="$(invoke_value "$CLAIMS_MANAGER_ID" "$ADMIN_IDENTITY" "$RPC_URL" "$NETWORK_PASSPHRASE" execute_incident --incident_id "$LIVE_INCIDENT_ID")"
assert_false "$(invoke_value "$CLAIMS_MANAGER_ID" "$ADMIN_IDENTITY" "$RPC_URL" "$NETWORK_PASSPHRASE" is_vault_frozen --vault "$COVERED_VAULT_ADDR")" "vault frozen after execution"
FUND_METRICS_AFTER_EXECUTION_JSON="$(invoke_value "$COVERAGE_FUND_ID" "$ADMIN_IDENTITY" "$RPC_URL" "$NETWORK_PASSPHRASE" metrics)"
VAULT_BALANCE_FINAL="$(invoke_value "$COVERAGE_VAULT_ID" "$ADMIN_IDENTITY" "$RPC_URL" "$NETWORK_PASSPHRASE" balance)"
FUND_CLAIM_CAPACITY_FINAL="$(invoke_value "$COVERAGE_FUND_ID" "$ADMIN_IDENTITY" "$RPC_URL" "$NETWORK_PASSPHRASE" claim_capacity)"
HOLDER_RESERVE_FINAL="$(invoke_value "$RESERVE_TOKEN_ID" "$ADMIN_IDENTITY" "$RPC_URL" "$NETWORK_PASSPHRASE" balance --owner "$PAYOUT_ADDR")"
TREASURY_RESERVE_FINAL="$(invoke_value "$RESERVE_TOKEN_ID" "$ADMIN_IDENTITY" "$RPC_URL" "$NETWORK_PASSPHRASE" balance --owner "$TREASURY_ADDR")"
HOLDER_BOOT_FINAL="$(invoke_value "$BOOT_TOKEN_ID" "$ADMIN_IDENTITY" "$RPC_URL" "$NETWORK_PASSPHRASE" balance --owner "$PAYOUT_ADDR")"

assert_eq "$(json_field claims_from_retained "$FUND_METRICS_AFTER_EXECUTION_JSON")" "$EXPECTED_RETAINED" "claims from retained reserve"
assert_eq "$(json_field claims_from_staked "$FUND_METRICS_AFTER_EXECUTION_JSON")" "$STAKER_STAKE" "claims from staked reserve"
assert_eq "$(json_field reserve_capital "$FUND_METRICS_AFTER_EXECUTION_JSON")" "0" "reserve capital after execution"
assert_eq "$(json_field retained_reserve "$FUND_METRICS_AFTER_EXECUTION_JSON")" "0" "retained reserve after execution"
assert_eq "$(json_field total_staked "$FUND_METRICS_AFTER_EXECUTION_JSON")" "0" "total staked after execution"
assert_eq "$VAULT_BALANCE_FINAL" "0" "manager coverage vault balance final"
assert_eq "$FUND_CLAIM_CAPACITY_FINAL" "0" "community claim capacity final"
assert_eq "$HOLDER_RESERVE_FINAL" "$EXPECTED_HOLDER_RESERVE_FINAL" "holder reserve balance final"
assert_eq "$TREASURY_RESERVE_FINAL" "$EXPECTED_TREASURY_RESERVE_FINAL" "treasury reserve balance final"
assert_eq "$HOLDER_BOOT_FINAL" "$EXPECTED_HOLDER_BOOT_AFTER_CLAIM" "holder bootstrap balance final"

python3 - <<'PY' \
  "$OUT_JSON" \
  "$DEPLOY_JSON" \
  "$RPC_URL" \
  "$ADMIN_IDENTITY" \
  "$STAKER_IDENTITY" \
  "$TREASURY_IDENTITY" \
  "$COVERED_VAULT_IDENTITY" \
  "$PAYOUT_IDENTITY" \
  "$RESERVE_TOKEN_ID" \
  "$BOOT_TOKEN_ID" \
  "$COVERAGE_VAULT_ID" \
  "$COVERAGE_FUND_ID" \
  "$CLAIMS_MANAGER_ID" \
  "$PREMIUM_JSON" \
  "$CLAIM_JSON" \
  "$FUND_METRICS_AFTER_PREMIUM_JSON" \
  "$PREMIUMS_PAID_BY_VAULT" \
  "$HOLDER_RESERVE_AFTER_CLAIM" \
  "$HOLDER_BOOT_AFTER_CLAIM" \
  "$REJECTED_INCIDENT_ID" \
  "$REJECTED_INCIDENT_JSON" \
  "$LIVE_INCIDENT_ID" \
  "$APPROVED_PLAN_JSON" \
  "$EXECUTED_INCIDENT_JSON" \
  "$FUND_METRICS_AFTER_EXECUTION_JSON" \
  "$VAULT_BALANCE_FINAL" \
  "$FUND_CLAIM_CAPACITY_FINAL" \
  "$HOLDER_RESERVE_FINAL" \
  "$TREASURY_RESERVE_FINAL" \
  "$HOLDER_BOOT_FINAL"
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
    staker_identity,
    treasury_identity,
    covered_vault_identity,
    payout_identity,
    reserve_token_id,
    boot_token_id,
    coverage_vault_id,
    coverage_fund_id,
    claims_manager_id,
    premium_json,
    claim_json,
    metrics_after_premium_json,
    premiums_paid_by_vault,
    holder_reserve_after_claim,
    holder_boot_after_claim,
    rejected_incident_id,
    rejected_incident_json,
    live_incident_id,
    approved_plan_json,
    executed_incident_json,
    metrics_after_execution_json,
    vault_balance_final,
    fund_claim_capacity_final,
    holder_reserve_final,
    treasury_reserve_final,
    holder_boot_final,
) = sys.argv[1:]

coverage_validation = {
    "validatedAt": "2026-03-28",
    "network": "testnet",
    "rpcUrl": rpc_url,
    "identities": {
        "admin": admin_identity,
        "staker": staker_identity,
        "treasury": treasury_identity,
        "coveredVault": covered_vault_identity,
        "payout": payout_identity,
    },
    "contracts": {
        "reserveToken": reserve_token_id,
        "bootstrapToken": boot_token_id,
        "coverageVault": coverage_vault_id,
        "coverageFund": coverage_fund_id,
        "claimsManager": claims_manager_id,
    },
    "results": {
        "premiumReceipt": parse_any(premium_json),
        "rewardClaim": parse_any(claim_json),
        "fundMetricsAfterPremium": parse_any(metrics_after_premium_json),
        "premiumsPaidByVault": parse_any(premiums_paid_by_vault),
        "holderReserveAfterClaim": parse_any(holder_reserve_after_claim),
        "holderBootstrapAfterClaim": parse_any(holder_boot_after_claim),
    },
}

claims_validation = {
    "validatedAt": "2026-03-28",
    "network": "testnet",
    "rpcUrl": rpc_url,
    "identities": coverage_validation["identities"],
    "contracts": coverage_validation["contracts"],
    "results": {
        "rejectedIncidentId": parse_any(rejected_incident_id),
        "rejectedIncident": parse_any(rejected_incident_json),
        "approvedIncidentId": parse_any(live_incident_id),
        "approvedPlan": parse_any(approved_plan_json),
        "executedIncident": parse_any(executed_incident_json),
        "fundMetricsAfterExecution": parse_any(metrics_after_execution_json),
        "managerVaultBalanceFinal": parse_any(vault_balance_final),
        "fundClaimCapacityFinal": parse_any(fund_claim_capacity_final),
        "holderReserveFinal": parse_any(holder_reserve_final),
        "treasuryReserveFinal": parse_any(treasury_reserve_final),
        "holderBootstrapFinal": parse_any(holder_boot_final),
    },
}

combined = {
    "coverageEconomics": coverage_validation,
    "claimsCircuit": claims_validation,
}

with open(out_path, "w", encoding="utf-8") as fh:
    json.dump(combined, fh, indent=2)
    fh.write("\n")

with open(deploy_path, "r", encoding="utf-8") as fh:
    deploy = json.load(fh)

deploy.setdefault("validations", {})
deploy["validations"]["coverageEconomics"] = coverage_validation
deploy["validations"]["claimsCircuit"] = claims_validation

with open(deploy_path, "w", encoding="utf-8") as fh:
    json.dump(deploy, fh, indent=2)
    fh.write("\n")
PY

echo "✅ Coverage economics + claims live validation complete"
echo "   report: $OUT_JSON"
