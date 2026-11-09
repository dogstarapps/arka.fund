import type {
  ActivityEntry,
  ActivityKind,
  CatalogAssetPrice,
  Page,
} from "@/lib/catalog/types";
import { isCatalogAssetPriceUsable } from "@/lib/catalog/valuation";

export type RebalanceGuardrailActivityStateSource =
  | "catalog_activity"
  | "unavailable";

export type RebalanceGuardrailActivityState = {
  source: RebalanceGuardrailActivityStateSource;
  dailyTurnoverUsedBase?: number;
  eventCount: number;
  includedEventCount: number;
  excludedEventCount: number;
  latestActivityAt: string | null;
  windowStartedAt: string;
  evaluatedAt: string;
  note: string;
};

export type RebalanceTurnoverValuationContext = {
  denominationAsset: string;
  pricesByAsset?: ReadonlyMap<string, CatalogAssetPrice | null>;
  assetDecimalsByContract?: ReadonlyMap<string, number>;
  denominationDecimals?: number;
};

const DAY_MS = 24 * 60 * 60 * 1000;

const TURNOVER_ACTIVITY_KINDS = new Set<ActivityKind>([
  "lend",
  "borrow",
  "repay",
  "withdraw",
]);

function scale10(exponent: number): bigint {
  if (!Number.isSafeInteger(exponent) || exponent < 0 || exponent > 30) {
    throw new Error("Unsupported valuation precision");
  }
  return BigInt(10) ** BigInt(exponent);
}

export function deriveProjectedAllocationShiftBps(input: {
  amountBase: number;
  vaultNavBase: number | undefined;
  assetIn: string;
  denominationAsset: string;
  assetInPrice?: CatalogAssetPrice | null;
  denominationPrice?: CatalogAssetPrice | null;
  assetInDecimals?: number;
  denominationDecimals?: number;
}): number | undefined {
  if (
    !Number.isSafeInteger(input.amountBase) ||
    input.amountBase <= 0 ||
    !Number.isSafeInteger(input.vaultNavBase) ||
    (input.vaultNavBase ?? 0) <= 0 ||
    !input.assetIn ||
    !input.denominationAsset
  ) {
    return undefined;
  }

  if (input.assetIn === input.denominationAsset) {
    return Math.ceil((input.amountBase * 10_000) / (input.vaultNavBase ?? 1));
  }
  if (!isCatalogAssetPriceUsable(input.assetInPrice) || !isCatalogAssetPriceUsable(input.denominationPrice)) {
    return undefined;
  }

  const assetDecimals = input.assetInDecimals ?? 7;
  const denominationDecimals = input.denominationDecimals ?? 7;
  const numerator =
    BigInt(input.amountBase) *
    BigInt(input.assetInPrice.priceUsd) *
    scale10(denominationDecimals + input.denominationPrice.decimals) *
    BigInt(10_000);
  const denominator =
    BigInt(input.vaultNavBase ?? 0) *
    BigInt(input.denominationPrice.priceUsd) *
    scale10(assetDecimals + input.assetInPrice.decimals);
  if (denominator <= BigInt(0)) return undefined;
  const bps = (numerator + denominator - BigInt(1)) / denominator;
  return bps > BigInt(Number.MAX_SAFE_INTEGER) ? Number.MAX_SAFE_INTEGER : Number(bps);
}

export function emptyRebalanceGuardrailActivityState(
  now: Date = new Date(),
): RebalanceGuardrailActivityState {
  return {
    source: "unavailable",
    dailyTurnoverUsedBase: undefined,
    eventCount: 0,
    includedEventCount: 0,
    excludedEventCount: 0,
    latestActivityAt: null,
    windowStartedAt: new Date(now.getTime() - DAY_MS).toISOString(),
    evaluatedAt: now.toISOString(),
    note: "Indexed activity was not available, so daily-turnover guardrail remains state-required.",
  };
}

function parseBaseAmount(value: string | null): number | null {
  const trimmed = value?.trim();
  if (!trimmed || !/^\d+$/.test(trimmed)) return null;
  const parsed = BigInt(trimmed);
  if (parsed > BigInt(Number.MAX_SAFE_INTEGER)) return null;
  return Number(parsed);
}

function resolveActivityAmountBase(entry: ActivityEntry): number {
  return Math.max(
    parseBaseAmount(entry.amount) ?? 0,
    parseBaseAmount(entry.netOut) ?? 0,
  );
}

function ceilDivide(numerator: bigint, denominator: bigint): bigint {
  return (numerator + denominator - BigInt(1)) / denominator;
}

function normalizeContract(contract: string): string {
  return contract.trim().toUpperCase();
}

function convertToDenominationBase(
  amountBase: number,
  assetContract: string | null,
  context: RebalanceTurnoverValuationContext,
): number | undefined {
  if (!Number.isSafeInteger(amountBase) || amountBase <= 0 || !assetContract) {
    return undefined;
  }
  const asset = normalizeContract(assetContract);
  const denomination = normalizeContract(context.denominationAsset);
  if (!asset || !denomination) return undefined;
  if (asset === denomination) return amountBase;

  const assetPrice = context.pricesByAsset?.get(asset);
  const denominationPrice = context.pricesByAsset?.get(denomination);
  if (!isCatalogAssetPriceUsable(assetPrice) || !isCatalogAssetPriceUsable(denominationPrice)) {
    return undefined;
  }

  const assetDecimals = context.assetDecimalsByContract?.get(asset) ?? 7;
  const denominationDecimals =
    context.assetDecimalsByContract?.get(denomination) ??
    context.denominationDecimals ??
    7;
  const numerator =
    BigInt(amountBase) *
    BigInt(assetPrice.priceUsd) *
    scale10(denominationDecimals + denominationPrice.decimals);
  const denominator =
    BigInt(denominationPrice.priceUsd) *
    scale10(assetDecimals + assetPrice.decimals);
  if (denominator <= BigInt(0)) return undefined;

  const normalized = ceilDivide(numerator, denominator);
  if (normalized > BigInt(Number.MAX_SAFE_INTEGER)) return undefined;
  return Number(normalized);
}

export function deriveRebalanceGuardrailActivityState(
  activity: Page<ActivityEntry>,
  valuation: RebalanceTurnoverValuationContext,
  now: Date = new Date(),
): RebalanceGuardrailActivityState {
  const windowStartedAt = new Date(now.getTime() - DAY_MS);
  const evaluatedAtMs = now.getTime();
  const included = activity.items.filter((entry) => {
    if (!entry.inSuccessfulContractCall) return false;
    if (!TURNOVER_ACTIVITY_KINDS.has(entry.kind)) return false;
    if (resolveActivityAmountBase(entry) <= 0) return false;
    const closedAt = Date.parse(entry.ledgerClosedAt);
    return (
      Number.isFinite(closedAt) &&
      closedAt >= windowStartedAt.getTime() &&
      closedAt <= evaluatedAtMs
    );
  });
  const normalizedAmounts = included.map((entry) =>
    convertToDenominationBase(
      resolveActivityAmountBase(entry),
      entry.assetContract,
      valuation,
    ),
  );
  const valuationAvailable = normalizedAmounts.every(
    (amount): amount is number => amount !== undefined,
  );
  const normalizedTotal = valuationAvailable
    ? normalizedAmounts.reduce((total, amount) => total + amount, 0)
    : undefined;
  const dailyTurnoverUsedBase =
    normalizedTotal !== undefined && Number.isSafeInteger(normalizedTotal)
      ? normalizedTotal
      : undefined;
  const latestActivityAt =
    activity.items
      .map((entry) => entry.ledgerClosedAt)
      .filter((value) => Number.isFinite(Date.parse(value)))
      .sort((left, right) => Date.parse(right) - Date.parse(left))[0] ?? null;

  return {
    source: "catalog_activity",
    dailyTurnoverUsedBase,
    eventCount: activity.items.length,
    includedEventCount: included.length,
    excludedEventCount: activity.items.length - included.length,
    latestActivityAt,
    windowStartedAt: windowStartedAt.toISOString(),
    evaluatedAt: now.toISOString(),
    note:
      included.length > 0 && dailyTurnoverUsedBase === undefined
        ? "Indexed turnover cannot be valued in the Arka denomination with the available verified prices."
        : included.length > 0
          ? `${included.length} indexed manager/protocol events valued in the Arka denomination for the rolling 24h turnover guardrail.`
        : "Catalog activity loaded; no successful manager/protocol turnover events were indexed inside the rolling 24h window.",
  };
}
