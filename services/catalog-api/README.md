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
- signed webhook delivery for alert transitions
- reproducible local end-to-end validation against a local Soroban network

## Runtime

- Node 20 or newer

## Commands

```bash
cd /Users/marcosoliva/Development/dogstar/arkafund/services/catalog-api
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
- `bash /Users/marcosoliva/Development/dogstar/arkafund/scripts/deploy-graphql-backend-parity-validation.sh` validates backend parity on testnet and records the result in `/Users/marcosoliva/Development/dogstar/arkafund/tmp/graphql-backend-parity.json`.
- `bash /Users/marcosoliva/Development/dogstar/arkafund/scripts/deploy-subquery-backend-parity-validation.sh` validates parity on testnet for the SubQuery-compatible provider profile and records the result in `/Users/marcosoliva/Development/dogstar/arkafund/tmp/subquery-backend-parity.json`.
