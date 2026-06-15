# Audit Closure

Date: 2026-03-28

Scope:
- contracts
- token power and governance
- fee engine
- coverage and claims
- oracle safety
- catalog API
- public SDK
- frontend product surfaces
- delivery runbook status

Legend:
- `Yes`: corroborated in this audit
- `Partial`: implemented or evidenced only in part, or not green end-to-end
- `No`: not corroborated as complete in this audit

| Area | Implemented in code | Tested locally | Deployed / validated on testnet |
| --- | --- | --- | --- |
| Registry integrity and authorized factory registration | Yes | Yes | Yes |
| Oracle guard / provider abstraction | Yes | Yes | Yes |
| Legacy governor delay flow | Yes | Yes | Yes |
| Separate governance executor / timelock layer | Yes | Yes | Yes |
| Liquid `ARKA` token | Yes | Yes | Yes |
| `locked ARKA` voting power | Yes | Yes | Yes |
| First-release tokenomics stack: locked voting power, vesting, emissions, distribution | Yes | Yes | Yes |
| Fee engine: management, performance, HWM, protocol split | Yes | Yes | Yes |
| Legacy coverage fund / coverage vault flows | Yes | Yes | Yes |
| Coverage economics: reserve-aware premiums and treasury routing | Yes | Yes | Yes |
| Claims circuit: incident, freeze, waterfall, treasury top-up | Yes | Yes | Yes |
| Catalog API / data plane | Yes | Yes | Yes |
| Public TypeScript SDK | Yes | Yes | No |
| Frontend product surfaces and redesign system | Yes | Yes | Yes |
| Governed protocol onboarding by third parties | No, deferred | No | No |
| Release gate / full-stack closeout | Yes | Yes | Yes |

## Evidence Summary

### 1. Governance and token power

Corroborated:
- `governance-executor` exists and has unit, integration, and end-to-end local tests.
- `arka-token` and `locked-arka` exist and have local tests.
- testnet evidence exists in `deployments.testnet.json` under `validations.governanceHandoff`.

Important limitation:
- `deployments.testnet.json` now exposes these contracts canonically through `validatedModules.governanceFoundation`.
- the top-level `contracts` map still describes the long-lived core deployment set, while `validatedModules` is the source of truth for isolated live-validated module stacks.

### 2. Tokenomics

Corroborated:
- there is a token-power foundation: liquid `ARKA` plus locked voting power
- governance-linked minting and relocking were validated through the live handoff flow
- there is now a governed vesting layer in `arka-vesting`
- there is now a governed emissions and treasury-distribution layer in `emissions-controller`
- local unit, integration, and end-to-end tests cover the combined path
- live testnet validation now exists in `deployments.testnet.json` under `validations.tokenomics`
- live testnet evidence now exists in `tmp/tokenomics-live-validation.json`
- testnet evidence covers:
  - governed creation of a vesting grant and an emissions stream through `governance-executor`
  - live partial claim of vested team tokens
  - live partial release of ecosystem emissions
  - governed revoke and cancel after accrual
  - treasury refund of unaccrued balances
  - relocking of released team tokens into `locked-arka` voting power

Important scope limit:
- depositor-voting `dARKA` remains intentionally deferred from the first release
- the validated tokenomics stack is now promoted canonically under `validatedModules.tokenomicsFoundation`, not mixed into the core `contracts` map

Conclusion:
- first-release tokenomics implementation: complete in code, locally verified, and live-validated on testnet

### 3. Fee engine

Corroborated:
- `Arka` now exposes management-fee accrual, performance fee with high-water mark, protocol fee policy, `preview_fee_settlement()`, and `settle_fees()`.
- local contract tests passed in this audit.
- live testnet validation now exists in `deployments.testnet.json` under `validations.feeEngine`.
- live testnet evidence now exists in `tmp/fee-engine-live-validation.json`.
- testnet evidence covers:
  - management-fee preview with positive accrued fee shares
  - settlement of accrued management fees
  - protocol treasury share minting after settlement
  - controlled profit realization through a deterministic router/adapter path
  - performance-fee crystallization after profit
  - full user redemption while manager and treasury fee ownership remains

Conclusion:
- implemented, locally tested, and live-validated on testnet

### 4. Coverage and claims

Legacy coverage:
- `coverage-vault` and `coverage-fund` are present in `deployments.testnet.json`
- older coverage flows were already validated on testnet

New reserve-aware coverage economics:
- implemented in `coverage-fund`
- locally tested in this audit
- live testnet validation now exists in `deployments.testnet.json` under `validations.coverageEconomics`
- live testnet evidence now exists in `tmp/coverage-claims-live-validation.json`
- testnet evidence covers:
  - premium quotation from covered NAV
  - retained reserve growth from premium funding
  - reserve-asset rewards claimed by the staker
  - bootstrap rewards claimed alongside reserve rewards
  - reserve metrics after premium routing

Claims circuit:
- `claims-manager` exists
- local unit, integration, and end-to-end tests passed in this audit
- live testnet validation now exists in `deployments.testnet.json` under `validations.claimsCircuit`
- live testnet evidence now exists in `tmp/coverage-claims-live-validation.json`
- testnet evidence covers:
  - incident trigger and freeze state
  - reject and re-trigger flow
  - approval of a live payout plan
  - execution across manager first-loss, community reserve, and treasury top-up
  - final reserve-state and incident-history recording

Conclusion:
- serious coverage and claims logic exists in code
- implemented, locally tested, and live-validated on testnet

### 5. Oracle safety

Corroborated:
- `oracle-guard` exists and local tests passed in this audit
- canonical testnet deployment now exists in `deployments.testnet.json` under `contracts.oracleGuard`
- live testnet validation now exists in `deployments.testnet.json` under `validations.oracleGuard`
- testnet evidence covers:
  - divergent-feed selection of the secondary provider
  - stale-primary fallback to the secondary provider
  - fail-closed behavior under divergence

Conclusion:
- implemented, locally tested, and live-validated on testnet

### 6. Data plane

Corroborated:
- `services/catalog-api` exists
- unit and integration tests passed in this audit
- local e2e is now green through the hardened standalone live harness
- the packaged off-chain stack is now live-validated on testnet through `deployments.testnet.json -> validations.offchainPublicStack`
- live off-chain evidence now exists in `tmp/offchain-testnet-stack.json`
- the canonical registry migration is now live-validated on testnet through `deployments.testnet.json -> validations.canonicalRegistryMigration`
- the canonical discovery source is now promoted under `deployments.testnet.json -> contracts.arkaRegistry`
- `catalog-api` now includes legacy-Arka instance-storage fallbacks for historical testnet vaults that do not expose the modern `nav()` ABI
- the canonical registry and Arka configuration surfaces are now live-validated through Soroban RPC under `deployments.testnet.json -> validations.indexerEventSurface`
- the GraphQL ingestion path now includes a SubQuery-compatible provider profile live-validated on testnet under `deployments.testnet.json -> validations.subqueryBackendParity`

Conclusion:
- implemented
- locally verified end-to-end
- packaged off-chain testnet deployment validated successfully

### 7. SDK

Corroborated:
- `sdk/typescript` exists
- unit tests passed in this audit
- integration is now self-contained and green through the local live harness
- local e2e is now green through the same hardened live harness

Remaining limitation:
- there is still no canonical testnet deployment proof for the SDK as a public release artifact
- SDK and catalog live harnesses should still be treated as serialized jobs because they both rebuild generated artifacts and local bindings

Conclusion:
- implemented
- locally verified end-to-end
- no canonical testnet deployment evidence

### 8. Frontend

Corroborated:
- `arkafund-dapp` build passed in this audit
- unit and integration suites passed in this audit
- Playwright smoke plus product-surface specs passed in this audit
- the demo/video pipeline was regenerated during this audit cycle
- the packaged off-chain stack is now live-validated on testnet through `deployments.testnet.json -> validations.offchainPublicStack`
- the dapp health endpoint and catalog proxy both passed inside that live package validation

Conclusion:
- implemented and locally verified
- packaged off-chain testnet deployment validated successfully

### 9. Runbook / delivery-state conclusion

The current runbook now marks:
- `Block 10. Governed protocol onboarding` as deferred
- `Block 12. Release gate` as completed

That means the implementation program is closed except for the intentionally deferred onboarding block and the separately gated mainnet publication step.

### 10. Release gate

Corroborated:
- `scripts/release_gate.py` now exists as the integrated gate runner
- `scripts/run-release-gate.sh` now exists as the reproducible entrypoint
- the integrated release gate now records its result in `tmp/release-gate.json`
- the integrated release gate now records its summary under `deployments.testnet.json -> validations.releaseGate`
- the latest gate passed across:
  - contract build and test suites
  - canonical validated-module promotion and live verification on testnet
  - indexer-ready registry and Arka event-surface validation on testnet
  - live create validation on testnet
  - live deposit/redeem validation on testnet
  - generic GraphQL and SubQuery-compatible parity validation on testnet
  - SDK unit, integration, and e2e
  - catalog API unit, integration, and e2e
  - frontend build, unit, integration, Playwright, and design audit
  - packaged off-chain stack validation on testnet

Conclusion:
- the integrated pre-mainnet release gate is implemented, reproducible, and green

## Commands Run In This Audit

Contracts:
- `cargo test -p arka-registry -p arka-factory --tests`
- `cargo test -p governance-executor -p arka-token -p locked-arka -p coverage-fund -p claims-manager -p oracle-guard --tests`
- `cargo test -p arka --tests`
- `bash scripts/e2e-fee-engine.sh`
- `bash scripts/e2e-coverage-claims.sh`
- `bash scripts/build-wasm.sh`
- `bash scripts/deploy-fee-engine-live-validation.sh`
- `bash scripts/deploy-coverage-claims-live-validation.sh`
- `python3 -m unittest scripts.tests.test_canonical_testnet_registry`
- `bash scripts/promote-canonical-testnet-registry.sh`
- `bash scripts/verify-canonical-testnet-registry.sh`
- `python3 -m unittest scripts.tests.test_release_gate`
- `bash scripts/run-release-gate.sh`

Catalog API:
- `npm run test:unit`
- `npm run test:integration`
- `npm run test:e2e`
Result:
- unit, integration, and e2e passed
- local live harness now waits for real RPC health, real friendbot readiness, explicit account visibility, and uses explicit RPC URLs for contract deployment

SDK:
- `npm run test:unit`
- `npm run test:integration`
- `npm run test:e2e`
Result:
- unit, integration, and e2e passed
- integration is now self-contained and no longer requires manually provided live env vars
- local live harness now waits for real RPC health, real friendbot readiness, explicit account visibility, and uses explicit RPC URLs for contract deployment

Frontend:
- `npm run build`
- `npm run test:unit`
- `npm run test:integration`
- `npx playwright test e2e/smoke.spec.ts e2e/product-surfaces.spec.ts`
Result:
- all four passed in this audit

## Final Audit Statement

Safe statement:

- A large share of the intended tranche-3-era implementation is now present in code.
- The governance executor, token-power foundation, fee engine, coverage economics, claims circuit, data plane, SDK, and redesigned frontend all exist in the repository.
- Live testnet proof is now present for governance handoff, oracle guard, fee engine, coverage economics, and claims circuit.
- SDK and catalog local end-to-end paths are now green and reproducible.
- The integrated pre-mainnet release gate is now green and recorded.

Not safe statement:

- It is not yet correct to say that everything is fully implemented, fully deployed, and fully proven end-to-end on testnet.
 - It is not yet correct to say that every off-chain surface is separately deployed as a persistent public testnet service.

The main blockers to that statement are:
- governed protocol onboarding remains intentionally deferred
- the public hosted testnet release posture for off-chain surfaces remains a separate operational decision from the completed implementation gate
