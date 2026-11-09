import type {
  BalancedProtocolHealthPayload,
  RoutingSolverHealthPayload,
} from "@/lib/runtime/appHealth";
import { deriveBalancedAutoSurfaceReadiness } from "@/lib/runtime/balancedAutoSurfaceGate";
import { buildBalancedIntentExecutionDriver } from "@/lib/workflows/intentExecutionDrivers";

export function deriveRoutingSolverHealth(
  balanced: BalancedProtocolHealthPayload,
  generatedAt: string | null = null,
): RoutingSolverHealthPayload {
  const driver = buildBalancedIntentExecutionDriver(balanced);
  const autoSurface = deriveBalancedAutoSurfaceReadiness(balanced);
  return {
    mode: "backend_solver_with_local_fallback",
    planEndpoint: "/api/routing/rebalance/plan",
    fallbackMode: "local_workflow_solver",
    backendAvailable: true,
    generatedAt,
    balancedPlannerAdmission: driver.plannerAdmission,
    balancedManualExecutionEligible: driver.manualExecutionEligible,
    balancedComparableQuote: driver.comparableQuote,
    balancedSupportStatus: balanced.supportStatus,
    balancedLaneMode: balanced.laneMode,
    balancedAutoSurfaceReady: autoSurface.autoReady,
    balancedAutoSurfaceReason: autoSurface.reason,
    note:
      driver.plannerDetail ||
      balanced.blockingReasons[0] ||
      "Routing solver is available and keeps local fallback when backend plan resolution is unavailable.",
  };
}
