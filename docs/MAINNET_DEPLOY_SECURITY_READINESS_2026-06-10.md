# Mainnet deploy security readiness

Date: 2026-06-10

This note captures the security/runtime items that must be checked before the mainnet deployment. It separates contract-enforced controls from product/planner controls.

## Executive status

Arka has a real security foundation for a guarded mainnet launch, but not for a fully open, uncapped manager launch.

Mainnet deploy can proceed only if the launch is configured as:

- curated/known managers at first;
- non-empty asset and venue allowlists, inherited from factory defaults for newly created Arkas;
- `swap_risk_policy` enabled from factory defaults;
- global `venue-registry` configured so a guardian/governor can disable a protocol without touching each Arka one by one;
- OracleGuard or equivalent provider policy configured for every admitted asset;
- explicit creation fee and listing policy, as defined in `docs/ARKA_LISTING_AND_DISCOVERY_POLICY_2026-06-10.md`;
- storage lifecycle runbook executed after deployment.

If arbitrary managers can rebalance arbitrary paths on day one, the partial guardrails below should be moved on-chain first.

## Launch blockers before public capital

| Item | Status | Required before mainnet public use |
| --- | --- | --- |
| Global venue kill switch | Implemented 2026-06-11 | Deploy/configure `venue-registry`; register SoroSwap, Aquarius, Phoenix and Blend adapter instances before public execution. |
| Venue allowlists | Implemented; new Arkas inherit factory defaults | Configure non-empty `allowed_adapters` defaults for AMM venues, and keep per-Arka allowlists for portfolio-specific restrictions. |
| Swap risk policy | Implemented; factory defaults added 2026-06-11 | Configure `set_default_swap_risk_policy(... enabled=true ...)` and `set_default_swap_oracle(oracleGuard)` before public creation. |
| OracleGuard | Implemented | Deploy/configure mainnet OracleGuard with primary/secondary policies for all admitted assets. |
| Creation fee and listing policy | Implemented mechanics, policy unset | Configure USDC creation fee and treasury, or document a permissioned/rate-limited beta exception; publish default listing criteria before public creation. |
| Asset list | Implemented at vault level | Use only real mainnet asset contracts; no test/demo symbols. |
| Storage lifecycle | Scripts exist | Run strict dry-run on the mainnet manifest, then live extend after deploy; schedule recurring extension. |
| Fee caps | BPS validation exists; business caps not hard-coded | Either enforce on-chain caps or restrict through governor/launch policy. |
| Bootstrap admin handoff | Implemented, patched 2026-06-10 | `clear_bootstrap_admin_expiry` now writes an expired timestamp instead of removing expiry, so clearing cannot accidentally reactivate the bootstrap admin forever. |

## Swap guardrail state

Contract-enforced today:

- asset whitelist on `asset_in` and `asset_out`;
- global venue registry check for swaps and Blend credit actions;
- allowed routers/adapters when lists are non-empty;
- max trade size as bps of current Arka liquid balance;
- stale/future/zero oracle blocking;
- slippage cap;
- price impact cap;
- TWAP/reference deviation cap;
- per-step `min_out` atomic failure.

Partial / dApp-planner controls:

- absolute `max_notional_per_swap`;
- `max_path_length`;
- `forbid_route_cycles`;
- `chunking_threshold`;
- `max_chunk_size`;
- `post_trade_deviation_bps`;
- `daily_turnover_cap_bps`;
- `emergency_pause_swap`.

Interpretation:

- These partial controls exist in the frontend route planner and operator policy model.
- They are not hard on-chain invariants in `Arka`.
- They are acceptable only for a guarded launch where execution is routed through the product planner and managers are curated.
- They are not enough for permissionless direct contract invocation by unknown managers.

## Allowlist policy for launch

Required:

- `venue-registry` must mark disabled protocols as `STATUS_DISABLED`, manual-only credit venues as `STATUS_MANUAL_ONLY`, and AMM venues eligible for routing as `STATUS_AUTO`.
- `allowed_adapters` must include only adapters admitted for production.
- `allowed_routers` must include only external routers admitted for production.
- New Arkas must inherit `venueRegistry`, `swapOracle`, `allowed_adapters` and `swapRiskPolicy` from the factory.
- If all execution goes through the internal Arka router, `allowed_adapters` still must be non-empty.
- Do not leave both lists empty on mainnet launch, even though the global registry is now fail-closed for unregistered venues.

Recommended initial AUTO venues:

- SoroSwap only if the mainnet router/pools are verified.
- Aquarius only if mainnet router/pools are verified.
- Phoenix after the configured pool route is live and canaried.
- Balanced/SODAX is not part of the AMM adapter registry; readiness is controlled through the server-side intent driver.

## Swap risk policy for launch

Required:

- Enable `SwapRiskPolicy.enabled`.
- Enable `oracle_checks_enabled`.
- Configure a swap oracle, preferably through OracleGuard.
- Use conservative launch limits:
  - price impact cap;
  - slippage cap;
  - reference deviation cap;
  - max oracle age;
  - max trade size bps of liquid balance.

Operationally, disabling AUTO is safer than launching with default `enabled=false`.

## OracleGuard launch policy

Required per asset:

- primary provider;
- secondary provider or documented single-provider exception;
- max accepted age;
- max deviation bps;
- divergence handling mode;
- emergency guardian, preferably multisig, with expiry;
- DAO/governor handoff plan.

OracleGuard supports:

- fail-closed divergence;
- use-secondary on divergence;
- use-lower-price on divergence;
- emergency pause per asset;
- admin/governor/guardian authority separation.

## Storage lifecycle

Yes, storage expiration can become a production problem.

Implemented safeguards:

- high-value dynamic persistent keys are bumped on reads/writes in core contracts;
- `scripts/storage_lifecycle_extend.py` can extend canonical contract instances from a deployments manifest;
- `scripts/deploy-storage-lifecycle-extend.sh` wraps operator execution;
- `scripts/e2e-storage-lifecycle.sh` validates dry-run/evidence generation;
- `scripts/release_gate.py` includes a storage lifecycle dry-run audit.

Verified on 2026-06-10:

- `bash scripts/e2e-storage-lifecycle.sh` passed.
- `python3 scripts/storage_lifecycle_extend.py --dry-run --strict --out-json tmp/storage-lifecycle-audit-current.json` passed.
- `python3 -m unittest scripts.tests.test_storage_lifecycle_extend` passed.
- Current testnet manifest dry-run found 21 eligible contract instance targets and 0 failures.

Limitation:

- The script extends manifest contract instances. It does not automatically enumerate every dynamic persistent key such as all balances, registry rows or OracleGuard asset policies.
- Dynamic keys are bumped when touched by contract methods. Long-idle persistent entries can still need restore/extend.

Mainnet requirement:

- Create/update `deployments.mainnet.json`.
- Run strict dry-run against the mainnet manifest.
- Execute live extension immediately after deploy.
- Schedule recurring lifecycle extension and alerting.
- Keep restore runbook available for archived persistent entries.

## Listing/discovery policy

Creation, registration, public listing, and curation must stay separate.

Required launch posture:

- A newly created Arka may be registered on-chain without automatically being promoted in public discovery.
- Default Discover and leaderboard surfaces should show indexed, non-delisted Arkas that pass product eligibility.
- Curated/featured surfaces should use governed curation, not arbitrary frontend-only promotion.
- Delisted Arkas must be hidden from default public lists.
- If public creation is free, a stronger listing gate is required: minimum deposit, listing bond, DAO/curator approval, rate limiting, or equivalent anti-spam control.

Current implementation note:

- `ArkaRegistry` supports active registration, manager-level curation, and Arka-level delisting.
- It does not yet expose a distinct per-Arka `listed` or `verified` tier.
- For a guarded launch this is acceptable if the catalog/frontend policy is explicit. For a fully permissionless launch, add per-Arka listing tiers or another objective listing gate.

## Bootstrap admin and DAO handoff

The launch model is a temporary bootstrap admin followed by DAO/governor control.

Current mainnet predeploy target:

- Bootstrap admin: `GBHIT7TXZSRWT4QZXKINECMQWKC7NC7GBJAGK6XFOURI3T6ZHJDTHCMD`
- Bootstrap expiry: `2027-06-10T12:05:32Z` (`1812629132`)
- Planned window: 365 days from the 2026-06-10 predeploy manifest.

Interpretation:

- During the bootstrap window, the admin is a sovereign operational key and can upgrade contracts that expose the governed `upgrade` method.
- The bootstrap window is for audit response, launch validation, emergency fixes and initial campaign operations.
- Tokenomics activation and DAO operations should still require explicit configuration transactions; they are not considered fully decentralized while the bootstrap admin remains active.
- After handoff, upgrade and policy changes should be controlled by the governor/DAO path.

Implementation note:

- Contracts with `clear_bootstrap_admin_expiry` were patched on 2026-06-10 to set `BootstrapAdminExpiresAt = 0` instead of removing the expiry key.
- This avoids the dangerous state where `None` could be interpreted by `bootstrap_admin_expired()` as "not expired", leaving the admin active indefinitely.
- Contracts with `set_bootstrap_admin_expiry` now treat the bootstrap expiry as non-extendable once set: follow-up calls may shorten the window, but cannot push it farther into the future.
- Contracts that use `clear_bootstrap_admin` and remove both bootstrap admin and expiry keep that stronger behavior.

## Not mainnet blockers if launch is guarded

These are not blockers for a curated, capped launch, but must be tracked:

- pool-depth-aware cap instead of liquid-balance proxy;
- on-chain max path length;
- on-chain route-cycle rejection;
- on-chain absolute notional cap;
- on-chain daily turnover accounting;
- post-trade invariant checks.

## Hard no-go conditions

Do not open mainnet public capital if any of these are true:

- no mainnet OracleGuard/provider policy for admitted assets;
- missing or unconfigured `venue-registry`;
- empty venue allowlists with executable swaps advertised;
- `swap_risk_policy.enabled=false` while swaps are advertised as executable;
- no creation fee or listing quality gate while factory is permissionless;
- storage lifecycle dry-run fails on the mainnet manifest;
- deployment manifest contains testnet/demo assets or retired routes;
- bootstrap admin/DAO handoff is not disclosed and time-bounded.
