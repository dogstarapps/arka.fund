# Arka.fund Storage Lifecycle Runbook

Date: 2026-05-20

Scope: T21 release-grade Soroban storage lifecycle verification for the dApp runtime contracts. This runbook covers the operator-facing storage extension path only; it does not deploy, upgrade, invoke governance payloads, mutate protocol configuration or perform mainnet cutover.

## 1. Objective

Arka.fund contracts use Soroban storage whose lifetime must be actively managed. The storage lifecycle process must make the exact extend plan visible before execution, must not include destructive operations, and must distinguish persistent, instance and temporary storage behavior.

T21 closes the release blocker by making the following release artifacts machine-consumable:

- `GET /api/contracts/storage-lifecycle`
- `/contracts#contracts-storage-lifecycle`
- `scripts/contracts_storage_extend.mjs`
- `docs/storage-lifecycle-testnet-dry-run-2026-05-20.json`

## 2. Contract Coverage

The canonical lifecycle matrix covers these runtime contracts:

- Core: Arka Factory, Arka Registry.
- Routing: Arka Router, SoroSwap adapter, Aquarius adapter, Balanced adapter, Blend adapter.
- Coverage: Coverage Fund, Coverage Vault, Claims Manager.
- Governance: Locked Arka, Manager Tier, Governor, Votes, optional Governance Executor.
- Oracle: Oracle Guard.

Required contracts block live execution when missing. Optional contracts are reported as `optional_missing_contract` and do not block the rest of the plan.

## 3. Storage Classes

Every lifecycle entry records the same audited storage classes:

- Persistent storage: included in the extend plan through `stellar contract extend --durability persistent`.
- Instance storage: audited as part of the contract lifecycle scope and tracked in the runbook matrix.
- Temporary storage: audited for presence but intentionally excluded from the operator extend command. Temporary entries must be recreated by their owning transaction path rather than force-extended by this script.

This distinction is important because hiding temporary storage behind a generic "extend everything" label would be misleading.

## 4. Cadence And Thresholds

Default cadence:

- Run dry-run review every 14 days.
- Extend target: 518400 ledgers.
- Warning threshold: 120960 ledgers.
- Critical threshold: 17280 ledgers.

Required signer:

- `ARKAFUND_STORAGE_EXTEND_SOURCE_ACCOUNT`
- fallback only for operator convenience: `STELLAR_ACCOUNT`, then `NEXT_PUBLIC_ARKA_MANAGER`
- live execution is blocked when no source account is available.

## 5. Dry-Run Procedure

Run:

```bash
npm run contracts:extend-storage
```

or for a focused machine-consumable plan:

```bash
node ./scripts/contracts_storage_extend.mjs \
  --dry-run \
  --json \
  --only arka-factory,arka-registry,oracle-guard \
  --source-account GCO7KAJ7WCIFDLAEDHKSFQRNQLR3SQ6JTIVSMYYFUC5KRTA2KG2QJYDE \
  --ledgers-to-extend 518400 \
  --plan-json docs/storage-lifecycle-testnet-dry-run-2026-05-20.json
```

Dry-run must show:

- selected contract IDs,
- exact `stellar contract extend` command per ready entry,
- storage classes audited,
- extend scopes,
- source account,
- ledger window,
- blocked rows,
- optional missing rows,
- plan hash.

## 6. Live-Run Safeguards

The script defaults to dry-run. Live execution requires both:

```bash
--execute
ARKAFUND_STORAGE_EXTEND_CONFIRM=EXTEND_STORAGE_TTL
```

Example:

```bash
ARKAFUND_STORAGE_EXTEND_CONFIRM=EXTEND_STORAGE_TTL \
node ./scripts/contracts_storage_extend.mjs \
  --execute \
  --json \
  --evidence-json docs/storage-lifecycle-live-evidence-YYYY-MM-DD.json
```

The script blocks live execution if:

- any required contract ID is missing,
- the source account is missing,
- the explicit confirmation value is missing,
- a command falls outside the `stellar contract extend` allowlist.

The script has no deploy, invoke, delete, reset, restore or config-mutation path.

## 7. Testnet Rehearsal Evidence

Rehearsal artifact:

- `docs/storage-lifecycle-testnet-dry-run-2026-05-20.json`

Recorded command:

```bash
node ./scripts/contracts_storage_extend.mjs --dry-run --json --only arka-factory,arka-registry,oracle-guard --source-account GCO7KAJ7WCIFDLAEDHKSFQRNQLR3SQ6JTIVSMYYFUC5KRTA2KG2QJYDE --ledgers-to-extend 518400 --plan-json docs/storage-lifecycle-testnet-dry-run-2026-05-20.json
```

Recorded result:

- mode: `dry_run`
- entries: 3
- ready: 3/3
- destructive operations: false
- plan hash: `2bbf8a62850bf878c250863c77e2359b93d828c67eba429c03ede5d0bb53fe32`

This is deliberately dry-run evidence. It proves exact command generation and safeguards without submitting a transaction. Live testnet execution can be performed by an operator with a funded signer using the live-run command above and must write an evidence JSON artifact.

## 8. Operator UI

The `/contracts` storage lifecycle panel now exposes:

- ready/blocked/optional counts,
- cadence and thresholds,
- required live confirmation,
- storage class coverage,
- first safeguards,
- contract/env/status/command rows,
- temporary storage exclusion policy.

The panel is operator-gated through the same operator session model as the contracts control room.

## 9. Verification Commands

T21 validation commands:

```bash
npx vitest run tests/unit/contracts-storage-lifecycle.test.ts
npx vitest run tests/integration/api-contracts-storage-lifecycle-route.test.ts tests/integration/contracts-storage-extend-script.test.ts tests/integration/contracts-page.test.tsx
npx playwright test e2e/contracts-surface.spec.ts --project=chromium --grep "storage lifecycle" --workers=1
npx eslint src/lib/contracts/storageLifecycle.ts src/app/api/contracts/storage-lifecycle/route.ts src/app/contracts/page.tsx tests/unit/contracts-storage-lifecycle.test.ts tests/integration/api-contracts-storage-lifecycle-route.test.ts tests/integration/contracts-storage-extend-script.test.ts tests/integration/contracts-page.test.tsx e2e/contracts-surface.spec.ts
npm run build
git diff --check -- src/lib/contracts/storageLifecycle.ts scripts/contracts_storage_extend.mjs src/app/contracts/page.tsx src/app/globals.css tests/unit/contracts-storage-lifecycle.test.ts tests/integration/api-contracts-storage-lifecycle-route.test.ts tests/integration/contracts-storage-extend-script.test.ts tests/integration/contracts-page.test.tsx e2e/contracts-surface.spec.ts docs/STORAGE_LIFECYCLE_RUNBOOK_2026-05-20.md docs/storage-lifecycle-testnet-dry-run-2026-05-20.json
```
