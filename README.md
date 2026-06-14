# Arka.fund

Arka.fund is an on-chain asset management protocol built on the Soroban/Stellar network. It lets managers create configurable vaults ("Arkas") with governed policies, share tokenization, and strategy execution across Stellar DeFi integrations such as Aquarius, SoroSwap, and Blend.

Depositors enter and exit Arkas through vault shares, while managers operate within on-chain policy constraints around fees, whitelisted assets, and protocol access. Governance is handled through a Soroban Governor-based flow with execution delay for protocol-level actions such as policy updates, implementation changes, and migrations.

## Key Features

*   **Configurable Arkas:** Each vault can define denomination asset, fee policy, allowed assets, manager authority, and share-token settings.
*   **Vault Shares (SAC):** Arkas can mint and burn a dedicated share token per vault on deposit and redeem flows.
*   **DeFi Adapters:** Router/adapter integrations support swap and credit workflows across Aquarius, SoroSwap, and Blend.
*   **Coverage and Tiering:** Coverage Vault, Coverage Fund, and Manager Tier modules are included as protocol primitives.
*   **Governed Operations:** Governor-controlled flows cover policy updates, implementation changes, and migrations.
*   **On-chain Transparency:** Deposits, redemptions, rebalances, and credit actions emit contract events and can be reproduced through documented testnet scripts.

## Current Support Matrix

- Core contract and validation coverage in this repository includes `Arka`, `ArkaFactory`, share-token flows, coverage modules, manager tiering, governance, and the validated Aquarius, SoroSwap, and Blend integrations.
- `adapter-phoenix` remains in the workspace as future protocol work and is not part of the current testnet validation matrix.
- The earlier `Balanced` adapter harness and its Comet-coupled testnet lane have been retired from the active support surface. Their historical IDs are preserved under `deployments.testnet.json -> legacyContracts`.
- Governance uses the vendored `soroban-governor` contract together with the separate `governance-executor` queue-and-execute layer for delayed governed actions.

## Documentation

- Support matrix and reference guide: `docs/REPO_SCOPE.md`
- Architecture: `docs/ARCHITECTURE.md`
- Deployment: `docs/DEPLOYMENT.md`
- Governance: `docs/GOVERNANCE.md`
- Platform tokens and tokenomics: `docs/PLATFORM_TOKENS_AND_TOKENOMICS_2026-04-11.md`
- Fees: `docs/FEES.md`
- Security: `docs/SECURITY.md`
- Internal security audit plan: `docs/INTERNAL_SECURITY_AUDIT_PLAN.md`
- Storage lifecycle hardening and extend runbook: `docs/STORAGE_LIFECYCLE.md`
- Product surface reference: `docs/UI_SPEC.md`
- Execution and validation log: `docs/TRANCHE2_EXECUTION.md`
- Execution venue roadmap: `docs/EXECUTION_VENUES_AND_INTENT_ROUTING_PLAN_2026-04-07.md`

## Reproduce E2E (Testnet)

- Prerequisites: Soroban/Stellar CLI v23+, funded testnet key alias (e.g., `arka-holder`).
- Contract IDs and accounts: see `deployments.testnet.json`.
- Canonical live-validated module registry: see `deployments.testnet.json -> validatedModules`.
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
bash scripts/soroswap/e2e.sh
bash scripts/aquarius/e2e.sh
bash scripts/e2e-adapter-blend.sh
bash scripts/e2e-governed-policy.sh
bash scripts/e2e-arka-migration.sh
bash scripts/deploy-create-live-validation.sh
bash scripts/deploy-deposit-redeem-live-validation.sh
bash scripts/deploy-rebalance-live-validation.sh
bash scripts/deploy-governance-live-validation.sh
bash scripts/deploy-blend-live-validation.sh
bash scripts/deploy-oracle-guard-live-validation.sh
bash scripts/deploy-fee-engine-live-validation.sh
bash scripts/deploy-coverage-claims-live-validation.sh
bash scripts/deploy-tokenomics-live-validation.sh
bash scripts/deploy-offchain-testnet-stack.sh
bash scripts/promote-canonical-testnet-registry.sh
bash scripts/verify-canonical-testnet-registry.sh
bash scripts/e2e-storage-lifecycle.sh
bash scripts/deploy-storage-lifecycle-extend.sh
bash scripts/run-release-gate.sh
```
