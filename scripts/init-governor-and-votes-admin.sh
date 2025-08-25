#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
DEPLOY_JSON="$ROOT_DIR/deployments.${NETWORK:-testnet}.json"

export PATH="$HOME/.cargo/bin:$PATH"
RPC_URL="${RPC_URL:-https://soroban-testnet.stellar.org}"
NETWORK_PASSPHRASE="${NETWORK_PASSPHRASE:-Test SDF Network ; September 2015}"
ADMIN_SECRET="${ADMIN_SECRET:-}"

if [[ -z "$ADMIN_SECRET" ]]; then
  echo "❌ ADMIN_SECRET is required"; exit 1
fi

if [[ ! -f "$DEPLOY_JSON" ]]; then
  echo "❌ Deployments file not found: $DEPLOY_JSON"; exit 1
fi

FACTORY_ID=$(jq -r '.contracts.arkaFactory' "$DEPLOY_JSON")
GOV_ID=$(jq -r '.contracts.governor' "$DEPLOY_JSON")
echo "FACTORY_ID=$FACTORY_ID"
echo "GOV_ID=$GOV_ID"

echo "🚀 Deploying admin-mode Votes..."
VOTES_ID=$(stellar contract deploy \
  --wasm "$ROOT_DIR/artifacts/votes.wasm" \
  --source-account "$ADMIN_SECRET" \
  --rpc-url "$RPC_URL" \
  --network-passphrase "$NETWORK_PASSPHRASE" | tail -n1)
echo "VOTES_ID=$VOTES_ID"

echo "💾 Updating deployments file with new Votes ID..."
python3 - <<PY
import json
p = r"$DEPLOY_JSON"
with open(p) as f:
    d = json.load(f)
d["contracts"]["votes"] = "$VOTES_ID"
with open(p, "w") as f:
    json.dump(d, f, indent=2)
print("OK", d["contracts"]["votes"])
PY

echo "⚙️ Initializing Votes (admin mode)..."
stellar contract invoke \
  --id "$VOTES_ID" \
  --source-account "$ADMIN_SECRET" \
  --rpc-url "$RPC_URL" \
  --network-passphrase "$NETWORK_PASSPHRASE" \
  -- initialize \
  --admin "$FACTORY_ID" \
  --governor "$GOV_ID" \
  --decimal 7 \
  --name "Arka Votes" \
  --symbol "ARKV"

echo "📝 Writing Governor settings JSON..."
SETTINGS_FILE="/tmp/governor_settings.json"
cat > "$SETTINGS_FILE" <<JSON
{"proposal_threshold":1,"vote_delay":0,"vote_period":10,"timelock":5,"grace_period":20,"quorum":1000,"counting_type":5,"vote_threshold":5000}
JSON

echo "⚙️ Initializing Governor..."
stellar contract invoke \
  --id "$GOV_ID" \
  --source-account "$ADMIN_SECRET" \
  --rpc-url "$RPC_URL" \
  --network-passphrase "$NETWORK_PASSPHRASE" \
  -- initialize \
  --votes "$VOTES_ID" \
  --council "$FACTORY_ID" \
  --settings-file-path "$SETTINGS_FILE"

echo "🔍 Verifying Governor settings..."
stellar contract invoke \
  --id "$GOV_ID" \
  --source-account "$ADMIN_SECRET" \
  --rpc-url "$RPC_URL" \
  --network-passphrase "$NETWORK_PASSPHRASE" \
  -- settings

echo "✅ Done"


