import { describe, expect, it } from "vitest";
import type {
  ActivityEntry,
  ActivityKind,
  CatalogAssetPrice,
  Page,
} from "@/lib/catalog/types";
import {
  deriveProjectedAllocationShiftBps,
  deriveRebalanceGuardrailActivityState,
  emptyRebalanceGuardrailActivityState,
} from "@/lib/workflows/rebalanceGuardrailState";

const NOW = new Date("2026-05-18T12:00:00.000Z");
const XLM = "CXLM";
const USDC = "CUSDC";

function assetPrice(
  assetContract: string,
  priceUsd: string,
  decimals: number,
  stablecoin = false,
): CatalogAssetPrice {
  return {
    assetContract,
    priceUsd,
    decimals,
    timestamp: NOW.toISOString(),
    oracleStatus: stablecoin ? "not_required_usd_stablecoin" : "verified",
    valuationSource: stablecoin ? "usd_stablecoin_parity" : "oracle_verified",
    primaryUsable: stablecoin ? null : true,
    secondaryUsable: stablecoin ? null : true,
    unavailableReason: null,
    observedAt: NOW.toISOString(),
  };
}

function activityEntry(
  overrides: Partial<ActivityEntry> & {
    eventId: string;
    kind: ActivityKind;
    ledgerClosedAt: string;
  },
): ActivityEntry {
  return {
    cursor: overrides.eventId,
    arkaId: "TEST_ARKA",
    manager: "GMANAGER",
    ledger: 100,
    txHash: `TX_${overrides.eventId}`,
    transactionIndex: 0,
    operationIndex: 0,
    inSuccessfulContractCall: true,
    user: null,
    assetContract: "CASSET",
    marketId: null,
    amount: null,
    shares: null,
    netOut: null,
    stepCount: 1,
    ...overrides,
  };
}

function activityPage(items: ActivityEntry[]): Page<ActivityEntry> {
  return {
    total: items.length,
    offset: 0,
    limit: items.length,
    items,
  };
}

describe("rebalance guardrail activity state", () => {
  it("derives a same-asset allocation shift without requiring an oracle", () => {
    expect(deriveProjectedAllocationShiftBps({
      amountBase: 5_000_000,
      vaultNavBase: 100_000_000,
      assetIn: "CXLM",
      denominationAsset: "CXLM",
    })).toBe(500);
  });

  it("normalizes different assets through verified USD prices", () => {
    const common = {
      decimals: 14,
      timestamp: "2026-07-19T12:00:00.000Z",
      valuationSource: "oracle_guard" as const,
      primaryUsable: true,
      secondaryUsable: true,
      unavailableReason: null,
      observedAt: "2026-07-19T12:00:01.000Z",
    };
    expect(deriveProjectedAllocationShiftBps({
      amountBase: 10_000_000,
      vaultNavBase: 1_000_000_000,
      assetIn: "CUSDC",
      denominationAsset: "CXLM",
      assetInPrice: {
        ...common,
        assetContract: "CUSDC",
        priceUsd: "10000000",
        decimals: 7,
        oracleStatus: "not_required_usd_stablecoin",
        valuationSource: "usd_stablecoin_parity",
      },
      denominationPrice: {
        ...common,
        assetContract: "CXLM",
        priceUsd: "20000000000000",
        oracleStatus: "verified",
        valuationSource: "oracle_verified",
      },
    })).toBe(500);
  });

  it("fails closed when a cross-asset price is unavailable", () => {
    expect(deriveProjectedAllocationShiftBps({
      amountBase: 10_000_000,
      vaultNavBase: 1_000_000_000,
      assetIn: "CUSDC",
      denominationAsset: "CXLM",
      assetInPrice: null,
      denominationPrice: null,
    })).toBeUndefined();
  });

  it("derives daily turnover only from successful manager/protocol activity inside the rolling 24h window", () => {
    const state = deriveRebalanceGuardrailActivityState(
      activityPage([
        activityEntry({
          eventId: "borrow-live",
          kind: "borrow",
          ledgerClosedAt: "2026-05-18T11:00:00.000Z",
          amount: "7000000",
        }),
        activityEntry({
          eventId: "withdraw-live",
          kind: "withdraw",
          ledgerClosedAt: "2026-05-18T10:30:00.000Z",
          netOut: "3000000",
        }),
        activityEntry({
          eventId: "deposit-user-flow",
          kind: "deposit",
          ledgerClosedAt: "2026-05-18T10:00:00.000Z",
          amount: "99000000",
        }),
        activityEntry({
          eventId: "failed-borrow",
          kind: "borrow",
          ledgerClosedAt: "2026-05-18T09:00:00.000Z",
          amount: "5000000",
          inSuccessfulContractCall: false,
        }),
        activityEntry({
          eventId: "future-repay",
          kind: "repay",
          ledgerClosedAt: "2026-05-18T13:00:00.000Z",
          amount: "9000000",
        }),
        activityEntry({
          eventId: "stale-lend",
          kind: "lend",
          ledgerClosedAt: "2026-05-17T11:59:59.000Z",
          amount: "11000000",
        }),
      ]),
      { denominationAsset: "CASSET" },
      NOW,
    );

    expect(state.source).toBe("catalog_activity");
    expect(state.dailyTurnoverUsedBase).toBe(10_000_000);
    expect(state.eventCount).toBe(6);
    expect(state.includedEventCount).toBe(2);
    expect(state.excludedEventCount).toBe(4);
    expect(state.windowStartedAt).toBe("2026-05-17T12:00:00.000Z");
    expect(state.evaluatedAt).toBe(NOW.toISOString());
    expect(state.latestActivityAt).toBe("2026-05-18T13:00:00.000Z");
    expect(state.note).toContain("2 indexed manager/protocol events");
  });

  it("reports catalog activity as loaded with zero turnover when no relevant events qualify", () => {
    const state = deriveRebalanceGuardrailActivityState(
      activityPage([
        activityEntry({
          eventId: "deposit-only",
          kind: "deposit",
          ledgerClosedAt: "2026-05-18T11:00:00.000Z",
          amount: "1000000",
        }),
        activityEntry({
          eventId: "malformed-borrow",
          kind: "borrow",
          ledgerClosedAt: "2026-05-18T11:15:00.000Z",
          amount: "1.5",
        }),
      ]),
      { denominationAsset: "CASSET" },
      NOW,
    );

    expect(state.source).toBe("catalog_activity");
    expect(state.dailyTurnoverUsedBase).toBe(0);
    expect(state.includedEventCount).toBe(0);
    expect(state.excludedEventCount).toBe(2);
    expect(state.note).toContain("no successful manager/protocol turnover events");
  });

  it("values mixed-asset turnover in the Arka denomination", () => {
    const state = deriveRebalanceGuardrailActivityState(
      activityPage([
        activityEntry({
          eventId: "xlm-lend",
          kind: "lend",
          ledgerClosedAt: "2026-05-18T11:00:00.000Z",
          assetContract: XLM,
          amount: "50000000",
        }),
        activityEntry({
          eventId: "usdc-borrow",
          kind: "borrow",
          ledgerClosedAt: "2026-05-18T10:00:00.000Z",
          assetContract: USDC,
          amount: "20000000",
        }),
      ]),
      {
        denominationAsset: XLM,
        pricesByAsset: new Map([
          [XLM, assetPrice(XLM, "20000000000000", 14)],
          [USDC, assetPrice(USDC, "10000000", 7, true)],
        ]),
      },
      NOW,
    );

    expect(state.dailyTurnoverUsedBase).toBe(150_000_000);
    expect(state.note).toContain("valued in the Arka denomination");
  });

  it("fails closed when a turnover asset has no verified denomination price", () => {
    const state = deriveRebalanceGuardrailActivityState(
      activityPage([
        activityEntry({
          eventId: "unpriced-borrow",
          kind: "borrow",
          ledgerClosedAt: "2026-05-18T10:00:00.000Z",
          assetContract: USDC,
          amount: "20000000",
        }),
      ]),
      {
        denominationAsset: XLM,
        pricesByAsset: new Map([[XLM, assetPrice(XLM, "20000000000000", 14)]]),
      },
      NOW,
    );

    expect(state.dailyTurnoverUsedBase).toBeUndefined();
    expect(state.includedEventCount).toBe(1);
    expect(state.note).toContain("cannot be valued");
  });

  it("keeps turnover undefined when indexed activity is unavailable", () => {
    const state = emptyRebalanceGuardrailActivityState(NOW);

    expect(state.source).toBe("unavailable");
    expect(state.dailyTurnoverUsedBase).toBeUndefined();
    expect(state.windowStartedAt).toBe("2026-05-17T12:00:00.000Z");
    expect(state.evaluatedAt).toBe(NOW.toISOString());
    expect(state.note).toContain("state-required");
  });
});
