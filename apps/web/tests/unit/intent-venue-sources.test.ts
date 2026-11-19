import { describe, expect, it } from "vitest";
import { buildBalancedFallbackPayload } from "@/lib/runtime/appHealth";
import {
  buildBalancedIntentSourceDescriptor,
  formatIntentVenueCapabilityStateLabel,
  formatIntentVenueSourceStatusLabel,
} from "@/lib/workflows/intentVenueSources";

describe("intent venue source adapters", () => {
  it("builds a verified Balanced/SODAX source adapter when official sources are present", () => {
    const descriptor = buildBalancedIntentSourceDescriptor(
      buildBalancedFallbackPayload({
        supportStatus: "ready",
        readyForDappExecution: true,
        laneMode: "expected_router",
        officialSurface: {
          officialSources: {
            app: "https://app.balanced.network",
            bundle: "https://app.balanced.network/assets/index.js",
            stellarPage: "https://balanced.network/stellar/",
            swapDocs: "https://docs.sodax.com/developers/packages",
            tradeBlog: "https://blog.balanced.network/trade-cross-chain/",
            q3Blog: "https://blog.balanced.network/q3-2025/",
          },
          topology: "intent_based",
          swapModel: "sodax_intents",
          intentAdapter: {
            quoteProvider: "sodax",
            quoteVisibleInApp: true,
            quoteComparableForArka: false,
            publicQuoteEndpoint: "sdk:@sodax/sdk::swaps.getQuote",
            publicBuildEndpoint: "sdk:@sodax/sdk::swaps.createIntent",
            publicRelayEndpoint: "sdk:@sodax/sdk::swaps.submitIntent",
            publicSubmitEndpoint: "sdk:@sodax/sdk::swaps.postExecution",
            statusSurface: "recent_activity",
            publicStatusEndpoint: "sdk:@sodax/sdk::swaps.getStatus",
            publicReceiptEndpoint: "sdk:@sodax/sdk::swaps.getSolvedIntentPacket",
            publicExpiryEndpoint: "sdk:@sodax/sdk::swaps.getIntent",
            publicRefundEndpoint: "sdk:@sodax/sdk::swaps.cancelIntent",
            cancellationWindowSeconds: 300,
          },
        },
      }),
    );

    expect(descriptor.sourceStatus).toBe("verified");
    expect(descriptor.discoveryState).toBe("available");
    expect(descriptor.quoteState).toBe("manual_only");
    expect(descriptor.executionState).toBe("manual_only");
    expect(descriptor.links).toHaveLength(6);
    expect(descriptor.detail).toMatch(/SODAX Intents/i);
    expect(descriptor.plannerDetail).toMatch(/reviewed manually/i);
    expect(formatIntentVenueSourceStatusLabel(descriptor.sourceStatus)).toBe(
      "Verified",
    );
    expect(formatIntentVenueCapabilityStateLabel(descriptor.quoteState)).toBe(
      "Manual only",
    );
  });

  it("keeps the source adapter partial when public evidence is incomplete", () => {
    const descriptor = buildBalancedIntentSourceDescriptor(
      buildBalancedFallbackPayload({
        officialSurface: {
          officialSources: {
            app: "https://app.balanced.network",
            bundle: null,
            stellarPage: null,
            tradeBlog: null,
            q3Blog: null,
          },
          topology: "unknown",
          swapModel: "unknown",
        },
      }),
    );

    expect(descriptor.sourceStatus).toBe("partial");
    expect(descriptor.discoveryState).toBe("blocked");
    expect(descriptor.quoteState).toBe("blocked");
    expect(descriptor.executionState).toBe("blocked");
  });
});
