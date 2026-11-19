import { describe, expect, it, vi } from "vitest";
import {
  buildCatalogHealthUrl,
  readCatalogHealth,
  resolveCatalogApiBaseUrl,
} from "@/lib/runtime/health";
import {
  buildBalancedFallbackPayload,
  normalizeProtocolSupportStatus,
  readAppHealthSnapshot,
} from "@/lib/runtime/appHealth";

describe("runtime health helpers", () => {
  it("resolves the catalog base URL from runtime env", () => {
    expect(resolveCatalogApiBaseUrl({ CATALOG_API_BASE_URL: "http://catalog:3100/" } as unknown as NodeJS.ProcessEnv)).toBe(
      "http://catalog:3100",
    );
    expect(
      resolveCatalogApiBaseUrl({
        NEXT_PUBLIC_CATALOG_API_BASE_URL: "https://catalog.example.com/api",
      } as unknown as NodeJS.ProcessEnv),
    ).toBe("https://catalog.example.com/api");
    expect(resolveCatalogApiBaseUrl({} as unknown as NodeJS.ProcessEnv)).toBeNull();
  });

  it("builds the upstream health URL", () => {
    expect(buildCatalogHealthUrl("http://catalog:3100")).toBe("http://catalog:3100/health");
    expect(buildCatalogHealthUrl("https://catalog.example.com/base/")).toBe(
      "https://catalog.example.com/base/health",
    );
  });

  it("reads a healthy upstream response", async () => {
    const fetchMock = vi.fn(async () =>
      new Response(
        JSON.stringify({
          healthy: true,
          degraded: false,
          evaluatedAt: "2026-03-28T22:00:00.000Z",
        }),
        {
          status: 200,
          headers: { "content-type": "application/json" },
        },
      ),
    );

    await expect(readCatalogHealth("http://catalog:3100", fetchMock as typeof fetch)).resolves.toEqual({
      healthy: true,
      degraded: false,
      evaluatedAt: "2026-03-28T22:00:00.000Z",
      statusCode: 200,
      reachable: true,
      error: null,
    });
  });

  it("reports upstream failures without throwing", async () => {
    const fetchMock = vi.fn(async () => {
      throw new Error("connect ECONNREFUSED");
    });

    await expect(readCatalogHealth("http://catalog:3100", fetchMock as typeof fetch)).resolves.toMatchObject({
      healthy: false,
      reachable: false,
      statusCode: 0,
      error: "connect ECONNREFUSED",
    });
  });

  it("normalizes client app-health payloads", async () => {
    expect(normalizeProtocolSupportStatus("ready")).toBe("ready");
    expect(normalizeProtocolSupportStatus("inactive")).toBe("inactive");
    expect(normalizeProtocolSupportStatus("legacy")).toBe("blocked");
    expect(buildBalancedFallbackPayload({ supportStatus: "weird" }).supportStatus).toBe(
      "blocked",
    );

    const fetchMock = vi.fn(async () =>
      new Response(
        JSON.stringify({
          app: "ok",
          catalog: {
            configured: true,
            reachable: true,
            healthy: true,
            degraded: false,
            statusCode: 200,
            evaluatedAt: "2026-03-30T10:00:00.000Z",
          },
          protocols: {
            balanced: {
              supportStatus: "blocked",
              laneMode: "legacy_comet",
              officialSurface: {
                officialSources: {
                  app: "https://app.balanced.network",
                  bundle: "https://app.balanced.network/assets/index.js",
                },
                topology: "intent_based",
                swapModel: "sodax_intents",
                liquidityModel: "legacy_exchange_only",
                intentAdapter: {
                  quoteProvider: "sodax",
                  quoteVisibleInApp: true,
                  quoteComparableForArka: false,
                  publicQuoteEndpoint: null,
                  statusSurface: "recent_activity",
                  publicStatusEndpoint: null,
                  publicReceiptEndpoint: null,
                  cancellationWindowSeconds: 300,
                },
                supportsPublicStellarTestnet: false,
                canonicalRouterCutoverPossible: false,
                findings: ["No public router contract id found."],
              },
              expectedRouter: null,
              validatedModule: {
                present: false,
              },
            },
          },
        }),
        {
          status: 200,
          headers: { "content-type": "application/json" },
        },
      ),
    );

    await expect(readAppHealthSnapshot(fetchMock as typeof fetch)).resolves.toMatchObject({
      app: "ok",
      protocols: {
          balanced: {
            supportStatus: "blocked",
            laneMode: "legacy_comet",
            intentVenue: {
              quoteState: "limited",
              plannerAdmission: "blocked",
              manualExecutionEligible: false,
            },
            officialSurface: {
              officialSources: {
                app: "https://app.balanced.network",
              },
              topology: "intent_based",
              swapModel: "sodax_intents",
              liquidityModel: "legacy_exchange_only",
              intentAdapter: {
                quoteProvider: "sodax",
                quoteVisibleInApp: true,
                quoteComparableForArka: false,
                statusSurface: "recent_activity",
                cancellationWindowSeconds: 300,
              },
              canonicalRouterCutoverPossible: false,
            },
            source: "fallback",
            validatedModule: {
              present: false,
            },
          },
        },
      routing: {
        mode: "backend_solver_with_local_fallback",
        planEndpoint: "/api/routing/rebalance/plan",
        fallbackMode: "local_workflow_solver",
        backendAvailable: false,
        balancedPlannerAdmission: "blocked",
        balancedSupportStatus: "blocked",
        balancedLaneMode: "undeclared",
        balancedAutoSurfaceReady: false,
      },
      releaseGate: {
        balancedAutoSurface: {
          status: "unknown",
          code: "snapshot_missing",
        },
      },
    });
  });
});
