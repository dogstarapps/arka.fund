import React from 'react';
import {render,screen,fireEvent,cleanup,act,waitFor} from '@testing-library/react';
import {beforeEach,afterEach,it,expect,vi} from 'vitest';
import {StrKey} from '@stellar/stellar-sdk';
const mocks=vi.hoisted(()=>({id:'deposit-fund',read:vi.fn(),quote:vi.fn(),execute:vi.fn(),receipt:vi.fn()}));
vi.mock('next/navigation',()=>({useParams:()=>({id:mocks.id})}));
vi.mock('@/lib/managedProduct',async original=>({...await original<typeof import('@/lib/managedProduct')>(),productRead:mocks.read}));
vi.mock('@/lib/managedSorobanTransport',()=>({localDepositQuote:mocks.quote,localPortfolioQuote:mocks.quote,createManagedSorobanTransport:()=>({receipt:mocks.receipt})}));
vi.mock('@/lib/managedWalletFlow',async original=>({...await original<typeof import('@/lib/managedWalletFlow')>(),executeManagedWalletAction:mocks.execute}));
import {ManagedFundSurface} from '@/components/product/ManagedProductSurface';
const owner=StrKey.encodeEd25519PublicKey(Buffer.alloc(32,1)),token=StrKey.encodeContract(Buffer.alloc(32,3)),asset=StrKey.encodeContract(Buffer.alloc(32,6));
const fund={id:'deposit-fund',name:'Deposit test',symbol:'test units',manager:owner,token,network:'Standalone Network ; February 2017',clock:200,ledger:100,freeShares:'200000000',totalShares:'200000000',policy:{epoch_seconds:'60',manager_window:'60',min_request_shares:'1',buffer_bps:0},queue:{pending_shares:'0',reserved_assets:'0'},requests:[],requestsTruncated:false,valuationError:null,status:{nav:'200000000',total_shares:'200000000',cash:'200000000',settle_capacity:'200000000'},portfolioPolicy:{instant_cash:true,auto_payout:false,max_slippage_bps:100,cancel_lock_seconds:'3600',routes:[{asset,router:asset}]},depositProtectionVersion:1,fees:{mgmt_bps:0,perf_bps:0,deposit_bps:0,redeem_bps:0},holdings:[{asset:token,symbol:'test units',cash:'200000000'},{asset,symbol:'TEST',cash:'0'}],depositAssets:[{asset:token,symbol:'test units',balance:'1000000000',allowance:'100000000',native:false},{asset,symbol:'TEST',balance:'1000000000',allowance:'100000000',native:false}]};
beforeEach(()=>{vi.clearAllMocks();mocks.id=fund.id;localStorage.clear();localStorage.setItem('wallet:pubkey',owner);window.history.replaceState(null,'','/');mocks.read.mockImplementation(async(kind,params)=>kind==='status'?status:currentFund(params));mocks.quote.mockResolvedValue('100000000');mocks.execute.mockResolvedValue({ok:true});mocks.receipt.mockResolvedValue(undefined);});
afterEach(()=>{cleanup();vi.useRealTimers();});
import {saveProductReceipt,readProductReceipt} from '@/lib/managedProduct';

const status={mode:'dry-run',lastTick:null,alerts:[]},otherOwner=StrKey.encodeEd25519PublicKey(Buffer.alloc(32,2)),otherFund='other-fund';
function currentFund(params?:{owner?:string;fund?:string}){return{...structuredClone(fund),id:params?.fund??mocks.id,name:params?.owner===otherOwner?'Owner B':params?.fund===otherFund?'Other fund':fund.name};}

function pending(who=owner,id=mocks.id,key='a'){
 const value={id:key.repeat(64),fund:id,owner:who,action:'deposit',expiresAt:Date.now()+60000};saveProductReceipt(value);return value;
}
function deferred(){let resolve!:(value:{ok:boolean})=>void,reject!:(error:Error)=>void;const promise=new Promise<{ok:boolean}>((yes,no)=>{resolve=yes;reject=no;});return{promise,resolve,reject};}
async function enterAndReview(){fireEvent.change(await screen.findByLabelText('Amount to deposit (test units)'),{target:{value:'10'}});fireEvent.click(screen.getByRole('button',{name:'Review deposit'}));await screen.findByRole('heading',{name:'Review before signing'});}
async function confirmDeposit(){await enterAndReview();fireEvent.click(screen.getByRole('button',{name:'Confirm in Freighter'}));}
async function switchOwner(who:string){localStorage.setItem('wallet:pubkey',who);fireEvent(window,new Event('wallet:pubkey-changed'));await screen.findByRole('heading',{name:who===otherOwner?'Owner B':fund.name});}
async function checkPending(){fireEvent.click(await screen.findByRole('button',{name:'Check confirmation only'}));await waitFor(()=>expect(mocks.receipt).toHaveBeenCalledOnce());}

it('clears a current post-confirmation read error when polling recovers, keeping actions blocked until then',async()=>{
 vi.useFakeTimers({shouldAdvanceTime:true});let calls=0;
 mocks.read.mockImplementation(async(kind,params)=>{if(kind==='status')return status;if(++calls===3)throw Error('Transient confirmed read');return{...currentFund(params),name:calls>=4?'Recovered current fund':fund.name};});
 render(<ManagedFundSurface/>);await confirmDeposit();await screen.findByText('Transient confirmed read');expect(screen.getByRole('button',{name:'Withdraw all available shares'})).toBeDisabled();expect(screen.getByLabelText('Amount to deposit (test units)')).toHaveValue('');
 await vi.advanceTimersByTimeAsync(10000);await screen.findByRole('heading',{name:'Recovered current fund'});expect(screen.queryByRole('alert')).not.toBeInTheDocument();expect(screen.getByRole('button',{name:'Withdraw all available shares'})).not.toBeDisabled();expect(mocks.execute).toHaveBeenCalledOnce();
});
it('keeps a recovered receipt read error separate from the confirmed receipt result',async()=>{
 vi.useFakeTimers({shouldAdvanceTime:true});let calls=0;mocks.receipt.mockResolvedValue({ok:true});
 mocks.read.mockImplementation(async(kind,params)=>{if(kind==='status')return status;if(++calls===2)throw Error('Receipt refresh unavailable');return{...currentFund(params),name:calls>=3?'Recovered receipt fund':fund.name};});
 pending();render(<ManagedFundSurface/>);await checkPending();await screen.findByText('Receipt refresh unavailable');expect(screen.getByRole('button',{name:'Withdraw all available shares'})).toBeDisabled();expect(readProductReceipt(fund.id,owner)).toBeNull();
 await vi.advanceTimersByTimeAsync(10000);await screen.findByRole('heading',{name:'Recovered receipt fund'});expect(screen.queryByRole('alert')).not.toBeInTheDocument();expect(screen.getByText('Transaction confirmed. Balances refreshed.')).toBeInTheDocument();expect(mocks.execute).not.toHaveBeenCalled();
});
it('preserves a genuine operation rejection after later successful polling',async()=>{
 vi.useFakeTimers({shouldAdvanceTime:true});mocks.execute.mockRejectedValue(Error('Operation rejected by contract'));render(<ManagedFundSurface/>);await confirmDeposit();await screen.findByText('Operation rejected by contract');await vi.advanceTimersByTimeAsync(10000);expect(screen.getByRole('alert')).toHaveTextContent('Operation rejected by contract');expect(screen.getByLabelText('Amount to deposit (test units)')).toHaveValue('10');expect(readProductReceipt(fund.id,owner)).toBeNull();expect(mocks.execute).toHaveBeenCalledOnce();
});
it('shows a current receipt-query error, retains its receipt, and permits a manual confirmation check',async()=>{
 const saved=pending();mocks.receipt.mockRejectedValueOnce(Error('Current receipt unavailable')).mockResolvedValueOnce({ok:true});render(<ManagedFundSurface/>);await checkPending();await screen.findByText('Current receipt unavailable');expect(readProductReceipt(fund.id,owner)).toEqual(saved);expect(mocks.receipt).toHaveBeenCalledOnce();
 fireEvent.click(screen.getByRole('button',{name:'Check confirmation only'}));await screen.findByText('Transaction confirmed. Balances refreshed.');expect(screen.queryByRole('alert')).not.toBeInTheDocument();expect(readProductReceipt(fund.id,owner)).toBeNull();expect(mocks.receipt).toHaveBeenCalledTimes(2);expect(mocks.execute).not.toHaveBeenCalled();
});
it('keeps the on-chain failure notice after its separate read failure recovers',async()=>{
 vi.useFakeTimers({shouldAdvanceTime:true});let calls=0;mocks.receipt.mockResolvedValue({ok:false});mocks.read.mockImplementation(async(kind,params)=>{if(kind==='status')return status;if(++calls===2)throw Error('Failed-receipt read unavailable');return{...currentFund(params),name:calls>=3?'Failed-receipt read recovered':fund.name};});
 pending();render(<ManagedFundSurface/>);await checkPending();await screen.findByText('Failed-receipt read unavailable');await vi.advanceTimersByTimeAsync(10000);await screen.findByRole('heading',{name:'Failed-receipt read recovered'});expect(screen.queryByRole('alert')).not.toBeInTheDocument();expect(screen.getByText('Transaction failed on-chain. Review the result before preparing a new action.')).toBeInTheDocument();expect(readProductReceipt(fund.id,owner)).toBeNull();expect(mocks.execute).not.toHaveBeenCalled();
});
it('keeps an unknown confirmation pending without retrying or executing',async()=>{
 const saved=pending();render(<ManagedFundSurface/>);await checkPending();await screen.findByText(/Still awaiting confirmation/);expect(readProductReceipt(fund.id,owner)).toEqual(saved);expect(mocks.receipt).toHaveBeenCalledOnce();expect(mocks.execute).not.toHaveBeenCalled();
});

it.each(['failure','success'])('discards a late receipt %s after owner A changes to B',async outcome=>{
 const saved=pending(),late=deferred();mocks.receipt.mockReturnValue(late.promise);render(<ManagedFundSurface/>);await checkPending();await switchOwner(otherOwner);await act(async()=>outcome==='failure'?late.reject(Error('Old owner error')):late.resolve({ok:true}));
 expect(screen.getByRole('heading',{name:'Owner B'})).toBeInTheDocument();expect(screen.queryByRole('alert')).not.toBeInTheDocument();expect(screen.queryByText('Transaction confirmed. Balances refreshed.')).not.toBeInTheDocument();expect(readProductReceipt(fund.id,owner)).toEqual(saved);expect(readProductReceipt(fund.id,otherOwner)).toBeNull();expect(screen.getByRole('button',{name:'Withdraw all available shares'})).not.toBeDisabled();expect(mocks.execute).not.toHaveBeenCalled();
});
it.each(['failure','success'])('discards a receipt %s from the first owner session after A to B to A',async outcome=>{
 const saved=pending(),late=deferred();mocks.receipt.mockReturnValue(late.promise);render(<ManagedFundSurface/>);await checkPending();await switchOwner(otherOwner);await switchOwner(owner);await act(async()=>outcome==='failure'?late.reject(Error('First A session error')):late.resolve({ok:true}));
 expect(screen.queryByRole('alert')).not.toBeInTheDocument();expect(screen.queryByText('Transaction confirmed. Balances refreshed.')).not.toBeInTheDocument();expect(readProductReceipt(fund.id,owner)).toEqual(saved);expect(screen.getByRole('button',{name:'Check confirmation only'})).not.toBeDisabled();expect(mocks.execute).not.toHaveBeenCalled();
});
it.each(['failure','success'])('discards a receipt %s from the first fund session after A to B to A',async outcome=>{
 const saved=pending(),late=deferred();mocks.receipt.mockReturnValue(late.promise);const ui=render(<ManagedFundSurface/>);await checkPending();mocks.id=otherFund;ui.rerender(<ManagedFundSurface/>);await screen.findByRole('heading',{name:'Other fund'});mocks.id=fund.id;ui.rerender(<ManagedFundSurface/>);await screen.findByRole('heading',{name:fund.name});await act(async()=>outcome==='failure'?late.reject(Error('First fund session error')):late.resolve({ok:true}));
 expect(screen.queryByRole('alert')).not.toBeInTheDocument();expect(screen.queryByText('Transaction confirmed. Balances refreshed.')).not.toBeInTheDocument();expect(readProductReceipt(fund.id,owner)).toEqual(saved);expect(readProductReceipt(otherFund,owner)).toBeNull();expect(mocks.execute).not.toHaveBeenCalled();
});
it.each(['failure','success'])('keeps the owner boundary for a receipt %s while looking up a different public owner',async outcome=>{
 const saved=pending(),late=deferred();window.history.replaceState(null,'','/?address='+otherOwner);mocks.receipt.mockReturnValue(late.promise);render(<ManagedFundSurface/>);await screen.findByRole('heading',{name:'Owner B'});await checkPending();await act(async()=>outcome==='failure'?late.reject(Error('Other public owner receipt error')):late.resolve({ok:true}));
 expect(screen.queryByRole('alert')).not.toBeInTheDocument();expect(screen.queryByText('Transaction confirmed. Balances refreshed.')).not.toBeInTheDocument();expect(readProductReceipt(fund.id,owner)).toEqual(saved);expect(mocks.execute).not.toHaveBeenCalled();
});
it('accepts the selected receipt after same-view polling without clearing a different pending receipt',async()=>{
 vi.useFakeTimers({shouldAdvanceTime:true});pending();const late=deferred();mocks.receipt.mockReturnValue(late.promise);render(<ManagedFundSurface/>);await checkPending();await vi.advanceTimersByTimeAsync(10000);
 const replacement={id:'b'.repeat(64),fund:fund.id,owner,action:'claim',expiresAt:Date.now()+60000};localStorage.setItem('arka:standalone:withdrawal:'+fund.id+':'+owner,JSON.stringify(replacement));await act(async()=>late.resolve({ok:true}));await screen.findByText('Transaction confirmed. Balances refreshed.');expect(readProductReceipt(fund.id,owner)).toEqual(replacement);expect(screen.getByRole('button',{name:'Check confirmation only'})).not.toBeDisabled();expect(mocks.receipt).toHaveBeenCalledOnce();expect(mocks.execute).not.toHaveBeenCalled();
});
it('accepts the selected receipt through same-view rerenders and polling',async()=>{
 vi.useFakeTimers({shouldAdvanceTime:true});pending();const late=deferred();mocks.receipt.mockReturnValue(late.promise);render(<ManagedFundSurface/>);await checkPending();await vi.advanceTimersByTimeAsync(20000);await act(async()=>late.resolve({ok:true}));await screen.findByText('Transaction confirmed. Balances refreshed.');expect(readProductReceipt(fund.id,owner)).toBeNull();expect(mocks.receipt).toHaveBeenCalledOnce();expect(mocks.execute).not.toHaveBeenCalled();
});
it('preserves the pending receipt after an unmounted query fails',async()=>{
 const saved=pending(),late=deferred();mocks.receipt.mockReturnValue(late.promise);const ui=render(<ManagedFundSurface/>);await checkPending();ui.unmount();await act(async()=>late.reject(Error('Unmounted receipt query')));expect(readProductReceipt(fund.id,owner)).toEqual(saved);expect(mocks.execute).not.toHaveBeenCalled();
});
