// @vitest-environment node
import { beforeEach,afterEach,describe,it,expect,vi } from 'vitest';
import { NextRequest } from 'next/server';
import { GET,POST } from '@/app/api/managed-withdrawals-preview/route';
function req(body?: unknown,headers:Record<string,string>={}) {
  return new NextRequest('http://127.0.0.1:3138/api/managed-withdrawals-preview',{method:body?'POST':'GET',
    headers:{host:'127.0.0.1:3138',origin:'http://127.0.0.1:3138','content-type':'application/json','x-arka-local-preview':'1',...headers},body:body?JSON.stringify(body):undefined});
}
describe('Local preview API isolation',()=>{
  beforeEach(()=>{vi.stubEnv('ARKA_MANAGED_PREVIEW','1');vi.stubEnv('NEXT_PUBLIC_UX_REVIEW_PREVIEW','1');vi.stubEnv('ARKA_LOCAL_PREVIEW_TOKEN','synthetic-test-only-no-credentials');vi.stubGlobal('fetch',vi.fn().mockResolvedValue(new Response(JSON.stringify({state:{network:'none'}}),{status:200})));});
  afterEach(()=>{vi.unstubAllGlobals();vi.unstubAllEnvs();});
  it('is unavailable without both safety flags',async()=>{vi.stubEnv('ARKA_MANAGED_PREVIEW','0');expect((await GET(req())).status).toBe(404);expect(fetch).not.toHaveBeenCalled();});
  it('rejects production hosts',async()=>{expect((await GET(req(undefined,{host:'app.arka.fund'}))).status).toBe(404);expect(fetch).not.toHaveBeenCalled();});
  it('rejects cross-origin or missing preview marker writes',async()=>{expect((await POST(req({action:'reset'},{origin:'https://example.com'}))).status).toBe(404);expect((await POST(req({action:'reset'},{'x-arka-local-preview':''}))).status).toBe(404);expect(fetch).not.toHaveBeenCalled();});
  it.each([{action:'sendTransaction'},{action:'prepare',actor:'manager',amountRaw:'-1'},{action:'request',actor:'a',sharesRaw:100},{action:'claim',actor:'b',id:0},{action:'advance',seconds:604801},{action:'reset',url:'https://example.com'}])('rejects invalid or unexpected fields: %j',async body=>{expect((await POST(req(body))).status).toBe(400);expect(fetch).not.toHaveBeenCalled();});
  it('uses a fixed loopback backend, keeps the token server-side, and never falls back to RPC',async()=>{
    const r=await POST(req({action:'request',actor:'a',sharesRaw:'10000000'}));expect(r.status).toBe(200);
    expect(fetch).toHaveBeenCalledWith('http://127.0.0.1:3468/action',expect.objectContaining({method:'POST',cache:'no-store'}));
    expect(await r.text()).not.toContain('synthetic-test-only-no-credentials');
  });
  it('fails closed when the simulator is down',async()=>{vi.mocked(fetch).mockRejectedValue(new Error('offline'));const r=await GET(req());expect(r.status).toBe(503);expect(await r.text()).toContain('No action was sent');expect(fetch).toHaveBeenCalledTimes(1);});
});
