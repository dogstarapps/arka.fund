#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
DEPLOY_JSON="${DEPLOY_JSON:-$ROOT_DIR/deployments.testnet.json}"
NETWORK_PASSPHRASE="${NETWORK_PASSPHRASE:-Test SDF Network ; September 2015}"
RPC_URL="${RPC_URL:-https://soroban-testnet.stellar.org}"
TS_NODE_TRANSPILE_ONLY="${TS_NODE_TRANSPILE_ONLY:-1}"
TS_NODE_COMPILER_OPTIONS="${TS_NODE_COMPILER_OPTIONS:-{\"module\":\"nodenext\",\"moduleResolution\":\"nodenext\",\"allowImportingTsExtensions\":true}}"
ADMIN_SECRET="${ADMIN_SECRET:-}"
ADMIN_ADDRESS="${ADMIN_ADDRESS:-}"
GOV_ID="${GOV_ID:-$(jq -r '.contracts.governor // empty' "$DEPLOY_JSON")}"
FACTORY_ID="${FACTORY_ID:-$(jq -r '.contracts.arkaFactory // empty' "$DEPLOY_JSON")}"
OLD_ARKA="${OLD_ARKA:-$(jq -r '.txs.arkaMigration.old_arka // .contracts.arka // empty' "$DEPLOY_JSON")}"
DENOM="${DENOM:-$(jq -r '.tokens.ARKA1 // empty' "$DEPLOY_JSON")}"
ROUTER="${ROUTER:-$(jq -r '.contracts.router // empty' "$DEPLOY_JSON")}"
ARKA_WASM_PATH="${ARKA_WASM_PATH:-$ROOT_DIR/artifacts/arka.wasm}"
SHARE_TOKEN_WASM_PATH="${SHARE_TOKEN_WASM_PATH:-$ROOT_DIR/artifacts/test-token.wasm}"
WHITELIST="${WHITELIST:-$DENOM}"

if [[ -z "$ADMIN_SECRET" || -z "$ADMIN_ADDRESS" ]]; then
  echo "ERROR: ADMIN_SECRET and ADMIN_ADDRESS are required." >&2
  exit 1
fi

if [[ -z "$GOV_ID" || -z "$FACTORY_ID" || -z "$OLD_ARKA" || -z "$DENOM" || -z "$ROUTER" ]]; then
  echo "ERROR: missing required IDs (governor/factory/old_arka/denom/router)." >&2
  exit 1
fi

get_latest_ledger() {
  curl -s -X POST "$RPC_URL" \
    -H 'content-type: application/json' \
    -d '{"jsonrpc":"2.0","id":1,"method":"getLatestLedger"}' \
    | python3 -c 'import sys,json; print(json.load(sys.stdin).get("result",{}).get("sequence",0))'
}

get_proposal_json() {
  local pid="$1"
  stellar contract invoke \
    --id "$GOV_ID" \
    --source-account "$ADMIN_SECRET" \
    --rpc-url "$RPC_URL" \
    --network-passphrase "$NETWORK_PASSPHRASE" \
    -- get_proposal --proposal_id "$pid" 2>/dev/null | tail -n1
}

wait_and_close() {
  local pid="$1"
  local pjson="$2"
  local vote_end
  vote_end=$(python3 - "$pjson" <<'PY'
import json,sys
j=json.loads(sys.argv[1])
print(j["data"]["vote_end"])
PY
)
  local latest
  latest="$(get_latest_ledger)"
  while [[ "$latest" -le "$vote_end" ]]; do
    echo "  latest=$latest <= vote_end=$vote_end; sleeping 5s"
    sleep 5
    latest="$(get_latest_ledger)"
  done
  stellar contract invoke \
    --id "$GOV_ID" \
    --source-account "$ADMIN_SECRET" \
    --rpc-url "$RPC_URL" \
    --network-passphrase "$NETWORK_PASSPHRASE" \
    --send=yes -- close --proposal_id "$pid" >/dev/null
}

wait_and_execute() {
  local pid="$1"
  local pjson="$2"
  local eta
  eta=$(python3 - "$pjson" <<'PY'
import json,sys
j=json.loads(sys.argv[1])
print(j["data"]["eta"])
PY
)
  local latest
  latest="$(get_latest_ledger)"
  while [[ "$latest" -lt "$eta" ]]; do
    echo "  latest=$latest < eta=$eta; sleeping 5s"
    sleep 5
    latest="$(get_latest_ledger)"
  done
  stellar contract invoke \
    --id "$GOV_ID" \
    --source-account "$ADMIN_SECRET" \
    --rpc-url "$RPC_URL" \
    --network-passphrase "$NETWORK_PASSPHRASE" \
    --send=yes -- execute --proposal_id "$pid" >/dev/null
}

vote_close_execute() {
  local pid="$1"
  echo "   vote FOR proposal $pid"
  stellar contract invoke \
    --id "$GOV_ID" \
    --source-account "$ADMIN_SECRET" \
    --rpc-url "$RPC_URL" \
    --network-passphrase "$NETWORK_PASSPHRASE" \
    --send=yes -- vote --voter "$ADMIN_ADDRESS" --proposal_id "$pid" --support 1 >/dev/null
  local pjson
  pjson="$(get_proposal_json "$pid")"
  wait_and_close "$pid" "$pjson"
  pjson="$(get_proposal_json "$pid")"
  wait_and_execute "$pid" "$pjson"
  stellar contract invoke \
    --id "$GOV_ID" \
    --source-account "$ADMIN_SECRET" \
    --rpc-url "$RPC_URL" \
    --network-passphrase "$NETWORK_PASSPHRASE" \
    -- get_proposal --proposal_id "$pid"
}

run_ts_proposal() {
  local script_name="$1"
  shift
  local output
  output="$(cd "$ROOT_DIR/scripts/js" && env \
    TS_NODE_TRANSPILE_ONLY="$TS_NODE_TRANSPILE_ONLY" \
    TS_NODE_COMPILER_OPTIONS="$TS_NODE_COMPILER_OPTIONS" \
    "$@" node --loader ts-node/esm "$script_name")"
  printf '%s\n' "$output" >&2
  printf '%s\n' "$output" | awk -F= '/^PROPOSAL_ID=/{print $2}' | tail -n1
}

echo "Governor: $GOV_ID"
echo "Factory: $FACTORY_ID"
echo "Old Arka: $OLD_ARKA"

echo "1) Upload implementation WASM blobs"
ARKA_IMPL_HASH="$(stellar contract upload --wasm "$ARKA_WASM_PATH" --source-account "$ADMIN_SECRET" --rpc-url "$RPC_URL" --network-passphrase "$NETWORK_PASSPHRASE" | tail -n1)"
SHARE_TOKEN_IMPL_HASH="$(stellar contract upload --wasm "$SHARE_TOKEN_WASM_PATH" --source-account "$ADMIN_SECRET" --rpc-url "$RPC_URL" --network-passphrase "$NETWORK_PASSPHRASE" | tail -n1)"
echo "   ARKA_IMPL_HASH=$ARKA_IMPL_HASH"
echo "   SHARE_TOKEN_IMPL_HASH=$SHARE_TOKEN_IMPL_HASH"

echo "2) Propose share token implementation update"
PID="$(run_ts_proposal proposeFactorySetShareTokenImplementation.ts \
  ADMIN_SECRET="$ADMIN_SECRET" \
  CREATOR_ADDRESS="$ADMIN_ADDRESS" \
  GOV_ID="$GOV_ID" \
  FACTORY_ID="$FACTORY_ID" \
  SHARE_TOKEN_IMPL_HASH_HEX="$SHARE_TOKEN_IMPL_HASH")"
vote_close_execute "$PID"

echo "3) Propose arka implementation update"
PID="$(run_ts_proposal proposeFactorySetImplementation.ts \
  ADMIN_SECRET="$ADMIN_SECRET" \
  CREATOR_ADDRESS="$ADMIN_ADDRESS" \
  GOV_ID="$GOV_ID" \
  FACTORY_ID="$FACTORY_ID" \
  IMPL_HASH_HEX="$ARKA_IMPL_HASH")"
vote_close_execute "$PID"

echo "4) Propose governed migration"
MIGRATION_SALT_HEX="$(openssl rand -hex 32)"
PID="$(run_ts_proposal proposeFactoryMigrateArkaRaw.ts \
  ADMIN_SECRET="$ADMIN_SECRET" \
  CREATOR_ADDRESS="$ADMIN_ADDRESS" \
  GOV_ID="$GOV_ID" \
  FACTORY_ID="$FACTORY_ID" \
  OLD_ARKA="$OLD_ARKA" \
  MIGRATION_SALT_HEX="$MIGRATION_SALT_HEX" \
  MANAGER_ADDRESS="$ADMIN_ADDRESS" \
  DENOMINATION="$DENOM" \
  ROUTER="$ROUTER" \
  WHITELIST="$WHITELIST")"
vote_close_execute "$PID"

echo "5) Verify migrated Arka and share token"
NEW_ARKA="$(stellar contract invoke \
  --id "$FACTORY_ID" \
  --source-account "$ADMIN_SECRET" \
  --rpc-url "$RPC_URL" \
  --network-passphrase "$NETWORK_PASSPHRASE" \
  -- migrated_to --old_arka "$OLD_ARKA" | tr -d '"')"
echo "New Arka: $NEW_ARKA"

stellar contract invoke \
  --id "$FACTORY_ID" \
  --source-account "$ADMIN_SECRET" \
  --rpc-url "$RPC_URL" \
  --network-passphrase "$NETWORK_PASSPHRASE" \
  -- share_token_of --arka "$NEW_ARKA"

stellar contract invoke \
  --id "$NEW_ARKA" \
  --source-account "$ADMIN_SECRET" \
  --rpc-url "$RPC_URL" \
  --network-passphrase "$NETWORK_PASSPHRASE" \
  -- share_token

echo "Governed Arka migration E2E complete."
