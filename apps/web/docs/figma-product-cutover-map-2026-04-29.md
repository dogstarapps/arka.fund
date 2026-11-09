# Arka.fund Figma Product Cutover Map

Date: 2026-04-29
Figma file: `3RlH484r3hru8HUuqqM9e9/dogstar-value`

This document is the implementation contract for the visual cutover. It separates screens that are explicitly designed in Figma from platform functionality that is real but not represented in the design file. Figma-covered product screens must stay visually faithful. Non-Figma functionality must be added as extensions of the same visual system or isolated in the operator shell.

## Frame Inventory

| Figma node | Primary surface | Route target | Cutover status |
|---|---|---|---|
| `1:2` | Public dashboard / discovery home with TVL, deposits, fees, withdrawals and Arka lists | `/dashboard`, `/discover` | In progress: public metric deck + launch band implemented, strict pixel diff still pending |
| `34:7072` | Arkas Leaderboard with time filters, ranked rows and metric columns | `/arkas` | Pending full visual cutover |
| `61:7007` | Create Arka basics, wallet onboarding, profile context, denomination assets | `/factory/create?step=basics` | In progress |
| `39:300` | Arka detail with overview, portfolio, financials, fees, policies, depositors, activity and My Deposit tabs | `/vaults/[id]` | Pending full visual cutover |
| `42:433` | Build your Arkas now hero with Retail/Institutional paths and rocket artwork | `/factory/create` entry / `/discover` CTA | In progress: dashboard launch CTA is data-backed; exact artwork/frame parity pending |
| `66:7347` | Assets table with icons, amount, 24h movement, price and AUM | `/assets` | Pending full visual cutover |
| `87:15027` | Integrations product surface | `/integrations` | Pending split from operator control content |
| `90:22356` | Additional create/product screen in the same 1920x1080 series | TBD after detailed extraction | Pending extraction |
| `93:29642` | My Deposits / My Arkas / Activity lane | `/dashboard`, `/vaults/[id]` | Pending |
| `93:36898` | Create Arka Deposits step with warning, wallet-limit and deposit-limit cards | `/factory/create?step=deposits` | In progress |
| `113:76` | Additional product screen in final frame group | TBD after detailed extraction | Pending extraction |
| `114:481` | Additional product screen in final frame group | TBD after detailed extraction | Pending extraction |

## Product vs Operator Boundary

Public product routes are the surfaces a normal investor, manager or DAO participant should understand without seeing raw protocol internals. These routes must follow Figma wherever the frame exists:

- `/discover`
- `/dashboard`
- `/arkas`
- `/vaults/[id]`
- `/factory/create`
- `/assets`
- `/integrations` in product-read mode
- `/managers`
- `/coverage`
- `/governance` for standard proposal review and voting

Operator-only routes are real functionality, but they are not part of the public Figma product shell. They must remain wallet-gated and visually compatible without pretending they are consumer screens:

- `/contracts`
- `/ops`
- `/settings`
- `/status`
- `/tiers`
- advanced migrations and raw governed mutation workspaces

## Create Arka Cutover Rules

The Figma wizard is canonical for route structure:

1. `Before your start`
2. `Basics`
3. `Fees`
4. `Deposits`
5. `Redemptions`
6. `Assets management`
7. `Review`

The implementation must not collapse these into one large form. Fields that exist in contracts but not Figma must be placed in the nearest matching step and clearly labelled as real signed values or governed post-create controls. If a control is not executable in the create transaction, it must not be presented as an editable fake create field.

## Current Iteration Scope

Implemented in this iteration:

- Created this Figma-to-route cutover map.
- Reworked `/factory/create` into a real step-based assistant using the Figma step sequence.
- Added a dedicated Deposits step aligned with the referenced Figma frame.
- Kept denomination, whitelist, fee, setup intent and final deploy behavior wired to the existing real transaction path.
- Kept post-create policy capabilities explicit as governed controls rather than fake local form fields.
- Hardened leaderboard API aggregation so `/arkas` and manager ranking routes read catalog data through the in-process catalog proxy instead of making a protected HTTP reentry call to `/api/catalog`. This removes a Vercel-preview failure mode where real fallback data could be hidden behind a 401.
- Removed the hidden legacy Create Arka fallback surface guarded by `NEXT_PUBLIC_CREATE_ASSISTANT_LEGACY`; the only allowed create route is now the Figma-style step wizard.
- Changed the Arka leaderboard lower rail so Route Boundary and Featured Watchlist are stacked product sections instead of competing two-column panels, reducing copy compression and clipped controls.

Not completed in this iteration:

- Full pixel-tight dashboard, leaderboard, assets, vault detail and integrations rewrites.
- Full extraction of every image asset from Figma beyond the existing create reference and Arka logo.
- Visual regression thresholds against Figma screenshots for every frame.

## Data-Truthfulness Cutover Rule

Public ranking and dashboard screens may show data only from one of these real sources:

- configured catalog API
- Soroban-backed on-chain catalog fallback
- derived metrics from real indexed activity events

They must not render fixture values, hardcoded chart points or visually convincing fallback cards in production. If both catalog and on-chain fallback fail, the surface must fail closed with explicit operational copy and a retry path. Aggregator API routes must not call protected internal HTTP endpoints when they can invoke the same server-side catalog proxy in-process.

## Testing Contract

Every cutover block must keep three layers green:

- Unit tests for workflow derivation, registry and navigation behavior.
- Integration tests for rendered surfaces and transaction-relevant controls.
- E2E tests for public routes, wallet-backed critical paths and operator-gated advanced routes.

Visual fidelity must be added as a fourth gate with Playwright screenshots and Figma reference captures. Existing functional E2E coverage does not prove Figma fidelity.

## 2026-05-04 Assets Cutover Note

- `/assets` now has a stronger product-market table shape: real amount, 24h movement from indexed asset history when available, explicit no-series copy when unavailable, price proxy, AUM/net position and scope.
- This improves the Figma-aligned public table rhythm, but it is not a strict pixel-diff closure for the Assets frame family.
- The remaining Assets visual work is refreshed Figma capture pairing, current screenshot capture and exact threshold repair after the broader dashboard/assets/vault-detail/integrations/create frame set is rebaselined.

## 2026-05-04 Dashboard / Assets Visual Tightening Note

- `/dashboard` now includes a Figma-style launch visual in the public "Build your Arkas now" band. The visual is CSS-native but driven by real catalog values, so it is not a static placeholder.
- `/assets` now includes a command evidence strip above the card/table workspace, making the search deck closer to the Figma rhythm while preserving truthful current-query metrics.
- The Assets table now prioritises preserving the action column at laptop widths and collapses less critical scope detail first.
