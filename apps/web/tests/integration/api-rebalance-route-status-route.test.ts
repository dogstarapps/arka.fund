import { afterEach, describe, expect, it, vi } from "vitest";
import { buildBalancedFallbackPayload } from "@/lib/runtime/appHealth";

const mocks = vi.hoisted(() => ({
  readBalancedProtocolHealth: vi.fn(async () =>
    buildBalancedFallbackPayload({
      adapterBalanced: "CBALANCED",
      poolId: 3,
      supportStatus: "ready",
      readyForDappExecution: true,
      laneMode: "expected_router",
      blockingReasons: [],
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
  ),
  requestBalancedSodaxStatus: vi.fn(async () => ({
    ok: true,
    provider: "sodax_sdk",
    intentTxHash: "0xabcdef12",
    statusCode: 3,
    statusLabel: "SOLVED",
    fillTxHash: "0xfill",
    terminal: true,
  })),
  requestBalancedSodaxConfirm: vi.fn(async () => ({
    ok: true,
    provider: "sodax_sdk",
    intentTxHash: "0xabcdef12",
    statusCode: 3,
    statusLabel: "SOLVED",
    terminal: true,
    fillTxHash: "0xfill",
    confirmationTxHash: "0xfill",
    confirmed: true,
    confirmationState: "confirmed",
    detail: "Intent solved and settlement hash confirmed from SODAX status.",
  })),
  requestBalancedSodaxLifecycle: vi.fn(async () => ({
    status: {
      ok: true,
      provider: "sodax_sdk",
      intentTxHash: "0xabcdef12",
      statusCode: 3,
      statusLabel: "SOLVED",
      fillTxHash: "0xfill",
      terminal: true,
    },
    confirmation: {
      ok: true,
      provider: "sodax_sdk",
      intentTxHash: "0xabcdef12",
      statusCode: 3,
      statusLabel: "SOLVED",
      terminal: true,
      fillTxHash: "0xfill",
      confirmationTxHash: "0xfill",
      confirmed: true,
      confirmationState: "confirmed",
      detail: "Intent solved and settlement hash confirmed from SODAX status.",
    },
  })),
}));

vi.mock("@/lib/runtime/protocolSupport", () => ({
  readBalancedProtocolHealth: mocks.readBalancedProtocolHealth,
}));

vi.mock("@/lib/server/balancedSodax", () => ({
  listBalancedSodaxStellarTokens: vi.fn(async () => []),
  requestBalancedSodaxQuote: vi.fn(async () => ({
    ok: false,
    provider: "sodax_sdk",
    tokenIn: {
      symbol: "bnUSD",
      name: "Balanced Dollar",
      decimals: 7,
      address: "CAAA",
      chainId: "stellar",
    },
    tokenOut: {
      symbol: "USDC",
      name: "USD Coin",
      decimals: 7,
      address: "CBBB",
      chainId: "stellar",
    },
    amountInBase: "1",
    code: 500,
    message: "not used",
    quoteType: "exact_input",
  })),
  requestBalancedSodaxStatus: mocks.requestBalancedSodaxStatus,
  requestBalancedSodaxConfirm: mocks.requestBalancedSodaxConfirm,
  requestBalancedSodaxLifecycle: mocks.requestBalancedSodaxLifecycle,
}));

describe("GET /api/routing/rebalance/status", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("returns backend solver status and Balanced admission posture", async () => {
    const { GET } = await import("@/app/api/routing/rebalance/status/route");

    const response = await GET(new Request("http://localhost/api/routing/rebalance/status"));
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.ok).toBe(true);
    expect(payload.source).toBe("api_routing_solver_status");
    expect(payload.routing.mode).toBe("backend_solver_with_local_fallback");
    expect(payload.routing.planEndpoint).toBe("/api/routing/rebalance/plan");
    expect(payload.routing.backendAvailable).toBe(true);
    expect(payload.routing.balancedPlannerAdmission).toBe("manual_only");
    expect(payload.routing.balancedManualExecutionEligible).toBe(true);
    expect(payload.routing.balancedComparableQuote).toBe(false);
    expect(payload.routing.balancedAutoSurfaceReady).toBe(false);
    expect(String(payload.routing.balancedAutoSurfaceReason || "")).toMatch(
      /machine-consumable|manual|comparable/i,
    );
  });

  it("returns intent status and confirm snapshots when intentTxHash is provided", async () => {
    const { GET } = await import("@/app/api/routing/rebalance/status/route");
    const response = await GET(
      new Request("http://localhost/api/routing/rebalance/status?intentTxHash=0xabcdef12"),
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.ok).toBe(true);
    expect(payload.balancedIntentLifecycle).toBeTruthy();
    expect(payload.balancedIntentLifecycle.status.statusLabel).toBe("SOLVED");
    expect(payload.balancedIntentLifecycle.confirmation.confirmationState).toBe("confirmed");
    expect(mocks.requestBalancedSodaxLifecycle).toHaveBeenCalledWith(
      "0xabcdef12",
    );
  });

  it("rejects malformed intentTxHash with a deterministic 400", async () => {
    const { GET } = await import("@/app/api/routing/rebalance/status/route");
    const response = await GET(
      new Request("http://localhost/api/routing/rebalance/status?intentTxHash=not-valid"),
    );
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload.ok).toBe(false);
    expect(String(payload.error || "")).toMatch(/0x-prefixed hex hash/i);
  });
});
