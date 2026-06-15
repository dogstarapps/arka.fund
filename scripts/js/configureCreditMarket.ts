import { Client as ArkaClient, type CreditProtocol } from "../../services/catalog-api/src/generated/arka.ts";
import { getRequiredEnv, makeSignTransaction, signAndSendTx } from "./governorCommon.ts";

function asPositiveInt(name: string, raw: string): bigint {
  const parsed = BigInt(raw);
  if (parsed < 0n) {
    throw new Error(`${name} must be non-negative`);
  }
  return parsed;
}

function asBool(name: string, raw: string): boolean {
  if (raw === "true") {
    return true;
  }
  if (raw === "false") {
    return false;
  }
  throw new Error(`${name} must be "true" or "false"`);
}

function protocolFromEnv(raw: string): CreditProtocol {
  if (raw === "Blend") {
    return { tag: "Blend", values: undefined };
  }
  throw new Error(`Unsupported credit protocol: ${raw}`);
}

async function main() {
  const contractId = getRequiredEnv("ARKA_CONTRACT_ID");
  const adminSecret = getRequiredEnv("ADMIN_SECRET");
  const caller = getRequiredEnv("CALLER_ADDRESS");
  const adapter = getRequiredEnv("ADAPTER_CONTRACT_ID");
  const rpcUrl = getRequiredEnv("RPC_URL");
  const networkPassphrase = getRequiredEnv("NETWORK_PASSPHRASE");
  const protocol = protocolFromEnv(getRequiredEnv("CREDIT_PROTOCOL"));
  const marketId = asPositiveInt("MARKET_ID", getRequiredEnv("MARKET_ID"));
  const allowSupply = asBool("ALLOW_SUPPLY", getRequiredEnv("ALLOW_SUPPLY"));
  const allowBorrow = asBool("ALLOW_BORROW", getRequiredEnv("ALLOW_BORROW"));
  const allowRepay = asBool("ALLOW_REPAY", getRequiredEnv("ALLOW_REPAY"));
  const allowWithdraw = asBool("ALLOW_WITHDRAW", getRequiredEnv("ALLOW_WITHDRAW"));
  const enabled = asBool("ENABLED", getRequiredEnv("ENABLED"));

  const signTransaction = makeSignTransaction(adminSecret, networkPassphrase);
  const client = new ArkaClient({
    contractId,
    rpcUrl,
    networkPassphrase,
    publicKey: caller,
    signTransaction,
  });

  const assembled = await client.configure_credit_market(
    {
      caller,
      protocol,
      market_id: marketId,
      adapter,
      allow_supply: allowSupply,
      allow_borrow: allowBorrow,
      allow_repay: allowRepay,
      allow_withdraw: allowWithdraw,
      enabled,
    },
    { simulate: true },
  );

  const sent = await signAndSendTx(assembled, adminSecret, networkPassphrase, rpcUrl);
  const status = (sent.getResponse as { result?: { status?: string } })?.result?.status;
  if (status !== "SUCCESS") {
    throw new Error(
      `configure_credit_market failed: ${JSON.stringify(
        {
          hash: sent.hash,
          sendResponse: sent.sendResponse,
          getResponse: sent.getResponse,
        },
        null,
        2,
      )}`,
    );
  }

  process.stdout.write(
    `${JSON.stringify(
      {
        hash: sent.hash,
        status,
      },
      null,
      2,
    )}\n`,
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
