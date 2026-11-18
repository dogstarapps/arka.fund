import React from "react";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import OpsPage from "@/app/ops/page";
import TiersPage from "@/app/tiers/page";

const LEGACY_MILESTONE_WORD = new RegExp(`tr${"anche"}`, "i");

const sorobanMocks = vi.hoisted(() => ({
  isGovernorReadable: vi.fn(),
  isVotesReadable: vi.fn(),
  readCoverageVaultBalance: vi.fn(),
  readCoverageFundTotalStaked: vi.fn(),
  readManagerTierThresholds: vi.fn(),
  readAdapterRouter: vi.fn(),
  readManagerTierPoints: vi.fn(),
  readManagerTierLevel: vi.fn(),
}));

vi.mock("@/lib/soroban", () => ({
  isGovernorReadable: sorobanMocks.isGovernorReadable,
  isVotesReadable: sorobanMocks.isVotesReadable,
  readCoverageVaultBalance: sorobanMocks.readCoverageVaultBalance,
  readCoverageFundTotalStaked: sorobanMocks.readCoverageFundTotalStaked,
  readManagerTierThresholds: sorobanMocks.readManagerTierThresholds,
  readAdapterRouter: sorobanMocks.readAdapterRouter,
  readManagerTierPoints: sorobanMocks.readManagerTierPoints,
  readManagerTierLevel: sorobanMocks.readManagerTierLevel,
  buildManagerTierAddPoints: vi.fn(),
}));

vi.mock("@/lib/walletKit", () => ({
  getWalletsKit: vi.fn(() => ({})),
  connectWallet: vi.fn(),
  connectFreighterDirect: vi.fn(),
  isWalletSelectionClosedError: (event: unknown) =>
    event instanceof Error && event.message === "Wallet selection was closed",
}));

vi.mock("@/lib/tx", () => ({
  signXdr: vi.fn(),
  submitSignedTx: vi.fn(),
  waitForTx: vi.fn(),
}));

describe("live ops surfaces", () => {
  afterEach(() => {
    cleanup();
  });

  beforeEach(() => {
    window.localStorage.clear();
    sorobanMocks.isGovernorReadable.mockResolvedValue(true);
    sorobanMocks.isVotesReadable.mockResolvedValue(true);
    sorobanMocks.readCoverageVaultBalance.mockResolvedValue(2_500_0000);
    sorobanMocks.readCoverageFundTotalStaked.mockResolvedValue(8_700_0000);
    sorobanMocks.readManagerTierThresholds.mockResolvedValue([100, 500, 1000]);
    sorobanMocks.readAdapterRouter.mockImplementation(async (adapter: string) => {
      if (adapter.includes("BALANCED")) return "CAHF53IIWUVKFOJ4H7OHIB667NEU7MTC3YUHSIZWETFXXPAI6DS75HQK";
      if (adapter.includes("AQUARIUS")) return "CBCFTQSPDBAIZ6R6PJQKSQWKNKWH2QIV3I4J72SHWBIK3ADRRAM5A6GD";
      if (adapter.includes("SOROSWAP")) return "CCJUD55AG6W5HAI5LRVNKAE5WDP5XGZBUDS5WNTIVDU7O264UZZE7BRD";
      return "BLEND_POOL";
    });
    sorobanMocks.readManagerTierPoints.mockResolvedValue(620);
    sorobanMocks.readManagerTierLevel.mockResolvedValue(2);
    window.localStorage.setItem("wallet:pubkey", "GDEMOUSER7RTH9KLMNOPQ2UVWX3YZ56789ABCDEFGHJKLMNPRSTUV");
  });

  it("renders operations control room without legacy milestone wording", async () => {
    const user = userEvent.setup();
    render(<OpsPage />);

    await waitFor(() =>
      expect(screen.getByRole("heading", { name: /^operations$/i })).toBeInTheDocument(),
    );

    expect(screen.getByTestId("ops-health-panel")).toHaveTextContent("Ops deck");
    expect(screen.getByTestId("ops-health-panel")).toHaveClass(
      "ops-health-workspace-panel",
    );
    expect(screen.getByTestId("ops-workspace-summary")).toHaveClass(
      "secondary-operator-summary-cutover",
    );
    expect(screen.getByTestId("ops-workspace-tabs")).toHaveClass(
      "secondary-operator-tabs-cutover",
    );
    expect(screen.getByTestId("ops-workspace-panel")).toHaveClass(
      "secondary-operator-stage-cutover",
    );
    expect(screen.getByTestId("ops-health-panel")).toHaveClass(
      "secondary-operator-panel-cutover",
    );
    expect(screen.getByTestId("ops-health-panel")).toHaveTextContent("Governor readability");
    expect(screen.getByTestId("ops-workspace-summary")).toHaveTextContent(/\d\/9/);
    expect(screen.getByTestId("ops-workspace-tab-health")).toHaveAttribute(
      "aria-controls",
      "ops-workspace-panel-health",
    );
    expect(screen.getByTestId("ops-workspace-panel")).toHaveAttribute(
      "id",
      "ops-workspace-panel-health",
    );
    expect(screen.queryByTestId("ops-runbook-panel")).not.toBeInTheDocument();
    await user.click(screen.getByTestId("ops-workspace-tab-routing"));
    expect(screen.getByTestId("ops-workspace-tab-routing")).toHaveAttribute(
      "aria-controls",
      "ops-workspace-panel-routing",
    );
    expect(screen.getByTestId("ops-workspace-panel")).toHaveAttribute(
      "id",
      "ops-workspace-panel-routing",
    );
    expect(screen.getByTestId("ops-routing-panel")).toHaveTextContent("Balanced adapter route");
    expect(screen.getByTestId("ops-routing-panel")).toHaveClass(
      "ops-routing-workspace-panel",
    );
    expect(screen.getByTestId("ops-routing-panel")).toHaveClass(
      "secondary-operator-panel-cutover",
    );
    expect(screen.getByTestId("ops-routing-panel")).toHaveTextContent("Aquarius adapter route");
    expect(screen.getByTestId("ops-routing-panel")).toHaveTextContent("SoroSwap adapter route");
    expect(screen.getByTestId("ops-routing-panel")).toHaveTextContent("Blend adapter route");
    await user.click(screen.getByTestId("ops-workspace-tab-runbook"));
    expect(screen.getByTestId("ops-runbook-table")).toHaveTextContent("Governance baseline");
    expect(screen.getByTestId("ops-runbook-panel")).toHaveClass(
      "ops-runbook-workspace-panel",
    );
    expect(screen.getByTestId("ops-runbook-panel")).toHaveClass(
      "secondary-operator-panel-cutover",
    );
    expect(screen.getByTestId("ops-runbook-table")).toHaveClass(
      "secondary-operator-table-cutover",
    );
    expect(screen.getByTestId("ops-runbook-panel")).toHaveTextContent("Adapter wiring");
    expect(screen.getByTestId("ops-runbook-panel")).toHaveTextContent("Reserve gate");
    expect(screen.queryByText(LEGACY_MILESTONE_WORD)).not.toBeInTheDocument();
  });

  it("renders manager tiers with scorecard and governed action panels", async () => {
    const user = userEvent.setup();
    render(<TiersPage />);

    await waitFor(() =>
      expect(screen.getByRole("heading", { name: /^manager tiers$/i })).toBeInTheDocument(),
    );

    await waitFor(() =>
      expect(screen.getByTestId("tiers-target-manager")).toHaveTextContent("GDEMOUSE"),
    );

    expect(screen.getByTestId("tiers-state-panel")).toHaveTextContent("Score deck");
    expect(screen.getByTestId("tiers-state-panel")).toHaveClass(
      "tiers-scorecard-workspace-panel",
    );
    expect(screen.getByTestId("tiers-runtime-read-posture")).toHaveClass(
      "secondary-operator-runtime-card-cutover",
    );
    expect(screen.getByTestId("tiers-workspace-summary")).toHaveClass(
      "secondary-operator-summary-cutover",
    );
    expect(screen.getByTestId("tiers-workspace-tabs")).toHaveClass(
      "secondary-operator-tabs-cutover",
    );
    expect(screen.getByTestId("tiers-workspace-panel")).toHaveClass(
      "secondary-operator-stage-cutover",
    );
    expect(screen.getByTestId("tiers-state-panel")).toHaveClass(
      "secondary-operator-panel-cutover",
    );
    expect(screen.getByTestId("tiers-scorecard-table")).toHaveTextContent("Threshold ladder");
    expect(screen.getByTestId("tiers-scorecard-table")).toHaveClass(
      "secondary-operator-table-cutover",
    );
    expect(screen.getByTestId("tiers-state-panel")).toHaveTextContent("Tier 2");
    expect(screen.getByTestId("tiers-workspace-summary")).toHaveTextContent("Tier 2");
    expect(screen.getByTestId("tiers-workspace-tab-scorecard")).toHaveAttribute(
      "aria-controls",
      "tiers-workspace-panel-scorecard",
    );
    expect(screen.getByTestId("tiers-workspace-panel")).toHaveAttribute(
      "id",
      "tiers-workspace-panel-scorecard",
    );
    expect(screen.queryByTestId("tiers-actions-panel")).not.toBeInTheDocument();
    await user.click(screen.getByTestId("tiers-workspace-tab-ladder"));
    expect(screen.getByTestId("tiers-workspace-panel")).toHaveAttribute(
      "id",
      "tiers-workspace-panel-ladder",
    );
    expect(screen.getByTestId("tiers-ladder-panel")).toHaveTextContent("Tier 3");
    expect(screen.getByTestId("tiers-ladder-panel")).toHaveClass(
      "tiers-ladder-workspace-panel",
    );
    expect(screen.getByTestId("tiers-ladder-panel")).toHaveClass(
      "secondary-operator-panel-cutover",
    );
    expect(screen.getByTestId("tiers-ladder-panel")).toHaveTextContent("Threshold ladder");
    await user.click(screen.getByTestId("tiers-workspace-tab-update"));
    expect(screen.getByTestId("tiers-actions-table")).toHaveTextContent("Authorization model");
    expect(screen.getByTestId("tiers-actions-panel")).toHaveClass(
      "tiers-actions-workspace-panel",
    );
    expect(screen.getByTestId("tiers-actions-panel")).toHaveClass(
      "secondary-operator-panel-cutover",
    );
    expect(screen.getByTestId("tiers-actions-table")).toHaveClass(
      "secondary-operator-table-cutover",
    );
    expect(screen.getByTestId("tiers-actions-panel")).toHaveTextContent("Governed deck");
    expect(screen.getByTestId("tiers-actions-panel")).toHaveTextContent("Add points");
    expect(screen.getByTestId("tiers-actions-panel")).toHaveTextContent("Authorization model");
    expect(screen.getByTestId("tiers-actions-panel")).toHaveTextContent("Points delta");
  });

  it("keeps manager tiers readable and retryable when Soroban tier reads degrade", async () => {
    const user = userEvent.setup();
    sorobanMocks.readManagerTierPoints
      .mockRejectedValueOnce(new Error("Manager tier RPC unavailable"))
      .mockResolvedValue(620);

    render(<TiersPage />);

    await waitFor(() =>
      expect(screen.getByTestId("tiers-read-error")).toHaveTextContent(
        /manager tier rpc unavailable/i,
      ),
    );
    expect(screen.getByTestId("tiers-runtime-read-posture")).toHaveTextContent(
      "Tier read fallback active",
    );
    expect(screen.getByTestId("tiers-state-panel")).toHaveTextContent("Score deck");

    await user.click(screen.getByTestId("tiers-refresh-button"));

    await waitFor(() =>
      expect(screen.getByTestId("tiers-runtime-read-posture")).toHaveTextContent(
        "Tier snapshot loaded",
      ),
    );
    expect(screen.queryByTestId("tiers-read-error")).not.toBeInTheDocument();
    expect(screen.getByTestId("tiers-read-status")).toHaveTextContent(
      "Tier snapshot refreshed.",
    );
    expect(screen.getByTestId("tiers-scorecard-table")).toHaveTextContent(
      "Tier 2",
    );
    expect(sorobanMocks.readManagerTierPoints.mock.calls.length).toBeGreaterThanOrEqual(2);
  });
});
