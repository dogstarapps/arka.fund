import { describe, expect, it, vi } from "vitest";
import { readRebalanceBenchmarkSnapshot } from "@/lib/runtime/rebalanceBenchmarkApi";

describe("rebalanceBenchmarkApi", () => {
  it("reads the routing benchmark snapshot", async () => {
    const fetchMock = vi.fn(async () =>
      new Response(
        JSON.stringify({
          ok: true,
          source: "routing_benchmark",
          generatedAt: "2026-05-05T08:00:00.000Z",
          benchmark: {
            overallPassed: true,
            resultCount: 1,
            passedCount: 1,
            worstEfficiencyBps: 10_000,
            results: [],
          },
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      ),
    );

    const snapshot = await readRebalanceBenchmarkSnapshot(fetchMock as typeof fetch);

    expect(snapshot.ok).toBe(true);
    expect(snapshot.source).toBe("routing_benchmark");
    expect(snapshot.benchmark.overallPassed).toBe(true);
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/routing/rebalance/benchmark",
      expect.objectContaining({
        method: "GET",
      }),
    );
  });

  it("throws benchmark API errors", async () => {
    const fetchMock = vi.fn(async () =>
      new Response(
        JSON.stringify({
          ok: false,
          source: "routing_benchmark",
          error: "benchmark failed",
        }),
        { status: 500, headers: { "content-type": "application/json" } },
      ),
    );

    await expect(
      readRebalanceBenchmarkSnapshot(fetchMock as typeof fetch),
    ).rejects.toThrow("benchmark failed");
  });
});
