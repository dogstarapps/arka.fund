#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
DEPLOY_JSON="${DEPLOY_JSON:-$ROOT_DIR/deployments.testnet.json}"
OUT_JSON="${OUT_JSON:-$ROOT_DIR/tmp/canonical-registry-migration.json}"
RPC_URL="${VALIDATION_RPC_URL:-$(python3 - <<'PY' "$DEPLOY_JSON"
import json, sys
with open(sys.argv[1], 'r', encoding='utf-8') as fh:
    print(json.load(fh).get('rpcUrl', 'https://soroban-testnet.stellar.org'))
PY
)}"
NETWORK_PASSPHRASE="${VALIDATION_NETWORK_PASSPHRASE:-Test SDF Network ; September 2015}"
ADMIN_IDENTITY="${ADMIN_IDENTITY:-arka-admin}"
REGISTRY_WASM_PATH="${REGISTRY_WASM_PATH:-$ROOT_DIR/artifacts/arka-registry.wasm}"
CURATION_MANIFEST="${CURATION_MANIFEST:-}"

mkdir -p "$(dirname "$OUT_JSON")"

if [[ ! -f "$REGISTRY_WASM_PATH" ]]; then
  bash "$ROOT_DIR/scripts/build-wasm.sh" >/dev/null
fi

ARGS=(
  "$ROOT_DIR/scripts/canonical_registry_migration.py"
  --deploy-json "$DEPLOY_JSON"
  --out-json "$OUT_JSON"
  --rpc-url "$RPC_URL"
  --network-passphrase "$NETWORK_PASSPHRASE"
  --admin-identity "$ADMIN_IDENTITY"
  --registry-wasm-path "$REGISTRY_WASM_PATH"
  --promote
)

if [[ -n "$CURATION_MANIFEST" ]]; then
  ARGS+=(--curation-manifest "$CURATION_MANIFEST")
fi

python3 "${ARGS[@]}"

echo "2) Revalidate packaged off-chain stack against canonical registry"
bash "$ROOT_DIR/scripts/deploy-offchain-testnet-stack.sh"

echo "Canonical registry migration and off-chain validation completed."
