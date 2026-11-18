import { describe,it,expect } from 'vitest';
import { StrKey, scValToNative } from '@stellar/stellar-sdk';
import { parseUnits,formatUnits,sharesForAssets,requestLabel,type WithdrawalRow } from '@/lib/managedWithdrawals';
import { managedWithdrawalOperation,managedSpotOperation } from '@/lib/managedWithdrawalOperations';
import {account,contract} from '../fixtures/managedState';
const fund=StrKey.encodeContract(Buffer.alloc(32,7));
const owner=StrKey.encodeEd25519PublicKey(Buffer.alloc(32,8));
const row={pendingShares:'0',claimableAssets:'0',claimedAssets:'0',cancelledShares:'0'} as WithdrawalRow;
describe('Managed withdrawal amounts and labels',()=>{
  it('retains values above Number.MAX_SAFE_INTEGER exactly',()=>{expect(parseUnits('9007199254740993.1234567')).toBe(BigInt('90071992547409931234567'));});
  it.each(['0','-1','1e3',' 1','01','1.12345678','Infinity','NaN','1,000'])('rejects ambiguous or unsafe amount %s',s=>{expect(()=>parseUnits(s)).toThrow();});
  it('rejects i128 overflow',()=>{expect(()=>parseUnits('170141183460469231731687303715884105728')).toThrow();});
  it('formats raw values without floating point',()=>{expect(formatUnits('1234567890123456789',7)).toBe('123,456,789,012.3456789');});
  it('rounds the share estimate up and rejects missing NAV',()=>{expect(sharesForAssets(BigInt(4),'3','2')).toBe(BigInt(3));expect(()=>sharesForAssets(BigInt(1),'0','2')).toThrow();});
  it('distinguishes pending, partial, claimable, paid and cancelled',()=>{
    expect(requestLabel({...row,pendingShares:'10'})).toBe('Waiting for settlement');
    expect(requestLabel({...row,pendingShares:'10',claimedAssets:'1'})).toBe('Partially settled');
    expect(requestLabel({...row,claimableAssets:'1'})).toBe('Ready to claim');
    expect(requestLabel({...row,claimedAssets:'1'})).toBe('Paid');
    expect(requestLabel(row)).toBe('Cancelled');
  });
});
describe('Unsigned ABI operation builders',()=>{
  it('encodes exact i128 shares and the authenticated owner',()=>{
    const op=managedWithdrawalOperation(fund,{method:'request_withdrawal',owner,sharesRaw:'90071992547409931234567'});
    const call=op.body().invokeHostFunctionOp().hostFunction().invokeContract();
    expect(call.functionName().toString()).toBe('request_withdrawal');
    expect(scValToNative(call.args()[0])).toBe(owner);expect(scValToNative(call.args()[1])).toBe(BigInt('90071992547409931234567'));
  });
  it.each(['claim_withdrawal','cancel_withdrawal'] as const)('encodes u64 IDs for %s',method=>{
    const call=managedWithdrawalOperation(fund,{method,owner,id:'18446744073709551615'}).body().invokeHostFunctionOp().hostFunction().invokeContract();
    expect(scValToNative(call.args()[1])).toBe(BigInt('18446744073709551615'));
  });
  it('encodes bounded public/manager recovery without choosing a recipient',()=>{
    const call=managedWithdrawalOperation(fund,{method:'prepare_withdrawal_liquidity',caller:owner,amountRaw:'123'}).body().invokeHostFunctionOp().hostFunction().invokeContract();
    expect(call.args()).toHaveLength(2);expect(scValToNative(call.args()[1])).toBe(BigInt(123));
  });
  it.each([0,17,1.5,NaN])('rejects invalid settlement batch %s',maxRequests=>{expect(()=>managedWithdrawalOperation(fund,{method:'settle_withdrawals',maxRequests})).toThrow();});
  it('validates the settlement batch and unsigned integer bounds',()=>{
    expect(managedWithdrawalOperation(fund,{method:'settle_withdrawals',maxRequests:16})).toBeTruthy();
    expect(()=>managedWithdrawalOperation(fund,{method:'claim_withdrawal',owner,id:'18446744073709551616'})).toThrow();
    expect(()=>managedWithdrawalOperation(fund,{method:'request_withdrawal',owner,sharesRaw:'170141183460469231731687303715884105728'})).toThrow();
  });
});

describe('Portfolio capability ABI',()=>{
 const fund=contract(1),owner=account(2);
 it('encodes direct withdrawal with owner and exact shares',()=>{const call=managedWithdrawalOperation(fund,{method:'redeem_liquid',owner,sharesRaw:'90071992547409931234567'}).body().invokeHostFunctionOp().hostFunction().invokeContract();expect(call.functionName().toString()).toBe('redeem_liquid');expect(call.args()).toHaveLength(2);});
 it('automatic payment has no caller-selected recipient argument',()=>{const call=managedWithdrawalOperation(fund,{method:'pay_withdrawal',id:'7'}).body().invokeHostFunctionOp().hostFunction().invokeContract();expect(call.functionName().toString()).toBe('pay_withdrawal');expect(call.args()).toHaveLength(1);});
 it('encodes the manager swap without a withdrawal-recipient field',()=>{const call=managedSpotOperation(fund,owner,{adapter:contract(3),pool_id:'0',asset_in:{contract:contract(4)},asset_out:{contract:contract(5)},amount_in:'123',min_out:'100',router_addr:contract(3)}).body().invokeHostFunctionOp().hostFunction().invokeContract();expect(call.functionName().toString()).toBe('rebalance');expect(call.args()).toHaveLength(2);});
});
