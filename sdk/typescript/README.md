# Arkafund TypeScript SDK

Public TypeScript SDK for reading the Arka catalog and building wallet-signed
Stellar contract interactions. The package combines:

- a typed client for the public indexer and NAV API
- Stellar mainnet network and contract presets
- factory, vault, registry, router, venue-registry and oracle-guard modules
- exact amount and percentage formatting helpers
- transaction builders that preserve wallet custody and on-chain authorization

## Requirements

- Node.js 22 or newer
- a supported Stellar wallet or signer for state-changing actions
- no API key for public catalog and contract reads

## Install

```bash
npm install @arkafund/sdk
```

## Read mainnet data

The public catalog is read-only. Values such as NAV and balances are exact
integer strings so consumers do not lose on-chain precision.

```ts
import {
  CatalogClient,
  formatAssetAmount,
  formatBasisPoints,
} from "@arkafund/sdk";

const catalog = new CatalogClient();
const health = await catalog.health();
const arkAs = await catalog.arkas({
  curated: true,
  delisted: false,
  limit: 20,
});

for (const arka of arkAs.items) {
  console.log({
    contractId: arka.arkaId,
    name: arka.identity?.displayName ?? arka.arkaId,
    nav: formatAssetAmount(arka.nav, 7),
    managementFee: formatBasisPoints(arka.fees.mgmtBps),
  });
}

console.log({
  healthy: health.healthy,
  indexedArkas: health.indexedArkas,
  failedArkas: health.failedArkas,
});
```

Public API reference: <https://arka.fund/docs/api-reference.html>

## Verify catalog data on-chain

The SDK can read the same Arka directly from its Soroban contract. This example
compares the indexed manager and NAV with the contract values.

```ts
import {
  ArkafundSdk,
  CatalogClient,
  createMainnetConfig,
} from "@arkafund/sdk";

const catalog = new CatalogClient();
const sdk = new ArkafundSdk(createMainnetConfig());
const curated = await catalog.arkas({ curated: true, delisted: false, limit: 1 });
const indexed = curated.items[0];

const vault = sdk.vault(indexed.arkaId);
const [manager, nav, fees, whitelist] = await Promise.all([
  vault.manager(),
  vault.nav(),
  vault.fees(),
  vault.whitelist(),
]);

console.log({
  managerMatches: manager === indexed.manager,
  navMatches: nav.toString() === indexed.nav,
  fees,
  whitelist,
});
```

The package includes a complete executable version at
`examples/mainnet-read.mjs`.

## Wallet signing

Reads do not require a wallet. Deposits, redemptions, Arka creation, routing and
governance actions require a public key and a wallet-backed `signTransaction`
callback.

```ts
import {
  ArkafundSdk,
  STELLAR_MAINNET_PASSPHRASE,
  createMainnetConfig,
} from "@arkafund/sdk";

const signedSdk = new ArkafundSdk(createMainnetConfig({
  publicKey: walletAddress,
  signTransaction: async (xdr) => {
    const signed = await wallet.signTransaction(xdr, {
      networkPassphrase: STELLAR_MAINNET_PASSPHRASE,
    });
    return { signedTxXdr: signed.signedTxXdr };
  },
}));
```

The wallet remains the transaction signer. The SDK does not include private
keys, signing authority or a custody layer.

## Deposit and redeem

Amounts passed to contracts use exact base units. Convert a user-entered decimal
amount with the asset's declared decimals before building the transaction.

```ts
const vault = signedSdk.vault(arkaContractId);

const deposit = await vault.deposit({
  user: walletAddress,
  asset: { contract: usdcContractId },
  amount: 25_0000000n,
});

console.log(deposit.hash);

const redemption = await vault.redeem({
  user: walletAddress,
  shares: 10_0000000n,
});

console.log(redemption.hash);
```

## Create an Arka

`createAndInitialize` is the supported factory path. Creation, initialization,
registration, default venue policy and risk-policy configuration occur through
the canonical factory flow.

```ts
import { ARKAFUND_MAINNET_CONTRACTS } from "@arkafund/sdk";

const factory = signedSdk.factory(ARKAFUND_MAINNET_CONTRACTS.arkaFactory);
const created = await factory.createAndInitialize({
  salt: crypto.getRandomValues(new Uint8Array(32)),
  manager: walletAddress,
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

Fee inputs mirror the on-chain basis-point interface. In a product UI, display
them with `formatBasisPoints`: `100` becomes `1.00%` and `1_500` becomes
`15.00%`.

## Execute a routed swap

The router executes a route selected by an application or quote engine. Every
hop requires an explicit minimum output; the SDK rejects empty routes and a
zero first-hop input before any network request.

```ts
const router = signedSdk.router(ARKAFUND_MAINNET_CONTRACTS.router);
const result = await router.execute({
  caller: walletAddress,
  steps: [
    {
      adapter: ARKAFUND_MAINNET_CONTRACTS.adapterPhoenix,
      poolId: 0,
      amountIn: 10_0000000n,
      minOut: 9_9000000n,
      assetOut: xlmContractId,
    },
  ],
});

console.log(result.hash);
```

## Venue safety controls

Venue status is public. Status changes require the configured governor or, for
emergency disabling, the authorized guardian. The SDK constructs the signed
transaction but cannot bypass those contract controls.

```ts
import { VenueStatus } from "@arkafund/sdk";

const registry = signedSdk.venueRegistry(ARKAFUND_MAINNET_CONTRACTS.venueRegistry);
const phoenix = ARKAFUND_MAINNET_CONTRACTS.adapterPhoenix;

console.log(await registry.configFor(phoenix));
console.log(await registry.isAutoAllowed(phoenix));

await registry.setStatus(governorAddress, phoenix, VenueStatus.ManualOnly);
```

## Error handling

Catalog requests reject with `CatalogApiError`, including the HTTP status, path
and decoded response body. Contract methods reject simulation failures before a
transaction is submitted; submitted methods return the transaction hash,
simulation result and Stellar send/get responses.

```ts
import { CatalogApiError } from "@arkafund/sdk";

try {
  await catalog.arka(unknownContractId);
} catch (error) {
  if (error instanceof CatalogApiError) {
    console.error(error.status, error.path, error.body);
  }
}
```

## Modules

- `catalog`: health, metrics, Arkas, assets, managers, activity and monitoring
- `registry(contractId)`: registration, curation, delisting and discovery reads
- `factory(contractId)`: creation, pagination, creation fee and default policies
- `vault(contractId)`: NAV, fees, whitelist, deposits, redemptions and credit status
- `router(contractId)`: signed route execution with mandatory minimum outputs
- `venueRegistry(contractId)`: venue configuration and governed status changes
- `oracleGuard(contractId)`: price-policy configuration and guarded price reads

## Validation

Maintainers validate the release with:

```bash
npm run test:unit
npm run test:consumer
npm run example:mainnet
```

`test:consumer` packs the SDK, installs the tarball into an empty npm project and
verifies that its public exports work without relying on repository-local files.
