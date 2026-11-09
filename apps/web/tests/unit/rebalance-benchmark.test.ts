import { describe, expect, it } from "vitest";
import { runRebalanceBenchmarkSuite } from "@/lib/workflows/rebalanceBenchmark";

describe("rebalance benchmark suite", () => {
  it("passes the bounded exhaustive Smart Routing benchmark cases", async () => {
    const report = await runRebalanceBenchmarkSuite();

    expect(report.overallPassed).toBe(true);
    expect(report.resultCount).toBe(7);
    expect(report.passedCount).toBe(7);
    expect(report.worstEfficiencyBps).toBeGreaterThanOrEqual(9_850);
    expect(report.results.map((result) => result.id)).toEqual([
      "bounded_exhaustive_deep_path",
      "cyclic_frontier_gap_profile",
      "chunked_split_route",
      "delayed_efficiency_split_route",
      "production_scale_tail_path_profile",
      "multi_venue_fill_risk_arbiter",
      "no_live_venue_fail_closed",
    ]);
    expect(report.brokerComparison).toEqual(
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
    expect(report.brokerComparison.venuesCovered).toEqual([
      "SOROSWAP",
      "AQUARIUS",
      "SUSHI",
    ]);
    expect(report.brokerComparison.optionalVenuesNotCovered).toEqual([
      "BALANCED",
    ]);
    expect(report.brokerComparison.maxCandidateUniverseSize).toBeGreaterThan(
      20_000_000,
    );
  });

  it("proves the bounded sampler can recover a deep profitable path", async () => {
    const report = await runRebalanceBenchmarkSuite();
    const deepPath = report.results.find(
      (result) => result.id === "bounded_exhaustive_deep_path",
    );

    expect(deepPath).toBeDefined();
    expect(deepPath?.passed).toBe(true);
    expect(deepPath?.plannerSelectedProtocol).toBe("SOROSWAP");
    expect(deepPath?.plannerSelectedPath).toContain("C10");
    expect(deepPath?.exhaustivePathCount).toBeGreaterThan(5_000);
    expect(deepPath?.quotedPathCount).toBeLessThan(deepPath?.exhaustivePathCount ?? 0);
    expect(deepPath?.plannerEstimatedOutBase).toBe(deepPath?.oracleEstimatedOutBase);
    expect(deepPath?.oracleModel).toBe("exhaustive_route_enumeration");
  });

  it("recovers non-obvious cyclic frontier paths that are not pure head or tail probes", async () => {
    const report = await runRebalanceBenchmarkSuite();
    const cyclic = report.results.find(
      (result) => result.id === "cyclic_frontier_gap_profile",
    );

    expect(cyclic).toBeDefined();
    expect(cyclic?.mode).toBe("single_route");
    expect(cyclic?.passed).toBe(true);
    expect(cyclic?.plannerSelectedProtocol).toBe("SOROSWAP");
    expect(cyclic?.plannerSelectedPath).toContain("C01");
    expect(cyclic?.plannerSelectedPath).toContain("C08");
    expect(cyclic?.plannerSelectedPath).toContain("C15");
    expect(cyclic?.plannerEstimatedOutBase).toBe(cyclic?.oracleEstimatedOutBase);
    expect(cyclic?.oracleModel).toBe("exhaustive_route_enumeration");
    expect(cyclic?.quotedPathCount).toBe(18);
  });

  it("compares split routing against exhaustive chunk assignment", async () => {
    const report = await runRebalanceBenchmarkSuite();
    const split = report.results.find(
      (result) => result.id === "chunked_split_route",
    );

    expect(split).toBeDefined();
    expect(split?.mode).toBe("split_route");
    expect(split?.passed).toBe(true);
    expect(split?.splitStatus).toBe("recommended");
    expect(split?.splitAllocationCount).toBeGreaterThan(1);
    expect(split?.comparedRouteCount).toBeGreaterThan(1);
    expect(split?.plannerEstimatedOutBase).toBe(split?.oracleEstimatedOutBase);
    expect(split?.oracleModel).toBe("exhaustive_chunk_assignment");
  });

  it("catches delayed-efficiency split cases that greedy marginal selection misses", async () => {
    const report = await runRebalanceBenchmarkSuite();
    const delayed = report.results.find(
      (result) => result.id === "delayed_efficiency_split_route",
    );

    expect(delayed).toBeDefined();
    expect(delayed?.mode).toBe("split_route");
    expect(delayed?.passed).toBe(true);
    expect(delayed?.splitStatus).toBe("recommended");
    expect(delayed?.splitAllocationCount).toBe(2);
    expect(delayed?.plannerEstimatedOutBase).toBe(delayed?.oracleEstimatedOutBase);
    expect(delayed?.plannerEstimatedOutBase ?? 0).toBeGreaterThan(
      delayed?.amountBase ?? 0,
    );
  });

  it("profiles a production-scale tail path without enumerating the full universe in memory", async () => {
    const report = await runRebalanceBenchmarkSuite();
    const productionScale = report.results.find(
      (result) => result.id === "production_scale_tail_path_profile",
    );

    expect(productionScale).toBeDefined();
    expect(productionScale?.mode).toBe("single_route");
    expect(productionScale?.passed).toBe(true);
    expect(productionScale?.plannerSelectedProtocol).toBe("SOROSWAP");
    expect(productionScale?.plannerSelectedPath).toContain("C32");
    expect(productionScale?.plannerSelectedPath).toContain("C28");
    expect(productionScale?.oracleModel).toBe("known_global_best_route");
    expect(productionScale?.oraclePathCount).toBe(4);
    expect(productionScale?.maxIntermediaries).toBe(32);
    expect(productionScale?.maxHops).toBe(6);
    expect(productionScale?.quoteBudget).toBe(128);
    expect(productionScale?.quotedPathCount).toBe(128);
    expect(productionScale?.candidateUniverseSize ?? 0).toBeGreaterThan(
      20_000_000,
    );
    expect(productionScale?.exhaustivePathCount).toBe(
      productionScale?.candidateUniverseSize,
    );
    expect(productionScale?.quoteCoveragePpm ?? 0).toBeGreaterThan(0);
    expect(productionScale?.quoteCoveragePpm ?? 0).toBeLessThan(10);
    expect(productionScale?.plannerEstimatedOutBase).toBe(
      productionScale?.oracleEstimatedOutBase,
    );
  });

  it("records fill-risk scoring when a safer venue beats a higher raw AMM quote", async () => {
    const report = await runRebalanceBenchmarkSuite();
    const fillRisk = report.results.find(
      (result) => result.id === "multi_venue_fill_risk_arbiter",
    );

    expect(fillRisk).toBeDefined();
    expect(fillRisk?.mode).toBe("single_route");
    expect(fillRisk?.passed).toBe(true);
    expect(fillRisk?.fillRiskModel).toBe("route_score_penalty");
    expect(fillRisk?.plannerSelectedProtocol).toBe("AQUARIUS");
    expect(fillRisk?.bestRawProtocol).toBe("SOROSWAP");
    expect(fillRisk?.bestRawEstimatedOutBase ?? 0).toBeGreaterThan(
      fillRisk?.plannerEstimatedOutBase ?? 0,
    );
    expect(fillRisk?.selectedRawEfficiencyBps ?? 0).toBeGreaterThanOrEqual(9_850);
    expect(fillRisk?.worstComparedFillRiskPenaltyBps ?? 0).toBeGreaterThan(
      fillRisk?.selectedRouteFillRiskPenaltyBps ?? 0,
    );
    expect(fillRisk?.venuesCompared).toEqual([
      "SOROSWAP",
      "AQUARIUS",
      "SUSHI",
    ]);
  });

  it("includes a failure-mode case that passes only by failing closed", async () => {
    const report = await runRebalanceBenchmarkSuite();
    const failClosed = report.results.find(
      (result) => result.id === "no_live_venue_fail_closed",
    );

    expect(failClosed).toBeDefined();
    expect(failClosed?.mode).toBe("fail_closed");
    expect(failClosed?.failureCase).toBe(true);
    expect(failClosed?.failClosed).toBe(true);
    expect(failClosed?.passed).toBe(true);
    expect(failClosed?.plannerEstimatedOutBase).toBe(0);
    expect(failClosed?.oracleEstimatedOutBase).toBe(0);
    expect(failClosed?.plannerSelectedPath).toBe("No live route selected");
    expect(failClosed?.oracleModel).toBe("fail_closed_no_live_route");
  });
});
