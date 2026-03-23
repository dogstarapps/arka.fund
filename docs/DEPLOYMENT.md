# Arkafund Deployment Guide (Testnet)

This guide documents the current testnet deployment flow for the contract repository.

## Prerequisites

- `stellar` CLI v23+
- Rust toolchain with `wasm32-unknown-unknown`
- funded testnet admin account
- `jq`

## 1) Build WASM Artifacts

```bash
bash scripts/build-wasm.sh
ls artifacts
```

## 2) Deploy Core Contracts

```bash
export NETWORK=testnet
export RPC_URL="https://soroban-testnet.stellar.org"
export NETWORK_PASSPHRASE="Test SDF Network ; September 2015"
export ADMIN_ADDRESS="G..."
export ADMIN_SECRET="S..."

bash scripts/deploy.sh
```

This writes `deployments.testnet.json` with the core contract IDs.

## 3) Bootstrap Governance

The current governance model uses `votes` plus `governor`, with a non-zero execution delay configured on the Governor.

```bash
bash scripts/bootstrap-governance-user-admin.sh
```

This script:

- deploys `votes.wasm`
- deploys `governor.wasm`
- initializes the votes contract
- initializes the Governor with a non-zero execution delay
- persists the resulting contract IDs and governance parameters to `deployments.testnet.json`

## 4) Initialize the Factory

```bash
export CREATE_FIRST_ARKA=false
bash scripts/init-factory.sh
```

This installs the `arka.wasm` hash in the factory and sets the current implementation.

## 5) Validate Live Flows

The repository includes reproducible testnet validation helpers for the main public contract surface:

```bash
bash scripts/e2e-governed-policy.sh
bash scripts/e2e-arka-migration.sh
bash scripts/e2e-coverage-vault.sh
bash scripts/e2e-coverage-fund.sh
bash scripts/e2e-manager-tier.sh
bash scripts/e2e-adapter-balanced.sh
bash scripts/e2e-adapter-blend.sh
bash scripts/deploy-create-live-validation.sh
bash scripts/deploy-deposit-redeem-live-validation.sh
bash scripts/deploy-rebalance-live-validation.sh
bash scripts/deploy-governance-live-validation.sh
bash scripts/deploy-blend-live-validation.sh
```

## 6) Contract IDs and Runbooks

- Canonical deployment metadata: `deployments.testnet.json`
- Canonical validation log: `docs/TRANCHE2_EXECUTION.md`
- Governance model and flow: `docs/GOVERNANCE.md`

## Notes

- The current validation flow does not use a separate Timelock contract.
- Some protocol integrations remain experimental and are not part of the current validated surface. See `docs/REPO_SCOPE.md`.
