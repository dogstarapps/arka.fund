# Arkafund Deployment Guide (Historical Testnet)

Current status note, 2026-07-03: this is a historical testnet deployment guide. Current mainnet deployment facts are in `deployments.mainnet.json` and `docs/MAINNET_REALITY_CHECK_2026-07-03.md`. Do not use this file to describe the current mainnet protocol surface.

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

The repository supports both the legacy `votes + governor` bootstrap and the separated executor path used for the live handoff validation.

```bash
bash scripts/bootstrap-governance-user-admin.sh
```

This script:

- deploys `votes.wasm`
- deploys `governor.wasm`
- initializes the votes contract
- initializes the Governor with a non-zero execution delay
- persists the resulting contract IDs and governance parameters to `deployments.testnet.json`

The separated executor and token-power handoff is validated separately through:

```bash
bash scripts/deploy-governance-handoff-live-validation.sh
```

If the long-running Governor vote window is interrupted mid-run, resume with:

```bash
bash scripts/resume-governance-handoff-live-validation.sh
```

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
bash scripts/e2e-coverage-claims.sh
bash scripts/e2e-manager-tier.sh
bash scripts/soroswap/e2e.sh
bash scripts/aquarius/e2e.sh
bash scripts/e2e-adapter-blend.sh
bash scripts/deploy-create-live-validation.sh
bash scripts/deploy-deposit-redeem-live-validation.sh
bash scripts/deploy-rebalance-live-validation.sh
bash scripts/deploy-governance-live-validation.sh
bash scripts/deploy-governance-handoff-live-validation.sh
bash scripts/deploy-blend-live-validation.sh
bash scripts/deploy-oracle-guard-live-validation.sh
bash scripts/deploy-fee-engine-live-validation.sh
bash scripts/deploy-coverage-claims-live-validation.sh
bash scripts/deploy-tokenomics-live-validation.sh
bash scripts/deploy-offchain-testnet-stack.sh
bash scripts/promote-canonical-testnet-registry.sh
bash scripts/verify-canonical-testnet-registry.sh
bash scripts/run-release-gate.sh
```

## 6) Contract IDs and Runbooks

- Canonical deployment metadata: `deployments.testnet.json`
- Canonical validated-module registry: `deployments.testnet.json -> validatedModules`
- Canonical validation log: `docs/TRANCHE2_EXECUTION.md`
- Governance model and flow: `docs/GOVERNANCE.md`
- Governance handoff evidence: `tmp/governance-handoff-live-validation.json`
- Fee engine evidence: `tmp/fee-engine-live-validation.json`
- Coverage and claims evidence: `tmp/coverage-claims-live-validation.json`
- Tokenomics evidence: `tmp/tokenomics-live-validation.json`
- Off-chain testnet stack evidence: `tmp/offchain-testnet-stack.json`
- Indexer event surface evidence: `tmp/indexer-event-surface-live-validation.json`
- SubQuery-compatible parity evidence: `tmp/subquery-backend-parity.json`
- Release gate evidence: `tmp/release-gate.json`

## Notes

- The separated governance executor path is now live-validated on testnet and recorded under `validations.governanceHandoff`.
- `oracle-guard` is live-validated on testnet through `deploy-oracle-guard-live-validation.sh` and recorded under `validations.oracleGuard`.
- The fee engine is live-validated on testnet through `deploy-fee-engine-live-validation.sh` and recorded under `validations.feeEngine`.
- Coverage economics and claims are live-validated on testnet through `deploy-coverage-claims-live-validation.sh` and recorded under `validations.coverageEconomics` and `validations.claimsCircuit`.
- The first-release tokenomics stack is live-validated on testnet through `deploy-tokenomics-live-validation.sh` and recorded under `validations.tokenomics`.
- `deploy-canonical-registry-migration.sh` now migrates the broken historical discovery source into a new canonical `contracts.arkaRegistry`, preserves the former registry under `legacyContracts.arkaRegistry`, and records the evidence under `validations.canonicalRegistryMigration`.
- The off-chain `catalog-api + dapp` stack is live-validated on testnet through `deploy-offchain-testnet-stack.sh` and recorded under `validations.offchainPublicStack`.
- That off-chain validation now uses the canonical migrated `contracts.arkaRegistry` and indexes the 18 historical Arkas recorded from the canonical factory-backed backfill.
- `services/catalog-api` now includes explicit legacy Arka compatibility by reading legacy instance storage when the modern `nav()` ABI is absent.
- The earlier Balanced-via-Comet validation lane has been retired from the active support surface. Historical IDs remain under `legacyContracts`. At the time of this historical testnet guide, the public AMM surface was Aquarius + SoroSwap; the current mainnet manifest separately records SoroSwap, Aquarius and Phoenix canaries with `autoEnabled=false`, plus Balanced/SODAX as a server-side intent venue with `autoEnabled=true`.
- `deploy-balanced-readiness-validation.sh` now audits the live Balanced lane directly on testnet and records its current support status under `validations.balancedReadiness`.
- The source `adapter-balanced` contract has been decoupled from Comet and reintroduced into the active workspace/build matrix, but the deployed testnet lane remains blocked until that canonical contract is redeployed against a non-Comet Balanced router.
- `deploy-indexer-event-surface-live-validation.sh` validates the canonical registry discovery events and the Arka configuration event surface directly through Soroban RPC on testnet and records the result under `validations.indexerEventSurface`.
- `deploy-graphql-backend-parity-validation.sh` now validates parity between the native and GraphQL ingestion backends against canonical testnet data and records the result under `validations.graphqlBackendParity`.
- `deploy-subquery-backend-parity-validation.sh` now validates parity between the native backend and a SubQuery-compatible GraphQL profile against canonical testnet data and records the result under `validations.subqueryBackendParity`.
- `promote-canonical-testnet-registry.sh` materializes the canonical validated-module registry under `validatedModules`.
- `verify-canonical-testnet-registry.sh` verifies the promoted module registry live against testnet.
- `run-release-gate.sh` runs the integrated pre-mainnet gate across contract suites, canonical testnet module verification, Balanced readiness auditing, indexer-event validation, live create/deposit flows, SDK, catalog API, frontend validation, generic GraphQL parity, SubQuery-compatible parity, and the off-chain testnet stack smoke, and records the result under `validations.releaseGate`.
- Some protocol integrations remain experimental and are not part of the current validated surface. See `docs/REPO_SCOPE.md`.
