# Arkafund Deployment Guide (Testnet)

All commands, code, and docs are in English.

## Prerequisites
- soroban-cli installed
- Rust toolchain + wasm target: `rustup target add wasm32-unknown-unknown`
- Admin key funded on the target network (for bootstrap)

## 1) Build WASM artifacts
```bash
bash arkafund/scripts/build-wasm.sh
ls arkafund/artifacts
```

## 2) Deploy core contracts
```bash
export NETWORK=testnet
export RPC_URL=https://soroban-testnet.stellar.org
export ADMIN_ADDRESS=G...
export ADMIN_SECRET=S...

bash arkafund/scripts/deploy.sh
# Outputs deployments.testnet.json with contract IDs
```

## 3) Deploy and initialize Governance (Script3 Votes + Governor)
```bash
# Deploy Votes and Governor from artifacts
bash arkafund/scripts/deploy-governor.sh

# Initialize Votes (Admin mode) and Governor
export COUNCIL_ADDRESS=$ADMIN_ADDRESS
export PROPOSAL_THRESHOLD=1
export VOTE_DELAY=0
export VOTE_PERIOD=10
export TIMELOCK=5
export GRACE_PERIOD=20
export QUORUM_BPS=1000
export COUNTING_TYPE=5
export VOTE_THRESHOLD_BPS=5000

bash arkafund/scripts/init-governor.sh
```

## 4) Initialize Factory with Arka logic
```bash
# Optionally create the first Arka by adding CREATE_FIRST_ARKA=true
export CREATE_FIRST_ARKA=false
bash arkafund/scripts/init-factory.sh
```

## 5) Transfer Factory governor to Timelock (Script3)
Deploy Script3 Governor + Timelock (external repo). Once you have the Timelock address:
```bash
export TIMELOCK_ADDRESS=G...
bash arkafund/scripts/transfer-governor-to-timelock.sh
```

## 5) Configure Arka instance (after create_arka)
- Call `init(denomination, fees, whitelist, manager)` on the Arka address
- Then call `set_router(manager, routerAddress)`

Note: CLI encoding for complex types (like `Asset` and `Vec<Asset>`) must follow Soroban CLI SCVal rules (JSON/SCVal). We recommend wiring a small helper script or using a TS/Rust client for this step.

## 6) Next steps
- Integrate Script3 Governor proposals for `set_implementation` and `create_arka` calls via Timelock
- Implement adapters with real protocol ABIs (start with Aquarius)
- Add indexer and monitoring

## Files
- `scripts/build-wasm.sh` — builds all WASMs into `artifacts/`
- `scripts/deploy.sh` — deploys `arka`, `arka-factory`, `router`
- `scripts/deploy-governor.sh` — deploys `votes` and `governor`
- `scripts/init-governor.sh` — initializes `votes` (admin) and `governor`
- `scripts/init-factory.sh` — installs `arka.wasm` hash, sets governor (bootstrap), sets implementation, optional first Arka
- `scripts/transfer-governor-to-timelock.sh` — hands Factory admin to Timelock

