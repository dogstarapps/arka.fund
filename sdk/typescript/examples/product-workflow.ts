import {
  ARKAFUND_MAINNET_ASSETS,
  ARKAFUND_MAINNET_CONTRACTS,
  ArkafundSdk,
  createMainnetConfig,
  walletSdkConfig,
  type StellarWalletSigner,
} from "@arkafund/sdk";

export async function createProductSdk(
  walletAddress: string,
  wallet: StellarWalletSigner,
) {
  const network = createMainnetConfig();
  const sdk = new ArkafundSdk(walletSdkConfig(network, walletAddress, wallet));
  const workflow = sdk.workflow();

  const [catalogHealth, nav, prices, routing] = await Promise.all([
    workflow.catalog.health(),
    workflow.catalog.nav(),
    workflow.catalog.prices(),
    workflow.routing.status(),
  ]);

  return { sdk, workflow, catalogHealth, nav, prices, routing };
}

export async function prepareManagerSwap(
  walletAddress: string,
  wallet: StellarWalletSigner,
  arkaId: string,
) {
  const { workflow } = await createProductSdk(walletAddress, wallet);
  const plan = await workflow.planRebalance({
    protocol: "AUTO",
    amount: "10",
    tokenIn: ARKAFUND_MAINNET_ASSETS.USDC,
    tokenOut: ARKAFUND_MAINNET_ASSETS.XLM,
    slippagePercent: 0.5,
    readerPubKey: walletAddress,
    vaultNav: "1000",
    dailyTurnoverUsed: "0",
    projectedAllocationShiftPercent: "1",
  });

  return workflow.buildPlannedRebalance(arkaId, walletAddress, plan);
}

export async function createArka(
  walletAddress: string,
  wallet: StellarWalletSigner,
  approvalExpirationLedger: number,
) {
  const { workflow } = await createProductSdk(walletAddress, wallet);
  return workflow.createArkaWithFeeApproval({
    denomination: ARKAFUND_MAINNET_ASSETS.USDC,
    managementFeePercent: "1",
    performanceFeePercent: "15",
    depositFeePercent: "0",
    redemptionFeePercent: "0",
    whitelist: [
      ARKAFUND_MAINNET_ASSETS.USDC,
      ARKAFUND_MAINNET_ASSETS.XLM,
    ],
  }, approvalExpirationLedger);
}

export async function depositUsdc(
  walletAddress: string,
  wallet: StellarWalletSigner,
  arkaId: string,
) {
  const { workflow } = await createProductSdk(walletAddress, wallet);
  return workflow.deposit({
    arkaId,
    account: walletAddress,
    assetContract: ARKAFUND_MAINNET_ASSETS.USDC,
    amount: "25.50",
  });
}

export const mainnetContracts = ARKAFUND_MAINNET_CONTRACTS;
