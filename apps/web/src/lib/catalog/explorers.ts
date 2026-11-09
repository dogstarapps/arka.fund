import type { AssetHistoryPoint, ManagerHistoryPoint } from "./types";

export interface HistoryBarPoint {
  label: string;
  value: string;
  widthPct: number;
}

export interface TrendSummary {
  currentValue: string | null;
  previousValue: string | null;
  deltaValue: string | null;
  deltaBps: number | null;
  pointCount: number;
}

export function buildManagerTrendSummary(points: ManagerHistoryPoint[]): TrendSummary {
  return buildTrendSummary(
    points.flatMap((point) =>
      point.totalNavUsdEstimate === null || point.totalNavUsdEstimate === undefined
        ? []
        : [point.totalNavUsdEstimate],
    ),
  );
}

export function buildAssetTrendSummary(points: AssetHistoryPoint[]): TrendSummary {
  return buildTrendSummary(points.map((point) => point.netManagedAmount));
}

export function buildManagerHistoryBars(points: ManagerHistoryPoint[]): HistoryBarPoint[] {
  return buildHistoryBars(
    points.flatMap((point) =>
      point.totalNavUsdEstimate === null || point.totalNavUsdEstimate === undefined
        ? []
        : [{
            label: historyLabel(point.syncedAt),
            value: point.totalNavUsdEstimate,
          }],
    ),
  );
}

export function buildAssetHistoryBars(points: AssetHistoryPoint[]): HistoryBarPoint[] {
  return buildHistoryBars(
    points.map((point) => ({
      label: historyLabel(point.syncedAt),
      value: point.netManagedAmount,
    })),
  );
}

function buildTrendSummary(values: string[]): TrendSummary {
  if (values.length === 0) {
    return {
      currentValue: null,
      previousValue: null,
      deltaValue: null,
      deltaBps: null,
      pointCount: 0,
    };
  }

  const currentValue = values.at(-1) ?? null;
  const previousValue = values.length > 1 ? values.at(-2) ?? null : null;
  const deltaValue =
    currentValue !== null && previousValue !== null
      ? (BigInt(currentValue) - BigInt(previousValue)).toString()
      : null;
  const deltaBps =
    previousValue !== null && BigInt(previousValue) > BigInt(0) && deltaValue !== null
      ? Number((BigInt(deltaValue) * BigInt(10_000)) / BigInt(previousValue))
      : null;

  return {
    currentValue,
    previousValue,
    deltaValue,
    deltaBps,
    pointCount: values.length,
  };
}

function buildHistoryBars(
  points: Array<{ label: string; value: string }>,
): HistoryBarPoint[] {
  if (points.length === 0) {
    return [];
  }
  const maxValue = points.reduce((accumulator, point) => {
    const candidate = BigInt(point.value);
    return candidate > accumulator ? candidate : accumulator;
  }, BigInt(0));

  return points.map((point) => ({
    label: point.label,
    value: point.value,
    widthPct:
      maxValue === BigInt(0) ? 0 : Number((BigInt(point.value) * BigInt(100)) / maxValue),
  }));
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
