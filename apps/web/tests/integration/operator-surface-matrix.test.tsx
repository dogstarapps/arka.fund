import React from "react";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const sorobanMocks = vi.hoisted(() => ({
  isGovernorReadable: vi.fn(),
  isVotesReadable: vi.fn(),
  readCoverageVaultBalance: vi.fn(),
  readCoverageFundTotalStaked: vi.fn(),
  readManagerTierThresholds: vi.fn(),
  readAdapterRouter: vi.fn(),
  readManagerTierPoints: vi.fn(),
  readManagerTierLevel: vi.fn(),
  buildManagerTierAddPoints: vi.fn(),
}));

const walletMocks = vi.hoisted(() => ({
  getWalletsKit: vi.fn(() => ({})),
  connectWallet: vi.fn(),
  connectFreighterDirect: vi.fn(),
  isWalletSelectionClosedError: vi.fn(
    (event: unknown) => event instanceof Error && event.message === "Wallet selection was closed",
  ),
}));

const txMocks = vi.hoisted(() => ({
  signXdr: vi.fn(),
  submitSignedTx: vi.fn(),
  waitForTx: vi.fn(),
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
  buildManagerTierAddPoints: sorobanMocks.buildManagerTierAddPoints,
}));

vi.mock("@/lib/walletKit", () => ({
  getWalletsKit: walletMocks.getWalletsKit,
  connectWallet: walletMocks.connectWallet,
  connectFreighterDirect: walletMocks.connectFreighterDirect,
  isWalletSelectionClosedError: walletMocks.isWalletSelectionClosedError,
}));

vi.mock("@/lib/tx", () => ({
  signXdr: txMocks.signXdr,
  submitSignedTx: txMocks.submitSignedTx,
  waitForTx: txMocks.waitForTx,
}));

import OpsPage from "@/app/ops/page";
import SettingsPage from "@/app/settings/page";
import TiersPage from "@/app/tiers/page";
import {
  OPERATOR_SURFACE_ROUTES,
  getOperatorSurfaceMatrixSummary,
  getOperatorSurfaceRoutesByState,
  validateOperatorSurfaceMatrix,
  type OperatorSurfaceState,
} from "@/lib/qa/operatorSurfaceMatrix";
import { OPERATOR_CONSOLE_NAV } from "@/lib/workflows/productNavigation";

const WALLET_ADDRESS =
  "GCFLOW7RTH9KLMNOPQ2UVWX3YZ56789ABCDEFGHJKLMNPRSTUV4WX";

function installHealthDegradedFetchMock() {
  return vi.spyOn(global, "fetch").mockImplementation(async (input) => {
    const rawUrl =
      typeof input === "string"
        ? input
        : input instanceof URL
          ? input.toString()
          : input.url;
    const url = new URL(rawUrl, "http://localhost");

    if (url.pathname === "/api/health") {
      return new Response(JSON.stringify({ error: "health offline" }), {
        status: 503,
        headers: { "content-type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "not found" }), {
      status: 404,
      headers: { "content-type": "application/json" },
    });
  });
}

function installHealthySorobanMocks() {
  sorobanMocks.isGovernorReadable.mockResolvedValue(true);
  sorobanMocks.isVotesReadable.mockResolvedValue(true);
  sorobanMocks.readCoverageVaultBalance.mockResolvedValue(4_200_0000);
  sorobanMocks.readCoverageFundTotalStaked.mockResolvedValue(9_100_0000);
  sorobanMocks.readManagerTierThresholds.mockResolvedValue([100, 500, 1000]);
  sorobanMocks.readAdapterRouter.mockResolvedValue(
    "CAHF53IIWUVKFOJ4H7OHIB667NEU7MTC3YUHSIZWETFXXPAI6DS75HQK",
  );
  sorobanMocks.readManagerTierPoints.mockResolvedValue(620);
  sorobanMocks.readManagerTierLevel.mockResolvedValue(2);
  sorobanMocks.buildManagerTierAddPoints.mockResolvedValue("tier-add-xdr");
}

describe("operator surface matrix integration", () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.clear();
    window.localStorage.setItem("wallet:pubkey", WALLET_ADDRESS);
    walletMocks.connectWallet.mockResolvedValue(WALLET_ADDRESS);
    walletMocks.connectFreighterDirect.mockResolvedValue(WALLET_ADDRESS);
    txMocks.signXdr.mockResolvedValue("signed-xdr");
    txMocks.submitSignedTx.mockResolvedValue("tx-hash");
    txMocks.waitForTx.mockResolvedValue(undefined);
    installHealthDegradedFetchMock();
    installHealthySorobanMocks();
  });

  it("keeps the route/state matrix aligned with protected operator navigation", () => {
    expect(validateOperatorSurfaceMatrix()).toEqual([]);
    expect(OPERATOR_SURFACE_ROUTES.map((route) => route.path)).toEqual(
      OPERATOR_CONSOLE_NAV.map((item) => item.href),
    );
    expect(getOperatorSurfaceMatrixSummary()).toMatchObject({
      routeCount: 8,
      stateCount: 6,
      browserRouteScenarios: 24,
      browserStateScenarios: 87,
    });
    expect(getOperatorSurfaceRoutesByState("api_degraded").length).toBe(5);
    expect(getOperatorSurfaceRoutesByState("soroban_read_failure").length).toBe(2);
  });

  it("declares concrete fallback, retry and sensitive-action anchors for each operator branch", () => {
    for (const route of OPERATOR_SURFACE_ROUTES) {
      const requiredStates = route.requiredStates as readonly OperatorSurfaceState[];
      expect(route.loadedAnchorTestId, route.key).toBeTruthy();
      expect(requiredStates).toContain("unauthorized");
      expect(requiredStates).toContain("authorized");

      if (
        requiredStates.includes("api_degraded") ||
        requiredStates.includes("soroban_read_failure") ||
        requiredStates.includes("stale_cached_data")
      ) {
        expect(route.fallbackAnchorTestIds.length, route.key).toBeGreaterThan(0);
      }

      if (requiredStates.includes("retry_recovery")) {
        expect(route.retryControlTestIds.length, route.key).toBeGreaterThan(0);
      }
    }
  });

  it("keeps Settings usable when runtime health API is degraded", async () => {
    const user = userEvent.setup();
    render(<SettingsPage />);

    await waitFor(() =>
      expect(screen.getByRole("heading", { name: /^settings$/i })).toBeInTheDocument(),
    );

    expect(screen.getByTestId("settings-config-panel")).toHaveTextContent(
      "Configuration map",
    );
    expect(screen.getByTestId("settings-workspace-summary")).toHaveTextContent(
      "Runtime map",
    );

    await user.click(screen.getByTestId("settings-workspace-tab-guardrails"));
    expect(screen.getByTestId("settings-guardrails-panel")).toHaveTextContent(
      "Rebalance guardrails",
    );

    await user.click(screen.getByTestId("settings-workspace-tab-raw"));
    expect(screen.getByTestId("settings-raw-panel")).toHaveTextContent(
      "Raw environment snapshot",
    );
  });

  it("keeps Ops visible after Soroban read failure and retries without collapsing the route", async () => {
    const user = userEvent.setup();
    sorobanMocks.readCoverageVaultBalance.mockRejectedValueOnce(
      new Error("Soroban coverage read unavailable"),
    );

    render(<OpsPage />);

    await waitFor(() =>
      expect(screen.getByRole("heading", { name: /^operations$/i })).toBeInTheDocument(),
    );
    expect(screen.getByTestId("ops-workspace-summary")).toBeInTheDocument();
    expect(screen.getByTestId("ops-health-panel")).toHaveTextContent(
      "Contract health",
    );

    await user.click(screen.getByTestId("ops-workspace-tab-runbook"));
    await waitFor(() =>
      expect(screen.getByTestId("ops-error")).toHaveTextContent(
        /soroban coverage read unavailable/i,
      ),
    );
    expect(screen.getByTestId("ops-refresh-button")).toBeEnabled();

    await user.click(screen.getByTestId("ops-refresh-button"));
    await waitFor(() =>
      expect(screen.queryByTestId("ops-error")).not.toBeInTheDocument(),
    );
    expect(screen.getByTestId("ops-runbook-panel")).toHaveTextContent(
      "Operator cadence",
    );
  });

  it("keeps Tiers readable after Soroban failure and preserves manager inputs on retry", async () => {
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

    await user.click(screen.getByTestId("tiers-workspace-tab-update"));
    const managerInput = screen.getByTestId("tiers-manager-input");
    const deltaInput = screen.getByTestId("tiers-delta-input");
    await user.clear(deltaInput);
    await user.type(deltaInput, "250");

    await user.click(screen.getByTestId("tiers-refresh-button"));

    await waitFor(() =>
      expect(screen.getByTestId("tiers-runtime-read-posture")).toHaveTextContent(
        "Tier snapshot loaded",
      ),
    );
    expect(screen.queryByTestId("tiers-read-error")).not.toBeInTheDocument();
    expect(managerInput).toHaveValue(WALLET_ADDRESS);
    expect(deltaInput).toHaveValue("250");
    expect(screen.getByTestId("tiers-add-points-button")).toBeEnabled();
  });
});
