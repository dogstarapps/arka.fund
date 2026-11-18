import type { Page, RankedArkaCatalogEntry } from "./types";

const MAINNET_PASSPHRASE = "Public Global Stellar Network ; September 2015";

type CashFlowEvidence = Record<string, unknown>;

function record(value: unknown): CashFlowEvidence {
  return value && typeof value === "object" && !Array.isArray(value) ? value as CashFlowEvidence : {};
}

function amount(value: unknown): bigint | null {
  return typeof value === "string" && /^-?\d{1,39}$/.test(value) ? BigInt(value) : null;
}

function validLedger(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0;
}

export function mergePreviewProfit(page: Page<RankedArkaCatalogEntry>, evidence: unknown): Page<RankedArkaCatalogEntry> {
  const archive = record(evidence);
  const { indexedThrough, rpcFrom } = archive;
  if (archive.version !== 1 || archive.network !== MAINNET_PASSPHRASE ||
      archive.cashFlowCoverage !== "complete" || !validLedger(indexedThrough) ||
      !validLedger(rpcFrom) || rpcFrom > indexedThrough || !Array.isArray(page.items)) return page;

  const funds = record(archive.funds);
  return {
    ...page,
    items: page.items.map(entry => {
      const row = record(funds[entry.arkaId]);
      const { createdLedger, ledger, asOf, estimated } = row;
      if (!entry.denominationContract || !entry.shareToken || row.denominationContract !== entry.denominationContract ||
          row.shareToken !== entry.shareToken || !validLedger(createdLedger) || !validLedger(ledger) ||
          createdLedger > indexedThrough || ledger < indexedThrough || typeof estimated !== "boolean" ||
          typeof asOf !== "string" || !Number.isFinite(Date.parse(asOf))) return entry;
      const nav = amount(row.nav);
      const withdrawn = amount(row.withdrawals);
      const deposited = amount(row.deposits);
      const profit = amount(row.profit);
      if (nav === null || withdrawn === null || deposited === null || profit === null ||
          [nav, withdrawn, deposited].some(value => value < BigInt(0)) ||
          profit !== nav + withdrawn - deposited) return entry;
      return { ...entry, verifiedProfit: { amount: profit.toString(), asOf, ledger, estimated } };
    }),
  };
}
