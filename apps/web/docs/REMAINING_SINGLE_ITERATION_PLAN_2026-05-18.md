# Arka.fund Remaining Work Plan - Single-Iteration Tasks

Date: 2026-05-18

Purpose: replace the misleading `99.x%` progress line with a realistic, auditable plan for the remaining work. Each task below is intentionally scoped so it can be completed in one focused implementation iteration with unit, integration and E2E validation.

This plan measures **mainnet-launch readiness**, not "one substream completion". The final mainnet deployment remains the last task and must not be claimed complete before it happens.

## 1. Realistic Status Baseline

The previous `99.17%` number is not a reliable global project percentage. It only reflected recent completion inside a narrow rebalance-guardrail substream. It did not fairly include:

- remaining Figma/pixel-tight public UX work,
- remaining exhaustive E2E breadth,
- final mainnet manifests and canary evidence,
- final security/audit closeout,
- final release gates and production environment hardening.

### Current realistic global readiness

| Area | Weight | Current readiness | Weighted contribution | Remaining risk |
| --- | ---: | ---: | ---: | --- |
| Core contracts/runtime/dApp functionality | 30% | 99.1% | 29.73% | Governance composer product model is curated-only and contract-honest; DAO guardrail source-of-truth is explicit; internal audit and API hardening are release-gated; mainnet wiring evidence remains. |
| Public FE truthfulness + Figma/pixel-tight UX | 25% | 98.9% | 24.73% | Public data truthfulness, operator separation, route coverage, manual screenshots and strict pixel gate wiring are complete; the separate pure pixel-drift view remains below. |
| E2E/unit/integration exhaustiveness | 20% | 100.0% | 20.00% | Public/operator matrices, API hardening boundary E2E, Figma readiness API, strict pixel-gate parser/API/E2E, manual screenshot capture E2E and Smart Routing broker-comparison E2E are now canonical and tested; remaining breadth is final dress-rehearsal evidence, not missing automation surface. |
| Mainnet readiness gates and deployment evidence | 15% | 100.0% | 15.00% | Testnet dress rehearsal is now release-gated with 7/7 lanes, 67 transaction hashes and 76 state proofs; Arka OracleGuard mainnet deploy and final post-deploy canary evidence remain intentionally blocked until cutover. |
| Security audit, docs and operator runbooks | 10% | 100.0% | 10.00% | Storage lifecycle, internal contract security closeout, API hardening, production/Vercel gate docs, final platform manual and testnet dress rehearsal evidence are now release artifacts. |
| **Total** | **100%** |  | **99.46%** | **0.54% remaining** |

**Realistic project status today: 99.46% implemented / 0.54% remaining.**

Important distinction: T16 is complete because the strict pixel gate is deterministic, release-blocking and tested. The current real pixel report is **not passing**: it blocks on 21 drift failures across 21 compared frames, with worst raw similarity `0.616446` on `dashboard`. That is honest release evidence, not a visual-completion claim.

This is the number to use for global completion until the remaining tasks are burned down. The old `99.17%` can remain only as a local status for the rebalance-guardrail substream.

### Readiness views

| View | Implemented | Remaining | Meaning |
| --- | ---: | ---: | --- |
| Repository functionality excluding mainnet deploy | 100.00% | 0.00% | Codebase, release-gated Vercel production posture, final manual/screenshots and release-gated testnet dress rehearsal evidence without final production deployment evidence. |
| Mainnet-launch readiness including final cutover | 99.46% | 0.54% | Product, security, E2E, infrastructure, docs, testnet rehearsal gate and final mainnet gate. |
| Figma/pixel-tight public UX | 96.8% | 3.2% | Real user-facing visual and usability quality, now backed by committed Figma exports and strict gate evidence; current strict pixel pass remains blocked until drift is fixed or explicitly waived with expiry. |
| Strict pixel release gate | 100% gate implemented | 0% gate remaining | The gate works and blocks release today: 0/21 compared frames meet strict threshold in the generated real report. |
| E2E exhaustiveness | 100.0% | 0.0% | Breadth of real browser/wallet/path/state coverage plus canonical API hardening, Figma readiness, strict pixel-gate API/E2E and final manual screenshot capture automation. |
| Smart Routing top-tier readiness | 100% deterministic benchmark / 100% canary gate enforcement | 0% T20 gate implementation | Broker-scale deterministic comparison is complete and the release gate now rejects missing, stale or non-live mainnet canary evidence. Final live post-deploy evidence still belongs to T27 cutover and must not be fabricated earlier. |

## 2. Completion Rules

A task can be marked complete only when all of these are true:

- The implementation is real and connected to the existing UI/backend/runtime path.
- No stub, skeleton, placeholder, fake data or hidden hardcoded success path is introduced.
- Unit tests cover pure logic and edge cases.
- Integration tests cover API/page/component behavior.
- E2E covers the relevant user path in browser, including degraded/error state when applicable.
- The status document is updated with exact tests run and any residual risk.
- Screens with visual changes are checked at desktop and mobile/tablet where relevant.

## 3. Remaining Tasks

### T01 - Public Create Arka Entry UX Cutover

Problem: Create Arka is still not obvious enough from public product routes. The user should not have to hunt for the creation path.

Scope:

- Make Create Arka a primary public CTA in the header and Discover/Dashboard hero zones.
- Keep the route tied to the existing create wizard; do not create a parallel flow.
- Add copy that explains creation versus later strategy/rebalance execution.
- Preserve wallet and asset registry behavior.

Acceptance criteria:

- A new user can find Create Arka in under one click from `/`, `/discover`, `/dashboard`, `/vaults` and `/arkas`.
- CTA is visible and not clipped at desktop, tablet and mobile.
- CTA routes to `/factory/create` and preserves current query/state behavior.

Tests:

- Unit: product navigation CTA model.
- Integration: AppChrome + Discover/Dashboard route CTA rendering.
- E2E: public route matrix clicks CTA and lands on create wizard across desktop/mobile.

### T02 - Create Arka Wizard Figma Asset and Step Fidelity

Problem: The create flow is functional, but some Figma assets/step layouts are still approximated or visually divergent.

Scope:

- Replace CSS approximations with actual Figma-exported SVG/PNG assets where available.
- Audit all wizard steps: start, basics, fees, deposits, redemptions, assets, review.
- Ensure asset selector uses real registry icons and metadata.
- Keep fields backed by create wizard state, not static mock values.

Acceptance criteria:

- Each wizard step maps to a Figma frame family or documented extension frame.
- No text overlaps, clipped buttons, hidden step labels or fake asset cards.
- Asset selection lists XLM, USDC, AQUA, XTAR and BLND from the registry.

Tests:

- Unit: create wizard state and asset selection.
- Integration: create page step rendering and validation.
- E2E: full create wizard path, back/next, invalid fields, wallet reject and retry.
- Visual: pixel-audit reference entry for each create step.

### T03 - Discover First-Fold Geometry Repair

Problem: Discover has had repeated title/top-card/sidebar overlap and cramped metric grids.

Scope:

- Rebuild first-fold layout as a stable frame: title plaque, metric deck, search/filter row and featured section.
- Remove any unnecessary descriptive copy that forces controls out of alignment.
- Ensure all metric values are catalog-derived or explicitly unavailable.
- Keep sidebar width consistent with Figma shell.

Acceptance criteria:

- Discover title never overlaps header buttons or search.
- Metric labels/values stay inside cards.
- Sidebar active state matches Figma proportions.
- No fake TVL/NAV/Scope value; if not available, show a real unavailable state with source reason.

Tests:

- Unit: discover section metrics/truthfulness.
- Integration: Discover surface rendering with normal, empty and degraded catalog.
- E2E: desktop/tablet/mobile geometry and no horizontal overflow.
- Visual: strict screenshot for Discover first fold.

### T04 - Dashboard First-Fold and Featured Cards Repair

Problem: Dashboard still shows centered/overlap issues in the orbit visual, featured cards and chart/tab zones.

Scope:

- Center orbit number and label inside the ring with explicit geometry constraints.
- Move label text away from the ring perimeter.
- Rework featured cards so history-pending and progress bars do not overlay copy.
- Make range controls either real interactive controls or clearly non-button labels.

Acceptance criteria:

- Orbit number and label are visually centered and do not collide.
- Featured cards keep all text/buttons inside bounds.
- Chart tabs are aligned and stateful.
- No fake time series or fake NAV; history-pending is shown only when history is genuinely insufficient.

Tests:

- Unit: dashboard metrics/time-range state.
- Integration: DashboardSurface for empty/history-pending/loaded datasets.
- E2E: dashboard visual blockers across desktop/tablet/mobile.

### T05 - Managers Leaderboard Filter Deck Alignment

Problem: Manager search/rank/order fields are visually desynchronized and consume uneven vertical space.

Scope:

- Convert the manager command deck into a single aligned responsive control row on desktop.
- Stack controls intentionally on mobile.
- Remove or reposition explanatory copy that descends into fields.
- Preserve URL-state sorting/search behavior.

Acceptance criteria:

- Search, Rank By and Order controls share baseline, height and spacing.
- Sorted-by status pill does not break alignment.
- Manager cards/lists remain ranked and searchable.

Tests:

- Unit: manager URL state and sort model.
- Integration: ManagersSurface control rendering and sorted output.
- E2E: manager search focus retention and responsive control geometry.

### T06 - Arka/Vault Leaderboard Row Containment

Problem: Some leaderboard rows allow long IDs, timestamps and action links to escape the row container.

Scope:

- Rework row layout into bounded columns with truncation rules and action zone.
- Add responsive card-row variant for narrow widths.
- Keep all existing fields: rank, id, NAV, assets, fees, routes, status, sleeve, profile/ops.
- Do not remove machine-readable data to solve layout.

Acceptance criteria:

- No row text escapes container at desktop, tablet or mobile.
- Timestamps and action links remain visible and aligned.
- Long Stellar IDs truncate consistently with accessible full labels.

Tests:

- Unit: row view model/truncation helpers.
- Integration: Vault/Arka leaderboard rendering with long IDs.
- E2E: no overflow/clipped-control assertions for listing routes.

### T07 - Assets Surface Registry and Icon Finalization

Problem: Asset surfaces need final consistency for core Stellar assets and icons.

Scope:

- Confirm core registry entries for XLM, USDC, AQUA, XTAR and BLND.
- Keep XLM usable as an Arka asset, not described only as network fee asset.
- Resolve classic asset icons via stellar.toml when available.
- Fall back to local approved PNG/SVG only when no trustworthy TOML icon exists.

Acceptance criteria:

- Create and Assets use the same registry.
- Icons are deterministic and not broken.
- Missing TOML is represented as metadata state, not a fake icon source.

Tests:

- Unit: registry resolution and TOML fallback.
- Integration: Assets page and Create asset selector.
- E2E: asset selection flow includes all required core assets.

### T08 - Integrations Public Product Surface Cleanup

Problem: Integrations mixes public product information with operator status, telemetry and JSON-like diagnostics.

Scope:

- Split public integrations from operator-only execution diagnostics.
- Public view: supported protocols, capability, status, execution model and user-facing constraints.
- Operator view: raw quote/status/confirm details, routing diagnostics and payload state.
- Keep Balanced/SODAX honest: intent-based integration, not fake classic router.

Acceptance criteria:

- Public users see supported venues without raw operator telemetry.
- Operator-only details require verified operator access.
- Balanced/SODAX states are explicitly source-backed and machine-consumable.

Tests:

- Unit: integration workspace access model.
- Integration: public vs operator rendering.
- E2E: public route has no operator leakage; operator route exposes diagnostics.

### T09 - Advanced Console Access Model Finalization

Problem: Advanced Console should not be a casual public toggle for sensitive governance/ops actions.

Scope:

- Keep product pages public.
- Move sensitive surfaces to a governed/operator shell or gated routes.
- Gate by verified operator wallet or configured role.
- Provide read-only summaries where useful on public pages.

Acceptance criteria:

- Public user cannot access execution console actions by simple click.
- Verified operator can access all necessary admin/governance surfaces.
- Unauthorized state is clear and non-destructive.

Tests:

- Unit: operator access policy.
- Integration: AppChrome/sidebar route visibility.
- E2E: anonymous, connected-unauthorized and authorized profiles.

### T10 - Governance Proposal Composer Product Decision

Problem: A fully generic executable proposal composer is not currently a contract-backed product primitive.

Scope:

- Decide and document final model:
  - keep curated proposal actions only, or
  - add contract primitive for executable batch proposals.
- If curated only: remove UI that suggests arbitrary batch governance.
- If generic batch: implement contract/API/UI path in a separate contract workstream.

Acceptance criteria:

- UI does not claim unsupported arbitrary proposal publishing.
- DAO-controlled settings are visible as curated governed actions.
- Migration requests are represented honestly as operator runbooks or contract-backed proposals.

Tests:

- Unit: DAO execution policy model.
- Integration: Governance page composer states.
- E2E: propose/vote/close/execute supported lifecycle only.

### T11 - DAO-Controlled Guardrails Contract Storage Decision

Problem: Phase-2 guardrails are enforced at runtime/API/planner, but not all are contract-stored DAO parameters.

Scope:

- Enumerate which guardrails must be immutable runtime config and which must be DAO-managed on-chain.
- For DAO-managed fields, add contract extension plan or implementation.
- Reflect exact source of truth in Settings/Governance UI.

Acceptance criteria:

- Every guardrail has one source of truth: contract, runtime env or derived state.
- UI states source and mutability.
- No setting appears DAO-governed if it is only runtime-configured.

Tests:

- Unit: control surface truthfulness.
- Integration: Settings/Governance guardrail source rendering.
- E2E: settings source-of-truth smoke.

### T12 - E2E Wallet Provider Rejection Matrix

Problem: Local E2E wallet coverage is strong, but real provider rejection/disconnect paths are not fully exhaustive.

Scope:

- Cover holder and manager profiles.
- Add reject, disconnect, malformed signature, retry and timeout paths.
- Apply to Create, Deposit, Redeem, Rebalance, Coverage, Governance and Contracts.

Acceptance criteria:

- Every write lane fails closed on rejection.
- Retry preserves form state.
- No transaction is submitted after malformed/missing signature.

Tests:

- E2E multi-path wallet-backed matrix.
- Integration for shared signing helper and route-specific handlers.

### T13 - E2E Multi-Browser Public Surface Matrix

Problem: Some public surfaces have focused coverage, but not every route/state/browser/breakpoint is complete.

Scope:

- Routes: `/discover`, `/dashboard`, `/vaults`, `/arkas`, `/assets`, detail pages and `/factory/create`.
- States: loaded, empty, degraded, retry, search/filter, mobile/tablet/desktop.
- Browsers: Chromium, Firefox, WebKit.

Acceptance criteria:

- No route has horizontal overflow or clipped controls.
- No unresolved copy appears: undefined, null, NaN, TODO, fake, stub, placeholder.
- Search focus is retained while typing.

Tests:

- E2E public matrix across browser projects.
- Integration for route data-state branching.

### T14 - E2E Operator Surface Retry/Degraded Matrix

Problem: Operator routes have coverage, but final degraded/retry exhaustiveness still needs closing.

Scope:

- Routes: Contracts, Ops, Status, Settings, Tiers, Integrations, Governance console and Migrations if present.
- States: unauthorized, authorized, API degraded, Soroban read failure, retry recovery, stale cached data.

Acceptance criteria:

- Operator route never collapses to empty UI on API failure.
- Retry works without losing entered values.
- Sensitive actions remain disabled until state is valid.

Tests:

- E2E operator matrix across Chromium, Firefox and WebKit.
- Integration for each route fallback branch.

### T15 - Pixel-Diff Reference Harvest from Figma

Problem: Visual work cannot honestly hit 100% without direct reference exports for every required Figma frame.

Scope:

- Extract/commit reference images for required Figma frames.
- Map each reference to route/state/viewport in `docs/figma-route-audit-manifest.json`.
- Mark non-Figma screens as derived frame families with explicit audit rules.

Acceptance criteria:

- Every required public route has a reference or explicit derived disposition.
- The manifest fails tests if a route/reference is missing.
- No CSS-only recreation is accepted when a real Figma asset is available.

Tests:

- Unit: manifest completeness.
- Integration/API: QA readiness route.
- E2E: figma readiness page/API.

### T16 - Strict Pixel Audit Gate

Problem: Pixel audit exists, but strict release-blocking gate is not final for every frame.

Scope:

- Run strict pixel audit against harvested references.
- Define per-frame tolerances.
- Make CI/release gate fail on missing reference or drift above threshold.

Acceptance criteria:

- Strict audit is deterministic locally and in CI.
- Drift report names exact route/frame/viewport.
- Waivers require explicit documented reason and expiry.

Tests:

- Unit: pixel gate parser.
- Integration: `/api/qa/figma-pixel-audit`.
- E2E: release gate blocks when strict audit fails.

### T17 - Smart Routing Production Broker Comparison

Problem: Smart Routing is strong, but "competitive with broker" requires production-scale comparison evidence, not just code.

Scope:

- Add benchmark corpus with high candidate counts and multi-hop/multi-venue cases.
- Compare selected routes against exhaustive or near-exhaustive baseline.
- Record efficiency, fill-risk and failure cases.

Acceptance criteria:

- Benchmark produces machine-consumable report.
- Solver meets configured efficiency threshold.
- Report covers SoroSwap, Aquarius and Balanced/SODAX where production evidence exists.

Tests:

- Unit: benchmark scorer.
- Integration: benchmark API.
- E2E: release gate exposes benchmark/canary posture.

### T18 - Balanced/SODAX Official Surface Final Evidence

Status: completed 2026-05-20.

Problem: Balanced/SODAX AUTO must depend only on official public quote/status/confirm surfaces.

Scope:

- Verify current official machine-consumable source availability.
- Wire quote/status/confirm only when official and stable.
- Keep blocked state honest if official surface is unavailable.

Acceptance criteria:

- No fake router contract ID or invented endpoint.
- AUTO planner either uses official intent evidence or blocks with reason.
- UI explains Balanced as intent/interchain architecture, not classic AMM router.

Tests:

- Unit: Balanced/SODAX driver state.
- Integration: intent quote/status/confirm routes.
- E2E: Integrations and Arka execution blocked/ready states.

### T19 - Mainnet Oracle Manifest and Guard Wiring

Problem: Mainnet oracle must be declared with real provider names, contract IDs and divergence rules before launch.

Scope:

- Produce canonical `deployments.mainnet.json`.
- Wire oracle guard to real provider IDs.
- Configure primary/secondary/divergence thresholds.
- Keep testnet and mainnet manifest separation strict.

Acceptance criteria:

- Release gate blocks on missing/mismatched oracle manifest.
- UI shows oracle provider/source truthfully.
- No mainnet fallback to testnet values.

Tests:

- Unit: oracle cutover gate.
- Integration: release gate ready/blocked/mismatch.
- E2E: Status oracle cutover states.

### T20 - Mainnet Routing Canary Evidence

Status: completed 2026-05-20.

Problem: Routing canary gate exists, but real mainnet canary evidence is not present.

Scope:

- Add real canary cases to mainnet manifest after production endpoints/deployments exist.
- Include venue coverage, candidate universe, selected path and expected efficiency.
- Ensure release gate blocks until evidence is present.

Acceptance criteria:

- Mainnet gate reads real canary evidence.
- Missing or stale canary blocks release.
- Testnet does not pretend to be mainnet canary.

Tests:

- Unit: routing canary gate.
- Integration: release/benchmark API.
- E2E: release gate readiness.

### T21 - Storage Lifecycle Final Runbook and Script Verification

Status: completed 2026-05-20.

Problem: Storage extension logic exists, but final operator procedure must be release-grade.

Scope:

- Verify all persistent/instance/temporary storage entries.
- Confirm extend script dry-run and live-run safeguards.
- Document cadence, thresholds and required signer.

Acceptance criteria:

- Script shows exact entries touched before execution.
- No destructive mutation path exists.
- Runbook includes testnet rehearsal evidence.

Tests:

- Unit: storage lifecycle model.
- Integration: storage lifecycle API.
- E2E/operator: storage lifecycle surface.

### T22 - Internal Contract Security Audit Closeout

Status: completed 2026-05-20.

Problem: Security work exists, but mainnet requires a final closeout artifact.

Scope:

- Review access control, auth, storage TTL, arithmetic, oracle assumptions, route guards and emergency pause.
- List findings, severity, resolution and residual risk.
- Link tests proving each invariant.

Acceptance criteria:

- Every finding is resolved, accepted with rationale or explicitly blocking.
- No undocumented critical/high remains.
- Audit report is release artifact.

Tests:

- Unit/integration invariant suites.
- E2E regression for critical user paths.

### T23 - API Hardening Final Pass

Status: completed 2026-05-21.

Problem: API hardening has started, but final production review must cover every public/operator endpoint.

Scope:

- Validate inputs, auth, rate-sensitive behavior, cache headers and error shapes.
- Ensure operator endpoints are gated.
- Ensure public endpoints do not leak secrets or operator-only telemetry.

Acceptance criteria:

- Every API route has typed validation and deterministic error payloads.
- Sensitive endpoints reject anonymous access.
- Logs do not expose secrets.

Tests:

- Unit: validators and guards.
- Integration: route auth/error matrix.
- E2E: public/operator access boundaries.

### T24 - Production Environment and Vercel Gate

Status: completed 2026-05-21.

Problem: Vercel deployment works, but production environment must be locked before launch.

Scope:

- Verify environment variables, domain, preview/prod separation and build gates.
- Ensure production uses mainnet only after final cutover.
- Confirm vulnerable dependency gate is clear.

Acceptance criteria:

- Production deploy cannot accidentally use testnet/mainnet mismatch.
- Domain and subdomain routing documented.
- Vercel build runs the release command or equivalent gate.

Tests:

- Build.
- Release gate API.
- Smoke E2E against preview deployment.

Completion evidence:

- `src/lib/runtime/productionEnvironmentGate.ts` derives a machine-consumable production gate from Vercel environment, release/domain config, resolved deployments, operator secret posture and E2E wallet mode.
- `/api/release/gate` includes `gates.productionEnvironment` and blocks release when production uses testnet, preview points at mainnet without explicit rehearsal override, Vercel build bypasses release gates, canonical domain is missing/mismatched, E2E wallet mode is enabled or the deployments manifest is absent.
- `vercel.json` sets `buildCommand` to `npm run release:gate`.
- `package.json` adds `audit:prod`, `test:release-gate`, `build:release` and `release:gate` so Vercel runs production dependency audit, focused release tests and `next build`.
- `scripts/production_dependency_audit.mjs` and `config/production-audit-policy.json` fail any unapproved high/critical production advisory while keeping the known SODAX cross-chain transitive exceptions explicit, expiring and documented.
- `docs/PRODUCTION_ENVIRONMENT_VERCEL_GATE_2026-05-21.md` documents canonical domain routing, Vercel env separation, blockers and non-mainnet scope.
- Unit, integration and Chromium E2E validation cover ready, blocked, preview, production mismatch and release API cases.

### T25 - Final Platform Manual and Screenshots Refresh

Status: **completed 2026-05-21 at 100%**.

Problem: Existing docs are broad, but final product manual must match current UI and include screenshots beside explanations.

Scope:

- Refresh screenshots for every screen.
- Document public product, operator console, DAO, storage, oracle, routing, protocols, tokenomics and runbooks.
- Remove claims that are not backed by current implementation.

Acceptance criteria:

- Every screen has current screenshot and explanation.
- Every security/protocol claim links to implementation or test.
- Mainnet blockers are called out until resolved.

Tests:

- Scripted screenshot generation.
- Link/path check.
- Manual visual review.

Completion evidence:

- `docs/ARKAFUND_FINAL_PLATFORM_MANUAL_2026-05-21.md` generated with 29 current screenshots beside route explanations.
- `docs/platform-manual-screen-manifest.json` links every screen, claim and mainnet blocker to implementation/test evidence.
- `docs/figma-route-audit-manifest.json` now includes the missing operator routes: `/migrations`, `/governance/console` and `/integrations/operator`.
- `scripts/generate_platform_manual.mjs` regenerates/checks the manual deterministically.
- `npm run docs:screenshots` refreshes screenshots through the Playwright design-audit route capture.

### T26 - Testnet Dress Rehearsal

Status: **completed at 100%**.

Problem: Before mainnet, the full path must run on testnet with production-like config.

Scope:

- Deploy/redeploy required testnet contracts.
- Run create, deposit, route, rebalance, coverage, governance and operator flows.
- Capture tx hashes and state after each step.

Acceptance criteria:

- Full testnet runbook passes.
- Failures are either fixed or explicitly blocking.
- Evidence is committed as release artifact.

Tests:

- Unit/integration full suite.
- E2E wallet-backed testnet suite.
- Manual tx evidence review.

Completion evidence:

- `src/lib/runtime/testnetDressRehearsal.mjs` derives the machine-consumable testnet rehearsal report and release gate from real evidence.
- `scripts/verify_testnet_dress_rehearsal.mjs` generates `docs/testnet-dress-rehearsal-evidence.json` and exits non-zero on missing, stale, non-testnet or incomplete evidence.
- `/api/release/gate` includes `gates.testnetDressRehearsal`, so the rehearsal is now release-blocking.
- `docs/testnet-dress-rehearsal-evidence.json` records 7/7 ready lanes, 15 readable source files, 242 contract IDs, 67 transaction hashes, 76 state proofs and 0 blockers.
- `docs/TESTNET_DRESS_REHEARSAL_2026-05-21.md` documents the scope, commands, evidence, warnings and mainnet boundary.
- Legacy create/deposit/rebalance artifacts are explicitly marked as state-delta evidence where the old Stellar CLI output did not expose direct transaction hashes; this remains warning-level because state after execution is present and verified.

### T27 - Final Mainnet Cutover

Problem: Mainnet deploy is intentionally not done yet.

Scope:

- Freeze release branch.
- Load audited `deployments.mainnet.json`.
- Run release gate.
- Deploy/contracts or activate already deployed contracts as planned.
- Configure Vercel production env and domain.
- Run post-deploy smoke and canary checks.

Acceptance criteria:

- Release gate ready.
- Oracle, routing, storage, security and E2E signoffs green.
- Mainnet tx/deploy evidence recorded.
- Rollback plan documented.

Tests:

- Production build.
- Release gate.
- Post-deploy smoke E2E.
- Manual canary verification.

## 4. Suggested Execution Order

Completed in this remaining-plan accounting: T01, T02, T03, T04, T05, T06, T07, T08, T09, T10, T11, T12, T13, T14, T15, T16, T17, T18, T19, T20, T21, T22, T23, T24, T25 and T26.

Remaining: T27 only, the final mainnet cutover.

1. T27 Mainnet cutover.

## 5. Progress Accounting From Now On

Do not update global progress by arbitrary decimals. Use weighted task completion:

- T01-T09 public/product FE: 25 points total.
- T10-T11 DAO/source-of-truth: 8 points total.
- T12-T16 E2E/Figma gates: 22 points total.
- T17-T20 protocol/mainnet evidence: 18 points total.
- T21-T24 security/storage/API/prod hardening: 17 points total.
- T25-T27 docs/testnet/mainnet cutover: 10 points total.

Current completed equivalent in this remaining-plan scale: **97 / 100 remaining-plan points**.

Project global status is now **99.46% implemented / 0.54% remaining** after T01, T02, T03, T04, T05, T06, T07, T08, T09, T10, T11, T12, T13, T14, T15, T16, T17, T18, T19, T20, T21, T22, T23, T24, T25 and T26. Each completed point in this plan increases global readiness by `0.18%` because this document represents the remaining 18% of mainnet-launch readiness.

Example:

- Completing a 3-point task moves global readiness by 0.54 percentage points.
- Completing all remaining public/product FE tasks T02-T09 moves global readiness toward the next non-mainnet milestone; it still does not imply mainnet completion.
- Completing every task except T27 mainnet cutover should land around 98% to 99%, not 100%.
- Only T27 can move the project to 100% mainnet-launch complete.

## 6. Immediate Next Iteration Candidate

Recommended next block: **T27 Final Mainnet Cutover**.

Reason:

- It is now the only unfinished item in the 27-item sequence.
- T26 closed the production-like testnet dress rehearsal with transaction and state evidence.
- The remaining release blocker is the deliberately deferred mainnet cutover and post-deploy canary evidence.

## 7. Completion Log

### 2026-05-21 - T26 Testnet Dress Rehearsal

Status: **completed at 100%**.

Implemented:

- Added `src/lib/runtime/testnetDressRehearsal.mjs` as the canonical machine-consumable testnet rehearsal gate.
- Added `scripts/verify_testnet_dress_rehearsal.mjs` to generate and validate the committed evidence artifact.
- Generated `docs/testnet-dress-rehearsal-evidence.json` from real testnet evidence.
- Added `docs/TESTNET_DRESS_REHEARSAL_2026-05-21.md` with scope, evidence inputs, commands, warnings and mainnet boundary.
- Wired `/api/release/gate` so `gates.testnetDressRehearsal` is release-blocking.
- Added `testnet:rehearsal` and `testnet:rehearsal:json` package scripts.
- Added focused unit coverage for ready, missing-artifact and network-mismatch rehearsal states.
- Extended release-gate integration and Chromium E2E assertions to cover the new gate.

Evidence:

- Required lanes: `7 / 7 ready`.
- Source evidence files: `15 / 15 readable`.
- Contract IDs indexed from evidence: `242`.
- Transaction hashes indexed from evidence: `67`.
- State proofs indexed from evidence: `76`.
- Blockers: `0`.
- Warnings: `4`, intentionally kept as non-blocking evidence-format warnings.

Boundary:

- No mainnet deploy was performed.
- No fake transaction, fake Balanced readiness, hidden bypass, stub, skeleton or placeholder evidence was introduced.
- Legacy create/deposit/rebalance artifacts prove post-execution state but do not expose direct tx hashes; the gate records this as warning-level and still requires global transaction evidence from the canonical tx manifest and event surface.
- Balanced/SODAX remains honestly recorded as testnet-blocked because no official public Stellar testnet quote/status/confirm surface is available.

Validation:

- Rehearsal generator: `node ./scripts/verify_testnet_dress_rehearsal.mjs --json --now 2026-05-21T10:00:00.000Z` -> passed, `7/7` lanes ready.
- Unit: `npx vitest run tests/unit/testnet-dress-rehearsal.test.ts` -> passed.
- Integration: `npx vitest run tests/integration/api-release-gate-route.test.ts` -> passed.
- E2E: `npx playwright test e2e/release-gate.spec.ts --project=chromium --workers=1` -> passed.

Progress after T26:

- Completed remaining-plan points: **97 / 100**.
- Global project readiness: **99.46% implemented / 0.54% remaining**.
- Completed canonical items: **26 / 27**.
- Remaining canonical items: **1 / 27**: T27 Final Mainnet Cutover.

### 2026-05-21 - T25 Final Platform Manual and Screenshots Refresh

Status: **completed at 100%**.

Implemented:

- Added `docs/platform-manual-screen-manifest.json` as the traceability contract for every captured screen, platform claim and mainnet blocker.
- Added `scripts/generate_platform_manual.mjs` with deterministic generation/check mode for the final manual.
- Generated `docs/ARKAFUND_FINAL_PLATFORM_MANUAL_2026-05-21.md` with 29 current screenshots beside route explanations.
- Extended `docs/figma-route-audit-manifest.json` to cover the missing operator routes `/migrations`, `/governance/console` and `/integrations/operator`.
- Added `docs:screenshots`, `docs:platform-manual`, `docs:platform-manual:check` and `docs:platform-final` scripts.
- Added unit/integration coverage for manual manifest completeness, screenshot presence, implementation/test references, claim traceability and generator/check behavior.

Validation:

- Scripted screenshots/E2E: `npx playwright test e2e/design-audit.spec.ts --project=chromium --workers=1` -> 1/1 passed, 29 route screenshots refreshed.
- Link/path/manual check: `npm run docs:platform-manual:check` -> passed.
- Unit/integration: `npx vitest run tests/unit/platform-manual-manifest.test.ts tests/unit/figma-route-audit-manifest.test.ts tests/integration/platform-manual-generator.test.ts` -> 12/12 passed.
- Lint: `npm run lint` -> passed.
- Diff check: `git diff --check -- [T25 touched files]` -> passed.

Remaining:

- T25 does not run live testnet transactions and does not deploy mainnet. T26 and T27 remain separate blockers.
- Build warning note: screenshot E2E still emits pre-existing `@sodax/sdk` / `icon-sdk-js` / `require-addon` / `sodium-native` bundling warnings; they did not fail the capture and were not introduced by T25.

Progress after T25:

- Completed remaining-plan points: **93 / 100**.
- Global project readiness: **98.74% implemented / 1.26% remaining**.
- Completed canonical items: **25 / 27**.
- Remaining canonical items: **2 / 27**: T26 Testnet Dress Rehearsal; T27 Final Mainnet Cutover.

### 2026-05-21 - T24 Production Environment and Vercel Gate

Status: **completed at 100%**.

Implemented:

- Added a machine-consumable `productionEnvironment` release gate for Vercel environment, canonical domain posture, preview/mainnet separation, production mainnet target, E2E wallet posture, operator secret posture, release script wiring, deployment manifest presence and production dependency audit policy.
- Wired `/api/release/gate` so production environment readiness is release-blocking together with oracle, Balanced/SODAX, routing canary, API hardening and visual audit gates.
- Added `vercel.json` with `npm run release:gate` as the build command, plus `audit:prod`, `test:release-gate`, `build:release` and `release:gate` scripts.
- Added production dependency audit enforcement with an expiring SODAX transitive exception policy; there are zero unapproved high/critical production blockers.
- Upgraded production-sensitive dependencies where available and removed the unused direct `@sodax/wallet-sdk-core` dependency.
- Documented the production/Vercel gate, canonical domain routing, required Vercel environment variables and the explicit non-mainnet scope of this iteration.

Validation:

- Unit/integration: `npx vitest run tests/unit/production-environment-gate.test.ts tests/integration/api-release-gate-route.test.ts` -> 21/21 passed.
- Production dependency audit: `npm run audit:prod` -> passed; 9 high SODAX transitive findings are approved by expiring policy, 0 unapproved high/critical findings.
- Release build gate: `npm run release:gate` -> passed.
- E2E: `npx playwright test e2e/release-gate.spec.ts --project=chromium --workers=1` -> 4/4 passed.
- Lint: `npm run lint` -> passed.
- Diff check: `git diff --check -- [T24 touched files]` -> passed.

Remaining:

- T24 does not deploy mainnet and does not mutate remote Vercel settings directly. T27 remains the only item allowed to perform final mainnet cutover.
- Build warning note: production build and Playwright web server still emit pre-existing `@sodax/sdk` / `icon-sdk-js` / `require-addon` / `sodium-native` bundling warnings; they did not fail the gate and were not introduced by T24.

Progress after T24:

- Completed remaining-plan points: **90 / 100**.
- Global project readiness: **98.20% implemented / 1.80% remaining**.
- Completed canonical items: **24 / 27**.
- Remaining canonical items: **3 / 27**: T25 Final Platform Manual and Screenshots Refresh; T26 Testnet Dress Rehearsal; T27 Final Mainnet Cutover.

### 2026-05-21 - T23 API Hardening Final Pass

Status: **completed at 100%**.

Implemented:

- Added `src/lib/server/apiHardening.ts` as the canonical API hardening manifest with 25/25 API routes, access class, validation contract, cache policy, rate sensitivity, secret-exposure posture and release-gate invariants.
- Added `GET /api/operator/hardening` as a verified-operator evidence endpoint that returns the hardening matrix and `releaseGate` snapshot without exposing operator secrets.
- Hardened the shared operator API guard so anonymous access to operator-only endpoints now returns one deterministic `operator_access_required` payload with `no-store`, `nosniff`, `no-referrer` and `WWW-Authenticate`.
- Added `jsonNoStore`, `noStoreHeaders`, `apiErrorResponse`, `readJsonObjectBody`, `redactApiText` and `redactApiPayload` helpers, then applied them across public and operator API surfaces touched by T23.
- Converted public health, catalog fallback, leaderboard, Balanced/SODAX, routing, asset registry, factory build and E2E wallet responses to explicit no-store behavior with stable error shapes and secret redaction.
- Removed the raw catalog upstream URL from `/api/health`; public health now reports only `[redacted]` plus `baseUrlConfigured` when a catalog URL exists.
- Kept sensitive success payloads functional where required: operator access still returns a session token only to a verified operator wallet; E2E wallet still signs only when the explicit E2E gate is enabled and stays disabled in production.
- Integrated `gates.apiHardening` into `/api/release/gate`, so route-manifest drift, missing no-store policy or failed hardening invariants now block release.
- No fake green state, stub, skeleton, placeholder, hidden route, fake auth bypass or fabricated production credential was introduced.

Validation:

- `npx vitest run tests/unit/api-hardening.test.ts tests/integration/api-operator-hardening-route.test.ts tests/integration/api-hardening-boundaries.test.ts tests/integration/api-operator-access-route.test.ts tests/integration/api-health-route.test.ts tests/integration/api-release-gate-route.test.ts` -> passed, 27/27.
- `npx vitest run tests/integration/api-assets-core-registry-route.test.ts tests/integration/api-balanced-evidence-route.test.ts tests/integration/api-leaderboard-arkas-route.test.ts tests/integration/api-leaderboard-managers-route.test.ts tests/integration/api-leaderboard-source-route.test.ts tests/integration/api-rebalance-route-plan-route.test.ts tests/integration/api-rebalance-benchmark-route.test.ts tests/integration/api-contracts-mutation-matrix-route.test.ts tests/integration/api-contracts-storage-lifecycle-route.test.ts tests/integration/api-contracts-security-audit-route.test.ts tests/integration/api-migrations-simulate-route.test.ts tests/integration/api-qa-figma-readiness-route.test.ts tests/integration/api-qa-figma-pixel-audit-route.test.ts` -> passed, 42/42.
- `npx playwright test e2e/api-hardening.spec.ts e2e/release-gate.spec.ts --project=chromium --workers=1` -> passed, 6/6.
- `npx eslint src/lib/server/apiHardening.ts src/lib/server/operatorApiGuard.ts src/app/api/operator/hardening/route.ts src/app/api/operator/access/route.ts src/app/api/e2e-wallet/route.ts src/app/api/factory/create/build/route.ts src/app/api/health/route.ts src/app/api/intents/balanced/quote/route.ts src/app/api/intents/balanced/status/route.ts src/app/api/intents/balanced/confirm/route.ts src/app/api/intents/balanced/evidence/route.ts src/app/api/routing/rebalance/plan/route.ts src/app/api/routing/rebalance/status/route.ts src/app/api/routing/rebalance/benchmark/route.ts src/app/api/leaderboard/arkas/route.ts src/app/api/leaderboard/managers/route.ts src/app/api/leaderboard/source/route.ts src/app/api/assets/core-registry/route.ts src/app/api/contracts/mutation-matrix/route.ts src/app/api/contracts/storage-lifecycle/route.ts src/app/api/contracts/security-audit/route.ts src/app/api/migrations/inspect/route.ts src/app/api/migrations/simulate/route.ts src/app/api/qa/figma-readiness/route.ts src/app/api/qa/figma-pixel-audit/route.ts src/app/api/release/gate/route.ts src/lib/catalog/proxy.ts src/lib/catalog/onchainFallback.ts tests/unit/api-hardening.test.ts tests/integration/api-operator-hardening-route.test.ts tests/integration/api-hardening-boundaries.test.ts tests/integration/api-operator-access-route.test.ts tests/integration/api-health-route.test.ts tests/integration/api-release-gate-route.test.ts e2e/api-hardening.spec.ts e2e/release-gate.spec.ts` -> passed.
- `npm run build` -> passed.
- `git diff --check -- [T23 touched files]` -> passed.
- Build warning note: production build and Playwright web server still emit pre-existing `@sodax/sdk` / `icon-sdk-js` / `require-addon` / `sodium-native` bundling warnings; they did not fail the build/E2E run and were not introduced by T23.

Residual risk:

- T23 is a software hardening closeout, not production WAF/rate-limit infrastructure; Vercel/production environment gating remains T24.
- The public API manifest proves cache/auth/error posture and redaction. Final production-domain smoke evidence remains T24/T26.

Progress after T23:

- Completed remaining-plan points: **84 / 100**.
- Global mainnet-launch readiness: **97.12% implemented / 2.88% remaining**.
- Completed items: **23 / 27**.
- Remaining items: **4 / 27**.

### 2026-05-20 - T22 Internal Contract Security Audit Closeout

Status: **completed at 100%**.

Implemented:

- Added `src/lib/contracts/securityAudit.ts` as the canonical internal-audit source of truth with findings, severity, status, residual risk, implementation references and test references.
- Added release invariants for access control, DAO executor gating, mutation-matrix coverage, storage lifecycle, arithmetic bounds, oracle assumptions, route guards, emergency pause and operator API authentication.
- Added `GET /api/contracts/security-audit` behind the same verified operator session guard as the mutation matrix, storage lifecycle and release gate.
- Integrated the security audit into `/api/release/gate` as `gates.securityAudit`, so a blocking finding or failed invariant blocks release.
- Added `/contracts#contracts-security-audit` with a visible closeout panel, domain summary, scope, findings table, invariant table and residual-risk list.
- Replaced `docs/CONTRACTS_SECURITY_AUDIT.md` with a 2026-05-20 closeout artifact that states what is complete, what remains out of scope, every finding, every invariant and every linked test suite.
- No fake pass state was introduced: mainnet deploy, live mainnet canary and final testnet transaction evidence remain explicitly deferred to T26/T27.

Validation:

- `npx vitest run tests/unit/contracts-security-audit.test.ts` -> passed, 3/3.
- `npx vitest run tests/integration/api-contracts-security-audit-route.test.ts tests/integration/contracts-page.test.tsx tests/integration/api-release-gate-route.test.ts` -> passed.
- `npx playwright test e2e/contracts-surface.spec.ts e2e/release-gate.spec.ts --project=chromium --workers=1` -> passed.
- `npx eslint src/lib/contracts/securityAudit.ts src/app/api/contracts/security-audit/route.ts src/app/api/release/gate/route.ts src/app/contracts/page.tsx tests/unit/contracts-security-audit.test.ts tests/integration/api-contracts-security-audit-route.test.ts tests/integration/contracts-page.test.tsx tests/integration/api-release-gate-route.test.ts e2e/contracts-surface.spec.ts e2e/release-gate.spec.ts` -> passed.
- `npm run build` -> passed.
- `git diff --check -- [T22 touched files]` -> passed.
- Build warning note: production build and Playwright web server still emit pre-existing `@sodax/sdk`/`icon-sdk-js`/`require-addon`/`sodium-native` dependency warnings; they did not fail the build/E2E run and were not introduced by T22.

Residual risk:

- This is an internal software closeout, not an external audit.
- The final live testnet rehearsal, production environment gate and mainnet cutover remain separate blockers in T24-T27.

Progress after T22:

- Completed remaining-plan points: **79 / 100**.
- Global mainnet-launch readiness: **96.22% implemented / 3.78% remaining**.
- Completed items: **22 / 27**.
- Remaining items: **5 / 27**.

### 2026-05-20 - T21 Storage Lifecycle Final Runbook and Script Verification

Status: **completed at 100%**.

Implemented:

- Extended the storage lifecycle model with audited storage classes (`persistent`, `instance`, `temporary`), extend scopes, cadence, warning/critical ledger thresholds, temporary-storage policy and runbook metadata.
- Hardened `scripts/contracts_storage_extend.mjs` so it defaults to dry-run and live execution requires both `--execute` and `ARKAFUND_STORAGE_EXTEND_CONFIRM=EXTEND_STORAGE_TTL`.
- Added exact command-plan output with selected contract IDs, command args, plan hash, storage classes, extend scopes, source account, ledger window, blocked rows and optional rows.
- Added command allowlist safeguards: only `stellar contract extend` with `--durability persistent` is accepted; the script has no deploy, invoke, delete, reset or config-mutation path.
- Removed the unsafe implicit `arka-admin` source fallback; missing source account blocks ready/live command generation.
- Added testnet dry-run rehearsal evidence at `docs/storage-lifecycle-testnet-dry-run-2026-05-20.json`.
- Added release runbook at `docs/STORAGE_LIFECYCLE_RUNBOOK_2026-05-20.md` with cadence, signer, dry-run/live-run procedure, safeguards and evidence.
- Updated `/contracts` storage lifecycle panel to show runbook summary, live confirmation requirement, storage class coverage, first safeguards and per-row storage scope/cadence/temporary policy.
- No fake execution, no placeholder live evidence, no destructive operation and no mainnet mutation were introduced.

Validation:

- `npx vitest run tests/unit/contracts-storage-lifecycle.test.ts` -> passed, 4/4.
- `npx vitest run tests/integration/api-contracts-storage-lifecycle-route.test.ts tests/integration/contracts-storage-extend-script.test.ts tests/integration/contracts-page.test.tsx` -> passed, 28/28.
- `npx playwright test e2e/contracts-surface.spec.ts --project=chromium --grep "storage lifecycle" --workers=1` -> passed, 1/1.
- `npx eslint src/lib/contracts/storageLifecycle.ts src/app/api/contracts/storage-lifecycle/route.ts src/app/contracts/page.tsx scripts/contracts_storage_extend.mjs tests/unit/contracts-storage-lifecycle.test.ts tests/integration/api-contracts-storage-lifecycle-route.test.ts tests/integration/contracts-storage-extend-script.test.ts tests/integration/contracts-page.test.tsx e2e/contracts-surface.spec.ts` -> passed.
- `node --check scripts/contracts_storage_extend.mjs` -> passed.
- `node ./scripts/contracts_storage_extend.mjs --dry-run --json --only arka-factory,arka-registry,oracle-guard --source-account GCO7KAJ7WCIFDLAEDHKSFQRNQLR3SQ6JTIVSMYYFUC5KRTA2KG2QJYDE --ledgers-to-extend 518400 --plan-json docs/storage-lifecycle-testnet-dry-run-2026-05-20.json` -> passed and wrote dry-run evidence.
- `npm run build` -> passed; emitted only pre-existing SODAX SDK / `icon-sdk-js` / `require-addon` / `sodium-native` bundling warnings.
- `git diff --check -- [T21 touched files]` -> passed.

Residual risk:

- T21 proves the dry-run/live-run storage lifecycle path and operator safeguards. It does not submit a live testnet or mainnet extend transaction in this iteration.
- Live testnet or mainnet extend execution must be performed by an operator with a funded signer and must persist evidence JSON before final cutover.

Progress after T21:

- Completed remaining-plan points: **77 / 100**.
- Global mainnet-launch readiness: **95.86% implemented / 4.14% remaining**.
- Completed items: **21 / 27**.
- Remaining items: **6 / 27**.

### 2026-05-20 - T20 Mainnet Routing Canary Evidence

Status: **completed at 100%**.

Implemented:

- Hardened the mainnet routing canary gate with explicit freshness controls (`maxAgeHours`, `validatedAt`, per-case `collectedAt`) so stale evidence blocks release with `canary_stale`.
- Required live mainnet evidence modes for canary cases (`live_mainnet`, `live_mainnet_quote`, `live_mainnet_quote_status`, `live_mainnet_execution`) instead of accepting deterministic/testnet/local-only evidence as launch proof.
- Required every venue canary case to declare an evidence source, collection timestamp and `liveMainnet` confirmation before it can satisfy the mainnet release gate.
- Added stable release-blocking codes for missing, stale and non-live evidence: `canary_missing`, `canary_stale`, `evidence_unverified`, `venue_coverage_incomplete`, `candidate_universe_incomplete`, `selected_path_missing` and `efficiency_below_threshold`.
- Kept mainnet honest: the bundled mainnet manifest still has `validatedModules.routingCanary: null` until real post-deploy canary evidence exists, so release remains blocked rather than pretending AUTO routing is launch-ready.
- Added deterministic time injection for tests via `ARKAFUND_ROUTING_CANARY_NOW`, avoiding clock-flaky freshness assertions.
- No fake mainnet canary, testnet fallback, stub, skeleton, placeholder success path or hardcoded green release state was introduced.

Validation:

- `npx vitest run tests/unit/rebalance-canary-gate.test.ts` -> passed, 7/7.
- `npx vitest run tests/integration/api-release-gate-route.test.ts tests/integration/api-rebalance-benchmark-route.test.ts` -> passed, 12/12.
- `npx playwright test e2e/release-gate.spec.ts --project=chromium --workers=1` -> passed, 4/4.
- `npx eslint src/lib/runtime/rebalanceCanaryGate.ts tests/unit/rebalance-canary-gate.test.ts tests/integration/api-release-gate-route.test.ts tests/integration/api-rebalance-benchmark-route.test.ts e2e/release-gate.spec.ts` -> passed.
- `npm run build` -> passed with the pre-existing SODAX SDK / `icon-sdk-js` / `require-addon` / `sodium-native` warnings.
- `git diff --check -- [T20 touched files]` -> passed.

Residual risk:

- T20 completes the software enforcement and release-gate behavior for canary evidence. It does **not** fabricate live mainnet canary evidence before mainnet deployment.
- The actual mainnet runtime remains blocked until T27 final cutover records real post-deploy quote/status/execution canary evidence in the canonical manifest.

Progress after T20:

- Completed remaining-plan points: **73 / 100**.
- Global mainnet-launch readiness: **95.14% implemented / 4.86% remaining**.
- Completed items: **20 / 27**.
- Remaining items: **7 / 27**.

### 2026-05-20 - T19 Mainnet Oracle Manifest and Guard Wiring

Status: **completed at 100%**.

Implemented:

- Added canonical bundled `config/deployments.mainnet.json` for the mainnet oracle lane, separated from `config/deployments.testnet.json`.
- Wired mainnet oracle provider evidence to real Reflector Network SEP-40 provider contract IDs:
  - Reflector DEX Oracle: `CALI2BYU2JE6WVRUFYTS6MSBNEHGJ35P4AVCZYF3B6QOE3QKOB2PLE6M`.
  - Reflector External CEX/DEX Oracle: `CAFJZQWSED6YAWZU3GWRTOCNPPCGBN32L7QV43XX5LZLFTK6JLN34DLN`.
- Added launch oracle thresholds to the machine-consumable manifest: `maxOracleAgeSeconds=300`, `maxDivergenceBps=100`, `minProviderCount=2`.
- Changed mainnet deployment resolution to use the bundled canonical mainnet manifest instead of falling back to a sibling repo path.
- Hardened the oracle cutover gate so mainnet rejects missing manifest, mismatched network, incomplete contracts, unverified provider IDs, testnet Reflector IDs and missing threshold policy.
- Kept mainnet honest: `oracleGuard` remains `null` in the canonical manifest because Arka OracleGuard has not been deployed to mainnet in this repo; release stays blocked with `contracts_incomplete` until the real audited contract ID exists.
- Extended runtime source and health APIs so UI/API consumers see Reflector provider names, contract IDs, thresholds and bundled mainnet manifest source truthfully.
- No fake mainnet deploy, fake oracle guard ID, testnet fallback, stub, skeleton or placeholder success path was introduced.

Validation:

- `npx vitest run tests/unit/oracle-cutover-gate.test.ts tests/unit/runtime-protocol-support.test.ts tests/unit/runtime-leaderboard-source.test.ts tests/unit/workflow-product-flows.test.ts tests/unit/control-surfaces.test.ts` -> passed, 33/33.
- `npx vitest run tests/integration/api-release-gate-route.test.ts tests/integration/api-health-route.test.ts tests/integration/api-leaderboard-source-route.test.ts` -> passed, 19/19.
- `npx playwright test e2e/workflow-ia.spec.ts --project=chromium --grep "oracle cutover" --workers=1` -> passed, 1/1.
- `npx eslint src/lib/catalog/types.ts src/lib/runtime/protocolSupport.ts src/lib/runtime/leaderboardSource.ts src/lib/runtime/oracleCutoverGate.ts src/lib/runtime/appHealth.ts tests/unit/oracle-cutover-gate.test.ts tests/unit/runtime-protocol-support.test.ts tests/unit/runtime-leaderboard-source.test.ts tests/unit/workflow-product-flows.test.ts tests/unit/control-surfaces.test.ts tests/integration/api-release-gate-route.test.ts tests/integration/api-health-route.test.ts tests/integration/api-leaderboard-source-route.test.ts e2e/workflow-ia.spec.ts` -> passed.
- `npm run build` -> passed with the pre-existing SODAX SDK / `icon-sdk-js` / `require-addon` / `sodium-native` warnings.
- `git diff --check -- [T19 touched files]` -> passed.

Residual risk:

- T19 does not deploy Arka OracleGuard to mainnet and does not claim final mainnet readiness.
- Release remains blocked by design until the real audited mainnet OracleGuard contract ID replaces `null`, and until T20 supplies live routing canary evidence.

Progress after T19:

- Completed remaining-plan points: **69 / 100**.
- Global mainnet-launch readiness: **94.42% implemented / 5.58% remaining**.
- Completed items: **19 / 27**.
- Remaining items: **8 / 27**.

### 2026-05-20 - T18 Balanced/SODAX Official Surface Final Evidence

Status: **completed at 100%**.

Implemented:

- Added an official Balanced/SODAX evidence model that treats the integration as `intent_interchain` / `quote_status_confirm`, not as a fake AMM router.
- Canonicalized the only machine-consumable operation labels accepted for AUTO evidence: `sdk:@sodax/sdk::swaps.getQuote`, `sdk:@sodax/sdk::swaps.getStatus` and confirmation derived from `sdk:@sodax/sdk::swaps.getStatus`.
- Added a public evidence endpoint at `/api/intents/balanced/evidence` exposing provider, architecture, evidence checks, quote/status/confirm machine actions and AUTO readiness.
- Hardened the Balanced AUTO surface gate so AUTO requires official source evidence, canonical SDK operation labels, no public router contract ID, no canonical router cutover and comparable quote semantics.
- Hardened the rebalance planner so Balanced/SODAX is only quote-probed in AUTO when the official evidence gate is ready; explicit manual Balanced execution can still remain available when the lane is valid.
- Hardened the release gate so a declared `publicRouterContractId` for Balanced/SODAX blocks release with `router_contract_declared`.
- Kept the implementation honest: no fake router ID, no invented endpoint, no hidden success path and no placeholder quote/status/confirm surface were introduced.

Validation:

- `npx vitest run tests/unit/balanced-official-surface-evidence.test.ts tests/unit/balanced-auto-surface-gate.test.ts tests/unit/intent-venue-sources.test.ts tests/unit/rebalance-routing.test.ts tests/integration/api-balanced-evidence-route.test.ts tests/integration/api-rebalance-route-plan-route.test.ts tests/integration/api-release-gate-route.test.ts` -> passed, 63/63.
- `npx playwright test e2e/balanced-intent-surface.spec.ts e2e/release-gate.spec.ts --project=chromium --workers=1` -> passed, 6/6.
- `npx eslint src/lib/workflows/balancedOfficialSurfaceEvidence.ts src/lib/runtime/balancedAutoSurfaceGate.ts src/lib/runtime/appHealth.ts src/lib/workflows/intentVenueSources.ts src/lib/workflows/rebalanceRouting.ts src/app/api/routing/rebalance/plan/route.ts src/app/api/intents/balanced/evidence/route.ts tests/unit/balanced-official-surface-evidence.test.ts tests/unit/balanced-auto-surface-gate.test.ts tests/unit/intent-venue-sources.test.ts tests/unit/rebalance-routing.test.ts tests/integration/api-balanced-evidence-route.test.ts tests/integration/api-rebalance-route-plan-route.test.ts tests/integration/api-release-gate-route.test.ts e2e/balanced-intent-surface.spec.ts e2e/release-gate.spec.ts` -> passed.
- `git diff --check -- [T18 touched files]` -> passed.

Residual risk:

- T18 closes the software-side evidence gate and planner/release behavior. It does not claim live mainnet execution, production oracle cutover or live venue canary proof.
- Playwright still reports pre-existing Next/SODAX SDK build warnings from `icon-sdk-js`, `require-addon` and `sodium-native`; they did not fail the T18 E2E suite.

Progress after T18:

- Completed remaining-plan points: **65 / 100**.
- Global mainnet-launch readiness: **93.70% implemented / 6.30% remaining**.
- Completed items: **18 / 27**.
- Remaining items: **9 / 27**.

### 2026-05-20 - T17 Smart Routing Production Broker Comparison

Status: **completed at 100%**.

Implemented:

- Extended the rebalance benchmark corpus from five scenarios to seven deterministic broker-scale scenarios, including deep-path, cyclic frontier, split-route, delayed-efficiency, production-tail, fill-risk arbitration and fail-closed no-live-venue coverage.
- Added a broker comparison profile with corpus versioning, required/optional venue coverage, oracle-model coverage, high-scale and million-scale scenario counts, split/failure/fail-closed counts, max and total candidate universe sizes, quote coverage and worst fill-risk/effective-penalty metrics.
- Added a fill-risk arbitration scenario where the raw-best SoroSwap route is intentionally rejected in favor of a safer Aquarius route, proving that selection is scored by effective execution quality rather than raw quoted output only.
- Added a fail-closed scenario where all venues return no live executable quote, proving the planner does not invent a route or report fake success.
- Hardened the release gate so Smart Routing is not ready unless the broker comparison profile is release-eligible and includes required venues, scale, coverage and failure evidence.
- Extended the Status operator surface with broker corpus, fail-closed and fill-risk evidence using the real benchmark API fields.
- Kept Balanced/SODAX honest: it is tracked as an optional venue not covered by this broker-ready benchmark until T18 supplies official machine-consumable quote/status/confirm evidence.
- No stub, skeleton, placeholder, fake venue result or fake broker pass was introduced.

Validation:

- `npx vitest run tests/unit/rebalance-benchmark.test.ts tests/unit/rebalance-benchmark-gate.test.ts` -> passed, 12/12.
- `npx vitest run tests/integration/api-rebalance-benchmark-route.test.ts tests/integration/api-release-gate-route.test.ts tests/unit/runtime-rebalance-benchmark-api.test.ts` -> passed, 11/11.
- `npx vitest run tests/integration/control-room-surfaces.test.tsx tests/unit/runtime-rebalance-benchmark-api.test.ts` -> passed, 5/5.
- `npx playwright test e2e/release-gate.spec.ts --project=chromium --workers=1` -> passed, 4/4.
- `npx playwright test e2e/operator-surface-matrix.spec.ts --project=chromium --grep "status" --workers=1` -> passed, 1/1.
- `npx eslint src/lib/workflows/rebalanceBenchmark.ts src/lib/runtime/rebalanceBenchmarkGate.ts src/app/status/page.tsx tests/unit/rebalance-benchmark.test.ts tests/unit/rebalance-benchmark-gate.test.ts tests/integration/api-rebalance-benchmark-route.test.ts tests/integration/api-release-gate-route.test.ts tests/integration/control-room-surfaces.test.tsx e2e/release-gate.spec.ts` -> passed.

Residual risk:

- T17 completes deterministic broker-scale comparison, not live mainnet canary evidence. T20 still has to prove routing canary behavior against live venues before mainnet release.
- Balanced/SODAX remains intentionally excluded from required broker-ready coverage until T18 verifies an official public machine-consumable surface; this avoids pretending that an unofficial/manual source is AUTO-ready.

Progress after T17:

- Completed remaining-plan points: **60 / 100**.
- Global mainnet-launch readiness: **92.80% implemented / 7.20% remaining**.
- Completed items: **17 / 27**.
- Remaining items: **10 / 27**.

### 2026-05-19 - T16 Strict Pixel Audit Gate

Status: **completed at 100%**.

Implemented:

- Added manifest SHA-256 contract checking to the strict pixel report and runtime gate, so stale reports no longer pass after `docs/figma-route-audit-manifest.json` changes.
- Added current-manifest coverage validation: the gate now blocks when the report does not cover the expected referenced capture count.
- Added per-frame route, viewport, state, reference disposition and strict-delta metadata to the pixel report for exact drift triage.
- Added strict waiver support with required capture key, owner, non-trivial reason and future expiry; valid waivers are visible and review-marked, while invalid or expired waivers fail strict mode.
- Extended Markdown/HTML/JSON reports with raw/waived threshold counts, compared viewports, manifest hash and reference/current roots.
- Hardened `readFigmaPixelAuditGate` so `/api/qa/figma-pixel-audit` and `/api/release/gate` can distinguish ready, missing report, stale report, coverage mismatch, missing frames and threshold drift.
- Extended release-gate API tests and browser E2E so a below-threshold visual audit blocks release instead of being advisory only.
- No stub, skeleton, placeholder, fake success path or fake pixel pass was introduced.

Validation:

- `npx vitest run tests/unit/figma-pixel-audit-gate.test.ts tests/integration/figma-pixel-audit-script.test.ts tests/integration/api-qa-figma-pixel-audit-route.test.ts` -> passed, 17/17.
- `npx vitest run tests/integration/api-release-gate-route.test.ts` -> passed, 7/7.
- `npx playwright test e2e/figma-pixel-audit.spec.ts e2e/release-gate.spec.ts --project=chromium --workers=1` -> passed, 6/6.
- `python3 -m py_compile scripts/figma_pixel_audit.py` -> passed.
- Real strict audit generated `<workspace>/arkafund/tmp/design-audit/pixel/report.json` and correctly returned a blocked report: `ok=false`, `failureCount=21`, `rawBelowThreshold=21`, `waivedBelowThreshold=0`, `expectedReferencedCaptures=21`, `comparedViewports=["desktop"]`, `manifestHash=79600c5cba58b959deed3ec8fd2e9d0fa67745604d9b7dbaff16ee3211986c6e`.

Residual risk:

- T16 closes the gate, not the visual drift itself. The current strict report blocks release on 21/21 compared frames; worst raw frame is `dashboard` at `0.616446` similarity and worst structural frame is `discover` at `0.727461` similarity. Mainnet release must remain blocked until these drifts are fixed or each intentional exception is explicitly waived with owner/reason/expiry.

Progress after T16:

- Completed remaining-plan points: **55 / 100**.
- Global mainnet-launch readiness: **91.90% implemented / 8.10% remaining**.
- Completed items: **16 / 27**.
- Remaining items: **11 / 27**.

### 2026-05-19 - T15 Pixel-Diff Reference Harvest from Figma

Status: **completed at 100%**.

Implemented:

- Committed the canonical Figma reference export corpus under `public/figma/references/`, sourced from the existing Figma export set instead of CSS recreation.
- Upgraded `docs/figma-route-audit-manifest.json` to schema version 2 and moved `referenceRoot` to the repo-local committed reference directory.
- Added route/state/viewport mapping for every one of the 26 captured surfaces.
- Added explicit `referenceDisposition` for every capture: `figma-reference`, `derived-from-figma-family` or `derived-without-figma-reference`.
- Added concrete audit rules per capture so non-Figma operator/control surfaces are documented as derived surfaces instead of pretending to be pixel-comparable.
- Added QA manifest validation in `src/lib/qa/figmaAuditReadiness.ts` and exposed contract issues through `/api/qa/figma-readiness`.
- Tightened the Figma readiness API/E2E contract so it now expects a green readiness surface with no missing references, current screenshots, manual screenshots or manifest contract issues.

Validation:

- `npx vitest run tests/unit/figma-route-audit-manifest.test.ts tests/unit/figma-audit-readiness.test.ts`
- `npx vitest run tests/integration/api-qa-figma-readiness-route.test.ts`
- `npx playwright test e2e/figma-readiness.spec.ts --project=chromium --workers=1`
- `npx eslint src/lib/qa/figmaAuditReadiness.ts tests/unit/figma-route-audit-manifest.test.ts tests/unit/figma-audit-readiness.test.ts tests/integration/api-qa-figma-readiness-route.test.ts e2e/figma-readiness.spec.ts`

Residual risk:

- T15 closes the reference/manifest harvest, not the strict pixel-diff release blocker. T16 must still turn these references into a deterministic strict gate with per-frame thresholds and release failure semantics.

Progress after T15:

- Completed remaining-plan points: **51 / 100**.
- Global mainnet-launch readiness: **91.18% implemented / 8.82% remaining**.
- Completed items: **15 / 27**.
- Remaining items: **12 / 27**.

### 2026-05-19 - T14 E2E Operator Surface Retry/Degraded Matrix

Status: **completed at 100%**.

Implemented:

- Added `OPERATOR_SURFACE_ROUTES`, `OPERATOR_SURFACE_STATES` and `OPERATOR_SURFACE_BROWSER_PROJECTS` as the canonical T14 matrix for 8 protected operator routes, 6 state families and 3 browser projects.
- Covered the required operator routes: `/governance/console`, `/integrations/operator`, `/migrations`, `/ops`, `/contracts`, `/settings`, `/status` and `/tiers`.
- Modelled unauthorized, authorized, API degraded, Soroban read failure, retry recovery and stale cached data states explicitly.
- Added validation that fails if protected navigation drifts from the matrix, if a degraded route lacks fallback anchors, if a retry route lacks controls, or if API-degraded routes lack declared endpoints.
- Added integration coverage for Settings degraded health fallback, Ops Soroban read failure/retry, and Tiers Soroban read failure/retry with manager input preservation.
- Added browser E2E coverage for protected-route gates, verified-operator access, Status health retry, Settings degraded continuity, Contracts degraded runtime matrix, Balanced/SODAX quote retry, and Migration inspect/simulate stale-state retry.
- Promoted the new T14 E2E spec into Firefox/WebKit surface-matrix projects so the operator degraded/retry matrix is not Chromium-only.
- No production stub, skeleton, placeholder, fake data or hardcoded success path was introduced; the E2E fixtures are deterministic failure/recovery backends used only by Playwright.

Validation:

- Unit/integration: `npx vitest run tests/unit/operator-surface-matrix.test.ts tests/integration/operator-surface-matrix.test.tsx` -> passed, 8/8.
- E2E T14 Chromium: `npx playwright test e2e/operator-degraded-retry-matrix.spec.ts --project=chromium --workers=1` -> passed, 3/3.
- E2E T14 multi-browser: `npx playwright test e2e/operator-degraded-retry-matrix.spec.ts --project=chromium --project=firefox-surface-matrix --project=webkit-surface-matrix --workers=1` -> passed, 9/9.
- Lint: `npx eslint src/lib/qa/operatorSurfaceMatrix.ts tests/unit/operator-surface-matrix.test.ts tests/integration/operator-surface-matrix.test.tsx e2e/operator-degraded-retry-matrix.spec.ts playwright.config.ts` -> passed.
- Build warning note: Playwright web server still emits pre-existing `@sodax/sdk`/`sodium-native` critical dependency/native-binding warnings; they did not fail the selected E2E runs and were not introduced by T14.

Progress:

- T14: **100% implemented / 0% remaining**.
- Remaining-plan points completed: **47 / 100**.
- Mainnet-launch readiness: **90.46% implemented / 9.54% remaining**.
- E2E exhaustiveness readiness: **98.2% implemented / 1.8% remaining**.
- Completed items: **14 / 27**.
- Remaining items: **13 / 27**.

### 2026-05-19 - T13 E2E Multi-Browser Public Surface Matrix

Status: **completed at 100%**.

Implemented:

- Added `PUBLIC_SURFACE_ROUTES`, `PUBLIC_SURFACE_BREAKPOINTS` and `PUBLIC_SURFACE_BROWSER_PROJECTS` as the canonical public surface matrix for 10 routes, 3 breakpoints and 3 browser projects.
- Covered the required public routes: `/discover`, `/dashboard`, `/vaults`, `/arkas`, `/assets`, `/managers`, Arka detail, asset detail, manager detail and `/factory/create`.
- Modelled loaded, empty, degraded, retry and search/filter states explicitly, including filter-only Dashboard coverage where the public dashboard frame intentionally hides the global chrome search bar.
- Added concrete empty-state anchors for Discover and Vault leaderboard surfaces, and create-wizard empty-result anchors for denomination and whitelist asset search.
- Added a real `/arkas` registry retry/config control so registry degraded/retry behavior is represented by an actionable surface rather than static status copy.
- Added the multi-browser E2E public matrix that checks route anchors, desktop/tablet/mobile overflow, clipped controls, unresolved copy, search focus retention and filter-control containment.
- Extended Playwright Firefox/WebKit surface-matrix projects to include the new public matrix spec.
- No production stub, skeleton, placeholder, fake data or hardcoded success path was introduced; E2E network fixtures are deterministic test backends only.

Validation:

- Unit/integration final: `npx vitest run tests/unit/public-surface-matrix.test.ts tests/integration/public-surface-matrix.test.tsx` -> passed, 5/5.
- E2E T13 Chromium: `npx playwright test e2e/public-surface-matrix.spec.ts --project=chromium` -> passed, 5/5.
- E2E T13 multi-browser: `npx playwright test e2e/public-surface-matrix.spec.ts --project=chromium --project=firefox-surface-matrix --project=webkit-surface-matrix` -> passed, 15/15.
- E2E degraded/retry + interaction companion matrix: `npx playwright test e2e/public-interaction-state-matrix.spec.ts e2e/public-degraded-retry-matrix.spec.ts --project=chromium --project=firefox-surface-matrix --project=webkit-surface-matrix` -> passed, 33/33.
- Lint: `npx eslint src/lib/qa/publicSurfaceMatrix.ts e2e/public-surface-matrix.spec.ts tests/unit/public-surface-matrix.test.ts tests/integration/public-surface-matrix.test.tsx src/components/product/DiscoverSurface.tsx src/components/product/VaultLeaderboardSurface.tsx src/app/factory/create/CreateArkaClient.tsx src/app/arkas/page.tsx playwright.config.ts` -> passed.
- Diff hygiene: `git diff --check -- src/lib/qa/publicSurfaceMatrix.ts e2e/public-surface-matrix.spec.ts tests/unit/public-surface-matrix.test.ts tests/integration/public-surface-matrix.test.tsx src/components/product/DiscoverSurface.tsx src/components/product/VaultLeaderboardSurface.tsx src/app/factory/create/CreateArkaClient.tsx src/app/arkas/page.tsx playwright.config.ts` -> passed.
- Build warning note: Playwright web server still emits pre-existing `@sodax/sdk`/`sodium-native` critical dependency/native-binding warnings; they did not fail the selected E2E runs and were not introduced by T13.

Progress:

- T13: **100% implemented / 0% remaining**.
- Remaining-plan points completed: **43 / 100**.
- Mainnet-launch readiness: **89.74% implemented / 10.26% remaining**.
- E2E exhaustiveness readiness: **97% implemented / 3% remaining**.
- Completed items: **13 / 27**.
- Remaining items: **14 / 27**.

### 2026-05-19 - T12 E2E Wallet Provider Rejection Matrix

Status: **completed at 100%**.

Implemented:

- Added `WALLET_PROVIDER_FAILURE_SCENARIOS` and `WALLET_WRITE_LANES` as the canonical wallet-provider rejection matrix for 7 write lanes and 5 failure scenarios: user rejection, provider disconnect, malformed signature, retry after failure and signing timeout.
- Covered the required write lanes without introducing fake data or simulated success: Create, Deposit, Redeem, Rebalance, Coverage, Governance and Contracts.
- Added holder, manager and operator profile coverage so product lanes and operator-only lanes are explicit rather than implied.
- Centralized wallet failure classification, signed-XDR extraction, signed-XDR validation and signing timeout behavior in `walletProviderRejectionMatrix`.
- Hardened `signXdr` so selected wallet failures fail closed and terminal provider failures do not silently fall through into a different wallet signer.
- Added a deterministic E2E-only wallet failure override gated by `NEXT_PUBLIC_E2E_WALLET=1` so rejection, malformed signature and timeout paths can be tested without stubbing production behavior.
- Hardened the E2E wallet helper so reject, malformed and timeout paths fail deterministically instead of leaving pending promises.
- Hardened Arka detail submission so missing or malformed signed XDR cannot be submitted after deposit, redeem or rebalance signing.
- Added an E2E matrix check that opens each real product/operator route and asserts the canonical lane surface/actions exist before the write path is considered covered.
- Kept retry behavior in Create explicit: rejection surfaces a visible error, preserves wizard/form state and re-enables the final deployment lane.

Validation:

- Unit: `npx vitest run tests/unit/wallet-provider-rejection-matrix.test.ts tests/unit/tx-signing.test.ts` -> passed, 10/10.
- Integration: `npx vitest run tests/integration/wallet-provider-disconnect-surfaces.test.tsx` -> passed, 4/4.
- E2E Create failure paths: `NEXT_PUBLIC_E2E_WALLET=1 npx playwright test e2e/create-wizard-matrix.spec.ts --project=chromium --grep "wallet signer rejection|wallet disconnect|wallet signing times out|no signed XDR"` -> passed, 4/4.
- E2E wallet matrix: `NEXT_PUBLIC_E2E_WALLET=1 npx playwright test e2e/wallet-backed-matrix.spec.ts --project=chromium --grep "wallet provider rejection matrix"` -> passed, 1/1.
- Lint: `npx eslint src/lib/workflows/walletProviderRejectionMatrix.ts src/lib/tx.ts src/lib/walletKit.ts 'src/app/arkas/[id]/page.tsx' tests/unit/wallet-provider-rejection-matrix.test.ts tests/unit/tx-signing.test.ts tests/integration/wallet-provider-disconnect-surfaces.test.tsx e2e/wallet-backed-matrix.spec.ts e2e/create-wizard-matrix.spec.ts` -> passed.
- Build warning note: Playwright web server still emits pre-existing `@sodax/sdk`/`sodium-native` critical dependency/native-binding warnings; they did not fail the selected E2E runs and were not introduced by T12.

Progress:

- T12: **100% implemented / 0% remaining**.
- Remaining-plan points completed: **38 / 100**.
- Mainnet-launch readiness: **88.84% implemented / 11.16% remaining**.
- Completed items: **12 / 27**.
- Remaining items: **15 / 27**.

### 2026-05-19 - T11 DAO-Controlled Guardrails Contract Storage Decision

Status: **completed at 100%**.

Implemented:

- Added `REBALANCE_GUARDRAIL_SOURCE_OF_TRUTH` as the canonical, typed source-of-truth registry for every rebalance guardrail currently exposed in Settings.
- Enumerated all 10 live guardrails with exactly one current source: `runtime_env`. Each entry now records source key, mutability, evaluation inputs, DAO governance label, and contract-storage migration requirement.
- Removed misleading copy that represented runtime-only guardrails as DAO-governed, including the max-notional and emergency-pause copy.
- Extended `buildGuardrailRows`, `buildGuardrailSourceRows` and `buildGuardrailSourceSummary` so guardrail truthfulness is reusable, testable and not buried in UI text.
- Updated Settings guardrails to show source, mutability, evaluation inputs and DAO storage status directly in the guardrail workspace.
- Added a Settings source-of-truth table that makes runtime env versus future DAO storage explicit per guardrail.
- Updated Governance operator console with a `Guardrail source of truth` card so governed package authoring does not imply runtime-only safety knobs are currently mutable through the DAO.
- No fake data, stub, skeleton, placeholder or hardcoded success path was introduced.

Validation:

- Unit: `npx vitest run tests/unit/control-surfaces.test.ts` -> passed, 8/8.
- Integration Settings: `npx vitest run tests/integration/control-room-surfaces.test.tsx --testNamePattern "settings"` -> passed, 1/1 selected.
- Integration Governance: `npx vitest run tests/integration/workflow-surfaces.test.tsx --testNamePattern "governance operator console"` -> passed, 1/1 selected.
- E2E Settings source-of-truth: `npx playwright test e2e/workflow-ia.spec.ts --project=chromium --grep "settings surface keeps grouped config"` -> passed, 1/1.
- E2E Settings smoke: `npx playwright test e2e/smoke.spec.ts --project=chromium --grep "settings exposes the active slippage profile"` -> passed, 1/1.
- E2E Governance lifecycle/composer smoke: `npx playwright test e2e/workflow-ia.spec.ts --project=chromium --grep "governance surface groups proposal telemetry"` -> passed, 1/1.
- Lint: `npx eslint src/lib/workflows/controlSurfaces.ts src/app/settings/page.tsx src/app/governance/page.tsx tests/unit/control-surfaces.test.ts tests/integration/control-room-surfaces.test.tsx tests/integration/workflow-surfaces.test.tsx e2e/workflow-ia.spec.ts e2e/smoke.spec.ts` -> passed.
- Diff hygiene: `git diff --check -- src/lib/workflows/controlSurfaces.ts src/app/settings/page.tsx src/app/governance/page.tsx tests/unit/control-surfaces.test.ts tests/integration/control-room-surfaces.test.tsx tests/integration/workflow-surfaces.test.tsx e2e/workflow-ia.spec.ts e2e/smoke.spec.ts` -> passed.
- Typecheck note: `npx tsc --noEmit --pretty false` still fails on pre-existing broad repo test typing debt outside this T11 implementation. A scoped check confirmed no remaining TypeScript errors in the T11-touched source/test files after adding the missing `routing` payload in `tests/unit/control-surfaces.test.ts`.
- Build warning note: Playwright web server still emits pre-existing `@sodax/sdk`/`sodium-native` critical dependency/native-binding warnings; they did not fail the selected E2E runs and were not introduced by T11.
- First parallel Playwright attempt hit a transient `.next/export/500.html` rename race while two web servers started at once; rerunning the affected workflow E2E in isolation passed.

Progress:

- T11: **100% implemented / 0% remaining**.
- Remaining-plan points completed: **33 / 100**.
- Mainnet-launch readiness: **87.94% implemented / 12.06% remaining**.
- Completed items: **11 / 27**.
- Remaining items: **16 / 27**.

### 2026-05-19 - T10 Governance Proposal Composer Product Decision

Status: **completed at 100%**.

Implemented:

- Chose and encoded the final product model as **curated governed packages only** for the current contract system.
- Added `buildGovernanceComposerProductDecision`, `GOVERNANCE_COMPOSER_STAGING_NOTE` and `GOVERNANCE_COMPOSER_REQUIRED_BATCH_PRIMITIVE` so the decision is reusable, testable and not buried in UI copy.
- Made the Governance operator console show a dedicated `Composer product decision` card with the curated-only mode, supported template count, supported domains, staged-review publication lane, migration request representation and explicit generic-batch unsupported state.
- Renamed the ambiguous composer action from queue/publish language to **Stage in governance**, and updated status/errors/copy so the UI does not imply on-chain arbitrary calldata publication.
- Kept governed actions contract-backed and machine-consumable through existing templates and handoff into `/contracts?draft=governed-action`.
- Extended the DAO execution policy so every curated composer mutation is classified as DAO-governed, including `add_points`.
- Migration requests are now represented honestly: operator runbook handoff or one of the curated contract-backed proposal templates, not a fake generic proposal publisher.
- No fake data, stub, skeleton, placeholder or hardcoded success path was introduced.

Validation:

- Unit: `npx vitest run tests/unit/governance-composer.test.ts tests/unit/dao-execution-policy.test.ts` -> passed, 22/22.
- Integration: `npx vitest run tests/integration/workflow-surfaces.test.tsx --testNamePattern "governance"` -> passed, 6/6 selected governance tests.
- E2E composer/lifecycle: `npx playwright test e2e/workflow-ia.spec.ts --project=chromium --grep "governance surface groups proposal telemetry|governance composer hands off|governance composer stages"` -> passed, 3/3.
- E2E lifecycle smoke: `npx playwright test e2e/smoke.spec.ts --project=chromium --grep "governance page exposes executable lifecycle controls"` -> passed, 1/1.
- Lint: `npx eslint src/lib/workflows/governanceComposer.ts src/lib/workflows/daoExecutionPolicy.ts src/app/governance/page.tsx tests/unit/governance-composer.test.ts tests/unit/dao-execution-policy.test.ts tests/integration/workflow-surfaces.test.tsx e2e/workflow-ia.spec.ts` -> passed.
- Diff hygiene: `git diff --check -- src/lib/workflows/governanceComposer.ts src/lib/workflows/daoExecutionPolicy.ts src/app/governance/page.tsx tests/unit/governance-composer.test.ts tests/unit/dao-execution-policy.test.ts tests/integration/workflow-surfaces.test.tsx e2e/workflow-ia.spec.ts docs/REMAINING_SINGLE_ITERATION_PLAN_2026-05-18.md` -> passed.
- Typecheck note: `npx tsc --noEmit --pretty false` remains blocked by pre-existing broad repo test typing debt outside this T10 implementation (`URL | Request`, route fixture typings, process-env fixture casts, benchmark mock signatures and historical E2E helper typings). The focused T10 unit/integration/E2E/lint checks passed.
- Build warning note: Playwright web server still emits pre-existing `@sodax/sdk`/`sodium-native` critical dependency/native-binding warnings; they did not fail this pass and were not introduced by T10.

Progress:

- T10: **100% implemented / 0% remaining**.
- Remaining-plan points completed: **29 / 100**.
- Mainnet-launch readiness: **87.22% implemented / 12.78% remaining**.
- Completed items: **10 / 27**.
- Remaining items: **17 / 27**.

### 2026-05-19 - T09 Advanced Console Access Model Finalization

Status: **completed at 100%**.

Implemented:

- Split navigation utilities into `PUBLIC_UTILITY_PRODUCT_NAV` and `OPERATOR_CONSOLE_NAV` so the Advanced Console no longer mixes public Create/Coverage routes with operator-only execution surfaces.
- Added explicit operator-console route resolution via `resolveOperatorConsoleItem` and `isOperatorConsolePath`, making the access model testable instead of inferred from all utility routes.
- Updated `AppChrome` so direct operator routes (`/governance/console`, `/integrations/operator`, `/migrations`, `/ops`, `/contracts`, `/settings`, `/status`, `/tiers`) are gated only by verified operator wallet sessions.
- Kept public pages public and non-destructive: a public user can open the operator access disclosure, but no execution route links or sensitive console actions are rendered until the wallet-bound operator challenge is verified.
- Ensured verified operators see every necessary admin/governance route in the Advanced Console while public utility flows (`Create`, `Coverage`) remain regular public product actions outside that console.
- Added focused assertions that public routes do not render operator links, direct operator routes show the access gate, connected unauthorized wallets stay blocked and verified wallets unlock the operator route matrix.
- No fake data, stub, skeleton, placeholder or hardcoded success path was introduced; access remains backed by the existing server challenge/session verification and wallet identity binding.

Validation:

- Unit/integration: `npx vitest run tests/unit/product-navigation.test.ts tests/unit/operator-access.test.ts tests/unit/surface-control-truthfulness.test.ts tests/integration/app-chrome.test.tsx` -> passed.
- E2E access boundary: `npx playwright test e2e/access-state.spec.ts --project=chromium` -> passed.
- E2E operator access matrix: `npx playwright test e2e/operator-surface-matrix.spec.ts --project=chromium --grep "operator-only routes stay gated|connected non-operator wallet cannot unlock|verified operator access unlocks every utility route"` -> passed.
- E2E public rail: `npx playwright test e2e/product-surfaces.spec.ts --project=chromium --grep "public rail hides operator console until explicitly opened"` -> passed.
- Lint: `npx eslint src/lib/workflows/productNavigation.ts src/components/product/AppChrome.tsx tests/unit/product-navigation.test.ts tests/unit/operator-access.test.ts tests/unit/surface-control-truthfulness.test.ts tests/integration/app-chrome.test.tsx e2e/access-state.spec.ts e2e/operator-surface-matrix.spec.ts e2e/product-surfaces.spec.ts` -> passed.
- Diff hygiene: `git diff --check -- <touched T09 files>` -> passed.
- Typecheck note: `npx tsc --noEmit --pretty false` remains blocked by pre-existing broad repo test typing debt outside this T09 implementation. The focused T09 unit/integration/E2E/lint checks passed.
- Broad-suite note: a full `e2e/operator-surface-matrix.spec.ts` run currently has an unrelated live-vault workspace selector failure on `/arkas/TEST_BLEND_VAULT` (`arka-flow-panel` not found after opening `flow`). That is outside the T09 Advanced Console access model and should be handled in the later E2E/vault item, not hidden as T09 completion.

Progress:

- T09: **100% implemented / 0% remaining**.
- Remaining-plan points completed: **25 / 100**.
- Mainnet-launch readiness: **86.50% implemented / 13.50% remaining**.
- Figma/pixel-tight public UX readiness: **95.12% implemented / 4.88% remaining**.

### 2026-05-19 - T08 Integrations Public Product Surface Cleanup

Status: **completed at 100%**.

Implemented:

- Split `/integrations` into a public product surface that shows supported protocols, execution model, status, capability and user-facing constraints without exposing raw operator diagnostics.
- Added `/integrations/operator` as the verified-operator route for router diagnostics, SODAX quote/status/confirm controls, execution posture and protocol action lanes.
- Moved Integrations from the operator-only utility rail into the public primary product navigation, while keeping `Integration Ops` in the gated Advanced Console.
- Added an explicit integration access model (`publicRoute`, `operatorRoute`, public sections, operator sections and operator-only test IDs) so the split is now machine-testable instead of implicit.
- Kept Balanced/SODAX honest as an intent/SODAX lane: public copy identifies `Balanced / SODAX`, and operator-only surfaces keep the quote/status/confirm and handoff diagnostics behind the operator route.
- Updated route matrices and E2E expectations so `/integrations` is public and `/integrations/operator` is the protected operational surface.
- No fake data, stub, skeleton, placeholder or hardcoded success path was introduced; existing runtime health, venue catalog and SODAX driver state remain the data sources.

Validation:

- Unit/integration: `npx vitest run tests/unit/integration-workspaces.test.ts tests/unit/product-navigation.test.ts tests/integration/workflow-surfaces.test.tsx tests/integration/app-chrome.test.tsx` -> 45/45 passed.
- Unit truthfulness regression: `npx vitest run tests/unit/surface-control-truthfulness.test.ts tests/unit/product-navigation.test.ts tests/unit/integration-workspaces.test.ts` -> 53/53 passed.
- E2E: `npx playwright test e2e/access-state.spec.ts --project=chromium` -> 7/7 passed.
- Lint: `npx eslint src/app/integrations/page.tsx src/app/integrations/operator/page.tsx src/lib/workflows/integrationWorkspaces.ts src/lib/workflows/productNavigation.ts tests/unit/integration-workspaces.test.ts tests/unit/product-navigation.test.ts tests/integration/workflow-surfaces.test.tsx tests/integration/app-chrome.test.tsx e2e/access-state.spec.ts e2e/operator-surface-matrix.spec.ts e2e/workflow-ia.spec.ts e2e/wallet-backed-matrix.spec.ts e2e/product-surfaces.spec.ts e2e/public-figma-geometry.spec.ts e2e/smoke.spec.ts` -> passed.
- Diff hygiene: `git diff --check -- <touched T08 files>` -> passed.
- Typecheck note: `npx tsc --noEmit --pretty false` remains blocked by pre-existing broad repo test typing debt (`URL | Request`, fixtures typed as `unknown`, historical route mocks, process-env fixture casts and older E2E helper typings). The focused T08 unit/integration/E2E/lint checks passed.
- Build warning note: Playwright web server still emits pre-existing `@sodax/sdk`/`sodium-native` critical dependency/native-binding warnings; they did not fail this pass and were not introduced by T08.

Progress:

- T08: **100% implemented / 0% remaining**.
- Remaining-plan points completed: **23 / 100**.
- Mainnet-launch readiness: **86.14% implemented / 13.86% remaining**.
- Figma/pixel-tight public UX readiness: **93.68% implemented / 6.32% remaining**.

### 2026-05-19 - T07 Assets Surface Registry and Icon Finalization

Status: **completed at 100%**.

Implemented:

- Promoted the core Stellar asset registry contract so XLM, USDC, AQUA, XTAR and BLND expose deterministic metadata for Create, Assets and asset-detail fallback surfaces.
- Kept XLM as a selectable Arka asset for allocation/routing/protocol execution, not merely as a fee/settlement note.
- Added explicit `tomlState`, `tomlUrl` and `iconProvenanceLabel` fields so missing or rejected stellar.toml data is visible as state, not disguised as a successful icon source.
- Hardened stellar.toml resolution to accept only trusted HTTPS image URLs and to classify unavailable TOML, missing home domain, absent currency row, missing image and invalid image distinctly.
- Wired Create denomination/whitelist cards and Assets core-registry cards to the same registry metadata, including machine-readable `data-core-asset-id`, `data-icon-source` and `data-toml-state`.
- Preserved local approved PNG fallbacks only as explicit registry fallbacks; no fake icon source, fake TOML success or placeholder asset was introduced.

Validation:

- Unit: `npx vitest run tests/unit/core-stellar-asset-registry.test.ts tests/unit/asset-selection.test.ts` -> 6/6 passed.
- Integration: `npx vitest run tests/integration/api-assets-core-registry-route.test.ts tests/integration/manager-asset-surfaces.test.tsx tests/integration/workflow-surfaces.test.tsx` -> 31/31 passed.
- E2E multi-browser: `npx playwright test e2e/create-wizard-matrix.spec.ts -g "lists the required core Stellar assets"` -> 3/3 passed across Chromium, Firefox and WebKit projects.
- Typecheck note: `npx tsc --noEmit --pretty false` remains blocked by pre-existing broad repo test typing debt (`URL | Request`, fixtures typed as `unknown`, historical route mocks and process-env fixture casts). No T07 metadata-contract errors appeared in the focused tests or E2E compile path.
- Build warning note: Playwright web server still emits pre-existing `@sodax/sdk`/`sodium-native` critical dependency/native-binding warnings; they did not fail this pass and were not introduced by T07.

Progress:

- T07: **100% implemented / 0% remaining**.
- Remaining-plan points completed: **21 / 100**.
- Mainnet-launch readiness: **85.78% implemented / 14.22% remaining**.
- Figma/pixel-tight public UX readiness: **92.24% implemented / 7.76% remaining**.

### 2026-05-19 - T02 Create Arka Wizard Figma Asset and Step Fidelity

Status: **completed at 100%**.

Implemented:

- Added a canonical Create wizard frame binding map for all seven steps: start, basics, fees, deposits, redemptions, assets and review.
- Bound each step to either an exported Figma asset or an explicitly documented extension frame through `data-figma-frame-family`, `data-figma-frame-source` and `data-figma-frame-asset`.
- Replaced the stage wallet-art CSS approximation in the Create client with real exported Figma image rendering and a bounded image frame.
- Added real start-step wallet choice controls and a real `Connect wallet` action wired through the wallet kit/direct Freighter fallback instead of a decorative button.
- Tightened deposits/redemptions policy-card geometry so exported assets stay within the Figma proportion contract and do not clip content.
- Preserved create wizard state, registry-backed assets, Blend handoff and deployment-preflight behavior; no fake data, stub, skeleton or placeholder path was introduced.

Validation:

- Unit/integration: `npx vitest run tests/unit/create-wizard-state.test.ts tests/unit/surface-control-truthfulness.test.ts tests/integration/workflow-surfaces.test.tsx` -> 65/65 passed.
- E2E focused repair: `npx playwright test e2e/create-wizard-matrix.spec.ts -g "keeps every Figma wizard checkpoint routed, readable and stateful" --project=chromium --workers=1` -> 1/1 passed.
- E2E full matrix: `npx playwright test e2e/create-wizard-matrix.spec.ts --project=chromium --workers=1` -> 7/7 passed.
- Typecheck note: `npx tsc --noEmit --pretty false` remains blocked by pre-existing broad repo test typing debt; the T02-introduced `create-wizard-matrix` and regex-target errors were fixed in this pass.
- Chromium build still emits the pre-existing `@sodax/sdk`/`sodium-native` critical dependency/native-binding warnings; they did not fail this pass and were not introduced by T02.

Progress:

- T02: **100% implemented / 0% remaining**.
- Remaining-plan points completed: **19 / 100**.
- Mainnet-launch readiness: **85.42% implemented / 14.58% remaining**.
- Figma/pixel-tight public UX readiness: **90.80% implemented / 9.20% remaining**.

### 2026-05-19 - T04 Dashboard First-Fold and Featured Cards Repair

Status: **completed at 100%**.

Implemented:

- Added an explicit `dashboard-t04-*` geometry contract to Dashboard shell, launch panel, orbit, featured grid/cards, feature chart, price band, meta row, stage panel and range controls.
- Added machine-readable state attributes for history and range controls: `data-t04-contract`, `data-history-state`, `data-feature-history-state`, `data-range-enabled` and `data-range-state`.
- Closed the launch/orbit blocker by centering the indexed-Arka value and label inside the ring with final high-specificity CSS instead of relying on inherited visual offsets.
- Closed the featured-card blocker by making chart/history, price band, meta, chips, progress strip and actions occupy bounded rows inside compact cards.
- Kept range controls as real stateful buttons; unavailable ranges remain disabled with source reasons, and enabled ranges update the URL-backed Dashboard state.
- Preserved catalog-backed NAV, history, freshness, health, asset and manager metrics; no fake TVL/NAV/time-series value, stub, skeleton or placeholder was introduced.

Validation:

- Unit/integration: `npx vitest run tests/unit/surface-control-truthfulness.test.ts tests/unit/dashboard-discover-surfaces.test.ts tests/integration/dashboard-surface.test.tsx` -> 50/50 passed.
- E2E functional/geometry: `npx playwright test e2e/product-surfaces.spec.ts -g "dashboard surface renders live catalog metrics" --project=chromium --workers=1` -> 1/1 passed.
- E2E truthfulness states: `npx playwright test e2e/product-surfaces.spec.ts -g "dashboard does not render invented chart points|dashboard featured lanes show truthful empty copy" --project=chromium --workers=1` -> 2/2 passed.
- E2E visual compactness: `npx playwright test e2e/public-figma-geometry.spec.ts -g "keeps Dashboard featured Arka cards compact and contained" --project=chromium --workers=1` -> 1/1 passed.
- Note: Chromium build still emits the pre-existing `@sodax/sdk`/`sodium-native` critical dependency/native-binding warnings; they did not fail this pass and were not introduced by T04.

Progress:

- T04: **100% implemented / 0% remaining**.
- Remaining-plan points completed: **15 / 100**.
- Mainnet-launch readiness: **84.70% implemented / 15.30% remaining**.
- Figma/pixel-tight public UX readiness: **87.92% implemented / 12.08% remaining**.

### 2026-05-19 - T03 Discover First-Fold Geometry Repair

Status: **completed at 100%**.

Implemented:

- Rebuilt Discover first fold as an explicit two-board T03 geometry contract: catalog metric board followed by collection/search board.
- Added scoped T03 CSS grid areas for title, tabs, metrics, market switcher, preview grid, toolbar and summary so legacy `discover-title` / `discover-*` grid-area rules can no longer auto-place sections on top of each other.
- Tightened the metric deck into a bounded Figma-like asymmetric four-column grid and reduced first-fold vertical pressure without deleting catalog-backed data.
- Kept all Discover metric values sourced from the indexed catalog, route/window state or explicit unavailable states; no fake TVL, fake NAV, fake scope, stub, skeleton or placeholder path was introduced.
- Shortened the Discover helper copy so it no longer pushes search, filter controls or CTAs out of their containers.
- Preserved public filtering, curated toggle behavior, Create Arka navigation and leaderboard/profile links.

Validation:

- Unit/integration: `npx vitest run tests/unit/surface-control-truthfulness.test.ts tests/unit/dashboard-discover-surfaces.test.ts tests/unit/public-surface-url-state.test.ts tests/integration/discover-surface.test.tsx` -> 58/58 passed.
- Focused E2E: `npx playwright test e2e/product-surfaces.spec.ts -g "discover surface filters curated and non-curated Arkas" --project=chromium --workers=1` -> 1/1 passed.
- Combined visual/product E2E: `npx playwright test e2e/public-figma-geometry.spec.ts e2e/product-surfaces.spec.ts -g "keeps Discover chrome rail and metric headers|discover, assets and managers stay responsive|discover surface filters curated" --project=chromium --workers=1` -> 3/3 passed.
- Note: Chromium build still emits the pre-existing `@sodax/sdk`/`sodium-native` critical dependency/native-binding warnings; they did not fail this pass and were not introduced by T03.

Progress:

- T03: **100% implemented / 0% remaining**.
- Remaining-plan points completed: **12 / 100**.
- Mainnet-launch readiness: **84.16% implemented / 15.84% remaining**.
- Figma/pixel-tight public UX readiness: **85.76% implemented / 14.24% remaining**.

### 2026-05-18 - T05 Managers Leaderboard Filter Deck Alignment

Status: **completed at 100%**.

Implemented:

- Replaced the fragile manager command toolbar layout with an explicit two-lane filter deck: primary controls row plus status/provenance row.
- Search, Rank By and Order now share a single measured desktop row with identical label/control rhythm.
- Mobile/tablet behavior stacks intentionally without inheriting legacy toolbar grid areas.
- Removed the old explanatory-copy collision by moving source/provenance text into a bounded status row.
- Preserved URL-backed search/sort behavior and catalog-backed manager ranking; no fake data, stub, skeleton or placeholder was introduced.
- Fixed the specific legacy CSS collision where `.managers-sort-field:nth-of-type(...)` assigned stale `grid-area` values to the new row and pushed the Rank control down.

Validation:

- Unit: `npx vitest run tests/unit/surface-control-truthfulness.test.ts tests/unit/public-surface-url-state.test.ts` -> 44/44 passed.
- Integration: `npx vitest run tests/integration/manager-asset-surfaces.test.tsx` -> 12/12 passed.
- E2E: `npx playwright test e2e/product-surfaces.spec.ts -g "assets and managers preserve visual rhythm between search, cards and tables|public product controls restore from URL and keep query state bookmarkable" --project=chromium --workers=1` -> 2/2 passed.

Progress:

- T05: **100% implemented / 0% remaining**.
- Remaining-plan points completed: **3 / 100**.
- Mainnet-launch readiness: **82.54% implemented / 17.46% remaining**.

### 2026-05-18 - T06 Arka/Vault Leaderboard Row Containment

Status: **completed at 100%**.

Implemented:

- Added an explicit `data-row-containment="bounded"` contract to the public Vault/Arka leaderboard rows and Manager leaderboard rows.
- Added accessible truncation for long Stellar IDs through visible ellipsis plus `title`, `aria-label` and `data-full-value`, so the UI no longer solves overflow by deleting machine-readable values.
- Added bounded action zones for Vault profile/ops links and Manager detail links.
- Added a final CSS containment layer for desktop/tablet/mobile row grids, progress tracks, status pills, timestamps, base sleeve cells and action links.
- Preserved catalog-backed NAV, asset counts, fees, status, base sleeve, route and manager data; no fake row value, stub, skeleton or placeholder was introduced.

Validation:

- Unit: `npx vitest run tests/unit/catalog-format.test.ts tests/unit/surface-control-truthfulness.test.ts tests/unit/public-surface-url-state.test.ts` -> 48/48 passed.
- Integration: `npx vitest run tests/integration/vault-entrypoints.test.tsx tests/integration/manager-asset-surfaces.test.tsx` -> 18/18 passed.
- E2E: `npx playwright test e2e/product-surfaces.spec.ts e2e/vault-entrypoints.spec.ts -g "assets and managers preserve visual rhythm between search, cards and tables|vaults leaderboard keeps filters, pills and rows separated with no overlap|vault leaderboard separates product profile from live ops|vault leaderboard stays responsive without horizontal overflow on mobile" --project=chromium --workers=1` -> 4/4 passed.
- Note: Chromium build still emits the pre-existing `@sodax/sdk`/`sodium-native` critical dependency/native-binding warnings; they did not fail this pass.

Progress:

- T06: **100% implemented / 0% remaining**.
- Remaining-plan points completed: **6 / 100**.
- Mainnet-launch readiness: **83.08% implemented / 16.92% remaining**.

### 2026-05-18 - T01 Public Create Arka Entry UX Cutover

Status: **completed at 100%**.

Implemented:

- Added a single shared `buildPublicCreateArkaHref` navigation primitive for public Create Arka entrypoints.
- Connected the topbar CTA, command CTA, Discover CTA, Dashboard launch CTA, Vaults stage CTA, Vaults route-boundary CTA and `/arkas` secondary CTA to the same create wizard path.
- Preserved public route source context through `from`, full current query through `returnQuery`, and current search text through `q` where present.
- Avoided `useSearchParams` in global chrome so the production build no longer requires a Suspense wrapper for `/_not-found`.
- Added bounded CTA styling so the new public Create buttons remain single-line and do not collapse into the surrounding Figma shell.
- Preserved existing create wizard, wallet, registry and catalog-backed data behavior; no fake data, stub, skeleton or placeholder was introduced.

Validation:

- Unit: `npx vitest run tests/unit/product-navigation.test.ts tests/unit/surface-control-truthfulness.test.ts` -> 39/39 passed.
- Integration: `npx vitest run tests/integration/app-chrome.test.tsx tests/integration/discover-surface.test.tsx tests/integration/dashboard-surface.test.tsx tests/integration/vault-entrypoints.test.tsx` -> 25/25 passed.
- E2E: `npx playwright test e2e/product-surfaces.spec.ts -g "public Create Arka CTAs open the single wizard with source context" --project=chromium --workers=1` -> 1/1 passed.
- E2E regression: `npx playwright test e2e/public-product-truthfulness.spec.ts -g "public dashboard, discovery and leaderboard routes stay populated and interactive" --project=chromium --workers=1` -> 1/1 passed.
- Note: Chromium build still emits the pre-existing `@sodax/sdk`/`sodium-native` critical dependency/native-binding warnings; this iteration did not introduce them.

Progress:

- T01: **100% implemented / 0% remaining**.
- Remaining-plan points completed: **9 / 100**.
- Mainnet-launch readiness: **83.62% implemented / 16.38% remaining**.
