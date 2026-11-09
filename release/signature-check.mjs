import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';

const root = fileURLToPath(new URL('../', import.meta.url));
const evidence = process.env.ARKA_RELEASE_EVIDENCE_DIR ?? path.join(root, 'artifacts', 'signature-check-' + Date.now());
fs.mkdirSync(evidence, { recursive: true });
const env = Object.fromEntries(['HOME','PATH','TMPDIR','LANG'].filter(k=>process.env[k]).map(k=>[k,process.env[k]]));
env.ARKA_RELEASE_EVIDENCE_DIR = evidence;
const sha = file => createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const verifyExisting = process.argv.includes('--verify-existing');
const unsigned = process.argv.includes('--unsigned');
const positiveGuardRequested = !verifyExisting || process.argv.includes('--ephemeral-signatures');
assert(!unsigned || (verifyExisting && !positiveGuardRequested), 'UNSIGNED_RECEIPT_VERIFICATION_ONLY');
for (const job of ['catalog-build', 'sdk-build', 'catalog-unit', 'catalog-integration', 'sdk-unit', 'web-test']) {
  const signing = !unsigned && !job.endsWith('-build');
  if (!verifyExisting) {
    const result = spawnSync(process.execPath, ['release/run-local.mjs', job, ...(signing ? ['--ephemeral-signatures'] : [])], { cwd: root, env, stdio: 'inherit' });
    assert.equal(result.status, 0, 'SIGNATURE_SUITE_FAILED ' + job);
  }
  const record = JSON.parse(fs.readFileSync(path.join(evidence, job + '-run.json')));
  assert.equal(record.status, 0);
  assert.equal(record.log.sha256, sha(record.log.file), 'SIGNATURE_LOG_CHANGED');
  for (const [name, directory] of [['web','apps/web'],['catalog','services/catalog-api'],['sdk','sdk/typescript']]) assert.equal(record.locks[name], sha(path.join(root,directory,'package-lock.json')), 'SIGNATURE_DEPENDENCIES_CHANGED');
  assert.equal(record.transactionsSubmitted, 0);assert.equal(record.productionTouched, false);
  assert.equal(record.signatureProfile, signing ? 'ephemeral-test-keys-only' : 'signing-disabled', 'SIGNATURE_PROFILE_CHANGED ' + job);
  if (signing) assert(record.signaturesCreated > 0, 'SIGNATURE_COUNTER_MISSING ' + job);
  else assert.equal(record.signaturesCreated, 0, 'UNEXPECTED_SIGNATURES ' + job);
}
const web = JSON.parse(fs.readFileSync(path.join(evidence, 'web-tests.json')));
assert.equal(web.success, true);
assert.equal(web.numFailedTests, 0);
const diagnostic = JSON.parse(fs.readFileSync(path.join(evidence, 'web-unhandled.json')));
assert.deepEqual(diagnostic.unhandledErrors, []);assert.deepEqual(diagnostic.lateUnhandledErrors, []);
if (unsigned) {
  const result = {
    unsignedReceiptsVerified: 6,
    signaturesCreated: 0,
    cryptographicCasesExecuted: false,
    transactionsSubmitted: 0,
    productionAccess: false,
    noahVersion: 2,
    mainnetApproved: false,
  };
  fs.writeFileSync(path.join(evidence, 'unsigned-acceptance.json'), JSON.stringify(result, null, 2) + '\n', {flag:'wx'});
  console.log(JSON.stringify(result));
  process.exit(0);
}
// Frozen financial VM rehearsals are a separate opt-in qualification, not signing cases.
const vmSkips = new Map([
  ['apps/web/tests/integration/withdrawal-vm-flow.test.tsx', 'requests, resumes an ambiguous lot, replans five real Sushi lots, settles and collects without signing/broadcasting'],
  ['apps/web/tests/integration/mainnet-execution-vm.test.tsx', 'executes the mainnet UI flow against local backend and five real Sushi RAM lots with no real signature or transaction submission'],
]);
const skipped = web.testResults.flatMap(file => file.assertionResults.filter(test => ['pending','skipped'].includes(test.status)).map(test => ({file: path.relative(root, file.name), name: test.fullName})));
assert.equal(skipped.length, 2);
for (const item of skipped) assert.equal(vmSkips.get(item.file), item.name, 'UNEXPECTED_SKIPPED_TEST');
assert.equal(web.numPendingTests, skipped.length);
const inventory = JSON.parse(fs.readFileSync(path.join(root, 'release/cryptographic-cases.json')));
assert.equal(inventory.cases.length, inventory.totalCases);
assert.equal(inventory.baselineCases, 18);
assert.equal(inventory.newMainnetExecutionCases, 40);
const results = new Map(web.testResults.flatMap(f => f.assertionResults.map(t => [t.fullName, t.status])));
for (const item of inventory.cases.filter(c => c.file.startsWith('apps/web/'))) assert.equal(results.get(item.name), 'passed', item.name);
for (const job of ['catalog-unit', 'catalog-integration', 'sdk-unit']) {
  const log = fs.readFileSync(path.join(evidence, job + '.log'), 'utf8');
  assert(log.includes('# skipped 0\n') && log.includes('# fail 0\n'), 'NON_ZERO_PENDING_CASES ' + job);
}
const guardLog = path.join(evidence, 'guard-tests-final.log');
if (positiveGuardRequested) {
  const guard = spawnSync(process.execPath, ['--test', 'release/tests/ephemeral-signatures.test.mjs'], {
    cwd: root,
    env: { ...env, ARKA_EPHEMERAL_SIGNATURE_TESTS: '1', ARKA_GUARD_EVIDENCE_DIR: path.join(evidence, 'guard-tests-final') },
    encoding: 'utf8',
  });
  fs.writeFileSync(guardLog, guard.stdout + guard.stderr, {flag:'wx'});
  assert.equal(guard.status, 0, 'SIGNATURE_POLICY_TESTS_FAILED');
}
const guardEvidence = fs.readFileSync(guardLog, 'utf8');
assert.match(guardEvidence, /# pass 13\n/);
assert.match(guardEvidence, /# fail 0\n/);
fs.writeFileSync(path.join(evidence, 'signature-acceptance.json'), JSON.stringify({baselineCasesPassed:18,newMainnetExecutionCasesPassed:40,localCryptographicCasesPassed:inventory.totalCases,expectedSeparateVmSkips:skipped,realWalletCanaryValidated:false,transactionsSubmitted:0,productionAccess:false,noahVersion:2,mainnetApproved:false},null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({ localCryptographicCasesPassed: inventory.totalCases, realWalletCanaryValidated: false, transactionsSubmitted:0, productionAccess:false, noahVersion:2, mainnetApproved: false }));
