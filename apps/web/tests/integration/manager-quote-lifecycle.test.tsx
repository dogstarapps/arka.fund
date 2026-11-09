import React from 'react';
import {render,screen,fireEvent,cleanup,act,waitFor} from '@testing-library/react';
import {beforeEach,afterEach,it,expect,vi} from 'vitest';
import {StrKey} from '@stellar/stellar-sdk';
import type {ProductFund} from '@/lib/managedProduct';

const m=vi.hoisted(()=>({id:'',read:vi.fn(),fetch:vi.fn(),execute:vi.fn(),sign:vi.fn(()=>{throw Error('FORBIDDEN_WALLET_SIGNATURE');})}));
vi.mock('next/navigation',()=>({useParams:()=>({id:m.id})}));
vi.mock('@/lib/managedProduct',async original=>({...await original<typeof import('@/lib/managedProduct')>(),productRead:m.read}));
vi.mock('@/lib/generalMainnet',async original=>({...await original<typeof import('@/lib/generalMainnet')>(),GENERAL_MAINNET:true}));
vi.mock('@stellar/freighter-api',()=>({signTransaction:m.sign}));
vi.mock('@/lib/managedWalletFlow',async original=>({...await original<typeof import('@/lib/managedWalletFlow')>(),executeMainnetWalletAction:m.execute}));
import {ManagedFundSurface} from '@/components/product/ManagedProductSurface';

const owner=StrKey.encodeEd25519PublicKey(Buffer.alloc(32,1)),other=StrKey.encodeEd25519PublicKey(Buffer.alloc(32,2)),fundA=StrKey.encodeContract(Buffer.alloc(32,22)),fundB=StrKey.encodeContract(Buffer.alloc(32,24)),token=StrKey.encodeContract(Buffer.alloc(32,23)),assetA=StrKey.encodeContract(Buffer.alloc(32,25)),assetB=StrKey.encodeContract(Buffer.alloc(32,26)),adapter=StrKey.encodeContract(Buffer.alloc(32,27)),network='Public Global Stellar Network ; September 2015';
function model(id:string):ProductFund{const asset=id===fundA?assetA:assetB;return{id,name:id===fundA?'Portfolio A':'Portfolio B',symbol:'test units',manager:owner,token,network,clock:200,ledger:100,freeShares:'200000000',totalShares:'200000000',policy:{epoch_seconds:'60',manager_window:'60',min_request_shares:'1',buffer_bps:0},queue:{pending_shares:'0',reserved_assets:'0'},requests:[],requestsTruncated:false,valuationError:null,status:{nav:'200000000',total_shares:'200000000',cash:'200000000',settle_capacity:'200000000'},portfolioPolicy:{instant_cash:false,auto_payout:false,max_slippage_bps:100,cancel_lock_seconds:'3600',routes:[{asset,router:adapter}]},holdings:[{asset:token,symbol:'test units',cash:'0'},{asset,symbol:id===fundA?'ASSET_A':'ASSET_B',cash:'200000000'}]};}
function delayedQuote(){
 let respond!:(r:Response)=>void,selected:{fund:string;owner:string;asset:string;amountRaw:string;sell:string}|undefined;
 const pending=new Promise<Response>(yes=>{respond=yes;});
 m.fetch.mockImplementation(async(input:string,options?:RequestInit)=>{const u=new URL(input,'http://localhost');expect(options?.method??'GET').toBe('GET');expect(u.pathname).toBe('/api/mainnet-connector/quote');expect(u.searchParams.get('kind')).toBe('portfolio');selected={fund:u.searchParams.get('fund')!,owner:u.searchParams.get('owner')!,asset:u.searchParams.get('asset')!,amountRaw:u.searchParams.get('amountRaw')!,sell:u.searchParams.get('sell')!};return pending;});
 return{started:()=>waitFor(()=>expect(selected).toBeDefined()),selection:()=>selected,finish:async(error?:string)=>{expect(selected).toBeDefined();const s=selected!;await act(async()=>respond(new Response(JSON.stringify(error?{message:error}:{network,owner:s.owner,fund:s.fund,asset:s.asset,canSubmit:false,value:{adapter,pool_id:'0',asset_in:{contract:s.asset},asset_out:{contract:token},amount_in:s.amountRaw,min_out:(BigInt(s.amountRaw)*BigInt(99)/BigInt(100)).toString(),router_addr:adapter}}),{status:error?503:200})));}};
}
async function quoteInput(symbol='ASSET_A',value='1'){fireEvent.change(await screen.findByLabelText('Amount to pay ('+symbol+')'),{target:{value}});fireEvent.click(screen.getByRole('button',{name:'Review asset change'}));}
async function start(strict=false){const ui=render(strict?<React.StrictMode><ManagedFundSurface/></React.StrictMode>:<ManagedFundSurface/>);await screen.findByRole('heading',{name:'Portfolio A'});await quoteInput();return ui;}
async function switchOwner(who:string){await act(async()=>{localStorage.setItem('wallet:pubkey',who);fireEvent(window,new Event('wallet:pubkey-changed'));});expect(m.read.mock.calls.filter(([kind])=>kind==='fund').at(-1)?.[1].owner).toBe(who);}
beforeEach(()=>{vi.clearAllMocks();vi.stubEnv('NEXT_PUBLIC_MAINNET_EXECUTION_ENABLED','0');m.id=fundA;localStorage.clear();localStorage.setItem('wallet:pubkey',owner);window.history.replaceState(null,'','/');m.read.mockImplementation(async(kind:string,params:Record<string,string>)=>kind==='status'?{mode:'dry-run',lastTick:null,alerts:[]}:model(params.fund));vi.stubGlobal('fetch',m.fetch);});
afterEach(()=>{expect(m.execute).not.toHaveBeenCalled();expect(m.sign).not.toHaveBeenCalled();cleanup();vi.unstubAllGlobals();vi.unstubAllEnvs();vi.useRealTimers();});

it('keeps a current valid quote available for explicit review without an executor',async()=>{
 const quote=delayedQuote();await start();await quote.started();expect(quote.selection()).toEqual({fund:fundA,owner,asset:assetA,amountRaw:'10000000',sell:'true'});await quote.finish();await screen.findByRole('heading',{name:'Review before signing'});expect(screen.getByText(/Pay 1 ASSET_A; receive at least 0.99 test units/)).toBeInTheDocument();expect(screen.getByRole('button',{name:'Check transaction'})).not.toBeDisabled();expect(Object.keys(localStorage)).toEqual(['wallet:pubkey']);
});
it('keeps a current quote error visible and allows a new manual review',async()=>{
 const quote=delayedQuote();await start();await quote.started();await quote.finish('Current quote unavailable');await screen.findByText('Current quote unavailable');expect(screen.getByRole('button',{name:'Review asset change'})).not.toBeDisabled();const next=delayedQuote();fireEvent.click(screen.getByRole('button',{name:'Review asset change'}));await next.started();await next.finish();await screen.findByRole('heading',{name:'Review before signing'});expect(screen.queryByRole('alert')).not.toBeInTheDocument();expect(m.fetch).toHaveBeenCalledTimes(2);
});
for(const boundary of ['fund','fund-aba','owner','owner-aba','lookup','disconnect','unmount'] as const)it.each(['success','failure'])('discards an obsolete manager quote '+boundary+' %s',async outcome=>{
 const quote=delayedQuote(),ui=await start();await quote.started();
 if(boundary==='owner'||boundary==='owner-aba'){await switchOwner(other);expect(screen.queryByRole('heading',{name:'Change portfolio assets'})).not.toBeInTheDocument();if(boundary==='owner-aba'){await switchOwner(owner);expect(screen.getByLabelText('Amount to pay (ASSET_A)')).toHaveValue('');}}
 else if(boundary==='fund'||boundary==='fund-aba'){m.id=fundB;ui.rerender(<ManagedFundSurface/>);await screen.findByRole('heading',{name:'Portfolio B'});expect(screen.getByLabelText('Amount to pay (ASSET_B)')).toHaveValue('');if(boundary==='fund-aba'){m.id=fundA;ui.rerender(<ManagedFundSurface/>);await screen.findByRole('heading',{name:'Portfolio A'});expect(screen.getByLabelText('Amount to pay (ASSET_A)')).toHaveValue('');}}
 else if(boundary==='lookup'){fireEvent.change(screen.getByLabelText('Stellar public address'),{target:{value:other}});fireEvent.click(screen.getByRole('button',{name:'View holdings'}));await screen.findByText('Public address lookup · Read-only · Not a wallet connection');expect(screen.queryByRole('heading',{name:'Change portfolio assets'})).not.toBeInTheDocument();}
 else if(boundary==='disconnect'){localStorage.removeItem('wallet:pubkey');fireEvent(window,new Event('wallet:pubkey-changed'));await screen.findByText('Connect your wallet or explicitly look up a public address. No personal position has been assumed.');}
 else ui.unmount();
 await quote.finish(outcome==='failure'?'Old quote unavailable':undefined);expect(screen.queryByRole('heading',{name:'Review before signing'})).not.toBeInTheDocument();expect(screen.queryByText(/Pay 1 ASSET_A/)).not.toBeInTheDocument();expect(screen.queryByText('Old quote unavailable')).not.toBeInTheDocument();expect(m.fetch).toHaveBeenCalledOnce();
 if(['fund','fund-aba','owner-aba'].includes(boundary)){const symbol=boundary==='fund'?'ASSET_B':'ASSET_A';expect(screen.getByLabelText('Amount to pay ('+symbol+')')).toHaveValue('');fireEvent.change(screen.getByLabelText('Amount to pay ('+symbol+')'),{target:{value:'2'}});expect(screen.getByRole('button',{name:'Review asset change'})).not.toBeDisabled();}
});
it('accepts a current quote under StrictMode effect replay',async()=>{const quote=delayedQuote();await start(true);await quote.started();await quote.finish();await screen.findByRole('heading',{name:'Review before signing'});expect(screen.getByText(/Pay 1 ASSET_A/)).toBeInTheDocument();expect(screen.queryByRole('alert')).not.toBeInTheDocument();});
it('accepts a current quote through polling and same-session rerenders',async()=>{
 vi.useFakeTimers({shouldAdvanceTime:true});const quote=delayedQuote(),ui=await start();await quote.started();const reads=m.read.mock.calls.filter(([kind])=>kind==='fund').length;ui.rerender(<ManagedFundSurface/>);await vi.advanceTimersByTimeAsync(10000);expect(m.read.mock.calls.filter(([kind])=>kind==='fund')).toHaveLength(reads+1);await quote.finish();await screen.findByRole('heading',{name:'Review before signing'});expect(screen.getByText(/Pay 1 ASSET_A/)).toBeInTheDocument();
});
it.each(['fund','owner-aba'])('allows a fresh manual quote after changing '+ '%s',async boundary=>{
 const old=delayedQuote(),ui=await start();await old.started();if(boundary==='fund'){m.id=fundB;ui.rerender(<ManagedFundSurface/>);await screen.findByRole('heading',{name:'Portfolio B'});}else{await switchOwner(other);await switchOwner(owner);}
 await old.finish();expect(screen.queryByRole('heading',{name:'Review before signing'})).not.toBeInTheDocument();const fresh=delayedQuote(),symbol=boundary==='fund'?'ASSET_B':'ASSET_A';await quoteInput(symbol,'2');await fresh.started();expect(fresh.selection()?.fund).toBe(boundary==='fund'?fundB:fundA);await fresh.finish();await screen.findByRole('heading',{name:'Review before signing'});expect(screen.getByText(new RegExp('Pay 2 '+symbol+'; receive at least 1.98 test units'))).toBeInTheDocument();expect(m.fetch).toHaveBeenCalledTimes(2);
});
it('does not request a duplicate quote while the current one is loading',async()=>{
 const quote=delayedQuote();await start();await quote.started();const button=screen.getByRole('button',{name:'Checking estimate…'});expect(button).toBeDisabled();fireEvent.click(button);expect(m.fetch).toHaveBeenCalledOnce();await quote.finish();await screen.findByRole('heading',{name:'Review before signing'});expect(screen.getByRole('button',{name:'Review asset change'})).not.toBeDisabled();
});
it('does not replace a review prepared in the new fund with an old manager quote',async()=>{
 const quote=delayedQuote(),ui=await start();await quote.started();m.id=fundB;ui.rerender(<ManagedFundSurface/>);await screen.findByRole('heading',{name:'Portfolio B'});fireEvent.click(screen.getByRole('button',{name:'Withdraw all available shares'}));await screen.findByRole('heading',{name:'Review before signing'});expect(screen.getByText(/Request all 20 available shares/)).toBeInTheDocument();await quote.finish();expect(screen.getByText(/Request all 20 available shares/)).toBeInTheDocument();expect(screen.queryByText(/Pay 1 ASSET_A/)).not.toBeInTheDocument();expect(m.fetch).toHaveBeenCalledOnce();
});
