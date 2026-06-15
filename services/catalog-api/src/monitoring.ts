import type {
  AlertTransition,
  CatalogSnapshot,
  MonitoringAlert,
  MonitoringAlertState,
  MonitoringArchive,
  MonitoringRunQuery,
  MonitoringStatus,
  MonitoringThresholds,
  Page,
  SyncRunRecord,
} from "./types.js";

export function defaultMonitoringThresholds(): MonitoringThresholds {
  return {
    maxSnapshotAgeSeconds: 300,
    maxSyncDurationMs: 5_000,
    maxFailureRatio: 0.25,
    maxConsecutiveFailures: 2,
  };
}

export function createEmptyMonitoringArchive(retentionLimit: number): MonitoringArchive {
  return {
    schemaVersion: 1,
    retentionLimit,
    updatedAt: new Date(0).toISOString(),
    runs: [],
    alerts: [],
  };
}

export function appendRunToMonitoringArchive(
  archive: MonitoringArchive,
  run: SyncRunRecord,
  retentionLimit = archive.retentionLimit,
): MonitoringArchive {
  const runs = [...archive.runs, run].sort((left, right) =>
    left.startedAt.localeCompare(right.startedAt),
  );
  return {
    schemaVersion: 1,
    retentionLimit,
    updatedAt: run.finishedAt,
    runs: runs.slice(Math.max(0, runs.length - retentionLimit)),
    alerts: [...archive.alerts],
  };
}

export function buildMonitoringStatus(
  snapshot: CatalogSnapshot | null,
  archive: MonitoringArchive,
  thresholds: MonitoringThresholds,
  evaluatedAt: string,
): MonitoringStatus {
  const activeAlerts = evaluateActiveAlerts(snapshot, archive, thresholds, evaluatedAt);
  const lastRun = archive.runs.at(-1) ?? null;
  const degraded = activeAlerts.length > 0;
  return {
    healthy: activeAlerts.every((alert) => alert.severity !== "critical"),
    degraded,
    evaluatedAt,
    snapshotAgeSeconds: snapshot ? snapshotAgeSeconds(snapshot, evaluatedAt) : null,
    consecutiveFailures: consecutiveFailures(archive.runs),
    lastRun,
    activeAlerts,
    thresholds,
  };
}

export function reconcileMonitoringAlerts(
  previousAlerts: MonitoringAlertState[],
  activeAlerts: MonitoringAlert[],
  evaluatedAt: string,
): {
  alerts: MonitoringAlertState[];
  transitions: AlertTransition[];
} {
  const previousByKind = new Map(previousAlerts.map((alert) => [alert.kind, alert]));
  const currentByKind = new Map(activeAlerts.map((alert) => [alert.kind, alert]));
  const nextAlerts: MonitoringAlertState[] = [];
  const transitions: AlertTransition[] = [];

  for (const [kind, alert] of currentByKind) {
    const existing = previousByKind.get(kind);
    if (!existing || !existing.active) {
      const triggered: MonitoringAlertState = {
        ...alert,
        active: true,
        firstTriggeredAt: evaluatedAt,
        lastTriggeredAt: evaluatedAt,
        lastResolvedAt: existing?.lastResolvedAt ?? null,
      };
      nextAlerts.push(triggered);
      transitions.push({ kind, action: "triggered", alert: triggered });
      continue;
    }
    nextAlerts.push({
      ...existing,
      severity: alert.severity,
      message: alert.message,
      active: true,
      lastTriggeredAt: evaluatedAt,
    });
  }

  for (const [kind, alert] of previousByKind) {
    if (currentByKind.has(kind)) {
      continue;
    }
    if (!alert.active) {
      nextAlerts.push(alert);
      continue;
    }
    const resolved: MonitoringAlertState = {
      ...alert,
      active: false,
      lastResolvedAt: evaluatedAt,
    };
    nextAlerts.push(resolved);
    transitions.push({ kind, action: "resolved", alert: resolved });
  }

  nextAlerts.sort((left, right) => left.kind.localeCompare(right.kind));
  return { alerts: nextAlerts, transitions };
}

export function listMonitoringRuns(
  archive: MonitoringArchive,
  query: MonitoringRunQuery = {},
): Page<SyncRunRecord> {
  const filtered = archive.runs.filter((run) => (query.status ? run.status === query.status : true));
  const direction = query.order === "asc" ? 1 : -1;
  const ordered = [...filtered].sort(
    (left, right) => left.startedAt.localeCompare(right.startedAt) * direction,
  );
  const limit = query.limit && query.limit > 0 ? query.limit : ordered.length || 25;
  return {
    total: ordered.length,
    offset: 0,
    limit,
    items: ordered.slice(0, limit),
  };
}

export function listMonitoringAlerts(archive: MonitoringArchive): MonitoringAlertState[] {
  return [...archive.alerts].sort((left, right) => left.kind.localeCompare(right.kind));
}

function evaluateActiveAlerts(
  snapshot: CatalogSnapshot | null,
  archive: MonitoringArchive,
  thresholds: MonitoringThresholds,
  evaluatedAt: string,
): MonitoringAlert[] {
  const alerts: MonitoringAlert[] = [];
  const lastRun = archive.runs.at(-1) ?? null;
  if (!snapshot) {
    alerts.push({
      kind: "snapshot_missing",
      severity: "critical",
      message: "No catalog snapshot is available",
    });
  } else {
    const ageSeconds = snapshotAgeSeconds(snapshot, evaluatedAt);
    if (ageSeconds > thresholds.maxSnapshotAgeSeconds) {
      alerts.push({
        kind: "snapshot_stale",
        severity: "critical",
        message: `Catalog snapshot is stale (${ageSeconds}s old)`,
      });
    }
  }

  if (lastRun?.status === "failure") {
    alerts.push({
      kind: "sync_failed",
      severity: "critical",
      message: lastRun.errorMessage ?? "Last sync run failed",
    });
  }

  if (consecutiveFailures(archive.runs) >= thresholds.maxConsecutiveFailures) {
    alerts.push({
      kind: "consecutive_failures",
      severity: "critical",
      message: `Consecutive failed sync runs reached ${consecutiveFailures(archive.runs)}`,
    });
  }

  if (lastRun && lastRun.durationMs > thresholds.maxSyncDurationMs) {
    alerts.push({
      kind: "sync_slow",
      severity: "warning",
      message: `Last sync run took ${lastRun.durationMs}ms`,
    });
  }

  if (lastRun && lastRun.totalArkas > 0) {
    const failureRatio = lastRun.failedArkas / lastRun.totalArkas;
    if (failureRatio > thresholds.maxFailureRatio) {
      alerts.push({
        kind: "partial_sync_failures",
        severity: "warning",
        message: `Sync failure ratio ${failureRatio.toFixed(2)} exceeded threshold`,
      });
    }
  }

  return alerts.sort((left, right) => left.kind.localeCompare(right.kind));
}

function snapshotAgeSeconds(snapshot: CatalogSnapshot, evaluatedAt: string): number {
  return Math.max(0, Math.floor((Date.parse(evaluatedAt) - Date.parse(snapshot.syncedAt)) / 1000));
}

function consecutiveFailures(runs: SyncRunRecord[]): number {
  let count = 0;
  for (let index = runs.length - 1; index >= 0; index -= 1) {
    if (runs[index].status !== "failure") {
      break;
    }
    count += 1;
  }
  return count;
}
