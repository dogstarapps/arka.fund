import type {
  GovernorProposal,
  GovernorProposalVotes,
  GovernorSettings,
} from "@/lib/soroban";
import type { LeaderboardDataSourceSnapshot } from "@/lib/catalog/types";
import { deriveOracleCutoverGate } from "@/lib/runtime/oracleCutoverGate";

export type SetupIntent = "REBALANCE" | "BLEND";
export type SurfaceStatusTone = "neutral" | "positive" | "warning" | "critical";
export type ProtocolSupportStatus = "ready" | "blocked" | "inactive";
export interface WorkflowSignalCard {
  id: string;
  label: string;
  value: string;
  detail: string;
  tone?: SurfaceStatusTone;
}

export interface GovernanceSummary {
  totalVotes: number;
  proposalState: string;
  walletState: string;
  timelock: number | null;
  hasExecutableProposal: boolean;
}

export interface GovernanceStageMetric {
  id: string;
  label: string;
  value: string;
  detail: string;
  tone?: SurfaceStatusTone;
}

export interface IntegrationHealth {
  matched: boolean;
  label: string;
  tone: SurfaceStatusTone;
}

export interface IntegrationShowcaseCard {
  id: string;
  eyebrow: string;
  title: string;
  detail: string;
  statusLabel: string;
  statusTone: SurfaceStatusTone;
}

export interface BalancedLaneState {
  ready: boolean;
  value: string;
  detail: string;
  tone: SurfaceStatusTone;
}

export interface MainnetOracleGateState {
  targetNetwork: "testnet" | "mainnet";
  ready: boolean;
  value: string;
  detail: string;
  tone: SurfaceStatusTone;
}

export interface CreateFlowStep {
  id: string;
  label: string;
  detail: string;
  state: "done" | "current" | "pending";
}

export function formatCoverageAmount(baseUnits: number, decimals = 7): string {
  const value = baseUnits / 10 ** decimals;
  if (!Number.isFinite(value)) return "0";

  const maximumFractionDigits = Math.abs(value) >= 1 ? 2 : decimals;
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits,
    useGrouping: true,
  }).format(value);
}

export function deriveCoverageSummary(input: {
  vaultBalance: number;
  vaultMaxWithdrawable: number;
  fundStake: number;
  fundPending: number;
  walletTokenBalance: number;
}) {
  const utilizationBps =
    input.vaultBalance > 0
      ? Math.round(
          ((input.vaultBalance - input.vaultMaxWithdrawable) / input.vaultBalance) * 10_000,
        )
      : 0;
  const hasHeadroom = input.vaultMaxWithdrawable > 0;
  const userPosition = input.fundStake + input.fundPending;

  return {
    utilizationBps: Number.isFinite(utilizationBps) ? Math.max(0, utilizationBps) : 0,
    hasHeadroom,
    userPosition,
    idleWalletBalance: input.walletTokenBalance,
  };
}

export function deriveCoverageCommandSignals(input: {
  pubKey: string;
  walletLabel: string;
  stakeAmount: string;
  unstakeAmount: string;
  pendingRewards: number;
  summary: ReturnType<typeof deriveCoverageSummary>;
}): WorkflowSignalCard[] {
  return [
    {
      id: "wallet",
      label: "Wallet",
      value: input.pubKey ? input.walletLabel : "Offline",
      detail: input.pubKey
        ? "connected signer ready for stake, unstake and claim"
        : "connect a wallet before moving reserve capital",
      tone: input.pubKey ? "positive" : "warning",
    },
    {
      id: "stake-plan",
      label: "Stake / unstake plan",
      value: `${input.stakeAmount || "0"} / ${input.unstakeAmount || "0"}`,
      detail: "current coverage amounts prepared for wallet signature",
      tone: "neutral",
    },
    {
      id: "reward-lane",
      label: "Pending rewards",
      value: formatCoverageAmount(input.pendingRewards),
      detail:
        input.summary.userPosition > 0
          ? `${formatCoverageAmount(input.summary.userPosition)} tracked across stake and rewards`
          : "no active member exposure yet",
      tone: input.pendingRewards > 0 ? "positive" : "neutral",
    },
  ];
}

export function proposalStatusLabel(status: number): string {
  switch (status) {
    case 0:
      return "Open";
    case 1:
      return "Successful";
    case 2:
      return "Defeated";
    case 3:
      return "Expired";
    case 4:
      return "Executed";
    case 5:
      return "Canceled";
    default:
      return `Status ${status}`;
  }
}

export function supportLabel(support: number | null): string {
  if (support === null) return "No vote yet";
  if (support === 0) return "Against";
  if (support === 1) return "For";
  if (support === 2) return "Abstain";
  return `Support ${support}`;
}

export function deriveGovernanceSummary(input: {
  settings: GovernorSettings | null;
  proposal: GovernorProposal | null;
  votes: GovernorProposalVotes | null;
  voteState: number | null;
}): GovernanceSummary {
  const totalVotes =
    (input.votes?._for ?? 0) + (input.votes?.against ?? 0) + (input.votes?.abstain ?? 0);
  const proposalState = input.proposal ? proposalStatusLabel(input.proposal.status) : "No proposal selected";
  const walletState = supportLabel(input.voteState);
  const timelock = input.settings?.timelock ?? null;

  return {
    totalVotes,
    proposalState,
    walletState,
    timelock,
    hasExecutableProposal: Boolean(input.proposal?.executable),
  };
}

export function deriveGovernanceParticipationSignals(input: {
  pubKey: string;
  walletLabel: string;
  summary: GovernanceSummary;
  proposal: GovernorProposal | null;
}): WorkflowSignalCard[] {
  return [
    {
      id: "wallet",
      label: "Wallet",
      value: input.pubKey ? input.walletLabel : "Offline",
      detail: input.pubKey
        ? "connected signer ready for propose, vote and execute"
        : "connect a wallet before broadcasting governance actions",
      tone: input.pubKey ? "positive" : "warning",
    },
    {
      id: "vote-posture",
      label: "Vote posture",
      value: input.summary.walletState,
      detail: input.proposal
        ? `selected proposal ${input.proposal.id} currently in focus`
        : "no proposal selected yet",
      tone: "neutral",
    },
    {
      id: "execution-window",
      label: "Execution window",
      value: input.summary.hasExecutableProposal ? "Open" : "Pending",
      detail: input.summary.hasExecutableProposal
        ? "selected proposal can move into execution"
        : "proposal must clear close and timelock conditions first",
      tone: input.summary.hasExecutableProposal ? "positive" : "warning",
    },
  ];
}

export function deriveGovernanceStageMetrics(input: {
  summary: GovernanceSummary;
  proposal: GovernorProposal | null;
  votes: GovernorProposalVotes | null;
  walletLabel: string;
  pubKey: string;
}): GovernanceStageMetric[] {
  const totalProposals = input.proposal ? String(input.proposal.id + 1) : "0";
  return [
    {
      id: "proposals",
      label: "Total proposals",
      value: totalProposals,
      detail: input.proposal
        ? `${proposalStatusLabel(input.proposal.status)} proposal in focus`
        : "no proposal selected yet",
      tone: "neutral",
    },
    {
      id: "voting-power",
      label: "Voting power",
      value: `${input.summary.totalVotes}`,
      detail:
        input.summary.totalVotes > 0
          ? `${input.votes?._for ?? 0} for / ${input.votes?.against ?? 0} against`
          : "no tally indexed yet",
      tone: input.summary.totalVotes > 0 ? "positive" : "warning",
    },
    {
      id: "wallet",
      label: "Wallet",
      value: input.pubKey ? input.walletLabel : "Offline",
      detail: input.pubKey
        ? "connected signer ready for propose, vote and execute"
        : "connect a wallet before governance actions",
      tone: input.pubKey ? "positive" : "warning",
    },
  ];
}

export function deriveIntegrationHealth(
  expectedRouter: string,
  onchainRouter: string | null,
  options?: { supportStatus?: ProtocolSupportStatus },
): {
  matched: boolean;
  label: string;
  tone: SurfaceStatusTone;
} {
  if (options?.supportStatus === "inactive") {
    return {
      matched: false,
      label: "Inactive",
      tone: "neutral",
    };
  }

  if (options?.supportStatus === "blocked") {
    return {
      matched: false,
      label: "Pending",
      tone: "warning",
    };
  }

  if (!onchainRouter) {
    return {
      matched: false,
      label: "Unavailable",
      tone: "critical",
    };
  }

  if (expectedRouter === onchainRouter) {
    return {
      matched: true,
      label: "Healthy",
      tone: "positive",
    };
  }

  return {
    matched: false,
    label: "Mismatch",
    tone: "warning",
  };
}

export function deriveIntegrationRuntimeSignals(input: {
  pubKey: string;
  walletLabel: string;
  loadedRoutes: number;
  balancedLane: BalancedLaneState;
  blendAction: "Lend" | "Borrow" | "Repay" | "Liquidate";
  blendAmount: string;
  routes: IntegrationHealth[];
}): WorkflowSignalCard[] {
  const healthyRoutes = input.routes.filter((route) => route.matched).length;

  return [
    {
      id: "wallet",
      label: "Wallet",
      value: input.pubKey ? input.walletLabel : "Offline",
      detail: input.pubKey
        ? "ready to sign live protocol actions"
        : "connect a wallet before submitting live actions",
      tone: input.pubKey ? "positive" : "warning",
    },
    {
      id: "routes",
      label: "Protocol checks",
      value: `${healthyRoutes}/${input.routes.length}`,
      detail: healthyRoutes === input.routes.length
        ? "all supported integrations match configured routing"
        : "one or more protocols still need review",
      tone: healthyRoutes === input.routes.length ? "positive" : "warning",
    },
    {
      id: "balanced",
      label: "Balanced / SODAX",
      value: input.balancedLane.value,
      detail: input.balancedLane.detail,
      tone: input.balancedLane.tone,
    },
    {
      id: "blend",
      label: "Blend action",
      value: `${input.blendAction} ${input.blendAmount || "0"}`,
      detail: "current live credit action prepared",
      tone: "neutral",
    },
  ];
}

export function deriveMainnetOracleGateState(
  oracleSnapshot: LeaderboardDataSourceSnapshot | null | undefined,
): MainnetOracleGateState {
  const gate = deriveOracleCutoverGate(oracleSnapshot, {
    enforceMainnetOnly: true,
  });
  return {
    targetNetwork: gate.targetNetwork,
    ready: gate.ready,
    value:
      gate.status === "ready"
        ? "Ready"
        : gate.status === "not_required"
          ? "Not required"
          : gate.status === "unknown"
            ? "Unknown"
            : "Pending",
    detail: gate.detail,
    tone:
      gate.status === "ready"
        ? "positive"
        : gate.status === "not_required"
          ? "neutral"
          : "warning",
  };
}

export function deriveBalancedLaneState(input: {
  health: IntegrationHealth;
  pairConfigured: boolean;
  poolId: string;
  amount: string;
  minOut: string;
  supportStatus: ProtocolSupportStatus;
  laneMode: string;
}): BalancedLaneState {
  const value = `Pool ${input.poolId || "1"} · ${input.amount || "0"}`
  if (input.supportStatus === "inactive") {
    return {
      ready: false,
      value,
      detail:
        "Balanced/SODAX is pending publication for this environment.",
      tone: "warning",
    }
  }

  if (input.supportStatus === "blocked") {
    return {
      ready: false,
      value,
      detail:
        "Balanced/SODAX execution is blocked until production readiness is confirmed.",
      tone: "warning",
    }
  }

  if (!input.health.matched) {
    return {
      ready: false,
      value,
      detail: "Balanced/SODAX routing needs review before live actions.",
      tone: "warning",
    }
  }

  if (!input.pairConfigured) {
    return {
      ready: false,
      value,
      detail: `minimum out ${input.minOut || "0"} prepared, but pool activation is not configured on-chain yet`,
      tone: "warning",
    }
  }

  return {
    ready: true,
    value,
    detail: `minimum out ${input.minOut || "0"} prepared for the Balanced adapter surface`,
    tone: "positive",
  }
}

export function deriveIntegrationShowcaseCards(input: {
  pubKey: string;
  walletLabel: string;
  loadedRoutes: number;
  balanced: IntegrationHealth;
  aquarius: IntegrationHealth;
  phoenix?: IntegrationHealth; // legacy input; never a launch venue
  sushi?: IntegrationHealth;
  soroswap: IntegrationHealth;
  blend: IntegrationHealth;
}): IntegrationShowcaseCard[] {
  const supportedLaneCount = input.sushi ? 5 : 4;
  return [
    {
      id: "balanced",
      eyebrow: "AMM adapter",
      title: "Balanced",
      detail: "Direct adapter execution path for pool-based rebalancing checks.",
      statusLabel: input.balanced.label,
      statusTone: input.balanced.tone,
    },
    {
      id: "blend",
      eyebrow: "Credit protocol",
      title: "Blend",
      detail: "Live lending, borrowing and repayment workflow.",
      statusLabel: input.blend.label,
      statusTone: input.blend.tone,
    },
    {
      id: "soroswap",
      eyebrow: "Swap",
      title: "SoroSwap",
      detail: "Validated AMM execution path through the adapter surface.",
      statusLabel: input.soroswap.label,
      statusTone: input.soroswap.tone,
    },
    {
      id: "aquarius",
      eyebrow: "Swap",
      title: "Aquarius",
      detail: "Validated router-backed AMM path for vault execution.",
      statusLabel: input.aquarius.label,
      statusTone: input.aquarius.tone,
    },
    ...(input.sushi
      ? [
	          {
	            id: "sushi",
	            eyebrow: "Swap",
	            title: "Sushi",
	            detail: "Sushi Stellar V3 route for vault swaps.",
	            statusLabel: input.sushi.label,
	            statusTone: input.sushi.tone,
	          } satisfies IntegrationShowcaseCard,
        ]
      : []),
    {
      id: "wallet",
      eyebrow: "Signer",
      title: input.pubKey ? input.walletLabel : "Wallet",
      detail: input.pubKey
        ? "Connected signer available for live executions."
        : "Connect a wallet before live execution.",
      statusLabel: input.pubKey ? "Connected" : "Offline",
      statusTone: input.pubKey ? "positive" : "warning",
    },
    {
      id: "routing",
      eyebrow: "Route checks",
      title: "Swap routes",
      detail: `${input.loadedRoutes}/${supportedLaneCount} supported protocols available.`,
      statusLabel:
        input.loadedRoutes === supportedLaneCount ? "Loaded" : "Attention",
      statusTone:
        input.loadedRoutes === supportedLaneCount ? "positive" : "warning",
    },
    {
      id: "execution",
      eyebrow: "Execution",
      title: "Vault execution",
      detail: "Managers can execute swaps from the vault workspace.",
      statusLabel: "Live",
      statusTone: "positive",
    },
  ];
}

export function formatWalletStatus(pubKey: string): string {
  if (!pubKey) return "Offline";
  return `${pubKey.slice(0, 6)}...${pubKey.slice(-4)}`;
}

export function deriveCreateSummary(input: {
  pubKey: string;
  routerId: string;
  denominationInput: string;
  defaultDenomination: string;
  feeToken: string;
  feeAmount: number;
  whitelist: string[];
  setupIntent: SetupIntent;
  createdArkaId: string;
}) {
  const denomination = input.denominationInput.trim() || input.defaultDenomination;
  const hasWallet = input.pubKey.length > 0;
  const hasRouter = input.routerId.length > 0;
  const hasDenomination = denomination.length > 0;
  const feeRequired = input.feeToken.length > 0 && input.feeAmount > 0;
  const isReady = hasWallet && hasRouter && hasDenomination;

  const nextStep =
    input.setupIntent === "BLEND"
      ? "After creation, open the Arka detail page to manage the Blend vault position."
      : "After creation, open the Arka detail page to run allocation through AUTO, SoroSwap, Aquarius or Balanced.";

  return {
    denomination,
    hasWallet,
    hasRouter,
    hasDenomination,
    feeRequired,
    whitelistCount: input.whitelist.length,
    isReady,
    nextStep,
    createdArkaId: input.createdArkaId || null,
  };
}

export function deriveCreateCommandSignals(input: {
  walletLabel: string;
  summary: ReturnType<typeof deriveCreateSummary>;
  setupIntent: SetupIntent;
}): WorkflowSignalCard[] {
  return [
    {
      id: "wallet",
      label: "Wallet",
      value: input.summary.hasWallet ? input.walletLabel : "Offline",
      detail: input.summary.hasWallet
        ? "connected signer ready for the create transaction"
        : "connect a wallet before signing",
      tone: input.summary.hasWallet ? "positive" : "warning",
    },
    {
      id: "deployment",
      label: "Ready to create",
      value: input.summary.isReady ? "Ready to sign" : "Incomplete",
      detail: "wallet, denomination and router must all be present before create",
      tone: input.summary.isReady ? "positive" : "warning",
    },
    {
      id: "handoff",
      label: "Post-create actions",
      value: input.setupIntent === "BLEND" ? "Credit" : "Rebalance",
      detail: input.summary.nextStep,
      tone: "neutral",
    },
  ];
}

export function deriveCreateFlowSteps(input: {
  summary: ReturnType<typeof deriveCreateSummary>;
  setupIntent: SetupIntent;
}): CreateFlowStep[] {
  const startDone = input.summary.hasWallet;
  const basicsDone = input.summary.hasDenomination && input.summary.whitelistCount > 0;
  const feesDone = input.summary.hasDenomination;
  const policyDone = input.summary.hasDenomination;
  const assetsDone = input.summary.hasRouter && input.summary.whitelistCount > 0;
  const reviewDone = Boolean(input.summary.createdArkaId);

  return [
    {
      id: "start",
      label: "Before you start",
      detail: "wallet must be available before create",
      state: startDone ? "done" : "current",
    },
    {
      id: "basics",
      label: "Basics",
      detail: input.summary.hasDenomination ? "denomination and allowed assets configured" : "choose denomination and allowed assets",
      state: basicsDone ? "done" : "current",
    },
    {
      id: "fees",
      label: "Fees",
      detail: input.summary.feeRequired ? "creation fee and fee policy active" : "no one-time creation fee configured",
      state: feesDone ? "done" : "pending",
    },
    {
      id: "deposits",
      label: "Deposits",
      detail: "deposit fee is signed at create; wallet and amount limits use governed policy after launch",
      state: policyDone ? "done" : "pending",
    },
    {
      id: "redemptions",
      label: "Redemptions",
      detail: "redeem fee is signed at create; exit controls use governed policy after launch",
      state: policyDone ? "done" : "pending",
    },
    {
      id: "assets",
      label: "Assets management",
      detail:
        input.setupIntent === "BLEND"
          ? "initial assets are ready; Blend credit actions start after launch"
          : "initial assets are ready; routing actions start after launch",
      state: assetsDone ? "done" : "pending",
    },
    {
      id: "review",
      label: "Review",
      detail: reviewDone ? "profile and action links unlocked" : "create transaction still pending",
      state: reviewDone ? "done" : "pending",
    },
  ];
}

function normalizeFeePctLabel(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return "0%";
  const numeric = Number(trimmed);
  if (!Number.isFinite(numeric)) return `${trimmed}%`;
  return `${numeric.toFixed(numeric % 1 === 0 ? 0 : 2)}%`;
}

export function deriveCreatePolicyPostureSteps(input: {
  summary: ReturnType<typeof deriveCreateSummary>;
  depositFeePct: string;
  redeemFeePct: string;
  setupIntent: SetupIntent;
}): CreateFlowStep[] {
  const depositFeeLabel = normalizeFeePctLabel(input.depositFeePct);
  const redeemFeeLabel = normalizeFeePctLabel(input.redeemFeePct);
  const hasAssetUniverse = input.summary.whitelistCount > 0;

  return [
    {
      id: "policy",
      label: "Fee policy",
      detail: `Deposit ${depositFeeLabel} / redeem ${redeemFeeLabel}; factory mandate signs these values with the initial vault configuration.`,
      state: input.summary.hasDenomination ? "done" : "pending",
    },
    {
      id: "assets",
      label: "Asset universe",
      detail: hasAssetUniverse
        ? `${input.summary.whitelistCount} allowed asset${input.summary.whitelistCount === 1 ? "" : "s"} in the initial mandate; future changes use governed controls.`
        : "Choose at least the denomination before create.",
      state: hasAssetUniverse ? "done" : "current",
    },
    {
      id: "handoff",
      label: input.setupIntent === "BLEND" ? "Credit actions" : "Rebalance actions",
      detail:
        input.setupIntent === "BLEND"
          ? "Blend actions start from the created Arka page after launch."
          : "Configure supported routing from the created Arka page after launch.",
      state: input.summary.hasRouter ? "done" : "pending",
    },
  ];
}
