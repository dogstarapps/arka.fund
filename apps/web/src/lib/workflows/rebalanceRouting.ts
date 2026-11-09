import { protocolVenueAllowed, type VenueSnapshot } from './protocolLifecycle';
import { NETWORK_PASSPHRASE } from '@/lib/config';
import {
  MAX_REBALANCE_SLIPPAGE_PCT,
  REBALANCE_CHUNKING_THRESHOLD_BASE,
  REBALANCE_DAILY_TURNOVER_CAP_BPS,
  REBALANCE_DISABLED_PROTOCOL_REASON,
  REBALANCE_DISABLED_PROTOCOLS,
  REBALANCE_EMERGENCY_PAUSE_SWAP,
  REBALANCE_EXTRA_BUFFER_PCT,
  REBALANCE_FALLBACK_EXTRA_PCT,
  REBALANCE_FORBID_ROUTE_CYCLES,
  REBALANCE_MAX_CHUNK_SIZE_BASE,
  REBALANCE_MAX_NOTIONAL_PER_SWAP_BASE,
  REBALANCE_MAX_PATH_LENGTH,
  REBALANCE_POST_TRADE_DEVIATION_BPS,
} from "@/lib/config";
import {
  formatExecutionVenueConfirmationModelLabel,
  formatExecutionVenueFamilyLabel,
  formatExecutionVenuePlannerAdmissionLabel,
  formatExecutionVenuePathModelLabel,
  formatExecutionVenueQuoteModelLabel,
  formatExecutionVenueSettlementModelLabel,
  type ExecutionVenueConfirmationModel,
  type ExecutionVenueFamily,
  type ExecutionVenuePathModel,
  type ExecutionVenueQuoteModel,
  type ExecutionVenueSettlementModel,
} from "@/lib/workflows/executionVenues";
import type { BalancedSodaxCanaryPolicyEvaluation } from "@/lib/workflows/balancedSodaxCanaryPolicy";

export type ManualRebalanceProtocol = "SOROSWAP" | "AQUARIUS" | "PHOENIX" | "SUSHI" | "BALANCED";
export type RebalanceProtocol = ManualRebalanceProtocol | "AUTO";
export type RebalanceVenueFamily = ExecutionVenueFamily;
export type RebalanceQuoteModel = ExecutionVenueQuoteModel;
export type RebalanceSettlementModel = ExecutionVenueSettlementModel;
export type RebalanceExecutionPathModel = ExecutionVenuePathModel;
export type RebalanceConfirmationModel = ExecutionVenueConfirmationModel;
export type RebalanceExecutionKind =
  | "soroswap_path"
  | "aquarius_single_pool"
  | "phoenix_pool"
  | "sushi_pool"
  | "balanced_adapter";

export type RebalanceRouteStep = {
  protocol: ManualRebalanceProtocol;
  tokenIn: string;
  tokenOut: string;
  poolIndexHex?: string;
};

export type RebalanceProtocolPolicy = {
  planningEnabled: boolean;
  executionEnabled: boolean;
  autoExecutionEnabled?: boolean;
  directOnly: boolean;
  scoreBiasBps: number;
  hopPenaltyBps: number;
  disabledReason?: string;
};

export type BalancedRouteLane = {
  adapterId: string;
  poolId: number;
  ready: boolean;
  supportStatus: "ready" | "blocked" | "inactive";
  laneMode: string;
  validatedModulePresent: boolean;
  comparableQuote: boolean;
  manualExecutionEligible: boolean;
  plannerAdmission: "auto" | "manual_only" | "blocked";
  capabilityNote: string;
  blockingReasons: string[];
};

export type RebalanceRouteCandidate = {
  routeId: string;
  protocol: ManualRebalanceProtocol;
  venueFamily: RebalanceVenueFamily;
  quoteModel: RebalanceQuoteModel;
  settlementModel: RebalanceSettlementModel;
  pathModel: RebalanceExecutionPathModel;
  confirmationModel: RebalanceConfirmationModel;
  title: string;
  estimatedOutBase: number;
  minOutBase: number;
  available: boolean;
  admitted: boolean;
  autoEligible: boolean;
  note: string;
  pathAssets: string[];
  pathLabel: string;
  hops: number;
  routeScoreBase: number;
  routeScoreLabel: string;
  routeScoreComponents?: RebalanceRouteScoreComponents;
  autoPolicy?: RebalanceRouteAutoPolicy;
  executionKind: RebalanceExecutionKind;
  steps: RebalanceRouteStep[];
  poolIndexHex?: string;
  adapterId?: string;
  poolId?: number;
};

export type RebalanceRouteAutoPolicy = {
  status: "passed" | "blocked" | "not_applicable";
  code: string;
  detail: string;
  minAmountBase?: number;
  recommendedMinOutBps?: number;
  evidenceLabel?: string;
};

export type RebalanceRouteScoreComponents = {
  estimatedOutBase: number;
  feePenaltyBps: number;
  fillRiskPenaltyBps: number;
  slippagePenaltyBps: number;
  hopPenaltyBps: number;
  biasBps: number;
  effectivePenaltyBps: number;
};

export type RebalanceRouteSearchConfig = {
  maxIntermediaries?: number;
  maxHops?: number;
  quoteBudget?: number;
  splitParts?: number;
  beamWidth?: number;
  tailProbeCount?: number;
};

export type RebalanceRouteHopCount = {
  hops: number;
  pathCount: number;
};

export type RebalanceRouteSearchTelemetry = {
  strategy:
    | "idle"
    | "direct_only_policy"
    | "broker_grade_bounded_global_search";
  benchmarkScale:
    | "idle"
    | "direct"
    | "bounded"
    | "million_scale_bounded";
  samplingModel:
    | "idle"
    | "direct"
    | "stratified_head_mid_tail"
    | "broker_frontier_beam_tail_probe";
  candidateUniverseSize: number;
  generatedPathCount: number;
  quotedPathCount: number;
  liveQuoteCount: number;
  prunedPathCount: number;
  returnedCandidateCount: number;
  quoteCoverageBps: number;
  quoteCoveragePpm: number;
  budgetUtilizationBps: number;
  generatedHopCounts: RebalanceRouteHopCount[];
  quotedHopCounts: RebalanceRouteHopCount[];
  deepestGeneratedHops: number;
  deepestQuotedHops: number;
  maxIntermediaries: number;
  maxHops: number;
  quoteBudget: number;
  splitParts: number;
  beamWidth: number;
  tailProbeCount: number;
  deterministicProbeCount: number;
  venuesCompared: ManualRebalanceProtocol[];
  note: string;
};

export type RebalanceSplitRouteAllocation = {
  routeId: string;
  protocol: Exclude<ManualRebalanceProtocol, "BALANCED">;
  title: string;
  amountInBase: number;
  amountShareBps: number;
  estimatedOutBase: number;
  minOutBase: number;
  pathAssets: string[];
  pathLabel: string;
  hops: number;
  poolIndexHex?: string;
  adapterId?: string;
  poolId?: number;
  routeScoreBase: number;
  routeScoreLabel: string;
  note: string;
};

export type RebalanceSplitRoutePlan = {
  status:
    | "idle"
    | "not_applicable"
    | "single_route_optimal"
    | "recommended";
  strategy:
    | "idle"
    | "manual_override_disabled"
    | "insufficient_live_routes"
    | "chunked_global_best_execution";
  executable: boolean;
  allocationCount: number;
  chunkCount: number;
  routeCountCompared: number;
  totalAmountInBase: number;
  totalEstimatedOutBase: number;
  totalMinOutBase: number;
  singleRouteEstimatedOutBase: number;
  estimatedImprovementBase: number;
  estimatedImprovementBps: number;
  allocations: RebalanceSplitRouteAllocation[];
  note: string;
};

export type RebalanceGuardrailId =
  | "emergency_pause_swap"
  | "max_notional_per_swap"
  | "max_path_length"
  | "forbid_route_cycles"
  | "chunking_threshold"
  | "max_chunk_size"
  | "post_trade_deviation_bps"
  | "daily_turnover_cap_bps";

export type RebalanceGuardrailStatus =
  | "passed"
  | "blocked"
  | "not_applicable"
  | "requires_state";

export type RebalanceGuardrailPolicy = {
  maxNotionalPerSwapBase: number;
  maxPathLength: number;
  forbidRouteCycles: boolean;
  chunkingThresholdBase: number;
  maxChunkSizeBase: number;
  postTradeDeviationBps: number;
  dailyTurnoverCapBps: number;
  emergencyPauseSwap: boolean;
};

export type RebalanceGuardrailState = {
  vaultNavBase?: number;
  dailyTurnoverUsedBase?: number;
  projectedPostTradeDeviationBps?: number;
};

export type RebalanceGuardrailEvidenceSource =
  | "explicit_projection"
  | "catalog_activity_nav"
  | "missing_state";

export type RebalanceGuardrailEvidence = {
  source: RebalanceGuardrailEvidenceSource;
  amountBase?: number;
  routeId?: string;
  routeEstimatedOutBase?: number;
  vaultNavBase?: number;
  projectedNavDeltaBase?: number;
  dailyTurnoverUsedBase?: number;
  projectedTurnoverBase?: number;
  turnoverCapBase?: number;
  splitRouteUsed?: boolean;
};

export type RebalanceGuardrailCheck = {
  id: RebalanceGuardrailId;
  label: string;
  status: RebalanceGuardrailStatus;
  value: string;
  limit: string;
  detail: string;
  evidence?: RebalanceGuardrailEvidence;
};

export type RebalanceGuardrailEvaluation = {
  status: "passed" | "blocked";
  blockedReasons: string[];
  policy: RebalanceGuardrailPolicy;
  checks: RebalanceGuardrailCheck[];
};

export type RebalanceRoutePlan = {
  requestedProtocol: RebalanceProtocol;
  selectedProtocol: ManualRebalanceProtocol;
  selectedCandidate: RebalanceRouteCandidate | null;
  estimatedOutBase: number;
  minOutBase: number;
  note: string;
  candidates: RebalanceRouteCandidate[];
  routeSearch?: RebalanceRouteSearchTelemetry;
  splitRoute?: RebalanceSplitRoutePlan;
  guardrails?: RebalanceGuardrailEvaluation;
};

export type RebalanceRouteReaders = {
  readSoroswapAmountOut: (
    amountInBase: number,
    tokenIn: string,
    tokenOut: string,
    readerPubKey?: string,
  ) => Promise<number>;
  readSoroswapAmountOutForPath?: (
    amountInBase: number,
    pathAssets: string[],
    readerPubKey?: string,
  ) => Promise<number>;
  readAquariusPoolIndex: (
    routerId: string,
    tokenIn: string,
    tokenOut: string,
    readerPubKey?: string,
  ) => Promise<string | null>;
  readAquariusEstimateOut: (
    routerId: string,
    tokenIn: string,
    tokenOut: string,
    poolIndexHex32: string,
    amountInBase: number,
    readerPubKey?: string,
  ) => Promise<number>;
  readVenueSnapshot?: (fund:string,venue:string,readerPubKey?:string)=>Promise<VenueSnapshot>;
  readSushiFundBinding?: (fund:string,adapter:string,tokenIn:string,tokenOut:string,readerPubKey?:string)=>Promise<number>;
  readSushiEstimateOut?: (adapter:string,poolId:number,tokenIn:string,tokenOut:string,amountBase:number,readerPubKey?:string)=>Promise<number>;
  readPhoenixEstimateOut?: (
    poolId: string,
    tokenIn: string,
    amountInBase: number,
    readerPubKey?: string,
  ) => Promise<number>;
};

export type ResolveRebalanceRouteInput = {
  requestedProtocol: RebalanceProtocol;
  fundId?: string;
  requireVenueState?: boolean;
  sushiAdapterId?: string;
  sushiPoolId?: number;
  amountBase: number;
  tokenIn: string;
  tokenOut: string;
  slippagePct: number;
  manualMinOutBase: number;
  aquariusRouterId: string;
  aquariusAdapterId?: string;
  aquariusPoolId?: number;
  soroswapAdapterId?: string;
  phoenixAdapterId?: string;
  phoenixPoolId?: number;
  configuredPhoenixPool?: string;
  configuredAquariusPoolIndex?: string;
  routingAssets?: string[];
  routingSearch?: RebalanceRouteSearchConfig;
  protocolPolicies?: Partial<Record<ManualRebalanceProtocol, Partial<RebalanceProtocolPolicy>>>;
  readerPubKey?: string;
  balancedLane?: BalancedRouteLane;
  balancedLaneReady?: boolean;
  balancedComparableLifecycleReady?: boolean;
  balancedComparableQuoteOutBase?: number;
  balancedComparableQuoteProvider?: string;
  balancedComparableQuoteError?: string;
  balancedCanaryPolicy?: BalancedSodaxCanaryPolicyEvaluation;
  guardrailPolicy?: Partial<RebalanceGuardrailPolicy>;
  guardrailState?: RebalanceGuardrailState;
  requiredStatefulGuardrails?: RebalanceGuardrailId[];
};

const DEFAULT_PROTOCOL_POLICIES: Record<ManualRebalanceProtocol, RebalanceProtocolPolicy> = {
  SOROSWAP: {
    planningEnabled: true,
    executionEnabled: true,
    directOnly: false,
    scoreBiasBps: 0,
    hopPenaltyBps: 35,
  },
  AQUARIUS: {
    planningEnabled: true,
    executionEnabled: true,
    directOnly: true,
    scoreBiasBps: 10,
    hopPenaltyBps: 0,
  },
  SUSHI: {planningEnabled:true,executionEnabled:true,directOnly:true,scoreBiasBps:0,hopPenaltyBps:0},
  PHOENIX: {
    planningEnabled: false,
    executionEnabled: false,
    disabledReason: "Phoenix has been retired from new routes.",
    directOnly: true,
    scoreBiasBps: 8,
    hopPenaltyBps: 0,
  },
  BALANCED: {
    planningEnabled: false,
    executionEnabled: false,
    directOnly: true,
    scoreBiasBps: 0,
    hopPenaltyBps: 0,
    disabledReason:
      "Balanced stays out of routing admission until the canonical integration is ready.",
  },
};

const MANUAL_REBALANCE_PROTOCOL_SET = new Set<ManualRebalanceProtocol>([
  "SOROSWAP",
  "AQUARIUS",
  "PHOENIX",
  "SUSHI",
  "BALANCED",
]);

export function parseDisabledRebalanceProtocols(
  value = REBALANCE_DISABLED_PROTOCOLS,
): ManualRebalanceProtocol[] {
  const normalized = value
    .split(/[,\s]+/)
    .map((item) => item.trim().toUpperCase())
    .filter(Boolean);
  const expanded = normalized.includes("ALL")
    ? Array.from(MANUAL_REBALANCE_PROTOCOL_SET)
    : normalized;
  return Array.from(
    new Set(
      expanded.filter((item): item is ManualRebalanceProtocol =>
        MANUAL_REBALANCE_PROTOCOL_SET.has(item as ManualRebalanceProtocol),
      ),
    ),
  );
}

export function buildRuntimeRebalanceProtocolPolicies(input?: {
  base?: Partial<Record<ManualRebalanceProtocol, Partial<RebalanceProtocolPolicy>>>;
  disabledProtocols?: string;
  disabledReason?: string;
}): Partial<Record<ManualRebalanceProtocol, Partial<RebalanceProtocolPolicy>>> {
  const policies: Partial<
    Record<ManualRebalanceProtocol, Partial<RebalanceProtocolPolicy>>
  > = {
    ...(input?.base ?? {}),
  };
  const disabledProtocols = parseDisabledRebalanceProtocols(
    input?.disabledProtocols ?? REBALANCE_DISABLED_PROTOCOLS,
  );
  const disabledReason =
    input?.disabledReason ||
    REBALANCE_DISABLED_PROTOCOL_REASON ||
    "Protocol temporarily blocked by operator policy.";

  for (const protocol of disabledProtocols) {
    policies[protocol] = {
      ...(policies[protocol] ?? {}),
      planningEnabled: false,
      executionEnabled: false,
      disabledReason,
    };
  }

  return policies;
}

function resolvePolicy(
  protocol: ManualRebalanceProtocol,
  overrides?: Partial<
    Record<ManualRebalanceProtocol, Partial<RebalanceProtocolPolicy>>
  >,
): RebalanceProtocolPolicy {
  if(protocol==='PHOENIX')return {...DEFAULT_PROTOCOL_POLICIES.PHOENIX};
  return {
    ...DEFAULT_PROTOCOL_POLICIES[protocol],
    ...(overrides?.[protocol] ?? {}),
  };
}

function clampPct(value: number): number {
  return Math.max(0, Math.min(MAX_REBALANCE_SLIPPAGE_PCT, value));
}

function quotedMinOut(estimatedOutBase: number, slippagePct: number): number {
  const buffer = clampPct(slippagePct + REBALANCE_EXTRA_BUFFER_PCT);
  return Math.max(1, Math.floor(estimatedOutBase * (1 - buffer / 100)));
}

function fallbackMinOut(amountBase: number, slippagePct: number): number {
  const buffer = clampPct(slippagePct + REBALANCE_EXTRA_BUFFER_PCT + REBALANCE_FALLBACK_EXTRA_PCT);
  return Math.max(1, Math.floor(amountBase * (1 - buffer / 100)));
}

function withManualOverride(candidate: RebalanceRouteCandidate, manualMinOutBase: number): RebalanceRouteCandidate {
  if (manualMinOutBase <= 0) return candidate;
  return {
    ...candidate,
    minOutBase: manualMinOutBase,
    note: `${candidate.note} Manual min-out override applied.`,
  };
}

function compactAssetLabel(asset: string): string {
  if (!asset) return "";
  if (asset.length <= 12) return asset;
  return `${asset.slice(0, 6)}...${asset.slice(-4)}`;
}

export function formatRebalanceProtocolLabel(protocol: ManualRebalanceProtocol): string {
  if (protocol === "SOROSWAP") return "SoroSwap";
  if (protocol === "AQUARIUS") return "Aquarius";
  if (protocol === "PHOENIX") return "Phoenix";
  if (protocol === "SUSHI") return "Sushi";
  return "Balanced";
}

export function formatRebalanceVenueFamilyLabel(
  family: RebalanceVenueFamily,
): string {
  return formatExecutionVenueFamilyLabel(family);
}

export function formatRebalanceQuoteModelLabel(
  model: RebalanceQuoteModel,
): string {
  return formatExecutionVenueQuoteModelLabel(model);
}

export function formatRebalanceSettlementModelLabel(
  model: RebalanceSettlementModel,
): string {
  return formatExecutionVenueSettlementModelLabel(model);
}

export function formatRebalancePathModelLabel(
  model: RebalanceExecutionPathModel,
): string {
  return formatExecutionVenuePathModelLabel(model);
}

export function formatRebalanceConfirmationModelLabel(
  model: RebalanceConfirmationModel,
): string {
  return formatExecutionVenueConfirmationModelLabel(model);
}

export function formatRebalancePlannerAdmissionLabel(
  admission: "auto" | "manual_only" | "blocked",
): string {
  return formatExecutionVenuePlannerAdmissionLabel(admission);
}

export function formatRebalanceRoutePath(pathAssets: string[]): string {
  if (pathAssets.length === 0) return "Route not quoted yet";
  return pathAssets.map(compactAssetLabel).join(" -> ");
}

function buildRouteTitle(protocol: ManualRebalanceProtocol, pathAssets: string[]): string {
  if (pathAssets.length <= 2) return `${formatRebalanceProtocolLabel(protocol)} direct`;
  return `${formatRebalanceProtocolLabel(protocol)} via ${compactAssetLabel(pathAssets[1] ?? "")}`;
}

function buildRouteSummary(candidate: RebalanceRouteCandidate): string {
  if (candidate.hops <= 1) return `${candidate.title} on a direct route.`;
  return `${candidate.title} on a ${candidate.hops}-hop route (${candidate.pathLabel}).`;
}

const SLIPPAGE_PENALTY_WEIGHT_BPS = 3_500;
const DEFAULT_BROKER_GRADE_INTERMEDIARIES = 24;
const DEFAULT_BROKER_GRADE_MAX_HOPS = 6;
const DEFAULT_BROKER_GRADE_QUOTE_BUDGET = 384;
const DEFAULT_BROKER_GRADE_BEAM_WIDTH = 16;
const DEFAULT_BROKER_GRADE_TAIL_PROBES = 96;
const MAX_BROKER_GRADE_INTERMEDIARIES = 32;
const MAX_BROKER_GRADE_HOPS = 6;
const MAX_BROKER_GRADE_QUOTE_BUDGET = 1_024;
const MAX_BROKER_GRADE_BEAM_WIDTH = 64;
const MAX_BROKER_GRADE_TAIL_PROBES = 512;
const DEFAULT_SPLIT_ROUTE_PARTS = 8;
const MAX_SPLIT_ROUTE_PARTS = 16;
const MAX_SPLIT_ROUTE_CANDIDATES = 4;
const MAX_CONCURRENT_ROUTE_QUOTES = 8;
const MAX_RETURNED_ROUTE_CANDIDATES = 32;
const ROUTE_SCORE_TIE_WINDOW_BPS = 10;

function formatBpsPercent(value: number): string {
  return `${(value / 100).toFixed(2)}%`;
}

function estimateFeePenaltyBps(
  protocol: ManualRebalanceProtocol,
  hops: number,
): number {
  if (protocol === "AQUARIUS") {
    return 20;
  }
  if (protocol === "PHOENIX") {
    return 25;
  }
  if (protocol === "BALANCED") {
    return 35;
  }
  return 30 + Math.max(0, hops - 1) * 5;
}

function estimateFillRiskPenaltyBps(input: {
  protocol: ManualRebalanceProtocol;
  hops: number;
  quoteModel: RebalanceQuoteModel;
}): number {
  if (input.protocol === "AQUARIUS") {
    return 12;
  }
  if (input.protocol === "PHOENIX") {
    return 14;
  }
  if (input.protocol === "BALANCED") {
    if (input.quoteModel === "public_intent_quote") return 26;
    if (input.quoteModel === "manual_lane") return 40;
    return 60;
  }
  return 18 + Math.max(0, input.hops - 1) * 10;
}

function estimateSlippagePenaltyBps(
  estimatedOutBase: number,
  minOutBase: number,
): number {
  if (estimatedOutBase <= 0 || minOutBase <= 0) return 0;
  const slippageBufferBps = Math.max(
    0,
    Math.floor(((estimatedOutBase - minOutBase) * 10_000) / estimatedOutBase),
  );
  return Math.floor((slippageBufferBps * SLIPPAGE_PENALTY_WEIGHT_BPS) / 10_000);
}

function scoreRoute(input: {
  protocol: ManualRebalanceProtocol;
  quoteModel: RebalanceQuoteModel;
  estimatedOutBase: number;
  minOutBase: number;
  hops: number;
  policy: RebalanceProtocolPolicy;
}): {
  scoreBase: number;
  scoreLabel: string;
  components: RebalanceRouteScoreComponents | null;
} {
  if (input.estimatedOutBase <= 0) {
    return {
      scoreBase: 0,
      scoreLabel: "score unavailable",
      components: null,
    };
  }

  const feePenaltyBps = estimateFeePenaltyBps(input.protocol, input.hops);
  const fillRiskPenaltyBps = estimateFillRiskPenaltyBps({
    protocol: input.protocol,
    hops: input.hops,
    quoteModel: input.quoteModel,
  });
  const slippagePenaltyBps = estimateSlippagePenaltyBps(
    input.estimatedOutBase,
    input.minOutBase,
  );
  const hopPenaltyBps = Math.max(0, input.hops - 1) * input.policy.hopPenaltyBps;
  const biasBps = input.hops <= 1 ? input.policy.scoreBiasBps : 0;
  const effectivePenaltyBps = Math.max(
    0,
    feePenaltyBps + fillRiskPenaltyBps + slippagePenaltyBps + hopPenaltyBps - biasBps,
  );
  const scoreBase = Math.max(
    0,
    Math.floor(input.estimatedOutBase * (1 - effectivePenaltyBps / 10_000)),
  );
  const components: RebalanceRouteScoreComponents = {
    estimatedOutBase: input.estimatedOutBase,
    feePenaltyBps,
    fillRiskPenaltyBps,
    slippagePenaltyBps,
    hopPenaltyBps,
    biasBps,
    effectivePenaltyBps,
  };
  const scoreLabel = `score ${scoreBase.toLocaleString()} (price ${input.estimatedOutBase.toLocaleString()} · fee ${formatBpsPercent(feePenaltyBps)} · fill ${formatBpsPercent(fillRiskPenaltyBps)} · slip ${formatBpsPercent(slippagePenaltyBps)} · hop ${formatBpsPercent(hopPenaltyBps)}${biasBps > 0 ? ` · bias -${formatBpsPercent(biasBps)}` : ""})`;

  return {
    scoreBase,
    scoreLabel,
    components,
  };
}

function createFallbackCandidate(
  protocol: ManualRebalanceProtocol,
  amountBase: number,
  slippagePct: number,
  note: string,
): RebalanceRouteCandidate {
  const pathAssets = ["", ""].filter(Boolean);
  return {
    routeId: `${protocol}_FALLBACK`,
    protocol,
    venueFamily: protocol === "BALANCED" ? "intent_execution" : "amm_router",
    quoteModel:
      protocol === "BALANCED"
        ? "intent_surface_unverified"
        : "manual_lane",
    settlementModel:
      protocol === "BALANCED"
        ? "intent_settlement"
        : (protocol === "PHOENIX" || protocol === "SUSHI")
          ? "onchain_adapter"
          : "onchain_router",
    pathModel:
      protocol === "BALANCED" || protocol === "PHOENIX" || protocol === "SUSHI"
        ? "adapter_gated"
        : "router_direct",
    confirmationModel: "transaction_hash_plus_refresh",
    title: `${formatRebalanceProtocolLabel(protocol)} fallback`,
    estimatedOutBase: 0,
    minOutBase: fallbackMinOut(amountBase, slippagePct),
    available: false,
    admitted: false,
    autoEligible: false,
    note,
    pathAssets,
    pathLabel: "Route not quoted yet",
    hops: 0,
    routeScoreBase: 0,
    routeScoreLabel: "score unavailable",
    executionKind:
      protocol === "SOROSWAP"
        ? "soroswap_path"
        : protocol === "AQUARIUS"
          ? "aquarius_single_pool"
          : protocol === "SUSHI"
            ? "sushi_pool"
          : protocol === "PHOENIX"
            ? "phoenix_pool"
            : "balanced_adapter",
    steps: [],
  };
}

async function readSoroswapPathQuote(
  readers: RebalanceRouteReaders,
  amountBase: number,
  pathAssets: string[],
  readerPubKey?: string,
): Promise<number> {
  if (pathAssets.length === 2) {
    return readers.readSoroswapAmountOut(amountBase, pathAssets[0], pathAssets[1], readerPubKey);
  }
  if (!readers.readSoroswapAmountOutForPath) return 0;
  return readers.readSoroswapAmountOutForPath(amountBase, pathAssets, readerPubKey);
}

async function mapWithConcurrency<TInput, TOutput>(
  items: TInput[],
  concurrency: number,
  worker: (item: TInput, index: number) => Promise<TOutput>,
): Promise<TOutput[]> {
  const results = new Array<TOutput>(items.length);
  let nextIndex = 0;
  const workerCount = Math.min(Math.max(1, concurrency), items.length);

  await Promise.all(
    Array.from({ length: workerCount }, async () => {
      while (nextIndex < items.length) {
        const index = nextIndex;
        nextIndex += 1;
        results[index] = await worker(items[index], index);
      }
    }),
  );

  return results;
}

function clampInteger(value: number | undefined, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.max(min, Math.min(max, Math.trunc(value ?? min)));
}

function resolveRouteSearchConfig(
  config: RebalanceRouteSearchConfig | undefined,
  directOnly: boolean,
): Required<RebalanceRouteSearchConfig> {
  if (directOnly) {
    return {
      maxIntermediaries: 0,
      maxHops: 1,
      quoteBudget: 1,
      splitParts: 1,
      beamWidth: 0,
      tailProbeCount: 0,
    };
  }
  return {
    maxIntermediaries: clampInteger(
      config?.maxIntermediaries ?? DEFAULT_BROKER_GRADE_INTERMEDIARIES,
      0,
      MAX_BROKER_GRADE_INTERMEDIARIES,
    ),
    maxHops: clampInteger(
      config?.maxHops ?? DEFAULT_BROKER_GRADE_MAX_HOPS,
      1,
      MAX_BROKER_GRADE_HOPS,
    ),
    quoteBudget: clampInteger(
      config?.quoteBudget ?? DEFAULT_BROKER_GRADE_QUOTE_BUDGET,
      1,
      MAX_BROKER_GRADE_QUOTE_BUDGET,
    ),
    splitParts: clampInteger(
      config?.splitParts ?? DEFAULT_SPLIT_ROUTE_PARTS,
      1,
      MAX_SPLIT_ROUTE_PARTS,
    ),
    beamWidth: clampInteger(
      config?.beamWidth ?? DEFAULT_BROKER_GRADE_BEAM_WIDTH,
      1,
      MAX_BROKER_GRADE_BEAM_WIDTH,
    ),
    tailProbeCount: clampInteger(
      config?.tailProbeCount ?? DEFAULT_BROKER_GRADE_TAIL_PROBES,
      0,
      MAX_BROKER_GRADE_TAIL_PROBES,
    ),
  };
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

function countSoroswapPathUniverse(
  intermediaryCount: number,
  maxHops: number,
): number {
  const maxIntermediariesInPath = Math.min(intermediaryCount, Math.max(0, maxHops - 1));
  let total = 0;
  for (let length = 0; length <= maxIntermediariesInPath; length += 1) {
    total += permutationCount(intermediaryCount, length);
  }
  return total;
}

function calculateBps(numerator: number, denominator: number): number {
  if (denominator <= 0 || numerator <= 0) return 0;
  return Math.min(10_000, Math.floor((numerator * 10_000) / denominator));
}

function calculatePpm(numerator: number, denominator: number): number {
  if (denominator <= 0 || numerator <= 0) return 0;
  return Math.min(1_000_000, Math.floor((numerator * 1_000_000) / denominator));
}

function resolveSearchBenchmarkScale(input: {
  directOnly: boolean;
  universeSize: number;
  quoteBudget: number;
}): RebalanceRouteSearchTelemetry["benchmarkScale"] {
  if (input.directOnly) return "direct";
  if (input.universeSize >= 1_000_000 && input.quoteBudget >= 12) {
    return "million_scale_bounded";
  }
  return "bounded";
}

function countHopDepths(paths: Array<{ pathAssets?: string[]; hops?: number } | string[]>): RebalanceRouteHopCount[] {
  const counts = new Map<number, number>();
  for (const item of paths) {
    const hops = Array.isArray(item)
      ? Math.max(0, item.length - 1)
      : item.hops ?? Math.max(0, (item.pathAssets?.length ?? 1) - 1);
    counts.set(hops, (counts.get(hops) ?? 0) + 1);
  }
  return Array.from(counts.entries())
    .sort(([left], [right]) => left - right)
    .map(([hops, pathCount]) => ({ hops, pathCount }));
}

function deepestHopDepth(counts: RebalanceRouteHopCount[]): number {
  return counts.reduce((deepest, item) => Math.max(deepest, item.hops), 0);
}

type IntermediaryPermutationSearch = {
  permutations: string[][];
  deterministicProbeCount: number;
};

function buildCyclicPermutation(input: {
  orderedIntermediaries: string[];
  length: number;
  offset: number;
  stride: number;
}): string[] {
  const candidate: string[] = [];
  const seen = new Set<string>();
  const size = input.orderedIntermediaries.length;
  if (size === 0) return candidate;

  for (let step = 0; step < size && candidate.length < input.length; step += 1) {
    const asset =
      input.orderedIntermediaries[(input.offset + step * input.stride) % size];
    if (seen.has(asset)) continue;
    seen.add(asset);
    candidate.push(asset);
  }

  return candidate;
}

function buildAlternatingIntermediaryOrder(intermediaries: string[]): string[] {
  const ordered: string[] = [];
  let left = 0;
  let right = intermediaries.length - 1;

  while (left <= right) {
    ordered.push(intermediaries[left]);
    if (left !== right) ordered.push(intermediaries[right]);
    left += 1;
    right -= 1;
  }

  return ordered;
}

function buildBeamCandidate(input: {
  anchor: string;
  primaryOrder: string[];
  secondaryOrder: string[];
  length: number;
  offset: number;
}): string[] {
  const candidate = [input.anchor];
  const seen = new Set(candidate);
  const mergedOrder = [
    ...input.primaryOrder.slice(input.offset),
    ...input.primaryOrder.slice(0, input.offset),
    ...input.secondaryOrder,
  ];

  for (const asset of mergedOrder) {
    if (candidate.length >= input.length) break;
    if (seen.has(asset)) continue;
    seen.add(asset);
    candidate.push(asset);
  }

  return candidate;
}

function generateIntermediaryPermutations(
  intermediaries: string[],
  length: number,
  limit: number,
  config: Pick<Required<RebalanceRouteSearchConfig>, "beamWidth" | "tailProbeCount">,
): IntermediaryPermutationSearch {
  if (length === 0) {
    return {
      permutations: [[]],
      deterministicProbeCount: 1,
    };
  }
  if (limit <= 0 || length > intermediaries.length) {
    return {
      permutations: [],
      deterministicProbeCount: 0,
    };
  }

  const results: string[][] = [];
  const seen = new Set<string>();
  const used = new Set<string>();
  const orderedIntermediaries = buildStratifiedIntermediaryOrder(intermediaries);
  const reverseIntermediaries = [...intermediaries].reverse();
  const reverseStratified = [...orderedIntermediaries].reverse();
  const alternatingIntermediaries = buildAlternatingIntermediaryOrder(intermediaries);
  const beamWidth = Math.min(config.beamWidth, intermediaries.length);
  const tailProbeCount = Math.min(
    config.tailProbeCount,
    Math.max(0, intermediaries.length * 8),
  );
  let deterministicProbeCount = 0;

  const addCandidate = (candidate: string[]) => {
    deterministicProbeCount += 1;
    if (results.length >= limit) return;
    if (candidate.length !== length) return;
    if (new Set(candidate).size !== candidate.length) return;
    if (candidate.some((asset) => !intermediaries.includes(asset))) return;
    const key = candidate.join(">");
    if (seen.has(key)) return;
    seen.add(key);
    results.push(candidate);
  };

  addCandidate(orderedIntermediaries.slice(0, length));
  addCandidate(intermediaries.slice(-length).reverse());
  addCandidate(intermediaries.slice(-length));

  const middleStart = Math.max(
    0,
    Math.floor((intermediaries.length - length) / 2),
  );
  addCandidate(intermediaries.slice(middleStart, middleStart + length));

  const strides = [2, 3, 5, 7, 11].filter(
    (stride) => stride < intermediaries.length,
  );
  let tailProbeIndex = 0;
  for (const stride of strides) {
    for (
      let offset = 0;
      offset < orderedIntermediaries.length && tailProbeIndex < tailProbeCount;
      offset += 1
    ) {
      addCandidate(
        buildCyclicPermutation({
          orderedIntermediaries,
          length,
          offset,
          stride,
        }),
      );
      tailProbeIndex += 1;
      if (results.length >= limit) {
        return {
          permutations: results,
          deterministicProbeCount,
        };
      }
    }
  }

  for (let index = 0; index < beamWidth; index += 1) {
    const anchor = orderedIntermediaries[index];
    addCandidate(
      buildBeamCandidate({
        anchor,
        primaryOrder: reverseIntermediaries,
        secondaryOrder: alternatingIntermediaries,
        length,
        offset: index,
      }),
    );
    addCandidate(
      buildBeamCandidate({
        anchor,
        primaryOrder: alternatingIntermediaries,
        secondaryOrder: reverseStratified,
        length,
        offset: index,
      }),
    );
    if (results.length >= limit) {
      return {
        permutations: results,
        deterministicProbeCount,
      };
    }
  }

  addCandidate(alternatingIntermediaries.slice(0, length));
  addCandidate(reverseStratified.slice(0, length));

  function visit(prefix: string[]) {
    if (results.length >= limit) return;
    if (prefix.length === length) {
      addCandidate([...prefix]);
      return;
    }
    for (const asset of orderedIntermediaries) {
      if (used.has(asset)) continue;
      used.add(asset);
      prefix.push(asset);
      visit(prefix);
      prefix.pop();
      used.delete(asset);
      if (results.length >= limit) return;
    }
  }

  visit([]);
  return {
    permutations: results,
    deterministicProbeCount,
  };
}

function buildStratifiedIntermediaryOrder(intermediaries: string[]): string[] {
  if (intermediaries.length <= 2) return intermediaries;

  const ordered: string[] = [];
  const seen = new Set<number>();
  const lastIndex = intermediaries.length - 1;
  const middleIndex = Math.floor(lastIndex / 2);

  const addIndex = (index: number) => {
    if (index < 0 || index > lastIndex || seen.has(index)) return;
    seen.add(index);
    ordered.push(intermediaries[index]);
  };

  for (let offset = 0; ordered.length < intermediaries.length; offset += 1) {
    addIndex(offset);
    addIndex(lastIndex - offset);
    addIndex(middleIndex + offset);
    addIndex(middleIndex - offset);
  }

  return ordered;
}

type SoroswapPathSearch = {
  paths: string[][];
  telemetry: RebalanceRouteSearchTelemetry;
};

async function buildSoroswapCandidates(
  input: ResolveRebalanceRouteInput,
  readers: RebalanceRouteReaders,
): Promise<{
  candidates: RebalanceRouteCandidate[];
  telemetry: RebalanceRouteSearchTelemetry;
}> {
  const policy = resolvePolicy("SOROSWAP", input.protocolPolicies);
  const pathSearch = buildSoroswapPathDefinitions({
    tokenIn: input.tokenIn,
    tokenOut: input.tokenOut,
    routingAssets: input.routingAssets ?? [],
    directOnly: policy.directOnly,
    routingSearch: input.routingSearch,
  });

  const candidates = await mapWithConcurrency(
    pathSearch.paths,
    MAX_CONCURRENT_ROUTE_QUOTES,
    async (pathAssets, index) => {
      const quote = await readSoroswapPathQuote(readers, input.amountBase, pathAssets, input.readerPubKey).catch(() => 0);
      const pathLabel = formatRebalanceRoutePath(pathAssets);
      const admitted = policy.planningEnabled && (policy.executionEnabled || quote <= 0);
      const minOutBase =
        quote > 0
          ? quotedMinOut(quote, input.slippagePct)
          : fallbackMinOut(input.amountBase, input.slippagePct);
      const routeScore = admitted
        ? scoreRoute({
            protocol: "SOROSWAP",
            quoteModel: "live_router_quote",
            estimatedOutBase: quote,
            minOutBase,
            hops: Math.max(0, pathAssets.length - 1),
            policy,
          })
        : { scoreBase: 0, scoreLabel: "score unavailable", components: null };
      return withManualOverride(
        {
          routeId: `SOROSWAP_${index}`,
          protocol: "SOROSWAP",
          venueFamily: "amm_router",
          quoteModel: "live_router_quote",
          settlementModel: "onchain_router",
          pathModel:
            pathAssets.length > 2 ? "router_multi_hop" : "router_direct",
          confirmationModel: "transaction_hash_plus_refresh",
          title: buildRouteTitle("SOROSWAP", pathAssets),
          estimatedOutBase: quote > 0 ? quote : 0,
          minOutBase,
          available: quote > 0 && admitted,
          admitted,
          autoEligible: quote > 0 && admitted && policy.autoExecutionEnabled !== false,
          note:
            !policy.planningEnabled
              ? policy.disabledReason ?? "Protocol is not admitted for planning in the current environment."
              : quote > 0
              ? `Live router quote available for ${pathLabel}.`
              : `No live quote is available for ${pathLabel}.`,
          pathAssets,
          pathLabel,
          hops: Math.max(0, pathAssets.length - 1),
          routeScoreBase: routeScore.scoreBase,
          routeScoreLabel: routeScore.scoreLabel,
          routeScoreComponents: routeScore.components ?? undefined,
          executionKind: "soroswap_path",
          adapterId: input.soroswapAdapterId,
          poolId: index + 1,
          steps: pathAssets.slice(0, -1).map((asset, stepIndex) => ({
            protocol: "SOROSWAP",
            tokenIn: asset,
            tokenOut: pathAssets[stepIndex + 1],
          })),
        },
        input.manualMinOutBase,
      );
    },
  );

  const liveQuoteCount = candidates.filter(
    (candidate) => candidate.estimatedOutBase > 0,
  ).length;
  const quoteCoverageBps = calculateBps(
    candidates.length,
    pathSearch.telemetry.candidateUniverseSize,
  );
  const quoteCoveragePpm = calculatePpm(
    candidates.length,
    pathSearch.telemetry.candidateUniverseSize,
  );
  const budgetUtilizationBps = calculateBps(
    candidates.length,
    Math.max(1, pathSearch.telemetry.quoteBudget),
  );
  const quotedHopCounts = countHopDepths(candidates);
  return {
    candidates,
    telemetry: {
      ...pathSearch.telemetry,
      quotedPathCount: candidates.length,
      liveQuoteCount,
      quoteCoverageBps,
      quoteCoveragePpm,
      budgetUtilizationBps,
      quotedHopCounts,
      deepestQuotedHops: deepestHopDepth(quotedHopCounts),
      note:
        pathSearch.telemetry.strategy === "direct_only_policy"
          ? "SoroSwap search is constrained to the direct path by protocol policy."
          : `Broker-grade bounded search evaluated ${candidates.length.toLocaleString()} live SoroSwap quote paths through ${deepestHopDepth(quotedHopCounts).toLocaleString()} hops from a ${pathSearch.telemetry.candidateUniverseSize.toLocaleString()} path universe (${pathSearch.telemetry.benchmarkScale.replaceAll("_", " ")}).`,
    },
  };
}

function buildSoroswapPathDefinitions(input: {
  tokenIn: string;
  tokenOut: string;
  routingAssets: string[];
  directOnly: boolean;
  routingSearch?: RebalanceRouteSearchConfig;
}): SoroswapPathSearch {
  const searchConfig = resolveRouteSearchConfig(
    input.routingSearch,
    input.directOnly,
  );
  const intermediaries = Array.from(
    new Set(
      input.routingAssets.filter(
        (asset) =>
          Boolean(asset) && asset !== input.tokenIn && asset !== input.tokenOut,
      ),
    ),
  ).slice(0, searchConfig.maxIntermediaries);
  const universeSize = countSoroswapPathUniverse(
    intermediaries.length,
    searchConfig.maxHops,
  );

  const paths: string[][] = [[input.tokenIn, input.tokenOut]];
  let deterministicProbeCount = 1;
  if (!input.directOnly && searchConfig.quoteBudget > 1) {
    const maxIntermediariesInPath = Math.min(
      intermediaries.length,
      Math.max(0, searchConfig.maxHops - 1),
    );
    for (let length = 1; length <= maxIntermediariesInPath; length += 1) {
      const remainingSlots = searchConfig.quoteBudget - paths.length;
      if (remainingSlots <= 0) break;
      const remainingDepths = maxIntermediariesInPath - length + 1;
      const quota = Math.max(1, Math.ceil(remainingSlots / remainingDepths));
      const permutationSearch = generateIntermediaryPermutations(
        intermediaries,
        length,
        quota,
        {
          beamWidth: searchConfig.beamWidth,
          tailProbeCount: searchConfig.tailProbeCount,
        },
      );
      deterministicProbeCount += permutationSearch.deterministicProbeCount;
      for (const permutation of permutationSearch.permutations) {
        if (paths.length >= searchConfig.quoteBudget) break;
        paths.push([input.tokenIn, ...permutation, input.tokenOut]);
      }
    }
  }

  const deduped = Array.from(
    new Map(paths.map((path) => [path.join(">"), path])).values(),
  );
  const generatedPathCount = deduped.length;
  const generatedHopCounts = countHopDepths(deduped);
  return {
    paths: deduped,
    telemetry: {
      strategy: input.directOnly
        ? "direct_only_policy"
        : "broker_grade_bounded_global_search",
      benchmarkScale: resolveSearchBenchmarkScale({
        directOnly: input.directOnly,
        universeSize,
        quoteBudget: searchConfig.quoteBudget,
      }),
      samplingModel: input.directOnly
        ? "direct"
        : "broker_frontier_beam_tail_probe",
      candidateUniverseSize: universeSize,
      generatedPathCount,
      quotedPathCount: 0,
      liveQuoteCount: 0,
      prunedPathCount: Math.max(0, universeSize - generatedPathCount),
      returnedCandidateCount: 0,
      quoteCoverageBps: 0,
      quoteCoveragePpm: 0,
      budgetUtilizationBps: 0,
      generatedHopCounts,
      quotedHopCounts: [],
      deepestGeneratedHops: deepestHopDepth(generatedHopCounts),
      deepestQuotedHops: 0,
      maxIntermediaries: intermediaries.length,
      maxHops: searchConfig.maxHops,
      quoteBudget: searchConfig.quoteBudget,
      splitParts: searchConfig.splitParts,
      beamWidth: searchConfig.beamWidth,
      tailProbeCount: searchConfig.tailProbeCount,
      deterministicProbeCount,
      venuesCompared: ["SOROSWAP"],
      note: "",
    },
  };
}

async function buildAquariusCandidate(
  input: ResolveRebalanceRouteInput,
  readers: RebalanceRouteReaders,
): Promise<RebalanceRouteCandidate> {
  const policy = resolvePolicy("AQUARIUS", input.protocolPolicies);
  const discoveredPoolIndex =
    input.configuredAquariusPoolIndex ||
    (await readers
      .readAquariusPoolIndex(input.aquariusRouterId, input.tokenIn, input.tokenOut, input.readerPubKey)
      .catch(() => "")) ||
    "";
  const quote =
    discoveredPoolIndex.length > 0
      ? await readers
          .readAquariusEstimateOut(
            input.aquariusRouterId,
            input.tokenIn,
            input.tokenOut,
            discoveredPoolIndex,
            input.amountBase,
            input.readerPubKey,
          )
          .catch(() => 0)
      : 0;
  const pathAssets = [input.tokenIn, input.tokenOut];
  const admitted = policy.planningEnabled && (policy.executionEnabled || quote <= 0);
  const minOutBase =
    quote > 0
      ? quotedMinOut(quote, input.slippagePct)
      : fallbackMinOut(input.amountBase, input.slippagePct);
  const routeScore = admitted
    ? scoreRoute({
        protocol: "AQUARIUS",
        quoteModel: "live_router_quote",
        estimatedOutBase: quote,
        minOutBase,
        hops: 1,
        policy,
      })
    : { scoreBase: 0, scoreLabel: "score unavailable", components: null };
  return withManualOverride(
    {
      routeId: "AQUARIUS_DIRECT",
      protocol: "AQUARIUS",
      venueFamily: "amm_router",
      quoteModel: "live_router_quote",
      settlementModel: "onchain_router",
      pathModel: "router_direct",
      confirmationModel: "transaction_hash_plus_refresh",
      title: buildRouteTitle("AQUARIUS", pathAssets),
      estimatedOutBase: quote > 0 ? quote : 0,
      minOutBase,
      available: quote > 0 && admitted,
      admitted,
      autoEligible: quote > 0 && admitted && policy.autoExecutionEnabled !== false,
      note:
        !policy.planningEnabled
          ? policy.disabledReason ?? "Protocol is not admitted for planning in the current environment."
          : discoveredPoolIndex.length === 0
          ? "No eligible pool was found for this pair."
          : quote > 0
            ? `Live router quote available for ${formatRebalanceRoutePath(pathAssets)}.`
            : "The pool is available, but it did not return a live quote.",
      pathAssets,
      pathLabel: formatRebalanceRoutePath(pathAssets),
      hops: 1,
      routeScoreBase: routeScore.scoreBase,
      routeScoreLabel: routeScore.scoreLabel,
      routeScoreComponents: routeScore.components ?? undefined,
      executionKind: "aquarius_single_pool",
      adapterId: input.aquariusAdapterId,
      poolId: input.aquariusPoolId ?? 0,
      steps: [
        {
          protocol: "AQUARIUS",
          tokenIn: input.tokenIn,
          tokenOut: input.tokenOut,
          poolIndexHex: discoveredPoolIndex || undefined,
        },
      ],
      poolIndexHex: discoveredPoolIndex || undefined,
    },
    input.manualMinOutBase,
  );
}

async function buildPhoenixCandidate(
  input: ResolveRebalanceRouteInput,
  readers: RebalanceRouteReaders,
): Promise<RebalanceRouteCandidate> {
  const policy = resolvePolicy("PHOENIX", input.protocolPolicies);
  if(!policy.planningEnabled)return createFallbackCandidate("PHOENIX",input.amountBase,input.slippagePct,policy.disabledReason!);
  const pool = input.configuredPhoenixPool?.trim() ?? "";
  const adapterReady = Boolean(input.phoenixAdapterId?.trim());
  const poolReady = pool.length > 0;
  const quote =
    poolReady && readers.readPhoenixEstimateOut
      ? await readers
          .readPhoenixEstimateOut(
            pool,
            input.tokenIn,
            input.amountBase,
            input.readerPubKey,
          )
          .catch(() => 0)
      : 0;
  const executionReady = adapterReady && poolReady;
  const admitted =
    policy.planningEnabled && policy.executionEnabled && executionReady;
  const pathAssets = [input.tokenIn, input.tokenOut];
  const minOutBase =
    quote > 0
      ? quotedMinOut(quote, input.slippagePct)
      : fallbackMinOut(input.amountBase, input.slippagePct);
  const routeScore = admitted
    ? scoreRoute({
        protocol: "PHOENIX",
        quoteModel: "live_router_quote",
        estimatedOutBase: quote,
        minOutBase,
        hops: 1,
        policy,
      })
    : { scoreBase: 0, scoreLabel: "score unavailable", components: null };
  const note =
    !policy.planningEnabled
      ? policy.disabledReason ?? "Phoenix is not available in the current environment."
      : !poolReady
        ? "Phoenix pool is not configured for this asset pair."
        : !adapterReady
          ? "Phoenix pool quote can be checked, but vault execution is not configured yet."
          : !readers.readPhoenixEstimateOut
            ? "Phoenix execution is configured, but live quote reading is not available yet."
            : quote > 0
              ? `Live Phoenix pool quote available for ${formatRebalanceRoutePath(pathAssets)}.`
              : "Phoenix is configured, but it did not return a live quote.";

  return withManualOverride(
    {
      routeId: "PHOENIX_DIRECT",
      protocol: "PHOENIX",
      venueFamily: "amm_router",
      quoteModel: "live_router_quote",
      settlementModel: "onchain_adapter",
      pathModel: "adapter_gated",
      confirmationModel: "transaction_hash_plus_refresh",
      title: buildRouteTitle("PHOENIX", pathAssets),
      estimatedOutBase: quote > 0 ? quote : 0,
      minOutBase,
      available: quote > 0 && admitted,
      admitted,
      autoEligible: quote > 0 && admitted && policy.autoExecutionEnabled !== false,
      note,
      pathAssets,
      pathLabel: formatRebalanceRoutePath(pathAssets),
      hops: 1,
      routeScoreBase: routeScore.scoreBase,
      routeScoreLabel: routeScore.scoreLabel,
      routeScoreComponents: routeScore.components ?? undefined,
      executionKind: "phoenix_pool",
      adapterId: input.phoenixAdapterId,
      poolId: input.phoenixPoolId ?? 0,
      steps: [
        {
          protocol: "PHOENIX",
          tokenIn: input.tokenIn,
          tokenOut: input.tokenOut,
        },
      ],
    },
    input.manualMinOutBase,
  );
}

async function buildSushiCandidate(
  input: ResolveRebalanceRouteInput,
  readers: RebalanceRouteReaders,
): Promise<RebalanceRouteCandidate> {
  const policy = resolvePolicy("SUSHI", input.protocolPolicies);
  if(!policy.planningEnabled)return createFallbackCandidate("SUSHI",input.amountBase,input.slippagePct,policy.disabledReason!);
  const pool = input.sushiAdapterId?.trim() ?? "";
  const adapterReady = Boolean(input.sushiAdapterId?.trim());
  const poolReady = pool.length > 0 && Number.isSafeInteger(input.sushiPoolId) && input.sushiPoolId! >= 0;
  const quote =
    poolReady && readers.readSushiEstimateOut
      ? await readers
          .readSushiEstimateOut(
            pool,
            input.sushiPoolId!,
            input.tokenIn,
            input.tokenOut,
            input.amountBase,
            input.readerPubKey,
          )
          .catch(() => 0)
      : 0;
  const executionReady = adapterReady && poolReady;
  const admitted =
    policy.planningEnabled && policy.executionEnabled && executionReady;
  const pathAssets = [input.tokenIn, input.tokenOut];
  const minOutBase =
    quote > 0
      ? quotedMinOut(quote, input.slippagePct)
      : fallbackMinOut(input.amountBase, input.slippagePct);
  const routeScore = admitted
    ? scoreRoute({
        protocol: "SUSHI",
        quoteModel: "live_router_quote",
        estimatedOutBase: quote,
        minOutBase,
        hops: 1,
        policy,
      })
    : { scoreBase: 0, scoreLabel: "score unavailable", components: null };
  const note =
    !policy.planningEnabled
      ? policy.disabledReason ?? "Sushi is not available in the current environment."
      : !poolReady
        ? "Sushi pool is not configured for this asset pair."
        : !adapterReady
          ? "Sushi pool quote can be checked, but vault execution is not configured yet."
          : !readers.readSushiEstimateOut
            ? "Sushi execution is configured, but live quote reading is not available yet."
            : quote > 0
              ? `Live Sushi pool quote available for ${formatRebalanceRoutePath(pathAssets)}.`
              : "Sushi is configured, but it did not return a live quote.";

  return withManualOverride(
    {
      routeId: "SUSHI_DIRECT",
      protocol: "SUSHI",
      venueFamily: "amm_router",
      quoteModel: "live_router_quote",
      settlementModel: "onchain_adapter",
      pathModel: "adapter_gated",
      confirmationModel: "transaction_hash_plus_refresh",
      title: buildRouteTitle("SUSHI", pathAssets),
      estimatedOutBase: quote > 0 ? quote : 0,
      minOutBase,
      available: quote > 0 && admitted,
      admitted,
      autoEligible: quote > 0 && admitted && policy.autoExecutionEnabled !== false,
      note,
      pathAssets,
      pathLabel: formatRebalanceRoutePath(pathAssets),
      hops: 1,
      routeScoreBase: routeScore.scoreBase,
      routeScoreLabel: routeScore.scoreLabel,
      routeScoreComponents: routeScore.components ?? undefined,
      executionKind: "sushi_pool",
      adapterId: input.sushiAdapterId,
      poolId: input.sushiPoolId ?? 0,
      steps: [
        {
          protocol: "SUSHI",
          tokenIn: input.tokenIn,
          tokenOut: input.tokenOut,
        },
      ],
    },
    input.manualMinOutBase,
  );
}

function buildBalancedCandidate(
  input: ResolveRebalanceRouteInput,
): RebalanceRouteCandidate {
  const policy = resolvePolicy("BALANCED", input.protocolPolicies);
  const lane = input.balancedLane;
  const pathAssets = [input.tokenIn, input.tokenOut];
  const fallbackLaneReady = Boolean(
    lane &&
      lane.ready &&
      lane.adapterId &&
      Number.isFinite(lane.poolId) &&
      lane.poolId > 0,
  );
  const laneReady = input.balancedLaneReady ?? fallbackLaneReady;
  const explicitBalancedSelection = input.requestedProtocol === "BALANCED";
  const admitted =
    laneReady &&
    (policy.planningEnabled ||
      (explicitBalancedSelection && policy.executionEnabled));
  const plannerAdmission = lane?.plannerAdmission ?? "blocked";
  const comparableLifecycleReady = input.balancedComparableLifecycleReady ?? true;
  const liveIntentQuoteOutBase = Math.max(
    0,
    Math.trunc(input.balancedComparableQuoteOutBase ?? 0),
  );
  const liveIntentQuoteAvailable = liveIntentQuoteOutBase > 0;
  const comparableIntentQuote =
    policy.planningEnabled &&
    comparableLifecycleReady &&
    (Boolean(lane?.comparableQuote) || liveIntentQuoteAvailable);
  const canaryAutoEligible =
    input.balancedCanaryPolicy?.autoEligible ?? true;
  const lifecycleAwarePlannerAdmission =
    !comparableLifecycleReady && plannerAdmission === "auto"
      ? "manual_only"
      : plannerAdmission;
  const effectivePlannerAdmission = admitted
    ? comparableIntentQuote
      ? "auto"
      : lifecycleAwarePlannerAdmission
    : "blocked";
  const balancedQuoteProvider =
    input.balancedComparableQuoteProvider?.trim() || "SODAX";
  const policyReason =
    policy.disabledReason !== DEFAULT_PROTOCOL_POLICIES.BALANCED.disabledReason
      ? policy.disabledReason
      : undefined;
  const baseReason =
    policyReason ||
    lane?.capabilityNote ||
    lane?.blockingReasons[0] ||
    (lane?.supportStatus === "inactive"
      ? "Balanced is inactive in the current deployment."
      : lane?.laneMode === "legacy_comet"
        ? "Balanced is still coupled to the retired Comet legacy route."
        : "Balanced stays blocked until the canonical integration is ready.");
  const note = admitted
    ? input.balancedCanaryPolicy && !canaryAutoEligible
      ? `${input.balancedCanaryPolicy.detail} Balanced remains available for direct execution.`
      : liveIntentQuoteAvailable
      ? comparableLifecycleReady
        ? `Balanced intent routing is live through ${balancedQuoteProvider} quote/status and can participate in AUTO.`
        : "Balanced quote data is visible, but status and confirmation are not complete enough for AUTO. Keeping this route manual."
      : !comparableLifecycleReady
        ? "Balanced quote, status and confirmation are not complete enough for AUTO yet, so this route stays manual."
      : plannerAdmission === "auto"
        ? "Balanced has a comparable public quote and can participate in AUTO."
        : lane?.validatedModulePresent
          ? "Balanced is promoted, but still needs a comparable public quote before AUTO can use it."
          : "Balanced is ready but still awaiting final promotion. This remains manual execution."
    : input.balancedComparableQuoteError && laneReady
      ? `${baseReason} Comparable quote probe failed: ${input.balancedComparableQuoteError}`
      : baseReason;
  const estimatedOutBase =
    admitted && liveIntentQuoteAvailable && comparableLifecycleReady
      ? liveIntentQuoteOutBase
      : 0;
  const minOutBase =
    admitted && liveIntentQuoteAvailable && comparableLifecycleReady
      ? quotedMinOut(liveIntentQuoteOutBase, input.slippagePct)
      : fallbackMinOut(input.amountBase, input.slippagePct);
  const autoEligible =
    admitted &&
    policy.planningEnabled &&
    policy.executionEnabled &&
    effectivePlannerAdmission === "auto" &&
    liveIntentQuoteAvailable &&
    canaryAutoEligible;
  const routeScore = autoEligible
    ? scoreRoute({
        protocol: "BALANCED",
        quoteModel: "public_intent_quote",
        estimatedOutBase: liveIntentQuoteOutBase,
        minOutBase,
        hops: 1,
        policy,
      })
    : { scoreBase: 0, scoreLabel: "score unavailable", components: null };
  const routeScoreBase = routeScore.scoreBase;
  const routeScoreLabel = autoEligible
    ? routeScore.scoreLabel
    : admitted && input.balancedCanaryPolicy && !canaryAutoEligible
      ? "direct execution only"
    : admitted && effectivePlannerAdmission === "auto"
      ? "intent quote unavailable"
      : admitted
        ? "manual execution (quote pending)"
        : "blocked";
  return withManualOverride(
    {
      routeId: "BALANCED_DIRECT",
      protocol: "BALANCED",
      venueFamily: "intent_execution",
      quoteModel:
        admitted && comparableIntentQuote
          ? "public_intent_quote"
          : admitted
            ? "manual_lane"
            : "intent_surface_unverified",
      settlementModel: "intent_settlement",
      pathModel: "adapter_gated",
      confirmationModel: "transaction_hash_plus_refresh",
      title: "Balanced direct",
      estimatedOutBase,
      minOutBase,
      available: admitted && policy.executionEnabled,
      admitted,
      autoEligible,
      note,
      pathAssets,
      pathLabel: formatRebalanceRoutePath(pathAssets),
      hops: 1,
      routeScoreBase,
      routeScoreLabel,
      routeScoreComponents: routeScore.components ?? undefined,
      autoPolicy: input.balancedCanaryPolicy
        ? {
            status: input.balancedCanaryPolicy.status,
            code: input.balancedCanaryPolicy.code,
            detail: input.balancedCanaryPolicy.detail,
            minAmountBase:
              input.balancedCanaryPolicy.policy?.minAmountBase,
            recommendedMinOutBps:
              input.balancedCanaryPolicy.policy?.recommendedMinOutBps,
            evidenceLabel:
              input.balancedCanaryPolicy.policy?.evidenceLabel,
          }
        : undefined,
      executionKind: "balanced_adapter",
      steps: [
        {
          protocol: "BALANCED",
          tokenIn: input.tokenIn,
          tokenOut: input.tokenOut,
        },
      ],
      adapterId: lane?.adapterId,
      poolId: lane?.poolId,
    },
    input.manualMinOutBase,
  );
}

function protocolSelectionPriority(protocol: ManualRebalanceProtocol): number {
  if (protocol === "AQUARIUS") return 0;
  if (protocol === "PHOENIX") return 1;
  if (protocol === "SOROSWAP") return 2;
  return 3;
}

function pickPreferredCandidate(
  current: RebalanceRouteCandidate,
  candidate: RebalanceRouteCandidate,
): RebalanceRouteCandidate {
  const referenceBase = Math.max(
    1,
    current.estimatedOutBase,
    candidate.estimatedOutBase,
  );
  const scoreDelta = candidate.routeScoreBase - current.routeScoreBase;
  const scoreDeltaBps = Math.floor((Math.abs(scoreDelta) * 10_000) / referenceBase);
  const withinTieWindow = scoreDeltaBps <= ROUTE_SCORE_TIE_WINDOW_BPS;

  if (!withinTieWindow && scoreDelta !== 0) {
    return scoreDelta > 0 ? candidate : current;
  }

  const currentPenalty = current.routeScoreComponents?.effectivePenaltyBps ?? Number.MAX_SAFE_INTEGER;
  const candidatePenalty = candidate.routeScoreComponents?.effectivePenaltyBps ?? Number.MAX_SAFE_INTEGER;
  if (candidatePenalty !== currentPenalty) {
    return candidatePenalty < currentPenalty ? candidate : current;
  }

  const currentFillRisk = current.routeScoreComponents?.fillRiskPenaltyBps ?? Number.MAX_SAFE_INTEGER;
  const candidateFillRisk = candidate.routeScoreComponents?.fillRiskPenaltyBps ?? Number.MAX_SAFE_INTEGER;
  if (candidateFillRisk !== currentFillRisk) {
    return candidateFillRisk < currentFillRisk ? candidate : current;
  }

  if (candidate.hops !== current.hops) {
    return candidate.hops < current.hops ? candidate : current;
  }

  if (candidate.estimatedOutBase !== current.estimatedOutBase) {
    return candidate.estimatedOutBase > current.estimatedOutBase ? candidate : current;
  }

  const candidatePriority = protocolSelectionPriority(candidate.protocol);
  const currentPriority = protocolSelectionPriority(current.protocol);
  if (candidatePriority !== currentPriority) {
    return candidatePriority < currentPriority ? candidate : current;
  }

  return candidate.routeId.localeCompare(current.routeId) < 0 ? candidate : current;
}

function selectBestCandidate(
  candidates: RebalanceRouteCandidate[],
  autoOnly = false,
): RebalanceRouteCandidate | null {
  const available = candidates.filter(
    (candidate) =>
      candidate.available &&
      candidate.routeScoreBase > 0 &&
      (!autoOnly || candidate.autoEligible),
  );
  if (available.length === 0) return null;
  return available.reduce((best, candidate) =>
    pickPreferredCandidate(best, candidate),
  );
}

function isSplitExecutableCandidate(
  candidate: RebalanceRouteCandidate,
): candidate is RebalanceRouteCandidate & {
  protocol: Exclude<ManualRebalanceProtocol, "BALANCED">;
} {
  return (
    candidate.protocol !== "BALANCED" &&
    candidate.available &&
    candidate.autoEligible &&
    candidate.estimatedOutBase > 0
  );
}

function splitAmountIntoChunks(amountBase: number, chunkCount: number): number[] {
  const resolvedChunkCount = Math.max(1, Math.min(chunkCount, amountBase));
  const baseChunk = Math.floor(amountBase / resolvedChunkCount);
  let remainder = amountBase - baseChunk * resolvedChunkCount;
  return Array.from({ length: resolvedChunkCount }, () => {
    const chunk = baseChunk + (remainder > 0 ? 1 : 0);
    remainder = Math.max(0, remainder - 1);
    return chunk;
  }).filter((chunk) => chunk > 0);
}

function generateSplitChunkCountDistributions(input: {
  routeCount: number;
  chunkCount: number;
}): number[][] {
  const routeCount = Math.max(0, input.routeCount);
  const chunkCount = Math.max(0, input.chunkCount);
  if (routeCount === 0 || chunkCount === 0) return [];

  const results: number[][] = [];
  const counts = Array.from({ length: routeCount }, () => 0);

  function visit(routeIndex: number, remainingChunks: number) {
    if (routeIndex === routeCount - 1) {
      counts[routeIndex] = remainingChunks;
      results.push([...counts]);
      counts[routeIndex] = 0;
      return;
    }

    for (let count = 0; count <= remainingChunks; count += 1) {
      counts[routeIndex] = count;
      visit(routeIndex + 1, remainingChunks - count);
    }
    counts[routeIndex] = 0;
  }

  visit(0, chunkCount);
  return results;
}

function resolveChunkCountAmounts(input: {
  amountBase: number;
  chunkCount: number;
  chunkCounts: number[];
}): number[] {
  const chunkCount = Math.max(1, input.chunkCount);
  const baseChunk = Math.floor(input.amountBase / chunkCount);
  let remainder = input.amountBase - baseChunk * chunkCount;
  const amounts = input.chunkCounts.map((count) => count * baseChunk);

  const extraOrder = input.chunkCounts
    .map((count, index) => ({ count, index }))
    .filter((entry) => entry.count > 0)
    .sort((left, right) => {
      if (right.count !== left.count) return right.count - left.count;
      return left.index - right.index;
    });

  for (const entry of extraOrder) {
    if (remainder <= 0) break;
    const extra = Math.min(entry.count, remainder);
    amounts[entry.index] += extra;
    remainder -= extra;
  }

  return amounts;
}

function distributeIntegerByWeights(total: number, weights: number[]): number[] {
  const totalWeight = weights.reduce((sum, weight) => sum + weight, 0);
  if (total <= 0 || totalWeight <= 0) {
    return weights.map(() => 0);
  }

  const totalBigInt = BigInt(total);
  const totalWeightBigInt = BigInt(totalWeight);
  let assigned = 0;
  return weights.map((weight, index) => {
    if (index === weights.length - 1) return total - assigned;
    const share = Number((totalBigInt * BigInt(weight)) / totalWeightBigInt);
    assigned += share;
    return share;
  });
}

function splitAllocationByMaximumChunk(input: {
  allocation: RebalanceSplitRouteAllocation;
  totalAmountBase: number;
  maxChunkSizeBase: number;
}): RebalanceSplitRouteAllocation[] {
  const chunkCount = Math.max(
    1,
    Math.ceil(input.allocation.amountInBase / input.maxChunkSizeBase),
  );
  if (chunkCount === 1) return [input.allocation];

  const amounts = splitAmountIntoChunks(
    input.allocation.amountInBase,
    chunkCount,
  );
  const estimatedOutputs = distributeIntegerByWeights(
    input.allocation.estimatedOutBase,
    amounts,
  );
  const minimumOutputs = distributeIntegerByWeights(
    input.allocation.minOutBase,
    amounts,
  );
  const routeScores = distributeIntegerByWeights(
    input.allocation.routeScoreBase,
    amounts,
  );

  return amounts.map((amountInBase, index) => ({
    ...input.allocation,
    routeId: `${input.allocation.routeId}:chunk:${index + 1}/${amounts.length}`,
    amountInBase,
    amountShareBps: calculateBps(amountInBase, input.totalAmountBase),
    estimatedOutBase: estimatedOutputs[index] ?? 0,
    minOutBase: minimumOutputs[index] ?? 0,
    routeScoreBase: routeScores[index] ?? 0,
    note: `${input.allocation.note} Policy chunk ${index + 1} of ${amounts.length}.`,
  }));
}

async function quoteSplitCandidateAtAmount(
  candidate: RebalanceRouteCandidate & {
    protocol: Exclude<ManualRebalanceProtocol, "BALANCED">;
  },
  amountBase: number,
  input: ResolveRebalanceRouteInput,
  readers: RebalanceRouteReaders,
): Promise<number> {
  if (amountBase <= 0) return 0;
  if (candidate.protocol === "SOROSWAP") {
    return readSoroswapPathQuote(
      readers,
      amountBase,
      candidate.pathAssets.length >= 2
        ? candidate.pathAssets
        : [input.tokenIn, input.tokenOut],
      input.readerPubKey,
    ).catch(() => 0);
  }
  if(candidate.protocol === 'SUSHI'){
    if(!input.sushiAdapterId||!readers.readSushiEstimateOut||input.sushiPoolId===undefined)return 0;
    return readers.readSushiEstimateOut(input.sushiAdapterId,input.sushiPoolId,input.tokenIn,input.tokenOut,amountBase,input.readerPubKey).catch(()=>0);
  }
  if (candidate.protocol === "PHOENIX") {
    const pool = input.configuredPhoenixPool?.trim() ?? "";
    if (!pool || !readers.readPhoenixEstimateOut) return 0;
    return readers
      .readPhoenixEstimateOut(pool, input.tokenIn, amountBase, input.readerPubKey)
      .catch(() => 0);
  }
  const poolIndexHex = candidate.poolIndexHex;
  if (!poolIndexHex) return 0;
  return readers
    .readAquariusEstimateOut(
      input.aquariusRouterId,
      input.tokenIn,
      input.tokenOut,
      poolIndexHex,
      amountBase,
      input.readerPubKey,
    )
    .catch(() => 0);
}

type SplitDistributionQuote = {
  candidate: RebalanceRouteCandidate & {
    protocol: Exclude<ManualRebalanceProtocol, "BALANCED">;
  };
  amountInBase: number;
  estimatedOutBase: number;
  minOutBase: number;
  routeScoreBase: number;
};

async function evaluateSplitDistribution(input: {
  chunkCounts: number[];
  amountBase: number;
  chunkCount: number;
  candidates: Array<
    RebalanceRouteCandidate & {
      protocol: Exclude<ManualRebalanceProtocol, "BALANCED">;
    }
  >;
  resolveInput: ResolveRebalanceRouteInput;
  readers: RebalanceRouteReaders;
}): Promise<{
  totalEstimatedOutBase: number;
  totalScoreBase: number;
  allocationCount: number;
  quotedAllocations: SplitDistributionQuote[];
} | null> {
  const amounts = resolveChunkCountAmounts({
    amountBase: input.amountBase,
    chunkCount: input.chunkCount,
    chunkCounts: input.chunkCounts,
  });
  const quotedAllocations: SplitDistributionQuote[] = [];

  for (const [index, amountInBase] of amounts.entries()) {
    if (amountInBase <= 0) continue;
    const candidate = input.candidates[index];
    const estimatedOutBase = await quoteSplitCandidateAtAmount(
      candidate,
      amountInBase,
      input.resolveInput,
      input.readers,
    );
    if (estimatedOutBase <= 0) return null;
    const minOutBase = quotedMinOut(
      estimatedOutBase,
      input.resolveInput.slippagePct,
    );
    const routeScore = scoreRoute({
      protocol: candidate.protocol,
      quoteModel: candidate.quoteModel,
      estimatedOutBase,
      minOutBase,
      hops: candidate.hops,
      policy: resolvePolicy(candidate.protocol, input.resolveInput.protocolPolicies),
    });
    quotedAllocations.push({
      candidate,
      amountInBase,
      estimatedOutBase,
      minOutBase,
      routeScoreBase: routeScore.scoreBase,
    });
  }

  if (quotedAllocations.length === 0) return null;

  return {
    totalEstimatedOutBase: quotedAllocations.reduce(
      (total, allocation) => total + allocation.estimatedOutBase,
      0,
    ),
    totalScoreBase: quotedAllocations.reduce(
      (total, allocation) => total + allocation.routeScoreBase,
      0,
    ),
    allocationCount: quotedAllocations.length,
    quotedAllocations,
  };
}

async function buildSplitRouteOptimization(
  input: ResolveRebalanceRouteInput,
  candidates: RebalanceRouteCandidate[],
  readers: RebalanceRouteReaders,
): Promise<RebalanceSplitRoutePlan> {
  if (input.requestedProtocol !== "AUTO") {
    return createIdleSplitRoutePlan(
      "Split-route optimization only applies to AUTO best-execution planning.",
    );
  }
  if (input.manualMinOutBase > 0) {
    return {
      ...createIdleSplitRoutePlan(
        "Split-route optimization is disabled when a manual total min-out override is active.",
      ),
      status: "not_applicable",
      strategy: "manual_override_disabled",
      totalAmountInBase: input.amountBase,
    };
  }

  const searchConfig = resolveRouteSearchConfig(
    input.routingSearch,
    Boolean(resolvePolicy("SOROSWAP", input.protocolPolicies).directOnly),
  );
  const eligibleCandidates = rankDisplayCandidates(candidates)
    .filter(isSplitExecutableCandidate)
    .slice(0, MAX_SPLIT_ROUTE_CANDIDATES);
  const singleBest = selectBestCandidate(eligibleCandidates, true);
  const singleRouteEstimatedOutBase = singleBest?.estimatedOutBase ?? 0;
  if (eligibleCandidates.length === 0 || !singleBest) {
    return {
      ...createIdleSplitRoutePlan(
        "Split-route optimization needs at least one live AUTO-eligible AMM route.",
      ),
      status: "not_applicable",
      strategy: "insufficient_live_routes",
      routeCountCompared: eligibleCandidates.length,
      totalAmountInBase: input.amountBase,
      singleRouteEstimatedOutBase,
    };
  }

  const chunks = splitAmountIntoChunks(input.amountBase, searchConfig.splitParts);
  const distributions = generateSplitChunkCountDistributions({
    routeCount: eligibleCandidates.length,
    chunkCount: chunks.length,
  });
  const evaluatedDistributions = (
    await mapWithConcurrency(
      distributions,
      MAX_CONCURRENT_ROUTE_QUOTES,
      (chunkCounts) =>
        evaluateSplitDistribution({
          chunkCounts,
          amountBase: input.amountBase,
          chunkCount: chunks.length,
          candidates: eligibleCandidates,
          resolveInput: input,
          readers,
        }),
    )
  ).filter(
    (distribution): distribution is NonNullable<typeof distribution> =>
      distribution !== null,
  );

  if (evaluatedDistributions.length === 0) {
    return {
      ...createIdleSplitRoutePlan(
        "Split-route optimization could not read global distribution quotes for the live route set.",
      ),
      status: "not_applicable",
      strategy: "insufficient_live_routes",
      routeCountCompared: eligibleCandidates.length,
      chunkCount: chunks.length,
      totalAmountInBase: input.amountBase,
      singleRouteEstimatedOutBase,
    };
  }

  const bestDistribution = evaluatedDistributions.reduce((best, candidate) => {
    if (candidate.totalScoreBase !== best.totalScoreBase) {
      return candidate.totalScoreBase > best.totalScoreBase ? candidate : best;
    }
    if (candidate.totalEstimatedOutBase !== best.totalEstimatedOutBase) {
      return candidate.totalEstimatedOutBase > best.totalEstimatedOutBase
        ? candidate
        : best;
    }
    if (candidate.allocationCount !== best.allocationCount) {
      return candidate.allocationCount < best.allocationCount
        ? candidate
        : best;
    }
    return candidate;
  });

  const totalEstimatedOutBase = bestDistribution.totalEstimatedOutBase;
  const optimizedAllocations = bestDistribution.quotedAllocations.map(
    (allocation) =>
      ({
        routeId: allocation.candidate.routeId,
        protocol: allocation.candidate.protocol,
        title: allocation.candidate.title,
        amountInBase: allocation.amountInBase,
        amountShareBps: calculateBps(allocation.amountInBase, input.amountBase),
        estimatedOutBase: allocation.estimatedOutBase,
        minOutBase: allocation.minOutBase,
        pathAssets: allocation.candidate.pathAssets,
        pathLabel: allocation.candidate.pathLabel,
        hops: allocation.candidate.hops,
        poolIndexHex: allocation.candidate.poolIndexHex,
        adapterId: allocation.candidate.adapterId,
        poolId: allocation.candidate.poolId,
        routeScoreBase: allocation.routeScoreBase,
        routeScoreLabel: scoreRoute({
          protocol: allocation.candidate.protocol,
          quoteModel: allocation.candidate.quoteModel,
          estimatedOutBase: allocation.estimatedOutBase,
          minOutBase: allocation.minOutBase,
          hops: allocation.candidate.hops,
          policy: resolvePolicy(allocation.candidate.protocol, input.protocolPolicies),
        }).scoreLabel,
        note: allocation.candidate.note,
      }) satisfies RebalanceSplitRouteAllocation,
  );
  const guardrailPolicy = resolveRebalanceGuardrailPolicy(input.guardrailPolicy);
  const policyRequiresChunking =
    guardrailPolicy.chunkingThresholdBase > 0 &&
    input.amountBase > guardrailPolicy.chunkingThresholdBase;
  const allocations = policyRequiresChunking
    ? optimizedAllocations.flatMap((allocation) =>
        splitAllocationByMaximumChunk({
          allocation,
          totalAmountBase: input.amountBase,
          maxChunkSizeBase: guardrailPolicy.maxChunkSizeBase,
        }),
      )
    : optimizedAllocations;
  const totalMinOutBase = allocations.reduce(
    (total, allocation) => total + allocation.minOutBase,
    0,
  );
  const estimatedImprovementBase = totalEstimatedOutBase - singleRouteEstimatedOutBase;
  const estimatedImprovementBps = calculateBps(
    Math.max(0, estimatedImprovementBase),
    singleRouteEstimatedOutBase,
  );
  const economicallyRecommended =
    optimizedAllocations.length > 1 &&
    estimatedImprovementBase > 0 &&
    totalEstimatedOutBase > singleRouteEstimatedOutBase;
  const executable = economicallyRecommended || policyRequiresChunking;

  return {
    status: executable ? "recommended" : "single_route_optimal",
    strategy: "chunked_global_best_execution",
    executable,
    allocationCount: allocations.length,
    chunkCount: Math.max(chunks.length, allocations.length),
    routeCountCompared: eligibleCandidates.length,
    totalAmountInBase: input.amountBase,
    totalEstimatedOutBase,
    totalMinOutBase,
    singleRouteEstimatedOutBase,
    estimatedImprovementBase,
    estimatedImprovementBps,
    allocations,
    note: economicallyRecommended
      ? `Split-route optimizer globally evaluated ${evaluatedDistributions.length.toLocaleString()} executable chunk distributions and recommends ${allocations.length.toLocaleString()} allocations across ${eligibleCandidates.length.toLocaleString()} live AMM routes, improving estimated output by ${estimatedImprovementBase.toLocaleString()} (${(estimatedImprovementBps / 100).toFixed(2)}%).`
      : policyRequiresChunking
        ? `The best route remains unchanged and is divided into ${allocations.length.toLocaleString()} policy-bounded execution chunks.`
      : `Single-route execution remains optimal after globally evaluating ${evaluatedDistributions.length.toLocaleString()} executable chunk distributions.`,
  };
}

function buildPlanSearchTelemetry(input: {
  soroswap: RebalanceRouteSearchTelemetry;
  candidates: RebalanceRouteCandidate[];
  returnedCandidateCount: number;
}): RebalanceRouteSearchTelemetry {
  const venuesCompared = Array.from(
    new Set(
      input.candidates
        .filter((candidate) => candidate.admitted || candidate.available)
        .map((candidate) => candidate.protocol),
    ),
  );
  return {
    ...input.soroswap,
    returnedCandidateCount: input.returnedCandidateCount,
    venuesCompared,
    note:
      input.soroswap.strategy === "broker_grade_bounded_global_search"
        ? `${input.soroswap.note} Compared ${venuesCompared.length} available routes and returned ${input.returnedCandidateCount.toLocaleString()} candidates.`
        : input.soroswap.note,
  };
}

function rankDisplayCandidates(
  candidates: RebalanceRouteCandidate[],
): RebalanceRouteCandidate[] {
  return [...candidates].sort((left, right) => {
    if (right.available !== left.available) return right.available ? 1 : -1;
    if (right.routeScoreBase !== left.routeScoreBase) {
      return right.routeScoreBase - left.routeScoreBase;
    }
    if (right.estimatedOutBase !== left.estimatedOutBase) {
      return right.estimatedOutBase - left.estimatedOutBase;
    }
    if (left.hops !== right.hops) return left.hops - right.hops;
    return left.routeId.localeCompare(right.routeId);
  });
}

function shortlistRouteCandidates(
  candidates: RebalanceRouteCandidate[],
  selected: RebalanceRouteCandidate | null,
): RebalanceRouteCandidate[] {
  if (candidates.length <= MAX_RETURNED_ROUTE_CANDIDATES) return candidates;

  const byId = new Map<string, RebalanceRouteCandidate>();
  const include = (candidate: RebalanceRouteCandidate | null | undefined) => {
    if (candidate) byId.set(candidate.routeId, candidate);
  };

  include(selected);
  include(selectBestCandidate(candidates.filter((candidate) => candidate.protocol === "SOROSWAP")));
  include(selectBestCandidate(candidates.filter((candidate) => candidate.protocol === "AQUARIUS")));
  include(selectBestCandidate(candidates.filter((candidate) => candidate.protocol === "PHOENIX")));
  include(candidates.find((candidate) => candidate.protocol === "BALANCED"));

  for (const candidate of rankDisplayCandidates(candidates)) {
    if (byId.size >= MAX_RETURNED_ROUTE_CANDIDATES) break;
    include(candidate);
  }

  return Array.from(byId.values());
}

function createIdleSearchTelemetry(): RebalanceRouteSearchTelemetry {
  return {
    strategy: "idle",
    candidateUniverseSize: 0,
    generatedPathCount: 0,
    quotedPathCount: 0,
    liveQuoteCount: 0,
    prunedPathCount: 0,
    returnedCandidateCount: 4,
    quoteCoverageBps: 0,
    quoteCoveragePpm: 0,
    budgetUtilizationBps: 0,
    generatedHopCounts: [],
    quotedHopCounts: [],
    deepestGeneratedHops: 0,
    deepestQuotedHops: 0,
    benchmarkScale: "idle",
    samplingModel: "idle",
    maxIntermediaries: 0,
    maxHops: 0,
    quoteBudget: 0,
    splitParts: 0,
    beamWidth: 0,
    tailProbeCount: 0,
    deterministicProbeCount: 0,
    venuesCompared: [],
    note: "Routing search is idle until a valid amount and asset pair are provided.",
  };
}

function createIdleSplitRoutePlan(note = "Split-route optimization is idle until live AUTO routes are available."): RebalanceSplitRoutePlan {
  return {
    status: "idle",
    strategy: "idle",
    executable: false,
    allocationCount: 0,
    chunkCount: 0,
    routeCountCompared: 0,
    totalAmountInBase: 0,
    totalEstimatedOutBase: 0,
    totalMinOutBase: 0,
    singleRouteEstimatedOutBase: 0,
    estimatedImprovementBase: 0,
    estimatedImprovementBps: 0,
    allocations: [],
    note,
  };
}

function normalizeGuardrailInteger(value: number | undefined, fallback: number): number {
  if (!Number.isSafeInteger(value)) return fallback;
  return Math.max(0, Math.trunc(value ?? fallback));
}

export function resolveRebalanceGuardrailPolicy(
  overrides: Partial<RebalanceGuardrailPolicy> = {},
): RebalanceGuardrailPolicy {
  return {
    maxNotionalPerSwapBase: normalizeGuardrailInteger(
      overrides.maxNotionalPerSwapBase,
      REBALANCE_MAX_NOTIONAL_PER_SWAP_BASE,
    ),
    maxPathLength: Math.max(
      1,
      normalizeGuardrailInteger(
        overrides.maxPathLength,
        REBALANCE_MAX_PATH_LENGTH,
      ),
    ),
    forbidRouteCycles:
      overrides.forbidRouteCycles ?? REBALANCE_FORBID_ROUTE_CYCLES,
    chunkingThresholdBase: normalizeGuardrailInteger(
      overrides.chunkingThresholdBase,
      REBALANCE_CHUNKING_THRESHOLD_BASE,
    ),
    maxChunkSizeBase: Math.max(
      1,
      normalizeGuardrailInteger(
        overrides.maxChunkSizeBase,
        REBALANCE_MAX_CHUNK_SIZE_BASE,
      ),
    ),
    postTradeDeviationBps: normalizeGuardrailInteger(
      overrides.postTradeDeviationBps,
      REBALANCE_POST_TRADE_DEVIATION_BPS,
    ),
    dailyTurnoverCapBps: normalizeGuardrailInteger(
      overrides.dailyTurnoverCapBps,
      REBALANCE_DAILY_TURNOVER_CAP_BPS,
    ),
    emergencyPauseSwap:
      overrides.emergencyPauseSwap ?? REBALANCE_EMERGENCY_PAUSE_SWAP,
  };
}

function formatBaseAmount(value: number): string {
  return `${Math.max(0, Math.trunc(value)).toLocaleString()} notional`;
}

function makeGuardrailCheck(input: {
  id: RebalanceGuardrailId;
  label: string;
  status: RebalanceGuardrailStatus;
  value: string;
  limit: string;
  detail: string;
  evidence?: RebalanceGuardrailEvidence;
}): RebalanceGuardrailCheck {
  return input;
}

function hasRouteCycle(pathAssets: string[]): boolean {
  const normalized = pathAssets.filter(Boolean);
  return new Set(normalized).size !== normalized.length;
}

function selectedRouteSet(input: {
  selectedCandidate: RebalanceRouteCandidate | null;
  splitRoute?: RebalanceSplitRoutePlan;
  amountBase: number;
}): Array<{
  routeId: string;
  amountInBase: number;
  hops: number;
  pathAssets: string[];
  pathLabel: string;
}> {
  const splitAllocations =
    input.splitRoute?.executable && input.splitRoute.allocations.length > 0
      ? input.splitRoute.allocations.map((allocation) => ({
          routeId: allocation.routeId,
          amountInBase: allocation.amountInBase,
          hops: allocation.hops,
          pathAssets: allocation.pathAssets,
          pathLabel: allocation.pathLabel,
        }))
      : [];
  if (splitAllocations.length > 0) return splitAllocations;
  if (!input.selectedCandidate) return [];
  return [
    {
      routeId: input.selectedCandidate.routeId,
      amountInBase: input.selectedCandidate.available ? input.amountBase : 0,
      hops: input.selectedCandidate.hops,
      pathAssets: input.selectedCandidate.pathAssets,
      pathLabel: input.selectedCandidate.pathLabel,
    },
  ];
}

type RebalancePostTradeProjection = {
  value?: number;
  evidence: RebalanceGuardrailEvidence;
};

function resolveProjectedPostTradeDeviation(
  input: ResolveRebalanceRouteInput,
): RebalancePostTradeProjection {
  const explicitProjection =
    input.guardrailState?.projectedPostTradeDeviationBps;
  if (Number.isFinite(explicitProjection)) {
    return {
      value: Math.max(0, Math.trunc(explicitProjection ?? 0)),
      evidence: {
        source: "explicit_projection",
        amountBase: input.amountBase,
        vaultNavBase: input.guardrailState?.vaultNavBase,
      },
    };
  }

  return {
    evidence: {
      source: "missing_state",
      amountBase: input.amountBase,
      vaultNavBase: input.guardrailState?.vaultNavBase,
    },
  };
}

function evaluateRebalanceGuardrails(
  input: ResolveRebalanceRouteInput,
  plan: RebalanceRoutePlan,
): RebalanceGuardrailEvaluation {
  const policy = resolveRebalanceGuardrailPolicy(input.guardrailPolicy);
  const routes = selectedRouteSet({
    selectedCandidate: plan.selectedCandidate,
    splitRoute: plan.splitRoute,
    amountBase: input.amountBase,
  });
  const selectedPathLabel =
    routes.map((route) => route.pathLabel).filter(Boolean).join(" | ") ||
    "No executable path selected";
  const checks: RebalanceGuardrailCheck[] = [];

  checks.push(
    makeGuardrailCheck({
      id: "emergency_pause_swap",
      label: "Emergency pause",
      status: policy.emergencyPauseSwap ? "blocked" : "passed",
      value: policy.emergencyPauseSwap ? "paused" : "open",
      limit: "must be open",
      detail: policy.emergencyPauseSwap
        ? "DAO emergency pause is active; swap execution is blocked before route handoff."
        : "DAO emergency pause is inactive for swap execution.",
    }),
  );

  checks.push(
    makeGuardrailCheck({
      id: "max_notional_per_swap",
      label: "Max notional per swap",
      status:
        policy.maxNotionalPerSwapBase > 0 &&
        input.amountBase > policy.maxNotionalPerSwapBase
          ? "blocked"
          : "passed",
      value: formatBaseAmount(input.amountBase),
      limit:
        policy.maxNotionalPerSwapBase > 0
          ? formatBaseAmount(policy.maxNotionalPerSwapBase)
          : "unbounded",
      detail:
        policy.maxNotionalPerSwapBase > 0
          ? "Requested input amount must fit the DAO-governed notional ceiling."
          : "Notional ceiling is disabled by policy.",
    }),
  );

  const deepestSelectedPath = routes.reduce(
    (deepest, route) => Math.max(deepest, route.hops),
    0,
  );
  checks.push(
    makeGuardrailCheck({
      id: "max_path_length",
      label: "Max path length",
      status:
        routes.length > 0 && deepestSelectedPath > policy.maxPathLength
          ? "blocked"
          : "passed",
      value: `${deepestSelectedPath} hops`,
      limit: `${policy.maxPathLength} hops`,
      detail:
        routes.length > 0
          ? `Selected execution path: ${selectedPathLabel}.`
          : "No executable route has been selected yet.",
    }),
  );

  const cyclicRoutes = routes.filter((route) => hasRouteCycle(route.pathAssets));
  checks.push(
    makeGuardrailCheck({
      id: "forbid_route_cycles",
      label: "Route cycles",
      status:
        policy.forbidRouteCycles && cyclicRoutes.length > 0
          ? "blocked"
          : "passed",
      value:
        cyclicRoutes.length > 0
          ? cyclicRoutes.map((route) => route.routeId).join(", ")
          : "none",
      limit: policy.forbidRouteCycles ? "no repeated assets" : "cycles allowed",
      detail: policy.forbidRouteCycles
        ? "Every executable path must be acyclic before wallet execution."
        : "Policy allows repeated assets in a route path.",
    }),
  );

  const chunkingRequired =
    policy.chunkingThresholdBase > 0 &&
    input.amountBase > policy.chunkingThresholdBase;
  const hasExecutableChunks =
    Boolean(plan.splitRoute?.executable) &&
    (plan.splitRoute?.allocations.length ?? 0) > 0;
  checks.push(
    makeGuardrailCheck({
      id: "chunking_threshold",
      label: "Chunking threshold",
      status:
        chunkingRequired && !hasExecutableChunks ? "blocked" : "passed",
      value: formatBaseAmount(input.amountBase),
      limit: formatBaseAmount(policy.chunkingThresholdBase),
      detail: chunkingRequired
        ? "Large swaps must use the executable split-route optimizer before handoff."
        : "Input amount is below the configured split-route threshold.",
    }),
  );

  const largestChunk = routes.reduce(
    (largest, route) => Math.max(largest, route.amountInBase),
    chunkingRequired && routes.length === 0 ? input.amountBase : 0,
  );
  checks.push(
    makeGuardrailCheck({
      id: "max_chunk_size",
      label: "Max chunk size",
      status:
        chunkingRequired && largestChunk > policy.maxChunkSizeBase
          ? "blocked"
          : "passed",
      value: formatBaseAmount(largestChunk),
      limit: formatBaseAmount(policy.maxChunkSizeBase),
      detail: chunkingRequired
        ? "Every split allocation must stay within the DAO-governed chunk ceiling."
        : "Chunk-size guardrail is not applicable below the threshold.",
    }),
  );

  const hasExplicitProjectedDeviation = Number.isFinite(
    input.guardrailState?.projectedPostTradeDeviationBps,
  );
  const projectedDeviation = resolveProjectedPostTradeDeviation(input);
  checks.push(
    makeGuardrailCheck({
      id: "post_trade_deviation_bps",
      label: "Post-trade deviation",
      status:
        projectedDeviation.value === undefined
          ? "requires_state"
          : projectedDeviation.value > policy.postTradeDeviationBps
            ? "blocked"
            : "passed",
      value:
        projectedDeviation.value === undefined
          ? "state required"
          : formatBpsPercent(projectedDeviation.value),
      limit: formatBpsPercent(policy.postTradeDeviationBps),
      detail:
        projectedDeviation.value === undefined
          ? "Execution surface must provide a projected allocation shift calculated on a common valuation basis for the final pre-sign check."
          : hasExplicitProjectedDeviation
            ? "Projected allocation shift was evaluated against the active policy."
            : "Projected allocation shift is unavailable.",
      evidence: projectedDeviation.evidence,
    }),
  );

  const vaultNavBase = input.guardrailState?.vaultNavBase;
  const dailyTurnoverUsedBase = input.guardrailState?.dailyTurnoverUsedBase;
  const hasDailyTurnoverState =
    vaultNavBase !== undefined &&
    vaultNavBase > 0 &&
    dailyTurnoverUsedBase !== undefined;
  const turnoverCapBase =
    vaultNavBase && vaultNavBase > 0
      ? Math.floor((vaultNavBase * policy.dailyTurnoverCapBps) / 10_000)
      : 0;
  const projectedTurnoverBase =
    (dailyTurnoverUsedBase ?? 0) + input.amountBase;
  checks.push(
    makeGuardrailCheck({
      id: "daily_turnover_cap_bps",
      label: "Daily turnover cap",
      status:
        !hasDailyTurnoverState
          ? "requires_state"
          : projectedTurnoverBase > turnoverCapBase
            ? "blocked"
            : "passed",
      value:
        !hasDailyTurnoverState
          ? "state required"
          : formatBaseAmount(projectedTurnoverBase),
      limit:
        !hasDailyTurnoverState
          ? `${formatBpsPercent(policy.dailyTurnoverCapBps)} of NAV`
          : formatBaseAmount(turnoverCapBase),
      detail:
        !hasDailyTurnoverState
          ? "Execution surface must provide vault NAV and used daily turnover for the final cap check."
          : "Projected daily turnover was evaluated against the active NAV-derived cap.",
      evidence: {
        source: hasDailyTurnoverState ? "catalog_activity_nav" : "missing_state",
        amountBase: input.amountBase,
        vaultNavBase,
        dailyTurnoverUsedBase,
        projectedTurnoverBase,
        turnoverCapBase,
      },
    }),
  );

  const blockedReasons = checks
    .filter((check) => check.status === "blocked")
    .map((check) => `${check.label}: ${check.detail}`);

  return {
    status: blockedReasons.length > 0 ? "blocked" : "passed",
    blockedReasons,
    policy,
    checks,
  };
}

function applyRebalanceGuardrails(
  plan: RebalanceRoutePlan,
  input: ResolveRebalanceRouteInput,
): RebalanceRoutePlan {
  const evaluatedGuardrails = evaluateRebalanceGuardrails(input, plan);
  const requiredStatefulGuardrailIds = new Set(
    input.requiredStatefulGuardrails ?? [],
  );
  const missingRequiredStateReasons = evaluatedGuardrails.checks
    .filter(
      (check) =>
        check.status === "requires_state" &&
        requiredStatefulGuardrailIds.has(check.id),
    )
    .map((check) => `${check.label}: ${check.detail}`);
  const guardrails: RebalanceGuardrailEvaluation =
    missingRequiredStateReasons.length > 0
      ? {
          ...evaluatedGuardrails,
          status: "blocked",
          blockedReasons: [
            ...evaluatedGuardrails.blockedReasons,
            ...missingRequiredStateReasons,
          ],
        }
      : evaluatedGuardrails;

  if (guardrails.status === "passed") {
    return {
      ...plan,
      guardrails,
    };
  }

  return {
    ...plan,
    selectedCandidate: null,
    estimatedOutBase: 0,
    minOutBase: 0,
    note: `Rebalance blocked by phase-2 swap guardrails: ${guardrails.blockedReasons.join(" ")} ${plan.note}`,
    guardrails,
  };
}

export function createIdleRebalanceRoutePlan(
  requestedProtocol: RebalanceProtocol,
): RebalanceRoutePlan {
  const fallback = createFallbackCandidate(
    requestedProtocol === "AUTO" ? "SOROSWAP" : requestedProtocol,
    1,
    0,
    "Idle",
  );
  return {
    requestedProtocol,
    selectedProtocol: requestedProtocol === "AUTO" ? "SOROSWAP" : requestedProtocol,
    selectedCandidate: null,
    estimatedOutBase: 0,
    minOutBase: 0,
    note: "Enter a valid amount to resolve route quotes.",
    routeSearch: createIdleSearchTelemetry(),
    splitRoute: createIdleSplitRoutePlan(),
    candidates: [
      { ...fallback, routeId: "SOROSWAP_IDLE", protocol: "SOROSWAP", title: "SoroSwap direct" },
      {
        ...fallback,
        routeId: "AQUARIUS_IDLE",
        protocol: "AQUARIUS",
        title: "Aquarius direct",
        executionKind: "aquarius_single_pool",
      },
      {
        ...fallback,
        routeId: "SUSHI_IDLE",
        protocol: "SUSHI",
        title: "Sushi direct",
        settlementModel: "onchain_adapter",
        pathModel: "adapter_gated",
        executionKind: "sushi_pool",
      },
      {
        ...fallback,
        routeId: "BALANCED_IDLE",
        protocol: "BALANCED",
        venueFamily: "intent_execution",
        quoteModel: "intent_surface_unverified",
        settlementModel: "intent_settlement",
        pathModel: "adapter_gated",
        confirmationModel: "transaction_hash_plus_refresh",
        title: "Balanced direct",
        executionKind: "balanced_adapter",
      },
    ],
  };
}

export async function resolveRebalanceRoutePlan(
  input: ResolveRebalanceRouteInput,
  readers: RebalanceRouteReaders,
): Promise<RebalanceRoutePlan> {
  if(input.requireVenueState){
    const policies={...input.protocolPolicies};
    let sushiPoolId=input.sushiPoolId;
    for(const [protocol,venue]of [['SOROSWAP',input.soroswapAdapterId],['AQUARIUS',input.aquariusAdapterId],['SUSHI',input.sushiAdapterId]] as const){
      let snapshot:VenueSnapshot|null=null;
      if(input.fundId&&venue&&readers.readVenueSnapshot)try{snapshot=await readers.readVenueSnapshot(input.fundId,venue,input.readerPubKey);}catch{}
      let allowed=protocolVenueAllowed(protocol,snapshot,input.requestedProtocol==='AUTO'?'auto_swap':'manual_swap',NETWORK_PASSPHRASE);
      if(protocol==='SUSHI'&&allowed){try{if(!readers.readSushiFundBinding||!input.fundId||!venue)throw Error('Missing Sushi fund binding');sushiPoolId=await readers.readSushiFundBinding(input.fundId,venue,input.tokenIn,input.tokenOut,input.readerPubKey);}catch{allowed=false;}}
      policies[protocol]={...policies[protocol],autoExecutionEnabled:snapshot?.status===2};
      if(!allowed)policies[protocol]={...policies[protocol],planningEnabled:false,executionEnabled:false,disabledReason:'Protocol permissions are unavailable or do not allow this route.'};
    }
    return resolveRebalanceRoutePlan({...input,sushiPoolId,requireVenueState:false,protocolPolicies:policies},readers);
  }
  if (input.amountBase <= 0 || !input.tokenIn || !input.tokenOut || input.tokenIn === input.tokenOut) {
    return createIdleRebalanceRoutePlan(input.requestedProtocol);
  }

  const [soroswapSearch, aquariusCandidate, phoenixCandidate, sushiCandidate] = await Promise.all([
    buildSoroswapCandidates(input, readers),
    buildAquariusCandidate(input, readers),
    buildPhoenixCandidate(input, readers),
    buildSushiCandidate(input, readers),
  ]);
  const balancedCandidate = buildBalancedCandidate(input);
  const soroswapCandidates = soroswapSearch.candidates;

  const allCandidates = [
    ...soroswapCandidates,
    aquariusCandidate,
    phoenixCandidate,
    sushiCandidate,
    balancedCandidate,
  ];
  const splitRoute = await buildSplitRouteOptimization(
    input,
    allCandidates,
    readers,
  );
  const bestByProtocol: Record<ManualRebalanceProtocol, RebalanceRouteCandidate | null> = {
    SOROSWAP: selectBestCandidate(soroswapCandidates),
    AQUARIUS: aquariusCandidate,
    PHOENIX: phoenixCandidate,
    SUSHI: sushiCandidate,
    BALANCED: balancedCandidate,
  };

  if (input.requestedProtocol !== "AUTO") {
    const selected =
      bestByProtocol[input.requestedProtocol] ??
      createFallbackCandidate(
        input.requestedProtocol,
        input.amountBase,
        input.slippagePct,
        `${formatRebalanceProtocolLabel(input.requestedProtocol)} selected without a live quote.`,
      );
    const candidates = shortlistRouteCandidates(allCandidates, selected);
    const routeSearch = buildPlanSearchTelemetry({
      soroswap: soroswapSearch.telemetry,
      candidates: allCandidates,
      returnedCandidateCount: candidates.length,
    });
    return applyRebalanceGuardrails({
      requestedProtocol: input.requestedProtocol,
      selectedProtocol: input.requestedProtocol,
      selectedCandidate: selected.available ? selected : null,
      estimatedOutBase: selected.estimatedOutBase,
      minOutBase: selected.minOutBase,
      note: `${formatRebalanceProtocolLabel(input.requestedProtocol)} selected. ${buildRouteSummary(selected)} ${selected.note}`,
      candidates,
      routeSearch,
      splitRoute,
    }, input);
  }

  const selected = selectBestCandidate(allCandidates, true);
  if (!selected) {
    const fallback = createFallbackCandidate(
      "SOROSWAP",
      input.amountBase,
      input.slippagePct,
      "Best execution could not read live quotes.",
    );
    const candidates = shortlistRouteCandidates(allCandidates, null);
    const routeSearch = buildPlanSearchTelemetry({
      soroswap: soroswapSearch.telemetry,
      candidates: allCandidates,
      returnedCandidateCount: candidates.length,
    });
    return applyRebalanceGuardrails({
      requestedProtocol: "AUTO",
      selectedProtocol: "SOROSWAP",
      selectedCandidate: null,
      estimatedOutBase: fallback.estimatedOutBase,
      minOutBase: fallback.minOutBase,
      note: "Best execution could not read live quotes.",
      candidates,
      routeSearch,
      splitRoute,
    }, input);
  }

  const availableCandidates = allCandidates.filter((candidate) => candidate.available && candidate.estimatedOutBase > 0);
  const comparedText =
    availableCandidates.length > 1 ? `from ${availableCandidates.length} live routes` : "from the only live route";
  const candidates = shortlistRouteCandidates(allCandidates, selected);
  const routeSearch = buildPlanSearchTelemetry({
    soroswap: soroswapSearch.telemetry,
    candidates: allCandidates,
    returnedCandidateCount: candidates.length,
  });
  return applyRebalanceGuardrails({
    requestedProtocol: "AUTO",
    selectedProtocol: selected.protocol,
    selectedCandidate: selected,
    estimatedOutBase: selected.estimatedOutBase,
    minOutBase: selected.minOutBase,
    note: `Auto-selected ${selected.title} ${comparedText}. ${buildRouteSummary(selected)} ${routeSearch.note}`,
    candidates,
    routeSearch,
    splitRoute,
  }, input);
}
