import { existsSync, readFileSync } from "node:fs";
import {
  resolveArkafundDeployments,
  type ArkafundDeploymentsResolution,
  type ArkafundNetworkTarget,
} from "@/lib/runtime/protocolSupport";

export type RebalanceCanaryGateStatus =
  | "ready"
  | "blocked"
  | "not_required"
  | "unknown";

export type RebalanceCanaryGateCode =
  | "ready"
  | "not_required"
  | "manifest_missing"
  | "manifest_unreadable"
  | "canary_missing"
  | "canary_stale"
  | "network_mismatch"
  | "evidence_unverified"
  | "venue_coverage_incomplete"
  | "canary_failed";

export type RebalanceCanaryVenue =
  | "AQUARIUS"
  | "SOROSWAP"
  | "PHOENIX"
  | "SUSHI"
  | "BALANCED"
  | "AUTO_SPLIT"
  | "UNKNOWN";

export interface RebalanceCanaryCaseSnapshot {
  id: string;
  venue: RebalanceCanaryVenue;
  tokenIn: string | null;
  tokenOut: string | null;
  amountBase: string | null;
  quoteOutBase: string | null;
  selectedPath: string | null;
  candidateUniverseSize: number;
  quotedPathCount: number;
  minEfficiencyBps: number;
  plannerEfficiencyBps: number | null;
  passed: boolean;
  ready: boolean;
  reason: string;
  evidenceMode: string | null;
  evidenceCollectedAt: string | null;
  evidenceSource: string | null;
  evidenceLiveConfirmed: boolean;
}

export interface RebalanceCanaryGateSnapshot {
  status: RebalanceCanaryGateStatus;
  code: RebalanceCanaryGateCode;
  targetNetwork: ArkafundNetworkTarget;
  ready: boolean;
  required: boolean;
  manifestPath: string;
  detail: string;
  checks: {
    manifestFound: boolean;
    manifestReadable: boolean;
    canaryFound: boolean;
    networkMismatch: boolean;
    canaryNetwork: ArkafundNetworkTarget | "unknown";
    validatedAt: string | null;
    maxAgeHours: number;
    ageHours: number | null;
    stale: boolean;
    evidenceMode: string | null;
    evidenceVerified: boolean;
    requiredVenues: RebalanceCanaryVenue[];
    coveredVenues: RebalanceCanaryVenue[];
    missingVenues: RebalanceCanaryVenue[];
    caseCount: number;
    readyCaseCount: number;
    failedCaseIds: string[];
    totalCandidateUniverseSize: number;
    totalQuotedPathCount: number;
  };
  cases: RebalanceCanaryCaseSnapshot[];
}

const DEFAULT_REQUIRED_MAINNET_VENUES: RebalanceCanaryVenue[] = [
  "SOROSWAP",
  "AQUARIUS",
  "SUSHI",
];
const DEFAULT_MIN_EFFICIENCY_BPS = 9_850;
const DEFAULT_MAX_CANARY_AGE_HOURS = 24;
const LIVE_MAINNET_EVIDENCE_MODES = new Set([
  "live_mainnet",
  "live_mainnet_quote",
  "live_mainnet_quote_status",
  "live_mainnet_execution",
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function stringValue(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : null;
}

function numberValue(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function booleanValue(value: unknown): boolean | null {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (normalized === "true" || normalized === "1" || normalized === "yes") {
      return true;
    }
    if (normalized === "false" || normalized === "0" || normalized === "no") {
      return false;
    }
  }
  return null;
}

function normalizeEvidenceMode(value: unknown): string | null {
  const raw = stringValue(value)?.toLowerCase().replace(/[\s-]+/g, "_");
  return raw ?? null;
}

function parseTimestampMs(value: unknown): number | null {
  const raw = stringValue(value);
  if (!raw) return null;
  const parsed = Date.parse(raw);
  return Number.isFinite(parsed) ? parsed : null;
}

function resolveNowMs(env: NodeJS.ProcessEnv): number {
  const override = parseTimestampMs(env.ARKAFUND_ROUTING_CANARY_NOW);
  return override ?? Date.now();
}

function ageHoursFromTimestamp(input: {
  timestamp: string | null;
  nowMs: number;
}): number | null {
  const timestampMs = parseTimestampMs(input.timestamp);
  if (timestampMs === null) return null;
  return Math.max(0, (input.nowMs - timestampMs) / (60 * 60 * 1000));
}

function isPositiveBaseUnits(value: unknown): boolean {
  if (typeof value === "number") return Number.isFinite(value) && value > 0;
  if (typeof value !== "string" || value.trim().length === 0) return false;
  try {
    return BigInt(value.trim()) > BigInt(0);
  } catch {
    return false;
  }
}

function inferNetwork(value: unknown): ArkafundNetworkTarget | "unknown" {
  const raw = stringValue(value)?.toLowerCase();
  if (raw === "mainnet" || raw === "public" || raw === "pubnet") return "mainnet";
  if (raw === "testnet" || raw === "test") return "testnet";
  return "unknown";
}

function normalizeVenue(value: unknown): RebalanceCanaryVenue {
  const raw = stringValue(value)?.toUpperCase().replace(/[\s-]+/g, "_");
  if (raw === "AQUARIUS") return "AQUARIUS";
  if (raw === "SOROSWAP" || raw === "SORO_SWAP") return "SOROSWAP";
  if (raw === "SUSHI") return "SUSHI";
  if (raw === "PHOENIX") return "PHOENIX";
  if (raw === "BALANCED" || raw === "SODAX" || raw === "BALANCED_SODAX") {
    return "BALANCED";
  }
  if (raw === "AUTO_SPLIT" || raw === "SPLIT" || raw === "SMART_SPLIT") {
    return "AUTO_SPLIT";
  }
  return "UNKNOWN";
}

function normalizeVenues(value: unknown): RebalanceCanaryVenue[] {
  if (!Array.isArray(value)) return DEFAULT_REQUIRED_MAINNET_VENUES;
  const venues = value
    .map((item) => normalizeVenue(item))
    .filter((venue): venue is Exclude<RebalanceCanaryVenue, "UNKNOWN"> => venue !== "UNKNOWN");
  const uniqueVenues = Array.from(new Set(venues));
  return uniqueVenues.length > 0 ? uniqueVenues : DEFAULT_REQUIRED_MAINNET_VENUES;
}

function selectedPathValue(value: unknown): string | null {
  if (typeof value === "string" && value.trim().length > 0) return value.trim();
  if (Array.isArray(value) && value.length > 0) {
    const parts = value.map((part) => stringValue(part)).filter(Boolean);
    return parts.length > 0 ? parts.join(" -> ") : null;
  }
  return null;
}

function extractRoutingCanary(payload: unknown): Record<string, unknown> | null {
  if (!isRecord(payload)) return null;
  const validations = isRecord(payload.validations) ? payload.validations : {};
  const validatedModules = isRecord(payload.validatedModules)
    ? payload.validatedModules
    : {};
  const directCanary = isRecord(payload.routingCanary) ? payload.routingCanary : null;
  const validationCanary = isRecord(validations.routingCanary)
    ? validations.routingCanary
    : null;
  const legacyCanary = isRecord(validations.smartRoutingCanary)
    ? validations.smartRoutingCanary
    : null;
  const moduleCanary = isRecord(validatedModules.routingCanary)
    ? validatedModules.routingCanary
    : null;
  return validationCanary ?? legacyCanary ?? moduleCanary ?? directCanary;
}

function deriveCanaryCase(
  item: unknown,
  topLevelEvidenceMode: string | null,
): RebalanceCanaryCaseSnapshot {
  const record = isRecord(item) ? item : {};
  const evidence = isRecord(record.evidence) ? record.evidence : {};
  const id = stringValue(record.id) ?? "unnamed_canary_case";
  const venue = normalizeVenue(record.venue ?? record.protocol ?? record.selectedProtocol);
  const tokenIn = stringValue(record.tokenIn ?? record.assetIn);
  const tokenOut = stringValue(record.tokenOut ?? record.assetOut);
  const amountBase = stringValue(record.amountBase ?? record.amountInBase);
  const quoteOutBase = stringValue(
    record.quoteOutBase ?? record.estimatedOutBase ?? record.outputBase,
  );
  const selectedPath = selectedPathValue(record.selectedPath ?? record.path);
  const candidateUniverseSize = Math.max(
    0,
    Math.floor(numberValue(record.candidateUniverseSize) ?? 0),
  );
  const quotedPathCount = Math.max(
    0,
    Math.floor(numberValue(record.quotedPathCount) ?? 0),
  );
  const minEfficiencyBps =
    Math.floor(numberValue(record.minEfficiencyBps) ?? DEFAULT_MIN_EFFICIENCY_BPS);
  const plannerEfficiencyBps = numberValue(
    record.plannerEfficiencyBps ?? record.efficiencyBps,
  );
  const passed = record.passed === true;
  const evidenceMode = normalizeEvidenceMode(
    evidence.mode ??
      evidence.evidenceMode ??
      record.evidenceMode ??
      record.executionMode ??
      topLevelEvidenceMode,
  );
  const evidenceCollectedAt = stringValue(
    evidence.collectedAt ??
      evidence.observedAt ??
      evidence.validatedAt ??
      record.evidenceCollectedAt ??
      record.observedAt,
  );
  const evidenceSource = stringValue(
    evidence.source ??
      evidence.endpoint ??
      evidence.provider ??
      record.evidenceSource ??
      record.source,
  );
  const liveEvidenceConfirmed =
    booleanValue(evidence.liveMainnet ?? record.liveMainnet) ?? false;

  const issues: string[] = [];
  if (!passed) issues.push("case did not pass");
  if (venue === "UNKNOWN") issues.push("venue is unknown");
  if (!tokenIn) issues.push("token in is missing");
  if (!tokenOut) issues.push("token out is missing");
  if (!isPositiveBaseUnits(amountBase)) issues.push("amount is missing or zero");
  if (!isPositiveBaseUnits(quoteOutBase)) issues.push("quote output is missing or zero");
  if (!selectedPath) issues.push("selected path is missing");
  if (candidateUniverseSize <= 0) issues.push("candidate universe is empty");
  if (quotedPathCount <= 0) issues.push("quoted path count is zero");
  if (!evidenceMode || !LIVE_MAINNET_EVIDENCE_MODES.has(evidenceMode)) {
    issues.push("live mainnet evidence mode is missing");
  }
  if (!evidenceCollectedAt) issues.push("live evidence timestamp is missing");
  if (!evidenceSource) issues.push("live evidence source is missing");
  if (!liveEvidenceConfirmed) issues.push("live mainnet evidence is not confirmed");
  if (
    plannerEfficiencyBps !== null &&
    Number.isFinite(plannerEfficiencyBps) &&
    plannerEfficiencyBps < minEfficiencyBps
  ) {
    issues.push("efficiency is below the required threshold");
  }

  return {
    id,
    venue,
    tokenIn,
    tokenOut,
    amountBase,
    quoteOutBase,
    selectedPath,
    candidateUniverseSize,
    quotedPathCount,
    minEfficiencyBps,
    plannerEfficiencyBps,
    passed,
    ready: issues.length === 0,
    reason: issues.length === 0 ? "Canary case is validated." : issues.join("; "),
    evidenceMode,
    evidenceCollectedAt,
    evidenceSource,
    evidenceLiveConfirmed: liveEvidenceConfirmed,
  };
}

function buildSnapshot(
  resolution: ArkafundDeploymentsResolution,
  overrides: Partial<RebalanceCanaryGateSnapshot> & {
    status: RebalanceCanaryGateStatus;
    code: RebalanceCanaryGateCode;
    ready: boolean;
    required: boolean;
    detail: string;
  },
): RebalanceCanaryGateSnapshot {
  const defaultChecks: RebalanceCanaryGateSnapshot["checks"] = {
    manifestFound: false,
    manifestReadable: false,
    canaryFound: false,
    networkMismatch: false,
    canaryNetwork: "unknown",
    validatedAt: null,
    maxAgeHours: DEFAULT_MAX_CANARY_AGE_HOURS,
    ageHours: null,
    stale: false,
    evidenceMode: null,
    evidenceVerified: false,
    requiredVenues: DEFAULT_REQUIRED_MAINNET_VENUES,
    coveredVenues: [],
    missingVenues: DEFAULT_REQUIRED_MAINNET_VENUES,
    caseCount: 0,
    readyCaseCount: 0,
    failedCaseIds: [],
    totalCandidateUniverseSize: 0,
    totalQuotedPathCount: 0,
  };

  return {
    targetNetwork: resolution.networkTarget,
    manifestPath: resolution.deploymentsPath,
    cases: [],
    checks: defaultChecks,
    ...overrides,
  };
}

export function readRebalanceCanaryGate(
  resolution: ArkafundDeploymentsResolution = resolveArkafundDeployments(),
  env: NodeJS.ProcessEnv = process.env,
): RebalanceCanaryGateSnapshot {
  const requireCanary =
    resolution.networkTarget === "mainnet" ||
    env.ARKAFUND_REQUIRE_ROUTING_CANARY === "1";

  if (!existsSync(resolution.deploymentsPath)) {
    if (!requireCanary) {
      return buildSnapshot(resolution, {
        status: "not_required",
        code: "not_required",
        ready: true,
        required: false,
        detail:
          "Routing canary is not required for the current non-mainnet lane, and no deployments manifest was found.",
      });
    }

    return buildSnapshot(resolution, {
      status: "blocked",
      code: "manifest_missing",
      ready: false,
      required: true,
      detail: `Smart Routing canary is required, but deployments manifest is missing at ${resolution.deploymentsPath}.`,
    });
  }

  let payload: unknown;
  try {
    payload = JSON.parse(readFileSync(resolution.deploymentsPath, "utf8"));
  } catch (error) {
    return buildSnapshot(resolution, {
      status: requireCanary ? "blocked" : "unknown",
      code: "manifest_unreadable",
      ready: false,
      required: requireCanary,
      detail: `Deployments manifest could not be parsed for Smart Routing canary evidence: ${
        error instanceof Error ? error.message : "unknown error"
      }.`,
      checks: {
        manifestFound: true,
        manifestReadable: false,
        canaryFound: false,
        networkMismatch: false,
        canaryNetwork: "unknown",
        validatedAt: null,
        maxAgeHours: DEFAULT_MAX_CANARY_AGE_HOURS,
        ageHours: null,
        stale: false,
        evidenceMode: null,
        evidenceVerified: false,
        requiredVenues: DEFAULT_REQUIRED_MAINNET_VENUES,
        coveredVenues: [],
        missingVenues: DEFAULT_REQUIRED_MAINNET_VENUES,
        caseCount: 0,
        readyCaseCount: 0,
        failedCaseIds: [],
        totalCandidateUniverseSize: 0,
        totalQuotedPathCount: 0,
      },
    });
  }

  const canary = extractRoutingCanary(payload);
  if (!canary) {
    const base = buildSnapshot(resolution, {
      status: requireCanary ? "blocked" : "not_required",
      code: requireCanary ? "canary_missing" : "not_required",
      ready: !requireCanary,
      required: requireCanary,
      detail: requireCanary
        ? "Smart Routing canary is required for this lane, but validations.routingCanary is missing from the deployments manifest."
        : "Routing canary is not required for the current non-mainnet lane.",
    });
    return {
      ...base,
      checks: {
        ...base.checks,
        manifestFound: true,
        manifestReadable: true,
      },
    };
  }

  const canaryNetwork = inferNetwork(canary.network);
  const networkMismatch =
    canaryNetwork !== "unknown" && canaryNetwork !== resolution.networkTarget;
  const nowMs = resolveNowMs(env);
  const validatedAt = stringValue(canary.validatedAt);
  const maxAgeHours = Math.max(
    1,
    Math.floor(
      numberValue(
        canary.maxAgeHours ??
          canary.maxCanaryAgeHours ??
          canary.freshnessHours,
      ) ?? DEFAULT_MAX_CANARY_AGE_HOURS,
    ),
  );
  const ageHours = ageHoursFromTimestamp({ timestamp: validatedAt, nowMs });
  const stale = ageHours === null || ageHours > maxAgeHours;
  const evidenceMode = normalizeEvidenceMode(
    canary.evidenceMode ?? canary.executionMode ?? canary.mode,
  );
  const requiredVenues = normalizeVenues(canary.requiredVenues);
  const cases = (Array.isArray(canary.cases) ? canary.cases : []).map(
    (item) => deriveCanaryCase(item, evidenceMode),
  );
  const evidenceVerified =
    resolution.networkTarget === "mainnet" &&
    evidenceMode !== null &&
    LIVE_MAINNET_EVIDENCE_MODES.has(evidenceMode) &&
    cases.length > 0 &&
    cases.every((canaryCase) =>
      canaryCase.evidenceMode
        ? LIVE_MAINNET_EVIDENCE_MODES.has(canaryCase.evidenceMode) &&
          Boolean(canaryCase.evidenceCollectedAt) &&
          Boolean(canaryCase.evidenceSource) &&
          canaryCase.evidenceLiveConfirmed
        : false,
    );
  const coveredVenues = Array.from(
    new Set(
      cases
        .filter((canaryCase) => canaryCase.ready)
        .map((canaryCase) => canaryCase.venue)
        .filter((venue): venue is Exclude<RebalanceCanaryVenue, "UNKNOWN"> => venue !== "UNKNOWN"),
    ),
  );
  const coveredVenueSet = new Set<RebalanceCanaryVenue>(coveredVenues);
  const missingVenues = requiredVenues.filter(
    (venue) => !coveredVenueSet.has(venue),
  );
  const failedCaseIds = cases
    .filter((canaryCase) => !canaryCase.ready)
    .map((canaryCase) => canaryCase.id);
  const readyCaseCount = cases.filter((canaryCase) => canaryCase.ready).length;
  const checks: RebalanceCanaryGateSnapshot["checks"] = {
    manifestFound: true,
    manifestReadable: true,
    canaryFound: true,
    networkMismatch,
    canaryNetwork,
    validatedAt,
    maxAgeHours,
    ageHours,
    stale,
    evidenceMode,
    evidenceVerified,
    requiredVenues,
    coveredVenues,
    missingVenues,
    caseCount: cases.length,
    readyCaseCount,
    failedCaseIds,
    totalCandidateUniverseSize: cases.reduce(
      (total, canaryCase) => total + canaryCase.candidateUniverseSize,
      0,
    ),
    totalQuotedPathCount: cases.reduce(
      (total, canaryCase) => total + canaryCase.quotedPathCount,
      0,
    ),
  };

  if (!requireCanary) {
    return {
      status: "not_required",
      code: "not_required",
      targetNetwork: resolution.networkTarget,
      ready: true,
      required: false,
      manifestPath: resolution.deploymentsPath,
      detail:
        "Routing canary evidence is present, but the current non-mainnet lane does not require it for release.",
      checks,
      cases,
    };
  }

  if (networkMismatch || canaryNetwork === "unknown") {
    return {
      status: "blocked",
      code: "network_mismatch",
      targetNetwork: resolution.networkTarget,
      ready: false,
      required: true,
      manifestPath: resolution.deploymentsPath,
      detail: `Smart Routing canary network ${
        canaryNetwork === "unknown" ? "is undeclared" : `is ${canaryNetwork}`
      }, but ${resolution.networkTarget} is required.`,
      checks: {
        ...checks,
        networkMismatch: true,
      },
      cases,
    };
  }

  if (stale) {
    return {
      status: "blocked",
      code: "canary_stale",
      targetNetwork: resolution.networkTarget,
      ready: false,
      required: true,
      manifestPath: resolution.deploymentsPath,
      detail:
        ageHours === null
          ? "Smart Routing canary is missing a valid freshness timestamp."
          : `Smart Routing canary is stale: ${ageHours.toFixed(1)}h old with a ${maxAgeHours}h maximum.`,
      checks,
      cases,
    };
  }

  if (!evidenceVerified) {
    return {
      status: "blocked",
      code: "evidence_unverified",
      targetNetwork: resolution.networkTarget,
      ready: false,
      required: true,
      manifestPath: resolution.deploymentsPath,
      detail:
        "Smart Routing canary must declare live mainnet evidence mode and per-case live evidence before release.",
      checks,
      cases,
    };
  }

  if (missingVenues.length > 0) {
    return {
      status: "blocked",
      code: "venue_coverage_incomplete",
      targetNetwork: resolution.networkTarget,
      ready: false,
      required: true,
      manifestPath: resolution.deploymentsPath,
      detail: `Smart Routing canary is missing validated venue coverage for ${missingVenues.join(", ")}.`,
      checks,
      cases,
    };
  }

  if (cases.length === 0 || failedCaseIds.length > 0) {
    return {
      status: "blocked",
      code: "canary_failed",
      targetNetwork: resolution.networkTarget,
      ready: false,
      required: true,
      manifestPath: resolution.deploymentsPath,
      detail:
        failedCaseIds.length > 0
          ? `Smart Routing canary has failing cases: ${failedCaseIds.join(", ")}.`
          : "Smart Routing canary is present but contains no executable cases.",
      checks,
      cases,
    };
  }

  return {
    status: "ready",
    code: "ready",
    targetNetwork: resolution.networkTarget,
    ready: true,
    required: true,
    manifestPath: resolution.deploymentsPath,
    detail:
      "Smart Routing canary is validated for the target network and covers the required production venues.",
    checks,
    cases,
  };
}
