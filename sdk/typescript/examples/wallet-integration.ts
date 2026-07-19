import {
  ARKAFUND_MAINNET_CONTRACTS,
  ArkafundSdk,
  CatalogClient,
  createMainnetConfig,
  parseAssetAmount,
  type SignedArkafundSdkConfig,
} from "@arkafund/sdk";

export interface WalletIntegrationInput {
  arkaContractId: string;
  walletAddress: string;
  usdcContractId: string;
  xlmContractId: string;
  phoenixRouterContractId: string;
}

export async function inspectArka(arkaContractId: string) {
  const catalog = new CatalogClient();
  const sdk = new ArkafundSdk(createMainnetConfig());
  const indexed = await catalog.arka(arkaContractId);
  const vault = sdk.vault(arkaContractId);
  const [manager, nav, fees, whitelist] = await Promise.all([
    vault.manager(),
    vault.nav(),
    vault.fees(),
    vault.whitelist(),
  ]);

  return { indexed, manager, nav, fees, whitelist };
}

export async function buildWalletTransactions(
  config: SignedArkafundSdkConfig,
  input: WalletIntegrationInput,
) {
  const sdk = new ArkafundSdk(config);
  const vault = sdk.vault(input.arkaContractId);

  const deposit = await vault.buildDeposit({
    user: input.walletAddress,
    asset: { contract: input.usdcContractId },
    amount: parseAssetAmount("25.50", 7),
  });

  const redeem = await vault.buildRedeem({
    user: input.walletAddress,
    shares: parseAssetAmount("5", 7),
  });

  const rebalance = await vault.buildRebalance({
    manager: input.walletAddress,
    steps: [{
      adapter: ARKAFUND_MAINNET_CONTRACTS.adapterPhoenix,
      router: input.phoenixRouterContractId,
      poolId: 0,
      assetIn: input.usdcContractId,
      assetOut: input.xlmContractId,
      amountIn: parseAssetAmount("10", 7),
      minOut: parseAssetAmount("32.5", 7),
    }],
  });

  const blendSupply = await vault.buildBlendLend({
    manager: input.walletAddress,
    adapter: ARKAFUND_MAINNET_CONTRACTS.adapterBlendFixedXlmUsdc,
    marketId: 1,
    asset: input.usdcContractId,
    amount: parseAssetAmount("50", 7),
  });

  return { deposit, redeem, rebalance, blendSupply };
}
