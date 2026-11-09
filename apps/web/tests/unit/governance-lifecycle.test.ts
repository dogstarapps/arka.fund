import { describe, expect, it } from "vitest";
import {
  buildGovernanceLifecycleCommands,
  type GovernanceLifecycleSnapshot,
} from "@/lib/workflows/governanceLifecycle";

const READY_SNAPSHOT: GovernanceLifecycleSnapshot = {
  canAct: true,
  hasProposalId: true,
  loading: false,
  proposalKind: "Council",
  proposalIdLabel: "#12",
  supportLabel: "For",
  walletLabel: "GCFLOW...4WX",
  hasExecutableProposal: true,
  proposalTitle: "Rotate council",
  proposalStatus: "Executed",
  queuedPackageLabel: "set_allowed_venues",
};

describe("governance lifecycle workflow", () => {
  it("builds a complete command set for the governor lifecycle", () => {
    const commands = buildGovernanceLifecycleCommands(READY_SNAPSHOT);

    expect(commands.map((command) => command.id)).toEqual([
      "propose",
      "vote",
      "close",
      "execute",
      "refresh",
    ]);
    expect(commands.every((command) => command.readiness.length >= 3)).toBe(
      true,
    );
  });

  it("keeps wallet-gated commands disabled until an authorised signer is available", () => {
    const commands = buildGovernanceLifecycleCommands({
      ...READY_SNAPSHOT,
      canAct: false,
      walletLabel: "Offline",
    });

    expect(commands.find((command) => command.id === "propose")).toMatchObject({
      disabled: true,
      statusLabel: "Wallet required",
    });
    expect(commands.find((command) => command.id === "vote")).toMatchObject({
      disabled: true,
      statusLabel: "Not ready",
    });
    expect(commands.find((command) => command.id === "refresh")).toMatchObject({
      disabled: false,
      statusLabel: "Live read",
    });
  });

  it("blocks execute until the selected proposal reaches the timelock window", () => {
    const execute = buildGovernanceLifecycleCommands({
      ...READY_SNAPSHOT,
      hasExecutableProposal: false,
    }).find((command) => command.id === "execute");

    expect(execute).toMatchObject({
      disabled: true,
      statusLabel: "Window closed",
      statusTone: "warning",
    });
    expect(execute?.disabledReason).toContain("timelock");
  });

  it("derives proposal readiness and staged package context from the snapshot", () => {
    const propose = buildGovernanceLifecycleCommands(READY_SNAPSHOT).find(
      (command) => command.id === "propose",
    );

    expect(propose?.statusLabel).toBe("Council");
    expect(propose?.readiness).toContainEqual({
      label: "Staged package",
      value: "set_allowed_venues",
      tone: "positive",
    });
  });
});
