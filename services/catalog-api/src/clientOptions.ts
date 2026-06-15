import { Keypair, Transaction } from "@stellar/stellar-sdk";
import type {
  AssembledTransaction,
  ClientOptions as ContractClientOptions,
} from "@stellar/stellar-sdk/contract";

export interface NetworkConfig {
  rpcUrl: string;
  networkPassphrase: string;
  allowHttp?: boolean;
  publicKey?: string;
  signTransaction?: ContractClientOptions["signTransaction"];
}

export interface CallOptions {
  fee?: number;
  timeoutInSeconds?: number;
  simulate?: boolean;
}

export interface SignedNetworkConfig extends NetworkConfig {
  publicKey: string;
  signTransaction: NonNullable<NetworkConfig["signTransaction"]>;
}

export interface AssembledTransactionLike<T> extends Pick<AssembledTransaction<T>, "toXDR"> {
  result?: T;
  signAndSend?: () => Promise<unknown>;
}

export function createClientOptions(
  config: NetworkConfig,
  contractId: string,
): ContractClientOptions {
  return {
    contractId,
    rpcUrl: config.rpcUrl,
    networkPassphrase: config.networkPassphrase,
    publicKey: config.publicKey,
    signTransaction: config.signTransaction,
    allowHttp: config.allowHttp ?? config.rpcUrl.startsWith("http://"),
  };
}

export function mergeCallOptions(
  overrides?: CallOptions,
  simulate = true,
): CallOptions {
  return {
    fee: overrides?.fee,
    timeoutInSeconds: overrides?.timeoutInSeconds,
    simulate: overrides?.simulate ?? simulate,
  };
}

export function expectSimulationResult<T>(
  assembled: AssembledTransactionLike<T>,
  method: string,
): T {
  if (assembled.result === undefined) {
    throw new Error(`Simulation for ${method} did not produce a decoded result`);
  }
  return assembled.result;
}

export function createKeypairSigner(
  secret: string,
  networkPassphrase: string,
): Pick<SignedNetworkConfig, "publicKey" | "signTransaction"> {
  const keypair = Keypair.fromSecret(secret);
  return {
    publicKey: keypair.publicKey(),
    signTransaction: async (transactionXdr, options) => {
      const tx = new Transaction(
        transactionXdr,
        options?.networkPassphrase ?? networkPassphrase,
      );
      tx.sign(keypair);
      return { signedTxXdr: tx.toEnvelope().toXDR("base64") };
    },
  };
}

export async function submitTransaction<T>(
  config: NetworkConfig,
  assembled: AssembledTransactionLike<T>,
): Promise<void> {
  requireSigner(config);
  if (typeof assembled.signAndSend === "function") {
    await assembled.signAndSend();
    return;
  }

  const signedConfig = requireSigner(config);
  const signed = await signedConfig.signTransaction(assembled.toXDR(), {
    networkPassphrase: config.networkPassphrase,
    address: signedConfig.publicKey,
  });
  const sendResponse = await rpcRequest<{ hash?: string }>(config.rpcUrl, "sendTransaction", {
    transaction: signed.signedTxXdr,
  });
  if (!sendResponse.hash) {
    throw new Error("sendTransaction did not return a transaction hash");
  }
}

function requireSigner(config: NetworkConfig): SignedNetworkConfig {
  if (!config.publicKey || !config.signTransaction) {
    throw new Error("Signed contract writes require publicKey and signTransaction");
  }
  return config as SignedNetworkConfig;
}

async function rpcRequest<T>(
  rpcUrl: string,
  method: string,
  params: Record<string, unknown>,
): Promise<T> {
  const response = await fetch(rpcUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
  });
  const payload = (await response.json()) as {
    result?: T;
    error?: { message?: string };
  };
  if (!response.ok || payload.error) {
    throw new Error(
      `RPC ${method} failed: ${payload.error?.message ?? response.statusText} :: ${JSON.stringify(payload.error ?? {})}`,
    );
  }
  if (payload.result === undefined) {
    throw new Error(`RPC ${method} returned no result`);
  }
  return payload.result;
}
