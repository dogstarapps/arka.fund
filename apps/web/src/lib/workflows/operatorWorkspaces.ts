import type { ProtocolSupportStatus } from "@/lib/workflows/productFlows";
import type { OpsHealthRow, TierStageRow } from "./liveOps";

export type OperatorWorkspaceTone =
  | "positive"
  | "warning"
  | "critical"
  | "neutral";

export type OpsWorkspaceId = "health" | "routing" | "runbook";

export type TierWorkspaceId = "scorecard" | "ladder" | "update";

export type SettingsWorkspaceId = "configuration" | "guardrails" | "raw";

export type MigrationWorkspaceId = "plan" | "verify" | "simulate" | "export";

export interface OperatorWorkspaceTab<Id extends string> {
  id: Id;
  label: string;
  eyebrow: string;
  description: string;
}

export interface OperatorWorkspaceSignal {
  id: string;
  label: string;
  value: string;
  detail: string;
  tone: OperatorWorkspaceTone;
}

export interface OperatorWorkspaceState<Id extends string> {
  tab: OperatorWorkspaceTab<Id>;
  signals: OperatorWorkspaceSignal[];
}

export interface OpsWorkspaceSnapshot {
  rows: OpsHealthRow[];
  healthyCount: number;
  totalChecks: number;
  degraded: boolean;
  thresholdSummary: string;
  coverageVaultFormatted: string;
  coverageFundFormatted: string;
  adapterSummary: string;
  balancedModulePromoted: boolean;
  balancedSupportStatus: ProtocolSupportStatus;
  balancedLaneMode: string;
  loading: boolean;
  error: string;
}

export interface TierWorkspaceSnapshot {
  label: string;
  walletConnected: boolean;
  targetLabel: string;
  thresholdsLabel: string;
  nextStep: string;
  progressDetail: string;
  stageRows: TierStageRow[];
  canAct: boolean;
  deltaLabel: string;
  status: string;
  error: string;
}

export interface SettingsWorkspaceSnapshot {
  rpcConfigured: boolean;
  groupCount: number;
  configuredValueCount: number;
  guardrailProfile: string;
  defaultSlippagePct: string;
  maxSlippagePct: string;
  balancedSupportStatus: string;
  balancedLaneMode: string;
  balancedModuleStatus: string;
  rawValueCount: number;
}

export interface MigrationWorkspaceSnapshot {
  inspectionMode: "loading" | "live" | "stale" | "unavailable";
  loading: boolean;
  preflightReadyCount: number;
  preflightTotalCount: number;
  verificationRowCount: number;
  dryRunRowCount: number;
  readyPackageCount: number;
  bundleEntryCount: number;
  simulationEntryCount: number;
  simulationLoading: boolean;
  simulationError: string;
  status: string;
  error: string;
}

export const OPS_WORKSPACE_TABS: OperatorWorkspaceTab<OpsWorkspaceId>[] = [
  {
    id: "health",
    label: "Health",
    eyebrow: "Contract checks",
    description:
      "Readable contract posture across governance, reserves, tiers and adapter endpoints.",
  },
  {
    id: "routing",
    label: "Routing",
    eyebrow: "Protocol wiring",
    description:
      "Adapter-to-router alignment for Balanced, Aquarius, SoroSwap and Blend before execution.",
  },
  {
    id: "runbook",
    label: "Runbook",
    eyebrow: "Operator cadence",
    description:
      "Pre-flight checks an operator should complete before vault, routing or governance changes.",
  },
];

export const TIER_WORKSPACE_TABS: OperatorWorkspaceTab<TierWorkspaceId>[] = [
  {
    id: "scorecard",
    label: "Scorecard",
    eyebrow: "Manager posture",
    description:
      "Current manager score, wallet binding and selected target identity.",
  },
  {
    id: "ladder",
    label: "Ladder",
    eyebrow: "Thresholds",
    description:
      "Live manager-tier floors and the next milestone for the selected manager.",
  },
  {
    id: "update",
    label: "Update",
    eyebrow: "Governed action",
    description:
      "Authorized point update workflow with wallet, delta and on-chain rule checks.",
  },
];

export const SETTINGS_WORKSPACE_TABS: OperatorWorkspaceTab<SettingsWorkspaceId>[] = [
  {
    id: "configuration",
    label: "Configuration",
    eyebrow: "Runtime map",
    description:
      "Grouped network, contract and protocol wiring values currently exported to the DApp.",
  },
  {
    id: "guardrails",
    label: "Guardrails",
    eyebrow: "Routing policy",
    description:
      "DAO-governed rebalance envelope values and fallback buffers used by execution surfaces.",
  },
  {
    id: "raw",
    label: "Raw snapshot",
    eyebrow: "Diagnostics",
    description:
      "Machine-readable runtime snapshot for operator debugging, kept behind the advanced shell.",
  },
];

export const MIGRATION_WORKSPACE_TABS: OperatorWorkspaceTab<MigrationWorkspaceId>[] = [
  {
    id: "plan",
    label: "Plan",
    eyebrow: "Inspection",
    description:
      "Define source, target and governed migration values while reading current factory state.",
  },
  {
    id: "verify",
    label: "Verify",
    eyebrow: "Post-checks",
    description:
      "Compare desired migration values with getter-backed factory readbacks and dry-run posture.",
  },
  {
    id: "simulate",
    label: "Simulate",
    eyebrow: "RPC preflight",
    description:
      "Run RPC-backed simulation for the governed migration writes before handoff.",
  },
  {
    id: "export",
    label: "Export",
    eyebrow: "Governance",
    description:
      "Export migration packages and queue governed composer drafts.",
  },
];

const OPS_TAB_MAP = new Map(OPS_WORKSPACE_TABS.map((tab) => [tab.id, tab]));
const TIER_TAB_MAP = new Map(TIER_WORKSPACE_TABS.map((tab) => [tab.id, tab]));
const SETTINGS_TAB_MAP = new Map(
  SETTINGS_WORKSPACE_TABS.map((tab) => [tab.id, tab]),
);
const MIGRATION_TAB_MAP = new Map(
  MIGRATION_WORKSPACE_TABS.map((tab) => [tab.id, tab]),
);

export function resolveOpsWorkspaceId(
  value: string | null | undefined,
  fallback: OpsWorkspaceId = "health",
): OpsWorkspaceId {
  return OPS_TAB_MAP.has(value as OpsWorkspaceId)
    ? (value as OpsWorkspaceId)
    : fallback;
}

export function resolveTierWorkspaceId(
  value: string | null | undefined,
  fallback: TierWorkspaceId = "scorecard",
): TierWorkspaceId {
  return TIER_TAB_MAP.has(value as TierWorkspaceId)
    ? (value as TierWorkspaceId)
    : fallback;
}

export function resolveSettingsWorkspaceId(
  value: string | null | undefined,
  fallback: SettingsWorkspaceId = "configuration",
): SettingsWorkspaceId {
  return SETTINGS_TAB_MAP.has(value as SettingsWorkspaceId)
    ? (value as SettingsWorkspaceId)
    : fallback;
}

export function resolveMigrationWorkspaceId(
  value: string | null | undefined,
  fallback: MigrationWorkspaceId = "plan",
): MigrationWorkspaceId {
  return MIGRATION_TAB_MAP.has(value as MigrationWorkspaceId)
    ? (value as MigrationWorkspaceId)
    : fallback;
}

export function getOpsWorkspaceTab(
  id: OpsWorkspaceId,
): OperatorWorkspaceTab<OpsWorkspaceId> {
  return OPS_TAB_MAP.get(id) ?? OPS_WORKSPACE_TABS[0];
}

export function getTierWorkspaceTab(
  id: TierWorkspaceId,
): OperatorWorkspaceTab<TierWorkspaceId> {
  return TIER_TAB_MAP.get(id) ?? TIER_WORKSPACE_TABS[0];
}

export function getSettingsWorkspaceTab(
  id: SettingsWorkspaceId,
): OperatorWorkspaceTab<SettingsWorkspaceId> {
  return SETTINGS_TAB_MAP.get(id) ?? SETTINGS_WORKSPACE_TABS[0];
}

export function getMigrationWorkspaceTab(
  id: MigrationWorkspaceId,
): OperatorWorkspaceTab<MigrationWorkspaceId> {
  return MIGRATION_TAB_MAP.get(id) ?? MIGRATION_WORKSPACE_TABS[0];
}

function countHealthyRows(
  rows: OpsHealthRow[],
  predicate: (row: OpsHealthRow) => boolean,
): { healthy: number; total: number } {
  const filtered = rows.filter(predicate);
  return {
    healthy: filtered.filter((row) => row.healthy).length,
    total: filtered.length,
  };
}

function formatCount(healthy: number, total: number): string {
  return `${healthy}/${Math.max(0, total)}`;
}

function toneForRatio(healthy: number, total: number): OperatorWorkspaceTone {
  if (total === 0) return "warning";
  if (healthy === total) return "positive";
  if (healthy === 0) return "critical";
  return "warning";
}

function buildOpsHealthSignals(
  snapshot: OpsWorkspaceSnapshot,
): OperatorWorkspaceSignal[] {
  const governance = countHealthyRows(snapshot.rows, (row) =>
    ["governor", "votes"].includes(row.id),
  );
  const reserve = countHealthyRows(snapshot.rows, (row) =>
    ["coverage-vault", "coverage-fund"].includes(row.id),
  );

  return [
    {
      id: "ops-health-readiness",
      label: "Readiness",
      value: formatCount(snapshot.healthyCount, snapshot.totalChecks),
      detail: snapshot.degraded
        ? "At least one live check requires operator attention."
        : "All live checks are currently aligned.",
      tone: snapshot.degraded ? "warning" : "positive",
    },
    {
      id: "ops-health-governance",
      label: "Governance reads",
      value: formatCount(governance.healthy, governance.total),
      detail: "Governor and voting-power readability before queueing proposals.",
      tone: toneForRatio(governance.healthy, governance.total),
    },
    {
      id: "ops-health-reserve",
      label: "Reserve posture",
      value: `${snapshot.coverageVaultFormatted} / ${snapshot.coverageFundFormatted}`,
      detail: "Manager reserve and community reserve values visible on-chain.",
      tone: toneForRatio(reserve.healthy, reserve.total),
    },
  ];
}

function buildOpsRoutingSignals(
  snapshot: OpsWorkspaceSnapshot,
): OperatorWorkspaceSignal[] {
  const adapters = countHealthyRows(snapshot.rows, (row) =>
    row.id.endsWith("-adapter"),
  );
  const balancedTone: OperatorWorkspaceTone =
    snapshot.balancedSupportStatus === "ready" &&
    snapshot.balancedModulePromoted
      ? "positive"
      : snapshot.balancedSupportStatus === "blocked"
        ? "critical"
        : "warning";

  return [
    {
      id: "ops-routing-adapters",
      label: "Adapter alignment",
      value: snapshot.adapterSummary,
      detail: `${formatCount(adapters.healthy, adapters.total)} adapter routes match their expected target.`,
      tone: toneForRatio(adapters.healthy, adapters.total),
    },
    {
      id: "ops-routing-balanced",
      label: "Balanced module",
      value: snapshot.balancedModulePromoted ? "Promoted" : "Pending",
      detail: `Support ${snapshot.balancedSupportStatus}; lane ${snapshot.balancedLaneMode}.`,
      tone: balancedTone,
    },
    {
      id: "ops-routing-thresholds",
      label: "Tier policy",
      value: snapshot.thresholdSummary,
      detail: "Manager-tier thresholds remain attached to routing/operator policy.",
      tone: snapshot.thresholdSummary === "n/a" ? "warning" : "neutral",
    },
  ];
}

function buildOpsRunbookSignals(
  snapshot: OpsWorkspaceSnapshot,
): OperatorWorkspaceSignal[] {
  return [
    {
      id: "ops-runbook-refresh",
      label: "Refresh lane",
      value: snapshot.loading ? "Refreshing" : "Ready",
      detail: snapshot.error || "Live reads can be retried before sensitive changes.",
      tone: snapshot.error ? "warning" : snapshot.loading ? "neutral" : "positive",
    },
    {
      id: "ops-runbook-governance",
      label: "Governance baseline",
      value: snapshot.degraded ? "Recheck" : "Live",
      detail:
        "Confirm governor and voting reads before time-sensitive proposals or executor actions.",
      tone: snapshot.degraded ? "warning" : "positive",
    },
    {
      id: "ops-runbook-routing",
      label: "Routing lane",
      value: snapshot.adapterSummary,
      detail:
        "Protocol routes should be aligned before using AUTO or direct protocol execution.",
      tone: snapshot.degraded ? "warning" : "positive",
    },
  ];
}

export function buildOpsWorkspaceState(
  snapshot: OpsWorkspaceSnapshot,
  workspace: OpsWorkspaceId,
): OperatorWorkspaceState<OpsWorkspaceId> {
  const tab = getOpsWorkspaceTab(workspace);
  const signals =
    workspace === "routing"
      ? buildOpsRoutingSignals(snapshot)
      : workspace === "runbook"
        ? buildOpsRunbookSignals(snapshot)
        : buildOpsHealthSignals(snapshot);

  return { tab, signals };
}

function buildTierScorecardSignals(
  snapshot: TierWorkspaceSnapshot,
): OperatorWorkspaceSignal[] {
  return [
    {
      id: "tier-score-wallet",
      label: "Wallet",
      value: snapshot.walletConnected ? "Connected" : "Missing",
      detail: snapshot.walletConnected
        ? "Signer context is ready for tier inspection."
        : "Connect a wallet to resolve the governed update lane.",
      tone: snapshot.walletConnected ? "positive" : "warning",
    },
    {
      id: "tier-score-current",
      label: "Current tier",
      value: snapshot.label,
      detail: snapshot.progressDetail,
      tone: snapshot.label === "Unranked" ? "warning" : "positive",
    },
    {
      id: "tier-score-target",
      label: "Target manager",
      value: snapshot.targetLabel,
      detail: snapshot.nextStep,
      tone: "neutral",
    },
  ];
}

function buildTierLadderSignals(
  snapshot: TierWorkspaceSnapshot,
): OperatorWorkspaceSignal[] {
  const unlockedCount = snapshot.stageRows.filter((row) => row.met).length;
  return [
    {
      id: "tier-ladder-thresholds",
      label: "Threshold ladder",
      value: snapshot.thresholdsLabel,
      detail: "Live floors read from the manager-tier contract.",
      tone: snapshot.thresholdsLabel === "n/a" ? "warning" : "neutral",
    },
    {
      id: "tier-ladder-unlocked",
      label: "Unlocked tiers",
      value: `${unlockedCount}/${snapshot.stageRows.length}`,
      detail: "Current score compared against each configured tier floor.",
      tone: unlockedCount > 0 ? "positive" : "warning",
    },
    {
      id: "tier-ladder-next",
      label: "Next milestone",
      value: snapshot.nextStep,
      detail: "Next threshold the selected manager must reach.",
      tone: "neutral",
    },
  ];
}

function buildTierUpdateSignals(
  snapshot: TierWorkspaceSnapshot,
): OperatorWorkspaceSignal[] {
  const parsedDelta = Number(snapshot.deltaLabel);
  const validDelta = Number.isFinite(parsedDelta) && parsedDelta > 0;
  return [
    {
      id: "tier-update-signer",
      label: "Signer lane",
      value: snapshot.canAct ? "Ready" : "Blocked",
      detail: snapshot.canAct
        ? "Wallet, target and delta are ready for contract submission."
        : "Connect wallet and provide a manager target before submitting.",
      tone: snapshot.canAct ? "positive" : "warning",
    },
    {
      id: "tier-update-delta",
      label: "Points delta",
      value: snapshot.deltaLabel || "0",
      detail: validDelta
        ? "Delta has a valid positive numeric shape."
        : "Delta must be a positive numeric value.",
      tone: validDelta ? "neutral" : "warning",
    },
    {
      id: "tier-update-status",
      label: "Submission state",
      value: snapshot.status || (snapshot.error ? "Error" : "Idle"),
      detail:
        snapshot.error ||
        "The manager-tier contract remains the authority for final authorization.",
      tone: snapshot.error ? "critical" : snapshot.status ? "positive" : "neutral",
    },
  ];
}

export function buildTierWorkspaceState(
  snapshot: TierWorkspaceSnapshot,
  workspace: TierWorkspaceId,
): OperatorWorkspaceState<TierWorkspaceId> {
  const tab = getTierWorkspaceTab(workspace);
  const signals =
    workspace === "ladder"
      ? buildTierLadderSignals(snapshot)
      : workspace === "update"
        ? buildTierUpdateSignals(snapshot)
        : buildTierScorecardSignals(snapshot);

  return { tab, signals };
}

function buildSettingsConfigurationSignals(
  snapshot: SettingsWorkspaceSnapshot,
): OperatorWorkspaceSignal[] {
  return [
    {
      id: "settings-config-rpc",
      label: "RPC lane",
      value: snapshot.rpcConfigured ? "Configured" : "Missing",
      detail: snapshot.rpcConfigured
        ? "Soroban RPC is available for live reads and transaction preparation."
        : "No Soroban RPC URL is exported to the current runtime.",
      tone: snapshot.rpcConfigured ? "positive" : "warning",
    },
    {
      id: "settings-config-map",
      label: "Config map",
      value: `${snapshot.groupCount} sections`,
      detail: `${snapshot.configuredValueCount} runtime values grouped into operator-readable decks.`,
      tone: snapshot.groupCount > 0 ? "positive" : "warning",
    },
    {
      id: "settings-config-balanced",
      label: "Balanced lane",
      value: snapshot.balancedSupportStatus,
      detail: `Lane ${snapshot.balancedLaneMode}; module ${snapshot.balancedModuleStatus}.`,
      tone:
        snapshot.balancedSupportStatus === "ready"
          ? "positive"
          : snapshot.balancedSupportStatus === "blocked"
            ? "critical"
            : "warning",
    },
  ];
}

function buildSettingsGuardrailSignals(
  snapshot: SettingsWorkspaceSnapshot,
): OperatorWorkspaceSignal[] {
  return [
    {
      id: "settings-guardrail-profile",
      label: "Active profile",
      value: snapshot.guardrailProfile,
      detail:
        "This profile is the rebalance guardrail profile consumed by execution surfaces.",
      tone: "neutral",
    },
    {
      id: "settings-guardrail-default",
      label: "Default slippage",
      value: `${snapshot.defaultSlippagePct}%`,
      detail: "Primary rebalance envelope before route re-evaluation.",
      tone: "positive",
    },
    {
      id: "settings-guardrail-max",
      label: "Max slippage",
      value: `${snapshot.maxSlippagePct}%`,
      detail: "Hard ceiling that blocks excessive price impact/slippage.",
      tone: "warning",
    },
  ];
}

function buildSettingsRawSignals(
  snapshot: SettingsWorkspaceSnapshot,
): OperatorWorkspaceSignal[] {
  return [
    {
      id: "settings-raw-values",
      label: "Exported values",
      value: String(snapshot.rawValueCount),
      detail: "Environment values currently available for advanced review.",
      tone: snapshot.rawValueCount > 0 ? "positive" : "warning",
    },
    {
      id: "settings-raw-scope",
      label: "Scope",
      value: "Advanced",
      detail: "Raw config is intentionally kept in the operator shell, not public product UI.",
      tone: "neutral",
    },
    {
      id: "settings-raw-truth",
      label: "Truth source",
      value: "Runtime env",
      detail: "Values are rendered from the active runtime exports, not static presentation copy.",
      tone: "positive",
    },
  ];
}

export function buildSettingsWorkspaceState(
  snapshot: SettingsWorkspaceSnapshot,
  workspace: SettingsWorkspaceId,
): OperatorWorkspaceState<SettingsWorkspaceId> {
  const tab = getSettingsWorkspaceTab(workspace);
  const signals =
    workspace === "guardrails"
      ? buildSettingsGuardrailSignals(snapshot)
      : workspace === "raw"
        ? buildSettingsRawSignals(snapshot)
        : buildSettingsConfigurationSignals(snapshot);

  return { tab, signals };
}

function migrationToneForInspection(
  inspectionMode: MigrationWorkspaceSnapshot["inspectionMode"],
): OperatorWorkspaceTone {
  if (inspectionMode === "live") return "positive";
  if (inspectionMode === "loading") return "neutral";
  if (inspectionMode === "stale") return "warning";
  return "critical";
}

function buildMigrationPlanSignals(
  snapshot: MigrationWorkspaceSnapshot,
): OperatorWorkspaceSignal[] {
  return [
    {
      id: "migration-plan-inspection",
      label: "Inspection",
      value: snapshot.loading ? "Refreshing" : snapshot.inspectionMode,
      detail:
        snapshot.error ||
        snapshot.status ||
        "Factory migration state is read from the current runtime API.",
      tone: migrationToneForInspection(snapshot.inspectionMode),
    },
    {
      id: "migration-plan-preflight",
      label: "Preflight",
      value: `${snapshot.preflightReadyCount}/${snapshot.preflightTotalCount}`,
      detail: "Getter-backed migration preflight checks currently satisfied.",
      tone: toneForRatio(
        snapshot.preflightReadyCount,
        snapshot.preflightTotalCount,
      ),
    },
    {
      id: "migration-plan-packages",
      label: "Governed packages",
      value: `${snapshot.readyPackageCount}/${snapshot.bundleEntryCount}`,
      detail: "Ready package count in the current migration governance bundle.",
      tone: snapshot.readyPackageCount > 0 ? "positive" : "warning",
    },
  ];
}

function buildMigrationVerifySignals(
  snapshot: MigrationWorkspaceSnapshot,
): OperatorWorkspaceSignal[] {
  return [
    {
      id: "migration-verify-live",
      label: "Verification rows",
      value: String(snapshot.verificationRowCount),
      detail:
        "Rows only appear when the factory exposes a getter or the plan includes a comparable target.",
      tone: snapshot.verificationRowCount > 0 ? "positive" : "warning",
    },
    {
      id: "migration-verify-dry-run",
      label: "Dry-run rows",
      value: String(snapshot.dryRunRowCount),
      detail: "Operator dry-run rows for package admission and provable post-checks.",
      tone: snapshot.dryRunRowCount > 0 ? "positive" : "warning",
    },
    {
      id: "migration-verify-inspection",
      label: "Inspection mode",
      value: snapshot.inspectionMode,
      detail: "Verification confidence follows the current inspection freshness.",
      tone: migrationToneForInspection(snapshot.inspectionMode),
    },
  ];
}

function buildMigrationSimulationSignals(
  snapshot: MigrationWorkspaceSnapshot,
): OperatorWorkspaceSignal[] {
  return [
    {
      id: "migration-sim-state",
      label: "Simulation",
      value: snapshot.simulationLoading
        ? "Running"
        : snapshot.simulationEntryCount > 0
          ? "Completed"
          : "Idle",
      detail:
        snapshot.simulationError ||
        "Simulation uses the governed package set and live RPC preflight.",
      tone: snapshot.simulationError
        ? "critical"
        : snapshot.simulationEntryCount > 0
          ? "positive"
          : "neutral",
    },
    {
      id: "migration-sim-results",
      label: "Results",
      value: String(snapshot.simulationEntryCount),
      detail: "Simulation result rows currently available in this workspace.",
      tone: snapshot.simulationEntryCount > 0 ? "positive" : "neutral",
    },
    {
      id: "migration-sim-packages",
      label: "Package set",
      value: `${snapshot.readyPackageCount}/${snapshot.bundleEntryCount}`,
      detail: "Only ready governed packages are submitted to simulation.",
      tone: snapshot.readyPackageCount > 0 ? "positive" : "warning",
    },
  ];
}

function buildMigrationExportSignals(
  snapshot: MigrationWorkspaceSnapshot,
): OperatorWorkspaceSignal[] {
  return [
    {
      id: "migration-export-ready",
      label: "Export readiness",
      value: `${snapshot.readyPackageCount}/${snapshot.bundleEntryCount}`,
      detail: "Ready migration packages in the export bundle.",
      tone: snapshot.readyPackageCount > 0 ? "positive" : "warning",
    },
    {
      id: "migration-export-handoff",
      label: "Governance handoff",
      value: snapshot.readyPackageCount > 0 ? "Available" : "Blocked",
      detail: "Ready entries can queue governed composer drafts; blocked entries remain disabled.",
      tone: snapshot.readyPackageCount > 0 ? "positive" : "warning",
    },
    {
      id: "migration-export-auth",
      label: "Authority",
      value: "Governor",
      detail: "Export never bypasses governance, timelock or contract authorization.",
      tone: "neutral",
    },
  ];
}

export function buildMigrationWorkspaceState(
  snapshot: MigrationWorkspaceSnapshot,
  workspace: MigrationWorkspaceId,
): OperatorWorkspaceState<MigrationWorkspaceId> {
  const tab = getMigrationWorkspaceTab(workspace);
  const signals =
    workspace === "verify"
      ? buildMigrationVerifySignals(snapshot)
      : workspace === "simulate"
        ? buildMigrationSimulationSignals(snapshot)
        : workspace === "export"
          ? buildMigrationExportSignals(snapshot)
          : buildMigrationPlanSignals(snapshot);

  return { tab, signals };
}
