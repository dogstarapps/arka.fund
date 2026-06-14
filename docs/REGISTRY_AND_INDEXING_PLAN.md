# Registry and Indexing Plan

Date: 2026-03-29

## Purpose

This document defines how Arka.fund should repair canonical vault discovery and evolve from the current RPC-driven indexing path into a durable production indexing architecture.

It exists because the current off-chain stack is technically validated, but the historical testnet `ArkaRegistry` currently referenced in `deployments.testnet.json -> contracts.arkaRegistry` is not a reliable discovery source for the current `catalog-api` ingestion flow.

## Status Update

As of 2026-03-29, the registry-repair portion of this plan is closed on testnet:

- the broken historical registry is preserved under `deployments.testnet.json -> legacyContracts.arkaRegistry`
- the canonical migrated registry is promoted under `deployments.testnet.json -> contracts.arkaRegistry`
- migration evidence is recorded under `deployments.testnet.json -> validations.canonicalRegistryMigration`
- the packaged off-chain stack now validates against that canonical registry under `deployments.testnet.json -> validations.offchainPublicStack`
- `catalog-api` now reads legacy instance storage when older Arkas do not expose the modern `nav()` ABI, which allows the historical testnet Arkas to index cleanly
- the registry and Arka contracts now expose an indexer-ready event surface validated live on testnet under `deployments.testnet.json -> validations.indexerEventSurface`

The remaining purpose of this document is the next architectural step: external-ingestion provider adoption on top of the now-stable canonical registry.

## Current Problem

### What is broken

- The current `catalog-api` indexing path reads `ArkaRegistry.get_arkas(offset, limit)` and then expands each returned Arka into a full product snapshot.
- The historical long-lived testnet registry failed under the indexer flow with `Error(Storage, MissingValue)` when calling `get_arkas`.
- That specific failure is now closed by the canonical registry migration and factory-backed backfill.

### Why this matters

- Product discovery is only as trustworthy as the canonical vault-discovery source.
- A healthy off-chain stack is not enough if the source of truth for “which Arkas exist?” is broken or ambiguous.
- This is not a cosmetic issue. It blocks credible `discover`, `leaderboards`, manager pages, and any public testnet browsing surface.

## Separation of Concerns

The platform needs three clearly separated layers:

### 1. Canonical discovery source

This must remain on-chain.

For Arka.fund, that means:

- a working `ArkaRegistry`
- governed rules for registration, curation, and delisting
- a migration/backfill path when storage layout or registry model changes

### 2. Ingestion layer

This is the system that consumes on-chain and history data and turns it into indexed records.

Possible implementations:

- custom ingestion via RPC / ledger meta
- managed indexer provider
- hybrid setup using both

### 3. Product read model

This is the app-facing API surface.

For Arka.fund, this remains:

- `catalog-api`
- product-specific snapshots
- rankings, dashboard aggregates, activity, composition, and historical views

External indexers can replace or reduce custom ingestion work, but they should not replace the product read model itself.

## Provider Evaluation

### Evaluation criteria

We care about:

- Soroban support quality
- Stellar-native data coverage
- real-time suitability for product surfaces
- support for custom transformations
- support for historical backfill
- operational simplicity
- portability / lock-in risk
- long-term fit for on-chain finance data needs

### Hubble

Assessment:

- excellent for analytics and historical investigation
- not appropriate as the primary product indexer

Why:

- Stellar Docs describes Hubble as a read-only BigQuery warehouse for historical analytics
- Stellar Docs explicitly says it is not suitable for real-time needs or simple lookups

Conclusion:

- use for research, BI, and audit support
- do not use as the main discovery/indexing backend for Arka.fund product surfaces

### Mercury

Assessment:

- strongest near-term fit for Arka.fund as the primary managed ingestion candidate

Why:

- Stellar-native and Soroban-focused
- Zephyr allows custom indexing logic, custom tables, monitoring logic, and custom callable APIs
- runs on Mercury infrastructure, reducing node and ETL operations burden
- supports backfill/catchup
- supports both testnet and mainnet deployment

Tradeoffs:

- vendor-managed runtime
- vendor-specific programming model
- some lock-in risk compared with self-hosted approaches

Conclusion:

- best short-term fit for Arka.fund’s product-indexing needs
- recommended as the primary managed-ingestion candidate

### OBSRVR Flow

Assessment:

- strategically promising
- not mature enough yet to be the primary recommendation

Why:

- Stellar-native
- focused on structured real-time ledger data and contract events
- clean conceptual fit for data pipelines into app databases and warehouses

Tradeoffs:

- private beta posture
- lower evidence of mature production workflow than Mercury or SubQuery

Conclusion:

- strong secondary candidate
- should be monitored closely
- not recommended as first cutover target unless its production readiness is confirmed

### SubQuery + OnFinality

Assessment:

- strongest portability / control option
- best fallback if Arka.fund wants to reduce vendor lock-in or keep self-host/managed flexibility

Why:

- mature indexing framework
- explicit Stellar and Soroban support
- supports GraphQL schema-driven transformed data
- can run locally with Docker and can be hosted by OnFinality
- supports real-time indexing of unconfirmed data

Tradeoffs:

- more generic, less Stellar-native than Mercury
- more operational and modeling work for Arka.fund’s domain-specific needs
- still requires building a product-facing API layer on top

Conclusion:

- best fallback / portability option
- recommended secondary path if Mercury is rejected or if we need an exit path

### Space and Time

Assessment:

- strategically valuable, but not the right first move for Arka.fund indexing

Why:

- strongest trust-minimization and verifiability story
- especially compelling for future NAV proofs, reserves proofs, protocol accounting, and compliance workflows
- Stellar support exists and the product is oriented toward real-time indexed data and verifiable SQL

Tradeoffs:

- more ambitious architectural shift
- likely more than what is needed to close the immediate discovery/indexing gap
- best value appears in future proof-heavy financial workflows, not in first repair of vault discovery

Conclusion:

- should be treated as a future strategic enhancement
- not recommended as the first provider to adopt for closing the current gap

## Recommendation

### Recommended target architecture

Arka.fund should adopt:

- canonical on-chain registry for discovery
- managed external ingestion provider for indexed raw/transformed data
- internal `catalog-api` as the product read model

### Recommended provider choice

Near-term recommendation:

- Mercury as the primary managed ingestion candidate

Fallback / portability recommendation:

- SubQuery, optionally hosted on OnFinality

Strategic watchlist:

- OBSRVR Flow
- Space and Time

Not suitable as primary product indexer:

- Hubble

## Implementation Plan

### Phase 1. Registry audit

Status:

- completed on testnet

Goal:

- determine exactly why the historical testnet registry is incompatible with the current indexing path

Scope:

- inspect the historical deployed registry ABI and storage behavior
- compare it with the current `arka-registry` contract implementation
- confirm whether the issue is:
  - missing initialization
  - storage-layout drift
  - deployment mismatch
  - partial migration

Exit criteria:

- written root-cause diagnosis
- clear decision: repair in place, migrate, or replace

### Phase 2. Canonical registry repair or migration

Status:

- completed on testnet

Goal:

- restore a real canonical on-chain discovery source for all current Arkas

Scope:

- if repairable, repair the existing registry
- otherwise deploy a new canonical registry
- backfill all real Arkas and manager curation states
- update `deployments.testnet.json` to point to the canonical working registry

Exit criteria:

- `get_arkas`, `get_arkas_by_manager`, `count`, and curation reads are green on testnet
- catalog ingestion can read the canonical registry without fixture fallback

Delivered result:

- canonical registry promoted to `contracts.arkaRegistry`
- historical registry preserved under `legacyContracts.arkaRegistry`
- factory-backed migration restored 18 historical Arkas and 2 managers
- packaged off-chain validation now indexes those 18 Arkas with zero sync failures

### Phase 3. Ingestion abstraction

Status:

- completed

Goal:

- make ingestion pluggable so the product is not hard-wired to one transport

Scope:

- define an ingestion interface below `catalog-api`
- support at least:
  - direct RPC/native ingestion
  - external-provider ingestion

Exit criteria:

- `catalog-api` can switch ingestion backend without changing product routes or frontend contracts

Delivered result:

- `catalog-api` now supports `native` and `graphql` ingestion backends behind the same service contract
- runtime selection is controlled by environment configuration, not code edits
- unit, integration, and end-to-end coverage now includes the GraphQL backend
- the native backend remains live-validated on testnet after the abstraction layer was introduced

### Phase 4. Open-provider pilot

Goal:

- validate a portable provider-backed ingestion path without depending on Mercury

Scope:

- implement and validate a provider profile that can map cleanly onto an open or self-hosted backend
- start with a SubQuery-compatible GraphQL shape because it can be self-hosted and locally reproduced
- preserve the current `catalog-api` output contract
- keep Mercury optional rather than mandatory

Exit criteria:

- `catalog-api` can build real product snapshots from a SubQuery-compatible provider profile
- testnet parity against the canonical registry is automated and green
- the release gate includes that provider-compatible parity check

### Phase 5. Fallback path

Status:

- completed

Goal:

- avoid single-provider lock-in

Scope:

- keep or add a second ingestion path
- the preferred fallback is SubQuery-based ingestion
- document what would be required to switch providers

Exit criteria:

- provider dependency is explicit and reversible

Delivered result:

- `catalog-api` now has a provider-neutral `graphql` ingestion backend alongside the native RPC path
- snapshot GraphQL mirroring and parity comparison are implemented as first-class runtime utilities
- `scripts/deploy-graphql-backend-parity-validation.sh` now validates parity between the native backend and the GraphQL backend against canonical testnet data
- `scripts/deploy-subquery-backend-parity-validation.sh` now validates parity between the native backend and a SubQuery-compatible GraphQL profile against canonical testnet data
- portability is now protected by automation instead of one-off manual checks

### Phase 6. Off-chain stack revalidation

Status:

- completed on testnet

Goal:

- rerun the full packaged stack against the repaired canonical registry

Scope:

- update `deploy-offchain-testnet-stack.sh`
- remove the dedicated fixture fallback from the primary validation path
- rerun `run-release-gate.sh`

Exit criteria:

- `offchainPublicStack` passes using the canonical registry
- release gate remains green with the canonical discovery source
- the canonical registry and Arka configuration surfaces now emit stable discovery/configuration events validated through live RPC on testnet

## Acceptance Standard

Arka.fund should not consider discovery/indexing closed until:

- the canonical registry is healthy on testnet
- `catalog-api` indexes from the canonical registry, not a fixture
- the packaged `catalog-api + dapp` stack passes testnet validation without fallback
- the release gate passes with the canonical discovery source
- provider-facing discovery/configuration events are now live-validated and recorded in `tmp/indexer-event-surface-live-validation.json`

## Decision Summary

- Fixing the canonical `ArkaRegistry` is mandatory.
- An external indexer should be adopted for ingestion.
- `catalog-api` should remain the product read model.
- SubQuery is now the best current primary pilot candidate because it can be self-hosted and validated without vendor access.
- Mercury remains a viable managed option, but should be treated as optional rather than foundational while it stays paid/proprietary.
- OBSRVR Flow should be monitored as it matures.
- Space and Time should be treated as a future strategic verifiability layer, not the first indexing migration.
- Hubble should remain an analytics tool, not the product indexer.

## Reference Notes

- Stellar Docs `Indexers Overview` is the current ecosystem map used for this decision. It explicitly separates portfolio APIs, custom streaming/transformation indexers, and analytics, and it lists Mercury, SubQuery, OnFinality, Space and Time, OBSRVR Flow, and Hubble-adjacent tooling as distinct categories.
- Stellar Docs `Hubble` explicitly states that Hubble is for historical analytics, is read-only, is updated in intraday batches, and should not be used for real-time data retrieval.
- Mercury documentation is the basis for treating Mercury as the strongest immediate managed-ingestion candidate because it provides real-time ledger-meta access, backfill/catchup, serverless/custom APIs, and Soroban-native indexing logic.
- SubQuery documentation is the basis for treating SubQuery as the strongest portability fallback because Stellar/Soroban indexing is documented, local Docker execution is supported, and the output is queryable through GraphQL.
- Space and Time documentation and Stellar Docs are the basis for treating it as a strategic future layer rather than the first migration target because its strongest value proposition is verifiable SQL / proof-driven computation, not simply repairing product discovery.
