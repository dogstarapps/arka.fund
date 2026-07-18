import {
  ARKAFUND_MAINNET_CONTRACTS,
  ArkafundSdk,
  CatalogClient,
  createMainnetConfig,
  formatAssetAmount,
  formatBasisPoints,
} from "@arkafund/sdk";

const catalog = new CatalogClient();
const sdk = new ArkafundSdk(createMainnetConfig());

const [health, metrics, curated] = await Promise.all([
  catalog.health(),
  catalog.metrics(),
  catalog.arkas({ curated: true, delisted: false, limit: 10 }),
]);

if (!health.healthy || metrics.failedArkas !== 0 || curated.items.length < 5) {
  throw new Error("Mainnet catalog did not satisfy the expected health and curation checks");
}

const selected = curated.items[0];
const vault = sdk.vault(selected.arkaId);
const factory = sdk.factory(ARKAFUND_MAINNET_CONTRACTS.arkaFactory);
const [manager, onChainNav, fees, whitelist, creationFee] = await Promise.all([
  vault.manager(),
  vault.nav(),
  vault.fees(),
  vault.whitelist(),
  factory.creationFee(),
]);

console.log(JSON.stringify({
  network: "Stellar mainnet",
  catalog: {
    healthy: health.healthy,
    indexedArkas: metrics.indexedArkas,
    curatedArkas: curated.total,
    syncedAt: metrics.syncedAt,
  },
  selectedArka: {
    contractId: selected.arkaId,
    managerMatchesCatalog: manager === selected.manager,
    indexedNav: selected.nav,
    onChainNav: onChainNav.toString(),
    navDisplayAtSevenDecimals: formatAssetAmount(onChainNav, 7),
    managementFee: formatBasisPoints(Number(fees.mgmt_bps)),
    performanceFee: formatBasisPoints(Number(fees.perf_bps)),
    whitelistedAssetCount: whitelist.length,
  },
  creationFee: {
    token: creationFee.token,
    amount: creationFee.amount.toString(),
  },
}, null, 2));
