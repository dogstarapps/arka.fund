import type { SetupIntent } from "./productFlows";
import { replaceBrowserQueryState } from "./publicSurfaceUrlState";

export type CreateWizardStepId =
  | "start"
  | "basics"
  | "fees"
  | "deposits"
  | "redemptions"
  | "assets"
  | "review";

export type CreateWizardStepState = "done" | "current" | "pending";

export interface CreateWizardStepDefinition {
  id: CreateWizardStepId;
  label: string;
  detail: string;
}

export interface CreateWizardStepRow extends CreateWizardStepDefinition {
  state: CreateWizardStepState;
  ready: boolean;
  blockingReason: string | null;
}

export type CreateWizardVisualTone =
  | "wallet"
  | "basics"
  | "fees"
  | "deposits"
  | "redemptions"
  | "assets"
  | "review";

export type CreateWizardVisualConnectorState = "complete" | "active" | "pending";
export type CreateWizardFrameSource = "exported_figma_asset" | "documented_extension_frame";
export type CreateWizardFrameAssetVariant = "top" | "bottom";

export interface CreateWizardVisualStage extends CreateWizardStepRow {
  ordinal: number;
  statusLabel: string;
  ariaLabel: string;
  connectorState: CreateWizardVisualConnectorState;
}

export interface CreateWizardFrameBinding {
  stepId: CreateWizardStepId;
  frameFamily: string;
  frameLabel: string;
  source: CreateWizardFrameSource;
  assetVariant: CreateWizardFrameAssetVariant;
  assetPath: string;
  evidence: string;
}

export interface CreateWizardStageCopy {
  eyebrow: string;
  title: string;
  body: string;
  primaryAction: string;
  secondaryAction: string;
  visualTone: CreateWizardVisualTone;
  proofPoints: string[];
}

export interface CreateWizardReadinessInput {
  hasWallet: boolean;
  hasDenomination: boolean;
  whitelistCount: number;
  hasRouter: boolean;
  feesValid: boolean;
  feeError: string | null;
  createdArkaId: string | null;
}

export interface CreateWizardUrlState {
  step: CreateWizardStepId;
  setupIntent: SetupIntent;
}

export interface CreateFeeFieldValidation {
  value: string;
  bps: number;
  valid: boolean;
  error: string | null;
}

export interface CreateFeeProfileValidation {
  fields: {
    mgmt: CreateFeeFieldValidation;
    perf: CreateFeeFieldValidation;
    dep: CreateFeeFieldValidation;
    red: CreateFeeFieldValidation;
  };
  bps: {
    mgmt_bps: number;
    perf_bps: number;
    deposit_bps: number;
    redeem_bps: number;
  };
  valid: boolean;
  firstError: string | null;
}

export interface CreateWizardProgressSummary {
  readyCount: number;
  totalCount: number;
  percent: number;
  nextBlockingStep: CreateWizardStepDefinition | null;
  nextBlockingReason: string | null;
  readyForSignature: boolean;
}

export type CreateWizardEvidenceTone = "positive" | "warning" | "neutral";

export interface CreateWizardEvidenceItem {
  id: CreateWizardStepId;
  label: string;
  statusLabel: string;
  detail: string;
  evidence: string;
  actionLabel: string;
  tone: CreateWizardEvidenceTone;
  ready: boolean;
}

export type CreateReviewPreflightStatus = "ready" | "blocked" | "queued";

export interface CreateReviewPreflightItem {
  id:
    | "wallet"
    | "factory"
    | "denomination"
    | "assets"
    | "fees"
    | "creation-fee"
    | "execution"
    | "result";
  label: string;
  value: string;
  detail: string;
  status: CreateReviewPreflightStatus;
  tone: CreateWizardEvidenceTone;
  blocksSubmit: boolean;
}

export type CreateWizardAssetCatalogState = "idle" | "loading" | "ready" | "error";

export function formatCreationFeeDisplay(
  feeAmountBaseUnits: number,
  feeTokenLabel: string,
  decimals = 7,
): string {
  if (feeAmountBaseUnits < 0) return `0.00 ${feeTokenLabel || "fee token"}`;
  const divisor = 10 ** decimals;
  const amount = feeAmountBaseUnits / divisor;
  const amountLabel =
    amount >= 1
      ? amount.toLocaleString("en-US", {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        })
      : amount.toLocaleString("en-US", {
          minimumFractionDigits: 0,
          maximumFractionDigits: decimals,
        });
  return `${amountLabel} ${feeTokenLabel || "fee token"}`;
}

export interface CreateWizardMandateVisualCard {
  id: "base" | "universe" | "source" | "execution" | "signer";
  label: string;
  value: string;
  detail: string;
  tone: CreateWizardEvidenceTone;
}

export interface CreateWizardMandateVisual {
  title: string;
  detail: string;
  sourceLabel: string;
  progressLabel: string;
  progressPercent: number;
  cards: CreateWizardMandateVisualCard[];
}

export const FIGMA_CREATE_WIZARD_STEPS: CreateWizardStepDefinition[] = [
  {
    id: "start",
    label: "Connect wallet",
    detail: "Connect the wallet that will manage this Arka.",
  },
  {
    id: "basics",
    label: "Basics",
    detail: "Denomination and initial allowed assets.",
  },
  {
    id: "fees",
    label: "Fees",
    detail: "Management, performance, deposit and redemption fees.",
  },
  {
    id: "assets",
    label: "After creation",
    detail: "Choose the first management workspace.",
  },
  {
    id: "review",
    label: "Review and create",
    detail: "Confirm the settings in your wallet.",
  },
];

const CREATE_FIGMA_POLICY_ASSET_TOP = "/figma/create/deposits-wallet-permission.png";
const CREATE_FIGMA_POLICY_ASSET_BOTTOM = "/figma/create/deposits-limits-wallet.png";

export const FIGMA_CREATE_WIZARD_FRAME_BINDINGS: Record<
  CreateWizardStepId,
  CreateWizardFrameBinding
> = {
  start: {
    stepId: "start",
    frameFamily: "create-start",
    frameLabel: "Before you start",
    source: "documented_extension_frame",
    assetVariant: "top",
    assetPath: CREATE_FIGMA_POLICY_ASSET_TOP,
    evidence: "Uses the exported wallet-policy artwork as the real signer onboarding visual.",
  },
  basics: {
    stepId: "basics",
    frameFamily: "create-basics",
    frameLabel: "Basics",
    source: "documented_extension_frame",
    assetVariant: "top",
    assetPath: CREATE_FIGMA_POLICY_ASSET_TOP,
    evidence: "Extends the Figma deposits card rhythm for live denomination and asset selection.",
  },
  fees: {
    stepId: "fees",
    frameFamily: "create-fees",
    frameLabel: "Fees",
    source: "documented_extension_frame",
    assetVariant: "bottom",
    assetPath: CREATE_FIGMA_POLICY_ASSET_BOTTOM,
    evidence: "Uses the exported limits artwork with real percentage validation controls.",
  },
  deposits: {
    stepId: "deposits",
    frameFamily: "create-deposits",
    frameLabel: "Deposits",
    source: "exported_figma_asset",
    assetVariant: "top",
    assetPath: CREATE_FIGMA_POLICY_ASSET_TOP,
    evidence: "Maps to the exported Figma deposit-permission policy card.",
  },
  redemptions: {
    stepId: "redemptions",
    frameFamily: "create-redemptions",
    frameLabel: "Redemptions",
    source: "documented_extension_frame",
    assetVariant: "bottom",
    assetPath: CREATE_FIGMA_POLICY_ASSET_BOTTOM,
    evidence: "Extends the Figma deposit-limit card rhythm for real redemption-fee controls.",
  },
  assets: {
    stepId: "assets",
    frameFamily: "create-assets-management",
    frameLabel: "Assets management",
    source: "documented_extension_frame",
    assetVariant: "top",
    assetPath: CREATE_FIGMA_POLICY_ASSET_TOP,
    evidence: "Extends the Figma wallet-policy artwork for supported asset universe review.",
  },
  review: {
    stepId: "review",
    frameFamily: "create-review",
    frameLabel: "Review",
    source: "documented_extension_frame",
    assetVariant: "bottom",
    assetPath: CREATE_FIGMA_POLICY_ASSET_BOTTOM,
    evidence: "Extends the Figma limits artwork for the wallet-signed create transaction review.",
  },
};

export const FIGMA_CREATE_STAGE_COPY: Record<CreateWizardStepId, CreateWizardStageCopy> = {
  start: {
    eyebrow: "Before you start",
    title: "Connect wallet",
    body:
      "Connect a supported Stellar wallet before preparing the create transaction.",
    primaryAction: "Open basics",
    secondaryAction: "Review wallet state",
    visualTone: "wallet",
    proofPoints: ["Freighter", "Albedo", "xBull"],
  },
  basics: {
    eyebrow: "Basics",
    title: "Build your Arka mandate",
    body:
      "Choose the denomination and the initial allowed assets from the available list.",
    primaryAction: "Continue to fees",
    secondaryAction: "Review assets",
    visualTone: "basics",
    proofPoints: ["Denomination", "Allowed assets", "Supported list"],
  },
  fees: {
    eyebrow: "Fees",
    title: "Set the fee envelope",
    body:
      "Management, performance, deposit and redemption fees are validated before the factory transaction can be prepared.",
    primaryAction: "Continue to deposits",
    secondaryAction: "Inspect limits",
    visualTone: "fees",
    proofPoints: ["Percentage checks", "Wallet review", "No negative fees"],
  },
  deposits: {
    eyebrow: "Deposits",
    title: "Constrain capital entry",
    body:
      "Deposit policy explains what is applied during creation and which deeper restrictions must move through governed controls.",
    primaryAction: "Continue to redemptions",
    secondaryAction: "Open governed controls",
    visualTone: "deposits",
    proofPoints: ["Deposit fee", "Policy controls", "DAO controls"],
  },
  redemptions: {
    eyebrow: "Redemptions",
    title: "Define the exit posture",
    body:
      "Redemption fee is signed at creation while advanced exit constraints stay explicit and governed after launch.",
    primaryAction: "Continue to assets",
    secondaryAction: "Review exit controls",
    visualTone: "redemptions",
    proofPoints: ["Redeem fee", "Timelock policy", "Exit policy"],
  },
  assets: {
    eyebrow: "Assets management",
    title: "Prepare execution setup",
    body:
      "The Arka is created with an allowed universe. Protocol routing, Blend and Balanced/SODAX are selected from the execution page after the vault exists.",
    primaryAction: "Continue to review",
    secondaryAction: "Review protocols",
    visualTone: "assets",
    proofPoints: ["AUTO routing", "Blend", "Balanced/SODAX"],
  },
  review: {
    eyebrow: "Review",
    title: "Sign create transaction",
    body:
      "Final review packages the denomination, fee profile and allowed-asset mandate into the real wallet-signed factory transaction.",
    primaryAction: "Create Arka",
    secondaryAction: "Back to assets",
    visualTone: "review",
    proofPoints: ["Factory", "Router", "Wallet signature"],
  },
};

const STEP_ID_SET = new Set(FIGMA_CREATE_WIZARD_STEPS.map((step) => step.id));

function firstParam(
  params: URLSearchParams | Record<string, string | string[] | undefined>,
  key: string,
): string | null {
  if (params instanceof URLSearchParams) {
    return params.get(key);
  }

  const value = params[key];
  if (Array.isArray(value)) {
    return value[0] ?? null;
  }
  return value ?? null;
}

export function normalizeCreateWizardStep(
  value: string | null | undefined,
): CreateWizardStepId | null {
  if (!value) return null;
  const normalized = value.trim().toLowerCase().replace(/[_\s]+/g, "-");
  if (normalized === "before-your-start" || normalized === "before-start") {
    return "start";
  }
  if (normalized === "assets-management" || normalized === "asset-management") {
    return "assets";
  }
  if (normalized === "deposits" || normalized === "redemptions") {
    return "fees";
  }
  return STEP_ID_SET.has(normalized as CreateWizardStepId)
    ? (normalized as CreateWizardStepId)
    : null;
}

export function normalizeCreateSetupIntent(
  value: string | null | undefined,
  fallback: SetupIntent = "REBALANCE",
): SetupIntent {
  const normalized = value?.trim().toUpperCase();
  if (normalized === "BLEND") return "BLEND";
  if (normalized === "REBALANCE" || normalized === "AUTO") return "REBALANCE";
  return fallback;
}

export function normalizeCreateWizardUrlState(
  params: URLSearchParams | Record<string, string | string[] | undefined>,
): CreateWizardUrlState {
  return {
    step: normalizeCreateWizardStep(firstParam(params, "step")) ?? "basics",
    setupIntent: normalizeCreateSetupIntent(
      firstParam(params, "intent") ?? firstParam(params, "setup"),
    ),
  };
}

export function writeCreateWizardUrlState(input: CreateWizardUrlState): void {
  replaceBrowserQueryState({
    step: input.step === "basics" ? null : input.step,
    intent: input.setupIntent === "REBALANCE" ? null : input.setupIntent.toLowerCase(),
  });
}

export function getCreateWizardStepIndex(stepId: CreateWizardStepId): number {
  const index = FIGMA_CREATE_WIZARD_STEPS.findIndex((step) => step.id === stepId);
  return index >= 0 ? index : 1;
}

export function getCreateWizardStep(stepId: CreateWizardStepId): CreateWizardStepDefinition {
  return FIGMA_CREATE_WIZARD_STEPS[getCreateWizardStepIndex(stepId)];
}

export function getCreateWizardFrameBinding(
  stepId: CreateWizardStepId,
): CreateWizardFrameBinding {
  return FIGMA_CREATE_WIZARD_FRAME_BINDINGS[stepId];
}

export function deriveCreateStepReadiness(
  input: CreateWizardReadinessInput,
): Record<CreateWizardStepId, { ready: boolean; reason: string | null }> {
  const feePolicyReady = input.hasDenomination && input.feesValid;
  const feePolicyReason = !input.hasDenomination
    ? "Fee policy needs a denomination asset."
    : input.feeError;

  return {
    start: {
      ready: input.hasWallet,
      reason: input.hasWallet ? null : "Connect an authorized wallet before creation.",
    },
    basics: {
      ready: input.hasDenomination && input.whitelistCount > 0,
      reason:
        input.hasDenomination && input.whitelistCount > 0
          ? null
          : "Choose a denomination and at least one allowed asset.",
    },
    fees: {
      ready: feePolicyReady,
      reason: feePolicyReady ? null : feePolicyReason,
    },
    deposits: {
      ready: input.hasDenomination,
      reason: input.hasDenomination ? null : "Deposit policy uses the selected denomination.",
    },
    redemptions: {
      ready: input.hasDenomination,
      reason: input.hasDenomination ? null : "Redemption policy uses the selected denomination.",
    },
    assets: {
      ready: input.hasRouter && input.whitelistCount > 0,
      reason:
        input.hasRouter && input.whitelistCount > 0
          ? null
          : "Router and allowed asset universe must both be present.",
    },
    review: {
      ready: input.hasWallet && input.hasRouter && input.hasDenomination && input.feesValid,
      reason:
        input.hasWallet && input.hasRouter && input.hasDenomination && input.feesValid
          ? null
          : input.feeError ?? "Wallet, router and denomination are required before signing.",
    },
  };
}

export function buildCreateStepperRows(input: {
  activeStep: CreateWizardStepId;
  readiness: Record<CreateWizardStepId, { ready: boolean; reason: string | null }>;
  createdArkaId: string | null;
}): CreateWizardStepRow[] {
  const activeIndex = getCreateWizardStepIndex(input.activeStep);
  return FIGMA_CREATE_WIZARD_STEPS.map((step, index) => {
    const readiness = input.readiness[step.id];
    const done =
      step.id === "review"
        ? Boolean(input.createdArkaId)
        : index < activeIndex && readiness.ready;
    return {
      ...step,
      ready: readiness.ready,
      blockingReason: readiness.reason,
      state:
        index === activeIndex
          ? "current"
          : done
            ? "done"
            : "pending",
    };
  });
}

export function getCreateWizardStageCopy(stepId: CreateWizardStepId): CreateWizardStageCopy {
  return FIGMA_CREATE_STAGE_COPY[stepId];
}

export function buildCreateWizardVisualStages(
  rows: CreateWizardStepRow[],
): CreateWizardVisualStage[] {
  return rows.map((row, index) => {
    const statusLabel =
      row.state === "done"
        ? "Complete"
        : row.state === "current"
          ? row.ready
            ? "Current"
            : "Complete this step"
          : row.ready
            ? "Ready"
            : "Pending";
    const connectorState =
      row.state === "done"
        ? "complete"
        : row.state === "current"
          ? "active"
          : "pending";

    return {
      ...row,
      ordinal: index + 1,
      statusLabel,
      connectorState,
      ariaLabel: `${index + 1}. ${row.label}. ${statusLabel}${
        row.blockingReason ? `. ${row.blockingReason}` : ""
      }`,
    };
  });
}

export function getCreateStepNavigation(activeStep: CreateWizardStepId): {
  previousStep: CreateWizardStepDefinition | null;
  nextStep: CreateWizardStepDefinition | null;
} {
  const index = getCreateWizardStepIndex(activeStep);
  return {
    previousStep: FIGMA_CREATE_WIZARD_STEPS[index - 1] ?? null,
    nextStep: FIGMA_CREATE_WIZARD_STEPS[index + 1] ?? null,
  };
}

export function summarizeCreateWizardProgress(
  readiness: Record<CreateWizardStepId, { ready: boolean; reason: string | null }>,
): CreateWizardProgressSummary {
  const totalCount = FIGMA_CREATE_WIZARD_STEPS.length;
  const readyCount = FIGMA_CREATE_WIZARD_STEPS.filter((step) => readiness[step.id].ready).length;
  const nextBlockingStep =
    FIGMA_CREATE_WIZARD_STEPS.find((step) => !readiness[step.id].ready) ?? null;

  return {
    readyCount,
    totalCount,
    percent: Math.round((readyCount / totalCount) * 100),
    nextBlockingStep,
    nextBlockingReason: nextBlockingStep ? readiness[nextBlockingStep.id].reason : null,
    readyForSignature: readyCount === totalCount,
  };
}

function createEvidenceAction(row: CreateWizardStepRow): string {
  if (!row.ready) return "Complete this step";
  if (row.state === "current") return "Current checkpoint";
  if (row.state === "done") return "Reviewed";
  return "Ready when opened";
}

function createEvidenceTone(row: CreateWizardStepRow): CreateWizardEvidenceTone {
  if (!row.ready) return "warning";
  return row.state === "current" ? "positive" : "neutral";
}

export function buildCreateWizardEvidenceRail(input: {
  rows: CreateWizardStepRow[];
  walletLabel: string;
  denominationLabel: string;
  whitelistCount: number;
  setupIntent: SetupIntent;
  routerLabel: string;
  feeError: string | null;
  createdArkaId: string | null;
}): CreateWizardEvidenceItem[] {
  return input.rows.map((row) => {
    const fallbackDetail = row.blockingReason ?? row.detail;
    const statusLabel = row.ready
      ? row.state === "done"
        ? "Verified"
        : row.state === "current"
          ? "In review"
          : "Ready"
      : "Needed";

    const metadata = (() => {
      switch (row.id) {
        case "start":
          return {
            detail: row.blockingReason ?? "Wallet can authorize the final create transaction.",
            evidence: `Wallet: ${input.walletLabel}`,
          };
        case "basics":
          return {
            detail:
              row.blockingReason ??
              "Denomination and allowed assets are selected from supported sources.",
            evidence: `${input.denominationLabel || "Denomination pending"} · ${input.whitelistCount} allowed`,
          };
        case "fees":
          return {
            detail:
              row.blockingReason ??
              "Fee percentages are validated before the transaction builder is called.",
            evidence: input.feeError ?? "Fee profile valid",
          };
        case "deposits":
          return {
            detail:
              row.blockingReason ??
              "Deposit fee is part of create; deeper deposit restrictions stay in governed controls.",
            evidence: "Create fee plus governed policy controls",
          };
        case "redemptions":
          return {
            detail:
              row.blockingReason ??
              "Redemption fee is part of create; advanced exit policy stays governed after launch.",
            evidence: "Redeem fee plus governed exit controls",
          };
        case "assets":
          return {
            detail:
              row.blockingReason ??
              "Allowed assets and router posture are ready before any post-create protocol action.",
            evidence: `${input.setupIntent === "BLEND" ? "Blend credit" : "Rebalance/AUTO"} · Router ${input.routerLabel}`,
          };
        case "review":
          return {
            detail:
              row.blockingReason ??
              "Review can open the wallet confirmation using the prepared factory envelope.",
            evidence: input.createdArkaId
              ? `Created ${input.createdArkaId}`
              : "Awaiting wallet signature",
          };
        default:
          return {
            detail: fallbackDetail,
            evidence: row.ready ? "Ready" : "Needed",
          };
      }
    })();

    return {
      id: row.id,
      label: row.label,
      statusLabel,
      detail: metadata.detail,
      evidence: metadata.evidence,
      actionLabel: createEvidenceAction(row),
      tone: createEvidenceTone(row),
      ready: row.ready,
    };
  });
}

function preflightTone(status: CreateReviewPreflightStatus): CreateWizardEvidenceTone {
  if (status === "ready") return "positive";
  if (status === "blocked") return "warning";
  return "neutral";
}

function createPreflightItem(input: {
  id: CreateReviewPreflightItem["id"];
  label: string;
  value: string;
  detail: string;
  status: CreateReviewPreflightStatus;
  blocksSubmit: boolean;
}): CreateReviewPreflightItem {
  return {
    ...input,
    tone: preflightTone(input.status),
  };
}

export function buildCreateReviewPreflight(input: {
  hasWallet: boolean;
  hasFactory: boolean;
  hasRouter: boolean;
  hasDenomination: boolean;
  denominationLabel: string;
  whitelistCount: number;
  feesValid: boolean;
  feeError: string | null;
  feeToken: string;
  feeTokenLabel: string;
  feeAmount: number;
  setupIntent: SetupIntent;
  factoryLabel: string;
  routerLabel: string;
  createdArkaId: string | null;
}): CreateReviewPreflightItem[] {
  const hasCreationFee = Boolean(input.feeToken && input.feeAmount > 0);
  return [
    createPreflightItem({
      id: "wallet",
      label: "Wallet signer",
      value: input.hasWallet ? "Connected" : "Offline",
      detail: input.hasWallet
        ? "A supported Stellar wallet can sign the create transaction."
        : "Connect a wallet before opening the create confirmation.",
      status: input.hasWallet ? "ready" : "blocked",
      blocksSubmit: true,
    }),
    createPreflightItem({
      id: "factory",
      label: "Factory and router",
      value:
        input.hasFactory && input.hasRouter
          ? `${input.factoryLabel} / ${input.routerLabel}`
          : "Configuration missing",
      detail:
        input.hasFactory && input.hasRouter
          ? "The builder has the canonical factory and router contracts required for initialization."
          : "Factory and router configuration must both be present before signing.",
      status: input.hasFactory && input.hasRouter ? "ready" : "blocked",
      blocksSubmit: true,
    }),
    createPreflightItem({
      id: "denomination",
      label: "Denomination",
      value: input.hasDenomination ? input.denominationLabel : "Not selected",
      detail: input.hasDenomination
        ? "The denomination used for deposits and accounting is selected."
        : "Choose the denomination before review can sign.",
      status: input.hasDenomination ? "ready" : "blocked",
      blocksSubmit: true,
    }),
    createPreflightItem({
      id: "assets",
      label: "Allowed assets",
      value: `${input.whitelistCount} selected`,
      detail:
        input.whitelistCount > 0
          ? "The initial asset universe will be written during initialization."
          : "At least one allowed asset is required.",
      status: input.whitelistCount > 0 ? "ready" : "blocked",
      blocksSubmit: true,
    }),
    createPreflightItem({
      id: "fees",
      label: "Fee profile",
      value: input.feesValid ? "Valid" : "Invalid",
      detail: input.feeError ?? "Fee percentages are valid.",
      status: input.feesValid ? "ready" : "blocked",
      blocksSubmit: true,
    }),
    createPreflightItem({
      id: "creation-fee",
      label: "Creation fee",
      value: hasCreationFee
        ? formatCreationFeeDisplay(input.feeAmount, input.feeTokenLabel)
        : "None configured",
      detail: hasCreationFee
        ? `Paid in ${input.feeTokenLabel || "the configured fee token"}. The flow will request token approval before the create transaction. XLM only covers network fees and account reserves.`
        : "No factory creation fee is currently exposed by the configured factory.",
      status: "queued",
      blocksSubmit: false,
    }),
    createPreflightItem({
      id: "execution",
      label: "Post-create actions",
      value: input.setupIntent === "BLEND" ? "Blend credit" : "Rebalance / AUTO",
      detail:
        input.setupIntent === "BLEND"
          ? "The created Arka opens the Blend credit workflow after creation."
          : "The created Arka opens smart routing, SoroSwap, Aquarius and Balanced/SODAX actions from execution pages.",
      status: input.hasRouter && input.whitelistCount > 0 ? "ready" : "blocked",
      blocksSubmit: true,
    }),
    createPreflightItem({
      id: "result",
      label: "Result",
      value: input.createdArkaId ? "Created" : "Awaiting signature",
      detail: input.createdArkaId
        ? `Created Arka ${input.createdArkaId} is available for profile and actions.`
        : "Profile and action links unlock after the wallet-signed create transaction returns an Arka address.",
      status: input.createdArkaId ? "ready" : "queued",
      blocksSubmit: false,
    }),
  ];
}

function clampPercent(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, Math.round(value)));
}

function formatAssetCount(count: number, singular: string, plural: string): string {
  const safeCount = Math.max(0, Math.trunc(count));
  return `${safeCount} ${safeCount === 1 ? singular : plural}`;
}

export function buildCreateWizardMandateVisual(input: {
  denominationLabel: string;
  allowedAssetLabels: string[];
  selectableAssetCount: number;
  indexedAssetCount: number;
  coreRegistryCount: number;
  catalogState: CreateWizardAssetCatalogState;
  setupIntent: SetupIntent;
  walletLabel: string;
  createdArkaId: string | null;
}): CreateWizardMandateVisual {
  const baseLabel = input.denominationLabel.trim() || "Denomination pending";
  const allowedLabels = Array.from(
    new Set(
      input.allowedAssetLabels
        .map((label) => label.trim())
        .filter(Boolean),
    ),
  );
  const allowedCount = allowedLabels.length;
  const selectableCount = Math.max(0, Math.trunc(input.selectableAssetCount));
  const indexedCount = Math.max(0, Math.trunc(input.indexedAssetCount));
  const coreCount = Math.max(0, Math.trunc(input.coreRegistryCount));
  const catalogReady = input.catalogState === "ready";
  const catalogLoading = input.catalogState === "loading" || input.catalogState === "idle";
  const executionLabel =
    input.setupIntent === "BLEND" ? "Blend credit" : "AUTO routing";
  const sourceLabel = catalogReady
    ? `${formatAssetCount(indexedCount, "available asset", "available assets")} / ${formatAssetCount(coreCount, "core asset", "core assets")}`
    : catalogLoading
      ? `${formatAssetCount(coreCount, "core asset", "core assets")} while the asset list loads`
      : `${formatAssetCount(coreCount, "supported asset", "supported assets")} from the fallback list`;
  const progressPercent =
    selectableCount > 0 ? clampPercent((allowedCount / selectableCount) * 100) : 0;

  return {
    title: `${baseLabel} mandate`,
    detail:
      `${formatAssetCount(allowedCount, "allowed asset", "allowed assets")} selected from ` +
      `${formatAssetCount(selectableCount, "selectable asset", "selectable assets")}. ` +
      `${sourceLabel}.`,
    sourceLabel,
    progressLabel: `${allowedCount}/${selectableCount || 0} asset universe`,
    progressPercent,
    cards: [
      {
        id: "base",
        label: "Denomination",
        value: baseLabel,
        detail: "Selected denomination used for deposits and accounting.",
        tone: input.denominationLabel.trim() ? "positive" : "warning",
      },
      {
        id: "universe",
        label: "Allowed universe",
        value: `${allowedCount}/${selectableCount || 0}`,
        detail:
          allowedCount > 0
            ? `${allowedLabels.slice(0, 3).join(", ")}${allowedCount > 3 ? ` +${allowedCount - 3}` : ""}`
            : "Select at least one allowed asset before review.",
        tone: allowedCount > 0 ? "positive" : "warning",
      },
      {
        id: "source",
        label: "Asset source",
        value: catalogReady ? "Available" : catalogLoading ? "Loading assets" : "Supported list",
        detail: sourceLabel,
        tone: catalogReady ? "positive" : catalogLoading ? "neutral" : "warning",
      },
      {
        id: "execution",
        label: "Post-create actions",
        value: executionLabel,
        detail:
          input.setupIntent === "BLEND"
            ? "The created Arka opens Blend credit actions after creation."
            : "The created Arka opens rebalance and smart-routing actions after creation.",
        tone: "neutral",
      },
      {
        id: "signer",
        label: "Signer",
        value: input.walletLabel,
        detail: input.createdArkaId
          ? `Created Arka ${input.createdArkaId} is ready for profile and actions.`
          : "Wallet state controls whether the final factory transaction can be signed.",
        tone: input.walletLabel.toLowerCase() === "offline" ? "warning" : "positive",
      },
    ],
  };
}

function validateFeeField(value: string, label: string): CreateFeeFieldValidation {
  const trimmed = value.trim();
  if (!trimmed) {
    return { value, bps: 0, valid: true, error: null };
  }

  const parsed = Number(trimmed.replace(",", "."));
  if (!Number.isFinite(parsed)) {
    return {
      value,
      bps: 0,
      valid: false,
      error: `${label} must be a valid percentage.`,
    };
  }
  if (parsed < 0) {
    return {
      value,
      bps: 0,
      valid: false,
      error: `${label} cannot be negative.`,
    };
  }
  if (parsed > 100) {
    return {
      value,
      bps: 0,
      valid: false,
      error: `${label} cannot exceed 100%.`,
    };
  }

  return {
    value,
    bps: Math.round(parsed * 100),
    valid: true,
    error: null,
  };
}

export function validateCreateFeeProfile(input: {
  mgmt: string;
  perf: string;
  dep: string;
  red: string;
}): CreateFeeProfileValidation {
  const fields = {
    mgmt: validateFeeField(input.mgmt, "Management fee"),
    perf: validateFeeField(input.perf, "Performance fee"),
    dep: validateFeeField(input.dep, "Deposit fee"),
    red: validateFeeField(input.red, "Redemption fee"),
  };
  const firstError =
    fields.mgmt.error ?? fields.perf.error ?? fields.dep.error ?? fields.red.error ?? null;
  return {
    fields,
    bps: {
      mgmt_bps: fields.mgmt.bps,
      perf_bps: fields.perf.bps,
      deposit_bps: fields.dep.bps,
      redeem_bps: fields.red.bps,
    },
    valid: firstError === null,
    firstError,
  };
}
