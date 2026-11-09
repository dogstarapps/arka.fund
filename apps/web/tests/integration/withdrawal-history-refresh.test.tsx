import React from 'react';
import {render,screen,fireEvent,waitFor,cleanup,act} from '@testing-library/react';
import {beforeEach,afterEach,it,expect,vi} from 'vitest';
import {StrKey} from '@stellar/stellar-sdk';
import {ManagedWithdrawalHistory} from '@/components/product/ManagedWithdrawalHistory';
import {withdrawalProgressNotice,type ProductFund} from '@/lib/managedProduct';

const mocks=vi.hoisted(()=>({read:vi.fn(),history:vi.fn(),execute:vi.fn()}));
vi.mock('next/navigation',()=>({useParams:()=>({id:'local-fund'})}));
vi.mock('@/lib/managedProduct',async original=>({...await original<typeof import('@/lib/managedProduct')>(),productRead:mocks.read}));
vi.mock('@/lib/generalMainnet',async original=>({...await original<typeof import('@/lib/generalMainnet')>(),generalRead:mocks.history}));
vi.mock('@/lib/managedWalletFlow',async original=>({...await original<typeof import('@/lib/managedWalletFlow')>(),executeManagedWalletAction:mocks.execute}));
import {ManagedFundSurface} from '@/components/product/ManagedProductSurface';

const owner=StrKey.encodeEd25519PublicKey(Buffer.alloc(32,1)),otherOwner=StrKey.encodeEd25519PublicKey(Buffer.alloc(32,2)),token=StrKey.encodeContract(Buffer.alloc(32,3));
const history=(observationId='a'.repeat(64),closedCount=26)=>({owner,observationId,codeHash:'b'.repeat(64),ledger:100,closedCount,closedPaidAssetsRaw:String(closedCount*10000000)});
const fixture=()=>({id:'local-fund',name:'Audit fund',symbol:'test units',manager:owner,token,network:'Standalone Network ; February 2017',clock:200,ledger:100,freeShares:'200000000',totalShares:'200000000',policy:{epoch_seconds:'60',manager_window:'60',min_request_shares:'1',buffer_bps:0},queue:{pending_shares:'0',reserved_assets:'0'},requests:[],requestsTruncated:false,valuationError:null,status:{nav:'200000000',total_shares:'200000000',cash:'200000000',settle_capacity:'200000000'},withdrawalHistory:history(),catalog:{owner,complete:true,observationId:'a'.repeat(64),ledger:100,indexedAt:'2026-11-04T12:00:00Z'}} satisfies ProductFund);
const closedRequest=(id:string)=>({id,owner,requested_shares:'10000000',pending_shares:'0',settled_shares:'10000000',cancelled_shares:'0',claimable_assets:'0',claimed_assets:'10000000',eligible_at:'100'});
function page(selected:NonNullable<ProductFund['withdrawalHistory']>,offset=0,id='local-fund'){
 return{...selected,arkaId:id,complete:true,order:'desc',offset,limit:25,total:selected.closedCount,items:Array.from({length:Math.min(25,Math.max(0,selected.closedCount-offset))},(_,i)=>({...closedRequest(String(selected.closedCount-offset-i)),owner:selected.owner}))};
}
let fund:ProductFund;
beforeEach(()=>{
 vi.clearAllMocks();localStorage.clear();localStorage.setItem('wallet:pubkey',owner);window.history.replaceState(null,'','/');fund=fixture();
 mocks.read.mockImplementation(async kind=>kind==='status'?{mode:'dry-run',lastTick:null,alerts:[]}:fund);
 mocks.execute.mockImplementation(async()=>{fund={...fund,requests:[{id:'27',owner,pending_shares:'50000000',claimable_assets:'0',claimed_assets:'0',cancelled_shares:'0',eligible_at:'210'}]};return{ok:true,requestId:'27'};});
 mocks.history.mockImplementation(async(_kind:string,q:Record<string,string>)=>page(q.observationId==='a'.repeat(64)?history():fund.withdrawalHistory!,Number(q.offset)));
});
afterEach(()=>{cleanup();vi.useRealTimers();});

it('keeps the open historical page and its observation through the normal ten-second poll, then refreshes on reopen',async()=>{
 vi.useFakeTimers({shouldAdvanceTime:true});render(<ManagedFundSurface/>);
 const summary=await screen.findByText('Past withdrawals (26)');fireEvent.click(summary);await screen.findByText('Request #26');fireEvent.click(screen.getByRole('button',{name:'Next withdrawals'}));await screen.findByText('Request #1');
 fund={...fund,ledger:101,withdrawalHistory:{...history('c'.repeat(64),27),ledger:101}};
 await vi.advanceTimersByTimeAsync(10000);
 expect(screen.getByText('Past withdrawals (26)').closest('details')).toHaveAttribute('open');expect(screen.getByText('Request #1')).toBeInTheDocument();expect(mocks.history).toHaveBeenCalledTimes(2);
 fireEvent.click(screen.getByRole('button',{name:'Previous withdrawals'}));await screen.findByText('Request #26');expect(mocks.history.mock.calls.at(-1)?.[1]).toMatchObject({observationId:'a'.repeat(64),offset:'0'});
 fireEvent.click(screen.getByText('Past withdrawals (26)'));await waitFor(()=>expect(screen.getByText('Past withdrawals (27)').closest('details')).not.toHaveAttribute('open'));
 fireEvent.click(screen.getByText('Past withdrawals (27)'));await screen.findByText('Request #27');expect(mocks.history.mock.calls.at(-1)?.[1]).toMatchObject({observationId:'c'.repeat(64),offset:'0'});
});

it.each(['paid','cancelled','dust','auto-payout'])('replaces the watched pending notice with a neutral status when a complete active view closes the request: %s',async stage=>{
 vi.useFakeTimers({shouldAdvanceTime:true});render(<ManagedFundSurface/>);
 fireEvent.change(await screen.findByLabelText('Estimated amount (test units)'),{target:{value:'5'}});fireEvent.click(screen.getByRole('button',{name:'Review withdrawal'}));fireEvent.click(await screen.findByRole('button',{name:'Confirm in Freighter'}));await screen.findByText(/Processing starts after the cutoff/);
 fund={...fund,requests:[],withdrawalHistory:{...history('d'.repeat(64),27),closedPaidAssetsRaw:stage==='cancelled'||stage==='dust'?'260000000':'310000000'}};
 await vi.advanceTimersByTimeAsync(10000);await screen.findByText('Check your withdrawals for the latest status.');
 expect(screen.queryByText(/Processing (starts )?after the cutoff/)).not.toBeInTheDocument();expect(screen.queryByText(/Withdrawal paid:/)).not.toBeInTheDocument();expect(mocks.execute).toHaveBeenCalledOnce();
});

it('keeps absence neutral only for a complete active view and preserves verified terminal details',()=>{
 const model=fixture();expect(withdrawalProgressNotice(model,'27')).toBe('Check your withdrawals for the latest status.');
 expect(withdrawalProgressNotice({...model,catalog:undefined},'27')).toBeNull();expect(withdrawalProgressNotice({...model,withdrawalHistory:undefined},'27')).toBeNull();expect(withdrawalProgressNotice({...model,requestsTruncated:true},'27')).toBeNull();
 expect(withdrawalProgressNotice({...model,requests:[closedRequest('27')]},'27')).toContain('Withdrawal paid: 1 test units');
 expect(withdrawalProgressNotice({...model,requests:[{...closedRequest('27'),claimed_assets:'0',cancelled_shares:'1'}]},'27')).toBe('Withdrawal cancelled. Unsettled shares have returned to your investment.');
});

it.each(['owner','fund','code'] as const)('discards a late page and resets history when %s changes',async field=>{
 let resolve!:(value:unknown)=>void;const read=vi.fn().mockImplementationOnce(()=>new Promise(done=>{resolve=done;})).mockImplementation(async()=>page(next.withdrawalHistory!,0,next.id)),previous=fixture(),next={...previous,withdrawalHistory:{...previous.withdrawalHistory}};
 if(field==='owner')next.withdrawalHistory.owner=otherOwner;if(field==='fund')next.id='another-fund';if(field==='code')next.withdrawalHistory.codeHash='c'.repeat(64);
 const view=render(<ManagedWithdrawalHistory fund={previous} readPage={read}/>);fireEvent.click(screen.getByText('Past withdrawals (26)'));await waitFor(()=>expect(read).toHaveBeenCalledOnce());
 view.rerender(<ManagedWithdrawalHistory fund={next} readPage={read}/>);await act(async()=>resolve(page(previous.withdrawalHistory)));
 expect(screen.getByText('Past withdrawals (26)').closest('details')).not.toHaveAttribute('open');expect(screen.queryByText('Request #26')).not.toBeInTheDocument();
 fireEvent.click(screen.getByText('Past withdrawals (26)'));await screen.findByText('Request #26');expect(read.mock.calls.at(-1)?.[1]).toMatchObject({fund:next.id,owner:next.withdrawalHistory.owner,observationId:next.withdrawalHistory.observationId});
});

it('ignores a late response after close/reopen and binds the next page to the new snapshot',async()=>{
 const previous=fixture(),next={...previous,withdrawalHistory:history('c'.repeat(64),27)};let resolve!:(value:unknown)=>void;
 const read=vi.fn().mockImplementationOnce(()=>new Promise(done=>{resolve=done;})).mockImplementation(async(_kind:string,q:Record<string,string>)=>page(next.withdrawalHistory,Number(q.offset)));
 const view=render(<ManagedWithdrawalHistory fund={previous} readPage={read}/>);fireEvent.click(screen.getByText('Past withdrawals (26)'));await waitFor(()=>expect(read).toHaveBeenCalledOnce());view.rerender(<ManagedWithdrawalHistory fund={next} readPage={read}/>);
 fireEvent.click(screen.getByText('Past withdrawals (26)'));await screen.findByText('Past withdrawals (27)');fireEvent.click(screen.getByText('Past withdrawals (27)'));await screen.findByText('Request #27');
 await act(async()=>resolve(page(previous.withdrawalHistory)));expect(screen.getByText('Request #27')).toBeInTheDocument();expect(screen.queryByText('26 of 26')).not.toBeInTheDocument();
 fireEvent.click(screen.getByRole('button',{name:'Next withdrawals'}));await screen.findByText('Request #1');expect(read.mock.calls.at(-1)?.[1]).toMatchObject({observationId:'c'.repeat(64),offset:'25'});
});

it('preserves a read error and retries the pinned observation after a newer one arrives',async()=>{
 const previous=fixture(),next={...previous,withdrawalHistory:history('c'.repeat(64),27)},read=vi.fn().mockRejectedValueOnce(Error('History unavailable')).mockResolvedValueOnce(page(previous.withdrawalHistory));
 const view=render(<ManagedWithdrawalHistory fund={previous} readPage={read}/>);fireEvent.click(screen.getByText('Past withdrawals (26)'));await screen.findByRole('alert');view.rerender(<ManagedWithdrawalHistory fund={next} readPage={read}/>);
 expect(screen.getByRole('alert')).toHaveTextContent('History unavailable');fireEvent.click(screen.getByRole('button',{name:'Retry history'}));await screen.findByText('Request #26');expect(read.mock.calls.at(-1)?.[1]).toMatchObject({observationId:'a'.repeat(64)});
});
