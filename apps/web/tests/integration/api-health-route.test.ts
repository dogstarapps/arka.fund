import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, describe, expect, it, vi } from "vitest";

const MAINNET_REFLECTOR_DEX =
  "CALI2BYU2JE6WVRUFYTS6MSBNEHGJ35P4AVCZYF3B6QOE3QKOB2PLE6M";
const MAINNET_REFLECTOR_EXTERNAL =
  "CAFJZQWSED6YAWZU3GWRTOCNPPCGBN32L7QV43XX5LZLFTK6JLN34DLN";

describe("GET /api/health", () => {
  const originalCatalogBaseUrl = process.env.CATALOG_API_BASE_URL;
  const originalPublicCatalogBaseUrl = process.env.NEXT_PUBLIC_CATALOG_API_BASE_URL;
  const originalDeployPath = process.env.ARKAFUND_DEPLOYMENTS_PATH;
  const originalNetworkTarget = process.env.ARKAFUND_NETWORK_TARGET;
  let tempDir: string | null = null;

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
    if (originalDeployPath === undefined) {
      delete process.env.ARKAFUND_DEPLOYMENTS_PATH;
    } else {
      process.env.ARKAFUND_DEPLOYMENTS_PATH = originalDeployPath;
    }
    if (originalNetworkTarget === undefined) {
      delete process.env.ARKAFUND_NETWORK_TARGET;
    } else {
      process.env.ARKAFUND_NETWORK_TARGET = originalNetworkTarget;
    }
    if (tempDir) {
      rmSync(tempDir, { recursive: true, force: true });
      tempDir = null;
    }
  });

  function writeDeployments(payload: unknown): string {
    tempDir = mkdtempSync(join(tmpdir(), "arkafund-dapp-health-"));
    const deployPath = join(tempDir, "deployments.testnet.json");
    writeFileSync(deployPath, JSON.stringify(payload), "utf8");
    return deployPath;
  }

  it("loads bundled testnet deployment and oracle provenance by default", async () => {
    process.env.CATALOG_API_BASE_URL = "http://catalog:3100";
    delete process.env.ARKAFUND_DEPLOYMENTS_PATH;
    process.env.ARKAFUND_NETWORK_TARGET = "testnet";
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(
          JSON.stringify({
            healthy: true,
            degraded: false,
            evaluatedAt: "2026-04-23T10:00:00.000Z",
          }),
          {
            status: 200,
            headers: { "content-type": "application/json" },
          },
        ),
      ),
    );
    const { GET } = await import("@/app/api/health/route");

    const response = await GET();
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(payload.oracle.source).toBe("deployments");
    expect(payload.oracle.oracle.mode).toBe("oracle_guard");
    expect(payload.oracle.oracle.provider).toBe("test-oracle");
    expect(payload.oracle.deployment.targetNetwork).toBe("testnet");
    expect(payload.oracle.deployment.pathSource).toBe("bundled_testnet");
    expect(payload.oracle.deployment.fileFound).toBe(true);
    expect(payload.oracle.deployment.networkMismatch).toBe(false);
    expect(payload.releaseGate.oracleCutover.status).toBe("not_required");
    expect(payload.releaseGate.balancedAutoSurface.status).toBe("not_required");
  });

  it("uses the on-chain catalog fallback when the catalog base URL is missing", async () => {
    delete process.env.CATALOG_API_BASE_URL;
    delete process.env.NEXT_PUBLIC_CATALOG_API_BASE_URL;
    process.env.ARKAFUND_DEPLOYMENTS_PATH = writeDeployments({
      validatedModules: {},
      validations: {
        balancedOfficialSurface: {
          officialSources: {
            app: "https://app.balanced.network",
            bundle: "https://app.balanced.network/assets/index.js",
            stellarPage: "https://balanced.network/stellar/",
            swapDocs: "https://docs.balanced.network/swap-assets",
            tradeBlog: "https://blog.balanced.network/trade-cross-chain/",
            q3Blog: "https://blog.balanced.network/q3-2025/",
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
        balancedReadiness: {
          supportStatus: "blocked",
          laneMode: "legacy_comet",
          adapterBalanced: "CBALANCED",
          poolId: 1,
        },
      },
    });
    vi.doMock("@/lib/catalog/onchainFallback", () => ({
      readOnchainCatalogSnapshot: vi.fn(async () => ({
        source: "onchain_fallback",
        syncedAt: "2026-04-23T10:00:00.000Z",
        arkas: [{ arkaId: "CARKA" }],
        managers: [],
        assets: [],
        failures: [],
      })),
    }));
    const { GET } = await import("@/app/api/health/route");

    const response = await GET();
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.catalog.configured).toBe(false);
    expect(payload.catalog.source).toBe("onchain_fallback");
    expect(payload.catalog.reachable).toBe(true);
    expect(payload.catalog.healthy).toBe(true);
    expect(payload.catalog.indexedArkas).toBe(1);
    expect(payload.protocols.balanced.supportStatus).toBe("blocked");
    expect(payload.protocols.balanced.intentVenue.plannerAdmission).toBe("blocked");
    expect(payload.protocols.balanced.intentVenue.quoteModel).toBe(
      "manual_only",
    );
    expect(payload.protocols.balanced.officialSurface.intentAdapter.statusSurface).toBe(
      "recent_activity",
    );
    expect(payload.protocols.balanced.officialSurface.officialSources.app).toBe(
      "https://app.balanced.network",
    );
    expect(payload.protocols.balanced.officialSurface.swapModel).toBe("sodax_intents");
    expect(payload.protocols.balanced.officialSurface.canonicalRouterCutoverPossible).toBe(false);
    expect(payload.protocols.balanced.validatedModule.present).toBe(false);
    expect(payload.routing.mode).toBe("backend_solver_with_local_fallback");
    expect(payload.routing.planEndpoint).toBe("/api/routing/rebalance/plan");
    expect(payload.routing.backendAvailable).toBe(true);
    expect(payload.routing.balancedPlannerAdmission).toBe("blocked");
    expect(payload.oracle.oracle.mode).toBe("unverified");
    expect(payload.oracle.deployment.targetNetwork).toBe("testnet");
    expect(payload.oracle.deployment.fileFound).toBe(true);
    expect(payload.oracle.deployment.networkMismatch).toBe(false);
    expect(payload.releaseGate.oracleCutover.status).toBe("not_required");
    expect(payload.releaseGate.oracleCutover.code).toBe("not_required");
    expect(payload.releaseGate.oracleCutover.ready).toBe(true);
    expect(payload.releaseGate.balancedAutoSurface.status).toBe("not_required");
    expect(payload.releaseGate.balancedAutoSurface.code).toBe("not_required");
    expect(payload.releaseGate.balancedAutoSurface.ready).toBe(true);
  });

  it("returns 200 when the catalog upstream is healthy", async () => {
    process.env.CATALOG_API_BASE_URL = "http://catalog:3100";
    process.env.ARKAFUND_DEPLOYMENTS_PATH = writeDeployments({
      validatedModules: {
        balancedExecution: {
          validatedAt: "2026-03-30",
          sourceValidations: ["balancedReadiness"],
          contracts: {
            router: "CROUTER",
          },
          checks: {
            poolId: 1,
          },
        },
      },
      validations: {
        balancedOfficialSurface: {
          validatedAt: "2026-04-07",
          officialSources: {
            app: "https://app.balanced.network",
            bundle: "https://app.balanced.network/assets/index.js",
            stellarPage: "https://balanced.network/stellar/",
            swapDocs: "https://docs.balanced.network/swap-assets",
            tradeBlog: "https://blog.balanced.network/trade-cross-chain/",
            q3Blog: "https://blog.balanced.network/q3-2025/",
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
          stellarMainnetAddresses: {
            connection: "CCONNECTION",
            assetManager: "CASSET",
            xTokenManager: null,
            rateLimit: "CRATELIMIT",
          },
          findings: ["No public router contract id found."],
        },
        balancedReadiness: {
          supportStatus: "ready",
          readyForDappExecution: true,
          laneMode: "expected_router",
          adapterBalanced: "CBALANCED",
          poolId: 1,
          expectedRouter: "CROUTER",
        },
      },
    });
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
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
      ),
    );
    const { GET } = await import("@/app/api/health/route");

    const response = await GET();
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.catalog.configured).toBe(true);
    expect(payload.catalog.healthy).toBe(true);
    expect(payload.catalog.baseUrl).toBe("[redacted]");
    expect(payload.catalog.baseUrlConfigured).toBe(true);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(JSON.stringify(payload)).not.toContain("http://catalog:3100");
    expect(payload.protocols.balanced.supportStatus).toBe("ready");
    expect(payload.protocols.balanced.expectedRouter).toBe("CROUTER");
    expect(payload.protocols.balanced.intentVenue.manualExecutionEligible).toBe(true);
    expect(payload.protocols.balanced.intentVenue.plannerAdmission).toBe(
      "manual_only",
    );
    expect(payload.protocols.balanced.validatedModule.present).toBe(true);
    expect(payload.protocols.balanced.validatedModule.router).toBe("CROUTER");
    expect(payload.protocols.balanced.officialSurface.topology).toBe("intent_based");
    expect(payload.protocols.balanced.officialSurface.officialSources.bundle).toBe(
      "https://app.balanced.network/assets/index.js",
    );
    expect(payload.protocols.balanced.officialSurface.intentAdapter.quoteVisibleInApp).toBe(true);
    expect(payload.protocols.balanced.officialSurface.stellarMainnetAddresses.connection).toBe("CCONNECTION");
    expect(payload.routing.mode).toBe("backend_solver_with_local_fallback");
    expect(payload.routing.planEndpoint).toBe("/api/routing/rebalance/plan");
    expect(payload.routing.backendAvailable).toBe(true);
    expect(payload.routing.balancedPlannerAdmission).toBe("manual_only");
    expect(payload.oracle.oracle.mode).toBe("unverified");
    expect(payload.oracle.deployment.fileFound).toBe(true);
    expect(payload.releaseGate.oracleCutover.status).toBe("not_required");
    expect(payload.releaseGate.oracleCutover.code).toBe("not_required");
    expect(payload.releaseGate.balancedAutoSurface.status).toBe("not_required");
    expect(payload.releaseGate.balancedAutoSurface.code).toBe("not_required");
  });

  it("derives a ready canonical lane when validated module is present but readiness payload is missing", async () => {
    process.env.CATALOG_API_BASE_URL = "http://catalog:3100";
    process.env.ARKAFUND_DEPLOYMENTS_PATH = writeDeployments({
      validatedModules: {
        balancedExecution: {
          validatedAt: "2026-04-16",
          sourceValidations: ["balancedReadiness"],
          contracts: {
            adapterBalanced: "CBALANCEDCANONICAL",
            router: "CROUTERCANONICAL",
          },
          checks: {
            poolId: 4,
          },
        },
      },
      validations: {
        balancedOfficialSurface: {
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
        },
      },
    });
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(
          JSON.stringify({
            healthy: true,
            degraded: false,
            evaluatedAt: "2026-04-16T07:00:00.000Z",
          }),
          {
            status: 200,
            headers: { "content-type": "application/json" },
          },
        ),
      ),
    );
    const { GET } = await import("@/app/api/health/route");

    const response = await GET();
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.protocols.balanced.supportStatus).toBe("ready");
    expect(payload.protocols.balanced.readyForDappExecution).toBe(true);
    expect(payload.protocols.balanced.laneMode).toBe("expected_router");
    expect(payload.protocols.balanced.adapterBalanced).toBe("CBALANCEDCANONICAL");
    expect(payload.protocols.balanced.expectedRouter).toBe("CROUTERCANONICAL");
    expect(payload.protocols.balanced.observedRouter).toBe("CROUTERCANONICAL");
    expect(payload.protocols.balanced.poolId).toBe(4);
    expect(payload.protocols.balanced.poolSupported).toBe(true);
    expect(payload.protocols.balanced.pairConfigured).toBe(true);
    expect(payload.protocols.balanced.validatedModule.present).toBe(true);
    expect(payload.routing.mode).toBe("backend_solver_with_local_fallback");
    expect(payload.routing.balancedPlannerAdmission).toBe("manual_only");
    expect(payload.oracle.oracle.mode).toBe("unverified");
    expect(payload.oracle.deployment.fileFound).toBe(true);
    expect(payload.releaseGate.oracleCutover.status).toBe("not_required");
    expect(payload.releaseGate.balancedAutoSurface.status).toBe("not_required");
  });

  it("reports ready oracle cutover from the bundled mainnet manifest after OracleGuard deployment", async () => {
    process.env.CATALOG_API_BASE_URL = "http://catalog:3100";
    delete process.env.ARKAFUND_DEPLOYMENTS_PATH;
    process.env.ARKAFUND_NETWORK_TARGET = "mainnet";
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(
          JSON.stringify({
            healthy: true,
            degraded: false,
            evaluatedAt: "2026-04-16T07:00:00.000Z",
          }),
          {
            status: 200,
            headers: { "content-type": "application/json" },
          },
        ),
      ),
    );
    const { GET } = await import("@/app/api/health/route");

    const response = await GET();
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.oracle.oracle.mode).toBe("oracle_guard");
    expect(payload.oracle.oracle.provider).toBe("Reflector Network");
    expect(payload.oracle.oracle.primaryOracle).toBe(MAINNET_REFLECTOR_DEX);
    expect(payload.oracle.oracle.secondaryOracle).toBe(MAINNET_REFLECTOR_EXTERNAL);
    expect(payload.oracle.deployment.targetNetwork).toBe("mainnet");
    expect(payload.oracle.deployment.pathSource).toBe("bundled_mainnet");
    expect(payload.oracle.deployment.fileFound).toBe(true);
    expect(payload.routing.mode).toBe("backend_solver_with_local_fallback");
    expect(payload.routing.balancedPlannerAdmission).toBe("auto");
    expect(payload.oracle.deployment.deploymentsPath).toContain(
      "/config/deployments.mainnet.json",
    );
    expect(payload.releaseGate.oracleCutover.status).toBe("ready");
    expect(payload.releaseGate.oracleCutover.code).toBe("ready");
    expect(payload.releaseGate.oracleCutover.ready).toBe(true);
    expect(payload.releaseGate.oracleCutover.checks.providersVerified).toBe(true);
    expect(payload.releaseGate.oracleCutover.checks.noTestnetProviderFallback).toBe(
      true,
    );
    expect(payload.releaseGate.balancedAutoSurface.status).toBe("ready");
  });

  it("reports blocked oracle cutover when runtime target is mainnet and oracle validation network mismatches", async () => {
    process.env.CATALOG_API_BASE_URL = "http://catalog:3100";
    process.env.ARKAFUND_NETWORK_TARGET = "mainnet";
    process.env.ARKAFUND_DEPLOYMENTS_PATH = writeDeployments({
      validations: {
        oracleGuard: {
          validatedAt: "2026-04-16",
          network: "testnet",
          provider: "Reflector Network",
          providers: {
            primary: "Reflector DEX Oracle",
            secondary: "Reflector External CEX/DEX Oracle",
          },
          contracts: {
            oracleGuard: "CORACLEGUARD",
            primaryOracle: MAINNET_REFLECTOR_DEX,
            secondaryOracle: MAINNET_REFLECTOR_EXTERNAL,
            validationAsset: "native:XLM",
          },
          thresholds: {
            maxOracleAgeSeconds: 300,
            maxDivergenceBps: 100,
            minProviderCount: 2,
          },
        },
      },
    });
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(
          JSON.stringify({
            healthy: true,
            degraded: false,
            evaluatedAt: "2026-04-16T07:00:00.000Z",
          }),
          {
            status: 200,
            headers: { "content-type": "application/json" },
          },
        ),
      ),
    );
    const { GET } = await import("@/app/api/health/route");

    const response = await GET();
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.oracle.deployment.targetNetwork).toBe("mainnet");
    expect(payload.oracle.deployment.fileFound).toBe(true);
    expect(payload.oracle.deployment.networkMismatch).toBe(true);
    expect(payload.oracle.oracle.mode).toBe("unverified");
    expect(payload.releaseGate.oracleCutover.status).toBe("blocked");
    expect(payload.releaseGate.oracleCutover.code).toBe("network_mismatch");
    expect(payload.releaseGate.oracleCutover.ready).toBe(false);
    expect(payload.releaseGate.balancedAutoSurface.status).toBe("blocked");
  });

  it("reports ready oracle cutover when runtime target is mainnet and oracle guard is fully validated", async () => {
    process.env.CATALOG_API_BASE_URL = "http://catalog:3100";
    process.env.ARKAFUND_NETWORK_TARGET = "mainnet";
    process.env.ARKAFUND_DEPLOYMENTS_PATH = writeDeployments({
      validations: {
        oracleGuard: {
          validatedAt: "2026-04-16",
          network: "mainnet",
          provider: "Reflector Network",
          providers: {
            primary: "Reflector DEX Oracle",
            secondary: "Reflector External CEX/DEX Oracle",
          },
          contracts: {
            oracleGuard: "CORACLEGUARD",
            primaryOracle: MAINNET_REFLECTOR_DEX,
            secondaryOracle: MAINNET_REFLECTOR_EXTERNAL,
            validationAsset: "native:XLM",
          },
          thresholds: {
            maxOracleAgeSeconds: 300,
            maxDivergenceBps: 100,
            minProviderCount: 2,
          },
        },
      },
    });
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(
          JSON.stringify({
            healthy: true,
            degraded: false,
            evaluatedAt: "2026-04-16T07:00:00.000Z",
          }),
          {
            status: 200,
            headers: { "content-type": "application/json" },
          },
        ),
      ),
    );
    const { GET } = await import("@/app/api/health/route");

    const response = await GET();
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.oracle.deployment.targetNetwork).toBe("mainnet");
    expect(payload.oracle.deployment.fileFound).toBe(true);
    expect(payload.oracle.deployment.networkMismatch).toBe(false);
    expect(payload.oracle.oracle.mode).toBe("oracle_guard");
    expect(payload.releaseGate.oracleCutover.status).toBe("ready");
    expect(payload.releaseGate.oracleCutover.code).toBe("ready");
    expect(payload.releaseGate.oracleCutover.ready).toBe(true);
    expect(payload.releaseGate.balancedAutoSurface.status).toBe("blocked");
  });
});
