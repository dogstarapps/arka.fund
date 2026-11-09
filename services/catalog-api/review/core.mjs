import assert from 'node:assert/strict';
import {sdk,NETWORK} from './sdk.mjs';
export {NETWORK};
export const CAPABILITIES=Object.freeze({read:true,simulate:true,sign:false,submit:false,restore:false,keeper:false});
const hex=bytes=>sdk.hash(bytes).toString('hex');
const acceptedReceipts=new WeakSet();
const freeze=value=>{if(value&&typeof value==='object'){for(const x of Object.values(value))freeze(x);Object.freeze(value);}return value;};
const publicKey=id=>assert(sdk.StrKey.isValidEd25519PublicKey(id),'PUBLIC_OWNER_REQUIRED');
const integer=(raw,allowZero=false)=>{assert(typeof raw==='string'&&/^(0|[1-9]\d*)$/.test(raw)&&raw.length<=39,'RAW_INTEGER_REQUIRED');const n=BigInt(raw);assert(n<(1n<<127n)&&(allowZero?n>=0n:n>0n),'AMOUNT_OUT_OF_RANGE');return n;};
/** Same manager namespace and salted derivation as the accepted factory. */
export function predictCreatedFund(factory,manager,saltHex){
 publicKey(manager);assert(sdk.StrKey.isValidContract(factory)&&/^[a-f0-9]{64}$/.test(saltHex),'CREATION_IDENTITY_REQUIRED');
 const salt=sdk.hash(sdk.xdr.ScVal.scvVec([sdk.Address.fromString(factory).toScVal(),sdk.Address.fromString(manager).toScVal(),sdk.xdr.ScVal.scvBytes(Buffer.from(saltHex,'hex'))]).toXDR());
 const pre=sdk.xdr.ContractIdPreimage.contractIdPreimageFromAddress(new sdk.xdr.ContractIdPreimageFromAddress({address:sdk.Address.fromString(manager).toScAddress(),salt}));
 return sdk.StrKey.encodeContract(sdk.hash(sdk.xdr.HashIdPreimage.envelopeTypeContractId(new sdk.xdr.HashIdPreimageContractId({networkId:sdk.hash(Buffer.from(NETWORK)),contractIdPreimage:pre})).toXDR()));
}
export function assertIntentFund(intent,source,profile){
 assert(sdk.StrKey.isValidContract(intent.fund)&&!profile.legacyIds.includes(intent.fund),'LEGACY_OR_INVALID_FUND_DENIED');
 if(intent.action==='create')assert.equal(intent.fund,predictCreatedFund(profile.factory,source,intent.draft?.saltHex),'CREATION_ADDRESS_CHANGED');
}
function exactKeys(value,keys){assert(value&&typeof value==='object'&&!Array.isArray(value));assert(Object.keys(value).every(k=>keys.includes(k)),'UNKNOWN_INTENT_FIELD');}
export function assertCatalogBinding(value,{owner,fund,releaseId,codeHash,mode,now}){
 publicKey(owner);assert.equal(value.id,fund,'CATALOG_FUND_CHANGED');assert.equal(value.network,NETWORK,'CATALOG_NETWORK_CHANGED');
 assert(value.readSource?.kind==='mainnet-rpc-readonly'&&value.readSource.network===NETWORK&&value.readSource.codeHash===codeHash,'CATALOG_CODE_IDENTITY_REQUIRED');
 assert.equal(value.readSource.verificationMode,mode,'CATALOG_MODE_CHANGED');
 const position=value.catalogPosition;
 assert(position&&position.owner===owner&&position.arkaId===fund&&position.complete===true&&position.stale===false,'COMPLETE_OWNER_INDEX_REQUIRED');
 assert.equal(position.codeHash,codeHash,'POSITION_CODE_CHANGED');assert.equal(position.ledger,value.ledger,'CATALOG_LEDGER_CHANGED');
 assert.equal(position.position?.owner,owner,'POSITION_OWNER_CHANGED');assert.equal(position.position.freeSharesRaw,value.freeShares,'CATALOG_SHARES_CHANGED');
 assert(!value.requestsTruncated&&Array.isArray(value.requests),'COMPLETE_REQUEST_INDEX_REQUIRED');
 assert(Array.isArray(position.requests)&&position.requests.length===value.requests.length,'REQUEST_INDEX_PROJECTION_INCOMPLETE');
 assert(value.requests.every(r=>r.owner===owner),'FOREIGN_REQUEST_OWNER');
 const requestFields=['id','owner','requested_shares','pending_shares','settled_shares','cancelled_shares','claimable_assets','claimed_assets','created_at','eligible_at','last_settled_at'];
 const canonicalRequests=new Map(position.requests.map(row=>[row.id,row]));
 assert.equal(canonicalRequests.size,position.requests.length,'DUPLICATE_CANONICAL_REQUEST_ID');
 const requestIds=new Set();
 let closedPaid=0n;
 if(position.requestsScope!==undefined){
  assert.equal(position.requestsScope,'active','REQUEST_SCOPE_CHANGED');const closed=position.closedRequests;
  assert(closed&&value.requests.length<=4096&&Number.isSafeInteger(closed.count)&&closed.count>=0&&Number.isSafeInteger(position.requestCount)&&position.requestCount===value.requests.length+closed.count,'REQUEST_HISTORY_SUMMARY_INVALID');
  assert(typeof closed.paidAssetsRaw==='string'&&/^(0|[1-9]\d*)$/.test(closed.paidAssetsRaw)&&closed.paidAssetsRaw.length<=60,'PAID_HISTORY_TOTAL_INVALID');closedPaid=BigInt(closed.paidAssetsRaw);
  assert(closedPaid<=BigInt(closed.count)*((1n<<127n)-1n),'PAID_HISTORY_TOTAL_INVALID');
  assert(value.requests.every(row=>BigInt(row.pending_shares)>0n||BigInt(row.claimable_assets)>0n),'TERMINAL_REQUEST_IN_ACTIVE_INDEX');
 }else assert(position.closedRequests===undefined&&position.requestCount===undefined,'REQUEST_HISTORY_SCOPE_REQUIRED');
 for(const row of value.requests){
  assert(!requestIds.has(row.id),'DUPLICATE_REQUEST_ID');requestIds.add(row.id);
  const canonical=canonicalRequests.get(row.id);
  assert(canonical&&requestFields.every(field=>row[field]!==undefined&&row[field]===canonical[field]),'REQUEST_PROJECTION_CHANGED');
 }
 assert.equal(value.totalShares,position.totalShares,'TOTAL_SHARES_CHANGED');assert.equal(value.token,position.denominationContract,'DENOMINATION_CHANGED');
 const sum=field=>value.requests.reduce((total,row)=>total+BigInt(row[field]),0n).toString();
 assert.equal(sum('pending_shares'),position.position.pendingSharesRaw,'PENDING_RIGHTS_CHANGED');assert.equal(sum('claimable_assets'),position.position.claimableAssetsRaw,'RESERVED_RIGHTS_CHANGED');assert.equal((BigInt(sum('claimed_assets'))+closedPaid).toString(),position.position.paidAssetsRaw,'PAID_RIGHTS_CHANGED');
 if(mode==='live')assert(Math.abs(now-Date.parse(value.readSource.capturedAt))<=30000,'CATALOG_STALE');
 else assert(value.replaySource?.releaseSha256===releaseId&&value.replaySource.kind==='historical-public-snapshot','REPLAY_IDENTITY_REQUIRED');
 return value;
}
export function creationFeeTerms(profile){
 const token=profile.assets?.find(asset=>profile.assetSymbols?.[asset]==='USDC'),amountRaw=profile.commercialFeeUsdcRaw;
 assert(sdk.StrKey.isValidContract(token??''),'CREATION_FEE_TOKEN_REQUIRED');integer(amountRaw,true);return {token,amountRaw};
}
export function buildIntentOperation(intent,source,profile,operations,ledger){
 publicKey(source);assert(Number.isSafeInteger(ledger)&&ledger>0);assertIntentFund(intent,source,profile);
 const base=['action','fund'];let op;
 switch(intent.action){
  case 'approve':case 'deposit':{
   exactKeys(intent,[...base,'asset','amountRaw','minSharesRaw']);assert(profile.assets.includes(intent.asset),'ASSET_OUTSIDE_REVIEWED_PROFILE');integer(intent.amountRaw,intent.action==='approve');
   if(intent.action==='deposit'){integer(intent.minSharesRaw);op=operations.managedDepositOperation(intent.fund,source,intent.asset,intent.amountRaw,intent.minSharesRaw);}
   else {assert(intent.minSharesRaw===undefined,'UNKNOWN_INTENT_FIELD');op=operations.managedApproveOperation(intent.fund,source,intent.asset,intent.amountRaw,ledger+120);}break;
  }
  case 'request':case 'instant':exactKeys(intent,[...base,'sharesRaw']);integer(intent.sharesRaw);op=operations.managedWithdrawalOperation(intent.fund,{method:intent.action==='request'?'request_withdrawal':'redeem_liquid',owner:source,sharesRaw:intent.sharesRaw});break;
  case 'cancel':case 'claim':exactKeys(intent,[...base,'requestId']);integer(intent.requestId);op=operations.managedWithdrawalOperation(intent.fund,{method:intent.action==='claim'?'claim_withdrawal':'cancel_withdrawal',owner:source,id:intent.requestId});break;
  case 'prepare':exactKeys(intent,[...base,'amountRaw']);integer(intent.amountRaw);op=operations.managedWithdrawalOperation(intent.fund,{method:'prepare_withdrawal_liquidity',caller:source,amountRaw:intent.amountRaw});break;
  case 'settle':exactKeys(intent,base);op=operations.managedWithdrawalOperation(intent.fund,{method:'settle_withdrawals',maxRequests:16});break;
  case 'portfolio-swap':case 'recover-spot':exactKeys(intent,[...base,'step']);assert(intent.step&&profile.assets.includes(intent.step.asset_in?.contract)&&profile.assets.includes(intent.step.asset_out?.contract)&&intent.step.asset_in.contract!==intent.step.asset_out.contract,'SWAP_ASSET_SCOPE');exactKeys(intent.step,['adapter','pool_id','asset_in','asset_out','amount_in','min_out','router_addr']);exactKeys(intent.step.asset_in,['contract']);exactKeys(intent.step.asset_out,['contract']);assert(profile.approvedRoutes?.some(route=>route.router===intent.step.router_addr&&[intent.step.asset_in.contract,intent.step.asset_out.contract].includes(route.asset)),'SWAP_ROUTE_CHANGED');integer(intent.step.amount_in);integer(intent.step.min_out);if(intent.action==='recover-spot')assert.equal(intent.step.asset_out.contract,profile.denomination,'WITHDRAWAL_DENOMINATION_CHANGED');op=intent.action==='recover-spot'?operations.managedSpotRecoveryOperation(intent.fund,source,intent.step):operations.managedSpotOperation(intent.fund,source,intent.step);break;
  case 'create':{
   exactKeys(intent,[...base,'draft']);const d=intent.draft;exactKeys(d,['saltHex','denominationContract','routerId','fees','whitelistContracts','templateHash','creationFee']);
   assert(/^[a-f0-9]{64}$/.test(d.templateHash),'REVIEWED_TEMPLATE_REQUIRED');exactKeys(d.creationFee,['token','amountRaw']);assert(sdk.StrKey.isValidContract(d.creationFee.token),'CREATION_FEE_TOKEN_REQUIRED');integer(d.creationFee.amountRaw,true);assert(/^[a-f0-9]{64}$/.test(d.saltHex),'CREATION_SALT_REQUIRED');assert(d.denominationContract===profile.denomination&&d.routerId===profile.router,'CREATION_PROFILE_CHANGED');
   assert.deepEqual([...d.whitelistContracts].sort(),[...profile.assets].sort(),'CREATION_ASSETS_CHANGED');
   exactKeys(d.fees,['mgmt_bps','perf_bps','deposit_bps','redeem_bps']);assert(Object.keys(d.fees).length===4&&Object.values(d.fees).every(n=>Number.isInteger(n)&&n>=0&&n<=10000),'CREATION_FEES_INVALID');assert.equal(d.fees.redeem_bps,0,'EXISTING_REDEEM_GUARD');
   const addr=id=>sdk.Address.fromString(id).toScVal(),fields={denomination:addr(profile.denomination),deposit_bps:sdk.nativeToScVal(d.fees.deposit_bps,{type:'i32'}),mgmt_bps:sdk.nativeToScVal(d.fees.mgmt_bps,{type:'i32'}),perf_bps:sdk.nativeToScVal(d.fees.perf_bps,{type:'i32'}),router:addr(profile.router),template_hash:sdk.xdr.ScVal.scvBytes(Buffer.from(d.templateHash,'hex'))};
   const config=sdk.xdr.ScVal.scvMap(Object.entries(fields).sort(([a],[b])=>a.localeCompare(b)).map(([key,val])=>new sdk.xdr.ScMapEntry({key:sdk.xdr.ScVal.scvSymbol(key),val})));
   op=new sdk.Contract(profile.factory).call('create_managed_routes',sdk.xdr.ScVal.scvBytes(Buffer.from(d.saltHex,'hex')),addr(source),config);break;
  }
  default:throw Error('UNSUPPORTED_INTENT');
 }
 return op;
}
export async function prepareMainnetReview({intent,source,network,frame,profile,operations,reader,now=Date.now()}){
 assert.equal(network,NETWORK,'WALLET_NETWORK_CHANGED');publicKey(source);assert.equal(frame.source,source,'WALLET_ACCOUNT_CHANGED');
 assert(frame.network===NETWORK&&frame.releaseId===profile.releaseId&&frame.codeHash===profile.v3Wasm,'RELEASE_IDENTITY_CHANGED');
 assert(Number.isSafeInteger(frame.timestamp)&&Math.abs(Math.floor(now/1000)-frame.timestamp)<=30,'FRESH_MAINNET_FRAME_REQUIRED');
 assert(!frame.ambiguousPreviousSubmission,'CONFIRM_ONLY_NO_RESEND');
 if(intent.action==='create'){assert(frame.factoryLive&&frame.registrarAllowed&&frame.codeAvailable,'FACTORY_CODE_AND_REGISTRAR_NOT_READY');assert.equal(intent.draft?.templateHash,profile.templateHash,'REVIEWED_TEMPLATE_CHANGED');assert.deepEqual(intent.draft?.creationFee,creationFeeTerms(profile),'REVIEWED_CREATION_FEE_CHANGED');}
 else {assert(frame.identity?.wasmHash===profile.v3Wasm&&frame.identity.liveUntilLedger>frame.ledger,'CURRENT_V3_INSTANCE_REQUIRED');assertCatalogBinding(frame.product,{owner:source,fund:intent.fund,releaseId:profile.releaseId,codeHash:profile.v3Wasm,mode:frame.mode,now});}
 const op=buildIntentOperation(intent,source,{...profile,approvedRoutes:frame.product?.portfolioPolicy?.routes},operations,frame.ledger);
 if(intent.action==='recover-spot'){const fresh=await reader.withdrawalPlan();assert(fresh&&operations.sameManagedSpotStep(fresh,intent.step),'WITHDRAWAL_PLAN_CHANGED');}
 const raw=new sdk.TransactionBuilder(new sdk.Account(source,frame.sequence),{fee:'20000',networkPassphrase:NETWORK}).addOperation(op).setTimebounds(Math.floor(now/1000),Math.floor(now/1000)+60).build();
 const simulation=await reader.simulate(raw);
 assert(!simulation.error&&!simulation.restorePreamble&&simulation.results?.length===1&&simulation.transactionData,'SIMULATION_OR_RESTORATION_BLOCKED');
 assert(Number.isSafeInteger(simulation.latestLedger)&&simulation.latestLedger>=frame.ledger&&simulation.latestLedger-frame.ledger<=4,'SIMULATION_LEDGER_CHANGED');
 if(intent.action==='settle'){
  const value=sdk.scValToNative(sdk.xdr.ScVal.fromXDR(simulation.results[0].xdr,'base64'));
  const queueProgress=value?.settled_shares===0n&&operations.managedSettlementCanAdvance(value,frame.product);
  assert(typeof value?.settled_shares==='bigint'&&(value.settled_shares>0n||queueProgress),'NO_ELIGIBLE_WITHDRAWAL_TO_SETTLE');
 }
 const data=sdk.xdr.SorobanTransactionData.fromXDR(simulation.transactionData,'base64');
 if(data.ext().switch().value===1)assert.equal(data.ext().v1().archivedSorobanEntries().length,0,'AUTOMATIC_RESTORATION_SEPARATE');
 const resource=BigInt(simulation.minResourceFee),resourceData=BigInt(data.resourceFee().toString());assert(resource>=0n&&resource===resourceData,'RESOURCE_FEE_CHANGED');
 const auth=(simulation.results[0].auth??[]).map(x=>sdk.xdr.SorobanAuthorizationEntry.fromXDR(x,'base64'));
 assert(auth.every(x=>x.credentials().switch().name==='sorobanCredentialsSourceAccount'),'NON_SOURCE_AUTH_REQUIRES_SEPARATE_REVIEW');
 const invocation=op.body().invokeHostFunctionOp().hostFunction().invokeContract();
 assert(auth.every(x=>x.rootInvocation().function().switch().name==='sorobanAuthorizedFunctionTypeContractFn'&&x.rootInvocation().function().contractFn().toXDR('base64')===invocation.toXDR('base64')),'AUTHORIZATION_ROOT_CHANGED');
 const prepared=new sdk.TransactionBuilder(new sdk.Account(source,frame.sequence),{fee:'20000',networkPassphrase:NETWORK}).addOperation(sdk.Operation.invokeHostFunction({func:op.body().invokeHostFunctionOp().hostFunction(),auth})).setSorobanData(data).setTimebounds(Math.floor(now/1000),Math.floor(now/1000)+60).build();
 assert(BigInt(prepared.fee)===resource+20000n&&BigInt(prepared.fee)<=10000000n,'EXISTING_1_XLM_CAP');
 const end=await reader.recheck();assert(end.source===source&&end.sequence===frame.sequence&&end.network===NETWORK,'ACCOUNT_SEQUENCE_OR_NETWORK_CHANGED');assert(end.codeHash===profile.v3Wasm&&end.ledger>=frame.ledger&&end.ledger-frame.ledger<=4,'CODE_OR_LEDGER_CHANGED');
 assert(intent.action==='create'?end.factoryLive&&end.codeAvailable&&end.registrarAllowed:end.identity?.wasmHash===profile.v3Wasm&&end.identity.liveUntilLedger>end.ledger,'LIVE_DEPENDENCY_CHANGED');
 return freeze({schema:1,network:NETWORK,mode:frame.mode,source,fund:intent.fund,releaseId:profile.releaseId,codeHash:profile.v3Wasm,intent:structuredClone(intent),intentSha256:hex(op.toXDR()),id:prepared.hash().toString('hex'),unsignedEnvelope:prepared.toXDR(),sequence:prepared.sequence,ledger:frame.ledger,capturedAt:frame.timestamp,expiresAt:(Math.floor(now/1000)+60)*1000,inclusionFeeRaw:'20000',resourceFeeRaw:resource.toString(),totalFeeRaw:prepared.fee,readyForSignature:false,canSubmit:false,capabilities:CAPABILITIES,signaturesCreated:0,transactionsSubmitted:0});
}
export function inspectMainnetReceipt(result,review,{now=Date.now()}={}){
 assert(review.network===NETWORK&&review.canSubmit===false&&review.readyForSignature===false,'REVIEW_IDENTITY_REQUIRED');
 if(result.status==='NOT_FOUND')return {status:'unknown',id:review.id,confirmationOnly:true,canRetrySubmission:false,expired:now>review.expiresAt};
 assert(['SUCCESS','FAILED'].includes(result.status)&&Number.isSafeInteger(result.ledger)&&result.ledger>=review.ledger,'RECEIPT_LEDGER_OR_STATUS_INVALID');
 const raw=sdk.xdr.TransactionEnvelope.fromXDR(result.envelopeXdr,'base64');assert.equal(raw.switch().name,'envelopeTypeTx','FEE_BUMP_OR_ENVELOPE_CHANGED');
 const tx=sdk.TransactionBuilder.fromXDR(result.envelopeXdr,NETWORK),expected=sdk.TransactionBuilder.fromXDR(review.unsignedEnvelope,NETWORK);
 assert(tx.source===review.source&&tx.sequence===review.sequence&&tx.hash().toString('hex')===review.id&&tx.hash().equals(expected.hash()),'RECEIPT_BODY_SOURCE_OR_NETWORK_CHANGED');
 assert(tx.signatures.length>0,'PUBLIC_SIGNATURE_REQUIRED');
 // A simple Freighter source signature can be checked independently. Other
 // account authorities need their historical signer-set proof, never a bypass.
 const key=sdk.Keypair.fromPublicKey(review.source);assert(tx.signatures.some(s=>key.verify(tx.hash(),s.signature())),'PUBLIC_SIGNATURE_OR_AUTHORITY_PROOF_REQUIRED');
 const transactionResult=sdk.xdr.TransactionResult.fromXDR(result.resultXdr,'base64');
 const code=transactionResult.result().switch().name;
 assert.equal(result.status==='SUCCESS',code==='txSuccess','RECEIPT_RESULT_CONTRADICTS_STATUS');
 const feeRaw=transactionResult.feeCharged().toString();
 assert(BigInt(feeRaw)>=0n&&BigInt(feeRaw)<=BigInt(tx.fee),'CHARGED_FEE_OUTSIDE_AUTHORIZED_MAXIMUM');
 const receipt=Object.freeze({status:result.status==='SUCCESS'?'confirmed':'failed',id:review.id,source:review.source,fund:review.fund,action:review.intent.action,releaseId:review.releaseId,network:NETWORK,ledger:result.ledger,feeRaw,maximumFeeRaw:tx.fee,publicSignatureVerified:true,confirmationOnly:true,canRetrySubmission:false});acceptedReceipts.add(receipt);return receipt;
}
export function reconcileCatalogReceipt(receipt,product,context){
 assert(acceptedReceipts.has(receipt),'VERIFIED_RECEIPT_HANDLE_REQUIRED');assert.equal(receipt.status,'confirmed','CONFIRMED_RECEIPT_REQUIRED');assert(receipt.publicSignatureVerified&&receipt.network===NETWORK,'RECEIPT_PROOF_REQUIRED');
 assertCatalogBinding(product,{...context,fund:receipt.fund,owner:receipt.source});assert(product.ledger>=receipt.ledger,'CATALOG_BEHIND_RECEIPT');
 return {status:'reconciled',receipt,product,indexComplete:true,canSubmit:false};
}
