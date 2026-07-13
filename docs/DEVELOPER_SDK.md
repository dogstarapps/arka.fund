# Developer SDK

The public TypeScript SDK lives in `sdk/typescript` from the repository root.

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
npm run test:e2e
```
