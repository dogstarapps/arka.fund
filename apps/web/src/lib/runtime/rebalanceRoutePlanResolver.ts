import {
  createIdleRebalanceRoutePlan,
  type RebalanceRoutePlan,
} from "@/lib/workflows/rebalanceRouting";
import {
  requestRebalanceRoutePlan,
  type RebalanceRoutePlanRequest,
  type RebalanceRoutePlanResponse,
} from "@/lib/runtime/rebalanceRoutePlanApi";

export type RebalanceRoutePlanFailureMode = "throw" | "idle";

type BackendPlanner = (
  payload: RebalanceRoutePlanRequest,
) => Promise<Pick<RebalanceRoutePlanResponse, "plan">>;

export type ResolveRuntimeRebalanceRoutePlanInput = {
  requestPayload: RebalanceRoutePlanRequest;
  resolveLocalPlan: () => Promise<RebalanceRoutePlan>;
  requestBackendPlan?: BackendPlanner;
  failureMode?: RebalanceRoutePlanFailureMode;
};

function describePlannerError(error: unknown): string {
  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message;
  }
  if (typeof error === "string" && error.trim().length > 0) {
    return error;
  }
  return "unknown error";
}

function formatDualPlannerFailureMessage(
  backendError: unknown,
  localError: unknown,
): string {
  return `Backend planner failed (${describePlannerError(backendError)}); local fallback failed (${describePlannerError(localError)}).`;
}

export async function resolveRuntimeRebalanceRoutePlan(
  input: ResolveRuntimeRebalanceRoutePlanInput,
): Promise<RebalanceRoutePlan> {
  const backendPlanner = input.requestBackendPlan ?? requestRebalanceRoutePlan;
  try {
    const response = await backendPlanner(input.requestPayload);
    return response.plan;
  } catch (backendError) {
    try {
      return await input.resolveLocalPlan();
    } catch (localError) {
      if ((input.failureMode ?? "throw") === "idle") {
        return {
          ...createIdleRebalanceRoutePlan(input.requestPayload.requestedProtocol),
          note: formatDualPlannerFailureMessage(backendError, localError),
        };
      }
      throw new Error(formatDualPlannerFailureMessage(backendError, localError));
    }
  }
}
