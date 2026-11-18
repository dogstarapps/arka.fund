"use client";

import { useEffect, useMemo, useState } from "react";
import { Panel, StatusPill, SurfaceTable } from "@/components/product/surfacePrimitives";
import {
  ADAPTER_BALANCED,
  AQUARIUS_ADAPTER,
  AQUARIUS_ROUTER,
  ADAPTER_BLEND,
  BALANCED_EXPECTED_ROUTER,
  BALANCED_LANE_MODE,
  BALANCED_SUPPORT_STATUS,
  COVERAGE_FUND,
  COVERAGE_VAULT,
  BLEND_POOL_REAL,
  GOVERNOR_ID,
  MANAGER_TIER,
  SOROSWAP_ADAPTER,
  SOROSWAP_ROUTER,
  VOTES_ID,
} from "@/lib/config";
import {
  isGovernorReadable,
  isVotesReadable,
  readAdapterRouter,
  readCoverageFundTotalStaked,
  readCoverageVaultBalance,
  readManagerTierThresholds,
} from "@/lib/soroban";
import { buildOpsRunbookSpotlights, buildOpsSpotlights, deriveOpsHealthSummary } from "@/lib/workflows/liveOps";
import {
  buildOpsWorkspaceState,
  OPS_WORKSPACE_TABS,
  type OpsWorkspaceId,
} from "@/lib/workflows/operatorWorkspaces";
import {
  buildBalancedFallbackPayload,
  normalizeProtocolSupportStatus,
  readAppHealthSnapshot,
  type BalancedProtocolHealthPayload,
} from "@/lib/runtime/appHealth";

type Health = {
  governorOk: boolean;
  votesOk: boolean;
  coverageVaultBalance: number | null;
  coverageFundStaked: number | null;
  tierThresholds: [number, number, number] | null;
  balancedRouter: string | null;
  aquariusRouter: string | null;
  soroswapRouter: string | null;
  blendRouter: string | null;
};

export default function OpsPage() {
  const [health, setHealth] = useState<Health | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [activeWorkspace, setActiveWorkspace] =
    useState<OpsWorkspaceId>("health");
  const [balancedSupport, setBalancedSupport] =
    useState<BalancedProtocolHealthPayload>(() =>
      buildBalancedFallbackPayload({
        adapterBalanced: ADAPTER_BALANCED,
        poolId: 1,
        supportStatus: BALANCED_SUPPORT_STATUS,
        laneMode: BALANCED_LANE_MODE,
        expectedRouter: BALANCED_EXPECTED_ROUTER || null,
      }),
    );

  const refresh = async (): Promise<void> => {
    try {
      setLoading(true);
      setError("");
      let coverageReadError: unknown = null;
      const missingCoverage = (error: unknown) => { coverageReadError = error; return null; };
      const [
        governorOk,
        votesOk,
        coverageVaultBalance,
        coverageFundStaked,
        tierThresholds,
        balancedRouter,
        aquariusRouter,
        soroswapRouter,
        blendRouter,
      ] = await Promise.all([
        isGovernorReadable(GOVERNOR_ID),
        isVotesReadable(VOTES_ID),
        COVERAGE_VAULT ? readCoverageVaultBalance(COVERAGE_VAULT).catch(missingCoverage) : Promise.resolve(null),
        readCoverageFundTotalStaked(COVERAGE_FUND).catch(missingCoverage),
        readManagerTierThresholds(MANAGER_TIER),
        readAdapterRouter(ADAPTER_BALANCED),
        readAdapterRouter(AQUARIUS_ADAPTER),
        readAdapterRouter(SOROSWAP_ADAPTER),
        readAdapterRouter(ADAPTER_BLEND),
      ]);
      setHealth({
        governorOk,
        votesOk,
        coverageVaultBalance,
        coverageFundStaked,
        tierThresholds,
        balancedRouter,
        aquariusRouter,
        soroswapRouter,
        blendRouter,
      });
      if (coverageReadError) setError(coverageReadError instanceof Error ? coverageReadError.message : 'Coverage reads could not be verified.');
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to refresh ops health");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void refresh();
  }, []);

  useEffect(() => {
    const hydrateBalancedSupport = async (): Promise<void> => {
      const snapshot = await readAppHealthSnapshot();
      if (snapshot?.protocols?.balanced) {
        setBalancedSupport(snapshot.protocols.balanced);
      }
    };
    void hydrateBalancedSupport();
  }, []);

  const summary = useMemo(
    () =>
      deriveOpsHealthSummary({
        governorOk: health?.governorOk ?? false,
        votesOk: health?.votesOk ?? false,
        coverageVaultBalance: health?.coverageVaultBalance ?? null,
        coverageFundStaked: health?.coverageFundStaked ?? null,
        tierThresholds: health?.tierThresholds ?? null,
        balancedRouter: health?.balancedRouter ?? null,
        aquariusRouter: health?.aquariusRouter ?? null,
        soroswapRouter: health?.soroswapRouter ?? null,
        blendRouter: health?.blendRouter ?? null,
        governorId: GOVERNOR_ID,
        votesId: VOTES_ID,
        coverageVaultId: COVERAGE_VAULT,
        coverageFundId: COVERAGE_FUND,
        managerTierId: MANAGER_TIER,
        balancedAdapterId: ADAPTER_BALANCED,
        aquariusAdapterId: AQUARIUS_ADAPTER,
        soroswapAdapterId: SOROSWAP_ADAPTER,
        blendAdapterId: ADAPTER_BLEND,
        expectedBalancedRouter: balancedSupport.expectedRouter,
        balancedSupportStatus: normalizeProtocolSupportStatus(
          balancedSupport.supportStatus,
        ),
        balancedLaneMode: balancedSupport.laneMode,
        expectedAquariusRouter: AQUARIUS_ROUTER,
        expectedSoroswapRouter: SOROSWAP_ROUTER,
        expectedBlendRouter: BLEND_POOL_REAL,
      }),
    [balancedSupport, health],
  );
  const spotlightItems = useMemo(() => buildOpsSpotlights(summary), [summary]);
  const cadenceItems = useMemo(() => buildOpsRunbookSpotlights(summary), [summary]);
  const routingRows = useMemo(
    () => summary.rows.filter((row) => row.id.endsWith("-adapter")),
    [summary.rows],
  );
  const workspaceState = useMemo(
    () =>
      buildOpsWorkspaceState(
        {
          rows: summary.rows,
          healthyCount: summary.healthyCount,
          totalChecks: summary.totalChecks,
          degraded: summary.degraded,
          thresholdSummary: summary.thresholdSummary,
          coverageVaultFormatted: summary.coverageVaultFormatted,
          coverageFundFormatted: summary.coverageFundFormatted,
          adapterSummary: summary.adapterSummary,
          balancedModulePromoted: balancedSupport.validatedModule.present,
          balancedSupportStatus: normalizeProtocolSupportStatus(
            balancedSupport.supportStatus,
          ),
          balancedLaneMode: balancedSupport.laneMode,
          loading,
          error,
        },
        activeWorkspace,
      ),
    [activeWorkspace, balancedSupport, error, loading, summary],
  );

  return (
    <main className="surface-stack control-room-fidelity-shell ops-fidelity-shell secondary-operator-shell-cutover ops-secondary-cutover">
      <header className="surface-stage-header">
        <span className="surface-eyebrow">Ops</span>
        <h1 className="surface-title">Operations</h1>
        <p className="surface-description">
          Track live contract readability, reserve posture and adapter wiring from one operational control room before sensitive flows.
        </p>
      </header>

      <section
        className="operator-workspace-summary secondary-operator-summary-cutover"
        data-testid="ops-workspace-summary"
      >
        <div className="operator-workspace-summary-copy">
          <span className="surface-eyebrow">{workspaceState.tab.eyebrow}</span>
          <strong>{workspaceState.tab.label}</strong>
          <p className="surface-note">{workspaceState.tab.description}</p>
        </div>
        <div className="operator-workspace-summary-grid">
          {workspaceState.signals.map((signal) => (
            <article
              key={signal.id}
              className={`surface-signal-card workflow-signal-card operator-workspace-signal operator-workspace-signal-${signal.tone}`}
            >
              <span className="workflow-signal-label">{signal.label}</span>
              <strong className="workflow-signal-value">{signal.value}</strong>
              <span className="workflow-signal-detail">{signal.detail}</span>
            </article>
          ))}
        </div>
      </section>

      <nav
        className="operator-workspace-tabs operator-workspace-tabs-three secondary-operator-tabs-cutover"
        aria-label="Operations workspaces"
        data-testid="ops-workspace-tabs"
      >
        {OPS_WORKSPACE_TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            className={`surface-tab ${activeWorkspace === tab.id ? "surface-tab-active" : ""}`}
            aria-pressed={activeWorkspace === tab.id}
            aria-controls={`ops-workspace-panel-${tab.id}`}
            data-testid={`ops-workspace-tab-${tab.id}`}
            onClick={() => setActiveWorkspace(tab.id)}
          >
            <span>{tab.label}</span>
            <small>{tab.eyebrow}</small>
          </button>
        ))}
      </nav>

      <section
        id={`ops-workspace-panel-${activeWorkspace}`}
        className="surface-grid surface-grid-two control-room-stage-grid operator-workspace-stage ops-utility-grid secondary-operator-stage-cutover"
        data-testid="ops-workspace-panel"
      >
        {activeWorkspace === "health" ? (
        <Panel
          title="Contract health"
          subtitle="Readability and router checks across the active environment"
          testId="ops-health-panel"
          className="ops-workspace-panel ops-health-workspace-panel secondary-operator-panel-cutover"
        >
          <div className="surface-chip-wrap surface-spotlight-tabs" aria-hidden="true">
            <StatusPill label="Ops deck" tone="positive" />
            <StatusPill label="Readability" tone="neutral" />
            <StatusPill label="Routing checks" tone="neutral" />
          </div>
          <div className="surface-spotlight-grid ops-spotlight-grid">
            {spotlightItems.map((item) => (
              <article key={item.id} className="surface-entry-card surface-spotlight-card">
                <div className="surface-spotlight-head">
                  <div>
                    <div className="surface-table-hint">{item.label}</div>
                    <div className="surface-spotlight-title">{item.value}</div>
                  </div>
                  <StatusPill label={item.state} tone={item.tone} />
                </div>
                <div className="surface-table-subtle">{item.meta}</div>
                <div className="surface-spotlight-strip" aria-hidden="true">
                  <span style={{ width: `${item.stripPct}%` }} />
                </div>
              </article>
            ))}
          </div>
          <SurfaceTable className="ops-health-table secondary-operator-table-cutover" columnsClassName="ops-health-table" headers={["Component", "Status", "Detail", "Contract"]}>
            {summary.rows.map((row) => (
              <div key={row.id} className="surface-table-row ops-health-table secondary-operator-row-cutover" data-testid={`ops-health-row-${row.id}`}>
                <div className="surface-table-cell surface-table-cell-stack">
                  <strong className="surface-table-cell-strong">{row.label}</strong>
                </div>
                <div className="surface-table-cell">
                  <StatusPill label={row.status} tone={row.healthy ? "positive" : "warning"} />
                </div>
                <div className="surface-table-cell surface-table-subtle">{row.detail}</div>
                <div className="surface-table-cell surface-table-subtle ops-mono">{row.contract}</div>
              </div>
            ))}
          </SurfaceTable>
        </Panel>
        ) : null}

        {activeWorkspace === "routing" ? (
        <Panel
          title="Routing wiring"
          subtitle="Adapter alignment for protocol execution surfaces"
          testId="ops-routing-panel"
          className="ops-workspace-panel ops-routing-workspace-panel secondary-operator-panel-cutover"
        >
          <div className="surface-chip-wrap">
            <StatusPill label="Routing lane" tone="positive" />
            <StatusPill label={summary.adapterSummary} tone={summary.degraded ? "warning" : "positive"} />
            <StatusPill
              label={balancedSupport.validatedModule.present ? "Balanced promoted" : "Balanced pending"}
              tone={balancedSupport.validatedModule.present ? "positive" : "warning"}
            />
          </div>
          <div className="surface-spotlight-grid ops-spotlight-grid">
            {spotlightItems
              .filter((item) => ["ops-routing", "ops-tiers"].includes(item.id))
              .map((item) => (
                <article key={item.id} className="surface-entry-card surface-spotlight-card">
                  <div className="surface-spotlight-head">
                    <div>
                      <div className="surface-table-hint">{item.label}</div>
                      <div className="surface-spotlight-title">{item.value}</div>
                    </div>
                    <StatusPill label={item.state} tone={item.tone} />
                  </div>
                  <div className="surface-table-subtle">{item.meta}</div>
                  <div className="surface-spotlight-strip" aria-hidden="true">
                    <span style={{ width: `${item.stripPct}%` }} />
                  </div>
                </article>
              ))}
          </div>
          <SurfaceTable className="ops-health-table secondary-operator-table-cutover" columnsClassName="ops-health-table" headers={["Adapter", "Status", "Detail", "Contract"]}>
            {routingRows.map((row) => (
              <div key={row.id} className="surface-table-row ops-health-table secondary-operator-row-cutover" data-testid={`ops-routing-row-${row.id}`}>
                <div className="surface-table-cell surface-table-cell-stack">
                  <strong className="surface-table-cell-strong">{row.label}</strong>
                </div>
                <div className="surface-table-cell">
                  <StatusPill label={row.status} tone={row.healthy ? "positive" : "warning"} />
                </div>
                <div className="surface-table-cell surface-table-subtle">{row.detail}</div>
                <div className="surface-table-cell surface-table-subtle ops-mono">{row.contract}</div>
              </div>
            ))}
          </SurfaceTable>
          <article className="surface-entry-card secondary-operator-card-cutover" data-testid="ops-balanced-module-signal">
            <div className="surface-entry-head">
              <div>
                <div className="surface-table-hint">Balanced module</div>
                <div className="surface-entry-title">
                  {balancedSupport.validatedModule.present ? "Promoted" : "Pending"}
                </div>
              </div>
              <StatusPill
                label={normalizeProtocolSupportStatus(balancedSupport.supportStatus)}
                tone={balancedSupport.validatedModule.present ? "positive" : "warning"}
              />
            </div>
            <p className="surface-note">
              {balancedSupport.validatedModule.present
                ? `Validated router ${balancedSupport.validatedModule.router ?? "n/a"} is already in the canonical module set.`
                : "Balanced is still waiting for canonical promotion after readiness flips to ready."}
            </p>
          </article>
        </Panel>
        ) : null}

        {activeWorkspace === "runbook" ? (
        <Panel
          title="Operator cadence"
          subtitle="What to verify before vault changes or governance actions"
          testId="ops-runbook-panel"
          className="ops-workspace-panel ops-runbook-workspace-panel secondary-operator-panel-cutover"
        >
          <div className="surface-chip-wrap">
            <StatusPill label="Runbook" tone="positive" />
            <StatusPill label={summary.degraded ? "Review routes" : "Healthy baseline"} tone={summary.degraded ? "warning" : "positive"} />
            <StatusPill label="Adapter wiring" tone="neutral" />
          </div>
          <div className="surface-spotlight-grid ops-spotlight-grid">
            {cadenceItems.map((item) => (
              <article key={item.id} className="surface-entry-card surface-spotlight-card">
                <div className="surface-spotlight-head">
                  <div>
                    <div className="surface-table-hint">{item.label}</div>
                    <div className="surface-spotlight-title">{item.value}</div>
                  </div>
                  <StatusPill label={item.state} tone={item.tone} />
                </div>
                <div className="surface-table-subtle">{item.meta}</div>
                <div className="surface-spotlight-strip" aria-hidden="true">
                  <span style={{ width: `${item.stripPct}%` }} />
                </div>
              </article>
            ))}
          </div>
          <SurfaceTable
            testId="ops-runbook-table"
            columnsClassName="ops-runbook-table"
            headers={["Check", "Current posture", "Action intent"]}
            className="ops-runbook-table secondary-operator-table-cutover"
          >
            <div className="surface-table-row ops-runbook-table secondary-operator-row-cutover">
              <div className="surface-table-cell surface-table-cell-strong">Governance baseline</div>
              <div className="surface-table-cell">
                <StatusPill label={health?.governorOk && health?.votesOk ? "Readable" : "Recheck"} tone={health?.governorOk && health?.votesOk ? "positive" : "warning"} />
              </div>
              <div className="surface-table-cell surface-table-subtle">Confirm governor and voting power reads before queueing time-sensitive proposals or contract actions.</div>
            </div>
            <div className="surface-table-row ops-runbook-table secondary-operator-row-cutover">
              <div className="surface-table-cell surface-table-cell-strong">Coverage posture</div>
              <div className="surface-table-cell">
                <StatusPill label={summary.coverageFundFormatted !== "0.0000" ? "Reserve active" : "Thin reserve"} tone={summary.coverageFundFormatted !== "0.0000" ? "positive" : "warning"} />
              </div>
              <div className="surface-table-cell surface-table-subtle">Check manager lock and community reserve before running flows that increase protocol exposure.</div>
            </div>
            <div className="surface-table-row ops-runbook-table secondary-operator-row-cutover">
              <div className="surface-table-cell surface-table-cell-strong">Adapter wiring</div>
              <div className="surface-table-cell">
                <StatusPill label={summary.adapterSummary} tone={summary.degraded ? "warning" : "positive"} />
              </div>
              <div className="surface-table-cell surface-table-subtle">Balanced, Aquarius, SoroSwap and Blend routes should match the expected router or pool targets before live routing is used.</div>
            </div>
          </SurfaceTable>
          <div className="ops-action-row secondary-operator-actions-cutover">
            <button type="button" onClick={() => void refresh()} className="surface-button surface-button-primary" data-testid="ops-refresh-button">
              Refresh health checks
            </button>
            {loading ? <div className="ops-status">Refreshing live reads…</div> : null}
            {error ? <div className="ops-status ops-status-error" data-testid="ops-error">{error}</div> : null}
          </div>
        </Panel>
        ) : null}
      </section>
    </main>
  );
}
