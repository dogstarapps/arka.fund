import type {
  ArkaAssetExposure,
  ArkaCatalogEntry,
  CatalogAssetIdentity,
  CatalogEconomicMetrics,
  CatalogFlowMetrics,
  CatalogOracleStatus,
  CatalogPeriodMetric,
  CatalogPortfolioWeight,
  CatalogValuationSource,
  FeeSummary,
} from "./types.js";

const DEFAULT_USD_STABLECOIN_CONTRACTS = new Set([
  "CCW67TSZV3SSS2HXMBQ5JFGCKJNXKZM7UQUWUZPUTHXSTZLEO7SJMI75",
  "CA2E53VHFZ6YSWQIEIPBXJQGT6VW3VKWWZO555XKRQXYJ63GEBJJGHY7",
]);

const KNOWN_ASSETS = new Map<string, CatalogAssetIdentity>([
  [
    "CCW67TSZV3SSS2HXMBQ5JFGCKJNXKZM7UQUWUZPUTHXSTZLEO7SJMI75",
    {
      contract: "CCW67TSZV3SSS2HXMBQ5JFGCKJNXKZM7UQUWUZPUTHXSTZLEO7SJMI75",
      symbol: "USDC",
      label: "USD Coin",
      decimals: 7,
      usdPegged: true,
    },
  ],
  [
    "CA2E53VHFZ6YSWQIEIPBXJQGT6VW3VKWWZO555XKRQXYJ63GEBJJGHY7",
    {
      contract: "CA2E53VHFZ6YSWQIEIPBXJQGT6VW3VKWWZO555XKRQXYJ63GEBJJGHY7",
      symbol: "USDC",
      label: "USD Coin",
      decimals: 7,
      usdPegged: true,
    },
  ],
]);

const EMPTY_PERIOD: CatalogPeriodMetric = { amount: null, bps: null };
const EMPTY_FLOWS: CatalogFlowMetrics = {
  depositVolume: null,
  redeemVolume: null,
  netUserFlow: null,
  activeUsers: null,
};

export function enrichArkaEconomics(entry: ArkaCatalogEntry): ArkaCatalogEntry {
  return {
    ...entry,
    economics: buildArkaEconomicMetrics(entry),
  };
}

export function buildArkaEconomicMetrics(entry: ArkaCatalogEntry): CatalogEconomicMetrics {
  const denominationAsset = resolveAssetIdentity(entry.denominationContract);
  const usdValued = Boolean(
    entry.denominationContract &&
      denominationAsset?.usdPegged &&
      isUsdStablecoinContract(entry.denominationContract),
  );
  const valuationSource: CatalogValuationSource = usdValued
    ? "usd_stablecoin_parity"
    : "unavailable";
  const oracleStatus: CatalogOracleStatus = usdValued
    ? "not_required_usd_stablecoin"
    : "missing_price";
  const navUsdEstimate = usdValued ? entry.nav : null;
  const missingPriceReasons = navUsdEstimate
    ? []
    : [
        entry.denominationContract
          ? "denomination_price_unavailable"
          : "denomination_asset_missing",
      ];

  return {
    denominationAsset,
    navDenomination: entry.nav,
    navUsdEstimate,
    sharePrice: null,
    returns: {
      "1d": EMPTY_PERIOD,
      "7d": EMPTY_PERIOD,
      "30d": EMPTY_PERIOD,
      "1y": EMPTY_PERIOD,
      all: EMPTY_PERIOD,
    },
    pnl: EMPTY_PERIOD,
    volume: EMPTY_PERIOD,
    flows: EMPTY_FLOWS,
    fees: cloneFees(entry.fees),
    portfolioWeights: buildPortfolioWeights(entry.assets, entry.nav, navUsdEstimate),
    oracleStatus,
    valuationSource,
    missingPriceReasons,
  };
}

export function resolveAssetIdentity(contract: string | null): CatalogAssetIdentity | null {
  if (!contract) return null;
  const normalized = contract.trim().toUpperCase();
  const known = KNOWN_ASSETS.get(normalized);
  if (known) return { ...known };
  return {
    contract: normalized,
    symbol: null,
    label: null,
    decimals: 7,
    usdPegged: isUsdStablecoinContract(normalized),
  };
}

export function isUsdStablecoinContract(contract: string): boolean {
  const normalized = contract.trim().toUpperCase();
  if (DEFAULT_USD_STABLECOIN_CONTRACTS.has(normalized)) return true;
  return readConfiguredUsdStablecoinContracts().has(normalized);
}

function readConfiguredUsdStablecoinContracts(): Set<string> {
  const configured = process.env.CATALOG_USD_STABLECOIN_CONTRACTS ?? "";
  return new Set(
    configured
      .split(",")
      .map((item) => item.trim().toUpperCase())
      .filter(Boolean),
  );
}

function buildPortfolioWeights(
  assets: ArkaAssetExposure[],
  nav: string,
  navUsdEstimate: string | null,
): CatalogPortfolioWeight[] {
  const total = BigInt(nav || "0");
  return assets.map((asset) => {
    const valueDenomination = navContribution(asset);
    const weightBps = total > 0n
      ? Number((BigInt(valueDenomination) * 10_000n) / total)
      : 0;
    const valueUsdEstimate =
      navUsdEstimate && total > 0n
        ? ((BigInt(navUsdEstimate) * BigInt(valueDenomination)) / total).toString()
        : null;
    return {
      assetContract: asset.assetContract,
      weightBps,
      valueDenomination,
      valueUsdEstimate,
    };
  });
}

function navContribution(asset: ArkaAssetExposure): string {
  return (BigInt(asset.liquidBalance) + BigInt(asset.netPositionValue)).toString();
}

function cloneFees(fees: FeeSummary): FeeSummary {
  return { ...fees };
}
