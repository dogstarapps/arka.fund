#!/usr/bin/env bash
set -euo pipefail

export PATH="$HOME/.cargo/bin:$PATH"
NETWORK_PASSPHRASE="${NETWORK_PASSPHRASE:-Test SDF Network ; September 2015}"
RPC_URL="${RPC_URL:-https://soroban-testnet.stellar.org}"
ADMIN_SECRET="${ADMIN_SECRET:-}"
ADMIN_ADDRESS="${ADMIN_ADDRESS:-}"
DEPLOY_JSON="$(cd "$(dirname "$0")/.." && pwd)/deployments.${NETWORK:-testnet}.json"

if [[ -z "$ADMIN_SECRET" || -z "$ADMIN_ADDRESS" ]]; then
  echo "❌ ADMIN_SECRET and ADMIN_ADDRESS are required"; exit 1
fi
if [[ ! -f "$DEPLOY_JSON" ]]; then echo "❌ Deployments file not found: $DEPLOY_JSON"; exit 1; fi

FACTORY_ID=$(jq -r '.contracts.arkaFactory' "$DEPLOY_JSON")
echo "FACTORY_ID=$FACTORY_ID"

echo "🚀 Deploying Votes (admin=user)..."
VOTES_ID=$(stellar contract deploy \
  --wasm "$(cd "$(dirname "$0")/.." && pwd)/artifacts/votes.wasm" \
  --source-account "$ADMIN_SECRET" \
  --rpc-url "$RPC_URL" \
  --network-passphrase "$NETWORK_PASSPHRASE" | tail -n1)
echo "VOTES_ID=$VOTES_ID"

echo "⚙️ Initializing Votes (admin=user)..."
stellar contract invoke \
  --id "$VOTES_ID" \
  --source-account "$ADMIN_SECRET" \
  --rpc-url "$RPC_URL" \
  --network-passphrase "$NETWORK_PASSPHRASE" \
  -- initialize \
  --admin "$ADMIN_ADDRESS" \
  --governor "$ADMIN_ADDRESS" \
  --decimal 7 \
  --name "Arka Votes (User)" \
  --symbol "ARKVU"

echo "🧭 Deploying Governor..."
GOV_ID=$(stellar contract deploy \
  --wasm "$(cd "$(dirname "$0")/.." && pwd)/artifacts/governor.wasm" \
  --source-account "$ADMIN_SECRET" \
  --rpc-url "$RPC_URL" \
  --network-passphrase "$NETWORK_PASSPHRASE" | tail -n1)
echo "GOV_ID=$GOV_ID"

python3 - "$DEPLOY_JSON" "$VOTES_ID" "$GOV_ID" <<'PY'
import json,sys
p,v,g=sys.argv[1:]
with open(p) as f: d=json.load(f)
d['contracts']['votes']=v
d['contracts']['governor']=g
with open(p,'w') as f: json.dump(d,f,indent=2)
print('OK',v,g)
PY

echo "⚙️ Initializing Governor (initialize_simple)..."
stellar contract invoke \
  --id "$GOV_ID" \
  --source-account "$ADMIN_SECRET" \
  --rpc-url "$RPC_URL" \
  --network-passphrase "$NETWORK_PASSPHRASE" \
  -- initialize_simple \
  --votes "$VOTES_ID" \
  --council "$ADMIN_ADDRESS" \
  --proposal_threshold 1 \
  --vote_delay 0 \
  --vote_period 720 \
  --timelock 0 \
  --grace_period 17280 \
  --quorum 100 \
  --counting_type 5 \
  --vote_threshold 5100

echo "💸 Minting 1 voting unit to admin..."
stellar contract invoke \
  --id "$VOTES_ID" \
  --source-account "$ADMIN_SECRET" \
  --rpc-url "$RPC_URL" \
  --network-passphrase "$NETWORK_PASSPHRASE" \
  -- mint \
  --to "$ADMIN_ADDRESS" \
  --amount 1

echo "📜 Submitting a simple Council proposal..."
stellar contract invoke \
  --id "$GOV_ID" \
  --source-account "$ADMIN_SECRET" \
  --rpc-url "$RPC_URL" \
  --network-passphrase "$NETWORK_PASSPHRASE" \
  -- propose \
  --creator "$ADMIN_ADDRESS" \
  --title "Bootstrap Council" \
  --description "Set council to admin" \
  --action '{"Council":"'$ADMIN_ADDRESS'"}'

echo "✅ Bootstrap complete"

