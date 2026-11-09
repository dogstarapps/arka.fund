import { afterEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { fixtureArkasPage } from "@/lib/catalog/testFixtures";

describe("GET /api/leaderboard/arkas", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.resetModules();
  });

  it("returns ranked Arkas ordered by catalog profit", async () => {
    const curatedPage = fixtureArkasPage({ curated: true, limit: 24 });
    const proxyCatalogRequest = vi.fn(async (request: Request, pathSegments: string[]) => {
      const path = pathSegments.join("/");
      if (path === "v1/arkas") {
        const url = new URL(request.url);
        expect(url.searchParams.get("curated")).toBe("true");
        expect(url.searchParams.get("limit")).toBe("24");
        expect(request.headers.get("x-vercel-protection-bypass")).toBe("preview-bypass");
        expect(request.headers.get("cookie")).toContain("_vercel_sso_nonce=test");
        return new Response(JSON.stringify(curatedPage), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      }
      throw new Error(`Unexpected path ${path}`);
    });
    vi.doMock("@/lib/catalog/proxy", () => ({ proxyCatalogRequest }));

    const { GET } = await import("@/app/api/leaderboard/arkas/route");
    const request = new NextRequest(
      "http://localhost/api/leaderboard/arkas?sortMetric=profit&sortOrder=desc&curatedOnly=true",
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
    expect(payload.page.items[0].arkaId).toContain("CA7BETA");
    expect(payload.page.items[0].rank).toBe(1);
    expect(payload.derivedMetrics[payload.page.items[0].arkaId].profit.source).toBe(
      "catalog",
    );
    expect(
      proxyCatalogRequest.mock.calls.some((call) =>
        call[1].join("/").includes("/activity"),
      ),
    ).toBe(false);
  });

  it("uses activity fallback metrics when profitBase is missing", async () => {
    const page = fixtureArkasPage({ curated: true, limit: 24 });
    const alpha = page.items[0];
    if (!alpha) throw new Error("Fixture data missing.");
    const withMissingProfit = {
      ...page,
      items: page.items.map((entry) =>
        entry.arkaId === alpha.arkaId ? { ...entry, profitBase: null } : entry,
      ),
    };

    const proxyCatalogRequest = vi.fn(async (_request: Request, pathSegments: string[]) => {
      const path = pathSegments.join("/");
      if (path === "v1/arkas") {
        return new Response(JSON.stringify(withMissingProfit), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      }
      if (path === `v1/arkas/${alpha.arkaId}/activity`) {
        return new Response(
          JSON.stringify({
            total: 1,
            offset: 0,
            limit: 60,
            items: [
              {
                eventId: "evt-alpha-profit",
                cursor: "evt-alpha-profit",
                arkaId: alpha.arkaId,
                manager: alpha.manager,
                kind: "profit",
                ledger: 1,
                ledgerClosedAt: "2026-04-16T00:00:00.000Z",
                txHash: "tx-alpha-profit",
                transactionIndex: 0,
                operationIndex: 0,
                inSuccessfulContractCall: true,
                user: null,
                assetContract: alpha.assets[0]?.assetContract ?? null,
                marketId: null,
                amount: "990000",
                shares: null,
                netOut: null,
                stepCount: null,
              },
            ],
          }),
          {
            status: 200,
            headers: { "content-type": "application/json" },
          },
        );
      }
      throw new Error(`Unexpected path ${path}`);
    });
    vi.doMock("@/lib/catalog/proxy", () => ({ proxyCatalogRequest }));

    const { GET } = await import("@/app/api/leaderboard/arkas/route");
    const request = new NextRequest(
      "http://localhost/api/leaderboard/arkas?sortMetric=profit&sortOrder=desc&curatedOnly=true",
    );
    const response = await GET(request);
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.ok).toBe(true);
    expect(payload.page.items[0].arkaId).toBe(alpha.arkaId);
    expect(payload.derivedMetrics[alpha.arkaId].profit.source).toBe("activity");
    expect(payload.derivedMetrics[alpha.arkaId].profit.value).toBe(990000);
  });
});
