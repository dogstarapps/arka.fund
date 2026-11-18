import {beforeEach,describe,expect,it,vi} from 'vitest';
const mock=vi.hoisted(()=>({calls:[] as {contract:string;method:string;args:unknown[]}[],paused:false,registered:true,partial:false,oversize:false,foreign:false,caller:true}));
vi.mock('@/lib/config',async()=>{const actual=await vi.importActual<typeof import('@/lib/config')>('@/lib/config');return {...actual,SUSHI_FACTORY:'CD3KRKGDRVWPXVB3VXLUMQKMX6XZ6Q2H334IVZD4XXNAMKSRVQL5GLYF'};});
vi.mock('@stellar/stellar-sdk',async()=>{
 const actual=await vi.importActual<typeof import('@stellar/stellar-sdk')>('@stellar/stellar-sdk');
 return {...actual,rpc:{...actual.rpc,Server:class{
  async getNetwork(){return{passphrase:mock.foreign?'other':'Test SDF Network ; September 2015'};}
  async getAccount(pub:string){return new actual.Account(pub,'0');}
  async simulateTransaction(tx:import('@stellar/stellar-sdk').Transaction){
   const op=tx.operations[0];if(op.type!=='invokeHostFunction')throw Error('unexpected');const c=op.func.invokeContract(),contract=actual.Address.fromScAddress(c.contractAddress()).toString(),method=c.functionName().toString(),args=c.args().map(v=>actual.scValToNative(v));mock.calls.push({contract,method,args});
   const factory='CD3KRKGDRVWPXVB3VXLUMQKMX6XZ6Q2H334IVZD4XXNAMKSRVQL5GLYF',pool=actual.StrKey.encodeContract(new Uint8Array(32).fill(23)),a=actual.StrKey.encodeContract(new Uint8Array(32).fill(24)),b=actual.StrKey.encodeContract(new Uint8Array(32).fill(25));
   let value:unknown;
   if(method==='factory')value=factory;else if(method==='pool_route')value={pool,token_in:a,token_out:b,fee:3000};else if(method==='token0')value=a;else if(method==='token1')value=b;else if(method==='fee')value=3000;else if(method==='is_paused')value=mock.paused;else if(method==='get_pool')value=mock.registered?pool:null;else if(method==='is_caller')value=mock.caller;
   else if(method==='venue_registry')value=factory;
   else if(method==='venue_config')value={status:2,updated_at:BigInt(10),updated_by:tx.source};
   else if(method==='quote_exact_input')value={amount0:mock.partial?BigInt(99):BigInt(100),amount1:mock.oversize?-BigInt(Number.MAX_SAFE_INTEGER)-BigInt(1):-BigInt(120),liquidity:BigInt(200),sqrt_price_x96:BigInt(1),tick:0};
   else if(method==='managed_routes')value=[{adapter:contract,family:['Sushi'],pool_id:BigInt(7),path:[a,b]}];else throw Error(method);
   return{result:{retval:actual.nativeToScVal(value)}};
  }
 }}};
});
import {StrKey} from '@stellar/stellar-sdk';
import {buildAdapterBlendExecute,readSushiEstimateOut,readVenueSnapshot,readSushiFundBinding} from '@/lib/soroban';
const adapter=StrKey.encodeContract(new Uint8Array(32).fill(22)),a=StrKey.encodeContract(new Uint8Array(32).fill(24)),b=StrKey.encodeContract(new Uint8Array(32).fill(25)),pub=StrKey.encodeEd25519PublicKey(new Uint8Array(32).fill(29));
beforeEach(()=>Object.assign(mock,{calls:[],paused:false,registered:true,partial:false,oversize:false,foreign:false,caller:true}));
describe('official Sushi Stellar ABI at the actual RPC boundary',()=>{
 it('blocks unconfigured direct credit execution before simulation',async()=>{await expect(buildAdapterBlendExecute(pub,adapter,'Borrow',1,100,pub)).rejects.toThrow(/permissions/);expect(mock.calls).toHaveLength(0);});
 it('serializes exact-input i128 and full-width U256, and verifies factory identity before quoting',async()=>{
  expect(await readSushiEstimateOut(adapter,7,a,b,100,pub)).toBe(120);
  expect(mock.calls.find(c=>c.method==='quote_exact_input')?.args).toEqual([true,BigInt(100),BigInt('4295128740')]);
  expect(mock.calls.find(c=>c.method==='get_pool')?.args).toEqual([a,b,3000]);
  expect(mock.calls.some(c=>/swap|sendTransaction/.test(c.method))).toBe(false);
 });
 it.each(['paused','partial','oversize'] as const)('rejects %s pools or quotes without presenting a usable zero quote',async key=>{mock[key]=true;await expect(readSushiEstimateOut(adapter,7,a,b,100,pub)).rejects.toThrow();});
 it('rejects an unregistered pool before the quote call',async()=>{mock.registered=false;await expect(readSushiEstimateOut(adapter,7,a,b,100,pub)).rejects.toThrow(/not registered/);expect(mock.calls.some(c=>c.method==='quote_exact_input')).toBe(false);});
 it('rejects unsafe input amounts before any simulation',async()=>{await expect(readSushiEstimateOut(adapter,7,a,b,Number.MAX_SAFE_INTEGER+1,pub)).rejects.toThrow();expect(mock.calls).toHaveLength(0);});
 it('does not read venue permissions from a mismatched RPC network',async()=>{mock.foreign=true;await expect(readVenueSnapshot(adapter,adapter,pub)).rejects.toThrow(/network changed/);expect(mock.calls).toHaveLength(0);});
 it('blocks a fund which governance has not authorized to use Sushi',async()=>{mock.caller=false;await expect(readSushiFundBinding(adapter,adapter,a,b,pub)).rejects.toThrow(/not authorized/);expect(mock.calls.some(c=>c.method==='managed_routes')).toBe(false);});
});
