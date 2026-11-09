'use client';
import {useEffect,useRef,useState} from 'react';
import {draftCheckError} from './v3DraftCopy';
import {ManagedContextHelp} from './ManagedContextHelp';
import {MainnetCreationExecution} from './MainnetCreationExecution';
import type {MainnetProfile,MainnetReview} from '@/lib/mainnetWalletConnector';
import {mainnetExecutionAvailable} from '@/lib/mainnetExecution';

type ReleaseData={creationUnavailable?:string;profile:MainnetProfile&{factory:string;v3Wasm:string};defaultDraft:{creatorPubKey:string;[key:string]:unknown}};
type Review={version:number;releaseId:string;readyForSignature:boolean;canSubmit:boolean};

export default function V3DefaultCreationReview({draft}:{draft:Record<string,unknown>}){
 const [data,setData]=useState<ReleaseData|null>(null),[manager,setManager]=useState('');
 const [checked,setChecked]=useState(false),[error,setError]=useState(''),[busy,setBusy]=useState(false);
 const [executionReview,setExecutionReview]=useState<MainnetReview|null>(null);
 const [reviewContext,setReviewContext]=useState<{draftKey:string;manager:string}|null>(null);
 const draftKey=JSON.stringify(draft);
 const current=useRef({draftKey,manager});current.current={draftKey,manager};
 useEffect(()=>{setChecked(false);setError('');setExecutionReview(null);setReviewContext(null);},[draftKey]);
 useEffect(()=>{
  const controller=new AbortController();
  fetch('/api/v3-release/profile',{cache:'no-store',signal:controller.signal})
   .then(async response=>{
    const value=await response.json();if(controller.signal.aborted)return;if(!response.ok)throw Error('PROFILE_UNAVAILABLE');
    setData(value);setManager(typeof draft.creatorPubKey==='string'?draft.creatorPubKey:'');
   }).catch(()=>{if(!controller.signal.aborted)setError(draftCheckError('PROFILE_UNAVAILABLE'));});
  return()=>controller.abort();
 },[draft.creatorPubKey]);
 async function prepare(){
  if(!data||busy||data.profile.creationFeeConfigured===false)return;
  const selected={draftKey,manager};setBusy(true);setError('');setChecked(false);setExecutionReview(null);
  try{
   const saltHex=Array.from(crypto.getRandomValues(new Uint8Array(32)),x=>x.toString(16).padStart(2,'0')).join('');const terms={...draft};delete terms.creatorPubKey;const text=JSON.stringify({...data.defaultDraft,...terms,saltHex,version:3,factoryId:data.profile.factory,creatorPubKey:manager});
   const response=await fetch('/api/v3-release/review?'+new URLSearchParams({draft:text}),{cache:'no-store'});
   const value=await response.json() as Review&{error?:string};
   if(!response.ok)throw Error(typeof value.error==='string'?value.error:'REVIEW_UNAVAILABLE');
   if(value.releaseId!==data.profile.releaseId||value.readyForSignature!==false||value.canSubmit!==false)throw Error('REVIEW_IDENTITY_MISMATCH');
   if(current.current.draftKey!==selected.draftKey||current.current.manager!==selected.manager)return;
   setReviewContext(selected);setChecked(true);
   setExecutionReview(value as unknown as MainnetReview);
  }catch(failure){if(current.current.draftKey===selected.draftKey&&current.current.manager===selected.manager)setError(failure instanceof Error?failure.message:'Review unavailable.');}
  finally{setBusy(false);}
 }
 const active=Boolean(data&&mainnetExecutionAvailable({...data.profile,codeHash:data.profile.v3Wasm}));
 const form=<div className="ops-field" style={{marginTop:'0.75rem'}}>
   <label htmlFor="v3-review-manager">Public account</label>
   <input id="v3-review-manager" className="ops-input" value={manager} onChange={event=>{setManager(event.target.value);setChecked(false);setExecutionReview(null);setError('');}} autoComplete="off" spellCheck={false}/>
   <button type="button" className="surface-button surface-button-secondary" data-testid="v3-prepare-review" disabled={busy||!data||data.profile.creationFeeConfigured===false} onClick={()=>void prepare()}>{busy?'Checking…':'Check draft'}</button>
   {error||data?.creationUnavailable?<p role="alert">{error||data?.creationUnavailable}</p>:null}
   {checked?<p role="status" data-testid="v3-prepared-review">{active?'Draft checked. Review the creation fee before confirming.':'Draft checked. Nothing was created.'}</p>:null}
  </div>;
 const execution=data?<MainnetCreationExecution profile={{...data.profile,codeHash:data.profile.v3Wasm}} review={reviewContext?.draftKey===draftKey&&reviewContext.manager===manager?executionReview:null}/>:null;
 return <span data-testid="v3-default-creation">{active?<><p>Review the empty portfolio before approving creation in your wallet. Depositing is a separate action.</p>{form}{execution}</>:<ManagedContextHelp icon label="About this preview" title="About this preview">
  <p>You can review a draft here. No Arka is created and no wallet signature is requested.</p>
  <details><summary>Check a preview draft</summary>{form}</details>{execution}
 </ManagedContextHelp>}</span>;
}
