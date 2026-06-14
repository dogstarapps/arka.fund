import Fastify, { type FastifyInstance } from "fastify";
import {
  findArka,
  findAsset,
  findManager,
  listArkas,
  listAssets,
  listManagers,
} from "./catalog.js";
import { CatalogService } from "./service.js";

export interface CatalogAppOptions {
  service: CatalogService;
  syncToken?: string;
}

export function createCatalogApp(options: CatalogAppOptions): FastifyInstance {
  const app = Fastify({ logger: false });

  app.get("/health", async (_request, reply) => {
    const [snapshot, status] = await Promise.all([
      options.service.current(),
      options.service.monitoringStatus(),
    ]);
    const hasCriticalAlert = status.activeAlerts.some(
      (alert) => alert.severity === "critical",
    );
    if (!snapshot || hasCriticalAlert) {
      reply.code(503);
    }

    return {
      healthy: status.healthy,
      degraded: status.degraded,
      evaluatedAt: status.evaluatedAt,
      snapshotAgeSeconds: status.snapshotAgeSeconds,
      lastSyncedAt: snapshot?.syncedAt ?? null,
      indexedArkas: snapshot?.metrics.indexedArkas ?? 0,
      failedArkas: snapshot?.metrics.failedArkas ?? 0,
      consecutiveFailures: status.consecutiveFailures,
      activeAlerts: status.activeAlerts,
    };
  });

  app.post("/v1/sync", async (request, reply) => {
    if (options.syncToken) {
      const provided = request.headers["x-arkafund-sync-token"];
      if (provided !== options.syncToken) {
        reply.code(401);
        return { error: "unauthorized" };
      }
    }

    const snapshot = await options.service.sync();
    return {
      syncedAt: snapshot.syncedAt,
      metrics: snapshot.metrics,
      failures: snapshot.failures,
    };
  });

  app.get("/v1/metrics", async (_request, reply) => {
    const snapshot = await options.service.current();
    if (!snapshot) {
      reply.code(503);
      return { error: "snapshot_unavailable" };
    }
    return snapshot.metrics;
  });

  app.get("/v1/dashboard/overview", async (request, reply) => {
    const query = request.query as RequestQuery;
    const overview = await options.service.dashboardOverview({
      activityLimit: parseOptionalInt(query.activityLimit),
    });
    if (!overview) {
      reply.code(503);
      return { error: "snapshot_unavailable" };
    }
    return overview;
  });

  app.get("/v1/dashboard/composition", async (request, reply) => {
    const query = request.query as RequestQuery;
    const composition = await options.service.dashboardComposition({
      limit: parseOptionalInt(query.limit),
    });
    if (!composition) {
      reply.code(503);
      return { error: "snapshot_unavailable" };
    }
    return composition;
  });

  app.get("/v1/monitoring/status", async () => {
    return options.service.monitoringStatus();
  });

  app.get("/v1/monitoring/runs", async (request) => {
    const query = request.query as RequestQuery;
    return options.service.monitoringRuns({
      status: parseMonitoringRunStatus(query.status),
      order: parseOrder(query.order),
      limit: parseOptionalInt(query.limit),
    });
  });

  app.get("/v1/monitoring/alerts", async (request) => {
    const query = request.query as RequestQuery;
    const alerts = await options.service.monitoringAlerts();
    const active = parseOptionalBoolean(query.active);
    return active === undefined
      ? alerts
      : alerts.filter((alert) => alert.active === active);
  });

  app.get("/v1/history", async (request) => {
    const query = request.query as RequestQuery;
    return options.service.historyRuns({
      from: parseOptionalIsoDate(query.from),
      to: parseOptionalIsoDate(query.to),
      order: parseOrder(query.order),
      limit: parseOptionalInt(query.limit),
    });
  });

  app.get("/v1/activity", async (request, reply) => {
    const snapshot = await options.service.current();
    if (!snapshot) {
      reply.code(503);
      return { error: "snapshot_unavailable" };
    }
    const query = request.query as RequestQuery;
    return options.service.activity({
      kind: parseActivityKind(query.kind),
      fromLedger: parseOptionalInt(query.fromLedger),
      toLedger: parseOptionalInt(query.toLedger),
      order: parseOrder(query.order),
      limit: parseOptionalInt(query.limit),
    });
  });

  app.get("/v1/arkas", async (request, reply) => {
    const snapshot = await options.service.current();
    if (!snapshot) {
      reply.code(503);
      return { error: "snapshot_unavailable" };
    }
    const query = request.query as RequestQuery;
    return listArkas(snapshot, {
      sort: parseArkaSort(query.sort),
      order: parseOrder(query.order),
      curated: parseOptionalBoolean(query.curated),
      delisted: parseOptionalBoolean(query.delisted),
      search: parseOptionalString(query.search),
      offset: parseOptionalInt(query.offset),
      limit: parseOptionalInt(query.limit),
    });
  });

  app.get("/v1/arkas/:id", async (request, reply) => {
    const snapshot = await options.service.current();
    if (!snapshot) {
      reply.code(503);
      return { error: "snapshot_unavailable" };
    }
    const params = request.params as RequestParams;
    const entry = findArka(snapshot, params.id);
    if (!entry) {
      reply.code(404);
      return { error: "not_found" };
    }
    return entry;
  });

  app.get("/v1/arkas/:id/history", async (request) => {
    const params = request.params as RequestParams;
    const query = request.query as RequestQuery;
    return options.service.arkaHistory(params.id, {
      from: parseOptionalIsoDate(query.from),
      to: parseOptionalIsoDate(query.to),
      order: parseOrder(query.order),
      limit: parseOptionalInt(query.limit),
    });
  });

  app.get("/v1/arkas/:id/assets", async (request, reply) => {
    const snapshot = await options.service.current();
    if (!snapshot) {
      reply.code(503);
      return { error: "snapshot_unavailable" };
    }
    const params = request.params as RequestParams;
    const entry = findArka(snapshot, params.id);
    if (!entry) {
      reply.code(404);
      return { error: "not_found" };
    }
    return options.service.arkaAssets(params.id);
  });

  app.get("/v1/arkas/:id/portfolio", async (request, reply) => {
    const snapshot = await options.service.current();
    if (!snapshot) {
      reply.code(503);
      return { error: "snapshot_unavailable" };
    }
    const params = request.params as RequestParams;
    const entry = findArka(snapshot, params.id);
    if (!entry) {
      reply.code(404);
      return { error: "not_found" };
    }
    const query = request.query as RequestQuery;
    return options.service.arkaPortfolio(params.id, {
      limit: parseOptionalInt(query.limit),
    });
  });

  app.get("/v1/arkas/:id/assets/:assetId/history", async (request, reply) => {
    const snapshot = await options.service.current();
    if (!snapshot) {
      reply.code(503);
      return { error: "snapshot_unavailable" };
    }
    const params = request.params as RequestParams;
    const entry = findArka(snapshot, params.id);
    if (!entry) {
      reply.code(404);
      return { error: "not_found" };
    }
    const query = request.query as RequestQuery;
    return options.service.arkaAssetHistory(params.id, params.assetId, {
      from: parseOptionalIsoDate(query.from),
      to: parseOptionalIsoDate(query.to),
      order: parseOrder(query.order),
      limit: parseOptionalInt(query.limit),
    });
  });

  app.get("/v1/arkas/:id/activity", async (request, reply) => {
    const snapshot = await options.service.current();
    if (!snapshot) {
      reply.code(503);
      return { error: "snapshot_unavailable" };
    }
    const params = request.params as RequestParams;
    const entry = findArka(snapshot, params.id);
    if (!entry) {
      reply.code(404);
      return { error: "not_found" };
    }
    const query = request.query as RequestQuery;
    return options.service.arkaActivity(params.id, {
      kind: parseActivityKind(query.kind),
      fromLedger: parseOptionalInt(query.fromLedger),
      toLedger: parseOptionalInt(query.toLedger),
      order: parseOrder(query.order),
      limit: parseOptionalInt(query.limit),
    });
  });

  app.get("/v1/assets", async (request, reply) => {
    const snapshot = await options.service.current();
    if (!snapshot) {
      reply.code(503);
      return { error: "snapshot_unavailable" };
    }
    const query = request.query as RequestQuery;
    return listAssets(snapshot, {
      sort: parseAssetSort(query.sort),
      order: parseOrder(query.order),
      search: parseOptionalString(query.search),
      offset: parseOptionalInt(query.offset),
      limit: parseOptionalInt(query.limit),
    });
  });

  app.get("/v1/assets/:id", async (request, reply) => {
    const snapshot = await options.service.current();
    if (!snapshot) {
      reply.code(503);
      return { error: "snapshot_unavailable" };
    }
    const params = request.params as RequestParams;
    const entry = findAsset(snapshot, params.id);
    if (!entry) {
      reply.code(404);
      return { error: "not_found" };
    }
    return entry;
  });

  app.get("/v1/assets/:id/history", async (request) => {
    const params = request.params as RequestParams;
    const query = request.query as RequestQuery;
    return options.service.assetHistory(params.id, {
      from: parseOptionalIsoDate(query.from),
      to: parseOptionalIsoDate(query.to),
      order: parseOrder(query.order),
      limit: parseOptionalInt(query.limit),
    });
  });

  app.get("/v1/assets/:id/arkas", async (request, reply) => {
    const snapshot = await options.service.current();
    if (!snapshot) {
      reply.code(503);
      return { error: "snapshot_unavailable" };
    }
    const params = request.params as RequestParams;
    const entry = findAsset(snapshot, params.id);
    if (!entry) {
      reply.code(404);
      return { error: "not_found" };
    }
    const query = request.query as RequestQuery;
    return options.service.assetArkas(params.id, {
      sort: parseArkaSort(query.sort),
      order: parseOrder(query.order),
      curated: parseOptionalBoolean(query.curated),
      delisted: parseOptionalBoolean(query.delisted),
      search: parseOptionalString(query.search),
      offset: parseOptionalInt(query.offset),
      limit: parseOptionalInt(query.limit),
    });
  });

  app.get("/v1/managers", async (request, reply) => {
    const snapshot = await options.service.current();
    if (!snapshot) {
      reply.code(503);
      return { error: "snapshot_unavailable" };
    }
    const query = request.query as RequestQuery;
    return listManagers(snapshot, {
      sort: parseManagerSort(query.sort),
      order: parseOrder(query.order),
      search: parseOptionalString(query.search),
      offset: parseOptionalInt(query.offset),
      limit: parseOptionalInt(query.limit),
    });
  });

  app.get("/v1/managers/:id", async (request, reply) => {
    const snapshot = await options.service.current();
    if (!snapshot) {
      reply.code(503);
      return { error: "snapshot_unavailable" };
    }
    const params = request.params as RequestParams;
    const entry = findManager(snapshot, params.id);
    if (!entry) {
      reply.code(404);
      return { error: "not_found" };
    }
    return entry;
  });

  app.get("/v1/managers/:id/history", async (request) => {
    const params = request.params as RequestParams;
    const query = request.query as RequestQuery;
    return options.service.managerHistory(params.id, {
      from: parseOptionalIsoDate(query.from),
      to: parseOptionalIsoDate(query.to),
      order: parseOrder(query.order),
      limit: parseOptionalInt(query.limit),
    });
  });

  app.get("/v1/managers/:id/arkas", async (request, reply) => {
    const snapshot = await options.service.current();
    if (!snapshot) {
      reply.code(503);
      return { error: "snapshot_unavailable" };
    }
    const params = request.params as RequestParams;
    const entry = findManager(snapshot, params.id);
    if (!entry) {
      reply.code(404);
      return { error: "not_found" };
    }
    const query = request.query as RequestQuery;
    return options.service.managerArkas(params.id, {
      sort: parseArkaSort(query.sort),
      order: parseOrder(query.order),
      curated: parseOptionalBoolean(query.curated),
      delisted: parseOptionalBoolean(query.delisted),
      search: parseOptionalString(query.search),
      offset: parseOptionalInt(query.offset),
      limit: parseOptionalInt(query.limit),
    });
  });

  return app;
}

type RequestQuery = Record<string, string | undefined>;
type RequestParams = Record<string, string>;

function parseMonitoringRunStatus(value?: string): "success" | "failure" | undefined {
  if (value === "success" || value === "failure") {
    return value;
  }
  return undefined;
}

function parseArkaSort(value?: string): "nav" | "manager" | "syncedAt" | undefined {
  if (value === "nav" || value === "manager" || value === "syncedAt") {
    return value;
  }
  return undefined;
}

function parseActivityKind(
  value?: string,
): "deposit" | "redeem" | "profit" | "lend" | "borrow" | "repay" | "withdraw" | undefined {
  if (
    value === "deposit" ||
    value === "redeem" ||
    value === "profit" ||
    value === "lend" ||
    value === "borrow" ||
    value === "repay" ||
    value === "withdraw"
  ) {
    return value;
  }
  return undefined;
}

function parseAssetSort(
  value?: string,
): "netManagedAmount" | "arkaCount" | "syncedAt" | undefined {
  if (value === "netManagedAmount" || value === "arkaCount" || value === "syncedAt") {
    return value;
  }
  return undefined;
}

function parseManagerSort(
  value?: string,
): "totalNav" | "arkaCount" | "manager" | undefined {
  if (value === "totalNav" || value === "arkaCount" || value === "manager") {
    return value;
  }
  return undefined;
}

function parseOrder(value?: string): "asc" | "desc" | undefined {
  if (value === "asc" || value === "desc") {
    return value;
  }
  return undefined;
}

function parseOptionalBoolean(value?: string): boolean | undefined {
  if (value === "true") {
    return true;
  }
  if (value === "false") {
    return false;
  }
  return undefined;
}

function parseOptionalString(value?: string): string | undefined {
  return value && value.trim().length > 0 ? value : undefined;
}

function parseOptionalInt(value?: string): number | undefined {
  if (value === undefined) {
    return undefined;
  }
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function parseOptionalIsoDate(value?: string): string | undefined {
  if (!value) {
    return undefined;
  }
  return Number.isNaN(Date.parse(value)) ? undefined : value;
}
