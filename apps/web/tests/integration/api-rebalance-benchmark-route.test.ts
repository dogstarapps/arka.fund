// @vitest-environment node

import { afterEach, describe, expect, it, vi } from "vitest";
import {
  OPERATOR_TEST_PUBLIC_KEY,
  OPERATOR_TEST_SECRET,
  operatorRequest,
} from "../helpers/operator-auth";

describe("GET /api/routing/rebalance/benchmark", () => {
  afterEach(() => {
    vi.resetModules();
    vi.unstubAllEnvs();
  });

  function configureOperatorAccess() {
    vi.stubEnv("OPERATOR_ACCESS_SECRET", OPERATOR_TEST_SECRET);
    vi.stubEnv("NEXT_PUBLIC_ARKA_MANAGER", OPERATOR_TEST_PUBLIC_KEY);
  }

  it("requires a verified operator session", async () => {
    const { GET } = await import("@/app/api/routing/rebalance/benchmark/route");

    const response = await GET(
      new Request("http://localhost/api/routing/rebalance/benchmark"),
    );
    const payload = await response.json();

    expect(response.status).toBe(401);
    expect(payload.error).toBe("operator_access_required");
  });

  it("returns the machine-consumable routing benchmark gate", async () => {
    configureOperatorAccess();
    const { GET } = await import("@/app/api/routing/rebalance/benchmark/route");

    const response = await GET(
      operatorRequest("http://localhost/api/routing/rebalance/benchmark"),
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.ok).toBe(true);
    expect(payload.source).toBe("routing_benchmark");
    expect(payload.generatedAt).toEqual(expect.any(String));
    expect(payload.targetNetwork).toMatch(/^(testnet|mainnet)$/);
    expect(payload.benchmark.overallPassed).toBe(true);
    expect(payload.benchmark.resultCount).toBe(7);
    expect(payload.benchmark.worstEfficiencyBps).toBeGreaterThanOrEqual(9_850);
    expect(payload.benchmark.brokerComparison).toEqual(
      expect.objectContaining({
        profile: "broker_top_tier",
        requiredResultCount: 7,
        allRequiredVenuesCovered: true,
        productionScaleReady: true,
        releaseEligible: true,
        millionScaleScenarioCount: 1,
        splitRouteScenarioCount: 2,
        failureCaseCount: 1,
        failClosedCaseCount: 1,
      }),
    );
    expect(payload.benchmark.brokerComparison.venuesCovered).toEqual([
      "SOROSWAP",
      "AQUARIUS",
      "SUSHI",
    ]);
    expect(payload.routingCanary).toEqual(
      expect.objectContaining({
        ready: true,
        required: false,
        status: "not_required",
        targetNetwork: "testnet",
      }),
    );
    expect(payload.benchmark.results).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "bounded_exhaustive_deep_path",
          passed: true,
        }),
        expect.objectContaining({
          id: "cyclic_frontier_gap_profile",
          oracleModel: "exhaustive_route_enumeration",
          quoteBudget: 18,
          quotedPathCount: 18,
          passed: true,
        }),
        expect.objectContaining({
          id: "chunked_split_route",
          splitStatus: "recommended",
          passed: true,
        }),
        expect.objectContaining({
          id: "delayed_efficiency_split_route",
          splitStatus: "recommended",
          passed: true,
        }),
        expect.objectContaining({
          id: "production_scale_tail_path_profile",
          oracleModel: "known_global_best_route",
          quoteBudget: 128,
          quotedPathCount: 128,
          passed: true,
        }),
        expect.objectContaining({
          id: "multi_venue_fill_risk_arbiter",
          plannerSelectedProtocol: "AQUARIUS",
          bestRawProtocol: "SOROSWAP",
          fillRiskModel: "route_score_penalty",
          passed: true,
        }),
        expect.objectContaining({
          id: "no_live_venue_fail_closed",
          oracleModel: "fail_closed_no_live_route",
          failureCase: true,
          failClosed: true,
          passed: true,
        }),
      ]),
    );
  });
});
