# Arka.fund Frontend Screen Manual

Date: 2026-04-23
Scope: current dApp frontend and its screen model in the testnet/runtime environment

## 1. Purpose of this manual

This document explains every real screen in the Arka.fund frontend, what each one is for, which context it belongs to, what data it reads, which actions it can trigger, and how it fits into the larger product.

It is intentionally screen-centric.

The platform dossier explains the whole platform across contracts, tokenomics, governance, oracle, storage, routing and operations.

This manual explains the frontend as a user/operator workspace.

## 2. How the frontend is organized

The frontend is split into two major navigation families:

- Product rail:
  - `Dashboard`
  - `Discover`
  - `Arkas`
  - `Managers`
  - `Assets`
- Advanced Console:
  - `Create`
  - `Governance`
  - `Coverage`
  - `Integrations`
  - `Ops`
  - `Contracts`
  - `Settings`
  - `Status`
  - `Tiers`

The distinction matters:

- Product rail screens are for browsing, discovery, ranking, screening and understanding the system.
- Advanced Console screens are for governed actions, protocol execution, raw contract control and operator diagnostics.

There is also a route boundary inside the product:

- `/vaults` is product review, ranking and profile inspection.
- `/arkas` and especially `/arkas/[id]` are live execution routes.
- `/factory/create` is the deployment route.

## 3. Common screen patterns

Across the frontend, most screens reuse the same interaction model:

- Header:
  - route name, purpose sentence and, when relevant, stage tabs or section tabs.
- Signals:
  - top cards that summarize the current state.
- Panels:
  - grouped sections for telemetry, actions, lists or diagnostics.
- Empty/loading/error states:
  - catalog-backed screens expose explicit loading, offline and retry modes.
- Wallet-gated actions:
  - read-only content is often visible without wallet, but write actions require a connected wallet.

## 4. Screen inventory at a glance

| Route | Screen name | Group | Main role |
|---|---|---|---|
| `/dashboard` | Dashboard | Product rail | high-level portfolio summary |
| `/discover` | Discover | Product rail | search and screening across Arka / managers / assets |
| `/vaults` | Arkas Leaderboard | Product rail | ranked Arka catalog |
| `/vaults/[id]` | Arka Profile | Product rail | indexed profile, not live execution |
| `/arkas` | Live Vault Ops | Execution surface | on-chain Arka lookup and shortcut entry |
| `/arkas/[id]` | Live Vault Execution | Execution surface | deposit, redeem, rebalance and credit actions |
| `/factory/create` | Create Arka | Advanced Console | create and initialize a new Arka |
| `/governance` | Governance | Advanced Console | DAO lifecycle actions |
| `/coverage` | Coverage | Advanced Console | reserve / coverage fund posture and actions |
| `/integrations` | Integrations | Advanced Console | protocol adapters and execution lanes |
| `/ops` | Operations | Advanced Console | operator runbook and health checks |
| `/contracts` | Contract Control Center | Advanced Console | direct typed/raw contract interaction |
| `/settings` | Settings | Advanced Console | environment, IDs and guardrail configuration |
| `/status` | Status | Advanced Console | readiness, oracle/routing posture and known limits |
| `/tiers` | Manager Tiers | Advanced Console | manager points/tier control |
| `/managers` | Managers Leaderboard | Product rail | ranked manager catalog |
| `/managers/[id]` | Manager Detail | Product rail | manager trajectory, mandate and managed Arkas |
| `/assets` | Assets | Product rail | asset concentration explorer |
| `/assets/[id]` | Asset Detail | Product rail | exposure trajectory and linked Arkas |

## 5. Global chrome

### 5.1 Top bar

The top bar gives access to:

- the Arka.fund wordmark
- wallet connect
- settings
- the global search bar
- quick create access

The search bar routes to `/discover` and is intended as the fastest way to pivot into indexed catalog exploration.

### 5.2 Primary rail

The right-side primary rail is the public product navigation:

- `Dashboard`
- `Discover`
- `Arkas`
- `Managers`
- `Assets`

This is the browsing surface.

### 5.3 Advanced Console

The Advanced Console is expandable and contains the operator/governance/deployment surface.

Its design intent is explicit in the app chrome:

- DAO actions
- protocol execution
- raw contract controls
- operator diagnostics

stay outside the public product rail.

## 6. Product rail screens

### 6.1 `/dashboard` — Dashboard

Purpose:

- present the top-level portfolio and network operating picture in one glance

Primary audience:

- depositors
- managers
- operators who want a summary before drilling into details

Main data dependencies:

- catalog dashboard overview
- catalog composition snapshot
- ranked Arkas
- ranked managers
- monitoring status

Main sections:

- stage header and stage tabs
- total portfolio value and delta
- portfolio curve / capital chart
- stage side cards:
  - portfolio value
  - net user flow
  - control state
  - largest sleeve
- featured Arkas
- composition bars
- manager summary
- activity summary

What this screen is for:

- understanding overall posture
- seeing whether the indexed portfolio is healthy/degraded
- identifying the main sleeves/assets and major managers
- deciding where to drill next

What this screen is not for:

- direct execution
- direct governance mutation
- direct protocol operations

### 6.2 `/discover` — Discover

Purpose:

- search across the indexed catalog and screen Arkas, managers and assets before execution

Primary audience:

- users exploring the system
- operators narrowing to a target vault/manager/asset

Main data dependencies:

- catalog `arkas`
- catalog `managers`
- catalog `assets`

Main sections:

- search bar
- curated toggle
- summary counters
- stage tiles
- section tabs:
  - featured Arkas
  - managers
  - assets
- featured Arka cards
- manager cards
- asset cards

What this screen is for:

- finding relevant entities quickly
- screening the indexed set before opening a live route
- narrowing by search and curated scope

What this screen is not for:

- signing transactions
- raw on-chain interaction

### 6.3 `/vaults` — Arkas Leaderboard

Purpose:

- rank Arkas in the indexed catalog and expose the route boundary between product review and live execution

Primary audience:

- users comparing vaults
- managers reviewing peers
- operators selecting a target vault

Main data dependencies:

- resolved Arka leaderboard page
- derived metrics for profit/volume
- leaderboard source snapshot

Main sections:

- top summary cards:
  - managed NAV
  - curated coverage
  - average asset span
- listing toolbar:
  - search
  - rank metric
  - sort order
  - curated toggle
- main ranked table
- source/oracle note
- route boundary panel
- featured watchlist panel

What this screen is for:

- ranking by NAV, profit, volume or rank
- understanding whether you are in product review, execution or deployment territory
- jumping to profile or ops routes

Important conceptual rule:

- `/vaults` is the product route
- `/arkas/[id]` is the live route
- `/factory/create` is the deployment route

### 6.4 `/vaults/[id]` — Arka Profile

Purpose:

- show the indexed profile of a specific Arka without turning the page into the live ops cockpit

Primary audience:

- reviewers
- depositors
- analysts
- operators doing pre-execution inspection

Main data dependencies:

- Arka detail bundle from the catalog
- history
- asset exposure
- portfolio
- activity

Main sections:

- hero with Arka identity and summary
- tabs:
  - overview
  - portfolio
  - activity
  - policies
- NAV trajectory
- profile
- composition
- asset book
- activity mix
- recent activity
- fees and issuance
- allowed assets

What this screen is for:

- understanding the indexed state of a vault
- seeing historical trend and composition
- checking fees, issuance and whitelist policies

What this screen is not for:

- direct deposit/redeem
- manager rebalance
- credit actions

Those belong to `/arkas/[id]`.

### 6.5 `/managers` — Managers Leaderboard

Purpose:

- rank managers and expose their concentration posture and managed footprint

Primary audience:

- users evaluating managers
- operators comparing manager concentration

Main data dependencies:

- resolved manager leaderboard page

Main sections:

- top signals:
  - managers indexed
  - current leader
  - lead share
- manager command deck:
  - search
  - rank metric
  - sort order
  - manager rows/cards
- telemetry panel:
  - concentration
  - freshness
  - query posture

What this screen is for:

- comparing managers by NAV, Arka count or curated coverage
- opening manager detail
- understanding who dominates the currently visible set

### 6.6 `/managers/[id]` — Manager Detail

Purpose:

- explain one manager’s current mandate footprint, trend and associated Arkas

Primary audience:

- analysts
- governance reviewers
- operators evaluating a manager’s current scope

Main sections:

- hero signals
- NAV trajectory
- mandate telemetry
- managed Arkas

What this screen is for:

- seeing how large and how broad a manager’s current indexed footprint is
- opening the Arkas controlled or associated with that manager

### 6.7 `/assets` — Assets

Purpose:

- inspect asset concentration across the indexed vault set

Primary audience:

- users evaluating concentration risk
- operators looking for dominant sleeves or denomination assets

Main sections:

- asset command deck:
  - search
  - ranked asset list
- telemetry:
  - concentration
  - breadth
  - current query posture

What this screen is for:

- understanding which assets dominate the indexed set
- moving from an asset-centric view to the Arkas that hold it

### 6.8 `/assets/[id]` — Asset Detail

Purpose:

- explain one asset’s exposure trajectory and the Arkas driving it

Primary audience:

- risk reviewers
- operators
- analysts

Main sections:

- hero signals:
  - asset identity
  - current rank
  - last sync
- exposure trajectory
- risk footprint
- linked Arkas

What this screen is for:

- seeing liquid vs debt share
- understanding manager breadth
- identifying which Arkas are causing the concentration

## 7. Execution routes

### 7.1 `/arkas` — Live Vault Ops

Purpose:

- give operators a direct on-chain operational entrypoint into live vault execution

Primary audience:

- managers
- operators

Main data dependencies:

- local recent Arka shortcuts
- Arka registry reads from Soroban

Main sections:

- hero:
  - recent vaults
  - registry shortcuts
  - mode
- recent vaults panel
- direct open panel
- registry shortcuts panel

What this screen is for:

- jumping directly into a known live vault
- opening a recent vault quickly
- working from the on-chain registry instead of from the ranked catalog

Important distinction:

- this is an execution entry route
- it is not the ranked public leaderboard

### 7.2 `/arkas/[id]` — Live Vault Execution

Purpose:

- operate directly on a vault contract

Primary audience:

- managers
- users depositing/redeeming
- operators executing supported flows

Main data dependencies:

- direct Soroban reads
- wallet balances
- allowance state
- route planner
- runtime health snapshot
- protocol adapters and router reads

Main sections:

- stage overview / metric cards
- vault state
- deposit and redeem
- rebalance
- credit position

Detailed behavior:

- `Vault state`
  - who is manager
  - wallet posture
  - share token
  - current NAV and user shares
- `Deposit and redeem`
  - choose input asset
  - approve token if needed
  - deposit
  - redeem
  - redeem all
- `Rebalance`
  - choose protocol or `AUTO`
  - choose asset in/out
  - set amount, slippage and optional min out
  - inspect route candidates
  - run manager rebalance
- `Credit position`
  - choose protocol and market
  - borrow / repay / supply / withdraw style actions depending on the market
  - inspect health factor and risk policy

Important constraints:

- some actions are manager-only
- some routes are blocked when protocol readiness is not validated
- wallet mode and manager identity matter

## 8. Advanced Console screens

### 8.1 `/factory/create` — Create Arka

Purpose:

- deploy and initialize a new Arka from the frontend

Primary audience:

- protocol operator
- manager onboarding flow

Main sections:

- assistant header
- mandate cards:
  - deposit whitelist policy
  - deposit limits
- mandate form:
  - denomination
  - activation handoff
  - whitelist tokens
  - fee inputs
- execution plan
- deploy Arka card
- deployment result card
- stepper rail

What this screen does:

- prepares the creation transaction
- optionally handles creation fee approval
- creates the vault
- initializes its baseline configuration
- exposes next routes once the Arka exists

What it explicitly does not do:

- it does not fully activate every strategy in-place
- post-create strategy work moves to the Arka execution route

### 8.2 `/governance` — Governance

Purpose:

- operate the DAO lifecycle from proposal through execution

Primary audience:

- governance operator
- DAO reviewer

Main data dependencies:

- governor settings
- proposal state
- proposal votes
- current wallet vote posture

Main sections:

- proposals
- voting power
- statistics
- lifecycle controls

Lifecycle actions:

- propose
- vote
- close
- execute
- refresh

What this screen is for:

- reading governor config
- checking proposal readiness
- advancing the current proposal through the lifecycle

### 8.3 `/coverage` — Coverage

Purpose:

- operate and inspect the manager/community reserve and coverage fund

Primary audience:

- protocol operator
- manager reviewing reserve posture
- participant interacting with the coverage fund

Main data dependencies:

- coverage vault balance
- max withdrawable
- fund stake
- pending rewards
- wallet token balance

Main sections:

- coverage state
- member posture
- coverage fund actions

Actions:

- stake
- unstake
- claim rewards
- refresh

What this screen is for:

- seeing whether reserve headroom exists
- understanding waterfall order and utilization
- interacting with the fund from the wallet side

### 8.4 `/integrations` — Integrations

Purpose:

- present the real protocol integration surface and current adapter/runtime posture

Primary audience:

- operator
- integrator
- manager wanting to know which venue is live, blocked or manual-only

Main sections:

- adapter routing
- execution venue model
- Balanced/SODAX intent source and driver sections
- execution posture
- canonical execution surfaces

What this screen is for:

- checking configured vs observed routers
- checking venue semantics:
  - quote model
  - settlement model
  - path model
  - confirmation model
  - planner admission
- checking Balanced/SODAX public surface readiness
- executing canonical Balanced or Blend actions from their approved lane

This is the protocol wiring map of the frontend.

### 8.5 `/ops` — Operations

Purpose:

- provide a compact operator runbook and health checklist

Primary audience:

- operator
- maintainer

Main sections:

- contract health
- operator cadence

What this screen checks:

- governor readability
- votes readability
- coverage balances
- tier thresholds
- adapter/router posture

What this screen is for:

- verifying the environment before sensitive actions
- making sure governance, coverage and adapter wiring are readable and sane

### 8.6 `/contracts` — Contract Control Center

Purpose:

- expose full direct on-chain control for domains not completely covered by higher-level screens

Primary audience:

- advanced operator
- developer
- governance operator

Main sections:

- typed actions
- raw invoke lane
- critical mutation matrix
- storage lifecycle hardening

What `Typed actions` is for:

- choosing a known contract method from a safe typed template
- filling arguments with typed inputs
- executing reads or writes
- respecting DAO policy when a direct write must be routed via governance

What `Raw invoke lane` is for:

- invoking methods not modeled in the typed layer
- passing JSON-typed `ScVal` arguments
- performing advanced reads/writes when needed

What `Critical mutation matrix` is for:

- showing which mutations are covered and which are blocked or DAO-gated

What `Storage lifecycle hardening` is for:

- showing extend/rent posture for runtime contracts
- surfacing extension commands and missing inputs

This is the lowest-level operator surface in the frontend.

### 8.7 `/settings` — Settings

Purpose:

- show the active runtime configuration that shapes execution behavior

Primary audience:

- operator
- developer
- auditor

Main sections:

- configuration map
- rebalance guardrails
- raw environment snapshot

What this screen is for:

- checking network passphrase and RPC
- seeing contract IDs and adapter IDs
- reviewing guardrail profile and slippage limits
- comparing current runtime values without leaving the UI

### 8.8 `/status` — Status

Purpose:

- expose readiness posture and operational truth before live validation or release gating

Primary audience:

- operator
- maintainer
- reviewer

Main sections:

- current operating baseline
- operator checklist
- oracle cutover
- routing solver
- known limits
- reference links

What this screen is for:

- deciding whether the environment is ready, blocked or mismatched
- understanding current oracle posture
- understanding routing posture
- seeing explicit known limitations, not hidden assumptions

### 8.9 `/tiers` — Manager Tiers

Purpose:

- inspect and operate the manager scoring/tier layer

Primary audience:

- operator
- governance/admin role

Main sections:

- current summary
- threshold progression
- add points flow

Actions:

- connect wallet
- target a manager
- add points
- refresh tier state

What this screen is for:

- seeing current tier and thresholds
- updating points for a manager through the governed tier system

## 9. Supporting states that appear across screens

### 9.1 Loading states

Catalog-backed screens explicitly show loading messages while fetching the relevant bundle.

### 9.2 Offline catalog states

Screens such as dashboard, discover and leaderboard can show an explicit catalog offline state when the catalog side is unavailable or disconnected.

### 9.3 Error states

Every major bundle-backed product screen has a retryable error state rather than failing silently.

### 9.4 Wallet-gated write states

Write-capable screens expose read posture even without wallet, but mutation controls remain gated until the wallet is connected.

## 10. Recommended way to use the frontend

The intended operator flow is:

1. Use `Dashboard`, `Discover`, `Arkas`, `Managers` and `Assets` to inspect and choose a target.
2. Use `/vaults/[id]` for indexed profile review.
3. Move to `/arkas/[id]` only when you are ready to execute live deposit/redeem/rebalance/credit flows.
4. Use `Governance`, `Coverage`, `Integrations`, `Ops`, `Contracts`, `Settings`, `Status` and `Tiers` only when you are working in operator, governance or diagnostic mode.

## 11. Most important route boundaries

These route boundaries are part of the product truth:

- `/dashboard` is summary, not execution.
- `/discover` is screening, not execution.
- `/vaults` is ranking and review, not execution.
- `/vaults/[id]` is profile analysis, not execution.
- `/arkas` is operational entry.
- `/arkas/[id]` is live execution.
- `/factory/create` is deployment.
- `Contracts` is not a normal end-user product surface; it is an operator control surface.

## 12. Operational reference by screen

The sections above explain each screen in detail.

This section adds a compact operator-oriented reference so each route can be evaluated quickly in terms of:

- who it is for,
- whether wallet connection is required,
- what it reads,
- what it can write or trigger,
- and what the main dependency or risk is.

| Route | Primary actor | Wallet required | Main reads | Main writes / triggers | Main dependency / risk |
|---|---|---|---|---|---|
| `/dashboard` | product user / operator | no for reading | catalog overview, ranked vault set, portfolio telemetry | none | catalog availability and freshness |
| `/discover` | product user / analyst | no for reading | catalog search bundle across Arkas, managers and assets | navigation into deeper routes | catalog API wiring; search reflects indexed, not live execution |
| `/vaults` | product user / analyst | no for reading | ranked Arka leaderboard, derived profit/volume, oracle source note | navigation to profile or ops routes | indexed ranking posture can differ from live execution timing |
| `/vaults/[id]` | analyst / allocator | no for reading | indexed Arka profile, fees, assets, manager posture | navigation into execution routes | profile is review mode, not the execution lane itself |
| `/arkas` | operator / manager | not always, but useful | registry-backed lookup, vault ops shortcuts | navigation into live execution | depends on contract wiring and registry reachability |
| `/arkas/[id]` | depositor / manager / operator | yes for live actions | vault detail, balances, execution posture, protocol lanes | deposit, redeem, rebalance, protocol execution | wallet readiness, contract authorization, protocol adapter health |
| `/factory/create` | operator / deployer | yes | environment/config context, factory readiness | deploy and initialize a new Arka | factory contract wiring, wallet signing, config correctness |
| `/governance` | DAO participant / operator | yes for proposals and voting | proposal queue, tally, governor config, voting posture | propose, vote, close, execute | wallet authority, proposal lifecycle windows, governor config |
| `/coverage` | operator / staker | yes for stake flows | reserve posture, member lane, rewards state | stake, unstake, claim rewards | coverage contracts, wallet balances, reward state freshness |
| `/integrations` | operator / protocol reviewer | wallet needed for live execution lanes | adapter status, protocol capability map, execution lanes | launch protocol actions from supported lanes | adapter validity, protocol availability, live venue readiness |
| `/ops` | operator | sometimes | runbooks, checks, baseline readiness | refresh checks, operator verification flows | env health, contract readability, operator discipline |
| `/contracts` | operator / engineer | yes for mutations | typed contract views, raw invoke surface, mutation matrix, storage lifecycle | direct contract invocations and low-level control actions | highest-risk route; requires exact method/argument correctness |
| `/settings` | operator / engineer | no for reading | env vars, contract IDs, routing and guardrail config | none directly | can expose misconfiguration clearly; read-only does not fix it |
| `/status` | operator / release owner | no for reading | oracle posture, routing posture, known limits, release readiness | none directly | readiness can be blocked by missing deployments or validation inputs |
| `/tiers` | operator / governor | yes for mutations | manager tier points, thresholds, tier status | apply governed points/tier updates | authority model and reputational scoring policy |
| `/managers` | analyst / governance reviewer | no for reading | ranked managers, NAV concentration, curated footprint | navigation into manager detail or related routes | catalog ranking may lag live governance changes |
| `/managers/[id]` | analyst / operator | no for reading | manager-level profile, Arka footprint, status | navigation to related execution/governance context | profile quality depends on indexed manager coverage |
| `/assets` | analyst / operator | no for reading | ranked assets, concentration posture, exposure map | navigation into asset detail | indexed asset exposure can lag live position changes |
| `/assets/[id]` | analyst / operator | no for reading | asset-level posture, manager/vault relationships | navigation to related routes | depends on indexed asset linkage quality |

### 12.1 Practical interpretation

- Product-review routes:
  - `/dashboard`, `/discover`, `/vaults`, `/vaults/[id]`, `/managers`, `/managers/[id]`, `/assets`, `/assets/[id]`
  - These are mainly read and compare routes.
  - They are ideal for screening, ranking and understanding posture.
  - They should not be mistaken for the final execution lane.

- Execution routes:
  - `/arkas`, `/arkas/[id]`, `/factory/create`
  - These are where a user moves from review into action.
  - Wallet state, permissions and protocol readiness matter directly here.

- Operator / control routes:
  - `/governance`, `/coverage`, `/integrations`, `/ops`, `/contracts`, `/settings`, `/status`, `/tiers`
  - These are administrative or operational surfaces.
  - They expose more power, more diagnostics and more ways to make mistakes.
  - They are useful, but they are not the right first stop for most product users.

### 12.2 Which screens are the most sensitive

The most sensitive routes in the entire frontend are:

- `/contracts`
  - It is the lowest-level control center and can bypass safer screen-specific abstractions.
- `/arkas/[id]`
  - It is where live value movement and manager actions happen.
- `/factory/create`
  - It affects deployment and initial system shape.
- `/governance`
  - It can change policy, execution authority and protocol configuration over time.
- `/coverage`
  - It interacts with reserve and member fund state rather than pure catalog data.

### 12.3 Which screens are safest for broad users

The safest broad-entry routes are:

- `/dashboard`
- `/discover`
- `/vaults`
- `/managers`
- `/assets`

These routes are primarily observational and are the best places to understand the system before touching execution or governance.

## 13. Closing note

The frontend is not a single homogeneous app.

It is a layered workspace:

- product discovery
- indexed review
- live execution
- governance
- diagnostics
- raw control

Understanding which screen belongs to which layer is the key to using the platform correctly and to avoiding false assumptions about what should be visible or executable in each route.
