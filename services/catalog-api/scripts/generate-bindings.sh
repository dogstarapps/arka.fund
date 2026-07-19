#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
REPO_DIR="$(cd "$ROOT_DIR/../.." && pwd)"
ARTIFACTS_DIR="$REPO_DIR/artifacts"
TMP_DIR="$(mktemp -d)"
trap 'rm -rf "$TMP_DIR"' EXIT

CONTRACTS=(
  "arka:arka.wasm"
  "arka-registry:arka-registry.wasm"
  "oracle-guard:oracle-guard.wasm"
  "test-token:test-token.wasm"
)

mkdir -p "$ROOT_DIR/src/generated"

for ENTRY in "${CONTRACTS[@]}"; do
  NAME="${ENTRY%%:*}"
  WASM_FILE="${ENTRY#*:}"
  OUT_DIR="$TMP_DIR/$NAME"
  stellar contract bindings typescript \
    --wasm "$ARTIFACTS_DIR/$WASM_FILE" \
    --output-dir "$OUT_DIR" \
    --overwrite >/dev/null
  cp "$OUT_DIR/src/index.ts" "$ROOT_DIR/src/generated/$NAME.ts"
done

echo "Generated bindings refreshed in $ROOT_DIR/src/generated"
