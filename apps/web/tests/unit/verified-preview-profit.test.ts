import { describe, expect, it } from "vitest";
import { mergePreviewProfit } from "@/lib/catalog/previewProfit";
import type { RankedArkaCatalogEntry } from "@/lib/catalog/types";

const entry = { arkaId: "fund", denominationContract: "asset", shareToken: "shares" } as RankedArkaCatalogEntry;
const page = { items: [entry], total: 1, limit: 1, offset: 0 };
const cashFlow = {
  denominationContract: "asset", shareToken: "shares", ledger: 120,
  createdLedger: 20, asOf: "2026-11-18T10:55:02Z", estimated: true,
  nav: "20848427829384098765", withdrawals: "401", deposits: "20848427829384099000", profit: "166",
};
const archive = {
  version: 1, network: "Public Global Stellar Network ; September 2015", cashFlowCoverage: "complete",
  indexedThrough: 100, rpcFrom: 99, funds: { fund: cashFlow },
};

describe("verified preview profit", () => {
  it("uses exact arithmetic and retains the date and conversion estimate", () => {
    expect(mergePreviewProfit(page, archive).items[0].verifiedProfit).toEqual({
      amount: "166", asOf: cashFlow.asOf, ledger: 120, estimated: true,
    });
  });

  it("requires continuous coverage and matching fund identity and arithmetic", () => {
    const mismatches = [
      { ...archive, rpcFrom: 101 },
      { ...archive, network: "testnet" },
      { ...archive, cashFlowCoverage: "partial" },
      { ...archive, funds: { fund: { ...cashFlow, shareToken: "another-token" } } },
      { ...archive, funds: { fund: { ...cashFlow, profit: "0" } } },
    ];
    for (const badArchive of mismatches) expect(mergePreviewProfit(page, badArchive).items[0]).toBe(entry);
  });
});
