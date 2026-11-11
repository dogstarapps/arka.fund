import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { inventory, releaseId, sha } from './source-inventory.mjs';

const acceptancePath = 'release/rustsec-risk-acceptance.json';

export function reviewedSourcesSha256(root) {
  // The approval records the digest of the payload it covers.
  return releaseId(inventory(root).filter(file => file.path !== acceptancePath));
}

export function checkRustSecReport({ root, lock, auditExit, report, acceptance }) {
  const { settings, vulnerabilities } = report;
  assert(Number.isInteger(report.database?.['advisory-count']) &&
    report.database['advisory-count'] > 0, 'RUSTSEC_DATABASE_UNAVAILABLE');
  assert.deepEqual(settings?.ignore, [], 'RUSTSEC_AUDIT_USED_IGNORES');
  assert.deepEqual(settings.target_arch, [], 'RUSTSEC_AUDIT_FILTERED_ARCHITECTURE');
  assert.deepEqual(settings.target_os, [], 'RUSTSEC_AUDIT_FILTERED_OS');
  assert.equal(settings.severity, null, 'RUSTSEC_AUDIT_FILTERED_SEVERITY');

  const findings = vulnerabilities?.list;
  assert(Array.isArray(findings) && vulnerabilities.count === findings.length &&
    vulnerabilities.found === (findings.length > 0), 'RUSTSEC_INCONSISTENT_REPORT');
  assert.equal(auditExit, findings.length > 0 ? 1 : 0, 'RUSTSEC_UNEXPECTED_AUDIT_EXIT');
  if (findings.length === 0) return null;

  const [finding] = findings;
  assert(findings.length === 1 &&
    finding.advisory?.id === acceptance.advisory &&
    finding.package?.name === acceptance.package &&
    finding.package.version === acceptance.version &&
    finding.package.source === acceptance.source &&
    finding.package.checksum === acceptance.packageSha256, 'RUSTSEC_UNACCEPTED_FINDING');
  assert(Object.hasOwn(acceptance.locks, lock), 'RUSTSEC_LOCK_OUTSIDE_ACCEPTANCE');
  assert.equal(sha(path.join(root, lock)), acceptance.locks[lock], 'RUSTSEC_LOCK_CHANGED');
  assert.equal(reviewedSourcesSha256(root), acceptance.reviewedSourcesSha256, 'RUSTSEC_REVIEWED_SOURCES_CHANGED');
  return finding.advisory.id;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [lock, reportFile, exitCode] = process.argv.slice(2);
  const root = fileURLToPath(new URL('../', import.meta.url));
  const acceptance = JSON.parse(fs.readFileSync(path.join(root, acceptancePath), 'utf8'));
  const report = JSON.parse(fs.readFileSync(reportFile, 'utf8'));
  const accepted = checkRustSecReport({ root, lock, auditExit: Number(exitCode), report, acceptance });
  if (accepted) {
    console.log(`::warning title=${accepted} accepted for this release::${acceptance.package} ${acceptance.version} in ${lock}. Raw RustSec report retained. See ${acceptancePath}.`);
  } else {
    console.log(`RustSec found zero vulnerabilities in ${lock}.`);
  }
}
