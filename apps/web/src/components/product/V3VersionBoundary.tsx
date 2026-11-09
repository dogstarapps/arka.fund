'use client';
import {useEffect,useState,type ReactNode} from 'react';
import {useParams} from 'next/navigation';
import {ManagedFundSurface} from '@/components/product/ManagedProductSurface';

export default function V3VersionBoundary({children}:{children:ReactNode}){
 const {id}=useParams<{id:string}>();
 const [state,setState]=useState<{id:string;version:2|3}|null>(null);
 const [unavailable,setUnavailable]=useState(false);
 useEffect(()=>{
  const controller=new AbortController();setState(null);setUnavailable(false);
  fetch('/api/v3-release/identity?fund='+encodeURIComponent(id),{signal:controller.signal,cache:'no-store'})
   .then(async response=>{
    const value=await response.json();
    if(controller.signal.aborted)return;
    if(!response.ok||value.id!==id||![2,3].includes(value.version))throw Error('UNVERIFIED');
    setState(value);
   }).catch(()=>{if(!controller.signal.aborted)setUnavailable(true);});
  return()=>controller.abort();
 },[id]);
 if(unavailable)return <section className="surface-panel"><h1>Arka unavailable</h1><p role="alert">This Arka could not be verified. Refresh before continuing.</p></section>;
 if(!state||state.id!==id)return <p role="status">Checking Arka…</p>;
 return <>{state.version===3?<div className="surface-chip-wrap" data-testid="arka-version"><span className="surface-status-pill">Stellar mainnet</span></div>:null}{state.version===3?<ManagedFundSurface/>:children}</>;
}
