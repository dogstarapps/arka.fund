import { Keypair, Transaction } from "@stellar/stellar-sdk";
import type { SignedArkafundSdkConfig } from "./config.js";

export function createKeypairSigner(
  secret: string,
  networkPassphrase: string,
): Pick<SignedArkafundSdkConfig, "publicKey" | "signTransaction"> {
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
