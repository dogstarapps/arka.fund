#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
DEPLOY_JSON="${DEPLOY_JSON:-$ROOT_DIR/deployments.testnet.json}"
OUT_JSON="${OUT_JSON:-$ROOT_DIR/tmp/indexer-event-surface-live-validation.json}"
VALIDATION_ATTEMPTS="${VALIDATION_ATTEMPTS:-30}"
VALIDATION_DELAY_SECONDS="${VALIDATION_DELAY_SECONDS:-2}"
NETWORK_PASSPHRASE="${VALIDATION_NETWORK_PASSPHRASE:-Test SDF Network ; September 2015}"
RPC_URL="${VALIDATION_RPC_URL:-https://soroban-testnet.stellar.org}"
ADMIN_IDENTITY="${ADMIN_IDENTITY:-arka-admin}"
REGISTRAR_IDENTITY="${REGISTRAR_IDENTITY:-arka-holder}"
TREASURY_IDENTITY="${TREASURY_IDENTITY:?Set TREASURY_IDENTITY to a Stellar CLI identity}"

ARKA_WASM_PATH="${ARKA_WASM_PATH:-$ROOT_DIR/artifacts/arka.wasm}"
REGISTRY_WASM_PATH="${REGISTRY_WASM_PATH:-$ROOT_DIR/artifacts/arka-registry.wasm}"
TOKEN_WASM_PATH="${TOKEN_WASM_PATH:-$ROOT_DIR/artifacts/test-token.wasm}"
JS_DIR="$ROOT_DIR/scripts/js"

mkdir -p "$(dirname "$OUT_JSON")"

for path in "$ARKA_WASM_PATH" "$REGISTRY_WASM_PATH" "$TOKEN_WASM_PATH" "$JS_DIR/validateIndexerEventSurface.ts" "$JS_DIR/configureCreditMarket.ts"; do
  if [[ ! -f "$path" ]]; then
    echo "ERROR: missing dependency: $path" >&2
    exit 1
  fi
done

if ! command -v jq >/dev/null 2>&1; then
  echo "ERROR: jq is required" >&2
  exit 1
fi

deploy_contract() {
  local wasm_path="$1"
  stellar contract deploy \
    --wasm "$wasm_path" \
    --source-account "$ADMIN_IDENTITY" \
    --rpc-url "$RPC_URL" \
    --network-passphrase "$NETWORK_PASSPHRASE" \
    --ignore-checks | tail -n1
}

invoke_send_as() {
  local source_identity="$1"
  shift
  local contract_id="$1"
  shift
  stellar contract invoke \
    --id "$contract_id" \
    --source-account "$source_identity" \
    --rpc-url "$RPC_URL" \
    --network-passphrase "$NETWORK_PASSPHRASE" \
    --send=yes -- "$@" >/dev/null
}

latest_ledger() {
  curl -fsS -X POST "$RPC_URL" \
    -H 'content-type: application/json' \
    -d '{"jsonrpc":"2.0","id":1,"method":"getLatestLedger"}' \
    | python3 -c 'import json,sys; print(int(json.load(sys.stdin)["result"]["sequence"]))'
}

if [[ ! -f "$ARKA_WASM_PATH" || ! -f "$REGISTRY_WASM_PATH" || ! -f "$TOKEN_WASM_PATH" ]]; then
  bash "$ROOT_DIR/scripts/build-wasm.sh" >/dev/null
fi

ADMIN_ADDR="$(stellar keys address "$ADMIN_IDENTITY")"
REGISTRAR_ADDR="$(stellar keys address "$REGISTRAR_IDENTITY")"
TREASURY_ADDR="$(stellar keys address "$TREASURY_IDENTITY")"
ADMIN_SECRET="$(stellar keys secret "$ADMIN_IDENTITY")"

echo "1) Deploy isolated event-surface validation stack"
REGISTRY_ID="$(deploy_contract "$REGISTRY_WASM_PATH")"
ARKA_ID="$(deploy_contract "$ARKA_WASM_PATH")"
TOKEN_A_ID="$(deploy_contract "$TOKEN_WASM_PATH")"
TOKEN_B_ID="$(deploy_contract "$TOKEN_WASM_PATH")"
echo "   REGISTRY_ID=$REGISTRY_ID"
echo "   ARKA_ID=$ARKA_ID"
echo "   TOKEN_A_ID=$TOKEN_A_ID"
echo "   TOKEN_B_ID=$TOKEN_B_ID"

START_LEDGER="$(( $(latest_ledger) + 1 ))"
WHITELIST_INIT="$(jq -cn --arg token "$TOKEN_A_ID" '[$token]')"
WHITELIST_UPDATED="$(jq -cn --arg token_a "$TOKEN_A_ID" --arg token_b "$TOKEN_B_ID" '[$token_a, $token_b]')"

echo "2) Emit registry discovery events"
invoke_send_as "$ADMIN_IDENTITY" "$REGISTRY_ID" init_admin --admin "$ADMIN_ADDR"
invoke_send_as "$ADMIN_IDENTITY" "$REGISTRY_ID" set_registrar --caller "$ADMIN_ADDR" --registrar "$REGISTRAR_ADDR" --allowed true
invoke_send_as "$REGISTRAR_IDENTITY" "$REGISTRY_ID" register --caller "$REGISTRAR_ADDR" --manager "$ADMIN_ADDR" --arka "$ARKA_ID"
invoke_send_as "$ADMIN_IDENTITY" "$REGISTRY_ID" set_manager_curated --caller "$ADMIN_ADDR" --manager "$ADMIN_ADDR" --curated true
invoke_send_as "$ADMIN_IDENTITY" "$REGISTRY_ID" set_delisted --caller "$ADMIN_ADDR" --arka "$ARKA_ID" --delisted true

echo "3) Emit arka configuration events"
invoke_send_as "$ADMIN_IDENTITY" "$ARKA_ID" init \
  --denomination_contract "$TOKEN_A_ID" \
  --mgmt_bps 100 \
  --perf_bps 200 \
  --deposit_bps 25 \
  --redeem_bps 30 \
  --whitelist_contracts "$WHITELIST_INIT" \
  --manager "$ADMIN_ADDR"
invoke_send_as "$ADMIN_IDENTITY" "$ARKA_ID" set_governor --caller "$ADMIN_ADDR" --governor "$ADMIN_ADDR"
invoke_send_as "$ADMIN_IDENTITY" "$ARKA_ID" set_fees --caller "$ADMIN_ADDR" --mgmt_bps 125 --perf_bps 225 --deposit_bps 35 --redeem_bps 45
invoke_send_as "$ADMIN_IDENTITY" "$ARKA_ID" set_protocol_fee_policy --caller "$ADMIN_ADDR" --treasury "$TREASURY_ADDR" --mgmt_protocol_bps 1500 --perf_protocol_bps 2500
invoke_send_as "$ADMIN_IDENTITY" "$ARKA_ID" set_whitelist --caller "$ADMIN_ADDR" --whitelist_contracts "$WHITELIST_UPDATED"
invoke_send_as "$ADMIN_IDENTITY" "$ARKA_ID" set_manager --caller "$ADMIN_ADDR" --manager "$REGISTRAR_ADDR"
invoke_send_as "$ADMIN_IDENTITY" "$ARKA_ID" set_router --caller "$ADMIN_ADDR" --router "$TOKEN_B_ID"
invoke_send_as "$ADMIN_IDENTITY" "$ARKA_ID" set_share_token --caller "$ADMIN_ADDR" --share_token "$TOKEN_A_ID"
invoke_send_as "$ADMIN_IDENTITY" "$ARKA_ID" set_blend_risk_policy --caller "$ADMIN_ADDR" --market_id 7 --max_oracle_age 600 --min_health_factor 1250000 --fail_close_nav true --fail_close_actions false
(
  cd "$JS_DIR"
  ARKA_CONTRACT_ID="$ARKA_ID" \
  ADMIN_SECRET="$ADMIN_SECRET" \
  CALLER_ADDRESS="$ADMIN_ADDR" \
  ADAPTER_CONTRACT_ID="$TOKEN_B_ID" \
  RPC_URL="$RPC_URL" \
  NETWORK_PASSPHRASE="$NETWORK_PASSPHRASE" \
  CREDIT_PROTOCOL="Blend" \
  MARKET_ID="7" \
  ALLOW_SUPPLY="true" \
  ALLOW_BORROW="false" \
  ALLOW_REPAY="true" \
  ALLOW_WITHDRAW="false" \
  ENABLED="true" \
  TS_NODE_TRANSPILE_ONLY=1 \
  TS_NODE_COMPILER_OPTIONS='{"module":"nodenext","moduleResolution":"nodenext","allowImportingTsExtensions":true}' \
    node --loader ts-node/esm configureCreditMarket.ts >/dev/null
)

echo "4) Read and validate the event surface through testnet RPC"
cd "$JS_DIR"
EVENT_SURFACE_INPUT_JSON="$(jq -cn \
  --arg rpcUrl "$RPC_URL" \
  --argjson startLedger "$START_LEDGER" \
  --arg registryId "$REGISTRY_ID" \
  --arg arkaId "$ARKA_ID" \
  --arg admin "$ADMIN_ADDR" \
  --arg registrar "$REGISTRAR_ADDR" \
  --arg manager "$ADMIN_ADDR" \
  --arg rotatedManager "$REGISTRAR_ADDR" \
  --arg treasury "$TREASURY_ADDR" \
  --arg denominationToken "$TOKEN_A_ID" \
  --arg secondaryToken "$TOKEN_B_ID" \
  '{rpcUrl:$rpcUrl,startLedger:$startLedger,registryId:$registryId,arkaId:$arkaId,admin:$admin,registrar:$registrar,manager:$manager,rotatedManager:$rotatedManager,treasury:$treasury,denominationToken:$denominationToken,secondaryToken:$secondaryToken}'
)"
VALIDATION_STDERR="$(mktemp)"
validation_ok=0
for ((attempt=1; attempt<=VALIDATION_ATTEMPTS; attempt+=1)); do
  if EVENT_SURFACE_INPUT_JSON="$EVENT_SURFACE_INPUT_JSON" \
    TS_NODE_TRANSPILE_ONLY=1 \
    TS_NODE_COMPILER_OPTIONS='{"module":"nodenext","moduleResolution":"nodenext","allowImportingTsExtensions":true}' \
      node --loader ts-node/esm validateIndexerEventSurface.ts >"$OUT_JSON" 2>"$VALIDATION_STDERR"; then
    validation_ok=1
    break
  fi
  if (( attempt < VALIDATION_ATTEMPTS )); then
    sleep "$VALIDATION_DELAY_SECONDS"
  fi
done

if (( validation_ok != 1 )); then
  cat "$VALIDATION_STDERR" >&2
  rm -f "$VALIDATION_STDERR"
  exit 1
fi
rm -f "$VALIDATION_STDERR"

python3 - <<'PY' "$DEPLOY_JSON" "$OUT_JSON" "$REGISTRY_ID" "$ARKA_ID"
import json
import sys

deploy_path, report_path, registry_id, arka_id = sys.argv[1:5]
with open(deploy_path, "r", encoding="utf-8") as fh:
    deployments = json.load(fh)
with open(report_path, "r", encoding="utf-8") as fh:
    report = json.load(fh)
validations = deployments.setdefault("validations", {})
validations["indexerEventSurface"] = {
    "status": "passed",
    "validatedAt": report["validatedAt"],
    "registryId": registry_id,
    "arkaId": arka_id,
    "report": report_path,
}
with open(deploy_path, "w", encoding="utf-8") as fh:
    json.dump(deployments, fh, indent=2)
    fh.write("\n")
PY

echo "Indexer event surface validation written to $OUT_JSON"
