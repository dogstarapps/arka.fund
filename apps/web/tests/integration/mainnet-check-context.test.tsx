import React from 'react';
import {render,screen,fireEvent,cleanup,act,waitFor} from '@testing-library/react';
import {beforeEach,afterEach,it,expect,vi} from 'vitest';
import {Account,Address,Contract,StrKey,TransactionBuilder,nativeToScVal} from '@stellar/stellar-sdk';
import type {ProductFund} from '@/lib/managedProduct';
import type {MainnetIntent,MainnetReview} from '@/lib/mainnetWalletConnector';

const m=vi.hoisted(()=>({id:'',wallet:'',read:vi.fn(),fetch:vi.fn(),sign:vi.fn(()=>{throw Error('FORBIDDEN_WALLET_SIGNATURE');}),execute:vi.fn()}));
vi.mock('next/navigation',()=>({useParams:()=>({id:m.id})}));
vi.mock('@stellar/freighter-api',()=>({getAddress:async()=>({address:m.wallet}),getNetworkDetails:async()=>({networkPassphrase:'Public Global Stellar Network ; September 2015'}),signTransaction:m.sign}));
vi.mock('@/lib/generalMainnet',async original=>({...await original<typeof import('@/lib/generalMainnet')>(),GENERAL_MAINNET:true}));
vi.mock('@/lib/managedProduct',async original=>({...await original<typeof import('@/lib/managedProduct')>(),productRead:m.read}));
vi.mock('@/lib/managedWalletFlow',async original=>({...await original<typeof import('@/lib/managedWalletFlow')>(),executeMainnetWalletAction:m.execute}));
import {ManagedFundSurface} from '@/components/product/ManagedProductSurface';

const owner=StrKey.encodeEd25519PublicKey(Buffer.alloc(32,1)),other=StrKey.encodeEd25519PublicKey(Buffer.alloc(32,2)),fundA=StrKey.encodeContract(Buffer.alloc(32,22)),fundB=StrKey.encodeContract(Buffer.alloc(32,24)),token=StrKey.encodeContract(Buffer.alloc(32,23)),network='Public Global Stellar Network ; September 2015';
const confirmation='Transaction checked on Stellar mainnet. Network fee: 0.7654321 XLM. Signing and sending are disabled.';
function model(who:string,id:string):ProductFund{return{id,name:id===fundB?'Check fund B':who===other?'Check owner B':'Check fund A',symbol:'test units',manager:owner,token,network,clock:200,ledger:100,freeShares:'200000000',totalShares:'200000000',policy:{epoch_seconds:'60',manager_window:'60',min_request_shares:'1',buffer_bps:0},queue:{pending_shares:'0',reserved_assets:'0'},requests:[],requestsTruncated:false,valuationError:null,status:{nav:'200000000',total_shares:'200000000',cash:'200000000',settle_capacity:'200000000'}};}
function delayedCheck(){
 let respond!:(response:Response)=>void,received:{intent:MainnetIntent;source:string}|undefined;
 const delayed=new Promise<Response>(yes=>{respond=yes;});
 m.fetch.mockImplementation(async(input:string,options?:RequestInit)=>{
  const u=new URL(input,'http://localhost');expect(options?.method??'GET').toBe('GET');expect(u.pathname).toMatch(/^\/api\/mainnet-connector\/(profile|prepare)$/);
  if(u.pathname.endsWith('/profile'))return new Response(JSON.stringify({profile:{releaseId:'a'.repeat(64),v3Wasm:'b'.repeat(64)}}));
  received={intent:JSON.parse(u.searchParams.get('intent')!) as MainnetIntent,source:u.searchParams.get('source')!};return delayed;
 });
 return{
  started:()=>waitFor(()=>expect(received).toBeDefined()),
  intent:()=>received?.intent,
  finish:async(error?:string)=>{
   expect(received).toBeDefined();const {intent,source}=received!;
   const tx=new TransactionBuilder(new Account(source,'1'),{fee:'7654321',networkPassphrase:network}).addOperation(new Contract(intent.fund).call('request_withdrawal',new Address(source).toScVal(),nativeToScVal(BigInt(String(intent.sharesRaw)),{type:'i128'}))).setTimeout(300).build();expect(tx.signatures).toHaveLength(0);
   const review:MainnetReview={id:tx.hash().toString('hex'),source,fund:intent.fund,network,releaseId:'a'.repeat(64),codeHash:'b'.repeat(64),unsignedEnvelope:tx.toXDR(),expiresAt:Number(tx.timeBounds!.maxTime)*1000,readyForSignature:false,canSubmit:false,mode:'recorded-mainnet-replay',totalFeeRaw:tx.fee,ledger:100,intent};
   await act(async()=>respond(new Response(JSON.stringify(error?{message:error}:review),{status:error?503:200})));
  },
 };
}
async function start(){
 const ui=render(<ManagedFundSurface/>);await screen.findByRole('heading',{name:'Check fund A'});await check();return ui;
}
async function check(){fireEvent.click(await screen.findByRole('button',{name:'Withdraw all available shares'}));fireEvent.click(await screen.findByRole('button',{name:'Check transaction'}));}
async function switchOwner(who:string){m.wallet=who;localStorage.setItem('wallet:pubkey',who);fireEvent(window,new Event('wallet:pubkey-changed'));await screen.findByRole('heading',{name:who===owner?'Check fund A':'Check owner B'});}
beforeEach(()=>{vi.clearAllMocks();vi.stubEnv('NEXT_PUBLIC_MAINNET_EXECUTION_ENABLED','0');m.id=fundA;m.wallet=owner;localStorage.clear();localStorage.setItem('wallet:pubkey',owner);window.history.replaceState(null,'','/');m.read.mockImplementation(async(kind:string,params:Record<string,string>)=>kind==='status'?{mode:'dry-run',lastTick:null,alerts:[]}:model(params.owner,params.fund));vi.stubGlobal('fetch',m.fetch);});
afterEach(()=>{expect(m.sign).not.toHaveBeenCalled();expect(m.execute).not.toHaveBeenCalled();cleanup();vi.unstubAllGlobals();vi.unstubAllEnvs();vi.useRealTimers();});

it('shows a valid current review and releases busy without creating a recovery receipt',async()=>{
 const pending=delayedCheck();await start();await pending.started();expect(pending.intent()).toEqual({action:'request',sharesRaw:'200000000',fund:fundA});await pending.finish();await screen.findByText(confirmation);expect(screen.getByRole('button',{name:'Check transaction'})).not.toBeDisabled();expect(screen.queryByRole('alert')).not.toBeInTheDocument();expect(Object.keys(localStorage)).toEqual(['wallet:pubkey']);expect(m.fetch).toHaveBeenCalledTimes(2);
});
it('shows a current preparation failure and permits a new manual check',async()=>{
 const pending=delayedCheck();await start();await pending.started();await pending.finish('Current preparation unavailable');await screen.findByText('Current preparation unavailable');expect(screen.getByRole('button',{name:'Check transaction'})).not.toBeDisabled();const retry=delayedCheck();fireEvent.click(screen.getByRole('button',{name:'Check transaction'}));await retry.started();await retry.finish();await screen.findByText(confirmation);expect(screen.queryByRole('alert')).not.toBeInTheDocument();expect(m.fetch).toHaveBeenCalledTimes(4);
});
it('preserves a current wallet identity rejection from the actual validator',async()=>{
 const pending=delayedCheck();await start();await pending.started();m.wallet=other;await pending.finish();await screen.findByText('Wallet changed. Review again.');expect(screen.queryByText(confirmation)).not.toBeInTheDocument();expect(screen.getByRole('button',{name:'Check transaction'})).not.toBeDisabled();
});
it('accepts the current review through same-session polling and rerenders',async()=>{
 vi.useFakeTimers({shouldAdvanceTime:true});const pending=delayedCheck(),ui=await start();await pending.started();const reads=m.read.mock.calls.filter(([kind])=>kind==='fund').length;ui.rerender(<ManagedFundSurface/>);await vi.advanceTimersByTimeAsync(10000);expect(m.read.mock.calls.filter(([kind])=>kind==='fund')).toHaveLength(reads+1);await pending.finish();await screen.findByText(confirmation);expect(screen.queryByRole('alert')).not.toBeInTheDocument();
});
for(const boundary of ['owner','fund','owner-aba','fund-aba','lookup','disconnect','unmount'] as const)it.each(['success','failure'])('discards an obsolete '+boundary+' review %s and releases busy',async outcome=>{
 const pending=delayedCheck(),ui=await start();await pending.started();
 if(boundary==='owner'||boundary==='owner-aba'){await switchOwner(other);if(boundary==='owner-aba')await switchOwner(owner);}
 else if(boundary==='fund'||boundary==='fund-aba'){m.id=fundB;ui.rerender(<ManagedFundSurface/>);await screen.findByRole('heading',{name:'Check fund B'});if(boundary==='fund-aba'){m.id=fundA;ui.rerender(<ManagedFundSurface/>);await screen.findByRole('heading',{name:'Check fund A'});}}
 else if(boundary==='lookup'){fireEvent.change(screen.getByLabelText('Stellar public address'),{target:{value:other}});fireEvent.click(screen.getByRole('button',{name:'View holdings'}));await screen.findByRole('heading',{name:'Check owner B'});}
 else if(boundary==='disconnect'){m.wallet='';localStorage.removeItem('wallet:pubkey');fireEvent(window,new Event('wallet:pubkey-changed'));await screen.findByText('Connect your wallet or explicitly look up a public address. No personal position has been assumed.');}
 else ui.unmount();
 if(boundary!=='unmount'&&boundary!=='disconnect')expect(screen.getByRole('button',{name:'Withdraw all available shares'})).toBeDisabled();
 await pending.finish(outcome==='failure'?'Old preparation unavailable':undefined);
 expect(screen.queryByText(confirmation)).not.toBeInTheDocument();expect(screen.queryByText('Old preparation unavailable')).not.toBeInTheDocument();expect(screen.queryByText('Wallet changed. Review again.')).not.toBeInTheDocument();
 if(['owner','fund','owner-aba','fund-aba'].includes(boundary))expect(screen.getByRole('button',{name:'Withdraw all available shares'})).not.toBeDisabled();
 expect(m.fetch).toHaveBeenCalledTimes(2);
});
it.each(['owner','fund'])('allows a fresh manual check for the new %s after discarding the old result',async boundary=>{
 const pending=delayedCheck(),ui=await start();await pending.started();if(boundary==='owner')await switchOwner(other);else{m.id=fundB;ui.rerender(<ManagedFundSurface/>);await screen.findByRole('heading',{name:'Check fund B'});}
 await pending.finish();expect(screen.queryByText(confirmation)).not.toBeInTheDocument();const fresh=delayedCheck();await check();await fresh.started();expect(fresh.intent()?.fund).toBe(boundary==='fund'?fundB:fundA);await fresh.finish();await screen.findByText(confirmation);expect(screen.queryByRole('alert')).not.toBeInTheDocument();expect(m.fetch).toHaveBeenCalledTimes(4);
});
