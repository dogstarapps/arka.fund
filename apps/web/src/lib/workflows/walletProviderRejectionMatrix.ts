export type WalletProviderFailureScenario =
  | "user_rejected"
  | "provider_disconnected"
  | "malformed_signature"
  | "retry_after_failure"
  | "signing_timeout";

export type WalletWriteLaneId =
  | "create"
  | "deposit"
  | "redeem"
  | "rebalance"
  | "coverage"
  | "governance"
  | "contracts";

export type WalletWriteProfile = "holder" | "manager" | "operator";

export type WalletFailureClassification =
  | WalletProviderFailureScenario
  | "unknown";

export type WalletProviderFailureScenarioDefinition = {
  id: WalletProviderFailureScenario;
  label: string;
  providerSignal: string;
  invariant: string;
};

export type WalletWriteLaneDefinition = {
  id: WalletWriteLaneId;
  label: string;
  route: string;
  role: WalletWriteProfile;
  visibleSurfaceTestIds: readonly string[];
  writeActionTestIds: readonly string[];
  preservedStateTestIds: readonly string[];
  noSubmitGuard: string;
};

export type WalletProviderRejectionMatrixCase = {
  id: `${WalletWriteLaneId}:${WalletProviderFailureScenario}`;
  lane: WalletWriteLaneDefinition;
  scenario: WalletProviderFailureScenarioDefinition;
  expectedOutcome: {
    failClosed: true;
    retryable: boolean;
    preservesFormState: boolean;
    submitsTransaction: false;
  };
};

export type WalletProviderRejectionMatrixSummary = {
  lanes: number;
  scenarios: number;
  cases: number;
  holderLanes: number;
  managerLanes: number;
  operatorLanes: number;
  retryableCases: number;
  failClosedCases: number;
};

export const WALLET_SIGN_TIMEOUT_MS = 30_000;

export const WALLET_PROVIDER_FAILURE_SCENARIOS = [
  {
    id: "user_rejected",
    label: "User rejects signature",
    providerSignal: "Wallet provider returns a rejected/denied/cancelled signature response.",
    invariant: "The write lane stops before submitSignedTx/sendTransaction and keeps the action retryable.",
  },
  {
    id: "provider_disconnected",
    label: "Provider disconnects",
    providerSignal: "Selected provider cannot sign because the extension/session disconnected.",
    invariant: "The lane either falls back to a verified direct signer or fails closed without submitting.",
  },
  {
    id: "malformed_signature",
    label: "Malformed or missing signed XDR",
    providerSignal: "Provider resolves but does not return a non-empty signedTxXdr/string payload.",
    invariant: "The lane treats the response as terminal and never falls through to a different signer silently.",
  },
  {
    id: "retry_after_failure",
    label: "Retry after failed signing",
    providerSignal: "The user retries the same form after a rejected or failed signature attempt.",
    invariant: "The form state is preserved and a second attempt rebuilds/signs from the same explicit inputs.",
  },
  {
    id: "signing_timeout",
    label: "Signing timeout",
    providerSignal: `No signature is returned within ${WALLET_SIGN_TIMEOUT_MS / 1000} seconds.`,
    invariant: "The pending state clears, the lane reports timeout, and no transaction is submitted.",
  },
] as const satisfies readonly WalletProviderFailureScenarioDefinition[];

export const WALLET_WRITE_LANES = [
  {
    id: "create",
    label: "Create Arka",
    route: "/factory/create",
    role: "holder",
    visibleSurfaceTestIds: [
      "create-stepper-rail",
      "create-arka-denomination-panel",
      "create-review-panel",
    ],
    writeActionTestIds: ["create-arka-submit-button", "create-arka-confirm-button"],
    preservedStateTestIds: [
      "create-arka-review-card",
      "create-stage-active-title",
      "create-arka-wallet",
    ],
    noSubmitGuard: "create-arka-status must remain absent and submit must not run until a signed deployment XDR exists.",
  },
  {
    id: "deposit",
    label: "Arka deposit",
    route: "/arkas/[id]",
    role: "holder",
    visibleSurfaceTestIds: ["arka-stage-panel", "arka-workspace-tab-flow"],
    writeActionTestIds: ["arka-deposit-button"],
    preservedStateTestIds: ["arka-asset-select", "arka-amount-input"],
    noSubmitGuard: "buildArkaDeposit/sendTransaction must not run after approval signature rejection.",
  },
  {
    id: "redeem",
    label: "Arka redeem",
    route: "/arkas/[id]",
    role: "holder",
    visibleSurfaceTestIds: ["arka-stage-panel", "arka-workspace-tab-flow"],
    writeActionTestIds: ["arka-redeem-button", "arka-redeem-all-button"],
    preservedStateTestIds: ["arka-amount-input", "arka-my-shares"],
    noSubmitGuard: "sendTransaction must not run when the redeem signature is missing or rejected.",
  },
  {
    id: "rebalance",
    label: "Manager rebalance",
    route: "/arkas/[id]",
    role: "manager",
    visibleSurfaceTestIds: ["arka-stage-panel", "arka-workspace-tab-rebalance"],
    writeActionTestIds: ["rebalance-run-button"],
    preservedStateTestIds: [
      "rebalance-protocol-select",
      "rebalance-asset-in-select",
      "rebalance-asset-out-select",
      "rebalance-amount-input",
    ],
    noSubmitGuard: "Swap/deposit continuation must not run after approval or swap signer failure.",
  },
  {
    id: "coverage",
    label: "Coverage stake/unstake/claim",
    route: "/coverage",
    role: "holder",
    visibleSurfaceTestIds: ["coverage-workspace-tabs", "coverage-actions-panel"],
    writeActionTestIds: [
      "coverage-stake-button",
      "coverage-unstake-button",
      "coverage-claim-button",
    ],
    preservedStateTestIds: ["coverage-stake-input", "coverage-unstake-input"],
    noSubmitGuard: "Coverage fund approval/action XDRs must not submit after signer failure.",
  },
  {
    id: "governance",
    label: "Governance proposal vote/execute",
    route: "/governance",
    role: "manager",
    visibleSurfaceTestIds: ["governance-public-vote-panel", "governance-vote-button"],
    writeActionTestIds: ["governance-vote-button", "governance-confirm-button"],
    preservedStateTestIds: ["governance-support-select", "governance-proposal-id-input"],
    noSubmitGuard: "Governor vote/close/execute calls must not submit when signer fails.",
  },
  {
    id: "contracts",
    label: "Contracts raw/preset write",
    route: "/contracts",
    role: "operator",
    visibleSurfaceTestIds: ["contracts-preset-panel", "contracts-raw-panel"],
    writeActionTestIds: [
      "contracts-run-preset-button",
      "contracts-raw-write-button",
      "contracts-confirm-button",
    ],
    preservedStateTestIds: [
      "contracts-raw-contract-input",
      "contracts-raw-method-input",
      "contracts-raw-args-input",
    ],
    noSubmitGuard: "Raw or preset writes must not submit after missing/malformed wallet signature.",
  },
] as const satisfies readonly WalletWriteLaneDefinition[];

export function describeWalletError(error: unknown): string {
  if (error instanceof Error && error.message) return error.message;
  if (typeof error === "string" && error.trim()) return error;
  return "unknown wallet error";
}

export function classifyWalletProviderFailure(
  error: unknown,
): WalletFailureClassification {
  const message = describeWalletError(error);
  if (/timeout|timed out/i.test(message)) return "signing_timeout";
  if (/reject|rejected|denied|declined|cancel|cancelled|canceled/i.test(message)) {
    return "user_rejected";
  }
  if (/disconnect|not connected|not available|unavailable|provider missing/i.test(message)) {
    return "provider_disconnected";
  }
  if (/malformed|missing|empty|invalid signed|signature missing|signedtxxdr/i.test(message)) {
    return "malformed_signature";
  }
  return "unknown";
}

export function extractSignedTransactionXdr(response: unknown): string | null {
  if (typeof response === "string" && response.trim()) return response;
  if (response && typeof response === "object") {
    const signedTxXdr = (response as { signedTxXdr?: unknown }).signedTxXdr;
    if (typeof signedTxXdr === "string" && signedTxXdr.trim()) return signedTxXdr;
  }
  return null;
}

export function requireSignedTransactionXdr(response: unknown, source: string): string {
  const signed = extractSignedTransactionXdr(response);
  if (signed) return signed;
  throw new Error(`${source} signature missing`);
}

export function isTerminalWalletProviderFailure(error: unknown): boolean {
  const classification = classifyWalletProviderFailure(error);
  return (
    classification === "user_rejected" ||
    classification === "malformed_signature" ||
    classification === "signing_timeout"
  );
}

export async function withWalletSigningTimeout<T>(
  promise: Promise<T>,
  timeoutMs = WALLET_SIGN_TIMEOUT_MS,
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | null = null;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timer = setTimeout(() => {
          reject(new Error(`Wallet signing timed out after ${timeoutMs}ms`));
        }, timeoutMs);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export function buildWalletProviderRejectionMatrix(): WalletProviderRejectionMatrixCase[] {
  return WALLET_WRITE_LANES.flatMap((lane) =>
    WALLET_PROVIDER_FAILURE_SCENARIOS.map((scenario) => ({
      id: `${lane.id}:${scenario.id}` as const,
      lane,
      scenario,
      expectedOutcome: {
        failClosed: true,
        retryable: scenario.id !== "signing_timeout",
        preservesFormState: true,
        submitsTransaction: false,
      },
    })),
  );
}

export function summarizeWalletProviderRejectionMatrix(
  cases = buildWalletProviderRejectionMatrix(),
): WalletProviderRejectionMatrixSummary {
  const laneIds = new Set(cases.map((entry) => entry.lane.id));
  const scenarioIds = new Set(cases.map((entry) => entry.scenario.id));
  return {
    lanes: laneIds.size,
    scenarios: scenarioIds.size,
    cases: cases.length,
    holderLanes: WALLET_WRITE_LANES.filter((lane) => lane.role === "holder").length,
    managerLanes: WALLET_WRITE_LANES.filter((lane) => lane.role === "manager").length,
    operatorLanes: WALLET_WRITE_LANES.filter((lane) => lane.role === "operator").length,
    retryableCases: cases.filter((entry) => entry.expectedOutcome.retryable).length,
    failClosedCases: cases.filter((entry) => entry.expectedOutcome.failClosed).length,
  };
}

export function validateWalletProviderRejectionMatrix(
  cases = buildWalletProviderRejectionMatrix(),
): { ok: true; summary: WalletProviderRejectionMatrixSummary } {
  const missing: string[] = [];
  for (const lane of WALLET_WRITE_LANES) {
    for (const scenario of WALLET_PROVIDER_FAILURE_SCENARIOS) {
      const id = `${lane.id}:${scenario.id}`;
      if (!cases.some((entry) => entry.id === id)) missing.push(id);
    }
    if (Array.from(lane.writeActionTestIds).length === 0) {
      missing.push(`${lane.id}:writeActionTestIds`);
    }
    if (Array.from(lane.preservedStateTestIds).length === 0) {
      missing.push(`${lane.id}:preservedStateTestIds`);
    }
  }
  if (missing.length > 0) {
    throw new Error(`Wallet provider rejection matrix is incomplete: ${missing.join(", ")}`);
  }
  const summary = summarizeWalletProviderRejectionMatrix(cases);
  if (summary.cases !== WALLET_WRITE_LANES.length * WALLET_PROVIDER_FAILURE_SCENARIOS.length) {
    throw new Error(
      `Wallet provider rejection matrix size mismatch: ${summary.cases} cases`,
    );
  }
  if (summary.holderLanes < 3 || summary.managerLanes < 2 || summary.operatorLanes < 1) {
    throw new Error("Wallet provider rejection matrix must cover holder, manager and operator lanes");
  }
  return { ok: true, summary };
}
