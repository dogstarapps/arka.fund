"use client";

import type { StellarWalletsKit } from "@creit.tech/stellar-wallets-kit";
import { useEffect, useMemo, useState } from "react";
import { Panel, StatusPill, SurfaceTable } from "@/components/product/surfacePrimitives";
import { formatContractLabel } from "@/lib/catalog/format";
import { MANAGER_TIER } from "@/lib/config";
import {
  buildManagerTierAddPoints,
  readManagerTierLevel,
  readManagerTierPoints,
  readManagerTierThresholds,
} from "@/lib/soroban";
import { signXdr, submitSignedTx, waitForTx } from "@/lib/tx";
import { buildTierActionSpotlights, buildTierSpotlights, deriveTierSummary } from "@/lib/workflows/liveOps";
import {
  buildTierWorkspaceState,
  TIER_WORKSPACE_TABS,
  type TierWorkspaceId,
} from "@/lib/workflows/operatorWorkspaces";
import {
  connectWallet,
  getWalletsKit,
} from "@/lib/walletKit";

export default function TiersPage() {
  const [walletsKit, setWalletsKit] = useState<StellarWalletsKit | null>(null);
  const [pubKey, setPubKey] = useState("");
  const [targetManager, setTargetManager] = useState("");
  const [delta, setDelta] = useState("100");

  const [myPoints, setMyPoints] = useState(0);
  const [myTier, setMyTier] = useState(0);
  const [thresholds, setThresholds] = useState<[number, number, number] | null>(null);

  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [readStatus, setReadStatus] = useState("");
  const [readError, setReadError] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const [activeWorkspace, setActiveWorkspace] =
    useState<TierWorkspaceId>("scorecard");

  const canAct = useMemo(
    () => Boolean(walletsKit && pubKey && !loading && targetManager.trim().length > 0),
    [walletsKit, pubKey, loading, targetManager],
  );

  const summary = useMemo(
    () =>
      deriveTierSummary({
        pubKey,
        targetManager,
        points: myPoints,
        tier: myTier,
        thresholds,
      }),
    [myPoints, myTier, pubKey, targetManager, thresholds],
  );
  const spotlightItems = useMemo(() => buildTierSpotlights(summary), [summary]);
  const actionSpotlights = useMemo(
    () =>
      buildTierActionSpotlights({
        walletConnected: summary.walletConnected,
        canAct,
        targetLabel: summary.targetLabel,
        deltaLabel: delta || "0",
        status,
      }),
    [canAct, delta, status, summary.targetLabel, summary.walletConnected],
  );
  const workspaceState = useMemo(
    () =>
      buildTierWorkspaceState(
        {
          label: summary.label,
          walletConnected: summary.walletConnected,
          targetLabel: summary.targetLabel,
          thresholdsLabel: summary.thresholdsLabel,
          nextStep: summary.nextStep,
          progressDetail: summary.progressDetail,
          stageRows: summary.stageRows,
          canAct,
          deltaLabel: delta || "0",
          status,
          error,
        },
        activeWorkspace,
      ),
    [activeWorkspace, canAct, delta, error, status, summary],
  );

  useEffect(() => {
    setWalletsKit(getWalletsKit(["FREIGHTER", "ALBEDO", "XBULL"]));
    const saved = localStorage.getItem("wallet:pubkey");
    if (saved) {
      setPubKey(saved);
      setTargetManager(saved);
    }
  }, []);

  const refresh = async (manager?: string): Promise<void> => {
    const m = manager || targetManager || pubKey;
    if (!m) {
      setReadError("");
      setReadStatus("Connect a wallet or enter a manager address before reading tier state.");
      return;
    }
    setRefreshing(true);
    setReadError("");
    setReadStatus("Refreshing tier snapshot...");
    try {
      const [points, tier, th] = await Promise.all([
        readManagerTierPoints(MANAGER_TIER, m, pubKey || undefined),
        readManagerTierLevel(MANAGER_TIER, m, pubKey || undefined),
        readManagerTierThresholds(MANAGER_TIER, pubKey || undefined),
      ]);
      setMyPoints(points);
      setMyTier(tier);
      setThresholds(th);
      setReadStatus("Tier snapshot refreshed.");
    } catch (e) {
      setReadStatus("");
      setReadError(e instanceof Error ? e.message : "Failed to refresh tier state");
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => {
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pubKey, targetManager]);

  const connect = async (): Promise<void> => {
    try {
      setError("");
      if (!walletsKit) throw new Error("Wallets Kit not initialized");
      const key = await connectWallet(walletsKit);
      setPubKey(key);
      setTargetManager((prev) => prev || key);
      localStorage.setItem("wallet:pubkey", key);
      await refresh(key);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to connect");
    }
  };

  const onAddPoints = async (): Promise<void> => {
    try {
      if (!canAct || !walletsKit) return;
      setLoading(true);
      setError("");
      const add = Number(delta);
      if (!Number.isFinite(add) || add <= 0) throw new Error("Invalid points delta");
      const tx = await buildManagerTierAddPoints(pubKey, MANAGER_TIER, targetManager.trim(), add);
      const signed = await signXdr(walletsKit, tx);
      setStatus("Submitting add_points...");
      const hash = await submitSignedTx(signed);
      await waitForTx(hash);
      setStatus(`Success: ${hash}`);
      await refresh(targetManager.trim());
    } catch (e) {
      setError(e instanceof Error ? e.message : "add_points failed");
      setStatus("");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="surface-stack control-room-fidelity-shell tiers-fidelity-shell secondary-operator-shell-cutover tiers-secondary-cutover">
      <header className="surface-stage-header">
        <span className="surface-eyebrow">Tiers</span>
        <h1 className="surface-title">Manager Tiers</h1>
        <p className="surface-description">
          Inspect manager score, threshold progression and governed point updates from the same operational surface.
        </p>
      </header>

      <section
        className="surface-entry-card tiers-runtime-read-card tiers-command-card secondary-operator-runtime-card-cutover"
        data-testid="tiers-runtime-read-posture"
      >
        <div className="surface-spotlight-head">
          <div>
            <span className="surface-table-hint">Tier runtime reads</span>
            <strong>
              {refreshing
                ? "Refreshing tier snapshot"
                : readError
                  ? "Tier read fallback active"
                  : thresholds
                    ? "Tier snapshot loaded"
                    : "Tier snapshot pending"}
            </strong>
            <p className="surface-table-subtle">
              This surface reads manager points, level and threshold floors from
              the ManagerTier contract. If a Soroban read fails, the last known
              UI state stays visible and retry is explicit.
            </p>
          </div>
          <StatusPill
            label={
              refreshing
                ? "Loading"
                : readError
                  ? "Retry required"
                  : thresholds
                    ? "Live reads"
                    : "Awaiting target"
            }
            tone={refreshing ? "neutral" : readError ? "warning" : thresholds ? "positive" : "neutral"}
          />
        </div>
        {readStatus ? (
          <div className="ops-status ops-status-success" data-testid="tiers-read-status">
            {readStatus}
          </div>
        ) : null}
        {readError ? (
          <div className="ops-status ops-status-error" data-testid="tiers-read-error">
            {readError}
          </div>
        ) : null}
        <div className="ops-action-row secondary-operator-actions-cutover">
          <button
            type="button"
            onClick={() => void refresh()}
            disabled={refreshing || !(targetManager || pubKey)}
            className="surface-button surface-button-secondary"
            data-testid="tiers-refresh-button"
          >
            Refresh tier reads
          </button>
        </div>
      </section>

      <section
        className="operator-workspace-summary secondary-operator-summary-cutover"
        data-testid="tiers-workspace-summary"
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
        aria-label="Manager tier workspaces"
        data-testid="tiers-workspace-tabs"
      >
        {TIER_WORKSPACE_TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            className={`surface-tab ${activeWorkspace === tab.id ? "surface-tab-active" : ""}`}
            aria-pressed={activeWorkspace === tab.id}
            aria-controls={`tiers-workspace-panel-${tab.id}`}
            data-testid={`tiers-workspace-tab-${tab.id}`}
            onClick={() => setActiveWorkspace(tab.id)}
          >
            <span>{tab.label}</span>
            <small>{tab.eyebrow}</small>
          </button>
        ))}
      </nav>

      <section
        id={`tiers-workspace-panel-${activeWorkspace}`}
        className="surface-grid surface-grid-two control-room-stage-grid operator-workspace-stage tiers-utility-grid secondary-operator-stage-cutover"
        data-testid="tiers-workspace-panel"
      >
        {activeWorkspace === "scorecard" ? (
        <Panel
          title="Manager scorecard"
          subtitle="Current target, live points and threshold progression"
          testId="tiers-state-panel"
          className="tiers-workspace-panel tiers-scorecard-workspace-panel secondary-operator-panel-cutover"
        >
          <div className="surface-chip-wrap surface-spotlight-tabs" aria-hidden="true">
            <StatusPill label="Score deck" tone="positive" />
            <StatusPill label="Threshold ladder" tone="neutral" />
            <StatusPill label="Progression" tone="neutral" />
          </div>
          <div className="surface-spotlight-grid tiers-spotlight-grid">
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
          <SurfaceTable
            testId="tiers-scorecard-table"
            className="tiers-scorecard-table secondary-operator-table-cutover"
            columnsClassName="tiers-scorecard-table"
            headers={["Signal", "Current state"]}
          >
            <div className="surface-table-row tiers-scorecard-table secondary-operator-row-cutover">
              <div className="surface-table-cell surface-table-cell-strong">Wallet</div>
              <div className="surface-table-cell">
                <strong data-testid="tiers-wallet-address">
                  {pubKey ? formatContractLabel(pubKey, 8, 6) : "Connect wallet"}
                </strong>
              </div>
            </div>
            <div className="surface-table-row tiers-scorecard-table secondary-operator-row-cutover">
              <div className="surface-table-cell surface-table-cell-strong">Manager address</div>
              <div className="surface-table-cell">
                <strong data-testid="tiers-target-manager">{summary.targetLabel}</strong>
              </div>
            </div>
            <div className="surface-table-row tiers-scorecard-table secondary-operator-row-cutover">
              <div className="surface-table-cell surface-table-cell-strong">Tier posture</div>
              <div className="surface-table-cell surface-table-actions">
                <StatusPill label={summary.label} tone={summary.label === "Unranked" ? "warning" : "positive"} />
                <StatusPill label={`Contract ${formatContractLabel(MANAGER_TIER)}`} tone="neutral" />
              </div>
            </div>
            <div className="surface-table-row tiers-scorecard-table secondary-operator-row-cutover">
              <div className="surface-table-cell surface-table-cell-strong">Threshold ladder</div>
              <div className="surface-table-cell surface-table-subtle">{summary.thresholdsLabel}</div>
            </div>
            <div className="surface-table-row tiers-scorecard-table secondary-operator-row-cutover">
              <div className="surface-table-cell surface-table-cell-strong">Next milestone</div>
              <div className="surface-table-cell surface-table-subtle">{summary.nextStep}</div>
            </div>
          </SurfaceTable>
        </Panel>
        ) : null}

        {activeWorkspace === "ladder" ? (
        <Panel
          title="Threshold ladder"
          subtitle="Live tier floors and selected-manager progression"
          testId="tiers-ladder-panel"
          className="tiers-workspace-panel tiers-ladder-workspace-panel secondary-operator-panel-cutover"
        >
          <div className="surface-chip-wrap">
            <StatusPill label="Threshold ladder" tone="positive" />
            <StatusPill label={summary.thresholdsLabel} tone={summary.thresholdsLabel === "n/a" ? "warning" : "neutral"} />
            <StatusPill label={summary.nextStep} tone="neutral" />
          </div>
          <div className="surface-spotlight-grid tiers-spotlight-grid">
            {spotlightItems
              .filter((item) => ["tier-thresholds", "tier-next-step"].includes(item.id))
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
          <SurfaceTable className="tiers-table secondary-operator-table-cutover" columnsClassName="tiers-table" headers={["Tier", "Floor", "Status"]}>
            {summary.stageRows.map((row) => (
              <div key={row.id} className="surface-table-row tiers-table secondary-operator-row-cutover" data-testid={`tiers-stage-${row.id}`}>
                <div className="surface-table-cell surface-table-cell-strong">{row.label}</div>
                <div className="surface-table-cell">{row.floor}</div>
                <div className="surface-table-cell">
                  <StatusPill label={row.state} tone={row.met ? "positive" : "warning"} />
                </div>
              </div>
            ))}
          </SurfaceTable>
        </Panel>
        ) : null}

        {activeWorkspace === "update" ? (
        <Panel
          title="Governed update"
          subtitle="Review state, connect a wallet and submit an authorized points delta"
          testId="tiers-actions-panel"
          className="tiers-workspace-panel tiers-actions-workspace-panel secondary-operator-panel-cutover"
        >
          <div className="surface-chip-wrap">
            <StatusPill label="Governed deck" tone="positive" />
            <StatusPill label={canAct ? "Signer ready" : "Awaiting signer"} tone={canAct ? "positive" : "warning"} />
            <StatusPill label="Authorization model" tone="neutral" />
          </div>
          <div className="surface-spotlight-grid tiers-spotlight-grid">
            {actionSpotlights.map((item) => (
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
            testId="tiers-actions-table"
            className="tiers-actions-table secondary-operator-table-cutover"
            columnsClassName="tiers-actions-table"
            headers={["Signal", "Execution posture"]}
          >
            <div className="surface-table-row tiers-actions-table secondary-operator-row-cutover">
              <div className="surface-table-cell surface-table-cell-strong">Authorization model</div>
              <div className="surface-table-cell surface-table-subtle">
                This call still follows the contract rule set on-chain. Only authorized actors can submit score changes.
              </div>
            </div>
            <div className="surface-table-row tiers-actions-table secondary-operator-row-cutover">
              <div className="surface-table-cell surface-table-cell-strong">Current wallet</div>
              <div className="surface-table-cell">
                {pubKey ? (
                  <span data-testid="tiers-wallet-chip">Wallet {formatContractLabel(pubKey, 8, 6)}</span>
                ) : (
                  "Connect a wallet to unlock governed updates."
                )}
              </div>
            </div>
          </SurfaceTable>
          <div className="ops-action-row secondary-operator-actions-cutover">
            {!pubKey ? (
              <button type="button" onClick={connect} className="surface-button surface-button-primary">
                Connect wallet
              </button>
            ) : (
              <div className="surface-note">
                Wallet {formatContractLabel(pubKey, 8, 6)}
              </div>
            )}
            <button type="button" onClick={() => void refresh()} className="surface-button surface-button-secondary">
              Refresh
            </button>
          </div>

          <div className="ops-form-grid secondary-operator-form-cutover">
            <label className="ops-field ops-field-span">
              <span className="ops-field-label">Manager address</span>
              <input
                value={targetManager}
                onChange={(e) => setTargetManager(e.target.value)}
                className="ops-input"
                placeholder="G..."
                data-testid="tiers-manager-input"
              />
            </label>
            <label className="ops-field">
              <span className="ops-field-label">Points delta</span>
              <input
                value={delta}
                onChange={(e) => setDelta(e.target.value)}
                className="ops-input"
                placeholder="Points delta"
                data-testid="tiers-delta-input"
              />
            </label>
          </div>

          <div className="ops-action-row secondary-operator-actions-cutover">
            <button
              type="button"
              onClick={onAddPoints}
              disabled={!canAct}
              className="surface-button surface-button-primary"
              data-testid="tiers-add-points-button"
            >
              Add points
            </button>
            {loading ? <span className="ops-status">Submitting transaction…</span> : null}
          </div>

          {status ? <div className="ops-status ops-status-success" data-testid="tiers-status">{status}</div> : null}
          {error ? <div className="ops-status ops-status-error" data-testid="tiers-error">{error}</div> : null}
        </Panel>
        ) : null}
      </section>
    </main>
  );
}
