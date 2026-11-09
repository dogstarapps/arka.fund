import React,{Profiler} from 'react';
import {render,screen,fireEvent,cleanup,act,waitFor} from '@testing-library/react';
import {beforeEach,afterEach,it,expect,vi} from 'vitest';
import {StrKey} from '@stellar/stellar-sdk';
const mocks=vi.hoisted(()=>({read:vi.fn(),quote:vi.fn(),execute:vi.fn()}));
vi.mock('next/navigation',()=>({useParams:()=>({id:'deposit-fund'})}));
vi.mock('@/lib/managedProduct',async original=>({...await original<typeof import('@/lib/managedProduct')>(),productRead:mocks.read}));
vi.mock('@/lib/managedSorobanTransport',()=>({localDepositQuote:mocks.quote,localPortfolioQuote:mocks.quote,createManagedSorobanTransport:()=>({})}));
vi.mock('@/lib/managedWalletFlow',async original=>({...await original<typeof import('@/lib/managedWalletFlow')>(),executeManagedWalletAction:mocks.execute}));
import {ManagedFundSurface} from '@/components/product/ManagedProductSurface';
const owner=StrKey.encodeEd25519PublicKey(Buffer.alloc(32,1)),token=StrKey.encodeContract(Buffer.alloc(32,3)),asset=StrKey.encodeContract(Buffer.alloc(32,6));
const fund={id:'deposit-fund',name:'Deposit test',symbol:'test units',manager:owner,token,network:'Standalone Network ; February 2017',clock:200,ledger:100,freeShares:'200000000',totalShares:'200000000',policy:{epoch_seconds:'60',manager_window:'60',min_request_shares:'1',buffer_bps:0},queue:{pending_shares:'0',reserved_assets:'0'},requests:[],requestsTruncated:false,valuationError:null,status:{nav:'200000000',total_shares:'200000000',cash:'200000000',settle_capacity:'200000000'},portfolioPolicy:{instant_cash:true,auto_payout:false,max_slippage_bps:100,cancel_lock_seconds:'3600',routes:[{asset,router:asset}]},depositProtectionVersion:1,fees:{mgmt_bps:0,perf_bps:0,deposit_bps:0,redeem_bps:0},holdings:[{asset:token,symbol:'test units',cash:'200000000'},{asset,symbol:'TEST',cash:'0'}],depositAssets:[{asset:token,symbol:'test units',balance:'1000000000',allowance:'100000000',native:false},{asset,symbol:'TEST',balance:'1000000000',allowance:'100000000',native:false}]};
beforeEach(()=>{vi.clearAllMocks();localStorage.clear();localStorage.setItem('wallet:pubkey',owner);window.history.replaceState(null,'','/');mocks.read.mockImplementation(async kind=>kind==='status'?{mode:'dry-run',lastTick:null,alerts:[]}:structuredClone(fund));mocks.quote.mockResolvedValue('100000000');mocks.execute.mockResolvedValue({ok:true});});
afterEach(()=>{cleanup();vi.useRealTimers();});
it('retains the first entry after asynchronous mounting and keeps the review adjacent and focused',async()=>{
 for(let i=0;i<12;i++){
  render(<ManagedFundSurface/>);const input=await screen.findByLabelText('Amount to deposit (test units)');fireEvent.change(input,{target:{value:'10'}});await act(async()=>{});expect(input).toHaveValue('10');expect(screen.getByRole('button',{name:'Review deposit'})).not.toBeDisabled();cleanup();
 }
 render(<ManagedFundSurface/>);fireEvent.change(await screen.findByLabelText('Amount to deposit (test units)'),{target:{value:'10'}});fireEvent.click(screen.getByRole('button',{name:'Review deposit'}));const heading=await screen.findByRole('heading',{name:'Review before signing'});await waitFor(()=>expect(heading).toHaveFocus());const review=screen.getByRole('region',{name:'Review before signing'});expect(review.previousElementSibling).toHaveTextContent('Deposit');expect(review.nextElementSibling).toHaveTextContent('Withdraw');expect(mocks.execute).not.toHaveBeenCalled();
});
it('commits the confirmed-deposit reset before showing confirmation and preserves asset and tolerance',async()=>{
 const confirmedValues:string[]=[];render(<Profiler id="confirmed-form" onRender={()=>{if(document.body.textContent?.includes('Deposit confirmed.'))confirmedValues.push(document.querySelector<HTMLInputElement>('#deposit-amount')?.value??'missing');}}><ManagedFundSurface/></Profiler>);
 fireEvent.change(await screen.findByLabelText('Deposit asset'),{target:{value:asset}});fireEvent.change(screen.getByLabelText('Share tolerance'),{target:{value:'50'}});fireEvent.change(screen.getByLabelText('Amount to deposit (TEST)'),{target:{value:'10'}});fireEvent.click(screen.getByRole('button',{name:'Review deposit'}));await screen.findByRole('heading',{name:'Review before signing'});fireEvent.click(screen.getByRole('button',{name:'Confirm in Freighter'}));await screen.findByText(/Deposit confirmed/);
 expect(screen.getByLabelText('Amount to deposit (TEST)')).toHaveValue('');expect(screen.getByLabelText('Deposit asset')).toHaveValue(asset);expect(screen.getByLabelText('Share tolerance')).toHaveValue('50');expect(confirmedValues.length).toBeGreaterThan(0);expect(confirmedValues.every(v=>v==='')).toBe(true);expect(screen.queryByText(/Last reviewed estimate/)).not.toBeInTheDocument();expect(mocks.execute).toHaveBeenCalledOnce();
});
it('retains the amount after a rejected operation and later portfolio refresh',async()=>{
 vi.useFakeTimers({shouldAdvanceTime:true});mocks.execute.mockRejectedValue(Error('Synthetic rejection'));
 render(<ManagedFundSurface/>);fireEvent.change(await screen.findByLabelText('Amount to deposit (test units)'),{target:{value:'10'}});fireEvent.click(screen.getByRole('button',{name:'Review deposit'}));await screen.findByRole('heading',{name:'Review before signing'});fireEvent.click(screen.getByRole('button',{name:'Confirm in Freighter'}));await screen.findByText('Synthetic rejection');await vi.advanceTimersByTimeAsync(10000);expect(screen.getByLabelText('Amount to deposit (test units)')).toHaveValue('10');
});

it('discards a superseded post-confirmation refresh error before it reaches the operation handler',async()=>{
 vi.useFakeTimers({shouldAdvanceTime:true});let reject!:(e:Error)=>void;const old=new Promise<never>((_,no)=>{reject=no;});let calls=0;
 mocks.read.mockImplementation(async kind=>kind==='status'?{mode:'dry-run',lastTick:null,alerts:[]}:++calls===3?old:structuredClone(fund));
 render(<ManagedFundSurface/>);fireEvent.change(await screen.findByLabelText('Amount to deposit (test units)'),{target:{value:'10'}});fireEvent.click(screen.getByRole('button',{name:'Review deposit'}));await screen.findByRole('heading',{name:'Review before signing'});fireEvent.click(screen.getByRole('button',{name:'Confirm in Freighter'}));await screen.findByText(/Deposit confirmed/);
 await vi.advanceTimersByTimeAsync(10000);await act(async()=>reject(Error('Obsolete confirmation refresh')));expect(screen.queryByRole('alert')).not.toBeInTheDocument();expect(screen.getByRole('button',{name:'Withdraw all available shares'})).not.toBeDisabled();expect(screen.getByLabelText('Amount to deposit (test units)')).toHaveValue('');expect(mocks.execute).toHaveBeenCalledOnce();
});
