import "server-only";

import {
  getIntentRelayChainId,
  getTransactionPackets,
  Sodax,
  SolverIntentStatusCode,
  StellarRawSpokeProvider,
  type CreateIntentParams,
  type Intent,
  type PacketData,
  type SolverExecutionResponse,
  type Token,
} from "@/lib/server/sodaxStellarTransport";
import { TransactionBuilder, rpc } from "@stellar/stellar-sdk";

const SODAX_STELLAR_CHAIN_ID = "stellar";
const SODAX_STELLAR_NETWORK_PASSPHRASE =
  "Public Global Stellar Network ; September 2015";
const SODAX_STELLAR_RELAY_CHAIN_ID = String(
  getIntentRelayChainId(
    SODAX_STELLAR_CHAIN_ID as Parameters<typeof getIntentRelayChainId>[0],
  ),
);
const DEFAULT_INTENT_DEADLINE_SECONDS = 300;
const DEFAULT_SOLVED_PACKET_TIMEOUT_MS = 2500;
const DEFAULT_RELAY_PACKET_LOOKUP_TIMEOUT_MS = 15000;
const RELAY_PACKET_LOOKUP_INTERVAL_MS = 1000;
const SODAX_ANY_SOLVER_ADDRESS = "0x0000000000000000000000000000000000000000";

type StellarRawTransactionLike = {
  from: string;
  to: string;
  value: bigint;
  data: string;
};

type StellarChainConfig = ConstructorParameters<typeof StellarRawSpokeProvider>[1];
type StellarChainConfigWithRpc = StellarChainConfig & {
  sorobanRpcUrl?: string;
};

export type BalancedSodaxToken = {
  symbol: string;
  name: string;
  decimals: number;
  address: string;
  chainId: "stellar";
};

export type BalancedSodaxRawTransaction = {
  from: string;
  to: string;
  valueBase: string;
  xdr: string;
};

export type BalancedSodaxIntentSnapshot = {
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

export type BalancedSodaxExpirySnapshot = {
  deadlineUnixSeconds: string | null;
  expiresAt: string | null;
  expired: boolean;
  secondsUntilExpiry: number | null;
  cancellationWindowSeconds: number;
  source: "intent_deadline" | "requested_deadline" | "unknown";
  detail: string;
};

export type BalancedSodaxRefundSnapshot = {
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

export type BalancedSodaxReceiptSnapshot = {
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

export type BalancedSodaxRelayPacketSnapshot = {
  srcChainId: string;
  srcTxHash: string;
  srcAddress: string;
  status: string;
  dstChainId: string;
  connectionSequence: string;
  dstAddress: string;
  dstTxHash: string | null;
};

export type BalancedSodaxQuoteResult =
  | {
      ok: true;
      provider: "sodax_sdk";
      tokenIn: BalancedSodaxToken;
      tokenOut: BalancedSodaxToken;
      amountInBase: string;
      quotedAmountBase: string;
      quoteType: "exact_input";
    }
  | {
      ok: false;
      provider: "sodax_sdk";
      tokenIn: BalancedSodaxToken;
      tokenOut: BalancedSodaxToken;
      amountInBase: string;
      code: number;
      message: string;
      quoteType: "exact_input";
    };

export type BalancedSodaxIntentBuildResult =
  | {
      ok: true;
      provider: "sodax_sdk";
      tokenIn: BalancedSodaxToken;
      tokenOut: BalancedSodaxToken;
      amountInBase: string;
      minOutputAmountBase: string;
      sourceAccount: string;
      destinationAccount: string;
      deadlineSeconds: number;
      allowPartialFill: boolean;
      rawTransaction: BalancedSodaxRawTransaction;
      intent: BalancedSodaxIntentSnapshot;
      intentData: string;
      expiry: BalancedSodaxExpirySnapshot;
      refund: BalancedSodaxRefundSnapshot;
    }
  | {
      ok: false;
      provider: "sodax_sdk";
      tokenIn: BalancedSodaxToken;
      tokenOut: BalancedSodaxToken;
      amountInBase: string;
      minOutputAmountBase: string;
      sourceAccount: string;
      destinationAccount: string;
      code: number;
      message: string;
    };

export type BalancedSodaxStatusResult =
  | {
      ok: true;
      provider: "sodax_sdk";
      intentTxHash: string;
      statusCode: number;
      statusLabel: string;
      fillTxHash: string | null;
      terminal: boolean;
    }
  | {
      ok: false;
      provider: "sodax_sdk";
      intentTxHash: string;
      code: number;
      message: string;
    };

export type BalancedSodaxConfirmResult =
  | {
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
    }
  | {
      ok: false;
      provider: "sodax_sdk";
      intentTxHash: string;
      code: number;
      message: string;
    };

export type BalancedSodaxSubmitResult =
  | {
      ok: true;
      provider: "sodax_sdk";
      intentTxHash: string;
      answer: SolverExecutionResponse["answer"];
      solverIntentHash: string;
      detail: string;
    }
  | {
      ok: false;
      provider: "sodax_sdk";
      intentTxHash: string;
      code: number;
      message: string;
    };

export type BalancedSodaxRelaySubmitResult =
  | {
      ok: true;
      provider: "sodax_sdk";
      sourceTxHash: string;
      relayChainId: string;
      success: boolean;
      message: string;
      canonicalIntentTxHash: string | null;
      canonicalIntentPacket: BalancedSodaxRelayPacketSnapshot | null;
      packets: BalancedSodaxRelayPacketSnapshot[];
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

export type BalancedSodaxReceiptResult =
  | {
      ok: true;
      provider: "sodax_sdk";
      receipt: BalancedSodaxReceiptSnapshot;
      refund: BalancedSodaxRefundSnapshot;
      expiry: BalancedSodaxExpirySnapshot;
    }
  | {
      ok: false;
      provider: "sodax_sdk";
      intentTxHash: string;
      code: number;
      message: string;
    };

export type BalancedSodaxExpiryResult =
  | {
      ok: true;
      provider: "sodax_sdk";
      intentTxHash: string | null;
      intent: BalancedSodaxIntentSnapshot | null;
      expiry: BalancedSodaxExpirySnapshot;
    }
  | {
      ok: false;
      provider: "sodax_sdk";
      intentTxHash: string | null;
      code: number;
      message: string;
    };

export type BalancedSodaxRefundBuildResult =
  | {
      ok: true;
      provider: "sodax_sdk";
      sourceAccount: string;
      intentTxHash: string | null;
      rawTransaction: BalancedSodaxRawTransaction;
      intent: BalancedSodaxIntentSnapshot;
      refund: BalancedSodaxRefundSnapshot;
      expiry: BalancedSodaxExpirySnapshot;
    }
  | {
      ok: false;
      provider: "sodax_sdk";
      sourceAccount: string;
      intentTxHash: string | null;
      code: number;
      message: string;
    };

export type BalancedSodaxIntentLifecycleResult = {
  status: BalancedSodaxStatusResult;
  confirmation: BalancedSodaxConfirmResult;
  receipt: BalancedSodaxReceiptSnapshot | null;
  refund: BalancedSodaxRefundSnapshot;
  expiry: BalancedSodaxExpirySnapshot;
};

let sodaxPromise: Promise<Sodax> | null = null;

function toBalancedToken(token: Token): BalancedSodaxToken {
  return {
    symbol: token.symbol,
    name: token.name,
    decimals: token.decimals,
    address: token.address,
    chainId: "stellar",
  };
}

async function getSodax(): Promise<Sodax> {
  if (!sodaxPromise) {
    sodaxPromise = (async () => {
      const sdk = new Sodax();
      const initialized = await sdk.initialize();
      if (!initialized.ok) {
        throw new Error(initialized.error.detail.message);
      }
      return sdk;
    })();
  }
  return sodaxPromise.catch((error) => {
    sodaxPromise = null;
    throw error;
  });
}

function getStellarChainConfig(sdk: Sodax): StellarChainConfig {
  const config = sdk.config.spokeChainConfig[SODAX_STELLAR_CHAIN_ID];
  if (!config) {
    throw new Error("SODAX SDK did not provide Stellar spoke chain config.");
  }
  return config as StellarChainConfig;
}

function buildStellarRawProvider(
  sdk: Sodax,
  walletAddress: string,
): StellarRawSpokeProvider {
  return new StellarRawSpokeProvider(walletAddress, getStellarChainConfig(sdk));
}

function serializeRawTransaction(
  rawTransaction: StellarRawTransactionLike,
): BalancedSodaxRawTransaction {
  return {
    from: rawTransaction.from,
    to: rawTransaction.to,
    valueBase: rawTransaction.value.toString(),
    xdr: rawTransaction.data,
  };
}

function resolveStellarSorobanRpcUrl(chainConfig: StellarChainConfig): string {
  const configured = (chainConfig as StellarChainConfigWithRpc).sorobanRpcUrl;
  return (
    process.env.SODAX_STELLAR_SOROBAN_RPC_URL ??
    process.env.NEXT_PUBLIC_SOROBAN_RPC_URL ??
    configured ??
    "https://mainnet.sorobanrpc.com"
  );
}

function resolveStellarNetworkPassphrase(): string {
  return (
    process.env.SODAX_STELLAR_NETWORK_PASSPHRASE ??
    process.env.NEXT_PUBLIC_STELLAR_NETWORK ??
    SODAX_STELLAR_NETWORK_PASSPHRASE
  );
}

async function prepareStellarRawTransactionXdr(
  rawXdr: string,
  chainConfig: StellarChainConfig,
): Promise<string> {
  const tx = TransactionBuilder.fromXDR(rawXdr, resolveStellarNetworkPassphrase());
  const server = new rpc.Server(resolveStellarSorobanRpcUrl(chainConfig), {
    allowHttp: true,
  });
  const simulation = await server.simulateTransaction(tx);
  if (rpc.Api.isSimulationError(simulation)) {
    throw new Error(simulation.error || "SODAX transaction simulation failed.");
  }
  return rpc.assembleTransaction(tx, simulation).build().toXDR();
}

function sdkErrorDetail(
  error: unknown,
  fallbackMessage: string,
): { code: number; message: string } {
  const detail =
    error && typeof error === "object" && "detail" in error
      ? (error as { detail?: unknown }).detail
      : null;
  const code =
    detail && typeof detail === "object" && "code" in detail
      ? Number((detail as { code?: unknown }).code)
      : -999;
  const message =
    detail && typeof detail === "object" && "message" in detail
      ? String((detail as { message?: unknown }).message)
      : fallbackMessage;
  return {
    code: Number.isFinite(code) ? code : -999,
    message,
  };
}

function normalizeIntentSnapshot(
  intent: Intent & { feeAmount?: bigint },
  intentHash: string | null,
): BalancedSodaxIntentSnapshot {
  return {
    intentId: intent.intentId.toString(),
    creator: String(intent.creator),
    inputToken: String(intent.inputToken),
    outputToken: String(intent.outputToken),
    inputAmountBase: intent.inputAmount.toString(),
    minOutputAmountBase: intent.minOutputAmount.toString(),
    deadlineUnixSeconds: intent.deadline.toString(),
    allowPartialFill: intent.allowPartialFill,
    srcChain: intent.srcChain.toString(),
    dstChain: intent.dstChain.toString(),
    srcAddress: String(intent.srcAddress),
    dstAddress: String(intent.dstAddress),
    solver: String(intent.solver),
    data: String(intent.data),
    feeAmountBase: intent.feeAmount?.toString() ?? null,
    intentHash,
  };
}

function restoreIntentSnapshot(snapshot: BalancedSodaxIntentSnapshot): Intent {
  return {
    intentId: BigInt(snapshot.intentId),
    creator: snapshot.creator as Intent["creator"],
    inputToken: snapshot.inputToken as Intent["inputToken"],
    outputToken: snapshot.outputToken as Intent["outputToken"],
    inputAmount: BigInt(snapshot.inputAmountBase),
    minOutputAmount: BigInt(snapshot.minOutputAmountBase),
    deadline: BigInt(snapshot.deadlineUnixSeconds),
    allowPartialFill: snapshot.allowPartialFill,
    srcChain: BigInt(snapshot.srcChain) as Intent["srcChain"],
    dstChain: BigInt(snapshot.dstChain) as Intent["dstChain"],
    srcAddress: snapshot.srcAddress as Intent["srcAddress"],
    dstAddress: snapshot.dstAddress as Intent["dstAddress"],
    solver: snapshot.solver as Intent["solver"],
    data: snapshot.data as Intent["data"],
  };
}

function normalizeOptionalHash(intentTxHash?: string | null): string | null {
  const normalized = intentTxHash?.trim() ?? "";
  return normalized.length > 0 ? normalized : null;
}

function statusFailure(
  intentTxHash: string,
  code: number,
  message: string,
): BalancedSodaxStatusResult {
  return {
    ok: false,
    provider: "sodax_sdk",
    intentTxHash,
    code,
    message,
  };
}

async function safeIntentHash(sdk: Sodax, intent: Intent): Promise<string | null> {
  try {
    return await sdk.swaps.getIntentHash(intent);
  } catch {
    return null;
  }
}

function packetSnapshot(packet: PacketData | null): BalancedSodaxReceiptSnapshot["packet"] {
  if (!packet) {
    return null;
  }
  return {
    srcChainId: String(packet.src_chain_id),
    srcTxHash: packet.src_tx_hash,
    dstChainId: String(packet.dst_chain_id),
    dstTxHash: packet.dst_tx_hash || null,
    connectionSequence:
      typeof packet.conn_sn === "number" ? String(packet.conn_sn) : null,
    status: packet.status,
  };
}

function relayPacketSnapshot(packet: PacketData): BalancedSodaxRelayPacketSnapshot {
  return {
    srcChainId: String(packet.src_chain_id),
    srcTxHash: packet.src_tx_hash,
    srcAddress: packet.src_address,
    status: packet.status,
    dstChainId: String(packet.dst_chain_id),
    connectionSequence: String(packet.conn_sn),
    dstAddress: packet.dst_address,
    dstTxHash: packet.dst_tx_hash || null,
  };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function resolveRelayPackets(input: {
  sdk: Sodax;
  sourceTxHash: string;
  timeoutMs?: number;
}): Promise<BalancedSodaxRelayPacketSnapshot[]> {
  const timeoutMs = input.timeoutMs ?? DEFAULT_RELAY_PACKET_LOOKUP_TIMEOUT_MS;
  const startedAt = Date.now();

  while (true) {
    const response = await getTransactionPackets(
      {
        action: "get_transaction_packets",
        params: {
          chain_id: SODAX_STELLAR_RELAY_CHAIN_ID,
          tx_hash: input.sourceTxHash,
        },
      },
      input.sdk.relayerApiEndpoint,
    );

    if (response.success && response.data.length > 0) {
      return response.data.map(relayPacketSnapshot);
    }

    if (Date.now() - startedAt >= timeoutMs) {
      return [];
    }

    await sleep(RELAY_PACKET_LOOKUP_INTERVAL_MS);
  }
}

function selectCanonicalIntentPacket(
  packets: BalancedSodaxRelayPacketSnapshot[],
): BalancedSodaxRelayPacketSnapshot | null {
  return (
    packets.find((packet) => packet.status === "executed" && packet.dstTxHash) ??
    packets.find((packet) => packet.dstTxHash) ??
    packets[0] ??
    null
  );
}

export async function listBalancedSodaxStellarTokens(): Promise<
  BalancedSodaxToken[]
> {
  const sdk = await getSodax();
  return sdk.config.getSupportedSwapTokensByChainId("stellar").map(toBalancedToken);
}

async function resolveSupportedToken(address: string): Promise<BalancedSodaxToken> {
  const tokens = await listBalancedSodaxStellarTokens();
  const token = tokens.find((candidate) => candidate.address === address);
  if (!token) {
    throw new Error(`Unsupported Stellar SODAX token: ${address}`);
  }
  return token;
}

export async function requestBalancedSodaxQuote(input: {
  tokenIn: string;
  tokenOut: string;
  amountInBase: string;
}): Promise<BalancedSodaxQuoteResult> {
  const sdk = await getSodax();
  const [tokenIn, tokenOut] = await Promise.all([
    resolveSupportedToken(input.tokenIn),
    resolveSupportedToken(input.tokenOut),
  ]);
  const amountIn = BigInt(input.amountInBase);
  const result = await sdk.swaps.getQuote({
    token_src: tokenIn.address,
    token_dst: tokenOut.address,
    token_src_blockchain_id: "stellar",
    token_dst_blockchain_id: "stellar",
    amount: amountIn,
    quote_type: "exact_input",
  });

  if (result.ok) {
    return {
      ok: true,
      provider: "sodax_sdk",
      tokenIn,
      tokenOut,
      amountInBase: amountIn.toString(),
      quotedAmountBase: result.value.quoted_amount.toString(),
      quoteType: "exact_input",
    };
  }

  const error = sdkErrorDetail(result.error, "Failed to request SODAX quote.");
  return {
    ok: false,
    provider: "sodax_sdk",
    tokenIn,
    tokenOut,
    amountInBase: amountIn.toString(),
    code: error.code,
    message: error.message,
    quoteType: "exact_input",
  };
}

export async function requestBalancedSodaxIntentBuild(input: {
  tokenIn: string;
  tokenOut: string;
  amountInBase: string;
  minOutputAmountBase: string;
  sourceAccount: string;
  destinationAccount: string;
  deadlineSeconds?: number;
  allowPartialFill?: boolean;
  skipSimulation?: boolean;
}): Promise<BalancedSodaxIntentBuildResult> {
  const sdk = await getSodax();
  const [tokenIn, tokenOut] = await Promise.all([
    resolveSupportedToken(input.tokenIn),
    resolveSupportedToken(input.tokenOut),
  ]);
  const amountIn = BigInt(input.amountInBase);
  const minOutputAmount = BigInt(input.minOutputAmountBase);
  const deadlineSeconds =
    input.deadlineSeconds && input.deadlineSeconds > 0
      ? Math.trunc(input.deadlineSeconds)
      : DEFAULT_INTENT_DEADLINE_SECONDS;
  const deadline = await sdk.swaps
    .getSwapDeadline(BigInt(deadlineSeconds))
    .catch(() => BigInt(Math.floor(Date.now() / 1000) + deadlineSeconds));
  const intentParams: CreateIntentParams = {
    inputToken: tokenIn.address,
    outputToken: tokenOut.address,
    inputAmount: amountIn,
    minOutputAmount,
    deadline,
    allowPartialFill: Boolean(input.allowPartialFill),
    srcChain: SODAX_STELLAR_CHAIN_ID as CreateIntentParams["srcChain"],
    dstChain: SODAX_STELLAR_CHAIN_ID as CreateIntentParams["dstChain"],
    srcAddress: input.sourceAccount,
    dstAddress: input.destinationAccount,
    solver: SODAX_ANY_SOLVER_ADDRESS as CreateIntentParams["solver"],
    data: "0x" as CreateIntentParams["data"],
  };

  const result = await sdk.swaps.createIntent({
    intentParams,
    spokeProvider: buildStellarRawProvider(sdk, input.sourceAccount),
    raw: true,
    skipSimulation: Boolean(input.skipSimulation),
  });

  if (!result.ok) {
    const error = sdkErrorDetail(result.error, "Failed to build SODAX intent.");
    return {
      ok: false,
      provider: "sodax_sdk",
      tokenIn,
      tokenOut,
      amountInBase: amountIn.toString(),
      minOutputAmountBase: minOutputAmount.toString(),
      sourceAccount: input.sourceAccount,
      destinationAccount: input.destinationAccount,
      code: error.code,
      message: error.message,
    };
  }

  const [rawTransaction, intent, intentData] = result.value as readonly [
    StellarRawTransactionLike,
    Intent & { feeAmount?: bigint },
    string,
  ];
  let preparedTransactionXdr: string;
  try {
    preparedTransactionXdr = await prepareStellarRawTransactionXdr(
      rawTransaction.data,
      getStellarChainConfig(sdk),
    );
  } catch (error) {
    return {
      ok: false,
      provider: "sodax_sdk",
      tokenIn,
      tokenOut,
      amountInBase: amountIn.toString(),
      minOutputAmountBase: minOutputAmount.toString(),
      sourceAccount: input.sourceAccount,
      destinationAccount: input.destinationAccount,
      code: -998,
      message:
        error instanceof Error
          ? error.message
          : "Failed to prepare SODAX intent transaction.",
    };
  }
  const intentHash = await safeIntentHash(sdk, intent);
  const intentSnapshot = normalizeIntentSnapshot(intent, intentHash);
  const expiry = deriveBalancedSodaxExpiry({
    deadlineUnixSeconds: intentSnapshot.deadlineUnixSeconds,
    source: "intent_deadline",
  });

  return {
    ok: true,
    provider: "sodax_sdk",
    tokenIn,
    tokenOut,
    amountInBase: amountIn.toString(),
    minOutputAmountBase: minOutputAmount.toString(),
    sourceAccount: input.sourceAccount,
    destinationAccount: input.destinationAccount,
    deadlineSeconds,
    allowPartialFill: Boolean(input.allowPartialFill),
    rawTransaction: serializeRawTransaction({
      ...rawTransaction,
      data: preparedTransactionXdr,
    }),
    intent: intentSnapshot,
    intentData,
    expiry,
    refund: deriveBalancedSodaxRefund({
      expiry,
      refundRecipient: input.sourceAccount,
      intentKnown: true,
    }),
  };
}

export function formatIntentStatusLabel(status: number): string {
  switch (status) {
    case SolverIntentStatusCode.NOT_FOUND:
      return "NOT_FOUND";
    case SolverIntentStatusCode.NOT_STARTED_YET:
      return "NOT_STARTED_YET";
    case SolverIntentStatusCode.STARTED_NOT_FINISHED:
      return "STARTED_NOT_FINISHED";
    case SolverIntentStatusCode.SOLVED:
      return "SOLVED";
    case SolverIntentStatusCode.FAILED:
      return "FAILED";
    default:
      return "UNKNOWN";
  }
}

export async function requestBalancedSodaxSubmit(input: {
  intentTxHash: string;
}): Promise<BalancedSodaxSubmitResult> {
  const sdk = await getSodax();
  const normalizedHash = input.intentTxHash.trim();
  const result = await sdk.swaps.postExecution({
    intent_tx_hash: normalizedHash as `0x${string}`,
  });

  if (result.ok) {
    return {
      ok: true,
      provider: "sodax_sdk",
      intentTxHash: normalizedHash,
      answer: result.value.answer,
      solverIntentHash: result.value.intent_hash,
      detail: "SODAX solver accepted the executed intent transaction hash.",
    };
  }

  const error = sdkErrorDetail(
    result.error,
    "Failed to submit SODAX post-execution notification.",
  );
  return {
    ok: false,
    provider: "sodax_sdk",
    intentTxHash: normalizedHash,
    code: error.code,
    message: error.message,
  };
}

export async function requestBalancedSodaxRelaySubmit(input: {
  sourceTxHash: string;
}): Promise<BalancedSodaxRelaySubmitResult> {
  const sdk = await getSodax();
  const sourceTxHash = input.sourceTxHash.trim();
  const result = await sdk.swaps.submitIntent({
    action: "submit",
    params: {
      chain_id: SODAX_STELLAR_RELAY_CHAIN_ID,
      tx_hash: sourceTxHash,
    },
  });

  if (result.ok) {
    const packets = await resolveRelayPackets({ sdk, sourceTxHash });
    const canonicalIntentPacket = selectCanonicalIntentPacket(packets);
    return {
      ok: true,
      provider: "sodax_sdk",
      sourceTxHash,
      relayChainId: SODAX_STELLAR_RELAY_CHAIN_ID,
      success: result.value.success,
      message: result.value.message,
      canonicalIntentTxHash: canonicalIntentPacket?.dstTxHash ?? null,
      canonicalIntentPacket,
      packets,
      detail:
        canonicalIntentPacket?.dstTxHash
          ? "SODAX relayer accepted the Stellar source transaction hash and exposed the canonical destination intent hash."
          : "SODAX relayer accepted the Stellar source transaction hash; canonical destination intent hash is not visible yet.",
    };
  }

  const error = sdkErrorDetail(
    result.error,
    "Failed to relay SODAX source transaction hash.",
  );
  return {
    ok: false,
    provider: "sodax_sdk",
    sourceTxHash,
    relayChainId: SODAX_STELLAR_RELAY_CHAIN_ID,
    code: error.code,
    message: error.message,
  };
}

export async function requestBalancedSodaxStatus(
  intentTxHash: string,
): Promise<BalancedSodaxStatusResult> {
  const sdk = await getSodax();
  const normalizedHash = intentTxHash.trim();
  if (!normalizedHash.startsWith("0x")) {
    throw new Error("intentTxHash must be a 0x-prefixed intent hash.");
  }
  const result = await sdk.swaps.getStatus({
    intent_tx_hash: normalizedHash as `0x${string}`,
  });

  if (result.ok) {
    return {
      ok: true,
      provider: "sodax_sdk",
      intentTxHash: normalizedHash,
      statusCode: result.value.status,
      statusLabel: formatIntentStatusLabel(result.value.status),
      fillTxHash: result.value.fill_tx_hash ?? null,
      terminal:
        result.value.status === SolverIntentStatusCode.SOLVED ||
        result.value.status === SolverIntentStatusCode.FAILED ||
        result.value.status === SolverIntentStatusCode.NOT_FOUND,
    };
  }

  const error = sdkErrorDetail(result.error, "Failed to request SODAX status.");
  return statusFailure(normalizedHash, error.code, error.message);
}

export async function requestBalancedSodaxConfirm(
  intentTxHash: string,
): Promise<BalancedSodaxConfirmResult> {
  const status = await requestBalancedSodaxStatus(intentTxHash);
  return deriveBalancedSodaxConfirmFromStatus(status);
}

export function deriveBalancedSodaxConfirmFromStatus(
  status: BalancedSodaxStatusResult,
): BalancedSodaxConfirmResult {
  if (!status.ok) {
    return {
      ok: false,
      provider: "sodax_sdk",
      intentTxHash: status.intentTxHash,
      code: status.code,
      message: status.message,
    };
  }

  if (status.statusLabel === "SOLVED" && status.fillTxHash) {
    return {
      ok: true,
      provider: "sodax_sdk",
      intentTxHash: status.intentTxHash,
      statusCode: status.statusCode,
      statusLabel: status.statusLabel,
      terminal: status.terminal,
      fillTxHash: status.fillTxHash,
      confirmationTxHash: status.fillTxHash,
      confirmed: true,
      confirmationState: "confirmed",
      detail: "Intent solved and settlement hash confirmed from SODAX status.",
    };
  }

  if (status.statusLabel === "FAILED") {
    return {
      ok: true,
      provider: "sodax_sdk",
      intentTxHash: status.intentTxHash,
      statusCode: status.statusCode,
      statusLabel: status.statusLabel,
      terminal: status.terminal,
      fillTxHash: status.fillTxHash,
      confirmationTxHash: null,
      confirmed: false,
      confirmationState: "failed",
      detail: "Intent reached terminal FAILED state; no confirmation hash is available.",
    };
  }

  if (status.statusLabel === "NOT_FOUND") {
    return {
      ok: true,
      provider: "sodax_sdk",
      intentTxHash: status.intentTxHash,
      statusCode: status.statusCode,
      statusLabel: status.statusLabel,
      terminal: status.terminal,
      fillTxHash: status.fillTxHash,
      confirmationTxHash: null,
      confirmed: false,
      confirmationState: "not_found",
      detail: "Intent hash is not visible in the SODAX status surface yet.",
    };
  }

  return {
    ok: true,
    provider: "sodax_sdk",
    intentTxHash: status.intentTxHash,
    statusCode: status.statusCode,
    statusLabel: status.statusLabel,
    terminal: status.terminal,
    fillTxHash: status.fillTxHash,
    confirmationTxHash: null,
    confirmed: false,
    confirmationState: "pending",
    detail:
      status.statusLabel === "SOLVED"
        ? "Intent is solved but settlement hash is not available yet."
        : "Intent confirmation is still pending on the SODAX status surface.",
  };
}

export function deriveBalancedSodaxExpiry(input: {
  deadlineUnixSeconds?: string | number | bigint | null;
  source?: BalancedSodaxExpirySnapshot["source"];
  nowMs?: number;
}): BalancedSodaxExpirySnapshot {
  if (input.deadlineUnixSeconds === undefined || input.deadlineUnixSeconds === null) {
    return {
      deadlineUnixSeconds: null,
      expiresAt: null,
      expired: false,
      secondsUntilExpiry: null,
      cancellationWindowSeconds: 0,
      source: "unknown",
      detail: "Intent deadline is not known from the current SODAX surface.",
    };
  }

  const deadline = BigInt(input.deadlineUnixSeconds);
  if (deadline <= BigInt(0)) {
    return {
      deadlineUnixSeconds: deadline.toString(),
      expiresAt: null,
      expired: false,
      secondsUntilExpiry: null,
      cancellationWindowSeconds: 0,
      source: input.source ?? "intent_deadline",
      detail: "Intent has no automatic deadline; user cancellation is the refund path.",
    };
  }

  const nowSeconds = Math.floor((input.nowMs ?? Date.now()) / 1000);
  const deadlineSeconds = Number(deadline);
  const secondsUntilExpiry = Math.max(0, deadlineSeconds - nowSeconds);
  const expired = deadlineSeconds <= nowSeconds;
  return {
    deadlineUnixSeconds: deadline.toString(),
    expiresAt: new Date(deadlineSeconds * 1000).toISOString(),
    expired,
    secondsUntilExpiry,
    cancellationWindowSeconds: secondsUntilExpiry,
    source: input.source ?? "intent_deadline",
    detail: expired
      ? "Intent deadline has elapsed; cancellation/refund should be available if the intent remains unsettled."
      : "Intent is inside its active solver window before expiry.",
  };
}

export function deriveBalancedSodaxRefund(input: {
  status?: BalancedSodaxStatusResult | null;
  confirmation?: BalancedSodaxConfirmResult | null;
  expiry?: BalancedSodaxExpirySnapshot | null;
  refundRecipient?: string | null;
  intentKnown?: boolean;
}): BalancedSodaxRefundSnapshot {
  const refundRecipient = input.refundRecipient ?? null;
  const intentKnown = Boolean(input.intentKnown);

  if (input.confirmation?.ok && input.confirmation.confirmed) {
    return {
      refundMode: "none",
      refundRequired: false,
      refundAvailable: false,
      refundRecipient,
      cancelRequiresIntent: false,
      detail: "Intent is settled; no refund path is required.",
    };
  }

  if (input.status?.ok && input.status.statusLabel === "NOT_FOUND") {
    return {
      refundMode: "not_visible",
      refundRequired: false,
      refundAvailable: false,
      refundRecipient,
      cancelRequiresIntent: true,
      detail: "Intent is not visible yet; wait for indexing before attempting refund.",
    };
  }

  if (input.status?.ok && input.status.statusLabel === "FAILED") {
    return {
      refundMode: "failed_intent_recovery",
      refundRequired: true,
      refundAvailable: intentKnown,
      refundRecipient,
      cancelRequiresIntent: true,
      detail: intentKnown
        ? "Intent failed; build a cancel transaction to recover unsettled input."
        : "Intent failed, but the canonical intent payload is required before building refund.",
    };
  }

  if (input.expiry?.expired) {
    return {
      refundMode: "cancel_intent",
      refundRequired: true,
      refundAvailable: intentKnown,
      refundRecipient,
      cancelRequiresIntent: true,
      detail: intentKnown
        ? "Intent expired before settlement; cancellation can recover unsettled input."
        : "Intent expired, but the canonical intent payload is required before building refund.",
    };
  }

  return {
    refundMode: "cancel_intent",
    refundRequired: false,
    refundAvailable: intentKnown,
    refundRecipient,
    cancelRequiresIntent: true,
    detail: intentKnown
      ? "Intent can be cancelled by the user while unsettled."
      : "Refund availability requires the canonical intent payload.",
  };
}

export function deriveBalancedSodaxReceipt(input: {
  status: BalancedSodaxStatusResult;
  confirmation: BalancedSodaxConfirmResult;
  packet?: PacketData | null;
}): BalancedSodaxReceiptSnapshot | null {
  if (!input.status.ok || !input.confirmation.ok) {
    return null;
  }

  const receiptState =
    input.confirmation.confirmationState === "confirmed"
      ? "settled"
      : input.confirmation.confirmationState === "failed"
        ? "failed"
        : input.confirmation.confirmationState === "not_found"
          ? "not_found"
          : "pending";

  return {
    receiptState,
    intentTxHash: input.status.intentTxHash,
    statusLabel: input.status.statusLabel,
    terminal: input.status.terminal,
    fillTxHash: input.status.fillTxHash,
    confirmationTxHash: input.confirmation.confirmationTxHash,
    packet: packetSnapshot(input.packet ?? null),
    detail:
      receiptState === "settled"
        ? input.packet
          ? "Intent is settled and SODAX relay packet data is attached."
          : "Intent is settled according to SODAX status; relay packet was not available in the current timeout."
        : input.confirmation.detail,
  };
}

export async function requestBalancedSodaxReceipt(
  intentTxHash: string,
  options: { packetTimeoutMs?: number } = {},
): Promise<BalancedSodaxReceiptResult> {
  const sdk = await getSodax();
  const status = await requestBalancedSodaxStatus(intentTxHash);
  const confirmation = deriveBalancedSodaxConfirmFromStatus(status);
  if (!status.ok) {
    return {
      ok: false,
      provider: "sodax_sdk",
      intentTxHash: status.intentTxHash,
      code: status.code,
      message: status.message,
    };
  }
  if (!confirmation.ok) {
    return {
      ok: false,
      provider: "sodax_sdk",
      intentTxHash: confirmation.intentTxHash,
      code: confirmation.code,
      message: confirmation.message,
    };
  }

  let packet: PacketData | null = null;
  if (confirmation.confirmed && confirmation.fillTxHash) {
    const packetResult = await sdk.swaps.getSolvedIntentPacket({
      chainId: SODAX_STELLAR_CHAIN_ID as CreateIntentParams["dstChain"],
      fillTxHash: confirmation.fillTxHash,
      timeout: options.packetTimeoutMs ?? DEFAULT_SOLVED_PACKET_TIMEOUT_MS,
    });
    if (packetResult.ok) {
      packet = packetResult.value;
    }
  }

  const receipt = deriveBalancedSodaxReceipt({ status, confirmation, packet });
  return {
    ok: true,
    provider: "sodax_sdk",
    receipt: receipt as BalancedSodaxReceiptSnapshot,
    refund: deriveBalancedSodaxRefund({
      status,
      confirmation,
      expiry: null,
      intentKnown: false,
    }),
    expiry: deriveBalancedSodaxExpiry({}),
  };
}

export async function requestBalancedSodaxExpiry(input: {
  intentTxHash?: string | null;
  intent?: BalancedSodaxIntentSnapshot | null;
}): Promise<BalancedSodaxExpiryResult> {
  const normalizedHash = normalizeOptionalHash(input.intentTxHash);
  if (input.intent) {
    return {
      ok: true,
      provider: "sodax_sdk",
      intentTxHash: normalizedHash ?? input.intent.intentHash,
      intent: input.intent,
      expiry: deriveBalancedSodaxExpiry({
        deadlineUnixSeconds: input.intent.deadlineUnixSeconds,
        source: "intent_deadline",
      }),
    };
  }

  if (!normalizedHash) {
    return {
      ok: true,
      provider: "sodax_sdk",
      intentTxHash: null,
      intent: null,
      expiry: deriveBalancedSodaxExpiry({}),
    };
  }

  try {
    const sdk = await getSodax();
    const intent = await sdk.swaps.getIntent(normalizedHash as `0x${string}`);
    const snapshot = normalizeIntentSnapshot(intent, await safeIntentHash(sdk, intent));
    return {
      ok: true,
      provider: "sodax_sdk",
      intentTxHash: normalizedHash,
      intent: snapshot,
      expiry: deriveBalancedSodaxExpiry({
        deadlineUnixSeconds: snapshot.deadlineUnixSeconds,
        source: "intent_deadline",
      }),
    };
  } catch (error) {
    const detail = sdkErrorDetail(error, "Failed to resolve SODAX intent expiry.");
    return {
      ok: false,
      provider: "sodax_sdk",
      intentTxHash: normalizedHash,
      code: detail.code,
      message: detail.message,
    };
  }
}

export async function requestBalancedSodaxRefund(input: {
  sourceAccount: string;
  intentTxHash?: string | null;
  intent?: BalancedSodaxIntentSnapshot | null;
}): Promise<BalancedSodaxRefundBuildResult> {
  const normalizedHash = normalizeOptionalHash(input.intentTxHash);

  try {
    const sdk = await getSodax();
    const intent = input.intent
      ? restoreIntentSnapshot(input.intent)
      : await sdk.swaps.getIntent((normalizedHash ?? "") as `0x${string}`);
    const snapshot = normalizeIntentSnapshot(intent, await safeIntentHash(sdk, intent));
    const expiry = deriveBalancedSodaxExpiry({
      deadlineUnixSeconds: snapshot.deadlineUnixSeconds,
      source: "intent_deadline",
    });
    const result = await sdk.swaps.cancelIntent(
      intent,
      buildStellarRawProvider(sdk, input.sourceAccount),
      true,
    );

    if (!result.ok) {
      const detail = sdkErrorDetail(result.error, "Failed to build SODAX refund.");
      return {
        ok: false,
        provider: "sodax_sdk",
        sourceAccount: input.sourceAccount,
        intentTxHash: normalizedHash,
        code: detail.code,
        message: detail.message,
      };
    }

    return {
      ok: true,
      provider: "sodax_sdk",
      sourceAccount: input.sourceAccount,
      intentTxHash: normalizedHash,
      rawTransaction: serializeRawTransaction({
        ...result.value,
        data: await prepareStellarRawTransactionXdr(result.value.data, getStellarChainConfig(sdk)),
      }),
      intent: snapshot,
      refund: deriveBalancedSodaxRefund({
        expiry,
        refundRecipient: input.sourceAccount,
        intentKnown: true,
      }),
      expiry,
    };
  } catch (error) {
    const detail = sdkErrorDetail(error, "Failed to resolve SODAX intent for refund.");
    return {
      ok: false,
      provider: "sodax_sdk",
      sourceAccount: input.sourceAccount,
      intentTxHash: normalizedHash,
      code: detail.code,
      message: detail.message,
    };
  }
}

export async function requestBalancedSodaxLifecycle(
  intentTxHash: string,
): Promise<BalancedSodaxIntentLifecycleResult> {
  const status = await requestBalancedSodaxStatus(intentTxHash);
  const confirmation = deriveBalancedSodaxConfirmFromStatus(status);
  const receipt = deriveBalancedSodaxReceipt({ status, confirmation });
  const expiry = deriveBalancedSodaxExpiry({});
  return {
    status,
    confirmation,
    receipt,
    refund: deriveBalancedSodaxRefund({
      status,
      confirmation,
      expiry,
      intentKnown: false,
    }),
    expiry,
  };
}
