export type ArkaWorkspaceId = "state" | "flow" | "rebalance" | "credit";
export type ArkaWorkspaceTone = "positive" | "warning" | "critical" | "neutral";

export interface ArkaWorkspaceTab {
  id: ArkaWorkspaceId;
  label: string;
  detail: string;
  commandLabel: string;
}

export interface ArkaWorkspaceCard {
  id: string;
  label: string;
  value: string;
  detail: string;
  tone: ArkaWorkspaceTone;
  statusLabel: string;
}

export interface BuildArkaWorkspaceCardsInput {
  activeWorkspace: ArkaWorkspaceId;
  hasWallet: boolean;
  isManager: boolean;
  navLabel: string;
  shareLabel: string;
  selectedAssetLabel: string;
  routeCandidateCount: number;
  selectedProtocolLabel: string;
  creditProtocol: string;
  creditHealthFactorLabel: string;
  creditRiskBlocked: boolean;
  supportedCreditActionCount: number;
  vaultStatus?: string;
  rebalanceStatus?: string;
  creditStatus?: string;
}

export const ARKA_WORKSPACE_TABS: readonly ArkaWorkspaceTab[] = [
  {
    id: "state",
    label: "Overview",
    detail: "Review this Arka, its value and your current shares.",
    commandLabel: "Open overview",
  },
  {
    id: "flow",
    label: "Deposit & redeem",
    detail: "Add funds to this Arka or redeem your shares.",
    commandLabel: "Deposit or redeem",
  },
  {
    id: "rebalance",
    label: "Swap",
    detail: "Compare available swap routes and manage the portfolio.",
    commandLabel: "Open swaps",
  },
  {
    id: "credit",
    label: "Blend",
    detail: "Supply, borrow, repay or withdraw through Blend.",
    commandLabel: "Open Blend",
  },
] as const;

const ARKA_WORKSPACE_IDS = new Set<ArkaWorkspaceId>(
  ARKA_WORKSPACE_TABS.map((tab) => tab.id),
);

function summarizeCapitalFlowStatus(status: string): string {
  const normalized = status.trim();
  if (!normalized) return "Ready";
  const withoutTx = normalized.replace(/\s+·\s+tx\s+[0-9a-f.]+$/i, "");
  if (/^deposit submitted:/i.test(withoutTx)) return "Deposit submitted";
  if (/^redemption submitted:/i.test(withoutTx)) return "Redemption submitted";
  return withoutTx;
}

function statusLabelForTone(tone: ArkaWorkspaceTone, confirmed = false, busy = false): string {
  if (confirmed) return "Confirmed";
  if (busy) return "Waiting";
  if (tone === "positive") return "Ready";
  if (tone === "warning") return "Limited";
  if (tone === "critical") return "Blocked";
  return "Live";
}

export function resolveArkaWorkspaceId(value: string | null | undefined): ArkaWorkspaceId {
  if (!value) return "state";
  return ARKA_WORKSPACE_IDS.has(value as ArkaWorkspaceId)
    ? (value as ArkaWorkspaceId)
    : "state";
}

export function getArkaWorkspaceTab(id: ArkaWorkspaceId): ArkaWorkspaceTab {
  return ARKA_WORKSPACE_TABS.find((tab) => tab.id === id) ?? ARKA_WORKSPACE_TABS[0];
}

export function buildArkaWorkspaceCards(input: BuildArkaWorkspaceCardsInput): ArkaWorkspaceCard[] {
  const liveStatus =
    input.activeWorkspace === "flow"
      ? input.vaultStatus
      : input.activeWorkspace === "rebalance"
        ? input.rebalanceStatus
        : input.activeWorkspace === "credit"
          ? input.creditStatus
          : "";
  const liveStatusLabel = liveStatus?.trim() ?? "";
  const liveStatusConfirmed = /\bconfirmed\b/i.test(liveStatusLabel);
  const liveStatusBusy =
    /\b(approving|confirming|submitting|submitted|preparing|executing|pending)\b/i.test(liveStatusLabel);
  const capitalFlowStatusLabel = summarizeCapitalFlowStatus(liveStatusLabel);

  const roleCard: ArkaWorkspaceCard = {
    id: "role",
    label: "Access",
    value: input.isManager ? "Manager" : "View only",
    detail: input.isManager
      ? "You can prepare and sign actions for this Arka."
      : "Connect the manager wallet to make changes.",
    tone: input.isManager ? "positive" : "warning",
    statusLabel: statusLabelForTone(input.isManager ? "positive" : "warning"),
  };

  const walletCard: ArkaWorkspaceCard = {
    id: "wallet",
    label: "Wallet",
    value: input.hasWallet ? "Connected" : "Watching",
    detail: input.hasWallet
      ? "Wallet signer is available for this workspace."
      : "Connect a wallet before submitting signed commands.",
    tone: input.hasWallet ? "positive" : "warning",
    statusLabel: statusLabelForTone(input.hasWallet ? "positive" : "warning"),
  };

  if (input.activeWorkspace === "state") {
    return [
      {
        id: "nav",
        label: "Vault value",
        value: input.navLabel,
        detail: "Current contract-reported value.",
        tone: "neutral",
        statusLabel: statusLabelForTone("neutral"),
      },
      {
        id: "shares",
        label: "My ownership units",
        value: input.shareLabel,
        detail: "Units held by the connected wallet.",
        tone: input.hasWallet ? "positive" : "warning",
        statusLabel: statusLabelForTone(input.hasWallet ? "positive" : "warning"),
      },
      roleCard,
    ];
  }

  if (input.activeWorkspace === "flow") {
    return [
      {
        id: "asset",
        label: "Selected asset",
        value: input.selectedAssetLabel,
        detail: "Deposits and redemptions use the selected vault asset.",
        tone: "neutral",
        statusLabel: statusLabelForTone("neutral"),
      },
      walletCard,
      {
        id: "status",
        label: "Capital flow",
        value: capitalFlowStatusLabel,
        detail: liveStatusConfirmed
          ? "Latest wallet action is confirmed on Stellar."
          : liveStatusBusy
            ? "Waiting for Stellar confirmation."
            : "Deposit and redeem execute directly through the vault contract.",
        tone: liveStatusConfirmed || !liveStatusBusy ? "positive" : "warning",
        statusLabel: statusLabelForTone(
          liveStatusConfirmed || !liveStatusBusy ? "positive" : "warning",
          liveStatusConfirmed,
          liveStatusBusy,
        ),
      },
    ];
  }

  if (input.activeWorkspace === "rebalance") {
    return [
      {
        id: "protocol",
        label: "Routing",
        value: input.selectedProtocolLabel,
        detail: `${input.routeCandidateCount} route candidate${input.routeCandidateCount === 1 ? "" : "s"} evaluated.`,
        tone: input.routeCandidateCount > 0 ? "positive" : "warning",
        statusLabel: statusLabelForTone(input.routeCandidateCount > 0 ? "positive" : "warning"),
      },
      roleCard,
      {
        id: "status",
        label: "Execution state",
        value: liveStatus?.trim() ? liveStatus : "Planner ready",
        detail: "Best-execution summary stays visible before wallet signing.",
        tone: liveStatus?.trim() ? "warning" : input.isManager ? "positive" : "warning",
        statusLabel: statusLabelForTone(
          liveStatus?.trim() ? "warning" : input.isManager ? "positive" : "warning",
          false,
          Boolean(liveStatus?.trim()),
        ),
      },
    ];
  }

  return [
    {
      id: "protocol",
      label: "Credit protocol",
      value: input.creditProtocol,
    detail: `${input.supportedCreditActionCount} enabled credit action${input.supportedCreditActionCount === 1 ? "" : "s"}.`,
    tone: input.supportedCreditActionCount > 0 ? "positive" : "warning",
    statusLabel: statusLabelForTone(input.supportedCreditActionCount > 0 ? "positive" : "warning"),
  },
    {
      id: "health",
      label: "Health factor",
      value: input.creditHealthFactorLabel,
      detail: input.creditRiskBlocked
        ? "Current risk policy prevents borrow and withdraw actions."
        : "Credit actions are available under current policy.",
      tone: input.creditRiskBlocked ? "warning" : "positive",
      statusLabel: statusLabelForTone(input.creditRiskBlocked ? "warning" : "positive"),
    },
    roleCard,
  ];
}
