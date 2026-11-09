'use client';
import {useEffect,useRef,useState} from 'react';
import {units,type ProductFund} from '@/lib/managedProduct';
import {localWithdrawalPlan} from '@/lib/managedSorobanTransport';
import type {ManagedWalletAction} from '@/lib/managedWithdrawals';
import {managedQueueCanAdvance} from '@/lib/managedWithdrawalOperations';

/** Manual, one step per review. Sizing and authorization belong to the contract. */
export function ManagedWithdrawalProcessing({fund,wallet,disabled,readOnly,onReview,onInvalidate,readPlan}:{fund:ProductFund;wallet:string;disabled:boolean;readOnly:boolean;onReview:(value:{action:ManagedWalletAction;description:string})=>void;onInvalidate:()=>void;readPlan?:(fund:string,owner:string)=>Promise<import('@/lib/managedWithdrawalOperations').ManagedSpotStep|null>}){
 const [loading,setLoading]=useState(false),[error,setError]=useState('');
 const current=useRef({fund:fund.id,wallet,disabled,readOnly}),mounted=useRef(true);current.current={fund:fund.id,wallet,disabled,readOnly};
 useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;};},[]);
 const blocked=disabled||readOnly||loading||!fund.status||!!fund.valuationError;
 const queueProgress=managedQueueCanAdvance(fund),pending=BigInt(fund.queue.pending_shares)>BigInt(0);
 async function reviewLiquidity(){
  if(blocked||!pending)return;const selected=JSON.stringify(current.current);setLoading(true);setError('');onInvalidate();
  try{
   const step=await (readPlan??localWithdrawalPlan)(fund.id,wallet);
   if(!mounted.current||JSON.stringify(current.current)!==selected)return;
   if(!step){setError('No executable liquidity step is available. Reserved funds remain available to collect.');return;}
   if(step.asset_out.contract!==fund.token||!fund.portfolioPolicy?.routes.some(r=>r.asset===step.asset_in.contract))throw Error('The withdrawal route does not match this Arka. Refresh before reviewing again.');
   const symbol=fund.holdings?.find(h=>h.asset===step.asset_in.contract)?.symbol??step.asset_in.contract;
   onReview({action:{action:'recover-spot',actor:fund.manager===wallet?'manager':'executor',step},description:`Sell ${units(step.amount_in)} ${symbol}. At least ${units(step.min_out)} ${fund.symbol} returns to this Arka for withdrawal settlement. Review the next step after confirmation.`});
  }catch(e){if(mounted.current&&JSON.stringify(current.current)===selected)setError(e instanceof Error?e.message:'Withdrawal processing is unavailable.');}
  finally{if(mounted.current)setLoading(false);}
 }
 return <details className="surface-panel"><summary>Process withdrawals</summary>
  <p>Review one liquidity step at a time, then settle eligible withdrawals against available cash. Investors collect their own reserved funds.</p>
  {readOnly?<p>Processing is disabled in this read-only view.</p>:null}
  <div className="surface-entry-actions">
   <button type="button" className="surface-button surface-button-secondary" disabled={blocked||!pending} onClick={()=>void reviewLiquidity()}>{loading?'Checking the contract…':'Review next liquidity step'}</button>
   <button type="button" className="surface-button surface-button-secondary" disabled={blocked||(!queueProgress&&!pending)} onClick={()=>{setError('');onReview({action:{action:'settle',actor:fund.manager===wallet?'manager':'executor'},description:'Advance up to 16 withdrawal requests and settle eligible amounts using available cash. Investors collect their own reserved funds.'});}}>Review settlement</button>
  </div>
  {error?<p role="alert">{error}</p>:null}
 </details>;
}
