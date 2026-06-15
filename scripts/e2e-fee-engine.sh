#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
CONTRACTS_DIR="$ROOT_DIR/contracts"

echo "== Fee Engine Validation =="
pushd "$CONTRACTS_DIR" >/dev/null

echo "1) Unit tests for deterministic profit adapter"
cargo test -p test-profit-adapter --tests

echo "2) Management fee integration surface"
cargo test -p arka --test fee_engine_integration

echo "3) End-to-end local fee ownership and redeem invariants"
cargo test -p arka --test fee_engine_e2e

echo "4) Real-token/router live-path integration"
cargo test -p arka --test fee_engine_live_validation

popd >/dev/null
echo "== Fee Engine Validation complete =="
