# Tranche 2 Execution Plan (Post-Approval of Tranche 1)

Historical correction, `2026-03-30`:
- this document preserves the original tranche chronology and evidence trail
- the later `Balanced` lane recorded here was coupled to `Comet` on testnet and has been retired from the active Arkafund support surface
- the current supported live integrations are `Aquarius`, `SoroSwap`, and `Blend`
- historical references to the retired lane remain in this log for traceability only and should not be read as current support claims

This document is the execution baseline for Tranche 2, assuming Tranche 1 has already been approved.

## Scope Baseline

Tranche 2 target items:
- Balanced adapter (AMM)
- Blend lending adapter
- Coverage Vault logic + manager lock
- Community Coverage Fund contract
- Share tokenization (SAC) per Arka
- DAO contracts (Governor + timelock delay) with executable proposal on testnet
- Governed Arka upgrades/migrations (existing Arkas)
- Manager Tier module + UI

## Governance Model Note

This repo uses the vendored `soroban-governor` implementation, where `timelock` is a delay parameter on the Governor contract, not a separate Timelock contract deployment.

Closure for the governance requirement is therefore:
- Governor deployed on testnet
- non-zero `timelock` delay configured in Governor settings
- executable proposal run end-to-end (`propose -> vote -> close -> execute`)
- governed target action executed on `Arka` / `ArkaFactory`

## Current Starting Point

Implemented groundwork:
- Core contracts and testnet deployments from Tranche 1 are in place.
- Governance wiring and runbooks exist, including Snapshot proposal flow and trap mitigation notes.
- dApp create/deposit/redeem/rebalance flows exist for SoroSwap and Aquarius.

Known gaps relevant to Tranche 2 at the start of execution:
- Arka policy setters are still mostly manager-driven (not DAO-governed end-to-end).
- Rebalance slippage guardrails included hardcoded safety offsets in UI logic.
- Delay-governed upgrades and migrations for existing Arkas are not fully closed with an E2E proof.

## Execution Order (Recommended)

1) **Risk/Policy hardening first**
- Externalize rebalance safety parameters (slippage defaults and extra buffers) to env config.
- Add contract-side policy entrypoints for slippage/asset guardrails and wire ownership to governance path.

2) **DAO control surface**
- Add governed setters in `arka` for:
  - fees,
  - whitelist,
  - approved router/adapters.
- Route those setters through Governor authority with timelock delay.

3) **Adapters and liquidity integrations**
- Finish Balanced adapter E2E.
- Finish Blend adapter E2E (deposit/withdraw cycle).

4) **Coverage**
- Complete Coverage Vault lock controls and tests.
- Implement Community Coverage Fund flows + UI hooks.

5) **Upgradeable migrations**
- Execute a real proposal that upgrades/migrates an existing Arka through governance.
- Record tx hashes and before/after verification.

6) **Manager tiering**
- Implement tier module and connect UI trigger path.

## Completion Criteria for Tranche 2

Tranche 2 is considered complete when all items below are true:
- All target contracts deployed and validated on testnet with reproducible scripts.
- At least one executable governance proposal has been run end-to-end (propose, vote, close, timelock delay, execute).
- Existing Arka upgrade/migration executed through governance and documented.
- dApp exposes required Tranche 2 user flows with clear operational limits.
- Documentation includes exact commands, IDs, tx hashes, and rollback notes.

## Immediate Next Tasks (Now)

- [x] Externalize slippage guardrail constants in dApp config (remove hardcoded magic numbers).
- [x] Add Arka governed setter surface for policy changes.
- [x] Wire Arka setter authority to Governor flow with timelock delay.
- [x] Run and document first governed policy update flow against Arka.

## Iteration Log

### Iteration 1
- Delivered governed policy surface in `arka`:
  - `set_governor`, `set_fees`, `set_whitelist`, `set_manager`, governed `set_router`
  - strict BPS validation and typed authorization errors
- Contract tests executed:
  - `cargo test -p arka` (pass)

### Iteration 2
- Delivered governance propagation in factory create flow:
  - `create_and_init` now propagates factory governor to the new Arka via `set_governor`
- Added E2E operational script:
  - `scripts/e2e-governed-policy.sh`
  - performs governor bootstrap on Arka, fee update under governor authority, and verification reads
- Contract integration tests executed:
  - `cargo test -p arka-factory` (pass)
  - `cargo test -p arka` (pass)
- Testnet note:
  - current recorded `contracts.arka` in `deployments.testnet.json` may be stale (contract not found on latest RPC query), so live E2E requires refreshing deployments first.

### Iteration 3
- Refreshed testnet Arka deployment and updated `deployments.testnet.json`:
  - `contracts.arka`: `CCJ6L73INXPORJI7N7TIZP2F7YSTLP2CLP6UUGLJIYRVFSXZUUHWZRAX`
- Executed governed policy E2E runbook:
  - bootstrap `set_governor` tx: `33d3d501f2a4e38dce4d08bf296657fba4c70a8a078cc31f5232f5a27fa79f63`
  - `set_fees` tx: `4b71519f39764c02b8f0d1eb367e8fce81cc60356a1abd737501ff68f8f91013`
  - verification reads:
    - `governor() -> GCO7KAJ7WCIFDLAEDHKSFQRNQLR3SQ6JTIVSMYYFUC5KRTA2KG2QJYDE`
    - `fees() -> {mgmt_bps:50, perf_bps:100, deposit_bps:20, redeem_bps:20}`
- Contract integration tests re-run:
  - `cargo test -p arka-factory` (pass)
  - `cargo test -p arka` (pass)

### Iteration 4
- Delivered validated Coverage Vault implementation:
  - token-backed deposits (`transfer_from`) and withdrawals (`transfer`)
  - enforced lock ratio (`lock_bps`) on every withdrawal
  - governor-aware policy auth (`set_governor`, `set_lock_bps`)
  - typed contract errors and operational getters (`balance`, `max_withdrawable`, `token`, `manager`, `governor`)
- Contract integration tests:
  - `cargo test -p coverage-vault` (pass; 3 tests)
- Live E2E executed on testnet:
  - `coverageTestToken`: `CA33YVWPBWG6A7JPMMUEUUELUB3UPATI64K62RZFPGYCBJD5GFACOWGK`
  - `coverageVault`: `CCLEUWT6NSMIP2QFGHRIERDM453X24GC56ZNZH7VVEDVQ5JRNNRFB5BL`
  - deposit/governor/set-lock/withdraw successful with verification reads:
    - pre-withdraw: `balance=1000`, `max_withdrawable=700`
    - post-withdraw: receiver token balance `700`, vault balance `300`
  - lock-violation simulation confirmed with `Error(Contract, #7)` on over-withdraw
- Added reproducible runbook script:
  - `scripts/e2e-coverage-vault.sh`

### Iteration 5
- Delivered validated Community Coverage Fund implementation:
  - explicit `init(admin, stake_token, reward_token)`
  - token-backed `stake` / `unstake`
  - reward distribution via `add_rewards` + pro-rata accumulator (`acc_reward_per_share`)
  - user claiming via `claim`, plus read models `pending_reward`, `stake_of`, `total_staked`
  - governor-aware policy auth (`set_governor`) and typed errors
- Contract integration tests:
  - `cargo test -p coverage-fund` (pass; 3 tests)
- Live E2E executed on testnet:
  - `coverageFund`: `CCX5QACCFXC3VNMKUHBUZ2NGD2HNU6W47G3E3LBGPAK2DWX63FERA3MO`
  - flow validated: init → mint/approve → stake(500) → add_rewards(200) → pending=200 → claim=200 → unstake(100)
  - post-state validated:
    - staker token balance read: `1401`
    - `stake_of(staker)`: `400`
- Added reproducible runbook script:
  - `scripts/e2e-coverage-fund.sh`

### Iteration 6
- Delivered Balanced adapter as a real, configurable integration component:
  - `init(admin, router)` and `set_router(caller, router)` with admin auth
  - router getter and unified `execute(caller, pool_id, amount_in, min_out, receiver)` signature
  - explicit slippage guard (`out >= min_out`)
- Added deterministic integration router contract:
  - `balanced-router-mock` with on-chain 1% fee behavior and typed errors
  - allows repeatable adapter integration and E2E validation
- Contract tests:
  - `cargo test -p balanced-router-mock` (pass)
  - `cargo test -p adapter-balanced` (pass)
- Live E2E on testnet:
  - `balancedRouterMock`: `CAHF53IIWUVKFOJ4H7OHIB667NEU7MTC3YUHSIZWETFXXPAI6DS75HQK`
  - `adapterBalanced`: `CCLSTVIRZELBAMRRTZJPMNMMCWDUVS7WVS25GC4PWW37OUHKHRWZJUIL`
  - `execute(amount_in=1000,min_out=990)` returned `990`
  - negative simulation (`min_out=991`) failed as expected with contract slippage error
- Added reproducible runbook script:
  - `scripts/e2e-adapter-balanced.sh`

### Iteration 7
- Delivered Blend adapter as a real integration component:
  - `init(admin, router)`, `set_router(caller, router)`, `router()`
  - unified `execute(caller, action, market_id, amount, receiver)` with typed errors
  - action mapping: `Lend`, `Borrow`, `Repay`, `Liquidate`
- Added deterministic Blend integration router:
  - `blend-router-mock` contract with `execute_action` and deterministic outputs
  - enables reproducible adapter integration testing without external protocol drift
- Contract tests:
  - `cargo test -p blend-router-mock` (pass)
  - `cargo test -p adapter-blend` (pass)
- Live E2E on testnet:
  - `blendRouterMock`: `CDRXF7OXAQ3CUF33QO7ZQV2VFHE22SEQPYP4JL7MJJJMUOZCFAXMUKGV`
  - `adapterBlend`: `CCU3MJJ5RIH5VDYOUY2VBN54ZZQ5MX5MYA23TRIGEDRXQKGGYNYLCIKW`
  - `Borrow(1000)` returned `950`
  - `Liquidate(1000)` returned `900`
  - negative simulation `amount=0` failed as expected with typed `Error(Contract, #4)`
- Added reproducible runbook script:
  - `scripts/e2e-adapter-blend.sh`

### Iteration 8
- Delivered Manager Tier module as a production contract:
  - `init(admin, tier1_threshold, tier2_threshold, tier3_threshold)`
  - governance-aware policy (`set_governor`, `set_thresholds`)
  - scoring ops (`set_points`, `add_points`) and read models (`points_of`, `tier_of`, `thresholds`)
  - strict threshold validation and typed errors
- Contract integration tests:
  - `cargo test -p manager-tier` (pass; 3 tests)
- Live E2E on testnet:
  - `managerTier`: `CDQVWIBJDX3K3XS4OLL4HFFSG2KKQGOZU7TIFCLMXFDCJDRDOQLB6FGR`
  - flow validated:
    - add_points `+120` => tier `1`
    - add_points `+900` => total points `1020`, tier `3`
  - negative simulation validated:
    - invalid thresholds rejected with typed `Error(Contract, #4)`
- Added reproducible runbook script:
  - `scripts/e2e-manager-tier.sh`

### Iteration 9
- Delivered governed Arka migration hardening in `arka-factory`:
  - governance gate for `set_implementation` (requires governor auth; rejects when governor not set)
  - stricter governor rotation semantics (`set_governor` requires current governor auth once set)
  - migration registry:
    - `migrate_arka(old_arka, ...params...) -> new_arka`
    - `migrated_to(old_arka)` and `migrated_from(new_arka)` mappings
- Contract integration tests:
  - `cargo test -p arka-factory` (pass; includes migration mapping test)
- Live E2E on testnet:
  - updated `arkaFactory`: `CAZPR5MIUHXH46ZJ5OAMRZXD7PXIHMF5HHSSKQPDUBEXVID5SAGSZ3HW`
  - migration executed:
    - old arka: `CCJ6L73INXPORJI7N7TIZP2F7YSTLP2CLP6UUGLJIYRVFSXZUUHWZRAX`
    - new arka: `CCMA27FK5QULMDIOLYZ7ASSDX7TBRIZUORWSBMRIFLENPBLI73C7ZBJH`
  - mapping verified live via `migrated_to` / `migrated_from`
  - negative simulation validated:
    - `set_implementation` without governor fails with typed `Error(Contract, #2)`
- Added reproducible runbook script:
  - `scripts/e2e-arka-migration.sh`

### Iteration 10
- Delivered dApp wiring for Tranche 2 modules (no stubs):
  - new `coverage` page in `arkafund-dapp`:
    - reads `coverage-vault` live state (`balance`, `max_withdrawable`)
    - executes `coverage-fund` user flows (`stake`, `unstake`, `claim`) with wallet signing
    - includes token `approve` step before stake and post-tx state refresh
  - new `tiers` page in `arkafund-dapp`:
    - reads manager `points_of`, `tier_of`, and `thresholds`
    - executes governed `add_points` flow with wallet signing
  - app navigation wired in layout/home to expose both modules in UI
- Added typed Soroban client helpers for these flows:
  - `readCoverage*`, `buildCoverageFund*`, `readManagerTier*`, `buildManagerTierAddPoints`
  - shared tx helpers in `src/lib/tx.ts` (`signXdr`, `submitSignedTx`, `waitForTx`)
- Validation:
  - `arkafund-dapp`: `npm run build` (pass)
  - Contract E2E rerun on testnet (pass):
    - `scripts/e2e-coverage-fund.sh`
    - `scripts/e2e-manager-tier.sh`
- Operational hardening:
  - made both E2E scripts idempotent for repeated testnet runs by skipping `init` when contract is already initialized.

### Iteration 11
- Delivered enterprise dApp wiring for Tranche 2 integrations:
  - new `integrations` page in `arkafund-dapp` with:
    - on-chain health checks for `adapter-balanced` and `adapter-blend` (`router()` read + mismatch detection)
    - executable actions for both adapters from wallet:
      - Balanced: `execute(caller, pool_id, amount_in, min_out, receiver)`
      - Blend: `execute(caller, action, market_id, amount, receiver)`
    - full wallet signing, tx submission, and confirmation tracking
  - navigation wired in app shell/home to expose Integrations as first-class flow
- Added typed Soroban client helpers:
  - `readAdapterRouter`
  - `buildAdapterBalancedExecute`
  - `buildAdapterBlendExecute`
- Added config surface for integration IDs:
  - `ADAPTER_BALANCED`, `ADAPTER_BLEND`, `BALANCED_ROUTER_MOCK`, `BLEND_ROUTER_MOCK`
- Validation:
  - contract integration tests:
    - `cargo test -p adapter-balanced` (pass)
    - `cargo test -p adapter-blend` (pass)
  - dApp build:
    - `npm run build` (pass)
  - live E2E (testnet):
    - `scripts/e2e-adapter-balanced.sh` (pass; execute returns `990`)
    - `scripts/e2e-adapter-blend.sh` (pass; borrow returns `950`, liquidate returns `900`)
- Operational hardening:
  - made adapter E2E scripts idempotent by skipping `init` when already initialized.

### Iteration 12
- Delivered governance lifecycle wiring with a fully executable UI path:
  - new `governance` page in `arkafund-dapp` with wallet-driven actions:
    - `propose_snapshot_self`
    - `vote` (`0=Against`, `1=For`, `2=Abstain`)
    - `close`
    - vote-state read via `get_vote`
  - dApp navigation wired to expose Governance as a first-class route.
- Added typed Soroban helpers for governance operations:
  - `buildGovernorProposeSnapshotSelf`
  - `buildGovernorVote`
  - `buildGovernorClose`
  - `readGovernorVote`
- Added reproducible governance E2E script:
  - `scripts/e2e-governor-snapshot.sh`
  - supports testnet drift and reruns:
    - handles `ProposalAlreadyOpenError` by discovering active open proposal for creator
    - handles `AlreadyVotedError` gracefully
    - retries `close` while vote period is open and verifies final on-chain state
- Governance environment hardening:
  - `scripts/bootstrap-governance-user-admin.sh` updated to:
    - accept configurable governance settings through env vars
    - bootstrap with `propose_snapshot_self` instead of enum-marshalled council action
  - refreshed live governance IDs in `deployments.testnet.json` after stale contracts were detected.
- Validation:
  - contract integration tests:
    - `cargo test -p arka-factory` (pass)
    - `cargo test -p arka` (pass)
  - dApp build:
    - `npm run build` (pass)
  - live E2E:
    - `bash scripts/e2e-governor-snapshot.sh` (pass)
    - verified on-chain: proposal present/open (`status=0`) and vote recorded (`get_vote=1`).

### Iteration 13
- Delivered enterprise operations/health surface for Tranche 2:
  - new `ops` page in `arkafund-dapp` with live on-chain checks for:
    - `governor` readability (`settings`)
    - `votes` readability (`name`)
    - `coverage-vault` balance
    - `coverage-fund` total staked
    - `manager-tier` thresholds
    - adapter wiring health (`adapter-balanced.router`, `adapter-blend.router`)
  - app navigation/home wired to expose Ops as a first-class module.
- Added new typed read helpers in dApp Soroban client:
  - `readCoverageFundTotalStaked`
  - `isGovernorReadable`
  - `isVotesReadable`
- Delivered full Tranche 2 smoke orchestrator script:
  - `scripts/e2e-tranche2-smoke.sh`
  - executes all idempotent E2E scripts in one run:
    - coverage vault, coverage fund, manager tier, balanced adapter, blend adapter, governor snapshot
- Operational hardening:
  - made `scripts/e2e-coverage-vault.sh` robust for reruns (handles already-initialized token/vault gracefully).
- Validation:
  - contract integration tests:
    - `cargo test -p coverage-vault` (pass)
    - `cargo test -p coverage-fund` (pass)
    - `cargo test -p manager-tier` (pass)
    - `cargo test -p adapter-balanced` (pass)
    - `cargo test -p adapter-blend` (pass)
  - dApp build:
    - `npm run build` (pass)
  - live testnet smoke:
    - `bash scripts/e2e-tranche2-smoke.sh` (pass; all module scripts completed)

### Iteration 14
- Connected Balanced/Blend adapters to real protocol endpoints on testnet:
  - `adapter-balanced` upgraded to support real Comet pool routing:
    - new admin setter `set_pair(pool_id, token_in, token_out, max_price)`
    - new reader `pair_of(pool_id)`
    - `execute` now routes to real Comet `swap_exact_amount_in` when pair config exists
    - legacy mock path (`swap`) preserved for backward compatibility
  - `adapter-blend` upgraded to support real Blend pool routing:
    - new admin setter `set_market_asset(market_id, asset)`
    - new reader `market_asset(market_id)`
    - `execute` now routes to real Blend pool `submit` with request-type mapping:
      - `Lend -> Deposit Collateral (2)`
      - `Borrow -> Borrow (4)`
      - `Repay -> Repay (5)`
      - `Liquidate` guarded as unsupported in live submit mode
    - legacy mock path (`execute_action`) preserved for backward compatibility
- New live deployments and wiring:
  - `adapterBalanced`: `CDYF5QMFETJPMJZVLO7ZRL2KA4B4Y7F24Z33HH62NJL3GEQQXXLCCRLC`
  - `adapterBlend`: `CB256AHTJYHUX2KW4LEV2JYA4BDXHA622RBEAECCZEXNORTQ2GTZN2EN`
  - real endpoints stored in deployments:
    - `cometPool`: `CA5UTUUPHYL5K22UBRUVC37EARZUGYOSGK3IKIXG2JLCC5ZZLI4BDWDM`
    - `blendPool`: `CCEBVDYM32YNYCVNRXQKDFFPISJJCV557CDZEIRBEE4NCV4KHPQ44HGF`
- dApp wiring updated to real endpoints by default:
  - `integrations` and `ops` pages now validate against Comet/Blend real pool IDs
  - default adapter IDs updated to the new live adapter deployments
- E2E validation (live endpoint connectivity):
  - `scripts/e2e-adapter-balanced.sh` (pass):
    - verifies router, sets pair mapping, validates `pair_of`, reads live `get_spot_price` from Comet
  - `scripts/e2e-adapter-blend.sh` (pass):
    - verifies router, sets market-asset mapping, validates `market_asset`, reads live `get_config` from Blend pool
- Contract integration tests:
  - `cargo test -p adapter-balanced` (pass)
  - `cargo test -p adapter-blend` (pass)

### Iteration 15
- Closed the remaining Tranche 2 governance/share-token gaps in code and operations:
  - `arka` now supports an optional per-Arka share token via:
    - `set_share_token`
    - share-token-backed `deposit` mint and `redeem` burn
    - `share_token()` getter and `shares_of()` fallback to live token balance when configured
  - `arka-factory` now supports governed share-token rollout and migration:
    - `set_share_token_implementation`
    - per-Arka share-token deployment in `create_and_init`
    - `share_token_of(arka)` registry
    - governed `migrate_arka(...)` continues to track `migrated_to` / `migrated_from`
  - `test-token` extended with governed `burn` to support redeem path for share tokens
- Governance operations updated to prove executable target actions instead of direct admin writes:
  - `scripts/e2e-governed-policy.sh`
    - proposes `Arka.set_fees(...)` as Governor calldata
    - votes, closes, waits timelock delay, executes, then verifies `fees()`
  - `scripts/e2e-arka-migration.sh`
    - proposes `ArkaFactory.set_share_token_implementation(...)`
    - proposes `ArkaFactory.set_implementation(...)`
    - proposes `ArkaFactory.migrate_arka(...)`
    - votes, closes, waits timelock delay, executes, then verifies:
      - `migrated_to(old_arka)`
      - `share_token_of(new_arka)`
      - `new_arka.share_token()`
- Bootstrap and smoke runbooks aligned with final governance semantics:
  - `scripts/bootstrap-governance-user-admin.sh`
    - defaults Governor `timelock` to a non-zero delay
    - records governance timing config in `deployments.testnet.json`
    - documents that timelock is a Governor delay parameter, not a separate contract
  - `scripts/e2e-tranche2-smoke.sh`
    - now includes executable governance policy E2E
    - optionally includes governed migration with `RUN_GOVERNED_MIGRATION_SMOKE=1`
- dApp share accounting aligned with SAC rollout:
  - Arka detail page reads `share_token`
  - user balances come from the live share token when present, otherwise fall back to legacy internal shares
- Local validation:
  - `cargo test -p test-token -p arka -p arka-factory` (pass)

### Iteration 16
- Closed the final executable-governance proof on testnet for the governed migration path:
  - working Governor: `CBU6HR77QR3QYQCJI6K3F7YBR5NXBXJ33TFK7NUDTV6TE6SP672L5V6V`
  - governed migration factory (patched auth path): `CCDMWHQKG26372BW36K6LIUA2TNFLWA25MQS6BEIZ4O4CFDC3KADLDBX`
  - source Arka: `CBFH4CCHP4LJIDZTJWQWV2R3LSLVBOK76XYBJXPL7VERAPD4JDO6RILR`
  - migration proposal:
    - `proposal_id=3`
    - creation tx: `132ce7ceab80be0705ed6ae0ea65cf5c27bc381fb5ea1164a37f0c1fa97c8c9b`
    - execute tx: `27d9093be39669bb7cd4cb9253de76f6dbc6faf810f43e0058b786faa9640053`
    - vote tally at close: `for=1, abstain=2, against=0`
  - live post-execution verification:
    - `migrated_to(old_arka)` -> `CDGTUMIRJ37VA4W6TPJ6NLASJHRLQO4QYG6GYH7FGE3GD6WGV5VQO3II`
    - `migrated_from(new_arka)` -> `CBFH4CCHP4LJIDZTJWQWV2R3LSLVBOK76XYBJXPL7VERAPD4JDO6RILR`
    - `share_token_of(new_arka)` -> `CBVNDM33KHKJK7URW4EXWFVLU3BNPIMSYDMAFKCOSUGBRXZHVRY4I6PE`
    - `new_arka.share_token()` -> `CBVNDM33KHKJK7URW4EXWFVLU3BNPIMSYDMAFKCOSUGBRXZHVRY4I6PE`
    - `new_arka.governor()` -> `CBU6HR77QR3QYQCJI6K3F7YBR5NXBXJ33TFK7NUDTV6TE6SP672L5V6V`
    - `new_arka.manager()` -> `GCO7KAJ7WCIFDLAEDHKSFQRNQLR3SQ6JTIVSMYYFUC5KRTA2KG2QJYDE`
- Closure outcome:
  - governed `set_fees(...)` has been executed on testnet by proposal
  - governed `migrate_arka(...)` has been executed on testnet by proposal
  - per-Arka share token is live on the migrated Arka and matches the factory registry
  - Tranche 2 contract/governance closure criteria are satisfied on testnet

## Final Closure Checklist

For the remaining dApp-side alignment items that are not contract gaps, see:
- `docs/DAPP_TRANCHE2_ALIGNMENT_GAPS.md`

The four previously open closure items are now addressed in the repo as follows:
- Execution delay configured and used:
  - interpreted correctly as the Governor timelock-delay parameter in this implementation
  - bootstrap now defaults to non-zero delay and persists it in deployments metadata
  - executable scripts wait for `eta` before `execute`
- `set_fees` executed by proposal:
  - covered by `scripts/e2e-governed-policy.sh`
  - implemented through Governor `Calldata` proposal targeting `Arka.set_fees`
- `migrate_arka` executed by proposal:
  - covered by `scripts/e2e-arka-migration.sh`
  - implemented through Governor `Calldata` proposal targeting `ArkaFactory.migrate_arka`
- `SAC per Arka` as real share token:
  - implemented through factory-managed per-Arka share-token deployment
  - mint on deposit / burn on redeem
  - exposed via `Arka.share_token()` and `ArkaFactory.share_token_of(arka)`

### Iteration 17
- Closed the Blend vault-owned strategy gap in repo with live-valued multi-asset support:
  - `arka` now exposes:
    - `blend_lend`
    - `blend_borrow`
    - `blend_repay`
    - `blend_withdraw`
    - `blend_market_assets(market_id)`
    - `blend_position_value(market_id, asset)`
    - `blend_market_value(market_id)`
    - `blend_health_factor(market_id)`
    - `nav()`
  - Blend positions are now vault-owned and persisted per `(market_id, asset)` inside the Arka contract.
  - `nav()` now re-prices Blend positions using:
    - pool `get_positions(owner)`
    - reserve `get_reserve(asset)`
    - pool `get_config().oracle`
    - oracle `lastprice(asset)`
- Contract integration coverage added:
  - `cargo test -p blend-router-mock -p adapter-blend -p arka` (pass)
  - covers:
    - vault-owned lend/borrow/repay/withdraw lifecycle
    - live-position valuation from pool reserve/oracle reads
    - health-factor calculation
    - liquidity-aware redeem restrictions
- Repo-level multi-asset validation completed:
  - same market can carry more than one whitelisted asset
  - per-asset valuation aggregates into `blend_market_value(market_id)`
  - dApp reads and renders the market aggregate plus per-asset rows
- Current public testnet status:
  - the `Arka` currently referenced in `deployments.testnet.json` does not yet expose the new multi-asset Blend ABI
  - readonly probe on `CCMA27FK5QULMDIOLYZ7ASSDX7TBRIZUORWSBMRIFLENPBLI73C7ZBJH` rejects:
    - `blend_market_assets`
    - `blend_position(market_id, asset)`
  - therefore the multi-asset refactor is validated in repo, but still pending deployment/migration to the public testnet environment
- dApp closure for Blend vault strategy:
  - Arka detail page now renders Blend as a vault position, not a manager-side sidecar action.
  - dApp reads and displays:
    - collateral principal/live value
    - debt principal/live value
    - net value
    - oracle price
    - health factor
    - market aggregate value across assets
  - browser smoke E2E passes against the new UI surface.
- dApp validation:
  - `arkafund-dapp`: `npm run build` (pass)
  - `arkafund-dapp`: `npm run e2e` (pass)
  - wallet-backed live Blend browser E2E remains gated on a testnet environment where the upgraded ABI is deployed

## Closure Status

With Iteration 17, Tranche 2 remains closed across both repos for the originally delivered scope, and the Blend model is corrected in repo for:
- contracts
- executable governance on testnet
- share tokenization per Arka
- dApp wiring
- Blend as a vault-owned, live-valued strategy
- Blend multi-asset-per-market modeling in repo

Remaining work on top of the already closed Tranche 2 baseline:
- deploy/migrate the multi-asset Blend ABI to the public testnet environment
- broader multi-asset risk controls beyond the currently validated market/policy
- additional browser E2E matrix expansion

### Iteration 18
- Fixed the live Blend auth path against the real pool:
  - `Arka` now resolves the pool router from the adapter but calls `pool.submit(...)` directly for the live path
  - this avoids the extra live auth hop that was failing through `adapter.execute_with_asset(...)`
  - the mock pool was tightened to require `spender.require_auth()` so local integration is closer to the real pool behavior
- Live standalone validation was executed on testnet with fresh contracts:
  - validation adapter: `CALBSAX6ZOYRX7YD6HOIKGH2GSQKUXQS3RZ5GGQKXPUMRECRXE66AN4Y`
  - validation Arka: `CCU346HUBMZ7ZIRNNTWPIDHU2Y2OQ5XGTNPG25PZMVM64O7KWUBKB36X`
  - live pool: `CCEBVDYM32YNYCVNRXQKDFFPISJJCV557CDZEIRBEE4NCV4KHPQ44HGF`
  - live asset: `CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC`
- Live flow completed successfully with calibrated amounts for the current market limits:
  - deposit `10_000_000`
  - `blend_lend 1_000_000`
  - `blend_borrow 100_000`
  - `blend_repay 50_000`
  - `blend_withdraw 50_000`
- Live post-state verified on the validation Arka:
  - `blend_position(0, asset)`:
    - collateral amount: `950_000`
    - debt amount: `50_000`
  - `blend_position_value(0, asset)`:
    - collateral value: `949_998`
    - debt value: `50_000`
    - net value: `899_998`
    - health factor: `170_999_640`
    - oracle price: `4_200_000`
  - `blend_market_value(0)`:
    - net value: `899_998`
  - `liquid_balance(asset)`:
    - `9_100_000`
  - `nav()`:
    - `9_999_998`
- Scope note:
  - the live Blend market used here is still a single-reserve market path
  - multi-asset-per-market logic is implemented and integration-tested in repo
  - heterogeneous multi-asset live validation remains future matrix work, not a blocker for the auth-path fix

### Iteration 19
- Added on-chain Blend hardening in `Arka`:
  - governance-controlled `blend_risk_policy(market_id)`
  - readonly `blend_market_status(market_id)`
  - `nav()` fail-close on stale oracle data when the policy requires it
  - `blend_borrow` / `blend_withdraw` rejection if:
    - oracle data is stale, or
    - resulting health factor falls below the configured floor
- Default policy now ships with:
  - `max_oracle_age = 3600`
  - `min_health_factor = 12_500_000`
  - `fail_close_nav = true`
  - `fail_close_actions = true`
- Contract validation added:
  - stale oracle status test
  - stale oracle `nav()` fail-close test
  - minimum health-factor rejection test
  - `cargo test -p arka` (pass)
- dApp now reads and surfaces:
  - `blend_risk_policy`
  - `blend_market_status`
  - stale-oracle banner
  - action-blocked / NAV-blocked state
  - policy floor and oracle-age telemetry
- Browser validation:
  - `arkafund-dapp`: `npm run build` (pass)
  - `arkafund-dapp`: `npm run e2e` (pass, `5 passed / 3 skipped`)
- Fresh live testnet validation executed with the hardened ABI:
  - validation adapter: `CCQHJ5DJZFLFZ4JKLE5X4YDJN5HSFO6XLJ2GR6GPF76RBKKVJOEOK5OH`
  - validation Arka: `CBQNH4RGZODYGPOHVMBM3TJYH74PVM5ECM5VZJQU2DMOJFLEK2WUP4ME`
  - live pool: `CCEBVDYM32YNYCVNRXQKDFFPISJJCV557CDZEIRBEE4NCV4KHPQ44HGF`
  - live asset: `CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC`
  - configured policy:
    - `max_oracle_age = 3600`
    - `min_health_factor = 12_500_000`
    - `fail_close_nav = true`
    - `fail_close_actions = true`
- Live post-state from the hardened runbook:
  - `blend_market_status(0)`:
    - `has_live_pricing = true`
    - `has_stale_oracle = false`
    - `nav_blocked = false`
    - `risky_actions_blocked = false`
    - `health_factor = 170_999_800`
  - `blend_market_value(0)`:
    - `net_value = 899_999`
  - `liquid_balance(asset)`:
    - `9_100_000`
  - `nav()`:
    - `9_999_999`

### Iteration 20
- Refined oracle/feed integrity checks so they target data validity, not market volatility:
  - `blend_market_status(0)` now also exposes:
    - `has_invalid_oracle_data`
    - `has_future_oracle_timestamp`
    - `has_disabled_reserve`
    - `pool_status`
  - these flags feed the same fail-close / action-block logic as stale-oracle checks
- Added contract validation for invalid feed data:
  - invalid oracle price blocks market status
  - invalid oracle price blocks risky Blend actions
  - `cargo test -p arka` (pass)
- dApp now surfaces oracle/feed integrity explicitly:
  - oracle integrity line
  - reserve enabled line
  - pool status line
  - integrity warning banner when any of those checks fail
- Reduced live execution budget on Blend mutations:
  - removed unused `Aum` refresh from Blend mutation paths
  - `nav()` remains the live source of truth
  - this unblocked the full live `lend -> borrow -> repay -> withdraw` path on the hardened ABI
- Final live testnet validation after the budget-safe oracle-integrity patch:
  - validation adapter: `CAVTLHVRGDNOABR3PPDBEMPN66545VG25WX3AOMCEP2IEZLMTZLZ7CRS`
  - validation Arka: `CAACTDDXPZDU3TFJNJD5XWDF4NBYC4VCAEBM2FZVFJ5FSGLETLWQWIL3`
  - live pool: `CCEBVDYM32YNYCVNRXQKDFFPISJJCV557CDZEIRBEE4NCV4KHPQ44HGF`
  - live asset: `CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC`
- Live post-state from the final runbook:
  - `blend_market_status(0)`:
    - `has_live_pricing = true`
    - `has_stale_oracle = false`
    - `has_invalid_oracle_data = false`
    - `has_future_oracle_timestamp = false`
    - `has_disabled_reserve = false`
    - `pool_status = 0`
    - `nav_blocked = false`
    - `risky_actions_blocked = false`
    - `health_factor = 170_999_800`
  - `blend_market_value(0)`:
    - `net_value = 899_999`
  - `liquid_balance(asset)`:
    - `9_100_000`
  - `nav()`:
    - `9_999_999`
