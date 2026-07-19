# Arkafund TypeScript SDK

Public TypeScript SDK for reading the Arka catalog and building wallet-signed
Stellar contract interactions. The package combines:

- a typed client for the public indexer and NAV API
- Stellar mainnet network and contract presets
- factory, vault, registry, router, venue-registry and oracle-guard modules
- a high-level workflow for creation, deposits, redemptions, routing and credit actions
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
const nav = await catalog.nav();
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
  totalNav: nav.totalNav,
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

Convert user-entered decimal amounts with the asset's declared decimals. This
keeps product interfaces human-readable while preserving exact on-chain values.

```ts
const workflow = signedSdk.workflow();
const deposit = await workflow.deposit({
  arkaId: arkaContractId,
  account: walletAddress,
  assetContract: usdcContractId,
  amount: "25.50",
});

console.log(deposit.hash);

const redemption = await workflow.redeem({
  arkaId: arkaContractId,
  account: walletAddress,
  shares: "10",
});

console.log(redemption.hash);
```

## Rebalance an Arka

Managers can ask Arka's routing service for the best admitted route and then build
the corresponding vault transaction. `AUTO` compares the supported venues; an
explicit protocol can be requested when the product needs direct execution.

```ts
const plan = await workflow.planRebalance({
  protocol: "AUTO",
  amount: "10",
  tokenIn: usdcContractId,
  tokenOut: xlmContractId,
  slippagePercent: 0.5,
  readerPubKey: walletAddress,
  vaultNav: "1000",
  dailyTurnoverUsed: "0",
  projectedAllocationShiftPercent: "1",
});

const result = await workflow.rebalance(arkaContractId, walletAddress, plan);

console.log(result.hash);
```

The route must also satisfy the Arka whitelist, allowed-venue configuration and
on-chain swap-risk policy. The SDK cannot bypass those controls.
The allocation-shift percentage must come from a common valuation basis such as
Catalog's verified USD prices; raw units from different assets are never compared.

## Blend credit actions

The vault module exposes explicit supply, withdraw, borrow and repay builders.
The manager signs the transaction and the Arka contract applies the configured
market and risk policy.

```ts
await vault.blendLend({
  manager: walletAddress,
  adapter: ARKAFUND_MAINNET_CONTRACTS.adapterBlendFixedXlmUsdc,
  marketId: 1,
  asset: usdcContractId,
  amount: parseAssetAmount("50", 7),
});

await vault.creditRepay({
  manager: walletAddress,
  protocol: { tag: "Blend", values: undefined },
  marketId: 1,
  asset: usdcContractId,
  amount: parseAssetAmount("5", 7),
});
```

Equivalent methods are available for `blendWithdraw`, `blendBorrow`,
`blendRepay`, `creditSupply`, `creditWithdraw` and `creditBorrow`. Every action
also has a `build...` variant for applications that manage submission separately.

The complete wallet integration example is compiled in CI and ships with the
package at `examples/wallet-integration.ts`.

## Public Arka and manager profiles

Profile updates are signed by the manager wallet. Build the canonical message,
ask the wallet to sign its UTF-8 bytes, then send the signed request to the
Catalog API.

```ts
const payload = {
  displayName: "Stellar Growth",
  description: "A diversified Stellar asset strategy.",
  nonce: crypto.randomUUID(),
  issuedAt: new Date().toISOString(),
};
const message = buildCatalogIdentityUpdateMessage({
  scope: "arka",
  target: arkaContractId,
  signer: walletAddress,
  payload,
});
const signature = await wallet.signMessage(Buffer.from(message, "utf8"));

await catalog.updateArkaIdentity(arkaContractId, {
  signer: walletAddress,
  message,
  signature,
  payload,
});
```

Wallet libraries return message signatures in different shapes. Pass the base64,
base64url or hexadecimal signature string accepted by the Catalog API.

## Create an Arka

The workflow reads the current creation fee, verifies the wallet balance, reuses
an adequate allowance or requests approval, and then calls the canonical factory.
Creation, registration, venue policy and risk policy remain enforced on-chain.

```ts
const created = await workflow.createArkaWithFeeApproval({
  denomination: usdcContractId,
  managementFeePercent: "1",
  performanceFeePercent: "15",
  depositFeePercent: "0",
  redemptionFeePercent: "0",
  whitelist: [usdcContractId, xlmContractId],
}, approvalExpirationLedger);

console.log(created.approval?.hash, created.creation.hash);
```

Product inputs use percentages. The SDK converts them exactly to the contract
representation and rejects values with more than two decimal places.

## Prices and NAV

`CatalogClient.nav()` returns the aggregate indexed NAV. `CatalogClient.prices()`
returns the OracleGuard state used for USD valuation. USDC uses declared USD
parity; other assets require a verified on-chain price. Stale, invalid, paused or
missing feeds return `priceUsd: null` with an explicit status. The SDK does not
substitute a guessed price.

```ts
const [nav, prices] = await Promise.all([
  workflow.catalog.nav(),
  workflow.catalog.prices(),
]);

for (const price of prices.items) {
  console.log(price.assetContract, price.priceUsd, price.oracleStatus);
}
```

The Catalog API is the canonical indexed data service. Its `/v1/nav` route is the
NAV aggregate. The DApp's `/api/nav` route is a cache-aware proxy of that same
response for browser clients; it is not a second indexer or valuation source.

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

- `catalog`: health, NAV, Arkas, assets, managers, profiles, activity and monitoring
- `registry(contractId)`: registration, curation, delisting and discovery reads
- `factory(contractId)`: creation, pagination, creation fee and default policies
- `vault(contractId)`: NAV, deposits, redemptions, rebalance and credit operations
- `router(contractId)`: signed route execution with mandatory minimum outputs
- `venueRegistry(contractId)`: venue configuration and governed status changes
- `oracleGuard(contractId)`: price-policy configuration and guarded price reads
- `workflow()`: human-readable creation, deposit, redemption, routing and credit actions

## Validation

Maintainers validate the release with:

```bash
npm run test:unit
npm run test:consumer
npm run example:mainnet
```

`test:consumer` packs the SDK, installs the tarball into an empty npm project and
verifies that its public exports work without relying on repository-local files.
