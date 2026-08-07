#!/usr/bin/env bash
set -euo pipefail

# Builds a contract-creation transaction and simulates it without submitting
# anything to Mainnet. Soroban's response is useful for resource-fee planning,
# but it is not a complete quote for fresh instance/WASM storage rent.

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
MANIFEST="${MANIFEST:-$ROOT_DIR/deployments.mainnet.json}"
WASM="${1:-}"

if [[ -z "$WASM" || ! -f "$WASM" ]]; then
  echo "Usage: $0 /path/to/contract.wasm" >&2
  exit 1
fi

RPC_URL="$(jq -r '.rpcUrl' "$MANIFEST")"
NETWORK_PASSPHRASE="$(jq -r '.networkPassphrase' "$MANIFEST")"
ADMIN="$(jq -r '.admin.publicKey' "$MANIFEST")"
BUILD_XDR="$(mktemp)"
trap 'rm -f "$BUILD_XDR"' EXIT

stellar -q contract deploy \
  --wasm "$WASM" \
  --source-account "$ADMIN" \
  --rpc-url "$RPC_URL" \
  --network-passphrase "$NETWORK_PASSPHRASE" \
  --build-only > "$BUILD_XDR"

SIMULATION="$(curl -fsS "$RPC_URL" \
  -H 'content-type: application/json' \
  --data "$(jq -n --arg transaction "$(tr -d '\\n' < "$BUILD_XDR")" '{jsonrpc:"2.0",id:1,method:"simulateTransaction",params:{transaction:$transaction}}')")"

if [[ "$(jq -r '.error // empty' <<<"$SIMULATION")" != "" ]]; then
  jq . <<<"$SIMULATION" >&2
  exit 1
fi

FEE="$(jq -r '.result.minResourceFee // "0"' <<<"$SIMULATION")"
jq -n \
  --arg network "mainnet" \
  --arg wasm "$(basename "$WASM")" \
  --argjson wasmBytes "$(wc -c < "$WASM" | tr -d ' ')" \
  --arg minResourceFeeStroops "$FEE" \
  --arg minResourceFeeXlm "$(awk -v fee="$FEE" 'BEGIN { printf "%.7f", fee / 10000000 }')" \
  --arg warning "Simulation resource fee is not a complete quote for fresh Mainnet storage rent. The canary deploy script remains blocked until an explicit deployment acknowledgement is supplied." \
  '{network:$network, wasm:$wasm, wasmBytes:$wasmBytes, simulatedMinResourceFeeStroops:$minResourceFeeStroops, simulatedMinResourceFeeXlm:$minResourceFeeXlm, warning:$warning}'
