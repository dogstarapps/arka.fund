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

- `CATALOG_API_INGESTION_BACKEND=native` is the production Mainnet path and reads the canonical `ArkaRegistry` over Soroban RPC.
- `CATALOG_API_INGESTION_BACKEND=graphql` is now a fully supported backend for provider-backed ingestion.
- `CATALOG_API_GRAPHQL_PROFILE=subquery` enables a SubQuery-compatible connection shape for open/self-hosted provider pilots.
- Historical test Arkas without the current `nav()` ABI are handled by an isolated legacy-storage compatibility reader.
- `bash scripts/deploy-graphql-backend-parity-validation.sh` validates backend parity on testnet and records `tmp/graphql-backend-parity.json`.
- `bash scripts/deploy-subquery-backend-parity-validation.sh` validates the SubQuery-compatible provider profile and records `tmp/subquery-backend-parity.json`.

### Stellar RPC request pacing

For rate-limited RPCs, set `CATALOG_API_RPC_MIN_INTERVAL_MS` to the minimum time in milliseconds between outgoing Stellar RPC requests. Sync, contract reads, profit, activity and holder lookups share the same pacing inside the catalog API process. The default `0` preserves the existing request timing.

### Verified mainnet profit

Set `CATALOG_API_PROFIT_SEED_FILE` to the independently verified lifetime cash-flow checkpoint and `CATALOG_API_PROFIT_CHECKPOINT_FILE` to a separate file on the catalogue's persistent volume. Use the configured HTTPS Stellar mainnet RPC and the existing authenticated `POST /v1/sync` schedule. The catalogue files have one writer. The profit checkpoint advances atomically and overlapping sync requests share the same run.

Each seeded Arka includes its creation ledger, last fully covered ledger, denomination, share token, executable hash, cumulative deposits and withdrawals in base units, and whether any amounts were converted. Keep the seed and its ledger evidence together outside Git. On each sync, the catalogue checks the Arka's identity at the NAV ledger and verifies any new deposits and withdrawals against the settled transfers. The result is NAV plus net withdrawals minus gross deposits. XLM/USDC conversions use the last confirmed trade before the event ledger and are marked as estimates.

`GET /v1/arkas` and `GET /v1/arkas/:id` expose `verifiedProfit` with the amount, timestamp, ledger and estimate flag. The current sync omits that field when a required event, ledger interval or exchange rate cannot be verified. The last valid checkpoint remains available for recovery. If the RPC has pruned the missing interval or the contract identity changed, verify the gap against archived ledgers before extending or replacing the seed.
