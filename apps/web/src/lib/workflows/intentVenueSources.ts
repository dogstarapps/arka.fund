import type { BalancedProtocolHealthPayload } from "@/lib/runtime/appHealth";

export type IntentVenueSourceStatus = "verified" | "partial" | "unverified";
export type IntentVenueCapabilityState = "available" | "manual_only" | "blocked";

export interface IntentVenueSourceLink {
  id: "app" | "bundle" | "stellarPage" | "swapDocs" | "tradeBlog" | "q3Blog";
  label: string;
  href: string;
}

export interface IntentVenueSourceDescriptor {
  id: "BALANCED_SODAX";
  title: string;
  sourceStatus: IntentVenueSourceStatus;
  discoveryState: IntentVenueCapabilityState;
  quoteState: IntentVenueCapabilityState;
  executionState: IntentVenueCapabilityState;
  confirmationState: IntentVenueCapabilityState;
  summary: string;
  detail: string;
  plannerDetail: string;
  links: IntentVenueSourceLink[];
}

export function formatIntentVenueSourceStatusLabel(
  status: IntentVenueSourceStatus,
): string {
  if (status === "verified") return "Verified";
  if (status === "partial") return "Partial";
  return "Unverified";
}

export function formatIntentVenueCapabilityStateLabel(
  state: IntentVenueCapabilityState,
): string {
  if (state === "available") return "Available";
  if (state === "manual_only") return "Manual only";
  return "Not ready";
}

export function buildBalancedIntentSourceDescriptor(
  support: BalancedProtocolHealthPayload,
): IntentVenueSourceDescriptor {
  const links: IntentVenueSourceLink[] = [
    ["app", "Official app"],
    ["bundle", "App bundle"],
    ["stellarPage", "Stellar page"],
    ["swapDocs", "SODAX developer docs"],
    ["tradeBlog", "Trade blog"],
    ["q3Blog", "Q3 blog"],
  ]
    .map(([id, label]) => {
      const href = support.officialSurface.officialSources[
        id as keyof typeof support.officialSurface.officialSources
      ];
      if (!href) return null;
      return {
        id: id as IntentVenueSourceLink["id"],
        label,
        href,
      };
    })
    .filter((link): link is IntentVenueSourceLink => Boolean(link));

  const sourceStatus: IntentVenueSourceStatus =
    support.officialSurface.topology === "intent_based" &&
    support.officialSurface.swapModel === "sodax_intents" &&
    links.length >= 3
      ? "verified"
      : links.length > 0
        ? "partial"
        : "unverified";

  const quoteState: IntentVenueCapabilityState = support.intentVenue.comparableQuote
    ? "available"
    : support.officialSurface.intentAdapter.publicQuoteEndpoint ||
        support.officialSurface.intentAdapter.quoteVisibleInApp ||
        support.intentVenue.manualExecutionEligible
      ? "manual_only"
      : "blocked";
  const executionState: IntentVenueCapabilityState =
    support.intentVenue.manualExecutionEligible ? "manual_only" : "blocked";

  return {
    id: "BALANCED_SODAX",
    title: "Balanced / SODAX",
    sourceStatus,
    discoveryState:
      support.intentVenue.discoveryState === "available" ? "available" : "blocked",
    quoteState,
    executionState,
    confirmationState:
      support.intentVenue.confirmModel === "transaction_hash_plus_refresh"
        ? "available"
        : "blocked",
    summary:
      sourceStatus === "verified"
        ? "Balanced route verified from public sources."
        : "Balanced route needs a verified public connection before AUTO can use it.",
    detail:
      support.officialSurface.swapModel === "sodax_intents"
        ? support.officialSurface.intentAdapter.publicQuoteEndpoint
          ? "Balanced uses SODAX Intents for Stellar swaps. Arka can read quotes and status when the public connection is configured."
          : support.officialSurface.intentAdapter.quoteVisibleInApp
            ? "Balanced uses SODAX Intents for Stellar swaps. Quotes are visible in the official app, so AUTO waits for a comparable public connection."
            : "Balanced uses SODAX Intents for Stellar swaps. AUTO waits until quotes and status can be read reliably."
        : "Balanced is not ready for AUTO until a comparable quote and status connection is available.",
    plannerDetail: support.intentVenue.comparableQuote
      ? "AUTO can compare this route because a live public quote is available."
      : support.officialSurface.intentAdapter.publicQuoteEndpoint
        ? "Balanced can be reviewed manually while execution status is verified against other routes."
        : "Balanced can be reviewed manually once a comparable quote is available.",
    links,
  };
}
