# Arka.fund Testnet Dress Rehearsal

Date: 2026-05-21

Canonical evidence artifact: `docs/testnet-dress-rehearsal-evidence.json`

## Release Decision

Status: **ready for pre-mainnet release gate**

This is not a mainnet cutover. It proves that the production-like testnet rehearsal has a complete, machine-consumable evidence artifact before the final mainnet item starts.

## Scope

The rehearsal gate covers the seven required T26 lanes:

1. Deploy/redeploy canonical testnet contracts.
2. Create an Arka through the factory.
3. Deposit and redeem through a live Arka.
4. Route and rebalance through live adapter wiring.
5. Coverage reserve, claims and rewards.
6. Governance voting, timelock and execution handoff.
7. Operator, oracle, routing, protocol, tokenomics, off-chain catalog and indexer lanes.

## Machine Checks

The gate reads a generated report instead of trusting a human checklist.

Required checks:

- Report version must match the current verifier.
- Report network must be `testnet`.
- All seven required lanes must be ready.
- Source evidence must be readable.
- At least 30 transaction hashes must be present.
- At least 70 state proofs must be present.
- The report must be fresh within the configured max age window.
- The release API must include `gates.testnetDressRehearsal`.

Current artifact summary:

- Required steps: `7`
- Ready steps: `7`
- Source files: `15`
- Readable source files: `15`
- Contract IDs: `242`
- Transaction hashes: `67`
- State proofs: `76`
- Blockers: `0`
- Warnings: `4`

## Honest Warnings

The following warnings do not block the release gate because they are legacy evidence-format limitations, not failed state:

- Factory create legacy artifact proves post-execution state but does not expose the direct Stellar transaction hash.
- Deposit/redeem legacy artifact proves post-execution balances but does not expose direct transaction hashes.
- Rebalance legacy artifact proves output delta and final balance but does not expose a direct transaction hash.
- Balanced/SODAX testnet lane is recorded as blocked because no official public Stellar testnet quote/status/confirm surface is available.

These warnings are intentionally preserved in the artifact. They must not be rewritten as green claims.

## Evidence Inputs

Primary committed dApp evidence:

- `config/deployments.testnet.json`
- `docs/testnet-dress-rehearsal-evidence.json`

External contract-workspace evidence consumed by the generator:

- `../arkafund/deployments.testnet.json`
- `../arkafund/tmp/create-live-validation.json`
- `../arkafund/tmp/deposit-redeem-live-validation.json`
- `../arkafund/tmp/rebalance-live-validation.json`
- `../arkafund/tmp/coverage-claims-live-validation.json`
- `../arkafund/tmp/governance-live-validation.json`
- `../arkafund/tmp/governance-handoff-live-validation.json`
- `../arkafund/tmp/oracle-guard-live-validation.json`
- `../arkafund/tmp/swap-guardrails-live-validation.json`
- `../arkafund/tmp/balanced-readiness-validation.json`
- `../arkafund/tmp/blend-live-validation.json`
- `../arkafund/tmp/indexer-event-surface-live-validation.json`
- `../arkafund/tmp/tokenomics-live-validation.json`
- `../arkafund/tmp/offchain-testnet-stack.json`

## Commands

Generate or refresh the canonical artifact:

```bash
npm run testnet:rehearsal
```

Machine-readable output:

```bash
npm run testnet:rehearsal:json
```

Focused unit and release-gate integration validation:

```bash
npx vitest run tests/unit/testnet-dress-rehearsal.test.ts tests/unit/production-environment-gate.test.ts tests/integration/api-release-gate-route.test.ts
```

Wallet-backed browser validation:

```bash
npx playwright test e2e/wallet-backed.spec.ts e2e/wallet-backed-matrix.spec.ts e2e/release-gate.spec.ts --project=chromium --workers=1
```

Full release gate:

```bash
npm run test:release-gate
```

## Release Gate Wiring

`/api/release/gate` now includes:

```json
{
  "gates": {
    "testnetDressRehearsal": {
      "target": "testnet_dress_rehearsal",
      "status": "ready"
    }
  }
}
```

If the artifact is missing, stale, unreadable, incomplete, not testnet, or below transaction/state-proof thresholds, the gate returns `blocked` and release is not ready.

## Boundary

T26 is complete only for the testnet rehearsal gate and evidence artifact. T27 remains the final mainnet cutover item and must still provide audited mainnet deployment/canary evidence before production launch.
