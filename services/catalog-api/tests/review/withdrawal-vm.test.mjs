// Opt-in full backend HTTP -> exact unsigned ABI -> actual frozen P29 RAM execution.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import {createHash} from 'node:crypto';
import {RpcCoordinator,VerifiedGateway,ObservationIndex,ReviewStore,sdk,NETWORK} from '../../review/runtime.mjs';
import {createHandler} from '../../review/service.mjs';
import * as operations from '../../src/reviewOperations.ts';

const url=process.env.ARKA_WITHDRAWAL_VM_URL,area=process.env.ARKA_WITHDRAWAL_VM_EVIDENCE;
test('backend reads, rechecks, archives and prepares all five actual Sushi withdrawal lots without signing or submission',{skip:!url,timeout:240000},async()=>{
 assert(/^http:\/\/127\.0\.0\.1:\d+$/.test(url));assert(area);
 const api=async(path,body)=>{const r=await fetch(url+path,body?{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)}:{}),v=await r.json();assert(r.ok,JSON.stringify(v));return v;};
 let meta=await api('/meta');const id=n=>sdk.StrKey.encodeContract(Buffer.alloc(32,n)),fund=meta.fund,owner=meta.owner,root=new URL('../../../../',import.meta.url),snapshot=JSON.parse(fs.readFileSync(process.env.ARKA_WITHDRAWAL_SNAPSHOT)),manifest=JSON.parse(fs.readFileSync(new URL('release/source-manifest.json',root))),hash=file=>createHash('sha256').update(fs.readFileSync(file)).digest('hex');
 const config={schema:1,network:NETWORK,endpoint:'https://synthetic-rpc.invalid',factory:id(31),registry:id(32),denomination:'CAS3J7GYLGXMF6TDJBBYYSE3HQ6BBSMLNUQ34T6TZMYMW2EVH34XOWMA',router:id(33),assets:['CAS3J7GYLGXMF6TDJBBYYSE3HQ6BBSMLNUQ34T6TZMYMW2EVH34XOWMA','CCW67TSZV3SSS2HXMBQ5JFGCKJNXKZM7UQUWUZPUTHXSTZLEO7SJMI75'],userCapRaw:'10000000',v3Wasm:hash(new URL('release/wasm/arka.wasm',root)),factoryCodeHash:hash(new URL('release/wasm/arka-factory.wasm',root)),registryCodeHash:hash(new URL('release/wasm/arka-registry.wasm',root)),templateHash:hash(new URL('release/wasm/arka.wasm',root)),legacyCodeHashes:['e'.repeat(64)],legacyIds:['CCP7X4UYFSUNXWRUH7W25RQMEQEHXFIYHNHVGAYAGGOOHPMPJKZGOGPW'],releaseId:manifest.releaseId,limits:{calls:30,durationMs:60000,spacingMs:0,responseBytes:16*1024**2,totalBytes:32*1024**2}};
 const at=()=>meta.timestamp*1000,publicCalls=[],reviews=[];
 function header(){const h=sdk.xdr.LedgerHeader.fromXDR(snapshot.header.headerXdr,'base64');h.ledgerSeq(meta.ledger);h.scpValue().closeTime(sdk.xdr.Uint64.fromString(String(meta.timestamp)));const digest=sdk.hash(h.toXDR());return{hash:digest.toString('hex'),headerXdr:new sdk.xdr.LedgerHeaderHistoryEntry({hash:digest,header:h,ext:new sdk.xdr.LedgerHeaderHistoryEntryExt(0)}).toXDR('base64')};}
 const contractData=(contract,key,val)=>sdk.xdr.LedgerEntryData.contractData(new sdk.xdr.ContractDataEntry({ext:new sdk.xdr.ExtensionPoint(0),contract:sdk.Address.fromString(contract).toScAddress(),key,durability:sdk.xdr.ContractDataDurability.persistent(),val}));
 function entry(key){const k=sdk.xdr.LedgerKey.fromXDR(key,'base64');let value;
  if(k.switch().name==='account')value=sdk.xdr.LedgerEntryData.account(new sdk.xdr.AccountEntry({accountId:sdk.Address.fromString(owner).toScAddress().accountId(),balance:sdk.xdr.Int64.fromString('100000000000'),seqNum:sdk.xdr.SequenceNumber.fromString(meta.sequence),numSubEntries:0,inflationDest:null,flags:0,homeDomain:'',thresholds:Buffer.from([1,1,1,1]),signers:[],ext:new sdk.xdr.AccountEntryExt(0)}));
  else{const cd=k.contractData(),contract=sdk.Address.fromScAddress(cd.contract()).toString();assert(!config.legacyIds.includes(contract),'NOAH_QUERY_FORBIDDEN');if(cd.key().switch().name==='scvLedgerKeyContractInstance'){const wasm=contract===fund?config.v3Wasm:contract===config.factory?config.factoryCodeHash:config.registryCodeHash;value=contractData(contract,cd.key(),sdk.xdr.ScVal.scvContractInstance(new sdk.xdr.ScContractInstance({executable:sdk.xdr.ContractExecutable.contractExecutableWasm(Buffer.from(wasm,'hex')),storage:[]})));}else{assert.equal(contract,config.registry);value=contractData(contract,cd.key(),sdk.xdr.ScVal.scvVec([sdk.Address.fromString(fund).toScVal()]));}}
  return{key,xdr:value.toXDR('base64'),liveUntilLedgerSeq:meta.ledger+1000};
 }
 const rpc=new RpcCoordinator(config,{now:at,sleep:async()=>{},fetchImpl:async(endpoint,options)=>{
  assert.equal(endpoint,config.endpoint);const q=JSON.parse(options.body);publicCalls.push({method:q.method,params:q.params});let result;
  if(q.method==='getNetwork')result={passphrase:NETWORK,protocolVersion:29};
  else if(q.method==='getHealth')result={status:'healthy',latestLedger:meta.ledger,latestLedgerCloseTime:String(meta.timestamp)};
  else if(q.method==='getLedgerEntries')result={latestLedger:meta.ledger,entries:q.params.keys.map(entry)};
  else if(q.method==='getLedgers')result={ledgers:[header()]};
  else if(q.method==='simulateTransaction'){const out=await api('/simulate',{xdr:q.params.transaction});result=out.success?{latestLedger:meta.ledger,minResourceFee:String(out.resourceFeeRaw),transactionData:out.transactionData,results:[{xdr:out.result,auth:out.auth}]}:{latestLedger:meta.ledger,error:out.error};}
  else if(q.method==='getTransaction')result={status:'NOT_FOUND'};
  else throw Error('RPC_WRITE_OR_UNKNOWN_METHOD');
  return Response.json({jsonrpc:'2.0',id:q.id,result});
 }});
 const index=new ObservationIndex(async()=>{const state=await api('/state'),requests=state.requests,sum=field=>requests.reduce((s,r)=>s+BigInt(r[field]),0n).toString();return{...state,network:NETWORK,readSource:{kind:'mainnet-rpc-readonly',network:NETWORK,codeHash:config.v3Wasm,capturedAt:new Date(at()).toISOString(),verificationMode:'live'},catalogPosition:{owner,arkaId:fund,complete:true,stale:false,codeHash:config.v3Wasm,ledger:state.ledger,totalShares:state.totalShares,denominationContract:state.token,creationLedger:snapshot.ledger,coverageFromLedger:snapshot.ledger,coverageToLedger:state.ledger,requests,position:{owner,freeSharesRaw:state.freeShares,pendingSharesRaw:sum('pending_shares'),claimableAssetsRaw:sum('claimable_assets'),paidAssetsRaw:sum('claimed_assets')}}};});
 const store=new ReviewStore(area+'/reviews',config,operations),gateway=new VerifiedGateway(config,{rpc,index,store,operations,now:at});
 for(const name of ['quote','prepare']){const actual=gateway[name].bind(gateway);gateway[name]=async(...args)=>{try{return await actual(...args);}catch(error){console.error('FIXTURE_GATEWAY_DIAGNOSTIC',name,error.stack);throw error;}};}
 const server=http.createServer(createHandler(gateway,{origin:'http://127.0.0.1',config}));await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const request=async(path,params)=>{const r=await fetch('http://127.0.0.1:'+server.address().port+path+'?'+new URLSearchParams(params)),body=await r.json();return{status:r.status,body};};
 const prepare=async intent=>{const r=await request('/prepare',{intent:JSON.stringify(intent),source:owner,network:NETWORK});assert.equal(r.status,200,JSON.stringify(r.body));const review=r.body,tx=sdk.TransactionBuilder.fromXDR(review.unsignedEnvelope,NETWORK);assert.equal(tx.signatures.length,0);assert.equal(review.signaturesCreated,0);assert.equal(review.transactionsSubmitted,0);assert.equal(review.canSubmit,false);assert.equal(review.readyForSignature,false);assert.deepEqual(await new ReviewStore(area+'/reviews',config,operations).get(review.id),review);reviews.push(review);return review;};
 // RAM application is a TEST DRIVER boundary, never a gateway or RPC capability.
 const apply=async review=>{assert((await api('/apply',{id:review.id,xdr:review.unsignedEnvelope})).success);meta=await api('/meta');};
 try{
  for(const [path,params]of [['/quote',{kind:'withdrawal',fund:config.legacyIds[0],owner}],['/prepare',{intent:JSON.stringify({action:'settle',fund:config.legacyIds[0]}),source:owner,network:NETWORK}]]){assert.equal((await request(path,params)).status,409);assert.equal(publicCalls.length,0,'Noah must be excluded before any RPC observation');}
  await apply(await prepare({action:'request',fund,sharesRaw:'10000000018'}));
  const early=await request('/prepare',{intent:JSON.stringify({action:'settle',fund}),source:owner,network:NETWORK});assert.equal(early.status,409);
  await api('/advance',{seconds:120});meta=await api('/meta');let first;
  for(let i=0;i<5;i++){
   const q=await request('/quote',{kind:'withdrawal',fund,owner});assert.equal(q.status,200,JSON.stringify(q.body));assert(q.body.value);assert.equal(q.body.value.amount_in,i===0?'32377407':'32377406');
   const intent={action:'recover-spot',fund,step:q.body.value};if(i===0)first=intent;
   const review=await prepare(intent);const receipt=await request('/receipt',{id:review.id,source:owner});assert.equal(receipt.body.status,'unknown');assert.equal(receipt.body.canRetrySubmission,false);await apply(review);
   if(i===0){const before=publicCalls.filter(c=>c.method==='simulateTransaction').length,stale=await request('/prepare',{intent:JSON.stringify(first),source:owner,network:NETWORK});assert.equal(stale.status,409);assert.equal(publicCalls.filter(c=>c.method==='simulateTransaction').length-before,1,'stale plan must stop before financial simulation');}
  }
  const empty=await request('/quote',{kind:'withdrawal',fund,owner});assert.equal(empty.status,200);assert.equal(empty.body.value,null);
  await apply(await prepare({action:'settle',fund}));await apply(await prepare({action:'claim',fund,requestId:'1'}));
  const final=await api('/state'),proof=await api('/proof');for(const value of [final.status.nav,final.totalShares,final.freeShares,final.queue.pending_shares,final.queue.reserved_assets,...final.holdings.map(h=>h.cash)])assert.equal(value,'0');assert.equal(final.requests[0].claimed_assets,'9994009043');assert.deepEqual(proof.executions.map(x=>x.method),['request_withdrawal',...Array(5).fill('liquidate_withdrawal'),'settle_withdrawals','claim_withdrawal']);assert.equal(reviews.length,8);assert.equal(proof.signaturesCreated,0);assert.equal(proof.transactionsSubmitted,0);assert.equal(proof.productionAccess,false);assert(!publicCalls.some(c=>c.method==='sendTransaction'));
  fs.writeFileSync(area+'/backend-vm-proof.json',JSON.stringify({scope:'Actual HTTP/gateway/coordinator/archive and actual P29 RAM execution. Registry, factory, account/header/admission and complete index metadata are synthetic. Frozen Sushi pool/factory code and state; synthetic oracle. Public-network unsigned envelopes; no real consensus, signatures, broadcasts or current target validation.',reviews:reviews.map(r=>({id:r.id,intent:r.intent,fee:r.totalFeeRaw,network:r.network})),rpcCalls:publicCalls,proof,final,signaturesCreated:0,transactionsSubmitted:0,productionAccess:false,noahQueried:false,noahVersion:2},null,2)+'\n',{flag:'wx'});
 }finally{await new Promise(resolve=>server.close(resolve));}
});
