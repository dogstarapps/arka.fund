# Arkafund TypeScript SDK

This package provides a maintained TypeScript SDK for Arkafund contract integrations. It wraps generated Soroban contract bindings with a stable API for:

- mainnet network and contract-address presets
- atomic Arka creation through the factory
- registry administration and discovery reads
- oracle policy administration and inspection
- vault reads plus supported deposit and redeem builders
- route execution with explicit per-hop minimum output
- venue status inspection and authorized emergency disabling
- extension registration for third-party tooling on top of the supported surface

## Install

```bash
npm install @arkafund/sdk
```

Runtime:
- Node 22 or newer. The upstream Stellar SDK currently declares Node 22+ support.

## Quick start

```ts
import {
  ArkafundSdk,
  DivergenceMode,
  createKeypairSigner,
} from "@arkafund/sdk";

const networkPassphrase = "Test SDF Network ; September 2015";
const sdk = new ArkafundSdk({
  rpcUrl: "https://soroban-testnet.stellar.org",
  networkPassphrase,
  ...createKeypairSigner(process.env.ADMIN_SECRET!, networkPassphrase),
});

const registry = sdk.registry(process.env.REGISTRY_CONTRACT_ID!);
await registry.setRegistrar(
  process.env.ADMIN_PUBLIC_KEY!,
  process.env.WRITER_PUBLIC_KEY!,
  true,
);

const guard = sdk.oracleGuard(process.env.ORACLE_GUARD_CONTRACT_ID!);
await guard.setStellarPolicy({
  caller: process.env.ADMIN_PUBLIC_KEY!,
  asset: process.env.ASSET_ID!,
  primary: process.env.PRIMARY_ORACLE_ID!,
  secondary: process.env.SECONDARY_ORACLE_ID!,
  hasSecondary: true,
  maxPriceAge: 900,
  maxDeviationBps: 250,
  requireSecondary: false,
  divergenceMode: DivergenceMode.UseSecondary,
});
```

## Mainnet preset

The SDK includes the public Stellar mainnet passphrase, RPC endpoint and the
contract IDs in the release manifest. No private key or signing authority is
included.

```ts
import {
  ARKAFUND_MAINNET_CONTRACTS,
  ArkafundSdk,
  createMainnetConfig,
} from "@arkafund/sdk";

const sdk = new ArkafundSdk(createMainnetConfig());
const factory = sdk.factory(ARKAFUND_MAINNET_CONTRACTS.arkaFactory);
const venues = sdk.venueRegistry(ARKAFUND_MAINNET_CONTRACTS.venueRegistry);
```

## Create an Arka

`createAndInitialize` is the supported factory creation path. It creates,
initializes and registers the Arka atomically. The connected manager signs the
transaction. Fees are supplied in basis points because this mirrors the
on-chain contract interface.

```ts
const created = await factory.createAndInitialize({
  salt: crypto.getRandomValues(new Uint8Array(32)),
  manager: managerAddress,
  denomination: usdcContractId,
  managementFeeBps: 100,
  performanceFeeBps: 1_500,
  depositFeeBps: 0,
  redemptionFeeBps: 0,
  whitelist: [usdcContractId, xlmContractId],
  router: ARKAFUND_MAINNET_CONTRACTS.router,
});

console.log(created.hash, created.simulationResult);
```

## Execute a route

The router executes routes that have already been selected by the application
or integration. It does not invent a price quote. Every hop requires a
`minOut`; the first hop requires a positive `amountIn`. A subsequent hop can
set `amountIn: 0` to use the prior hop's output.

```ts
const router = sdk.router(ARKAFUND_MAINNET_CONTRACTS.router);
const result = await router.execute({
  caller: managerAddress,
  steps: [
    {
      adapter: ARKAFUND_MAINNET_CONTRACTS.adapterPhoenix,
      poolId: 0,
      amountIn: 1_000_000n,
      minOut: 990_000n,
      assetOut: xlmContractId,
    },
  ],
});

console.log(result.hash);
```

## Venue controls

Venue status is public. Changing it requires the configured governor or,
for emergency disabling, the authorized guardian. The SDK only constructs and
submits the signed contract transaction; it does not bypass those controls.

```ts
import { VenueStatus } from "@arkafund/sdk";

const registry = sdk.venueRegistry(ARKAFUND_MAINNET_CONTRACTS.venueRegistry);
const phoenix = ARKAFUND_MAINNET_CONTRACTS.adapterPhoenix;

console.log(await registry.configFor(phoenix));
console.log(await registry.isAutoAllowed(phoenix));

await registry.setStatus(governorAddress, phoenix, VenueStatus.ManualOnly);
```

## Modules

`registry(contractId)`
- admin initialization
- registrar management
- Arka registration and legacy registration
- curated and delisted flags
- discovery reads and counts

`oracleGuard(contractId)`
- admin rotation
- stellar and symbol policy management
- policy inspection
- SEP-40 compatible `lastPrice` reads

`vault(contractId)`
- NAV, fee, router, manager, share token and whitelist reads
- typed deposit and redeem builders
- blend and credit market status reads

`factory(contractId)`
- Arka pagination and manager discovery
- creation fee, default venue, router, adapter and risk-policy reads
- atomic `createAndInitialize` transaction builder and submitter

`router(contractId)`
- signed `execute` and `executeFor` route builders
- validates contract addresses, 128-bit values and mandatory minimum output

`venueRegistry(contractId)`
- venue pagination, configuration and allowed-status reads
- signed governor status changes and guardian/governor emergency disable

## Extension model

Third-party tooling can install an extension module on top of the SDK without mutating core behavior:

```ts
const analytics = sdk.use({
  id: "partner.analytics",
  version: "1.0.0",
  install(currentSdk) {
    return {
      async registeredCount(registryId: string) {
        return currentSdk.registry(registryId).count();
      },
    };
  },
});
```

Extension IDs are unique inside a given SDK instance and are retrievable through `sdk.getExtension(id)`.

## Maintainer workflow

Refresh the generated bindings after rebuilding contract WASM artifacts:

```bash
bash /Users/marcosoliva/Development/dogstar/arkafund/scripts/build-wasm.sh
cd /Users/marcosoliva/Development/dogstar/arkafund/sdk/typescript
npm run regen:bindings
```

## Validation

```bash
cd /Users/marcosoliva/Development/dogstar/arkafund/sdk/typescript
npm run test:unit
npm run test:e2e
```
