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
  const denominationPrice = entry.denominationContract
    ? context.assetPrices?.get(entry.denominationContract.trim().toUpperCase()) ?? null
    : null;
  const assetValues = entry.assets.map((asset) =>
    valueAssetContribution(asset, entry.denominationContract, context),
  );
  const hasRecordedAssets = entry.assets.length > 0;
  const hasUnpricedContribution = assetValues.some((value) => value.usdValue === null);
  const denominationFallback = hasRecordedAssets
    ? null
    : valueAmountInUsd(entry.nav ?? "0", entry.denominationContract, context);
  const navUsdEstimate = entry.nav === null ? null : hasRecordedAssets
    ? hasUnpricedContribution
      ? null
      : assetValues.reduce((total, value) => total + BigInt(value.usdValue ?? "0"), 0n).toString()
    : denominationFallback?.usdValue ?? null;
  const missingPriceReasons = entry.nav === null
    ? [entry.navUnavailableReason ?? "nav_unavailable"]
    : hasRecordedAssets
    ? [
          ...new Set([
            ...assetValues.flatMap((value) => value.missingReason ? [value.missingReason] : []),
          ]),
      ]
    : denominationFallback?.missingReason
      ? [denominationFallback.missingReason]
      : [];
  const pricedValues = hasRecordedAssets ? assetValues : [denominationFallback].filter(Boolean);
  const valuationSource = navUsdEstimate === null
    ? "unavailable"
    : pricedValues.some((value) => value?.valuationSource === "oracle_verified")
      ? "oracle_verified"
      : "usd_stablecoin_parity";
  const oracleStatus = navUsdEstimate === null
    ? firstUnavailableOracleStatus(pricedValues)
    : valuationSource === "oracle_verified"
      ? "verified"
      : "not_required_usd_stablecoin";

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
    portfolioWeights: buildPortfolioWeights(assetValues, navUsdEstimate),
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

interface AssetContributionValue {
  assetContract: string;
  contribution: string;
  usdValue: string | null;
  oracleStatus: CatalogOracleStatus;
  valuationSource: CatalogValuationSource;
  missingReason: string | null;
}

function buildPortfolioWeights(
  values: AssetContributionValue[],
  navUsdEstimate: string | null,
): CatalogPortfolioWeight[] {
  const totalUsd = navUsdEstimate === null ? 0n : BigInt(navUsdEstimate);
  const totalRaw = values.reduce((total, value) => total + BigInt(value.contribution), 0n);
  return values.map((value) => {
    const weightBps = totalUsd > 0n && value.usdValue !== null
      ? Number((BigInt(value.usdValue) * 10_000n) / totalUsd)
      : totalRaw > 0n
        ? Number((BigInt(value.contribution) * 10_000n) / totalRaw)
        : 0;
    return {
      assetContract: value.assetContract,
      weightBps,
      valueDenomination: value.contribution,
      valueUsdEstimate: value.usdValue,
    };
  });
}

function valueAssetContribution(
  asset: ArkaAssetExposure,
  denominationContract: string | null,
  context: CatalogValuationContext,
): AssetContributionValue {
  const availableLiquid = managedLiquid(asset);
  const liquidUsd = valueAmountInUsd(availableLiquid, asset.assetContract, context);
  // Credit adapters report netPositionValue in the Arka denomination, while
  // liquidBalance remains in the asset's own units. Value them separately.
  const positionUsd = valueAmountInUsd(
    asset.netPositionValue,
    denominationContract,
    context,
  );
  const liquidDenomination = valueAmountInDenomination(
    availableLiquid,
    asset.assetContract,
    denominationContract,
    context,
  );
  const usdValue = liquidUsd.usdValue === null || positionUsd.usdValue === null
    ? null
    : (BigInt(liquidUsd.usdValue) + BigInt(positionUsd.usdValue)).toString();
  const missingReason = liquidUsd.missingReason ?? positionUsd.missingReason;
  const valuationSource = liquidUsd.valuationSource === "oracle_verified"
    || positionUsd.valuationSource === "oracle_verified"
    ? "oracle_verified"
    : liquidUsd.valuationSource === "unavailable" || positionUsd.valuationSource === "unavailable"
      ? "unavailable"
      : "usd_stablecoin_parity";
  const oracleStatus = usdValue === null
    ? firstUnavailableOracleStatus([liquidUsd, positionUsd])
    : valuationSource === "oracle_verified"
      ? "verified"
      : "not_required_usd_stablecoin";
  return {
    assetContract: asset.assetContract,
    contribution: (
      BigInt(liquidDenomination ?? "0") + BigInt(asset.netPositionValue)
    ).toString(),
    usdValue,
    oracleStatus,
    valuationSource,
    missingReason,
  };
}

function valueAmountInDenomination(
  amount: string,
  assetContract: string,
  denominationContract: string | null,
  context: CatalogValuationContext,
): string | null {
  if (BigInt(amount) === 0n) return "0";
  if (!denominationContract) return null;
  if (assetContract.trim().toUpperCase() === denominationContract.trim().toUpperCase()) {
    return amount;
  }
  const usd = valueAmountInUsd(amount, assetContract, context).usdValue;
  if (usd === null) return null;
  if (isUsdStablecoinContract(denominationContract)) return usd;
  const price = context.assetPrices?.get(denominationContract.trim().toUpperCase()) ?? null;
  if (price?.oracleStatus !== "verified" || price.priceUsd === null || BigInt(price.priceUsd) <= 0n) {
    return null;
  }
  return (
    (BigInt(usd) * (10n ** BigInt(price.decimals))) / BigInt(price.priceUsd)
  ).toString();
}

function valueAmountInUsd(
  amount: string,
  assetContract: string | null,
  context: CatalogValuationContext,
): Omit<AssetContributionValue, "assetContract" | "contribution"> {
  if (BigInt(amount) === 0n) {
    return {
      usdValue: "0",
      oracleStatus: "not_required_usd_stablecoin",
      valuationSource: "usd_stablecoin_parity",
      missingReason: null,
    };
  }
  if (!assetContract) {
    return {
      usdValue: null,
      oracleStatus: "missing_price",
      valuationSource: "unavailable",
      missingReason: "asset_contract_missing",
    };
  }
  const identity = resolveAssetIdentity(assetContract);
  if (identity?.usdPegged && isUsdStablecoinContract(assetContract)) {
    return {
      usdValue: amount,
      oracleStatus: "not_required_usd_stablecoin",
      valuationSource: "usd_stablecoin_parity",
      missingReason: null,
    };
  }
  const price = context.assetPrices?.get(assetContract.trim().toUpperCase()) ?? null;
  if (price?.oracleStatus === "verified" && price.priceUsd !== null) {
    return {
      usdValue: multiplyByOraclePrice(amount, price.priceUsd, price.decimals),
      oracleStatus: "verified",
      valuationSource: "oracle_verified",
      missingReason: null,
    };
  }
  const status = price?.oracleStatus ?? "missing_price";
  return {
    usdValue: null,
    oracleStatus: status,
    valuationSource: "unavailable",
    missingReason: `asset_price_${status}`,
  };
}

function firstUnavailableOracleStatus(
  values: Array<Pick<AssetContributionValue, "oracleStatus"> | null | undefined>,
): CatalogOracleStatus {
  const statuses = values.map((value) => value?.oracleStatus).filter(Boolean) as CatalogOracleStatus[];
  const priority: CatalogOracleStatus[] = ["policy_paused", "stale_price", "invalid_price", "missing_price"];
  return priority.find((status) => statuses.includes(status)) ?? "missing_price";
}

function cloneFees(fees: FeeSummary): FeeSummary {
  return { ...fees };
}
import { managedLiquid } from "./managedAssets.js";
