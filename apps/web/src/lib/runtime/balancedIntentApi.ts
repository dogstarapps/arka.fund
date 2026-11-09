export type BalancedIntentCatalogToken = {
  symbol: string;
  name: string;
  decimals: number;
  address: string;
  chainId: "stellar";
};

export type BalancedIntentCatalogResponse = {
  provider: "sodax_sdk";
  chainId: "stellar";
  tokens: BalancedIntentCatalogToken[];
};

export type BalancedIntentQuoteSuccess = {
  ok: true;
  provider: "sodax_sdk";
  tokenIn: BalancedIntentCatalogToken;
  tokenOut: BalancedIntentCatalogToken;
  amountInBase: string;
  quotedAmountBase: string;
  quoteType: "exact_input";
};

export type BalancedIntentQuoteFailure = {
  ok: false;
  provider: "sodax_sdk";
  tokenIn: BalancedIntentCatalogToken;
  tokenOut: BalancedIntentCatalogToken;
  amountInBase: string;
  code: number;
  message: string;
  quoteType: "exact_input";
};

export type BalancedIntentStatusSuccess = {
  ok: true;
  provider: "sodax_sdk";
  intentTxHash: string;
  statusCode: number;
  statusLabel: string;
  fillTxHash: string | null;
  terminal: boolean;
};

export type BalancedIntentStatusFailure = {
  ok: false;
  provider: "sodax_sdk";
  intentTxHash: string;
  code: number;
  message: string;
};

export type BalancedIntentConfirmSuccess = {
  ok: true;
  provider: "sodax_sdk";
  intentTxHash: string;
  statusCode: number;
  statusLabel: string;
  terminal: boolean;
  fillTxHash: string | null;
  confirmationTxHash: string | null;
  confirmed: boolean;
  confirmationState: "pending" | "confirmed" | "failed" | "not_found";
  detail: string;
};

export type BalancedIntentConfirmFailure = {
  ok: false;
  provider: "sodax_sdk";
  intentTxHash: string;
  code: number;
  message: string;
};

export type BalancedIntentRawTransaction = {
  from: string;
  to: string;
  valueBase: string;
  xdr: string;
};

export type BalancedIntentSnapshot = {
  intentId: string;
  creator: string;
  inputToken: string;
  outputToken: string;
  inputAmountBase: string;
  minOutputAmountBase: string;
  deadlineUnixSeconds: string;
  allowPartialFill: boolean;
  srcChain: string;
  dstChain: string;
  srcAddress: string;
  dstAddress: string;
  solver: string;
  data: string;
  feeAmountBase: string | null;
  intentHash: string | null;
};

export type BalancedIntentExpirySnapshot = {
  deadlineUnixSeconds: string | null;
  expiresAt: string | null;
  expired: boolean;
  secondsUntilExpiry: number | null;
  cancellationWindowSeconds: number;
  source: "intent_deadline" | "requested_deadline" | "unknown";
  detail: string;
};

export type BalancedIntentRefundSnapshot = {
  refundMode:
    | "none"
    | "cancel_intent"
    | "failed_intent_recovery"
    | "not_visible";
  refundRequired: boolean;
  refundAvailable: boolean;
  refundRecipient: string | null;
  cancelRequiresIntent: boolean;
  detail: string;
};

export type BalancedIntentReceiptSnapshot = {
  receiptState: "pending" | "settled" | "failed" | "not_found";
  intentTxHash: string;
  statusLabel: string;
  terminal: boolean;
  fillTxHash: string | null;
  confirmationTxHash: string | null;
  packet: {
    srcChainId: string;
    srcTxHash: string;
    dstChainId: string;
    dstTxHash: string | null;
    connectionSequence: string | null;
    status: string;
  } | null;
  detail: string;
};

export type BalancedIntentRelayPacketSnapshot = {
  srcChainId: string;
  srcTxHash: string;
  srcAddress: string;
  status: string;
  dstChainId: string;
  connectionSequence: string;
  dstAddress: string;
  dstTxHash: string | null;
};

export type BalancedIntentBuildResult =
  | {
      ok: true;
      provider: "sodax_sdk";
      tokenIn: BalancedIntentCatalogToken;
      tokenOut: BalancedIntentCatalogToken;
      amountInBase: string;
      minOutputAmountBase: string;
      sourceAccount: string;
      destinationAccount: string;
      deadlineSeconds: number;
      allowPartialFill: boolean;
      rawTransaction: BalancedIntentRawTransaction;
      intent: BalancedIntentSnapshot;
      intentData: string;
      expiry: BalancedIntentExpirySnapshot;
      refund: BalancedIntentRefundSnapshot;
    }
  | {
      ok: false;
      provider: "sodax_sdk";
      tokenIn: BalancedIntentCatalogToken;
      tokenOut: BalancedIntentCatalogToken;
      amountInBase: string;
      minOutputAmountBase: string;
      sourceAccount: string;
      destinationAccount: string;
      code: number;
      message: string;
    };

export type BalancedIntentSubmitResult =
  | {
      ok: true;
      provider: "sodax_sdk";
      intentTxHash: string;
      answer: "OK";
      solverIntentHash: string;
      detail: string;
    }
  | BalancedIntentStatusFailure;

export type BalancedIntentReceiptResult =
  | {
      ok: true;
      provider: "sodax_sdk";
      receipt: BalancedIntentReceiptSnapshot;
      refund: BalancedIntentRefundSnapshot;
      expiry: BalancedIntentExpirySnapshot;
    }
  | BalancedIntentStatusFailure;

export type BalancedIntentExpiryResult =
  | {
      ok: true;
      provider: "sodax_sdk";
      intentTxHash: string | null;
      intent: BalancedIntentSnapshot | null;
      expiry: BalancedIntentExpirySnapshot;
    }
  | {
      ok: false;
      provider: "sodax_sdk";
      intentTxHash: string | null;
      code: number;
      message: string;
    };

export type BalancedIntentRelayResult =
  | {
      ok: true;
      provider: "sodax_sdk";
      sourceTxHash: string;
      relayChainId: string;
      success: boolean;
      message: string;
      canonicalIntentTxHash: string | null;
      canonicalIntentPacket: BalancedIntentRelayPacketSnapshot | null;
      packets: BalancedIntentRelayPacketSnapshot[];
      detail: string;
    }
  | {
      ok: false;
      provider: "sodax_sdk";
      sourceTxHash: string;
      relayChainId: string;
      code: number;
      message: string;
    };

export type BalancedIntentRefundResult =
  | {
      ok: true;
      provider: "sodax_sdk";
      sourceAccount: string;
      intentTxHash: string | null;
      rawTransaction: BalancedIntentRawTransaction;
      intent: BalancedIntentSnapshot;
      refund: BalancedIntentRefundSnapshot;
      expiry: BalancedIntentExpirySnapshot;
    }
  | {
      ok: false;
      provider: "sodax_sdk";
      sourceAccount: string;
      intentTxHash: string | null;
      code: number;
      message: string;
    };

type FetchLike = typeof fetch;

async function readJsonResponse<T>(response: Response, fallbackMessage: string): Promise<T> {
  const payload = (await response.json().catch(() => null)) as
    | (T & { error?: string })
    | { error?: string }
    | null;

  if (!response.ok) {
    throw new Error(
      payload && typeof payload === "object" && "error" in payload && typeof payload.error === "string"
        ? payload.error
        : fallbackMessage,
    );
  }

  return payload as T;
}

export async function loadBalancedIntentTokenCatalog(
  fetchImpl: FetchLike = fetch,
): Promise<BalancedIntentCatalogResponse> {
  const response = await fetchImpl("/api/intents/balanced/quote", {
    method: "GET",
    cache: "no-store",
  });
  return readJsonResponse<BalancedIntentCatalogResponse>(
    response,
    "Failed to load SODAX token catalog.",
  );
}

export async function requestBalancedIntentQuote(
  input: {
    tokenIn: string;
    tokenOut: string;
    amountInBase: string;
  },
  fetchImpl: FetchLike = fetch,
): Promise<BalancedIntentQuoteSuccess | BalancedIntentQuoteFailure> {
  const response = await fetchImpl("/api/intents/balanced/quote", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input),
  });
  return readJsonResponse<BalancedIntentQuoteSuccess | BalancedIntentQuoteFailure>(
    response,
    "Failed to request SODAX quote.",
  );
}

export async function requestBalancedIntentBuild(
  input: {
    tokenIn: string;
    tokenOut: string;
    amountInBase: string;
    minOutputAmountBase: string;
    sourceAccount: string;
    destinationAccount: string;
    deadlineSeconds?: number;
    allowPartialFill?: boolean;
    skipSimulation?: boolean;
  },
  fetchImpl: FetchLike = fetch,
): Promise<BalancedIntentBuildResult> {
  const response = await fetchImpl("/api/intents/balanced/build", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input),
  });
  return readJsonResponse<BalancedIntentBuildResult>(
    response,
    "Failed to build SODAX intent.",
  );
}

export async function requestBalancedIntentSubmit(
  input: {
    intentTxHash: string;
  },
  fetchImpl: FetchLike = fetch,
): Promise<BalancedIntentSubmitResult> {
  const response = await fetchImpl("/api/intents/balanced/submit", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input),
  });
  return readJsonResponse<BalancedIntentSubmitResult>(
    response,
    "Failed to submit SODAX intent.",
  );
}

export async function requestBalancedIntentRelay(
  input: {
    sourceTxHash: string;
  },
  fetchImpl: FetchLike = fetch,
): Promise<BalancedIntentRelayResult> {
  const response = await fetchImpl("/api/intents/balanced/relay", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input),
  });
  return readJsonResponse<BalancedIntentRelayResult>(
    response,
    "Failed to relay SODAX source transaction hash.",
  );
}

export async function requestBalancedIntentStatus(
  input: {
    intentTxHash: string;
  },
  fetchImpl: FetchLike = fetch,
): Promise<BalancedIntentStatusSuccess | BalancedIntentStatusFailure> {
  const response = await fetchImpl("/api/intents/balanced/status", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input),
  });
  return readJsonResponse<BalancedIntentStatusSuccess | BalancedIntentStatusFailure>(
    response,
    "Failed to request SODAX intent status.",
  );
}

export async function requestBalancedIntentConfirm(
  input: {
    intentTxHash: string;
  },
  fetchImpl: FetchLike = fetch,
): Promise<BalancedIntentConfirmSuccess | BalancedIntentConfirmFailure> {
  const response = await fetchImpl("/api/intents/balanced/confirm", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input),
  });
  return readJsonResponse<BalancedIntentConfirmSuccess | BalancedIntentConfirmFailure>(
    response,
    "Failed to request SODAX confirmation.",
  );
}

export async function requestBalancedIntentReceipt(
  input: {
    intentTxHash: string;
    packetTimeoutMs?: number;
  },
  fetchImpl: FetchLike = fetch,
): Promise<BalancedIntentReceiptResult> {
  const response = await fetchImpl("/api/intents/balanced/receipt", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input),
  });
  return readJsonResponse<BalancedIntentReceiptResult>(
    response,
    "Failed to request SODAX receipt.",
  );
}

export async function requestBalancedIntentExpiry(
  input: {
    intentTxHash?: string;
    intent?: BalancedIntentSnapshot;
  },
  fetchImpl: FetchLike = fetch,
): Promise<BalancedIntentExpiryResult> {
  const response = await fetchImpl("/api/intents/balanced/expiry", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input),
  });
  return readJsonResponse<BalancedIntentExpiryResult>(
    response,
    "Failed to request SODAX expiry.",
  );
}

export async function requestBalancedIntentRefund(
  input: {
    sourceAccount: string;
    intentTxHash?: string;
    intent?: BalancedIntentSnapshot;
  },
  fetchImpl: FetchLike = fetch,
): Promise<BalancedIntentRefundResult> {
  const response = await fetchImpl("/api/intents/balanced/refund", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input),
  });
  return readJsonResponse<BalancedIntentRefundResult>(
    response,
    "Failed to build SODAX refund.",
  );
}
