import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const repositoryRoot = resolve(scriptDirectory, "..");
const docsDirectory = resolve(repositoryRoot, "docs-site");
const manifest = JSON.parse(
  await readFile(resolve(repositoryRoot, "deployments.mainnet.json"), "utf8"),
);
const { CATALOG_OPENAPI_DOCUMENT } = await import(
  "../services/catalog-api/dist/src/openapi/document.js"
);

const endpoints = {
  health: "https://catalog.arka.fund/health",
  metrics: "https://catalog.arka.fund/v1/metrics",
  monitoring: "https://catalog.arka.fund/v1/monitoring/status",
  curatedArkas:
    "https://catalog.arka.fund/v1/arkas?curated=true&delisted=false&limit=20",
  nav: "https://catalog.arka.fund/v1/nav",
};

const [health, metrics, monitoring, curatedArkas] = await Promise.all([
  fetchJson(endpoints.health),
  fetchJson(endpoints.metrics),
  fetchJson(endpoints.monitoring),
  fetchJson(endpoints.curatedArkas),
]);
const nav = await fetchJson(endpoints.nav);
const latency = await measureLatency(endpoints.nav, 20);

const generatedAt = new Date().toISOString();
const contracts = Object.entries(manifest.contracts).map(([name, contractId]) => ({
  name,
  contractId,
  wasmHash: wasmHashFor(name, manifest.wasmHashes),
  explorer: `https://stellar.expert/explorer/public/contract/${contractId}`,
}));

const systemSnapshot = {
  schemaVersion: 1,
  generatedAt,
  network: "Stellar mainnet",
  endpoints,
  indexer: {
    healthy: health.healthy,
    degraded: health.degraded,
    indexedArkas: health.indexedArkas,
    failedArkas: health.failedArkas,
    lastSyncedAt: health.lastSyncedAt,
  },
  nav: {
    totalArkas: nav.totalArkas,
    totalManagers: nav.totalManagers,
    totalNav: nav.totalNav,
    monitoring: nav.monitoring,
  },
  catalog: metrics,
  curatedArkas: {
    total: curatedArkas.total,
    contracts: curatedArkas.items.map((arka) => ({
      arkaId: arka.arkaId,
      manager: arka.manager,
      curated: arka.curated,
      delisted: arka.delisted,
      nav: arka.nav,
      explorer: `https://stellar.expert/explorer/public/contract/${arka.arkaId}`,
    })),
  },
  latency,
};

validateSystemSnapshot(systemSnapshot);

await mkdir(docsDirectory, { recursive: true });
await Promise.all([
  writeJson(resolve(docsDirectory, "openapi.json"), CATALOG_OPENAPI_DOCUMENT),
  writeJson(resolve(docsDirectory, "contracts-mainnet.json"), {
    schemaVersion: 1,
    generatedAt,
    network: manifest.network,
    status: manifest.status,
    manifestUpdatedAt: manifest.updatedAt,
    contracts,
  }),
  writeJson(resolve(docsDirectory, "system-status.json"), systemSnapshot),
]);

console.log(
  JSON.stringify(
    {
      generatedAt,
      indexedArkas: health.indexedArkas,
      failedArkas: health.failedArkas,
      curatedArkas: curatedArkas.total,
      navAverageLatencyMs: latency.averageMs,
      contracts: contracts.length,
    },
    null,
    2,
  ),
);

async function fetchJson(url, attempts = 3) {
  let lastError;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const response = await fetch(url, {
        headers: { accept: "application/json" },
        signal: AbortSignal.timeout(15_000),
      });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      return response.json();
    } catch (error) {
      lastError = error;
      if (attempt < attempts) await new Promise((resolve) => setTimeout(resolve, attempt * 500));
    }
  }
    throw new Error(`Platform request failed after ${attempts} attempts: ${url}`, {
    cause: lastError,
  });
}

async function measureLatency(url, samples) {
  const measurements = [];
  for (let index = 0; index < samples; index += 1) {
    const startedAt = performance.now();
    const response = await fetch(url, {
      headers: { accept: "application/json", "cache-control": "no-cache" },
      signal: AbortSignal.timeout(15_000),
    });
    if (!response.ok) {
      throw new Error(`Latency sample failed with HTTP ${response.status}: ${url}`);
    }
    await response.arrayBuffer();
    measurements.push(performance.now() - startedAt);
  }
  const sorted = [...measurements].sort((left, right) => left - right);
  return {
    samples,
    targetAverageMs: 200,
    averageMs: round(measurements.reduce((sum, value) => sum + value, 0) / samples),
    p50Ms: round(percentile(sorted, 0.5)),
    p95Ms: round(percentile(sorted, 0.95)),
    minMs: round(sorted[0]),
    maxMs: round(sorted[sorted.length - 1]),
    measuredAt: new Date().toISOString(),
  };
}

function percentile(sorted, ratio) {
  return sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * ratio) - 1)];
}

function round(value) {
  return Math.round(value * 100) / 100;
}

function wasmHashFor(name, hashes) {
  if (hashes[name]) return hashes[name];
  if (name.startsWith("adapterBlend")) return hashes.adapterBlend ?? null;
  return null;
}

function validateSystemSnapshot(snapshot) {
  if (!snapshot.indexer.healthy) throw new Error("Production indexer is not healthy");
  if (snapshot.indexer.failedArkas !== 0) throw new Error("Production indexer has failed Arkas");
  if (snapshot.curatedArkas.total < 5) throw new Error("Fewer than five curated Arkas");
  if (snapshot.latency.averageMs >= snapshot.latency.targetAverageMs) {
    throw new Error(
      `NAV average latency ${snapshot.latency.averageMs} ms exceeds ${snapshot.latency.targetAverageMs} ms`,
    );
  }
}

async function writeJson(path, value) {
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}
