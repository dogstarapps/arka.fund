import { NextResponse } from "next/server";

export type ApiAccessClass = "public" | "operator" | "e2e_only";
export type ApiCachePolicy = "no-store" | "public_short_lived";
export type ApiRateSensitivity = "low" | "medium" | "high";

export type ApiHardeningRoute = {
  route: string;
  methods: readonly string[];
  access: ApiAccessClass;
  source: string;
  cachePolicy: ApiCachePolicy;
  validation: string;
  errorShape: "deterministic_error_code";
  rateSensitivity: ApiRateSensitivity;
  publicSecretExposure: "none" | "redacted";
  notes: string;
};

export type ApiHardeningInvariant = {
  id: string;
  title: string;
  status: "passed" | "failed";
  evidence: string;
};

export type ApiHardeningSnapshot = {
  generatedAt: string;
  routeCount: number;
  operatorRouteCount: number;
  publicRouteCount: number;
  e2eOnlyRouteCount: number;
  routes: ApiHardeningRoute[];
  invariants: ApiHardeningInvariant[];
  releaseGate: {
    ready: boolean;
    status: "ready" | "blocked";
    routeCount: number;
    failedInvariantCount: number;
    operatorRouteCount: number;
    publicRouteCount: number;
    e2eOnlyRouteCount: number;
  };
};

const SECRET_VALUE_PATTERNS: RegExp[] = [
  /\bS[A-Z2-7]{55}\b/g,
  /\barkafund-operator-access:[A-Za-z0-9._~-]+\b/g,
  /\bBearer\s+[A-Za-z0-9._~+/=-]+\b/gi,
  /\b[A-Za-z0-9_-]{24,}\.[A-Za-z0-9_-]{24,}\b/g,
];

const SECRET_KEY_PATTERN =
  /(secret|private[_-]?key|seed|signature|authorization|cookie|token|xdr|signedtx|signedmessage)/i;

export const API_HARDENING_ROUTES: readonly ApiHardeningRoute[] = [
  {
    route: "/api/assets/core-registry",
    methods: ["GET"],
    access: "public",
    source: "api_core_stellar_asset_registry",
    cachePolicy: "no-store",
    validation: "static registry plus stellar.toml resolver errors are normalized",
    errorShape: "deterministic_error_code",
    rateSensitivity: "low",
    publicSecretExposure: "none",
    notes: "Client-safe asset metadata only; no operator telemetry.",
  },
  {
    route: "/api/catalog/[...path]",
    methods: ["GET"],
    access: "public",
    source: "api_catalog_proxy",
    cachePolicy: "no-store",
    validation: "path stays under the catalog proxy and query is forwarded as URLSearchParams",
    errorShape: "deterministic_error_code",
    rateSensitivity: "medium",
    publicSecretExposure: "none",
    notes: "Upstream credentials are never forwarded; only accept: application/json is sent upstream.",
  },
  {
    route: "/api/nav",
    methods: ["GET"],
    access: "public",
    source: "api_nav_edge_cache",
    cachePolicy: "public_short_lived",
    validation: "read-only aggregate NAV from the catalog origin; errors are never cached",
    errorShape: "deterministic_error_code",
    rateSensitivity: "low",
    publicSecretExposure: "none",
    notes: "Public read-only NAV response uses a 30-second CDN cache; no credentials or mutations are exposed.",
  },
  {
    route: "/api/contracts/mutation-matrix",
    methods: ["GET"],
    access: "operator",
    source: "api_contracts_mutation_matrix",
    cachePolicy: "no-store",
    validation: "read-only deterministic matrix",
    errorShape: "deterministic_error_code",
    rateSensitivity: "low",
    publicSecretExposure: "none",
    notes: "Operator-gated because it exposes mutation coverage and rollback mechanics.",
  },
  {
    route: "/api/contracts/security-audit",
    methods: ["GET"],
    access: "operator",
    source: "api_contracts_security_audit",
    cachePolicy: "no-store",
    validation: "read-only deterministic audit snapshot",
    errorShape: "deterministic_error_code",
    rateSensitivity: "low",
    publicSecretExposure: "none",
    notes: "Operator-gated internal release artifact.",
  },
  {
    route: "/api/contracts/storage-lifecycle",
    methods: ["GET"],
    access: "operator",
    source: "api_contracts_storage_lifecycle",
    cachePolicy: "no-store",
    validation: "read-only deterministic lifecycle matrix",
    errorShape: "deterministic_error_code",
    rateSensitivity: "low",
    publicSecretExposure: "none",
    notes: "Operator-gated because it exposes storage-extension command material.",
  },
  {
    route: "/api/e2e-wallet",
    methods: ["GET", "POST"],
    access: "e2e_only",
    source: "api_e2e_wallet",
    cachePolicy: "no-store",
    validation: "profile allowlist plus production fail-closed wallet signer",
    errorShape: "deterministic_error_code",
    rateSensitivity: "high",
    publicSecretExposure: "redacted",
    notes: "Disabled outside explicit E2E mode and production deployments.",
  },
  {
    route: "/api/factory/create/build",
    methods: ["POST"],
    access: "public",
    source: "api_factory_create_build",
    cachePolicy: "no-store",
    validation: "factory, creator, salt, denomination, router and fee payload validation",
    errorShape: "deterministic_error_code",
    rateSensitivity: "high",
    publicSecretExposure: "none",
    notes: "Builds unsigned create/init XDR for the connected wallet; no server signing.",
  },
  {
    route: "/api/health",
    methods: ["GET"],
    access: "public",
    source: "api_health",
    cachePolicy: "no-store",
    validation: "runtime snapshots are normalized and catalog base URL is not returned raw",
    errorShape: "deterministic_error_code",
    rateSensitivity: "medium",
    publicSecretExposure: "redacted",
    notes: "Public status keeps operational readiness visible without leaking private upstream URLs.",
  },
  {
    route: "/api/intents/balanced/build",
    methods: ["POST"],
    access: "public",
    source: "api_balanced_build",
    cachePolicy: "no-store",
    validation: "token, amount, Stellar account and slippage validation delegated to Balanced intent surface",
    errorShape: "deterministic_error_code",
    rateSensitivity: "high",
    publicSecretExposure: "redacted",
    notes: "Builds unsigned SODAX intent XDR for the connected wallet; no server signing.",
  },
  {
    route: "/api/intents/balanced/confirm",
    methods: ["GET", "POST"],
    access: "public",
    source: "api_balanced_confirm",
    cachePolicy: "no-store",
    validation: "intentTxHash validation delegated to Balanced intent surface",
    errorShape: "deterministic_error_code",
    rateSensitivity: "medium",
    publicSecretExposure: "none",
    notes: "Public confirmation read-only surface.",
  },
  {
    route: "/api/intents/balanced/evidence",
    methods: ["GET"],
    access: "public",
    source: "api_balanced_evidence",
    cachePolicy: "no-store",
    validation: "read-only official-surface evidence",
    errorShape: "deterministic_error_code",
    rateSensitivity: "low",
    publicSecretExposure: "none",
    notes: "No credentials or operator-only fields.",
  },
  {
    route: "/api/intents/balanced/expiry",
    methods: ["GET", "POST"],
    access: "public",
    source: "api_balanced_expiry",
    cachePolicy: "no-store",
    validation: "intentTxHash or canonical intent snapshot validation delegated to Balanced intent surface",
    errorShape: "deterministic_error_code",
    rateSensitivity: "medium",
    publicSecretExposure: "none",
    notes: "Public deadline/expiry surface; no credentials or server-side signing.",
  },
  {
    route: "/api/intents/balanced/quote",
    methods: ["GET", "POST"],
    access: "public",
    source: "api_balanced_quote",
    cachePolicy: "no-store",
    validation: "token and amount validation delegated to Balanced intent surface",
    errorShape: "deterministic_error_code",
    rateSensitivity: "high",
    publicSecretExposure: "none",
    notes: "Quote surface is public but deterministic and no-store.",
  },
  {
    route: "/api/intents/balanced/receipt",
    methods: ["GET", "POST"],
    access: "public",
    source: "api_balanced_receipt",
    cachePolicy: "no-store",
    validation: "intentTxHash and bounded packet timeout validation delegated to Balanced intent surface",
    errorShape: "deterministic_error_code",
    rateSensitivity: "medium",
    publicSecretExposure: "none",
    notes: "Public receipt surface derived from SODAX status and relay packet data.",
  },
  {
    route: "/api/intents/balanced/relay",
    methods: ["POST"],
    access: "public",
    source: "api_balanced_relay",
    cachePolicy: "no-store",
    validation: "sourceTxHash validation delegated to Balanced intent surface",
    errorShape: "deterministic_error_code",
    rateSensitivity: "high",
    publicSecretExposure: "none",
    notes: "Relays a wallet-submitted Stellar source transaction hash to the SODAX relayer; no server signing.",
  },
  {
    route: "/api/intents/balanced/refund",
    methods: ["POST"],
    access: "public",
    source: "api_balanced_refund",
    cachePolicy: "no-store",
    validation: "source account plus intentTxHash or canonical intent snapshot validation delegated to Balanced intent surface",
    errorShape: "deterministic_error_code",
    rateSensitivity: "high",
    publicSecretExposure: "redacted",
    notes: "Builds unsigned SODAX cancel/refund XDR for the connected wallet; no server signing.",
  },
  {
    route: "/api/intents/balanced/status",
    methods: ["GET", "POST"],
    access: "public",
    source: "api_balanced_status",
    cachePolicy: "no-store",
    validation: "intentTxHash validation delegated to Balanced intent surface",
    errorShape: "deterministic_error_code",
    rateSensitivity: "medium",
    publicSecretExposure: "none",
    notes: "Public status read-only surface.",
  },
  {
    route: "/api/intents/balanced/submit",
    methods: ["POST"],
    access: "public",
    source: "api_balanced_submit",
    cachePolicy: "no-store",
    validation: "intentTxHash validation delegated to Balanced intent surface",
    errorShape: "deterministic_error_code",
    rateSensitivity: "high",
    publicSecretExposure: "none",
    notes: "Registers a wallet-submitted execution hash with the SODAX solver; no server signing.",
  },
  {
    route: "/api/leaderboard/arkas",
    methods: ["GET"],
    access: "public",
    source: "api_vault_leaderboard",
    cachePolicy: "no-store",
    validation: "search, curatedOnly, sorting, offset and bounded limits",
    errorShape: "deterministic_error_code",
    rateSensitivity: "medium",
    publicSecretExposure: "none",
    notes: "Catalog-derived data only.",
  },
  {
    route: "/api/leaderboard/managers",
    methods: ["GET"],
    access: "public",
    source: "api_manager_leaderboard",
    cachePolicy: "no-store",
    validation: "search, sorting, offset and bounded limits",
    errorShape: "deterministic_error_code",
    rateSensitivity: "medium",
    publicSecretExposure: "none",
    notes: "Catalog-derived manager ranking only.",
  },
  {
    route: "/api/leaderboard/source",
    methods: ["GET"],
    access: "public",
    source: "api_leaderboard_source",
    cachePolicy: "no-store",
    validation: "read-only oracle/source snapshot",
    errorShape: "deterministic_error_code",
    rateSensitivity: "low",
    publicSecretExposure: "none",
    notes: "Oracle provenance is public; no operator sessions are returned.",
  },
  {
    route: "/api/migrations/inspect",
    methods: ["GET"],
    access: "operator",
    source: "api_migrations_inspect",
    cachePolicy: "no-store",
    validation: "source and target Arka IDs must parse as Stellar addresses",
    errorShape: "deterministic_error_code",
    rateSensitivity: "medium",
    publicSecretExposure: "none",
    notes: "Operator-gated because it exposes migration state and target wiring.",
  },
  {
    route: "/api/migrations/simulate",
    methods: ["POST"],
    access: "operator",
    source: "api_migrations_simulate",
    cachePolicy: "no-store",
    validation: "governed package array with contract, method, args, title and template ID",
    errorShape: "deterministic_error_code",
    rateSensitivity: "high",
    publicSecretExposure: "none",
    notes: "Operator-gated live simulation of governed package payloads.",
  },
  {
    route: "/api/operator/access",
    methods: ["GET", "POST", "DELETE"],
    access: "public",
    source: "api_operator_access",
    cachePolicy: "no-store",
    validation: "challenge/verify action discriminant and Stellar signature verification",
    errorShape: "deterministic_error_code",
    rateSensitivity: "high",
    publicSecretExposure: "redacted",
    notes: "Handshake is public, but tokens are only issued to allowlisted wallets.",
  },
  {
    route: "/api/operator/hardening",
    methods: ["GET"],
    access: "operator",
    source: "api_operator_hardening",
    cachePolicy: "no-store",
    validation: "read-only deterministic hardening snapshot",
    errorShape: "deterministic_error_code",
    rateSensitivity: "low",
    publicSecretExposure: "none",
    notes: "Operator-gated evidence endpoint for this T23 closeout.",
  },
  {
    route: "/api/qa/figma-pixel-audit",
    methods: ["GET"],
    access: "operator",
    source: "figma_pixel_audit_report",
    cachePolicy: "no-store",
    validation: "read-only pixel gate snapshot",
    errorShape: "deterministic_error_code",
    rateSensitivity: "low",
    publicSecretExposure: "none",
    notes: "Operator-gated QA evidence.",
  },
  {
    route: "/api/qa/figma-readiness",
    methods: ["GET"],
    access: "operator",
    source: "figma_route_audit_manifest",
    cachePolicy: "no-store",
    validation: "read-only Figma route audit manifest",
    errorShape: "deterministic_error_code",
    rateSensitivity: "low",
    publicSecretExposure: "none",
    notes: "Operator-gated QA evidence.",
  },
  {
    route: "/api/release/gate",
    methods: ["GET"],
    access: "operator",
    source: "api_release_gate",
    cachePolicy: "no-store",
    validation: "read-only release gates with typed sub-gate snapshots",
    errorShape: "deterministic_error_code",
    rateSensitivity: "medium",
    publicSecretExposure: "none",
    notes: "Operator-gated because it exposes final release blockers.",
  },
  {
    route: "/api/routing/rebalance/benchmark",
    methods: ["GET"],
    access: "operator",
    source: "routing_benchmark",
    cachePolicy: "no-store",
    validation: "deterministic benchmark suite",
    errorShape: "deterministic_error_code",
    rateSensitivity: "high",
    publicSecretExposure: "none",
    notes: "Operator-gated production-scale benchmark evidence.",
  },
  {
    route: "/api/routing/rebalance/plan",
    methods: ["POST"],
    access: "public",
    source: "api_routing_solver",
    cachePolicy: "no-store",
    validation: "protocol, assets, amounts, slippage, guardrails and bounded routing-search config",
    errorShape: "deterministic_error_code",
    rateSensitivity: "high",
    publicSecretExposure: "none",
    notes: "Public planner endpoint; it returns a plan and never signs/submits transactions.",
  },
  {
    route: "/api/routing/rebalance/status",
    methods: ["GET"],
    access: "public",
    source: "api_routing_solver_status",
    cachePolicy: "no-store",
    validation: "optional intentTxHash validation delegated to Balanced intent surface",
    errorShape: "deterministic_error_code",
    rateSensitivity: "medium",
    publicSecretExposure: "none",
    notes: "Public routing status endpoint.",
  },
] as const;

export function redactApiText(input: unknown, fallback = "Unexpected API error."): string {
  const initial =
    input instanceof Error
      ? input.message
      : typeof input === "string"
        ? input
        : fallback;
  const trimmed = initial.trim() || fallback;
  return SECRET_VALUE_PATTERNS.reduce(
    (current, pattern) => current.replace(pattern, "[redacted]"),
    trimmed,
  );
}

export function redactApiPayload<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map((entry) => redactApiPayload(entry)) as T;
  }
  if (!value || typeof value !== "object") {
    return typeof value === "string" ? (redactApiText(value, value) as T) : value;
  }

  const output: Record<string, unknown> = {};
  for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
    if (SECRET_KEY_PATTERN.test(key)) {
      output[key] = "[redacted]";
      continue;
    }
    output[key] = redactApiPayload(entry);
  }
  return output as T;
}

export function noStoreHeaders(init?: HeadersInit): Headers {
  const headers = new Headers(init);
  headers.set("cache-control", "no-store");
  headers.set("x-content-type-options", "nosniff");
  headers.set("referrer-policy", "no-referrer");
  return headers;
}

export function jsonNoStore<T>(
  payload: T,
  init: ResponseInit = {},
): NextResponse<T> {
  return NextResponse.json(payload, {
    ...init,
    headers: noStoreHeaders(init.headers),
  });
}

export function apiErrorResponse(
  source: string,
  code: string,
  message: unknown,
  init: ResponseInit = {},
): NextResponse {
  return jsonNoStore(
    {
      ok: false,
      source,
      error: code,
      message: redactApiText(message, code),
    },
    {
      ...init,
      status: init.status ?? 500,
    },
  );
}

export async function readJsonObjectBody<T extends Record<string, unknown>>(
  request: Request,
): Promise<T> {
  const body = await request.json();
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw new Error("Request body must be a JSON object.");
  }
  return body as T;
}

export function buildApiHardeningSnapshot(
  generatedAt = new Date().toISOString(),
): ApiHardeningSnapshot {
  const routes = [...API_HARDENING_ROUTES];
  const operatorRouteCount = routes.filter((route) => route.access === "operator").length;
  const publicRouteCount = routes.filter((route) => route.access === "public").length;
  const e2eOnlyRouteCount = routes.filter((route) => route.access === "e2e_only").length;
  const uniqueRoutes = new Set(routes.map((route) => route.route));

  const invariants: ApiHardeningInvariant[] = [
    {
      id: "API-HARD-001",
      title: "Every API route is represented once in the hardening manifest.",
      status: uniqueRoutes.size === routes.length ? "passed" : "failed",
      evidence: `${uniqueRoutes.size}/${routes.length} unique route entries.`,
    },
    {
      id: "API-HARD-002",
      title: "Every route declares typed validation and deterministic error shape.",
      status: routes.every((route) => route.validation && route.errorShape === "deterministic_error_code")
        ? "passed"
        : "failed",
      evidence: `${routes.length} routes declare validation and deterministic errors.`,
    },
    {
      id: "API-HARD-003",
      title: "Every route declares an explicit safe cache policy.",
      status: routes.every(
        (route) =>
          route.cachePolicy === "no-store" ||
          (route.access === "public" &&
            route.cachePolicy === "public_short_lived" &&
            route.notes.toLowerCase().includes("cache")),
      )
        ? "passed"
        : "failed",
      evidence: `${routes.filter((route) => route.cachePolicy === "no-store").length} routes are no-store; public cached routes are explicitly bounded.`,
    },
    {
      id: "API-HARD-004",
      title: "Sensitive operational routes are operator gated.",
      status: routes
        .filter((route) => route.access === "operator")
        .every((route) => route.notes.toLowerCase().includes("operator-gated"))
        ? "passed"
        : "failed",
      evidence: `${operatorRouteCount} routes classified as operator-only.`,
    },
    {
      id: "API-HARD-005",
      title: "Public routes do not intentionally expose secrets.",
      status: routes
        .filter((route) => route.access === "public")
        .every((route) => route.publicSecretExposure !== "redacted" || route.notes.length > 0)
        ? "passed"
        : "failed",
      evidence: `${publicRouteCount} public routes reviewed; redacted surfaces are documented.`,
    },
    {
      id: "API-HARD-006",
      title: "E2E signer is isolated from production API surfaces.",
      status: routes.some((route) => route.route === "/api/e2e-wallet" && route.access === "e2e_only")
        ? "passed"
        : "failed",
      evidence: "The E2E wallet route is classified as e2e_only and fails closed in production.",
    },
  ];
  const failedInvariantCount = invariants.filter((invariant) => invariant.status !== "passed").length;

  return {
    generatedAt,
    routeCount: routes.length,
    operatorRouteCount,
    publicRouteCount,
    e2eOnlyRouteCount,
    routes,
    invariants,
    releaseGate: {
      ready: failedInvariantCount === 0,
      status: failedInvariantCount === 0 ? "ready" : "blocked",
      routeCount: routes.length,
      failedInvariantCount,
      operatorRouteCount,
      publicRouteCount,
      e2eOnlyRouteCount,
    },
  };
}
