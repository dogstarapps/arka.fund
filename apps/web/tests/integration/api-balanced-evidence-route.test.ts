import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  readBalancedProtocolHealth: vi.fn(async () => ({
    validatedAt: "2026-05-20T10:00:00.000Z",
    adapterBalanced: "CBALANCED",
    poolId: 3,
    supportStatus: "ready" as const,
    readyForDappExecution: true,
    laneMode: "expected_router",
    blockingReasons: [],
    observedRouter: null,
    expectedRouter: null,
    poolSupported: true,
    pairConfigured: true,
    validatedModule: {
      present: true,
      validatedAt: "2026-05-20T10:00:00.000Z",
      router: null,
      poolId: 3,
      sourceValidations: ["balancedOfficialSurface"],
      source: "deployments" as const,
    },
    officialSurface: {
      validatedAt: "2026-05-20T10:00:00.000Z",
      officialSources: {
        app: "https://app.balanced.network",
        bundle: "https://app.balanced.network/assets/index.js",
        stellarPage: "https://balanced.network/stellar/",
        swapDocs: "https://docs.sodax.com/developers/packages",
        tradeBlog: "https://blog.balanced.network/trade-cross-chain/",
        q3Blog: "https://blog.balanced.network/q3-2025/",
      },
      topology: "intent_based" as const,
      swapModel: "sodax_intents" as const,
      liquidityModel: "legacy_exchange_only" as const,
      publicRouterContractId: null,
      supportsPublicStellarTestnet: false,
      canonicalRouterCutoverPossible: false,
      intentAdapter: {
        quoteProvider: "sodax" as const,
        quoteVisibleInApp: true,
        quoteComparableForArka: true,
        publicQuoteEndpoint: "sdk:@sodax/sdk::swaps.getQuote",
        publicBuildEndpoint: "sdk:@sodax/sdk::swaps.createIntent",
        publicRelayEndpoint: "sdk:@sodax/sdk::swaps.submitIntent",
        publicSubmitEndpoint: "sdk:@sodax/sdk::swaps.postExecution",
        statusSurface: "recent_activity" as const,
        publicStatusEndpoint: "sdk:@sodax/sdk::swaps.getStatus",
        publicReceiptEndpoint: "sdk:@sodax/sdk::swaps.getSolvedIntentPacket",
        publicExpiryEndpoint: "sdk:@sodax/sdk::swaps.getIntent",
        publicRefundEndpoint: "sdk:@sodax/sdk::swaps.cancelIntent",
        cancellationWindowSeconds: 300,
      },
      stellarMainnetAddresses: {
        connection: null,
        assetManager: null,
        xTokenManager: null,
        rateLimit: null,
      },
      findings: [],
      source: "deployments" as const,
    },
    intentVenue: {
      discoveryState: "available" as const,
      discoveryModel: "official_runtime_snapshot" as const,
      quoteState: "available" as const,
      quoteModel: "public_quote_surface" as const,
      comparableQuote: true,
      executeState: "available" as const,
      executeModel: "adapter_gated_manual" as const,
      confirmModel: "transaction_hash_plus_refresh" as const,
      autoRoutingEligible: true,
      manualExecutionEligible: true,
      plannerAdmission: "auto" as const,
      notes: ["Official SODAX evidence ready."],
    },
    source: "deployments" as const,
  })),
}));

vi.mock("@/lib/runtime/protocolSupport", () => ({
  readBalancedProtocolHealth: mocks.readBalancedProtocolHealth,
}));

describe("GET /api/intents/balanced/evidence", () => {
  it("returns machine-consumable official SODAX evidence and AUTO readiness", async () => {
    const { GET } = await import("@/app/api/intents/balanced/evidence/route");
    const response = await GET();
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.provider).toBe("sodax_sdk");
    expect(payload.architecture).toBe("intent_interchain");
    expect(payload.evidence.verified).toBe(true);
    expect(payload.evidence.readyForAuto).toBe(true);
    expect(payload.evidence.checks.noPublicRouterContractId).toBe(true);
    expect(payload.evidence.endpoints).toEqual({
      quote: "sdk:@sodax/sdk::swaps.getQuote",
      build: "sdk:@sodax/sdk::swaps.createIntent",
      relay: "sdk:@sodax/sdk::swaps.submitIntent",
      submit: "sdk:@sodax/sdk::swaps.postExecution",
      status: "sdk:@sodax/sdk::swaps.getStatus",
      receipt: "sdk:@sodax/sdk::swaps.getSolvedIntentPacket",
      expiry: "sdk:@sodax/sdk::swaps.getIntent",
      refund: "sdk:@sodax/sdk::swaps.cancelIntent",
    });
    expect(payload.evidence.machineConsumableActions).toHaveLength(8);
    expect(payload.autoSurface).toMatchObject({
      plannerAdmission: "auto",
      laneReady: true,
      surfaceReady: true,
      officialEvidenceReady: true,
      officialAutoComparable: true,
      autoReady: true,
    });
  });
});
