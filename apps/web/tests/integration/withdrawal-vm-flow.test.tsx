// Explicit opt-in: this UI-to-WASM test needs the isolated loopback fixture.
import React from 'react';import {render,screen,fireEvent,waitFor,cleanup,configure} from '@testing-library/react';import {beforeAll,afterEach,it,expect,vi} from 'vitest';
import {Account,SorobanDataBuilder,TransactionBuilder,xdr,type rpc} from '@stellar/stellar-sdk';
import {MANAGED_LOCAL_NETWORK,ManagedActionRejected} from '@/lib/managedWalletFlow';
const fixture=vi.hoisted(()=>({url:process.env.ARKA_WITHDRAWAL_VM_URL??'',fund:'',owner:'',calls:[] as string[],holdReceipt:false,loseNextReply:false,prepared:[] as any[],transport:null as any,server:null as any}));
async function api(path:string,value?:unknown){const r=await fetch(fixture.url+path,value===undefined?{}:{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(value)}),v=await r.json();if(!r.ok)throw Error(v.error);return v;}
vi.mock('next/navigation',()=>({useParams:()=>({id:fixture.fund})}));
vi.mock('@/lib/managedProduct',async original=>({...await original<typeof import('@/lib/managedProduct')>(),productRead:async(kind:string)=>kind==='fund'?api('/state'):{mode:'dry-run',lastTick:null,alerts:[]}}));
vi.mock('@/lib/managedProductWallet',()=>({productWallet:{getAddress:async()=>fixture.owner,getNetworkPassphrase:async()=>MANAGED_LOCAL_NETWORK,
 // Test approval returns the SAME unsigned envelope. No cryptographic API.
 signTransaction:async(encoded:string)=>{expect(TransactionBuilder.fromXDR(encoded,MANAGED_LOCAL_NETWORK).signatures).toHaveLength(0);fixture.calls.push('unsigned-test-approval');return encoded;}}}));
vi.mock('@/lib/managedSorobanTransport',async original=>{
 const real=await original<typeof import('@/lib/managedSorobanTransport')>();
 return{...real,localWithdrawalPlan:(fund:string,caller:string)=>real.readLocalWithdrawalPlan(fixture.server,fund,caller),createManagedSorobanTransport:(options:any)=>{
  const actual=real.createManagedSorobanTransport({...options,serverFactory:()=>fixture.server});fixture.transport=actual;
  return{prepare:async(action:any)=>{const p=await actual.prepare(action);fixture.prepared.push({action,p});return p;},receipt:async(id:string)=>fixture.holdReceipt?undefined:actual.receipt(id),
   // Test-only RAM application, NEVER actual.submit or sendTransaction.
   submit:async(id:string,encoded:string)=>{expect(TransactionBuilder.fromXDR(encoded,MANAGED_LOCAL_NETWORK).signatures).toHaveLength(0);await api('/apply',{id,xdr:encoded});fixture.calls.push('ram-apply');if(fixture.loseNextReply){fixture.loseNextReply=false;fixture.holdReceipt=true;throw Error('Simulated lost reply');}return actual.receipt(id);}};
 }};
});
import {ManagedFundSurface} from '@/components/product/ManagedProductSurface';
beforeAll(async()=>{if(!fixture.url)return;configure({asyncUtilTimeout:30000,getElementError:(message,container)=>Error(String(message)+'\nVISIBLE_TEXT: '+container.textContent)});const meta=await api('/meta');fixture.fund=meta.fund;fixture.owner=meta.owner;
 fixture.server={getNetwork:vi.fn().mockResolvedValue({passphrase:MANAGED_LOCAL_NETWORK}),getAccount:async()=>new Account(fixture.owner,(await api('/meta')).sequence),
  getTransaction:async(id:string)=>{const v=await api('/receipt?id='+id);return {...v,returnValue:v.returnValue?xdr.ScVal.fromXDR(v.returnValue,'base64'):undefined};},
  sendTransaction:()=>{throw Error('BROADCAST_FORBIDDEN');},
  simulateTransaction:async(tx:any)=>{const v=await api('/simulate',{xdr:tx.toXDR()});if(!v.success)return{error:v.error};return{_parsed:true,id:'isolated-vm',latestLedger:65206504,minResourceFee:String(v.resourceFeeRaw),events:[],transactionData:new SorobanDataBuilder(v.transactionData),result:{auth:v.auth.map((x:string)=>xdr.SorobanAuthorizationEntry.fromXDR(x,'base64')),retval:xdr.ScVal.fromXDR(v.result,'base64')}};}} as unknown as rpc.Server;
});
afterEach(cleanup);
it.runIf(!!fixture.url)('requests, resumes an ambiguous lot, replans five real Sushi lots, settles and collects without signing/broadcasting',async()=>{
 localStorage.clear();window.history.replaceState(null,'','/');localStorage.setItem('wallet:pubkey',fixture.owner);render(<ManagedFundSurface/>);
 fireEvent.click(await screen.findByRole('button',{name:'Withdraw all available shares'}));fireEvent.click(await screen.findByRole('button',{name:'Confirm in Freighter'}));await screen.findByText(/Withdrawal requested. Processing/);expect((await api('/state')).requests[0].pending_shares).toBe('10000000018');
 fireEvent.click(await screen.findByText('Process withdrawals'));await waitFor(()=>expect(screen.getByRole('button',{name:'Review settlement'})).not.toBeDisabled());fireEvent.click(screen.getByRole('button',{name:'Review settlement'}));const approvals=fixture.calls.filter(x=>x==='unsigned-test-approval').length;fireEvent.click(await screen.findByRole('button',{name:'Confirm in Freighter'}));await screen.findByText('No eligible withdrawal can be settled with the available cash yet.');expect(fixture.calls.filter(x=>x==='unsigned-test-approval').length).toBe(approvals);
 await api('/advance',{seconds:120});cleanup();render(<ManagedFundSurface/>);await screen.findByRole('heading',{name:'Local withdrawal rehearsal'});fireEvent.click(await screen.findByText('Process withdrawals'));
 for(let i=0;i<5;i++){
  fireEvent.click(screen.getByRole('button',{name:'Review next liquidity step'}));await screen.findByRole('heading',{name:'Review before signing'});expect(screen.getByRole('region',{name:'Review before signing'})).toHaveTextContent(i===0?'Sell 3.2377407 USDC':'Sell 3.2377406 USDC');
  const before=(await api('/proof')).executions.length;if(i===0)fixture.loseNextReply=true;
  fireEvent.click(screen.getByRole('button',{name:'Confirm in Freighter'}));
  if(i===0){await screen.findByRole('heading',{name:'Transaction receipt'});expect(screen.getByRole('button',{name:'Review next liquidity step'})).toBeDisabled();cleanup();render(<ManagedFundSurface/>);await screen.findByRole('heading',{name:'Transaction receipt'});fireEvent.click(await screen.findByText('Process withdrawals'));expect(screen.getByRole('button',{name:'Review next liquidity step'})).toBeDisabled();fixture.holdReceipt=false;fireEvent.click(screen.getByRole('button',{name:'Check confirmation only'}));await screen.findByText('Transaction confirmed. Balances refreshed.');}
  else await screen.findByText('Liquidity step confirmed. Review a fresh plan before processing another step.');
  await waitFor(()=>expect(screen.getByRole('button',{name:'Review next liquidity step'})).not.toBeDisabled());expect((await api('/proof')).executions.length).toBe(before+1);
  if(i===0){const old=fixture.prepared.at(-1).action,approvals=fixture.calls.length;await expect(fixture.transport.prepare(old)).rejects.toBeInstanceOf(ManagedActionRejected);expect(fixture.calls.length).toBe(approvals);}
 }
 const state=await api('/state');expect(state.holdings[1].cash).toBe('0');expect(state.queue.pending_shares).toBe('10000000018');
 fireEvent.click(screen.getByRole('button',{name:'Review settlement'}));fireEvent.click(await screen.findByRole('button',{name:'Confirm in Freighter'}));await screen.findByText('Settlement processed. Reserved amounts are available for their owners to collect.');
 fireEvent.click(await screen.findByRole('button',{name:/Collect 999\.4009043 XLM/}));fireEvent.click(await screen.findByRole('button',{name:'Confirm in Freighter'}));await screen.findByText('Withdrawal collected in your wallet.');
 const final=await api('/state'),proof=await api('/proof');expect(final.status.nav).toBe('0');expect(final.totalShares).toBe('0');expect(final.freeShares).toBe('0');expect(final.queue.pending_shares).toBe('0');expect(final.queue.reserved_assets).toBe('0');expect(final.requests[0].claimed_assets).toBe('9994009043');expect(final.requests[0].cancelled_shares).toBe('0');expect(final.holdings.every((h:any)=>h.cash==='0')).toBe(true);
 expect(proof.executions.map((x:any)=>x.method)).toEqual(['request_withdrawal',...Array(5).fill('liquidate_withdrawal'),'settle_withdrawals','claim_withdrawal']);expect(proof.signaturesCreated).toBe(0);expect(proof.transactionsSubmitted).toBe(0);expect(proof.productionAccess).toBe(false);
},240000);
