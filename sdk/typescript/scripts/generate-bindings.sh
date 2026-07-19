#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
REPO_DIR="$(cd "$ROOT_DIR/../.." && pwd)"
ARTIFACTS_DIR="$REPO_DIR/artifacts"
TMP_DIR="$(mktemp -d)"
trap 'rm -rf "$TMP_DIR"' EXIT

CONTRACTS=(
  "arka:arka.wasm"
  "arka-factory:arka-factory.wasm"
  "arka-registry:arka-registry.wasm"
  "oracle-guard:oracle-guard.wasm"
  "router:router.wasm"
  "token:test-token.wasm"
  "venue-registry:venue-registry.wasm"
)

mkdir -p "$ROOT_DIR/src/generated"

for ENTRY in "${CONTRACTS[@]}"; do
  NAME="${ENTRY%%:*}"
  WASM_FILE="${ENTRY#*:}"
  WASM_PATH="$ARTIFACTS_DIR/$WASM_FILE"
  if [[ ! -f "$WASM_PATH" ]]; then
    echo "Missing wasm artifact: $WASM_PATH" >&2
    exit 1
  fi

  OUT_DIR="$TMP_DIR/$NAME"
  stellar contract bindings typescript \
    --wasm "$WASM_PATH" \
    --output-dir "$OUT_DIR" \
    --overwrite >/dev/null

  cp "$OUT_DIR/src/index.ts" "$ROOT_DIR/src/generated/$NAME.ts"
done

echo "Generated bindings refreshed in $ROOT_DIR/src/generated"
