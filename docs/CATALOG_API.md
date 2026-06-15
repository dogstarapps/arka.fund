# Catalog API

The catalog API lives at `/Users/marcosoliva/Development/dogstar/arkafund/services/catalog-api`.

## What it solves

This service provides the first indexed data surface needed by discovery and leaderboard features:

- pluggable ingestion with a native on-chain backend and a GraphQL backend
- per-Arka snapshots with manager, NAV, fee summary, whitelist, share token, and asset exposure
- global asset aggregates and per-Arka asset breakdowns
- manager aggregates with total NAV and Arka counts
- persisted snapshots with atomic writes
- persisted archive of historical sync runs
- persisted monitoring archive for sync telemetry and alert state
- live contract activity mapped from on-chain events
- signed webhook notifications for alert transitions
- dashboard KPI and portfolio composition views derived from indexed state
- HTTP endpoints for health, sync, metrics, dashboard, monitoring, activity, Arka listings, asset listings, manager listings, and time series

## Endpoints

- `GET /health`
- `POST /v1/sync`
- `GET /v1/metrics`
- `GET /v1/dashboard/overview`
- `GET /v1/dashboard/composition`
- `GET /v1/monitoring/status`
- `GET /v1/monitoring/runs`
- `GET /v1/monitoring/alerts`
- `GET /v1/activity`
- `GET /v1/history`
- `GET /v1/arkas`
- `GET /v1/arkas/:id`
- `GET /v1/arkas/:id/history`
- `GET /v1/arkas/:id/portfolio`
- `GET /v1/arkas/:id/assets`
- `GET /v1/arkas/:id/assets/:assetId/history`
- `GET /v1/arkas/:id/activity`
- `GET /v1/assets`
- `GET /v1/assets/:id`
- `GET /v1/assets/:id/history`
- `GET /v1/managers`
- `GET /v1/managers/:id`
- `GET /v1/managers/:id/history`

The sync endpoint supports an optional `x-arkafund-sync-token` gate for operational control.
Alert delivery supports an optional signed webhook using `x-arkafund-signature`.

## Data model

Snapshot payloads store:

- `arkas`
  - `arkaId`
  - `manager`
  - `curated`
  - `delisted`
  - `nav`
  - `denominationContract`
  - `fees`
  - `whitelistContracts`
  - `shareToken`
  - `assets`
    - `assetContract`
    - `liquidBalance`
    - `collateralAmount`
    - `debtAmount`
    - `netManagedAmount`
    - `netPositionValue`
    - `marketIds`
  - `syncedAt`
- `assets`
  - `assetContract`
  - `arkaCount`
  - `managerCount`
  - `denominationArkaCount`
  - `liquidBalance`
  - `collateralAmount`
  - `debtAmount`
  - `netManagedAmount`
  - `netPositionValue`
  - `syncedAt`
- `managers`
  - `manager`
  - `arkaCount`
  - `curatedArkaCount`
  - `delistedArkaCount`
  - `totalNav`
  - `syncedAt`
- `metrics`
  - total counts and aggregate NAV
- `failures`
  - per-Arka indexing failures without losing healthy rows
- `history archive`
  - bounded list of historical runs, each one preserving the full snapshot taken at sync time
  - supports Arka, manager, global asset, and per-Arka asset series
- `monitoring archive`
  - bounded list of sync runs with duration, status, totals, and error information
  - reconciled alert state for `snapshot_missing`, `snapshot_stale`, `sync_failed`, `consecutive_failures`, `sync_slow`, and `partial_sync_failures`
- `activity feed`
  - decoded contract events for `deposit`, `redeem`, `profit`, `lend`, `borrow`, `repay`, and `withdraw`
  - enriched with Arka manager and denomination context
- `dashboard overview`
  - total NAV, NAV delta vs previous snapshot, counts, monitoring summary, and recent user-flow summary
- `portfolio composition`
  - global and per-Arka composition ranked by `navContribution`
  - `navContribution` follows the current vault accounting basis: `liquidBalance + netPositionValue`

## Validation

The service is covered at three levels:

- Unit:
  - catalog aggregation, asset aggregation, ranking, filtering, and file storage
  - history archive retention and series derivation
  - activity pagination and filtering
  - monitoring status evaluation, alert reconciliation, webhook signing, and monitoring storage
- Integration:
  - HTTP API over real store and seeded snapshots
  - asset endpoints and activity endpoints over the same app surface
  - dashboard overview and portfolio composition endpoints over the same app surface
  - alert trigger and resolution flows over the monitoring endpoints and webhook sink
  - live on-chain indexing against a local Soroban fixture
- End-to-end:
  - local network bootstrap
  - contract deployment
  - fixture seeding with real deposits into two Arkas
  - second on-chain state change and resync
- HTTP sync, ranking, dashboard KPIs, portfolio composition, history, asset series, activity, monitoring status, and signed webhook verification

## Runtime configuration

Snapshot ingestion is selected with:

- `CATALOG_API_INGESTION_BACKEND`
  - `native` uses `arka-registry` plus direct contract reads over Soroban RPC
  - `graphql` uses a GraphQL endpoint that exposes paginated Arka entities
- `CATALOG_API_REGISTRY_CONTRACT_ID`
  - required for the `native` backend
- `CATALOG_API_GRAPHQL_URL`
  - required for the `graphql` backend
- `CATALOG_API_GRAPHQL_PROFILE`
  - `generic` expects a flat `arkas[]` payload
  - `subquery` expects a connection-style `arkas { totalCount nodes[] }` payload
- `CATALOG_API_GRAPHQL_AUTH_TOKEN`
  - optional bearer token for the `graphql` backend
- `CATALOG_API_GRAPHQL_PAGE_SIZE`
- `CATALOG_API_GRAPHQL_TIMEOUT_MS`

Activity ingestion is configured independently:

- `CATALOG_API_ACTIVITY_BACKEND`
  - `rpc` uses Soroban RPC event reads
  - `none` disables activity enrichment
- `CATALOG_API_ACTIVITY_LOOKBACK_LEDGERS`
- `CATALOG_API_ACTIVITY_PAGE_SIZE`
- `CATALOG_API_ACTIVITY_MAX_PAGES`

The native backend now includes compatibility for historical Arkas that do not expose the modern `nav()` ABI by reading legacy instance storage directly from testnet.

Provider portability is now protected by a parity validation path:

- `scripts/deploy-graphql-backend-parity-validation.sh`
- `tmp/graphql-backend-parity.json`
- `scripts/deploy-subquery-backend-parity-validation.sh`
- `tmp/subquery-backend-parity.json`

That validation builds a native snapshot from the canonical testnet registry, mirrors it through the GraphQL backend contract, and asserts parity between both read paths.

Run locally:

```bash
cd /Users/marcosoliva/Development/dogstar/arkafund/services/catalog-api
npm run test:unit
npm run test:integration
npm run test:e2e
```
