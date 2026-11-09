import { describe, expect, it } from "vitest";
import {
  buildMigrationWorkspaceState,
  buildOpsWorkspaceState,
  buildSettingsWorkspaceState,
  buildTierWorkspaceState,
  MIGRATION_WORKSPACE_TABS,
  OPS_WORKSPACE_TABS,
  resolveOpsWorkspaceId,
  resolveMigrationWorkspaceId,
  resolveSettingsWorkspaceId,
  resolveTierWorkspaceId,
  SETTINGS_WORKSPACE_TABS,
  TIER_WORKSPACE_TABS,
  type MigrationWorkspaceSnapshot,
  type OpsWorkspaceSnapshot,
  type SettingsWorkspaceSnapshot,
  type TierWorkspaceSnapshot,
} from "@/lib/workflows/operatorWorkspaces";

const OPS_SNAPSHOT: OpsWorkspaceSnapshot = {
  rows: [
    {
      id: "governor",
      label: "Governor readability",
      status: "OK",
      detail: "Governance state is readable.",
      contract: "CGOV",
      healthy: true,
    },
    {
      id: "votes",
      label: "Voting power readability",
      status: "OK",
      detail: "Voting state is readable.",
      contract: "CVOTES",
      healthy: true,
    },
    {
      id: "coverage-vault",
      label: "Coverage Vault reserve",
      status: "Funded",
      detail: "Reserve is visible.",
      contract: "CCOVERAGE",
      healthy: true,
    },
    {
      id: "coverage-fund",
      label: "Coverage Fund stake",
      status: "Active",
      detail: "Community reserve is visible.",
      contract: "CFUND",
      healthy: true,
    },
    {
      id: "balanced-adapter",
      label: "Balanced adapter route",
      status: "Blocked",
      detail: "Canonical lane is blocked.",
      contract: "CBALANCED",
      healthy: false,
    },
    {
      id: "aquarius-adapter",
      label: "Aquarius adapter route",
      status: "OK",
      detail: "Adapter resolves correctly.",
      contract: "CAQUARIUS",
      healthy: true,
    },
    {
      id: "soroswap-adapter",
      label: "SoroSwap adapter route",
      status: "OK",
      detail: "Adapter resolves correctly.",
      contract: "CSOROSWAP",
      healthy: true,
    },
    {
      id: "blend-adapter",
      label: "Blend adapter route",
      status: "OK",
      detail: "Adapter resolves correctly.",
      contract: "CBLEND",
      healthy: true,
    },
  ],
  healthyCount: 7,
  totalChecks: 8,
  degraded: true,
  thresholdSummary: "100 / 500 / 1000",
  coverageVaultFormatted: "2.5000",
  coverageFundFormatted: "8.7000",
  adapterSummary: "Route mismatch detected",
  balancedModulePromoted: false,
  balancedSupportStatus: "blocked",
  balancedLaneMode: "legacy_comet",
  loading: false,
  error: "",
};

const TIER_SNAPSHOT: TierWorkspaceSnapshot = {
  label: "Tier 2",
  walletConnected: true,
  targetLabel: "GMANAGE…RSTUV",
  thresholdsLabel: "100 / 500 / 1000",
  nextStep: "Tier 3 at 1000 pts",
  progressDetail: "620 points tracked for the current manager target.",
  stageRows: [
    { id: "tier-1", label: "Tier 1", floor: "100 pts", state: "Unlocked", met: true },
    { id: "tier-2", label: "Tier 2", floor: "500 pts", state: "Unlocked", met: true },
    { id: "tier-3", label: "Tier 3", floor: "1000 pts", state: "Pending", met: false },
  ],
  canAct: true,
  deltaLabel: "100",
  status: "",
  error: "",
};

const SETTINGS_SNAPSHOT: SettingsWorkspaceSnapshot = {
  rpcConfigured: true,
  groupCount: 3,
  configuredValueCount: 21,
  guardrailProfile: "standard",
  defaultSlippagePct: "1",
  maxSlippagePct: "10",
  balancedSupportStatus: "blocked",
  balancedLaneMode: "undeclared",
  balancedModuleStatus: "pending",
  rawValueCount: 21,
};

const MIGRATION_SNAPSHOT: MigrationWorkspaceSnapshot = {
  inspectionMode: "live",
  loading: false,
  preflightReadyCount: 4,
  preflightTotalCount: 5,
  verificationRowCount: 2,
  dryRunRowCount: 4,
  readyPackageCount: 2,
  bundleEntryCount: 3,
  simulationEntryCount: 0,
  simulationLoading: false,
  simulationError: "",
  status: "Migration inspection refreshed.",
  error: "",
};

describe("operator workspaces", () => {
  it("defines non-placeholder operator workspace tabs", () => {
    const allCopy = [
      ...OPS_WORKSPACE_TABS,
      ...TIER_WORKSPACE_TABS,
      ...SETTINGS_WORKSPACE_TABS,
      ...MIGRATION_WORKSPACE_TABS,
    ]
      .flatMap((tab) => [tab.label, tab.eyebrow, tab.description])
      .join(" ");

    expect(resolveOpsWorkspaceId("routing")).toBe("routing");
    expect(resolveOpsWorkspaceId("unknown")).toBe("health");
    expect(resolveTierWorkspaceId("update")).toBe("update");
    expect(resolveTierWorkspaceId("unknown")).toBe("scorecard");
    expect(resolveSettingsWorkspaceId("guardrails")).toBe("guardrails");
    expect(resolveSettingsWorkspaceId("unknown")).toBe("configuration");
    expect(resolveMigrationWorkspaceId("simulate")).toBe("simulate");
    expect(resolveMigrationWorkspaceId("unknown")).toBe("plan");
    expect(allCopy).not.toMatch(/\b(fake|stub|skeleton|placeholder|todo)\b/i);
  });

  it("derives ops health, routing and runbook signals from live summary inputs", () => {
    const health = buildOpsWorkspaceState(OPS_SNAPSHOT, "health");
    const routing = buildOpsWorkspaceState(OPS_SNAPSHOT, "routing");
    const runbook = buildOpsWorkspaceState(OPS_SNAPSHOT, "runbook");

    expect(health.tab.label).toBe("Health");
    expect(health.signals.map((signal) => signal.id)).toEqual([
      "ops-health-readiness",
      "ops-health-governance",
      "ops-health-reserve",
    ]);
    expect(health.signals[0]).toMatchObject({
      value: "7/8",
      tone: "warning",
    });

    expect(routing.signals[0]).toMatchObject({
      label: "Adapter alignment",
      value: "Route mismatch detected",
      tone: "warning",
    });
    expect(routing.signals[1]).toMatchObject({
      label: "Balanced module",
      value: "Pending",
      tone: "critical",
    });

    expect(runbook.signals[0]).toMatchObject({
      label: "Refresh lane",
      value: "Ready",
      tone: "positive",
    });
  });

  it("derives tier scorecard, ladder and update signals without inventing authority", () => {
    const scorecard = buildTierWorkspaceState(TIER_SNAPSHOT, "scorecard");
    const ladder = buildTierWorkspaceState(TIER_SNAPSHOT, "ladder");
    const update = buildTierWorkspaceState(TIER_SNAPSHOT, "update");

    expect(scorecard.signals[0]).toMatchObject({
      label: "Wallet",
      value: "Connected",
      tone: "positive",
    });
    expect(ladder.signals[1]).toMatchObject({
      label: "Unlocked tiers",
      value: "2/3",
      tone: "positive",
    });
    expect(update.signals[0]).toMatchObject({
      label: "Signer lane",
      value: "Ready",
      tone: "positive",
    });
    expect(update.signals[2].detail).toContain(
      "manager-tier contract remains the authority",
    );
  });

  it("marks invalid tier deltas as blocked by UI validation state", () => {
    const update = buildTierWorkspaceState(
      { ...TIER_SNAPSHOT, deltaLabel: "-3", canAct: false },
      "update",
    );

    expect(update.signals[0]).toMatchObject({
      value: "Blocked",
      tone: "warning",
    });
    expect(update.signals[1]).toMatchObject({
      value: "-3",
      tone: "warning",
    });
    expect(update.signals[1].detail).toMatch(/positive numeric/i);
  });

  it("derives settings workspaces from runtime configuration and guardrails", () => {
    const configuration = buildSettingsWorkspaceState(
      SETTINGS_SNAPSHOT,
      "configuration",
    );
    const guardrails = buildSettingsWorkspaceState(SETTINGS_SNAPSHOT, "guardrails");
    const raw = buildSettingsWorkspaceState(SETTINGS_SNAPSHOT, "raw");

    expect(configuration.signals[0]).toMatchObject({
      label: "RPC lane",
      value: "Configured",
      tone: "positive",
    });
    expect(configuration.signals[2]).toMatchObject({
      label: "Balanced lane",
      value: "blocked",
      tone: "critical",
    });
    expect(guardrails.signals[1]).toMatchObject({
      label: "Default slippage",
      value: "1%",
    });
    expect(raw.signals[2]).toMatchObject({
      label: "Truth source",
      value: "Runtime env",
      tone: "positive",
    });
  });

  it("derives migration plan, verification, simulation and export workspaces", () => {
    const plan = buildMigrationWorkspaceState(MIGRATION_SNAPSHOT, "plan");
    const verify = buildMigrationWorkspaceState(MIGRATION_SNAPSHOT, "verify");
    const simulate = buildMigrationWorkspaceState(
      { ...MIGRATION_SNAPSHOT, simulationEntryCount: 3 },
      "simulate",
    );
    const exportState = buildMigrationWorkspaceState(MIGRATION_SNAPSHOT, "export");

    expect(plan.signals[0]).toMatchObject({
      label: "Inspection",
      value: "live",
      tone: "positive",
    });
    expect(plan.signals[2]).toMatchObject({
      label: "Governed packages",
      value: "2/3",
      tone: "positive",
    });
    expect(verify.signals[0]).toMatchObject({
      label: "Verification rows",
      value: "2",
      tone: "positive",
    });
    expect(simulate.signals[0]).toMatchObject({
      label: "Simulation",
      value: "Completed",
      tone: "positive",
    });
    expect(
      buildMigrationWorkspaceState(
        {
          ...MIGRATION_SNAPSHOT,
          simulationError: "Migration simulation offline.",
        },
        "simulate",
      ).signals[0],
    ).toMatchObject({
      label: "Simulation",
      value: "Idle",
      detail: "Migration simulation offline.",
      tone: "critical",
    });
    expect(
      buildMigrationWorkspaceState(
        { ...MIGRATION_SNAPSHOT, simulationLoading: true },
        "simulate",
      ).signals[0],
    ).toMatchObject({
      label: "Simulation",
      value: "Running",
      tone: "neutral",
    });
    expect(exportState.signals[1]).toMatchObject({
      label: "Governance handoff",
      value: "Available",
      tone: "positive",
    });
  });
});
