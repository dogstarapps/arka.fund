#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
DEPLOY_JSON="${DEPLOY_JSON:-$ROOT_DIR/deployments.testnet.json}"
OUT_JSON="${OUT_JSON:-$ROOT_DIR/tmp/registry-integrity-validation.json}"

NETWORK_PASSPHRASE="${NETWORK_PASSPHRASE:-Test SDF Network ; September 2015}"
RPC_URL="${RPC_URL:-https://soroban-testnet.stellar.org}"

FACTORY_ID="${FACTORY_ID:-$(jq -r '.contracts.arkaFactory // empty' "$DEPLOY_JSON")}"
REGISTRY_ID="${REGISTRY_ID:-$(jq -r '.contracts.arkaRegistry // empty' "$DEPLOY_JSON")}"
ROUTER_ID="${ROUTER_ID:-$(jq -r '.contracts.router // empty' "$DEPLOY_JSON")}"
DENOM_ID="${DENOM_ID:-$(jq -r '.tokens.ARKA1 // empty' "$DEPLOY_JSON")}"
WHITELIST_JSON="${WHITELIST_JSON:-$(jq -c '[.tokens.ARKA1, .tokens.ARKA2]' "$DEPLOY_JSON")}"

REGISTRY_ADMIN_ALIAS="${REGISTRY_ADMIN_ALIAS:-arka-admin}"
MANAGER_ALIAS="${MANAGER_ALIAS:-arka-holder}"
REGISTRY_ADMIN_ADDR="${REGISTRY_ADMIN_ADDR:-$(stellar keys address "$REGISTRY_ADMIN_ALIAS")}"
MANAGER_ADDR="${MANAGER_ADDR:-$(stellar keys address "$MANAGER_ALIAS")}"

SALT_HEX="${SALT_HEX:-$(openssl rand -hex 32)}"
UNAUTHORIZED_ARKA_ID="${UNAUTHORIZED_ARKA_ID:-$FACTORY_ID}"

mkdir -p "$(dirname "$OUT_JSON")"

if [[ -z "$FACTORY_ID" || -z "$REGISTRY_ID" || -z "$ROUTER_ID" || -z "$DENOM_ID" ]]; then
  echo "ERROR: FACTORY_ID, REGISTRY_ID, ROUTER_ID and DENOM_ID are required." >&2
  exit 1
fi

invoke_registry_view() {
  stellar contract invoke \
    --id "$REGISTRY_ID" \
    --source-account "$REGISTRY_ADMIN_ALIAS" \
    --rpc-url "$RPC_URL" \
    --network-passphrase "$NETWORK_PASSPHRASE" \
    -- "${@:1}"
}

invoke_registry_send() {
  local alias="$1"
  shift
  stellar contract invoke \
    --id "$REGISTRY_ID" \
    --source-account "$alias" \
    --rpc-url "$RPC_URL" \
    --network-passphrase "$NETWORK_PASSPHRASE" \
    --send=yes \
    -- "${@:1}"
}

invoke_factory_view() {
  stellar contract invoke \
    --id "$FACTORY_ID" \
    --source-account "$MANAGER_ALIAS" \
    --rpc-url "$RPC_URL" \
    --network-passphrase "$NETWORK_PASSPHRASE" \
    -- "${@:1}"
}

echo "1) Initialize registry admin if needed"
invoke_registry_send "$REGISTRY_ADMIN_ALIAS" init_admin --admin "$REGISTRY_ADMIN_ADDR" >/dev/null

echo "2) Authorize factory as registry registrar"
invoke_registry_send \
  "$REGISTRY_ADMIN_ALIAS" \
  set_registrar \
  --caller "$REGISTRY_ADMIN_ADDR" \
  --registrar "$FACTORY_ID" \
  --allowed true >/dev/null

echo "3) Capture pre-state"
BEFORE_COUNT="$(invoke_registry_view count)"
BEFORE_MANAGER_ARKAS="$(invoke_registry_view get_arkas_by_manager --manager "$MANAGER_ADDR" --offset 0 --limit 200)"

echo "4) Verify direct unauthorized registry write is rejected"
set +e
UNAUTHORIZED_OUTPUT="$(
  stellar contract invoke \
    --id "$REGISTRY_ID" \
    --source-account "$MANAGER_ALIAS" \
    --rpc-url "$RPC_URL" \
    --network-passphrase "$NETWORK_PASSPHRASE" \
    --send=yes \
    -- register \
    --caller "$MANAGER_ADDR" \
    --manager "$MANAGER_ADDR" \
    --arka "$UNAUTHORIZED_ARKA_ID" 2>&1
)"
UNAUTHORIZED_EXIT=$?
set -e

if [[ $UNAUTHORIZED_EXIT -eq 0 ]]; then
  echo "ERROR: direct unauthorized registry write unexpectedly succeeded." >&2
  exit 1
fi

echo "5) Create and initialize a new Arka through the factory"
NEW_ARKA="$(
  stellar contract invoke \
    --id "$FACTORY_ID" \
    --source-account "$MANAGER_ALIAS" \
    --rpc-url "$RPC_URL" \
    --network-passphrase "$NETWORK_PASSPHRASE" \
    --send=yes \
    -- create_and_init \
    --salt "$SALT_HEX" \
    --manager "$MANAGER_ADDR" \
    --denomination "$DENOM_ID" \
    --mgmt_bps 0 \
    --perf_bps 0 \
    --deposit_bps 0 \
    --redeem_bps 0 \
    --whitelist "$WHITELIST_JSON" \
    --router "$ROUTER_ID" | tr -d '"'
)"

echo "6) Capture post-state"
AFTER_COUNT="$(invoke_registry_view count)"
AFTER_MANAGER_ARKAS="$(invoke_registry_view get_arkas_by_manager --manager "$MANAGER_ADDR" --offset 0 --limit 200)"

python3 - <<'PY' \
  "$OUT_JSON" \
  "$FACTORY_ID" \
  "$REGISTRY_ID" \
  "$MANAGER_ADDR" \
  "$REGISTRY_ADMIN_ADDR" \
  "$NEW_ARKA" \
  "$BEFORE_COUNT" \
  "$AFTER_COUNT" \
  "$BEFORE_MANAGER_ARKAS" \
  "$AFTER_MANAGER_ARKAS" \
  "$UNAUTHORIZED_OUTPUT"
import json
import sys

out_json = sys.argv[1]
factory_id = sys.argv[2]
registry_id = sys.argv[3]
manager_addr = sys.argv[4]
registry_admin_addr = sys.argv[5]
new_arka = sys.argv[6]
before_count = int(sys.argv[7])
after_count = int(sys.argv[8])
before_manager_arkas = json.loads(sys.argv[9])
after_manager_arkas = json.loads(sys.argv[10])
unauthorized_output = sys.argv[11]

if new_arka not in after_manager_arkas:
    raise SystemExit("new arka not present in registry manager listing")
if after_count < before_count + 1:
    raise SystemExit("registry count did not grow after factory create_and_init")
if len(after_manager_arkas) < len(before_manager_arkas) + 1:
    raise SystemExit("registry manager listing did not grow after factory create_and_init")

payload = {
    "registry": registry_id,
    "factory": factory_id,
    "registryAdmin": registry_admin_addr,
    "manager": manager_addr,
    "newArka": new_arka,
    "beforeCount": before_count,
    "afterCount": after_count,
    "beforeManagerArkas": before_manager_arkas,
    "afterManagerArkas": after_manager_arkas,
    "unauthorizedDirectRegister": {
        "accepted": False,
        "output": unauthorized_output,
    },
}

with open(out_json, "w", encoding="utf-8") as fh:
    json.dump(payload, fh, indent=2)
PY

echo "Registry integrity validation summary written to $OUT_JSON"
