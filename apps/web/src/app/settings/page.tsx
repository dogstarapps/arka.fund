"use client";

import { useEffect, useMemo, useState } from "react";
import { Panel, StatusPill, SurfaceTable } from "@/components/product/surfacePrimitives";
import {
  ADAPTER_BALANCED,
  ADAPTER_BLEND,
  AQUARIUS_ADAPTER,
  ROUTING_ASSET_A,
  ROUTING_ASSET_A_LABEL,
  ROUTING_ASSET_B,
  ROUTING_ASSET_B_LABEL,
  ARKA_FACTORY,
  ARKA_REGISTRY,
  ARKA_ROUTER,
  BALANCED_EXPECTED_ROUTER,
  BALANCED_LANE_MODE,
  BALANCED_SUPPORT_STATUS,
  DEFAULT_REBALANCE_SLIPPAGE_PCT,
  MAX_REBALANCE_SLIPPAGE_PCT,
  NETWORK_PASSPHRASE,
  SUSHI_ADAPTER,
  SUSHI_POOL_ID,
  SUSHI_POOL_ROUTING_PAIR,
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
  REBALANCE_SLIPPAGE_PROFILE,
  SOROBAN_RPC_URL,
  SOROSWAP_ADAPTER,
} from "@/lib/config";
import {
  buildGuardrailRows,
  buildGuardrailSourceRows,
  buildGuardrailSourceSummary,
  buildSettingsControlSignals,
  buildSettingsGroups,
  buildSettingsRows,
  buildSettingsSpotlights,
} from "@/lib/workflows/controlSurfaces";
import {
  buildSettingsWorkspaceState,
  SETTINGS_WORKSPACE_TABS,
  type SettingsWorkspaceId,
} from "@/lib/workflows/operatorWorkspaces";
import { readAppHealthSnapshot } from "@/lib/runtime/appHealth";

export default function SettingsPage() {
  const [env, setEnv] = useState<Record<string, string>>({});
  const [activeWorkspace, setActiveWorkspace] =
    useState<SettingsWorkspaceId>("configuration");

  useEffect(() => {
    setEnv({
      NETWORK_PASSPHRASE,
      SOROBAN_RPC_URL,
      ARKA_FACTORY,
      ARKA_REGISTRY,
      ARKA_ROUTER,
      ADAPTER_BALANCED,
      BALANCED_EXPECTED_ROUTER,
      BALANCED_SUPPORT_STATUS,
      BALANCED_LANE_MODE,
      BALANCED_VALIDATED_MODULE: "pending",
      BALANCED_VALIDATED_ROUTER: "",
      BALANCED_VALIDATED_AT: "",
      AQUARIUS_ADAPTER,
      SOROSWAP_ADAPTER,
      SUSHI_ADAPTER,
      SUSHI_POOL_ID: String(SUSHI_POOL_ID),
      SUSHI_POOL_ROUTING_PAIR,
      ADAPTER_BLEND,
      ROUTING_ASSET_A,
      ROUTING_ASSET_B,
      ROUTING_ASSET_A_LABEL,
      ROUTING_ASSET_B_LABEL,
      REBALANCE_SLIPPAGE_PROFILE,
      DEFAULT_REBALANCE_SLIPPAGE_PCT: String(DEFAULT_REBALANCE_SLIPPAGE_PCT),
      MAX_REBALANCE_SLIPPAGE_PCT: String(MAX_REBALANCE_SLIPPAGE_PCT),
      REBALANCE_EXTRA_BUFFER_PCT: String(REBALANCE_EXTRA_BUFFER_PCT),
      REBALANCE_FALLBACK_EXTRA_PCT: String(REBALANCE_FALLBACK_EXTRA_PCT),
      REBALANCE_MAX_NOTIONAL_PER_SWAP_BASE: String(
        REBALANCE_MAX_NOTIONAL_PER_SWAP_BASE,
      ),
      REBALANCE_MAX_PATH_LENGTH: String(REBALANCE_MAX_PATH_LENGTH),
      REBALANCE_FORBID_ROUTE_CYCLES: String(REBALANCE_FORBID_ROUTE_CYCLES),
      REBALANCE_CHUNKING_THRESHOLD_BASE: String(
        REBALANCE_CHUNKING_THRESHOLD_BASE,
      ),
      REBALANCE_MAX_CHUNK_SIZE_BASE: String(REBALANCE_MAX_CHUNK_SIZE_BASE),
      REBALANCE_POST_TRADE_DEVIATION_BPS: String(
        REBALANCE_POST_TRADE_DEVIATION_BPS,
      ),
      REBALANCE_DAILY_TURNOVER_CAP_BPS: String(
        REBALANCE_DAILY_TURNOVER_CAP_BPS,
      ),
      REBALANCE_EMERGENCY_PAUSE_SWAP: String(REBALANCE_EMERGENCY_PAUSE_SWAP),
      REBALANCE_DISABLED_PROTOCOLS,
      REBALANCE_DISABLED_PROTOCOL_REASON,
    });
  }, []);

  useEffect(() => {
    const hydrateBalancedSupport = async (): Promise<void> => {
      const snapshot = await readAppHealthSnapshot();
      if (!snapshot?.protocols?.balanced) return;
      setEnv((current) => ({
        ...current,
        BALANCED_EXPECTED_ROUTER: snapshot.protocols.balanced.expectedRouter ?? "",
        BALANCED_SUPPORT_STATUS: snapshot.protocols.balanced.supportStatus,
        BALANCED_LANE_MODE: snapshot.protocols.balanced.laneMode,
        BALANCED_VALIDATED_MODULE: snapshot.protocols.balanced.validatedModule.present
          ? "promoted"
          : "pending",
        BALANCED_VALIDATED_ROUTER:
          snapshot.protocols.balanced.validatedModule.router ?? "",
        BALANCED_VALIDATED_AT:
          snapshot.protocols.balanced.validatedModule.validatedAt ?? "",
      }));
    };
    void hydrateBalancedSupport();
  }, []);

  const groups = useMemo(() => buildSettingsGroups(env), [env]);
  const settingsSpotlights = useMemo(
    () =>
      buildSettingsSpotlights({
        env,
        groups,
      }),
    [env, groups],
  );
  const settingsSignals = useMemo(
    () =>
      buildSettingsControlSignals({
        env,
        groups,
      }),
    [env, groups],
  );
  const guardrailRows = useMemo(
    () =>
      buildGuardrailRows({
        profile: REBALANCE_SLIPPAGE_PROFILE,
        defaultSlippagePct: DEFAULT_REBALANCE_SLIPPAGE_PCT,
        maxSlippagePct: MAX_REBALANCE_SLIPPAGE_PCT,
        primaryBufferPct: REBALANCE_EXTRA_BUFFER_PCT,
        fallbackBufferPct: REBALANCE_FALLBACK_EXTRA_PCT,
        maxNotionalPerSwapBase: REBALANCE_MAX_NOTIONAL_PER_SWAP_BASE,
        maxPathLength: REBALANCE_MAX_PATH_LENGTH,
        forbidRouteCycles: REBALANCE_FORBID_ROUTE_CYCLES,
        chunkingThresholdBase: REBALANCE_CHUNKING_THRESHOLD_BASE,
        maxChunkSizeBase: REBALANCE_MAX_CHUNK_SIZE_BASE,
        postTradeDeviationBps: REBALANCE_POST_TRADE_DEVIATION_BPS,
        dailyTurnoverCapBps: REBALANCE_DAILY_TURNOVER_CAP_BPS,
        emergencyPauseSwap: REBALANCE_EMERGENCY_PAUSE_SWAP,
        disabledProtocols: REBALANCE_DISABLED_PROTOCOLS,
      }),
    [],
  );
  const guardrailSourceRows = useMemo(() => buildGuardrailSourceRows(), []);
  const guardrailSourceSummary = useMemo(
    () => buildGuardrailSourceSummary(),
    [],
  );
  const workspaceState = useMemo(
    () =>
      buildSettingsWorkspaceState(
        {
          rpcConfigured: Boolean(env.SOROBAN_RPC_URL),
          groupCount: groups.length,
          configuredValueCount: Object.values(env).filter(
            (value) => value.length > 0,
          ).length,
          guardrailProfile: REBALANCE_SLIPPAGE_PROFILE,
          defaultSlippagePct: String(DEFAULT_REBALANCE_SLIPPAGE_PCT),
          maxSlippagePct: String(MAX_REBALANCE_SLIPPAGE_PCT),
          balancedSupportStatus: env.BALANCED_SUPPORT_STATUS || "unknown",
          balancedLaneMode: env.BALANCED_LANE_MODE || "undeclared",
          balancedModuleStatus: env.BALANCED_VALIDATED_MODULE || "pending",
          rawValueCount: Object.values(env).filter((value) => value.length > 0)
            .length,
        },
        activeWorkspace,
      ),
    [activeWorkspace, env, groups.length],
  );

  return (
    <main className="surface-stack control-room-fidelity-shell settings-fidelity-shell secondary-operator-shell-cutover settings-secondary-cutover">
      <header className="surface-stage-header">
        <span className="surface-eyebrow">Settings</span>
        <h1 className="surface-title">Settings</h1>
        <p className="surface-description">
          Inspect active network wiring, contract IDs and rebalance guardrails from the same shell that drives execution.
        </p>
      </header>

      <section
        className="operator-workspace-summary secondary-operator-summary-cutover"
        data-testid="settings-workspace-summary"
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
        aria-label="Settings workspaces"
        data-testid="settings-workspace-tabs"
      >
        {SETTINGS_WORKSPACE_TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            className={`surface-tab ${activeWorkspace === tab.id ? "surface-tab-active" : ""}`}
            aria-pressed={activeWorkspace === tab.id}
            data-testid={`settings-workspace-tab-${tab.id}`}
            onClick={() => setActiveWorkspace(tab.id)}
          >
            <span>{tab.label}</span>
            <small>{tab.eyebrow}</small>
          </button>
        ))}
      </nav>

      <section
        className="surface-grid surface-grid-two control-room-stage-grid settings-utility-grid secondary-operator-stage-cutover"
        data-testid="settings-utility-grid"
      >
        {activeWorkspace === "configuration" ? (
        <Panel
          title="Configuration map"
          subtitle="Grouped environment and contract wiring"
          testId="settings-config-panel"
          className="settings-workspace-panel settings-config-workspace-panel secondary-operator-panel-cutover"
        >
          <div className="surface-chip-wrap surface-spotlight-tabs" aria-hidden="true">
            <StatusPill label="Control deck" tone="positive" />
            <StatusPill label="Network lane" tone="neutral" />
            <StatusPill label="Contract wiring" tone="neutral" />
          </div>
          <div className="workflow-signal-grid">
            {settingsSignals.map((signal) => (
              <article
                key={signal.id}
                className="surface-signal-card workflow-signal-card"
              >
                <span className="workflow-signal-label">{signal.label}</span>
                <strong className="workflow-signal-value">{signal.value}</strong>
                <span className="workflow-signal-detail">{signal.detail}</span>
              </article>
            ))}
          </div>
          <div className="surface-spotlight-grid settings-spotlight-grid">
            {settingsSpotlights.map((item) => (
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
          <div className="surface-card-list">
            {groups.map((group) => (
              <article key={group.id} className="surface-entry-card">
                <div className="surface-entry-head">
                  <div className="surface-entry-title">{group.title}</div>
                  <StatusPill label={`${group.items.length} values`} tone="neutral" />
                </div>
                <SurfaceTable
                  columnsClassName="settings-config-table"
                  headers={["Key", "Value", "State"]}
                  testId={`settings-${group.id}-table`}
                  className="settings-config-table secondary-operator-table-cutover"
                >
                  {buildSettingsRows(group).map((row) => (
                    <div key={row.id} className="surface-table-row settings-config-table secondary-operator-row-cutover">
                      <div className="surface-table-cell surface-table-cell-stack">
                        <strong className="surface-table-cell-strong">{row.label}</strong>
                        <span className="surface-table-subtle">{row.meta}</span>
                      </div>
                      <div className="surface-table-cell surface-table-cell-stack" data-testid={`settings-${row.id}`}>
                        <strong className="surface-table-cell-strong ops-mono">{row.value}</strong>
                      </div>
                      <div className="surface-table-cell">
                        <span className="surface-table-hint">{row.state}</span>
                      </div>
                    </div>
                  ))}
                </SurfaceTable>
              </article>
            ))}
          </div>
        </Panel>
        ) : null}

        {activeWorkspace === "guardrails" ? (
        <Panel
          title="Rebalance guardrails"
          subtitle="Operational posture for live routing with explicit source-of-truth boundaries"
          testId="settings-guardrails-panel"
          className="settings-workspace-panel settings-guardrails-workspace-panel secondary-operator-panel-cutover"
        >
          <div className="surface-chip-wrap">
            <StatusPill label="Guardrails" tone="positive" />
            <StatusPill label={REBALANCE_SLIPPAGE_PROFILE} tone="neutral" />
            <StatusPill label="Runtime sourced" tone="warning" />
            <StatusPill label="DAO storage pending" tone="warning" />
          </div>
          <div
            className="workflow-signal-grid"
            data-testid="settings-guardrail-source-summary"
          >
            {guardrailSourceSummary.map((signal) => (
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
          <SurfaceTable
            columnsClassName="settings-guardrails-table"
            headers={["Guardrail", "Value", "State"]}
            testId="settings-guardrails-table"
            className="settings-guardrails-table secondary-operator-table-cutover"
          >
            {guardrailRows.map((row) => (
              <div key={row.id} className="surface-table-row settings-guardrails-table secondary-operator-row-cutover">
                <div className="surface-table-cell surface-table-cell-stack">
                  <strong className="surface-table-cell-strong">{row.label}</strong>
                  <span className="surface-table-subtle">{row.meta}</span>
                  <span className="surface-table-hint">
                    Source: {row.sourceLabel} · {row.governanceLabel}
                  </span>
                </div>
                <div className="surface-table-cell surface-table-cell-stack">
                  <strong className="surface-table-cell-strong">{row.value}</strong>
                  {row.id === "default-path" ? (
                    <span className="surface-table-subtle">micro_liquidity stays validation-only on testnet.</span>
                  ) : null}
                  <span className="surface-table-hint">
                    Evaluation: {row.evaluationLabel}
                  </span>
                </div>
                <div className="surface-table-cell">
                  <span className="surface-table-hint">{row.state}</span>
                  <span className="surface-table-subtle">{row.mutabilityLabel}</span>
                </div>
              </div>
            ))}
          </SurfaceTable>
          <SurfaceTable
            columnsClassName="settings-guardrails-table"
            headers={["Guardrail", "Source of truth", "DAO mutability"]}
            testId="settings-guardrail-source-table"
            className="settings-guardrails-table secondary-operator-table-cutover"
          >
            {guardrailSourceRows.map((row) => (
              <div
                key={row.id}
                className="surface-table-row settings-guardrails-table secondary-operator-row-cutover"
                data-testid={`settings-guardrail-source-${row.id}`}
              >
                <div className="surface-table-cell surface-table-cell-stack">
                  <strong className="surface-table-cell-strong">{row.label}</strong>
                  <span className="surface-table-subtle">{row.evaluationLabel}</span>
                </div>
                <div className="surface-table-cell surface-table-cell-stack">
                  <strong className="surface-table-cell-strong">{row.value}</strong>
                  <span className="surface-table-subtle">{row.meta}</span>
                </div>
                <div className="surface-table-cell surface-table-cell-stack">
                  <span className="surface-table-hint">{row.governanceLabel}</span>
                  <span className="surface-table-subtle">{row.state}</span>
                </div>
              </div>
            ))}
          </SurfaceTable>
        </Panel>
        ) : null}
      </section>

      {activeWorkspace === "raw" ? (
      <Panel
        title="Raw environment snapshot"
        subtitle="Advanced environment details; hidden by default in the product shell"
        testId="settings-raw-panel"
        className="settings-workspace-panel settings-raw-workspace-panel secondary-operator-panel-cutover secondary-operator-code-panel-cutover"
      >
        <details className="advanced-disclosure" data-testid="settings-raw-disclosure">
          <summary className="advanced-disclosure-summary">
            Show exported runtime values
          </summary>
          <pre className="surface-code-block">{JSON.stringify(env, null, 2)}</pre>
        </details>
      </Panel>
      ) : null}
    </main>
  );
}
