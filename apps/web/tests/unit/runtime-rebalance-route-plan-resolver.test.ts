import { describe, expect, it, vi } from "vitest";
import { resolveRuntimeRebalanceRoutePlan } from "@/lib/runtime/rebalanceRoutePlanResolver";

describe("runtime rebalance route plan resolver", () => {
  const requestPayload = {
    requestedProtocol: "AUTO" as const,
    amountBase: 10_000_000,
    tokenIn: "CAAA",
    tokenOut: "CBBB",
    slippagePct: 1,
    manualMinOutBase: 0,
  };

  it("prefers backend planner output and skips local fallback when backend is available", async () => {
    const backendPlan = {
      requestedProtocol: "AUTO" as const,
      selectedProtocol: "BALANCED" as const,
      selectedCandidate: null,
      estimatedOutBase: 11_100_000,
      minOutBase: 10_900_000,
      note: "backend",
      candidates: [],
    };
    const requestBackendPlan = vi.fn(async () => ({ plan: backendPlan }));
    const resolveLocalPlan = vi.fn(async () => {
      throw new Error("local should not run");
    });

    const plan = await resolveRuntimeRebalanceRoutePlan({
      requestPayload,
      requestBackendPlan,
      resolveLocalPlan,
    });

    expect(plan).toEqual(backendPlan);
    expect(requestBackendPlan).toHaveBeenCalledTimes(1);
    expect(resolveLocalPlan).not.toHaveBeenCalled();
  });

  it("falls back to local planner output when backend fails", async () => {
    const requestBackendPlan = vi.fn(async () => {
      throw new Error("backend unavailable");
    });
    const localPlan = {
      requestedProtocol: "AUTO" as const,
      selectedProtocol: "AQUARIUS" as const,
      selectedCandidate: null,
      estimatedOutBase: 9_000_000,
      minOutBase: 8_900_000,
      note: "local",
      candidates: [],
    };
    const resolveLocalPlan = vi.fn(async () => localPlan);

    const plan = await resolveRuntimeRebalanceRoutePlan({
      requestPayload,
      requestBackendPlan,
      resolveLocalPlan,
    });

    expect(plan).toEqual(localPlan);
    expect(requestBackendPlan).toHaveBeenCalledTimes(1);
    expect(resolveLocalPlan).toHaveBeenCalledTimes(1);
  });

  it("throws when both planners fail and failure mode is throw", async () => {
    const requestBackendPlan = vi.fn(async () => {
      throw new Error("backend timeout");
    });
    const resolveLocalPlan = vi.fn(async () => {
      throw new Error("local solver panic");
    });

    await expect(
      resolveRuntimeRebalanceRoutePlan({
        requestPayload,
        requestBackendPlan,
        resolveLocalPlan,
        failureMode: "throw",
      }),
    ).rejects.toThrow(
      "Backend planner failed (backend timeout); local fallback failed (local solver panic).",
    );
  });

  it("returns an idle plan when both planners fail and failure mode is idle", async () => {
    const requestBackendPlan = vi.fn(async () => {
      throw new Error("backend timeout");
    });
    const resolveLocalPlan = vi.fn(async () => {
      throw new Error("local solver panic");
    });

    const plan = await resolveRuntimeRebalanceRoutePlan({
      requestPayload,
      requestBackendPlan,
      resolveLocalPlan,
      failureMode: "idle",
    });

    expect(plan.requestedProtocol).toBe("AUTO");
    expect(plan.note).toBe(
      "Backend planner failed (backend timeout); local fallback failed (local solver panic).",
    );
    expect(plan.selectedProtocol).toBe("SOROSWAP");
  });
});
