import { Account as OfflineAccount, StrKey as OfflineStrKey, TransactionBuilder as OfflineTransactionBuilder, Operation as OfflineOperation } from '@stellar/stellar-sdk';
const offlineXdr=()=>new OfflineTransactionBuilder(new OfflineAccount(OfflineStrKey.encodeEd25519PublicKey(new Uint8Array(32).fill(41)),"0"),{fee:"100",networkPassphrase:"Test SDF Network ; September 2015"}).addOperation(OfflineOperation.manageData({name:"boundary-fixture",value:"unsigned"})).setTimeout(0).build().toXDR();
import React from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const shared = vi.hoisted(() => {
  const walletAddress = "GCFLOW7RTH9KLMNOPQ2UVWX3YZ56789ABCDEFGHJKLMNPRSTUV4WX";
  const disconnectedKit = {
    getAddress: vi.fn(async () => ({ address: walletAddress })),
    signTransaction: vi.fn(async () => {
      throw new Error("Selected wallet provider disconnected");
    }),
  };

  return { walletAddress, disconnectedKit };
});

const sorobanMocks = vi.hoisted(() => ({
  buildContractInvokeRaw: vi.fn(async () => offlineXdr()),
  buildCoverageFundClaim: vi.fn(async () => offlineXdr()),
  buildCoverageFundStake: vi.fn(async () => offlineXdr()),
  buildCoverageFundUnstake: vi.fn(async () => offlineXdr()),
  buildGovernorClose: vi.fn(async () => offlineXdr()),
  buildGovernorExecute: vi.fn(async () => offlineXdr()),
  buildGovernorProposeCouncil: vi.fn(async () => offlineXdr()),
  buildGovernorProposeSnapshotSelf: vi.fn(async () => offlineXdr()),
  buildGovernorVote: vi.fn(async () => offlineXdr()),
  buildTokenApprove: vi.fn(async () => offlineXdr()),
  findLatestGovernorProposalIdByCreator: vi.fn(async () => 12),
  readCoverageFundPending: vi.fn(async () => 30_000_000),
  readCoverageFundPendingRewards: vi.fn(async () => ({ bootstrap_reward: 30_000_000, reserve_reward: 0 })),
  readCoverageFundMetrics: vi.fn(async () => ({ reserve_token: "CA33YVWPBWG6A7JPMMUEUUELUB3UPATI64K62RZFPGYCBJD5GFACOWGK", bootstrap_token: "CDCKFBZYF2AQCSM3JOF2ZM27O3Y6AJAI4OTCQKAFNZ3FHBYUTFOKICIY", claims_manager: "CBBTR7VED6ZZTK3Z2ZVOWUFSP574UQGO4C2JK6YUUBSH4FPJ2GB4VF5P", reserve_capital: 900_000_000, total_staked: 800_000_000, retained_reserve: 100_000_000, total_covered_nav: 0, total_premiums: 100_000_000 })),
  readCoverageWalletBalance: vi.fn(async () => 80_000_000),
  readCoverageFundStakeOf: vi.fn(async () => 120_000_000),
  readCoverageVaultBalance: vi.fn(async () => 500_000_000),
  readCoverageVaultMaxWithdrawable: vi.fn(async () => 100_000_000),
  readFactoryCreationFeeAmount: vi.fn(async () => 5_000_000),
  readFactoryCreationFeeToken: vi.fn(async () => "CFEE7TOKEN"),
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
  readTokenAllowance: vi.fn(async () => 0),
  readTokenBalance: vi.fn(async () => 80_000_000),
  scValBytesN32: vi.fn(() => ({ bytes: "00" }) as unknown),
  scValToNative: vi.fn(() => ({ ok: true })),
  simulateContractReadonly: vi.fn(async () => null),
}));

const txMocks = vi.hoisted(() => ({
  submitSignedTx: vi.fn(async () => "tx-hash-123"),
  waitForTx: vi.fn(async () => undefined),
}));

const walletMocks = vi.hoisted(() => ({
  getWalletsKit: vi.fn(() => shared.disconnectedKit),
  connectWallet: vi.fn(async () => shared.walletAddress),
  connectFreighterDirect: vi.fn(async () => shared.walletAddress),
  persistWalletPubkey: vi.fn(),
  isWalletSelectionClosedError: vi.fn(
    (event: unknown) => event instanceof Error && event.message === "Wallet selection was closed",
  ),
}));

const freighterMocks = vi.hoisted(() => ({
  signTransaction: vi.fn(async () => {
    throw new Error("Freighter not available");
  }),
}));

vi.mock("@stellar/freighter-api", () => ({
  signTransaction: freighterMocks.signTransaction,
}));

vi.mock("@/lib/soroban", () => ({
  RPC_URL: "https://rpc.invalid",
  TESTNET: "Test SDF Network ; September 2015",
  buildContractInvokeRaw: sorobanMocks.buildContractInvokeRaw,
  buildCoverageFundClaim: sorobanMocks.buildCoverageFundClaim,
  buildCoverageFundStake: sorobanMocks.buildCoverageFundStake,
  buildCoverageFundUnstake: sorobanMocks.buildCoverageFundUnstake,
  buildGovernorClose: sorobanMocks.buildGovernorClose,
  buildGovernorExecute: sorobanMocks.buildGovernorExecute,
  buildGovernorProposeCouncil: sorobanMocks.buildGovernorProposeCouncil,
  buildGovernorProposeSnapshotSelf: sorobanMocks.buildGovernorProposeSnapshotSelf,
  buildGovernorVote: sorobanMocks.buildGovernorVote,
  buildTokenApprove: sorobanMocks.buildTokenApprove,
  findLatestGovernorProposalIdByCreator: sorobanMocks.findLatestGovernorProposalIdByCreator,
  readCoverageFundPending: sorobanMocks.readCoverageFundPending,
  readCoverageFundPendingRewards: sorobanMocks.readCoverageFundPendingRewards,
  readCoverageFundMetrics: sorobanMocks.readCoverageFundMetrics,
  readCoverageWalletBalance: sorobanMocks.readCoverageWalletBalance,
  readCoverageFundStakeOf: sorobanMocks.readCoverageFundStakeOf,
  readCoverageVaultBalance: sorobanMocks.readCoverageVaultBalance,
  readCoverageVaultMaxWithdrawable: sorobanMocks.readCoverageVaultMaxWithdrawable,
  readFactoryCreationFeeAmount: sorobanMocks.readFactoryCreationFeeAmount,
  readFactoryCreationFeeToken: sorobanMocks.readFactoryCreationFeeToken,
  readGovernorProposal: sorobanMocks.readGovernorProposal,
  readGovernorProposalVotes: sorobanMocks.readGovernorProposalVotes,
  readGovernorSettings: sorobanMocks.readGovernorSettings,
  readGovernorVote: sorobanMocks.readGovernorVote,
  readTokenAllowance: sorobanMocks.readTokenAllowance,
  readTokenBalance: sorobanMocks.readTokenBalance,
  scValBytesN32: sorobanMocks.scValBytesN32,
  scValToNative: sorobanMocks.scValToNative,
  simulateContractReadonly: sorobanMocks.simulateContractReadonly,
}));

vi.mock("@/lib/tx", async () => {
  const actual = await vi.importActual<typeof import("@/lib/tx")>("@/lib/tx");
  return {
    ...actual,
    submitSignedTx: txMocks.submitSignedTx,
    waitForTx: txMocks.waitForTx,
  };
});

vi.mock("@/lib/walletKit", () => ({
  getWalletsKit: walletMocks.getWalletsKit,
  connectWallet: walletMocks.connectWallet,
  connectFreighterDirect: walletMocks.connectFreighterDirect,
  persistWalletPubkey: walletMocks.persistWalletPubkey,
  isWalletSelectionClosedError: walletMocks.isWalletSelectionClosedError,
}));

import ContractsPage from "@/app/contracts/page";
import CoveragePage from "@/app/coverage/page";
import GovernancePage from "@/app/governance/page";
import {
  WALLET_WRITE_LANES,
  validateWalletProviderRejectionMatrix,
} from "@/lib/workflows/walletProviderRejectionMatrix";

const VALID_ADDRESS = "CAZPR5MIUHXH46ZJ5OAMRZXD7PXIHMF5HHSSKQPDUBEXVID5SAGSZ3HW";
const PROVIDER_DISCONNECT_ERROR =
  /wallet signature unavailable: selected wallet provider disconnected/i;

async function runRawWrite(user: ReturnType<typeof userEvent.setup>): Promise<void> {
  await user.click(screen.getByTestId("contracts-raw-write-button"));
  const confirmButton = screen.queryByTestId("contracts-confirm-button");
  if (confirmButton) {
    await user.click(confirmButton);
  }
}

describe("wallet provider disconnect surfaces", () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  beforeEach(() => {
    vi.clearAllMocks();
    shared.disconnectedKit.getAddress.mockResolvedValue({
      address: shared.walletAddress,
    });
    shared.disconnectedKit.signTransaction.mockRejectedValue(
      new Error("Selected wallet provider disconnected"),
    );
    freighterMocks.signTransaction.mockRejectedValue(
      new Error("Freighter not available"),
    );
    txMocks.submitSignedTx.mockResolvedValue("tx-hash-123");
    txMocks.waitForTx.mockResolvedValue(undefined);
    window.history.replaceState({}, "", "/");
    window.localStorage.clear();
    window.localStorage.setItem("wallet:pubkey", shared.walletAddress);
  });

  it("keeps the canonical rejection matrix aligned with routed write handlers", () => {
    const validation = validateWalletProviderRejectionMatrix();
    expect(validation.summary).toMatchObject({
      lanes: 7,
      scenarios: 5,
      cases: 35,
      failClosedCases: 35,
    });

    expect(WALLET_WRITE_LANES.map((lane) => lane.id)).toEqual([
      "create",
      "deposit",
      "redeem",
      "rebalance",
      "coverage",
      "governance",
      "contracts",
    ]);
    expect(
      WALLET_WRITE_LANES.filter((lane) => lane.role === "holder").map(
        (lane) => lane.id,
      ),
    ).toEqual(["create", "deposit", "redeem", "coverage"]);
    expect(
      WALLET_WRITE_LANES.filter((lane) => lane.role === "manager").map(
        (lane) => lane.id,
      ),
    ).toEqual(["rebalance", "governance"]);
    expect(
      WALLET_WRITE_LANES.find((lane) => lane.id === "contracts")?.role,
    ).toBe("operator");
  });

  it("renders Coverage member balances as user units instead of internal base-unit copy", async () => {
    const user = userEvent.setup();
    render(<CoveragePage />);

    await waitFor(() =>
      expect(screen.getByRole("heading", { name: /coverage reserve/i })).toBeInTheDocument(),
    );
    await user.click(screen.getByTestId("coverage-workspace-tab-member"));

    await waitFor(() =>
      expect(screen.getByTestId("coverage-wallet-balance")).toHaveTextContent(
        "8",
      ),
    );
    expect(screen.getByTestId("coverage-staked")).toHaveTextContent(
      "12",
    );
    expect(screen.getByTestId("coverage-pending")).toHaveTextContent(
      "3",
    );
    expect(document.body).not.toHaveTextContent(/base units/i);
  });

  it("keeps Coverage staking fail-closed when the selected provider disconnects", async () => {
    const user = userEvent.setup();
    render(<CoveragePage />);

    await waitFor(() =>
      expect(screen.getByRole("heading", { name: /coverage reserve/i })).toBeInTheDocument(),
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
        PROVIDER_DISCONNECT_ERROR,
      ),
    );
    expect(sorobanMocks.buildTokenApprove).toHaveBeenCalledWith(
      shared.walletAddress,
      expect.any(String),
      expect.any(String),
      2_500_000,
    );
    expect(shared.disconnectedKit.signTransaction).toHaveBeenCalledWith(
      offlineXdr(),
      { networkPassphrase: expect.any(String), submit: false },
    );
    expect(freighterMocks.signTransaction).not.toHaveBeenCalled();
    expect(txMocks.submitSignedTx).not.toHaveBeenCalled();
    expect(txMocks.waitForTx).not.toHaveBeenCalled();

    await user.click(screen.getByTestId("coverage-stake-button"));
    await waitFor(() =>
      expect(shared.disconnectedKit.signTransaction).toHaveBeenCalledTimes(2),
    );
    expect(freighterMocks.signTransaction).not.toHaveBeenCalled();
    expect(txMocks.submitSignedTx).not.toHaveBeenCalled();
  });

  it("keeps Governance voting fail-closed when the selected provider disconnects", async () => {
    const user = userEvent.setup();
    render(<GovernancePage />);

    await waitFor(() =>
      expect(screen.getByRole("heading", { name: /governance/i })).toBeInTheDocument(),
    );
    await waitFor(() =>
      expect(screen.getByTestId("governance-vote-button")).toBeEnabled(),
    );

    await user.click(screen.getByTestId("governance-vote-button"));
    await waitFor(() =>
      expect(screen.getByTestId("governance-confirm-button")).toBeVisible(),
    );
    await user.click(screen.getByTestId("governance-confirm-button"));

    await waitFor(() =>
      expect(screen.getByText(PROVIDER_DISCONNECT_ERROR)).toBeInTheDocument(),
    );
    expect(sorobanMocks.buildGovernorVote).toHaveBeenCalledWith(
      shared.walletAddress,
      expect.any(String),
      0,
      1,
    );
    expect(shared.disconnectedKit.signTransaction).toHaveBeenCalledWith(
      offlineXdr(),
      { networkPassphrase: expect.any(String), submit: false },
    );
    expect(freighterMocks.signTransaction).not.toHaveBeenCalled();
    expect(txMocks.submitSignedTx).not.toHaveBeenCalled();
    expect(txMocks.waitForTx).not.toHaveBeenCalled();
  });

  it("keeps Contracts raw writes fail-closed when provider disconnect leaves no signer", async () => {
    const user = userEvent.setup();
    window.history.replaceState({}, "", "/contracts");
    render(<ContractsPage />);

    await waitFor(() => {
      expect(screen.getByText("Connected")).toBeInTheDocument();
    });

    fireEvent.change(screen.getByTestId("contracts-raw-contract-input"), {
      target: { value: VALID_ADDRESS },
    });
    fireEvent.change(screen.getByTestId("contracts-raw-method-input"), {
      target: { value: "config" },
    });
    fireEvent.change(screen.getByTestId("contracts-raw-args-input"), {
      target: { value: "[]" },
    });

    await runRawWrite(user);

    await waitFor(() =>
      expect(screen.getByTestId("contracts-raw-error")).toHaveTextContent(
        PROVIDER_DISCONNECT_ERROR,
      ),
    );
    expect(sorobanMocks.buildContractInvokeRaw).toHaveBeenCalledWith(
      shared.walletAddress,
      VALID_ADDRESS,
      "config",
      [],
    );
    expect(shared.disconnectedKit.signTransaction).toHaveBeenCalledWith(
      offlineXdr(),
      { networkPassphrase: expect.any(String), submit: false },
    );
    expect(freighterMocks.signTransaction).not.toHaveBeenCalled();
    expect(txMocks.submitSignedTx).not.toHaveBeenCalled();
    expect(txMocks.waitForTx).not.toHaveBeenCalled();
  });
});
