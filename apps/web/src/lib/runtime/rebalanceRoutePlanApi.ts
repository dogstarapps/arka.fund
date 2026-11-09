import type {
  RebalanceGuardrailId,
  RebalanceProtocol,
  RebalanceRoutePlan,
  RebalanceRouteSearchConfig,
} from "@/lib/workflows/rebalanceRouting";

export type RebalanceRoutePlanRequest = {
  requestedProtocol: RebalanceProtocol;
  fundId?: string;
  amountBase: number;
  tokenIn: string;
  tokenOut: string;
  slippagePct: number;
  manualMinOutBase: number;
  configuredAquariusPoolIndex?: string;
  configuredPhoenixPool?: string;
  routingAssets?: string[];
  routingSearch?: RebalanceRouteSearchConfig;
  vaultNavBase?: number;
  dailyTurnoverUsedBase?: number;
  projectedPostTradeDeviationBps?: number;
  requiredStatefulGuardrails?: RebalanceGuardrailId[];
  readerPubKey?: string;
};

export type RebalanceRoutePlanResponse = {
  ok: true;
  source: "api_routing_solver";
  generatedAt: string;
  plan: RebalanceRoutePlan;
};

type RebalanceRoutePlanFailure = {
  ok: false;
  source: "api_routing_solver";
  error: string;
};

type FetchLike = typeof fetch;

export async function requestRebalanceRoutePlan(
  payload: RebalanceRoutePlanRequest,
  fetchImpl: FetchLike = fetch,
): Promise<RebalanceRoutePlanResponse> {
  const response = await fetchImpl("/api/routing/rebalance/plan", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  });
  const body = (await response.json().catch(() => null)) as
    | RebalanceRoutePlanResponse
    | RebalanceRoutePlanFailure
    | { error?: string }
    | null;

  if (!response.ok) {
    throw new Error(
      body && typeof body === "object" && "error" in body && typeof body.error === "string"
        ? body.error
        : "Failed to resolve rebalance route plan.",
    );
  }

  if (!body || typeof body !== "object") {
    throw new Error("Invalid rebalance route response.");
  }
  const bodyRecord = body as Record<string, unknown>;
  if (bodyRecord.ok !== true || !("plan" in bodyRecord)) {
    throw new Error("Invalid rebalance route response.");
  }

  return body as RebalanceRoutePlanResponse;
}
