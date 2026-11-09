/** Real Soroban RPC adapter, explicitly disabled unless a local sandbox is opted in.
 * It has no mainnet/testnet configuration and never loads private keys. */
import {Account,Address,Contract,Keypair,StrKey,Transaction,TransactionBuilder,nativeToScVal,scValToNative,rpc} from '@stellar/stellar-sdk';
import {managedFactoryOperation,managedWithdrawalOperation,managedSpotOperation,managedSpotRecoveryOperation,managedLiquidationPlanOperation,sameManagedSpotStep,managedDepositOperation,managedDepositQuoteOperation,managedApproveOperation,type ManagedSpotStep} from './managedWithdrawalOperations';
import {MANAGED_LOCAL_NETWORK,ManagedActionRejected,type ManagedTransport,type PreparedManagedTransaction} from './managedWalletFlow';
import type {ManagedState,ManagedWalletAction} from './managedWithdrawals';
// Bounded human review time for this Standalone-only rehearsal. Never renew a
// signed draft or replay an ambiguous write; a new draft always needs a new signature.
export const LOCAL_SIGNING_WINDOW_SECONDS=600;
/** The contract is the only batch planner. No frontend sizing or retry loop. */
export async function readLocalWithdrawalPlan(server:rpc.Server,fund:string,caller:string):Promise<ManagedSpotStep|null>{
 if(!StrKey.isValidContract(fund)||!StrKey.isValidEd25519PublicKey(caller))throw new ManagedActionRejected('Invalid withdrawal context.');
 if((await server.getNetwork()).passphrase!==MANAGED_LOCAL_NETWORK)throw new ManagedActionRejected('Only the local Standalone network is enabled.');
 const tx=new TransactionBuilder(new Account(caller,'0'),{fee:'100',networkPassphrase:MANAGED_LOCAL_NETWORK}).addOperation(managedLiquidationPlanOperation(fund)).setTimeout(60).build();
 const sim=await server.simulateTransaction(tx);
 if(rpc.Api.isSimulationError(sim)||rpc.Api.isSimulationRestore(sim)||!sim.result)throw new ManagedActionRejected('A fresh withdrawal plan is unavailable. Refresh before reviewing again.');
 if((await server.getNetwork()).passphrase!==MANAGED_LOCAL_NETWORK)throw new ManagedActionRejected('Local network changed.');
 const rows=scValToNative(sim.result.retval);
 if(!Array.isArray(rows)||rows.length>1)throw new ManagedActionRejected('The contract did not return a single bounded withdrawal step.');
 if(!rows.length)return null;
 const step=JSON.parse(JSON.stringify(rows[0],(_key,value)=>typeof value==='bigint'?value.toString():value)) as ManagedSpotStep;
 // The ABI builder validates addresses and bounded integer encoding.
 managedSpotRecoveryOperation(fund,caller,step);return step;
}
export async function localWithdrawalPlan(fund:string,caller:string){return readLocalWithdrawalPlan(new rpc.Server('http://127.0.0.1:8000/rpc',{allowHttp:true}),fund,caller);}
export async function localDepositQuote(fund:string,owner:string,asset:string,amountRaw:string):Promise<string>{
 if(!StrKey.isValidContract(fund)||!StrKey.isValidContract(asset)||!StrKey.isValidEd25519PublicKey(owner)||!/^\d+$/.test(amountRaw)||BigInt(amountRaw)<=BigInt(0)||BigInt(amountRaw)>=(BigInt(1)<<BigInt(127)))throw Error('Invalid deposit estimate request.');
 const server=new rpc.Server('http://127.0.0.1:8000/rpc',{allowHttp:true});
 const guard=async()=>{if((await server.getNetwork()).passphrase!==MANAGED_LOCAL_NETWORK)throw Error('Only the local Standalone network is enabled.');};await guard();
 const tx=new TransactionBuilder(new Account(owner,'0'),{fee:'100',networkPassphrase:MANAGED_LOCAL_NETWORK}).addOperation(managedDepositQuoteOperation(fund,asset,amountRaw)).setTimeout(60).build();
 const sim=await server.simulateTransaction(tx);
 if(rpc.Api.isSimulationError(sim)||rpc.Api.isSimulationRestore(sim)||!sim.result)throw Error('A protected share estimate is unavailable. Nothing was signed.');
 await guard();const shares=scValToNative(sim.result.retval);
 if(typeof shares!=='bigint'||shares<=BigInt(0))throw Error('Invalid share estimate.');return shares.toString();
}
export async function localPortfolioQuote(fund:string,owner:string,asset:string,amountRaw:string,sell:boolean):Promise<ManagedSpotStep>{
 if(!/^[1-9]\d*$/.test(amountRaw)||BigInt(amountRaw)>=(BigInt(1)<<BigInt(127)))throw Error('Invalid trade amount.');
 const server=new rpc.Server('http://127.0.0.1:8000/rpc',{allowHttp:true});
 if((await server.getNetwork()).passphrase!==MANAGED_LOCAL_NETWORK)throw Error('Local network required.');
 const tx=new TransactionBuilder(new Account(owner,'0'),{fee:'100',networkPassphrase:MANAGED_LOCAL_NETWORK}).addOperation(new Contract(fund).call('portfolio_trade_quote',Address.fromString(asset).toScVal(),nativeToScVal(BigInt(amountRaw),{type:'i128'}),nativeToScVal(sell,{type:'bool'}))).setTimeout(60).build();
 const simulation=await server.simulateTransaction(tx);
 if(rpc.Api.isSimulationError(simulation)||rpc.Api.isSimulationRestore(simulation)||!simulation.result)throw Error('A fresh portfolio estimate is unavailable. Nothing was signed.');
 if((await server.getNetwork()).passphrase!==MANAGED_LOCAL_NETWORK)throw Error('Local network changed.');
 return JSON.parse(JSON.stringify(scValToNative(simulation.result.retval),(_key,value)=>typeof value==='bigint'?value.toString():value));
}
export function createManagedSorobanTransport(options:{enabled?:boolean;rpcUrl:string;walletAddress:string;fund:string;depositAssets?:string[];depositProtectionVersion?:number|null;factory?:string;creation?:{templateHash:string;denomination:string;router:string;mgmtBps:number;perfBps:number;depositBps:number};salt?:()=>string;readState:()=>Promise<ManagedState>;serverFactory?:(url:string)=>rpc.Server;confirmationAttempts?:number;confirmationIntervalMs?:number}):ManagedTransport{
 if(options.enabled!==true)throw new Error('Local Soroban wallet execution is disabled.');
 // Current official Quickstart exposes /rpc; retain only the exact legacy local
 // aliases, not arbitrary hosts, ports, URL credentials, redirects or query strings.
 if(!['http://127.0.0.1:8000/rpc','http://localhost:8000/rpc','http://127.0.0.1:8000/soroban/rpc','http://localhost:8000/soroban/rpc'].includes(options.rpcUrl))throw new Error('Only the explicitly allowed local Soroban RPC is supported. Mainnet is disabled.');
 const attempts=options.confirmationAttempts??20,interval=options.confirmationIntervalMs??500;
 if(!Number.isInteger(attempts)||attempts<1||attempts>20||!Number.isInteger(interval)||interval<0||interval>1000)throw new Error('Invalid bounded receipt polling limits.');
 const server=options.serverFactory?.(options.rpcUrl)??new rpc.Server(options.rpcUrl,{allowHttp:true});
 const drafts=new Map<string,{xdr:string;expiresAt:number}>();
 async function network(){const n=await server.getNetwork();if(n.passphrase!==MANAGED_LOCAL_NETWORK)throw new ManagedActionRejected('RPC network mismatch. No transaction was submitted.');}
 async function receipt(id:string){
  if(!/^[a-f0-9]{64}$/.test(id))throw new ManagedActionRejected('Invalid transaction hash.');
  await network();const result=await server.getTransaction(id);
  if(result.status==='NOT_FOUND')return undefined;
  // Confirmation must not depend on an unrelated NAV read succeeding after claim.
  const state=await options.readState().catch(()=>undefined);
  const value=result.status==='SUCCESS'&&result.returnValue?scValToNative(result.returnValue):undefined;
  return{ok:result.status==='SUCCESS',operationId:id,state,
   createdFund:typeof value==='string'&&StrKey.isValidContract(value)?value:undefined,
   mintedShares:typeof value==='bigint'?value.toString():undefined,
   requestId:value&&typeof value==='object'&&'id' in value&&'owner' in value&&value.owner===options.walletAddress&&typeof value.id==='bigint'?value.id.toString():undefined,
   error:result.status==='SUCCESS'?undefined:'Soroban execution failed. Review the transaction result before retrying.'};
 }
 return{
  prepare:async(action:ManagedWalletAction):Promise<PreparedManagedTransaction>=>{
   await network();let op;
   switch(action.action){
    case'request':op=managedWithdrawalOperation(options.fund,{method:'request_withdrawal',owner:options.walletAddress,sharesRaw:action.sharesRaw});break;
    case'instant':op=managedWithdrawalOperation(options.fund,{method:'redeem_liquid',owner:options.walletAddress,sharesRaw:action.sharesRaw});break;
    case'portfolio-swap':op=managedSpotOperation(options.fund,options.walletAddress,action.step);break;
    case'recover-spot':{
     const fresh=await readLocalWithdrawalPlan(server,options.fund,options.walletAddress);
     if(!fresh||!sameManagedSpotStep(fresh,action.step))throw new ManagedActionRejected('Withdrawal plan changed. Review the next liquidity step again.');
     op=managedSpotRecoveryOperation(options.fund,options.walletAddress,fresh);break;
    }
    case'approve':case'deposit':{
     if(!options.depositAssets?.includes(action.asset))throw new ManagedActionRejected('This asset is not enabled for deposits in the reviewed Arka.');
     if((action.action==='deposit'||action.amountRaw!=='0')&&options.depositProtectionVersion!==1)throw new ManagedActionRejected('Protected deposits are unavailable for this Arka. No unprotected fallback is allowed.');
     op=action.action==='deposit'?managedDepositOperation(options.fund,options.walletAddress,action.asset,action.amountRaw,action.minSharesRaw):managedApproveOperation(options.fund,options.walletAddress,action.asset,action.amountRaw,(await server.getLatestLedger()).sequence+120);
     break;
    }
    case'claim':case'cancel':op=managedWithdrawalOperation(options.fund,{method:action.action==='claim'?'claim_withdrawal':'cancel_withdrawal',owner:options.walletAddress,id:String(action.id)});break;
    case'prepare':op=managedWithdrawalOperation(options.fund,{method:'prepare_withdrawal_liquidity',caller:options.walletAddress,amountRaw:action.amountRaw});break;
    case'settle':op=managedWithdrawalOperation(options.fund,{method:'settle_withdrawals',maxRequests:16});break;
    case'create':if(!options.factory||!options.creation||!options.salt)throw new ManagedActionRejected('Managed creation is not configured.');op=managedFactoryOperation(options.factory,options.walletAddress,options.salt(),options.creation);break;
   }
   const account=await server.getAccount(options.walletAddress);
   const tx=new TransactionBuilder(account,{fee:'20000',networkPassphrase:MANAGED_LOCAL_NETWORK}).addOperation(op).setTimeout(LOCAL_SIGNING_WINDOW_SECONDS).build();
   const sim=await server.simulateTransaction(tx);if(rpc.Api.isSimulationError(sim))throw new ManagedActionRejected('Soroban simulation failed; nothing was signed or submitted.');
   if(rpc.Api.isSimulationRestore(sim))throw new ManagedActionRejected('Local ledger state needs restoration. Nothing was signed or submitted; restore it in a separately reviewed operation.');
   if(action.action==='settle'){
    const settlement=sim.result?scValToNative(sim.result.retval):null;
    if(typeof settlement?.settled_shares!=='bigint'||settlement.settled_shares<=BigInt(0))throw new ManagedActionRejected('No eligible withdrawal can be settled with the available cash yet.');
   }
   const assembled=rpc.assembleTransaction(tx,sim).build();
   if(BigInt(assembled.fee)>BigInt(10000000))throw new ManagedActionRejected('Local fee cap exceeded (1 fictitious XLM). Nothing was signed or submitted.');
   const id=assembled.hash().toString('hex'),expiresAt=Number(assembled.timeBounds?.maxTime??0)*1000;
   drafts.set(id,{xdr:assembled.toXDR(),expiresAt});return{id,xdr:assembled.toXDR(),networkPassphrase:MANAGED_LOCAL_NETWORK,signer:options.walletAddress,expiresAt,feeRaw:assembled.fee,engineId:'local-soroban-rpc',revision:0,fund:options.fund,summary:action.action};
  },
  submit:async(id,signed)=>{
   await network();const draft=drafts.get(id);if(!draft||draft.expiresAt<=Date.now())throw new ManagedActionRejected('Draft expired or unknown.');
   const tx=TransactionBuilder.fromXDR(signed,MANAGED_LOCAL_NETWORK);
   if(!(tx instanceof Transaction)||tx.source!==options.walletAddress||tx.hash().toString('hex')!==id||tx.signatures.length!==1||!Keypair.fromPublicKey(options.walletAddress).verify(tx.hash(),tx.signatures[0].signature()))throw new ManagedActionRejected('Signed transaction differs from the reviewed draft.');
   // Delete before network IO: ambiguous responses must be resolved by receipt,
   // never by repeating a submission through this adapter.
   drafts.delete(id);const sent=await server.sendTransaction(tx);
   if(sent.status==='ERROR')throw new ManagedActionRejected('RPC rejected the transaction. Nothing will be retried automatically.');
   // Poll only the receipt, never the write. A freshly accepted transaction can
   // legitimately be NOT_FOUND until its ledger closes.
   for(let attempt=0;attempt<attempts;attempt++){
    const result=await receipt(id);if(result)return result;
    if(attempt+1<attempts)await new Promise(resolve=>setTimeout(resolve,interval));
   }
   throw new Error(`Confirmation is unknown. Query the transaction hash: ${id}`);
  },receipt,
 };
}
