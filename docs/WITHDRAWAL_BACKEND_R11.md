# R11 — staged withdrawal read/preparation backend

2026-10-30. Based on R10 `763b253feb5fbb0c9ac0d38ee444eb08f17d961a`. Noah stays V2. No production reads/writes, signatures, transaction submissions, activation or deployment.

## Small extension of the existing service

All 114 contract source/build-input files and all 24 selected WASM remain identical to R10/R9. The existing read-only review service gains `GET /quote?kind=withdrawal&fund=...&owner=...`; its existing `/prepare` accepts `recover-spot`. No new endpoint family, service, store, keeper, financial executor, sizing heuristic or route-selection algorithm is added. The client verifies the dedicated `liquidate_withdrawal` ABI and exact step; mainnet processing controls remain disabled.

The backend reads `portfolio_liquidation_steps` with the same maximum getter argument as R10. Only one bounded contract-generated step or explicit `null` is accepted. A read failure, restoration requirement, unexpected auth, malformed response, stale index or changed identity remains unavailable; none becomes an empty plan or zero balance. Existing owner/index completeness, current code, protocol/network, bounded ledger drift and fee rules apply.

For recovery preparation, the service rereads the contract plan and compares the exact encoded amount, minimum, assets, adapter, pool and router **before financial simulation**. It prepares `liquidate_withdrawal`, preserving SourceAccount/nested authorization checks, current sequence/code recheck, one-minute review bounds and the existing 1-XLM total-fee cap. Settlement must simulate a positive `settled_shares`; zero-eligible settlement is rejected. No backend clock-based eligibility estimate is added.

The existing immutable unsigned-review archive is reused and can reload recovery reviews after restart. Unknown receipts stay confirmation-only, with no submission retry. Legacy-instance exclusion occurs before any new withdrawal observation, including Noah. Capabilities remain read/simulate only: sign, submit, restore and keeper remain false.

## Fresh local evidence and limits

The backend tests cover reads, null/error distinction, changed plan fields, index/code/legacy/network guards, restoration, fee cap, authorization root, contract preflight rejection, positive/zero settlement and archive tampering. Client tests check the unsigned recovery ABI, changed caller/route/minimum, rebalance substitution, quote context and explicit read errors. Both backend and frontend type checks pass without emitting builds.

Accepted totals: **57 backend tests**, plus the separately enabled **one HTTP → VM test**. Frontend acceptance covers **1,221 distinct passing cases across a broad run and focused reruns**, with 15 skipped (14 signing cases and the opt-in R10 UI fixture). The broad run initially failed to collect two catalog suites because unchanged compiled fixtures were absent. Their verified unchanged modules were then linked individually and both suites passed in a focused rerun, together with the changed client/proxy checks. The original failures are preserved; this is composite acceptance, not a single all-green frontend run. The accepted backend VM run performs **52 VM invocations**, **122 intercepted synthetic RPC calls**, and eight RAM business operations. Nine source-gate tests pass.

The opt-in HTTP → gateway/coordinator → P29 RAM test uses the exact selected Arka/router/adapter/venue-registry and frozen real Sushi pool/factory WASM. It requests all shares, rejects premature settlement, processes five lots, rejects an old step before financial simulation, reloads eight persisted unsigned reviews, checks unknown receipts without retry, settles and collects **999.4009043 XLM**. Final NAV, shares, pending shares, reserves and vault asset balances are zero; no shares are cancelled. Eight business operations are applied only by a test driver in RAM, never by the backend/RPC service. Public-network unsigned envelopes and VM context now use the same passphrase; no real network signature or consensus admission is claimed.

Registry/factory/account/header/admission and complete-index metadata in this test are synthetic. The oracle and funding are synthetic; Sushi code/state are from frozen R8 ledger 65206504, not current liquidity. No production endpoint is contacted. The test coordinator's HTTPS endpoint is intercepted by an in-process synthetic responder; only loopback test servers are reachable. The native host denies network and filesystem writes. Wallet devices, signing, broadcasting, current target configuration/index/roles/liquidity, real fees/TTL/restore and consensus admission remain unvalidated.

Diagnostic attempts are retained. A synthetic header initially omitted its required XDR extension; correcting the test fixture produced the accepted full backend run. Product validation was not relaxed. R10 UI/Chromium and R9 native/financial evidence are historical identity-based references, not fresh R11 runs.

## Build boundary and remaining work

A fresh catalog compilation was **not started** because the Mac guard reported 21.972 GiB free against 22 GiB required (20-GiB reserve plus 2-GiB estimate). No data or cache was deleted. Changed operations are executed directly from TS source using Node's explicit type-stripping test mode and checked by TypeScript without emit. Locked dependencies are reused; only individually verified unchanged catalog read modules/test fixtures and the unchanged SDK reuse compiled outputs. The changed `reviewOperations.js` is deliberately absent from reused `dist`. These checks are not a fresh compiled R11 backend or frontend build.

Recheck normal disk budget before fresh builds. Still pending: deployment/reconciliation of this backend on the intended authorized target and a complete live index; current code/role/route/allowlist/oracle/liquidity and admission checks; separately authorized cryptographic/device/canary validation; hosted CI, independent audit and deployment/activation approval. Mainnet remains unapproved. See [MAINNET_PENDING.md](MAINNET_PENDING.md) and [structured pending work](../release/mainnet-pending.json).

Evidence and reproduction controllers are retained under the managed-withdrawals workspace in `artifacts/v3-withdrawal-backend-r11-20261030` and `v3-withdrawal-backend-r11`. The accepted-result/closeout records identify exact attempts, source hashes, test totals and reused identities.
