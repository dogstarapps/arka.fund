#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
CONTRACTS_DIR="$ROOT_DIR/contracts"

echo "== Oracle Guard Validation =="
pushd "$CONTRACTS_DIR" >/dev/null

echo "1) Unit and public API integration tests"
cargo test -p test-oracle -p oracle-guard --tests

echo "2) Vault integration using secondary-feed fallback"
cargo test -p arka test_oracle_guard_uses_secondary_feed_for_divergent_borrow_asset -- --nocapture

echo "3) Vault fail-closed behavior on divergent feeds"
cargo test -p arka test_oracle_guard_fail_closed_blocks_divergent_borrow_asset -- --nocapture

popd >/dev/null
echo "== Oracle Guard Validation complete =="
