#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
VENDOR_DIR="$ROOT_DIR/vendor"
ARTIFACTS_DIR="$ROOT_DIR/artifacts"

REPO_URL="https://github.com/script3/soroban-governor.git"
REPO_DIR="$VENDOR_DIR/soroban-governor"

echo "📦 Cloning Script3 soroban-governor..."
mkdir -p "$VENDOR_DIR" "$ARTIFACTS_DIR"
if [[ ! -d "$REPO_DIR" ]]; then
  git clone --depth 1 "$REPO_URL" "$REPO_DIR"
else
  echo "🔁 Repo exists, pulling latest..."
  git -C "$REPO_DIR" pull --ff-only
fi

echo "🔧 Building Script3 governor workspace (wasm release)..."
pushd "$REPO_DIR" >/dev/null
rustup target add wasm32-unknown-unknown >/dev/null 2>&1 || true
cargo build --release --target wasm32-unknown-unknown

WASM_DIR="target/wasm32-unknown-unknown/release"
echo "📄 Searching WASM artifacts..."
ls -1 "$WASM_DIR" | grep -E '\.wasm$' || true

echo "🧩 Copying governor/timelock WASM to artifacts..."
cp $(ls "$WASM_DIR" | grep -i governor | head -n1 | xargs -I{} echo "$WASM_DIR/{}") "$ARTIFACTS_DIR/governor.wasm" || echo "⚠️ governor.wasm not found"
cp $(ls "$WASM_DIR" | grep -i timelock | head -n1 | xargs -I{} echo "$WASM_DIR/{}") "$ARTIFACTS_DIR/timelock.wasm" || echo "⚠️ timelock.wasm not found"
popd >/dev/null

echo "✅ Done. Check $ARTIFACTS_DIR for governor.wasm and timelock.wasm"



