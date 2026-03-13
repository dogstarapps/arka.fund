# dApp Tranche 2 Alignment Status

This note captures the dApp-side closure state after the final Blend vault integration work.

## Closed items

### 1. Balanced is part of the main Arka manager workflow

The manager-facing Arka page exposes `Balanced` directly in the rebalance selector.

Relevant UI:
- `arkafund-dapp/src/app/arkas/[id]/page.tsx`

Implementation note:
- `Balanced` continues to use the `Arka.rebalance(...)` path through the configured adapter and pool id.

### 2. Blend is now a vault-owned position in the main Arka workflow

The Arka page no longer treats `Blend` as a detached manager-side action. It now exposes a `Blend vault position` panel that operates on the vault itself.

Relevant UI:
- `arkafund-dapp/src/app/arkas/[id]/page.tsx`

Implementation note:
- the UI reads and renders:
  - principal collateral / debt
  - live collateral / debt
  - live net value
  - oracle price
  - health factor
  - market aggregate value across all tracked assets
- the UI executes the vault-owned methods:
  - `blend_lend`
  - `blend_borrow`
  - `blend_repay`
  - `blend_withdraw`
 - the UI no longer assumes one asset per Blend market; asset choice is driven by the Arka whitelist and the selected action

### 3. Create-Arka flow reflects protocol activation intent

The create flow makes the product decision explicit: protocol activation is operational and follows vault creation from the manager workflow.

Relevant UI:
- `arkafund-dapp/src/app/factory/create/page.tsx`

Implementation note:
- the create page includes a protocol intent selector for the next post-create action
- the success state tells the manager whether the next step is `Balanced`, `Blend`, or generic Tranche 2 setup

### 4. Governance defaults align with the live closure environment

The dApp config defaults point to the live testnet governor/votes environment used for Tranche 2 evidence.

Relevant config:
- `arkafund-dapp/src/lib/config.ts`

### 5. Browser E2E exists for both smoke and live wallet-backed flows

The dApp now has:
- route smoke coverage
- wallet-backed coverage on testnet
- a gated wallet-backed live Blend browser flow

Relevant files:
- `arkafund-dapp/e2e/smoke.spec.ts`
- `arkafund-dapp/e2e/wallet-backed.spec.ts`

## Remaining note

There is no remaining dApp exposure gap blocking Tranche 2.

Future work is hardening, not alignment:
- broader live browser E2E coverage matrix
- oracle freshness/circuit-breaker UX for live-valued protocol positions
- public testnet deployment of the upgraded multi-asset Blend ABI

## Practical closure statement

For Tranche 2 scope at the dApp level, the previously open alignment gaps are closed:
1. `Balanced` is in the main Arka manager workflow
2. `Blend` is in the main Arka manager workflow as a vault-owned position
3. the create flow makes protocol timing explicit
4. governance defaults align with the live environment
5. the browser test surface covers both smoke and wallet-backed flows
