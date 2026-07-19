import type { ClientOptions as ContractClientOptions } from "@stellar/stellar-sdk/contract";
import type { ArkafundSdkConfig } from "./config.js";

export interface StellarWalletSigner {
  signTransaction(
    transactionXdr: string,
    options: { networkPassphrase: string; address?: string },
  ): Promise<string | { signedTxXdr: string }>;
}

export function walletSdkConfig(
  base: Omit<ArkafundSdkConfig, "publicKey" | "signTransaction">,
  publicKey: string,
  wallet: StellarWalletSigner,
): ArkafundSdkConfig {
  const signTransaction: ContractClientOptions["signTransaction"] = async (
    transactionXdr,
    options,
  ) => {
    const result = await wallet.signTransaction(transactionXdr, {
      networkPassphrase: options?.networkPassphrase ?? base.networkPassphrase,
      address: options?.address ?? publicKey,
    });
    return typeof result === "string" ? { signedTxXdr: result } : result;
  };
  return { ...base, publicKey, signTransaction };
}
