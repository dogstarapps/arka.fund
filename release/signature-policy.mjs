import assert from 'node:assert/strict';

if (process.env.ARKA_EPHEMERAL_SIGNATURE_TESTS === '1') {
  assert(['none', 'loopback'].includes(process.env.ARKA_RELEASE_NETWORK), 'CONTAINED_TEST_NETWORK_REQUIRED');
  assert(process.env.ARKA_CRYPTO_EVIDENCE_DIR, 'CRYPTO_EVIDENCE_REQUIRED');
  await import('./ephemeral-signatures.mjs');
} else {
  await import('./no-sign.mjs');
}
