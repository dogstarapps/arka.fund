import { afterEach, describe, expect, it, vi } from "vitest";
import { GOVERNED_ACTION_TEMPLATES } from "@/lib/workflows/governanceComposer";

describe("contracts mutation matrix", () => {
  const originalExecutorId = process.env.NEXT_PUBLIC_GOVERNANCE_EXECUTOR_ID;

  afterEach(() => {
    vi.resetModules();
    if (originalExecutorId === undefined) {
      delete process.env.NEXT_PUBLIC_GOVERNANCE_EXECUTOR_ID;
    } else {
      process.env.NEXT_PUBLIC_GOVERNANCE_EXECUTOR_ID = originalExecutorId;
    }
  });

  it("builds a machine-consumable snapshot with category totals", async () => {
    const { buildContractsMutationMatrixSnapshot } = await import(
      "@/lib/contracts/mutationMatrix"
    );
    const snapshot = buildContractsMutationMatrixSnapshot(
      "2026-04-17T10:00:00.000Z",
    );

    expect(snapshot.generatedAt).toBe("2026-04-17T10:00:00.000Z");
    expect(snapshot.summary.total).toBe(snapshot.entries.length);
    expect(snapshot.summary.total).toBe(GOVERNED_ACTION_TEMPLATES.length);
    expect(snapshot.summary.total).toBeGreaterThanOrEqual(48);
    expect(snapshot.summary.byCategory.oracle.total).toBeGreaterThanOrEqual(6);
    expect(snapshot.summary.byCategory.fees.total).toBeGreaterThanOrEqual(5);
    expect(snapshot.summary.byCategory.coverage.total).toBeGreaterThanOrEqual(13);
    expect(snapshot.summary.byCategory.governance.total).toBeGreaterThanOrEqual(5);
    expect(snapshot.summary.byCategory.authority.total).toBeGreaterThanOrEqual(8);
    expect(snapshot.summary.byCategory.credit.total).toBeGreaterThanOrEqual(2);
    expect(snapshot.summary.byCategory.policy.total).toBeGreaterThanOrEqual(3);
    expect(snapshot.summary.bySeverity.critical.total).toBeGreaterThanOrEqual(30);
    expect(snapshot.summary.daoExecutorRequired).toBeGreaterThanOrEqual(35);
    expect(snapshot.summary.walletBackedExecutable).toBeGreaterThanOrEqual(0);

    const matrixWriteActions = new Set(snapshot.entries.map((entry) => entry.writeActionId));
    const governedWriteActions = GOVERNED_ACTION_TEMPLATES.map((template) => template.actionId);
    expect([...matrixWriteActions].sort()).toEqual([...governedWriteActions].sort());
    expect(matrixWriteActions.size).toBe(snapshot.entries.length);

    const runtimeArkaEntries = snapshot.entries.filter(
      (entry) => entry.contractRequirement === "runtime_input",
    );
    expect(runtimeArkaEntries.length).toBeGreaterThanOrEqual(9);
    expect(runtimeArkaEntries.every((entry) => entry.status === "ready")).toBe(
      true,
    );
    expect(
      runtimeArkaEntries.every((entry) => entry.contractId === null),
    ).toBe(true);

    for (const entry of snapshot.entries) {
      expect(entry.title.trim()).not.toBe("");
      expect(entry.description.trim()).not.toBe("");
      expect(entry.writeActionId.trim()).not.toBe("");
      expect(entry.writeMethod.trim()).not.toBe("");
      expect(entry.readActionId.trim()).not.toBe("");
      expect(entry.severity).toMatch(/critical|high|medium/);
      expect(entry.executionLane).toMatch(/wallet_backed|dao_executor|blocked_missing_contract|blocked_manual_runbook/);
      expect(entry.preconditions.length).toBeGreaterThanOrEqual(3);
      expect(entry.riskControls.length).toBeGreaterThanOrEqual(3);
      expect(entry.postStateAssertion.trim()).not.toBe("");
      expect(entry.stateProbe.trim()).not.toBe("");
      expect(entry.rollbackStrategy.trim()).not.toBe("");
      expect(entry.e2eScenario.trim()).not.toBe("");
      expect(entry.postStateAssertion).toMatch(/read|verify|require|compare/i);
      expect(entry.rollbackStrategy).toMatch(/restore|remove|reapply/i);
    }

    const manualRunbookRows = snapshot.entries
      .filter((entry) => entry.status === "blocked_manual_runbook")
      .map((entry) => entry.writeActionId)
      .sort();
    expect(manualRunbookRows).toEqual(
      expect.arrayContaining([
        "arka-factory-set-governor",
        "arka-factory-set-implementation",
        "arka-factory-set-registry",
        "claims-manager-set-risk-operator",
      ]),
    );
  });

  it("marks executor mutations as blocked when no executor contract is configured", async () => {
    delete process.env.NEXT_PUBLIC_GOVERNANCE_EXECUTOR_ID;
    const { buildContractsMutationMatrixSnapshot } = await import(
      "@/lib/contracts/mutationMatrix"
    );
    const snapshot = buildContractsMutationMatrixSnapshot();

    const executorEntries = snapshot.entries.filter(
      (entry) => entry.category === "executor",
    );
    expect(executorEntries.length).toBe(4);
    expect(
      executorEntries.every(
        (entry) =>
          entry.contractRequirement === "configured" &&
          entry.status === "blocked_missing_contract",
      ),
    ).toBe(true);
    expect(
      executorEntries.every((entry) => entry.daoExecutorRequired),
    ).toBe(true);
    expect(
      executorEntries.every((entry) => entry.executionLane === "blocked_missing_contract"),
    ).toBe(true);
  });

  it("marks executor mutations as ready when executor id is configured", async () => {
    process.env.NEXT_PUBLIC_GOVERNANCE_EXECUTOR_ID =
      "CEXECUTOR1234567890ABCDEFGHIJKLMNOPQRSTUVWXYZA1234567890AB";
    const { buildContractsMutationMatrixSnapshot } = await import(
      "@/lib/contracts/mutationMatrix"
    );
    const snapshot = buildContractsMutationMatrixSnapshot();

    const executorEntries = snapshot.entries.filter(
      (entry) => entry.category === "executor",
    );
    expect(executorEntries.length).toBe(4);
    expect(
      executorEntries.every(
        (entry) =>
          entry.contractId ===
          "CEXECUTOR1234567890ABCDEFGHIJKLMNOPQRSTUVWXYZA1234567890AB",
      ),
    ).toBe(true);
    const readyExecutorEntries = executorEntries.filter((entry) => entry.status === "ready");
    const runbookExecutorEntries = executorEntries.filter(
      (entry) => entry.status === "blocked_manual_runbook",
    );
    expect(readyExecutorEntries.map((entry) => entry.id).sort()).toEqual([
      "executor-grace-period",
      "executor-min-delay",
    ]);
    expect(runbookExecutorEntries.map((entry) => entry.id).sort()).toEqual([
      "executor-admin",
      "executor-governor",
    ]);
    expect(readyExecutorEntries.every((entry) => entry.executionLane === "wallet_backed")).toBe(true);
    expect(runbookExecutorEntries.every((entry) => entry.executionLane === "blocked_manual_runbook")).toBe(true);
    expect(snapshot.summary.walletBackedExecutable).toBeGreaterThanOrEqual(2);
  });

  it("DAO guards non-set critical methods that can mutate governed state", async () => {
    const { buildContractsMutationMatrixSnapshot } = await import(
      "@/lib/contracts/mutationMatrix"
    );
    const snapshot = buildContractsMutationMatrixSnapshot();

    const clearPolicy = snapshot.entries.find(
      (entry) => entry.writeActionId === "oracle-guard-clear-stellar-asset-policy",
    );
    expect(clearPolicy).toMatchObject({
      daoExecutorRequired: true,
      executionLane: "dao_executor",
      rollbackActionId: "oracle-guard-set-stellar-asset-policy",
    });

    const guardian = snapshot.entries.find(
      (entry) => entry.writeActionId === "oracle-guard-set-guardian",
    );
    expect(guardian).toMatchObject({
      daoExecutorRequired: true,
      executionLane: "dao_executor",
      rollbackActionId: "oracle-guard-clear-guardian",
    });

    const resumePolicy = snapshot.entries.find(
      (entry) => entry.writeActionId === "oracle-guard-resume-stellar-asset-policy",
    );
    expect(resumePolicy).toMatchObject({
      daoExecutorRequired: true,
      executionLane: "dao_executor",
      rollbackActionId: "oracle-guard-pause-stellar-asset-policy",
    });

    const addPoints = snapshot.entries.find(
      (entry) => entry.writeActionId === "manager-tier-add-points",
    );
    expect(addPoints).toMatchObject({
      daoExecutorRequired: true,
      executionLane: "dao_executor",
      rollbackActionId: null,
    });
  });
});
