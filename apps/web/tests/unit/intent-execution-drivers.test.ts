import { describe, expect, it } from "vitest";
import { buildBalancedFallbackPayload } from "@/lib/runtime/appHealth";
import {
  buildBalancedIntentExecutionDriver,
  buildBalancedIntentExecutionDriverSummary,
  deriveBalancedIntentSurfaceActionStates,
  deriveBalancedRouteLaneFromDriver,
  formatIntentExecutionDriverExecutionCapabilityLabel,
  formatIntentExecutionDriverQuoteCapabilityLabel,
  formatIntentExecutionSurfaceEndpoint,
} from "@/lib/workflows/intentExecutionDrivers";

describe("intent execution drivers", () => {
  it("builds a manual-only Balanced driver from verified SODAX intent evidence", () => {
    const driver = buildBalancedIntentExecutionDriver(
      buildBalancedFallbackPayload({
        supportStatus: "ready",
        readyForDappExecution: true,
        laneMode: "expected_router",
        adapterBalanced: "CBALANCED",
        poolId: 11,
        validatedModule: {
          present: true,
          validatedAt: "2026-04-07",
          router: "CROUTER",
          poolId: 11,
          sourceValidations: ["balancedReadiness"],
          source: "deployments",
        },
        officialSurface: {
          officialSources: {
            app: "https://app.balanced.network",
            bundle: "https://app.balanced.network/assets/index.js",
            stellarPage: "https://balanced.network/stellar/",
            swapDocs: "https://docs.balanced.network/swap-assets",
            tradeBlog: "https://blog.balanced.network/trade-cross-chain/",
            q3Blog: "https://blog.balanced.network/q3-2025/",
          },
          topology: "intent_based",
          swapModel: "sodax_intents",
          liquidityModel: "legacy_exchange_only",
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

    expect(driver.plannerAdmission).toBe("manual_only");
    expect(driver.quoteCapability).toBe("manual_only");
    expect(driver.executionCapability).toBe("manual_adapter_execution");
    expect(driver.quoteVisibleInOfficialApp).toBe(true);
    expect(driver.publicQuoteEndpoint).toBe("sdk:@sodax/sdk::swaps.getQuote");
    expect(driver.statusSurface).toBe("recent_activity");
    expect(driver.cancellationWindowSeconds).toBe(300);
    expect(driver.source.sourceStatus).toBe("verified");
    expect(formatIntentExecutionDriverQuoteCapabilityLabel(driver.quoteCapability)).toBe(
      "Manual review",
    );
    expect(
      formatIntentExecutionDriverExecutionCapabilityLabel(driver.executionCapability),
    ).toBe("Manual execution");
    expect(buildBalancedIntentExecutionDriverSummary(driver)).toMatch(
      /Connection verified/i,
    );
    expect(buildBalancedIntentExecutionDriverSummary(driver)).toMatch(
      /Recent Activity/i,
    );
  });

  it("derives the planner lane contract from the driver", () => {
    const driver = buildBalancedIntentExecutionDriver(
      buildBalancedFallbackPayload({
        supportStatus: "blocked",
        readyForDappExecution: false,
        laneMode: "legacy_comet",
        blockingReasons: ["Balanced still points to the retired Comet lane."],
      }),
    );
    const lane = deriveBalancedRouteLaneFromDriver(driver);

    expect(lane.ready).toBe(false);
    expect(lane.plannerAdmission).toBe("blocked");
    expect(lane.capabilityNote).toMatch(/retired Comet lane/i);
  });

  it("formats missing public SODAX endpoints as explicit runtime state", () => {
    expect(formatIntentExecutionSurfaceEndpoint(null, "quote")).toBe(
      "Quote source is not configured for this SODAX connection",
    );
    expect(formatIntentExecutionSurfaceEndpoint("", "status")).toBe(
      "Status tracking is not configured for this SODAX connection",
    );
    expect(
      formatIntentExecutionSurfaceEndpoint(
        " sdk:@sodax/sdk::swaps.getStatus ",
        "confirmation",
      ),
    ).toBe("sdk:@sodax/sdk::swaps.getStatus");
  });

  it("derives fail-closed SODAX surface actions from catalog, quote and hash inputs", () => {
    expect(
      deriveBalancedIntentSurfaceActionStates({
        tokensLoaded: false,
        tokenIn: "",
        tokenOut: "",
        amountInBase: "10000000",
        intentTxHash: "",
        busy: false,
      }),
    ).toMatchObject({
      quote: {
        enabled: false,
        reason: "Load the SODAX token catalog first.",
      },
      status: {
        enabled: false,
        reason: "Enter an intent transaction hash first.",
      },
      confirmation: {
        enabled: false,
        reason: "Enter an intent transaction hash first.",
      },
    });

    expect(
      deriveBalancedIntentSurfaceActionStates({
        tokensLoaded: true,
        tokenIn: "CTOKEN",
        tokenOut: "CTOKEN",
        amountInBase: "10000000",
        intentTxHash: "0xintent",
        busy: false,
      }).quote,
    ).toMatchObject({
      enabled: false,
      reason: "Select two different SODAX tokens before requesting a quote.",
    });

    expect(
      deriveBalancedIntentSurfaceActionStates({
        tokensLoaded: true,
        tokenIn: "CTOKENIN",
        tokenOut: "CTOKENOUT",
        amountInBase: "10000000",
        intentTxHash: "0xintent",
        busy: false,
      }),
    ).toMatchObject({
      quote: {
        enabled: true,
        reason: "Ready to request the official SODAX quote.",
      },
      status: {
        enabled: true,
        reason: "Ready to query the SODAX intent hash.",
      },
      confirmation: {
        enabled: true,
        reason: "Ready to query the SODAX intent hash.",
      },
    });
  });
});
