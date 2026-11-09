import {afterEach,expect,it,vi} from 'vitest';
import {Account,StrKey,TransactionBuilder} from '@stellar/stellar-sdk';
import {MAINNET_NETWORK,prepareMainnetWalletReview,type MainnetIntent,type MainnetReview} from '@/lib/mainnetWalletConnector';
import {generalWithdrawalPlan} from '@/lib/generalMainnet';
import {managedSpotRecoveryOperation,managedSpotOperation} from '@/lib/managedWithdrawalOperations';

const id=(n:number)=>StrKey.encodeContract(Buffer.alloc(32,n)),owner=StrKey.encodeEd25519PublicKey(Buffer.alloc(32,9)),fund=id(6),profile={releaseId:'a'.repeat(64),codeHash:'b'.repeat(64)};
const step={adapter:id(8),pool_id:'1',asset_in:{contract:id(5)},asset_out:{contract:id(3)},amount_in:'100',min_out:'90',router_addr:id(4)},intent:MainnetIntent={action:'recover-spot',fund,step};
const wallet={getAddress:async()=>owner,getNetworkPassphrase:async()=>MAINNET_NETWORK};
function review(change:Partial<typeof step>={},source=owner,rebalance=false):MainnetReview{
 const tx=new TransactionBuilder(new Account(owner,'1'),{fee:'20000',networkPassphrase:MAINNET_NETWORK}).addOperation((rebalance?managedSpotOperation:managedSpotRecoveryOperation)(fund,source,{...step,...change})).setTimeout(60).build();
 return{id:tx.hash().toString('hex'),source:owner,fund,network:MAINNET_NETWORK,...profile,unsignedEnvelope:tx.toXDR(),expiresAt:Number(tx.timeBounds!.maxTime)*1000,readyForSignature:false,canSubmit:false,mode:'live',totalFeeRaw:tx.fee,ledger:100,intent};
}
function gateway(r:MainnetReview){return{prepare:vi.fn(async()=>r),receipt:vi.fn(async()=>{throw Error('RECEIPT_NOT_EXPECTED');})};}
afterEach(()=>vi.unstubAllGlobals());
it('verifies the dedicated recovery ABI with a read-only wallet',async()=>{const r=review();expect(await prepareMainnetWalletReview(wallet,intent,profile,gateway(r))).toEqual(r);expect(TransactionBuilder.fromXDR(r.unsignedEnvelope,MAINNET_NETWORK).signatures).toHaveLength(0);expect(Object.keys(wallet)).toEqual(['getAddress','getNetworkPassphrase']);});
it.each(['amount_in','min_out','pool_id','adapter','router_addr'] as const)('rejects changed recovery %s even with matching envelope ID',async key=>{const value=key==='adapter'||key==='router_addr'?id(10):'2';await expect(prepareMainnetWalletReview(wallet,intent,profile,gateway(review({[key]:value})))).rejects.toThrow('Withdrawal route or minimum changed');});
it('rejects a different recovery caller',async()=>{await expect(prepareMainnetWalletReview(wallet,intent,profile,gateway(review({},StrKey.encodeEd25519PublicKey(Buffer.alloc(32,10)))))).rejects.toThrow('owner changed');});
it('rejects substituting rebalance for withdrawal recovery',async()=>{await expect(prepareMainnetWalletReview(wallet,intent,profile,gateway(review({},owner,true)))).rejects.toThrow('destination changed');});
it('reads the existing quote endpoint without inventing a trade amount',async()=>{const fetcher=vi.fn(async(_input:string)=>Response.json({network:MAINNET_NETWORK,fund,owner,kind:'withdrawal',value:step,canSubmit:false}));vi.stubGlobal('fetch',fetcher);expect(await generalWithdrawalPlan(fund,owner)).toEqual(step);const url=new URL(fetcher.mock.calls[0][0],'http://127.0.0.1');expect(url.pathname).toBe('/api/mainnet-connector/quote');expect(Object.fromEntries(url.searchParams)).toEqual({kind:'withdrawal',fund,owner});});
it('retains an empty plan as null',async()=>{vi.stubGlobal('fetch',async()=>Response.json({network:MAINNET_NETWORK,fund,owner,kind:'withdrawal',value:null,canSubmit:false}));expect(await generalWithdrawalPlan(fund,owner)).toBeNull();});
it.each([{network:'Standalone'},{owner:StrKey.encodeEd25519PublicKey(Buffer.alloc(32,10))},{fund:id(10)},{kind:'portfolio'},{canSubmit:true}])('rejects changed plan context %j',async changed=>{vi.stubGlobal('fetch',async()=>Response.json({network:MAINNET_NETWORK,fund,owner,kind:'withdrawal',value:step,canSubmit:false,...changed}));await expect(generalWithdrawalPlan(fund,owner)).rejects.toThrow('could not be verified');});
it('does not convert backend failure to an empty plan',async()=>{vi.stubGlobal('fetch',async()=>Response.json({message:'Plan unavailable'},{status:409}));await expect(generalWithdrawalPlan(fund,owner)).rejects.toThrow('Plan unavailable');});
