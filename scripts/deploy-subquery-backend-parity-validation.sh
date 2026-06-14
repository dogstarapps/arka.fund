#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
SERVICE_DIR="$ROOT_DIR/services/catalog-api"
DEPLOY_JSON="${DEPLOY_JSON:-$ROOT_DIR/deployments.testnet.json}"
OUT_JSON="${OUT_JSON:-$ROOT_DIR/tmp/subquery-backend-parity.json}"
RPC_URL="${VALIDATION_RPC_URL:-https://soroban-testnet.stellar.org}"
NETWORK_PASSPHRASE="${VALIDATION_NETWORK_PASSPHRASE:-Test SDF Network ; September 2015}"

mkdir -p "$(dirname "$OUT_JSON")"

echo "1) Build catalog-api"
(cd "$SERVICE_DIR" && npm run build >/dev/null)

echo "2) Validate native vs SubQuery-compatible GraphQL backend parity against canonical testnet registry"
node "$SERVICE_DIR/scripts/graphql-parity-validation.mjs" \
  --deploy-json "$DEPLOY_JSON" \
  --out-json "$OUT_JSON" \
  --rpc-url "$RPC_URL" \
  --network-passphrase "$NETWORK_PASSPHRASE" \
  --graphql-profile "subquery" \
  --mirror-profile "subquery" \
  --validation-key "subqueryBackendParity" \
  --update-deployments

echo "SubQuery-compatible backend parity validation written to $OUT_JSON"
