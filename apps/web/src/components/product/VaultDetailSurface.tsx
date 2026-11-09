"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { UX_REVIEW_PREVIEW } from "@/lib/previewSafety";
import type { StellarWalletsKit } from "@creit.tech/stellar-wallets-kit";
import {
  CatalogApiError,
  loadArkaDetailBundle,
  saveArkaIdentity,
} from "@/lib/catalog/api";
import {
  buildArkaHistoryBars,
  buildArkaTrendSummary,
  buildPortfolioBars,
  summarizeArkaActivity,
} from "@/lib/catalog/arkas";
import {
  buildVaultActivityHighlights,
  buildVaultDetailPublicMetricDeck,
  buildVaultProfileSignals,
  type VaultDetailPublicMetricTile,
} from "@/lib/catalog/vaults";
import {
  formatBaseUnitAmount,
  formatContractLabel,
  formatRelativeTime,
  formatSignedBpsAsPercent,
  formatUsdBaseUnitAmount,
  formatWeightLabel,
} from "@/lib/catalog/format";
import { resolveAssetDisplayLabel } from "@/lib/catalog/assetPresentation";
import {
  buildArkaIdentityDraft,
  buildIdentityPayload,
  buildIdentityUpdateMessage,
  resolveArkaDisplayName,
  resolveArkaSubtitle,
  resolveManagerDisplayName,
  type EditableIdentityDraft,
} from "@/lib/catalog/identity";
import type { ArkaDetailBundle } from "@/lib/catalog/types";
import {
  connectWallet,
  getWalletsKit,
  signMessageWithWallet,
} from "@/lib/walletKit";
import {
  BarList,
  EmptyState,
  ErrorState,
  HistoryBars,
  IdentityEditDialog,
  LoadingState,
  MetricCard,
  Panel,
  StatusPill,
  SurfaceHero,
} from "./surfacePrimitives";

type DetailTab = "overview" | "portfolio" | "activity" | "policies";

interface VaultDetailSurfaceState {
  status: "loading" | "ready" | "error";
  data: ArkaDetailBundle | null;
  error: string | null;
}

const INITIAL_STATE: VaultDetailSurfaceState = {
  status: "loading",
  data: null,
  error: null,
};

function formatVaultDetailPublicMetricValue(
  tile: VaultDetailPublicMetricTile,
): string {
  if (tile.valueKind === "amount") return formatUsdBaseUnitAmount(tile.value);
  return tile.value;
}

function resolveVaultDetailPublicMetricTestId(
  tile: VaultDetailPublicMetricTile,
): string {
  if (tile.id === "nav") return "vault-detail-nav";
  if (tile.id === "trend") return "vault-detail-trend";
  if (tile.id === "fees") return "vault-detail-fees";
  return `vault-detail-metric-${tile.id}`;
}

function hasVaultUsdValuation(arka: ArkaDetailBundle["arka"]): boolean {
  return arka.economics?.navUsdEstimate !== null && arka.economics?.navUsdEstimate !== undefined;
}

function formatVaultDenominationAmount(
  value: string | number | null | undefined,
  arka: ArkaDetailBundle["arka"],
): string {
  const denomination = arka.economics?.denominationAsset;
  if (!denomination?.symbol) {
    return "Valuation unavailable";
  }
  const symbol = denomination.symbol;
  const decimals = denomination?.decimals ?? 7;
  return `${formatBaseUnitAmount(value, decimals, 2)} ${symbol}`;
}

function formatVaultTvlValue(arka: ArkaDetailBundle["arka"]): string {
  if (arka.nav === null) return "Valuation unavailable";
  return hasVaultUsdValuation(arka)
    ? formatUsdBaseUnitAmount(arka.economics?.navUsdEstimate)
    : formatVaultDenominationAmount(arka.economics?.navDenomination ?? arka.nav, arka);
}

export default function VaultDetailSurface(props: { arkaId: string }) {
  const [activeTab, setActiveTab] = useState<DetailTab>("overview");
  const [reloadNonce, setReloadNonce] = useState(0);
  const [state, setState] = useState<VaultDetailSurfaceState>(INITIAL_STATE);
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

  useEffect(() => {
    setKit(getWalletsKit(["FREIGHTER", "ALBEDO", "XBULL"]));
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    const run = async () => {
      setState((current) => ({ ...current, status: "loading", error: null }));
      try {
        const data = await loadArkaDetailBundle(props.arkaId, controller.signal);
        setState({ status: "ready", data, error: null });
      } catch (error) {
        if (controller.signal.aborted) return;
        const message =
          error instanceof CatalogApiError
            ? error.message
            : error instanceof Error
              ? error.message
              : "Unable to load Arka profile.";
        setState({ status: "error", data: null, error: message });
      }
    };
    void run();
    return () => controller.abort();
  }, [props.arkaId, reloadNonce]);

  const openIdentityEditor = () => {
    const arka = state.data?.arka;
    if (!arka) return;
    setIdentityDraft(buildArkaIdentityDraft(arka.arkaId, arka.rank, arka.identity));
    setIdentityError("");
    setIdentityDialogOpen(true);
  };

  const saveIdentity = async () => {
    const arka = state.data?.arka;
    if (!arka || !kit) return;
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
      if (signer !== arka.manager) {
        throw new Error("Connect the manager wallet to edit this Arka profile.");
      }
      const payload = buildIdentityPayload(identityDraft);
      const message = buildIdentityUpdateMessage({
        scope: "arka",
        target: arka.arkaId,
        signer,
        payload,
      });
      const signature = await signMessageWithWallet(kit, message, signer);
      const identity = await saveArkaIdentity(arka.arkaId, {
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
            arka: {
              ...current.data.arka,
              identity,
            },
          },
        };
      });
      setIdentityDialogOpen(false);
    } catch (error) {
      setIdentityError(
        error instanceof Error ? error.message : "Arka profile could not be saved.",
      );
    } finally {
      setIdentityBusy(false);
    }
  };

  if (state.status === "loading") {
    return <LoadingState title="Loading Arka profile" body="Loading profile, portfolio and activity." testId="vault-detail-loading" />;
  }

  if (state.status === "error" || !state.data) {
    return (
      <ErrorState
        title="Arka profile unavailable"
        body={state.error ?? "The Arka profile could not be loaded."}
        actionLabel="Retry"
        onAction={() => setReloadNonce((value) => value + 1)}
        testId="vault-detail-error"
      />
    );
  }

  const { arka, history, portfolio, activity } = state.data;
  const historicalTrend = buildArkaTrendSummary(history.items);
  const trend = arka.nav === null
    ? {...historicalTrend,currentNav:null,deltaNav:null,deltaBps:null}
    : historicalTrend;
  const historyBars = buildArkaHistoryBars(history.items);
  const hasChangingHistory =
    historyBars.length > 1 &&
    new Set(historyBars.map((bar) => bar.value)).size > 1;
  const portfolioBars = buildPortfolioBars(portfolio);
  const activityGroups = summarizeArkaActivity(activity.items);
  const activityHighlights = buildVaultActivityHighlights(activity);
  const profileSignals = buildVaultProfileSignals(arka);
  const publicMetricTiles = buildVaultDetailPublicMetricDeck(state.data);

  return (
    <div className="surface-stack vault-detail-fidelity-shell public-detail-shell-cutover public-vault-detail-cutover">
      <SurfaceHero
        eyebrow="Arka profile"
        title={resolveArkaDisplayName(arka)}
        description={resolveArkaSubtitle(arka)}
        primaryHref={`/arkas/${arka.arkaId}?workspace=flow`}
        primaryLabel="Deposit or withdraw"
        secondaryHref="/discover"
        secondaryLabel="Back to discover"
        aside={
          <div className="vault-detail-hero-grid" data-testid="vault-detail-hero">
            <div className="surface-signal-card surface-signal-card-emphasis">
              <span className="surface-signal-label">Arka</span>
              <strong className="surface-signal-value">{formatContractLabel(arka.arkaId, 12, 6)}</strong>
              <span className="surface-table-subtle">{formatVaultTvlValue(arka)} TVL</span>
            </div>
            <div className="surface-signal-card">
              <span className="surface-signal-label">Manager</span>
              <strong className="surface-signal-value">{resolveManagerDisplayName(arka.manager)}</strong>
            </div>
            <div className="surface-signal-card">
              <span className="surface-signal-label">Last sync</span>
              <strong className="surface-signal-value">{formatRelativeTime(arka.syncedAt)}</strong>
            </div>
            <div className="surface-signal-card">
              <span className="surface-signal-label">Allowed assets</span>
              <strong className="surface-signal-value">{arka.whitelistContracts.length} assets</strong>
            </div>
          </div>
        }
      />

      <div className="surface-actions vault-identity-actions">
        <Link href={`/arkas/${arka.arkaId}?workspace=rebalance`} className="surface-button surface-button-secondary">Manage fund assets</Link>
        <button
          type="button"
          className="surface-button surface-button-secondary"
          onClick={openIdentityEditor}
          data-testid="vault-edit-profile"
          disabled={UX_REVIEW_PREVIEW}
          title={UX_REVIEW_PREVIEW ? "Profile changes are disabled in the review preview." : "Only the manager can sign and save profile changes."}
        >
          Edit profile (manager)
        </button>
        <StatusPill label={formatContractLabel(arka.arkaId, 10, 6)} tone="neutral" />
      </div>

      <section
        className="public-figma-metric-deck vault-detail-public-metric-deck public-detail-metric-deck-cutover"
        data-testid="vault-detail-public-metric-deck"
        aria-label="Arka profile metrics"
      >
        {publicMetricTiles.map((tile) => (
          <article
            key={tile.id}
            className={`public-figma-metric-card public-figma-metric-card-${tile.tone} public-figma-metric-card-${tile.id} public-detail-metric-card-cutover`}
            data-testid={resolveVaultDetailPublicMetricTestId(tile)}
          >
            <div className="public-figma-metric-head">
              <span className="public-figma-metric-icon" aria-hidden="true" />
              <strong>{tile.label}</strong>
            </div>
            <div className="public-figma-metric-value">
              {formatVaultDetailPublicMetricValue(tile)}
            </div>
            <p className="public-figma-metric-detail">{tile.detail}</p>
          </article>
        ))}
      </section>

      <div className="detail-tab-row vault-detail-tab-row public-detail-tabs-cutover" data-testid="vault-detail-tabs">
        {[
          { id: "overview", label: "Overview" },
          { id: "portfolio", label: "Portfolio" },
          { id: "activity", label: "Activity" },
          { id: "policies", label: "Policies" },
        ].map((tab) => (
          <button
            key={tab.id}
            type="button"
            className={`detail-tab ${activeTab === tab.id ? "detail-tab-active" : ""}`}
            aria-pressed={activeTab === tab.id}
            onClick={() => setActiveTab(tab.id as DetailTab)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === "overview" ? (
        <section
          className="surface-grid surface-grid-two vault-detail-tab-panel vault-overview-grid public-detail-tab-panel-cutover"
          data-testid="vault-overview-tab"
        >
          <Panel
            title="Value over time"
            subtitle={`${trend.pointCount} recorded updates`}
            testId="vault-history-panel"
            className="vault-tab-workspace-panel vault-overview-history-panel public-detail-panel-cutover"
          >
            <div className="vault-history-shell">
              {hasChangingHistory ? (
                <HistoryBars
                  items={historyBars.map((bar) => ({
                    id: `${arka.arkaId}-${bar.label}`,
	                    label: bar.label,
	                    value: formatVaultDenominationAmount(bar.value, arka),
                    widthPct: bar.widthPct,
                  }))}
                  testId="vault-history-bars"
                />
              ) : (
                <EmptyState
                  title={historyBars.length > 1 ? "No change in this period" : "History not available yet"}
                  body={
                    historyBars.length > 1
                      ? "The recorded Arka value stayed unchanged."
                      : "A trend will appear after another value update."
                  }
                  testId="vault-history-empty"
                />
              )}
              <div className="vault-trend-grid">
                <div className="surface-data-item">
	                  <span className="surface-data-label">Current TVL</span>
	                  <strong className="surface-data-value">{formatVaultTvlValue(arka)}</strong>
                </div>
                <div className="surface-data-item">
                  <span className="surface-data-label">Change</span>
                  <strong className="surface-data-value">{formatSignedBpsAsPercent(trend.deltaBps)}</strong>
                </div>
              </div>
            </div>
          </Panel>

          <Panel
            title="Profile"
            subtitle="Manager, denomination and current status"
            testId="vault-profile-panel"
            className="vault-tab-workspace-panel vault-overview-profile-panel public-detail-panel-cutover"
          >
            <div className="vault-profile-signal-grid" data-testid="vault-profile-table">
              {profileSignals.map((signal) => {
                const isContractSignal =
                  signal.id === "manager" ||
                  signal.id === "denomination" ||
                  signal.id === "shareToken";
	                const displayValue = isContractSignal
	                  ? signal.id === "denomination"
	                    ? resolveAssetDisplayLabel(signal.value)
	                    : formatContractLabel(signal.value, 10, 6)
	                  : signal.value;

                return (
                  <article key={signal.id} className="surface-entry-card vault-profile-card public-detail-related-card-cutover">
                    <div className="surface-list-label">{signal.label}</div>
                    <strong className="surface-entry-title">{displayValue}</strong>
                    <div className="surface-note">{signal.detail}</div>
                    <StatusPill
                      label={isContractSignal ? signal.label : displayValue}
                      tone={signal.tone === "default" ? "neutral" : signal.tone}
                    />
                  </article>
                );
              })}
            </div>
          </Panel>
        </section>
      ) : null}

      {activeTab === "portfolio" ? (
        <section
          className="surface-grid surface-grid-two vault-detail-tab-panel vault-portfolio-grid public-detail-tab-panel-cutover"
          data-testid="vault-portfolio-tab"
        >
          <Panel
            title="Composition"
            subtitle="Current value contribution by asset"
            testId="vault-portfolio-panel"
            className="vault-tab-workspace-panel vault-portfolio-composition-panel public-detail-panel-cutover"
          >
            <BarList items={portfolioBars} testId="vault-portfolio-bars" />
          </Panel>

          <Panel
            title="Asset book"
            subtitle="Current tracked positions"
            testId="vault-assets-panel"
            className="vault-tab-workspace-panel vault-portfolio-assets-panel public-detail-panel-cutover"
          >
            <div className="vault-assets-grid" data-testid="vault-assets-table">
              {portfolio.items.map((item) => (
                <article key={item.assetContract} className="surface-entry-card vault-asset-card public-detail-related-card-cutover">
                  <div className="surface-entry-head">
                    <div>
                      <div className="surface-table-hint">Rank #{item.rank}</div>
	                      <strong className="surface-entry-title">{resolveAssetDisplayLabel(item.assetContract)}</strong>
                    </div>
                    <StatusPill label={item.isDenomination ? "Denomination" : "Position"} tone="neutral" />
                  </div>
                  <div className="surface-entry-stats">
                    <span>{formatWeightLabel(item.weightBps)}</span>
	                    <span className="surface-table-cell-strong">
                        {item.valueUsdEstimate !== null && item.valueUsdEstimate !== undefined
                          ? formatUsdBaseUnitAmount(item.valueUsdEstimate)
                          : formatVaultDenominationAmount(item.navContribution, arka)} value contribution
                      </span>
	                  </div>
	                  <div className="surface-note">
                      {item.marketIds.length} {item.marketIds.length === 1 ? "market" : "markets"} · {formatBaseUnitAmount(item.netPositionValue)} {resolveAssetDisplayLabel(item.assetContract)} net position
                    </div>
                </article>
              ))}
            </div>
          </Panel>
        </section>
      ) : null}

      {activeTab === "activity" ? (
        <section
          className="surface-grid surface-grid-two vault-detail-tab-panel vault-activity-grid public-detail-tab-panel-cutover"
          data-testid="vault-activity-tab"
        >
          <Panel
            title="Activity mix"
            subtitle="Recent events by kind"
            testId="vault-activity-summary-panel"
            className="vault-tab-workspace-panel vault-activity-summary-panel public-detail-panel-cutover"
          >
            {activityGroups.length === 0 ? (
              <EmptyState title="No activity yet" body="This Arka does not yet have activity in the current window." />
            ) : (
              <div className="vault-activity-summary-grid">
                {activityHighlights.map((item) => (
                  <MetricCard
                    key={item.id}
                    label={item.label}
                    value={item.value}
                    detail={item.detail}
                    tone={item.tone}
                  />
                ))}
                <div className="surface-chip-wrap">
                  {activityGroups.map((group) => (
                    <StatusPill key={group.kind} label={`${group.kind}: ${group.count}`} tone="neutral" />
                  ))}
                </div>
              </div>
            )}
          </Panel>

          <Panel
            title="Recent activity"
            subtitle={`${activity.total} events`}
            testId="vault-activity-feed-panel"
            className="vault-tab-workspace-panel vault-activity-feed-panel public-detail-panel-cutover"
          >
            {activity.items.length === 0 ? (
              <EmptyState title="No activity yet" body="There are no recent events to display for this Arka." />
            ) : (
              <div className="vault-activity-feed" data-testid="vault-activity-table">
                {activity.items.map((entry) => (
                  <article key={entry.eventId} className="surface-entry-card vault-activity-card public-detail-related-card-cutover" data-testid="vault-activity-card">
                    <div className="surface-entry-head">
                      <div>
                        <div className="surface-table-hint">{entry.kind}</div>
                        <strong className="surface-entry-title">
	                          {entry.assetContract ? resolveAssetDisplayLabel(entry.assetContract) : "Arka-owned action"}
                        </strong>
                      </div>
                      <StatusPill
                        label={entry.inSuccessfulContractCall ? "Confirmed" : "Not confirmed"}
                        tone={entry.inSuccessfulContractCall ? "positive" : "warning"}
                      />
                    </div>
                    {entry.amount || entry.netOut ? (
                      <div className="surface-entry-stats">
                        {entry.amount ? (
                          <span>
                            {formatBaseUnitAmount(entry.amount)}{entry.assetContract ? ` ${resolveAssetDisplayLabel(entry.assetContract)}` : ""}
                          </span>
                        ) : null}
                        {entry.netOut ? (
                          <span>{formatVaultDenominationAmount(entry.netOut, arka)} received</span>
                        ) : null}
                      </div>
                    ) : null}
                    <div className="surface-note">
	                      {entry.user ? formatContractLabel(entry.user, 8, 6) : "Arka-owned action"} · {formatRelativeTime(entry.ledgerClosedAt)}
                    </div>
                  </article>
                ))}
              </div>
            )}
          </Panel>
        </section>
      ) : null}

      {activeTab === "policies" ? (
        <section
          className="surface-grid surface-grid-two vault-detail-tab-panel vault-policies-grid public-detail-tab-panel-cutover"
          data-testid="vault-policies-tab"
        >
          <Panel
            title="Fees and issuance"
            subtitle="Current fee and token settings"
            testId="vault-policies-panel"
            className="vault-tab-workspace-panel vault-policies-fees-panel public-detail-panel-cutover"
          >
            <div className="vault-policy-grid" data-testid="vault-policies-table">
              {[
                ["Management fee", `${arka.fees.mgmtBps / 100}%`, "Continuous fee accrual"],
                ["Performance fee", `${arka.fees.perfBps / 100}%`, "High-water-mark settlement"],
                ["Deposit fee", `${arka.fees.depositBps / 100}%`, "Applied on capital entry"],
                ["Redeem fee", `${arka.fees.redeemBps / 100}%`, "Applied on capital exit"],
              ].map(([label, value, detail]) => (
                <article key={label} className="surface-entry-card vault-policy-card public-detail-related-card-cutover">
                  <div className="surface-list-label">{label}</div>
                  <strong className="surface-entry-title">{value}</strong>
                  <div className="surface-note">{detail}</div>
                </article>
              ))}
            </div>
          </Panel>

          <Panel
            title="Allowed assets"
            subtitle={`${arka.whitelistContracts.length} allowed entries`}
            testId="vault-whitelist-panel"
            className="vault-tab-workspace-panel vault-policies-whitelist-panel public-detail-panel-cutover"
          >
            <div className="vault-whitelist-grid" data-testid="vault-whitelist-table">
              {arka.whitelistContracts.map((contract) => (
                <article key={contract} className="surface-entry-card vault-whitelist-card public-detail-related-card-cutover">
	                  <div className="surface-list-label">Allowed asset</div>
	                  <strong className="surface-entry-title">{resolveAssetDisplayLabel(contract)}</strong>
	                  <div className="surface-note">Included in the Arka mandate</div>
                </article>
              ))}
            </div>
          </Panel>
        </section>
      ) : null}
      <IdentityEditDialog
        open={identityDialogOpen}
        title="Edit Arka profile"
        body="This updates the public Arka name and description. The current manager wallet must sign the change."
        draft={identityDraft}
        busy={identityBusy}
        error={identityError}
        onDraftChange={setIdentityDraft}
        onCancel={() => setIdentityDialogOpen(false)}
        onSave={() => void saveIdentity()}
        testId="vault-identity-edit-dialog"
      />
    </div>
  );
}
