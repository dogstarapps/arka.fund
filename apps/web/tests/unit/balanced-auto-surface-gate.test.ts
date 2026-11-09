import { describe, expect, it } from "vitest";
import { buildBalancedFallbackPayload } from "@/lib/runtime/appHealth";
import {
  deriveBalancedAutoSurfaceGate,
  deriveBalancedAutoSurfaceReadiness,
} from "@/lib/runtime/balancedAutoSurfaceGate";

const officialSources = {
  app: "https://app.balanced.network",
  bundle: "https://app.balanced.network/assets/index.js",
  stellarPage: "https://balanced.network/stellar/",
  swapDocs: "https://docs.sodax.com/developers/packages",
  tradeBlog: "https://blog.balanced.network/trade-cross-chain/",
  q3Blog: "https://blog.balanced.network/q3-2025/",
};

describe("balanced AUTO surface gate", () => {
  it("marks gate as not_required when target network is not mainnet", () => {
    const balanced = buildBalancedFallbackPayload();
    const gate = deriveBalancedAutoSurfaceGate(balanced, {
      targetNetwork: "testnet",
      enforceMainnetOnly: true,
    });

    expect(gate.status).toBe("not_required");
    expect(gate.code).toBe("not_required");
    expect(gate.ready).toBe(true);
  });

  it("keeps gate blocked in manual_only planner posture", () => {
    const balanced = buildBalancedFallbackPayload({
      supportStatus: "ready",
      readyForDappExecution: true,
      adapterBalanced: "CBALANCED",
      poolId: 3,
      officialSurface: {
        officialSources,
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
    });
    const readiness = deriveBalancedAutoSurfaceReadiness(balanced);
    const gate = deriveBalancedAutoSurfaceGate(balanced, {
      targetNetwork: "mainnet",
      enforceMainnetOnly: true,
    });

    expect(readiness.surfaceReady).toBe(true);
    expect(readiness.officialEvidenceReady).toBe(true);
    expect(readiness.officialAutoComparable).toBe(false);
    expect(readiness.plannerAdmission).toBe("manual_only");
    expect(gate.status).toBe("blocked");
    expect(gate.code).toBe("manual_only");
    expect(gate.checks.officialEvidenceCode).toBe("verified_manual_only");
  });

  it("blocks with surface_incomplete when planner is auto but endpoints are missing", () => {
    const balanced = buildBalancedFallbackPayload({
      supportStatus: "ready",
      readyForDappExecution: true,
      adapterBalanced: "CBALANCED",
      poolId: 3,
      officialSurface: {
        officialSources,
        topology: "intent_based",
        swapModel: "sodax_intents",
        intentAdapter: {
          quoteProvider: "sodax",
          quoteVisibleInApp: true,
          quoteComparableForArka: true,
          publicQuoteEndpoint: "sdk:@sodax/sdk::swaps.getQuote",
          publicBuildEndpoint: null,
          publicRelayEndpoint: null,
          publicSubmitEndpoint: null,
          statusSurface: "recent_activity",
          publicStatusEndpoint: null,
          publicReceiptEndpoint: null,
          publicExpiryEndpoint: null,
          publicRefundEndpoint: null,
          cancellationWindowSeconds: 300,
        },
      },
      intentVenue: {
        plannerAdmission: "auto",
        manualExecutionEligible: true,
      },
    });
    const gate = deriveBalancedAutoSurfaceGate(balanced, {
      targetNetwork: "mainnet",
      enforceMainnetOnly: true,
    });

    expect(gate.status).toBe("blocked");
    expect(gate.code).toBe("official_surface_unverified");
    expect(gate.checks.plannerAdmission).toBe("auto");
    expect(gate.checks.officialEvidenceReady).toBe(false);
  });

  it("marks gate as ready when AUTO posture and machine-consumable surface are fully declared", () => {
    const balanced = buildBalancedFallbackPayload({
      supportStatus: "ready",
      readyForDappExecution: true,
      adapterBalanced: "CBALANCED",
      poolId: 3,
      officialSurface: {
        officialSources,
        topology: "intent_based",
        swapModel: "sodax_intents",
        intentAdapter: {
          quoteProvider: "sodax",
          quoteVisibleInApp: true,
          quoteComparableForArka: true,
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
      intentVenue: {
        plannerAdmission: "auto",
        manualExecutionEligible: true,
      },
    });
    const gate = deriveBalancedAutoSurfaceGate(balanced, {
      targetNetwork: "mainnet",
      enforceMainnetOnly: true,
    });

    expect(gate.status).toBe("ready");
    expect(gate.code).toBe("ready");
    expect(gate.ready).toBe(true);
    expect(gate.checks.officialEvidenceReady).toBe(true);
    expect(gate.checks.officialAutoComparable).toBe(true);
    expect(gate.checks.hasNoPublicRouterContractId).toBe(true);
  });

  it("blocks declared router contract IDs because Balanced/SODAX is intent-based", () => {
    const balanced = buildBalancedFallbackPayload({
      supportStatus: "ready",
      readyForDappExecution: true,
      adapterBalanced: "CBALANCED",
      poolId: 3,
      officialSurface: {
        officialSources,
        topology: "intent_based",
        swapModel: "sodax_intents",
        publicRouterContractId: "CFAKEROUTER",
        intentAdapter: {
          quoteProvider: "sodax",
          quoteVisibleInApp: true,
          quoteComparableForArka: true,
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
      intentVenue: {
        plannerAdmission: "auto",
        manualExecutionEligible: true,
      },
    });
    const gate = deriveBalancedAutoSurfaceGate(balanced, {
      targetNetwork: "mainnet",
      enforceMainnetOnly: true,
    });

    expect(gate.status).toBe("blocked");
    expect(gate.code).toBe("router_contract_declared");
    expect(gate.checks.hasNoPublicRouterContractId).toBe(false);
    expect(gate.detail).toMatch(/cannot declare a public router contract ID/i);
  });
});
