import { describe, expect, it, vi } from "vitest";
import { requestRebalanceRoutePlan } from "@/lib/runtime/rebalanceRoutePlanApi";

describe("rebalanceRoutePlanApi", () => {
  it("returns solved route plans from the backend solver surface", async () => {
    const fetchMock = vi.fn<typeof fetch>(async () =>
      new Response(
        JSON.stringify({
          ok: true,
          source: "api_routing_solver",
          generatedAt: "2026-04-16T12:00:00.000Z",
          plan: {
            requestedProtocol: "AUTO",
            selectedProtocol: "AQUARIUS",
            selectedCandidate: null,
            estimatedOutBase: 0,
            minOutBase: 0,
            note: "ok",
            candidates: [],
          },
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      ),
    );

    const payload = await requestRebalanceRoutePlan(
      {
        requestedProtocol: "AUTO",
        amountBase: 10_000_000,
        tokenIn: "CAAA",
        tokenOut: "CBBB",
        slippagePct: 1,
        manualMinOutBase: 0,
        routingSearch: {
          maxIntermediaries: 24,
          maxHops: 6,
          quoteBudget: 384,
          splitParts: 8,
        },
        requiredStatefulGuardrails: [
          "post_trade_deviation_bps",
          "daily_turnover_cap_bps",
        ],
      },
      fetchMock as typeof fetch,
    );

    expect(payload.ok).toBe(true);
    expect(payload.source).toBe("api_routing_solver");
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/routing/rebalance/plan",
      expect.objectContaining({
        method: "POST",
      }),
    );
    const [, requestInit] = fetchMock.mock.calls[0] ?? [];
    const requestBody = JSON.parse((requestInit as RequestInit).body as string);
    expect(requestBody.routingSearch).toEqual({
      maxIntermediaries: 24,
      maxHops: 6,
      quoteBudget: 384,
      splitParts: 8,
    });
    expect(requestBody.requiredStatefulGuardrails).toEqual([
      "post_trade_deviation_bps",
      "daily_turnover_cap_bps",
    ]);
  });

  it("throws route errors from the backend solver surface", async () => {
    const fetchMock = vi.fn<typeof fetch>(async () =>
      new Response(
        JSON.stringify({
          ok: false,
          source: "api_routing_solver",
          error: "solver failed",
        }),
        { status: 500, headers: { "content-type": "application/json" } },
      ),
    );

    await expect(
      requestRebalanceRoutePlan(
        {
          requestedProtocol: "AUTO",
          amountBase: 10_000_000,
          tokenIn: "CAAA",
          tokenOut: "CBBB",
          slippagePct: 1,
          manualMinOutBase: 0,
        },
        fetchMock as typeof fetch,
      ),
    ).rejects.toThrow("solver failed");
  });
});
