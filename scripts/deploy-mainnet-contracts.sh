#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
MANIFEST="${MANIFEST:-$ROOT_DIR/deployments.mainnet.json}"
CONFIRM_VALUE="deploy-arka-mainnet"

if [[ "${CONFIRM_MAINNET_DEPLOY:-}" != "$CONFIRM_VALUE" ]]; then
  echo "Refusing mainnet deploy. Set CONFIRM_MAINNET_DEPLOY=$CONFIRM_VALUE to continue." >&2
  exit 1
fi

SECRET_ENV="$(jq -r '.admin.secretEnvVar' "$MANIFEST")"
ADMIN_SECRET="${!SECRET_ENV:-}"
if [[ -z "$ADMIN_SECRET" && -f "$HOME/.zshrc" ]]; then
  ADMIN_SECRET="$(SECRET_ENV="$SECRET_ENV" zsh -lc 'source "$HOME/.zshrc" >/dev/null 2>&1 || true; eval "printf %s \"\${$SECRET_ENV:-}\""' 2>/dev/null || true)"
fi
if [[ -z "$ADMIN_SECRET" ]]; then
  echo "Missing admin secret env var: $SECRET_ENV" >&2
  exit 1
fi
export "$SECRET_ENV=$ADMIN_SECRET"

RPC_URL="$(jq -r '.rpcUrl' "$MANIFEST")"
NETWORK_PASSPHRASE="$(jq -r '.networkPassphrase' "$MANIFEST")"

python3 "$ROOT_DIR/scripts/validate_mainnet_manifest.py" \
  --manifest "$MANIFEST" \
  --phase predeploy \
  --check-env

if [[ "${SKIP_BUILD:-false}" != "true" ]]; then
  BUILD_CONTRACT_SET=production bash "$ROOT_DIR/scripts/build-wasm.sh"
  python3 "$ROOT_DIR/scripts/validate_mainnet_manifest.py" \
    --manifest "$MANIFEST" \
    --phase predeploy \
    --check-env
fi

tmp_json() {
  mktemp "${TMPDIR:-/tmp}/arka-mainnet.XXXXXX.json"
}

json_update() {
  local filter="$1"
  shift
  local tmp
  tmp="$(tmp_json)"
  jq "$@" "$filter" "$MANIFEST" > "$tmp"
  mv "$tmp" "$MANIFEST"
}

HASH_TSV="$(mktemp "${TMPDIR:-/tmp}/arka-mainnet-hashes.XXXXXX")"
: >"$HASH_TSV"

lookup_wasm_hash() {
  local artifact="$1"
  awk -F '\t' -v artifact="$artifact" '$1 == artifact { print $2; found = 1; exit } END { if (!found) exit 1 }' "$HASH_TSV"
}

echo "Uploading unique production WASM artifacts..."
while IFS= read -r artifact; do
  [[ -n "$artifact" ]] || continue
  existing_hash="$(jq -r --arg artifact "$artifact" '.uploadedArtifacts[$artifact] // empty' "$MANIFEST")"
  if [[ "$existing_hash" =~ ^[0-9a-fA-F]{64}$ ]]; then
    echo "  reuse $artifact"
    printf '%s\t%s\n' "$artifact" "$existing_hash" >>"$HASH_TSV"
    continue
  fi
  wasm_path="$ROOT_DIR/$artifact"
  echo "  upload $artifact"
  wasm_hash="$(stellar contract upload \
    --wasm "$wasm_path" \
    --source-account "$ADMIN_SECRET" \
    --rpc-url "$RPC_URL" \
    --network-passphrase "$NETWORK_PASSPHRASE" \
    | tail -n1)"
  if [[ ! "$wasm_hash" =~ ^[0-9a-fA-F]{64}$ ]]; then
    echo "Upload did not return a wasm hash for $artifact: $wasm_hash" >&2
    exit 1
  fi
  printf '%s\t%s\n' "$artifact" "$wasm_hash" >>"$HASH_TSV"
  json_update '.uploadedArtifacts[$artifact] = $hash' \
    --arg artifact "$artifact" \
    --arg hash "$wasm_hash"
done < <(jq -r '.deploymentPlan.contracts[].artifact' "$MANIFEST" | sort -u)

echo "Recording uploaded hashes by planned contract name..."
while IFS=$'\t' read -r name artifact; do
  hash="$(lookup_wasm_hash "$artifact")"
  json_update '.wasmHashes[$name] = $hash' \
    --arg name "$name" \
    --arg hash "$hash"
done < <(jq -r '.deploymentPlan.contracts[] | [.name, .artifact] | @tsv' "$MANIFEST")

echo "Deploying planned singleton/adapter instances..."
while IFS=$'\t' read -r name artifact; do
  existing_contract="$(jq -r --arg name "$name" '.contracts[$name] // empty' "$MANIFEST")"
  if [[ "$existing_contract" =~ ^C[A-Z2-7]{55}$ ]]; then
    echo "  reuse $name $existing_contract"
    continue
  fi
  hash="$(lookup_wasm_hash "$artifact")"
  echo "  deploy $name from $artifact"
  contract_id="$(stellar contract deploy \
    --wasm-hash "$hash" \
    --source-account "$ADMIN_SECRET" \
    --rpc-url "$RPC_URL" \
    --network-passphrase "$NETWORK_PASSPHRASE" \
    | tail -n1)"
  if [[ ! "$contract_id" =~ ^C[A-Z2-7]{55}$ ]]; then
    echo "Deploy did not return a contract id for $name: $contract_id" >&2
    exit 1
  fi
  json_update '.contracts[$name] = $contract' \
    --arg name "$name" \
    --arg contract "$contract_id"
done < <(jq -r '.deploymentPlan.contracts[] | select(.deploy == true) | [.name, .artifact] | @tsv' "$MANIFEST")

json_update '
  .status = "deployed_unconfigured"
  | .updatedAt = (now | todate)
  | .validations.contractsDeployed = true
  | .validations.contractsConfigured = false
' 

echo "Mainnet contracts deployed and manifest updated. Run scripts/configure-mainnet-contracts.sh next."
