import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { sha } from './source-inventory.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const evidence = process.env.ARKA_RELEASE_EVIDENCE_DIR ?? path.join(root, 'artifacts', 'bindings-' + Date.now());
fs.mkdirSync(evidence, { recursive: true });
const env = Object.fromEntries(['HOME', 'PATH', 'TMPDIR'].filter(k => process.env[k]).map(k => [k, process.env[k]]));
const cli = process.env.STELLAR_CLI ?? 'stellar';
assert(spawnSync(cli, ['--version'], { env, encoding: 'utf8' }).stdout.startsWith('stellar 26.1.0 '));
const contracts = JSON.parse(fs.readFileSync(root + 'release/contract-selection.json')).contracts;
const results = [];
for (const role of ['arka', 'arka-factory', 'arka-registry', 'oracle-guard', 'router', 'venue-registry', 'adapter-sushi']) {
  const contract = contracts.find(c => c.role === role);
  assert.equal(sha(root + contract.file), contract.sha256);
  const output = path.join(evidence, role);
  assert(!fs.existsSync(output), 'USE_FRESH_BINDINGS_EVIDENCE_DIRECTORY');
  let command = cli;
  let args = ['contract', 'bindings', 'typescript', '--wasm', root + contract.file, '--output-dir', output];
  if (process.platform === 'darwin') {
    args = ['-p', '(version 1) (allow default) (deny network*)', cli, ...args];
    command = '/usr/bin/sandbox-exec';
  }
  const result = spawnSync(command, args, { cwd: root, env, encoding: 'utf8', timeout: 30000 });
  fs.writeFileSync(path.join(evidence, role + '.log'), result.stdout + result.stderr, { flag: 'wx' });
  assert.equal(result.status, 0, 'BINDING_GENERATION_FAILED ' + role);
  const generated = output + '/src/index.ts';
  for (const directory of ['sdk/typescript', 'services/catalog-api']) {
    const target = path.join(root, directory, 'src/generated', role + '.ts');
    if (!fs.existsSync(target) && role !== 'adapter-sushi') continue;
    if(process.argv.includes('--update')) fs.copyFileSync(generated,target);
    assert(fs.existsSync(target));
    assert.equal(sha(generated), sha(target), 'BINDING_DRIFT ' + directory + ' ' + role);
    results.push({ role, target: path.relative(root, target), sha256: sha(generated), wasmSha256: contract.sha256 });
  }
}
fs.writeFileSync(path.join(evidence, 'bindings.json'), JSON.stringify({ network: 'none', results }, null, 2) + '\n', { flag: 'wx' });
console.log(JSON.stringify({ generatedRoles: 7, matchedFiles: results.length }));
