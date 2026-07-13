# Catalog API

This service builds and serves the indexed catalog required for discovery and leaderboard surfaces.

## Scope

- on-chain sync from `arka-registry` and `arka`
- pluggable ingestion through a native Soroban backend or a GraphQL backend
- persisted catalog snapshots with atomic file writes
- persisted historical archive of sync runs
- persisted monitoring archive for sync runs and alert state
- asset snapshots, asset time series, and contract activity over a single API surface
- dashboard KPI and portfolio composition endpoints built on the same indexed state
- HTTP API for metrics, dashboard, Arkas, assets, managers, history, activity, health, and monitoring
- signed webhook and PagerDuty Events API v2 delivery for alert transitions
- reproducible local end-to-end validation against a local Soroban network

## Runtime

- Node 20 or newer

## Commands

```bash
cd services/catalog-api
npm ci
npm run regen:bindings
npm run test:unit
npm run test:integration
npm run test:e2e
```

## Monitoring

Runtime monitoring is configured with environment variables:

- `CATALOG_API_MONITORING_FILE`
- `CATALOG_API_MONITORING_RETENTION_RUNS`
- `CATALOG_API_MAX_SNAPSHOT_AGE_SECONDS`
- `CATALOG_API_MAX_SYNC_DURATION_MS`
- `CATALOG_API_MAX_FAILURE_RATIO`
- `CATALOG_API_MAX_CONSECUTIVE_FAILURES`
- `CATALOG_API_ALERT_WEBHOOK_URL`
- `CATALOG_API_ALERT_WEBHOOK_SECRET`
- `CATALOG_API_ALERT_WEBHOOK_TIMEOUT_MS`
- `CATALOG_API_PAGERDUTY_ROUTING_KEY`
- `CATALOG_API_PAGERDUTY_SOURCE` (defaults to `catalog.arka.fund`)
- `CATALOG_API_PAGERDUTY_EVENTS_URL` (defaults to the EU Events API v2 endpoint)
- `CATALOG_API_PAGERDUTY_TIMEOUT_MS`

When `CATALOG_API_PAGERDUTY_ROUTING_KEY` is configured, each alert transition is
sent as an Events API v2 event. A stable deduplication key per alert type ensures
that recovery resolves the same PagerDuty incident that the alert opened.

Runtime activity indexing is configured with:

- `CATALOG_API_INGESTION_BACKEND`
- `CATALOG_API_REGISTRY_CONTRACT_ID`
- `CATALOG_API_GRAPHQL_URL`
- `CATALOG_API_GRAPHQL_PROFILE`
- `CATALOG_API_GRAPHQL_AUTH_TOKEN`
- `CATALOG_API_GRAPHQL_PAGE_SIZE`
- `CATALOG_API_GRAPHQL_TIMEOUT_MS`
- `CATALOG_API_ACTIVITY_BACKEND`
- `CATALOG_API_ACTIVITY_LOOKBACK_LEDGERS`
- `CATALOG_API_ACTIVITY_PAGE_SIZE`
- `CATALOG_API_ACTIVITY_MAX_PAGES`

Notes:

- `CATALOG_API_INGESTION_BACKEND=native` is the live testnet path and reads the canonical `ArkaRegistry`.
- `CATALOG_API_INGESTION_BACKEND=graphql` is now a fully supported backend for provider-backed ingestion.
- `CATALOG_API_GRAPHQL_PROFILE=subquery` enables a SubQuery-compatible connection shape for open/self-hosted provider pilots.
- The native backend includes legacy instance-storage fallbacks for historical Arkas that do not expose the current `nav()` ABI.
- `bash scripts/deploy-graphql-backend-parity-validation.sh` validates backend parity on testnet and records the result in `tmp/graphql-backend-parity.json`.
- `bash scripts/deploy-subquery-backend-parity-validation.sh` validates parity on testnet for the SubQuery-compatible provider profile and records the result in `tmp/subquery-backend-parity.json`.
