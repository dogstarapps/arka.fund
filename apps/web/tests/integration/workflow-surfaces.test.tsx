import React from "react";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock('@/lib/config',async()=>({...await vi.importActual<typeof import('@/lib/config')>('@/lib/config'),PLATFORM_VENUE_REGISTRY:'synthetic-registry'}));

const shared = vi.hoisted(() => {
  const walletAddress = "GCFLOW7RTH9KLMNOPQ2UVWX3YZ56789ABCDEFGHJKLMNPRSTUV4WX";
  const mockKit = {
    getAddress: vi.fn(async () => ({ address: walletAddress })),
    signTransaction: vi.fn(async () => ({ signedTxXdr: "signed-xdr" })),
  };
  return { walletAddress, mockKit };
});

const sorobanMocks = vi.hoisted(() => ({
  readRegistryVenueSnapshot:vi.fn(async(registry:string,venue:string)=>({registry,venue,network:'Test SDF Network ; September 2015',status:2,updatedAt:'1',updatedBy:'synthetic-governor',observedAt:Date.now()})),
  buildAdapterBalancedExecute: vi.fn(async () => "balanced-xdr"),
  buildAdapterBlendExecute: vi.fn(async () => "blend-xdr"),
  buildCoverageFundClaim: vi.fn(async () => "claim-xdr"),
  buildCoverageFundStake: vi.fn(async () => "stake-xdr"),
  buildCoverageFundUnstake: vi.fn(async () => "unstake-xdr"),
  buildTokenApprove: vi.fn(async () => "approve-xdr"),
  readAdapterBalancedPoolSupport: vi.fn(async () => true),
  readCoverageFundPending: vi.fn(async () => 30_000_000),
  readCoverageFundPendingRewards: vi.fn(async () => ({ bootstrap_reward: 30_000_000, reserve_reward: 20_000_000 })),
  readCoverageFundMetrics: vi.fn(async () => ({ reserve_token: "CA33YVWPBWG6A7JPMMUEUUELUB3UPATI64K62RZFPGYCBJD5GFACOWGK", bootstrap_token: "CDCKFBZYF2AQCSM3JOF2ZM27O3Y6AJAI4OTCQKAFNZ3FHBYUTFOKICIY", claims_manager: "CBBTR7VED6ZZTK3Z2ZVOWUFSP574UQGO4C2JK6YUUBSH4FPJ2GB4VF5P", reserve_capital: 900_000_000, total_staked: 800_000_000, retained_reserve: 100_000_000, total_covered_nav: 0, total_premiums: 100_000_000 })),
  readCoverageFundStakeOf: vi.fn(async () => 120_000_000),
  readCoverageVaultBalance: vi.fn(async () => 500_000_000),
  readCoverageVaultMaxWithdrawable: vi.fn(async () => 100_000_000),
  readAdapterRouter: vi.fn(async (adapter: string) => {
    if (adapter.includes("BALANCED"))
      return "CAHF53IIWUVKFOJ4H7OHIB667NEU7MTC3YUHSIZWETFXXPAI6DS75HQK";
    if (adapter.includes("AQUARIUS")) return "AQUARIUS-ROUTER";
    if (adapter.includes("SOROSWAP")) return "SOROSWAP-ROUTER";
    return "BLEND-ROUTER";
  }),
  readAdapterRouterDiagnostic: vi.fn(async (_adapter: string, expected = "") => {
    const observed =
      expected === "CROUTER"
        ? "CAHF53IIWUVKFOJ4H7OHIB667NEU7MTC3YUHSIZWETFXXPAI6DS75HQK"
        : expected || "ROUTER";
    const ok = !expected || observed === expected;
    return {
      adapterId: _adapter,
      expectedRouter: expected,
      router: observed,
      ok,
      status: ok ? "healthy" : "mismatch",
      detail: ok
        ? "Adapter exposes the configured router through router()."
        : "Adapter router does not match the configured router.",
    };
  }),
  readAquariusEstimateOut: vi.fn(async () => 1_020_000),
  readAquariusPoolIndex: vi.fn(async () => "ab".repeat(32)),
  readSushiEstimateOut: vi.fn(async () => 0),
  readSushiPoolRouteDiagnostic: vi.fn(async () => ({
    adapterId: "",
    poolId: 1,
    expectedPool: "",
    pool: null,
    tokenIn: null,
    tokenOut: null,
    ok: false,
    status: "unconfigured",
    detail: "Sushi adapter id is not configured for this environment.",
  })),
  readSoroswapAmountOut: vi.fn(async () => 1_010_000),
  readTokenAllowance: vi.fn(async () => 0),
  readTokenBalance: vi.fn(async () => 80_000_000),
  readCoverageWalletBalance: vi.fn(async () => 80_000_000),
  buildGovernorClose: vi.fn(async () => "close-xdr"),
  buildGovernorExecute: vi.fn(async () => "execute-xdr"),
  buildGovernorProposeCouncil: vi.fn(async () => "propose-council-xdr"),
  buildGovernorProposeSnapshotSelf: vi.fn(async () => "propose-snapshot-xdr"),
  buildGovernorVote: vi.fn(async () => "vote-xdr"),
  findLatestGovernorProposalIdByCreator: vi.fn(async () => 12),
  readGovernorProposal: vi.fn(async () => ({
    id: 12,
    title: "Rotate council",
    description: "Update operational council",
    creator: shared.walletAddress,
    status: 1,
    vote_start: 100,
    vote_end: 200,
    eta: 240,
    executable: true,
    action: "council",
  })),
  readGovernorProposalVotes: vi.fn(async () => ({
    _for: 300,
    against: 12,
    abstain: 8,
  })),
  readGovernorSettings: vi.fn(async () => ({
    proposal_threshold: 10,
    vote_delay: 2,
    vote_period: 1440,
    timelock: 600,
    grace_period: 86400,
    quorum: 100,
    counting_type: 0,
    vote_threshold: 51,
  })),
  readGovernorVote: vi.fn(async () => 1),
  readFactoryCreationFeeAmount: vi.fn(async () => 5_000_000),
  readFactoryCreationFeeToken: vi.fn(async () => "CFEE7TOKEN"),
  resolveRpcUrl: vi.fn(() => "https://rpc.invalid"),
  RPC_URL: "https://rpc.invalid",
  TESTNET: "Test SDF Network ; September 2015",
}));

const txMocks = vi.hoisted(() => ({
  signXdr: vi.fn(async () => "signed-tx-xdr"),
  submitSignedTx: vi.fn(async () => "tx-hash-123"),
  waitForTx: vi.fn(async () => undefined),
}));

const walletMocks = vi.hoisted(() => ({
  getWalletsKit: vi.fn(() => shared.mockKit),
  connectWallet: vi.fn(async () => shared.walletAddress),
  connectFreighterDirect: vi.fn(async () => shared.walletAddress),
  isWalletSelectionClosedError: vi.fn(
    (event: unknown) => event instanceof Error && event.message === "Wallet selection was closed",
  ),
}));

const navigationMocks = vi.hoisted(() => ({
  push: vi.fn(),
  replace: vi.fn(),
}));

vi.mock("@/lib/soroban", () => sorobanMocks);
vi.mock("@/lib/tx", () => txMocks);
vi.mock("@/lib/walletKit", () => walletMocks);
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: navigationMocks.push,
    replace: navigationMocks.replace,
  }),
}));

import CoveragePage from "@/app/coverage/page";
import CreateArkaClient from "@/app/factory/create/CreateArkaClient";
import GovernancePage from "@/app/governance/page";
import GovernanceConsolePage from "@/app/governance/console/page";
import IntegrationsPage from "@/app/integrations/page";
import { IntegrationsSurface } from "@/app/integrations/IntegrationsClient";
import {
  buildGovernedComposerDraft,
  writeGovernedComposerDraft,
  GOVERNED_COMPOSER_DRAFT_QUERY,
  GOVERNED_ACTION_TEMPLATES,
} from "@/lib/workflows/governanceComposer";
import { resolveCatalogFixture } from "@/lib/catalog/testFixtures";
import type { Page, RankedAssetCatalogEntry } from "@/lib/catalog/types";
import { DENOMINATION } from "@/lib/config";

function creationCatalogFixture(params: URLSearchParams) {
  const page = resolveCatalogFixture("/v1/assets", params) as Page<RankedAssetCatalogEntry>;
  const listed = page.items;
  const extra = [DENOMINATION, "CDCKFBZYF2AQCSM3JOF2ZM27O3Y6AJAI4OTCQKAFNZ3FHBYUTFOKICIY"]
    .filter(assetContract => !listed.some(asset => asset.assetContract === assetContract))
    .map(assetContract => ({ ...listed[0], assetContract, arkaCount: 0, managerCount: 0 }));
  const items = [...listed, ...extra];
  return { ...page, items, total: items.length };
}


describe("workflow surfaces", () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  beforeEach(() => {
    vi.clearAllMocks();
    shared.mockKit.getAddress.mockResolvedValue({
      address: shared.walletAddress,
    });
    shared.mockKit.signTransaction.mockResolvedValue({
      signedTxXdr: "signed-xdr",
    });
    window.history.replaceState({}, "", "/");
    window.localStorage.clear();
    window.localStorage.setItem("wallet:pubkey", shared.walletAddress);
  });

  it("keeps a failed manager reserve unknown without hiding the community fund", async () => {
    const original = sorobanMocks.readCoverageVaultBalance.getMockImplementation();
    sorobanMocks.readCoverageVaultBalance.mockRejectedValue(new Error("RPC unavailable"));
    try {
      render(<CoveragePage />);
      await waitFor(() => expect(screen.getByTestId("coverage-manager-status")).toHaveTextContent("balance is unknown"));
      expect(screen.getByTestId("coverage-vault-balance-card")).toHaveTextContent("Unavailable");
      expect(screen.getByTestId("coverage-vault-balance-card")).not.toHaveTextContent("0");
      expect(screen.getByTestId("coverage-read-status")).toHaveTextContent("Community reserve balances checked");
      expect(screen.getByTestId("coverage-community-capital")).toHaveTextContent("90");
      expect(screen.getByText(/it is not a guarantee against loss/)).toBeInTheDocument();
    } finally { sorobanMocks.readCoverageVaultBalance.mockImplementation(original!); }
  });

  it('keeps failed community reads unknown and all contribution controls disabled', async () => {
    const original = sorobanMocks.readCoverageFundMetrics.getMockImplementation()!;
    sorobanMocks.readCoverageFundMetrics.mockRejectedValue(new Error('RPC unavailable'));
    try {
    render(<CoveragePage />);
    await waitFor(() => expect(screen.getByTestId('coverage-read-status')).toHaveTextContent('balances are unavailable'));
    expect(screen.getByTestId('coverage-community-capital')).toHaveTextContent('Unavailable');
    await userEvent.setup().click(screen.getByTestId('coverage-workspace-tab-actions'));
    expect(screen.getByText(/Claimable rewards have not been verified/)).toBeInTheDocument();
    expect(screen.getByTestId('coverage-claim-button')).toBeDisabled();
    expect(screen.getByTestId('coverage-stake-button')).toBeDisabled();
    } finally { sorobanMocks.readCoverageFundMetrics.mockImplementation(original); }
  });

  it('shows verified zero capital and incomplete claims setup without pretending coverage is active', async () => {
    const original = sorobanMocks.readCoverageFundMetrics.getMockImplementation()!;
    sorobanMocks.readCoverageFundMetrics.mockResolvedValue({ ...await original(), reserve_capital: 0, claims_manager: null as unknown as string });
    try {
    const user = userEvent.setup();
    render(<CoveragePage />);
    await waitFor(() => expect(screen.getByTestId('coverage-setup-warning')).toHaveTextContent('no claims manager is linked'));
    expect(screen.getByTestId('coverage-community-capital')).toHaveTextContent(/^0 /);
    await user.click(screen.getByTestId('coverage-workspace-tab-actions'));
    expect(screen.getByTestId('coverage-stake-button')).toBeDisabled();
    expect(screen.getByTestId('coverage-unstake-button')).toBeEnabled();
    expect(screen.getByTestId('coverage-claim-button')).toBeEnabled();
    expect(sorobanMocks.buildTokenApprove).not.toHaveBeenCalled();
    } finally { sorobanMocks.readCoverageFundMetrics.mockImplementation(original); }
  });

  it('reads contribution balances in the live reserve asset and keeps reward assets separate', async () => {
    const user = userEvent.setup();
    render(<CoveragePage />);
    await user.click(screen.getByTestId('coverage-workspace-tab-member'));
    await waitFor(() => expect(screen.getByTestId('coverage-reserve-rewards')).toHaveTextContent('Reserve rewards: 2'));
    expect(screen.getByTestId('coverage-pending')).toHaveTextContent(/^3 /);
    expect(sorobanMocks.readCoverageWalletBalance).toHaveBeenCalledWith('CA33YVWPBWG6A7JPMMUEUUELUB3UPATI64K62RZFPGYCBJD5GFACOWGK', shared.walletAddress, shared.walletAddress);
  });

  it("keeps public protocol availability unknown while connection checks are pending", async () => {
    const original = sorobanMocks.readAdapterRouterDiagnostic.getMockImplementation();
    sorobanMocks.readAdapterRouterDiagnostic.mockImplementation(() => new Promise(() => {}));
    try {
      render(<IntegrationsPage />);
      expect(screen.getByTestId("integrations-public-check-status")).toHaveTextContent("Checking protocol connections");
      expect(screen.getByTestId("integrations-product-card-blend")).toHaveTextContent("Checking");
      expect(screen.getByTestId("integrations-product-card-blend")).not.toHaveTextContent("Unavailable");
      expect(screen.getByTestId("integrations-sodax-explainer")).toHaveTextContent("An accepted or submitted order is not a completed swap");
    } finally { sorobanMocks.readAdapterRouterDiagnostic.mockImplementation(original!); }
  });

  it("does not call an unavailable creation fee free and lets the user recheck", async () => {
    const original = sorobanMocks.readFactoryCreationFeeAmount.getMockImplementation();
    sorobanMocks.readFactoryCreationFeeAmount.mockRejectedValue(new Error("Fee unavailable"));
    try {
      const user = userEvent.setup();
      render(<CreateArkaClient />);
      await user.click(screen.getByTestId("create-step-fees"));
      await waitFor(() => expect(screen.getByTestId("create-fee-live-status")).toHaveTextContent("Unavailable"));
      expect(screen.getByTestId("create-fee-live-status")).not.toHaveTextContent("none configured");
      sorobanMocks.readFactoryCreationFeeAmount.mockImplementation(original!);
      await user.click(screen.getByRole("button", {name:"Recheck creation fee"}));
      await waitFor(() => expect(screen.getByTestId("create-fee-live-status")).toHaveTextContent("0.5"));
      await user.click(screen.getByTestId("create-step-review"));
      expect(screen.getByTestId("create-arka-review-card")).toHaveTextContent("Network fees are additional");
      expect(screen.getByTestId("create-arka-review-card")).toHaveTextContent("Management 0% · Performance 0% · Deposit 0% · Withdrawal 0%");
    } finally { sorobanMocks.readFactoryCreationFeeAmount.mockImplementation(original!); }
  });

  it("requires a new review if the live creation fee changes before signing", async () => {
    const original = sorobanMocks.readFactoryCreationFeeAmount.getMockImplementation();
    let liveFee = 5_000_000;
    sorobanMocks.readFactoryCreationFeeAmount.mockImplementation(async () => liveFee);
    vi.stubGlobal("fetch", vi.fn(async (input: string) => {
      const url = new URL(input, "http://localhost");
      if (url.pathname === "/api/catalog/v1/assets") return Response.json(creationCatalogFixture(url.searchParams));
      if (url.pathname === "/api/assets/core-registry") return Response.json({ items: [] });
      throw new Error("Unexpected test request");
    }));
    try {
      const user = userEvent.setup();
      render(<CreateArkaClient />);
      await user.click(screen.getByTestId("create-step-fees"));
      await waitFor(() => expect(screen.getByTestId("create-fee-live-status")).toHaveTextContent("0.5"));
      await user.click(screen.getByTestId("create-step-review"));
      await waitFor(() => expect(screen.getByTestId("create-arka-submit-button")).toBeEnabled());
      liveFee = 10_000_000;
      await user.click(screen.getByTestId("create-arka-submit-button"));
      await user.click(screen.getByTestId("create-arka-confirm-button"));
      await waitFor(() => expect(screen.getByText(/The creation fee changed/)).toBeInTheDocument());
      expect(sorobanMocks.buildTokenApprove).not.toHaveBeenCalled();
      expect(txMocks.signXdr).not.toHaveBeenCalled();
      expect(screen.getByTestId("create-arka-review-card")).toHaveTextContent("1.00");
    } finally { sorobanMocks.readFactoryCreationFeeAmount.mockImplementation(original!); }
  });

  it("renders coverage shell with live balances and action controls", async () => {
    const user = userEvent.setup();
    render(<CoveragePage />);

    await waitFor(() =>
      expect(
        screen.getByRole("heading", {
          name: /coverage reserve/i,
        }),
      ).toBeInTheDocument(),
    );

    expect(screen.getByTestId("coverage-overview-panel")).toHaveTextContent(
      "Community reserve",
    );
    expect(screen.getByTestId("coverage-overview-panel")).toHaveTextContent(
      "Manager withdrawable",
    );
    expect(
      screen.getByRole("navigation", { name: "Coverage sections" }),
    ).toHaveTextContent("Overview");
    expect(screen.getByTestId("coverage-workspace-tab-state")).toHaveAttribute(
      "aria-pressed",
      "true",
    );

    await user.click(screen.getByTestId("coverage-workspace-tab-member"));
    expect(screen.getByTestId("coverage-workspace-tab-member")).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getByTestId("coverage-member-panel")).toHaveTextContent(
      "GCFLOW",
    );
    expect(screen.getByTestId("coverage-member-panel")).toHaveTextContent(
      "Bootstrap rewards",
    );
    expect(
      screen.getByTestId("coverage-wallet-balance"),
    ).toHaveTextContent("8");

    await user.click(screen.getByTestId("coverage-workspace-tab-actions"));
    expect(
      screen.getByTestId("coverage-workspace-tab-actions"),
    ).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByTestId("coverage-actions-panel")).toHaveTextContent(
      "Manage coverage",
    );
    expect(screen.getByTestId("coverage-actions-panel")).toHaveClass(
      "coverage-actions-frame-cutover",
    );
    expect(screen.getByTestId("coverage-command-grid")).toHaveClass(
      "coverage-command-grid",
    );
    expect(screen.getByTestId("coverage-command-grid")).toHaveTextContent(
      "Claim rewards",
    );
    expect(screen.getByTestId("coverage-stake-button")).toBeVisible();
    expect(screen.getByTestId("coverage-claim-button")).toBeVisible();
  });

  it("keeps coverage wallet signer rejection visible and retryable without submitting", async () => {
    const user = userEvent.setup();
    txMocks.signXdr.mockRejectedValueOnce(
      new Error("Wallet signature rejected by user"),
    );

    render(<CoveragePage />);

    await waitFor(() =>
      expect(
        screen.getByRole("heading", {
          name: /coverage reserve/i,
        }),
      ).toBeInTheDocument(),
    );

    await user.click(screen.getByTestId("coverage-workspace-tab-actions"));
    await waitFor(() =>
      expect(screen.getByTestId("coverage-stake-button")).toBeEnabled(),
    );

    await user.clear(screen.getByTestId("coverage-stake-input"));
    await user.type(screen.getByTestId("coverage-stake-input"), "0.25");
    await user.click(screen.getByTestId("coverage-stake-button"));

    await waitFor(() =>
      expect(screen.getByTestId("coverage-error")).toHaveTextContent(
        /wallet signature rejected by user/i,
      ),
    );
    expect(sorobanMocks.buildTokenApprove).toHaveBeenCalledWith(
      shared.walletAddress,
      expect.any(String),
      expect.any(String),
      2_500_000,
    );
    expect(txMocks.submitSignedTx).not.toHaveBeenCalled();
    expect(txMocks.waitForTx).not.toHaveBeenCalled();

    txMocks.signXdr.mockRejectedValueOnce(
      new Error("Wallet signature rejected by user"),
    );
    await user.click(screen.getByTestId("coverage-stake-button"));
    await waitFor(() => expect(txMocks.signXdr).toHaveBeenCalledTimes(2));
    expect(screen.getByTestId("coverage-error")).toHaveTextContent(
      /wallet signature rejected by user/i,
    );
    expect(txMocks.submitSignedTx).not.toHaveBeenCalled();
  });

  it("confirms coverage stake allowance before building the stake transaction", async () => {
    const user = userEvent.setup();
    sorobanMocks.readTokenAllowance
      .mockResolvedValueOnce(0)
      .mockResolvedValue(2_500_000);

    render(<CoveragePage />);

    await waitFor(() =>
      expect(
        screen.getByRole("heading", {
          name: /coverage reserve/i,
        }),
      ).toBeInTheDocument(),
    );

    await user.click(screen.getByTestId("coverage-workspace-tab-actions"));
    await waitFor(() =>
      expect(screen.getByTestId("coverage-stake-button")).toBeEnabled(),
    );

    await user.clear(screen.getByTestId("coverage-stake-input"));
    await user.type(screen.getByTestId("coverage-stake-input"), "0.25");
    await user.click(screen.getByTestId("coverage-stake-button"));

    await waitFor(() =>
      expect(sorobanMocks.buildCoverageFundStake).toHaveBeenCalledWith(
        shared.walletAddress,
        expect.any(String),
        2_500_000,
      ),
    );
    expect(sorobanMocks.readTokenAllowance).toHaveBeenCalledTimes(2);
    expect(sorobanMocks.buildTokenApprove).toHaveBeenCalledWith(
      shared.walletAddress,
      expect.any(String),
      expect.any(String),
      2_500_000,
    );
    expect(txMocks.submitSignedTx).toHaveBeenCalledTimes(2);
    expect(txMocks.waitForTx).toHaveBeenCalledTimes(2);
  });

  it("keeps public governance readable without exposing the operator composer", async () => {
    render(<GovernancePage />);

    await waitFor(() =>
      expect(
        screen.getByRole("heading", {
          name: /^governance$/i,
        }),
      ).toBeInTheDocument(),
    );

    await waitFor(() =>
      expect(screen.getByTestId("governance-overview-panel")).toHaveTextContent(
        "Proposal #12",
      ),
    );
    expect(screen.getByTestId("governance-public-vote-panel")).toHaveTextContent(
      "Your vote",
    );
    expect(screen.queryByTestId("governance-actions-panel")).toBeNull();
    expect(screen.queryByTestId("governance-composer-panel")).toBeNull();
    expect(screen.queryByTestId("governance-operator-console-link")).toBeNull();
    expect(
      screen.getByRole("navigation", { name: "Governance sections" }),
    ).not.toHaveTextContent("Composer");
  });

  it("renders governance operator console with proposal telemetry and lifecycle controls", async () => {
    const user = userEvent.setup();
    render(<GovernanceConsolePage />);

    await waitFor(() =>
      expect(
        screen.getByRole("heading", {
          name: /governance/i,
        }),
      ).toBeInTheDocument(),
    );

    await waitFor(() =>
      expect(screen.getByTestId("governance-overview-panel")).toHaveTextContent(
        "Rotate council",
      ),
    );
    await waitFor(() =>
      expect(
        screen.getByTestId("governance-participation-panel"),
      ).toHaveTextContent("Execution window open"),
    );
    expect(
      screen.getByTestId("governance-participation-panel"),
    ).toHaveTextContent("Wallet");
    expect(screen.getByTestId("governance-overview-panel")).toHaveTextContent(
      "Control deck",
    );
    expect(
      screen.getByRole("navigation", { name: "Governance sections" }),
    ).toHaveTextContent("Lifecycle");
    expect(screen.getByTestId("governance-actions-panel")).toHaveTextContent(
      "Lifecycle controls",
    );
    expect(screen.getByTestId("governance-actions-panel")).toHaveClass(
      "governance-lifecycle-frame-cutover",
    );
    expect(screen.getByTestId("governance-composer-panel")).toHaveClass(
      "governance-composer-frame-cutover",
    );
    expect(screen.getByTestId("governance-settings-table")).toHaveTextContent(
      "Governor",
    );
    expect(screen.getByTestId("governance-proposal-table")).toHaveTextContent(
      "Wallet vote",
    );
    expect(screen.getByTestId("governance-actions-table")).toHaveTextContent(
      "Timelock",
    );
    expect(screen.getByTestId("governance-command-propose")).toHaveTextContent(
      "Open proposal",
    );
    expect(screen.getByTestId("governance-command-execute")).toHaveTextContent(
      "Window open",
    );
    expect(screen.getByTestId("governance-command-refresh")).toHaveTextContent(
      "Live read",
    );
    expect(screen.getByTestId("governance-composer-grid")).toHaveClass(
      "governance-composer-grid",
    );
    expect(screen.getByTestId("governance-lifecycle-layout")).toHaveClass(
      "governance-lifecycle-layout",
    );
    expect(screen.getByTestId("governance-review-card")).toHaveClass(
      "transaction-surface-review-card",
    );
    expect(screen.getByTestId("governance-composer-review-card")).toHaveClass(
      "transaction-surface-review-card",
    );
    expect(screen.getByTestId("governance-vote-button")).toBeVisible();
    expect(screen.getByTestId("governance-execute-button")).toBeVisible();
    expect(screen.getByTestId("governance-refresh-button")).toBeVisible();
    expect(screen.getByTestId("governance-composer-panel")).toHaveTextContent(
      "Governed action composer",
    );
    expect(
      screen.getByTestId("governance-composer-product-decision"),
    ).toHaveTextContent("Curated governed packages only");
    expect(
      screen.getByTestId("governance-composer-generic-batch-state"),
    ).toHaveTextContent("Generic batch: not supported");
    expect(
      screen.getByTestId("governance-composer-publication-model"),
    ).toHaveTextContent("It is not an on-chain publish action");
    expect(
      screen.getByTestId("governance-composer-migration-model"),
    ).toHaveTextContent("operator runbook handoff");
    expect(
      screen.getByTestId("governance-guardrail-source-card"),
    ).toHaveTextContent("Guardrail source of truth");
    expect(
      screen.getByTestId("governance-guardrail-source-card"),
    ).toHaveTextContent("11 required");
    expect(
      screen.getByTestId("governance-guardrail-source-card"),
    ).toHaveTextContent("operator configuration");
    expect(
      screen.getByTestId("governance-composer-handoff-link"),
    ).toBeDisabled();
    expect(
      screen.getByTestId("governance-composer-handoff-link"),
    ).not.toHaveAttribute("href");

    await user.selectOptions(
      screen.getByTestId("governance-composer-template-select"),
      "allowed-venues",
    );
    await user.clear(screen.getByTestId("governance-composer-contract-input"));
    await user.type(
      screen.getByTestId("governance-composer-contract-input"),
      "CAZPR5MIUHXH46ZJ5OAMRZXD7PXIHMF5HHSSKQPDUBEXVID5SAGSZ3HW",
    );
    await user.clear(
      screen.getByTestId("governance-composer-field-allowed_routers"),
    );
    await user.type(
      screen.getByTestId("governance-composer-field-allowed_routers"),
      "CAZPR5MIUHXH46ZJ5OAMRZXD7PXIHMF5HHSSKQPDUBEXVID5SAGSZ3HW,CAZPR5MIUHXH46ZJ5OAMRZXD7PXIHMF5HHSSKQPDUBEXVID5SAGSZ3HW",
    );
    await user.clear(
      screen.getByTestId("governance-composer-field-allowed_adapters"),
    );
    await user.type(
      screen.getByTestId("governance-composer-field-allowed_adapters"),
      "CAZPR5MIUHXH46ZJ5OAMRZXD7PXIHMF5HHSSKQPDUBEXVID5SAGSZ3HW,CAZPR5MIUHXH46ZJ5OAMRZXD7PXIHMF5HHSSKQPDUBEXVID5SAGSZ3HW",
    );
    await user.click(screen.getByTestId("governance-composer-build-button"));

    await waitFor(() =>
      expect(
        screen.getByTestId("governance-composer-package-json"),
      ).toHaveTextContent("set_allowed_venues"),
    );
    expect(screen.getByTestId("governance-composer-status")).toHaveTextContent(
      "Governed package ready",
    );
    expect(
      screen.getByTestId("governance-composer-handoff-link"),
    ).toHaveAttribute("href", "/contracts?draft=governed-action");

    await user.selectOptions(
      screen.getByTestId("governance-composer-template-select"),
      "coverage-covered-vault-policy",
    );
    await user.clear(screen.getByTestId("governance-composer-contract-input"));
    await user.type(
      screen.getByTestId("governance-composer-contract-input"),
      "CAZPR5MIUHXH46ZJ5OAMRZXD7PXIHMF5HHSSKQPDUBEXVID5SAGSZ3HW",
    );
    await user.clear(screen.getByTestId("governance-composer-field-vault"));
    await user.type(
      screen.getByTestId("governance-composer-field-vault"),
      "CAZPR5MIUHXH46ZJ5OAMRZXD7PXIHMF5HHSSKQPDUBEXVID5SAGSZ3HW",
    );
    await user.clear(
      screen.getByTestId("governance-composer-field-annual_premium_bps"),
    );
    await user.type(
      screen.getByTestId("governance-composer-field-annual_premium_bps"),
      "3.50",
    );
    await user.clear(
      screen.getByTestId("governance-composer-field-coverage_limit"),
    );
    await user.type(
      screen.getByTestId("governance-composer-field-coverage_limit"),
      "25000000",
    );
    await user.click(screen.getByTestId("governance-composer-build-button"));

    await waitFor(() =>
      expect(
        screen.getByTestId("governance-composer-package-json"),
      ).toHaveTextContent("set_covered_vault_policy"),
    );
    expect(
      screen.getByTestId("governance-composer-package-json"),
    ).toHaveTextContent('"type": "i128"');

    await user.selectOptions(
      screen.getByTestId("governance-composer-template-select"),
      "coverage-treasury",
    );
    await user.clear(screen.getByTestId("governance-composer-contract-input"));
    await user.type(
      screen.getByTestId("governance-composer-contract-input"),
      "CAZPR5MIUHXH46ZJ5OAMRZXD7PXIHMF5HHSSKQPDUBEXVID5SAGSZ3HW",
    );
    await user.clear(screen.getByTestId("governance-composer-field-caller"));
    await user.type(
      screen.getByTestId("governance-composer-field-caller"),
      "CAZPR5MIUHXH46ZJ5OAMRZXD7PXIHMF5HHSSKQPDUBEXVID5SAGSZ3HW",
    );
    await user.clear(screen.getByTestId("governance-composer-field-treasury"));
    await user.click(screen.getByTestId("governance-composer-build-button"));

    await waitFor(() =>
      expect(
        screen.getByTestId("governance-composer-package-json"),
      ).toHaveTextContent("set_treasury"),
    );
    expect(
      screen.getByTestId("governance-composer-package-json"),
    ).toHaveTextContent('"type": "void"');

    await user.selectOptions(
      screen.getByTestId("governance-composer-template-select"),
      "manager-tier-thresholds",
    );
    await user.clear(screen.getByTestId("governance-composer-contract-input"));
    await user.type(
      screen.getByTestId("governance-composer-contract-input"),
      "CAZPR5MIUHXH46ZJ5OAMRZXD7PXIHMF5HHSSKQPDUBEXVID5SAGSZ3HW",
    );
    await user.clear(screen.getByTestId("governance-composer-field-caller"));
    await user.type(
      screen.getByTestId("governance-composer-field-caller"),
      "CAZPR5MIUHXH46ZJ5OAMRZXD7PXIHMF5HHSSKQPDUBEXVID5SAGSZ3HW",
    );
    await user.clear(
      screen.getByTestId("governance-composer-field-tier1_threshold"),
    );
    await user.type(
      screen.getByTestId("governance-composer-field-tier1_threshold"),
      "100",
    );
    await user.clear(
      screen.getByTestId("governance-composer-field-tier2_threshold"),
    );
    await user.type(
      screen.getByTestId("governance-composer-field-tier2_threshold"),
      "500",
    );
    await user.clear(
      screen.getByTestId("governance-composer-field-tier3_threshold"),
    );
    await user.type(
      screen.getByTestId("governance-composer-field-tier3_threshold"),
      "1000",
    );
    await user.click(screen.getByTestId("governance-composer-build-button"));

    await waitFor(() =>
      expect(
        screen.getByTestId("governance-composer-package-json"),
      ).toHaveTextContent("set_thresholds"),
    );
    expect(
      screen.getByTestId("governance-composer-package-json"),
    ).toHaveTextContent('"type": "i128"');

    await user.selectOptions(
      screen.getByTestId("governance-composer-template-select"),
      "executor-governor",
    );
    await user.clear(screen.getByTestId("governance-composer-contract-input"));
    await user.type(
      screen.getByTestId("governance-composer-contract-input"),
      "CAZPR5MIUHXH46ZJ5OAMRZXD7PXIHMF5HHSSKQPDUBEXVID5SAGSZ3HW",
    );
    await user.clear(screen.getByTestId("governance-composer-field-caller"));
    await user.type(
      screen.getByTestId("governance-composer-field-caller"),
      "CAZPR5MIUHXH46ZJ5OAMRZXD7PXIHMF5HHSSKQPDUBEXVID5SAGSZ3HW",
    );
    await user.clear(screen.getByTestId("governance-composer-field-governor"));
    await user.click(screen.getByTestId("governance-composer-build-button"));

    await waitFor(() =>
      expect(
        screen.getByTestId("governance-composer-package-json"),
      ).toHaveTextContent("set_governor"),
    );
    expect(
      screen.getByTestId("governance-composer-package-json"),
    ).toHaveTextContent('"type": "void"');
  }, 30_000);

  it("loads a governed composer draft into governance authoring", async () => {
    const template = GOVERNED_ACTION_TEMPLATES.find(
      (entry) => entry.id === "factory-registry-binding",
    );

    expect(template).toBeDefined();

    writeGovernedComposerDraft(
      buildGovernedComposerDraft({
        template: template!,
        contractId: "CAP5PLAGVFFDGKIUER3BSL5XMUXF4SUGHKI5RYCD4YAS4RWWP755LDQG",
        fieldValues: {
          registry: "CAZPR5MIUHXH46ZJ5OAMRZXD7PXIHMF5HHSSKQPDUBEXVID5SAGSZ3HW",
        },
        origin: "migration-workspace",
      }),
    );
    window.history.replaceState(
      {},
      "",
      `/governance/console?draft=${GOVERNED_COMPOSER_DRAFT_QUERY}`,
    );

    render(<GovernanceConsolePage />);

    await waitFor(() =>
      expect(
        screen.getByTestId("governance-composer-status"),
      ).toHaveTextContent("Loaded governed composer draft"),
    );

    expect(
      screen.getByTestId("governance-composer-template-select"),
    ).toHaveValue("factory-registry-binding");
    expect(
      screen.getByTestId("governance-composer-contract-input"),
    ).toHaveValue("CAP5PLAGVFFDGKIUER3BSL5XMUXF4SUGHKI5RYCD4YAS4RWWP755LDQG");
    expect(
      screen.getByTestId("governance-composer-field-registry"),
    ).toHaveValue("CAZPR5MIUHXH46ZJ5OAMRZXD7PXIHMF5HHSSKQPDUBEXVID5SAGSZ3HW");
  });

  it("keeps governance wallet signer rejection explicit and retryable without submitting", async () => {
    const user = userEvent.setup();
    txMocks.signXdr.mockRejectedValueOnce(
      new Error("Wallet signature rejected by user"),
    );

    render(<GovernanceConsolePage />);

    await waitFor(() =>
      expect(
        screen.getByRole("heading", {
          name: /governance/i,
        }),
      ).toBeInTheDocument(),
    );
    await waitFor(() =>
      expect(screen.getByTestId("governance-vote-button")).toBeEnabled(),
    );

    await user.click(screen.getByTestId("governance-vote-button"));
    await waitFor(() =>
      expect(screen.getByTestId("governance-confirm-button")).toBeVisible(),
    );
    expect(screen.getByTestId("transaction-confirm-dialog")).toHaveClass(
      "transaction-surface-confirm-dialog",
    );
    await user.click(screen.getByTestId("governance-confirm-button"));

    await waitFor(() =>
      expect(screen.getByTestId("governance-error")).toHaveTextContent(
        /wallet signature rejected by user/i,
      ),
    );
    expect(sorobanMocks.buildGovernorVote).toHaveBeenCalledWith(
      shared.walletAddress,
      expect.any(String),
      0,
      1,
    );
    expect(txMocks.submitSignedTx).not.toHaveBeenCalled();
    expect(txMocks.waitForTx).not.toHaveBeenCalled();
    expect(screen.queryByTestId("governance-status")).not.toBeInTheDocument();

    txMocks.signXdr.mockRejectedValueOnce(
      new Error("Wallet signature rejected by user"),
    );
    await user.click(screen.getByTestId("governance-vote-button"));
    await waitFor(() =>
      expect(screen.getByTestId("governance-confirm-button")).toBeVisible(),
    );
    await user.click(screen.getByTestId("governance-confirm-button"));

    await waitFor(() => expect(txMocks.signXdr).toHaveBeenCalledTimes(2));
    expect(screen.getByTestId("governance-error")).toHaveTextContent(
      /wallet signature rejected by user/i,
    );
    expect(txMocks.submitSignedTx).not.toHaveBeenCalled();
    expect(txMocks.waitForTx).not.toHaveBeenCalled();
  });

  it("authors credit-market and oracle-guard policy packages from governance", async () => {
    const user = userEvent.setup();
    render(<GovernanceConsolePage />);

    await waitFor(() =>
      expect(
        screen.getByRole("heading", {
          name: /governance/i,
        }),
      ).toBeInTheDocument(),
    );

    await user.selectOptions(
      screen.getByTestId("governance-composer-template-select"),
      "credit-market-config",
    );
    await user.clear(screen.getByTestId("governance-composer-contract-input"));
    await user.type(
      screen.getByTestId("governance-composer-contract-input"),
      "CAZPR5MIUHXH46ZJ5OAMRZXD7PXIHMF5HHSSKQPDUBEXVID5SAGSZ3HW",
    );
    await user.clear(screen.getByTestId("governance-composer-field-caller"));
    await user.type(
      screen.getByTestId("governance-composer-field-caller"),
      "CAZPR5MIUHXH46ZJ5OAMRZXD7PXIHMF5HHSSKQPDUBEXVID5SAGSZ3HW",
    );
    await user.selectOptions(
      screen.getByTestId("governance-composer-field-protocol"),
      "Blend",
    );
    await user.clear(screen.getByTestId("governance-composer-field-market_id"));
    await user.type(
      screen.getByTestId("governance-composer-field-market_id"),
      "7",
    );
    await user.clear(screen.getByTestId("governance-composer-field-adapter"));
    await user.type(
      screen.getByTestId("governance-composer-field-adapter"),
      "CAZPR5MIUHXH46ZJ5OAMRZXD7PXIHMF5HHSSKQPDUBEXVID5SAGSZ3HW",
    );
    await user.selectOptions(
      screen.getByTestId("governance-composer-field-allow_borrow"),
      "false",
    );
    await user.selectOptions(
      screen.getByTestId("governance-composer-field-allow_withdraw"),
      "false",
    );
    await user.click(screen.getByTestId("governance-composer-build-button"));

    await waitFor(() =>
      expect(
        screen.getByTestId("governance-composer-package-json"),
      ).toHaveTextContent("configure_credit_market"),
    );
    expect(
      screen.getByTestId("governance-composer-package-json"),
    ).toHaveTextContent('"type": "symbol"');

    await user.selectOptions(
      screen.getByTestId("governance-composer-template-select"),
      "oracle-guard-stellar-asset-policy",
    );
    await user.clear(screen.getByTestId("governance-composer-contract-input"));
    await user.type(
      screen.getByTestId("governance-composer-contract-input"),
      "CAZPR5MIUHXH46ZJ5OAMRZXD7PXIHMF5HHSSKQPDUBEXVID5SAGSZ3HW",
    );
    for (const fieldId of [
      "caller",
      "asset",
      "primary",
      "secondary",
    ] as const) {
      await user.clear(
        screen.getByTestId(`governance-composer-field-${fieldId}`),
      );
      await user.type(
        screen.getByTestId(`governance-composer-field-${fieldId}`),
        "CAZPR5MIUHXH46ZJ5OAMRZXD7PXIHMF5HHSSKQPDUBEXVID5SAGSZ3HW",
      );
    }
    await user.click(screen.getByTestId("governance-composer-build-button"));

    await waitFor(() =>
      expect(
        screen.getByTestId("governance-composer-package-json"),
      ).toHaveTextContent("set_stellar_asset_policy"),
    );
  }, 15000);

  it("queues a governed publication candidate inside governance and restores it after refresh", async () => {
    const user = userEvent.setup();
    render(<GovernanceConsolePage />);

    await waitFor(() =>
      expect(
        screen.getByRole("heading", {
          name: /governance/i,
        }),
      ).toBeInTheDocument(),
    );
    expect(
      screen.getByTestId("governance-publication-handoff-link"),
    ).toBeDisabled();
    expect(
      screen.getByTestId("governance-publication-handoff-link"),
    ).not.toHaveAttribute("href");

    await user.selectOptions(
      screen.getByTestId("governance-composer-template-select"),
      "coverage-treasury",
    );
    await user.clear(screen.getByTestId("governance-composer-contract-input"));
    await user.type(
      screen.getByTestId("governance-composer-contract-input"),
      "CAZPR5MIUHXH46ZJ5OAMRZXD7PXIHMF5HHSSKQPDUBEXVID5SAGSZ3HW",
    );
    await user.clear(screen.getByTestId("governance-composer-field-caller"));
    await user.type(
      screen.getByTestId("governance-composer-field-caller"),
      "CAZPR5MIUHXH46ZJ5OAMRZXD7PXIHMF5HHSSKQPDUBEXVID5SAGSZ3HW",
    );
    await user.clear(screen.getByTestId("governance-composer-field-treasury"));
    await user.click(screen.getByTestId("governance-composer-build-button"));
    await user.click(screen.getByTestId("governance-composer-queue-button"));

    await waitFor(() =>
      expect(
        screen.getByTestId("governance-composer-status"),
      ).toHaveTextContent("staged in Governance"),
    );
    expect(
      screen.getByTestId("governance-publication-panel"),
    ).toHaveTextContent("Coverage treasury");
    expect(
      screen.getByTestId("governance-publication-handoff-link"),
    ).toHaveAttribute("href", "/contracts?draft=governed-action");

    cleanup();
    render(<GovernanceConsolePage />);

    await waitFor(() =>
      expect(
        screen.getByTestId("governance-publication-panel"),
      ).toHaveTextContent("Coverage treasury"),
    );

    await user.click(
      screen.getByTestId("governance-publication-restore-button"),
    );

    await waitFor(() =>
      expect(
        screen.getByTestId("governance-composer-status"),
      ).toHaveTextContent("Coverage treasury"),
    );
    expect(
      screen.getByTestId("governance-composer-template-select"),
    ).toHaveValue("coverage-treasury");
  }, 30_000);

  it("keeps public integrations free of operator diagnostics while linking to the verified operator lane", async () => {
    render(<IntegrationsPage />);

    await waitFor(() =>
      expect(
        screen.getByRole("heading", {
          name: /^integrations$/i,
        }),
      ).toBeInTheDocument(),
    );

    expect(screen.getByTestId("integrations-public-surface")).toBeInTheDocument();
    expect(screen.getByTestId("integrations-product-catalog")).toHaveTextContent(
      "Supported protocols",
    );
    expect(screen.getByTestId("integrations-product-card-balanced")).toHaveTextContent(
      "SODAX",
    );
    expect(
      screen.getByTestId("integrations-product-card-balanced-link"),
    ).toHaveAttribute("href", "/manage");
    expect(screen.queryByTestId("integrations-workspace-tabs")).toBeNull();
    expect(screen.queryByTestId("integrations-routing-table")).toBeNull();
    expect(
      screen.queryByTestId("integrations-balanced-intent-surface-panel"),
    ).toBeNull();
    expect(screen.queryByTestId("integrations-actions-panel")).toBeNull();
  });

  it("renders integrations operator shell with router health and action controls", async () => {
    const fetchMock = vi.fn(
      async (input: string | URL | Request, init?: RequestInit) => {
        const url =
          typeof input === "string"
            ? input
            : input instanceof URL
              ? input.toString()
              : input.url;
        const method =
          init?.method ??
          (typeof input === "object" && "method" in input
            ? input.method
            : "GET");

        if (url.includes("/api/health")) {
          return new Response(
            JSON.stringify({
              app: "ok",
              catalog: {
                configured: true,
                reachable: true,
                healthy: true,
                degraded: false,
                statusCode: 200,
                evaluatedAt: "2026-04-07T10:00:00.000Z",
              },
              protocols: {
                balanced: {
                  supportStatus: "ready",
                  readyForDappExecution: true,
                  laneMode: "expected_router",
                  adapterBalanced: "CBALANCED",
                  poolId: 1,
                  expectedRouter: "CROUTER",
                  validatedModule: {
                    present: true,
                    validatedAt: "2026-04-07",
                    router: "CROUTER",
                    poolId: 1,
                    sourceValidations: ["balancedReadiness"],
                    source: "deployments",
                  },
                  officialSurface: {
                    officialSources: {
                      app: "https://app.balanced.network",
                      bundle: "https://app.balanced.network/assets/index.js",
                      stellarPage: "https://balanced.network/stellar/",
                      swapDocs: "https://docs.sodax.com/developers/packages",
                      tradeBlog:
                        "https://blog.balanced.network/trade-cross-chain/",
                      q3Blog: "https://blog.balanced.network/q3-2025/",
                    },
                    topology: "intent_based",
                    swapModel: "sodax_intents",
                    liquidityModel: "legacy_exchange_only",
                    intentAdapter: {
                      quoteProvider: "sodax",
                      quoteVisibleInApp: true,
                      quoteComparableForArka: false,
                      publicQuoteEndpoint: "sdk:@sodax/sdk::swaps.getQuote",
                      publicBuildEndpoint: "sdk:@sodax/sdk::swaps.createIntent",
                      publicRelayEndpoint: "sdk:@sodax/sdk::swaps.submitIntent",
                      publicSubmitEndpoint: "sdk:@sodax/sdk::swaps.postExecution",
                      statusSurface: "recent_activity",
                      publicStatusEndpoint: "sdk:@sodax/sdk::swaps.getStatus",
                      publicReceiptEndpoint:
                        "sdk:@sodax/sdk::swaps.getSolvedIntentPacket",
                      publicExpiryEndpoint: "sdk:@sodax/sdk::swaps.getIntent",
                      publicRefundEndpoint: "sdk:@sodax/sdk::swaps.cancelIntent",
                      cancellationWindowSeconds: 300,
                    },
                    supportsPublicStellarTestnet: false,
                    canonicalRouterCutoverPossible: false,
                    findings: [],
                  },
                },
              },
              oracle: {
                source: "deployments",
                metrics: {
                  ranking: "catalog_rank",
                  nav: "catalog_nav",
                  profit: "catalog_profit_or_activity",
                  volume: "catalog_volume_or_activity",
                  activityFallbackWindowEvents: 60,
                },
                oracle: {
                  mode: "unverified",
                  validatedAt: null,
                  network: null,
                  rpcUrl: null,
                  oracleGuard: null,
                  primaryOracle: null,
                  secondaryOracle: null,
                  validationAsset: null,
                  selectedSourceUnderDivergence: null,
                  source: "fallback",
                },
                deployment: {
                  targetNetwork: "testnet",
                  deploymentsPath: "/tmp/deployments.testnet.json",
                  pathSource: "env_path",
                  fileFound: true,
                  networkMismatch: false,
                  readError: null,
                },
              },
            }),
            {
              status: 200,
              headers: { "content-type": "application/json" },
            },
          );
        }

        if (url.includes("/api/intents/balanced/quote") && method === "GET") {
          return new Response(
            JSON.stringify({
              provider: "sodax_sdk",
              chainId: "stellar",
              tokens: [
                {
                  symbol: "bnUSD",
                  name: "Balanced Dollar",
                  decimals: 7,
                  address: "CBNUSD",
                  chainId: "stellar",
                },
                {
                  symbol: "USDC",
                  name: "USD Coin",
                  decimals: 7,
                  address: "CUSDC",
                  chainId: "stellar",
                },
                {
                  symbol: "XLM",
                  name: "Lumens",
                  decimals: 7,
                  address: "CXLM",
                  chainId: "stellar",
                },
              ],
            }),
            {
              status: 200,
              headers: { "content-type": "application/json" },
            },
          );
        }

        if (url.includes("/api/intents/balanced/quote") && method === "POST") {
          return new Response(
            JSON.stringify({
              ok: true,
              provider: "sodax_sdk",
              tokenIn: {
                symbol: "bnUSD",
                name: "Balanced Dollar",
                decimals: 7,
                address: "CBNUSD",
                chainId: "stellar",
              },
              tokenOut: {
                symbol: "USDC",
                name: "USD Coin",
                decimals: 7,
                address: "CUSDC",
                chainId: "stellar",
              },
              amountInBase: "10000000",
              quotedAmountBase: "9985000",
              quoteType: "exact_input",
            }),
            {
              status: 200,
              headers: { "content-type": "application/json" },
            },
          );
        }

        if (url.includes("/api/intents/balanced/relay") && method === "POST") {
          const body = JSON.parse(String(init?.body ?? "{}")) as {
            sourceTxHash?: string;
          };
          return new Response(
            JSON.stringify({
              ok: true,
              provider: "sodax_sdk",
              sourceTxHash: body.sourceTxHash ?? "abcdef1234567890",
              relayChainId: "27",
              success: true,
              message: "Source transaction relayed.",
              canonicalIntentTxHash: "0xrelaydst",
              canonicalIntentPacket: {
                srcChainId: "27",
                srcTxHash: body.sourceTxHash ?? "abcdef1234567890",
                srcAddress: "GCSOURCE",
                status: "executed",
                dstChainId: "27",
                connectionSequence: "1",
                dstAddress: "GDESTINATION",
                dstTxHash: "0xrelaydst",
              },
              packets: [],
              detail: "Canonical SODAX intent hash resolved from relay packet.",
            }),
            {
              status: 200,
              headers: { "content-type": "application/json" },
            },
          );
        }

        if (url.includes("/api/intents/balanced/submit") && method === "POST") {
          const body = JSON.parse(String(init?.body ?? "{}")) as {
            intentTxHash?: string;
          };
          return new Response(
            JSON.stringify({
              ok: true,
              provider: "sodax_sdk",
              intentTxHash: body.intentTxHash ?? "0xrelaydst",
              answer: "OK",
              solverIntentHash: body.intentTxHash ?? "0xrelaydst",
              detail: "SODAX post-execution notification accepted.",
            }),
            {
              status: 200,
              headers: { "content-type": "application/json" },
            },
          );
        }

        if (url.includes("/api/intents/balanced/status") && method === "POST") {
          const body = JSON.parse(String(init?.body ?? "{}")) as {
            intentTxHash?: string;
          };
          return new Response(
            JSON.stringify({
              ok: true,
              provider: "sodax_sdk",
              intentTxHash: body.intentTxHash ?? "0xrelaydst",
              statusCode: 3,
              statusLabel: "SOLVED",
              fillTxHash: "0xfill",
              terminal: true,
            }),
            {
              status: 200,
              headers: { "content-type": "application/json" },
            },
          );
        }

        if (
          url.includes("/api/intents/balanced/confirm") &&
          method === "POST"
        ) {
          const body = JSON.parse(String(init?.body ?? "{}")) as {
            intentTxHash?: string;
          };
          return new Response(
            JSON.stringify({
              ok: true,
              provider: "sodax_sdk",
              intentTxHash: body.intentTxHash ?? "0xrelaydst",
              statusCode: 3,
              statusLabel: "SOLVED",
              terminal: true,
              fillTxHash: "0xfill",
              confirmationTxHash: "0xfill",
              confirmed: true,
              confirmationState: "confirmed",
              detail:
                "Intent solved and settlement hash confirmed from SODAX status.",
            }),
            {
              status: 200,
              headers: { "content-type": "application/json" },
            },
          );
        }

        return new Response(
          JSON.stringify({ error: `Unhandled fetch: ${url}` }),
          {
            status: 500,
            headers: { "content-type": "application/json" },
          },
        );
      },
    );
    vi.stubGlobal("fetch", fetchMock as typeof fetch);
    const user = userEvent.setup();
    render(<IntegrationsSurface mode="operator" />);

    await waitFor(() =>
      expect(
        screen.getByRole("heading", {
          name: /^integrations operator$/i,
        }),
      ).toBeInTheDocument(),
    );

    expect(
      screen.getByTestId("integrations-workspace-tab-routing"),
    ).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByTestId("integrations-product-catalog")).toHaveTextContent(
      "Supported protocols",
    );
    expect(screen.getByTestId("integrations-product-card-grid")).toHaveTextContent(
      "Blend",
    );
    expect(screen.getByTestId("integrations-product-card-soroswap")).toHaveTextContent(
      "SoroSwap",
    );
    expect(screen.getByTestId("integrations-product-card-soroswap-link")).toHaveAttribute(
      "href",
      "/manage",
    );
    expect(screen.getByTestId("integrations-product-card-balanced")).toHaveTextContent(
      "SODAX",
    );
    expect(screen.getByTestId("integrations-product-card-balanced-link")).toHaveAttribute(
      "href",
      "/manage",
    );
    await user.click(screen.getByTestId("integrations-workspace-tab-sodax"));
    expect(
      screen.getByTestId("integrations-workspace-tab-sodax"),
    ).toHaveAttribute("aria-pressed", "true");
    await user.click(screen.getByTestId("integrations-workspace-tab-routing"));
    expect(screen.getByTestId("integrations-public-metric-deck")).toHaveTextContent(
      "Protocol coverage",
    );
    await waitFor(() =>
      expect(screen.getByTestId("integrations-public-metric-routes")).toHaveTextContent(
        "4/5",
      ),
    );
    expect(screen.getByTestId("integrations-public-metric-routes")).toHaveClass(
      "public-figma-metric-card-routes",
    );
    expect(screen.getByTestId("integrations-public-metric-auto")).toHaveTextContent(
      "AUTO venues",
    );
    expect(screen.getByTestId("integrations-public-metric-auto")).toHaveClass(
      "public-figma-metric-card-auto",
    );
    expect(screen.getByTestId("integrations-public-metric-wallet")).toHaveTextContent(
      "GCFLOW",
    );
    expect(screen.getByTestId("integrations-public-metric-wallet")).toHaveClass(
      "public-figma-metric-card-wallet",
    );
    expect(screen.getByTestId("integrations-protocol-visual")).toHaveTextContent(
      "Validated venue map",
    );
    expect(screen.getByTestId("integrations-protocol-node-balanced")).toHaveTextContent(
      "Balanced",
    );
    expect(screen.getByTestId("integrations-protocol-node-aquarius")).toHaveTextContent(
      "Aquarius",
    );
    expect(screen.getByTestId("integrations-protocol-node-sushi")).toHaveTextContent(
      "Sushi",
    );
    expect(screen.getByTestId("integrations-protocol-node-soroswap")).toHaveTextContent(
      "SoroSwap",
    );
    expect(screen.getByTestId("integrations-protocol-node-blend")).toHaveTextContent(
      "Blend",
    );
    expect(
      screen.getByTestId("integrations-workspace-summary"),
    ).toHaveTextContent("Protocol map");
    expect(screen.getByTestId("integrations-command-deck")).toHaveTextContent(
      "Balanced / SODAX",
    );
    expect(screen.getByTestId("integrations-command-deck")).toHaveClass(
      "integrations-command-deck-cutover",
    );
    expect(screen.getByTestId("integrations-command-amm")).toHaveTextContent(
      "SoroSwap + Aquarius + Sushi",
    );
    expect(screen.getByTestId("integrations-command-amm-link")).toHaveAttribute(
      "href",
      "/arkas",
    );
    expect(screen.getByTestId("integrations-command-checks-button")).toHaveAttribute(
      "aria-controls",
      "integrations-workspace-panel-execution",
    );
    await user.click(screen.getByTestId("integrations-command-checks-button"));
    expect(
      screen.getByTestId("integrations-workspace-tab-execution"),
    ).toHaveAttribute("aria-pressed", "true");
    await user.click(screen.getByTestId("integrations-workspace-tab-routing"));
    expect(screen.getByTestId("integrations-routing-panel")).toHaveTextContent(
      "Aquarius adapter",
    );
    expect(screen.getByTestId("integrations-routing-panel")).toHaveTextContent(
      "SoroSwap adapter",
    );
    expect(screen.getByTestId("integrations-routing-panel")).toHaveTextContent(
      "Sushi adapter",
    );
    expect(screen.getByTestId("integrations-routing-panel")).toHaveTextContent(
      "Balanced adapter",
    );
    expect(screen.getByTestId("integrations-routing-panel")).toHaveTextContent(
      "Blend adapter",
    );
    expect(screen.getByTestId("integrations-routing-panel")).toHaveClass(
      "integrations-workspace-frame-cutover",
    );
    expect(screen.getByTestId("integrations-routing-table")).toHaveTextContent(
      "Configured route",
    );
    expect(screen.getByTestId("integrations-routing-table")).toHaveClass(
      "integrations-routing-table-cutover",
    );
    expect(
      screen.queryByTestId("integrations-venue-model-table"),
    ).not.toBeInTheDocument();
    await user.click(screen.getByTestId("integrations-routing-view-venues"));
    expect(
      screen.getByTestId("integrations-venue-model-table"),
    ).toHaveTextContent("Intent route");
    expect(
      screen.getByTestId("integrations-venue-model-table"),
    ).toHaveTextContent("Arka-routed");
    expect(
      screen.getByTestId("integrations-venue-model-table"),
    ).toHaveTextContent("Transaction hash + refreshed state");
    expect(
      screen.getByTestId("integrations-venue-model-table"),
    ).toHaveTextContent(/Manual only|Blocked|AUTO/);
    expect(screen.getByTestId("integrations-venue-model-table")).toHaveClass(
      "integrations-routing-table-cutover",
    );
    expect(
      screen.queryByTestId("integrations-intent-source-table"),
    ).not.toBeInTheDocument();
    await user.click(screen.getByTestId("integrations-routing-view-balanced"));
    expect(
      screen.getByTestId("integrations-intent-source-table"),
    ).toHaveTextContent("Balanced / SODAX");
    expect(
      screen.getByTestId("integrations-intent-source-table"),
    ).toHaveTextContent(/Verified|Partial|Unverified/);
    expect(
      screen.getByTestId("integrations-intent-driver-table"),
    ).toHaveTextContent("Balanced / SODAX");
    expect(
      screen.getByTestId("integrations-intent-driver-table"),
    ).toHaveTextContent(/Manual execution|Execution unavailable/i);
    expect(
      screen.getByTestId("integrations-intent-handoff-table"),
    ).toHaveTextContent("Balanced / SODAX intent flow");
    expect(
      screen.getByTestId("integrations-intent-handoff-table"),
    ).toHaveTextContent(/Official app discovery|Execution|Confirmation/i);

    await user.click(screen.getByTestId("integrations-workspace-tab-sodax"));
    expect(
      screen.getByTestId("integrations-workspace-tab-sodax"),
    ).toHaveAttribute("aria-pressed", "true");
    expect(
      screen.getByTestId("integrations-workspace-summary"),
    ).toHaveTextContent("Intent surface");
    expect(
      screen.getByTestId("integrations-balanced-intent-surface-panel"),
    ).toHaveTextContent("Balanced / SODAX public surface");
    expect(
      screen.getByTestId("integrations-balanced-intent-surface-panel"),
    ).toHaveClass("integrations-balanced-intent-card-cutover");
    expect(
      screen.getByTestId("integrations-balanced-intent-surface-panel"),
    ).toHaveTextContent(/Quote:|Status:|Receipt:/i);
    expect(
      screen.getByTestId("integrations-balanced-intent-surface-panel"),
    ).not.toHaveTextContent("not wired");
    expect(
      screen.getByTestId("integrations-balanced-intent-surface-panel"),
    ).toHaveTextContent(/SODAX|Quote:/i);

    expect(
      screen.getByTestId("integrations-balanced-intent-quote-button"),
    ).toBeDisabled();
    expect(
      screen.getByTestId("integrations-balanced-intent-status-button"),
    ).toBeDisabled();
    expect(
      screen.getByTestId("integrations-balanced-intent-confirm-button"),
    ).toBeDisabled();
    expect(
      screen.getByTestId("integrations-balanced-intent-action-readiness"),
    ).toHaveTextContent("Load the SODAX token catalog first.");
    await user.click(
      screen.getByTestId("integrations-balanced-intent-load-button"),
    );
    await waitFor(() =>
      expect(
        screen.getByTestId("integrations-balanced-intent-token-catalog"),
      ).toHaveTextContent("bnUSD, USDC, XLM"),
    );
    expect(
      screen.getByTestId("integrations-balanced-intent-quote-button"),
    ).toBeEnabled();
    expect(
      screen.getByTestId("integrations-balanced-intent-action-readiness"),
    ).toHaveTextContent("Ready to request the official SODAX quote.");
    await user.click(
      screen.getByTestId("integrations-balanced-intent-quote-button"),
    );
    await waitFor(() =>
      expect(
        screen.getByTestId("integrations-balanced-intent-quote-result"),
      ).toHaveTextContent("Quote ready"),
    );
    await user.type(
      screen.getByTestId("integrations-balanced-intent-source-hash-input"),
      "abcdef1234567890",
    );
    await user.click(
      screen.getByTestId("integrations-balanced-intent-relay-button"),
    );
    await waitFor(() =>
      expect(
        screen.getByTestId("integrations-balanced-intent-relay-result"),
      ).toHaveTextContent("0xrelaydst"),
    );
    expect(
      screen.getByTestId("integrations-balanced-intent-status-input"),
    ).toHaveValue("0xrelaydst");
    expect(
      screen.getByTestId("integrations-balanced-intent-submit-button"),
    ).toBeEnabled();
    await user.click(
      screen.getByTestId("integrations-balanced-intent-submit-button"),
    );
    await waitFor(() =>
      expect(
        screen.getByTestId("integrations-balanced-intent-submit-result"),
      ).toHaveTextContent("solver intent 0xrelaydst"),
    );
    expect(
      screen.getByTestId("integrations-balanced-intent-status-button"),
    ).toBeEnabled();
    expect(
      screen.getByTestId("integrations-balanced-intent-confirm-button"),
    ).toBeEnabled();
    await user.click(
      screen.getByTestId("integrations-balanced-intent-status-button"),
    );
    await waitFor(() =>
      expect(
        screen.getByTestId("integrations-balanced-intent-status-result"),
      ).toHaveTextContent("Status SOLVED"),
    );
    await user.click(
      screen.getByTestId("integrations-balanced-intent-confirm-button"),
    );
    await waitFor(() =>
      expect(
        screen.getByTestId("integrations-balanced-intent-confirm-result"),
      ).toHaveTextContent("Confirm confirmed"),
    );

    await user.click(
      screen.getByTestId("integrations-workspace-tab-execution"),
    );
    expect(screen.getByTestId("integrations-controls-panel")).toHaveTextContent(
      "Refresh checks",
    );
    expect(screen.getByTestId("integrations-controls-table")).toHaveTextContent(
      "Execution signs through the connected wallet",
    );
    expect(screen.getByTestId("integrations-controls-panel")).toHaveTextContent(
      "Route checks",
    );

    await user.click(screen.getByTestId("integrations-workspace-tab-actions"));
    expect(screen.getByTestId("integrations-actions-panel")).toHaveTextContent(
      "uses intent execution",
    );
    expect(
      screen.getByTestId("integrations-balanced-lane-note"),
    ).toHaveTextContent(
      /routing needs review before live actions/i,
    );
    expect(
      screen.getByTestId("integrations-balanced-module-note"),
    ).toHaveTextContent(
      /Validated module has not been promoted yet|Canonical module promoted/i,
    );
    expect(
      screen.getByTestId("integrations-balanced-official-note"),
    ).toHaveTextContent(
      /Official Balanced on Stellar|Official Stellar topology/i,
    );
    expect(
      screen.getByTestId("integrations-balanced-capability-note"),
    ).toHaveTextContent(/Tokens|Quote|Execution|Best execution/i);
    expect(
      screen.getByTestId("integrations-balanced-driver-note"),
    ).toHaveTextContent(/Connection .* Quote .* Execution .* Confirm .* Status/i);
    expect(
      screen.getByTestId("integrations-balanced-quote-status-note"),
    ).toHaveTextContent(/Quote endpoint:|Status surface:|Cancel window:/i);
    expect(
      screen.getByTestId("integrations-balanced-handoff-note"),
    ).toHaveTextContent(/manual intent flow|discovery only|blocked/i);
    expect(
      screen.getByTestId("integrations-balanced-handoff-route"),
    ).toHaveTextContent(
      /Official app discovery|Arka adapter execution|Execution blocked/i,
    );
    expect(
      screen.getByTestId("integrations-balanced-handoff-checks"),
    ).toHaveTextContent(
      /Official discovery:|Quote capture:|Execution:|Confirmation:/i,
    );
    expect(
      screen.getByTestId("integrations-balanced-handoff-links"),
    ).toHaveTextContent(
      /Official app|Recent Activity|Stellar page|Trade blog|No official handoff links/i,
    );
    expect(
      screen.getByTestId("integrations-balanced-source-note"),
    ).toHaveTextContent(/SODAX Intents|not ready for AUTO|quotes and status/i);
    expect(
      screen.getByTestId("integrations-balanced-source-links"),
    ).toHaveTextContent(
      /Official app|Stellar page|Trade blog|Official source links have not been loaded/i,
    );
    expect(
      screen.getByTestId("integrations-balanced-confirmation-note"),
    ).toHaveTextContent(/submitted transaction hash plus refreshed post-trade state/i);
    expect(
      screen.getByTestId("integrations-mainnet-gate-note"),
    ).toHaveTextContent(/Mainnet publication gate/i);
    expect(screen.getByTestId("integrations-actions-panel")).toHaveTextContent(
      "Run Balanced",
    );
    expect(screen.getByTestId("integrations-run-balanced")).toBeVisible();
    expect(screen.getByTestId("integrations-run-balanced")).toBeDisabled();
    expect(screen.getByTestId("integrations-actions-panel")).toHaveTextContent(
      "Sushi, Aquarius and SoroSwap stay available through the manager-owned Arka execution flow",
    );
    expect(screen.getByTestId("integrations-actions-panel")).toHaveTextContent(
      "Run Blend",
    );
    expect(screen.getByTestId("integrations-actions-panel")).toHaveTextContent(
      "Ready to review",
    );
  });

  it("keeps the Balanced SODAX intent surface degraded and retryable without inventing execution", async () => {
    let catalogRequests = 0;
    let quoteRequests = 0;
    let statusRequests = 0;
    let confirmRequests = 0;
    const fetchMock = vi.fn(
      async (input: string | URL | Request, init?: RequestInit) => {
        const url =
          typeof input === "string"
            ? input
            : input instanceof URL
              ? input.toString()
              : input.url;
        const method =
          init?.method ??
          (typeof input === "object" && "method" in input
            ? input.method
            : "GET");

        if (url.includes("/api/health")) {
          return new Response(
            JSON.stringify({
              app: "ok",
              catalog: {
                configured: true,
                reachable: true,
                healthy: true,
                degraded: false,
                statusCode: 200,
                evaluatedAt: "2026-05-02T10:00:00.000Z",
              },
              protocols: {
                balanced: {
                  supportStatus: "ready",
                  readyForDappExecution: true,
                  laneMode: "expected_router",
                  adapterBalanced: "CBALANCED",
                  poolId: 1,
                  expectedRouter: "CROUTER",
                  validatedModule: {
                    present: true,
                    validatedAt: "2026-05-02",
                    router: "CROUTER",
                    poolId: 1,
                    sourceValidations: ["balancedReadiness"],
                    source: "deployments",
                  },
                  officialSurface: {
                    officialSources: {
                      app: "https://app.balanced.network",
                      bundle: "https://app.balanced.network/assets/index.js",
                      stellarPage: "https://balanced.network/stellar/",
                      swapDocs: "https://docs.sodax.com/developers/packages",
                      tradeBlog:
                        "https://blog.balanced.network/trade-cross-chain/",
                      q3Blog: "https://blog.balanced.network/q3-2025/",
                    },
                    topology: "intent_based",
                    swapModel: "sodax_intents",
                    liquidityModel: "legacy_exchange_only",
                    intentAdapter: {
                      quoteProvider: "sodax",
                      quoteVisibleInApp: true,
                      quoteComparableForArka: false,
                      publicQuoteEndpoint: "sdk:@sodax/sdk::swaps.getQuote",
                      publicBuildEndpoint: "sdk:@sodax/sdk::swaps.createIntent",
                      publicRelayEndpoint: "sdk:@sodax/sdk::swaps.submitIntent",
                      publicSubmitEndpoint: "sdk:@sodax/sdk::swaps.postExecution",
                      statusSurface: "recent_activity",
                      publicStatusEndpoint: "sdk:@sodax/sdk::swaps.getStatus",
                      publicReceiptEndpoint:
                        "sdk:@sodax/sdk::swaps.getSolvedIntentPacket",
                      publicExpiryEndpoint: "sdk:@sodax/sdk::swaps.getIntent",
                      publicRefundEndpoint: "sdk:@sodax/sdk::swaps.cancelIntent",
                      cancellationWindowSeconds: 300,
                    },
                    supportsPublicStellarTestnet: false,
                    canonicalRouterCutoverPossible: false,
                    findings: [],
                  },
                },
              },
              oracle: {
                source: "fallback",
                metrics: {
                  ranking: "catalog_rank",
                  nav: "catalog_nav",
                  profit: "catalog_profit_or_activity",
                  volume: "catalog_volume_or_activity",
                  activityFallbackWindowEvents: 60,
                },
                oracle: { mode: "unverified", source: "fallback" },
                deployment: {
                  targetNetwork: "testnet",
                  deploymentsPath: "/tmp/deployments.testnet.json",
                  pathSource: "env_path",
                  fileFound: true,
                  networkMismatch: false,
                  readError: null,
                },
              },
            }),
            {
              status: 200,
              headers: { "content-type": "application/json" },
            },
          );
        }

        if (url.includes("/api/intents/balanced/quote") && method === "GET") {
          catalogRequests += 1;
          if (catalogRequests === 1) {
            return new Response(
              JSON.stringify({ error: "SODAX token catalog unavailable." }),
              {
                status: 503,
                headers: { "content-type": "application/json" },
              },
            );
          }
          return new Response(
            JSON.stringify({
              provider: "sodax_sdk",
              chainId: "stellar",
              tokens: [
                {
                  symbol: "bnUSD",
                  name: "Balanced Dollar",
                  decimals: 7,
                  address: "CBNUSD",
                  chainId: "stellar",
                },
                {
                  symbol: "USDC",
                  name: "USD Coin",
                  decimals: 7,
                  address: "CUSDC",
                  chainId: "stellar",
                },
              ],
            }),
            {
              status: 200,
              headers: { "content-type": "application/json" },
            },
          );
        }

        if (url.includes("/api/intents/balanced/quote") && method === "POST") {
          quoteRequests += 1;
          if (quoteRequests === 1) {
            return new Response(
              JSON.stringify({ error: "SODAX quote unavailable." }),
              {
                status: 502,
                headers: { "content-type": "application/json" },
              },
            );
          }
          return new Response(
            JSON.stringify({
              ok: true,
              provider: "sodax_sdk",
              tokenIn: {
                symbol: "bnUSD",
                name: "Balanced Dollar",
                decimals: 7,
                address: "CBNUSD",
                chainId: "stellar",
              },
              tokenOut: {
                symbol: "USDC",
                name: "USD Coin",
                decimals: 7,
                address: "CUSDC",
                chainId: "stellar",
              },
              amountInBase: "10000000",
              quotedAmountBase: "9975000",
              quoteType: "exact_input",
            }),
            {
              status: 200,
              headers: { "content-type": "application/json" },
            },
          );
        }

        if (url.includes("/api/intents/balanced/status") && method === "POST") {
          statusRequests += 1;
          if (statusRequests === 1) {
            return new Response(
              JSON.stringify({ error: "SODAX status unavailable." }),
              {
                status: 503,
                headers: { "content-type": "application/json" },
              },
            );
          }
          return new Response(
            JSON.stringify({
              ok: true,
              provider: "sodax_sdk",
              intentTxHash: "0xintent",
              statusCode: 3,
              statusLabel: "SOLVED",
              fillTxHash: "0xfill",
              terminal: true,
            }),
            {
              status: 200,
              headers: { "content-type": "application/json" },
            },
          );
        }

        if (
          url.includes("/api/intents/balanced/confirm") &&
          method === "POST"
        ) {
          confirmRequests += 1;
          if (confirmRequests === 1) {
            return new Response(
              JSON.stringify({ error: "SODAX confirmation unavailable." }),
              {
                status: 504,
                headers: { "content-type": "application/json" },
              },
            );
          }
          return new Response(
            JSON.stringify({
              ok: true,
              provider: "sodax_sdk",
              intentTxHash: "0xintent",
              statusCode: 3,
              statusLabel: "SOLVED",
              terminal: true,
              fillTxHash: "0xfill",
              confirmationTxHash: "0xfill",
              confirmed: true,
              confirmationState: "confirmed",
              detail:
                "Intent solved and settlement hash confirmed from SODAX status.",
            }),
            {
              status: 200,
              headers: { "content-type": "application/json" },
            },
          );
        }

        return new Response(JSON.stringify({ error: `Unhandled ${url}` }), {
          status: 500,
          headers: { "content-type": "application/json" },
        });
      },
    );
    vi.stubGlobal("fetch", fetchMock as typeof fetch);
    const user = userEvent.setup();

    render(<IntegrationsSurface mode="operator" />);

    await user.click(screen.getByTestId("integrations-workspace-tab-sodax"));
    await user.click(
      screen.getByTestId("integrations-balanced-intent-load-button"),
    );
    await waitFor(() =>
      expect(
        screen.getByTestId("integrations-balanced-intent-error"),
      ).toHaveTextContent("SODAX token catalog unavailable."),
    );
    expect(
      screen.getByTestId("integrations-balanced-intent-token-catalog"),
    ).toHaveTextContent("Catalog not loaded yet.");
    expect(
      screen.getByTestId("integrations-balanced-intent-quote-button"),
    ).toBeDisabled();

    await user.click(
      screen.getByTestId("integrations-balanced-intent-load-button"),
    );
    await waitFor(() =>
      expect(
        screen.getByTestId("integrations-balanced-intent-token-catalog"),
      ).toHaveTextContent("Catalog loaded: bnUSD, USDC"),
    );

    await user.click(
      screen.getByTestId("integrations-balanced-intent-quote-button"),
    );
    await waitFor(() =>
      expect(
        screen.getByTestId("integrations-balanced-intent-error"),
      ).toHaveTextContent("SODAX quote unavailable."),
    );
    expect(
      screen.getByTestId("integrations-balanced-intent-quote-result"),
    ).toHaveTextContent("No quote requested yet.");

    await user.click(
      screen.getByTestId("integrations-balanced-intent-quote-button"),
    );
    await waitFor(() =>
      expect(
        screen.getByTestId("integrations-balanced-intent-quote-result"),
      ).toHaveTextContent("Quote ready"),
    );

    await user.type(
      screen.getByTestId("integrations-balanced-intent-status-input"),
      "0xintent",
    );
    await user.click(
      screen.getByTestId("integrations-balanced-intent-status-button"),
    );
    await waitFor(() =>
      expect(
        screen.getByTestId("integrations-balanced-intent-error"),
      ).toHaveTextContent("SODAX status unavailable."),
    );
    await user.click(
      screen.getByTestId("integrations-balanced-intent-status-button"),
    );
    await waitFor(() =>
      expect(
        screen.getByTestId("integrations-balanced-intent-status-result"),
      ).toHaveTextContent("Status SOLVED"),
    );

    await user.click(
      screen.getByTestId("integrations-balanced-intent-confirm-button"),
    );
    await waitFor(() =>
      expect(
        screen.getByTestId("integrations-balanced-intent-confirm-result"),
      ).toHaveTextContent("Confirmation unavailable"),
    );
    expect(
      screen.getByTestId("integrations-balanced-intent-error"),
    ).toHaveTextContent("SODAX confirmation unavailable.");

    await user.click(
      screen.getByTestId("integrations-balanced-intent-confirm-button"),
    );
    await waitFor(() =>
      expect(
        screen.getByTestId("integrations-balanced-intent-confirm-result"),
      ).toHaveTextContent("Confirm confirmed"),
    );

    expect(catalogRequests).toBe(2);
    expect(quoteRequests).toBe(2);
    expect(statusRequests).toBe(2);
    expect(confirmRequests).toBe(2);
    expect(txMocks.submitSignedTx).not.toHaveBeenCalled();
  });

  it("records a structured execution receipt after a live Blend action", async () => {
    const user = userEvent.setup();
    render(<IntegrationsSurface mode="operator" />);

    await user.click(screen.getByTestId("integrations-workspace-tab-actions"));

    await waitFor(() =>
      expect(screen.getAllByTestId("integrations-run-blend")[0]).toBeEnabled(),
    );

    await user.click(screen.getAllByTestId("integrations-run-blend")[0]);

    await waitFor(() =>
      expect(
        screen.getByTestId("integrations-execution-receipt-panel"),
      ).toBeInTheDocument(),
    );

    expect(
      screen.getByTestId("integrations-execution-receipt-summary"),
    ).toHaveTextContent(/Credit market/i);
    expect(
      screen.getByTestId("integrations-execution-receipt-panel"),
    ).toHaveTextContent("Credit command");
    expect(
      screen.getByTestId("integrations-execution-receipt-panel"),
    ).toHaveTextContent("Transaction hash + refreshed state");
    expect(
      screen.getByTestId("integrations-execution-receipt-primary-hash"),
    ).toHaveTextContent("tx-hash-123");
  });

  it("blocks Balanced execution when mainnet oracle publication gate is not ready", async () => {
    const user = userEvent.setup();
    cleanup();
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: string | URL | Request) => {
        const url =
          typeof input === "string"
            ? input
            : input instanceof URL
              ? input.toString()
              : input.url;
        if (!url.includes("/api/health")) {
          return new Response(JSON.stringify({ error: "Unhandled fetch" }), {
            status: 500,
            headers: { "content-type": "application/json" },
          });
        }
        return new Response(
          JSON.stringify({
            app: "ok",
            catalog: {
              configured: true,
              reachable: true,
              healthy: true,
              degraded: false,
              statusCode: 200,
              evaluatedAt: "2026-04-16T10:00:00.000Z",
            },
            protocols: {
              balanced: {
                supportStatus: "ready",
                readyForDappExecution: true,
                laneMode: "expected_router",
                adapterBalanced: "CBALANCED",
                poolId: 1,
                expectedRouter:
                  "CAHF53IIWUVKFOJ4H7OHIB667NEU7MTC3YUHSIZWETFXXPAI6DS75HQK",
                validatedModule: {
                  present: true,
                  validatedAt: "2026-04-16",
                  router:
                    "CAHF53IIWUVKFOJ4H7OHIB667NEU7MTC3YUHSIZWETFXXPAI6DS75HQK",
                  poolId: 1,
                  sourceValidations: ["balancedReadiness"],
                  source: "deployments",
                },
                officialSurface: {
                  officialSources: {
                    app: "https://app.balanced.network",
                    bundle: "https://app.balanced.network/assets/index.js",
                    stellarPage: "https://balanced.network/stellar/",
                    swapDocs: "https://docs.sodax.com/developers/packages",
                    tradeBlog:
                      "https://blog.balanced.network/trade-cross-chain/",
                    q3Blog: "https://blog.balanced.network/q3-2025/",
                  },
                  topology: "intent_based",
                  swapModel: "sodax_intents",
                  liquidityModel: "legacy_exchange_only",
                  intentAdapter: {
                    quoteProvider: "sodax",
                    quoteVisibleInApp: true,
                    quoteComparableForArka: false,
                    publicQuoteEndpoint: "sdk:@sodax/sdk::swaps.getQuote",
                    publicBuildEndpoint: "sdk:@sodax/sdk::swaps.createIntent",
                    publicRelayEndpoint: "sdk:@sodax/sdk::swaps.submitIntent",
                    publicSubmitEndpoint: "sdk:@sodax/sdk::swaps.postExecution",
                    statusSurface: "recent_activity",
                    publicStatusEndpoint: "sdk:@sodax/sdk::swaps.getStatus",
                    publicReceiptEndpoint:
                      "sdk:@sodax/sdk::swaps.getSolvedIntentPacket",
                    publicExpiryEndpoint: "sdk:@sodax/sdk::swaps.getIntent",
                    publicRefundEndpoint: "sdk:@sodax/sdk::swaps.cancelIntent",
                    cancellationWindowSeconds: 300,
                  },
                  supportsPublicStellarTestnet: false,
                  canonicalRouterCutoverPossible: false,
                  findings: [],
                },
              },
            },
            oracle: {
              source: "fallback",
              metrics: {
                ranking: "catalog_rank",
                nav: "catalog_nav",
                profit: "catalog_profit_or_activity",
                volume: "catalog_volume_or_activity",
                activityFallbackWindowEvents: 60,
              },
              oracle: {
                mode: "unverified",
                validatedAt: null,
                network: null,
                rpcUrl: null,
                oracleGuard: null,
                primaryOracle: null,
                secondaryOracle: null,
                validationAsset: null,
                selectedSourceUnderDivergence: null,
                source: "fallback",
              },
              deployment: {
                targetNetwork: "mainnet",
                deploymentsPath: "/tmp/deployments.mainnet.json",
                pathSource: "env_path",
                fileFound: false,
                networkMismatch: false,
                readError: "ENOENT",
              },
            },
          }),
          {
            status: 200,
            headers: { "content-type": "application/json" },
          },
        );
      }) as typeof fetch,
    );

    render(<IntegrationsSurface mode="operator" />);

    await user.click(screen.getByTestId("integrations-workspace-tab-actions"));

    await waitFor(() =>
      expect(screen.getByTestId("integrations-run-balanced")).toBeVisible(),
    );

    expect(
      screen.getByTestId("integrations-balanced-lane-note"),
    ).toHaveTextContent(/minimum out|router wiring|execution is blocked/i);
    expect(
      screen.getByTestId("integrations-mainnet-gate-note"),
    ).toHaveTextContent(/mainnet/i);
    expect(
      screen.getByTestId("integrations-mainnet-gate-note"),
    ).toHaveTextContent(/manifest is missing|snapshot is unavailable/i);
    expect(screen.getByTestId("integrations-run-balanced")).toBeDisabled();
  });

  it("keeps an incomplete asset catalog out of creation and loads all pages on retry", async () => {
    const user = userEvent.setup();
    const available = creationCatalogFixture(new URLSearchParams()).items;
    const offsets: number[] = [];
    let unavailable = true;
    vi.stubGlobal("fetch", vi.fn(async (input: string) => {
      const url = new URL(input, "http://localhost");
      if (url.pathname === "/api/assets/core-registry") return Response.json({ items: [] });
      if (url.pathname !== "/api/catalog/v1/assets") throw new Error("Unexpected test request");
      const offset = Number(url.searchParams.get("offset"));
      offsets.push(offset);
      if (offset === 1 && unavailable) return Response.json({ message: "Unavailable" }, { status: 503 });
      const items = offset === 0 ? available.slice(0, 1) : available.slice(offset);
      return Response.json({ offset, limit: items.length, total: available.length, items });
    }));

    render(<CreateArkaClient />);
    await screen.findByText("Asset catalog unavailable.");
    expect(screen.queryByTestId("create-arka-denomination-select")).not.toBeInTheDocument();
    await user.click(screen.getByTestId("create-step-review"));
    expect(screen.getByTestId("create-arka-submit-button")).toBeDisabled();
    unavailable = false;
    await user.click(screen.getByRole("button", { name: "Retry" }));
    await waitFor(() => expect(screen.getByTestId("create-arka-submit-button")).toBeEnabled());
    expect(offsets).toEqual([0, 1, 0, 1]);
    expect(txMocks.signXdr).not.toHaveBeenCalled();
  });

  it("uses the reviewed template for managed creation before the catalog has a fund", async () => {
    vi.stubEnv("NEXT_PUBLIC_V3_DEFAULT_CREATION", "1");
    vi.resetModules();
    try {
      const denomination = "CAS3J7GYLGXMF6TDJBBYYSE3HQ6BBSMLNUQ34T6TZMYMW2EVH34XOWMA";
      const other = "CCW67TSZV3SSS2HXMBQ5JFGCKJNXKZM7UQUWUZPUTHXSTZLEO7SJMI75";
      const factory = "CAUIKL3IYGMERDRUN6YSCLWVAKIFG5Q4YJHUKM4S4NJZQIA3BAS6OJPK";
      const templateHash = "ab".repeat(32);
      const fetch = vi.fn(async (input: string) => {
        const url = new URL(input, "http://localhost");
        if (url.pathname === "/api/assets/core-registry") return Response.json({ items: [] });
        if (url.pathname === "/api/mainnet-connector/profile") return Response.json({
          profile: { network: "Public Global Stellar Network ; September 2015", factory, router: factory, templateHash },
          defaultDraft: { factoryId: factory, routerId: factory, templateHash,
            denominationContract: denomination, whitelistContracts: [denomination, other] },
        });
        throw new Error("Unexpected test request");
      });
      vi.stubGlobal("fetch", fetch);
      const { default: ManagedCreation } = await import("@/app/factory/create/CreateArkaClient");
      render(<ManagedCreation />);
      const selector = await screen.findByTestId("create-arka-denomination-select");
      expect(selector).toHaveValue(denomination);
      expect(selector).toBeDisabled();
      expect(screen.getByTestId(`create-arka-whitelist-option-${other}`)).toBeDisabled();
      expect(fetch.mock.calls.every(([url]) => !url.startsWith("/api/catalog/v1/assets"))).toBe(true);
    } finally {
      vi.unstubAllEnvs();
    }
  });

  it("prefills Create Arka denomination and allowed assets from registry route params", async () => {
    const user = userEvent.setup();
    window.history.replaceState(
      {},
      "",
      "/factory/create?denomination=BLND&asset=XTAR",
    );
    const fetchMock = vi
      .spyOn(global, "fetch")
      .mockImplementation(async (input) => {
        const url = typeof input === "string" ? input : input.toString();

        if (url.startsWith("/api/catalog/v1/assets")) {
          const parsed = new URL(url, "http://localhost");
          const body = creationCatalogFixture(parsed.searchParams);
          return new Response(JSON.stringify(body), {
            status: 200,
            headers: { "content-type": "application/json" },
          });
        }

        if (url === "/api/assets/core-registry") {
          return new Response(
            JSON.stringify({
              generatedAt: "2026-04-25T18:00:00.000Z",
              items: [
                {
                  id: "xtar",
                  label: "Dogstar",
                  symbol: "XTAR",
                  kind: "classic",
                  description: "Dogstar token",
                  homeDomain: "dogstarcoin.com",
                  classicCode: "XTAR",
                  classicIssuer:
                    "GAORYJ3KBDGIM7FFSKVUJHJ5NEFWIRDIAGGBJBJS7TY6ECZS53257IG4",
                  metadataContract:
                    "CDCKFBZYF2AQCSM3JOF2ZM27O3Y6AJAI4OTCQKAFNZ3FHBYUTFOKICIY",
                  selectableContract:
                    "CDCKFBZYF2AQCSM3JOF2ZM27O3Y6AJAI4OTCQKAFNZ3FHBYUTFOKICIY",
                  iconUrl: "/assets/core/xtar.png",
                  fallbackIconUrl: "/assets/core/xtar.png",
                  iconSource: "registry_png",
                  lookupKeys: [
                    "xtar",
                    "CDCKFBZYF2AQCSM3JOF2ZM27O3Y6AJAI4OTCQKAFNZ3FHBYUTFOKICIY",
                  ],
                },
                {
                  id: "blnd",
                  label: "Blend",
                  symbol: "BLND",
                  kind: "classic",
                  description: "Blend governance token",
                  homeDomain: null,
                  classicCode: "BLND",
                  classicIssuer:
                    "GDJEHTBE6ZHUXSWFI642DCGLUOECLHPF3KSXHPXTSTJ7E3JF6MQ5EZYY",
                  metadataContract:
                    "CD25MNVTZDL4Y3XBCPCJXGXATV5WUHHOWMYFF4YBEGU5FCPGMYTVG5JY",
                  selectableContract:
                    "CD25MNVTZDL4Y3XBCPCJXGXATV5WUHHOWMYFF4YBEGU5FCPGMYTVG5JY",
                  iconUrl: "/assets/core/blnd.png",
                  fallbackIconUrl: "/assets/core/blnd.png",
                  iconSource: "registry_png",
                  lookupKeys: [
                    "blnd",
                    "CD25MNVTZDL4Y3XBCPCJXGXATV5WUHHOWMYFF4YBEGU5FCPGMYTVG5JY",
                  ],
                },
              ],
            }),
            { status: 200, headers: { "content-type": "application/json" } },
          );
        }

        throw new Error(`Unexpected fetch ${url}`);
      });

    render(<CreateArkaClient />);

    await waitFor(() =>
      expect(
        screen.getByTestId("create-arka-prefill-notice"),
      ).toHaveTextContent("Route prefill applied"),
    );

    expect(screen.getByTestId("create-arka-prefill-notice")).toHaveTextContent(
      "BLND",
    );
    expect(screen.getByTestId("create-arka-prefill-notice")).toHaveTextContent(
      "XTAR",
    );
    expect(screen.getByTestId("create-arka-description")).toHaveAccessibleName(
      /short summary/i,
    );
    expect(screen.getByTestId("create-arka-description")).toHaveAttribute(
      "placeholder",
      expect.stringMatching(/concise introduction.*listings.*profile headers/i),
    );
    expect(screen.getByTestId("create-manager-description")).toHaveAccessibleName(
      /manager profile/i,
    );
    await user.click(screen.getByText(/Strategy, risks & manager profile/));
    await user.type(
      screen.getByTestId("create-manager-description"),
      "Momentum process with clear risk limits.",
    );
    expect(screen.getByTestId("create-manager-description")).toHaveValue(
      "Momentum process with clear risk limits.",
    );
    expect(screen.getByTestId("create-arka-denom-summary")).toHaveTextContent(
      "BLND",
    );
    expect(
      screen.getByTestId("create-arka-whitelist-summary"),
    ).toHaveTextContent("XTAR");
    expect(screen.getByTestId("create-arka-asset-search")).toHaveValue("XTAR");
    expect(screen.getByTestId("create-arka-denomination-select")).toHaveValue(
      "CD25MNVTZDL4Y3XBCPCJXGXATV5WUHHOWMYFF4YBEGU5FCPGMYTVG5JY",
    );
    expect(
      screen.getByTestId(
        "create-arka-whitelist-option-CDCKFBZYF2AQCSM3JOF2ZM27O3Y6AJAI4OTCQKAFNZ3FHBYUTFOKICIY",
      ),
    ).toHaveTextContent("XTAR");

    await user.click(screen.getByTestId("create-arka-clear-asset-search"));

    expect(screen.getByTestId("create-arka-asset-search")).toHaveValue("");
    expect(screen.getByRole("option", { name: "BLND" })).toBeInTheDocument();

    await user.click(
      screen.getByTestId(
        "create-arka-whitelist-option-CDCKFBZYF2AQCSM3JOF2ZM27O3Y6AJAI4OTCQKAFNZ3FHBYUTFOKICIY",
      ),
    );

    expect(
      screen.getByTestId("create-arka-whitelist-summary"),
    ).not.toHaveTextContent("XTAR");

    fetchMock.mockRestore();
  });

  it("restores Create Arka wizard step and execution intent from the URL", async () => {
    const user = userEvent.setup();
    window.history.replaceState(
      {},
      "",
      "/factory/create?denomination=BLND&asset=XTAR&step=assets-management&intent=blend",
    );
    const fetchMock = vi
      .spyOn(global, "fetch")
      .mockImplementation(async (input) => {
        const url = typeof input === "string" ? input : input.toString();

        if (url.startsWith("/api/catalog/v1/assets")) {
          const parsed = new URL(url, "http://localhost");
          const body = creationCatalogFixture(parsed.searchParams);
          return new Response(JSON.stringify(body), {
            status: 200,
            headers: { "content-type": "application/json" },
          });
        }

        if (url === "/api/assets/core-registry") {
          return new Response(
            JSON.stringify({
              generatedAt: "2026-04-25T18:00:00.000Z",
              items: [
                {
                  id: "xtar",
                  label: "Dogstar",
                  symbol: "XTAR",
                  kind: "classic",
                  description: "Dogstar token",
                  homeDomain: "dogstarcoin.com",
                  classicCode: "XTAR",
                  classicIssuer:
                    "GAORYJ3KBDGIM7FFSKVUJHJ5NEFWIRDIAGGBJBJS7TY6ECZS53257IG4",
                  metadataContract:
                    "CDCKFBZYF2AQCSM3JOF2ZM27O3Y6AJAI4OTCQKAFNZ3FHBYUTFOKICIY",
                  selectableContract:
                    "CDCKFBZYF2AQCSM3JOF2ZM27O3Y6AJAI4OTCQKAFNZ3FHBYUTFOKICIY",
                  iconUrl: "/assets/core/xtar.png",
                  fallbackIconUrl: "/assets/core/xtar.png",
                  iconSource: "registry_png",
                  lookupKeys: [
                    "xtar",
                    "CDCKFBZYF2AQCSM3JOF2ZM27O3Y6AJAI4OTCQKAFNZ3FHBYUTFOKICIY",
                  ],
                },
                {
                  id: "blnd",
                  label: "Blend",
                  symbol: "BLND",
                  kind: "classic",
                  description: "Blend governance token",
                  homeDomain: null,
                  classicCode: "BLND",
                  classicIssuer:
                    "GDJEHTBE6ZHUXSWFI642DCGLUOECLHPF3KSXHPXTSTJ7E3JF6MQ5EZYY",
                  metadataContract:
                    "CD25MNVTZDL4Y3XBCPCJXGXATV5WUHHOWMYFF4YBEGU5FCPGMYTVG5JY",
                  selectableContract:
                    "CD25MNVTZDL4Y3XBCPCJXGXATV5WUHHOWMYFF4YBEGU5FCPGMYTVG5JY",
                  iconUrl: "/assets/core/blnd.png",
                  fallbackIconUrl: "/assets/core/blnd.png",
                  iconSource: "registry_png",
                  lookupKeys: [
                    "blnd",
                    "CD25MNVTZDL4Y3XBCPCJXGXATV5WUHHOWMYFF4YBEGU5FCPGMYTVG5JY",
                  ],
                },
              ],
            }),
            { status: 200, headers: { "content-type": "application/json" } },
          );
        }

        throw new Error(`Unexpected fetch ${url}`);
      });

    render(<CreateArkaClient />);

    await waitFor(() =>
      expect(screen.getByTestId("create-assets-management-panel")).toBeVisible(),
    );

    expect(screen.getByTestId("create-step-state-assets")).toHaveTextContent(
      "Current",
    );
    expect(screen.getByTestId("create-arka-setup-intent")).toHaveValue("BLEND");
    expect(screen.getByTestId("create-assets-management-panel")).toHaveTextContent(
      "Open after creation: Blend",
    );
    expect(window.location.search).toContain("step=assets");
    expect(window.location.search).toContain("intent=blend");

    await user.click(screen.getByTestId("create-step-review"));

    expect(screen.getByTestId("create-review-panel")).toBeVisible();
    expect(screen.getByTestId("create-arka-review-card")).toHaveTextContent(
      "Open after creation: Blend",
    );
    expect(screen.getByTestId("create-arka-submit-button")).toBeEnabled();
    expect(window.location.search).toContain("step=review");
    expect(window.location.search).toContain("intent=blend");

    fetchMock.mockRestore();
  });

  it("blocks Create Arka submission when fee inputs are invalid", async () => {
    const user = userEvent.setup();
    const fetchMock = vi
      .spyOn(global, "fetch")
      .mockImplementation(async (input) => {
        const url = typeof input === "string" ? input : input.toString();

        if (url.startsWith("/api/catalog/v1/assets")) {
          const parsed = new URL(url, "http://localhost");
          const body = creationCatalogFixture(parsed.searchParams);
          return new Response(JSON.stringify(body), {
            status: 200,
            headers: { "content-type": "application/json" },
          });
        }

        if (url === "/api/assets/core-registry") {
          return new Response(
            JSON.stringify({
              generatedAt: "2026-04-25T18:00:00.000Z",
              items: [],
            }),
            { status: 200, headers: { "content-type": "application/json" } },
          );
        }

        throw new Error(`Unexpected fetch ${url}`);
      });

    render(<CreateArkaClient />);

    await waitFor(() =>
      expect(screen.getByTestId("create-page-heading")).toBeVisible(),
    );

    await user.click(screen.getByTestId("create-step-fees"));
    await user.clear(screen.getByTestId("create-arka-mgmt-input"));
    await user.type(screen.getByTestId("create-arka-mgmt-input"), "101");

    expect(screen.getByTestId("create-fees-panel")).toHaveTextContent(
      "Management fee cannot exceed 100%.",
    );
    expect(screen.getByTestId("create-progress-summary")).toHaveTextContent("Step 3 of 5");
    expect(screen.getByTestId("create-stepper-progress")).toHaveTextContent(
      "Management fee cannot exceed 100%.",
    );
    expect(screen.getByTestId("create-step-fees")).toHaveAttribute(
      "title",
      "Management fee cannot exceed 100%.",
    );

    await user.click(screen.getByTestId("create-step-review"));

    expect(screen.getByTestId("create-arka-submit-button")).toBeDisabled();
    expect(screen.getByTestId("create-submit-blocker")).toHaveTextContent(
      "Management fee cannot exceed 100%.",
    );

    fetchMock.mockRestore();
  });

  it("syncs Create Arka wallet disconnect and reconnect events without stale signer state", async () => {
    const reconnectedWallet =
      "GCRECONNECT7RTH9KLMNOPQ2UVWX3YZ56789ABCDEFGHJKLMNPRSTUV";
    window.history.replaceState({}, "", "/factory/create?step=review");
    const fetchMock = vi
      .spyOn(global, "fetch")
      .mockImplementation(async (input) => {
        const url = typeof input === "string" ? input : input.toString();

        if (url.startsWith("/api/catalog/v1/assets")) {
          const parsed = new URL(url, "http://localhost");
          const body = creationCatalogFixture(parsed.searchParams);
          return new Response(JSON.stringify(body), {
            status: 200,
            headers: { "content-type": "application/json" },
          });
        }

        if (url === "/api/assets/core-registry") {
          return new Response(
            JSON.stringify({
              generatedAt: "2026-04-25T18:00:00.000Z",
              items: [],
            }),
            { status: 200, headers: { "content-type": "application/json" } },
          );
        }

        throw new Error(`Unexpected fetch ${url}`);
      });

    render(<CreateArkaClient />);

    await waitFor(() =>
      expect(screen.getByTestId("create-review-panel")).toBeVisible(),
    );
    expect(screen.getByTestId("create-arka-submit-button")).toBeEnabled();

    window.localStorage.removeItem("wallet:pubkey");
    window.dispatchEvent(
      new CustomEvent("wallet:pubkey-changed", { detail: "" }),
    );

    await waitFor(() =>
      expect(screen.getByTestId("create-arka-submit-button")).toBeDisabled(),
    );
    expect(screen.getByTestId("create-submit-blocker")).toHaveTextContent(
      /wallet/i,
    );

    window.localStorage.setItem("wallet:pubkey", reconnectedWallet);
    window.dispatchEvent(
      new CustomEvent("wallet:pubkey-changed", { detail: reconnectedWallet }),
    );

    await waitFor(() =>
      expect(screen.getByTestId("create-arka-submit-button")).toBeEnabled(),
    );
    expect(screen.queryByTestId("create-submit-blocker")).not.toBeInTheDocument();

    fetchMock.mockRestore();
  });

  it("recovers Create Arka wallet button when the wallet modal is closed", async () => {
    const user = userEvent.setup();
    window.history.replaceState({}, "", "/factory/create?step=start");
    window.localStorage.removeItem("wallet:pubkey");
    walletMocks.connectWallet.mockRejectedValueOnce(
      new Error("Wallet selection was closed"),
    );

    const fetchMock = vi
      .spyOn(global, "fetch")
      .mockImplementation(async (input) => {
        const url = typeof input === "string" ? input : input.toString();

        if (url.startsWith("/api/catalog/v1/assets")) {
          const parsed = new URL(url, "http://localhost");
          const body = creationCatalogFixture(parsed.searchParams);
          return new Response(JSON.stringify(body), {
            status: 200,
            headers: { "content-type": "application/json" },
          });
        }

        if (url === "/api/assets/core-registry") {
          return new Response(
            JSON.stringify({
              generatedAt: "2026-04-25T18:00:00.000Z",
              items: [],
            }),
            { status: 200, headers: { "content-type": "application/json" } },
          );
        }

        throw new Error(`Unexpected fetch ${url}`);
      });

    render(<CreateArkaClient />);

    await waitFor(() =>
      expect(screen.getByTestId("create-start-panel")).toBeVisible(),
    );
    await user.click(screen.getByTestId("create-wallet-connect-button"));

    await waitFor(() =>
      expect(screen.getByTestId("create-wallet-connect-button")).toHaveTextContent(
        /Connect wallet|Reconnect wallet/,
      ),
    );
    expect(screen.getByTestId("create-wallet-connect-button")).toBeEnabled();
    expect(walletMocks.connectFreighterDirect).not.toHaveBeenCalled();

    fetchMock.mockRestore();
  });

  it("creates an Arka and exposes profile plus execution entrypoints", async () => {
    const user = userEvent.setup();
    sorobanMocks.readTokenAllowance
      .mockResolvedValueOnce(0)
      .mockResolvedValue(5_000_000);
    const fetchMock = vi
      .spyOn(global, "fetch")
      .mockImplementation(async (input, init) => {
        const url = typeof input === "string" ? input : input.toString();
        if (url === "https://rpc.invalid") {
          const body = JSON.parse(String(init?.body ?? "{}")) as {
            method?: string;
          };
          if (body.method === "sendTransaction") {
            return new Response(
              JSON.stringify({
                jsonrpc: "2.0",
                id: 1,
                result: { hash: "rpc-hash-123" },
              }),
              { status: 200, headers: { "content-type": "application/json" } },
            );
          }
          if (body.method === "getTransaction") {
            return new Response(
              JSON.stringify({
                jsonrpc: "2.0",
                id: 1,
                result: { status: "SUCCESS" },
              }),
              { status: 200, headers: { "content-type": "application/json" } },
            );
          }
        }

        if (url === "/api/factory/create/build") {
          return new Response(
            JSON.stringify({
              xdrB64: "create-xdr",
              predictedAddress:
                "CNEWARKA7RTH9KLMNOPQ2UVWX3YZ56789ABCDEFGHJKLMNPRSTUV",
            }),
            { status: 200, headers: { "content-type": "application/json" } },
          );
        }

        if (url.startsWith("/api/catalog/v1/assets")) {
          const parsed = new URL(url, "http://localhost");
          const body = creationCatalogFixture(parsed.searchParams);
          return new Response(JSON.stringify(body), {
            status: 200,
            headers: { "content-type": "application/json" },
          });
        }
        if (url === "/api/assets/core-registry") {
          return new Response(
            JSON.stringify({
              generatedAt: "2026-04-25T18:00:00.000Z",
              items: [
                {
                  id: "xlm",
                  label: "Stellar Lumens",
                  symbol: "XLM",
                  kind: "native",
                  description: "Native Stellar asset",
                  homeDomain: null,
                  classicCode: "XLM",
                  classicIssuer: null,
                  metadataContract:
                    "CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC",
                  selectableContract:
                    "CAS3J7GYLGXMF6TDJBBYYSE3HQ6BBSMLNUQ34T6TZMYMW2EVH34XOWMA",
                  iconUrl: "/assets/core/xlm.png",
                  fallbackIconUrl: "/assets/core/xlm.png",
                  iconSource: "registry_png",
                  tomlState: "not_applicable",
                  tomlUrl: null,
                  iconProvenanceLabel: "native registry icon",
                  lookupKeys: [
                    "xlm",
                    "CAS3J7GYLGXMF6TDJBBYYSE3HQ6BBSMLNUQ34T6TZMYMW2EVH34XOWMA",
                  ],
                },
                {
                  id: "usdc",
                  label: "USD Coin",
                  symbol: "USDC",
                  kind: "classic",
                  description: "Circle-issued dollar stablecoin",
                  homeDomain: "circle.com",
                  classicCode: "USDC",
                  classicIssuer:
                    "GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN",
                  metadataContract:
                    "CCW67TSZV3SSS2HXMBQ5JFGCKJNXKZM7UQUWUZPUTHXSTZLEO7SJMI75",
                  selectableContract:
                    "CCW67TSZV3SSS2HXMBQ5JFGCKJNXKZM7UQUWUZPUTHXSTZLEO7SJMI75",
                  iconUrl: "https://cdn.circle.com/usdc.png",
                  fallbackIconUrl: "/assets/core/usdc.png",
                  iconSource: "stellar_toml",
                  tomlState: "resolved",
                  tomlUrl: "https://circle.com/.well-known/stellar.toml",
                  iconProvenanceLabel: "stellar.toml verified",
                  lookupKeys: [
                    "usdc",
                    "CCW67TSZV3SSS2HXMBQ5JFGCKJNXKZM7UQUWUZPUTHXSTZLEO7SJMI75",
                    "CDTKPWPLOURQA2SGTKTUQOWRCBZEORB4BWBOMJ3D3ZTQQSGE5F6JBQLV",
                  ],
                },
                {
                  id: "aqua",
                  label: "Aqua",
                  symbol: "AQUA",
                  kind: "classic",
                  description: "Aquarius ecosystem token",
                  homeDomain: "aqua.network",
                  classicCode: "AQUA",
                  classicIssuer:
                    "GBNZILSTVQZ4R7IKQDGHYGY2QXL5QOFJYQMXPKWRRM5PAV7Y4M67AQUA",
                  metadataContract:
                    "CAUIKL3IYGMERDRUN6YSCLWVAKIFG5Q4YJHUKM4S4NJZQIA3BAS6OJPK",
                  selectableContract:
                    "CAUIKL3IYGMERDRUN6YSCLWVAKIFG5Q4YJHUKM4S4NJZQIA3BAS6OJPK",
                  iconUrl: "https://cdn.aqua.network/aqua.png",
                  fallbackIconUrl: "/assets/core/aqua.png",
                  iconSource: "stellar_toml",
                  tomlState: "resolved",
                  tomlUrl: "https://aqua.network/.well-known/stellar.toml",
                  iconProvenanceLabel: "stellar.toml verified",
                  lookupKeys: [
                    "aqua",
                    "CAUIKL3IYGMERDRUN6YSCLWVAKIFG5Q4YJHUKM4S4NJZQIA3BAS6OJPK",
                  ],
                },
                {
                  id: "xtar",
                  label: "Dogstar",
                  symbol: "XTAR",
                  kind: "classic",
                  description: "Dogstar token",
                  homeDomain: "dogstarcoin.com",
                  classicCode: "XTAR",
                  classicIssuer:
                    "GAORYJ3KBDGIM7FFSKVUJHJ5NEFWIRDIAGGBJBJS7TY6ECZS53257IG4",
                  metadataContract:
                    "CDCKFBZYF2AQCSM3JOF2ZM27O3Y6AJAI4OTCQKAFNZ3FHBYUTFOKICIY",
                  selectableContract:
                    "CDCKFBZYF2AQCSM3JOF2ZM27O3Y6AJAI4OTCQKAFNZ3FHBYUTFOKICIY",
                  iconUrl: "https://cdn.dogstarcoin.com/xtar.png",
                  fallbackIconUrl: "/assets/core/xtar.png",
                  iconSource: "stellar_toml",
                  tomlState: "resolved",
                  tomlUrl: "https://dogstarcoin.com/.well-known/stellar.toml",
                  iconProvenanceLabel: "stellar.toml verified",
                  lookupKeys: ["xtar"],
                },
                {
                  id: "blnd",
                  label: "Blend",
                  symbol: "BLND",
                  kind: "classic",
                  description: "Blend governance token",
                  homeDomain: null,
                  classicCode: "BLND",
                  classicIssuer:
                    "GDJEHTBE6ZHUXSWFI642DCGLUOECLHPF3KSXHPXTSTJ7E3JF6MQ5EZYY",
                  metadataContract:
                    "CD25MNVTZDL4Y3XBCPCJXGXATV5WUHHOWMYFF4YBEGU5FCPGMYTVG5JY",
                  selectableContract:
                    "CD25MNVTZDL4Y3XBCPCJXGXATV5WUHHOWMYFF4YBEGU5FCPGMYTVG5JY",
                  iconUrl: "/assets/core/blnd.png",
                  fallbackIconUrl: "/assets/core/blnd.png",
                  iconSource: "registry_png",
                  tomlState: "missing_home_domain",
                  tomlUrl: null,
                  iconProvenanceLabel: "registry icon; no home domain",
                  lookupKeys: [
                    "blnd",
                    "CD25MNVTZDL4Y3XBCPCJXGXATV5WUHHOWMYFF4YBEGU5FCPGMYTVG5JY",
                  ],
                },
              ],
            }),
            { status: 200, headers: { "content-type": "application/json" } },
          );
        }

        throw new Error(`Unexpected fetch ${url}`);
      });

    render(<CreateArkaClient />);

    await waitFor(() =>
      expect(
        screen.getByRole("heading", {
          name: /create your arka/i,
        }),
      ).toBeInTheDocument(),
    );

    await waitFor(() =>
      expect(screen.getByRole("option", { name: /^USDC · CCW67/ })).toBeInTheDocument(),
    );
    for (const contract of [
      "CAS3J7GYLGXMF6TDJBBYYSE3HQ6BBSMLNUQ34T6TZMYMW2EVH34XOWMA",
      "CCW67TSZV3SSS2HXMBQ5JFGCKJNXKZM7UQUWUZPUTHXSTZLEO7SJMI75",
      "CAUIKL3IYGMERDRUN6YSCLWVAKIFG5Q4YJHUKM4S4NJZQIA3BAS6OJPK",
      "CDCKFBZYF2AQCSM3JOF2ZM27O3Y6AJAI4OTCQKAFNZ3FHBYUTFOKICIY",
      "CD25MNVTZDL4Y3XBCPCJXGXATV5WUHHOWMYFF4YBEGU5FCPGMYTVG5JY",
    ]) {
      expect(
        screen.getByTestId(`create-arka-whitelist-option-${contract}`),
      ).toBeInTheDocument();
    }
    expect(
      screen.getByTestId(
        "create-arka-whitelist-option-CCW67TSZV3SSS2HXMBQ5JFGCKJNXKZM7UQUWUZPUTHXSTZLEO7SJMI75",
      ),
    ).toHaveAttribute("data-icon-source", "stellar_toml");
    expect(
      screen.getByTestId(
        "create-arka-whitelist-option-CD25MNVTZDL4Y3XBCPCJXGXATV5WUHHOWMYFF4YBEGU5FCPGMYTVG5JY",
      ),
    ).toHaveAttribute("data-toml-state", "missing_home_domain");
    await user.selectOptions(
      screen.getByTestId("create-arka-denomination-select"),
      "CCW67TSZV3SSS2HXMBQ5JFGCKJNXKZM7UQUWUZPUTHXSTZLEO7SJMI75",
    );
    await user.click(
      screen.getByTestId(
        "create-arka-whitelist-option-CD25MNVTZDL4Y3XBCPCJXGXATV5WUHHOWMYFF4YBEGU5FCPGMYTVG5JY",
      ),
    );
    expect(screen.getByTestId("create-arka-denom-summary")).toHaveTextContent(
      "USDC",
    );
    expect(
      screen.getByTestId("create-arka-whitelist-summary"),
    ).toHaveTextContent("BLND");

    await user.click(screen.getByTestId("create-step-assets"));
    await user.selectOptions(
      screen.getByTestId("create-arka-setup-intent"),
      "BLEND",
    );
    expect(
      screen.getByTestId("create-assets-management-panel"),
    ).toHaveTextContent("Open after creation: Blend");

    await user.click(screen.getByTestId("create-step-review"));
    await user.click(screen.getByTestId("create-arka-submit-button"));
    await user.click(screen.getByTestId("create-arka-confirm-button"));

    await waitFor(() =>
      expect(screen.getByTestId("create-arka-result")).toHaveTextContent(
        "Created Arka",
      ),
    );

    expect(screen.getByTestId("create-review-panel")).toHaveTextContent(
      "Create Arka",
    );
    expect(screen.getByTestId("create-actions-table")).toHaveTextContent(
      "Create Arka",
    );
    expect(screen.getByTestId("create-review-panel")).toHaveTextContent(
      "Ready to create",
    );
    expect(sorobanMocks.readTokenAllowance).toHaveBeenCalledWith(
      "CFEE7TOKEN",
      shared.walletAddress,
      expect.any(String),
      shared.walletAddress,
    );
    expect(sorobanMocks.buildTokenApprove).toHaveBeenCalledWith(
      shared.walletAddress,
      "CFEE7TOKEN",
      expect.any(String),
      5_000_000,
    );
    expect(screen.getByTestId("create-stepper-rail")).toHaveTextContent(
      "Creation flow",
    );
    expect(screen.getByTestId("create-arka-review-card")).toHaveTextContent(
      "USDC",
    );
    expect(screen.getByTestId("create-arka-review-card")).toHaveTextContent(
      "allowed",
    );
    expect(screen.getByTestId("create-stepper-rail")).not.toHaveTextContent(
      "not configured yet",
    );
    expect(screen.getByTestId("create-step-basics")).toHaveTextContent(
      "Basics",
    );
    expect(screen.getByTestId("create-step-assets")).toHaveTextContent(
      "After creation",
    );
    expect(screen.getByTestId("create-step-state-review")).toHaveTextContent(
      "Current",
    );
    expect(screen.getByTestId("create-arka-created-id")).toHaveTextContent(
      "CNEWARKA",
    );
    expect(screen.getByTestId("create-arka-profile-link")).toHaveAttribute(
      "href",
      "/vaults/CNEWARKA7RTH9KLMNOPQ2UVWX3YZ56789ABCDEFGHJKLMNPRSTUV",
    );
    expect(screen.getByTestId("create-arka-open-link")).toHaveAttribute(
      "href",
      "/arkas/CNEWARKA7RTH9KLMNOPQ2UVWX3YZ56789ABCDEFGHJKLMNPRSTUV",
    );

    fetchMock.mockRestore();
  });
});
