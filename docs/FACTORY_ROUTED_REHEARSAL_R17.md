# R17 factory-created routed Sushi rehearsal

**Local contract cycle complete; mainnet remains unapproved. Noah stays V2.** The financial rehearsal creates no keys/signatures. No real wallets, persisted private keys, submissions, physical deployments, production reads/writes, push or external sending. Sushi is unactivated; Phoenix remains retired for new routes only, with old instances preserved. Curve is deferred.

R15 proved cash-only creation through the factory and a separate full Sushi exit from a directly instantiated fixture vault. R17 joins those paths: the selected real factory WASM now creates the vault and share token with the real routed template, and that exact child completes the investment/withdrawal cycle. No product runtime, contract source, Rust dependency or selected WASM changed. Only the local harness, evidence and release documentation change.

## Fresh execution and financial result

- 89 ordered P29 host steps, of which 86 succeed and three intentionally reject. The host forbids direct deployment of either reserved factory child; there is no fixture substitution for creation.
- Factory `create_managed_routes` creates Arka `CAHH3PQGGYGERAOTBUXCD4CBFB4PEKXZYFKO2VYSIDCSQ2J5YJ6VPFC7` and share token `CBU4VLQGDEG3VTYD5KDONNCU6EWFT4RPIVPDZZHZXT22G5SAHWJ6WI3P`, sets the manager, valuation/risk/venue configuration, one non-denomination portfolio route and two Sushi directional bindings, and registers the child in both factory and registry. The factory ABI-encoded route bindings exactly equal the established accepted route vector.
- The reviewed template digest binds the configured fee terms. A synthetic manager with **zero allowance** pays exactly **5 USDC** to the synthetic treasury inside the one atomic creation call. This is a commercial fee, separate from Soroban resource fees. Investment is a subsequent explicit action; no auto-deposit or separate creation-fee approval is added.
- Investor deposits **1000 XLM**, swaps 100 XLM through captured Sushi XLM/USDC, adds **three raw USDC units**, requests every share, and executes **five contract-planned balanced liquidation lots**. Settlement and collection return **999.4009043 XLM**. This is all redeemable value after this simulated market's fees/spread, not a promise to recover nominal principal.
- Final shares, NAV, pending/claimable/cancelled shares, reserved assets and vault/adapter/router XLM/USDC balances are zero. Queue head equals next ID; IDs remain monotonic. Claimed assets are recorded and settled shares equal requested shares. Claiming already reserved cash succeeds while venues are paused.
- **15 adversarial/containment cases:** deep registry failure atomically rolls back creation/fee; changed fee rejects the old digest; unauthorized venue/caller changes fail; disabled and deprecated venues reject the reviewed trade; revoked caller rejects it; governed restoration resumes trading; pending withdrawal liquidation pauses and resumes; public-window, trade-cap and unbalanced-lot rejections persist; direct vault creation, applied upload, unpinned upload and Noah root access are denied. Expected contract failures preserve the RAM digest; positive nested auth is retained for deep-failure tests rather than accepting missing authorization as the intended guard.

## Resource measurements

Actual CPU is distinguished from simulation-adjusted instruction reservations. Memory is **Soroban metered memory**, not OS RSS. Fees below are frozen-configuration resource estimates, exclude inclusion/surge and commercial charges, and are measured once per invocation rather than counting recording/enforcing/replay as three transactions.

| Invocation | Actual / adjusted instructions | Metered memory bytes | Write bytes | Resource fee XLM |
| --- | ---: | ---: | ---: | ---: |
| Routed factory creation | 32,428,598 / 33,725,741 | 11,030,017 | 7,456 | 0.7800564 |
| Initial protected deposit | 3,643,908 / 3,789,664 | 2,683,204 | 3,984 | 0.1123802 |
| Sushi investment trade | 32,306,999 / 33,599,278 | 9,565,235 | 6,068 | 0.1630911 |
| First liquidation lot | 37,678,077 / 39,185,200 | 10,143,993 | 6,420 | 0.0350067 |
| Remaining four lots | 36,378,404–37,642,037 / 37,833,540–39,147,718 | at most 10,143,018 | at most 6,420 | 0.0049135–0.0049594 each |
| Settle | 5,426,026 / 5,643,067 | 2,797,964 | 3,572 | 0.0021975 |
| Claim while paused | 2,899,199 / 3,015,166 | 1,495,882 | 3,764 | 0.0018251 |

All **14 applied financial invocations** fit the checked frozen limits; their resource fee sum is **1.2834200 XLM**. This includes creation, token approvals, both deposits, investment trade, request, five lots, settlement and claim. Setup/deployment/configuration invocations add **1.1342311 XLM** in the synthetic fixture. Read-only getters and rejected probes are reported separately, not priced as executed chain transactions.

Pinned limits: 400,000,000 instructions, 41,943,040 memory bytes, 200,000 disk-read bytes, 132,096 write bytes, 400 total footprint entries, 200 write entries, 16,384 event bytes and 132,096 envelope bytes. Total footprint is not mislabeled as actual disk reads. Each successful invocation is checked. Envelope lengths use exact unsigned XDR plus the 72-byte encoding overhead of one ordinary 64-byte decorated signature; no signature bytes are generated. Account sequence/time bounds and the 100-stroop inclusion model are synthetic. Actual authority sets and fee-bump envelopes remain unqualified.

Seven **non-applied fresh upload** simulations price absent pinned code for Arka, factory, registry, share token, internal router, venue registry and Sushi adapter. Each hash and absence is verified; no captured row is modified. All seven fit the measured limits; aggregate resource estimate **332.0212475 XLM**. Arka alone: 130727 WASM bytes, 111005636 adjusted instructions, 130828 write bytes, 130976 modeled envelope bytes and **180.1105592 XLM**. This leaves only **1268 write bytes / 1120 envelope bytes** under these limits, and **345 bytes** under the separately retained 131072-byte WASM ceiling. Future changes must be remeasured. Shared code reuse and current TTL can materially change costs; this is not a current deployment quote or a complete platform launch budget.

## Maintenance findings and explicit sizing

The maintenance probes select eight Arka/share child data and shared code keys after full withdrawal. Expiry is artificial in a **separate RAM copy**; the financial state remains unchanged. No restore or TTL operation is applied.

| Probe | Write bytes | Resource fee XLM | Result under tested model |
| --- | ---: | ---: | --- |
| Combined restore of eight keys | 145860 | 373.9158614 | **Fails** 132096-byte write cap |
| Arka code restore alone | 130780 | 336.7682011 | Fits; one key |
| Share code and child instance/state restore | 15080 | 37.1482450 | Fits; seven keys |
| Minimum persistent-window TTL | 0 | 348.1439148 | Fits ordinary-envelope model |
| Maximum-window TTL | 0 | 535.0955290 | **Fails ordinary 32-bit fee-field model** |

The two restore groups are explicitly enumerated, disjoint and cover the failed combined footprint. The local runbook is to review/price them separately, never issue the combined operation, and re-read/prepare a financial action after authorized maintenance. This introduces no automatic maintenance, heuristic grouping engine, financial retry, second planner or product UI. These high-cost probes include shared code/long horizons; they are not per-withdrawal costs or a default TTL policy. Fee-bump sponsorship and actual restore execution/admission are not tested. The full auxiliary/shared footprint must be priced on an authorized current target before launch.

## Evidence, provenance and limits

Fresh local evidence lives in artifact area `v3-factory-routed-rehearsal-r17-20261031`: `rehearsal-r3/{main-summary,accepted-main,runs}.json`, gzip input/output pairs, `adversarial-r2/summary.json`, and `resource-measurements/{summary,config,invocations,uploads,maintenance}.json`. Host sources/locks/build logs, both host revisions, the initial ABI-shape driver failure, the pipe-input adversarial attempt that timed out, and all rejected-budget probes are preserved. The accepted adversarial revision uses a prewritten local stdin file; all 15 cases then pass with the same host/contract bytes. The accepted controller is `v3-factory-routed-rehearsal-r17/rehearsal-r3.mjs`; resource/adversarial controllers are separate; the accepted adversarial controller is negatives-r2.mjs. Compilations passed normal disk guards; no data was deleted.

The previously authorized R8 capture is ledger **65206504**, 2026-10-29 23:58:24 UTC, SHA-256 **5f29f8d2c651505504ba6e75e5c6200cde24c1b7f2ce4975c1316d5418817f5f**. Actual frozen Sushi pool/factory/token WASM and state are exercised. Funding, synthetic account identities, governance, oracle prices and local target namespace are fixtures. The P29 host enforces **SourceAccount authorization**, with OS network/filesystem writes denied during execution. It creates no keys or signatures and checks captured rows byte-for-byte. This is not cryptographic signing, current liquidity, target admission or consensus validation.

Full R15 native 282/frontend 1315/catalog 162+42/crypto 58 and the 24 reproduced selected WASM, plus the R16 SDK/lint/docs/dependency review, remain **retained by exact source/dependency identity**, not fresh R17 runs. R17 does not rerun the browser/backend workflow on the newly factory-created child: earlier full UI/backend RAM proofs used a direct fixture child. That fresh cross-layer bridge is a possible next local proof; it must not be described as already covered here. Product runtime has not changed. Fresh release/source/binding/CI/scope checks pass 32 cases. The 13 signature-policy guards also pass; their positive controls create nine runtime-random ephemeral test signatures under the existing contained profile, with no financial transaction signed. Defaults and imported-key attempts remain blocked. Those nine guard signatures are separate from the zero-signature factory/financial rehearsal. Acceptance checks also verify all 921 retained runtime files, 114 contract-tree files (84 Rust sources), five product dependency locks, 24 selected WASM and all 138 P29 transitive package blocks. A conservative total-footprint upper bound is below the frozen 200 disk-read-entry cap for every measured invocation, upload and maintenance probe; this is not an actual disk-read count. Signature counters and private-seed scans are retained with the evidence.

The two open dependency findings **R14-07 minimatch** and **R14-09 crypto-bigint** remain open. No major override, audit suppression, shim or risk waiver is added; no fresh registry/audit fetch is performed here. The R17 native harness uses the same pinned dependency package graph as the previously audited P29 host. Current target identities, complete index, governed activation/deactivation, oracles, live order-size liquidity, complete budget/admission, real wallet/device and explicitly authorized submitted canary, hosted CI, independent audit and deployment approval remain pending. The R14-era fee-approval limitation in the coverage summary was stale and is corrected: routed creation has atomic direct fee transfer and existing digest binding.
