import { afterEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { fixtureManagersPage } from "@/lib/catalog/testFixtures";

describe("GET /api/leaderboard/managers", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.resetModules();
  });

  it("returns managers sorted by nav", async () => {
    const page = fixtureManagersPage({ limit: 24 });
    const proxyCatalogRequest = vi.fn(async (request: Request, pathSegments: string[]) => {
      const path = pathSegments.join("/");
      if (path === "v1/managers") {
        const url = new URL(request.url);
        expect(url.searchParams.get("limit")).toBe("24");
        expect(request.headers.get("x-vercel-protection-bypass")).toBe("preview-bypass");
        expect(request.headers.get("cookie")).toContain("_vercel_sso_nonce=test");
        return new Response(JSON.stringify(page), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      }
      throw new Error(`Unexpected path ${path}`);
    });
    vi.doMock("@/lib/catalog/proxy", () => ({ proxyCatalogRequest }));

    const { GET } = await import("@/app/api/leaderboard/managers/route");
    const request = new NextRequest(
      "http://localhost/api/leaderboard/managers?sortMetric=nav&sortOrder=desc",
      {
        headers: {
          cookie: "_vercel_sso_nonce=test",
          "x-vercel-protection-bypass": "preview-bypass",
        },
      },
    );
    const response = await GET(request);
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.ok).toBe(true);
    expect(payload.source).toBe("api_manager_leaderboard");
    expect(payload.page.items[0].manager).toContain("GCAALPHA");
    expect(payload.page.items[0].rank).toBe(1);
  });

  it("returns managers sorted by arka count", async () => {
    const page = fixtureManagersPage({ limit: 24 });
    const proxyCatalogRequest = vi.fn(async (_request: Request, pathSegments: string[]) => {
      const path = pathSegments.join("/");
      if (path === "v1/managers") {
        return new Response(JSON.stringify(page), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      }
      throw new Error(`Unexpected path ${path}`);
    });
    vi.doMock("@/lib/catalog/proxy", () => ({ proxyCatalogRequest }));

    const { GET } = await import("@/app/api/leaderboard/managers/route");
    const request = new NextRequest(
      "http://localhost/api/leaderboard/managers?sortMetric=arkas&sortOrder=desc",
    );
    const response = await GET(request);
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.ok).toBe(true);
    expect(payload.page.items[0].manager).toContain("GCAALPHA");
    expect(payload.page.items[0].rank).toBe(1);
  });
});
