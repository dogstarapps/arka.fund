/** Mainnet read/preparation adapter. No signer or broadcaster capability. */
import type {ProductFund} from './managedProduct';
import {Transaction,TransactionBuilder,Address,scValToNative} from '@stellar/stellar-sdk';
export const MAINNET_NETWORK='Public Global Stellar Network ; September 2015';
export type ReadOnlyWallet={getAddress:()=>Promise<string>;getNetworkPassphrase:()=>Promise<string>};
export type MainnetIntent={action:string;fund:string;[key:string]:unknown};
export type MainnetProfile={releaseId:string;codeHash:string;network?:string;endpoint?:string;mainnetApproved?:boolean;executionEnabled?:boolean;factory?:string;templateHash?:string;denomination?:string;router?:string;assets?:string[];assetSymbols?:Record<string,string>;commercialFeeUsdcRaw?:string;creationFeeConfigured?:boolean};
export type MainnetReview={id:string;source:string;fund:string;network:string;releaseId:string;codeHash:string;unsignedEnvelope:string;expiresAt:number;readyForSignature:false;canSubmit:false;mode:'live'|'recorded-mainnet-replay';totalFeeRaw:string;ledger:number;intent:MainnetIntent};
export type MainnetReceipt={status:string;id:string;confirmationOnly:true;canRetrySubmission:false;source?:string;fund?:string;network?:string;publicSignatureVerified?:boolean;receipt?:{id:string;source:string;fund:string;network:string;publicSignatureVerified:boolean}};
export type ConnectorGateway={prepare:(intent:MainnetIntent,source:string,network:string)=>Promise<MainnetReview>;receipt:(id:string,source:string)=>Promise<MainnetReceipt>;recheck?:(id:string,source:string)=>Promise<{id:string;source:string;fund:string;network:string;releaseId:string;codeHash:string;valid:true;canSubmit:false}>;profile?:()=>Promise<MainnetProfile>};
function validPublicKey(value:string){return /^G[A-Z2-7]{55}$/.test(value);}
async function request(kind:string,params:Record<string,string>,signal?:AbortSignal){
 const response=await fetch('/api/mainnet-connector/'+kind+'?'+new URLSearchParams(params),{cache:'no-store',signal});
 const value=await response.json();if(!response.ok)throw Error(typeof value.message==='string'?value.message:'Review unavailable. Nothing was signed or submitted.');return value;
}
export function mainnetGateway():ConnectorGateway{return {
 prepare:(intent,source,network)=>request('prepare',{intent:JSON.stringify(intent),source,network}),
 receipt:(id,source)=>request('receipt',{id,source}),
 recheck:(id,source)=>request('recheck',{id,source}),
 profile:async()=>{const {profile}=await request('profile',{});return{...profile,codeHash:profile.v3Wasm};},
};}
export async function prepareMainnetWalletReview(wallet:ReadOnlyWallet,intent:MainnetIntent,profile:MainnetProfile,gateway=mainnetGateway(),now=Date.now){
 const source=await wallet.getAddress(),network=await wallet.getNetworkPassphrase();
 if(!validPublicKey(source)||network!==MAINNET_NETWORK)throw Error('Select your Stellar mainnet wallet before reviewing.');
 const review=await gateway.prepare(intent,source,network);
 if(await wallet.getAddress()!==source||await wallet.getNetworkPassphrase()!==network)throw Error('Wallet changed. Review again.');
 if(review.source!==source||review.network!==network||review.fund!==intent.fund||review.releaseId!==profile.releaseId||review.codeHash!==profile.codeHash||review.readyForSignature!==false||review.canSubmit!==false||review.expiresAt<=now()||!/^\d+$/.test(review.totalFeeRaw)||BigInt(review.totalFeeRaw)>BigInt(10000000))throw Error('Review changed or expired. Nothing was signed or submitted.');
 const tx=TransactionBuilder.fromXDR(review.unsignedEnvelope,MAINNET_NETWORK);
 if(!(tx instanceof Transaction)||tx.signatures.length||tx.memo.type!=='none'||tx.source!==source||tx.hash().toString('hex')!==review.id||tx.operations.length!==1||tx.fee!==review.totalFeeRaw||Number(tx.timeBounds?.maxTime)*1000!==review.expiresAt||JSON.stringify(review.intent)!==JSON.stringify(intent))throw Error('Transaction details changed. Review again.');
 const op=tx.operations[0];if(op.type!=='invokeHostFunction'||op.source||op.func.switch().name!=='hostFunctionTypeInvokeContract')throw Error('Transaction details changed. Review again.');
 const invocation=op.func.invokeContract(),target=Address.fromScAddress(invocation.contractAddress()).toString(),method=String(invocation.functionName()),args=invocation.args().map(scValToNative);
 if((op.auth??[]).some(auth=>auth.credentials().switch().name!=='sorobanCredentialsSourceAccount'||auth.rootInvocation().function().switch().name!=='sorobanAuthorizedFunctionTypeContractFn'||auth.rootInvocation().function().contractFn().toXDR('base64')!==invocation.toXDR('base64')))throw Error('Transaction authorization changed. Review again.');
 const methods:Record<string,string>={approve:'approve',deposit:'deposit_protected',request:'request_withdrawal',instant:'redeem_liquid',cancel:'cancel_withdrawal',claim:'claim_withdrawal',prepare:'prepare_withdrawal_liquidity',settle:'settle_withdrawals','portfolio-swap':'rebalance','recover-spot':'liquidate_withdrawal',create:'create_managed_routes'};
 if(method!==methods[intent.action]||target!==(intent.action==='approve'?intent.asset:intent.action==='create'?profile.factory:intent.fund))throw Error('Transaction destination changed. Review again.');
 if(['deposit','request','instant','cancel','claim','prepare','portfolio-swap','recover-spot'].includes(intent.action)&&args[0]!==source)throw Error('Transaction owner changed. Review again.');
 if(intent.action==='approve'&&(args[0]!==source||args[1]!==intent.fund||String(args[2])!==intent.amountRaw||Number(args[3])!==review.ledger+120))throw Error('Authorization changed. Review again.');
 if(intent.action==='deposit'&&(args[1]?.contract!==intent.asset||String(args[2])!==intent.amountRaw||String(args[3])!==intent.minSharesRaw))throw Error('Deposit protection changed. Review again.');
 if(['request','instant'].includes(intent.action)&&String(args[1])!==intent.sharesRaw)throw Error('Withdrawal amount changed. Review again.');
 if(['cancel','claim'].includes(intent.action)&&String(args[1])!==intent.requestId)throw Error('Withdrawal request changed. Review again.');
 if(intent.action==='prepare'&&String(args[1])!==intent.amountRaw)throw Error('Liquidity amount changed. Review again.');
 if(intent.action==='settle'&&Number(args[0])!==16)throw Error('Settlement review changed. Review again.');
 const canonical=(value:unknown):string=>JSON.stringify(value,(_key,item)=>typeof item==='bigint'?item.toString():item&&typeof item==='object'&&!Array.isArray(item)?Object.fromEntries(Object.keys(item).sort().map(key=>[key,item[key]])):item);
 if(intent.action==='portfolio-swap'&&canonical(args[1])!==canonical([intent.step]))throw Error('Portfolio route or minimum changed. Review again.');
 if(intent.action==='recover-spot'&&canonical(args[1])!==canonical(intent.step))throw Error('Withdrawal route or minimum changed. Review again.');
 if(intent.action==='create'){
  const draft=intent.draft as {saltHex:string;fees:Record<string,number>;denominationContract:string;routerId:string;whitelistContracts:string[];templateHash:string;creationFee:{token:string;amountRaw:string}};
  const toHex=(bytes:Uint8Array)=>Array.from(bytes,x=>x.toString(16).padStart(2,'0')).join('');
  if(!profile.templateHash||!profile.denomination||!profile.router||!profile.assets||draft.templateHash!==profile.templateHash||!draft.creationFee||draft.creationFee.token!==profile.assets.find(asset=>profile.assetSymbols?.[asset]==='USDC')||draft.creationFee.amountRaw!==profile.commercialFeeUsdcRaw||args[1]!==source||toHex(args[0])!==draft.saltHex||args[2].denomination!==profile.denomination||args[2].router!==profile.router||toHex(args[2].template_hash)!==profile.templateHash||canonical([...draft.whitelistContracts].sort())!==canonical([...profile.assets].sort())||['mgmt_bps','perf_bps','deposit_bps'].some(key=>Number(args[2][key])!==draft.fees[key])||draft.fees.redeem_bps!==0)throw Error('Creation profile changed. Review again.');
 }
 return Object.freeze(review);
}
export async function confirmMainnetReceiptOnly(review:MainnetReview,wallet:ReadOnlyWallet,gateway=mainnetGateway()){
 const source=await wallet.getAddress(),network=await wallet.getNetworkPassphrase();
 if(source!==review.source||network!==MAINNET_NETWORK||review.network!==network)throw Error('Wallet changed. No transaction was resent.');
 const receipt=await gateway.receipt(review.id,source);
 if(receipt.id!==review.id||receipt.confirmationOnly!==true||receipt.canRetrySubmission!==false||!['unknown','confirmed','failed','catalog-pending','reconciled'].includes(receipt.status))throw Error('Confirmation unavailable. Keep the receipt and do not repeat the action.');
 return receipt;
}
export async function readMainnetCatalogFund(fund:string,owner:string,signal?:AbortSignal):Promise<ProductFund>{
 if(!validPublicKey(owner))throw Error('Choose a public wallet. No position has been assumed.');
 const result=await request('catalog',{fund,owner},signal);
 if(result.network!==MAINNET_NETWORK||result.canSubmit!==false||result.catalogVerified!==true||result.product?.id!==fund||result.product?.catalogPosition?.owner!==owner)throw Error('Investment data could not be verified. Refresh before continuing.');
 return result.product as ProductFund;
}
