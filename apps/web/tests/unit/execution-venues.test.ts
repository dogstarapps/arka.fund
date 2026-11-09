import { describe, expect, it } from "vitest";
import { buildBalancedFallbackPayload } from "@/lib/runtime/appHealth";
import { NETWORK_PASSPHRASE } from "@/lib/config";
import { buildExecutionVenueCatalog } from "@/lib/workflows/executionVenues";

describe("execution venues", () => {
  it("marks Balanced as intent execution with manual-only admission when ready", () => {
    const catalog = buildExecutionVenueCatalog({
      venueStates: Object.fromEntries(["SOROSWAP","AQUARIUS","SUSHI","BLEND","BALANCED"].map(venue=>[venue,{registry:"registry",venue,network:NETWORK_PASSPHRASE,status:2 as const,updatedAt:"1",updatedBy:"admin",observedAt:Date.now()}])),
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
      sushiHealth: { matched: true, label: "Healthy", tone: "positive" },
      soroswapHealth: { matched: true, label: "Healthy", tone: "positive" },
      blendHealth: { matched: true, label: "Healthy", tone: "positive" },
    });

    const balanced = catalog.find((venue) => venue.id === "BALANCED");
    expect(balanced?.family).toBe("intent_execution");
    expect(balanced?.pathModel).toBe("adapter_gated");
    expect(balanced?.quoteModel).toBe("manual_lane");
    expect(balanced?.autoRoutingEligible).toBe(false);
    expect(balanced?.manualExecutionEligible).toBe(true);
    expect(balanced?.plannerAdmission).toBe("manual_only");
    expect(balanced?.comparableQuote).toBe(false);
    expect(balanced?.capabilityDetail).toMatch(/SODAX Intents/i);
    expect(balanced?.confirmationDetail).toMatch(/submitted transaction hash/i);
  });

  it("keeps router venues auto-eligible and Blend outside swap routing", () => {
    const catalog = buildExecutionVenueCatalog({
      venueStates: Object.fromEntries(["SOROSWAP","AQUARIUS","SUSHI","BLEND","BALANCED"].map(venue=>[venue,{registry:"registry",venue,network:NETWORK_PASSPHRASE,status:2 as const,updatedAt:"1",updatedBy:"admin",observedAt:Date.now()}])),
      balancedSupport: buildBalancedFallbackPayload(),
      aquariusHealth: { matched: true, label: "Healthy", tone: "positive" },
      sushiHealth: { matched: true, label: "Healthy", tone: "positive" },
      soroswapHealth: { matched: true, label: "Healthy", tone: "positive" },
      blendHealth: { matched: true, label: "Healthy", tone: "positive" },
    });

    const aquarius = catalog.find((venue) => venue.id === "AQUARIUS");
    const soroswap = catalog.find((venue) => venue.id === "SOROSWAP");
    const sushi = catalog.find((venue) => venue.id === "SUSHI");
    const blend = catalog.find((venue) => venue.id === "BLEND");

    expect(aquarius?.autoRoutingEligible).toBe(true);
    expect(soroswap?.autoRoutingEligible).toBe(true);
    expect(sushi?.autoRoutingEligible).toBe(true);
    expect(sushi?.settlementModel).toBe("onchain_adapter");
    expect(sushi?.pathModel).toBe("adapter_gated");
    expect(blend?.family).toBe("credit_market");
    expect(blend?.quoteModel).toBe("not_applicable");
    expect(blend?.autoRoutingEligible).toBe(false);
  });

  it("blocks AMM AUTO when quote readiness and adapter readiness diverge", () => {
    const catalog = buildExecutionVenueCatalog({
      venueStates: Object.fromEntries(["SOROSWAP","AQUARIUS","SUSHI","BLEND","BALANCED"].map(venue=>[venue,{registry:"registry",venue,network:NETWORK_PASSPHRASE,status:2 as const,updatedAt:"1",updatedBy:"admin",observedAt:Date.now()}])),
      balancedSupport: buildBalancedFallbackPayload(),
      aquariusHealth: { matched: false, label: "Unavailable", tone: "critical" },
      aquariusPlannerReady: true,
      aquariusAdapterDetail: "Adapter deployment does not expose router().",
      sushiHealth: { matched: false, label: "Blocked", tone: "warning" },
      soroswapHealth: { matched: true, label: "Healthy", tone: "positive" },
      soroswapPlannerReady: false,
      soroswapPlannerDetail: "No live route quote returned for Routing asset A -> Routing asset B.",
      blendHealth: { matched: true, label: "Healthy", tone: "positive" },
    });

    const aquarius = catalog.find((venue) => venue.id === "AQUARIUS");
    const soroswap = catalog.find((venue) => venue.id === "SOROSWAP");

    expect(aquarius?.statusLabel).toBe("Route not ready");
    expect(aquarius?.comparableQuote).toBe(true);
    expect(aquarius?.autoRoutingEligible).toBe(false);
    expect(aquarius?.plannerAdmission).toBe("blocked");
    expect(aquarius?.capabilityDetail).toMatch(/adapter exposes/i);

    expect(soroswap?.statusLabel).toBe("Quote not ready");
    expect(soroswap?.comparableQuote).toBe(false);
    expect(soroswap?.autoRoutingEligible).toBe(false);
    expect(soroswap?.detail).toMatch(/could not obtain a live comparable quote/i);
  });
});
