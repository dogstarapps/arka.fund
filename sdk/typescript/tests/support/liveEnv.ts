import { ArkafundSdk, createKeypairSigner } from "../../src/index.js";

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required env var: ${name}`);
  }
  return value;
}

export interface LiveTestContext {
  rpcUrl: string;
  networkPassphrase: string;
  adminSecret: string;
  adminPublicKey: string;
  writerSecret: string;
  writerPublicKey: string;
  registryContractId: string;
  oracleGuardContractId: string;
}

export function loadLiveTestContext(): LiveTestContext {
  return {
    rpcUrl: required("ARKAFUND_SDK_RPC_URL"),
    networkPassphrase: required("ARKAFUND_SDK_NETWORK_PASSPHRASE"),
    adminSecret: required("ARKAFUND_SDK_ADMIN_SECRET"),
    adminPublicKey: required("ARKAFUND_SDK_ADMIN_PUBLIC_KEY"),
    writerSecret: required("ARKAFUND_SDK_WRITER_SECRET"),
    writerPublicKey: required("ARKAFUND_SDK_WRITER_PUBLIC_KEY"),
    registryContractId: required("ARKAFUND_SDK_REGISTRY_CONTRACT_ID"),
    oracleGuardContractId: required("ARKAFUND_SDK_ORACLE_GUARD_CONTRACT_ID"),
  };
}

export function makeSdk(secret: string, rpcUrl: string, networkPassphrase: string): ArkafundSdk {
  return new ArkafundSdk({
    rpcUrl,
    networkPassphrase,
    ...createKeypairSigner(secret, networkPassphrase),
  });
}
