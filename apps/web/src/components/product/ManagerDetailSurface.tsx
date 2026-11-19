"use client";
import { UX_REVIEW_PREVIEW } from "@/lib/previewSafety";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { StellarWalletsKit } from "@creit.tech/stellar-wallets-kit";
import {
  CatalogApiError,
  loadManagerDetailBundle,
  saveManagerIdentity,
} from "@/lib/catalog/api";
import { computeSpotlightWidthByRank } from "@/lib/catalog/explorerSurfaces";
import {
  formatContractLabel,
  formatFeeSummary,
  formatRelativeTime,
  formatSignedBpsAsPercent,
  formatUsdBaseUnitAmount,
} from "@/lib/catalog/format";
import {
  buildIdentityPayload,
  buildIdentityUpdateMessage,
  resolveArkaDisplayName,
  resolveManagerDisplayName,
  resolveManagerSubtitle,
  type EditableIdentityDraft,
} from "@/lib/catalog/identity";
import {
  buildManagerHistoryBars,
  buildManagerTrendSummary,
} from "@/lib/catalog/explorers";
import type { ManagerDetailBundle } from "@/lib/catalog/types";
import {
  connectWallet,
  getWalletsKit,
  signMessageWithWallet,
} from "@/lib/walletKit";
import {
  EmptyState,
  ErrorState,
  HistoryBars,
  IdentityEditDialog,
  LoadingState,
  Panel,
  StatusPill,
} from "./surfacePrimitives";

interface ManagerDetailSurfaceState {
  status: "loading" | "ready" | "error";
  data: ManagerDetailBundle | null;
  error: string | null;
}

const INITIAL_STATE: ManagerDetailSurfaceState = {
  status: "loading",
  data: null,
  error: null,
};

const MANAGED_ARKAS_PER_PAGE = 6;

export default function ManagerDetailSurface(props: { managerId: string }) {
  const [reloadNonce, setReloadNonce] = useState(0);
  const [state, setState] = useState<ManagerDetailSurfaceState>(INITIAL_STATE);
  const [kit, setKit] = useState<StellarWalletsKit | null>(null);
  const [identityDialogOpen, setIdentityDialogOpen] = useState(false);
  const [identityDraft, setIdentityDraft] = useState<EditableIdentityDraft>({
    displayName: "",
    description: "",
    strategy: "",
    riskDisclosure: "",
    targetReturn: "",
    websiteUrl: "",
    socialUrl: "",
  });
  const [identityBusy, setIdentityBusy] = useState(false);
  const [identityError, setIdentityError] = useState("");
  const [managedArkaPage, setManagedArkaPage] = useState(0);

  useEffect(() => {
    setKit(getWalletsKit(["FREIGHTER", "ALBEDO", "XBULL"]));
  }, []);

  useEffect(() => {
    setManagedArkaPage(0);
    const controller = new AbortController();
    const run = async () => {
      setState((current) => ({ ...current, status: "loading", error: null }));
      try {
        const data = await loadManagerDetailBundle(
          props.managerId,
          controller.signal,
        );
        setState({ status: "ready", data, error: null });
      } catch (error) {
        if (controller.signal.aborted) return;
        const message =
          error instanceof CatalogApiError
            ? error.message
            : error instanceof Error
              ? error.message
              : "Unable to load manager detail.";
        setState({ status: "error", data: null, error: message });
      }
    };
    void run();
    return () => controller.abort();
  }, [props.managerId, reloadNonce]);

  const openIdentityEditor = () => {
    const manager = state.data?.manager;
    if (!manager) return;
    setIdentityDraft({
      displayName: manager.identity?.displayName ?? "",
      description: manager.identity?.description ?? "",
      strategy: manager.identity?.strategy ?? "",
      riskDisclosure: manager.identity?.riskDisclosure ?? "",
      targetReturn: manager.identity?.targetReturn ?? "",
      websiteUrl: manager.identity?.websiteUrl ?? "",
      socialUrl: manager.identity?.socialUrl ?? "",
    });
    setIdentityError("");
    setIdentityDialogOpen(true);
  };

  const saveIdentity = async () => {
    const manager = state.data?.manager;
    if (!manager || !kit) return;
    setIdentityBusy(true);
    setIdentityError("");
    try {
      let signer = "";
      try {
        signer = (await kit.getAddress()).address;
      } catch {}
      if (!signer) {
        signer = await connectWallet(kit);
      }
      if (signer !== manager.manager) {
        throw new Error("Connect the manager wallet to edit this profile.");
      }
      const payload = buildIdentityPayload(identityDraft);
      const message = buildIdentityUpdateMessage({
        scope: "manager",
        target: manager.manager,
        signer,
        payload,
      });
      const signature = await signMessageWithWallet(kit, message, signer);
      const identity = await saveManagerIdentity(manager.manager, {
        signer,
        message,
        signature,
        payload,
      });
      setState((current) => {
        if (!current.data) return current;
        return {
          ...current,
          data: {
            ...current.data,
            manager: {
              ...current.data.manager,
              identity,
            },
          },
        };
      });
      setIdentityDialogOpen(false);
    } catch (error) {
      setIdentityError(
        error instanceof Error ? error.message : "Manager profile could not be saved.",
      );
    } finally {
      setIdentityBusy(false);
    }
  };

  if (state.status === "loading") {
    return (
      <LoadingState
        title="Loading manager profile"
        body="Fetching the latest public portfolio information."
        testId="manager-detail-loading"
      />
    );
  }

  if (state.status === "error" || !state.data) {
    return (
      <ErrorState
        title="Manager detail unavailable"
        body={state.error ?? "The manager detail page could not be loaded."}
        actionLabel="Retry"
        onAction={() => setReloadNonce((value) => value + 1)}
        testId="manager-detail-error"
      />
    );
  }

  const { manager, history, arkas } = state.data;
  const trend = buildManagerTrendSummary(history.items);
  const bars = buildManagerHistoryBars(history.items);
  const managerTvl =
    manager.totalNavUsdEstimate !== null &&
    manager.totalNavUsdEstimate !== undefined
      ? formatUsdBaseUnitAmount(manager.totalNavUsdEstimate)
      : "Valuation unavailable";
  const managerTvlDetail =
    manager.totalNavUsdEstimate !== null &&
    manager.totalNavUsdEstimate !== undefined
      ? `${managerTvl} total TVL.`
      : "Total TVL unavailable.";

  const historySignals = [
    {
      id: "current",
      label: "Current TVL",
      value: managerTvl,
      detail: trend.pointCount > 0 ? "latest priced valuation" : "no valuation updates yet",
    },
    {
      id: "previous",
      label: "Previous value",
      value:
        trend.previousValue === null
          ? "Unavailable"
          : formatUsdBaseUnitAmount(trend.previousValue),
      detail: "previous priced valuation",
    },
    {
      id: "delta",
      label: "Delta",
      value:
        trend.deltaBps === null
          ? "Unavailable"
          : formatSignedBpsAsPercent(trend.deltaBps),
      detail: "change since the previous priced valuation",
    },
  ];

  const managedArkaPageCount = Math.max(
    1,
    Math.ceil(arkas.items.length / MANAGED_ARKAS_PER_PAGE),
  );
  const visibleManagedArkas = arkas.items.slice(
    managedArkaPage * MANAGED_ARKAS_PER_PAGE,
    (managedArkaPage + 1) * MANAGED_ARKAS_PER_PAGE,
  );

  return (
    <div
      className="surface-stack control-room-fidelity-shell manager-detail-fidelity-shell public-detail-shell-cutover public-manager-detail-cutover"
      data-testid="manager-detail-fidelity-shell"
    >
      <header className="surface-stage-header public-detail-stage-header-cutover">
        <span className="surface-eyebrow">Manager detail</span>
        <h1 className="surface-title">
          {resolveManagerDisplayName(manager)}
        </h1>
        <p className="surface-description">
          {resolveManagerSubtitle(manager)}
        </p>
        <div className="surface-actions">
          <button
            type="button"
            className="surface-button surface-button-secondary"
            onClick={openIdentityEditor}
            data-testid="manager-edit-profile"
            disabled={UX_REVIEW_PREVIEW}
            title={UX_REVIEW_PREVIEW ? "Profile changes are disabled in this review preview." : "Only this manager can sign and save profile changes."}
          >
            Edit profile (manager)
          </button>
          <StatusPill
            label={formatContractLabel(manager.manager, 10, 6)}
            tone="neutral"
          />
        </div>
      </header>

      <section
        className="workflow-signal-grid control-room-signal-grid public-detail-hero-grid-cutover"
        data-testid="manager-detail-hero"
      >
        <article className="surface-signal-card workflow-signal-card">
          <span className="workflow-signal-label">Managed Arkas</span>
          <strong className="workflow-signal-value">
            {manager.arkaCount}
          </strong>
          <span className="workflow-signal-detail">
            <span data-testid="manager-detail-nav">{managerTvlDetail}</span>
          </span>
        </article>
        <article className="surface-signal-card workflow-signal-card">
          <span className="workflow-signal-label">Current rank</span>
          <strong className="workflow-signal-value">#{manager.rank}</strong>
          <span className="workflow-signal-detail">
            <span data-testid="manager-detail-governance">{manager.curatedArkaCount}</span> curated Arka{manager.curatedArkaCount === 1 ? "" : "s"}.
          </span>
        </article>
        <article className="surface-signal-card workflow-signal-card">
          <span className="workflow-signal-label">Last sync</span>
          <strong className="workflow-signal-value">
            {formatRelativeTime(manager.syncedAt)}
          </strong>
          <span className="workflow-signal-detail">
            <span data-testid="manager-detail-trend">{trend.deltaBps === null ? "No priced history yet" : `${formatSignedBpsAsPercent(trend.deltaBps)} since the previous valuation`}</span>.
          </span>
        </article>
      </section>

      <section
        className="surface-grid surface-grid-two control-room-stage-grid explorer-detail-stage-grid explorer-detail-stage-cutover manager-detail-stage-cutover public-detail-stage-grid-cutover"
        data-testid="manager-detail-stage-grid"
      >
        <Panel
          title="TVL history"
          subtitle={trend.pointCount === 0 ? "No priced records yet" : `${trend.pointCount} priced records`}
          testId="manager-detail-history-panel"
          className="explorer-detail-panel explorer-detail-history-panel public-detail-panel-cutover"
        >
          <div className="explorer-history-shell">
            {bars.length > 1 ? (
              <>
                <div className="explorer-detail-signal-grid">
                  {historySignals.map((signal) => (
                    <article
                      key={signal.id}
                      className="surface-signal-card explorer-detail-signal-card"
                    >
                      <span className="explorer-signal-label">{signal.label}</span>
                      <strong className="explorer-signal-value">
                        {signal.value}
                      </strong>
                      <span className="explorer-signal-detail">
                        {signal.detail}
                      </span>
                    </article>
                  ))}
                </div>
                <HistoryBars
                  items={bars.map((bar) => ({
                    id: `${manager.manager}-${bar.label}`,
                    label: bar.label,
                    value: formatUsdBaseUnitAmount(bar.value),
                    widthPct: bar.widthPct,
                  }))}
                  testId="manager-history-bars"
                />
              </>
            ) : (
              <EmptyState
                title="Price history unavailable"
                body="A USD trend will appear after two priced valuation updates."
                testId="manager-history-empty"
              />
            )}
          </div>
        </Panel>
      </section>

      <Panel
        title="Managed Arkas"
        subtitle="Ranked by current TVL"
        testId="manager-detail-arkas-panel"
        className="explorer-detail-panel explorer-detail-linked-panel explorer-related-panel-cutover manager-detail-linked-cutover public-detail-panel-cutover public-detail-related-panel-cutover"
      >
        {arkas.items.length === 0 ? (
          <EmptyState
            title="No Arkas found"
            body="This manager currently has no Arkas."
          />
        ) : (
          <div
            className="surface-spotlight-grid manager-detail-arkas-grid explorer-related-grid-cutover public-detail-related-grid-cutover"
            data-testid="manager-detail-arkas-table"
          >
            {visibleManagedArkas.map((entry) => (
              <article
                key={entry.arkaId}
                className="surface-entry-card surface-spotlight-card manager-detail-arka-card explorer-related-card public-detail-related-card-cutover"
                data-testid="manager-detail-arka-card"
              >
                <div className="surface-spotlight-head">
                  <div className="explorer-related-summary">
                    <div className="surface-table-hint">#{entry.rank}</div>
                    <div className="surface-spotlight-title">
                      {resolveArkaDisplayName(entry)}
                    </div>
                    <div className="surface-table-subtle">
                      {formatContractLabel(entry.arkaId, 12, 6)}
                    </div>
                  </div>
                  <StatusPill
                    label={
                      entry.delisted
                        ? "Delisted"
                        : entry.curated
                          ? "Curated"
                          : "Listed"
                    }
                    tone={
                      entry.delisted
                        ? "warning"
                        : entry.curated
                          ? "positive"
                          : "neutral"
                    }
                  />
                </div>

                <div className="surface-spotlight-value">
                  {entry.economics?.navUsdEstimate !== null &&
                  entry.economics?.navUsdEstimate !== undefined
                    ? formatUsdBaseUnitAmount(entry.economics.navUsdEstimate)
                    : "Valuation unavailable"}
                </div>

                <div className="surface-spotlight-strip" aria-hidden="true">
                  <span
                    style={{ width: `${computeSpotlightWidthByRank(entry.rank)}%` }}
                  />
                </div>

                <div className="explorer-related-meta">
                  <span>{entry.assets.length} assets</span>
                  {entry.economics?.denominationAsset?.symbol ? (
                    <span>
                      Denomination {entry.economics.denominationAsset.symbol}
                    </span>
                  ) : null}
                  <span>{formatRelativeTime(entry.syncedAt)}</span>
                </div>

                <div className="surface-chip-wrap">
                  {formatFeeSummary(entry.fees.mgmtBps, entry.fees.perfBps)
                    .split(" · ")
                    .map((feeLabel) => (
                      <span key={feeLabel} className="status-pill status-pill-neutral">
                        {feeLabel}
                      </span>
                    ))}
                </div>

                <div className="surface-spotlight-footer">
                  <Link
                    href={`/vaults/${entry.arkaId}`}
                    className="surface-table-link"
                  >
                    Open Arka profile
                  </Link>
                </div>
              </article>
            ))}
          </div>
        )}
        {managedArkaPageCount > 1 ? (
          <nav
            className="surface-pagination"
            aria-label="Managed Arka pages"
            data-testid="manager-detail-arkas-pagination"
          >
            <button
              type="button"
              className="surface-button surface-button-secondary"
              disabled={managedArkaPage === 0}
              onClick={() => setManagedArkaPage((page) => Math.max(0, page - 1))}
            >
              Previous
            </button>
            <span aria-live="polite">
              Page {managedArkaPage + 1} of {managedArkaPageCount}
            </span>
            <button
              type="button"
              className="surface-button surface-button-secondary"
              disabled={managedArkaPage >= managedArkaPageCount - 1}
              onClick={() =>
                setManagedArkaPage((page) =>
                  Math.min(managedArkaPageCount - 1, page + 1),
                )
              }
            >
              Next
            </button>
          </nav>
        ) : null}
      </Panel>
      <IdentityEditDialog
        open={identityDialogOpen}
        title="Edit manager profile"
        body="This updates the public manager name shown in Arka.fund. The manager wallet must sign the change."
        draft={identityDraft}
        busy={identityBusy}
        error={identityError}
        onDraftChange={setIdentityDraft}
        onCancel={() => setIdentityDialogOpen(false)}
        onSave={() => void saveIdentity()}
        testId="manager-identity-edit-dialog"
      />
    </div>
  );
}
