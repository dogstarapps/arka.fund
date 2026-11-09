export interface HistoricalEvent {id:string;ledger:number;[key:string]:unknown;}
export interface HistoricalCoverage {schemaVersion:1;network:string;contracts:string[];requestedFrom:number;coveredFrom:number|null;scannedThrough:number;targetLedger:number;oldestAvailable:number;cursor:string|null;rangeEnd:number|null;gap:{from:number;to:number}|null;events:HistoricalEvent[];complete:boolean;}
export interface HistoricalEventTransport {events(start:number,end:number,cursor:string|null):Promise<{events:HistoricalEvent[];cursor:string|null;scannedThrough:number}>;}
/** RPC TOID cursor: high 32 bits identify ledger; only sentinel offsets finish it. */
export function eventCursorLedger(cursor:string,end:number):number {
 const parts=cursor.split("-");if(parts.length!==2||!/^\d{1,24}$/.test(parts[0])||!/^\d{1,10}$/.test(parts[1]))throw Error("HISTORY_CURSOR_INVALID");
 const token=BigInt(parts[0]),ledger=token>>32n,complete=(token&4294967295n)===4294967295n&&BigInt(parts[1])===4294967295n;
 if(ledger>4294967295n||BigInt(parts[1])>4294967295n)throw Error("HISTORY_CURSOR_INVALID");return Math.min(Number(ledger)-(complete?0:1),end);
}
/** Resume bounded pages; a retention gap is permanent until a trusted backfill is supplied. */
export async function collectHistoricalEvents(input:{network:string;contracts:string[];fromLedger:number;oldestLedger:number;latestLedger:number;previous?:HistoricalCoverage;transport:HistoricalEventTransport;maxPages?:number;pageSize?:number},save:(value:HistoricalCoverage)=>Promise<void>):Promise<HistoricalCoverage>{
 const {network,fromLedger,oldestLedger,latestLedger,transport}=input,contracts=[...new Set(input.contracts)].sort(),maxPages=input.maxPages??8,pageSize=input.pageSize??100;
 if(![fromLedger,oldestLedger,latestLedger,maxPages,pageSize].every(n=>Number.isSafeInteger(n)&&n>0)||oldestLedger>latestLedger||fromLedger>latestLedger)throw Error("HISTORY_BOUNDS_INVALID");
 const state:HistoricalCoverage=input.previous?structuredClone(input.previous):{schemaVersion:1,network,contracts,requestedFrom:fromLedger,coveredFrom:null,scannedThrough:fromLedger-1,targetLedger:latestLedger,oldestAvailable:oldestLedger,cursor:null,rangeEnd:null,gap:null,events:[],complete:false};
 if(state.schemaVersion!==1||state.network!==network||JSON.stringify(state.contracts)!==JSON.stringify(contracts)||state.requestedFrom!==fromLedger||state.targetLedger>latestLedger||!Number.isSafeInteger(state.scannedThrough)||state.scannedThrough<fromLedger-1||state.scannedThrough>state.targetLedger||!Array.isArray(state.events)||state.events.length>1000000||(state.cursor===null)!==(state.rangeEnd===null)||(state.rangeEnd!==null&&(!Number.isSafeInteger(state.rangeEnd)||state.rangeEnd<state.scannedThrough||state.rangeEnd>state.targetLedger)))throw Error("HISTORY_CHECKPOINT_INVALID");
 const existingIds=new Set<string>();for(const event of state.events){if(typeof event.id!=="string"||existingIds.has(event.id)||!Number.isSafeInteger(event.ledger)||event.ledger<fromLedger||event.ledger>state.targetLedger)throw Error("HISTORY_CHECKPOINT_INVALID");existingIds.add(event.id);}
 state.targetLedger=latestLedger;state.oldestAvailable=oldestLedger;state.complete=false;
 if(state.scannedThrough+1<oldestLedger){state.gap={from:state.gap?.from??state.scannedThrough+1,to:oldestLedger-1};state.scannedThrough=oldestLedger-1;state.cursor=null;state.rangeEnd=null;}
 const seen=new Map(state.events.map(event=>[event.id,event]));
 for(let page=0;page<maxPages&&state.scannedThrough<latestLedger;page++){
  const start=state.scannedThrough+1,end=state.rangeEnd??latestLedger,result=await transport.events(start,end,state.cursor);
  if(!Array.isArray(result.events)||result.events.length>pageSize||!Number.isSafeInteger(result.scannedThrough)||result.scannedThrough<state.scannedThrough||result.scannedThrough>end)throw Error("HISTORY_PAGE_INVALID");
  for(const event of result.events){if(typeof event.id!=="string"||!event.id||!Number.isSafeInteger(event.ledger)||event.ledger<start||event.ledger>end)throw Error("HISTORY_EVENT_INVALID");const prior=seen.get(event.id);if(prior&&JSON.stringify(prior)!==JSON.stringify(event))throw Error("HISTORY_EVENT_CONFLICT");seen.set(event.id,event);}
  state.events=[...seen.values()].sort((a,b)=>a.ledger-b.ledger||a.id.localeCompare(b.id));state.coveredFrom??=start;
  state.scannedThrough=result.scannedThrough;
  if(state.scannedThrough<end){if(!result.cursor||result.cursor===state.cursor)throw Error("HISTORY_CURSOR_STALLED");state.cursor=result.cursor;state.rangeEnd=end;}
  else{state.cursor=null;state.rangeEnd=null;}
  state.complete=state.scannedThrough>=latestLedger&&state.gap===null;await save(structuredClone(state));
 }
 state.complete=state.scannedThrough>=latestLedger&&state.gap===null;await save(structuredClone(state));return state;
}
