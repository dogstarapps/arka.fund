'use client';
import Link from 'next/link';
import {useEffect,useRef,useState} from 'react';
import {useWallet} from './ManagedProductSurface';
import {productRead,humanDuration,units,readProductReceipt,saveProductReceipt,pendingReceiptKey,type ProductCreation,type PendingProductReceipt} from '@/lib/managedProduct';
import {executeManagedWalletAction,ManagedActionRejected,type WalletPhase} from '@/lib/managedWalletFlow';
import {createManagedSorobanTransport} from '@/lib/managedSorobanTransport';
import {productWallet} from '@/lib/managedProductWallet';
import {ManagedContextHelp} from './ManagedContextHelp';

function CreationFees({data}:{data:ProductCreation}){
 return <dl className="managed-create-facts"><div><dt>Creation fee</dt><dd>{units(data.creationFee)} · plus network fee</dd></div><div><dt>Deposit fee</dt><dd>{data.config.depositBps/100}%</dd></div><div><dt>Annual management fee</dt><dd>{data.config.mgmtBps/100}%</dd></div><div><dt>Performance fee</dt><dd>{data.config.perfBps/100}%</dd></div></dl>;
}
function WithdrawalTerms({data}:{data:ProductCreation}){
 return <ul className="managed-create-terms"><li>Requests are grouped every {humanDuration(data.policy.epoch_seconds)} in this accelerated local test. Payment depends on available liquidity; no payment date is guaranteed.</li><li>Public recovery opens {humanDuration(data.policy.manager_window)} after eligibility.</li><li>The investment remains exposed to gains, losses and fees until settlement.</li><li>Cancellation pauses during processing and reopens {humanDuration(data.portfolioPolicy.cancel_lock_seconds)} after eligibility if shares remain pending.</li><li>{data.portfolioPolicy.auto_payout?'After settlement, delivery to the recorded owner can be automated; manual collection remains available.':'After settlement, investors collect the assets from their connected wallet.'} Direct cash withdrawal is {data.portfolioPolicy.instant_cash?'available only when capacity allows':'disabled'}.</li></ul>;
}
function PublicAddress({label,value}:{label:string;value:string}){
 const [message,setMessage]=useState('');
 return <div className="managed-create-address"><span>{label}</span><code className="managed-contract">{value}</code><button type="button" className="surface-text-link" onClick={async()=>{try{await navigator.clipboard.writeText(value);setMessage('Copied.');}catch{setMessage('Copy unavailable. Select the address above.');}}}>Copy {label.toLowerCase()}</button>{message?<span role="status">{message}</span>:null}</div>;
}

/** Local factory-backed creator. No live factory, RPC selector or server signer. */
export default function ManagedCreateSurface(){
 const wallet=useWallet(),[data,setData]=useState<ProductCreation|null>(null),[error,setError]=useState(''),[notice,setNotice]=useState(''),[review,setReview]=useState<string|null>(null),[created,setCreated]=useState('');
 const [pending,setPending]=useState<PendingProductReceipt|null>(null),[blocked,setBlocked]=useState(false),[busy,setBusy]=useState(false),[phase,setPhase]=useState<WalletPhase|null>(null),[complete,setComplete]=useState(false);
 const [signing,setSigning]=useState<{id:string;expiresAt:number;feeRaw?:string}|null>(null),[clock,setClock]=useState(Date.now);
 const heading=useRef<HTMLHeadingElement>(null);
 const mounted=useRef(true);
 useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;};},[]);
 const current=useRef(wallet);current.current=wallet;
 useEffect(()=>{if(review)heading.current?.focus();},[review]);
 useEffect(()=>{if(!busy||phase!=='awaiting_signature')return;const timer=setInterval(()=>setClock(Date.now()),1000);return()=>clearInterval(timer);},[busy,phase]);
 useEffect(()=>{const controller=new AbortController();setData(null);setError('');setReview(null);setCreated('');setNotice('');setPending(null);setBlocked(false);setComplete(false);
  void productRead<ProductCreation>('creation',{},controller.signal).then(value=>{
   if(controller.signal.aborted)return;setData(value);
   try{if(wallet)setPending(readProductReceipt(value.factory,wallet));}catch{setBlocked(true);setError('Stored creation receipt is invalid. Review it before creating another Arka.');}
  }).catch(e=>{if(!controller.signal.aborted)setError(e.message);});return()=>controller.abort();
 },[wallet]);
 function transport(){
  if(!data)throw Error('Creation template unavailable.');
  return createManagedSorobanTransport({enabled:true,rpcUrl:'http://127.0.0.1:8000/rpc',walletAddress:wallet,fund:data.factory,factory:data.factory,creation:data.config,
   salt:()=>Array.from(crypto.getRandomValues(new Uint8Array(32)),b=>b.toString(16).padStart(2,'0')).join(''),readState:async()=>{throw Error('Read the new Arka independently.');}});
 }
 async function confirm(){
  if(!data||!wallet||!review||busy||pending||blocked||created)return;
  const owner=wallet,factory=data.factory;setBusy(true);setError('');setNotice('');setSigning(null);
  try{
   const fresh=await productRead<ProductCreation>('creation');
   if(JSON.stringify(fresh)!==review)throw new ManagedActionRejected('The creation template changed. Refresh and review the current terms before signing.');
   const result=await executeManagedWalletAction({action:'create',actor:'manager'},productWallet,transport(),{expectedAddress:owner,expectedFund:factory,isCurrent:()=>mounted.current&&current.current===owner,onPhase:setPhase,
    onPrepared:p=>{setSigning({id:p.id,expiresAt:p.expiresAt,feeRaw:p.feeRaw});setClock(Date.now());},
    onSubmitIntent:p=>{const saved={id:p.id,owner,fund:factory,action:'create',expiresAt:p.expiresAt};saveProductReceipt(saved);setPending(saved);}});
   localStorage.removeItem(pendingReceiptKey(factory,owner));setPending(null);setReview(null);setComplete(true);setCreated(result.createdFund??'');setNotice('Arka created on the local ledger. It is empty; no deposit has been made.');
  }catch(e){if(e instanceof ManagedActionRejected){localStorage.removeItem(pendingReceiptKey(factory,owner));setPending(null);}setError((e as Error).message);}finally{setBusy(false);setSigning(null);}
 }
 async function checkReceipt(){
  if(!pending||busy)return;setBusy(true);setError('');try{
   const result=await transport().receipt(pending.id);
   if(!result){setNotice('Confirmation is still unknown. Nothing has been resubmitted. Do not create another Arka yet.');return;}
   localStorage.removeItem(pendingReceiptKey(pending.fund,pending.owner));setPending(null);setReview(null);setComplete(result.ok);setCreated(result.createdFund??'');setNotice(result.ok?'Arka creation confirmed. Find it in Funds I manage. No deposit has been made.':'Creation failed on-chain. Review the result before preparing a new transaction.');
  }catch(e){setError((e as Error).message);}finally{setBusy(false);}
 }
 const disabled=!data||!wallet||busy||!!pending||blocked||complete;
 const remaining=signing?Math.max(0,Math.ceil((signing.expiresAt-clock)/1000)):0;
 const denomination=data?.assets.find(a=>a.asset===data.config.denomination)?.symbol;
 return <main className="surface-stack managed-product managed-create" data-testid="managed-normal-create"><header className="managed-create-header"><Link href="/manage" className="surface-text-link">← Funds I manage</Link><h1 ref={heading} tabIndex={-1}>{review&&!pending&&!complete?'Review your Arka':'Create an Arka'}</h1><p>{review&&!pending&&!complete?'Check the details, then create an empty portfolio.':'Create your portfolio. Add funds afterwards.'}</p>{!wallet?<p className="surface-note">Connect your local wallet using the button above to continue.</p>:null}</header>
 {error?<p className="ops-alert ops-alert-warning" role="alert">{error}</p>:null}{notice?<p className="ops-alert" role="status">{notice}</p>:null}
 {!data&&!error?<p role="status">Reading the local factory’s current template…</p>:null}
 {data&&!review&&!pending&&!complete?<section className="surface-panel managed-create-summary" aria-label="Arka summary">
  <div className="managed-create-assets"><div><div className="managed-create-label">Share value &amp; withdrawals <ManagedContextHelp icon label="About the valuation and withdrawal currency" title="One currency, multiple assets"><p>Share values and withdrawal payments use {denomination}. The portfolio can still hold multiple approved assets.</p><p>The denomination is the accounting currency, not a restriction to a single asset. Deposits do not automatically swap assets.</p></ManagedContextHelp></div><strong>{denomination}</strong></div><div><span className="managed-create-label">Accepted assets</span><strong>{data.assets.map(a=>a.symbol).join(' · ')}</strong></div></div>
  <CreationFees data={data}/><p className="surface-note">Test-template fees, not production pricing. Multi-asset deposits do not automatically swap assets.</p>{data.depositProtectionVersion===1?<p className="surface-note">Deposits require a reviewed minimum number of shares. If it cannot be met, the complete deposit reverts.</p>:null}
  <div className="managed-create-exits"><div className="managed-create-exits-heading"><h2>Investor withdrawals</h2><ManagedContextHelp label="How withdrawals work" title="How investor withdrawals work"><WithdrawalTerms data={data}/></ManagedContextHelp></div><p>Investors request an exit. Payment depends on liquidity, with no guaranteed date.</p><p className="surface-note">Investments remain exposed to gains, losses and fees until settlement. Cancellation pauses during processing.</p></div>
  <details className="managed-create-technical"><summary>Technical details</summary><PublicAddress label="Manager" value={wallet||'Not connected'}/><PublicAddress label="Factory" value={data.factory}/><p>Local Standalone · Local managed Arka · Fixed test template; custom naming and strategy metadata are not included.</p><p>Cash buffer: {data.policy.buffer_bps/100}% · Swap slippage ceiling: {data.portfolioPolicy.max_slippage_bps/100}%. Approved mock oracle and routes only; real-market liquidity is not tested.</p></details>
  <div className="managed-create-actions"><p className="surface-note">Creates an empty Arka. No deposit in this step.</p><button className="surface-button surface-button-primary" disabled={disabled} onClick={()=>{setReview(JSON.stringify(data));setError('');setNotice('');}}>Review creation</button></div>
 </section>:null}
 {data&&review&&!pending&&!complete?<section className="surface-panel managed-review" aria-label="Creation review"><div className="managed-create-review-context"><strong>Local Standalone · Fictitious assets only</strong><span>Manager: {wallet.slice(0,6)}…{wallet.slice(-4)}</span><span>One signature creates the Arka and its share token. No deposit or change to an existing fund.</span></div><div className="managed-create-assets"><div><span className="managed-create-label">Share value &amp; withdrawals</span><strong>{denomination}</strong></div><div><span className="managed-create-label">Accepted assets</span><strong>{data.assets.map(a=>a.symbol).join(' · ')}</strong></div></div><CreationFees data={data}/><h2>Withdrawal terms</h2><WithdrawalTerms data={data}/><p className="surface-note">Network fee is calculated before signing and capped at 1 fictitious XLM. You have up to 10 minutes to sign; requests are never renewed automatically. A changed factory template requires a new review.</p>
  {busy?<div className="managed-create-signing"><strong role="status">{phase==='awaiting_signature'?'Waiting for your signature in Freighter':phase==='submitting'?'Checking the local ledger':'Preparing your local transaction'}</strong>{signing&&phase==='awaiting_signature'?<><span aria-live="off">{signing.feeRaw?`Network fee: ${units(signing.feeRaw)} fictitious XLM. `:''}{remaining>0?`Time remaining: ${Math.floor(remaining/60)}:${String(remaining%60).padStart(2,'0')}.`:''}</span>{remaining===0?<span role="alert">This request expired. Close it in Freighter; do not sign it.</span>:null}<code className="managed-contract">Request: {signing.id}</code></>:null}</div>:null}
  <div className="surface-entry-actions"><button className="surface-button surface-button-primary" disabled={disabled} onClick={()=>void confirm()}>{busy?'Working…':'Create in Freighter'}</button><button className="surface-button surface-button-secondary" disabled={busy} onClick={()=>{setReview(null);setError('');setNotice('');}}>Back to summary</button></div></section>:null}
 {pending?<section className="surface-panel managed-review"><h2>Creation receipt</h2><p>Do not repeat creation while its result is unknown. This receipt survives a reload.</p><code className="managed-contract">{pending.id}</code><button className="surface-button surface-button-secondary" disabled={busy} onClick={()=>void checkReceipt()}>Check confirmation only</button></section>:null}
 {complete?<section className="surface-panel"><h2>Your Arka is ready for a local deposit</h2><div className="surface-entry-actions">{created?<Link className="surface-button surface-button-primary" href={`/arkas/${created}`}>Open Arka and deposit</Link>:null}<Link className="surface-button surface-button-secondary" href="/manage">Funds I manage</Link></div></section>:null}
 </main>;
}
