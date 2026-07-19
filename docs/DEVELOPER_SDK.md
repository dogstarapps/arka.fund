# Developer SDK

The public TypeScript SDK lives at `sdk/typescript` and is published as `@arkafund/sdk`.

## Supported surface

- `registry(contractId)`
  - admin initialization
  - registrar authorization
  - Arka registration and legacy registration
  - curated and delisted state
  - discovery reads and counts
- `oracleGuard(contractId)`
  - admin initialization
  - stellar and symbol feed policy management
  - policy inspection and SEP-40 price reads
- `vault(contractId)`
  - NAV, manager, router, share token, fee, and whitelist reads
  - typed deposit and redeem builders
  - blend and credit market status reads
- `factory(contractId)`
  - canonical Arka creation and initialization
  - creation fee and default policy reads
- `router(contractId)`
  - route execution with explicit minimum-output validation
- `venueRegistry(contractId)`
  - public venue configuration and governed protocol status changes
- `CatalogClient`
  - typed health, NAV, OracleGuard price, Arka, asset, manager, activity and monitoring reads
- `workflow()`
  - human-readable percentages and decimal asset amounts
  - creation-fee balance and allowance handling
  - deposit and redemption
  - AUTO or protocol-specific routing and vault rebalance construction
  - Blend and generic credit actions

## Product workflow

Use the high-level workflow for product integrations. It accepts decimal amounts
and percentages, while the lower-level modules remain available for applications
that need direct control over contract arguments.

```ts
import {
  ARKAFUND_MAINNET_ASSETS,
  ArkafundSdk,
  createMainnetConfig,
  walletSdkConfig,
} from "@arkafund/sdk";

const sdk = new ArkafundSdk(walletSdkConfig(
  createMainnetConfig(),
  walletAddress,
  wallet,
));
const workflow = sdk.workflow();

await workflow.deposit({
  arkaId,
  account: walletAddress,
  assetContract: ARKAFUND_MAINNET_ASSETS.USDC,
  amount: "25.50",
});

const plan = await workflow.planRebalance({
  protocol: "AUTO",
  amount: "10",
  tokenIn: ARKAFUND_MAINNET_ASSETS.USDC,
  tokenOut: ARKAFUND_MAINNET_ASSETS.XLM,
  slippagePercent: 0.5,
  readerPubKey: walletAddress,
  vaultNav: "1000",
  dailyTurnoverUsed: "0",
  projectedAllocationShiftPercent: "1",
});

await workflow.rebalance(arkaId, walletAddress, plan);
```

`projectedAllocationShiftPercent` must be calculated from values expressed in a
common currency, normally the verified USD prices exposed by Catalog. The SDK
does not compare raw token units from different assets.

The complete example is published with the package at
`examples/product-workflow.ts`.

## Catalog and NAV

`https://catalog.arka.fund` is the canonical indexed data service. Its `/v1/nav`
endpoint serves the current aggregate NAV; `/v1/prices` exposes the OracleGuard
status used to produce USD values. The DApp route `https://app.arka.fund/api/nav`
is a cache-aware proxy of the same catalog response.

USDC uses declared USD parity. Other assets are valued only when OracleGuard
returns a usable price. Missing, stale, invalid or paused feeds remain unavailable
instead of being replaced by an estimated fallback.

## Extension model

The SDK exposes a versioned extension registry. Third-party integrators can mount additional tooling modules without mutating the core SDK modules:

- each extension provides `id`, `version`, and `install(sdk)`
- extension ids are unique inside a single SDK instance
- installed modules are retrievable with `sdk.getExtension(id)`

This keeps the supported contract surface stable while allowing partner-specific automation or analytics packages to compose on top of it.

## Binding maintenance

Bindings are generated from freshly built WASM artifacts, not hand-written:

```bash
bash scripts/build-wasm.sh
cd sdk/typescript
npm run regen:bindings
```

Generated sources are committed under `sdk/typescript/src/generated`.

## Validation matrix

- Unit: pure TypeScript validation, config, and extension registry tests
- Integration: live contract interaction via the SDK against a local Soroban network
- End-to-end: local network bootstrap, contract deployment, unit suite, then live integration suite through a single reproducible script

Run locally:

```bash
cd sdk/typescript
npm run test:unit
npm run test:consumer
npm run example:mainnet
npm run test:e2e
```
