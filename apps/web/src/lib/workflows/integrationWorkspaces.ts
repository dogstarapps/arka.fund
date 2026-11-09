import type {
  ExecutionVenueDescriptor,
  ExecutionVenuePlannerAdmission,
} from "@/lib/workflows/executionVenues";
import {
  formatExecutionVenuePlannerAdmissionLabel,
} from "@/lib/workflows/executionVenues";

type StatusTone = "neutral" | "positive" | "warning" | "critical";
export type IntegrationSurfaceMode = "public" | "operator";

export type IntegrationWorkspaceId =
  | "routing"
  | "sodax"
  | "execution"
  | "actions";

export interface IntegrationWorkspaceTab {
  id: IntegrationWorkspaceId;
  label: string;
  eyebrow: string;
  description: string;
}

export interface IntegrationWorkspaceSignal {
  id: string;
  label: string;
  value: string;
  detail: string;
  tone: StatusTone;
}

export interface IntegrationPublicMetricTile {
  id:
    | "routes"
    | "auto"
    | "sodax"
    | "wallet"
    | "balanced"
    | "mainnet";
  label: string;
  value: string;
  detail: string;
  tone: StatusTone;
}

export interface IntegrationWorkspaceSnapshot {
  walletLabel: string;
  canAct: boolean;
  loadedRoutes: number;
  totalRoutes: number;
  balancedLabel: string;
  balancedTone: StatusTone;
  aquariusLabel: string;
  aquariusTone: StatusTone;
  soroswapLabel: string;
  soroswapTone: StatusTone;
  phoenixLabel?: string;
  sushiLabel?: string;
  phoenixTone?: StatusTone;
  sushiTone?: StatusTone;
  blendLabel: string;
  blendTone: StatusTone;
  balancedIntentTokensLoaded: number;
  balancedQuoteReason: string;
  balancedStatusReason: string;
  balancedConfirmationReason: string;
  balancedDriverSummary: string;
  balancedLaneReady: boolean;
  balancedLaneDetail: string;
  mainnetGateReady: boolean;
  mainnetGateDetail: string;
  blendAction: string;
  blendAmount: string;
  executionReceiptReady: boolean;
}

export interface IntegrationWorkspaceState {
  tab: IntegrationWorkspaceTab;
  signals: IntegrationWorkspaceSignal[];
}

export interface IntegrationProtocolCommand {
  id: "balanced" | "amm" | "blend" | "checks";
  label: string;
  title: string;
  value: string;
  detail: string;
  tone: StatusTone;
  workspace: IntegrationWorkspaceId;
  ctaLabel: string;
  href?: string;
}

export interface IntegrationProtocolCatalogCard {
  id: ExecutionVenueDescriptor["id"];
  title: string;
  brandLabel: string;
  eyebrow: string;
  statusLabel: string;
  statusTone: StatusTone;
  postureLabel: string;
  detail: string;
  capability: string;
  ctaLabel: string;
  workspace: IntegrationWorkspaceId;
  href?: string;
}

export interface IntegrationSurfaceAccessModel {
  mode: IntegrationSurfaceMode;
  publicRoute: "/integrations";
  operatorRoute: "/integrations/operator";
  publicSections: Array<"catalog" | "metrics">;
  operatorSections: Array<"workspace-tabs" | "router-diagnostics" | "sodax-console" | "execution-console" | "protocol-actions">;
  operatorOnlyTestIds: string[];
  publicSummary: string;
  operatorSummary: string;
}

function formatPublicIntegrationDetail(value: string): string {
  return value
    .replace(/\b[Bb]locked\b/g, "not ready")
    .replace(/\blane\b/gi, "path")
    .replace(/\badapter-gated\b/gi, "governed route")
    .replace("Source verified", "Verified source")
    .replace("Quote Manual review", "manual review")
    .replace("Quote public", "public quote")
    .replace("Execution Execution unavailable", "execution not ready")
    .replace("Execution Manual execution", "manual execution")
    .replace("Confirm Transaction hash + refreshed", "confirmation available")
    .replace("Confirm available", "confirmation available")
    .replace(/\s+·\s+/g, "; ");
}

export const INTEGRATION_WORKSPACE_TABS: IntegrationWorkspaceTab[] = [
  {
    id: "routing",
    label: "Protocols",
    eyebrow: "Protocol map",
    description:
      "Supported protocols, configured routers and observed availability.",
  },
  {
    id: "sodax",
    label: "Balanced / SODAX",
    eyebrow: "Intent surface",
    description:
      "Quote, status and confirmation readiness for Balanced/SODAX.",
  },
  {
    id: "execution",
    label: "Execution",
    eyebrow: "Operator readiness",
    description:
      "Wallet, router refresh and receipt state before live protocol actions.",
  },
  {
    id: "actions",
    label: "Actions",
    eyebrow: "Protocol commands",
    description:
      "Balanced, Blend and AMM actions with readiness details visible.",
  },
];

export const INTEGRATION_OPERATOR_ONLY_TEST_IDS = [
  "integrations-workspace-tabs",
  "integrations-workspace-summary",
  "integrations-command-deck",
  "integrations-routing-panel",
  "integrations-routing-table",
  "integrations-sodax-panel",
  "integrations-balanced-intent-surface-panel",
  "integrations-controls-panel",
  "integrations-actions-panel",
] as const;

export function buildIntegrationSurfaceAccessModel(
  mode: IntegrationSurfaceMode,
): IntegrationSurfaceAccessModel {
  return {
    mode,
    publicRoute: "/integrations",
    operatorRoute: "/integrations/operator",
    publicSections: ["catalog", "metrics"],
    operatorSections: [
      "workspace-tabs",
      "router-diagnostics",
      "sodax-console",
      "execution-console",
      "protocol-actions",
    ],
    operatorOnlyTestIds: [...INTEGRATION_OPERATOR_ONLY_TEST_IDS],
    publicSummary:
      "See where an Arka can swap assets or manage a lending position.",
    operatorSummary:
      "Integrations Operator exposes quote, status, confirmation, router diagnostics and wallet-signed protocol actions behind verified operator access.",
  };
}

export function isIntegrationOperatorSurface(
  mode: IntegrationSurfaceMode,
): boolean {
  return mode === "operator";
}

const TAB_MAP = new Map(INTEGRATION_WORKSPACE_TABS.map((tab) => [tab.id, tab]));

function venueById(
  venues: ExecutionVenueDescriptor[],
  id: ExecutionVenueDescriptor["id"],
): ExecutionVenueDescriptor | null {
  return venues.find((venue) => venue.id === id) ?? null;
}

function admissionValue(
  admission: ExecutionVenuePlannerAdmission | undefined,
): string {
  if (!admission || admission === "blocked") return "Not ready";
  return formatExecutionVenuePlannerAdmissionLabel(admission);
}

function compactVenueState(venue: ExecutionVenueDescriptor | null): string {
  if (!venue) return "Unavailable";
  if (venue.autoRoutingEligible) return "AUTO";
  if (venue.manualExecutionEligible) return "Manual";
  return "Not ready";
}

function commandToneFromVenues(
  venues: Array<ExecutionVenueDescriptor | null>,
): StatusTone {
  if (venues.some((venue) => venue?.autoRoutingEligible)) return "positive";
  if (venues.some((venue) => venue?.manualExecutionEligible)) return "warning";
  return "critical";
}

function compactProtocolDetail(value: string): string {
  const [firstSentence] = value.split(/(?<=\.)\s+/);
  return (firstSentence || value).trim();
}

function publicVenueStatusLabel(venue: ExecutionVenueDescriptor): string {
  if (venue.autoRoutingEligible) return "Auto comparison";
  if (venue.manualExecutionEligible) return "Manager review";
  return "Unavailable";
}

function publicVenueDetail(venue: ExecutionVenueDescriptor): string {
  if (venue.id === "BALANCED") {
    return venue.manualExecutionEligible
      ? "A manager-reviewed Balanced / SODAX route is configured. Availability still depends on a live quote and fund policies."
      : "Balanced swaps are not currently available.";
  }
  if (venue.id === "BLEND") {
    return venue.manualExecutionEligible
      ? "Blend is connected. Supply, borrow, repay and withdraw depend on each fund's enabled actions and market risk checks."
      : "Blend actions are not currently available.";
  }
  if (venue.family === "amm_router") {
    return venue.autoRoutingEligible
      ? `${venue.title} is included when an Arka searches for the best swap price.`
      : `${venue.title} is not currently available for swaps.`;
  }
  return compactProtocolDetail(venue.detail);
}

function publicVenueCapability(venue: ExecutionVenueDescriptor): string {
  if (venue.autoRoutingEligible) {
    return "Compared automatically before a swap";
  }
  if (venue.manualExecutionEligible) {
    return "Choose this protocol directly";
  }
  return "";
}

function publicVenueCategory(venue: ExecutionVenueDescriptor): string {
  return venue.id === "BLEND" ? "Lending" : "Swaps";
}

function protocolCatalogOrder(id: ExecutionVenueDescriptor["id"]): number {
  if (id === "BLEND") return 0;
  if (id === "SOROSWAP") return 1;
  if (id === "AQUARIUS") return 2;
  if (id === "SUSHI") return 3;
  if (id === "BALANCED") return 4;
  return 4;
}

function protocolCatalogCta(
  venue: ExecutionVenueDescriptor,
): Pick<IntegrationProtocolCatalogCard, "ctaLabel" | "workspace" | "href"> {
  if (!venue.autoRoutingEligible && !venue.manualExecutionEligible) {
    return { ctaLabel: "Choose a fund to manage", workspace: "routing", href: "/manage" };
  }
  if (venue.id === "BALANCED") {
    return { ctaLabel: "Choose a fund to manage", workspace: "sodax", href: "/manage" };
  }
  if (venue.id === "BLEND") {
    return { ctaLabel: "Choose a fund to manage", workspace: "actions", href: "/manage" };
  }
  if (venue.family === "amm_router") {
    return {
      ctaLabel: "Choose a fund to manage",
      workspace: "actions",
      href: "/manage",
    };
  }
  return { ctaLabel: "Choose a fund to manage", workspace: "routing", href: "/manage" };
}

export function buildIntegrationProtocolCatalogCards(
  venues: ExecutionVenueDescriptor[],
): IntegrationProtocolCatalogCard[] {
  return [...venues]
    .sort((a, b) => protocolCatalogOrder(a.id) - protocolCatalogOrder(b.id))
    .map((venue) => {
      const cta = protocolCatalogCta(venue);
      const publicTitle =
        venue.id === "BALANCED" ? "Balanced / SODAX" : venue.title;
      return {
        id: venue.id,
        title: publicTitle,
        brandLabel: publicTitle,
        eyebrow: publicVenueCategory(venue),
        statusLabel: publicVenueStatusLabel(venue),
        statusTone: venue.statusTone,
        postureLabel: publicVenueStatusLabel(venue),
        detail: publicVenueDetail(venue),
        capability: publicVenueCapability(venue),
        ...cta,
      };
    });
}

export function buildIntegrationProtocolCommandDeck(input: {
  venues: ExecutionVenueDescriptor[];
  loadedRoutes: number;
  totalRoutes: number;
  walletLabel: string;
}): IntegrationProtocolCommand[] {
  const balanced = venueById(input.venues, "BALANCED");
  const blend = venueById(input.venues, "BLEND");
  const soroswap = venueById(input.venues, "SOROSWAP");
  const aquarius = venueById(input.venues, "AQUARIUS");
  const sushi = venueById(input.venues, "SUSHI");
  const ammVenues = [soroswap, aquarius, sushi];
  const autoAmmCount = ammVenues.filter((venue) => venue?.autoRoutingEligible).length;
  const manualAmmCount = ammVenues.filter(
    (venue) => venue?.manualExecutionEligible,
  ).length;
  const allRoutesLoaded = input.loadedRoutes >= input.totalRoutes;

  return [
    {
      id: "balanced",
      label: "Intent venue",
      title: "Balanced / SODAX",
      value: admissionValue(balanced?.plannerAdmission),
      detail:
        balanced?.detail ??
        "Balanced/SODAX is not available in the current protocol list.",
      tone: balanced?.statusTone ?? "critical",
      workspace: "sodax",
      ctaLabel: "Inspect SODAX",
    },
    {
      id: "amm",
      label: "Swap routing",
      title: "SoroSwap + Aquarius + Sushi",
      value:
        autoAmmCount > 0
          ? `${autoAmmCount}/3 AUTO`
          : manualAmmCount > 0
            ? `${manualAmmCount}/3 manual`
            : "Not ready",
      detail:
        "AMM swaps are opened from each Arka so the manager keeps the selected assets and route context.",
      tone: commandToneFromVenues(ammVenues),
      workspace: "actions",
      ctaLabel: "Open Arka actions",
      href: "/arkas",
    },
    {
      id: "blend",
      label: "Credit venue",
      title: "Blend",
      value: compactVenueState(blend),
      detail:
        blend?.detail ??
        "Blend is not available in the current protocol list.",
      tone: blend?.statusTone ?? "critical",
      workspace: "actions",
      ctaLabel: "Review Blend",
    },
    {
      id: "checks",
      label: "Readiness",
      title: "Adapter reads",
      value: `${input.loadedRoutes}/${input.totalRoutes}`,
      detail: allRoutesLoaded
        ? `All supported protocol checks returned for ${input.walletLabel}.`
        : "Refresh protocol checks before signing any action; missing routes remain pending until readable.",
      tone: allRoutesLoaded ? "positive" : "warning",
      workspace: "execution",
      ctaLabel: "Review checks",
    },
  ];
}

export function buildIntegrationPublicMetricDeck(input: {
  snapshot: IntegrationWorkspaceSnapshot;
  venues: ExecutionVenueDescriptor[];
}): IntegrationPublicMetricTile[] {
  const autoVenues = input.venues.filter((venue) => venue.autoRoutingEligible);
  const manualVenues = input.venues.filter(
    (venue) => venue.manualExecutionEligible,
  );
  const admittedVenues = input.venues.filter(
    (venue) => venue.plannerAdmission !== "blocked",
  );

  return [
    {
      id: "routes",
      label: "Protocol coverage",
      value: `${input.snapshot.loadedRoutes}/${input.snapshot.totalRoutes}`,
      detail:
        input.snapshot.loadedRoutes === input.snapshot.totalRoutes
          ? "Every configured protocol has current availability data."
          : "Some protocols still need fresh availability data before live actions.",
      tone:
        input.snapshot.loadedRoutes === input.snapshot.totalRoutes
          ? "positive"
          : "warning",
    },
    {
      id: "auto",
      label: "AUTO venues",
      value: `${autoVenues.length}/${input.venues.length}`,
      detail: `${manualVenues.length} venues are available through manager-reviewed execution.`,
      tone: autoVenues.length > 0 ? "positive" : "warning",
    },
    {
      id: "sodax",
      label: "SODAX assets",
      value:
        input.snapshot.balancedIntentTokensLoaded > 0
          ? `${input.snapshot.balancedIntentTokensLoaded} tokens`
          : "Not loaded",
      detail: formatPublicIntegrationDetail(
        input.snapshot.balancedDriverSummary,
      ),
      tone:
        input.snapshot.balancedIntentTokensLoaded > 0 ? "positive" : "warning",
    },
    {
      id: "wallet",
      label: "Wallet",
      value: input.snapshot.canAct ? input.snapshot.walletLabel : "Connect wallet",
      detail: input.snapshot.canAct
        ? "Connected wallet can submit protocol actions."
        : "Connect an authorized wallet before signing protocol actions.",
      tone: input.snapshot.canAct ? "positive" : "warning",
    },
    {
      id: "balanced",
      label: "Balanced / SODAX",
      value: input.snapshot.balancedLaneReady ? "Ready" : "Review",
      detail: formatPublicIntegrationDetail(input.snapshot.balancedLaneDetail),
      tone: input.snapshot.balancedLaneReady ? "positive" : "warning",
    },
    {
      id: "mainnet",
      label: "Mainnet readiness",
      value: input.snapshot.mainnetGateReady ? "Ready" : "Review",
      detail: `${admittedVenues.length}/${input.venues.length} venues have execution posture; ${formatPublicIntegrationDetail(
        input.snapshot.mainnetGateDetail,
      )}`,
      tone: input.snapshot.mainnetGateReady ? "positive" : "warning",
    },
  ];
}

export function resolveIntegrationWorkspaceId(
  value: string | null | undefined,
  fallback: IntegrationWorkspaceId = "routing",
): IntegrationWorkspaceId {
  return TAB_MAP.has(value as IntegrationWorkspaceId)
    ? (value as IntegrationWorkspaceId)
    : fallback;
}

export function getIntegrationWorkspaceTab(
  id: IntegrationWorkspaceId,
): IntegrationWorkspaceTab {
  return TAB_MAP.get(id) ?? INTEGRATION_WORKSPACE_TABS[0];
}

function routeSignal(
  id: string,
  label: string,
  value: string,
  tone: StatusTone,
): IntegrationWorkspaceSignal {
  return {
    id,
    label,
    value: value === "Blocked" ? "Not ready" : value,
    detail:
      tone === "positive"
        ? "Observed router matches the configured protocol."
        : tone === "warning"
          ? "Router state needs review before live actions."
          : "Route is pending for the current environment.",
    tone,
  };
}

function buildRoutingSignals(
  snapshot: IntegrationWorkspaceSnapshot,
): IntegrationWorkspaceSignal[] {
  return [
    {
      id: "routes-loaded",
      label: "Protocol checks",
      value: `${snapshot.loadedRoutes}/${snapshot.totalRoutes}`,
      detail: "Supported protocol checks currently returned.",
      tone:
        snapshot.loadedRoutes === snapshot.totalRoutes ? "positive" : "warning",
    },
    routeSignal(
      "balanced",
      "Balanced",
      snapshot.balancedLabel,
      snapshot.balancedTone,
    ),
    routeSignal(
      "aquarius",
      "Aquarius",
      snapshot.aquariusLabel,
      snapshot.aquariusTone,
    ),
    routeSignal(
      "soroswap",
      "SoroSwap",
      snapshot.soroswapLabel,
      snapshot.soroswapTone,
    ),
    routeSignal(
      "sushi",
      "Sushi",
      snapshot.sushiLabel ?? "Permissions unavailable",
      snapshot.sushiTone ?? "warning",
    ),
    routeSignal("blend", "Blend", snapshot.blendLabel, snapshot.blendTone),
  ];
}

function buildSodaxSignals(
  snapshot: IntegrationWorkspaceSnapshot,
): IntegrationWorkspaceSignal[] {
  return [
    {
      id: "catalog",
      label: "SODAX assets",
      value:
        snapshot.balancedIntentTokensLoaded > 0
          ? `${snapshot.balancedIntentTokensLoaded} loaded`
          : "Not loaded",
      detail:
        snapshot.balancedIntentTokensLoaded > 0
          ? "SODAX assets are available for quote inputs."
          : "Load available SODAX assets before requesting a quote.",
      tone: snapshot.balancedIntentTokensLoaded > 0 ? "positive" : "warning",
    },
    {
      id: "quote",
      label: "Quote",
      value: snapshot.balancedQuoteReason,
      detail: snapshot.balancedDriverSummary,
      tone: snapshot.balancedQuoteReason.toLowerCase().includes("ready")
        ? "positive"
        : "warning",
    },
    {
      id: "status",
      label: "Status",
      value: snapshot.balancedStatusReason,
      detail: "Intent status lookup uses the public SODAX status endpoint.",
      tone: snapshot.balancedStatusReason.toLowerCase().includes("ready")
        ? "positive"
        : "warning",
    },
    {
      id: "confirmation",
      label: "Confirmation",
      value: snapshot.balancedConfirmationReason,
      detail:
        "Confirmation checks are derived from the intent transaction hash.",
      tone: snapshot.balancedConfirmationReason.toLowerCase().includes("ready")
        ? "positive"
        : "warning",
    },
  ];
}

function buildExecutionSignals(
  snapshot: IntegrationWorkspaceSnapshot,
): IntegrationWorkspaceSignal[] {
  return [
    {
      id: "wallet",
      label: "Wallet",
      value: snapshot.canAct ? snapshot.walletLabel : "Connect wallet",
      detail: snapshot.canAct
        ? "Connected signer is ready for protocol actions."
        : "Connect a wallet before broadcasting protocol actions.",
      tone: snapshot.canAct ? "positive" : "warning",
    },
    {
      id: "router-refresh",
      label: "Protocol checks",
      value: `${snapshot.loadedRoutes}/${snapshot.totalRoutes}`,
      detail: "Refresh protocol checks before a signed action.",
      tone:
        snapshot.loadedRoutes === snapshot.totalRoutes ? "positive" : "warning",
    },
    {
      id: "receipt",
      label: "Action receipt",
      value: snapshot.executionReceiptReady ? "Available" : "None",
      detail: snapshot.executionReceiptReady
        ? "Latest signed protocol action has a receipt."
        : "A receipt appears after a live protocol action succeeds.",
      tone: snapshot.executionReceiptReady ? "positive" : "neutral",
    },
  ];
}

function buildActionSignals(
  snapshot: IntegrationWorkspaceSnapshot,
): IntegrationWorkspaceSignal[] {
  return [
    {
      id: "balanced-lane",
      label: "Balanced / SODAX",
      value: snapshot.balancedLaneReady ? "Ready" : "Review",
      detail: formatPublicIntegrationDetail(snapshot.balancedLaneDetail),
      tone: snapshot.balancedLaneReady ? "positive" : "warning",
    },
    {
      id: "mainnet-gate",
      label: "Mainnet readiness",
      value: snapshot.mainnetGateReady ? "Ready" : "Review",
      detail: snapshot.mainnetGateDetail,
      tone: snapshot.mainnetGateReady ? "positive" : "warning",
    },
    {
      id: "blend-command",
      label: "Blend action",
      value: `${snapshot.blendAction} ${snapshot.blendAmount}`,
      detail: "Current credit action prepared for wallet signature.",
      tone: snapshot.canAct ? "positive" : "warning",
    },
  ];
}

export function buildIntegrationWorkspaceSignals(
  snapshot: IntegrationWorkspaceSnapshot,
  workspace: IntegrationWorkspaceId,
): IntegrationWorkspaceSignal[] {
  switch (workspace) {
    case "sodax":
      return buildSodaxSignals(snapshot);
    case "execution":
      return buildExecutionSignals(snapshot);
    case "actions":
      return buildActionSignals(snapshot);
    case "routing":
    default:
      return buildRoutingSignals(snapshot);
  }
}

export function buildIntegrationWorkspaceState(
  snapshot: IntegrationWorkspaceSnapshot,
  workspace: IntegrationWorkspaceId,
): IntegrationWorkspaceState {
  return {
    tab: getIntegrationWorkspaceTab(workspace),
    signals: buildIntegrationWorkspaceSignals(snapshot, workspace),
  };
}
