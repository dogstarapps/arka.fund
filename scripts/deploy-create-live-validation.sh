#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
OUT_JSON="${OUT_JSON:-$ROOT_DIR/tmp/create-live-validation.json}"

RPC_URL="${CREATE_RPC_URL:-https://soroban-testnet.stellar.org}"
NETWORK_PASSPHRASE="${CREATE_NETWORK_PASSPHRASE:-Test SDF Network ; September 2015}"

FACTORY_ID="${FACTORY_ID:-CAZPR5MIUHXH46ZJ5OAMRZXD7PXIHMF5HHSSKQPDUBEXVID5SAGSZ3HW}"
ROUTER_ID="${ROUTER_ID:-CAARCDANGZNLDR7CF5MRUA32VUBD6KAZMTNTVJKA5ISQHHKYMP7YFTTI}"
DENOM_ID="${DENOM_ID:-CDJ7G22ETJ6PRUM5GDPUXYEY3JL6MDY35WMJYWSGX7U6DV5VMQEKH3PG}"
WHITELIST_JSON="${WHITELIST_JSON:-[\"CDJ7G22ETJ6PRUM5GDPUXYEY3JL6MDY35WMJYWSGX7U6DV5VMQEKH3PG\",\"CCCLTACEMF33GJRJ2JXRQYXDBRLRZNK5GVPA2FVHLOE5TPP6NM7UIYV7\"]}"
MANAGER_ALIAS="${MANAGER_ALIAS:-arka-holder}"
MANAGER_ADDR="${MANAGER_ADDR:-$(stellar keys address "$MANAGER_ALIAS")}"
SALT_HEX="${SALT_HEX:-$(openssl rand -hex 32)}"

mkdir -p "$(dirname "$OUT_JSON")"

invoke_view() {
  stellar contract invoke \
    --id "$1" \
    --source-account "$MANAGER_ALIAS" \
    --rpc-url "$RPC_URL" \
    --network-passphrase "$NETWORK_PASSPHRASE" \
    -- "${@:2}"
}

echo "1) Read current manager Arka list"
BEFORE_ARKAS_JSON="$(invoke_view "$FACTORY_ID" get_arkas_by_manager --manager "$MANAGER_ADDR" --offset 0 --limit 200)"

echo "2) Create a new live Arka through the public factory"
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

wait_for_value() {
  local contract_id="$1"
  shift
  local value=""
  for _ in $(seq 1 20); do
    if value="$(invoke_view "$contract_id" "$@" 2>/dev/null)"; then
      if [[ -n "$value" && "$value" != "null" ]]; then
        printf '%s' "$value"
        return 0
      fi
    fi
    sleep 2
  done
  return 1
}

echo "3) Read new Arka state"
MANAGER_ONCHAIN="$(wait_for_value "$NEW_ARKA" manager | tr -d '"')"
ROUTER_ONCHAIN="$(wait_for_value "$NEW_ARKA" router | tr -d '"')"
DENOM_ONCHAIN_JSON="$(wait_for_value "$NEW_ARKA" denomination)"
WHITELIST_ONCHAIN="$(wait_for_value "$NEW_ARKA" whitelist)"
AFTER_ARKAS_JSON="$(invoke_view "$FACTORY_ID" get_arkas_by_manager --manager "$MANAGER_ADDR" --offset 0 --limit 200)"

echo "4) Validate state"
[[ "$MANAGER_ONCHAIN" == "$MANAGER_ADDR" ]] || { echo "manager mismatch"; exit 1; }
[[ "$ROUTER_ONCHAIN" == "$ROUTER_ID" ]] || { echo "router mismatch"; exit 1; }

python3 - <<'PY' "$NEW_ARKA" "$BEFORE_ARKAS_JSON" "$AFTER_ARKAS_JSON" "$WHITELIST_JSON" "$WHITELIST_ONCHAIN" "$DENOM_ONCHAIN_JSON" "$OUT_JSON" "$FACTORY_ID" "$ROUTER_ID" "$DENOM_ID" "$MANAGER_ADDR" "$SALT_HEX"
import json
import sys

new_arka = sys.argv[1]
before = json.loads(sys.argv[2])
after = json.loads(sys.argv[3])
expected_whitelist = sorted(json.loads(sys.argv[4]))
onchain_whitelist = json.loads(sys.argv[5])
denom_onchain = json.loads(sys.argv[6])
out_json = sys.argv[7]
factory_id = sys.argv[8]
router_id = sys.argv[9]
denom_id = sys.argv[10]
manager_addr = sys.argv[11]
salt_hex = sys.argv[12]

if new_arka not in after:
    raise SystemExit("new arka not present in get_arkas_by_manager output")
if len(after) < len(before) + 1:
    raise SystemExit("manager arka list did not grow")
normalized_onchain_whitelist = sorted(entry["contract"] for entry in onchain_whitelist)
if normalized_onchain_whitelist != expected_whitelist:
    raise SystemExit("whitelist mismatch")
if denom_onchain["contract"] != denom_id:
    raise SystemExit("denomination mismatch")

payload = {
    "factory": factory_id,
    "manager": manager_addr,
    "salt": salt_hex,
    "newArka": new_arka,
    "router": router_id,
    "denomination": denom_id,
    "whitelist": expected_whitelist,
    "onchainDenomination": denom_onchain,
    "onchainWhitelist": onchain_whitelist,
    "managerArkasBefore": before,
    "managerArkasAfter": after,
}

with open(out_json, "w", encoding="utf-8") as fh:
    json.dump(payload, fh, indent=2)
PY

echo "Validation summary written to $OUT_JSON"
