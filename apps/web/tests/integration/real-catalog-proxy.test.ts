// @vitest-environment node
import {afterEach,beforeEach,it,expect,vi} from 'vitest';
import {NextRequest} from 'next/server';
import {proxyCatalogRequest} from '@/lib/catalog/proxy';
const request=(method='GET',host='127.0.0.1:3149')=>new NextRequest('http://'+host+'/api/catalog/v1/arkas?limit=12',{method,headers:{host}});
beforeEach(()=>{
 for(const flag of ['ARKA_MANAGED_REAL_READS','ARKA_MANAGED_PRODUCT_LOCAL','NEXT_PUBLIC_MANAGED_PRODUCT_LOCAL','ARKA_MANAGED_CATALOG_CANDIDATE','NEXT_PUBLIC_MANAGED_CATALOG_READ_ONLY'])vi.stubEnv(flag,'1');
 vi.stubEnv('ARKA_LOCAL_RUNTIME_TOKEN','ephemeral-test');vi.stubEnv('CATALOG_API_BASE_URL','https://never-contact-production.invalid');
 vi.stubGlobal('fetch',vi.fn().mockResolvedValue(new Response('{"total":2}',{status:200})));
});
afterEach(()=>{vi.unstubAllEnvs();vi.unstubAllGlobals();});
it('normal catalog navigation uses only the fixed private real-read candidate',async()=>{
 const r=await proxyCatalogRequest(request(),['v1','arkas']);expect(r.status).toBe(200);expect(await r.json()).toEqual({total:2});
 expect(String(vi.mocked(fetch).mock.calls[0][0])).toBe('http://127.0.0.1:3481/catalog-api/v1/arkas?limit=12');
 expect(vi.mocked(fetch).mock.calls[0][1]).toMatchObject({method:'GET',redirect:'error',headers:{authorization:'Bearer ephemeral-test'}});
});
it.each(['ARKA_MANAGED_PRODUCT_LOCAL','NEXT_PUBLIC_MANAGED_PRODUCT_LOCAL','ARKA_MANAGED_CATALOG_CANDIDATE','NEXT_PUBLIC_MANAGED_CATALOG_READ_ONLY'])('cannot expose the real catalog without %s',async flag=>{vi.stubEnv(flag,'');expect((await proxyCatalogRequest(request(),['v1','arkas'])).status).toBe(404);expect(fetch).not.toHaveBeenCalled();});
it('denies profile writes and foreign hosts without IO',async()=>{expect((await proxyCatalogRequest(request('PUT'),['v1','arkas','id','identity'])).status).toBe(405);expect((await proxyCatalogRequest(request('GET','app.arka.fund'),['v1','arkas'])).status).toBe(404);expect(fetch).not.toHaveBeenCalled();});
it('never falls back on candidate failure or malformed paths',async()=>{
 expect((await proxyCatalogRequest(request(),['v1','..','sync'])).status).toBe(404);expect(fetch).not.toHaveBeenCalled();
 vi.mocked(fetch).mockRejectedValueOnce(Error('offline'));expect((await proxyCatalogRequest(request(),['v1','arkas'])).status).toBe(503);expect(fetch).toHaveBeenCalledTimes(1);
 vi.mocked(fetch).mockResolvedValueOnce(new Response('{"error":"unavailable"}',{status:503}));expect((await proxyCatalogRequest(request(),['v1','arkas'])).status).toBe(503);expect(fetch).toHaveBeenCalledTimes(2);
});
