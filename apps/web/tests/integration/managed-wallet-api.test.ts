// @vitest-environment node
import {beforeEach,afterEach,describe,it,expect,vi} from 'vitest';
import {NextRequest} from 'next/server';
const bridge=vi.hoisted(()=>({prepareManagedLocal:vi.fn(),signManagedLocal:vi.fn(),executeManagedLocal:vi.fn(),managedLocalReceipt:vi.fn()}));
vi.mock('@/lib/server/managedLocalBridge',()=>bridge);
import {POST} from '@/app/api/managed-withdrawals-preview/wallet/route';
import {POST as plainPost} from '@/app/api/managed-withdrawals-preview/route';
function req(body:unknown,headers:Record<string,string>={}){return new NextRequest('http://127.0.0.1:3138/api/managed-withdrawals-preview/wallet',{method:'POST',headers:{host:'127.0.0.1:3138',origin:'http://127.0.0.1:3138','content-type':'application/json','x-arka-local-preview':'1',...headers},body:JSON.stringify(body)});}
beforeEach(()=>{vi.stubEnv('ARKA_MANAGED_INTEGRATION','1');vi.stubEnv('ARKA_MANAGED_PREVIEW','1');vi.stubEnv('NEXT_PUBLIC_UX_REVIEW_PREVIEW','1');vi.stubEnv('ARKA_LOCAL_PREVIEW_TOKEN','synthetic-test-token-not-a-credential');vi.clearAllMocks();});
afterEach(()=>vi.unstubAllEnvs());
describe('Wallet endpoint isolation',()=>{
 it.each(['ARKA_MANAGED_INTEGRATION','ARKA_MANAGED_PREVIEW','NEXT_PUBLIC_UX_REVIEW_PREVIEW'])('requires %s',async flag=>{vi.stubEnv(flag,'0');expect((await POST(req({stage:'prepare',action:{action:'create',actor:'manager'}}))).status).toBe(404);expect(bridge.prepareManagedLocal).not.toHaveBeenCalled();});
 it.each<Record<string,string>>([{host:'app.arka.fund'},{origin:'https://evil.example'},{'x-arka-local-preview':'0'}])('rejects non-local/same-origin requests %j',async headers=>{expect((await POST(req({stage:'prepare',action:{}},headers))).status).toBe(404);expect(bridge.prepareManagedLocal).not.toHaveBeenCalled();});
 it('rejects unknown fields and oversized requests before signing',async()=>{expect((await POST(req({stage:'sign',actor:'a',xdr:'x',url:'https://example.com'}))).status).toBe(400);expect((await POST(req({stage:'sign',actor:'a',xdr:'x'},{'content-length':'32769'}))).status).toBe(413);expect(bridge.signManagedLocal).not.toHaveBeenCalled();});
 it('exposes receipt reads without executing a financial action',async()=>{bridge.managedLocalReceipt.mockResolvedValue(undefined);const response=await POST(req({stage:'receipt',id:'12345678-1234-1234-1234-123456789abc'}));expect(response.status).toBe(200);expect(await response.json()).toEqual({receipt:null});expect(bridge.executeManagedLocal).not.toHaveBeenCalled();});
 it('rejects direct unsigned financial actions in integration mode',async()=>{const response=await plainPost(req({action:'request',actor:'a',sharesRaw:'10000000'}));expect(response.status).toBe(409);expect(bridge.executeManagedLocal).not.toHaveBeenCalled();});
});
