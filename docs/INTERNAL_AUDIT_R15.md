# R15 internal audit and remediation

**Mainnet is not approved. Noah stays V2. Sushi remains unactivated; Phoenix is retired only for new routes; Curve is deferred.** No real wallet, production access, chain submission, deployment, public push or external audit sending occurred. Only contained runtime-random test keys produced local cryptographic signatures.

## Changes and corrected finding

R14-08 overstated the absence of atomic fee binding: the existing template digest already includes the creation fee token, exact amount and treasury. R15 preserves that protection and closes the actual integration gaps. The reviewed draft now carries its template hash and exact fee through fresh profile preparation; it cannot silently adopt changed terms.

Routed creation retains the existing public create_managed_routes ABI and charges by token.transfer within the manager-authorized creation. A first-time manager needs no allowance and no separate approval transaction. Creation, share initialization and registration are atomic: failure reverses the fee. Non-routed legacy creation retains its prior allowance behavior. There is no new approval state machine, planner heuristic, automatic deposit or write retry.

The dapp displays the exact fee and blocks invalid/stale terms. Approved creation is a primary action; choosing the new creator removes the legacy alternative. A missing creator fee configuration keeps existing investment/withdrawal profiles usable. Pending receipts remain confirmation-only after reload or disabled execution. Legacy route changes now clear the previous fund's swap-plan context; stale cleanup and unused imports were corrected without changing route sizing.

## Fresh validation

| Check | Result |
| --- | --- |
| Native full workspace, including legacy modules | 282 passed, 0 failed |
| Frontend full suite | 1315 passed, 0 failed; 2 explicitly separate VM cases |
| Catalog / SDK | 162 unit + 42 integration / 35 unit passed |
| Builds and TypeScript | web, catalog, SDK and frontend types passed; 0 frontend lint warnings |
| Real ephemeral cryptography | 58 named cases plus 13 default-denial/key-provenance guards |
| Selected WASM | 24/24 reproduced with locked/offline compilation and network denied |
| Generated bindings | 7 roles, 11 files match unchanged public interfaces |
| Actual factory P29 guest | 5 cases, 6 executions: zero allowance success, exact debit/credit, token/amount/treasury change rejection and registration rollback |
| Full frozen financial replay | 73 expected results, five bounded lots, complete cash exit, zero financial residuals, claim while paused |
| Dapp → backend → P29 RAM | 91 host runs; 8 financial actions; lost reply/reload, stale plan, five lots, settlement, index lag and full collection |
| Browser | 5 fixture checks, including visible errors, disabled writes and Noah V2 dispatch |
| Static inventory | 27 contracts, 650 public functions; all 24 scanner reviews manually reconciled; 5 analyzer regressions |

The P29 fee proof executes the selected factory, vault, share and registry WASM with the frozen StellarAsset USDC executable plus synthetic test account funding. The withdrawal replay uses frozen actual Sushi pool/token code/state and the current selected vault/router/adapter. Funding, prices, governance, admission/index, wallet/wire and receipts have explicit test boundaries. P29 uses host-enforced source-account authorization; the separate crypto matrix verifies real Ed25519 signatures. Neither qualifies real Freighter fee approval, account authority, current market liquidity, inclusion or consensus.

## Dependencies and bytecode identity

Both Rust locks now select time 0.3.55, rand 0.8.8, keccak 0.1.6 and spin 0.9.9. time's serde_core requirement also updates unified serde. A same-path old-lock control exactly reproduced the old Balanced WASM, identifying the lock change as the bytecode drift cause. Seventeen unchanged contract implementations therefore have new compiled bytes; together with the fee factory change, 18 of 24 selected WASM hashes change. Public exports and all contract ABI/metadata sections match. All 24 subsequently pass the strict reproduction guard; constructor/initialization bindings are updated. No existing instance is upgraded.

Two findings remain open: **R14-07**, minimatch development tooling (14 frontend + 2 SDK affected npm nodes, one advisory), and **R14-09**, crypto-bigint 0.5.5 in both host/test/optional Rust lock scopes. Production-only npm audits are clean. Each Rust audit now reports one vulnerability and two unmaintained warnings (derivative, paste); the previous unsound/yanked warnings are cleared. crypto-bigint and time are absent from selected guest normal dependency graphs. This scopes exposure; it does not make the strict full audits green. The upstream elliptic-curve/ecdsa version constraints prevent a compatible forced crypto-bigint major update. The incompatible minimatch override remains reverted. No advisory is suppressed or represented as resolved.

## Preserved diagnostics and release boundary

All failed attempts remain local: missing rust-src alias, expected old-hash mismatch, rejected incompatible serde pin, invalid test portfolio cancel-lock, incomplete fee-rejection authorization, extra out-of-scope synthetic code in a fixture, stale DOM reference in a new test, and an incorrect assertion that monotonic queue IDs must reset to zero. The accepted proofs use a valid portfolio cancel lock, exact positive source auth for rejection/rollback tests, scoped fixture code, a freshly queried active button, and head == next_id with zero pending count/shares/reserves. These corrections do not relax product guards. Native snapshots are copied and hashed before restoring generated tracked copies; no evidence or project data is deleted.

This candidate builds from sealed R14 040be7aec22a065c89f6ac40479a45bba8bb1247. The current report is an internal remediation/delta audit, retaining R14's wider manual baseline. It is not an external audit or proof that no defects remain. Exact source, tested input identities, dependency reports, unsigned candidate commit, patch and references are checked by the R15 closeout. [Structured findings](../release/internal-audit.json) and [mainnet pending](MAINNET_PENDING.md) distinguish local closure from launch approval.
