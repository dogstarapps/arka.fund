import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { Worker } from 'node:worker_threads';
import { once } from 'node:events';

const root = fileURLToPath(new URL('../../', import.meta.url));
// The caller owns authorization. A test must never opt itself into signing.
const optedIn = process.env.ARKA_EPHEMERAL_SIGNATURE_TESTS === '1';
const signingTest = optedIn ? test : test.skip;
const area = process.env.ARKA_GUARD_EVIDENCE_DIR ?? path.join(root, 'artifacts', 'crypto-policy-' + Date.now());
const variants = [
  ['web-cjs', 'apps/web', false], ['catalog-cjs', 'services/catalog-api', false],
  ['sdk-cjs', 'sdk/typescript', false], ['sdk-esm', 'sdk/typescript', true],
];
for (const [name, folder, esm] of variants) {
  for (const mode of ['fresh-key', 'imported-key', 'default-deny']) {
    (mode === 'fresh-key' ? signingTest : test)(name + ': ' + mode, () => {
      const directory = path.join(area, name, mode);
      fs.mkdirSync(directory, { recursive: true });
      const load = esm
        ? "await import(pathToFileURL(require.resolve('@stellar/stellar-sdk').replace('/cjs/', '/esm/')))"
        : "require('@stellar/stellar-sdk')";
      const code = "import assert from 'node:assert/strict';import{createRequire}from'node:module';import{pathToFileURL}from'node:url';const require=createRequire(" + JSON.stringify(path.join(root, folder, 'package.json')) + ");const sdk=" + load + ";const key=" + (mode === 'imported-key' ? 'sdk.Keypair.fromRawEd25519Seed(Buffer.alloc(32, 23))' : 'sdk.Keypair.random()') + ";const data=Buffer.from('Ephemeral regression only');const signature=key.sign(data);assert(key.verify(data,signature));if(" + JSON.stringify(mode) + "==='fresh-key'){const tx=new sdk.TransactionBuilder(new sdk.Account(key.publicKey(),'0'),{fee:'100',networkPassphrase:sdk.Networks.TESTNET}).addOperation(sdk.Operation.bumpSequence({bumpTo:'2'})).setTimeout(30).build();tx.sign(key);assert(key.verify(tx.hash(),tx.signatures[0].signature()));}";
      const env = Object.fromEntries(['HOME', 'PATH', 'TMPDIR', 'LANG'].filter(k => process.env[k]).map(k => [k, process.env[k]]));
      Object.assign(env, { ARKA_RELEASE_NETWORK: 'none', ARKA_CRYPTO_EVIDENCE_DIR: directory });
      if (optedIn && mode !== 'default-deny') env.ARKA_EPHEMERAL_SIGNATURE_TESTS = '1';
      let command = process.execPath;
      let args = ['--import', root + 'release/containment.mjs', '--input-type=module', '-e', code];
      if (process.platform === 'darwin') { args = ['-p', '(version 1) (allow default) (deny network*)', command, ...args]; command = '/usr/bin/sandbox-exec'; }
      const result = spawnSync(command, args, { cwd: root, env, encoding: 'utf8', timeout: 10000 });
      fs.writeFileSync(path.join(directory, 'process.json'), JSON.stringify({ status: result.status, stderr: result.stderr, stdout: result.stdout }, null, 2), { flag: 'wx' });
      if (mode === 'fresh-key') {
        assert.equal(result.status, 0, result.stderr);
        const files = fs.readdirSync(directory).filter(f => f.startsWith('crypto-') && f.endsWith('.json'));
        assert.equal(files.length, 1);
        const counters = JSON.parse(fs.readFileSync(path.join(directory, files[0])));
        assert.equal(counters.signaturesCreated, 2);
        assert.equal(counters.denied, 0);
        const events = fs.readdirSync(directory).filter(f => f.endsWith('.jsonl')).flatMap(f => fs.readFileSync(path.join(directory, f), 'utf8').trim().split('\n').map(line => JSON.parse(line)));
        assert.equal(events.filter(e => e.type === 'signature').length, 2);
      } else {
        assert.equal(result.status, 1, result.stderr);
        assert.match(result.stderr, optedIn && mode === 'imported-key' ? /NON_EPHEMERAL_TEST_SIGNER_DENIED/ : /CRYPTOGRAPHIC_SIGNING_DENIED/);
      }
    });
  }
}

signingTest('terminated workers retain signature evidence without relying on exit handlers', async () => {
  const directory = path.join(area, 'terminated-worker');
  fs.mkdirSync(directory, { recursive: true });
  const env = Object.fromEntries(['HOME', 'PATH', 'TMPDIR', 'LANG'].filter(k => process.env[k]).map(k => [k, process.env[k]]));
  Object.assign(env, { ARKA_EPHEMERAL_SIGNATURE_TESTS: '1', ARKA_RELEASE_NETWORK: 'none', ARKA_CRYPTO_EVIDENCE_DIR: directory });
  const code = "(async()=>{await import(" + JSON.stringify(new URL('../containment.mjs', import.meta.url).href) + ");const{parentPort}=require('node:worker_threads');const{createRequire}=require('node:module');const sdk=createRequire(" + JSON.stringify(path.join(root, 'sdk/typescript/package.json')) + ")('@stellar/stellar-sdk');sdk.Keypair.random().sign(Buffer.from('Synthetic worker test'));parentPort.postMessage('signed');setInterval(()=>{},1000);})().catch(error=>{throw error;});";
  const worker = new Worker(code, { eval: true, env, execArgv: ['--import', root + 'release/containment.mjs'] });
  try { await once(worker, 'message'); } finally { await worker.terminate(); }
  const events = fs.readdirSync(directory).filter(f => f.endsWith('.jsonl')).flatMap(f => fs.readFileSync(path.join(directory, f), 'utf8').trim().split('\n').map(line => JSON.parse(line)));
  assert.equal(events.filter(e => e.type === 'signature').length, 1);
  assert.equal(events.filter(e => e.type === 'denied').length, 0);
});
