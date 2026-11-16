import { createHash } from 'node:crypto';
import { mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Address, Asset, Contract, Networks, rpc, scValToNative, StrKey } from '@stellar/stellar-sdk';
import { CatalogService } from '../dist/src/service.js';
import { FileCatalogStore } from '../dist/src/store.js';
import { OnChainCatalogSyncRunner } from '../dist/src/runners.js';
import { RpcHolderReader } from '../dist/src/holders.js';
import { RpcActivityReader } from '../dist/src/activity.js';
import { collectHistoricalEvents, eventCursorLedger } from '../dist/src/historicalCoverage.js';
import { BlobCatalogHistory } from './blob-history.mjs';
import { createBlobHistoryClient } from './blob-client.mjs';

const RPC = 'https://soroban-testnet.stellar.org';
const networkPassphrase = Networks.TESTNET;
const XLM = Asset.native().contractId(networkPassphrase);
const refreshWindow = 60_000;
let initialization;
let inFlight;
let lastSync = 0;

export const testnetIndexPackaged = true;

function readConfig() {
  const registry = process.env.NEXT_PUBLIC_ARKA_REGISTRY || '';
  const readSource = process.env.ARKA_TESTNET_CATALOG_SOURCE_ACCOUNT || '';
  const initialLedger = Number(process.env.ARKA_TESTNET_CATALOG_START_LEDGER);
  const reviewedWasm = (process.env.ARKA_TESTNET_CATALOG_WASM_HASHES || '').split(',').filter(Boolean);
  if (!StrKey.isValidContract(registry) || !StrKey.isValidEd25519PublicKey(readSource) ||
      !Number.isSafeInteger(initialLedger) || initialLedger < 1 ||
      !reviewedWasm.length || !reviewedWasm.every(hash => /^[a-f0-9]{64}$/.test(hash))) {
    throw new Error('Invalid Testnet catalog settings');
  }
  return { registry, readSource, initialLedger, reviewedWasm };
}

function exact(value) {
  return typeof value === 'bigint' && value >= 0n ? value : null;
}

// Both reviewed implementations emit accounting movements in the denomination.
// Legacy redemptions leave NAV on payment. Managed withdrawals leave NAV on settlement.
export function coveredProfit(arka, events) {
  if (arka.nav === null || !arka.denominationContract) return null;
  const rows = events.filter(event => event.contractId === arka.arkaId);
  const initializations = rows.filter(event => event.topic === 'initcfg');
  if (initializations.length !== 1 || initializations[0].value?.[1] !== arka.denominationContract) return null;
  let deposits = 0n;
  let withdrawals = 0n;
  for (const row of rows) {
    if (!['deposit', 'redeem', 'withdraw_settled'].includes(row.topic)) continue;
    if (row.ledger < initializations[0].ledger || !Array.isArray(row.value)) return null;
    if (row.topic === 'deposit') {
      const legacy = row.value.length === 3;
      const asset = legacy ? arka.denominationContract : row.value[1];
      const amount = exact(row.value[legacy ? 1 : 2]);
      if ((!legacy && row.value.length !== 4) || asset !== arka.denominationContract || amount === null) return null;
      deposits += amount;
    } else {
      const amount = exact(row.value[2]);
      if (row.value.length !== (row.topic === 'redeem' ? 3 : 5) || amount === null) return null;
      withdrawals += amount;
    }
  }
  return (BigInt(arka.nav) + withdrawals - deposits).toString();
}

const accountingTopics = new Set(['initcfg', 'deposit', 'redeem', 'withdraw_settled']);

async function eventHistory(server, ids, first, tip) {
  if (!ids.length || first < tip.oldestLedger) return null;
  const result = await collectHistoricalEvents({
    network: networkPassphrase, contracts: ids, fromLedger: first,
    oldestLedger: tip.oldestLedger, latestLedger: tip.latestLedger,
    maxPages: 12, pageSize: 100,
    transport: { async events(start, end, cursor) {
      const filters = [{ type: 'contract', contractIds: ids }];
      const bounds = cursor ? { cursor } : { startLedger: start, endLedger: end };
      const page = await server.getEvents({ ...bounds, filters, limit: 100 });
      const events = page.events.filter(event => event.inSuccessfulContractCall !== false && event.ledger <= end).map(event => ({
        id: event.id, ledger: event.ledger, contractId: event.contractId?.toString(), txHash: event.txHash,
        topic: event.topic.length ? scValToNative(event.topic[0]) : null,
        value: scValToNative(event.value),
      }));
      const scannedThrough = page.events.some(event => event.ledger > end) ? end : eventCursorLedger(page.cursor, end);
      return { events, cursor: page.cursor, scannedThrough };
    } },
  }, async () => {});
  if (!result.complete) return null;
  const accounting = result.events.filter(event => accountingTopics.has(event.topic));
  const verified = new Map();
  for (const event of accounting) {
    if (!verified.has(event.txHash)) verified.set(event.txHash, await server.getTransaction(event.txHash));
    const tx = verified.get(event.txHash);
    if (tx.status !== 'SUCCESS' || tx.ledger !== event.ledger) return null;
  }
  return result.events;
}

async function readReviewedFunds(server, arkas, reviewedWasm) {
  const entries = await server.getLedgerEntries(...arkas.map(arka => new Contract(arka.arkaId).getFootprint()));
  return new Set(entries.entries.flatMap(entry => {
    const instance = entry.val.contractData();
    const executable = instance.val().instance().executable();
    const hash = executable.switch().name === 'contractExecutableWasm' ? executable.wasmHash().toString('hex') : '';
    return reviewedWasm.includes(hash) ? [Address.fromScAddress(instance.contract()).toString()] : [];
  }));
}

async function readSnapshot(runner, server, config) {
  const from = await server.getHealth();
  const snapshot = await runner.run();
  try {
    const through = await server.getHealth();
    const reviewed = await readReviewedFunds(server, snapshot.arkas, config.reviewedWasm);
    const ids = snapshot.arkas.filter(arka => reviewed.has(arka.arkaId)).map(arka => arka.arkaId);
    const events = await eventHistory(server, ids, config.initialLedger, through);
    if (events) {
      for (const arka of snapshot.arkas) {
        if (!reviewed.has(arka.arkaId) || events.some(row => row.contractId === arka.arkaId && row.ledger >= from.latestLedger)) continue;
        const amount = coveredProfit(arka, events);
        if (amount !== null) arka.economics.pnl = { amount, bps: null };
      }
    }
  } catch (error) {
    console.warn('Testnet profit coverage unavailable', error.name);
  }
  for (const arka of snapshot.arkas) {
    if (arka.denominationContract === XLM && arka.economics?.denominationAsset) {
      Object.assign(arka.economics.denominationAsset, { symbol: 'XLM', label: 'Stellar Lumens' });
    }
  }
  return snapshot;
}

async function createService() {
  const config = readConfig();
  const network = { rpcUrl: RPC, networkPassphrase, publicKey: config.readSource };
  const server = new rpc.Server(RPC);
  const catalogId = createHash('sha256').update(config.registry).digest('hex').slice(0, 16);
  const dir = join(tmpdir(), 'arka-indexed-testnet-' + catalogId);
  const configuredNetwork = await server.getNetwork();
  if (configuredNetwork.passphrase !== networkPassphrase) throw Error('Testnet index network mismatch');
  await mkdir(dir, { recursive: true });
  const history = new BlobCatalogHistory({
    network: networkPassphrase, registry: config.registry,
    initialize: process.env.ARKA_TESTNET_HISTORY_BOOTSTRAP === '1',
    client: createBlobHistoryClient(process.env.ARKA_TESTNET_HISTORY_BLOB_ID),
  });
  const runner = new OnChainCatalogSyncRunner({ ...network, registryContractId: config.registry, readConcurrency: 2 });
  const store = new FileCatalogStore(join(dir, 'snapshot.json'));
  const holders = new RpcHolderReader({ ...network, archiveFile: join(dir, 'holders.json'), initialLedger: config.initialLedger });
  const service = new CatalogService(store, history, { run: () => readSnapshot(runner, server, config) }, {
    holderReader: { list: (arka, query) => holders.list(arka, query, { fresh: true }) },
    activityReader: new RpcActivityReader({ ...network, lookbackLedgers: 10_000 }),
  });
  return { service, history };
}

async function getIndex() {
  initialization ??= createService().catch(error => { initialization = undefined; throw error; });
  const runtime = await initialization;
  if (Date.now() - lastSync >= refreshWindow) {
    inFlight ??= runtime.service.sync().then(() => { lastSync = Date.now(); }).finally(() => { inFlight = undefined; });
    await inFlight;
  }
  return runtime;
}

function optionalInt(search, key) {
  const value = search.get(key);
  return value && /^\d{1,9}$/.test(value) ? Number(value) : undefined;
}

function optionalBoolean(search, key) {
  const value = search.get(key);
  return ['1', 'true'].includes(value) ? true : ['0', 'false'].includes(value) ? false : undefined;
}

export async function readTestnetIndexedCatalog(request, path) {
  const [version, collection, id, resource, ...remainder] = path;
  const key = path.join('/');
  const platformPath = ['v1/dashboard/overview', 'v1/dashboard/composition', 'v1/monitoring/status', 'v1/managers', 'v1/assets'].includes(key);
  const arkaPath = version === 'v1' && collection === 'arkas' && !remainder.length &&
    (!resource || ['history', 'holders', 'portfolio', 'activity', 'assets', 'identity'].includes(resource));
  if (!platformPath && !arkaPath) return null;

  // The deployment installs this adapter only in the dedicated protected Testnet project.
  if (process.env.VERCEL_ENV !== 'preview' || process.env.ARKAFUND_NETWORK_TARGET !== 'testnet' ||
      process.env.NEXT_PUBLIC_STELLAR_NETWORK !== networkPassphrase ||
      process.env.NEXT_PUBLIC_UX_REVIEW_PREVIEW !== '1') return Response.json({ error: 'Testnet index unavailable.' }, { status: 503 });
  const headers = { 'cache-control': 'no-store', 'x-arkafund-catalog-source': 'testnet-native-index', 'x-arkafund-history-store': 'private-blob' };
  if (request.method !== 'GET') return Response.json({ error: 'Read-only preview.' }, { status: 405, headers });
  if (arkaPath && id && !/^C[A-Z2-7]{55}$/.test(id)) return Response.json({ error: 'Arka not found.' }, { status: 404, headers });
  try {
    const { service: index, history } = await getIndex();
    const search = new URL(request.url).searchParams;
    const page = { offset: optionalInt(search, 'offset'), limit: optionalInt(search, 'limit') };
    const order = search.get('order') === 'asc' ? 'asc' : 'desc';
    let body;
    if (platformPath) {
      const common = { ...page, order, search: search.get('search') || undefined };
      switch (key) {
        case 'v1/dashboard/overview': body = await index.dashboardOverview({ activityLimit: optionalInt(search, 'activityLimit') }); break;
        case 'v1/dashboard/composition': body = await index.dashboardComposition({ limit: page.limit }); break;
        case 'v1/monitoring/status': body = await index.monitoringStatus(); break;
        case 'v1/managers': body = await index.managers(common); break;
        case 'v1/assets': body = await index.assets(common); break;
      }
    } else if (!id) {
      const sort = search.get('sort');
      body = await index.arkas({ ...page, order, sort: ['nav', 'manager', 'syncedAt'].includes(sort) ? sort : undefined,
        search: search.get('search') || undefined, curated: optionalBoolean(search, 'curated'), delisted: optionalBoolean(search, 'delisted') });
    } else {
      switch (resource) {
        case 'history': {
          const from = search.get('from') || undefined;
          const to = search.get('to') || undefined;
          const query = { order, limit: page.limit, from, to };
          body = await history.page(id, await index.arkaHistory(id, { order, from, to }), query);
          break;
        }
        case 'holders': body = await index.arkaHolders(id, page); break;
        case 'portfolio': body = await index.arkaPortfolio(id, { limit: page.limit }); break;
        case 'activity': {
          const kind = search.get('kind');
          body = await index.arkaActivity(id, { kind: ['deposit', 'redeem', 'profit', 'lend', 'borrow', 'repay', 'withdraw'].includes(kind) ? kind : undefined, order, limit: page.limit, fromLedger: optionalInt(search, 'fromLedger'), toLedger: optionalInt(search, 'toLedger') });
          break;
        }
        case 'assets': body = await index.arka(id) ? await index.arkaAssets(id) : null; break;
        case 'identity': body = await index.arkaIdentity(id); break;
        default: body = await index.arka(id); break;
      }
    }
    return body === null ? Response.json({ error: 'Arka data unavailable.' }, { status: 404, headers }) : Response.json(body, { headers });
  } catch (error) {
    console.warn('Testnet catalog read unavailable', error.name);
    return Response.json({ error: 'The Testnet catalog is temporarily unavailable.' }, { status: 503, headers });
  }
}
