'use client';
import {useEffect,useRef,useState} from 'react';
import {executeManagedWalletAction,localManagedTransport,localPreviewWallet,ManagedConfirmationUnknown,type WalletPhase} from '@/lib/managedWalletFlow';
import type {ManagedActor,ManagedState,ManagedWalletAction} from '@/lib/managedWithdrawals';
import {formatUnits} from '@/lib/managedWithdrawals';
const names:Record<ManagedActor,string>={a:'Investor A',b:'Investor B',manager:'Manager',executor:'Public executor'};
export function useManagedLocalWallet(state:ManagedState|undefined,onReceipt?:(state:ManagedState)=>void){
 const [choice,setChoice]=useState<ManagedActor>('a'),[connected,setConnected]=useState<ManagedActor>();
 const [phase,setPhase]=useState<WalletPhase>(),[review,setReview]=useState<string>();
 const [unknownReceipt,setUnknownReceipt]=useState<string>(),[receiptMessage,setReceiptMessage]=useState('');
 const resolver=useRef<((approved:boolean)=>void)|undefined>(undefined),context=useRef({state,connected});context.current={state,connected};
 useEffect(()=>()=>resolver.current?.(false),[]);
 const answer=(yes:boolean)=>{resolver.current?.(yes);resolver.current=undefined;setReview(undefined);};
 const run=async(action:ManagedWalletAction)=>{
  if(unknownReceipt)throw new Error('Check the pending receipt before starting another action. No write will be repeated.');
  const current=context.current;
  if(!current.connected||current.connected!==action.actor||!current.state?.wallets)throw new Error(`Connect the ${names[action.actor]} test wallet first.`);
  const address=current.state.wallets[action.actor],fund=current.state.fund,engine=current.state.engineId;
  const wallet=localPreviewWallet(action.actor,address,async()=>new Promise<boolean>(resolve=>{
   resolver.current=resolve;setReview(action.action==='create'?'Create a new, empty USDC Arka. Hourly FIFO settlement, 10% pilot buffer, 24-hour public recovery window, no exit fee. This creates local contracts only.':`${action.action==='prepare'?'Recover bounded lending liquidity':action.action==='settle'?'Settle the withdrawal queue':action.action==='request'?`Request withdrawal of ${formatUnits(action.sharesRaw,7)} shares`:action.action==='claim'?'Claim your reserved USDC':'Cancel only your unsettled shares'}. No real funds or personal wallet keys are used.`);
  }));
  try{return await executeManagedWalletAction(action,wallet,localManagedTransport(),{expectedAddress:address,expectedEngineId:engine,expectedRevision:current.state.revision,expectedFund:fund,onPhase:setPhase,isCurrent:()=>context.current.connected===action.actor&&context.current.state?.fund===fund&&context.current.state?.engineId===engine});}
  catch(error){if(error instanceof ManagedConfirmationUnknown)setUnknownReceipt(error.operationId);throw error;}
 };
 const checkReceipt=async()=>{
  if(!unknownReceipt)return;
  try{const receipt=await localManagedTransport().receipt(unknownReceipt);if(!receipt){setReceiptMessage('Still unconfirmed. No action was repeated.');return;}if(receipt.state)onReceipt?.(receipt.state);setUnknownReceipt(undefined);setPhase(receipt.ok?'confirmed':'rejected');setReceiptMessage(receipt.ok?'Receipt confirmed.':'Receipt confirms rejection; review before a new action.');}
  catch{setReceiptMessage('Receipt unavailable. No action was repeated.');}
 };
 return{choice,connectedActor:connected,phase,run,
  choose:(actor:ManagedActor)=>{setChoice(actor);setConnected(undefined);answer(false);setPhase(undefined);},
  connect:()=>{setConnected(choice);setPhase(undefined);},disconnect:()=>{setConnected(undefined);answer(false);setPhase(undefined);},
  controls:state?.wallets?<><section className="mw-wallet" aria-label="Local wallet connection"><div><strong>Local test wallet</strong><p>Ephemeral keys · signed XDR · isolated network · no real wallet</p></div><label className="sr-only" htmlFor="mw-wallet">Test wallet</label><select id="mw-wallet" value={choice} disabled={phase==='submitting'} onChange={e=>{setChoice(e.target.value as ManagedActor);setConnected(undefined);answer(false);setPhase(undefined);}}>{Object.entries(names).map(([id,label])=><option key={id} value={id}>{label}</option>)}</select><button className="mw-secondary" onClick={()=>{if(connected){setConnected(undefined);answer(false);}else setConnected(choice);}}>{connected?'Disconnect test wallet':'Connect test wallet'}</button><span className="mw-fine">{connected?`${names[connected]} connected · ${state.wallets[connected].slice(0,6)}…${state.wallets[connected].slice(-4)}`:'Not connected'}{phase?` · ${phase.replaceAll('_',' ')}`:''}</span></section>{unknownReceipt?<div className="mw-error" role="alert">Pending receipt: {unknownReceipt}. Do not repeat this action. <button className="mw-secondary" onClick={()=>void checkReceipt()}>Check receipt only</button></div>:null}{receiptMessage?<p role="status">{receiptMessage}</p>:null}</>:null,
  dialog:review?<div className="mw-modal-backdrop"><section className="mw-panel mw-modal" role="dialog" aria-modal="true" aria-labelledby="mw-review-title"><p className="mw-eyebrow">LOCAL TEST WALLET / REVIEW</p><h2 id="mw-review-title">Review and sign</h2><p>{review}</p><p className="mw-fine">Signer: {connected?names[connected]:'Disconnected'} · Standalone local network. Network fees are simulated, not charged.</p><div className="mw-actions"><button className="mw-secondary" autoFocus onClick={()=>answer(false)}>Reject signature</button><button className="mw-primary" onClick={()=>answer(true)}>Approve local signature</button></div></section></div>:null,
 };
}
