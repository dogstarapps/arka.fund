import {
  createClientOptions,
  createKeypairSigner,
  mergeCallOptions,
  submitTransaction,
  type NetworkConfig,
} from "../../src/clientOptions.js";
import { Client as ArkaClient } from "../../src/generated/arka.js";
import { Client as RegistryClient } from "../../src/generated/arka-registry.js";
import { Client as TestTokenClient } from "../../src/generated/test-token.js";

async function main(): Promise<void> {
  const rpcUrl = required("CATALOG_API_RPC_URL");
  const networkPassphrase = required("CATALOG_API_NETWORK_PASSPHRASE");
  const adminSecret = required("CATALOG_API_ADMIN_SECRET");
  const adminPublicKey = required("CATALOG_API_ADMIN_PUBLIC_KEY");
  const writerSecret = required("CATALOG_API_WRITER_SECRET");
  const writerPublicKey = required("CATALOG_API_WRITER_PUBLIC_KEY");
  const depositorSecret = required("CATALOG_API_DEPOSITOR_SECRET");
  const depositorPublicKey = required("CATALOG_API_DEPOSITOR_PUBLIC_KEY");
  const registryContractId = required("CATALOG_API_REGISTRY_CONTRACT_ID");
  const tokenContractId = required("CATALOG_API_TOKEN_CONTRACT_ID");
  const arkaOneContractId = required("CATALOG_API_ARKA_ONE_CONTRACT_ID");
  const arkaTwoContractId = required("CATALOG_API_ARKA_TWO_CONTRACT_ID");

  const adminConfig = signedConfig(rpcUrl, networkPassphrase, adminSecret);
  const writerConfig = signedConfig(rpcUrl, networkPassphrase, writerSecret);
  const depositorConfig = signedConfig(rpcUrl, networkPassphrase, depositorSecret);

  const registryClient = new RegistryClient(createClientOptions(adminConfig, registryContractId));
  const tokenAdminClient = new TestTokenClient(createClientOptions(adminConfig, tokenContractId));
  const tokenDepositorClient = new TestTokenClient(
    createClientOptions(depositorConfig, tokenContractId),
  );
  const arkaAdminClient = new ArkaClient(createClientOptions(adminConfig, arkaOneContractId));
  const arkaWriterClient = new ArkaClient(createClientOptions(writerConfig, arkaTwoContractId));
  const arkaDepositorOneClient = new ArkaClient(
    createClientOptions(depositorConfig, arkaOneContractId),
  );
  const arkaDepositorTwoClient = new ArkaClient(
    createClientOptions(depositorConfig, arkaTwoContractId),
  );

  await runStep("registry.init_admin", async () =>
    submitTransaction(
      adminConfig,
      await registryClient.init_admin(
        { admin: adminPublicKey },
        mergeCallOptions(undefined, true),
      ),
    ),
  );

  await runStep("token.init", async () =>
    submitTransaction(
      adminConfig,
      await tokenAdminClient.init({ admin: adminPublicKey }, mergeCallOptions(undefined, true)),
    ),
  );

  await runStep("arka_one.init", async () =>
    submitTransaction(
      adminConfig,
      await arkaAdminClient.init(
        {
          denomination_contract: tokenContractId,
          mgmt_bps: 0,
          perf_bps: 0,
          deposit_bps: 0,
          redeem_bps: 0,
          whitelist_contracts: [tokenContractId],
          manager: adminPublicKey,
        },
        mergeCallOptions(undefined, true),
      ),
    ),
  );

  await runStep("arka_two.init", async () =>
    submitTransaction(
      writerConfig,
      await arkaWriterClient.init(
        {
          denomination_contract: tokenContractId,
          mgmt_bps: 0,
          perf_bps: 0,
          deposit_bps: 0,
          redeem_bps: 0,
          whitelist_contracts: [tokenContractId],
          manager: writerPublicKey,
        },
        mergeCallOptions(undefined, true),
      ),
    ),
  );

  await runStep("registry.register.arka_one", async () =>
    submitTransaction(
      adminConfig,
      await registryClient.register(
        {
          caller: adminPublicKey,
          manager: adminPublicKey,
          arka: arkaOneContractId,
        },
        mergeCallOptions(undefined, true),
      ),
    ),
  );

  await runStep("registry.register.arka_two", async () =>
    submitTransaction(
      adminConfig,
      await registryClient.register(
        {
          caller: adminPublicKey,
          manager: writerPublicKey,
          arka: arkaTwoContractId,
        },
        mergeCallOptions(undefined, true),
      ),
    ),
  );

  await runStep("registry.set_manager_curated", async () =>
    submitTransaction(
      adminConfig,
      await registryClient.set_manager_curated(
        {
          caller: adminPublicKey,
          manager: adminPublicKey,
          curated: true,
        },
        mergeCallOptions(undefined, true),
      ),
    ),
  );

  await runStep("token.mint", async () =>
    submitTransaction(
      adminConfig,
      await tokenAdminClient.mint(
        { to: depositorPublicKey, amount: 3000n },
        mergeCallOptions(undefined, true),
      ),
    ),
  );

  await runStep("token.approve.arka_one", async () =>
    submitTransaction(
      depositorConfig,
      await tokenDepositorClient.approve(
        {
          owner: depositorPublicKey,
          spender: arkaOneContractId,
          amount: 2000n,
          expiration_ledger: 1_000_000,
        },
        mergeCallOptions(undefined, true),
      ),
    ),
  );

  await runStep("token.approve.arka_two", async () =>
    submitTransaction(
      depositorConfig,
      await tokenDepositorClient.approve(
        {
          owner: depositorPublicKey,
          spender: arkaTwoContractId,
          amount: 500n,
          expiration_ledger: 1_000_000,
        },
        mergeCallOptions(undefined, true),
      ),
    ),
  );

  await runStep("arka_one.deposit", async () =>
    submitTransaction(
      depositorConfig,
      await arkaDepositorOneClient.deposit(
        {
          user: depositorPublicKey,
          asset: { contract: tokenContractId },
          amount: 2000n,
        },
        mergeCallOptions(undefined, true),
      ),
    ),
  );

  await runStep("arka_two.deposit", async () =>
    submitTransaction(
      depositorConfig,
      await arkaDepositorTwoClient.deposit(
        {
          user: depositorPublicKey,
          asset: { contract: tokenContractId },
          amount: 500n,
        },
        mergeCallOptions(undefined, true),
      ),
    ),
  );
}

function signedConfig(
  rpcUrl: string,
  networkPassphrase: string,
  secret: string,
): NetworkConfig {
  return {
    rpcUrl,
    networkPassphrase,
    allowHttp: true,
    ...createKeypairSigner(secret, networkPassphrase),
  };
}

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required env var: ${name}`);
  }
  return value;
}

async function runStep(name: string, action: () => Promise<void>): Promise<void> {
  console.log(`running ${name}`);
  await action();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
