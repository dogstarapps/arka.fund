"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  CURATED_ONLY_LABEL,
  STATUS_CURATED_LABEL,
  STATUS_DELISTED_LABEL,
  STATUS_INDEXED_LABEL,
} from "@/lib/config";
import {
  CatalogApiError,
  isCatalogConfigurationError,
  loadDiscoverBundle,
} from "@/lib/catalog/api";
import { buildCatalogFallbackUnavailableCopy } from "@/lib/catalog/errorPresentation";
import {
  buildDiscoverFeaturedArkas,
  buildDiscoverStageTiles,
  sortDiscoverFeaturedEntries,
  type DiscoverFeaturedMode,
} from "@/lib/catalog/dashboardDiscoverSurfaces";
import {
  formatBaseUnitAmount,
  formatContractLabel,
  formatRelativeTime,
  formatUsdBaseUnitAmount,
} from "@/lib/catalog/format";
import {
  resolveArkaDisplayName,
  resolveArkaSubtitle,
} from "@/lib/catalog/identity";
import {
  normalizeDiscoverUrlState,
  replaceBrowserQueryState,
} from "@/lib/workflows/publicSurfaceUrlState";
import type { ArkaHistoryPoint, DiscoverBundle } from "@/lib/catalog/types";
import {
  CatalogOfflineState,
  EmptyState,
  ErrorState,
  LoadingState,
  StatusPill,
  SurfaceLoadStatus,
} from "./surfacePrimitives";

interface DiscoverSurfaceState {
  status: "loading" | "ready" | "error";
  data: DiscoverBundle | null;
  error: string | null;
}

const INITIAL_STATE: DiscoverSurfaceState = {
  status: "loading",
  data: null,
  error: null,
};

const DISCOVER_FEATURE_CHART_WIDTH = 420;
const DISCOVER_FEATURE_CHART_HEIGHT = 160;

function formatDiscoverNavValue(value: string | number | null | undefined): string {
  if (value === null || value === undefined || value === "") return "$0.00";
  try {
    if (BigInt(String(value)) < BigInt(0)) return "$0.00";
    return formatUsdBaseUnitAmount(value);
  } catch {
    return "$0.00";
  }
}

function formatDiscoverArkaTvl(entry: {
  nav: string | null;
  navUsdEstimate: string | null;
  denominationSymbol: string | null;
}): string {
  if (entry.nav === null) return "Valuation unavailable";
  if (entry.navUsdEstimate !== null && entry.navUsdEstimate !== undefined) {
    return formatDiscoverNavValue(entry.navUsdEstimate);
  }
  if (!entry.denominationSymbol) {
    return "Valuation unavailable";
  }

  return `${formatBaseUnitAmount(entry.nav, 7, 2)} ${entry.denominationSymbol}`;
}

function buildDiscoverArkaHistoryPath(history: ArkaHistoryPoint[]) {
  const ordered = [...history]
    .filter((point) => point.nav !== null && Number.isFinite(Number(point.nav)))
    .sort(
      (left, right) =>
        new Date(left.syncedAt).getTime() - new Date(right.syncedAt).getTime(),
    );

  if (ordered.length < 2) {
    return {
      linePath: "",
      areaPath: "",
      deltaLabel: "New",
      pointCount: ordered.length,
      hasVariation: false,
    };
  }

  const values = ordered.map((point) => Number(point.nav));
  const min = Math.min(...values);
  const max = Math.max(...values);
  const hasVariation = max !== min;
  const spread = Math.max(1, max - min);
  const coords = ordered.map((point, index) => ({
    id: point.syncedAt,
    x:
      ordered.length === 1
        ? DISCOVER_FEATURE_CHART_WIDTH
        : (index / (ordered.length - 1)) * DISCOVER_FEATURE_CHART_WIDTH,
    y:
      DISCOVER_FEATURE_CHART_HEIGHT -
      18 -
      ((Number(point.nav) - min) / spread) *
        (DISCOVER_FEATURE_CHART_HEIGHT - 38),
  }));
  const linePath = coords
    .map(
      (point, index) =>
        `${index === 0 ? "M" : "L"} ${point.x.toFixed(1)} ${point.y.toFixed(1)}`,
    )
    .join(" ");
  const first = coords[0];
  const last = coords[coords.length - 1];
  const start = values[0];
  const end = values[values.length - 1];
  const deltaPct = start === 0 ? 0 : ((end - start) / Math.abs(start)) * 100;

  return {
    linePath,
    areaPath: `${linePath} L ${last.x.toFixed(1)} ${DISCOVER_FEATURE_CHART_HEIGHT} L ${first.x.toFixed(1)} ${DISCOVER_FEATURE_CHART_HEIGHT} Z`,
    deltaLabel: `${deltaPct >= 0 ? "+" : ""}${deltaPct.toFixed(2)}%`,
    pointCount: ordered.length,
    hasVariation,
  };
}

export default function DiscoverSurface({
  initialQuery = "",
}: {
  initialQuery?: string;
}) {
  const [initialUrlState] = useState(() =>
    typeof window === "undefined"
      ? normalizeDiscoverUrlState({ q: initialQuery })
      : normalizeDiscoverUrlState(new URLSearchParams(window.location.search)),
  );
  const [search, setSearch] = useState(
    initialUrlState.search || initialQuery,
  );
  const [curatedOnly, setCuratedOnly] = useState(
    initialUrlState.curatedOnly,
  );
  const [featuredMode, setFeaturedMode] =
    useState<DiscoverFeaturedMode>(initialUrlState.feature);
  const [state, setState] = useState<DiscoverSurfaceState>(INITIAL_STATE);
  const [reloadNonce, setReloadNonce] = useState(0);
  const searchQuery = search.trim();

  useEffect(() => {
    replaceBrowserQueryState({
      q: searchQuery || null,
      curated: curatedOnly ? "1" : null,
      feature: featuredMode === "ranked" ? null : featuredMode,
    });
  }, [curatedOnly, featuredMode, searchQuery]);

  useEffect(() => {
    const controller = new AbortController();
    const run = async () => {
      setState((current) => ({ ...current, status: "loading", error: null }));
      try {
        const data = await loadDiscoverBundle(
          {
            search: searchQuery || undefined,
            curated: curatedOnly ? true : undefined,
          },
          controller.signal,
        );
        setState({ status: "ready", data, error: null });
      } catch (error) {
        if (controller.signal.aborted) {
          return;
        }
        const message =
          error instanceof CatalogApiError
            ? error.message
            : error instanceof Error
              ? error.message
              : "Unable to load discovery data.";
        setState((current) => ({
          status: "error",
          data: current.data,
          error: message,
        }));
      }
    };
    void run();
    return () => controller.abort();
  }, [curatedOnly, reloadNonce, searchQuery]);

  if (state.status === "loading" && !state.data) {
    return (
      <LoadingState
        testId="discover-loading"
        title="Refreshing discovery"
        body="Loading Arka, manager and asset results for the current filters."
      />
    );
  }

  if ((state.status === "error" && !state.data) || !state.data) {
    if (isCatalogConfigurationError(state.error)) {
      const offlineCopy = buildCatalogFallbackUnavailableCopy("discover");
      return (
        <CatalogOfflineState
          testId="discover-catalog-offline"
          title={offlineCopy.title}
          body={offlineCopy.body}
          onRetry={() => setReloadNonce((value) => value + 1)}
        />
      );
    }
    return (
      <ErrorState
        testId="discover-error"
        title="Discovery unavailable"
        body={state.error ?? "The discovery surface could not be loaded."}
        actionLabel="Retry"
        onAction={() => setReloadNonce((value) => value + 1)}
      />
    );
  }

  const stageTiles = buildDiscoverStageTiles(state.data, { curatedOnly }).filter(
    (tile) => ["arkas", "nav", "managers", "assets"].includes(tile.id),
  );
  const discoverEntries = curatedOnly
    ? state.data.arkas.items.filter((entry) => entry.curated)
    : state.data.arkas.items;
  const featuredSource = sortDiscoverFeaturedEntries(
    discoverEntries,
    featuredMode,
    searchQuery,
  );
  const featuredArkas = buildDiscoverFeaturedArkas(featuredSource);
  const refreshInFlight = state.status === "loading" && Boolean(state.data);
  const showingStaleData = state.status === "error" && Boolean(state.data);

  return (
    <div
      className="surface-stack discover-fidelity-shell public-screen-safe-zone public-hero-safe-cutover discover-hero-safe-cutover"
      data-testid="discover-fidelity-shell"
      aria-busy={refreshInFlight}
      data-loading-state={refreshInFlight ? "refreshing" : "idle"}
    >
      {refreshInFlight ? (
        <SurfaceLoadStatus
          testId="discover-refresh-status"
          title="Refreshing visible data"
          body="Keeping the current results visible while the latest filters resolve."
        />
      ) : null}
      {showingStaleData && state.error ? (
        <SurfaceLoadStatus
          testId="discover-stale-status"
          tone="warning"
          title="Latest refresh failed"
          body={`Last successful discovery view remains visible. ${state.error}`}
        />
      ) : null}
      <section
        className="surface-panel public-command-board discover-stage-panel discover-t03-first-fold discover-figma-board public-hero-board-cutover discover-hero-board-cutover"
        data-testid="discover-command-board"
      >
        <div
          className="discover-public-metric-board discover-t03-metric-board public-hero-metric-lane-cutover discover-hero-metric-lane"
          data-testid="discover-public-metric-board"
        >
          <div
            className="discover-stage-titlebar discover-t03-titlebar discover-figma-titlebar public-hero-titlebar-cutover discover-hero-titlebar"
            data-testid="discover-stage-titlebar"
          >
            <div className="discover-stage-heading">
              <span className="surface-eyebrow">Discover</span>
              <h1 className="discover-stage-title">Discover</h1>
            </div>
          </div>

          <div className="discover-stage-topline discover-figma-tabline">
            <div
              className="surface-tab-strip discover-stage-tabs discover-figma-tabs public-hero-tabline-cutover discover-hero-tabline"
              data-testid="discover-feature-tabs"
            >
              <button
                type="button"
                className={`surface-tab${featuredMode === "ranked" ? " surface-tab-active" : ""}`}
                data-testid="discover-feature-tab-ranked"
                aria-pressed={featuredMode === "ranked"}
                aria-controls="discover-featured-arkas"
                onClick={() => setFeaturedMode("ranked")}
              >
                <span>Top</span>{" "}<span>ranked</span>
              </button>
              <button
                type="button"
                className={`surface-tab${featuredMode === "profit" ? " surface-tab-active" : ""}`}
                data-testid="discover-feature-tab-profit"
                aria-pressed={featuredMode === "profit"}
                aria-controls="discover-featured-arkas"
                onClick={() => setFeaturedMode("profit")}
              >
                <span>Highest</span>{" "}<span>profit</span>
              </button>
              <button
                type="button"
                className={`surface-tab${featuredMode === "search" ? " surface-tab-active" : ""}`}
                data-testid="discover-feature-tab-search"
                aria-pressed={featuredMode === "search"}
                aria-controls="discover-featured-arkas"
                onClick={() => setFeaturedMode("search")}
              >
                <span>Search</span>{" "}<span>matches</span>
              </button>
            </div>
          </div>

          <section
            className="discover-stage-grid discover-figma-metric-grid public-hero-metric-deck-cutover discover-hero-metric-deck"
            data-testid="discover-summary-grid"
          >
            {stageTiles.map((tile) => (
              <article
                key={tile.id}
                className={`discover-stage-tile discover-figma-metric-card discover-figma-metric-card-${tile.id} public-figma-metric-card public-figma-metric-card-${tile.tone} public-figma-metric-card-${tile.id} discover-stage-tile-${tile.tone}`}
                data-testid={`discover-stage-metric-${tile.id}`}
              >
                <div className="public-figma-metric-head discover-stage-tile-head discover-figma-metric-head">
                  <span className="public-figma-metric-icon" aria-hidden="true" />
                  <span className="discover-stage-tile-label">{tile.label}</span>
                </div>
                <strong className="discover-stage-tile-value public-figma-metric-value">
	                  {tile.valueKind === "amount"
	                    ? formatDiscoverNavValue(tile.value)
	                    : tile.value}
                </strong>
                <span className="discover-stage-tile-detail public-figma-metric-detail">
                  {tile.detail}
                </span>
              </article>
            ))}
          </section>
        </div>

        <div
          className="discover-public-collection-board discover-t03-collection-board public-hero-collection-lane-cutover discover-hero-collection-lane"
          data-testid="discover-public-collection-board"
        >

        <div
          className="discover-figma-market-switcher discover-t03-market-switcher"
          data-testid="discover-figma-market-switcher"
          aria-label="Discover Arka categories"
        >
          <button
            type="button"
            className={`discover-figma-market-pill${featuredMode === "ranked" && !curatedOnly ? " discover-figma-market-pill-active" : ""}`}
            data-testid="discover-market-popular"
            aria-pressed={featuredMode === "ranked" && !curatedOnly}
            onClick={() => {
              setCuratedOnly(false);
              setFeaturedMode("ranked");
            }}
          >
            <span>Popular</span> Arkas
          </button>
          <button
            type="button"
            className={`discover-figma-market-pill${featuredMode === "ranked" && curatedOnly ? " discover-figma-market-pill-active" : ""}`}
            data-testid="discover-market-curated"
            aria-pressed={featuredMode === "ranked" && curatedOnly}
            onClick={() => {
              setCuratedOnly(true);
              setFeaturedMode("ranked");
            }}
          >
            <span>Curated</span> Arkas
          </button>
          <button
            type="button"
            className={`discover-figma-market-pill${featuredMode === "fresh" ? " discover-figma-market-pill-active" : ""}`}
            data-testid="discover-market-fresh"
            aria-pressed={featuredMode === "fresh"}
            onClick={() => setFeaturedMode("fresh")}
          >
            <span>New</span> Arkas
          </button>
        </div>

        {featuredArkas.length === 0 ? (
          <EmptyState
            title="No Arkas match this filter"
            body={curatedOnly
              ? "No curated Arkas match the current search."
              : "Try another search to see more Arkas."}
            testId="discover-empty"
          />
        ) : (
          <section
            className="discover-figma-preview-grid discover-t03-preview-grid public-hero-card-grid-cutover discover-hero-card-grid"
            data-testid="discover-figma-preview-grid"
            aria-label="Featured Arka preview cards"
          >
            {featuredArkas.map((entry) => {
            const history = state.data?.featuredHistory?.[entry.arkaId]?.items ?? [];
            const historyPath = buildDiscoverArkaHistoryPath(history);
            const arkaTvlLabel = formatDiscoverArkaTvl(entry);
            const hasUsdValuation =
              entry.navUsdEstimate !== null && entry.navUsdEstimate !== undefined;
            const arkaTvlMetricLabel = arkaTvlLabel;
            const hasTvlHistoryChart = Boolean(
              hasUsdValuation && historyPath.hasVariation && historyPath.linePath,
            );
            return (
              <article
                key={entry.arkaId}
                className="surface-entry-card dashboard-feature-card dashboard-discover-feature-card discover-figma-preview-card"
                data-testid="discover-figma-preview-card"
              >
                <div className="dashboard-feature-figma-head">
                  <div className="dashboard-feature-brand-mark" aria-hidden="true" />
                  <div className="dashboard-feature-brand-copy">
	                    <div className="surface-entry-title">
	                      {resolveArkaDisplayName(entry)}
	                    </div>
	                    <div className="surface-table-subtle">
	                      {resolveArkaSubtitle(entry)}
	                    </div>
                  </div>
                  <StatusPill
                    label={entry.curated ? STATUS_CURATED_LABEL : STATUS_INDEXED_LABEL}
                    tone={entry.curated ? "positive" : "neutral"}
                  />
                </div>

                <div className="dashboard-feature-figma-metrics">
                  <div>
                    <span className="surface-list-label">Assets</span>
                    <strong>{entry.assetCount}</strong>
                  </div>
                  <div>
                    <span className="surface-list-label">TVL</span>
                    <strong>{arkaTvlMetricLabel}</strong>
                  </div>
                </div>

                {hasTvlHistoryChart ? (
                  <div
                    className="dashboard-feature-chart"
                    data-testid="discover-feature-chart"
                    aria-label={`${historyPath.pointCount} value history points for ${formatContractLabel(entry.arkaId, 10, 4)}`}
                  >
                    <svg
                      viewBox={`0 0 ${DISCOVER_FEATURE_CHART_WIDTH} ${DISCOVER_FEATURE_CHART_HEIGHT}`}
                      role="img"
                    >
                      <path d={historyPath.areaPath} className="dashboard-feature-chart-area" />
                      <path d={historyPath.linePath} className="dashboard-feature-chart-line" />
                    </svg>
                  </div>
                ) : (
                  <div
                    className="dashboard-feature-chart dashboard-feature-chart-empty"
                    data-testid="discover-feature-chart-empty"
                  >
                    <span>Performance history will appear after the value changes.</span>
                  </div>
                )}

                <div
                  className="discover-figma-card-summary"
                  data-testid="discover-figma-card-summary"
                >
                  <div>
                    <span className="surface-list-label">
                      <span>Manager</span>
                      <span aria-hidden="true">: </span>
                    </span>
                    <strong>{formatContractLabel(entry.manager, 8, 5)}</strong>
                  </div>
                  <div>
                    <span className="surface-list-label">
                      <span>Updated</span>
                      <span aria-hidden="true">: </span>
                    </span>
                    <strong>{formatRelativeTime(entry.syncedAt)}</strong>
                  </div>
                </div>
                <div className="dashboard-feature-meta">
                  <span>{entry.assetCount} assets</span>
	                  <span>{entry.whitelistCount} allowed assets</span>
                </div>
                <div className="surface-chip-wrap">
                  {entry.feesLabel.split(" · ").map((feeLabel) => (
                    <StatusPill key={feeLabel} label={feeLabel} tone="neutral" />
                  ))}
                  {entry.delisted ? (
                    <StatusPill label={STATUS_DELISTED_LABEL} tone="warning" />
                  ) : null}
                </div>
                <div className="surface-entry-actions dashboard-feature-actions">
                  <Link href={`/vaults/${entry.arkaId}`} className="surface-table-link">
                    Open profile
                  </Link>
                </div>
              </article>
            );
            })}
          </section>
        )}

        <div
          className="discover-stage-toolbar discover-t03-toolbar discover-figma-toolbar public-hero-toolbar-cutover discover-hero-toolbar"
          data-testid="discover-stage-toolbar"
        >
          <label className="discover-stage-search discover-figma-search">
            <span className="surface-list-label">Search</span>
            <input
              data-testid="discover-search-input"
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search vaults, managers or assets"
              className="discover-input"
            />
          </label>

          <div className="discover-stage-actions discover-figma-actions">
            <label className="discover-toggle">
              <input
                data-testid="discover-curated-toggle"
                type="checkbox"
                checked={curatedOnly}
                onChange={(event) => {
                  setCuratedOnly(event.target.checked);
                }}
              />
              <span>{CURATED_ONLY_LABEL}</span>
            </label>
            <Link
              href="/vaults"
              className="surface-button surface-button-secondary"
            >
              Arkas leaderboard
            </Link>
          </div>
        </div>

        </div>
      </section>

    </div>
  );
}
