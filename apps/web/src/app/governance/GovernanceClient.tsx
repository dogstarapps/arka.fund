"use client";
import { UX_REVIEW_PREVIEW } from "@/lib/previewSafety";

import type { StellarWalletsKit } from "@creit.tech/stellar-wallets-kit";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ActionField,
  EmptyState,
  Panel,
  StatusPill,
  SurfaceTable,
  TransactionConfirmDialog,
  TransactionFeedbackRail,
  TransactionReviewCard,
} from "@/components/product/surfacePrimitives";
import { GOVERNOR_ID } from "@/lib/config";
import {
  buildGovernorClose,
  buildGovernorExecute,
  buildGovernorProposeCouncil,
  buildGovernorProposeSnapshotSelf,
  buildGovernorVote,
  findLatestGovernorProposalIdByCreator,
  readGovernorProposal,
  readGovernorProposalVotes,
  readGovernorSettings,
  readGovernorVote,
  type GovernorProposal,
  type GovernorProposalVotes,
  type GovernorSettings,
} from "@/lib/soroban";
import { signXdr, submitSignedTx, waitForTx } from "@/lib/tx";
import {
  connectWallet,
  getWalletsKit,
} from "@/lib/walletKit";
import {
  buildGovernanceLifecycleCommands,
  type GovernanceLifecycleCommandId,
  type GovernanceLifecycleSnapshot,
} from "@/lib/workflows/governanceLifecycle";
import { buildGuardrailSourceSummary } from "@/lib/workflows/controlSurfaces";
import {
  deriveGovernanceSummary,
  deriveGovernanceParticipationSignals,
  deriveGovernanceStageMetrics,
  formatWalletStatus,
  proposalStatusLabel,
  supportLabel,
} from "@/lib/workflows/productFlows";
import {
  buildGovernedActionPackage,
  buildGovernedComposerDraftFromPackage,
  clearGovernedPublicationDraft,
  GOVERNED_COMPOSER_DRAFT_QUERY,
  GOVERNED_COMPOSER_DRAFT_STORAGE_KEY,
  GOVERNED_PUBLICATION_DRAFT_QUERY,
  buildGovernedTemplateInitialValues,
  buildGovernanceComposerProductDecision,
  deriveGovernanceHandoffState,
  GOVERNED_ACTION_TEMPLATES,
  inputModeForGovernedField,
  readGovernedComposerDraft,
  readGovernedPublicationDraft,
  serializeGovernedActionPackage,
  type GovernedActionPackage,
  type GovernedComposerDraft,
  type GovernanceHandoffState,
  writeGovernedPublicationDraft,
  writeGovernedActionDraft,
} from "@/lib/workflows/governanceComposer";

type ProposalKind = "Council" | "Snapshot";
type GovernanceConfirmIntent = "propose" | "vote" | "close" | "execute";
type GovernanceSurfaceProps = {
  operatorConsole?: boolean;
};

function GovernanceHandoffAction({
  state,
  onActivate,
  testId,
}: {
  state: GovernanceHandoffState;
  onActivate: () => boolean;
  testId: string;
}) {
  if (!state.enabled || !state.href) {
    return (
      <button
        type="button"
        disabled
        title={state.reason}
        className="surface-button surface-button-secondary disabled:cursor-not-allowed disabled:opacity-50"
        data-testid={testId}
      >
        Open executor review
      </button>
    );
  }

  return (
    <Link
      href={state.href}
      onClick={(event) => {
        if (!onActivate()) {
          event.preventDefault();
        }
      }}
      title={state.reason}
      className="surface-button surface-button-secondary"
      data-testid={testId}
    >
      Open executor review
    </Link>
  );
}

export function GovernanceSurface({ operatorConsole = false }: GovernanceSurfaceProps = {}) {
  const [walletsKit, setWalletsKit] = useState<StellarWalletsKit | null>(null);
  const [pubKey, setPubKey] = useState("");
  const [proposalKind, setProposalKind] = useState<ProposalKind>("Council");
  const [proposalIdStr, setProposalIdStr] = useState("0");
  const [support, setSupport] = useState("1");
  const [newCouncil, setNewCouncil] = useState("");

  const [settings, setSettings] = useState<GovernorSettings | null>(null);
  const [proposal, setProposal] = useState<GovernorProposal | null>(null);
  const [proposalVotes, setProposalVotes] =
    useState<GovernorProposalVotes | null>(null);
  const [voteState, setVoteState] = useState<number | null>(null);

  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [confirmIntent, setConfirmIntent] =
    useState<GovernanceConfirmIntent | null>(null);
  const [composerTemplateId, setComposerTemplateId] = useState(
    GOVERNED_ACTION_TEMPLATES[0]?.id ?? "",
  );
  const [composerContractId, setComposerContractId] = useState(
    GOVERNED_ACTION_TEMPLATES[0]?.contractDefault ?? "",
  );
  const [composerValues, setComposerValues] = useState<Record<string, string>>(
    {},
  );
  const [composerStatus, setComposerStatus] = useState("");
  const [composerError, setComposerError] = useState("");
  const [composerPackageJson, setComposerPackageJson] = useState("");
  const [publicationDraft, setPublicationDraft] =
    useState<GovernedActionPackage | null>(null);
  const pendingComposerDraftRef = useRef<GovernedComposerDraft | null>(null);
  const pendingComposerStatusRef = useRef<string | null>(null);
  const [composerDraftVersion, setComposerDraftVersion] = useState(0);

  const proposalId = Number(proposalIdStr);
  const hasProposalId = Number.isFinite(proposalId) && proposalId >= 0;
  const canAct = useMemo(
    () => Boolean(!UX_REVIEW_PREVIEW && pubKey && walletsKit && !loading),
    [pubKey, walletsKit, loading],
  );
  const selectedComposerTemplate = useMemo(
    () =>
      GOVERNED_ACTION_TEMPLATES.find(
        (template) => template.id === composerTemplateId,
      ) ?? GOVERNED_ACTION_TEMPLATES[0],
    [composerTemplateId],
  );
  const composerProductDecision = useMemo(
    () => buildGovernanceComposerProductDecision(),
    [],
  );
  const guardrailSourceSummary = useMemo(
    () => buildGuardrailSourceSummary(),
    [],
  );
  const governanceSummary = useMemo(
    () =>
      deriveGovernanceSummary({
        settings,
        proposal,
        votes: proposalVotes,
        voteState,
      }),
    [proposal, proposalVotes, settings, voteState],
  );
  const governanceSettingsRows = useMemo(
    () => [
      {
        key: "Governor",
        value: GOVERNOR_ID,
        meta: "Active governor",
        status: settings ? `${settings.quorum} quorum` : "Awaiting config",
        testId: "governance-governor-id",
      },
      {
        key: "Vote period",
        value: String(settings?.vote_period ?? "n/a"),
        meta: "Voting window per proposal",
        status: settings ? `${settings.vote_delay} delay` : "No settings",
        testId: "governance-vote-period",
      },
      {
        key: "Timelock",
        value: String(settings?.timelock ?? "n/a"),
        meta: "Delay before execution",
        status: settings ? `${settings.grace_period} grace` : "No settings",
        testId: "governance-timelock",
      },
      {
        key: "Counting",
        value: String(settings?.counting_type ?? "n/a"),
        meta: "Governor tally algorithm",
        status: settings
          ? `${settings.vote_threshold}% threshold`
          : "No settings",
        testId: "governance-counting-type",
      },
    ],
    [settings],
  );
  const governanceProposalRows = useMemo(
    () => [
      {
        key: "Proposal",
        value: proposal?.title || "No proposal selected",
        meta: proposal
          ? `ID ${proposal.id}`
          : "Select a proposal ID to inspect state",
        status: proposal ? proposalStatusLabel(proposal.status) : "Idle",
        testId: "governance-proposal-title",
      },
      {
        key: "Wallet vote",
        value: supportLabel(voteState),
        meta: "Current wallet support state",
        status: proposal
          ? proposal.executable
            ? "Executable"
            : "Pending"
          : "No proposal",
        testId: "governance-my-vote",
      },
      {
        key: "Tally",
        value: `${proposalVotes?._for ?? "n/a"} / ${proposalVotes?.against ?? "n/a"} / ${proposalVotes?.abstain ?? "n/a"}`,
        meta: "For / Against / Abstain",
        status: proposal ? `Vote end ${proposal.vote_end}` : "No tally yet",
        testId: "governance-tally-for",
      },
      {
        key: "Execution",
        value: proposal ? String(proposal.executable) : "n/a",
        meta: proposal ? `ETA ${proposal.eta ?? "n/a"}` : "No ETA yet",
        status: governanceSummary.hasExecutableProposal
          ? "Window open"
          : "Awaiting close",
        testId: "governance-proposal-executable",
      },
    ],
    [
      governanceSummary.hasExecutableProposal,
      proposal,
      proposalVotes,
      voteState,
    ],
  );
  const walletLabel = useMemo(() => formatWalletStatus(pubKey), [pubKey]);
  const participationSignals = useMemo(
    () =>
      deriveGovernanceParticipationSignals({
        pubKey,
        walletLabel,
        summary: governanceSummary,
        proposal,
      }),
    [governanceSummary, proposal, pubKey, walletLabel],
  );
  const stageMetrics = useMemo(
    () =>
      deriveGovernanceStageMetrics({
        summary: governanceSummary,
        proposal,
        votes: proposalVotes,
        walletLabel,
        pubKey,
      }),
    [governanceSummary, proposal, proposalVotes, walletLabel, pubKey],
  );
  const governanceReviewBullets = useMemo(
    () => [
      `Wallet: ${walletLabel}`,
      `Proposal kind: ${proposalKind}`,
      `Proposal target: ${hasProposalId ? proposalIdStr : "Select a valid proposal ID"}`,
      `Support posture: ${supportLabel(Number(support))}`,
      publicationDraft
        ? `Governed publication candidate: ${publicationDraft.title} -> ${publicationDraft.contractId}`
        : "Governed publication candidate: none queued",
      proposalKind === "Council"
        ? `Council target: ${newCouncil || "Awaiting council address"}`
        : "Snapshot mode targets the current wallet posture.",
    ],
    [
      hasProposalId,
      newCouncil,
      proposalIdStr,
      proposalKind,
      publicationDraft,
      support,
      walletLabel,
    ],
  );
  const composerReviewBullets = useMemo(() => {
    if (!composerPackageJson) {
      return [
        `Template: ${selectedComposerTemplate?.title ?? "n/a"}`,
        `Target: ${composerContractId.trim() || "missing contract id"}`,
        "Build a package to inspect the argument payload and governance path.",
      ];
    }
    try {
      const pkg = JSON.parse(composerPackageJson) as {
        reviewBullets?: string[];
      };
      return pkg.reviewBullets ?? [];
    } catch {
      return ["Package preview unavailable."];
    }
  }, [composerContractId, composerPackageJson, selectedComposerTemplate]);
  const publicationDraftJson = useMemo(
    () =>
      publicationDraft ? serializeGovernedActionPackage(publicationDraft) : "",
    [publicationDraft],
  );
  const publicationReviewBullets = useMemo(() => {
    if (!publicationDraft) {
      return [
        "No governed publication candidate is currently staged in Governance.",
        "Build a governed package and stage it here to keep review and executor handoff in one place.",
      ];
    }
    return [
      `Template: ${publicationDraft.title}`,
      `Action id: ${publicationDraft.actionId}`,
      `Action: ${publicationDraft.title}`,
      `Target contract: ${publicationDraft.contractId}`,
      `Generated at: ${publicationDraft.generatedAt}`,
      "Next step: reopen in composer or hand off to Contracts / executor review.",
    ];
  }, [publicationDraft]);
  const composerHandoffState = useMemo(
    () =>
      deriveGovernanceHandoffState({
        lane: "composer",
        packageReady: Boolean(composerPackageJson),
      }),
    [composerPackageJson],
  );
  const publicationHandoffState = useMemo(
    () =>
      deriveGovernanceHandoffState({
        lane: "publication",
        packageReady: Boolean(publicationDraft),
      }),
    [publicationDraft],
  );
  const confirmCopy = useMemo(() => {
    switch (confirmIntent) {
      case "propose":
        return {
          title: "Queue a governance proposal",
          body: "This opens a new proposal from the connected wallet and starts the DAO lifecycle.",
          confirmLabel: "Submit proposal",
          detail:
            proposalKind === "Council"
              ? `Council rotation will target ${newCouncil || "the connected wallet"}.`
              : "Snapshot proposal will use the connected wallet as the source posture.",
        };
      case "vote":
        return {
          title: "Broadcast governance vote",
          body: "This records the selected support value on-chain for the active proposal.",
          confirmLabel: "Submit vote",
          detail: `Proposal ${proposalIdStr || "n/a"} will receive support ${supportLabel(Number(support))}.`,
        };
      case "close":
        return {
          title: "Close governance proposal",
          body: "This requests tally closure for the active proposal. If the vote window is still open or the proposal is not closable, the chain will reject it.",
          confirmLabel: "Close proposal",
          detail: `Proposal ${proposalIdStr || "n/a"} will move from tallying toward execution readiness.`,
        };
      case "execute":
        return {
          title: "Execute governance proposal",
          body: "This sends the final execution call through the governor path. It should only be used when the timelock and execution window are open.",
          confirmLabel: "Execute proposal",
          detail: `Proposal ${proposalIdStr || "n/a"} currently reports ${governanceSummary.hasExecutableProposal ? "execution window open" : "execution not ready"}.`,
        };
      default:
        return null;
    }
  }, [
    confirmIntent,
    governanceSummary.hasExecutableProposal,
    newCouncil,
    proposalIdStr,
    proposalKind,
    support,
  ]);
  const lifecycleSnapshot = useMemo<GovernanceLifecycleSnapshot>(
    () => ({
      canAct,
      hasProposalId,
      loading,
      proposalKind,
      proposalIdLabel: hasProposalId ? `#${proposalIdStr}` : "Missing",
      supportLabel: supportLabel(Number(support)),
      walletLabel,
      hasExecutableProposal: governanceSummary.hasExecutableProposal,
      proposalTitle: proposal?.title || "No proposal selected",
      proposalStatus: proposal ? proposalStatusLabel(proposal.status) : "Idle",
      queuedPackageLabel: publicationDraft?.title ?? "None",
    }),
    [
      canAct,
      governanceSummary.hasExecutableProposal,
      hasProposalId,
      loading,
      proposal,
      proposalIdStr,
      proposalKind,
      publicationDraft,
      support,
      walletLabel,
    ],
  );
  const lifecycleCommands = useMemo(
    () => buildGovernanceLifecycleCommands(lifecycleSnapshot),
    [lifecycleSnapshot],
  );

  useEffect(() => {
    setWalletsKit(getWalletsKit(["FREIGHTER", "ALBEDO", "XBULL"]));
    const saved = localStorage.getItem("wallet:pubkey");
    if (saved) setPubKey(saved);
  }, []);

  useEffect(() => {
    if (!newCouncil && pubKey) setNewCouncil(pubKey);
  }, [newCouncil, pubKey]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    window.history.replaceState(
      {},
      "",
      operatorConsole ? "/governance/console" : "/governance",
    );
    const draftParam = params.get("draft");

    if (!operatorConsole) return;

    const storedPublicationDraft = readGovernedPublicationDraft();
    if (storedPublicationDraft) {
      setPublicationDraft(storedPublicationDraft);
    }

    if (draftParam === GOVERNED_PUBLICATION_DRAFT_QUERY) {
      if (!storedPublicationDraft) {
        setComposerError("Governed publication draft missing or invalid.");
        return;
      }
      setComposerStatus(
        `Loaded governed publication candidate for ${storedPublicationDraft.title}.`,
      );
      setComposerError("");
      return;
    }

    if (draftParam !== GOVERNED_COMPOSER_DRAFT_QUERY) return;

    const draft = readGovernedComposerDraft();

    if (!draft) {
      setComposerError("Governed composer draft missing or invalid.");
      return;
    }

    const draftTemplate = GOVERNED_ACTION_TEMPLATES.find(
      (template) => template.id === draft.templateId,
    );
    if (!draftTemplate) {
      setComposerError(
        `Governed composer draft targets unknown template ${draft.templateId}.`,
      );
      return;
    }

    pendingComposerDraftRef.current = draft;
    window.localStorage.removeItem(GOVERNED_COMPOSER_DRAFT_STORAGE_KEY);
    setComposerTemplateId(draftTemplate.id);
    setComposerDraftVersion((current) => current + 1);
  }, [operatorConsole]);

  useEffect(() => {
    if (!selectedComposerTemplate) return;
    const pendingDraft = pendingComposerDraftRef.current;
    if (
      pendingDraft &&
      pendingDraft.templateId === selectedComposerTemplate.id
    ) {
      setComposerContractId(pendingDraft.contractId);
      setComposerValues({
        ...buildGovernedTemplateInitialValues(selectedComposerTemplate, pubKey),
        ...pendingDraft.fieldValues,
      });
      setComposerStatus(
        pendingComposerStatusRef.current ??
          `Loaded governed composer draft for ${selectedComposerTemplate.title}.`,
      );
      setComposerError("");
      setComposerPackageJson("");
      pendingComposerDraftRef.current = null;
      pendingComposerStatusRef.current = null;
      return;
    }
    setComposerContractId(selectedComposerTemplate.contractDefault);
    setComposerValues(
      buildGovernedTemplateInitialValues(selectedComposerTemplate, pubKey),
    );
    setComposerStatus("");
    setComposerError("");
    setComposerPackageJson("");
  }, [composerDraftVersion, pubKey, selectedComposerTemplate]);

  const updateComposerField = (key: string, value: string): void => {
    setComposerValues((current) => ({ ...current, [key]: value }));
  };

  const buildComposerPackage = (): void => {
    if (!selectedComposerTemplate) return;
    try {
      const pkg = buildGovernedActionPackage({
        template: selectedComposerTemplate,
        contractId: composerContractId,
        fieldValues: composerValues,
      });
      setComposerPackageJson(serializeGovernedActionPackage(pkg));
      setComposerStatus(
        `Governed package ready for ${selectedComposerTemplate.title}.`,
      );
      setComposerError("");
    } catch (buildError) {
      setComposerPackageJson("");
      setComposerStatus("");
      setComposerError(
        buildError instanceof Error
          ? buildError.message
          : "Failed to build governed package.",
      );
    }
  };

  const handoffComposerPackage = (): boolean => {
    if (!composerPackageJson) {
      setComposerError("Build package before handing off to contracts.");
      setComposerStatus("");
      return false;
    }
    try {
      writeGovernedActionDraft(JSON.parse(composerPackageJson));
      setComposerStatus(
        "Governed package stored for the contracts lane handoff.",
      );
      setComposerError("");
      return true;
    } catch (handoffError) {
      setComposerError(
        handoffError instanceof Error
          ? handoffError.message
          : "Failed to store governed package draft.",
      );
      setComposerStatus("");
      return false;
    }
  };

  const queueComposerPackageForGovernance = (): boolean => {
    if (!composerPackageJson) {
      setComposerError("Build package before staging it inside Governance.");
      setComposerStatus("");
      return false;
    }
    try {
      const pkg = JSON.parse(composerPackageJson) as GovernedActionPackage;
      writeGovernedPublicationDraft(pkg);
      setPublicationDraft(pkg);
      setComposerStatus(
        `Governed package staged in Governance for ${pkg.title}.`,
      );
      setComposerError("");
      return true;
    } catch (queueError) {
      setComposerError(
        queueError instanceof Error
          ? queueError.message
          : "Failed to stage governed package inside Governance.",
      );
      setComposerStatus("");
      return false;
    }
  };

  const handoffPublicationPackage = (): boolean => {
    if (!publicationDraft) {
      setComposerError("No governed publication candidate is queued.");
      setComposerStatus("");
      return false;
    }
    try {
      writeGovernedActionDraft(publicationDraft);
      setComposerStatus(
        `Governed publication candidate handed off to Contracts for ${publicationDraft.title}.`,
      );
      setComposerError("");
      return true;
    } catch (handoffError) {
      setComposerError(
        handoffError instanceof Error
          ? handoffError.message
          : "Failed to hand off publication candidate to Contracts.",
      );
      setComposerStatus("");
      return false;
    }
  };

  const restorePublicationDraftIntoComposer = (): void => {
    if (!publicationDraft) {
      setComposerError("No governed publication candidate is queued.");
      setComposerStatus("");
      return;
    }
    try {
      pendingComposerDraftRef.current = buildGovernedComposerDraftFromPackage(
        publicationDraft,
        "governance-publication-lane",
      );
      pendingComposerStatusRef.current = `Reopened governed publication candidate for ${publicationDraft.title}.`;
      setComposerTemplateId(publicationDraft.templateId);
      setComposerDraftVersion((current) => current + 1);
      setComposerError("");
    } catch (restoreError) {
      setComposerError(
        restoreError instanceof Error
          ? restoreError.message
          : "Failed to restore publication candidate into the composer.",
      );
      setComposerStatus("");
    }
  };

  const clearPublicationLane = (): void => {
    clearGovernedPublicationDraft();
    setPublicationDraft(null);
    setComposerStatus("Governed publication lane cleared.");
    setComposerError("");
  };

  const refreshGovernor = async (): Promise<void> => {
    const nextSettings = await readGovernorSettings(
      GOVERNOR_ID,
      pubKey || undefined,
    ).catch(() => null);
    setSettings(nextSettings);
    if (!hasProposalId) {
      setProposal(null);
      setProposalVotes(null);
      setVoteState(null);
      return;
    }
    const [nextProposal, nextVotes, nextVoteState] = await Promise.all([
      readGovernorProposal(GOVERNOR_ID, proposalId, pubKey || undefined).catch(
        () => null,
      ),
      readGovernorProposalVotes(
        GOVERNOR_ID,
        proposalId,
        pubKey || undefined,
      ).catch(() => null),
      pubKey
        ? readGovernorVote(GOVERNOR_ID, pubKey, proposalId, pubKey).catch(
            () => null,
          )
        : Promise.resolve(null),
    ]);
    setProposal(nextProposal);
    setProposalVotes(nextVotes);
    setVoteState(nextVoteState);
  };

  useEffect(() => {
    void refreshGovernor();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pubKey, proposalIdStr]);

  const connect = async (): Promise<void> => {
    try {
      setError("");
      if (!walletsKit) throw new Error("Wallets Kit not initialized");
      const key = await connectWallet(walletsKit);
      setPubKey(key);
      localStorage.setItem("wallet:pubkey", key);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to connect");
    }
  };

  const execTx = async (
    xdrB64: string,
    pendingMessage: string,
  ): Promise<void> => {
    if (!walletsKit) throw new Error("Wallet not connected");
    const signed = await signXdr(walletsKit, xdrB64);
    setStatus(pendingMessage);
    const hash = await submitSignedTx(signed);
    await waitForTx(hash, 120_000);
    setStatus(`Success: ${hash}`);
  };

  const onPropose = async (): Promise<void> => {
    try {
      if (!canAct) return;
      setLoading(true);
      setError("");
      const tx =
        proposalKind === "Council"
          ? await buildGovernorProposeCouncil(
              pubKey,
              GOVERNOR_ID,
              newCouncil || pubKey,
            )
          : await buildGovernorProposeSnapshotSelf(pubKey, GOVERNOR_ID);
      await execTx(tx, `Submitting ${proposalKind.toLowerCase()} proposal...`);
      const latestProposalId = await findLatestGovernorProposalIdByCreator(
        GOVERNOR_ID,
        pubKey,
        pubKey,
        24,
      );
      if (latestProposalId !== null) setProposalIdStr(String(latestProposalId));
      await refreshGovernor();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Propose failed");
      setStatus("");
    } finally {
      setLoading(false);
    }
  };

  const onVote = async (): Promise<void> => {
    try {
      if (!canAct) return;
      setLoading(true);
      setError("");
      if (!hasProposalId) throw new Error("Invalid proposal id");
      const s = Number(support);
      if (![0, 1, 2].includes(s)) throw new Error("Support must be 0, 1, or 2");
      const tx = await buildGovernorVote(pubKey, GOVERNOR_ID, proposalId, s);
      await execTx(tx, "Submitting vote...");
      await refreshGovernor();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Vote failed");
      setStatus("");
    } finally {
      setLoading(false);
    }
  };

  const onClose = async (): Promise<void> => {
    try {
      if (!canAct) return;
      setLoading(true);
      setError("");
      if (!hasProposalId) throw new Error("Invalid proposal id");
      const tx = await buildGovernorClose(pubKey, GOVERNOR_ID, proposalId);
      await execTx(tx, "Closing proposal...");
      await refreshGovernor();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Close failed");
      setStatus("");
    } finally {
      setLoading(false);
    }
  };

  const onExecute = async (): Promise<void> => {
    try {
      if (!canAct) return;
      setLoading(true);
      setError("");
      if (!hasProposalId) throw new Error("Invalid proposal id");
      const tx = await buildGovernorExecute(pubKey, GOVERNOR_ID, proposalId);
      await execTx(tx, "Executing proposal...");
      await refreshGovernor();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Execute failed");
      setStatus("");
    } finally {
      setLoading(false);
    }
  };

  const runConfirmedAction = async (): Promise<void> => {
    const intent = confirmIntent;
    setConfirmIntent(null);
    if (!intent) return;
    if (intent === "propose") {
      await onPropose();
      return;
    }
    if (intent === "vote") {
      await onVote();
      return;
    }
    if (intent === "close") {
      await onClose();
      return;
    }
    await onExecute();
  };

  const activateLifecycleCommand = (
    commandId: GovernanceLifecycleCommandId,
  ): void => {
    if (commandId === "refresh") {
      void refreshGovernor();
      return;
    }
    if (!canAct) return;
    setConfirmIntent(commandId);
  };

  return (
    <main className="surface-stack governance-fidelity-shell">
      <header className="surface-stage-header">
        <span className="surface-eyebrow">
          {operatorConsole ? "Operator governance" : "Governance"}
        </span>
        <h1 className="surface-title">
          {operatorConsole ? "Governance console" : "Governance"}
        </h1>
        <p className="surface-description">
          {operatorConsole
            ? "Verified operator console for governed packages, proposal lifecycle review and executor handoff."
            : "Review proposals and vote with your connected wallet."}
        </p>
      </header>
      <nav
        className="surface-section-tabs governance-section-tabs"
        aria-label="Governance sections"
      >
        <a href="#governance-proposals">Proposals</a>
        <a href="#governance-voting">Voting</a>
        {operatorConsole ? <a href="#governance-composer">Composer</a> : null}
        {operatorConsole ? <a href="#governance-lifecycle">Lifecycle</a> : null}
      </nav>
      <section className="governance-stage-shell governance-stage-stack">
        <Panel
          id="governance-proposals"
          title="Proposals"
          subtitle={operatorConsole ? "Proposal queue and execution status" : "Current proposal and voting status"}
          testId="governance-overview-panel"
        >
          {operatorConsole ? <>
          <div className="surface-chip-wrap governance-stage-tabs">
            <StatusPill label="Control deck" tone="positive" />
            <StatusPill label="Overview" tone="neutral" />
            <StatusPill label="Members" tone="neutral" />
            <StatusPill label="Proposals" tone="positive" />
          </div>

          <div
            className="governance-stage-list"
            data-testid="governance-proposal-table"
          >
            {governanceProposalRows.map((row, index) => (
              <article
                key={row.key}
                className="surface-entry-card governance-stage-row"
              >
                <div className="governance-stage-index">{index + 1}</div>
                <div className="governance-stage-copy">
                  <div className="surface-entry-title">{row.key}</div>
                  <div className="surface-note">{row.meta}</div>
                  {row.key === "Proposal" ? (
                    <div className="governance-stage-meta">
                      <span data-testid="governance-proposal-title">
                        {row.value}
                      </span>
                      <span data-testid="governance-proposal-status">
                        {proposal
                          ? proposalStatusLabel(proposal.status)
                          : "n/a"}
                      </span>
                      <span data-testid="governance-proposal-vote-end">
                        Vote end {proposal?.vote_end ?? "n/a"}
                      </span>
                      <span data-testid="governance-proposal-eta">
                        ETA {proposal?.eta ?? "n/a"}
                      </span>
                    </div>
                  ) : row.key === "Tally" ? (
                    <div className="governance-stage-meta">
                      <span data-testid="governance-tally-for">
                        {row.value}
                      </span>
                      <span data-testid="governance-tally-against">
                        Against {proposalVotes?.against ?? "n/a"}
                      </span>
                      <span data-testid="governance-tally-abstain">
                        Abstain {proposalVotes?.abstain ?? "n/a"}
                      </span>
                    </div>
                  ) : (
                    <div className="governance-stage-meta">
                      <span data-testid={row.testId}>{row.value}</span>
                      <span>{row.status}</span>
                    </div>
                  )}
                </div>
                <div className="governance-stage-status">
                  <StatusPill
                    label={row.status}
                    tone={
                      row.key === "Execution"
                        ? governanceSummary.hasExecutableProposal
                          ? "positive"
                          : "warning"
                        : "neutral"
                    }
                  />
                </div>
              </article>
            ))}
          </div>

          <article
            className="surface-entry-card surface-spotlight-card governance-settings-card"
            data-testid="governance-settings-table"
          >
            <div className="surface-spotlight-head">
              <div>
                <div className="surface-table-hint">Governor config</div>
                <div className="surface-spotlight-title">Command authority</div>
              </div>
              <StatusPill
                label={
                  settings ? `${settings.quorum} quorum` : "Awaiting config"
                }
                tone={settings ? "positive" : "warning"}
              />
            </div>
            <div className="surface-list">
              {governanceSettingsRows.map((row) => (
                <div key={row.key} className="surface-list-row">
                  <div>
                    <div className="surface-table-cell-strong">{row.key}</div>
                    <div className="surface-table-subtle">{row.meta}</div>
                  </div>
                  <div
                    className="surface-table-cell-stack"
                    data-testid={row.testId}
                  >
                    <strong
                      className={`surface-table-cell-strong ${row.key === "Governor" ? "ops-mono" : ""}`}
                    >
                      {row.value}
                    </strong>
                    <span className="surface-table-subtle">{row.status}</span>
                  </div>
                </div>
              ))}
            </div>
          </article>
          </> : proposal ? (
            <article className="surface-entry-card governance-stage-row" data-testid="governance-public-proposal">
              <div className="governance-stage-copy">
                <div className="surface-entry-title">Proposal #{proposal.id}</div>
                <div className="surface-note">Voting ends at ledger {proposal.vote_end}.</div>
                <div className="governance-stage-meta">
                  <span>For {proposalVotes?._for ?? 0}</span>
                  <span>Against {proposalVotes?.against ?? 0}</span>
                  <span>Abstain {proposalVotes?.abstain ?? 0}</span>
                </div>
              </div>
              <StatusPill label={proposalStatusLabel(proposal.status)} tone="neutral" />
            </article>
          ) : (
            <EmptyState
              title="No proposal selected"
              body="Enter a proposal ID below to review it and vote."
              testId="governance-public-empty"
            />
          )}
        </Panel>

        {operatorConsole ? <div className="surface-stack governance-side-stack">
          <Panel
            id="governance-voting"
            title="Voting Power"
            subtitle="Wallet delegation posture and execution readiness"
            testId="governance-participation-panel"
          >
            <div className="governance-side-metrics">
              {stageMetrics.map((metric) => (
                <article key={metric.id} className="governance-side-metric">
                  <span className="workflow-signal-label">{metric.label}</span>
                  <strong className="workflow-signal-value">
                    {metric.value}
                  </strong>
                  <span className="workflow-signal-detail">
                    {metric.detail}
                  </span>
                </article>
              ))}
            </div>
            <div className="governance-power-card">
              <div>
                <div className="surface-list-label">Voting Power</div>
                <strong className="governance-power-value">
                  {governanceSummary.totalVotes} ARKA
                </strong>
              </div>
              {!pubKey ? (
                <button
                  onClick={connect}
                  className="surface-button surface-button-primary"
                  data-testid="governance-connect-button"
                >
                  Connect wallet
                </button>
              ) : (
                <div className="surface-chip-wrap">
                  <StatusPill label={walletLabel} tone="positive" />
                  <span
                    className="surface-table-hint"
                    data-testid="governance-wallet"
                  >
                    {walletLabel}
                  </span>
                </div>
              )}
            </div>
            <div className="workflow-signal-grid">
              {participationSignals.map((signal) => (
                <article
                  key={signal.id}
                  className="surface-signal-card workflow-signal-card"
                >
                  <span className="workflow-signal-label">{signal.label}</span>
                  <strong className="workflow-signal-value">
                    {signal.value}
                  </strong>
                  <span className="workflow-signal-detail">
                    {signal.detail}
                  </span>
                </article>
              ))}
            </div>
            <SurfaceTable
              columnsClassName="governance-participation-table"
              headers={["Channel", "Current state", "Next step"]}
              testId="governance-participation-table"
            >
              <div className="surface-table-row governance-participation-table">
                <div className="surface-table-cell surface-table-cell-stack">
                  <strong className="surface-table-cell-strong">
                    Wallet
                  </strong>
                  <span className="surface-table-subtle">
                    Connect a wallet to propose, vote, close or execute.
                  </span>
                </div>
                <div className="surface-table-cell surface-table-cell-stack">
                  {!pubKey ? (
                    <button
                      onClick={connect}
                      className="surface-button surface-button-primary"
                      data-testid="governance-connect-button"
                    >
                      Connect wallet
                    </button>
                  ) : (
                    <strong
                      className="surface-table-cell-strong ops-mono"
                      data-testid="governance-wallet"
                    >
                      {walletLabel}
                    </strong>
                  )}
                </div>
                <div className="surface-table-cell">
                  <span className="surface-table-hint">
                    {governanceSummary.hasExecutableProposal
                      ? "Review execution path before broadcasting."
                      : "Refresh proposal telemetry before acting."}
                  </span>
                </div>
              </div>
              <div className="surface-table-row governance-participation-table">
                <div className="surface-table-cell surface-table-cell-stack">
                  <strong className="surface-table-cell-strong">
                    Execution posture
                  </strong>
                  <span className="surface-table-subtle">
                    Wallet vote and proposal readiness.
                  </span>
                </div>
                <div className="surface-table-cell surface-table-statuses">
                  <StatusPill
                    label={`Wallet vote: ${governanceSummary.walletState}`}
                    tone="neutral"
                  />
                  <StatusPill
                    label={
                      governanceSummary.hasExecutableProposal
                        ? "Execution window open"
                        : "Execution not ready"
                    }
                    tone={
                      governanceSummary.hasExecutableProposal
                        ? "positive"
                        : "warning"
                    }
                  />
                </div>
                <div className="surface-table-cell">
                  <span className="surface-table-hint">
                    {proposal
                      ? `Selected proposal ${proposal.id}`
                      : "No proposal selected yet"}
                  </span>
                </div>
              </div>
            </SurfaceTable>
          </Panel>

          <Panel title="Statistics" subtitle="Approval and execution posture">
            <div className="governance-stat-grid">
              <div className="governance-stat-row">
                <span>Approval rate</span>
                <strong>
                  {governanceSummary.totalVotes > 0
                    ? `${Math.round(((proposalVotes?._for ?? 0) / governanceSummary.totalVotes) * 100)}%`
                    : "0%"}
                </strong>
              </div>
              <div className="governance-stat-row">
                <span>Proposals passed</span>
                <strong>
                  {proposal?.status === 1 || proposal?.status === 4 ? "1" : "0"}
                </strong>
              </div>
              <div className="governance-stat-row">
                <span>Active votes</span>
                <strong>
                  {proposalVotes
                    ? proposalVotes._for +
                      proposalVotes.against +
                      proposalVotes.abstain
                    : 0}
                </strong>
              </div>
            </div>
          </Panel>
        </div> : null}
      </section>

      {operatorConsole ? (
        <Panel
          id="governance-composer"
          title="Governed action composer"
          subtitle="Author, stage and review a governed package inside Governance before handing it off for executor review."
          testId="governance-composer-panel"
          className="governance-command-frame governance-composer-frame-cutover"
        >
          <div className="surface-chip-wrap surface-spotlight-tabs">
            <StatusPill label="Template-driven" tone="positive" />
            <StatusPill label="Machine-consumable" tone="neutral" />
            <StatusPill label="Governance staging" tone="neutral" />
            <StatusPill label="Contracts handoff" tone="neutral" />
          </div>
          <TransactionReviewCard
            title="Authoring path"
            body="This builds a governed package with target contract, arguments and governance path. It can be staged and reopened inside Governance, then handed off for executor review without dropping to scripts."
            bullets={composerReviewBullets}
            tone={composerPackageJson ? "positive" : "warning"}
            testId="governance-composer-review-card"
          />
          <div
            className="surface-entry-card governance-command-card-cutover governance-composer-decision-card"
            data-testid="governance-composer-product-decision"
          >
            <div className="surface-entry-head">
              <div>
                <div className="surface-entry-title">
                  Composer product decision
                </div>
                <div className="surface-note">
                  {composerProductDecision.operatorSummary}
                </div>
              </div>
              <StatusPill label={composerProductDecision.label} tone="positive" />
            </div>
            <div className="surface-grid surface-grid-three governance-composer-decision-grid">
              <article
                className="surface-entry-card"
                data-testid="governance-composer-curated-actions"
              >
                <div className="surface-entry-title">
                  {composerProductDecision.supportedTemplateCount} templates
                </div>
                <div className="surface-note">
                  DAO-controlled settings are exposed as vetted governed
                  actions across{" "}
                  {composerProductDecision.supportedDomains.join(", ")}.
                </div>
              </article>
              <article
                className="surface-entry-card"
                data-testid="governance-composer-publication-model"
              >
                <div className="surface-entry-title">
                  {composerProductDecision.publicationLane.destination}
                </div>
                <div className="surface-note">
                  {composerProductDecision.publicationLane.copy}
                </div>
              </article>
              <article
                className="surface-entry-card"
                data-testid="governance-composer-generic-batch-state"
              >
                <div className="surface-entry-title">
                  Generic batch: not supported
                </div>
                <div className="surface-note">
                  {composerProductDecision.genericExecutableBatch.reason}
                </div>
              </article>
            </div>
            <div
              className="surface-note"
              data-testid="governance-composer-migration-model"
            >
              Migration requests:{" "}
              {composerProductDecision.migrationRequests.copy}
            </div>
          </div>
          <div
            className="surface-entry-card governance-command-card-cutover"
            data-testid="governance-guardrail-source-card"
          >
            <div className="surface-entry-head">
              <div>
                <div className="surface-entry-title">
                  Guardrail source of truth
                </div>
                <div className="surface-note">
                  Rebalance guardrails are displayed as DAO-governed only after
                  contract storage exists. Current runtime-only policy values
                  stay explicitly marked as operator configuration.
                </div>
              </div>
              <StatusPill label="truthful governance boundary" tone="warning" />
            </div>
            <div className="workflow-signal-grid">
              {guardrailSourceSummary.map((signal) => (
                <article
                  key={signal.id}
                  className={`surface-signal-card workflow-signal-card operator-workspace-signal operator-workspace-signal-${signal.tone}`}
                >
                  <span className="workflow-signal-label">{signal.label}</span>
                  <strong className="workflow-signal-value">
                    {signal.value}
                  </strong>
                  <span className="workflow-signal-detail">
                    {signal.detail}
                  </span>
                </article>
              ))}
            </div>
          </div>
          <div
            className="surface-grid surface-grid-two governance-composer-grid"
            data-testid="governance-composer-grid"
          >
            <div className="surface-entry-card governance-command-card-cutover governance-composer-input-card">
              <div className="surface-entry-head">
                <div>
                  <div className="surface-entry-title">
                    Compose governed action
                  </div>
                  <div className="surface-note">
                    Choose one governed template, set the target address and
                    review the exact argument payload before handing it off.
                  </div>
                </div>
                <StatusPill
                  label={selectedComposerTemplate?.domain ?? "Template"}
                  tone="neutral"
                />
              </div>
              <div className="ops-form-grid">
                <ActionField
                  label="Template"
                  hint="This selects the canonical governed mutation shape."
                >
                  <select
                    value={composerTemplateId}
                    onChange={(event) =>
                      setComposerTemplateId(event.target.value)
                    }
                    className="ops-select"
                    data-testid="governance-composer-template-select"
                  >
                    {GOVERNED_ACTION_TEMPLATES.map((template) => (
                      <option key={template.id} value={template.id}>
                        {template.title} · {template.domain}
                      </option>
                    ))}
                  </select>
                </ActionField>
                <ActionField
                  label="Target address"
                  hint="The governed action will be preloaded against this address for executor review."
                  span
                  className="ops-field-long-value"
                >
                  <input
                    value={composerContractId}
                    onChange={(event) =>
                      setComposerContractId(event.target.value)
                    }
                    className="ops-input"
                    placeholder="C..."
                    spellCheck={false}
                    autoCapitalize="none"
                    autoCorrect="off"
                    data-testid="governance-composer-contract-input"
                  />
                </ActionField>
                {selectedComposerTemplate?.fields.map((field) => (
                  <ActionField
                    key={field.key}
                    label={field.label}
                    hint={
                      field.presentation === "percent_bps"
                        ? "Enter a percentage, e.g. 2.00"
                        : field.placeholder
                          ? `Expected format: ${field.placeholder}`
                          : undefined
                    }
                    span={
                      field.kind === "address" ||
                      field.kind === "optional_address" ||
                      field.kind === "csv_addresses" ||
                      field.kind === "bytesn32"
                    }
                    className={
                      field.kind === "address" ||
                      field.kind === "optional_address" ||
                      field.kind === "csv_addresses" ||
                      field.kind === "bytesn32"
                        ? "ops-field-long-value"
                        : undefined
                    }
                  >
                    {field.kind === "bool" ? (
                      <select
                        value={composerValues[field.key] ?? "false"}
                        onChange={(event) =>
                          updateComposerField(field.key, event.target.value)
                        }
                        className="ops-select"
                        data-testid={`governance-composer-field-${field.key}`}
                      >
                        <option value="true">true</option>
                        <option value="false">false</option>
                      </select>
                    ) : field.kind === "credit_protocol" ? (
                      <select
                        value={composerValues[field.key] ?? "Blend"}
                        onChange={(event) =>
                          updateComposerField(field.key, event.target.value)
                        }
                        className="ops-select"
                        data-testid={`governance-composer-field-${field.key}`}
                      >
                        <option value="Blend">Blend</option>
                      </select>
                    ) : (
                      <input
                        value={composerValues[field.key] ?? ""}
                        onChange={(event) =>
                          updateComposerField(field.key, event.target.value)
                        }
                        className="ops-input"
                        placeholder={field.placeholder ?? ""}
                        inputMode={inputModeForGovernedField(field)}
                        spellCheck={false}
                        autoCapitalize="none"
                        autoCorrect="off"
                        data-testid={`governance-composer-field-${field.key}`}
                      />
                    )}
                  </ActionField>
                ))}
              </div>
              <div className="ops-action-row governance-command-actions-cutover">
                <button
                  type="button"
                  onClick={buildComposerPackage}
                  className="surface-button surface-button-primary"
                  data-testid="governance-composer-build-button"
                >
                  Build package
                </button>
                <button
                  type="button"
                  onClick={queueComposerPackageForGovernance}
                  disabled={!composerPackageJson}
                  className="surface-button surface-button-secondary disabled:cursor-not-allowed disabled:opacity-50"
                  data-testid="governance-composer-queue-button"
                >
                  Stage in governance
                </button>
                <GovernanceHandoffAction
                  state={composerHandoffState}
                  onActivate={handoffComposerPackage}
                  testId="governance-composer-handoff-link"
                />
              </div>
            </div>

            <div className="surface-entry-card governance-command-card-cutover governance-composer-preview-card">
              <div className="surface-entry-head">
                <div>
                  <div className="surface-entry-title">
                    Governed package preview
                  </div>
                  <div className="surface-note">
	                    Review the exact governed payload that will be
	                    staged in Governance and can then be handed off to the
	                    executor review workspace.
                  </div>
                </div>
                <StatusPill
                  label={composerPackageJson ? "Package ready" : "Awaiting build"}
                  tone={composerPackageJson ? "positive" : "warning"}
                />
              </div>
              <pre
                className="surface-code-block"
                data-testid="governance-composer-package-json"
              >
                {composerPackageJson ||
                  JSON.stringify(
                    {
                      kind: "governed-action-package",
                      template: selectedComposerTemplate?.id ?? "n/a",
                      status:
                        "Build package to preview canonical args and governance handoff.",
                    },
                    null,
                    2,
                  )}
              </pre>
              <article
                className="surface-entry-card governance-publication-lane governance-command-card-cutover"
                data-testid="governance-publication-panel"
              >
                <div className="surface-entry-head">
                  <div>
                    <div className="surface-entry-title">
	                      Governance publication queue
                    </div>
                    <div className="surface-note">
                      Keep one governed package staged inside Governance so the
	                      operator console can review, reopen and hand it off without
                      rebuilding it.
                    </div>
                  </div>
                  <StatusPill
                    label={publicationDraft ? "Queued" : "Empty"}
                    tone={publicationDraft ? "positive" : "warning"}
                  />
                </div>
                <TransactionReviewCard
                  title="Queued candidate"
	                  body="This is the current governed publication candidate held inside Governance. It is a staged package for operator review and executor handoff, not a simulated arbitrary-calldata publish button or generic executable batch."
                  bullets={publicationReviewBullets}
                  tone={publicationDraft ? "positive" : "warning"}
                  testId="governance-publication-review-card"
                />
                <pre
                  className="surface-code-block"
                  data-testid="governance-publication-package-json"
                >
                  {publicationDraftJson ||
                    JSON.stringify(
                      {
                        kind: "governed-publication-lane",
                        status:
                          "Stage a built package to keep it inside Governance.",
                      },
                      null,
                      2,
                    )}
                </pre>
                <div className="ops-action-row governance-command-actions-cutover">
                  <button
                    type="button"
                    onClick={restorePublicationDraftIntoComposer}
                    disabled={!publicationDraft}
                    className="surface-button surface-button-secondary disabled:cursor-not-allowed disabled:opacity-50"
                    data-testid="governance-publication-restore-button"
                  >
                    Reopen in composer
                  </button>
                  <GovernanceHandoffAction
                    state={publicationHandoffState}
                    onActivate={handoffPublicationPackage}
                    testId="governance-publication-handoff-link"
                  />
                  <button
                    type="button"
                    onClick={clearPublicationLane}
                    disabled={!publicationDraft}
                    className="surface-button surface-button-secondary disabled:cursor-not-allowed disabled:opacity-50"
                    data-testid="governance-publication-clear-button"
                  >
	                    Clear queue
                  </button>
                </div>
              </article>
            </div>
          </div>
          <TransactionFeedbackRail
            status={composerStatus}
            error={composerError}
            statusTestId="governance-composer-status"
            errorTestId="governance-composer-error"
          />
        </Panel>
      ) : null}

      {!operatorConsole ? (
        <Panel
          id="governance-voting"
          title="Vote"
          subtitle="Review a proposal and record your choice"
          testId="governance-public-vote-panel"
        >
          <div className="ops-form-grid">
            <ActionField label="Proposal ID" hint="Enter the proposal you want to review.">
              <input
                value={proposalIdStr}
                onChange={(event) => setProposalIdStr(event.target.value)}
                className="ops-input"
                inputMode="numeric"
                pattern="[0-9]*"
                aria-invalid={!hasProposalId}
                data-testid="governance-proposal-id-input"
              />
            </ActionField>
            <ActionField label="Your vote">
              <select
                value={support}
                onChange={(event) => setSupport(event.target.value)}
                className="ops-select"
                data-testid="governance-support-select"
              >
                <option value="1">For</option>
                <option value="0">Against</option>
                <option value="2">Abstain</option>
              </select>
            </ActionField>
          </div>
          <div className="ops-action-row">
            {!pubKey ? (
              <button type="button" onClick={connect} className="surface-button surface-button-primary" data-testid="governance-connect-button">Connect wallet</button>
            ) : (
              <button type="button" onClick={() => setConfirmIntent("vote")} disabled={UX_REVIEW_PREVIEW || !proposal || loading} title={UX_REVIEW_PREVIEW ? "Voting is disabled in this review preview." : undefined} className="surface-button surface-button-primary" data-testid="governance-vote-button">Vote</button>
            )}
          </div>
          <TransactionFeedbackRail loading={loading} loadingLabel="Submitting vote..." status={status} error={error} />
        </Panel>
      ) : null}

      {operatorConsole ? <Panel
        id="governance-lifecycle"
        title="Lifecycle controls"
        subtitle="Propose, vote, close and execute from one action row"
        testId="governance-actions-panel"
        className="governance-command-frame governance-lifecycle-frame-cutover"
      >
        <div className="surface-note">
          Advanced DAO policy actions (fees, guardrails, executor and coverage
          governance) are available in{" "}
          <Link
            href="/governance/console"
            className="surface-inline-link"
            data-testid="governance-operator-console-link"
          >
            DAO Console
          </Link>
          {" "}for verified operators.
        </div>
        <div className="surface-chip-wrap surface-spotlight-tabs">
          <StatusPill label="Propose" tone="positive" />
          <StatusPill label="Vote" tone="neutral" />
          <StatusPill label="Close / Execute" tone="neutral" />
        </div>
        <TransactionReviewCard
          title="Governor + executor flow"
	          body="DAO-sensitive changes are not treated as raw writes here. The lifecycle stays explicit: open proposal, record vote posture, close when allowed and execute only when the chain marks the window ready."
          bullets={governanceReviewBullets}
          tone={canAct ? "positive" : "warning"}
          testId="governance-review-card"
        />
        <div
          className="surface-grid governance-action-stack governance-lifecycle-layout"
          data-testid="governance-lifecycle-layout"
        >
          <div className="surface-entry-card governance-command-card-cutover governance-lifecycle-input-card">
            <div className="surface-entry-head">
              <div>
                <div className="surface-entry-title">Proposal inputs</div>
                <div className="surface-note">
	                  Select the proposal, target and support posture
                  before acting.
                </div>
              </div>
              <StatusPill label={proposalKind} tone="neutral" />
            </div>
            <div className="ops-form-grid">
              <ActionField
                label="Proposal kind"
                hint="Choose whether the proposal targets council rotation or a wallet snapshot."
              >
                <select
                  value={proposalKind}
                  onChange={(e) =>
                    setProposalKind(e.target.value as ProposalKind)
                  }
                  className="ops-select"
                  data-testid="governance-proposal-kind-select"
                >
                  <option value="Council">Council</option>
                  <option value="Snapshot">Snapshot</option>
                </select>
              </ActionField>
              <ActionField
                label="Proposal ID"
                hint="Use the active proposal identifier for vote, close and execute."
                error={
                  !hasProposalId
                    ? "Proposal ID must be a non-negative integer."
                    : undefined
                }
              >
                <input
                  value={proposalIdStr}
                  onChange={(e) => setProposalIdStr(e.target.value)}
                  className="ops-input"
                  placeholder="Proposal ID"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  aria-invalid={!hasProposalId}
                  data-testid="governance-proposal-id-input"
                />
              </ActionField>
              {proposalKind === "Council" && (
                <ActionField
                  label="New council"
                  hint="This becomes the target council address when the proposal executes."
                  span
                >
                  <input
                    value={newCouncil}
                    onChange={(e) => setNewCouncil(e.target.value)}
                    className="ops-input"
                    placeholder="Council address"
                    spellCheck={false}
                    autoCapitalize="none"
                    autoCorrect="off"
                    data-testid="governance-new-council-input"
                  />
                </ActionField>
              )}
              <ActionField
                label="Support"
                hint="For / Against / Abstain is written on-chain exactly as selected."
              >
                <select
                  value={support}
                  onChange={(e) => setSupport(e.target.value)}
                  className="ops-select"
                  data-testid="governance-support-select"
                >
                  <option value="0">0 - Against</option>
                  <option value="1">1 - For</option>
                  <option value="2">2 - Abstain</option>
                </select>
              </ActionField>
            </div>
          </div>

          <div className="workflow-action-stack governance-lifecycle-command-deck">
            <div
              className="governance-lifecycle-command-list"
              data-testid="governance-actions-table"
            >
              {lifecycleCommands.map((command, index) => (
                <article
                  key={command.id}
                  className="governance-lifecycle-command-card"
                  data-testid={`governance-command-${command.id}`}
                >
                  <div className="governance-lifecycle-index">
                    {String(index + 1).padStart(2, "0")}
                  </div>
                  <div className="governance-lifecycle-copy">
                    <div className="surface-list-label">{command.eyebrow}</div>
                    <strong className="surface-entry-title">
                      {command.title}
                    </strong>
                    <span className="surface-note">{command.description}</span>
                    {command.disabledReason ? (
                      <span className="governance-lifecycle-disabled-reason">
                        {command.disabledReason}
                      </span>
                    ) : null}
                  </div>
                  <div className="governance-lifecycle-readiness">
                    {command.readiness.map((item) => (
                      <span
                        key={`${command.id}-${item.label}`}
                        className="governance-lifecycle-readiness-item"
                      >
                        <span>{item.label}</span>
                        {" "}
                        <StatusPill label={item.value} tone={item.tone} />
                      </span>
                    ))}
                  </div>
                  <div className="governance-lifecycle-action">
                    <StatusPill
                      label={command.statusLabel}
                      tone={command.statusTone}
                    />
                    <button
                      type="button"
                      onClick={() => activateLifecycleCommand(command.id)}
                      disabled={command.disabled}
                      className={`surface-button ${
                        command.id === "propose" || command.id === "vote"
                          ? "surface-button-primary"
                          : "surface-button-secondary"
                      } disabled:cursor-not-allowed disabled:opacity-50`}
                      data-testid={`governance-${command.id}-button`}
                    >
                      {command.buttonLabel}
                    </button>
                  </div>
                </article>
              ))}
            </div>
            <div className="surface-note">
	              Lifecycle stays linear here: propose opens the proposal, vote records
              posture, and close / execute move the selected proposal through
              the final governance steps.
            </div>
          </div>
        </div>

        <TransactionFeedbackRail
          loading={loading}
          loadingLabel="Submitting governance lifecycle step..."
          status={status}
          error={error}
          statusTestId="governance-status"
          errorTestId="governance-error"
        />
      </Panel> : null}
      <TransactionConfirmDialog
        open={Boolean(confirmCopy)}
        title={confirmCopy?.title ?? ""}
        body={confirmCopy?.body ?? ""}
        detail={confirmCopy?.detail}
        bullets={governanceReviewBullets}
        confirmLabel={confirmCopy?.confirmLabel ?? "Confirm"}
        tone={confirmIntent === "execute" ? "warning" : "positive"}
        busy={loading}
        onCancel={() => setConfirmIntent(null)}
        onConfirm={() => void runConfirmedAction()}
        confirmTestId="governance-confirm-button"
        cancelTestId="governance-cancel-button"
      />
    </main>
  );
}

export default GovernanceSurface;
