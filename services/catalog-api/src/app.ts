import Fastify, { type FastifyInstance, type FastifyReply } from "fastify";
import { StrKey } from "@stellar/stellar-sdk";
import {
  findArka,
  findAsset,
  findManager,
  listAssets,
} from "./catalog.js";
import { IdentityUpdateError } from "./identity.js";
import { CATALOG_OPENAPI_DOCUMENT } from "./openapi/document.js";
import { CatalogService } from "./service.js";
import { ManagedCatalogUnavailable } from "./managedTypes.js";
import type { IdentityUpdateRequest } from "./types.js";

export interface CatalogAppOptions {
  service: CatalogService;
  syncToken?: string;
  /** Local candidate previews can expose all reads without any mutation endpoint. */
  readOnly?: boolean;
}

export function createCatalogApp(options: CatalogAppOptions): FastifyInstance {
  const app = Fastify({ logger: false });
  if (options.readOnly) app.addHook("onRequest", async (request, reply) => {
    if (!["GET", "HEAD"].includes(request.method)) return reply.code(405).header("allow", "GET, HEAD").send({error: "read_only_candidate"});
  });
  const dashboardCache = new Map<
    string,
    { expiresAt: number; value: NonNullable<Awaited<ReturnType<CatalogService["dashboardOverview"]>>> }
  >();
  let navCache: {
    expiresAt: number;
    value: NonNullable<Awaited<ReturnType<CatalogService["navOverview"]>>>;
  } | null = null;

  const readDashboardOverview = async (activityLimit?: number) => {
    const key = String(activityLimit ?? "default");
    const cached = dashboardCache.get(key);
    if (cached && cached.expiresAt > Date.now()) return cached.value;
    const value = await options.service.dashboardOverview({ activityLimit });
    if (value) dashboardCache.set(key, { expiresAt: Date.now() + 30_000, value });
    return value;
  };

  app.addHook("onSend", async (request, reply, payload) => {
    if (request.method === "GET") {
      reply.header("access-control-allow-origin", "*");
    }
    return payload;
  });

  app.get("/openapi.json", async (_request, reply) => {
    reply.header("cache-control", "public, max-age=300");
    return CATALOG_OPENAPI_DOCUMENT;
  });

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
    dashboardCache.clear();
    navCache = null;
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
    const overview = await readDashboardOverview(parseOptionalInt(query.activityLimit));
    if (!overview) {
      reply.code(503);
      return { error: "snapshot_unavailable" };
    }
    reply.header("cache-control", "public, max-age=5, stale-while-revalidate=30");
    return overview;
  });

  app.get("/v1/nav", async (_request, reply) => {
    const now = Date.now();
    const overview = navCache && navCache.expiresAt > now
      ? navCache.value
      : await options.service.navOverview();
    if (!overview) {
      reply.code(503);
      return { error: "snapshot_unavailable" };
    }
    navCache = { expiresAt: now + 30_000, value: overview };
    reply.header("cache-control", "public, max-age=5, stale-while-revalidate=30");
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
    const query = request.query as RequestQuery;
    return options.service.arkas({
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
    const params = request.params as RequestParams;
    const entry = await options.service.arka(params.id);
    if (!entry) {
      reply.code(404);
      return { error: "not_found" };
    }
    return entry;
  });

  app.get("/v1/arkas/:id/identity", async (request, reply) => {
    const params = request.params as RequestParams;
    const identity = await options.service.arkaIdentity(params.id);
    if (!identity) {
      reply.code(404);
      return { error: "not_found" };
    }
    return identity;
  });

  app.put("/v1/arkas/:id/identity", async (request, reply) => {
    const params = request.params as RequestParams;
    try {
      return await options.service.updateArkaIdentity(
        params.id,
        request.body as IdentityUpdateRequest,
      );
    } catch (error) {
      return identityError(reply, error);
    }
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

  app.get("/v1/arkas/:id/holders", async (request, reply) => {
    const params = request.params as RequestParams;
    const query = request.query as RequestQuery;
    let holders;
    try { holders = await options.service.arkaHolders(params.id, {
      offset: parseOptionalInt(query.offset),
      limit: parseOptionalInt(query.limit),
    }); } catch (error) {
      if (error instanceof ManagedCatalogUnavailable) return reply.code(503).header("cache-control", "no-store").send({error: error.code, complete: false});
      throw error;
    }
    if (!holders) {
      reply.code(404);
      return { error: "not_found" };
    }
    reply.header("cache-control", "public, max-age=5, stale-while-revalidate=30");
    return holders;
  });

  app.get("/v1/arkas/:id/managed-position", async (request, reply) => {
    const {id}=request.params as {id:string},query=request.query as Record<string,unknown>;
    reply.header("cache-control","no-store");
    if(Object.keys(query).some(k=>!["owner","view"].includes(k))||(query.view!==undefined&&query.view!=="active")||typeof query.owner!=="string"||!StrKey.isValidEd25519PublicKey(query.owner))
      return reply.code(400).send({error:"managed_owner_invalid",complete:false});
    try {
      const position=await options.service.arkaManagedPosition(id,query.owner,query.view==="active");
      if(!position)return reply.code(404).send({error:"not_found"});
      return position;
    }catch(error){
      if(error instanceof ManagedCatalogUnavailable)return reply.code(503).send({error:error.code,complete:false});
      throw error;
    }
  });

  app.get("/v1/arkas/:id/withdrawals", async (request, reply) => {
    const params = request.params as RequestParams, query = request.query as RequestQuery;
    const filters=request.query as Record<string,unknown>;
    if(Object.keys(filters).some(k=>!["offset","limit","owner","closed","observationId"].includes(k))||(filters.owner!==undefined&&(typeof filters.owner!=="string"||!StrKey.isValidEd25519PublicKey(filters.owner)))||(filters.closed!==undefined&&filters.closed!=="1")||(filters.observationId!==undefined&&(typeof filters.observationId!=="string"||!/^[a-f0-9]{64}$/.test(filters.observationId))))return reply.code(400).send({error:"withdrawal_query_invalid"});
    try {
      const result = await options.service.arkaWithdrawals(params.id, {offset: parseOptionalInt(query.offset), limit: parseOptionalInt(query.limit)}, {owner:filters.owner as string|undefined,closedOnly:filters.closed==="1",observationId:filters.observationId as string|undefined});
      if (!result) return reply.code(404).send({error: "not_found"});
      return reply.header("cache-control", "no-store").send(result);
    } catch (error) {
      if (error instanceof ManagedCatalogUnavailable) return reply.code(503).send({error: error.code, complete: false});
      throw error;
    }
  });
  app.get("/v1/arkas/:id/withdrawals/history", async (request, reply) => {
    const params = request.params as RequestParams;
    const query = request.query as RequestQuery;
    try {
      const records = await options.service.arkaWithdrawalHistory(params.id, {offset: parseOptionalInt(query.offset), limit: parseOptionalInt(query.limit)});
      if (!records) return reply.code(404).send({error: "not_found"});
      return reply.header("cache-control", "no-store").send(records);
    } catch (error) {
      if (error instanceof ManagedCatalogUnavailable) return reply.code(503).send({error: error.code, complete: false});
      throw error;
    }
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

  app.get("/v1/prices", async (_request, reply) => {
    const prices = await options.service.prices();
    if (!prices) {
      reply.code(503);
      return { error: "snapshot_unavailable" };
    }
    reply.header("cache-control", "public, max-age=5, stale-while-revalidate=30");
    return prices;
  });

  app.get("/v1/prices/:id", async (request, reply) => {
    const params = request.params as RequestParams;
    const price = await options.service.price(params.id);
    if (!price) {
      reply.code(404);
      return { error: "not_found" };
    }
    reply.header("cache-control", "public, max-age=5, stale-while-revalidate=30");
    return price;
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
    const query = request.query as RequestQuery;
    return options.service.managers({
      sort: parseManagerSort(query.sort),
      order: parseOrder(query.order),
      search: parseOptionalString(query.search),
      offset: parseOptionalInt(query.offset),
      limit: parseOptionalInt(query.limit),
    });
  });

  app.get("/v1/managers/:id", async (request, reply) => {
    const params = request.params as RequestParams;
    const entry = await options.service.manager(params.id);
    if (!entry) {
      reply.code(404);
      return { error: "not_found" };
    }
    return entry;
  });

  app.get("/v1/managers/:id/identity", async (request, reply) => {
    const params = request.params as RequestParams;
    const identity = await options.service.managerIdentity(params.id);
    if (!identity) {
      reply.code(404);
      return { error: "not_found" };
    }
    return identity;
  });

  app.put("/v1/managers/:id/identity", async (request, reply) => {
    const params = request.params as RequestParams;
    try {
      return await options.service.updateManagerIdentity(
        params.id,
        request.body as IdentityUpdateRequest,
      );
    } catch (error) {
      return identityError(reply, error);
    }
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

function identityError(reply: FastifyReply, error: unknown): { error: string; message: string } {
  if (error instanceof IdentityUpdateError) {
    reply.code(error.statusCode);
    return { error: error.code, message: error.message };
  }
  reply.code(500);
  return { error: "identity_update_failed", message: "Identity profile could not be saved." };
}

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
