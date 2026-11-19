import { afterEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

describe("GET /api/catalog/[...path] on-chain fallback", () => {
  const originalCatalogBaseUrl = process.env.CATALOG_API_BASE_URL;
  const originalPublicCatalogBaseUrl = process.env.NEXT_PUBLIC_CATALOG_API_BASE_URL;

  afterEach(() => {
    vi.restoreAllMocks();
    vi.resetModules();
    if (originalCatalogBaseUrl === undefined) {
      delete process.env.CATALOG_API_BASE_URL;
    } else {
      process.env.CATALOG_API_BASE_URL = originalCatalogBaseUrl;
    }
    if (originalPublicCatalogBaseUrl === undefined) {
      delete process.env.NEXT_PUBLIC_CATALOG_API_BASE_URL;
    } else {
      process.env.NEXT_PUBLIC_CATALOG_API_BASE_URL = originalPublicCatalogBaseUrl;
    }
  });

  it("uses the Soroban-backed catalog fallback when no catalog API URL is configured", async () => {
    delete process.env.CATALOG_API_BASE_URL;
    delete process.env.NEXT_PUBLIC_CATALOG_API_BASE_URL;
    const fallback = vi.fn(async () =>
      new Response(JSON.stringify({ total: 1, offset: 0, limit: 24, items: [] }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );
    vi.doMock("@/lib/catalog/onchainFallback", () => ({
      readOnchainCatalogResponse: fallback,
    }));
    const { GET } = await import("@/app/api/catalog/[...path]/route");

    const request = new NextRequest("http://localhost/api/catalog/v1/arkas?limit=24");
    const response = await GET(request, {
      params: Promise.resolve({ path: ["v1", "arkas"] }),
    });
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.total).toBe(1);
    expect(fallback).toHaveBeenCalledWith(request, ["v1", "arkas"]);
  });

  it("keeps proxying to the configured catalog API when an upstream URL exists", async () => {
    process.env.CATALOG_API_BASE_URL = "http://catalog.local/base";
    delete process.env.NEXT_PUBLIC_CATALOG_API_BASE_URL;
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = new URL(input.toString());
      expect(url.toString()).toBe("http://catalog.local/base/v1/arkas?limit=4");
      return new Response(JSON.stringify({ total: 0, offset: 0, limit: 4, items: [] }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    });
    vi.stubGlobal("fetch", fetchMock);
    const { GET } = await import("@/app/api/catalog/[...path]/route");

    const request = new NextRequest("http://localhost/api/catalog/v1/arkas?limit=4");
    const response = await GET(request, {
      params: Promise.resolve({ path: ["v1", "arkas"] }),
    });
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.limit).toBe(4);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("falls back to Soroban catalog when the configured upstream rejects the request", async () => {
    process.env.CATALOG_API_BASE_URL = "http://catalog.local/base";
    delete process.env.NEXT_PUBLIC_CATALOG_API_BASE_URL;
    const fetchMock = vi.fn(async () =>
      new Response(JSON.stringify({ message: "unauthorized" }), {
        status: 401,
        headers: { "content-type": "application/json" },
      }),
    );
    const fallback = vi.fn(async () =>
      new Response(JSON.stringify({ total: 2, offset: 0, limit: 24, items: [] }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);
    vi.doMock("@/lib/catalog/onchainFallback", () => ({
      readOnchainCatalogResponse: fallback,
    }));
    const { GET } = await import("@/app/api/catalog/[...path]/route");

    const request = new NextRequest("http://localhost/api/catalog/v1/arkas?limit=24");
    const response = await GET(request, {
      params: Promise.resolve({ path: ["v1", "arkas"] }),
    });
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(response.headers.get("x-arkafund-catalog-upstream-status")).toBe("401");
    expect(payload.total).toBe(2);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fallback).toHaveBeenCalledWith(request, ["v1", "arkas"]);
  });

  it("returns the Soroban fallback failure instead of leaking upstream 401 when both paths fail", async () => {
    process.env.CATALOG_API_BASE_URL = "http://catalog.local/base";
    delete process.env.NEXT_PUBLIC_CATALOG_API_BASE_URL;
    const fetchMock = vi.fn(async () =>
      new Response(JSON.stringify({ message: "unauthorized" }), {
        status: 401,
        headers: { "content-type": "application/json" },
      }),
    );
    const fallback = vi.fn(async () =>
      new Response(
        JSON.stringify({
          error: "catalog_onchain_fallback_failed",
          message: "Unable to read Arka registry from Soroban.",
        }),
        {
          status: 503,
          headers: { "content-type": "application/json" },
        },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);
    vi.doMock("@/lib/catalog/onchainFallback", () => ({
      readOnchainCatalogResponse: fallback,
    }));
    const { GET } = await import("@/app/api/catalog/[...path]/route");

    const request = new NextRequest("http://localhost/api/catalog/v1/arkas?limit=24");
    const response = await GET(request, {
      params: Promise.resolve({ path: ["v1", "arkas"] }),
    });
    const payload = await response.json();

    expect(response.status).toBe(503);
    expect(response.headers.get("x-arkafund-catalog-upstream-status")).toBe("401");
    expect(response.headers.get("x-arkafund-catalog-fallback-status")).toBe("503");
    expect(payload.error).toBe("catalog_onchain_fallback_failed");
    expect(payload.message).toBe("Unable to read Arka registry from Soroban.");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fallback).toHaveBeenCalledWith(request, ["v1", "arkas"]);
  });
});
