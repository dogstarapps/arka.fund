import {
  ARKAFUND_MAINNET_ASSETS,
  ArkafundSdk,
  SDK_VERSION,
  createKeypairSigner,
  createMainnetConfig,
  formatAssetAmount,
} from "../dist/src/index.js";

const secret = process.env.ARKA_CANARY_SECRET;
const arkaId = process.env.ARKA_CANARY_ARKA_ID;
const amount = process.env.ARKA_CANARY_AMOUNT ?? "0.01";

if (!secret || !arkaId) {
  throw new Error("ARKA_CANARY_SECRET and ARKA_CANARY_ARKA_ID are required");
}

const network = createMainnetConfig({ fee: "1000000", timeoutInSeconds: 60 });
const signer = createKeypairSigner(secret, network.networkPassphrase);
const sdk = new ArkafundSdk({ ...network, ...signer });
const workflow = sdk.workflow();
const token = sdk.token(ARKAFUND_MAINNET_ASSETS.USDC);
const vault = sdk.vault(arkaId);

const ledgerResponse = await fetch(network.rpcUrl, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "getLatestLedger", params: {} }),
}).then((response) => response.json());
const latestLedger = Number(ledgerResponse.result?.sequence);
if (!Number.isSafeInteger(latestLedger) || latestLedger <= 0) {
  throw new Error("Mainnet RPC did not return a valid latest ledger");
}

const before = {
  walletBalance: await token.balance(signer.publicKey),
  vaultNav: await vault.nav(),
};
const operation = await workflow.depositWithApproval({
  arkaId,
  account: signer.publicKey,
  assetContract: ARKAFUND_MAINNET_ASSETS.USDC,
  amount,
}, latestLedger + 1000);
const mintedShares = operation.deposit.simulationResult;
if (typeof mintedShares !== "bigint" || mintedShares <= 0n) {
  throw new Error("The deposit did not return a positive share amount");
}

const redemption = await workflow.redeem({
  arkaId,
  account: signer.publicKey,
  shares: formatAssetAmount(mintedShares, 7),
});
const after = {
  walletBalance: await token.balance(signer.publicKey),
  vaultNav: await vault.nav(),
};

console.log(JSON.stringify({
  kind: "published_sdk_mainnet_canary",
  executedAt: new Date().toISOString(),
  package: `@arkafund/sdk@${SDK_VERSION}`,
  network: "mainnet",
  account: signer.publicKey,
  arkaId,
  amount: { asset: "USDC", human: amount, decimals: 7 },
  approval: operation.approval ? {
    hash: operation.approval.hash,
    status: operation.approval.getResponse?.status,
  } : null,
  deposit: {
    hash: operation.deposit.hash,
    status: operation.deposit.getResponse?.status,
    mintedSharesBase: mintedShares.toString(),
  },
  redemption: {
    hash: redemption.hash,
    status: redemption.getResponse?.status,
    returnedAmountBase: typeof redemption.simulationResult === "bigint"
      ? redemption.simulationResult.toString()
      : null,
  },
  state: {
    walletBalanceBefore: before.walletBalance.toString(),
    walletBalanceAfter: after.walletBalance.toString(),
    vaultNavBefore: before.vaultNav.toString(),
    vaultNavAfter: after.vaultNav.toString(),
  },
}, null, 2));
