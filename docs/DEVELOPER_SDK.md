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
  - typed health, metrics, Arka, asset, manager, activity and monitoring reads

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
