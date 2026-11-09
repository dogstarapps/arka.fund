import { describe, expect, it, vi } from "vitest";
import {
  loadBalancedIntentTokenCatalog,
  requestBalancedIntentBuild,
  requestBalancedIntentQuote,
  requestBalancedIntentConfirm,
  requestBalancedIntentRelay,
  requestBalancedIntentReceipt,
  requestBalancedIntentRefund,
  requestBalancedIntentStatus,
  requestBalancedIntentSubmit,
} from "@/lib/runtime/balancedIntentApi";

describe("balancedIntentApi runtime client", () => {
  it("loads the Stellar token catalog from the public quote surface", async () => {
    const fetchMock = vi.fn(async () =>
      new Response(
        JSON.stringify({
          provider: "sodax_sdk",
          chainId: "stellar",
          tokens: [
            {
              symbol: "bnUSD",
              name: "Balanced Dollar",
              decimals: 7,
              address: "CBNUSD",
              chainId: "stellar",
            },
          ],
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      ),
    );

    const payload = await loadBalancedIntentTokenCatalog(
      fetchMock as typeof fetch,
    );

    expect(payload.provider).toBe("sodax_sdk");
    expect(payload.tokens).toHaveLength(1);
    expect(payload.tokens[0]).toMatchObject({
      symbol: "bnUSD",
      chainId: "stellar",
    });
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/intents/balanced/quote",
      expect.objectContaining({
        method: "GET",
        cache: "no-store",
      }),
    );
  });

  it("keeps quote route errors explicit for retryable UI states", async () => {
    const fetchMock = vi.fn(async () =>
      new Response(
        JSON.stringify({
          provider: "sodax_sdk",
          error: "SODAX quote unavailable.",
        }),
        { status: 503, headers: { "content-type": "application/json" } },
      ),
    );

    await expect(
      requestBalancedIntentQuote(
        {
          tokenIn: "CBNUSD",
          tokenOut: "CUSDC",
          amountInBase: "10000000",
        },
        fetchMock as typeof fetch,
      ),
    ).rejects.toThrow("SODAX quote unavailable.");
  });

  it("requests confirmation payload from the public confirm surface", async () => {
    const fetchMock = vi.fn(async () =>
      new Response(
        JSON.stringify({
          ok: true,
          provider: "sodax_sdk",
          intentTxHash: "0xintent",
          statusCode: 3,
          statusLabel: "SOLVED",
          terminal: true,
          fillTxHash: "0xfill",
          confirmationTxHash: "0xfill",
          confirmed: true,
          confirmationState: "confirmed",
          detail: "Intent solved and settlement hash confirmed from SODAX status.",
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      ),
    );

    const payload = await requestBalancedIntentConfirm(
      { intentTxHash: "0xintent" },
      fetchMock as typeof fetch,
    );

    expect(payload.ok).toBe(true);
    if (payload.ok) {
      expect(payload.confirmationState).toBe("confirmed");
      expect(payload.confirmationTxHash).toBe("0xfill");
    }
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/intents/balanced/confirm",
      expect.objectContaining({
        method: "POST",
      }),
    );
  });

  it("surfaces route error payloads for confirm requests", async () => {
    const fetchMock = vi.fn(async () =>
      new Response(
        JSON.stringify({
          provider: "sodax_sdk",
          error: "intentTxHash is required.",
        }),
        { status: 400, headers: { "content-type": "application/json" } },
      ),
    );

    await expect(
      requestBalancedIntentConfirm(
        { intentTxHash: "" },
        fetchMock as typeof fetch,
      ),
    ).rejects.toThrow("intentTxHash is required.");
  });

  it("keeps status endpoint contract unchanged", async () => {
    const fetchMock = vi.fn(async () =>
      new Response(
        JSON.stringify({
          ok: true,
          provider: "sodax_sdk",
          intentTxHash: "0xintent",
          statusCode: 1,
          statusLabel: "NOT_STARTED_YET",
          fillTxHash: null,
          terminal: false,
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      ),
    );

    const payload = await requestBalancedIntentStatus(
      { intentTxHash: "0xintent" },
      fetchMock as typeof fetch,
    );

    expect(payload.ok).toBe(true);
    if (payload.ok) {
      expect(payload.statusLabel).toBe("NOT_STARTED_YET");
      expect(payload.terminal).toBe(false);
    }
  });

  it("posts build, relay, submit, receipt and refund lifecycle requests to their routes", async () => {
    const fetchMock = vi.fn(async (url: string) =>
      new Response(
        JSON.stringify(
          url.endsWith("/build")
            ? {
                ok: true,
                provider: "sodax_sdk",
                rawTransaction: { from: "G", to: "C", valueBase: "0", xdr: "AAAA" },
              }
            : url.endsWith("/submit")
              ? {
                  ok: true,
                  provider: "sodax_sdk",
                  intentTxHash: "0xintent",
                  answer: "OK",
                  solverIntentHash: "0xsolver",
                  detail: "accepted",
                }
              : url.endsWith("/relay")
                ? {
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
                  }
              : url.endsWith("/receipt")
                ? {
                    ok: true,
                    provider: "sodax_sdk",
                    receipt: { receiptState: "settled", intentTxHash: "0xintent" },
                    refund: { refundMode: "none" },
                    expiry: { source: "unknown" },
                  }
                : {
                    ok: true,
                    provider: "sodax_sdk",
                    sourceAccount: "G",
                    intentTxHash: "0xintent",
                    rawTransaction: { from: "G", to: "C", valueBase: "0", xdr: "BBBB" },
                  },
        ),
        { status: 200, headers: { "content-type": "application/json" } },
      ),
    );

    await expect(
      requestBalancedIntentBuild(
        {
          tokenIn: "CBNUSD",
          tokenOut: "CUSDC",
          amountInBase: "10000000",
          minOutputAmountBase: "9900000",
          sourceAccount: "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
          destinationAccount: "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
        },
        fetchMock as unknown as typeof fetch,
      ),
    ).resolves.toMatchObject({ ok: true });
    await expect(
      requestBalancedIntentRelay(
        { sourceTxHash: "abcdef1234567890" },
        fetchMock as unknown as typeof fetch,
      ),
    ).resolves.toMatchObject({
      ok: true,
      relayChainId: "27",
      canonicalIntentTxHash: "0xrelaydst",
    });
    await expect(
      requestBalancedIntentSubmit(
        { intentTxHash: "0xintent" },
        fetchMock as unknown as typeof fetch,
      ),
    ).resolves.toMatchObject({ ok: true, solverIntentHash: "0xsolver" });
    await expect(
      requestBalancedIntentReceipt(
        { intentTxHash: "0xintent" },
        fetchMock as unknown as typeof fetch,
      ),
    ).resolves.toMatchObject({ ok: true });
    await expect(
      requestBalancedIntentRefund(
        {
          sourceAccount: "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
          intentTxHash: "0xintent",
        },
        fetchMock as unknown as typeof fetch,
      ),
    ).resolves.toMatchObject({ ok: true });

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/intents/balanced/build",
      expect.objectContaining({ method: "POST" }),
    );
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/intents/balanced/relay",
      expect.objectContaining({ method: "POST" }),
    );
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/intents/balanced/submit",
      expect.objectContaining({ method: "POST" }),
    );
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/intents/balanced/receipt",
      expect.objectContaining({ method: "POST" }),
    );
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/intents/balanced/refund",
      expect.objectContaining({ method: "POST" }),
    );
  });
});
