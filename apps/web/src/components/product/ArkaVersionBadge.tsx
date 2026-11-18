'use client';
import {useEffect,useState} from 'react';
export default function ArkaVersionBadge({id}:{id:string}){
 const [version,setVersion]=useState<number|null>(null);
 useEffect(()=>{
  const controller=new AbortController();setVersion(null);
  fetch('/api/v3-release/identity?fund='+encodeURIComponent(id),{signal:controller.signal,cache:'no-store'})
   .then(response=>response.ok?response.json():null)
   .then(value=>{if(value?.id===id&&[2,3].includes(value.version))setVersion(value.version);})
   .catch(()=>{});
  return()=>controller.abort();
 },[id]);
 return version===3?<span className="surface-status-pill" data-testid={'arka-version-'+id}>Mainnet · Read-only</span>:null;
}
