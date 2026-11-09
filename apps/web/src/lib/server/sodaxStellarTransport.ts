import "server-only";

import { SwapsApi, SwapsApiError } from "@sodax/swaps-api";
import {
  DEFAULT_API_BASE_URL,
  DEFAULT_RELAYER_API_ENDPOINT,
  RelayChainIdMap,
  solverConfig,
  type IntentRequestV2,
  type IntentResponseV2,
  type SwapTokenV2,
  type StellarRawTransaction,
  type RawTxReturnType,
} from "@sodax/types";

// Preserve Arka's public response contract while using the official Stellar
// HTTP client, not the full SDK's unrelated Solana/EVM native dependencies.
export type Intent = IntentRequestV2;
export type Token = SwapTokenV2;
export type CreateIntentParams = Omit<Intent, "intentId" | "creator" | "srcChain" | "dstChain"> & {
  srcChain: "stellar";
  dstChain: "stellar";
};
export type PacketData = {
  src_chain_id: number;
  src_tx_hash: string;
  src_address: string;
  status: string;
  dst_chain_id: number;
  conn_sn: number;
  dst_address: string;
  dst_tx_hash: string;
};
export type SolverExecutionResponse = { answer: "OK"; intent_hash: string };
export const SolverIntentStatusCode = {
  NOT_FOUND: -1, NOT_STARTED_YET: 1, STARTED_NOT_FINISHED: 2, SOLVED: 3, FAILED: 4,
} as const;
export function getIntentRelayChainId(chain: "stellar"): bigint {
  return RelayChainIdMap[chain];
}

type Failure = { detail: { code: number; message: string } };
type Result<T> = { ok: true; value: T } | { ok: false; error: Failure };
async function result<T>(operation: () => Promise<T>): Promise<Result<T>> {
  try {
    return { ok: true, value: await operation() };
  } catch (error) {
    const code = error instanceof SwapsApiError ? error.context.status ?? -999 : -999;
    // Never serialize transport headers, request bodies or API-key credentials.
    return { ok: false, error: { detail: { code, message: error instanceof Error ? error.message : "SODAX request failed." } } };
  }
}

function decodeIntent(intent: IntentResponseV2): Intent {
  return {
    ...intent,
    intentId: BigInt(intent.intentId),
    inputAmount: BigInt(intent.inputAmount),
    minOutputAmount: BigInt(intent.minOutputAmount),
    deadline: BigInt(intent.deadline),
    srcChain: BigInt(intent.srcChain),
    dstChain: BigInt(intent.dstChain),
  };
}

function stellarTransaction(tx: RawTxReturnType, sourceAccount?: string): StellarRawTransaction {
  if (!("from" in tx) || !("to" in tx) || !("data" in tx) || !("value" in tx) ||
      typeof tx.from !== "string" || typeof tx.to !== "string" || typeof tx.data !== "string" || typeof tx.value !== "bigint") {
    throw new Error("SODAX did not return a Stellar unsigned transaction.");
  }
  if (sourceAccount && tx.from !== sourceAccount) {
    throw new Error("SODAX transaction source does not match the requested wallet.");
  }
  return { from: tx.from, to: tx.to, data: tx.data, value: tx.value };
}

type StellarConfig = { sorobanRpcUrl?: string };
export class StellarRawSpokeProvider {
  constructor(readonly walletAddress: string, readonly chainConfig: StellarConfig) {}
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function parsePacket(value: unknown): PacketData {
  if (!isRecord(value)) throw new Error("Invalid SODAX relay packet.");
  for (const field of ["src_chain_id", "dst_chain_id", "conn_sn"] as const) {
    if (!Number.isSafeInteger(value[field]) || Number(value[field]) < 0) throw new Error(`Invalid SODAX packet ${field}.`);
  }
  for (const field of ["src_tx_hash", "src_address", "status", "dst_address", "dst_tx_hash"] as const) {
    if (typeof value[field] !== "string") throw new Error(`Invalid SODAX packet ${field}.`);
  }
  return value as PacketData;
}

async function postOfficial(endpoint: string, body: unknown): Promise<unknown> {
  // The compatibility endpoints are fixed upstream URLs. Never forward the
  // partner API key to the separate ICON relay host. Mutations are not retried.
  const response = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(20000),
    redirect: "error",
  });
  if (!response.ok) throw new Error(`SODAX upstream returned HTTP ${response.status}.`);
  return response.json();
}

export async function getTransactionPackets(
  body: { action: "get_transaction_packets"; params: { chain_id: string; tx_hash: string } },
  endpoint: string,
): Promise<{ success: boolean; data: PacketData[] }> {
  if (endpoint !== DEFAULT_RELAYER_API_ENDPOINT) throw new Error("Untrusted SODAX relay endpoint.");
  const response = await postOfficial(endpoint, body);
  if (!isRecord(response) || typeof response.success !== "boolean" || !Array.isArray(response.data)) {
    throw new Error("Invalid SODAX relay packet response.");
  }
  return { success: response.success, data: response.data.map(parsePacket) };
}

export class Sodax {
  private readonly api: SwapsApi;
  private tokens: Token[] = [];
  readonly relayerApiEndpoint = DEFAULT_RELAYER_API_ENDPOINT;
  readonly config = {
    spokeChainConfig: { stellar: {} as StellarConfig },
    getSupportedSwapTokensByChainId: (chain: "stellar"): Token[] => {
      if (chain !== "stellar") throw new Error("Only Stellar is supported by this transport.");
      return this.tokens;
    },
  };

  constructor() {
    const apiKey = process.env.SODAX_API_KEY?.trim();
    this.api = new SwapsApi({
      baseUrl: DEFAULT_API_BASE_URL,
      timeout: 20000,
      headers: apiKey ? { "x-api-key": apiKey } : undefined,
      // A redirect must not disclose the key to another origin.
      fetch: (input, init) => fetch(input, { ...init, redirect: "error" }),
    });
  }

  async initialize(): Promise<Result<void>> {
    return result(async () => { this.tokens = await this.api.getTokensByChain("stellar"); });
  }

  readonly swaps = {
    getQuote: (body: { token_src: string; token_dst: string; token_src_blockchain_id: "stellar"; token_dst_blockchain_id: "stellar"; amount: bigint; quote_type: "exact_input" }) => result(async () => {
      const quote = await this.api.getQuote({ tokenSrc: body.token_src, tokenDst: body.token_dst, tokenSrcChainKey: "stellar", tokenDstChainKey: "stellar", amount: body.amount.toString(), quoteType: body.quote_type });
      return { quoted_amount: BigInt(quote.quotedAmount) };
    }),
    getSwapDeadline: async (seconds: bigint): Promise<bigint> => {
      const deadline = await this.api.getDeadline({ offsetSeconds: Number(seconds) });
      return BigInt(deadline.deadline);
    },
    createIntent: (input: { intentParams: CreateIntentParams; spokeProvider: StellarRawSpokeProvider; raw: true; skipSimulation: boolean }) => result(async () => {
      const p = input.intentParams;
      const response = await this.api.createIntent({ srcChainKey: "stellar", dstChainKey: "stellar", inputToken: p.inputToken, outputToken: p.outputToken, inputAmount: p.inputAmount.toString(), minOutputAmount: p.minOutputAmount.toString(), deadline: p.deadline.toString(), allowPartialFill: p.allowPartialFill, srcAddress: p.srcAddress, dstAddress: p.dstAddress, solver: p.solver, data: p.data });
      return [stellarTransaction(response.tx, input.spokeProvider.walletAddress), decodeIntent(response.intent), response.relayData.payload] as const;
    }),
    getIntentHash: async (intent: Intent): Promise<string> => (await this.api.getIntentHash({ intent })).hash,
    getIntent: async (hash: string): Promise<Intent> => decodeIntent(await this.api.getIntent(hash)),
    getStatus: (body: { intent_tx_hash: string }) => result(async () => {
      const status = await this.api.getStatus({ intentTxHash: body.intent_tx_hash });
      return { status: status.status, fill_tx_hash: status.fillTxHash };
    }),
    getSolvedIntentPacket: (body: { chainId: "stellar"; fillTxHash: string; timeout: number }) => result(async () => {
      const packet = await this.api.getSolvedIntentPacket(body);
      return { src_chain_id: packet.srcChainId, src_tx_hash: packet.srcTxHash, src_address: packet.srcAddress, status: packet.status, dst_chain_id: packet.dstChainId, conn_sn: packet.connSn, dst_address: packet.dstAddress, dst_tx_hash: packet.dstTxHash };
    }),
    cancelIntent: (intent: Intent, provider: StellarRawSpokeProvider, raw: true) => result(async () => {
      if (!raw) throw new Error("SODAX cancellation must remain unsigned.");
      const response = await this.api.cancelIntent({ srcChainKey: "stellar", intent });
      return stellarTransaction(response.tx, provider.walletAddress);
    }),
    submitIntent: (body: { action: "submit"; params: { chain_id: string; tx_hash: string } }) => result(async () => {
      const response = await this.api.submitIntent({ chainId: body.params.chain_id, txHash: body.params.tx_hash });
      if (!isRecord(response.result) || typeof response.result.success !== "boolean" || typeof response.result.message !== "string") throw new Error("Invalid SODAX relay submission response.");
      if (!response.result.success) throw new Error("SODAX relayer rejected the submission.");
      return { success: response.result.success, message: response.result.message };
    }),
    // Swaps API v2 has no separate postExecution method. Keep Arka's existing
    // two-stage relay -> solver notification using the official solver endpoint
    // still published by @sodax/types 2.1.0. Never infer settlement from acceptance.
    postExecution: (body: { intent_tx_hash: string }) => result(async (): Promise<SolverExecutionResponse> => {
      const response = await postOfficial(`${solverConfig.solverApiEndpoint}/execute`, body);
      if (!isRecord(response) || response.answer !== "OK" || typeof response.intent_hash !== "string") throw new Error("Invalid SODAX solver acceptance response.");
      return { answer: "OK", intent_hash: response.intent_hash };
    }),
  };
}
