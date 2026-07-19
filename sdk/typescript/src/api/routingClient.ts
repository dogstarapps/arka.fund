export const ARKAFUND_ROUTING_MAINNET_URL = "https://app.arka.fund";

export type RoutingProtocol = "AUTO" | "SOROSWAP" | "AQUARIUS" | "PHOENIX" | "BALANCED";
export type ExecutableRoutingProtocol = Exclude<RoutingProtocol, "AUTO">;

export interface RoutingPlanRequest {
  requestedProtocol: RoutingProtocol;
  amountBase: number;
  tokenIn: string;
  tokenOut: string;
  slippagePct: number;
  manualMinOutBase?: number;
  configuredAquariusPoolIndex?: string;
  configuredPhoenixPool?: string;
  routingAssets?: string[];
  routingSearch?: {
    maxIntermediaries?: number;
    maxHops?: number;
    quoteBudget?: number;
    splitParts?: number;
    beamWidth?: number;
    tailProbeCount?: number;
  };
  vaultNavBase?: number;
  dailyTurnoverUsedBase?: number;
  projectedPostTradeDeviationBps?: number;
  requiredStatefulGuardrails?: Array<
    "post_trade_deviation_bps" | "daily_turnover_cap_bps"
  >;
  readerPubKey?: string;
  intentTxHash?: string;
}

export interface RoutingCandidate {
  routeId: string;
  protocol: ExecutableRoutingProtocol;
  title: string;
  estimatedOutBase: number;
  minOutBase: number;
  available: boolean;
  admitted: boolean;
  autoEligible: boolean;
  pathAssets: string[];
  hops: number;
  adapterId?: string;
  poolId?: number;
  note: string;
}

export interface RoutingSplitAllocation {
  routeId: string;
  protocol: Exclude<ExecutableRoutingProtocol, "BALANCED">;
  amountInBase: number;
  minOutBase: number;
  pathAssets: string[];
  adapterId?: string;
  poolId?: number;
}

export interface RoutingPlan {
  requestedProtocol: RoutingProtocol;
  selectedProtocol: ExecutableRoutingProtocol;
  selectedCandidate: RoutingCandidate | null;
  estimatedOutBase: number;
  minOutBase: number;
  note: string;
  candidates: RoutingCandidate[];
  splitRoute?: {
    status: "idle" | "not_applicable" | "single_route_optimal" | "recommended";
    executable: boolean;
    allocations: RoutingSplitAllocation[];
    note: string;
  };
  guardrails?: {
    status: "passed" | "blocked";
    blockedReasons: string[];
    checks: Array<{
      id: string;
      status: "passed" | "blocked" | "not_applicable" | "requires_state";
      detail: string;
    }>;
  };
  routeSearch?: Record<string, unknown>;
}

export interface RoutingPlanResponse {
  ok: true;
  source: "api_routing_solver";
  generatedAt: string;
  plan: RoutingPlan;
  balancedIntentLifecycle?: unknown;
}

export interface RoutingStatusResponse {
  ok: true;
  source: "api_routing_solver_status";
  generatedAt: string;
  routing: Record<string, unknown>;
  balancedIntentLifecycle?: unknown;
}

export interface RoutingClientOptions {
  baseUrl?: string;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
}

export class RoutingApiError extends Error {
  constructor(readonly status: number, readonly body: unknown) {
    super(`Arka routing request failed with HTTP ${status}`);
    this.name = "RoutingApiError";
  }
}

export class RoutingClient {
  private readonly baseUrl: string;
  private readonly fetchImpl: typeof fetch;
  private readonly timeoutMs: number;

  constructor(options: RoutingClientOptions = {}) {
    this.baseUrl = normalizeBaseUrl(options.baseUrl ?? ARKAFUND_ROUTING_MAINNET_URL);
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.timeoutMs = options.timeoutMs ?? 20_000;
  }

  async plan(request: RoutingPlanRequest): Promise<RoutingPlanResponse> {
    validateRoutingRequest(request);
    return this.request<RoutingPlanResponse>("/api/routing/rebalance/plan", {
      method: "POST",
      headers: { "content-type": "application/json", accept: "application/json" },
      body: JSON.stringify({ ...request, manualMinOutBase: request.manualMinOutBase ?? 0 }),
    });
  }

  status(intentTxHash?: string): Promise<RoutingStatusResponse> {
    const url = new URL("/api/routing/rebalance/status", `${this.baseUrl}/`);
    if (intentTxHash) url.searchParams.set("intentTxHash", intentTxHash);
    return this.request<RoutingStatusResponse>(`${url.pathname}${url.search}`, {
      method: "GET",
      headers: { accept: "application/json" },
    });
  }

  private async request<T>(path: string, init: RequestInit): Promise<T> {
    const response = await this.fetchImpl(new URL(path, `${this.baseUrl}/`), {
      ...init,
      signal: AbortSignal.timeout(this.timeoutMs),
    });
    const text = await response.text();
    const body = text ? safeJson(text) : null;
    if (!response.ok || !body || typeof body !== "object" || (body as { ok?: unknown }).ok !== true) {
      throw new RoutingApiError(response.status, body);
    }
    return body as T;
  }
}

function validateRoutingRequest(request: RoutingPlanRequest): void {
  for (const [name, value] of [
    ["amountBase", request.amountBase],
    ["manualMinOutBase", request.manualMinOutBase ?? 0],
  ] as const) {
    if (!Number.isSafeInteger(value) || value < 0) {
      throw new Error(`${name} must be a non-negative safe integer`);
    }
  }
  if (!request.tokenIn || !request.tokenOut || request.tokenIn === request.tokenOut) {
    throw new Error("tokenIn and tokenOut must identify different assets");
  }
  if (!Number.isFinite(request.slippagePct) || request.slippagePct < 0) {
    throw new Error("slippagePct must be a non-negative number");
  }
}

function normalizeBaseUrl(value: string): string {
  const url = new URL(value);
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw new Error("Routing baseUrl must use http or https");
  }
  return url.toString().replace(/\/$/, "");
}

function safeJson(value: string): unknown {
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}
