'use client';
import {useEffect,useRef,useState} from 'react';
import {GENERAL_MAINNET,mainnetReadWallet} from '@/lib/generalMainnet';
import * as freighter from '@stellar/freighter-api';
import {connectProductWallet} from '@/lib/managedProductWallet';
export default function ManagedLocalConnect({variant='chrome'}:{variant?:'chrome'|'rail'}){
 const [pub,setPub]=useState(''),[error,setError]=useState(''),[busy,setBusy]=useState(false);
 const attempt=useRef(0);
 useEffect(()=>{
  const generation=attempt;
  // A connection completed in another tab supersedes this tab's old attempt.
  // This sync is display state only; signing still rechecks the live wallet/network.
  const sync=()=>{attempt.current++;setPub(localStorage.getItem('wallet:pubkey')??'');setError('');setBusy(false);};
  const storage=(event:StorageEvent)=>{if(event.key==='wallet:pubkey'||event.key===null)sync();};
  sync();window.addEventListener('wallet:pubkey-changed',sync);window.addEventListener('storage',storage);
  return()=>{generation.current++;window.removeEventListener('wallet:pubkey-changed',sync);window.removeEventListener('storage',storage);};
 },[]);
 const update=(value:string)=>{if(value)localStorage.setItem('wallet:pubkey',value);else localStorage.removeItem('wallet:pubkey');window.dispatchEvent(new CustomEvent('wallet:pubkey-changed',{detail:value}));};
 return <div className={`chrome-connect-stack chrome-connect-stack-${variant}`}>
  {pub?<div className={`chrome-connect-connected chrome-connect-connected-${variant}`}><span className={`chrome-connect-badge chrome-connect-badge-${variant}`}>{pub.slice(0,6)}…{pub.slice(-4)}</span><button className={`chrome-disconnect-button chrome-disconnect-button-${variant}`} onClick={()=>update('')}>Disconnect</button></div>:
  <button className={`chrome-connect-button chrome-connect-button-${variant}`} disabled={busy} onClick={async()=>{const current=++attempt.current;setBusy(true);setError('');try{const address=GENERAL_MAINNET?await (async()=>{const access=await freighter.requestAccess();if(access.error)throw Error('Wallet access was not granted.');await mainnetReadWallet.getNetworkPassphrase();return mainnetReadWallet.getAddress();})():await connectProductWallet();if(attempt.current===current)update(address);}catch(e){if(attempt.current===current)setError(e instanceof Error?e.message:'Wallet unavailable.');}finally{if(attempt.current===current)setBusy(false);}}}>{busy?'CONNECTING…':'CONNECT WALLET'}</button>}
  {error?<span role="alert" className="chrome-connect-error">{error}</span>:null}
 </div>;
}
