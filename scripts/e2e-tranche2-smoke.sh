#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"

echo "== Tranche 2 Smoke E2E =="
echo "Running idempotent testnet scripts..."

bash "$ROOT_DIR/scripts/e2e-coverage-vault.sh"
bash "$ROOT_DIR/scripts/e2e-coverage-fund.sh"
bash "$ROOT_DIR/scripts/e2e-manager-tier.sh"
NETWORK="${NETWORK:-testnet}" HOLDER_ALIAS="${HOLDER_ALIAS:-arka-holder}" bash "$ROOT_DIR/scripts/soroswap/e2e.sh"
NETWORK="${NETWORK:-testnet}" HOLDER_ALIAS="${HOLDER_ALIAS:-arka-holder}" bash "$ROOT_DIR/scripts/aquarius/e2e.sh"
bash "$ROOT_DIR/scripts/e2e-adapter-blend.sh"
bash "$ROOT_DIR/scripts/e2e-governor-snapshot.sh"
bash "$ROOT_DIR/scripts/e2e-governed-policy.sh"

if [[ "${RUN_GOVERNED_MIGRATION_SMOKE:-0}" == "1" ]]; then
  bash "$ROOT_DIR/scripts/e2e-arka-migration.sh"
fi

echo "== Tranche 2 Smoke E2E complete =="
