# dApp Tranche 2 Alignment Status

This note captures the dApp-side status after the Tranche 2 contract closure.

## Closed items

### 1. Balanced is now available from the main Arka manager workflow

The manager-facing Arka page now exposes `Balanced` directly in the rebalance protocol selector.

Relevant UI:
- `arkafund-dapp/src/app/arkas/[id]/page.tsx`

Implementation note:
- `Balanced` uses the existing `Arka.rebalance(...)` path through the internal router with the configured adapter and pool id.

### 2. Blend is now available from the main Arka manager surface

The manager-facing Arka page now exposes a dedicated `Blend market action` panel.

Relevant UI:
- `arkafund-dapp/src/app/arkas/[id]/page.tsx`

Implementation note:
- this executes directly against the configured Blend adapter/market from the manager wallet
- this is intentionally surfaced on the Arka page so Blend is no longer isolated to `integrations`

### 3. Create-Arka flow now reflects the protocol setup decision

The create flow now makes the product decision explicit: protocol activation is operational and happens after vault creation from the manager workflow.

Relevant UI:
- `arkafund-dapp/src/app/factory/create/page.tsx`

Implementation note:
- the create page now includes a protocol-activation selector for post-create intent
- the success state tells the manager whether the next step is `Balanced`, `Blend`, or generic Tranche 2 setup

### 4. Governance defaults now point to the final closure environment

The dApp config defaults have been moved to the final testnet governor/votes pair used for Tranche 2 closure evidence.

Relevant config:
- `arkafund-dapp/src/lib/config.ts`

## Remaining architectural note

`Blend` is now part of the main manager workflow, but it is still not routed through `Arka.rebalance(...)`.

Reason:
- the live Blend adapter ABI is market-action-oriented: `execute(caller, action, market_id, amount, receiver)`
- the current Arka internal router expects swap-style adapter execution

Impact:
- this is no longer a dApp exposure gap
- it remains an architecture distinction between vault rebalance flows and Blend market actions

## Practical closure statement

For Tranche 2 scope at the dApp level, the previously open alignment gaps are considered closed:
1. `Balanced` is in the main Arka manager workflow
2. `Blend` is in the main Arka manager workflow
3. the create flow makes protocol timing explicit
4. governance defaults align with the final live environment
