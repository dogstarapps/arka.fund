import test from "node:test";
import assert from "node:assert/strict";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { mkdtemp } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { Keypair } from "@stellar/stellar-sdk";
import {
  buildSnapshot,
  buildIdentityUpdateMessage,
  CatalogService,
  createCatalogApp,
  FileCatalogHistoryStore,
  FileCatalogStore,
  FileMonitoringStore,
  signPayload,
  StaticActivityReader,
  StaticCatalogSyncRunner,
  WebhookMonitoringNotifier,
} from "../../src/index.js";

const syncedAt = "2026-03-27T10:00:00.000Z";
const tokenContract = "CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA";

const arkaOne = {
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
};

const arkaTwo = {
  arkaId: "CDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDD",
  manager: "GEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEE",
  curated: false,
  delisted: false,
  nav: "500",
  denominationContract: tokenContract,
  whitelistContracts: [tokenContract],
  shareToken: null,
  fees: { mgmtBps: 10, perfBps: 20, depositBps: 30, redeemBps: 40 },
  assets: [
    {
      assetContract: tokenContract,
      isDenomination: true,
      liquidBalance: "500",
      collateralAmount: "0",
      debtAmount: "0",
      netManagedAmount: "500",
      netPositionValue: "0",
      marketIds: [],
      syncedAt,
    },
  ],
  syncedAt,
};

test("HTTP API serves dashboard, assets, portfolio, and activity endpoints", async () => {
  const directory = await mkdtemp(join(tmpdir(), "catalog-api-assets-"));
  let runIndex = 0;
  const runner = new StaticCatalogSyncRunner(async () => {
    runIndex += 1;
    if (runIndex === 1) {
      return buildSnapshot([arkaOne, arkaTwo], [], syncedAt);
    }
    return buildSnapshot(
      [
        {
          ...arkaOne,
          nav: "2200",
          assets: [
            {
              ...arkaOne.assets[0],
              liquidBalance: "2200",
              netManagedAmount: "2200",
              syncedAt: "2026-03-27T10:01:00.000Z",
            },
          ],
          syncedAt: "2026-03-27T10:01:00.000Z",
        },
        {
          ...arkaTwo,
          nav: "900",
          assets: [
            {
              ...arkaTwo.assets[0],
              liquidBalance: "900",
              netManagedAmount: "900",
              syncedAt: "2026-03-27T10:01:00.000Z",
            },
          ],
          syncedAt: "2026-03-27T10:01:00.000Z",
        },
      ],
      [],
      "2026-03-27T10:01:00.000Z",
    );
  });
  const activityReader = new StaticActivityReader([
    {
      eventId: "evt-1",
      cursor: "evt-1",
      arkaId: arkaOne.arkaId,
      manager: arkaOne.manager,
      kind: "deposit",
      ledger: 101,
      ledgerClosedAt: "2026-03-27T10:00:10.000Z",
      txHash: "tx-1",
      transactionIndex: 0,
      operationIndex: 0,
      inSuccessfulContractCall: true,
      user: "GUSERONE",
      assetContract: tokenContract,
      marketId: null,
      amount: "2000",
      shares: "2000",
      netOut: null,
      stepCount: null,
    },
    {
      eventId: "evt-2",
      cursor: "evt-2",
      arkaId: arkaTwo.arkaId,
      manager: arkaTwo.manager,
      kind: "deposit",
      ledger: 102,
      ledgerClosedAt: "2026-03-27T10:00:20.000Z",
      txHash: "tx-2",
      transactionIndex: 0,
      operationIndex: 0,
      inSuccessfulContractCall: true,
      user: "GUSERTWO",
      assetContract: tokenContract,
      marketId: null,
      amount: "500",
      shares: "500",
      netOut: null,
      stepCount: null,
    },
  ]);
  const service = new CatalogService(
    new FileCatalogStore(join(directory, "snapshot.json")),
    new FileCatalogHistoryStore(join(directory, "history.json")),
    runner,
    { activityReader },
  );
  const app = createCatalogApp({ service, syncToken: "secret" });

  try {
    await app.inject({
      method: "POST",
      url: "/v1/sync",
      headers: { "x-arkafund-sync-token": "secret" },
    });
    await app.inject({
      method: "POST",
      url: "/v1/sync",
      headers: { "x-arkafund-sync-token": "secret" },
    });

    const assetsResponse = await app.inject({
      method: "GET",
      url: "/v1/assets?sort=netManagedAmount&order=desc",
    });
    assert.equal(assetsResponse.statusCode, 200);
    assert.equal(assetsResponse.json().items[0].assetContract, tokenContract);
    assert.equal(assetsResponse.json().items[0].netManagedAmount, "3100");

    const dashboardOverview = await app.inject({
      method: "GET",
      url: "/v1/dashboard/overview?activityLimit=10",
    });
    assert.equal(dashboardOverview.statusCode, 200);
    assert.equal(dashboardOverview.json().totalNav, "3100");
    assert.equal(dashboardOverview.json().totalNavDelta, "600");
    assert.equal(dashboardOverview.json().activity.depositVolume, "2500");

    const nav = await app.inject({
      method: "GET",
      url: "/v1/nav?activityLimit=10",
    });
    assert.equal(nav.statusCode, 200);
    assert.equal(nav.json().totalNav, dashboardOverview.json().totalNav);
    assert.equal(nav.json().totalNavDelta, dashboardOverview.json().totalNavDelta);
    assert.equal(nav.json().activity, undefined);
    assert.match(nav.headers["cache-control"] ?? "", /max-age=5/);

    const dashboardComposition = await app.inject({
      method: "GET",
      url: "/v1/dashboard/composition?limit=5",
    });
    assert.equal(dashboardComposition.statusCode, 200);
    assert.equal(dashboardComposition.json().items[0].assetContract, tokenContract);
    assert.equal(dashboardComposition.json().items[0].navContribution, "3100");

    const assetHistoryResponse = await app.inject({
      method: "GET",
      url: `/v1/assets/${tokenContract}/history?order=asc`,
    });
    assert.equal(assetHistoryResponse.statusCode, 200);
    assert.deepEqual(
      assetHistoryResponse.json().items.map((point: { netManagedAmount: string }) => point.netManagedAmount),
      ["2500", "3100"],
    );

    const assetArkasResponse = await app.inject({
      method: "GET",
      url: `/v1/assets/${tokenContract}/arkas?sort=nav&order=desc`,
    });
    assert.equal(assetArkasResponse.statusCode, 200);
    assert.equal(assetArkasResponse.json().total, 2);
    assert.equal(assetArkasResponse.json().items[0].arkaId, arkaOne.arkaId);

    const arkaAssetsResponse = await app.inject({
      method: "GET",
      url: `/v1/arkas/${arkaTwo.arkaId}/assets`,
    });
    assert.equal(arkaAssetsResponse.statusCode, 200);
    assert.equal(arkaAssetsResponse.json()[0].netManagedAmount, "900");

    const arkaPortfolioResponse = await app.inject({
      method: "GET",
      url: `/v1/arkas/${arkaTwo.arkaId}/portfolio`,
    });
    assert.equal(arkaPortfolioResponse.statusCode, 200);
    assert.equal(arkaPortfolioResponse.json().nav, "900");
    assert.equal(arkaPortfolioResponse.json().items[0].navContribution, "900");

    const arkaAssetHistoryResponse = await app.inject({
      method: "GET",
      url: `/v1/arkas/${arkaTwo.arkaId}/assets/${tokenContract}/history?order=asc`,
    });
    assert.equal(arkaAssetHistoryResponse.statusCode, 200);
    assert.deepEqual(
      arkaAssetHistoryResponse.json().items.map((point: { netManagedAmount: string }) => point.netManagedAmount),
      ["500", "900"],
    );

    const globalActivity = await app.inject({
      method: "GET",
      url: "/v1/activity?kind=deposit&order=asc",
    });
    assert.equal(globalActivity.statusCode, 200);
    assert.equal(globalActivity.json().total, 2);

    const arkaActivity = await app.inject({
      method: "GET",
      url: `/v1/arkas/${arkaOne.arkaId}/activity?kind=deposit`,
    });
    assert.equal(arkaActivity.statusCode, 200);
    assert.equal(arkaActivity.json().items[0].amount, "2000");

    const managerArkas = await app.inject({
      method: "GET",
      url: `/v1/managers/${arkaOne.manager}/arkas?sort=nav&order=desc`,
    });
    assert.equal(managerArkas.statusCode, 200);
    assert.equal(managerArkas.json().total, 1);
    assert.equal(managerArkas.json().items[0].arkaId, arkaOne.arkaId);
  } finally {
    await app.close();
  }
});

test("HTTP API publishes a complete OpenAPI contract for every public GET route", async () => {
  const directory = await mkdtemp(join(tmpdir(), "catalog-api-openapi-"));
  const service = new CatalogService(
    new FileCatalogStore(join(directory, "snapshot.json")),
    new FileCatalogHistoryStore(join(directory, "history.json")),
    new StaticCatalogSyncRunner(async () => buildSnapshot([arkaOne], [], syncedAt)),
  );
  const app = createCatalogApp({ service, syncToken: "secret" });

  try {
    const response = await app.inject({ method: "GET", url: "/openapi.json" });
    assert.equal(response.statusCode, 200);
    assert.match(response.headers["cache-control"] ?? "", /max-age=300/);
    assert.equal(response.headers["access-control-allow-origin"], "*");

    const document = response.json();
    assert.equal(document.openapi, "3.1.0");
    assert.equal(document.servers[0].url, "https://catalog.arka.fund");

    const documentedRoutes = new Set(
      Object.entries(document.paths)
        .filter(([, operations]) => Boolean((operations as { get?: unknown }).get))
        .map(([path]) => path),
    );
    const publicGetRoutes = app
      .printRoutes({ commonPrefix: false })
      .split("\n")
      .map((line) => line.trim().split(" ")[0])
      .filter((path) => path?.startsWith("/") && path !== "/openapi.json")
      .map((path) => path?.replace(/:([^/]+)/g, "{$1}"));

    for (const path of publicGetRoutes) {
      if (path === "/") continue;
      assert.equal(documentedRoutes.has(path ?? ""), true, `missing OpenAPI path: ${path}`);
    }

    assert.ok(document.components.schemas.Arka);
    assert.ok(document.components.schemas.MonitoringStatus);
    assert.ok(document.components.schemas.NavResponse);
    assert.ok(document.components.schemas.IdentityUpdateRequest);
    assert.equal(
      document.paths["/v1/nav"].get.responses["200"].content["application/json"].schema.$ref,
      "#/components/schemas/NavResponse",
    );
    assert.equal(
      document.paths["/v1/arkas/{id}/identity"].put.requestBody.content["application/json"].schema.$ref,
      "#/components/schemas/IdentityUpdateRequest",
    );
    assert.equal(
      document.paths["/v1/managers/{id}/identity"].put.requestBody.content["application/json"].schema.$ref,
      "#/components/schemas/IdentityUpdateRequest",
    );
    assert.equal(document.paths["/api/nav"], undefined);
  } finally {
    await app.close();
  }
});

test("HTTP API exposes indexed OracleGuard prices without fallback values", async () => {
  const directory = await mkdtemp(join(tmpdir(), "catalog-api-prices-"));
  const xlmPrice = {
    assetContract: tokenContract,
    priceUsd: "19000000000000",
    decimals: 14,
    timestamp: "1784476800",
    oracleStatus: "verified" as const,
    valuationSource: "oracle_verified" as const,
    primaryUsable: true,
    secondaryUsable: true,
    unavailableReason: null,
    observedAt: syncedAt,
  };
  const service = new CatalogService(
    new FileCatalogStore(join(directory, "snapshot.json")),
    new FileCatalogHistoryStore(join(directory, "history.json")),
    new StaticCatalogSyncRunner(async () => buildSnapshot([arkaOne], [], syncedAt, [xlmPrice])),
  );
  const app = createCatalogApp({ service });

  try {
    await service.sync();
    const list = await app.inject({ method: "GET", url: "/v1/prices" });
    assert.equal(list.statusCode, 200);
    assert.equal(list.json().items[0].priceUsd, xlmPrice.priceUsd);
    assert.equal(list.json().items[0].oracleStatus, "verified");

    const detail = await app.inject({
      method: "GET",
      url: `/v1/prices/${tokenContract}`,
    });
    assert.equal(detail.statusCode, 200);
    assert.equal(detail.json().valuationSource, "oracle_verified");

    const missing = await app.inject({ method: "GET", url: "/v1/prices/CUNKNOWN" });
    assert.equal(missing.statusCode, 404);
    assert.equal(missing.json().error, "not_found");
  } finally {
    await app.close();
  }
});

test("HTTP API exposes public GET responses to browser-based documentation", async () => {
  const directory = await mkdtemp(join(tmpdir(), "catalog-api-cors-"));
  const store = new FileCatalogStore(join(directory, "snapshot.json"));
  const history = new FileCatalogHistoryStore(join(directory, "history.json"));
  const runner = new StaticCatalogSyncRunner(async () =>
    buildSnapshot([arkaOne], [], syncedAt),
  );
  const service = new CatalogService(store, history, runner);
  const app = createCatalogApp({ service, syncToken: "secret" });

  try {
    const publicResponse = await app.inject({ method: "GET", url: "/health" });
    assert.equal(publicResponse.headers["access-control-allow-origin"], "*");

    const protectedResponse = await app.inject({
      method: "POST",
      url: "/v1/sync",
      headers: { "x-arkafund-sync-token": "secret" },
    });
    assert.equal(protectedResponse.headers["access-control-allow-origin"], undefined);
  } finally {
    await app.close();
  }
});

test("HTTP API reconciles monitoring alerts and notifies transitions", async () => {
  const directory = await mkdtemp(join(tmpdir(), "catalog-api-monitoring-"));
  const webhook = await startWebhookSink();
  let runIndex = 0;
  const runner = new StaticCatalogSyncRunner(async () => {
    runIndex += 1;
    if (runIndex === 1) {
      return buildSnapshot(
        [arkaOne],
        [
          {
            arkaId: arkaTwo.arkaId,
            message: "rpc timeout",
            syncedAt,
          },
        ],
        syncedAt,
      );
    }

    return buildSnapshot(
      [
        arkaOne,
        {
          ...arkaTwo,
          nav: "900",
          assets: [
            {
              ...arkaTwo.assets[0],
              liquidBalance: "900",
              netManagedAmount: "900",
              syncedAt: "2026-03-27T10:01:00.000Z",
            },
          ],
          syncedAt: "2026-03-27T10:01:00.000Z",
        },
      ],
      [],
      "2026-03-27T10:01:00.000Z",
    );
  });

  const service = new CatalogService(
    new FileCatalogStore(join(directory, "snapshot.json")),
    new FileCatalogHistoryStore(join(directory, "history.json")),
    runner,
    {
      monitoringStore: new FileMonitoringStore(join(directory, "monitoring.json")),
      monitoringThresholds: {
        maxSnapshotAgeSeconds: 10_000,
        maxSyncDurationMs: 60_000,
        maxFailureRatio: 0.25,
        maxConsecutiveFailures: 2,
      },
      notifier: new WebhookMonitoringNotifier({
        url: webhook.url,
        secret: "integration-secret",
      }),
      now: scriptedClock([
        "2026-03-27T10:00:00.000Z",
        "2026-03-27T10:00:01.000Z",
        "2026-03-27T10:00:01.000Z",
        "2026-03-27T10:01:00.000Z",
        "2026-03-27T10:01:01.000Z",
        "2026-03-27T10:01:00.000Z",
      ]),
    },
  );
  const app = createCatalogApp({
    service,
    syncToken: "secret",
  });

  try {
    const firstSync = await app.inject({
      method: "POST",
      url: "/v1/sync",
      headers: { "x-arkafund-sync-token": "secret" },
    });
    assert.equal(firstSync.statusCode, 200);

    const firstStatus = await app.inject({
      method: "GET",
      url: "/v1/monitoring/status",
    });
    assert.equal(firstStatus.statusCode, 200);
    assert.equal(firstStatus.json().degraded, true);
    assert.equal(firstStatus.json().activeAlerts[0].kind, "partial_sync_failures");

    const secondSync = await app.inject({
      method: "POST",
      url: "/v1/sync",
      headers: { "x-arkafund-sync-token": "secret" },
    });
    assert.equal(secondSync.statusCode, 200);

    const runs = await app.inject({
      method: "GET",
      url: "/v1/monitoring/runs?order=asc",
    });
    assert.equal(runs.statusCode, 200);
    assert.equal(runs.json().total, 2);
    assert.equal(runs.json().items[0].failedArkas, 1);
    assert.equal(runs.json().items[1].failedArkas, 0);

    const alerts = await app.inject({
      method: "GET",
      url: "/v1/monitoring/alerts",
    });
    assert.equal(alerts.statusCode, 200);
    assert.equal(alerts.json()[0].active, false);
    assert.equal(alerts.json()[0].lastResolvedAt, "2026-03-27T10:01:00.000Z");

    assert.equal(webhook.events.length, 2);
    assert.equal(webhook.events[0].transitions[0].action, "triggered");
    assert.equal(webhook.events[1].transitions[0].action, "resolved");
    assert.equal(webhook.signatures[0], signPayload("integration-secret", webhook.payloads[0]));
  } finally {
    await app.close();
    await webhook.close();
  }
});

test("HTTP API records failed sync runs and exposes critical monitoring status", async () => {
  const directory = await mkdtemp(join(tmpdir(), "catalog-api-sync-failure-"));
  const runner = new StaticCatalogSyncRunner(async () => {
    throw new Error("registry RPC unavailable");
  });
  const service = new CatalogService(
    new FileCatalogStore(join(directory, "snapshot.json")),
    new FileCatalogHistoryStore(join(directory, "history.json")),
    runner,
    {
      monitoringStore: new FileMonitoringStore(join(directory, "monitoring.json")),
      now: scriptedClock([
        "2026-03-27T11:00:00.000Z",
        "2026-03-27T11:00:01.000Z",
        "2026-03-27T11:00:01.000Z",
      ]),
    },
  );
  const app = createCatalogApp({ service, syncToken: "secret" });

  try {
    const syncResponse = await app.inject({
      method: "POST",
      url: "/v1/sync",
      headers: { "x-arkafund-sync-token": "secret" },
    });
    assert.equal(syncResponse.statusCode, 500);

    const health = await app.inject({ method: "GET", url: "/health" });
    assert.equal(health.statusCode, 503);
    assert.equal(health.json().healthy, false);

    const monitoring = await app.inject({
      method: "GET",
      url: "/v1/monitoring/status",
    });
    assert.equal(monitoring.statusCode, 200);
    assert.deepEqual(
      monitoring.json().activeAlerts.map((alert: { kind: string }) => alert.kind).sort(),
      ["snapshot_missing", "sync_failed"],
    );

    const runs = await app.inject({
      method: "GET",
      url: "/v1/monitoring/runs?status=failure",
    });
    assert.equal(runs.statusCode, 200);
    assert.equal(runs.json().total, 1);
    assert.equal(runs.json().items[0].errorMessage, "registry RPC unavailable");
  } finally {
    await app.close();
  }
});

test("HTTP API saves signed Arka and manager identity metadata", async () => {
  const directory = await mkdtemp(join(tmpdir(), "catalog-api-identity-"));
  const managerKey = Keypair.random();
  const otherKey = Keypair.random();
  const manager = managerKey.publicKey();
  const arkaId = "CIDENTITYARKA";
  const identityArka = {
    ...arkaOne,
    arkaId,
    manager,
    curated: false,
  };
  const runner = new StaticCatalogSyncRunner(async () =>
    buildSnapshot([identityArka], [], syncedAt),
  );
  const service = new CatalogService(
    new FileCatalogStore(join(directory, "snapshot.json")),
    new FileCatalogHistoryStore(join(directory, "history.json")),
    runner,
    {
      now: () => new Date("2026-07-07T10:00:00.000Z"),
    },
  );
  const app = createCatalogApp({ service });

  try {
    await app.inject({ method: "POST", url: "/v1/sync" });

    const arkaRequest = signIdentityUpdate({
      keypair: managerKey,
      scope: "arka",
      target: arkaId,
      payload: {
        displayName: "Stellar Growth Arka",
        description: "Public test mandate.",
        avatarUrl: null,
        websiteUrl: "https://arka.fund/",
        socialUrl: null,
        nonce: "identity-test-1",
        issuedAt: "2026-07-07T10:00:00.000Z",
      },
    });
    const arkaResponse = await app.inject({
      method: "PUT",
      url: `/v1/arkas/${arkaId}/identity`,
      payload: arkaRequest,
    });
    assert.equal(arkaResponse.statusCode, 200);
    assert.equal(arkaResponse.json().displayName, "Stellar Growth Arka");

    const managerRequest = signIdentityUpdate({
      keypair: managerKey,
      scope: "manager",
      target: manager,
      payload: {
        displayName: "Stellar Growth Manager",
        description: null,
        avatarUrl: null,
        websiteUrl: null,
        socialUrl: null,
        nonce: "identity-test-2",
        issuedAt: "2026-07-07T10:00:00.000Z",
      },
    });
    const managerResponse = await app.inject({
      method: "PUT",
      url: `/v1/managers/${manager}/identity`,
      payload: managerRequest,
    });
    assert.equal(managerResponse.statusCode, 200);
    assert.equal(managerResponse.json().displayName, "Stellar Growth Manager");

    const arkaIdentity = await app.inject({
      method: "GET",
      url: `/v1/arkas/${arkaId}/identity`,
    });
    assert.equal(arkaIdentity.statusCode, 200);
    assert.equal(arkaIdentity.json().displayName, "Stellar Growth Arka");

    const managerIdentity = await app.inject({
      method: "GET",
      url: `/v1/managers/${manager}/identity`,
    });
    assert.equal(managerIdentity.statusCode, 200);
    assert.equal(managerIdentity.json().displayName, "Stellar Growth Manager");

    const detail = await app.inject({
      method: "GET",
      url: `/v1/arkas/${arkaId}`,
    });
    assert.equal(detail.statusCode, 200);
    assert.equal(detail.json().identity.displayName, "Stellar Growth Arka");

    const search = await app.inject({
      method: "GET",
      url: "/v1/arkas?search=Growth",
    });
    assert.equal(search.statusCode, 200);
    assert.equal(search.json().total, 1);
    assert.equal(search.json().items[0].identity.displayName, "Stellar Growth Arka");

    const blockedRequest = signIdentityUpdate({
      keypair: otherKey,
      scope: "arka",
      target: arkaId,
      payload: {
        displayName: "Wrong Manager",
        description: null,
        avatarUrl: null,
        websiteUrl: null,
        socialUrl: null,
        nonce: "identity-test-3",
        issuedAt: "2026-07-07T10:00:00.000Z",
      },
    });
    const blocked = await app.inject({
      method: "PUT",
      url: `/v1/arkas/${arkaId}/identity`,
      payload: blockedRequest,
    });
    assert.equal(blocked.statusCode, 403);
    assert.equal(blocked.json().error, "not_manager");
  } finally {
    await app.close();
  }
});

async function startWebhookSink(): Promise<{
  url: string;
  payloads: string[];
  signatures: string[];
  events: Array<{ transitions: Array<{ action: string }> }>;
  close: () => Promise<void>;
}> {
  const payloads: string[] = [];
  const signatures: string[] = [];
  const events: Array<{ transitions: Array<{ action: string }> }> = [];
  const server = createServer(async (request: IncomingMessage, response: ServerResponse) => {
    const body = await readBody(request);
    payloads.push(body);
    signatures.push(String(request.headers["x-arkafund-signature"] ?? ""));
    events.push(JSON.parse(body) as { transitions: Array<{ action: string }> });
    response.writeHead(204).end();
  });

  await new Promise<void>((resolve) => {
    server.listen(0, "127.0.0.1", () => resolve());
  });

  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("Webhook sink did not bind to a TCP port");
  }

  return {
    url: `http://127.0.0.1:${address.port}/alerts`,
    payloads,
    signatures,
    events,
    close: async () =>
      new Promise<void>((resolve, reject) => {
        server.close((error) => {
          if (error) {
            reject(error);
            return;
          }
          resolve();
        });
      }),
  };
}

async function readBody(request: IncomingMessage): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of request) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks).toString("utf8");
}

function signIdentityUpdate(input: {
  keypair: Keypair;
  scope: "arka" | "manager";
  target: string;
  payload: {
    displayName?: string | null;
    description?: string | null;
    avatarUrl?: string | null;
    websiteUrl?: string | null;
    socialUrl?: string | null;
    nonce: string;
    issuedAt: string;
  };
}) {
  const signer = input.keypair.publicKey();
  const message = buildIdentityUpdateMessage({
    scope: input.scope,
    target: input.target,
    signer,
    payload: input.payload,
  });
  return {
    signer,
    message,
    signature: input.keypair.sign(Buffer.from(message, "utf8")).toString("base64"),
    payload: input.payload,
  };
}

function scriptedClock(values: string[]): () => Date {
  let index = 0;
  return () => {
    const value = values[Math.min(index, values.length - 1)];
    index += 1;
    return new Date(value);
  };
}
