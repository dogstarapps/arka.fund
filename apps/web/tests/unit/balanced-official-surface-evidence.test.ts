import { describe, expect, it } from "vitest";
import { buildBalancedFallbackPayload } from "@/lib/runtime/appHealth";
import {
  BALANCED_SODAX_BUILD_ENDPOINT,
  BALANCED_SODAX_CONFIRM_ENDPOINT,
  BALANCED_SODAX_EXPIRY_ENDPOINT,
  BALANCED_SODAX_QUOTE_ENDPOINT,
  BALANCED_SODAX_RECEIPT_ENDPOINT,
  BALANCED_SODAX_REFUND_ENDPOINT,
  BALANCED_SODAX_RELAY_ENDPOINT,
  BALANCED_SODAX_STATUS_ENDPOINT,
  BALANCED_SODAX_SUBMIT_ENDPOINT,
  deriveBalancedOfficialSurfaceEvidence,
  isOfficialSodaxBuildEndpoint,
  isOfficialSodaxConfirmEndpoint,
  isOfficialSodaxExpiryEndpoint,
  isOfficialSodaxQuoteEndpoint,
  isOfficialSodaxReceiptEndpoint,
  isOfficialSodaxRefundEndpoint,
  isOfficialSodaxRelayEndpoint,
  isOfficialSodaxStatusEndpoint,
  isOfficialSodaxSubmitEndpoint,
} from "@/lib/workflows/balancedOfficialSurfaceEvidence";

const officialSources = {
  app: "https://app.balanced.network",
  bundle: "https://app.balanced.network/assets/index.js",
  stellarPage: "https://balanced.network/stellar/",
  swapDocs: "https://docs.sodax.com/developers/packages",
  tradeBlog: "https://blog.balanced.network/trade-cross-chain/",
  q3Blog: "https://blog.balanced.network/q3-2025/",
};

describe("Balanced/SODAX official surface evidence", () => {
  it("verifies the SDK intent lifecycle surface without declaring a router", () => {
    const evidence = deriveBalancedOfficialSurfaceEvidence(
      buildBalancedFallbackPayload({
        officialSurface: {
          officialSources,
          topology: "intent_based",
          swapModel: "sodax_intents",
          publicRouterContractId: null,
          canonicalRouterCutoverPossible: false,
          intentAdapter: {
            quoteProvider: "sodax",
            quoteVisibleInApp: true,
            quoteComparableForArka: true,
            publicQuoteEndpoint: BALANCED_SODAX_QUOTE_ENDPOINT,
            publicBuildEndpoint: BALANCED_SODAX_BUILD_ENDPOINT,
            publicRelayEndpoint: BALANCED_SODAX_RELAY_ENDPOINT,
            publicSubmitEndpoint: BALANCED_SODAX_SUBMIT_ENDPOINT,
            statusSurface: "recent_activity",
            publicStatusEndpoint: BALANCED_SODAX_STATUS_ENDPOINT,
            publicReceiptEndpoint: BALANCED_SODAX_RECEIPT_ENDPOINT,
            publicExpiryEndpoint: BALANCED_SODAX_EXPIRY_ENDPOINT,
            publicRefundEndpoint: BALANCED_SODAX_REFUND_ENDPOINT,
            cancellationWindowSeconds: 300,
          },
        },
      }),
    );

    expect(evidence.verified).toBe(true);
    expect(evidence.readyForAuto).toBe(true);
    expect(evidence.code).toBe("verified_auto_ready");
    expect(evidence.checks.noPublicRouterContractId).toBe(true);
    expect(evidence.machineConsumableActions.map((action) => action.method)).toEqual([
      "Sodax.swaps.getQuote",
      "Sodax.swaps.createIntent",
      "Sodax.swaps.submitIntent",
      "Sodax.swaps.postExecution",
      "Sodax.swaps.getStatus",
      "Sodax.swaps.getSolvedIntentPacket",
      "Sodax.swaps.getIntent",
      "Sodax.swaps.cancelIntent",
    ]);
    expect(evidence.sourceLinks.map((link) => link.id)).toEqual([
      "sdk_package",
      "app",
      "stellar_page",
      "swap_docs",
    ]);
  });

  it("keeps official evidence verified but manual-only when comparable AUTO quote is disabled", () => {
    const evidence = deriveBalancedOfficialSurfaceEvidence(
      buildBalancedFallbackPayload({
        officialSurface: {
          officialSources,
          topology: "intent_based",
          swapModel: "sodax_intents",
          intentAdapter: {
            quoteProvider: "sodax",
            quoteVisibleInApp: true,
            quoteComparableForArka: false,
            publicQuoteEndpoint: BALANCED_SODAX_QUOTE_ENDPOINT,
            publicBuildEndpoint: BALANCED_SODAX_BUILD_ENDPOINT,
            publicRelayEndpoint: BALANCED_SODAX_RELAY_ENDPOINT,
            publicSubmitEndpoint: BALANCED_SODAX_SUBMIT_ENDPOINT,
            statusSurface: "recent_activity",
            publicStatusEndpoint: BALANCED_SODAX_STATUS_ENDPOINT,
            publicReceiptEndpoint: BALANCED_SODAX_RECEIPT_ENDPOINT,
            publicExpiryEndpoint: BALANCED_SODAX_EXPIRY_ENDPOINT,
            publicRefundEndpoint: BALANCED_SODAX_REFUND_ENDPOINT,
            cancellationWindowSeconds: 300,
          },
        },
      }),
    );

    expect(evidence.verified).toBe(true);
    expect(evidence.readyForAuto).toBe(false);
    expect(evidence.code).toBe("verified_manual_only");
    expect(evidence.reason).toMatch(/quoteComparableForArka is false/i);
  });

  it("rejects invented endpoints and public router IDs", () => {
    const evidence = deriveBalancedOfficialSurfaceEvidence(
      buildBalancedFallbackPayload({
        officialSurface: {
          officialSources,
          topology: "intent_based",
          swapModel: "sodax_intents",
          publicRouterContractId: "CFAKEROUTER",
          intentAdapter: {
            quoteProvider: "sodax",
            quoteVisibleInApp: true,
            quoteComparableForArka: true,
            publicQuoteEndpoint: "https://example.invalid/quote",
            publicBuildEndpoint: "https://example.invalid/build",
            publicRelayEndpoint: "https://example.invalid/relay",
            publicSubmitEndpoint: "https://example.invalid/submit",
            statusSurface: "recent_activity",
            publicStatusEndpoint: "https://example.invalid/status",
            publicReceiptEndpoint: "https://example.invalid/receipt",
            publicExpiryEndpoint: "https://example.invalid/expiry",
            publicRefundEndpoint: "https://example.invalid/refund",
            cancellationWindowSeconds: 300,
          },
        },
      }),
    );

    expect(evidence.verified).toBe(false);
    expect(evidence.readyForAuto).toBe(false);
    expect(evidence.code).toBe("router_contract_declared");
    expect(evidence.checks.quoteEndpointOfficial).toBe(false);
    expect(evidence.blockingReasons.join(" ")).toMatch(/public router contract ID/i);
  });

  it("matches only canonical SODAX SDK operation labels", () => {
    expect(isOfficialSodaxQuoteEndpoint(BALANCED_SODAX_QUOTE_ENDPOINT)).toBe(true);
    expect(isOfficialSodaxBuildEndpoint(BALANCED_SODAX_BUILD_ENDPOINT)).toBe(true);
    expect(isOfficialSodaxRelayEndpoint(BALANCED_SODAX_RELAY_ENDPOINT)).toBe(true);
    expect(isOfficialSodaxSubmitEndpoint(BALANCED_SODAX_SUBMIT_ENDPOINT)).toBe(true);
    expect(isOfficialSodaxStatusEndpoint(BALANCED_SODAX_STATUS_ENDPOINT)).toBe(true);
    expect(isOfficialSodaxReceiptEndpoint(BALANCED_SODAX_RECEIPT_ENDPOINT)).toBe(true);
    expect(isOfficialSodaxExpiryEndpoint(BALANCED_SODAX_EXPIRY_ENDPOINT)).toBe(true);
    expect(isOfficialSodaxRefundEndpoint(BALANCED_SODAX_REFUND_ENDPOINT)).toBe(true);
    expect(isOfficialSodaxConfirmEndpoint(BALANCED_SODAX_CONFIRM_ENDPOINT)).toBe(true);
    expect(isOfficialSodaxQuoteEndpoint("sdk:@sodax/sdk::swaps.swap")).toBe(false);
    expect(isOfficialSodaxStatusEndpoint("sdk:@sodax/sdk::swaps.getQuote")).toBe(false);
    expect(isOfficialSodaxRefundEndpoint("sdk:@sodax/sdk::swaps.getStatus")).toBe(false);
  });
});
