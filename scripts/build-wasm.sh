#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
CONTRACTS_DIR="$ROOT_DIR/contracts"
ARTIFACTS_DIR="$ROOT_DIR/artifacts"

echo "🔧 Ensuring wasm32-unknown-unknown target is installed..."
rustup target add wasm32-unknown-unknown >/dev/null 2>&1 || true

mkdir -p "$ARTIFACTS_DIR"

CRATES=(
  arka
  arka-factory
  arka-registry
  router
  adapter-aquarius
  adapter-soroswap
  adapter-phoenix
  adapter-comet
  adapter-balanced
  adapter-blend
  coverage-vault
  coverage-fund
  governance-token
  test-token
)

echo "🚀 Building Soroban contracts (wasm, release)..."
pushd "$CONTRACTS_DIR" >/dev/null
for CRATE in "${CRATES[@]}"; do
  echo "  • $CRATE"
  cargo build --release --target wasm32-unknown-unknown -p "$CRATE"
  # Artifacts use underscores in filenames
  CRATE_FILE="${CRATE//-/_}"
  WASM_PATH="target/wasm32-unknown-unknown/release/${CRATE_FILE}.wasm"
  if [[ -f "$WASM_PATH" ]]; then
    cp "$WASM_PATH" "$ARTIFACTS_DIR/${CRATE}.wasm"
  else
    echo "    ⚠️  Missing wasm for $CRATE at $WASM_PATH"
  fi

done
popd >/dev/null

printenv >/dev/null 2>&1 || true

echo "✅ Artifacts ready in: $ARTIFACTS_DIR"

