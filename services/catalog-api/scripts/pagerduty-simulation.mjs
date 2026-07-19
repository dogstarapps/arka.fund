import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import {
  buildSnapshot,
  CatalogService,
  FileCatalogHistoryStore,
  FileCatalogStore,
  FileMonitoringStore,
  PagerDutyMonitoringNotifier,
  StaticCatalogSyncRunner,
} from "../dist/src/index.js";

const routingKey = process.env.ARKA_PAGERDUTY_ROUTING_KEY;
if (!routingKey) {
  throw new Error("ARKA_PAGERDUTY_ROUTING_KEY is required");
}

const outputPath = resolve(
  process.env.ARKA_PAGERDUTY_OUTPUT_FILE ??
    "../../docs-site/pagerduty-monitoring-cycle.json",
);
const runId = `arka-monitoring-${new Date().toISOString().replace(/[^0-9]/g, "").slice(0, 14)}`;
const directory = await mkdtemp(join(tmpdir(), "arka-pagerduty-e2e-"));
const receipts = [];
let run = 0;

const healthyArka = arka(
  "CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
  "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF",
);
const recoveredArka = arka(
  "CBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB",
  "GCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCC",
);

const runner = new StaticCatalogSyncRunner(async () => {
  run += 1;
  const syncedAt = new Date().toISOString();
  if (run === 1) {
    return buildSnapshot(
      [healthyArka],
      [{
        arkaId: recoveredArka.arkaId,
        message: "Controlled Stellar RPC timeout for monitoring simulation",
        syncedAt,
      }],
      syncedAt,
    );
  }
  return buildSnapshot([healthyArka, recoveredArka], [], syncedAt);
});

const notifier = new PagerDutyMonitoringNotifier({
  routingKey,
  source: "catalog.arka.fund monitoring simulation",
  dedupPrefix: runId,
  onDelivery: (receipt) => receipts.push(receipt),
});

const service = new CatalogService(
  new FileCatalogStore(join(directory, "snapshot.json")),
  new FileCatalogHistoryStore(join(directory, "history.json")),
  runner,
  {
    monitoringStore: new FileMonitoringStore(join(directory, "monitoring.json")),
    monitoringThresholds: {
      maxSnapshotAgeSeconds: 300,
      maxSyncDurationMs: 60_000,
      maxFailureRatio: 0.25,
      maxConsecutiveFailures: 2,
    },
    notifier,
  },
);

const firstSnapshot = await service.sync();
const triggeredStatus = await service.monitoringStatus();
const secondSnapshot = await service.sync();
const resolvedStatus = await service.monitoringStatus();
const alerts = await service.monitoringAlerts();

if (receipts.length !== 2) {
  throw new Error(`Expected two PagerDuty deliveries, received ${receipts.length}`);
}
if (receipts[0].transition !== "triggered" || receipts[1].transition !== "resolved") {
  throw new Error("PagerDuty transition order was not triggered then resolved");
}
if (receipts[0].dedupKey !== receipts[1].dedupKey) {
  throw new Error("PagerDuty trigger and resolution used different deduplication keys");
}
if (!triggeredStatus.degraded || resolvedStatus.degraded) {
  throw new Error("Monitoring status did not transition from degraded to recovered");
}

const monitoringCycle = {
  schemaVersion: 1,
  kind: "pagerduty_monitoring_e2e",
  runId,
  generatedAt: new Date().toISOString(),
  scenario: {
    failure: "One of two Arkas returns a controlled RPC timeout during sync.",
    recovery: "The following sync indexes both Arkas successfully.",
  },
  trigger: {
    failedArkas: firstSnapshot.failures.length,
    monitoring: triggeredStatus,
    pagerDuty: receipts[0],
  },
  recovery: {
    failedArkas: secondSnapshot.failures.length,
    monitoring: resolvedStatus,
    pagerDuty: receipts[1],
  },
  alertHistory: alerts,
};

await writeFile(outputPath, `${JSON.stringify(monitoringCycle, null, 2)}\n`, "utf8");
console.log(JSON.stringify({ outputPath, runId, receipts }, null, 2));

function arka(arkaId, manager) {
  const syncedAt = new Date().toISOString();
  return {
    arkaId,
    manager,
    curated: true,
    delisted: false,
    nav: "10000000",
    denominationContract: null,
    whitelistContracts: [],
    shareToken: null,
    fees: { mgmtBps: 0, perfBps: 0, depositBps: 0, redeemBps: 0 },
    assets: [],
    syncedAt,
  };
}
