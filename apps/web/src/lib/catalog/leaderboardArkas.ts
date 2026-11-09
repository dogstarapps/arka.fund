import type {
  ActivityEntry,
  RankedArkaCatalogEntry,
  VaultResolvedMetrics,
  VaultSortMetric,
  VaultSortOrder,
} from "@/lib/catalog/types";

export function normalizeVaultSortMetric(
  value: string | null | undefined,
): VaultSortMetric {
  if (value === "nav" || value === "profit" || value === "volume") {
    return value;
  }
  return "rank";
}

export function normalizeVaultSortOrder(
  sortMetric: VaultSortMetric,
  value: string | null | undefined,
): VaultSortOrder {
  if (value === "asc" || value === "desc") {
    return value;
  }
  return sortMetric === "rank" ? "asc" : "desc";
}

export function parseVaultQueryInteger(
  value: string | null | undefined,
  fallback: number,
  minValue: number,
  maxValue: number,
): number {
  if (!value) return fallback;
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(minValue, Math.min(maxValue, parsed));
}

export function parseMetricNumber(value: string | null | undefined): number | null {
  if (!value) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function resolveActivityMagnitude(entry: ActivityEntry): number | null {
  const amount = parseMetricNumber(entry.amount);
  const netOut = parseMetricNumber(entry.netOut);
  if (amount !== null && netOut !== null) return Math.max(Math.abs(amount), Math.abs(netOut));
  if (amount !== null) return Math.abs(amount);
  if (netOut !== null) return Math.abs(netOut);
  return null;
}

export function deriveActivityMetrics(entries: ActivityEntry[]): {
  profit: number;
  volume: number;
} {
  let profit = 0;
  let volume = 0;

  for (const entry of entries) {
    const magnitude = resolveActivityMagnitude(entry);
    if (magnitude !== null) {
      volume += magnitude;
    }
    if (entry.kind === "profit") {
      const contribution = parseMetricNumber(entry.amount) ?? parseMetricNumber(entry.netOut);
      if (contribution !== null) {
        profit += contribution;
      }
    }
  }

  return { profit, volume };
}

export function buildCatalogDerivedMetrics(
  entries: RankedArkaCatalogEntry[],
): Record<string, VaultResolvedMetrics> {
  return Object.fromEntries(
    entries.map((entry) => {
      const profit = parseMetricNumber(entry.profitBase);
      const volume = parseMetricNumber(entry.volumeBase);
      return [
        entry.arkaId,
        {
          profit: {
            value: profit,
            source: profit === null ? "unavailable" : "catalog",
          },
          volume: {
            value: volume,
            source: volume === null ? "unavailable" : "catalog",
          },
        } satisfies VaultResolvedMetrics,
      ];
    }),
  );
}

export function applyActivityFallbackMetric(
  metricMap: Record<string, VaultResolvedMetrics>,
  metric: "profit" | "volume",
  fallbackValues: Record<string, number | null>,
): Record<string, VaultResolvedMetrics> {
  const next = { ...metricMap };
  for (const [arkaId, fallbackValue] of Object.entries(fallbackValues)) {
    const existing = next[arkaId];
    if (!existing) continue;
    if (existing[metric].value !== null) continue;
    next[arkaId] = {
      ...existing,
      [metric]: {
        value: fallbackValue,
        source: fallbackValue === null ? "unavailable" : "activity",
      },
    };
  }
  return next;
}

function resolveSortValue(
  entry: RankedArkaCatalogEntry,
  sortMetric: VaultSortMetric,
  sortOrder: VaultSortOrder,
  metricMap: Record<string, VaultResolvedMetrics>,
): number {
  const unresolvedFallback =
    sortOrder === "asc" ? Number.POSITIVE_INFINITY : Number.NEGATIVE_INFINITY;
  if (sortMetric === "rank") return entry.rank;
  if (sortMetric === "nav") {
    return parseMetricNumber(entry.nav) ?? unresolvedFallback;
  }
  return metricMap[entry.arkaId]?.[sortMetric].value ?? unresolvedFallback;
}

export function rankVaultLeaderboardEntries(
  entries: RankedArkaCatalogEntry[],
  sortMetric: VaultSortMetric,
  sortOrder: VaultSortOrder,
  metricMap: Record<string, VaultResolvedMetrics>,
): RankedArkaCatalogEntry[] {
  return [...entries]
    .sort((left, right) => {
      const leftValue = resolveSortValue(left, sortMetric, sortOrder, metricMap);
      const rightValue = resolveSortValue(right, sortMetric, sortOrder, metricMap);
      if (leftValue !== rightValue) {
        return sortOrder === "asc" ? leftValue - rightValue : rightValue - leftValue;
      }
      if (left.rank !== right.rank) {
        return left.rank - right.rank;
      }
      return left.arkaId.localeCompare(right.arkaId);
    })
    .map((entry, index) => ({
      ...entry,
      rank: index + 1,
    }));
}

export function pickDerivedMetricsForEntries(
  entries: RankedArkaCatalogEntry[],
  metricMap: Record<string, VaultResolvedMetrics>,
): Record<string, VaultResolvedMetrics> {
  return Object.fromEntries(
    entries.map((entry) => [
      entry.arkaId,
      metricMap[entry.arkaId] ?? {
        profit: { value: null, source: "unavailable" },
        volume: { value: null, source: "unavailable" },
      },
    ]),
  );
}
