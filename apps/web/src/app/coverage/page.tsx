"use client";

import type { StellarWalletsKit } from "@creit.tech/stellar-wallets-kit";
import { useEffect, useMemo, useRef, useState } from "react";
import { assertFinancialActionsEnabled, UX_REVIEW_PREVIEW } from "@/lib/previewSafety";
import {
  ActionField,
  Panel,
  StatusPill,
  TransactionFeedbackRail,
} from "@/components/product/surfacePrimitives";
import { formatBpsAsPercent } from "@/lib/catalog/format";
import { COVERAGE_FUND, COVERAGE_TOKEN, COVERAGE_VAULT } from "@/lib/config";
import { resolveAssetDisplayLabel } from "@/lib/catalog/assetPresentation";
import {
  buildCoverageFundClaim,
  buildCoverageFundStake,
  buildCoverageFundUnstake,
  buildTokenApprove,
  readCoverageFundMetrics,
  readCoverageFundPendingRewards,
  readCoverageFundStakeOf,
  readCoverageVaultBalance,
  readCoverageVaultMaxWithdrawable,
  readTokenAllowance,
  readCoverageWalletBalance,
  type CoverageFundMetrics,
} from "@/lib/soroban";
import { submitSignedTx, waitForTx, signXdr } from "@/lib/tx";
import {
  connectWallet,
  getWalletsKit,
} from "@/lib/walletKit";
import {
  deriveCoverageSummary,
  formatCoverageAmount,
  formatWalletStatus,
} from "@/lib/workflows/productFlows";
import {
  COVERAGE_WORKSPACE_TABS,
  resolveCoverageWorkspaceId,
  type CoverageWorkspaceId,
} from "@/lib/workflows/coverageWorkspaces";

const DECIMALS = 7;

function toBaseUnits(input: string): number {
  const n = Number((input || "0").replace(",", "."));
  if (!Number.isFinite(n) || n <= 0) return 0;
  const base = Math.floor(n * 10 ** DECIMALS);
  return Number.isSafeInteger(base) ? base : 0;
}

export default function CoveragePage() {
  const [walletsKit, setWalletsKit] = useState<StellarWalletsKit | null>(null);
  const [pubKey, setPubKey] = useState("");
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [readState, setReadState] = useState<"loading" | "ready" | "error">("loading");
  const [managerReadState, setManagerReadState] = useState<"loading" | "ready" | "error" | "unconfigured">(COVERAGE_VAULT ? "loading" : "unconfigured");
  const [communityMetrics, setCommunityMetrics] = useState<CoverageFundMetrics | null>(null);
  const readVersion = useRef(0);
  const [activeWorkspace, setActiveWorkspace] =
    useState<CoverageWorkspaceId>("state");

  useEffect(() => {
    setActiveWorkspace((current) =>
      resolveCoverageWorkspaceId(
        new URLSearchParams(window.location.search).get("workspace"),
        current,
      ),
    );
  }, []);

  const [stakeAmount, setStakeAmount] = useState("1");
  const [unstakeAmount, setUnstakeAmount] = useState("1");

  const [vaultBalance, setVaultBalance] = useState(0);
  const [vaultMaxWithdrawable, setVaultMaxWithdrawable] = useState(0);
  const [fundStake, setFundStake] = useState(0);
  const [fundPending, setFundPending] = useState(0);
  const [fundReservePending, setFundReservePending] = useState(0);
  const [walletTokenBalance, setWalletTokenBalance] = useState(0);
  const reserveToken = communityMetrics?.reserve_token || "";
  const reserveLabel = reserveToken ? resolveAssetDisplayLabel(reserveToken) : "reserve token";
  const bootstrapLabel = communityMetrics?.bootstrap_token ? resolveAssetDisplayLabel(communityMetrics.bootstrap_token) : "bootstrap token";
  const reserveAmount = (amount: number) => `${formatCoverageAmount(amount)} ${reserveLabel}`;

  const canAct = useMemo(
    () => Boolean(!UX_REVIEW_PREVIEW && pubKey && walletsKit && !loading && readState === "ready"),
    [pubKey, walletsKit, loading, readState],
  );
  const coverageSummary = useMemo(
    () =>
      deriveCoverageSummary({
        vaultBalance,
        vaultMaxWithdrawable,
        fundStake,
        fundPending,
        walletTokenBalance,
      }),
    [
      fundPending,
      fundStake,
      vaultBalance,
      vaultMaxWithdrawable,
      walletTokenBalance,
    ],
  );
  const walletLabel = useMemo(() => formatWalletStatus(pubKey), [pubKey]);
  const canStake = canAct && Boolean(communityMetrics?.claims_manager);

  useEffect(() => {
    setWalletsKit(getWalletsKit(["FREIGHTER", "ALBEDO", "XBULL"]));
    const saved = localStorage.getItem("wallet:pubkey");
    if (saved) setPubKey(saved);
  }, []);

  useEffect(() => {
    const hydrateFromStorage = () => {
      try {
        const saved = localStorage.getItem("wallet:pubkey");
        if ((saved || "") !== pubKey) {
          setPubKey(saved || "");
        }
      } catch {}
    };

    const onWalletChanged = (event: Event) => {
      const detail = (event as CustomEvent<string>).detail;
      if (detail && detail !== pubKey) {
        setPubKey(detail);
      } else {
        hydrateFromStorage();
      }
    };

    const onStorage = (event: StorageEvent) => {
      if (event.key === "wallet:pubkey") {
        hydrateFromStorage();
      }
    };

    hydrateFromStorage();
    window.addEventListener(
      "wallet:pubkey-changed",
      onWalletChanged as EventListener,
    );
    window.addEventListener("storage", onStorage);
    const intervalId = window.setInterval(hydrateFromStorage, 500);
    return () => {
      window.removeEventListener(
        "wallet:pubkey-changed",
        onWalletChanged as EventListener,
      );
      window.removeEventListener("storage", onStorage);
      window.clearInterval(intervalId);
    };
  }, [pubKey]);

  const refresh = async (reader?: string): Promise<void> => {
    const version = ++readVersion.current;
    setReadState("loading");
    setManagerReadState(COVERAGE_VAULT ? "loading" : "unconfigured");
    setError("");
    // A manager-specific reserve is independent of the community fund. Its
    // absence must not hide a working community read or fabricate a zero.
    const owner = reader || pubKey;
    const r = owner || undefined;
    if (COVERAGE_VAULT) void Promise.all([
      readCoverageVaultBalance(COVERAGE_VAULT, r),
      readCoverageVaultMaxWithdrawable(COVERAGE_VAULT, r),
    ]).then(([vb, vm]) => {
      if (version !== readVersion.current) return;
      setVaultBalance(vb); setVaultMaxWithdrawable(vm); setManagerReadState("ready");
    }).catch(() => { if (version === readVersion.current) setManagerReadState("error"); });
    try {
      const metrics = await readCoverageFundMetrics(COVERAGE_FUND, r);
      if (version !== readVersion.current) return;
      if (COVERAGE_TOKEN && COVERAGE_TOKEN !== metrics.reserve_token) throw new Error("Coverage reserve asset does not match configuration.");
      setCommunityMetrics(metrics);
      if (owner) {
        const [stake, pending, walletBal] = await Promise.all([
          readCoverageFundStakeOf(COVERAGE_FUND, owner, r),
          readCoverageFundPendingRewards(COVERAGE_FUND, owner, r),
          readCoverageWalletBalance(metrics.reserve_token, owner, r),
        ]);
        if (version !== readVersion.current) return;
        setFundStake(stake);
        setFundPending(pending.bootstrap_reward);
        setFundReservePending(pending.reserve_reward);
        setWalletTokenBalance(walletBal);
      }
      setReadState("ready");
    } catch {
      if (version !== readVersion.current) return;
      setReadState("error");
      setError("Coverage balances could not be checked. Please refresh before taking an action.");
    }
  };

  useEffect(() => {
    const generation = readVersion;
    void refresh();
    return () => { generation.current++; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pubKey]);

  const connect = async (): Promise<void> => {
    try {
      setError("");
      if (!walletsKit) throw new Error("Wallets Kit not initialized");
      const key = await connectWallet(walletsKit);
      setPubKey(key);
      localStorage.setItem("wallet:pubkey", key);
      await refresh(key);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to connect");
    }
  };

  const execTx = async (
    xdrB64: string,
    pendingMessage: string,
  ): Promise<void> => {
    if (!walletsKit) throw new Error("Wallet not connected");
    assertFinancialActionsEnabled();
    const signed = await signXdr(walletsKit, xdrB64);
    setStatus(pendingMessage);
    const hash = await submitSignedTx(signed);
    await waitForTx(hash);
    setStatus(`Success: ${hash}`);
  };

  const waitForRequiredAllowance = async (
    tokenId: string,
    owner: string,
    spender: string,
    requiredAmount: number,
  ): Promise<void> => {
    for (let attempt = 0; attempt < 6; attempt += 1) {
      const allowance = await readTokenAllowance(tokenId, owner, spender, owner);
      if (allowance >= requiredAmount) return;
      await new Promise((resolve) => setTimeout(resolve, 1200 + attempt * 600));
    }
    throw new Error(
      "Token approval is not confirmed yet. Wait a few seconds and try again.",
    );
  };

  const onStake = async (): Promise<void> => {
    try {
      if (!canStake) return;
      setLoading(true);
      setError("");
      const amount = toBaseUnits(stakeAmount);
      if (amount <= 0) throw new Error("Invalid amount");
      const liveMetrics = await readCoverageFundMetrics(COVERAGE_FUND, pubKey);
      if (!liveMetrics.claims_manager || liveMetrics.reserve_token !== reserveToken) throw new Error("Coverage setup or reserve asset changed. Refresh before contributing.");
      const allowance = await readTokenAllowance(
        reserveToken,
        pubKey,
        COVERAGE_FUND,
        pubKey,
      );
      if (allowance < amount) {
        const approve = await buildTokenApprove(
          pubKey,
          reserveToken,
          COVERAGE_FUND,
          amount,
        );
        await execTx(approve, "Approving token allowance...");
        setStatus("Confirming token allowance...");
        await waitForRequiredAllowance(
          reserveToken,
          pubKey,
          COVERAGE_FUND,
          amount,
        );
      }
      const stakeTx = await buildCoverageFundStake(
        pubKey,
        COVERAGE_FUND,
        amount,
      );
      await execTx(stakeTx, "Submitting stake...");
      await refresh(pubKey);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Stake failed");
      setStatus("");
    } finally {
      setLoading(false);
    }
  };

  const onUnstake = async (): Promise<void> => {
    try {
      if (!canAct) return;
      setLoading(true);
      setError("");
      const amount = toBaseUnits(unstakeAmount);
      if (amount <= 0) throw new Error("Invalid amount");
      const unstakeTx = await buildCoverageFundUnstake(
        pubKey,
        COVERAGE_FUND,
        amount,
      );
      await execTx(unstakeTx, "Submitting unstake...");
      await refresh(pubKey);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unstake failed");
      setStatus("");
    } finally {
      setLoading(false);
    }
  };

  const onClaim = async (): Promise<void> => {
    try {
      if (!canAct) return;
      setLoading(true);
      setError("");
      const claimTx = await buildCoverageFundClaim(pubKey, COVERAGE_FUND);
      await execTx(claimTx, "Submitting claim...");
      await refresh(pubKey);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Claim failed");
      setStatus("");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="surface-stack control-room-fidelity-shell coverage-fidelity-shell">
      <header className="surface-stage-header">
        <span className="surface-eyebrow">Coverage</span>
        <h1 className="surface-title">Coverage reserve</h1>
        <p className="surface-description">
          View the coverage reserve and your contribution. Coverage is limited by funded reserves, eligibility and claim rules; it is not a guarantee against loss.
        </p>
      </header>
      <p className="surface-note" role="status" data-testid="coverage-read-status">{readState === "loading" ? "Checking community coverage balances…" : readState === "error" ? "Community coverage balances are unavailable. Do not interpret missing data as zero or guaranteed protection." : "Community reserve balances checked. Rewards depend on funding and are not guaranteed."}{UX_REVIEW_PREVIEW ? " Review only: staking, withdrawals and claims are disabled in this preview." : ""}</p>
      {readState === "ready" && !communityMetrics?.claims_manager ? <p className="ops-alert ops-alert-warning" role="status" data-testid="coverage-setup-warning">Community coverage setup is incomplete: no claims manager is linked. New contributions are paused. An existing balance would not prove that a specific fund is covered.</p> : null}

      <nav
        className="surface-section-tabs coverage-section-tabs coverage-workspace-tabs"
        aria-label="Coverage sections"
        data-testid="coverage-workspace-tabs"
      >
        {COVERAGE_WORKSPACE_TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            className={`surface-tab ${activeWorkspace === tab.id ? "surface-tab-active" : ""}`}
            aria-pressed={activeWorkspace === tab.id}
            aria-controls={`coverage-workspace-panel-${tab.id}`}
            data-testid={`coverage-workspace-tab-${tab.id}`}
            onClick={() => setActiveWorkspace(tab.id)}
          >
            <span>{tab.label}</span>
          </button>
        ))}
      </nav>

      {activeWorkspace === "state" ? (
        <Panel
          id="coverage-workspace-panel-state"
          title="Reserve overview"
          subtitle="Community capital and a separate manager reserve. Neither proves coverage for a specific fund."
          testId="coverage-overview-panel"
        >
          <div className="workflow-signal-grid control-room-signal-grid" data-testid="coverage-community-summary">
            {([
              ["Community reserve", communityMetrics?.reserve_capital, "coverage-community-capital", "Recorded community capital, not a guaranteed payout."],
              ["Staked capital", communityMetrics?.total_staked, "coverage-community-staked", "Contributions may be used to pay eligible claims."],
              ["Retained premiums", communityMetrics?.retained_reserve, "coverage-community-retained", "Premium capital retained by the community fund."],
            ] as const).map(([label, amount, testId, detail]) => (
              <article className="surface-signal-card workflow-signal-card" key={testId}>
                <span className="workflow-signal-label">{label}</span>
                <strong className="workflow-signal-value" data-testid={testId}>{readState === "ready" && amount !== undefined ? reserveAmount(amount) : readState === "loading" ? "Checking…" : "Unavailable"}</strong>
                <span className="workflow-signal-detail">{detail}</span>
              </article>
            ))}
          </div>
          <h3 className="surface-entry-title">Manager reserve</h3>
          <p className="surface-note" data-testid="coverage-manager-status">{managerReadState === "unconfigured" ? "No manager-specific reserve is selected for this network. This is not a zero balance and does not affect the community read above." : managerReadState === "error" ? "The selected manager reserve could not be checked. Its balance is unknown." : "The selected manager reserve is separate from the community fund. Eligibility for each Arka must be verified separately."}</p>
          <div className="workflow-signal-grid control-room-signal-grid">
            <article className="surface-signal-card workflow-signal-card">
              <span className="workflow-signal-label">Manager reserve balance</span>
              <strong
                className="workflow-signal-value"
                data-testid="coverage-vault-balance-card"
              >
                {managerReadState === "ready" ? formatCoverageAmount(vaultBalance) : managerReadState === "loading" ? "Checking…" : managerReadState === "unconfigured" ? "Not selected" : "Unavailable"}
              </strong>
              <span className="workflow-signal-detail">
                Recorded reserve balance. Coverage for a specific fund must be checked separately.
              </span>
            </article>
            <article className="surface-signal-card workflow-signal-card">
              <span className="workflow-signal-label">Manager withdrawable</span>
              <strong
                className="workflow-signal-value"
                data-testid="coverage-vault-withdrawable-card"
              >
                {managerReadState === "ready" ? formatCoverageAmount(vaultMaxWithdrawable) : managerReadState === "loading" ? "Checking…" : managerReadState === "unconfigured" ? "Not selected" : "Unavailable"}
              </strong>
              <span className="workflow-signal-detail">
                Amount the manager may withdraw under its reserve lock policy; not investor cash.
              </span>
            </article>
            <article className="surface-signal-card workflow-signal-card">
              <span className="workflow-signal-label">Manager reserve locked</span>
              <strong className="workflow-signal-value">
                {managerReadState === "ready" ? formatBpsAsPercent(coverageSummary.utilizationBps) : "Not verified"}
              </strong>
              <span className="workflow-signal-detail">
                Claims use the manager reserve before the community reserve.
              </span>
            </article>
          </div>
          <div className="ops-action-row">
            <button
              type="button"
              onClick={() => void refresh()}
              className="surface-button surface-button-secondary"
            >
              Refresh
            </button>
          </div>
        </Panel>
      ) : null}

      {activeWorkspace === "member" ? (
        <Panel
          id="coverage-workspace-panel-member"
          title="My contribution"
          subtitle="Your contribution and rewards, not an insurance policy for your investments"
          testId="coverage-member-panel"
        >
          <div className="workflow-signal-grid control-room-signal-grid">
            <article className="surface-signal-card workflow-signal-card">
              <span className="workflow-signal-label">Available</span>
              <strong
                className="workflow-signal-value"
                data-testid="coverage-wallet-balance"
                data-base-units={walletTokenBalance}
              >
                {!pubKey ? "Connect wallet" : readState === "ready" ? reserveAmount(walletTokenBalance) : "Not verified"}
              </strong>
              <span className="workflow-signal-detail">In your wallet.</span>
            </article>
            <article className="surface-signal-card workflow-signal-card">
              <span className="workflow-signal-label">Staked</span>
              <strong
                className="workflow-signal-value"
                data-testid="coverage-staked"
                data-base-units={fundStake}
              >
                {!pubKey ? "Connect wallet" : readState === "ready" ? reserveAmount(fundStake) : "Not verified"}
              </strong>
              <span className="workflow-signal-detail">
                Contributing to the coverage reserve.
              </span>
            </article>
            <article className="surface-signal-card workflow-signal-card">
              <span className="workflow-signal-label">Bootstrap rewards</span>
              <strong
                className="workflow-signal-value"
                data-testid="coverage-pending"
                data-base-units={fundPending}
              >
                {!pubKey ? "Connect wallet" : readState === "ready" ? `${formatCoverageAmount(fundPending)} ${bootstrapLabel}` : "Not verified"}
              </strong>
              <span className="workflow-signal-detail">Available to claim.</span>
            </article>
          </div>
          <p className="surface-note" data-testid="coverage-reserve-rewards">Reserve rewards: {!pubKey ? "Connect wallet" : readState === "ready" ? reserveAmount(fundReservePending) : "Not verified"}. Different reward assets are shown separately, never added together.</p>
          <div className="surface-entry-card">
            <div className="surface-entry-head">
              <div>
                <div className="surface-table-hint">Wallet</div>
                <strong
                  className="surface-entry-title ops-mono"
                  data-testid="coverage-wallet-address"
                  data-pubkey={pubKey || undefined}
                >
                  {walletLabel}
                </strong>
              </div>
              <StatusPill
                label={pubKey ? "Connected" : "Not connected"}
                tone={pubKey ? "positive" : "warning"}
              />
            </div>
            {!pubKey ? (
              <button
                type="button"
                onClick={connect}
                className="surface-button surface-button-primary"
              >
                Connect wallet
              </button>
            ) : null}
          </div>
        </Panel>
      ) : null}

      {activeWorkspace === "actions" ? (
        <Panel
          id="coverage-workspace-panel-actions"
          title="Manage coverage"
          subtitle="Stake, unstake or claim rewards"
          testId="coverage-actions-panel"
          className="coverage-command-frame coverage-actions-frame-cutover"
        >
          <div
            className="surface-grid coverage-action-stack coverage-command-grid"
            data-testid="coverage-command-grid"
          >
            <div className="surface-entry-card" data-testid="coverage-stake-panel">
              <div className="surface-entry-head">
                <div>
                  <div className="surface-entry-title">Stake</div>
                  <div className="surface-note">
                    Contribute {reserveLabel} to the community reserve. This is not an insurance policy for your investments.
                  </div>
                </div>
                <StatusPill
                  label={UX_REVIEW_PREVIEW ? "Preview · read only" : !pubKey ? "Connect wallet" : readState !== "ready" ? "Not verified" : !communityMetrics?.claims_manager ? "Setup incomplete" : canStake ? "Available" : "Please wait"}
                  tone={canStake ? "positive" : "warning"}
                />
              </div>
              <ActionField
                label="Amount"
                htmlFor="coverage-stake-input"
                hint="Enter the amount you want to stake."
                error={
                  toBaseUnits(stakeAmount) <= 0
                    ? "Enter an amount greater than zero."
                    : undefined
                }
              >
                <input
                  id="coverage-stake-input"
                  data-testid="coverage-stake-input"
                  value={stakeAmount}
                  onChange={(event) => setStakeAmount(event.target.value)}
                  className="ops-input"
                  placeholder="0.00"
                  inputMode="decimal"
                  aria-invalid={toBaseUnits(stakeAmount) <= 0}
                />
              </ActionField>
              <button
                type="button"
                data-testid="coverage-stake-button"
                onClick={onStake}
                disabled={!canStake || toBaseUnits(stakeAmount) <= 0}
                className="surface-button surface-button-primary disabled:cursor-not-allowed disabled:opacity-50"
              >
                Stake
              </button>
            </div>

            <div className="surface-entry-card">
              <div className="surface-entry-head">
                <div>
                  <div className="surface-entry-title">Unstake</div>
                  <div className="surface-note">
                    Return staked tokens to your wallet.
                  </div>
                </div>
              </div>
              <ActionField
                label="Amount"
                htmlFor="coverage-unstake-input"
                hint="Enter the amount you want to unstake."
                error={
                  toBaseUnits(unstakeAmount) <= 0
                    ? "Enter an amount greater than zero."
                    : undefined
                }
              >
                <input
                  id="coverage-unstake-input"
                  data-testid="coverage-unstake-input"
                  value={unstakeAmount}
                  onChange={(event) => setUnstakeAmount(event.target.value)}
                  className="ops-input"
                  placeholder="0.00"
                  inputMode="decimal"
                  aria-invalid={toBaseUnits(unstakeAmount) <= 0}
                />
              </ActionField>
              <button
                type="button"
                data-testid="coverage-unstake-button"
                onClick={onUnstake}
                disabled={!canAct || toBaseUnits(unstakeAmount) <= 0}
                className="surface-button surface-button-primary disabled:cursor-not-allowed disabled:opacity-50"
              >
                Unstake
              </button>
            </div>

            <div className="surface-entry-card">
              <div className="surface-entry-head">
                <div>
                  <div className="surface-entry-title">Claim rewards</div>
                  <div className="surface-note">
                    {!pubKey ? "Connect a wallet to check claimable rewards." : readState === "ready" ? `Claim without unstaking. Reserve rewards: ${reserveAmount(fundReservePending)}. Bootstrap rewards: ${formatCoverageAmount(fundPending)} ${bootstrapLabel}.` : "Claimable rewards have not been verified. Refresh balances first."}
                  </div>
                </div>
              </div>
              <button
                type="button"
                data-testid="coverage-claim-button"
                onClick={onClaim}
                disabled={!canAct || (fundPending <= 0 && fundReservePending <= 0)}
                className="surface-button surface-button-secondary disabled:cursor-not-allowed disabled:opacity-50"
              >
                Claim rewards
              </button>
            </div>
          </div>

          <TransactionFeedbackRail
            loading={loading}
            loadingLabel="Waiting for confirmation..."
            status={status}
            error={error}
            statusTestId="coverage-status"
            errorTestId="coverage-error"
          />
        </Panel>
      ) : null}
    </main>
  );
}
