#!/usr/bin/env bash
set -euo pipefail

if [[ "${E2E_ALLOW_TESTNET_MUTATIONS:-}" != "1" ]]; then
  echo "Refusing to run Testnet-mutating E2E preparation without E2E_ALLOW_TESTNET_MUTATIONS=1." >&2
  exit 1
fi

ROOT_DIR="$(cd "$(dirname "$0")/../.." && pwd)"
GOV_SCRIPT="$ROOT_DIR/arkafund/scripts/deploy-governance-live-validation.sh"
REBALANCE_SCRIPT="$ROOT_DIR/arkafund/scripts/deploy-rebalance-live-validation.sh"
export ARKA_WASM_PATH="${ARKA_WASM_PATH:-$ROOT_DIR/arkafund/artifacts/arka.wasm}"

run_with_retry() {
  local label="$1"
  local script_path="$2"
  local attempts="${3:-3}"
  local delay_seconds="${4:-5}"

  local attempt=1
  while (( attempt <= attempts )); do
    if bash "$script_path"; then
      return 0
    fi
    if (( attempt == attempts )); then
      echo "ERROR: $label failed after $attempts attempts" >&2
      return 1
    fi
    echo "WARN: $label failed on attempt $attempt/$attempts, retrying in ${delay_seconds}s..." >&2
    sleep "$delay_seconds"
    attempt=$((attempt + 1))
  done
}

run_with_retry "governance live validation" "$GOV_SCRIPT"
run_with_retry "rebalance live validation" "$REBALANCE_SCRIPT"
