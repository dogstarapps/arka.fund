// @vitest-environment node
import {it,expect} from 'vitest';
import {mkdtemp} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {withManagedCatalogPosition} from '@/lib/managedCatalog';
import {totals,minimumDepositShares,withdrawalProgressNotice} from '@/lib/managedProduct';
import {managedDepositOperation} from '@/lib/managedWithdrawalOperations';
import {scValToNative} from '@stellar/stellar-sdk';
import {INVESTOR,MANAGER} from '../../../../services/catalog-api/dist/tests/support/managedFixture.js';
const fixtureUrl=new URL('../../../../release/fixtures/managed-catalog.mjs',import.meta.url).href;
async function setup(stage='partial'){
 const {createIntegrationFixture}=await import(/* @vite-ignore */ fixtureUrl);
 const model=await createIntegrationFixture(await mkdtemp(join(tmpdir(),'arka-catalog-ui-')),{stage});
 const wire=await model.product(INVESTOR);
 return {model,wire,fund:withManagedCatalogPosition(wire,INVESTOR,wire.catalogPosition)};
}
it.each(['requested','partial','cancelled','cancelled-paid','paid','reserved'])('catalog API → frontend reconciliation: %s',async stage=>{
 const {model,wire,fund}=await setup(stage);try{
  expect(totals(fund).value?.toString()??null).toBe(wire.catalogPosition.position.positionValueRaw);
  expect(totals(fund).pending.toString()).toBe(wire.catalogPosition.position.pendingSharesRaw);
  expect(totals(fund).claimable.toString()).toBe(wire.catalogPosition.position.claimableAssetsRaw);
  expect(fund.catalog?.observationId).toBe(wire.catalogPosition.observationId);
  expect(fund.requests.every(r=>r.owner===INVESTOR)).toBe(true);
  const before=await model.records.read();expect((await model.app.inject({method:'POST',url:'/v1/sync'})).statusCode).toBe(405);
  expect(await model.records.read()).toEqual(before);
 }finally{await model.app.close();}
});
it('keeps reserved-only claims without NAV and never attributes them to the manager',async()=>{
 const {model,wire,fund}=await setup('reserved');try{
  expect(fund.status).toBeNull();expect(totals(fund).value).toBe(BigInt('1000000000'));expect(totals(fund).hasPosition).toBe(true);
  const other=await model.product(MANAGER),view=withManagedCatalogPosition(other,MANAGER,other.catalogPosition);
  expect(view.requests).toEqual([]);expect(totals(view).hasPosition).toBe(false);
  expect(()=>withManagedCatalogPosition(wire,MANAGER,wire.catalogPosition)).toThrow();
 }finally{await model.app.close();}
});
it('narrows deposit capability without hiding pending shares or reserved claims',async()=>{
 const {model,wire}=await setup();try{
  const d=structuredClone(wire.catalogPosition);d.depositProtectionVersion=null;
  const fund=withManagedCatalogPosition(wire,INVESTOR,d);expect(fund.depositProtectionVersion).toBeNull();
  expect(totals(fund).claimable).toBe(BigInt('200000000'));expect(withdrawalProgressNotice(fund,'1')).toMatch(/partially settled/);
  wire.depositProtectionVersion=null;d.depositProtectionVersion=1;expect(withManagedCatalogPosition(wire,INVESTOR,d).depositProtectionVersion).toBeNull();
 }finally{await model.app.close();}
});
it('retains the exact reviewed minimum in deposit_protected ABI',async()=>{
 const {model,fund}=await setup();try{
  const minimum=minimumDepositShares('100000001',50),op=managedDepositOperation(fund.id,INVESTOR,fund.token,'100000000',minimum);
  const call=op.body().invokeHostFunctionOp().hostFunction().invokeContract();
  expect(call.functionName().toString()).toBe('deposit_protected');expect(call.args()).toHaveLength(4);
  expect(scValToNative(call.args()[2]).toString()).toBe('100000000');expect(scValToNative(call.args()[3]).toString()).toBe(minimum);
 }finally{await model.app.close();}
});
it.each(['network','codeHash','capturedAt','transactionsSubmitted'])('rejects changed real-read provenance: %s',async field=>{
 const {model,wire}=await setup();try{
  const source={kind:'standalone-rpc' as const,network:wire.network,codeHash:wire.catalogPosition.codeHash,capturedAt:wire.catalogPosition.indexedAt,transactionsSubmitted:0 as const};
  expect(withManagedCatalogPosition({...wire,readSource:source},INVESTOR,wire.catalogPosition).catalog?.complete).toBe(true);
  const corrupted={...source,[field]:field==='transactionsSubmitted'?1:'changed'};
  expect(()=>withManagedCatalogPosition({...wire,readSource:corrupted},INVESTOR,wire.catalogPosition)).toThrow(/reconciliation unavailable/);
 }finally{await model.app.close();}
});
it('preserves raw integers larger than Number.MAX_SAFE_INTEGER',async()=>{
 const {model,wire}=await setup();try{
  const huge='900719925474099312345',d=structuredClone(wire.catalogPosition);
  Object.assign(wire,{freeShares:huge,totalShares:huge,queue:{pending_shares:'0',reserved_assets:'0'},status:{nav:huge,total_shares:huge,cash:huge,settle_capacity:'0'}});
  Object.assign(d,{totalShares:huge,nav:huge,reservedAssets:'0',pendingShares:'0',requests:[]});
  Object.assign(d.position,{freeSharesRaw:huge,pendingSharesRaw:'0',economicSharesRaw:huge,claimableAssetsRaw:'0',paidAssetsRaw:'0',shareValueRaw:huge,positionValueRaw:huge});
  expect(totals(withManagedCatalogPosition(wire,INVESTOR,d)).value?.toString()).toBe(huge);
 }finally{await model.app.close();}
});
it.each(['stale','incomplete','wrong-owner','wrong-fund','wrong-token','wrong-nav','drift','corrupt-hash','duplicate','foreign-request','numeric-amount','reserve-mismatch','capability','expired'])('rejects unsafe data: %s',async kind=>{
 const {model,wire}=await setup();try{
  const d=structuredClone(wire.catalogPosition);
  if(kind==='stale')d.stale=true;if(kind==='incomplete')d.complete=false;if(kind==='wrong-owner')d.owner=MANAGER;
  if(kind==='wrong-fund')d.arkaId=wire.token;if(kind==='wrong-token')d.denominationContract=wire.id;
  if(kind==='wrong-nav')d.nav='1';if(kind==='drift')d.ledger+=13;if(kind==='corrupt-hash')d.observationId='bad';
  if(kind==='duplicate')d.requests.push(d.requests[0]);if(kind==='foreign-request')d.requests[0].owner=MANAGER;
  if(kind==='numeric-amount')d.position.freeSharesRaw=42;if(kind==='reserve-mismatch')d.reservedAssets='0';if(kind==='capability')d.depositProtectionVersion=2;
  expect(()=>withManagedCatalogPosition(wire,INVESTOR,d,kind==='expired'?Date.parse(d.indexedAt)+120001:Date.now())).toThrow(/reconciliation unavailable/);
 }finally{await model.app.close();}
});

