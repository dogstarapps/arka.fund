import { readBalancedProtocolHealth } from "@/lib/runtime/protocolSupport";
import { deriveRoutingSolverHealth } from "@/lib/runtime/rebalanceRoutingStatus";
import { jsonNoStore, redactApiText } from "@/lib/server/apiHardening";
import {
  BalancedIntentSurfaceValidationError,
  requestBalancedIntentSurfaceLifecycle,
} from "@/lib/server/balancedIntentSurface";

export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<Response> {
  try {
    const { searchParams } = new URL(request.url);
    const intentTxHash = searchParams.get("intentTxHash");
    const balanced = await readBalancedProtocolHealth();
    const generatedAt = new Date().toISOString();
    const routing = deriveRoutingSolverHealth(balanced, generatedAt);
    let balancedIntentLifecycle:
      | Awaited<ReturnType<typeof requestBalancedIntentSurfaceLifecycle>>
      | null = null;
    if (intentTxHash && intentTxHash.trim().length > 0) {
      balancedIntentLifecycle = await requestBalancedIntentSurfaceLifecycle({
        intentTxHash,
      });
    }
    return jsonNoStore({
      ok: true,
      source: "api_routing_solver_status",
      generatedAt,
      routing,
      balancedIntentLifecycle,
    });
  } catch (error) {
    if (error instanceof BalancedIntentSurfaceValidationError) {
      return jsonNoStore(
        {
          ok: false,
          source: "api_routing_solver_status",
          error: redactApiText(error, error.message),
        },
        { status: 400 },
      );
    }
    return jsonNoStore(
      {
        ok: false,
        source: "api_routing_solver_status",
        error: redactApiText(error, "Failed to read routing solver status."),
      },
      { status: 500 },
    );
  }
}
