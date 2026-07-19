import test from "node:test";
import assert from "node:assert/strict";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { mkdtemp } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  CatalogService,
  createCatalogApp,
  createClientOptions,
  createKeypairSigner,
  FileCatalogHistoryStore,
  FileCatalogStore,
  FileMonitoringStore,
  mergeCallOptions,
  OnChainCatalogSyncRunner,
  RpcActivityReader,
  signPayload,
  submitTransaction,
  WebhookMonitoringNotifier,
} from "../../src/index.js";
import { Client as ArkaClient } from "../../src/generated/arka.js";
import { Client as TestTokenClient } from "../../src/generated/test-token.js";
import { loadLiveCatalogEnv } from "../support/liveEnv.js";

const env = loadLiveCatalogEnv();

test("catalog API exposes synced rankings, dashboard, history, and monitoring over HTTP", async () => {
  const directory = await mkdtemp(join(tmpdir(), "catalog-api-live-"));
  const webhook = await startWebhookSink();
  const service = new CatalogService(
    new FileCatalogStore(join(directory, "snapshot.json")),
    new FileCatalogHistoryStore(join(directory, "history.json")),
    new OnChainCatalogSyncRunner({
      rpcUrl: env.rpcUrl,
      networkPassphrase: env.networkPassphrase,
      registryContractId: env.registryContractId,
      allowHttp: true,
    }),
    {
      monitoringStore: new FileMonitoringStore(join(directory, "monitoring.json")),
      monitoringThresholds: {
        maxSnapshotAgeSeconds: 10_000,
        maxSyncDurationMs: 0,
        maxFailureRatio: 0.25,
        maxConsecutiveFailures: 2,
      },
      notifier: new WebhookMonitoringNotifier({
        url: webhook.url,
        secret: "live-e2e-secret",
      }),
      activityReader: new RpcActivityReader({
        rpcUrl: env.rpcUrl,
        networkPassphrase: env.networkPassphrase,
        allowHttp: true,
        lookbackLedgers: 10_000,
      }),
    },
  );
  const app = createCatalogApp({
    service,
    syncToken: env.syncToken,
  });

  const address = await app.listen({ host: "127.0.0.1", port: 0 });
  try {
    const firstSyncResponse = await fetch(`${address}/v1/sync`, {
      method: "POST",
      headers: { "x-arkafund-sync-token": env.syncToken },
    });
    assert.equal(firstSyncResponse.status, 200);

    const arkas = await fetch(`${address}/v1/arkas?sort=nav&order=desc`).then((response) =>
      response.json(),
    );
    assert.equal(arkas.items[0].nav, "2000");
    assert.equal(arkas.items[1].nav, "500");

    const monitoringStatus = await fetch(`${address}/v1/monitoring/status`).then((response) =>
      response.json(),
    );
    assert.equal(monitoringStatus.healthy, true);
    assert.equal(monitoringStatus.degraded, true);
    assert.equal(monitoringStatus.activeAlerts[0].kind, "sync_slow");

    await mutateLiveFixture();

    const secondSyncResponse = await fetch(`${address}/v1/sync`, {
      method: "POST",
      headers: { "x-arkafund-sync-token": env.syncToken },
    });
    assert.equal(secondSyncResponse.status, 200);

    const managers = await fetch(`${address}/v1/managers?sort=totalNav&order=desc`).then(
      (response) => response.json(),
    );
    assert.equal(managers.items[0].totalNav, "2000");

    const assets = await fetch(`${address}/v1/assets?sort=netManagedAmount&order=desc`).then(
      (response) => response.json(),
    );
    assert.equal(assets.items[0].netManagedAmount, "3000");

    const dashboardOverview = await waitForJson<{
      totalNav: string;
      totalNavDelta: string | null;
      activity: { depositVolume: string };
    }>(
      `${address}/v1/dashboard/overview?activityLimit=10`,
      (payload) => payload?.activity?.depositVolume === "3000",
    );
    assert.equal(dashboardOverview.totalNav, "3000");
    assert.equal(dashboardOverview.totalNavDelta, "500");
    assert.equal(dashboardOverview.activity.depositVolume, "3000");

    const dashboardComposition = await fetch(
      `${address}/v1/dashboard/composition?limit=5`,
    ).then((response) => response.json());
    assert.equal(dashboardComposition.items[0].assetContract, required(env.tokenContractId, "tokenContractId"));
    assert.equal(dashboardComposition.items[0].navContribution, "3000");

    const historyRuns = await fetch(`${address}/v1/history?order=asc`).then((response) =>
      response.json(),
    );
    assert.equal(historyRuns.total, 2);

    const monitoringRuns = await fetch(
      `${address}/v1/monitoring/runs?order=asc`,
    ).then((response) => response.json());
    assert.equal(monitoringRuns.total, 2);
    assert.equal(monitoringRuns.items[0].status, "success");

    const alerts = await fetch(`${address}/v1/monitoring/alerts?active=true`).then(
      (response) => response.json(),
    );
    assert.equal(alerts[0].kind, "sync_slow");

    const arkaTwoHistory = await fetch(
      `${address}/v1/arkas/${required(env.arkaTwoContractId, "arkaTwoContractId")}/history?order=asc`,
    ).then((response) => response.json());
    assert.deepEqual(
      arkaTwoHistory.items.map((point: { nav: string }) => point.nav),
      ["500", "1000"],
    );

    const managerTwoHistory = await fetch(
      `${address}/v1/managers/${await loadArkaManager(required(env.arkaTwoContractId, "arkaTwoContractId"))}/history?order=asc`,
    ).then((response) => response.json());
    assert.deepEqual(
      managerTwoHistory.items.map((point: { totalNav: string }) => point.totalNav),
      ["500", "1000"],
    );

    const assetHistory = await fetch(
      `${address}/v1/assets/${required(env.tokenContractId, "tokenContractId")}/history?order=asc`,
    ).then((response) => response.json());
    assert.deepEqual(
      assetHistory.items.map((point: { netManagedAmount: string }) => point.netManagedAmount),
      ["2500", "3000"],
    );

    const arkaTwoAssets = await fetch(
      `${address}/v1/arkas/${required(env.arkaTwoContractId, "arkaTwoContractId")}/assets`,
    ).then((response) => response.json());
    assert.equal(arkaTwoAssets[0].netManagedAmount, "1000");

    const arkaTwoPortfolio = await fetch(
      `${address}/v1/arkas/${required(env.arkaTwoContractId, "arkaTwoContractId")}/portfolio`,
    ).then((response) => response.json());
    assert.equal(arkaTwoPortfolio.nav, "1000");
    assert.equal(arkaTwoPortfolio.items[0].navContribution, "1000");

    const arkaTwoAssetHistory = await fetch(
      `${address}/v1/arkas/${required(env.arkaTwoContractId, "arkaTwoContractId")}/assets/${required(env.tokenContractId, "tokenContractId")}/history?order=asc`,
    ).then((response) => response.json());
    assert.deepEqual(
      arkaTwoAssetHistory.items.map((point: { netManagedAmount: string }) => point.netManagedAmount),
      ["500", "1000"],
    );

    const activity = await fetch(
      `${address}/v1/arkas/${required(env.arkaTwoContractId, "arkaTwoContractId")}/activity?kind=deposit&limit=5`,
    ).then((response) => response.json());
    assert.ok(activity.total >= 2);
    assert.equal(activity.items[0].kind, "deposit");
    assert.equal(activity.items[0].assetContract, required(env.tokenContractId, "tokenContractId"));

    const health = await fetch(`${address}/health`).then((response) => response.json());
    assert.equal(health.healthy, true);
    assert.equal(health.degraded, true);

    assert.equal(webhook.payloads.length, 1);
    assert.equal(webhook.events[0].transitions[0].kind, "sync_slow");
    assert.equal(
      webhook.signatures[0],
      signPayload("live-e2e-secret", webhook.payloads[0]),
    );
  } finally {
    await app.close();
    await webhook.close();
  }
});

async function mutateLiveFixture(): Promise<void> {
  const depositorSecret = required(env.depositorSecret, "depositorSecret");
  const depositorPublicKey = required(env.depositorPublicKey, "depositorPublicKey");
  const tokenContractId = required(env.tokenContractId, "tokenContractId");
  const arkaTwoContractId = required(env.arkaTwoContractId, "arkaTwoContractId");
  const signer = createKeypairSigner(depositorSecret, env.networkPassphrase);
  const clientConfig = {
    rpcUrl: env.rpcUrl,
    networkPassphrase: env.networkPassphrase,
    allowHttp: true,
    ...signer,
  };

  const tokenClient = new TestTokenClient(createClientOptions(clientConfig, tokenContractId));
  const arkaClient = new ArkaClient(createClientOptions(clientConfig, arkaTwoContractId));

  await submitTransaction(
    clientConfig,
    await tokenClient.approve(
      {
        owner: depositorPublicKey,
        spender: arkaTwoContractId,
        amount: 500n,
        expiration_ledger: 1_000_000,
      },
      mergeCallOptions(undefined, true),
    ),
  );

  await submitTransaction(
    clientConfig,
    await arkaClient.deposit(
      {
        user: depositorPublicKey,
        asset: { contract: tokenContractId },
        amount: 500n,
      },
      mergeCallOptions(undefined, true),
    ),
  );
}

async function loadArkaManager(arkaContractId: string): Promise<string> {
  const client = new ArkaClient(
    createClientOptions(
      {
        rpcUrl: env.rpcUrl,
        networkPassphrase: env.networkPassphrase,
        allowHttp: true,
      },
      arkaContractId,
    ),
  );
  const tx = await client.manager(mergeCallOptions(undefined, true));
  return tx.result as string;
}

async function startWebhookSink(): Promise<{
  url: string;
  payloads: string[];
  signatures: string[];
  events: Array<{ transitions: Array<{ kind: string }> }>;
  close: () => Promise<void>;
}> {
  const payloads: string[] = [];
  const signatures: string[] = [];
  const events: Array<{ transitions: Array<{ kind: string }> }> = [];
  const server = createServer(async (request: IncomingMessage, response: ServerResponse) => {
    const body = await readBody(request);
    payloads.push(body);
    signatures.push(String(request.headers["x-arkafund-signature"] ?? ""));
    events.push(JSON.parse(body) as { transitions: Array<{ kind: string }> });
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

function required(value: string | undefined, field: string): string {
  if (!value) {
    throw new Error(`Missing live fixture value: ${field}`);
  }
  return value;
}

async function waitForJson<T>(
  url: string,
  predicate: (payload: T) => boolean,
  timeoutMs = 12_000,
  intervalMs = 500,
): Promise<T> {
  const deadline = Date.now() + timeoutMs;
  let lastPayload: T | null = null;

  while (Date.now() <= deadline) {
    const response = await fetch(url);
    lastPayload = (await response.json()) as T;
    if (predicate(lastPayload)) {
      return lastPayload;
    }
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }

  throw new Error(`Timed out waiting for expected JSON payload at ${url}: ${JSON.stringify(lastPayload)}`);
}
