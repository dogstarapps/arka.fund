# R9 — bounded complete spot liquidation

2026-10-30. Based on R8 commit `4c317e45c933b1edecce16fc506e18ed038e859c`. Noah remains V2. No production access, signature, submission, activation or migration occurred in R9. Existing R8/Sushi captures are frozen inputs, not current market observations.

## Change and boundaries

Normal trading and Blend recovery retain the existing percentage-of-current-input-balance cap. Dedicated spot withdrawal liquidation now records the input balance at the first successful sale for each active FIFO request and asset. Each subsequent sale uses that reference with the **current** governed `max_trade_size_bps`; the reference cannot increase after a partial claim. A new request uses a new reference, including after cancellation of the queue head. Failed calls roll back the reference write along with the swap.

The planner splits the remaining input into balanced lots within that limit: 603 units at a 150-unit limit become 121/121/121/120/120. It returns one step; callers must obtain a fresh plan after confirmation. A caller budget too small for an executable balanced lot produces no plan, never a fabricated zero holding. When the whole asset is needed for payout, execution rejects an unbalanced split that could create a tiny tail.

For risk-enabled spot recovery only, the input-value budget is the cash shortfall divided by `1 - portfolio.max_slippage_bps / 10000`, rounded up. This bounded allowance covers the already disclosed execution loss and avoids leaving fee/rounding fragments. Legacy risk-disabled spot recovery and Blend retain their former shortfall bounds. No configured percentage, price-age limit or slippage/impact/TWAP limit is increased.

Venue admission, fixed directional bindings, caller authorization, debt-free checks, manager/public windows, FIFO priority, reserved-cash backing, cash buffers, fees, exact-input/output accounting and current oracle checks remain enforced. Claims on reserved cash work while the venue is paused. An initially non-executable amount, stale price, restricted asset or insufficient pool liquidity still blocks a swap; holdings are never erased or written off to manufacture a full exit.

The new scalar persistent key is `(exitbase, active_request_id, input_asset)`, separate from the closed legacy DataKey record codec. Its TTL is extended using the existing dynamic-key policy. Archived-state restoration and the additional storage/rent must be included in current-target admission pricing. Old requests and their receipts are preserved.

## Fresh acceptance

All three cash-exit scenarios execute the exact selected R9 vault WASM and the actual frozen Sushi pool/factory in the P29 RAM host, with synthetic accounts/funding/oracle/governance. Source-account authorization and nested contract authorization are enforced. They do not use cryptographic signatures or a consensus node.

| Scenario | Result |
| --- | --- |
| Manager recovery, management/performance fees enabled | Four lots; from a 1,000-XLM deposit, owner claims 999.4008840 XLM and manager subsequently claims 0.0000190 XLM of accrued fees |
| Public recovery, zero fees | Four lots; owner claims 999.4009030 XLM |
| Integer-tail regression, three extra USDC base units deposited | Five lots: 32377407/32377406/32377406/32377406/32377406 raw units; owner claims 999.4009043 XLM |

Each scenario ends with **zero vault XLM/USDC, zero NAV, zero total shares, zero pending shares and zero reserved cash**, with no cancelled shares. Pool/owner/manager token balances reconcile exactly; adapters and router retain no funds. Expected early, oversized and unbalanced attempts reject atomically.

Additional fresh checks: **273 native tests** including legacy modules and five new withdrawal regressions; **28 financial VM scenarios / 105 observations** with economic parity; actual-Sushi lifecycle (42 steps, five atomic rejections); 14 host-boundary rejections; public ABI equivalence; generated binding verification; SDK/catalog builds and tests; frontend build and 1,188 frontend tests. The initial frontend run preceded catalog fixture compilation and failed to import two fixture modules; the complete rerun after compilation passes. All diagnostic attempts remain in evidence.

Signing was disabled throughout. **18 signing-dependent tests are skipped**: 14 frontend, two catalog unit, one catalog integration and one SDK. Their historical R6/R7 results are not fresh R9 cryptographic validation. Fresh non-signing service results: catalog unit 160, catalog integration 41, SDK 32. No skipped cryptographic test is counted as a pass.

The vault is **130727 bytes**, leaving **345 bytes** below the retained 131072-byte ceiling. Compiler/optimizer versions, overflow checks and flags remain pinned. Documentation stays as source comments instead of emitted contract-spec text to fit the size limit; function/type signatures and error codes are unchanged, and bindings were regenerated. A second build reproduces the selected hash. Other 23 selected WASM files remain unchanged.

Evidence: `artifacts/v3-liquidation-r9-20261030` and controllers `v3-liquidation-r9` under the managed-withdrawals workspace root. Accepted final receipts, source and binary hashes, native snapshot archive and the recursive R8 integrity check are indexed in closeout. Preliminary builds and receipts are retained but excluded from final acceptance.

## Mainnet pending

The R8 planner/geometric-residual finding is locally closed for the tested executable profiles. Mainnet remains unapproved. Still required: intended live Arka identities/roles/oracles/routes/callers and full index; operational runner/UI integration and review of staged recovery on that target; current liquidity and launch sizes; complete storage/restore/TTL/upload/inclusion budget; signing-dependent requalification under a separate authorization, actual wallets/devices and canary; hosted CI and independent audit of this exact change; final deployment/activation approval. No production recovery automation was enabled. Never migrate Noah or upgrade a Phoenix-bound legacy managed instance with this template.
