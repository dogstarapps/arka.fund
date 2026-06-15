# Protocol Expansion And Router v2

Date: 2026-04-07

## Why this document exists

Arka.fund already supports live execution across `Aquarius`, `SoroSwap`, and `Blend`, but the current routing layer is still a first-generation implementation:

- `best execution` compares only direct `SoroSwap` and direct `Aquarius`
- `Balanced` has been reopened as a first-class protocol effort, but its live cutover is still pending
- `Blend` is integrated today as a credit lane, not as a swap venue

This document records the target architecture and the next implementation blocks so protocol expansion does not turn into per-screen special casing.

## Current repo-backed truth

### Validated live execution surface

- Swap / rebalance:
  - `Aquarius`
  - `SoroSwap`
- Credit:
  - `Blend`

### Reopened but not fully live-promoted

- `Balanced`

### Important limitation of the current smart routing

The current client-side route planner is a direct quote comparator. It does not yet do:

- multi-hop route search
- split routing
- global optimization across all supported venues
- protocol capability discovery
- route scoring that includes venue policy, stale quotes, route depth, or execution risk

## Product direction

### 1. Balanced must become first-class

Balanced is a serious protocol target and should become part of Arka.fund's supported public protocol surface. The goal is not only contract support, but:

- canonical adapter deployment
- readiness and promotion in validation artifacts
- runtime support visibility in the dApp
- inclusion in routing capability discovery when the live lane is ready

### 2. Smart routing must become venue-pluggable

The next routing layer should support protocol expansion without rewriting the vault execution screen each time a new venue is added.

Target principles:

- protocol-specific quoting should be isolated behind `RouteSource` readers
- route search should be protocol-agnostic
- execution plans should carry their own path and step metadata
- the UI should render the selected plan rather than reconstructing routing logic ad hoc

### 3. Blend should be treated as strategy infrastructure, not forced into swap routing

Blend is currently integrated in Arka.fund as a credit lane, which matches the current contract and dApp behavior. That is still correct for the active validation matrix.

However, Blend offers a broader strategy surface than the current `lend / borrow / repay / withdraw` usage:

- isolated lending pools
- backstop modules
- emissions and reward-zone mechanics
- fee-vault integrations for protocols and wallets
- flash-loan oriented advanced integrations

That makes Blend a candidate for `strategy primitives`, not for `swap routing`.

## Router v2 target architecture

### A. Route sources

Each protocol source should expose capabilities instead of leaking implementation details into the UI.

Examples:

- `SoroSwap`
  - direct quote
  - multi-hop quote through a token path
  - router-path execution
- `Aquarius`
  - direct quote
  - pool discovery
  - direct pool execution
- `Balanced`
  - quote and execute only when canonical live lane is ready
- future venues
  - same shape, protocol-specific internals hidden behind source adapters

### B. Route candidates

A candidate should describe:

- venue / protocol
- hop count
- token path
- estimated output
- minimum output
- execution kind
- metadata required to actually execute the route

### C. Planner

The planner should:

- enumerate direct and supported multi-hop candidates
- score candidates by output and execution viability
- keep explicit requested-lane selection working
- degrade gracefully when quotes are unavailable

### D. Execution

Execution must only expose route kinds we can execute honestly.

Current safe target:

- `SoroSwap` direct and multi-hop router-path execution
- `Aquarius` direct execution

We should not pretend to support cross-venue multi-hop execution until the execution path is actually closed.

## Implementation plan

### Block 1

`Router v2 foundation`

- introduce planner data model
- add multi-hop SoroSwap route support
- keep Aquarius direct in the same planner
- surface route path and hop count in the dApp

### Block 2

`Balanced first-class routing admission`

- admit `Balanced` as a route source only after live readiness is canonical
- remove any remaining legacy assumptions from route selection

### Block 3

`Global routing and scoring`

- route scoring policies
- split routing when execution closes
- off-chain or hybrid route search for non-Soroban liquidity where appropriate

### Block 4

`Blend strategy study`

- evaluate fee-vault integration
- evaluate backstop-aware strategy surfaces
- evaluate flash-loan utility for managed vault workflows

## Definition of done for Router v2 foundation

This first block is done only if:

- route planning is protocol-pluggable in code
- SoroSwap multi-hop is real, not placeholder
- the Arka execution screen renders route path and route depth
- explicit lane selection still works
- unit, integration, and e2e coverage are updated
