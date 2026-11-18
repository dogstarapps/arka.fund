import type {
  ManagerSortMetric,
  ManagerSortOrder,
  RankedManagerCatalogEntry,
} from "@/lib/catalog/types";

export function normalizeManagerSortMetric(
  value: string | null | undefined,
): ManagerSortMetric {
  if (value === "nav" || value === "arkas" || value === "curated") {
    return value;
  }
  return "rank";
}

export function normalizeManagerSortOrder(
  sortMetric: ManagerSortMetric,
  value: string | null | undefined,
): ManagerSortOrder {
  if (value === "asc" || value === "desc") {
    return value;
  }
  return sortMetric === "rank" ? "asc" : "desc";
}

export function parseManagerQueryInteger(
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

function parseNav(value: string): bigint | null {
  try {
    return BigInt(value);
  } catch {
    return null;
  }
}

function compareRank(left: RankedManagerCatalogEntry, right: RankedManagerCatalogEntry): number {
  if (left.rank !== right.rank) return left.rank - right.rank;
  return left.manager.localeCompare(right.manager);
}

export function rankManagerLeaderboardEntries(
  entries: RankedManagerCatalogEntry[],
  sortMetric: ManagerSortMetric,
  sortOrder: ManagerSortOrder,
): RankedManagerCatalogEntry[] {
  return [...entries]
    .sort((left, right) => {
      if (sortMetric === "rank") {
        return sortOrder === "asc"
          ? compareRank(left, right)
          : compareRank(right, left);
      }

      if (sortMetric === "nav") {
        const leftNav = parseNav(left.totalNav);
        const rightNav = parseNav(right.totalNav);
        if (leftNav !== null && rightNav !== null && leftNav !== rightNav) {
          return sortOrder === "asc"
            ? leftNav < rightNav
              ? -1
              : 1
            : leftNav > rightNav
              ? -1
              : 1;
        }
      } else {
        const leftValue =
          sortMetric === "arkas" ? left.arkaCount : left.curatedArkaCount;
        const rightValue =
          sortMetric === "arkas" ? right.arkaCount : right.curatedArkaCount;
        if (leftValue !== rightValue) {
          return sortOrder === "asc"
            ? leftValue - rightValue
            : rightValue - leftValue;
        }
      }

      return compareRank(left, right);
    })
    .map((entry, index) => ({
      ...entry,
      rank: index + 1,
    }));
}
