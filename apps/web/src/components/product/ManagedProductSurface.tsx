'use client';
import Link from 'next/link';
import {GENERAL_MAINNET,checkGeneralAction,generalDepositQuote,generalPortfolioQuote,generalWithdrawalPlan,generalExecutionAvailable,generalExecutionTransport,generalExecutionReceipt,mainnetWallet} from '@/lib/generalMainnet';
import {mainnetExecutionRequested} from '@/lib/mainnetExecution';
import {ManagedContextHelp} from './ManagedContextHelp';
import {ManagedWithdrawalProcessing} from './ManagedWithdrawalProcessing';
import {ManagedWithdrawalHistory} from './ManagedWithdrawalHistory';
import {useCallback,useEffect,useRef,useState} from 'react';
import {useParams} from 'next/navigation';
import {productRead,totals,units,humanDuration,cancellationAllowed,instantWithdrawalCapacity,validateDeposit,minimumDepositShares,withdrawalProgressNotice,readProductReceipt,saveProductReceipt,clearProductReceipt,type ProductFund,type ProductPortfolio,type PendingProductReceipt} from '@/lib/managedProduct';
import {parseUnits,sharesForAssets,type ManagedWalletAction} from '@/lib/managedWithdrawals';
import {executeManagedWalletAction,executeMainnetWalletAction,ManagedActionRejected,type WalletPhase} from '@/lib/managedWalletFlow';
import {createManagedSorobanTransport,localPortfolioQuote,localDepositQuote} from '@/lib/managedSorobanTransport';
import {productWallet} from '@/lib/managedProductWallet';
import {isPublicWalletAddress} from '@/lib/catalog/walletPositions';
import {MANAGED_CATALOG_READ_ONLY} from '@/lib/managedProduct';
/** Presentation only: never rename a real or user-named Arka. */
export function productDisplayName(fund:ProductFund):string{
 return fund.name;
}
export function productNotice(message:string|null|undefined):string|null|undefined{
 return message;
}
export function useWallet(){
 const [wallet,setWallet]=useState('');
 useEffect(()=>{const sync=()=>{const value=localStorage.getItem('wallet:pubkey')??'';setWallet(isPublicWalletAddress(value)?value:'');};sync();window.addEventListener('wallet:pubkey-changed',sync);window.addEventListener('storage',sync);return()=>{window.removeEventListener('wallet:pubkey-changed',sync);window.removeEventListener('storage',sync);};},[]);return wallet;
}
function usePublicLookup(){
 const [lookup,setLookup]=useState('');
 useEffect(()=>{const address=new URLSearchParams(window.location.search).get('address')??'';if(isPublicWalletAddress(address))setLookup(address);},[]);
 return [lookup,setLookup] as const;
}
function PublicLookup({onView}:{onView:(address:string)=>void}){
 const [value,setValue]=useState(''),[error,setError]=useState('');
 return <details className="surface-panel"><summary>Look up a public wallet without connecting</summary><form className="managed-request-form" onSubmit={e=>{e.preventDefault();if(!isPublicWalletAddress(value.trim())){setError('Enter a valid Stellar public address, never a secret key.');return;}setError('');onView(value.trim());}}><label htmlFor="local-public-wallet">Stellar public address<input id="local-public-wallet" className="ops-input" value={value} onChange={e=>setValue(e.target.value)} autoComplete="off" placeholder="G… public address"/></label><button className="surface-button surface-button-secondary" type="submit">View holdings</button></form>{error?<p role="alert">{error}</p>:null}</details>;
}
type KeeperStatus={mode:string;lastTick:null|{at:string;ok:boolean;error?:string};alerts:{fund:string;message:string}[]};
export function KeeperHealth(){
 const [status,setStatus]=useState<KeeperStatus|null>(null),[error,setError]=useState('');
 useEffect(()=>{let live=true;const load=()=>productRead<KeeperStatus>('status').then(s=>{if(live){setStatus(s);setError('');}}).catch(()=>{if(live)setError('Keeper unavailable. Requests remain on-chain; no payment date is guaranteed.');});void load();const timer=setInterval(load,10000);return()=>{live=false;clearInterval(timer);};},[]);
 const stale=status?.lastTick?Date.now()-Date.parse(status.lastTick.at)>20000:true;
 if(GENERAL_MAINNET)return <section className="surface-panel managed-keeper"><h2>Withdrawal processing</h2><p>Automatic processing is inactive. Eligible requests require manual processing; no payment date is guaranteed.</p></section>;
 if(MANAGED_CATALOG_READ_ONLY)return <section className="surface-panel managed-keeper"><h2>Withdrawal processing</h2><p>Payments are disabled in this preview.</p><ManagedContextHelp icon label="About withdrawal processing" title="Withdrawal processing"><p>Recorded requests and reserved claims are shown. This preview cannot settle or pay them; automatic withdrawal processing is inactive.</p></ManagedContextHelp></section>;
 return <section className="surface-panel managed-keeper"><h2>Withdrawal processing</h2><p>{error||(!status?'Checking the local service…':status.mode==='dry-run'?'Keeper in dry run — it checks requests but submits nothing.':stale||!status.lastTick?.ok||status.alerts.length?'Processing needs attention. Your requests remain on-chain.':'Local keeper running — eligible requests are processed automatically when liquidity is available.')}</p>{status?.lastTick?<small>Last check: {new Date(status.lastTick.at).toLocaleTimeString()} · Local sandbox only</small>:null}{status?.alerts.length?<details><summary>{status.alerts.length} processing alert{status.alerts.length===1?'':'s'}</summary>{status.alerts.map(a=><p key={a.fund}>{a.fund.slice(0,8)}…: {a.message}</p>)}</details>:null}</section>;
}
export default function ManagedPortfolioSurface({mode}:{mode:'investor'|'manager'}){
 const wallet=useWallet(),[lookup,setLookup]=usePublicLookup(),owner=lookup||wallet;const [portfolioData,setData]=useState<ProductPortfolio|null>(null),[dataOwner,setDataOwner]=useState(''),[error,setError]=useState('');
 const data=owner&&dataOwner===owner?portfolioData:null;
 useEffect(()=>{setData(null);setError('');if(!owner)return;const controller=new AbortController();let request=0;
  const load=()=>{const selected=++request;return productRead<ProductPortfolio>('portfolio',{owner},controller.signal).then(value=>{if(!controller.signal.aborted&&selected===request){setData(value);setDataOwner(owner);setError('');}}).catch(e=>{if(!controller.signal.aborted&&selected===request)setError(e.message);});};
  void load();const timer=setInterval(load,15000);return()=>{controller.abort();clearInterval(timer);};},[owner]);
 const funds=data?.funds.filter(f=>mode==='manager'?f.manager===owner:totals(f).hasPosition||f.requestsTruncated)??[];
 return <main className="surface-stack managed-product" data-testid="managed-normal-portfolio"><header className="surface-panel managed-product-header"><span className="surface-eyebrow">{GENERAL_MAINNET?'Your portfolio':'Your portfolio · Local sandbox'}</span><h1>{mode==='investor'?'My investments':'Funds I manage'}</h1><p>{mode==='investor'?'Track your investments and withdrawals, or explore other Arkas.':'Review your funds and withdrawal processing. Explore and invest from the same app.'}</p><div className="surface-entry-actions"><Link className="surface-button surface-button-primary" href="/discover">Explore Arkas</Link><Link className="surface-button surface-button-secondary" href={mode==='investor'?'/manage':'/investments'}>{mode==='investor'?'Funds I manage':'My investments'}</Link></div></header>
  {!owner?<section className="surface-panel"><h2>Connect your wallet</h2><p>Connect your wallet to see your investments. A disconnected wallet is not an empty portfolio.</p></section>:null}
  {lookup?<section className="ops-alert managed-wallet-context" aria-label="Viewed public wallet"><div><p>Public address lookup · Read-only · Not a wallet connection</p><code className="managed-contract">{lookup}</code></div><button className="surface-button surface-button-secondary" onClick={()=>{setLookup('');window.history.replaceState(null,'',window.location.pathname);}}>Use connected wallet</button></section>:null}
  <PublicLookup onView={address=>{setLookup(address);window.history.replaceState(null,'',`${window.location.pathname}?address=${encodeURIComponent(address)}`);}}/>
  {data?.funds.some(f=>f.readSource)?<p className="ops-alert" role="note">Verified source · Automatic processing inactive</p>:null}
  {error?<p className="ops-alert ops-alert-warning" role="alert">{error}</p>:null}
  {owner&&!data&&!error?<p role="status">Checking your on-chain shares and withdrawal requests…</p>:null}
  {data&&(data.errors.length>0||data.truncated)?<p className="ops-alert ops-alert-warning" role="alert">Some fund checks are incomplete. Missing investments have not been treated as zero.</p>:null}
  {data&&funds.length===0?<section className="surface-panel"><h2>{data.errors.length>0||data.truncated?'Investment data is temporarily unavailable':`No ${mode==='investor'?'holdings':'managed funds'} found in the registered funds`}</h2><p>{data.errors.length>0||data.truncated?'The checks are incomplete. Your investments have not been treated as zero. Refresh the verified data and try again.':'No position was found among the funds verified in this check.'}</p></section>:null}
  {funds.map(f=>{const t=totals(f);return <article className="surface-panel managed-position" key={f.id}><div><span className="surface-eyebrow">{GENERAL_MAINNET?'Stellar mainnet':'Fictitious assets'}</span><h2>{productDisplayName(f)}</h2><p>{t.value===null?'Estimated value unavailable':`${units(t.value.toString())} ${f.symbol} estimated value`}</p><div className="managed-metrics"><span>Available shares<strong>{units(f.freeShares)}</strong></span><span>Awaiting settlement<strong>{units(t.pending.toString())} shares</strong></span><span>Ready to collect<strong>{units(t.claimable.toString())} {f.symbol}</strong></span></div></div><Link href={`/arkas/${f.id}${lookup?`?address=${encodeURIComponent(lookup)}`:''}`} className="surface-button surface-button-primary">{lookup?'View investment':t.claimable>BigInt(0)?'Collect withdrawal':'View investment'}</Link></article>;})}
  <KeeperHealth/>
 </main>;
}
export function ManagedFundSurface(){
 const {id}=useParams<{id:string}>();const wallet=useWallet(),[lookup,setLookup]=usePublicLookup(),owner=lookup||wallet;const [fundData,setFund]=useState<ProductFund|null>(null),[loadedOwner,setLoadedOwner]=useState(''),[error,setError]=useState(''),[notice,setNotice]=useState(''),[amount,setAmount]=useState('');
 const fund=owner&&loadedOwner===owner&&fundData?.id===id?fundData:null;
 const [loadError,setLoadError]=useState('');
 const [executionReady,setExecutionReady]=useState(false);
 const [depositReset,setDepositReset]=useState(0),[watchedRequest,setWatchedRequest]=useState<string|null>(null);
 const [review,setReview]=useState<{action:ManagedWalletAction;description:string}|null>(null),[busy,setBusy]=useState(false),[phase,setPhase]=useState<WalletPhase|null>(null),[pending,setPending]=useState<PendingProductReceipt|null>(null),[receiptBlocked,setReceiptBlocked]=useState(false),[ledgerUnavailable,setLedgerUnavailable]=useState(false);
 const reviewHeading=useRef<HTMLHeadingElement>(null);
 useEffect(()=>{if(review&&!pending)reviewHeading.current?.focus();},[review,pending]);
 const context=useRef({id,wallet,owner}),readState=useRef({request:0}).current;
 if(context.current.id!==id||context.current.wallet!==wallet||context.current.owner!==owner)context.current={id,wallet,owner};
 useEffect(()=>{let live=true;setExecutionReady(false);if(GENERAL_MAINNET&&mainnetExecutionRequested()&&wallet&&!lookup)void generalExecutionAvailable().then(ready=>{if(live)setExecutionReady(ready);}).catch(()=>{if(live)setExecutionReady(false);});return()=>{live=false;};},[id,wallet,lookup]);
 const load=useCallback(async()=>{
  if(!owner)return;
  const selected=++readState.request,isCurrent=()=>selected===readState.request&&context.current.id===id&&context.current.wallet===wallet&&context.current.owner===owner;
  try{
   const value=await productRead<ProductFund>('fund',{fund:id,owner});
   if(isCurrent()){setFund(value);setLoadedOwner(owner);setLedgerUnavailable(false);setLoadError('');}
  }catch(e){
   if(!isCurrent())return;
   setLedgerUnavailable(true);setLoadError(e instanceof Error?e.message:'Local ledger unavailable.');
   throw e;
  }
 },[id,wallet,owner,readState]);
 useEffect(()=>{setFund(null);setLoadedOwner('');setError('');setLoadError('');setReview(null);setNotice('');setPending(null);setReceiptBlocked(false);setWatchedRequest(null);
  if(!owner)return;
  try{if(wallet)setPending(readProductReceipt(id,wallet));}catch(e){setError((e as Error).message);setReceiptBlocked(true);}
  void load().catch(()=>{});const timer=setInterval(()=>void load().catch(()=>{}),10000);return()=>{readState.request++;clearInterval(timer);};},[id,wallet,owner,load,readState]);
 function transport(){return createManagedSorobanTransport({enabled:true,rpcUrl:'http://127.0.0.1:8000/rpc',walletAddress:wallet,fund:id,depositAssets:fund?.depositAssets?.map(a=>a.asset),depositProtectionVersion:fund?.depositProtectionVersion,readState:async()=>{throw Error('Product balances are read independently.');}});}
 async function confirm(){
  if(GENERAL_MAINNET&&!executionReady){
   if(!review||!wallet||lookup||busy||pending||receiptBlocked||ledgerUnavailable)return;
   const selectedContext=context.current;setBusy(true);setError('');
   try{const checked=await checkGeneralAction(id,review.action as unknown as Record<string,unknown>);if(context.current!==selectedContext)return;setNotice(`Transaction checked on Stellar mainnet. Network fee: ${units(checked.totalFeeRaw)} XLM. Signing and sending are disabled.`);}
   catch(e){if(context.current===selectedContext)setError(e instanceof Error?e.message:'Review unavailable.');}
   finally{setBusy(false);}return;
  }
  if((MANAGED_CATALOG_READ_ONLY&&!GENERAL_MAINNET)||!review||!wallet||lookup||busy||pending||receiptBlocked||ledgerUnavailable)return;const selected=review,owner=wallet,fundId=id;let submittedReceipt:PendingProductReceipt|undefined;setBusy(true);setPhase(null);setError('');setNotice('');setWatchedRequest(null);
  try{
   if(selected.action.action==='deposit'||selected.action.action==='approve'){
    const fresh=await productRead<ProductFund>('fund',{fund:fundId,owner});
    if(selected.action.amountRaw!=='0'){
     const checked=validateDeposit(fresh,selected.action.asset,selected.action.amountRaw);
     if(selected.action.action==='deposit'&&checked.needsApproval)throw new ManagedActionRejected('The exact allowance changed or expired. Review the authorization again.');
    }
   }
   const selectedTransport=GENERAL_MAINNET?await generalExecutionTransport(fundId,owner,()=>context.current.id===fundId&&context.current.wallet===owner&&context.current.owner===owner):transport();
   const result=await (GENERAL_MAINNET?executeMainnetWalletAction:executeManagedWalletAction)(selected.action,GENERAL_MAINNET?mainnetWallet:productWallet,selectedTransport,{expectedAddress:owner,expectedFund:fundId,isCurrent:()=>context.current.id===fundId&&context.current.wallet===owner&&context.current.owner===owner,onPhase:setPhase,
    onSubmitIntent:prepared=>{const saved={id:prepared.id,owner,fund:fundId,action:selected.action.action,expiresAt:prepared.expiresAt};saveProductReceipt(saved);submittedReceipt=saved;setPending(saved);}});
   if(context.current.id!==fundId||context.current.wallet!==owner||context.current.owner!==owner)return;
   if(result.catalogPending){setReview(null);setNotice('Transaction confirmed. The catalog is updating; keep this receipt and check confirmation only.');return;}
   if(selected.action.action==='deposit')setDepositReset(value=>value+1);
   if(selected.action.action==='request'&&result.requestId)setWatchedRequest(result.requestId);
   if(submittedReceipt)clearProductReceipt(submittedReceipt);setPending(readProductReceipt(fundId,owner));setReview(null);setAmount('');setNotice(selected.action.action==='approve'?'Authorization confirmed. No deposit was made. Review the deposit separately, or revoke the remaining authorization.':selected.action.action==='deposit'?'Deposit confirmed. Your shares and portfolio balances have been refreshed.':selected.action.action==='portfolio-swap'?'Portfolio assets changed. Withdrawal reserves remain protected.':selected.action.action==='recover-spot'?'Liquidity step confirmed. Review a fresh plan before processing another step.':selected.action.action==='settle'?'Settlement processed. Reserved amounts are available for their owners to collect.':selected.action.action==='request'?'Withdrawal requested. Processing after the cutoff depends on valuation and available liquidity.':selected.action.action==='claim'||selected.action.action==='instant'?'Withdrawal collected in your wallet.':'Unsettled shares returned to your investment.');await load().catch(()=>{});
  }catch(e){
   if(e instanceof ManagedActionRejected&&submittedReceipt)clearProductReceipt(submittedReceipt);
   if(context.current.id!==fundId||context.current.wallet!==owner||context.current.owner!==owner)return;
   try{setPending(readProductReceipt(fundId,owner));}catch{setReceiptBlocked(true);}
   setError(e instanceof Error?e.message:'Action unavailable.');
  }finally{setBusy(false);}
 }
 async function receipt(){
  if(!pending||busy)return;const selectedContext=context.current,isCurrent=()=>context.current===selectedContext&&context.current.owner===wallet;setBusy(true);setError('');try{const result=GENERAL_MAINNET?await generalExecutionReceipt(pending.id,wallet,id):await transport().receipt(pending.id);if(!isCurrent())return;if(!result){setNotice('Still awaiting confirmation. Nothing has been resubmitted. Keep this receipt, even if the transaction expires.');return;}
   if(result.catalogPending){setNotice('Transaction confirmed. The catalog is updating; keep this receipt and check confirmation only.');return;}
   if(result.ok&&pending.action==='deposit')setDepositReset(value=>value+1);
   if(result.ok&&pending.action==='request'&&result.requestId)setWatchedRequest(result.requestId);
   clearProductReceipt(pending);setPending(readProductReceipt(id,wallet));setReview(null);setNotice(result.ok?'Transaction confirmed. Balances refreshed.':'Transaction failed on-chain. Review the result before preparing a new action.');await load().catch(()=>{});
  }catch(e){if(isCurrent())setError((e as Error).message);}finally{setBusy(false);}
 }
 const total=fund?totals(fund):null,disabled=(MANAGED_CATALOG_READ_ONLY&&!GENERAL_MAINNET)||busy||!!pending||receiptBlocked||ledgerUnavailable||!wallet||!!lookup||!!fund?.requestsTruncated;
 const currentNotice=watchedRequest&&fund?withdrawalProgressNotice(fund,watchedRequest)??notice:notice;
 const depositReview=review?.action.action==='approve'||review?.action.action==='deposit';
 const reviewPanel=review&&!pending?<section className="surface-panel managed-review" aria-labelledby="withdrawal-review"><h2 id="withdrawal-review" ref={reviewHeading} tabIndex={-1}>Review before signing</h2><p>{review.description}</p><p>{GENERAL_MAINNET?(executionReady?'Network: Stellar mainnet ·':'Network: Stellar mainnet · Signing and sending disabled ·'):'Network: local Standalone · Transaction fees: fictitious XLM ·'} {review.action.action==='approve'?'Spender: this Arka only':`Recipient: ${['portfolio-swap','deposit','recover-spot','settle'].includes(review.action.action)?'this Arka — assets remain in the fund':'your connected wallet'}`}</p><div className="surface-entry-actions"><button className="surface-button surface-button-primary" disabled={disabled} onClick={()=>void confirm()}>{busy?phase?.replaceAll('_',' ')??'Working…':GENERAL_MAINNET&&!executionReady?'Check transaction':'Confirm in Freighter'}</button><button className="surface-button surface-button-secondary" disabled={busy} onClick={()=>setReview(null)}>Go back</button></div></section>:null;
 return <main className="surface-stack managed-product" data-testid="managed-normal-fund"><header className="surface-panel"><Link href="/investments" className="surface-text-link">← My investments</Link><span className="surface-eyebrow">{fund?.readSource?.kind==='mainnet-rpc-readonly'&&fund.readSource.verificationMode==='live'?(executionReady?'Stellar mainnet':'Public mainnet reads · Read-only'):'Snapshot preview · No live balances'}</span><h1>{fund?productDisplayName(fund):'Your investment'}</h1><details><summary>Arka details</summary><p className="managed-contract">{id}</p><p>Ledger {fund?.ledger??'—'} · Verified source details</p></details></header>
  {error||loadError?<p role="alert" className="ops-alert ops-alert-warning">{error||loadError}</p>:null}{currentNotice?<p role="status" className="ops-alert">{currentNotice}</p>:null}
  {lookup?<p className="ops-alert">Public address lookup · Read-only · Not a wallet connection</p>:null}
  {!owner?<section className="surface-panel"><h2>Choose a wallet to view holdings</h2><p>Connect your wallet or explicitly look up a public address. No personal position has been assumed.</p></section>:null}
  <PublicLookup onView={address=>{setLookup(address);window.history.replaceState(null,'',`${window.location.pathname}?address=${encodeURIComponent(address)}`);}}/>
  <>{/* Source details stay in Arka details and contextual help; the global preview notice remains visible. */}</>
  {fund?.catalog?<ManagedContextHelp icon label="About these figures" title="About these figures"><p>Pending shares remain invested. Reserved withdrawals are separate from the remaining NAV. Your current investment and active withdrawals use the same owner-filtered catalog observation.</p><p>Ledger {fund.catalog.ledger} · Recorded {new Date(fund.catalog.indexedAt).toLocaleString()}</p></ManagedContextHelp>:null}
  {owner&&!fund&&!error&&!loadError?<p role="status">Checking verified investment data…</p>:null}
  {fund?<><section className="surface-panel"><h2>Your investment</h2><div className="managed-metrics"><span>Estimated value<strong>{total?.value===null?'Unavailable':`${units(total!.value!.toString())} ${fund.symbol}`}</strong></span><span>Available shares<strong>{owner?units(fund.freeShares):'Connect wallet'}</strong></span><span>Ready to collect<strong>{owner?`${units(total!.claimable.toString())} ${fund.symbol}`:'Connect wallet'}</strong></span></div><p className="surface-note">Estimates can change until settlement. Amounts ready to collect are reserved for you and excluded from the remaining fund value.</p>{fund.catalog?.feePreview&&BigInt(fund.catalog.feePreview.total_shares_after)>BigInt(fund.catalog.feePreview.total_shares_before)?<details className="surface-note" data-testid="pending-fee-preview"><summary>Estimate includes pending fund fees</summary><p>The estimate reflects fees already defined by this Arka. Your issued shares, pending withdrawal rights and reserved amounts have not changed. This is a preview, not a new fee or a completed charge.</p><p>Issued shares: {units(fund.catalog.feePreview.total_shares_before)} · After estimated fees: {units(fund.catalog.feePreview.total_shares_after)}.</p></details>:null}{fund.valuationError?<p role="alert">{fund.valuationError} Reserved funds can still be collected.</p>:null}</section>
  {fund.holdings?<section className="surface-panel"><h2>Portfolio assets</h2><p>Liquid balances held by the Arka, not your personal wallet. Lending positions, if any, are included in total fund valuation separately.</p><div className="managed-metrics">{fund.holdings.map(h=><span key={h.asset}>{h.symbol}<strong>{units(h.cash)}</strong></span>)}</div></section>:null}
  {fund.portfolioPolicy?<ManagedDeposit key={`${id}:${owner}`} fund={fund} wallet={wallet} reset={depositReset} disabled={disabled} onReview={setReview} onInvalidate={()=>setReview(null)}/>:null}
  {depositReview?reviewPanel:null}
  <section className="surface-panel"><h2>Withdraw</h2><p>Request → Settlement → {fund.portfolioPolicy?.auto_payout?'Receive':'Collect'}.</p><p>Paid in {fund.symbol}.</p><p>Pending withdrawals remain invested and exposed to gains, losses and fees until settlement.</p><ManagedContextHelp icon label="About withdrawals" title="Withdrawal terms and timing"><p>{fund.portfolioPolicy?`You can cancel before the cutoff. Cancellation is paused during processing and reopens ${humanDuration(fund.portfolioPolicy.cancel_lock_seconds)} after eligibility if shares remain pending.`:'You can cancel any part still pending.'}</p>{fund.portfolioPolicy?.auto_payout?<p>Reserved withdrawals can be sent automatically to their recorded owner. Manual collection stays available; automatic delivery is not guaranteed.</p>:null}<p>Requests are grouped every {humanDuration(fund.policy.epoch_seconds)} {GENERAL_MAINNET?'under this Arka’s policy':'in this accelerated local test'}. Settlement is not a guaranteed payment deadline; it depends on valuation and liquidity. No manager signature is needed to request or collect. Public liquidity recovery opens {humanDuration(fund.policy.manager_window)} after eligibility.</p><p>Asset sales may need several bounded steps. Each step is re-quoted after confirmation. A withdrawal remains pending until all its shares are settled.</p><p>Cash buffer: {fund.policy.buffer_bps/100}% of the remaining fund value. It is not insurance or an exit fee. {GENERAL_MAINNET?'These terms are read from this Arka.':'These are local test terms, not approved production terms.'}</p></ManagedContextHelp>
   <div className="managed-request-form"><label htmlFor="managed-amount">Estimated amount ({fund.symbol})<input id="managed-amount" className="ops-input" inputMode="decimal" value={amount} disabled={disabled} onChange={e=>{setAmount(e.target.value);setReview(null);}} placeholder="0.00"/></label>
   <button className="surface-button surface-button-primary" disabled={disabled||!fund.status||total!.pending>BigInt(0)||!amount} onClick={()=>{try{const assets=parseUnits(amount),shares=sharesForAssets(assets,fund.status!.nav,fund.status!.total_shares);if((shares<BigInt(fund.policy.min_request_shares)&&shares!==BigInt(fund.freeShares))||shares>BigInt(fund.freeShares))throw Error('Amount is below the minimum or exceeds your available shares.');setError('');setReview({action:{action:'request',actor:'a',sharesRaw:shares.toString()},description:`Request ${units(shares.toString())} shares (approximately ${units(assets.toString())} ${fund.symbol}). The final payout is determined at settlement, not now.`});}catch(e){setError((e as Error).message);}}}>Review withdrawal</button>
   <button className="surface-button surface-button-secondary" disabled={disabled||BigInt(fund.freeShares)<=BigInt(0)||total!.pending>BigInt(0)||!fund.status} onClick={()=>setReview({action:{action:'request',actor:'a',sharesRaw:fund.freeShares},description:`Request all ${units(fund.freeShares)} available shares. The final payout is determined at settlement.`})}>Withdraw all available shares</button></div>
   {fund.portfolioPolicy?.instant_cash?<div className="managed-instant"><p>Available for direct withdrawal now: {units(instantWithdrawalCapacity(fund).toString())} {fund.symbol}. Queue priority and the cash buffer are respected.</p><button className="surface-button surface-button-secondary" disabled={disabled||!amount||instantWithdrawalCapacity(fund)<=BigInt(0)} onClick={()=>{try{const assets=parseUnits(amount);if(assets>instantWithdrawalCapacity(fund))throw Error('This amount exceeds the cash currently available. Use a withdrawal request instead.');const shares=sharesForAssets(assets,fund.status!.nav,fund.status!.total_shares);setError('');setReview({action:{action:'instant',actor:'a',sharesRaw:shares.toString()},description:`Withdraw ${units(shares.toString())} shares directly in ${fund.symbol}. If liquidity changes, the complete transaction reverts; it does not create a pending request.`});}catch(e){setError((e as Error).message);}}}>Review direct withdrawal</button></div>:null}
   {total!.pending>BigInt(0)?<p>One request is already pending. Wait for settlement or cancel its unsettled portion before requesting more.</p>:null}
   {fund.requestsTruncated?<p role="alert">Withdrawal history is incomplete. Actions are paused until the index is complete.</p>:null}
  </section>
  {fund.portfolioPolicy?<ManagedWithdrawalProcessing key={`${id}:${wallet}`} fund={fund} wallet={wallet} disabled={disabled} readOnly={GENERAL_MAINNET?!executionReady:MANAGED_CATALOG_READ_ONLY} readPlan={GENERAL_MAINNET?generalWithdrawalPlan:undefined} onReview={setReview} onInvalidate={()=>setReview(null)}/>:null}
  <section className="surface-panel"><h2>Your withdrawals</h2>{fund.requests.length===0?<p>{wallet?(fund.withdrawalHistory?.closedCount?'No active withdrawal requests.':'No withdrawal requests yet.'):'Connect your wallet to see your requests.'}</p>:fund.requests.map(r=><article className="managed-withdrawal-row" key={r.id}><div><h3>Request #{r.id}</h3><p>{units(r.pending_shares)} shares awaiting settlement · {units(r.claimable_assets)} {fund.symbol} ready to collect</p><small>{BigInt(r.pending_shares)>BigInt(0)?`Eligible after ${new Date(Number(r.eligible_at)*1000).toLocaleTimeString()} — not a guaranteed payout time`:`Collected: ${units(r.claimed_assets)} ${fund.symbol} · Cancelled: ${units(r.cancelled_shares)} shares`}</small>{BigInt(r.pending_shares)>BigInt(0)&&!cancellationAllowed(fund,r)?<p>Processing window: cancellation reopens if this request remains unsettled.</p>:null}</div><div className="surface-entry-actions">{BigInt(r.claimable_assets)>BigInt(0)?<button className="surface-button surface-button-primary" disabled={disabled} onClick={()=>setReview({action:{action:'claim',actor:'a',id:Number(r.id)},description:`Collect ${units(r.claimable_assets)} ${fund.symbol} in your wallet. These funds are already reserved for you.`})}>Collect {units(r.claimable_assets)} {fund.symbol}</button>:null}{BigInt(r.pending_shares)>BigInt(0)?<button className="surface-button surface-button-secondary" disabled={disabled||!cancellationAllowed(fund,r)} onClick={()=>setReview({action:{action:'cancel',actor:'a',id:Number(r.id)},description:`Cancel the unsettled ${units(r.pending_shares)} shares. Any already settled amount remains available to collect.`})}>Cancel unsettled part</button>:null}</div></article>)}</section><ManagedWithdrawalHistory fund={fund}/></>:null}
  {!depositReview?reviewPanel:null}
  {pending?<section className="surface-panel managed-review"><h2>Transaction receipt</h2><p>Do not repeat this action until its result is known. This receipt survives a page reload.</p><code className="managed-contract">{pending.id}</code><button className="surface-button surface-button-secondary" disabled={busy} onClick={()=>void receipt()}>Check confirmation only</button></section>:null}
  {fund?.portfolioPolicy&&fund.manager===wallet&&!lookup?<ManagerPortfolioSwap fund={fund} wallet={wallet} disabled={disabled} onReview={setReview} onInvalidate={()=>setReview(null)}/>:null}
  <KeeperHealth/>
 </main>;
}

function ManagedDeposit({fund,wallet,reset,disabled,onReview,onInvalidate}:{fund:ProductFund;wallet:string;reset:number;disabled:boolean;onReview:(value:{action:ManagedWalletAction;description:string})=>void;onInvalidate:()=>void}){
 const [asset,setAsset]=useState(fund.token),[amount,setAmount]=useState(''),[error,setError]=useState(''),[tolerance,setTolerance]=useState(0),[loading,setLoading]=useState(false),[quote,setQuote]=useState<{estimated:string;minimum:string}|null>(null),[appliedReset,setAppliedReset]=useState(reset);
 const mounted=useRef(true),current=useRef({fund:fund.id,wallet,asset,amount,tolerance,reset,disabled});current.current={fund:fund.id,wallet,asset,amount,tolerance,reset,disabled};
 useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;};},[]);
 // Apply a confirmed-deposit reset before commit; mounting must not erase input.
 if(appliedReset!==reset){setAppliedReset(reset);setAmount('');setError('');setQuote(null);}
 const selected=fund.depositAssets?.find(a=>a.asset===asset),protectedDeposits=fund.depositProtectionVersion===1,blocked=disabled||!protectedDeposits||!fund.fees||!!fund.depositError||!!fund.valuationError||!selected;
 let needsApproval=true;try{needsApproval=validateDeposit(fund,asset,parseUnits(amount).toString()).needsApproval;}catch{}
 async function review(){const selection=JSON.stringify(current.current);setLoading(true);setError('');try{
  const raw=parseUnits(amount).toString(),checked=validateDeposit(fund,asset,raw);
  const estimated=await (GENERAL_MAINNET?generalDepositQuote:localDepositQuote)(fund.id,wallet,asset,raw),minimum=minimumDepositShares(estimated,tolerance);
  if(!mounted.current||JSON.stringify(current.current)!==selection)return;
  setQuote({estimated,minimum});
  onReview({action:checked.needsApproval?{action:'approve',actor:'a',asset,amountRaw:raw}:{action:'deposit',actor:'a',asset,amountRaw:raw,minSharesRaw:minimum},description:checked.needsApproval?
   `Authorize this Arka to spend exactly ${units(raw)} ${checked.selected.symbol}. This does not deposit or mint shares. The permission expires 120 local ledgers after preparation; the time depends on this local node. A separate deposit signature is required. Its share estimate and minimum will be reviewed again before depositing.`:
   `Deposit ${units(raw)} ${checked.selected.symbol}. Estimated: ${units(estimated)} shares. Minimum accepted: ${units(minimum)} shares (${tolerance/100}% tolerance). If execution would mint fewer, the entire deposit reverts; no deposit is made and the authorization is not consumed. Shares are calculated at execution, not guaranteed 1:1 with the token. Deposit fee: ${fund.fees!.deposit_bps/100}%. Network fees can still be charged for a failed transaction.`});
 }catch(e){if(mounted.current&&JSON.stringify(current.current)===selection)setError((e as Error).message);}finally{if(mounted.current)setLoading(false);}}
 return <section className="surface-panel"><h2>Deposit</h2><ManagedContextHelp icon label="About deposits" title="How deposits work"><p>Authorize the exact amount, then deposit to receive shares. Authorization and deposit require separate approval.</p><p>Valuation and withdrawals use {fund.symbol}. Deposits do not automatically swap assets into this currency. The minimum share amount protects execution, not future returns.</p></ManagedContextHelp>
 <div className="managed-request-form"><label htmlFor="deposit-asset">Deposit asset<select id="deposit-asset" className="ops-input" value={asset} disabled={disabled} onChange={e=>{setAsset(e.target.value);setError('');setQuote(null);onInvalidate();}}>{(fund.holdings??[]).map(h=><option key={h.asset} value={h.asset}>{h.symbol}</option>)}</select></label><label htmlFor="deposit-amount">Amount to deposit ({selected?.symbol??fund.symbol})<input id="deposit-amount" className="ops-input" inputMode="decimal" value={amount} disabled={blocked} placeholder="0.00" onChange={e=>{setAmount(e.target.value);setError('');setQuote(null);onInvalidate();}}/></label><label htmlFor="deposit-tolerance">Share tolerance<select id="deposit-tolerance" className="ops-input" value={tolerance} disabled={blocked} onChange={e=>{setTolerance(Number(e.target.value));setError('');setQuote(null);onInvalidate();}}><option value="0">0% · estimate or better</option><option value="50">0.5%</option><option value="100">1%</option></select></label><button className="surface-button surface-button-primary" disabled={blocked||loading||!amount} onClick={()=>void review()}>{loading?'Checking estimate…':needsApproval?'Review authorization':'Review deposit'}</button></div>
 {quote?<p className="surface-note">Last reviewed estimate: {units(quote.estimated)} shares · Minimum accepted: {units(quote.minimum)} shares. This protects the shares minted, not future returns.</p>:null}
 {!protectedDeposits?<p className="ops-alert">Protected deposits are unavailable for this local Arka. New deposits are disabled; existing investments and withdrawals remain available.</p>:null}
 <p>{selected?`Wallet balance: ${units(selected.balance)} ${selected.symbol} · Current authorization: ${units(selected.allowance)} ${selected.symbol}.`:'Connect your wallet to check its balance and authorization.'} {selected?.native?(GENERAL_MAINNET?'Account reserves and the simulated network fee are checked before review.':'Keep 2 local XLM for fees and reserves.'):null}</p>
 <p>Fees: {fund.fees?`${fund.fees.deposit_bps/100}% deposit · ${fund.fees.mgmt_bps/100}% annual management · ${fund.fees.perf_bps/100}% performance`:'unavailable'}. {GENERAL_MAINNET?'Estimates use verified observations; no return or payment date is guaranteed.':'Prices are from a dated public snapshot; no return or payment date is guaranteed.'}</p>
 {selected&&BigInt(selected.allowance)>BigInt(0)?<button className="surface-button surface-button-secondary" disabled={disabled} onClick={()=>onReview({action:{action:'approve',actor:'a',asset,amountRaw:'0'},description:`Revoke this Arka’s remaining authorization for ${selected.symbol}. This does not withdraw invested assets.`})}>Review revoking authorization</button>:null}
 {error||fund.depositError?<p role="alert">{error||productNotice(fund.depositError)}</p>:null}</section>;
}

function ManagerPortfolioSwap({fund,wallet,disabled,onReview,onInvalidate}:{fund:ProductFund;wallet:string;disabled:boolean;onReview:(value:{action:ManagedWalletAction;description:string})=>void;onInvalidate:()=>void}){
 const [asset,setAsset]=useState(fund.portfolioPolicy?.routes[0]?.asset??''),[sell,setSell]=useState(true),[amount,setAmount]=useState(''),[loading,setLoading]=useState(false),[error,setError]=useState('');
 const mounted=useRef(true),current=useRef({fund:fund.id,wallet,asset,sell,amount});current.current={fund:fund.id,wallet,asset,sell,amount};
 useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;};},[]);
 const label=(id:string)=>fund.holdings?.find(h=>h.asset===id)?.symbol??`${id.slice(0,8)}…`;
 const pending=BigInt(fund.queue.pending_shares)>BigInt(0);
 async function review(){const selection={...current.current};setLoading(true);setError('');try{const raw=parseUnits(amount);const step=await (GENERAL_MAINNET?generalPortfolioQuote:localPortfolioQuote)(fund.id,wallet,asset,raw.toString(),sell);if(!mounted.current||JSON.stringify(current.current)!==JSON.stringify(selection))return;onReview({action:{action:'portfolio-swap',actor:'manager',step},description:`Pay ${units(step.amount_in)} ${sell?label(asset):fund.symbol}; receive at least ${units(step.min_out)} ${sell?fund.symbol:label(asset)}. This is an oracle-based minimum, not an executable market quote. The transaction is simulated before signing and fails if the minimum cannot be met. Approved route only; reserved withdrawals cannot be spent.`});}catch(e){if(mounted.current&&JSON.stringify(current.current)===JSON.stringify(selection))setError(e instanceof Error?e.message:'Trade estimate unavailable.');}finally{if(mounted.current)setLoading(false);}}
 return <section className="surface-panel"><span className="surface-eyebrow">Manager tools</span><h2>Change portfolio assets</h2><p>Valued and paid out in {fund.symbol}; the portfolio may hold multiple approved assets.</p>{pending?<p>Withdrawals are pending. Trades may only convert assets into {fund.symbol} to prepare their payout.</p>:null}<div className="managed-request-form"><label htmlFor="portfolio-direction">I want to<select className="ops-input" id="portfolio-direction" value={sell?'sell':'buy'} disabled={disabled||loading} onChange={e=>{setSell(e.target.value==='sell');onInvalidate();}}><option value="sell">Convert an asset to {fund.symbol}</option><option value="buy" disabled={pending}>Invest {fund.symbol} in another asset</option></select></label><label htmlFor="portfolio-asset">Portfolio asset<select className="ops-input" id="portfolio-asset" value={asset} disabled={disabled||loading} onChange={e=>{setAsset(e.target.value);onInvalidate();}}>{fund.portfolioPolicy?.routes.map(r=><option key={r.asset} value={r.asset}>{label(r.asset)}</option>)}</select></label><label htmlFor="portfolio-trade-amount">Amount to pay ({sell?label(asset):fund.symbol})<input className="ops-input" id="portfolio-trade-amount" inputMode="decimal" value={amount} disabled={disabled||loading} onChange={e=>{setAmount(e.target.value);onInvalidate();}} placeholder="0.00"/></label><button className="surface-button surface-button-primary" disabled={disabled||loading||!asset||!amount||(!sell&&pending)} onClick={()=>void review()}>{loading?'Checking estimate…':'Review asset change'}</button></div>{error?<p role="alert">{error}</p>:null}</section>;
}
