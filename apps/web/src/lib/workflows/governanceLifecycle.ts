type StatusTone = "neutral" | "positive" | "warning" | "critical";

export type GovernanceLifecycleCommandId =
  | "propose"
  | "vote"
  | "close"
  | "execute"
  | "refresh";

export interface GovernanceLifecycleSnapshot {
  canAct: boolean;
  hasProposalId: boolean;
  loading: boolean;
  proposalKind: string;
  proposalIdLabel: string;
  supportLabel: string;
  walletLabel: string;
  hasExecutableProposal: boolean;
  proposalTitle: string;
  proposalStatus: string;
  queuedPackageLabel: string;
}

export interface GovernanceLifecycleReadiness {
  label: string;
  value: string;
  tone: StatusTone;
}

export interface GovernanceLifecycleCommand {
  id: GovernanceLifecycleCommandId;
  eyebrow: string;
  title: string;
  description: string;
  buttonLabel: string;
  statusLabel: string;
  statusTone: StatusTone;
  disabled: boolean;
  disabledReason: string;
  readiness: GovernanceLifecycleReadiness[];
}

function disabledForWallet(snapshot: GovernanceLifecycleSnapshot): string {
  if (snapshot.loading) return "Governance transaction already in flight.";
  if (!snapshot.canAct)
    return "Connect an authorised wallet before broadcasting.";
  return "";
}

function disabledForProposal(snapshot: GovernanceLifecycleSnapshot): string {
  const walletReason = disabledForWallet(snapshot);
  if (walletReason) return walletReason;
  if (!snapshot.hasProposalId) {
    return "Select a valid proposal ID before acting on an existing proposal.";
  }
  return "";
}

function walletReadiness(
  snapshot: GovernanceLifecycleSnapshot,
): GovernanceLifecycleReadiness {
  return {
    label: "Wallet",
    value: snapshot.canAct ? snapshot.walletLabel : "Required",
    tone: snapshot.canAct ? "positive" : "warning",
  };
}

function proposalReadiness(
  snapshot: GovernanceLifecycleSnapshot,
): GovernanceLifecycleReadiness {
  return {
    label: "Proposal",
    value: snapshot.hasProposalId ? snapshot.proposalIdLabel : "Missing",
    tone: snapshot.hasProposalId ? "positive" : "warning",
  };
}

export function buildGovernanceLifecycleCommands(
  snapshot: GovernanceLifecycleSnapshot,
): GovernanceLifecycleCommand[] {
  const proposeDisabledReason = disabledForWallet(snapshot);
  const proposalDisabledReason = disabledForProposal(snapshot);
  const executeDisabledReason =
    proposalDisabledReason ||
    (!snapshot.hasExecutableProposal
      ? "The selected proposal is not in the executable timelock window."
      : "");

  return [
    {
      id: "propose",
      eyebrow: "Open proposal",
      title: "Propose",
      description:
        snapshot.proposalKind === "Council"
          ? "Open a council rotation proposal in the DAO."
          : "Open a snapshot proposal using the connected wallet posture.",
      buttonLabel: "Propose",
      statusLabel: proposeDisabledReason
        ? "Wallet required"
        : snapshot.proposalKind,
      statusTone: proposeDisabledReason ? "warning" : "positive",
      disabled: Boolean(proposeDisabledReason),
      disabledReason: proposeDisabledReason,
      readiness: [
        walletReadiness(snapshot),
        {
          label: "Kind",
          value: snapshot.proposalKind,
          tone: "neutral",
        },
        {
          label: "Staged package",
          value: snapshot.queuedPackageLabel,
          tone: snapshot.queuedPackageLabel === "None" ? "neutral" : "positive",
        },
      ],
    },
    {
      id: "vote",
      eyebrow: "Record support",
      title: "Vote",
      description:
        "Submit the selected support value against the active proposal through the wallet-signed governor path.",
      buttonLabel: "Vote",
      statusLabel: proposalDisabledReason ? "Not ready" : snapshot.supportLabel,
      statusTone: proposalDisabledReason ? "warning" : "positive",
      disabled: Boolean(proposalDisabledReason),
      disabledReason: proposalDisabledReason,
      readiness: [
        walletReadiness(snapshot),
        proposalReadiness(snapshot),
        {
          label: "Support",
          value: snapshot.supportLabel,
          tone: "neutral",
        },
      ],
    },
    {
      id: "close",
      eyebrow: "Tally",
      title: "Close",
      description:
        "Close tallying for the active proposal once the chain accepts the voting lifecycle transition.",
      buttonLabel: "Close",
      statusLabel: proposalDisabledReason
        ? "Not ready"
        : snapshot.proposalStatus,
      statusTone: proposalDisabledReason ? "warning" : "neutral",
      disabled: Boolean(proposalDisabledReason),
      disabledReason: proposalDisabledReason,
      readiness: [
        walletReadiness(snapshot),
        proposalReadiness(snapshot),
        {
          label: "Proposal state",
          value: snapshot.proposalStatus,
          tone: "neutral",
        },
      ],
    },
    {
      id: "execute",
      eyebrow: "Timelock",
      title: "Execute",
      description:
        "Execute the selected proposal only after close/timelock conditions report an open execution window.",
      buttonLabel: "Execute",
      statusLabel: snapshot.hasExecutableProposal
        ? "Window open"
        : "Window closed",
      statusTone: snapshot.hasExecutableProposal ? "positive" : "warning",
      disabled: Boolean(executeDisabledReason),
      disabledReason: executeDisabledReason,
      readiness: [
        walletReadiness(snapshot),
        proposalReadiness(snapshot),
        {
          label: "Execution",
          value: snapshot.hasExecutableProposal ? "Open" : "Blocked",
          tone: snapshot.hasExecutableProposal ? "positive" : "warning",
        },
      ],
    },
    {
      id: "refresh",
      eyebrow: "Telemetry",
      title: "Refresh",
      description:
        "Reload governor settings, proposal status, tally and wallet vote state before taking a sensitive action.",
      buttonLabel: "Refresh",
      statusLabel: snapshot.loading ? "Refreshing" : "Live read",
      statusTone: snapshot.loading ? "warning" : "positive",
      disabled: snapshot.loading,
      disabledReason: snapshot.loading ? "Refresh is already in flight." : "",
      readiness: [
        {
          label: "Governor",
          value: snapshot.proposalTitle,
          tone: "neutral",
        },
        proposalReadiness(snapshot),
        {
          label: "Wallet vote",
          value: snapshot.supportLabel,
          tone: "neutral",
        },
      ],
    },
  ];
}
