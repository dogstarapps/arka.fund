import type { NextRequest } from "next/server";
import {
  jsonNoStore,
  noStoreHeaders,
  redactApiText,
} from "@/lib/server/apiHardening";
import { readOnchainCatalogResponse } from "./onchainFallback";

const CATALOG_REQUEST_TIMEOUT_MS = 10_000;
const CATALOG_UPSTREAM_FALLBACK_STATUSES = new Set([401, 403, 404, 500, 502, 503, 504]);

export async function proxyCatalogRequest(
  request: NextRequest,
  pathSegments: string[],
): Promise<Response> {
  // Explicit isolated release only: never fall back to a public RPC or fixtures.
  if (process.env.ARKA_MANAGED_REAL_READS === "1") {
    if (
      process.env.ARKA_MANAGED_PRODUCT_LOCAL !== "1" ||
      process.env.NEXT_PUBLIC_MANAGED_PRODUCT_LOCAL !== "1" ||
      process.env.ARKA_MANAGED_CATALOG_CANDIDATE !== "1" ||
      process.env.NEXT_PUBLIC_MANAGED_CATALOG_READ_ONLY !== "1" ||
      !/^127\.0\.0\.1:\d+$/.test(request.headers.get("host") ?? "") ||
      !process.env.ARKA_LOCAL_RUNTIME_TOKEN
    ) return jsonNoStore({error: "Not found."}, {status: 404});
    if (request.method !== "GET") return jsonNoStore({error: "Read-only candidate."}, {status: 405});
    if (pathSegments[0] !== "v1" || pathSegments.length > 6 || pathSegments.some(s => !/^[a-zA-Z0-9_-]{1,80}$/.test(s))) {
      return jsonNoStore({error: "Not found."}, {status: 404});
    }
    try {
      const upstream = new URL("http://127.0.0.1:3481/catalog-api/" + pathSegments.join("/"));
      upstream.search = request.nextUrl.search;
      const response = await fetch(upstream, {method: "GET", cache: "no-store", redirect: "error", signal: AbortSignal.timeout(25000), headers: {authorization: "Bearer " + process.env.ARKA_LOCAL_RUNTIME_TOKEN}});
      return new Response(await response.text(), {status: response.status, headers: noStoreHeaders({"content-type": "application/json", "x-arkafund-read-source": "standalone-rpc"})});
    } catch {
      return jsonNoStore({error: "real_catalog_unavailable", message: "Real local catalog unavailable. No holdings have been treated as zero."}, {status: 503});
    }
  }
  const generalReadOnly = process.env.NEXT_PUBLIC_MAINNET_GENERAL_READONLY === '1';
  if (generalReadOnly && request.method !== 'GET') return jsonNoStore({error:'Read-only catalog.'}, {status:405});
  const configuredBaseUrl = resolveCatalogApiBaseUrl();
  if (!configuredBaseUrl) {
    if (request.method !== "GET") {
      return jsonNoStore(
        {
          error: "catalog_api_not_configured",
          message: "Catalog API is required to save profile changes.",
        },
        { status: 503 },
      );
    }
    if (generalReadOnly) return jsonNoStore({error:'Verified catalog unavailable.'}, {status:503});
    return readOnchainCatalogResponse(request, pathSegments);
  }

  const upstreamBase = new URL(configuredBaseUrl);

  const upstreamUrl = new URL(upstreamBase);
  upstreamUrl.pathname = [
    upstreamUrl.pathname.replace(/\/+$/, ""),
    ...pathSegments.map((segment) => encodeURIComponent(segment)),
  ]
    .filter(Boolean)
    .join("/");

  request.nextUrl.searchParams.forEach((value, key) => {
    upstreamUrl.searchParams.append(key, value);
  });

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), CATALOG_REQUEST_TIMEOUT_MS);

  try {
    const requestBody = request.method === "GET" ? undefined : await request.text();
    const headers: Record<string, string> = { accept: "application/json" };
    const contentType = request.headers.get("content-type");
    if (contentType) {
      headers["content-type"] = contentType;
    }
    const upstreamResponse = await fetch(upstreamUrl, {
      method: request.method,
      headers,
      body: requestBody,
      cache: "no-store",
      signal: controller.signal,
    });
    if (
      request.method === "GET" && !generalReadOnly &&
      CATALOG_UPSTREAM_FALLBACK_STATUSES.has(upstreamResponse.status)
    ) {
      const fallbackResponse = await readOnchainCatalogResponse(request, pathSegments);
      fallbackResponse.headers.set(
        "x-arkafund-catalog-upstream-status",
        String(upstreamResponse.status),
      );
      fallbackResponse.headers.set(
        "x-arkafund-catalog-fallback-status",
        String(fallbackResponse.status),
      );
      return fallbackResponse;
    }
    const body = await upstreamResponse.text();
    return new Response(body, {
      status: upstreamResponse.status,
      headers: noStoreHeaders({
        "content-type":
          upstreamResponse.headers.get("content-type") ?? "application/json; charset=utf-8",
      }),
    });
  } catch (error) {
    if (request.method !== "GET" || generalReadOnly) {
      return jsonNoStore(
        {
          error: "catalog_unavailable",
          message: redactApiText(error, "Catalog API is unavailable."),
        },
        { status: 503 },
      );
    }
    const fallbackResponse = await readOnchainCatalogResponse(request, pathSegments);
    if (fallbackResponse.ok) {
      fallbackResponse.headers.set("x-arkafund-catalog-upstream-status", "network_error");
      return fallbackResponse;
    }
    return jsonNoStore(
      {
        error: "catalog_unavailable",
        message: redactApiText(error, "Catalog API is unavailable."),
      },
      { status: 503 },
    );
  } finally {
    clearTimeout(timeout);
  }
}

function resolveCatalogApiBaseUrl(): string | null {
  const configuredBaseUrl =
    process.env.CATALOG_API_BASE_URL ?? process.env.NEXT_PUBLIC_CATALOG_API_BASE_URL;
  if (!configuredBaseUrl) {
    return null;
  }
  return configuredBaseUrl.endsWith("/")
    ? configuredBaseUrl.slice(0, -1)
    : configuredBaseUrl;
}
