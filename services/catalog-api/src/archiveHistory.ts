import {Address,Networks,StrKey,TransactionBuilder,hash,xdr} from "@stellar/stellar-sdk";

export interface ArchiveEvent {id:string;ledger:number;contractId:string;txHash:string;operation:number;eventIndex:number;type:string;topic:string[];value:string;ledgerClosedAt:string;sourceId:string;}
export interface ExpertEvent {id:string;paging_token:string;ts:number;contract:string;topicsXdr:string[];bodyXdr:string;}
export interface ExpertTransaction {id:string;hash:string;ledger:number;ts:number;body:string;meta:string;result:string;}
export interface HorizonTransaction {paging_token:string;hash:string;ledger:number;created_at:string;successful:boolean;envelope_xdr:string;result_xdr:string;}
export interface VerifiedArchiveTransaction {id:string;hash:string;ledger:number;closedAt:string;events:ArchiveEvent[];createdContracts:string[];eventHashVerified:true;horizonMatched:true;}
export function expertPosition(id:string):{ledger:number;transactionId:string;operation:number;eventIndex:number}{
 if(!/^\d{1,24}-\d{4,10}$/.test(id))throw Error("ARCHIVE_EVENT_ID_INVALID");
 const [op,offset]=id.split("-"),toid=BigInt(op),ledger=Number(toid>>32n),operation=Number(toid&4095n),eventIndex=Number(offset);
 if(ledger<1||ledger>4294967295||operation<1||eventIndex>100000)throw Error("ARCHIVE_EVENT_ID_INVALID");
 return {ledger,transactionId:String(toid&~4095n),operation,eventIndex};
}
/** Independent Horizon result anchors the event preimage, not merely a JSON checksum. */
export function verifyArchiveTransaction(tx:ExpertTransaction,horizon:HorizonTransaction):VerifiedArchiveTransaction {
 if(!/^\d{1,24}$/.test(tx.id)||!Number.isSafeInteger(tx.ledger)||Number(BigInt(tx.id)>>32n)!==tx.ledger||!Number.isSafeInteger(tx.ts)||horizon.successful!==true||horizon.hash!==tx.hash||horizon.paging_token!==tx.id||horizon.ledger!==tx.ledger||Date.parse(horizon.created_at)!==tx.ts*1000||horizon.result_xdr!==tx.result||horizon.envelope_xdr!==tx.body)throw Error("ARCHIVE_HORIZON_MISMATCH");
 if(TransactionBuilder.fromXDR(tx.body,Networks.PUBLIC).hash().toString("hex")!==tx.hash)throw Error("ARCHIVE_ENVELOPE_HASH_INVALID");
 const meta=xdr.TransactionMeta.fromXDR(tx.meta,"base64"),result=xdr.TransactionResult.fromXDR(tx.result,"base64");
 // Explicitly fail closed on fee-bumps and unsupported meta rather than guessing layouts.
 if(result.result().switch().name!=="txSuccess"||![3,4].includes(meta.switch()))throw Error("ARCHIVE_TRANSACTION_UNSUPPORTED");
 const v=meta.value() as xdr.TransactionMetaV4,operations=v.operations(),results=result.result().results();
 if(operations.length!==results.length||operations.length!==1||!v.sorobanMeta())throw Error("ARCHIVE_TRANSACTION_UNSUPPORTED");
 const events:ArchiveEvent[]=[],createdContracts:string[]=[];
 for(let operation=0;operation<operations.length;operation++){
  const res=results[operation];if(res.switch().name!=="opInner"||res.tr().switch().name!=="invokeHostFunction")throw Error("ARCHIVE_TRANSACTION_UNSUPPORTED");
  const success=res.tr().invokeHostFunctionResult();if(success.switch().name!=="invokeHostFunctionSuccess")throw Error("ARCHIVE_TRANSACTION_FAILED");
  const opEvents=meta.switch()===4?operations[operation].events():(meta.v3().sorobanMeta()?.events()??[]);
  const returnValue=v.sorobanMeta()!.returnValue();if(!returnValue)throw Error("ARCHIVE_RETURN_VALUE_MISSING");
  const actual=hash(new xdr.InvokeHostFunctionSuccessPreImage({returnValue,events:opEvents}).toXDR()).toString("hex");
  if(actual!==success.success().toString("hex"))throw Error("ARCHIVE_EVENT_HASH_INVALID");
  opEvents.forEach((event,index)=>{
   const contract=event.contractId();if(!contract)return;
   const body=event.body().v0(),contractId=StrKey.encodeContract(Buffer.from(contract as unknown as Uint8Array));
   events.push({id:tx.hash+":"+(operation+1)+":"+index,ledger:tx.ledger,contractId,txHash:tx.hash,operation:operation+1,eventIndex:index,type:event.type().name,topic:body.topics().map(t=>t.toXDR("base64")),value:body.data().toXDR("base64"),ledgerClosedAt:horizon.created_at,sourceId:String(BigInt(tx.id)+BigInt(operation+1))+"-"+String(index).padStart(4,"0")});
  });
  for(const change of operations[operation].changes()){
   if(change.switch().name!=="ledgerEntryCreated")continue;
   const entry=change.created();if(entry.data().switch().name!=="contractData")continue;
   const data=entry.data().contractData();if(data.key().switch().name==="scvLedgerKeyContractInstance")createdContracts.push(Address.fromScAddress(data.contract()).toString());
  }
 }
 return {id:tx.id,hash:tx.hash,ledger:tx.ledger,closedAt:horizon.created_at,events,createdContracts,eventHashVerified:true,horizonMatched:true};
}
export function verifyExpertEvent(record:ExpertEvent,contract:string,tx:VerifiedArchiveTransaction):ArchiveEvent {
 const pos=expertPosition(record.id);
 if(record.paging_token!==record.id||record.contract!==contract||record.ts!==Date.parse(tx.closedAt)/1000||pos.transactionId!==tx.id||pos.ledger!==tx.ledger)throw Error("ARCHIVE_EVENT_BINDING_INVALID");
 const event=tx.events.find(e=>e.operation===pos.operation&&e.eventIndex===pos.eventIndex);
 if(!event||event.contractId!==contract||event.value!==record.bodyXdr||JSON.stringify(event.topic)!==JSON.stringify(record.topicsXdr))throw Error("ARCHIVE_EVENT_XDR_MISMATCH");
 return event;
}
/** Pagination exhaustiveness is a source assertion, never a proof of absence on-chain. */
export function checkArchiveEnumeration(contract:string,before:{created:number;events:number},after:{created:number;events:number},records:ExpertEvent[],transactions:Map<string,VerifiedArchiveTransaction>,targetLedger:number){
 if(!StrKey.isValidContract(contract)||!Number.isSafeInteger(before.events)||before.events<0||before.events>100000||!Number.isSafeInteger(before.created)||before.created<1||before.events!==after.events||before.created!==after.created||records.length!==before.events)throw Error("ARCHIVE_COUNT_OR_ORIGIN_CHANGED");
 let previous=0n,previousOffset=-1;const ids=new Set<string>(),events:ArchiveEvent[]=[];
 for(const row of records){
  const position=expertPosition(row.id),op=BigInt(row.id.split("-")[0]);
  if(ids.has(row.id)||op<previous||(op===previous&&position.eventIndex<=previousOffset))throw Error("ARCHIVE_ORDER_OR_DUPLICATE_INVALID");
  ids.add(row.id);previous=op;previousOffset=position.eventIndex;
  const tx=transactions.get(position.transactionId);if(!tx)throw Error("ARCHIVE_TRANSACTION_MISSING");events.push(verifyExpertEvent(row,contract,tx));
 }
 const creation=[...transactions.values()].find(tx=>Date.parse(tx.closedAt)===before.created*1000&&tx.createdContracts.includes(contract));
 if(!creation||creation.ledger>targetLedger)throw Error("ARCHIVE_CREATION_NOT_VERIFIED");
 const verified=events.filter(e=>e.ledger<=targetLedger);
 if(verified.some(e=>e.ledger<creation.ledger))throw Error("ARCHIVE_EVENT_BEFORE_CREATION");
 const verifiedIds=new Set(verified.map(e=>e.id));
 if([...transactions.values()].some(tx=>tx.events.some(e=>e.contractId===contract&&e.ledger<=targetLedger&&!verifiedIds.has(e.id))))throw Error("ARCHIVE_KNOWN_TRANSACTION_EVENT_OMITTED");
 return {contractId:contract,createdLedger:creation.ledger,createdAt:creation.closedAt,creationTransaction:creation.hash,throughLedger:targetLedger,sourceRecordCount:records.length,events:verified,coverage:{status:"archive-index-reconciled" as const,paginationExhausted:true,providerCountMatched:true,transactionEventHashesVerified:true,horizonResultsMatched:true,creationMetadataCrossChecked:true,exhaustiveChainScan:false,independentAbsenceProof:false},complete:false};
}
export interface ArchiveRpcEvent {id:string;ledger:number;txHash:string;contractId:string;type?:string;topic:string[];value:string;}
/** A repeated identical payload may represent two real events; consume occurrences, not just values. */
export function reconcileArchiveRpcEvents(events:ArchiveEvent[],rpcEvents:ArchiveRpcEvent[]):{rpcId:string;archiveId:string}[]{
 const key=(e:ArchiveRpcEvent)=>JSON.stringify([e.txHash,e.contractId,e.ledger,e.type??"contract",e.topic,e.value]),available=new Map<string,string[]>(),ids=new Set<string>();
 for(const event of events){if(ids.has(event.id))throw Error("ARCHIVE_CANONICAL_EVENT_DUPLICATE");ids.add(event.id);const k=key(event),list=available.get(k)??[];list.push(event.id);available.set(k,list);}
 const rpcIds=new Set<string>();return rpcEvents.map(event=>{if(rpcIds.has(event.id))throw Error("ARCHIVE_RPC_EVENT_DUPLICATE");rpcIds.add(event.id);const id=available.get(key(event))?.shift();if(!id)throw Error("ARCHIVE_RPC_EVENT_MISSING");return {rpcId:event.id,archiveId:id};});
}
