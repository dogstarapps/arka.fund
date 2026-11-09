import {
  listBalancedSodaxStellarTokens,
  requestBalancedSodaxConfirm,
  requestBalancedSodaxExpiry,
  requestBalancedSodaxIntentBuild,
  requestBalancedSodaxLifecycle,
  requestBalancedSodaxQuote,
  requestBalancedSodaxRelaySubmit,
  requestBalancedSodaxReceipt,
  requestBalancedSodaxRefund,
  requestBalancedSodaxStatus,
  requestBalancedSodaxSubmit,
  type BalancedSodaxConfirmResult,
  type BalancedSodaxExpiryResult,
  type BalancedSodaxIntentBuildResult,
  type BalancedSodaxIntentLifecycleResult,
  type BalancedSodaxIntentSnapshot,
  type BalancedSodaxQuoteResult,
  type BalancedSodaxRelaySubmitResult,
  type BalancedSodaxReceiptResult,
  type BalancedSodaxRefundBuildResult,
  type BalancedSodaxStatusResult,
  type BalancedSodaxSubmitResult,
  type BalancedSodaxToken,
} from "@/lib/server/balancedSodax";

export class BalancedIntentSurfaceValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BalancedIntentSurfaceValidationError";
  }
}

function normalizeAddress(input: unknown, label: string): string {
  if (typeof input !== "string" || input.trim().length === 0) {
    throw new BalancedIntentSurfaceValidationError(`${label} is required.`);
  }
  return input.trim();
}

function normalizeStellarAccount(input: unknown, label: string): string {
  const value = normalizeAddress(input, label);
  if (!/^G[A-Z2-7]{55}$/.test(value)) {
    throw new BalancedIntentSurfaceValidationError(
      `${label} must be a Stellar public account address.`,
    );
  }
  return value;
}

function normalizePositiveIntegerString(input: unknown, label: string): string {
  const value = typeof input === "number" ? String(Math.trunc(input)) : String(input ?? "").trim();
  if (!/^\d+$/.test(value) || value === "0") {
    throw new BalancedIntentSurfaceValidationError(
      `${label} must be a positive integer string.`,
    );
  }
  return value;
}

function normalizeOptionalPositiveIntegerNumber(
  input: unknown,
  label: string,
): number | undefined {
  if (input === undefined || input === null || input === "") {
    return undefined;
  }
  const value = typeof input === "number" ? input : Number(String(input).trim());
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new BalancedIntentSurfaceValidationError(
      `${label} must be a positive integer.`,
    );
  }
  return value;
}

function normalizeOptionalBoolean(input: unknown, label: string): boolean | undefined {
  if (input === undefined || input === null || input === "") {
    return undefined;
  }
  if (typeof input === "boolean") {
    return input;
  }
  if (input === "true") {
    return true;
  }
  if (input === "false") {
    return false;
  }
  throw new BalancedIntentSurfaceValidationError(`${label} must be a boolean.`);
}

function normalizeIntentTxHash(input: unknown): string {
  if (typeof input !== "string" || input.trim().length === 0) {
    throw new BalancedIntentSurfaceValidationError("intentTxHash is required.");
  }
  const normalized = input.trim();
  if (!/^0x[a-fA-F0-9]{8,}$/.test(normalized)) {
    throw new BalancedIntentSurfaceValidationError(
      "intentTxHash must be a 0x-prefixed hex hash.",
    );
  }
  return normalized;
}

function normalizeOptionalIntentTxHash(input: unknown): string | undefined {
  if (input === undefined || input === null || input === "") {
    return undefined;
  }
  return normalizeIntentTxHash(input);
}

function normalizeSourceTxHash(input: unknown): string {
  if (typeof input !== "string" || input.trim().length === 0) {
    throw new BalancedIntentSurfaceValidationError("sourceTxHash is required.");
  }
  const normalized = input.trim();
  if (!/^(0x)?[a-fA-F0-9]{16,}$/.test(normalized)) {
    throw new BalancedIntentSurfaceValidationError(
      "sourceTxHash must be a hex transaction hash.",
    );
  }
  return normalized;
}

function readStringField(
  input: Record<string, unknown>,
  key: keyof BalancedSodaxIntentSnapshot,
): string {
  const value = input[key];
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new BalancedIntentSurfaceValidationError(`intent.${String(key)} is required.`);
  }
  return value.trim();
}

function normalizeIntentSnapshot(
  input: unknown,
): BalancedSodaxIntentSnapshot | undefined {
  if (input === undefined || input === null || input === "") {
    return undefined;
  }
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new BalancedIntentSurfaceValidationError("intent must be a JSON object.");
  }
  const record = input as Record<string, unknown>;
  if (typeof record.allowPartialFill !== "boolean") {
    throw new BalancedIntentSurfaceValidationError(
      "intent.allowPartialFill must be a boolean.",
    );
  }
  const feeAmountBase =
    typeof record.feeAmountBase === "string" && record.feeAmountBase.trim().length > 0
      ? record.feeAmountBase.trim()
      : null;
  const intentHash =
    typeof record.intentHash === "string" && record.intentHash.trim().length > 0
      ? record.intentHash.trim()
      : null;

  return {
    intentId: readStringField(record, "intentId"),
    creator: readStringField(record, "creator"),
    inputToken: readStringField(record, "inputToken"),
    outputToken: readStringField(record, "outputToken"),
    inputAmountBase: normalizePositiveIntegerString(
      record.inputAmountBase,
      "intent.inputAmountBase",
    ),
    minOutputAmountBase: normalizePositiveIntegerString(
      record.minOutputAmountBase,
      "intent.minOutputAmountBase",
    ),
    deadlineUnixSeconds: readStringField(record, "deadlineUnixSeconds"),
    allowPartialFill: record.allowPartialFill,
    srcChain: readStringField(record, "srcChain"),
    dstChain: readStringField(record, "dstChain"),
    srcAddress: readStringField(record, "srcAddress"),
    dstAddress: readStringField(record, "dstAddress"),
    solver: readStringField(record, "solver"),
    data: readStringField(record, "data"),
    feeAmountBase,
    intentHash,
  };
}

export async function listBalancedIntentSurfaceTokens(): Promise<BalancedSodaxToken[]> {
  return listBalancedSodaxStellarTokens();
}

export async function requestBalancedIntentSurfaceQuote(input: {
  tokenIn?: unknown;
  tokenOut?: unknown;
  amountInBase?: unknown;
}): Promise<BalancedSodaxQuoteResult> {
  const tokenIn = normalizeAddress(input.tokenIn, "tokenIn");
  const tokenOut = normalizeAddress(input.tokenOut, "tokenOut");
  const amountInBase = normalizePositiveIntegerString(input.amountInBase, "amountInBase");
  return requestBalancedSodaxQuote({
    tokenIn,
    tokenOut,
    amountInBase,
  });
}

export async function requestBalancedIntentSurfaceBuild(input: {
  tokenIn?: unknown;
  tokenOut?: unknown;
  amountInBase?: unknown;
  minOutputAmountBase?: unknown;
  sourceAccount?: unknown;
  destinationAccount?: unknown;
  deadlineSeconds?: unknown;
  allowPartialFill?: unknown;
  skipSimulation?: unknown;
}): Promise<BalancedSodaxIntentBuildResult> {
  const buildInput: Parameters<typeof requestBalancedSodaxIntentBuild>[0] = {
    tokenIn: normalizeAddress(input.tokenIn, "tokenIn"),
    tokenOut: normalizeAddress(input.tokenOut, "tokenOut"),
    amountInBase: normalizePositiveIntegerString(input.amountInBase, "amountInBase"),
    minOutputAmountBase: normalizePositiveIntegerString(
      input.minOutputAmountBase,
      "minOutputAmountBase",
    ),
    sourceAccount: normalizeStellarAccount(input.sourceAccount, "sourceAccount"),
    destinationAccount: normalizeStellarAccount(
      input.destinationAccount,
      "destinationAccount",
    ),
  };
  const deadlineSeconds = normalizeOptionalPositiveIntegerNumber(
    input.deadlineSeconds,
    "deadlineSeconds",
  );
  const allowPartialFill = normalizeOptionalBoolean(
    input.allowPartialFill,
    "allowPartialFill",
  );
  const skipSimulation = normalizeOptionalBoolean(input.skipSimulation, "skipSimulation");
  if (deadlineSeconds !== undefined) {
    buildInput.deadlineSeconds = deadlineSeconds;
  }
  if (allowPartialFill !== undefined) {
    buildInput.allowPartialFill = allowPartialFill;
  }
  if (skipSimulation !== undefined) {
    buildInput.skipSimulation = skipSimulation;
  }
  return requestBalancedSodaxIntentBuild(buildInput);
}

export async function requestBalancedIntentSurfaceSubmit(input: {
  intentTxHash?: unknown;
}): Promise<BalancedSodaxSubmitResult> {
  const intentTxHash = normalizeIntentTxHash(input.intentTxHash);
  return requestBalancedSodaxSubmit({ intentTxHash });
}

export async function requestBalancedIntentSurfaceRelay(input: {
  sourceTxHash?: unknown;
}): Promise<BalancedSodaxRelaySubmitResult> {
  const sourceTxHash = normalizeSourceTxHash(input.sourceTxHash);
  return requestBalancedSodaxRelaySubmit({ sourceTxHash });
}

export async function requestBalancedIntentSurfaceStatus(input: {
  intentTxHash?: unknown;
}): Promise<BalancedSodaxStatusResult> {
  const intentTxHash = normalizeIntentTxHash(input.intentTxHash);
  return requestBalancedSodaxStatus(intentTxHash);
}

export async function requestBalancedIntentSurfaceConfirm(input: {
  intentTxHash?: unknown;
}): Promise<BalancedSodaxConfirmResult> {
  const intentTxHash = normalizeIntentTxHash(input.intentTxHash);
  return requestBalancedSodaxConfirm(intentTxHash);
}

export async function requestBalancedIntentSurfaceReceipt(input: {
  intentTxHash?: unknown;
  packetTimeoutMs?: unknown;
}): Promise<BalancedSodaxReceiptResult> {
  const options: Parameters<typeof requestBalancedSodaxReceipt>[1] = {};
  const packetTimeoutMs = normalizeOptionalPositiveIntegerNumber(
    input.packetTimeoutMs,
    "packetTimeoutMs",
  );
  if (packetTimeoutMs !== undefined) {
    options.packetTimeoutMs = packetTimeoutMs;
  }
  return requestBalancedSodaxReceipt(normalizeIntentTxHash(input.intentTxHash), options);
}

export async function requestBalancedIntentSurfaceExpiry(input: {
  intentTxHash?: unknown;
  intent?: unknown;
}): Promise<BalancedSodaxExpiryResult> {
  const expiryInput: Parameters<typeof requestBalancedSodaxExpiry>[0] = {};
  const intentTxHash = normalizeOptionalIntentTxHash(input.intentTxHash);
  const intent = normalizeIntentSnapshot(input.intent);
  if (intentTxHash !== undefined) {
    expiryInput.intentTxHash = intentTxHash;
  }
  if (intent !== undefined) {
    expiryInput.intent = intent;
  }
  return requestBalancedSodaxExpiry(expiryInput);
}

export async function requestBalancedIntentSurfaceRefund(input: {
  sourceAccount?: unknown;
  intentTxHash?: unknown;
  intent?: unknown;
}): Promise<BalancedSodaxRefundBuildResult> {
  const intentTxHash = normalizeOptionalIntentTxHash(input.intentTxHash);
  const intent = normalizeIntentSnapshot(input.intent);
  if (!intentTxHash && !intent) {
    throw new BalancedIntentSurfaceValidationError(
      "intentTxHash or intent is required.",
    );
  }
  const refundInput: Parameters<typeof requestBalancedSodaxRefund>[0] = {
    sourceAccount: normalizeStellarAccount(input.sourceAccount, "sourceAccount"),
  };
  if (intentTxHash !== undefined) {
    refundInput.intentTxHash = intentTxHash;
  }
  if (intent !== undefined) {
    refundInput.intent = intent;
  }
  return requestBalancedSodaxRefund(refundInput);
}

export async function requestBalancedIntentSurfaceLifecycle(input: {
  intentTxHash?: unknown;
}): Promise<BalancedSodaxIntentLifecycleResult> {
  const intentTxHash = normalizeIntentTxHash(input.intentTxHash);
  return requestBalancedSodaxLifecycle(intentTxHash);
}
