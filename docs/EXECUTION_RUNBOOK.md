# Execution Runbook

This runbook covers the current delivery phase after the completed testnet validation scope. Mainnet publication stays gated until the final block.

## Principles

- Keep testnet as the active integration environment until all delivery blocks are complete.
- Do not add partial product surfaces backed by unreliable or incomplete data.
- Preserve all validated functionality while hardening the platform.
- Treat oracle safety as a combined contract, market, and operational concern.
- Ship each block with unit coverage, cross-module validation, and a reproducible live-validation path.

## Delivery Blocks

### Block 1. Registry integrity and delivery gates

Goal:
- Make discovery inputs trustworthy before building ranking, discovery, and public analytics on top of them.

Scope:
- Restrict registry writes to authorized registrars and admin-only legacy registration.
- Wire factory registration through contract auth instead of open public writes.
- Add regression coverage for unauthorized writes, admin flows, and factory auto-registration.
- Add a reproducible live-validation script for registry authorization on testnet.

Exit criteria:
- Direct unauthorized registry writes fail.
- Factory-created Arkas register successfully once the factory is authorized as a registrar.
- Legacy admin registration still works for curated imports and migrations.

### Block 2. Oracle safety architecture

Goal:
- Make price consumption resilient to provider changes and market manipulation.

Scope:
- Introduce a provider-agnostic oracle adapter strategy for vault-owned pricing reads.
- Define feed admission rules by asset class and market liquidity.
- Add deviation monitoring and kill-switch operating procedures.
- Finalize the supported provider matrix for production hardening.

Exit criteria:
- Oracle provider can be changed without redesigning vault logic.
- Unsafe feeds can be disabled without pausing unrelated vault functionality.

Implementation status:
- Implemented `oracle-guard` as a provider-agnostic on-chain guard compatible with the existing `lastprice` surface.
- Covered by unit tests, public API integration tests, dedicated integration tests against `test-oracle`, and local end-to-end vault tests in `arka`.
- Live-validated on testnet with canonical recording in `deployments.testnet.json` under `contracts.oracleGuard` and `validations.oracleGuard`.

### Block 3. Data plane

Goal:
- Build the off-chain data layer required for product analytics and public discovery.

Scope:
- Indexer ingestion for contracts, balances, shares, positions, and governance events.
- NAV API, KPI endpoints, time series, and cached views for app consumption.
- Historical snapshots for Arkas, managers, and assets.
- Monitoring and alerting for data freshness and API health.

Exit criteria:
- App routes can consume a single API surface for portfolio, ranking, and activity data.
- Historical views and leaderboard queries no longer depend on direct RPC fan-out.

### Block 4. Product surfaces

Goal:
- Replace the current operator dApp shell with the intended product experience.

Scope:
- Discover, Arkas leaderboard, manager leaderboard, dashboard, assets explorer, and rich Arka detail tabs.
- Create flow aligned with the target product UX.
- Coverage and governance views integrated into the new information architecture.

Exit criteria:
- Product surfaces are backed by indexed data and preserve the existing live operations.
- The app supports both browsing and execution without splitting users into separate tools.

### Block 5. Developer platform

Goal:
- Open the platform to third-party integrations without weakening core guarantees.

Scope:
- Public SDK for contract bindings, API clients, and typed action builders.
- Developer documentation for integrations, policies, and operational constraints.
- Extension model for adding new protocol tooling on top of the supported interfaces.

Exit criteria:
- External developers can integrate vault reads and supported actions from a maintained package.
- Supported extension points are documented and versioned.

### Block 6. Governance and token foundation

Goal:
- Lock the final governance and token model before deeper economic and risk modules are built on top of it.

Scope:
- Move from Governor delay-only operation to the target `Governor + Timelock/Executor` architecture if confirmed.
- Finalize `ARKA` liquid-token role, locking model, vesting posture, and treasury controls.
- Finalize naming policy for the locked governance asset:
  - technical shorthand may remain `veARKA`
  - public product naming should prefer `locked ARKA` / voting-power language unless a clearer branded name is adopted
- Confirm whether depositor voting stays deferred and `dARKA` remains out of the first release.

Exit criteria:
- Governance architecture is frozen in writing.
- Token naming, vesting posture, and power boundaries are explicit.
- The implementation sequence for governance contracts is unambiguous.

Implementation status:
- Implemented `governance-executor` as a separate queued delayed-execution contract.
- Implemented `arka-token` for liquid `ARKA` and `locked-arka` for locked voting power with delegation and checkpoints.
- Implemented `arka-vesting` for funded governed vesting schedules.
- Implemented `emissions-controller` for funded governed emissions and treasury-distribution streams.
- Covered by unit tests, integration tests, and local end-to-end scenarios against `governance-token`, `coverage-fund`, `arka-factory`, and `arka`.
- Covered by unit, integration, and local end-to-end scenarios for the token-power layer itself.
- Covered by unit, integration, and local end-to-end scenarios for vesting and emissions/distribution across `arka-token`, `locked-arka`, and `governance-executor`.
- Covered by live testnet handoff and validation against the active Governor path, with evidence recorded in `deployments.testnet.json`.
- Covered by live testnet tokenomics validation for governed vesting, governed emissions, refund-on-cancel behavior, and relocking into voting power, with evidence recorded in `deployments.testnet.json` under `validations.tokenomics`.

### Block 7. Fee engine

Goal:
- Replace the current partial fee surface with a real manager and protocol revenue engine.

Scope:
- Management fee accrual.
- Performance fee with high-water mark.
- Protocol split and treasury routing.
- Optional low deposit/redeem fees and create-fee anti-spam policy.
- Fee splitter and accounting surfaces for indexer and frontend.

Exit criteria:
- All intended fee paths are implemented, testable, and reportable.
- Protocol and manager fee destinations are explicit and queryable.

Status:
- Implemented in `Arka` with management-fee accrual, performance fee with high-water mark, protocol split, `preview_fee_settlement()`, and `settle_fees()`.
- Covered by unit, integration, and local end-to-end scenarios, including a real-token/router profit path.
- Live-validated on testnet through `scripts/deploy-fee-engine-live-validation.sh`, with evidence recorded under `deployments.testnet.json -> validations.feeEngine`.

### Block 8. Coverage economics

Goal:
- Turn coverage from two primitives into a credible economic reserve system.

Scope:
- Reserve asset policy.
- Premium model and premium routing.
- Reward mix between reserve-asset income and `ARKA` bootstrap emissions.
- `veARKA` boost policy where appropriate.
- Solvency and reserve-utilization reporting.

Exit criteria:
- Coverage funding is not emissions-only.
- Reserve asset policy, premium inputs, and reward composition are explicit.

Implementation status:
- Implemented in `coverage-fund` with governed covered-vault policies, premium quotation, premium routing, dual reward ledgers, and solvency reporting.
- Covered by unit tests, integration test, and end-to-end local scenario with `coverage-vault`.
- Live-validated on testnet through `scripts/deploy-coverage-claims-live-validation.sh`, with evidence recorded under `deployments.testnet.json -> validations.coverageEconomics`.

### Block 9. Claims circuit

Goal:
- Implement the operational path from incident to payout as a first-class protocol workflow.

Scope:
- Incident trigger and registry.
- Freeze and snapshot flow.
- Assessment and governed resolution path.
- Waterfall execution: manager first-loss, then community reserve, then optional treasury support.
- Claims history support for indexer, API, and frontend.

Exit criteria:
- Claims can be simulated and validated end-to-end on testnet.
- Incident state and payout history are visible and auditable.

Implementation status:
- Implemented with `claims-manager`, authorized claim paths in `coverage-vault` and `coverage-fund`, incident freeze state, governed approval, and waterfall execution.
- Covered by unit, integration, and end-to-end local tests across the three contracts.
- Live-validated on testnet through `scripts/deploy-coverage-claims-live-validation.sh`, with evidence recorded under `deployments.testnet.json -> validations.claimsCircuit`.

### Block 10. Governed protocol onboarding

Goal:
- Allow third parties to propose new integrations without weakening protocol safety.

Scope:
- Protocol and adapter registry design.
- Candidate submission flow with metadata, policy hash, and testnet evidence.
- Governance activation through exact reviewed artifacts.
- Automatic post-vote activation via timelock execution for approved packages only.
- Runtime enforcement so only active registry entries are usable.

Exit criteria:
- Third parties can propose integrations through a governed path.
- Approved packages become active automatically after vote and timelock.
- Arbitrary unaudited code deployment is not part of the activation model.

Status:
- Deferred to a later platform-expansion phase.
- Not part of the current last-mile critical path.

### Block 11. Design system alignment

Goal:
- Align the product visually with the reference material instead of keeping the current transitional shell.

Scope:
- Base tokens, palette, type system, panel language, chart/table language, and navigation shell.
- Reproduction of the reference screens in `arkafund-assets/screens`.
- Equivalent visual treatment for screens not explicitly designed in the asset set.
- Replacement of the current transitional frontend shell rather than an incremental recolor or light restyle.

Exit criteria:
- Product surfaces follow one coherent visual system.
- Missing screens are resolved in the same graphic language as the reference set.
- Fidelity covers color, gradients, borders, field treatments, charts, spacing, and overall layout language, not only route structure.

Implementation status:
- Replaced the transitional shell with a reference-aligned chrome using the palette, typography, panel treatment, and right-rail navigation language from `arkafund-assets/screens`.
- Reworked the reference-backed routes `dashboard`, `discover`, `governance`, `integrations`, `coverage`, `create`, `status`, `settings`, `vaults`, `vault profiles`, `managers`, and `assets` to the new visual system without removing validated product behavior.
- Extended the same fidelity pass to the live operational routes `arkas`, `arkas/[id]`, `ops`, and `tiers`, preserving the validated wallet-backed and live execution flows while moving them onto the same visual system.
- Covered by `build`, unit tests, integration tests, and Playwright end-to-end validation on the product shell and product/workflow surfaces.
- Added a screenshot-based design-audit path that captures current frontend routes and writes a side-by-side review report against the provided references.
- Visual audit coverage now includes the live operational routes as well as the catalog-backed product routes.

### Block 12. Release gate

Goal:
- Close the delivery phase with production hardening and release readiness.

Scope:
- Governance hardening verification and audit-readiness review.
- Whitelisted launch set, incentives module, and release operations.
- Final verification on testnet, then mainnet publication.

Exit criteria:
- Monitoring, governance, oracle policy, and release controls are complete.
- Mainnet deployment is the last step, not a parallel track.

Implementation status:
- Implemented `scripts/release_gate.py` as the integrated release-gate runner.
- Implemented `scripts/run-release-gate.sh` as the reproducible entrypoint for the full gate.
- The gate now runs contract builds and tests, canonical validated-module promotion and live verification on testnet, live create and deposit/redeem validations on testnet, SDK suites, catalog API suites, frontend build/test/Playwright coverage, and the design-audit path.
- The latest integrated run passed and is recorded in `tmp/release-gate.json` and `deployments.testnet.json -> validations.releaseGate`.

## Current Iteration

Active block:
- Final publication remains gated and is intentionally held after testnet closure.

Completed block:
- Block 12. Release gate

Reopened follow-up:
- External managed-ingestion adoption remains the next architecture item after the canonical registry closure.
- See `docs/REGISTRY_AND_INDEXING_PLAN.md` for the diagnosis, provider evaluation, and implementation phases.

Completion notes:
- `deployments.testnet.json` now contains a canonical `validatedModules` registry for the live-validated governance foundation, oracle safety, fee engine, coverage/claims, and tokenomics stacks.
- `scripts/promote-canonical-testnet-registry.sh` now promotes module provenance from `validations.*` into that canonical registry.
- `scripts/verify-canonical-testnet-registry.sh` now verifies those promoted modules live against testnet.
- `scripts/run-release-gate.sh` now runs the integrated release gate and records the result under `validations.releaseGate`.
- `scripts/canonical_registry_migration.py` and `scripts/deploy-canonical-registry-migration.sh` now migrate the broken historical discovery source into a canonical `contracts.arkaRegistry` and preserve the prior contract under `legacyContracts.arkaRegistry`.
- `scripts/deploy-offchain-testnet-stack.sh` now deploys and validates the packaged `catalog-api + dapp` stack against testnet using the canonical migrated registry, not a fixture path.
- `scripts/deploy-graphql-backend-parity-validation.sh` now validates parity between the native and GraphQL ingestion backends against canonical testnet data.
- `/vaults` is now the dedicated indexed Arka leaderboard.
- `/vaults/[id]` remains the product profile route.
- `/arkas` and `/arkas/[id]` remain dedicated to live execution and operational shortcuts.
- Product browsing and execution now have separate entrypoints without removing any validated live controls.
- `Arka` now settles management fees over time and performance fees with a high-water mark.
- Protocol treasury splits on fee shares are configurable on `Arka` and can be defaulted from `ArkaFactory`.
- Fee previews and fee-state accounting are exposed for indexer and frontend consumption.
- `coverage-fund` now prices and routes premiums into reserve, staker yield, and conditional treasury share.
- `claims-manager` now runs the first-loss / community / treasury waterfall.
- `governance-executor` now provides a separate queue-and-execute layer for governed calls after authority handoff.
- `arka-token` and `locked-arka` now provide the first concrete liquid-token and locked-voting-power foundation.
- `arka-vesting` now provides funded governed vesting schedules with revocation and claim flows.
- `emissions-controller` now provides funded governed emissions and treasury-distribution streams with cancel-and-refund behavior.
- The first-release tokenomics stack is now live-validated on testnet, including governed grant creation, governed stream creation, partial claim/release, governed revoke/cancel, treasury refunding, and relocking into voting power.
- `sdk/typescript` integration and e2e now run through a self-contained local live harness with explicit RPC wiring, friendbot readiness checks, and account-visibility checks.
- `services/catalog-api` integration and e2e now run through a self-contained local live harness with explicit RPC wiring, friendbot readiness checks, account-visibility checks, activity-reader fallbacks for dashboard surfaces, and legacy-Arka instance-storage fallbacks for historical testnet vaults that do not expose the modern `nav()` ABI.
- `services/catalog-api` now supports both `native` and `graphql` ingestion backends behind the same service contract, with runtime selection by environment and end-to-end coverage for both paths.
- GraphQL portability is now protected by a parity validation artifact recorded in `tmp/graphql-backend-parity.json` and `deployments.testnet.json -> validations.graphqlBackendParity`.
- A SubQuery-compatible provider profile is now implemented and parity-validated on testnet under `tmp/subquery-backend-parity.json` and `deployments.testnet.json -> validations.subqueryBackendParity`.
- The canonical registry and Arka contracts now expose a provider-ready event surface, live-validated on testnet and recorded under `deployments.testnet.json -> validations.indexerEventSurface`.
- The product shell now follows the reference visual system across the global chrome, dashboard, discover, governance, integrations, coverage, create, settings, status, vault leaderboard/profile, managers, assets, and live operational routes.
- The updated shell is validated with `build`, unit, integration, and Playwright coverage across dashboard, discover, explorers, workflow IA, live ops, vault entrypoints, vault profile, control-room routes, and smoke flows.
- Visual audit artifacts now land under `arkafund/tmp/design-audit`.
- The canonical registry migration is now live-validated on testnet and recorded under `deployments.testnet.json -> validations.canonicalRegistryMigration`.
- The packaged off-chain stack now validates against the canonical migrated `contracts.arkaRegistry`, indexes 18 historical Arkas with zero sync failures, and no longer depends on a dedicated fixture path.
- Discovery/indexing is therefore canonically closed on testnet; the remaining next step is external-ingestion provider adoption from `docs/REGISTRY_AND_INDEXING_PLAN.md`.

Next focus:
- Keep mainnet publication as the final gated step after explicit go/no-go.
- Preserve the release gate as the required pre-mainnet entrypoint for future validation passes.
- Execute the external-ingestion adoption plan captured in `docs/REGISTRY_AND_INDEXING_PLAN.md`, starting from the provider pilot now that both the ingestion abstraction and the portability parity checks are in place.
