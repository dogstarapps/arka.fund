# Internal Contracts Security Audit Closeout

Date: 2026-05-20

Status: **closed for T22 internal audit**. This is not an external third-party audit and it is not a mainnet deploy signoff. It is the internal release artifact proving that the dApp/runtime contract surfaces now have documented findings, explicit residual risks and test-linked invariants.

Machine-consumable source:

- `src/lib/contracts/securityAudit.ts`
- `GET /api/contracts/security-audit`
- `/contracts#contracts-security-audit`
- `/api/release/gate` gate key: `securityAudit`

## Scope

The closeout covers the security surfaces that block a responsible mainnet launch:

- Access control and DAO executor gating.
- Operator API authentication for advanced telemetry and release evidence.
- Soroban storage TTL lifecycle and rent-extension safeguards.
- Arithmetic bounds for bps, notional, route length, chunking and turnover controls.
- Oracle assumptions for leaderboard, profit, swap validation and release cutover.
- Smart routing route guards, venue validation and fail-closed behavior.
- Emergency swap pause and swap-disable posture.
- Coverage, claims-manager and manager-tier mutation surfaces.
- Governance composer truthfulness around curated packages versus arbitrary executable batches.

Out of scope for this internal closeout:

- External third-party audit.
- Mainnet deployment execution.
- Final live mainnet routing canary.
- Final testnet dress rehearsal transaction evidence.

Those are tracked separately as T26/T27 and remain launch blockers until executed.

## Release Gate Result

The internal security gate is green:

- Finding count: 10.
- Blocking findings: 0.
- Critical/high blocking findings: 0.
- Accepted risks: 1.
- Invariants: 11.
- Failed invariants: 0.
- Undocumented critical/high remaining: 0.

The release gate consumes this closeout through `buildContractsSecurityAuditSnapshot().releaseGate`. If any finding is changed to `blocking`, or if any invariant fails, `/api/release/gate` becomes non-ready.

## Findings

| ID | Domain | Severity | Status | Resolution |
| --- | --- | --- | --- | --- |
| AC-01 | Access control | Critical | Resolved | DAO-guarded contract writes are blocked outside the GovernanceExecutor lane through typed and raw contract policy checks. |
| AUTH-01 | Operator auth | High | Resolved | Operator-only APIs require a verified operator session and return deterministic no-store 401 payloads without a session. |
| STO-01 | Storage TTL | High | Resolved | Storage lifecycle entries classify persistent, instance and temporary storage; live extend requires explicit confirmation and dry-run is default. |
| ARI-01 | Arithmetic | Critical | Resolved | Rebalance policy validates bps, path length, max notional, chunking and turnover state; missing state blocks execution. |
| ORC-01 | Oracle assumptions | Critical | Resolved | Leaderboard/oracle release readiness is gated; mainnet remains blocked without audited Reflector/OracleGuard evidence. |
| RTE-01 | Route guards | Critical | Resolved | Smart Routing benchmark, canary and route-plan gates cover multi-hop, split-route, fill-risk and fail-closed behavior. |
| PAU-01 | Emergency pause | High | Resolved | Swap enable/disable posture is represented as DAO-governed policy and enforced by guardrail evaluation. |
| COV-01 | Coverage controls | High | Resolved | Coverage and claims-manager mutations appear in the mutation matrix with readback, rollback and E2E scenario mapping. |
| DAO-01 | DAO governance | Critical | Resolved | Governance composer stages curated governed packages only and does not pretend to publish arbitrary executable batches. |
| CUT-01 | Oracle/mainnet evidence | Medium | Accepted risk | Mainnet deploy evidence is intentionally deferred to T26/T27 and release gates remain blocked until final evidence exists. |

## Residual Risks

- GovernanceExecutor deployment and role configuration still require final testnet/mainnet verification in T26/T27.
- Production operator wallet list must be reviewed once final Vercel environment variables are frozen in T24.
- The first live testnet storage extension remains part of the dress rehearsal, not this internal software closeout.
- On-chain arithmetic must still be covered by final contract deployment bytecode review before T27.
- Mainnet OracleGuard ID is intentionally absent until the final mainnet cutover.
- Live mainnet Smart Routing canary evidence remains deferred to T27 after production endpoints exist.
- Future DAO-managed guardrail storage migration must preserve the same source-of-truth mapping.
- Final testnet rehearsal must capture live state evidence for deployed coverage contracts.
- A generic Governor executable-batch primitive remains a future contract feature and must be independently audited if added.

## Invariants And Evidence

| ID | Domain | Severity | Evidence |
| --- | --- | --- | --- |
| INV-AC-001 | Access control | Critical | `shouldBlockRawWrite` and `shouldBlockTypedWrite` block DAO-guarded writes outside the executor lane while allowing read calls. |
| INV-AC-002 | DAO governance | Critical | Every curated governed action template appears in the critical mutation matrix. |
| INV-MUT-001 | Coverage controls | High | Every critical mutation row has preconditions, post-state assertion, state probe, rollback and E2E scenario evidence. |
| INV-MUT-002 | Access control | High | DAO-required mutation rows never appear as direct wallet-backed executable lanes. |
| INV-STO-001 | Storage TTL | High | Storage lifecycle covers persistent, instance and temporary storage while excluding temporary force-extension. |
| INV-STO-002 | Storage TTL | High | Live storage extension requires `ARKAFUND_STORAGE_EXTEND_CONFIRM=EXTEND_STORAGE_TTL`. |
| INV-ARI-001 | Arithmetic | Critical | Default rebalance guardrail policy keeps bps, notional, route length and turnover bounds inside enforceable limits. |
| INV-ORC-001 | Oracle assumptions | Critical | Oracle cutover, leaderboard source and release-gate tests cover ready/blocked/mismatch/missing-provider states. |
| INV-RTE-001 | Route guards | Critical | Benchmark and canary suites cover multi-hop, split-route, million-scale candidate spaces and fail-closed states. |
| INV-PAU-001 | Emergency pause | High | `set_swap_risk_policy` is classified as DAO guarded. |
| INV-AUTH-001 | Operator auth | High | Mutation matrix, storage lifecycle, release gate and security audit routes require verified operator sessions. |

## Test Links

Unit coverage:

- `tests/unit/contracts-security-audit.test.ts`
- `tests/unit/contracts-mutation-matrix.test.ts`
- `tests/unit/contracts-storage-lifecycle.test.ts`
- `tests/unit/dao-execution-policy.test.ts`
- `tests/unit/rebalance-routing.test.ts`
- `tests/unit/oracle-cutover-gate.test.ts`
- `tests/unit/rebalance-benchmark.test.ts`
- `tests/unit/rebalance-canary-gate.test.ts`
- `tests/unit/governance-composer.test.ts`

Integration coverage:

- `tests/integration/api-contracts-security-audit-route.test.ts`
- `tests/integration/api-contracts-mutation-matrix-route.test.ts`
- `tests/integration/api-contracts-storage-lifecycle-route.test.ts`
- `tests/integration/contracts-storage-extend-script.test.ts`
- `tests/integration/contracts-page.test.tsx`
- `tests/integration/api-release-gate-route.test.ts`
- `tests/integration/api-rebalance-benchmark-route.test.ts`
- `tests/integration/api-leaderboard-source-route.test.ts`

E2E coverage:

- `e2e/contracts-surface.spec.ts`
- `e2e/release-gate.spec.ts`
- `e2e/wallet-backed-matrix.spec.ts`
- `e2e/operator-degraded-retry-matrix.spec.ts`

## Operator Review Procedure

1. Open `/contracts#contracts-security-audit` in operator mode.
2. Confirm the summary shows `ready`, `0 failed invariants` and `0 undocumented critical/high remaining`.
3. Open `/api/contracts/security-audit` with an operator session and verify the JSON payload matches this artifact.
4. Open `/api/release/gate` and verify `gates.securityAudit.status === "ready"`.
5. If any future finding becomes `blocking`, do not proceed to T26/T27 until the finding is resolved or explicitly accepted with rationale.

## Mainnet Launch Position

This closeout removes the internal audit artifact as a blocker. It does **not** mean Arka.fund is ready to deploy mainnet today.

Remaining mainnet blockers are still tracked in the 27-item plan:

- T23: API hardening final pass.
- T24: Production/Vercel gate.
- T25: Final platform manual and screenshots refresh.
- T26: Testnet dress rehearsal.
- T27: Final mainnet cutover.
