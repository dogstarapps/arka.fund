import type {
  ActivityEntry,
  ArkaDetailBundle,
  ArkaIdentityMetadata,
  ArkaPortfolio,
  Page,
  RankedArkaCatalogEntry,
  VaultResolvedMetrics,
  VaultResolvedMetricSource,
} from "./types";
import {
  formatBaseUnitAmount,
  formatContractLabel,
  formatRelativeTime,
  formatUsdBaseUnitAmount,
} from "./format";
import { resolveAssetDisplayLabel } from "./assetPresentation";

export interface VaultLeaderboardSummary {
  totalNav: string;
  totalNavUsdEstimate: string | null;
  missingUsdValuationCount: number;
  managerCount: number;
  curatedCount: number;
  delistedCount: number;
  averageAssetCount: number;
}

export interface VaultPublicMetricTile {
  id:
    | "managed"
    | "arkas"
    | "coverage"
    | "managers"
    | "profit"
    | "volume"
    | "leaderShare"
    | "assetSpan";
  label: string;
  value: string;
  valueKind: "amount" | "integer" | "percent" | "text";
  detail: string;
  tone: "default" | "positive" | "warning";
}

export type VaultLeaderboardWindow = "latest" | "7d" | "30d" | "all";

export interface VaultLeaderboardWindowOption {
  id: VaultLeaderboardWindow;
  label: string;
  detail: string;
}

export const VAULT_LEADERBOARD_WINDOW_OPTIONS: VaultLeaderboardWindowOption[] = [
  {
    id: "latest",
    label: "Current",
    detail: "Only entries from the latest update day.",
  },
  {
    id: "7d",
    label: "7D",
    detail: "Entries updated within the last seven days.",
  },
  {
    id: "30d",
    label: "30D",
    detail: "Entries updated within the last thirty days.",
  },
  {
    id: "all",
    label: "All",
    detail: "Every available entry.",
  },
];

export interface VaultLeaderboardCardModel {
  arkaId: string;
  rank: number;
  manager: string;
  nav: string | null;
  curated: boolean;
  delisted: boolean;
  denominationContract: string | null;
  assetCount: number;
  whitelistCount: number;
  primaryAssetContract: string | null;
  syncedAt: string;
  navSharePct: number;
  identity?: ArkaIdentityMetadata | null;
}

export type VaultFeaturedInsightMode = "ranked" | "profit" | "volume";

export type VaultFeaturedInsightMetricSource =
  | "catalog_rank"
  | VaultResolvedMetricSource;

export interface VaultFeaturedInsightMetric {
  id: VaultFeaturedInsightMode;
  label: string;
  value: number | null;
  source: VaultFeaturedInsightMetricSource;
  detail: string;
}

export interface VaultFeaturedInsightModel {
  arkaId: string;
  rank: number;
  manager: string;
  nav: string | null;
  navDisplay: string;
  navCaption: string;
  curated: boolean;
  delisted: boolean;
  assetCount: number;
  whitelistCount: number;
  primaryAssetContract: string | null;
  denominationLabel: string;
  syncedAt: string;
  navSharePct: number;
  metric: VaultFeaturedInsightMetric;
  profileHref: string;
  opsHref: string;
  identity?: ArkaIdentityMetadata | null;
}

export interface VaultLeaderboardRowModel {
  arkaId: string;
  rank: number;
  manager: string;
  nav: string | null;
  navDisplay: string;
  navCaption: string;
  assetCount: number;
  whitelistCount: number;
  feesLabel: string;
  postureLabel: "Curated" | "Listed" | "Delisted";
  postureTone: "positive" | "neutral" | "warning";
  baseContract: string | null;
  baseLabel: string;
  baseDetail: string;
  syncedAt: string;
  identity?: ArkaIdentityMetadata | null;
}

export interface VaultPortfolioHighlight {
  assetContract: string;
  weightBps: number;
  navContribution: string;
  marketCount: number;
  isDenomination: boolean;
}

export interface VaultProfileSignal {
  id: "curation" | "manager" | "denomination" | "shareToken";
  label: string;
  value: string;
  detail: string;
  tone: "default" | "positive" | "warning";
}

export interface VaultActivityHighlight {
  id: "events" | "actors" | "latest";
  label: string;
  value: string;
  detail: string;
  tone: "default" | "positive" | "warning";
}

export interface VaultDetailPublicMetricTile {
  id:
    | "nav"
    | "trend"
    | "fees"
    | "portfolio"
    | "activity"
    | "whitelist";
  label: string;
  value: string;
  valueKind: "amount" | "percent" | "integer" | "text";
  detail: string;
  tone: "default" | "positive" | "warning";
}

export interface VaultDetailCommand {
  id: "profile" | "manager" | "execution" | "source";
  label: string;
  value: string;
  detail: string;
  tone: "default" | "positive" | "warning";
  href: string | null;
  ctaLabel: string;
}

export function filterVaultLeaderboardPageByWindow(
  page: Page<RankedArkaCatalogEntry>,
  windowId: VaultLeaderboardWindow,
): Page<RankedArkaCatalogEntry> {
  if (windowId === "all" || page.items.length === 0) {
    return page;
  }

  const newestTimestamp = page.items.reduce((newest, entry) => {
    const timestamp = Date.parse(entry.syncedAt);
    return Number.isFinite(timestamp) ? Math.max(newest, timestamp) : newest;
  }, Number.NEGATIVE_INFINITY);

  if (!Number.isFinite(newestTimestamp)) {
    return { ...page, total: 0, offset: 0, limit: 0, items: [] };
  }

  const newestDate = new Date(newestTimestamp);
  const cutoff = resolveVaultLeaderboardWindowCutoff(newestTimestamp, windowId);
  const filteredItems = page.items.filter((entry) => {
    const timestamp = Date.parse(entry.syncedAt);
    if (!Number.isFinite(timestamp)) return false;

    if (windowId === "latest") {
      const date = new Date(timestamp);
      return (
        date.getUTCFullYear() === newestDate.getUTCFullYear() &&
        date.getUTCMonth() === newestDate.getUTCMonth() &&
        date.getUTCDate() === newestDate.getUTCDate()
      );
    }

    return timestamp >= cutoff && timestamp <= newestTimestamp;
  });

  return {
    ...page,
    total: filteredItems.length,
    offset: 0,
    limit: Math.min(page.limit, filteredItems.length),
    items: filteredItems,
  };
}

function resolveVaultLeaderboardWindowCutoff(
  newestTimestamp: number,
  windowId: VaultLeaderboardWindow,
): number {
  const dayMs = 24 * 60 * 60 * 1000;
  if (windowId === "7d") return newestTimestamp - 7 * dayMs;
  if (windowId === "30d") return newestTimestamp - 30 * dayMs;
  return newestTimestamp;
}

export function buildVaultLeaderboardSummary(
  page: Page<RankedArkaCatalogEntry>,
): VaultLeaderboardSummary {
  const totalNav = page.items
    .reduce((accumulator, entry) => accumulator + BigInt(entry.nav ?? "0"), BigInt(0))
    .toString();
  const usdEstimates = page.items.map((entry) => entry.economics?.navUsdEstimate);
  const allUsdValued =
    page.items.length > 0 &&
    usdEstimates.every((value) => value !== null && value !== undefined);
  const totalNavUsdEstimate = allUsdValued
    ? usdEstimates
        .reduce((accumulator, value) => accumulator + BigInt(value ?? "0"), BigInt(0))
        .toString()
    : null;
  const missingUsdValuationCount = page.items.filter(
    (entry) => entry.nav === null || (!entry.economics?.navUsdEstimate && BigInt(entry.nav || "0") > BigInt(0)),
  ).length;
  const managerCount = new Set(page.items.map((entry) => entry.manager)).size;
  const curatedCount = page.items.filter((entry) => entry.curated).length;
  const delistedCount = page.items.filter((entry) => entry.delisted).length;
  const averageAssetCount =
    page.items.length === 0
      ? 0
      : Number(
          (
            page.items.reduce((accumulator, entry) => accumulator + entry.assets.length, 0) /
            page.items.length
          ).toFixed(1),
        );

  return {
    totalNav,
    totalNavUsdEstimate,
    missingUsdValuationCount,
    managerCount,
    curatedCount,
    delistedCount,
    averageAssetCount,
  };
}

function sumResolvedLeaderboardMetric(
  entries: RankedArkaCatalogEntry[],
  metrics: Record<string, VaultResolvedMetrics>,
  metric: "profit" | "volume",
): number {
  return entries.reduce((accumulator, entry) => {
    const value = metrics[entry.arkaId]?.[metric].value;
    return accumulator + (value ?? 0);
  }, 0);
}

function formatVaultSharePercent(value: string | null, total: string): string {
  if (value === null) return "n/a";
  const totalValue = BigInt(total);
  if (totalValue <= BigInt(0)) return "0.00%";
  const basisPoints = Number((BigInt(value) * BigInt(10_000)) / totalValue);
  return `${(basisPoints / 100).toFixed(2)}%`;
}

function formatNavAmount(entry: RankedArkaCatalogEntry): string {
  if (entry.nav === null) return "Valuation unavailable";
  const usdEstimate = entry.economics?.navUsdEstimate;
  if (usdEstimate !== null && usdEstimate !== undefined) {
    return formatUsdBaseUnitAmount(usdEstimate);
  }
  const denomination = entry.economics?.denominationAsset;
  if (!denomination?.symbol) {
    return "Valuation unavailable";
  }
  return `${formatBaseUnitAmount(entry.nav, denomination.decimals, 2)} ${denomination.symbol}`;
}

export function buildVaultPublicMetricDeck(
  page: Page<RankedArkaCatalogEntry>,
  metrics: Record<string, VaultResolvedMetrics>,
  options: { windowLabel: string },
): VaultPublicMetricTile[] {
  const summary = buildVaultLeaderboardSummary(page);
  const leader = page.items[0] ?? null;
  const profit = sumResolvedLeaderboardMetric(page.items, metrics, "profit");
  const volume = sumResolvedLeaderboardMetric(page.items, metrics, "volume");
  const windowLabel = options.windowLabel.trim() || "selected";

  return [
    {
      id: "managed",
      label: "TVL",
      value: summary.totalNavUsdEstimate ?? "Valuation unavailable",
      valueKind: summary.totalNavUsdEstimate ? "amount" : "text",
      detail: summary.totalNavUsdEstimate
        ? `USD value in the ${windowLabel} window.`
        : summary.missingUsdValuationCount === 1
          ? "1 Arka needs USD pricing before TVL can be shown."
          : `${summary.missingUsdValuationCount} Arkas need USD pricing before TVL can be shown.`,
      tone: summary.totalNavUsdEstimate ? "positive" : "warning",
    },
    {
      id: "arkas",
      label: "Arkas",
      value: String(page.total),
      valueKind: "integer",
      detail: `${page.items.length} Arkas visible in the current ranking.`,
      tone: "default",
    },
    {
      id: "coverage",
      label: "Curated coverage",
      value: `${summary.curatedCount}/${page.total}`,
      valueKind: "text",
      detail:
        summary.delistedCount > 0
          ? `${summary.delistedCount} delisted Arkas remain visible in this window.`
          : "No delisted Arkas in the selected results.",
      tone: summary.delistedCount > 0 ? "warning" : "positive",
    },
    {
      id: "managers",
      label: "Managers",
      value: String(summary.managerCount),
      valueKind: "integer",
      detail: "Distinct manager accounts represented by visible Arkas.",
      tone: "default",
    },
    {
      id: "profit",
      label: "Estimated profit",
      value: String(profit),
      valueKind: "amount",
      detail: "Estimated profit across visible Arkas.",
      tone: profit >= 0 ? "positive" : "warning",
    },
    {
      id: "volume",
      label: "Trading volume",
      value: String(volume),
      valueKind: "amount",
      detail: "Volume used by ranking and public discovery views.",
      tone: "default",
    },
    {
      id: "leaderShare",
      label: "Lead share",
      value: leader
        ? formatVaultSharePercent(leader.nav, summary.totalNav)
        : "0.00%",
      valueKind: "percent",
      detail: leader
        ? `#${leader.rank} leads current TVL.`
        : "No leader share can be computed without Arkas.",
      tone: leader ? "positive" : "warning",
    },
    {
      id: "assetSpan",
      label: "Average asset span",
      value: summary.averageAssetCount.toFixed(1),
      valueKind: "text",
      detail: "Mean number of tracked assets per Arka in this window.",
      tone: "default",
    },
  ];
}

export function buildVaultLeaderboardCards(
  page: Page<RankedArkaCatalogEntry>,
  limit = page.items.length,
): VaultLeaderboardCardModel[] {
  const totalNav = page.items.reduce(
    (accumulator, entry) => accumulator + BigInt(entry.nav ?? "0"),
    BigInt(0),
  );

  return page.items.slice(0, limit).map((entry) => ({
    arkaId: entry.arkaId,
    rank: entry.rank,
    manager: entry.manager,
    nav: entry.nav,
    curated: entry.curated,
    delisted: entry.delisted,
    denominationContract: entry.denominationContract,
    assetCount: entry.assets.length,
    whitelistCount: entry.whitelistContracts.length,
    primaryAssetContract: entry.assets[0]?.assetContract ?? null,
    syncedAt: entry.syncedAt,
    identity: entry.identity ?? null,
      navSharePct:
        totalNav > BigInt(0)
        ? Number((Number((BigInt(entry.nav ?? "0") * BigInt(10_000)) / totalNav) / 100).toFixed(2))
        : 0,
  }));
}

function resolveVaultFeaturedMetric(
  entry: RankedArkaCatalogEntry,
  metrics: Record<string, VaultResolvedMetrics>,
  mode: VaultFeaturedInsightMode,
): VaultFeaturedInsightMetric {
  if (mode === "ranked") {
    return {
      id: "ranked",
      label: "Rank",
      value: entry.rank,
      source: "catalog_rank",
      detail: "Ranking position in the selected window.",
    };
  }

  const metric = metrics[entry.arkaId]?.[mode];
  const metricName = mode === "profit" ? "Profit" : "Volume";
  if (!metric || metric.value === null) {
    return {
      id: mode,
      label: metricName,
      value: null,
      source: metric?.source ?? "unavailable",
      detail:
        mode === "profit"
          ? "No profit value is available for this Arka yet."
          : "No volume value is available for this Arka yet.",
    };
  }

  return {
    id: mode,
    label: metricName,
    value: metric.value,
    source: metric.source,
      detail:
      metric.source === "catalog"
        ? `${metricName} supplied by current market data.`
        : `${metricName} estimated from recent activity.`,
  };
}

function compareMetricDesc(
  left: RankedArkaCatalogEntry,
  right: RankedArkaCatalogEntry,
  metrics: Record<string, VaultResolvedMetrics>,
  mode: Exclude<VaultFeaturedInsightMode, "ranked">,
): number {
  const leftValue = metrics[left.arkaId]?.[mode].value ?? Number.NEGATIVE_INFINITY;
  const rightValue = metrics[right.arkaId]?.[mode].value ?? Number.NEGATIVE_INFINITY;

  if (rightValue !== leftValue) {
    return rightValue - leftValue;
  }

  return left.rank - right.rank;
}

export function buildVaultFeaturedInsights(
  page: Page<RankedArkaCatalogEntry>,
  metrics: Record<string, VaultResolvedMetrics>,
  mode: VaultFeaturedInsightMode,
  limit = 3,
): VaultFeaturedInsightModel[] {
  const totalNav = page.items.reduce(
    (accumulator, entry) => accumulator + BigInt(entry.nav ?? "0"),
    BigInt(0),
  );
  const rankedItems = [...page.items].sort((left, right) => {
    if (mode === "profit" || mode === "volume") {
      return compareMetricDesc(left, right, metrics, mode);
    }

    return left.rank - right.rank;
  });

  return rankedItems.slice(0, limit).map((entry) => {
    const routes = buildVaultRouteSet(entry.arkaId);
    const navSharePct =
      totalNav > BigInt(0)
        ? Number((Number((BigInt(entry.nav ?? "0") * BigInt(10_000)) / totalNav) / 100).toFixed(2))
        : 0;

    return {
      arkaId: entry.arkaId,
      rank: entry.rank,
      manager: entry.manager,
      nav: entry.nav,
      navDisplay: formatNavAmount(entry),
      navCaption: entry.economics?.navUsdEstimate ? "USD TVL" : "TVL",
      curated: entry.curated,
      delisted: entry.delisted,
      assetCount: entry.assets.length,
      whitelistCount: entry.whitelistContracts.length,
      primaryAssetContract: entry.assets[0]?.assetContract ?? null,
      denominationLabel:
        entry.economics?.denominationAsset?.symbol ??
        resolveAssetDisplayLabel(entry.denominationContract),
      syncedAt: entry.syncedAt,
      navSharePct,
      metric: resolveVaultFeaturedMetric(entry, metrics, mode),
      profileHref: routes.profileHref,
      opsHref: routes.opsHref,
      identity: entry.identity ?? null,
    };
  });
}

function buildVaultFeesLabel(entry: RankedArkaCatalogEntry): string {
  return `Management ${(entry.fees.mgmtBps / 100).toFixed(2)}% · Performance ${(entry.fees.perfBps / 100).toFixed(2)}%`;
}

function buildVaultBaseDetail(entry: RankedArkaCatalogEntry): string {
  if (!entry.denominationContract) {
    return "no denomination declared";
  }

  const denominationExposure = entry.assets.find(
    (asset) => asset.assetContract === entry.denominationContract,
  );
  if (!denominationExposure) {
    return "declared denomination";
  }

  return denominationExposure.isDenomination ? "active denomination" : "declared denomination";
}

export function buildVaultLeaderboardRows(
  page: Page<RankedArkaCatalogEntry>,
  limit = page.items.length,
): VaultLeaderboardRowModel[] {
  return page.items.slice(0, limit).map((entry) => {
    const postureLabel = entry.delisted ? "Delisted" : entry.curated ? "Curated" : "Listed";
    return {
      arkaId: entry.arkaId,
      rank: entry.rank,
      manager: entry.manager,
      nav: entry.nav,
      navDisplay: formatNavAmount(entry),
      navCaption: entry.economics?.navUsdEstimate ? "USD TVL" : "TVL",
      assetCount: entry.assets.length,
      whitelistCount: entry.whitelistContracts.length,
      feesLabel: buildVaultFeesLabel(entry),
      postureLabel,
      postureTone: entry.delisted ? "warning" : entry.curated ? "positive" : "neutral",
      baseContract: entry.denominationContract,
      baseLabel:
        entry.economics?.denominationAsset?.symbol ??
        resolveAssetDisplayLabel(entry.denominationContract),
      baseDetail: buildVaultBaseDetail(entry),
      syncedAt: entry.syncedAt,
      identity: entry.identity ?? null,
    };
  });
}

export function buildVaultRouteSet(arkaId: string): {
  profileHref: string;
  opsHref: string;
} {
  return {
    profileHref: `/vaults/${encodeURIComponent(arkaId)}`,
    opsHref: `/arkas/${encodeURIComponent(arkaId)}`,
  };
}

export function buildVaultPortfolioHighlights(
  portfolio: ArkaPortfolio,
  limit = 3,
): VaultPortfolioHighlight[] {
  return [...portfolio.items]
    .sort((left, right) => right.weightBps - left.weightBps || left.rank - right.rank)
    .slice(0, limit)
    .map((item) => ({
      assetContract: item.assetContract,
      weightBps: item.weightBps,
      navContribution: item.navContribution,
      marketCount: item.marketIds.length,
      isDenomination: item.isDenomination,
    }));
}

export function buildVaultProfileSignals(
  arka: RankedArkaCatalogEntry,
): VaultProfileSignal[] {
  return [
    {
      id: "curation",
      label: "Product status",
      value: arka.delisted ? "Delisted" : arka.curated ? "Curated" : "Listed",
      detail: `${arka.whitelistContracts.length} allowed assets`,
      tone: arka.delisted ? "warning" : arka.curated ? "positive" : "default",
    },
    {
      id: "manager",
      label: "Manager",
      value: arka.manager,
      detail: "current manager",
      tone: "default",
    },
    {
      id: "denomination",
      label: "Denomination",
      value: arka.denominationContract ?? "none",
      detail: "primary accounting asset",
      tone: "default",
    },
    {
      id: "shareToken",
      label: "Share token",
      value: arka.shareToken ?? "none",
      detail: "share issuance address",
      tone: "default",
    },
  ];
}

export function buildVaultActivityHighlights(
  activity: Page<ActivityEntry>,
): VaultActivityHighlight[] {
  const confirmedCount = activity.items.filter((entry) => entry.inSuccessfulContractCall).length;
  const uniqueActors = new Set(
    activity.items.map((entry) => entry.user).filter((value): value is string => Boolean(value)),
  ).size;
  const latestEntry = [...activity.items].sort((left, right) =>
    right.ledgerClosedAt.localeCompare(left.ledgerClosedAt),
  )[0];

  return [
    {
      id: "events",
      label: "Events",
      value: String(activity.total),
      detail: `${confirmedCount}/${activity.items.length || 0} confirmed`,
      tone: confirmedCount === activity.items.length ? "positive" : "default",
    },
    {
      id: "actors",
      label: "Active actors",
      value: String(uniqueActors),
      detail: uniqueActors > 0 ? "distinct wallet actors in window" : "vault-owned actions only",
      tone: uniqueActors > 0 ? "default" : "warning",
    },
    {
      id: "latest",
      label: "Latest action",
      value: latestEntry ? latestEntry.kind : "none",
      detail: latestEntry?.assetContract ?? "no recent asset route",
      tone: latestEntry?.inSuccessfulContractCall === false ? "warning" : "default",
    },
  ];
}

function resolveVaultDetailTrendBps(bundle: ArkaDetailBundle): number | null {
  if (bundle.arka.nav === null) return null;
  const latest = bundle.history.items.at(-1);
  const previous = bundle.history.items.length > 1
    ? bundle.history.items.at(-2)
    : null;
  if (!latest || !previous || latest.nav === null || previous.nav === null || BigInt(previous.nav) <= BigInt(0)) return null;
  return Number(((BigInt(latest.nav) - BigInt(previous.nav)) * BigInt(10_000)) / BigInt(previous.nav));
}

function formatSignedPercentFromBps(value: number | null): string {
  if (value === null) return "n/a";
  const sign = value > 0 ? "+" : "";
  return `${sign}${(value / 100).toFixed(2)}%`;
}

function hasArkaUsdEstimate(arka: RankedArkaCatalogEntry): boolean {
  return arka.economics?.navUsdEstimate !== null && arka.economics?.navUsdEstimate !== undefined;
}

function formatArkaDenominationValue(arka: RankedArkaCatalogEntry): string {
  if (arka.nav === null) return "NAV unavailable";
  const denomination = arka.economics?.denominationAsset;
  if (!denomination) return "current denomination amount unavailable";
  if (!denomination.symbol) return "current denomination amount unavailable";
  return `${formatBaseUnitAmount(
    arka.economics?.navDenomination ?? arka.nav,
    denomination.decimals,
    2,
  )} ${denomination.symbol}`;
}

function formatArkaTvlSummary(arka: RankedArkaCatalogEntry): string {
  return hasArkaUsdEstimate(arka)
    ? `${formatUsdBaseUnitAmount(arka.economics?.navUsdEstimate)} TVL`
    : `USD TVL unavailable (${formatArkaDenominationValue(arka)})`;
}

export function buildVaultDetailPublicMetricDeck(
  bundle: ArkaDetailBundle,
): VaultDetailPublicMetricTile[] {
  const { arka, history, portfolio, activity } = bundle;
  const trendBps = resolveVaultDetailTrendBps(bundle);
  const hasUsdValuation = hasArkaUsdEstimate(arka);
  const confirmedEvents = activity.items.filter(
    (entry) => entry.inSuccessfulContractCall,
  ).length;
  const denominationSleeves = portfolio.items.filter(
    (entry) => entry.isDenomination,
  ).length;

  return [
    {
      id: "nav",
      label: "TVL",
      value: hasUsdValuation ? arka.economics?.navUsdEstimate ?? arka.nav ?? "Valuation unavailable" : "Valuation unavailable",
      valueKind: hasUsdValuation ? "amount" : "text",
      detail: hasUsdValuation
        ? `${arka.assets.length} tracked assets in the current profile.`
        : arka.nav === null
          ? "The on-chain NAV calculation is unavailable. The vault remains listed; this does not mean its balance is zero."
          : `${formatArkaDenominationValue(arka)} in the Arka denomination.`,
      tone: arka.delisted || !hasUsdValuation ? "warning" : "positive",
    },
    {
      id: "trend",
      label: "TVL trend",
      value: formatSignedPercentFromBps(trendBps),
      valueKind: trendBps === null ? "text" : "percent",
      detail:
        trendBps === null
          ? `${history.total} history update${history.total === 1 ? "" : "s"} available.`
          : `${history.total} history updates; latest point compared with the previous update.`,
      tone: trendBps === null || trendBps >= 0 ? "positive" : "warning",
    },
    {
      id: "fees",
      label: "Fee profile",
      value: `Management ${(arka.fees.mgmtBps / 100).toFixed(2)}% · Performance ${(arka.fees.perfBps / 100).toFixed(2)}%`,
      valueKind: "text",
      detail: `${(arka.fees.depositBps / 100).toFixed(2)}% deposit and ${(arka.fees.redeemBps / 100).toFixed(2)}% redeem fee.`,
      tone: "default",
    },
    {
      id: "portfolio",
      label: "Portfolio assets",
      value: String(portfolio.items.length),
      valueKind: "integer",
      detail: `${denominationSleeves} denomination asset${denominationSleeves === 1 ? "" : "s"} and ${portfolio.items.length - denominationSleeves} managed position${portfolio.items.length - denominationSleeves === 1 ? "" : "s"}.`,
      tone: portfolio.items.length > 0 ? "positive" : "warning",
    },
    {
      id: "activity",
      label: "Activity",
      value: String(activity.total),
      valueKind: "integer",
      detail: `${confirmedEvents} of ${activity.items.length || 0} recent actions confirmed.`,
      tone: confirmedEvents === activity.items.length ? "positive" : "warning",
    },
    {
      id: "whitelist",
      label: "Allowed assets",
      value: String(arka.whitelistContracts.length),
      valueKind: "integer",
      detail: arka.delisted
        ? "Arka is delisted, so allowed assets remain visible for review."
        : "Allowed assets are visible before opening live Arka actions.",
      tone: arka.whitelistContracts.length > 0 ? "positive" : "warning",
    },
  ];
}

export function buildVaultDetailCommandDeck(
  bundle: ArkaDetailBundle,
): VaultDetailCommand[] {
  const { arka, history, portfolio, activity } = bundle;
  const routes = buildVaultRouteSet(arka.arkaId);
  const posture = arka.delisted ? "Delisted" : arka.curated ? "Curated" : "Listed";
  const postureTone = arka.delisted ? "warning" : arka.curated ? "positive" : "default";
  const confirmedEvents = activity.items.filter((entry) => entry.inSuccessfulContractCall).length;
  const latestPortfolioSync =
    portfolio.syncedAt || arka.syncedAt || history.items[history.items.length - 1]?.syncedAt;

  return [
    {
      id: "profile",
      label: "Profile state",
      value: posture,
      detail: `${formatArkaTvlSummary(arka)}, ${arka.assets.length} assets and ${arka.whitelistContracts.length} allowed assets.`,
      tone: postureTone,
      href: routes.profileHref,
      ctaLabel: "Current profile",
    },
    {
      id: "manager",
      label: "Manager profile",
      value: formatContractLabel(arka.manager, 10, 6),
      detail: "Open the manager explorer for operator reputation, capital concentration and related Arkas.",
      tone: "default",
      href: `/managers/${encodeURIComponent(arka.manager)}`,
      ctaLabel: "Open manager",
    },
    {
      id: "execution",
      label: "Actions",
      value: arka.delisted ? "Review only" : "Available",
      detail: arka.delisted
        ? "This profile is delisted, so review the detail page before opening manager actions."
        : "Deposits, redeems, rebalances and protocol actions continue from live Arka actions.",
      tone: arka.delisted ? "warning" : "positive",
      href: routes.opsHref,
      ctaLabel: "Open actions",
    },
    {
      id: "source",
      label: "Data source",
      value: "Live",
      detail: `${history.total} history updates, ${portfolio.items.length} portfolio positions and ${activity.total} activity events; ${confirmedEvents}/${activity.items.length || 0} recent events confirmed. Latest update ${latestPortfolioSync ? formatRelativeTime(latestPortfolioSync) : "n/a"}.`,
      tone: history.total > 0 && portfolio.items.length > 0 ? "positive" : "warning",
      href: "/status",
      ctaLabel: "Inspect status",
    },
  ];
}
