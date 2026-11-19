import { randomUUID } from "node:crypto";
import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { Networks, StrKey } from "@stellar/stellar-sdk";
import type { CatalogSyncRunner } from "./runners.js";
import type { ArkaCatalogEntry, CatalogSnapshot, VerifiedArkaProfit } from "./types.js";

interface FundCheckpoint {
  denominationContract: string;
  shareToken: string;
  codeHash: string;
  createdLedger: number;
  throughLedger: number;
  deposits: string;
  withdrawals: string;
  estimated: boolean;
}

export interface ProfitCheckpoint {
  schemaVersion: 1;
  network: string;
  funds: Record<string, FundCheckpoint>;
}

export interface ProfitSource {
  coverage(): Promise<{ oldestLedger: number; latestLedger: number }>;
  quote(arkaId: string): Promise<{
    ledger: number; nav: bigint; asOf: string; codeHash: string;
    denominationContract: string; shareToken: string;
  }>;
  cashFlows(arkaId: string, denomination: string, from: number, through: number): Promise<{
    kind: "deposit" | "redeem"; amount: bigint; estimated: boolean;
  }[]>;
}

export function withVerifiedProfit(
  runner: CatalogSyncRunner,
  source: ProfitSource,
  files: { seed: string; state: string },
): CatalogSyncRunner {
  if (resolve(files.seed) === resolve(files.state)) {
    throw new Error("Use separate files for the verified profit seed and mutable checkpoint");
  }

  async function run(): Promise<CatalogSnapshot> {
    const snapshot = await runner.run();
    const unpriced = snapshot.arkas.map(arka => setProfit(arka));
    try {
      const seed = parseCheckpoint(JSON.parse(await readFile(files.seed, "utf8")));
      const current = await readCheckpoint(files.state, seed);
      const coverage = await source.coverage();
      if (!validLedger(coverage.oldestLedger) || !validLedger(coverage.latestLedger) ||
          coverage.latestLedger < coverage.oldestLedger) throw new Error("Invalid RPC coverage");
      const next = structuredClone(current);
      const arkas: ArkaCatalogEntry[] = [];
      for (const arka of unpriced) {
        const fund = current.funds[arka.arkaId];
        if (!fund || arka.denominationContract !== fund.denominationContract || arka.shareToken !== fund.shareToken) {
          arkas.push(arka);
          continue;
        }
        try {
          const quote = await source.quote(arka.arkaId);
          if (quote.codeHash !== fund.codeHash || quote.denominationContract !== fund.denominationContract ||
              quote.shareToken !== fund.shareToken || quote.ledger < fund.throughLedger ||
              !validLedger(quote.ledger) || quote.nav < 0n || !Number.isFinite(Date.parse(quote.asOf))) {
            throw new Error("Unverified quote");
          }
          const from = fund.throughLedger + 1;
          let deposits = BigInt(fund.deposits);
          let withdrawals = BigInt(fund.withdrawals);
          let estimated = fund.estimated;
          if (from <= quote.ledger) {
            if (from < coverage.oldestLedger) throw new Error("Gap in cash-flow history");
            const flows = await source.cashFlows(arka.arkaId, fund.denominationContract, from, quote.ledger);
            for (const flow of flows) {
              if (flow.amount < 0n) throw new Error("Invalid cash flow");
              if (flow.kind === "deposit") deposits += flow.amount;
              else withdrawals += flow.amount;
              estimated ||= flow.estimated;
            }
          }
          next.funds[arka.arkaId] = {
            ...fund, throughLedger: quote.ledger,
            deposits: deposits.toString(), withdrawals: withdrawals.toString(), estimated,
          };
          arkas.push(setProfit(arka, {
            amount: (quote.nav + withdrawals - deposits).toString(),
            asOf: quote.asOf, ledger: quote.ledger, estimated,
          }));
        } catch {
          arkas.push(arka);
        }
      }
      if (arkas.some(arka => arka.verifiedProfit)) await writeCheckpoint(files.state, next);
      return { ...snapshot, arkas };
    } catch {
      // A corrupt checkpoint or unavailable source must not take the rest of the catalogue down.
      return { ...snapshot, arkas: unpriced };
    }
  }

  return { run };
}

function setProfit(entry: ArkaCatalogEntry, profit?: VerifiedArkaProfit): ArkaCatalogEntry {
  const result = { ...entry };
  delete result.verifiedProfit;
  if (profit) result.verifiedProfit = profit;
  if (entry.economics) {
    result.economics = { ...entry.economics, pnl: { amount: profit?.amount ?? null, bps: null } };
  }
  return result;
}

function validLedger(value: number): boolean {
  return Number.isSafeInteger(value) && value > 0 && value < 0xffff_ffff;
}

function parseCheckpoint(value: ProfitCheckpoint): ProfitCheckpoint {
  if (value?.schemaVersion !== 1 || value.network !== Networks.PUBLIC ||
      !value.funds || typeof value.funds !== "object" || Array.isArray(value.funds)) {
    throw new Error("Invalid mainnet profit checkpoint");
  }
  for (const [id, fund] of Object.entries(value.funds)) {
    if (!StrKey.isValidContract(id) || !fund || !StrKey.isValidContract(fund.denominationContract) ||
        !StrKey.isValidContract(fund.shareToken) || !/^[0-9a-f]{64}$/.test(fund.codeHash) ||
        !validLedger(fund.createdLedger) || !validLedger(fund.throughLedger) ||
        fund.createdLedger > fund.throughLedger || typeof fund.estimated !== "boolean" ||
        [fund.deposits, fund.withdrawals].some(v => typeof v !== "string" || !/^\d{1,39}$/.test(v))) {
      throw new Error("Invalid Arka profit checkpoint");
    }
  }
  return value;
}

async function readCheckpoint(file: string, seed: ProfitCheckpoint): Promise<ProfitCheckpoint> {
  let raw: string;
  try {
    raw = await readFile(file, "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return seed;
    throw error;
  }
  const stored = parseCheckpoint(JSON.parse(raw));
  for (const [id, initial] of Object.entries(seed.funds)) {
    const current = stored.funds[id];
    if (!current || current.codeHash !== initial.codeHash || current.denominationContract !== initial.denominationContract ||
        current.shareToken !== initial.shareToken || current.createdLedger !== initial.createdLedger ||
        current.throughLedger < initial.throughLedger || BigInt(current.deposits) < BigInt(initial.deposits) ||
        BigInt(current.withdrawals) < BigInt(initial.withdrawals) || (initial.estimated && !current.estimated)) {
      throw new Error("Profit checkpoint does not extend its verified seed");
    }
  }
  if (Object.keys(stored.funds).length !== Object.keys(seed.funds).length) {
    throw new Error("Profit checkpoint contains an unseeded Arka");
  }
  return stored;
}

async function writeCheckpoint(file: string, value: ProfitCheckpoint): Promise<void> {
  const scratch = `${file}.${randomUUID()}.tmp`;
  await mkdir(dirname(file), { recursive: true });
  try {
    await writeFile(scratch, JSON.stringify(parseCheckpoint(value)) + "\n", { flag: "wx", mode: 0o600 });
    await rename(scratch, file);
  } finally {
    await rm(scratch, { force: true });
  }
}
