#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
TMP_DIR="$(mktemp -d)"
trap 'rm -rf "$TMP_DIR"' EXIT

TMP_DEPLOYMENTS="$TMP_DIR/deployments.json"
OUT_JSON="${OUT_JSON:-$ROOT_DIR/tmp/storage-lifecycle-e2e.json}"
cp "$ROOT_DIR/deployments.testnet.json" "$TMP_DEPLOYMENTS"

python3 "$ROOT_DIR/scripts/storage_lifecycle_extend.py" \
  --deployments "$TMP_DEPLOYMENTS" \
  --out-json "$OUT_JSON" \
  --dry-run \
  --strict \
  --update-deployments

python3 - "$OUT_JSON" "$TMP_DEPLOYMENTS" <<'PY'
import json
import sys
from pathlib import Path

out_path = Path(sys.argv[1])
deployments_path = Path(sys.argv[2])
out = json.loads(out_path.read_text(encoding="utf-8"))
deployments = json.loads(deployments_path.read_text(encoding="utf-8"))

assert out["status"] == "dry_run", out
assert out["targetsCount"] > 0, out
assert all(item["status"] == "dry_run" for item in out["results"]), out
validation = deployments.get("validations", {}).get("storageLifecycle")
assert validation, deployments
assert validation.get("status") == "dry_run", validation
assert len(validation.get("extendedContracts", [])) == out["targetsCount"], validation
print("storage-lifecycle e2e OK")
PY
