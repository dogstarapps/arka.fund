import type {
  CatalogActivity,
  CatalogActivityQuery,
  CatalogArka,
  CatalogArkaQuery,
  CatalogAsset,
  CatalogAssetQuery,
  CatalogHealth,
  CatalogManager,
  CatalogManagerQuery,
  CatalogMetrics,
  CatalogMonitoringAlert,
  CatalogMonitoringRun,
  CatalogMonitoringStatus,
  CatalogPage,
} from "./types.js";

export const ARKAFUND_CATALOG_MAINNET_URL = "https://catalog.arka.fund";

export interface CatalogClientOptions {
  baseUrl?: string;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
}

export class CatalogApiError extends Error {
  constructor(
    readonly status: number,
    readonly path: string,
    readonly body: unknown,
  ) {
    super(`Arka catalog request failed with HTTP ${status}: ${path}`);
    this.name = "CatalogApiError";
  }
}

/** Typed, read-only client for the public Arka catalog and NAV data plane. */
export class CatalogClient {
  private readonly baseUrl: string;
  private readonly fetchImpl: typeof fetch;
  private readonly timeoutMs: number;

  constructor(options: CatalogClientOptions = {}) {
    this.baseUrl = normalizeBaseUrl(options.baseUrl ?? ARKAFUND_CATALOG_MAINNET_URL);
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.timeoutMs = options.timeoutMs ?? 10_000;
  }

  health(): Promise<CatalogHealth> {
    return this.get("/health");
  }

  metrics(): Promise<CatalogMetrics> {
    return this.get("/v1/metrics");
  }

  arkas(query: CatalogArkaQuery = {}): Promise<CatalogPage<CatalogArka>> {
    return this.get("/v1/arkas", query);
  }

  arka(arkaId: string): Promise<CatalogArka> {
    return this.get(`/v1/arkas/${encodeURIComponent(arkaId)}`);
  }

  arkaAssets(arkaId: string): Promise<CatalogArka["assets"]> {
    return this.get(`/v1/arkas/${encodeURIComponent(arkaId)}/assets`);
  }

  arkaPortfolio(arkaId: string, limit?: number): Promise<Record<string, unknown>> {
    return this.get(`/v1/arkas/${encodeURIComponent(arkaId)}/portfolio`, { limit });
  }

  arkaActivity(
    arkaId: string,
    query: CatalogActivityQuery = {},
  ): Promise<CatalogPage<CatalogActivity>> {
    return this.get(`/v1/arkas/${encodeURIComponent(arkaId)}/activity`, query);
  }

  assets(query: CatalogAssetQuery = {}): Promise<CatalogPage<CatalogAsset>> {
    return this.get("/v1/assets", query);
  }

  asset(assetId: string): Promise<CatalogAsset> {
    return this.get(`/v1/assets/${encodeURIComponent(assetId)}`);
  }

  assetArkas(
    assetId: string,
    query: CatalogArkaQuery = {},
  ): Promise<CatalogPage<CatalogArka>> {
    return this.get(`/v1/assets/${encodeURIComponent(assetId)}/arkas`, query);
  }

  managers(query: CatalogManagerQuery = {}): Promise<CatalogPage<CatalogManager>> {
    return this.get("/v1/managers", query);
  }

  manager(managerId: string): Promise<CatalogManager> {
    return this.get(`/v1/managers/${encodeURIComponent(managerId)}`);
  }

  managerArkas(
    managerId: string,
    query: CatalogArkaQuery = {},
  ): Promise<CatalogPage<CatalogArka>> {
    return this.get(`/v1/managers/${encodeURIComponent(managerId)}/arkas`, query);
  }

  activity(query: CatalogActivityQuery = {}): Promise<CatalogPage<CatalogActivity>> {
    return this.get("/v1/activity", query);
  }

  dashboardOverview(activityLimit?: number): Promise<Record<string, unknown>> {
    return this.get("/v1/dashboard/overview", { activityLimit });
  }

  dashboardComposition(limit?: number): Promise<Record<string, unknown>> {
    return this.get("/v1/dashboard/composition", { limit });
  }

  monitoringStatus(): Promise<CatalogMonitoringStatus> {
    return this.get("/v1/monitoring/status");
  }

  monitoringRuns(options: {
    status?: "success" | "failure";
    order?: "asc" | "desc";
    limit?: number;
  } = {}): Promise<CatalogPage<CatalogMonitoringRun>> {
    return this.get("/v1/monitoring/runs", options);
  }

  monitoringAlerts(active?: boolean): Promise<CatalogMonitoringAlert[]> {
    return this.get("/v1/monitoring/alerts", { active });
  }

  openApiDocument(): Promise<Record<string, unknown>> {
    return this.get("/openapi.json");
  }

  private async get<T>(path: string, query?: object): Promise<T> {
    const url = new URL(path, `${this.baseUrl}/`);
    if (query) {
      for (const [key, value] of Object.entries(query)) {
        if (value !== undefined && value !== null && value !== "") {
          url.searchParams.set(key, String(value));
        }
      }
    }

    const response = await this.fetchImpl(url, {
      headers: { accept: "application/json" },
      signal: AbortSignal.timeout(this.timeoutMs),
    });
    const body = await readJson(response);
    if (!response.ok) {
      throw new CatalogApiError(response.status, `${url.pathname}${url.search}`, body);
    }
    return body as T;
  }
}

function normalizeBaseUrl(value: string): string {
  const parsed = new URL(value);
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    throw new Error("Catalog baseUrl must use http or https");
  }
  return parsed.toString().replace(/\/$/, "");
}

async function readJson(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}
