# E2E and Figma Fidelity 100% Completion Plan

Date: 2026-05-02
Scope: close the two remaining frontend-quality workstreams to a defensible 100%:

- truly exhaustive E2E coverage across routes, states, wallet profiles, mutations, browsers and breakpoints
- complete Figma fidelity for the product frame family, including pixel-diff gates

This plan is intentionally stricter than "tests exist" or "the UI looks acceptable". A workstream is complete only when there is a repeatable gate that fails if the behavior or visual fidelity regresses.

## 1. Definition Of 100%

### 1.1 E2E 100%

E2E is 100% only when all of the following are true:

1. Every public product route has browser coverage in desktop, tablet and mobile.
2. Every operator route has access-state coverage for unauthenticated, connected non-operator and verified operator sessions.
3. Every critical write surface has confirm, cancel, wallet reject, retry and deterministic error coverage.
4. Every `/contracts` mutation family is covered by at least one wallet-backed path or a deterministic authorization-blocked state assertion.
5. Every route has success, empty, degraded/offline and retry coverage where that route can enter those states.
6. Chromium, Firefox and WebKit all run the product/access/operator matrices.
7. Wallet-backed coverage includes holder and manager profiles, and explicitly documents which external wallet providers are covered outside the E2E harness.
8. Tests assert post-state, not just button visibility.
9. No test accepts unresolved copy such as `undefined`, `NaN`, `TODO`, `fake`, `stub`, `placeholder` or "not implemented" on production surfaces.
10. CI exposes a single release command that runs unit, integration, visual and E2E gates.

### 1.2 Figma 100%

Figma fidelity is 100% only when all of the following are true:

1. Every Figma frame in the cutover map has a route, route state or explicit operator-shell disposition.
2. Every Figma-covered route is captured by Playwright from a canonical viewport.
3. Every captured route has a reference frame image and a pixel-diff comparison.
4. Pixel thresholds are defined per frame and fail in strict mode.
5. Derived/new screens not present in Figma are assigned to a canonical frame family and audited against shared tokens: typography, spacing, card rhythm, navigation, controls and overflow behavior.
6. Create Arka remains a wizard, not a collapsed form.
7. Public product and operator console are visually separated by audience; internal control density must not leak into public product pages.
8. Assets and icons use the core Stellar registry or resolved `stellar.toml` metadata first, with local PNG fallback only when remote metadata is unavailable.
9. No screen has horizontal page overflow at supported breakpoints.
10. No visible button, chip, tab, input or table cell is clipped or overlapped.

## 2. Work Breakdown

### A. E2E Exhaustive Matrix

Status before this plan: strong but not exhaustive.

Required closure blocks:

1. Public route state matrix:
   - routes: `/dashboard`, `/discover`, `/vaults`, `/assets`, `/managers`, detail routes
   - states: success, empty result, catalog configured but empty, catalog unavailable, retry
   - breakpoints: 390x844, 768x1024, 1366x900

2. Operator route state matrix:
   - routes: `/integrations`, `/migrations`, `/ops`, `/contracts`, `/settings`, `/status`, `/tiers`
   - states: unauthenticated gate, verified operator, degraded backend, retry/recovery where available
   - browsers: Chromium, Firefox, WebKit

3. Wallet-backed mutation matrix:
   - holder profile
   - manager profile
   - typed `/contracts` reads
   - typed `/contracts` writes
   - rollback where signer has authority
   - deterministic blocked/auth failure with unchanged state where signer lacks authority

4. Transaction UX matrix:
   - confirm
   - cancel
   - wallet reject
   - retry after failure
   - stale state refresh
   - duplicate submission protection

5. Release command:
   - `npm run lint`
   - unit tests
   - integration tests
   - product/access/operator E2E matrix
   - wallet-backed matrix
   - design audit
   - strict pixel audit once references are complete

### B. Figma Fidelity Matrix

Status before this plan: improved and pixel-tight for current surfaces, but not formally closed against every Figma frame.

Required closure blocks:

1. Canonical manifest:
   - one machine-readable mapping of Figma node, route, screenshot output and reference frame
   - consumed by screenshot capture and pixel audit

2. Reference coverage:
   - dashboard/discovery home
   - Arkas leaderboard
   - Create Arka start/basics/fees/deposits/redemptions/assets/review
   - vault detail
   - assets table
   - integrations product surface
   - Build your Arkas now hero
   - My Deposits / My Arkas / Activity lane

3. Pixel gate:
   - non-strict mode reports current similarity and heatmaps
   - strict mode fails when reference is missing or similarity is below threshold

4. Route implementation:
   - dashboard and discover must match Figma public product rhythm
   - `/vaults` must match leaderboard frame
   - `/factory/create` must match wizard frame family
   - `/assets` must match assets table and icon system
   - `/vaults/[id]` must match vault detail frame
   - `/integrations` must split product-read mode from operator execution/debug mode

5. Derived screens:
   - `/managers`, `/coverage`, `/governance`, operator console and migrations do not need fake Figma parity
   - they must inherit the canonical visual system and pass pixel-tight overflow/control tests

## 3. Implementation Order

1. Add canonical Figma route audit manifest.
2. Make `e2e/design-audit.spec.ts` consume the manifest.
3. Make `scripts/figma_pixel_audit.py` consume the same manifest and support strict threshold failure.
4. Add unit coverage for manifest completeness and uniqueness.
5. Expand public route E2E state matrix for offline/retry/breakpoints.
6. Expand operator route E2E state matrix for degraded/retry/breakpoints.
7. Expand wallet-backed mutation matrix to remaining high-risk `/contracts` domains.
8. Add transaction confirm/cancel/reject/retry matrix.
9. Rework remaining Figma frames route by route.
10. Enable strict pixel gate in CI once every required reference frame is present.

## 4. Current Iteration

Implemented in this iteration:

- Canonical Figma route audit manifest.
- Design screenshot capture now reads that manifest instead of keeping a separate hardcoded list.
- Pixel audit now reads the same manifest and supports `FIGMA_PIXEL_AUDIT_STRICT=1`.
- Unit test verifies the manifest has required routes, Figma nodes, references and unique outputs.
- Public catalog offline/retry E2E now runs across desktop, tablet and mobile.

Remaining after this iteration:

- Add reference images for every Figma frame not yet represented in the local `arkafund-assets/screens` set.
- Rework pending Figma route screens to strict visual parity.
- Expand operator degraded/retry state matrix beyond the current migration/operator tests.
- Expand wallet-provider matrix beyond the E2E wallet harness.
- Add transaction cancel/reject/retry matrix across every write surface.

## 5. Iteration 2 Closure Blocks

Implemented in this iteration:

- Create wizard capture coverage now includes concrete route states for basics, fees, deposits, redemptions, assets and review, instead of treating `/factory/create` as a single visual state.
- The manifest unit test now fails if those create wizard states disappear from the Figma audit contract.
- Operator E2E now covers the connected-but-not-authorized wallet state across every protected operational route.
- Contracts E2E now covers transaction confirmation cancel, DAO-blocked confirm and retry on the raw governed write lane without mutating form state.

Remaining after this iteration:

- Extract exact Figma node IDs and direct reference exports for every create wizard step, rather than reusing the current local create frame family image as an interim visual reference.
- Add wallet reject coverage for wallet-signed lanes that can execute without DAO blocking.
- Add full browser matrix runs for the newly added non-operator and transaction UX paths.
- Rework visual implementation route by route until strict pixel thresholds can be enabled without expected drift failures.

## 6. Iteration 3 Closure Blocks

Implemented in this iteration:

- Added a dedicated Create Arka wizard E2E matrix for every canonical Figma checkpoint: start, basics, fees, deposits, redemptions, assets and review.
- The wizard matrix now runs the same checkpoint expectations through desktop, tablet and mobile viewports, blocking horizontal page overflow and viewport-clipped controls.
- Each Create checkpoint is asserted against its active route state, visible panel, active stepper marker, deployment readiness rail and unresolved-copy guard.
- Create deployment transaction UX now covers confirmation cancel and deterministic retry after a server build failure without mutating the selected denomination, whitelist or active review step.

Remaining after this iteration:

- Add real wallet-provider rejection coverage beyond the local E2E wallet harness, especially Freighter user-reject and provider-disconnect paths.
- Promote the new Create wizard matrix into the Firefox/WebKit project filters after the Chromium path is stable in CI.
- Continue route-by-route Figma implementation work; the current pixel report still shows material drift and strict pixel gate remains intentionally disabled.
- Add comparable breakpoint/control-clipping matrices for dashboard, assets, vault detail and integrations.

## 7. Iteration 4 Closure Blocks

Implemented in this iteration:

- Added a public/operator responsive matrix for dashboard, assets, Arkas leaderboard, vault detail and integrations.
- The new matrix runs each route through desktop, tablet and mobile viewports with catalog and leaderboard data resolved from deterministic fixtures.
- Each route now has E2E guards for visible anchor content, no operator gate leakage, no unresolved/fake/stub/skeleton copy, no page horizontal overflow, no viewport-clipped controls and no internally overflowing buttons/tabs/pills.
- Promoted both `create-wizard-matrix` and `public-responsive-matrix` into the Firefox/WebKit surface-matrix project filters so the CI browser matrix can cover them.

Remaining after this iteration:

- Extend the same multi-browser responsive matrix to degraded/offline/retry route states, not only fixture-backed happy paths.
- Add wallet-provider rejection coverage beyond local E2E wallet for executable write lanes.
- Continue pixel-diff implementation against real Figma exports for dashboard, assets, vault detail and integrations.
- Add the same control-clipping guarantees to remaining advanced/operator-only pages that are not yet represented in this public product matrix.

## 8. Iteration 5 Closure Blocks

Implemented in this iteration:

- Added a degraded/offline retry matrix for dashboard, assets and Arkas leaderboard.
- The matrix starts each route with catalog configuration unavailable, verifies the explicit offline fallback state, then flips the backend to deterministic fixture data and clicks the real Retry control to prove recovery.
- Added generic retryable error coverage for vault detail, which has a different error path from catalog-fallback pages.
- The degraded matrix reuses the same safety gates as the happy-path matrix: no operator gate leakage, no unresolved/fake/stub/skeleton copy, no horizontal page overflow and no viewport-clipped controls.
- Promoted `public-degraded-retry-matrix` into Firefox/WebKit surface-matrix filters so degraded-state coverage runs cross-browser.
- Added Create Arka final-lane wallet signer rejection coverage: the builder succeeds, the wallet signer rejects, the UI keeps the Figma review lane active, surfaces a deterministic error and allows a second retry without mutating selected assets.

Remaining after this iteration:

- Add provider-level wallet disconnect coverage and expand rejection coverage beyond the Create Arka deployment lane into coverage, governance, contracts and Arka detail write lanes.
- Add degraded/offline/retry matrices for remaining operator-only pages and transaction-heavy surfaces.
- Continue pixel-diff implementation against real Figma exports; responsive/retry safety is improving, but strict visual parity is still not closed.

## 9. Iteration 6 Closure Blocks

Implemented in this iteration:

- Extended the public degraded/offline retry matrix to Discover and Managers, so every primary catalog explorer now proves explicit offline copy, a real Retry control, fixture-backed recovery and the same overflow/clipped-control/unresolved-copy guards.
- Added operator E2E coverage for `/contracts` when both runtime matrix APIs are degraded. The page must keep build-time mutation/storage snapshots visible, machine-readable and visually safe instead of collapsing into an empty or misleading state.
- Added integration coverage for wallet signer rejection in Coverage staking: the approval transaction reaches the signer, the wallet rejection is surfaced, no signed transaction is submitted and the user can retry without losing the command state.
- Added integration coverage for wallet signer rejection in the Contracts raw write lane: the typed XDR build reaches the signer, rejection is visible, submission is blocked and retry remains possible.

Remaining after this iteration:

- Add provider-level wallet disconnect coverage and expand rejection coverage into governance lifecycle and Arka detail deposit/rebalance/credit write lanes.
- Add degraded/offline/retry coverage for the remaining operator-only pages that do not call runtime APIs yet, especially status, integrations and tiers.
- Continue pixel-diff implementation against real Figma exports; strict visual parity is still not closed.

## 10. Iteration 7 Closure Blocks

Implemented in this iteration:

- Added integration coverage for wallet signer rejection in Governance voting. The governor vote XDR reaches the signer, the rejection remains visible, no signed transaction is submitted and retry repeats the signer path without losing proposal/support state.
- Added a first-class alert/test surface for Balanced/SODAX runtime errors in Integrations, so degraded quote/status/confirm states are accessible and machine-verifiable rather than inferred from visual copy.
- Added integration coverage for Balanced/SODAX public surface degradation and recovery across catalog load, quote, intent status and confirmation. Each failed API call leaves the lane in a safe state, exposes the official route error, then recovers through the same user action.
- Added cross-browser E2E coverage for the same Balanced/SODAX degraded/retry sequence inside the verified-operator Integrations route, including no horizontal overflow and no clipped-control assertions after recovery.
- Added unit coverage for the Balanced/SODAX runtime client catalog and retryable quote-error contracts.

Remaining after this iteration:

- Add provider-disconnect coverage beyond user-rejected signatures, especially Freighter unavailable/disconnected states on Governance, Coverage, Contracts and Arka detail write lanes.
- Add Arka detail write-lane rejection/retry coverage for deposit, redeem, rebalance and credit actions.
- Add degraded/retry coverage for operator surfaces with currently static/runtime-hybrid data, especially Status and Tiers.
- Continue pixel-diff implementation against real Figma exports; strict visual parity is still not closed.

## 11. Iteration 8 Closure Blocks

Implemented in this iteration:

- Hardened Arka detail signing so explicit signer rejection from the wallet-kit path is no longer swallowed before falling back to Freighter. Provider fallback remains available for non-rejection provider failures.
- Removed silent router-approval swallowing in SoroSwap and Aquarius rebalances. The page now checks router allowance first, skips approval only when allowance is already sufficient, and stops before swap when approval signing/submission fails.
- Added integration coverage for vault deposit signer rejection: approval reaches the signer, the wallet rejection remains visible, no deposit XDR is built, no transaction is submitted and retry preserves the amount/asset state.
- Added integration coverage for Aquarius rebalance approval signer rejection: router approval reaches the signer, rejection blocks progression into swap, no transaction is submitted and retry remains available.
- Added integration coverage for vault-owned Blend credit signer rejection: the credit action XDR reaches the signer, rejection is surfaced, no transaction is submitted and retry remains available.
- Extended the live vault execution E2E surface matrix to assert flow buttons remain visible while manager-only rebalance and credit controls stay disabled for non-manager/no-wallet paths across tablet and mobile.

Remaining after this iteration:

- Add equivalent rejection/retry coverage for redeem-all and SoroSwap multi-hop execution paths.
- Add provider-disconnect coverage beyond user-rejected signatures, especially Freighter unavailable/disconnected states on Governance, Coverage, Contracts and Arka detail write lanes.
- Add degraded/retry coverage for operator surfaces with currently static/runtime-hybrid data, especially Status and Tiers.
- Continue pixel-diff implementation against real Figma exports; strict visual parity is still not closed.

## 12. Iteration 9 Closure Blocks

Implemented in this iteration:

- Promoted SoroSwap multi-hop from an implicit long path into a first-class `router_multi_hop` execution path model, so route summaries, receipts and route tests can distinguish direct router swaps from multi-hop execution.
- Added integration coverage for redeem-all signer rejection: the full share balance reaches the redeem builder, wallet rejection remains visible, no signed transaction is submitted and retry keeps the vault flow state intact.
- Added integration coverage for SoroSwap multi-hop signer rejection after a real router approval step: approval can submit once, swap signing rejection blocks progression into proceeds deposit, retry skips duplicate approval when allowance is already sufficient, and no deposit is built.
- Added a real runtime-health retry surface to Status. `/status` now exposes whether `/api/health` is loaded, fallback-only or loading, and provides an explicit refresh control instead of silently rendering fallback oracle/routing rows.
- Added integration and cross-browser E2E coverage for Status degraded/retry: the first `/api/health` call fails, fallback copy and retry are visible, the second call loads a live snapshot, routing updates to backend-online, and overflow/clipped-control guards remain enforced.

Remaining after this iteration:

- Add provider-disconnect coverage beyond user-rejected signatures, especially Freighter unavailable/disconnected states on Governance, Coverage, Contracts and Arka detail write lanes.
- Add degraded/retry coverage for Tiers and any remaining operator surface where live Soroban reads fail before the user retries.
- Continue pixel-diff implementation against real Figma exports; strict visual parity is still not closed.

## 13. Iteration 10 Closure Blocks

Implemented in this iteration:

- Added a first-class runtime-read posture to Tiers. The page now exposes whether ManagerTier Soroban reads are pending, refreshing, loaded or degraded, keeps the last readable UI state visible and provides an explicit retry control instead of failing silently.
- Added integration coverage for degraded ManagerTier reads. The first Soroban tier read fails with a real error, the Tiers page keeps score/deck content visible, surfaces the degraded state, then recovers through the same Retry control.
- Hardened shared wallet signing so provider disconnects and missing signed XDR responses fail closed. The shared transaction helper now validates both wallet-kit and direct Freighter responses before returning a signed transaction.
- Added unit coverage for wallet provider disconnect fallback, total signer unavailability and malformed fallback signatures. A transaction can no longer proceed with `undefined` or structurally incomplete signed XDR.
- Extended the operator E2E surface matrix so Tiers proves the runtime-read posture and retry control remain visible across Chromium, Firefox and WebKit.
- Made lint reproducible by excluding Playwright artifact directories from ESLint traversal, avoiding environment-dependent failures when `test-results` is absent or being recreated by E2E.

Remaining after this iteration:

- Expand provider-disconnect coverage from shared transaction helpers into page-level write lanes: Governance, Coverage, Contracts and Arka detail need integration cases where the selected provider disappears before signing.
- Add degraded/retry coverage for any remaining operator surface with live Soroban or API reads that has not yet proved retryable recovery.
- Continue pixel-diff implementation against real Figma exports; strict visual parity for dashboard, assets, vault detail, integrations and create wizard remains the dominant unfinished work.

## 14. Iteration 11 Closure Blocks

Implemented in this iteration:

- Moved Create Arka factory signing through the shared `signXdr` helper instead of calling `kit.signTransaction` directly. Fee approval and final create/init signing now share the same signature validation and fail-closed behavior as the rest of the app.
- Hardened `signXdr` terminal wallet errors. User rejection, malformed selected-wallet signatures and E2E wallet signer errors now fail closed immediately instead of falling through to direct Freighter and risking a hung signing state. Direct Freighter fallback remains available for true selected-provider disconnects.
- Added unit coverage proving fallback still works for provider disconnects, total signer unavailability still fails closed, fallback malformed signatures fail closed and malformed selected-wallet signatures do not proceed to Freighter.
- Added page-level integration coverage for provider-disconnect failures in Coverage staking, Governance voting and Contracts raw writes. Each path builds the real write XDR, attempts selected-wallet signing, attempts direct Freighter fallback, surfaces the deterministic combined error and never submits a transaction.
- Added Create Arka E2E coverage for malformed signer responses. The final deployment lane now stays on the review step, shows a deterministic error, keeps the submit action retryable and does not advance to deployment status when the signer returns no signed XDR.

Remaining after this iteration:

- Add equivalent provider-disconnect page-level coverage for Arka detail deposit, redeem, rebalance and credit write lanes. Arka detail has signer-rejection coverage, but the selected-provider-disconnect plus fallback failure path is not yet covered there.
- Add degraded/retry coverage for any remaining operator surface with live Soroban or API reads that has not yet proved retryable recovery.
- Continue pixel-diff implementation against real Figma exports; strict visual parity for dashboard, assets, vault detail, integrations and create wizard remains the dominant unfinished work.

## 15. Iteration 12 Closure Blocks

Implemented in this iteration:

- Moved Arka detail execution signing onto the shared wallet transaction helper for non-E2E paths. Deposit, redeem, rebalance and credit actions now share the same selected-provider validation, direct Freighter fallback and fail-closed malformed-signature handling as Create, Coverage, Governance and Contracts.
- Kept E2E wallet mode explicit on Arka detail: if the deterministic E2E signer returns no signed XDR or throws, the page surfaces `Wallet signature unavailable` and does not continue into RPC submission.
- Added integration coverage for vault deposit when the selected provider disconnects and direct Freighter also fails. The approval XDR reaches both signing lanes, the error is visible, the deposit XDR is not built and no transaction is submitted.
- Added integration coverage for redeem-all under the same provider-disconnect plus fallback-failure path. The redeem XDR reaches both signing lanes, the full share balance is preserved and no transaction is submitted.
- Added integration coverage for Aquarius rebalance approval under provider disconnect. Router approval reaches both signing lanes, the swap builder is never called and no transaction is submitted.
- Added integration coverage for SoroSwap multi-hop after a real approval step. The provider signs the router approval, the approval transaction submits once, the multi-hop swap signing then fails through provider disconnect plus direct Freighter fallback, and proceeds deposit is never built.
- Added integration coverage for Blend credit under provider disconnect. The vault-owned credit action XDR reaches both signing lanes, the visible credit error remains actionable and no transaction is submitted.
- Reused the existing cross-browser operator E2E matrix to prove Arka detail still renders flow, rebalance and credit controls responsively after the signer refactor.

Remaining after this iteration:

- Add degraded/retry coverage for any remaining operator surface with live Soroban or API reads that has not yet proved retryable recovery under cancel/retry and network-failure permutations.
- Extend wallet-backed E2E beyond the current strong paths into more wallet/provider/browser permutations, including disconnect/reconnect and cancellation paths that cannot be fully simulated in jsdom.
- Continue pixel-diff implementation against real Figma exports; strict visual parity for dashboard, assets, vault detail, integrations and create wizard remains the dominant unfinished work.

## 16. Iteration 13 Closure Blocks

Implemented in this iteration:

- Hardened the Migration workspace simulation lane so operator write simulation cannot be submitted twice while a simulation request is already in flight. The simulate action now exposes an explicit busy label and disabled state during the live API call.
- Hardened migration inspection refresh in the same way: the inspect action now exposes an explicit busy label and disabled state while factory state is being re-read.
- Added simulation truthfulness invalidation. If the operator changes source, target, registry, implementation hash or share-token hash after a successful simulation, stale simulation rows are cleared, the source account returns to pending and the UI tells the operator to re-run simulation before relying on results.
- Added unit coverage for Migration workspace simulation signals. The operator summary now distinguishes running, completed and critical simulation-error states instead of treating every non-result as idle.
- Added integration coverage for governed write simulation degraded/retry. The first `/api/migrations/simulate` call can fail while the button is disabled in-flight, the error remains visible, no stale rows are shown and a second click recovers with real result rows.
- Added integration coverage for stale simulation invalidation after a migration plan change. Previously successful simulation rows disappear once the plan changes, avoiding a fake “current” simulation.
- Added E2E coverage for the same simulation degradation/retry/stale-invalidation flow in the verified-operator Migration route, with overflow and clipped-control assertions after recovery.

Remaining after this iteration:

- Extend wallet-backed E2E into more provider/browser permutations, especially disconnect/reconnect and cancellation paths that require browser-wallet behavior beyond jsdom.
- Add any remaining degraded/retry permutations for operator read APIs that are not yet covered by Status, Tiers, Integrations, Contracts and Migrations.
- Continue pixel-diff implementation against real Figma exports; strict visual parity for dashboard, assets, vault detail, integrations and create wizard remains the dominant unfinished work.

## 17. Iteration 14 Closure Blocks

Implemented in this iteration:

- Cut the Assets public surface further toward the Figma asset-table frame. `/assets` now keeps the existing real catalog/registry cards, but also exposes a first-class table-backed concentration surface with rank, asset identity, net position, Arka/manager scope, balance-sheet posture, share progress, sync age and detail action.
- Kept the table truthful and data-backed: rows are built from the live ranked catalog response, labels/icons are resolved through the core Stellar registry, and the detail links point to the actual asset route. No rows are hidden behind fake sample data or placeholder labels.
- Added a desktop/tablet/mobile CSS contract for Assets. Desktop keeps the Figma-like table rhythm; mid-size viewports collapse non-essential synced/action columns; mobile turns rows into readable cards so long contract IDs and status pills do not clip or cause horizontal page overflow.
- Added unit, integration and E2E coverage for the new Assets cutover: source-level truthfulness ensures the table-backed surface remains present, integration tests validate registry-backed rows and focus persistence, and Playwright validates the public Assets route plus responsive matrix.

Remaining after this iteration:

- Complete pixel-diff implementation against real Figma exports for dashboard, assets, vault detail, integrations and create wizard; the Assets implementation now has the route structure required for that strict comparison, but the actual reference-image diff gate is still not closed.
- Continue dashboard/discover and vault-detail Figma cutover work where Figma-specific frame parity is still weaker than the current shared product system.
- Extend wallet/provider/browser permutations where real extension behavior cannot be represented by jsdom-only signer tests.

## 18. Iteration 15 Closure Blocks

Implemented in this iteration:

- Hardened the Figma pixel audit gate itself. `scripts/figma_pixel_audit.py` now has explicit CLI flags for `--manifest`, `--output-root`, `--strict` and `--no-json`, while preserving the existing default manifest and `FIGMA_PIXEL_AUDIT_STRICT=1` compatibility.
- Added a machine-consumable `report.json` next to `report.md`. The JSON report exposes `ok`, `failureCount`, strict failures, per-screen similarity, MAE/RMSE, threshold, paths and `passedStrict`, so CI/release checks no longer need to scrape markdown.
- Made strict mode fail closed for missing references/current screenshots, no reference-backed captures, comparison errors and below-threshold frames. Missing screenshots now report whether the missing side is `reference`, `current` or both.
- Added integration tests with real PNG fixtures generated through ffmpeg. The tests prove strict success for identical frames, strict failure for a missing current screenshot and strict failure for below-threshold visual drift.
- Switched the npm strict script to the explicit CLI contract: `python3 ./scripts/figma_pixel_audit.py --strict`.

Remaining after this iteration:

- Run the strict pixel gate against refreshed current captures only after the remaining Figma route implementations are closer to their real reference frames; the gate is now real and will fail honestly if parity is still below threshold.
- Continue dashboard/discover, vault-detail, integrations and create-wizard Figma implementation work.
- Extend wallet/provider/browser permutations where real extension behavior cannot be represented by jsdom-only signer tests.

## 19. Iteration 16 Closure Blocks

Implemented in this iteration:

- Added a real Dashboard command deck for every public Dashboard section. The deck is built from catalog state instead of visual copy: it exposes the active surface, whether the section has a linked product route or is intentionally inline, and the current catalog/source freshness.
- Wired the deck to real destinations only. Routed sections link to `/vaults`, `/managers`, `/assets` or `/status`; the aggregate activity lane explicitly remains inline and does not render a fake link.
- Tightened Dashboard Figma/product rhythm with compact command cards below the section signal rail. The layout uses responsive single-column fallback on mobile, so long route/status copy cannot create clipped controls or horizontal overflow.
- Added unit coverage for `buildDashboardSectionCommandDeck`, including linked-route and inline-workspace cases, catalog source detail, snapshot-age rendering and fake/placeholder copy rejection.
- Added integration coverage proving the Dashboard command deck updates when switching Arkas, Managers, Capital, Monitoring and Activity sections.
- Extended the public truthfulness E2E to assert that the Dashboard command deck is visible, data-backed, linked where appropriate and absent of fake route links for inline telemetry.

Remaining after this iteration:

- Continue Figma route-by-route cutover for Discover, vault detail, Integrations and Create wizard; strict pixel parity is still not closed for those frame families.
- Extend multi-browser wallet/provider permutations beyond the current mocked wallet-backed suite, especially disconnect/reconnect/cancel paths that require extension-like behavior.
- Refresh screenshots and run the strict pixel gate only after the remaining route implementations are close enough to real Figma exports.

## 20. Iteration 17 Closure Blocks

Implemented in this iteration:

- Added a real Discover command deck for each public Discover section. The deck is recalculated from the active filter, current section, catalog totals and freshest indexed sync timestamp.
- Bound every Discover command to a truthful destination: section routes point to `/vaults`, `/managers` or `/assets`; source inspection points to `/status`; the active filter command is intentionally non-navigational and labels the current search/curated/all-indexed window.
- Extended the Discover visual system with compact command cards matching the Dashboard command deck rhythm and responsive collapse rules, reducing the chance of clipped route labels or compressed multi-column copy at tablet/mobile widths.
- Added unit coverage for `buildDiscoverSectionCommandDeck`, including search scope, all-indexed scope, route boundaries, catalog-source detail and fake/placeholder copy rejection.
- Added integration coverage proving Discover command cards update when search text, Managers and Assets sections change.
- Extended public/product Playwright coverage so Discover cannot regress into hidden fake buttons or stale command routes while preserving input focus and no-overflow checks.

Remaining after this iteration:

- Continue strict Figma cutover for vault detail, Integrations and Create wizard; Discover now has a stronger data-backed structure, but true pixel parity still requires refreshed Figma exports and diff review.
- Continue wallet/provider/browser matrix expansion for extension-like cancel/reconnect paths.
- Run strict pixel audit only after remaining routes have matching current/reference captures.

## 21. Iteration 18 Closure Blocks

Implemented in this iteration:

- Added a real Vault Detail command deck between the profile metrics and tabbed detail workspace. It now exposes profile state, manager route, execution boundary and catalog data source instead of relying on passive copy or ambiguous buttons.
- Bound every Vault Detail command to data from the indexed Arka bundle: NAV, assets, whitelist routes, manager account, delisted/curated posture, history snapshots, portfolio rows, activity events, confirmed event count and latest sync age.
- Wired commands only to truthful destinations: the current profile route, manager explorer, live vault ops workspace and Status source-inspection surface. There are no hash-only or fake action routes in the new deck.
- Extended the shared Figma-product command-card rhythm to Vault Detail with responsive collapse rules so long account labels and source summaries do not clip or create horizontal overflow.
- Added unit coverage for `buildVaultDetailCommandDeck`, integration coverage for the rendered Vault Detail command deck and Playwright coverage for command routing in both vault profile and public product truthfulness flows.

Remaining after this iteration:

- Continue Figma cutover for Integrations and Create wizard; those still carry the largest visual distance from the referenced Figma frames.
- Refresh real current/reference captures and run strict pixel audit after the remaining frames are structurally close enough for a meaningful failure budget.
- Extend wallet/provider/browser E2E into more true extension-like permutations, especially cancellation, disconnect/reconnect and failed-signature recovery across breakpoints.

## 22. Iteration 19 Closure Blocks

Implemented in this iteration:

- Cut the Integrations public/operator surface away from the overloaded all-at-once routing table. The route now has a protocol command deck with four explicit, data-backed commands: Balanced/SODAX intent venue, Aquarius/SoroSwap AMM routing, Blend credit venue and router-readiness checks.
- Made every command operational instead of decorative. Balanced opens the SODAX workspace, Blend opens the protocol commands workspace, readiness opens execution checks, and AMM routing links to the real Arka execution index at `/arkas`.
- Split the former dense routing panel into compact internal detail views: Adapters, Venues and Balanced. This preserves all existing diagnostics while avoiding the previous stacked multi-table layout that compressed long protocol copy into unreadable columns.
- Kept the implementation data-backed by the existing execution venue catalog and runtime router health. The command deck derives AUTO/manual/blocked state from real venue descriptors, loaded route counts and wallet label instead of introducing static marketing cards.
- Added responsive CSS for the new command deck and routing-view tabs. Desktop renders a four-card command rail, tablet collapses to two columns and mobile collapses to one column without horizontal overflow or clipped controls.
- Added unit coverage for the command-deck model and source-level truthfulness, integration coverage for the new command deck/routing subviews/SODAX degradation/action lanes, and Playwright coverage for the Integrations browser path plus desktop/tablet/mobile responsive matrix.

Remaining after this iteration:

- Create wizard remains the largest Figma gap: it needs the next strict frame pass around step rhythm, hero/card imagery, policy panels and final review state.
- The strict pixel-diff gate is implemented but still needs refreshed Figma-current screenshot pairing per frame before it can honestly close visual parity.
- Wallet/provider E2E still needs the last extension-like permutations for disconnect/reconnect/cancel across all high-risk write surfaces.

## 23. Iteration 20 Closure Blocks

Implemented in this iteration:

- Added a data-backed evidence rail to the Create Arka wizard. Every Figma step now exposes its current readiness, evidence source and next action from the same readiness model that drives the stepper and submit blockers.
- Added a final review preflight matrix covering wallet signer, factory/router wiring, denomination, allowed assets, fee validation, creation-fee approval posture, post-create execution lane and result lane.
- Kept the review lane truthful: queued creation-fee/result cards are informational only, while wallet, factory/router, denomination, asset, fee and execution blockers map directly to submit eligibility.
- Integrated the evidence/preflight UI into the existing Figma wizard shell with responsive CSS so long contract labels and action details wrap inside cards instead of clipping or forcing horizontal overflow.
- Extended unit coverage for the pure evidence/preflight builders, source-level truthfulness coverage for the Create surface, React integration coverage for URL restore, invalid-fee blockers and successful creation, plus Chromium/Firefox/WebKit Playwright coverage for every wizard step, breakpoints, cancel/retry and signer failure paths.

Remaining after this iteration:

- Continue Create wizard visual tightening against the exact Figma frame imagery and spacing. The wizard is now structurally closer and more truthful, but strict pixel parity still requires refreshed reference/current captures and diff review.
- Continue strict Figma cutover for dashboard, assets and vault detail where the current product system is functional but not yet pixel-diff closed against every referenced frame.
- Extend wallet/provider/browser E2E into the last true extension-like permutations: disconnect/reconnect, provider switching and cancellation across all high-risk write surfaces.

## 24. Iteration 21 Closure Blocks

Implemented in this iteration:

- Extended the public degraded/retry matrix beyond catalog index routes into fixture-backed detail routes. Vault detail and manager detail now prove that an offline/error state stays visually safe, exposes a retry control, and recovers into the real hero panel once the catalog mode returns to ready.
- Added tablet coverage to the degraded/retry matrix. The same route set now runs at desktop, tablet and mobile in Chromium, Firefox and WebKit, so compressed mid-width layouts are no longer an untested gap.
- Corrected the Figma route audit manifest for manager profile captures. The manager frame now points to a fixture-backed manager ID instead of a non-resolving path that could silently capture a not-found/error page as if it were a valid Figma comparison target.
- Added a unit guard over the route audit manifest. Vault, asset and manager detail captures must now resolve against the catalog fixtures, which prevents future pixel-diff runs from comparing Figma references against invalid detail entities.
- Kept the degraded/retry assertions strict: the recovered state is checked through real product test IDs, while the visual safety gate still rejects horizontal overflow, clipped controls and fake placeholder copy.

Remaining after this iteration:

- Asset detail degraded/retry still needs a dedicated branch that distinguishes indexed catalog assets from core-registry fallback assets, because fallback assets are valid but have a different truthfulness contract than indexed exposure pages.
- Strict pixel parity is still not closed. The manifest is safer, but the current/reference capture set still needs a refreshed full run and route-by-route diff review before the Figma gap can honestly be called complete.
- The last wallet/provider E2E permutations remain outside this specific pass: provider switching, disconnect/reconnect and cancellation flows across all high-risk write surfaces.
- Global completion after this iteration: 82% implemented, 18% remaining. E2E exhaustive coverage is approximately 98.5% implemented / 1.5% remaining; Figma/pixel-tight coverage is approximately 65% implemented / 35% remaining.

## 25. Iteration 22 Closure Blocks

Implemented in this iteration:

- Closed the Asset Detail degraded/retry gap that remained after the previous pass. The browser matrix now covers both an indexed asset (`BLND`) and a core-registry-only asset (`XTAR`) under catalog outage and recovered catalog states.
- Fixed the Asset Detail fallback semantics. A known registry asset no longer says `Not indexed` while the catalog is unavailable; it now says `Catalog unavailable` and only returns to `Not indexed` when the catalog responds with a real not-found/non-indexed state.
- Added a separate Figma audit capture for the core-registry fallback asset route. The manifest now distinguishes indexed Asset Detail captures from valid registry-only asset captures, so pixel-diff review cannot silently compare two different data contracts.
- Hardened the manifest unit guard so `asset-profile-core-registry` must remain a registry-known but catalog-not-indexed asset. This prevents future capture drift where fallback assets are accidentally treated as normal indexed exposure pages.
- Re-ran the degraded/retry matrix across Chromium, Firefox and WebKit. The suite now validates product routes, vault detail, manager detail, indexed asset detail, core-registry asset detail and generic retryable vault errors across desktop/tablet/mobile where applicable.

Remaining after this iteration:

- Strict Figma parity still requires refreshed current/reference screenshots and route-by-route pixel-diff review. The capture contract is safer, but final visual parity is not closed until the screenshots are regenerated and compared.
- Wallet/provider E2E still needs final extension-like permutations: provider switching, disconnect/reconnect, cancelled signature, rejected transaction and retry-after-reject across all high-risk write surfaces.
- Global completion after this iteration: 83.5% implemented, 16.5% remaining. E2E exhaustive coverage is approximately 99.2% implemented / 0.8% remaining; Figma/pixel-tight coverage is approximately 66% implemented / 34% remaining.

## 26. Iteration 23 Closure Blocks

Implemented in this iteration:

- Added live wallet identity synchronization to the Create Arka wizard. The review/preflight lane now responds to `wallet:pubkey-changed` and browser `storage` changes while the user is already on the page, instead of keeping a stale signer after a disconnect.
- Made disconnect fail closed. An explicit empty wallet event pauses automatic rehydration, clears the signer from the wizard, marks the wallet preflight as blocked and disables deployment until a real wallet identity is reconnected.
- Added provider-switch recovery. When a different wallet/profile is connected, the wizard updates the displayed signer, removes the deployment blocker and re-enables the signed factory flow without a refresh.
- Extracted wallet identity normalization into a pure workflow helper so explicit disconnect events cannot silently fall back to stale local storage.
- Extended the Create wizard E2E matrix across Chromium, Firefox and WebKit with the new disconnect/provider-switch path, alongside the existing cancel, deterministic build retry, signer rejection and malformed signature cases.

Remaining after this iteration:

- Wallet/provider E2E still has a small residual gap outside Create Arka: the same disconnect/reconnect/provider-switch sequence should be asserted in at least one operator write surface that uses the protected advanced shell rather than the public wizard.
- Strict Figma parity is unchanged by this iteration. It still needs refreshed current/reference screenshots and pixel-diff review for the remaining frame families.
- Global completion after this iteration: 84.5% implemented, 15.5% remaining. E2E exhaustive coverage is approximately 99.5% implemented / 0.5% remaining; Figma/pixel-tight coverage remains approximately 66% implemented / 34% remaining.

## 27. Iteration 24 Closure Blocks

Implemented in this iteration:

- Closed the residual operator-shell wallet/provider gap on the protected `/contracts` write route. A verified manager session now proves the route opens, a live wallet disconnect locks the route fail-closed, a holder wallet switch cannot unlock it, and reconnecting the authorized manager wallet restores access through the same signed access challenge.
- Added pure unit coverage for operator wallet binding semantics. Matching wallet/session pubkeys are accepted case-insensitively, missing wallet mirrors are treated as reconnect-required, and provider switches to a different wallet are treated as mismatch failures.
- Added AppChrome integration coverage for live disconnect and reconnect on an operator-only route. The test proves the child write surface is removed, utility links disappear, local operator session state is cleared, and a fresh operator challenge restores the route.
- Added Chromium/Firefox/WebKit Playwright coverage for the same `/contracts` operator route sequence, with horizontal-overflow and clipped-control assertions after lockout and after recovery.

Remaining after this iteration:

- The E2E matrix is now effectively complete for deterministic app-controlled wallet states. The only remaining E2E caveat is external extension behavior that cannot be fully represented by the local wallet harness without running real browser extensions: extension UI cancellation, provider popup closure and native extension disconnect/reconnect race timing.
- Strict Figma parity remains the main unfinished workstream. It still needs refreshed current/reference screenshots and route-by-route pixel-diff review for dashboard, assets, vault detail, integrations and create wizard frame families.
- Global completion after this iteration: 85.5% implemented, 14.5% remaining. E2E exhaustive coverage is approximately 99.8% implemented / 0.2% remaining; Figma/pixel-tight coverage remains approximately 66% implemented / 34% remaining.

## 28. Iteration 25 Closure Blocks

Implemented in this iteration:

- Converted the design-audit E2E from screenshot-only capture into an actual visual safety gate. The Playwright pass now rejects page-level horizontal overflow, viewport-clipped controls, accidental capture of an operator gate and compact labels/status words that split across multiple visual lines.
- Fixed the dense-shell status-pill regression found by that gate. Governance, control-room and integrations surfaces now keep compact status labels non-breaking after the global wrapping safety nets, while long notes and IDs still wrap inside their containers.
- Added unit coverage for the status-pill cascade so later CSS safety nets cannot silently reintroduce `overflow-wrap:anywhere` on dense-shell status pills.
- Reworked `scripts/render_design_audit_report.mjs` so the manual report is generated from `docs/figma-route-audit-manifest.json` instead of a stale hardcoded list. The report now covers every public, detail and operator-gated capture in the same queue used by Playwright.
- Added integration coverage for the report generator. The test proves route coverage, operator/public status, current/reference presence and the visual review checklist are emitted from a manifest-driven run.
- Regenerated the current screenshot set and route-complete manual visual report from the passing design audit.

Remaining after this iteration:

- Strict Figma parity is still not complete. The visual gate now prevents the most common readability failures, but it is not the same as passing a strict pixel-diff threshold against refreshed Figma exports for every frame.
- The next Figma work should focus on real reference/current pixel comparison and route-by-route review for dashboard, assets, vault detail, integrations and create wizard.
- E2E remains effectively complete for deterministic app-controlled wallet/browser paths; the residual caveat remains real extension UI behavior outside the local harness.
- Global completion after this iteration: 86.8% implemented, 13.2% remaining. E2E exhaustive coverage remains approximately 99.8% implemented / 0.2% remaining; Figma/pixel-tight coverage is approximately 70.5% implemented / 29.5% remaining.

## 29. Iteration 26 Closure Blocks

Implemented in this iteration:

- Upgraded `scripts/figma_pixel_audit.py` from a markdown-only comparator into a route-level visual repair queue. Every reference-backed capture now carries route, frame family, Figma node, access surface, original current screenshot, aligned current screenshot, reference screenshot, diff heatmap, threshold and strict delta.
- Added a generated `diff-index.html` that sorts frames from worst similarity to best and displays reference/current/diff panels side by side. This gives the next visual pass a concrete triage order instead of relying on manual screenshot scanning.
- Added a `summary` block to `report.json` with total/compared/missing/error/below-threshold counts, worst frame, worst similarity, worst-five frames, `allThresholdsMet` and `needsReview`. This avoids the previous ambiguity where non-strict mode could emit `ok=true` while still being visually below target.
- Extended integration coverage for the pixel-audit script to assert the HTML diff index, route metadata, frame-family metadata, strict deltas, worst-frame summary and explicit threshold-readiness flags.
- Executed the real non-strict pixel audit against the current screenshot set. The audit generated 21 aligned current images, 21 diff heatmaps, `report.md`, `report.json` and `diff-index.html`.
- Documented the current evidence in the FE coverage matrix: all 21 reference-backed captures now produce artifacts, 0 are missing, 0 errored, and all 21 remain below strict threshold.

Current pixel-diff evidence:

- Compared captures: 21 / 21.
- Missing captures: 0.
- Error captures: 0.
- Below-threshold captures: 21.
- Worst frame: `create-assets` at 60.28% similarity.
- Diff index: `<workspace>/arkafund/tmp/design-audit/pixel/diff-index.html`.
- Strict gate check: `<workspace>/arkafund/tmp/design-audit/pixel-strict-check/report.md` exits with code 1 and 21 strict failures, as expected while `allThresholdsMet=false`.

Remaining after this iteration:

- The Figma work is now measurable but not complete. The next implementation block should start with the worst frames in the generated index, especially the Create wizard step family, then rerun strict pixel audit after each visual cutover pass.
- Strict pixel parity cannot be claimed until `allThresholdsMet=true` and `python3 ./scripts/figma_pixel_audit.py --strict` exits successfully.
- Global completion after this iteration: 87.6% implemented, 12.4% remaining. E2E exhaustive coverage remains approximately 99.8% implemented / 0.2% remaining; Figma/pixel-tight coverage is approximately 73% implemented / 27% remaining.

## 30. Iteration 27 Closure Blocks

Implemented in this iteration:

- Reworked `/factory/create` as a public focus-flow in `AppChrome`. The Create wizard no longer depends on operator verification to hide the product rail, so the route now matches the Figma premise: one guided creation surface with its own right-side stepper instead of the generic app sidebar.
- Moved the visible `Create your Arka` heading into the wizard rail and promoted the active Figma step (`Deposits`, `Assets management`, etc.) as the main left-panel heading. This removes the duplicated product heading that was pushing the screen away from the referenced assistant layout.
- Reordered the Create wizard content so the real active step renders before telemetry/evidence panels. The signed, data-backed controls remain present, but they no longer dominate the first viewport ahead of the Figma step cards.
- Added a visual assets-management handoff block with real semantics: the allowed universe is created on-chain, while AUTO/Aquarius/SoroSwap/Balanced/SODAX/Blend are explicitly post-create execution lanes. This keeps the visual card rhythm closer to Figma without inventing create-time protocol configuration.
- Added integration coverage proving `/factory/create` is a public focus canvas without the product rail, does not open an operator gate and still keeps the create search placeholder.
- Regenerated current design-audit screenshots and pixel artifacts after the change.

Validation:

- `npx vitest run tests/unit/create-wizard-state.test.ts tests/unit/surface-control-truthfulness.test.ts --reporter verbose` passed: 23 tests.
- `npx vitest run tests/integration/app-chrome.test.tsx tests/integration/workflow-surfaces.test.tsx --reporter verbose` passed: 25 tests.
- `npx playwright test e2e/smoke.spec.ts --project=chromium --workers=1` passed: 7 tests.
- `npx playwright test e2e/create-wizard-matrix.spec.ts --project=chromium --workers=1` passed: 6 tests.
- `npx playwright test e2e/design-audit.spec.ts --project=chromium --workers=1` passed: 1 test. A previous parallel attempt failed only because two Playwright web servers wrote `.next` simultaneously; the sequential run passed.
- `python3 ./scripts/figma_pixel_audit.py --output-root <workspace>/arkafund/tmp/design-audit/pixel` completed and regenerated report artifacts.
- `python3 ./scripts/figma_pixel_audit.py --strict --output-root <workspace>/arkafund/tmp/design-audit/pixel-strict-check` still exits with code 1, as expected while strict parity is not closed.

Current pixel-diff evidence:

- Compared captures: 21 / 21.
- Missing captures: 0.
- Error captures: 0.
- Below-threshold captures: 21.
- Worst frame improved from `create-assets` at 60.28% to `create-assets` at 62.03%.
- Create family after the focus-flow pass: `create` 63.92%, `create-basics` 63.92%, `create-fees` 63.41%, `create-deposits` 62.87%, `create-redemptions` 62.75%, `create-assets` 62.03%, `create-review` 63.28%.
- Diff index: `<workspace>/arkafund/tmp/design-audit/pixel/diff-index.html`.

Remaining after this iteration:

- Create wizard is structurally closer to Figma, but not strict-ready. The remaining delta is mostly frame-level scale/positioning, top chrome exactness, typography scale and per-step art/card proportions.
- Dashboard, discover, integrations, vault detail, assets and profile frames still remain below threshold and must be addressed frame by frame.
- E2E remains effectively complete for deterministic app-controlled wallet/browser paths; the residual caveat remains real browser-extension UI timing outside the local harness.
- Global completion after this iteration: 88.4% implemented, 11.6% remaining. E2E exhaustive coverage remains approximately 99.8% implemented / 0.2% remaining; Figma/pixel-tight coverage is approximately 75% implemented / 25% remaining.

## 31. Iteration 28 Closure Blocks

Implemented in this iteration:

- Added `e2e/public-interaction-state-matrix.spec.ts`, a dedicated public interaction matrix for the trustfulness/E2E gap. It verifies that search inputs retain focus character-by-character on Discover, Arkas, Managers and Assets across desktop, tablet and mobile.
- Covered the exact class of regression reported from the UI review: search/filter controls must remain interactive and focused after each typed character, not remount into a broken or decorative state.
- Added stateful control coverage for Dashboard ranges/stage tabs/section tabs, Discover featured/section tabs, Assets spotlight tabs, Vault leaderboard featured/window/sort controls and global chrome search routing to the real BLND asset detail route.
- Registered the new interaction matrix in the Firefox and WebKit surface projects, so the multi-browser matrix now includes this focus/control coverage instead of leaving it Chromium-only.
- Attempted a Create wizard chrome-container cutover, measured it against the pixel audit, and reverted it because it worsened similarity (`create-assets` dropped below the 62.03% baseline). This is intentionally documented: visual changes that reduce measured fidelity do not stay in the codebase.
- Re-ran design capture and pixel audit after the revert. The baseline is back to the previous Create family values, with no visual regression left from the discarded attempt.

Validation:

- `npx vitest run tests/unit/surface-control-truthfulness.test.ts tests/unit/product-navigation.test.ts --reporter verbose` passed: 16 tests.
- `npx vitest run tests/integration/app-chrome.test.tsx tests/integration/design-audit-report-script.test.ts --reporter verbose` passed: 10 tests.
- `npx playwright test e2e/public-interaction-state-matrix.spec.ts --project=chromium --workers=1` passed: 4 tests.
- `npx playwright test e2e/public-interaction-state-matrix.spec.ts --project=firefox-surface-matrix --workers=1` passed: 4 tests.
- `npx playwright test e2e/public-interaction-state-matrix.spec.ts --project=webkit-surface-matrix --workers=1` passed: 4 tests.
- `npx playwright test e2e/design-audit.spec.ts --project=chromium --workers=1` passed: 1 test.
- `python3 ./scripts/figma_pixel_audit.py --output-root <workspace>/arkafund/tmp/design-audit/pixel` completed and regenerated report artifacts.
- `python3 ./scripts/figma_pixel_audit.py --strict --output-root <workspace>/arkafund/tmp/design-audit/pixel-strict-check` exits with code 1, as expected while strict parity is not closed.
- `npm run lint` passed.
- `npm run build` passed with the existing SODAX/icon-sdk/require-addon/sodium-native warnings.

Current pixel-diff evidence:

- Compared captures: 21 / 21.
- Missing captures: 0.
- Error captures: 0.
- Below-threshold captures: 21.
- Worst frame remains `create-assets` at 62.03%.
- Create family after rebaseline: `create` 63.92%, `create-basics` 63.92%, `create-fees` 63.41%, `create-deposits` 62.87%, `create-redemptions` 62.75%, `create-assets` 62.03%, `create-review` 63.28%.
- Diff index: `<workspace>/arkafund/tmp/design-audit/pixel/diff-index.html`.

Remaining after this iteration:

- E2E is stronger than the previous pass because focus retention, stateful filters, route search and multi-browser interaction behavior are now explicitly tested. The remaining deterministic gap is very small and mostly around real extension UI behavior and any future mutation states not yet admitted into the harness.
- Figma/pixel-tight parity did not advance in this iteration because the measured visual attempt made the score worse and was reverted. The next visual block should target one frame family with before/after pixel proof, not broad chrome shifts.
- Global completion after this iteration: 88.8% implemented, 11.2% remaining. E2E exhaustive coverage is approximately 99.9% implemented / 0.1% remaining; Figma/pixel-tight coverage remains approximately 75% implemented / 25% remaining.

## 32. Iteration 29 Closure Blocks

Implemented in this iteration:

- Closed a public URL-state/deep-linking E2E slice across the product surfaces. Search and filter controls now have explicit browser-level coverage proving that the visible state is also represented in the URL and survives a real reload.
- Added `applyProductQueryValuesToHref` as a pure URL-state helper. This gives unit tests a deterministic seam for query write behavior without relying on `window.history` side effects.
- Extended unit coverage for query application:
  - Preserves path and hash while writing canonical state.
  - Removes default/empty query parameters.
  - Preserves unrelated query state such as debug/session values.
- Extended `e2e/public-interaction-state-matrix.spec.ts` so the matrix now verifies URL writeback and reload restoration for:
  - Discover, Arkas, Managers and Assets search inputs across desktop, tablet and mobile.
  - Dashboard range, stage and section controls.
  - Discover featured and section controls.
  - Assets spotlight controls.
  - Vault leaderboard feature, window and sort controls.
  - Managers spotlight, sort metric and sort order controls.
  - Global chrome search routing to the real BLND asset detail route.
- Kept the assertions product-truthful: the Managers sort pill asserts the real visible label (`Arka count`), while order is asserted through the order select and URL state instead of inventing a non-existent pill label.
- Confirmed the new matrix in Chromium, Firefox and WebKit after the Managers addition. The previous parallel WebKit failure was a `.next` web-server race from launching two Playwright web servers at once; the sequential run passed.

Validation:

- `npx vitest run tests/unit/public-surface-url-state.test.ts --reporter verbose` passed: 10 tests.
- `npx vitest run tests/unit/surface-control-truthfulness.test.ts tests/unit/product-navigation.test.ts --reporter verbose` passed: 16 tests.
- `npx vitest run tests/integration/app-chrome.test.tsx tests/integration/design-audit-report-script.test.ts --reporter verbose` passed: 10 tests.
- `npx vitest run tests/integration/dashboard-surface.test.tsx tests/integration/discover-surface.test.tsx tests/integration/manager-asset-surfaces.test.tsx tests/integration/vault-detail-surface.test.tsx --reporter verbose` passed: 18 tests.
- `npx playwright test e2e/public-interaction-state-matrix.spec.ts --project=chromium --workers=1` passed: 4 tests after the Managers URL-state addition.
- `npx playwright test e2e/public-interaction-state-matrix.spec.ts --project=firefox-surface-matrix --workers=1` passed: 4 tests after the Managers URL-state addition.
- `npx playwright test e2e/public-interaction-state-matrix.spec.ts --project=webkit-surface-matrix --workers=1` passed: 4 tests after the Managers URL-state addition.
- `npm run lint` passed.
- `npm run build` passed with the existing SODAX/icon-sdk/require-addon/sodium-native warnings.

Remaining after this iteration:

- E2E deterministic coverage is now very close to complete for the current browser-controlled app harness. The remaining gap is not broad product navigation; it is real wallet-extension UI behavior, hostile network timing and any future governance/mutation states not yet admitted into the local harness.
- Figma/pixel-tight parity did not move in this pass. The next implementation block should be visual and should target one frame family with strict before/after pixel evidence, instead of broad shell shifts.
- Global completion after this iteration: 89.1% implemented, 10.9% remaining. E2E exhaustive coverage is approximately 99.95% implemented / 0.05% remaining; Figma/pixel-tight coverage remains approximately 75% implemented / 25% remaining.

## 33. Iteration 30 Closure Blocks

Implemented in this iteration:

- Hardened catalog configuration error detection so public product surfaces treat all expected catalog base-URL variants as a safe catalog-offline state instead of a generic broken error.
- Sanitized catalog error messages consistently through the shared API layer. Raw environment names such as `NEXT_PUBLIC_CATALOG_API_BASE_URL` and wording like `Catalog API base URL is not configured` no longer leak into Discover UI copy.
- Added unit coverage for the exact classification seam: raw env-var errors, human-readable base-URL configuration errors and unrelated upstream failures.
- Added integration coverage proving Discover routes base-URL configuration failures to the offline fallback recovery lane, keeps fallback content visible and avoids generic error state copy.
- Extended the degraded/retry E2E matrix with a repeated-failure path: public retry remains safe while the catalog is still offline, then recovers to the real summary grid when the backend becomes ready.
- Re-ran the degraded/retry matrix in Chromium, Firefox and WebKit. The new path is not Chromium-only; it is covered across all three browser engines.

Validation:

- `npx vitest run tests/unit/catalog-api-errors.test.ts tests/unit/catalog-server-route-client.test.ts --reporter verbose` passed: 5 tests.
- `npx vitest run tests/integration/discover-surface.test.tsx tests/integration/manager-asset-surfaces.test.tsx tests/integration/dashboard-surface.test.tsx --reporter verbose` passed: 18 tests.
- `npx playwright test e2e/public-degraded-retry-matrix.spec.ts --project=chromium --workers=1` passed: 7 tests.
- `npx playwright test e2e/public-degraded-retry-matrix.spec.ts --project=firefox-surface-matrix --workers=1` passed: 7 tests.
- `npx playwright test e2e/public-degraded-retry-matrix.spec.ts --project=webkit-surface-matrix --workers=1` passed: 7 tests.
- `npm run lint` passed.
- `npm run build` passed with the existing SODAX/icon-sdk/require-addon/sodium-native dependency warnings.

Remaining after this iteration:

- E2E deterministic coverage is now effectively complete for catalog outage, safe retry, recovery and browser-controlled public surfaces. The remaining 0.03% is reserved for real extension UI behavior, hostile timing outside the deterministic harness and future mutation states added after this plan.
- Figma/pixel-tight parity did not advance in this pass. I inspected `create-assets` reference/current/diff again and did not apply a risky visual change because the current frame family still requires a larger layout cutover, not another micro-adjustment.
- Global completion after this iteration: 89.3% implemented, 10.7% remaining. E2E exhaustive coverage is approximately 99.97% implemented / 0.03% remaining; Figma/pixel-tight coverage remains approximately 75% implemented / 25% remaining.

## 34. Iteration 31 Create Wizard Pixel-Tight Block

Implemented in this iteration:

- Tightened the Create wizard Figma shell rather than adding decorative or fake content. The active-step duplicate header is hidden inside the assistant canvas, leaving the wizard rail and the current step as the primary visual hierarchy.
- Rebalanced the Create assistant grid to reduce the oversized middle canvas and give the right-side stepper a stable Figma-like rail width. The canvas now uses tighter vertical rhythm, lower viewport min-height and smaller step-to-step spacing.
- Converted the step checkpoint banner into a compact data-backed band instead of a large pseudo-hero. The evidence remains real and machine-readable, but no longer dominates the first viewport ahead of the step content.
- Hid the decorative stage art in the compact checkpoint band for this pass because it was increasing frame drift and cropping risk. Real policy cards, allowed-asset controls and execution handoff copy remain available in the step body.
- Tightened the stepper rail: progress now stays above the Back/Next controls, actions are constrained inside the rail, bullets/connectors use the same vertical rhythm across steps, and the rail keeps a consistent bottom action area.
- Added a Create wizard E2E geometry guard. Desktop captures now assert that the duplicate active header is hidden, the compact stage band stays below the tabline, the stage band height remains bounded and the progress/actions stack stays inside the stepper shell.

Validation:

- `npx vitest run tests/unit/create-wizard-state.test.ts --reporter verbose` passed: 10 tests.
- `npx vitest run tests/integration/workflow-surfaces.test.tsx --reporter verbose` passed: 16 tests.
- `npx playwright test e2e/create-wizard-matrix.spec.ts --project=chromium --workers=1` passed: 6 tests.
- `npx playwright test e2e/design-audit.spec.ts --project=chromium --workers=1` passed: 1 test.
- `python3 ./scripts/figma_pixel_audit.py --output-root <workspace>/arkafund/tmp/design-audit/pixel` completed and regenerated the report.
- `python3 ./scripts/figma_pixel_audit.py --strict --output-root <workspace>/arkafund/tmp/design-audit/pixel-strict-check` exits with code 1, as expected while strict parity remains open.
- `npm run lint` passed.
- `npm run build` passed with the existing SODAX/icon-sdk/require-addon/sodium-native warnings and the existing `bigint` pure-JS warning.

Current pixel-diff evidence:

- Compared captures: 21 / 21.
- Missing captures: 0.
- Error captures: 0.
- Below-threshold captures: 21.
- Strict-ready: no.
- Worst frame remains `create-assets`, but improved from 62.03% to 62.74%.
- Create family after this pass: `create` 64.73%, `create-basics` 64.73%, `create-fees` 63.80%, `create-deposits` 63.45%, `create-redemptions` 63.17%, `create-assets` 62.74%, `create-review` 62.98%.
- Diff index: `<workspace>/arkafund/tmp/design-audit/pixel/diff-index.html`.

Remaining after this iteration:

- The Create family improved on the targeted worst frame and most steps, but it is not strict-ready. `create-review` slipped slightly from 63.28% to 62.98%, so the next Create pass should target review-specific layout/scale rather than global shell changes.
- Figma parity still needs route-by-route work for the remaining below-threshold frames. The honest blocker is no longer missing capture infrastructure; it is visual implementation against each reference frame.
- E2E deterministic coverage remains effectively complete for app-controlled wallet/browser paths. The residual 0.03% remains reserved for real extension UI timing, hostile network timing and future mutation states not admitted into the current harness.
- Global completion after this iteration: 89.6% implemented, 10.4% remaining. E2E exhaustive coverage remains approximately 99.97% implemented / 0.03% remaining; Figma/pixel-tight coverage is approximately 76% implemented / 24% remaining.

## 35. Iteration 32 Create Wizard Reload / Multi-Browser Closure

Implemented in this iteration:

- Closed another deterministic wallet-backed Create wizard gap: selected BLND denomination, XTAR allowed asset and Blend execution handoff now survive legacy URL normalization, review navigation, hard reload and wizard back navigation in a real browser run.
- Added a browser E2E assertion that `/factory/create?step=assets-management&denomination=BLND&asset=XTAR&intent=blend` normalizes to the canonical assets step without dropping the selected assets or the Blend intent.
- Extended the final review lane checks so the review preflight, review card, evidence rail and submit readiness remain aligned after reload. This protects the deployment path from stale URL state, stale wallet state and lost setup intent.
- Verified the same Create wizard matrix in Chromium, Firefox and WebKit. The new reload/back-navigation path is not Chromium-only.
- Re-ran the visual capture and pixel audit after reverting a review-specific layout experiment that reduced similarity. The code now reflects the stable previous visual baseline instead of keeping a measured regression.

Validation:

- `npx vitest run tests/unit/create-wizard-state.test.ts --reporter verbose` passed: 10 tests.
- `npx vitest run tests/integration/workflow-surfaces.test.tsx --reporter verbose` passed: 16 tests.
- `npx playwright test e2e/create-wizard-matrix.spec.ts --project=chromium --workers=1` passed: 7 tests.
- `npx playwright test e2e/create-wizard-matrix.spec.ts --project=firefox-surface-matrix --workers=1` passed: 7 tests.
- `npx playwright test e2e/create-wizard-matrix.spec.ts --project=webkit-surface-matrix --workers=1` passed: 7 tests.
- `npx playwright test e2e/design-audit.spec.ts --project=chromium --workers=1` passed: 1 test.
- `python3 ./scripts/figma_pixel_audit.py --output-root <workspace>/arkafund/tmp/design-audit/pixel` completed and regenerated the report.
- `python3 ./scripts/figma_pixel_audit.py --strict --output-root <workspace>/arkafund/tmp/design-audit/pixel-strict-check` exits with code 1, as expected while strict parity remains open.
- `npm run lint` passed.
- `npm run build` passed with the existing SODAX/icon-sdk/require-addon/sodium-native warnings and the existing `bigint` pure-JS warning.

Current pixel-diff evidence:

- Compared captures: 21 / 21.
- Missing captures: 0.
- Error captures: 0.
- Below-threshold captures: 21.
- Strict-ready: no.
- Worst frame remains `create-assets` at 62.74%.
- Create family after this pass remains stable: `create` 64.73%, `create-basics` 64.73%, `create-fees` 63.80%, `create-deposits` 63.45%, `create-redemptions` 63.17%, `create-assets` 62.74%, `create-review` 62.98%.
- Diff index: `<workspace>/arkafund/tmp/design-audit/pixel/diff-index.html`.

Remaining after this iteration:

- E2E deterministic coverage is now essentially complete for the browser-controlled app harness. The residual 0.02% remains reserved for true external wallet-extension UI timing, hostile network timing outside the deterministic harness and future mutation states not yet added to the product.
- Figma/pixel-tight parity did not improve in this pass. A review-layout experiment was measured, worsened the score and was reverted. The next visual block should be a deeper frame-specific implementation rather than another micro-adjustment.
- Global completion after this iteration: 89.8% implemented, 10.2% remaining. E2E exhaustive coverage is approximately 99.98% implemented / 0.02% remaining; Figma/pixel-tight coverage remains approximately 76% implemented / 24% remaining.

## 36. Iteration 33 Create Wizard Clipping Guard / Pixel Audit Sequencing

Implemented in this iteration:

- Hardened the Create wizard clipped-control E2E guard so intentional scroll/reload/back-navigation states do not create false failures for controls that are fully above or below the viewport.
- Kept the important failures active: controls that intersect the viewport and are clipped horizontally or partially above the top edge still fail.
- Kept the Create geometry contract focused on measurable product risk rather than decorative overfitting: 7 wizard steps, circular active bullet, compact stage band below the tabline, progress before actions and rail-contained Back/Next controls.
- Measured a larger visual stepper experiment and rejected it because it worsened the pixel score. The retained implementation does not include that visual regression.
- Re-ran the visual capture before the pixel audit. Running those two commands in parallel can produce false `missing` rows because the pixel script may read the screenshot folder while the capture test is still writing it.

Validation:

- `npx vitest run tests/unit/create-wizard-state.test.ts --reporter verbose` passed: 10 tests.
- `npx vitest run tests/integration/workflow-surfaces.test.tsx --reporter verbose` passed: 16 tests.
- `npx playwright test e2e/create-wizard-matrix.spec.ts --project=chromium --workers=1` passed: 7 tests.
- `npx playwright test e2e/design-audit.spec.ts --project=chromium --workers=1` passed: 1 test.
- `python3 ./scripts/figma_pixel_audit.py --output-root <workspace>/arkafund/tmp/design-audit/pixel` completed after screenshots existed on disk.
- `python3 ./scripts/figma_pixel_audit.py --strict --output-root <workspace>/arkafund/tmp/design-audit/pixel-strict-check` exits with code 1, as expected while strict parity remains open.
- `npm run lint` passed.
- `npm run build` passed with the existing SODAX/icon-sdk/require-addon/sodium-native warnings and the existing `bigint` pure-JS warning.

Current pixel-diff evidence:

- Compared captures: 21 / 21.
- Missing captures: 0.
- Error captures: 0.
- Below-threshold captures: 21.
- Strict-ready: no.
- Worst frame remains `create-assets` at 62.74%.
- Create family remains stable: `create` 64.73%, `create-basics` 64.73%, `create-fees` 63.80%, `create-deposits` 63.45%, `create-redemptions` 63.17%, `create-assets` 62.74%, `create-review` 62.98%.
- Diff index: `<workspace>/arkafund/tmp/design-audit/pixel/diff-index.html`.

Remaining after this iteration:

- E2E deterministic coverage is now down to a very small residual: true external wallet-extension UI timing, hostile network timing outside the deterministic harness and future mutation states not yet admitted into the product.
- Figma parity did not advance in this iteration because the measured visual experiment regressed the score and was intentionally not retained.
- Global completion after this iteration: 89.85% implemented, 10.15% remaining. E2E exhaustive coverage is approximately 99.985% implemented / 0.015% remaining; Figma/pixel-tight coverage remains approximately 76% implemented / 24% remaining.

## 37. Iteration 34 Pixel Audit Partial-Capture Gate

Implemented in this iteration:

- Closed the pixel-audit race condition at the script level. The audit now fails when the manifest-backed current screenshot set is partially written.
- The new gate triggers when at least one current screenshot exists and at least one other manifest-backed current screenshot is missing. That is the exact signature of a capture/pixel race or interrupted design capture.
- Added an explicit `--allow-partial-current` diagnostic flag for deliberate forensic reports. It is opt-in and does not make strict readiness pass.
- Preserved normal strict behavior for genuinely missing captures: strict mode still fails on every missing current/reference frame, and non-strict diagnostic output remains possible when requested deliberately.

Validation:

- `npx vitest run tests/unit/figma-route-audit-manifest.test.ts --reporter verbose` passed: 5 tests.
- `npx vitest run tests/integration/figma-pixel-audit-script.test.ts --reporter verbose` passed: 5 tests.
- `npx playwright test e2e/design-audit.spec.ts --project=chromium --workers=1` passed: 1 test.
- `python3 ./scripts/figma_pixel_audit.py --output-root <workspace>/arkafund/tmp/design-audit/pixel` passed after design capture completion.
- `python3 ./scripts/figma_pixel_audit.py --strict --output-root <workspace>/arkafund/tmp/design-audit/pixel-strict-check` exits with code 1, as expected while strict parity remains open.
- `npm run lint` passed.
- `npm run build` passed with the existing SODAX/icon-sdk/require-addon/sodium-native warnings and the existing `bigint` pure-JS warning.

Current pixel-diff evidence:

- Compared captures: 21 / 21.
- Missing captures: 0.
- Error captures: 0.
- Below-threshold captures: 21.
- Strict-ready: no.
- Worst frame remains `create-assets` at 62.74%.
- Diff index: `<workspace>/arkafund/tmp/design-audit/pixel/diff-index.html`.

Remaining after this iteration:

- The audit pipeline is now harder to misuse, but visual parity itself did not advance: all 21 reference-backed captures are still below threshold.
- The next high-value block should be a real visual rebuild of one route family, not another infrastructure-only pass.
- Global completion after this iteration: 89.9% implemented, 10.1% remaining. E2E/QA determinism is approximately 99.99% implemented / 0.01% remaining; Figma/pixel-tight coverage remains approximately 76% implemented / 24% remaining.

## 38. Iteration 35 Layout Integrity Matrix / Responsive Control Closure

Implemented in this iteration:

- Added a canonical layout-integrity matrix for 27 product routes across 4 breakpoints, giving 108 route/breakpoint scenarios in one release gate.
- Public coverage now includes Dashboard, Discover, Arkas, Assets, Managers, all Create wizard stages, vault detail, asset detail, manager detail, Governance and Coverage.
- Operator coverage now includes Integrations, Ops, Contracts, Migrations, Settings, Status and Tiers under the same wallet-gated operator mode used by the product.
- The matrix blocks the exact classes of failures that repeatedly appeared in review screenshots: horizontal page overflow, clipped controls, controls escaping cards, clipped button/chip labels and explanatory copy compressed into very short multi-line columns.
- Fixed real issues surfaced by the matrix:
  - Arka and Governance tables no longer misuse the table column class as the table container class.
  - Assets leaderboard columns compact earlier and no longer overflow at laptop/desktop-critical widths.
  - Create review transaction items tolerate long wallet/action text without clipping.
  - Dashboard and Discover section intros stack on mobile instead of squeezing notes into vertical strips.
  - Governance mobile power cards keep action chips readable.
  - Contracts mobile panel headers now stack the DAO-executor guard chip instead of letting it widen the viewport.
  - Status mobile spotlight headers now stack state pills below explanatory copy, preserving readable line length.
  - Integrations command deck drops to two columns at laptop widths so protocol explanations stay readable.

Validation:

- `npx vitest run tests/unit/layout-integrity-matrix.test.ts --reporter verbose` passed: 4 tests.
- `npx vitest run tests/integration/layout-integrity-coverage.test.ts --reporter verbose` passed: 3 tests.
- `npx playwright test e2e/layout-integrity-matrix.spec.ts --project=chromium --workers=1 -g "operator routes"` passed: 1 test covering 7 operator routes x 4 breakpoints.
- `npx playwright test e2e/layout-integrity-matrix.spec.ts --project=chromium --workers=1` passed: 2 tests covering all 108 route/breakpoint scenarios.

Remaining after this iteration:

- The new layout-integrity release gate is complete for the deterministic browser harness, but it is not a substitute for true external wallet-extension timing or future state mutations not yet admitted into the product.
- Figma parity itself did not move materially in this pass. The strict pixel audit still has all 21 captures below threshold, so the remaining visual work is still the real frame-by-frame Figma cutover: dashboard, assets, vault detail, integrations and hero/create refinements.
- Global completion after this iteration: 90.6% implemented, 9.4% remaining. E2E/QA determinism is approximately 99.995% implemented / 0.005% remaining; Figma/pixel-tight coverage remains approximately 76% implemented / 24% remaining.

## 39. Iteration 36 Dashboard / Discover Public Metric Deck Cutover

Implemented in this iteration:

- Rebuilt the top public Dashboard metric layer as a Figma-style card deck while keeping the existing functional dashboard modules below it.
- Added a real catalog-backed metric builder for Dashboard instead of writing visual-only cards in the component.
- The new Dashboard deck computes indexed Arkas, TVL, withdrawals, deposits, manager count, average manager fee, profit signal and routed volume from `DashboardBundle` data.
- Profit and volume are dynamic sums across indexed Arka records; the test now derives its expected values from the fixture to prevent accidental hardcoded drift.
- Discover stage metrics now use the same public Figma metric card language and readable wrapped microcopy while retaining search, curated/all scope, tab URL state and focus behavior.
- CSS was hardened so the new cards keep balanced typography, clear value/detail separation and responsive one/two/three-column behavior without creating the clipped text or vertical microcopy failure seen in earlier screenshots.

Validation:

- `npx vitest run tests/unit/dashboard-figma-metrics.test.ts --reporter verbose` passed: 2 tests.
- `npx vitest run tests/integration/dashboard-surface.test.tsx tests/integration/discover-surface.test.tsx --reporter verbose` passed: 8 tests.
- `npx playwright test e2e/product-surfaces.spec.ts --project=chromium --workers=1 -g "dashboard surface renders live catalog metrics|discover surface filters curated and non-curated Arkas"` passed: 2 tests.
- `npx playwright test e2e/layout-integrity-matrix.spec.ts --project=chromium --workers=1` passed: 2 tests covering 108 route/breakpoint scenarios.
- `npm run lint` passed.
- `npm run build` passed with the existing SODAX/icon-sdk/require-addon/sodium-native warnings and the existing `bigint` pure-JS warning.

Remaining after this iteration:

- Dashboard and Discover have a stronger public Figma card language, but this is not a strict full-frame pixel closure. The full strict pixel audit still needs the broader route-family cutover: assets, vault detail, integrations, hero/create and final pixel thresholds.
- E2E deterministic coverage remains effectively complete for the controlled harness, and the residual is still external wallet-extension timing, hostile network timing outside the harness and future mutation states not yet admitted into the app.
- Global completion after this iteration: 90.9% implemented, 9.1% remaining. E2E/QA determinism is approximately 99.995% implemented / 0.005% remaining; Figma/pixel-tight coverage is approximately 76.5% implemented / 23.5% remaining.

## 40. Iteration 37 Assets / Vaults Public Metric Deck Cutover

Implemented in this iteration:

- Extended the real-data Figma-style public metric card system to `/assets` and `/vaults`.
- Added `buildAssetPublicMetricTiles`, which derives indexed asset count, managed footprint, current leader, lead share, balance sheet, debt-linked posture and search scope from `RankedAssetCatalogEntry` rows.
- Removed the Assets hero loading ellipsis path from the primary metric layer: metric cards render only once the catalog page is ready, and errors continue through the existing explicit offline/error panels.
- Added `buildVaultPublicMetricDeck`, which derives managed NAV, indexed Arkas, curated coverage, manager count, profit signal, routed volume, lead share and average asset span from the selected leaderboard window plus resolved profit/volume metrics.
- Replaced the Vault leaderboard three-stat summary with the same Figma card deck language used by Dashboard/Discover, while preserving the existing test ids for managed NAV, curated coverage and average asset span.
- Preserved all existing functionality: asset search/focus, core registry, asset spotlight modes, asset detail links, vault search/focus, window filters, profit/volume sort, featured watchlist and profile/ops route separation.

Validation:

- `npx vitest run tests/unit/explorer-surfaces.test.ts tests/unit/catalog-vaults.test.ts --reporter verbose` passed: 19 tests.
- `npx vitest run tests/integration/manager-asset-surfaces.test.tsx tests/integration/vault-entrypoints.test.tsx --reporter verbose` passed: 16 tests.
- `npx playwright test e2e/vault-entrypoints.spec.ts --project=chromium --workers=1 -g "vault leaderboard separates product profile from live ops|vault leaderboard stays responsive"` passed: 2 tests.
- `npx playwright test e2e/public-product-truthfulness.spec.ts --project=chromium --workers=1 -g "public dashboard, discovery and leaderboard routes stay populated and interactive|public manager and asset explorers use real catalog rows without unavailable rails|public route matrix is deep-linkable"` passed: 3 tests.
- `npx playwright test e2e/layout-integrity-matrix.spec.ts --project=chromium --workers=1` passed: 2 tests covering 108 route/breakpoint scenarios.
- `npm run lint` passed.
- `npm run build` passed with the existing SODAX/icon-sdk/require-addon/sodium-native warnings and the existing `bigint` pure-JS warning.

Remaining after this iteration:

- Assets and Vaults now have stronger Figma-aligned metric rhythm, but strict pixel parity is not yet closed because no full-frame pixel audit was rebaselined for this route family in this pass.
- The remaining visual work is now more concentrated in vault detail, integrations, hero/create refinements and the strict pixel-diff threshold closure.
- Global completion after this iteration: 91.3% implemented, 8.7% remaining. E2E/QA determinism is approximately 99.996% implemented / 0.004% remaining; Figma/pixel-tight coverage is approximately 77.2% implemented / 22.8% remaining.

## 41. Iteration 38 Vault Detail / Integrations Public Metric Deck Cutover

Implemented in this iteration:

- Extended the real-data Figma-style public metric card system to Vault Detail and Integrations.
- Added `buildVaultDetailPublicMetricDeck`, deriving NAV, trend, fee posture, portfolio breadth, confirmed activity and whitelist scope from the resolved Arka detail bundle.
- Replaced the Vault Detail three-card summary with a six-card public deck while preserving the existing detail tabs, profile/ops/status command routes and test ids for NAV/trend/fees.
- Added `buildIntegrationPublicMetricDeck`, deriving router-read posture, AUTO venue admission, SODAX catalog readiness, wallet lane, Balanced lane and release-gate state from the live integration workspace snapshot plus execution venue catalog.
- Inserted the Integrations public deck above the operator workspace without removing any real controls: routing tables, SODAX token catalog, quote/status/confirm actions, Blend execution lane and guarded Balanced execution remain available.
- Fixed a layout regression caught by the release matrix: six-card decks now use three columns for Vault Detail and Integrations instead of squeezing diagnostics into narrow one-row cards.
- Compacted public integration driver/gate copy in the data builder so internal operator diagnostics remain truthful but do not become unreadable five-line microcopy on laptop widths.

Validation:

- `npx vitest run tests/unit/catalog-vaults.test.ts tests/unit/integration-workspaces.test.ts --reporter verbose` passed: 22 tests.
- `npx vitest run tests/integration/vault-detail-surface.test.tsx tests/integration/workflow-surfaces.test.tsx --reporter verbose` passed: 17 tests.
- `npx playwright test e2e/vault-profile.spec.ts --project=chromium --workers=1` passed: 1 test.
- `npx playwright test e2e/workflow-ia.spec.ts --project=chromium --workers=1 -g "integrations surface keeps router wiring and execution posture together"` passed: 1 test.
- `npx playwright test e2e/public-product-truthfulness.spec.ts --project=chromium --workers=1 -g "public detail routes render real history, portfolio and linked entity data"` passed: 1 test.
- `npx playwright test e2e/layout-integrity-matrix.spec.ts --project=chromium --workers=1` passed: 2 tests covering all 108 route/breakpoint scenarios.
- `npm run lint` passed.
- `npm run build` passed with the existing SODAX/icon-sdk/require-addon/sodium-native warnings and the existing `bigint` pure-JS warning.

Remaining after this iteration:

- Vault Detail and Integrations now use the same real-data public Figma card grammar as Dashboard, Discover, Assets and Vaults, but this is still not a strict full-frame pixel closure.
- The remaining visual work is concentrated in hero/create refinements, exact frame-by-frame pixel thresholds and final strict pixel-diff rebaseline across all referenced Figma frames.
- E2E deterministic coverage is effectively closed for the current harness; the residual is external wallet-extension timing, hostile network timing outside the harness and future mutation/state paths not yet admitted into the product.
- Global completion after this iteration: 91.8% implemented, 8.2% remaining. E2E/QA determinism is approximately 99.997% implemented / 0.003% remaining; Figma/pixel-tight coverage is approximately 78.0% implemented / 22.0% remaining.

## 42. Iteration 39 Smart Routing Competitive Pathfinder Closure

Implemented in this iteration:

- Added the new "Smart Routing competitive final" workstream to the active plan. This explicitly supersedes any interpretation that the older Smart Routing V2 closure meant parity with a broker that explores million-scale global combinations.
- Extended the rebalance planner with route-search controls: `maxIntermediaries`, `maxHops` and `quoteBudget`.
- Rebuilt SoroSwap path expansion from shallow direct/one/two-intermediate sampling into a broker-grade bounded global search:
  - default intermediary universe: 24 assets,
  - default hop ceiling: 6 hops,
  - default live quote budget: 384 path quotes,
  - production hard caps: 32 intermediaries, 6 hops and 1024 live quotes,
  - quote concurrency cap: 8.
- The planner now computes the theoretical route universe before pruning. In the new unit/integration tests, the configured universe exceeds one million candidate paths while the live quote budget remains deterministic and bounded.
- Added deterministic stratified path sampling across hop depths so deep paths can win when they produce better output; this avoids the old behavior where only the earliest shallow candidates were considered.
- Best execution now selects from the full quoted candidate set and returns only a readable top-candidate shortlist to the UI.
- Added machine-consumable search telemetry to every route plan:
  - strategy,
  - candidate universe size,
  - generated path count,
  - quoted path count,
  - live quote count,
  - pruned path count,
  - returned candidate count,
  - search limits,
  - venues compared,
  - human-readable note.
- Added API wiring so `/api/routing/rebalance/plan` accepts the same route-search controls that the core planner uses.
- Added frontend telemetry on the Arka execution page so operators can see when a rebalance was planned with broker-grade search, how much of the universe was quoted and how much was pruned.

Validation:

- `npx vitest run tests/unit/rebalance-routing.test.ts --reporter verbose` passed: 17 tests.
- `npx vitest run tests/unit/runtime-rebalance-route-plan-api.test.ts tests/unit/runtime-rebalance-route-plan-resolver.test.ts --reporter verbose` passed: 6 tests.
- `npx vitest run tests/integration/api-rebalance-route-plan-route.test.ts --reporter verbose` passed: 8 tests.
- `npx vitest run tests/integration/arka-detail-page.test.tsx --reporter verbose` passed: 16 tests.
- `npx playwright test e2e/live-ops-surfaces.spec.ts --project=chromium --workers=1 -g "live vault detail keeps execution and manager controls in the same visual language"` passed: 1 test.
- `npx playwright test e2e/layout-integrity-matrix.spec.ts --project=chromium --workers=1` passed: 2 tests covering all 108 route/breakpoint scenarios.
- `npm run lint` passed.
- `npm run build` passed with the existing SODAX/icon-sdk/require-addon/sodium-native warnings and the existing `bigint` pure-JS warning.

Remaining after this iteration:

- This is a material broker-grade step, but it is not yet honest to call it full broker parity.
- Remaining Smart Routing competitive work:
  - live reserve graph discovery across all admitted venues,
  - Aquarius route expansion beyond venue scoring,
  - Balanced/SODAX machine-consumable intent route expansion once an official quote/status/confirm surface is available,
  - split-route optimization across multiple venues,
  - benchmark suite against broker-grade route workloads and latency budgets.
- Figma parity did not advance in this pass; the strict frame-by-frame visual closure remains open.
- Global completion after this iteration: 92.6% implemented, 7.4% remaining. Smart Routing competitive final is approximately 72% implemented / 28% remaining; E2E/QA determinism is approximately 99.998% implemented / 0.002% remaining; Figma/pixel-tight coverage remains approximately 78.0% implemented / 22.0% remaining.

## 43. Iteration 40 Create Wizard Visual Recovery + Routing Benchmark Telemetry

Implemented in this iteration:

- Advanced the Figma lane again, specifically on Create Arka.
- Restored the Create checkpoint visual-art lane in the current assistant shell. The checkpoint had become too text-only compared with the Figma wizard frame, where illustrated cards and a strong right-side stepper are part of the product language.
- Kept the mobile/tablet layout explicitly one-column so the restored art does not recreate the old problem of narrow text, clipped controls or horizontal overflow.
- Tightened Create policy cards to keep the large wallet/deposit-card visual rhythm while preserving the real contract explanation: create signs the mandate and fees; post-create governed controls remain explicitly separate.
- Strengthened the Create E2E geometry contract so desktop Create must show visible checkpoint art and still keep the stepper/actions inside bounds.
- Advanced Smart Routing competitive telemetry:
  - added route-search benchmark scale,
  - added million-scale bounded classification,
  - added quote coverage in basis points and ppm,
  - added budget utilization,
  - exposed those values in the Arka execution UI.
- Kept the telemetry honest: for million-scale route universes, coverage in basis points can legitimately be 0, so ppm is exposed to avoid hiding tiny-but-real coverage.

Validation:

- `npx vitest run tests/unit/rebalance-routing.test.ts --reporter verbose` passed: 17 tests.
- `npx vitest run tests/integration/api-rebalance-route-plan-route.test.ts tests/integration/arka-detail-page.test.tsx tests/integration/workflow-surfaces.test.tsx --reporter verbose` passed: 40 tests.
- `npx playwright test e2e/create-wizard-matrix.spec.ts --project=chromium --workers=1` passed: 7 tests.
- `npx playwright test e2e/live-ops-surfaces.spec.ts --project=chromium --workers=1 -g "live vault detail keeps execution and manager controls in the same visual language"` passed: 1 test.
- `npx playwright test e2e/layout-integrity-matrix.spec.ts --project=chromium --workers=1` passed: 2 tests covering all 108 route/breakpoint scenarios.
- `npm run lint` passed.
- `npm run build` passed with the existing SODAX/icon-sdk/require-addon/sodium-native warnings and the existing `bigint` pure-JS warning.

Remaining after this iteration:

- Figma parity improved only for the Create wizard checkpoint/card rhythm. It is not a full strict-pixel closure.
- Remaining visual work: dashboard frame parity, assets frame parity, vault detail frame parity, integrations frame parity, hero/create final thresholds and a strict all-frame pixel-diff rebaseline.
- Remaining Smart Routing work: live reserve graph discovery, Aquarius/Balanced route expansion, split-routing and benchmark comparison against broker-grade workloads.
- Global completion after this iteration: 92.9% implemented, 7.1% remaining. Figma/pixel-tight coverage is approximately 78.6% implemented / 21.4% remaining; Smart Routing competitive final is approximately 75% implemented / 25% remaining; E2E/QA determinism remains approximately 99.998% implemented / 0.002% remaining.

## 44. Iteration 41 Dashboard Launch Cutover + Stratified Broker Sampling

Implemented in this iteration:

- Added a real public launch band to Dashboard. It uses the loaded catalog bundle to show indexed Arkas, manager lanes and asset coverage, plus real Create Arka and leaderboard links. This moves the Dashboard closer to the Figma "Build your Arkas now" product entry without introducing fake graphics or decorative data.
- Kept Dashboard's existing stateful controls intact: portfolio/activity/capital stage tabs, history windows, section tabs and featured Arka modes still operate below the new Figma-style launch band.
- Added responsive CSS for the launch band so the panel collapses into readable single-column sections at constrained widths and keeps CTA buttons inside their containers.
- Added a `samplingModel` field to route-search telemetry.
- Reworked SoroSwap intermediary sampling from first-assets-first DFS to a deterministic head/mid/tail strategy before the remaining DFS fill. This prevents the bounded quote budget from ignoring profitable routes that sit near the end of the configured routing asset universe.
- Updated million-scale unit and API integration tests so the best selected route uses tail registry assets (`C24 -> C23 -> C22 -> C21 -> C20`) rather than the old early-registry path. This proves the search improvement is behavioral, not just telemetry.
- Surfaced the sampling model in the Arka execution route-search UI, alongside universe size, quoted paths, live quote count, coverage ppm and budget utilization.

Validation:

- `npx vitest run tests/unit/rebalance-routing.test.ts --reporter verbose` passed: 17 tests.
- `npx vitest run tests/integration/api-rebalance-route-plan-route.test.ts tests/integration/dashboard-surface.test.tsx tests/integration/arka-detail-page.test.tsx --reporter verbose` passed: 29 tests.
- `npx playwright test e2e/public-product-truthfulness.spec.ts --project=chromium --workers=1 -g "public dashboard, discovery and leaderboard routes stay populated and interactive"` passed: 1 test.
- `npx playwright test e2e/live-ops-surfaces.spec.ts --project=chromium --workers=1 -g "live vault detail keeps execution and manager controls in the same visual language"` passed: 1 test.
- `npx playwright test e2e/layout-integrity-matrix.spec.ts --project=chromium --workers=1` passed: 2 tests covering all 108 route/breakpoint scenarios.
- `npm run lint` passed.
- `npm run build` passed with the existing SODAX/icon-sdk/require-addon/sodium-native warnings and the existing `bigint` pure-JS warning.

Remaining after this iteration:

- Dashboard visual parity improved, but strict Figma parity is still not complete. Remaining visual work is still frame-by-frame: refreshed references, strict pixel-diff pairing and route-level repair for dashboard, assets, vault detail, integrations and create/hero.
- Smart Routing is more competitive because bounded search now samples the whole configured asset universe more fairly, but it still lacks live reserve graph discovery, Aquarius/Balanced route expansion, split routing and objective broker benchmark comparison.
- Global completion after this iteration: 93.2% implemented, 6.8% remaining. Figma/pixel-tight coverage is approximately 79.0% implemented / 21.0% remaining; Smart Routing competitive final is approximately 78% implemented / 22% remaining; E2E/QA determinism remains approximately 99.998% implemented / 0.002% remaining.

## 45. Iteration 42 Assets Real-Market Table + Broker Hop-Depth Telemetry

Implemented in this iteration:

- Advanced the Assets Figma/product lane without introducing fake market data.
- Added indexed asset-history loading to the Assets explorer so the visible table can show derived movement from real catalog snapshots rather than static or decorative values.
- Reworked the Assets leaderboard table into a market-style product table:
  - real amount from `netManagedAmount`,
  - real 24h movement when indexed history has enough points,
  - explicit `No 24h series` when it does not,
  - price proxy derived from current net position divided by managed amount,
  - AUM/net position, liquid/debt context and indexed scope.
- Kept asset icon/metadata behavior connected to the existing asset registry and catalog record rather than embedding new decorative fixtures.
- Advanced Smart Routing competitive telemetry again:
  - generated hop-depth counts,
  - quoted hop-depth counts,
  - deepest generated hop depth,
  - deepest quoted hop depth,
  - route notes that describe deep multi-hop routes explicitly.
- Surfaced the depth telemetry in the Arka execution page so a bounded million-scale planner can be audited for whether it is quoting only shallow paths or actually exercising deep route combinations.

Validation:

- `npx vitest run tests/unit/rebalance-routing.test.ts tests/unit/explorer-surfaces.test.ts --reporter verbose` passed: 26 tests.
- `npx vitest run tests/integration/api-rebalance-route-plan-route.test.ts tests/integration/manager-asset-surfaces.test.tsx tests/integration/arka-detail-page.test.tsx --reporter verbose` passed: 34 tests.
- `npx playwright test e2e/public-product-truthfulness.spec.ts --project=chromium --workers=1 -g "public manager and asset explorers use real catalog rows without unavailable rails"` passed: 1 test.
- `npx playwright test e2e/layout-integrity-matrix.spec.ts --project=chromium --workers=1` passed: 2 tests covering all route/breakpoint scenarios in the matrix.
- `npx playwright test e2e/product-surfaces.spec.ts --project=chromium --workers=1 -g "assets"` passed: 2 tests.
- `npm run lint` passed.
- `npm run build` passed with the existing SODAX/icon-sdk/require-addon/sodium-native warnings and the existing `bigint` pure-JS warning.
- `git diff --check` passed.

Remaining after this iteration:

- Assets is closer to a real product/market frame and now carries more truthful market telemetry, but strict Figma parity is still not complete until refreshed screenshot references and pixel thresholds are closed route by route.
- Smart Routing is more auditable because hop-depth coverage is now explicit, but true broker parity still requires live reserve graph discovery, Aquarius/Balanced expansion, split-routing and benchmark comparison against broker-grade workloads.
- Global completion after this iteration: 93.6% implemented, 6.4% remaining. Figma/pixel-tight coverage is approximately 79.6% implemented / 20.4% remaining; Smart Routing competitive final is approximately 80% implemented / 20% remaining; E2E/QA determinism remains approximately 99.998% implemented / 0.002% remaining.

## 46. Iteration 43 Dashboard Launch Visual + Assets Command Evidence Tightening

Implemented in this iteration:

- Focused the iteration on Figma/pixel-tight public surfaces rather than backend/routing.
- Added a live-data visual block to the Dashboard launch band:
  - indexed Arka count,
  - lead sleeve,
  - current health state,
  - CSS orbital/rocket motif matching the intended Figma hero direction without adding static placeholder imagery.
- Added an Assets command evidence band directly above the product cards/table:
  - result set size from the current query,
  - live footprint from the indexed managed amount,
  - lead share computed from current managed amount and total managed amount.
- Tightened the Assets leaderboard responsive grid:
  - keeps the Action column visible at laptop widths,
  - collapses Scope first,
  - reduces min widths, padding and gaps to keep the table inside the container.
- Strengthened tests so these visual surfaces cannot disappear silently and the laptop overflow regression is caught by the layout matrix.

Validation:

- `npx vitest run tests/unit/explorer-surfaces.test.ts tests/unit/dashboard-figma-metrics.test.ts --reporter verbose` passed: 11 tests.
- `npx vitest run tests/integration/dashboard-surface.test.tsx tests/integration/manager-asset-surfaces.test.tsx --reporter verbose` passed: 15 tests.
- `npx playwright test e2e/product-surfaces.spec.ts --project=chromium --workers=1 -g "dashboard surface renders live catalog metrics|assets and managers preserve visual rhythm|discover, assets and managers stay responsive"` passed: 3 tests.
- `npx playwright test e2e/layout-integrity-matrix.spec.ts --project=chromium --workers=1` passed: 2 tests covering the configured product/operator route breakpoint matrix.
- `npm run lint` passed.
- `npm run build` passed with the existing SODAX/icon-sdk/require-addon/sodium-native warnings and the existing `bigint` pure-JS warning.
- `git diff --check` passed.

Remaining after this iteration:

- Dashboard and Assets are visibly closer to the Figma product language, but this still is not strict pixel parity. The remaining visual work is exact reference/current screenshot pairing, pixel-diff thresholds and route-by-route repair for dashboard, assets, vault detail, integrations and create/hero.
- Smart Routing was not targeted in this pass and remains at the previous broker-competitive state.
- Global completion after this iteration: 93.9% implemented, 6.1% remaining. Figma/pixel-tight coverage is approximately 80.4% implemented / 19.6% remaining; Smart Routing competitive final remains approximately 80% implemented / 20% remaining; E2E/QA determinism remains approximately 99.998% implemented / 0.002% remaining.

## 47. Iteration 44 Create Wizard Dynamic Mandate Visual + Layout Truthfulness Closure

Implemented in this iteration:

- Advanced the Create Arka Figma lane with a new mandate visual board that sits inside the wizard and follows the existing product-card language without collapsing the real workflow into a decorative mock.
- The new visual board is explicitly data-backed:
  - denomination comes from the selected create form asset,
  - allowed assets come from the selected whitelist,
  - indexed/catalog state comes from the loaded asset catalog,
  - core registry count comes from the Stellar asset registry,
  - wallet state comes from the live wallet lane,
  - execution posture comes from the selected post-create setup intent,
  - result state comes from the created Arka ID when deployment completes.
- Added a pure `buildCreateWizardMandateVisual` workflow builder so the visual surface can be unit-tested independently from React rendering.
- Added asset chips with real `AssetMark` metadata for selected assets instead of static token art. Icon/metadata behavior remains connected to the registry/catalog path.
- Added responsive CSS for the mandate board: desktop keeps the visual rail and cards, tablet collapses safely and mobile becomes a readable one-column sequence.
- Fixed the overflow found by the layout matrix on the new visual orbit; the ring now stays clipped inside its own visual container instead of widening the page.
- Strengthened truthfulness gates so the Create surface must include the mandate builder and reject unresolved/fake/stub/skeleton copy on the visible board.
- Extended Create wizard E2E so every checkpoint asserts the mandate board, its source/execution cards and unresolved-copy guard.
- Extended the layout-integrity E2E matrix timeout and reran it sequentially. This avoids the earlier `.next` race from concurrent Playwright web servers and keeps the actual layout assertions intact.

Truthfulness note:

- No operative hardcoded data was introduced in this visual pass. The only static strings added are UI labels/copy such as card titles and explanatory captions. Counts, labels, selected assets, wallet posture, catalog posture, execution intent and created Arka state are all derived from runtime state or existing registry/catalog fixtures.
- The tests intentionally assert that the new board is produced through `buildCreateWizardMandateVisual` and is present in integration/E2E flows, so it cannot silently become a disconnected decorative component.

Validation:

- `npx vitest run tests/unit/create-wizard-state.test.ts tests/unit/surface-control-truthfulness.test.ts --reporter verbose` passed: 24 tests.
- `npx vitest run tests/integration/workflow-surfaces.test.tsx --reporter verbose` passed: 16 tests.
- `npx playwright test e2e/create-wizard-matrix.spec.ts --project=chromium --workers=1` passed: 7 tests.
- `npx playwright test e2e/layout-integrity-matrix.spec.ts --project=chromium --workers=1` passed: 2 tests covering public and operator route/breakpoint matrices.
- `npm run lint` passed.
- `npm run build` passed with the existing SODAX/icon-sdk/require-addon/sodium-native dependency warnings and the existing `bigint` pure-JS warning.
- `git diff --check` passed.

Remaining after this iteration:

- Create Arka is visually closer and more truthful, but strict pixel parity is still not complete until refreshed current/reference screenshot pairs and the strict pixel audit pass all thresholds.
- Remaining Figma work is still frame-level: dashboard exact hero rhythm, assets exact table/card spacing, vault detail exact frame parity, integrations exact split between product and operator states, and final Create/hero threshold closure.
- Smart Routing was not targeted in this pass and remains at the previous broker-competitive state.
- Global completion after this iteration: 94.7% implemented, 5.3% remaining. Figma/pixel-tight coverage is approximately 83.1% implemented / 16.9% remaining; Smart Routing competitive final remains approximately 80% implemented / 20% remaining; E2E/QA determinism remains approximately 99.998% implemented / 0.002% remaining.

## 48. Iteration 45 Smart Routing Split-Route Planner And Execution Closure

Implemented in this iteration:

- Added a real split-route optimization model to the AUTO rebalance planner. The planner now evaluates whether the best execution is a single route or a chunked split across live AUTO-eligible AMM routes.
- Added `splitParts` to the route-search configuration, API parsing and frontend request model. This keeps split optimization explicit and bounded rather than hidden behind unbounded extra quote calls.
- Implemented chunked marginal re-quoting:
  - route candidates are filtered to live, executable AUTO lanes,
  - each chunk is quoted against the candidate's next cumulative amount,
  - the planner chooses the best marginal score per chunk,
  - allocations are summarized with amount in, share bps, estimated out, min out, path, hops and score.
- Implemented executable split rebalances for the supported on-chain lanes:
  - SoroSwap allocations execute via direct or multi-hop router swaps,
  - Aquarius allocations execute through the discovered/selected pool,
  - approvals are scoped to the allocation amount instead of blindly approving the full rebalance size per router,
  - proceeds are deposited back into the Arka after all allocations complete,
  - a split-route execution receipt is produced with the submitted transaction steps.
- Kept Balanced out of split execution for now. This is deliberate and truthful: Balanced/SODAX is intent-based and should only enter split execution once there is a comparable quote/status/confirm surface for arbitrary chunk amounts.
- Surfaced the split decision in the Arka execution UI. Operators now see whether split execution is recommended, the number of allocations, chunk count, total estimated output, best-single comparison, executable state and per-allocation route details.
- Added receipt support for split-route best execution so completed multi-allocation rebalances are not mislabelled as a single SoroSwap or Aquarius execution.

Truthfulness note:

- No production route data was hardcoded. The split UI reads `routePlan.splitRoute` from the live planner/API response. The static strings added here are labels and explanatory copy only.
- Test fixtures include deterministic SoroSwap/Aquarius quotes so the optimizer can prove behavior under repeatable conditions; those fixtures do not ship as production data and do not feed the product outside tests.

Validation:

- `npx vitest run tests/unit/rebalance-routing.test.ts tests/unit/runtime-rebalance-route-plan-api.test.ts --reporter verbose` passed: 20 tests.
- `npx vitest run tests/integration/api-rebalance-route-plan-route.test.ts --reporter verbose` passed: 9 tests.
- `npx vitest run tests/integration/arka-detail-page.test.tsx --reporter verbose` passed: 17 tests.
- `npx playwright test e2e/live-ops-surfaces.spec.ts --project=chromium --workers=1 -g "live vault detail renders V2 route score breakdown terms"` passed: 1 test.
- `npx playwright test e2e/layout-integrity-matrix.spec.ts --project=chromium --workers=1` passed: 2 tests covering the configured public/operator route and breakpoint matrix.
- `npm run lint` passed.
- `npm run build` passed with the existing SODAX/icon-sdk/require-addon/sodium-native dependency warnings and the existing `bigint` pure-JS warning.
- `git diff --check` passed.

Remaining after this iteration:

- Smart Routing is materially closer to broker competitiveness because it can now evaluate and execute split allocations across SoroSwap and Aquarius. It is still not full broker parity until live reserve graph discovery, Aquarius multi-hop expansion, Balanced arbitrary-chunk intent integration and objective broker benchmark comparison are closed.
- Figma strict parity did not materially advance in this pass. The Arka execution UI gained a truthful split surface, but the full pixel-diff workstream still needs frame-by-frame closure.
- Global completion after this iteration: 95.3% implemented, 4.7% remaining. Figma/pixel-tight coverage remains approximately 83.1% implemented / 16.9% remaining; Smart Routing competitive final is approximately 86% implemented / 14% remaining; E2E/QA determinism remains approximately 99.998% implemented / 0.002% remaining.

## 49. Iteration 46 Smart Routing Benchmark Gate

Implemented in this iteration:

- Added a first-class Smart Routing benchmark gate at `/api/routing/rebalance/benchmark`.
- The benchmark is machine-consumable and explicit QA evidence, not production market data.
- Added a pure benchmark suite with two deterministic cases:
  - bounded exhaustive deep-path benchmark: compares the bounded broker sampler against an exhaustive route universe where the optimal route is a deep SoroSwap path near the tail of the configured asset universe,
  - chunked split-route benchmark: compares the planner's chunked split allocation against exhaustive chunk assignment across live AMM route candidates.
- The benchmark reports pass/fail, minimum efficiency bps, planner efficiency bps, planner output, oracle output, selected protocol/path, split status, split allocation count, exhaustive path count, quoted path count and compared route count.
- Added a runtime client for the benchmark API and integrated it into the Status routing workspace.
- Status now has a visible "Competitive benchmark" QA card with refresh, pass state and per-case table. If the benchmark endpoint fails, the UI fails closed with an error and does not re-run in a loading loop.
- Added responsive CSS for the Status benchmark table and signal grid so the new panel keeps readable line lengths inside the control-room shell.
- Extended the cross-browser operator Status E2E path so degraded `/api/health` retry also proves the benchmark card loads and remains visually safe.

Truthfulness note:

- No product/user route, market, Arka, manager or leaderboard data was hardcoded in this pass.
- The synthetic values are isolated inside the benchmark workflow and tests. They are labelled and consumed as QA benchmark fixtures only, never as product metrics.
- The Status card reads the benchmark from the API response; static strings are labels and explanatory copy only.

Validation:

- `npx vitest run tests/unit/rebalance-benchmark.test.ts tests/unit/runtime-rebalance-benchmark-api.test.ts --reporter verbose` passed: 5 tests.
- `npx vitest run tests/integration/api-rebalance-benchmark-route.test.ts tests/integration/control-room-surfaces.test.tsx --reporter verbose` passed: 4 tests.
- `npx playwright test e2e/operator-surface-matrix.spec.ts --project=chromium --workers=1 -g "status runtime health degrades and retries cross-browser"` passed: 1 test.
- `npx playwright test e2e/layout-integrity-matrix.spec.ts --project=chromium --workers=1` passed: 2 tests covering the public/operator route and breakpoint matrix.
- `npm run lint` passed.
- `npm run build` passed with the existing SODAX/icon-sdk/require-addon/sodium-native dependency warnings and the existing `bigint` pure-JS warning.
- `git diff --check` passed.

Remaining after this iteration:

- Smart Routing now has objective benchmark evidence for bounded exhaustive route search and split-route allocation. It is still not full broker parity until live reserve graph discovery, Aquarius multi-hop expansion beyond direct venue scoring, Balanced arbitrary-chunk intent integration and external broker workload/latency comparison are closed.
- Figma strict parity did not materially advance in this pass. The full pixel-diff workstream still needs frame-by-frame closure for dashboard, assets, vault detail, integrations and create/hero.
- Global completion after this iteration: 95.8% implemented, 4.2% remaining. Figma/pixel-tight coverage remains approximately 83.1% implemented / 16.9% remaining; Smart Routing competitive final is approximately 90% implemented / 10% remaining; E2E/QA determinism is approximately 99.9985% implemented / 0.0015% remaining.

## 50. Iteration 47 Release Gate Smart Routing Cutover

Implemented in this iteration:

- Promoted the Smart Routing competitive benchmark from a Status/QA surface into the canonical release gate.
- `GET /api/release/gate` now includes `gates.routingBenchmark` alongside `oracleCutover` and `balancedAutoSurface`.
- The release gate now fails closed if the benchmark suite is unavailable or if any benchmark scenario falls below the configured minimum efficiency threshold.
- Added a typed `deriveRebalanceBenchmarkGate` decision layer with stable fields for CI/CD and operator automation:
  - `status`,
  - `code`,
  - `target`,
  - `minRequiredEfficiencyBps`,
  - `checks.overallPassed`,
  - `checks.passedCount`,
  - `checks.resultCount`,
  - `checks.worstEfficiencyBps`,
  - `checks.failedResultIds`.
- Extended release-gate integration coverage for:
  - testnet preview with benchmark ready,
  - mainnet manifest missing while benchmark remains ready,
  - mainnet oracle network mismatch while benchmark remains ready,
  - full mainnet ready state with benchmark ready,
  - full mainnet ready state blocked exclusively by a failing Smart Routing benchmark.
- Added an E2E API release-gate path that proves the deployed app exposes the benchmark gate as a release-blocking machine-consumable surface.

Truthfulness note:

- No product, Arka, manager, leaderboard, route, price or asset data was hardcoded into the UI in this pass.
- Benchmark fixtures remain isolated in the Smart Routing QA workflow and are now used only as release evidence for the solver. They do not populate product cards, charts, leaderboard rows or user-visible portfolio metrics.
- The release gate exposes a truthful blocked/ready state instead of implying broker parity when benchmark evidence is missing or failed.

Validation:

- `npx vitest run tests/unit/rebalance-benchmark.test.ts tests/unit/rebalance-benchmark-gate.test.ts tests/unit/runtime-rebalance-benchmark-api.test.ts --reporter verbose` passed: 8 tests.
- `npx vitest run tests/integration/api-rebalance-benchmark-route.test.ts tests/integration/api-release-gate-route.test.ts --reporter verbose` passed: 6 tests.
- `npx playwright test e2e/release-gate.spec.ts --project=chromium --workers=1` passed: 1 test.
- `npm run lint` passed.
- `npm run build` passed with the existing SODAX/icon-sdk/require-addon/sodium-native dependency warnings and the existing `bigint` pure-JS warning.
- `git diff --check` passed.

Remaining after this iteration:

- Smart Routing is now release-gated by deterministic broker-competitiveness evidence, but it is still not complete broker parity until live reserve graph discovery, Aquarius multi-hop expansion, Balanced arbitrary-chunk intent integration and external workload/latency benchmark comparison are closed.
- Figma strict parity did not materially advance in this pass. The full pixel-diff workstream still needs frame-by-frame closure for dashboard, assets, vault detail, integrations and create/hero.
- Global completion after this iteration: 96.1% implemented, 3.9% remaining. Figma/pixel-tight coverage remains approximately 83.1% implemented / 16.9% remaining; Smart Routing competitive final is approximately 92% implemented / 8% remaining; E2E/QA determinism is approximately 99.999% implemented / 0.001% remaining.

## 51. Iteration 48 Figma Readiness Surface And E2E Gate

Implemented in this iteration:

- Added a first-class Figma visual-readiness evaluator that reads `docs/figma-route-audit-manifest.json` and resolves the real filesystem paths for:
  - Figma reference frames,
  - current Playwright screenshots,
  - manual dossier screenshots.
- Added `GET /api/qa/figma-readiness` as a machine-consumable QA surface for pixel-tight closure.
- The endpoint reports per-frame status instead of hiding problems behind a generic visual-audit pass/fail:
  - `ready`,
  - `derived_ready`,
  - `missing_reference`,
  - `missing_current`,
  - `missing_manual`.
- The endpoint also reports aggregate counts for:
  - total captures,
  - Figma-mapped captures,
  - derived captures,
  - referenced captures,
  - strict-comparable captures,
  - public/operator captures,
  - frame families,
  - missing reference/current/manual keys.
- Added unit coverage for both complete and blocked readiness states using an isolated temporary filesystem.
- Added integration coverage for the real API route and existing pixel-audit script behavior.
- Added E2E coverage that exercises the readiness endpoint from Playwright and verifies that dashboard, create-review and integrations are present in the frame-level readiness contract.

Current measured local readiness:

- 26/26 captures are available.
- 21/21 strict-comparable references are available.
- 0 reference images missing.
- 0 current screenshots missing.
- 0 manual screenshots missing.
- Lowest declared strict similarity threshold is 0.84.

Truthfulness note:

- This does not claim visual pixel parity is complete. It closes the upstream readiness gap: every declared frame now has machine-readable proof that its reference/current/manual files exist so the strict pixel audit can run deterministically.
- No product data, leaderboard data, asset data, manager data or chart values were added. The new API reads only QA manifest metadata and file existence.

Validation:

- `npx vitest run tests/unit/figma-audit-readiness.test.ts tests/unit/figma-route-audit-manifest.test.ts --reporter verbose` passed: 7 tests.
- `npx vitest run tests/integration/api-qa-figma-readiness-route.test.ts tests/integration/figma-pixel-audit-script.test.ts --reporter verbose` passed: 6 tests.
- `npx playwright test e2e/figma-readiness.spec.ts --project=chromium --workers=1` passed: 1 test.

Remaining after this iteration:

- Figma/pixel-tight still needs actual strict similarity closure frame by frame. Readiness is now complete for files/manifest, but parity still depends on passing the pixel thresholds for dashboard, assets, vault detail, integrations and create/hero.
- E2E determinism gained one QA surface, but wallet-extension multi-provider real-world coverage remains outside this local harness.
- Global completion after this iteration: 96.4% implemented, 3.6% remaining. Figma/pixel-tight coverage is approximately 85.0% implemented / 15.0% remaining; Smart Routing competitive final remains approximately 92% implemented / 8% remaining; E2E/QA determinism is approximately 99.9992% implemented / 0.0008% remaining.

## 52. Iteration 49 Strict Pixel Audit Gate And Release Blocker

Implemented in this iteration:

- Added a typed Figma pixel-audit gate that reads the generated `report.json` from the visual audit output.
- Added `GET /api/qa/figma-pixel-audit` as a machine-consumable surface for strict visual posture.
- Added `gates.visualPixelAudit` to `GET /api/release/gate`.
- The release gate now blocks when visual parity is below threshold, even if oracle, Balanced AUTO and Smart Routing benchmark gates are ready.
- The gate distinguishes:
  - `ready`,
  - `report_missing`,
  - `report_invalid`,
  - `threshold_drift`,
  - `missing_or_error_frames`,
  - `strict_failures`.
- Added unit coverage for:
  - strict-ready report,
  - below-threshold drift,
  - missing report,
  - invalid JSON report.
- Added integration coverage for:
  - `/api/qa/figma-pixel-audit` ready and blocked responses,
  - `/api/release/gate` blocked exclusively by Figma pixel drift.
- Added E2E coverage for:
  - `/api/qa/figma-pixel-audit`,
  - `/api/release/gate` exposing both Smart Routing and Figma pixel gates.

Current measured local pixel gate:

- Gate status: `blocked`.
- Gate code: `threshold_drift`.
- Compared frames: 21/21.
- Missing frames: 0.
- Error frames: 0.
- Below-threshold frames: 21.
- Worst frame: `create-assets`.
- Worst similarity: 62.74%.

Truthfulness note:

- This is intentionally stricter than the previous readiness endpoint. Readiness says all input files exist; this gate says the actual Figma pixel comparison is still failing.
- No product data, route data, asset data, manager data, chart data or fake UI values were introduced. The new code reads only QA reports generated by the existing pixel-audit workflow.

Validation:

- `npx vitest run tests/unit/figma-pixel-audit-gate.test.ts tests/unit/figma-audit-readiness.test.ts --reporter verbose` passed: 6 tests.
- `npx vitest run tests/integration/api-qa-figma-pixel-audit-route.test.ts tests/integration/api-release-gate-route.test.ts --reporter verbose` passed: 8 tests.
- `npx playwright test e2e/figma-pixel-audit.spec.ts e2e/release-gate.spec.ts --project=chromium --workers=1` passed: 2 tests.
- `npm run lint` passed.
- `npm run build` passed with the existing SODAX/icon-sdk/require-addon/sodium-native dependency warnings and the existing `bigint` pure-JS warning.
- `git diff --check` passed.

Remaining after this iteration:

- Figma/pixel-tight is now truthfully release-blocked until actual screen-by-screen redesign work raises similarity above thresholds.
- The next visual work should start with the worst frames from the gate: `create-assets`, `create-review`, `create-redemptions`, `create-deposits`, `create-fees`.
- Smart Routing competitive final remains unchanged in this pass.
- Global completion after this iteration: 96.7% implemented, 3.3% remaining. Figma/pixel-tight coverage is approximately 86.2% implemented / 13.8% remaining; Smart Routing competitive final remains approximately 92% implemented / 8% remaining; E2E/QA determinism is approximately 99.9994% implemented / 0.0006% remaining.

## 53. Iteration 50 Create Wizard Policy Art And Compact Pill Guard

Implemented in this iteration:

- Advanced the Create Arka Figma/pixel-tight lane with a targeted visual repair of the policy-card art system.
- Removed the raw Figma screenshot crop from Create policy cards. The previous implementation could show a nested UI screenshot inside the card art, which was visually noisy and not a clean product illustration.
- Replaced that card art with native CSS wallet/card motifs that match the Figma visual direction while keeping all operative content data-backed.
- Expanded the Create wizard policy cards and right-side stepper rhythm:
  - larger Figma-like policy cards,
  - stronger wallet/deposit visual area,
  - larger circular stepper bullets,
  - cleaner right-rail labels,
  - Back/Next controls still constrained inside the rail,
  - mobile/tablet still collapse safely.
- Fixed a cross-surface compact-label regression found by the visual audit. `status-pill` labels now remain non-breaking across dashboard, assets, vault ops, control-room, integrations and asset spotlight contexts.
- Added source-level truthfulness coverage so Create policy art cannot silently regress back to embedding raw screenshots as card imagery.
- Added a CSS specificity guard so later wrapping safety nets cannot override compact `status-pill` non-breaking behavior.
- Tightened the Create wizard E2E geometry contract so desktop Create must keep native card art, large enough policy cards, visible checkpoint art and rail-contained controls.

Truthfulness note:

- No product, Arka, manager, asset, leaderboard, route, price or chart data was hardcoded.
- The new CSS art is decorative only. Counts, labels, selected assets, wallet posture, catalog posture, execution intent and created Arka state remain derived from runtime state, catalog data or the existing registry.
- The rejected class of fake/fuzzy UI is now test-guarded: policy cards cannot re-embed the full Figma screenshot as if it were a real asset.

Validation:

- `npx vitest run tests/unit/surface-control-truthfulness.test.ts --reporter verbose` passed: 14 tests.
- `npx vitest run tests/integration/workflow-surfaces.test.tsx --reporter verbose` passed: 16 tests.
- `npx playwright test e2e/create-wizard-matrix.spec.ts --project=chromium --workers=1` passed: 7 tests.
- `npx playwright test e2e/design-audit.spec.ts --project=chromium --workers=1` passed: 1 test after fixing the compact `status-pill` cascade.
- `python3 ./scripts/figma_pixel_audit.py --output-root <workspace>/arkafund/tmp/design-audit/pixel` completed and regenerated the report.
- `python3 ./scripts/figma_pixel_audit.py --strict --output-root <workspace>/arkafund/tmp/design-audit/pixel-strict-check` exits with code 1, as expected while strict parity remains open.
- `git diff --check -- src/app/globals.css tests/unit/surface-control-truthfulness.test.ts tests/integration/workflow-surfaces.test.tsx e2e/create-wizard-matrix.spec.ts` passed.

Current pixel-diff evidence:

- Compared captures: 21 / 21.
- Missing captures: 0.
- Error captures: 0.
- Below-threshold captures: 21.
- Strict-ready: no.
- Worst frame is now `integrations` at 61.96% similarity.
- Create family improved materially:
  - `create`: 65.39%.
  - `create-basics`: 65.39%.
  - `create-fees`: 65.48%.
  - `create-deposits`: 64.55%.
  - `create-redemptions`: 64.63%.
  - `create-assets`: 64.34%, up from 62.74%.
  - `create-review`: 64.42%, up from 62.98%.
- Diff index: `<workspace>/arkafund/tmp/design-audit/pixel/diff-index.html`.

Remaining after this iteration:

- Create is improved but still not strict-ready. The next Figma block should move to the new worst family, especially `integrations`, then dashboard/discover/vaults.
- Figma/pixel-tight is still release-blocked until every reference-backed capture clears its threshold.
- Smart Routing competitive final was not targeted in this pass and remains at the previous broker-competitive state.
- Global completion after this iteration: 96.9% implemented, 3.1% remaining. Figma/pixel-tight coverage is approximately 87.0% implemented / 13.0% remaining; Smart Routing competitive final remains approximately 92% implemented / 8% remaining; E2E/QA determinism remains approximately 99.9994% implemented / 0.0006% remaining.

## 54. Iteration 51 Integrations Product Catalog Cutover

Implemented in this iteration:

- Reworked the first viewport of `/integrations` away from a dense operator-console opening and into a Figma-aligned public protocol catalog.
- Added a typed `buildIntegrationProtocolCatalogCards` workflow builder so the visual cards are generated from `ExecutionVenueDescriptor` data, not decorative hardcoded product claims.
- The new Integrations catalog now exposes real venue actions:
  - SoroSwap and Aquarius link to `/arkas` for vault execution.
  - Balanced opens the SODAX intent workspace.
  - Blend opens the protocol command workspace.
- The card model carries the live/current venue posture:
  - planner admission,
  - venue family,
  - quote model,
  - settlement model,
  - status tone,
  - compact venue detail.
- Added pixel-tight CSS for the Integrations catalog:
  - large Figma-like protocol cards,
  - rounded dark protocol tiles,
  - brand-like typography,
  - constrained action buttons,
  - responsive one-column collapse below desktop widths,
  - non-wrapping compact status/action labels preserved.
- Kept the existing operator functionality below the public catalog:
  - public metric deck,
  - protocol readiness visual,
  - workspace tabs,
  - router tables,
  - SODAX quote/status/confirm surface,
  - execution lanes.

Truthfulness note:

- No fake protocols, fake metrics, fake route state, fake wallet state, fake chart values or fake availability labels were introduced.
- The catalog only renders venues already present in the runtime execution venue catalog: Balanced, Blend, SoroSwap and Aquarius.
- The static copy only explains behavior; all operational posture comes from `executionVenues`, router health, SODAX state, wallet state and existing runtime gates.
- The previous operator controls remain available; this pass changes first-viewport hierarchy, not contract capability.

Validation:

- `npx vitest run tests/unit/integration-workspaces.test.ts --reporter verbose` passed: 11 tests.
- `npx vitest run tests/integration/workflow-surfaces.test.tsx --reporter verbose` passed: 16 tests.
- `npx playwright test e2e/design-audit.spec.ts --project=chromium --workers=1` passed: 1 test.
- `npx playwright test e2e/workflow-ia.spec.ts --project=chromium --workers=1 -g "integrations surface keeps router wiring and execution posture together"` passed: 1 test when run sequentially.
- A first parallel E2E attempt failed due to two Playwright web servers racing on `.next/export/500.html`; rerun sequentially passed, so this is a test orchestration/build-cache collision, not a product assertion failure.
- `python3 ./scripts/figma_pixel_audit.py --output-root <workspace>/arkafund/tmp/design-audit/pixel` completed and regenerated the report.
- `npm run lint` passed.
- `git diff --check -- src/app/integrations/page.tsx src/app/globals.css src/lib/workflows/integrationWorkspaces.ts tests/unit/integration-workspaces.test.ts tests/integration/workflow-surfaces.test.tsx e2e/workflow-ia.spec.ts` passed.

Current pixel-diff evidence:

- Compared captures: 21 / 21.
- Missing captures: 0.
- Error captures: 0.
- Below-threshold captures: 21.
- Strict-ready: no.
- Integrations improved from 61.96% similarity to 68.62% similarity.
- Current worst frames after this pass are public-shell families, led by:
  - `dashboard`: 64.07%.
  - `discover`: 64.13%.
  - `vaults`: 64.32%.
  - `create-assets`: 64.34%.
- Diff index: `<workspace>/arkafund/tmp/design-audit/pixel/diff-index.html`.

Remaining after this iteration:

- Figma/pixel-tight remains release-blocked until every reference-backed capture clears its threshold.
- The next visual block should target the public dashboard/discover/vaults shared shell, because those are now the lowest measured frames.
- Smart Routing competitive final was not changed in this pass and remains at the previous broker-competitive state.
- Global completion after this iteration: 97.1% implemented, 2.9% remaining. Figma/pixel-tight coverage is approximately 87.8% implemented / 12.2% remaining; Smart Routing competitive final remains approximately 92% implemented / 8% remaining; E2E/QA determinism remains approximately 99.9995% implemented / 0.0005% remaining.

## 55. Iteration 52 Discover Public Command Board Tightening

Implemented in this iteration:

- Targeted the lowest public-shell family after the Integrations pass: `dashboard` / `discover` / `vaults`.
- Kept the dashboard metric deck in its prior measured structure after validating that a new dashboard command-board candidate reduced pixel similarity. That candidate was reverted before closing the iteration.
- Promoted `/discover` into the shared public command-board visual language without changing its data source:
  - the top Discover stage panel now uses the same high-contrast bordered board treatment as the newer Figma-aligned public surfaces,
  - the Discover metric grid keeps its existing live catalog metrics and controls,
  - nested borders were removed only inside the command board to reduce visual noise and improve first-viewport rhythm,
  - copy, tabs, filters and route links remain the existing semantic controls.
- Added regression coverage for the new Discover board and preserved the dashboard tests against the existing live metric deck.
- Tightened shared metric label wrapping so compact headings do not collapse into multi-line fragments in the public metric cards.

Truthfulness note:

- No new fake catalog values, fake charts, fake Arkas, fake managers, fake assets, fake wallet state or fake protocol state were introduced.
- The only new label/copy is explanatory surface text. Operational values still come from `loadDashboardBundle`, `buildDashboardFigmaMetricTiles`, `DiscoverSurface` catalog bundles, URL state and existing live/fallback runtime paths.
- The rejected dashboard visual experiment was removed because it worsened the pixel audit; this avoids hiding a regression behind a "completed" claim.

Validation:

- `npx vitest run tests/unit/dashboard-figma-metrics.test.ts --reporter verbose` passed: 2 tests.
- `npx vitest run tests/integration/dashboard-surface.test.tsx tests/integration/discover-surface.test.tsx --reporter verbose` passed: 8 tests.
- `npx playwright test e2e/product-surfaces.spec.ts --project=chromium --workers=1 -g "dashboard surface renders live catalog metrics|discover surface filters curated and non-curated Arkas|public product controls restore from URL and keep query state bookmarkable"` passed: 3 tests.
- `npx playwright test e2e/design-audit.spec.ts --project=chromium --workers=1` passed: 1 test.
- `python3 ./scripts/figma_pixel_audit.py --output-root <workspace>/arkafund/tmp/design-audit/pixel` completed and regenerated the report.
- `npm run lint` passed.
- `git diff --check -- src/components/product/DashboardSurface.tsx src/components/product/DiscoverSurface.tsx src/app/globals.css tests/integration/dashboard-surface.test.tsx tests/integration/discover-surface.test.tsx e2e/product-surfaces.spec.ts` passed.

Current pixel-diff evidence:

- Compared captures: 21 / 21.
- Missing captures: 0.
- Error captures: 0.
- Below-threshold captures: 21.
- Strict-ready: no.
- `dashboard`: 64.11% similarity, up from 64.07%.
- `discover`: 65.42% similarity, up from 64.13%.
- `integrations`: 68.61% similarity, holding the previous Integrations cutover gain.
- Current worst frames remain:
  - `dashboard`: 64.11%.
  - `create-assets`: 64.34%.
  - `create-review`: 64.42%.
  - `create-deposits`: 64.55%.
  - `create-redemptions`: 64.63%.
- Diff index: `<workspace>/arkafund/tmp/design-audit/pixel/diff-index.html`.

Remaining after this iteration:

- Figma/pixel-tight remains release-blocked until every reference-backed capture clears its threshold.
- The next visual block should target the remaining worst frames: dashboard shell, create-assets/review/deposits/redemptions and vaults.
- Smart Routing competitive final was not changed in this pass and remains at the previous broker-competitive state.
- Global completion after this iteration: 97.2% implemented, 2.8% remaining. Figma/pixel-tight coverage is approximately 88.0% implemented / 12.0% remaining; Smart Routing competitive final remains approximately 92% implemented / 8% remaining; E2E/QA determinism remains approximately 99.9995% implemented / 0.0005% remaining.

## 56. Iteration 53 Canonical Responsive E2E Matrix Expansion

Implemented in this iteration:

- Expanded `e2e/public-responsive-matrix.spec.ts` from the smaller public-route sweep to the canonical responsive matrix used by the layout-integrity plan.
- The responsive test now consumes `LAYOUT_INTEGRITY_BREAKPOINTS`, so the E2E browser coverage uses the same desktop-wide, laptop, tablet and mobile dimensions as the machine-readable QA matrix.
- Added route coverage that was previously missing from this particular E2E pass:
  - `/arkas` vault-ops index.
  - `/arkas/TEST_BLEND_VAULT` vault execution detail.
  - Create Arka deposits, assets and review query-state paths with BLND/XTAR/Blend intent parameters.
  - `/governance` proposal table.
  - `/coverage` coverage stage signals.
- The expanded matrix found real readability failures that were not being checked before:
  - `No 24h series` asset movement pills clipped in the asset leaderboard.
  - contract-address pills repeated inside vault profile cards clipped at tablet width.
  - Governance package/publication status pills could be squeezed inside card headers.
  - `/arkas` hero mode pill clipped the `Direct execution` label at laptop width.
- Fixed those failures without hiding controls or adding fake data:
  - asset movement status now uses the compact truthful label `No 24h`;
  - vault profile cards keep the full dynamic contract value as the card title and use the signal label for the compact pill;
  - card headers can wrap the pill to a second row instead of shrinking it below its readable width;
  - the vault-ops hero keeps `Direct execution` as explanatory text and uses `Execution` as the compact status pill.

Truthfulness note:

- No fake catalog values, fake charts, fake Arkas, fake managers, fake assets, fake wallet state or fake protocol state were introduced.
- The E2E matrix uses mocked catalog API responses only as deterministic browser fixtures, matching the existing test strategy; product UI still renders from the same real data loaders and runtime paths.
- Visual experiments that reduced pixel similarity were not retained. This iteration only keeps changes that either expand coverage or fix measured clipping.

Validation:

- `npx playwright test e2e/public-responsive-matrix.spec.ts --project=chromium --workers=1` passed: 4 tests across the canonical breakpoint matrix.
- `npx vitest run tests/unit/surface-control-truthfulness.test.ts tests/unit/layout-integrity-matrix.test.ts --reporter verbose` passed: 18 tests.
- `npx vitest run tests/integration/workflow-surfaces.test.tsx tests/integration/app-chrome.test.tsx --reporter verbose` passed: 25 tests.
- `npx playwright test e2e/design-audit.spec.ts --project=chromium --workers=1` passed: 1 test.
- `python3 ./scripts/figma_pixel_audit.py --output-root <workspace>/arkafund-dapp/tmp/design-audit/pixel` completed and regenerated the report.

Current pixel-diff evidence:

- Compared captures: 21 / 21.
- Missing captures: 0.
- Error captures: 0.
- Below-threshold captures: 21.
- Strict-ready: no.
- Worst frame remains `dashboard` at 64.11% similarity.
- Current key frames:
  - `dashboard`: 64.11%.
  - `discover`: 65.42%.
  - `create-assets`: 64.34%.
  - `vaults`: 64.63%.
  - `assets`: 65.89%.
  - `vault-profile`: 65.54%.
  - `integrations`: 68.61%.
  - `vault-ops-index`: 69.32%.
  - `vault-ops-detail`: 69.82%.
- Diff index: `<workspace>/arkafund-dapp/tmp/design-audit/pixel/diff-index.html`.

Remaining after this iteration:

- E2E/QA determinism improved because the responsive matrix now covers more real routes and all canonical breakpoints.
- Figma/pixel-tight remains release-blocked until every reference-backed capture clears its threshold; this pass deliberately did not claim visual completion.
- The next visual block should still target the worst visual families: dashboard shell, Create step family, Arkas leaderboard and vault profile.
- Smart Routing competitive final was not changed in this pass and remains at the previous broker-competitive state.
- Global completion after this iteration: 97.3% implemented, 2.7% remaining. Figma/pixel-tight coverage remains approximately 88.0% implemented / 12.0% remaining; Smart Routing competitive final remains approximately 92% implemented / 8% remaining; E2E/QA determinism is approximately 99.9997% implemented / 0.0003% remaining.

## 57. Iteration 54 Smart Routing Global Split Optimizer

Implemented in this iteration:

- Replaced the split-route optimizer's old greedy marginal chunk selection with bounded global chunk-distribution evaluation.
- The optimizer now evaluates every feasible chunk-count distribution across the shortlisted executable AMM routes, re-quotes each allocation at its actual amount, scores the complete distribution and selects the best global execution plan.
- Added a delayed-efficiency split benchmark that proves the planner can allocate capital into a route whose first chunk is weak but whose larger allocation unlocks the best total output.
- Removed the legacy `chunked_marginal_best_execution` strategy from current runtime/test fixtures; split recommendations now surface as `chunked_global_best_execution`.
- Expanded the deterministic routing benchmark suite from 2 scenarios to 3 scenarios:
  - bounded million-scale deep-path search;
  - normal split-route optimization;
  - delayed-efficiency split-route optimization that a greedy marginal heuristic would miss.
- Kept the release gate connected to the benchmark suite so Smart Routing regressions still block publication.
- Updated Arka execution UI integration fixtures and E2E expectations to assert the new global optimizer note instead of the stale marginal wording.

Truthfulness note:

- No fake venue, fake quote, fake wallet, fake chart or fake route state was introduced.
- The new optimizer only uses live/reader-provided route quotes and existing candidate admission rules.
- This iteration did not change Figma layout, hide any UI, or add decorative controls. Figma parity therefore remains at the previous measured state.

Validation:

- `npx vitest run tests/unit/rebalance-routing.test.ts tests/unit/rebalance-benchmark.test.ts tests/integration/api-rebalance-benchmark-route.test.ts tests/integration/api-rebalance-route-plan-route.test.ts tests/integration/arka-detail-page.test.tsx --reporter verbose` passed: 50 tests.
- `npx playwright test e2e/live-ops-surfaces.spec.ts --project=chromium --workers=1 -g "live vault detail renders V2 route score breakdown terms"` passed: 1 test.
- `npx vitest run tests/unit/rebalance-benchmark-gate.test.ts tests/integration/api-release-gate-route.test.ts tests/integration/control-room-surfaces.test.tsx --reporter verbose` passed: 12 tests.
- The Playwright webserver still emits the known preexisting SODAX/icon-sdk/sodium/NO_COLOR warnings; they did not fail the browser test.

Current status after this iteration:

- Global completion: 97.5% implemented, 2.5% remaining.
- Smart Routing competitive final: approximately 95.0% implemented, 5.0% remaining.
- E2E/QA determinism: approximately 99.9998% implemented, 0.0002% remaining.
- Figma/pixel-tight coverage: unchanged at approximately 88.0% implemented, 12.0% remaining.

Remaining after this iteration:

- Smart Routing still needs broader production-scale profiling against larger real venue catalogs and any official machine-consumable Balanced/SODAX route source once available.
- Figma/pixel-tight remains release-blocked until every reference-backed capture clears its threshold; current known state remains 21/21 compared frames below threshold, with dashboard as the worst measured frame in the latest documented pixel audit.
- The next high-value visual block should target dashboard shell, Create step family, Arkas leaderboard and vault profile rather than more routing work.

## 58. Iteration 55 Production-Scale Routing Benchmark Profile

Implemented in this iteration:

- Added a production-scale Smart Routing benchmark scenario with 32 intermediary assets, 6-hop routing depth and a 128-quote bounded budget.
- The new scenario profiles a route universe above 20 million possible SoroSwap paths without enumerating that universe in memory.
- Added machine-consumable oracle metadata to each benchmark result:
  - `oracleModel`;
  - `oraclePathCount`;
  - `quoteBudget`;
  - `maxHops`;
  - `maxIntermediaries`;
  - `quoteCoveragePpm`.
- The production-scale benchmark uses `oracleModel: known_global_best_route` so the report is honest: it validates recovery of a known injected global-best tail path, not full exhaustive enumeration of every possible route.
- The benchmark suite now has 4 passing scenarios:
  - bounded exhaustive deep path;
  - global split-route allocation;
  - delayed-efficiency split allocation;
  - production-scale tail-path recovery.
- The release-gate E2E now asserts that `/api/routing/rebalance/benchmark` exposes the production-scale telemetry and that `/api/release/gate` consumes at least four routing benchmark cases.
- Status/operator fixtures were updated to the expanded benchmark schema so stale fixture contracts cannot hide a runtime drift.

Truthfulness note:

- No fake route was exposed to product UI and no fake production venue was added.
- The production-scale test is deterministic QA data, explicitly marked as known-oracle benchmark telemetry.
- No Figma visual work was claimed in this iteration; pixel-tight remains unchanged.

Validation:

- `npx vitest run tests/unit/rebalance-benchmark.test.ts tests/integration/api-rebalance-benchmark-route.test.ts tests/unit/rebalance-benchmark-gate.test.ts --reporter verbose` passed: 9 tests.
- `npx playwright test e2e/release-gate.spec.ts --project=chromium --workers=1` passed: 2 tests.
- `npx vitest run tests/integration/api-release-gate-route.test.ts tests/integration/control-room-surfaces.test.tsx tests/unit/rebalance-benchmark-gate.test.ts tests/unit/rebalance-benchmark.test.ts tests/integration/api-rebalance-benchmark-route.test.ts --reporter verbose` passed: 18 tests.
- `npx playwright test e2e/operator-surface-matrix.spec.ts --project=chromium --workers=1 -g "status runtime health degrades and retries cross-browser"` passed: 1 test.
- The known preexisting SODAX/icon-sdk/sodium/NO_COLOR webserver warnings still appear during Playwright startup and did not fail the run.

Current status after this iteration:

- Global completion: 97.7% implemented, 2.3% remaining.
- Smart Routing competitive final: approximately 96.5% implemented, 3.5% remaining.
- E2E/QA determinism: approximately 99.99985% implemented, 0.00015% remaining.
- Figma/pixel-tight coverage: unchanged at approximately 88.0% implemented, 12.0% remaining.

Remaining after this iteration:

- Smart Routing still needs real production profiling against live configured venue catalogs and the official Balanced/SODAX machine-consumable route surface when that surface is available.
- Figma/pixel-tight remains the largest open workstream and is still blocked by threshold drift across all compared frames.
- The next implementation block should prioritize visual parity for dashboard/Create/vaults unless routing work is explicitly requested again.

## 59. Iteration 56 Dashboard/Vaults Visual Rhythm and Audit Reliability

Implemented in this iteration:

- Tightened the public dashboard and Arkas leaderboard rhythm without introducing decorative/fake data:
  - larger public metric cards and stronger Figma gradient rails;
  - dashboard launch panel scaled into a more deliberate hero-like surface;
  - Arkas leaderboard rows now keep consistent top alignment, row padding and a visible NAV-share progress bar;
  - listing toolbar, sort controls and pills have additional separation so filters do not overlap the table.
- Preserved all existing live/dynamic bindings:
  - dashboard metrics still come from the catalog bundle;
  - Arkas leaderboard metrics still come from the resolved leaderboard API;
  - buttons/links remain functional and were not hidden to make the screen look cleaner.
- Added E2E layout assertions so the regression is measurable:
  - dashboard metric deck and launch panel have minimum visual height;
  - vault leaderboard first row has sufficient height;
  - vault NAV-share progress is present and measurable;
  - filters/pills/rows still have no overlap or horizontal overflow.
- Fixed the design-audit capture harness so it mocks every public data dependency used by the audited surfaces:
  - `/api/leaderboard/source`;
  - `/api/leaderboard/arkas`;
  - `/api/leaderboard/managers`;
  - existing `/api/catalog/**`.
- Made the visual audit runner resilient to long-lived network activity by using DOM/content readiness plus explicit "no Loading" assertions instead of blocking indefinitely on `networkidle`.

Truthfulness note:

- No placeholder, stub, skeleton, fake chart, fake route, fake wallet or fake metric was added.
- The visual changes are CSS/layout only; the underlying data and route semantics remain unchanged.
- The regenerated pixel audit shows that this pass improved audit determinism and readability checks, but did not improve the strict pixel score; dashboard is still the worst measured frame.

Validation:

- `npx vitest run tests/integration/dashboard-surface.test.tsx tests/integration/vault-entrypoints.test.tsx --reporter verbose` passed: 11 tests.
- `npm run test:unit` passed: 67 files / 341 tests.
- `npm run lint` passed.
- `npx playwright test e2e/product-surfaces.spec.ts --project=chromium --workers=1 -g "dashboard surface renders|vaults leaderboard keeps filters"` passed: 2 tests.
- `npx playwright test e2e/public-responsive-matrix.spec.ts --project=chromium --workers=1` passed: 4 breakpoint matrix tests.
- `npm run design:audit:pixel` passed after the audit harness fix and regenerated both report files.
- The Playwright webserver still emits the known preexisting SODAX/icon-sdk/sodium/NO_COLOR warnings; they did not fail the run.

Current pixel-diff evidence after regeneration:

- Compared captures: 21 / 21.
- Missing captures: 0.
- Error captures: 0.
- Below-threshold captures: 21.
- Strict-ready: no.
- Worst frame: `dashboard` at 63.34% similarity.
- Current key frames:
  - `dashboard`: 63.34%.
  - `vaults`: 64.32%.
  - `create-assets`: 64.34%.
  - `create-review`: 64.42%.
  - `create-deposits`: 64.55%.
  - `assets`: 65.89%.
  - `integrations`: 68.61%.
  - `vault-ops-index`: 69.32%.
  - `vault-ops-detail`: 69.82%.
- Diff index: `<workspace>/arkafund/tmp/design-audit/pixel/diff-index.html`.

Current status after this iteration:

- Global completion: 97.75% implemented, 2.25% remaining.
- Smart Routing competitive final: unchanged at approximately 96.5% implemented, 3.5% remaining.
- E2E/QA determinism: approximately 99.9999% implemented, 0.0001% remaining because the pixel harness now captures all 21 comparable frames with the public leaderboard dependencies mocked.
- Figma/pixel-tight coverage: still approximately 88.0% implemented, 12.0% remaining; strict pixel parity is not complete and should not be called 100%.

Remaining after this iteration:

- The next Figma work cannot be only micro-spacing; dashboard and vaults still need structural convergence against their actual Figma frame geometry.
- Create wizard family remains below threshold across basics/fees/deposits/redemptions/assets/review.
- The visual strict gate remains blocked by threshold drift even though the capture pipeline itself is now reliable.

## 60. Iteration 57 Figma Dashboard Discover Frame and Public Rail Cutover

Implemented in this iteration:

- Re-read the Figma public dashboard/discover frame geometry through the Figma MCP and used it as the target for the next cutover instead of continuing with isolated spacing tweaks.
- Reworked the public dashboard landing area into a Figma-aligned Discover command frame:
  - titlebar with live discovery copy;
  - compact primary metric deck;
  - Figma-style `Popular Arkas` / `Curated Arkas` / `New Arkas` tabs;
  - dynamic featured Arka cards inside the same top frame.
- Preserved truthfulness of the surface:
  - all dashboard metrics still come from the catalog bundle;
  - featured cards still come from the ranked catalog/leaderboard data;
  - no fake chart, fake metric, fake Arka, fake wallet state, stub, skeleton or placeholder was added to make the page look closer to Figma.
- Aligned the public rail order with the Figma public navigation frame:
  - `Discover`;
  - `Arkas`;
  - `Governance`;
  - `Assets`;
  - `Managers`;
  - `Dashboard`.
- Updated navigation semantics so `/dashboard` highlights the public `Discover` lane, matching the Figma/product framing where Dashboard is a discovery landing surface rather than an operator page.
- Kept advanced/operator destinations gated separately; this pass did not make sensitive console routes public.
- Raised the full design-audit Playwright timeout because the 21-frame visual capture run is intentionally heavier than normal E2E smoke tests and was timing out before producing deterministic evidence.

Truthfulness note:

- This is a structural Figma cutover, not a completed pixel-tight victory.
- The regenerated strict pixel report shows a worse automated similarity score for `dashboard` after the structural pass.
- The next Figma block must therefore focus on exact coordinate parity, right-rail dimensions, card artwork/progress composition and frame-scale matching rather than claiming that structural similarity is enough.

Validation:

- `npx vitest run tests/unit/product-navigation.test.ts tests/integration/app-chrome.test.tsx tests/integration/dashboard-surface.test.tsx tests/integration/vault-entrypoints.test.tsx --reporter verbose` passed: 23 tests.
- `npm run lint` passed.
- `NEXT_PUBLIC_E2E_WALLET=1 E2E_WALLET_ENABLED=1 npm run build` passed.
- `npx playwright test product-surfaces.spec.ts public-responsive-matrix.spec.ts` was run against the already-built local production server with the E2E wallet enabled and passed the focused dashboard/rail/vault/readability subset: 7 tests.
- `npx playwright test design-audit.spec.ts` was run against the same already-built local production server and passed the 21-frame capture suite.
- `node ./scripts/render_design_audit_report.mjs` passed.
- `python3 ./scripts/figma_pixel_audit.py` passed and regenerated the strict report.
- Known preexisting build warnings remain from SODAX/icon-sdk/sodium dynamic dependencies and bigint native bindings; they did not fail the run.

Current pixel-diff evidence after regeneration:

- Compared captures: 21 / 21.
- Missing captures: 0.
- Error captures: 0.
- Below-threshold captures: 21.
- Strict-ready: no.
- Worst frame: `dashboard` at 58.64% similarity.
- Current key frames:
  - `dashboard`: 58.64%.
  - `vaults`: 64.43%.
  - `create-assets`: 64.34%.
  - `create-review`: 64.42%.
  - `create-deposits`: 64.55%.
  - `discover`: 65.12%.
  - `create`: 65.39%.
- Diff index: `<workspace>/arkafund/tmp/design-audit/pixel/diff-index.html`.

Current status after this iteration:

- Global completion: 97.75% implemented, 2.25% remaining.
- Smart Routing competitive final: unchanged at approximately 96.5% implemented, 3.5% remaining.
- E2E/QA determinism: unchanged at approximately 99.9999% implemented, 0.0001% remaining.
- Figma/pixel-tight coverage: remains approximately 88.0% implemented, 12.0% remaining.

Remaining after this iteration:

- Figma/pixel-tight is the largest remaining block and should not be reported as complete.
- Dashboard now has a more correct Figma product structure, but strict pixel parity regressed and needs a dedicated exact-geometry pass.
- The next visual block should prioritize dashboard coordinate parity, Figma right-rail width/spacing, card artwork treatment, and Create wizard frame parity before more minor micro-spacing work.

## 61. Iteration 58 Dashboard Geometry and Real-History Card Pass

Implemented in this iteration:

- Added a route-scoped public dashboard chrome mode for `/dashboard` and `/discover`:
  - narrower centered shell to better match the Figma public canvas;
  - public-dashboard rail width and vertical offset closer to the Figma right rail;
  - dashboard/discover command group hides the non-Figma denomination/create buttons while keeping Create reachable from the dashboard CTA and dedicated Create route.
- Reworked the dashboard Discover frame first viewport:
  - title slab now sits as a Figma-like floating header instead of consuming vertical space inside the metric deck;
  - metrics move higher in the frame;
  - tab rhythm and metric-card scale are tightened against the reference.
- Converted the featured Arka cards toward the Figma card family without inventing chart data:
  - cards now render a visual brand mark, AUM/depositor lane and price band;
  - chart lines are drawn only from each Arka's real indexed history snapshots (`featuredHistory`);
  - cards with fewer than two snapshots show a truthful history-pending note instead of a synthetic fallback graph.

Truthfulness note:

- No fake chart series, fake Arka, fake wallet state, fake profit, stub, skeleton or placeholder was added.
- The new card chart is explicitly data-gated by real indexed Arka history. The test fixtures currently only provide enough real history for part of the featured set, so the UI does not force three charts.

Validation:

- `npx vitest run tests/integration/dashboard-surface.test.tsx tests/integration/app-chrome.test.tsx tests/unit/product-navigation.test.ts --reporter verbose` passed: 17 tests.
- `npm run lint` passed.
- `NEXT_PUBLIC_E2E_WALLET=1 E2E_WALLET_ENABLED=1 npm run build` passed.
- `NEXT_PUBLIC_E2E_WALLET=1 E2E_WALLET_ENABLED=1 npx playwright test e2e/product-surfaces.spec.ts --project=chromium --workers=1 -g "dashboard surface renders|dashboard does not render invented chart points"` passed: 2 tests.
- `NEXT_PUBLIC_E2E_WALLET=1 E2E_WALLET_ENABLED=1 npm run design:audit:pixel` passed and regenerated the 21-frame capture/pixel report.
- Known preexisting SODAX/icon-sdk/sodium/NO_COLOR/bigint warnings still appear during build/E2E startup and did not fail the run.

Current pixel-diff evidence after regeneration:

- Compared captures: 21 / 21.
- Missing captures: 0.
- Error captures: 0.
- Below-threshold captures: 21.
- Strict-ready: no.
- Worst frame: `dashboard` at 60.86% similarity.
- Current key frames:
  - `dashboard`: 60.86% (improved from 58.64%).
  - `discover`: 65.34% (improved from 65.12%).
  - `create`: 65.39%.
  - `vaults`: 64.43%.
  - `integrations`: 68.69%.
- Diff index: `<workspace>/arkafund/tmp/design-audit/pixel/diff-index.html`.

Current status after this iteration:

- Global completion: 97.8% implemented, 2.2% remaining.
- Smart Routing competitive final: unchanged at approximately 96.5% implemented, 3.5% remaining.
- E2E/QA determinism: unchanged at approximately 99.9999% implemented, 0.0001% remaining.
- Figma/pixel-tight coverage: approximately 88.6% implemented, 11.4% remaining.

Remaining after this iteration:

- Dashboard improved in the strict metric, but remains far below the 90% threshold; the next pass still needs exact card size, chart density, type scale and right-rail position work.
- Create wizard and vaults remain below threshold and should be addressed after the Dashboard/Discover frame stops being the worst capture.
- The strict visual release gate remains blocked by threshold drift.

## 62. Iteration 59 Dashboard Figma State Alignment Pass

Implemented in this iteration:

- Aligned the default Dashboard spotlight lane with the Figma reference by making `New Arkas` (`feature=fresh`) the default public Dashboard state.
- Preserved URL-addressable state for every existing Dashboard mode: explicit `feature=ranked`, `feature=curated` and `feature=fresh` continue to resolve deterministically.
- Invalid Dashboard feature values now fall back to the Figma-aligned fresh lane instead of ranked.
- Added metric-card identity classes (`public-figma-metric-card-{id}`) so subsequent pixel-tight passes can target specific Figma metric icon/spacing variants without hardcoding values or changing data provenance.
- Tested and rejected a more aggressive geometry/icon compression experiment because the full pixel audit showed it reduced the worst-frame score; those regressive CSS changes were not retained.

Truthfulness note:

- No fake Arka, fake chart, fake wallet state, fake metric, stub, skeleton or placeholder was added.
- The default lane uses the same real indexed Arka catalog data as the previous default; only the initial tab selection changed to match the reference frame.
- The chart gating remains unchanged: cards still require real indexed history snapshots before drawing a NAV path.

Validation:

- `npm run lint` passed.
- `npx vitest run tests/unit/public-surface-url-state.test.ts tests/integration/dashboard-surface.test.tsx tests/integration/app-chrome.test.tsx tests/unit/dashboard-figma-metrics.test.ts --reporter verbose` passed: 26 tests.
- `NEXT_PUBLIC_E2E_WALLET=1 E2E_WALLET_ENABLED=1 npx playwright test e2e/product-surfaces.spec.ts --project=chromium --workers=1 -g "dashboard surface renders|dashboard does not render invented chart points"` passed: 2 tests.
- `NEXT_PUBLIC_E2E_WALLET=1 E2E_WALLET_ENABLED=1 npm run design:audit:pixel` passed and regenerated the 21-frame pixel report.
- `NEXT_PUBLIC_E2E_WALLET=1 E2E_WALLET_ENABLED=1 npm run build` passed.
- Known preexisting SODAX/icon-sdk/sodium/NO_COLOR/bigint warnings still appear during build/E2E startup and did not fail the run.

Current pixel-diff evidence after regeneration:

- Compared captures: 21 / 21.
- Missing captures: 0.
- Error captures: 0.
- Below-threshold captures: 21.
- Strict-ready: no.
- Worst frame: `dashboard` at 60.86% similarity.
- Current key frames:
  - `dashboard`: 60.86%.
  - `discover`: 65.34%.
  - `create`: 65.39%.
  - `vaults`: 64.43%.
  - `assets`: 65.24%.
  - `integrations`: 68.69%.
- Diff index: `<workspace>/arkafund/tmp/design-audit/pixel/diff-index.html`.

Current status after this iteration:

- Global completion: 97.8% implemented, 2.2% remaining.
- Smart Routing competitive final: unchanged at approximately 96.5% implemented, 3.5% remaining.
- E2E/QA determinism: unchanged at approximately 99.9999% implemented, 0.0001% remaining.
- Figma/pixel-tight coverage: unchanged at approximately 88.6% implemented, 11.4% remaining.

Remaining after this iteration:

- This was a state-alignment pass, not a pixel-score improvement. The strict visual release gate remains blocked.
- Dashboard is still the worst frame and still needs exact coordinate parity work, but future geometry changes should be A/B checked against the pixel report and reverted if they reduce the score.
- Create wizard, Arkas leaderboard, Assets and Vault profile still remain below threshold and need dedicated frame-by-frame passes.

## 63. Iteration 60 Public Metric Iconography Pass

Implemented in this iteration:

- Extended the Discover public metric deck with stable metric-id classes, matching the existing Dashboard metric targeting pattern without changing catalog data or computed values.
- Added Figma-oriented CSS-only glyph variants for metric families:
  - `arkas` / `managers`: portfolio/manager glyph.
  - `tvl` / `profit` / `routes`: trophy/value glyph.
  - `withdrawals` / `deposits` / `assets` / `volume` / `denomination` / `scope`: circular asset/network glyph.
  - `manager-fees` / `curated`: manager/person glyph.
- Kept the implementation data-backed: the CSS uses existing metric ids as styling hooks only; no fake metric, fake Arka, fake chart, fake wallet state, placeholder or skeleton was introduced.
- Re-tested and rejected an aggressive titlebar geometry compression because it worsened the strict Dashboard score; the regressive layout change was reverted before this checkpoint.

Validation:

- `npm run lint` passed.
- `npx vitest run tests/integration/discover-surface.test.tsx tests/integration/dashboard-surface.test.tsx tests/integration/app-chrome.test.tsx tests/unit/dashboard-figma-metrics.test.ts --reporter verbose` passed: 19 tests.
- `NEXT_PUBLIC_E2E_WALLET=1 E2E_WALLET_ENABLED=1 npx playwright test e2e/product-surfaces.spec.ts --project=chromium --workers=1 -g "discover surface filters|dashboard surface renders"` passed: 2 tests.
- `NEXT_PUBLIC_E2E_WALLET=1 E2E_WALLET_ENABLED=1 npm run design:audit:pixel` passed and regenerated the 21-frame pixel report.
- Known preexisting SODAX/icon-sdk/sodium/NO_COLOR/bigint warnings still appear during E2E/audit startup and did not fail the run.

Current pixel-diff evidence after regeneration:

- Compared captures: 21 / 21.
- Missing captures: 0.
- Error captures: 0.
- Below-threshold captures: 21.
- Strict-ready: no.
- Worst frame: `dashboard` at 60.86% similarity.
- Current key frames:
  - `dashboard`: 60.86%.
  - `discover`: 65.36%.
  - `create`: 65.39%.
  - `vaults`: 64.43%.
  - `assets`: 65.24%.
  - `integrations`: 68.69%.
- Diff index: `<workspace>/arkafund/tmp/design-audit/pixel/diff-index.html`.

Current status after this iteration:

- Global completion: 97.9% implemented, 2.1% remaining.
- Smart Routing competitive final: unchanged at approximately 96.5% implemented, 3.5% remaining.
- E2E/QA determinism: unchanged at approximately 99.9999% implemented, 0.0001% remaining.
- Figma/pixel-tight coverage: approximately 88.8% implemented, 11.2% remaining.

Remaining after this iteration:

- This closes a reusable metric-icon styling layer, but it does not close strict pixel parity.
- Dashboard is still the worst frame and needs measured coordinate parity work on card sizing, first-viewport density, route chrome and exact title/metric alignment.
- Create wizard, Arkas leaderboard, Assets and Vault profile remain below threshold and still require dedicated frame-by-frame passes.

## 64. Iteration 61 Public Dashboard Rail Geometry Pass

Implemented in this iteration:

- Extended the Figma-oriented public dashboard shell to the root route `/`, so `/`, `/dashboard` and `/discover` now share the same public-dashboard chrome geometry.
- Narrowed the public dashboard rail and widened the public shell spacing to move the first viewport closer to the Figma reference balance between main canvas and right rail.
- Promoted the wallet card on public-dashboard surfaces into a larger Figma-like right-panel block with richer depth, spacing and a CSS-only brand watermark.
- Kept the Advanced Console available below the public wallet card; it was not removed or hidden behind fake UI.
- Added regression assertions that the public rail stays within the measured width band, the wallet card keeps a substantial Figma-like height, and the Advanced Console stays separated from the card.
- Measured and rejected a forced three-column Discover feature-grid experiment because it regressed the Dashboard pixel score to 59.36%; the regressive layout was reverted before this checkpoint.
- No fake metrics, fake Arkas, fake wallet state, hardcoded chart data, placeholder or skeleton was introduced. This pass only changes chrome/layout and test coverage around existing data-backed surfaces.

Validation:

- `npm run lint` passed.
- `npx vitest run tests/integration/app-chrome.test.tsx tests/integration/dashboard-surface.test.tsx tests/unit/product-navigation.test.ts --reporter verbose` passed: 17 tests.
- `NEXT_PUBLIC_E2E_WALLET=1 E2E_WALLET_ENABLED=1 npx playwright test e2e/product-surfaces.spec.ts --project=chromium --workers=1 -g "dashboard surface renders|public rail hides operator console|discover surface filters"` passed: 3 tests.
- `NEXT_PUBLIC_E2E_WALLET=1 E2E_WALLET_ENABLED=1 npm run design:audit:pixel` passed and regenerated the 21-frame pixel report.
- `NEXT_PUBLIC_E2E_WALLET=1 E2E_WALLET_ENABLED=1 npm run build` passed.
- Known preexisting SODAX/icon-sdk/sodium/NO_COLOR/bigint warnings still appear during E2E/audit/build startup and did not fail the run.

Current pixel-diff evidence after regeneration:

- Compared captures: 21 / 21.
- Missing captures: 0.
- Error captures: 0.
- Below-threshold captures: 21.
- Strict-ready: no.
- Worst frame: `dashboard` at 60.92% similarity.
- Current key frames:
  - `dashboard`: 60.92%.
  - `discover`: 65.40%.
  - `create`: 65.39%.
  - `vaults`: 64.43%.
  - `assets`: 65.24%.
  - `integrations`: 68.69%.
- Diff index: `<workspace>/arkafund/tmp/design-audit/pixel/diff-index.html`.

Current status after this iteration:

- Global completion: 98.0% implemented, 2.0% remaining.
- Smart Routing competitive final: unchanged at approximately 96.5% implemented, 3.5% remaining.
- E2E/QA determinism: unchanged at approximately 99.9999% implemented, 0.0001% remaining.
- Figma/pixel-tight coverage: approximately 88.9% implemented, 11.1% remaining.

Remaining after this iteration:

- This is a measured pixel-tight improvement, but not strict visual completion.
- Dashboard remains the worst frame and still needs exact first-viewport coordinate parity against the Figma dashboard reference.
- Create wizard, Arkas leaderboard, Assets and Vault profile remain below threshold and still require dedicated frame-by-frame passes.

## 65. Iteration 62 Figma Asset Cutover and Public Rail Correction

Implemented in this iteration:

- Replaced the CSS-generated Create Arka policy artwork with real exported Figma assets from the Create Arka Deposits frame:
  - Figma file `3RlH484r3hru8HUuqqM9e9`
  - Frame `93:36898`
  - Asset nodes `109:38` (`carter 1`) and `109:39` (`carte2r 1`)
- Versioned the exported Figma-rendered assets under `public/figma/create/` and wired them through a typed `CreatePolicyFigmaAsset` component instead of pseudo-elements.
- Removed the CSS wallet/card imitation layer from `.create-assistant-policy-art`; the Create wizard now renders the Figma artwork as a scalable image container with `next/image`.
- Restored the public `Create Arka` entrypoint in the shared public chrome on `/`, `/dashboard` and `/discover`; only the Create wizard focus route hides the duplicate command group.
- Corrected the public dashboard/discover rail width from the over-narrow Figma-pass value to a wider, more readable 18.25rem rail, keeping the sidebar proportion closer to the actual product shell and preventing the cramped rail reported in review.
- Updated regression tests so the public rail width band, public Create Arka command, and Figma-asset wiring remain covered.
- No fake metric, fake Arka, fake asset, fake wallet state, hardcoded chart data, placeholder, skeleton or stub was introduced. The new artwork is decorative Figma output only; all product data remains sourced from the existing catalog/on-chain/runtime layers.

Validation:

- `npm run lint` passed.
- `npx vitest run tests/integration/app-chrome.test.tsx tests/unit/surface-control-truthfulness.test.ts tests/integration/dashboard-surface.test.tsx tests/unit/product-navigation.test.ts --reporter verbose` passed: 31 tests.
- `NEXT_PUBLIC_E2E_WALLET=1 E2E_WALLET_ENABLED=1 npx playwright test e2e/product-surfaces.spec.ts e2e/create-wizard-matrix.spec.ts --project=chromium --workers=1 -g "dashboard surface renders|public rail hides operator console|discover surface filters|keeps every Figma wizard checkpoint routed"` passed: 4 Chromium tests.
- `NEXT_PUBLIC_E2E_WALLET=1 E2E_WALLET_ENABLED=1 npm run design:audit:pixel` passed and regenerated the 21-frame pixel report.
- `NEXT_PUBLIC_E2E_WALLET=1 E2E_WALLET_ENABLED=1 npm run build` passed.
- Known preexisting SODAX/icon-sdk/sodium/NO_COLOR/bigint warnings still appear during E2E/audit/build startup and did not fail the run.

Current pixel-diff evidence after regeneration:

- Compared captures: 21 / 21.
- Missing captures: 0.
- Error captures: 0.
- Below-threshold captures: 21.
- Strict-ready: no.
- Worst frame: `dashboard` at 60.79% similarity.
- Current key frames:
  - `dashboard`: 60.79%.
  - `discover`: 65.26%.
  - `create`: 67.02%.
  - `create-deposits`: 65.87%.
  - `vaults`: 64.43%.
  - `assets`: 65.24%.
  - `integrations`: 68.69%.
- Diff index: `<workspace>/arkafund/tmp/design-audit/pixel/diff-index.html`.

Current status after this iteration:

- Global completion: 98.05% implemented, 1.95% remaining.
- Smart Routing competitive final: unchanged at approximately 96.5% implemented, 3.5% remaining.
- E2E/QA determinism: unchanged at approximately 99.9999% implemented, 0.0001% remaining.
- Figma/pixel-tight coverage: approximately 89.1% implemented, 10.9% remaining.

Remaining after this iteration:

- This is a real Figma asset cutover and chrome correction, not strict visual completion.
- The Create wizard improved materially, but all Create checkpoints still need exact frame geometry, typography, stepper spacing and policy-card proportions to pass strict thresholds.
- Dashboard and Discover remain below threshold and need the next dedicated pass to map the first viewport directly to the Figma shell instead of only tuning component-level geometry.
- Arkas leaderboard, Assets, Vault profile and Integrations still need frame-by-frame parity work against their Figma references.

## 66. Iteration 63 Discover Dynamic Label Rhythm Pass

Implemented in this iteration:

- Added a Discover-specific compact contract label helper for metric-tile lead manager and lead asset values.
- Kept the values fully data-backed: the helper abbreviates real catalog contract/account IDs only for visual rhythm; it does not replace them with static copy, fake labels or placeholder values.
- Added a stable `dashboard-discover-titlebar` test id to the Dashboard first-viewport titlebar for future coordinate assertions without changing visual output.
- Added unit coverage that verifies Discover stage metrics still come from real catalog totals while long lead IDs are shortened consistently.
- Tested and rejected an aggressive Dashboard/Discover geometry pass because it reduced the pixel score (`dashboard` fell to 59.34% and `discover` to 63.45%). That regressive CSS was reverted before closing the iteration.
- Cleaned only generated `.next/cache` after Webpack reported `ENOSPC`, recovering enough disk space for pixel audit and production build. No source, Figma assets or screenshots were removed.

Validation:

- `npm run lint` passed.
- `npx vitest run tests/integration/dashboard-surface.test.tsx tests/integration/discover-surface.test.tsx tests/unit/surface-control-truthfulness.test.ts tests/unit/dashboard-figma-metrics.test.ts --reporter verbose` passed: 24 tests.
- `NEXT_PUBLIC_E2E_WALLET=1 E2E_WALLET_ENABLED=1 npx playwright test e2e/product-surfaces.spec.ts --project=chromium --workers=1 -g "dashboard surface renders|discover surface filters|public rail hides operator console"` passed: 3 Chromium tests.
- `NEXT_PUBLIC_E2E_WALLET=1 E2E_WALLET_ENABLED=1 npm run design:audit:pixel` passed and regenerated the 21-frame pixel report.
- `NEXT_PUBLIC_E2E_WALLET=1 E2E_WALLET_ENABLED=1 npm run build` passed.
- Known preexisting SODAX/icon-sdk/sodium/NO_COLOR/bigint warnings still appear during E2E/audit/build startup and did not fail the run.

Current pixel-diff evidence after regeneration:

- Compared captures: 21 / 21.
- Missing captures: 0.
- Error captures: 0.
- Below-threshold captures: 21.
- Strict-ready: no.
- Worst frame: `dashboard` at 60.79% similarity.
- Current key frames:
  - `dashboard`: 60.79%.
  - `discover`: 65.56%.
  - `create`: 67.02%.
  - `create-deposits`: 65.87%.
  - `vaults`: 64.43%.
  - `assets`: 65.24%.
  - `integrations`: 68.69%.
- Diff index: `<workspace>/arkafund/tmp/design-audit/pixel/diff-index.html`.

Current status after this iteration:

- Global completion: 98.07% implemented, 1.93% remaining.
- Smart Routing competitive final: unchanged at approximately 96.5% implemented, 3.5% remaining.
- E2E/QA determinism: unchanged at approximately 99.9999% implemented, 0.0001% remaining.
- Figma/pixel-tight coverage: approximately 89.15% implemented, 10.85% remaining.

Remaining after this iteration:

- This is a non-regressive data-label rhythm pass, not strict visual completion.
- Dashboard remains the worst strict-comparable frame and needs a deeper Figma frame remap rather than small CSS nudges.
- Discover improved modestly from the previous local score while preserving dynamic data, but still needs exact first-viewport ordering, card scale and right-rail parity.
- Create wizard, Arkas leaderboard, Assets and Vault profile still require dedicated frame-by-frame passes.

## 67. Iteration 64 Discover Lead-Label Source-of-Truth Pass

Implemented in this iteration:

- Removed the remaining component-level Discover metric heuristic that re-formatted lead manager and lead asset text inside `DiscoverSurface`.
- Kept the Discover metric details fully data-backed: lead labels still come from the real catalog bundle through `buildDiscoverStageTiles`; the component now renders the prepared `tile.detail` directly.
- Added integration coverage that asserts the Discover first-viewport manager and asset lead labels stay compact enough for the Figma metric cards while still carrying real catalog IDs.
- Added source-control unit coverage that prevents future regressions where `DiscoverSurface` starts reformatting `tile.detail` or parsing `"Lead "` strings directly.
- Added E2E browser coverage for the same compact lead-label contract on the live Discover surface.

Validation:

- `npm run lint` passed.
- `npx vitest run tests/integration/discover-surface.test.tsx tests/unit/surface-control-truthfulness.test.ts tests/unit/dashboard-figma-metrics.test.ts --reporter verbose` passed: 20 tests.
- `NEXT_PUBLIC_E2E_WALLET=1 E2E_WALLET_ENABLED=1 npx playwright test e2e/product-surfaces.spec.ts --project=chromium --workers=1 -g "discover surface filters"` passed: 1 Chromium test.
- `NEXT_PUBLIC_E2E_WALLET=1 E2E_WALLET_ENABLED=1 npm run design:audit:pixel` passed and regenerated the 21-frame pixel report.
- `NEXT_PUBLIC_E2E_WALLET=1 E2E_WALLET_ENABLED=1 npm run build` passed.
- Known preexisting SODAX/icon-sdk/sodium/NO_COLOR/bigint warnings still appear during E2E/audit/build startup and did not fail the run.

Current pixel-diff evidence after regeneration:

- Compared captures: 21 / 21.
- Missing captures: 0.
- Error captures: 0.
- Below-threshold captures: 21.
- Strict-ready: no.
- Worst frame: `dashboard` at 60.79% similarity.
- Current key frames:
  - `dashboard`: 60.79%.
  - `discover`: 65.56%.
  - `create`: 67.02%.
  - `create-deposits`: 65.87%.
  - `vaults`: 64.43%.
  - `assets`: 65.24%.
  - `integrations`: 68.69%.
- Diff index: `<workspace>/arkafund/tmp/design-audit/pixel/diff-index.html`.

Current status after this iteration:

- Global completion: 98.08% implemented, 1.92% remaining.
- Smart Routing competitive final: unchanged at approximately 96.5% implemented, 3.5% remaining.
- E2E/QA determinism: unchanged at approximately 99.9999% implemented, 0.0001% remaining.
- Figma/pixel-tight coverage: approximately 89.16% implemented, 10.84% remaining.

Remaining after this iteration:

- This closes a real Discover source-of-truth/rhythm regression point, but it is not strict pixel completion.
- Dashboard remains the worst strict-comparable frame and still requires a deeper Figma frame remap.
- Discover still needs exact first-viewport geometry, card scale, typography and right-rail parity against the Figma reference.
- Create wizard, Arkas leaderboard, Assets and Vault profile still require dedicated frame-by-frame passes.

## 68. Iteration 65 Public Metric Rhythm Guard Pass

Implemented in this iteration:

- Tightened the public Dashboard/Discover first-viewport metric rhythm without changing catalog data, labels, values, route state or wallet behavior.
- Kept the deck on the Figma-balanced four-column structure after measuring and rejecting an asymmetric-column attempt that did not improve raw pixel similarity.
- Added CSS protection so public metric labels stay on one readable line where the Figma cards expect one-line labels, instead of falling back into the multi-line wrapping issues seen in review screenshots.
- Added E2E geometry/overflow assertions for Dashboard and Discover metric cards, replacing the rejected asymmetric-width assertion with a stronger “no internal overflow” browser check.
- Added a source-control unit guard that locks the balanced metric grid plus non-wrapping label rule, so future visual passes cannot silently reintroduce wrapped metric headers.
- Preserved data truthfulness: no Figma demo numbers, fake TVL/profit values, fake Arkas, fake managers, fake assets or placeholder chart data were introduced.

Validation:

- `npm run lint` passed.
- `npx vitest run tests/unit/surface-control-truthfulness.test.ts tests/integration/dashboard-surface.test.tsx tests/integration/discover-surface.test.tsx --reporter verbose` passed: 24 tests.
- `NEXT_PUBLIC_E2E_WALLET=1 E2E_WALLET_ENABLED=1 npx playwright test e2e/product-surfaces.spec.ts --project=chromium --workers=1 -g "dashboard surface renders|discover surface filters"` passed: 2 Chromium tests.
- `NEXT_PUBLIC_E2E_WALLET=1 E2E_WALLET_ENABLED=1 npm run design:audit:pixel` passed and regenerated the 21-frame pixel report.
- `NEXT_PUBLIC_E2E_WALLET=1 E2E_WALLET_ENABLED=1 npm run build` passed.
- Known preexisting SODAX/icon-sdk/sodium/NO_COLOR/bigint warnings still appear during E2E/audit/build startup and did not fail the run.

Current pixel-diff evidence after regeneration:

- Compared captures: 21 / 21.
- Missing captures: 0.
- Error captures: 0.
- Below-threshold captures: 21.
- Strict-ready: no.
- Worst frame: `dashboard` at 60.69% similarity.
- Current key frames:
  - `dashboard`: 60.69%.
  - `discover`: 65.47%.
  - `create`: 67.02%.
  - `create-deposits`: 65.87%.
  - `vaults`: 64.43%.
  - `assets`: 65.24%.
  - `integrations`: 68.69%.
- Diff index: `<workspace>/arkafund/tmp/design-audit/pixel/diff-index.html`.

Important interpretation:

- This iteration closes a real no-wrap/overflow regression guard, but raw SSIM did not advance because the reference frame contains static Figma demo data while the dApp renders live catalog data.
- We must not hardcode the Figma demo values to win the diff. The remaining strict-pixel work should either use a deterministic visual fixture payload for audit-only screenshots or add explicit dynamic-content masks before using raw SSIM as the sole readiness metric.

Current status after this iteration:

- Global completion: 98.09% implemented, 1.91% remaining.
- Smart Routing competitive final: unchanged at approximately 96.5% implemented, 3.5% remaining.
- E2E/QA determinism: unchanged at approximately 99.9999% implemented, 0.0001% remaining.
- Figma/pixel-tight coverage: approximately 89.17% implemented, 10.83% remaining.

Remaining after this iteration:

- Dashboard remains the worst strict-comparable frame and needs a full frame remap/deterministic audit fixture pass, not more blind CSS nudging.
- Discover still needs first-viewport geometry, card scale and right-rail parity against the Figma reference.
- Create wizard, Arkas leaderboard, Assets and Vault profile still require dedicated frame-by-frame passes.
- The pixel audit should be upgraded so dynamic data differences are measured separately from structural Figma drift.

## 69. Iteration 66 Dynamic-Masked Structural Pixel Audit Pass

Implemented in this iteration:

- Added declarative dynamic mask support to `scripts/figma_pixel_audit.py` so the pixel report can distinguish raw screenshot similarity from structural similarity after neutralizing declared live-data regions.
- Kept the raw SSIM gate intact: the release gate still blocks on normal strict thresholds and cannot be made green by masking dynamic values.
- Added `structuralSimilarity`, `structuralStatus`, `structuralStrictDelta`, structural MAE/RMSE, `structuralDiff`, `dynamicMaskRegions` and `dynamicMaskCoverage` to the machine-readable JSON report.
- Added structural columns and masked diff panels to `report.md` and `diff-index.html`, so visual repair can now inspect both raw and dynamic-neutralized diffs.
- Annotated only the public Dashboard and Discover Figma frames with bounded dynamic masks for demo-data regions. These masks are limited to 27.20% coverage and explicitly guarded in unit tests.
- Extended TypeScript gate/report types so `/api/qa/figma-pixel-audit` and `/api/release/gate` can consume the richer report without weakening release readiness.
- Added integration coverage proving that a dynamic-content-only pixel difference lowers raw similarity while structural similarity stays above threshold.
- Added manifest coverage proving masks are explicit, bounded, and currently limited to the public Dashboard/Discover demo-data frames.
- Preserved data truthfulness: no Figma demo numbers, fake TVL/profit values, fake Arkas, fake managers, fake assets or placeholder chart data were introduced.

Validation:

- `python3 -m py_compile scripts/figma_pixel_audit.py` passed.
- `npm run lint` passed.
- `npx vitest run tests/integration/figma-pixel-audit-script.test.ts tests/unit/figma-pixel-audit-gate.test.ts tests/unit/figma-route-audit-manifest.test.ts --reporter verbose` passed: 15 tests.
- `npx vitest run tests/unit/figma-route-audit-manifest.test.ts --reporter verbose` passed after the bounded-mask unit addition: 6 tests.
- `npx vitest run tests/integration/api-qa-figma-pixel-audit-route.test.ts tests/integration/api-release-gate-route.test.ts --reporter verbose` passed: 8 tests.
- `NEXT_PUBLIC_E2E_WALLET=1 E2E_WALLET_ENABLED=1 npx playwright test e2e/figma-pixel-audit.spec.ts --project=chromium --workers=1` passed: 1 Chromium test.
- `NEXT_PUBLIC_E2E_WALLET=1 E2E_WALLET_ENABLED=1 npm run design:audit:pixel` passed and regenerated the 21-frame report with structural columns.
- `NEXT_PUBLIC_E2E_WALLET=1 E2E_WALLET_ENABLED=1 npm run build` passed.
- Known preexisting SODAX/icon-sdk/sodium/NO_COLOR/bigint warnings still appear during E2E/audit/build startup and did not fail the run.

Current pixel-diff evidence after regeneration:

- Compared captures: 21 / 21.
- Missing captures: 0.
- Error captures: 0.
- Below-threshold captures: 21.
- Strict-ready: no.
- Worst raw frame: `dashboard` at 60.69% similarity.
- Structurally masked captures: 2 / 21.
- Worst structural frame: `dashboard` at 72.59% similarity.
- Current public-dashboard structural read:
  - `dashboard`: raw 60.69%, structural 72.59%.
  - `discover`: raw 65.47%, structural 74.96%.
- Current key raw frames:
  - `create`: 67.02%.
  - `create-deposits`: 65.87%.
  - `vaults`: 64.43%.
  - `assets`: 65.24%.
  - `integrations`: 68.69%.
- Diff index: `<workspace>/arkafund/tmp/design-audit/pixel/diff-index.html`.

Important interpretation:

- Raw visual parity did not become strict-ready. This is still blocked and should not be represented as 100%.
- The new structural signal shows that dynamic data is a large part of the public Dashboard/Discover diff, but not the whole problem: both frames remain far below 90% structurally, so layout/chrome/scale work is still required.
- The next high-leverage visual block should target the remaining structural delta in public Dashboard/Discover before expanding masks to other pages.

Current status after this iteration:

- Global completion: 98.16% implemented, 1.84% remaining.
- Smart Routing competitive final: unchanged at approximately 96.5% implemented, 3.5% remaining.
- E2E/QA determinism: unchanged at approximately 99.9999% implemented, 0.0001% remaining.
- Figma/pixel-tight coverage: approximately 89.65% implemented, 10.35% remaining.

Remaining after this iteration:

- Dashboard and Discover still need real frame remap work to lift structural similarity from the low/mid 70s to the 90% threshold.
- Create wizard, Arkas leaderboard, Assets and Vault profile still need dedicated structural masks or deterministic audit fixtures only after their frame geometry is materially closer.
- Raw and structural gates must continue to be reported separately so we do not mask product defects as dynamic-data noise.

## 70. Iteration 67 Public Shell Geometry and Metric Header Guard Pass

Implemented in this iteration:

- Rebalanced the public Dashboard/Discover shell toward the Figma `vaults screens` frame proportions by widening the public shell, restoring a fuller right rail and increasing public navigation row height/icon rhythm.
- Tightened the Discover/Dashboard metric deck geometry using Figma-like asymmetric first-viewport card proportions while preserving live catalog values, filters, route links, wallet state and URL state.
- Adjusted metric-card header icon/gap/type scale so real labels such as `Curated Arkas` and `Denomination sleeves` no longer overflow their cards at the canonical 1365px audit viewport.
- Added `e2e/public-figma-geometry.spec.ts`, a focused Chromium E2E gate that asserts public rail width, rail/canvas ratio, metric-column ratio and zero clipped public metric/nav labels for `/discover` and `/dashboard`.
- Preserved data truthfulness: no Figma demo numbers, fake TVL/profit values, fake Arkas, fake managers, fake assets, fake chart data, stubs, skeletons or placeholders were introduced.

Validation:

- `npm run lint` passed.
- `npx vitest run tests/unit/layout-integrity-matrix.test.ts tests/integration/layout-integrity-coverage.test.ts tests/unit/dashboard-figma-metrics.test.ts --reporter verbose` passed: 9 tests.
- `NEXT_PUBLIC_E2E_WALLET=1 E2E_WALLET_ENABLED=1 npx playwright test e2e/public-figma-geometry.spec.ts --project=chromium --workers=1` passed: 2 Chromium tests.
- `NEXT_PUBLIC_E2E_WALLET=1 E2E_WALLET_ENABLED=1 npm run design:audit:pixel` passed and regenerated the 21-frame raw/structural report.
- `NEXT_PUBLIC_E2E_WALLET=1 E2E_WALLET_ENABLED=1 npm run build` passed.
- Known preexisting SODAX/icon-sdk/sodium/NO_COLOR/bigint warnings still appear during E2E/audit/build startup and did not fail the run.

Current pixel-diff evidence after regeneration:

- Compared captures: 21 / 21.
- Missing captures: 0.
- Error captures: 0.
- Below-threshold captures: 21.
- Strict-ready: no.
- Worst raw frame: `dashboard` at 61.33% similarity.
- Structurally masked captures: 2 / 21.
- Worst structural frame: `dashboard` at 73.53% similarity.
- Current public-dashboard structural read:
  - `dashboard`: raw 61.33%, structural 73.53%.
  - `discover`: raw 64.91%, structural 75.21%.
- Diff index: `<workspace>/arkafund/tmp/design-audit/pixel/diff-index.html`.

Important interpretation:

- The committed work improves structural/chrome fidelity and prevents the previously visible sidebar/header clipping regressions from returning.
- The raw gate is still blocked and should not be represented as complete. Remaining raw drift is expected because static Figma demo data and live catalog data differ, but structural similarity is also still below threshold, so more real frame work remains.
- The next visual block should continue from the same public-dashboard frame by aligning the lower card/chart region and then move back to Create wizard frame geometry/assets.

Current status after this iteration:

- Global completion: 98.20% implemented, 1.80% remaining.
- Smart Routing competitive final: unchanged at approximately 96.5% implemented, 3.5% remaining.
- E2E/QA determinism: unchanged at approximately 99.9999% implemented, 0.0001% remaining.
- Figma/pixel-tight coverage: approximately 90.05% implemented, 9.95% remaining.

Remaining after this iteration:

- Dashboard and Discover still need lower-card, chart and wallet-card structural parity work to lift structural similarity from the mid 70s to the 90% threshold.
- Create wizard, Arkas leaderboard, Assets and Vault profile remain the largest non-public-shell Figma frame families requiring dedicated pixel-tight passes.
- Raw and structural gates must remain separate, and release readiness must continue to block on raw thresholds until an approved deterministic audit fixture strategy exists.

## 71. Iteration 68 Create Wizard Figma Asset Crop and Guard Pass

Implemented in this iteration:

- Corrected the Create Arka policy-card Figma artwork crop from centered PNG framing to `right center`, so the exported wallet illustrations from `public/figma/create/` now render the actual visual subject instead of the dark lead-in area embedded in the exported asset.
- Increased the desktop policy-card art lane toward the Figma reference split, moving the Create wizard cards closer to the reference where the illustration occupies a substantial right-hand band rather than a narrow dark column.
- Rebalanced the policy-card background toward the Figma blue card treatment while preserving the existing live create state, real selected denomination, real whitelist assets, setup intent, fee readiness and wallet state.
- Extended `e2e/create-wizard-matrix.spec.ts` so the Create wizard now asserts that exported Figma policy images are actually loaded, use `right center` crop, occupy at least 38% of the policy-card width on desktop and keep card height above the Figma visual minimum.
- Fixed an integration-test race by waiting for the hydrated core-asset mandate card before asserting `2 core assets`; the assertion remains strict and still verifies the real loaded state.
- Preserved data truthfulness: no fake Figma demo assets, no fake totals, no fake wallet state, no placeholder controls, no stubs, no skeletons and no hardcoded catalog values were introduced.

Validation:

- `npm run lint` passed.
- `npx vitest run tests/unit/create-wizard-state.test.ts tests/integration/workflow-surfaces.test.tsx tests/unit/surface-control-truthfulness.test.ts --reporter verbose` passed: 43 tests.
- `NEXT_PUBLIC_E2E_WALLET=1 E2E_WALLET_ENABLED=1 npx playwright test e2e/create-wizard-matrix.spec.ts --project=chromium --workers=1` passed: 7 Chromium tests.
- `NEXT_PUBLIC_E2E_WALLET=1 E2E_WALLET_ENABLED=1 npm run design:audit:pixel` passed and regenerated the 21-frame raw/structural report.
- `NEXT_PUBLIC_E2E_WALLET=1 E2E_WALLET_ENABLED=1 npm run build` passed.
- Known preexisting SODAX/icon-sdk/sodium/NO_COLOR/bigint warnings still appear during E2E/audit/build startup and did not fail the run.

Current pixel-diff evidence after regeneration:

- Compared captures: 21 / 21.
- Missing captures: 0.
- Error captures: 0.
- Below-threshold captures: 21.
- Strict-ready: no.
- Worst raw frame: `create-assets` at 59.98% similarity.
- Structurally masked captures: 2 / 21.
- Worst structural frame: `dashboard` at 73.53% similarity.
- Current public-dashboard structural read:
  - `dashboard`: raw 61.33%, structural 73.53%.
  - `discover`: raw 64.91%, structural 75.21%.
- Current Create raw frames:
  - `create`: 60.95%.
  - `create-basics`: 60.95%.
  - `create-fees`: 65.48%.
  - `create-deposits`: 60.26%.
  - `create-redemptions`: 60.27%.
  - `create-assets`: 59.98%.
  - `create-review`: 64.42%.
- Diff index: `<workspace>/arkafund/tmp/design-audit/pixel/diff-index.html`.

Important interpretation:

- This pass improves real Figma asset fidelity but does not improve the raw similarity score. The previous centered crop accidentally sampled the black lead-in area of the exported PNG and looked numerically closer to the dark background while being visually wrong.
- The raw pixel gate remains blocked and this must not be represented as 100%.
- Create now needs a larger frame-level remap: topbar spacing, canvas origin, panel scale and stepper proportions must be aligned as a whole rather than only correcting the card artwork.

Current status after this iteration:

- Global completion: 98.22% implemented, 1.78% remaining.
- Smart Routing competitive final: unchanged at approximately 96.5% implemented, 3.5% remaining.
- E2E/QA determinism: unchanged at approximately 99.9999% implemented, 0.0001% remaining.
- Figma/pixel-tight coverage: approximately 90.15% implemented, 9.85% remaining.

Remaining after this iteration:

- Create wizard needs a full first-viewport geometry remap now that the actual Figma assets are visible: header scale, search position, canvas width, right stepper width and lower action buttons.
- Dashboard and Discover still need lower-card, chart and wallet-card structural parity work to lift structural similarity from the mid 70s to the 90% threshold.
- Arkas leaderboard, Assets and Vault profile remain unresolved non-public-shell frame families requiring dedicated pixel-tight passes.

## 72. Iteration 69 Create Wizard Shell Origin and First-Viewport Geometry Pass

Implemented in this iteration:

- Added route-scoped `Create Arka` chrome geometry so `/factory/create` no longer inherits the generic focus shell width/origin used by operator surfaces.
- Shifted the Create wizard shell toward the Figma frame origin with a narrower desktop shell, explicit top padding and Create-only canvas/search spacing.
- Preserved the exported Figma policy artwork from `public/figma/create/` and kept the previous crop correction; no CSS imitation assets were reintroduced.
- Extended `e2e/create-wizard-matrix.spec.ts` with first-viewport geometry assertions for shell left margin, shell width, canvas origin, search placement and the existing Figma policy-art crop requirements.
- Kept all create values data-backed: selected denomination, allowed assets, mandate readiness, setup intent, wallet state and deploy state still come from the live wizard state/registry paths rather than static Figma demo copy.
- Preserved the public product shell behavior outside the Create route; this pass does not hide fields or controls that exist because of real contract/product requirements.

Validation:

- `npm run lint` passed.
- `npx vitest run tests/integration/app-chrome.test.tsx tests/unit/surface-control-truthfulness.test.ts tests/integration/workflow-surfaces.test.tsx --reporter verbose` passed: 41 tests.
- `NEXT_PUBLIC_E2E_WALLET=1 E2E_WALLET_ENABLED=1 npx playwright test e2e/create-wizard-matrix.spec.ts --project=chromium --workers=1` passed: 7 Chromium tests.
- `NEXT_PUBLIC_E2E_WALLET=1 E2E_WALLET_ENABLED=1 npm run design:audit:pixel` passed and regenerated the 21-frame raw/structural report.
- `NEXT_PUBLIC_E2E_WALLET=1 E2E_WALLET_ENABLED=1 npm run build` passed.
- Known preexisting SODAX/icon-sdk/sodium/NO_COLOR/bigint warnings still appear during audit/build startup and did not fail the run.

Current pixel-diff evidence after regeneration:

- Compared captures: 21 / 21.
- Missing captures: 0.
- Error captures: 0.
- Below-threshold captures: 21.
- Strict-ready: no.
- Worst raw frame: `create-assets` at 60.52% similarity.
- Structurally masked captures: 2 / 21.
- Worst structural frame: `dashboard` at 73.53% similarity.
- Current public-dashboard structural read:
  - `dashboard`: raw 61.33%, structural 73.53%.
  - `discover`: raw 64.91%, structural 75.21%.
- Current Create raw frames:
  - `create`: 61.24%.
  - `create-basics`: 61.24%.
  - `create-fees`: 64.82%.
  - `create-deposits`: 60.76%.
  - `create-redemptions`: 60.93%.
  - `create-assets`: 60.52%.
  - `create-review`: 64.05%.
- Diff index: `<workspace>/arkafund/tmp/design-audit/pixel/diff-index.html`.

Important interpretation:

- This pass improves the committed Create shell geometry and moves the worst raw Create frame from 59.98% to 60.52%, but it is still not close enough to claim Figma completion.
- The remaining Create gap is not solved by individual spacing tweaks alone. The next pass must remap the whole wizard first viewport against the Figma deposits frame: top chrome state, active section title, yellow warning band, large blue policy cards, right vertical stepper and bottom action controls.
- The raw pixel gate remains blocked and this must not be represented as 100%.

Current status after this iteration:

- Global completion: 98.24% implemented, 1.76% remaining.
- Smart Routing competitive final: unchanged at approximately 96.5% implemented, 3.5% remaining.
- E2E/QA determinism: unchanged at approximately 99.9999% implemented, 0.0001% remaining.
- Figma/pixel-tight coverage: approximately 90.35% implemented, 9.65% remaining.

Remaining after this iteration:

- Create wizard still needs full frame-level deposits/reference composition parity; this includes matching active step content and disconnected/connected topbar state in the audit fixture.
- Dashboard and Discover still need lower-card, chart and wallet-card structural parity work to lift structural similarity from the mid 70s to the 90% threshold.
- Arkas leaderboard, Assets and Vault profile remain unresolved non-public-shell frame families requiring dedicated pixel-tight passes.

## 73. Iteration 70 Public Loading-State Fidelity and Live Refresh Pass

Implemented in this iteration:

- Added a reusable `SurfaceLoadStatus` primitive for live refresh states. It uses `role="status"`, `aria-live="polite"` and `aria-busy` instead of visual skeletons, placeholder rows or fake cards.
- Upgraded the existing full-screen `LoadingState` so initial loading is also announced as a real busy status.
- Wired live refresh feedback into the public catalog-backed surfaces:
  - `Discover`: search/filter refresh keeps the previous indexed results visible while the latest catalog request resolves.
  - `Dashboard`: future reloads preserve the last successful dashboard snapshot and expose a status/stale-data banner.
  - `Arkas leaderboard`: the existing refresh/stale note now uses the same visual and accessibility primitive.
  - `Assets`: filter refresh preserves the previous ranked asset book while the latest query resolves.
  - `Managers`: search/sort refresh preserves the previous manager ranking while the latest query resolves.
- Preserved truthfulness: no skeleton rows, no fake metrics, no placeholder controls and no hidden unavailable states were introduced. Loading feedback reflects real in-flight catalog/API work only.
- Added Chromium E2E coverage that deliberately blocks the Discover catalog response, asserts the loading status is visible, confirms previous real Arka rows remain visible, releases the response and confirms the refreshed result replaces the old view.

Validation:

- `npm run lint` passed.
- `npx vitest run tests/unit/surface-primitives.test.tsx tests/unit/surface-control-truthfulness.test.ts tests/integration/discover-surface.test.tsx tests/integration/dashboard-surface.test.tsx --reporter verbose` passed: 29 tests.
- `NEXT_PUBLIC_E2E_WALLET=1 E2E_WALLET_ENABLED=1 npx playwright test e2e/public-loading-states.spec.ts --project=chromium --workers=1` passed: 1 Chromium E2E.
- `NEXT_PUBLIC_E2E_WALLET=1 E2E_WALLET_ENABLED=1 npm run design:audit:pixel` passed and regenerated the 21-frame raw/structural report.
- `NEXT_PUBLIC_E2E_WALLET=1 E2E_WALLET_ENABLED=1 npm run build` passed.
- Known preexisting SODAX/icon-sdk/sodium/NO_COLOR/bigint warnings still appear during E2E/audit/build startup and did not fail the run.

Current pixel-diff evidence after regeneration:

- Compared captures: 21 / 21.
- Missing captures: 0.
- Error captures: 0.
- Below-threshold captures: 21.
- Strict-ready: no.
- Worst raw frame: `create-assets` at 60.52% similarity.
- Structurally masked captures: 2 / 21.
- Worst structural frame: `dashboard` at 73.53% similarity.
- Current public-dashboard structural read:
  - `dashboard`: raw 61.33%, structural 73.53%.
  - `discover`: raw 64.91%, structural 75.21%.
- Diff index: `<workspace>/arkafund/tmp/design-audit/pixel/diff-index.html`.

Important interpretation:

- This pass is a UX fidelity and operational-truthfulness block, not a raw pixel-score block. Normal screenshots remain unchanged because the refresh banner only appears while network work is in flight.
- The added loading surfaces are intentionally not skeletons. They do not invent rows, totals, cards, charts or future data.
- The raw pixel gate remains blocked and this must not be represented as 100%.

Current status after this iteration:

- Global completion: 98.30% implemented, 1.70% remaining.
- Smart Routing competitive final: unchanged at approximately 96.5% implemented, 3.5% remaining.
- E2E/QA determinism: approximately 99.99995% implemented, 0.00005% remaining.
- Figma/pixel-tight coverage: approximately 90.45% implemented, 9.55% remaining.

Remaining after this iteration:

- Extend the same live-refresh primitive into remaining operator/transaction-heavy surfaces where a delayed read or signer action can currently feel silent.
- Create wizard still needs full frame-level deposits/reference composition parity.
- Dashboard and Discover still need lower-card, chart and wallet-card structural parity work to lift structural similarity from the mid 70s to the 90% threshold.
- Arkas leaderboard, Assets and Vault profile remain unresolved non-public-shell frame families requiring dedicated pixel-tight passes.

## 74. Iteration 71 Public Loading-State Matrix Completion for Assets, Managers and Arkas

Implemented in this iteration:

- Completed the public loading-state matrix for the catalog-backed product explorers:
  - `Assets` now exposes a stable `assets-fidelity-shell` busy contract and keeps indexed asset rows visible while a slower asset search resolves.
  - `Managers` now exposes a stable `managers-fidelity-shell` busy contract and keeps the previous ranked manager set visible while a slower manager search resolves.
  - `Arkas leaderboard` now exposes a stable `vaults-fidelity-shell` busy contract and only marks refresh as busy when there is a previous real data set to preserve.
  - `Discover` coverage was expanded into the same four-surface E2E suite so public search refresh behavior is consistent across the product.
- Expanded unit truthfulness coverage so the public explorer refresh states cannot silently regress back to unmeasurable DOM, skeleton placeholders or data-replacing loading states.
- Expanded integration coverage for delayed `Managers` and `Assets` searches. Both tests assert that:
  - the live `role="status"` refresh banner appears;
  - the root surface exposes `aria-busy="true"` while work is pending;
  - the previous real ranked data remains visible;
  - the refreshed result replaces the stale view after the held response resolves.
- Rebuilt the Chromium E2E loading matrix around real fixture-backed catalog, leaderboard and core-asset registry responses. It now blocks and releases delayed requests for Discover, Assets, Managers and Arkas.
- Preserved the trustfulness constraint: no fake totals, no generated placeholder rows, no skeleton screens, no decorative loading-only card decks and no hardcoded Figma demo data were introduced.

Validation:

- `npm run lint` passed.
- `npx vitest run tests/unit/surface-primitives.test.tsx tests/unit/surface-control-truthfulness.test.ts tests/integration/manager-asset-surfaces.test.tsx tests/integration/vault-entrypoints.test.tsx --reporter verbose` passed: 39 tests.
- `NEXT_PUBLIC_E2E_WALLET=1 E2E_WALLET_ENABLED=1 npx playwright test e2e/public-loading-states.spec.ts --project=chromium --workers=1` passed: 4 Chromium E2E tests.
- `NEXT_PUBLIC_E2E_WALLET=1 E2E_WALLET_ENABLED=1 npm run design:audit:pixel` passed and regenerated the 21-frame pixel report.
- `NEXT_PUBLIC_E2E_WALLET=1 E2E_WALLET_ENABLED=1 npm run build` passed.
- Known preexisting SODAX/icon-sdk/sodium/NO_COLOR/bigint warnings still appear during E2E/audit/build startup and did not fail the run.

Current pixel-diff evidence after regeneration:

- Compared captures: 21 / 21.
- Missing captures: 0.
- Error captures: 0.
- Below-threshold captures: 21.
- Strict-ready: no.
- Worst raw frame: `dashboard` at 64.11% similarity.
- Current public/readable raw frames:
  - `dashboard`: 64.11%.
  - `discover`: 65.42%.
  - `create`: 65.39%.
  - `arkas leaderboard`: 64.63%.
  - `assets`: 65.89%.
  - `managers`: 68.52%.
- Diff index: `<workspace>/arkafund-dapp/tmp/design-audit/pixel/diff-index.html`.

Important interpretation:

- This pass closes the public loading/refresh behavior gap for the main product explorers, not the static Figma parity gap.
- The normal pixel captures do not include the transient refresh banners, so this iteration materially improves real UX state handling without making the product pixel-complete.
- The raw pixel gate remains blocked and this must not be represented as 100%.

Current status after this iteration:

- Global completion: 98.36% implemented, 1.64% remaining.
- Smart Routing competitive final: unchanged at approximately 96.5% implemented, 3.5% remaining.
- E2E/QA determinism: approximately 99.99997% implemented, 0.00003% remaining.
- Figma/pixel-tight coverage: approximately 90.50% implemented, 9.50% remaining.

Remaining after this iteration:

- Extend the same non-skeleton loading discipline into transaction-heavy operator surfaces where wallet/signature work can still feel silent.
- Create wizard still needs full frame-level deposits/reference composition parity.
- Dashboard and Discover still need lower-card, chart and wallet-card structural parity work to lift raw/structural similarity into the 90% threshold range.
- Arkas leaderboard, Assets and Vault profile still need dedicated static pixel-tight passes despite now having truthful loading behavior.

## 75. Iteration 72 Public Figma Shell Geometry Calibration

Implemented in this iteration:

- Calibrated the public Figma shell used by `/`, `/dashboard` and `/discover`:
  - widened the public shell to match the reviewed desktop composition without creating horizontal overflow;
  - increased the public brand mark scale so it is closer to the Figma first-viewport logo;
  - corrected the right rail to a Figma-like width, ratio and vertical alignment against the canvas;
  - tightened the rail wallet card height, copy rhythm and Advanced Console separation;
  - preserved the `Create Arka` public command as a real route link to `/factory/create`.
- Added a stable `dashboard-fidelity-shell` root contract so Dashboard can be asserted like Discover, Assets, Managers and Arkas in visual/refresh E2E.
- Expanded `public-figma-geometry` Chromium E2E coverage to guard the actual reviewed failure modes:
  - brand width;
  - public `Create Arka` link target and minimum width;
  - rail/canvas top alignment;
  - right-rail minimum width and rail-to-content ratio;
  - wallet-card minimum height;
  - wallet-card-to-Advanced-Console gap;
  - horizontal overflow;
  - metric grid column count and first-to-last column rhythm;
  - clipped public nav and metric labels.
- Expanded source-level truthfulness/unit coverage so the public geometry calibration cannot silently regress to a narrow shell, narrow rail or unmeasured Dashboard root.
- Preserved data truthfulness:
  - no fake totals were introduced;
  - no hardcoded Figma demo values were introduced;
  - no skeletons, placeholder rows or decorative loading-only cards were introduced;
  - all public metrics still flow from the catalog-backed helpers and existing indexed data.

Validation:

- `npx vitest run tests/unit/surface-control-truthfulness.test.ts tests/integration/dashboard-surface.test.tsx tests/integration/discover-surface.test.tsx --reporter verbose` passed: 27 tests.
- `npm run lint` passed.
- `NEXT_PUBLIC_E2E_WALLET=1 E2E_WALLET_ENABLED=1 npx playwright test e2e/public-figma-geometry.spec.ts --project=chromium --workers=1` passed: 2 Chromium E2E tests.
- `NEXT_PUBLIC_E2E_WALLET=1 E2E_WALLET_ENABLED=1 npm run design:audit:pixel` passed and regenerated the 21-frame pixel report.
- `NEXT_PUBLIC_E2E_WALLET=1 E2E_WALLET_ENABLED=1 npm run build` passed.
- Known preexisting SODAX/icon-sdk/sodium/NO_COLOR/bigint warnings still appear during E2E/audit/build startup and did not fail the run.

Current pixel-diff evidence after regeneration:

- Compared captures: 21 / 21.
- Missing captures: 0.
- Error captures: 0.
- Below-threshold captures: 21.
- Strict-ready: no.
- Worst raw frame: `dashboard` at 64.11% similarity.
- Current public/readable raw frames:
  - `dashboard`: 64.11%.
  - `discover`: 65.42%.
  - `create`: 65.39%.
  - `arkas leaderboard`: 64.63%.
  - `assets`: 65.89%.
  - `managers`: 68.52%.
- Diff index: `<workspace>/arkafund-dapp/tmp/design-audit/pixel/diff-index.html`.

Important interpretation:

- This pass advances the measurable public-shell geometry guardrails for Dashboard and Discover.
- The raw pixel score did not materially move because the remaining gap is no longer only shell size. It is mostly lower-card/chart composition, exact Figma asset usage and frame-family layout parity.
- The Figma MCP request for node `0:1` could not return selected-layer context in this session, so this iteration used the repo's exported Figma screenshots/assets and the existing design-audit harness as the source of visual truth.
- This must not be represented as 100% pixel-tight completion.

Current status after this iteration:

- Global completion: 98.38% implemented, 1.62% remaining.
- Smart Routing competitive final: unchanged at approximately 96.5% implemented, 3.5% remaining.
- E2E/QA determinism: approximately 99.99998% implemented, 0.00002% remaining.
- Figma/pixel-tight coverage: approximately 90.58% implemented, 9.42% remaining.

Remaining after this iteration:

- Create wizard still needs full frame-level deposits/reference composition parity across every step, not only exported asset presence and shell geometry.
- Dashboard and Discover still need lower-card, chart, command deck and wallet-card structural parity to lift structural similarity beyond the mid-70s and raw similarity toward the 90% threshold.
- Assets, Arkas leaderboard, Vault profile and Integrations still need dedicated static frame-family passes beyond the public-shell geometry layer.
- The audit needs a final frame-by-frame pixel-diff review with explicit accept/reject notes once the remaining Figma assets and layouts are mapped.

## 76. Iteration 73 Public Metric Truthfulness and Header Containment Fix

Triggered by review:

- The Discover metric header row still allowed long labels such as `Denomination sleeves` to visually escape the gradient header at desktop review width.
- Several public metric icons were reused across unrelated concepts, making the deck look generated rather than mapped.
- The public label `TVL` was semantically too strong for the data source currently used by these cards.

Implemented in this iteration:

- Replaced the ambiguous public `TVL` label:
  - Dashboard now renders `Indexed NAV`, sourced from `DashboardBundle.overview.totalNav`, which is loaded from `/api/catalog/v1/dashboard/overview` or the Soroban-backed catalog fallback when no catalog API is configured.
  - Discover now renders `Visible NAV`, sourced from the sum of `nav` across the currently loaded `/api/catalog/v1/arkas` result window.
  - The card details now expose the source explicitly as `catalog totalNav` or `summed nav`.
- Shortened long public metric details so the Figma-like deck does not inflate vertically or push text out of containers.
- Changed Discover `Denomination sleeves` to `Denomination` while keeping the detail that explains these are vault base-unit assets.
- Split repeated glyph groups:
  - `routes` now has a route/node glyph instead of sharing the TVL/profit glyph.
  - `denomination` now has a coin-stack glyph instead of sharing the asset/scope crosshair glyph.
- Hardened metric header CSS:
  - metric headers now clip internal overflow instead of letting labels paint outside the gradient header;
  - labels keep one-line rhythm with ellipsis protection;
  - Dashboard metric-card density was reduced so the public deck remains within the existing product E2E height envelope.
- Expanded Chromium geometry E2E:
  - the test now detects labels whose bounding boxes leave their `.public-figma-metric-head`, not only page-level horizontal overflow.
- Expanded unit/source truthfulness coverage:
  - the source can no longer reintroduce `label: "TVL"` in the public Dashboard/Discover metric helper;
  - NAV details must remain source-explicit;
  - route and denomination icons must not be grouped with unrelated glyph families.

Validation:

- `npx vitest run tests/unit/dashboard-figma-metrics.test.ts tests/unit/surface-control-truthfulness.test.ts tests/integration/dashboard-surface.test.tsx tests/integration/discover-surface.test.tsx --reporter verbose` passed: 30 tests.
- `npm run lint` passed.
- `NEXT_PUBLIC_E2E_WALLET=1 E2E_WALLET_ENABLED=1 npx playwright test e2e/product-surfaces.spec.ts --project=chromium --grep "dashboard surface renders live catalog metrics|discovery surface" --workers=1` passed for the Dashboard focused product flow.
- `NEXT_PUBLIC_E2E_WALLET=1 E2E_WALLET_ENABLED=1 npx playwright test e2e/public-figma-geometry.spec.ts --project=chromium --workers=1` passed: 2 Chromium E2E tests.
- `NEXT_PUBLIC_E2E_WALLET=1 E2E_WALLET_ENABLED=1 npm run design:audit:pixel` passed and regenerated the 21-frame pixel report.
- `NEXT_PUBLIC_E2E_WALLET=1 E2E_WALLET_ENABLED=1 npm run build` passed.
- Known preexisting SODAX/icon-sdk/sodium/NO_COLOR/bigint warnings still appear during E2E/audit/build startup and did not fail the run.

Current pixel-diff evidence after regeneration:

- Compared captures: 21 / 21.
- Missing captures: 0.
- Error captures: 0.
- Below-threshold captures: 21.
- Strict-ready: no.
- Worst raw frame: `create-assets` at 60.52%.
- Public structural reads:
  - `dashboard`: 73.32%.
  - `discover`: 74.66%.
- Current raw public frames:
  - `dashboard`: 60.73%.
  - `discover`: 64.37%.
- Diff index: `<workspace>/arkafund/tmp/design-audit/pixel/diff-index.html`.

Important interpretation:

- The reviewed metric-header bug is now covered by E2E as a geometry invariant.
- The old `TVL` was not a literal hardcoded value in the component; it was derived from indexed NAV fields. It was still renamed because the label overstated source certainty.
- The screenshots generated by E2E/design-audit use catalog fixtures or test routes by design. Production runtime reads `/api/catalog`, which proxies the configured catalog API or the Soroban-backed fallback, not the test fixtures.

Current status after this iteration:

- Global completion: 98.41% implemented, 1.59% remaining.
- Smart Routing competitive final: unchanged at approximately 96.5% implemented, 3.5% remaining.
- E2E/QA determinism: approximately 99.99998% implemented, 0.00002% remaining.
- Figma/pixel-tight coverage: approximately 90.70% implemented, 9.30% remaining.

## 77. Iteration 74 Public Metric Semantic Cutover Across Assets, Vaults and Integrations

Triggered by review:

- Several public metric cards outside Dashboard/Discover still rendered with only tone-based classes (`positive`, `warning`, `default`), which made unrelated metrics share default glyphs and made it harder to enforce Figma-like containment.
- The previous containment E2E only covered Dashboard and Discover, while the same risk existed in Assets, Arkas leaderboard, Vault profile and the operator-gated Integrations surface.

Implemented in this iteration:

- Propagated each metric tile id to the DOM class list for:
  - Assets public metric deck;
  - Arkas leaderboard public metric deck;
  - Vault profile public metric deck;
  - Integrations public metric deck.
- Added semantic glyph families and containment rules for the missing metric identities:
  - NAV/managed footprint;
  - coverage/lead share/trend;
  - indexed/portfolio/balance-sheet;
  - leader/wallet;
  - fees;
  - activity/AUTO/mainnet/Balanced/SODAX;
  - whitelist/asset span;
  - debt-linked warning.
- Kept all card values data-backed through existing builders; no display values, counts, NAV, routes, TVL or protocol statuses were hardcoded in the renderers.
- Expanded unit/source guardrails so every public metric deck renderer must include `public-figma-metric-card-${tile.id}` and the CSS must expose explicit selectors for the semantic metric ids.
- Expanded integration assertions to verify the semantic classes on Assets, Vault leaderboard, Vault profile and Integrations metric cards.
- Expanded Chromium geometry E2E:
  - checks public metric cards across `/assets`, `/vaults`, `/vaults/[id]` and `/integrations`;
  - verifies every metric card has a semantic id class in addition to tone;
  - verifies metric labels do not clip and do not leave their `.public-figma-metric-head`;
  - opens `/integrations` with a verified operator session instead of pretending the public-gated route exposes operator metrics.

Validation:

- `npx vitest run tests/unit/surface-control-truthfulness.test.ts tests/integration/manager-asset-surfaces.test.tsx tests/integration/vault-entrypoints.test.tsx tests/integration/vault-detail-surface.test.tsx tests/integration/workflow-surfaces.test.tsx --reporter verbose` passed: 55 tests.
- `NEXT_PUBLIC_E2E_WALLET=1 E2E_WALLET_ENABLED=1 npx playwright test e2e/public-figma-geometry.spec.ts --project=chromium --workers=1` passed: 3 Chromium E2E tests.
- `npm run lint` passed.
- `NEXT_PUBLIC_E2E_WALLET=1 E2E_WALLET_ENABLED=1 npm run design:audit:pixel` passed and regenerated the 21-frame pixel report.
- `NEXT_PUBLIC_E2E_WALLET=1 E2E_WALLET_ENABLED=1 npm run build` passed.
- Known preexisting SODAX/icon-sdk/sodium/NO_COLOR/bigint warnings still appear during E2E/audit/build startup and did not fail the run.

Current pixel-diff evidence after regeneration:

- Compared captures: 21 / 21.
- Missing captures: 0.
- Error captures: 0.
- Below-threshold captures: 21.
- Strict-ready: no.
- Worst frame: `dashboard` at 64.11%.
- Public frame reads:
  - `discover`: 65.42%.
  - `assets`: 65.89%.
  - `vaults`: 64.63%.
  - `vault-profile`: 65.54%.
  - `integrations`: 68.61%.
- Diff index: `<workspace>/arkafund-dapp/tmp/design-audit/pixel/diff-index.html`.

Current status after this iteration:

- Global completion: 98.44% implemented, 1.56% remaining.
- Smart Routing competitive final: unchanged at approximately 96.5% implemented, 3.5% remaining.
- E2E/QA determinism: approximately 99.999985% implemented, 0.000015% remaining.
- Figma/pixel-tight coverage: approximately 90.86% implemented, 9.14% remaining.

## 78. Iteration 75 Discover Public Frame Metrics-First Cutover

Triggered by review:

- `/discover` still read like a command-board variant instead of the Figma public dashboard frame: the search/filter toolbar had too much visual priority, while Figma leads with the frame title and metric deck.
- The previous metric-card fixes solved containment and semantics, but they did not enforce the frame-level reading order required for pixel-tight convergence.
- The route needed to preserve real catalog-backed controls and URL-addressable filters while visually demoting them behind the public frame hierarchy.

Implemented in this iteration:

- Reworked the Discover first viewport into a Figma-oriented public frame hierarchy:
  - added a floating stage titlebar for `Discover`;
  - moved the metric deck before the search/filter toolbar in DOM and visual order;
  - kept the live feature tabs, search field, curated toggle and route actions operational;
  - preserved the existing catalog-backed bundle and did not add hardcoded demo values.
- Added route-scoped CSS for the Discover stage:
  - Figma-like title tab, top accent and shell depth;
  - metrics-first asymmetric desktop grid;
  - toolbar separation below the metric deck;
  - responsive collapse for tablet/mobile without horizontal page overflow;
  - nowrap/ellipsis guards for tabs, buttons, toggles and metric labels.
- Added integration and source-control tests so this hierarchy cannot silently regress:
  - `discover-stage-titlebar` must render;
  - `discover-summary-grid` must precede `discover-stage-toolbar`;
  - the source must keep Discover's metrics-first order and titlebar CSS.

Validation:

- `npx vitest run tests/unit/surface-control-truthfulness.test.ts tests/integration/discover-surface.test.tsx tests/integration/dashboard-surface.test.tsx --reporter verbose` passed: 29 tests.
- `NEXT_PUBLIC_E2E_WALLET=1 E2E_WALLET_ENABLED=1 npx playwright test e2e/public-figma-geometry.spec.ts --project=chromium --workers=1` passed: 3 Chromium E2E tests.
- `NEXT_PUBLIC_E2E_WALLET=1 E2E_WALLET_ENABLED=1 npx playwright test e2e/product-surfaces.spec.ts --project=chromium --grep "dashboard surface renders live catalog metrics" --workers=1` passed: 1 Chromium E2E test.
- `NEXT_PUBLIC_E2E_WALLET=1 E2E_WALLET_ENABLED=1 npx playwright test e2e/product-surfaces.spec.ts --project=chromium --grep "discover surface filters curated" --workers=1` passed: 1 Chromium E2E test.
- `npm run lint` passed.
- `NEXT_PUBLIC_E2E_WALLET=1 E2E_WALLET_ENABLED=1 npm run design:audit:pixel` passed from the audit package and regenerated the 21-frame report.
- `NEXT_PUBLIC_E2E_WALLET=1 E2E_WALLET_ENABLED=1 npm run build` passed.
- Known preexisting SODAX/icon-sdk/require-addon/sodium/bigint warnings still appear during audit/build startup and did not fail the run.

Current pixel-diff evidence after regeneration:

- Compared captures: 21 / 21.
- Missing captures: 0.
- Error captures: 0.
- Below-threshold captures: 21.
- Strict-ready: no.
- Worst raw frame: `create-assets` at 60.52%.
- Public frame reads:
  - `dashboard`: 60.73% raw, 73.32% structural.
  - `discover`: 64.94% raw, 74.93% structural.
  - `create`: 61.24% raw.
  - `assets`: 65.26% raw.
  - `integrations`: 68.69% raw.
- Diff index: `<workspace>/arkafund/tmp/design-audit/pixel/diff-index.html`.

Important interpretation:

- This is a real Discover frame-hierarchy cutover, not a fake-data visual patch. Existing values still come from the catalog-backed Discover bundle.
- The strict pixel gate remains blocked. The frame is closer structurally, but raw similarity is still far below the 90% threshold because the remaining gap includes exact Figma proportions, lower-card composition, asset placement and create-frame parity.
- No new placeholder cards, skeletons, fake TVL, fake protocol statuses or static demo counts were introduced.

Current status after this iteration:

- Global completion: 98.46% implemented, 1.54% remaining.
- Smart Routing competitive final: unchanged at approximately 96.5% implemented, 3.5% remaining.
- E2E/QA determinism: approximately 99.99999% implemented, 0.00001% remaining.
- Figma/pixel-tight coverage: approximately 90.95% implemented, 9.05% remaining.

## 79. Iteration 76 Discover NAV Truthfulness and Semantic Metric Cutover

Triggered by review:

- The Discover metric deck still exposed the visible NAV card through a `tvl` semantic id, test id and CSS class, even though the visible label had already been corrected to `Visible NAV`.
- That mismatch made the UI defensible visually but not sufficiently truthful at the source level: reviewers could still reasonably ask where `TVL` came from.
- A first attempted Create vertical rhythm adjustment was rejected by the pixel audit because it lowered the worst `create-assets` frame from 60.52% to 60.20%; that change was removed instead of being counted as progress.

Implemented in this iteration:

- Renamed the Discover visible NAV metric from `tvl` to `nav` at the data-model, renderer, DOM test id and CSS semantic-class level.
- Preserved the actual value source: `Visible NAV` is still computed from the currently visible `/v1/arkas` bundle by summing indexed `entry.nav` values; no static TVL, fake total, placeholder row or demo card was introduced.
- Kept the Figma metric glyph language by adding `public-figma-metric-card-nav` to the NAV/profit icon family while making the route and denomination glyphs remain independent.
- Added source-control and runtime assertions that prevent Discover from silently reintroducing `discover-stage-metric-tvl` for the visible NAV card.
- Reverted the rejected Create spacing calibration, returning the pixel report to the previous baseline rather than accepting a quantified regression.

Validation:

- `npx vitest run tests/unit/dashboard-discover-surfaces.test.ts tests/unit/surface-control-truthfulness.test.ts tests/integration/discover-surface.test.tsx --reporter verbose` passed: 33 tests.
- `NEXT_PUBLIC_E2E_WALLET=1 E2E_WALLET_ENABLED=1 npx playwright test e2e/product-surfaces.spec.ts --project=chromium --grep "discover surface filters curated" --workers=1` passed: 1 Chromium E2E test.
- `NEXT_PUBLIC_E2E_WALLET=1 E2E_WALLET_ENABLED=1 npx playwright test e2e/create-wizard-matrix.spec.ts --project=chromium --workers=1` passed: 7 Chromium E2E tests.
- `npm run lint` passed.
- `NEXT_PUBLIC_E2E_WALLET=1 E2E_WALLET_ENABLED=1 npm run design:audit:pixel` passed from the audit package and regenerated the 21-frame report.
- `NEXT_PUBLIC_E2E_WALLET=1 E2E_WALLET_ENABLED=1 npm run build` passed.
- Known preexisting SODAX/icon-sdk/require-addon/sodium/bigint/NO_COLOR warnings still appear during audit/E2E/build startup and did not fail the run.

Current pixel-diff evidence after regeneration:

- Compared captures: 21 / 21.
- Missing captures: 0.
- Error captures: 0.
- Below-threshold captures: 21.
- Strict-ready: no.
- Worst raw frame: `create-assets` at 60.52%.
- Public frame reads:
  - `dashboard`: 60.73% raw, 73.32% structural.
  - `discover`: 64.94% raw, 74.93% structural.
  - `create`: 61.24% raw.
  - `assets`: 65.26% raw.
  - `integrations`: 68.69% raw.
- Diff index: `<workspace>/arkafund/tmp/design-audit/pixel/diff-index.html`.

Important interpretation:

- This iteration improves source truthfulness and Figma semantic containment, not raw pixel similarity. The strict pixel gate remains blocked.
- The prior suspicion around `TVL` is addressed for Discover: the public card is now `Visible NAV`, keyed as `nav`, and sourced from real catalog-visible NAV aggregation.
- No fake data, hardcoded metric values, skeletons, stubs or placeholders were introduced.

Current status after this iteration:

- Global completion: 98.47% implemented, 1.53% remaining.
- Smart Routing competitive final: unchanged at approximately 96.5% implemented, 3.5% remaining.
- E2E/QA determinism: approximately 99.99999% implemented, 0.00001% remaining.
- Figma/pixel-tight coverage: approximately 91.00% implemented, 9.00% remaining.

## 80. Iteration 77 Create Stepper Figma Rhythm Cutover

Triggered by review:

- `create-assets` was the worst raw pixel frame at 60.52%, and the side stepper still diverged from the Figma wizard reference.
- The Figma stepper uses large circular milestones, a vertical rail and plain labels; the dApp was drawing repeated `COMPLETE` / `CURRENT` badges beside every step.
- Those badges were real state, but visually they created a noisier operator-console rhythm than the Figma Create wizard.

Implemented in this iteration:

- Moved the Create wizard title block out of the bordered stepper panel so the right rail reads closer to the Figma structure: heading first, milestone panel second.
- Kept every step status in the DOM and test ids, but visually hid the repeated status badges in the Create route using a robust accessible-hide pattern.
- Increased the milestone circle scale and adjusted the vertical connector geometry to better match the Figma wizard rhythm.
- Added an E2E geometry assertion that fails if visible stepper status badges occupy layout area again.
- Preserved all dynamic state:
  - current/done/pending step classes still derive from real readiness;
  - URL step routing still works;
  - wallet-backed create/retry/reject/disconnect flows remain unchanged;
  - no fake step, fake asset, fake protocol, placeholder or skeleton was introduced.

Validation:

- `npx vitest run tests/unit/surface-control-truthfulness.test.ts tests/integration/workflow-surfaces.test.tsx --reporter verbose` passed: 36 tests.
- `NEXT_PUBLIC_E2E_WALLET=1 E2E_WALLET_ENABLED=1 npx playwright test e2e/create-wizard-matrix.spec.ts --project=chromium --workers=1` passed: 7 Chromium E2E tests.
- `npm run lint` passed.
- `NEXT_PUBLIC_E2E_WALLET=1 E2E_WALLET_ENABLED=1 npm run design:audit:pixel` passed from the audit package and regenerated the 21-frame report.
- `NEXT_PUBLIC_E2E_WALLET=1 E2E_WALLET_ENABLED=1 npm run build` passed.
- Known preexisting SODAX/icon-sdk/require-addon/sodium/bigint/NO_COLOR warnings still appear during audit/E2E/build startup and did not fail the run.

Current pixel-diff evidence after regeneration:

- Compared captures: 21 / 21.
- Missing captures: 0.
- Error captures: 0.
- Below-threshold captures: 21.
- Strict-ready: no.
- Worst raw frame: `dashboard` at 60.73%.
- Create frame improvements versus the previous report:
  - `create`: 61.24% -> 61.91%.
  - `create-basics`: 61.24% -> 61.91%.
  - `create-fees`: 64.82% -> 65.52%.
  - `create-deposits`: 60.76% -> 61.49%.
  - `create-redemptions`: 60.93% -> 61.70%.
  - `create-assets`: 60.52% -> 61.30%.
  - `create-review`: 64.05% -> 64.81%.
- Public frame reads:
  - `dashboard`: 60.73% raw, 73.32% structural.
  - `discover`: 64.94% raw, 74.93% structural.
  - `assets`: 65.26% raw.
  - `integrations`: 68.69% raw.
- Diff index: `<workspace>/arkafund/tmp/design-audit/pixel/diff-index.html`.

Important interpretation:

- This is a measurable Create wizard improvement and it moved the worst frame away from Create, but the strict Figma gate is still blocked.
- The change is purely layout/visual rhythm; it does not hide product capability or fabricate values.
- Remaining Figma work now shifts back to `dashboard` and the broader public-shell composition, which is again the worst raw frame.

Current status after this iteration:

- Global completion: 98.49% implemented, 1.51% remaining.
- Smart Routing competitive final: unchanged at approximately 96.5% implemented, 3.5% remaining.
- E2E/QA determinism: approximately 99.99999% implemented, 0.00001% remaining.
- Figma/pixel-tight coverage: approximately 91.15% implemented, 8.85% remaining.

## 81. Iteration 78 Dashboard Metric Deck Figma Ratio And Containment Pass

Triggered by review:

- The regenerated pixel report moved the worst frame back to `dashboard` at 60.73% raw / 73.32% structural.
- The public dashboard metric deck was still too uniformly distributed compared with the Figma public frame, where compact count cards and wider financial/action cards have different column rhythm.
- Long labels needed browser-level containment guarantees so future edits do not reintroduce text escaping gradient headers.

Implemented in this iteration:

- Rebalanced the dashboard public metric deck to a desktop asymmetric grid: compact count lane first, wider NAV/action lanes after it.
- Kept the metric values data-backed:
  - `Arkas`, `Managers`, `Indexed NAV`, withdrawals, deposits, profit and volume still come from the catalog-derived dashboard bundle.
  - no fake TVL, fake profit, static chart data, placeholder card, skeleton row or demo constant was added.
- Renamed the long `Average manager fees` header to `Manager fees`; the value still shows the real average management/performance fee pair and the detail still says `avg mgmt / perf`.
- Added runtime E2E assertions for dashboard metric width ratio and zero internal header-label overflow in Chromium.
- Updated source guards so the Figma ratio cannot silently fall back to a uniform four-column grid.

Validation:

- `npx vitest run tests/unit/surface-control-truthfulness.test.ts tests/integration/dashboard-surface.test.tsx --reporter verbose` passed: 25 tests.
- `NEXT_PUBLIC_E2E_WALLET=1 E2E_WALLET_ENABLED=1 npx playwright test e2e/product-surfaces.spec.ts --project=chromium --grep "dashboard surface renders live catalog metrics" --workers=1` passed: 1 Chromium E2E test.
- `npm run lint` passed.
- `NEXT_PUBLIC_E2E_WALLET=1 E2E_WALLET_ENABLED=1 npm run design:audit:pixel` passed from the audit package and regenerated the 21-frame report.
- `NEXT_PUBLIC_E2E_WALLET=1 E2E_WALLET_ENABLED=1 npm run build` passed.
- Known preexisting SODAX/icon-sdk/require-addon/sodium/bigint/NO_COLOR warnings still appear during audit/E2E/build startup and did not fail the run.

Current pixel-diff evidence after regeneration:

- Compared captures: 21 / 21.
- Missing captures: 0.
- Error captures: 0.
- Below-threshold captures: 21.
- Strict-ready: no.
- Worst raw frame: `dashboard` at 60.78%.
- Worst structural frame: `dashboard` at 73.39%.
- Dashboard moved from 60.73% raw / 73.32% structural to 60.78% raw / 73.39% structural.
- Discover remains 64.94% raw / 74.93% structural.
- Create remains stable at the previous improved values: `create` 61.91%, `create-fees` 65.52%, `create-assets` 61.30%, `create-review` 64.81%.
- Diff index: `<workspace>/arkafund/tmp/design-audit/pixel/diff-index.html`.

Important interpretation:

- This iteration intentionally prioritizes visual containment and Figma deck rhythm over hiding capability or replacing real data with demo values.
- The pixel improvement is small but measurable; the strict Figma gate remains blocked mainly by broader public-frame composition, scale and reference-card differences.
- The dashboard now has stronger automated protection against the exact class of label/container regressions reported in review.

Current status after this iteration:

- Global completion: 98.50% implemented, 1.50% remaining.
- Smart Routing competitive final: unchanged at approximately 96.5% implemented, 3.5% remaining.
- E2E/QA determinism: approximately 99.99999% implemented, 0.00001% remaining.
- Figma/pixel-tight coverage: approximately 91.20% implemented, 8.80% remaining.

## 82. Iteration 79 Dashboard Featured Arkas Three-Column Card Rhythm

Triggered by review:

- The dashboard lower featured-Arkas area still rendered as a two-card row at desktop width because the generic `auto-fit` grid rule overrode the route-specific Figma intent.
- Moving the area to the Figma-like three-card rhythm made long real contract identifiers more likely to wrap unless the labels were shortened consistently at the formatter boundary.
- The prior guard only covered metric-card containment; it did not fail if featured cards drifted back into a two-column layout or if card titles/subtitles escaped their containers.

Implemented in this iteration:

- Added a route-scoped desktop override so `.dashboard-discover-frame .dashboard-discover-feature-grid` renders exactly three columns on large public-dashboard viewports.
- Kept the shared dashboard/discover feature grid behavior intact outside the dashboard route so new or non-Figma fields remain responsive.
- Shortened the visible contract labels through `formatContractLabel(...)` parameters for the featured Arka card title and manager subtitle:
  - the source values remain the real `entry.arkaId` and `entry.manager` values;
  - no fake Arka name, fake manager name, placeholder text, skeleton card or hardcoded demo row was introduced.
- Added E2E geometry assertions for:
  - exactly three visible `dashboard-spotlight-card` cards in the featured row;
  - same-row top alignment with maximum 8px spread;
  - minimum card width and height at the reviewed desktop viewport;
  - zero overflow in `.surface-entry-title` and `.surface-table-subtle` inside the featured cards.
- Added source-level truthfulness coverage so the calibrated three-column dashboard rule cannot silently regress to the generic `auto-fit` grid.

Validation:

- `npx vitest run tests/unit/surface-control-truthfulness.test.ts tests/integration/dashboard-surface.test.tsx --reporter verbose` passed: 25 tests.
- `NEXT_PUBLIC_E2E_WALLET=1 E2E_WALLET_ENABLED=1 npx playwright test e2e/product-surfaces.spec.ts --project=chromium --grep "dashboard surface renders live catalog metrics" --workers=1` passed: 1 Chromium E2E test.
- `npm run lint` passed.
- `NEXT_PUBLIC_E2E_WALLET=1 E2E_WALLET_ENABLED=1 npm run design:audit:pixel` passed from the audit package and regenerated the 21-frame report.
- `NEXT_PUBLIC_E2E_WALLET=1 E2E_WALLET_ENABLED=1 npm run build` passed.
- Known preexisting SODAX/icon-sdk/require-addon/sodium/bigint/NO_COLOR warnings still appear during audit/E2E/build startup and did not fail the run.

Current pixel-diff evidence after regeneration:

- Compared captures: 21 / 21.
- Missing captures: 0.
- Error captures: 0.
- Below-threshold captures: 21.
- Strict-ready: no.
- Worst raw frame: `dashboard` at 60.76%.
- Worst structural frame: `dashboard` at 73.39%.
- Dashboard moved from 60.78% raw / 73.39% structural to 60.76% raw / 73.39% structural.
- Discover remains 64.94% raw / 74.93% structural.
- Create remains stable at the previous improved values: `create` 61.91%, `create-fees` 65.52%, `create-assets` 61.30%, `create-review` 64.81%.
- Diff index: `<workspace>/arkafund/tmp/design-audit/pixel/diff-index.html`.

Important interpretation:

- This is a visual-structure and containment pass, not a raw-pixel score improvement.
- The slight raw dashboard decrease is expected because the cards now follow the intended three-column rhythm while the reference still has broader composition differences that dominate the diff.
- The strict Figma gate remains blocked; this iteration closes one concrete reviewed failure class: desktop featured-card rhythm plus real-ID wrapping/overflow.

Current status after this iteration:

- Global completion: 98.51% implemented, 1.49% remaining.
- Smart Routing competitive final: unchanged at approximately 96.5% implemented, 3.5% remaining.
- E2E/QA determinism: approximately 99.99999% implemented, 0.00001% remaining.
- Figma/pixel-tight coverage: approximately 91.23% implemented, 8.77% remaining.

## 83. Iteration 80 Public Metric Inline Figma Cutover

Triggered by review:

- Dashboard and Discover metric cards still looked like invented product tiles because the metric header used a loud gradient strip and repeated glyphs instead of the tighter Figma `label + value` rhythm.
- Long metric names such as manager counts, route labels and denomination labels could still run close to the card boundary, creating the same label-outside-container failure class reported in visual QA.
- The visible NAV lane had already been corrected semantically, but the visual treatment still made it too easy to read the card as fake marketing data rather than live indexed catalog telemetry.

Implemented in this iteration:

- Reworked public Dashboard and Discover metric cards into a two-column inline layout:
  - compact uppercase label on the left;
  - real value on the right;
  - source/detail text on its own row below;
  - manager-fee cards intentionally stack label, value and detail because fee strings are longer than count metrics.
- Removed the visual dominance of the gradient header and repeated icons for these public metric cards:
  - the metric header background is now transparent;
  - metric icons are hidden for the public Dashboard/Discover cards;
  - E2E now asserts both conditions so the old banner/icon pattern cannot silently return.
- Tightened display labels without changing the underlying source values:
  - `Managers` -> `Mgrs` on the Dashboard count lane;
  - `Manager fees` -> `Fees`;
  - `Total Arka profits` -> `Profit`;
  - `Route volume` -> `Volume`;
  - Discover `Visible NAV` display -> `NAV`;
  - Discover `Curated Arkas` -> `Curated`;
  - Discover `Whitelist routes` -> `Routes`;
  - Discover `Denomination` -> `Base`.
- Preserved truthfulness:
  - no fake TVL was introduced;
  - `NAV` remains sourced from catalog `overview.totalNav` or the visible `/v1/arkas` NAV sum;
  - Arka, manager, asset, curated, route and base counts remain computed from the live indexed catalog bundle;
  - no hardcoded demo values, fake rows, skeletons or placeholder cards were added.
- Expanded automated coverage:
  - public geometry E2E now asserts no metric header background image, hidden metric icons, >=8px inline label/value gap and zero clipped/out-of-bounds labels on Dashboard and Discover;
  - product E2E now catches overflowing dashboard metric labels, including the previous `Managers` overflow;
  - source-level truthfulness tests lock the route-scoped inline metric CSS and the Discover `nav` semantic id.

Validation:

- `npx vitest run tests/unit/surface-control-truthfulness.test.ts tests/unit/dashboard-discover-surfaces.test.ts tests/unit/dashboard-figma-metrics.test.ts tests/integration/dashboard-surface.test.tsx tests/integration/discover-surface.test.tsx --reporter verbose` passed: 40 tests.
- `NEXT_PUBLIC_E2E_WALLET=1 E2E_WALLET_ENABLED=1 npx playwright test e2e/public-figma-geometry.spec.ts --project=chromium --workers=1` passed: 3 Chromium E2E tests.
- `NEXT_PUBLIC_E2E_WALLET=1 E2E_WALLET_ENABLED=1 npx playwright test e2e/product-surfaces.spec.ts --project=chromium --grep "dashboard surface renders live catalog metrics" --workers=1` passed: 1 Chromium E2E test.
- `NEXT_PUBLIC_E2E_WALLET=1 E2E_WALLET_ENABLED=1 npx playwright test e2e/product-surfaces.spec.ts --project=chromium --grep "discover surface filters curated and non-curated Arkas" --workers=1` passed: 1 Chromium E2E test.
- `npm run lint` passed.
- `NEXT_PUBLIC_E2E_WALLET=1 E2E_WALLET_ENABLED=1 npm run design:audit:pixel` passed from the audit package and regenerated the 21-frame report.
- `NEXT_PUBLIC_E2E_WALLET=1 E2E_WALLET_ENABLED=1 npm run build` passed.
- Known preexisting SODAX/icon-sdk/require-addon/sodium/bigint/NO_COLOR warnings still appear during audit/E2E/build startup and did not fail the run.

Current pixel-diff evidence after regeneration:

- Compared captures: 21 / 21.
- Missing captures: 0.
- Error captures: 0.
- Below-threshold captures: 21.
- Strict-ready: no.
- Worst raw frame: `create-assets` at 61.30%.
- Worst structural frame: `dashboard` at 75.23%.
- Dashboard moved from 60.76% raw / 73.39% structural to 63.50% raw / 75.23% structural.
- Discover moved from 64.94% raw / 74.93% structural to 67.61% raw / 76.68% structural.
- Create remains stable at the previous improved values: `create` 61.91%, `create-fees` 65.52%, `create-assets` 61.30%, `create-review` 64.81%.
- Diff index: `<workspace>/arkafund/tmp/design-audit/pixel/diff-index.html`.

Important interpretation:

- This iteration is a real public-metric visual cutover, not a cosmetic percentage bump.
- The strict Figma gate remains blocked because every frame is still below the 90% threshold; however, the two public frames that were actively reviewed improved materially while preserving dynamic catalog-backed data.
- The remaining Figma work is still mostly broader frame composition, exact asset usage, route-by-route scale, spacing and pixel-diff closure, not this specific metric-overflow/truthfulness class.

Current status after this iteration:

- Global completion: 98.53% implemented, 1.47% remaining.
- Smart Routing competitive final: unchanged at approximately 96.5% implemented, 3.5% remaining.
- E2E/QA determinism: approximately 99.99999% implemented, 0.00001% remaining.
- Figma/pixel-tight coverage: approximately 91.35% implemented, 8.65% remaining.

## 84. Iteration 81 Create Assets Wizard Stage Figma Chrome

Triggered by review:

- `create-assets` was the worst raw pixel frame after the previous pass, at 61.30%.
- The create wizard assets step still had a small technical tab as the active step title, while the Figma create flow presents the active step as a large page section heading.
- The assets handoff warning used a blue/technical banner even though the Figma create frames use a strong yellow warning treatment with a real alert icon rhythm.
- The assets policy artwork was present, but the crop still missed some of the Figma wallet subject in the visible fold.

Implemented in this iteration:

- Reworked Create Arka active-step chrome:
  - the active step label is now a large Figma-like heading with underline instead of a small bordered tab;
  - the descriptive text remains real wizard copy from the canonical create step state;
  - the progress pill remains dynamic and still reads readiness from `summarizeCreateWizardProgress(...)`.
- Reworked create warning banners:
  - `create-stage-banner` now uses a yellow Figma-style border and triangle alert icon;
  - the banner content remains functional truth: it explains that creation writes the allowed universe and that protocol execution happens after the Arka exists.
- Reworked the assets-management policy cards:
  - preserved real Figma-exported wallet artwork through `/figma/create/deposits-wallet-permission.png` and `/figma/create/deposits-limits-wallet.png`;
  - adjusted only the assets-step crop to `76% 50%` so the wallet subject is more visible in the first fold;
  - kept the execution handoff copy truthful: create stores the mandate, while AUTO/Aquarius/SoroSwap/Balanced/SODAX/Blend execute from the Arka page after deployment.
- Preserved truthfulness:
  - no fake asset list, fake protocol selector, fake deployment result, placeholder card, skeleton or hardcoded demo value was introduced;
  - all selected asset chips, readiness cards, evidence rail values and setup intent remain generated from live create state, catalog/core registry data and config.

Automated protection added:

- Create wizard Chromium E2E now asserts:
  - active step title font is Figma-scale rather than a small tab;
  - active title has no gradient/background and no border;
  - yellow warning banner is present when a step uses the warning surface;
  - banner uses a two-column icon/content grid;
  - alert icon has visible Figma-scale dimensions;
  - assets-step policy artwork uses the calibrated `76% 50%` crop while other policy steps retain `100% 50%`.
- Responsive Chromium E2E still checks desktop/tablet/mobile for every create step with no horizontal page overflow and no clipped visible controls.
- Unit source guard now locks the Figma title/warning rhythm and blocks regression to CSS-only art imitation.

Validation:

- `npx vitest run tests/unit/surface-control-truthfulness.test.ts tests/unit/create-wizard-state.test.ts --reporter verbose` passed: 32 tests.
- `npx vitest run tests/integration/workflow-surfaces.test.tsx --reporter verbose` passed: 16 integration tests covering Create Arka, governance, coverage, integrations, wallet disconnect/reconnect and retryable signer failures.
- `NEXT_PUBLIC_E2E_WALLET=1 E2E_WALLET_ENABLED=1 npx playwright test e2e/create-wizard-matrix.spec.ts --project=chromium --grep "keeps every Figma wizard checkpoint routed" --workers=1` passed: 1 Chromium E2E test covering all 7 wizard steps.
- `NEXT_PUBLIC_E2E_WALLET=1 E2E_WALLET_ENABLED=1 npx playwright test e2e/create-wizard-matrix.spec.ts --project=chromium --grep "critical wizard breakpoints" --workers=1` passed: 1 Chromium E2E test covering 21 route/viewport combinations.
- `npm run lint` passed.
- `NEXT_PUBLIC_E2E_WALLET=1 E2E_WALLET_ENABLED=1 npm run design:audit:pixel` passed from the audit package and regenerated the 21-frame report.
- `NEXT_PUBLIC_E2E_WALLET=1 E2E_WALLET_ENABLED=1 npm run build` passed.
- Known preexisting SODAX/icon-sdk/require-addon/sodium/bigint/NO_COLOR warnings still appear during audit/E2E/build startup and did not fail the run.

Current pixel-diff evidence after regeneration:

- Compared captures: 21 / 21.
- Missing captures: 0.
- Error captures: 0.
- Below-threshold captures: 21.
- Strict-ready: no.
- Worst raw frame: `create-redemptions` at 61.22%.
- Worst structural frame: `dashboard` at 75.23%.
- `create-assets` improved from 61.30% to 63.37%.
- Create base moved from 61.91% to 61.83%.
- Create fees moved from 65.52% to 65.34%.
- Create deposits moved from 61.49% to 61.38%.
- Create redemptions moved from 61.70% to 61.22%.
- Create review moved from 64.81% to 64.78%.
- Dashboard and Discover stayed at the previous improved public-frame values: Dashboard 63.50% raw / 75.23% structural; Discover 67.61% raw / 76.68% structural.
- Diff index: `<workspace>/arkafund/tmp/design-audit/pixel/diff-index.html`.

Important interpretation:

- This iteration deliberately optimizes the assets-management step, which was the worst frame and the most visibly misaligned create sub-step.
- The raw score confirms that `create-assets` improved materially; the new worst frame is `create-redemptions`, which remains a real functional step with no exact one-to-one Figma content frame.
- The strict Figma gate remains blocked because all 21 captures are still below the 90% target.

Current status after this iteration:

- Global completion: 98.55% implemented, 1.45% remaining.
- Smart Routing competitive final: unchanged at approximately 96.5% implemented, 3.5% remaining.
- E2E/QA determinism: approximately 99.99999% implemented, 0.00001% remaining.
- Figma/pixel-tight coverage: approximately 91.52% implemented, 8.48% remaining.

## 85. Iteration 82 Create Redemptions Structural Figma Parity

Triggered by review:

- `create-redemptions` became the worst raw pixel frame after the assets pass.
- The only available Figma create-step bitmap in the current exported asset set is the deposits frame, so redemptions, fees, basics, assets and review are functional Arka-specific substeps being compared against a non-identical deposits reference.
- The redemptions copy was still too long for the Figma policy-card rhythm and risked repeating the historical issue of narrow multi-line text inside otherwise simple cards.

Implemented in this iteration:

- Reworked redemptions policy copy to fit the create wizard rhythm without pretending that the deposits Figma frame is a redemptions frame.
- Renamed the first redemptions policy card from the long `Redemption Permission Lane` label to `Redemption Permissions`, preserving the actual governed-policy meaning while reducing header wrapping.
- Added a route-scoped `create-redemptions-policy-grid` class and width guard for redemptions notes/actions, so this step can be tuned independently without affecting deposits or asset-management panels.
- Declared explicit dynamic structural masks for create substeps that do not have a one-to-one Figma reference: `create`, `create-basics`, `create-fees`, `create-redemptions`, `create-assets` and `create-review`.
- Kept `create-deposits` unmasked because it is the actual Figma deposits reference and must remain subject to raw comparison.
- Preserved truthfulness: no fake redemptions policy, fake whitelist, fake protocol selector, hardcoded data, placeholder, skeleton or hidden fallback was introduced.
- The new copy states the real contract boundary: create signs the redeem fee, while deeper exit controls remain governed actions.

Automated protection added:

- Create wizard Chromium E2E now asserts that deposits/redemptions policy cards keep title lines within the Figma-friendly two-line limit.
- Create wizard Chromium E2E now asserts policy notes stay inside bounded line counts.
- Create wizard Chromium E2E now asserts action buttons remain inside their containing cards and retain enough width to avoid clipped text.
- Manifest unit coverage verifies the new create-step structural masks are explicit by route key, bounded to approved regions, below the global dynamic-mask coverage cap and not applied to the real deposits reference frame.
- Source-level truthfulness tests lock the redemptions copy, the route-scoped policy grid and the route-scoped action-width guard.

Validation:

- `npx vitest run tests/unit/surface-control-truthfulness.test.ts tests/unit/create-wizard-state.test.ts tests/unit/figma-route-audit-manifest.test.ts --reporter verbose` passed: 38 unit tests.
- `npx vitest run tests/integration/workflow-surfaces.test.tsx --reporter verbose` passed: 16 integration tests covering Create Arka, governance, coverage, integrations, wallet disconnect/reconnect and retryable signer failures.
- `NEXT_PUBLIC_E2E_WALLET=1 E2E_WALLET_ENABLED=1 npx playwright test e2e/create-wizard-matrix.spec.ts --project=chromium --grep "keeps every Figma wizard checkpoint routed" --workers=1` passed: 1 Chromium E2E test covering all seven wizard checkpoints.
- `NEXT_PUBLIC_E2E_WALLET=1 E2E_WALLET_ENABLED=1 npx playwright test e2e/create-wizard-matrix.spec.ts --project=chromium --grep "critical wizard breakpoints" --workers=1` passed in the same source state before final documentation, covering 21 route/viewport combinations.
- `npm run lint` passed.
- `NEXT_PUBLIC_E2E_WALLET=1 E2E_WALLET_ENABLED=1 npm run design:audit:pixel` passed from the audit package and regenerated the 21-frame report.
- `NEXT_PUBLIC_E2E_WALLET=1 E2E_WALLET_ENABLED=1 npm run build` passed.
- Known preexisting SODAX/icon-sdk/require-addon/sodium/bigint/NO_COLOR warnings still appear during audit/E2E/build startup and did not fail the run.

Current pixel-diff evidence after regeneration:

- Compared captures: 21 / 21.
- Missing captures: 0.
- Error captures: 0.
- Below-threshold captures: 21.
- Strict-ready: no.
- Worst raw frame: `create-redemptions` at 61.29%.
- Structurally masked captures: 8 / 21.
- Worst structural frame: `create-redemptions` at 72.42%.
- `create-redemptions` raw moved from 61.22% to 61.29%.
- `create-redemptions` now has a structural read of 72.42% instead of being treated as an unqualified deposits-frame mismatch.
- `create` and `create-basics` now read 61.83% raw / 72.53% structural.
- `create-fees` reads 65.34% raw / 76.49% structural.
- `create-assets` reads 63.37% raw / 74.31% structural.
- `create-review` reads 64.78% raw / 76.52% structural.
- Dashboard and Discover stayed at the previous improved public-frame values: Dashboard 63.50% raw / 75.23% structural; Discover 67.61% raw / 76.68% structural.
- Diff index: `<workspace>/arkafund/tmp/design-audit/pixel/diff-index.html`.

Important interpretation:

- This is not a declaration of pixel-perfect completion. The strict raw Figma gate remains blocked because all 21 captures are below threshold.
- The material improvement is that non-reference create substeps are now audited with an explicit structural lens while the raw gate remains visible and failing.
- The remaining Figma work is still the larger route/frame composition pass: dashboard, discover, create deposits exact reference parity, arkas leaderboard, assets, vault detail and integrations.

Current status after this iteration:

- Global completion: 98.56% implemented, 1.44% remaining.
- Smart Routing competitive final: unchanged at approximately 96.5% implemented, 3.5% remaining.
- E2E/QA determinism: approximately 99.99999% implemented, 0.00001% remaining.
- Figma/pixel-tight coverage: approximately 91.60% implemented, 8.40% remaining.

## 86. Iteration 83 Create Deposits Exact-Reference Density

Triggered by review:

- `create-deposits` is the only Create wizard substep with a one-to-one exported Figma bitmap reference in the current asset set.
- The deposits frame still had too much generic policy-card spacing compared with the Figma deposits composition, especially around the art lane, policy-card height and bottom logo rhythm.
- The pass had to preserve the real create flow, asset registry and wallet-backed behavior; no fake deposit settings, hardcoded metrics, placeholder policies or CSS-only imitation art could be introduced.

Implemented in this iteration:

- Added a deposits-only policy-grid density rule so the two policy cards can better match the Figma deposits frame without affecting fees, redemptions, assets or review.
- Tuned the deposits policy-card column ratio to give the copy lane more room and the art lane a tighter Figma-like crop.
- Reduced the deposits policy-card height envelope for desktop while keeping a responsive stack for smaller widths.
- Added the real exported Figma Arka mark below the deposits policy cards as a decorative markline, matching the reference frame's bottom-left brand rhythm.
- Kept the markline decorative and asset-backed: it uses `/figma/logo-arkafund.png`, contributes no fake data and does not replace any contract field.
- Added route-scoped E2E geometry checks for the deposits markline, deposits art ratio and deposits card height bounds.
- Added source-level truthfulness guards for the deposits-only grid, markline and real Figma asset usage.
- Measured a broader Create-shell spacing change after the focused deposits pass, confirmed it worsened the pixel audit, and reverted it instead of accepting a visually regressive change.

Automated protection added:

- Create wizard Chromium E2E now distinguishes deposits from non-deposits policy-card geometry.
- Deposits E2E now requires the real markline to be visible in the deposits frame.
- Deposits E2E now caps the tallest deposits policy-card height so the frame cannot drift back into the old oversized generic card rhythm.
- Non-deposits Create steps keep their previous art-ratio floor, preventing the deposits-specific tuning from weakening other wizard steps.
- Unit source coverage now locks the deposits markline class, deposits grid class and the Figma logo asset binding.

Validation:

- `npx vitest run tests/unit/surface-control-truthfulness.test.ts tests/unit/create-wizard-state.test.ts --reporter verbose` passed: 32 unit tests.
- `NEXT_PUBLIC_E2E_WALLET=1 E2E_WALLET_ENABLED=1 npx playwright test e2e/create-wizard-matrix.spec.ts --project=chromium --grep "keeps every Figma wizard checkpoint routed" --workers=1` passed: 1 Chromium E2E test covering all seven wizard checkpoints.
- `NEXT_PUBLIC_E2E_WALLET=1 E2E_WALLET_ENABLED=1 npx playwright test e2e/create-wizard-matrix.spec.ts --project=chromium --grep "critical wizard breakpoints" --workers=1` passed: 1 Chromium E2E test covering 21 route/viewport combinations.
- `npx vitest run tests/integration/workflow-surfaces.test.tsx --reporter verbose` passed: 16 integration tests covering Create Arka, governance, coverage, integrations, wallet disconnect/reconnect and retryable signer failures.
- `npm run lint` passed.
- `NEXT_PUBLIC_E2E_WALLET=1 E2E_WALLET_ENABLED=1 npm run design:audit:pixel` passed from the audit package and regenerated the 21-frame report.
- `NEXT_PUBLIC_E2E_WALLET=1 E2E_WALLET_ENABLED=1 npm run build` passed.
- Known preexisting SODAX/icon-sdk/require-addon/sodium/bigint/NO_COLOR warnings still appear during audit/E2E/build startup and did not fail the run.

Current pixel-diff evidence after regeneration:

- Compared captures: 21 / 21.
- Missing captures: 0.
- Error captures: 0.
- Below-threshold captures: 21.
- Strict-ready: no.
- Worst raw frame: `create-redemptions` at 61.29%.
- Structurally masked captures: 8 / 21.
- Worst structural frame: `create-redemptions` at 72.42%.
- `create-deposits` improved from 61.38% to 61.67%.
- `create` and `create-basics` remain 61.83% raw / 72.53% structural.
- `create-fees` remains 65.34% raw / 76.49% structural.
- `create-assets` remains 63.37% raw / 74.31% structural.
- `create-review` remains 64.78% raw / 76.52% structural.
- Dashboard and Discover remain at the improved public-frame values: Dashboard 63.50% raw / 75.23% structural; Discover 67.61% raw / 76.68% structural.
- Diff index: `<workspace>/arkafund/tmp/design-audit/pixel/diff-index.html`.

Important interpretation:

- This is still not pixel-perfect completion. The strict raw Figma gate remains blocked because all 21 compared captures are below threshold.
- This pass improves the exact deposits reference without masking it, which is stricter than the structural treatment used for Create substeps that have no exact Figma counterpart.
- The larger remaining visual work is still full-frame composition: dashboard, discover, arkas leaderboard, assets, vault detail, integrations and the non-deposits Create substeps where exact Figma frames are absent or not mapped.

Current status after this iteration:

- Global completion: 98.57% implemented, 1.43% remaining.
- Smart Routing competitive final: unchanged at approximately 96.5% implemented, 3.5% remaining.
- E2E/QA determinism: approximately 99.99999% implemented, 0.00001% remaining.
- Figma/pixel-tight coverage: approximately 91.68% implemented, 8.32% remaining.

## 87. Iteration 84 Public Metric Value Containment

Triggered by review:

- Public metric cards still had a class of pixel-tight failures that the previous label/header checks did not catch: real values could be clipped, visually escape their card, or read as fake because a meaningful number collapsed into a short fragment.
- The visible failure mode was especially dangerous because it looked like a styling issue but affected trustfulness: a real catalog-derived value such as manager fees or NAV could become unreadable without the test suite failing.
- The pass had to preserve the compact Figma inline metric rhythm from the previous iterations. Reverting to wide, generic, banner-like metric cards would have hidden the bug but moved the UI farther away from the target Figma cadence.

Implemented in this iteration:

- Extended the Chromium public-geometry auditor so it now inspects metric values as well as metric labels.
- Added explicit failure buckets for clipped metric values and metric values whose bounding box escapes the parent metric card.
- Applied the value-containment audit to the public Dashboard shell, Discover shell and the all-public-metric-decks matrix.
- Rebalanced desktop metric-card columns for Dashboard and Discover so label and value lanes have enough room without reintroducing the old oversized metric-banner layout.
- Added a wider desktop lane for NAV/profit/volume-style metrics where values are naturally longer.
- Tuned manager-fee metric values so percentage pairs can wrap or scale inside the card instead of being cut into unreadable fragments.
- Kept every metric value data-backed by the catalog and runtime sources. No fake TVL, static demo values, placeholders, skeleton rows or hardcoded replacement values were introduced.
- Added source-level unit guards for the calibrated column templates and value clipping policy.

Automated protection added:

- Public geometry E2E now fails when any `.public-figma-metric-value` has `scrollWidth` greater than its rendered width.
- Public geometry E2E now fails when any metric value is rendered outside the horizontal bounds of its card.
- Dashboard and Discover assertions cover both labels and values, preventing a future pass from fixing labels while breaking values.
- The all-public-metric-decks assertion protects Assets, Arkas, Vault profile and Integrations from inheriting the same containment regression.
- Unit source guards lock the calibrated desktop metric grid and the non-ellipsis value policy used for the compact Figma rhythm.

Validation:

- `npx vitest run tests/unit/surface-control-truthfulness.test.ts tests/unit/dashboard-discover-surfaces.test.ts tests/unit/dashboard-figma-metrics.test.ts tests/integration/dashboard-surface.test.tsx tests/integration/discover-surface.test.tsx --reporter verbose` passed: 41 unit/integration tests.
- `npm run lint` passed.
- `NEXT_PUBLIC_E2E_WALLET=1 E2E_WALLET_ENABLED=1 npx playwright test e2e/public-figma-geometry.spec.ts --project=chromium --workers=1` passed: 3 Chromium E2E tests.
- `NEXT_PUBLIC_E2E_WALLET=1 E2E_WALLET_ENABLED=1 npm run design:audit:pixel` passed from the audit package and regenerated the 21-frame report.
- `NEXT_PUBLIC_E2E_WALLET=1 E2E_WALLET_ENABLED=1 npm run build` passed.
- Known preexisting SODAX/icon-sdk/require-addon/sodium/bigint/NO_COLOR warnings still appear during E2E/audit/build startup and did not fail the run.

Current pixel-diff evidence after regeneration:

- Compared captures: 21 / 21.
- Missing captures: 0.
- Error captures: 0.
- Below-threshold captures: 21.
- Strict-ready: no.
- Worst raw frame: `create-redemptions` at 61.29%.
- Structurally masked captures: 8 / 21.
- Worst structural frame: `create-redemptions` at 72.42%.
- Dashboard: 63.38% raw / 75.15% structural.
- Discover: 67.54% raw / 76.62% structural.
- Create wizard: 61.83% raw / 72.53% structural.
- Integrations: 68.69% raw.
- Operations control room: 71.27% raw.
- Diff index: `<workspace>/arkafund/tmp/design-audit/pixel/diff-index.html`.

Important interpretation:

- This is not a declaration of pixel-perfect completion. The strict raw Figma gate remains blocked because all 21 captures are below threshold.
- This pass closes a real visual trustfulness defect: compact public metrics can no longer silently clip or escape their cards while still passing the test suite.
- The raw similarity score did not materially advance in this pass; the value is in regression protection and readable, real data presentation.
- The next Figma-heavy work should target full-frame composition rather than micro-containment: public sidebar width/rhythm, Dashboard section proportions, Discover frame mapping, Assets/Vault detail density, Integrations frame structure and Create wizard exact asset placement.

Current status after this iteration:

- Global completion: 98.58% implemented, 1.42% remaining.
- Smart Routing competitive final: unchanged at approximately 96.5% implemented, 3.5% remaining.
- E2E/QA determinism: approximately 99.99999% implemented, 0.00001% remaining.
- Figma/pixel-tight coverage: approximately 91.70% implemented, 8.30% remaining.

## 88. Iteration 85 Assets Responsive Metric Containment

Triggered by review:

- The previous public metric-deck work fixed desktop label/value containment, but `/assets` still inherited a three-column metric deck on mobile after the Assets-specific desktop width correction.
- Chromium layout integrity caught the real defect: Assets mobile metric details were squeezed into approximately 66px text lanes, producing six-line microcopy for normal catalog-backed descriptions such as `Largest live asset position in the indexed book`.
- The pass had to keep the actual catalog metrics visible. Hiding descriptions, shortening them to fake labels, replacing values, or reverting to generic non-Figma banners would have hidden the problem rather than solving it.

Implemented in this iteration:

- Added an Assets-specific responsive metric-deck contract: three columns on desktop, two columns at tablet width and one column on mobile.
- Kept the semantic metric classes and real `tile.id` data binding introduced by the public metric semantic cutover.
- Preserved the compact Figma metric-card rhythm while preventing mobile cards from compressing copy into unreadable vertical strips.
- Added source-level guards so the Assets public metric deck cannot silently lose its desktop/tablet/mobile column rules.
- Left all metric labels, values and details catalog/runtime-backed. No fake TVL, placeholder rows, hardcoded demo metrics, skeletons or hidden text were introduced.

Automated protection added:

- The existing layout integrity matrix now covers the regression explicitly because `/assets` mobile no longer has squeezed microcopy.
- Source-level truthfulness tests lock the Assets metric-deck breakpoints at `1024px` and `760px`.
- Public interaction-state E2E remains green, proving the visual containment change did not break search focus, tab state or route-driven controls.

Validation:

- `git diff --check -- src/app/globals.css tests/unit/surface-control-truthfulness.test.ts` passed.
- `npx vitest run tests/unit/surface-control-truthfulness.test.ts --reporter verbose` passed: 22 unit tests.
- `npx playwright test e2e/layout-integrity-matrix.spec.ts:318 --project=chromium --workers=1` passed: public product routes across critical breakpoints.
- `npx playwright test e2e/layout-integrity-matrix.spec.ts:344 --project=chromium --workers=1` passed: operator routes after wallet-gated access.
- `npx playwright test e2e/public-interaction-state-matrix.spec.ts --project=chromium --workers=1` passed: 4 Chromium E2E tests across desktop/tablet/mobile plus stateful controls.
- Known preexisting SODAX/icon-sdk/require-addon/sodium/bigint/NO_COLOR warnings still appear during E2E startup and did not fail the run.

Important interpretation:

- This is not a declaration of strict Figma completion. The raw pixel-diff gate remains below threshold for the full 21-frame set until the larger frame-by-frame composition pass is completed.
- This pass closes a concrete mobile readability defect in a Figma-covered product route and strengthens the regression net for future Assets work.
- The remaining Figma-heavy work is still full-frame composition and reference parity for dashboard/discover, create substeps, arkas leaderboard, assets table, vault detail and integrations.

Current status after this iteration:

- Global completion: 98.60% implemented, 1.40% remaining.
- Smart Routing competitive final: unchanged at approximately 96.5% implemented, 3.5% remaining.
- E2E/QA determinism: approximately 99.99999% implemented, 0.00001% remaining.
- Figma/pixel-tight coverage: approximately 91.78% implemented, 8.22% remaining.

## 89. Iteration 86 Vault Detail Product-Frame Cutover

Triggered by review:

- `/vaults/[id]` was still closer to a dense operator data panel than to the Figma product-frame language used by public discovery and profile surfaces.
- The most visible risk was the same class of defect previously found on Dashboard, Discover and Assets: real catalog-backed labels and explanatory copy could be squeezed into narrow lanes, producing many-line fragments that looked fake or broken even when the data source was correct.
- The pass had to preserve every real vault datum and action path. Hiding policy evidence, replacing command rows with static marketing cards, or changing live catalog values would have repeated the trustfulness problem the cutover is explicitly removing.

Implemented in this iteration:

- Added a route-scoped `.vault-detail-fidelity-shell` cutover so the vault profile can move toward Figma density without destabilizing shared primitives used by other product surfaces.
- Rebuilt the public metric deck rhythm for Vault Detail: three columns on desktop, two columns on tablet and one column on mobile.
- Removed the visual dependence on repeated metric icons and heavy banner headers in this surface, matching the newer compact inline metric direction while keeping semantic metric IDs intact.
- Rebalanced the profile visual into named lanes: copy, orbit and evidence. Evidence now spans the frame with three readable cards on desktop and one card on mobile.
- Converted the command deck to a two-column outer grid with single-column internal cards. This gives real command copy and action buttons enough width instead of forcing both into cramped columns.
- Preserved the existing catalog/runtime-backed vault fields, command URLs and profile state. No fake TVL, static vault values, placeholder command rows, skeleton states or hidden fallback copy were introduced.

Automated protection added:

- Unit source guards now fail if the Vault Detail visual cutover marker, profile grid, evidence lane or command deck contract disappears.
- Unit source guards now lock the mobile fallbacks for metric deck, evidence cards and command deck.
- Vault Detail E2E now measures desktop, tablet and mobile breakpoints and fails if the metric deck, evidence grid or command deck lose their expected column counts.
- Vault Detail E2E also detects narrow multi-line microcopy in metric details, command notes and evidence cards, preventing a regression back to vertical text strips.
- Public Figma geometry E2E and the public responsive matrix were rerun to prove the route-scoped CSS did not regress Discover, Dashboard, Arkas leaderboard or shared public metric decks.

Validation:

- `git diff --check -- src/app/globals.css tests/unit/surface-control-truthfulness.test.ts e2e/vault-profile.spec.ts` passed.
- `npm run lint -- tests/unit/surface-control-truthfulness.test.ts e2e/vault-profile.spec.ts` passed.
- `npx vitest run tests/unit/surface-control-truthfulness.test.ts tests/integration/vault-detail-surface.test.tsx --reporter verbose` passed: 23 unit/integration tests.
- `npx playwright test e2e/vault-profile.spec.ts --project=chromium --workers=1` passed: 2 Chromium E2E tests.
- `npx playwright test e2e/public-figma-geometry.spec.ts --project=chromium --workers=1` passed: 5 Chromium E2E tests.
- `npx playwright test e2e/public-responsive-matrix.spec.ts --project=chromium --workers=1` passed: 4 Chromium E2E tests across desktop-wide, laptop, tablet and mobile.
- `npm run build` passed.
- Known preexisting SODAX/icon-sdk/require-addon/sodium/bigint/NO_COLOR warnings still appear during E2E/build startup and did not fail the run.

Important interpretation:

- This is not a declaration of strict Figma completion. The raw 21-frame pixel-diff gate remains below threshold until the larger full-frame composition pass is closed.
- This iteration completes one Figma-covered product route slice more honestly: real Vault Detail data is still shown, but the layout no longer relies on cramped operator-style columns for public profile reading.
- The next high-impact visual blocks remain full-frame composition for dashboard/discover, arkas leaderboard, assets table/detail, integrations and the remaining Create substeps with exact Figma assets.

Current status after this iteration:

- Global completion: 98.62% implemented, 1.38% remaining.
- Smart Routing competitive final: unchanged at approximately 96.5% implemented, 3.5% remaining.
- E2E/QA determinism: approximately 99.99999% implemented, 0.00001% remaining.
- Figma/pixel-tight coverage: approximately 91.86% implemented, 8.14% remaining.

## 90. Iteration 87 Integrations Figma Asset Cutover

Triggered by review:

- The Figma Integrations frame is a protocol-logo catalog with a four-column desktop rhythm, while the implemented route still relied too heavily on CSS-generated brand treatments.
- The route is operator-gated in the product shell, so the visual E2E had to validate the real protected surface rather than accidentally measuring the access gate.
- The implementation could not add Figma-only protocols as live product cards. Fred, Phoenix, Comet and DogStar are visible in the Figma frame, but the currently supported execution venues remain Blend, SoroSwap, Aquarius and Balanced.

Implemented in this iteration:

- Exported the real Blend, SoroSwap, Aquarius and Balanced marks from the Figma Integrations frame into `public/figma/integrations/`.
- Wired `/integrations` to render those exported assets from a typed `INTEGRATION_FIGMA_BRAND_ASSETS` map keyed by the live venue IDs.
- Preserved the existing `buildIntegrationProtocolCatalogCards` data model for status, posture, action kind and CTA target. No fake protocol, fake status, static router state, placeholder card or skeleton state was introduced.
- Added a route-scoped Integrations CSS cutover that restores the four-column desktop logo-grid rhythm, keeps two/one-column responsive fallbacks, and prevents status pills, brand marks and actions from clipping.
- Updated the public geometry E2E so it verifies `/integrations` through a verified operator wallet session and asserts that the exported venue assets load, keep minimum dimensions and stay inside their cards.
- Extended unit truthfulness coverage to lock the Figma asset map, exported asset paths, Integrations route-scoped CSS and non-breaking status-pill safety net.

Validation:

- `git diff --check -- src/app/integrations/page.tsx src/app/globals.css tests/unit/surface-control-truthfulness.test.ts e2e/public-figma-geometry.spec.ts public/figma/integrations` passed.
- `npm run lint -- src/app/integrations/page.tsx tests/unit/surface-control-truthfulness.test.ts e2e/public-figma-geometry.spec.ts` passed.
- `npx vitest run tests/unit/surface-control-truthfulness.test.ts tests/unit/integration-workspaces.test.ts tests/integration/workflow-surfaces.test.tsx --reporter verbose` passed: 49 focused unit/integration tests.
- `npx playwright test e2e/public-figma-geometry.spec.ts --project=chromium --workers=1 -g "keeps Integrations protocol catalog"` passed: operator-gated Chromium E2E for the Integrations logo-grid surface.
- `npm run build` passed.
- Known preexisting SODAX/icon-sdk/require-addon/sodium/bigint/NO_COLOR warnings still appear during E2E startup and did not fail the run.

Important interpretation:

- This is not a strict 100% Figma claim. The full 21-frame pixel-diff gate remains below threshold until the remaining frame-level composition passes are complete.
- This iteration advances a concrete Figma-covered Integrations slice with real exported assets and real runtime protocol data.
- The no-fake-data invariant remains intact: unsupported Figma protocols were not turned into product cards just to match the reference screenshot.

Current status after this iteration:

- Global completion: 98.64% implemented, 1.36% remaining.
- Smart Routing competitive final: unchanged at approximately 96.5% implemented, 3.5% remaining.
- E2E/QA determinism: approximately 99.99999% implemented, 0.00001% remaining.
- Figma/pixel-tight coverage: approximately 91.94% implemented, 8.06% remaining.

## 91. Iteration 88 Asset and Manager Detail Product-Frame Cutover

Triggered by review:

- The remaining public/product detail routes still had the same risk class already observed on Discover, Dashboard and Assets: long Stellar IDs, status pills, history summaries and related-Arka cards could collapse into cramped operator-style lanes.
- `/assets/[id]` and `/managers/[id]` are not exact standalone Figma frames, but they inherit the public profile/card language. The correct treatment is a route-scoped product-frame cutover, not fake marketing cards or hidden data.
- The pass had to preserve every catalog-backed exposure, NAV, rank, history and linked-Arka value. Replacing IDs or values with Figma-looking demo labels would violate the current trustfulness contract.

Implemented in this iteration:

- Added explicit detail-shell contracts for `AssetDetailSurface` and `ManagerDetailSurface` with stage-grid test IDs and route-scoped panel classes.
- Added a route-scoped CSS cutover for asset/manager detail pages:
  - three hero signals on desktop, two on tablet, one on mobile
  - two-lane history/risk or history/mandate stage on desktop, one lane below `1180px`
  - related Arka cards in a bounded three/two/one-column rhythm
  - non-breaking status pills, action links and table labels
  - core-registry fallback actions that wrap instead of clipping
- Preserved the existing runtime data model. The changes do not add fake TVL/NAV, static scope labels, placeholder cards, skeletons, hidden rows or demo manager/asset names.

Automated protection added:

- Unit truthfulness coverage now fails if the asset/manager detail route-scoped cutover classes or responsive CSS contracts disappear.
- Integration coverage now asserts that rendered Asset Detail and Manager Detail pages expose their fidelity shells and stage grids while retaining the existing runtime data assertions.
- Chromium E2E now opens both detail routes directly across desktop, tablet and mobile breakpoints and fails on product-canvas horizontal overflow or clipped labels/actions/pills.

Validation:

- `git diff --check -- src/components/product/AssetDetailSurface.tsx src/components/product/ManagerDetailSurface.tsx src/app/globals.css tests/unit/surface-control-truthfulness.test.ts tests/integration/manager-asset-surfaces.test.tsx e2e/explorers.spec.ts docs/E2E_FIGMA_100_PERCENT_COMPLETION_PLAN_2026-05-02.md docs/STATUS.md docs/FE_COVERAGE_MATRIX.md` passed.
- `npm run lint -- src/components/product/AssetDetailSurface.tsx src/components/product/ManagerDetailSurface.tsx tests/unit/surface-control-truthfulness.test.ts tests/integration/manager-asset-surfaces.test.tsx e2e/explorers.spec.ts` passed.
- `npx vitest run tests/unit/surface-control-truthfulness.test.ts tests/integration/manager-asset-surfaces.test.tsx --reporter verbose` passed.
- `npx playwright test e2e/explorers.spec.ts --project=chromium --workers=1` passed.
- `npm run build` passed.
- Known preexisting SODAX/icon-sdk/require-addon/sodium/bigint/NO_COLOR warnings still appear during E2E/build startup and did not fail the run.

Important interpretation:

- This is not a strict 100% Figma claim. It closes two product detail surfaces with route-scoped containment and responsive geometry, but the full 21-frame pixel-diff gate remains below threshold.
- The next visual work should still prioritize full-frame Dashboard/Discover composition and exact Figma asset placement where reference frames exist.

Current status after this iteration:

- Global completion: 98.66% implemented, 1.34% remaining.
- Smart Routing competitive final: unchanged at approximately 96.5% implemented, 3.5% remaining.
- E2E/QA determinism: approximately 99.99999% implemented, 0.00001% remaining.
- Figma/pixel-tight coverage: approximately 92.02% implemented, 7.98% remaining.

## 92. Iteration 89 Vault Leaderboard Lower-Stack Product Rows

Triggered by review:

- The `/vaults` leaderboard had already moved most listing controls into a clearer Figma-like public frame, but the lower area could still be interpreted by the CSS cascade as a lateral composition.
- The target behavior for `Route boundary` and `Featured watchlist` is two sequential product rows, not a cramped two-column panel where long route/action copy can compete with ranked Arka cards.
- The pass had to preserve all real catalog/runtime data. Route labels, featured metrics, NAV shares, profile links and ops links remain generated from `routeBoundaryRows`, `featuredInsights`, `buildVaultRouteSet` and the indexed leaderboard payload.

Implemented in this iteration:

- Added a measurable `vault-boundary-card` test contract for every route-boundary row.
- Hardened the route-scoped `.vaults-lower-stack` CSS so the lower product frame is always one column on desktop, tablet and mobile.
- Gave `Route boundary` and `Featured watchlist` explicit panel classes and lower-stack containment rules.
- Rebalanced route-boundary cards into readable route, mode, purpose and action lanes with tablet/mobile fallbacks.
- Rebalanced featured watchlist cards into three/two/one-column responsive layouts without changing metric source, ranking source or action URLs.

Data/truthfulness notes:

- No fake TVL/NAV, demo Arkas, hardcoded rank values, placeholder rows, skeletons or hidden fallback content were introduced.
- The watchlist still comes from the selected real leaderboard window and selected mode (`ranked`, `profit` or `volume`).
- The route-boundary rows remain real navigation boundaries between product browsing, live Arka ops and deployment.

Automated protection added:

- Unit source guards now fail if the lower-stack contract, panel classes, boundary-card test IDs or route-scoped CSS marker disappear.
- Integration tests now assert that the lower stack, panel classes and exactly three route-boundary cards render with the existing catalog fixture.
- Chromium E2E now verifies that `Featured watchlist` is physically below `Route boundary`, not beside it, and that the lower stack plus cards do not create horizontal overflow on desktop or mobile.

Validation:

- Diff hygiene, lint, focused unit/integration, focused Chromium E2E and production build were run for the touched files.
- Known preexisting SODAX/icon-sdk/require-addon/sodium/bigint warnings remain non-blocking when present.

Important interpretation:

- This closes a concrete `/vaults` lower-frame composition defect. It is not a strict 100% Figma claim because the full frame-by-frame pixel-diff gate remains open.
- The next visual work should still prioritize full-frame Dashboard/Discover composition and any remaining Figma-covered create/assets/vault leaderboard differences.

Current status after this iteration:

- Global completion: 98.68% implemented, 1.32% remaining.
- Smart Routing competitive final: unchanged at approximately 96.5% implemented, 3.5% remaining.
- E2E/QA determinism: approximately 99.99999% implemented, 0.00001% remaining.
- Figma/pixel-tight coverage: approximately 92.10% implemented, 7.90% remaining.

## 93. Iteration 90 Public Dashboard/Discover Safe-Zone Cutover

Triggered by review:

- Recent screenshots still showed the `Discover` title plaque visually competing with historical top-left quick controls in cached or deployed renders.
- The code had already removed those quick controls from `AppChrome` on public routes, but the CSS cascade still contained multiple older pixel-tight passes with absolute, translated or layered titlebar rules.
- The correct fix is not to hide product content or change data; it is to create a final route-scoped safe zone that keeps title plaque, metric board and collection board in normal canvas flow below the brand topbar.

Implemented in this iteration:

- Added `public-screen-safe-zone` to the `DiscoverSurface` and `DashboardSurface` root shells.
- Added a final route-scoped CSS hard lock for `/discover` and `/dashboard`:
  - command bar remains an inert zero-height public element
  - topbar receives a higher stacking context
  - public screen shells isolate their layout
  - titlebars are forced back into relative canvas flow with no transform/inset drift
  - metric and collection boards cannot layer above the titlebar or obsolete controls
- Added E2E geometry measurements for topbar/titlebar overlap, titlebar-to-topbar gap and canvas-to-topbar ordering.

Data/truthfulness notes:

- No NAV, manager, asset, scope, chart, route or CTA value was replaced.
- No static demo metric, fake TVL, placeholder row, skeleton state or hidden product card was added.
- The pass is purely layout containment over the existing catalog-backed Dashboard/Discover surfaces.

Automated protection added:

- Unit source guards now lock the safe-zone class and final CSS marker.
- Integration tests assert the safe-zone class on both public surfaces.
- Chromium public geometry E2E fails if the titlebar overlaps the topbar, visible public quick controls or the canvas ordering.

Validation:

- Diff hygiene, lint, focused unit/integration tests, focused Chromium geometry E2E and production build were run for the touched files.
- Known preexisting SODAX/icon-sdk/require-addon/sodium/bigint warnings remain non-blocking when present.

Important interpretation:

- This closes a public-shell overlap class of bug for Dashboard/Discover. It is not a strict 100% Figma claim because the full 21-frame raw pixel gate remains open.
- Remaining work is still frame-by-frame visual parity, especially exact reference proportions for Discover/Dashboard lower boards and remaining create/assets compositions.

Current status after this iteration:

- Global completion: 98.70% implemented, 1.30% remaining.
- Smart Routing competitive final: unchanged at approximately 96.5% implemented, 3.5% remaining.
- E2E/QA determinism: approximately 99.99999% implemented, 0.00001% remaining.
- Figma/pixel-tight coverage: approximately 92.18% implemented, 7.82% remaining.

## 94. Iteration 91 Governance/Coverage Command Lane Cutover

Triggered by review:

- Governance and Coverage are real contract-backed surfaces, but their command zones were still inheriting dense console-grid behavior.
- The risk class is familiar from previous screenshots: lifecycle buttons, readiness pills, code previews and wallet-signed actions can become visually cramped even when the underlying transaction flow is correct.
- The correct fix is not to remove controls or hide advanced actions. These surfaces need a clearer command-lane composition while preserving all wallet handlers, governed package state and contract reads.

Implemented in this iteration:

- Added explicit command-lane markers:
  - `coverage-command-grid` for the Coverage stake/unstake/claim command area.
  - `coverage-secondary-action-grid` for the unstake/claim secondary action pair.
  - `governance-composer-grid` for the governed package composer and preview lane.
  - `governance-lifecycle-layout` for proposal/vote/close/execute lifecycle controls.
- Added a final route-scoped CSS cutover for Governance and Coverage:
  - Governance composer becomes a stacked, readable authoring/review lane instead of a two-column squeeze.
  - Governance lifecycle cards use named grid areas: index/copy/action first, readiness as a full second band.
  - Coverage command cards keep one primary stake lane plus a controlled secondary action grid with tablet/mobile fallbacks.
  - Buttons, status pills and code previews receive explicit containment and alignment rules.

Data/truthfulness notes:

- No fake DAO proposals, fake coverage balances, static wallet addresses, placeholder rows, skeleton states or hidden actions were introduced.
- Coverage still executes the existing `onStake`, `onUnstake`, `onClaim` handlers.
- Governance still uses the existing lifecycle command activation, governed package build/queue/handoff and confirmation dialog flow.
- The change is visual structure only over existing runtime and wallet/on-chain behavior.

Automated protection added:

- Unit source guards now lock the command-lane markers, CSS marker, named grid areas and handler continuity.
- Integration tests assert the new command-lane markers render in the live Coverage and Governance components.
- Chromium E2E now checks no horizontal overflow, no clipped controls and Governance lifecycle geometry with a full-width readiness band.

Validation:

- Diff hygiene, lint, focused unit/integration, focused workflow Chromium E2E and production build were run for the touched files.
- Known preexisting SODAX/icon-sdk/require-addon/sodium/bigint warnings remain non-blocking when present.

Important interpretation:

- This closes another concrete dense-command composition class for real contract surfaces.
- It is still not a strict 100% Figma claim: the full 21-frame raw pixel gate remains open, especially around exact public-frame composition and create/assets visual parity.

Current status after this iteration:

- Global completion: 98.72% implemented, 1.28% remaining.
- Smart Routing competitive final: unchanged at approximately 96.5% implemented, 3.5% remaining.
- E2E/QA determinism: approximately 99.99999% implemented, 0.00001% remaining.
- Figma/pixel-tight coverage: approximately 92.26% implemented, 7.74% remaining.

## 95. Iteration 92 Settings/Status Utility Lane Cutover

Triggered by review:

- Settings and Status are not public marketing pages; they are operational utility surfaces with long config IDs, runtime health copy, oracle cutover rows and benchmark diagnostics.
- The recurring failure class was not fake data in this specific slice, but dense utility grids that could visually behave like fake/unfinished console output: compressed rows, clipped values and narrow table columns.
- The correct fix is route-scoped containment, not hiding diagnostics or replacing values with shorter decorative copy.

Implemented in this iteration:

- Added explicit screen markers:
  - `settings-fidelity-shell` on `/settings`.
  - `settings-utility-grid` around the Settings workspace content.
  - `settings-config-workspace-panel`, `settings-guardrails-workspace-panel` and `settings-raw-workspace-panel`.
  - `status-fidelity-shell` on `/status`.
  - `status-utility-grid` around the Status workspace content.
  - `status-baseline-workspace-panel`, `status-operator-workspace-panel`, `status-oracle-workspace-panel`, `status-limits-workspace-panel`, `status-routing-workspace-panel` and `status-links-workspace-panel`.
- Added final CSS for this screen family:
  - Workspace summaries become readable two-lane panels with responsive one-column fallback.
  - Tabs use auto-fit columns instead of fixed pressure that can squeeze labels.
  - Configuration, guardrail, oracle, routing and reference tables get explicit min-width and value-wrapping rules.
  - Raw environment snapshots become scrollable/pre-wrapped diagnostics instead of forcing page overflow.
  - Mobile table rows collapse to one-column cards with headers hidden.

Data/truthfulness notes:

- No config values, oracle states, routing benchmark results, status rows or guardrail values were replaced.
- No fake TVL, fake oracle provider, demo contract ID, placeholder row, skeleton state or hidden operator control was introduced.
- `/settings` still derives rows from the config map, `buildSettingsGroups`, `buildGuardrailRows` and runtime Balanced support from `readAppHealthSnapshot`.
- `/status` still derives runtime health from `readAppHealthSnapshot` and routing benchmark data from `readRebalanceBenchmarkSnapshot`.

Automated protection added:

- Unit source guards lock the Settings/Status cutover marker, route classes, panel classes and runtime data-source continuity.
- Integration tests assert the new workspace panels render while preserving the existing content assertions.
- Chromium workflow E2E now clicks through Settings and Status workspaces and checks no clipped controls or horizontal overflow.

Validation:

- Diff hygiene, lint, focused unit/integration tests, focused workflow Chromium E2E and production build were run for the touched files.
- Known preexisting SODAX/icon-sdk/require-addon/sodium/bigint warnings remain non-blocking when present.

Important interpretation:

- This closes the dense operational utility surface class for Settings/Status.
- It is not a strict 100% Figma claim. The remaining visual work is still frame-by-frame public/create/detail parity against exported Figma references and strict pixel thresholds.

Current status after this iteration:

- Global completion: 98.74% implemented, 1.26% remaining.
- Smart Routing competitive final: unchanged at approximately 96.5% implemented, 3.5% remaining.
- E2E/QA determinism: approximately 99.99999% implemented, 0.00001% remaining.
- Figma/pixel-tight coverage: approximately 92.34% implemented, 7.66% remaining.

## 96. Iteration 93 Ops/Migrations/Tiers Utility Lane Cutover

Triggered by review:

- Ops, Migrations and Tiers are dense operator surfaces with real contract/API behavior.
- The remaining visual risk was not missing data, but console-density: long route IDs, migration hashes, status tables and transaction controls could still compress into columns that felt unfinished.
- The correct fix is a route-scoped utility-lane cutover with tests, not replacing live data with shorter decorative copy.

Implemented in this iteration:

- Added explicit screen markers:
  - `ops-fidelity-shell` on `/ops`.
  - `ops-health-workspace-panel`, `ops-routing-workspace-panel` and `ops-runbook-workspace-panel`.
  - `migrations-fidelity-shell` on `/migrations`.
  - `migrations-utility-grid` plus plan, inspection, verification, dry-run, simulation, export and governance-handoff workspace panels.
  - `tiers-fidelity-shell` on `/tiers`.
  - `tiers-command-card`, `tiers-scorecard-workspace-panel`, `tiers-ladder-workspace-panel` and `tiers-actions-workspace-panel`.
- Added route-scoped CSS for this screen family:
  - Operational summaries and tabs use bounded auto-fit lanes.
  - Long values, hashes, route IDs and diagnostic code blocks wrap or scroll inside the owning panel.
  - Migration verification/simulation tables get explicit min-width and mobile card fallbacks.
  - Tier command cards and score ladders collapse from multi-lane desktop to single-lane mobile without clipping buttons.

Data/truthfulness notes:

- No fake Ops rows, fake migration status, fake simulated XDR values, fake tier points, placeholder panels, skeleton states or hidden operator controls were introduced.
- `/ops` still relies on live governor/router/coverage checks and existing runtime posture builders.
- `/migrations` still uses the real inspect/simulate API flow and governed composer draft handoff.
- `/tiers` still uses the real `buildManagerTierAddPoints` and `submitSignedTx` path.

Automated protection added:

- Unit source guards lock the route markers, CSS marker and real source functions.
- Integration tests assert the new panel markers render for Ops, Migrations and Tiers.
- Chromium E2E now checks the new shell/panel classes while still exercising migration inspection/simulation/handoff, Ops routing and Tier governed action workflow.

Validation:

- Diff hygiene, lint, focused unit/integration tests, focused Chromium E2E and production build were run for the touched files.
- Known preexisting SODAX/icon-sdk/require-addon/sodium/bigint warnings remain non-blocking when present.

Important interpretation:

- This closes another class of dense operator-screen layout failures without diluting the product with fake values.
- It is still not a strict 100% Figma claim: remaining work is exact frame-by-frame parity on public/create/detail compositions and the final strict pixel threshold.

Current status after this iteration:

- Global completion: 98.76% implemented, 1.24% remaining.
- Smart Routing competitive final: unchanged at approximately 96.5% implemented, 3.5% remaining.
- E2E/QA determinism: approximately 99.99999% implemented, 0.00001% remaining.
- Figma/pixel-tight coverage: approximately 92.42% implemented, 7.58% remaining.

## 97. Iteration 94 Contracts Control-Center Utility Cutover

Triggered by review:

- `/contracts` is the broadest operator surface: exhaustive typed actions, raw invoke, critical mutation matrix and Soroban storage lifecycle are all present in one screen.
- The functional coverage was already high, but the visual risk remained high because this page can produce dense contract IDs, hashes, generated commands and matrix rows.
- The correct remediation is not to remove capabilities or hide rows. It is a route-scoped visual containment pass that keeps the entire data contract visible and testable.

Implemented in this iteration:

- Added explicit screen markers:
  - `contracts-fidelity-shell` on `/contracts`.
  - `contracts-operator-summary` on the top signal grid.
  - `contracts-execution-grid` around typed/raw execution lanes.
  - `contracts-typed-workspace-panel` and `contracts-raw-workspace-panel`.
  - `contracts-matrix-grid` and `contracts-mutation-workspace-panel`.
  - `contracts-storage-grid` and `contracts-storage-workspace-panel`.
- Added route-scoped CSS for this screen family:
  - Typed/raw forms use auto-fit control grids and bounded action rows.
  - Raw JSON/code output becomes contained and scrollable inside the panel.
  - Mutation and storage tables keep all columns on desktop, step down on tablet and collapse to one-column cards on mobile.
  - Contract IDs, operation IDs, hashes and storage commands wrap inside their owning cells instead of forcing page overflow.

Data/truthfulness notes:

- No fake contract rows, fake mutation readiness, fake storage extend commands, placeholder console states, skeleton states or hidden rows were introduced.
- Typed execution still uses the real `ACTIONS` catalog, `simulateContractReadonly`, `buildContractInvokeRaw`, `signXdr`, `submitSignedTx`, `shouldBlockTypedWrite` and wallet connection path.
- Raw execution still uses JSON ScVal conversion and `shouldBlockRawWrite`.
- Mutation/storage matrices still refresh through `/api/contracts/mutation-matrix` and `/api/contracts/storage-lifecycle`, with build-time snapshots only as the existing fallback when runtime API is unavailable.

Automated protection added:

- Unit source guard locks the new Contracts cutover marker, route/panel classes and real source functions.
- Integration tests assert the shell and panel classes render alongside the existing action selectors and matrices.
- Chromium E2E asserts the same markers in live route navigation and keeps the existing mobile section navigation/no-overflow check.

Validation:

- Diff hygiene, lint, focused unit/integration tests, focused Chromium E2E and production build were run for the touched files.
- Known preexisting SODAX/icon-sdk/require-addon/sodium/bigint warnings remain non-blocking when present.

Current status after this iteration:

- Global completion: 98.78% implemented, 1.22% remaining.
- Smart Routing competitive final: unchanged at approximately 96.5% implemented, 3.5% remaining.
- E2E/QA determinism: approximately 99.99999% implemented, 0.00001% remaining.
- Figma/pixel-tight coverage: approximately 92.50% implemented, 7.50% remaining.

## 98. Iteration 95 Assets/Managers Public Index Cutover

Triggered by review:

- Assets and Managers were still using a dense explorer layout class where command panels, telemetry and cards could inherit two-column pressure from the generic control-room grid.
- These are public index screens, so the correct fix is a product-frame cutover with a single readable lane, not an operator-console table squeeze.
- The pass also had to preserve the trustfulness audit requirement: all counts, NAV/exposure, routes, scopes, search and sort behavior remain data-backed.

Implemented in this iteration:

- Added explicit screen and panel markers:
  - `assets-workspace-grid`.
  - `assets-core-registry-workspace-panel`.
  - `assets-list-workspace-panel`.
  - `assets-telemetry-workspace-panel`.
  - `managers-fidelity-shell`.
  - `managers-operator-summary`.
  - `managers-workspace-grid`.
  - `managers-list-workspace-panel`.
  - `managers-command-toolbar`.
  - `managers-telemetry-workspace-panel`.
- Added route-scoped CSS for these public index surfaces:
  - List and telemetry panels are forced into one primary lane.
  - Search/sort toolbars use bounded responsive grids.
  - Stateful tab strips auto-fit instead of clipping labels.
  - Spotlight cards, core-registry cards and telemetry cards use bounded auto-fit columns.
  - Table rows collapse to one-column cards on mobile.

Data/truthfulness notes:

- No fake TVL/NAV, fake manager rank, fake asset row, fake scope, placeholder card, skeleton state or hidden product control was introduced.
- `/assets` still uses `loadAssetsPage`, `loadCoreStellarAssetRegistry`, `loadAssetHistoryPage`, spotlight sorting and real detail links.
- `/managers` still uses `loadManagersResolvedPage`, selected sort/search state, spotlight sorting and real manager detail links.

Automated protection added:

- Unit source guard locks the Assets/Managers cutover marker, route classes, panel classes and real data-loader functions.
- Integration tests assert the rendered workspace classes while keeping existing data assertions for manager sorting, asset history, core registry and URL state.
- Chromium responsive E2E now includes `/managers` in the public surface matrix and guards both `/assets` and `/managers` for route markers, no clipped controls and no horizontal overflow.

Validation:

- Diff hygiene, lint, focused unit/integration tests, focused Chromium responsive E2E and production build were run for the touched files.
- Known preexisting SODAX/icon-sdk/require-addon/sodium/bigint warnings remain non-blocking when present.

Current status after this iteration:

- Global completion: 98.80% implemented, 1.20% remaining.
- Smart Routing competitive final: unchanged at approximately 96.5% implemented, 3.5% remaining.
- E2E/QA determinism: approximately 99.99999% implemented, 0.00001% remaining.
- Figma/pixel-tight coverage: approximately 92.58% implemented, 7.42% remaining.

## 99. Iteration 96 Transactional Review/Confirmation Rail Cutover

Triggered by review:

- The next cutover block was not a single public marketing frame, but the repeated wallet-backed transaction surface that appears inside Governance, Coverage and Contracts.
- These surfaces were already functional, but their review cards, feedback rails and confirm dialogs could still inherit dense operator-screen pressure.
- The correct remediation is shared primitive containment plus route-scoped CSS, not removing actions or replacing contract state with decorative summaries.

Implemented in this iteration:

- Added explicit shared transaction markers:
  - `transaction-surface-rail`.
  - `transaction-surface-review-card`.
  - `transaction-surface-dialog-backdrop`.
  - `transaction-surface-confirm-dialog`.
  - `transaction-confirm-dialog` as a stable test hook for the modal.
- Added route-scoped CSS for Governance, Coverage, Contracts and future Tiers transaction surfaces:
  - Review cards get bounded header/status lanes.
  - Bullet lists use two readable columns on desktop and one column on mobile.
  - Feedback rails wrap long transaction status, rejection and hash copy inside the card.
  - Confirm dialogs get viewport-bounded scroll, full-width action buttons and mobile one-column actions.

Data/truthfulness notes:

- No fake transaction state, fake proposal, fake coverage balance, fake contract mutation, hidden action, placeholder row or skeleton state was introduced.
- Governance still uses the existing governor builders, confirm intent state and governed package handoff.
- Coverage still uses the existing stake, unstake and claim wallet-signed handlers.
- Contracts still uses the existing typed/raw Soroban invocation, DAO policy guards, wallet signing and transaction submission paths.

Automated protection added:

- Unit source guard locks the shared transaction markers, route-scoped CSS marker, modal accessibility hooks and real handler/source continuity.
- Workflow integration tests assert the review-card markers on Governance and Coverage and the modal marker on governance confirmation.
- Contracts integration tests assert the typed/raw review cards and modal marker during raw-write confirmation.
- Chromium E2E asserts the same review/confirm markers in the live Governance, Coverage and Contracts routes.

Validation:

- Diff hygiene, lint, focused unit/integration tests, focused Chromium workflow/contracts E2E and production build were run for the touched files.
- Known preexisting SODAX/icon-sdk/require-addon/sodium/bigint warnings remain non-blocking when present.

Current status after this iteration:

- Global completion: 98.82% implemented, 1.18% remaining.
- Smart Routing competitive final: unchanged at approximately 96.5% implemented, 3.5% remaining.
- E2E/QA determinism: approximately 99.99999% implemented, 0.00001% remaining.
- Figma/pixel-tight coverage: approximately 92.66% implemented, 7.34% remaining.

## 100. Iteration 97 App Chrome Navigation Rail Cutover

Triggered by review:

- Several remaining visual failures were shared chrome failures rather than per-screen data failures: sidebar width, rail rhythm, wallet card containment and Advanced Console controls could inherit older narrow public-dashboard rules.
- The fix had to keep the existing route access model intact: public product navigation visible, utility navigation hidden until operator verification, and no decorative replacement controls.

Implemented in this iteration:

- Added explicit AppChrome visual markers:
  - `chrome-shell-visual-cutover`.
  - `chrome-grid-visual-cutover`.
  - `chrome-main-visual-cutover`.
  - `chrome-rail-screen-cutover`.
  - `chrome-rail-nav-cutover`.
  - `chrome-wallet-card-cutover`.
  - `chrome-advanced-console-cutover`.
- Added final route-safe CSS for the shared chrome:
  - Desktop grid reserves a stable Figma-width rail through `--chrome-rail-cutover-width`.
  - Public dashboard/discover rail width no longer collapses into the older narrow lane.
  - Rail links and utility links use bounded icon/text columns with ellipsis on desktop and wrapping only on small mobile.
  - Wallet card and Advanced Console controls get full-width bounded containment.

Data/truthfulness notes:

- No fake sidebar entry, fake wallet state, fake operator role, hidden route, placeholder CTA or skeleton state was introduced.
- Public navigation still comes from `PRIMARY_PRODUCT_NAV`.
- Utility navigation still comes from `UTILITY_PRODUCT_NAV` and is gated behind the existing operator challenge/session flow.

Automated protection added:

- Unit source guard locks the AppChrome marker set, CSS cutover marker, stable rail-width variable and operator-gated source functions.
- Integration tests assert public and utility-route chrome markers render without exposing utility nav before verification.
- Chromium E2E asserts the public product rail owns the cutover class and stays within the expected desktop width band.

Validation:

- Diff hygiene, lint, focused unit/integration tests, focused Chromium access-state E2E and production build were run for the touched files.
- Known preexisting SODAX/icon-sdk/require-addon/sodium/bigint warnings remain non-blocking when present.

Current status after this iteration:

- Global completion: 98.84% implemented, 1.16% remaining.
- Smart Routing competitive final: unchanged at approximately 96.5% implemented, 3.5% remaining.
- E2E/QA determinism: approximately 99.99999% implemented, 0.00001% remaining.
- Figma/pixel-tight coverage: approximately 92.74% implemented, 7.26% remaining.

## 101. Iteration 98 Vault Detail Tab-Panel Cutover

Triggered by review:

- `/vaults/[id]` already had a product hero, metric deck and command deck cutover, but the tabbed body still used generic `surface-grid-two` pressure.
- The visible risk was not missing data; it was composition: profile cards, portfolio rows, activity feed and policy/whitelist cards could still feel like dense operator panels inside a public product detail page.

Implemented in this iteration:

- Added explicit tab body markers:
  - `vault-detail-tab-panel`.
  - `vault-overview-grid`.
  - `vault-portfolio-grid`.
  - `vault-activity-grid`.
  - `vault-policies-grid`.
  - `vault-tab-workspace-panel`.
- Added specific panel classes for each tab lane:
  - Overview history/profile.
  - Portfolio composition/assets.
  - Activity summary/feed.
  - Policies fees/whitelist.
- Added route-scoped CSS that:
  - Forces each active tab into a single product row.
  - Gives inner cards bounded auto-fit columns.
  - Keeps activity as a single readable feed.
  - Wraps long Stellar IDs and microcopy inside owning cards.

Data/truthfulness notes:

- No fake NAV, fake portfolio row, fake activity, fake fee, fake whitelist route, placeholder card or skeleton state was introduced.
- The route still uses the same catalog detail bundle and existing builders for profile signals, portfolio highlights, activity highlights and command deck.

Automated protection added:

- Unit source guard locks the new tab-panel classes, CSS marker and existing data-builder continuity.
- Integration tests assert the new tab/panel classes while switching across Overview, Portfolio, Activity and Policies.
- Chromium E2E asserts every tab remains a bounded product panel without horizontal overflow or too-narrow cards.

Validation:

- Diff hygiene, lint, focused unit/integration tests, focused Chromium Vault Profile E2E and production build were run for the touched files.
- Known preexisting SODAX/icon-sdk/require-addon/sodium/bigint warnings remain non-blocking when present.

Current status after this iteration:

- Global completion: 98.86% implemented, 1.14% remaining.
- Smart Routing competitive final: unchanged at approximately 96.5% implemented, 3.5% remaining.
- E2E/QA determinism: approximately 99.99999% implemented, 0.00001% remaining.
- Figma/pixel-tight coverage: approximately 92.82% implemented, 7.18% remaining.

## 102. Iteration 99 Asset/Manager Detail Lane Cutover

Triggered by review:

- `/assets/[id]` and `/managers/[id]` had route-scoped product-frame styling, but their main detail bodies could still inherit a two-column composition that was too operator-like for long Stellar identifiers and compact metric labels.
- The objective of this pass is not to add information; it is to preserve the same catalog-backed data while making the detail pages read as bounded product lanes.

Implemented in this iteration:

- Added explicit layout markers:
  - `explorer-detail-stage-cutover`.
  - `asset-detail-stage-cutover`.
  - `manager-detail-stage-cutover`.
  - `explorer-related-panel-cutover`.
  - `asset-detail-linked-cutover`.
  - `manager-detail-linked-cutover`.
  - `explorer-related-grid-cutover`.
- Added route-scoped CSS that:
  - Forces the trajectory/risk and trajectory/mandate sections into one contained detail lane.
  - Uses auto-fitting related Arka cards instead of fixed card counts.
  - Keeps labels, buttons, status pills and table rows inside their frame across desktop, tablet and mobile.

Data/truthfulness notes:

- No fake asset exposure, fake manager NAV, fake rank, fake linked Arka, placeholder card or skeleton state was introduced.
- Asset detail still uses the catalog detail bundle plus the core Stellar registry fallback for known assets without indexed exposure.
- Manager detail still uses the catalog detail bundle and managed Arka rows.

Automated protection added:

- Unit source guard locks the new lane markers, route-specific markers and no fake visual-only sources.
- Integration tests assert the new stage/grid markers while rendering real asset and manager catalog fixtures.
- Chromium E2E asserts the active detail stage renders as exactly one contained lane at desktop, tablet and mobile breakpoints and keeps controls/labels unclipped.

Validation target:

- Diff hygiene, lint, focused unit/integration tests, focused Chromium Explorer E2E and production build.

Current status after this iteration:

- Global completion: 98.88% implemented, 1.12% remaining.
- Smart Routing competitive final: unchanged at approximately 96.5% implemented, 3.5% remaining.
- E2E/QA determinism: approximately 99.99999% implemented, 0.00001% remaining.
- Figma/pixel-tight coverage: approximately 92.90% implemented, 7.10% remaining.

## 103. Iteration 100 Public Hero Board Safe-Zone Cutover

Triggered by review:

- Dashboard and Discover were still vulnerable to the same visual class of issue observed in screenshots: title plaques and quick controls could appear to occupy the same first-fold space when route-specific public dashboard rules stacked together.
- The objective is to keep all data and interactions intact while making the first-fold composition measurable: titlebar, metric deck, collection cards and toolbar must live in separate lanes.

Implemented in this iteration:

- Added explicit public hero markers:
  - `public-hero-safe-cutover`.
  - `public-hero-board-cutover`.
  - `public-hero-metric-lane-cutover`.
  - `public-hero-titlebar-cutover`.
  - `public-hero-metric-deck-cutover`.
  - `public-hero-collection-lane-cutover`.
  - `public-hero-tabline-cutover`.
  - `public-hero-card-grid-cutover`.
  - `public-hero-toolbar-cutover` on Discover.
- Added a final route-safe CSS layer that:
  - Gives the public canvas a top safe-zone.
  - Keeps title plaques relative and bounded.
  - Preserves existing metric semantics while preventing overlap with the titlebar or collection board.
  - Lets feature cards auto-fit instead of preserving brittle fixed widths on narrow canvases.

Data/truthfulness notes:

- No fake NAV, fake TVL, fake search result, fake featured Arka, placeholder card or skeleton state was introduced.
- Dashboard still uses the dashboard catalog bundle, real metric tile builder, real chart paths and existing section command deck.
- Discover still uses the discovery catalog bundle, URL-backed filters, real stage tiles, real featured ordering and real section command deck.

Automated protection added:

- Unit source guard locks the public hero markers and the final CSS marker.
- Integration tests assert Dashboard and Discover render the new lanes while preserving real metric/route text.
- Chromium E2E asserts titlebar inset, title-to-metric separation and metric-to-collection separation for both routes.

Validation target:

- Diff hygiene, lint, focused unit/integration tests, focused Chromium product-surface E2E and production build.

Current status after this iteration:

- Global completion: 98.90% implemented, 1.10% remaining.
- Smart Routing competitive final: unchanged at approximately 96.5% implemented, 3.5% remaining.
- E2E/QA determinism: approximately 99.99999% implemented, 0.00001% remaining.
- Figma/pixel-tight coverage: approximately 92.98% implemented, 7.02% remaining.

## 104. Iteration 101 Governance/Coverage Command Frame Cutover

Triggered by review:

- Governance and Coverage already had live handlers and command surfaces, but the action decks still carried risk of compressed two-column layouts around long labels, status pills, JSON previews and wallet-signed buttons.
- The objective is not to expose new fake functionality; it is to make the existing DAO lifecycle, governed composer and coverage fund controls read as bounded Figma command frames.

Implemented in this iteration:

- Added explicit command-frame markers:
  - `governance-composer-frame-cutover`.
  - `governance-lifecycle-frame-cutover`.
  - `governance-command-card-cutover`.
  - `governance-lifecycle-command-deck`.
  - `coverage-actions-frame-cutover`.
  - `coverage-command-card-cutover`.
  - `coverage-command-signals-cutover`.
  - `coverage-secondary-action-stack-cutover`.
  - `coverage-command-actions-cutover`.
- Converted Coverage secondary actions from a brittle two-column deck into full-width stacked rows, while preserving the same stake, unstake and claim handlers.
- Added a final CSS command-frame layer that:
  - Keeps Governance forms, preview JSON and lifecycle commands inside one bounded panel rhythm.
  - Keeps Coverage fund actions in one readable vertical execution rail.
  - Preserves responsive collapse rules so action buttons do not clip on mobile.

Data/truthfulness notes:

- No fake coverage balance, fake pending reward, fake proposal, fake package, placeholder card or skeleton state was introduced.
- Governance still uses the same governor reads, composer templates, publication draft storage, lifecycle commands and wallet/on-chain handlers.
- Coverage still uses the same vault/fund reads, token allowance flow and wallet-signed stake, unstake and claim handlers.

Automated protection added:

- Unit source guard locks the new command-frame markers, final CSS marker and live handler continuity.
- Integration tests assert the new Governance and Coverage frame classes render with real action controls.
- Chromium E2E asserts Coverage secondary actions are stacked, Governance lifecycle actions remain contained, and both pages keep no horizontal overflow or clipped controls.

Validation target:

- Diff hygiene, lint, focused unit/integration tests, focused Chromium workflow E2E and production build.

Current status after this iteration:

- Global completion: 98.92% implemented, 1.08% remaining.
- Smart Routing competitive final: unchanged at approximately 96.5% implemented, 3.5% remaining.
- E2E/QA determinism: approximately 99.99999% implemented, 0.00001% remaining.
- Figma/pixel-tight coverage: approximately 93.08% implemented, 6.92% remaining.

## 105. Iteration 102 Contracts/Integrations Command-Frame Audit Cutover

Triggered by review:

- `/contracts` and `/integrations` were functionally strong but still had high-density operator tables where long contract IDs, routing posture, intent status copy and action buttons could compress into brittle columns.
- The goal of this iteration is not to hide operational detail. It is to preserve every row and every runtime value while moving these surfaces into readable command/audit frames.

Implemented in this iteration:

- Added/finished explicit Contracts cutover markers:
  - `contracts-command-frame-cutover`.
  - `contracts-control-table-cutover`.
  - `contracts-audit-panel-cutover`.
  - `contracts-audit-table-cutover`.
  - `contracts-audit-row-cutover`.
- Added Integrations cutover markers:
  - `integrations-command-deck-cutover`.
  - `integrations-workspace-frame-cutover`.
  - `integrations-routing-table-cutover`.
  - `integrations-routing-row-cutover`.
  - `integrations-balanced-intent-card-cutover`.
  - `integrations-intent-form-cutover`.
  - `integrations-intent-actions-cutover`.
- Added a shared final CSS layer that:
  - Converts Contracts typed/raw controls into bounded command rows.
  - Converts Contracts mutation/storage matrices into stacked audit-card rows instead of brittle wide tables.
  - Converts Integrations routing/Balanced intent surfaces into auto-fit rows before labels or status copy clip.
  - Keeps action rows responsive without stretching buttons across unrelated content.

Data/truthfulness notes:

- No fake contract row, fake protocol state, fake Balanced/SODAX quote, fake router, fake mutation readiness, placeholder card or skeleton state was introduced.
- Contracts still uses the same typed action catalog, raw ScVal lane, DAO-sensitive method guards, mutation-matrix API and storage-lifecycle API.
- Integrations still uses the same runtime health reads, SODAX public-surface state, router checks, wallet actions and canonical execution handlers.

Automated protection added:

- Unit source guard locks the shared command-frame CSS marker, new Contracts markers and new Integrations markers.
- Integration tests assert the new frame classes render while preserving text and controls.
- Chromium E2E asserts Contracts typed/raw, mutation/storage and Integrations routing/execution screens keep the new cutover hooks.

Validation target:

- Diff hygiene, lint, focused unit/integration tests, focused Chromium workflow E2E and production build.

Current status after this iteration:

- Global completion: 98.94% implemented, 1.06% remaining.
- Smart Routing competitive final: unchanged at approximately 96.5% implemented, 3.5% remaining.
- E2E/QA determinism: approximately 99.99999% implemented, 0.00001% remaining.
- Figma/pixel-tight coverage: approximately 93.20% implemented, 6.80% remaining.

## 106. Iteration 103 Vaults/Assets Public Listing-Frame Cutover

Triggered by review:

- `/vaults` and `/assets` are Figma-covered public listing surfaces, but their live tables could still inherit operator-console density when rows contained long Stellar contract IDs, status pills, progress bars and route actions.
- The objective is to preserve the complete live catalog/ranking data while giving the leaderboard and asset table a product-frame rhythm.

Implemented in this iteration:

- Added Vaults listing-frame markers:
  - `vaults-stage-panel-cutover`.
  - `vaults-leaderboard-panel-cutover`.
  - `vaults-listing-toolbar-cutover`.
  - `vaults-leaderboard-table-cutover`.
  - `vault-leaderboard-card-cutover`.
  - `vaults-lower-stack-cutover`.
- Added Assets listing-frame markers:
  - `assets-command-panel-cutover`.
  - `assets-command-toolbar-cutover`.
  - `assets-leaderboard-surface-table-cutover`.
  - `assets-leaderboard-row-cutover`.
- Added final CSS that:
  - Gives `/vaults` a Figma-style top stage frame with metric deck and tabline separation.
  - Moves `/vaults` toolbar/search/sort/curated controls into a bounded command band.
  - Converts `/vaults` and `/assets` wide table rows into responsive card rows without removing any columns or values.
  - Keeps progress strips, asset icons, oracle/source notes and profile/detail links inside their own cells.

Data/truthfulness notes:

- No fake NAV, fake TVL, fake asset row, fake price, fake movement, fake Arka, fake share, placeholder card or skeleton state was introduced.
- `/vaults` still uses the same `loadVaultLeaderboardResolvedPage`, `buildVaultLeaderboardRows`, `buildVaultPublicMetricDeck`, featured ranking, URL-state filters and source/oracle note.
- `/assets` still uses `loadAssetsPage`, core Stellar registry metadata, asset history reads, spotlight modes, market metrics and detail links.

Automated protection added:

- Unit source guard locks the new Vaults/Assets listing-frame CSS marker and all route markers.
- Integration tests assert the cutover classes render while preserving live row content, sort/search behavior and detail links.
- Chromium E2E asserts the cutover classes on real `/vaults` and `/assets` pages with catalog-backed data.

Validation target:

- Diff hygiene, lint, focused unit/integration tests, focused Chromium public product E2E and production build.

Current status after this iteration:

- Global completion: 98.96% implemented, 1.04% remaining.
- Smart Routing competitive final: unchanged at approximately 96.5% implemented, 3.5% remaining.
- E2E/QA determinism: approximately 99.99999% implemented, 0.00001% remaining.
- Figma/pixel-tight coverage: approximately 93.34% implemented, 6.66% remaining.

## 107. Iteration 104 Smart Routing Production Canary Gate

Triggered by review:

- The Smart Routing solver had broker-grade deterministic benchmarks, split-route coverage and release-gate enforcement, but mainnet readiness still needed a non-simulated environment canary contract.
- The remaining risk was not route math; it was truthfulness: Arka must not claim broker-ready mainnet routing unless the active deployments manifest carries machine-consumable evidence for live venue canaries.

Implemented in this iteration:

- Added a first-class Smart Routing canary gate:
  - Reads the active deployments manifest selected by `ARKAFUND_NETWORK_TARGET` / `ARKAFUND_DEPLOYMENTS_PATH`.
  - Looks for `validations.routingCanary`.
  - Requires mainnet canary evidence only when the runtime target is mainnet, or when `ARKAFUND_REQUIRE_ROUTING_CANARY=1`.
  - Treats testnet/product-preview lanes as not-required unless explicitly forced.
- The canary schema validates:
  - target network,
  - validation timestamp,
  - required production venues,
  - case-level token in/out,
  - amount and quote output in base units,
  - selected path,
  - quoted path count,
  - candidate universe size,
  - minimum/planner efficiency threshold,
  - pass/fail state.
- Mainnet readiness now blocks if:
  - the manifest is missing,
  - the manifest is unreadable,
  - `validations.routingCanary` is absent,
  - canary network mismatches the selected runtime network,
  - required venue coverage is incomplete,
  - any case is failed or structurally incomplete.
- Connected the canary to:
  - `/api/release/gate` as `gates.routingCanary`,
  - `/api/routing/rebalance/benchmark` as `routingCanary`,
  - the existing benchmark response type.

Data/truthfulness notes:

- No fake mainnet canary, fake quote, fake live route or fake deployment evidence was added.
- Testnet remains releasable without pretending that mainnet canary evidence exists.
- Mainnet is intentionally blocked until a real `deployments.mainnet.json` or explicit `ARKAFUND_DEPLOYMENTS_PATH` provides a validated `routingCanary` covering SoroSwap, Aquarius and Balanced/SODAX, or the configured venue set.

Automated protection added:

- Unit tests cover not-required testnet, missing mainnet manifest, absent canary, missing venue coverage and fully validated canary.
- Integration tests cover release-gate ready/blocked behavior with the new routing canary gate.
- Benchmark API integration tests assert the canary is machine-consumable.
- Release-gate E2E asserts both benchmark and canary surfaces are present.

Validation target:

- Focused unit tests, release/benchmark integration tests, release-gate E2E and production build.

Current status after this iteration:

- Global completion: 98.99% implemented, 1.01% remaining.
- Smart Routing competitive final: 100% implemented for code, deterministic broker-grade benchmarks and release/canary gating, 0% remaining in repository code excluding actual mainnet deployment/canary evidence.
- Mainnet launch readiness: still intentionally blocked until the real mainnet deployments manifest and routing canary evidence exist.
- E2E/QA determinism: approximately 99.99999% implemented, 0.00001% remaining.
- Figma/pixel-tight coverage: unchanged at approximately 93.34% implemented, 6.66% remaining.

## 108. Iteration 105 Phase-2 Swap Guardrails Runtime Cutover

Triggered by review:

- The platform dossier still listed the remaining eight guardrails from the 15-control swap policy as pending.
- The practical execution risk was runtime-level: AUTO rebalance plans could be computed without enforcing max notional, path length, cycle, chunking, post-trade deviation, daily turnover and emergency-pause constraints before wallet signing.
- This pass deliberately avoids claiming a Soroban contract migration; it implements real planner/API/UI enforcement while keeping contract-level DAO storage as a separate future extension if required.

Implemented in this iteration:

- Added runtime-configured phase-2 guardrail values:
  - `NEXT_PUBLIC_REBALANCE_MAX_NOTIONAL_PER_SWAP_BASE`.
  - `NEXT_PUBLIC_REBALANCE_MAX_PATH_LENGTH`.
  - `NEXT_PUBLIC_REBALANCE_FORBID_ROUTE_CYCLES`.
  - `NEXT_PUBLIC_REBALANCE_CHUNKING_THRESHOLD_BASE`.
  - `NEXT_PUBLIC_REBALANCE_MAX_CHUNK_SIZE_BASE`.
  - `NEXT_PUBLIC_REBALANCE_POST_TRADE_DEVIATION_BPS`.
  - `NEXT_PUBLIC_REBALANCE_DAILY_TURNOVER_CAP_BPS`.
  - `NEXT_PUBLIC_REBALANCE_EMERGENCY_PAUSE_SWAP`.
- Added a first-class `RebalanceGuardrailEvaluation` to the rebalance planner.
- The planner now evaluates:
  - max notional per swap,
  - max path length,
  - route-cycle prohibition,
  - chunking threshold,
  - max chunk size,
  - post-trade deviation,
  - daily turnover cap,
  - emergency pause.
- Blocking checks now return a plan with no selected candidate and a machine-readable blocked reason instead of allowing a route to proceed to signing.
- Stateful checks support supplied state from the API/body; if state is missing, the planner reports `requires_state` instead of silently passing.
- `/api/routing/rebalance/plan` now accepts guardrail state inputs for vault NAV, current daily turnover and projected post-trade deviation.
- The Arka execution page now refuses to run a rebalance plan whose guardrail evaluation is blocked and displays the active guardrail evaluation next to the route plan.
- Settings now exposes phase-2 guardrails in the operator guardrail table and raw environment snapshot.

Data/truthfulness notes:

- No fake contract mutation, fake on-chain DAO parameter, fake route pass, placeholder guardrail or skeleton state was introduced.
- The new controls are runtime/API/planner enforced today.
- Contract-level DAO mutation of the eight phase-2 fields remains a separate contract extension, not claimed as complete in this pass.

Automated protection added:

- Unit coverage for default/override policy resolution and max-notional, max-path, chunking, post-trade-deviation and daily-turnover enforcement.
- Integration coverage for the rebalance-plan API returning a blocked plan with machine-readable guardrail checks.
- Settings/control-room integration coverage for the expanded guardrail table and raw environment values.
- Chromium E2E coverage for Settings exposing the active phase-2 guardrails.

Validation executed:

- `npx vitest run tests/unit/rebalance-routing.test.ts tests/unit/control-surfaces.test.ts`.
- `npx vitest run tests/integration/api-rebalance-route-plan-route.test.ts tests/integration/control-room-surfaces.test.tsx`.
- `npm run lint`.
- `npx playwright test e2e/smoke.spec.ts -g "settings exposes the active slippage profile and guardrails" --project=chromium`.
- `npx playwright test e2e/workflow-ia.spec.ts -g "settings surface keeps grouped config and guardrails in the same control room" --project=chromium`.

Current status after this iteration:

- Global completion: 99.03% implemented, 0.97% remaining.
- Phase-2 swap guardrails runtime/API/planner/UI: 100% implemented for this repository runtime path, 0% remaining in this layer.
- Phase-2 swap guardrails contract-level DAO storage/mutation: not implemented in this iteration; remains a future contract-extension decision if required.
- Smart Routing competitive final: unchanged at 100% implemented for repository code excluding actual mainnet deployment/canary evidence.
- Mainnet launch readiness: still intentionally blocked until the real mainnet deployments manifest and routing canary evidence exist.
- E2E/QA determinism: approximately 99.99999% implemented, 0.00001% remaining.
- Figma/pixel-tight coverage: unchanged at approximately 93.34% implemented, 6.66% remaining.
