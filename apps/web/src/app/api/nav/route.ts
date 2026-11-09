import { jsonNoStore } from "@/lib/server/apiHardening";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const NAV_CACHE_CONTROL = "public, max-age=0, s-maxage=30, stale-while-revalidate=60";
const PUBLIC_READ_ORIGIN = "*";

export async function GET(): Promise<Response> {
  const catalogBaseUrl = resolveCatalogApiBaseUrl();
  if (!catalogBaseUrl) {
    return unavailableResponse(503, "nav_api_not_configured");
  }

  try {
    const upstreamResponse = await fetch(new URL("/v1/nav", catalogBaseUrl), {
      headers: { accept: "application/json" },
      cache: "no-store",
    });
    if (!upstreamResponse.ok) {
      return unavailableResponse(upstreamResponse.status);
    }

    return new Response(await upstreamResponse.text(), {
      status: 200,
      headers: navCacheHeaders(upstreamResponse.headers.get("content-type")),
    });
  } catch {
    return unavailableResponse(503);
  }
}

function unavailableResponse(status: number, code = "nav_unavailable"): Response {
  return jsonNoStore(
    {
      error: code,
      message: "NAV data is temporarily unavailable. Please try again shortly.",
    },
    {
      status: status >= 400 && status <= 599 ? status : 503,
      headers: { "access-control-allow-origin": PUBLIC_READ_ORIGIN },
    },
  );
}

function navCacheHeaders(contentType: string | null): Headers {
  return new Headers({
    "content-type": contentType ?? "application/json; charset=utf-8",
    "cache-control": NAV_CACHE_CONTROL,
    "cdn-cache-control": NAV_CACHE_CONTROL,
    "vercel-cdn-cache-control": NAV_CACHE_CONTROL,
    "access-control-allow-origin": PUBLIC_READ_ORIGIN,
    "x-content-type-options": "nosniff",
    "referrer-policy": "no-referrer",
  });
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
