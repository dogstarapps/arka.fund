import type { LeaderboardDataSourceSnapshot } from "@/lib/catalog/types";
import {
  deriveOracleCutoverGate,
  type OracleCutoverGateSnapshot,
} from "@/lib/runtime/oracleCutoverGate";
import type {
  BalancedAutoSurfaceGateSnapshot,
} from "@/lib/runtime/balancedAutoSurfaceGate";

export type ProtocolSupportStatus = "ready" | "blocked" | "inactive";

export interface BalancedValidatedModulePayload {
  present: boolean;
  validatedAt: string | null;
  router: string | null;
  poolId: number;
  sourceValidations: string[];
  source: "deployments" | "fallback";
}

export interface BalancedOfficialSurfacePayload {
  validatedAt: string | null;
  officialSources: {
    app: string | null;
    bundle: string | null;
    stellarPage: string | null;
    swapDocs?: string | null;
    tradeBlog: string | null;
    q3Blog: string | null;
  };
  topology: "intent_based" | "unknown";
  swapModel: "sodax_intents" | "unknown";
  liquidityModel: "legacy_exchange_only" | "unknown";
  publicRouterContractId: string | null;
  supportsPublicStellarTestnet: boolean;
  canonicalRouterCutoverPossible: boolean;
  intentAdapter: {
    quoteProvider: "sodax" | "unknown";
    quoteVisibleInApp: boolean;
    quoteComparableForArka: boolean;
    publicQuoteEndpoint: string | null;
    publicBuildEndpoint: string | null;
    publicRelayEndpoint: string | null;
    publicSubmitEndpoint: string | null;
    statusSurface: "recent_activity" | "unknown";
    publicStatusEndpoint: string | null;
    publicReceiptEndpoint: string | null;
    publicExpiryEndpoint: string | null;
    publicRefundEndpoint: string | null;
    cancellationWindowSeconds: number | null;
  };
  stellarMainnetAddresses: {
    connection: string | null;
    assetManager: string | null;
    xTokenManager: string | null;
    rateLimit: string | null;
  };
  findings: string[];
  source: "deployments" | "fallback";
}

export type BalancedIntentCapabilityState =
  | "available"
  | "limited"
  | "unavailable";
export type BalancedIntentDiscoveryModel =
  | "official_runtime_snapshot"
  | "unavailable";
export type BalancedIntentQuoteModel =
  | "public_quote_surface"
  | "public_quote_surface_manual_execution"
  | "manual_only"
  | "official_surface_unverified";
export type BalancedIntentExecutionModel =
  | "adapter_gated_manual"
  | "unavailable";
export type BalancedIntentConfirmationModel =
  | "transaction_hash_plus_refresh";
export type BalancedIntentPlannerAdmission =
  | "auto"
  | "manual_only"
  | "blocked";

export interface BalancedIntentVenuePayload {
  discoveryState: BalancedIntentCapabilityState;
  discoveryModel: BalancedIntentDiscoveryModel;
  quoteState: BalancedIntentCapabilityState;
  quoteModel: BalancedIntentQuoteModel;
  comparableQuote: boolean;
  executeState: BalancedIntentCapabilityState;
  executeModel: BalancedIntentExecutionModel;
  confirmModel: BalancedIntentConfirmationModel;
  autoRoutingEligible: boolean;
  manualExecutionEligible: boolean;
  plannerAdmission: BalancedIntentPlannerAdmission;
  notes: string[];
}

export interface CatalogHealthPayload {
  configured: boolean;
  reachable: boolean;
  healthy: boolean;
  degraded: boolean;
  statusCode: number;
  evaluatedAt: string | null;
  error?: string | null;
  baseUrl?: string;
}

export interface BalancedProtocolHealthPayload {
  validatedAt: string | null;
  adapterBalanced: string;
  poolId: number;
  supportStatus: ProtocolSupportStatus;
  readyForDappExecution: boolean;
  laneMode: string;
  blockingReasons: string[];
  observedRouter: string | null;
  expectedRouter: string | null;
  poolSupported: boolean;
  pairConfigured: boolean;
  validatedModule: BalancedValidatedModulePayload;
  officialSurface: BalancedOfficialSurfacePayload;
  intentVenue: BalancedIntentVenuePayload;
  source: "deployments" | "fallback";
}

export interface RoutingSolverHealthPayload {
  mode: "backend_solver_with_local_fallback";
  planEndpoint: string;
  fallbackMode: "local_workflow_solver";
  backendAvailable: boolean;
  generatedAt: string | null;
  balancedPlannerAdmission: "auto" | "manual_only" | "blocked";
  balancedManualExecutionEligible: boolean;
  balancedComparableQuote: boolean;
  balancedSupportStatus: ProtocolSupportStatus;
  balancedLaneMode: string;
  balancedAutoSurfaceReady: boolean;
  balancedAutoSurfaceReason: string;
  note: string;
}

export interface AppHealthPayload {
  app: string;
  catalog: CatalogHealthPayload;
  protocols: {
    balanced: BalancedProtocolHealthPayload;
  };
  routing: RoutingSolverHealthPayload;
  oracle: LeaderboardDataSourceSnapshot;
  releaseGate?: {
    oracleCutover: OracleCutoverGateSnapshot;
    balancedAutoSurface: BalancedAutoSurfaceGateSnapshot;
  };
}

function buildOracleRuntimeFallbackSnapshot(
  input?: Partial<LeaderboardDataSourceSnapshot>,
): LeaderboardDataSourceSnapshot {
  return {
    metrics: {
      ranking: "catalog_rank",
      nav: "catalog_nav",
      profit: "catalog_profit_or_activity",
      volume: "catalog_volume_or_activity",
      activityFallbackWindowEvents: 60,
      ...(input?.metrics ?? {}),
    },
    oracle: {
      mode: "unverified",
      validatedAt: null,
      network: null,
      rpcUrl: null,
      oracleGuard: null,
      primaryOracle: null,
      secondaryOracle: null,
      primaryProvider: null,
      secondaryProvider: null,
      provider: null,
      validationAsset: null,
      maxOracleAgeSeconds: null,
      maxDivergenceBps: null,
      minProviderCount: null,
      selectedSourceUnderDivergence: null,
      source: "fallback",
      ...(input?.oracle ?? {}),
    },
    deployment: {
      targetNetwork: "testnet",
      deploymentsPath: null,
      pathSource: "network_default",
      fileFound: false,
      networkMismatch: false,
      readError: null,
      ...(input?.deployment ?? {}),
    },
    source: input?.source ?? "fallback",
  };
}

function normalizeOracleRuntimeSnapshot(
  payload: unknown,
): LeaderboardDataSourceSnapshot {
  if (!payload || typeof payload !== "object") {
    return buildOracleRuntimeFallbackSnapshot();
  }
  const source = payload as Partial<LeaderboardDataSourceSnapshot> & {
    metrics?: Record<string, unknown>;
    oracle?: Record<string, unknown>;
    deployment?: Record<string, unknown>;
  };
  return buildOracleRuntimeFallbackSnapshot({
    source: source.source === "deployments" ? "deployments" : "fallback",
    metrics: {
      ranking: "catalog_rank",
      nav: "catalog_nav",
      profit: "catalog_profit_or_activity",
      volume: "catalog_volume_or_activity",
      activityFallbackWindowEvents:
        typeof source.metrics?.activityFallbackWindowEvents === "number"
          ? source.metrics.activityFallbackWindowEvents
          : 60,
    },
    oracle: {
      mode: source.oracle?.mode === "oracle_guard" ? "oracle_guard" : "unverified",
      validatedAt:
        typeof source.oracle?.validatedAt === "string"
          ? source.oracle.validatedAt
          : null,
      network:
        typeof source.oracle?.network === "string" ? source.oracle.network : null,
      rpcUrl:
        typeof source.oracle?.rpcUrl === "string" ? source.oracle.rpcUrl : null,
      oracleGuard:
        typeof source.oracle?.oracleGuard === "string"
          ? source.oracle.oracleGuard
          : null,
      primaryOracle:
        typeof source.oracle?.primaryOracle === "string"
          ? source.oracle.primaryOracle
          : null,
      secondaryOracle:
        typeof source.oracle?.secondaryOracle === "string"
          ? source.oracle.secondaryOracle
          : null,
      primaryProvider:
        typeof source.oracle?.primaryProvider === "string"
          ? source.oracle.primaryProvider
          : null,
      secondaryProvider:
        typeof source.oracle?.secondaryProvider === "string"
          ? source.oracle.secondaryProvider
          : null,
      provider:
        typeof source.oracle?.provider === "string"
          ? source.oracle.provider
          : null,
      validationAsset:
        typeof source.oracle?.validationAsset === "string"
          ? source.oracle.validationAsset
          : null,
      maxOracleAgeSeconds:
        typeof source.oracle?.maxOracleAgeSeconds === "number"
          ? source.oracle.maxOracleAgeSeconds
          : null,
      maxDivergenceBps:
        typeof source.oracle?.maxDivergenceBps === "number"
          ? source.oracle.maxDivergenceBps
          : null,
      minProviderCount:
        typeof source.oracle?.minProviderCount === "number"
          ? source.oracle.minProviderCount
          : null,
      selectedSourceUnderDivergence:
        typeof source.oracle?.selectedSourceUnderDivergence === "number"
          ? source.oracle.selectedSourceUnderDivergence
          : null,
      source: source.oracle?.source === "deployments" ? "deployments" : "fallback",
    },
    deployment: {
      targetNetwork:
        source.deployment?.targetNetwork === "mainnet" ? "mainnet" : "testnet",
      deploymentsPath:
        typeof source.deployment?.deploymentsPath === "string"
          ? source.deployment.deploymentsPath
          : null,
      pathSource:
        source.deployment?.pathSource === "env_path"
          ? "env_path"
          : source.deployment?.pathSource === "bundled_testnet"
            ? "bundled_testnet"
            : source.deployment?.pathSource === "bundled_mainnet"
              ? "bundled_mainnet"
              : "network_default",
      fileFound: Boolean(source.deployment?.fileFound),
      networkMismatch: Boolean(source.deployment?.networkMismatch),
      readError:
        typeof source.deployment?.readError === "string"
          ? source.deployment.readError
          : null,
    },
  });
}

function normalizeOracleCutoverGateSnapshot(
  payload: unknown,
  oracleSnapshot: LeaderboardDataSourceSnapshot,
): OracleCutoverGateSnapshot {
  if (!payload || typeof payload !== "object") {
    return deriveOracleCutoverGate(oracleSnapshot, { enforceMainnetOnly: true });
  }
  const source = payload as Partial<OracleCutoverGateSnapshot> & {
    checks?: Record<string, unknown>;
  };
  return {
    status:
      source.status === "ready" ||
      source.status === "blocked" ||
      source.status === "not_required" ||
      source.status === "unknown"
        ? source.status
        : "unknown",
    code:
      source.code === "ready" ||
      source.code === "manifest_missing" ||
      source.code === "network_mismatch" ||
      source.code === "oracle_unverified" ||
      source.code === "contracts_incomplete" ||
      source.code === "provider_unverified" ||
      source.code === "thresholds_unconfigured" ||
      source.code === "not_required" ||
      source.code === "snapshot_missing"
        ? source.code
        : "snapshot_missing",
    targetNetwork: source.targetNetwork === "mainnet" ? "mainnet" : "testnet",
    ready: Boolean(source.ready),
    detail:
      typeof source.detail === "string"
        ? source.detail
        : "Runtime oracle gate detail is unavailable.",
    checks: {
      manifestFound: Boolean(source.checks?.manifestFound),
      networkMismatch: Boolean(source.checks?.networkMismatch),
      oracleMode:
        source.checks?.oracleMode === "oracle_guard"
          ? "oracle_guard"
          : "unverified",
      hasOracleGuard: Boolean(source.checks?.hasOracleGuard),
      hasPrimaryOracle: Boolean(source.checks?.hasPrimaryOracle),
      hasSecondaryOracle: Boolean(source.checks?.hasSecondaryOracle),
      providersVerified: Boolean(source.checks?.providersVerified),
      thresholdsConfigured: Boolean(source.checks?.thresholdsConfigured),
      noTestnetProviderFallback: Boolean(source.checks?.noTestnetProviderFallback),
    },
  };
}

function normalizeBalancedAutoSurfaceGateSnapshot(
  payload: unknown,
): BalancedAutoSurfaceGateSnapshot {
  if (!payload || typeof payload !== "object") {
    return {
      status: "unknown",
      code: "snapshot_missing",
      targetNetwork: "testnet",
      ready: false,
      detail: "Balanced AUTO surface gate snapshot is unavailable.",
      checks: {
        plannerAdmission: "blocked",
        planningEnabled: false,
        supportStatus: "blocked",
        manualExecutionEligible: false,
        hasAdapterContract: false,
        hasPoolId: false,
        laneReady: false,
        quoteProvider: "unknown",
        hasPublicQuoteEndpoint: false,
        hasPublicBuildEndpoint: false,
        hasPublicRelayEndpoint: false,
        hasPublicSubmitEndpoint: false,
        hasPublicStatusEndpoint: false,
        hasPublicReceiptEndpoint: false,
        hasPublicExpiryEndpoint: false,
        hasPublicRefundEndpoint: false,
        surfaceReady: false,
        officialEvidenceReady: false,
        officialAutoComparable: false,
        hasNoPublicRouterContractId: true,
        publicRouterContractId: null,
        officialEvidenceCode: "official_surface_unverified",
      },
    };
  }
  const source = payload as Partial<BalancedAutoSurfaceGateSnapshot> & {
    checks?: Record<string, unknown>;
  };
  return {
    status:
      source.status === "ready" ||
      source.status === "blocked" ||
      source.status === "not_required" ||
      source.status === "unknown"
        ? source.status
        : "unknown",
    code:
      source.code === "ready" ||
      source.code === "not_required" ||
      source.code === "support_blocked" ||
      source.code === "manual_only" ||
      source.code === "official_surface_unverified" ||
      source.code === "router_contract_declared" ||
      source.code === "surface_incomplete" ||
      source.code === "snapshot_missing"
        ? source.code
        : "snapshot_missing",
    targetNetwork: source.targetNetwork === "mainnet" ? "mainnet" : "testnet",
    ready: Boolean(source.ready),
    detail:
      typeof source.detail === "string"
        ? source.detail
        : "Balanced AUTO surface gate detail is unavailable.",
    checks: {
      plannerAdmission:
        source.checks?.plannerAdmission === "auto" ||
        source.checks?.plannerAdmission === "manual_only"
          ? source.checks.plannerAdmission
          : "blocked",
      planningEnabled: Boolean(source.checks?.planningEnabled),
      supportStatus: normalizeProtocolSupportStatus(
        typeof source.checks?.supportStatus === "string"
          ? source.checks.supportStatus
          : "blocked",
      ),
      manualExecutionEligible: Boolean(source.checks?.manualExecutionEligible),
      hasAdapterContract: Boolean(source.checks?.hasAdapterContract),
      hasPoolId: Boolean(source.checks?.hasPoolId),
      laneReady: Boolean(source.checks?.laneReady),
      quoteProvider:
        source.checks?.quoteProvider === "sodax" ? "sodax" : "unknown",
      hasPublicQuoteEndpoint: Boolean(source.checks?.hasPublicQuoteEndpoint),
      hasPublicBuildEndpoint: Boolean(source.checks?.hasPublicBuildEndpoint),
      hasPublicRelayEndpoint: Boolean(source.checks?.hasPublicRelayEndpoint),
      hasPublicSubmitEndpoint: Boolean(source.checks?.hasPublicSubmitEndpoint),
      hasPublicStatusEndpoint: Boolean(source.checks?.hasPublicStatusEndpoint),
      hasPublicReceiptEndpoint: Boolean(source.checks?.hasPublicReceiptEndpoint),
      hasPublicExpiryEndpoint: Boolean(source.checks?.hasPublicExpiryEndpoint),
      hasPublicRefundEndpoint: Boolean(source.checks?.hasPublicRefundEndpoint),
      surfaceReady: Boolean(source.checks?.surfaceReady),
      officialEvidenceReady: Boolean(source.checks?.officialEvidenceReady),
      officialAutoComparable: Boolean(source.checks?.officialAutoComparable),
      hasNoPublicRouterContractId:
        typeof source.checks?.hasNoPublicRouterContractId === "boolean"
          ? source.checks.hasNoPublicRouterContractId
          : true,
      publicRouterContractId:
        typeof source.checks?.publicRouterContractId === "string"
          ? source.checks.publicRouterContractId
          : null,
      officialEvidenceCode:
        source.checks?.officialEvidenceCode === "verified_auto_ready" ||
        source.checks?.officialEvidenceCode === "verified_manual_only" ||
        source.checks?.officialEvidenceCode === "router_contract_declared" ||
        source.checks?.officialEvidenceCode === "official_sources_incomplete" ||
        source.checks?.officialEvidenceCode === "official_surface_unverified" ||
        source.checks?.officialEvidenceCode === "quote_not_comparable_for_auto"
          ? source.checks.officialEvidenceCode
          : "official_surface_unverified",
    },
  };
}

export function normalizeProtocolSupportStatus(
  value: string | null | undefined,
): ProtocolSupportStatus {
  if (value === "ready" || value === "inactive") return value;
  return "blocked";
}

export function buildBalancedFallbackPayload(input?: {
  validatedAt?: string | null;
  adapterBalanced?: string;
  poolId?: number;
  supportStatus?: string | null;
  readyForDappExecution?: boolean;
  laneMode?: string;
  blockingReasons?: string[];
  observedRouter?: string | null;
  expectedRouter?: string | null;
  poolSupported?: boolean;
  pairConfigured?: boolean;
  validatedModule?: Partial<BalancedValidatedModulePayload>;
  officialSurface?: Partial<BalancedOfficialSurfacePayload>;
  intentVenue?: Partial<BalancedIntentVenuePayload>;
  source?: "deployments" | "fallback";
}): BalancedProtocolHealthPayload {
  const officialSurface: BalancedOfficialSurfacePayload = {
    validatedAt: input?.officialSurface?.validatedAt ?? null,
    officialSources: {
      app: input?.officialSurface?.officialSources?.app ?? null,
      bundle: input?.officialSurface?.officialSources?.bundle ?? null,
      stellarPage: input?.officialSurface?.officialSources?.stellarPage ?? null,
      swapDocs: input?.officialSurface?.officialSources?.swapDocs ?? null,
      tradeBlog: input?.officialSurface?.officialSources?.tradeBlog ?? null,
      q3Blog: input?.officialSurface?.officialSources?.q3Blog ?? null,
    },
    topology: input?.officialSurface?.topology ?? "unknown",
    swapModel: input?.officialSurface?.swapModel ?? "unknown",
    liquidityModel:
      input?.officialSurface?.liquidityModel ?? "unknown",
    publicRouterContractId:
      input?.officialSurface?.publicRouterContractId ?? null,
    supportsPublicStellarTestnet:
      input?.officialSurface?.supportsPublicStellarTestnet ?? false,
    canonicalRouterCutoverPossible:
      input?.officialSurface?.canonicalRouterCutoverPossible ?? false,
    intentAdapter: {
      quoteProvider: input?.officialSurface?.intentAdapter?.quoteProvider ?? "unknown",
      quoteVisibleInApp:
        input?.officialSurface?.intentAdapter?.quoteVisibleInApp ?? false,
      quoteComparableForArka:
        input?.officialSurface?.intentAdapter?.quoteComparableForArka ?? false,
      publicQuoteEndpoint:
        input?.officialSurface?.intentAdapter?.publicQuoteEndpoint ?? null,
      publicBuildEndpoint:
        input?.officialSurface?.intentAdapter?.publicBuildEndpoint ?? null,
      publicRelayEndpoint:
        input?.officialSurface?.intentAdapter?.publicRelayEndpoint ?? null,
      publicSubmitEndpoint:
        input?.officialSurface?.intentAdapter?.publicSubmitEndpoint ?? null,
      statusSurface:
        input?.officialSurface?.intentAdapter?.statusSurface ?? "unknown",
      publicStatusEndpoint:
        input?.officialSurface?.intentAdapter?.publicStatusEndpoint ?? null,
      publicReceiptEndpoint:
        input?.officialSurface?.intentAdapter?.publicReceiptEndpoint ?? null,
      publicExpiryEndpoint:
        input?.officialSurface?.intentAdapter?.publicExpiryEndpoint ?? null,
      publicRefundEndpoint:
        input?.officialSurface?.intentAdapter?.publicRefundEndpoint ?? null,
      cancellationWindowSeconds:
        input?.officialSurface?.intentAdapter?.cancellationWindowSeconds ?? null,
    },
    stellarMainnetAddresses: {
      connection:
        input?.officialSurface?.stellarMainnetAddresses?.connection ?? null,
      assetManager:
        input?.officialSurface?.stellarMainnetAddresses?.assetManager ?? null,
      xTokenManager:
        input?.officialSurface?.stellarMainnetAddresses?.xTokenManager ?? null,
      rateLimit:
        input?.officialSurface?.stellarMainnetAddresses?.rateLimit ?? null,
    },
    findings: input?.officialSurface?.findings ?? [],
    source: input?.officialSurface?.source ?? input?.source ?? "fallback",
  };
  const validatedModule: BalancedValidatedModulePayload = {
    present: Boolean(input?.validatedModule?.present),
    validatedAt: input?.validatedModule?.validatedAt ?? null,
    router: input?.validatedModule?.router ?? null,
    poolId: input?.validatedModule?.poolId ?? 0,
    sourceValidations: input?.validatedModule?.sourceValidations ?? [],
    source: input?.validatedModule?.source ?? input?.source ?? "fallback",
  };
  const supportStatus = normalizeProtocolSupportStatus(input?.supportStatus);
  const readyForDappExecution = input?.readyForDappExecution ?? false;
  const blockingReasons = input?.blockingReasons ?? [];
  const intentVenue = buildBalancedIntentVenuePayload({
    supportStatus,
    readyForDappExecution,
    laneMode: input?.laneMode ?? "undeclared",
    blockingReasons,
    validatedModule,
    officialSurface,
    override: input?.intentVenue,
  });

  return {
    validatedAt: input?.validatedAt ?? null,
    adapterBalanced: input?.adapterBalanced ?? "",
    poolId: input?.poolId ?? 0,
    supportStatus,
    readyForDappExecution,
    laneMode: input?.laneMode ?? "undeclared",
    blockingReasons,
    observedRouter: input?.observedRouter ?? null,
    expectedRouter: input?.expectedRouter ?? null,
    poolSupported: input?.poolSupported ?? false,
    pairConfigured: input?.pairConfigured ?? false,
    validatedModule,
    officialSurface,
    intentVenue,
    source: input?.source ?? "fallback",
  };
}

export function buildRoutingSolverFallbackPayload(
  input?: Partial<RoutingSolverHealthPayload>,
): RoutingSolverHealthPayload {
  return {
    mode: "backend_solver_with_local_fallback",
    planEndpoint: input?.planEndpoint ?? "/api/routing/rebalance/plan",
    fallbackMode: "local_workflow_solver",
    backendAvailable: input?.backendAvailable ?? false,
    generatedAt: input?.generatedAt ?? null,
    balancedPlannerAdmission: input?.balancedPlannerAdmission ?? "blocked",
    balancedManualExecutionEligible:
      input?.balancedManualExecutionEligible ?? false,
    balancedComparableQuote: input?.balancedComparableQuote ?? false,
    balancedSupportStatus: normalizeProtocolSupportStatus(
      input?.balancedSupportStatus,
    ),
    balancedLaneMode: input?.balancedLaneMode ?? "undeclared",
    balancedAutoSurfaceReady: input?.balancedAutoSurfaceReady ?? false,
    balancedAutoSurfaceReason:
      input?.balancedAutoSurfaceReason ??
      "Balanced AUTO surface readiness is unavailable.",
    note:
      input?.note ??
      "Routing solver status snapshot is unavailable; local workflow fallback remains active.",
  };
}

function normalizeRoutingSolverSnapshot(
  payload: unknown,
): RoutingSolverHealthPayload {
  if (!payload || typeof payload !== "object") {
    return buildRoutingSolverFallbackPayload();
  }
  const source = payload as Partial<RoutingSolverHealthPayload>;
  return buildRoutingSolverFallbackPayload({
    planEndpoint:
      typeof source.planEndpoint === "string"
        ? source.planEndpoint
        : "/api/routing/rebalance/plan",
    backendAvailable: Boolean(source.backendAvailable),
    generatedAt:
      typeof source.generatedAt === "string" ? source.generatedAt : null,
    balancedPlannerAdmission:
      source.balancedPlannerAdmission === "auto" ||
      source.balancedPlannerAdmission === "manual_only"
        ? source.balancedPlannerAdmission
        : "blocked",
    balancedManualExecutionEligible: Boolean(
      source.balancedManualExecutionEligible,
    ),
    balancedComparableQuote: Boolean(source.balancedComparableQuote),
    balancedSupportStatus: normalizeProtocolSupportStatus(
      source.balancedSupportStatus,
    ),
    balancedLaneMode:
      typeof source.balancedLaneMode === "string"
        ? source.balancedLaneMode
        : "undeclared",
    balancedAutoSurfaceReady: Boolean(source.balancedAutoSurfaceReady),
    balancedAutoSurfaceReason:
      typeof source.balancedAutoSurfaceReason === "string"
        ? source.balancedAutoSurfaceReason
        : "Balanced AUTO surface readiness is unavailable.",
    note:
      typeof source.note === "string"
        ? source.note
        : "Routing solver status snapshot is unavailable; local workflow fallback remains active.",
  });
}

function buildBalancedIntentVenuePayload(input: {
  supportStatus: ProtocolSupportStatus;
  readyForDappExecution: boolean;
  laneMode: string;
  blockingReasons: string[];
  validatedModule: BalancedValidatedModulePayload;
  officialSurface: BalancedOfficialSurfacePayload;
  override?: Partial<BalancedIntentVenuePayload>;
}): BalancedIntentVenuePayload {
  const officialSurfaceKnown =
    input.officialSurface.topology === "intent_based" ||
    input.officialSurface.swapModel === "sodax_intents" ||
    Boolean(
      input.officialSurface.stellarMainnetAddresses.connection ||
        input.officialSurface.stellarMainnetAddresses.assetManager ||
        input.officialSurface.stellarMainnetAddresses.rateLimit,
    );
  const comparableQuote =
    input.officialSurface.intentAdapter.quoteComparableForArka ||
    (Boolean(input.officialSurface.publicRouterContractId) &&
      input.officialSurface.supportsPublicStellarTestnet);
  const visibleOfficialQuote = input.officialSurface.intentAdapter.quoteVisibleInApp;
  const publicQuoteSurfaceAvailable = Boolean(
    input.officialSurface.intentAdapter.publicQuoteEndpoint,
  );
  const manualExecutionEligible = input.readyForDappExecution;
  const autoRoutingEligible = manualExecutionEligible && comparableQuote;
  const notes = [
    officialSurfaceKnown
      ? "Balanced swap route is verified as SODAX Intents."
      : "Balanced intent route is not verified yet.",
    comparableQuote
      ? "A comparable public quote is available for AUTO."
      : publicQuoteSurfaceAvailable
        ? "Balanced exposes SODAX quote and status data, but AUTO waits until execution status is comparable."
      : input.officialSurface.intentAdapter.quoteVisibleInApp
        ? "Balanced quotes are visible in the official app, but not yet comparable inside Arka."
        : "No comparable public quote is available for AUTO yet.",
    manualExecutionEligible
      ? input.validatedModule.present
        ? "Arka can execute Balanced manually through the governed route."
        : "Arka can execute Balanced manually, but final promotion is still required."
      : input.blockingReasons[0] ??
        (input.supportStatus === "inactive"
          ? "Balanced is inactive in the current deployment."
          : input.laneMode === "legacy_comet"
            ? "Balanced still points to the retired legacy Comet lane."
            : "Balanced manual execution is blocked until the current lane is ready."),
  ];

  return {
    discoveryState: input.override?.discoveryState ??
      (officialSurfaceKnown ? "available" : "unavailable"),
    discoveryModel: input.override?.discoveryModel ??
      (officialSurfaceKnown ? "official_runtime_snapshot" : "unavailable"),
    quoteState: input.override?.quoteState ??
      (comparableQuote
        ? "available"
        : publicQuoteSurfaceAvailable || visibleOfficialQuote || manualExecutionEligible
          ? "limited"
          : "unavailable"),
    quoteModel: input.override?.quoteModel ??
      (comparableQuote
        ? "public_quote_surface"
        : publicQuoteSurfaceAvailable
          ? "public_quote_surface_manual_execution"
        : visibleOfficialQuote || manualExecutionEligible
          ? "manual_only"
          : "official_surface_unverified"),
    comparableQuote,
    executeState: input.override?.executeState ??
      (manualExecutionEligible ? "available" : "unavailable"),
    executeModel: input.override?.executeModel ??
      (manualExecutionEligible ? "adapter_gated_manual" : "unavailable"),
    confirmModel:
      input.override?.confirmModel ?? "transaction_hash_plus_refresh",
    autoRoutingEligible:
      input.override?.autoRoutingEligible ?? autoRoutingEligible,
    manualExecutionEligible:
      input.override?.manualExecutionEligible ?? manualExecutionEligible,
    plannerAdmission:
      input.override?.plannerAdmission ??
      (autoRoutingEligible
        ? "auto"
        : manualExecutionEligible
          ? "manual_only"
          : "blocked"),
    notes: input.override?.notes ?? notes,
  };
}

export async function readAppHealthSnapshot(
  fetchImpl: typeof fetch = fetch,
  endpoint = "/api/health",
): Promise<AppHealthPayload | null> {
  try {
    const response = await fetchImpl(endpoint, {
      method: "GET",
      headers: { accept: "application/json" },
      cache: "no-store",
    });
    if (!response.ok && response.status !== 503) {
      return null;
    }
    const body = (await response.json()) as Partial<AppHealthPayload>;
    if (!body || typeof body !== "object") return null;
    const oracle = normalizeOracleRuntimeSnapshot(body.oracle);
    return {
      app: typeof body.app === "string" ? body.app : "ok",
      catalog: {
        configured: Boolean(body.catalog?.configured),
        reachable: Boolean(body.catalog?.reachable),
        healthy: Boolean(body.catalog?.healthy),
        degraded: Boolean(body.catalog?.degraded),
        statusCode:
          typeof body.catalog?.statusCode === "number" ? body.catalog.statusCode : 0,
        evaluatedAt:
          typeof body.catalog?.evaluatedAt === "string"
            ? body.catalog.evaluatedAt
            : null,
        error:
          typeof body.catalog?.error === "string" ? body.catalog.error : null,
        baseUrl:
          typeof body.catalog?.baseUrl === "string"
            ? body.catalog.baseUrl
            : undefined,
      },
      protocols: {
        balanced: buildBalancedFallbackPayload(body.protocols?.balanced),
      },
      routing: normalizeRoutingSolverSnapshot(body.routing),
      oracle,
      releaseGate: {
        oracleCutover: normalizeOracleCutoverGateSnapshot(
          body.releaseGate?.oracleCutover,
          oracle,
        ),
        balancedAutoSurface: normalizeBalancedAutoSurfaceGateSnapshot(
          body.releaseGate?.balancedAutoSurface,
        ),
      },
    };
  } catch {
    return null;
  }
}
