// Build-time flag for the review deployment. This is not an authorization check.
export const UX_REVIEW_PREVIEW = process.env.NEXT_PUBLIC_UX_REVIEW_PREVIEW === '1';
export const PREVIEW_READ_ONLY_MESSAGE = 'Read-only UX preview. Signing and sending transactions are disabled.';

export function assertFinancialActionsEnabled(): void {
  if (UX_REVIEW_PREVIEW) throw new Error(PREVIEW_READ_ONLY_MESSAGE);
}

const READ_RPC_METHODS = new Set([
  'getHealth', 'getNetwork', 'getLatestLedger', 'getLedgerEntries', 'getEvents',
  'getTransaction', 'getTransactions', 'getFeeStats', 'getVersionInfo', 'simulateTransaction',
]);

export function isReadOnlyRpcPayload(payload: unknown): boolean {
  if (Array.isArray(payload)) return payload.length > 0 && payload.every(isReadOnlyRpcPayload);
  return Boolean(payload && typeof payload === 'object' &&
    'method' in payload && typeof payload.method === 'string' && READ_RPC_METHODS.has(payload.method));
}
