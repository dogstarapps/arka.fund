import { Account, Address, BASE_FEE, Contract, Networks, StrKey, TransactionBuilder, scValToNative, xdr } from "@stellar/stellar-sdk";
import { SIM_ACCOUNT } from "@/lib/config";
import deployment from "../../../config/deployments.mainnet.json";
import type { ArkaHolderPage } from "./types";

const MAX_HOLDERS = 12;

export async function readCurrentHolderLedger(page: ArkaHolderPage, arkaId: string): Promise<number | undefined> {
  if (page.arkaId !== arkaId || !StrKey.isValidContract(arkaId) ||
      page.offset !== 0 || page.total > MAX_HOLDERS || page.items.length !== page.total ||
      new Set(page.items.map(item => item.holder)).size !== page.total) return;

  const rpcUrl = process.env.NEXT_PUBLIC_SOROBAN_RPC_URL ?? deployment.rpcUrl;
  const signal = AbortSignal.timeout(3_000);
  const contract = new Contract(arkaId);

  async function read(method: string, args: xdr.ScVal[] = []) {
    const transaction = new TransactionBuilder(new Account(SIM_ACCOUNT, "0"), {
      fee: BASE_FEE,
      networkPassphrase: Networks.PUBLIC,
    }).addOperation(contract.call(method, ...args)).setTimeout(0).build();
    const response = await fetch(rpcUrl, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0", id: 1, method: "simulateTransaction",
        params: { transaction: transaction.toXDR() },
      }),
      cache: "no-store",
      redirect: "error",
      signal,
    });
    if (!response.ok) throw new Error("Stellar simulation unavailable");
    const { result } = await response.json();
    if (!Number.isSafeInteger(result?.latestLedger) || !result?.results?.[0]?.xdr) {
      throw new Error("Stellar simulation returned no balance");
    }
    const shares = scValToNative(xdr.ScVal.fromXDR(result.results[0].xdr, "base64"));
    if (typeof shares !== "bigint") throw new Error("Unsupported balance");
    return { shares, ledger: result.latestLedger as number };
  }

  try {
    const [supply, ...balances] = await Promise.all([
      read("total_shares"),
      ...page.items.map(item => read("shares_of", [Address.fromString(item.holder).toScVal()])),
    ]);
    if (supply.shares < BigInt(0) || supply.shares.toString() !== page.totalShares ||
        balances.some((balance, i) => balance.ledger !== supply.ledger || balance.shares <= BigInt(0)
          || balance.shares.toString() !== page.items[i].shares)) return;
    const sum = balances.reduce((total, balance) => total + balance.shares, BigInt(0));
    return sum === supply.shares ? supply.ledger : undefined;
  } catch {
    return;
  }
}
