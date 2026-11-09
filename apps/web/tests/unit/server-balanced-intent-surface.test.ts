import { describe, expect, it, vi } from "vitest";
import {
  BalancedIntentSurfaceValidationError,
  requestBalancedIntentSurfaceBuild,
  requestBalancedIntentSurfaceExpiry,
  requestBalancedIntentSurfaceLifecycle,
  listBalancedIntentSurfaceTokens,
  requestBalancedIntentSurfaceConfirm,
  requestBalancedIntentSurfaceQuote,
  requestBalancedIntentSurfaceRelay,
  requestBalancedIntentSurfaceReceipt,
  requestBalancedIntentSurfaceRefund,
  requestBalancedIntentSurfaceStatus,
  requestBalancedIntentSurfaceSubmit,
} from "@/lib/server/balancedIntentSurface";

const mocks = vi.hoisted(() => ({
  listBalancedSodaxStellarTokens: vi.fn(async () => [
    {
      symbol: "bnUSD",
      name: "Balanced Dollar",
      decimals: 7,
      address: "CBNUSD",
      chainId: "stellar" as const,
    },
  ]),
  requestBalancedSodaxQuote: vi.fn(async () => ({
    ok: true as const,
    provider: "sodax_sdk" as const,
    tokenIn: {
      symbol: "bnUSD",
      name: "Balanced Dollar",
      decimals: 7,
      address: "CBNUSD",
      chainId: "stellar" as const,
    },
    tokenOut: {
      symbol: "USDC",
      name: "USD Coin",
      decimals: 7,
      address: "CUSDC",
      chainId: "stellar" as const,
    },
    amountInBase: "10000000",
    quotedAmountBase: "9900000",
    quoteType: "exact_input" as const,
  })),
  requestBalancedSodaxIntentBuild: vi.fn(async () => ({
    ok: true as const,
    provider: "sodax_sdk" as const,
    tokenIn: {
      symbol: "bnUSD",
      name: "Balanced Dollar",
      decimals: 7,
      address: "CBNUSD",
      chainId: "stellar" as const,
    },
    tokenOut: {
      symbol: "USDC",
      name: "USD Coin",
      decimals: 7,
      address: "CUSDC",
      chainId: "stellar" as const,
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
      intentHash: "0xabc12345",
    },
    intentData: "0x",
    expiry: {
      deadlineUnixSeconds: "1893456000",
      expiresAt: "2030-01-01T00:00:00.000Z",
      expired: false,
      secondsUntilExpiry: 300,
      cancellationWindowSeconds: 300,
      source: "intent_deadline" as const,
      detail: "active",
    },
    refund: {
      refundMode: "cancel_intent" as const,
      refundRequired: false,
      refundAvailable: true,
      refundRecipient: "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
      cancelRequiresIntent: true,
      detail: "available",
    },
  })),
  requestBalancedSodaxSubmit: vi.fn(async () => ({
    ok: true as const,
    provider: "sodax_sdk" as const,
    intentTxHash: "0xabc12345",
    answer: "OK" as const,
    solverIntentHash: "0xsolver",
    detail: "accepted",
  })),
  requestBalancedSodaxRelaySubmit: vi.fn(async () => ({
    ok: true as const,
    provider: "sodax_sdk" as const,
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
    ok: true as const,
    provider: "sodax_sdk" as const,
    intentTxHash: "0xabc12345",
    statusCode: 1,
    statusLabel: "STARTED_NOT_FINISHED",
    fillTxHash: null,
    terminal: false,
  })),
  requestBalancedSodaxConfirm: vi.fn(async () => ({
    ok: true as const,
    provider: "sodax_sdk" as const,
    intentTxHash: "0xabc12345",
    statusCode: 3,
    statusLabel: "SOLVED",
    terminal: true,
    fillTxHash: "0xfill",
    confirmationTxHash: "0xfill",
    confirmed: true,
    confirmationState: "confirmed" as const,
    detail: "ok",
  })),
  requestBalancedSodaxReceipt: vi.fn(async () => ({
    ok: true as const,
    provider: "sodax_sdk" as const,
    receipt: {
      receiptState: "settled" as const,
      intentTxHash: "0xabc12345",
      statusLabel: "SOLVED",
      terminal: true,
      fillTxHash: "0xfill",
      confirmationTxHash: "0xfill",
      packet: null,
      detail: "settled",
    },
    refund: {
      refundMode: "none" as const,
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
      source: "unknown" as const,
      detail: "unknown",
    },
  })),
  requestBalancedSodaxExpiry: vi.fn(async () => ({
    ok: true as const,
    provider: "sodax_sdk" as const,
    intentTxHash: "0xabc12345",
    intent: null,
    expiry: {
      deadlineUnixSeconds: null,
      expiresAt: null,
      expired: false,
      secondsUntilExpiry: null,
      cancellationWindowSeconds: 0,
      source: "unknown" as const,
      detail: "unknown",
    },
  })),
  requestBalancedSodaxRefund: vi.fn(async () => ({
    ok: true as const,
    provider: "sodax_sdk" as const,
    sourceAccount: "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
    intentTxHash: "0xabc12345",
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
      intentHash: "0xabc12345",
    },
    refund: {
      refundMode: "cancel_intent" as const,
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
      source: "intent_deadline" as const,
      detail: "active",
    },
  })),
  requestBalancedSodaxLifecycle: vi.fn(async () => ({
    status: {
      ok: true as const,
      provider: "sodax_sdk" as const,
      intentTxHash: "0xabc12345",
      statusCode: 1,
      statusLabel: "STARTED_NOT_FINISHED",
      fillTxHash: null,
      terminal: false,
    },
    confirmation: {
      ok: true as const,
      provider: "sodax_sdk" as const,
      intentTxHash: "0xabc12345",
      statusCode: 1,
      statusLabel: "STARTED_NOT_FINISHED",
      terminal: false,
      fillTxHash: null,
      confirmationTxHash: null,
      confirmed: false,
      confirmationState: "pending" as const,
      detail: "pending",
    },
    receipt: null,
    refund: {
      refundMode: "cancel_intent" as const,
      refundRequired: false,
      refundAvailable: false,
      refundRecipient: null,
      cancelRequiresIntent: true,
      detail: "requires intent",
    },
    expiry: {
      deadlineUnixSeconds: null,
      expiresAt: null,
      expired: false,
      secondsUntilExpiry: null,
      cancellationWindowSeconds: 0,
      source: "unknown" as const,
      detail: "unknown",
    },
  })),
}));

vi.mock("@/lib/server/balancedSodax", () => mocks);

describe("balancedIntentSurface server service", () => {
  it("loads tokens from the SODAX-backed surface", async () => {
    await expect(listBalancedIntentSurfaceTokens()).resolves.toHaveLength(1);
    expect(mocks.listBalancedSodaxStellarTokens).toHaveBeenCalledTimes(1);
  });

  it("validates and forwards quote requests", async () => {
    const quote = await requestBalancedIntentSurfaceQuote({
      tokenIn: " CBNUSD ",
      tokenOut: " CUSDC ",
      amountInBase: "10000000",
    });

    expect(quote.ok).toBe(true);
    expect(mocks.requestBalancedSodaxQuote).toHaveBeenCalledWith({
      tokenIn: "CBNUSD",
      tokenOut: "CUSDC",
      amountInBase: "10000000",
    });
  });

  it("rejects invalid quote payloads with deterministic validation errors", async () => {
    await expect(
      requestBalancedIntentSurfaceQuote({
        tokenIn: "CBNUSD",
        tokenOut: "CUSDC",
        amountInBase: "0",
      }),
    ).rejects.toBeInstanceOf(BalancedIntentSurfaceValidationError);
  });

  it("validates and forwards SODAX intent build requests", async () => {
    const account = "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA";
    const result = await requestBalancedIntentSurfaceBuild({
      tokenIn: " CBNUSD ",
      tokenOut: " CUSDC ",
      amountInBase: "10000000",
      minOutputAmountBase: "9900000",
      sourceAccount: account,
      destinationAccount: account,
      deadlineSeconds: "300",
      allowPartialFill: false,
    });

    expect(result.ok).toBe(true);
    expect(mocks.requestBalancedSodaxIntentBuild).toHaveBeenCalledWith({
      tokenIn: "CBNUSD",
      tokenOut: "CUSDC",
      amountInBase: "10000000",
      minOutputAmountBase: "9900000",
      sourceAccount: account,
      destinationAccount: account,
      deadlineSeconds: 300,
      allowPartialFill: false,
    });
  });

  it("validates intent hash and forwards status/confirm requests", async () => {
    const status = await requestBalancedIntentSurfaceStatus({
      intentTxHash: " 0xabc12345 ",
    });
    const confirm = await requestBalancedIntentSurfaceConfirm({
      intentTxHash: "0xabc12345",
    });

    expect(status.ok).toBe(true);
    expect(confirm.ok).toBe(true);
    expect(mocks.requestBalancedSodaxStatus).toHaveBeenCalledWith("0xabc12345");
    expect(mocks.requestBalancedSodaxConfirm).toHaveBeenCalledWith("0xabc12345");
  });

  it("forwards relay, submit, receipt, expiry and refund lifecycle calls", async () => {
    const account = "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA";

    await expect(
      requestBalancedIntentSurfaceRelay({ sourceTxHash: "abcdef1234567890" }),
    ).resolves.toMatchObject({
      ok: true,
      relayChainId: "27",
      canonicalIntentTxHash: "0xrelaydst",
    });
    await expect(
      requestBalancedIntentSurfaceSubmit({ intentTxHash: "0xabc12345" }),
    ).resolves.toMatchObject({ ok: true });
    await expect(
      requestBalancedIntentSurfaceReceipt({
        intentTxHash: "0xabc12345",
        packetTimeoutMs: "2500",
      }),
    ).resolves.toMatchObject({ ok: true });
    await expect(
      requestBalancedIntentSurfaceExpiry({ intentTxHash: "0xabc12345" }),
    ).resolves.toMatchObject({ ok: true });
    await expect(
      requestBalancedIntentSurfaceRefund({
        sourceAccount: account,
        intentTxHash: "0xabc12345",
      }),
    ).resolves.toMatchObject({ ok: true });

    expect(mocks.requestBalancedSodaxRelaySubmit).toHaveBeenCalledWith({
      sourceTxHash: "abcdef1234567890",
    });
    expect(mocks.requestBalancedSodaxSubmit).toHaveBeenCalledWith({
      intentTxHash: "0xabc12345",
    });
    expect(mocks.requestBalancedSodaxReceipt).toHaveBeenCalledWith("0xabc12345", {
      packetTimeoutMs: 2500,
    });
    expect(mocks.requestBalancedSodaxExpiry).toHaveBeenCalledWith({
      intentTxHash: "0xabc12345",
    });
    expect(mocks.requestBalancedSodaxRefund).toHaveBeenCalledWith({
      sourceAccount: account,
      intentTxHash: "0xabc12345",
    });
  });

  it("returns lifecycle snapshots from a single status-derived call", async () => {
    const lifecycle = await requestBalancedIntentSurfaceLifecycle({
      intentTxHash: " 0xabc12345 ",
    });

    expect(lifecycle.status.ok).toBe(true);
    expect(lifecycle.confirmation.ok).toBe(true);
    expect(mocks.requestBalancedSodaxLifecycle).toHaveBeenCalledWith(
      "0xabc12345",
    );
  });

  it("rejects malformed intent hashes", async () => {
    await expect(
      requestBalancedIntentSurfaceStatus({
        intentTxHash: "not-a-hash",
      }),
    ).rejects.toBeInstanceOf(BalancedIntentSurfaceValidationError);
  });
});
