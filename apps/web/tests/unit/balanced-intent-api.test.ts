import { describe, expect, it, vi } from "vitest";
import {
  loadBalancedIntentTokenCatalog,
  requestBalancedIntentQuote,
  requestBalancedIntentStatus,
} from "@/lib/runtime/balancedIntentApi";

describe("balanced intent API helpers", () => {
  it("loads the SODAX token catalog", async () => {
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
        {
          status: 200,
          headers: { "content-type": "application/json" },
        },
      ),
    );

    await expect(loadBalancedIntentTokenCatalog(fetchMock as typeof fetch)).resolves.toMatchObject({
      provider: "sodax_sdk",
      chainId: "stellar",
      tokens: [{ symbol: "bnUSD", address: "CBNUSD" }],
    });
  });

  it("requests a quote and returns the structured result", async () => {
    const fetchMock = vi.fn(async () =>
      new Response(
        JSON.stringify({
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
        }),
        {
          status: 200,
          headers: { "content-type": "application/json" },
        },
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
    ).resolves.toMatchObject({
      ok: true,
      quotedAmountBase: "9985000",
    });
  });

  it("requests intent status and returns the structured result", async () => {
    const fetchMock = vi.fn(async () =>
      new Response(
        JSON.stringify({
          ok: true,
          provider: "sodax_sdk",
          intentTxHash: "0xintent",
          statusCode: 3,
          statusLabel: "SOLVED",
          fillTxHash: "0xfill",
          terminal: true,
        }),
        {
          status: 200,
          headers: { "content-type": "application/json" },
        },
      ),
    );

    await expect(
      requestBalancedIntentStatus(
        { intentTxHash: "0xintent" },
        fetchMock as typeof fetch,
      ),
    ).resolves.toMatchObject({
      ok: true,
      statusLabel: "SOLVED",
      fillTxHash: "0xfill",
    });
  });

  it("throws a readable error when the route fails", async () => {
    const fetchMock = vi.fn(async () =>
      new Response(JSON.stringify({ error: "upstream unavailable" }), {
        status: 502,
        headers: { "content-type": "application/json" },
      }),
    );

    await expect(
      loadBalancedIntentTokenCatalog(fetchMock as typeof fetch),
    ).rejects.toThrow("upstream unavailable");
  });
});
