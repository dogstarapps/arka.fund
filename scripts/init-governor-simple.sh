#!/usr/bin/env bash
set -euo pipefail

export PATH="$HOME/.cargo/bin:$PATH"

NETWORK_PASSPHRASE="${NETWORK_PASSPHRASE:-Test SDF Network ; September 2015}"
RPC_URL="${RPC_URL:-https://soroban-testnet.stellar.org}"
ADMIN_SECRET="${ADMIN_SECRET:-}"
DEPLOY_JSON="$(cd "$(dirname "$0")/.." && pwd)/deployments.${NETWORK:-testnet}.json"

if [[ -z "$ADMIN_SECRET" ]]; then echo "ADMIN_SECRET required"; exit 1; fi
if [[ ! -f "$DEPLOY_JSON" ]]; then echo "Deployments file not found: $DEPLOY_JSON"; exit 1; fi

FACTORY_ID=$(jq -r '.contracts.arkaFactory' "$DEPLOY_JSON")
VOTES_ID=$(jq -r '.contracts.votes' "$DEPLOY_JSON")
echo "FACTORY_ID=$FACTORY_ID"
echo "VOTES_ID=$VOTES_ID"

echo "Deploying new governor..."
GOV_NEW=$(stellar contract deploy \
  --wasm "$(cd "$(dirname "$0")/.." && pwd)/artifacts/governor.wasm" \
  --source-account "$ADMIN_SECRET" \
  --rpc-url "$RPC_URL" \
  --network-passphrase "$NETWORK_PASSPHRASE" | tail -n1)
echo "GOV_NEW=$GOV_NEW"

echo "Updating deployments file..."
python3 - "$DEPLOY_JSON" "$GOV_NEW" <<'PY'
import json,sys
p=sys.argv[1]; g=sys.argv[2]
with open(p) as f: d=json.load(f)
d['contracts']['governor']=g
with open(p,'w') as f: json.dump(d,f,indent=2)
print('OK',d['contracts']['governor'])
PY

echo "Initializing governor (initialize_simple)..."
stellar contract invoke \
  --id "$GOV_NEW" \
  --source-account "$ADMIN_SECRET" \
  --rpc-url "$RPC_URL" \
  --network-passphrase "$NETWORK_PASSPHRASE" \
  -- initialize_simple \
  --votes "$VOTES_ID" \
  --council "$FACTORY_ID" \
  --proposal_threshold 1 \
  --vote_delay 0 \
  --vote_period 720 \
  --timelock 17280 \
  --grace_period 17280 \
  --quorum 100 \
  --counting_type 5 \
  --vote_threshold 5100

echo "Point factory to new governor..."
stellar contract invoke \
  --id "$FACTORY_ID" \
  --source-account "$ADMIN_SECRET" \
  --rpc-url "$RPC_URL" \
  --network-passphrase "$NETWORK_PASSPHRASE" \
  -- set_governor \
  --governor "$GOV_NEW"

echo "Verify governor settings..."
stellar contract invoke \
  --id "$GOV_NEW" \
  --source-account "$ADMIN_SECRET" \
  --rpc-url "$RPC_URL" \
  --network-passphrase "$NETWORK_PASSPHRASE" \
  -- settings

echo "Done"


