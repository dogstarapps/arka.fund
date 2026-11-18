const DAPP_HEALTH_TIMEOUT_MS = 4_000;

export interface CatalogHealthSnapshot {
  healthy: boolean;
  degraded: boolean;
  evaluatedAt: string | null;
  statusCode: number;
  reachable: boolean;
  error: string | null;
}

export function resolveCatalogApiBaseUrl(
  env: NodeJS.ProcessEnv = process.env,
): string | null {
  const configured =
    env.CATALOG_API_BASE_URL ?? env.NEXT_PUBLIC_CATALOG_API_BASE_URL ?? null;
  if (!configured) {
    return null;
  }
  return configured.endsWith("/") ? configured.slice(0, -1) : configured;
}

export function buildCatalogHealthUrl(baseUrl: string): string {
  const resolved = new URL(baseUrl);
  resolved.pathname = [resolved.pathname.replace(/\/+$/, ""), "health"]
    .filter(Boolean)
    .join("/");
  return resolved.toString();
}

export async function readCatalogHealth(
  baseUrl: string,
  fetchImpl: typeof fetch = fetch,
): Promise<CatalogHealthSnapshot> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), DAPP_HEALTH_TIMEOUT_MS);
  try {
    const response = await fetchImpl(buildCatalogHealthUrl(baseUrl), {
      method: "GET",
      headers: { accept: "application/json" },
      cache: "no-store",
      signal: controller.signal,
    });

    let body: unknown = null;
    try {
      body = await response.json();
    } catch {
      body = null;
    }

    return {
      healthy: response.ok && isTruthyBoolean(body, "healthy"),
      degraded: isTruthyBoolean(body, "degraded"),
      evaluatedAt: readNullableString(body, "evaluatedAt"),
      statusCode: response.status,
      reachable: true,
      error:
        response.ok || response.status === 503
          ? null
          : `Catalog upstream returned HTTP ${response.status}`,
    };
  } catch (error) {
    return {
      healthy: false,
      degraded: false,
      evaluatedAt: null,
      statusCode: 0,
      reachable: false,
      error: describeError(error),
    };
  } finally {
    clearTimeout(timeout);
  }
}

function isTruthyBoolean(body: unknown, key: string): boolean {
  if (!body || typeof body !== "object" || !(key in body)) {
    return false;
  }
  return Boolean((body as Record<string, unknown>)[key]);
}

function readNullableString(body: unknown, key: string): string | null {
  if (!body || typeof body !== "object" || !(key in body)) {
    return null;
  }
  const value = (body as Record<string, unknown>)[key];
  return typeof value === "string" ? value : null;
}

function describeError(error: unknown): string {
  if (error instanceof Error && error.message) {
    return error.message;
  }
  if (typeof error === "string" && error.trim().length > 0) {
    return error;
  }
  return "Catalog health probe failed.";
}
