"use client";

import Link from "next/link";
import ArkaVersionBadge from "./ArkaVersionBadge";
import { useDeferredValue, useEffect, useState } from "react";
import {
  CURATED_ONLY_LABEL,
} from "@/lib/config";
import {
  CatalogApiError,
  isCatalogConfigurationError,
  loadArkaInvestorCounts,
  loadVaultLeaderboardResolvedPage,
} from "@/lib/catalog/api";
import type { ArkaInvestorCount } from "@/lib/catalog/api";
import { buildCatalogFallbackUnavailableCopy } from "@/lib/catalog/errorPresentation";
import {
  formatContractLabel,
  formatRelativeTime,
  formatUsdBaseUnitAmount,
} from "@/lib/catalog/format";
import {
  resolveArkaDisplayName,
} from "@/lib/catalog/identity";
import { formatInvestorCountLabel } from "@/lib/catalog/holderPresentation";
import {
  VAULT_LEADERBOARD_WINDOW_OPTIONS,
  buildVaultLeaderboardRows,
  buildVaultPublicMetricDeck,
  buildVaultRouteSet,
  filterVaultLeaderboardPageByWindow,
  type VaultPublicMetricTile,
  type VaultLeaderboardWindow,
} from "@/lib/catalog/vaults";
import {
  normalizeVaultsUrlState,
  replaceBrowserQueryState,
  type VaultFeaturedMode,
} from "@/lib/workflows/publicSurfaceUrlState";
import type {
  Page,
  RankedArkaCatalogEntry,
  VaultResolvedMetrics,
  VaultSortMetric,
  VaultSortOrder,
} from "@/lib/catalog/types";
import {
  EmptyState,
  CatalogOfflineState,
  ErrorState,
  LoadingState,
  Panel,
  SurfaceTable,
  StatusPill,
  SurfaceLoadStatus,
} from "./surfacePrimitives";

interface VaultLeaderboardState {
  status: "loading" | "ready" | "error";
  data: Page<RankedArkaCatalogEntry> | null;
  derivedMetrics: Record<string, VaultResolvedMetrics>;
  error: string | null;
}

const INITIAL_STATE: VaultLeaderboardState = {
  status: "loading",
  data: null,
  derivedMetrics: {},
  error: null,
};

const SORT_LABELS: Record<VaultSortMetric, string> = {
  rank: "Rank",
  nav: "TVL",
  profit: "Profit",
  volume: "Volume",
};

function resolveDisplayMetric(
  metricMap: Record<string, VaultResolvedMetrics>,
  arkaId: string,
  metric: "profit" | "volume",
): number | null {
  return metricMap[arkaId]?.[metric].value ?? null;
}

function formatVaultPublicMetricValue(tile: VaultPublicMetricTile): string {
  if (tile.valueKind === "amount") return formatUsdBaseUnitAmount(tile.value);
  return tile.value;
}

function resolveVaultPublicMetricTestId(tile: VaultPublicMetricTile): string {
  if (tile.id === "managed") return "vaults-total-nav";
  if (tile.id === "coverage") return "vaults-curated-coverage";
  if (tile.id === "assetSpan") return "vaults-asset-span";
  return `vault-public-metric-${tile.id}`;
}

export default function VaultLeaderboardSurface() {
  const [initialUrlState] = useState(() =>
    typeof window === "undefined"
      ? normalizeVaultsUrlState({})
      : normalizeVaultsUrlState(new URLSearchParams(window.location.search)),
  );
  const [search, setSearch] = useState(initialUrlState.search);
  const [curatedOnly, setCuratedOnly] = useState(
    initialUrlState.curatedOnly,
  );
  const [sortMetric, setSortMetric] = useState<VaultSortMetric>(
    initialUrlState.sortMetric,
  );
  const [sortOrder, setSortOrder] = useState<VaultSortOrder>(
    initialUrlState.sortOrder,
  );
  const [featuredMode, setFeaturedMode] = useState<VaultFeaturedMode>(
    initialUrlState.feature,
  );
  const [windowMode, setWindowMode] = useState<VaultLeaderboardWindow>(
    initialUrlState.window,
  );
  const [listPage, setListPage] = useState(0);
  const [reloadNonce, setReloadNonce] = useState(0);
  const [state, setState] = useState<VaultLeaderboardState>(INITIAL_STATE);
  const [investorCounts, setInvestorCounts] = useState<Record<string, ArkaInvestorCount>>({});
  const deferredSearch = useDeferredValue(search.trim());

  useEffect(() => {
    const controller = new AbortController();
    const run = async () => {
      setState((current) => ({ ...current, status: "loading", error: null }));
      try {
        const payload = await loadVaultLeaderboardResolvedPage(
          {
            search: deferredSearch || undefined,
            curatedOnly,
            sortMetric,
            sortOrder,
            limit: 24,
            offset: 0,
          },
          controller.signal,
        );
        setState({
          status: "ready",
          data: payload.page,
          derivedMetrics: payload.derivedMetrics,
          error: null,
        });
        const counts = await loadArkaInvestorCounts(
          payload.page.items.map((entry) => entry.arkaId),
          controller.signal,
        );
        if (!controller.signal.aborted) setInvestorCounts(counts);
      } catch (error) {
        if (controller.signal.aborted) {
          return;
        }
        const message =
          error instanceof CatalogApiError
            ? error.message
            : error instanceof Error
              ? error.message
              : "Unable to load the Arka leaderboard.";
        setState((current) => ({
          status: "error",
          data: current.data,
          derivedMetrics: current.derivedMetrics,
          error: message,
        }));
      }
    };
    void run();
    return () => controller.abort();
  }, [curatedOnly, deferredSearch, reloadNonce, sortMetric, sortOrder]);

  useEffect(() => {
    replaceBrowserQueryState({
      q: deferredSearch || null,
      curated: curatedOnly ? "1" : null,
      sort: sortMetric === "rank" ? null : sortMetric,
      order:
        (sortMetric === "rank" && sortOrder === "asc") ||
        (sortMetric !== "rank" && sortOrder === "desc")
          ? null
          : sortOrder,
      feature: featuredMode === "ranked" ? null : featuredMode,
      window: windowMode === "all" ? null : windowMode,
    });
  }, [curatedOnly, deferredSearch, featuredMode, sortMetric, sortOrder, windowMode]);

  useEffect(() => {
    setListPage(0);
  }, [curatedOnly, deferredSearch, sortMetric, sortOrder, windowMode]);

  if (state.status === "loading" && !state.data) {
    return (
      <LoadingState
        title="Loading Arka leaderboard"
        body="Loading TVL, fee and status data for ranked Arkas."
        testId="vaults-loading"
      />
    );
  }

  if ((state.status === "error" && !state.data) || !state.data) {
    if (isCatalogConfigurationError(state.error)) {
      const offlineCopy = buildCatalogFallbackUnavailableCopy("vaults");
      return (
        <CatalogOfflineState
          testId="vaults-catalog-offline"
          title={offlineCopy.title}
          body={offlineCopy.body}
          onRetry={() => setReloadNonce((value) => value + 1)}
        />
      );
    }
    return (
      <ErrorState
        title="Arka leaderboard unavailable"
        body={state.error ?? "The ranked Arka view could not be loaded."}
        actionLabel="Retry"
        onAction={() => setReloadNonce((value) => value + 1)}
        testId="vaults-error"
      />
    );
  }

  const windowedPage = filterVaultLeaderboardPageByWindow(state.data, windowMode);
  const activeWindowOption =
    VAULT_LEADERBOARD_WINDOW_OPTIONS.find((option) => option.id === windowMode) ??
    {
      id: "all" as const,
      label: "All",
      detail: "Every available entry.",
    };
  const entryById = new Map(windowedPage.items.map((entry) => [entry.arkaId, entry]));
  const rows = buildVaultLeaderboardRows(windowedPage);
  const rowsPerPage = 6;
  const pageCount = Math.max(1, Math.ceil(rows.length / rowsPerPage));
  const safeListPage = Math.min(listPage, pageCount - 1);
  const visibleRows = rows.slice(
    safeListPage * rowsPerPage,
    (safeListPage + 1) * rowsPerPage,
  );
  const publicMetricTiles = buildVaultPublicMetricDeck(
    windowedPage,
    state.derivedMetrics,
    { windowLabel: activeWindowOption.label },
  ).filter((tile) => tile.id !== "leaderShare" && tile.id !== "assetSpan");
  const refreshInFlight = state.status === "loading" && Boolean(state.data);
  const showingStaleData = state.status === "error" && Boolean(state.data);
  const selectFeaturedMode = (mode: VaultFeaturedMode) => {
    setFeaturedMode(mode);
    setSortMetric(mode === "ranked" ? "rank" : mode);
    setSortOrder(mode === "ranked" ? "asc" : "desc");
  };

  return (
    <div
      className="surface-stack vaults-fidelity-shell"
      data-testid="vaults-fidelity-shell"
      aria-busy={refreshInFlight}
      data-loading-state={refreshInFlight ? "refreshing" : "idle"}
    >
      <section className="surface-panel vaults-stage-panel vaults-stage-panel-cutover">
        <div className="vaults-stage-topline">
          <div className="vaults-stage-heading">
            <span className="surface-eyebrow">Arkas</span>
            <h1 className="vaults-stage-title">Arkas Leaderboard</h1>
          </div>
          <div className="surface-tab-strip vault-leaderboard-tabs" data-testid="vaults-leaderboard-tabs">
            <button
              type="button"
              className={`surface-tab${featuredMode === "ranked" ? " surface-tab-active" : ""}`}
              data-testid="vaults-featured-tab-ranked"
              aria-pressed={featuredMode === "ranked"}
              aria-controls="vaults-leaderboard-panel"
              onClick={() => selectFeaturedMode("ranked")}
            >
              Top ranked
            </button>
            <button
              type="button"
              className={`surface-tab${featuredMode === "profit" ? " surface-tab-active" : ""}`}
              data-testid="vaults-featured-tab-profit"
              aria-pressed={featuredMode === "profit"}
              aria-controls="vaults-leaderboard-panel"
              onClick={() => selectFeaturedMode("profit")}
            >
              High profit
            </button>
            <button
              type="button"
              className={`surface-tab${featuredMode === "volume" ? " surface-tab-active" : ""}`}
              data-testid="vaults-featured-tab-volume"
              aria-pressed={featuredMode === "volume"}
              aria-controls="vaults-leaderboard-panel"
              onClick={() => selectFeaturedMode("volume")}
            >
              High volume
            </button>
          </div>
        </div>

        <div
          className="public-figma-metric-deck vaults-public-metric-deck"
          data-testid="vaults-public-metric-deck"
          aria-label="Arka leaderboard metrics"
        >
          {publicMetricTiles.map((tile) => (
            <article
              key={tile.id}
              className={`public-figma-metric-card public-figma-metric-card-${tile.tone} public-figma-metric-card-${tile.id}`}
              data-testid={resolveVaultPublicMetricTestId(tile)}
            >
              <div className="public-figma-metric-head">
                <span className="public-figma-metric-icon" aria-hidden="true" />
                <strong>{tile.label}</strong>
              </div>
              <div className="public-figma-metric-value">
                {formatVaultPublicMetricValue(tile)}
              </div>
              <p className="public-figma-metric-detail">{tile.detail}</p>
            </article>
          ))}
        </div>
      </section>

      <Panel
        title="Arkas"
        subtitle={`${windowedPage.total} of ${state.data.total} Arkas in the selected window · ranked by ${SORT_LABELS[sortMetric]}`}
        testId="vaults-leaderboard-panel"
        className="vaults-leaderboard-panel-cutover"
      >
        <div className="vaults-window-strip" data-testid="vaults-window-strip">
          <div>
            <span className="surface-list-label">Window</span>
            <p className="surface-note">{activeWindowOption.detail}</p>
          </div>
          <div className="surface-tab-strip vaults-window-tabs">
            {VAULT_LEADERBOARD_WINDOW_OPTIONS.map((option) => (
              <button
                key={option.id}
                type="button"
                className={`surface-tab${windowMode === option.id ? " surface-tab-active" : ""}`}
                data-testid={`vaults-window-${option.id}`}
                aria-pressed={windowMode === option.id}
                onClick={() => setWindowMode(option.id)}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>
        <div className="vaults-listing-toolbar vaults-listing-toolbar-cutover" data-testid="vaults-listing-toolbar">
          <label className="discover-stage-search vaults-stage-search">
            <span className="surface-list-label">Search</span>
            <input
              data-testid="vaults-search-input"
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search Arkas"
              className="discover-input"
            />
          </label>
          <div className="vaults-stage-sortlane" data-testid="vaults-sort-controls">
            <label className="ops-field vaults-sort-field">
              <span className="surface-list-label">Rank by</span>
              <select
                className="ops-select"
                data-testid="vaults-sort-metric"
                value={sortMetric}
                onChange={(event) => {
                  const nextMetric = event.target.value as VaultSortMetric;
                  setSortMetric(nextMetric);
                  setSortOrder(nextMetric === "rank" ? "asc" : "desc");
                }}
              >
                <option value="rank">Rank</option>
                <option value="nav">TVL</option>
                <option value="profit">Profit</option>
                <option value="volume">Volume</option>
              </select>
            </label>
            <label className="ops-field vaults-sort-field">
              <span className="surface-list-label">Order</span>
              <select
                className="ops-select"
                data-testid="vaults-sort-order"
                value={sortOrder}
                onChange={(event) => setSortOrder(event.target.value as VaultSortOrder)}
              >
                <option value="desc">High to low</option>
                <option value="asc">Low to high</option>
              </select>
            </label>
          </div>
          <label className="discover-toggle vaults-curated-toggle">
            <input
              data-testid="vaults-curated-toggle"
              type="checkbox"
              checked={curatedOnly}
              onChange={(event) => {
                setCuratedOnly(event.target.checked);
              }}
            />
            <span>{CURATED_ONLY_LABEL}</span>
          </label>
        </div>
        {refreshInFlight ? (
          <SurfaceLoadStatus
            testId="vaults-refresh-note"
            title="Refreshing ranked set"
            body="Keeping the current Arka leaderboard visible while the latest sort, filter and price data reload."
          />
        ) : null}
        {showingStaleData && state.error ? (
          <SurfaceLoadStatus
            testId="vaults-stale-data-note"
            tone="warning"
            title="Latest leaderboard refresh failed"
            body={`Last successful leaderboard view is still visible. ${state.error}`}
          />
        ) : null}

        {rows.length === 0 ? (
          <EmptyState
            title="No Arkas match this filter"
            body="Broaden the search or include non-curated vaults to widen the ranking set."
            testId="vaults-empty"
          />
        ) : (
          <SurfaceTable
            testId="vaults-leaderboard-table"
            className="vaults-leaderboard-table-cutover"
            columnsClassName="vault-leaderboard-table"
            headers={["Arka", "TVL", "Portfolio", "Status", "Route"]}
          >
            {visibleRows.map((row) => {
              const routes = buildVaultRouteSet(row.arkaId);
              const rankedEntry = entryById.get(row.arkaId);
              const investorCount = investorCounts[row.arkaId];
              return (
                <div
                  key={row.arkaId}
                  className="surface-table-row vault-leaderboard-table vault-leaderboard-card-cutover vault-leaderboard-row-containment"
                  data-testid="vault-leaderboard-card"
                  data-row-containment="bounded"
                >
                  <div className="surface-table-cell">
                    <div className="vault-row-primary">
                      <div className="vault-row-rank">#{row.rank}</div>
                      <div>
                        <div
                          className="surface-table-cell-strong leaderboard-truncate-token"
                          data-testid="vault-row-arka-id"
                          title={row.arkaId}
                          aria-label={`Arka ${resolveArkaDisplayName(row)}`}
                          data-full-value={row.arkaId}
                        >
                          {resolveArkaDisplayName(row)}{process.env.NEXT_PUBLIC_V3_DEFAULT_CREATION==='1'?<ArkaVersionBadge id={row.arkaId}/>:null}
                        </div>
                        <div
                          className="surface-table-subtle leaderboard-truncate-token"
                          data-testid="vault-row-arka-contract"
                          title={row.arkaId}
                          aria-label={`Arka contract ${row.arkaId}`}
                          data-full-value={row.arkaId}
                        >
                          {formatContractLabel(row.arkaId, 8, 4)}
                        </div>
                        <div
                          className="surface-table-subtle leaderboard-truncate-token"
                          data-testid="vault-row-manager-id"
                          title={row.manager}
                          aria-label={`Manager ${row.manager}`}
                          data-full-value={row.manager}
                        >
                          Manager {formatContractLabel(row.manager, 8, 4)}
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="surface-table-cell">
                    <div className="vault-row-managed">
                      <strong>{row.navDisplay}</strong>
                      {sortMetric === "profit" ? (
                        <span className="surface-table-subtle">
                          {`P/L ${formatUsdBaseUnitAmount(
                            rankedEntry
                              ? resolveDisplayMetric(
                                  state.derivedMetrics,
                                  rankedEntry.arkaId,
                                  "profit",
                                )
                              : null,
                          )}`}
                        </span>
                      ) : sortMetric === "volume" ? (
                        <span className="surface-table-subtle">
                          {`Volume ${formatUsdBaseUnitAmount(
                            rankedEntry
                              ? resolveDisplayMetric(
                                  state.derivedMetrics,
                                  rankedEntry.arkaId,
                                  "volume",
                                )
                              : null,
                          )}`}
                        </span>
                      ) : (
	                        <span className="surface-table-subtle">{row.navCaption}</span>
                      )}
                    </div>
                  </div>
                  <div className="surface-table-cell">
                    <div className="vault-row-stack" data-testid="vault-base-asset-cell">
                      <strong>{row.assetCount} assets</strong>
	                      <span className="surface-table-subtle">{row.whitelistCount} allowed</span>
                      {investorCount ? (
                        <span className="surface-table-subtle" data-testid="vault-row-investors">
                          {formatInvestorCountLabel(investorCount.total, investorCount.complete)}
                        </span>
                      ) : null}
                      <strong
                        className="leaderboard-truncate-token"
	                      data-testid="vault-row-base-contract"
	                      title={row.baseContract ?? "Undeclared"}
	                      aria-label={
	                        row.baseContract
	                          ? `Denomination asset ${row.baseLabel}`
	                          : "Denomination asset undeclared"
	                      }
	                      data-full-value={row.baseContract ?? "Undeclared"}
	                    >
	                      {row.baseContract ? row.baseLabel : "Undeclared"}
                      </strong>
                    </div>
                  </div>
                  <div className="surface-table-cell">
                    <div className="vault-row-stack">
                      <StatusPill label={row.postureLabel} tone={row.postureTone} />
                      <span className="surface-table-subtle">{row.feesLabel}</span>
                      <span className="surface-table-subtle">{formatRelativeTime(row.syncedAt)}</span>
                    </div>
                  </div>
                  <div className="surface-table-cell">
                    <div
                      className="surface-table-actions vault-row-links"
                      data-testid="vault-row-actions"
                    >
                      <Link
                        href={routes.profileHref}
                        className="surface-table-link"
                        data-testid="vault-open-profile-link"
                        aria-label={`Open product profile for ${row.arkaId}`}
                      >
                        Profile
                      </Link>
                      <Link
                        href={routes.opsHref}
                        className="surface-table-link"
                        data-testid="vault-open-ops-link"
                        aria-label={`Open live actions for ${row.arkaId}`}
                      >
                        Actions
                      </Link>
                    </div>
                  </div>
                </div>
              );
            })}
          </SurfaceTable>
        )}
        {rows.length > rowsPerPage ? (
          <nav className="surface-pagination" aria-label="Arka pages" data-testid="vaults-pagination">
            <button
              type="button"
              className="surface-button surface-button-secondary"
              disabled={safeListPage === 0}
              onClick={() => setListPage((page) => Math.max(0, page - 1))}
            >
              Previous
            </button>
            <span className="surface-note">
              Page {safeListPage + 1} of {pageCount}
            </span>
            <button
              type="button"
              className="surface-button surface-button-secondary"
              disabled={safeListPage >= pageCount - 1}
              onClick={() => setListPage((page) => Math.min(pageCount - 1, page + 1))}
            >
              Next
            </button>
          </nav>
        ) : null}
      </Panel>
    </div>
  );
}
