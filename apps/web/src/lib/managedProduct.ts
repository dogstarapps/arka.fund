import {GENERAL_MAINNET,generalRead} from './generalMainnet';
import {formatUnits} from './managedWithdrawals';
import {readMainnetCatalogFund} from './mainnetWalletConnector';
import {withManagedCatalogPosition} from './managedCatalog';
import {StrKey} from '@stellar/stellar-sdk';
export const MANAGED_PRODUCT_LOCAL=process.env.NEXT_PUBLIC_MANAGED_PRODUCT_LOCAL==='1';
export const MANAGED_CATALOG_READ_ONLY=process.env.NEXT_PUBLIC_MANAGED_CATALOG_READ_ONLY==='1';
export function humanDuration(raw:string){const seconds=BigInt(raw);for(const [unit,scale] of [['day',86400],['hour',3600],['minute',60]] as const){if(seconds>BigInt(0)&&seconds%BigInt(scale)===BigInt(0)){const n=seconds/BigInt(scale);return `${n} ${unit}${n===BigInt(1)?'':'s'}`;}}return `${seconds} seconds`;}
export type ProductRequest={id:string;owner:string;pending_shares:string;claimable_assets:string;claimed_assets:string;cancelled_shares:string;eligible_at:string};
export type ProductFund={nativeAvailableRaw?:string;id:string;name:string;symbol:string;manager:string;token:string;network:string;clock:number;ledger:number;freeShares:string;totalShares:string;
 withdrawalHistory?:{observationId:string;codeHash:string;owner:string;ledger:number;closedCount:number;closedPaidAssetsRaw:string};
 readSource?:{kind:'standalone-rpc'|'mainnet-rpc-readonly';network:string;codeHash:string;capturedAt:string;transactionsSubmitted:0;verificationMode?:'live'|'recorded-mainnet-replay'};
 catalog?:{observationId:string;indexedAt:string;ledger:number;owner:string;complete:true;valuationTotalShares?:string;feePreview?:import('@/lib/feePreview').FeePreview|null};
 portfolioPolicy?:null|{instant_cash:boolean;auto_payout:boolean;max_slippage_bps:number;cancel_lock_seconds:string;routes:{asset:string;router:string}[]};
 holdings?:{asset:string;symbol:string;cash:string}[];
 depositAssets?:null|{asset:string;symbol:string;balance:string;allowance:string;native:boolean}[];
 depositError?:string|null;fees?:null|{mgmt_bps:number;perf_bps:number;deposit_bps:number;redeem_bps:number};
 depositProtectionVersion?:number|null;
 policy:{epoch_seconds:string;manager_window:string;min_request_shares:string;buffer_bps:number};
 queue:{pending_shares:string;reserved_assets:string};requests:ProductRequest[];requestsTruncated:boolean;valuationError:string|null;
 status:null|{nav:string;total_shares:string;cash:string;settle_capacity:string}};

/** Policy-driven capabilities; never infer them from a fund name or denomination. */
export function cancellationAllowed(fund:ProductFund,request:ProductRequest){
 if(BigInt(request.pending_shares)<=BigInt(0))return false;
 if(!fund.portfolioPolicy)return true;
 const now=BigInt(fund.clock),eligible=BigInt(request.eligible_at),lock=BigInt(fund.portfolioPolicy.cancel_lock_seconds);
 return now<eligible||now>=eligible+lock;
}
export function instantWithdrawalCapacity(fund:ProductFund):bigint{
 if(!fund.portfolioPolicy?.instant_cash||!fund.status||BigInt(fund.queue.pending_shares)>BigInt(0)||fund.requestsTruncated)return BigInt(0);
 const nav=BigInt(fund.status.nav),total=BigInt(fund.status.total_shares);
 if(nav<=BigInt(0)||total<=BigInt(0))return BigInt(0);
 const capacity=BigInt(fund.status.settle_capacity),owned=BigInt(fund.freeShares);
 const shares=capacity*total/nav;
 return (shares<owned?shares:owned)*nav/total;
}
export type ProductPortfolio={funds:ProductFund[];truncated:boolean;errors:{error:string}[]};
export const units=(raw:string)=>formatUnits(BigInt(raw),7).replace(/\.?0+$/,'')||'0';
export function totals(fund:ProductFund){
 const pending=fund.requests.reduce((n,r)=>n+BigInt(r.pending_shares),BigInt(0));
 const claimable=fund.requests.reduce((n,r)=>n+BigInt(r.claimable_assets),BigInt(0));
 const owned=BigInt(fund.freeShares)+pending;
 const value=owned===BigInt(0)?claimable:fund.status&&BigInt(fund.status.total_shares)>BigInt(0)?owned*BigInt(fund.status.nav)/BigInt(fund.status.total_shares)+claimable:null;
 return {pending,claimable,value,hasPosition:owned>BigInt(0)||claimable>BigInt(0)};
}
export type ProductCreation={network:string;factory:string;config:{templateHash:string;denomination:string;router:string;mgmtBps:number;perfBps:number;depositBps:number};policy:ProductFund['policy'];portfolioPolicy:NonNullable<ProductFund['portfolioPolicy']>;assets:{asset:string;symbol:string}[];creationFee:string;depositProtectionVersion?:number|null};
export function validateDeposit(fund:ProductFund,asset:string,amount:string){
 const selected=fund.depositAssets?.find(a=>a.asset===asset);
 if(!fund.portfolioPolicy||!fund.fees||fund.depositError||!selected||fund.valuationError)throw Error('Deposit details unavailable. Refresh before reviewing.');
 if(fund.depositProtectionVersion!==1&&amount!=='0')throw Error('This Arka does not support protected deposits. Deposits are paused; withdrawals remain available.');
 const raw=BigInt(amount);
 if(raw<=BigInt(0)||raw>=(BigInt(1)<<BigInt(127)))throw Error('Invalid deposit amount.');
 const available=GENERAL_MAINNET&&selected.native?(fund.nativeAvailableRaw===undefined?null:BigInt(fund.nativeAvailableRaw)):BigInt(selected.balance)-(selected.native?BigInt(20000000):BigInt(0));
 if(available===null)throw Error('Current account reserves are unavailable. Refresh before reviewing.');
 if(raw>available)throw Error(GENERAL_MAINNET?'Amount exceeds the balance available after account reserves and liabilities.':selected.native?'Keep at least 2 local XLM for transaction fees and account reserves.':'Amount exceeds your wallet balance.');
 return {selected,needsApproval:BigInt(selected.allowance)!==raw};
}
/** Round UP, so integer rounding never weakens the reviewed minimum. */
export function minimumDepositShares(quoteRaw:string,toleranceBps:number){
 if(!/^[1-9]\d*$/.test(quoteRaw)||quoteRaw.length>39||BigInt(quoteRaw)>=(BigInt(1)<<BigInt(127)))throw Error('Invalid share estimate.');
 if(![0,50,100].includes(toleranceBps))throw Error('Unsupported share tolerance.');
 return ((BigInt(quoteRaw)*BigInt(10000-toleranceBps)+BigInt(9999))/BigInt(10000)).toString();
}
export function withdrawalProgressNotice(fund:ProductFund,id:string){
 const request=fund.requests.find(r=>r.id===id);
 if(!request)return fund.withdrawalHistory&&fund.catalog?.complete&&!fund.requestsTruncated?'Check your withdrawals for the latest status.':null;
 if(BigInt(request.pending_shares)>BigInt(0))return BigInt(request.claimed_assets)>BigInt(0)||BigInt(request.claimable_assets)>BigInt(0)?'Withdrawal partially settled. The remainder is still awaiting liquidity.':'Withdrawal requested. Processing starts after the cutoff, subject to available liquidity.';
 if(BigInt(request.claimable_assets)>BigInt(0))return fund.portfolioPolicy?.auto_payout?'Withdrawal settled. Automatic delivery is pending; you can also collect the reserved amount.':'Withdrawal settled. Your reserved funds are ready to collect.';
 if(BigInt(request.claimed_assets)>BigInt(0))return `Withdrawal paid: ${units(request.claimed_assets)} ${fund.symbol} sent to your wallet.${BigInt(request.cancelled_shares)>BigInt(0)?' The unsettled remainder was cancelled.':''}`;
 if(BigInt(request.cancelled_shares)>BigInt(0))return 'Withdrawal cancelled. Unsettled shares have returned to your investment.';
 return null;
}
export async function productRead<T>(path:'portfolio'|'fund'|'status'|'creation',params:Record<string,string>={},signal?:AbortSignal):Promise<T>{
 if(MANAGED_CATALOG_READ_ONLY&&(path==='fund'||path==='portfolio')&&!StrKey.isValidEd25519PublicKey(params.owner??''))throw Error('An explicit valid public owner is required. No personal position was assumed.');
 if(GENERAL_MAINNET){
  if(path==='creation')return generalRead('profile',{},signal) as Promise<T>;
  const value=await generalRead(path,params,signal);
  if(path==='fund'){const account=await generalRead('account',{owner:params.owner},signal);if(account.owner!==params.owner||account.network!==value.network)throw Error('Account identity changed.');return {...withManagedCatalogPosition(value,params.owner,value.catalogPosition,Date.now()),nativeAvailableRaw:account.nativeAvailableRaw} as T;}
  return value as T;
 }
 const connectorFund=process.env.NEXT_PUBLIC_MAINNET_CONNECTOR_READONLY==='1'&&path==='fund';
 const response=connectorFund?null:await fetch(`${process.env.NEXT_PUBLIC_V3_MAINNET_READONLY==='1'?'/api/managed-mainnet':'/api/managed-local'}/${path}?${new URLSearchParams(params)}`,{cache:'no-store',signal});
 const value=connectorFund?await readMainnetCatalogFund(params.fund,params.owner,signal):await response!.json();if(response&&!response.ok){
  if(path==='fund'&&response.status===404)throw Error('This Arka is unavailable in the local catalog. It may still exist; check the local node and refresh.');
  throw Error(typeof value.error==='string'?value.error:'Local ledger unavailable. Holdings have not been treated as zero.');
 }
 if(MANAGED_CATALOG_READ_ONLY&&(path==='fund'||path==='portfolio')){
  const owner=params.owner;
  if(!owner)throw Error('A public owner is required for the candidate catalog.');
  const replayNow=(v:ProductFund&{replaySource?:{kind:string;releaseSha256:string;capturedAt:string}})=>{
   if(v.readSource?.kind==='mainnet-rpc-readonly'&&v.readSource.verificationMode==='live')return Date.now();if(process.env.NEXT_PUBLIC_MANAGED_SNAPSHOT_REPLAY!=='1')return Date.now();
   if(!v.replaySource||v.replaySource.kind!=='historical-public-snapshot'||v.replaySource.releaseSha256!==process.env.NEXT_PUBLIC_MANAGED_SNAPSHOT_RELEASE_SHA||v.replaySource.capturedAt!==new Date(v.clock*1000).toISOString())throw Error('Snapshot replay identity unavailable.');
   return v.clock*1000;
  };
  if(path==='fund')return withManagedCatalogPosition(value,owner,value.catalogPosition,replayNow(value)) as T;
  if(!Array.isArray(value.funds))throw Error('Candidate catalog unavailable.');
  return {...value,funds:value.funds.map((f:ProductFund&{catalogPosition:unknown})=>withManagedCatalogPosition(f,owner,f.catalogPosition,replayNow(f)))} as T;
 }
 return value;
}
export type PendingProductReceipt={id:string;fund:string;owner:string;action:string;expiresAt:number;targetFund?:string};
export const pendingReceiptKey=(fund:string,owner:string)=>`arka:${GENERAL_MAINNET?'mainnet':'standalone'}:withdrawal:${fund}:${owner}`;
export function saveProductReceipt(receipt:PendingProductReceipt){
 const previous=readProductReceipt(receipt.fund,receipt.owner);
 if(previous&&previous.id!==receipt.id)throw Error('A previous transaction still needs confirmation. Check its receipt before preparing another action.');
 localStorage.setItem(pendingReceiptKey(receipt.fund,receipt.owner),JSON.stringify(receipt));
}
/** A late result must never remove another transaction's recovery receipt. */
export function clearProductReceipt(receipt:PendingProductReceipt){
 let current:PendingProductReceipt|null;try{current=readProductReceipt(receipt.fund,receipt.owner);}catch{return false;}
 if(current?.id!==receipt.id)return false;
 localStorage.removeItem(pendingReceiptKey(receipt.fund,receipt.owner));return true;
}
export function readProductReceipt(fund:string,owner:string):PendingProductReceipt|null{
 const text=localStorage.getItem(pendingReceiptKey(fund,owner));if(!text)return null;
 let receipt:PendingProductReceipt;try{receipt=JSON.parse(text) as PendingProductReceipt;if(!receipt||typeof receipt!=='object')throw Error();}catch{throw Error('Stored receipt is invalid. Review it before any new transaction.');}
 if(receipt.fund!==fund||receipt.owner!==owner||!/^[a-f0-9]{64}$/.test(receipt.id)||(receipt.targetFund!==undefined&&!StrKey.isValidContract(receipt.targetFund)))throw Error('Stored receipt is invalid. Review it before any new transaction.');return receipt;
}
