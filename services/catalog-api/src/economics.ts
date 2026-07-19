import type {
  ArkaAssetExposure,
  ArkaCatalogEntry,
  CatalogAssetIdentity,
  CatalogAssetPrice,
  CatalogEconomicMetrics,
  CatalogFlowMetrics,
  CatalogOracleStatus,
  CatalogPeriodMetric,
  CatalogPortfolioWeight,
  CatalogValuationSource,
  FeeSummary,
} from "./types.js";
import { findMainnetAsset } from "./assets.js";

const DEFAULT_USD_STABLECOIN_CONTRACTS = new Set([
  "CCW67TSZV3SSS2HXMBQ5JFGCKJNXKZM7UQUWUZPUTHXSTZLEO7SJMI75",
  "CA2E53VHFZ6YSWQIEIPBXJQGT6VW3VKWWZO555XKRQXYJ63GEBJJGHY7",
]);

const EMPTY_PERIOD: CatalogPeriodMetric = { amount: null, bps: null };
const EMPTY_FLOWS: CatalogFlowMetrics = {
  depositVolume: null,
  redeemVolume: null,
  netUserFlow: null,
  activeUsers: null,
};

export interface CatalogValuationContext {
  assetPrices?: ReadonlyMap<string, CatalogAssetPrice>;
}

export function enrichArkaEconomics(
  entry: ArkaCatalogEntry,
  context: CatalogValuationContext = {},
): ArkaCatalogEntry {
  return {
    ...entry,
    economics: buildArkaEconomicMetrics(entry, context),
  };
}

export function buildArkaEconomicMetrics(
  entry: ArkaCatalogEntry,
  context: CatalogValuationContext = {},
): CatalogEconomicMetrics {
  const denominationAsset = resolveAssetIdentity(entry.denominationContract);
  const usdParity = Boolean(
    entry.denominationContract &&
      denominationAsset?.usdPegged &&
      isUsdStablecoinContract(entry.denominationContract),
  );
  const denominationPrice = entry.denominationContract
    ? context.assetPrices?.get(entry.denominationContract.trim().toUpperCase()) ?? null
    : null;
  const verifiedOraclePrice = denominationPrice?.oracleStatus === "verified"
    && denominationPrice.priceUsd !== null;
  const valuationSource: CatalogValuationSource = usdParity
    ? "usd_stablecoin_parity"
    : verifiedOraclePrice
      ? "oracle_verified"
      : "unavailable";
  const oracleStatus: CatalogOracleStatus = usdParity
    ? "not_required_usd_stablecoin"
    : denominationPrice?.oracleStatus ?? "missing_price";
  const navUsdEstimate = usdParity
    ? entry.nav
    : verifiedOraclePrice && denominationPrice
      ? multiplyByOraclePrice(entry.nav, denominationPrice.priceUsd!, denominationPrice.decimals)
      : null;
  const missingPriceReasons = navUsdEstimate !== null
    ? []
    : [missingPriceReason(entry.denominationContract, oracleStatus)];

  return {
    denominationAsset,
    denominationPrice,
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
  const known = findMainnetAsset(normalized);
  if (known) return { ...known };
  return {
    contract: normalized,
    symbol: null,
    label: null,
    decimals: 7,
    usdPegged: isUsdStablecoinContract(normalized),
  };
}

export function multiplyByOraclePrice(
  amountBase: string,
  price: string,
  oracleDecimals: number,
): string {
  if (!Number.isInteger(oracleDecimals) || oracleDecimals < 0 || oracleDecimals > 38) {
    throw new Error("oracleDecimals must be an integer between 0 and 38");
  }
  return ((BigInt(amountBase) * BigInt(price)) / (10n ** BigInt(oracleDecimals))).toString();
}

function missingPriceReason(
  denominationContract: string | null,
  status: CatalogOracleStatus,
): string {
  if (!denominationContract) return "denomination_asset_missing";
  if (status === "stale_price") return "denomination_price_stale";
  if (status === "invalid_price") return "denomination_price_invalid";
  return "denomination_price_unavailable";
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
