'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { formatUnits as fmt, parseUnits, requestLabel, sharesForAssets, type ManagedState, type PreviewAction, type ManagedWalletAction } from '@/lib/managedWithdrawals';
import {useManagedLocalWallet} from './ManagedWalletControls';
import './managed.css';
import './integration.css';

function stamp(t: number) { return t ? new Date(t*1000).toLocaleString('en-GB',{timeZone:'UTC',day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'})+' UTC' : 'No active request'; }
export default function ManagedWithdrawalsClient() {
  const [state,setState] = useState<ManagedState>();
  const wallet=useManagedLocalWallet(state,setState),walletRef=useRef(wallet),stateRef=useRef(state);walletRef.current=wallet;stateRef.current=state;
  const [role,setRole] = useState<'investor'|'manager'>('investor');
  const [actor,setActor] = useState<'a'|'b'>('a');
  const [amount,setAmount] = useState('600');
  const [busy,setBusy] = useState(false), [error,setError] = useState(''), [notice,setNotice] = useState('');
  const load = useCallback(async(action?: PreviewAction|{action:'create';actor:'manager'}|{action:'select';index:number}) => {
    setBusy(true);setError('');setNotice('');
    try {
      let data;
      if(action&&stateRef.current?.wallets&&!['reset','advance','select'].includes(action.action)){
        const request=action.action==='settle'?{action:'settle' as const,actor:walletRef.current.connectedActor??'executor'}:action;
        data=await walletRef.current.run(request as ManagedWalletAction);
      }else{
      const r = await fetch('/api/managed-withdrawals-preview', {method:action?'POST':'GET',cache:'no-store',
        headers:{'content-type':'application/json','x-arka-local-preview':'1'},body:action?JSON.stringify(action):undefined});
      data = await r.json();
      if(!r.ok) {
        const detail=typeof data.error==='string'?data.error:data.error?.message||'Preview unavailable.';
        throw new Error(detail.startsWith('Contract rejected') ? 'The contract rejected this action. Nothing changed: check the cutoff, your shares and available liquidity.' : detail);
      }
      }
      if(data.state){stateRef.current=data.state;setState(data.state);}
      if(action)setNotice(({create:'Arka created locally, with its withdrawal policy already active. No investor funds were moved.',select:'Selected local Arka.',request:'Request received. Your shares remain invested until settlement.',settle:'Batch processed. Only settled amounts are ready to claim.',claim:'Payment received in the simulated wallet.',cancel:'Unsettled shares returned. Any settled cash is still yours to claim.',prepare:'Liquidity returned to the Arka. Process a batch to reserve payments.',advance:'Simulation clock updated.',reset:'Local simulation reset. No real funds were involved.'})[action.action]);
    } catch(e) {setError(e instanceof Error?e.message:'Preview unavailable.');}
    finally{setBusy(false);}
  },[]);
  useEffect(()=>{void load();},[load]);
  if(!state)return <main className="mw"><h1>Managed withdrawals</h1><p>{error||'Loading the local contract simulator…'}</p><button onClick={()=>void load()}>Retry</button></main>;
  const account=state.accounts.find(a=>a.id===actor)!;
  const rows=state.requests.filter(r=>r.actor===actor);
  const pending=rows.reduce((n,r)=>n+BigInt(r.pendingShares),BigInt(0));
  const claimable=rows.reduce((n,r)=>n+BigInt(r.claimableAssets),BigInt(0));
  const paid=rows.reduce((n,r)=>n+BigInt(r.claimedAssets),BigInt(0));
  const invested=BigInt(state.totalShares)>BigInt(0)?(BigInt(account.freeShares)+pending)*BigInt(state.nav)/BigInt(state.totalShares):BigInt(0);
  let estimate=BigInt(0);let inputError='';
  try{estimate=sharesForAssets(parseUnits(amount),state.nav,state.totalShares);if(estimate>BigInt(account.freeShares))inputError='Amount exceeds your available investment.';else if(estimate<BigInt(state.policy.minRequestShares)&&estimate!==BigInt(account.freeShares))inputError='Minimum request: 1 share, unless withdrawing your full balance.';}catch{inputError='Enter an amount with up to 7 decimals.';}
  const hasPending=pending>BigInt(0);
  const ready=state.requests.some(r=>BigInt(r.pendingShares)>BigInt(0)&&state.clock>=r.eligibleAt);
  const nextCutoff=(Math.floor(state.clock/state.policy.epochSeconds)+1)*state.policy.epochSeconds;
  const canRecover=ready&&BigInt(state.recoveryAvailable)>BigInt(0);
  const btn=(label:string,action:PreviewAction|{action:'create';actor:'manager'},disabled=false,secondary=false)=>{
    const needsWallet=!!state.wallets&&!['reset','advance'].includes(action.action);
    const wrongWallet=needsWallet&&(!wallet.connectedActor||('actor'in action&&wallet.connectedActor!==action.actor));
    return <button className={secondary?'mw-secondary':'mw-primary'} disabled={busy||disabled||wrongWallet} onClick={()=>void load(action)}>{label}</button>;
  };
  return <main className="mw">
    <div className="mw-safety"><span className="mw-dot"/> LOCAL SIMULATION <span>No real funds · Test-wallet signatures only · No blockchain connection</span></div>
    <header className="mw-heading"><div><p className="mw-eyebrow">ARKA INCOME / WITHDRAWALS</p><h1>Withdraw from this Arka</h1><p>Choose an amount, track settlement and claim the USDC reserved for you.</p></div><div className="mw-role" aria-label="Preview role"><button aria-pressed={role==='investor'} onClick={()=>setRole('investor')}>Investor</button><button aria-pressed={role==='manager'} onClick={()=>setRole('manager')}>Manager</button></div></header>
    {wallet.controls}{wallet.dialog}
    {state.funds?<div className="mw-account"><label htmlFor="mw-fund">Local Arka</label><select id="mw-fund" value={state.funds.find(f=>f.address===state.fund)?.index??0} disabled={busy} onChange={e=>void load({action:'select',index:Number(e.target.value)})}>{state.funds.map(f=><option key={f.address} value={f.index}>{f.label}</option>)}</select><span>{state.fund?.slice(0,8)}…{state.fund?.slice(-4)}</span></div>:null}
    <ol className="mw-steps"><li><b>01</b><div><strong>Request</strong><span>Choose how much to withdraw</span></div></li><li><b>02</b><div><strong>Settlement</strong><span>Liquidity is reserved in order</span></div></li><li><b>03</b><div><strong>Claim</strong><span>Receive USDC without the manager</span></div></li></ol>
    {error?<div role="alert" className="mw-error">{error}</div>:null}{notice?<div role="status" className="mw-notice">{notice}</div>:null}
    {role==='investor'?<>
      <div className="mw-account"><label htmlFor="mw-investor">Simulated investor</label><select id="mw-investor" value={actor} disabled={busy} onChange={e=>{setActor(e.target.value as 'a'|'b');setNotice('');setError('');}}><option value="a">Investor A</option><option value="b">Investor B</option></select><span>Wallet received: {fmt(account.walletCash)} USDC</span></div>
      <section className="mw-metrics" aria-label="Your withdrawal balances"><article><span>Still invested</span><strong>{fmt(invested)} <small>USDC</small></strong><p>Includes shares waiting for settlement</p></article><article><span>Waiting for settlement</span><strong>{fmt(pending)} <small>shares</small></strong><p>Value can change until settled</p></article><article className="mw-highlight"><span>Ready to claim</span><strong data-testid="ready-amount">{fmt(claimable)} <small>USDC</small></strong><p>Reserved for you, outside the fund NAV</p></article><article><span>Already paid</span><strong data-testid="paid-amount">{fmt(paid)} <small>USDC</small></strong><p>Sent to your simulated wallet</p></article></section>
      <div className="mw-columns"><section className="mw-panel"><p className="mw-eyebrow">START A WITHDRAWAL</p><h2>How much would you like to withdraw?</h2><p>Payment is in USDC, the currency of this Arka. The final amount is set when your shares are settled.</p><form onSubmit={e=>{e.preventDefault();if(!inputError&&!hasPending)void load({action:'request',actor,sharesRaw:estimate.toString()});}}>
        <div className="mw-fields"><label>Currency<div className="mw-currency">◉ &nbsp; USDC</div></label><label>Estimated amount<input aria-label="Estimated amount" value={amount} onChange={e=>setAmount(e.target.value)} inputMode="decimal" autoComplete="off"/></label></div>
        <div className="mw-estimate"><span>Shares to request</span><strong>{estimate>BigInt(0)?fmt(estimate,7):'—'}</strong><button type="button" disabled={busy||BigInt(account.freeShares)===BigInt(0)} onClick={()=>{const a=BigInt(account.freeShares)*BigInt(state.nav)/BigInt(state.totalShares);setAmount(fmt(a,7).replaceAll(',',''));}}>Max</button></div>
        <p className="mw-hint">Available: {fmt(account.freeShares,7)} shares · Next cutoff: {stamp(nextCutoff)}</p>
        {hasPending?<p className="mw-hint">You already have a pending request. You can cancel its unsettled part below.</p>:inputError?<p className="mw-hint">{inputError}</p>:null}
        <button className="mw-primary mw-wide" type="submit" disabled={busy||hasPending||!!inputError||!!state.wallets&&wallet.connectedActor!==actor}>Request withdrawal</button>
        {state.wallets&&wallet.connectedActor!==actor?<p className="mw-hint">Connect the matching investor test wallet to request or claim.</p>:null}
      </form><p className="mw-fine">This locks shares, not a guaranteed USDC amount. Pending shares still participate in gains, losses and disclosed fund fees.</p></section>
      <aside className="mw-panel mw-terms"><p className="mw-eyebrow">KNOW BEFORE YOU REQUEST</p><h2>Withdrawal terms</h2><dl><div><dt>Settlement batches</dt><dd>Hourly cutoff · first in, first out</dd></div><div><dt>Partial payments</dt><dd>Allowed when liquidity is limited</dd></div><div><dt>Cancellation</dt><dd>Any part not yet settled</dd></div><div><dt>Exit fee</dt><dd>0% in this initial model</dd></div><div><dt>Manager inactive?</dt><dd>After 24 hours from the cutoff, anyone can trigger a bounded liquidity recovery.</dd></div></dl><p className="mw-fine">24 hours is not a payment deadline. Protocol liquidity, prices, network availability and asset restrictions can delay settlement. The 10% cash buffer is a pilot setting, not a guarantee.</p></aside></div>
      <section className="mw-panel"><div className="mw-section-title"><div><p className="mw-eyebrow">YOUR REQUESTS</p><h2>Follow your money</h2></div><span>{rows.length} request{rows.length===1?'':'s'}</span></div>{!rows.length?<div className="mw-empty">No withdrawal requests yet. Your investment stays in the Arka until you request an exit.</div>:<div className="mw-request-list">{rows.map(r=><article className="mw-request" key={r.id}><div><strong>Request #{r.id}</strong><span className="mw-pill">{requestLabel(r)}</span><p>Cutoff {stamp(r.eligibleAt)}</p></div><dl><div><dt>Still pending</dt><dd>{fmt(r.pendingShares,7)} shares</dd></div><div><dt>Ready to claim</dt><dd>{fmt(r.claimableAssets)} USDC</dd></div><div><dt>Already paid</dt><dd>{fmt(r.claimedAssets)} USDC</dd></div></dl><div className="mw-actions">{btn(`Claim ${fmt(r.claimableAssets)} USDC`,{action:'claim',actor,id:r.id},BigInt(r.claimableAssets)===BigInt(0))}{BigInt(r.pendingShares)>BigInt(0)?btn('Cancel unsettled part',{action:'cancel',actor,id:r.id},false,true):null}</div></article>)}</div>}</section>
    </>:<>
      {state.factory?<section className="mw-panel"><p className="mw-eyebrow">FACTORY / ATOMIC SETUP</p><h2>Create an Arka with managed withdrawals</h2><p>A new, empty USDC Arka with its share token, governed withdrawal policy and manager configured in one atomic operation. Pilot fees: 0%. Existing investor positions are not copied.</p>{btn('Review and create local Arka',{action:'create',actor:'manager'})}<p className="mw-fine">Connect the Manager test wallet. A failure rolls back deployment and registration together.</p></section>:null}
      <section className="mw-metrics"><article><span>Fund NAV</span><strong>{fmt(state.nav)} <small>USDC</small></strong><p>Excludes reserved payments</p></article><article><span>Unreserved cash</span><strong>{fmt(state.cash)} <small>USDC</small></strong><p>Includes the 10% buffer requirement</p></article><article className="mw-highlight"><span>Reserved for investors</span><strong>{fmt(state.reserved)} <small>USDC</small></strong><p>Cannot be reinvested</p></article><article><span>Pending requests</span><strong>{state.pendingCount}</strong><p>Strict FIFO · partial settlement allowed</p></article></section>
      <div className="mw-columns"><section className="mw-panel"><p className="mw-eyebrow">1 / PREPARE LIQUIDITY</p><h2>Fund the next withdrawal</h2><p>Recover only what the oldest request needs, including the buffer for investors who remain. No swaps, borrowing or arbitrary destinations.</p><dl className="mw-figures"><div><dt>Head request</dt><dd>{state.pendingCount?`#${state.head}`:'None'}</dd></div><div><dt>Additional cash needed</dt><dd>{fmt(state.recoveryNeeded)} USDC</dd></div><div><dt>Available from lending now</dt><dd>{fmt(state.recoveryAvailable)} USDC</dd></div></dl>{btn('Prepare available liquidity',{action:'prepare',actor:'manager',amountRaw:state.recoveryAvailable},!canRecover)}<p className="mw-fine">Recovered cash stays in the Arka. This does not pay investors or guarantee that a lending pool can honour a withdrawal.</p></section><section className="mw-panel"><p className="mw-eyebrow">2 / SETTLE THE QUEUE</p><h2>Reserve cash for investors</h2><p>Uses a single valuation per batch after fees. Burns only settled shares and protects the remaining fund’s cash buffer.</p><dl className="mw-figures"><div><dt>Cash available for settlement</dt><dd>{fmt(state.settleCapacity)} USDC</dd></div><div><dt>Maximum batch</dt><dd>16 requests</dd></div><div><dt>Requires manager signature?</dt><dd>No</dd></div></dl>{btn('Process settlement batch',{action:'settle'},!ready)}<p className="mw-fine">Investors then claim their own reserved USDC. A failed claim does not stop someone else’s payment.</p></section></div>
      <section className="mw-panel"><h2>Public recovery if the manager is inactive</h2><p>Eligible from {stamp(state.recoveryPublicAt)}. The same fixed adapter, asset, debt-free checks and amount limits apply.</p>{btn('Recover as a public executor',{action:'prepare',actor:'executor',amountRaw:state.recoveryAvailable},!canRecover||state.clock<state.recoveryPublicAt,true)}</section>
    </>}
    <details className="mw-lab"><summary>Local test controls · {stamp(state.clock)}</summary><p>These controls only change the in-memory test ledger. Refresh preserves this local session; restarting the simulator resets it. History is capped at the first 32 requests in this preview.</p><div className="mw-actions">{btn('Advance to next cutoff',{action:'advance',seconds:nextCutoff-state.clock},false,true)}{btn('Advance 24 hours',{action:'advance',seconds:86400},false,true)}{btn('Process batch as anyone',{action:'settle'},false,true)}{btn('Reset simulation',{action:'reset'},false,true)}</div><p className="mw-fine">Engine: compiled factory, Arka and ShareToken WASM in the Soroban test host. Pool and USDC are test doubles. The local bridge verifies test-wallet signatures; contract-host authorization is mocked. This is not a real-wallet, live-network or resource-limit test.</p></details>
  </main>;
}
