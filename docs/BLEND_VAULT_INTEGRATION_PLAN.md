# Blend Vault Integration Plan

This document originally captured the technical step required to turn `Blend` from a manager-side action into a vault-owned strategy. That baseline has now been implemented for Tranche 2.

What remains here is the hardening backlog beyond Tranche 2 closure.

## Product Target

Desired model:
- an `Arka` is the real container of investor capital
- the manager deploys that capital into supported protocols on behalf of the vault
- investor entry/exit happens against vault NAV, not against manually repaid manager-side positions
- fees are charged on vault AUM / performance
- protocol positions belong to the vault, not to the manager wallet

Under that model:
- `SoroSwap` and `Aquarius` can work as spot rebalance venues if proceeds are returned to the vault
- `Blend` now meets the Tranche 2 baseline because it executes as a vault-owned position and is reflected in vault NAV

## Current State

Implemented baseline:
- `Blend` execution is vault-owned through `Arka`
- `Blend` position state is persisted per `(market_id, asset)` inside `Arka`
- `nav()` includes live-valued Blend net exposure
- the dApp renders Blend position state on the Arka detail page
- the repo passes integration tests for multi-asset market accounting
- the standalone live testnet validation path has been executed against the real Blend pool
- the legacy public testnet deployment recorded in `deployments.testnet.json` still lags behind this ABI

What is still not fully hardened:
- broader multi-asset market validation is still shallow
- risk controls are still minimal for markets beyond the currently validated testnet path

## Required End State

The baseline first-class vault position is now in place. The remaining end state is the hardening layer:
- stale oracle protection
- risk-policy enforcement
- richer multi-asset debt/collateral controls
- clearer fee crystallization on live-valued positions

## Contract Changes

### 1. Harden oracle consumption

Status:
- implemented for the current validated path
- `Arka` now stores a governance-controlled `blend_risk_policy(market_id)`
- `blend_market_status(market_id)` exposes freshness / blocking state
- `nav()` fails closed on stale pricing when policy demands it
- `blend_borrow` / `blend_withdraw` reject stale pricing and below-floor health factor

Next hardening target:
- add richer oracle/feed integrity checks beyond freshness alone
- optionally require explicit governance override to resume

### 2. Add explicit circuit breakers

Status:
- baseline circuit-breakers are implemented through `blend_market_status`
- dApp now surfaces stale-oracle / action-blocked / NAV-blocked state

Next hardening target:
- add pricing-mode granularity beyond freshness-only checks
- define fallback treatment for invalid-but-not-stale oracle/feed data

### 3. Expand risk-policy enforcement

Status:
- minimum health-factor enforcement is implemented and validated

Next hardening target:
- manager policy bounds for borrow size and allowed markets
- richer debt/collateral composition limits for heterogeneous markets

### 4. Refine fee accounting on live-valued positions

Current gap:
- the position is in NAV, but fee treatment on unrealized vs realized value can still be improved

Hardening target:
- explicit fee basis documentation
- high-water-mark or equivalent performance accounting if required by product policy

### 5. Deploy and broaden market coverage

Current gap:
- the public testnet environment still exposes the earlier single-asset ABI

Hardening target:
- migrate the new multi-asset ABI into the active testnet deployment record
- validate additional Blend markets
- validate heterogeneous collateral/debt pairs
- validate redeem behavior under multi-asset exposure

## Implemented in Tranche 2

The following items from the original plan are now implemented:
- vault-owned Blend execution through `Arka`
- vault-side Blend position tracking
- `nav()` inclusion of Blend net value
- multi-asset-per-market Blend accounting bounded by Arka whitelist
- redeem liquidity awareness
- dApp `Blend vault position` workflow
- contract integration tests
- repo-level browser smoke E2E for the Blend path

## dApp Changes

### 1. Add a real `Positions` section to Arka detail

The main Arka page should show:
- protocol
- collateral
- debt
- net value
- health factor
- estimated PnL / exposure

This should sit alongside:
- spot balances
- shares
- fees
- manager actions

### 2. Replace the current Blend action panel with a vault workflow

Current UI is useful operationally, but it is not a true vault strategy workflow.

Replace it with:
- `Open position`
- `Adjust collateral`
- `Borrow`
- `Repay`
- `Close position`

Each action should clearly state:
- whether it changes deployed capital
- whether it affects redeem liquidity
- what it does to vault exposure

### 3. Show redeem / withdrawal context

The dApp should expose:
- NAV
- cash available
- deployed capital
- estimated effect of redeem on active positions

Without this, investor UX is misleading once Blend capital is open.

### 4. Surface fee logic

Show:
- current management fee
- current performance fee
- fee basis (NAV / performance)
- later, optionally realized vs unrealized performance

## Hardening Backlog

The next security-focused delivery should cover:
1. oracle/feed integrity checks beyond freshness-only checks
2. broader market/risk policy bounds enforced on-chain
3. multi-asset live validation matrix
4. broader browser E2E coverage

## Definition of Done For Hardening

This hardening backlog can be considered closed when:
- stale pricing is already fail-closed on-chain for the validated path
- invalid oracle/feed data beyond freshness also fails closed
- broader risk bounds are explicit and governance-controlled
- multi-asset Blend positions are validated on testnet
- the dApp surfaces pricing/risk status clearly
# Blend Market Access Model

## Production rule

Arka uses one deployed adapter instance for each approved external Blend market.
That adapter is shared by Arkas; it is not deployed once per Arka. The current
Fixed XLM-USDC adapter is the canonical example.

Access is deliberately two-layered:

1. The global venue registry can allow or disable an adapter for the entire platform.
2. Each Arka must explicitly configure that adapter, the market identifier and every
   permitted action. A market is never granted to existing Arkas automatically.

This keeps a new market opt-in, preserves the existing Arka policy surface and
lets the platform stop a vulnerable venue immediately without modifying each
Arka. A manager or governance actor can configure an approved market for a
particular Arka only through its existing policy controls.

## Mainnet access audit

Run the following read-only check before enabling a new Blend action or market:

```bash
python3 scripts/mainnet_blend_access_audit.py
```

The report verifies the canonical registry, each registered Arka's Blend policy,
and the global status of every referenced adapter. It does not sign or submit
transactions.

### Current Mainnet readout (2026-08-07)

The read-only audit recorded six registered Arkas. Three explicitly opt into
the canonical Fixed XLM-USDC adapter with supply and withdrawal enabled. The
other three have no Blend market configured. No registered Arka has borrowing
or repayment enabled.

This is the expected fail-closed state: a future credit-market promotion must
be made deliberately for each chosen Arka, rather than inherited by every
existing or newly created Arka.

## Borrow activation

The established Fixed XLM-USDC supply/withdraw adapter remains the only live
Blend market until a separately governed borrow policy is fully validated. A
borrow promotion must use the approved shared adapter for its external market,
set bounded limits and oracle/risk controls on each opted-in Arka, and complete
a canary with no unresolved debt or collateral. It must not auto-enable
borrow/repay for existing Arkas.
