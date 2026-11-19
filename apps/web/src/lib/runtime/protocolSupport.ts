import { readFile } from "node:fs/promises";
import path from "node:path";
import {
  buildBalancedFallbackPayload,
  type BalancedProtocolHealthPayload,
} from "@/lib/runtime/appHealth";

export type ArkafundNetworkTarget = "testnet" | "mainnet";
export type ArkafundDeploymentsPathSource =
  | "env_path"
  | "network_default"
  | "bundled_testnet"
  | "bundled_mainnet";

export interface ArkafundDeploymentsResolution {
  networkTarget: ArkafundNetworkTarget;
  pathSource: ArkafundDeploymentsPathSource;
  deploymentsPath: string;
}

export function inferArkafundNetworkTarget(
  env: NodeJS.ProcessEnv = process.env,
): ArkafundNetworkTarget {
  const explicitTarget = (
    env.ARKAFUND_NETWORK_TARGET ??
    env.NEXT_PUBLIC_ARKAFUND_NETWORK_TARGET ??
    ""
  )
    .toLowerCase()
    .trim();

  if (
    explicitTarget === "mainnet" ||
    explicitTarget === "public" ||
    explicitTarget === "pubnet" ||
    explicitTarget === "production"
  ) {
    return "mainnet";
  }
  if (
    explicitTarget === "testnet" ||
    explicitTarget === "test" ||
    explicitTarget === "dev" ||
    explicitTarget === "development"
  ) {
    return "testnet";
  }

  const passphrase = (
    env.NEXT_PUBLIC_STELLAR_NETWORK ??
    env.STELLAR_NETWORK_PASSPHRASE ??
    ""
  )
    .toLowerCase()
    .trim();

  if (passphrase.includes("public global stellar network")) {
    return "mainnet";
  }
  return "testnet";
}

export function resolveArkafundDeployments(
  env: NodeJS.ProcessEnv = process.env,
): ArkafundDeploymentsResolution {
  if (env.ARKAFUND_DEPLOYMENTS_PATH && env.ARKAFUND_DEPLOYMENTS_PATH.trim()) {
    return {
      networkTarget: inferArkafundNetworkTarget(env),
      pathSource: "env_path",
      deploymentsPath: env.ARKAFUND_DEPLOYMENTS_PATH,
    };
  }

  const networkTarget = inferArkafundNetworkTarget(env);
  if (networkTarget === "testnet") {
    return {
      networkTarget,
      pathSource: "bundled_testnet",
      deploymentsPath: path.resolve(process.cwd(), "config/deployments.testnet.json"),
    };
  }

  return {
    networkTarget,
    pathSource: "bundled_mainnet",
    deploymentsPath: path.resolve(process.cwd(), "config/deployments.mainnet.json"),
  };
}

export function resolveArkafundDeploymentsPath(
  env: NodeJS.ProcessEnv = process.env,
): string {
  return resolveArkafundDeployments(env).deploymentsPath;
}

export function extractBalancedProtocolHealth(
  payload: unknown,
): BalancedProtocolHealthPayload {
  if (!payload || typeof payload !== "object") {
    return buildBalancedFallbackPayload();
  }

  const validations =
    (payload as { validations?: Record<string, unknown> }).validations ?? {};
  const validatedModules =
    (payload as { validatedModules?: Record<string, unknown> }).validatedModules ?? {};
  const balanced =
    (validations as { balancedReadiness?: Record<string, unknown> })
      .balancedReadiness ?? {};
  const balancedOfficialSurface =
    (validations as { balancedOfficialSurface?: Record<string, unknown> })
      .balancedOfficialSurface ?? {};
  const balancedOfficialSources =
    (balancedOfficialSurface.officialSources as Record<string, unknown> | undefined) ??
    undefined;
  const balancedOfficialIntentAdapter =
    (balancedOfficialSurface.intentAdapter as Record<string, unknown> | undefined) ??
    undefined;
  const balancedOfficialMainnetAddresses =
    (balancedOfficialSurface.stellarMainnetAddresses as Record<string, unknown> | undefined) ??
    undefined;
  const balancedModule =
    (validatedModules as { balancedExecution?: Record<string, unknown> })
      .balancedExecution ?? {};
  const balancedModuleContracts =
    (balancedModule as { contracts?: Record<string, unknown> }).contracts ?? {};
  const balancedModuleChecks =
    (balancedModule as { checks?: Record<string, unknown> }).checks ?? {};
  const modulePresent = Object.keys(balancedModule).length > 0;
  const moduleRouter =
    typeof balancedModuleContracts.router === "string"
      ? balancedModuleContracts.router
      : null;
  const moduleAdapterBalanced =
    typeof balancedModuleContracts.adapterBalanced === "string"
      ? balancedModuleContracts.adapterBalanced
      : null;
  const modulePoolId =
    typeof balancedModuleChecks.poolId === "number"
      ? balancedModuleChecks.poolId
      : 0;
  const hasExplicitSupportStatus =
    typeof balanced.supportStatus === "string" &&
    balanced.supportStatus.trim().length > 0;
  const hasExplicitReadyFlag = typeof balanced.readyForDappExecution === "boolean";
  const hasExplicitLaneMode =
    typeof balanced.laneMode === "string" && balanced.laneMode.trim().length > 0;
  const inferredCanonicalReady =
    modulePresent && Boolean(moduleRouter) && modulePoolId > 0;

  const supportStatus =
    hasExplicitSupportStatus
      ? (balanced.supportStatus as string)
      : inferredCanonicalReady
        ? "ready"
        : "blocked";
  const readyForDappExecution = hasExplicitReadyFlag
    ? Boolean(balanced.readyForDappExecution)
    : inferredCanonicalReady;
  const laneMode = hasExplicitLaneMode
    ? (balanced.laneMode as string)
    : inferredCanonicalReady
      ? "expected_router"
      : "undeclared";
  const poolId =
    typeof balanced.poolId === "number" && balanced.poolId > 0
      ? balanced.poolId
      : modulePoolId;
  const expectedRouter =
    typeof balanced.expectedRouter === "string"
      ? balanced.expectedRouter
      : moduleRouter;
  const observedRouter =
    typeof balanced.observedRouter === "string"
      ? balanced.observedRouter
      : inferredCanonicalReady
        ? moduleRouter
        : null;
  const poolSupported =
    typeof balanced.poolSupported === "boolean"
      ? Boolean(balanced.poolSupported)
      : inferredCanonicalReady;
  const pairConfigured =
    typeof balanced.pairConfigured === "boolean"
      ? Boolean(balanced.pairConfigured)
      : inferredCanonicalReady;
  const blockingReasons = Array.isArray(balanced.blockingReasons)
    ? balanced.blockingReasons.filter(
        (reason): reason is string => typeof reason === "string",
      )
    : [];
  const adapterBalanced =
    typeof balanced.adapterBalanced === "string"
      ? balanced.adapterBalanced
      : moduleAdapterBalanced ?? "";

  return buildBalancedFallbackPayload({
    validatedAt:
      typeof balanced.validatedAt === "string" ? balanced.validatedAt : null,
    adapterBalanced,
    poolId,
    supportStatus,
    readyForDappExecution,
    laneMode,
    blockingReasons,
    observedRouter,
    expectedRouter,
    poolSupported,
    pairConfigured,
    validatedModule: {
      present: modulePresent,
      validatedAt:
        typeof balancedModule.validatedAt === "string"
          ? balancedModule.validatedAt
          : null,
      router: moduleRouter,
      poolId: modulePoolId,
      sourceValidations: Array.isArray(balancedModule.sourceValidations)
        ? balancedModule.sourceValidations.filter(
            (value): value is string => typeof value === "string",
          )
        : [],
      source: "deployments",
    },
    officialSurface: {
      validatedAt:
        typeof balancedOfficialSurface.validatedAt === "string"
          ? balancedOfficialSurface.validatedAt
          : null,
      officialSources: {
        app:
          typeof balancedOfficialSources?.app === "string"
            ? (balancedOfficialSources.app as string)
            : null,
        bundle:
          typeof balancedOfficialSources?.bundle === "string"
            ? (balancedOfficialSources.bundle as string)
            : null,
        stellarPage:
          typeof balancedOfficialSources?.stellarPage === "string"
            ? (balancedOfficialSources.stellarPage as string)
            : null,
        swapDocs:
          typeof balancedOfficialSources?.swapDocs === "string"
            ? (balancedOfficialSources.swapDocs as string)
            : null,
        tradeBlog:
          typeof balancedOfficialSources?.tradeBlog === "string"
            ? (balancedOfficialSources.tradeBlog as string)
            : null,
        q3Blog:
          typeof balancedOfficialSources?.q3Blog === "string"
            ? (balancedOfficialSources.q3Blog as string)
            : null,
      },
      topology:
        balancedOfficialSurface.topology === "intent_based"
          ? "intent_based"
          : "unknown",
      swapModel:
        balancedOfficialSurface.swapModel === "sodax_intents"
          ? "sodax_intents"
          : "unknown",
      liquidityModel:
        balancedOfficialSurface.liquidityModel === "legacy_exchange_only"
          ? "legacy_exchange_only"
          : "unknown",
      publicRouterContractId:
        typeof balancedOfficialSurface.publicRouterContractId === "string"
          ? balancedOfficialSurface.publicRouterContractId
          : null,
      supportsPublicStellarTestnet: Boolean(
        balancedOfficialSurface.supportsPublicStellarTestnet,
      ),
      canonicalRouterCutoverPossible: Boolean(
        balancedOfficialSurface.canonicalRouterCutoverPossible,
      ),
      intentAdapter: {
        quoteProvider:
          balancedOfficialIntentAdapter?.quoteProvider === "sodax"
            ? "sodax"
            : "unknown",
        quoteVisibleInApp: Boolean(
          balancedOfficialIntentAdapter?.quoteVisibleInApp,
        ),
        quoteComparableForArka: Boolean(
          balancedOfficialIntentAdapter?.quoteComparableForArka,
        ),
        publicQuoteEndpoint:
          typeof balancedOfficialIntentAdapter?.publicQuoteEndpoint === "string"
            ? (balancedOfficialIntentAdapter.publicQuoteEndpoint as string)
            : null,
        publicBuildEndpoint:
          typeof balancedOfficialIntentAdapter?.publicBuildEndpoint === "string"
            ? (balancedOfficialIntentAdapter.publicBuildEndpoint as string)
            : null,
        publicRelayEndpoint:
          typeof balancedOfficialIntentAdapter?.publicRelayEndpoint === "string"
            ? (balancedOfficialIntentAdapter.publicRelayEndpoint as string)
            : null,
        publicSubmitEndpoint:
          typeof balancedOfficialIntentAdapter?.publicSubmitEndpoint === "string"
            ? (balancedOfficialIntentAdapter.publicSubmitEndpoint as string)
            : null,
        statusSurface:
          balancedOfficialIntentAdapter?.statusSurface === "recent_activity"
            ? "recent_activity"
            : "unknown",
        publicStatusEndpoint:
          typeof balancedOfficialIntentAdapter?.publicStatusEndpoint === "string"
            ? (balancedOfficialIntentAdapter.publicStatusEndpoint as string)
            : null,
        publicReceiptEndpoint:
          typeof balancedOfficialIntentAdapter?.publicReceiptEndpoint === "string"
            ? (balancedOfficialIntentAdapter.publicReceiptEndpoint as string)
            : null,
        publicExpiryEndpoint:
          typeof balancedOfficialIntentAdapter?.publicExpiryEndpoint === "string"
            ? (balancedOfficialIntentAdapter.publicExpiryEndpoint as string)
            : null,
        publicRefundEndpoint:
          typeof balancedOfficialIntentAdapter?.publicRefundEndpoint === "string"
            ? (balancedOfficialIntentAdapter.publicRefundEndpoint as string)
            : null,
        cancellationWindowSeconds:
          typeof balancedOfficialIntentAdapter?.cancellationWindowSeconds === "number"
            ? (balancedOfficialIntentAdapter.cancellationWindowSeconds as number)
            : null,
      },
      stellarMainnetAddresses: {
        connection:
          typeof balancedOfficialMainnetAddresses?.connection === "string"
            ? (balancedOfficialMainnetAddresses.connection as string)
            : null,
        assetManager:
          typeof balancedOfficialMainnetAddresses?.assetManager === "string"
            ? (balancedOfficialMainnetAddresses.assetManager as string)
            : null,
        xTokenManager:
          typeof balancedOfficialMainnetAddresses?.xTokenManager === "string"
            ? (balancedOfficialMainnetAddresses.xTokenManager as string)
            : null,
        rateLimit:
          typeof balancedOfficialMainnetAddresses?.rateLimit === "string"
            ? (balancedOfficialMainnetAddresses.rateLimit as string)
            : null,
      },
      findings: Array.isArray(balancedOfficialSurface.findings)
        ? balancedOfficialSurface.findings.filter(
            (value): value is string => typeof value === "string",
          )
        : [],
      source: "deployments",
    },
    source: "deployments",
  });
}

export async function readBalancedProtocolHealth(
  readFileImpl: typeof readFile = readFile,
  env: NodeJS.ProcessEnv = process.env,
): Promise<BalancedProtocolHealthPayload> {
  try {
    const raw = await readFileImpl(resolveArkafundDeploymentsPath(env), "utf8");
    return extractBalancedProtocolHealth(JSON.parse(raw));
  } catch {
    return buildBalancedFallbackPayload();
  }
}
