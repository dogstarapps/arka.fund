import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { threadId } from 'node:worker_threads';
import { stellarTestModules } from './stellar-test-modules.mjs';

assert.equal(process.env.ARKA_EPHEMERAL_SIGNATURE_TESTS, '1');
assert(['none', 'loopback'].includes(process.env.ARKA_RELEASE_NETWORK));
const directory = process.env.ARKA_CRYPTO_EVIDENCE_DIR;
assert(directory);
fs.mkdirSync(directory, { recursive: true });
// Worker pools can terminate without a process exit event. Persist each event
// immediately; no payload, signature bytes or private key is written.
const eventFile = path.join(directory, 'crypto-events-' + process.pid + '-' + threadId + '.jsonl');
const record = event => fs.appendFileSync(eventFile, JSON.stringify(event) + '\n', { mode: 0o600 });
const freshKeys = new Set();
const patched = new Set();
const result = { profile: 'ephemeral-test-keys-only', signaturesCreated: 0, transactionSigningCalls: 0, denied: 0, sdkVariants: [], exportsPrivateKeys: false };
const deny = () => { result.denied++; record({ type: 'denied' }); throw Error('NON_EPHEMERAL_TEST_SIGNER_DENIED'); };
const check = key => { if (!key || !freshKeys.has(key.publicKey())) deny(); };

function install(sdk, {version, format}) {
  record({ type: 'sdk-policy-bound', version, format });
  if (patched.has(sdk.Keypair)) return;
  patched.add(sdk.Keypair);
  result.sdkVariants.push({ version, format });
  record({ type: 'sdk-policy-installed', version, format });
  const random = sdk.Keypair.random;
  sdk.Keypair.random = function (...args) {
    const key = Reflect.apply(random, this, args);
    freshKeys.add(key.publicKey());
    return key;
  };
  const sign = sdk.Keypair.prototype.sign;
  sdk.Keypair.prototype.sign = function (...args) {
    check(this);
    const signature = Reflect.apply(sign, this, args);
    result.signaturesCreated++;
    record({ type: 'signature', keyOrigin: 'runtime-random' });
    return signature;
  };
  for (const name of ['Transaction', 'FeeBumpTransaction']) {
    const sign = sdk[name]?.prototype?.sign;
    if (!sign) continue;
    sdk[name].prototype.sign = function (...keys) {
      keys.forEach(check);
      result.transactionSigningCalls++;
      return Reflect.apply(sign, this, keys);
    };
  }
}

for (const variant of await stellarTestModules()) install(variant.sdk, variant);
process[Symbol.for('arkafund.test.signaturePolicy')] = install;

process.once('exit', () => {
  fs.writeFileSync(path.join(directory, 'crypto-' + process.pid + '-' + threadId + '.json'), JSON.stringify(result, null, 2) + '\n', { flag: 'wx' });
  if (result.denied) process.exitCode = 1;
});
