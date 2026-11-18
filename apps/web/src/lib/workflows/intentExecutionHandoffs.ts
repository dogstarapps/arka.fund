import type {
  IntentExecutionDriverDescriptor,
} from "@/lib/workflows/intentExecutionDrivers";

export type IntentExecutionHandoffPosture =
  | "manual_intent_handoff"
  | "discovery_only"
  | "blocked";

export type IntentExecutionHandoffStepState =
  | "ready"
  | "manual_only"
  | "blocked";

export interface IntentExecutionHandoffLink {
  id: string;
  label: string;
  href: string;
}

export interface IntentExecutionHandoffStep {
  id: "discover" | "quote" | "execute" | "confirm";
  label: string;
  state: IntentExecutionHandoffStepState;
  detail: string;
}

export interface IntentExecutionHandoffDescriptor {
  id: "BALANCED_SODAX";
  title: string;
  posture: IntentExecutionHandoffPosture;
  summary: string;
  operatorRoute: string;
  routeContext: string;
  primaryAction: IntentExecutionHandoffLink | null;
  statusAction: IntentExecutionHandoffLink | null;
  supportingLinks: IntentExecutionHandoffLink[];
  steps: IntentExecutionHandoffStep[];
}

export interface IntentExecutionHandoffContext {
  assetIn?: string;
  assetOut?: string;
  amountLabel?: string;
  minOutLabel?: string;
}

export function formatIntentExecutionHandoffPostureLabel(
  posture: IntentExecutionHandoffPosture,
): string {
  if (posture === "manual_intent_handoff") return "Manual intent flow";
  if (posture === "discovery_only") return "Discovery only";
  return "Blocked";
}

export function formatIntentExecutionHandoffStepStateLabel(
  state: IntentExecutionHandoffStepState,
): string {
  if (state === "ready") return "Ready";
  if (state === "manual_only") return "Manual only";
  return "Blocked";
}

function formatRouteContext(context?: IntentExecutionHandoffContext): string {
  if (!context) return "Use the official Balanced app for price discovery before routing execution.";
  const bits: string[] = [];
  if (context.assetIn && context.assetOut) {
    bits.push(`${context.assetIn} -> ${context.assetOut}`);
  }
  if (context.amountLabel) bits.push(`amount ${context.amountLabel}`);
  if (context.minOutLabel) bits.push(`min out ${context.minOutLabel}`);
  return bits.length > 0
    ? `Intent route context: ${bits.join(" · ")}`
    : "Use the official Balanced app for price discovery before routing execution.";
}

export function buildBalancedIntentExecutionHandoff(
  driver: IntentExecutionDriverDescriptor,
  context?: IntentExecutionHandoffContext,
): IntentExecutionHandoffDescriptor {
  const primaryAction =
    driver.source.links.find((link) => link.id === "app") ?? null;
  const statusAction =
    driver.statusSurface === "recent_activity" && primaryAction
      ? {
          id: "recent-activity",
          label: "Open Balanced app and inspect Recent Activity",
          href: primaryAction.href,
        }
      : null;
  const supportingLinks = [
    ...driver.source.links.filter((link) => link.id !== "app"),
    ...(statusAction ? [statusAction] : []),
  ];

  const posture: IntentExecutionHandoffPosture = driver.manualExecutionEligible
    ? "manual_intent_handoff"
    : driver.quoteVisibleInOfficialApp || driver.source.sourceStatus !== "unverified"
      ? "discovery_only"
      : "blocked";

  const steps: IntentExecutionHandoffStep[] = [
    {
      id: "discover",
      label: "Official discovery",
      state: primaryAction ? "ready" : "blocked",
      detail: primaryAction
        ? "Open the official Balanced surface and verify the Stellar intent venue before proceeding."
        : "No official Balanced app link is available in the current runtime snapshot.",
    },
    {
      id: "quote",
      label: "Quote capture",
      state: driver.comparableQuote
        ? "ready"
        : driver.publicQuoteEndpoint || driver.quoteVisibleInOfficialApp
          ? "manual_only"
          : "blocked",
      detail: driver.comparableQuote
        ? "A comparable public quote is available for AUTO."
        : driver.publicQuoteEndpoint
          ? "Request the SODAX quote, then review the trade manually before execution."
        : driver.quoteVisibleInOfficialApp
          ? "Quotes are visible in the official app, but Arka cannot compare them automatically yet."
          : "No comparable quote is available yet.",
    },
    {
      id: "execute",
      label: "Execution",
      state: driver.manualExecutionEligible ? "ready" : "blocked",
      detail: driver.manualExecutionEligible
        ? "Execute through Arka's governed Balanced route once the quote has been reviewed."
        : driver.plannerDetail,
    },
    {
      id: "confirm",
      label: "Confirmation",
      state:
        driver.confirmationCapability === "transaction_hash_plus_refresh"
          ? "ready"
          : "blocked",
      detail:
        driver.statusSurface === "recent_activity"
          ? `Confirm with the submitted transaction hash and then cross-check Recent Activity${driver.cancellationWindowSeconds ? ` within ${driver.cancellationWindowSeconds}s if cancellation is needed` : ""}.`
          : "Confirm with the submitted transaction hash and refreshed Arka state.",
    },
  ];

  const summary =
    posture === "manual_intent_handoff"
      ? "Balanced / SODAX now follows a manual intent flow: review the quote in the official app, execute through Arka, then confirm with the transaction hash and refreshed state."
      : posture === "discovery_only"
        ? "Balanced / SODAX can be used for official discovery only right now; Arka keeps execution blocked until the adapter is ready."
        : "Balanced / SODAX is blocked in the current environment because neither discovery nor execution are admitted safely.";

  const operatorRoute = [
    primaryAction ? "Official app discovery" : "No official discovery link",
    driver.manualExecutionEligible
      ? "Arka adapter execution"
      : "Execution blocked",
    driver.statusSurface === "recent_activity"
      ? "Recent Activity confirmation"
      : "Transaction-hash confirmation",
  ].join(" · ");

  return {
    id: "BALANCED_SODAX",
    title: "Balanced / SODAX intent flow",
    posture,
    summary,
    operatorRoute,
    routeContext: formatRouteContext(context),
    primaryAction,
    statusAction,
    supportingLinks,
    steps,
  };
}
