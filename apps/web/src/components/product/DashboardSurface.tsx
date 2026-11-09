"use client";

import Link from "next/link";
import WalletPortfolioSurface from './WalletPortfolioSurface';
import { useEffect, useState } from "react";
import { STATUS_CURATED_LABEL, STATUS_INDEXED_LABEL } from "@/lib/config";
import {
  CatalogApiError,
  isCatalogConfigurationError,
  loadArkaInvestorCounts,
  loadDashboardBundle,
  loadManagedArkasPage,
} from "@/lib/catalog/api";
import { buildCatalogFallbackUnavailableCopy } from "@/lib/catalog/errorPresentation";
import {
  formatAssetAmount,
  formatContractLabel,
  formatRelativeTime,
  formatUsdBaseUnitAmount,
} from "@/lib/catalog/format";
import { resolveArkaDisplayName, resolveArkaSubtitle } from "@/lib/catalog/identity";
import { formatInvestorCountLabel } from "@/lib/catalog/holderPresentation";
import {
  buildDashboardFeaturedArkas,
  buildDashboardFeaturedEmptyCopy,
  buildDashboardFigmaMetricTiles,
  type DashboardFeaturedMode,
  type PublicFigmaMetricTile,
} from "@/lib/catalog/dashboardDiscoverSurfaces";
import {
  normalizeDashboardUrlState,
  replaceBrowserQueryState,
} from "@/lib/workflows/publicSurfaceUrlState";
import type { ArkaInvestorCount } from "@/lib/catalog/api";
import type { DashboardBundle, Page, RankedArkaCatalogEntry } from "@/lib/catalog/types";
import { readStoredWalletPubkey } from "@/lib/operatorAccessClient";
import {
  CatalogOfflineState,
  EmptyState,
  ErrorState,
  LoadingState,
  StatusPill,
  SurfaceLoadStatus,
} from "./surfacePrimitives";

interface DashboardSurfaceState {
  status: "loading" | "ready" | "error";
  data: DashboardBundle | null;
  error: string | null;
}

const INITIAL_STATE: DashboardSurfaceState = {
  status: "loading",
  data: null,
  error: null,
};

function formatDashboardArkaTvl(entry: {
  nav: string | null;
  navUsdEstimate: string | null;
  denominationSymbol: string | null;
}): string {
  if (entry.nav === null) return "Valuation unavailable";
  if (entry.navUsdEstimate !== null && entry.navUsdEstimate !== undefined) {
    return formatUsdBaseUnitAmount(entry.navUsdEstimate);
  }
  if (!entry.denominationSymbol) return "Valuation unavailable";
  return `${formatAssetAmount(entry.nav)} ${entry.denominationSymbol}`;
}

function formatMetricValue(tile: PublicFigmaMetricTile): string {
  return tile.valueKind === "amount" ? formatUsdBaseUnitAmount(tile.value) : tile.value;
}

export default function DashboardSurface() {
  const [initialUrlState] = useState(() =>
    typeof window === "undefined"
      ? normalizeDashboardUrlState({})
      : normalizeDashboardUrlState(new URLSearchParams(window.location.search)),
  );
  const [state, setState] = useState<DashboardSurfaceState>(INITIAL_STATE);
  const [reloadNonce, setReloadNonce] = useState(0);
  const [featuredMode, setFeaturedMode] =
    useState<DashboardFeaturedMode>(initialUrlState.feature);
  const [walletPubkey, setWalletPubkey] = useState("");
  const [managedArkas, setManagedArkas] = useState<Page<RankedArkaCatalogEntry> | null>(null);
  const [investorCounts, setInvestorCounts] = useState<Record<string, ArkaInvestorCount>>({});

  useEffect(() => {
    const controller = new AbortController();
    const run = async () => {
      setState((current) => ({ ...current, status: "loading", error: null }));
      try {
        const data = await loadDashboardBundle(controller.signal);
        setState({ status: "ready", data, error: null });
      } catch (error) {
        if (controller.signal.aborted) return;
        const message =
          error instanceof CatalogApiError
            ? error.message
            : error instanceof Error
              ? error.message
              : "Unable to load dashboard data.";
        setState((current) => ({ status: "error", data: current.data, error: message }));
      }
    };
    void run();
    return () => controller.abort();
  }, [reloadNonce]);

  useEffect(() => {
    replaceBrowserQueryState({ feature: featuredMode === "ranked" ? null : featuredMode });
  }, [featuredMode]);

  useEffect(() => {
    const syncWallet = (value?: string) => {
      setWalletPubkey((value ?? readStoredWalletPubkey()).trim());
    };
    const onWalletChanged = (event: Event) => {
      const detail = event instanceof CustomEvent && typeof event.detail === "string"
        ? event.detail
        : undefined;
      syncWallet(detail);
    };
    const onStorage = (event: StorageEvent) => {
      if (event.key === "wallet:pubkey") syncWallet(event.newValue ?? "");
    };
    syncWallet();
    window.addEventListener("wallet:pubkey-changed", onWalletChanged);
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener("wallet:pubkey-changed", onWalletChanged);
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  useEffect(() => {
    if (!walletPubkey) {
      setManagedArkas(null);
      return;
    }
    const controller = new AbortController();
    void loadManagedArkasPage(walletPubkey, controller.signal)
      .then(setManagedArkas)
      .catch(() => {
        if (!controller.signal.aborted) setManagedArkas(null);
      });
    return () => controller.abort();
  }, [walletPubkey]);

  useEffect(() => {
    const arkaIds = Array.from(new Set([
      ...(state.data?.arkas.items.map((entry) => entry.arkaId) ?? []),
      ...(managedArkas?.items.map((entry) => entry.arkaId) ?? []),
    ]));
    if (arkaIds.length === 0) {
      setInvestorCounts({});
      return;
    }
    const controller = new AbortController();
    void loadArkaInvestorCounts(arkaIds, controller.signal).then((counts) => {
      if (!controller.signal.aborted) setInvestorCounts(counts);
    });
    return () => controller.abort();
  }, [managedArkas, state.data]);

  if (featuredMode === 'mine') return <WalletPortfolioSurface mode="investor" />;

  if (state.status === "loading" && !state.data) {
    return <LoadingState testId="dashboard-loading" title="Loading dashboard" body="Loading portfolio values and current Arkas." />;
  }

  if ((state.status === "error" && !state.data) || !state.data) {
    if (isCatalogConfigurationError(state.error)) {
      const offlineCopy = buildCatalogFallbackUnavailableCopy("dashboard");
      return (
        <CatalogOfflineState
          testId="dashboard-catalog-offline"
          title={offlineCopy.title}
          body={offlineCopy.body}
          onRetry={() => setReloadNonce((value) => value + 1)}
        />
      );
    }
    return (
      <ErrorState
        testId="dashboard-error"
        title="Dashboard unavailable"
        body={state.error ?? "The dashboard could not be loaded."}
        actionLabel="Retry"
        onAction={() => setReloadNonce((value) => value + 1)}
      />
    );
  }

  const dashboardData = state.data;
  const figmaMetricTiles = buildDashboardFigmaMetricTiles(dashboardData);
  const featuredSource =
    featuredMode === "curated"
      ? dashboardData.arkas.items.filter((entry) => entry.curated)
      : featuredMode === "fresh"
        ? [...dashboardData.arkas.items].sort((left, right) => right.syncedAt.localeCompare(left.syncedAt))
        : dashboardData.arkas.items;
  const featuredDisplayArkas = buildDashboardFeaturedArkas(featuredSource, dashboardData.overview.totalNav, 3);
  const featuredEmptyCopy = buildDashboardFeaturedEmptyCopy(featuredMode);
  const refreshInFlight = state.status === "loading";
  const showingStaleData = state.status === "error";

  return (
    <div
      className="surface-stack dashboard-shell-fidelity public-screen-safe-zone public-hero-safe-cutover dashboard-hero-safe-cutover dashboard-t04-shell"
      data-testid="dashboard-fidelity-shell"
      aria-busy={refreshInFlight}
    >
      {refreshInFlight ? (
        <SurfaceLoadStatus testId="dashboard-refresh-status" title="Refreshing dashboard" body="The current view remains available while data refreshes." />
      ) : null}
      {showingStaleData && state.error ? (
        <SurfaceLoadStatus testId="dashboard-stale-status" tone="warning" title="Latest update unavailable" body="Showing the most recent available data." />
      ) : null}

      <section
        className="dashboard-discover-frame public-hero-board-cutover dashboard-hero-board-cutover"
        data-testid="dashboard-arkas-panel"
        aria-labelledby="dashboard-discover-title"
      >
        <div className="dashboard-discover-metric-board public-hero-metric-lane-cutover dashboard-hero-metric-lane">
          <div className="dashboard-discover-titlebar public-hero-titlebar-cutover dashboard-hero-titlebar">
            <div><span className="surface-eyebrow">Overview</span><h1 id="dashboard-discover-title">Dashboard</h1></div>
            <Link href="/arkas" className="surface-table-link" data-testid="dashboard-view-all-arkas">View all Arkas</Link>
          </div>

          <div className="ux-task-entrypoints"><Link href="/discover" className="surface-button surface-button-primary">Explore funds</Link><Link href="/investments" className="surface-button surface-button-secondary">My investments</Link><Link href="/manage" className="surface-button surface-button-secondary">Manage funds</Link></div>
          <p className="surface-note">Choose a fund to invest, or manage a fund’s portfolio. These are different roles.</p>
          <details className="ux-platform-metrics"><summary>Platform statistics and service health</summary>
          <p className="surface-note">Global catalog data, not your wallet. Activity reflects indexed coverage. Service health is not a guarantee of withdrawals.</p>
          <div
            className="public-figma-metric-deck dashboard-figma-metric-deck public-hero-metric-deck-cutover dashboard-hero-metric-deck"
            data-testid="dashboard-figma-metric-deck"
            aria-label="Dashboard metrics"
          >
            {figmaMetricTiles.map((tile) => (
              <article key={tile.id} className={`public-figma-metric-card public-figma-metric-card-${tile.tone} public-figma-metric-card-${tile.id}`} data-testid={`dashboard-figma-metric-${tile.id}`}>
                <div className="public-figma-metric-head"><span className="public-figma-metric-icon" aria-hidden="true" /><strong>{tile.label}</strong></div>
                <div className="public-figma-metric-value">{formatMetricValue(tile)}</div>
                <p className="public-figma-metric-detail">{tile.detail}</p>
              </article>
            ))}
          </div>
          </details>
        </div>

        <div className="dashboard-discover-collection-board public-hero-collection-lane-cutover dashboard-hero-collection-lane">
          <div className="surface-tab-strip dashboard-spotlight-tabs dashboard-discover-tabs public-hero-tabline-cutover dashboard-hero-tabline" data-testid="dashboard-spotlight-tabs" aria-label="Featured Arkas">
            {([ ["ranked", "Popular Arkas"], ["curated", "Curated Arkas"], ["fresh", "New Arkas"], ["mine", "My investments"] ] as const).map(([id, label]) => (
              <button key={id} type="button" className={`surface-tab dashboard-discover-tab ${featuredMode === id ? "surface-tab-active" : ""}`} aria-pressed={featuredMode === id} data-testid={`dashboard-featured-tab-${id}`} onClick={() => setFeaturedMode(id)}>{label}</button>
            ))}
          </div>

          {featuredDisplayArkas.length === 0 ? (
            <EmptyState title={featuredEmptyCopy.title} body={featuredEmptyCopy.body} testId="dashboard-featured-empty" />
          ) : (
            <div className="dashboard-feature-grid dashboard-discover-feature-grid public-hero-card-grid-cutover dashboard-hero-card-grid dashboard-t04-feature-grid" data-testid="dashboard-arkas-table">
              {featuredDisplayArkas.map((entry) => {
                const arkaTvlLabel = formatDashboardArkaTvl(entry);
                const arkaDisplayName = resolveArkaDisplayName(entry);
                const investorCount = investorCounts[entry.arkaId];
                return (
                  <article key={entry.arkaId} className="surface-entry-card dashboard-feature-card dashboard-discover-feature-card dashboard-t04-feature-card" data-testid="dashboard-spotlight-card">
                    <div className="dashboard-feature-figma-head">
                      <div className="dashboard-feature-brand-mark" aria-hidden="true" />
                      <div className="dashboard-feature-brand-copy"><div className="surface-entry-title" title={arkaDisplayName}>{arkaDisplayName}</div><div className="surface-table-subtle" title={resolveArkaSubtitle(entry)}>{resolveArkaSubtitle(entry)}</div></div>
                      <StatusPill label={entry.curated ? STATUS_CURATED_LABEL : STATUS_INDEXED_LABEL} tone={entry.curated ? "positive" : "neutral"} />
                    </div>
                    <div className="dashboard-feature-figma-metrics">
                      <div><span className="surface-list-label">Assets</span><strong>{entry.assetCount}</strong></div>
                      <div><span className="surface-list-label">TVL</span><strong>{arkaTvlLabel}</strong></div>
                    </div>
                    <div className="dashboard-feature-price-band dashboard-t04-feature-price-band">
                      <strong>{arkaTvlLabel}</strong>
                      <span>
                        TVL{investorCount ? ` · ${formatInvestorCountLabel(investorCount.total, investorCount.complete)}` : ""}
                      </span>
                    </div>
                    <div className="discover-figma-card-summary">
                      <div><span className="surface-list-label">Manager</span><strong>{formatContractLabel(entry.manager, 8, 5)}</strong></div>
                      <div><span className="surface-list-label">Updated</span><strong>{formatRelativeTime(entry.syncedAt)}</strong></div>
                    </div>
                    <div className="surface-chip-wrap">
                      {entry.feesLabel.split(" · ").map((feeLabel) => (
                        <StatusPill key={feeLabel} label={feeLabel} tone="neutral" />
                      ))}
                    </div>
                    <div className="surface-entry-actions dashboard-feature-actions"><Link href={`/arkas/${entry.arkaId}`} className="surface-table-link">Open Arka</Link></div>
                  </article>
                );
              })}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
