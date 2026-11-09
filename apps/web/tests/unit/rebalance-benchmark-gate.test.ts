import { describe, expect, it } from "vitest";
import {
  DEFAULT_REBALANCE_BENCHMARK_MIN_EFFICIENCY_BPS,
  deriveRebalanceBenchmarkGate,
} from "@/lib/runtime/rebalanceBenchmarkGate";
import type { RebalanceBenchmarkReport } from "@/lib/workflows/rebalanceBenchmark";

function makeReport(
  overrides: Partial<RebalanceBenchmarkReport> = {},
): RebalanceBenchmarkReport {
  const base: RebalanceBenchmarkReport = {
    overallPassed: true,
    resultCount: 2,
    passedCount: 2,
    worstEfficiencyBps: DEFAULT_REBALANCE_BENCHMARK_MIN_EFFICIENCY_BPS,
    results: [
      {
        id: "bounded_exhaustive_deep_path",
        label: "Bounded exhaustive deep-path benchmark",
        mode: "single_route",
        passed: true,
        minEfficiencyBps: DEFAULT_REBALANCE_BENCHMARK_MIN_EFFICIENCY_BPS,
        plannerEfficiencyBps: 10_000,
        amountBase: 1_000_000,
        plannerEstimatedOutBase: 1_300_000,
        oracleEstimatedOutBase: 1_300_000,
        plannerSelectedProtocol: "SOROSWAP",
        plannerSelectedPath: "CAAA -> C10 -> C09 -> C08 -> C07 -> CBBB",
        splitStatus: "idle",
        splitAllocationCount: 0,
        candidateUniverseSize: 5_862,
        quotedPathCount: 64,
        exhaustivePathCount: 5_862,
        comparedRouteCount: 5_863,
        oracleModel: "exhaustive_route_enumeration",
        oraclePathCount: 5_862,
        quoteBudget: 64,
        maxHops: 5,
        maxIntermediaries: 10,
        quoteCoveragePpm: 10_918,
        brokerGrade: true,
        failureCase: false,
        failClosed: false,
        venuesCompared: ["SOROSWAP", "AQUARIUS"],
        bestRawProtocol: "SOROSWAP",
        bestRawEstimatedOutBase: 1_300_000,
        selectedRawEfficiencyBps: 10_000,
        selectedRouteFillRiskPenaltyBps: 58,
        selectedRouteEffectivePenaltyBps: 403,
        worstComparedFillRiskPenaltyBps: 58,
        worstComparedEffectivePenaltyBps: 403,
        fillRiskModel: "route_score_penalty",
        note: "QA benchmark fixture for bounded global route search.",
      },
      {
        id: "chunked_split_route",
        label: "Chunked split-route benchmark",
        mode: "split_route",
        passed: true,
        minEfficiencyBps: DEFAULT_REBALANCE_BENCHMARK_MIN_EFFICIENCY_BPS,
        plannerEfficiencyBps: 10_000,
        amountBase: 1_000_000,
        plannerEstimatedOutBase: 1_230_000,
        oracleEstimatedOutBase: 1_230_000,
        plannerSelectedProtocol: "AUTO_SPLIT",
        plannerSelectedPath: "Split across AQUARIUS and SOROSWAP",
        splitStatus: "recommended",
        splitAllocationCount: 4,
        candidateUniverseSize: 4,
        quotedPathCount: 4,
        exhaustivePathCount: 5,
        comparedRouteCount: 4,
        oracleModel: "exhaustive_chunk_assignment",
        oraclePathCount: 5,
        quoteBudget: 6,
        maxHops: 2,
        maxIntermediaries: 2,
        quoteCoveragePpm: 800_000,
        brokerGrade: true,
        failureCase: false,
        failClosed: false,
        venuesCompared: ["SOROSWAP", "AQUARIUS"],
        bestRawProtocol: "SOROSWAP",
        bestRawEstimatedOutBase: 1_230_000,
        selectedRawEfficiencyBps: 10_000,
        selectedRouteFillRiskPenaltyBps: 18,
        selectedRouteEffectivePenaltyBps: 223,
        worstComparedFillRiskPenaltyBps: 28,
        worstComparedEffectivePenaltyBps: 268,
        fillRiskModel: "split_allocation_penalty",
        note: "QA benchmark fixture for split-route global allocation.",
      },
    ],
    brokerComparison: {
      profile: "broker_top_tier",
      corpusVersion: "test",
      corpusName: "test broker corpus",
      requiredResultCount: 2,
      requiredVenues: ["SOROSWAP", "AQUARIUS"],
      optionalVenues: ["BALANCED"],
      venuesCovered: ["SOROSWAP", "AQUARIUS"],
      optionalVenuesNotCovered: ["BALANCED"],
      oracleModelsCovered: [
        "exhaustive_route_enumeration",
        "exhaustive_chunk_assignment",
      ],
      highScaleScenarioCount: 1,
      millionScaleScenarioCount: 1,
      splitRouteScenarioCount: 1,
      failureCaseCount: 1,
      failClosedCaseCount: 1,
      maxCandidateUniverseSize: 5_862,
      totalCandidateUniverseSize: 5_866,
      totalQuotedPathCount: 68,
      lowestQuoteCoveragePpm: 10_918,
      worstEfficiencyBps: DEFAULT_REBALANCE_BENCHMARK_MIN_EFFICIENCY_BPS,
      worstFillRiskPenaltyBps: 58,
      worstEffectivePenaltyBps: 403,
      allRequiredVenuesCovered: true,
      productionScaleReady: true,
      releaseEligible: true,
      notes: ["fixture"],
    },
  };
  return {
    ...base,
    ...overrides,
    results: overrides.results ?? base.results,
  };
}

describe("rebalanceBenchmarkGate", () => {
  it("marks the release gate ready when every benchmark clears the threshold", () => {
    const gate = deriveRebalanceBenchmarkGate(makeReport());

    expect(gate.ready).toBe(true);
    expect(gate.status).toBe("ready");
    expect(gate.code).toBe("ready");
    expect(gate.target).toBe("smart_routing");
    expect(gate.checks.failedResultIds).toEqual([]);
    expect(gate.checks.worstEfficiencyBps).toBeGreaterThanOrEqual(
      gate.minRequiredEfficiencyBps,
    );
    expect(gate.checks.brokerProfile).toBe("broker_top_tier");
    expect(gate.checks.releaseEligible).toBe(true);
    expect(gate.reason).toContain("broker comparison passed");
  });

  it("blocks release when any competitive benchmark fails", () => {
    const report = makeReport({
      overallPassed: false,
      passedCount: 1,
      worstEfficiencyBps: 9_100,
      results: [
        makeReport().results[0],
        {
          ...makeReport().results[1],
          passed: false,
          plannerEfficiencyBps: 9_100,
        },
      ],
    });

    const gate = deriveRebalanceBenchmarkGate(report);

    expect(gate.ready).toBe(false);
    expect(gate.status).toBe("blocked");
    expect(gate.code).toBe("benchmark_failed");
    expect(gate.checks.failedResultIds).toEqual(["chunked_split_route"]);
    expect(gate.reason).toContain("blocked release");
  });

  it("blocks release when efficiency passes but broker corpus coverage is incomplete", () => {
    const report = makeReport({
      overallPassed: false,
      brokerComparison: {
        ...makeReport().brokerComparison,
        releaseEligible: false,
        productionScaleReady: false,
        millionScaleScenarioCount: 0,
      },
    });

    const gate = deriveRebalanceBenchmarkGate(report);

    expect(gate.ready).toBe(false);
    expect(gate.status).toBe("blocked");
    expect(gate.code).toBe("broker_comparison_incomplete");
    expect(gate.checks.productionScaleReady).toBe(false);
    expect(gate.checks.releaseEligible).toBe(false);
    expect(gate.reason).toContain("broker comparison incomplete");
  });

  it("blocks release when the benchmark suite is unavailable", () => {
    const gate = deriveRebalanceBenchmarkGate(null, "solver runtime failed");

    expect(gate.ready).toBe(false);
    expect(gate.status).toBe("blocked");
    expect(gate.code).toBe("benchmark_unavailable");
    expect(gate.checks.resultCount).toBe(0);
    expect(gate.reason).toContain("solver runtime failed");
  });
});
