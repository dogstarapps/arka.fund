import fs from "fs";
import path from "path";
import { Client as ArkaClient, type CreditProtocol } from "../../services/catalog-api/src/generated/arka.ts";
import { getRequiredEnv, makeSignTransaction, signAndSendTx } from "./governorCommon.ts";

type SentTx = {
  hash?: string;
  status: string | null;
};

const protocol: CreditProtocol = { tag: "Blend", values: undefined };

function asBool(name: string, fallback: boolean): boolean {
  const raw = process.env[name];
  if (raw === undefined || raw.trim() === "") return fallback;
  if (raw === "true") return true;
  if (raw === "false") return false;
  throw new Error(`${name} must be "true" or "false"`);
}

function asBigInt(name: string): bigint {
  const value = BigInt(getRequiredEnv(name));
  if (value <= 0n) throw new Error(`${name} must be positive`);
  return value;
}

function asNonNegativeBigInt(name: string, fallback: bigint): bigint {
  const raw = process.env[name];
  if (!raw) return fallback;
  const value = BigInt(raw);
  if (value < 0n) throw new Error(`${name} must be non-negative`);
  return value;
}

function jsonReplacer(_key: string, value: unknown): unknown {
  return typeof value === "bigint" ? value.toString() : value;
}

async function readResult<T>(label: string, txFactory: () => Promise<{ result: T }>): Promise<T> {
  try {
    const tx = await txFactory();
    return tx.result;
  } catch (error) {
    throw new Error(`${label} simulation failed: ${error instanceof Error ? error.message : String(error)}`);
  }
}

async function safeReadResult<T>(
  label: string,
  txFactory: () => Promise<{ result: T }>,
): Promise<{ ok: true; value: T } | { ok: false; error: string }> {
  try {
    return { ok: true, value: await readResult(label, txFactory) };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

async function send(
  label: string,
  assembled: { toXDR: () => string },
  input: {
    send: boolean;
    adminSecret: string;
    networkPassphrase: string;
    rpcUrl: string;
  },
): Promise<SentTx> {
  if (!input.send) {
    return { hash: undefined, status: "simulated" };
  }
  const sent = await signAndSendTx(
    assembled,
    input.adminSecret,
    input.networkPassphrase,
    input.rpcUrl,
  );
  const status = (sent.getResponse as { result?: { status?: string } })?.result?.status ?? null;
  if (status !== "SUCCESS") {
    throw new Error(
      `${label} failed: ${JSON.stringify(
        {
          hash: sent.hash,
          sendResponse: sent.sendResponse,
          getResponse: sent.getResponse,
        },
        jsonReplacer,
        2,
      )}`,
    );
  }
  return { hash: sent.hash, status };
}

async function main() {
  const contractId = getRequiredEnv("ARKA_CONTRACT_ID");
  const adminSecret = getRequiredEnv("ADMIN_SECRET");
  const caller = getRequiredEnv("CALLER_ADDRESS");
  const adapter = getRequiredEnv("ADAPTER_CONTRACT_ID");
  const asset = getRequiredEnv("ASSET_ID");
  const rpcUrl = getRequiredEnv("RPC_URL");
  const networkPassphrase = getRequiredEnv("NETWORK_PASSPHRASE");
  const outJson = process.env.OUT_JSON ?? "";
  const sendTransactions = asBool("SEND", false);
  const withdrawOnly = asBool("WITHDRAW_ONLY", false);
  const marketId = asNonNegativeBigInt("MARKET_ID", 1n);
  const amount = asBigInt("AMOUNT");
  const allowBorrow = asBool("ALLOW_BORROW", false);
  const allowRepay = asBool("ALLOW_REPAY", false);

  const signTransaction = makeSignTransaction(adminSecret, networkPassphrase);
  const client = new ArkaClient({
    contractId,
    rpcUrl,
    networkPassphrase,
    publicKey: caller,
    signTransaction,
  });

  const before = {
    liquidBalance: await readResult("liquid balance before", () =>
      client.liquid_balance({ asset }, { simulate: true }),
    ),
    creditMarkets: await readResult("credit markets before", () =>
      client.credit_market_configs({ protocol }, { simulate: true }),
    ),
    blendPosition: await readResult("blend position before", () =>
      client.blend_position({ market_id: marketId, asset }, { simulate: true }),
    ),
  };

  if (withdrawOnly) {
    const withdraw = await client.credit_withdraw(
      { manager: caller, protocol, market_id: marketId, asset, amount },
      { simulate: true },
    );
    const withdrawTx = await send("Blend withdraw recovery", withdraw, {
      send: sendTransactions,
      adminSecret,
      networkPassphrase,
      rpcUrl,
    });
    const afterWithdraw = {
      liquidBalance: await readResult("liquid balance after withdraw", () =>
        client.liquid_balance({ asset }, { simulate: true }),
      ),
      blendPosition: await safeReadResult("blend position after withdraw", () =>
        client.blend_position({ market_id: marketId, asset }, { simulate: true }),
      ),
      blendMarketStatus: await safeReadResult("blend market status after withdraw", () =>
        client.blend_market_status({ market_id: marketId }, { simulate: true }),
      ),
    };
    const evidence = {
      network: "mainnet",
      send: sendTransactions,
      arka: contractId,
      manager: caller,
      adapter,
      asset,
      marketId,
      amount,
      before,
      transactions: { withdraw: withdrawTx },
      afterWithdraw,
      status: sendTransactions ? "passed_withdraw_recovery" : "simulated_withdraw_recovery",
      validatedAt: new Date().toISOString(),
    };
    const rendered = JSON.stringify(evidence, jsonReplacer, 2);
    if (outJson) {
      fs.mkdirSync(path.dirname(outJson), { recursive: true });
      fs.writeFileSync(outJson, `${rendered}\n`);
    }
    process.stdout.write(`${rendered}\n`);
    return;
  }

  const configure = await client.configure_credit_market(
    {
      caller,
      protocol,
      market_id: marketId,
      adapter,
      allow_supply: true,
      allow_borrow: allowBorrow,
      allow_repay: allowRepay,
      allow_withdraw: true,
      enabled: true,
    },
    { simulate: true },
  );
  const configureTx = await send("configure Blend credit market", configure, {
    send: sendTransactions,
    adminSecret,
    networkPassphrase,
    rpcUrl,
  });

  const supply = await client.credit_supply(
    { manager: caller, protocol, market_id: marketId, asset, amount },
    { simulate: true },
  );
  const supplyTx = await send("Blend supply canary", supply, {
    send: sendTransactions,
    adminSecret,
    networkPassphrase,
    rpcUrl,
  });

  const afterSupply = {
    liquidBalance: await readResult("liquid balance after supply", () =>
      client.liquid_balance({ asset }, { simulate: true }),
    ),
    blendPosition: await safeReadResult("blend position after supply", () =>
      client.blend_position({ market_id: marketId, asset }, { simulate: true }),
    ),
    blendMarketStatus: await safeReadResult("blend market status after supply", () =>
      client.blend_market_status({ market_id: marketId }, { simulate: true }),
    ),
  };

  const withdraw = await client.credit_withdraw(
    { manager: caller, protocol, market_id: marketId, asset, amount },
    { simulate: true },
  );
  const withdrawTx = await send("Blend withdraw canary", withdraw, {
    send: sendTransactions,
    adminSecret,
    networkPassphrase,
    rpcUrl,
  });

  const afterWithdraw = {
    liquidBalance: await readResult("liquid balance after withdraw", () =>
      client.liquid_balance({ asset }, { simulate: true }),
    ),
    creditMarkets: await readResult("credit markets after withdraw", () =>
      client.credit_market_configs({ protocol }, { simulate: true }),
    ),
    blendPosition: await safeReadResult("blend position after withdraw", () =>
      client.blend_position({ market_id: marketId, asset }, { simulate: true }),
    ),
    blendMarketStatus: await safeReadResult("blend market status after withdraw", () =>
      client.blend_market_status({ market_id: marketId }, { simulate: true }),
    ),
  };

  const evidence = {
    network: "mainnet",
    send: sendTransactions,
    arka: contractId,
    manager: caller,
    adapter,
    asset,
    marketId,
    amount,
    allowBorrow,
    allowRepay,
    before,
    transactions: {
      configure: configureTx,
      supply: supplyTx,
      withdraw: withdrawTx,
    },
    afterSupply,
    afterWithdraw,
    status: sendTransactions ? "passed_supply_withdraw" : "simulated",
    validatedAt: new Date().toISOString(),
  };

  const rendered = JSON.stringify(evidence, jsonReplacer, 2);
  if (outJson) {
    fs.mkdirSync(path.dirname(outJson), { recursive: true });
    fs.writeFileSync(outJson, `${rendered}\n`);
  }
  process.stdout.write(`${rendered}\n`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
