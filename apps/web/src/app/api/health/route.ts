import {
  readCatalogHealth,
  resolveCatalogApiBaseUrl,
} from "@/lib/runtime/health";
import { readOnchainCatalogSnapshot } from "@/lib/catalog/onchainFallback";
import { readLeaderboardSourceSnapshot } from "@/lib/runtime/leaderboardSource";
import {
  readBalancedProtocolHealth,
  resolveArkafundDeployments,
} from "@/lib/runtime/protocolSupport";
import { deriveRoutingSolverHealth } from "@/lib/runtime/rebalanceRoutingStatus";
import { deriveOracleCutoverGate } from "@/lib/runtime/oracleCutoverGate";
import { deriveBalancedAutoSurfaceGate } from "@/lib/runtime/balancedAutoSurfaceGate";
import { jsonNoStore, redactApiText } from "@/lib/server/apiHardening";

export const dynamic = "force-dynamic";

const ONCHAIN_FALLBACK_HEALTH_TIMEOUT_MS = 8_000;

async function withTimeout<T>(
  promise: Promise<T>,
  ms: number,
): Promise<T | null> {
  let timeout: ReturnType<typeof setTimeout> | null = null;
  try {
    return await Promise.race([
      promise,
      new Promise<null>((resolve) => {
        timeout = setTimeout(() => resolve(null), ms);
      }),
    ]);
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}

export async function GET(): Promise<Response> {
  const catalogBaseUrl = resolveCatalogApiBaseUrl();
  const [balanced, oracle] = await Promise.all([
    readBalancedProtocolHealth(),
    readLeaderboardSourceSnapshot(),
  ]);
  const deploymentResolution = resolveArkafundDeployments();
  const generatedAt = new Date().toISOString();
  const routing = deriveRoutingSolverHealth(balanced, generatedAt);
  const oracleCutoverGate = deriveOracleCutoverGate(oracle, {
    enforceMainnetOnly: true,
  });
  const balancedAutoSurfaceGate = deriveBalancedAutoSurfaceGate(balanced, {
    targetNetwork: deploymentResolution.networkTarget,
    enforceMainnetOnly: true,
  });
  if (!catalogBaseUrl) {
    try {
      const fallbackCatalog = await withTimeout(
        readOnchainCatalogSnapshot(),
        ONCHAIN_FALLBACK_HEALTH_TIMEOUT_MS,
      );
      if (!fallbackCatalog) {
        return jsonNoStore(
          {
            app: "ok",
            catalog: {
              configured: false,
              source: "onchain_fallback",
              reachable: false,
              healthy: false,
              degraded: true,
              statusCode: 0,
              evaluatedAt: null,
              indexedArkas: 0,
              failedArkas: 0,
              error: "On-chain catalog fallback timed out.",
            },
            protocols: {
              balanced,
            },
            routing,
            oracle,
            releaseGate: {
              oracleCutover: oracleCutoverGate,
              balancedAutoSurface: balancedAutoSurfaceGate,
            },
          },
          { status: 503 },
        );
      }
      const catalogHealthy = fallbackCatalog.failures.length === 0;
      return jsonNoStore(
        {
          app: "ok",
          catalog: {
            configured: false,
            source: fallbackCatalog.source,
            reachable: true,
            healthy: catalogHealthy,
            degraded: !catalogHealthy,
            statusCode: catalogHealthy ? 200 : 206,
            evaluatedAt: fallbackCatalog.syncedAt,
            indexedArkas: fallbackCatalog.arkas.length,
            failedArkas: fallbackCatalog.failures.length,
            error: catalogHealthy
              ? null
              : `${fallbackCatalog.failures.length} Arka reads failed during on-chain catalog fallback.`,
          },
          protocols: {
            balanced,
          },
          routing,
          oracle,
          releaseGate: {
            oracleCutover: oracleCutoverGate,
            balancedAutoSurface: balancedAutoSurfaceGate,
          },
        },
        { status: catalogHealthy ? 200 : 503 },
      );
    } catch (error) {
      return jsonNoStore(
        {
          app: "ok",
          catalog: {
            configured: false,
            source: "onchain_fallback",
            reachable: false,
            healthy: false,
            degraded: false,
            statusCode: 0,
            evaluatedAt: null,
            error: redactApiText(
              error,
              "Catalog API base URL is not configured and on-chain fallback failed.",
            ),
          },
          protocols: {
            balanced,
          },
          routing,
          oracle,
          releaseGate: {
            oracleCutover: oracleCutoverGate,
            balancedAutoSurface: balancedAutoSurfaceGate,
          },
        },
        { status: 503 },
      );
    }
  }

  const catalog = await readCatalogHealth(catalogBaseUrl);
  const status = catalog.reachable && catalog.healthy ? 200 : 503;
  return jsonNoStore(
    {
      app: "ok",
      catalog: {
        configured: true,
        baseUrl: "[redacted]",
        baseUrlConfigured: true,
        reachable: catalog.reachable,
        healthy: catalog.healthy,
        degraded: catalog.degraded,
        statusCode: catalog.statusCode,
        evaluatedAt: catalog.evaluatedAt,
        error: catalog.error ? redactApiText(catalog.error, catalog.error) : null,
      },
      protocols: {
        balanced,
      },
      routing,
      oracle,
      releaseGate: {
        oracleCutover: oracleCutoverGate,
        balancedAutoSurface: balancedAutoSurfaceGate,
      },
    },
    { status },
  );
}
