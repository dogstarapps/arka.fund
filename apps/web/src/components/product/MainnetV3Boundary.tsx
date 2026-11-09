"use client";
import {useEffect,useState} from 'react';
import {useParams} from 'next/navigation';
import {ManagedFundSurface} from '@/components/product/ManagedProductSurface';
import {ManagedContextHelp} from '@/components/product/ManagedContextHelp';

type Identity={fund:string;kind:string;verificationMode:string;identity?:{wasmHash:string};observedAt?:string};
export default function MainnetV3Boundary(){
 const {id}=useParams<{id:string}>();
 const [identity,setIdentity]=useState<Identity|null>(null),[error,setError]=useState(false);
 useEffect(()=>{
  const controller=new AbortController();setIdentity(null);setError(false);
  void fetch('/api/managed-mainnet/identity?fund='+encodeURIComponent(id),{cache:'no-store',signal:controller.signal})
   .then(async response=>{
    const value=await response.json();
    if(!response.ok||value.fund!==id||!['v3','legacy','unknown'].includes(value.kind))throw Error('UNVERIFIED');
    setIdentity(value);
   }).catch(()=>{if(!controller.signal.aborted)setError(true);});
  return()=>controller.abort();
 },[id]);
 if(error)return <main className="surface-stack"><section className="surface-panel"><h1>Arka unavailable</h1><p role="alert">This Arka could not be verified. Refresh before continuing.</p></section></main>;
 if(!identity)return <main className="surface-stack"><p role="status">Checking Arka…</p></main>;
 if(identity.kind!=='v3')return <main className="surface-stack"><section className="surface-panel"><h1>{identity.kind==='legacy'?'Use the existing Arka view':'Arka unavailable'}</h1><p>{identity.kind==='legacy'?'This Arka has not changed. Open it from the catalog.':'This Arka could not be verified. No balance has been assumed.'}</p></section></main>;
 return <><div className="surface-note" data-testid="mainnet-provenance">{identity.verificationMode==='recorded-mainnet-replay'?'Snapshot preview · No live balances':'Public data · Read-only'} <ManagedContextHelp icon label="About these figures" title="About these figures"><p>{identity.verificationMode==='recorded-mainnet-replay'?'These figures replay a dated public snapshot. The simulated Arka has not been created on mainnet.':'These figures come from verified public mainnet reads.'}</p><p>Signing, payments and automatic withdrawal processing are disabled in this preview.</p></ManagedContextHelp></div><ManagedFundSurface/></>;
}
