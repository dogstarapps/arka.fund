import { resolveArkafundDeployments } from "@/lib/runtime/protocolSupport";
import { readRebalanceCanaryGate } from "@/lib/runtime/rebalanceCanaryGate";
import { requireOperatorApiSession } from "@/lib/server/operatorApiGuard";
import { runRebalanceBenchmarkSuite } from "@/lib/workflows/rebalanceBenchmark";
import { jsonNoStore, redactApiText } from "@/lib/server/apiHardening";

export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<Response> {
  const unauthorized = requireOperatorApiSession(request);
  if (unauthorized) {
    return unauthorized;
  }

  try {
    const deploymentResolution = resolveArkafundDeployments();
    const benchmark = await runRebalanceBenchmarkSuite();
    const routingCanary = readRebalanceCanaryGate(deploymentResolution);
    return jsonNoStore({
      ok: true,
      source: "routing_benchmark",
      generatedAt: new Date().toISOString(),
      targetNetwork: deploymentResolution.networkTarget,
      benchmark,
      routingCanary,
    });
  } catch (error) {
    return jsonNoStore(
      {
        ok: false,
        source: "routing_benchmark",
        error: redactApiText(error, "Failed to run rebalance benchmark suite."),
      },
      { status: 500 },
    );
  }
}
