import {
  formatContractLabel,
  formatRelativeTime,
  formatUsdBaseUnitAmount,
} from "./format";
import type { DiscoverBundle } from "./types";
import { resolveAssetDisplayLabel } from "./assetPresentation";

export type DiscoverSectionId = "arkas" | "managers" | "assets";

export type DiscoverSectionTone = "positive" | "warning" | "neutral";

export interface DiscoverSectionTab {
  id: DiscoverSectionId;
  label: string;
  eyebrow: string;
  description: string;
  route: string;
  routeLabel: string;
}

export interface DiscoverSectionSignal {
  id: string;
  label: string;
  value: string;
  detail: string;
  tone: DiscoverSectionTone;
}

export interface DiscoverSectionState {
  tab: DiscoverSectionTab;
  signals: DiscoverSectionSignal[];
}

export interface DiscoverSectionCommand {
  id: "scope" | "route" | "source";
  label: string;
  value: string;
  detail: string;
  tone: DiscoverSectionTone;
  href: string | null;
  ctaLabel: string;
}

export const DISCOVER_SECTION_TABS: DiscoverSectionTab[] = [
  {
    id: "arkas",
    label: "Featured Arkas",
    eyebrow: "Arka shortlist",
    description:
      "Ranked Arka cards, current allocation bands, curation state and profile entry points.",
    route: "/vaults",
    routeLabel: "Open full Arka explorer",
  },
  {
    id: "managers",
    label: "Managers",
    eyebrow: "Manager shortlist",
    description:
      "Manager cards ranked by TVL, with curation breadth and recent updates.",
    route: "/managers",
    routeLabel: "Open full manager explorer",
  },
  {
    id: "assets",
    label: "Assets",
    eyebrow: "Exposure shortlist",
    description:
      "Largest asset exposures and allocation footprint across current Arkas.",
    route: "/assets",
    routeLabel: "Open full asset explorer",
  },
];

const DISCOVER_SECTION_TAB_MAP = new Map(
  DISCOVER_SECTION_TABS.map((tab) => [tab.id, tab]),
);

export function resolveDiscoverSectionId(
  value: string | null | undefined,
  fallback: DiscoverSectionId = "arkas",
): DiscoverSectionId {
  return DISCOVER_SECTION_TAB_MAP.has(value as DiscoverSectionId)
    ? (value as DiscoverSectionId)
    : fallback;
}

export function getDiscoverSectionTab(
  id: DiscoverSectionId,
): DiscoverSectionTab {
  return DISCOVER_SECTION_TAB_MAP.get(id) ?? DISCOVER_SECTION_TABS[0];
}

function sumBigInt(values: string[]): string {
  return values
    .reduce((accumulator, value) => accumulator + BigInt(value), BigInt(0))
    .toString();
}

function sumArkaUsdEstimate(bundle: DiscoverBundle): {
  value: string | null;
  missingCount: number;
} {
  if (bundle.arkas.items.length === 0) {
    return { value: null, missingCount: 0 };
  }

  const missingCount = bundle.arkas.items.filter(
    (entry) =>
      (entry.economics?.navUsdEstimate === null ||
        entry.economics?.navUsdEstimate === undefined) &&
      (entry.nav === null || BigInt(entry.nav || "0") > BigInt(0)),
  ).length;

  if (missingCount > 0) {
    return { value: null, missingCount };
  }

  return {
    value: bundle.arkas.items
      .reduce(
        (accumulator, entry) => accumulator + BigInt(entry.economics?.navUsdEstimate ?? "0"),
        BigInt(0),
      )
      .toString(),
    missingCount: 0,
  };
}

function latestSyncedAt(values: string[]): string | null {
  const candidates = values.filter(Boolean);
  if (candidates.length === 0) {
    return null;
  }

  return candidates.sort(
    (left, right) => new Date(right).getTime() - new Date(left).getTime(),
  )[0];
}

function buildArkaSignals(
  bundle: DiscoverBundle,
  options: { curatedOnly: boolean; search: string },
): DiscoverSectionSignal[] {
  const curatedCount = bundle.arkas.items.filter(
    (entry) => entry.curated,
  ).length;
  const delistedCount = bundle.arkas.items.filter(
    (entry) => entry.delisted,
  ).length;
  const visibleUsd = sumArkaUsdEstimate(bundle);
  const latest = latestSyncedAt(
    bundle.arkas.items.map((entry) => entry.syncedAt),
  );
  const query = options.search.trim();
  const missingUsdCount = visibleUsd.missingCount || bundle.arkas.items.length;

  return [
    {
      id: "arkas",
      label: "Visible Arkas",
      value: String(bundle.arkas.total),
      detail: query
        ? `matching "${query}" in the current results`
        : options.curatedOnly
          ? "curated-first results window"
          : "full results window",
      tone: bundle.arkas.total > 0 ? "positive" : "warning",
    },
    {
      id: "nav",
      label: "Visible TVL",
      value: visibleUsd.value ? formatUsdBaseUnitAmount(visibleUsd.value) : "Valuation unavailable",
      detail: visibleUsd.value
        ? `${curatedCount} curated / ${delistedCount} delisted in the visible set`
        : missingUsdCount === 1
          ? "1 Arka needs USD pricing"
          : `${missingUsdCount} Arkas need USD pricing`,
      tone: visibleUsd.value && delistedCount === 0 ? "positive" : "warning",
    },
    {
      id: "sync",
      label: "Freshest sync",
      value: latest ? formatRelativeTime(latest) : "n/a",
      detail: latest
        ? "latest Arka card in the current window"
        : "no update timestamp available",
      tone: latest ? "neutral" : "warning",
    },
  ];
}

function buildManagerSignals(bundle: DiscoverBundle): DiscoverSectionSignal[] {
  const leadManager = bundle.managers.items[0];
  const managerValues = bundle.managers.items.map(
    (entry) => entry.totalNavUsdEstimate,
  );
  const hasCompleteManagerValuation = managerValues.every(
    (value) => value !== null && value !== undefined,
  );
  const totalNav = hasCompleteManagerValuation
    ? sumBigInt(managerValues.map((value) => value ?? "0"))
    : null;
  const curatedArkas = bundle.managers.items.reduce(
    (total, entry) => total + entry.curatedArkaCount,
    0,
  );

  return [
    {
      id: "managers",
      label: "Visible managers",
      value: String(bundle.managers.total),
      detail: `${curatedArkas} curated Arkas represented by visible managers`,
      tone: bundle.managers.total > 0 ? "positive" : "warning",
    },
    {
      id: "manager-nav",
      label: "Manager TVL",
      value: totalNav === null ? "Valuation unavailable" : formatUsdBaseUnitAmount(totalNav),
      detail: leadManager
        ? `Lead ${formatContractLabel(leadManager.manager, 8, 6)}`
        : "no manager in this window",
      tone: "neutral",
    },
    {
      id: "lead",
      label: "Lead manager",
      value: leadManager ? `${leadManager.arkaCount} Arkas` : "n/a",
      detail: leadManager
        ? leadManager.totalNavUsdEstimate !== null && leadManager.totalNavUsdEstimate !== undefined
          ? `${formatUsdBaseUnitAmount(leadManager.totalNavUsdEstimate)} · updated ${formatRelativeTime(leadManager.syncedAt)}`
          : `Valuation unavailable · updated ${formatRelativeTime(leadManager.syncedAt)}`
        : "no manager card",
      tone: leadManager ? "neutral" : "warning",
    },
  ];
}

function buildAssetSignals(bundle: DiscoverBundle): DiscoverSectionSignal[] {
  const leadAsset = bundle.assets.items[0];
  const assetValues = bundle.assets.items.map((entry) => entry.netManagedUsdEstimate);
  const hasCompleteAssetValuation = assetValues.every(
    (value) => value !== null && value !== undefined,
  );
  const totalExposure = hasCompleteAssetValuation
    ? sumBigInt(assetValues.map((value) => value ?? "0"))
    : null;
  const denominationCount = bundle.assets.items.reduce(
    (total, entry) => total + entry.denominationArkaCount,
    0,
  );

  return [
    {
      id: "assets",
      label: "Visible assets",
      value: String(bundle.assets.total),
      detail: `${denominationCount} denomination assignments in visible assets`,
      tone: bundle.assets.total > 0 ? "positive" : "warning",
    },
    {
      id: "exposure",
      label: "Visible exposure",
      value: totalExposure === null ? "Valuation unavailable" : formatUsdBaseUnitAmount(totalExposure),
      detail: leadAsset
        ? `Lead ${resolveAssetDisplayLabel(leadAsset.assetContract)}`
        : "no asset exposure available",
      tone: "neutral",
    },
    {
      id: "lead-asset",
      label: "Lead asset breadth",
      value: leadAsset ? `${leadAsset.arkaCount} Arkas` : "n/a",
      detail: leadAsset
        ? `${leadAsset.managerCount} managers · ${leadAsset.denominationArkaCount} denomination Arkas`
        : "no synced asset card",
      tone: leadAsset ? "neutral" : "warning",
    },
  ];
}

export function buildDiscoverSectionSignals(
  bundle: DiscoverBundle,
  section: DiscoverSectionId,
  options: { curatedOnly: boolean; search: string },
): DiscoverSectionSignal[] {
  switch (section) {
    case "managers":
      return buildManagerSignals(bundle);
    case "assets":
      return buildAssetSignals(bundle);
    case "arkas":
    default:
      return buildArkaSignals(bundle, options);
  }
}

export function buildDiscoverSectionState(
  bundle: DiscoverBundle,
  section: DiscoverSectionId,
  options: { curatedOnly: boolean; search: string },
): DiscoverSectionState {
  return {
    tab: getDiscoverSectionTab(section),
    signals: buildDiscoverSectionSignals(bundle, section, options),
  };
}

export function buildDiscoverSectionCommandDeck(
  bundle: DiscoverBundle,
  section: DiscoverSectionId,
  options: { curatedOnly: boolean; search: string },
): DiscoverSectionCommand[] {
  const tab = getDiscoverSectionTab(section);
  const query = options.search.trim();
  const signals = buildDiscoverSectionSignals(bundle, section, options);
  const latest = latestSyncedAt([
    ...bundle.arkas.items.map((entry) => entry.syncedAt),
    ...bundle.managers.items.map((entry) => entry.syncedAt),
    ...bundle.assets.items.map((entry) => entry.syncedAt),
  ]);
  const visibleTotal =
    section === "managers"
      ? bundle.managers.total
      : section === "assets"
        ? bundle.assets.total
        : bundle.arkas.total;
  const totalCatalogItems =
    bundle.arkas.total + bundle.managers.total + bundle.assets.total;
  const scopeLabel = query
    ? `Search "${query}"`
    : options.curatedOnly
      ? "Curated scope"
      : "All";

  return [
    {
      id: "scope",
      label: "Active filter",
      value: scopeLabel,
      detail: `${visibleTotal} ${tab.label.toLowerCase()} visible; ${signals.length} live indicators for the current view.`,
      tone: visibleTotal > 0 ? "positive" : "warning",
      href: null,
      ctaLabel: "Current window",
    },
    {
      id: "route",
      label: "Full view",
      value: tab.route,
      detail: `${tab.routeLabel} opens the complete ${tab.label.toLowerCase()} view.`,
      tone: "positive",
      href: tab.route,
      ctaLabel: tab.routeLabel,
    },
    {
      id: "source",
      label: "Data",
      value: totalCatalogItems > 0 ? "Live" : "Empty",
      detail: latest
        ? `${bundle.arkas.total} Arkas, ${bundle.managers.total} managers and ${bundle.assets.total} assets. Latest update ${formatRelativeTime(latest)}.`
        : `${bundle.arkas.total} Arkas, ${bundle.managers.total} managers and ${bundle.assets.total} assets. No update timestamp is available yet.`,
      tone: totalCatalogItems > 0 ? "positive" : "warning",
      href: "/status",
      ctaLabel: "Inspect status",
    },
  ];
}
