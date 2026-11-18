import { describe, expect, it } from "vitest";
import { buildBalancedFallbackPayload } from "@/lib/runtime/appHealth";
import { buildExecutionVenueCatalog } from "@/lib/workflows/executionVenues";
import {
  buildExecutionVenueReceipt,
  buildRebalanceExecutionReceipt,
} from "@/lib/workflows/executionReceipts";

describe("execution receipts", () => {
  it("builds a structured venue receipt for Balanced", () => {
    const balancedVenue = buildExecutionVenueCatalog({
      balancedSupport: buildBalancedFallbackPayload({
        supportStatus: "ready",
        readyForDappExecution: true,
        laneMode: "expected_router",
        validatedModule: {
          present: true,
          validatedAt: "2026-04-07",
          router: "CROUTER",
          poolId: 7,
          sourceValidations: ["balancedReadiness"],
          source: "deployments",
        },
        officialSurface: {
          topology: "intent_based",
          swapModel: "sodax_intents",
          liquidityModel: "legacy_exchange_only",
          publicRouterContractId: null,
          supportsPublicStellarTestnet: false,
          canonicalRouterCutoverPossible: false,
          stellarMainnetAddresses: {
            connection: "CCONNECTION",
            assetManager: "CASSETMANAGER",
            xTokenManager: null,
            rateLimit: "CRATELIMIT",
          },
          findings: [],
          source: "deployments",
        },
        source: "deployments",
      }),
      aquariusHealth: { matched: true, label: "Healthy", tone: "positive" },
      soroswapHealth: { matched: true, label: "Healthy", tone: "positive" },
      blendHealth: { matched: true, label: "Healthy", tone: "positive" },
    }).find((venue) => venue.id === "BALANCED");

    expect(balancedVenue).toBeTruthy();
    const receipt = buildExecutionVenueReceipt({
      venue: balancedVenue!,
      actionLabel: "Balanced execute",
      primaryHash: "TXHASH123",
      steps: [{ id: "execute", label: "Execute lane", hash: "TXHASH123" }],
      submittedAt: "2026-04-07T10:00:00.000Z",
    });

    expect(receipt.venueId).toBe("BALANCED");
    expect(receipt.pathModel).toBe("adapter_gated");
    expect(receipt.confirmationModel).toBe("transaction_hash_plus_refresh");
    expect(receipt.summary).toMatch(/Intent route/i);
  });

  it("builds a rebalance receipt from a routing candidate", () => {
    const receipt = buildRebalanceExecutionReceipt({
      candidate: {
        routeId: "AQUARIUS_DIRECT",
        protocol: "AQUARIUS",
        venueFamily: "amm_router",
        quoteModel: "live_router_quote",
        settlementModel: "onchain_router",
        pathModel: "router_direct",
        confirmationModel: "transaction_hash_plus_refresh",
        title: "Aquarius direct",
        estimatedOutBase: 10,
        minOutBase: 9,
        available: true,
        admitted: true,
        autoEligible: true,
        note: "quoted",
        pathAssets: ["A", "B"],
        pathLabel: "A -> B",
        hops: 1,
        routeScoreBase: 10,
        routeScoreLabel: "score = est. output",
        executionKind: "aquarius_single_pool",
        steps: [],
      },
      primaryHash: "HASH987",
      actionLabel: "Rebalance",
      steps: [{ id: "swap", label: "Swap", hash: "HASH987" }],
      submittedAt: "2026-04-07T10:00:00.000Z",
    });

    expect(receipt.venueId).toBe("AQUARIUS");
    expect(receipt.summary).toMatch(/AMM router/i);
    expect(receipt.primaryHash).toBe("HASH987");
  });
});
