# R7: Phoenix retirement and Sushi candidate

This is a local release candidate. No production reads, signatures, submissions, activation or deployment are authorized. Noah remains V2. Runtime-random signatures belong only to the existing contained offline test profile.

## What changes

- Phoenix is retired from new routing: the API returns 410, SDK execution refuses it, runtime policy cannot revive it and the launch UI shows Sushi. Historical code, metadata and accounting remain preserved. The old enum is not accepted by the new managed template: **never upgrade an existing Phoenix-bound managed instance**.
- Sushi uses a new immutable Stellar adapter, not the Phoenix ABI. It verifies factory registration, token order, fee and pause state, uses full-width U256 price limits and exact bounded token-transfer authorization, rejects partial or inconsistent fills and enforces received balances/minimum output atomically. Governance explicitly authorizes each fund caller; no open dust claim, upgrade method or allowance is introduced.
- New managed bindings pin both directional pool configurations. The factory uses the same Sushi family and the new venue-registry bytecode. Current identities are in `release/contract-selection.json`; `r4-import.json` is origin evidence only. SDK/catalog bindings are regenerated from the current WASM.
- The registry separates emergency pause (0), manual (1), manual/auto (2) and deprecated (3). Deprecated credit markets permit withdrawal/repayment while refusing new supply/borrowing. Emergency pause blocks external calls. Neither state erases assets, debt, NAV, queues or reserved cash claims. Conversion through a paused/deprecated swap venue is not implicitly authorized; recovery can require a separately reviewed, governed manual reactivation.
- Routing checks current fund registry state and Sushi caller/binding identity. Unknown/stale/foreign-network permissions block admission. Reviews pin policy and route identity and re-read before signing, after the wallet returns and before submission. A changed body or fee-bump wrapper is rejected. Direct operator adapter builders also require registry review. Managed transport retains its separate network/ledger/review fences.

## Configuration and validation before activation

1. Approve exact network, contract addresses, deployed code hashes, factory, pool identities and governance roles. Public source addresses are research metadata, never verified deployment evidence.
2. Configure `SUSHI_ADAPTER`, `SUSHI_FACTORY`, directional route IDs, `PLATFORM_VENUE_REGISTRY` and actual fund bindings. Routes are immutable: allocate a new ID to change a pool/path. Authorize each reviewed fund with `set_caller`; revoke explicitly when necessary. Keep activation disabled during setup.
3. Exercise governance/guardian transitions, expiry and reactivation; reconcile registry, local fund allowlists, router, API and dapp. Review rejection must occur before the wallet opens when permissions changed. Recheck positions, debt, NAV and cash claims after every transition.
4. Validate the **actual Sushi counterpart** in both directions, with approved assets and intended order sizes. Measure executable depth, spread, fees, slippage, partial-fill behavior and token authorization. Local ABI fixtures are not proof of actual pool execution or current liquidity.
5. Reprice the complete upload/setup/creation/restore/TTL sequence. R7 vault is 131058 bytes (14-byte headroom); factory/registry/adapter identities changed. The dated P29 replay does not establish current admission. Prior 28-scenario/105-observation financial evidence is historical, not a fresh proof for this vault.
6. Complete the full intended VM financial replay, real wallet/device canary, hosted CI and independent audit on the exact commit, then obtain explicit deployment authorization. Existing bundled canary records remain historical; Phoenix evidence is never Sushi evidence. `mainnetApproved` stays false.

## Launch scope

Use SoroSwap and Aquarius plus Sushi only after their actual pair/order-size validation. Keep Blend as a separate credit capability, with borrowing off unless independently approved. Keep Balanced/SODAX gated until its full quote, intent, settlement, timeout and refund lifecycle is proven. Add assets gradually with valuation, decimals, issuer authorization and exit-liquidity tests. RWA tokens are assets; enabling one does not create issuer access or remove KYC/transfer restrictions. No RWA venue is activated by R7.

Reproduce with the pinned Node/Rust/CLI/Binaryen identities and current locks. Run `release/check-local.mjs`, `release/verify-bindings.mjs`, the entire native workspace (including integration targets), and `release/build-contracts.mjs arka arka-factory venue-registry adapter-sushi`. Local Mac disk guards apply before builds. Evidence and any failed intermediate attempts are retained outside this worktree in the R7 audit directory.
