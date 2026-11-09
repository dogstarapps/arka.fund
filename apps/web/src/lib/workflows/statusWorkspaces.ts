type StatusTone = "neutral" | "positive" | "warning" | "critical";

export type StatusWorkspaceId =
  | "baseline"
  | "operator"
  | "oracle"
  | "routing"
  | "limits"
  | "links";

export interface StatusWorkspaceTab {
  id: StatusWorkspaceId;
  label: string;
  eyebrow: string;
  description: string;
}

export interface StatusWorkspaceSnapshot {
  networkLiveLabel: string;
  scopeCount: number;
  operatorCount: number;
  limitationCount: number;
  referenceCount: number;
  profile: string;
  oracleGateState: string;
  oracleTargetNetwork: string;
  oracleMode: string;
  routingMode: string;
  routingBackendAvailable: boolean;
  balancedPlannerAdmission: string;
}

export interface StatusWorkspaceSignal {
  id: string;
  label: string;
  value: string;
  detail: string;
  tone: StatusTone;
}

export interface StatusWorkspaceState {
  tab: StatusWorkspaceTab;
  signals: StatusWorkspaceSignal[];
}

export const STATUS_WORKSPACE_TABS: StatusWorkspaceTab[] = [
  {
    id: "baseline",
    label: "Baseline",
    eyebrow: "Operating scope",
    description: "Live network, validated scope and current operating posture.",
  },
  {
    id: "operator",
    label: "Runbook",
    eyebrow: "Launch checks",
    description:
      "Human checks required before running create, deposit, rebalance and governed flows.",
  },
  {
    id: "oracle",
    label: "Oracle",
    eyebrow: "Cutover gate",
    description:
      "Runtime oracle/deployments readiness used to block unsafe mainnet cutover.",
  },
  {
    id: "routing",
    label: "Routing",
    eyebrow: "Route quality",
    description:
      "Best-execution backend, fallback mode and Balanced AUTO admission state.",
  },
  {
    id: "limits",
    label: "Limits",
    eyebrow: "Watch items",
    description:
      "Known limits that still need operator awareness before live validation.",
  },
  {
    id: "links",
    label: "References",
    eyebrow: "Sources",
    description:
      "Primary repositories and source-of-truth links for contracts and execution.",
  },
];

const TAB_MAP = new Map(STATUS_WORKSPACE_TABS.map((tab) => [tab.id, tab]));

export function resolveStatusWorkspaceId(
  value: string | null | undefined,
  fallback: StatusWorkspaceId = "baseline",
): StatusWorkspaceId {
  return TAB_MAP.has(value as StatusWorkspaceId)
    ? (value as StatusWorkspaceId)
    : fallback;
}

export function getStatusWorkspaceTab(
  id: StatusWorkspaceId,
): StatusWorkspaceTab {
  return TAB_MAP.get(id) ?? STATUS_WORKSPACE_TABS[0];
}

function stateTone(state: string): StatusTone {
  const normalized = state.trim().toLowerCase();
  if (["ready", "loaded", "verified", "online", "live"].includes(normalized)) {
    return "positive";
  }
  if (
    normalized.includes("blocked") ||
    normalized.includes("missing") ||
    normalized.includes("fallback") ||
    normalized.includes("unverified")
  ) {
    return "warning";
  }
  return "neutral";
}

export function buildStatusWorkspaceSignals(
  snapshot: StatusWorkspaceSnapshot,
  workspace: StatusWorkspaceId,
): StatusWorkspaceSignal[] {
  switch (workspace) {
    case "operator":
      return [
        {
          id: "runbook",
          label: "Runbook",
          value: `${snapshot.operatorCount} checks`,
          detail: "Required operator checks before live flows.",
          tone: "positive",
        },
        {
          id: "profile",
          label: "Profile",
          value: snapshot.profile,
          detail: "Active rebalance and micro-liquidity posture.",
          tone: "neutral",
        },
        {
          id: "network",
          label: "Network",
          value: snapshot.networkLiveLabel,
          detail: "Current environment used by the operator runbook.",
          tone: "positive",
        },
      ];
    case "oracle":
      return [
        {
          id: "gate",
          label: "Cutover gate",
          value: snapshot.oracleGateState,
          detail: "Release gate state derived from runtime oracle/deployments.",
          tone: stateTone(snapshot.oracleGateState),
        },
        {
          id: "target",
          label: "Target network",
          value: snapshot.oracleTargetNetwork,
          detail: "Deployment manifest network under validation.",
          tone: "neutral",
        },
        {
          id: "mode",
          label: "Oracle mode",
          value: snapshot.oracleMode,
          detail: "Configured oracle provider mode for runtime checks.",
          tone: stateTone(snapshot.oracleMode),
        },
      ];
    case "routing":
      return [
        {
          id: "solver",
          label: "Solver",
          value: snapshot.routingMode,
          detail: "Backend best-execution solver and local fallback posture.",
          tone: "neutral",
        },
        {
          id: "backend",
          label: "Backend",
          value: snapshot.routingBackendAvailable ? "Online" : "Fallback",
          detail: "Whether the backend planner is reachable for live routing.",
          tone: snapshot.routingBackendAvailable ? "positive" : "warning",
        },
        {
          id: "balanced",
          label: "Balanced AUTO",
          value: snapshot.balancedPlannerAdmission,
          detail: "Balanced best-execution status for AUTO routing.",
          tone: stateTone(snapshot.balancedPlannerAdmission),
        },
      ];
    case "limits":
      return [
        {
          id: "watch",
          label: "Watch items",
          value: `${snapshot.limitationCount} limits`,
          detail: "Known constraints still attached for operator awareness.",
          tone: snapshot.limitationCount > 0 ? "warning" : "positive",
        },
        {
          id: "profile",
          label: "Profile",
          value: snapshot.profile,
          detail: "Active policy profile that governs live validation.",
          tone: "neutral",
        },
        {
          id: "scope",
          label: "Scope",
          value: `${snapshot.scopeCount} lanes`,
          detail: "Validated product lanes that limits are measured against.",
          tone: "positive",
        },
      ];
    case "links":
      return [
        {
          id: "references",
          label: "References",
          value: `${snapshot.referenceCount} sources`,
          detail: "Primary source links for contracts and protocol docs.",
          tone: snapshot.referenceCount > 0 ? "positive" : "warning",
        },
        {
          id: "network",
          label: "Network",
          value: snapshot.networkLiveLabel,
          detail: "Reference context for the active deployment environment.",
          tone: "neutral",
        },
        {
          id: "oracle",
          label: "Oracle",
          value: snapshot.oracleMode,
          detail: "Oracle context shown alongside source links.",
          tone: stateTone(snapshot.oracleMode),
        },
      ];
    case "baseline":
    default:
      return [
        {
          id: "scope",
          label: "Validated scope",
          value: `${snapshot.scopeCount} lanes`,
          detail: "Current product lanes covered by the operating baseline.",
          tone: "positive",
        },
        {
          id: "network",
          label: "Network",
          value: snapshot.networkLiveLabel,
          detail: "Active Stellar network detected from configuration.",
          tone: "positive",
        },
        {
          id: "operator",
          label: "Operator posture",
          value: `${snapshot.operatorCount} checks`,
          detail: "Checks linked to the active baseline.",
          tone: "neutral",
        },
      ];
  }
}

export function buildStatusWorkspaceState(
  snapshot: StatusWorkspaceSnapshot,
  workspace: StatusWorkspaceId,
): StatusWorkspaceState {
  return {
    tab: getStatusWorkspaceTab(workspace),
    signals: buildStatusWorkspaceSignals(snapshot, workspace),
  };
}
