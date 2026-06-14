# Arkafund TypeScript SDK

This package provides a maintained TypeScript SDK for Arkafund contract integrations. It wraps generated Soroban contract bindings with a stable API for:

- registry administration and discovery reads
- oracle policy administration and inspection
- vault reads plus supported deposit and redeem builders
- extension registration for third-party tooling on top of the supported surface

## Install

```bash
npm install @arkafund/sdk
```

Runtime:
- Node 20 or newer. The upstream Stellar SDK currently declares Node 20+ support.

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
