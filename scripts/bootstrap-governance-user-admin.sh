#!/usr/bin/env bash
set -euo pipefail

export PATH="$HOME/.cargo/bin:$PATH"
NETWORK_PASSPHRASE="${NETWORK_PASSPHRASE:-Test SDF Network ; September 2015}"
RPC_URL="${RPC_URL:-https://soroban-testnet.stellar.org}"
ADMIN_SECRET="${ADMIN_SECRET:-}"
ADMIN_ADDRESS="${ADMIN_ADDRESS:-}"
GOV_VOTE_DELAY="${GOV_VOTE_DELAY:-0}"
GOV_VOTE_PERIOD="${GOV_VOTE_PERIOD:-10}"
GOV_TIMELOCK="${GOV_TIMELOCK:-5}"
GOV_GRACE_PERIOD="${GOV_GRACE_PERIOD:-20}"
GOV_QUORUM="${GOV_QUORUM:-100}"
GOV_COUNTING_TYPE="${GOV_COUNTING_TYPE:-5}"
GOV_VOTE_THRESHOLD="${GOV_VOTE_THRESHOLD:-5100}"
GOV_PROPOSAL_THRESHOLD="${GOV_PROPOSAL_THRESHOLD:-1}"
DEPLOY_JSON="$(cd "$(dirname "$0")/.." && pwd)/deployments.${NETWORK:-testnet}.json"

if [[ -z "$ADMIN_SECRET" || -z "$ADMIN_ADDRESS" ]]; then
  echo "❌ ADMIN_SECRET and ADMIN_ADDRESS are required"; exit 1
fi
if [[ ! -f "$DEPLOY_JSON" ]]; then echo "❌ Deployments file not found: $DEPLOY_JSON"; exit 1; fi

FACTORY_ID=$(jq -r '.contracts.arkaFactory' "$DEPLOY_JSON")
echo "FACTORY_ID=$FACTORY_ID"

echo "🚀 Deploying Votes..."
VOTES_ID=$(stellar contract deploy \
  --wasm "$(cd "$(dirname "$0")/.." && pwd)/artifacts/votes.wasm" \
  --source-account "$ADMIN_SECRET" \
  --rpc-url "$RPC_URL" \
  --network-passphrase "$NETWORK_PASSPHRASE" | tail -n1)
echo "VOTES_ID=$VOTES_ID"

echo "🧭 Deploying Governor..."
GOV_ID=$(stellar contract deploy \
  --wasm "$(cd "$(dirname "$0")/.." && pwd)/artifacts/governor.wasm" \
  --source-account "$ADMIN_SECRET" \
  --rpc-url "$RPC_URL" \
  --network-passphrase "$NETWORK_PASSPHRASE" | tail -n1)
echo "GOV_ID=$GOV_ID"

python3 - "$DEPLOY_JSON" "$VOTES_ID" "$GOV_ID" "$GOV_TIMELOCK" "$GOV_VOTE_DELAY" "$GOV_VOTE_PERIOD" "$GOV_GRACE_PERIOD" <<'PY'
import json,sys
p,v,g,timelock,vote_delay,vote_period,grace_period=sys.argv[1:]
with open(p) as f: d=json.load(f)
d['contracts']['votes']=v
d['contracts']['governor']=g
d.setdefault('governance', {})
d['governance']['timelockDelay']=int(timelock)
d['governance']['voteDelay']=int(vote_delay)
d['governance']['votePeriod']=int(vote_period)
d['governance']['gracePeriod']=int(grace_period)
with open(p,'w') as f: json.dump(d,f,indent=2)
print('OK',v,g,timelock)
PY

echo "⚙️ Initializing Votes (admin=user, governor=deployed governor)..."
stellar contract invoke \
  --id "$VOTES_ID" \
  --source-account "$ADMIN_SECRET" \
  --rpc-url "$RPC_URL" \
  --network-passphrase "$NETWORK_PASSPHRASE" \
  -- initialize \
  --admin "$ADMIN_ADDRESS" \
  --governor "$GOV_ID" \
  --decimal 7 \
  --name "Arka Votes (User)" \
  --symbol "ARKVU"

echo "⚙️ Initializing Governor (initialize_simple with timelock delay=$GOV_TIMELOCK)..."
stellar contract invoke \
  --id "$GOV_ID" \
  --source-account "$ADMIN_SECRET" \
  --rpc-url "$RPC_URL" \
  --network-passphrase "$NETWORK_PASSPHRASE" \
  -- initialize_simple \
  --votes "$VOTES_ID" \
  --council "$ADMIN_ADDRESS" \
  --proposal_threshold "$GOV_PROPOSAL_THRESHOLD" \
  --vote_delay "$GOV_VOTE_DELAY" \
  --vote_period "$GOV_VOTE_PERIOD" \
  --timelock "$GOV_TIMELOCK" \
  --grace_period "$GOV_GRACE_PERIOD" \
  --quorum "$GOV_QUORUM" \
  --counting_type "$GOV_COUNTING_TYPE" \
  --vote_threshold "$GOV_VOTE_THRESHOLD"

echo "💸 Minting 1 voting unit to admin..."
stellar contract invoke \
  --id "$VOTES_ID" \
  --source-account "$ADMIN_SECRET" \
  --rpc-url "$RPC_URL" \
  --network-passphrase "$NETWORK_PASSPHRASE" \
  -- mint \
  --to "$ADMIN_ADDRESS" \
  --amount 1

echo "📜 Submitting a simple snapshot proposal..."
stellar contract invoke \
  --id "$GOV_ID" \
  --source-account "$ADMIN_SECRET" \
  --rpc-url "$RPC_URL" \
  --network-passphrase "$NETWORK_PASSPHRASE" \
  -- propose_snapshot_self \
  --creator "$ADMIN_ADDRESS"

echo "ℹ️ Timelock in soroban-governor is a Governor delay parameter, not a separate contract."
echo "✅ Bootstrap complete"
