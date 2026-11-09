# R8 — Sushi actual-bytecode fork and financial replay

2026-10-30. Runtime baseline: R7 commit `2c72b9b0cdca8b6e9bfe043d237f39446de49a31`. R8 changes documentation and evidence inventory only. All 24 selected WASM files and application, contract, routing and SDK sources remain identical to R7. Mainnet is not approved; Sushi is not activated; Noah remains V2.

## Fresh validation

| Check | Result | Boundary |
| --- | --- | --- |
| Financial VM replay of current Arka WASM | 28 scenarios / 105 economic observations pass | Initialized RAM states derived from dated snapshots; not a new chain cycle |
| Sushi quote execution | 10 quotes, both directions, 1–10,000 units; same-ledger reference matches | Actual captured bytecode and frozen state |
| Sushi adapter swaps | Six fills: 100, 1,000 and 10,000 units in each direction | Exact balance deltas, output equals quote, adapter dust preserved |
| Adapter failures | Five atomic rejections | Excessive minimum output, unauthorized/revoked caller, zero input, absent route; balances and RAM unchanged |
| Arka deposit → Sushi → withdrawal request | 30 steps pass | Current Arka/router/registry/adapter WASM; synthetic new vault, funding and oracle |
| Manager recovery with fees; public spot recovery without fees | Two 64-step cycles pass | Unchanged 25% input-balance cap; partial recovery, settlement, paused-venue cash claim, cancellation lock and remaining shares returned |
| Venue lifecycle with actual Sushi counterpart | 42 steps pass | Five atomic rejections; governed reactivation succeeds; NAV preserved |
| Host boundary rejection | 14 cases pass | Capture/clock/hash/network pins, Noah exclusion, source/method restrictions, upload and signature-container rejection |

Arka WASM: `bb4abe4382fb7c913e64cc464bc1c2dcda64d4e3b98da0a18b04bd742e9a955d` (131058 bytes). Only 14 bytes remain below the retained 131072-byte ceiling. No runtime limit or contract was changed to obtain a passing test.

## Captured counterpart and measured liquidity

The human authorized public RPC reads limited to Sushi and its tokens/pools. Capture includes the USDC issuer account required by its asset contract and P29 network configuration. No Noah state was requested. Zero signatures, submissions or production writes occurred. Initial preparation predates authorization; its `productionAccess=false` does not describe the later authorized capture.

Coherent fork: ledger **65206504**, **2026-10-29 23:58:24 UTC**, protocol 29, 34 explicit ledger keys including temporary oracle buckets and explicit absences. Header identity/time and executable/code hashes are verified. Getter discovery may precede this ledger; execution uses coherent ledger entries and one separately captured same-ledger reference quote.

| Identity | Address / SHA-256 |
| --- | --- |
| Factory | `CD3KRKGDRVWPXVB3VXLUMQKMX6XZ6Q2H334IVZD4XXNAMKSRVQL5GLYF` |
| XLM/USDC 0.30% pool | `CCR2CH4GQVCZHG7CHFVMNANCK45CU5DVKXZIIITDZQAU3CEJZ7RQH2MQ` |
| Factory WASM | `9f94c577ea24c2f71cbb0c964c9c9d321e02448d1fe946020afb18974b1c2602` |
| Pool WASM | `003710b383f9da7d650a7f719a7be479110266427817ebbed61d924505fcd7c7` |

Frozen inventory: **2,230,920.5107477 XLM + 241,589.9398888 USDC**. At the pool's own spot ratio (0.1623771049648986 USDC/XLM), inventory is approximately **603,840.35 USDC**. This is one pool's inventory valuation, not venue-wide TVL, volume, external USD valuation or guaranteed executable depth.

| Input | Actual local fill output | Shortfall versus frozen spot, including 0.30% fee |
| --- | --- | --- |
| 100 XLM | 16.1887028 USDC | 0.3018% |
| 1,000 XLM | 161.8605281 USDC | 0.3181% |
| 10,000 XLM | 1,615.9599956 USDC | 0.4810% |
| 100 USDC | 613.9340357 XLM | 0.3112% |
| 1,000 USDC | 6,133.1568972 XLM | 0.4116% |
| 10,000 USDC | 60,723.540906 XLM | 1.3989% |

These isolated adapter fills do not bypass Arka's trade-size, slippage, oracle or governance limits. Order size materially changes execution cost; launch orders need current quotes and the intended fund policy.

## Open finding: full cash liquidation under the retained cap

The contract enforces `amount_in <= floor(liquid_balance(input_asset) * max_trade_size_bps / 10000)`. The denominator is remaining input-asset balance, not fund NAV. At `max_trade_size_bps=2500`, selling the complete USDC position rejects atomically with `SwapTradeSizeExceeded` (error 25), although the position is only about 10% of fund NAV.

From a 1,000-XLM deposit, the manager test sells 25% then 25% of the remainder, claims **943.4883382 XLM**, retains **9.1061454 USDC**, and returns **56.1043987 owner shares** after the cancellation lock. The manager retains **0.0000380 fee shares**. The public test sells one quarter, claims **924.8505637 XLM**, retains **12.1415271 USDC**, and returns **74.8017487 owner shares**, with no fee shares. Tokens and ownership reconcile exactly. These are partial exits, not complete redemptions.

Repeated fractional sales cannot empty a balance under a strict sub-100% cap on the remainder; integer rounding eventually leaves an untradeable residual. Before launch, align liquidation planning, routing and dapp with the cap, and define an explicitly reviewed final-residual exit. Never silently increase limits, call an unfilled request complete, hide holdings or turn read failures into zero. `prepare_asset_liquidity` concerns Blend collateral; public spot liquidation uses `liquidate_withdrawal`.

The exact-WASM planner regression confirms `portfolio_liquidation_steps` proposes **16.1886966 USDC**, while the current cap permits **4.0471757 USDC**. Executing that generated step rejects atomically with error 25. This is an open planner/policy compatibility issue, not an unverified suspicion.

## Evidence and limits

Evidence: `artifacts/v3-sushi-financial-r8-20261029T233203Z` under the managed-withdrawals workspace root, alongside controllers in `v3-sushi-financial-r8`. Closeout indexes accepted input/receipt hashes, source/binary provenance and recursive R7 integrity verification. Failed diagnostic revisions are preserved and excluded from accepted counts.

The fork is RAM state execution using official `soroban-env-host`/`soroban-simulation` 29.0.0, not a consensus node. Host processes deny network and file writes. P29 enforces source-account authorization and actual WASM enforces nested contract authorization; this does not validate real wallet signatures/devices. Accounts, funding, oracle and Arka governance are synthetic. Captured Sushi code and initial state remain unchanged. Plaintext invalid signature bytes in a negative test are never cryptographic signatures.

The public endpoint returned unsolicited opaque ledger metadata. Raw responses are preserved; that metadata is excluded from normalized fork inputs and was not used to inspect other contracts. The [official Sushi deployed-WASM harness](https://github.com/sushi-labs/sushiswap/blob/573bda7cc150fb073d15a3f23ce63f195140a96d/apps/web/test/stellar/wasm/src/main.rs) informed ABI inspection. Its mint/network scripts and mocked authorization were not acceptance evidence.

## Remaining mainnet gates

Resolve liquidation planning/cap/residual behavior; review launch sizes. Reconcile deployed Arka identities, permissions, complete factory/position index, oracles, callers, routes and catalog under separate authorization. Price current upload/setup/restore/TTL/inclusion; validate real wallets/devices and an authorized canary; run hosted CI and obtain independent audit on the exact candidate; obtain deployment/activation approval. Balanced/SODAX, added assets and RWA remain separate integrations. Noah is never migrated and Phoenix-bound instances must not be upgraded with this template.

See [MAINNET_PENDING.md](MAINNET_PENDING.md) and [structured pending work](../release/mainnet-pending.json).
