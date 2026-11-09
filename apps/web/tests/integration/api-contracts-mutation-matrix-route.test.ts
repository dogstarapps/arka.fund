// @vitest-environment node

import { afterEach, describe, expect, it, vi } from "vitest";
import {
  OPERATOR_TEST_PUBLIC_KEY,
  OPERATOR_TEST_SECRET,
  operatorRequest,
} from "../helpers/operator-auth";
import { GOVERNED_ACTION_TEMPLATES } from "@/lib/workflows/governanceComposer";

describe("GET /api/contracts/mutation-matrix", () => {
  const originalExecutorId = process.env.NEXT_PUBLIC_GOVERNANCE_EXECUTOR_ID;

  afterEach(() => {
    vi.resetModules();
    vi.unstubAllEnvs();
    if (originalExecutorId === undefined) {
      delete process.env.NEXT_PUBLIC_GOVERNANCE_EXECUTOR_ID;
    } else {
      process.env.NEXT_PUBLIC_GOVERNANCE_EXECUTOR_ID = originalExecutorId;
    }
  });

  function configureOperatorAccess() {
    vi.stubEnv("OPERATOR_ACCESS_SECRET", OPERATOR_TEST_SECRET);
    vi.stubEnv("NEXT_PUBLIC_ARKA_MANAGER", OPERATOR_TEST_PUBLIC_KEY);
  }

  it("requires a verified operator session", async () => {
    const { GET } = await import(
      "@/app/api/contracts/mutation-matrix/route"
    );

    const response = await GET(
      new Request("http://localhost/api/contracts/mutation-matrix"),
    );
    const payload = await response.json();

    expect(response.status).toBe(401);
    expect(payload.error).toBe("operator_access_required");
  });

  it("returns machine-consumable critical mutation coverage", async () => {
    configureOperatorAccess();
    const { GET } = await import(
      "@/app/api/contracts/mutation-matrix/route"
    );

    const response = await GET(
      operatorRequest("http://localhost/api/contracts/mutation-matrix"),
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.ok).toBe(true);
    expect(payload.source).toBe("api_contracts_mutation_matrix");
    expect(Array.isArray(payload.entries)).toBe(true);
    expect(payload.entries.length).toBe(GOVERNED_ACTION_TEMPLATES.length);
    expect(payload.entries.length).toBeGreaterThanOrEqual(48);
    expect(payload.summary.total).toBe(payload.entries.length);
    expect(payload.summary.byCategory.oracle.total).toBeGreaterThanOrEqual(3);
    expect(payload.summary.byCategory.authority.total).toBeGreaterThanOrEqual(8);
    expect(payload.summary.byCategory.credit.total).toBeGreaterThanOrEqual(2);
    expect(payload.summary.byCategory.coverage.total).toBeGreaterThanOrEqual(13);
    expect(payload.summary.bySeverity.critical.total).toBeGreaterThanOrEqual(30);
    expect(payload.summary.daoExecutorRequired).toBeGreaterThanOrEqual(35);
    expect(payload.summary.walletBackedExecutable).toBeGreaterThanOrEqual(0);
    const writeActionIds = new Set(
      (payload.entries as Array<{ writeActionId: string }>).map((entry) => entry.writeActionId),
    );
    expect([...writeActionIds].sort()).toEqual(
      GOVERNED_ACTION_TEMPLATES.map((template) => template.actionId).sort(),
    );
    expect(writeActionIds.size).toBe(payload.entries.length);
    for (const entry of payload.entries as Array<{
      severity?: string;
      executionLane?: string;
      preconditions?: string[];
      postStateAssertion?: string;
      stateProbe?: string;
      rollbackStrategy?: string;
      riskControls?: string[];
      e2eScenario?: string;
      writeActionId?: string;
      readActionId?: string;
    }>) {
      expect(entry.writeActionId ?? "").toMatch(/\S/);
      expect(entry.readActionId ?? "").toMatch(/\S/);
      expect(entry.severity ?? "").toMatch(/critical|high|medium/);
      expect(entry.executionLane ?? "").toMatch(/wallet_backed|dao_executor|blocked_missing_contract|blocked_manual_runbook/);
      expect(entry.preconditions?.length ?? 0).toBeGreaterThanOrEqual(3);
      expect(entry.postStateAssertion ?? "").toMatch(/read|verify|require|compare/i);
      expect(entry.stateProbe ?? "").toMatch(/\S/);
      expect(entry.rollbackStrategy ?? "").toMatch(/restore|remove|reapply/i);
      expect(entry.riskControls?.length ?? 0).toBeGreaterThanOrEqual(3);
      expect(entry.e2eScenario ?? "").toMatch(/\S/);
    }
    const clearPolicy = (payload.entries as Array<{
      writeActionId: string;
      daoExecutorRequired: boolean;
      executionLane: string;
      rollbackActionId: string | null;
    }>).find((entry) => entry.writeActionId === "oracle-guard-clear-stellar-asset-policy");
    expect(clearPolicy).toMatchObject({
      daoExecutorRequired: true,
      executionLane: "dao_executor",
      rollbackActionId: "oracle-guard-set-stellar-asset-policy",
    });
    const guardianPolicy = (payload.entries as Array<{
      writeActionId: string;
      daoExecutorRequired: boolean;
      executionLane: string;
      rollbackActionId: string | null;
    }>).find((entry) => entry.writeActionId === "oracle-guard-set-guardian");
    expect(guardianPolicy).toMatchObject({
      daoExecutorRequired: true,
      executionLane: "dao_executor",
      rollbackActionId: "oracle-guard-clear-guardian",
    });
    const resumePolicy = (payload.entries as Array<{
      writeActionId: string;
      daoExecutorRequired: boolean;
      executionLane: string;
      rollbackActionId: string | null;
    }>).find((entry) => entry.writeActionId === "oracle-guard-resume-stellar-asset-policy");
    expect(resumePolicy).toMatchObject({
      daoExecutorRequired: true,
      executionLane: "dao_executor",
      rollbackActionId: "oracle-guard-pause-stellar-asset-policy",
    });
    expect(response.headers.get("cache-control")).toBe("no-store");
  });

  it("marks executor rows blocked when executor id is not configured", async () => {
    configureOperatorAccess();
    delete process.env.NEXT_PUBLIC_GOVERNANCE_EXECUTOR_ID;
    const { GET } = await import(
      "@/app/api/contracts/mutation-matrix/route"
    );

    const response = await GET(
      operatorRequest("http://localhost/api/contracts/mutation-matrix"),
    );
    const payload = await response.json();

    const executorRows = (payload.entries as Array<{ category: string; status: string }>).filter(
      (entry) => entry.category === "executor",
    );
    expect(executorRows.length).toBe(4);
    expect(
      executorRows.every((entry) => entry.status === "blocked_missing_contract"),
    ).toBe(true);
  });

  it("marks executor rows ready when executor id is configured", async () => {
    configureOperatorAccess();
    process.env.NEXT_PUBLIC_GOVERNANCE_EXECUTOR_ID =
      "CEXECUTOR1234567890ABCDEFGHIJKLMNOPQRSTUVWXYZA1234567890AB";
    const { GET } = await import(
      "@/app/api/contracts/mutation-matrix/route"
    );

    const response = await GET(
      operatorRequest("http://localhost/api/contracts/mutation-matrix"),
    );
    const payload = await response.json();

    const executorRows = (
      payload.entries as Array<{ category: string; status: string; contractId: string | null }>
    ).filter((entry) => entry.category === "executor");
    expect(executorRows.length).toBe(4);
    expect(
      executorRows.every(
        (entry) =>
          entry.contractId ===
          "CEXECUTOR1234567890ABCDEFGHIJKLMNOPQRSTUVWXYZA1234567890AB",
      ),
    ).toBe(true);
    const readyExecutorRows = executorRows.filter((entry) => entry.status === "ready");
    const runbookExecutorRows = executorRows.filter(
      (entry) => entry.status === "blocked_manual_runbook",
    );
    expect(readyExecutorRows.length).toBe(2);
    expect(runbookExecutorRows.length).toBe(2);
    expect(payload.summary.walletBackedExecutable).toBeGreaterThanOrEqual(2);
  });
});
