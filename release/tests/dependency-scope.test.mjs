import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {fileURLToPath} from 'node:url';
import {checkRustSecReport} from '../rustsec-gate.mjs';
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

const root = fileURLToPath(new URL('../../', import.meta.url));
const acceptance = JSON.parse(fs.readFileSync(new URL('../rustsec-risk-acceptance.json', import.meta.url), 'utf8'));
const approvedFinding = {
  advisory: {id: 'RUSTSEC-2026-0387'},
  package: {
    name: 'crypto-bigint',
    version: '0.5.5',
    source: 'registry+https://github.com/rust-lang/crates.io-index',
    checksum: '0dc92fb57ca44df6db8059111ab3af99a63d5d0f8375d9972e319a379c6bab76',
  },
};

function rustSecInput(list = [approvedFinding]) {
  return {
    root,
    lock: 'contracts/Cargo.lock',
    auditExit: list.length === 0 ? 0 : 1,
    report: {
      database: {'advisory-count': 1430},
      settings: {ignore: [], target_arch: [], target_os: [], severity: null},
      vulnerabilities: {found: list.length > 0, count: list.length, list},
    },
    acceptance: structuredClone(acceptance),
  };
}

test('accepts the sole matching RustSec finding on each reviewed lock', () => {
  for (const lock of ['contracts/Cargo.lock', 'release/quote-adapter/Cargo.lock']) {
    assert.equal(checkRustSecReport({...rustSecInput(), lock}), 'RUSTSEC-2026-0387');
  }
  assert.equal(checkRustSecReport(rustSecInput([])), null);
});

test('keeps any additional RustSec vulnerability or package version blocking', () => {
  const unknown = {...approvedFinding, advisory: {id: 'RUSTSEC-2026-9999'}};
  const changed = {...approvedFinding, package: {...approvedFinding.package, version: '0.5.4'}};
  for (const findings of [[approvedFinding, unknown], [unknown], [changed]]) {
    assert.throws(() => checkRustSecReport(rustSecInput(findings)), /RUSTSEC_UNACCEPTED_FINDING/);
  }
});

test('refuses the acceptance on a different lock or reviewed source digest', () => {
  assert.throws(() => checkRustSecReport({...rustSecInput(), lock: 'another/Cargo.lock'}),
    /RUSTSEC_LOCK_OUTSIDE_ACCEPTANCE/);
  const input = rustSecInput();
  input.acceptance.locks[input.lock] = '0'.repeat(64);
  assert.throws(() => checkRustSecReport(input), /RUSTSEC_LOCK_CHANGED/);
  input.acceptance.locks[input.lock] = acceptance.locks[input.lock];
  input.acceptance.reviewedSourcesSha256 = '0'.repeat(64);
  assert.throws(() => checkRustSecReport(input), /RUSTSEC_REVIEWED_SOURCES_CHANGED/);
});

test('rejects broken, incomplete or filtered RustSec audit reports', () => {
  assert.throws(() => checkRustSecReport({...rustSecInput([]), auditExit: 1}), /RUSTSEC_UNEXPECTED_AUDIT_EXIT/);
  assert.throws(() => checkRustSecReport({...rustSecInput(), auditExit: 2}), /RUSTSEC_UNEXPECTED_AUDIT_EXIT/);
  const input = rustSecInput();
  input.report.vulnerabilities.count = 2;
  assert.throws(() => checkRustSecReport(input), /RUSTSEC_INCONSISTENT_REPORT/);
  input.report.settings.ignore = ['RUSTSEC-2026-9999'];
  assert.throws(() => checkRustSecReport(input), /RUSTSEC_AUDIT_USED_IGNORES/);
});
