import { NextRequest } from "next/server";
import {
  normalizeManagerSortMetric,
  normalizeManagerSortOrder,
  parseManagerQueryInteger,
  rankManagerLeaderboardEntries,
} from "@/lib/catalog/leaderboardManagers";
import type {
  ManagerLeaderboardResolvedPageResponse,
  Page,
  RankedManagerCatalogEntry,
} from "@/lib/catalog/types";
import { readCatalogJsonForRoute } from "@/lib/catalog/serverRouteClient";
import { jsonNoStore, redactApiText } from "@/lib/server/apiHardening";

export const dynamic = "force-dynamic";

const DEFAULT_LIMIT = 24;
const MAX_LIMIT = 100;

export async function GET(request: NextRequest): Promise<Response> {
  try {
    const search = request.nextUrl.searchParams.get("search")?.trim() ?? "";
    const sortMetric = normalizeManagerSortMetric(
      request.nextUrl.searchParams.get("sortMetric"),
    );
    const sortOrder = normalizeManagerSortOrder(
      sortMetric,
      request.nextUrl.searchParams.get("sortOrder"),
    );
    const limit = parseManagerQueryInteger(
      request.nextUrl.searchParams.get("limit"),
      DEFAULT_LIMIT,
      1,
      MAX_LIMIT,
    );
    const offset = parseManagerQueryInteger(
      request.nextUrl.searchParams.get("offset"),
      0,
      0,
      MAX_LIMIT,
    );
    const upstreamLimit = Math.max(limit + offset, limit);

    const page = await readCatalogJsonForRoute<Page<RankedManagerCatalogEntry>>(
      request,
      "/v1/managers",
      {
        search: search || undefined,
        limit: String(upstreamLimit),
      },
    );
    const rankedItems = rankManagerLeaderboardEntries(
      page.items,
      sortMetric,
      sortOrder,
    );
    const pagedItems = rankedItems.slice(offset, offset + limit);

    const payload: ManagerLeaderboardResolvedPageResponse = {
      ok: true,
      source: "api_manager_leaderboard",
      generatedAt: new Date().toISOString(),
      query: {
        search: search || null,
        sortMetric,
        sortOrder,
        limit,
        offset,
      },
      page: {
        total: rankedItems.length,
        offset,
        limit,
        items: pagedItems,
      },
    };

    return jsonNoStore(payload);
  } catch (error) {
    return jsonNoStore(
      {
        ok: false,
        source: "api_manager_leaderboard",
        error: redactApiText(error, "Failed to build manager leaderboard."),
      },
      { status: 500 },
    );
  }
}
