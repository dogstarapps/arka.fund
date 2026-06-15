function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required env var: ${name}`);
  }
  return value;
}

export interface LiveCatalogEnv {
  rpcUrl: string;
  networkPassphrase: string;
  registryContractId: string;
  syncToken: string;
  tokenContractId?: string;
  arkaOneContractId?: string;
  arkaTwoContractId?: string;
  depositorSecret?: string;
  depositorPublicKey?: string;
}

export function loadLiveCatalogEnv(): LiveCatalogEnv {
  return {
    rpcUrl: required("CATALOG_API_RPC_URL"),
    networkPassphrase: required("CATALOG_API_NETWORK_PASSPHRASE"),
    registryContractId: required("CATALOG_API_REGISTRY_CONTRACT_ID"),
    syncToken: required("CATALOG_API_SYNC_TOKEN"),
    tokenContractId: process.env.CATALOG_API_TOKEN_CONTRACT_ID,
    arkaOneContractId: process.env.CATALOG_API_ARKA_ONE_CONTRACT_ID,
    arkaTwoContractId: process.env.CATALOG_API_ARKA_TWO_CONTRACT_ID,
    depositorSecret: process.env.CATALOG_API_DEPOSITOR_SECRET,
    depositorPublicKey: process.env.CATALOG_API_DEPOSITOR_PUBLIC_KEY,
  };
}
