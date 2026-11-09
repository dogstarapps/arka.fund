import { formatContractLabel } from "@/lib/catalog/format";
import type { ProtocolSupportStatus } from "@/lib/workflows/productFlows";

const BASE_DECIMALS = 7;

export type LiveOpsSpotlight = {
  id: string;
  label: string;
  value: string;
  meta: string;
  state: string;
  tone: "neutral" | "positive" | "warning";
  stripPct: number;
};

export type ArkaRegistryLookupState =
  | "loading"
  | "ready"
  | "empty"
  | "unconfigured"
  | "error";

export function normalizeArkaContractInput(value: string): string {
  return value.trim().toUpperCase();
}

export function isValidArkaContractId(value: string): boolean {
  const normalized = normalizeArkaContractInput(value);
  return /^C[A-Z2-7]{55}$/.test(normalized);
}

export type ArkaDirectNavigationState = {
  normalizedId: string;
  hasInput: boolean;
  isValid: boolean;
  opsHref: string | null;
  profileHref: string | null;
  validationMessage: string;
};

export function deriveArkaDirectNavigationState(value: string): ArkaDirectNavigationState {
  const normalizedId = normalizeArkaContractInput(value);
  const hasInput = normalizedId.length > 0;
  const isValid = isValidArkaContractId(normalizedId);

  return {
    normalizedId,
    hasInput,
    isValid,
    opsHref: isValid ? `/arkas/${normalizedId}` : null,
    profileHref: isValid ? `/vaults/${normalizedId}` : null,
    validationMessage: !hasInput
      ? "Enter an Arka address before opening actions."
      : isValid
        ? "Valid Arka address. Navigation uses the normalized address."
        : "Invalid Arka address. It should start with C and contain 56 characters.",
  };
}

function describeRegistryLookup(input: {
  registryCount: number;
  registryState: ArkaRegistryLookupState;
  showAll: boolean;
}): Pick<LiveOpsSpotlight, "meta" | "state" | "tone" | "stripPct"> {
  if (input.registryState === "loading") {
    return {
      meta: "Loading the indexed Arka list from the current environment.",
      state: "Loading",
      tone: "neutral",
      stripPct: 36,
    };
  }

  if (input.registryState === "unconfigured") {
    return {
      meta: "The indexed Arka list is not configured for this environment.",
      state: "Unconfigured",
      tone: "warning",
      stripPct: 18,
    };
  }

  if (input.registryState === "error") {
    return {
      meta: "The indexed Arka list failed; direct open remains available for known Arka addresses.",
      state: "Lookup failed",
      tone: "warning",
      stripPct: 22,
    };
  }

  if (input.registryState === "empty") {
    return {
      meta: "The indexed Arka list is empty.",
      state: "Empty",
      tone: "warning",
      stripPct: 24,
    };
  }

  return {
    meta: input.showAll
      ? "Showing the full current Arka list."
      : "Showing the first indexed Arka shortcuts.",
    state: input.registryCount > 0 ? "Loaded" : "Empty",
    tone: input.registryCount > 0 ? "positive" : "warning",
    stripPct: input.registryCount > 0 ? 80 : 24,
  };
}

export function formatBaseUnits(
  value: number | null | undefined,
  fractionDigits = 4,
): string {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return "n/a";
  }
  return (value / 10 ** BASE_DECIMALS).toFixed(fractionDigits);
}

export function tierLabel(tier: number): string {
  if (tier >= 3) return "Tier 3";
  if (tier === 2) return "Tier 2";
  if (tier === 1) return "Tier 1";
  return "Unranked";
}

export type OpsHealthSummaryInput = {
  governorOk: boolean;
  votesOk: boolean;
  coverageVaultBalance: number | null;
  coverageFundStaked: number | null;
  tierThresholds: [number, number, number] | null;
  balancedRouter: string | null;
  aquariusRouter: string | null;
  soroswapRouter: string | null;
  blendRouter: string | null;
  governorId: string;
  votesId: string;
  coverageVaultId: string;
  coverageFundId: string;
  managerTierId: string;
  balancedAdapterId: string;
  aquariusAdapterId: string;
  soroswapAdapterId: string;
  blendAdapterId: string;
  expectedBalancedRouter: string | null;
  balancedSupportStatus: ProtocolSupportStatus;
  balancedLaneMode: string;
  expectedAquariusRouter: string;
  expectedSoroswapRouter: string;
  expectedBlendRouter: string;
};

export type OpsHealthRow = {
  id: string;
  label: string;
  status: string;
  detail: string;
  contract: string;
  healthy: boolean;
};

export function deriveOpsHealthSummary(input: OpsHealthSummaryInput): {
  rows: OpsHealthRow[];
  healthyCount: number;
  totalChecks: number;
  degraded: boolean;
  thresholdSummary: string;
  coverageVaultFormatted: string;
  coverageFundFormatted: string;
  adapterSummary: string;
} {
  const balancedExpectedRouter = input.expectedBalancedRouter || null;
  const balancedHealthy =
    input.balancedSupportStatus === "ready" &&
    Boolean(balancedExpectedRouter) &&
    input.balancedRouter === balancedExpectedRouter;
  const balancedStatus =
    input.balancedSupportStatus === "inactive"
      ? "Inactive"
      : input.balancedSupportStatus === "blocked"
        ? "Blocked"
        : balancedHealthy
          ? "OK"
          : "Mismatch";
  const balancedDetail =
    input.balancedSupportStatus === "inactive"
      ? "No canonical Balanced router is declared for the current environment."
      : input.balancedSupportStatus === "blocked"
        ? "Balanced/SODAX remains pending until production readiness is confirmed."
        : balancedHealthy
          ? `Adapter resolves to ${formatContractLabel(balancedExpectedRouter)}.`
          : `Expected ${formatContractLabel(balancedExpectedRouter)} but read ${formatContractLabel(input.balancedRouter)}.`;

  const rows: OpsHealthRow[] = [
    {
      id: "governor",
      label: "Governor readability",
      status: input.governorOk ? "OK" : "Unavailable",
      detail: input.governorOk ? "Governance state is readable from the current environment." : "The current environment could not read the governor contract.",
      contract: input.governorId,
      healthy: input.governorOk,
    },
    {
      id: "votes",
      label: "Voting power readability",
      status: input.votesOk ? "OK" : "Unavailable",
      detail: input.votesOk ? "Voting power checkpoints are readable." : "Voting power reads failed from the current environment.",
      contract: input.votesId,
      healthy: input.votesOk,
    },
    {
      id: "coverage-vault",
      label: "Coverage Vault reserve",
      status: !input.coverageVaultId ? "Not selected" : input.coverageVaultBalance === null ? "Not verified" : input.coverageVaultBalance > 0 ? "Funded" : "Empty",
      detail: !input.coverageVaultId ? "No manager-specific reserve is selected for this network." : input.coverageVaultBalance === null ? "Manager reserve balance is unknown; it is not zero." : `Manager reserve ${formatBaseUnits(input.coverageVaultBalance)}.`,
      contract: input.coverageVaultId,
      healthy: Boolean(input.coverageVaultId) && input.coverageVaultBalance !== null && input.coverageVaultBalance >= 0,
    },
    {
      id: "coverage-fund",
      label: "Coverage Fund stake",
      status: input.coverageFundStaked === null ? "Not verified" : input.coverageFundStaked > 0 ? "Active" : "Idle",
      detail: input.coverageFundStaked === null ? "Community stake could not be checked; it is not zero." : `Community reserve ${formatBaseUnits(input.coverageFundStaked)} staked.`,
      contract: input.coverageFundId,
      healthy: input.coverageFundStaked !== null && input.coverageFundStaked >= 0,
    },
    {
      id: "manager-tier",
      label: "Manager tier thresholds",
      status: input.tierThresholds ? "Configured" : "Unavailable",
      detail: input.tierThresholds
        ? `${input.tierThresholds[0]} / ${input.tierThresholds[1]} / ${input.tierThresholds[2]} points`
        : "Thresholds could not be read from the contract.",
      contract: input.managerTierId,
      healthy: Boolean(input.tierThresholds),
    },
    {
      id: "balanced-adapter",
      label: "Balanced adapter route",
      status: balancedStatus,
      detail: balancedDetail,
      contract: input.balancedAdapterId,
      healthy: balancedHealthy,
    },
    {
      id: "aquarius-adapter",
      label: "Aquarius adapter route",
      status: input.aquariusRouter === input.expectedAquariusRouter ? "OK" : "Mismatch",
      detail:
        input.aquariusRouter === input.expectedAquariusRouter
          ? `Adapter resolves to ${formatContractLabel(input.expectedAquariusRouter)}.`
          : `Expected ${formatContractLabel(input.expectedAquariusRouter)} but read ${formatContractLabel(input.aquariusRouter)}.`,
      contract: input.aquariusAdapterId,
      healthy: input.aquariusRouter === input.expectedAquariusRouter,
    },
    {
      id: "soroswap-adapter",
      label: "SoroSwap adapter route",
      status: input.soroswapRouter === input.expectedSoroswapRouter ? "OK" : "Mismatch",
      detail:
        input.soroswapRouter === input.expectedSoroswapRouter
          ? `Adapter resolves to ${formatContractLabel(input.expectedSoroswapRouter)}.`
          : `Expected ${formatContractLabel(input.expectedSoroswapRouter)} but read ${formatContractLabel(input.soroswapRouter)}.`,
      contract: input.soroswapAdapterId,
      healthy: input.soroswapRouter === input.expectedSoroswapRouter,
    },
    {
      id: "blend-adapter",
      label: "Blend adapter route",
      status: input.blendRouter === input.expectedBlendRouter ? "OK" : "Mismatch",
      detail:
        input.blendRouter === input.expectedBlendRouter
          ? `Adapter resolves to ${formatContractLabel(input.expectedBlendRouter)}.`
          : `Expected ${formatContractLabel(input.expectedBlendRouter)} but read ${formatContractLabel(input.blendRouter)}.`,
      contract: input.blendAdapterId,
      healthy: input.blendRouter === input.expectedBlendRouter,
    },
  ];

  const healthyCount = rows.filter((row) => row.healthy).length;

  return {
    rows,
    healthyCount,
    totalChecks: rows.length,
    degraded: healthyCount !== rows.length,
    thresholdSummary: input.tierThresholds
      ? `${input.tierThresholds[0]} / ${input.tierThresholds[1]} / ${input.tierThresholds[2]}`
      : "n/a",
    coverageVaultFormatted: formatBaseUnits(input.coverageVaultBalance),
    coverageFundFormatted: formatBaseUnits(input.coverageFundStaked),
    adapterSummary:
      balancedHealthy &&
      input.aquariusRouter === input.expectedAquariusRouter &&
      input.soroswapRouter === input.expectedSoroswapRouter &&
      input.blendRouter === input.expectedBlendRouter
        ? "All routes aligned"
        : "Route mismatch detected",
  };
}

export function buildOpsSpotlights(summary: {
  degraded: boolean;
  healthyCount: number;
  totalChecks: number;
  coverageVaultFormatted: string;
  coverageFundFormatted: string;
  thresholdSummary: string;
  adapterSummary: string;
}): LiveOpsSpotlight[] {
  return [
    {
      id: "ops-health",
      label: "Readiness",
      value: `${summary.healthyCount}/${summary.totalChecks}`,
      meta: "Live checks currently passing across governance, coverage and routing.",
      state: summary.degraded ? "Attention required" : "Healthy",
      tone: summary.degraded ? "warning" : "positive",
      stripPct: Math.max(18, Math.round((summary.healthyCount / Math.max(1, summary.totalChecks)) * 100)),
    },
    {
      id: "ops-coverage",
      label: "Coverage posture",
      value: `${summary.coverageVaultFormatted} / ${summary.coverageFundFormatted}`,
      meta: "Manager reserve versus community reserve currently visible on-chain.",
      state: "Reserve telemetry",
      tone: "neutral",
      stripPct: 72,
    },
    {
      id: "ops-routing",
      label: "Routing posture",
      value: summary.adapterSummary,
      meta: "Balanced, Aquarius, SoroSwap and Blend routes compared against expected targets.",
      state: summary.degraded ? "Review routes" : "Aligned",
      tone: summary.degraded ? "warning" : "positive",
      stripPct: summary.degraded ? 44 : 84,
    },
    {
      id: "ops-tiers",
      label: "Tier ladder",
      value: summary.thresholdSummary,
      meta: "Current manager threshold ladder used by governed scoring flows.",
      state: "Policy live",
      tone: "neutral",
      stripPct: summary.thresholdSummary === "n/a" ? 24 : 66,
    },
  ];
}

export function buildOpsRunbookSpotlights(summary: {
  degraded: boolean;
  healthyCount: number;
  totalChecks: number;
  coverageVaultFormatted: string;
  coverageFundFormatted: string;
  adapterSummary: string;
}): LiveOpsSpotlight[] {
  return [
    {
      id: "ops-governance-baseline",
      label: "Governance baseline",
      value: `${summary.healthyCount}/${summary.totalChecks}`,
      meta: "Readable governor and voting-power surfaces before queueing sensitive actions.",
      state: summary.degraded ? "Recheck" : "Baseline live",
      tone: summary.degraded ? "warning" : "positive",
      stripPct: Math.max(20, Math.round((summary.healthyCount / Math.max(1, summary.totalChecks)) * 100)),
    },
    {
      id: "ops-reserve-gate",
      label: "Reserve gate",
      value: `${summary.coverageVaultFormatted} / ${summary.coverageFundFormatted}`,
      meta: "Manager lock and community reserve visible before changing protocol exposure.",
      state: "Coverage guardrail",
      tone: "neutral",
      stripPct: 70,
    },
    {
      id: "ops-routing-lane",
      label: "Routing",
      value: summary.adapterSummary,
      meta: "Balanced, Aquarius, SoroSwap and Blend routing compared against expected live targets.",
      state: summary.degraded ? "Review wiring" : "Wiring aligned",
      tone: summary.degraded ? "warning" : "positive",
      stripPct: summary.degraded ? 46 : 82,
    },
  ];
}

export type TierSummaryInput = {
  pubKey: string;
  targetManager: string;
  points: number;
  tier: number;
  thresholds: [number, number, number] | null;
};

export type TierStageRow = {
  id: string;
  label: string;
  floor: string;
  state: string;
  met: boolean;
};

export function deriveTierSummary(input: TierSummaryInput): {
  label: string;
  walletConnected: boolean;
  targetLabel: string;
  thresholdsLabel: string;
  nextStep: string;
  progressDetail: string;
  stageRows: TierStageRow[];
} {
  const thresholds = input.thresholds ?? [0, 0, 0];
  const stageRows: TierStageRow[] = [
    {
      id: "tier-1",
      label: "Tier 1",
      floor: `${thresholds[0]} pts`,
      state: input.points >= thresholds[0] ? "Unlocked" : "Pending",
      met: input.points >= thresholds[0],
    },
    {
      id: "tier-2",
      label: "Tier 2",
      floor: `${thresholds[1]} pts`,
      state: input.points >= thresholds[1] ? "Unlocked" : "Pending",
      met: input.points >= thresholds[1],
    },
    {
      id: "tier-3",
      label: "Tier 3",
      floor: `${thresholds[2]} pts`,
      state: input.points >= thresholds[2] ? "Unlocked" : "Pending",
      met: input.points >= thresholds[2],
    },
  ];

  const nextThreshold = stageRows.find((row) => !row.met);

  return {
    label: tierLabel(input.tier),
    walletConnected: Boolean(input.pubKey),
    targetLabel: formatContractLabel(input.targetManager || input.pubKey, 8, 6),
    thresholdsLabel: input.thresholds
      ? `${input.thresholds[0]} / ${input.thresholds[1]} / ${input.thresholds[2]}`
      : "n/a",
    nextStep: nextThreshold ? `${nextThreshold.label} at ${nextThreshold.floor}` : "Highest tier reached",
    progressDetail: `${input.points} points tracked for the current manager target.`,
    stageRows,
  };
}

export function buildTierSpotlights(summary: {
  walletConnected: boolean;
  label: string;
  targetLabel: string;
  thresholdsLabel: string;
  nextStep: string;
  stageRows: TierStageRow[];
}): LiveOpsSpotlight[] {
  const unlockedCount = summary.stageRows.filter((row) => row.met).length;

  return [
    {
      id: "tier-wallet",
      label: "Wallet",
      value: summary.walletConnected ? "Connected" : "Missing",
      meta: "Governed point updates require a connected signer with on-chain authorization.",
      state: summary.walletConnected ? "Signer ready" : "Wallet required",
      tone: summary.walletConnected ? "positive" : "warning",
      stripPct: summary.walletConnected ? 78 : 20,
    },
    {
      id: "tier-rank",
      label: "Current tier",
      value: summary.label,
      meta: `Target manager ${summary.targetLabel}.`,
      state: unlockedCount > 0 ? "Ranked" : "Unranked",
      tone: unlockedCount > 0 ? "positive" : "warning",
      stripPct: Math.max(22, unlockedCount * 28),
    },
    {
      id: "tier-thresholds",
      label: "Threshold ladder",
      value: summary.thresholdsLabel,
      meta: "Live thresholds read from the manager-tier contract.",
      state: summary.thresholdsLabel === "n/a" ? "Unavailable" : "Policy live",
      tone: summary.thresholdsLabel === "n/a" ? "warning" : "neutral",
      stripPct: summary.thresholdsLabel === "n/a" ? 24 : 68,
    },
    {
      id: "tier-next-step",
      label: "Next step",
      value: summary.nextStep,
      meta: "The next milestone the current manager target needs to reach.",
      state: "Progression",
      tone: "neutral",
      stripPct: 72,
    },
  ];
}

export function buildTierActionSpotlights(input: {
  walletConnected: boolean;
  canAct: boolean;
  targetLabel: string;
  deltaLabel: string;
  status: string;
}): LiveOpsSpotlight[] {
  return [
    {
      id: "tier-action-wallet",
      label: "Signer",
      value: input.walletConnected ? "Connected" : "Missing",
      meta: "Governed updates require a connected wallet before any score mutation can be submitted.",
      state: input.canAct ? "Submission ready" : "Signer required",
      tone: input.canAct ? "positive" : "warning",
      stripPct: input.canAct ? 80 : 24,
    },
    {
      id: "tier-action-target",
      label: "Target manager",
      value: input.targetLabel,
      meta: "Current manager address selected for the governed points workflow.",
      state: "Target live",
      tone: "neutral",
      stripPct: 72,
    },
    {
      id: "tier-action-delta",
      label: "Points delta",
      value: input.deltaLabel,
      meta: "Proposed score delta that will be submitted through the manager-tier contract.",
      state: input.status || "Awaiting submit",
      tone: input.status ? "positive" : "neutral",
      stripPct: input.status ? 76 : 42,
    },
  ];
}

export function buildArkasIndexSpotlights(input: {
  recentCount: number;
  registryCount: number;
  registryState?: ArkaRegistryLookupState;
  showAll: boolean;
  activeId: string;
}): LiveOpsSpotlight[] {
  const registryState =
    input.registryState ?? (input.registryCount > 0 ? "ready" : "empty");
  const registryLookup = describeRegistryLookup({
    registryCount: input.registryCount,
    registryState,
    showAll: input.showAll,
  });
  const normalizedActiveId = normalizeArkaContractInput(input.activeId);
  const activeIdValid = isValidArkaContractId(normalizedActiveId);

  return [
    {
      id: "arkas-recent",
      label: "Recent activity",
      value: String(input.recentCount),
      meta: "Arkas opened most recently from action pages.",
      state: input.recentCount > 0 ? "Recently used" : "No recent opens",
      tone: input.recentCount > 0 ? "positive" : "neutral",
      stripPct: input.recentCount > 0 ? 74 : 18,
    },
    {
      id: "arkas-registry",
      label: "Available Arkas",
      value: String(input.registryCount),
      ...registryLookup,
    },
    {
      id: "arkas-direct",
      label: "Open Arka",
      value: normalizedActiveId ? formatContractLabel(normalizedActiveId, 8, 6) : "Awaiting address",
      meta: "Use a known Arka address to open the action page.",
      state: activeIdValid ? "Ready to open" : normalizedActiveId ? "Invalid address" : "Address required",
      tone: activeIdValid ? "positive" : "warning",
      stripPct: activeIdValid ? 70 : normalizedActiveId ? 28 : 20,
    },
  ];
}

export function buildArkaFlowSpotlights(input: {
  walletConnected: boolean;
  selectedAsset: string;
  walletBalanceLabel: string;
  shareLabel: string;
}): LiveOpsSpotlight[] {
  return [
    {
      id: "arka-flow-wallet",
      label: "Wallet",
      value: input.walletConnected ? "Connected" : "Watching",
      meta: "Deposit and redeem actions stay in the same execution surface once a wallet is connected.",
      state: input.walletConnected ? "Flow armed" : "Read-only",
      tone: input.walletConnected ? "positive" : "warning",
      stripPct: input.walletConnected ? 82 : 24,
    },
    {
      id: "arka-flow-asset",
      label: "Selected asset",
      value: input.selectedAsset || "Awaiting asset",
      meta: `Current wallet balance ${input.walletBalanceLabel}.`,
      state: input.selectedAsset ? "Input configured" : "Select asset",
      tone: input.selectedAsset ? "neutral" : "warning",
      stripPct: input.selectedAsset ? 66 : 22,
    },
    {
      id: "arka-flow-shares",
      label: "Share exit",
      value: input.shareLabel,
      meta: "Current share balance available for partial or full redeem from the same workspace.",
      state: input.shareLabel === "0.0000000" ? "No shares" : "Redeemable",
      tone: input.shareLabel === "0.0000000" ? "neutral" : "positive",
      stripPct: input.shareLabel === "0.0000000" ? 28 : 74,
    },
  ];
}

export function buildArkaExecutionSpotlights(input: {
  isManager: boolean;
  navLabel: string;
  shareLabel: string;
  protocol: string;
  creditProtocol: string;
  creditRiskBlocked: boolean;
}): LiveOpsSpotlight[] {
  return [
    {
      id: "arka-role",
      label: "Execution role",
      value: input.isManager ? "Manager" : "Participant",
      meta: "Manager-only controls unlock when the connected wallet matches the on-chain manager.",
      state: input.isManager ? "Manager access" : "View only",
      tone: input.isManager ? "positive" : "warning",
      stripPct: input.isManager ? 82 : 24,
    },
    {
      id: "arka-nav",
      label: "Vault value",
      value: input.navLabel,
      meta: "Current reported value for this Arka.",
      state: "Current",
      tone: "neutral",
      stripPct: 68,
    },
    {
      id: "arka-shares",
      label: "Share",
      value: input.shareLabel,
      meta: "Current share balance held by the connected wallet.",
      state: input.shareLabel === "0.0000000" ? "No position" : "Position open",
      tone: input.shareLabel === "0.0000000" ? "neutral" : "positive",
      stripPct: input.shareLabel === "0.0000000" ? 26 : 72,
    },
    {
      id: "arka-credit",
      label: "Credit posture",
      value: `${input.protocol} / ${input.creditProtocol}`,
      meta: "Selected execution and credit protocols inside the action workspace.",
      state: input.creditRiskBlocked ? "Actions paused" : "Available",
      tone: input.creditRiskBlocked ? "warning" : "positive",
      stripPct: input.creditRiskBlocked ? 42 : 76,
    },
  ];
}

export type ArkaStageBar = {
  id: string;
  label: string;
  value: string;
  meta: string;
  widthPct: number;
  accent?: string;
};

export function deriveArkaStageSummary(input: {
  trackedAssets: Array<{ asset: string; label?: string; liquidBalance: number }>;
}): {
  bars: ArkaStageBar[];
} {
  const positiveAssets = input.trackedAssets
    .filter((entry) => entry.asset && entry.liquidBalance > 0)
    .sort((left, right) => right.liquidBalance - left.liquidBalance);
  const visibleAssets =
    positiveAssets.length > 0 ? positiveAssets.slice(0, 4) : input.trackedAssets.slice(0, 4);
  const maxBalance = Math.max(
    1,
    ...visibleAssets.map((entry) => Math.max(0, entry.liquidBalance)),
  );
  const accents = [
    "linear-gradient(90deg, #00e7ff 0%, #57f287 100%)",
    "linear-gradient(90deg, #ff00c8 0%, #8d4dff 100%)",
    "linear-gradient(90deg, #ffe45a 0%, #ff7d5e 100%)",
    "linear-gradient(90deg, #00e7ff 0%, #ff00c8 100%)",
  ];

  const formatCompactAmount = (valueBase: number) => {
    const value = valueBase / 10 ** BASE_DECIMALS;
    const absolute = Math.abs(value);
    return value.toLocaleString("en-US", {
      minimumFractionDigits: 0,
      maximumFractionDigits: absolute > 0 && absolute < 1 ? 7 : 4,
    });
  };

  return {
    bars: visibleAssets.map((entry, index) => ({
      id: entry.asset,
      label: entry.label || formatContractLabel(entry.asset, 10, 6),
      value: formatCompactAmount(entry.liquidBalance),
      meta:
        index === 0
          ? "Largest available balance"
          : "Available in this Arka",
      widthPct: Math.round((Math.max(0, entry.liquidBalance) / maxBalance) * 100),
      accent: accents[index % accents.length],
    })),
  };
}
