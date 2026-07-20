import type {
  ArkafundSdkConfig,
  AssembledTransactionLike,
  SignedArkafundSdkConfig,
  SubmittedTransaction,
} from "./config.js";
import { requireSigner } from "./config.js";

interface RpcEnvelope<T> {
  result?: T;
  error?: {
    code?: number;
    message?: string;
    data?: unknown;
  };
}

interface SendTransactionResult {
  hash?: string;
  status?: string;
  errorResultXdr?: string;
}

interface GetTransactionResult {
  status?: string;
  resultXdr?: string;
}

async function rpcRequest<T>(
  rpcUrl: string,
  method: string,
  params: Record<string, unknown>,
): Promise<T> {
  const response = await fetch(rpcUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method,
      params,
    }),
  });
  const body = (await response.json()) as RpcEnvelope<T>;
  if (!response.ok || body.error) {
    throw new Error(
      `RPC ${method} failed: ${body.error?.message ?? response.statusText}`,
    );
  }
  if (body.result === undefined) {
    throw new Error(`RPC ${method} returned no result`);
  }
  return body.result;
}

async function waitForTransaction(
  config: ArkafundSdkConfig,
  hash: string,
): Promise<GetTransactionResult> {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    const result = await rpcRequest<GetTransactionResult>(
      config.rpcUrl,
      "getTransaction",
      { hash },
    );
    if (result.status === "SUCCESS") {
      return result;
    }
    if (result.status === "FAILED") {
      throw new Error(
        `Transaction ${hash} failed${result.resultXdr ? `: ${result.resultXdr}` : ""}`,
      );
    }
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  throw new Error(`Timed out waiting for transaction ${hash}`);
}

export async function submitTransaction<T>(
  config: ArkafundSdkConfig,
  assembled: AssembledTransactionLike<T>,
): Promise<SubmittedTransaction<T>> {
  const signedConfig: SignedArkafundSdkConfig = requireSigner(config);
  const signed = await signedConfig.signTransaction(assembled.toXDR(), {
    networkPassphrase: config.networkPassphrase,
    address: signedConfig.publicKey,
  });
  const sendResponse = await rpcRequest<SendTransactionResult>(
    config.rpcUrl,
    "sendTransaction",
    { transaction: signed.signedTxXdr },
  );
  if (sendResponse.status === "ERROR") {
    throw new Error(
      `sendTransaction rejected the transaction${
        sendResponse.errorResultXdr ? `: ${sendResponse.errorResultXdr}` : ""
      }`,
    );
  }
  if (sendResponse.status === "TRY_AGAIN_LATER") {
    throw new Error("sendTransaction asked the client to try again later");
  }
  if (!sendResponse.hash) {
    throw new Error("sendTransaction did not return a transaction hash");
  }
  const getResponse = await waitForTransaction(config, sendResponse.hash);
  return {
    hash: sendResponse.hash,
    simulationResult: assembled.result,
    sendResponse,
    getResponse,
  };
}
