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

- Node.js 22 or newer

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

### Testnet catalog in the frontend preview

Build and package the preview adapter with the locked catalog dependencies.

```sh
npm run build
npm run preview:bundle
```

Include `dist/testnet-preview/testnetPreview.mjs` as
`apps/web/src/lib/catalog/testnetPreview.mjs` in the protected Vercel preview
deployment. The generated bundle and the archived observations are kept outside
Git.

Configure the preview project with the Testnet passphrase and network target,
`NEXT_PUBLIC_UX_REVIEW_PREVIEW=1`, `NEXT_PUBLIC_ARKA_REGISTRY`,
`ARKA_TESTNET_CATALOG_SOURCE_ACCOUNT` (a public read account),
`ARKA_TESTNET_CATALOG_START_LEDGER`, and the comma-separated
`ARKA_TESTNET_CATALOG_WASM_HASHES` for the reviewed Testnet deployments. Connect
a private Vercel Blob store to Preview using OIDC and set
`ARKA_TESTNET_HISTORY_BLOB_ID` to that store's ID. Use
`ARKA_TESTNET_HISTORY_BOOTSTRAP=1` for the initial observation in a new store.
Use the same store and registry on subsequent deployments.

The archive at `catalog-history/v1/testnet/<registry>/history.json.gz` retains
complete observations sampled once per five-minute interval with traffic.
Concurrent appends merge using the object's ETag. Preview catalog endpoints
perform Stellar reads and unsigned simulations.
