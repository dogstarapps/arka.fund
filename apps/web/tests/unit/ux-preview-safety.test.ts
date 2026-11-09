import { afterEach, describe, expect, it, vi } from 'vitest';
import { isReadOnlyRpcPayload } from '@/lib/previewSafety';
describe('UX preview safety', () => {
  afterEach(()=>{vi.unstubAllEnvs();vi.resetModules();});
  it('allows reads and unsigned simulations but rejects sends and mixed batches',()=>{
    expect(isReadOnlyRpcPayload({method:'simulateTransaction'})).toBe(true);
    expect(isReadOnlyRpcPayload([{method:'getNetwork'},{method:'getLedgerEntries'}])).toBe(true);
    expect(isReadOnlyRpcPayload({method:'sendTransaction'})).toBe(false);
    expect(isReadOnlyRpcPayload([{method:'getNetwork'},{method:'sendTransaction'}])).toBe(false);
    expect(isReadOnlyRpcPayload([])).toBe(false);
    expect(isReadOnlyRpcPayload(null)).toBe(false);
  });
  it('blocks signatures in review builds and leaves the ordinary build unchanged',async()=>{
    vi.stubEnv('NEXT_PUBLIC_UX_REVIEW_PREVIEW','1');
    const preview=await import('@/lib/previewSafety');
    expect(()=>preview.assertFinancialActionsEnabled()).toThrow('Read-only UX preview');
    vi.resetModules();vi.stubEnv('NEXT_PUBLIC_UX_REVIEW_PREVIEW','0');
    const normal=await import('@/lib/previewSafety');
    expect(()=>normal.assertFinancialActionsEnabled()).not.toThrow();
  });
});
