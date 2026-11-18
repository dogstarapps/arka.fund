import { describe, expect, it } from "vitest";
import { buildBalancedFallbackPayload } from "@/lib/runtime/appHealth";
import { buildBalancedIntentExecutionDriver } from "@/lib/workflows/intentExecutionDrivers";
import {
  buildBalancedIntentExecutionHandoff,
  formatIntentExecutionHandoffPostureLabel,
  formatIntentExecutionHandoffStepStateLabel,
} from "@/lib/workflows/intentExecutionHandoffs";

describe("intent execution flows", () => {
  it("builds a manual flow when Balanced execution is admitted but AUTO is not", () => {
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
            swapDocs: "https://balanced.network/",
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

    const handoff = buildBalancedIntentExecutionHandoff(driver, {
      assetIn: "CIN",
      assetOut: "COUT",
      amountLabel: "1.2500000",
      minOutLabel: "1.2000000",
    });

    expect(handoff.posture).toBe("manual_intent_handoff");
    expect(handoff.primaryAction?.label).toBe("Official app");
    expect(handoff.statusAction?.label).toMatch(/Recent Activity/i);
    expect(handoff.operatorRoute).toMatch(/Official app discovery/i);
    expect(handoff.routeContext).toContain("CIN -> COUT");
    expect(handoff.routeContext).toContain("amount 1.2500000");
    expect(handoff.routeContext).toContain("min out 1.2000000");
    expect(handoff.steps[1]).toMatchObject({
      id: "quote",
      state: "manual_only",
    });
    expect(handoff.steps[1]?.detail).toMatch(/review the trade manually/i);
    expect(handoff.steps[2]).toMatchObject({
      id: "execute",
      state: "ready",
    });
    expect(formatIntentExecutionHandoffPostureLabel(handoff.posture)).toBe(
      "Manual intent flow",
    );
    expect(formatIntentExecutionHandoffStepStateLabel(handoff.steps[1].state)).toBe(
      "Manual only",
    );
  });

  it("falls back to discovery-only when the Balanced lane is blocked", () => {
    const driver = buildBalancedIntentExecutionDriver(
      buildBalancedFallbackPayload({
        supportStatus: "blocked",
        readyForDappExecution: false,
        laneMode: "legacy_comet",
        blockingReasons: ["Balanced still points to the retired Comet lane."],
        officialSurface: {
          officialSources: {
            app: "https://app.balanced.network",
            bundle: "https://app.balanced.network/assets/index.js",
            stellarPage: "https://balanced.network/stellar/",
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

    const handoff = buildBalancedIntentExecutionHandoff(driver);

    expect(handoff.posture).toBe("discovery_only");
    expect(handoff.summary).toMatch(/discovery only/i);
    expect(handoff.steps[2]).toMatchObject({
      id: "execute",
      state: "blocked",
    });
  });
});
