import { mkdir } from "node:fs/promises";
import { dirname } from "node:path";
import { createCatalogApp } from "./app.js";
import {
  CompositeMonitoringNotifier,
  NoopMonitoringNotifier,
  PagerDutyMonitoringNotifier,
  WebhookMonitoringNotifier,
  type MonitoringNotifier,
} from "./notifier.js";
import { createActivityReaderFromEnv, createCatalogSyncRunnerFromEnv } from "./runtime.js";
import { CatalogService } from "./service.js";
import {
  FileCatalogHistoryStore,
  FileCatalogStore,
  FileIdentityStore,
  FileMonitoringStore,
} from "./store.js";
import type { MonitoringThresholds } from "./types.js";

async function main(): Promise<void> {
  const dataFile = process.env.CATALOG_API_DATA_FILE ?? "./var/catalog-snapshot.json";
  const historyFile = process.env.CATALOG_API_HISTORY_FILE ?? "./var/catalog-history.json";
  const monitoringFile =
    process.env.CATALOG_API_MONITORING_FILE ?? "./var/catalog-monitoring.json";
  const identityFile =
    process.env.CATALOG_API_IDENTITY_FILE ?? "./var/catalog-identity.json";
  const host = process.env.CATALOG_API_HOST ?? "127.0.0.1";
  const port = Number.parseInt(process.env.CATALOG_API_PORT ?? "3100", 10);
  const syncToken = process.env.CATALOG_API_SYNC_TOKEN;
  const historyRetentionRuns = Number.parseInt(
    process.env.CATALOG_API_HISTORY_RETENTION_RUNS ?? "365",
    10,
  );
  const monitoringRetentionRuns = Number.parseInt(
    process.env.CATALOG_API_MONITORING_RETENTION_RUNS ?? "500",
    10,
  );

  await mkdir(dirname(dataFile), { recursive: true });
  await mkdir(dirname(historyFile), { recursive: true });
  await mkdir(dirname(monitoringFile), { recursive: true });
  await mkdir(dirname(identityFile), { recursive: true });

  const runner = createCatalogSyncRunnerFromEnv(process.env);
  const service = new CatalogService(
    new FileCatalogStore(dataFile),
    new FileCatalogHistoryStore(historyFile, historyRetentionRuns),
    runner,
    {
      monitoringStore: new FileMonitoringStore(
        monitoringFile,
        monitoringRetentionRuns,
      ),
      identityStore: new FileIdentityStore(identityFile),
      monitoringThresholds: loadMonitoringThresholds(),
      notifier: loadNotifier(),
      activityReader: createActivityReaderFromEnv(process.env),
    },
  );
  const app = createCatalogApp({ service, syncToken });

  await app.listen({ host, port });
}

function loadMonitoringThresholds(): MonitoringThresholds {
  return {
    maxSnapshotAgeSeconds: Number.parseInt(
      process.env.CATALOG_API_MAX_SNAPSHOT_AGE_SECONDS ?? "300",
      10,
    ),
    maxSyncDurationMs: Number.parseInt(
      process.env.CATALOG_API_MAX_SYNC_DURATION_MS ?? "5000",
      10,
    ),
    maxFailureRatio: Number.parseFloat(
      process.env.CATALOG_API_MAX_FAILURE_RATIO ?? "0.25",
    ),
    maxConsecutiveFailures: Number.parseInt(
      process.env.CATALOG_API_MAX_CONSECUTIVE_FAILURES ?? "2",
      10,
    ),
  };
}

function loadNotifier(): MonitoringNotifier {
  const notifiers: MonitoringNotifier[] = [];
  const webhookUrl = process.env.CATALOG_API_ALERT_WEBHOOK_URL;
  if (webhookUrl) {
    const secret = required("CATALOG_API_ALERT_WEBHOOK_SECRET");
    const timeoutMs = Number.parseInt(
      process.env.CATALOG_API_ALERT_WEBHOOK_TIMEOUT_MS ?? "5000",
      10,
    );
    notifiers.push(
      new WebhookMonitoringNotifier({
        url: webhookUrl,
        secret,
        timeoutMs,
      }),
    );
  }

  const pagerDutyRoutingKey = process.env.CATALOG_API_PAGERDUTY_ROUTING_KEY;
  if (pagerDutyRoutingKey) {
    notifiers.push(
      new PagerDutyMonitoringNotifier({
        routingKey: pagerDutyRoutingKey,
        source: process.env.CATALOG_API_PAGERDUTY_SOURCE ?? "catalog.arka.fund",
        eventsUrl: process.env.CATALOG_API_PAGERDUTY_EVENTS_URL,
        timeoutMs: Number.parseInt(
          process.env.CATALOG_API_PAGERDUTY_TIMEOUT_MS ?? "5000",
          10,
        ),
      }),
    );
  }

  return notifiers.length === 0
    ? new NoopMonitoringNotifier()
    : new CompositeMonitoringNotifier(notifiers);
}

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required env var: ${name}`);
  }
  return value;
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
