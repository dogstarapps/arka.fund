#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
CONTRACTS_DIR="$ROOT_DIR/contracts"
ARTIFACTS_DIR="$ROOT_DIR/artifacts"
WASM_RUSTFLAGS="${WASM_RUSTFLAGS:--C target-feature=-reference-types}"
STELLAR_CLI_VERSION="${STELLAR_CLI_VERSION:-26.1.0}"

echo "🔧 Ensuring wasm32-unknown-unknown target is installed..."
rustup target add wasm32-unknown-unknown >/dev/null 2>&1 || true

if ! command -v stellar >/dev/null 2>&1 || ! stellar --version | head -n 1 | grep -q "stellar $STELLAR_CLI_VERSION"; then
  echo "🔧 Installing Stellar CLI $STELLAR_CLI_VERSION for WASM optimization..."
  if [[ "${GITHUB_ACTIONS:-}" == "true" ]] && command -v apt-get >/dev/null 2>&1; then
    sudo apt-get update
    sudo apt-get install -y pkg-config libdbus-1-dev
  fi
  cargo install stellar-cli --version "$STELLAR_CLI_VERSION" --locked --force
fi
stellar --version

mkdir -p "$ARTIFACTS_DIR"

PRODUCTION_CRATES=(
  arka-vesting
  arka-token
  arka
  arka-factory
  arka-registry
  emissions-controller
  oracle-guard
  router
  venue-registry
  adapter-aquarius
  adapter-soroswap
  adapter-phoenix
  adapter-balanced
  adapter-blend
  coverage-vault
  coverage-fund
  claims-manager
  governance-executor
  locked-arka
  manager-tier
  governance-token
  share-token
)

TEST_CRATES=(
  test-oracle
  test-profit-adapter
  test-token
)

case "${BUILD_CONTRACT_SET:-all}" in
  production|mainnet)
    CRATES=("${PRODUCTION_CRATES[@]}")
    ;;
  test|tests)
    CRATES=("${TEST_CRATES[@]}")
    ;;
  all)
    CRATES=("${PRODUCTION_CRATES[@]}" "${TEST_CRATES[@]}")
    ;;
  *)
    echo "Unknown BUILD_CONTRACT_SET=${BUILD_CONTRACT_SET}. Use production, test, or all." >&2
    exit 1
    ;;
esac

echo "🚀 Building Soroban contracts (wasm, release, set=${BUILD_CONTRACT_SET:-all})..."
pushd "$CONTRACTS_DIR" >/dev/null
for CRATE in "${CRATES[@]}"; do
  echo "  • $CRATE"
  env RUSTFLAGS="$WASM_RUSTFLAGS" cargo build --release --target wasm32-unknown-unknown -p "$CRATE"
  # Artifacts use underscores in filenames
  CRATE_FILE="${CRATE//-/_}"
  WASM_PATH="target/wasm32-unknown-unknown/release/${CRATE_FILE}.wasm"
  if [[ -f "$WASM_PATH" ]]; then
    cp "$WASM_PATH" "$ARTIFACTS_DIR/${CRATE}.wasm"
    OPTIMIZED_PATH="$ARTIFACTS_DIR/${CRATE}.optimized.wasm"
    stellar contract optimize \
      --wasm "$ARTIFACTS_DIR/${CRATE}.wasm" \
      --wasm-out "$OPTIMIZED_PATH" >/dev/null
    mv "$OPTIMIZED_PATH" "$ARTIFACTS_DIR/${CRATE}.wasm"
  else
    echo "    ⚠️  Missing wasm for $CRATE at $WASM_PATH"
  fi

done
popd >/dev/null

printenv >/dev/null 2>&1 || true

echo "✅ Artifacts ready in: $ARTIFACTS_DIR"
