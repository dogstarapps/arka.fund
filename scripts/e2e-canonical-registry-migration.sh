#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
CONFIG_DIR="$(mktemp -d)"
CONTAINER_NAME="arkafund-registry-migration-local-$$"
LOCAL_PORT="18120"
RPC_URL="http://127.0.0.1:${LOCAL_PORT}/soroban/rpc"
NETWORK_PASSPHRASE="Standalone Network ; February 2017"
REPORT_JSON="${REPORT_JSON:-$ROOT_DIR/tmp/canonical-registry-migration-local.json}"
DEPLOY_JSON="$(mktemp)"

cleanup() {
  stellar container stop "$CONTAINER_NAME" >/dev/null 2>&1 || true
  docker rm -f "$CONTAINER_NAME" "stellar-$CONTAINER_NAME" >/dev/null 2>&1 || true
  rm -rf "$CONFIG_DIR"
  rm -f "$DEPLOY_JSON"
}

trap cleanup EXIT

wait_for_local_network() {
  local ready_identity="ready"
  node "$ROOT_DIR/services/catalog-api/scripts/wait-for-rpc.mjs" "$RPC_URL" 120 >/dev/null
  stellar --config-dir "$CONFIG_DIR" keys generate "$ready_identity" --overwrite >/dev/null
  local readiness_public_key
  readiness_public_key="$(stellar --config-dir "$CONFIG_DIR" keys public-key "$ready_identity")"
  for _ in $(seq 1 60); do
    if friendbot_seed "$readiness_public_key"; then
      if node "$ROOT_DIR/services/catalog-api/scripts/wait-for-account.mjs" "$RPC_URL" "$readiness_public_key" 20 >/dev/null 2>&1; then
        return 0
      fi
    fi
    sleep 2
  done
  echo "Local Stellar friendbot did not become ready in time" >&2
  return 1
}

friendbot_seed() {
  local public_key="$1"
  local status
  status="$(curl -s -o /tmp/arkafund-friendbot.$$ -w '%{http_code}' "http://127.0.0.1:${LOCAL_PORT}/friendbot?addr=${public_key}" || true)"
  rm -f /tmp/arkafund-friendbot.$$
  [[ "$status" == "200" || "$status" == "400" ]]
}

fund_identity() {
  local identity="$1"
  stellar --config-dir "$CONFIG_DIR" keys generate "$identity" --overwrite >/dev/null
  local public_key
  public_key="$(stellar --config-dir "$CONFIG_DIR" keys public-key "$identity")"
  for _ in $(seq 1 6); do
    friendbot_seed "$public_key" >/dev/null 2>&1 || true
    if node "$ROOT_DIR/services/catalog-api/scripts/wait-for-account.mjs" "$RPC_URL" "$public_key" 15 >/dev/null 2>&1; then
      return 0
    fi
    sleep 2
  done
  echo "Funded account did not become visible on RPC: $public_key" >&2
  return 1
}

deploy_contract() {
  local wasm_path="$1"
  stellar --config-dir "$CONFIG_DIR" contract deploy \
    --wasm "$wasm_path" \
    --source-account admin \
    --rpc-url "$RPC_URL" \
    --network-passphrase "$NETWORK_PASSPHRASE"
}

docker rm -f "$CONTAINER_NAME" "stellar-$CONTAINER_NAME" >/dev/null 2>&1 || true
cd "$ROOT_DIR"
bash ./scripts/build-wasm.sh >/dev/null
nohup stellar container start local --name "$CONTAINER_NAME" --ports-mapping "${LOCAL_PORT}:8000" >"$CONFIG_DIR/container.log" 2>&1 &
wait_for_local_network

fund_identity admin
fund_identity managera
fund_identity managerb

ADMIN_ADDR="$(stellar --config-dir "$CONFIG_DIR" keys public-key admin)"
MANAGER_A_ADDR="$(stellar --config-dir "$CONFIG_DIR" keys public-key managera)"
MANAGER_B_ADDR="$(stellar --config-dir "$CONFIG_DIR" keys public-key managerb)"

OLD_REGISTRY_ID="$(deploy_contract "$ROOT_DIR/artifacts/arka-registry.wasm")"
FACTORY_ID="$(deploy_contract "$ROOT_DIR/artifacts/arka-factory.wasm")"
TOKEN_ID="$(deploy_contract "$ROOT_DIR/artifacts/test-token.wasm")"
ROUTER_ID="$(deploy_contract "$ROOT_DIR/artifacts/router.wasm")"
ARKA_WASM_HASH="$(stellar --config-dir "$CONFIG_DIR" contract install --wasm "$ROOT_DIR/artifacts/arka.wasm" --source-account admin --rpc-url "$RPC_URL" --network-passphrase "$NETWORK_PASSPHRASE")"

stellar --config-dir "$CONFIG_DIR" contract invoke \
  --id "$OLD_REGISTRY_ID" \
  --source-account admin \
  --rpc-url "$RPC_URL" \
  --network-passphrase "$NETWORK_PASSPHRASE" \
  --send=yes -- init_admin --admin "$ADMIN_ADDR" >/dev/null

stellar --config-dir "$CONFIG_DIR" contract invoke \
  --id "$FACTORY_ID" \
  --source-account admin \
  --rpc-url "$RPC_URL" \
  --network-passphrase "$NETWORK_PASSPHRASE" \
  --send=yes -- set_governor --governor "$ADMIN_ADDR" >/dev/null

stellar --config-dir "$CONFIG_DIR" contract invoke \
  --id "$FACTORY_ID" \
  --source-account admin \
  --rpc-url "$RPC_URL" \
  --network-passphrase "$NETWORK_PASSPHRASE" \
  --send=yes -- set_implementation --impl_wasm_hash "$ARKA_WASM_HASH" >/dev/null

stellar --config-dir "$CONFIG_DIR" contract invoke \
  --id "$FACTORY_ID" \
  --source-account admin \
  --rpc-url "$RPC_URL" \
  --network-passphrase "$NETWORK_PASSPHRASE" \
  --send=yes -- set_registry --registry "$OLD_REGISTRY_ID" >/dev/null

stellar --config-dir "$CONFIG_DIR" contract invoke \
  --id "$OLD_REGISTRY_ID" \
  --source-account admin \
  --rpc-url "$RPC_URL" \
  --network-passphrase "$NETWORK_PASSPHRASE" \
  --send=yes -- set_registrar --caller "$ADMIN_ADDR" --registrar "$FACTORY_ID" --allowed true >/dev/null

stellar --config-dir "$CONFIG_DIR" contract invoke \
  --id "$TOKEN_ID" \
  --source-account admin \
  --rpc-url "$RPC_URL" \
  --network-passphrase "$NETWORK_PASSPHRASE" \
  --send=yes -- init --admin "$ADMIN_ADDR" >/dev/null

WHITELIST_JSON="[\"$TOKEN_ID\"]"

ARKA_ONE="$(
  stellar --config-dir "$CONFIG_DIR" contract invoke \
    --id "$FACTORY_ID" \
    --source-account managera \
    --rpc-url "$RPC_URL" \
    --network-passphrase "$NETWORK_PASSPHRASE" \
    --send=yes -- create_and_init \
    --salt "$(openssl rand -hex 32)" \
    --manager "$MANAGER_A_ADDR" \
    --denomination "$TOKEN_ID" \
    --mgmt_bps 0 \
    --perf_bps 0 \
    --deposit_bps 0 \
    --redeem_bps 0 \
    --whitelist "$WHITELIST_JSON" \
    --router "$ROUTER_ID" | tr -d '"'
)"

ARKA_TWO="$(
  stellar --config-dir "$CONFIG_DIR" contract invoke \
    --id "$FACTORY_ID" \
    --source-account managerb \
    --rpc-url "$RPC_URL" \
    --network-passphrase "$NETWORK_PASSPHRASE" \
    --send=yes -- create_and_init \
    --salt "$(openssl rand -hex 32)" \
    --manager "$MANAGER_B_ADDR" \
    --denomination "$TOKEN_ID" \
    --mgmt_bps 0 \
    --perf_bps 0 \
    --deposit_bps 0 \
    --redeem_bps 0 \
    --whitelist "$WHITELIST_JSON" \
    --router "$ROUTER_ID" | tr -d '"'
)"

stellar --config-dir "$CONFIG_DIR" contract invoke \
  --id "$OLD_REGISTRY_ID" \
  --source-account admin \
  --rpc-url "$RPC_URL" \
  --network-passphrase "$NETWORK_PASSPHRASE" \
  --send=yes -- set_manager_curated --caller "$ADMIN_ADDR" --manager "$MANAGER_A_ADDR" --curated true >/dev/null

stellar --config-dir "$CONFIG_DIR" contract invoke \
  --id "$OLD_REGISTRY_ID" \
  --source-account admin \
  --rpc-url "$RPC_URL" \
  --network-passphrase "$NETWORK_PASSPHRASE" \
  --send=yes -- set_delisted --caller "$ADMIN_ADDR" --arka "$ARKA_TWO" --delisted true >/dev/null

python3 - <<'PY' "$DEPLOY_JSON" "$FACTORY_ID" "$OLD_REGISTRY_ID" "$RPC_URL"
import json
import sys

payload = {
    "network": "local",
    "rpcUrl": sys.argv[4],
    "contracts": {
        "arkaFactory": sys.argv[2],
        "arkaRegistry": sys.argv[3],
    },
}
with open(sys.argv[1], "w", encoding="utf-8") as fh:
    json.dump(payload, fh, indent=2)
    fh.write("\n")
PY

python3 "$ROOT_DIR/scripts/canonical_registry_migration.py" \
  --deploy-json "$DEPLOY_JSON" \
  --out-json "$REPORT_JSON" \
  --rpc-url "$RPC_URL" \
  --network-passphrase "$NETWORK_PASSPHRASE" \
  --admin-identity admin \
  --factory-id "$FACTORY_ID" \
  --source-registry-id "$OLD_REGISTRY_ID" \
  --config-dir "$CONFIG_DIR"

python3 - <<'PY' "$REPORT_JSON" "$MANAGER_A_ADDR" "$ARKA_ONE" "$ARKA_TWO"
import json
import sys

report = json.load(open(sys.argv[1], "r", encoding="utf-8"))
assert report["totalArkas"] == 2, report
assert report["activeArkas"] == 1, report
assert report["copiedCuratedManagers"] == 1, report
assert report["copiedDelistedArkas"] == 1, report
assert report["validation"]["curatedManagers"] == [sys.argv[2]], report
assert report["validation"]["activeArkas"] == [sys.argv[3]], report
assert report["validation"]["delistedArkas"] == [sys.argv[4]], report
PY

echo "Canonical registry local E2E validation completed."
