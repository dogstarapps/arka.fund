'use client';
import {useEffect,useRef,useState} from 'react';
import Link from 'next/link';
import {useWallet} from './ManagedProductSurface';
import {generalExecutionReceipt,generalExecutionTransport,mainnetWallet} from '@/lib/generalMainnet';
import {mainnetExecutionAvailable} from '@/lib/mainnetExecution';
import {executeMainnetWalletAction,ManagedActionRejected} from '@/lib/managedWalletFlow';
import {readProductReceipt,saveProductReceipt,clearProductReceipt,type PendingProductReceipt} from '@/lib/managedProduct';
import {formatUnits} from '@/lib/managedWithdrawals';
import type {MainnetProfile,MainnetReview} from '@/lib/mainnetWalletConnector';

/** The existing creator review gains the same wallet/receipt flow as investments. */
export function MainnetCreationExecution({profile,review}:{profile:MainnetProfile;review:MainnetReview|null}){
 const owner=useWallet(),[pending,setPending]=useState<PendingProductReceipt|null>(null),[busy,setBusy]=useState(false),[blocked,setBlocked]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState(''),[created,setCreated]=useState('');
 const draft=review?.intent.draft as {templateHash?:string;creationFee?:{token?:string;amountRaw?:string}}|undefined;
 const feeRaw=draft?.creationFee?.amountRaw;
 const feeChecked=typeof feeRaw==='string'&&/^(0|[1-9]\d{0,38})$/.test(feeRaw)&&feeRaw===profile.commercialFeeUsdcRaw&&draft?.templateHash===profile.templateHash&&draft?.creationFee?.token===profile.assets?.find(asset=>profile.assetSymbols?.[asset]==='USDC');
 const feeLabel=feeChecked?(formatUnits(feeRaw!,7).replace(/\.?0+$/,'')||'0'):null;
 const current=useRef({owner,factory:profile.factory,review});current.current={owner,factory:profile.factory,review};
 useEffect(()=>{setPending(null);setCreated('');setError('');setNotice('');setBlocked(false);if(owner&&profile.factory)try{const saved=readProductReceipt(profile.factory,owner);if(saved&&!saved.targetFund)throw Error('Stored creation receipt is incomplete. Review it before creating another Arka.');setPending(saved);}catch(e){setBlocked(true);setError((e as Error).message);}},[owner,profile.factory]);
 function finish(saved:PendingProductReceipt,ok:boolean){clearProductReceipt(saved);setPending(readProductReceipt(saved.fund,saved.owner));if(ok)setCreated(saved.targetFund!);setNotice(ok?'Arka created. No deposit has been made.':'Creation failed on-chain. Review the result before creating another Arka.');}
 async function confirm(){
  if(!review||!profile.factory||busy||pending||blocked||created||!mainnetExecutionAvailable(profile))return;
  if(!feeChecked){setError('Creation details are unavailable. Review again before signing.');return;}
  if(!owner||owner!==review.source){setError('Connect the reviewed manager wallet before creating this Arka.');return;}
  const selected=owner,target=review.fund,factory=profile.factory,selectedReview=review;
  const isCurrent=()=>current.current.owner===selected&&current.current.factory===factory&&current.current.review===selectedReview;setBusy(true);setError('');let saved:PendingProductReceipt|undefined;
  try{const transport=await generalExecutionTransport(target,selected,isCurrent);
   const result=await executeMainnetWalletAction({action:'create',actor:'manager',draft:review.intent.draft as Record<string,unknown>},mainnetWallet,transport,{expectedAddress:selected,expectedFund:target,isCurrent,onSubmitIntent:p=>{saved={id:p.id,owner:selected,fund:factory,targetFund:target,action:'create',expiresAt:p.expiresAt};saveProductReceipt(saved);setPending(saved);}});
   if(!isCurrent())return;if(result.catalogPending){setNotice('Creation confirmed. The catalog is updating; check confirmation only.');return;}if(saved)finish(saved,result.ok);
  }catch(e){if(e instanceof ManagedActionRejected&&saved)clearProductReceipt(saved);if(!isCurrent())return;try{setPending(readProductReceipt(factory,selected));}catch{setBlocked(true);}setError((e as Error).message);}finally{setBusy(false);}
 }
 async function receipt(){if(!pending||!pending.targetFund||busy)return;const matches=()=>current.current.owner===pending.owner&&current.current.factory===pending.fund;setBusy(true);setError('');try{const result=await generalExecutionReceipt(pending.id,pending.owner,pending.targetFund);if(!matches())return;if(!result){setNotice('Confirmation is unknown. Nothing was resent.');return;}if(result.catalogPending){setNotice('Creation confirmed. The catalog is updating; check confirmation only.');return;}finish(pending,result.ok);}catch(e){if(matches())setError((e as Error).message);}finally{setBusy(false);}}
 if(!mainnetExecutionAvailable(profile)&&!pending&&!created&&!blocked)return null;
 return <div>{feeLabel!==null?<p>Creation fee: {feeLabel} USDC, charged with creation. Network fees are additional.</p>:review?<p role="alert">Creation details are unavailable. Review again before signing.</p>:null}{error?<p role="alert">{error}</p>:null}{notice?<p role="status">{notice}</p>:null}{pending?<div><p>Keep this creation receipt. Do not create another Arka while confirmation is unresolved.</p><code>{pending.id}</code><button type="button" disabled={busy} onClick={()=>void receipt()}>Check confirmation only</button></div>:created?<Link href={'/arkas/'+created}>Open Arka and deposit</Link>:review?<button type="button" className="surface-button surface-button-primary" disabled={busy||!owner||owner!==review.source||blocked||!feeChecked} onClick={()=>void confirm()}>{busy?'Working…':'Create in Freighter'}</button>:null}</div>;
}
