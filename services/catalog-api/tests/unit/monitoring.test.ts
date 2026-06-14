import test from "node:test";
import assert from "node:assert/strict";
import {
  buildMonitoringNotificationEvent,
  buildMonitoringStatus,
  buildSnapshot,
  createEmptyMonitoringArchive,
  defaultMonitoringThresholds,
  reconcileMonitoringAlerts,
  signPayload,
  WebhookMonitoringNotifier,
} from "../../src/index.js";
import type {
  AlertTransition,
  MonitoringStatus,
  SyncRunRecord,
} from "../../src/index.js";

test("buildMonitoringStatus treats warnings as degraded but healthy", () => {
  const snapshot = buildSnapshot([], [], "2026-03-27T10:00:00.000Z");
  const archive = createEmptyMonitoringArchive(10);
  const run: SyncRunRecord = {
    runId: "run-1",
    startedAt: "2026-03-27T10:00:00.000Z",
    finishedAt: "2026-03-27T10:00:02.000Z",
    durationMs: 2_000,
    status: "success",
    indexedArkas: 0,
    failedArkas: 0,
    totalArkas: 0,
    totalNav: "0",
    errorMessage: null,
  };
  archive.runs.push(run);

  const status = buildMonitoringStatus(
    snapshot,
    archive,
    {
      ...defaultMonitoringThresholds(),
      maxSyncDurationMs: 1_000,
    },
    "2026-03-27T10:00:03.000Z",
  );

  assert.equal(status.healthy, true);
  assert.equal(status.degraded, true);
  assert.equal(status.activeAlerts[0]?.kind, "sync_slow");
});

test("reconcileMonitoringAlerts emits trigger and resolve transitions", () => {
  const triggered = reconcileMonitoringAlerts(
    [],
    [
      {
        kind: "partial_sync_failures",
        severity: "warning",
        message: "failure ratio exceeded threshold",
      },
    ],
    "2026-03-27T10:00:00.000Z",
  );
  assert.equal(triggered.transitions[0]?.action, "triggered");
  assert.equal(triggered.alerts[0]?.active, true);

  const resolved = reconcileMonitoringAlerts(
    triggered.alerts,
    [],
    "2026-03-27T10:05:00.000Z",
  );
  assert.equal(resolved.transitions[0]?.action, "resolved");
  assert.equal(resolved.alerts[0]?.active, false);
  assert.equal(resolved.alerts[0]?.lastResolvedAt, "2026-03-27T10:05:00.000Z");
});

test("WebhookMonitoringNotifier signs and posts monitoring payloads", async () => {
  let capturedUrl = "";
  let capturedInit: RequestInit | undefined;
  const notifier = new WebhookMonitoringNotifier({
    url: "https://alerts.example.test/hooks/catalog",
    secret: "super-secret",
    timeoutMs: 100,
    fetchImpl: async (url, init) => {
      capturedUrl = String(url);
      capturedInit = init;
      return new Response(null, { status: 204 });
    },
  });

  const transitions: AlertTransition[] = [
    {
      kind: "sync_failed",
      action: "triggered",
      alert: {
        kind: "sync_failed",
        severity: "critical",
        message: "Last sync failed",
        active: true,
        firstTriggeredAt: "2026-03-27T10:00:00.000Z",
        lastTriggeredAt: "2026-03-27T10:00:00.000Z",
        lastResolvedAt: null,
      },
    },
  ];
  const status = monitoringStatusFixture();
  const event = buildMonitoringNotificationEvent(
    transitions,
    status,
    "2026-03-27T12:00:00.000Z",
  );

  await notifier.notify(event);

  assert.equal(capturedUrl, "https://alerts.example.test/hooks/catalog");
  assert.ok(capturedInit);
  assert.equal(capturedInit?.method, "POST");
  const body = String(capturedInit?.body);
  assert.equal(
    (capturedInit?.headers as Record<string, string>)["x-arkafund-signature"],
    signPayload("super-secret", body),
  );
  assert.equal(
    JSON.parse(body).transitions[0].kind,
    "sync_failed",
  );
});

function monitoringStatusFixture(): MonitoringStatus {
  return {
    healthy: false,
    degraded: true,
    evaluatedAt: "2026-03-27T12:00:00.000Z",
    snapshotAgeSeconds: 0,
    consecutiveFailures: 1,
    lastRun: null,
    activeAlerts: [
      {
        kind: "sync_failed",
        severity: "critical",
        message: "Last sync failed",
      },
    ],
    thresholds: defaultMonitoringThresholds(),
  };
}
