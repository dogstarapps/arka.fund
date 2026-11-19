import { afterEach, describe, expect, it, vi } from "vitest";
import { buildBalancedFallbackPayload } from "@/lib/runtime/appHealth";
import type { BalancedSodaxQuoteResult } from "@/lib/server/balancedSodax";
import type { RebalanceRouteReaders } from "@/lib/workflows/rebalanceRouting";

const mocks = vi.hoisted(() => ({
  readSoroswapAmountOut: vi.fn<RebalanceRouteReaders["readSoroswapAmountOut"]>(
    async () => 9_500_000,
  ),
  readSoroswapAmountOutForPath: vi.fn<NonNullable<RebalanceRouteReaders["readSoroswapAmountOutForPath"]>>(
    async () => 11_000_000,
  ),
  readAquariusPoolIndex: vi.fn<RebalanceRouteReaders["readAquariusPoolIndex"]>(
    async () => "ab".repeat(32),
  ),
  readAquariusEstimateOut: vi.fn<RebalanceRouteReaders["readAquariusEstimateOut"]>(
    async () => 10_200_000,
  ),
  readPhoenixEstimateOut: vi.fn<NonNullable<RebalanceRouteReaders["readPhoenixEstimateOut"]>>(
    async () => 0,
  ),
  requestBalancedSodaxQuote: vi.fn<() => Promise<BalancedSodaxQuoteResult>>(async () => ({
    ok: true,
    provider: "sodax_sdk",
    tokenIn: {
      symbol: "bnUSD",
      name: "Balanced Dollar",
      decimals: 7,
      address: "CAAA",
      chainId: "stellar",
    },
    tokenOut: {
      symbol: "USDC",
      name: "USD Coin",
      decimals: 7,
      address: "CBBB",
      chainId: "stellar",
    },
    amountInBase: "10000000",
    quotedAmountBase: "9800000",
    quoteType: "exact_input",
  })),
  requestBalancedSodaxStatus: vi.fn(async () => ({
    ok: true,
    provider: "sodax_sdk",
    intentTxHash: "0xabcdef12",
    statusCode: 3,
    statusLabel: "SOLVED",
    fillTxHash: "0xfill",
    terminal: true,
  })),
  requestBalancedSodaxConfirm: vi.fn(async () => ({
    ok: true,
    provider: "sodax_sdk",
    intentTxHash: "0xabcdef12",
    statusCode: 3,
    statusLabel: "SOLVED",
    terminal: true,
    fillTxHash: "0xfill",
    confirmationTxHash: "0xfill",
    confirmed: true,
    confirmationState: "confirmed",
    detail: "Intent solved and settlement hash confirmed from SODAX status.",
  })),
  requestBalancedSodaxLifecycle: vi.fn(async () => ({
    status: {
      ok: true,
      provider: "sodax_sdk",
      intentTxHash: "0xabcdef12",
      statusCode: 3,
      statusLabel: "SOLVED",
      fillTxHash: "0xfill",
      terminal: true,
    },
    confirmation: {
      ok: true,
      provider: "sodax_sdk",
      intentTxHash: "0xabcdef12",
      statusCode: 3,
      statusLabel: "SOLVED",
      terminal: true,
      fillTxHash: "0xfill",
      confirmationTxHash: "0xfill",
      confirmed: true,
      confirmationState: "confirmed",
      detail: "Intent solved and settlement hash confirmed from SODAX status.",
    },
  })),
  readBalancedProtocolHealth: vi.fn(async () =>
    buildBalancedFallbackPayload({
      adapterBalanced: "CBALANCED",
      poolId: 3,
      supportStatus: "ready",
      readyForDappExecution: true,
      laneMode: "expected_router",
      blockingReasons: [],
      officialSurface: {
        topology: "intent_based",
        swapModel: "sodax_intents",
        liquidityModel: "legacy_exchange_only",
        intentAdapter: {
          quoteProvider: "sodax",
          quoteVisibleInApp: true,
          quoteComparableForArka: false,
          publicQuoteEndpoint: "sdk:@sodax/sdk::swaps.getQuote",
          publicBuildEndpoint: "sdk:@sodax/sdk::swaps.createIntent",
          publicRelayEndpoint: "sdk:@sodax/sdk::swaps.submitIntent",
          publicSubmitEndpoint: "sdk:@sodax/sdk::swaps.postExecution",
          statusSurface: "recent_activity",
          publicStatusEndpoint: "sdk:@sodax/sdk::swaps.getStatus",
          publicReceiptEndpoint: "sdk:@sodax/sdk::swaps.getSolvedIntentPacket",
          publicExpiryEndpoint: "sdk:@sodax/sdk::swaps.getIntent",
          publicRefundEndpoint: "sdk:@sodax/sdk::swaps.cancelIntent",
          cancellationWindowSeconds: 300,
        },
      },
    }),
  ),
}));

const officialSources = {
  app: "https://app.balanced.network",
  bundle: "https://app.balanced.network/assets/index.js",
  stellarPage: "https://balanced.network/stellar/",
  swapDocs: "https://docs.sodax.com/developers/packages",
  tradeBlog: "https://blog.balanced.network/trade-cross-chain/",
  q3Blog: "https://blog.balanced.network/q3-2025/",
};

const MAINNET_USDC_CONTRACT =
  "CCW67TSZV3SSS2HXMBQ5JFGCKJNXKZM7UQUWUZPUTHXSTZLEO7SJMI75";
const MAINNET_XLM_CONTRACT =
  "CAS3J7GYLGXMF6TDJBBYYSE3HQ6BBSMLNUQ34T6TZMYMW2EVH34XOWMA";

vi.mock("@/lib/soroban", () => ({
  readSoroswapAmountOut: mocks.readSoroswapAmountOut,
  readSushiEstimateOut: vi.fn(async()=>0),
  readSushiFundBinding: vi.fn(async()=>1),
  readVenueSnapshot: vi.fn(async(_fund:string,venue:string)=>({registry:"registry",venue,network:"Test SDF Network ; September 2015",status:2,updatedAt:"1",updatedBy:"admin",observedAt:Date.now()})),
  readSoroswapAmountOutForPath: mocks.readSoroswapAmountOutForPath,
  readAquariusPoolIndex: mocks.readAquariusPoolIndex,
  readAquariusEstimateOut: mocks.readAquariusEstimateOut,
  readPhoenixEstimateOut: mocks.readPhoenixEstimateOut,
}));

vi.mock("@/lib/runtime/protocolSupport", () => ({
  readBalancedProtocolHealth: mocks.readBalancedProtocolHealth,
}));

vi.mock("@/lib/server/balancedSodax", () => ({
  requestBalancedSodaxQuote: mocks.requestBalancedSodaxQuote,
  requestBalancedSodaxStatus: mocks.requestBalancedSodaxStatus,
  requestBalancedSodaxConfirm: mocks.requestBalancedSodaxConfirm,
  requestBalancedSodaxLifecycle: mocks.requestBalancedSodaxLifecycle,
}));

describe("POST /api/routing/rebalance/plan", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("returns an auto-selected plan from live protocol candidates", async () => {
    const { POST } = await import("@/app/api/routing/rebalance/plan/route");
    const request = new Request("http://localhost/api/routing/rebalance/plan", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        fundId:"synthetic-fund",
        requestedProtocol: "AUTO",
        amountBase: 10_000_000,
        tokenIn: "CAAA",
        tokenOut: "CBBB",
        slippagePct: 1,
        manualMinOutBase: 0,
        routingAssets: ["CMID"],
        vaultNavBase: 2_000_000_000,
        dailyTurnoverUsedBase: 0,
        projectedPostTradeDeviationBps: 50,
      }),
    });

    const response = await POST(request as never);
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.ok).toBe(true);
    expect(payload.source).toBe("api_routing_solver");
    expect(payload.plan.requestedProtocol).toBe("AUTO");
    expect(payload.plan.selectedProtocol).toBe("SOROSWAP");
    expect(payload.plan.selectedCandidate.routeId).toMatch(/^SOROSWAP_/);
    expect(payload.plan.selectedCandidate.routeScoreComponents).toBeTruthy();
    expect(payload.plan.selectedCandidate.routeScoreComponents.feePenaltyBps).toBeGreaterThan(0);
    expect(payload.plan.selectedCandidate.routeScoreComponents.fillRiskPenaltyBps).toBeGreaterThan(0);
    expect(payload.plan.selectedCandidate.routeScoreLabel).toMatch(/fee .*%/i);
    expect(payload.plan.selectedCandidate.routeScoreLabel).toMatch(/fill .*%/i);
    expect(payload.plan.selectedCandidate.routeScoreLabel).not.toMatch(/\bbps\b/i);
    expect(payload.plan.routeSearch.strategy).toBe(
      "broker_grade_bounded_global_search",
    );
    expect(payload.plan.routeSearch.quotedPathCount).toBeGreaterThan(0);
    expect(payload.plan.routeSearch.venuesCompared).toContain("SOROSWAP");
    expect(payload.plan.candidates.length).toBeGreaterThan(1);
    expect(
      payload.plan.guardrails.checks.find(
        (check: { id: string }) => check.id === "post_trade_deviation_bps",
      ),
    ).toMatchObject({
      status: "passed",
      evidence: {
        source: "explicit_projection",
        amountBase: 10_000_000,
        vaultNavBase: 2_000_000_000,
      },
    });
    expect(mocks.readBalancedProtocolHealth).toHaveBeenCalled();
    expect(mocks.requestBalancedSodaxQuote).not.toHaveBeenCalled();
    expect(
      payload.plan.candidates.find(
        (candidate: { protocol: string }) => candidate.protocol === "BALANCED",
      ),
    ).toMatchObject({
      admitted: false,
      autoEligible: false,
      quoteModel: "intent_surface_unverified",
    });
  });

  it("requests Balanced/SODAX quotes only when official AUTO evidence is complete", async () => {
    mocks.readBalancedProtocolHealth.mockResolvedValueOnce(
      buildBalancedFallbackPayload({
        adapterBalanced: "",
        poolId: 3,
        supportStatus: "ready",
        readyForDappExecution: true,
        laneMode: "expected_router",
        blockingReasons: [],
        officialSurface: {
          officialSources,
          topology: "intent_based",
          swapModel: "sodax_intents",
          liquidityModel: "legacy_exchange_only",
          publicRouterContractId: null,
          canonicalRouterCutoverPossible: false,
          intentAdapter: {
            quoteProvider: "sodax",
            quoteVisibleInApp: true,
            quoteComparableForArka: true,
            publicQuoteEndpoint: "sdk:@sodax/sdk::swaps.getQuote",
            publicBuildEndpoint: "sdk:@sodax/sdk::swaps.createIntent",
            publicRelayEndpoint: "sdk:@sodax/sdk::swaps.submitIntent",
            publicSubmitEndpoint: "sdk:@sodax/sdk::swaps.postExecution",
            statusSurface: "recent_activity",
            publicStatusEndpoint: "sdk:@sodax/sdk::swaps.getStatus",
            publicReceiptEndpoint: "sdk:@sodax/sdk::swaps.getSolvedIntentPacket",
            publicExpiryEndpoint: "sdk:@sodax/sdk::swaps.getIntent",
            publicRefundEndpoint: "sdk:@sodax/sdk::swaps.cancelIntent",
            cancellationWindowSeconds: 300,
          },
        },
        intentVenue: {
          plannerAdmission: "auto",
          manualExecutionEligible: true,
        },
      }),
    );
    const { POST } = await import("@/app/api/routing/rebalance/plan/route");
    const request = new Request("http://localhost/api/routing/rebalance/plan", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        fundId:"synthetic-fund",
        requestedProtocol: "AUTO",
        amountBase: 2_000_000,
        tokenIn: MAINNET_USDC_CONTRACT,
        tokenOut: MAINNET_XLM_CONTRACT,
        slippagePct: 1,
        manualMinOutBase: 0,
        routingAssets: ["CMID"],
        vaultNavBase: 2_000_000_000,
        dailyTurnoverUsedBase: 0,
      }),
    });

    const response = await POST(request as never);
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.ok).toBe(true);
    expect(mocks.requestBalancedSodaxQuote).toHaveBeenCalledWith({
      tokenIn: MAINNET_USDC_CONTRACT,
      tokenOut: MAINNET_XLM_CONTRACT,
      amountInBase: "2000000",
    });
    expect(
      payload.plan.candidates.find(
        (candidate: { protocol: string }) => candidate.protocol === "BALANCED",
      ),
    ).toMatchObject({
      admitted: true,
      autoEligible: true,
      quoteModel: "public_intent_quote",
      estimatedOutBase: 9_800_000,
      autoPolicy: {
        status: "passed",
        code: "canary_passed",
      },
    });
  });

  it("keeps Balanced/SODAX direct-only for AUTO trades below the live canary floor", async () => {
    mocks.readBalancedProtocolHealth.mockResolvedValueOnce(
      buildBalancedFallbackPayload({
        adapterBalanced: "CBALANCED",
        poolId: 3,
        supportStatus: "ready",
        readyForDappExecution: true,
        laneMode: "expected_router",
        blockingReasons: [],
        officialSurface: {
          officialSources,
          topology: "intent_based",
          swapModel: "sodax_intents",
          liquidityModel: "legacy_exchange_only",
          publicRouterContractId: null,
          canonicalRouterCutoverPossible: false,
          intentAdapter: {
            quoteProvider: "sodax",
            quoteVisibleInApp: true,
            quoteComparableForArka: true,
            publicQuoteEndpoint: "sdk:@sodax/sdk::swaps.getQuote",
            publicBuildEndpoint: "sdk:@sodax/sdk::swaps.createIntent",
            publicRelayEndpoint: "sdk:@sodax/sdk::swaps.submitIntent",
            publicSubmitEndpoint: "sdk:@sodax/sdk::swaps.postExecution",
            statusSurface: "recent_activity",
            publicStatusEndpoint: "sdk:@sodax/sdk::swaps.getStatus",
            publicReceiptEndpoint: "sdk:@sodax/sdk::swaps.getSolvedIntentPacket",
            publicExpiryEndpoint: "sdk:@sodax/sdk::swaps.getIntent",
            publicRefundEndpoint: "sdk:@sodax/sdk::swaps.cancelIntent",
            cancellationWindowSeconds: 300,
          },
        },
        intentVenue: {
          plannerAdmission: "auto",
          manualExecutionEligible: true,
        },
      }),
    );

    const { POST } = await import("@/app/api/routing/rebalance/plan/route");
    const request = new Request("http://localhost/api/routing/rebalance/plan", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        fundId:"synthetic-fund",
        requestedProtocol: "AUTO",
        amountBase: 1_000_000,
        tokenIn: MAINNET_XLM_CONTRACT,
        tokenOut: MAINNET_USDC_CONTRACT,
        slippagePct: 1,
        manualMinOutBase: 0,
        routingAssets: ["CMID"],
      }),
    });

    const response = await POST(request as never);
    const payload = await response.json();
    const balancedCandidate = payload.plan.candidates.find(
      (candidate: { protocol: string }) => candidate.protocol === "BALANCED",
    );

    expect(response.status).toBe(200);
    expect(payload.ok).toBe(true);
    expect(mocks.requestBalancedSodaxQuote).not.toHaveBeenCalled();
    expect(balancedCandidate).toMatchObject({
      admitted: true,
      autoEligible: false,
      estimatedOutBase: 0,
      routeScoreLabel: "direct execution only",
      autoPolicy: {
        status: "blocked",
        code: "amount_below_canary_floor",
        minAmountBase: 50_000_000,
      },
    });
  });

  it("keeps HTTP success but blocks execution when runtime guardrail state violates policy", async () => {
    const { POST } = await import("@/app/api/routing/rebalance/plan/route");
    const request = new Request("http://localhost/api/routing/rebalance/plan", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        fundId:"synthetic-fund",
        requestedProtocol: "AUTO",
        amountBase: 10_000_000,
        tokenIn: "CAAA",
        tokenOut: "CBBB",
        slippagePct: 1,
        manualMinOutBase: 0,
        routingAssets: ["CMID"],
        vaultNavBase: 20_000_000,
        dailyTurnoverUsedBase: 0,
        projectedPostTradeDeviationBps: 500,
      }),
    });

    const response = await POST(request as never);
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.ok).toBe(true);
    expect(payload.plan.guardrails.status).toBe("blocked");
    expect(payload.plan.selectedCandidate).toBeNull();
    expect(
      payload.plan.guardrails.checks.find(
        (check: { id: string }) => check.id === "post_trade_deviation_bps",
      ),
    ).toMatchObject({
      status: "blocked",
      value: "5.00%",
      evidence: {
        source: "explicit_projection",
        amountBase: 10_000_000,
        vaultNavBase: 20_000_000,
      },
    });
    expect(
      payload.plan.guardrails.checks.find(
        (check: { id: string }) => check.id === "daily_turnover_cap_bps",
      ),
    ).toMatchObject({ status: "blocked", limit: "2,000,000 notional" });
  });

  it("blocks pre-sign execution when required daily-turnover state is missing", async () => {
    const { POST } = await import("@/app/api/routing/rebalance/plan/route");
    const request = new Request("http://localhost/api/routing/rebalance/plan", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        fundId:"synthetic-fund",
        requestedProtocol: "AUTO",
        amountBase: 10_000_000,
        tokenIn: "CAAA",
        tokenOut: "CBBB",
        slippagePct: 1,
        manualMinOutBase: 0,
        routingAssets: ["CMID"],
        vaultNavBase: 200_000_000,
        projectedPostTradeDeviationBps: 50,
        requiredStatefulGuardrails: [
          "post_trade_deviation_bps",
          "daily_turnover_cap_bps",
        ],
      }),
    });

    const response = await POST(request as never);
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.ok).toBe(true);
    expect(payload.plan.guardrails.status).toBe("blocked");
    expect(payload.plan.selectedCandidate).toBeNull();
    expect(payload.plan.guardrails.blockedReasons.join(" ")).toMatch(
      /Daily turnover cap/i,
    );
    expect(
      payload.plan.guardrails.checks.find(
        (check: { id: string }) => check.id === "daily_turnover_cap_bps",
      ),
    ).toMatchObject({
      status: "requires_state",
      value: "state required",
      evidence: {
        source: "missing_state",
        amountBase: 10_000_000,
        vaultNavBase: 200_000_000,
      },
    });
  });

  it("blocks pre-sign execution when required post-trade deviation state is missing", async () => {
    const { POST } = await import("@/app/api/routing/rebalance/plan/route");
    const request = new Request("http://localhost/api/routing/rebalance/plan", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        fundId:"synthetic-fund",
        requestedProtocol: "AUTO",
        amountBase: 10_000_000,
        tokenIn: "CAAA",
        tokenOut: "CBBB",
        slippagePct: 1,
        manualMinOutBase: 0,
        routingAssets: ["CMID"],
        dailyTurnoverUsedBase: 0,
        requiredStatefulGuardrails: [
          "post_trade_deviation_bps",
          "daily_turnover_cap_bps",
        ],
      }),
    });

    const response = await POST(request as never);
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.ok).toBe(true);
    expect(payload.plan.guardrails.status).toBe("blocked");
    expect(payload.plan.selectedCandidate).toBeNull();
    expect(payload.plan.guardrails.blockedReasons.join(" ")).toMatch(
      /Post-trade deviation/i,
    );
    expect(
      payload.plan.guardrails.checks.find(
        (check: { id: string }) => check.id === "post_trade_deviation_bps",
      ),
    ).toMatchObject({
      status: "requires_state",
      value: "state required",
      evidence: {
        source: "missing_state",
        amountBase: 10_000_000,
      },
    });
  });

  it("supports multi-hop V2 exploration and can select a 3-hop SoroSwap route", async () => {
    const defaultPathImplementation = mocks.readSoroswapAmountOutForPath.getMockImplementation();
    try {
      mocks.readSoroswapAmountOut.mockResolvedValueOnce(10_100_000);
      mocks.readSoroswapAmountOutForPath.mockImplementation(
        async (_amountBase: number, pathAssets: string[]) => {
          const path = pathAssets.join(">");
          if (path === "CAAA>CM1>CM2>CBBB") return 12_800_000;
          if (pathAssets.length === 3) return 10_600_000;
          return 10_300_000;
        },
      );
      mocks.readAquariusEstimateOut.mockResolvedValueOnce(11_200_000);
      mocks.requestBalancedSodaxQuote.mockResolvedValueOnce({
        ok: true,
        provider: "sodax_sdk",
        tokenIn: {
          symbol: "bnUSD",
          name: "Balanced Dollar",
          decimals: 7,
          address: "CAAA",
          chainId: "stellar",
        },
        tokenOut: {
          symbol: "USDC",
          name: "USD Coin",
          decimals: 7,
          address: "CBBB",
          chainId: "stellar",
        },
        amountInBase: "10000000",
        quotedAmountBase: "9800000",
        quoteType: "exact_input",
      });

      const { POST } = await import("@/app/api/routing/rebalance/plan/route");
      const request = new Request("http://localhost/api/routing/rebalance/plan", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          fundId:"synthetic-fund",
        requestedProtocol: "AUTO",
          amountBase: 10_000_000,
          tokenIn: "CAAA",
          tokenOut: "CBBB",
          slippagePct: 1,
          manualMinOutBase: 0,
          routingAssets: ["CM1", "CM2", "CM3"],
        }),
      });

      const response = await POST(request as never);
      const payload = await response.json();

      expect(response.status).toBe(200);
      expect(payload.ok).toBe(true);
      expect(payload.plan.selectedProtocol).toBe("SOROSWAP");
      expect(payload.plan.selectedCandidate.routeId).toMatch(/^SOROSWAP_/);
      expect(payload.plan.selectedCandidate.hops).toBe(3);
      expect(payload.plan.selectedCandidate.pathAssets).toEqual([
        "CAAA",
        "CM1",
        "CM2",
        "CBBB",
      ]);
      expect(payload.plan.selectedCandidate.routeScoreComponents.hopPenaltyBps).toBeGreaterThan(0);
      expect(payload.plan.note).toMatch(/3-hop route/i);
    } finally {
      mocks.readSoroswapAmountOutForPath.mockImplementation(
        defaultPathImplementation ??
          (async () => 11_000_000),
      );
    }
  });

  it("accepts broker-grade search controls and returns bounded-million-universe telemetry", async () => {
    const defaultPathImplementation = mocks.readSoroswapAmountOutForPath.getMockImplementation();
    const routingAssets = Array.from({ length: 24 }, (_, index) =>
      `C${String(index + 1).padStart(2, "0")}`,
    );
    try {
      mocks.readSoroswapAmountOut.mockResolvedValueOnce(10_100_000);
      mocks.readSoroswapAmountOutForPath.mockImplementation(
        async (_amountBase: number, pathAssets: string[]) => {
          if (pathAssets.join(">") === "CAAA>C24>C23>C22>C21>C20>CBBB") {
            return 16_200_000;
          }
          return 10_300_000;
        },
      );
      mocks.readAquariusEstimateOut.mockResolvedValueOnce(10_900_000);

      const { POST } = await import("@/app/api/routing/rebalance/plan/route");
      const request = new Request("http://localhost/api/routing/rebalance/plan", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          fundId:"synthetic-fund",
        requestedProtocol: "AUTO",
          amountBase: 10_000_000,
          tokenIn: "CAAA",
          tokenOut: "CBBB",
          slippagePct: 1,
          manualMinOutBase: 0,
          routingAssets,
          routingSearch: {
            maxIntermediaries: 24,
            maxHops: 6,
            quoteBudget: 12,
            splitParts: 4,
          },
        }),
      });

      const response = await POST(request as never);
      const payload = await response.json();

      expect(response.status).toBe(200);
      expect(payload.ok).toBe(true);
      expect(payload.plan.routeSearch.strategy).toBe(
        "broker_grade_bounded_global_search",
      );
      expect(payload.plan.routeSearch.benchmarkScale).toBe(
        "million_scale_bounded",
      );
      expect(payload.plan.routeSearch.samplingModel).toBe(
        "broker_frontier_beam_tail_probe",
      );
      expect(payload.plan.routeSearch.candidateUniverseSize).toBeGreaterThan(
        1_000_000,
      );
      expect(payload.plan.routeSearch.quotedPathCount).toBe(12);
      expect(payload.plan.routeSearch.splitParts).toBe(4);
      expect(payload.plan.routeSearch.beamWidth).toBe(16);
      expect(payload.plan.routeSearch.tailProbeCount).toBe(96);
      expect(payload.plan.routeSearch.deterministicProbeCount).toBeGreaterThan(12);
      expect(payload.plan.routeSearch.deepestGeneratedHops).toBe(6);
      expect(payload.plan.routeSearch.deepestQuotedHops).toBe(6);
      expect(payload.plan.routeSearch.quotedHopCounts).toEqual([
        { hops: 1, pathCount: 1 },
        { hops: 2, pathCount: 3 },
        { hops: 3, pathCount: 2 },
        { hops: 4, pathCount: 2 },
        { hops: 5, pathCount: 2 },
        { hops: 6, pathCount: 2 },
      ]);
      expect(payload.plan.routeSearch.budgetUtilizationBps).toBe(10_000);
      expect(payload.plan.routeSearch.quoteCoverageBps).toBe(0);
      expect(payload.plan.routeSearch.quoteCoveragePpm).toBeGreaterThan(0);
      expect(payload.plan.routeSearch.prunedPathCount).toBeGreaterThan(
        1_000_000,
      );
      expect(payload.plan.candidates.length).toBeLessThanOrEqual(32);
      expect(payload.plan.selectedCandidate.pathAssets).toEqual([
        "CAAA",
        "C24",
        "C23",
        "C22",
        "C21",
        "C20",
        "CBBB",
      ]);
      expect(payload.plan.note).toMatch(/Broker-grade bounded search evaluated 12 live SoroSwap quote paths/i);
      expect(mocks.readSoroswapAmountOutForPath.mock.calls.length).toBeGreaterThanOrEqual(11);
    } finally {
      mocks.readSoroswapAmountOutForPath.mockImplementation(
        defaultPathImplementation ??
          (async () => 11_000_000),
      );
    }
  });

  it("returns executable split-route optimization when chunked marginal quotes beat the best single lane", async () => {
    const defaultDirectImplementation = mocks.readSoroswapAmountOut.getMockImplementation();
    const defaultPathImplementation = mocks.readSoroswapAmountOutForPath.getMockImplementation();
    const defaultAquariusImplementation = mocks.readAquariusEstimateOut.getMockImplementation();
    const defaultBalancedQuoteImplementation = mocks.requestBalancedSodaxQuote.getMockImplementation();
    try {
      mocks.readSoroswapAmountOut.mockImplementation(async (amountBase: number) =>
        amountBase <= 500_000 ? Math.floor(amountBase * 1.14) : 1_030_000,
      );
      mocks.readSoroswapAmountOutForPath.mockResolvedValue(0);
      mocks.readAquariusEstimateOut.mockImplementation(
        async (_router: string, _tokenIn: string, _tokenOut: string, _pool: string, amountBase: number) =>
          amountBase <= 500_000 ? Math.floor(amountBase * 1.12) : 1_050_000,
      );
      mocks.requestBalancedSodaxQuote.mockResolvedValue({
        ok: true,
        provider: "sodax_sdk",
        tokenIn: {
          symbol: "bnUSD",
          name: "Balanced Dollar",
          decimals: 7,
          address: "CAAA",
          chainId: "stellar",
        },
        tokenOut: {
          symbol: "USDC",
          name: "USD Coin",
          decimals: 7,
          address: "CBBB",
          chainId: "stellar",
        },
        amountInBase: "1000000",
        quotedAmountBase: "900000",
        quoteType: "exact_input",
      });

      const { POST } = await import("@/app/api/routing/rebalance/plan/route");
      const request = new Request("http://localhost/api/routing/rebalance/plan", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          fundId:"synthetic-fund",
        requestedProtocol: "AUTO",
          amountBase: 1_000_000,
          tokenIn: "CAAA",
          tokenOut: "CBBB",
          slippagePct: 0.5,
          manualMinOutBase: 0,
          routingSearch: {
            quoteBudget: 2,
            splitParts: 2,
          },
        }),
      });

      const response = await POST(request as never);
      const payload = await response.json();

      expect(response.status).toBe(200);
      expect(payload.ok).toBe(true);
      expect(payload.plan.selectedProtocol).toBe("AQUARIUS");
      expect(payload.plan.splitRoute).toMatchObject({
        status: "recommended",
        strategy: "chunked_global_best_execution",
        executable: true,
        allocationCount: 2,
        chunkCount: 2,
        totalEstimatedOutBase: 1_130_000,
        singleRouteEstimatedOutBase: 1_050_000,
        estimatedImprovementBase: 80_000,
      });
      expect(
        payload.plan.splitRoute.allocations
          .map((allocation: { protocol: string }) => allocation.protocol)
          .sort(),
      ).toEqual(["AQUARIUS", "SOROSWAP"]);
    } finally {
      mocks.readSoroswapAmountOut.mockImplementation(
        defaultDirectImplementation ?? (async () => 9_500_000),
      );
      mocks.readSoroswapAmountOutForPath.mockImplementation(
        defaultPathImplementation ?? (async () => 11_000_000),
      );
      mocks.readAquariusEstimateOut.mockImplementation(
        defaultAquariusImplementation ?? (async () => 10_200_000),
      );
      mocks.requestBalancedSodaxQuote.mockImplementation(
        defaultBalancedQuoteImplementation ??
          (async () => ({
            ok: true,
            provider: "sodax_sdk",
            tokenIn: {
              symbol: "bnUSD",
              name: "Balanced Dollar",
              decimals: 7,
              address: "CAAA",
              chainId: "stellar",
            },
            tokenOut: {
              symbol: "USDC",
              name: "USD Coin",
              decimals: 7,
              address: "CBBB",
              chainId: "stellar",
            },
            amountInBase: "10000000",
            quotedAmountBase: "9800000",
            quoteType: "exact_input",
          })),
      );
    }
  });

  it("keeps Balanced as manual lane when comparable quote probing fails", async () => {
    mocks.requestBalancedSodaxQuote.mockResolvedValueOnce({
      ok: false,
      provider: "sodax_sdk",
      tokenIn: {
        symbol: "bnUSD",
        name: "Balanced Dollar",
        decimals: 7,
        address: "CAAA",
        chainId: "stellar",
      },
      tokenOut: {
        symbol: "USDC",
        name: "USD Coin",
        decimals: 7,
        address: "CBBB",
        chainId: "stellar",
      },
      amountInBase: "10000000",
      code: 502,
      message: "quote unavailable",
      quoteType: "exact_input",
    });
    const { POST } = await import("@/app/api/routing/rebalance/plan/route");
    const request = new Request("http://localhost/api/routing/rebalance/plan", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        fundId:"synthetic-fund",
        requestedProtocol: "BALANCED",
        amountBase: 10_000_000,
        tokenIn: "CAAA",
        tokenOut: "CBBB",
        slippagePct: 1,
        manualMinOutBase: 0,
      }),
    });

    const response = await POST(request as never);
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.ok).toBe(true);
    expect(payload.plan.selectedProtocol).toBe("BALANCED");
    expect(payload.plan.selectedCandidate).not.toBeNull();
    expect(payload.plan.selectedCandidate.quoteModel).toBe("manual_lane");
    expect(payload.plan.selectedCandidate.autoEligible).toBe(false);
    expect(payload.plan.note).toMatch(/Balanced selected/i);
  });

  it("admits Balanced into AUTO when official quote/status/confirm evidence is machine-consumable", async () => {
    mocks.readBalancedProtocolHealth.mockResolvedValueOnce(
      buildBalancedFallbackPayload({
        adapterBalanced: "CBALANCED",
        poolId: 3,
        supportStatus: "ready",
        readyForDappExecution: true,
        laneMode: "expected_router",
        blockingReasons: [],
        officialSurface: {
          officialSources,
          topology: "intent_based",
          swapModel: "sodax_intents",
          liquidityModel: "legacy_exchange_only",
          publicRouterContractId: null,
          canonicalRouterCutoverPossible: false,
          intentAdapter: {
            quoteProvider: "sodax",
            quoteVisibleInApp: true,
            quoteComparableForArka: true,
            publicQuoteEndpoint: "sdk:@sodax/sdk::swaps.getQuote",
            publicBuildEndpoint: "sdk:@sodax/sdk::swaps.createIntent",
            publicRelayEndpoint: "sdk:@sodax/sdk::swaps.submitIntent",
            publicSubmitEndpoint: "sdk:@sodax/sdk::swaps.postExecution",
            statusSurface: "recent_activity",
            publicStatusEndpoint: "sdk:@sodax/sdk::swaps.getStatus",
            publicReceiptEndpoint: "sdk:@sodax/sdk::swaps.getSolvedIntentPacket",
            publicExpiryEndpoint: "sdk:@sodax/sdk::swaps.getIntent",
            publicRefundEndpoint: "sdk:@sodax/sdk::swaps.cancelIntent",
            cancellationWindowSeconds: 300,
          },
        },
        intentVenue: {
          plannerAdmission: "auto",
          manualExecutionEligible: true,
        },
      }),
    );
    mocks.requestBalancedSodaxQuote.mockResolvedValueOnce({
      ok: true,
      provider: "sodax_sdk",
      tokenIn: {
        symbol: "bnUSD",
        name: "Balanced Dollar",
        decimals: 7,
        address: "CAAA",
        chainId: "stellar",
      },
      tokenOut: {
        symbol: "USDC",
        name: "USD Coin",
        decimals: 7,
        address: "CBBB",
        chainId: "stellar",
      },
      amountInBase: "10000000",
      quotedAmountBase: "12500000",
      quoteType: "exact_input",
    });
    const { POST } = await import("@/app/api/routing/rebalance/plan/route");
    const request = new Request("http://localhost/api/routing/rebalance/plan", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        fundId:"synthetic-fund",
        requestedProtocol: "AUTO",
        amountBase: 2_000_000,
        tokenIn: MAINNET_USDC_CONTRACT,
        tokenOut: MAINNET_XLM_CONTRACT,
        slippagePct: 1,
        manualMinOutBase: 0,
        routingAssets: ["CMID"],
      }),
    });

    const response = await POST(request as never);
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.ok).toBe(true);
    expect(mocks.requestBalancedSodaxQuote).toHaveBeenCalledWith({
      tokenIn: MAINNET_USDC_CONTRACT,
      tokenOut: MAINNET_XLM_CONTRACT,
      amountInBase: "2000000",
    });
    const balancedCandidate = payload.plan.candidates.find(
      (candidate: { protocol: string }) => candidate.protocol === "BALANCED",
    );
    expect(balancedCandidate).toMatchObject({
      admitted: true,
      autoEligible: true,
      quoteModel: "public_intent_quote",
      autoPolicy: {
        status: "passed",
        code: "canary_passed",
      },
    });
    expect(balancedCandidate.estimatedOutBase).toBeGreaterThan(0);
    expect(balancedCandidate.routeScoreComponents).toBeTruthy();
    expect(balancedCandidate.routeScoreComponents.feePenaltyBps).toBeGreaterThan(0);
    expect(balancedCandidate.routeScoreComponents.fillRiskPenaltyBps).toBeGreaterThan(0);
  });

  it("keeps Balanced manual in AUTO when status/confirm endpoints are missing", async () => {
    const defaultHealthImpl = mocks.readBalancedProtocolHealth.getMockImplementation();
    try {
      mocks.readBalancedProtocolHealth.mockResolvedValueOnce(
        buildBalancedFallbackPayload({
          adapterBalanced: "CBALANCED",
          poolId: 3,
          supportStatus: "ready",
          readyForDappExecution: true,
          laneMode: "expected_router",
          blockingReasons: [],
          officialSurface: {
            topology: "intent_based",
            swapModel: "sodax_intents",
            liquidityModel: "legacy_exchange_only",
            intentAdapter: {
              quoteProvider: "sodax",
              quoteVisibleInApp: true,
              quoteComparableForArka: true,
              publicQuoteEndpoint: "sdk:@sodax/sdk::swaps.getQuote",
              publicBuildEndpoint: null,
              publicRelayEndpoint: null,
              publicSubmitEndpoint: null,
              statusSurface: "recent_activity",
              publicStatusEndpoint: null,
              publicReceiptEndpoint: null,
              publicExpiryEndpoint: null,
              publicRefundEndpoint: null,
              cancellationWindowSeconds: 300,
            },
          },
        }),
      );

      const { POST } = await import("@/app/api/routing/rebalance/plan/route");
      const request = new Request("http://localhost/api/routing/rebalance/plan", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          fundId:"synthetic-fund",
        requestedProtocol: "AUTO",
          amountBase: 10_000_000,
          tokenIn: "CAAA",
          tokenOut: "CBBB",
          slippagePct: 1,
          manualMinOutBase: 0,
          routingAssets: ["CMID"],
        }),
      });

      const response = await POST(request as never);
      const payload = await response.json();

      expect(response.status).toBe(200);
      expect(payload.ok).toBe(true);
      expect(payload.plan.selectedProtocol).not.toBe("BALANCED");
      const balancedCandidate = payload.plan.candidates.find(
        (candidate: { protocol: string }) => candidate.protocol === "BALANCED",
      );
      expect(balancedCandidate).toBeTruthy();
      expect(balancedCandidate.quoteModel).toBe("intent_surface_unverified");
      expect(balancedCandidate.autoEligible).toBe(false);
      expect(balancedCandidate.estimatedOutBase).toBe(0);
      expect(balancedCandidate.note).toMatch(/missing official SODAX/i);
      expect(mocks.requestBalancedSodaxQuote).not.toHaveBeenCalled();
    } finally {
      mocks.readBalancedProtocolHealth.mockImplementation(
        defaultHealthImpl ??
          (async () => buildBalancedFallbackPayload()),
      );
    }
  });

  it("applies risk-aware tie-breaking for near-score AUTO candidates", async () => {
    mocks.readSoroswapAmountOut.mockResolvedValueOnce(10_200_000);
    mocks.readAquariusEstimateOut.mockResolvedValueOnce(10_180_000);
    const { POST } = await import("@/app/api/routing/rebalance/plan/route");
    const request = new Request("http://localhost/api/routing/rebalance/plan", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        fundId:"synthetic-fund",
        requestedProtocol: "AUTO",
        amountBase: 10_000_000,
        tokenIn: "CAAA",
        tokenOut: "CBBB",
        slippagePct: 1,
        manualMinOutBase: 0,
      }),
    });

    const response = await POST(request as never);
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.ok).toBe(true);

    const soroswapCandidate = payload.plan.candidates.find(
      (candidate: { protocol: string; pathAssets: string[] }) =>
        candidate.protocol === "SOROSWAP" && candidate.pathAssets.length === 2,
    );
    const aquariusCandidate = payload.plan.candidates.find(
      (candidate: { protocol: string }) => candidate.protocol === "AQUARIUS",
    );
    expect(soroswapCandidate).toBeTruthy();
    expect(aquariusCandidate).toBeTruthy();
    const reference = Math.max(
      soroswapCandidate.estimatedOutBase,
      aquariusCandidate.estimatedOutBase,
      1,
    );
    const scoreDeltaBps = Math.floor(
      (Math.abs(soroswapCandidate.routeScoreBase - aquariusCandidate.routeScoreBase) * 10_000) /
        reference,
    );
    expect(scoreDeltaBps).toBeLessThanOrEqual(10);
    expect(aquariusCandidate.routeScoreComponents.effectivePenaltyBps).toBeLessThan(
      soroswapCandidate.routeScoreComponents.effectivePenaltyBps,
    );
    expect(payload.plan.selectedProtocol).toBe("AQUARIUS");
    expect(payload.plan.note).toMatch(/Auto-selected Aquarius/i);
  });

  it("returns Balanced intent lifecycle when planner receives intentTxHash", async () => {
    const { POST } = await import("@/app/api/routing/rebalance/plan/route");
    const request = new Request("http://localhost/api/routing/rebalance/plan", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        fundId:"synthetic-fund",
        requestedProtocol: "AUTO",
        amountBase: 10_000_000,
        tokenIn: "CAAA",
        tokenOut: "CBBB",
        slippagePct: 1,
        intentTxHash: "0xabcdef12",
      }),
    });

    const response = await POST(request as never);
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.ok).toBe(true);
    expect(payload.balancedIntentLifecycle).toBeTruthy();
    expect(payload.balancedIntentLifecycle.status.statusLabel).toBe("SOLVED");
    expect(payload.balancedIntentLifecycle.confirmation.confirmationState).toBe("confirmed");
    expect(mocks.requestBalancedSodaxLifecycle).toHaveBeenCalledWith(
      "0xabcdef12",
    );
  });
});
