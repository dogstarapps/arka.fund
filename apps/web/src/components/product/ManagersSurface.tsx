"use client";

import Link from "next/link";
import { useDeferredValue, useEffect, useState } from "react";
import {
  CatalogApiError,
  isCatalogConfigurationError,
  loadManagersResolvedPage,
} from "@/lib/catalog/api";
import { buildCatalogFallbackUnavailableCopy } from "@/lib/catalog/errorPresentation";
import {
  buildManagerSpotlightCards,
  sortManagersForSpotlight,
  type ManagerSpotlightMode,
} from "@/lib/catalog/explorerSurfaces";
import {
  formatRelativeTime,
  formatUsdBaseUnitAmount,
} from "@/lib/catalog/format";
import {
  resolveManagerDisplayName,
  resolveManagerSubtitle,
} from "@/lib/catalog/identity";
import type {
  ManagerSortMetric,
  ManagerSortOrder,
  Page,
  RankedManagerCatalogEntry,
} from "@/lib/catalog/types";
import {
  normalizeManagersUrlState,
  replaceBrowserQueryState,
} from "@/lib/workflows/publicSurfaceUrlState";
import {
  EmptyState,
  CatalogOfflineState,
  ErrorState,
  LoadingState,
  Panel,
  StatusPill,
  SurfaceLoadStatus,
} from "./surfacePrimitives";

interface ManagersSurfaceState {
  status: "loading" | "ready" | "error";
  data: Page<RankedManagerCatalogEntry> | null;
  error: string | null;
}

const INITIAL_STATE: ManagersSurfaceState = {
  status: "loading",
  data: null,
  error: null,
};

const SORT_LABELS: Record<ManagerSortMetric, string> = {
  rank: "Rank",
  nav: "TVL",
  arkas: "Arka count",
  curated: "Curated Arkas",
};

export default function ManagersSurface() {
  const [initialUrlState] = useState(() =>
    typeof window === "undefined"
      ? normalizeManagersUrlState({})
      : normalizeManagersUrlState(new URLSearchParams(window.location.search)),
  );
  const [search, setSearch] = useState(initialUrlState.search);
  const [sortMetric, setSortMetric] =
    useState<ManagerSortMetric>(initialUrlState.sortMetric);
  const [sortOrder, setSortOrder] =
    useState<ManagerSortOrder>(initialUrlState.sortOrder);
  const [spotlightMode, setSpotlightMode] =
    useState<ManagerSpotlightMode>(initialUrlState.spotlight);
  const [reloadNonce, setReloadNonce] = useState(0);
  const [state, setState] = useState<ManagersSurfaceState>(INITIAL_STATE);
  const deferredSearch = useDeferredValue(search.trim());

  useEffect(() => {
    replaceBrowserQueryState({
      q: deferredSearch || null,
      spotlight: spotlightMode === "lead" ? null : spotlightMode,
      sort: sortMetric === "rank" ? null : sortMetric,
      order:
        (sortMetric === "rank" && sortOrder === "asc") ||
        (sortMetric !== "rank" && sortOrder === "desc")
          ? null
          : sortOrder,
    });
  }, [deferredSearch, sortMetric, sortOrder, spotlightMode]);

  useEffect(() => {
    const controller = new AbortController();
    const run = async () => {
      setState((current) => ({ ...current, status: "loading", error: null }));
      try {
        const payload = await loadManagersResolvedPage(
          {
            search: deferredSearch || undefined,
            sortMetric,
            sortOrder,
            limit: 24,
            offset: 0,
          },
          controller.signal,
        );
        setState({ status: "ready", data: payload.page, error: null });
      } catch (error) {
        if (controller.signal.aborted) return;
        const message =
          error instanceof CatalogApiError
            ? error.message
            : error instanceof Error
              ? error.message
              : "Unable to load manager explorer.";
        setState((current) => ({
          status: "error",
          data: current.data,
          error: message,
        }));
      }
    };
    void run();
    return () => controller.abort();
  }, [deferredSearch, reloadNonce, sortMetric, sortOrder]);

  const topManager = state.data?.items[0] ?? null;
  const totalNav = state.data?.items.every(
    (item) => item.totalNavUsdEstimate !== null && item.totalNavUsdEstimate !== undefined,
  )
    ? state.data.items.reduce(
      (accumulator, item) => accumulator + BigInt(item.totalNavUsdEstimate ?? "0"),
      BigInt(0),
    )
    : null;
  const totalNavString = totalNav?.toString() ?? null;
  const spotlightSource = state.data
    ? sortManagersForSpotlight(state.data.items, spotlightMode, deferredSearch)
    : [];
  const spotlightManagers = state.data
    ? buildManagerSpotlightCards(
        {
          ...state.data,
          items: spotlightSource,
        },
        6,
      )
    : [];
  const hiddenManagerCount = state.data
    ? Math.max(0, state.data.items.length - spotlightManagers.length)
    : 0;
  const managersOfflineCopy = buildCatalogFallbackUnavailableCopy("managers");
  const refreshInFlight = state.status === "loading" && Boolean(state.data);
  const showingStaleData = state.status === "error" && Boolean(state.data);

  return (
    <div
      className="surface-stack control-room-fidelity-shell managers-fidelity-shell"
      data-testid="managers-fidelity-shell"
      aria-busy={refreshInFlight}
      data-loading-state={refreshInFlight ? "refreshing" : "idle"}
    >
      <header className="surface-stage-header">
        <span className="surface-eyebrow">Managers</span>
        <h1 className="surface-title">Managers Leaderboard</h1>
        <p className="surface-description">
          Compare manager TVL, Arka count, curation status and recent updates.
        </p>
      </header>

      {refreshInFlight ? (
        <SurfaceLoadStatus
          testId="managers-refresh-status"
          title="Refreshing manager ranking"
          body="Keeping the current manager leaderboard visible while the latest sort and search query resolves."
        />
      ) : null}
      {showingStaleData && state.error ? (
        <SurfaceLoadStatus
          testId="managers-stale-status"
          tone="warning"
          title="Latest manager refresh failed"
          body={`Last successful manager snapshot remains visible. ${state.error}`}
        />
      ) : null}

      <section
        className="workflow-signal-grid control-room-signal-grid managers-operator-summary"
        data-testid="managers-hero-aside"
      >
        <article className="surface-signal-card workflow-signal-card">
          <span className="workflow-signal-label">Managers</span>
          <strong className="workflow-signal-value">
            {state.data?.total ?? "..."}
          </strong>
          <span className="workflow-signal-detail">
            Managers currently visible in Arka rankings.
          </span>
        </article>
        <article className="surface-signal-card workflow-signal-card">
          <span className="workflow-signal-label">Current leader</span>
          <strong className="workflow-signal-value">
            {topManager
              ? resolveManagerDisplayName(topManager)
              : "Loading"}
          </strong>
          <span className="workflow-signal-detail">
            Top manager by current TVL.
          </span>
        </article>
        <article className="surface-signal-card workflow-signal-card">
          <span className="workflow-signal-label">Total TVL</span>
          <strong className="workflow-signal-value">
            {totalNavString === null ? "$0.00" : formatUsdBaseUnitAmount(totalNavString)}
          </strong>
          <span className="workflow-signal-detail">
            Across the managers currently shown.
          </span>
        </article>
      </section>

      <section
        className="surface-grid control-room-stage-grid managers-workspace-grid"
        data-testid="managers-workspace-grid"
      >
        <Panel
          title="Manager leaderboard"
          subtitle={`Search and compare managers · sorted by ${SORT_LABELS[sortMetric]}`}
          testId="managers-list-panel"
          className="managers-command-panel managers-list-workspace-panel"
        >
          <div
            className="discover-toolbar managers-command-toolbar managers-filter-deck-cutover"
            data-testid="managers-filter-deck"
            aria-label="Manager leaderboard filters"
          >
            <div
              className="managers-filter-primary-row"
              data-testid="managers-filter-primary-row"
            >
              <label className="discover-search-field managers-filter-field managers-filter-search">
                <span className="surface-list-label">Search</span>
                <input
                  data-testid="managers-search-input"
                  type="search"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search managers"
                  className="discover-input"
                />
              </label>
              <label
                className="ops-field managers-sort-field managers-sort-field-rank managers-filter-field"
                data-testid="managers-sort-controls"
              >
                <span className="surface-list-label">Rank by</span>
                <select
                  className="ops-select"
                  data-testid="managers-sort-metric"
                  value={sortMetric}
                  onChange={(event) => {
                    const nextMetric = event.target.value as ManagerSortMetric;
                    setSortMetric(nextMetric);
                    setSortOrder(nextMetric === "rank" ? "asc" : "desc");
                  }}
                >
                  <option value="rank">Rank</option>
                  <option value="nav">TVL</option>
                  <option value="arkas">Arka count</option>
                  <option value="curated">Curated Arkas</option>
                </select>
              </label>
              <label className="ops-field managers-sort-field managers-sort-field-order managers-filter-field">
                <span className="surface-list-label">Order</span>
                <select
                  className="ops-select"
                  data-testid="managers-sort-order"
                  value={sortOrder}
                  onChange={(event) =>
                    setSortOrder(event.target.value as ManagerSortOrder)
                  }
                >
                  <option value="desc">High to low</option>
                  <option value="asc">Low to high</option>
                </select>
              </label>
            </div>
          </div>

          {state.status === "loading" && !state.data ? (
            <LoadingState
              title="Loading managers"
              body="Refreshing manager rankings."
              testId="managers-loading"
            />
          ) : (state.status === "error" && !state.data) || !state.data ? (
            isCatalogConfigurationError(state.error) ? (
              <CatalogOfflineState
                testId="managers-catalog-offline"
                title={managersOfflineCopy.title}
                body={managersOfflineCopy.body}
                onRetry={() => setReloadNonce((value) => value + 1)}
              />
            ) : (
              <ErrorState
                title="Manager explorer unavailable"
                body={state.error ?? "The manager explorer could not be loaded."}
                actionLabel="Retry"
                onAction={() => setReloadNonce((value) => value + 1)}
                testId="managers-error"
              />
            )
          ) : state.data.items.length === 0 ? (
            <EmptyState
              title="No managers found"
              body="Broaden the search to inspect more managers."
              testId="managers-empty"
            />
          ) : (
            <>
              <div
                className="surface-tab-strip surface-spotlight-tabs"
                data-testid="managers-spotlight-tabs"
              >
                <button
                  type="button"
                  className={`surface-tab${spotlightMode === "lead" ? " surface-tab-active" : ""}`}
                  data-testid="managers-spotlight-tab-lead"
                  aria-pressed={spotlightMode === "lead"}
                  onClick={() => setSpotlightMode("lead")}
                >
                  Lead TVL
                </button>
                <button
                  type="button"
                  className={`surface-tab${spotlightMode === "curated" ? " surface-tab-active" : ""}`}
                  data-testid="managers-spotlight-tab-curated"
                  aria-pressed={spotlightMode === "curated"}
                  onClick={() => setSpotlightMode("curated")}
                >
                  Curated Arkas
                </button>
                <button
                  type="button"
                  className={`surface-tab${spotlightMode === "search" ? " surface-tab-active" : ""}`}
                  data-testid="managers-spotlight-tab-search"
                  aria-pressed={spotlightMode === "search"}
                  onClick={() => setSpotlightMode("search")}
                >
                  Search matches
                </button>
              </div>

              <div
                className="surface-spotlight-grid managers-spotlight-grid"
                data-testid="managers-list"
              >
                {spotlightManagers.map((entry) => (
                  <article
                    key={entry.manager}
                    className="surface-entry-card surface-spotlight-card managers-spotlight-card explorer-related-card"
                    data-testid="manager-card"
                  >
                    <div className="surface-spotlight-head">
                      <div className="explorer-related-summary">
                        <div className="surface-table-hint">#{entry.rank}</div>
                        <div className="surface-spotlight-title">
                          {resolveManagerDisplayName(entry)}
                        </div>
                        <div className="surface-table-subtle">
                          {resolveManagerSubtitle(entry)}
                        </div>
                      </div>
                      <StatusPill
                        label={
                          entry.delistedArkaCount > 0
                            ? "Delisted Arkas"
                            : "Active"
                        }
                        tone={
                          entry.delistedArkaCount > 0 ? "warning" : "positive"
                        }
                      />
                    </div>

                    <div className="surface-spotlight-value">
                      {entry.totalNavUsdEstimate === null || entry.totalNavUsdEstimate === undefined
                        ? "$0.00"
                        : formatUsdBaseUnitAmount(entry.totalNavUsdEstimate)}
                    </div>
                    <div className="surface-table-subtle">USD TVL</div>

                    <div className="explorer-related-meta">
                      <span>{entry.arkaCount} Arkas</span>
                      <span>{entry.curatedArkaCount} curated</span>
                      <span>{formatRelativeTime(entry.syncedAt)}</span>
                    </div>

                    <div className="surface-chip-wrap">
                      <span className="status-pill status-pill-neutral">
                        Delisted {entry.delistedArkaCount}
                      </span>
                    </div>

                    <div className="surface-spotlight-footer">
                      <Link
                        href={`/managers/${entry.manager}`}
                        className="surface-table-link"
                      >
                        Open manager detail
                      </Link>
                    </div>
                  </article>
                ))}
              </div>

              {hiddenManagerCount > 0 ? (
                <div className="surface-note">
                  Showing {spotlightManagers.length} managers. Use search to find the remaining {hiddenManagerCount}.
                </div>
              ) : null}

            </>
          )}
        </Panel>

      </section>
    </div>
  );
}
