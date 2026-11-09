import { describe, expect, it } from "vitest";
import {
  methodRequiresDaoExecutor,
  shouldBlockRawWrite,
  shouldBlockTypedWrite,
} from "@/lib/workflows/daoExecutionPolicy";
import { GOVERNED_ACTION_TEMPLATES } from "@/lib/workflows/governanceComposer";

describe("dao execution policy", () => {
  it("classifies governance mutations by method convention and explicit set", () => {
    expect(methodRequiresDaoExecutor("set_governor")).toBe(true);
    expect(methodRequiresDaoExecutor("set_treasury")).toBe(true);
    expect(methodRequiresDaoExecutor("add_points")).toBe(true);
    expect(methodRequiresDaoExecutor("configure_credit_market")).toBe(true);
    expect(methodRequiresDaoExecutor("clear_stellar_asset_policy")).toBe(true);
    expect(methodRequiresDaoExecutor("set_guardian")).toBe(true);
    expect(methodRequiresDaoExecutor("pause_stellar_asset_policy")).toBe(true);
    expect(methodRequiresDaoExecutor("resume_stellar_asset_policy")).toBe(true);
    expect(methodRequiresDaoExecutor("register")).toBe(true);
    expect(methodRequiresDaoExecutor("deposit")).toBe(false);
    expect(methodRequiresDaoExecutor("")).toBe(false);
  });

  it("keeps every curated governance composer mutation inside the DAO executor policy", () => {
    for (const template of GOVERNED_ACTION_TEMPLATES) {
      expect(
        methodRequiresDaoExecutor(template.method),
        `${template.id} (${template.method}) should be DAO-governed`,
      ).toBe(true);
    }
  });

  it("blocks typed writes outside GovernanceExecutor when method is governance-sensitive", () => {
    expect(shouldBlockTypedWrite("write", "Arka", "set_governor")).toBe(true);
    expect(shouldBlockTypedWrite("write", "CoverageFund", "set_treasury")).toBe(true);
    expect(shouldBlockTypedWrite("write", "ClaimsManager", "register_covered_vault")).toBe(true);
    expect(shouldBlockTypedWrite("write", "OracleGuard", "clear_stellar_asset_policy")).toBe(true);
    expect(shouldBlockTypedWrite("write", "OracleGuard", "resume_stellar_asset_policy")).toBe(true);
    expect(shouldBlockTypedWrite("write", "OracleGuard", "pause_stellar_asset_policy")).toBe(true);
    expect(shouldBlockTypedWrite("write", "GovernanceExecutor", "set_admin")).toBe(false);
    expect(shouldBlockTypedWrite("read", "Arka", "set_governor")).toBe(false);
    expect(shouldBlockTypedWrite("write", "CoverageVault", "deposit")).toBe(false);
  });

  it("blocks raw writes unless target contract is the configured executor", () => {
    expect(
      shouldBlockRawWrite({
        mode: "write",
        method: "set_governor",
        contractId: "CARKA",
        governanceExecutorId: "CEXEC",
      }),
    ).toBe(true);
    expect(
      shouldBlockRawWrite({
        mode: "write",
        method: "set_governor",
        contractId: "CEXEC",
        governanceExecutorId: "CEXEC",
      }),
    ).toBe(false);
    expect(
      shouldBlockRawWrite({
        mode: "write",
        method: "deposit",
        contractId: "CARKA",
        governanceExecutorId: "CEXEC",
      }),
    ).toBe(false);
    expect(
      shouldBlockRawWrite({
        mode: "read",
        method: "set_governor",
        contractId: "CARKA",
        governanceExecutorId: "CEXEC",
      }),
    ).toBe(false);
    expect(
      shouldBlockRawWrite({
        mode: "write",
        method: "set_governor",
        contractId: "CARKA",
        governanceExecutorId: "",
      }),
    ).toBe(true);
  });
});
