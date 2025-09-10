# Arka.fund Governance


## ---- FILE: ## Arka.fund Governance Wiring (Script3 Governor + Timelock) ----

## Arka.fund Governance Wiring (Script3 Governor + Timelock)

High-level goal: Use our own governance token to power voting in Script3 Soroban Governor, execute via Timelock, and gate `arka-factory` admin functions behind Timelock auth.

### Components
- `governance-token`: Custom token for voting power (can be replaced with staking/lock wrapper later).
- `soroban-governor`: Script3 Governor contract (external deployment).
- `soroban-timelock`: Script3 Timelock contract (external deployment).
- `arka-factory`: Admin calls (`set_implementation`, `create_arka`) are restricted to an admin Address (set to Timelock).

### Steps
1) Deploy Governance Token
   - Deploy `governance-token` WASM
   - Call `init(admin = deployer)`
   - Mint initial supply to treasury/multisig wallets

2) Deploy Governor + Timelock (from Script3 repo)
   - Governor config: quorum, voting delays/periods, proposal threshold
   - Point Governor to governance-token for voting power
   - Deploy Timelock, set Governor as proposer/executor as per Script3 docs

3) Wire Factory Admin to Timelock
   - Deploy `arka-factory` WASM
   - Call `set_governor(timelock_address)` (admin = Timelock)
   - Upload `arka` logic WASM; obtain `wasm_hash`
   - From Governor → queue to Timelock → execute `set_implementation(wasm_hash)` on Factory

4) Use Governance to manage upgrades/creations
   - Propose `create_arka(salt)` via Governor → Timelock executes on Factory
   - Propose upgrades with new `wasm_hash`

Notes
- In `arka-factory`, admin functions require `require_auth(admin)`, so only the Timelock can call them.
- For staking/escrow voting, replace `governance-token` with a wrapper contract and point Governor to that.




## ---- FILE: # Arkafund Governance Runbook (Testnet) ----

# Arkafund Governance Runbook (Testnet)

This runbook documents how to deploy and initialize Script3 Governor + Votes and wire `arka-factory` on Soroban testnet.

## Prerequisites
- `stellar` CLI v23+
- Rust toolchain with `wasm32-unknown-unknown`
- Funded testnet admin key

## Environment
Export these in your shell:

```bash
export NETWORK_PASSPHRASE="Test SDF Network ; September 2015"
export RPC_URL=https://soroban-testnet.stellar.org
export ADMIN_ADDRESS=G...   # your testnet public key
export ADMIN_SECRET=S...    # your testnet secret key
```

## Deploy core contracts
```bash
bash arkafund/scripts/build-wasm.sh
bash arkafund/scripts/deploy.sh
# Writes arkafund/deployments.testnet.json
```

## Deploy Votes and Governor
```bash
bash arkafund/scripts/deploy-governor.sh
# Updates deployments.testnet.json with .contracts.votes and .contracts.governor
```

## Inspect function signatures (recommended)
```bash
stellar contract invoke \
  --id $(jq -r '.contracts.votes' arkafund/deployments.testnet.json) \
  --source-account "$ADMIN_SECRET" \
  --rpc-url "$RPC_URL" \
  --network-passphrase "$NETWORK_PASSPHRASE" \
  -- --help

stellar contract invoke \
  --id $(jq -r '.contracts.governor' arkafund/deployments.testnet.json) \
  --source-account "$ADMIN_SECRET" \
  --rpc-url "$RPC_URL" \
  --network-passphrase "$NETWORK_PASSPHRASE" \
  -- --help
```

## Initialize Votes (pick ONE)
- Bonding mode (default features): `initialize(token, governor, name, symbol)`
```bash
UNDERLYING_TOKEN_ID=<token-contract-id>
stellar contract invoke \
  --id $(jq -r '.contracts.votes' arkafund/deployments.testnet.json) \
  --source-account "$ADMIN_SECRET" \
  --rpc-url "$RPC_URL" \
  --network-passphrase "$NETWORK_PASSPHRASE" \
  -- initialize \
  --token "$UNDERLYING_TOKEN_ID" \
  --governor $(jq -r '.contracts.governor' arkafund/deployments.testnet.json) \
  --name "Arka Votes" \
  --symbol "ARKV"
```
- Admin mode (no-default-features build): `initialize(admin, governor, decimal, name, symbol)`
```bash
FACTORY_ID=$(jq -r '.contracts.arkaFactory' arkafund/deployments.testnet.json)
stellar contract invoke \
  --id $(jq -r '.contracts.votes' arkafund/deployments.testnet.json) \
  --source-account "$ADMIN_SECRET" \
  --rpc-url "$RPC_URL" \
  --network-passphrase "$NETWORK_PASSPHRASE" \
  -- initialize \
  --admin "$FACTORY_ID" \
  --governor $(jq -r '.contracts.governor' arkafund/deployments.testnet.json) \
  --decimal 7 \
  --name "Arka Votes" \
  --symbol "ARKV"
```
If you deployed the bonding variant but want admin mode, rebuild and redeploy `soroban-votes` with `--no-default-features`.

## Initialize Governor
The `settings` arg is a struct. Pass it via file path:
```bash
VOTES_ID=$(jq -r '.contracts.votes' arkafund/deployments.testnet.json)
FACTORY_ID=$(jq -r '.contracts.arkaFactory' arkafund/deployments.testnet.json)
GOV_ID=$(jq -r '.contracts.governor' arkafund/deployments.testnet.json)
cat > /tmp/governor_settings.json <<JSON
{"proposal_threshold":"1","vote_delay":0,"vote_period":10,"timelock":5,"grace_period":20,"quorum":1000,"counting_type":5,"vote_threshold":5000}
JSON
stellar contract invoke \
  --id "$GOV_ID" \
  --source-account "$ADMIN_SECRET" \
  --rpc-url "$RPC_URL" \
  --network-passphrase "$NETWORK_PASSPHRASE" \
  -- initialize \
  --votes "$VOTES_ID" \
  --council "$FACTORY_ID" \
  --settings-file-path /tmp/governor_settings.json
```

## Wire Factory admin to Governor
```bash
FACTORY_ID=$(jq -r '.contracts.arkaFactory' arkafund/deployments.testnet.json)
GOV_ID=$(jq -r '.contracts.governor' arkafund/deployments.testnet.json)
stellar contract invoke \
  --id "$FACTORY_ID" \
  --source-account "$ADMIN_SECRET" \
  --rpc-url "$RPC_URL" \
  --network-passphrase "$NETWORK_PASSPHRASE" \
  -- set_governor \
  --governor "$GOV_ID"
```

## Verification
```bash
stellar contract invoke --id $(jq -r '.contracts.votes' arkafund/deployments.testnet.json) --source-account "$ADMIN_SECRET" --rpc-url "$RPC_URL" --network-passphrase "$NETWORK_PASSPHRASE" -- name
stellar contract invoke --id $(jq -r '.contracts.votes' arkafund/deployments.testnet.json) --source-account "$ADMIN_SECRET" --rpc-url "$RPC_URL" --network-passphrase "$NETWORK_PASSPHRASE" -- symbol
stellar contract invoke --id $(jq -r '.contracts.governor' arkafund/deployments.testnet.json) --source-account "$ADMIN_SECRET" --rpc-url "$RPC_URL" --network-passphrase "$NETWORK_PASSPHRASE" -- settings
```

## Troubleshooting
- If `--admin` is rejected in Votes.initialize, you deployed the bonding variant.
- If deployment complains about wasm features, run `stellar contract optimize --wasm <file> --wasm-out <file>` and redeploy.
- Always verify `-- ... --help` for exact named args.

## Known CLI limitations and workarounds

- Passing UDT structs/enums directly on CLI may fail. Prefer:
  - `initialize_simple` (primitive args) for Governor instead of `initialize(settings)`.
  - TypeScript client bindings for complex enum calls; otherwise add helper entrypoints like `propose_snapshot_self(creator)`.
- For programmatic submission (bypassing CLI marshalling), you can generate TS bindings and use JSON-RPC (`sendTransaction` and `getTransaction`) to submit signed XDR.

## Fix for VM trap (InvalidAction) during Snapshot proposals

Symptom:

```
HostError: Error(Auth, InvalidAction)
... error: "contract call failed", set_vote_sequence, [...] (from Votes)
```

Root cause:

- Script3 Governor calls `votes_client.set_vote_sequence(vote_start)` for all proposals, including `Snapshot`. On Snapshot, there is no execution/voting window requirement, and in some wiring modes the call attempts to auth the Votes contract when not strictly necessary, causing `require_auth()` to fail and trap.

Change applied:

- In `vendor/soroban-governor/contracts/governor/src/contract.rs`, skip `set_vote_sequence` for `ProposalAction::Snapshot` only:

```
// Only set the vote sequence for proposals that require voting
match action {
  ProposalAction::Snapshot => {}
  _ => votes_client.set_vote_sequence(&vote_start),
}
```

Deployment steps used:

1) Rebuild vendor governor WASM and optimize
```bash
cargo build -p soroban-governor --release --target wasm32-unknown-unknown
stellar contract optimize --wasm vendor/soroban-governor/target/wasm32-unknown-unknown/release/soroban_governor.wasm \
  --wasm-out arkafund/artifacts/governor.wasm
```
2) Deploy new Governor, initialize with `initialize_simple`, and update `deployments.testnet.json`.

Validation performed:

- Propose Snapshot via helper (CLI):
```bash
stellar contract invoke --id $GOV_ID --source-account $ADMIN_SECRET \
  --rpc-url $RPC_URL --network-passphrase "$NETWORK_PASSPHRASE" \
  --send=yes -- propose_snapshot_self --creator $ADMIN_ADDRESS
```
  - Result: proposal created; ID output `0`.
- Vote:
```bash
stellar contract invoke --id $GOV_ID --source-account $ADMIN_SECRET \
  --rpc-url $RPC_URL --network-passphrase "$NETWORK_PASSPHRASE" \
  --send=yes -- vote --voter $ADMIN_ADDRESS --proposal_id 0 --support 1
```
- Close after `vote_end` (or expect `VotePeriodNotFinishedError` #204 if too early). On retry after the window, close succeeds and Snapshot shows `status` `Successful` or `Expired` depending on timing (Snapshots are non-executable; in tests it closed as `Expired` once `vote_end+grace` had elapsed).

## Using your own vote token

You can manage governance with your own token in two ways:

1) Admin-mode Votes (no underlying token):
   - Build `soroban-votes` with `--no-default-features` and initialize with `initialize(admin, governor, decimal, name, symbol)`.
   - Mint voting units to participants via `mint(to, amount)`; governor thresholds/quorum are measured in these units.

2) Bonding-mode Votes (wrap an existing token):
   - Initialize with `initialize(token, governor, name, symbol)`; holders deposit/withdraw the underlying token to receive voting units. Ensure decimals align and wire the same Governor.

After either mode, always wire Governor via `initialize_simple` and ensure `vote_token()` matches your Votes contract ID.

## End-to-End (Snapshot) workflow

```bash
# 1) Propose Snapshot
stellar contract invoke --id $GOV_ID --source-account $ADMIN_SECRET \
  --rpc-url $RPC_URL --network-passphrase "$NETWORK_PASSPHRASE" \
  --send=yes -- propose_snapshot_self --creator $ADMIN_ADDRESS

# 2) Cast vote (0=Against, 1=For, 2=Abstain)
stellar contract invoke --id $GOV_ID --source-account $ADMIN_SECRET \
  --rpc-url $RPC_URL --network-passphrase "$NETWORK_PASSPHRASE" \
  --send=yes -- vote --voter $ADMIN_ADDRESS --proposal_id <ID> --support 1

# 3) Close after vote_end
stellar contract invoke --id $GOV_ID --source-account $ADMIN_SECRET \
  --rpc-url $RPC_URL --network-passphrase "$NETWORK_PASSPHRASE" \
  --send=yes -- close --proposal_id <ID>

# 4) Inspect proposal
stellar contract invoke --id $GOV_ID --source-account $ADMIN_SECRET \
  --rpc-url $RPC_URL --network-passphrase "$NETWORK_PASSPHRASE" \
  -- get_proposal --proposal_id <ID>
```

Notes:
- If you encounter CLI marshalling issues with enums/UDTs, prefer helper entrypoints or use TS bindings and JSON-RPC to sign/send.
- Ensure Votes shows sufficient `get_votes(creator)` to meet `proposal_threshold`.
