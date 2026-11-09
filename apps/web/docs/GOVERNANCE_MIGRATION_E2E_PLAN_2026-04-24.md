# Governance, Migration and Exhaustive E2E Implementation Plan

Date: 2026-04-24  
Scope: Arka.fund dApp governance authoring, migration workflows, access model and exhaustive E2E expansion

## 1. Why this plan exists

The current frontend already has:

- a real governance lifecycle surface
- a real low-level contracts surface
- a real transactional UX layer on the critical write routes
- meaningful E2E coverage

But it still does **not** have:

- a generic proposal composer for DAO-governed setters
- a dedicated migration workspace end-to-end in the UI
- a truly exhaustive E2E matrix
- a finalized public/operator access model for the `Advanced Console`

This plan exists to close those four gaps without inventing a strange product pattern.

## 2. Current truthful state

### 2.1 Governance

What exists:

- `/governance` supports `propose`, `vote`, `close`, `execute`
- proposal types currently modeled in the UI:
  - `Council`
  - `Snapshot`
- `/contracts` exposes typed and raw control lanes
- DAO-sensitive writes are blocked outside the correct governance lane

What does not yet exist:

- generic proposal composition for arbitrary governed setters
- proposal authoring that turns a governed config change into a governance payload directly from UI

### 2.2 Migration

What exists:

- migration-related state can be inspected in `/contracts`
  - `migrated_to`
  - `migrated_from`
- migration tooling exists outside the frontend in scripts/operator workflows

What does not yet exist:

- a first-class migration UI flow:
  - prepare
  - validate
  - simulate
  - propose
  - execute
  - verify

### 2.3 Exhaustive E2E

What exists:

- Playwright suite with real browser coverage
- wallet-backed E2E
- visual capture flow
- strong coverage for many product, control-room and execution routes

What does not yet exist:

- multi-browser coverage
- exhaustive multi-path confirmation/cancel/reject/retry coverage
- exhaustive responsive matrix
- exhaustive `/contracts` mutation matrix

### 2.4 Advanced Console access model

What exists:

- the `Advanced Console` is part of the same shell and is visible through a toggle in [AppChrome.tsx](../src/components/product/AppChrome.tsx)
- the route list is defined in [productNavigation.ts](../src/lib/workflows/productNavigation.ts)
- today there is **navigation exposure**, but not a finalized operator/public gating model

That means the current shell is good for development and internal ops, but it is not yet a finalized production access posture.

## 3. Target state

The target state should be:

- public product surfaces for product users
- execution surfaces for wallet users/managers
- operator/governance surfaces for advanced platform control
- proposal authoring aligned with market patterns
- migration handled as an operator/governance workflow, not as a casual public feature
- a release-quality E2E matrix with honest confidence

## 4. Recommendation on the `Advanced Console`

## 4.1 Short recommendation

Yes, this plan **should explicitly include** the possibility of **blocking or partially gating the `Advanced Console`**.

My recommendation is:

- **do not keep the current unrestricted exposure model for production**
- **do not remove the console entirely**
- **split it by audience and sensitivity**

## 4.2 Why I think this matters

Today the `Advanced Console` includes:

- `Create`
- `Governance`
- `Coverage`
- `Integrations`
- `Ops`
- `Contracts`
- `Settings`
- `Status`
- `Tiers`

This is a lot of power and a lot of internal detail in one public-facing shell.

Some of those routes are legitimate operator/governance tools.
Some are more end-user adjacent.
Some should probably be visible in read-only form but not promoted as general navigation.

## 4.3 What I would do

I would move to a three-level model.

### Level A: Public product

Keep clearly public:

- `/dashboard`
- `/discover`
- `/vaults`
- `/vaults/[id]`
- `/managers`
- `/managers/[id]`
- `/assets`
- `/assets/[id]`

### Level B: Wallet execution

Keep available to connected users/managers, but not mixed with raw operator tooling:

- `/arkas`
- `/arkas/[id]`
- `/coverage` if coverage actions are intended as a user/member operation
- selected governance read views if desired

### Level C: Operator / governance console

Gate or de-emphasize:

- `/factory/create`
- `/governance` authoring/execution lanes
- `/integrations`
- `/ops`
- `/contracts`
- `/settings`
- `/status`
- `/tiers`
- future migration workspace
- future generic proposal composer

## 4.4 My assessment of impact

If we decide to block/gate the `Advanced Console`, the impact is real but manageable.

### Product / IA impact

Level: **medium-high**

Because:

- route discoverability changes
- documentation changes
- screenshots/manuals change
- users stop seeing internal surfaces by default

### Frontend implementation impact

Level: **medium**

Because:

- shell/nav logic has to change
- route guards have to be introduced
- some screens may need public vs operator variants

### Security / operational benefit

Level: **high**

Because:

- it reduces accidental exposure of internal/operator lanes
- it makes the product surface cleaner
- it reduces the chance that users treat raw admin/governance pages as ordinary workflow pages

### E2E impact

Level: **high**

Because:

- route visibility and access-state tests will need to be rewritten
- we will need explicit coverage for:
  - unauthenticated
  - connected user
  - operator/governance role

## 4.5 Final recommendation on blocking

My recommendation is:

- **yes, include it in the plan**
- **yes, assume it has meaningful impact**
- **no, do not hard-remove the console immediately**
- instead do it in stages:
  1. hide/de-emphasize the most sensitive routes from general chrome
  2. introduce route-level gating
  3. add operator-mode/access model
  4. optionally later split into a dedicated operator shell

## 5. Workstream A: Access Model and Console Gating

Goal:

- define who should see which surfaces
- stop treating the current shell exposure as final

Deliverables:

- route classification matrix
- public vs wallet vs operator access policy
- updated `AppChrome` and navigation model
- route guard strategy
- visual rules for hidden/de-emphasized operator surfaces

Implementation steps:

1. Classify every route by audience and action sensitivity.
2. Decide whether `Governance` is:
   - public read + operator write
   - or fully operator-only
3. Decide whether `Coverage` belongs in execution or operator surfaces.
4. Remove the assumption that all `UTILITY_PRODUCT_NAV` routes should be visible to everyone.
5. Introduce gating primitives:
   - hidden from navigation
   - read-only accessible
   - operator-only
6. Update docs, visual manual and onboarding text.

Acceptance criteria:

- a public user no longer sees the full internal operator surface by default
- direct route behavior is explicit and intentional
- docs and screenshots reflect the new shell

Current implementation status:

- phase 1 delivered:
  - `Advanced Console` stays collapsed by default on product routes
  - opening it without operator mode shows an explicit guard, not the utility links
  - direct visits to utility routes render an operator gate inside the same app shell
  - enabling operator mode unlocks the utility rail and keeps the route in-place
- still pending inside this workstream:
  - richer audience policy (`public read / operator write`) per route family
  - operator onboarding copy in the visual manual
  - any future shell split or subdomain separation

## 6. Workstream B: Generic DAO Proposal Composer

Goal:

- let operators build governed proposals for supported setters from the UI
- do it in a market-aligned way, not as an ad hoc raw-call gimmick

Design principle:

- **template-driven first**
- not "free-form arbitrary calldata builder" on day one

Target pattern:

- close to governance tools like Tally/Agora/Safe-style transaction composition
- with stronger domain modeling for Arka-specific governed setters

Deliverables:

- governed action registry
- proposal template schema
- proposal composer UI
- proposal preview / diff / simulation surface
- governance lifecycle handoff into `/governance`

Implementation steps:

1. Build a governed action registry from the existing typed action knowledge in `/contracts`.
2. Mark which setters are proposal-authorable.
3. Create proposal templates for:
   - fees
   - protocol fee policy
   - whitelist
   - router binding
   - swap guardrails
   - oracle pinning
   - allowed venues
   - coverage policy controls
   - executor timing controls
4. Add proposal preview:
   - target contract
   - method
   - arguments
   - intended effect
   - governance path
5. Add simulation/readback expectation where feasible.
6. Submit proposal through governance lane.

Acceptance criteria:

- an operator can author supported governed changes from UI without dropping to scripts
- the payload is understandable before signing
- DAO-governed setters stop being "visible but not authorable"

Current implementation status:

- phase 1 delivered:
  - governed action registry extracted from the typed knowledge already present in `/contracts`
  - template-driven composer added to `/governance`
  - machine-consumable governed package preview added with canonical method/args/governance path
  - real handoff from `/governance` to `/contracts` implemented through stored draft prefill
  - coverage policy templates added to the same composer flow, including large numeric payload support where policy methods require it
- phase 2 delivered:
  - factory economic governance templates added for:
    - protocol treasury
    - protocol fee splits
    - creation fee
  - coverage operational governance templates added for:
    - coverage-fund claims manager
    - coverage-fund treasury
    - coverage-vault claims manager
  - optional-address payload authoring is now supported end-to-end, including explicit `void` handoff for clear/unset governance actions
- phase 3 delivered:
  - governance-authorable authority rotation templates added for:
    - vault governor
    - factory governor
    - coverage-fund governor
    - coverage-vault governor
    - claims-manager governor
    - governance-executor admin
    - governance-executor governor
    - locked-ARKA admin
    - locked-ARKA governor
    - oracle-guard admin
  - manager-tier governance templates added for:
    - governor
    - thresholds
    - set points
    - add points
  - coverage-fund removal of a covered vault is now authorable from the same governed composer lane
  - `/contracts` governed-draft prefill and E2E handoff now cover authority-rotation and manager-tier policy families, not just Arka/factory/coverage basics
- phase 4 delivered:
  - the governed composer now stages a publication candidate inside `/governance`, not only a one-shot handoff to `/contracts`
  - the governance publication lane persists the queued governed package across refresh and re-entry
  - operators can reopen the queued governed package back into the composer or hand it off to `/contracts` from the governance lane itself
  - the package governance path now reflects the honest state of the product: `governance_lane_prep` rather than pretending that arbitrary proposal publication is already wired on-chain
- phase 5 delivered:
  - Arka authoring now includes:
    - share-token binding
    - Blend risk policy
    - credit-market configuration
  - Oracle-guard authoring now includes:
    - set stellar asset policy
    - clear stellar asset policy
- still pending inside this workstream:
  - generic arbitrary-calldata proposal publication is still not wired in the governor lane

## 7. Workstream C: Migration Workspace End-to-End

Goal:

- support migration as an operator/governance workflow without turning it into a public-user feature

Important product stance:

- migration is **not** a public dApp feature
- it is an **operator/governance workspace**

Deliverables:

- migration workspace route in operator console
- source/target inspection
- prerequisite checker
- simulation step
- governance/export packaging
- execution tracking
- post-migration verification

Implementation steps:

1. Define supported migration types:
   - registry migration
   - factory implementation migration
   - vault migration mapping
2. Surface source/target state:
   - `migrated_to`
   - `migrated_from`
   - implementation / registry / router context
3. Add migration preflight:
   - role checks
   - contract presence
   - environment consistency
   - readback sanity
4. Add simulation / dry-run where feasible.
5. Add governance packaging:
   - generate the proposal package
   - or export a bundle compatible with downstream operator tools
6. Add post-execution verification.

Acceptance criteria:

- migration can be inspected and prepared entirely from UI
- execution path is explicit and safe
- the route is operator-only

Current implementation status:

- phase 1 delivered:
  - `/migrations` added as an operator workspace route inside the gated console
  - factory migration inspection exposed through a first-class app API and UI surface
  - source/target mapping checks and share-token implementation posture visible in one workspace
  - migration handoff into governance composer implemented for:
    - factory implementation
    - share-token implementation
    - registry binding
- phase 2 delivered:
  - getter-backed verification deck added so the workspace only marks checks as aligned when the factory can actually read them back
  - machine-consumable governance export bundle added with canonical proposal-package entries for:
    - factory implementation
    - share-token implementation
    - registry binding
  - export JSON preview and clipboard copy added so operator tooling can consume the bundle without retyping payloads
  - migration-to-governance handoff covered end-to-end from `/migrations` into the governed composer lane
- phase 3 delivered:
  - getter probing extended to include factory implementation and registry binding when the runtime exposes `get_implementation()` / `get_registry()`
  - dedicated dry-run and post-check deck added so the workspace now classifies:
    - bundle admission
    - implementation post-check readiness
    - share-token post-check readiness
    - registry post-check readiness
    - mapping observability posture
  - the dry-run remains honest about limits: it does not pretend to execute writes, it tells the operator exactly which post-execution checks are provable with live getters today
  - direct write simulation now runs through `/api/migrations/simulate`, using real Soroban RPC simulation over the governed package set and surfacing per-package status, prepared transaction size and source account inside `/migrations`
  - degraded inspection posture is now first-class in the UI:
    - `live`
    - `stale`
    - `unavailable`
  - retry recovery from failed inspection is now covered in integration and cross-browser E2E
- still pending inside this workstream:
  - export bundles for broader migration families still need expansion
  - post-execution verification deeper than current factory/readback checks is still pending
  - broader registry migration packaging beyond the canonical factory-driven path

## 8. Workstream D: Exhaustive E2E Matrix

Goal:

- move from “good E2E” to “release-confidence E2E”

Deliverables:

- multi-browser matrix
- multi-path matrix
- responsive matrix
- expanded wallet-backed matrix
- operator/public access-state coverage

Implementation steps:

### D1. Multi-browser

- add Firefox
- add WebKit
- stabilize browser-specific assertions

### D2. Multi-path

- confirm flows
- cancel flows
- wallet rejection flows
- retry flows
- degraded/offline paths

### D3. Responsive

- define breakpoint matrix
- test major product and operator routes by breakpoint

### D4. Wallet-backed

- expand `/contracts` mutation coverage
- cover more governance authoring flows once composer exists
- cover migration workspace once it exists

### D5. Access-state matrix

- unauthenticated user
- connected user
- operator/governance-capable user

Acceptance criteria:

- browser matrix is real, not just Chromium
- sensitive routes have explicit access-state tests
- new governance/migration flows are covered end-to-end

Current implementation status:

- phase 1 delivered:
  - first real multi-browser subset enabled in Playwright:
    - `chromium`
    - `firefox-surface-matrix`
    - `webkit-surface-matrix`
  - new access-state spec added for:
    - direct operator-route gating
    - operator-mode persistence across utility routes
    - public-rail behavior when operator mode exists but the console is still collapsed
  - cross-browser subset currently covers smoke plus access-state behavior on Firefox and WebKit, not just Chromium
- phase 2 delivered:
  - dedicated cross-browser operator surface matrix added for:
    - gated direct entry into `governance`, `migrations` and `ops`
    - operator-mode continuity across `governance -> migrations -> ops`
    - migration inspection and verification posture under mocked API readbacks
    - tiers readability and governed scorecard presence
  - Firefox and WebKit coverage now extends beyond smoke/access-state into stable operator-route flows
  - cross-browser `migrations` coverage now also includes a degraded/offline inspection path plus retry recovery
- phase 3 delivered:
  - responsive checks are now explicit for the stable operator subset
  - tablet + mobile assertions now cover:
    - `/governance`
    - `/migrations`
    - `/ops`
    - `/tiers`
    - `/contracts`
    across Chromium / Firefox / WebKit
  - those assertions enforce:
    - no document-level horizontal overflow
    - no viewport-clipped interactive controls
    - visible primary route panels at the target breakpoints
- phase 4 delivered:
  - `contracts` now sits inside the stable cross-browser subset, not just Chromium
  - Firefox and WebKit now assert:
    - operator gating for direct `/contracts` entry
    - route continuity into `/contracts` once operator mode is enabled
    - raw-lane negative validation (`missing contract`, `missing method`)
    - DAO-blocking on sensitive raw writes
  - live vault execution now has an explicit cross-browser negative-path posture check:
    - no-wallet / non-manager state keeps rebalance blocked
    - mobile and tablet layouts stay free of horizontal overflow and clipped controls
- still pending inside this workstream:
  - wallet-backed and heavy live-ops flows are still Chromium-only
  - broader wallet-backed negative-path matrices are still only partial
  - publication-heavy routes and write execution paths outside the stable subset still need deeper Firefox/WebKit confidence

## 9. Workstream E: Documentation and Release Readiness

Goal:

- keep documentation synchronized with the actual product and access model

Deliverables:

- updated visual manual
- updated DAO/governance operations notes
- updated E2E audit matrix
- operator runbook additions

Acceptance criteria:

- docs do not overclaim
- route audience and governance capability are clear
- screenshots match the actual shell

## 10. Workstream F: UX Control Semantics and Affordance Cleanup

Goal:

- remove ambiguous UI where decorative pills look like interactive controls
- make every visible control either genuinely interactive or clearly informational

Why this matters:

- several product surfaces currently render `StatusPill` elements in positions that visually read as tabs, filters or range selectors
- users reasonably expect those elements to be clickable
- this creates false affordance and damages trust in the UI

Current examples:

- dashboard segment row (`My deposits`, `My Arkas`, `Activity`)
- dashboard range row (`1D`, `1W`, `6M`, `1Y`, `ALL`)
- dashboard featured Arka row (`Popular Arkas`, `Curated Arkas`, `New Arkas`)
- similar “pseudo-tab” rows in other product surfaces where `StatusPill` is used decoratively

Deliverables:

- inventory of ambiguous controls
- classification:
  - real control
  - informational badge
  - remove
- conversion of real controls to proper buttons/tabs/selectors
- visual redesign of informational badges so they no longer impersonate buttons
- E2E assertions that interactive controls actually change state

Implementation rules:

1. If an element changes view state, filtering, range or sorting, it must be a real control.
2. If an element is informational only, it must not visually masquerade as a tab or filter.
3. Decorative `StatusPill` usage inside “tab rows” must be reconsidered route by route.
4. Product routes should avoid fake interaction patterns entirely.

Acceptance criteria:

- every visible “tab-like” element is either clickable and stateful or restyled as clearly non-interactive
- dashboard no longer shows faux range/filter controls
- E2E covers the interactive ones that remain

## 11. Workstream G: Truthfulness Audit and Visual Analytics Repair

Goal:

- remove misleading analytics, synthetic charts and distorted summary percentages
- ensure the UI exposes only real data, honest derived data or clearly-labeled heuristics
- repair the product by implementing truthful operational views, not by hiding the product surface

Why this matters:

- the current frontend still contains visualizations that read as historical/time-range analytics even when they are built from current snapshot composition
- some spotlight percentages are visually and numerically clamped for presentation
- some heuristic signals are presented like canonical protocol metrics without enough explanation
- this damages trust even when the underlying catalog or on-chain state is real

Current confirmed examples:

- dashboard stage curve and range row imply time-series history without a real time-bucket source
- discover sparkline cards imply trend history while being derived from current asset exposure composition
- spotlight share percentages on dashboard, vault watchlists, managers and assets are clamped to a minimum visual/label floor
- some leaderboard and spotlight heuristics need clearer provenance or relabeling
- the Arka leaderboard still carries a local `Risk 1/5` heuristic that should be replaced by a real catalog-backed signal instead of being marketed as protocol risk

Deliverables:

- route-by-route truthfulness inventory
- classification for each exposed metric or chart:
  - canonical source-backed
  - honest derived metric
  - heuristic / advisory
  - misleading and must be repaired
- replacement of misleading charts with real snapshot-based views or real history-backed views
- removal of distorted numeric clamps from displayed labels
- explicit provenance where fallback or heuristic values remain necessary
- replacement of heuristic leaderboard columns with real catalog-backed columns where the product already has truthful source fields
- integration/E2E assertions that the repaired controls and charts reflect real semantics

Implementation rules:

1. If a chart visually implies time or performance history, it must be backed by real historical series.
2. If the UI only has a current snapshot, the chart must be labeled and shaped as a current-snapshot distribution, concentration or posture view.
3. Displayed numeric percentages must not be clamped for cosmetic reasons.
4. Heuristic signals may exist, but they must be clearly labeled as heuristic/advisory and must not impersonate canonical on-chain risk metrics.
5. When fallback data is used, the provenance must be visible enough that the user can understand the confidence level.

Acceptance criteria:

- dashboard and discover no longer present synthetic history as if it were real historical analytics
- spotlight percentages are numerically truthful in labels
- heuristic signals are relabeled or documented with provenance
- the product remains feature-rich, but every major visual claim is honest

## 12. Suggested implementation order

Recommended sequence:

1. **Access model / Advanced Console gating**
2. **Governed action registry**
3. **Generic proposal composer**
4. **Migration workspace**
5. **UX control semantics / affordance cleanup**
6. **Truthfulness audit and visual analytics repair**
7. **Exhaustive E2E expansion**
8. **Docs refresh and release hardening**

Reason:

- it is better to settle route ownership and sensitivity first
- otherwise we risk building a rich composer/migration tool into the wrong public shell

## 13. Out of scope for the first pass

Not recommended for the first implementation pass:

- fully arbitrary calldata builder as the primary governance UX
- public-user migration wizard
- claiming exhaustive E2E before multi-browser and access-state coverage exist
- merging product exploration and operator governance into one undifferentiated nav model

## 14. Final recommendation

This is worth doing.

But it should be done as:

- an **operator/governance maturity plan**
- not as a casual expansion of the public dApp shell

The strongest product decision in this whole plan is probably the simplest one:

- **the `Advanced Console` should not remain exposed in its current unrestricted form as the final production posture**

That is why this plan includes console gating as a first-class workstream, not as an afterthought.
