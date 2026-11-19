import type { RebalanceBenchmarkReport } from "@/lib/workflows/rebalanceBenchmark";

export type RebalanceBenchmarkGateSnapshot = {
  ready: boolean;
  status: "ready" | "blocked";
  code:
    | "ready"
    | "benchmark_failed"
    | "benchmark_unavailable"
    | "broker_comparison_incomplete";
  target: "smart_routing";
  minRequiredEfficiencyBps: number;
  checks: {
    overallPassed: boolean;
    passedCount: number;
    resultCount: number;
    worstEfficiencyBps: number;
    failedResultIds: string[];
    brokerProfile?: string;
    corpusVersion?: string;
    requiredResultCount?: number;
    venuesCovered?: string[];
    allRequiredVenuesCovered?: boolean;
    productionScaleReady?: boolean;
    releaseEligible?: boolean;
    millionScaleScenarioCount?: number;
    splitRouteScenarioCount?: number;
    failureCaseCount?: number;
    failClosedCaseCount?: number;
    maxCandidateUniverseSize?: number;
    totalQuotedPathCount?: number;
    lowestQuoteCoveragePpm?: number;
    worstFillRiskPenaltyBps?: number;
    worstEffectivePenaltyBps?: number;
  };
  reason: string;
};

export const DEFAULT_REBALANCE_BENCHMARK_MIN_EFFICIENCY_BPS = 9_850;

export function deriveRebalanceBenchmarkGate(
  report: RebalanceBenchmarkReport | null,
  error?: string,
): RebalanceBenchmarkGateSnapshot {
  if (!report) {
    return {
      ready: false,
      status: "blocked",
      code: "benchmark_unavailable",
      target: "smart_routing",
      minRequiredEfficiencyBps: DEFAULT_REBALANCE_BENCHMARK_MIN_EFFICIENCY_BPS,
      checks: {
        overallPassed: false,
        passedCount: 0,
        resultCount: 0,
        worstEfficiencyBps: 0,
        failedResultIds: [],
      },
      reason:
        error && error.trim().length > 0
          ? `Smart Routing benchmark unavailable: ${error}`
          : "Smart Routing benchmark unavailable.",
    };
  }

  const failedResultIds = report.results
    .filter((result) => !result.passed)
    .map((result) => result.id);
  const ready =
    report.overallPassed &&
    report.resultCount > 0 &&
    report.passedCount === report.resultCount &&
    report.worstEfficiencyBps >= DEFAULT_REBALANCE_BENCHMARK_MIN_EFFICIENCY_BPS &&
    report.brokerComparison.releaseEligible;
  const comparisonIncomplete =
    report.passedCount === report.resultCount &&
    report.worstEfficiencyBps >= DEFAULT_REBALANCE_BENCHMARK_MIN_EFFICIENCY_BPS &&
    !report.brokerComparison.releaseEligible;

  return {
    ready,
    status: ready ? "ready" : "blocked",
    code: ready
      ? "ready"
      : comparisonIncomplete
        ? "broker_comparison_incomplete"
        : "benchmark_failed",
    target: "smart_routing",
    minRequiredEfficiencyBps: DEFAULT_REBALANCE_BENCHMARK_MIN_EFFICIENCY_BPS,
    checks: {
      overallPassed: report.overallPassed,
      passedCount: report.passedCount,
      resultCount: report.resultCount,
      worstEfficiencyBps: report.worstEfficiencyBps,
      failedResultIds,
      brokerProfile: report.brokerComparison.profile,
      corpusVersion: report.brokerComparison.corpusVersion,
      requiredResultCount: report.brokerComparison.requiredResultCount,
      venuesCovered: report.brokerComparison.venuesCovered,
      allRequiredVenuesCovered:
        report.brokerComparison.allRequiredVenuesCovered,
      productionScaleReady: report.brokerComparison.productionScaleReady,
      releaseEligible: report.brokerComparison.releaseEligible,
      millionScaleScenarioCount:
        report.brokerComparison.millionScaleScenarioCount,
      splitRouteScenarioCount:
        report.brokerComparison.splitRouteScenarioCount,
      failureCaseCount: report.brokerComparison.failureCaseCount,
      failClosedCaseCount: report.brokerComparison.failClosedCaseCount,
      maxCandidateUniverseSize:
        report.brokerComparison.maxCandidateUniverseSize,
      totalQuotedPathCount: report.brokerComparison.totalQuotedPathCount,
      lowestQuoteCoveragePpm: report.brokerComparison.lowestQuoteCoveragePpm,
      worstFillRiskPenaltyBps:
        report.brokerComparison.worstFillRiskPenaltyBps,
      worstEffectivePenaltyBps:
        report.brokerComparison.worstEffectivePenaltyBps,
    },
    reason: ready
      ? `Smart Routing broker comparison passed ${report.passedCount}/${report.resultCount} cases with worst efficiency ${(report.worstEfficiencyBps / 100).toFixed(2)}%, ${report.brokerComparison.maxCandidateUniverseSize.toLocaleString()} max candidate universe and ${report.brokerComparison.venuesCovered.join(", ")} venue coverage.`
      : comparisonIncomplete
        ? `Smart Routing broker comparison incomplete: ${report.passedCount}/${report.resultCount} cases passed, but production-scale/venue/failure coverage is not release-eligible.`
        : `Smart Routing benchmark blocked release: ${report.passedCount}/${report.resultCount} cases passed, worst efficiency ${(report.worstEfficiencyBps / 100).toFixed(2)}%.`,
  };
}
