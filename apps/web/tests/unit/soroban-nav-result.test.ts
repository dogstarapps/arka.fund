import {beforeEach,describe,expect,it,vi} from 'vitest';
const state=vi.hoisted(()=>({simulation:{} as unknown}));
vi.mock('@stellar/stellar-sdk',async()=>{
  const actual=await vi.importActual<typeof import('@stellar/stellar-sdk')>('@stellar/stellar-sdk');
  return {...actual,rpc:{...actual.rpc,Server:class {
    async getAccount(pubkey:string){return new actual.Account(pubkey,'0');}
    async simulateTransaction(){return state.simulation;}
  }}};
});
import {Address,nativeToScVal,xdr} from '@stellar/stellar-sdk';
import {readArkaNav,readArkaLiquidBalance,readArkaShares,readFactoryCreationFeeAmount,readArkaCreditPositionValues,readArkaCreditMarketStatus,readCoverageVaultBalance,readCoverageVaultMaxWithdrawable,readCoverageFundPending,readCoverageFundStakeOf,readCoverageFundMetrics,readCoverageFundPendingRewards,readCoverageWalletBalance,readCoverageFundTotalStaked} from '@/lib/soroban';
const id='CCP7X4UYFSUNXWRUH7W25RQMEQEHXFIYHNHVGAYAGGOOHPMPJKZGOGPW';
const source='GCWBC4RHJBDQWIZ2747BLJ35U5P6JPNXFAGKYWRNLDOIEBUPQ4AWSXEO';
const creditMap=(value:Record<string,unknown>)=>xdr.ScVal.scvMap(Object.entries(value).map(([key,val])=>new xdr.ScMapEntry({key:xdr.ScVal.scvSymbol(key),val:val instanceof xdr.ScVal?val:typeof val==='bigint'?nativeToScVal(val,{type:'i128'}):nativeToScVal(val)})));
describe('strict on-chain NAV result',()=>{
  beforeEach(()=>{state.simulation={};});
  it.each([BigInt(0),BigInt(724928554)])('accepts an actual i128 NAV, including a real zero: %s',async value=>{
    state.simulation={result:{retval:nativeToScVal(value,{type:'i128'})}};
    expect(await readArkaNav(id,source)).toBe(Number(value));
  });
  it('throws on ContractError instead of turning it into zero',async()=>{
    state.simulation={error:'ContractError(18) / BlendNavUnavailable'};
    await expect(readArkaNav(id,source)).rejects.toThrow('BlendNavUnavailable');
  });
  it('throws on a missing result instead of fabricating zero',async()=>{
    await expect(readArkaNav(id,source)).rejects.toThrow('no valid i128 result');
  });
  it('rejects a result with the wrong type',async()=>{
    state.simulation={result:{retval:nativeToScVal('0',{type:'string'})}};
    await expect(readArkaNav(id,source)).rejects.toThrow('no valid i128 result');
  });
  it.each([BigInt(-1),BigInt(Number.MAX_SAFE_INTEGER)+BigInt(1)])('rejects unsafe numeric NAV rather than truncating it: %s',async value=>{
    state.simulation={result:{retval:nativeToScVal(value,{type:'i128'})}};
    await expect(readArkaNav(id,source)).rejects.toThrow('cannot be represented safely');
  });
});

describe('strict balances for investment and withdrawal UX',()=>{
  beforeEach(()=>{state.simulation={};});
  const asset='CAS3J7GYLGXMF6TDJBBYYSE3HQ6BBSMLNUQ34T6TZMYMW2EVH34XOWMA';
  it.each([BigInt(0),BigInt(724928554)])('accepts verified liquid cash, including zero: %s',async value=>{
    state.simulation={result:{retval:nativeToScVal(value,{type:'i128'})}};
    expect(await readArkaLiquidBalance(id,asset,source)).toBe(Number(value));
    expect(await readArkaShares(id,source,source)).toBe(Number(value));
  });
  it('never reports unavailable cash or ownership as zero',async()=>{
    await expect(readArkaLiquidBalance(id,asset,source)).rejects.toThrow('unavailable');
    await expect(readArkaShares(id,source,source)).rejects.toThrow('unavailable');
  });
  it.each([BigInt(-1),BigInt(Number.MAX_SAFE_INTEGER)+BigInt(1)])('rejects unsafe cash and share counts: %s',async value=>{
    state.simulation={result:{retval:nativeToScVal(value,{type:'i128'})}};
    await expect(readArkaLiquidBalance(id,asset,source)).rejects.toThrow('unsafe');
    await expect(readArkaShares(id,source,source)).rejects.toThrow('unsafe');
  });
});

describe('unknown creation fees and Blend balances are not zero',()=>{
  beforeEach(()=>{state.simulation={};});
  const asset='CAS3J7GYLGXMF6TDJBBYYSE3HQ6BBSMLNUQ34T6TZMYMW2EVH34XOWMA';
  it.each([BigInt(0),BigInt(5000000)])('accepts verified creation fees, including zero: %s',async value=>{
    state.simulation={result:{retval:nativeToScVal(value,{type:'i128'})}};
    expect(await readFactoryCreationFeeAmount(id,source)).toBe(Number(value));
  });
  it('rejects unavailable, malformed and unsafe creation fees',async()=>{
    for (const simulation of [{},{error:'unavailable'},{result:{retval:nativeToScVal('0')}},{result:{retval:nativeToScVal(BigInt(-1),{type:'i128'})}},{result:{retval:nativeToScVal(BigInt(Number.MAX_SAFE_INTEGER)+BigInt(1),{type:'i128'})}}]) {
      state.simulation=simulation;
      await expect(readFactoryCreationFeeAmount(id,source)).rejects.toThrow('Creation fee unavailable');
    }
  });
  it('distinguishes a verified empty Blend position from a missing read',async()=>{
    await expect(readArkaCreditPositionValues(id,'Blend',7,source)).rejects.toThrow('position unavailable');
    state.simulation={result:{retval:nativeToScVal([])}};
    expect(await readArkaCreditPositionValues(id,'Blend',7,source)).toEqual([]);
    state.simulation={result:{retval:nativeToScVal(['malformed'])}};
    await expect(readArkaCreditPositionValues(id,'Blend',7,source)).rejects.toThrow('position unavailable');
  });
  const debtZero={asset:Address.fromString(asset).toScVal(), debt_amount:BigInt(0), debt_shares:BigInt(0), debt_value:BigInt(0)};
  it('requires explicit full-width debt amounts and shares for the debt-free exception',async()=>{
    state.simulation={result:{retval:xdr.ScVal.scvVec([creditMap(debtZero)])}};
    expect(await readArkaCreditPositionValues(id,'Blend',7,source)).toMatchObject([{debt_amount:0,debt_shares:0}]);
    for(const value of [{asset:debtZero.asset}, {...debtZero,debt_amount:BigInt(2)**BigInt(64)}, {...debtZero,debt_shares:BigInt(-1)}, {...debtZero,debt_value:'0'}]){
      state.simulation={result:{retval:xdr.ScVal.scvVec([creditMap(value)])}};
      await expect(readArkaCreditPositionValues(id,'Blend',7,source)).rejects.toThrow('position unavailable');
    }
  });
  it('does not manufacture safe risk flags or zero market debt from incomplete or overflowing status',async()=>{
    for(const value of [{debt_value:BigInt(0)}, {risky_actions_blocked:true,nav_blocked:false}, {debt_value:BigInt(2)**BigInt(64),risky_actions_blocked:true,nav_blocked:false}]){
      state.simulation={result:{retval:creditMap(value)}};
      expect(await readArkaCreditMarketStatus(id,'Blend',7,source)).toBeNull();
    }
    state.simulation={result:{retval:creditMap({debt_value:BigInt(0),risky_actions_blocked:true,nav_blocked:false})}};
    expect(await readArkaCreditMarketStatus(id,'Blend',7,source)).toMatchObject({debt_value:0,risky_actions_blocked:true,nav_blocked:false});
  });
});

describe('coverage reserve read results',()=>{
  beforeEach(()=>{state.simulation={};});
  const readers = [() => readCoverageVaultBalance(id,source),() => readCoverageVaultMaxWithdrawable(id,source),() => readCoverageFundPending(id,source,source),() => readCoverageFundStakeOf(id,source,source)];
  it('does not fabricate zero reserves, stake or rewards when reads are missing',async()=>{
    for (const read of readers) await expect(read()).rejects.toThrow('Coverage balance unavailable');
  });
  it('accepts verified zero coverage balances',async()=>{
    state.simulation={result:{retval:nativeToScVal(BigInt(0),{type:'i128'})}};
    for (const read of readers) expect(await read()).toBe(0);
  });
  const reserveToken='CCW67TSZV3SSS2HXMBQ5JFGCKJNXKZM7UQUWUZPUTHXSTZLEO7SJMI75';
  const metrics={reserve_token:reserveToken,bootstrap_token:reserveToken,claims_manager:null,reserve_capital:BigInt(0),total_staked:BigInt(0),retained_reserve:BigInt(0),total_covered_nav:BigInt(0),total_premiums:BigInt(0)};
  it('accepts actual zero capital and an explicitly unlinked claims manager',async()=>{
    state.simulation={result:{retval:nativeToScVal(metrics)}};
    expect(await readCoverageFundMetrics(id,source)).toMatchObject({reserve_capital:0,claims_manager:null,reserve_token:reserveToken});
  });
  it.each([{}, {...metrics,reserve_capital:undefined}, {...metrics,total_staked:BigInt(-1)}, {...metrics,retained_reserve:BigInt(Number.MAX_SAFE_INTEGER)+BigInt(1)}, Object.fromEntries(Object.entries(metrics).filter(([key])=>key!=='claims_manager')), {...metrics,reserve_token:'wrong-network-token'}])('rejects incomplete or unsafe community data',async value=>{
    state.simulation={result:{retval:nativeToScVal(value)}};
    await expect(readCoverageFundMetrics(id,source)).rejects.toThrow('Coverage data unavailable');
  });
  it('never turns missing community, rewards, wallet or staked reads into zero',async()=>{
    await expect(readCoverageFundMetrics(id,source)).rejects.toThrow();
    await expect(readCoverageFundPendingRewards(id,source,source)).rejects.toThrow();
    await expect(readCoverageWalletBalance(reserveToken,source,source)).rejects.toThrow();
    await expect(readCoverageFundTotalStaked(id,source)).rejects.toThrow();
  });
  it('reads both reward assets separately rather than losing reserve rewards',async()=>{
    state.simulation={result:{retval:nativeToScVal({reserve_reward:BigInt(20_000_000),bootstrap_reward:BigInt(30_000_000)})}};
    expect(await readCoverageFundPendingRewards(id,source,source)).toEqual({reserve_reward:20_000_000,bootstrap_reward:30_000_000});
    state.simulation={result:{retval:nativeToScVal({bootstrap_reward:BigInt(30_000_000)})}};
    await expect(readCoverageFundPendingRewards(id,source,source)).rejects.toThrow();
  });
});
