import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  buildSnapshot,
  CatalogService,
  FileCatalogHistoryStore,
  FileCatalogStore,
  InMemoryMonitoringStore,
  type ActivityQuery,
  type ActivityReader,
  type ArkaCatalogEntry,
  type CatalogSnapshot,
} from "../../src/index.js";

const tokenContract = "CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA";

class ThrowingActivityReader implements ActivityReader {
  async list(): Promise<never> {
    throw new Error("rpc activity unavailable");
  }
}

class StaticRunner {
  constructor(private readonly snapshot: CatalogSnapshot) {}

  async run(): Promise<CatalogSnapshot> {
    return this.snapshot;
  }
}

function fixtureArkas(syncedAt: string): ArkaCatalogEntry[] {
  return [
    {
      arkaId: "CBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB",
      manager: "GCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCC",
      curated: true,
      delisted: false,
      nav: "2000",
      denominationContract: tokenContract,
      whitelistContracts: [tokenContract],
      shareToken: null,
      fees: { mgmtBps: 0, perfBps: 0, depositBps: 0, redeemBps: 0 },
      assets: [
        {
          assetContract: tokenContract,
          isDenomination: true,
          liquidBalance: "2000",
          collateralAmount: "0",
          debtAmount: "0",
          netManagedAmount: "2000",
          netPositionValue: "0",
          marketIds: [],
          syncedAt,
        },
      ],
      syncedAt,
    },
  ];
}

test("CatalogService marks activity unavailable instead of presenting a false empty history", async () => {
  const directory = await mkdtemp(join(tmpdir(), "catalog-service-"));
  const first = buildSnapshot(fixtureArkas("2026-03-28T10:00:00.000Z"), [], "2026-03-28T10:00:00.000Z");
  const second = buildSnapshot(
    [
      {
        ...fixtureArkas("2026-03-28T10:05:00.000Z")[0],
        nav: "2500",
        assets: [
          {
            ...fixtureArkas("2026-03-28T10:05:00.000Z")[0].assets[0],
            liquidBalance: "2500",
            netManagedAmount: "2500",
            syncedAt: "2026-03-28T10:05:00.000Z",
          },
        ],
        syncedAt: "2026-03-28T10:05:00.000Z",
      },
    ],
    [],
    "2026-03-28T10:05:00.000Z",
  );

  const store = new FileCatalogStore(join(directory, "snapshot.json"));
  const historyStore = new FileCatalogHistoryStore(join(directory, "history.json"));
  await store.write(second);
  await historyStore.append(first);
  await historyStore.append(second);

  const service = new CatalogService(
    store,
    historyStore,
    new StaticRunner(second),
    {
      monitoringStore: new InMemoryMonitoringStore(),
      activityReader: new ThrowingActivityReader(),
    },
  );

  const overview = await service.dashboardOverview({ activityLimit: 10 });
  assert.ok(overview);
  assert.equal(overview.totalNav, "2500");
  assert.equal(overview.totalNavDelta, "500");
  assert.equal(overview.activity.depositVolume, "0");
  assert.equal(overview.activity.totalEvents, 0);
  assert.equal(overview.activity.dataStatus, "unavailable");
  assert.equal(overview.activity.unavailableReason, "activity_index_unavailable");

  const nav = await service.navOverview();
  assert.ok(nav);
  assert.equal(nav.totalNav, "2500");
  assert.equal(nav.totalNavDelta, "500");
  assert.equal("activity" in nav, false);

  const activity = await service.activity({ limit: 5 } satisfies ActivityQuery);
  assert.equal(activity.total, 0);
  assert.deepEqual(activity.items, []);
  assert.equal(activity.dataStatus, "unavailable");

  const arkaActivity = await service.arkaActivity(second.arkas[0].arkaId, { limit: 5 });
  assert.equal(arkaActivity.total, 0);
  assert.deepEqual(arkaActivity.items, []);
  assert.equal(arkaActivity.dataStatus, "unavailable");
});
