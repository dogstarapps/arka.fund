// @vitest-environment node
import {beforeEach,afterEach,describe,it,expect,vi} from 'vitest';
import {TransactionBuilder} from '@stellar/stellar-sdk';
import {prepareManagedLocal,signManagedLocal,executeManagedLocal,validateManagedWalletAction,managedLocalState} from '@/lib/server/managedLocalBridge';
import {MANAGED_LOCAL_NETWORK} from '@/lib/managedWalletFlow';
import {managedState} from '../fixtures/managedState';
type GlobalBridge=typeof globalThis&{__arkaManagedLocalBridge?:unknown};
let state=managedState(),writes=0;
beforeEach(()=>{
 delete(globalThis as GlobalBridge).__arkaManagedLocalBridge;state=managedState();writes=0;
 for(const k of ['ARKA_MANAGED_INTEGRATION','ARKA_MANAGED_PREVIEW','NEXT_PUBLIC_UX_REVIEW_PREVIEW'])vi.stubEnv(k,'1');vi.stubEnv('ARKA_LOCAL_PREVIEW_TOKEN','synthetic-local-token-only');
 vi.stubGlobal('fetch',vi.fn(async(url,init)=>{
  const path=new URL(String(url)).pathname;
  if(path==='/configure'){const keys=JSON.parse(String(init?.body)).actors;state={...state,wallets:{a:keys[0],b:keys[1],manager:keys[2],executor:keys[3]}};}
  if(path==='/action'){writes++;state={...state,revision:(state.revision??0)+1};return new Response(JSON.stringify({ok:true,state,operationId:JSON.parse(String(init?.body)).operationId}),{status:200});}
  if(path.startsWith('/receipt/'))return new Response('{}',{status:404});
  return new Response(JSON.stringify({state}),{status:200});
 }));
});
afterEach(()=>{vi.unstubAllEnvs();vi.unstubAllGlobals();delete(globalThis as GlobalBridge).__arkaManagedLocalBridge;});
describe('Cryptographic local wallet bridge',()=>{
 it('signs a real XDR with ephemeral keys and applies an approved action once',async()=>{const p=await prepareManagedLocal({action:'request',actor:'a',sharesRaw:'100'});const signed=signManagedLocal('a',p.xdr);const tx=TransactionBuilder.fromXDR(signed,MANAGED_LOCAL_NETWORK);expect(tx.signatures).toHaveLength(1);const r=await executeManagedLocal(p.id,signed);expect(r.ok).toBe(true);await executeManagedLocal(p.id,signed);expect(writes).toBe(1);expect(r).not.toHaveProperty('secret');});
 it('rejects an unsigned transaction',async()=>{const p=await prepareManagedLocal({action:'request',actor:'a',sharesRaw:'100'});await expect(executeManagedLocal(p.id,p.xdr)).rejects.toThrow('Signature');expect(writes).toBe(0);});
 it('rejects a different wallet signing the draft',async()=>{const p=await prepareManagedLocal({action:'claim',actor:'a',id:1});expect(()=>signManagedLocal('b',p.xdr)).toThrow();expect(writes).toBe(0);});
 it('rejects a stale ledger after signing',async()=>{const p=await prepareManagedLocal({action:'request',actor:'a',sharesRaw:'100'});const signed=signManagedLocal('a',p.xdr);state.revision=50;await expect(executeManagedLocal(p.id,signed)).rejects.toThrow('changed');expect(writes).toBe(0);});
 it('rejects a restarted local engine',async()=>{const p=await prepareManagedLocal({action:'claim',actor:'a',id:1});const signed=signManagedLocal('a',p.xdr);state.engineId='new-local-engine';await expect(executeManagedLocal(p.id,signed)).rejects.toThrow('changed');expect(writes).toBe(0);});
 it('serializes concurrent duplicate submissions',async()=>{const p=await prepareManagedLocal({action:'settle',actor:'executor'});const signed=signManagedLocal('executor',p.xdr);await Promise.all([executeManagedLocal(p.id,signed),executeManagedLocal(p.id,signed)]);expect(writes).toBe(1);});
 it('uses the actual atomic factory method for creation',async()=>{const p=await prepareManagedLocal({action:'create',actor:'manager'});const tx=TransactionBuilder.fromXDR(p.xdr,MANAGED_LOCAL_NETWORK);expect(tx.operations[0].type).toBe('invokeHostFunction');const signed=signManagedLocal('manager',p.xdr);expect((await executeManagedLocal(p.id,signed)).ok).toBe(true);});
 it('fails closed outside the explicit local integration mode',async()=>{vi.stubEnv('ARKA_MANAGED_INTEGRATION','0');await expect(managedLocalState()).rejects.toThrow('disabled');expect(fetch).not.toHaveBeenCalled();});
 it('never forwards arbitrary URLs, private keys or unsupported action fields',()=>{expect(validateManagedWalletAction({action:'request',actor:'a',sharesRaw:'1',rpc:'https://example.com'})).toBe(false);expect(validateManagedWalletAction({action:'create',actor:'manager',secret:'not-a-real-key'})).toBe(false);expect(validateManagedWalletAction({action:'claim',actor:'manager',id:1})).toBe(false);});
});
