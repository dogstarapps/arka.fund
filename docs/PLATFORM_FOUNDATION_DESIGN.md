# Platform Foundation Design

This document defines the target foundation for governance, tokenomics, coverage, claims handling, product design direction, and testnet delivery discipline.

It is intended to bridge the gap between the currently validated contract surface and the next implementation phase.

## Design Principles

- Prefer the minimum complexity required for a credible, durable protocol.
- Reuse proven patterns from established protocols without inheriting historical complexity that does not fit Arka.fund.
- Keep claims capital, governance power, and speculative token exposure separated where possible.
- Treat coverage as a real economic system, not only as a UI or staking feature.
- Keep testnet as the active integration and validation environment until all remaining foundation changes are proven end-to-end.

## Current State

### Governance

The current repository uses:

- `votes`
- `governor`
- Governor execution delay configured as an internal parameter

There is no separate Timelock deployment in the current validated flow.

### Fees

The current `Arka` contract stores:

- `mgmt_bps`
- `perf_bps`
- `deposit_bps`
- `redeem_bps`

But the currently active live fee application in vault flows is limited to:

- deposit fee on `deposit`
- redeem fee on `redeem`

Management-fee accrual, performance-fee crystallization, protocol fee splitting, and high-water-mark accounting are not yet implemented as full on-chain production logic.

### Coverage

The protocol already has two internal coverage primitives:

- `coverage-vault`: manager first-loss capital with governed lock ratio
- `coverage-fund`: community staking pool with reward accounting

These modules form a strong starting point, but they are not yet a complete claims system with premium routing, adjudication, payout waterfalls, or reserve policy.

### Product Surfaces

The current product shell is functionally much stronger than before, but the final visual direction is still not aligned with the design material in:

- `arkafund-assets/screens`

That design language is neon, dense, panel-driven, and dashboard-heavy. The current frontend needs a deliberate design-system pass to match it consistently.

## Target Architecture

## 1. Governance

### Recommended target

Move from:

- `Governor` with internal execution delay

To:

- `Governor`
- separate `Timelock` or `Executor`
- optional `Security Council` / `Guardian`

### Why

- clearer separation of proposing, queueing, and executing
- cleaner future path for multi-role governance
- better compatibility with a future modular voting stack
- easier safety controls around upgrades and emergency powers

### Recommended governance model

#### Phase 1

- one primary governance chamber
- `ARKA` as liquid, transferable token
- `locked ARKA` as non-transferable voting power derived from locked `ARKA`
- no bicameral system yet
- no `dARKA` in the first production tokenomics release

#### Phase 2

- add `Security Council`
- add limited emergency pause powers
- keep all pause and upgrade powers under explicit policy and timelock

#### Phase 3

- evaluate whether depositor-specific voting is still needed
- only introduce `dARKA` if governance capture by liquid-token holders becomes a real problem

### Roles

#### ARKA

- liquid token
- market-facing token
- reward and incentive token
- treasury and ecosystem token

#### locked ARKA

- governance voting power
- long-term alignment mechanism
- optional reward booster for coverage and liquidity programs
- not used as direct claims capital

### Naming recommendation

`veARKA` should be treated as optional technical shorthand, not as required end-user branding.

Important clarification:

- `ve` is not Enzyme-specific nomenclature
- `ve` is the broader DeFi shorthand for voting-escrow style locked voting power
- Enzyme's official public token nomenclature is centered on `MLN`, not on a `ve`-prefixed governance asset

Recommended approach for Arka.fund:

- keep `veARKA` only as an internal architecture shorthand if useful
- avoid presenting `veARKA` as the primary public product label
- use user-facing wording such as `locked ARKA` and `Arka voting power`
- only introduce a separate public ticker if there is a strong product reason and it improves clarity

This avoids unnecessary jargon while preserving technical precision in implementation discussions.

Current repository posture:

- the implemented first rollout is `locked ARKA`, not a time-decaying vote-escrow model
- voting power is derived from locked principal in escrow and is non-transferable
- if a future phase needs time decay, that should be treated as an explicit upgrade

#### dARKA

Not recommended for the first implementation wave.

It should remain a deferred option for a later depositor chamber if and only if:

- depositors need formal governance weight independent of token holders
- protocol growth materially increases the risk of governance capture

### Team economics

Decentralization does not require the absence of a team.

Recommended structure:

- genesis allocation for team and core contributors
- long vesting schedules
- explicit treasury budget for protocol development
- no indefinite unilateral admin control
- all long-lived powers eventually routed through governance and timelock

## 2. Fee Model

### Recommended fee stack

#### Anti-spam create fee

- small fixed fee or refundable bond on vault creation
- purpose: avoid registry and factory spam
- not a core revenue source

#### Manager fees

- management fee
- performance fee with high-water mark

These are essential for a competitive manager product and should be treated as core functionality.

#### Protocol fee

Recommended protocol revenue approach:

- low protocol split on manager fees
- optional low AUM overlay only if needed later

This is preferred over aggressive deposit/redeem fees.

#### Deposit and redeem fees

- optional by vault
- low by default
- useful as anti-spam / execution-friction controls
- should not be the primary business model

### Recommended initial target policy

- create fee: small fixed anti-spam fee
- management fee: enabled
- performance fee: enabled, with high-water mark
- protocol split: low and governance-controlled
- deposit/redeem fee: optional and low

## 3. Coverage Economics

### Recommended structure

Coverage should have two distinct layers:

#### Layer 1: Manager first-loss capital

Implemented through `coverage-vault`.

Purpose:

- align manager incentives
- absorb first losses
- avoid socializing losses immediately

#### Layer 2: Community backstop capital

Implemented through `coverage-fund`.

Purpose:

- provide additional reserve depth
- make coverage scalable
- align community with protocol safety

### Important design decision

Claims capital should not primarily sit in volatile governance token exposure.

Recommended approach:

- coverage capital should be denominated in stable or claim-relevant reserve assets
- `ARKA` should primarily be used for rewards and alignment
- `veARKA` should be used for governance and reward boosting, not as the payout asset itself

### Recommended token roles in coverage

#### Stake / reserve token

Recommended:

- stable reserve asset such as USDC or approved denomination reserve

Reason:

- claims require predictable payout value
- volatile governance token reserves weaken insurance quality exactly when stress hits

#### Reward token

Recommended:

- `ARKA`
- plus real premium revenue in reserve asset when feasible

#### Boost mechanism

Recommended:

- `veARKA` boosts reward share or premium participation
- `veARKA` does not replace the reserve asset

### Recommended reward composition

Coverage stakers should earn from:

- real coverage premiums paid by covered Arkas
- bootstrap `ARKA` emissions during early growth
- optional slashing-derived revenue if policy violations are formalized later

This means the coverage economy should transition from:

- emission-heavy bootstrap

To:

- premium-backed and revenue-backed yield

## 4. Claims Circuit

### Objective

Create a real, auditable path from incident detection to loss absorption and payout.

### Recommended initial claims circuit

1. Incident trigger

- oracle anomaly
- protocol integration failure
- unauthorized manager action
- pricing integrity failure
- governance-declared emergency event

2. Freeze and snapshot

- freeze affected coverage state
- record incident metadata
- lock affected reserves from concurrent mutation if required
- snapshot vault NAV, reserve balances, and coverage balances

3. Incident assessment

Recommended first implementation:

- governed/manual adjudication with explicit delay and recorded decision

Later upgrade path:

- dedicated claims assessor module or structured claims policy engine

4. Loss waterfall

- first: slash or consume manager `coverage-vault`
- second: pay from community `coverage-fund`
- third: optional treasury support only if governance explicitly approves

5. Payout execution

- payout destination and amount recorded on-chain
- emit structured incident and payout events
- preserve post-mortem transparency for indexer and frontend

### Required modules for a serious implementation

- `coverage-controller`
- `premium-manager`
- `incident-registry`
- `claims-executor`
- indexer and API support for incident state and payout history

### Premium policy

Premiums should not be flat forever.

Recommended pricing inputs:

- manager tier / reputation
- protocol exposure type
- leverage / credit exposure
- asset concentration
- oracle risk category
- total covered NAV
- reserve utilization

This can begin with simple governed tiers before moving to a dynamic premium curve.

## 4A. Coverage Economics Design

Coverage must be treated as a standalone economic subsystem with explicit inflows, reserves, and payout rules.

### Core objective

The goal is not only to expose a staking page.

The goal is to maintain a credible loss-absorption system that:

- prices risk
- accumulates reserves
- aligns managers and stakers
- pays claims without depending on governance-token price strength at stress time

### Economic layers

#### Manager layer

- every covered Arka must maintain first-loss capital in `coverage-vault`
- lock ratio and minimum capital should be policy-driven by risk tier
- this layer absorbs losses before community capital is touched

#### Community layer

- community stakers provide second-loss capital through `coverage-fund`
- reserve asset should be stable or claim-relevant
- reward emissions in `ARKA` are bootstrap support, not the whole economic model

#### Protocol layer

- protocol treasury support should be explicitly optional
- treasury intervention should require governed approval and should not be assumed in the base waterfall

### Economic inflows

The target steady-state model should combine:

- coverage premiums paid by covered Arkas
- protocol-funded bootstrap rewards in `ARKA`
- optional penalty or slashing inflows if formalized later

The target steady-state model should not rely on:

- emissions only
- governance token appreciation
- deposit or withdraw fees as the main source of coverage funding

### Premium routing

Recommended premium routing policy:

- premium charged at vault level
- premium routed first to the coverage reserve pool
- optional splitter sends a governed share to protocol treasury for operations only after reserve policy is satisfied

### Coverage reward policy

Recommended staker compensation:

- base reserve-asset yield from real premiums
- additional `ARKA` bootstrap rewards during growth phase
- optional `veARKA` boost multiplier on the reward share

Recommended non-goals:

- do not pay claims primarily in `ARKA`
- do not represent `veARKA` as a claims asset
- do not hide reserve solvency behind token incentives

## 4B. Claims Operating Circuit

The claims circuit needs to be explicit enough to deploy, test, and audit.

### Incident classes

Recommended initial incident classes:

- oracle integrity failure
- protocol integration exploit or permanent loss event
- unauthorized manager action
- policy breach with measurable loss
- governance-declared exceptional event

### Incident lifecycle

1. Trigger

- an authorized trigger records the incident candidate
- trigger sources can include guardian, governor, or approved risk operator

2. Freeze and evidence capture

- affected vault and coverage state are frozen where required
- snapshot IDs, balances, NAV inputs, and incident metadata are recorded
- incident receives immutable on-chain identifier

3. Assessment

- initial version should use governed adjudication with explicit reason codes
- later versions can delegate bounded roles to a claims assessor module

4. Waterfall resolution

- consume or slash manager first-loss capital
- consume community reserve only for covered residual loss
- treasury support remains opt-in and governed

5. Payout execution

- payout amount, destination, reserve asset, and incident id are executed on-chain
- all payouts emit structured events for indexer and UI

6. Recovery and post-mortem

- system unfreezes only after incident closure state is recorded
- incident history remains queryable for users, managers, and governance

### Minimum implementation modules

- `premium-manager`
- `coverage-controller`
- `incident-registry`
- `claims-assessor` or governed incident resolver
- `claims-executor`
- indexer support for claims status and payout history

### Testnet validation requirement

This subsystem should not be treated as complete until testnet covers:

- premium accrual
- incident creation
- reserve freeze
- first-loss consumption
- community reserve payout
- incident history API and UI visibility

## 4C. Governed Protocol Onboarding

Status for the current delivery wave:

- defer to a later platform-expansion phase
- document as a future enhancement, not as a blocker for the current implementation wave
- do not couple the final governance, fee, coverage, claims, and design-system work to this capability

### Current state

The repository does not yet implement a full DAO-governed protocol onboarding system.

Today:

- protocol adapters are added and deployed manually
- router execution uses passed adapter addresses directly
- there is no complete on-chain adapter registry activation flow driven by governance
- there is no automatic post-vote protocol activation path

### Target objective

Third parties should be able to propose new protocol integrations, but acceptance should remain bounded by audited artifacts and governed policy.

### Important boundary

`Automatic incorporation` should mean:

- governance activates a pre-deployed, pre-reviewed integration package after a successful vote and timelock

It should not mean:

- governance executes arbitrary unaudited code deployment directly from a generic proposal

### Recommended governed onboarding flow

1. Candidate package submission

- third party submits adapter address, protocol metadata, supported assets, oracle assumptions, audit references, testnet evidence, and policy template
- candidate package is stored by hash in a governed registry or proposal payload

2. Review window

- technical review, market risk review, and oracle review happen before activation vote
- optional proposal bond can discourage spam submissions

3. Governance vote

- DAO votes on activation of the exact package hash and exact adapter address set

4. Timelock execution

- successful proposal activates the integration through governed registry writes
- registry can enable the protocol, supported assets, policy class, and adapter addresses atomically

5. Runtime enforcement

- router and vault policy layer must only accept active registry entries
- deactivation must be possible independently if the integration later becomes unsafe

### Required modules

- `protocol-registry`
- `adapter-registry`
- `integration-policy-registry`
- optional `proposal-bond` or submission bond
- timelock executor hooks for activation and deactivation

### Recommended implementation posture

- automatic activation after vote: yes
- arbitrary automatic deployment from vote: no
- third-party proposal path: yes
- activation only for exact reviewed artifacts: yes

### Deferral rationale

This capability has real strategic value, but it should not be included in the current last-mile implementation scope because:

- it adds a new governed registry layer and runtime enforcement surface
- it adds review and operational burden for third-party submissions
- it is incomplete without a coherent product and operator-facing UX for proposal review, activation visibility, and supported-integration discovery
- it is not required to complete the current governance, tokenomics, fee, coverage, claims, and design alignment goals

## 5. Product and Visual Direction

The design reference in `arkafund-assets/screens` implies a much more opinionated UI than the current product shell.

### Required design-system direction

- dark violet base surface
- neon green brand accents
- magenta and cyan action gradients
- stronger panel chrome and depth
- denser information layout
- right-side mode navigation pattern where appropriate
- charts and tables with a more “trading terminal” posture

### Scope implications

Remaining design work is not only page-by-page.

It includes:

- base color system
- type system
- button language
- panel language
- chart language
- data table language
- nav shell and wallet shell

Any missing screens should be created in the same visual grammar, not in the current transitional style.

## 6. Delivery Discipline

All remaining foundation work must follow the same deployment discipline as the earlier validated phases.

### Mandatory working pattern

- implement
- unit test
- integration test
- end-to-end test
- deploy to testnet
- validate on testnet
- record contract IDs and evidence

### Required records

- `deployments.testnet.json`
- updated deployment and execution runbooks
- reproducible validation scripts
- frontend environment references for current testnet IDs

### Remaining workstreams

- governance refactor to `Governor + Timelock`
- `ARKA` / `veARKA` tokenomics implementation
- real fee accrual and fee splitting
- coverage premium routing
- claims workflow and payout waterfall
- design-system alignment with `arkafund-assets/screens`
- full-stack testnet deployment and validation

## Recommended Sequence

1. Governance architecture decision

- confirm `Governor + Timelock`
- confirm role of `Security Council`
- confirm whether `dARKA` is deferred

2. Tokenomics and fee contracts

- `ARKA`
- locker / `veARKA`
- treasury
- fee splitter
- management/performance fee accrual

3. Coverage economy

- reserve asset choice
- premium routing
- claims controller
- payout waterfall

4. Frontend design system pass

- implement target visual system
- align screens to asset references

5. Testnet integration pass

- deploy all new contracts
- run live validations
- record IDs and evidence

## Recommended Decisions To Adopt Now

- adopt `ARKA` + `veARKA`
- defer `dARKA`
- move to separate `Governor + Timelock`
- keep create fee small and anti-spam only
- make management fee and performance fee core revenue logic
- use stable reserve assets for coverage capital
- use `ARKA` for reward bootstrap and `veARKA` for boost/governance
- implement explicit claims waterfall: manager first-loss, then community fund, then optional treasury intervention
