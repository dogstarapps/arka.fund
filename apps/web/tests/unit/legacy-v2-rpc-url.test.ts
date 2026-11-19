// @vitest-environment node

import { Networks } from '@stellar/stellar-sdk';
import { afterEach, describe, expect, it, vi } from 'vitest';

const app = 'https://arka.fund';
const rpc = 'https://rpc.lightsail.network/';

async function browserRpc({
  origin = app, preview = '0', readOnly = '0', enabled = '1', network = Networks.PUBLIC,
  rpcUrl = rpc, canonical = app,
} = {}) {
  vi.stubGlobal('window', { location: { origin, href: origin + '/' } });
  vi.stubEnv('NEXT_PUBLIC_ARKA_V2_DIRECT_RPC', enabled);
  vi.stubEnv('NEXT_PUBLIC_UX_REVIEW_PREVIEW', preview);
  vi.stubEnv('NEXT_PUBLIC_MAINNET_GENERAL_READONLY', readOnly);
  vi.stubEnv('NEXT_PUBLIC_APP_URL', canonical);
  vi.stubEnv('NEXT_PUBLIC_STELLAR_NETWORK', network);
  vi.stubEnv('NEXT_PUBLIC_SOROBAN_RPC_URL', rpcUrl);
  const { resolveRpcUrl } = await import('@/lib/soroban');
  return resolveRpcUrl();
}

describe('V2 browser RPC', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.resetModules();
  });

  it('reuses the configured public endpoint on the canonical mainnet origin', async () => {
    expect(await browserRpc()).toBe(rpc);
  });

  it.each([
    { preview: '1' },
    { readOnly: '1' },
    { enabled: '0' },
    { network: Networks.TESTNET },
    { origin: 'https://candidate.vercel.app' },
    { canonical: '' },
    { rpcUrl: 'http://rpc.lightsail.network/' },
    { rpcUrl: 'https://username:password@rpc.lightsail.network/' },
    { rpcUrl: 'https://rpc.lightsail.network/?token=example' },
  ])('keeps the browser on its same-origin guard with %o', async options => {
    expect(await browserRpc(options)).toBe((options.origin ?? app) + '/api/soroban/rpc');
  });
});
