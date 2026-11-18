import {
  formatContractLabel,
  formatHealthLabel,
  formatRelativeTime,
  formatUsdBaseUnitAmount,
  formatWeightLabel,
} from "./format";
import { resolveAssetDisplayLabel } from "./assetPresentation";
import type { DashboardBundle } from "./types";

export type DashboardSectionId =
  | "arkas"
  | "managers"
  | "activity"
  | "capital"
  | "monitoring";

export type DashboardSectionTone =
  | "positive"
  | "warning"
  | "critical"
  | "neutral";

export interface DashboardSectionTab {
  id: DashboardSectionId;
  label: string;
  eyebrow: string;
  description: string;
  route: string | null;
  routeLabel: string;
}

export interface DashboardSectionSignal {
  id: string;
  label: string;
  value: string;
  detail: string;
  tone: DashboardSectionTone;
}

export interface DashboardSectionState {
  tab: DashboardSectionTab;
  signals: DashboardSectionSignal[];
}

export interface DashboardSectionCommand {
  id: "surface" | "route" | "source";
  label: string;
  value: string;
  detail: string;
  tone: DashboardSectionTone;
  href: string | null;
  ctaLabel: string;
}

export const DASHBOARD_SECTION_TABS: DashboardSectionTab[] = [
  {
    id: "arkas",
    label: "Arkas",
    eyebrow: "Featured vaults",
    description:
      "Ranked Arkas with curation, TVL and route availability.",
    route: "/vaults",
    routeLabel: "Open Arka leaderboard",
  },
  {
    id: "managers",
    label: "Managers",
    eyebrow: "Managers",
    description:
      "Capital concentration by manager, with curated and delisted Arkas visible.",
    route: "/managers",
    routeLabel: "Open manager leaderboard",
  },
  {
    id: "activity",
    label: "Activity",
    eyebrow: "Flows",
    description:
      "Deposits, redeems and Blend credit events across Arkas.",
    route: null,
    routeLabel: "Review activity",
  },
  {
    id: "capital",
    label: "Capital",
    eyebrow: "Asset mix",
    description:
      "Current value contribution, concentration and linked asset drill-downs.",
    route: "/assets",
    routeLabel: "Open asset explorer",
  },
  {
    id: "monitoring",
    label: "Monitoring",
    eyebrow: "Status",
    description:
      "Freshness, consecutive failures and active alert pressure.",
    route: "/status",
    routeLabel: "Open status console",
  },
];

const DASHBOARD_SECTION_TAB_MAP = new Map(
  DASHBOARD_SECTION_TABS.map((tab) => [tab.id, tab]),
);

export function resolveDashboardSectionId(
  value: string | null | undefined,
  fallback: DashboardSectionId = "arkas",
): DashboardSectionId {
  return DASHBOARD_SECTION_TAB_MAP.has(value as DashboardSectionId)
    ? (value as DashboardSectionId)
    : fallback;
}

export function getDashboardSectionTab(
  id: DashboardSectionId,
): DashboardSectionTab {
  return DASHBOARD_SECTION_TAB_MAP.get(id) ?? DASHBOARD_SECTION_TABS[0];
}

function latestSyncedAt(bundle: DashboardBundle): string | null {
  const candidates = bundle.arkas.items
    .map((entry) => entry.syncedAt)
    .filter((value): value is string => Boolean(value));

  if (candidates.length === 0) {
    return null;
  }

  return candidates.sort(
    (left, right) => new Date(right).getTime() - new Date(left).getTime(),
  )[0];
}

function formatSnapshotAge(seconds: number | null | undefined): string {
  if (typeof seconds !== "number" || !Number.isFinite(seconds)) {
    return "n/a";
  }

  if (seconds < 60) {
    return `${seconds}s`;
  }

  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  return remainder > 0 ? `${minutes}m ${remainder}s` : `${minutes}m`;
}

function toneForMonitoring(bundle: DashboardBundle): DashboardSectionTone {
  if (!bundle.monitoring.healthy) {
    return "critical";
  }

  if (bundle.monitoring.degraded || bundle.monitoring.activeAlerts.length > 0) {
    return "warning";
  }

  return "positive";
}

function buildArkaSignals(bundle: DashboardBundle): DashboardSectionSignal[] {
  const latest = latestSyncedAt(bundle);
  return [
    {
      id: "total-arkas",
      label: "Arkas",
      value: String(bundle.overview.totalArkas),
      detail: `${bundle.overview.curatedArkas} curated / ${bundle.overview.delistedArkas} delisted`,
      tone: bundle.overview.delistedArkas > 0 ? "warning" : "positive",
    },
    {
      id: "top-value",
      label: "Featured TVL",
      value:
        bundle.arkas.items[0]?.economics?.navUsdEstimate !== null &&
        bundle.arkas.items[0]?.economics?.navUsdEstimate !== undefined
        ? formatUsdBaseUnitAmount(bundle.arkas.items[0].economics.navUsdEstimate)
        : bundle.arkas.items[0]
          ? "Valuation unavailable"
          : "n/a",
      detail: bundle.arkas.items[0]
        ? `#${bundle.arkas.items[0].rank} ranked Arka`
        : "No Arka available yet",
      tone: "neutral",
    },
    {
      id: "sync",
      label: "Last Arka sync",
      value: latest ? formatRelativeTime(latest) : "n/a",
      detail: latest
        ? "latest Arka update"
        : "no update timestamp available",
      tone: latest ? "positive" : "warning",
    },
  ];
}

function buildManagerSignals(
  bundle: DashboardBundle,
): DashboardSectionSignal[] {
  const leadManager = bundle.managers.items[0];
  return [
    {
      id: "total-managers",
      label: "Managers",
      value: String(bundle.overview.totalManagers),
      detail: `${bundle.overview.totalAssets} assets across managed Arkas`,
      tone: "neutral",
    },
    {
      id: "lead-manager",
      label: "Lead manager TVL",
      value:
        leadManager?.totalNavUsdEstimate !== null &&
        leadManager?.totalNavUsdEstimate !== undefined
          ? formatUsdBaseUnitAmount(leadManager.totalNavUsdEstimate)
          : "Valuation unavailable",
      detail: leadManager
        ? `${formatContractLabel(leadManager.manager, 8, 6)} · ${leadManager.arkaCount} Arkas`
        : "No manager available yet",
      tone: "neutral",
    },
    {
      id: "curation",
      label: "Curated operator share",
      value: String(
        bundle.managers.items.reduce(
          (total, manager) => total + manager.curatedArkaCount,
          0,
        ),
      ),
      detail: "curated Arkas represented across managers",
      tone: "positive",
    },
  ];
}

function buildActivitySignals(
  bundle: DashboardBundle,
): DashboardSectionSignal[] {
  const { activity } = bundle.overview;
  const creditEvents =
    activity.counts.lend +
    activity.counts.borrow +
    activity.counts.repay +
    activity.counts.withdraw;

  return [
    {
      id: "events",
      label: "Events",
      value: String(activity.totalEvents),
      detail: `${activity.uniqueUsers} unique users in the current stream`,
      tone: activity.totalEvents > 0 ? "positive" : "warning",
    },
    {
      id: "user-flow",
      label: "Deposit and redeem activity",
      value: String(activity.counts.deposit + activity.counts.redeem),
      detail: `${activity.counts.deposit} deposits / ${activity.counts.redeem} redeems`,
      tone: activity.counts.deposit + activity.counts.redeem > 0 ? "positive" : "warning",
    },
    {
      id: "credit-flow",
      label: "Credit actions",
      value: String(creditEvents),
      detail: "Blend lend, borrow, repay and withdraw events",
      tone: creditEvents > 0 ? "neutral" : "warning",
    },
  ];
}

function buildCapitalSignals(
  bundle: DashboardBundle,
): DashboardSectionSignal[] {
  const leadAsset = bundle.composition.items[0];
  return [
    {
      id: "tracked-assets",
      label: "Tracked assets",
      value: String(bundle.composition.items.length),
      detail: `${bundle.overview.totalAssets} assets registered across the network`,
      tone: "neutral",
    },
    {
      id: "lead-share",
      label: "Lead share",
      value: leadAsset ? formatWeightLabel(leadAsset.weightBps) : "n/a",
      detail: leadAsset
        ? resolveAssetDisplayLabel(leadAsset.assetContract)
        : "no asset composition available yet",
      tone: leadAsset && leadAsset.weightBps > 5000 ? "warning" : "positive",
    },
    {
      id: "portfolio-nav",
      label: "Portfolio TVL",
      value: bundle.overview.totalNavUsdEstimate
        ? formatUsdBaseUnitAmount(bundle.overview.totalNavUsdEstimate)
        : "Valuation unavailable",
      detail: bundle.overview.totalNavUsdEstimate
        ? "total value across visible Arkas"
        : "USD pricing is not available for every denomination",
      tone: bundle.overview.totalNavUsdEstimate ? "neutral" : "warning",
    },
  ];
}

function buildMonitoringSignals(
  bundle: DashboardBundle,
): DashboardSectionSignal[] {
  const { monitoring } = bundle;
  const statusTone = toneForMonitoring(bundle);

  return [
    {
      id: "health",
      label: "System status",
      value: formatHealthLabel(monitoring.healthy, monitoring.degraded),
      detail:
        monitoring.activeAlerts.length > 0
          ? `${monitoring.activeAlerts.length} active alert(s)`
          : "no active monitoring alerts",
      tone: statusTone,
    },
    {
      id: "snapshot-age",
      label: "Latest update",
      value: formatSnapshotAge(monitoring.snapshotAgeSeconds),
      detail: "time since the latest monitoring update",
      tone:
        typeof monitoring.snapshotAgeSeconds === "number" &&
        monitoring.snapshotAgeSeconds > 300
          ? "warning"
          : "positive",
    },
    {
      id: "failures",
      label: "Failures",
      value: String(monitoring.consecutiveFailures),
      detail: monitoring.lastRun
        ? `${monitoring.lastRun.durationMs}ms last sync duration`
        : "last sync duration unavailable",
      tone: monitoring.consecutiveFailures > 0 ? "warning" : "positive",
    },
  ];
}

export function buildDashboardSectionSignals(
  bundle: DashboardBundle,
  section: DashboardSectionId,
): DashboardSectionSignal[] {
  switch (section) {
    case "managers":
      return buildManagerSignals(bundle);
    case "activity":
      return buildActivitySignals(bundle);
    case "capital":
      return buildCapitalSignals(bundle);
    case "monitoring":
      return buildMonitoringSignals(bundle);
    case "arkas":
    default:
      return buildArkaSignals(bundle);
  }
}

export function buildDashboardSectionState(
  bundle: DashboardBundle,
  section: DashboardSectionId,
): DashboardSectionState {
  return {
    tab: getDashboardSectionTab(section),
    signals: buildDashboardSectionSignals(bundle, section),
  };
}

export function buildDashboardSectionCommandDeck(
  bundle: DashboardBundle,
  section: DashboardSectionId,
): DashboardSectionCommand[] {
  const tab = getDashboardSectionTab(section);
  const signals = buildDashboardSectionSignals(bundle, section);
  const latest = latestSyncedAt(bundle);
  const sourceTone = toneForMonitoring(bundle);

  return [
    {
      id: "surface",
      label: "Current view",
      value: tab.label,
      detail: `${signals.length} live indicators shown for this view.`,
      tone: "neutral",
      href: null,
      ctaLabel: "Current view",
    },
    {
      id: "route",
      label: "Linked page",
      value: tab.route ? "Linked page" : "Dashboard view",
      detail: tab.route
        ? `${tab.route} opens the full ${tab.label.toLowerCase()} page.`
        : "This view stays in Dashboard because it summarizes portfolio activity.",
      tone: tab.route ? "positive" : "neutral",
      href: tab.route,
      ctaLabel: tab.route ? tab.routeLabel : "Stay in dashboard",
    },
    {
      id: "source",
      label: "Data source",
      value:
        sourceTone === "positive"
          ? "Live"
          : sourceTone === "warning"
            ? "Watch"
            : "Attention",
      detail: latest
        ? `${bundle.overview.totalArkas} Arkas, ${bundle.overview.totalAssets} assets. Latest Arka update ${formatRelativeTime(latest)}.`
        : `${bundle.overview.totalArkas} Arkas, ${bundle.overview.totalAssets} assets. No Arka update timestamp available yet.`,
      tone: sourceTone,
      href: "/status",
      ctaLabel: "Inspect status",
    },
  ];
}
