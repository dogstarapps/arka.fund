'use client';
import {useEffect,useRef,useState} from'react';
import{generalRead}from'@/lib/generalMainnet';
import{units,type ProductFund,type ProductRequest}from'@/lib/managedProduct';
import{withdrawalHistoryPage}from'@/lib/managedCatalog';

type History=NonNullable<ProductFund['withdrawalHistory']>;
type Props={fund:ProductFund;readPage?:typeof generalRead};

export function ManagedWithdrawalHistory({fund,readPage}:Props){
 const history=fund.withdrawalHistory;
 if(!history||history.closedCount===0)return null;
 return <WithdrawalHistorySession key={JSON.stringify([fund.id,history.owner,history.codeHash])} fund={fund} latest={history} readPage={readPage}/>;
}

function WithdrawalHistorySession({fund,latest,readPage}:Props&{latest:History}){
 const [snapshot,setSnapshot]=useState<History|null>(null),[page,setPage]=useState<{offset:number;items:ProductRequest[]}|null>(null),[loading,setLoading]=useState(false),[error,setError]=useState('');
 const request=useRef(0),history=snapshot??latest;
 useEffect(()=>()=>{request.current++;},[]);
 async function load(offset:number,selected=history){
  if(loading)return;
  const ticket=++request.current;
  setSnapshot(selected);setLoading(true);setError('');
  try{
   const response=await (readPage??generalRead)('withdrawal-history',{fund:fund.id,owner:selected.owner,observationId:selected.observationId,offset:String(offset)});
   if(request.current!==ticket)return;
   const items=withdrawalHistoryPage({...fund,withdrawalHistory:selected},response,offset);
   setPage({offset,items});
  }catch(e){if(request.current===ticket)setError(e instanceof Error?e.message:'Withdrawal history is unavailable.');}
  finally{if(request.current===ticket)setLoading(false);}
 }
 return <details onToggle={event=>{
  if(!event.currentTarget.open){request.current++;setSnapshot(null);setPage(null);setLoading(false);setError('');}
  else if(!page&&!loading&&!error)void load(0,latest);
 }}><summary>Past withdrawals ({history.closedCount})</summary>
  <p>Collected: {units(history.closedPaidAssetsRaw)} {fund.symbol}</p>
  <p className="surface-note">Close and reopen to refresh this history.</p>
  {loading?<p role="status">Loading withdrawal history…</p>:null}{error?<p role="alert">{error}</p>:null}
  {!page&&error?<button type="button" disabled={loading} onClick={()=>void load(0)}>Retry history</button>:null}
  {page?.items.map(row=><article className="managed-withdrawal-row" key={row.id}><div><h3>Request #{row.id}</h3><p>Collected: {units(row.claimed_assets)} {fund.symbol} · Cancelled: {units(row.cancelled_shares)} shares</p></div></article>)}
  {page?<div className="surface-entry-actions"><button type="button" disabled={loading||page.offset===0} onClick={()=>void load(Math.max(0,page.offset-25))}>Previous withdrawals</button><span>{page.offset+1}–{page.offset+page.items.length} of {history.closedCount}</span><button type="button" disabled={loading||page.offset+page.items.length>=history.closedCount} onClick={()=>void load(page.offset+25)}>Next withdrawals</button></div>:null}
 </details>;
}
