import test from 'node:test';
import assert from 'node:assert/strict';
import {minimatchBoundary, assertProductionBoundary, assertGuestBoundary} from '../dependency-scope.mjs';

const lock = (node, location = 'node_modules/minimatch') => ({lockfileVersion: 3, packages: {[location]: node}});
test('known affected development instances remain visible without being declared fixed', () => {
  const report = assertProductionBoundary(lock({version: '10.2.6', dev: true}));
  assert.equal(report.development.length, 1); assert.equal(report.production.length, 0);
});
test('promoting the same dependency into production fails the exposure guard', () => {
  assert.throws(() => assertProductionBoundary(lock({version: '10.2.6', dev: false})), /AFFECTED_MINIMATCH_IN_PRODUCTION/);
});
test('missing or ambiguous scope is treated as production', () => {
  for (const node of [{version: '10.2.6'}, {version: '10.2.6', devOptional: true}]) {
    assert.throws(() => assertProductionBoundary(lock(node)), /AFFECTED_MINIMATCH_IN_PRODUCTION/);
  }
});
test('nested and aliased instances cannot bypass the production boundary', () => {
  for (const [location, node] of [['node_modules/tool/node_modules/minimatch', {version:'3.1.5'}], ['node_modules/alias', {name:'minimatch', version:'10.2.6'}]]) {
    assert.throws(() => assertProductionBoundary(lock(node, location)), /AFFECTED_MINIMATCH_IN_PRODUCTION/);
  }
});
test('the patched boundary permits fixed versions without forbidding the package itself', () => {
  for (const version of ['11.0.1', '11.0.3', '11.1.0', '12.0.0']) assert.deepEqual(minimatchBoundary(lock({version})), {production:[], development:[]});
  assert.throws(() => assertProductionBoundary(lock({version:'11.0.0'})), /AFFECTED_MINIMATCH_IN_PRODUCTION/);
});
test('unknown version strings and prereleases require review rather than an assumed fix', () => {
  for (const version of ['11.0.1-beta.1', 'not-a-version', undefined]) assert.throws(() => assertProductionBoundary(lock({version})), /AFFECTED_MINIMATCH_IN_PRODUCTION/);
});
test('promoting affected bigint into a guest graph fails even while native tooling is allowed', () => {
  for (const version of ['0.5.5','0.6.1','0.7.5','0.7.6-rc.1']) assert.throws(() => assertGuestBoundary('soroban-sdk v23.0.1\ncrypto-bigint v'+version), /AFFECTED_CRYPTO_BIGINT_IN_GUEST/);
  for (const version of ['0.7.6','0.7.10','0.8.0','1.0.0']) assert.deepEqual(assertGuestBoundary('soroban-sdk v23.0.1\ncrypto-bigint v'+version), {cryptoBigintVersions:[version]});
});
test('an empty or incomplete graph is never interpreted as a clean guest', () => {
  assert.throws(() => assertGuestBoundary(''), /GUEST_GRAPH_UNAVAILABLE/);
  assert.deepEqual(assertGuestBoundary('arka v0.1.0\nsoroban-sdk v23.0.1'), {cryptoBigintVersions:[]});
});
