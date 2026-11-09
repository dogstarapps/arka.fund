import type {
  BalancedIntentPlannerAdmission,
  BalancedProtocolHealthPayload,
} from "@/lib/runtime/appHealth";
import {
  buildBalancedIntentSourceDescriptor,
  formatIntentVenueCapabilityStateLabel,
  type IntentVenueSourceDescriptor,
} from "@/lib/workflows/intentVenueSources";
import type { BalancedRouteLane } from "@/lib/workflows/rebalanceRouting";

export type IntentExecutionDriverId = "BALANCED_SODAX";
export type IntentExecutionDriverQuoteCapability =
  | "comparable_public_quote"
  | "manual_only"
  | "unavailable";
export type IntentExecutionDriverExecutionCapability =
  | "manual_adapter_execution"
  | "unavailable";
export type IntentExecutionDriverConfirmationCapability =
  | "transaction_hash_plus_refresh";

export interface IntentExecutionDriverDescriptor {
  id: IntentExecutionDriverId;
  title: string;
  source: IntentVenueSourceDescriptor;
  plannerAdmission: BalancedIntentPlannerAdmission;
  comparableQuote: boolean;
  manualExecutionEligible: boolean;
  quoteCapability: IntentExecutionDriverQuoteCapability;
  executionCapability: IntentExecutionDriverExecutionCapability;
  confirmationCapability: IntentExecutionDriverConfirmationCapability;
  quoteVisibleInOfficialApp: boolean;
  publicQuoteEndpoint: string | null;
  publicBuildEndpoint: string | null;
  publicRelayEndpoint: string | null;
  publicSubmitEndpoint: string | null;
  statusSurface: "recent_activity" | "unknown";
  publicStatusEndpoint: string | null;
  publicReceiptEndpoint: string | null;
  publicExpiryEndpoint: string | null;
  publicRefundEndpoint: string | null;
  cancellationWindowSeconds: number | null;
  adapterId: string;
  poolId: number;
  supportStatus: BalancedProtocolHealthPayload["supportStatus"];
  laneMode: string;
  validatedModulePresent: boolean;
  blockingReasons: string[];
  summary: string;
  plannerDetail: string;
  executionDetail: string;
}

export type BalancedIntentSurfaceActionState = {
  enabled: boolean;
  reason: string;
};

export type BalancedIntentSurfaceActionStates = {
  quote: BalancedIntentSurfaceActionState;
  build: BalancedIntentSurfaceActionState;
  relay: BalancedIntentSurfaceActionState;
  submit: BalancedIntentSurfaceActionState;
  status: BalancedIntentSurfaceActionState;
  receipt: BalancedIntentSurfaceActionState;
  expiry: BalancedIntentSurfaceActionState;
  refund: BalancedIntentSurfaceActionState;
  confirmation: BalancedIntentSurfaceActionState;
};

export function formatIntentExecutionDriverQuoteCapabilityLabel(
  capability: IntentExecutionDriverQuoteCapability,
): string {
  if (capability === "comparable_public_quote") return "Comparable quote";
  if (capability === "manual_only") return "Manual review";
  return "Unavailable";
}

export function formatIntentExecutionDriverExecutionCapabilityLabel(
  capability: IntentExecutionDriverExecutionCapability,
): string {
  if (capability === "manual_adapter_execution") {
    return "Manual execution";
  }
  return "Execution unavailable";
}

export function formatIntentExecutionDriverConfirmationCapabilityLabel(
  capability: IntentExecutionDriverConfirmationCapability,
): string {
  if (capability === "transaction_hash_plus_refresh") {
    return "Transaction hash + refreshed state";
  }
  return capability;
}

export function formatIntentExecutionSurfaceEndpoint(
  endpoint: string | null | undefined,
  surface:
    | "quote"
    | "build"
    | "relay"
    | "submit"
    | "status"
    | "receipt"
    | "expiry"
    | "refund"
    | "confirmation",
): string {
  const value = endpoint?.trim();
  if (value) return value;

  if (surface === "quote") {
    return "Quote source is not configured for this SODAX connection";
  }
  if (surface === "status") {
    return "Status tracking is not configured for this SODAX connection";
  }
  if (surface === "build") {
    return "Intent build is not configured for this SODAX connection";
  }
  if (surface === "relay") {
    return "Relay is not configured for this SODAX connection";
  }
  if (surface === "submit") {
    return "Post-execution action is not configured for this SODAX connection";
  }
  if (surface === "receipt") {
    return "Receipt lookup is not configured for this SODAX connection";
  }
  if (surface === "expiry") {
    return "Expiry lookup is not configured for this SODAX connection";
  }
  if (surface === "refund") {
    return "Refund is not configured for this SODAX connection";
  }
  return "Confirmation is not configured for this SODAX connection";
}

function isPositiveInteger(value: string): boolean {
  return /^\d+$/.test(value.trim()) && value.trim() !== "0";
}

export function deriveBalancedIntentSurfaceActionStates(input: {
  tokensLoaded: boolean;
  tokenIn: string;
  tokenOut: string;
  amountInBase: string;
  minOutputAmountBase?: string;
  sourceAccount?: string;
  sourceTxHash?: string;
  intentTxHash: string;
  intentBuilt?: boolean;
  busy: boolean;
}): BalancedIntentSurfaceActionStates {
  if (input.busy) {
    const busyState = {
      enabled: false,
      reason: "SODAX request in progress.",
    };
    return {
      quote: busyState,
      build: busyState,
      relay: busyState,
      submit: busyState,
      status: busyState,
      receipt: busyState,
      expiry: busyState,
      refund: busyState,
      confirmation: busyState,
    };
  }

  const normalizedTokenIn = input.tokenIn.trim();
  const normalizedTokenOut = input.tokenOut.trim();
  const normalizedHash = input.intentTxHash.trim();
  const normalizedSourceAccount = input.sourceAccount?.trim() ?? "";
  const normalizedSourceTxHash = input.sourceTxHash?.trim() ?? "";

  const quote =
    !input.tokensLoaded
      ? {
          enabled: false,
          reason: "Load the SODAX token catalog first.",
        }
      : !normalizedTokenIn || !normalizedTokenOut
        ? {
            enabled: false,
            reason: "Select token in and token out before requesting a quote.",
          }
        : normalizedTokenIn === normalizedTokenOut
          ? {
              enabled: false,
              reason: "Select two different SODAX tokens before requesting a quote.",
            }
          : !isPositiveInteger(input.amountInBase)
            ? {
                enabled: false,
                reason: "Selected token amount must convert to a positive integer amount.",
              }
            : {
                enabled: true,
                reason: "Ready to request the official SODAX quote.",
              };

  const hashState = normalizedHash
    ? {
        enabled: true,
        reason: "Ready to query the SODAX intent hash.",
      }
    : {
        enabled: false,
        reason: "Enter an intent transaction hash first.",
      };

  const build =
    !quote.enabled
      ? quote
      : !isPositiveInteger(input.minOutputAmountBase ?? "")
        ? {
            enabled: false,
            reason: "Minimum output must convert to a positive integer amount.",
          }
        : !/^G[A-Z2-7]{55}$/.test(normalizedSourceAccount)
          ? {
              enabled: false,
              reason: "Connect a Stellar wallet before building an unsigned SODAX intent.",
            }
          : {
              enabled: true,
              reason: "Ready to build the unsigned SODAX intent XDR.",
            };

  const relay =
    normalizedSourceTxHash
      ? {
          enabled: true,
          reason: "Ready to relay the wallet-submitted Stellar transaction hash.",
        }
      : {
          enabled: false,
          reason: "Submit the built intent with the wallet to obtain a source transaction hash.",
        };

  const refund =
    !/^G[A-Z2-7]{55}$/.test(normalizedSourceAccount)
      ? {
          enabled: false,
          reason: "Connect a Stellar wallet before building a refund transaction.",
        }
      : normalizedHash || input.intentBuilt
        ? {
            enabled: true,
            reason: "Ready to build an unsigned cancel/refund XDR.",
          }
        : {
            enabled: false,
            reason: "Build an intent or enter an intent hash before requesting a refund XDR.",
          };

  return {
    quote,
    build,
    relay,
    submit: hashState,
    status: hashState,
    receipt: hashState,
    expiry: hashState,
    refund,
    confirmation: hashState,
  };
}

export function buildBalancedIntentExecutionDriver(
  support: BalancedProtocolHealthPayload,
): IntentExecutionDriverDescriptor {
  const source = buildBalancedIntentSourceDescriptor(support);
  const quoteCapability: IntentExecutionDriverQuoteCapability =
    support.intentVenue.comparableQuote
      ? "comparable_public_quote"
      : support.officialSurface.intentAdapter.quoteVisibleInApp ||
          support.intentVenue.manualExecutionEligible ||
          source.sourceStatus === "verified"
        ? "manual_only"
        : "unavailable";
  const executionCapability: IntentExecutionDriverExecutionCapability =
    support.intentVenue.manualExecutionEligible
      ? "manual_adapter_execution"
      : "unavailable";

  return {
    id: "BALANCED_SODAX",
    title: "Balanced / SODAX",
    source,
    plannerAdmission: support.intentVenue.plannerAdmission,
    comparableQuote: support.intentVenue.comparableQuote,
    manualExecutionEligible: support.intentVenue.manualExecutionEligible,
    quoteCapability,
    executionCapability,
    confirmationCapability: "transaction_hash_plus_refresh",
    quoteVisibleInOfficialApp:
      support.officialSurface.intentAdapter.quoteVisibleInApp,
    publicQuoteEndpoint:
      support.officialSurface.intentAdapter.publicQuoteEndpoint,
    publicBuildEndpoint:
      support.officialSurface.intentAdapter.publicBuildEndpoint,
    publicRelayEndpoint:
      support.officialSurface.intentAdapter.publicRelayEndpoint,
    publicSubmitEndpoint:
      support.officialSurface.intentAdapter.publicSubmitEndpoint,
    statusSurface: support.officialSurface.intentAdapter.statusSurface,
    publicStatusEndpoint:
      support.officialSurface.intentAdapter.publicStatusEndpoint,
    publicReceiptEndpoint:
      support.officialSurface.intentAdapter.publicReceiptEndpoint,
    publicExpiryEndpoint:
      support.officialSurface.intentAdapter.publicExpiryEndpoint,
    publicRefundEndpoint:
      support.officialSurface.intentAdapter.publicRefundEndpoint,
    cancellationWindowSeconds:
      support.officialSurface.intentAdapter.cancellationWindowSeconds,
    adapterId: support.adapterBalanced,
    poolId: support.poolId,
    supportStatus: support.supportStatus,
    laneMode: support.laneMode,
    validatedModulePresent: support.validatedModule.present,
    blockingReasons: support.blockingReasons,
    summary:
      source.sourceStatus === "verified"
        ? "Balanced / SODAX is available for reviewed intent routing."
        : "Balanced / SODAX stays in review until its public route data is complete.",
    plannerDetail:
      support.intentVenue.plannerAdmission === "auto"
        ? "AUTO can use Balanced because quotes and execution status are comparable."
        : support.intentVenue.plannerAdmission === "manual_only"
          ? support.officialSurface.intentAdapter.publicQuoteEndpoint
            ? "Balanced remains manual until execution status matches the other AUTO routes."
            : support.officialSurface.intentAdapter.quoteVisibleInApp
              ? "Balanced remains manual because quotes are visible in the official app but not yet comparable inside Arka."
              : "Balanced remains manual until a comparable public quote is available."
          : support.intentVenue.notes[2] ??
            "Balanced is not available for execution in the current environment.",
    executionDetail:
      executionCapability === "manual_adapter_execution"
        ? `Execution currently uses Arka's governed Balanced route, with confirmation via ${formatIntentExecutionDriverConfirmationCapabilityLabel("transaction_hash_plus_refresh")}${support.officialSurface.intentAdapter.statusSurface === "recent_activity" ? " while the official app shows status and cancel actions in Recent Activity." : "."}`
        : "Execution is not admitted in the current environment.",
  };
}

export function deriveBalancedRouteLaneFromDriver(
  driver: IntentExecutionDriverDescriptor,
): BalancedRouteLane {
  return {
    adapterId: driver.adapterId,
    poolId: driver.poolId,
    ready: driver.manualExecutionEligible,
    supportStatus: driver.supportStatus,
    laneMode: driver.laneMode,
    validatedModulePresent: driver.validatedModulePresent,
    comparableQuote: driver.comparableQuote,
    manualExecutionEligible: driver.manualExecutionEligible,
    plannerAdmission: driver.plannerAdmission,
    capabilityNote: driver.plannerDetail,
    blockingReasons: driver.blockingReasons,
  };
}

export function buildBalancedIntentExecutionDriverSummary(
  driver: IntentExecutionDriverDescriptor,
): string {
  return [
    `Connection ${driver.source.sourceStatus}`,
    `Quote ${formatIntentExecutionDriverQuoteCapabilityLabel(driver.quoteCapability)}`,
    `Execution ${formatIntentExecutionDriverExecutionCapabilityLabel(driver.executionCapability)}`,
    `Confirm ${formatIntentExecutionDriverConfirmationCapabilityLabel(driver.confirmationCapability)}`,
    `Route ${formatIntentVenueCapabilityStateLabel(driver.source.discoveryState)}`,
    `Status ${driver.statusSurface === "recent_activity" ? "Recent Activity" : "unknown"}`,
  ].join(" · ");
}
