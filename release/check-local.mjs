import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const evidence = process.env.ARKA_RELEASE_EVIDENCE_DIR ?? path.join(root, 'artifacts', 'release-check-' + Date.now());
const signingRequested = process.argv.includes('--ephemeral-signatures');
fs.mkdirSync(evidence, { recursive: true });
const env = { ...process.env, ARKA_RELEASE_EVIDENCE_DIR: evidence, ARKA_RELEASE_NETWORK: 'none' };
const run = (args, options = {}) => {
  const result = spawnSync(process.execPath, args, { cwd: root, env, stdio: 'inherit', ...options });
  assert.equal(result.status, 0, 'LOCAL_RELEASE_CHECK_FAILED ' + args.join(' '));
};
run(['release/source-gate.mjs']);
run(['release/dependency-scope.mjs']);
for (const job of ['catalog-build', 'sdk-build', 'catalog-unit', 'catalog-integration', 'sdk-unit', 'web-build', 'web-test', 'web-types']) {
  run(['release/run-local.mjs', job, ...(signingRequested && ['web-test', 'catalog-unit', 'catalog-integration', 'sdk-unit'].includes(job) ? ['--ephemeral-signatures'] : [])]);
}
run(['--experimental-strip-types', '--import', root + 'release/containment.mjs', '--test', 'release/tests/source-gate.test.mjs', 'release/tests/artifact-bindings.test.mjs', 'release/tests/ci-configuration.test.mjs', 'release/tests/dependency-scope.test.mjs', 'release/tests/sdk-parser.test.mjs', 'release/tests/local-check-command.test.mjs', 'services/catalog-api/tests/review/canonical.test.mjs', 'services/catalog-api/tests/review/catalog.test.mjs', 'services/catalog-api/tests/review/runtime.test.mjs', 'services/catalog-api/tests/review/creation-fee.test.mjs', 'services/catalog-api/tests/review/withdrawal.test.mjs', 'services/catalog-api/tests/review/withdrawal-vm.test.mjs']);
run(['release/signature-check.mjs','--verify-existing',
  signingRequested ? '--ephemeral-signatures' : '--unsigned']);
run(['--import', root + 'release/containment.mjs', 'release/browser-check.mjs'], {
  env: { ...env, ARKA_RELEASE_NETWORK: 'loopback', ARKA_RELEASE_EVIDENCE_DIR: path.join(evidence, 'browser') },
});
console.log(JSON.stringify({ localChecksPassed: true, evidence, mainnetApproved: false }));
