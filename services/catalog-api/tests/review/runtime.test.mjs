import test from 'node:test';
import assert from 'node:assert/strict';
import { RpcCoordinator, ObservationIndex, sdk, NETWORK } from '../../review/runtime.mjs';
import { createHandler } from '../../review/service.mjs';

const id = n => sdk.StrKey.encodeContract(Buffer.alloc(32, n));
const owner = n => sdk.StrKey.encodeEd25519PublicKey(Buffer.alloc(32, n));
const config = {
  schema: 1, network: NETWORK, endpoint: 'https://rpc.invalid', factory: id(1), registry: id(2),
  denomination: id(3), router: id(4), assets: [id(3)], userCapRaw: '10000000',
  v3Wasm: 'a'.repeat(64), factoryCodeHash: 'b'.repeat(64), registryCodeHash: 'c'.repeat(64),
  templateHash: 'd'.repeat(64), legacyCodeHashes: ['e'.repeat(64)],
  limits: { spacingMs: 10, maxCalls: 10, maxBytes: 1048576, timeoutMs: 1000 },
};

for (const [method, params] of [
  ['sendTransaction', { transaction: 'unsigned-is-still-forbidden' }],
  ['getLedgerEntries', { keys: ['unregistered-key'] }],
  ['simulateTransaction', { transaction: 'unregistered-envelope' }],
  ['getTransaction', { hash: 'f'.repeat(64) }],
  ['getNetwork', { unexpected: true }],
]) {
  test('reader rejects unauthorized RPC shape: ' + method, async () => {
    let calls = 0;
    const rpc = new RpcCoordinator(config, { fetchImpl: async () => { calls++; throw Error('NETWORK_REACHED'); } });
    await assert.rejects(rpc.session().call(method, params));
    assert.equal(calls, 0);
  });
}

test('rate limiting enforces a shared cooldown without retry or provider changes', async () => {
  let now = 1000, calls = 0;
  const rpc = new RpcCoordinator(config, {
    now: () => now, sleep: async ms => { now += ms; },
    fetchImpl: async url => { assert.equal(url, config.endpoint); calls++; return new Response('{}', { status: 429, headers: { 'retry-after': '60' } }); },
  });
  assert.equal((await rpc.fetchPaced(config.endpoint, {})).status, 429);
  await assert.rejects(rpc.fetchPaced(config.endpoint, {}), /RPC_COOLDOWN/);
  assert.equal(calls, 1);
  assert.equal(rpc.stats.retried, 0);
  await assert.rejects(rpc.fetchPaced('https://other.invalid', {}));
  assert.equal(calls, 1);
});

test('an absent observation remains unavailable', async () => {
  assert.equal(await new ObservationIndex().position({ network: NETWORK, fund: id(5), owner: owner(6) }), null);
});
test('an index row for another owner cannot become the requested investment', async () => {
  const index = new ObservationIndex(async () => ({ network: NETWORK, id: id(5), catalogPosition: { owner: owner(7) } }));
  await assert.rejects(index.position({ network: NETWORK, fund: id(5), owner: owner(6) }), /INDEX_QUERY_BINDING/);
});

async function request(overrides = {}, gateway = {}) {
  let status, body;
  const req = { method: 'GET', url: '/status', headers: { host: '127.0.0.1:9500' }, socket: { localPort: 9500 }, ...overrides };
  const res = { writeHead: code => { status = code; }, end: bytes => { body = JSON.parse(bytes); } };
  await createHandler(gateway, { origin: 'https://review.invalid', config })(req, res);
  return { status, body };
}
for (const [name, overrides] of [
  ['POST', { method: 'POST' }],
  ['foreign host', { headers: { host: 'elsewhere.invalid' } }],
  ['foreign origin', { headers: { host: '127.0.0.1:9500', origin: 'https://elsewhere.invalid' } }],
]) {
  test('review HTTP rejects ' + name + ' before invoking the gateway', async () => {
    const result = await request(overrides, new Proxy({}, { get: () => { throw Error('GATEWAY_REACHED'); } }));
    assert.equal(result.status, 403);
    assert.equal(result.body.canSubmit, false);
    assert.equal(result.body.readyForSignature, false);
  });
}
test('status keeps financial execution disabled', async () => {
  const result = await request();
  assert.equal(result.status, 200);
  assert.equal(result.body.financialExecutionEnabled, false);
  assert.equal(result.body.keeperEnabled, false);
  assert.equal(result.body.transactionsSubmitted, 0);
});
test('an incomplete index produces an explicit error without zero holdings', async () => {
  const result = await request({ url: '/fund?fund=' + id(5) + '&owner=' + owner(6) }, { readFund: async () => { throw Error('INDEX_INCOMPLETE'); } });
  assert.equal(result.status, 409);
  assert.match(result.body.message, /incomplete/);
  assert.equal(result.body.canSubmit, false);
  assert.equal('product' in result.body, false);
  assert.equal('balance' in result.body, false);
});
