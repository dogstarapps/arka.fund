import { describe, expect, it } from "vitest";
import {
  ARKA_WORKSPACE_TABS,
  buildArkaWorkspaceCards,
  getArkaWorkspaceTab,
  resolveArkaWorkspaceId,
} from "@/lib/workflows/arkaWorkspaces";

describe("arka workspace model", () => {
  const baseInput = {
    hasWallet: true,
    isManager: true,
    navLabel: "12.0000",
    shareLabel: "4.0000",
    selectedAssetLabel: "USDC",
    routeCandidateCount: 3,
    selectedProtocolLabel: "Best execution",
    creditProtocol: "Blend",
    creditHealthFactorLabel: "1.4500",
    creditRiskBlocked: false,
    supportedCreditActionCount: 4,
  };

  it("defines the execution workspace sequence used by the Arka page", () => {
    expect(ARKA_WORKSPACE_TABS.map((tab) => tab.id)).toEqual([
      "state",
      "flow",
      "rebalance",
      "credit",
    ]);
    expect(getArkaWorkspaceTab("rebalance")).toMatchObject({
      label: "Swap",
      commandLabel: "Open swaps",
    });
    expect(getArkaWorkspaceTab("state").label).toBe("Overview");
    expect(getArkaWorkspaceTab("flow").label).toBe("Deposit & redeem");
    expect(getArkaWorkspaceTab("credit").label).toBe("Blend");
  });

  it("falls back to the state workspace for unknown route or UI values", () => {
    expect(resolveArkaWorkspaceId(undefined)).toBe("state");
    expect(resolveArkaWorkspaceId("unknown")).toBe("state");
    expect(resolveArkaWorkspaceId("credit")).toBe("credit");
  });

  it("builds state cards from real vault posture inputs", () => {
    const cards = buildArkaWorkspaceCards({
      ...baseInput,
      activeWorkspace: "state",
    });

    expect(cards.map((card) => card.id)).toEqual(["nav", "shares", "role"]);
    expect(cards[0]).toMatchObject({
      label: "Vault value",
      value: "12.0000",
    });
    expect(cards[1]).toMatchObject({
      value: "4.0000",
      tone: "positive",
    });
  });

  it("keeps wallet and status context explicit in the deposit workspace", () => {
    const cards = buildArkaWorkspaceCards({
      ...baseInput,
      activeWorkspace: "flow",
      hasWallet: false,
      vaultStatus: "Submitting deposit of 1 USDC",
    });

    expect(cards.map((card) => card.id)).toEqual(["asset", "wallet", "status"]);
    expect(cards[0]).toMatchObject({
      value: "USDC",
    });
    expect(cards[1]).toMatchObject({
      value: "Watching",
      tone: "warning",
    });
    expect(cards[2]).toMatchObject({
      value: "Submitting deposit of 1 USDC",
      tone: "warning",
      statusLabel: "Waiting",
      detail: "Waiting for Stellar confirmation.",
    });
  });

  it("summarizes submitted vault actions without exposing hashes as the primary card value", () => {
    const cards = buildArkaWorkspaceCards({
      ...baseInput,
      activeWorkspace: "flow",
      vaultStatus:
        "Deposit submitted: becdf32d241700e46b0788f14169ed88dfad4b4591215b70b00cff4dc33b6d8a",
    });

    expect(cards[2]).toMatchObject({
      value: "Deposit submitted",
      detail: "Waiting for Stellar confirmation.",
      tone: "warning",
      statusLabel: "Waiting",
    });
  });

  it("marks confirmed vault actions as confirmed instead of attention", () => {
    const cards = buildArkaWorkspaceCards({
      ...baseInput,
      activeWorkspace: "flow",
      vaultStatus: "Deposit confirmed: 5 XLM · tx becdf32d...33b6d8a",
    });

    expect(cards[2]).toMatchObject({
      value: "Deposit confirmed: 5 XLM",
      detail: "Latest wallet action is confirmed on Stellar.",
      tone: "positive",
      statusLabel: "Confirmed",
    });
  });

  it("builds route and authority cards for the rebalance workspace", () => {
    const cards = buildArkaWorkspaceCards({
      ...baseInput,
      activeWorkspace: "rebalance",
      isManager: false,
      routeCandidateCount: 0,
    });

    expect(cards.map((card) => card.id)).toEqual(["protocol", "role", "status"]);
    expect(cards[0]).toMatchObject({
      value: "Best execution",
      tone: "warning",
    });
    expect(cards[1]).toMatchObject({
      value: "View only",
      tone: "warning",
    });
  });

  it("surfaces credit risk blocks without pretending execution is available", () => {
    const cards = buildArkaWorkspaceCards({
      ...baseInput,
      activeWorkspace: "credit",
      creditRiskBlocked: true,
      supportedCreditActionCount: 2,
    });

    expect(cards.map((card) => card.id)).toEqual(["protocol", "health", "role"]);
    expect(cards[1]).toMatchObject({
      label: "Health factor",
      value: "1.4500",
      tone: "warning",
    });
    expect(cards[1].detail).toMatch(/prevents borrow and withdraw/i);
  });
});
