import {rpc,scValToNative} from '@stellar/stellar-sdk';
import type {NetworkConfig} from './clientOptions.js';
import type {ArkaCatalogEntry} from './types.js';
import {collectHistoricalEvents,eventCursorLedger,type HistoricalCoverage} from './historicalCoverage.js';
import {DurableCatalogRepository} from './durableCatalog.js';

/** Registry history establishes factory birth; balances never come from events. */
export class RpcManagedCreationReader {
 private readonly server:rpc.Server;
 private queue:Promise<void>=Promise.resolve();
 constructor(private readonly options:NetworkConfig&{registry:string;factory:string;initialLedger:number;directory:string;maxPages?:number;pageSize?:number}){
  this.server=new rpc.Server(options.rpcUrl,{allowHttp:options.allowHttp??options.rpcUrl.startsWith('http://')});
 }
 async read(arka:ArkaCatalogEntry,ledger:number):Promise<number>{
  let result!:number;
  const job=this.queue.then(async()=>{
   const health=await this.server.getHealth();if(health.latestLedger<ledger)throw Error('CREATION_INDEX_BEHIND');
   const repository=new DurableCatalogRepository(this.options.directory,this.options.networkPassphrase,this.options.registry),current=await repository.current();
   let saved=JSON.stringify(current?.generation.data.creation);
   const coverage=await collectHistoricalEvents({network:this.options.networkPassphrase,contracts:[this.options.registry],fromLedger:this.options.initialLedger,oldestLedger:health.oldestLedger,latestLedger:ledger,previous:current?.generation.data.creation as HistoricalCoverage|undefined,maxPages:this.options.maxPages??8,pageSize:this.options.pageSize??100,transport:{events:async(start,end,cursor)=>{
    const response=await this.server.getEvents({...(cursor?{cursor}:{startLedger:start,endLedger:end}),filters:[{type:'contract',contractIds:[this.options.registry]}],limit:this.options.pageSize??100});
    if(response.latestLedger<end)throw Error('CREATION_INDEX_BEHIND');
    return {events:response.events.map(e=>({id:e.id,ledger:e.ledger,contract:e.contractId?.contractId(),topics:e.topic.map(scValToNative),value:scValToNative(e.value)})),cursor:response.cursor,scannedThrough:eventCursorLedger(response.cursor,end)};
   }}},async state=>{const encoded=JSON.stringify(state);if(encoded!==saved){await repository.commit({creation:state},ledger);saved=encoded;}});
   if(!coverage.complete)throw Error('CREATION_COVERAGE_INCOMPLETE');
   const matches=coverage.events.filter(e=>e.contract===this.options.registry&&Array.isArray(e.topics)&&e.topics[0]==='register'&&Array.isArray(e.value)&&e.value[0]===this.options.factory&&e.value[1]===arka.manager&&e.value[2]===arka.arkaId);
   if(matches.length!==1)throw Error('FACTORY_CREATION_EVENT_REQUIRED');result=matches[0].ledger;
  });this.queue=job.then(()=>undefined,()=>undefined);await job;return result;
 }
}
