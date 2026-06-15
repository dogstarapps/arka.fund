import test from "node:test";
import assert from "node:assert/strict";
import {
  appendSnapshotToHistory,
  buildDashboardComposition,
  buildDashboardOverview,
  buildSnapshot,
  buildArkaPortfolio,
  createEmptyHistoryArchive,
} from "../../src/index.js";
import type {
  ActivityEntry,
  ArkaCatalogEntry,
  MonitoringStatus,
} from "../../src/index.js";

const tokenContract = "CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA";
const altTokenContract = "CFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF";

function fixtureArkas(syncedAt: string): ArkaCatalogEntry[] {
  return [
    {
      arkaId: "CBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB",
      manager: "GCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCC",
      curated: true,
      delisted: false,
      nav: "2030",
      denominationContract: tokenContract,
      whitelistContracts: [tokenContract, altTokenContract],
      shareToken: null,
      fees: { mgmtBps: 0, perfBps: 0, depositBps: 0, redeemBps: 0 },
      assets: [
        {
          assetContract: tokenContract,
          isDenomination: true,
          liquidBalance: "1800",
          collateralAmount: "200",
          debtAmount: "0",
          netManagedAmount: "2000",
          netPositionValue: "200",
          marketIds: ["101"],
          syncedAt,
        },
        {
          assetContract: altTokenContract,
          isDenomination: false,
          liquidBalance: "0",
          collateralAmount: "50",
          debtAmount: "10",
          netManagedAmount: "40",
          netPositionValue: "30",
          marketIds: ["101"],
          syncedAt,
        },
      ],
      syncedAt,
    },
    {
      arkaId: "CDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDD",
      manager: "GEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEE",
      curated: false,
      delisted: false,
      nav: "500",
      denominationContract: tokenContract,
      whitelistContracts: [tokenContract],
      shareToken: null,
      fees: { mgmtBps: 10, perfBps: 20, depositBps: 30, redeemBps: 40 },
      assets: [
        {
          assetContract: tokenContract,
          isDenomination: true,
          liquidBalance: "500",
          collateralAmount: "0",
          debtAmount: "0",
          netManagedAmount: "500",
          netPositionValue: "0",
          marketIds: [],
          syncedAt,
        },
      ],
      syncedAt,
    },
  ];
}

function monitoringStatus(): MonitoringStatus {
  return {
    healthy: true,
    degraded: false,
    evaluatedAt: "2026-03-27T10:00:00.000Z",
    snapshotAgeSeconds: 0,
    consecutiveFailures: 0,
    lastRun: {
      runId: "run-1",
      startedAt: "2026-03-27T10:00:00.000Z",
      finishedAt: "2026-03-27T10:00:01.000Z",
      durationMs: 1000,
      status: "success",
      indexedArkas: 2,
      failedArkas: 0,
      totalArkas: 2,
      totalNav: "2500",
      errorMessage: null,
    },
    activeAlerts: [],
    thresholds: {
      maxSnapshotAgeSeconds: 300,
      maxSyncDurationMs: 5000,
      maxFailureRatio: 0.25,
      maxConsecutiveFailures: 2,
    },
  };
}

function activityEntries(): ActivityEntry[] {
  return [
    {
      eventId: "evt-1",
      cursor: "evt-1",
      arkaId: "CBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB",
      manager: "GCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCC",
      kind: "deposit",
      ledger: 100,
      ledgerClosedAt: "2026-03-27T10:00:10.000Z",
      txHash: "tx-1",
      transactionIndex: 0,
      operationIndex: 0,
      inSuccessfulContractCall: true,
      user: "GUSER1",
      assetContract: tokenContract,
      marketId: null,
      amount: "2000",
      shares: "2000",
      netOut: null,
      stepCount: null,
    },
    {
      eventId: "evt-2",
      cursor: "evt-2",
      arkaId: "CDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDD",
      manager: "GEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEE",
      kind: "redeem",
      ledger: 105,
      ledgerClosedAt: "2026-03-27T10:00:20.000Z",
      txHash: "tx-2",
      transactionIndex: 0,
      operationIndex: 0,
      inSuccessfulContractCall: true,
      user: "GUSER2",
      assetContract: tokenContract,
      marketId: null,
      amount: null,
      shares: "500",
      netOut: "500",
      stepCount: null,
    },
  ];
}

test("buildDashboardOverview derives deltas, monitoring, and activity KPIs", () => {
  const first = buildSnapshot(fixtureArkas("2026-03-27T10:00:00.000Z"), [], "2026-03-27T10:00:00.000Z");
  const second = buildSnapshot(
    [
      {
        ...fixtureArkas("2026-03-27T10:10:00.000Z")[0],
        nav: "2530",
        assets: [
          {
            ...fixtureArkas("2026-03-27T10:10:00.000Z")[0].assets[0],
            liquidBalance: "2300",
            netManagedAmount: "2500",
            netPositionValue: "200",
          },
          fixtureArkas("2026-03-27T10:10:00.000Z")[0].assets[1],
        ],
        syncedAt: "2026-03-27T10:10:00.000Z",
      },
      {
        ...fixtureArkas("2026-03-27T10:10:00.000Z")[1],
        nav: "900",
        assets: [
          {
            ...fixtureArkas("2026-03-27T10:10:00.000Z")[1].assets[0],
            liquidBalance: "900",
            netManagedAmount: "900",
          },
        ],
        syncedAt: "2026-03-27T10:10:00.000Z",
      },
    ],
    [],
    "2026-03-27T10:10:00.000Z",
  );
  const history = appendSnapshotToHistory(
    appendSnapshotToHistory(createEmptyHistoryArchive(10), first),
    second,
  );

  const overview = buildDashboardOverview(
    second,
    history,
    monitoringStatus(),
    { total: 2, offset: 0, limit: 10, items: activityEntries() },
  );

  assert.equal(overview.totalNav, "3430");
  assert.equal(overview.totalNavDelta, "900");
  assert.equal(overview.activity.depositVolume, "2000");
  assert.equal(overview.activity.redeemVolume, "500");
  assert.equal(overview.activity.netUserFlow, "1500");
  assert.equal(overview.monitoring.lastRunStatus, "success");
  assert.ok(overview.largestAssetWeightBps !== null);
});

test("buildDashboardComposition ranks asset contributions against NAV", () => {
  const snapshot = buildSnapshot(fixtureArkas("2026-03-27T10:00:00.000Z"), [], "2026-03-27T10:00:00.000Z");
  const composition = buildDashboardComposition(snapshot);

  assert.equal(composition.totalNav, "2530");
  assert.equal(composition.items[0]?.assetContract, tokenContract);
  assert.equal(composition.items[0]?.navContribution, "2500");
  assert.equal(composition.items[0]?.weightBps, 9881);
  assert.equal(composition.items[1]?.assetContract, altTokenContract);
});

test("buildArkaPortfolio returns ranked composition for a specific Arka", () => {
  const snapshot = buildSnapshot(fixtureArkas("2026-03-27T10:00:00.000Z"), [], "2026-03-27T10:00:00.000Z");
  const portfolio = buildArkaPortfolio(
    snapshot,
    "CBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB",
  );

  assert.ok(portfolio);
  assert.equal(portfolio?.nav, "2030");
  assert.equal(portfolio?.items[0]?.assetContract, tokenContract);
  assert.equal(portfolio?.items[0]?.navContribution, "2000");
  assert.equal(portfolio?.items[1]?.assetContract, altTokenContract);
  assert.equal(portfolio?.items[1]?.navContribution, "30");
});
