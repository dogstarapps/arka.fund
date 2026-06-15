#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

python3 "$ROOT_DIR/scripts/verify_balanced_official_surface.py" \
  --deployments "$ROOT_DIR/deployments.testnet.json" \
  --out-json "$ROOT_DIR/tmp/balanced-official-surface.json" \
  --update-deployments
