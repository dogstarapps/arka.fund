import { randomUUID } from "node:crypto";
import { NoopActivityReader, type ActivityReader } from "./activity.js";
import {
  findAsset,
  findArka,
  findManager,
  getArkaAssetHistory,
  getArkaAssets,
  getArkaHistory,
  getAssetHistory,
  getManagerHistory,
  listAssetArkas,
  listAssets,
  listHistoryRuns,
  listArkas,
  listManagers,
  listManagerArkas,
} from "./catalog.js";
import {
  buildArkaPortfolio,
  buildDashboardComposition,
  buildDashboardOverview,
} from "./dashboard.js";
import {
  buildMonitoringStatus,
  defaultMonitoringThresholds,
  listMonitoringAlerts,
  listMonitoringRuns,
  reconcileMonitoringAlerts,
} from "./monitoring.js";
import {
  buildMonitoringNotificationEvent,
  NoopMonitoringNotifier,
  type MonitoringNotifier,
} from "./notifier.js";
import {
  applyIdentityToArka,
  applyIdentityToArkaPage,
  applyIdentityToManager,
  applyIdentityToManagerPage,
  createArkaIdentityMatcher,
  createManagerIdentityMatcher,
  upsertArkaIdentityInArchive,
  upsertManagerIdentityInArchive,
} from "./identity.js";
import {
  FileCatalogHistoryStore,
  FileCatalogStore,
  InMemoryIdentityStore,
  InMemoryMonitoringStore,
} from "./store.js";
import type { CatalogSyncRunner } from "./runners.js";
import type {
  ActivityEntry,
  ActivityQuery,
  AlertTransition,
  ArkaCatalogEntry,
  ArkaAssetExposure,
  ArkaAssetHistoryPoint,
  ArkaQuery,
  ArkaHistoryPoint,
  ArkaPortfolio,
  AssetCatalogEntry,
  AssetHistoryPoint,
  AssetQuery,
  CatalogHistoryArchive,
  CatalogSnapshot,
  CompositionQuery,
  DashboardComposition,
  DashboardOverview,
  DashboardOverviewQuery,
  HistoryQuery,
  IdentityArchive,
  IdentityUpdateRequest,
  ManagerCatalogEntry,
  ManagerQuery,
  MonitoringAlertState,
  MonitoringArchive,
  MonitoringRunQuery,
  MonitoringStatus,
  MonitoringThresholds,
  Page,
  RankedArkaCatalogEntry,
  RankedManagerCatalogEntry,
  ManagerHistoryPoint,
  SyncRunRecord,
} from "./types.js";

interface MonitoringStore {
  read(): Promise<MonitoringArchive>;
  append(run: SyncRunRecord): Promise<MonitoringArchive>;
  replaceAlerts(alerts: MonitoringAlertState[]): Promise<MonitoringArchive>;
}

interface IdentityStore {
  read(): Promise<IdentityArchive>;
  write(archive: IdentityArchive): Promise<void>;
}

export interface CatalogServiceOptions {
  monitoringStore?: MonitoringStore;
  identityStore?: IdentityStore;
  monitoringThresholds?: MonitoringThresholds;
  notifier?: MonitoringNotifier;
  activityReader?: ActivityReader;
  now?: () => Date;
}

export class CatalogService {
  private readonly monitoringStore: MonitoringStore;
  private readonly identityStore: IdentityStore;
  private readonly monitoringThresholds: MonitoringThresholds;
  private readonly notifier: MonitoringNotifier;
  private readonly activityReader: ActivityReader;
  private readonly now: () => Date;

  constructor(
    private readonly store: FileCatalogStore,
    private readonly historyStore: FileCatalogHistoryStore,
    private readonly runner: CatalogSyncRunner,
    options: CatalogServiceOptions = {},
  ) {
    this.monitoringStore = options.monitoringStore ?? new InMemoryMonitoringStore();
    this.identityStore = options.identityStore ?? new InMemoryIdentityStore();
    this.monitoringThresholds =
      options.monitoringThresholds ?? defaultMonitoringThresholds();
    this.notifier = options.notifier ?? new NoopMonitoringNotifier();
    this.activityReader = options.activityReader ?? new NoopActivityReader();
    this.now = options.now ?? (() => new Date());
  }

  current(): Promise<CatalogSnapshot | null> {
    return this.store.read();
  }

  history(): Promise<CatalogHistoryArchive> {
    return this.historyStore.read();
  }

  monitoring(): Promise<MonitoringArchive> {
    return this.monitoringStore.read();
  }

  identity(): Promise<IdentityArchive> {
    return this.identityStore.read();
  }

  async sync(): Promise<CatalogSnapshot> {
    const startedAt = this.now().toISOString();
    try {
      const snapshot = await this.runner.run();
      await this.store.write(snapshot);
      await this.historyStore.append(snapshot);
      await this.recordRun(
        buildSuccessRun(startedAt, this.now().toISOString(), snapshot),
        snapshot,
      );
      return snapshot;
    } catch (error) {
      await this.recordRun(
        buildFailureRun(startedAt, this.now().toISOString(), errorMessage(error)),
        await this.current(),
      );
      throw error;
    }
  }

  async historyRuns(query: HistoryQuery = {}): Promise<Page<CatalogSnapshot>> {
    return listHistoryRuns(await this.history(), query);
  }

  async arkaHistory(
    arkaId: string,
    query: HistoryQuery = {},
  ): Promise<Page<ArkaHistoryPoint>> {
    return getArkaHistory(await this.history(), arkaId, query);
  }

  async dashboardOverview(
    query: DashboardOverviewQuery = {},
  ): Promise<DashboardOverview | null> {
    const snapshot = await this.current();
    if (!snapshot) {
      return null;
    }
    const [history, monitoring, activity] = await Promise.all([
      this.history(),
      this.monitoringStatus(),
      this.readActivity(snapshot.arkas, {
        order: "desc",
        limit: query.activityLimit ?? 100,
      }),
    ]);
    return buildDashboardOverview(snapshot, history, monitoring, activity, query);
  }

  async dashboardComposition(
    query: CompositionQuery = {},
  ): Promise<DashboardComposition | null> {
    const snapshot = await this.current();
    if (!snapshot) {
      return null;
    }
    return buildDashboardComposition(snapshot, query);
  }

  async assets(query: AssetQuery = {}): Promise<Page<AssetCatalogEntry & { rank: number }>> {
    const snapshot = await this.current();
    if (!snapshot) {
      return emptyPage(query.limit);
    }
    return listAssets(snapshot, query);
  }

  async arkas(query: ArkaQuery = {}): Promise<Page<RankedArkaCatalogEntry>> {
    const [snapshot, identity] = await Promise.all([this.current(), this.identity()]);
    if (!snapshot) {
      return emptyPage(query.limit);
    }
    return applyIdentityToArkaPage(
      listArkas(snapshot, query, createArkaIdentityMatcher(identity)),
      identity,
    );
  }

  async arka(arkaId: string): Promise<ArkaCatalogEntry | null> {
    const [snapshot, identity] = await Promise.all([this.current(), this.identity()]);
    if (!snapshot) {
      return null;
    }
    const entry = findArka(snapshot, arkaId);
    return entry ? applyIdentityToArka(entry, identity) : null;
  }

  async managers(query: ManagerQuery = {}): Promise<Page<RankedManagerCatalogEntry>> {
    const [snapshot, identity] = await Promise.all([this.current(), this.identity()]);
    if (!snapshot) {
      return emptyPage(query.limit);
    }
    return applyIdentityToManagerPage(
      listManagers(snapshot, query, createManagerIdentityMatcher(identity)),
      identity,
    );
  }

  async manager(managerId: string): Promise<ManagerCatalogEntry | null> {
    const [snapshot, identity] = await Promise.all([this.current(), this.identity()]);
    if (!snapshot) {
      return null;
    }
    const entry = findManager(snapshot, managerId);
    return entry ? applyIdentityToManager(entry, identity) : null;
  }

  async arkaIdentity(arkaId: string): Promise<ArkaCatalogEntry["identity"] | null> {
    const [snapshot, identity] = await Promise.all([this.current(), this.identity()]);
    const entry = snapshot ? findArka(snapshot, arkaId) : null;
    if (entry) {
      return applyIdentityToArka(entry, identity).identity ?? null;
    }
    return identity.arkas[arkaId] ?? null;
  }

  async managerIdentity(
    managerId: string,
  ): Promise<ManagerCatalogEntry["identity"] | null> {
    const [snapshot, identity] = await Promise.all([this.current(), this.identity()]);
    const entry = snapshot ? findManager(snapshot, managerId) : null;
    if (entry) {
      return applyIdentityToManager(entry, identity).identity ?? null;
    }
    return identity.managers[managerId] ?? null;
  }

  async updateArkaIdentity(
    arkaId: string,
    request: IdentityUpdateRequest,
  ): Promise<ArkaCatalogEntry["identity"]> {
    const [snapshot, archive] = await Promise.all([this.current(), this.identity()]);
    const entry = snapshot ? findArka(snapshot, arkaId) : null;
    const manager = entry?.manager ?? request.signer;
    const next = upsertArkaIdentityInArchive({
      archive,
      arkaId,
      manager,
      curated: entry?.curated ?? false,
      pendingIndexation: !entry,
      request,
      now: this.now(),
    });
    await this.identityStore.write(next.archive);
    return next.identity;
  }

  async updateManagerIdentity(
    managerId: string,
    request: IdentityUpdateRequest,
  ): Promise<ManagerCatalogEntry["identity"]> {
    const [snapshot, archive] = await Promise.all([this.current(), this.identity()]);
    const entry = snapshot ? findManager(snapshot, managerId) : null;
    const next = upsertManagerIdentityInArchive({
      archive,
      manager: managerId,
      curated: (entry?.curatedArkaCount ?? 0) > 0,
      request,
      now: this.now(),
    });
    await this.identityStore.write(next.archive);
    return next.identity;
  }

  async asset(assetContract: string): Promise<AssetCatalogEntry | null> {
    const snapshot = await this.current();
    if (!snapshot) {
      return null;
    }
    return findAsset(snapshot, assetContract);
  }

  async assetHistory(
    assetContract: string,
    query: HistoryQuery = {},
  ): Promise<Page<AssetHistoryPoint>> {
    return getAssetHistory(await this.history(), assetContract, query);
  }

  async arkaAssets(arkaId: string): Promise<ArkaAssetExposure[]> {
    const snapshot = await this.current();
    if (!snapshot) {
      return [];
    }
    return getArkaAssets(snapshot, arkaId);
  }

  async arkaPortfolio(
    arkaId: string,
    query: CompositionQuery = {},
  ): Promise<ArkaPortfolio | null> {
    const snapshot = await this.current();
    if (!snapshot) {
      return null;
    }
    if (!findArka(snapshot, arkaId)) {
      return null;
    }
    return buildArkaPortfolio(snapshot, arkaId, query);
  }

  async arkaAssetHistory(
    arkaId: string,
    assetContract: string,
    query: HistoryQuery = {},
  ): Promise<Page<ArkaAssetHistoryPoint>> {
    return getArkaAssetHistory(await this.history(), arkaId, assetContract, query);
  }

  async managerHistory(
    managerId: string,
    query: HistoryQuery = {},
  ): Promise<Page<ManagerHistoryPoint>> {
    return getManagerHistory(await this.history(), managerId, query);
  }

  async managerArkas(
    managerId: string,
    query: ArkaQuery = {},
  ): Promise<Page<RankedArkaCatalogEntry>> {
    const snapshot = await this.current();
    if (!snapshot) {
      return emptyPage(query.limit);
    }
    const identity = await this.identity();
    return applyIdentityToArkaPage(
      listManagerArkas(snapshot, managerId, query, createArkaIdentityMatcher(identity)),
      identity,
    );
  }

  async assetArkas(
    assetContract: string,
    query: ArkaQuery = {},
  ): Promise<Page<RankedArkaCatalogEntry>> {
    const snapshot = await this.current();
    if (!snapshot) {
      return emptyPage(query.limit);
    }
    const identity = await this.identity();
    return applyIdentityToArkaPage(
      listAssetArkas(snapshot, assetContract, query, createArkaIdentityMatcher(identity)),
      identity,
    );
  }

  async activity(query: ActivityQuery = {}): Promise<Page<ActivityEntry>> {
    const snapshot = await this.current();
    if (!snapshot) {
      return emptyPage(query.limit);
    }
    return this.readActivity(snapshot.arkas, query);
  }

  async arkaActivity(arkaId: string, query: ActivityQuery = {}): Promise<Page<ActivityEntry>> {
    const snapshot = await this.current();
    if (!snapshot) {
      return emptyPage(query.limit);
    }
    const arka = snapshot.arkas.find((entry) => entry.arkaId === arkaId);
    if (!arka) {
      return emptyPage(query.limit);
    }
    return this.readActivity([arka], query);
  }

  async monitoringStatus(): Promise<MonitoringStatus> {
    return buildMonitoringStatus(
      await this.current(),
      await this.monitoring(),
      this.monitoringThresholds,
      this.now().toISOString(),
    );
  }

  async monitoringRuns(query: MonitoringRunQuery = {}): Promise<Page<SyncRunRecord>> {
    return listMonitoringRuns(await this.monitoring(), query);
  }

  async monitoringAlerts(): Promise<MonitoringAlertState[]> {
    return listMonitoringAlerts(await this.monitoring());
  }

  private async recordRun(
    run: SyncRunRecord,
    snapshot: CatalogSnapshot | null,
  ): Promise<{ status: MonitoringStatus; transitions: AlertTransition[] }> {
    const archiveWithRun = await this.monitoringStore.append(run);
    const evaluatedAt = this.now().toISOString();
    const status = buildMonitoringStatus(
      snapshot,
      archiveWithRun,
      this.monitoringThresholds,
      evaluatedAt,
    );
    const reconciliation = reconcileMonitoringAlerts(
      archiveWithRun.alerts,
      status.activeAlerts,
      evaluatedAt,
    );
    await this.monitoringStore.replaceAlerts(reconciliation.alerts);
    if (reconciliation.transitions.length > 0) {
      await this.deliverTransitions(reconciliation.transitions, {
        ...status,
        evaluatedAt,
      });
    }
    return { status, transitions: reconciliation.transitions };
  }

  private async deliverTransitions(
    transitions: AlertTransition[],
    status: MonitoringStatus,
  ): Promise<void> {
    try {
      await this.notifier.notify(buildMonitoringNotificationEvent(transitions, status));
    } catch (error) {
      console.error("catalog-api monitoring notification failed", error);
    }
  }

  private async readActivity(
    arkas: ArkaCatalogEntry[],
    query: ActivityQuery,
  ): Promise<Page<ActivityEntry>> {
    try {
      return await this.activityReader.list(arkas, query);
    } catch (error) {
      console.warn("catalog-api activity reader failed, serving empty activity page", error);
      return emptyPage(query.limit);
    }
  }
}

function buildSuccessRun(
  startedAt: string,
  finishedAt: string,
  snapshot: CatalogSnapshot,
): SyncRunRecord {
  return {
    runId: randomUUID(),
    startedAt,
    finishedAt,
    durationMs: durationMs(startedAt, finishedAt),
    status: "success",
    indexedArkas: snapshot.metrics.indexedArkas,
    failedArkas: snapshot.metrics.failedArkas,
    totalArkas: snapshot.metrics.totalArkas,
    totalNav: snapshot.metrics.totalNav,
    errorMessage: null,
  };
}

function buildFailureRun(
  startedAt: string,
  finishedAt: string,
  message: string,
): SyncRunRecord {
  return {
    runId: randomUUID(),
    startedAt,
    finishedAt,
    durationMs: durationMs(startedAt, finishedAt),
    status: "failure",
    indexedArkas: 0,
    failedArkas: 0,
    totalArkas: 0,
    totalNav: "0",
    errorMessage: message,
  };
}

function durationMs(startedAt: string, finishedAt: string): number {
  return Math.max(0, Date.parse(finishedAt) - Date.parse(startedAt));
}

function errorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}

function emptyPage<T>(limit = 25): Page<T> {
  return {
    total: 0,
    offset: 0,
    limit: limit > 0 ? limit : 25,
    items: [],
  };
}
