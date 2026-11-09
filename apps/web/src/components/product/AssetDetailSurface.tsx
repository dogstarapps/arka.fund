"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  CatalogApiError,
  loadAssetDetailBundle,
  loadCoreStellarAssetRegistry,
} from "@/lib/catalog/api";
import {
  buildCoreStellarAssetMetadata,
  findCoreStellarAssetByLookup,
  indexCoreAssetMetadata,
  lookupCoreAssetMetadata,
} from "@/lib/catalog/coreStellarAssetRegistry";
import {
  computeShareBps,
  computeSpotlightWidthByRank,
} from "@/lib/catalog/explorerSurfaces";
import {
  formatBaseUnitAmount,
  formatContractLabel,
  formatRelativeTime,
  formatSignedBpsAsPercent,
  formatUsdBaseUnitAmount,
} from "@/lib/catalog/format";
import { resolveAssetDisplayLabel } from "@/lib/catalog/assetPresentation";
import {
  resolveArkaDisplayName,
  resolveArkaSubtitle,
} from "@/lib/catalog/identity";
import {
  buildAssetHistoryBars,
  buildAssetTrendSummary,
} from "@/lib/catalog/explorers";
import type { AssetDetailBundle, CoreStellarAssetMetadata } from "@/lib/catalog/types";
import {
  AssetMark,
  EmptyState,
  ErrorState,
  HistoryBars,
  LoadingState,
  Panel,
  StatusPill,
  SurfaceTable,
} from "./surfacePrimitives";

interface AssetDetailSurfaceState {
  status: "loading" | "ready" | "error";
  data: AssetDetailBundle | null;
  error: string | null;
  errorStatus: number | null;
}

const INITIAL_STATE: AssetDetailSurfaceState = {
  status: "loading",
  data: null,
  error: null,
  errorStatus: null,
};

function formatNullableContract(value: string | null): string {
  return value ? formatContractLabel(value, 12, 8) : "Not declared";
}

function CoreRegistryAssetFallback(props: {
  requestedId: string;
  metadata: CoreStellarAssetMetadata;
  catalogError: string | null;
  catalogErrorStatus: number | null;
}) {
  const primaryContract =
    props.metadata.selectableContract ??
    props.metadata.metadataContract ??
    props.requestedId;
	  const iconSourceLabel =
	    props.metadata.iconProvenanceLabel ??
	    (props.metadata.iconSource === "stellar_toml"
	      ? "stellar.toml verified"
	      : "asset icon");
  const assetQuery = encodeURIComponent(props.metadata.symbol);
  const createArkaHref = `/factory/create?asset=${encodeURIComponent(
    props.metadata.selectableContract ?? props.metadata.symbol,
  )}`;
  const catalogUnavailable =
    props.catalogErrorStatus !== null && props.catalogErrorStatus !== 404;
  const exposureStatusLabel = catalogUnavailable
    ? "Data unavailable"
    : "No exposure";
  const exposureStatusDetail = catalogUnavailable
    ? "The asset identity is known, but exposure data is temporarily unavailable."
    : "No live Arka exposure is available for this asset in the current results.";
  const exposureEmptyTitle = catalogUnavailable
    ? "Exposure temporarily unavailable"
    : "No exposure yet";
  const exposureEmptyBody = catalogUnavailable
    ? `Exposure data could not be verified right now: ${props.catalogError ?? "Request failed."}`
    : props.catalogError
      ? `Exposure data did not return this asset: ${props.catalogError}`
	      : "The asset is supported, but it is not currently linked to Arka positions.";

  return (
    <div
      className="surface-stack control-room-fidelity-shell asset-detail-fidelity-shell asset-detail-core-fallback-shell public-detail-shell-cutover public-asset-detail-cutover"
      data-testid="asset-detail-core-registry-fallback"
    >
      <header className="surface-stage-header public-detail-stage-header-cutover">
        <span className="surface-eyebrow">Asset detail</span>
        <div className="asset-identity-heading">
          <AssetMark
            contract={primaryContract}
            label={props.metadata.symbol}
            size="md"
            iconUrl={props.metadata.iconUrl}
            fallbackIconUrl={props.metadata.fallbackIconUrl}
          />
          <div className="asset-identity-copy">
            <h1 className="surface-title">{props.metadata.symbol}</h1>
            <div className="surface-table-subtle ops-mono">
              {formatNullableContract(primaryContract)}
            </div>
          </div>
        </div>
        <p className="surface-description">{props.metadata.description}</p>
      </header>

      <section
        className="workflow-signal-grid control-room-signal-grid public-detail-hero-grid-cutover"
        data-testid="asset-detail-core-hero"
      >
        <article className="surface-signal-card workflow-signal-card">
	          <span className="workflow-signal-label">Asset status</span>
	          <strong className="workflow-signal-value">Supported asset</strong>
	          <span className="workflow-signal-detail">
	            {props.metadata.label} is resolved from the supported Stellar asset list.
	          </span>
        </article>
        <article className="surface-signal-card workflow-signal-card">
          <span className="workflow-signal-label">Exposure status</span>
          <strong className="workflow-signal-value">{exposureStatusLabel}</strong>
          <span className="workflow-signal-detail">
            {exposureStatusDetail}
          </span>
        </article>
        <article className="surface-signal-card workflow-signal-card">
          <span className="workflow-signal-label">Metadata source</span>
	          <strong className="workflow-signal-value">{iconSourceLabel}</strong>
	          <span className="workflow-signal-detail">
	            Asset identity is resolved from its published metadata.
	            {props.metadata.tomlUrl ? ` Source: ${props.metadata.tomlUrl}` : ""}
	          </span>
        </article>
      </section>

      <section
        className="surface-grid surface-grid-two control-room-stage-grid explorer-detail-stage-grid public-detail-stage-grid-cutover"
        data-testid="asset-detail-core-stage-grid"
      >
        <Panel
	          title="Stellar asset metadata"
	          subtitle="Supported identity for assets that may not yet have current exposure"
          testId="asset-detail-core-metadata-panel"
          className="explorer-detail-panel explorer-detail-metadata-panel public-detail-panel-cutover"
        >
          <SurfaceTable
            testId="asset-detail-core-metadata-table"
            columnsClassName="asset-detail-risk-table"
            headers={["Signal", "Current state"]}
            className="asset-detail-risk-table public-detail-table-cutover"
          >
            <div className="surface-table-row asset-detail-risk-table public-detail-row-cutover">
              <div className="surface-table-cell surface-table-cell-strong">Symbol</div>
              <div className="surface-table-cell">{props.metadata.symbol}</div>
            </div>
            <div className="surface-table-row asset-detail-risk-table public-detail-row-cutover">
              <div className="surface-table-cell surface-table-cell-strong">Asset type</div>
              <div className="surface-table-cell">{props.metadata.kind}</div>
            </div>
            <div className="surface-table-row asset-detail-risk-table public-detail-row-cutover">
              <div className="surface-table-cell surface-table-cell-strong">Home domain</div>
              <div className="surface-table-cell">{props.metadata.homeDomain ?? "Not declared"}</div>
            </div>
            <div className="surface-table-row asset-detail-risk-table public-detail-row-cutover">
              <div className="surface-table-cell surface-table-cell-strong">Classic issuer</div>
              <div className="surface-table-cell ops-mono">
                {formatNullableContract(props.metadata.classicIssuer)}
              </div>
            </div>
            <div className="surface-table-row asset-detail-risk-table public-detail-row-cutover">
	              <div className="surface-table-cell surface-table-cell-strong">Metadata address</div>
              <div className="surface-table-cell ops-mono">
                {formatNullableContract(props.metadata.metadataContract)}
              </div>
            </div>
            <div className="surface-table-row asset-detail-risk-table public-detail-row-cutover">
	              <div className="surface-table-cell surface-table-cell-strong">Selectable address</div>
              <div className="surface-table-cell ops-mono">
                {formatNullableContract(props.metadata.selectableContract)}
              </div>
            </div>
          </SurfaceTable>
        </Panel>

        <Panel
	          title="Portfolio exposure"
	          subtitle="TVL and linked Arkas appear when this asset is held by an Arka"
          testId="asset-detail-core-exposure-panel"
          className="explorer-detail-panel explorer-detail-risk-panel public-detail-panel-cutover"
        >
          <EmptyState
            title={exposureEmptyTitle}
            body={exposureEmptyBody}
          />
          <div className="surface-actions public-detail-actions-cutover">
            <Link href="/assets" className="surface-button surface-button-secondary">
              Open asset explorer
            </Link>
            <Link href={`/discover?q=${assetQuery}`} className="surface-button surface-button-secondary">
              Search catalog
            </Link>
            <Link href={createArkaHref} className="surface-button surface-button-primary">
              Create Arka
            </Link>
          </div>
        </Panel>
      </section>
    </div>
  );
}

export default function AssetDetailSurface(props: { assetId: string }) {
  const [reloadNonce, setReloadNonce] = useState(0);
  const [state, setState] = useState<AssetDetailSurfaceState>(INITIAL_STATE);
  const [coreRegistry, setCoreRegistry] = useState<CoreStellarAssetMetadata[]>([]);
  const coreMetadataLookup = indexCoreAssetMetadata(coreRegistry);
  const staticCoreAsset = findCoreStellarAssetByLookup(props.assetId);
  const staticCoreMetadata = staticCoreAsset
    ? buildCoreStellarAssetMetadata(staticCoreAsset)
    : null;
  const fallbackCoreMetadata =
    lookupCoreAssetMetadata(coreMetadataLookup, props.assetId) ?? staticCoreMetadata;

  useEffect(() => {
    const controller = new AbortController();
    const run = async () => {
      setState((current) => ({ ...current, status: "loading", error: null }));
      try {
        const data = await loadAssetDetailBundle(
          props.assetId,
          controller.signal,
        );
        setState({ status: "ready", data, error: null, errorStatus: null });
      } catch (error) {
        if (controller.signal.aborted) return;
        const message =
          error instanceof CatalogApiError
            ? error.message
            : error instanceof Error
              ? error.message
              : "Unable to load asset detail.";
        setState({
          status: "error",
          data: null,
          error: message,
          errorStatus: error instanceof CatalogApiError ? error.status : null,
        });
      }
    };
    void run();
    return () => controller.abort();
  }, [props.assetId, reloadNonce]);

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

  if (state.status === "loading") {
    return (
      <LoadingState
        title="Loading asset detail"
        body="Pulling asset exposure and trajectory from the catalog service."
        testId="asset-detail-loading"
      />
    );
  }

  if (state.status === "error" || !state.data) {
    if (fallbackCoreMetadata) {
      return (
        <CoreRegistryAssetFallback
          requestedId={props.assetId}
          metadata={fallbackCoreMetadata}
          catalogError={state.error}
          catalogErrorStatus={state.errorStatus}
        />
      );
    }

    return (
      <ErrorState
        title="Asset detail unavailable"
        body={state.error ?? "The asset detail page could not be loaded."}
        actionLabel="Retry"
        onAction={() => setReloadNonce((value) => value + 1)}
        testId="asset-detail-error"
      />
    );
  }

  const { asset, history, arkas } = state.data;
  const metadata =
    lookupCoreAssetMetadata(coreMetadataLookup, asset.assetContract) ??
    fallbackCoreMetadata;
  const assetLabel = resolveAssetDisplayLabel(asset.assetContract);
  const assetDecimals = metadata?.decimals ?? 7;
  const formatAssetUnits = (value: string | null | undefined) =>
    `${formatBaseUnitAmount(value, assetDecimals)} ${metadata?.symbol ?? assetLabel}`;
  const assetUsdValue =
    asset.netManagedUsdEstimate !== null && asset.netManagedUsdEstimate !== undefined
      ? formatUsdBaseUnitAmount(asset.netManagedUsdEstimate)
      : "Valuation unavailable";
  const trend = buildAssetTrendSummary(history.items);
  const bars = buildAssetHistoryBars(history.items);
  const hasChangingHistory =
    bars.length > 1 && new Set(bars.map((bar) => bar.value)).size > 1;
  const liquidShareBps =
    computeShareBps(asset.liquidBalance, asset.netManagedAmount) ?? 0;
  const debtShareBps =
    computeShareBps(asset.debtAmount, asset.netManagedAmount) ?? 0;
  const historySignals = [
    {
      id: "current",
      label: "Current amount",
      value: formatAssetUnits(asset.netManagedAmount),
      detail: `Across ${asset.arkaCount} Arkas`,
    },
    {
      id: "previous",
      label: "Previous amount",
      value: trend.previousValue ? formatAssetUnits(trend.previousValue) : "n/a",
      detail: trend.previousValue ? "Previous recorded amount" : "No previous update",
    },
    {
      id: "delta",
      label: "Change",
      value: formatSignedBpsAsPercent(trend.deltaBps),
      detail: trend.deltaValue
        ? `${formatAssetUnits(trend.deltaValue)} since the previous update`
        : "No change available yet",
    },
  ];

  const riskSignals = [
    {
      id: "liquid-share",
      label: "Liquid share",
      value: `${(liquidShareBps / 100).toFixed(2)}%`,
      detail: `${formatAssetUnits(asset.liquidBalance)} available`,
    },
    {
      id: "debt-share",
      label: "Debt share",
      value: `${(debtShareBps / 100).toFixed(2)}%`,
      detail: `${formatAssetUnits(asset.debtAmount)} borrowed`,
    },
    {
      id: "breadth",
      label: "Manager breadth",
      value: String(asset.managerCount),
      detail: `${asset.arkaCount} Arkas currently linked`,
    },
    {
      id: "sync-freshness",
      label: "Last sync",
      value: formatRelativeTime(asset.syncedAt),
      detail: "Latest available data",
    },
  ];

  return (
    <div
      className="surface-stack control-room-fidelity-shell asset-detail-fidelity-shell public-detail-shell-cutover public-asset-detail-cutover"
      data-testid="asset-detail-fidelity-shell"
    >
      <header className="surface-stage-header public-detail-stage-header-cutover">
        <span className="surface-eyebrow">Asset detail</span>
        <div className="asset-identity-heading">
          <AssetMark
            contract={asset.assetContract}
            label={metadata?.symbol}
            size="md"
            iconUrl={metadata?.iconUrl}
            fallbackIconUrl={metadata?.fallbackIconUrl}
          />
          <div className="asset-identity-copy">
            <h1 className="surface-title">{assetLabel}</h1>
            <div className="surface-table-subtle ops-mono">
              {formatContractLabel(asset.assetContract, 12, 8)}
            </div>
          </div>
        </div>
        <p className="surface-description">
          View its current value, allocation and the Arkas that hold it.
        </p>
      </header>

      <section
        className="workflow-signal-grid control-room-signal-grid public-detail-hero-grid-cutover"
        data-testid="asset-detail-hero"
      >
        <article className="surface-signal-card workflow-signal-card">
          <span className="workflow-signal-label">Asset</span>
          <strong className="workflow-signal-value">
            {assetLabel}
          </strong>
          <span className="workflow-signal-detail">
            {formatContractLabel(asset.assetContract, 10, 6)} · net position{" "}
            <span data-testid="asset-detail-net-position">
              {assetUsdValue}
            </span>{" "}
            across {asset.arkaCount} Arkas.
          </span>
        </article>
        <article className="surface-signal-card workflow-signal-card">
          <span className="workflow-signal-label">Current rank</span>
          <strong className="workflow-signal-value">#{asset.rank}</strong>
          <span className="workflow-signal-detail">
            Used by <span data-testid="asset-detail-breadth">{asset.managerCount}</span> managers and {asset.denominationArkaCount} denomination Arkas.
          </span>
        </article>
        <article className="surface-signal-card workflow-signal-card">
          <span className="workflow-signal-label">Last sync</span>
          <strong className="workflow-signal-value">
            {formatRelativeTime(asset.syncedAt)}
          </strong>
          <span className="workflow-signal-detail">
            Change <span data-testid="asset-detail-trend">{formatSignedBpsAsPercent(trend.deltaBps)}</span> since the previous update.
          </span>
        </article>
      </section>

      <section
        className="surface-grid surface-grid-two control-room-stage-grid explorer-detail-stage-grid explorer-detail-stage-cutover asset-detail-stage-cutover public-detail-stage-grid-cutover"
        data-testid="asset-detail-stage-grid"
      >
        <Panel
          title="Asset amount over time"
          subtitle={`${trend.pointCount} recorded updates`}
          testId="asset-detail-history-panel"
          className="explorer-detail-panel explorer-detail-history-panel public-detail-panel-cutover"
        >
          <div className="explorer-history-shell">
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

            {hasChangingHistory ? (
              <HistoryBars
                items={bars.map((bar) => ({
                  id: `${asset.assetContract}-${bar.label}`,
                  label: bar.label,
                  value: formatAssetUnits(bar.value),
                  widthPct: bar.widthPct,
                }))}
                testId="asset-history-bars"
              />
            ) : (
              <EmptyState
                title={bars.length > 1 ? "No change in this period" : "History not available yet"}
                body={
                  bars.length > 1
                    ? "The recorded asset amount stayed unchanged."
                    : "A trend will appear after another value update."
                }
                testId="asset-history-empty"
              />
            )}
          </div>
        </Panel>

        <Panel
          title="Current position"
          subtitle="Liquidity, borrowing and manager usage"
          testId="asset-detail-risk-panel"
          className="explorer-detail-panel explorer-detail-risk-panel public-detail-panel-cutover"
        >
          <div className="explorer-detail-stack">
            <div className="explorer-detail-signal-grid">
              {riskSignals.map((signal) => (
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

            <div className="surface-note">
              Collateral: {formatAssetUnits(asset.collateralAmount)}
            </div>
          </div>
        </Panel>
      </section>

      <Panel
        title="Linked Arkas"
        subtitle="Ranked by current TVL"
        testId="asset-detail-arkas-panel"
        className="explorer-detail-panel explorer-detail-linked-panel explorer-related-panel-cutover asset-detail-linked-cutover public-detail-panel-cutover public-detail-related-panel-cutover"
      >
        {arkas.items.length === 0 ? (
          <EmptyState
            title="No Arkas found"
            body="This asset is not currently linked to any Arka."
          />
        ) : (
          <div
            className="surface-spotlight-grid asset-detail-arkas-grid explorer-related-grid-cutover public-detail-related-grid-cutover"
            data-testid="asset-detail-arkas-table"
          >
            {arkas.items.map((entry) => {
              const exposure = entry.assets.find(
                (item) => item.assetContract === asset.assetContract,
              );

              return (
                <article
                  key={entry.arkaId}
                  className="surface-entry-card surface-spotlight-card asset-detail-arka-card explorer-related-card public-detail-related-card-cutover"
                  data-testid="asset-detail-arka-card"
                >
                  <div className="surface-spotlight-head">
                    <div className="explorer-related-summary">
                      <div className="surface-table-hint">#{entry.rank}</div>
                      <div className="surface-spotlight-title">
                        {resolveArkaDisplayName(entry)}
                      </div>
                      <div className="surface-table-subtle">
                        {entry.identity?.description
                          ? resolveArkaSubtitle(entry)
                          : formatContractLabel(entry.arkaId, 12, 6)}
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
                    {entry.economics?.navUsdEstimate !== null && entry.economics?.navUsdEstimate !== undefined
                      ? formatUsdBaseUnitAmount(entry.economics.navUsdEstimate)
                      : "Valuation unavailable"}
                  </div>

                  <div className="surface-spotlight-strip" aria-hidden="true">
                    <span
                      style={{ width: `${computeSpotlightWidthByRank(entry.rank)}%` }}
                    />
                  </div>

                  <div className="explorer-related-meta">
                    <span>
                      Position{" "}
                      {exposure
                        ? formatAssetUnits(exposure.netManagedAmount)
                        : "n/a"}
                    </span>
                    <span>{formatRelativeTime(entry.syncedAt)}</span>
                  </div>

                  <div className="surface-spotlight-footer">
                    <Link
                      href={`/arkas/${entry.arkaId}`}
                      className="surface-table-link"
                    >
                      Open Arka profile
                    </Link>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </Panel>
    </div>
  );
}
