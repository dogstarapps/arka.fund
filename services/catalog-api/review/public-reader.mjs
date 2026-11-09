import assert from 'node:assert/strict';
import {sdk,NETWORK} from './sdk.mjs';
export class PublicReader{
 constructor(plan,{fetchImpl=fetch,now=Date.now,sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms)),record=()=>{}}={}){this.plan=plan;this.fetch=fetchImpl;this.now=now;this.sleep=sleep;this.record=record;this.began=now();this.next=0;this.stopped=false;this.stats={calls:0,bytes:0,failed:0,rateLimited:0,retried:0,horizonCalls:0};}
 validate(method,params){
  assert(['getNetwork','getHealth','getFeeStats','getLedgerEntries','getLedgers','simulateTransaction'].includes(method),'RPC_METHOD_DENIED');
  if(['getNetwork','getHealth','getFeeStats'].includes(method))assert.equal(Object.keys(params).length,0);
  if(method==='getLedgerEntries')assert(params.keys.length<=200&&params.keys.every(key=>this.plan.approvedKeys.includes(key)),'EXACT_KEYS_REQUIRED');
  if(method==='getLedgers'){assert(Number.isSafeInteger(params.startLedger));assert.deepEqual(params.pagination,{limit:1});}
  if(method==='simulateTransaction'){
   const tx=sdk.TransactionBuilder.fromXDR(params.transaction,NETWORK);assert.equal(tx.signatures.length,0,'SIGNATURES_DENIED');assert.equal(tx.operations.length,1);assert.equal(tx.source,this.plan.sourceAccount);
   const operation=tx.operations[0];assert.equal(operation.type,'invokeHostFunction');assert(!operation.source);assert.equal(operation.auth?.length??0,0);
   const hf=operation.func;
   if(hf.switch().name==='hostFunctionTypeUploadContractWasm'){const hash=sdk.hash(hf.wasm()).toString('hex');assert.equal(hash,this.plan.wasm.sha256,'EXACT_CODE_ONLY');}
   else{assert.equal(hf.switch().name,'hostFunctionTypeInvokeContract');const call=hf.invokeContract(),id=sdk.Address.fromScAddress(call.contractAddress()).toString();assert(this.plan.providers.includes(id));assert(['lastprice','base','decimals'].includes(String(call.functionName())),'PUBLIC_GETTERS_ONLY');}
  }
 }
 async call(method,params={}){
  this.validate(method,params);assert(!this.stopped,'READ_SESSION_STOPPED');const limit=this.plan.limits;assert(this.stats.calls<limit.calls&&this.now()-this.began<limit.durationMs,'FINITE_READ_BUDGET');
  await this.sleep(Math.max(0,this.next-this.now()));this.next=this.now()+limit.spacingMs;
  const request={jsonrpc:'2.0',id:++this.stats.calls,method,params},event={at:new Date(this.now()).toISOString(),request};let recorded=false;
  try{
   const response=await this.fetch(this.plan.endpoint,{method:'POST',redirect:'error',headers:{'content-type':'application/json'},body:JSON.stringify(request),signal:AbortSignal.timeout(20000)});event.http=response.status;
   if(response.status===429){this.stats.rateLimited++;event.retryAfter=response.headers.get('retry-after');throw Error('RPC_429_STOP_RESPECT_RETRY_AFTER');}
   assert(response.ok&&response.body,'PUBLIC_RPC_UNAVAILABLE');const reader=response.body.getReader(),chunks=[];let size=0;
   try{for(;;){const item=await reader.read();if(item.done)break;size+=item.value.length;assert(size<=limit.responseBytes,'RESPONSE_SIZE_LIMIT');chunks.push(item.value);}}finally{await reader.cancel().catch(()=>{});}
   this.stats.bytes+=size;assert(this.stats.bytes<=limit.totalBytes,'CAPTURE_SIZE_LIMIT');event.response=JSON.parse(Buffer.concat(chunks));recorded=true;this.record(event);
   assert.equal(event.response.id,request.id);assert.equal(event.response.jsonrpc,'2.0');assert(!event.response.error&&event.response.result,'RPC_RESPONSE_ERROR');return event.response.result;
  }catch(error){this.stopped=true;if(!String(error.message).startsWith('RPC_429'))this.stats.failed++;if(!recorded)this.record({...event,error:error.message});throw error;}
 }
}
