# Execution Venues And Intent Routing Plan

Date: 2026-04-07

## Why this plan exists

Arka.fund currently supports live swap execution through `Aquarius` and `SoroSwap`, and credit execution through `Blend`.

The recent verification of Balanced's official Stellar surface showed that:

- official swaps on Stellar are intent-based and routed through `SODAX`
- the public surface is not a classic Soroban AMM router with a published testnet router contract id
- the old assumption that `Balanced` should behave like another `router + pool` venue is false

That means the repository must stop forcing all swap integrations into the same architectural shape.

## Target venue families

### 1. AMM router venues

Examples:

- `SoroSwap`
- `Aquarius`

Characteristics:

- direct or path-based quotes
- deterministic on-chain router execution
- explicit token path and hop count
- strong quote-to-execution linkage

### 2. Intent execution venues

Examples:

- `Balanced / SODAX`

Characteristics:

- a venue may provide an intent, not a simple router call
- quoting and settlement may be handled by an external execution layer
- best execution must score certainty, latency, and quote firmness, not just output
- the venue can be first-class without pretending it is a classic AMM router

### 3. Credit venues

Examples:

- `Blend`

Characteristics:

- not part of swap routing
- lives in strategy, lending, and treasury execution flows

## Implementation roadmap

### Block A

`Planner venue families`

- distinguish `amm_router` and `intent_execution` candidates in code
- expose venue family, quote model, and settlement model in route plans
- keep `AUTO` restricted to venues with comparable live routing quotes

### Block B

`Balanced intent integration`

- implement a real `IntentExecutionVenue` for Balanced/SODAX once the official execution surface is available
- stop depending on fake router assumptions

### Block B1

`Intent execution driver interface`

- introduce a canonical driver contract for `Balanced / SODAX`
- let planner, UI and runtime consume the same `quote / execute / confirm / planner admission` semantics
- keep the future quote-capable integration point isolated inside the driver instead of re-spreading venue logic across screens
- enforce AUTO admission only when the public surface is complete and machine-consumable across all three operations (`quote + status + confirm`), not quote-only

### Block C

`Global best execution`

- compare route output, fees, latency, confidence, and settlement model
- admit split routing only after execution is truly closed

### Block D

`Blend strategy expansion`

- treat Blend as strategy infrastructure rather than a swap venue

### Block E

`Platform exhaustive dossier`

- generate a single, exhaustive and versioned platform dossier that covers:
  - architecture and runtime topology (contracts, backend, dapp, indexer surfaces)
  - protocol matrix (swap, intent, credit) and execution semantics per venue
  - full feature coverage by contract vs frontend surface
  - security controls (guardrails, governance gates, oracle safety, claims/coverage safety)
  - token stack and tokenomics (supply, emissions, vesting, voting power, treasury flows)
  - operational runbooks (deploy, rollback, release gate, incident handling)
  - test evidence map (unit/integration/e2e/wallet-backed/live-validation)
- publish the dossier as both:
  - human-readable markdown for operators and auditors
  - machine-consumable json index for tooling and CI checks
- enforce freshness and traceability:
  - each section must point to source contracts/scripts/routes and validation artifacts
  - each release gate run must stamp the dossier date/version and unresolved risk list

## Definition of done for Block E

This documentation block is done only if:

- one canonical dossier exists and supersedes fragmented notes
- every critical feature has contract + frontend + test + runbook traceability
- security posture includes active controls and deferred controls with explicit rationale
- tokenomics and governance flows are reconciled against live deployment metadata
- CI can consume the machine-readable index and fail when required evidence is missing

## Definition of done for Block A

This first architectural block is done only if:

- the planner distinguishes venue families explicitly
- the vault execution screen exposes that distinction clearly
- `Balanced` is modeled as a different family from `Aquarius` and `SoroSwap`
- `AUTO` does not try to compare incomparable venue types
- unit, integration, and end-to-end coverage are updated
