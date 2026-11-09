import {describe,it,expect,vi,afterEach} from 'vitest';
import {Account,Contract,Operation,StrKey,TransactionBuilder} from '@stellar/stellar-sdk';
import {NETWORK_PASSPHRASE} from '@/lib/config';
import {protocolVenueAllowed,venueStatusLabel,assertVenueReviewUnchanged,type VenueSnapshot,type VenueStatus,type VenueAction} from '@/lib/workflows/protocolLifecycle';
import {rememberProtocolReview,assertProtocolReviewCurrent,assertSameReviewedTransaction} from '@/lib/workflows/protocolReviewRegistry';
import {resolveRebalanceRoutePlan} from '@/lib/workflows/rebalanceRouting';
import {buildExecutionVenueCatalog} from '@/lib/workflows/executionVenues';
import {buildBalancedFallbackPayload} from '@/lib/runtime/appHealth';
const publicKey=StrKey.encodeEd25519PublicKey(new Uint8Array(32).fill(39)),contract=StrKey.encodeContract(new Uint8Array(32).fill(30));
const state=(status:VenueStatus=2):VenueSnapshot=>({registry:'registry',venue:'adapter',network:NETWORK_PASSPHRASE,status,updatedAt:'1',updatedBy:publicKey,observedAt:Date.now()});
let sequence=100;
function transaction(method='rebalance') {return new TransactionBuilder(new Account(publicKey,String(sequence++)),{fee:'100',networkPassphrase:NETWORK_PASSPHRASE}).addOperation(method==='data'?Operation.manageData({name:'fixture',value:'offline'}):new Contract(contract).call(method)).setTimeout(120).build();}
afterEach(()=>vi.useRealTimers());
describe('protocol lifecycle',()=>{
 const actions:VenueAction[]=['manual_swap','auto_swap','supply','borrow','withdraw','repay'];
 const matrix=[[false,false,false,false,false,false],[true,false,true,true,true,true],[true,true,true,true,true,true],[false,false,false,false,true,true]];
 for(const status of [0,1,2,3] as const)it(`enforces registry state ${status} for swaps, credit entry and credit exits`,()=>{
  actions.forEach((action,i)=>expect(protocolVenueAllowed('BLEND',state(status),action,NETWORK_PASSPHRASE)).toBe(matrix[status][i]));
 });
 it('never revives Phoenix, even with enabled registry state',()=>{for(const status of [0,1,2,3] as const)for(const action of actions)expect(protocolVenueAllowed('PHOENIX',state(status),action,NETWORK_PASSPHRASE)).toBe(false);});
 it('rejects absent, stale, future and foreign-network permissions',()=>{
  for(const snapshot of [null,{...state(),observedAt:Date.now()-30001},{...state(),observedAt:Date.now()+10000},{...state(),network:'foreign'}])expect(protocolVenueAllowed('SUSHI',snapshot,'manual_swap',NETWORK_PASSPHRASE)).toBe(false);
 });
 it('binds review to registry identity, venue, policy revision, status and administrator',()=>{
  const before=state();expect(()=>assertVenueReviewUnchanged(before,{...before,observedAt:Date.now()},'SUSHI','manual_swap',NETWORK_PASSPHRASE)).not.toThrow();
  for(const change of [{status:1 as const},{registry:'other'},{venue:'other'},{updatedAt:'2'},{updatedBy:'other'}])expect(()=>assertVenueReviewUnchanged(before,{...before,...change},'SUSHI','manual_swap',NETWORK_PASSPHRASE)).toThrow(/changed/);
 });
 it('does not invent a zero position when permissions are unavailable',()=>{
  const healthy={matched:true,label:'Healthy',tone:'positive' as const};
  const catalog=buildExecutionVenueCatalog({balancedSupport:buildBalancedFallbackPayload(),aquariusHealth:healthy,soroswapHealth:healthy,sushiHealth:healthy,blendHealth:healthy,venueStates:{BLEND:state(3),SUSHI:state(0)}});
  expect(catalog.some(v=>v.id==='PHOENIX')).toBe(false);
  expect(catalog.find(v=>v.id==='SUSHI')).toMatchObject({manualExecutionEligible:false,statusLabel:'Paused'});
  expect(catalog.find(v=>v.id==='BLEND')).toMatchObject({manualExecutionEligible:false,statusLabel:'Withdrawals only'});
  expect(catalog.find(v=>v.id==='SOROSWAP')).toMatchObject({manualExecutionEligible:false,statusLabel:'Permissions unavailable'});
  expect(venueStatusLabel(undefined)).toBe('Permissions unavailable');
 });
 it('requires a review for actual sensitive XDR and rejects malformed envelopes',async()=>{
  await expect(assertProtocolReviewCurrent(transaction().toXDR())).rejects.toThrow(/permissions must be checked/);
  await expect(assertProtocolReviewCurrent('malformed')).rejects.toThrow(/Invalid transaction/);
  await expect(assertProtocolReviewCurrent(transaction('data').toXDR())).resolves.toBeUndefined();
 });
 it('rechecks state before signing and before submission, including a disable then re-enable',async()=>{
  const before=state();let current=before;const read=vi.fn(async()=>current),xdr=transaction().toXDR();
  rememberProtocolReview(xdr,[{protocol:'SUSHI',action:'manual_swap',before,read}]);
  await assertProtocolReviewCurrent(xdr);current=state(0);await expect(assertProtocolReviewCurrent(xdr)).rejects.toThrow(/changed/);
  current={...state(2),updatedAt:'3'};await expect(assertProtocolReviewCurrent(xdr)).rejects.toThrow(/changed/);expect(read).toHaveBeenCalledTimes(3);
 });
 it('expires pending reviews even if registry still allows execution',async()=>{
  vi.useFakeTimers();const before=state(),xdr=transaction().toXDR();rememberProtocolReview(xdr,[{protocol:'SUSHI',action:'manual_swap',before,read:async()=>state()}]);
  await vi.advanceTimersByTimeAsync(121000);await expect(assertProtocolReviewCurrent(xdr)).rejects.toThrow(/expired/);
 });
 it('rejects a changed transaction body and a substituted fee-bump wrapper',()=>{
  const tx=transaction('data'),same=tx.toXDR();expect(()=>assertSameReviewedTransaction(same,same)).not.toThrow();
  expect(()=>assertSameReviewedTransaction(same,transaction('data').toXDR())).toThrow(/wallet changed/);
  const a=TransactionBuilder.buildFeeBumpTransaction(publicKey,'200',tx,NETWORK_PASSPHRASE).toXDR(),b=TransactionBuilder.buildFeeBumpTransaction(publicKey,'300',tx,NETWORK_PASSPHRASE).toXDR();
  expect(()=>assertSameReviewedTransaction(a,b)).toThrow(/wallet changed/);expect(()=>assertSameReviewedTransaction(same,a)).toThrow(/wallet changed/);
 });
 it('blocks indirect and split routing through retired Phoenix before any quote call',async()=>{
  const phoenix=vi.fn(async()=>99999999);const plan=await resolveRebalanceRoutePlan({requestedProtocol:'AUTO',amountBase:100,tokenIn:'a',tokenOut:'b',slippagePct:1,manualMinOutBase:0,phoenixAdapterId:'adapter',phoenixPoolId:1,configuredPhoenixPool:'pool',protocolPolicies:{PHOENIX:{planningEnabled:true,executionEnabled:true}}},{readSoroswapAmountOut:async()=>0,readAquariusPoolIndex:async()=>'',readAquariusEstimateOut:async()=>0,readPhoenixEstimateOut:phoenix});
  expect(phoenix).not.toHaveBeenCalled();expect(plan.candidates.filter(c=>c.protocol==='PHOENIX').every(c=>!c.admitted&&!c.available)).toBe(true);expect(plan.selectedCandidate?.protocol).not.toBe('PHOENIX');
 });
 it('checks Sushi fund bindings and fresh permissions before invoking its actual quote reader',async()=>{
  const quote=vi.fn(async()=>120),read=vi.fn(async()=>state(2)),bind=vi.fn(async()=>27);
  const input={requestedProtocol:'SUSHI' as const,amountBase:100,tokenIn:'a',tokenOut:'b',slippagePct:1,manualMinOutBase:0,fundId:'fund',sushiAdapterId:'adapter',sushiPoolId:1,requireVenueState:true};
  const readers={readVenueSnapshot:read,readSushiFundBinding:bind,readSushiEstimateOut:quote,readSoroswapAmountOut:async()=>0,readAquariusPoolIndex:async()=>'',readAquariusEstimateOut:async()=>0};
  const plan=await resolveRebalanceRoutePlan(input,readers);expect(plan.selectedProtocol).toBe('SUSHI');expect(quote).toHaveBeenCalledWith('adapter',27,'a','b',100,undefined);
  quote.mockClear();read.mockResolvedValue(state(0));await resolveRebalanceRoutePlan(input,readers);expect(quote).not.toHaveBeenCalled();
  read.mockResolvedValue(state(2));bind.mockRejectedValue(new Error('legacy fund'));await resolveRebalanceRoutePlan(input,readers);expect(quote).not.toHaveBeenCalled();
 });
});
