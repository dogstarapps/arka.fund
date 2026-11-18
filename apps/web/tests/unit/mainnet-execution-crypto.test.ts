// @vitest-environment node
// Real Ed25519/XDR verification. Every wallet, RPC response and ledger/index is synthetic.
import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';
import {Account,Address,Keypair,Networks,Transaction,TransactionBuilder,xdr} from '@stellar/stellar-sdk';
import {createMainnetExecutionTransport,NOAH_V2,readExecutionReceipt} from '@/lib/mainnetExecution';
import {executeMainnetWalletAction,ManagedConfirmationUnknown} from '@/lib/managedWalletFlow';
import {MAINNET_NETWORK,type ConnectorGateway,type MainnetIntent,type MainnetReview} from '@/lib/mainnetWalletConnector';
import type {ManagedWalletAction} from '@/lib/managedWithdrawals';
import * as operations from '@/lib/managedWithdrawalOperations';
import {prepareMainnetReview,inspectMainnetReceipt,reconcileCatalogReceipt,predictCreatedFund} from '../../../../services/catalog-api/review/core.mjs';
import {sdk as backendSdk} from '../../../../services/catalog-api/review/sdk.mjs';

const enabled=process.env.ARKA_EPHEMERAL_SIGNATURE_TESTS==='1';
const contract=(n:number)=>Address.contract(Buffer.alloc(32,n)).toString();
const actions=['approve','deposit','request','instant','cancel','claim','prepare','settle','portfolio-swap','recover-spot','create'] as const;
function parse(encoded:string,network=MAINNET_NETWORK){return TransactionBuilder.fromXDR(encoded,network) as Transaction;}
function sign(encoded:string,key:Keypair,network=MAINNET_NETWORK){const tx=parse(encoded,network);tx.sign(key);return tx.toXDR();}
function altered(encoded:string,change:(body:xdr.Transaction)=>void){const envelope=parse(encoded).toEnvelope();change(envelope.v1().tx());return envelope.toXDR('base64');}

function fixture(kind:typeof actions[number]='recover-spot'){
 const key=Keypair.random(),owner=key.publicKey(),denomination=contract(3),asset=contract(5),router=contract(4);
 let clock=Math.floor(Date.now()/1000)*1000,selected=true,address=owner,network=MAINNET_NETWORK;
 const profile={network:MAINNET_NETWORK,releaseId:'a'.repeat(64),codeHash:'b'.repeat(64),v3Wasm:'b'.repeat(64),endpoint:'https://synthetic-rpc.invalid/',mainnetApproved:true,executionEnabled:true,factory:contract(31),registry:contract(32),denomination,router,assets:[denomination,asset],templateHash:'b'.repeat(64),assetSymbols:{[asset]:'USDC'},commercialFeeUsdcRaw:'50000000',legacyIds:[NOAH_V2]};
 const draft={templateHash:profile.templateHash,creationFee:{token:asset,amountRaw:'50000000'},saltHex:'c'.repeat(64),denominationContract:denomination,routerId:router,whitelistContracts:[denomination,asset],fees:{mgmt_bps:20,perf_bps:100,deposit_bps:10,redeem_bps:0}};
 const fund=kind==='create'?predictCreatedFund(profile.factory,owner,draft.saltHex):contract(6);
 const step={adapter:contract(8),pool_id:'1',asset_in:{contract:asset},asset_out:{contract:denomination},amount_in:'100',min_out:'90',router_addr:router};
 const action:ManagedWalletAction=kind==='create'?{action:kind,actor:'manager',draft}:kind==='recover-spot'?{action:kind,actor:'executor',step}:kind==='portfolio-swap'?{action:kind,actor:'manager',step}:kind==='approve'?{action:kind,actor:'a',asset,amountRaw:'100'}:kind==='deposit'?{action:kind,actor:'a',asset,amountRaw:'100',minSharesRaw:'90'}:kind==='request'||kind==='instant'?{action:kind,actor:'a',sharesRaw:'10'}:kind==='claim'||kind==='cancel'?{action:kind,actor:'a',id:1}:kind==='prepare'?{action:kind,actor:'manager',amountRaw:'100'}:{action:'settle',actor:'executor'};
 let record:MainnetReview,captured:string|undefined,unknown=false,lost=false,behind=false,failed=false;
 function product(){return{id:fund,network:MAINNET_NETWORK,ledger:behind?100:101,token:denomination,totalShares:'100',freeShares:'100',requestsTruncated:false,requests:[],portfolioPolicy:{routes:[{asset,router}]},readSource:{kind:'mainnet-rpc-readonly',network:MAINNET_NETWORK,codeHash:profile.codeHash,verificationMode:'live',capturedAt:new Date(clock).toISOString()},catalogPosition:{owner,arkaId:fund,complete:true,stale:false,codeHash:profile.codeHash,ledger:behind?100:101,totalShares:'100',denominationContract:denomination,requests:[],position:{owner,freeSharesRaw:'100',pendingSharesRaw:'0',claimableAssetsRaw:'0',paidAssetsRaw:'0'}}};}
 function rawReceipt(encoded=captured!,status=failed?'FAILED':'SUCCESS',fee='21000'){
  const result=status==='SUCCESS'?backendSdk.xdr.TransactionResultResult.txSuccess([]):backendSdk.xdr.TransactionResultResult.txFailed([]);
  return{status,ledger:101,envelopeXdr:encoded,resultXdr:new backendSdk.xdr.TransactionResult({feeCharged:backendSdk.xdr.Int64.fromString(fee),result,ext:new backendSdk.xdr.TransactionResultExt(0)}).toXDR('base64')};
 }
 const wallet={getAddress:vi.fn(async()=>address),getNetworkPassphrase:vi.fn(async()=>network),signTransaction:vi.fn(async(encoded:string)=>sign(encoded,key))};
 const gateway={
  profile:vi.fn(async()=>({...profile})),
  prepare:vi.fn(async(intent:MainnetIntent)=>{
   const frame={source:owner,sequence:'7',network:MAINNET_NETWORK,mode:'live',releaseId:profile.releaseId,codeHash:profile.codeHash,timestamp:clock/1000,ledger:100,identity:{wasmHash:profile.codeHash,liveUntilLedger:1000},product:product(),factoryLive:true,registrarAllowed:true,codeAvailable:true};
   record=await prepareMainnetReview({intent,source:owner,network:MAINNET_NETWORK,frame,profile,operations,now:clock,reader:{withdrawalPlan:async()=>step,recheck:async()=>frame,simulate:async(tx:any)=>{
    const invocation=tx.operations[0].func.invokeContract();
    const auth=new backendSdk.xdr.SorobanAuthorizationEntry({credentials:backendSdk.xdr.SorobanCredentials.sorobanCredentialsSourceAccount(),rootInvocation:new backendSdk.xdr.SorobanAuthorizedInvocation({function:backendSdk.xdr.SorobanAuthorizedFunction.sorobanAuthorizedFunctionTypeContractFn(invocation),subInvocations:[]})});
    return{latestLedger:100,minResourceFee:'1000',transactionData:new backendSdk.SorobanDataBuilder().setResourceFee('1000').build().toXDR('base64'),results:[{xdr:backendSdk.nativeToScVal(kind==='settle'?{settled_shares:1n}:1n).toXDR('base64'),auth:[auth.toXDR('base64')]}]};
   }}}) as MainnetReview;return record;
  }),
  // State/admission recheck is a double here; its real implementation has the R12 backend tests.
  recheck:vi.fn(async(id:string)=>({id,source:owner,fund,network:MAINNET_NETWORK,releaseId:profile.releaseId,codeHash:profile.codeHash,valid:true as const,canSubmit:false as const})),
  receipt:vi.fn(async(id:string,source:string)=>{
   if(id!==record.id||source!==owner)throw Error('RECEIPT_CONTEXT_CHANGED');
   const checked=inspectMainnetReceipt(unknown||!captured?{status:'NOT_FOUND'}:rawReceipt(),record,{now:clock});
   if(checked.status!=='confirmed')return checked;
   try{return{...reconcileCatalogReceipt(checked,product(),{owner,fund,releaseId:profile.releaseId,codeHash:profile.codeHash,mode:'live',now:clock}),id,confirmationOnly:true,canRetrySubmission:false};}
   catch{return{...checked,status:'catalog-pending',confirmationOnly:true,canRetrySubmission:false};}
  }),
 };
 const wire={getNetwork:vi.fn(async()=>({passphrase:MAINNET_NETWORK})),sendTransaction:vi.fn(async(tx:Transaction)=>{
  // IN-MEMORY CAPTURE ONLY. No RPC client, network request or ledger submission exists.
  captured=tx.toXDR();if(lost)throw Error('SYNTHETIC_LOST_REPLY');return{status:'PENDING',hash:tx.hash().toString('hex')};
 })};
 const transport=()=>createMainnetExecutionTransport({fund,walletAddress:owner,wallet,profile,gateway:gateway as ConnectorGateway,serverFactory:()=>wire as any,now:()=>clock,isCurrent:()=>selected});
 const execute=()=>executeMainnetWalletAction(action,wallet,transport(),{expectedAddress:owner,expectedFund:fund,now:()=>clock,isCurrent:()=>selected});
 return{key,owner,fund,profile,action,wallet,gateway,wire,transport,execute,product,rawReceipt,get review(){return record;},get captured(){return captured;},setCaptured:(value:string)=>{captured=value;},setUnknown:(v:boolean)=>{unknown=v;},setLost:(v:boolean)=>{lost=v;},setBehind:(v:boolean)=>{behind=v;},setFailed:(v:boolean)=>{failed=v;},expire:()=>{clock+=61000;},switchWallet:()=>{address=Keypair.random().publicKey();},switchNetwork:()=>{network=Networks.TESTNET;},switchFund:()=>{selected=false;}};
}
beforeEach(()=>{vi.stubEnv('NEXT_PUBLIC_MAINNET_EXECUTION_ENABLED','1');vi.stubGlobal('fetch',vi.fn(()=>{throw Error('CRYPTO_TEST_NETWORK_FORBIDDEN');}));});
afterEach(()=>{vi.restoreAllMocks();vi.unstubAllEnvs();vi.unstubAllGlobals();});

describe.skipIf(!enabled)('Mainnet ephemeral cryptography',()=>{
 it.each(actions)('verifies the real source signature and receipt for %s',async kind=>{
  expect(vi.isMockFunction(Keypair.prototype.verify)).toBe(false);
  const f=fixture(kind),result=await f.execute();expect(result.ok).toBe(true);expect(result.catalogPending).toBe(false);
  expect(f.wallet.signTransaction).toHaveBeenCalledOnce();expect(f.gateway.recheck).toHaveBeenCalledOnce();expect(f.wire.sendTransaction).toHaveBeenCalledOnce();
  const tx=parse(f.captured!);expect(tx.source).toBe(f.owner);expect(tx.signatures).toHaveLength(1);expect(Keypair.fromPublicKey(f.owner).verify(tx.hash(),tx.signatures[0].signature())).toBe(true);expect(fetch).not.toHaveBeenCalled();
 });
 const changes=[
  ['another source signer',(encoded:string,f:ReturnType<typeof fixture>)=>sign(encoded,Keypair.random())],
  ['another network hash',(encoded:string,f:ReturnType<typeof fixture>)=>sign(encoded,f.key,Networks.TESTNET)],
  ['a valid signature over a changed fee',(encoded:string,f:ReturnType<typeof fixture>)=>sign(altered(encoded,body=>body.fee(body.fee()+1)),f.key)],
  ['a valid signature over a changed destination',(encoded:string,f:ReturnType<typeof fixture>)=>sign(altered(encoded,body=>body.operations()[0].body().invokeHostFunctionOp().hostFunction().invokeContract().contractAddress(Address.fromString(contract(20)).toScAddress())),f.key)],
  ['a valid signature over changed authorization',(encoded:string,f:ReturnType<typeof fixture>)=>sign(altered(encoded,body=>body.operations()[0].body().invokeHostFunctionOp().auth([])),f.key)],
  ['a body changed after signing',(encoded:string,f:ReturnType<typeof fixture>)=>altered(sign(encoded,f.key),body=>body.fee(body.fee()+1))],
  ['a corrupted signature',(encoded:string,f:ReturnType<typeof fixture>)=>{const tx=parse(sign(encoded,f.key)),signature=Buffer.from(tx.signatures[0].signature());signature[0]^=1;tx.signatures[0].signature(signature);return tx.toXDR();}],
  ['an unsigned response',(encoded:string)=>encoded],
  ['a zero-filled signature',(encoded:string)=>{const tx=parse(encoded);tx.signatures.push(new xdr.DecoratedSignature({hint:Buffer.alloc(4),signature:Buffer.alloc(64)}));return tx.toXDR();}],
  ['an additional signature',(encoded:string,f:ReturnType<typeof fixture>)=>{const tx=parse(sign(encoded,f.key));tx.sign(Keypair.random());return tx.toXDR();}],
  ['a signed fee bump',(encoded:string,f:ReturnType<typeof fixture>)=>{const outer=TransactionBuilder.buildFeeBumpTransaction(f.owner,'100',parse(sign(encoded,f.key)),MAINNET_NETWORK);outer.sign(f.key);return outer.toXDR();}],
 ] as const;
 it.each(changes)('rejects %s before any wire call',async(_name,change)=>{const f=fixture();f.wallet.signTransaction.mockImplementation(async encoded=>change(encoded,f));await expect(f.execute()).rejects.toThrow();expect(f.gateway.recheck).not.toHaveBeenCalled();expect(f.wire.sendTransaction).not.toHaveBeenCalled();expect(fetch).not.toHaveBeenCalled();});
 it.each(['expiry','wallet','network','fund','activation','stale-plan'] as const)('blocks %s changed after a real signature',async kind=>{
  const f=fixture();f.wallet.signTransaction.mockImplementation(async encoded=>{const signed=sign(encoded,f.key);if(kind==='expiry')f.expire();if(kind==='wallet')f.switchWallet();if(kind==='network')f.switchNetwork();if(kind==='fund')f.switchFund();if(kind==='activation')f.profile.executionEnabled=false;if(kind==='stale-plan')f.gateway.recheck.mockRejectedValue(Error('WITHDRAWAL_PLAN_CHANGED'));return signed;});
  await expect(f.execute()).rejects.toThrow();expect(f.wallet.signTransaction).toHaveBeenCalledOnce();expect(f.wire.sendTransaction).not.toHaveBeenCalled();
 });
 it('verifies a failed receipt with a real public signature',async()=>{const f=fixture();f.setFailed(true);const prepared=await f.transport().prepare(f.action);f.setCaptured(sign(prepared.xdr,f.key));const receipt=await readExecutionReceipt(prepared.id,f.owner,f.fund,f.gateway as ConnectorGateway);expect(receipt?.ok).toBe(false);expect(receipt?.catalogPending).toBe(false);expect(f.wire.sendTransaction).not.toHaveBeenCalled();});
 it('retains a signed but unindexed receipt until catalog reconciliation',async()=>{const f=fixture();f.setBehind(true);expect((await f.execute()).catalogPending).toBe(true);f.setBehind(false);vi.stubEnv('NEXT_PUBLIC_MAINNET_EXECUTION_ENABLED','0');const result=await readExecutionReceipt(f.review.id,f.owner,f.fund,f.gateway as ConnectorGateway);expect(result?.catalogPending).toBe(false);expect(f.wire.sendTransaction).toHaveBeenCalledOnce();});
 it('recovers an ambiguous signed action after reload without repeating the write',async()=>{const f=fixture(),t=f.transport();f.setLost(true);f.setUnknown(true);await expect(executeMainnetWalletAction(f.action,f.wallet,t,{expectedAddress:f.owner,expectedFund:f.fund})).rejects.toBeInstanceOf(ManagedConfirmationUnknown);await expect(t.submit(f.review.id,f.captured!)).rejects.toThrow('unknown');f.setUnknown(false);vi.stubEnv('NEXT_PUBLIC_MAINNET_EXECUTION_ENABLED','0');expect((await readExecutionReceipt(f.review.id,f.owner,f.fund,f.gateway as ConnectorGateway))?.ok).toBe(true);expect(f.wire.sendTransaction).toHaveBeenCalledOnce();expect(f.wallet.signTransaction).toHaveBeenCalledOnce();});
 it('keeps an expired missing receipt confirmation-only',async()=>{const f=fixture();await f.transport().prepare(f.action);f.expire();const result=await f.gateway.receipt(f.review.id,f.owner);expect(result.status).toBe('unknown');expect(result.canRetrySubmission).toBe(false);expect(result.confirmationOnly).toBe(true);expect(f.wire.sendTransaction).not.toHaveBeenCalled();});
 it.each(['another-signer','changed-body','status','fee','ledger'] as const)('rejects a cryptographic receipt with invalid %s',async kind=>{const f=fixture();const prepared=await f.transport().prepare(f.action);let encoded=sign(prepared.xdr,f.key);if(kind==='another-signer')encoded=sign(prepared.xdr,Keypair.random());if(kind==='changed-body')encoded=sign(altered(prepared.xdr,body=>body.fee(body.fee()+1)),f.key);const raw=f.rawReceipt(encoded);if(kind==='status')raw.status='FAILED';if(kind==='fee')raw.resultXdr=f.rawReceipt(encoded,'SUCCESS','21001').resultXdr;if(kind==='ledger')raw.ledger=99;expect(()=>inspectMainnetReceipt(raw,f.review)).toThrow();expect(f.wire.sendTransaction).not.toHaveBeenCalled();});
 it('rejects a forged verified-receipt flag without the backend verification handle',async()=>{const f=fixture();expect(()=>reconcileCatalogReceipt({status:'confirmed',publicSignatureVerified:true,network:MAINNET_NETWORK},f.product(),{})).toThrow('VERIFIED_RECEIPT_HANDLE_REQUIRED');});
 it('keeps Noah excluded before profile reads, wallet signing or RPC construction',()=>{const f=fixture(),factory=vi.fn();expect(()=>createMainnetExecutionTransport({fund:NOAH_V2,walletAddress:f.owner,wallet:f.wallet,profile:f.profile,gateway:f.gateway as ConnectorGateway,serverFactory:factory})).toThrow('not enabled');expect(factory).not.toHaveBeenCalled();expect(f.gateway.profile).not.toHaveBeenCalled();expect(f.wallet.signTransaction).not.toHaveBeenCalled();});
 it('keeps execution disabled without explicit activation',()=>{const f=fixture();vi.stubEnv('NEXT_PUBLIC_MAINNET_EXECUTION_ENABLED','0');expect(f.transport).toThrow('disabled');expect(f.wallet.signTransaction).not.toHaveBeenCalled();expect(f.wire.sendTransaction).not.toHaveBeenCalled();});
});
