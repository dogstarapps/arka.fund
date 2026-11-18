import { afterEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  listBalancedSodaxStellarTokens: vi.fn(async () => [
    {
      symbol: "bnUSD",
      name: "Balanced Dollar",
      decimals: 7,
      address: "CBNUSD",
      chainId: "stellar",
    },
    {
      symbol: "USDC",
      name: "USD Coin",
      decimals: 7,
      address: "CUSDC",
      chainId: "stellar",
    },
  ]),
  requestBalancedSodaxQuote: vi.fn(async () => ({
    ok: true,
    provider: "sodax_sdk",
    tokenIn: {
      symbol: "bnUSD",
      name: "Balanced Dollar",
      decimals: 7,
      address: "CBNUSD",
      chainId: "stellar",
    },
    tokenOut: {
      symbol: "USDC",
      name: "USD Coin",
      decimals: 7,
      address: "CUSDC",
      chainId: "stellar",
    },
    amountInBase: "10000000",
    quotedAmountBase: "9985000",
    quoteType: "exact_input",
  })),
  requestBalancedSodaxIntentBuild: vi.fn(async () => ({
    ok: true,
    provider: "sodax_sdk",
    tokenIn: {
      symbol: "bnUSD",
      name: "Balanced Dollar",
      decimals: 7,
      address: "CBNUSD",
      chainId: "stellar",
    },
    tokenOut: {
      symbol: "USDC",
      name: "USD Coin",
      decimals: 7,
      address: "CUSDC",
      chainId: "stellar",
    },
    amountInBase: "10000000",
    minOutputAmountBase: "9900000",
    sourceAccount: "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
    destinationAccount: "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
    deadlineSeconds: 300,
    allowPartialFill: false,
    rawTransaction: {
      from: "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
      to: "contract",
      valueBase: "0",
      xdr: "AAAA",
    },
    intent: {
      intentId: "1",
      creator: "0xcreator",
      inputToken: "CBNUSD",
      outputToken: "CUSDC",
      inputAmountBase: "10000000",
      minOutputAmountBase: "9900000",
      deadlineUnixSeconds: "1893456000",
      allowPartialFill: false,
      srcChain: "1",
      dstChain: "1",
      srcAddress: "0xsrc",
      dstAddress: "0xdst",
      solver: "0x0000000000000000000000000000000000000000",
      data: "0x",
      feeAmountBase: null,
      intentHash: "0xabcdef12",
    },
    intentData: "0x",
    expiry: {
      deadlineUnixSeconds: "1893456000",
      expiresAt: "2030-01-01T00:00:00.000Z",
      expired: false,
      secondsUntilExpiry: 300,
      cancellationWindowSeconds: 300,
      source: "intent_deadline",
      detail: "active",
    },
    refund: {
      refundMode: "cancel_intent",
      refundRequired: false,
      refundAvailable: true,
      refundRecipient: "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
      cancelRequiresIntent: true,
      detail: "available",
    },
  })),
  requestBalancedSodaxSubmit: vi.fn(async () => ({
    ok: true,
    provider: "sodax_sdk",
    intentTxHash: "0xabcdef12",
    answer: "OK",
    solverIntentHash: "0xsolver",
    detail: "accepted",
  })),
  requestBalancedSodaxRelaySubmit: vi.fn(async () => ({
    ok: true,
    provider: "sodax_sdk",
    sourceTxHash: "abcdef1234567890",
    relayChainId: "27",
    success: true,
    message: "submitted",
    canonicalIntentTxHash: "0xrelaydst",
    canonicalIntentPacket: {
      srcChainId: "27",
      srcTxHash: "abcdef1234567890",
      srcAddress: "stellar-source",
      status: "executed",
      dstChainId: "146",
      connectionSequence: "7216",
      dstAddress: "hub-destination",
      dstTxHash: "0xrelaydst",
    },
    packets: [
      {
        srcChainId: "27",
        srcTxHash: "abcdef1234567890",
        srcAddress: "stellar-source",
        status: "executed",
        dstChainId: "146",
        connectionSequence: "7216",
        dstAddress: "hub-destination",
        dstTxHash: "0xrelaydst",
      },
    ],
    detail: "relayed",
  })),
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
  requestBalancedSodaxReceipt: vi.fn(async () => ({
    ok: true,
    provider: "sodax_sdk",
    receipt: {
      receiptState: "settled",
      intentTxHash: "0xabcdef12",
      statusLabel: "SOLVED",
      terminal: true,
      fillTxHash: "0xfill",
      confirmationTxHash: "0xfill",
      packet: null,
      detail: "settled",
    },
    refund: {
      refundMode: "none",
      refundRequired: false,
      refundAvailable: false,
      refundRecipient: null,
      cancelRequiresIntent: false,
      detail: "none",
    },
    expiry: {
      deadlineUnixSeconds: null,
      expiresAt: null,
      expired: false,
      secondsUntilExpiry: null,
      cancellationWindowSeconds: 0,
      source: "unknown",
      detail: "unknown",
    },
  })),
  requestBalancedSodaxExpiry: vi.fn(async () => ({
    ok: true,
    provider: "sodax_sdk",
    intentTxHash: "0xabcdef12",
    intent: null,
    expiry: {
      deadlineUnixSeconds: null,
      expiresAt: null,
      expired: false,
      secondsUntilExpiry: null,
      cancellationWindowSeconds: 0,
      source: "unknown",
      detail: "unknown",
    },
  })),
  requestBalancedSodaxRefund: vi.fn(async () => ({
    ok: true,
    provider: "sodax_sdk",
    sourceAccount: "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
    intentTxHash: "0xabcdef12",
    rawTransaction: {
      from: "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
      to: "contract",
      valueBase: "0",
      xdr: "BBBB",
    },
    intent: {
      intentId: "1",
      creator: "0xcreator",
      inputToken: "CBNUSD",
      outputToken: "CUSDC",
      inputAmountBase: "10000000",
      minOutputAmountBase: "9900000",
      deadlineUnixSeconds: "1893456000",
      allowPartialFill: false,
      srcChain: "1",
      dstChain: "1",
      srcAddress: "0xsrc",
      dstAddress: "0xdst",
      solver: "0x0000000000000000000000000000000000000000",
      data: "0x",
      feeAmountBase: null,
      intentHash: "0xabcdef12",
    },
    refund: {
      refundMode: "cancel_intent",
      refundRequired: false,
      refundAvailable: true,
      refundRecipient: "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
      cancelRequiresIntent: true,
      detail: "available",
    },
    expiry: {
      deadlineUnixSeconds: "1893456000",
      expiresAt: "2030-01-01T00:00:00.000Z",
      expired: false,
      secondsUntilExpiry: 300,
      cancellationWindowSeconds: 300,
      source: "intent_deadline",
      detail: "active",
    },
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
    receipt: null,
    refund: {
      refundMode: "none",
      refundRequired: false,
      refundAvailable: false,
      refundRecipient: null,
      cancelRequiresIntent: false,
      detail: "none",
    },
    expiry: {
      deadlineUnixSeconds: null,
      expiresAt: null,
      expired: false,
      secondsUntilExpiry: null,
      cancellationWindowSeconds: 0,
      source: "unknown",
      detail: "unknown",
    },
  })),
}));

vi.mock("@/lib/server/balancedSodax", () => mocks);

describe("Balanced intent API routes", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("returns the token catalog from GET /api/intents/balanced/quote", async () => {
    const { GET } = await import("@/app/api/intents/balanced/quote/route");
    const response = await GET();
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.tokens).toHaveLength(2);
    expect(payload.tokens[0].symbol).toBe("bnUSD");
  });

  it("returns a real quote payload from POST /api/intents/balanced/quote", async () => {
    const { POST } = await import("@/app/api/intents/balanced/quote/route");
    const request = new Request("http://localhost/api/intents/balanced/quote", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        tokenIn: "CBNUSD",
        tokenOut: "CUSDC",
        amountInBase: "10000000",
      }),
    });

    const response = await POST(request as never);
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.ok).toBe(true);
    expect(payload.quotedAmountBase).toBe("9985000");
    expect(mocks.requestBalancedSodaxQuote).toHaveBeenCalledWith({
      tokenIn: "CBNUSD",
      tokenOut: "CUSDC",
      amountInBase: "10000000",
    });
  });

  it("returns status data from POST /api/intents/balanced/status", async () => {
    const { POST } = await import("@/app/api/intents/balanced/status/route");
    const request = new Request("http://localhost/api/intents/balanced/status", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        intentTxHash: "0xabcdef12",
      }),
    });

    const response = await POST(request as never);
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.ok).toBe(true);
    expect(payload.statusLabel).toBe("SOLVED");
    expect(mocks.requestBalancedSodaxStatus).toHaveBeenCalledWith("0xabcdef12");
  });

  it("builds unsigned SODAX intent XDR from POST /api/intents/balanced/build", async () => {
    const account = "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA";
    const { POST } = await import("@/app/api/intents/balanced/build/route");
    const request = new Request("http://localhost/api/intents/balanced/build", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        tokenIn: "CBNUSD",
        tokenOut: "CUSDC",
        amountInBase: "10000000",
        minOutputAmountBase: "9900000",
        sourceAccount: account,
        destinationAccount: account,
      }),
    });

    const response = await POST(request as never);
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.ok).toBe(true);
    expect(payload.rawTransaction.xdr).toBe("AAAA");
    expect(mocks.requestBalancedSodaxIntentBuild).toHaveBeenCalledWith(
      expect.objectContaining({
        tokenIn: "CBNUSD",
        tokenOut: "CUSDC",
        amountInBase: "10000000",
        minOutputAmountBase: "9900000",
        sourceAccount: account,
      }),
    );
  });

  it("returns status data from GET /api/intents/balanced/status", async () => {
    const { GET } = await import("@/app/api/intents/balanced/status/route");
    const request = new Request(
      "http://localhost/api/intents/balanced/status?intentTxHash=0xabcdef12",
    );

    const response = await GET(request as never);
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.ok).toBe(true);
    expect(payload.statusLabel).toBe("SOLVED");
    expect(mocks.requestBalancedSodaxStatus).toHaveBeenCalledWith("0xabcdef12");
  });

  it("returns confirmation data from POST /api/intents/balanced/confirm", async () => {
    const { POST } = await import("@/app/api/intents/balanced/confirm/route");
    const request = new Request("http://localhost/api/intents/balanced/confirm", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        intentTxHash: "0xabcdef12",
      }),
    });

    const response = await POST(request as never);
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.ok).toBe(true);
    expect(payload.confirmationState).toBe("confirmed");
    expect(payload.confirmationTxHash).toBe("0xfill");
    expect(mocks.requestBalancedSodaxConfirm).toHaveBeenCalledWith("0xabcdef12");
  });

  it("returns confirmation data from GET /api/intents/balanced/confirm", async () => {
    const { GET } = await import("@/app/api/intents/balanced/confirm/route");
    const request = new Request(
      "http://localhost/api/intents/balanced/confirm?intentTxHash=0xabcdef12",
    );

    const response = await GET(request as never);
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.ok).toBe(true);
    expect(payload.confirmationState).toBe("confirmed");
    expect(payload.confirmationTxHash).toBe("0xfill");
    expect(mocks.requestBalancedSodaxConfirm).toHaveBeenCalledWith("0xabcdef12");
  });

  it("serves relay, submit, receipt, expiry and refund endpoints", async () => {
    const account = "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA";
    const { POST: relayPost } = await import("@/app/api/intents/balanced/relay/route");
    const { POST: submitPost } = await import("@/app/api/intents/balanced/submit/route");
    const { POST: receiptPost } = await import("@/app/api/intents/balanced/receipt/route");
    const { GET: expiryGet } = await import("@/app/api/intents/balanced/expiry/route");
    const { POST: refundPost } = await import("@/app/api/intents/balanced/refund/route");

    const relayResponse = await relayPost(
      new Request("http://localhost/api/intents/balanced/relay", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ sourceTxHash: "abcdef1234567890" }),
      }) as never,
    );
    const submitResponse = await submitPost(
      new Request("http://localhost/api/intents/balanced/submit", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ intentTxHash: "0xabcdef12" }),
      }) as never,
    );
    const receiptResponse = await receiptPost(
      new Request("http://localhost/api/intents/balanced/receipt", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ intentTxHash: "0xabcdef12" }),
      }) as never,
    );
    const expiryResponse = await expiryGet(
      new Request(
        "http://localhost/api/intents/balanced/expiry?intentTxHash=0xabcdef12",
      ) as never,
    );
    const refundResponse = await refundPost(
      new Request("http://localhost/api/intents/balanced/refund", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ sourceAccount: account, intentTxHash: "0xabcdef12" }),
      }) as never,
    );

    expect(relayResponse.status).toBe(200);
    expect(await relayResponse.json()).toMatchObject({
      relayChainId: "27",
      canonicalIntentTxHash: "0xrelaydst",
    });
    expect(submitResponse.status).toBe(200);
    expect((await submitResponse.json()).solverIntentHash).toBe("0xsolver");
    expect(receiptResponse.status).toBe(200);
    expect((await receiptResponse.json()).receipt.receiptState).toBe("settled");
    expect(expiryResponse.status).toBe(200);
    expect((await expiryResponse.json()).expiry.source).toBe("unknown");
    expect(refundResponse.status).toBe(200);
    expect((await refundResponse.json()).rawTransaction.xdr).toBe("BBBB");
  });

  it("rejects malformed intent hashes with deterministic 400 validation", async () => {
    const { POST: statusPost } = await import("@/app/api/intents/balanced/status/route");
    const statusRequest = new Request("http://localhost/api/intents/balanced/status", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        intentTxHash: "not-a-hash",
      }),
    });
    const statusResponse = await statusPost(statusRequest as never);
    const statusPayload = await statusResponse.json();

    expect(statusResponse.status).toBe(400);
    expect(String(statusPayload.error || "")).toMatch(/0x-prefixed hex hash/i);

    const { POST: confirmPost } = await import("@/app/api/intents/balanced/confirm/route");
    const confirmRequest = new Request("http://localhost/api/intents/balanced/confirm", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        intentTxHash: "not-a-hash",
      }),
    });
    const confirmResponse = await confirmPost(confirmRequest as never);
    const confirmPayload = await confirmResponse.json();

    expect(confirmResponse.status).toBe(400);
    expect(String(confirmPayload.error || "")).toMatch(/0x-prefixed hex hash/i);
  });
});
