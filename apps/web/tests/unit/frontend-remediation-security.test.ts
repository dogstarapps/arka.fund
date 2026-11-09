// @vitest-environment node
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
const calls=vi.hoisted(()=>({exec:vi.fn(),fromSecret:vi.fn(),fromXDR:vi.fn()}));
vi.mock('node:child_process',()=>({execFileSync:calls.exec}));
vi.mock('@stellar/stellar-sdk',()=>({Keypair:{fromSecret:calls.fromSecret},TransactionBuilder:{fromXDR:calls.fromXDR}}));
beforeEach(()=>{vi.resetModules();vi.clearAllMocks();});
afterEach(()=>{vi.unstubAllEnvs();vi.unstubAllGlobals();});
describe('E2E wallet must stay inaccessible before key lookup',()=>{
  it.each(['NODE_ENV','VERCEL_ENV','ARKAFUND_DEPLOYMENT_ENV','ARKAFUND_RELEASE_ENV'])('blocks GET and POST for %s production',async(name)=>{
    vi.stubEnv('NEXT_PUBLIC_E2E_WALLET','1');vi.stubEnv('E2E_WALLET_ENABLED','1');vi.stubEnv(name,'production');
    const {GET,POST}=await import('@/app/api/e2e-wallet/route');
    expect((await GET(new Request('http://localhost/api/e2e-wallet'))).status).toBe(404);
    expect((await POST(new Request('http://localhost/api/e2e-wallet',{method:'POST',body:'{}'}))).status).toBe(500);
    expect(calls.exec).not.toHaveBeenCalled();expect(calls.fromSecret).not.toHaveBeenCalled();expect(calls.fromXDR).not.toHaveBeenCalled();
  });
  it('does not inspect a local identity when disabled',async()=>{
    vi.stubEnv('NEXT_PUBLIC_E2E_WALLET','0');vi.stubEnv('E2E_WALLET_ENABLED','0');
    const {GET}=await import('@/app/api/e2e-wallet/route');
    expect((await GET(new Request('http://localhost/api/e2e-wallet'))).status).toBe(404);
    expect(calls.exec).not.toHaveBeenCalled();expect(calls.fromSecret).not.toHaveBeenCalled();
  });
});
describe('bounded stellar metadata responses',()=>{
  async function resolve(response:Response,index:string){
    const fetch=vi.fn(async()=>response);vi.stubGlobal('fetch',fetch);
    const {findCoreStellarAssetByLookup}=await import('@/lib/catalog/coreStellarAssetRegistry');
    const entry={...findCoreStellarAssetByLookup('USDC')!,id:'audit-'+index};
    const {resolveCoreStellarAssetMetadata}=await import('@/lib/server/stellarToml');
    return {value:await resolveCoreStellarAssetMetadata(entry),fetch};
  }
  it('resolves a bounded issuer response with its exact code and issuer',async()=>{
    const {findCoreStellarAssetByLookup}=await import('@/lib/catalog/coreStellarAssetRegistry');
    const entry=findCoreStellarAssetByLookup('USDC')!;
    const toml=`[[CURRENCIES]]\ncode="USDC"\nissuer="${entry.classicIssuer}"\nimage="https://example.com/usdc.png"\n`;
    const {value,fetch}=await resolve(new Response(toml),'valid');
    expect(value.tomlState).toBe('resolved');expect(value.iconUrl).toBe('https://example.com/usdc.png');
    expect(fetch.mock.calls[0][1]).toMatchObject({redirect:'error',cache:'no-store'});
  });
  it('cancels a response with an oversized declared body before reading',async()=>{
    const cancel=vi.fn();const stream=new ReadableStream({cancel});
    const {value}=await resolve(new Response(stream,{headers:{'content-length':'262145'}}),'declared');
    expect(value.tomlState).toBe('unreachable');expect(cancel).toHaveBeenCalledOnce();
  });
  it.each([{}, {'content-length':'1'}])('caps streamed bytes even without an honest size header %j',async(headers)=>{
    const cancel=vi.fn();const stream=new ReadableStream({start(c){c.enqueue(new Uint8Array(200000));c.enqueue(new Uint8Array(100000));},cancel});
    const {value}=await resolve(new Response(stream,{headers}),'streamed');
    expect(value.tomlState).toBe('unreachable');expect(value.iconSource).not.toBe('stellar_toml');expect(cancel).toHaveBeenCalledOnce();
  });
});
