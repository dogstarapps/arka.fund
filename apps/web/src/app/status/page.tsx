"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  Panel,
  StatusPill,
  SurfaceTable,
} from "@/components/product/surfacePrimitives";
import {
  ROUTING_ASSET_A_LABEL,
  ROUTING_ASSET_B_LABEL,
  NETWORK_PASSPHRASE,
  REBALANCE_SLIPPAGE_PROFILE,
} from "@/lib/config";
import {
  STATUS_LIMITATIONS,
  STATUS_REFERENCE_LINKS,
  buildStatusRoutingRows,
  STATUS_SCOPE_ITEMS,
  buildStatusOracleRows,
  buildStatusOperatorSteps,
  buildStatusControlSignals,
  buildStatusRows,
  buildStatusSpotlights,
} from "@/lib/workflows/controlSurfaces";
import {
  type AppHealthPayload,
  readAppHealthSnapshot,
} from "@/lib/runtime/appHealth";
import {
  readRebalanceBenchmarkSnapshot,
  type RebalanceBenchmarkResponse,
} from "@/lib/runtime/rebalanceBenchmarkApi";
import {
  buildStatusWorkspaceState,
  STATUS_WORKSPACE_TABS,
  type StatusWorkspaceId,
  type StatusWorkspaceSnapshot,
} from "@/lib/workflows/statusWorkspaces";

function formatNetworkLiveLabel(networkPassphrase: string): string {
  const normalized = networkPassphrase.trim().toLowerCase();
  if (normalized.includes("public global stellar network"))
    return "Mainnet live";
  if (normalized.includes("test sdf network")) return "Testnet live";
  return "Custom network";
}

export default function StatusPage() {
  const [activeWorkspace, setActiveWorkspace] =
    useState<StatusWorkspaceId>("baseline");
  const [healthSnapshot, setHealthSnapshot] = useState<AppHealthPayload | null>(
    null,
  );
  const [healthError, setHealthError] = useState("");
  const [oracleLoading, setOracleLoading] = useState(true);
  const [routingBenchmark, setRoutingBenchmark] =
    useState<RebalanceBenchmarkResponse | null>(null);
  const [routingBenchmarkError, setRoutingBenchmarkError] = useState("");
  const [routingBenchmarkLoading, setRoutingBenchmarkLoading] = useState(false);

  useEffect(() => {
    let active = true;

    const run = async () => {
      setOracleLoading(true);
      setHealthError("");
      const snapshot = await readAppHealthSnapshot();
      if (!active) return;
      setHealthSnapshot(snapshot);
      setHealthError(
        snapshot
          ? ""
          : "Runtime health API is unavailable. Local fallback rows remain visible until retry succeeds.",
      );
      setOracleLoading(false);
    };

    void run();
    return () => {
      active = false;
    };
  }, []);

  const refreshHealth = async (): Promise<void> => {
    setOracleLoading(true);
    setHealthError("");
    const snapshot = await readAppHealthSnapshot();
    setHealthSnapshot(snapshot);
    setHealthError(
      snapshot
        ? ""
        : "Runtime health API is unavailable. Local fallback rows remain visible until retry succeeds.",
    );
    setOracleLoading(false);
  };

  const refreshRoutingBenchmark = async (): Promise<void> => {
    setRoutingBenchmarkLoading(true);
    setRoutingBenchmarkError("");
    try {
      const snapshot = await readRebalanceBenchmarkSnapshot();
      setRoutingBenchmark(snapshot);
    } catch (error) {
      setRoutingBenchmark(null);
      setRoutingBenchmarkError(
        error instanceof Error
          ? error.message
          : "Routing benchmark snapshot is unavailable.",
      );
    } finally {
      setRoutingBenchmarkLoading(false);
    }
  };

  useEffect(() => {
    if (
      activeWorkspace !== "routing" ||
      routingBenchmark ||
      routingBenchmarkError
    ) {
      return;
    }

    let active = true;
    const run = async () => {
      setRoutingBenchmarkLoading(true);
      setRoutingBenchmarkError("");
      try {
        const snapshot = await readRebalanceBenchmarkSnapshot();
        if (!active) return;
        setRoutingBenchmark(snapshot);
      } catch (error) {
        if (!active) return;
        setRoutingBenchmark(null);
        setRoutingBenchmarkError(
          error instanceof Error
            ? error.message
            : "Routing benchmark snapshot is unavailable.",
        );
      } finally {
        if (active) setRoutingBenchmarkLoading(false);
      }
    };

    void run();
    return () => {
      active = false;
    };
  }, [activeWorkspace, routingBenchmark, routingBenchmarkError]);

  const networkLiveLabel = formatNetworkLiveLabel(NETWORK_PASSPHRASE);
  const statusOperatorSteps = buildStatusOperatorSteps(networkLiveLabel, [
    ROUTING_ASSET_A_LABEL,
    ROUTING_ASSET_B_LABEL,
  ]);
  const baselineRows = buildStatusRows(STATUS_SCOPE_ITEMS, {
    prefix: "Scope",
    state: networkLiveLabel,
    valueLabel: "Validated scope",
  });
  const operatorRows = buildStatusRows(statusOperatorSteps, {
    prefix: "Step",
    state: "Required",
    valueLabel: "Operator check",
  });
  const limitationRows = buildStatusRows(STATUS_LIMITATIONS, {
    prefix: "Watch",
    state: "Monitor closely",
    valueLabel: "Known limit",
  });
  const statusSpotlights = buildStatusSpotlights({
    scopeCount: STATUS_SCOPE_ITEMS.length,
    operatorCount: statusOperatorSteps.length,
    limitationCount: STATUS_LIMITATIONS.length,
    referenceCount: STATUS_REFERENCE_LINKS.length,
    profile: REBALANCE_SLIPPAGE_PROFILE,
  });
  const statusSignals = buildStatusControlSignals({
    scopeCount: STATUS_SCOPE_ITEMS.length,
    operatorCount: statusOperatorSteps.length,
    limitationCount: STATUS_LIMITATIONS.length,
    referenceCount: STATUS_REFERENCE_LINKS.length,
    profile: REBALANCE_SLIPPAGE_PROFILE,
  });
  const oracleRows = buildStatusOracleRows(healthSnapshot);
  const routingRows = buildStatusRoutingRows(healthSnapshot);
  const oracleGateRow =
    oracleRows.find((row) => row.id === "oracle-cutover-gate") ??
    oracleRows[oracleRows.length - 1];
  const oracleGateTone =
    oracleGateRow?.state === "Ready"
      ? "positive"
      : oracleGateRow?.state === "Blocked"
        ? "warning"
        : "neutral";
  const statusWorkspaceSnapshot = useMemo<StatusWorkspaceSnapshot>(
    () => ({
      networkLiveLabel,
      scopeCount: STATUS_SCOPE_ITEMS.length,
      operatorCount: statusOperatorSteps.length,
      limitationCount: STATUS_LIMITATIONS.length,
      referenceCount: STATUS_REFERENCE_LINKS.length,
      profile: REBALANCE_SLIPPAGE_PROFILE,
      oracleGateState: oracleGateRow?.state ?? "Unknown",
      oracleTargetNetwork:
        healthSnapshot?.oracle.deployment.targetNetwork ?? "testnet",
      oracleMode: healthSnapshot?.oracle.oracle.mode ?? "unverified",
      routingMode:
        healthSnapshot?.routing.mode ?? "backend_solver_with_local_fallback",
      routingBackendAvailable: Boolean(
        healthSnapshot?.routing.backendAvailable,
      ),
      balancedPlannerAdmission:
        healthSnapshot?.routing.balancedPlannerAdmission ?? "blocked",
    }),
    [
      healthSnapshot,
      networkLiveLabel,
      oracleGateRow?.state,
      statusOperatorSteps.length,
    ],
  );
  const statusWorkspaceState = useMemo(
    () => buildStatusWorkspaceState(statusWorkspaceSnapshot, activeWorkspace),
    [activeWorkspace, statusWorkspaceSnapshot],
  );

  return (
    <main className="surface-stack control-room-fidelity-shell status-fidelity-shell secondary-operator-shell-cutover status-secondary-cutover">
      <header className="surface-stage-header">
        <span className="surface-eyebrow">Status</span>
        <h1 className="surface-title">Status</h1>
        <p className="surface-description">
          Keep the operating baseline, routing posture and known constraints in
          one control room before running live testnet validation.
        </p>
      </header>

      <section
        className="surface-entry-card status-runtime-health-card status-command-card secondary-operator-runtime-card-cutover"
        data-testid="status-runtime-health-posture"
      >
        <div className="surface-spotlight-head">
          <div>
            <span className="surface-table-hint">Runtime health</span>
            <strong>
              {oracleLoading
                ? "Loading runtime health"
                : healthSnapshot
                  ? "Runtime health loaded"
                  : "Runtime fallback active"}
            </strong>
            <p className="surface-table-subtle">
              Status reads the canonical `/api/health` snapshot for oracle
              cutover and best-execution routing; if the API is unavailable, the
              page keeps deterministic fallback rows visible and exposes retry.
            </p>
          </div>
          <StatusPill
            label={
              oracleLoading
                ? "Loading"
                : healthSnapshot
                  ? "Live snapshot"
                  : "Fallback"
            }
            tone={oracleLoading ? "neutral" : healthSnapshot ? "positive" : "warning"}
          />
        </div>
        {healthError ? (
          <div
            className="ops-status ops-status-error"
            data-testid="status-health-error"
          >
            {healthError}
          </div>
        ) : null}
        <div className="ops-action-row secondary-operator-actions-cutover">
          <button
            type="button"
            className="surface-button surface-button-secondary"
            onClick={() => void refreshHealth()}
            disabled={oracleLoading}
            data-testid="status-health-refresh-button"
          >
            Refresh runtime health
          </button>
        </div>
      </section>

      <section
        className="workflow-signal-grid control-room-signal-grid status-stage-signal-grid secondary-operator-signal-grid-cutover"
        data-testid="status-stage-signals"
      >
        {statusSignals.map((signal) => (
          <article
            key={signal.id}
            className="surface-signal-card workflow-signal-card"
          >
            <span className="workflow-signal-label">{signal.label}</span>
            <strong className="workflow-signal-value">{signal.value}</strong>
            <span className="workflow-signal-detail">{signal.detail}</span>
          </article>
        ))}
      </section>

      <nav
        className="surface-section-tabs status-workspace-tabs secondary-operator-tabs-cutover"
        aria-label="Status sections"
        data-testid="status-workspace-tabs"
      >
        {STATUS_WORKSPACE_TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            className={`surface-tab ${
              activeWorkspace === tab.id ? "surface-tab-active" : ""
            }`}
            aria-pressed={activeWorkspace === tab.id}
            aria-controls={`status-workspace-panel-${tab.id}`}
            onClick={() => setActiveWorkspace(tab.id)}
            data-testid={`status-workspace-tab-${tab.id}`}
          >
            <span>{tab.label}</span>
            <small>{tab.eyebrow}</small>
          </button>
        ))}
      </nav>

      <section
        className="status-workspace-summary secondary-operator-summary-cutover"
        id={`status-workspace-panel-${activeWorkspace}`}
        data-testid="status-workspace-summary"
      >
        <div className="status-workspace-summary-copy">
          <span className="surface-eyebrow">
            {statusWorkspaceState.tab.eyebrow}
          </span>
          <strong>{statusWorkspaceState.tab.label}</strong>
          <p>{statusWorkspaceState.tab.description}</p>
        </div>
        <div
          className="status-workspace-summary-grid"
          data-testid="status-workspace-summary-grid"
        >
          {statusWorkspaceState.signals.map((signal) => (
            <article
              key={signal.id}
              className={`surface-signal-card workflow-signal-card status-workspace-signal status-workspace-signal-${signal.tone}`}
            >
              <span className="workflow-signal-label">{signal.label}</span>
              <strong className="workflow-signal-value">{signal.value}</strong>
              <span className="workflow-signal-detail">{signal.detail}</span>
            </article>
          ))}
        </div>
      </section>

      <section
        className="surface-grid control-room-single-column control-room-stage-grid status-utility-grid secondary-operator-stage-cutover"
        data-testid="status-utility-grid"
      >
        {activeWorkspace === "baseline" ? (
          <Panel
            id="status-baseline"
            title="Current operating baseline"
            subtitle="What is already live and validated"
            testId="status-baseline-panel"
            className="status-workspace-panel status-baseline-workspace-panel secondary-operator-panel-cutover"
          >
            <div
              className="surface-chip-wrap surface-spotlight-tabs"
              aria-hidden="true"
            >
              <StatusPill label="Baseline deck" tone="positive" />
              <StatusPill label={networkLiveLabel} tone="neutral" />
              <StatusPill label="Operator posture" tone="neutral" />
            </div>
            <div className="workflow-signal-grid">
              {statusSignals.map((signal) => (
                <article
                  key={signal.id}
                  className="surface-signal-card workflow-signal-card"
                >
                  <span className="workflow-signal-label">{signal.label}</span>
                  <strong className="workflow-signal-value">
                    {signal.value}
                  </strong>
                  <span className="workflow-signal-detail">
                    {signal.detail}
                  </span>
                </article>
              ))}
            </div>
            <div className="surface-spotlight-grid status-spotlight-grid">
              {statusSpotlights.map((item) => (
                <article
                  key={item.id}
                  className="surface-entry-card surface-spotlight-card"
                >
                  <div className="surface-spotlight-head">
                    <div>
                      <div className="surface-table-hint">{item.label}</div>
                      <div className="surface-spotlight-title">
                        {item.value}
                      </div>
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
              columnsClassName="status-baseline-table"
              headers={["Baseline", "Value", "State"]}
              testId="status-baseline-table"
              className="status-baseline-table secondary-operator-table-cutover"
            >
              {baselineRows.map((row) => (
                <div
                  key={row.id}
                  className="surface-table-row status-baseline-table secondary-operator-row-cutover"
                >
                  <div className="surface-table-cell surface-table-cell-stack">
                    <strong className="surface-table-cell-strong">
                      {row.label}
                    </strong>
                    <span className="surface-table-subtle">{row.meta}</span>
                  </div>
                  <div className="surface-table-cell">
                    <strong className="surface-table-cell-strong">
                      {row.value}
                    </strong>
                  </div>
                  <div className="surface-table-cell">
                    <StatusPill label={row.state} tone="positive" />
                  </div>
                </div>
              ))}
            </SurfaceTable>
          </Panel>
        ) : null}

        {activeWorkspace === "operator" ? (
          <Panel
            id="status-operator"
            title="Operator checklist"
            subtitle="What to verify before running live flows"
            testId="status-operator-panel"
            className="status-workspace-panel status-operator-workspace-panel secondary-operator-panel-cutover"
          >
            <div className="surface-chip-wrap">
              <StatusPill label="Runbook" tone="positive" />
              <StatusPill label={REBALANCE_SLIPPAGE_PROFILE} tone="neutral" />
              <StatusPill label="micro_liquidity opt-in" tone="warning" />
            </div>
            <SurfaceTable
              columnsClassName="status-operator-table"
              headers={["Step", "Check", "State"]}
              testId="status-operator-table"
              className="status-operator-table secondary-operator-table-cutover"
            >
              {operatorRows.map((row) => (
                <div
                  key={row.id}
                  className="surface-table-row status-operator-table secondary-operator-row-cutover"
                >
                  <div className="surface-table-cell">
                    <strong className="surface-table-cell-strong">
                      {row.label}
                    </strong>
                  </div>
                  <div className="surface-table-cell surface-table-cell-stack">
                    <strong className="surface-table-cell-strong">
                      {row.value}
                    </strong>
                    <span className="surface-table-subtle">{row.meta}</span>
                  </div>
                  <div className="surface-table-cell">
                    <StatusPill label={row.state} tone="neutral" />
                  </div>
                </div>
              ))}
            </SurfaceTable>
          </Panel>
        ) : null}

        {activeWorkspace === "oracle" ? (
          <Panel
            id="status-oracle"
            title="Oracle cutover"
            subtitle="Runtime proof for mainnet/testnet oracle readiness"
            testId="status-oracle-panel"
            className="status-workspace-panel status-oracle-workspace-panel secondary-operator-panel-cutover"
          >
            <div className="surface-chip-wrap">
              <StatusPill
                label={
                  oracleLoading
                    ? "Loading runtime snapshot"
                    : `Cutover ${oracleGateRow?.state ?? "Unknown"}`
                }
                tone={oracleGateTone}
              />
              <StatusPill
                label={
                  healthSnapshot?.oracle.deployment.targetNetwork ?? "testnet"
                }
                tone="neutral"
              />
              <StatusPill
                label={healthSnapshot?.oracle.oracle.mode ?? "unverified"}
                tone="neutral"
              />
            </div>
            <SurfaceTable
              columnsClassName="status-oracle-table"
              headers={["Signal", "Value", "State"]}
              testId="status-oracle-table"
              className="status-oracle-table secondary-operator-table-cutover"
            >
              {oracleRows.map((row) => (
                <div
                  key={row.id}
                  className="surface-table-row status-oracle-table secondary-operator-row-cutover"
                >
                  <div className="surface-table-cell">
                    <strong className="surface-table-cell-strong">
                      {row.label}
                    </strong>
                  </div>
                  <div className="surface-table-cell surface-table-cell-stack">
                    <strong className="surface-table-cell-strong">
                      {row.value}
                    </strong>
                    <span className="surface-table-subtle">{row.meta}</span>
                  </div>
                  <div className="surface-table-cell">
                    <StatusPill
                      label={row.state}
                      tone={
                        row.state === "Ready" ||
                        row.state === "Verified" ||
                        row.state === "Loaded"
                          ? "positive"
                          : row.state === "Blocked"
                            ? "warning"
                            : "neutral"
                      }
                    />
                  </div>
                </div>
              ))}
            </SurfaceTable>
          </Panel>
        ) : null}

        {activeWorkspace === "limits" ? (
          <Panel
            id="status-limits"
            title="Known limits"
            subtitle="What still needs extra care"
            testId="status-limitations-panel"
            className="status-workspace-panel status-limits-workspace-panel secondary-operator-panel-cutover"
          >
            <SurfaceTable
              columnsClassName="status-limitations-table"
              headers={["Watch item", "Limit", "State"]}
              testId="status-limitations-table"
              className="status-limitations-table secondary-operator-table-cutover"
            >
              {limitationRows.map((row) => (
                <div
                  key={row.id}
                  className="surface-table-row status-limitations-table secondary-operator-row-cutover"
                >
                  <div className="surface-table-cell">
                    <strong className="surface-table-cell-strong">
                      {row.label}
                    </strong>
                  </div>
                  <div className="surface-table-cell surface-table-cell-stack">
                    <strong className="surface-table-cell-strong">
                      {row.value}
                    </strong>
                    <span className="surface-table-subtle">{row.meta}</span>
                  </div>
                  <div className="surface-table-cell">
                    <StatusPill label={row.state} tone="warning" />
                  </div>
                </div>
              ))}
            </SurfaceTable>
          </Panel>
        ) : null}

        {activeWorkspace === "routing" ? (
          <Panel
            id="status-routing"
            title="Routing solver"
            subtitle="Backend best-execution planner posture and fallback state"
            testId="status-routing-solver-panel"
            className="status-workspace-panel status-routing-workspace-panel secondary-operator-panel-cutover"
          >
            <div className="surface-chip-wrap">
              <StatusPill
                label={
                  healthSnapshot?.routing.mode ??
                  "backend_solver_with_local_fallback"
                }
                tone="neutral"
              />
              <StatusPill
                label={
                  healthSnapshot?.routing.backendAvailable
                    ? "Backend online"
                    : "Fallback mode"
                }
                tone={
                  healthSnapshot?.routing.backendAvailable
                    ? "positive"
                    : "warning"
                }
              />
              <StatusPill
                label={`Balanced ${healthSnapshot?.routing.balancedPlannerAdmission ?? "blocked"}`}
                tone="neutral"
              />
            </div>
            <SurfaceTable
              columnsClassName="status-oracle-table"
              headers={["Signal", "Value", "State"]}
              testId="status-routing-solver-table"
              className="status-oracle-table secondary-operator-table-cutover"
            >
              {routingRows.map((row) => (
                <div
                  key={row.id}
                  className="surface-table-row status-oracle-table secondary-operator-row-cutover"
                >
                  <div className="surface-table-cell">
                    <strong className="surface-table-cell-strong">
                      {row.label}
                    </strong>
                  </div>
                  <div className="surface-table-cell surface-table-cell-stack">
                    <strong className="surface-table-cell-strong">
                      {row.value}
                    </strong>
                    <span className="surface-table-subtle">{row.meta}</span>
                  </div>
                  <div className="surface-table-cell">
                    <StatusPill
                      label={row.state}
                      tone={
                        row.state === "Ready" ||
                        row.state === "AUTO" ||
                        row.state === "Live" ||
                        row.state === "Online"
                          ? "positive"
                          : row.state === "Blocked" || row.state === "Fallback"
                            ? "warning"
                            : "neutral"
                      }
                    />
                  </div>
                </div>
              ))}
            </SurfaceTable>
            <section
              className="surface-entry-card status-routing-benchmark-card secondary-operator-card-cutover"
              data-testid="status-routing-benchmark"
            >
              <div className="surface-spotlight-head">
                <div>
                  <span className="surface-table-hint">
                    Competitive benchmark
                  </span>
                  <strong>
                    {routingBenchmarkLoading
                      ? "Running route benchmark"
                      : routingBenchmark?.benchmark.overallPassed
                        ? "Benchmark passing"
                        : routingBenchmark
                          ? "Benchmark below target"
                          : "Benchmark not loaded"}
                  </strong>
                  <p className="surface-table-subtle">
                    This is an explicit QA gate: deterministic benchmark
                    scenarios compare the bounded planner against broker-scale
                    oracle evidence for deep-path, split-allocation, fill-risk
                    and fail-closed cases. It is not product market data and
                    does not feed user metrics.
                  </p>
                </div>
                <StatusPill
                  label={
                    routingBenchmarkLoading
                      ? "Running"
                      : routingBenchmark?.benchmark.overallPassed
                        ? "Passed"
                        : routingBenchmark
                          ? "Review"
                          : "Unavailable"
                  }
                  tone={
                    routingBenchmarkLoading
                      ? "neutral"
                      : routingBenchmark?.benchmark.overallPassed
                        ? "positive"
                        : "warning"
                  }
                />
              </div>
              <div className="workflow-signal-grid">
                <article className="surface-signal-card workflow-signal-card">
                  <span className="workflow-signal-label">Worst efficiency</span>
                  <strong className="workflow-signal-value">
                    {routingBenchmark
                      ? `${(routingBenchmark.benchmark.worstEfficiencyBps / 100).toFixed(2)}%`
                      : "n/a"}
                  </strong>
                  <span className="workflow-signal-detail">
                    Planner output versus benchmark oracle.
                  </span>
                </article>
                <article className="surface-signal-card workflow-signal-card">
                  <span className="workflow-signal-label">Cases passed</span>
                  <strong className="workflow-signal-value">
                    {routingBenchmark
                      ? `${routingBenchmark.benchmark.passedCount}/${routingBenchmark.benchmark.resultCount}`
                      : "n/a"}
                  </strong>
                  <span className="workflow-signal-detail">
                    Deep route and split allocation checks.
                  </span>
                </article>
                <article className="surface-signal-card workflow-signal-card">
                  <span className="workflow-signal-label">Broker corpus</span>
                  <strong className="workflow-signal-value">
                    {routingBenchmark?.benchmark.brokerComparison
                      ? routingBenchmark.benchmark.brokerComparison.profile.replaceAll(
                          "_",
                          " ",
                        )
                      : "n/a"}
                  </strong>
                  <span className="workflow-signal-detail">
                    {routingBenchmark?.benchmark.brokerComparison
                      ? `${routingBenchmark.benchmark.brokerComparison.maxCandidateUniverseSize.toLocaleString()} max universe · ${routingBenchmark.benchmark.brokerComparison.venuesCovered.join(", ")}`
                      : "Broker profile not loaded."}
                  </span>
                </article>
                <article className="surface-signal-card workflow-signal-card">
                  <span className="workflow-signal-label">Fail-closed</span>
                  <strong className="workflow-signal-value">
                    {routingBenchmark?.benchmark.brokerComparison
                      ? `${routingBenchmark.benchmark.brokerComparison.failClosedCaseCount}/${routingBenchmark.benchmark.brokerComparison.failureCaseCount}`
                      : "n/a"}
                  </strong>
                  <span className="workflow-signal-detail">
                    Failure-mode cases must close without invented quotes.
                  </span>
                </article>
                <article className="surface-signal-card workflow-signal-card">
                  <span className="workflow-signal-label">Generated at</span>
                  <strong className="workflow-signal-value">
                    {routingBenchmark
                      ? new Date(routingBenchmark.generatedAt).toLocaleTimeString()
                      : "n/a"}
                  </strong>
                  <span className="workflow-signal-detail">
                    Snapshot from `/api/routing/rebalance/benchmark`.
                  </span>
                </article>
              </div>
              {routingBenchmarkError ? (
                <div
                  className="ops-status ops-status-error"
                  data-testid="status-routing-benchmark-error"
                >
                  {routingBenchmarkError}
                </div>
              ) : null}
              <SurfaceTable
                columnsClassName="status-routing-benchmark-table"
                headers={["Benchmark", "Planner", "Oracle"]}
                testId="status-routing-benchmark-table"
                className="status-routing-benchmark-table secondary-operator-table-cutover"
              >
                {(routingBenchmark?.benchmark.results ?? []).map((result) => (
                  <div
                    key={result.id}
                    className="surface-table-row status-routing-benchmark-table secondary-operator-row-cutover"
                  >
                    <div className="surface-table-cell surface-table-cell-stack">
                      <strong className="surface-table-cell-strong">
                        {result.label}
                      </strong>
                      <span className="surface-table-subtle">
                        {result.exhaustivePathCount.toLocaleString()} exhaustive
                        paths · {result.quotedPathCount.toLocaleString()} quoted
                        paths
                      </span>
                      <span className="surface-table-subtle">
                        {result.failureCase
                          ? `failure case · fail-closed ${result.failClosed ? "yes" : "no"}`
                          : `${(result.fillRiskModel ?? "route_score_penalty").replaceAll("_", " ")} · fill ${((result.selectedRouteFillRiskPenaltyBps ?? 0) / 100).toFixed(2)}%`}
                      </span>
                    </div>
                    <div className="surface-table-cell surface-table-cell-stack">
                      <strong className="surface-table-cell-strong">
                        {result.plannerSelectedProtocol} ·{" "}
                        {(result.plannerEfficiencyBps / 100).toFixed(2)}%
                      </strong>
                      <span className="surface-table-subtle">
                        {result.plannerSelectedPath} · split{" "}
                        {result.splitStatus}
                      </span>
                      <span className="surface-table-subtle">
                        best direct quote {result.bestRawProtocol ?? "NONE"} ·{" "}
                        {((result.selectedRawEfficiencyBps ?? 0) / 100).toFixed(2)}%
                      </span>
                    </div>
                    <div className="surface-table-cell">
                      <StatusPill
                        label={
                          result.passed
                            ? `>= ${(result.minEfficiencyBps / 100).toFixed(2)}%`
                            : "Below target"
                        }
                        tone={result.passed ? "positive" : "warning"}
                      />
                    </div>
                  </div>
                ))}
              </SurfaceTable>
              <div className="ops-action-row secondary-operator-actions-cutover">
                <button
                  type="button"
                  className="surface-button surface-button-secondary"
                  onClick={() => void refreshRoutingBenchmark()}
                  disabled={routingBenchmarkLoading}
                  data-testid="status-routing-benchmark-refresh-button"
                >
                  Refresh benchmark
                </button>
              </div>
            </section>
          </Panel>
        ) : null}

        {activeWorkspace === "links" ? (
          <Panel
            id="status-links"
            title="Reference links"
            subtitle="Primary sources for contracts and execution"
            testId="status-links-panel"
            className="status-workspace-panel status-links-workspace-panel secondary-operator-panel-cutover"
          >
            <SurfaceTable
              columnsClassName="status-links-table"
              headers={["Reference", "Purpose", "Action"]}
              testId="status-links-table"
              className="status-links-table secondary-operator-table-cutover"
            >
              {STATUS_REFERENCE_LINKS.map((link) => (
                <div
                  key={link.href}
                  className="surface-table-row status-links-table secondary-operator-row-cutover"
                >
                  <div className="surface-table-cell surface-table-cell-stack">
                    <strong className="surface-table-cell-strong">
                      {link.label}
                    </strong>
                    <span className="surface-table-subtle">
                      Primary source for contracts, IDs, scripts and protocol
                      docs.
                    </span>
                  </div>
                  <div className="surface-table-cell">
                    <StatusPill label="External" tone="neutral" />
                  </div>
                  <div className="surface-table-cell surface-table-actions">
                    <Link
                      href={link.href}
                      target="_blank"
                      rel="noreferrer"
                      className="surface-button surface-button-secondary"
                    >
                      Open repository
                    </Link>
                  </div>
                </div>
              ))}
            </SurfaceTable>
          </Panel>
        ) : null}
      </section>
    </main>
  );
}
