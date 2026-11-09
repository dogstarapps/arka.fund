import type { BalancedProtocolHealthPayload } from "@/lib/runtime/appHealth";

export const BALANCED_SODAX_QUOTE_ENDPOINT =
  "https://api.sodax.com/v1/swaps/quote";
export const BALANCED_SODAX_BUILD_ENDPOINT =
  "https://api.sodax.com/v1/swaps/intents";
export const BALANCED_SODAX_RELAY_ENDPOINT =
  "https://api.sodax.com/v1/swaps/intents/submit";
export const BALANCED_SODAX_SUBMIT_ENDPOINT =
  "https://api.sodax.com/v1/intent/execute";
export const BALANCED_SODAX_STATUS_ENDPOINT =
  "https://api.sodax.com/v1/swaps/intents/status";
export const BALANCED_SODAX_RECEIPT_ENDPOINT =
  "https://api.sodax.com/v1/swaps/intents/packet";
export const BALANCED_SODAX_EXPIRY_ENDPOINT =
  "https://api.sodax.com/v1/swaps/intents/:txHash";
export const BALANCED_SODAX_REFUND_ENDPOINT =
  "https://api.sodax.com/v1/swaps/intents/cancel";
export const BALANCED_SODAX_CONFIRM_ENDPOINT = BALANCED_SODAX_STATUS_ENDPOINT;

export type BalancedOfficialSurfaceEvidenceCode =
  | "verified_auto_ready"
  | "verified_manual_only"
  | "router_contract_declared"
  | "official_sources_incomplete"
  | "official_surface_unverified"
  | "quote_not_comparable_for_auto";

export interface BalancedOfficialSourceEvidenceLink {
  id: "app" | "stellar_page" | "swap_docs" | "sdk_package";
  label: string;
  href: string;
}

export interface BalancedOfficialMachineAction {
  action:
    | "quote"
    | "build"
    | "relay"
    | "submit"
    | "status"
    | "receipt"
    | "expiry"
    | "refund";
  provider: "sodax_sdk";
  sdkPackage: "@sodax/swaps-api";
  method:
    | "Sodax.swaps.getQuote"
    | "Sodax.swaps.createIntent"
    | "Sodax.swaps.submitIntent"
    | "Sodax.swaps.postExecution"
    | "Sodax.swaps.getStatus"
    | "Sodax.swaps.getSolvedIntentPacket"
    | "Sodax.swaps.getIntent"
    | "Sodax.swaps.cancelIntent";
  endpoint: string;
  purpose: string;
}

export interface BalancedOfficialSurfaceEvidence {
  provider: "sodax_sdk";
  architecture: "intent_interchain";
  surface: "quote_build_relay_submit_status_receipt_refund_expiry";
  verified: boolean;
  readyForAuto: boolean;
  code: BalancedOfficialSurfaceEvidenceCode;
  reason: string;
  endpoints: {
    quote: string | null;
    build: string | null;
    relay: string | null;
    submit: string | null;
    status: string | null;
    receipt: string | null;
    expiry: string | null;
    refund: string | null;
  };
  checks: {
    topologyIntentBased: boolean;
    swapModelSodaxIntents: boolean;
    quoteProviderSodax: boolean;
    quoteEndpointOfficial: boolean;
    buildEndpointOfficial: boolean;
    relayEndpointOfficial: boolean;
    submitEndpointOfficial: boolean;
    statusEndpointOfficial: boolean;
    receiptEndpointOfficial: boolean;
    expiryEndpointOfficial: boolean;
    refundEndpointOfficial: boolean;
    statusSurfaceRecentActivity: boolean;
    noPublicRouterContractId: boolean;
    publicRouterContractId: string | null;
    canonicalRouterCutoverPossible: boolean;
    quoteComparableForArka: boolean;
    hasOfficialDocs: boolean;
    hasOfficialAppSource: boolean;
    hasStellarSource: boolean;
  };
  machineConsumableActions: BalancedOfficialMachineAction[];
  sourceLinks: BalancedOfficialSourceEvidenceLink[];
  blockingReasons: string[];
}

function normalizeEndpoint(endpoint: string | null | undefined): string {
  return endpoint?.trim() ?? "";
}

// Historical manifests retain their original SDK operation descriptors. Accept
// only the exact equivalent alias; current machine actions advertise actual URLs.
function matchesOfficialEndpoint(endpoint: string | null | undefined, canonical: string, method: string): boolean {
  const value = normalizeEndpoint(endpoint);
  return value === canonical || value === `sdk:@sodax/sdk::swaps.${method}`;
}

export function isOfficialSodaxQuoteEndpoint(endpoint: string | null | undefined): boolean {
  return matchesOfficialEndpoint(endpoint, BALANCED_SODAX_QUOTE_ENDPOINT, "getQuote");
}

export function isOfficialSodaxBuildEndpoint(endpoint: string | null | undefined): boolean {
  return matchesOfficialEndpoint(endpoint, BALANCED_SODAX_BUILD_ENDPOINT, "createIntent");
}

export function isOfficialSodaxRelayEndpoint(endpoint: string | null | undefined): boolean {
  return matchesOfficialEndpoint(endpoint, BALANCED_SODAX_RELAY_ENDPOINT, "submitIntent");
}

export function isOfficialSodaxSubmitEndpoint(endpoint: string | null | undefined): boolean {
  return matchesOfficialEndpoint(endpoint, BALANCED_SODAX_SUBMIT_ENDPOINT, "postExecution");
}

export function isOfficialSodaxStatusEndpoint(endpoint: string | null | undefined): boolean {
  return matchesOfficialEndpoint(endpoint, BALANCED_SODAX_STATUS_ENDPOINT, "getStatus");
}

export function isOfficialSodaxReceiptEndpoint(endpoint: string | null | undefined): boolean {
  return matchesOfficialEndpoint(endpoint, BALANCED_SODAX_RECEIPT_ENDPOINT, "getSolvedIntentPacket");
}

export function isOfficialSodaxExpiryEndpoint(endpoint: string | null | undefined): boolean {
  return matchesOfficialEndpoint(endpoint, BALANCED_SODAX_EXPIRY_ENDPOINT, "getIntent");
}

export function isOfficialSodaxRefundEndpoint(endpoint: string | null | undefined): boolean {
  return matchesOfficialEndpoint(endpoint, BALANCED_SODAX_REFUND_ENDPOINT, "cancelIntent");
}

export function isOfficialSodaxConfirmEndpoint(endpoint: string | null | undefined): boolean {
  return matchesOfficialEndpoint(endpoint, BALANCED_SODAX_CONFIRM_ENDPOINT, "getStatus");
}

function isOfficialSodaxDocsUrl(url: string | null | undefined): boolean {
  try {
    const parsed = new URL(url ?? "");
    return parsed.hostname === "docs.sodax.com";
  } catch {
    return false;
  }
}

function isBalancedAppUrl(url: string | null | undefined): boolean {
  try {
    const parsed = new URL(url ?? "");
    return parsed.hostname === "app.balanced.network";
  } catch {
    return false;
  }
}

function isBalancedStellarUrl(url: string | null | undefined): boolean {
  try {
    const parsed = new URL(url ?? "");
    return parsed.hostname === "balanced.network" && parsed.pathname.includes("stellar");
  } catch {
    return false;
  }
}

function sourceLinks(
  support: BalancedProtocolHealthPayload,
): BalancedOfficialSourceEvidenceLink[] {
  const links: BalancedOfficialSourceEvidenceLink[] = [
    {
      id: "sdk_package",
      label: "@sodax/swaps-api package",
      href: "npm:@sodax/swaps-api",
    },
  ];

  if (support.officialSurface.officialSources.app) {
    links.push({
      id: "app",
      label: "Balanced official app",
      href: support.officialSurface.officialSources.app,
    });
  }
  if (support.officialSurface.officialSources.stellarPage) {
    links.push({
      id: "stellar_page",
      label: "Balanced Stellar page",
      href: support.officialSurface.officialSources.stellarPage,
    });
  }
  if (support.officialSurface.officialSources.swapDocs) {
    links.push({
      id: "swap_docs",
      label: "SODAX developer docs",
      href: support.officialSurface.officialSources.swapDocs,
    });
  }

  return links;
}

export function deriveBalancedOfficialSurfaceEvidence(
  support: BalancedProtocolHealthPayload,
): BalancedOfficialSurfaceEvidence {
  const quoteEndpoint = support.officialSurface.intentAdapter.publicQuoteEndpoint;
  const buildEndpoint = support.officialSurface.intentAdapter.publicBuildEndpoint;
  const relayEndpoint = support.officialSurface.intentAdapter.publicRelayEndpoint;
  const submitEndpoint = support.officialSurface.intentAdapter.publicSubmitEndpoint;
  const statusEndpoint = support.officialSurface.intentAdapter.publicStatusEndpoint;
  const receiptEndpoint =
    support.officialSurface.intentAdapter.publicReceiptEndpoint;
  const expiryEndpoint = support.officialSurface.intentAdapter.publicExpiryEndpoint;
  const refundEndpoint = support.officialSurface.intentAdapter.publicRefundEndpoint;
  const publicRouterContractId =
    normalizeEndpoint(support.officialSurface.publicRouterContractId) || null;

  const checks = {
    topologyIntentBased: support.officialSurface.topology === "intent_based",
    swapModelSodaxIntents: support.officialSurface.swapModel === "sodax_intents",
    quoteProviderSodax:
      support.officialSurface.intentAdapter.quoteProvider === "sodax",
    quoteEndpointOfficial: isOfficialSodaxQuoteEndpoint(quoteEndpoint),
    buildEndpointOfficial: isOfficialSodaxBuildEndpoint(buildEndpoint),
    relayEndpointOfficial: isOfficialSodaxRelayEndpoint(relayEndpoint),
    submitEndpointOfficial: isOfficialSodaxSubmitEndpoint(submitEndpoint),
    statusEndpointOfficial: isOfficialSodaxStatusEndpoint(statusEndpoint),
    receiptEndpointOfficial: isOfficialSodaxReceiptEndpoint(receiptEndpoint),
    expiryEndpointOfficial: isOfficialSodaxExpiryEndpoint(expiryEndpoint),
    refundEndpointOfficial: isOfficialSodaxRefundEndpoint(refundEndpoint),
    statusSurfaceRecentActivity:
      support.officialSurface.intentAdapter.statusSurface === "recent_activity",
    noPublicRouterContractId: !publicRouterContractId,
    publicRouterContractId,
    canonicalRouterCutoverPossible:
      support.officialSurface.canonicalRouterCutoverPossible,
    quoteComparableForArka:
      support.officialSurface.intentAdapter.quoteComparableForArka,
    hasOfficialDocs: isOfficialSodaxDocsUrl(
      support.officialSurface.officialSources.swapDocs,
    ),
    hasOfficialAppSource: isBalancedAppUrl(
      support.officialSurface.officialSources.app,
    ),
    hasStellarSource: isBalancedStellarUrl(
      support.officialSurface.officialSources.stellarPage,
    ),
  };

  const blockingReasons: string[] = [];
  if (!checks.noPublicRouterContractId) {
    blockingReasons.push(
      `Balanced/SODAX cannot declare a public router contract ID for AUTO: ${checks.publicRouterContractId}.`,
    );
  }
  if (checks.canonicalRouterCutoverPossible) {
    blockingReasons.push(
      "Balanced/SODAX is intent-based; canonical router cutover must remain false.",
    );
  }
  if (!checks.hasOfficialDocs) {
    blockingReasons.push(
      "Missing official SODAX developer docs source for the SDK intent lifecycle surface.",
    );
  }
  if (!checks.hasOfficialAppSource) {
    blockingReasons.push("Missing official Balanced app source.");
  }
  if (!checks.hasStellarSource) {
    blockingReasons.push("Missing official Balanced Stellar source.");
  }
  if (!checks.topologyIntentBased) {
    blockingReasons.push("Topology is not declared as intent_based.");
  }
  if (!checks.swapModelSodaxIntents) {
    blockingReasons.push("Swap model is not declared as sodax_intents.");
  }
  if (!checks.quoteProviderSodax) {
    blockingReasons.push("Quote provider is not declared as SODAX.");
  }
  if (!checks.quoteEndpointOfficial) {
    blockingReasons.push(
      `Quote endpoint must be ${BALANCED_SODAX_QUOTE_ENDPOINT}.`,
    );
  }
  if (!checks.buildEndpointOfficial) {
    blockingReasons.push(
      `Build endpoint must be ${BALANCED_SODAX_BUILD_ENDPOINT}.`,
    );
  }
  if (!checks.relayEndpointOfficial) {
    blockingReasons.push(
      `Relay endpoint must be ${BALANCED_SODAX_RELAY_ENDPOINT}.`,
    );
  }
  if (!checks.submitEndpointOfficial) {
    blockingReasons.push(
      `Submit endpoint must be ${BALANCED_SODAX_SUBMIT_ENDPOINT}.`,
    );
  }
  if (!checks.statusEndpointOfficial) {
    blockingReasons.push(
      `Status endpoint must be ${BALANCED_SODAX_STATUS_ENDPOINT}.`,
    );
  }
  if (!checks.receiptEndpointOfficial) {
    blockingReasons.push(
      `Receipt endpoint must be ${BALANCED_SODAX_RECEIPT_ENDPOINT}.`,
    );
  }
  if (!checks.expiryEndpointOfficial) {
    blockingReasons.push(
      `Expiry endpoint must be ${BALANCED_SODAX_EXPIRY_ENDPOINT}.`,
    );
  }
  if (!checks.refundEndpointOfficial) {
    blockingReasons.push(
      `Refund endpoint must be ${BALANCED_SODAX_REFUND_ENDPOINT}.`,
    );
  }
  if (!checks.statusSurfaceRecentActivity) {
    blockingReasons.push("Status surface must be recent_activity.");
  }

  const verified =
    checks.topologyIntentBased &&
    checks.swapModelSodaxIntents &&
    checks.quoteProviderSodax &&
    checks.quoteEndpointOfficial &&
    checks.buildEndpointOfficial &&
    checks.relayEndpointOfficial &&
    checks.submitEndpointOfficial &&
    checks.statusEndpointOfficial &&
    checks.receiptEndpointOfficial &&
    checks.expiryEndpointOfficial &&
    checks.refundEndpointOfficial &&
    checks.statusSurfaceRecentActivity &&
    checks.noPublicRouterContractId &&
    !checks.canonicalRouterCutoverPossible &&
    checks.hasOfficialDocs &&
    checks.hasOfficialAppSource &&
    checks.hasStellarSource;

  if (verified && !checks.quoteComparableForArka) {
    blockingReasons.push(
      "Official SODAX quote/build/relay/status/receipt/refund/expiry are verified, but quoteComparableForArka is false so AUTO admission remains blocked.",
    );
  }

  const readyForAuto = verified && checks.quoteComparableForArka;
  const code: BalancedOfficialSurfaceEvidenceCode =
    readyForAuto
      ? "verified_auto_ready"
      : !checks.noPublicRouterContractId || checks.canonicalRouterCutoverPossible
        ? "router_contract_declared"
        : !checks.hasOfficialDocs ||
            !checks.hasOfficialAppSource ||
            !checks.hasStellarSource
          ? "official_sources_incomplete"
          : !verified
            ? "official_surface_unverified"
            : "quote_not_comparable_for_auto";

  return {
    provider: "sodax_sdk",
    architecture: "intent_interchain",
    surface: "quote_build_relay_submit_status_receipt_refund_expiry",
    verified,
    readyForAuto,
    code: verified && !readyForAuto ? "verified_manual_only" : code,
    reason: readyForAuto
      ? "Balanced/SODAX official SDK quote/build/relay/status/receipt/refund/expiry surface is verified and comparable for AUTO routing."
      : blockingReasons[0] ??
        "Balanced/SODAX official SDK surface is not ready for AUTO routing.",
    endpoints: {
      quote: quoteEndpoint,
      build: buildEndpoint,
      relay: relayEndpoint,
      submit: submitEndpoint,
      status: statusEndpoint,
      receipt: receiptEndpoint,
      expiry: expiryEndpoint,
      refund: refundEndpoint,
    },
    checks,
    machineConsumableActions: [
      {
        action: "quote",
        provider: "sodax_sdk",
        sdkPackage: "@sodax/swaps-api",
        method: "Sodax.swaps.getQuote",
        endpoint: BALANCED_SODAX_QUOTE_ENDPOINT,
        purpose: "Comparable exact-input quote capture for planner scoring.",
      },
      {
        action: "build",
        provider: "sodax_sdk",
        sdkPackage: "@sodax/swaps-api",
        method: "Sodax.swaps.createIntent",
        endpoint: BALANCED_SODAX_BUILD_ENDPOINT,
        purpose: "Build unsigned Stellar source-chain intent transactions for wallet execution.",
      },
      {
        action: "relay",
        provider: "sodax_sdk",
        sdkPackage: "@sodax/swaps-api",
        method: "Sodax.swaps.submitIntent",
        endpoint: BALANCED_SODAX_RELAY_ENDPOINT,
        purpose: "Relay wallet-submitted source-chain transaction hashes to SODAX.",
      },
      {
        action: "submit",
        provider: "sodax_sdk",
        sdkPackage: "@sodax/swaps-api",
        method: "Sodax.swaps.postExecution",
        endpoint: BALANCED_SODAX_SUBMIT_ENDPOINT,
        purpose: "Notify the solver surface once the delivered intent transaction is available.",
      },
      {
        action: "status",
        provider: "sodax_sdk",
        sdkPackage: "@sodax/swaps-api",
        method: "Sodax.swaps.getStatus",
        endpoint: BALANCED_SODAX_STATUS_ENDPOINT,
        purpose: "Intent lifecycle status lookup by intent transaction hash.",
      },
      {
        action: "receipt",
        provider: "sodax_sdk",
        sdkPackage: "@sodax/swaps-api",
        method: "Sodax.swaps.getSolvedIntentPacket",
        endpoint: BALANCED_SODAX_RECEIPT_ENDPOINT,
        purpose:
          "Recover relay packet and settlement receipt information for executed intents.",
      },
      {
        action: "expiry",
        provider: "sodax_sdk",
        sdkPackage: "@sodax/swaps-api",
        method: "Sodax.swaps.getIntent",
        endpoint: BALANCED_SODAX_EXPIRY_ENDPOINT,
        purpose: "Read canonical intent deadlines to decide expiry and cancel eligibility.",
      },
      {
        action: "refund",
        provider: "sodax_sdk",
        sdkPackage: "@sodax/swaps-api",
        method: "Sodax.swaps.cancelIntent",
        endpoint: BALANCED_SODAX_REFUND_ENDPOINT,
        purpose: "Build unsigned cancel/refund transactions for expired or failed intents.",
      },
    ],
    sourceLinks: sourceLinks(support),
    blockingReasons,
  };
}
