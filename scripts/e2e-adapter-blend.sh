#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"

echo "Blend adapter E2E now delegates to the canonical live validation runbook."
exec bash "$ROOT_DIR/scripts/deploy-blend-live-validation.sh"
