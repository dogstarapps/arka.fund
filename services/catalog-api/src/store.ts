import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import {
  appendSnapshotToHistory,
  createEmptyHistoryArchive,
} from "./catalog.js";
import {
  appendRunToMonitoringArchive,
  createEmptyMonitoringArchive,
} from "./monitoring.js";
import {
  createEmptyIdentityArchive,
  validateIdentityArchive,
} from "./identity.js";
import type {
  CatalogHistoryArchive,
  IdentityArchive,
  CatalogSnapshot,
  MonitoringArchive,
  MonitoringAlertState,
  SyncRunRecord,
} from "./types.js";

export class FileCatalogStore {
  constructor(private readonly filePath: string) {}

  async read(): Promise<CatalogSnapshot | null> {
    try {
      const payload = await readFile(this.filePath, "utf8");
      return validateSnapshot(JSON.parse(payload) as CatalogSnapshot);
    } catch (error) {
      if (isNotFoundError(error)) {
        return null;
      }
      throw error;
    }
  }

  async write(snapshot: CatalogSnapshot): Promise<void> {
    const validated = validateSnapshot(snapshot);
    await mkdir(dirname(this.filePath), { recursive: true });
    const temporaryPath = `${this.filePath}.tmp`;
    await writeFile(temporaryPath, `${JSON.stringify(validated, null, 2)}\n`, "utf8");
    await rename(temporaryPath, this.filePath);
  }

  async clear(): Promise<void> {
    await rm(this.filePath, { force: true });
  }
}

export class FileCatalogHistoryStore {
  constructor(
    private readonly filePath: string,
    private readonly retentionLimit = 365,
  ) {}

  async read(): Promise<CatalogHistoryArchive> {
    try {
      const payload = await readFile(this.filePath, "utf8");
      return validateHistoryArchive(JSON.parse(payload) as CatalogHistoryArchive);
    } catch (error) {
      if (isNotFoundError(error)) {
        return createEmptyHistoryArchive(this.retentionLimit);
      }
      throw error;
    }
  }

  async append(snapshot: CatalogSnapshot): Promise<CatalogHistoryArchive> {
    const current = await this.read();
    const next = appendSnapshotToHistory(current, snapshot, this.retentionLimit);
    await this.write(next);
    return next;
  }

  async write(archive: CatalogHistoryArchive): Promise<void> {
    const validated = validateHistoryArchive(archive);
    await mkdir(dirname(this.filePath), { recursive: true });
    const temporaryPath = `${this.filePath}.tmp`;
    await writeFile(temporaryPath, `${JSON.stringify(validated, null, 2)}\n`, "utf8");
    await rename(temporaryPath, this.filePath);
  }

  async clear(): Promise<void> {
    await rm(this.filePath, { force: true });
  }
}

export class FileMonitoringStore {
  constructor(
    private readonly filePath: string,
    private readonly retentionLimit = 500,
  ) {}

  async read(): Promise<MonitoringArchive> {
    try {
      const payload = await readFile(this.filePath, "utf8");
      return validateMonitoringArchive(JSON.parse(payload) as MonitoringArchive);
    } catch (error) {
      if (isNotFoundError(error)) {
        return createEmptyMonitoringArchive(this.retentionLimit);
      }
      throw error;
    }
  }

  async append(run: SyncRunRecord): Promise<MonitoringArchive> {
    const current = await this.read();
    const next = appendRunToMonitoringArchive(current, run, this.retentionLimit);
    await this.write(next);
    return next;
  }

  async replaceAlerts(alerts: MonitoringAlertState[]): Promise<MonitoringArchive> {
    const current = await this.read();
    const next: MonitoringArchive = {
      ...current,
      updatedAt: new Date().toISOString(),
      alerts: alerts.map((alert) => ({ ...alert })),
    };
    await this.write(next);
    return next;
  }

  async write(archive: MonitoringArchive): Promise<void> {
    const validated = validateMonitoringArchive(archive);
    await mkdir(dirname(this.filePath), { recursive: true });
    const temporaryPath = `${this.filePath}.tmp`;
    await writeFile(temporaryPath, `${JSON.stringify(validated, null, 2)}\n`, "utf8");
    await rename(temporaryPath, this.filePath);
  }

  async clear(): Promise<void> {
    await rm(this.filePath, { force: true });
  }
}

export class InMemoryMonitoringStore {
  private archive: MonitoringArchive;

  constructor(retentionLimit = 500) {
    this.archive = createEmptyMonitoringArchive(retentionLimit);
  }

  async read(): Promise<MonitoringArchive> {
    return structuredClone(this.archive);
  }

  async append(run: SyncRunRecord): Promise<MonitoringArchive> {
    this.archive = appendRunToMonitoringArchive(this.archive, run, this.archive.retentionLimit);
    return this.read();
  }

  async replaceAlerts(alerts: MonitoringAlertState[]): Promise<MonitoringArchive> {
    this.archive = {
      ...this.archive,
      updatedAt: new Date().toISOString(),
      alerts: alerts.map((alert) => ({ ...alert })),
    };
    return this.read();
  }

  async write(archive: MonitoringArchive): Promise<void> {
    this.archive = validateMonitoringArchive(archive);
  }

  async clear(): Promise<void> {
    this.archive = createEmptyMonitoringArchive(this.archive.retentionLimit);
  }
}

export class FileIdentityStore {
  constructor(private readonly filePath: string) {}

  async read(): Promise<IdentityArchive> {
    try {
      const payload = await readFile(this.filePath, "utf8");
      return validateIdentityArchive(JSON.parse(payload) as IdentityArchive);
    } catch (error) {
      if (isNotFoundError(error)) {
        return createEmptyIdentityArchive();
      }
      throw error;
    }
  }

  async write(archive: IdentityArchive): Promise<void> {
    const validated = validateIdentityArchive(archive);
    await mkdir(dirname(this.filePath), { recursive: true });
    const temporaryPath = `${this.filePath}.tmp`;
    await writeFile(temporaryPath, `${JSON.stringify(validated, null, 2)}\n`, "utf8");
    await rename(temporaryPath, this.filePath);
  }

  async clear(): Promise<void> {
    await rm(this.filePath, { force: true });
  }
}

export class InMemoryIdentityStore {
  private archive: IdentityArchive = createEmptyIdentityArchive();

  async read(): Promise<IdentityArchive> {
    return structuredClone(this.archive);
  }

  async write(archive: IdentityArchive): Promise<void> {
    this.archive = validateIdentityArchive(archive);
  }

  async clear(): Promise<void> {
    this.archive = createEmptyIdentityArchive();
  }
}

function validateSnapshot(snapshot: CatalogSnapshot): CatalogSnapshot {
  if (![1, 2, 3].includes(snapshot.schemaVersion)) {
    throw new Error(`Unsupported snapshot schema version: ${snapshot.schemaVersion}`);
  }
  if (
    !Array.isArray(snapshot.arkas) ||
    !Array.isArray(snapshot.managers) ||
    !Array.isArray(snapshot.failures)
  ) {
    throw new Error("Snapshot payload is missing required catalog collections");
  }
  const normalizedArkas = snapshot.arkas.map((arka) => ({
    ...arka,
    denominationContract:
      arka.denominationContract ?? arka.whitelistContracts?.[0] ?? null,
    assets: Array.isArray(arka.assets) ? arka.assets : [],
  }));
  return {
    ...snapshot,
    schemaVersion: 3,
    metrics: {
      ...snapshot.metrics,
      totalAssets: snapshot.metrics.totalAssets ?? (Array.isArray(snapshot.assets) ? snapshot.assets.length : 0),
    },
    arkas: normalizedArkas,
    assets: Array.isArray(snapshot.assets) ? snapshot.assets : [],
    assetPrices: Array.isArray(snapshot.assetPrices) ? snapshot.assetPrices : [],
  };
}

function validateHistoryArchive(archive: CatalogHistoryArchive): CatalogHistoryArchive {
  if (![1, 2, 3].includes(archive.schemaVersion)) {
    throw new Error(`Unsupported history schema version: ${archive.schemaVersion}`);
  }
  if (!Array.isArray(archive.runs)) {
    throw new Error("History payload is missing the runs collection");
  }
  if (!Number.isInteger(archive.retentionLimit) || archive.retentionLimit <= 0) {
    throw new Error("History payload has an invalid retention limit");
  }
  return {
    ...archive,
    schemaVersion: 3,
    runs: archive.runs.map(validateSnapshot),
  };
}

function validateMonitoringArchive(archive: MonitoringArchive): MonitoringArchive {
  if (archive.schemaVersion !== 1) {
    throw new Error(`Unsupported monitoring schema version: ${archive.schemaVersion}`);
  }
  if (!Array.isArray(archive.runs) || !Array.isArray(archive.alerts)) {
    throw new Error("Monitoring payload is missing required collections");
  }
  if (!Number.isInteger(archive.retentionLimit) || archive.retentionLimit <= 0) {
    throw new Error("Monitoring payload has an invalid retention limit");
  }
  archive.runs.forEach(validateSyncRunRecord);
  archive.alerts.forEach(validateMonitoringAlertState);
  return archive;
}

function validateSyncRunRecord(run: SyncRunRecord): SyncRunRecord {
  if (!run.runId || !run.startedAt || !run.finishedAt) {
    throw new Error("Monitoring run is missing identifiers or timestamps");
  }
  if (run.status !== "success" && run.status !== "failure") {
    throw new Error(`Monitoring run has an invalid status: ${run.status}`);
  }
  if (!Number.isInteger(run.durationMs) || run.durationMs < 0) {
    throw new Error("Monitoring run has an invalid duration");
  }
  if (!Number.isInteger(run.indexedArkas) || !Number.isInteger(run.failedArkas) || !Number.isInteger(run.totalArkas)) {
    throw new Error("Monitoring run has invalid Arka counters");
  }
  return run;
}

function validateMonitoringAlertState(alert: MonitoringAlertState): MonitoringAlertState {
  if (!alert.kind || !alert.message || !alert.firstTriggeredAt || !alert.lastTriggeredAt) {
    throw new Error("Monitoring alert is missing required fields");
  }
  if (alert.severity !== "warning" && alert.severity !== "critical") {
    throw new Error(`Monitoring alert has an invalid severity: ${alert.severity}`);
  }
  return alert;
}

function isNotFoundError(error: unknown): boolean {
  return (
    error instanceof Error &&
    "code" in error &&
    typeof (error as NodeJS.ErrnoException).code === "string" &&
    (error as NodeJS.ErrnoException).code === "ENOENT"
  );
}
