# Arka.fund

Arka.fund is an on-chain asset management protocol built on the Soroban/Stellar network. It lets managers create configurable vaults ("Arkas") with governed policies, share tokenization, and strategy execution across Stellar DeFi integrations such as Aquarius, SoroSwap, Balanced, and Blend.

Depositors enter and exit Arkas through vault shares, while managers operate within on-chain policy constraints around fees, whitelisted assets, and protocol access. Governance is handled through a Soroban Governor-based flow with execution delay for protocol-level actions such as policy updates, implementation changes, and migrations.

## Key Features

*   **Configurable Arkas:** Each vault can define denomination asset, fee policy, allowed assets, manager authority, and share-token settings.
*   **Vault Shares (SAC):** Arkas can mint and burn a dedicated share token per vault on deposit and redeem flows.
*   **DeFi Adapters:** Router/adapter integrations support swap and credit workflows across Aquarius, SoroSwap, Balanced, and Blend.
*   **Coverage and Tiering:** Coverage Vault, Coverage Fund, and Manager Tier modules are included as protocol primitives.
*   **Governed Operations:** Governor-controlled flows cover policy updates, implementation changes, and migrations.
*   **On-chain Transparency:** Deposits, redemptions, rebalances, and credit actions emit contract events and can be reproduced through documented testnet scripts.

## Current Support Matrix

- Core contract and validation coverage in this repository includes `Arka`, `ArkaFactory`, share-token flows, coverage modules, manager tiering, governance, and the validated Aquarius, SoroSwap, Balanced, and Blend integrations.
- `adapter-comet` and `adapter-phoenix` remain in the workspace as experimental integration points and are not part of the current testnet validation matrix.
- Governance uses the vendored `soroban-governor` contract with a non-zero execution delay and no separate Timelock deployment.

## Documentation

- Support matrix and reference guide: `docs/REPO_SCOPE.md`
- Architecture: `docs/ARCHITECTURE.md`
- Deployment: `docs/DEPLOYMENT.md`
- Governance: `docs/GOVERNANCE.md`
- Fees: `docs/FEES.md`
- Security: `docs/SECURITY.md`
- Product surface reference: `docs/UI_SPEC.md`
- Execution and validation log: `docs/TRANCHE2_EXECUTION.md`

## Reproduce E2E (Testnet)

- Prerequisites: Soroban/Stellar CLI v23+, funded testnet key alias (e.g., `arka-holder`).
- Contract IDs and accounts: see `deployments.testnet.json`.
- Full execution log and validated contract IDs: `docs/TRANCHE2_EXECUTION.md`.
- Aquarius end-to-end helper:
  
  ```bash
  NETWORK=testnet HOLDER_ALIAS=arka-holder bash scripts/aquarius/e2e.sh
  ```

This runs fee acquisition (if needed), pool creation, liquidity deposit, and a test swap (including via `adapter-aquarius`).

SoroSwap end-to-end helper:

```bash
NETWORK=testnet HOLDER_ALIAS=arka-holder bash scripts/soroswap/e2e.sh
```

Additional live validation helpers:

```bash
bash scripts/e2e-coverage-vault.sh
bash scripts/e2e-coverage-fund.sh
bash scripts/e2e-manager-tier.sh
bash scripts/e2e-adapter-balanced.sh
bash scripts/e2e-adapter-blend.sh
bash scripts/e2e-governed-policy.sh
bash scripts/e2e-arka-migration.sh
bash scripts/deploy-create-live-validation.sh
bash scripts/deploy-deposit-redeem-live-validation.sh
bash scripts/deploy-rebalance-live-validation.sh
bash scripts/deploy-governance-live-validation.sh
bash scripts/deploy-blend-live-validation.sh
```
