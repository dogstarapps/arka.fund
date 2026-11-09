import {describe,it,expect,vi} from 'vitest';
import {planManagedKeeper,runManagedKeeperOnce,discoverManagedArkas} from '@/lib/managedKeeper';
import {managedState} from '../fixtures/managedState';
describe('Bounded public keeper planner',()=>{
 it('never claims already reserved investor cash',()=>{expect(planManagedKeeper(managedState({pendingShares:'0',pendingCount:0,reserved:'900'})).action).toBeUndefined();});
 it('waits for the cutoff',()=>{expect(planManagedKeeper(managedState({clock:1000}))).toMatchObject({kind:'wait',nextEligibleAt:1020});});
 it('settles using existing cash without waiting for a manager',()=>{expect(planManagedKeeper(managedState())).toMatchObject({kind:'settle',action:{action:'settle',actor:'executor'}});});
 it('does not preempt the manager recovery window',()=>{expect(planManagedKeeper(managedState({settleCapacity:'0'}))).toMatchObject({kind:'wait',nextEligibleAt:4620});});
 it('caps recovery by the head need and operational limit',()=>{expect(planManagedKeeper(managedState({clock:4620,settleCapacity:'0'}),{maxRecoveryRaw:'500'})).toMatchObject({kind:'recover',action:{action:'prepare',actor:'executor',amountRaw:'500'}});});
 it('does not fabricate liquidity',()=>{expect(planManagedKeeper(managedState({clock:4620,settleCapacity:'0',recoveryAvailable:'0'}))).toMatchObject({kind:'blocked',alert:expect.stringContaining('pending')});});
 it.each([{network:'mainnet'},{nav:'0'},{cash:'-1',settleCapacity:'-1'},{nav:'bad'}])('fails closed for unsafe snapshot %j',overrides=>{expect(planManagedKeeper(managedState(overrides)).kind).toBe('blocked');});
 it('preserves large raw integers exactly',()=>{const n='90071992547409931234567';expect(planManagedKeeper(managedState({clock:4620,settleCapacity:'0',recoveryNeeded:n,recoveryAvailable:n}),{maxRecoveryRaw:n}).action).toMatchObject({amountRaw:n});});
 it('defaults to dry-run without calling a wallet',async()=>{const wallet={getAddress:vi.fn(),getNetworkPassphrase:vi.fn(),signTransaction:vi.fn()},transport={prepare:vi.fn(),submit:vi.fn(),receipt:vi.fn()};const r=await runManagedKeeperOnce({readState:async()=>managedState(),wallet,transport});expect(r.executed).toBe(false);expect(wallet.getAddress).not.toHaveBeenCalled();expect(transport.prepare).not.toHaveBeenCalled();});
 it('bounds registry discovery and keeps policy read failures explicit',async()=>{const read=vi.fn().mockResolvedValue(Array.from({length:32},(_,i)=>'fund-'+i));const r=await discoverManagedArkas(read,async()=>true,1);expect(r.truncated).toBe(true);expect(r.funds).toHaveLength(32);expect(read).toHaveBeenCalledTimes(1);await expect(discoverManagedArkas(async()=>['fund'],async()=>{throw Error('RPC unavailable');})).rejects.toThrow('unavailable');});
});
