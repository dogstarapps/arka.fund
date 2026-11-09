import type {ManagedState,ManagedWalletAction} from './managedWithdrawals';
import {executeManagedWalletAction,type ManagedTransport,type ManagedWallet} from './managedWalletFlow';
import {planManagedKeeper as sharedPlan} from './managedKeeperPlan.mjs';
export type KeeperDecision={kind:'wait'|'blocked'|'settle'|'recover';reason:string;action?:ManagedWalletAction;nextEligibleAt?:number;alert?:string};
/** Pure bounded planner. No signing, IO, claims, swaps, deposits or admin changes. */
export function planManagedKeeper(s:ManagedState,limits:{maxRecoveryRaw:string}={maxRecoveryRaw:'5000000000'}):KeeperDecision{
 return sharedPlan(s,limits) as KeeperDecision;
}
export async function runManagedKeeperOnce(deps:{readState:()=>Promise<ManagedState>;wallet:ManagedWallet;transport:ManagedTransport;maxRecoveryRaw?:string;applyLocal?:boolean}){
 const state=await deps.readState();const decision=planManagedKeeper(state,{maxRecoveryRaw:deps.maxRecoveryRaw??'5000000000'});
 if(!decision.action||!deps.applyLocal)return{decision,executed:false,state};
 if(!state.wallets?.executor)throw new Error('The isolated public-executor wallet is missing.');
 const result=await executeManagedWalletAction(decision.action,deps.wallet,deps.transport,{expectedAddress:state.wallets.executor,expectedEngineId:state.engineId,expectedRevision:state.revision,expectedFund:state.fund});
 return{decision,executed:true,...result};
}
export async function discoverManagedArkas(readPage:(offset:number,limit:number)=>Promise<string[]>,readPolicy:(fund:string)=>Promise<unknown>,maxPages=4){
 if(!Number.isInteger(maxPages)||maxPages<1||maxPages>32)throw new Error('Invalid discovery bound.');
 const found:string[]=[];const seen=new Set<string>();
 for(let page=0;page<maxPages;page++){const rows=await readPage(page*32,32);if(rows.length>32)throw new Error('Invalid factory page.');for(const fund of rows){if(seen.has(fund))continue;seen.add(fund);if(await readPolicy(fund))found.push(fund);}if(rows.length<32)return{funds:found,truncated:false};}
 return{funds:found,truncated:true};
}
