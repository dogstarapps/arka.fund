// @vitest-environment node

import { afterEach, describe, expect, it, vi } from "vitest";
import {
  OPERATOR_TEST_PUBLIC_KEY,
  OPERATOR_TEST_SECRET,
  operatorRequest,
} from "../helpers/operator-auth";

describe("GET /api/contracts/storage-lifecycle", () => {
  const originalSourceAccount = process.env.ARKAFUND_STORAGE_EXTEND_SOURCE_ACCOUNT;
  const originalExecutorId = process.env.NEXT_PUBLIC_GOVERNANCE_EXECUTOR_ID;

  afterEach(() => {
    vi.resetModules();
    vi.unstubAllEnvs();
    if (originalSourceAccount === undefined) {
      delete process.env.ARKAFUND_STORAGE_EXTEND_SOURCE_ACCOUNT;
    } else {
      process.env.ARKAFUND_STORAGE_EXTEND_SOURCE_ACCOUNT = originalSourceAccount;
    }
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
      "@/app/api/contracts/storage-lifecycle/route"
    );

    const response = await GET(
      new Request("http://localhost/api/contracts/storage-lifecycle"),
    );
    const payload = await response.json();

    expect(response.status).toBe(401);
    expect(payload.error).toBe("operator_access_required");
  });

  it("returns machine-consumable storage lifecycle coverage", async () => {
    configureOperatorAccess();
    process.env.ARKAFUND_STORAGE_EXTEND_SOURCE_ACCOUNT =
      "GCO7KAJ7WCIFDLAEDHKSFQRNQLR3SQ6JTIVSMYYFUC5KRTA2KG2QJYDE";
    const { GET } = await import(
      "@/app/api/contracts/storage-lifecycle/route"
    );

    const response = await GET(
      operatorRequest("http://localhost/api/contracts/storage-lifecycle"),
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.ok).toBe(true);
    expect(payload.source).toBe("api_contracts_storage_lifecycle");
    expect(payload.summary.total).toBe(payload.entries.length);
    expect(payload.summary.byCategory.routing.total).toBeGreaterThanOrEqual(4);
    expect(payload.summary.byStorageClass.persistent.audited).toBe(payload.entries.length);
    expect(payload.summary.byStorageClass.instance.extendable).toBe(payload.entries.length);
    expect(payload.summary.byStorageClass.temporary.extendable).toBe(0);
    expect(payload.runbook.liveRunConfirmationEnv).toBe(
      "ARKAFUND_STORAGE_EXTEND_CONFIRM",
    );
    expect(payload.runbook.liveRunConfirmationValue).toBe("EXTEND_STORAGE_TTL");
    expect(payload.runbook.rehearsalNetwork).toBe("testnet");
    expect(payload.entries.length).toBeGreaterThanOrEqual(16);
    expect(response.headers.get("cache-control")).toBe("no-store");

    const readyRows = (payload.entries as Array<{
      status: string;
      command: string | null;
      storageClassesAudited: string[];
      extendScopes: string[];
      temporaryPolicy: string;
    }>).filter((entry) => entry.status === "ready");
    expect(readyRows.length).toBeGreaterThan(0);
    expect(readyRows.every((entry) => typeof entry.command === "string")).toBe(
      true,
    );
    expect(
      readyRows.every(
        (entry) =>
          entry.storageClassesAudited.includes("persistent") &&
          entry.storageClassesAudited.includes("instance") &&
          entry.storageClassesAudited.includes("temporary") &&
          entry.extendScopes.includes("persistent_contract_data") &&
          entry.extendScopes.includes("instance_contract_state") &&
          entry.temporaryPolicy.includes("intentionally excluded"),
      ),
    ).toBe(true);
  });

  it("reports blocked rows when source account is missing", async () => {
    configureOperatorAccess();
    vi.stubEnv("ARKAFUND_STORAGE_EXTEND_SOURCE_ACCOUNT", "");
    const { GET } = await import(
      "@/app/api/contracts/storage-lifecycle/route"
    );

    const response = await GET(
      operatorRequest("http://localhost/api/contracts/storage-lifecycle"),
    );
    const payload = await response.json();

    const blockedRows = (payload.entries as Array<{ status: string }>).filter(
      (entry) => entry.status === "blocked_missing_source_account",
    );
    expect(blockedRows.length).toBeGreaterThan(0);
    expect(payload.readyForExecution).toBe(false);
  });
});
