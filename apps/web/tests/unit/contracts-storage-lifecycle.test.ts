import { describe, expect, it } from "vitest";
import { buildContractsStorageLifecycleSnapshot } from "@/lib/contracts/storageLifecycle";

describe("contracts storage lifecycle snapshot", () => {
  it("builds a machine-consumable snapshot with category totals and commands", () => {
    const snapshot = buildContractsStorageLifecycleSnapshot(
      {
        ARKAFUND_STORAGE_EXTEND_SOURCE_ACCOUNT:
          "GCO7KAJ7WCIFDLAEDHKSFQRNQLR3SQ6JTIVSMYYFUC5KRTA2KG2QJYDE",
        STELLAR_RPC_URL: "https://soroban-testnet.stellar.org",
        STELLAR_NETWORK_PASSPHRASE: "Test SDF Network ; September 2015",
      },
      "2026-04-17T11:00:00.000Z",
    );

    expect(snapshot.generatedAt).toBe("2026-04-17T11:00:00.000Z");
    expect(snapshot.summary.total).toBe(snapshot.entries.length);
    expect(snapshot.entries.length).toBeGreaterThanOrEqual(16);
    expect(snapshot.summary.byCategory.core.total).toBeGreaterThanOrEqual(2);
    expect(snapshot.summary.byCategory.routing.total).toBeGreaterThanOrEqual(4);
    expect(snapshot.summary.byCategory.coverage.total).toBeGreaterThanOrEqual(3);
    expect(snapshot.summary.byCategory.governance.total).toBeGreaterThanOrEqual(4);
    expect(snapshot.summary.byCategory.oracle.total).toBeGreaterThanOrEqual(1);
    expect(snapshot.summary.byStorageClass.persistent.audited).toBe(snapshot.entries.length);
    expect(snapshot.summary.byStorageClass.instance.audited).toBe(snapshot.entries.length);
    expect(snapshot.summary.byStorageClass.temporary.audited).toBe(snapshot.entries.length);
    expect(snapshot.summary.byStorageClass.persistent.extendable).toBe(snapshot.entries.length);
    expect(snapshot.summary.byStorageClass.instance.extendable).toBe(snapshot.entries.length);
    expect(snapshot.summary.byStorageClass.temporary.extendable).toBe(0);
    expect(snapshot.runbook.liveRunConfirmationEnv).toBe(
      "ARKAFUND_STORAGE_EXTEND_CONFIRM",
    );
    expect(snapshot.runbook.liveRunConfirmationValue).toBe("EXTEND_STORAGE_TTL");
    expect(snapshot.runbook.safeguards.join(" ")).toMatch(/defaults to dry-run/i);

    const readyEntries = snapshot.entries.filter((entry) => entry.status === "ready");
    expect(readyEntries.length).toBeGreaterThan(0);
    expect(readyEntries.every((entry) => entry.command?.startsWith("stellar contract extend"))).toBe(
      true,
    );
    expect(
      readyEntries.every(
        (entry) =>
          entry.commandArgs.includes("--durability") &&
          entry.commandArgs.includes("persistent") &&
          entry.commandArgs.includes("--ledgers-to-extend") &&
          entry.commandArgs.includes("518400") &&
          entry.storageClassesAudited.includes("persistent") &&
          entry.storageClassesAudited.includes("instance") &&
          entry.storageClassesAudited.includes("temporary") &&
          entry.extendScopes.includes("persistent_contract_data") &&
          entry.extendScopes.includes("instance_contract_state") &&
          entry.durability === "persistent" &&
          entry.temporaryPolicy.includes("intentionally excluded"),
      ),
    ).toBe(true);
  });

  it("marks rows blocked when source account is missing", () => {
    const snapshot = buildContractsStorageLifecycleSnapshot(
      {
        STELLAR_RPC_URL: "https://soroban-testnet.stellar.org",
      },
      "2026-04-17T11:00:00.000Z",
    );

    expect(snapshot.summary.blocked).toBeGreaterThan(0);
    expect(
      snapshot.entries.some((entry) => entry.status === "blocked_missing_source_account"),
    ).toBe(true);
    expect(
      snapshot.entries
        .filter((entry) => entry.status === "blocked_missing_source_account")
        .every((entry) => entry.command === null),
    ).toBe(true);
  });

  it("marks governance executor as optional when not configured", () => {
    const snapshot = buildContractsStorageLifecycleSnapshot(
      {
        ARKAFUND_STORAGE_EXTEND_SOURCE_ACCOUNT:
          "GCO7KAJ7WCIFDLAEDHKSFQRNQLR3SQ6JTIVSMYYFUC5KRTA2KG2QJYDE",
        NEXT_PUBLIC_GOVERNANCE_EXECUTOR_ID: "",
      },
      "2026-04-17T11:00:00.000Z",
    );

    const executorEntry = snapshot.entries.find(
      (entry) => entry.id === "governance-executor",
    );
    expect(executorEntry).toBeTruthy();
    expect(executorEntry?.status).toBe("optional_missing_contract");
    expect(snapshot.summary.optionalMissing).toBeGreaterThanOrEqual(1);
  });

  it("sanitizes invalid ledger windows and exposes release cadence thresholds", () => {
    const snapshot = buildContractsStorageLifecycleSnapshot(
      {
        ARKAFUND_STORAGE_EXTEND_SOURCE_ACCOUNT:
          "GCO7KAJ7WCIFDLAEDHKSFQRNQLR3SQ6JTIVSMYYFUC5KRTA2KG2QJYDE",
        ARKAFUND_STORAGE_EXTEND_LEDGERS: "-1",
      },
      "2026-05-20T11:00:00.000Z",
    );

    expect(snapshot.ledgersToExtend).toBe(518400);
    expect(snapshot.runbook.defaultCadenceDays).toBe(14);
    expect(snapshot.runbook.warningThresholdLedgers).toBeGreaterThan(
      snapshot.runbook.criticalThresholdLedgers,
    );
    expect(
      snapshot.entries.every(
        (entry) =>
          entry.cadenceDays === snapshot.runbook.defaultCadenceDays &&
          entry.warningThresholdLedgers === snapshot.runbook.warningThresholdLedgers &&
          entry.criticalThresholdLedgers === snapshot.runbook.criticalThresholdLedgers &&
          entry.runbookStepIds.includes("dry-run-plan") &&
          entry.runbookStepIds.includes("record-evidence"),
      ),
    ).toBe(true);
  });
});
