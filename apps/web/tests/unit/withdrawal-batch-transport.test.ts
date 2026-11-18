// @vitest-environment node
import {describe,it,expect,vi} from 'vitest';
import {Account,Address,SorobanDataBuilder,TransactionBuilder,nativeToScVal,scValToNative,xdr,type rpc} from '@stellar/stellar-sdk';
import {createManagedSorobanTransport} from '@/lib/managedSorobanTransport';
import {managedSpotRecoveryOperation,managedLiquidationPlanOperation,type ManagedSpotStep} from '@/lib/managedWithdrawalOperations';
import {MANAGED_LOCAL_NETWORK} from '@/lib/managedWalletFlow';
import {account,contract,managedState} from '../fixtures/managedState';
const wallet=account(1),fund=contract(1),step:ManagedSpotStep={adapter:contract(2),pool_id:'2',asset_in:{contract:contract(3)},asset_out:{contract:contract(4)},amount_in:'32377407',min_out:'198000000',router_addr:contract(5)};
const wire=(s:ManagedSpotStep)=>managedSpotRecoveryOperation(fund,wallet,s).body().invokeHostFunctionOp().hostFunction().invokeContract().args()[1];
const simulation=(value:xdr.ScVal)=>({_parsed:true,id:'fixture',latestLedger:1,minResourceFee:'100',events:[],transactionData:new SorobanDataBuilder().setResources(100000,0,0).setResourceFee('100'),result:{auth:[],retval:value}});
function setup(plan:xdr.ScVal=xdr.ScVal.scvVec([wire(step)])){
 const server={getNetwork:vi.fn().mockResolvedValue({passphrase:MANAGED_LOCAL_NETWORK}),getAccount:vi.fn().mockResolvedValue(new Account(wallet,'0')),simulateTransaction:vi.fn().mockResolvedValueOnce(simulation(plan)).mockResolvedValue(simulation(nativeToScVal(BigInt(1),{type:'i128'}))),sendTransaction:vi.fn(),getTransaction:vi.fn()};
 const transport=createManagedSorobanTransport({enabled:true,rpcUrl:'http://127.0.0.1:8000/rpc',walletAddress:wallet,fund,readState:async()=>managedState(),serverFactory:()=>server as unknown as rpc.Server});return{server,transport};
}
describe('Contract-planned withdrawal batches',()=>{
 it('uses the contract budget and dedicated liquidation ABI, with no signer or send',async()=>{
  const {server,transport}=setup(),p=await transport.prepare({action:'recover-spot',actor:'executor',step}),tx=TransactionBuilder.fromXDR(p.xdr,MANAGED_LOCAL_NETWORK);
  expect(tx.signatures).toHaveLength(0);const op=tx.operations[0];expect(op.type).toBe('invokeHostFunction');if(op.type!=='invokeHostFunction')throw Error('ABI');expect(String(op.func.invokeContract().functionName())).toBe('liquidate_withdrawal');expect(op.func.invokeContract().args().map(scValToNative)).toEqual([wallet,{...step,pool_id:BigInt(2),amount_in:BigInt(step.amount_in),min_out:BigInt(step.min_out)}]);expect(server.simulateTransaction).toHaveBeenCalledTimes(2);expect(server.sendTransaction).not.toHaveBeenCalled();
  expect(managedLiquidationPlanOperation(fund).body().invokeHostFunctionOp().hostFunction().invokeContract().functionName().toString()).toBe('portfolio_liquidation_steps');
 });
 it.each(['amount_in','min_out','pool_id','adapter','router_addr'] as const)('rejects a changed %s before financial simulation',async key=>{
  const changed={...step,[key]:key==='adapter'||key==='router_addr'?contract(8):String(BigInt(step[key])+BigInt(1))},s=setup(xdr.ScVal.scvVec([wire(changed)]));await expect(s.transport.prepare({action:'recover-spot',actor:'executor',step})).rejects.toThrow('Withdrawal plan changed');expect(s.server.simulateTransaction).toHaveBeenCalledOnce();expect(s.server.sendTransaction).not.toHaveBeenCalled();
 });
 it.each([xdr.ScVal.scvVec([]),xdr.ScVal.scvVec([wire(step),wire(step)]),xdr.ScVal.scvVoid()])('refuses empty or invalid plans',async plan=>{const s=setup(plan);await expect(s.transport.prepare({action:'recover-spot',actor:'executor',step})).rejects.toThrow();expect(s.server.sendTransaction).not.toHaveBeenCalled();});
 it('fails closed on a plan read error',async()=>{const s=setup();s.server.simulateTransaction.mockReset().mockResolvedValue({error:'unavailable'});await expect(s.transport.prepare({action:'recover-spot',actor:'executor',step})).rejects.toThrow('fresh withdrawal plan');expect(s.server.getAccount).not.toHaveBeenCalled();});
 it('rejects the wrong network before reading a plan',async()=>{const s=setup();s.server.getNetwork.mockResolvedValue({passphrase:'Public Global Stellar Network ; September 2015'});await expect(s.transport.prepare({action:'recover-spot',actor:'executor',step})).rejects.toThrow('network mismatch');expect(s.server.simulateTransaction).not.toHaveBeenCalled();});
 it('does not prepare a settlement that the contract says reserves no shares',async()=>{const s=setup();s.server.simulateTransaction.mockReset().mockResolvedValue(simulation(nativeToScVal({settled_shares:BigInt(0)})));await expect(s.transport.prepare({action:'settle',actor:'executor'})).rejects.toThrow('No eligible withdrawal');expect(s.server.sendTransaction).not.toHaveBeenCalled();});
});
