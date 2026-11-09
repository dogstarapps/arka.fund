# R10 — manual staged withdrawals in the dapp

2026-10-30. Based on R9 commit `ff3c1a4656c99ba42ae9cf6bff638e99166b5bf7`. Noah remains V2. R10 performs no production reads, signatures, transaction submissions, deployment or financial automation.

## Small scope

**All 114 tracked contract source/build-input files and all 24 selected WASM files are identical to R9.** R10 adds no contract branch, storage, error, heuristic, policy or timing rule. The dapp does not calculate lot sizes or choose fallback routes. It adds one `recover-spot` wallet action and a native disclosure with two controls, reusing the existing review, wallet and pending-receipt flow.

The investor still requests a withdrawal and collects reserved cash. Manual processors can open **Process withdrawals**, review one contract-planned liquidity step, wait for confirmation, and request a fresh plan. **Review settlement** reserves available cash for eligible requests. Processing and receiving cash have distinct messages and recipients; a liquidity step returns assets to the Arka, not the operator's wallet.

## Rules remain in the contract

`portfolio_liquidation_steps` supplies the single next step and its minimum output. The getter receives the maximum representable argument; the contract still bounds it by the pending request and governed policy. This creates no allowance or spending authorization. The dapp builds `liquidate_withdrawal`, not a manager `rebalance`.

Preparation rereads the plan and compares the exact encoded route, assets, pool, amount and minimum before financial simulation or wallet approval. A changed or unavailable plan is rejected. The contract simulation continues to enforce eligibility, manager/public windows, venue admission, route bindings, prices, slippage, FIFO and backing. Settlement simulation must confirm a positive settled-share amount before approval. No frontend deadline estimate or parallel sizing algorithm is introduced.

There is no automatic signing loop or write retry. An ambiguous response retains the existing public receipt metadata, blocks another action, and survives reload. The confirmation-only path clears it only after a conclusive receipt. A new lot then needs a new review. Read-only views expose the controls as disabled; public lookup, unavailable valuation, incomplete history and unresolved receipts retain their existing guards. Reserved claims remain separate from NAV.

## Fresh local validation

- **1,205 frontend unit/integration tests pass**, including 17 focused transport/UI checks. Fourteen signing-dependent frontend tests remain skipped.
- The opt-in **UI → unsigned ABI → P29 VM** test passes separately. It uses actual R9 Arka/router/adapter/registry WASM and the frozen real Sushi factory/pool. It is not counted as a pass in the default suite, where the fixture-dependent test is skipped.
- The UI requests all shares, rejects premature settlement before approval, processes five balanced Sushi lots, resumes a lost reply after reload without applying that lot twice, rejects the old plan, settles and collects **999.4009043 XLM**. The fixture begins with the R9 1,000-XLM profile plus three USDC base units. It ends with zero NAV, shares, pending shares, reserves and vault asset balances, and no cancelled shares.
- Eight business operations are applied **only in RAM**: request, five liquidity steps, settlement and claim. Forty-five VM invocations cover the UI run, including reads and preflight; each uses the pinned snapshot and enforcing source-account/nested-contract authorization.
- Frontend build and TypeScript checks pass. Chromium checks five UI boundaries: accessible help/focus, disabled read-only processing, reserved-claim review, explicit read failure and Noah V2 dispatch. Browser APIs use local synthetic fixtures; no live Noah data is queried.

The UI test replaces wallet approval with return of the same unsigned envelope, and replaces broadcast/receipt delivery with a test-only RAM fixture. It **never calls the transport broadcaster**, never creates a cryptographic signature and never submits to a consensus node. RPC assembly uses the actual VM transaction-data/auth output. The UI envelope uses the local Standalone passphrase, while the VM fork retains the frozen public-network context; no cross-network signature or admission claim is made.

Diagnostic attempts are preserved. The same input from an intermittent fixture-process failure replays successfully. The accepted fixture reads stdin from read-only files and retains process diagnostics; the product gains no retry or fallback. Initial test failures also exposed missing waits for VM-backed reads after reload; those waits are confined to the test.

Evidence: `artifacts/v3-withdrawal-flow-r10-20261030`, accepted VM attempt `vm-r6`, controllers `v3-withdrawal-flow-r10`, under the managed-withdrawals workspace root. Final inputs/receipts are preserved with hashes, including compressed VM output. R9 native **273 tests**, financial **28 scenarios/105 observations**, and earlier cash-exit receipts are reused **by exact contract/WASM identity**, not presented as fresh R10 runs. No dependencies were installed; matching locked dependency environments and identical SDK/catalog build outputs were reused explicitly.

## Still pending for mainnet

This closes the **local manual dapp workflow**. Mainnet signing and processing stay disabled. Still required: the intended target's read/preparation backend support for the new intent, addresses/code/roles/callers/oracles/routes/index reconciliation, actual current liquidity/order sizes and complete storage/restore/TTL/admission pricing; cryptographic requalification including the new recovery intent under separate authorization, real wallets/devices and an authorized canary; hosted CI and independent audit on the exact candidate; deployment/activation approval. The legacy lending keeper is unchanged and is not a Sushi executor. No automatic keeper was enabled. Noah is never migrated and Phoenix-bound legacy managed instances must not be upgraded with this template.

See [structured pending work](../release/mainnet-pending.json) and [MAINNET_PENDING.md](MAINNET_PENDING.md).
