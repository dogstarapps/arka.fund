import {Contract,rpc,hash,xdr} from '@stellar/stellar-sdk';
import {join} from 'node:path';
import {Client as ArkaClient} from './generated/arka.js';
import {Client as TokenClient} from './generated/test-token.js';
import {createClientOptions,expectSimulationResult,type NetworkConfig} from './clientOptions.js';
import type {CatalogSyncRunner} from './runners.js';
import type {HolderReader} from './holders.js';
import type {ManagedReadTransport} from './managedSource.js';
import {RpcManagedSnapshotSource} from './managedSource.js';
import {FileManagedObservationStore} from './managedStore.js';
import {ManagedCatalogAccess,ManagedCatalogSyncRunner,MixedHolderReader} from './managedIndexer.js';
import {DurableManagedRequests} from './managedHistory.js';
import {RpcManagedCreationReader} from './managedCreation.js';

export class RpcManagedReadTransport implements ManagedReadTransport {
 private readonly server:rpc.Server;
 constructor(private readonly options:NetworkConfig){if(options.signTransaction)throw Error('MANAGED_READ_ONLY_REQUIRED');this.server=new rpc.Server(options.rpcUrl,{allowHttp:options.allowHttp??options.rpcUrl.startsWith('http://')});}
 async guard(){
  const [network,health]=await Promise.all([this.server.getNetwork(),this.server.getHealth()]);if(network.passphrase!==this.options.networkPassphrase||health.status!=='healthy')throw Error('MANAGED_NETWORK_OR_HEALTH');
  const response=await this.server.getLedgers({startLedger:health.latestLedger,pagination:{limit:1}}),ledger=response.ledgers[0];if(!ledger)throw Error('MANAGED_HEADER_UNAVAILABLE');
  const header=ledger.headerXdr.header();if(header.ledgerSeq()!==health.latestLedger||header.ledgerVersion()!==29)throw Error('MANAGED_HEADER_CHANGED');
  if(hash(header.toXDR()).toString('hex')!==ledger.hash)throw Error('MANAGED_HEADER_CHANGED');return{sequence:header.ledgerSeq(),time:Number(header.scpValue().closeTime().toString())};
 }
 async instance(id:string){const result=await this.server.getLedgerEntries(new Contract(id).getFootprint()),entry=result.entries[0];if(!entry||!entry.liveUntilLedgerSeq||entry.liveUntilLedgerSeq<result.latestLedger)throw Error('MANAGED_INSTANCE_NOT_LIVE');return {wasmHash:entry.val.contractData().val().instance().executable().wasmHash().toString('hex'),ledger:result.latestLedger};}
 async read(id:string,method:string,args:unknown[]=[]){const Client=method==='balance'?TokenClient:ArkaClient,client=new Client(createClientOptions(this.options,id)),allowed=new Set(['deposit_protection_version','managed_portfolio_policy','managed_queue_state','withdrawal_requests','shares_of','total_shares','withdrawal_status','liquid_balance','balance']);if(!allowed.has(method))throw Error('MANAGED_GETTER_DENIED');const fn=client.spec.funcs().find(f=>f.name().toString()===method);if(!fn||fn.inputs().length!==args.length)throw Error('MANAGED_GETTER_ARGUMENTS');const call=(client as unknown as Record<string,(...args:unknown[])=>Promise<unknown>>)[method];const values=Object.fromEntries(fn.inputs().map((x,i)=>[x.name().toString(),args[i]]));const result=await call.call(client,...(args.length?[values]:[]),{simulate:true});return expectSimulationResult(result as Parameters<typeof expectSimulationResult>[0],method);}
}

/** Explicit optional managed runtime; existing legacy configuration remains unchanged. */
export function managedCatalogRuntime(base:CatalogSyncRunner,holders:HolderReader,options:NetworkConfig&{stateDirectory:string;registry:string;factory:string;initialLedger:number;v3Hashes:string[];legacyHashes:string[];now?:()=>number}){
 const records=new FileManagedObservationStore(join(options.stateDirectory,'observations.json')),access=new ManagedCatalogAccess(records,options.now),transport=new RpcManagedReadTransport(options),creation=new RpcManagedCreationReader({...options,directory:join(options.stateDirectory,'creation')}),history=new DurableManagedRequests(join(options.stateDirectory,'requests'),options.networkPassphrase,8,records);
 return {runner:new ManagedCatalogSyncRunner(base,new RpcManagedSnapshotSource(transport,holders,{v3:options.v3Hashes,legacy:options.legacyHashes},undefined,history,creation),records),holders:new MixedHolderReader(holders,access),access,records};
}
