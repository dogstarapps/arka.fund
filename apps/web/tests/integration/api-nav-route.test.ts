import { afterEach, describe, expect, it, vi } from "vitest";

describe("GET /api/nav", () => {
  const originalCatalogBaseUrl = process.env.CATALOG_API_BASE_URL;
  const originalPublicCatalogBaseUrl = process.env.NEXT_PUBLIC_CATALOG_API_BASE_URL;

  afterEach(() => {
    vi.restoreAllMocks();
    vi.resetModules();
    restoreEnvironment("CATALOG_API_BASE_URL", originalCatalogBaseUrl);
    restoreEnvironment("NEXT_PUBLIC_CATALOG_API_BASE_URL", originalPublicCatalogBaseUrl);
  });

  it("serves aggregate NAV with bounded caching and public browser access", async () => {
    process.env.CATALOG_API_BASE_URL = "https://catalog.example.com/api";
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      expect(input.toString()).toBe("https://catalog.example.com/v1/nav");
      return new Response(JSON.stringify({ totalNav: "123" }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    });
    vi.stubGlobal("fetch", fetchMock);
    const { GET } = await import("@/app/api/nav/route");

    const response = await GET();

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ totalNav: "123" });
    expect(response.headers.get("cache-control")).toContain("s-maxage=30");
    expect(response.headers.get("cdn-cache-control")).toContain("s-maxage=30");
    expect(response.headers.get("access-control-allow-origin")).toBe("*");
    expect(response.headers.get("x-content-type-options")).toBe("nosniff");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("does not cache errors or expose upstream error bodies", async () => {
    process.env.CATALOG_API_BASE_URL = "https://catalog.example.com";
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("upstream internal details", { status: 502 })),
    );
    const { GET } = await import("@/app/api/nav/route");

    const response = await GET();
    const payload = await response.json();

    expect(response.status).toBe(502);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(response.headers.get("access-control-allow-origin")).toBe("*");
    expect(payload).toEqual({
      error: "nav_unavailable",
      message: "NAV data is temporarily unavailable. Please try again shortly.",
    });
  });

  it("fails closed with a public-safe response when no catalog origin is configured", async () => {
    delete process.env.CATALOG_API_BASE_URL;
    delete process.env.NEXT_PUBLIC_CATALOG_API_BASE_URL;
    const { GET } = await import("@/app/api/nav/route");

    const response = await GET();

    expect(response.status).toBe(503);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(response.headers.get("access-control-allow-origin")).toBe("*");
    expect(await response.json()).toEqual({
      error: "nav_api_not_configured",
      message: "NAV data is temporarily unavailable. Please try again shortly.",
    });
  });
});

function restoreEnvironment(name: string, value: string | undefined): void {
  if (value === undefined) {
    delete process.env[name];
  } else {
    process.env[name] = value;
  }
}
