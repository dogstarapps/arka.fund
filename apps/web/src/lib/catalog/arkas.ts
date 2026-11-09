import type { ActivityEntry, ActivityKind, ArkaHistoryPoint, ArkaPortfolio } from "./types";

export interface ArkaTrendSummary {
  currentNav: string | null;
  previousNav: string | null;
  deltaNav: string | null;
  deltaBps: number | null;
  pointCount: number;
}

export interface ArkaHistoryBar {
  label: string;
  value: string;
  widthPct: number;
}

export interface ActivityGroupSummary {
  kind: ActivityKind;
  count: number;
}

export function buildArkaTrendSummary(points: ArkaHistoryPoint[]): ArkaTrendSummary {
  if (points.length === 0) {
    return {
      currentNav: null,
      previousNav: null,
      deltaNav: null,
      deltaBps: null,
      pointCount: 0,
    };
  }
  const currentNav = points.at(-1)?.nav ?? null;
  const previousNav = points.length > 1 ? points.at(-2)?.nav ?? null : null;
  const deltaNav =
    currentNav !== null && previousNav !== null
      ? (BigInt(currentNav) - BigInt(previousNav)).toString()
      : null;
  const deltaBps =
    previousNav !== null && BigInt(previousNav) > BigInt(0) && deltaNav !== null
      ? Number((BigInt(deltaNav) * BigInt(10_000)) / BigInt(previousNav))
      : null;

  return {
    currentNav,
    previousNav,
    deltaNav,
    deltaBps,
    pointCount: points.length,
  };
}

export function buildArkaHistoryBars(points: ArkaHistoryPoint[]): ArkaHistoryBar[] {
  // Missing NAV observations are gaps, not zero-valued performance samples.
  const valuedPoints = points.filter((point): point is ArkaHistoryPoint & { nav: string } => point.nav !== null);
  if (points.length === 0) {
    return [];
  }
  const maxValue = valuedPoints.reduce((accumulator, point) => {
    const value = BigInt(point.nav);
    return value > accumulator ? value : accumulator;
  }, BigInt(0));

  return valuedPoints.map((point) => ({
    label: historyLabel(point.syncedAt),
    value: point.nav,
    widthPct:
      maxValue === BigInt(0) ? 0 : Number((BigInt(point.nav) * BigInt(100)) / maxValue),
  }));
}

export function summarizeArkaActivity(entries: ActivityEntry[]): ActivityGroupSummary[] {
  const groups = new Map<ActivityKind, number>();
  for (const entry of entries) {
    groups.set(entry.kind, (groups.get(entry.kind) ?? 0) + 1);
  }
  return [...groups.entries()]
    .map(([kind, count]) => ({ kind, count }))
    .sort((left, right) => right.count - left.count || left.kind.localeCompare(right.kind));
}

export function buildPortfolioBars(portfolio: ArkaPortfolio): Array<{
  id: string;
  label: string;
  value: string;
  meta: string;
  widthPct: number;
}> {
  return portfolio.items.map((item) => ({
    id: item.assetContract,
    label: contractLabel(item.assetContract),
    value: `${(item.weightBps / 100).toFixed(1)}%`,
    meta: `${item.isDenomination ? "Denomination" : "Position"} · ${item.marketIds.length} markets`,
    widthPct: item.weightBps / 100,
  }));
}

function contractLabel(value: string): string {
  return value.length <= 16 ? value : `${value.slice(0, 8)}...${value.slice(-6)}`;
}

function historyLabel(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return date.toLocaleDateString("en", {
    month: "short",
    day: "numeric",
  });
}
