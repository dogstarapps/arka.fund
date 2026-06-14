#!/usr/bin/env bash
set -euo pipefail

MODE="${1:-}"
if [[ "$MODE" != "integration" && "$MODE" != "e2e" ]]; then
  echo "Usage: $0 <integration|e2e>" >&2
  exit 1
fi

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
REPO_DIR="$(cd "$ROOT_DIR/../.." && pwd)"
CONTAINER_NAME="arkafund-sdk-${MODE}-local-$$"
CONFIG_DIR="$(mktemp -d)"
LOCAL_PORT="18100"
RPC_URL="http://127.0.0.1:${LOCAL_PORT}/soroban/rpc"
NETWORK_PASSPHRASE="Standalone Network ; February 2017"
OPTIMIZED_DIR="$CONFIG_DIR/optimized"

cleanup() {
  stellar container stop "$CONTAINER_NAME" >/dev/null 2>&1 || true
  docker rm -f "$CONTAINER_NAME" "stellar-$CONTAINER_NAME" >/dev/null 2>&1 || true
  rm -rf "$CONFIG_DIR"
}

trap cleanup EXIT

wait_for_local_network() {
  node "$ROOT_DIR/scripts/wait-for-rpc.mjs" "$RPC_URL" 120 >/dev/null
  stellar --config-dir "$CONFIG_DIR" keys generate readiness --overwrite >/dev/null
  local readiness_public_key
  readiness_public_key="$(stellar --config-dir "$CONFIG_DIR" keys public-key readiness)"
  for _ in $(seq 1 60); do
    if curl -fsS "http://127.0.0.1:${LOCAL_PORT}/friendbot?addr=${readiness_public_key}" >/dev/null 2>&1; then
      if node "$ROOT_DIR/scripts/wait-for-account.mjs" "$RPC_URL" "$readiness_public_key" 20 >/dev/null 2>&1; then
        return 0
      fi
    fi
    sleep 2
  done
  echo "Local Stellar friendbot did not become ready in time" >&2
  return 1
}

fund_and_wait() {
  local identity="$1"
  stellar --config-dir "$CONFIG_DIR" keys generate "$identity" \
    --overwrite >/dev/null
  local public_key
  public_key="$(stellar --config-dir "$CONFIG_DIR" keys public-key "$identity")"
  for _ in $(seq 1 6); do
    curl -fsS "http://127.0.0.1:${LOCAL_PORT}/friendbot?addr=${public_key}" >/dev/null 2>&1 || true
    if node "$ROOT_DIR/scripts/wait-for-account.mjs" "$RPC_URL" "$public_key" 15 >/dev/null 2>&1; then
      return 0
    fi
    sleep 2
  done
  echo "Funded account did not become visible on RPC: $public_key" >&2
  return 1
}

docker rm -f "$CONTAINER_NAME" "stellar-$CONTAINER_NAME" >/dev/null 2>&1 || true
cd "$ROOT_DIR"
npm ci
nohup stellar container start local --name "$CONTAINER_NAME" --ports-mapping "${LOCAL_PORT}:8000" >"$CONFIG_DIR/container.log" 2>&1 &
wait_for_local_network

cd "$REPO_DIR"
bash scripts/build-wasm.sh >/dev/null
mkdir -p "$OPTIMIZED_DIR"
stellar contract optimize \
  --wasm "$REPO_DIR/artifacts/arka-registry.wasm" \
  --wasm-out "$OPTIMIZED_DIR/arka-registry.optimized.wasm" >/dev/null
stellar contract optimize \
  --wasm "$REPO_DIR/artifacts/oracle-guard.wasm" \
  --wasm-out "$OPTIMIZED_DIR/oracle-guard.optimized.wasm" >/dev/null

fund_and_wait admin
fund_and_wait writer

ADMIN_PUBLIC_KEY="$(stellar --config-dir "$CONFIG_DIR" keys public-key admin)"
ADMIN_SECRET="$(stellar --config-dir "$CONFIG_DIR" keys secret admin)"
WRITER_PUBLIC_KEY="$(stellar --config-dir "$CONFIG_DIR" keys public-key writer)"
WRITER_SECRET="$(stellar --config-dir "$CONFIG_DIR" keys secret writer)"

REGISTRY_CONTRACT_ID="$(stellar --config-dir "$CONFIG_DIR" contract deploy \
  --wasm "$OPTIMIZED_DIR/arka-registry.optimized.wasm" \
  --source-account admin \
  --rpc-url "$RPC_URL" \
  --network-passphrase "$NETWORK_PASSPHRASE")"
ORACLE_GUARD_CONTRACT_ID="$(stellar --config-dir "$CONFIG_DIR" contract deploy \
  --wasm "$OPTIMIZED_DIR/oracle-guard.optimized.wasm" \
  --source-account admin \
  --rpc-url "$RPC_URL" \
  --network-passphrase "$NETWORK_PASSPHRASE")"

cd "$ROOT_DIR"
npm run build
if [[ "$MODE" == "e2e" ]]; then
  npm run test:unit
fi
ARKAFUND_SDK_RPC_URL="$RPC_URL" \
ARKAFUND_SDK_NETWORK_PASSPHRASE="$NETWORK_PASSPHRASE" \
ARKAFUND_SDK_ADMIN_SECRET="$ADMIN_SECRET" \
ARKAFUND_SDK_ADMIN_PUBLIC_KEY="$ADMIN_PUBLIC_KEY" \
ARKAFUND_SDK_WRITER_SECRET="$WRITER_SECRET" \
ARKAFUND_SDK_WRITER_PUBLIC_KEY="$WRITER_PUBLIC_KEY" \
ARKAFUND_SDK_REGISTRY_CONTRACT_ID="$REGISTRY_CONTRACT_ID" \
ARKAFUND_SDK_ORACLE_GUARD_CONTRACT_ID="$ORACLE_GUARD_CONTRACT_ID" \
npm run test:integration:live
