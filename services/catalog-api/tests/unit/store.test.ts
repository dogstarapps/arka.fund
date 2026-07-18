import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  buildSnapshot,
  FileCatalogHistoryStore,
  FileCatalogStore,
  FileIdentityStore,
  FileMonitoringStore,
} from "../../src/index.js";

test("FileCatalogStore writes and reads snapshots atomically", async () => {
  const directory = await mkdtemp(join(tmpdir(), "catalog-store-"));
  const store = new FileCatalogStore(join(directory, "snapshot.json"));
  const snapshot = buildSnapshot([], [], "2026-03-27T10:00:00.000Z");

  await store.write(snapshot);
  const loaded = await store.read();

  assert.deepEqual(loaded, snapshot);
});

test("FileCatalogStore returns null when no snapshot exists", async () => {
  const directory = await mkdtemp(join(tmpdir(), "catalog-store-empty-"));
  const store = new FileCatalogStore(join(directory, "snapshot.json"));
  assert.equal(await store.read(), null);
});

test("FileCatalogHistoryStore appends and retains bounded run history", async () => {
  const directory = await mkdtemp(join(tmpdir(), "catalog-history-"));
  const store = new FileCatalogHistoryStore(join(directory, "history.json"), 2);

  await store.append(buildSnapshot([], [], "2026-03-27T10:00:00.000Z"));
  await store.append(buildSnapshot([], [], "2026-03-27T11:00:00.000Z"));
  const history = await store.append(buildSnapshot([], [], "2026-03-27T12:00:00.000Z"));

  assert.equal(history.runs.length, 2);
  assert.deepEqual(
    history.runs.map((run) => run.syncedAt),
    ["2026-03-27T11:00:00.000Z", "2026-03-27T12:00:00.000Z"],
  );
});

test("FileMonitoringStore appends run history and persists alert state", async () => {
  const directory = await mkdtemp(join(tmpdir(), "catalog-monitoring-"));
  const store = new FileMonitoringStore(join(directory, "monitoring.json"), 2);

  await store.append({
    runId: "run-1",
    startedAt: "2026-03-27T10:00:00.000Z",
    finishedAt: "2026-03-27T10:00:01.000Z",
    durationMs: 1_000,
    status: "success",
    indexedArkas: 2,
    failedArkas: 0,
    totalArkas: 2,
    totalNav: "2500",
    errorMessage: null,
  });
  await store.append({
    runId: "run-2",
    startedAt: "2026-03-27T11:00:00.000Z",
    finishedAt: "2026-03-27T11:00:02.000Z",
    durationMs: 2_000,
    status: "failure",
    indexedArkas: 0,
    failedArkas: 0,
    totalArkas: 0,
    totalNav: "0",
    errorMessage: "sync failed",
  });
  await store.append({
    runId: "run-3",
    startedAt: "2026-03-27T12:00:00.000Z",
    finishedAt: "2026-03-27T12:00:03.000Z",
    durationMs: 3_000,
    status: "success",
    indexedArkas: 2,
    failedArkas: 0,
    totalArkas: 2,
    totalNav: "3000",
    errorMessage: null,
  });
  const updated = await store.replaceAlerts([
    {
      kind: "sync_slow",
      severity: "warning",
      message: "Last sync run took 3000ms",
      active: true,
      firstTriggeredAt: "2026-03-27T12:00:03.000Z",
      lastTriggeredAt: "2026-03-27T12:00:03.000Z",
      lastResolvedAt: null,
    },
  ]);

  assert.equal(updated.runs.length, 2);
  assert.deepEqual(
    updated.runs.map((run) => run.runId),
    ["run-2", "run-3"],
  );
  assert.equal(updated.alerts[0]?.kind, "sync_slow");
  assert.equal(updated.alerts[0]?.active, true);
});

test("FileIdentityStore persists Arka and manager public profile metadata", async () => {
  const directory = await mkdtemp(join(tmpdir(), "catalog-identity-"));
  const store = new FileIdentityStore(join(directory, "identity.json"));
  const archive = await store.read();

  await store.write({
    ...archive,
    updatedAt: "2026-07-07T10:00:00.000Z",
    arkas: {
      CARKA: {
        arkaId: "CARKA",
        manager: "GMANAGER",
        displayName: "Stellar Growth",
        description: "Public mandate name.",
        avatarUrl: null,
        websiteUrl: "https://arka.fund/",
        socialUrl: null,
        trustState: "unverified",
        updatedAt: "2026-07-07T10:00:00.000Z",
        updatedBy: "GMANAGER",
      },
    },
    managers: {
      GMANAGER: {
        manager: "GMANAGER",
        displayName: "Arka Manager",
        description: null,
        avatarUrl: null,
        websiteUrl: null,
        socialUrl: null,
        trustState: "unverified",
        updatedAt: "2026-07-07T10:00:00.000Z",
        updatedBy: "GMANAGER",
      },
    },
  });

  const loaded = await store.read();
  assert.equal(loaded.arkas.CARKA?.displayName, "Stellar Growth");
  assert.equal(loaded.managers.GMANAGER?.displayName, "Arka Manager");
});
