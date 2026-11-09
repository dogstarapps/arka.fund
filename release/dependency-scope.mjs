import fs from 'node:fs';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';

// Exposure guard for GHSA-g3hv-75wg-m249, not a replacement for npm audit.
export function minimatchBoundary(lock) {
  assert.equal(lock.lockfileVersion, 3, 'EXACT_NPM_LOCK_REQUIRED');
  const affected = [];
  for (const [location, node] of Object.entries(lock.packages)) {
    if (!location.endsWith('node_modules/minimatch') && node.name !== 'minimatch') continue;
    const v = /^(\d+)\.(\d+)\.(\d+)(?:\+[^\s]+)?$/.exec(node.version ?? '');
    const patched = v && (+v[1] > 11 || +v[1] === 11 && (+v[2] > 0 || +v[3] >= 1));
    if (!patched) affected.push({location, version: node.version ?? null, developmentOnly: node.dev === true});
  }
  return {production: affected.filter(n => !n.developmentOnly), development: affected.filter(n => n.developmentOnly)};
}

export function assertProductionBoundary(lock) {
  const result = minimatchBoundary(lock);
  assert.equal(result.production.length, 0, 'AFFECTED_MINIMATCH_IN_PRODUCTION');
  return result;
}

export function inspectRelease(root) {
  return ['apps/web', 'services/catalog-api', 'sdk/typescript'].map(directory => ({
    directory, ...assertProductionBoundary(JSON.parse(fs.readFileSync(root + '/' + directory + '/package-lock.json'))),
  }));
}

export function assertGuestBoundary(tree) {
  assert(tree.includes('soroban-sdk v'), 'GUEST_GRAPH_UNAVAILABLE');
  const versions = [...tree.matchAll(/\bcrypto-bigint v([^\s)]+)/g)].map(m => m[1]);
  for (const version of versions) {
    const v = /^(\d+)\.(\d+)\.(\d+)$/.exec(version);
    assert(v && (+v[1] > 0 || +v[2] > 7 || +v[2] === 7 && +v[3] >= 6), 'AFFECTED_CRYPTO_BIGINT_IN_GUEST');
  }
  return {cryptoBigintVersions: versions};
}

export function inspectGuestGraphs(root) {
  return ['contracts', 'release/quote-adapter'].map(directory => {
    const args = ['tree', '--manifest-path', root+'/'+directory+'/Cargo.toml', '--offline', '--locked',
      '-e', 'normal,build', '--target', 'wasm32v1-none', ...(directory === 'contracts' ? ['--workspace'] : [])];
    const result = spawnSync('cargo', args, {encoding:'utf8', timeout:30000});
    assert.equal(result.status, 0, 'GUEST_GRAPH_FAILED '+directory);
    return {directory, target:'wasm32v1-none', edges:'normal,build', ...assertGuestBoundary(result.stdout)};
  });
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const root = fileURLToPath(new URL('../', import.meta.url));
  const results = process.argv.includes('--rust') ? inspectGuestGraphs(root) : inspectRelease(root);
  console.log(JSON.stringify({exposureBoundaryPassed: true, fullAdvisoryAuditPerformed: false, results}));
}
