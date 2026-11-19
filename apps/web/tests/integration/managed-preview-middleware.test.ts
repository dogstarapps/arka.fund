// @vitest-environment node
import { afterEach,describe,it,expect,vi } from 'vitest';
import { NextRequest } from 'next/server';
afterEach(()=>{vi.unstubAllEnvs();vi.resetModules();});
describe('Simulator exception never enables blockchain writes',()=>{
  it('permits only the exact local wallet endpoint with all integration gates',async()=>{
    vi.stubEnv('NEXT_PUBLIC_UX_REVIEW_PREVIEW','1');vi.stubEnv('ARKA_MANAGED_PREVIEW','1');vi.stubEnv('ARKA_MANAGED_INTEGRATION','1');
    const {middleware}=await import('@/middleware');
    const mk=(path:string,origin='http://127.0.0.1:3138')=>new NextRequest(`http://127.0.0.1:3138${path}`,{method:'POST',headers:{host:'127.0.0.1:3138',origin,'x-arka-local-preview':'1'}});
    expect((await middleware(mk('/api/managed-withdrawals-preview/wallet'))).headers.get('x-middleware-next')).toBe('1');
    expect((await middleware(mk('/api/managed-withdrawals-preview/wallet/other'))).status).toBe(403);
    expect((await middleware(mk('/api/managed-withdrawals-preview/wallet','https://evil.example'))).status).toBe(403);
    vi.stubEnv('ARKA_MANAGED_INTEGRATION','0');expect((await middleware(mk('/api/managed-withdrawals-preview/wallet'))).status).toBe(403);
  });
  it('allows only the fixed same-origin loopback simulation endpoint',async()=>{
    vi.stubEnv('NEXT_PUBLIC_UX_REVIEW_PREVIEW','1');vi.stubEnv('ARKA_MANAGED_PREVIEW','1');
    const {middleware}=await import('@/middleware');
    const mk=(path:string,host='127.0.0.1:3138',origin='http://127.0.0.1:3138')=>new NextRequest(`http://127.0.0.1:3138${path}`,{method:'POST',headers:{host,origin,'x-arka-local-preview':'1','content-type':'application/json'},body:JSON.stringify({action:'reset'})});
    expect((await middleware(mk('/api/managed-withdrawals-preview'))).headers.get('x-middleware-next')).toBe('1');
    expect((await middleware(mk('/api/managed-withdrawals-preview','app.arka.fund'))).status).toBe(403);
    expect((await middleware(mk('/api/managed-withdrawals-preview','127.0.0.1:3138','https://evil.test'))).status).toBe(403);
    for(const path of ['/api/soroban/rpc','/api/factory/create/build','/api/intents/balanced/build','/api/managed-withdrawals-preview/other'])expect((await middleware(mk(path))).status).toBe(403);
    vi.stubEnv('ARKA_MANAGED_PREVIEW','0');expect((await middleware(mk('/api/managed-withdrawals-preview'))).status).toBe(403);
  });
});
