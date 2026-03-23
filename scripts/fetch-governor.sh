#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
VENDOR_DIR="$ROOT_DIR/vendor"
ARTIFACTS_DIR="$ROOT_DIR/artifacts"

REPO_URL="https://github.com/script3/soroban-governor.git"
REPO_DIR="$VENDOR_DIR/soroban-governor"

echo "📦 Fetching soroban-governor workspace..."
mkdir -p "$VENDOR_DIR" "$ARTIFACTS_DIR"
if [[ ! -d "$REPO_DIR" ]]; then
  git clone --depth 1 "$REPO_URL" "$REPO_DIR"
else
  echo "🔁 Repo exists, pulling latest..."
  git -C "$REPO_DIR" pull --ff-only
fi

echo "🔧 Building governor workspace (wasm release)..."
pushd "$REPO_DIR" >/dev/null
rustup target add wasm32-unknown-unknown >/dev/null 2>&1 || true
cargo build --release --target wasm32-unknown-unknown

WASM_DIR="target/wasm32-unknown-unknown/release"
echo "📄 Searching WASM artifacts..."
ls -1 "$WASM_DIR" | grep -E '\.wasm$' || true

copy_artifact() {
  local pattern="$1"
  local output="$2"
  local source
  source="$(find "$WASM_DIR" -maxdepth 1 -type f -name "*.wasm" | grep -i "$pattern" | head -n1 || true)"
  if [[ -n "$source" ]]; then
    cp "$source" "$ARTIFACTS_DIR/$output"
    echo "✅ Copied $(basename "$source") -> $output"
  else
    echo "⚠️ No WASM found for pattern '$pattern'"
  fi
}

echo "🧩 Copying governor artifacts..."
copy_artifact "governor" "governor.wasm"
copy_artifact "votes" "votes.wasm"
popd >/dev/null

echo "ℹ️ The active public governance flow uses Governor plus execution delay. A separate Timelock artifact is not consumed by the current testnet runbooks."
echo "✅ Done. Check $ARTIFACTS_DIR for governor.wasm and votes.wasm"


