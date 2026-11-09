import type { BalancedProtocolHealthPayload } from "@/lib/runtime/appHealth";
import {
  deriveBalancedOfficialSurfaceEvidence,
  type BalancedOfficialSurfaceEvidence,
} from "@/lib/workflows/balancedOfficialSurfaceEvidence";

export type BalancedAutoSurfaceGateStatus =
  | "ready"
  | "blocked"
  | "not_required"
  | "unknown";
export type BalancedAutoSurfaceGateCode =
  | "ready"
  | "not_required"
  | "support_blocked"
  | "manual_only"
  | "official_surface_unverified"
  | "router_contract_declared"
  | "surface_incomplete"
  | "snapshot_missing";

export interface BalancedAutoSurfaceReadiness {
  plannerAdmission: "auto" | "manual_only" | "blocked";
  planningEnabled: boolean;
  manualExecutionEligible: boolean;
  supportStatus: "ready" | "blocked" | "inactive";
  hasAdapterContract: boolean;
  hasPoolId: boolean;
  laneReady: boolean;
  quoteProvider: "sodax" | "unknown";
  hasPublicQuoteEndpoint: boolean;
  hasPublicBuildEndpoint: boolean;
  hasPublicRelayEndpoint: boolean;
  hasPublicSubmitEndpoint: boolean;
  hasPublicStatusEndpoint: boolean;
  hasPublicReceiptEndpoint: boolean;
  hasPublicExpiryEndpoint: boolean;
  hasPublicRefundEndpoint: boolean;
  surfaceReady: boolean;
  officialEvidenceReady: boolean;
  officialAutoComparable: boolean;
  hasNoPublicRouterContractId: boolean;
  publicRouterContractId: string | null;
  officialEvidenceCode: BalancedOfficialSurfaceEvidence["code"];
  officialEvidence: BalancedOfficialSurfaceEvidence;
  autoReady: boolean;
  reason: string;
}

export interface BalancedAutoSurfaceGateSnapshot {
  status: BalancedAutoSurfaceGateStatus;
  code: BalancedAutoSurfaceGateCode;
  targetNetwork: "testnet" | "mainnet";
  ready: boolean;
  detail: string;
  checks: {
    plannerAdmission: "auto" | "manual_only" | "blocked";
    planningEnabled: boolean;
    supportStatus: "ready" | "blocked" | "inactive";
    manualExecutionEligible: boolean;
    hasAdapterContract: boolean;
    hasPoolId: boolean;
    laneReady: boolean;
    quoteProvider: "sodax" | "unknown";
    hasPublicQuoteEndpoint: boolean;
    hasPublicBuildEndpoint: boolean;
    hasPublicRelayEndpoint: boolean;
    hasPublicSubmitEndpoint: boolean;
    hasPublicStatusEndpoint: boolean;
    hasPublicReceiptEndpoint: boolean;
    hasPublicExpiryEndpoint: boolean;
    hasPublicRefundEndpoint: boolean;
    surfaceReady: boolean;
    officialEvidenceReady: boolean;
    officialAutoComparable: boolean;
    hasNoPublicRouterContractId: boolean;
    publicRouterContractId: string | null;
    officialEvidenceCode: BalancedOfficialSurfaceEvidence["code"];
  };
}

function hasValue(value: string | null | undefined): boolean {
  return typeof value === "string" && value.trim().length > 0;
}

export function deriveBalancedAutoSurfaceReadiness(
  balanced: BalancedProtocolHealthPayload,
): BalancedAutoSurfaceReadiness {
  const officialEvidence = deriveBalancedOfficialSurfaceEvidence(balanced);
  const plannerAdmission = balanced.intentVenue.plannerAdmission;
  const planningEnabled = plannerAdmission !== "blocked";
  const quoteProvider = balanced.officialSurface.intentAdapter.quoteProvider;
  const manualExecutionEligible =
    balanced.intentVenue.manualExecutionEligible && balanced.readyForDappExecution;
  const hasAdapterContract = hasValue(balanced.adapterBalanced);
  const hasPoolId = Number.isFinite(balanced.poolId) && balanced.poolId > 0;
  const isSodaxIntentLane =
    quoteProvider === "sodax" &&
    officialEvidence.checks.noPublicRouterContractId;
  const laneReady =
    balanced.supportStatus === "ready" &&
    manualExecutionEligible &&
    (hasAdapterContract || isSodaxIntentLane) &&
    hasPoolId;

  const hasPublicQuoteEndpoint = hasValue(
    balanced.officialSurface.intentAdapter.publicQuoteEndpoint,
  );
  const hasPublicBuildEndpoint = hasValue(
    balanced.officialSurface.intentAdapter.publicBuildEndpoint,
  );
  const hasPublicRelayEndpoint = hasValue(
    balanced.officialSurface.intentAdapter.publicRelayEndpoint,
  );
  const hasPublicSubmitEndpoint = hasValue(
    balanced.officialSurface.intentAdapter.publicSubmitEndpoint,
  );
  const hasPublicStatusEndpoint = hasValue(
    balanced.officialSurface.intentAdapter.publicStatusEndpoint,
  );
  const hasPublicReceiptEndpoint = hasValue(
    balanced.officialSurface.intentAdapter.publicReceiptEndpoint,
  );
  const hasPublicExpiryEndpoint = hasValue(
    balanced.officialSurface.intentAdapter.publicExpiryEndpoint,
  );
  const hasPublicRefundEndpoint = hasValue(
    balanced.officialSurface.intentAdapter.publicRefundEndpoint,
  );
  const surfaceReady =
    quoteProvider === "sodax" &&
    hasPublicQuoteEndpoint &&
    hasPublicBuildEndpoint &&
    hasPublicRelayEndpoint &&
    hasPublicSubmitEndpoint &&
    hasPublicStatusEndpoint &&
    hasPublicReceiptEndpoint &&
    hasPublicExpiryEndpoint &&
    hasPublicRefundEndpoint &&
    officialEvidence.verified;
  const autoReady =
    plannerAdmission === "auto" &&
    planningEnabled &&
    laneReady &&
    surfaceReady &&
    officialEvidence.readyForAuto;

  let reason = "Balanced AUTO surface is not ready.";
  if (autoReady) {
    reason =
      "Balanced AUTO is ready: SODAX quote, build, relay, status, receipt, expiry and refund are all available.";
  } else if (!planningEnabled) {
    reason =
      balanced.intentVenue.notes[2] ??
      "Balanced cannot be considered for AUTO routing yet.";
  } else if (!laneReady) {
    const laneIssues: string[] = [];
    if (balanced.supportStatus !== "ready") laneIssues.push(`support=${balanced.supportStatus}`);
    if (!manualExecutionEligible) laneIssues.push("manual_execution=false");
    if (!hasAdapterContract && !isSodaxIntentLane) laneIssues.push("adapter_missing");
    if (!hasPoolId) laneIssues.push("pool_id_missing");
    reason = `Balanced lane is not execution-ready for AUTO: ${laneIssues.join(", ")}.`;
  } else if (!officialEvidence.verified) {
    reason = officialEvidence.reason;
  } else if (!surfaceReady) {
    const missing: string[] = [];
    if (quoteProvider !== "sodax") missing.push("quote_provider");
    if (!hasPublicQuoteEndpoint) missing.push("quote_endpoint");
    if (!hasPublicBuildEndpoint) missing.push("build_endpoint");
    if (!hasPublicRelayEndpoint) missing.push("relay_endpoint");
    if (!hasPublicSubmitEndpoint) missing.push("submit_endpoint");
    if (!hasPublicStatusEndpoint) missing.push("status_endpoint");
    if (!hasPublicReceiptEndpoint) missing.push("receipt_endpoint");
    if (!hasPublicExpiryEndpoint) missing.push("expiry_endpoint");
    if (!hasPublicRefundEndpoint) missing.push("refund_endpoint");
    reason = `Balanced is not ready for AUTO: missing ${missing.join(", ")}.`;
  } else if (plannerAdmission === "manual_only") {
    reason =
      officialEvidence.reason ||
      balanced.intentVenue.notes[1] ||
      "Planner still marks Balanced as manual_only. Comparable AUTO admission is not enabled.";
  } else if (!officialEvidence.readyForAuto) {
    reason = officialEvidence.reason;
  }

  return {
    plannerAdmission,
    planningEnabled,
    manualExecutionEligible,
    supportStatus: balanced.supportStatus,
    hasAdapterContract,
    hasPoolId,
    laneReady,
    quoteProvider,
    hasPublicQuoteEndpoint,
    hasPublicBuildEndpoint,
    hasPublicRelayEndpoint,
    hasPublicSubmitEndpoint,
    hasPublicStatusEndpoint,
    hasPublicReceiptEndpoint,
    hasPublicExpiryEndpoint,
    hasPublicRefundEndpoint,
    surfaceReady,
    officialEvidenceReady: officialEvidence.verified,
    officialAutoComparable: officialEvidence.readyForAuto,
    hasNoPublicRouterContractId:
      officialEvidence.checks.noPublicRouterContractId,
    publicRouterContractId: officialEvidence.checks.publicRouterContractId,
    officialEvidenceCode: officialEvidence.code,
    officialEvidence,
    autoReady,
    reason,
  };
}

function emptyChecks(): BalancedAutoSurfaceGateSnapshot["checks"] {
  return {
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
  };
}

function checksFromReadiness(
  readiness: BalancedAutoSurfaceReadiness,
): BalancedAutoSurfaceGateSnapshot["checks"] {
  return {
    plannerAdmission: readiness.plannerAdmission,
    planningEnabled: readiness.planningEnabled,
    supportStatus: readiness.supportStatus,
    manualExecutionEligible: readiness.manualExecutionEligible,
    hasAdapterContract: readiness.hasAdapterContract,
    hasPoolId: readiness.hasPoolId,
    laneReady: readiness.laneReady,
    quoteProvider: readiness.quoteProvider,
    hasPublicQuoteEndpoint: readiness.hasPublicQuoteEndpoint,
    hasPublicBuildEndpoint: readiness.hasPublicBuildEndpoint,
    hasPublicRelayEndpoint: readiness.hasPublicRelayEndpoint,
    hasPublicSubmitEndpoint: readiness.hasPublicSubmitEndpoint,
    hasPublicStatusEndpoint: readiness.hasPublicStatusEndpoint,
    hasPublicReceiptEndpoint: readiness.hasPublicReceiptEndpoint,
    hasPublicExpiryEndpoint: readiness.hasPublicExpiryEndpoint,
    hasPublicRefundEndpoint: readiness.hasPublicRefundEndpoint,
    surfaceReady: readiness.surfaceReady,
    officialEvidenceReady: readiness.officialEvidenceReady,
    officialAutoComparable: readiness.officialAutoComparable,
    hasNoPublicRouterContractId: readiness.hasNoPublicRouterContractId,
    publicRouterContractId: readiness.publicRouterContractId,
    officialEvidenceCode: readiness.officialEvidenceCode,
  };
}

export function deriveBalancedAutoSurfaceGate(
  balanced: BalancedProtocolHealthPayload | null,
  options?: {
    targetNetwork?: "testnet" | "mainnet";
    enforceMainnetOnly?: boolean;
  },
): BalancedAutoSurfaceGateSnapshot {
  const targetNetwork = options?.targetNetwork ?? "testnet";
  const enforceMainnetOnly = options?.enforceMainnetOnly ?? true;

  if (enforceMainnetOnly && targetNetwork !== "mainnet") {
    return {
      status: "not_required",
      code: "not_required",
      targetNetwork,
      ready: true,
      detail:
        "Balanced AUTO cutover gate is only enforced for mainnet target. Current target does not require this gate.",
      checks: emptyChecks(),
    };
  }

  if (!balanced) {
    return {
      status: "unknown",
      code: "snapshot_missing",
      targetNetwork,
      ready: false,
      detail: "Balanced protocol snapshot is unavailable, so AUTO cutover cannot be verified.",
      checks: emptyChecks(),
    };
  }

  const readiness = deriveBalancedAutoSurfaceReadiness(balanced);
  if (readiness.autoReady) {
    return {
      status: "ready",
      code: "ready",
      targetNetwork,
      ready: true,
      detail: readiness.reason,
      checks: checksFromReadiness(readiness),
    };
  }

  let code: BalancedAutoSurfaceGateCode = "support_blocked";
  if (!readiness.hasNoPublicRouterContractId) {
    code = "router_contract_declared";
  } else if (!readiness.officialEvidenceReady && readiness.laneReady) {
    code = "official_surface_unverified";
  } else if (!readiness.planningEnabled || !readiness.laneReady) {
    code = "support_blocked";
  } else if (readiness.plannerAdmission === "manual_only") {
    code = "manual_only";
  } else if (!readiness.surfaceReady) {
    code = "surface_incomplete";
  }

  return {
    status: "blocked",
    code,
    targetNetwork,
    ready: false,
    detail: readiness.reason,
    checks: checksFromReadiness(readiness),
  };
}
