import { afterEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
describe('read-only review deployment boundary',()=>{
  afterEach(()=>{vi.unstubAllEnvs();vi.resetModules();});
  async function check(path:string,body:unknown){
    vi.stubEnv('NEXT_PUBLIC_UX_REVIEW_PREVIEW','1');
    const {middleware}=await import('@/middleware');
    return middleware(new NextRequest(`http://localhost${path}`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)}));
  }
  it('rejects broadcasts, batches containing a broadcast and intent submissions',async()=>{
    expect((await check('/api/soroban/rpc',{method:'sendTransaction',params:{transaction:'NOT_A_REAL_TX'}})).status).toBe(403);
    expect((await check('/api/soroban/rpc',[{method:'getNetwork'},{method:'sendTransaction'}])).status).toBe(403);
    expect((await check('/api/intents/balanced/submit',{})).status).toBe(403);
    expect((await check('/api/catalog/v1/arkas/C/profile',{})).status).toBe(403);
  });
  it('allows estimates and simulations without consuming the forwarded request',async()=>{
    vi.stubEnv('NEXT_PUBLIC_UX_REVIEW_PREVIEW','1');
    const {middleware}=await import('@/middleware');
    const request=new NextRequest('http://localhost/api/soroban/rpc',{method:'POST',body:JSON.stringify({method:'simulateTransaction'})});
    expect((await middleware(request)).headers.get('x-middleware-next')).toBe('1');
    expect(await request.json()).toEqual({method:'simulateTransaction'});
    expect((await check('/api/routing/rebalance/plan',{requestedProtocol:'AUTO'})).headers.get('x-middleware-next')).toBe('1');
    expect((await check('/api/routing/rebalance/plan',{intentTxHash:'not-allowed-in-review'})).status).toBe(403);
  });
});
