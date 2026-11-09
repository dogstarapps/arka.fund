"use client";

import Link from "next/link";
import { useDeferredValue, useEffect, useState } from "react";
import {
  CatalogApiError,
  isCatalogConfigurationError,
  loadCoreStellarAssetRegistry,
  loadAssetsPage,
} from "@/lib/catalog/api";
import { buildCatalogFallbackUnavailableCopy } from "@/lib/catalog/errorPresentation";
import { indexCoreAssetMetadata, lookupCoreAssetMetadata } from "@/lib/catalog/coreStellarAssetRegistry";
import {
  buildAssetPublicMetricTiles,
  buildAssetSpotlightCards,
  computeShareBps,
  sortAssetsForSpotlight,
  type AssetPublicMetricTile,
  type AssetSpotlightMode,
} from "@/lib/catalog/explorerSurfaces";
import {
  formatAssetAmount,
  formatContractLabel,
  formatRelativeTime,
  formatUsdBaseUnitAmount,
} from "@/lib/catalog/format";
import { resolveAssetDisplayLabel } from "@/lib/catalog/assetPresentation";
import type {
  CoreStellarAssetMetadata,
  Page,
  RankedAssetCatalogEntry,
} from "@/lib/catalog/types";
import {
  normalizeAssetsUrlState,
  replaceBrowserQueryState,
} from "@/lib/workflows/publicSurfaceUrlState";
import {
  AssetMark,
  EmptyState,
  CatalogOfflineState,
  ErrorState,
  LoadingState,
  Panel,
  StatusPill,
  SurfaceLoadStatus,
} from "./surfacePrimitives";

interface AssetsSurfaceState {
  status: "loading" | "ready" | "error";
  data: Page<RankedAssetCatalogEntry> | null;
  error: string | null;
}

const INITIAL_STATE: AssetsSurfaceState = {
  status: "loading",
  data: null,
  error: null,
};

function formatAssetMetricValue(tile: AssetPublicMetricTile): string {
  if (tile.valueKind === "amount") {
    return parseCatalogBigInt(tile.value) !== null
      ? formatUsdBaseUnitAmount(tile.value)
      : "$0.00";
  }
  if (tile.valueKind === "asset") return resolveAssetDisplayLabel(tile.value);
  return tile.value;
}

function formatAssetUnits(value: string | number | null | undefined): string {
  return formatAssetAmount(value);
}

function sumCatalogAmounts(values: string[]): string {
  return values
    .reduce((total, value) => total + BigInt(value || "0"), BigInt(0))
    .toString();
}

function parseCatalogBigInt(value: string | number | null | undefined): bigint | null {
  if (value === null || value === undefined || value === "") return null;
  try {
    return BigInt(String(value));
  } catch {
    return null;
  }
}

function isPositiveCatalogAmount(value: string | number | null | undefined): boolean {
  return (parseCatalogBigInt(value) ?? BigInt(0)) > BigInt(0);
}

export default function AssetsSurface() {
  const [initialUrlState] = useState(() =>
    typeof window === "undefined"
      ? normalizeAssetsUrlState({})
      : normalizeAssetsUrlState(new URLSearchParams(window.location.search)),
  );
  const [search, setSearch] = useState(initialUrlState.search);
  const [spotlightMode, setSpotlightMode] =
    useState<AssetSpotlightMode>(initialUrlState.spotlight);
  const [reloadNonce, setReloadNonce] = useState(0);
  const [state, setState] = useState<AssetsSurfaceState>(INITIAL_STATE);
  const [coreRegistry, setCoreRegistry] = useState<CoreStellarAssetMetadata[]>([]);
  const deferredSearch = useDeferredValue(search.trim());
  const coreMetadataLookup = indexCoreAssetMetadata(coreRegistry);

  useEffect(() => {
    replaceBrowserQueryState({
      q: deferredSearch || null,
      spotlight: spotlightMode === "core" ? null : spotlightMode,
    });
  }, [deferredSearch, spotlightMode]);

  useEffect(() => {
    const controller = new AbortController();
    const run = async () => {
      setState((current) => ({ ...current, status: "loading", error: null }));
      try {
        const data = await loadAssetsPage(
          { search: deferredSearch || undefined },
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
              : "Unable to load asset explorer.";
        setState((current) => ({
          status: "error",
          data: current.data,
          error: message,
        }));
      }
    };
    void run();
    return () => controller.abort();
  }, [deferredSearch, reloadNonce]);

  useEffect(() => {
    const controller = new AbortController();
    const run = async () => {
      try {
        const response = await loadCoreStellarAssetRegistry(controller.signal);
        setCoreRegistry(response.items);
      } catch {
        setCoreRegistry([]);
      }
    };
    void run();
    return () => controller.abort();
  }, []);

  const valuedAssetItems = state.data?.items ?? [];
  const valuedAssetData = state.data
    ? {
        ...state.data,
        items: valuedAssetItems,
      }
    : null;
  const pendingUsdValuationContracts = new Set(
    valuedAssetItems
      .filter((item) =>
        (item.netManagedUsdEstimate === null || item.netManagedUsdEstimate === undefined) &&
        isPositiveCatalogAmount(item.netManagedAmount),
      )
      .map((item) => item.assetContract),
  );
  const totalEstimatedValue = pendingUsdValuationContracts.size === 0
    ? sumCatalogAmounts(valuedAssetItems.map((item) => item.netManagedUsdEstimate ?? "0"))
    : null;
  const spotlightSource = state.data
    ? sortAssetsForSpotlight(valuedAssetItems, spotlightMode, deferredSearch)
    : [];
  const spotlightAssets = valuedAssetData
    ? buildAssetSpotlightCards(
        {
          ...valuedAssetData,
          items: spotlightSource,
        },
        6,
      )
    : [];
  const commandLeadAsset = spotlightSource[0] ?? valuedAssetItems[0] ?? null;
  const hasOnlyPendingUsdValuation = totalEstimatedValue === null;
  const publicMetricTiles = valuedAssetData
    ? buildAssetPublicMetricTiles(valuedAssetData, { search: deferredSearch }).map((tile) =>
	        tile.id === "footprint" && pendingUsdValuationContracts.size > 0
	          ? {
	              ...tile,
	              value: hasOnlyPendingUsdValuation ? "$0.00" : tile.value,
	              valueKind: hasOnlyPendingUsdValuation ? "text" as const : tile.valueKind,
	              detail: `${pendingUsdValuationContracts.size} assets need USD pricing before TVL can be shown.`,
	              tone: "warning" as const,
	            }
	          : tile.id === "leadShare" &&
	              commandLeadAsset &&
	              pendingUsdValuationContracts.has(commandLeadAsset.assetContract)
	            ? {
	                ...tile,
	                value: "$0.00",
	                valueKind: "text" as const,
	                detail: `${resolveAssetDisplayLabel(commandLeadAsset.assetContract)} needs USD pricing before it can lead by value.`,
	                tone: "warning" as const,
	              }
          : tile,
      ).filter((tile) => ["indexed", "footprint", "balanceSheet", "debtLinked"].includes(tile.id))
    : [];
  const coreRegistryCoverage = new Map<string, RankedAssetCatalogEntry>();
  for (const item of valuedAssetItems) {
    const metadata = lookupCoreAssetMetadata(coreMetadataLookup, item.assetContract);
    if (metadata && !coreRegistryCoverage.has(metadata.id)) {
      coreRegistryCoverage.set(metadata.id, item);
    }
  }
  const hiddenAssetCount = state.data
    ? Math.max(0, state.data.items.length - spotlightAssets.length)
    : 0;
  const assetsOfflineCopy = buildCatalogFallbackUnavailableCopy("assets");
  const refreshInFlight = state.status === "loading" && Boolean(state.data);
  const showingStaleData = state.status === "error" && Boolean(state.data);
  const formatAssetEstimatedValue = (
    entry: Pick<RankedAssetCatalogEntry, "assetContract" | "netManagedUsdEstimate">,
  ) => {
    if (pendingUsdValuationContracts.has(entry.assetContract)) {
      return "$0.00";
    }
    return parseCatalogBigInt(entry.netManagedUsdEstimate) !== null
      ? formatUsdBaseUnitAmount(entry.netManagedUsdEstimate)
      : "$0.00";
  };
  const formatValueShareLabel = (
    entry: Pick<RankedAssetCatalogEntry, "assetContract" | "netManagedUsdEstimate">,
  ) => {
	    if (pendingUsdValuationContracts.has(entry.assetContract)) {
	      return "TVL share unavailable";
    }
    const shareBps = totalEstimatedValue === null || entry.netManagedUsdEstimate === null || entry.netManagedUsdEstimate === undefined
      ? null
      : computeShareBps(entry.netManagedUsdEstimate, totalEstimatedValue);
    return shareBps !== null
      ? `Value share ${(shareBps / 100).toFixed(2)}%`
      : "TVL share unavailable";
  };
  return (
    <div
      className="surface-stack control-room-fidelity-shell assets-fidelity-shell"
      data-testid="assets-fidelity-shell"
      aria-busy={refreshInFlight}
      data-loading-state={refreshInFlight ? "refreshing" : "idle"}
    >
      <header className="surface-stage-header">
        <span className="surface-eyebrow">Assets</span>
        <h1 className="surface-title">Assets</h1>
        <p className="surface-description">
          Compare current value and exposure across Arkas.
        </p>
      </header>

      {refreshInFlight ? (
        <SurfaceLoadStatus
          testId="assets-refresh-status"
          title="Refreshing asset exposure"
          body="Keeping the current ranked asset book visible while the latest filters resolve."
        />
      ) : null}
      {showingStaleData && state.error ? (
        <SurfaceLoadStatus
          testId="assets-stale-status"
          tone="warning"
          title="Latest asset refresh failed"
          body={`Last successful asset view remains visible. ${state.error}`}
        />
      ) : null}

      {publicMetricTiles.length > 0 ? (
        <section
          className="public-figma-metric-deck assets-public-metric-deck"
          data-testid="assets-hero-aside"
          aria-label="Assets metrics"
        >
          {publicMetricTiles.map((tile) => (
            <article
              key={tile.id}
              className={`public-figma-metric-card public-figma-metric-card-${tile.tone} public-figma-metric-card-${tile.id}`}
              data-testid={`assets-public-metric-${tile.id}`}
            >
              <div className="public-figma-metric-head">
                <span className="public-figma-metric-icon" aria-hidden="true" />
                <strong>{tile.label}</strong>
              </div>
              <div className="public-figma-metric-value">
                {formatAssetMetricValue(tile)}
              </div>
              <p className="public-figma-metric-detail">{tile.detail}</p>
            </article>
          ))}
        </section>
      ) : null}

      {false && coreRegistry.length > 0 ? (
	        <Panel
	          title="Supported Stellar assets"
	          subtitle="Assets available for selection and exposure review"
          testId="assets-core-registry-panel"
          className="assets-core-registry-panel assets-core-registry-workspace-panel"
        >
          <div
            className="surface-spotlight-grid assets-core-registry-grid"
            data-testid="assets-core-registry-list"
          >
            {coreRegistry.map((asset) => {
              const indexedEntry = coreRegistryCoverage.get(asset.id) ?? null;
              return (
                <article
                  key={asset.id}
                  className="surface-entry-card surface-spotlight-card assets-spotlight-card explorer-related-card"
                  data-testid="core-asset-card"
                  data-core-asset-id={asset.id}
                  data-icon-source={asset.iconSource}
                  data-toml-state={asset.tomlState}
                  data-selectable={asset.selectableContract ? "true" : "false"}
                >
                  <div className="surface-spotlight-head">
                    <div className="explorer-related-headline">
                      <AssetMark
                        contract={indexedEntry?.assetContract ?? asset.selectableContract}
                        label={asset.symbol}
                        size="md"
                        iconUrl={asset.iconUrl}
                        fallbackIconUrl={asset.fallbackIconUrl}
                      />
                      <div className="explorer-related-summary">
                        <div className="surface-table-hint">{asset.symbol}</div>
                        <div className="surface-spotlight-title">{asset.label}</div>
                        <div className="surface-table-subtle">
	                          {asset.homeDomain ?? "Home domain unavailable"}
                        </div>
                      </div>
                    </div>
                    <StatusPill
                      label={indexedEntry ? "Live exposure" : "Available"}
                      tone={indexedEntry ? "positive" : "neutral"}
                    />
                  </div>

	                  <div className="surface-spotlight-value">
	                    {indexedEntry
	                      ? formatAssetEstimatedValue(indexedEntry)
	                      : "Available for Create"}
	                  </div>

                  <div className="explorer-related-meta">
                    <span>
                      {indexedEntry
                        ? `${indexedEntry.arkaCount} Arkas`
                        : asset.selectableContract
                          ? "Create-ready on current network"
                          : "Metadata ready"}
                    </span>
                    <span>
                      {indexedEntry
                        ? `${formatAssetUnits(indexedEntry.netManagedAmount)} managed`
                        : asset.classicIssuer
                          ? formatContractLabel(asset.classicIssuer, 7, 5)
                          : "Native asset"}
                    </span>
                    <span>
                      <span
                        className="sr-only"
                        data-testid={`core-asset-icon-source-${asset.id}`}
                      >
                        {asset.iconProvenanceLabel ??
                          (asset.iconSource === "stellar_toml"
	                            ? "stellar.toml verified"
	                            : "fallback asset icon")}
                      </span>
                    </span>
                  </div>

                  <div className="surface-spotlight-footer">
                    <div className="surface-note">{asset.description}</div>
                    {indexedEntry ? (
                      <Link
                        href={`/assets/${indexedEntry.assetContract}`}
                        className="surface-table-link"
                      >
                        Open asset detail
                      </Link>
                    ) : asset.selectableContract ? (
                      <Link
                        href={`/factory/create?asset=${encodeURIComponent(asset.selectableContract)}`}
                        className="surface-table-link"
                      >
                        Use in Create
                      </Link>
                    ) : (
                      <span className="surface-note">Not selectable on this network yet</span>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        </Panel>
      ) : null}

      <section
        className="surface-grid control-room-stage-grid assets-workspace-grid"
        data-testid="assets-workspace-grid"
      >
	          <Panel
	            title="Asset explorer"
	            subtitle="Search assets and inspect current concentration"
          testId="assets-list-panel"
          className="assets-command-panel assets-list-workspace-panel assets-command-panel-cutover"
        >
          <div className="discover-toolbar assets-command-toolbar assets-command-toolbar-cutover">
            <label className="discover-search-field">
              <span className="surface-list-label">Search</span>
              <input
                data-testid="assets-search-input"
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
	              placeholder="Search assets"
                className="discover-input"
              />
            </label>
            <div className="discover-toolbar-side">
              <div className="surface-note">
                Search by asset name or contract.
              </div>
            </div>
          </div>

          {state.status === "loading" && !state.data ? (
            <LoadingState
              title="Loading assets"
              body="Refreshing asset rankings."
              testId="assets-loading"
            />
          ) : (state.status === "error" && !state.data) || !state.data ? (
            isCatalogConfigurationError(state.error) ? (
              <CatalogOfflineState
                testId="assets-catalog-offline"
                title={assetsOfflineCopy.title}
                body={assetsOfflineCopy.body}
                onRetry={() => setReloadNonce((value) => value + 1)}
              />
            ) : (
              <ErrorState
                title="Asset explorer unavailable"
                body={state.error ?? "The asset explorer could not be loaded."}
                actionLabel="Retry"
                onAction={() => setReloadNonce((value) => value + 1)}
                testId="assets-error"
              />
            )
          ) : state.data.items.length === 0 ? (
            <EmptyState
              title="No assets found"
              body="Broaden the search to inspect asset exposure."
              testId="assets-empty"
            />
          ) : (
            <>

              <div
                className="surface-tab-strip surface-spotlight-tabs"
                data-testid="assets-spotlight-tabs"
              >
                <button
                  type="button"
                  className={`surface-tab${spotlightMode === "core" ? " surface-tab-active" : ""}`}
                  data-testid="assets-spotlight-tab-core"
                  aria-pressed={spotlightMode === "core"}
                  onClick={() => setSpotlightMode("core")}
                >
                  Core exposure
                </button>
                <button
                  type="button"
                  className={`surface-tab${spotlightMode === "balanceSheet" ? " surface-tab-active" : ""}`}
                  data-testid="assets-spotlight-tab-balance-sheet"
                  aria-pressed={spotlightMode === "balanceSheet"}
                  onClick={() => setSpotlightMode("balanceSheet")}
                >
                  Balance sheet
                </button>
                <button
                  type="button"
                  className={`surface-tab${spotlightMode === "search" ? " surface-tab-active" : ""}`}
                  data-testid="assets-spotlight-tab-search"
                  aria-pressed={spotlightMode === "search"}
                  onClick={() => setSpotlightMode("search")}
                >
                  Search matches
                </button>
              </div>

              <div
                className="surface-spotlight-grid assets-spotlight-grid"
                data-testid="assets-list"
              >
                {spotlightAssets.map((entry) => (
                  <article
                    key={entry.assetContract}
                    className="surface-entry-card surface-spotlight-card assets-spotlight-card explorer-related-card"
                    data-testid="asset-card"
                  >
                    <div className="surface-spotlight-head">
                      <div className="explorer-related-headline">
                        <AssetMark
                          contract={entry.assetContract}
                          label={
                            lookupCoreAssetMetadata(coreMetadataLookup, entry.assetContract)?.symbol
                          }
                          size="md"
                          iconUrl={
                            lookupCoreAssetMetadata(coreMetadataLookup, entry.assetContract)?.iconUrl
                          }
                          fallbackIconUrl={
                            lookupCoreAssetMetadata(coreMetadataLookup, entry.assetContract)
                              ?.fallbackIconUrl
                          }
                        />
                        <div className="explorer-related-summary">
                          <div className="surface-table-hint">#{entry.rank}</div>
                          <div className="surface-spotlight-title">
                            {resolveAssetDisplayLabel(entry.assetContract)}
                          </div>
                          <div className="surface-table-subtle ops-mono">
                            {formatContractLabel(entry.assetContract, 12, 6)}
                          </div>
                          <div className="surface-table-subtle">
	                            {entry.denominationArkaCount} denominated Arkas
                          </div>
                        </div>
                      </div>
                      <StatusPill
                        label={
	                              entry.debtAmount === "0"
	                            ? "No debt"
	                            : "Debt exposure"
                        }
                        tone={
                          entry.debtAmount === "0" ? "positive" : "warning"
                        }
                      />
                    </div>

	                    <div className="surface-spotlight-value">
	                      {formatAssetEstimatedValue(entry)}
	                    </div>

                    <div className="surface-spotlight-strip" aria-hidden="true">
                      <span style={{ width: `${entry.managedSharePct}%` }} />
                    </div>

                    <div className="explorer-related-meta">
                      <span>{entry.arkaCount} Arkas</span>
                      <span>{entry.managerCount} managers</span>
                      <span>{formatRelativeTime(entry.syncedAt)}</span>
                    </div>

                    <div className="surface-chip-wrap">
                      <span className="status-pill status-pill-neutral">
                        Liquid {formatAssetUnits(entry.liquidBalance)}
                      </span>
                      {entry.debtAmount !== "0" ? (
                        <span className="status-pill status-pill-neutral">
                          Debt {formatAssetUnits(entry.debtAmount)}
                        </span>
                      ) : null}
                      {formatValueShareLabel(entry) !== "TVL share unavailable" ? (
                        <span className="status-pill status-pill-neutral">
                          {formatValueShareLabel(entry)}
                        </span>
                      ) : null}
                    </div>

                    <div className="surface-spotlight-footer">
                      <Link
                        href={`/assets/${entry.assetContract}`}
                        className="surface-table-link"
                      >
                        Open asset detail
                      </Link>
                    </div>
                  </article>
                ))}
              </div>

              {hiddenAssetCount > 0 ? (
                <div className="surface-note">
                  Showing {spotlightAssets.length} assets. Use search to find the remaining {hiddenAssetCount}.
                </div>
              ) : null}

            </>
          )}
        </Panel>

      </section>
    </div>
  );
}
