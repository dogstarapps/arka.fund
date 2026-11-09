import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";

describe("readCatalogJsonForRoute", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.resetModules();
  });

  it("reads catalog data through the in-process proxy with query and headers preserved", async () => {
    const proxyCatalogRequest = vi.fn(async (request: Request, pathSegments: string[]) => {
      const url = new URL(request.url);
      expect(pathSegments).toEqual(["v1", "arkas"]);
      expect(url.searchParams.get("limit")).toBe("24");
      expect(request.headers.get("x-vercel-protection-bypass")).toBe("preview-bypass");
      expect(request.headers.get("cookie")).toContain("_vercel_sso_nonce=test");
      return new Response(JSON.stringify({ total: 1, offset: 0, limit: 24, items: [] }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    });
    vi.doMock("@/lib/catalog/proxy", () => ({ proxyCatalogRequest }));
    const { readCatalogJsonForRoute } = await import("@/lib/catalog/serverRouteClient");

    const request = new NextRequest("http://localhost/api/leaderboard/arkas", {
      headers: {
        cookie: "_vercel_sso_nonce=test",
        "x-vercel-protection-bypass": "preview-bypass",
      },
    });
    const payload = await readCatalogJsonForRoute<{
      total: number;
      items: unknown[];
    }>(request, "/v1/arkas", { limit: "24" });

    expect(payload.total).toBe(1);
    expect(payload.items).toEqual([]);
    expect(proxyCatalogRequest).toHaveBeenCalledTimes(1);
  });

  it("raises the proxied catalog error message without leaking a generic HTTP reentry failure", async () => {
    const proxyCatalogRequest = vi.fn(async () =>
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
    vi.doMock("@/lib/catalog/proxy", () => ({ proxyCatalogRequest }));
    const { readCatalogJsonForRoute } = await import("@/lib/catalog/serverRouteClient");
    const request = new NextRequest("http://localhost/api/leaderboard/arkas");

    await expect(
      readCatalogJsonForRoute(request, "/v1/arkas", { limit: "24" }),
    ).rejects.toThrow("Unable to read Arka registry from Soroban.");
  });
});
