import { NextRequest } from "next/server";
import {
  applyActivityFallbackMetric,
  buildCatalogDerivedMetrics,
  deriveActivityMetrics,
  normalizeVaultSortMetric,
  normalizeVaultSortOrder,
  parseVaultQueryInteger,
  pickDerivedMetricsForEntries,
  rankVaultLeaderboardEntries,
} from "@/lib/catalog/leaderboardArkas";
import type {
  ActivityEntry,
  Page,
  RankedArkaCatalogEntry,
  VaultLeaderboardResolvedPageResponse,
} from "@/lib/catalog/types";
import { readCatalogJsonForRoute } from "@/lib/catalog/serverRouteClient";
import { jsonNoStore, redactApiText } from "@/lib/server/apiHardening";

export const dynamic = "force-dynamic";

const DEFAULT_LIMIT = 24;
const MAX_LIMIT = 100;
const DEFAULT_ACTIVITY_FALLBACK_LIMIT = 60;
const MAX_ACTIVITY_FALLBACK_LIMIT = 500;

function parseCuratedOnly(value: string | null): boolean {
  const normalized = value?.trim().toLowerCase();
  return normalized === "true" || normalized === "1" || normalized === "yes";
}

export async function GET(request: NextRequest): Promise<Response> {
  try {
    const search = request.nextUrl.searchParams.get("search")?.trim() ?? "";
    const curatedOnly = parseCuratedOnly(
      request.nextUrl.searchParams.get("curatedOnly"),
    );
    const sortMetric = normalizeVaultSortMetric(
      request.nextUrl.searchParams.get("sortMetric"),
    );
    const sortOrder = normalizeVaultSortOrder(
      sortMetric,
      request.nextUrl.searchParams.get("sortOrder"),
    );
    const limit = parseVaultQueryInteger(
      request.nextUrl.searchParams.get("limit"),
      DEFAULT_LIMIT,
      1,
      MAX_LIMIT,
    );
    const offset = parseVaultQueryInteger(
      request.nextUrl.searchParams.get("offset"),
      0,
      0,
      MAX_LIMIT,
    );
    const activityFallbackLimit = parseVaultQueryInteger(
      request.nextUrl.searchParams.get("activityFallbackLimit"),
      DEFAULT_ACTIVITY_FALLBACK_LIMIT,
      1,
      MAX_ACTIVITY_FALLBACK_LIMIT,
    );
    const upstreamLimit = Math.max(limit + offset, limit);

    const page = await readCatalogJsonForRoute<Page<RankedArkaCatalogEntry>>(
      request,
      "/v1/arkas",
      {
        search: search || undefined,
        curated: curatedOnly ? "true" : undefined,
        limit: String(upstreamLimit),
      },
    );

    let derivedMetrics = buildCatalogDerivedMetrics(page.items);
    const requiresFallback = sortMetric === "profit" || sortMetric === "volume";
    if (requiresFallback) {
      const metric = sortMetric;
      const missing = page.items.filter(
        (entry) => derivedMetrics[entry.arkaId]?.[metric].value === null,
      );
      if (missing.length > 0) {
        const settled = await Promise.allSettled(
          missing.map(async (entry) => {
            const activity = await readCatalogJsonForRoute<Page<ActivityEntry>>(
              request,
              `/v1/arkas/${encodeURIComponent(entry.arkaId)}/activity`,
              {
                order: "desc",
                limit: String(activityFallbackLimit),
              },
            );
            const metrics = deriveActivityMetrics(activity.items);
            return {
              arkaId: entry.arkaId,
              value: metric === "profit" ? metrics.profit : metrics.volume,
            };
          }),
        );

        const fallbackValues: Record<string, number | null> = {};
        settled.forEach((result, index) => {
          const arkaId = missing[index]?.arkaId;
          if (!arkaId) return;
          fallbackValues[arkaId] =
            result.status === "fulfilled" ? result.value.value : null;
        });

        derivedMetrics = applyActivityFallbackMetric(
          derivedMetrics,
          metric,
          fallbackValues,
        );
      }
    }

    const rankedItems = rankVaultLeaderboardEntries(
      page.items,
      sortMetric,
      sortOrder,
      derivedMetrics,
    );
    const pagedItems = rankedItems.slice(offset, offset + limit);
    const payload: VaultLeaderboardResolvedPageResponse = {
      ok: true,
      source: "api_vault_leaderboard",
      generatedAt: new Date().toISOString(),
      query: {
        search: search || null,
        curatedOnly,
        sortMetric,
        sortOrder,
        limit,
        offset,
        activityFallbackLimit,
      },
      page: {
        total: rankedItems.length,
        offset,
        limit,
        items: pagedItems,
      },
      derivedMetrics: pickDerivedMetricsForEntries(pagedItems, derivedMetrics),
    };

    return jsonNoStore(payload);
  } catch (error) {
    return jsonNoStore(
      {
        ok: false,
        source: "api_vault_leaderboard",
        error: redactApiText(error, "Failed to build Arka leaderboard."),
      },
      { status: 500 },
    );
  }
}
