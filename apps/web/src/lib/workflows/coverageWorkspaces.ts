import { formatBpsAsPercent } from "@/lib/catalog/format";
import {
  formatCoverageAmount,
  type SurfaceStatusTone,
  type WorkflowSignalCard,
} from "./productFlows";

export type CoverageWorkspaceId = "state" | "member" | "actions";

export interface CoverageWorkspaceTab {
  id: CoverageWorkspaceId;
  label: string;
  eyebrow: string;
  description: string;
}

export interface CoverageWorkspaceSnapshot {
  vaultBalance: number;
  vaultMaxWithdrawable: number;
  fundStake: number;
  fundPending: number;
  walletTokenBalance: number;
  walletLabel: string;
  canAct: boolean;
  utilizationBps: number;
  hasHeadroom: boolean;
  userPosition: number;
  stakeAmount: string;
  unstakeAmount: string;
}

export interface CoverageWorkspaceState {
  tab: CoverageWorkspaceTab;
  signals: WorkflowSignalCard[];
}

export const COVERAGE_WORKSPACE_TABS: CoverageWorkspaceTab[] = [
  {
    id: "state",
    label: "Overview",
    eyebrow: "Coverage reserve",
    description:
      "Community and manager reserves. Eligibility for each Arka must be checked separately.",
  },
  {
    id: "member",
    label: "My contribution",
    eyebrow: "Your position",
    description:
      "Your available balance, staked amount and rewards.",
  },
  {
    id: "actions",
    label: "Manage",
    eyebrow: "Manage coverage",
    description:
      "Stake, unstake or claim rewards from your connected wallet.",
  },
];

const COVERAGE_WORKSPACE_TAB_MAP = new Map(
  COVERAGE_WORKSPACE_TABS.map((tab) => [tab.id, tab]),
);

export function resolveCoverageWorkspaceId(
  value: string | null | undefined,
  fallback: CoverageWorkspaceId = "state",
): CoverageWorkspaceId {
  return COVERAGE_WORKSPACE_TAB_MAP.has(value as CoverageWorkspaceId)
    ? (value as CoverageWorkspaceId)
    : fallback;
}

export function getCoverageWorkspaceTab(
  id: CoverageWorkspaceId,
): CoverageWorkspaceTab {
  return COVERAGE_WORKSPACE_TAB_MAP.get(id) ?? COVERAGE_WORKSPACE_TABS[0];
}

function signal(
  id: string,
  label: string,
  value: string,
  detail: string,
  tone: SurfaceStatusTone = "neutral",
): WorkflowSignalCard {
  return { id, label, value, detail, tone };
}

function buildStateSignals(
  snapshot: CoverageWorkspaceSnapshot,
): WorkflowSignalCard[] {
  return [
    signal(
      "reserve-balance",
      "Reserve balance",
      formatCoverageAmount(snapshot.vaultBalance),
      "Reserve currently protecting Arka positions.",
      snapshot.vaultBalance > 0 ? "positive" : "warning",
    ),
    signal(
      "withdrawable",
      "Available reserve",
      formatCoverageAmount(snapshot.vaultMaxWithdrawable),
      snapshot.hasHeadroom
        ? "Part of the reserve is currently available."
        : "The reserve is currently committed.",
      snapshot.hasHeadroom ? "positive" : "warning",
    ),
    signal(
      "utilization",
      "Utilization",
      formatBpsAsPercent(snapshot.utilizationBps),
      "Share of the reserve currently committed.",
      snapshot.utilizationBps > 8_500 ? "warning" : "neutral",
    ),
  ];
}

function buildMemberSignals(
  snapshot: CoverageWorkspaceSnapshot,
): WorkflowSignalCard[] {
  return [
    signal(
      "wallet",
      "Wallet",
      snapshot.walletLabel,
      snapshot.canAct
        ? "Your wallet is ready."
        : "Connect a wallet to stake, unstake or claim.",
      snapshot.canAct ? "positive" : "warning",
    ),
    signal(
      "delegated",
      "Delegated stake",
      formatCoverageAmount(snapshot.fundStake),
      `${formatCoverageAmount(snapshot.walletTokenBalance)} available in your wallet.`,
      snapshot.fundStake > 0 ? "positive" : "neutral",
    ),
    signal(
      "claimable",
      "Claimable rewards",
      formatCoverageAmount(snapshot.fundPending),
      `${formatCoverageAmount(snapshot.userPosition)} staked plus rewards.`,
      snapshot.fundPending > 0 ? "positive" : "neutral",
    ),
  ];
}

function buildActionSignals(
  snapshot: CoverageWorkspaceSnapshot,
): WorkflowSignalCard[] {
  const stakeUnits = Number(snapshot.stakeAmount || "0");
  const unstakeUnits = Number(snapshot.unstakeAmount || "0");
  return [
    signal(
      "wallet-readiness",
      "Wallet readiness",
      snapshot.canAct ? "Ready" : "Offline",
      snapshot.canAct
        ? "wallet signature is available for coverage actions"
        : "actions remain disabled until a wallet is connected",
      snapshot.canAct ? "positive" : "warning",
    ),
    signal(
      "stake-draft",
      "Stake draft",
      snapshot.stakeAmount || "0",
      stakeUnits > 0
        ? "positive stake amount prepared for validation"
        : "enter a positive stake amount before submitting",
      stakeUnits > 0 ? "neutral" : "warning",
    ),
    signal(
      "unstake-draft",
      "Unstake draft",
      snapshot.unstakeAmount || "0",
      unstakeUnits > 0
        ? "positive unstake amount prepared for validation"
        : "enter a positive unstake amount before submitting",
      unstakeUnits > 0 ? "neutral" : "warning",
    ),
  ];
}

export function buildCoverageWorkspaceSignals(
  snapshot: CoverageWorkspaceSnapshot,
  workspace: CoverageWorkspaceId,
): WorkflowSignalCard[] {
  switch (workspace) {
    case "member":
      return buildMemberSignals(snapshot);
    case "actions":
      return buildActionSignals(snapshot);
    case "state":
    default:
      return buildStateSignals(snapshot);
  }
}

export function buildCoverageWorkspaceState(
  snapshot: CoverageWorkspaceSnapshot,
  workspace: CoverageWorkspaceId,
): CoverageWorkspaceState {
  return {
    tab: getCoverageWorkspaceTab(workspace),
    signals: buildCoverageWorkspaceSignals(snapshot, workspace),
  };
}
