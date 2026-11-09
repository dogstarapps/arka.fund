import { readFile } from "node:fs/promises";
import type { LeaderboardDataSourceSnapshot } from "@/lib/catalog/types";
import { resolveArkafundDeployments } from "@/lib/runtime/protocolSupport";

export function buildLeaderboardSourceFallback(
  input?: Partial<LeaderboardDataSourceSnapshot>,
): LeaderboardDataSourceSnapshot {
  return {
    metrics: {
      ranking: "catalog_rank",
      nav: "catalog_nav",
      profit: "catalog_profit_or_activity",
      volume: "catalog_volume_or_activity",
      activityFallbackWindowEvents: 60,
      ...(input?.metrics ?? {}),
    },
    oracle: {
      mode: "unverified",
      validatedAt: null,
      network: null,
      rpcUrl: null,
      oracleGuard: null,
      primaryOracle: null,
      secondaryOracle: null,
      primaryProvider: null,
      secondaryProvider: null,
      provider: null,
      validationAsset: null,
      selectedSourceUnderDivergence: null,
      source: "fallback",
      ...(input?.oracle ?? {}),
    },
    deployment: {
      targetNetwork: "testnet",
      deploymentsPath: null,
      pathSource: "network_default",
      fileFound: false,
      networkMismatch: false,
      readError: null,
      ...(input?.deployment ?? {}),
    },
    source: input?.source ?? "fallback",
  };
}

function extractString(
  ...values: unknown[]
): string | null {
  for (const value of values) {
    if (typeof value === "string" && value.trim().length > 0) {
      return value.trim();
    }
  }
  return null;
}

function resolveOracleProviderBySelection(input: {
  explicitProvider: string | null;
  selectedSourceUnderDivergence: number | null;
  primaryProvider: string | null;
  secondaryProvider: string | null;
}): string | null {
  if (input.explicitProvider) return input.explicitProvider;
  if (input.selectedSourceUnderDivergence === 1) return input.primaryProvider;
  if (input.selectedSourceUnderDivergence === 2) return input.secondaryProvider;
  if (
    input.primaryProvider &&
    input.secondaryProvider &&
    input.primaryProvider === input.secondaryProvider
  ) {
    return input.primaryProvider;
  }
  if (input.primaryProvider && !input.secondaryProvider) return input.primaryProvider;
  if (input.secondaryProvider && !input.primaryProvider) return input.secondaryProvider;
  return null;
}

function extractNumber(...values: unknown[]): number | null {
  for (const value of values) {
    if (typeof value === "number" && Number.isFinite(value)) {
      return value;
    }
    if (typeof value === "string" && value.trim()) {
      const parsed = Number(value);
      if (Number.isFinite(parsed)) return parsed;
    }
  }
  return null;
}

export function extractLeaderboardSourceSnapshot(
  payload: unknown,
): LeaderboardDataSourceSnapshot {
  if (!payload || typeof payload !== "object") {
    return buildLeaderboardSourceFallback();
  }

  const doc = payload as {
    validations?: Record<string, unknown>;
    validatedModules?: Record<string, unknown>;
  };
  const validations = doc.validations ?? {};
  const modules = doc.validatedModules ?? {};
  const oracleValidation =
    (validations as { oracleGuard?: Record<string, unknown> }).oracleGuard ?? {};
  const oracleModule =
    (modules as { oracleSafety?: Record<string, unknown> }).oracleSafety ?? {};

  const moduleContracts =
    (oracleModule.contracts as Record<string, unknown> | undefined) ?? {};
  const validationContracts =
    (oracleValidation.contracts as Record<string, unknown> | undefined) ?? {};
  const moduleChecks =
    (oracleModule.checks as Record<string, unknown> | undefined) ?? {};
  const validationResults =
    (oracleValidation.results as Record<string, unknown> | undefined) ?? {};
  const moduleProviders =
    (oracleModule.providers as Record<string, unknown> | undefined) ?? {};
  const validationProviders =
    (oracleValidation.providers as Record<string, unknown> | undefined) ?? {};
  const moduleThresholds =
    (oracleModule.thresholds as Record<string, unknown> | undefined) ??
    (oracleModule.checks as Record<string, unknown> | undefined) ??
    {};
  const validationThresholds =
    (oracleValidation.thresholds as Record<string, unknown> | undefined) ??
    (oracleValidation.checks as Record<string, unknown> | undefined) ??
    {};
  const secondarySelection =
    (validationResults.secondarySelection as Record<string, unknown> | undefined) ??
    {};

  const hasOracleModule = Object.keys(oracleModule).length > 0;
  const hasOracleValidation = Object.keys(oracleValidation).length > 0;
  const selectedSourceUnderDivergence =
    (typeof moduleChecks.selectedSourceUnderDivergence === "number" &&
      moduleChecks.selectedSourceUnderDivergence) ||
    (typeof secondarySelection.selected_source === "number" &&
      secondarySelection.selected_source) ||
    null;
  const primaryProvider = extractString(
    moduleProviders.primary,
    moduleProviders.primaryProvider,
    moduleProviders.primary_oracle,
    moduleProviders.primary_oracle_provider,
    (oracleModule as { primaryProvider?: unknown }).primaryProvider,
    (oracleModule as { primaryOracleProvider?: unknown }).primaryOracleProvider,
    validationProviders.primary,
    validationProviders.primaryProvider,
    validationProviders.primary_oracle,
    validationProviders.primary_oracle_provider,
    (oracleValidation as { primaryProvider?: unknown }).primaryProvider,
    (oracleValidation as { primaryOracleProvider?: unknown }).primaryOracleProvider,
  );
  const secondaryProvider = extractString(
    moduleProviders.secondary,
    moduleProviders.secondaryProvider,
    moduleProviders.secondary_oracle,
    moduleProviders.secondary_oracle_provider,
    (oracleModule as { secondaryProvider?: unknown }).secondaryProvider,
    (oracleModule as { secondaryOracleProvider?: unknown }).secondaryOracleProvider,
    validationProviders.secondary,
    validationProviders.secondaryProvider,
    validationProviders.secondary_oracle,
    validationProviders.secondary_oracle_provider,
    (oracleValidation as { secondaryProvider?: unknown }).secondaryProvider,
    (oracleValidation as { secondaryOracleProvider?: unknown }).secondaryOracleProvider,
  );
  const explicitProvider = extractString(
    moduleProviders.active,
    moduleProviders.selected,
    moduleProviders.provider,
    moduleProviders.oracleProvider,
    (oracleModule as { provider?: unknown }).provider,
    (oracleModule as { oracleProvider?: unknown }).oracleProvider,
    validationProviders.active,
    validationProviders.selected,
    validationProviders.provider,
    validationProviders.oracleProvider,
    (oracleValidation as { provider?: unknown }).provider,
    (oracleValidation as { oracleProvider?: unknown }).oracleProvider,
  );

  return buildLeaderboardSourceFallback({
    source: hasOracleModule || hasOracleValidation ? "deployments" : "fallback",
    oracle: {
      mode: hasOracleModule || hasOracleValidation ? "oracle_guard" : "unverified",
      validatedAt:
        (typeof oracleModule.validatedAt === "string" && oracleModule.validatedAt) ||
        (typeof oracleValidation.validatedAt === "string" &&
          oracleValidation.validatedAt) ||
        null,
      network:
        (typeof oracleModule.network === "string" && oracleModule.network) ||
        (typeof oracleValidation.network === "string" && oracleValidation.network) ||
        null,
      rpcUrl:
        (typeof oracleModule.rpcUrl === "string" && oracleModule.rpcUrl) ||
        (typeof oracleValidation.rpcUrl === "string" && oracleValidation.rpcUrl) ||
        null,
      oracleGuard:
        (typeof moduleContracts.oracleGuard === "string" &&
          moduleContracts.oracleGuard) ||
        (typeof validationContracts.oracleGuard === "string" &&
          validationContracts.oracleGuard) ||
        null,
      primaryOracle:
        (typeof moduleContracts.primaryOracle === "string" &&
          moduleContracts.primaryOracle) ||
        (typeof validationContracts.primaryOracle === "string" &&
          validationContracts.primaryOracle) ||
        null,
      secondaryOracle:
        (typeof moduleContracts.secondaryOracle === "string" &&
          moduleContracts.secondaryOracle) ||
        (typeof validationContracts.secondaryOracle === "string" &&
          validationContracts.secondaryOracle) ||
        null,
      primaryProvider,
      secondaryProvider,
      provider: resolveOracleProviderBySelection({
        explicitProvider,
        selectedSourceUnderDivergence,
        primaryProvider,
        secondaryProvider,
      }),
      validationAsset:
        (typeof moduleContracts.validationAsset === "string" &&
          moduleContracts.validationAsset) ||
        (typeof validationContracts.validationAsset === "string" &&
          validationContracts.validationAsset) ||
        null,
      maxOracleAgeSeconds: extractNumber(
        moduleThresholds.maxOracleAgeSeconds,
        moduleThresholds.max_oracle_age_seconds,
        moduleThresholds.maxAgeSeconds,
        validationThresholds.maxOracleAgeSeconds,
        validationThresholds.max_oracle_age_seconds,
        validationThresholds.maxAgeSeconds,
      ),
      maxDivergenceBps: extractNumber(
        moduleThresholds.maxDivergenceBps,
        moduleThresholds.max_divergence_bps,
        moduleThresholds.divergenceBps,
        validationThresholds.maxDivergenceBps,
        validationThresholds.max_divergence_bps,
        validationThresholds.divergenceBps,
      ),
      minProviderCount: extractNumber(
        moduleThresholds.minProviderCount,
        moduleThresholds.min_provider_count,
        validationThresholds.minProviderCount,
        validationThresholds.min_provider_count,
      ),
      selectedSourceUnderDivergence,
      source: hasOracleModule || hasOracleValidation ? "deployments" : "fallback",
    },
  });
}

function normalizeOracleNetwork(value: string | null | undefined): "testnet" | "mainnet" | null {
  if (!value) return null;
  const normalized = value.toLowerCase();
  if (normalized.includes("mainnet")) return "mainnet";
  if (normalized.includes("testnet")) return "testnet";
  return null;
}

function normalizeReadError(error: unknown): string {
  if (error && typeof error === "object" && "code" in error) {
    const code = Reflect.get(error, "code");
    if (typeof code === "string" && code.trim()) {
      return code;
    }
  }
  if (error instanceof Error && error.message.trim()) {
    return error.message.trim().split("\n")[0] ?? "read_error";
  }
  return "read_error";
}

function readProviderFromEnv(input: {
  env: NodeJS.ProcessEnv;
  networkTarget: "testnet" | "mainnet";
  role: "primary" | "secondary" | "effective";
}): string | null {
  const suffix = input.networkTarget.toUpperCase();
  const scopedPublic = `NEXT_PUBLIC_ORACLE_PROVIDER_${suffix}`;
  const scopedServer = `ARKAFUND_ORACLE_PROVIDER_${suffix}`;
  if (input.role === "effective") {
    return extractString(
      input.env[scopedServer],
      input.env[scopedPublic],
      input.env.ARKAFUND_ORACLE_PROVIDER,
      input.env.NEXT_PUBLIC_ORACLE_PROVIDER,
    );
  }
  const roleUpper = input.role.toUpperCase();
  return extractString(
    input.env[`ARKAFUND_ORACLE_PROVIDER_${roleUpper}_${suffix}`],
    input.env[`NEXT_PUBLIC_ORACLE_PROVIDER_${roleUpper}_${suffix}`],
    input.env[`ARKAFUND_ORACLE_PROVIDER_${roleUpper}`],
    input.env[`NEXT_PUBLIC_ORACLE_PROVIDER_${roleUpper}`],
  );
}

function applyConfiguredOracleProviders(
  snapshot: LeaderboardDataSourceSnapshot,
  env: NodeJS.ProcessEnv,
  networkTarget: "testnet" | "mainnet",
): LeaderboardDataSourceSnapshot {
  const primaryProvider =
    snapshot.oracle.primaryProvider ??
    readProviderFromEnv({
      env,
      networkTarget,
      role: "primary",
    });
  const secondaryProvider =
    snapshot.oracle.secondaryProvider ??
    readProviderFromEnv({
      env,
      networkTarget,
      role: "secondary",
    });
  const provider =
    resolveOracleProviderBySelection({
      explicitProvider: snapshot.oracle.provider ?? null,
      selectedSourceUnderDivergence: snapshot.oracle.selectedSourceUnderDivergence,
      primaryProvider,
      secondaryProvider,
    }) ??
    readProviderFromEnv({
      env,
      networkTarget,
      role: "effective",
    });
  return {
    ...snapshot,
    oracle: {
      ...snapshot.oracle,
      primaryProvider,
      secondaryProvider,
      provider,
    },
  };
}

export async function readLeaderboardSourceSnapshot(
  readFileImpl: typeof readFile = readFile,
  env: NodeJS.ProcessEnv = process.env,
): Promise<LeaderboardDataSourceSnapshot> {
  const resolved = resolveArkafundDeployments(env);
  try {
    const raw = await readFileImpl(resolved.deploymentsPath, "utf8");
    const snapshot = applyConfiguredOracleProviders(
      extractLeaderboardSourceSnapshot(JSON.parse(raw)),
      env,
      resolved.networkTarget,
    );
    const oracleNetwork = normalizeOracleNetwork(snapshot.oracle.network);
    const networkMismatch =
      oracleNetwork !== null && oracleNetwork !== resolved.networkTarget;
    return {
      ...snapshot,
      oracle: networkMismatch
        ? {
            ...snapshot.oracle,
            mode: "unverified",
          }
        : snapshot.oracle,
      deployment: {
        targetNetwork: resolved.networkTarget,
        deploymentsPath: resolved.deploymentsPath,
        pathSource: resolved.pathSource,
        fileFound: true,
        networkMismatch,
        readError: null,
      },
    };
  } catch (error) {
    return applyConfiguredOracleProviders(
      buildLeaderboardSourceFallback({
        deployment: {
          targetNetwork: resolved.networkTarget,
          deploymentsPath: resolved.deploymentsPath,
          pathSource: resolved.pathSource,
          fileFound: false,
          networkMismatch: false,
          readError: normalizeReadError(error),
        },
      }),
      env,
      resolved.networkTarget,
    );
  }
}
