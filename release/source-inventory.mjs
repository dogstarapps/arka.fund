import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';

export const sha = file => createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const ignored = new Set(['node_modules', '.next', 'target', 'dist', 'test_snapshots', 'artifacts', '__pycache__']);
const roots = ['contracts', 'apps/web', 'services/catalog-api', 'sdk/typescript', 'release', '.github/workflows/ci.yml', 'AGENTS.md', '.gitignore', 'package.json', 'docs/RELEASE_R4.md', 'docs/MAINNET_PENDING.md', 'docs/PROTOCOL_LIFECYCLE_R7.md', 'docs/SUSHI_FINANCIAL_R8.md', 'docs/LIQUIDATION_R9.md', 'docs/WITHDRAWAL_FLOW_R10.md', 'docs/WITHDRAWAL_BACKEND_R11.md', 'docs/MAINNET_EXECUTION_R12.md', 'docs/CRYPTOGRAPHIC_VALIDATION_R13.md', 'docs/INTERNAL_AUDIT_R14.md', 'docs/INTERNAL_AUDIT_R15.md', 'docs/DEPENDENCY_REVIEW_R16.md', 'docs/FACTORY_ROUTED_REHEARSAL_R17.md', 'docs/FACTORY_DAPP_BACKEND_R18.md', 'docs/COMPATIBLE_DEPENDENCIES_R19.md', 'docs/CATALOG_REVIEW_BRIDGE_R20.md', 'docs/COHERENT_RELEASE_R21.md', 'docs/GOVERNED_DEPLOYMENT_R27.md', 'docs/INTERNAL_AUDIT_R31.md', 'docs/OPTIONAL_GOVERNANCE_ROLES_R32.md', 'docs/QUEUE_PROGRESS_R34.md', 'docs/CATALOG_CONTINUITY_R35.md', 'docs/FINDINGS_R37.md', 'docs/WITHDRAWAL_UI_R39.md', 'docs/READ_COHERENCE_R41.md', 'docs/RECEIPT_ERRORS_R43.md', 'docs/CHECK_CONTEXT_R45.md', 'docs/MANAGER_QUOTE_R47.md', 'docs/ORACLE_NORMALIZATION_R56.md', 'scripts/check_public_repository_hygiene.py', 'scripts/internal_security_audit.py', 'scripts/tests/test_internal_security_audit.py'];

export function inventory(root) {
  const files = [];
  function walk(relative) {
    const file = path.join(root, relative);
    const stat = fs.lstatSync(file);
    if (stat.isSymbolicLink()) throw Error('RELEASE_SOURCE_SYMLINK ' + relative);
    if (stat.isDirectory()) {
      for (const name of fs.readdirSync(file).sort()) {
        if (ignored.has(name) || name.startsWith('.env') || name.endsWith('.tsbuildinfo')) continue;
        walk(relative + '/' + name);
      }
    } else if (relative !== 'release/source-manifest.json' && !relative.endsWith('.log')) {
      files.push({ path: relative, sha256: sha(file), bytes: stat.size });
    }
  }
  for (const relative of roots) walk(relative);
  return files.sort((a, b) => a.path.localeCompare(b.path, 'en'));
}

export const releaseId = files => createHash('sha256').update(JSON.stringify(files)).digest('hex');
