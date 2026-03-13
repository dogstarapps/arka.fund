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
ARKA_ID="${ARKA_ID:-$(jq -r '.contracts.arka // empty' "$DEPLOY_JSON")}"
MGMT_BPS="${MGMT_BPS:-50}"
PERF_BPS="${PERF_BPS:-100}"
DEPOSIT_BPS="${DEPOSIT_BPS:-20}"
REDEEM_BPS="${REDEEM_BPS:-20}"

if [[ -z "$ADMIN_SECRET" || -z "$ADMIN_ADDRESS" ]]; then
  echo "ERROR: ADMIN_SECRET and ADMIN_ADDRESS are required." >&2
  exit 1
fi

if [[ -z "$GOV_ID" || -z "$ARKA_ID" ]]; then
  echo "ERROR: GOV_ID and ARKA_ID are required." >&2
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

echo "Governor: $GOV_ID"
echo "Arka: $ARKA_ID"
echo "Creator: $ADMIN_ADDRESS"

echo "1) Create calldata proposal for set_fees"
PROPOSE_OUT="$(cd "$ROOT_DIR/scripts/js" && \
  TS_NODE_TRANSPILE_ONLY="$TS_NODE_TRANSPILE_ONLY" \
  TS_NODE_COMPILER_OPTIONS="$TS_NODE_COMPILER_OPTIONS" \
  ADMIN_SECRET="$ADMIN_SECRET" \
  CREATOR_ADDRESS="$ADMIN_ADDRESS" \
  GOV_ID="$GOV_ID" \
  ARKA_ID="$ARKA_ID" \
  MGMT_BPS="$MGMT_BPS" \
  PERF_BPS="$PERF_BPS" \
  DEPOSIT_BPS="$DEPOSIT_BPS" \
  REDEEM_BPS="$REDEEM_BPS" \
  node --loader ts-node/esm proposeArkaSetFees.ts)"
printf '%s\n' "$PROPOSE_OUT"
PROPOSAL_ID="$(printf '%s\n' "$PROPOSE_OUT" | awk -F= '/^PROPOSAL_ID=/{print $2}' | tail -n1)"
if [[ -z "$PROPOSAL_ID" ]]; then
  echo "ERROR: could not parse proposal id" >&2
  exit 1
fi

echo "2) Vote FOR"
stellar contract invoke \
  --id "$GOV_ID" \
  --source-account "$ADMIN_SECRET" \
  --rpc-url "$RPC_URL" \
  --network-passphrase "$NETWORK_PASSPHRASE" \
  --send=yes -- vote --voter "$ADMIN_ADDRESS" --proposal_id "$PROPOSAL_ID" --support 1 >/dev/null

echo "3) Close after vote period and execute after timelock"
PJSON="$(get_proposal_json "$PROPOSAL_ID")"
wait_and_close "$PROPOSAL_ID" "$PJSON"
PJSON="$(get_proposal_json "$PROPOSAL_ID")"
wait_and_execute "$PROPOSAL_ID" "$PJSON"

echo "4) Verify proposal and fees"
stellar contract invoke \
  --id "$GOV_ID" \
  --source-account "$ADMIN_SECRET" \
  --rpc-url "$RPC_URL" \
  --network-passphrase "$NETWORK_PASSPHRASE" \
  -- get_proposal --proposal_id "$PROPOSAL_ID"

stellar contract invoke \
  --id "$ARKA_ID" \
  --source-account "$ADMIN_SECRET" \
  --rpc-url "$RPC_URL" \
  --network-passphrase "$NETWORK_PASSPHRASE" \
  -- fees

echo "Governed policy update E2E complete."
