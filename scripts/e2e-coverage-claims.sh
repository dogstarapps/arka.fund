#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
CONTRACTS_DIR="$ROOT_DIR/contracts"

echo "== Coverage + Claims Validation =="
echo "1) coverage-vault unit and contract tests"
cargo test -p coverage-vault --tests --manifest-path "$CONTRACTS_DIR/Cargo.toml"

echo "2) coverage-fund unit, integration, and end-to-end tests"
cargo test -p coverage-fund --tests --manifest-path "$CONTRACTS_DIR/Cargo.toml"

echo "3) claims-manager unit, integration, and end-to-end tests"
cargo test -p claims-manager --tests --manifest-path "$CONTRACTS_DIR/Cargo.toml"

echo "== Coverage + Claims Validation complete =="
