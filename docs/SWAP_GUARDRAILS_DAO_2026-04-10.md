# Swap Guardrails DAO Policy (2026-04-10)

## Scope

This document defines protocol-level guardrails for `Arka` swap/rebalance execution.
All limits are DAO/governor controlled. Managers cannot loosen policy.

## 15 Guardrails

1. `max_price_impact_bps`
2. `max_slippage_bps`
3. `max_twap_deviation_bps`
4. `oracle_max_age_seconds`
5. `max_trade_size_bps_of_pool`
6. `max_notional_per_swap`
7. `allowed_assets`
8. `allowed_venues`
9. `max_path_length`
10. `forbid_route_cycles`
11. `chunking_threshold`
12. `max_chunk_size`
13. `post_trade_deviation_bps`
14. `daily_turnover_cap_bps`
15. `emergency_pause_swap`

## Mainnet status snapshot

Date: 2026-06-10

| Guardrail | Status | Enforcement today | Mainnet note |
| --- | --- | --- | --- |
| `max_price_impact_bps` | Implemented | `Arka::rebalance` via oracle-normalized value loss. | Must enable `swap_risk_policy` and configure `swap_oracle` before public AUTO. |
| `max_slippage_bps` | Implemented | `Arka::rebalance` compares input value against `min_out` value. | Same as above. |
| `max_twap_deviation_bps` | Implemented as oracle/reference deviation | `Arka::rebalance`; currently depends on the configured oracle reference/TWAP semantics. | Use OracleGuard/provider policy for production feeds. |
| `oracle_max_age_seconds` | Implemented | `Arka::rebalance` fails on stale/future oracle timestamps. | Must set production max age per launch policy. |
| `max_trade_size_bps_of_pool` | Partial | Implemented as `max_trade_size_bps` against current Arka liquid balance, not pool depth. | Acceptable for a capped launch; not equivalent to pool-depth-aware routing. |
| `max_notional_per_swap` | Partial, dApp only | Evaluated in the frontend route planner before handoff. | Not enforced if a manager calls the contract directly. Add on-chain absolute cap or launch with strict operational limits. |
| `allowed_assets` | Implemented | Arka whitelist checks `asset_in` and `asset_out`. | Must deploy only real mainnet assets and enforce no arbitrary input fields. |
| `allowed_venues` | Implemented with configuration caveat | `set_allowed_venues` stores routers/adapters and `rebalance` checks them. | Empty router/adapter lists are fail-open today; mainnet must configure non-empty lists or change code to fail-closed. |
| `max_path_length` | Partial, dApp only | Frontend planner evaluates selected route hops. | Not enforced on-chain. If arbitrary multi-step rebalance is allowed, this should be on-chain. |
| `forbid_route_cycles` | Partial, dApp only | Frontend planner checks repeated assets in selected route paths. | Not enforced on-chain. Mitigate by allowing only single-hop/simple routes at launch. |
| `chunking_threshold` | Partial, dApp only | Frontend planner requires split-route optimizer above threshold. | Not enforced on-chain; safe only when execution uses the product route planner. |
| `max_chunk_size` | Partial, dApp only | Frontend planner validates split allocations. | Not enforced on-chain. |
| `post_trade_deviation_bps` | Partial, dApp only | Frontend planner requires NAV/quote state or explicit projected deviation. | Not enforced on-chain. Needs reliable NAV/indexer state. |
| `daily_turnover_cap_bps` | Partial, dApp only | Frontend planner checks supplied daily turnover/NAV state. | Not enforced on-chain and depends on catalog/indexer state. |
| `emergency_pause_swap` | Partial | Frontend planner can block route handoff; OracleGuard can pause asset pricing. | There is no dedicated on-chain `pause_swap` flag on `Arka`; disabling swap policy/venues/oracle can mitigate operationally. |

Launch interpretation:

- The contract-enforced launch core is: allowed assets, allowed venues, max trade size proxy, stale oracle, slippage, price impact and reference deviation.
- The remaining controls exist as frontend/planner or operational controls, not hard on-chain invariants.
- For mainnet with uncapped external managers, the partial items should be moved on-chain. For a guarded launch with curated managers, capped TVL and non-empty allowlists, they can be treated as launch risks with explicit mitigation.

## Implementation Plan

### Phase 1 (current start: DAO-only, hard enforcement in contract)

This phase starts implementation of the first 7 controls.

Implemented in this iteration:

- `allowed_assets`:
  - enforced during `rebalance` for both `asset_in` and `asset_out`.
  - uses existing whitelist policy in `Arka`.
- `allowed_venues`:
  - added DAO entrypoint to configure `allowed_routers` and `allowed_adapters`.
  - enforced in `rebalance`:
    - internal route (`router == arka.router`): adapter must be allowed.
    - external route (`router != arka.router`): router must be allowed.
- `max_trade_size_bps_of_pool` (v1 proxy):
  - implemented as `max_trade_size_bps` against current vault liquid balance of `asset_in`.
  - blocks oversized trades before execution.
- `oracle_max_age_seconds`:
  - added swap oracle support (`set_swap_oracle`) and stale feed enforcement.
- `max_price_impact_bps`, `max_slippage_bps`, `max_twap_deviation_bps`:
  - enforced with oracle-normalized value checks:
    - compare `value(asset_in, amount_in)` vs `value(asset_out, min_out)`.
    - derive loss/deviation in bps and block when any threshold is exceeded.

Notes:

- `max_trade_size_bps_of_pool` is implemented as a liquidity proxy in v1 to stay adapter-agnostic.
- `max_twap_deviation_bps` currently uses the configured oracle reference (`lastprice`) as the trusted benchmark. If the oracle provider supplies TWAP semantics, this is TWAP-backed.

### Phase 2 (next)

- Add explicit pool-depth based cap when pool state is available per venue.
- Add path-level controls (`max_path_length`, `forbid_route_cycles`).
- Add turnover and post-trade breaker controls.

## Contract API Added

- `set_swap_risk_policy(...)`
- `set_swap_oracle(...)`
- `set_allowed_venues(...)`
- `swap_risk_policy()`
- `swap_oracle()`
- `allowed_routers()`
- `allowed_adapters()`

## Operational Model

- Policy auth: governor (or manager before governor handoff, same as existing policy methods).
- Enforcement point: `Arka::rebalance` pre-trade checks before transfer/approval/execute.
- Failure mode: fail-closed on policy violations.
