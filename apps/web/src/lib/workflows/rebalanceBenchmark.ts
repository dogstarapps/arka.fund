import {
  resolveRebalanceRoutePlan,
  type ManualRebalanceProtocol,
  type RebalanceRouteCandidate,
  type RebalanceRoutePlan,
  type RebalanceRouteReaders,
  type RebalanceRouteSearchConfig,
} from "@/lib/workflows/rebalanceRouting";

type BenchmarkQuoteModel = {
  soroswapPathQuoteBps: (pathAssets: string[], amountBase: number) => number;
  aquariusQuoteBps: (amountBase: number) => number;
  sushiQuoteBps?: (amountBase: number) => number;
};

type BenchmarkRouteSearchConfig = Required<
  Pick<
    RebalanceRouteSearchConfig,
    "maxIntermediaries" | "maxHops" | "quoteBudget" | "splitParts"
  >
> &
  Pick<RebalanceRouteSearchConfig, "beamWidth" | "tailProbeCount">;

type BenchmarkScenario = {
  id: string;
  label: string;
  note: string;
  tokenIn: string;
  tokenOut: string;
  amountBase: number;
  slippagePct: number;
  routingAssets: string[];
  routingSearch: BenchmarkRouteSearchConfig;
  minEfficiencyBps: number;
  mode: "single_route" | "split_route" | "fail_closed";
  quoteModel: BenchmarkQuoteModel;
  oraclePaths?: string[][];
  exhaustivePathCountOverride?: number;
  protocolPolicies?: Parameters<typeof resolveRebalanceRoutePlan>[0]["protocolPolicies"];
};

export type BrokerComparisonProfile = {
  profile: "broker_top_tier";
  corpusVersion: string;
  corpusName: string;
  requiredResultCount: number;
  requiredVenues: ManualRebalanceProtocol[];
  optionalVenues: ManualRebalanceProtocol[];
  venuesCovered: ManualRebalanceProtocol[];
  optionalVenuesNotCovered: ManualRebalanceProtocol[];
  oracleModelsCovered: RebalanceBenchmarkResult["oracleModel"][];
  highScaleScenarioCount: number;
  millionScaleScenarioCount: number;
  splitRouteScenarioCount: number;
  failureCaseCount: number;
  failClosedCaseCount: number;
  maxCandidateUniverseSize: number;
  totalCandidateUniverseSize: number;
  totalQuotedPathCount: number;
  lowestQuoteCoveragePpm: number;
  worstEfficiencyBps: number;
  worstFillRiskPenaltyBps: number;
  worstEffectivePenaltyBps: number;
  allRequiredVenuesCovered: boolean;
  productionScaleReady: boolean;
  releaseEligible: boolean;
  notes: string[];
};

export type RebalanceBenchmarkResult = {
  id: string;
  label: string;
  mode: BenchmarkScenario["mode"];
  passed: boolean;
  minEfficiencyBps: number;
  plannerEfficiencyBps: number;
  amountBase: number;
  plannerEstimatedOutBase: number;
  oracleEstimatedOutBase: number;
  plannerSelectedProtocol: string;
  plannerSelectedPath: string;
  splitStatus: string;
  splitAllocationCount: number;
  candidateUniverseSize: number;
  quotedPathCount: number;
  exhaustivePathCount: number;
  comparedRouteCount: number;
  oracleModel:
    | "exhaustive_route_enumeration"
    | "known_global_best_route"
    | "exhaustive_chunk_assignment"
    | "fail_closed_no_live_route";
  oraclePathCount: number;
  quoteBudget: number;
  maxHops: number;
  maxIntermediaries: number;
  quoteCoveragePpm: number;
  brokerGrade: boolean;
  failureCase: boolean;
  failClosed: boolean;
  venuesCompared: ManualRebalanceProtocol[];
  bestRawProtocol: ManualRebalanceProtocol | "NONE";
  bestRawEstimatedOutBase: number;
  selectedRawEfficiencyBps: number;
  selectedRouteFillRiskPenaltyBps: number;
  selectedRouteEffectivePenaltyBps: number;
  worstComparedFillRiskPenaltyBps: number;
  worstComparedEffectivePenaltyBps: number;
  fillRiskModel:
    | "route_score_penalty"
    | "split_allocation_penalty"
    | "fail_closed";
  note: string;
};

export type RebalanceBenchmarkReport = {
  overallPassed: boolean;
  resultCount: number;
  passedCount: number;
  worstEfficiencyBps: number;
  brokerComparison: BrokerComparisonProfile;
  results: RebalanceBenchmarkResult[];
};

const BENCHMARK_AQUARIUS_POOL_INDEX = "ab".repeat(32);
const BROKER_COMPARISON_CORPUS_VERSION = "2026-05-20.t17";
const BROKER_COMPARISON_REQUIRED_RESULTS = 7;
const BROKER_COMPARISON_REQUIRED_VENUES: ManualRebalanceProtocol[] = [
  "SOROSWAP",
  "AQUARIUS",
];
const BROKER_COMPARISON_OPTIONAL_VENUES: ManualRebalanceProtocol[] = [
  "SUSHI",
  "BALANCED",
];
const BROKER_COMPARISON_MIN_MILLION_SCALE_CASES = 1;
const BROKER_COMPARISON_MIN_SPLIT_CASES = 2;
const BROKER_COMPARISON_MIN_FAILURE_CASES = 1;

function calculateBps(numerator: number, denominator: number): number {
  if (numerator <= 0 || denominator <= 0) return 0;
  return Math.min(10_000, Math.floor((numerator * 10_000) / denominator));
}

function quoteFromBps(amountBase: number, bps: number): number {
  if (amountBase <= 0 || bps <= 0) return 0;
  return Math.max(0, Math.floor((amountBase * bps) / 10_000));
}

function uniqueSortedVenues(
  venues: Array<ManualRebalanceProtocol | "NONE" | undefined>,
): ManualRebalanceProtocol[] {
  const order: ManualRebalanceProtocol[] = [
    "SOROSWAP",
    "AQUARIUS",
    "SUSHI",
    "BALANCED",
  ];
  const available = new Set(
    venues.filter(
      (venue): venue is ManualRebalanceProtocol =>
        venue === "SOROSWAP" ||
        venue === "AQUARIUS" ||
        venue === "SUSHI" ||
        venue === "BALANCED",
    ),
  );
  return order.filter((venue) => available.has(venue));
}

function uniqueSortedOracleModels(
  models: RebalanceBenchmarkResult["oracleModel"][],
): RebalanceBenchmarkResult["oracleModel"][] {
  const order: RebalanceBenchmarkResult["oracleModel"][] = [
    "exhaustive_route_enumeration",
    "known_global_best_route",
    "exhaustive_chunk_assignment",
    "fail_closed_no_live_route",
  ];
  const available = new Set(models);
  return order.filter((model) => available.has(model));
}

function resolveWorstPenalty(
  candidates: RebalanceRouteCandidate[],
  key: "fillRiskPenaltyBps" | "effectivePenaltyBps",
): number {
  return candidates.reduce((worst, candidate) => {
    const value = candidate.routeScoreComponents?.[key] ?? 0;
    return Math.max(worst, value);
  }, 0);
}

function resolveSelectedPenalty(
  candidate: RebalanceRouteCandidate | null,
  key: "fillRiskPenaltyBps" | "effectivePenaltyBps",
): number {
  return candidate?.routeScoreComponents?.[key] ?? 0;
}

function resolveBestRawCandidate(
  candidates: RebalanceRouteCandidate[],
): {
  protocol: ManualRebalanceProtocol | "NONE";
  estimatedOutBase: number;
} {
  const best = candidates
    .filter((candidate) => candidate.available && candidate.estimatedOutBase > 0)
    .sort((left, right) => {
      if (right.estimatedOutBase !== left.estimatedOutBase) {
        return right.estimatedOutBase - left.estimatedOutBase;
      }
      return left.routeId.localeCompare(right.routeId);
    })[0];
  return best
    ? { protocol: best.protocol, estimatedOutBase: best.estimatedOutBase }
    : { protocol: "NONE", estimatedOutBase: 0 };
}

function permutationCount(size: number, length: number): number {
  if (length === 0) return 1;
  if (length > size) return 0;
  let total = 1;
  for (let index = 0; index < length; index += 1) {
    total *= size - index;
  }
  return total;
}

function countSoroswapPathUniverse(input: {
  intermediaryCount: number;
  maxHops: number;
}): number {
  const maxIntermediariesInPath = Math.min(
    input.intermediaryCount,
    Math.max(0, input.maxHops - 1),
  );
  let total = 0;
  for (let length = 0; length <= maxIntermediariesInPath; length += 1) {
    total += permutationCount(input.intermediaryCount, length);
  }
  return total;
}

function createBenchmarkReaders(
  scenario: BenchmarkScenario,
): RebalanceRouteReaders {
  return {
    readSoroswapAmountOut: async (amountInBase, tokenIn, tokenOut) =>
      quoteFromBps(
        amountInBase,
        scenario.quoteModel.soroswapPathQuoteBps([tokenIn, tokenOut], amountInBase),
      ),
    readSoroswapAmountOutForPath: async (amountInBase, pathAssets) =>
      quoteFromBps(
        amountInBase,
        scenario.quoteModel.soroswapPathQuoteBps(pathAssets, amountInBase),
      ),
    readAquariusPoolIndex: async () => BENCHMARK_AQUARIUS_POOL_INDEX,
    readAquariusEstimateOut: async (
      _routerId,
      _tokenIn,
      _tokenOut,
      _poolIndexHex32,
      amountInBase,
    ) => quoteFromBps(amountInBase, scenario.quoteModel.aquariusQuoteBps(amountInBase)),
    readSushiEstimateOut: async (_adapter, _poolId, _tokenIn, _tokenOut, amountInBase) =>
      quoteFromBps(
        amountInBase,
        scenario.quoteModel.sushiQuoteBps?.(amountInBase) ?? 0,
      ),
  };
}

function enumerateIntermediaryPaths(input: {
  tokenIn: string;
  tokenOut: string;
  routingAssets: string[];
  maxHops: number;
}): string[][] {
  const intermediaries = Array.from(
    new Set(
      input.routingAssets.filter(
        (asset) =>
          asset &&
          asset !== input.tokenIn &&
          asset !== input.tokenOut,
      ),
    ),
  );
  const maxIntermediaries = Math.min(
    intermediaries.length,
    Math.max(0, input.maxHops - 1),
  );
  const paths: string[][] = [[input.tokenIn, input.tokenOut]];

  function visit(prefix: string[], used: Set<string>, targetLength: number) {
    if (prefix.length === targetLength) {
      paths.push([input.tokenIn, ...prefix, input.tokenOut]);
      return;
    }
    for (const asset of intermediaries) {
      if (used.has(asset)) continue;
      used.add(asset);
      prefix.push(asset);
      visit(prefix, used, targetLength);
      prefix.pop();
      used.delete(asset);
    }
  }

  for (let length = 1; length <= maxIntermediaries; length += 1) {
    visit([], new Set<string>(), length);
  }

  return paths;
}

function resolveSingleRouteOracle(input: {
  scenario: BenchmarkScenario;
  paths: string[][];
}): number {
  const bestSoroswap = input.paths.reduce((best, pathAssets) => {
    const quote = quoteFromBps(
      input.scenario.amountBase,
      input.scenario.quoteModel.soroswapPathQuoteBps(
        pathAssets,
        input.scenario.amountBase,
      ),
    );
    return Math.max(best, quote);
  }, 0);
  const aquarius = quoteFromBps(
    input.scenario.amountBase,
    input.scenario.quoteModel.aquariusQuoteBps(input.scenario.amountBase),
  );
  const sushi = quoteFromBps(
    input.scenario.amountBase,
    input.scenario.quoteModel.sushiQuoteBps?.(input.scenario.amountBase) ?? 0,
  );
  return Math.max(bestSoroswap, aquarius, sushi);
}

function buildSplitBenchmarkRouteSet(
  scenario: BenchmarkScenario,
  plan: RebalanceRoutePlan,
): RebalanceRouteCandidate[] {
  return plan.candidates.filter(
    (candidate) =>
      candidate.protocol !== "BALANCED" &&
      candidate.available &&
      candidate.autoEligible &&
      candidate.estimatedOutBase > 0 &&
      candidate.pathAssets.length >= 2,
  );
}

function quoteBenchmarkCandidate(
  scenario: BenchmarkScenario,
  candidate: RebalanceRouteCandidate,
  amountBase: number,
): number {
  if (candidate.protocol === "AQUARIUS") {
    return quoteFromBps(amountBase, scenario.quoteModel.aquariusQuoteBps(amountBase));
  }
  if (candidate.protocol === "SUSHI") {
    return quoteFromBps(
      amountBase,
      scenario.quoteModel.sushiQuoteBps?.(amountBase) ?? 0,
    );
  }
  return quoteFromBps(
    amountBase,
    scenario.quoteModel.soroswapPathQuoteBps(candidate.pathAssets, amountBase),
  );
}

function resolveSplitRouteOracle(input: {
  scenario: BenchmarkScenario;
  plan: RebalanceRoutePlan;
}): { oracleEstimatedOutBase: number; comparedRouteCount: number } {
  const routeSet = buildSplitBenchmarkRouteSet(input.scenario, input.plan);
  if (routeSet.length === 0) {
    return {
      oracleEstimatedOutBase: 0,
      comparedRouteCount: 0,
    };
  }

  const chunkCount = Math.max(1, input.scenario.routingSearch.splitParts);
  const baseChunk = Math.floor(input.scenario.amountBase / chunkCount);
  let remainder = input.scenario.amountBase - baseChunk * chunkCount;
  const chunks = Array.from({ length: chunkCount }, () => {
    const chunk = baseChunk + (remainder > 0 ? 1 : 0);
    remainder = Math.max(0, remainder - 1);
    return chunk;
  }).filter((chunk) => chunk > 0);
  let bestOut = 0;
  const assigned = new Map<string, number>();

  function visit(chunkIndex: number) {
    if (chunkIndex >= chunks.length) {
      const totalOut = Array.from(assigned.entries()).reduce(
        (total, [routeId, amountBase]) => {
          const candidate = routeSet.find((route) => route.routeId === routeId);
          if (!candidate) return total;
          return total + quoteBenchmarkCandidate(input.scenario, candidate, amountBase);
        },
        0,
      );
      bestOut = Math.max(bestOut, totalOut);
      return;
    }

    for (const route of routeSet) {
      assigned.set(route.routeId, (assigned.get(route.routeId) ?? 0) + chunks[chunkIndex]);
      visit(chunkIndex + 1);
      const nextAmount = (assigned.get(route.routeId) ?? 0) - chunks[chunkIndex];
      if (nextAmount > 0) assigned.set(route.routeId, nextAmount);
      else assigned.delete(route.routeId);
    }
  }

  visit(0);
  return {
    oracleEstimatedOutBase: bestOut,
    comparedRouteCount: routeSet.length,
  };
}

function resolvePlannerOut(plan: RebalanceRoutePlan): number {
  if (
    plan.splitRoute?.status === "recommended" &&
    plan.splitRoute.executable &&
    plan.splitRoute.totalEstimatedOutBase > 0
  ) {
    return plan.splitRoute.totalEstimatedOutBase;
  }
  return plan.estimatedOutBase;
}

function resolveScenarioOraclePaths(scenario: BenchmarkScenario): string[][] {
  if (scenario.oraclePaths && scenario.oraclePaths.length > 0) {
    return scenario.oraclePaths;
  }
  return enumerateIntermediaryPaths({
    tokenIn: scenario.tokenIn,
    tokenOut: scenario.tokenOut,
    routingAssets: scenario.routingAssets,
    maxHops: scenario.routingSearch.maxHops,
  });
}

function resolveOracleModel(
  scenario: BenchmarkScenario,
): RebalanceBenchmarkResult["oracleModel"] {
  if (scenario.mode === "fail_closed") return "fail_closed_no_live_route";
  if (scenario.mode === "split_route") return "exhaustive_chunk_assignment";
  return scenario.oraclePaths && scenario.oraclePaths.length > 0
    ? "known_global_best_route"
    : "exhaustive_route_enumeration";
}

function buildDeepPathScenario(): BenchmarkScenario {
  const routingAssets = Array.from({ length: 10 }, (_, index) =>
    `C${String(index + 1).padStart(2, "0")}`,
  );
  const tailPath = ["CAAA", "C10", "C09", "C08", "C07", "CBBB"].join(">");
  const headPath = ["CAAA", "C01", "C02", "C03", "C04", "CBBB"].join(">");

  return {
    id: "bounded_exhaustive_deep_path",
    label: "Bounded exhaustive deep-path benchmark",
    note:
      "Compares the bounded broker sampler against an exhaustive route universe for a deep profitable SoroSwap path.",
    tokenIn: "CAAA",
    tokenOut: "CBBB",
    amountBase: 1_000_000,
    slippagePct: 0.5,
    routingAssets,
    routingSearch: {
      maxIntermediaries: routingAssets.length,
      maxHops: 5,
      quoteBudget: 64,
      splitParts: 4,
    },
    minEfficiencyBps: 9_850,
    mode: "single_route",
    quoteModel: {
      aquariusQuoteBps: () => 11_800,
      soroswapPathQuoteBps: (pathAssets) => {
        const key = pathAssets.join(">");
        if (key === tailPath) return 13_000;
        if (key === headPath) return 11_900;
        if (pathAssets.length === 2) return 10_500;
        const pathDepthBonus = Math.min(900, Math.max(0, pathAssets.length - 2) * 120);
        const symbolBonus =
          pathAssets
            .slice(1, -1)
            .reduce((total, asset) => total + Number(asset.slice(-2) || "0"), 0) % 180;
        return 10_500 + pathDepthBonus + symbolBonus;
      },
    },
  };
}

function buildCyclicFrontierScenario(): BenchmarkScenario {
  const routingAssets = Array.from({ length: 16 }, (_, index) =>
    `C${String(index + 1).padStart(2, "0")}`,
  );
  const frontierPath = ["CAAA", "C01", "C08", "C15", "CBBB"].join(">");
  const tailPath = ["CAAA", "C16", "C15", "C14", "CBBB"].join(">");
  const headPath = ["CAAA", "C01", "C16", "C08", "CBBB"].join(">");

  return {
    id: "cyclic_frontier_gap_profile",
    label: "Cyclic frontier gap profile",
    note:
      "Forces the router to recover a profitable route that is neither the head path nor the pure tail path, validating broker-style deterministic frontier probes.",
    tokenIn: "CAAA",
    tokenOut: "CBBB",
    amountBase: 1_000_000,
    slippagePct: 0.5,
    routingAssets,
    routingSearch: {
      maxIntermediaries: routingAssets.length,
      maxHops: 4,
      quoteBudget: 18,
      splitParts: 4,
      beamWidth: 8,
      tailProbeCount: 32,
    },
    minEfficiencyBps: 9_850,
    mode: "single_route",
    quoteModel: {
      aquariusQuoteBps: () => 11_200,
      soroswapPathQuoteBps: (pathAssets) => {
        const key = pathAssets.join(">");
        if (key === frontierPath) return 14_100;
        if (key === tailPath) return 12_000;
        if (key === headPath) return 11_900;
        if (pathAssets.length === 2) return 10_500;
        return 10_700 + Math.max(0, pathAssets.length - 2) * 80;
      },
    },
  };
}

function buildSplitRouteScenario(): BenchmarkScenario {
  return {
    id: "chunked_split_route",
    label: "Chunked split-route benchmark",
    note:
      "Compares global chunk-distribution allocation against an exhaustive chunk assignment across live AMM routes.",
    tokenIn: "CAAA",
    tokenOut: "CBBB",
    amountBase: 1_000_000,
    slippagePct: 0.5,
    routingAssets: ["CAAA", "CALT", "CMID", "CBBB"],
    routingSearch: {
      maxIntermediaries: 2,
      maxHops: 2,
      quoteBudget: 6,
      splitParts: 4,
    },
    minEfficiencyBps: 9_850,
    mode: "split_route",
    quoteModel: {
      aquariusQuoteBps: (amountBase) => {
        if (amountBase <= 250_000) return 12_100;
        if (amountBase <= 500_000) return 11_700;
        return 10_400;
      },
      soroswapPathQuoteBps: (pathAssets, amountBase) => {
        if (pathAssets.length > 2) {
          if (amountBase <= 250_000) return 11_900;
          if (amountBase <= 500_000) return 11_500;
          return 10_350;
        }
        if (amountBase <= 250_000) return 12_300;
        if (amountBase <= 500_000) return 11_800;
        return 10_500;
      },
    },
  };
}

function buildDelayedEfficiencySplitScenario(): BenchmarkScenario {
  return {
    id: "delayed_efficiency_split_route",
    label: "Delayed-efficiency split-route benchmark",
    note:
      "Proves the split optimizer can allocate into a route whose first chunk is weak but whose later chunks unlock the best global output.",
    tokenIn: "CAAA",
    tokenOut: "CBBB",
    amountBase: 1_000_000,
    slippagePct: 0.5,
    routingAssets: ["CAAA", "CBBB"],
    routingSearch: {
      maxIntermediaries: 0,
      maxHops: 1,
      quoteBudget: 1,
      splitParts: 4,
    },
    minEfficiencyBps: 9_850,
    mode: "split_route",
    quoteModel: {
      aquariusQuoteBps: (amountBase) => {
        if (amountBase <= 250_000) return 2_000;
        if (amountBase <= 500_000) return 9_000;
        if (amountBase <= 750_000) return 11_333;
        return 9_000;
      },
      soroswapPathQuoteBps: (_pathAssets, amountBase) => {
        if (amountBase <= 250_000) return 12_000;
        if (amountBase <= 500_000) return 11_000;
        if (amountBase <= 750_000) return 10_000;
        return 9_000;
      },
    },
  };
}

function buildProductionScaleKnownPathScenario(): BenchmarkScenario {
  const routingAssets = Array.from({ length: 32 }, (_, index) =>
    `C${String(index + 1).padStart(2, "0")}`,
  );
  const directPath = ["CAAA", "CBBB"];
  const targetPath = ["CAAA", "C32", "C31", "C30", "C29", "C28", "CBBB"];
  const headPath = ["CAAA", "C01", "C02", "C03", "C04", "C05", "CBBB"];
  const middlePath = ["CAAA", "C16", "C17", "C18", "C19", "C20", "CBBB"];
  const targetKey = targetPath.join(">");
  const headKey = headPath.join(">");
  const middleKey = middlePath.join(">");

  return {
    id: "production_scale_tail_path_profile",
    label: "Production-scale tail-path profile",
    note:
      "Profiles the broker sampler against a 32-intermediary, 6-hop universe without enumerating every route in memory; the known oracle path is injected and must be recovered from the bounded quote budget.",
    tokenIn: "CAAA",
    tokenOut: "CBBB",
    amountBase: 2_500_000,
    slippagePct: 0.5,
    routingAssets,
    routingSearch: {
      maxIntermediaries: routingAssets.length,
      maxHops: 6,
      quoteBudget: 128,
      splitParts: 8,
    },
    minEfficiencyBps: 9_850,
    mode: "single_route",
    oraclePaths: [directPath, headPath, middlePath, targetPath],
    exhaustivePathCountOverride: countSoroswapPathUniverse({
      intermediaryCount: routingAssets.length,
      maxHops: 6,
    }),
    quoteModel: {
      aquariusQuoteBps: () => 11_750,
      soroswapPathQuoteBps: (pathAssets) => {
        const key = pathAssets.join(">");
        if (key === targetKey) return 14_100;
        if (key === headKey) return 12_250;
        if (key === middleKey) return 12_050;
        if (pathAssets.length === 2) return 10_500;
        const routeDepth = Math.max(0, pathAssets.length - 2);
        const tailBias =
          pathAssets
            .slice(1, -1)
            .filter((asset) => Number(asset.slice(-2)) >= 28).length * 80;
        return Math.min(12_000, 10_700 + routeDepth * 110 + tailBias);
      },
    },
  };
}

function buildMultiVenueFillRiskScenario(): BenchmarkScenario {
  const routingAssets = ["CRISK1", "CRISK2", "CRISK3", "CRISK4"];
  const highRawRiskyPath = [
    "CAAA",
    "CRISK4",
    "CRISK3",
    "CRISK2",
    "CRISK1",
    "CBBB",
  ].join(">");

  return {
    id: "multi_venue_fill_risk_arbiter",
    label: "Multi-venue fill-risk arbiter",
    note:
      "Validates that broker scoring compares raw output with fee, slippage, hop and fill-risk penalties instead of blindly picking the highest raw AMM quote.",
    tokenIn: "CAAA",
    tokenOut: "CBBB",
    amountBase: 1_000_000,
    slippagePct: 0.5,
    routingAssets,
    routingSearch: {
      maxIntermediaries: routingAssets.length,
      maxHops: 5,
      quoteBudget: 32,
      splitParts: 4,
      beamWidth: 8,
      tailProbeCount: 16,
    },
    minEfficiencyBps: 9_850,
    mode: "single_route",
    quoteModel: {
      aquariusQuoteBps: () => 12_600,
      sushiQuoteBps: () => 12_550,
      soroswapPathQuoteBps: (pathAssets) => {
        if (pathAssets.join(">") === highRawRiskyPath) return 12_700;
        if (pathAssets.length === 2) return 10_800;
        return 11_000 + Math.max(0, pathAssets.length - 2) * 120;
      },
    },
  };
}

function buildFailClosedNoVenueScenario(): BenchmarkScenario {
  return {
    id: "no_live_venue_fail_closed",
    label: "No-live-venue fail-closed benchmark",
    note:
      "Validates that the planner does not invent a route when all venue quotes are unavailable or zero; release evidence must include at least one failure-mode case.",
    tokenIn: "CAAA",
    tokenOut: "CBBB",
    amountBase: 1_000_000,
    slippagePct: 0.5,
    routingAssets: ["CAAA", "CALT", "CBBB"],
    routingSearch: {
      maxIntermediaries: 1,
      maxHops: 2,
      quoteBudget: 4,
      splitParts: 2,
    },
    minEfficiencyBps: 10_000,
    mode: "fail_closed",
    quoteModel: {
      aquariusQuoteBps: () => 0,
      soroswapPathQuoteBps: () => 0,
    },
  };
}

async function runScenario(
  scenario: BenchmarkScenario,
): Promise<RebalanceBenchmarkResult> {
  const readers = createBenchmarkReaders(scenario);
  const plan = await resolveRebalanceRoutePlan(
    {
      requestedProtocol: "AUTO",
      amountBase: scenario.amountBase,
      tokenIn: scenario.tokenIn,
      tokenOut: scenario.tokenOut,
      slippagePct: scenario.slippagePct,
      manualMinOutBase: 0,
      aquariusRouterId: "CBENCHMARKAQUARIUS",
      configuredAquariusPoolIndex: BENCHMARK_AQUARIUS_POOL_INDEX,
      sushiAdapterId: scenario.quoteModel.sushiQuoteBps
        ? "CBENCHMARKSUSHIADAPTER"
        : undefined,
      sushiPoolId: scenario.quoteModel.sushiQuoteBps ? 1 : undefined,
      routingAssets: scenario.routingAssets,
      routingSearch: scenario.routingSearch,
      protocolPolicies: scenario.protocolPolicies,
    },
    readers,
  );
  const paths = resolveScenarioOraclePaths(scenario);
  const exhaustivePathCount =
    scenario.exhaustivePathCountOverride ?? paths.length;
  const singleOracle = resolveSingleRouteOracle({ scenario, paths });
  const splitOracle =
    scenario.mode === "split_route"
      ? resolveSplitRouteOracle({ scenario, plan })
      : { oracleEstimatedOutBase: 0, comparedRouteCount: 0 };
  const oracleEstimatedOutBase =
    scenario.mode === "split_route"
      ? Math.max(singleOracle, splitOracle.oracleEstimatedOutBase)
      : scenario.mode === "fail_closed"
        ? 0
        : singleOracle;
  const plannerEstimatedOutBase = resolvePlannerOut(plan);
  const failClosed =
    scenario.mode === "fail_closed" &&
    !plan.selectedCandidate &&
    plannerEstimatedOutBase === 0 &&
    oracleEstimatedOutBase === 0;
  const plannerEfficiencyBps = failClosed
    ? 10_000
    : calculateBps(plannerEstimatedOutBase, oracleEstimatedOutBase);
  const bestRaw = resolveBestRawCandidate(plan.candidates);
  const venuesCompared = uniqueSortedVenues([
    ...(plan.routeSearch?.venuesCompared ?? []),
    plan.selectedCandidate?.protocol,
    bestRaw.protocol,
  ]);
  const selectedRouteFillRiskPenaltyBps = resolveSelectedPenalty(
    plan.selectedCandidate,
    "fillRiskPenaltyBps",
  );
  const selectedRouteEffectivePenaltyBps = resolveSelectedPenalty(
    plan.selectedCandidate,
    "effectivePenaltyBps",
  );
  const worstComparedFillRiskPenaltyBps = resolveWorstPenalty(
    plan.candidates,
    "fillRiskPenaltyBps",
  );
  const worstComparedEffectivePenaltyBps = resolveWorstPenalty(
    plan.candidates,
    "effectivePenaltyBps",
  );

  return {
    id: scenario.id,
    label: scenario.label,
    mode: scenario.mode,
    passed:
      scenario.mode === "fail_closed"
        ? failClosed
        : plannerEfficiencyBps >= scenario.minEfficiencyBps,
    minEfficiencyBps: scenario.minEfficiencyBps,
    plannerEfficiencyBps,
    amountBase: scenario.amountBase,
    plannerEstimatedOutBase,
    oracleEstimatedOutBase,
    plannerSelectedProtocol: plan.selectedProtocol,
    plannerSelectedPath:
      plan.selectedCandidate?.pathLabel ?? "No live route selected",
    splitStatus: plan.splitRoute?.status ?? "idle",
    splitAllocationCount: plan.splitRoute?.allocationCount ?? 0,
    candidateUniverseSize:
      plan.routeSearch?.candidateUniverseSize ?? exhaustivePathCount,
    quotedPathCount: plan.routeSearch?.quotedPathCount ?? 0,
    exhaustivePathCount,
    comparedRouteCount:
      scenario.mode === "split_route"
        ? splitOracle.comparedRouteCount
        : paths.length + 1,
    oracleModel: resolveOracleModel(scenario),
    oraclePathCount: paths.length,
    quoteBudget: scenario.routingSearch.quoteBudget,
    maxHops: scenario.routingSearch.maxHops,
    maxIntermediaries: scenario.routingSearch.maxIntermediaries,
    quoteCoveragePpm:
      plan.routeSearch?.quoteCoveragePpm ??
      calculateBps(plan.routeSearch?.quotedPathCount ?? 0, exhaustivePathCount) * 100,
    brokerGrade:
      (plan.routeSearch?.candidateUniverseSize ?? exhaustivePathCount) >= 1_000_000 ||
      scenario.mode === "split_route" ||
      scenario.mode === "fail_closed",
    failureCase: scenario.mode === "fail_closed",
    failClosed,
    venuesCompared,
    bestRawProtocol: bestRaw.protocol,
    bestRawEstimatedOutBase: bestRaw.estimatedOutBase,
    selectedRawEfficiencyBps: calculateBps(
      plannerEstimatedOutBase,
      bestRaw.estimatedOutBase,
    ),
    selectedRouteFillRiskPenaltyBps,
    selectedRouteEffectivePenaltyBps,
    worstComparedFillRiskPenaltyBps,
    worstComparedEffectivePenaltyBps,
    fillRiskModel:
      scenario.mode === "fail_closed"
        ? "fail_closed"
        : scenario.mode === "split_route"
          ? "split_allocation_penalty"
          : "route_score_penalty",
    note: `${scenario.note} ${plan.routeSearch?.note ?? plan.note}`,
  };
}

function buildBrokerComparisonProfile(
  results: RebalanceBenchmarkResult[],
): BrokerComparisonProfile {
  const venuesCovered = uniqueSortedVenues(
    results.flatMap((result) => result.venuesCompared),
  );
  const optionalVenuesNotCovered = BROKER_COMPARISON_OPTIONAL_VENUES.filter(
    (venue) => !venuesCovered.includes(venue),
  );
  const allRequiredVenuesCovered = BROKER_COMPARISON_REQUIRED_VENUES.every(
    (venue) => venuesCovered.includes(venue),
  );
  const millionScaleScenarioCount = results.filter(
    (result) => result.candidateUniverseSize >= 1_000_000,
  ).length;
  const highScaleScenarioCount = results.filter(
    (result) => result.candidateUniverseSize >= 5_000,
  ).length;
  const splitRouteScenarioCount = results.filter(
    (result) => result.mode === "split_route",
  ).length;
  const failureCases = results.filter((result) => result.failureCase);
  const totalCandidateUniverseSize = results.reduce(
    (total, result) => total + result.candidateUniverseSize,
    0,
  );
  const totalQuotedPathCount = results.reduce(
    (total, result) => total + result.quotedPathCount,
    0,
  );
  const quoteCoverageValues = results
    .filter((result) => result.quoteCoveragePpm > 0)
    .map((result) => result.quoteCoveragePpm);
  const worstEfficiencyBps = results.reduce(
    (worst, result) => Math.min(worst, result.plannerEfficiencyBps),
    10_000,
  );
  const productionScaleReady =
    results.length >= BROKER_COMPARISON_REQUIRED_RESULTS &&
    millionScaleScenarioCount >= BROKER_COMPARISON_MIN_MILLION_SCALE_CASES &&
    splitRouteScenarioCount >= BROKER_COMPARISON_MIN_SPLIT_CASES &&
    failureCases.length >= BROKER_COMPARISON_MIN_FAILURE_CASES &&
    failureCases.every((result) => result.failClosed);
  const releaseEligible =
    productionScaleReady &&
    allRequiredVenuesCovered &&
    results.every((result) => result.passed) &&
    worstEfficiencyBps >= 9_850;

  return {
    profile: "broker_top_tier",
    corpusVersion: BROKER_COMPARISON_CORPUS_VERSION,
    corpusName:
      "Arka bounded broker comparison corpus: deep path, cyclic frontier, split allocation, fill-risk arbitration, production-scale tail path and fail-closed coverage",
    requiredResultCount: BROKER_COMPARISON_REQUIRED_RESULTS,
    requiredVenues: BROKER_COMPARISON_REQUIRED_VENUES,
    optionalVenues: BROKER_COMPARISON_OPTIONAL_VENUES,
    venuesCovered,
    optionalVenuesNotCovered,
    oracleModelsCovered: uniqueSortedOracleModels(
      results.map((result) => result.oracleModel),
    ),
    highScaleScenarioCount,
    millionScaleScenarioCount,
    splitRouteScenarioCount,
    failureCaseCount: failureCases.length,
    failClosedCaseCount: failureCases.filter((result) => result.failClosed).length,
    maxCandidateUniverseSize: results.reduce(
      (max, result) => Math.max(max, result.candidateUniverseSize),
      0,
    ),
    totalCandidateUniverseSize,
    totalQuotedPathCount,
    lowestQuoteCoveragePpm:
      quoteCoverageValues.length > 0 ? Math.min(...quoteCoverageValues) : 0,
    worstEfficiencyBps,
    worstFillRiskPenaltyBps: results.reduce(
      (worst, result) =>
        Math.max(worst, result.worstComparedFillRiskPenaltyBps),
      0,
    ),
    worstEffectivePenaltyBps: results.reduce(
      (worst, result) =>
        Math.max(worst, result.worstComparedEffectivePenaltyBps),
      0,
    ),
    allRequiredVenuesCovered,
    productionScaleReady,
    releaseEligible,
    notes: [
      optionalVenuesNotCovered.includes("BALANCED")
        ? "Balanced/SODAX is optional in this benchmark until comparable quote, status and confirmation are available."
        : "Balanced/SODAX coverage is present in this corpus.",
      optionalVenuesNotCovered.includes("SUSHI")
        ? "Sushi pool coverage is optional until a production pool map is configured."
        : "Sushi AMM coverage is present as a pool route.",
      "The production-scale case validates recovery of a known injected global-best tail path over a million-scale universe without pretending to exhaustively quote every path.",
      "The fail-closed case is part of the corpus so broker readiness cannot pass by inventing quotes when all venues are unavailable.",
    ],
  };
}

export async function runRebalanceBenchmarkSuite(): Promise<RebalanceBenchmarkReport> {
  const scenarios = [
    buildDeepPathScenario(),
    buildCyclicFrontierScenario(),
    buildSplitRouteScenario(),
    buildDelayedEfficiencySplitScenario(),
    buildProductionScaleKnownPathScenario(),
    buildMultiVenueFillRiskScenario(),
    buildFailClosedNoVenueScenario(),
  ];
  const results = await Promise.all(scenarios.map(runScenario));
  const passedCount = results.filter((result) => result.passed).length;
  const brokerComparison = buildBrokerComparisonProfile(results);
  return {
    overallPassed:
      passedCount === results.length && brokerComparison.releaseEligible,
    resultCount: results.length,
    passedCount,
    worstEfficiencyBps: brokerComparison.worstEfficiencyBps,
    brokerComparison,
    results,
  };
}
