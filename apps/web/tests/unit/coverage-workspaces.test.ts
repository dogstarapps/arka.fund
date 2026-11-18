import { describe, expect, it } from "vitest";
import {
  buildCoverageWorkspaceSignals,
  buildCoverageWorkspaceState,
  COVERAGE_WORKSPACE_TABS,
  getCoverageWorkspaceTab,
  resolveCoverageWorkspaceId,
  type CoverageWorkspaceId,
  type CoverageWorkspaceSnapshot,
} from "@/lib/workflows/coverageWorkspaces";

const SNAPSHOT: CoverageWorkspaceSnapshot = {
  vaultBalance: 500_000_000,
  vaultMaxWithdrawable: 100_000_000,
  fundStake: 120_000_000,
  fundPending: 30_000_000,
  walletTokenBalance: 80_000_000,
  walletLabel: "GCFLOW...TEST",
  canAct: true,
  utilizationBps: 8_000,
  hasHeadroom: true,
  userPosition: 150_000_000,
  stakeAmount: "1",
  unstakeAmount: "0.5",
};

describe("coverageWorkspaces", () => {
  it("defines the coverage console as three stateful workspaces", () => {
    expect(COVERAGE_WORKSPACE_TABS.map((tab) => tab.id)).toEqual([
      "state",
      "member",
      "actions",
    ]);

    for (const tab of COVERAGE_WORKSPACE_TABS) {
      expect(tab.label).not.toHaveLength(0);
      expect(tab.eyebrow).not.toHaveLength(0);
      expect(tab.description).not.toMatch(/\b(fake|stub|placeholder|todo)\b/i);
    }
  });

  it("resolves unknown workspace values to the reserve state lane", () => {
    expect(resolveCoverageWorkspaceId("member")).toBe("member");
    expect(resolveCoverageWorkspaceId("missing")).toBe("state");
    expect(resolveCoverageWorkspaceId(null, "actions")).toBe("actions");
    expect(getCoverageWorkspaceTab("actions")).toMatchObject({
      id: "actions",
      eyebrow: "Manage coverage",
    });
  });

  it.each<CoverageWorkspaceId>(["state", "member", "actions"])(
    "builds real coverage signals for %s",
    (workspace) => {
      const state = buildCoverageWorkspaceState(SNAPSHOT, workspace);

      expect(state.tab.id).toBe(workspace);
      expect(state.signals).toHaveLength(3);
      for (const signal of state.signals) {
        expect(signal.label).not.toHaveLength(0);
        expect(signal.value).not.toMatch(
          /\b(undefined|NaN|fake|stub|placeholder)\b/i,
        );
        expect(signal.detail).not.toMatch(
          /\b(undefined|NaN|fake|stub|placeholder)\b/i,
        );
      }
    },
  );

  it("keeps each workspace tied to live coverage values", () => {
    expect(buildCoverageWorkspaceSignals(SNAPSHOT, "state")[0]).toMatchObject({
      label: "Reserve balance",
      value: "50",
    });
    expect(buildCoverageWorkspaceSignals(SNAPSHOT, "member")[1]).toMatchObject({
      label: "Delegated stake",
      value: "12",
    });
    expect(buildCoverageWorkspaceSignals(SNAPSHOT, "actions")[1]).toMatchObject(
      {
        label: "Stake draft",
        value: "1",
      },
    );
  });
});
