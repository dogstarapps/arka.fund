import { describe, expect, it } from "vitest";
import {
  buildStatusWorkspaceSignals,
  buildStatusWorkspaceState,
  resolveStatusWorkspaceId,
  STATUS_WORKSPACE_TABS,
  type StatusWorkspaceId,
  type StatusWorkspaceSnapshot,
} from "@/lib/workflows/statusWorkspaces";

const SNAPSHOT: StatusWorkspaceSnapshot = {
  networkLiveLabel: "Testnet live",
  scopeCount: 3,
  operatorCount: 4,
  limitationCount: 3,
  referenceCount: 1,
  profile: "standard",
  oracleGateState: "Blocked",
  oracleTargetNetwork: "testnet",
  oracleMode: "unverified",
  routingMode: "backend_solver_with_local_fallback",
  routingBackendAvailable: false,
  balancedPlannerAdmission: "blocked",
};

describe("status workspaces", () => {
  it("declares the status control-room workspaces", () => {
    expect(STATUS_WORKSPACE_TABS.map((tab) => tab.id)).toEqual([
      "baseline",
      "operator",
      "oracle",
      "routing",
      "limits",
      "links",
    ]);
    expect(resolveStatusWorkspaceId("routing")).toBe("routing");
    expect(resolveStatusWorkspaceId("bad")).toBe("baseline");
  });

  it.each<StatusWorkspaceId>([
    "baseline",
    "operator",
    "oracle",
    "routing",
    "limits",
    "links",
  ])("builds focused status signals for %s", (workspace) => {
    const state = buildStatusWorkspaceState(SNAPSHOT, workspace);

    expect(state.tab.id).toBe(workspace);
    expect(state.signals).toHaveLength(3);
    expect(state.signals.every((signal) => signal.label && signal.value)).toBe(
      true,
    );
  });

  it("keeps oracle and routing blocked when runtime gates are blocked", () => {
    expect(buildStatusWorkspaceSignals(SNAPSHOT, "oracle")[0]).toMatchObject({
      id: "gate",
      value: "Blocked",
      tone: "warning",
    });
    expect(buildStatusWorkspaceSignals(SNAPSHOT, "routing")[1]).toMatchObject({
      id: "backend",
      value: "Fallback",
      tone: "warning",
    });
  });
});
