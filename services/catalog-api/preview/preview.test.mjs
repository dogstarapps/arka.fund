import assert from 'node:assert/strict';
import { test } from 'node:test';
import { StrKey } from '@stellar/stellar-sdk';
import { BlobCatalogHistory } from './blob-history.mjs';
import { coveredProfit, readTestnetIndexedCatalog } from './index.mjs';

const registry = StrKey.encodeContract(Buffer.alloc(32, 1));
const network = 'Test SDF Network ; September 2015';
const observation = minutes => ({
  syncedAt: new Date(Date.UTC(2026, 0, 1, 12, minutes)).toISOString(),
  arkas: [{ nav: '90000000' }],
  failures: [],
});

test('a fresh index restores persistent observations and concurrent writes preserve both intervals', async () => {
  let object;
  let revision = 0;
  let conflicts = 0;
  const client = {
    async get(path, etag) {
      assert.equal(path, `catalog-history/v1/testnet/${registry}/history.json.gz`);
      if (!object) return null;
      return etag === String(revision) ? { unchanged: true } : { etag: String(revision), bytes: object };
    },
    async put(_path, bytes, etag) {
      if (etag !== (object ? String(revision) : undefined)) {
        conflicts++;
        throw new Error('CONFLICT');
      }
      object = bytes;
      return String(++revision);
    },
    isConflict: error => error.message === 'CONFLICT',
  };
  const history = initialize => new BlobCatalogHistory({ client, network, registry, initialize });

  await assert.rejects(history(false).read(), /not been initialized/);
  await assert.rejects(history(false).append(observation(0)), /not been initialized/);
  await history(true).append(observation(0));
  await Promise.all([history(false).append(observation(5)), history(false).append(observation(10))]);
  assert.ok(conflicts > 0);
  await history(false).append(observation(11));
  await history(false).append({ ...observation(15), failures: [{ message: 'Missing fund value' }] });
  assert.deepEqual((await history(false).read()).runs.map(run => run.syncedAt),
    [0, 5, 10].map(minute => observation(minute).syncedAt));
  assert.equal(revision, 3);
});

test('the adapter refuses mainnet and writes before performing any remote reads', async t => {
  const flags = {
    VERCEL_ENV: 'production',
    ARKAFUND_NETWORK_TARGET: 'testnet',
    NEXT_PUBLIC_STELLAR_NETWORK: network,
    NEXT_PUBLIC_UX_REVIEW_PREVIEW: '1',
  };
  for (const [key, value] of Object.entries(flags)) {
    const previous = process.env[key];
    process.env[key] = value;
    t.after(() => {
      if (previous === undefined) delete process.env[key];
      else process.env[key] = previous;
    });
  }
  const url = 'https://example.invalid/v1/arkas';
  const path = ['v1', 'arkas'];
  assert.equal((await readTestnetIndexedCatalog(new Request(url), path)).status, 503);
  process.env.VERCEL_ENV = 'preview';
  assert.equal((await readTestnetIndexedCatalog(new Request(url, { method: 'PUT' }), path)).status, 405);
});

test('profit uses complete cashflows in the denomination and distinguishes a real zero from missing history', () => {
  const fund = { arkaId: registry, nav: '90000000', denominationContract: 'XLM' };
  const event = (ledger, topic, value) => ({ ledger, topic, value, contractId: registry });
  const init = event(1, 'initcfg', ['manager', 'XLM']);
  const deposit = event(2, 'deposit', ['holder', 'XLM', 100000000n, 100000000n]);
  const redeem = event(3, 'redeem', ['holder', 10000000n, 10000000n]);
  const settled = event(3, 'withdraw_settled', [1n, 10000000n, 10000000n, 100000000n, 100000000n]);
  const claim = event(4, 'withdraw_claimed', [1n, 'holder', 10000000n]);
  assert.equal(coveredProfit(fund, [init, deposit, redeem]), '0');
  assert.equal(coveredProfit(fund, [init, deposit, settled, claim]), '0');
  assert.equal(coveredProfit({ ...fund, nav: '80000000' }, [init, deposit, redeem]), '-10000000');
  assert.equal(coveredProfit(fund, [deposit, redeem]), null);
  assert.equal(coveredProfit(fund, [init, { ...deposit, value: ['holder', 'USDC', 100000000n, 100000000n] }, redeem]), null);
});
