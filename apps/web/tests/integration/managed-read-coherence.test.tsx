import React from 'react';
import {render,screen,fireEvent,cleanup,act} from '@testing-library/react';
import {beforeEach,afterEach,it,expect,vi} from 'vitest';
import {StrKey} from '@stellar/stellar-sdk';
const control=vi.hoisted(()=>({id:'',read:vi.fn()}));
vi.mock('next/navigation',()=>({useParams:()=>({id:control.id})}));
vi.mock('@/lib/managedProduct',async original=>({...await original<typeof import('@/lib/managedProduct')>(),productRead:control.read}));
import ManagedPortfolioSurface,{ManagedFundSurface} from '@/components/product/ManagedProductSurface';
import {withManagedCatalogPosition} from '@/lib/managedCatalog';
import type {ProductFund} from '@/lib/managedProduct';

const owner=StrKey.encodeEd25519PublicKey(Buffer.alloc(32,1)),other=StrKey.encodeEd25519PublicKey(Buffer.alloc(32,2)),id=StrKey.encodeContract(Buffer.alloc(32,22)),otherId=StrKey.encodeContract(Buffer.alloc(32,24)),token=StrKey.encodeContract(Buffer.alloc(32,23));
const deferred=<T,>()=>{let resolve!:(v:T)=>void,reject!:(e:Error)=>void;const promise=new Promise<T>((yes,no)=>{resolve=yes;reject=no;});return{promise,resolve,reject};};
function model(ledger:number,shares=100000000,who=owner,fundId=control.id):ProductFund{
 const now=Date.now(),raw=String(shares),fund={id:fundId,name:'Read at ledger '+ledger,symbol:'test units',manager:who,token,network:'Standalone Network ; February 2017',clock:Math.floor(now/1000),ledger,freeShares:raw,totalShares:raw,policy:{epoch_seconds:'60',manager_window:'60',min_request_shares:'1',buffer_bps:0},queue:{pending_shares:'0',reserved_assets:'0'},requests:[],requestsTruncated:false,valuationError:null,status:{nav:raw,total_shares:raw,cash:raw,settle_capacity:raw},depositProtectionVersion:1} satisfies ProductFund;
 return withManagedCatalogPosition(fund,who,{schemaVersion:1,version:3,complete:true,stale:false,arkaId:fundId,owner:who,denominationContract:token,ledger,indexedAt:new Date(now).toISOString(),observationId:ledger.toString(16).padStart(64,'0'),codeHash:'b'.repeat(64),totalShares:raw,nav:raw,reservedAssets:'0',pendingShares:'0',depositProtectionVersion:1,requests:[],requestsScope:'active',requestCount:0,closedRequests:{count:0,paidAssetsRaw:'0'},position:{owner:who,freeSharesRaw:raw,pendingSharesRaw:'0',economicSharesRaw:raw,claimableAssetsRaw:'0',paidAssetsRaw:'0',shareValueRaw:raw,positionValueRaw:raw}},now);
}
const status={mode:'dry-run',lastTick:null,alerts:[]},portfolio=(f:ProductFund)=>({funds:[f],errors:[],truncated:false});
beforeEach(()=>{vi.clearAllMocks();vi.useFakeTimers({shouldAdvanceTime:true});localStorage.clear();localStorage.setItem('wallet:pubkey',owner);window.history.replaceState(null,'','/');control.id=id;});
afterEach(()=>{cleanup();vi.useRealTimers();});

it('retains the newer fund position when the earlier request completes later',async()=>{
 const old=deferred<ProductFund>();let calls=0;control.read.mockImplementation(async kind=>kind==='status'?status:++calls===1?model(100):calls===2?old.promise:model(102,120000000));
 render(<ManagedFundSurface/>);await screen.findByRole('heading',{name:'Read at ledger 100'});await vi.advanceTimersByTimeAsync(20000);await screen.findByRole('heading',{name:'Read at ledger 102'});await act(async()=>old.resolve(model(101,110000000)));
 expect(screen.getByRole('heading',{name:'Read at ledger 102'})).toBeInTheDocument();expect(screen.queryByRole('heading',{name:'Read at ledger 101'})).not.toBeInTheDocument();expect(screen.getByText('12 test units')).toBeInTheDocument();
});
it('ignores an old fund error after the newer request succeeds',async()=>{
 const old=deferred<ProductFund>();let calls=0;control.read.mockImplementation(async kind=>kind==='status'?status:++calls===1?model(100):calls===2?old.promise:model(102));
 render(<ManagedFundSurface/>);await screen.findByRole('heading',{name:'Read at ledger 100'});await vi.advanceTimersByTimeAsync(20000);await screen.findByRole('heading',{name:'Read at ledger 102'});await act(async()=>old.reject(Error('Obsolete error')));
 expect(screen.queryByRole('alert')).not.toBeInTheDocument();expect(screen.getByRole('button',{name:'Withdraw all available shares'})).not.toBeDisabled();
});
it('preserves the current fund error when an earlier successful response arrives',async()=>{
 const old=deferred<ProductFund>();let calls=0;control.read.mockImplementation(async kind=>{if(kind==='status')return status;if(++calls===1)return model(100);if(calls===2)return old.promise;throw Error('Current read unavailable');});
 render(<ManagedFundSurface/>);await screen.findByRole('heading',{name:'Read at ledger 100'});await vi.advanceTimersByTimeAsync(20000);await screen.findByText('Current read unavailable');await act(async()=>old.resolve(model(101)));
 expect(screen.getByRole('alert')).toHaveTextContent('Current read unavailable');expect(screen.getByRole('heading',{name:'Read at ledger 100'})).toBeInTheDocument();expect(screen.getByRole('button',{name:'Withdraw all available shares'})).toBeDisabled();
});
it('keeps the newer portfolio holding when an earlier empty response arrives',async()=>{
 const old=deferred<ReturnType<typeof portfolio>>();let calls=0;control.read.mockImplementation(async kind=>kind==='status'?status:++calls===1?portfolio(model(100)):calls===2?old.promise:portfolio(model(102,120000000)));
 render(<ManagedPortfolioSurface mode="investor"/>);await screen.findByRole('heading',{name:'Read at ledger 100'});await vi.advanceTimersByTimeAsync(30000);await screen.findByRole('heading',{name:'Read at ledger 102'});await act(async()=>old.resolve(portfolio(model(101,0))));
 expect(screen.getByRole('heading',{name:'Read at ledger 102'})).toBeInTheDocument();expect(screen.queryByRole('heading',{name:'No holdings found in the registered funds'})).not.toBeInTheDocument();
});
it('ignores an old portfolio error after a newer success',async()=>{
 const old=deferred<ReturnType<typeof portfolio>>();let calls=0;control.read.mockImplementation(async kind=>kind==='status'?status:++calls===1?portfolio(model(100)):calls===2?old.promise:portfolio(model(102)));
 render(<ManagedPortfolioSurface mode="investor"/>);await screen.findByRole('heading',{name:'Read at ledger 100'});await vi.advanceTimersByTimeAsync(30000);await screen.findByRole('heading',{name:'Read at ledger 102'});await act(async()=>old.reject(Error('Old portfolio error')));expect(screen.queryByRole('alert')).not.toBeInTheDocument();
});
it('preserves a current portfolio error when an earlier success arrives',async()=>{
 const old=deferred<ReturnType<typeof portfolio>>();let calls=0;control.read.mockImplementation(async kind=>{if(kind==='status')return status;if(++calls===1)return portfolio(model(100));if(calls===2)return old.promise;throw Error('Current portfolio unavailable');});
 render(<ManagedPortfolioSurface mode="investor"/>);await screen.findByRole('heading',{name:'Read at ledger 100'});await vi.advanceTimersByTimeAsync(30000);await screen.findByText('Current portfolio unavailable');await act(async()=>old.resolve(portfolio(model(101))));
 expect(screen.getByRole('alert')).toHaveTextContent('Current portfolio unavailable');expect(screen.getByRole('heading',{name:'Read at ledger 100'})).toBeInTheDocument();
});
it.each(['fund','portfolio'])('discards the first owner session after owner A to B to A: %s',async view=>{
 const old=deferred<unknown>();let aCalls=0;control.read.mockImplementation(async(kind,params)=>{if(kind==='status')return status;const wrap=(f:ProductFund)=>view==='portfolio'?portfolio(f):f;if(params.owner!==owner)return wrap(model(200,100000000,other));if(++aCalls===1)return wrap(model(100));if(aCalls===2)return old.promise;return wrap(model(103));});
 render(view==='fund'?<ManagedFundSurface/>:<ManagedPortfolioSurface mode="investor"/>);await screen.findByRole('heading',{name:'Read at ledger 100'});await vi.advanceTimersByTimeAsync(view==='fund'?10000:15000);
 localStorage.setItem('wallet:pubkey',other);fireEvent(window,new Event('wallet:pubkey-changed'));await screen.findByRole('heading',{name:'Read at ledger 200'});localStorage.setItem('wallet:pubkey',owner);fireEvent(window,new Event('wallet:pubkey-changed'));await screen.findByRole('heading',{name:'Read at ledger 103'});await act(async()=>old.resolve(view==='fund'?model(101):portfolio(model(101))));
 expect(screen.getByRole('heading',{name:'Read at ledger 103'})).toBeInTheDocument();expect(screen.queryByRole('heading',{name:'Read at ledger 101'})).not.toBeInTheDocument();
});
it('discards a previous fund session after fund A to B to A',async()=>{
 const old=deferred<ProductFund>();let aCalls=0;control.read.mockImplementation(async(kind,params)=>{if(kind==='status')return status;if(params.fund!==id)return model(200);if(++aCalls===1)return model(100);if(aCalls===2)return old.promise;return model(103);});
 const view=render(<ManagedFundSurface/>);await screen.findByRole('heading',{name:'Read at ledger 100'});await vi.advanceTimersByTimeAsync(10000);control.id=otherId;view.rerender(<ManagedFundSurface/>);await screen.findByRole('heading',{name:'Read at ledger 200'});control.id=id;view.rerender(<ManagedFundSurface/>);await screen.findByRole('heading',{name:'Read at ledger 103'});await act(async()=>old.resolve(model(101,100000000,owner,id)));
 expect(screen.getByRole('heading',{name:'Read at ledger 103'})).toBeInTheDocument();
});
it('accepts the latest same-ledger observation without a balance or ledger heuristic',async()=>{
 let calls=0;control.read.mockImplementation(async kind=>kind==='status'?status:portfolio(model(100,++calls===1?100000000:120000000)));
 render(<ManagedPortfolioSurface mode="investor"/>);await screen.findByText('10 test units estimated value');await vi.advanceTimersByTimeAsync(15000);await screen.findByText('12 test units estimated value');
});
it('accepts a verified latest empty portfolio while rejecting an older nonempty result',async()=>{
 const old=deferred<ReturnType<typeof portfolio>>();let calls=0;control.read.mockImplementation(async kind=>kind==='status'?status:++calls===1?portfolio(model(100)):calls===2?old.promise:portfolio(model(102,0)));
 render(<ManagedPortfolioSurface mode="investor"/>);await screen.findByRole('heading',{name:'Read at ledger 100'});await vi.advanceTimersByTimeAsync(30000);await screen.findByRole('heading',{name:'No holdings found in the registered funds'});await act(async()=>old.resolve(portfolio(model(101))));expect(screen.getByRole('heading',{name:'No holdings found in the registered funds'})).toBeInTheDocument();
});
