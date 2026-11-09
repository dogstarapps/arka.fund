# Arka.fund Frontend E2E Audit Matrix

Date: 2026-04-25  
Scope: Playwright/browser E2E coverage in the dApp repository

## 1. Bottom line

The E2E suite is broad and materially useful, but it is **not exhaustive**.

That distinction matters.

Current state:

- spec files: `13`
- Playwright tests: `76`
- wallet-backed Playwright tests: `19`
- browsers in active Playwright config: `3`
  - `chromium`
  - `firefox-surface-matrix`
  - `webkit-surface-matrix`

So the project does have serious browser automation coverage, including wallet-backed coverage, but it does **not** yet satisfy the stronger claim:

- every route
- every important state
- every mutation family
- every negative path
- every responsive breakpoint
- every supported browser
- every wallet provider

## 2. Current spec inventory

| Spec | Tests | Main scope |
|---|---:|---|
| `e2e/access-state.spec.ts` | 3 | operator gating, direct-route access and public-vs-operator rail behavior |
| `e2e/balanced-intent-surface.spec.ts` | 1 | Balanced/SODAX public intent surface behavior |
| `e2e/contracts-surface.spec.ts` | 4 | contracts control room structure, validation, mutation/storage matrices |
| `e2e/design-audit.spec.ts` | 1 | visual screenshot capture for current screen set |
| `e2e/explorers.spec.ts` | 2 | explorer/catalog-backed browsing behavior |
| `e2e/live-ops-surfaces.spec.ts` | 9 | ops, tiers, live vault execution and route posture |
| `e2e/operator-surface-matrix.spec.ts` | 8 | cross-browser operator route gating, governance/migrations/ops/contracts continuity, migration retry/degraded handling, contracts validation/DAO blocking, live vault negative-path posture and operator responsive matrix |
| `e2e/product-surfaces.spec.ts` | 8 | product IA, product surfaces and search/focus behaviors |
| `e2e/smoke.spec.ts` | 6 | broad smoke coverage |
| `e2e/vault-entrypoints.spec.ts` | 3 | vault entrypoints and leaderboard/product transitions |
| `e2e/vault-profile.spec.ts` | 1 | vault profile route |
| `e2e/wallet-backed.spec.ts` | 19 | real wallet-backed flows on testnet/runtime |
| `e2e/workflow-ia.spec.ts` | 11 | workflow/control-room IA for governance, create, settings, status, coverage, integrations |

## 3. What the suite covers well

### 3.1 Product browsing coverage

Strong:

- dashboard visibility and route presence
- discover/product IA
- vault leaderboard and entrypoints
- vault profile
- managers/assets catalog exploration
- key search and navigation behavior

Why this matters:

- the user can move around the core product model and those flows are exercised in browser automation

### 3.2 Core wallet-backed operational flows

Strong:

- create Arka
- governance lifecycle paths
- coverage stake / unstake / claim
- deposit / redeem
- rebalance flows
- credit/Blend lane flows
- selected `/contracts` mutation/read paths

Why this matters:

- the suite goes beyond static render checks and exercises real signed/operational behavior

### 3.3 Control-room IA and status surfaces

Strong:

- governance
- coverage
- integrations
- settings
- status
- ops
- tiers

Why this matters:

- the operator surfaces are not only present, they are asserted as structured UX surfaces

### 3.4 Visual capture coverage

Strong:

- current screenshot set exists for the major product and control-room routes
- screenshots are now stored in-repo under `docs/screenshots/dapp-manual`

Why this matters:

- design/product review can now compare real route output without leaving the repository

## 4. What is only partially covered

### 4.1 `/contracts` full mutation space

Status: **partial**

What is covered:

- typed lane structure
- raw lane structure
- local validation paths
- selected wallet-backed mutations
- mutation matrix and storage lifecycle machine-readable surfaces

What is not yet exhaustively covered:

- every preset across every domain
- every mutation in both success and failure paths
- every rollback branch
- every authorization permutation

This is the most important reason the suite cannot honestly be called exhaustive.

### 4.2 Negative and cancel-path UX

Status: **partial**

What is covered:

- many validation failures
- DAO-blocked write behavior
- missing field / bad JSON / bad type cases

What is not yet exhaustive:

- user cancels in every confirmation dialog
- wallet rejection in every transactional route
- repeated resubmission / stale state recovery beyond the migration workspace
- every retry branch across product and control-room screens

### 4.3 Responsive coverage

Status: **partial-to-strong**

What is covered:

- some layout behavior is indirectly exercised
- the design-audit pass captures current views
- mobile product checks already exist for discover/assets/managers/vaults
- stable operator surfaces now have explicit tablet + mobile checks for:
  - `/governance`
  - `/migrations`
  - `/ops`
  - `/tiers`
  - `/contracts`
  across Chromium / Firefox / WebKit

What is missing:

- a full breakpoint matrix across every route family
- wallet-backed live execution remains Chromium-only

### 4.4 Multi-browser coverage

Status: **partial**

Evidence:

- [playwright.config.ts](../playwright.config.ts) now defines:
  - full-suite `chromium`
  - `firefox-surface-matrix`
  - `webkit-surface-matrix`
- the cross-browser subset currently covers:
  - smoke/product shell sanity
  - operator access-state and route gating
  - stable operator surface routes (`governance`, `migrations`, `ops`, `tiers`)
  - `contracts` structure and raw validation/DAO-blocking guardrails
  - migration inspection/verification posture with mocked API data
  - migration degraded/offline inspection with retry recovery
  - live vault execution negative-path and responsive posture without wallet/manager privileges

Implication:

- we now do have real browser confirmation on Firefox and WebKit
- but only for a stable subset, not yet for the whole route and mutation matrix

### 4.5 Wallet provider matrix

Status: **partial**

What exists:

- wallet-backed flows are exercised

What is missing:

- exhaustive provider-by-provider coverage across Freighter / Albedo / xBull style variants

## 5. Route-by-route coverage view

| Route family | Coverage status | Notes |
|---|---|---|
| `/dashboard` | Strong | Product summary surface exercised through smoke/product IA |
| `/discover` | Strong | Search and catalog discovery covered |
| `/vaults` | Strong | Leaderboard and entrypoint flows covered |
| `/vaults/[id]` | Strong | Profile route covered |
| `/managers` and `/managers/[id]` | Strong | Explorer coverage exists, but not every filter/state variant |
| `/assets` and `/assets/[id]` | Strong | Explorer coverage exists, but not every filter/state variant |
| `/arkas` | Strong | Entrypoint route covered |
| `/arkas/[id]` | Strong | Live wallet-backed flows covered in Chromium; cross-browser matrix now also asserts no-wallet/no-manager negative-path posture and responsive integrity |
| `/factory/create` | Strong | Wallet-backed create flow covered |
| `/governance` | Strong | Lifecycle flow and IA covered |
| `/coverage` | Strong | Stake/unstake/claim and IA covered |
| `/integrations` | Partial-to-strong | Surface/IA covered; runtime permutations still not exhaustive |
| `/ops` | Strong | IA and posture route covered |
| `/contracts` | Partial-to-strong | Important flows covered, and cross-browser matrix now asserts structure, route access, raw validation and DAO-blocking behavior; full mutation/state matrix still not exhaustive |
| `/settings` | Strong | Config/control-room IA covered |
| `/status` | Strong | Readiness/cutover posture covered |
| `/tiers` | Strong | Surface and scorecard controls covered |

## 6. DAO and transaction UX coverage

Status: **good, but not exhaustive**

Covered:

- governance route exists as the formal DAO lifecycle surface
- DAO-blocked writes in `/contracts` are asserted
- confirmation UX is now part of transactional routes
- typed validation and feedback rails are exercised in integration/browser tests

Still missing for an exhaustive claim:

- confirmation cancel-path coverage across every write surface
- wallet rejection coverage across every write surface
- repeated stale-state / retry-path coverage after failed submissions

## 7. Design and visual fidelity coverage

Status: **useful, not exhaustive**

Covered:

- current screenshots for the major surfaces
- in-repo image set under `docs/screenshots/dapp-manual`
- screenshot generation through `e2e/design-audit.spec.ts`

Not covered exhaustively:

- every viewport class
- every visual state
- every empty/error/success permutation per route
- a full pixel-diff matrix against Figma for every live route variant

## 8. Controls and data-entry audit

Status: **improved, still not globally complete**

What improved in the recent pass:

- transaction review cards on critical write surfaces
- confirm dialog for writes
- normalized status/error feedback rail
- better typed input behavior on critical numeric/decimal fields

What still should be expanded later:

- more cancel/retry tests around confirmations
- broader field-type coverage outside the critical write lanes
- a stronger accessibility test pass around invalid states and keyboard flows

## 9. Recommended next steps if the goal is truly exhaustive E2E

1. Add multi-browser projects to Playwright:
   - Firefox
   - WebKit

2. Build a formal responsive matrix:
   - desktop
   - tablet
   - mobile
   - assert route-specific layout invariants

3. Expand `/contracts` wallet-backed matrix:
   - all key domains
   - all key write families
   - rollback and authorization branches

4. Add confirmation negative-path matrix:
   - confirm
   - cancel
   - wallet reject
   - retry

5. Add wallet-provider matrix where possible:
   - Freighter
   - Albedo
   - xBull-compatible flows

6. Add a route-state matrix for:
   - loading
   - empty
   - offline
   - retry
   - degraded runtime

## 10. Honest conclusion

The current suite is strong enough to catch meaningful regressions in the real frontend and strong enough to support continued iteration with confidence.

It is **not** yet exhaustive in the strict sense.

The two main blockers to calling it exhaustive are:

- only one browser is currently automated
- `/contracts` and transaction negative-path permutations are not fully covered across the whole mutation surface
