import { readLeaderboardSourceSnapshot } from "@/lib/runtime/leaderboardSource";
import { deriveOracleCutoverGate } from "@/lib/runtime/oracleCutoverGate";
import { deriveBalancedAutoSurfaceGate } from "@/lib/runtime/balancedAutoSurfaceGate";
import {
  readBalancedProtocolHealth,
  resolveArkafundDeployments,
} from "@/lib/runtime/protocolSupport";
import { readFigmaPixelAuditGate } from "@/lib/qa/figmaPixelAuditGate";
import { readRebalanceCanaryGate } from "@/lib/runtime/rebalanceCanaryGate";
import { deriveRebalanceBenchmarkGate } from "@/lib/runtime/rebalanceBenchmarkGate";
import { readProductionEnvironmentGate } from "@/lib/runtime/productionEnvironmentGate";
import { readTestnetDressRehearsalGate } from "@/lib/runtime/testnetDressRehearsal.mjs";
import { requireOperatorApiSession } from "@/lib/server/operatorApiGuard";
import { runRebalanceBenchmarkSuite } from "@/lib/workflows/rebalanceBenchmark";
import { buildContractsSecurityAuditSnapshot } from "@/lib/contracts/securityAudit";
import { buildApiHardeningSnapshot, jsonNoStore } from "@/lib/server/apiHardening";

export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<Response> {
  const unauthorized = requireOperatorApiSession(request);
  if (unauthorized) {
    return unauthorized;
  }

  const deploymentResolution = resolveArkafundDeployments();
  const [oracleSnapshot, balanced, routingBenchmarkResult, visualPixelAudit] = await Promise.all([
    readLeaderboardSourceSnapshot(),
    readBalancedProtocolHealth(),
    runRebalanceBenchmarkSuite()
      .then((benchmark) => ({ benchmark }))
      .catch((error: unknown) => ({
        error: error instanceof Error ? error.message : String(error),
    })),
    Promise.resolve(readFigmaPixelAuditGate()),
  ]);
  const oracleCutover = deriveOracleCutoverGate(oracleSnapshot, {
    enforceMainnetOnly: true,
  });
  const balancedAutoSurface = deriveBalancedAutoSurfaceGate(balanced, {
    targetNetwork: deploymentResolution.networkTarget,
    enforceMainnetOnly: true,
  });
  const routingBenchmark =
    "benchmark" in routingBenchmarkResult
      ? deriveRebalanceBenchmarkGate(routingBenchmarkResult.benchmark)
      : deriveRebalanceBenchmarkGate(null, routingBenchmarkResult.error);
  const routingCanary = readRebalanceCanaryGate(deploymentResolution);
  const securityAudit = buildContractsSecurityAuditSnapshot().releaseGate;
  const apiHardening = buildApiHardeningSnapshot().releaseGate;
  const productionEnvironment = readProductionEnvironmentGate();
  const testnetDressRehearsal = readTestnetDressRehearsalGate();
  const visualPixelAuditAdvisory = {
    ...visualPixelAudit,
    releaseBlocking: false,
    advisory: true,
    detail: visualPixelAudit.ready
      ? visualPixelAudit.detail
      : `${visualPixelAudit.detail} This is tracked as visual QA advisory and does not block mainnet cutover.`,
  };
  const releaseReady =
    oracleCutover.ready &&
    balancedAutoSurface.ready &&
    routingBenchmark.ready &&
    routingCanary.ready &&
    securityAudit.ready &&
    apiHardening.ready &&
    productionEnvironment.ready &&
    testnetDressRehearsal.ready;
  return jsonNoStore(
    {
      ok: releaseReady,
      generatedAt: new Date().toISOString(),
      gates: {
        oracleCutover,
        balancedAutoSurface,
        routingBenchmark,
        routingCanary,
        securityAudit,
        apiHardening,
        productionEnvironment,
        testnetDressRehearsal,
        visualPixelAudit: visualPixelAuditAdvisory,
      },
    },
    { status: releaseReady ? 200 : 503 },
  );
}
