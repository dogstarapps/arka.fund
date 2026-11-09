// @vitest-environment node
import {beforeEach,afterEach,it,expect,vi} from 'vitest';
import {NextRequest} from 'next/server';
import {GET} from '@/app/api/managed-local/[kind]/route';
import {StrKey} from '@stellar/stellar-sdk';
const request=(host='127.0.0.1:3142',query='')=>new NextRequest(`http://${host}/api/managed-local/status${query}`,{headers:{host}});
beforeEach(()=>{vi.stubEnv('ARKA_ISOLATED_RECEIPT_PORT','3469');vi.stubEnv('ARKA_MANAGED_PRODUCT_LOCAL','1');vi.stubEnv('NEXT_PUBLIC_MANAGED_PRODUCT_LOCAL','1');vi.stubEnv('ARKA_LOCAL_RUNTIME_TOKEN','local-ephemeral-test-token');vi.stubGlobal('fetch',vi.fn().mockResolvedValue(new Response(JSON.stringify({mode:'dry-run'}),{status:200})));});
afterEach(()=>{vi.unstubAllEnvs();vi.unstubAllGlobals();});
it.each(['fund','portfolio'])('real %s refuses absent, empty, duplicate or invalid owner before IO',async kind=>{
 for(const flag of ['ARKA_MANAGED_REAL_READS','ARKA_MANAGED_CATALOG_CANDIDATE','NEXT_PUBLIC_MANAGED_CATALOG_READ_ONLY'])vi.stubEnv(flag,'1');
 const owner=StrKey.encodeEd25519PublicKey(Buffer.alloc(32,8));
 for(const query of ['', '?owner=', '?owner=invalid','?owner='+owner+'&owner='+owner])expect((await GET(request(undefined,query),{params:Promise.resolve({kind})})).status).toBe(400);
 expect(fetch).not.toHaveBeenCalled();
 expect((await GET(request(undefined,'?owner='+owner),{params:Promise.resolve({kind})})).status).toBe(200);
});
it.each(['ARKA_MANAGED_PRODUCT_LOCAL','NEXT_PUBLIC_MANAGED_PRODUCT_LOCAL','ARKA_LOCAL_RUNTIME_TOKEN'])('is absent without %s',async flag=>{vi.stubEnv(flag,'');expect((await GET(request(),{params:Promise.resolve({kind:'status'})})).status).toBe(404);expect(fetch).not.toHaveBeenCalled();});
it.each(['app.arka.fund','evil.example','127.0.0.1.evil.example:3142'])('rejects non-loopback host %s',async host=>{expect((await GET(request(host),{params:Promise.resolve({kind:'status'})})).status).toBe(404);expect(fetch).not.toHaveBeenCalled();});
it('does not proxy arbitrary destinations, signing or RPC paths',async()=>{expect((await GET(request(),{params:Promise.resolve({kind:'sign'})})).status).toBe(404);expect((await GET(request(undefined,'?url=https://example.com'),{params:Promise.resolve({kind:'status'})})).status).toBe(404);expect(fetch).not.toHaveBeenCalled();});
it('reads from the fixed private loopback service without exposing the token',async()=>{const r=await GET(request(),{params:Promise.resolve({kind:'status'})});expect(await r.json()).toEqual({mode:'dry-run'});expect(fetch).toHaveBeenCalledWith('http://127.0.0.1:3469/status?',expect.objectContaining({redirect:'error',headers:{authorization:'Bearer local-ephemeral-test-token'}}));});
it('reports unavailable instead of a zero portfolio',async()=>{vi.mocked(fetch).mockRejectedValue(Error('offline'));const r=await GET(request(),{params:Promise.resolve({kind:'status'})});expect(r.status).toBe(503);expect((await r.json()).error).toContain('No holdings');});
it('exposes only the fixed local creation template, with no factory override',async()=>{expect((await GET(request(),{params:Promise.resolve({kind:'creation'})})).status).toBe(200);vi.mocked(fetch).mockClear();expect((await GET(request(undefined,'?fund=other'),{params:Promise.resolve({kind:'creation'})})).status).toBe(404);expect(fetch).not.toHaveBeenCalled();});
it('routes paired candidate flags to the configured private candidate service',async()=>{
 vi.stubEnv('ARKA_ISOLATED_RECEIPT_PORT','3479');
 vi.stubEnv('ARKA_MANAGED_CATALOG_CANDIDATE','1');vi.stubEnv('NEXT_PUBLIC_MANAGED_CATALOG_READ_ONLY','1');
 const r=await GET(request(),{params:Promise.resolve({kind:'status'})});expect(r.status).toBe(200);
 expect(fetch).toHaveBeenCalledWith('http://127.0.0.1:3479/status?',expect.objectContaining({redirect:'error'}));
});
it('refuses a candidate with the read-only UI flag missing',async()=>{
 vi.stubEnv('ARKA_MANAGED_CATALOG_CANDIDATE','1');vi.stubEnv('NEXT_PUBLIC_MANAGED_CATALOG_READ_ONLY','');
 expect((await GET(request(),{params:Promise.resolve({kind:'status'})})).status).toBe(404);expect(fetch).not.toHaveBeenCalled();
});
it('uses the configured real-read port with all paired safety flags',async()=>{
 vi.stubEnv('ARKA_ISOLATED_RECEIPT_PORT','3481');
 vi.stubEnv('ARKA_MANAGED_REAL_READS','1');vi.stubEnv('ARKA_MANAGED_CATALOG_CANDIDATE','1');vi.stubEnv('NEXT_PUBLIC_MANAGED_CATALOG_READ_ONLY','1');
 expect((await GET(request(),{params:Promise.resolve({kind:'status'})})).status).toBe(200);
 expect(fetch).toHaveBeenCalledWith('http://127.0.0.1:3481/status?',expect.objectContaining({redirect:'error'}));
 vi.mocked(fetch).mockClear();vi.stubEnv('ARKA_MANAGED_CATALOG_CANDIDATE','');
 expect((await GET(request(),{params:Promise.resolve({kind:'status'})})).status).toBe(404);expect(fetch).not.toHaveBeenCalled();
});

it.each(['','NaN','0','80','65536','http://example.com','3469/else','1e4'])('rejects invalid isolated service port %s before I/O',async port=>{vi.stubEnv('ARKA_ISOLATED_RECEIPT_PORT',port);expect((await GET(request(),{params:Promise.resolve({kind:'status'})})).status).toBe(503);expect(fetch).not.toHaveBeenCalled();});
