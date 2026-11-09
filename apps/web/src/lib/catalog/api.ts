import type {
  ActivityEntry,
  ArkaHolderPage,
  ArkaAssetExposure,
  ArkaDetailBundle,
  ArkaHistoryPoint,
  ArkaIdentityMetadata,
  ArkaPortfolio,
  AssetDetailBundle,
  CatalogAssetPrice,
  AssetHistoryPoint,
  DashboardBundle,
  DashboardComposition,
  DashboardOverview,
  CoreStellarAssetRegistryResponse,
  DiscoverBundle,
  DiscoverQuery,
  LeaderboardDataSourceSnapshot,
  ExplorerQuery,
  IdentityUpdateRequest,
  ManagerDetailBundle,
  ManagerIdentityMetadata,
  ManagerLeaderboardResolvedPageResponse,
  ManagerSortMetric,
  ManagerSortOrder,
  ManagerHistoryPoint,
  MonitoringStatus,
  Page,
  RankedArkaCatalogEntry,
  RankedAssetCatalogEntry,
  RankedManagerCatalogEntry,
  VaultLeaderboardResolvedPageResponse,
  VaultSortMetric,
  VaultSortOrder,
} from "./types";

const CATALOG_PROXY_PREFIX = "/api/catalog";

export class CatalogApiError extends Error {
  status: number;

  constructor(message: string, status = 500) {
    super(message);
    this.name = "CatalogApiError";
    this.status = status;
  }
}

export function isCatalogConfigurationError(message: string | null | undefined): boolean {
  const normalized = normalizeCatalogErrorMessage(message);
  return (
    /\bcatalog api\b.*\bnot configured\b/.test(normalized) ||
    normalized.includes("catalog_api_base_url") ||
    normalized.includes("next_public_catalog_api_base_url")
  );
}

type QueryValue = string | number | boolean | undefined;

export function buildCatalogProxyPath(
  path: string,
  query: Record<string, QueryValue> = {},
): string {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  const searchParams = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === "") {
      continue;
    }
    searchParams.set(key, String(value));
  }
  const queryString = searchParams.toString();
  return `${CATALOG_PROXY_PREFIX}${normalizedPath}${queryString ? `?${queryString}` : ""}`;
}

export async function fetchCatalog<T>(
  path: string,
  query: Record<string, QueryValue> = {},
  init: RequestInit = {},
): Promise<T> {
  const response = await fetch(buildCatalogProxyPath(path, query), {
    ...init,
    cache: "no-store",
    headers: {
      accept: "application/json",
      ...(init.headers ?? {}),
    },
  });
  return parseCatalogResponse<T>(response);
}

export async function loadCatalogAssetPrice(
  assetContract: string,
  signal?: AbortSignal,
): Promise<CatalogAssetPrice> {
  return fetchCatalog<CatalogAssetPrice>(
    `/v1/prices/${encodeURIComponent(assetContract)}`,
    {},
    { signal },
  );
}

export async function saveArkaIdentity(
  arkaId: string,
  request: IdentityUpdateRequest,
  signal?: AbortSignal,
): Promise<ArkaIdentityMetadata> {
  return fetchCatalog<ArkaIdentityMetadata>(
    `/v1/arkas/${encodeURIComponent(arkaId)}/identity`,
    {},
    {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(request),
      signal,
    },
  );
}

export async function saveManagerIdentity(
  managerId: string,
  request: IdentityUpdateRequest,
  signal?: AbortSignal,
): Promise<ManagerIdentityMetadata> {
  return fetchCatalog<ManagerIdentityMetadata>(
    `/v1/managers/${encodeURIComponent(managerId)}/identity`,
    {},
    {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(request),
      signal,
    },
  );
}

export async function loadDashboardBundle(signal?: AbortSignal): Promise<DashboardBundle> {
  const [overview, composition, arkas, managers, monitoring] = await Promise.all([
    fetchCatalog<DashboardOverview>("/v1/dashboard/overview", { activityLimit: 12 }, { signal }),
    fetchCatalog<DashboardComposition>("/v1/dashboard/composition", { limit: 6 }, { signal }),
    fetchCatalog<Page<RankedArkaCatalogEntry>>(
      "/v1/arkas",
      { limit: 12 },
      { signal },
    ),
    fetchCatalog<Page<RankedManagerCatalogEntry>>("/v1/managers", { limit: 4 }, { signal }),
    fetchCatalog<MonitoringStatus>("/v1/monitoring/status", {}, { signal }),
  ]);
  const featuredHistoryEntries = await Promise.all(
    arkas.items.map(async (entry) => {
      try {
        const history = await fetchCatalog<Page<ArkaHistoryPoint>>(
          `/v1/arkas/${entry.arkaId}/history`,
          { order: "asc", limit: 24 },
          { signal },
        );
        return [entry.arkaId, history] as const;
      } catch {
        return [
          entry.arkaId,
          { total: 0, offset: 0, limit: 0, items: [] },
        ] as const;
      }
    }),
  );
  return {
    overview,
    composition,
    arkas,
    featuredHistory: Object.fromEntries(featuredHistoryEntries),
    managers,
    monitoring,
  };
}

export async function loadDiscoverBundle(
  query: DiscoverQuery = {},
  signal?: AbortSignal,
): Promise<DiscoverBundle> {
  const search = query.search?.trim() || undefined;
  const curated = query.curated ?? undefined;
  const [overview, arkas, managers, assets] = await Promise.all([
    fetchCatalog<DashboardOverview>("/v1/dashboard/overview", { activityLimit: 12 }, { signal }),
    fetchCatalog<Page<RankedArkaCatalogEntry>>(
      "/v1/arkas",
      { search, curated, limit: 12 },
      { signal },
    ),
    fetchCatalog<Page<RankedManagerCatalogEntry>>(
      "/v1/managers",
      { search, limit: 8 },
      { signal },
    ),
    fetchCatalog<Page<RankedAssetCatalogEntry>>(
      "/v1/assets",
      { search, limit: 8 },
      { signal },
    ),
  ]);
  const featuredHistoryEntries = await Promise.all(
    arkas.items.slice(0, 3).map(async (entry) => {
      try {
        const history = await fetchCatalog<Page<ArkaHistoryPoint>>(
          `/v1/arkas/${entry.arkaId}/history`,
          { order: "asc", limit: 24 },
          { signal },
        );
        return [entry.arkaId, history] as const;
      } catch {
        return [
          entry.arkaId,
          { total: 0, offset: 0, limit: 0, items: [] },
        ] as const;
      }
    }),
  );
  return {
    overview,
    arkas,
    featuredHistory: Object.fromEntries(featuredHistoryEntries),
    managers,
    assets,
  };
}

export async function loadVaultLeaderboardPage(
  query: DiscoverQuery = {},
  signal?: AbortSignal,
): Promise<Page<RankedArkaCatalogEntry>> {
  const search = query.search?.trim() || undefined;
  const curated = query.curated ?? undefined;
  return fetchCatalog<Page<RankedArkaCatalogEntry>>(
    "/v1/arkas",
    { search, curated, limit: 24 },
    { signal },
  );
}

export async function loadArkasForAssetValuation(
  signal?: AbortSignal,
): Promise<Page<RankedArkaCatalogEntry>> {
  return fetchCatalog<Page<RankedArkaCatalogEntry>>(
    "/v1/arkas",
    { limit: 100 },
    { signal },
  );
}

export interface VaultLeaderboardResolvedQuery {
  search?: string;
  curatedOnly?: boolean;
  sortMetric?: VaultSortMetric;
  sortOrder?: VaultSortOrder;
  limit?: number;
  offset?: number;
  activityFallbackLimit?: number;
}

export async function loadVaultLeaderboardResolvedPage(
  query: VaultLeaderboardResolvedQuery = {},
  signal?: AbortSignal,
): Promise<VaultLeaderboardResolvedPageResponse> {
  const search = query.search?.trim();
  const searchParams = new URLSearchParams();
  if (search) searchParams.set("search", search);
  if (query.curatedOnly !== undefined) {
    searchParams.set("curatedOnly", query.curatedOnly ? "true" : "false");
  }
  if (query.sortMetric) searchParams.set("sortMetric", query.sortMetric);
  if (query.sortOrder) searchParams.set("sortOrder", query.sortOrder);
  if (query.limit !== undefined) searchParams.set("limit", String(query.limit));
  if (query.offset !== undefined) searchParams.set("offset", String(query.offset));
  if (query.activityFallbackLimit !== undefined) {
    searchParams.set(
      "activityFallbackLimit",
      String(query.activityFallbackLimit),
    );
  }
  const endpoint = `/api/leaderboard/arkas${
    searchParams.size > 0 ? `?${searchParams.toString()}` : ""
  }`;
  const response = await fetch(endpoint, {
    method: "GET",
    cache: "no-store",
    headers: {
      accept: "application/json",
    },
    signal,
  });
  return parseCatalogResponse<VaultLeaderboardResolvedPageResponse>(response);
}

export async function loadArkaActivityPage(
  arkaId: string,
  query: {
    order?: "asc" | "desc";
    limit?: number;
  } = {},
  signal?: AbortSignal,
): Promise<Page<ActivityEntry>> {
  return fetchCatalog<Page<ActivityEntry>>(
    `/v1/arkas/${arkaId}/activity`,
    {
      order: query.order ?? "desc",
      limit: query.limit ?? 60,
    },
    { signal },
  );
}

export async function loadArkaHoldersPage(
  arkaId: string,
  query: { offset?: number; limit?: number } = {},
  signal?: AbortSignal,
): Promise<ArkaHolderPage> {
  return fetchCatalog<ArkaHolderPage>(
    `/v1/arkas/${arkaId}/holders`,
    {
      offset: query.offset ?? 0,
      limit: query.limit ?? 10,
    },
    { signal },
  );
}

export interface ArkaInvestorCount {
  total: number;
  complete: boolean;
}

export async function loadArkaInvestorCounts(
  arkaIds: string[],
  signal?: AbortSignal,
): Promise<Record<string, ArkaInvestorCount>> {
  const uniqueIds = Array.from(new Set(arkaIds.filter(Boolean)));
  const results = await Promise.allSettled(
    uniqueIds.map(async (arkaId) => {
      const page = await loadArkaHoldersPage(arkaId, { offset: 0, limit: 1 }, signal);
      if (!page || !Number.isFinite(page.total) || typeof page.complete !== "boolean") {
        throw new CatalogApiError("Investor count is unavailable.", 502);
      }
      return [arkaId, { total: page.total, complete: page.complete }] as const;
    }),
  );

  return Object.fromEntries(
    results.flatMap((result) => result.status === "fulfilled" ? [result.value] : []),
  );
}

export async function loadArkaCatalogEntry(
  arkaId: string,
  signal?: AbortSignal,
): Promise<RankedArkaCatalogEntry> {
  return fetchCatalog<RankedArkaCatalogEntry>(
    `/v1/arkas/${arkaId}`,
    {},
    { signal },
  );
}

export async function loadManagersPage(
  query: ExplorerQuery = {},
  signal?: AbortSignal,
): Promise<Page<RankedManagerCatalogEntry>> {
  const search = query.search?.trim() || undefined;
  return fetchCatalog<Page<RankedManagerCatalogEntry>>(
    "/v1/managers",
    { search, limit: 24 },
    { signal },
  );
}

export interface ManagerLeaderboardResolvedQuery {
  search?: string;
  sortMetric?: ManagerSortMetric;
  sortOrder?: ManagerSortOrder;
  limit?: number;
  offset?: number;
}

export async function loadManagersResolvedPage(
  query: ManagerLeaderboardResolvedQuery = {},
  signal?: AbortSignal,
): Promise<ManagerLeaderboardResolvedPageResponse> {
  const search = query.search?.trim();
  const searchParams = new URLSearchParams();
  if (search) searchParams.set("search", search);
  if (query.sortMetric) searchParams.set("sortMetric", query.sortMetric);
  if (query.sortOrder) searchParams.set("sortOrder", query.sortOrder);
  if (query.limit !== undefined) searchParams.set("limit", String(query.limit));
  if (query.offset !== undefined) searchParams.set("offset", String(query.offset));
  const endpoint = `/api/leaderboard/managers${
    searchParams.size > 0 ? `?${searchParams.toString()}` : ""
  }`;

  const response = await fetch(endpoint, {
    method: "GET",
    cache: "no-store",
    headers: {
      accept: "application/json",
    },
    signal,
  });
  return parseCatalogResponse<ManagerLeaderboardResolvedPageResponse>(response);
}

export async function loadAssetsPage(
  query: ExplorerQuery = {},
  signal?: AbortSignal,
): Promise<Page<RankedAssetCatalogEntry>> {
  const search = query.search?.trim() || undefined;
  return fetchCatalog<Page<RankedAssetCatalogEntry>>(
    "/v1/assets",
    { search, limit: 24 },
    { signal },
  );
}

export async function loadAssetHistoryPage(
  assetContract: string,
  signal?: AbortSignal,
): Promise<Page<AssetHistoryPoint>> {
  return fetchCatalog<Page<AssetHistoryPoint>>(
    `/v1/assets/${assetContract}/history`,
    { order: "asc", limit: 12 },
    { signal },
  );
}

export async function loadCoreStellarAssetRegistry(
  signal?: AbortSignal,
): Promise<CoreStellarAssetRegistryResponse> {
  const response = await fetch("/api/assets/core-registry", {
    method: "GET",
    cache: "no-store",
    headers: {
      accept: "application/json",
    },
    signal,
  });
  return parseCatalogResponse<CoreStellarAssetRegistryResponse>(response);
}

export async function loadManagerDetailBundle(
  managerId: string,
  signal?: AbortSignal,
): Promise<ManagerDetailBundle> {
  const [manager, history, arkas] = await Promise.all([
    fetchCatalog<RankedManagerCatalogEntry>(`/v1/managers/${managerId}`, {}, { signal }),
    fetchCatalog<Page<ManagerHistoryPoint>>(
      `/v1/managers/${managerId}/history`,
      { order: "asc", limit: 12 },
      { signal },
    ),
    fetchCatalog<Page<RankedArkaCatalogEntry>>(
      `/v1/managers/${managerId}/arkas`,
      { sort: "nav", order: "desc", limit: 100 },
      { signal },
    ),
  ]);
  return { manager, history, arkas };
}

export async function loadManagedArkasPage(
  managerId: string,
  signal?: AbortSignal,
): Promise<Page<RankedArkaCatalogEntry>> {
  return fetchCatalog<Page<RankedArkaCatalogEntry>>(
    `/v1/managers/${encodeURIComponent(managerId)}/arkas`,
    { sort: "nav", order: "desc", limit: 100 },
    { signal },
  );
}

export async function loadAssetDetailBundle(
  assetContract: string,
  signal?: AbortSignal,
): Promise<AssetDetailBundle> {
  const [asset, history, arkas] = await Promise.all([
    fetchCatalog<RankedAssetCatalogEntry>(`/v1/assets/${assetContract}`, {}, { signal }),
    fetchCatalog<Page<AssetHistoryPoint>>(
      `/v1/assets/${assetContract}/history`,
      { order: "asc", limit: 12 },
      { signal },
    ),
    fetchCatalog<Page<RankedArkaCatalogEntry>>(
      `/v1/assets/${assetContract}/arkas`,
      { sort: "nav", order: "desc", limit: 12 },
      { signal },
    ),
  ]);
  return { asset, history, arkas };
}

export async function loadArkaDetailBundle(
  arkaId: string,
  signal?: AbortSignal,
): Promise<ArkaDetailBundle> {
  const [arka, history, assets, portfolio, activity] = await Promise.all([
    fetchCatalog<RankedArkaCatalogEntry>(`/v1/arkas/${arkaId}`, {}, { signal }),
    fetchCatalog<Page<ArkaHistoryPoint>>(
      `/v1/arkas/${arkaId}/history`,
      { order: "desc", limit: 12 },
      { signal },
    ),
    fetchCatalog<ArkaAssetExposure[]>(`/v1/arkas/${arkaId}/assets`, {}, { signal }),
    fetchCatalog<ArkaPortfolio>(`/v1/arkas/${arkaId}/portfolio`, { limit: 12 }, { signal }),
    fetchCatalog<Page<ActivityEntry>>(
      `/v1/arkas/${arkaId}/activity`,
      { order: "desc", limit: 20 },
      { signal },
    ),
  ]);
  // Fetch the latest observations, then present them chronologically.
  // Ascending pagination previously returned the oldest 12 observations.
  return { arka, history: {...history,items:[...history.items].sort((left,right)=>left.syncedAt.localeCompare(right.syncedAt))}, assets, portfolio, activity };
}

export async function loadVaultLeaderboardSource(
  signal?: AbortSignal,
): Promise<LeaderboardDataSourceSnapshot> {
  const response = await fetch("/api/leaderboard/source", {
    method: "GET",
    cache: "no-store",
    headers: {
      accept: "application/json",
    },
    signal,
  });
  return parseCatalogResponse<LeaderboardDataSourceSnapshot>(response);
}

async function parseCatalogResponse<T>(response: Response): Promise<T> {
  const contentType = response.headers.get("content-type") ?? "";
  const isJson = contentType.includes("application/json");
  const body = isJson ? await response.json() : await response.text();
  if (!response.ok) {
    throw new CatalogApiError(extractErrorMessage(body), response.status);
  }
  return body as T;
}

function extractErrorMessage(body: unknown): string {
  if (typeof body === "string" && body.trim().length > 0) {
    return sanitizeCatalogErrorMessage(body);
  }
  if (typeof body === "object" && body !== null) {
    const message = Reflect.get(body, "message");
    if (typeof message === "string" && message.trim().length > 0) {
      return sanitizeCatalogErrorMessage(message);
    }
    const error = Reflect.get(body, "error");
    if (typeof error === "string" && error.trim().length > 0) {
      return sanitizeCatalogErrorMessage(error);
    }
  }
  return "Catalog request failed.";
}

function sanitizeCatalogErrorMessage(message: string): string {
  const normalized = message.trim();
  if (isCatalogConfigurationError(normalized)) {
    return "Catalog API is not configured for this environment.";
  }
  return normalized;
}

function normalizeCatalogErrorMessage(message: string | null | undefined): string {
  return (message ?? "")
    .trim()
    .replace(/[_-]+/g, "_")
    .replace(/\s+/g, " ")
    .toLowerCase();
}
