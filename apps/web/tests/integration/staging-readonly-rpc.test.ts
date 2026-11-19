import { Account, Contract, Networks, TransactionBuilder, xdr } from '@stellar/stellar-sdk';
import { NextRequest } from 'next/server';
import { afterEach, describe, expect, it, vi } from 'vitest';

const source = 'GBHIT7TXZSRWT4QZXKINECMQWKC7NC7GBJAGK6XFOURI3T6ZHJDTHCMD';
const fund = new Contract('CCP7X4UYFSUNXWRUH7W25RQMEQEHXFIYHNHVGAYAGGOOHPMPJKZGOGPW');

function rpcRequest(method: string, params?: Record<string, unknown>) {
  return { jsonrpc: '2.0', id: 1, method, params };
}

function request(path: string, body: unknown) {
  return new NextRequest('https://preview.test' + path, {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body),
  });
}

function invocation(method: string) {
  return new TransactionBuilder(new Account(source, '0'), { fee: '100', networkPassphrase: Networks.PUBLIC })
    .addOperation(fund.call(method)).setTimeout(0).build();
}

function enableStaging() {
  vi.stubEnv('VERCEL_ENV', 'preview');
  vi.stubEnv('ARKA_HOSTED_STAGING_CATALOG', '1');
  vi.stubEnv('ARKA_STAGING_READ_ONLY_RPC', '1');
  vi.stubEnv('NEXT_PUBLIC_UX_REVIEW_PREVIEW', '1');
}

describe('staging read-only RPC', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.resetModules();
  });

  it('forwards reads and unsigned contract simulations to the pinned public RPC without forwarding headers', async () => {
    enableStaging();
    const upstream = vi.fn(async () => Response.json({ jsonrpc: '2.0', id: 1, result: {} }));
    vi.stubGlobal('fetch', upstream);
    const { POST } = await import('@/app/api/soroban/rpc/route');
    const body = rpcRequest('simulateTransaction', { transaction: invocation('credit_protocols').toXDR() });
    expect((await POST(request('/api/soroban/rpc', body))).status).toBe(200);
    expect((await POST(request('/api/soroban/rpc', rpcRequest('getHealth')))).status).toBe(200);
    expect(upstream).toHaveBeenCalledWith('https://rpc.lightsail.network/', expect.objectContaining({
      method: 'POST', redirect: 'error', headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    }));
  });

  it('blocks submission, mixed batches and signed or state-changing simulations before transport', async () => {
    enableStaging();
    const upstream = vi.fn();
    vi.stubGlobal('fetch', upstream);
    const { POST } = await import('@/app/api/soroban/rpc/route');
    const envelope = invocation('credit_protocols').toEnvelope();
    envelope.v1().signatures([new xdr.DecoratedSignature({ hint: Buffer.alloc(4), signature: Buffer.alloc(64) })]);
    for (const body of [
      rpcRequest('sendTransaction'),
      [rpcRequest('getHealth'), rpcRequest('sendTransaction')],
      rpcRequest('simulateTransaction', { transaction: envelope.toXDR('base64') }),
      rpcRequest('simulateTransaction', { transaction: invocation('withdraw').toXDR() }),
      rpcRequest('simulateTransaction', { transaction: invocation('nav').toXDR(), resourceConfig: {} }),
    ]) {
      expect((await POST(request('/api/soroban/rpc', body))).status).toBe(403);
    }
    expect(upstream).not.toHaveBeenCalled();
  });

  it('blocks the route in production and keeps the hosted preview POST allowlist narrow', async () => {
    enableStaging();
    const { middleware } = await import('@/middleware');
    expect((await middleware(request('/api/soroban/rpc', rpcRequest('getHealth')))).headers.get('x-middleware-next')).toBe('1');
    expect((await middleware(request('/api/routing/rebalance/plan', {}))).headers.get('x-middleware-next')).toBe('1');
    expect((await middleware(request('/api/preview-staging-refresh', {}))).headers.get('x-middleware-next')).toBe('1');
    for (const path of ['/api/intents/balanced/quote', '/api/operator/access', '/api/catalog/v1/arkas/ID/profile']) {
      expect((await middleware(request(path, {}))).status).toBe(403);
    }
    expect((await middleware(request('/api/routing/rebalance/plan', { intentTxHash: 'sample' }))).status).toBe(403);
    vi.stubEnv('VERCEL_ENV', 'production');
    const { POST } = await import('@/app/api/soroban/rpc/route');
    expect((await POST(request('/api/soroban/rpc', rpcRequest('getHealth')))).status).toBe(403);
  });
});
