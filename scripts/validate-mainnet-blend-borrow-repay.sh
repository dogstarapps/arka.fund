#!/usr/bin/env bash
set -euo pipefail

# Runs a contained Mainnet credit canary against the verified Fixed XLM-USDC
# Blend pool. It deploys fresh Arka and adapter instances and never changes the
# factory, existing Arkas, or the adapter used by the live supply/withdraw flow.
#
# The canary is funded through a one-time account with a fixed 30 XLM budget.
# The bootstrap administrator only creates and later merges that account; it is
# never used as the source for canary deployments or credit operations.

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
MANIFEST="${MANIFEST:-$ROOT_DIR/deployments.mainnet.json}"
CONFIRM_VALUE="run-mainnet-blend-borrow-repay-canary"
DEPLOY_CONFIRM_VALUE="deploy-fresh-mainnet-blend-canary"

if [[ "${CONFIRM_MAINNET_BLEND_BORROW_CANARY:-}" != "$CONFIRM_VALUE" ]]; then
  echo "Refusing Mainnet credit canary. Set CONFIRM_MAINNET_BLEND_BORROW_CANARY=$CONFIRM_VALUE to continue." >&2
  exit 1
fi

if [[ "${ALLOW_FRESH_MAINNET_BLEND_CANARY_DEPLOYMENT:-}" != "$DEPLOY_CONFIRM_VALUE" ]]; then
  cat >&2 <<EOF
Refusing to deploy fresh Mainnet canary contracts.

Fresh Soroban instances can incur storage rent that the transaction simulator
does not quote completely. Run scripts/estimate-mainnet-contract-deploy.sh for
the available simulation data, then explicitly set:
  ALLOW_FRESH_MAINNET_BLEND_CANARY_DEPLOYMENT=$DEPLOY_CONFIRM_VALUE
only after approving a bounded Mainnet spend.
EOF
  exit 1
fi

SECRET_ENV="$(jq -r '.admin.secretEnvVar' "$MANIFEST")"
ADMIN_SECRET="${!SECRET_ENV:-}"
if [[ -z "$ADMIN_SECRET" && -f "$HOME/.zshrc" ]]; then
  ADMIN_SECRET="$(SECRET_ENV="$SECRET_ENV" zsh -lc 'source "$HOME/.zshrc" >/dev/null 2>&1 || true; eval "printf %s \"\${$SECRET_ENV:-}\""' 2>/dev/null || true)"
fi
if [[ -z "$ADMIN_SECRET" ]]; then
  echo "Missing Mainnet admin secret in $SECRET_ENV." >&2
  exit 1
fi

RPC_URL="$(jq -r '.rpcUrl' "$MANIFEST")"
NETWORK_PASSPHRASE="$(jq -r '.networkPassphrase' "$MANIFEST")"
ADMIN="$(jq -r '.admin.publicKey' "$MANIFEST")"
VENUE_REGISTRY="$(jq -r '.contracts.venueRegistry' "$MANIFEST")"
XLM="$(jq -r '.assets.contractIds.XLM' "$MANIFEST")"
USDC="$(jq -r '.assets.contractIds.USDC' "$MANIFEST")"

# The candidate is verified by scripts/mainnet_blend_v2_borrow_readiness.py.
POOL_FACTORY="${BLEND_POOL_FACTORY:-CDSYOAVXFY7SM5S64IZPPPYB4GVGGLMQVFREPSQQEZVIWXX5R23G4QSU}"
POOL="${BLEND_POOL:-CAJJZSGMMM3PD7N33TAPHGBUGTB43OC73HVIK2L2G6BNGGGYOSSYBXBD}"
MARKET_ID="${BLEND_CANARY_MARKET_ID:-1}"
# The Fixed XLM-USDC pool requires at least 5 oracle-base units of collateral
# to open a debt position. Ten XLM keeps this isolated canary above that floor.
DEPOSIT_AMOUNT="${BLEND_CANARY_DEPOSIT_AMOUNT:-100000000}"
BORROW_AMOUNT="${BLEND_CANARY_BORROW_AMOUNT:-1000000}"
MAX_BORROW_PER_ACTION="${BLEND_CANARY_MAX_BORROW_PER_ACTION:-2000000}"
MAX_DEBT_FOR_ASSET="${BLEND_CANARY_MAX_DEBT_FOR_ASSET:-2000000}"
MAX_ORACLE_AGE="${BLEND_CANARY_MAX_ORACLE_AGE:-900}"
MIN_HEALTH_FACTOR="${BLEND_CANARY_MIN_HEALTH_FACTOR:-12500000}"
# Mainnet inclusion fees fluctuate with ledger demand. This is intentionally
# above the current p99 fee and remains bounded per canary transaction.
INCLUSION_FEE="${BLEND_CANARY_INCLUSION_FEE:-500000}"
# The post-action Blend reads add deterministic instruction cost. Reserve
# bounded headroom so a valid canary is not rejected at the transport layer.
INSTRUCTION_LEEWAY="${BLEND_CANARY_INSTRUCTION_LEEWAY:-10000000}"
# The temporary account is a hard spend boundary for a single canary. Ten XLM
# is used as collateral and the remainder covers fresh-instance rent and fees.
CANARY_BUDGET_STROOPS="${BLEND_CANARY_BUDGET_STROOPS:-300000000}"
MIN_ADMIN_RESERVE_STROOPS="${BLEND_CANARY_MIN_ADMIN_RESERVE_STROOPS:-1000000000}"
RUN_ID="$(date -u +%Y%m%dT%H%M%SZ)"
WORK_DIR="${BLEND_CANARY_WORK_DIR:-$ROOT_DIR/tmp/mainnet-blend-borrow-canary-$RUN_ID}"
ARTIFACT_DIR="$WORK_DIR/artifacts"
EVIDENCE_FILE="${BLEND_CANARY_EVIDENCE_FILE:-$ROOT_DIR/deployments/evidence/mainnet-blend-borrow-repay-canary-$RUN_ID.json}"
STATE_FILE="$WORK_DIR/state.json"
CANARY_KEY_DIR="$WORK_DIR/canary-key"
CANARY_IDENTITY="${BLEND_CANARY_IDENTITY:-blend-borrow-$RUN_ID}"
REUSE_FUNDED_CANARY="${BLEND_CANARY_REUSE_FUNDED_ACCOUNT:-false}"

mkdir -p "$WORK_DIR" "$ARTIFACT_DIR" "$(dirname "$EVIDENCE_FILE")"

ADAPTER_ID=""
ARKA_ID=""
CANARY_FUNDED=0
CANARY_ACCOUNT_FUNDED=0
CYCLE_SUPPLIED=0
CYCLE_BORROWED=0
CANARY_TRANSPORT="${BLEND_CANARY_TRANSPORT:-stellar-cli}"
CANARY_SECRET=""
CANARY_ADDRESS=""

read_scalar() {
  invoke_read "$@" 2>/dev/null | tail -n 1 | tr -d '"'
}

native_balance_stroops() {
  local account="$1"
  curl -fsS "https://horizon.stellar.org/accounts/$account" \
    | jq -r '.balances[] | select(.asset_type == "native") | .balance' \
    | awk -F. '{ fraction = $2 "0000000"; print ($1 * 10000000) + substr(fraction, 1, 7) }'
}

account_exists() {
  local account="$1" status
  status="$(curl -sS -o /dev/null -w '%{http_code}' "https://horizon.stellar.org/accounts/$account")"
  [[ "$status" == "200" ]]
}

assert_canary_budget() {
  local balance required shortfall
  balance="$(native_balance_stroops "$ADMIN")"
  if [[ ! "$balance" =~ ^[0-9]+$ ]]; then
    echo "Unable to determine the administrator's native XLM balance." >&2
    exit 1
  fi
  required="$MIN_ADMIN_RESERVE_STROOPS"
  if [[ "$REUSE_FUNDED_CANARY" != "true" ]]; then
    required="$((required + CANARY_BUDGET_STROOPS))"
  fi
  if (( CANARY_BUDGET_STROOPS < DEPOSIT_AMOUNT )); then
    echo "Canary budget must cover the isolated collateral amount." >&2
    exit 1
  fi
  if (( balance < required )); then
    shortfall="$((required - balance))"
    printf 'Insufficient administrator balance for an isolated canary. Need %.7f XLM to retain a %.7f XLM reserve and fund a bounded %.7f XLM canary; top up at least %.7f XLM before retrying.\n' \
      "$(awk -v amount="$required" 'BEGIN { print amount / 10000000 }')" \
      "$(awk -v amount="$MIN_ADMIN_RESERVE_STROOPS" 'BEGIN { print amount / 10000000 }')" \
      "$(awk -v amount="$CANARY_BUDGET_STROOPS" 'BEGIN { print amount / 10000000 }')" \
      "$(awk -v amount="$shortfall" 'BEGIN { print amount / 10000000 }')" >&2
    exit 1
  fi
}

create_canary_account() {
  mkdir -p "$CANARY_KEY_DIR"
  chmod 700 "$CANARY_KEY_DIR"
  if [[ "$REUSE_FUNDED_CANARY" == "true" ]]; then
    CANARY_SECRET="$(stellar -q --config-dir "$CANARY_KEY_DIR" keys secret "$CANARY_IDENTITY")"
    CANARY_ADDRESS="$(stellar -q --config-dir "$CANARY_KEY_DIR" keys public-key "$CANARY_IDENTITY")"
    CANARY_ACCOUNT_FUNDED=1
  else
    # Store the identity before the account is funded. The secret is then
    # recoverable only from this 0700 local directory during cleanup.
    stellar -q --config-dir "$CANARY_KEY_DIR" keys generate "$CANARY_IDENTITY" >/dev/null
    CANARY_SECRET="$(stellar -q --config-dir "$CANARY_KEY_DIR" keys secret "$CANARY_IDENTITY")"
    CANARY_ADDRESS="$(stellar -q --config-dir "$CANARY_KEY_DIR" keys public-key "$CANARY_IDENTITY")"
  fi
  [[ "$CANARY_SECRET" =~ ^S && "$CANARY_ADDRESS" =~ ^G ]] || {
    echo "Unable to generate an isolated Blend canary identity." >&2
    exit 1
  }

  if [[ "$REUSE_FUNDED_CANARY" != "true" ]]; then
    stellar -q tx new create-account \
      --source-account "$ADMIN_SECRET" \
      --destination "$CANARY_ADDRESS" \
      --starting-balance "$CANARY_BUDGET_STROOPS" \
      --inclusion-fee "$INCLUSION_FEE" \
      --rpc-url "$RPC_URL" \
      --network-passphrase "$NETWORK_PASSPHRASE" >/dev/null
    CANARY_ACCOUNT_FUNDED=1
  fi

  local balance
  balance="$(native_balance_stroops "$CANARY_ADDRESS")"
  [[ "$balance" =~ ^[0-9]+$ && "$balance" -ge "$CANARY_BUDGET_STROOPS" ]] || {
    echo "The isolated canary account was not funded with its fixed budget." >&2
    exit 1
  }
}

close_canary_account() {
  [[ "$CANARY_ACCOUNT_FUNDED" -eq 1 && -n "$CANARY_SECRET" ]] || return 0
  stellar -q tx new account-merge \
    --source-account "$CANARY_SECRET" \
    --account "$ADMIN" \
    --inclusion-fee "$INCLUSION_FEE" \
    --rpc-url "$RPC_URL" \
    --network-passphrase "$NETWORK_PASSPHRASE" >/dev/null
  if account_exists "$CANARY_ADDRESS"; then
    echo "Canary account merge was not finalized; retaining its recovery key." >&2
    return 1
  fi
  CANARY_ACCOUNT_FUNDED=0
  rm -rf "$CANARY_KEY_DIR"
}

redeem_canary_capital() {
  local shares positions liquid top_up current_ledger approval_expiration
  shares="$(read_scalar "$ARKA_ID" shares_of --user "$CANARY_ADDRESS")"
  if [[ "$shares" == '0' || -z "$shares" ]]; then
    CANARY_FUNDED=0
    return 0
  fi

  if invoke_send "$ARKA_ID" redeem --user "$CANARY_ADDRESS" --shares "$shares" >/dev/null; then
    CANARY_FUNDED=0
    return 0
  fi

  # Blend share conversion can round a full withdrawal down by one stroop. Only
  # top up when the credit position is already empty; never mask a live debt or
  # collateral position with additional canary capital.
  positions="$(read_scalar "$ARKA_ID" credit_position_values --protocol Blend --market_id "$MARKET_ID")"
  liquid="$(read_scalar "$ARKA_ID" liquid_balance --asset "$XLM")"
  if [[ "$positions" != '[]' || ! "$shares" =~ ^[0-9]+$ || ! "$liquid" =~ ^[0-9]+$ || "$liquid" -ge "$shares" ]]; then
    return 1
  fi

  top_up="$((shares - liquid))"
  current_ledger="$(curl -fsS "$RPC_URL" -H 'content-type: application/json' --data '{"jsonrpc":"2.0","id":1,"method":"getLatestLedger"}' | jq -r '.result.sequence')"
  approval_expiration="$((current_ledger + 1000))"
  invoke_send "$XLM" approve --from "$CANARY_ADDRESS" --spender "$ARKA_ID" --amount "$top_up" --expiration_ledger "$approval_expiration" >/dev/null
  invoke_send "$ARKA_ID" deposit --user "$CANARY_ADDRESS" --asset "{\"contract\":\"$XLM\"}" --amount "$top_up" >/dev/null
  shares="$(read_scalar "$ARKA_ID" shares_of --user "$CANARY_ADDRESS")"
  invoke_send "$ARKA_ID" redeem --user "$CANARY_ADDRESS" --shares "$shares" >/dev/null
  CANARY_FUNDED=0
}

cleanup_failed_canary() {
  local exit_code="${1:-$?}"
  trap - ERR EXIT
  [[ "$exit_code" -ne 0 ]] || exit 0

  set +e
  if [[ "$CANARY_FUNDED" -eq 1 && -n "$ARKA_ID" ]]; then
    cleanup_credit_cycle
    local shares
    shares="$(read_scalar "$ARKA_ID" shares_of --user "$CANARY_ADDRESS")"
    if [[ "$shares" != '"0"' && "$shares" != '0' && -n "$shares" ]]; then
      echo "Canary failed; attempting to return its deposited capital." >&2
      if ! redeem_canary_capital; then
        echo "Automatic redemption failed. The isolated venue remains enabled so repayment can still be executed." >&2
      fi
    else
      CANARY_FUNDED=0
    fi
  fi

  if [[ -n "$ADAPTER_ID" && "$CANARY_FUNDED" -eq 0 ]]; then
    invoke_admin_send "$VENUE_REGISTRY" disable_venue --caller "$ADMIN" --venue "$ADAPTER_ID" >/dev/null || true
  fi
  if [[ "$CANARY_FUNDED" -eq 0 ]]; then
    close_canary_account || true
  fi
  exit "$exit_code"
}

# ERR traps are not inherited consistently through shell functions and command
# substitutions. EXIT is: every non-zero termination therefore attempts the
# isolated position cleanup before returning the original failure status.
trap 'exit_code=$?; if [[ "$exit_code" -ne 0 ]]; then cleanup_failed_canary "$exit_code"; fi' EXIT

invoke_send_as() {
  local source_account="$1"
  local contract_id="$2"
  shift 2
  stellar contract invoke \
    --id "$contract_id" \
    --source-account "$source_account" \
    --rpc-url "$RPC_URL" \
    --network-passphrase "$NETWORK_PASSPHRASE" \
    --inclusion-fee "$INCLUSION_FEE" \
    --instruction-leeway "$INSTRUCTION_LEEWAY" \
    --send=yes \
    -- "$@"
}

invoke_send() {
  local contract_id="$1"
  shift
  invoke_send_as "$CANARY_SECRET" "$contract_id" "$@"
}

invoke_admin_send() {
  local contract_id="$1"
  shift
  invoke_send_as "$ADMIN_SECRET" "$contract_id" "$@"
}

invoke_read() {
  local contract_id="$1"
  shift
  stellar contract invoke \
    --id "$contract_id" \
    --source-account "$ADMIN" \
    --rpc-url "$RPC_URL" \
    --network-passphrase "$NETWORK_PASSPHRASE" \
    -- "$@"
}

cleanup_credit_cycle() {
  # A failed canary must never leave collateral or debt in its isolated Arka.
  # redeem_canary_capital independently refuses to add capital when a position
  # is still open, so this cleanup cannot conceal an outstanding debt.
  if [[ "$CYCLE_BORROWED" -eq 1 ]]; then
    invoke_send "$ARKA_ID" credit_repay \
      --manager "$CANARY_ADDRESS" --protocol Blend --market_id "$MARKET_ID" \
      --asset "$USDC" --amount "$BORROW_AMOUNT" >/dev/null || true
    CYCLE_BORROWED=0
  fi
  if [[ "$CYCLE_SUPPLIED" -eq 1 ]]; then
    local collateral_amount
    collateral_amount="$(read_scalar "$ARKA_ID" credit_position_values --protocol Blend --market_id "$MARKET_ID" | jq -r --arg asset "$XLM" '.[] | select(.asset == $asset) | .collateral_amount // empty' | head -n 1)"
    if [[ ! "$collateral_amount" =~ ^[0-9]+$ || "$collateral_amount" -eq 0 ]]; then
      collateral_amount="$DEPOSIT_AMOUNT"
    fi
    invoke_send "$ARKA_ID" credit_withdraw \
      --manager "$CANARY_ADDRESS" --protocol Blend --market_id "$MARKET_ID" \
      --asset "$XLM" --amount "$collateral_amount" >/dev/null || true
    CYCLE_SUPPLIED=0
  fi
}

run_cli_credit_cycle() {
  local positions_after_borrow status_after_borrow positions_after_repay
  local positions_after_withdraw market_value_after_withdraw

  invoke_send "$ARKA_ID" set_venue_registry --caller "$CANARY_ADDRESS" --registry "$VENUE_REGISTRY" >/dev/null
  invoke_send "$ARKA_ID" configure_credit_market \
    --caller "$CANARY_ADDRESS" --protocol Blend --market_id "$MARKET_ID" --adapter "$ADAPTER_ID" \
    --allow_supply true --allow_borrow true --allow_repay true --allow_withdraw true --enabled true >/dev/null
  invoke_send "$ARKA_ID" set_blend_risk_policy \
    --caller "$CANARY_ADDRESS" --market_id "$MARKET_ID" --max_oracle_age "$MAX_ORACLE_AGE" \
    --min_health_factor "$MIN_HEALTH_FACTOR" --fail_close_nav true --fail_close_actions true >/dev/null
  invoke_send "$ARKA_ID" set_blend_external_diagnostics \
    --caller "$CANARY_ADDRESS" --market_id "$MARKET_ID" --enabled true >/dev/null
  invoke_send "$ARKA_ID" set_blend_v2_risk_source \
    --caller "$CANARY_ADDRESS" --market_id "$MARKET_ID" --pool_factory "$POOL_FACTORY" >/dev/null
  invoke_send "$ARKA_ID" set_credit_borrow_policy \
    --caller "$CANARY_ADDRESS" --protocol Blend --market_id "$MARKET_ID" --asset "$USDC" \
    --max_borrow_per_action "$MAX_BORROW_PER_ACTION" --max_debt_for_asset "$MAX_DEBT_FOR_ASSET" \
    --enabled true >/dev/null

  invoke_send "$ARKA_ID" credit_supply \
    --manager "$CANARY_ADDRESS" --protocol Blend --market_id "$MARKET_ID" --asset "$XLM" --amount "$DEPOSIT_AMOUNT" >/dev/null
  CYCLE_SUPPLIED=1

  invoke_send "$ARKA_ID" credit_borrow \
    --manager "$CANARY_ADDRESS" --protocol Blend --market_id "$MARKET_ID" --asset "$USDC" --amount "$BORROW_AMOUNT" >/dev/null
  CYCLE_BORROWED=1

  positions_after_borrow="$(invoke_read "$ARKA_ID" credit_position_values --protocol Blend --market_id "$MARKET_ID")"
  status_after_borrow="$(invoke_read "$ARKA_ID" credit_market_status --protocol Blend --market_id "$MARKET_ID")"
  jq -e --arg asset "$USDC" \
    'any(.[]; .asset == $asset and ((.debt_amount | tonumber) > 0))' <<<"$positions_after_borrow" >/dev/null
  jq -e --argjson minimum "$MIN_HEALTH_FACTOR" \
    '((.debt_value | tonumber) > 0) and (.risky_actions_blocked == false) and ((.health_factor | tonumber) >= $minimum)' \
    <<<"$status_after_borrow" >/dev/null

  invoke_send "$ARKA_ID" credit_repay \
    --manager "$CANARY_ADDRESS" --protocol Blend --market_id "$MARKET_ID" --asset "$USDC" --amount "$BORROW_AMOUNT" >/dev/null
  CYCLE_BORROWED=0
  positions_after_repay="$(invoke_read "$ARKA_ID" credit_position_values --protocol Blend --market_id "$MARKET_ID")"
  if jq -e --arg asset "$USDC" \
    'any(.[]; .asset == $asset and ((.debt_amount | tonumber) > 0))' <<<"$positions_after_repay" >/dev/null; then
    echo "Canary repay left an outstanding Blend debt." >&2
    return 1
  fi

  local collateral_amount
  collateral_amount="$(jq -r --arg asset "$XLM" '.[] | select(.asset == $asset) | .collateral_amount // empty' <<<"$positions_after_repay" | head -n 1)"
  [[ "$collateral_amount" =~ ^[0-9]+$ && "$collateral_amount" -gt 0 ]] || {
    echo "Canary repayment did not leave a withdrawable XLM collateral position." >&2
    return 1
  }

  invoke_send "$ARKA_ID" credit_withdraw \
    --manager "$CANARY_ADDRESS" --protocol Blend --market_id "$MARKET_ID" --asset "$XLM" --amount "$collateral_amount" >/dev/null
  CYCLE_SUPPLIED=0
  positions_after_withdraw="$(invoke_read "$ARKA_ID" credit_position_values --protocol Blend --market_id "$MARKET_ID")"
  market_value_after_withdraw="$(invoke_read "$ARKA_ID" credit_market_value --protocol Blend --market_id "$MARKET_ID")"
  [[ "$positions_after_withdraw" == "[]" && "$market_value_after_withdraw" == "null" ]] || {
    echo "Canary withdrawal left an open Blend position." >&2
    return 1
  }

  jq -n \
    --arg positionsAfterBorrow "$positions_after_borrow" \
    --arg statusAfterBorrow "$status_after_borrow" \
    --arg positionsAfterRepay "$positions_after_repay" \
    --arg positionsAfterWithdraw "$positions_after_withdraw" \
    '{transport: "stellar-cli", positionsAfterBorrow: $positionsAfterBorrow, statusAfterBorrow: $statusAfterBorrow, positionsAfterRepay: $positionsAfterRepay, positionsAfterWithdraw: $positionsAfterWithdraw}' \
    > "$WORK_DIR/credit-cycle.json"
}

echo "1/8 Build current Arka and Blend adapter WASM"
stellar contract build --manifest-path "$ROOT_DIR/contracts/Cargo.toml" --package arka --out-dir "$ARTIFACT_DIR" --locked >/dev/null
stellar contract build --manifest-path "$ROOT_DIR/contracts/Cargo.toml" --package adapter-blend --out-dir "$ARTIFACT_DIR" --locked >/dev/null
ARKA_WASM="$ARTIFACT_DIR/arka.wasm"
ADAPTER_WASM="$ARTIFACT_DIR/adapter_blend.wasm"
[[ -f "$ARKA_WASM" && -f "$ADAPTER_WASM" ]] || {
  echo "Expected Arka and adapter artifacts were not built." >&2
  exit 1
}

echo "2/8 Re-run verified pool preflight"
python3 "$ROOT_DIR/scripts/mainnet_blend_v2_borrow_readiness.py" --manifest "$MANIFEST" --report "$WORK_DIR/preflight.json" >/dev/null
assert_canary_budget
create_canary_account

echo "3/8 Deploy isolated canary contracts"
ADAPTER_ID="$(stellar contract deploy --wasm "$ADAPTER_WASM" --source-account "$CANARY_SECRET" --rpc-url "$RPC_URL" --network-passphrase "$NETWORK_PASSPHRASE" --inclusion-fee "$INCLUSION_FEE" --ignore-checks | tail -n 1)"
ARKA_ID="$(stellar contract deploy --wasm "$ARKA_WASM" --source-account "$CANARY_SECRET" --rpc-url "$RPC_URL" --network-passphrase "$NETWORK_PASSPHRASE" --inclusion-fee "$INCLUSION_FEE" --ignore-checks | tail -n 1)"
printf '{"arka":"%s","adapter":"%s"}\n' "$ARKA_ID" "$ADAPTER_ID" > "$STATE_FILE"

echo "4/8 Configure isolated adapter and guarded venue"
invoke_send "$ADAPTER_ID" init --admin "$ADMIN" --router "$POOL" >/dev/null
invoke_admin_send "$VENUE_REGISTRY" set_venue_status --caller "$ADMIN" --venue "$ADAPTER_ID" --status 1 >/dev/null
invoke_send "$ARKA_ID" init \
  --denomination_contract "$XLM" \
  --mgmt_bps 0 \
  --perf_bps 0 \
  --deposit_bps 0 \
  --redeem_bps 0 \
  --whitelist_contracts "[\"$XLM\",\"$USDC\"]" \
  --manager "$CANARY_ADDRESS" >/dev/null

echo "5/8 Fund canary with 10 XLM and no third-party capital"
CURRENT_LEDGER="$(curl -fsS "$RPC_URL" -H 'content-type: application/json' --data '{"jsonrpc":"2.0","id":1,"method":"getLatestLedger"}' | jq -r '.result.sequence')"
APPROVAL_EXPIRATION="$((CURRENT_LEDGER + 10000))"
invoke_send "$XLM" approve --from "$CANARY_ADDRESS" --spender "$ARKA_ID" --amount "$DEPOSIT_AMOUNT" --expiration_ledger "$APPROVAL_EXPIRATION" >/dev/null
invoke_send "$ARKA_ID" deposit --user "$CANARY_ADDRESS" --asset "{\"contract\":\"$XLM\"}" --amount "$DEPOSIT_AMOUNT" >/dev/null
CANARY_FUNDED=1

echo "6/8 Execute supply -> borrow -> repay -> withdraw and verify on-chain state"
if [[ "$CANARY_TRANSPORT" == "stellar-cli" ]]; then
  run_cli_credit_cycle
elif [[ "$CANARY_TRANSPORT" == "generated-sdk" ]]; then
(
  cd "$ROOT_DIR/scripts/js"
  ARKA_CONTRACT_ID="$ARKA_ID" \
  ADMIN_SECRET="$CANARY_SECRET" \
  CALLER_ADDRESS="$CANARY_ADDRESS" \
  ADAPTER_CONTRACT_ID="$ADAPTER_ID" \
  VENUE_REGISTRY="$VENUE_REGISTRY" \
  SUPPLY_ASSET_ID="$XLM" \
  BORROW_ASSET_ID="$USDC" \
  POOL_FACTORY="$POOL_FACTORY" \
  RPC_URL="$RPC_URL" \
  NETWORK_PASSPHRASE="$NETWORK_PASSPHRASE" \
  OUT_JSON="$WORK_DIR/credit-cycle.json" \
  MARKET_ID="$MARKET_ID" \
  SUPPLY_AMOUNT="$DEPOSIT_AMOUNT" \
  BORROW_AMOUNT="$BORROW_AMOUNT" \
  MAX_BORROW_PER_ACTION="$MAX_BORROW_PER_ACTION" \
  MAX_DEBT_FOR_ASSET="$MAX_DEBT_FOR_ASSET" \
  MAX_ORACLE_AGE="$MAX_ORACLE_AGE" \
  MIN_HEALTH_FACTOR="$MIN_HEALTH_FACTOR" \
  INCLUSION_FEE="$INCLUSION_FEE" \
  FEE_BUMP_ENABLED="${BLEND_CANARY_FEE_BUMP_ENABLED:-true}" \
  TS_NODE_TRANSPILE_ONLY=1 \
  TS_NODE_COMPILER_OPTIONS='{"module":"nodenext","moduleResolution":"nodenext","allowImportingTsExtensions":true}' \
    node --loader ts-node/esm runMainnetBlendBorrowRepayCanary.ts >/dev/null
)
else
  echo "Unknown BLEND_CANARY_TRANSPORT: $CANARY_TRANSPORT" >&2
  exit 1
fi

echo "7/8 Verify guardian kill-switch and restore isolated venue to disabled"
invoke_admin_send "$VENUE_REGISTRY" disable_venue --caller "$ADMIN" --venue "$ADAPTER_ID" >/dev/null
set +e
KILL_SWITCH_OUTPUT="$(invoke_read "$ARKA_ID" credit_borrow --manager "$CANARY_ADDRESS" --protocol Blend --market_id "$MARKET_ID" --asset "$USDC" --amount 1 2>&1)"
KILL_SWITCH_STATUS=$?
set -e
if [[ "$KILL_SWITCH_STATUS" -eq 0 ]] || ! grep -q 'Error(Contract, #24)' <<<"$KILL_SWITCH_OUTPUT"; then
  echo "The disabled venue did not reject borrowing with SwapVenueNotAllowed." >&2
  exit 1
fi

echo "8/8 Redeem canary capital and write evidence"
redeem_canary_capital
close_canary_account
FINAL_POSITIONS="$(invoke_read "$ARKA_ID" credit_position_values --protocol Blend --market_id "$MARKET_ID" | tail -n 1)"
FINAL_BALANCE="$(invoke_read "$ARKA_ID" liquid_balance --asset "$XLM" | tail -n 1)"
if [[ "$FINAL_POSITIONS" != "[]" ]] || [[ "$FINAL_BALANCE" != '"0"' && "$FINAL_BALANCE" != '0' ]]; then
  echo "Canary cleanup failed: positions=$FINAL_POSITIONS balance=$FINAL_BALANCE" >&2
  exit 1
fi

jq \
  --arg arka "$ARKA_ID" \
  --arg adapter "$ADAPTER_ID" \
  --arg canaryAccount "$CANARY_ADDRESS" \
  --arg pool "$POOL" \
  --arg factory "$POOL_FACTORY" \
  --arg venueRegistry "$VENUE_REGISTRY" \
  --argjson marketId "$MARKET_ID" \
  --argjson depositAmount "$DEPOSIT_AMOUNT" \
  --argjson borrowAmount "$BORROW_AMOUNT" \
  --arg finalPositions "$FINAL_POSITIONS" \
  --arg finalBalance "$FINAL_BALANCE" \
  --arg killSwitchError "$KILL_SWITCH_OUTPUT" \
  '. + {
    kind: "mainnet_blend_borrow_repay_canary",
    network: "mainnet",
    status: "passed",
    arka: $arka,
    adapter: $adapter,
    canaryAccount: $canaryAccount,
    pool: $pool,
    poolFactory: $factory,
    venueRegistry: $venueRegistry,
    marketId: $marketId,
    depositAmount: $depositAmount,
    borrowAmount: $borrowAmount,
    killSwitch: { status: "passed", adapterFinalStatus: "disabled", blockedError: $killSwitchError },
    cleanup: { positions: $finalPositions, xlmLiquidBalance: $finalBalance, capitalRedeemed: true }
  }' "$WORK_DIR/credit-cycle.json" > "$EVIDENCE_FILE"

echo "Passed: $EVIDENCE_FILE"
