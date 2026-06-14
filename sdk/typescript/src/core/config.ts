import type {
  AssembledTransaction,
  ClientOptions as ContractClientOptions,
} from "@stellar/stellar-sdk/contract";

export interface ArkafundSdkConfig {
  rpcUrl: string;
  networkPassphrase: string;
  publicKey?: string;
  signTransaction?: ContractClientOptions["signTransaction"];
  allowHttp?: boolean;
  fee?: number;
  timeoutInSeconds?: number;
}

export interface ArkafundCallOptions {
  fee?: number;
  timeoutInSeconds?: number;
  simulate?: boolean;
}

export interface SignedArkafundSdkConfig extends ArkafundSdkConfig {
  publicKey: string;
  signTransaction: NonNullable<ArkafundSdkConfig["signTransaction"]>;
}

export interface AssembledTransactionLike<T> extends Pick<AssembledTransaction<T>, "toXDR"> {
  result?: T;
}

export interface SubmittedTransaction<T> {
  hash: string;
  simulationResult: T | undefined;
  sendResponse: unknown;
  getResponse: unknown;
}

export function mergeCallOptions(
  config: ArkafundSdkConfig,
  overrides?: ArkafundCallOptions,
  simulate = true,
): ArkafundCallOptions {
  return {
    fee: overrides?.fee ?? config.fee,
    timeoutInSeconds: overrides?.timeoutInSeconds ?? config.timeoutInSeconds,
    simulate: overrides?.simulate ?? simulate,
  };
}

export function createClientOptions(
  config: ArkafundSdkConfig,
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

export function requireSigner(config: ArkafundSdkConfig): SignedArkafundSdkConfig {
  if (!config.publicKey || !config.signTransaction) {
    throw new Error(
      "This action requires both publicKey and signTransaction in the SDK configuration",
    );
  }
  return config as SignedArkafundSdkConfig;
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
