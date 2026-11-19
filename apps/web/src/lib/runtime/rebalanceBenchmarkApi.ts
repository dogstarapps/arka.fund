import type { RebalanceBenchmarkReport } from "@/lib/workflows/rebalanceBenchmark";
import type { RebalanceCanaryGateSnapshot } from "@/lib/runtime/rebalanceCanaryGate";

export type RebalanceBenchmarkResponse = {
  ok: true;
  source: "routing_benchmark";
  generatedAt: string;
  targetNetwork?: "testnet" | "mainnet";
  benchmark: RebalanceBenchmarkReport;
  routingCanary?: RebalanceCanaryGateSnapshot;
};

type RebalanceBenchmarkFailure = {
  ok: false;
  source: "routing_benchmark";
  error: string;
};

type FetchLike = typeof fetch;

function isBenchmarkResponse(
  body: unknown,
): body is RebalanceBenchmarkResponse {
  if (!body || typeof body !== "object") return false;
  const record = body as Record<string, unknown>;
  return (
    record.ok === true &&
    record.source === "routing_benchmark" &&
    typeof record.generatedAt === "string" &&
    Boolean(record.benchmark)
  );
}

export async function readRebalanceBenchmarkSnapshot(
  fetchImpl: FetchLike = fetch,
): Promise<RebalanceBenchmarkResponse> {
  const response = await fetchImpl("/api/routing/rebalance/benchmark", {
    method: "GET",
    headers: { accept: "application/json" },
  });
  const body = (await response.json().catch(() => null)) as
    | RebalanceBenchmarkResponse
    | RebalanceBenchmarkFailure
    | { error?: string }
    | null;

  if (!response.ok) {
    throw new Error(
      body &&
        typeof body === "object" &&
        "error" in body &&
        typeof body.error === "string"
        ? body.error
        : "Failed to read rebalance benchmark snapshot.",
    );
  }

  if (!isBenchmarkResponse(body)) {
    throw new Error("Invalid rebalance benchmark response.");
  }

  return body;
}
