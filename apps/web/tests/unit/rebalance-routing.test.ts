import { describe, expect, it, vi } from "vitest";
import {
  buildRuntimeRebalanceProtocolPolicies,
  createIdleRebalanceRoutePlan,
  formatRebalanceProtocolLabel,
  parseDisabledRebalanceProtocols,
  resolveRebalanceGuardrailPolicy,
  resolveRebalanceRoutePlan,
} from "@/lib/workflows/rebalanceRouting";

describe("rebalance routing", () => {
  it("builds an idle plan before quotes are available", () => {
    const plan = createIdleRebalanceRoutePlan("AUTO");
    expect(plan.selectedProtocol).toBe("SOROSWAP");
    expect(plan.note).toMatch(/enter a valid amount/i);
    expect(plan.candidates).toHaveLength(4);
    expect(
      plan.candidates.find((candidate) => candidate.protocol === "SUSHI")?.pathModel,
    ).toBe("adapter_gated");
    expect(
      plan.candidates.find((candidate) => candidate.protocol === "BALANCED")?.venueFamily,
    ).toBe("intent_execution");
    expect(
      plan.candidates.find((candidate) => candidate.protocol === "BALANCED")?.pathModel,
    ).toBe("adapter_gated");
  });

  it("auto-selects the best quoted protocol", async () => {
    const plan = await resolveRebalanceRoutePlan(
      {
        requestedProtocol: "AUTO",
        amountBase: 1_000_000,
        tokenIn: "CAAA",
        tokenOut: "CBBB",
        slippagePct: 0.5,
        manualMinOutBase: 0,
        aquariusRouterId: "CAQUARIUS",
        configuredAquariusPoolIndex: "ab".repeat(32),
      },
      {
        readSoroswapAmountOut: vi.fn().mockResolvedValue(1_030_000),
        readSoroswapAmountOutForPath: vi.fn().mockResolvedValue(0),
        readAquariusPoolIndex: vi.fn().mockResolvedValue(""),
        readAquariusEstimateOut: vi.fn().mockResolvedValue(1_080_000),
      },
    );

    expect(plan.selectedProtocol).toBe("AQUARIUS");
    expect(plan.estimatedOutBase).toBe(1_080_000);
    expect(plan.selectedCandidate?.title).toBe("Aquarius direct");
    expect(plan.selectedCandidate?.routeScoreBase).toBeGreaterThan(0);
    expect(plan.note).toMatch(/auto-selected aquarius/i);
  });

  it("admits Sushi direct pools when the adapter and pool are configured", async () => {
    const plan = await resolveRebalanceRoutePlan(
      {
        requestedProtocol: "AUTO",
        amountBase: 1_000_000,
        tokenIn: "CAAA",
        tokenOut: "CBBB",
        slippagePct: 0.5,
        manualMinOutBase: 0,
        aquariusRouterId: "CAQUARIUS",
        sushiAdapterId: "CSUSHIADAPTER",
        sushiPoolId: 4,
        configuredSushiPool: "CSUSHIPOOL",
        configuredAquariusPoolIndex: "ab".repeat(32),
      },
      {
        readSoroswapAmountOut: vi.fn().mockResolvedValue(1_030_000),
        readSoroswapAmountOutForPath: vi.fn().mockResolvedValue(0),
        readAquariusPoolIndex: vi.fn().mockResolvedValue(""),
        readAquariusEstimateOut: vi.fn().mockResolvedValue(1_040_000),
        readSushiEstimateOut: vi.fn().mockResolvedValue(1_120_000),
      },
    );

    const sushiCandidate = plan.candidates.find(
      (candidate) => candidate.protocol === "SUSHI",
    );
    expect(sushiCandidate?.available).toBe(true);
    expect(sushiCandidate?.autoEligible).toBe(true);
    expect(sushiCandidate?.executionKind).toBe("sushi_pool");
    expect(sushiCandidate?.settlementModel).toBe("onchain_adapter");
    expect(sushiCandidate?.adapterId).toBe("CSUSHIADAPTER");
    expect(sushiCandidate?.poolId).toBe(4);
    expect(plan.selectedProtocol).toBe("SUSHI");
    expect(plan.note).toMatch(/auto-selected sushi/i);
  });

  it("keeps Sushi blocked until a real pool and adapter are configured", async () => {
    const plan = await resolveRebalanceRoutePlan(
      {
        requestedProtocol: "AUTO",
        amountBase: 1_000_000,
        tokenIn: "CAAA",
        tokenOut: "CBBB",
        slippagePct: 0.5,
        manualMinOutBase: 0,
        aquariusRouterId: "CAQUARIUS",
      },
      {
        readSoroswapAmountOut: vi.fn().mockResolvedValue(1_030_000),
        readSoroswapAmountOutForPath: vi.fn().mockResolvedValue(0),
        readAquariusPoolIndex: vi.fn().mockResolvedValue(""),
        readAquariusEstimateOut: vi.fn().mockResolvedValue(1_020_000),
        readSushiEstimateOut: vi.fn().mockResolvedValue(1_120_000),
      },
    );

    const sushiCandidate = plan.candidates.find(
      (candidate) => candidate.protocol === "SUSHI",
    );
    expect(sushiCandidate?.available).toBe(false);
    expect(sushiCandidate?.admitted).toBe(false);
    expect(sushiCandidate?.note).toMatch(/pool is not configured/i);
    expect(plan.selectedProtocol).toBe("SOROSWAP");
  });

  it("lets runtime policy block a vulnerable protocol before AUTO admission", async () => {
    expect(parseDisabledRebalanceProtocols("sushi, balanced")).toEqual([
      "SUSHI",
      "BALANCED",
    ]);

    const protocolPolicies = buildRuntimeRebalanceProtocolPolicies({
      disabledProtocols: "SUSHI",
      disabledReason: "Sushi paused for incident response.",
    });
    const plan = await resolveRebalanceRoutePlan(
      {
        requestedProtocol: "AUTO",
        amountBase: 1_000_000,
        tokenIn: "CAAA",
        tokenOut: "CBBB",
        slippagePct: 0.5,
        manualMinOutBase: 0,
        aquariusRouterId: "CAQUARIUS",
        sushiAdapterId: "CSUSHIADAPTER",
        sushiPoolId: 4,
        configuredSushiPool: "CSUSHIPOOL",
        configuredAquariusPoolIndex: "ab".repeat(32),
        protocolPolicies,
      },
      {
        readSoroswapAmountOut: vi.fn().mockResolvedValue(1_030_000),
        readSoroswapAmountOutForPath: vi.fn().mockResolvedValue(0),
        readAquariusPoolIndex: vi.fn().mockResolvedValue(""),
        readAquariusEstimateOut: vi.fn().mockResolvedValue(1_040_000),
        readSushiEstimateOut: vi.fn().mockResolvedValue(1_120_000),
      },
    );

    const sushiCandidate = plan.candidates.find(
      (candidate) => candidate.protocol === "SUSHI",
    );
    expect(sushiCandidate?.available).toBe(false);
    expect(sushiCandidate?.admitted).toBe(false);
    expect(sushiCandidate?.note).toMatch(/incident response/i);
    expect(plan.selectedProtocol).toBe("AQUARIUS");
  });

  it("falls back to SoroSwap when no live quote is visible", async () => {
    const plan = await resolveRebalanceRoutePlan(
      {
        requestedProtocol: "AUTO",
        amountBase: 1_000_000,
        tokenIn: "CAAA",
        tokenOut: "CBBB",
        slippagePct: 1,
        manualMinOutBase: 0,
        aquariusRouterId: "CAQUARIUS",
      },
      {
        readSoroswapAmountOut: vi.fn().mockResolvedValue(0),
        readSoroswapAmountOutForPath: vi.fn().mockResolvedValue(0),
        readAquariusPoolIndex: vi.fn().mockResolvedValue(""),
        readAquariusEstimateOut: vi.fn().mockResolvedValue(0),
      },
    );

    expect(plan.selectedProtocol).toBe("SOROSWAP");
    expect(plan.note).toMatch(/could not read live quotes/i);
    expect(plan.minOutBase).toBeGreaterThan(0);
  });

  it("keeps a manual override min-out on explicit lane selection", async () => {
    const plan = await resolveRebalanceRoutePlan(
      {
        requestedProtocol: "SOROSWAP",
        amountBase: 1_000_000,
        tokenIn: "CAAA",
        tokenOut: "CBBB",
        slippagePct: 1,
        manualMinOutBase: 910_000,
        aquariusRouterId: "CAQUARIUS",
      },
      {
        readSoroswapAmountOut: vi.fn().mockResolvedValue(980_000),
        readSoroswapAmountOutForPath: vi.fn().mockResolvedValue(0),
        readAquariusPoolIndex: vi.fn().mockResolvedValue(""),
        readAquariusEstimateOut: vi.fn().mockResolvedValue(0),
      },
    );

    expect(plan.selectedProtocol).toBe("SOROSWAP");
    expect(plan.minOutBase).toBe(910_000);
    expect(plan.note).toMatch(/soroswap selected/i);
    expect(formatRebalanceProtocolLabel(plan.selectedProtocol)).toBe("SoroSwap");
  });

  it("selects a multi-hop SoroSwap path when it beats all direct routes", async () => {
    const plan = await resolveRebalanceRoutePlan(
      {
        requestedProtocol: "AUTO",
        amountBase: 1_000_000,
        tokenIn: "CAAA",
        tokenOut: "CBBB",
        slippagePct: 0.5,
        manualMinOutBase: 0,
        aquariusRouterId: "CAQUARIUS",
        routingAssets: ["CAAA", "CMID", "CBBB"],
      },
      {
        readSoroswapAmountOut: vi.fn().mockResolvedValue(1_010_000),
        readSoroswapAmountOutForPath: vi.fn().mockResolvedValue(1_120_000),
        readAquariusPoolIndex: vi.fn().mockResolvedValue("ab".repeat(32)),
        readAquariusEstimateOut: vi.fn().mockResolvedValue(1_070_000),
      },
    );

    expect(plan.selectedProtocol).toBe("SOROSWAP");
    expect(plan.selectedCandidate?.hops).toBe(2);
    expect(plan.selectedCandidate?.pathModel).toBe("router_multi_hop");
    expect(plan.selectedCandidate?.pathAssets).toEqual(["CAAA", "CMID", "CBBB"]);
    expect(plan.selectedCandidate?.title).toMatch(/SoroSwap via/i);
    expect(plan.note).toMatch(/2-hop route/i);
  });

  it("prefers a direct route when the multi-hop edge is too small after penalties", async () => {
    const plan = await resolveRebalanceRoutePlan(
      {
        requestedProtocol: "AUTO",
        amountBase: 1_000_000,
        tokenIn: "CAAA",
        tokenOut: "CBBB",
        slippagePct: 0.5,
        manualMinOutBase: 0,
        aquariusRouterId: "CAQUARIUS",
        routingAssets: ["CAAA", "CMID", "CBBB"],
      },
      {
        readSoroswapAmountOut: vi.fn().mockResolvedValue(1_050_000),
        readSoroswapAmountOutForPath: vi.fn().mockResolvedValue(1_051_000),
        readAquariusPoolIndex: vi.fn().mockResolvedValue(""),
        readAquariusEstimateOut: vi.fn().mockResolvedValue(1_010_000),
      },
    );

    expect(plan.selectedProtocol).toBe("SOROSWAP");
    expect(plan.selectedCandidate?.title).toBe("SoroSwap direct");
  });

  it("applies V2 best-execution scoring with explicit fee/fill/slippage components", async () => {
    const plan = await resolveRebalanceRoutePlan(
      {
        requestedProtocol: "AUTO",
        amountBase: 1_000_000,
        tokenIn: "CAAA",
        tokenOut: "CBBB",
        slippagePct: 0.5,
        manualMinOutBase: 0,
        aquariusRouterId: "CAQUARIUS",
      },
      {
        readSoroswapAmountOut: vi.fn().mockResolvedValue(1_010_000),
        readSoroswapAmountOutForPath: vi.fn().mockResolvedValue(0),
        readAquariusPoolIndex: vi.fn().mockResolvedValue("ab".repeat(32)),
        readAquariusEstimateOut: vi.fn().mockResolvedValue(1_009_600),
      },
    );

    expect(plan.selectedProtocol).toBe("AQUARIUS");
    expect(plan.selectedCandidate?.routeScoreComponents).toBeDefined();
    expect(plan.selectedCandidate?.routeScoreComponents?.feePenaltyBps).toBeGreaterThan(0);
    expect(plan.selectedCandidate?.routeScoreComponents?.fillRiskPenaltyBps).toBeGreaterThan(0);
    expect(plan.selectedCandidate?.routeScoreComponents?.slippagePenaltyBps).toBeGreaterThan(0);
    expect(plan.selectedCandidate?.routeScoreLabel).toMatch(/fee .*%/i);
    expect(plan.selectedCandidate?.routeScoreLabel).toMatch(/fill .*%/i);
    expect(plan.selectedCandidate?.routeScoreLabel).toMatch(/slip .*%/i);
    expect(plan.selectedCandidate?.routeScoreLabel).not.toMatch(/\bbps\b/i);
  });

  it("excludes a protocol from planning when policy admission blocks it", async () => {
    const plan = await resolveRebalanceRoutePlan(
      {
        requestedProtocol: "AUTO",
        amountBase: 1_000_000,
        tokenIn: "CAAA",
        tokenOut: "CBBB",
        slippagePct: 0.5,
        manualMinOutBase: 0,
        aquariusRouterId: "CAQUARIUS",
        protocolPolicies: {
          AQUARIUS: {
            planningEnabled: false,
            disabledReason: "Blocked for routing admission.",
          },
        },
      },
      {
        readSoroswapAmountOut: vi.fn().mockResolvedValue(1_010_000),
        readSoroswapAmountOutForPath: vi.fn().mockResolvedValue(0),
        readAquariusPoolIndex: vi.fn().mockResolvedValue("ab".repeat(32)),
        readAquariusEstimateOut: vi.fn().mockResolvedValue(1_500_000),
      },
    );

    const aquariusCandidate = plan.candidates.find((candidate) => candidate.protocol === "AQUARIUS");
    expect(aquariusCandidate?.available).toBe(false);
    expect(aquariusCandidate?.admitted).toBe(false);
    expect(aquariusCandidate?.note).toMatch(/blocked for routing admission/i);
    expect(plan.selectedProtocol).toBe("SOROSWAP");
  });

  it("keeps Balanced out of AUTO selection even when the lane is ready because no live quote exists yet", async () => {
    const plan = await resolveRebalanceRoutePlan(
      {
        requestedProtocol: "AUTO",
        amountBase: 1_000_000,
        tokenIn: "CAAA",
        tokenOut: "CBBB",
        slippagePct: 0.5,
        manualMinOutBase: 0,
        aquariusRouterId: "CAQUARIUS",
        balancedLane: {
          adapterId: "CBALANCED",
          poolId: 7,
          ready: true,
          supportStatus: "ready",
          laneMode: "expected_router",
          validatedModulePresent: true,
          comparableQuote: false,
          manualExecutionEligible: true,
          plannerAdmission: "manual_only",
          capabilityNote:
            "Arka can execute the current Balanced lane manually through the validated adapter path.",
          blockingReasons: [],
        },
        protocolPolicies: {
          BALANCED: {
            planningEnabled: true,
            executionEnabled: true,
          },
        },
      },
      {
        readSoroswapAmountOut: vi.fn().mockResolvedValue(1_010_000),
        readSoroswapAmountOutForPath: vi.fn().mockResolvedValue(0),
        readAquariusPoolIndex: vi.fn().mockResolvedValue("ab".repeat(32)),
        readAquariusEstimateOut: vi.fn().mockResolvedValue(1_090_000),
      },
    );

    const balancedCandidate = plan.candidates.find(
      (candidate) => candidate.protocol === "BALANCED",
    );
    expect(balancedCandidate?.available).toBe(true);
    expect(balancedCandidate?.autoEligible).toBe(false);
    expect(balancedCandidate?.venueFamily).toBe("intent_execution");
    expect(balancedCandidate?.quoteModel).toBe("manual_lane");
    expect(balancedCandidate?.settlementModel).toBe("intent_settlement");
    expect(balancedCandidate?.pathModel).toBe("adapter_gated");
    expect(balancedCandidate?.confirmationModel).toBe("transaction_hash_plus_refresh");
    expect(balancedCandidate?.routeScoreBase).toBe(0);
    expect(balancedCandidate?.routeScoreLabel).toMatch(/manual execution/i);
    expect(plan.selectedProtocol).toBe("AQUARIUS");
  });

  it("admits Balanced into AUTO only when official comparable intent evidence is enabled", async () => {
    const plan = await resolveRebalanceRoutePlan(
      {
        requestedProtocol: "AUTO",
        amountBase: 1_000_000,
        tokenIn: "CAAA",
        tokenOut: "CBBB",
        slippagePct: 0.5,
        manualMinOutBase: 0,
        aquariusRouterId: "CAQUARIUS",
        balancedLane: {
          adapterId: "CBALANCED",
          poolId: 7,
          ready: true,
          supportStatus: "ready",
          laneMode: "expected_router",
          validatedModulePresent: true,
          comparableQuote: true,
          manualExecutionEligible: true,
          plannerAdmission: "auto",
          capabilityNote:
            "Balanced official SODAX quote/status/confirm evidence is ready for AUTO.",
          blockingReasons: [],
        },
        balancedComparableQuoteOutBase: 1_150_000,
        balancedComparableQuoteProvider: "sodax_sdk",
        protocolPolicies: {
          BALANCED: {
            planningEnabled: true,
            executionEnabled: true,
          },
        },
      },
      {
        readSoroswapAmountOut: vi.fn().mockResolvedValue(1_080_000),
        readSoroswapAmountOutForPath: vi.fn().mockResolvedValue(0),
        readAquariusPoolIndex: vi.fn().mockResolvedValue("ab".repeat(32)),
        readAquariusEstimateOut: vi.fn().mockResolvedValue(1_100_000),
      },
    );

    const balancedCandidate = plan.candidates.find(
      (candidate) => candidate.protocol === "BALANCED",
    );
    expect(balancedCandidate?.available).toBe(true);
    expect(balancedCandidate?.autoEligible).toBe(true);
    expect(balancedCandidate?.quoteModel).toBe("public_intent_quote");
    expect(balancedCandidate?.estimatedOutBase).toBe(1_150_000);
    expect(balancedCandidate?.routeScoreBase).toBeGreaterThan(0);
    expect(balancedCandidate?.routeScoreLabel).toMatch(/score/i);
    expect(balancedCandidate?.note).toMatch(/sodax_sdk quote\/status/i);
    expect(plan.selectedProtocol).toBe("BALANCED");
    expect(plan.selectedCandidate?.title).toBe("Balanced direct");
    expect(plan.note).toMatch(/auto-selected balanced/i);
  });

  it("does not admit Balanced into AUTO when a live quote exists but planner posture is manual-only", async () => {
    const plan = await resolveRebalanceRoutePlan(
      {
        requestedProtocol: "AUTO",
        amountBase: 1_000_000,
        tokenIn: "CAAA",
        tokenOut: "CBBB",
        slippagePct: 0.5,
        manualMinOutBase: 0,
        aquariusRouterId: "CAQUARIUS",
        balancedLane: {
          adapterId: "CBALANCED",
          poolId: 7,
          ready: true,
          supportStatus: "ready",
          laneMode: "expected_router",
          validatedModulePresent: true,
          comparableQuote: false,
          manualExecutionEligible: true,
          plannerAdmission: "manual_only",
          capabilityNote:
            "Official SODAX quote/status/confirm are verified, but quoteComparableForArka is false.",
          blockingReasons: [],
        },
        balancedComparableQuoteOutBase: 1_150_000,
        balancedComparableQuoteProvider: "sodax_sdk",
        protocolPolicies: {
          BALANCED: {
            planningEnabled: false,
            executionEnabled: true,
            disabledReason:
              "Official SODAX quote/status/confirm are verified, but quoteComparableForArka is false.",
          },
        },
      },
      {
        readSoroswapAmountOut: vi.fn().mockResolvedValue(1_080_000),
        readSoroswapAmountOutForPath: vi.fn().mockResolvedValue(0),
        readAquariusPoolIndex: vi.fn().mockResolvedValue("ab".repeat(32)),
        readAquariusEstimateOut: vi.fn().mockResolvedValue(1_100_000),
      },
    );

    const balancedCandidate = plan.candidates.find(
      (candidate) => candidate.protocol === "BALANCED",
    );
    expect(balancedCandidate?.available).toBe(false);
    expect(balancedCandidate?.admitted).toBe(false);
    expect(balancedCandidate?.autoEligible).toBe(false);
    expect(balancedCandidate?.quoteModel).toBe("intent_surface_unverified");
    expect(balancedCandidate?.note).toMatch(/quoteComparableForArka is false/i);
    expect(plan.selectedProtocol).toBe("AQUARIUS");
  });

  it("keeps Balanced manual when quote exists but the comparable lifecycle is incomplete", async () => {
    const plan = await resolveRebalanceRoutePlan(
      {
        requestedProtocol: "AUTO",
        amountBase: 1_000_000,
        tokenIn: "CAAA",
        tokenOut: "CBBB",
        slippagePct: 0.5,
        manualMinOutBase: 0,
        aquariusRouterId: "CAQUARIUS",
        balancedLane: {
          adapterId: "CBALANCED",
          poolId: 7,
          ready: true,
          supportStatus: "ready",
          laneMode: "expected_router",
          validatedModulePresent: true,
          comparableQuote: true,
          manualExecutionEligible: true,
          plannerAdmission: "auto",
          capabilityNote:
            "Balanced route is ready and has comparable discovery.",
          blockingReasons: [],
        },
        balancedComparableLifecycleReady: false,
        balancedComparableQuoteOutBase: 1_250_000,
        balancedComparableQuoteProvider: "sodax_sdk",
        protocolPolicies: {
          BALANCED: {
            planningEnabled: true,
            executionEnabled: true,
          },
        },
      },
      {
        readSoroswapAmountOut: vi.fn().mockResolvedValue(1_080_000),
        readSoroswapAmountOutForPath: vi.fn().mockResolvedValue(0),
        readAquariusPoolIndex: vi.fn().mockResolvedValue("ab".repeat(32)),
        readAquariusEstimateOut: vi.fn().mockResolvedValue(1_100_000),
      },
    );

    const balancedCandidate = plan.candidates.find(
      (candidate) => candidate.protocol === "BALANCED",
    );
    expect(balancedCandidate?.available).toBe(true);
    expect(balancedCandidate?.autoEligible).toBe(false);
    expect(balancedCandidate?.quoteModel).toBe("manual_lane");
    expect(balancedCandidate?.estimatedOutBase).toBe(0);
    expect(balancedCandidate?.routeScoreBase).toBe(0);
    expect(balancedCandidate?.routeScoreLabel).toMatch(/manual execution/i);
    expect(balancedCandidate?.note).toMatch(/not complete enough for AUTO/i);
    expect(plan.selectedProtocol).toBe("AQUARIUS");
  });

  it("models extra fill-risk and fee for multi-hop paths in the score components", async () => {
    const plan = await resolveRebalanceRoutePlan(
      {
        requestedProtocol: "AUTO",
        amountBase: 1_000_000,
        tokenIn: "CAAA",
        tokenOut: "CBBB",
        slippagePct: 0.5,
        manualMinOutBase: 0,
        aquariusRouterId: "CAQUARIUS",
        routingAssets: ["CMID"],
      },
      {
        readSoroswapAmountOut: vi.fn().mockResolvedValue(1_005_000),
        readSoroswapAmountOutForPath: vi.fn().mockResolvedValue(1_090_000),
        readAquariusPoolIndex: vi.fn().mockResolvedValue("ab".repeat(32)),
        readAquariusEstimateOut: vi.fn().mockResolvedValue(1_020_000),
      },
    );

    const direct = plan.candidates.find(
      (candidate) =>
        candidate.protocol === "SOROSWAP" &&
        candidate.pathAssets.length === 2,
    );
    const multihop = plan.candidates.find(
      (candidate) =>
        candidate.protocol === "SOROSWAP" &&
        candidate.pathAssets.length === 3,
    );

    expect(direct?.routeScoreComponents).toBeDefined();
    expect(multihop?.routeScoreComponents).toBeDefined();
    expect(multihop?.routeScoreComponents?.feePenaltyBps ?? 0).toBeGreaterThan(
      direct?.routeScoreComponents?.feePenaltyBps ?? 0,
    );
    expect(
      multihop?.routeScoreComponents?.fillRiskPenaltyBps ?? 0,
    ).toBeGreaterThan(direct?.routeScoreComponents?.fillRiskPenaltyBps ?? 0);
    expect(multihop?.routeScoreComponents?.hopPenaltyBps ?? 0).toBeGreaterThan(0);
    expect(multihop?.routeScoreLabel).toMatch(/hop .*%/i);
    expect(multihop?.routeScoreLabel).not.toMatch(/\bbps\b/i);
  });

  it("uses risk-aware tie-breaking in near-score AUTO ties", async () => {
    const plan = await resolveRebalanceRoutePlan(
      {
        requestedProtocol: "AUTO",
        amountBase: 1_000_000,
        tokenIn: "CAAA",
        tokenOut: "CBBB",
        slippagePct: 0.5,
        manualMinOutBase: 0,
        aquariusRouterId: "CAQUARIUS",
      },
      {
        readSoroswapAmountOut: vi.fn(async (amountBase: number) =>
          Math.floor(amountBase * 1.02),
        ),
        readSoroswapAmountOutForPath: vi.fn().mockResolvedValue(0),
        readAquariusPoolIndex: vi.fn().mockResolvedValue("ab".repeat(32)),
        readAquariusEstimateOut: vi.fn().mockResolvedValue(1_018_000),
      },
    );

    const soroswapDirect = plan.candidates.find(
      (candidate) =>
        candidate.protocol === "SOROSWAP" && candidate.pathAssets.length === 2,
    );
    const aquariusDirect = plan.candidates.find(
      (candidate) => candidate.protocol === "AQUARIUS",
    );
    expect(soroswapDirect).toBeTruthy();
    expect(aquariusDirect).toBeTruthy();

    const reference = Math.max(
      soroswapDirect?.estimatedOutBase ?? 1,
      aquariusDirect?.estimatedOutBase ?? 1,
      1,
    );
    const scoreDeltaBps = Math.floor(
      (Math.abs((soroswapDirect?.routeScoreBase ?? 0) - (aquariusDirect?.routeScoreBase ?? 0)) *
        10_000) /
        reference,
    );
    expect(scoreDeltaBps).toBeLessThanOrEqual(10);
    expect(aquariusDirect?.routeScoreComponents?.effectivePenaltyBps).toBeLessThan(
      soroswapDirect?.routeScoreComponents?.effectivePenaltyBps ?? Number.MAX_SAFE_INTEGER,
    );

    expect(plan.selectedProtocol).toBe("AQUARIUS");
    expect(plan.note).toMatch(/auto-selected aquarius/i);
  });

  it("explores two-intermediate SoroSwap paths and can select a 3-hop route when net score wins", async () => {
    const plan = await resolveRebalanceRoutePlan(
      {
        requestedProtocol: "AUTO",
        amountBase: 1_000_000,
        tokenIn: "CAAA",
        tokenOut: "CBBB",
        slippagePct: 0.5,
        manualMinOutBase: 0,
        aquariusRouterId: "CAQUARIUS",
        routingAssets: ["CM1", "CM2", "CM3"],
      },
      {
        readSoroswapAmountOut: vi.fn().mockResolvedValue(1_010_000),
        readSoroswapAmountOutForPath: vi.fn(async (_amountBase, pathAssets) => {
          if (pathAssets.join(">") === "CAAA>CM1>CM2>CBBB") return 1_180_000;
          if (pathAssets.length === 3) return 1_060_000;
          return 1_020_000;
        }),
        readAquariusPoolIndex: vi.fn().mockResolvedValue("ab".repeat(32)),
        readAquariusEstimateOut: vi.fn().mockResolvedValue(1_090_000),
      },
    );

    const threeHop = plan.candidates.find(
      (candidate) =>
        candidate.protocol === "SOROSWAP" &&
        candidate.pathAssets.join(">") === "CAAA>CM1>CM2>CBBB",
    );
    expect(threeHop).toBeTruthy();
    expect(threeHop?.hops).toBe(3);
    expect(threeHop?.title).toMatch(/SoroSwap via/i);
    expect(threeHop?.routeScoreComponents?.hopPenaltyBps).toBeGreaterThan(0);
    expect(plan.selectedProtocol).toBe("SOROSWAP");
    expect(plan.selectedCandidate?.pathAssets.join(">")).toBe("CAAA>CM1>CM2>CBBB");
    expect(plan.note).toMatch(/3-hop route/i);
  });

  it("runs a broker-grade bounded global search over a million-plus SoroSwap path universe", async () => {
    const routingAssets = Array.from({ length: 24 }, (_, index) =>
      `C${String(index + 1).padStart(2, "0")}`,
    );
    const directQuote = vi.fn().mockResolvedValue(1_010_000);
    const pathQuote = vi.fn(async (_amountBase: number, pathAssets: string[]) => {
      if (pathAssets.join(">") === "CAAA>C24>C23>C22>C21>C20>CBBB") {
        return 1_620_000;
      }
      if (pathAssets.length >= 6) return 1_080_000;
      return 1_030_000;
    });

    const plan = await resolveRebalanceRoutePlan(
      {
        requestedProtocol: "AUTO",
        amountBase: 1_000_000,
        tokenIn: "CAAA",
        tokenOut: "CBBB",
        slippagePct: 0.5,
        manualMinOutBase: 0,
        aquariusRouterId: "CAQUARIUS",
        routingAssets,
        routingSearch: {
          maxIntermediaries: 24,
          maxHops: 6,
          quoteBudget: 12,
        },
      },
      {
        readSoroswapAmountOut: directQuote,
        readSoroswapAmountOutForPath: pathQuote,
        readAquariusPoolIndex: vi.fn().mockResolvedValue("ab".repeat(32)),
        readAquariusEstimateOut: vi.fn().mockResolvedValue(1_090_000),
      },
    );

    expect(plan.routeSearch).toMatchObject({
      strategy: "broker_grade_bounded_global_search",
      benchmarkScale: "million_scale_bounded",
      samplingModel: "broker_frontier_beam_tail_probe",
      maxIntermediaries: 24,
      maxHops: 6,
      quoteBudget: 12,
      beamWidth: 16,
      tailProbeCount: 96,
      quotedPathCount: 12,
      budgetUtilizationBps: 10_000,
      deepestGeneratedHops: 6,
      deepestQuotedHops: 6,
    });
    expect(plan.routeSearch?.generatedHopCounts).toEqual([
      { hops: 1, pathCount: 1 },
      { hops: 2, pathCount: 3 },
      { hops: 3, pathCount: 2 },
      { hops: 4, pathCount: 2 },
      { hops: 5, pathCount: 2 },
      { hops: 6, pathCount: 2 },
    ]);
    expect(plan.routeSearch?.quotedHopCounts).toEqual(
      plan.routeSearch?.generatedHopCounts,
    );
    expect(plan.routeSearch?.candidateUniverseSize ?? 0).toBeGreaterThan(1_000_000);
    expect(plan.routeSearch?.prunedPathCount ?? 0).toBeGreaterThan(1_000_000);
    expect(plan.routeSearch?.quoteCoverageBps ?? 0).toBe(0);
    expect(plan.routeSearch?.quoteCoveragePpm ?? 0).toBeGreaterThan(0);
    expect(plan.routeSearch?.quoteCoveragePpm ?? 0).toBeLessThan(100);
    expect(plan.routeSearch?.note).toMatch(/through 6 hops/i);
    expect(pathQuote.mock.calls.length).toBeGreaterThanOrEqual(11);
    expect(plan.candidates.length).toBeLessThanOrEqual(32);
    expect(plan.selectedProtocol).toBe("SOROSWAP");
    expect(plan.selectedCandidate?.hops).toBe(6);
    expect(plan.selectedCandidate?.pathAssets.join(">")).toBe(
      "CAAA>C24>C23>C22>C21>C20>CBBB",
    );
    expect(plan.note).toMatch(/Broker-grade bounded search evaluated 12 live SoroSwap quote paths/i);
  });

  it("uses broker frontier probes to recover cyclic multi-hop routes outside the head and tail lanes", async () => {
    const routingAssets = Array.from({ length: 16 }, (_, index) =>
      `C${String(index + 1).padStart(2, "0")}`,
    );
    const frontierPath = "CAAA>C01>C08>C15>CBBB";
    const pathQuote = vi.fn(async (_amountBase: number, pathAssets: string[]) => {
      const path = pathAssets.join(">");
      if (path === frontierPath) return 1_410_000;
      if (pathAssets.length === 4) return 1_070_000;
      if (pathAssets.length === 3) return 1_050_000;
      return 1_020_000;
    });

    const plan = await resolveRebalanceRoutePlan(
      {
        requestedProtocol: "AUTO",
        amountBase: 1_000_000,
        tokenIn: "CAAA",
        tokenOut: "CBBB",
        slippagePct: 0.5,
        manualMinOutBase: 0,
        aquariusRouterId: "CAQUARIUS",
        routingAssets,
        routingSearch: {
          maxIntermediaries: 16,
          maxHops: 4,
          quoteBudget: 18,
          beamWidth: 8,
          tailProbeCount: 32,
        },
      },
      {
        readSoroswapAmountOut: vi.fn().mockResolvedValue(1_010_000),
        readSoroswapAmountOutForPath: pathQuote,
        readAquariusPoolIndex: vi.fn().mockResolvedValue("ab".repeat(32)),
        readAquariusEstimateOut: vi.fn().mockResolvedValue(1_090_000),
      },
    );

    expect(plan.routeSearch).toMatchObject({
      strategy: "broker_grade_bounded_global_search",
      samplingModel: "broker_frontier_beam_tail_probe",
      maxIntermediaries: 16,
      maxHops: 4,
      quoteBudget: 18,
      beamWidth: 8,
      tailProbeCount: 32,
      quotedPathCount: 18,
    });
    expect(plan.routeSearch?.deterministicProbeCount ?? 0).toBeGreaterThan(18);
    expect(plan.selectedProtocol).toBe("SOROSWAP");
    expect(plan.selectedCandidate?.hops).toBe(4);
    expect(plan.selectedCandidate?.pathAssets.join(">")).toBe(frontierPath);
    expect(pathQuote.mock.calls.some((call) => call[1].join(">") === frontierPath)).toBe(true);
  });

  it("re-quotes marginal chunks and recommends an executable split route when it beats the best single route", async () => {
    const directQuote = vi.fn(async (amountBase: number) =>
      amountBase <= 500_000 ? Math.floor(amountBase * 1.14) : 1_030_000,
    );
    const pathQuote = vi.fn(async () => 0);
    const aquariusQuote = vi.fn(async (_router: string, _tokenIn: string, _tokenOut: string, _pool: string, amountBase: number) =>
      amountBase <= 500_000 ? Math.floor(amountBase * 1.12) : 1_050_000,
    );

    const plan = await resolveRebalanceRoutePlan(
      {
        requestedProtocol: "AUTO",
        amountBase: 1_000_000,
        tokenIn: "CAAA",
        tokenOut: "CBBB",
        slippagePct: 0.5,
        manualMinOutBase: 0,
        aquariusRouterId: "CAQUARIUS",
        routingSearch: {
          quoteBudget: 2,
          splitParts: 2,
        },
      },
      {
        readSoroswapAmountOut: directQuote,
        readSoroswapAmountOutForPath: pathQuote,
        readAquariusPoolIndex: vi.fn().mockResolvedValue("ab".repeat(32)),
        readAquariusEstimateOut: aquariusQuote,
      },
    );

    expect(plan.selectedProtocol).toBe("AQUARIUS");
    expect(plan.selectedCandidate?.estimatedOutBase).toBe(1_050_000);
    expect(plan.splitRoute).toMatchObject({
      status: "recommended",
      strategy: "chunked_global_best_execution",
      executable: true,
      allocationCount: 2,
      chunkCount: 2,
      routeCountCompared: 2,
      totalAmountInBase: 1_000_000,
      totalEstimatedOutBase: 1_130_000,
      singleRouteEstimatedOutBase: 1_050_000,
      estimatedImprovementBase: 80_000,
    });
    expect(plan.splitRoute?.allocations.map((allocation) => allocation.protocol).sort()).toEqual([
      "AQUARIUS",
      "SOROSWAP",
    ]);
    expect(
      plan.splitRoute?.allocations.every(
        (allocation) => allocation.amountInBase === 500_000,
      ),
    ).toBe(true);
    expect(plan.splitRoute?.note).toMatch(/globally evaluated/i);
  });

  it("preserves adapter and pool metadata for split SoroSwap multi-hop allocations", async () => {
    const directQuote = vi.fn(async (amountBase: number) =>
      amountBase <= 500_000 ? 800_000 : 1_000_000,
    );
    const pathQuote = vi.fn(async (amountBase: number, pathAssets: string[]) => {
      if (pathAssets.length === 3) {
        return amountBase <= 500_000 ? 600_000 : 1_010_000;
      }
      return 0;
    });

    const plan = await resolveRebalanceRoutePlan(
      {
        requestedProtocol: "AUTO",
        amountBase: 1_000_000,
        tokenIn: "CAAA",
        tokenOut: "CBBB",
        slippagePct: 0.5,
        manualMinOutBase: 0,
        aquariusRouterId: "CAQUARIUS",
        soroswapAdapterId: "CSOROSWAPADAPTER",
        routingAssets: ["CMID"],
        routingSearch: {
          quoteBudget: 2,
          splitParts: 2,
        },
      },
      {
        readSoroswapAmountOut: directQuote,
        readSoroswapAmountOutForPath: pathQuote,
        readAquariusPoolIndex: vi.fn().mockResolvedValue(""),
        readAquariusEstimateOut: vi.fn().mockResolvedValue(0),
      },
    );

    const multihopAllocation = plan.splitRoute?.allocations.find(
      (allocation) => allocation.pathAssets.length === 3,
    );

    expect(plan.splitRoute?.status).toBe("recommended");
    expect(multihopAllocation).toMatchObject({
      protocol: "SOROSWAP",
      adapterId: "CSOROSWAPADAPTER",
      poolId: 2,
      pathAssets: ["CAAA", "CMID", "CBBB"],
    });
  });

  it("globally optimizes chunk distributions instead of greedily missing delayed route efficiency", async () => {
    const directQuote = vi.fn(async (amountBase: number) => {
      if (amountBase <= 250_000) return 300_000;
      if (amountBase <= 500_000) return 550_000;
      if (amountBase <= 750_000) return 750_000;
      return 900_000;
    });
    const aquariusQuote = vi.fn(
      async (
        _router: string,
        _tokenIn: string,
        _tokenOut: string,
        _pool: string,
        amountBase: number,
      ) => {
        if (amountBase <= 250_000) return 50_000;
        if (amountBase <= 500_000) return 450_000;
        if (amountBase <= 750_000) return 850_000;
        return 900_000;
      },
    );

    const plan = await resolveRebalanceRoutePlan(
      {
        requestedProtocol: "AUTO",
        amountBase: 1_000_000,
        tokenIn: "CAAA",
        tokenOut: "CBBB",
        slippagePct: 0.5,
        manualMinOutBase: 0,
        aquariusRouterId: "CAQUARIUS",
        routingSearch: {
          quoteBudget: 2,
          splitParts: 4,
        },
      },
      {
        readSoroswapAmountOut: directQuote,
        readSoroswapAmountOutForPath: vi.fn().mockResolvedValue(0),
        readAquariusPoolIndex: vi.fn().mockResolvedValue("ab".repeat(32)),
        readAquariusEstimateOut: aquariusQuote,
      },
    );

    expect(plan.splitRoute).toMatchObject({
      status: "recommended",
      strategy: "chunked_global_best_execution",
      executable: true,
      allocationCount: 2,
      chunkCount: 4,
      routeCountCompared: 2,
      totalAmountInBase: 1_000_000,
      totalEstimatedOutBase: 1_150_000,
      singleRouteEstimatedOutBase: 900_000,
      estimatedImprovementBase: 250_000,
    });
    expect(plan.splitRoute?.allocations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          protocol: "SOROSWAP",
          amountInBase: 250_000,
          estimatedOutBase: 300_000,
        }),
        expect.objectContaining({
          protocol: "AQUARIUS",
          amountInBase: 750_000,
          estimatedOutBase: 850_000,
        }),
      ]),
    );
    expect(plan.splitRoute?.note).toMatch(/globally evaluated 5 executable chunk distributions/i);
  });

  it("allows explicit Balanced selection when the canonical lane is ready", async () => {
    const plan = await resolveRebalanceRoutePlan(
      {
        requestedProtocol: "BALANCED",
        amountBase: 1_000_000,
        tokenIn: "CAAA",
        tokenOut: "CBBB",
        slippagePct: 0.5,
        manualMinOutBase: 970_000,
        aquariusRouterId: "CAQUARIUS",
        balancedLane: {
          adapterId: "CBALANCED",
          poolId: 3,
          ready: true,
          supportStatus: "ready",
          laneMode: "expected_router",
          validatedModulePresent: true,
          comparableQuote: false,
          manualExecutionEligible: true,
          plannerAdmission: "manual_only",
          capabilityNote:
            "Arka can execute the current Balanced lane manually through the validated adapter path.",
          blockingReasons: [],
        },
        protocolPolicies: {
          BALANCED: {
            planningEnabled: true,
            executionEnabled: true,
          },
        },
      },
      {
        readSoroswapAmountOut: vi.fn().mockResolvedValue(1_010_000),
        readSoroswapAmountOutForPath: vi.fn().mockResolvedValue(0),
        readAquariusPoolIndex: vi.fn().mockResolvedValue(""),
        readAquariusEstimateOut: vi.fn().mockResolvedValue(1_090_000),
      },
    );

    expect(plan.selectedProtocol).toBe("BALANCED");
    expect(plan.selectedCandidate?.executionKind).toBe("balanced_adapter");
    expect(plan.selectedCandidate?.adapterId).toBe("CBALANCED");
    expect(plan.selectedCandidate?.poolId).toBe(3);
    expect(plan.selectedCandidate?.venueFamily).toBe("intent_execution");
    expect(plan.selectedCandidate?.quoteModel).toBe("manual_lane");
    expect(plan.selectedCandidate?.settlementModel).toBe("intent_settlement");
    expect(plan.selectedCandidate?.pathModel).toBe("adapter_gated");
    expect(plan.selectedCandidate?.confirmationModel).toBe("transaction_hash_plus_refresh");
    expect(plan.selectedCandidate?.minOutBase).toBe(970_000);
    expect(plan.note).toMatch(/balanced selected/i);
    expect(plan.note).toMatch(/Manual min-out override/i);
  });

  it("keeps explicit Balanced selection blocked with a clear reason until canonical readiness exists", async () => {
    const plan = await resolveRebalanceRoutePlan(
      {
        requestedProtocol: "BALANCED",
        amountBase: 1_000_000,
        tokenIn: "CAAA",
        tokenOut: "CBBB",
        slippagePct: 0.5,
        manualMinOutBase: 0,
        aquariusRouterId: "CAQUARIUS",
        balancedLane: {
          adapterId: "CBALANCED",
          poolId: 1,
          ready: false,
          supportStatus: "blocked",
          laneMode: "legacy_comet",
          validatedModulePresent: false,
          comparableQuote: false,
          manualExecutionEligible: false,
          plannerAdmission: "blocked",
          capabilityNote:
            "Balanced still points to the retired Comet lane.",
          blockingReasons: ["Balanced still points to the retired Comet lane."],
        },
      },
      {
        readSoroswapAmountOut: vi.fn().mockResolvedValue(1_010_000),
        readSoroswapAmountOutForPath: vi.fn().mockResolvedValue(0),
        readAquariusPoolIndex: vi.fn().mockResolvedValue(""),
        readAquariusEstimateOut: vi.fn().mockResolvedValue(1_090_000),
      },
    );

    expect(plan.selectedProtocol).toBe("BALANCED");
    expect(plan.selectedCandidate).toBeNull();
    expect(
      plan.candidates.find((candidate) => candidate.protocol === "BALANCED")?.quoteModel,
    ).toBe("intent_surface_unverified");
    expect(
      plan.candidates.find((candidate) => candidate.protocol === "BALANCED")?.confirmationModel,
    ).toBe("transaction_hash_plus_refresh");
    expect(plan.note).toMatch(/retired comet lane/i);
  });

  it("resolves the phase-2 guardrail policy from production defaults and safe overrides", () => {
    const policy = resolveRebalanceGuardrailPolicy({
      maxPathLength: 3,
      forbidRouteCycles: false,
      emergencyPauseSwap: true,
    });

    expect(policy.maxPathLength).toBe(3);
    expect(policy.forbidRouteCycles).toBe(false);
    expect(policy.emergencyPauseSwap).toBe(true);
    expect(policy.maxNotionalPerSwapBase).toBeGreaterThan(0);
    expect(policy.maxChunkSizeBase).toBeGreaterThan(0);
    expect(policy.dailyTurnoverCapBps).toBeGreaterThan(0);
  });

  it("blocks executable plans above the DAO-governed notional ceiling", async () => {
    const plan = await resolveRebalanceRoutePlan(
      {
        requestedProtocol: "AUTO",
        amountBase: 1_000_000,
        tokenIn: "CAAA",
        tokenOut: "CBBB",
        slippagePct: 0.5,
        manualMinOutBase: 0,
        aquariusRouterId: "CAQUARIUS",
        guardrailPolicy: {
          maxNotionalPerSwapBase: 500_000,
          chunkingThresholdBase: 2_000_000,
        },
      },
      {
        readSoroswapAmountOut: vi.fn(async (amountBase: number) =>
          Math.floor(amountBase * 1.02),
        ),
        readSoroswapAmountOutForPath: vi.fn().mockResolvedValue(0),
        readAquariusPoolIndex: vi.fn().mockResolvedValue("ab".repeat(32)),
        readAquariusEstimateOut: vi.fn(async (_router: string, _tokenIn: string, _tokenOut: string, _pool: string, amountBase: number) =>
          Math.floor(amountBase * 1.01),
        ),
      },
    );

    expect(plan.guardrails?.status).toBe("blocked");
    expect(plan.guardrails?.blockedReasons.join(" ")).toMatch(/max notional/i);
    expect(plan.selectedCandidate).toBeNull();
    expect(plan.estimatedOutBase).toBe(0);
  });

  it("blocks over-depth routes before handoff even when they quote best", async () => {
    const plan = await resolveRebalanceRoutePlan(
      {
        requestedProtocol: "AUTO",
        amountBase: 1_000_000,
        tokenIn: "CAAA",
        tokenOut: "CBBB",
        slippagePct: 0.5,
        manualMinOutBase: 0,
        aquariusRouterId: "CAQUARIUS",
        routingAssets: ["CM1", "CM2", "CM3"],
        guardrailPolicy: {
          maxPathLength: 2,
          chunkingThresholdBase: 2_000_000,
        },
      },
      {
        readSoroswapAmountOut: vi.fn().mockResolvedValue(1_010_000),
        readSoroswapAmountOutForPath: vi.fn(async (_amountBase, pathAssets) =>
          pathAssets.join(">") === "CAAA>CM1>CM2>CBBB"
            ? 1_300_000
            : 1_020_000,
        ),
        readAquariusPoolIndex: vi.fn().mockResolvedValue("ab".repeat(32)),
        readAquariusEstimateOut: vi.fn().mockResolvedValue(1_090_000),
      },
    );

    expect(plan.selectedProtocol).toBe("SOROSWAP");
    expect(plan.guardrails?.status).toBe("blocked");
    expect(
      plan.guardrails?.checks.find((check) => check.id === "max_path_length"),
    ).toMatchObject({
      status: "blocked",
      value: "3 hops",
      limit: "2 hops",
    });
    expect(plan.selectedCandidate).toBeNull();
  });

  it("admits large swaps only when the split-route optimizer produces bounded chunks", async () => {
    const directQuote = vi.fn(async (amountBase: number) =>
      amountBase <= 500_000 ? Math.floor(amountBase * 1.14) : 1_030_000,
    );
    const aquariusQuote = vi.fn(async (_router: string, _tokenIn: string, _tokenOut: string, _pool: string, amountBase: number) =>
      amountBase <= 500_000 ? Math.floor(amountBase * 1.12) : 1_050_000,
    );

    const plan = await resolveRebalanceRoutePlan(
      {
        requestedProtocol: "AUTO",
        amountBase: 1_000_000,
        tokenIn: "CAAA",
        tokenOut: "CBBB",
        slippagePct: 0.5,
        manualMinOutBase: 0,
        aquariusRouterId: "CAQUARIUS",
        routingSearch: {
          quoteBudget: 2,
          splitParts: 2,
        },
        guardrailPolicy: {
          maxNotionalPerSwapBase: 2_000_000,
          chunkingThresholdBase: 500_000,
          maxChunkSizeBase: 500_000,
        },
      },
      {
        readSoroswapAmountOut: directQuote,
        readSoroswapAmountOutForPath: vi.fn().mockResolvedValue(0),
        readAquariusPoolIndex: vi.fn().mockResolvedValue("ab".repeat(32)),
        readAquariusEstimateOut: aquariusQuote,
      },
    );

    expect(plan.splitRoute?.status).toBe("recommended");
    expect(plan.guardrails?.status).toBe("passed");
    expect(
      plan.guardrails?.checks.find((check) => check.id === "chunking_threshold"),
    ).toMatchObject({ status: "passed" });
    expect(
      plan.guardrails?.checks.find((check) => check.id === "max_chunk_size"),
    ).toMatchObject({ status: "passed", value: "500,000 notional" });
    expect(plan.selectedCandidate).not.toBeNull();
  });

  it("creates executable policy chunks when one route remains economically optimal", async () => {
    const plan = await resolveRebalanceRoutePlan(
      {
        requestedProtocol: "AUTO",
        amountBase: 1_000_000,
        tokenIn: "CAAA",
        tokenOut: "CBBB",
        slippagePct: 0.5,
        manualMinOutBase: 0,
        aquariusRouterId: "CAQUARIUS",
        routingSearch: {
          quoteBudget: 2,
          splitParts: 2,
        },
        guardrailPolicy: {
          maxNotionalPerSwapBase: 2_000_000,
          chunkingThresholdBase: 200_000,
          maxChunkSizeBase: 200_000,
        },
      },
      {
        readSoroswapAmountOut: vi.fn(async (amountBase: number) => amountBase),
        readSoroswapAmountOutForPath: vi.fn().mockResolvedValue(0),
        readAquariusPoolIndex: vi.fn().mockResolvedValue("ab".repeat(32)),
        readAquariusEstimateOut: vi.fn(async (_router: string, _tokenIn: string, _tokenOut: string, _pool: string, amountBase: number) =>
          Math.floor(amountBase * 0.99),
        ),
      },
    );

    expect(plan.splitRoute).toMatchObject({
      status: "recommended",
      executable: true,
      allocationCount: 5,
      chunkCount: 5,
      totalAmountInBase: 1_000_000,
    });
    expect(
      plan.splitRoute?.allocations.every(
        (allocation) => allocation.amountInBase <= 200_000,
      ),
    ).toBe(true);
    expect(
      plan.splitRoute?.allocations.reduce(
        (total, allocation) => total + allocation.amountInBase,
        0,
      ),
    ).toBe(1_000_000);
    expect(plan.splitRoute?.note).toMatch(/policy-bounded execution chunks/i);
    expect(plan.guardrails?.status).toBe("passed");
  });

  it("uses stateful deviation and daily-turnover inputs as final pre-sign blockers", async () => {
    const plan = await resolveRebalanceRoutePlan(
      {
        requestedProtocol: "AUTO",
        amountBase: 1_000_000,
        tokenIn: "CAAA",
        tokenOut: "CBBB",
        slippagePct: 0.5,
        manualMinOutBase: 0,
        aquariusRouterId: "CAQUARIUS",
        guardrailPolicy: {
          maxNotionalPerSwapBase: 2_000_000,
          chunkingThresholdBase: 2_000_000,
          postTradeDeviationBps: 100,
          dailyTurnoverCapBps: 1_000,
        },
        guardrailState: {
          vaultNavBase: 5_000_000,
          dailyTurnoverUsedBase: 0,
          projectedPostTradeDeviationBps: 125,
        },
      },
      {
        readSoroswapAmountOut: vi.fn(async (amountBase: number) =>
          Math.floor(amountBase * 1.02),
        ),
        readSoroswapAmountOutForPath: vi.fn().mockResolvedValue(0),
        readAquariusPoolIndex: vi.fn().mockResolvedValue("ab".repeat(32)),
        readAquariusEstimateOut: vi.fn(async (_router: string, _tokenIn: string, _tokenOut: string, _pool: string, amountBase: number) =>
          Math.floor(amountBase * 1.01),
        ),
      },
    );

    expect(plan.guardrails?.status).toBe("blocked");
    expect(
      plan.guardrails?.checks.find((check) => check.id === "post_trade_deviation_bps"),
    ).toMatchObject({
      status: "blocked",
      value: "1.25%",
      evidence: {
        source: "explicit_projection",
        amountBase: 1_000_000,
        vaultNavBase: 5_000_000,
      },
    });
    expect(
      plan.guardrails?.checks.find((check) => check.id === "daily_turnover_cap_bps"),
    ).toMatchObject({ status: "blocked", limit: "500,000 notional" });
    expect(plan.selectedCandidate).toBeNull();
  });

  it("requires explicit daily-turnover state instead of treating unavailable indexed activity as zero", async () => {
    const plan = await resolveRebalanceRoutePlan(
      {
        requestedProtocol: "AUTO",
        amountBase: 1_000_000,
        tokenIn: "CAAA",
        tokenOut: "CBBB",
        slippagePct: 0.5,
        manualMinOutBase: 0,
        aquariusRouterId: "CAQUARIUS",
        guardrailPolicy: {
          maxNotionalPerSwapBase: 2_000_000,
          chunkingThresholdBase: 2_000_000,
          postTradeDeviationBps: 100,
          dailyTurnoverCapBps: 1_000,
        },
        guardrailState: {
          vaultNavBase: 50_000_000,
          projectedPostTradeDeviationBps: 75,
        },
      },
      {
        readSoroswapAmountOut: vi.fn(async (amountBase: number) =>
          Math.floor(amountBase * 1.02),
        ),
        readSoroswapAmountOutForPath: vi.fn().mockResolvedValue(0),
        readAquariusPoolIndex: vi.fn().mockResolvedValue("ab".repeat(32)),
        readAquariusEstimateOut: vi.fn(async (_router: string, _tokenIn: string, _tokenOut: string, _pool: string, amountBase: number) =>
          Math.floor(amountBase * 1.01),
        ),
      },
    );

    expect(plan.guardrails?.status).toBe("passed");
    expect(
      plan.guardrails?.checks.find((check) => check.id === "daily_turnover_cap_bps"),
    ).toMatchObject({
      status: "requires_state",
      value: "state required",
      limit: "10.00% of NAV",
      evidence: {
        source: "missing_state",
        amountBase: 1_000_000,
        vaultNavBase: 50_000_000,
      },
    });
    expect(plan.selectedCandidate).not.toBeNull();
  });

  it("does not compare raw units from different assets to derive post-trade deviation", async () => {
    const plan = await resolveRebalanceRoutePlan(
      {
        requestedProtocol: "AUTO",
        amountBase: 1_000_000,
        tokenIn: "CAAA",
        tokenOut: "CBBB",
        slippagePct: 0.5,
        manualMinOutBase: 0,
        aquariusRouterId: "CAQUARIUS",
        guardrailPolicy: {
          maxNotionalPerSwapBase: 2_000_000,
          chunkingThresholdBase: 2_000_000,
          postTradeDeviationBps: 100,
          dailyTurnoverCapBps: 1_000,
        },
        guardrailState: {
          vaultNavBase: 50_000_000,
          dailyTurnoverUsedBase: 100_000,
        },
        requiredStatefulGuardrails: ["post_trade_deviation_bps"],
      },
      {
        readSoroswapAmountOut: vi.fn(async (amountBase: number) =>
          Math.floor(amountBase * 1.02),
        ),
        readSoroswapAmountOutForPath: vi.fn().mockResolvedValue(0),
        readAquariusPoolIndex: vi.fn().mockResolvedValue("ab".repeat(32)),
        readAquariusEstimateOut: vi.fn(async (_router: string, _tokenIn: string, _tokenOut: string, _pool: string, amountBase: number) =>
          Math.floor(amountBase * 1.01),
        ),
      },
    );

    expect(plan.guardrails?.status).toBe("blocked");
    expect(
      plan.guardrails?.checks.find(
        (check) => check.id === "post_trade_deviation_bps",
      ),
    ).toMatchObject({
      status: "requires_state",
      value: "state required",
      evidence: {
        source: "missing_state",
        amountBase: 1_000_000,
        vaultNavBase: 50_000_000,
      },
    });
    expect(plan.selectedCandidate).toBeNull();
  });

  it("blocks pre-sign execution when a required stateful guardrail is unavailable", async () => {
    const plan = await resolveRebalanceRoutePlan(
      {
        requestedProtocol: "AUTO",
        amountBase: 1_000_000,
        tokenIn: "CAAA",
        tokenOut: "CBBB",
        slippagePct: 0.5,
        manualMinOutBase: 0,
        aquariusRouterId: "CAQUARIUS",
        guardrailPolicy: {
          maxNotionalPerSwapBase: 2_000_000,
          chunkingThresholdBase: 2_000_000,
          postTradeDeviationBps: 100,
          dailyTurnoverCapBps: 1_000,
        },
        guardrailState: {
          vaultNavBase: 50_000_000,
          projectedPostTradeDeviationBps: 75,
        },
        requiredStatefulGuardrails: ["daily_turnover_cap_bps"],
      },
      {
        readSoroswapAmountOut: vi.fn().mockResolvedValue(1_020_000),
        readSoroswapAmountOutForPath: vi.fn().mockResolvedValue(0),
        readAquariusPoolIndex: vi.fn().mockResolvedValue("ab".repeat(32)),
        readAquariusEstimateOut: vi.fn().mockResolvedValue(1_010_000),
      },
    );

    expect(plan.guardrails?.status).toBe("blocked");
    expect(
      plan.guardrails?.checks.find((check) => check.id === "daily_turnover_cap_bps"),
    ).toMatchObject({
      status: "requires_state",
      value: "state required",
      evidence: {
        source: "missing_state",
        amountBase: 1_000_000,
      },
    });
    expect(plan.guardrails?.blockedReasons.join(" ")).toMatch(
      /Daily turnover cap/i,
    );
    expect(plan.selectedCandidate).toBeNull();
    expect(plan.note).toMatch(/blocked by phase-2 swap guardrails/i);
  });

  it("blocks pre-sign execution when required post-trade deviation state is unavailable", async () => {
    const plan = await resolveRebalanceRoutePlan(
      {
        requestedProtocol: "AUTO",
        amountBase: 1_000_000,
        tokenIn: "CAAA",
        tokenOut: "CBBB",
        slippagePct: 0.5,
        manualMinOutBase: 0,
        aquariusRouterId: "CAQUARIUS",
        guardrailPolicy: {
          maxNotionalPerSwapBase: 2_000_000,
          chunkingThresholdBase: 2_000_000,
          postTradeDeviationBps: 100,
          dailyTurnoverCapBps: 1_000,
        },
        guardrailState: {
          dailyTurnoverUsedBase: 100_000,
        },
        requiredStatefulGuardrails: ["post_trade_deviation_bps"],
      },
      {
        readSoroswapAmountOut: vi.fn().mockResolvedValue(1_020_000),
        readSoroswapAmountOutForPath: vi.fn().mockResolvedValue(0),
        readAquariusPoolIndex: vi.fn().mockResolvedValue("ab".repeat(32)),
        readAquariusEstimateOut: vi.fn().mockResolvedValue(1_010_000),
      },
    );

    expect(plan.guardrails?.status).toBe("blocked");
    expect(
      plan.guardrails?.checks.find(
        (check) => check.id === "post_trade_deviation_bps",
      ),
    ).toMatchObject({
      status: "requires_state",
      value: "state required",
    });
    expect(plan.guardrails?.blockedReasons.join(" ")).toMatch(
      /Post-trade deviation/i,
    );
    expect(plan.selectedCandidate).toBeNull();
    expect(plan.note).toMatch(/blocked by phase-2 swap guardrails/i);
  });
});
