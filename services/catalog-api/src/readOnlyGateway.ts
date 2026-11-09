import {createServer, type Server} from "node:http";
import {setTimeout as delay} from "node:timers/promises";
import {Transaction,TransactionBuilder} from "@stellar/stellar-sdk";
export const READ_NETWORK="Public Global Stellar Network ; September 2015";
const ENDPOINT="https://mainnet.sorobanrpc.com";
const METHODS=new Set(["getNetwork","getHealth","getLatestLedger","getLedgerEntries","getEvents","simulateTransaction"]);
const GETTERS=new Set(["managed_routes", "is_caller","venue_registry","venue_config","is_allowed","is_auto_allowed","is_exit_allowed","factory","get_pool","fee","token0","token1","is_paused","pool_route","quote_exact_input","get_arkas","is_manager_curated","is_delisted","manager","nav","denomination","fees","whitelist","share_token","blend_markets","liquid_balance","blend_position_values","total_shares","shares_of","inspect_stellar","stellar_asset_policy","stellar_asset_policy_paused","deposit_protection_version","managed_portfolio_policy","managed_withdrawal_policy","managed_queue_state","withdrawal_status","withdrawal_requests"]);
export interface ReadRpcEnvelope {jsonrpc:"2.0";id:string|number;method:string;params?:Record<string,unknown>|null;}
export function assertReadEnvelope(raw:unknown): asserts raw is ReadRpcEnvelope {
 if(!raw||typeof raw!=="object"||Array.isArray(raw))throw Error("READ_RPC_BATCH_OR_INVALID");
 const r=raw as ReadRpcEnvelope;
 if(r.jsonrpc!=="2.0"||!(typeof r.id==="string"||Number.isSafeInteger(r.id))||!METHODS.has(r.method))throw Error("READ_RPC_METHOD_DENIED");
 if(r.params===null&&!['getHealth','getNetwork','getLatestLedger'].includes(r.method))throw Error("READ_RPC_PARAMS_INVALID");
 if(r.params!==null&&r.params!==undefined&&(typeof r.params!=="object"||Array.isArray(r.params)))throw Error("READ_RPC_PARAMS_INVALID");
 if(r.method==="simulateTransaction"){
  const tx=TransactionBuilder.fromXDR(String(r.params?.transaction??""),READ_NETWORK);
  if(!(tx instanceof Transaction)||tx.signatures.length||tx.operations.length!==1)throw Error("READ_RPC_TRANSACTION_DENIED");
  const operation=tx.operations[0];
  if(operation.type!=="invokeHostFunction"||operation.func.switch().name!=="hostFunctionTypeInvokeContract"||operation.auth?.length)throw Error("READ_RPC_OPERATION_DENIED");
  if(!GETTERS.has(operation.func.invokeContract().functionName().toString()))throw Error("READ_RPC_GETTER_DENIED");
 }
}
/** A loopback-only gate for the existing SDK. No signer, send or restore method. */
export class ReadOnlyRpcGateway {
 private calls:Record<string,number>={};private failures:Record<string,number>={};private denied=0;private server:Server|null=null;private started=Date.now();private nextSlot=0;
 constructor(private readonly fetcher:typeof fetch=fetch,private readonly maxCalls=2500,private readonly timeoutMs=12000){}
 stats(){return {endpoint:ENDPOINT,methods:{...this.calls},failures:{...this.failures},elapsedMs:Date.now()-this.started,denied:this.denied,submittedTransactions:0,signerConfigured:false};}
 async forward(raw:unknown):Promise<unknown>{
  try{assertReadEnvelope(raw);}catch(error){this.denied++;throw error;}
  if(Object.values(this.calls).reduce((sum,n)=>sum+n,0)>=this.maxCalls||Date.now()-this.started>180000)throw Error("READ_RPC_RUN_BUDGET");
  let response!:Response;
  for(let attempt=0;attempt<3;attempt++){
   const slot=Math.max(Date.now(),this.nextSlot);this.nextSlot=slot+300;await delay(Math.max(0,slot-Date.now()));
   this.calls[raw.method]=(this.calls[raw.method]??0)+1;
   response=await this.fetcher(ENDPOINT,{method:"POST",redirect:"error",headers:{"content-type":"application/json"},body:JSON.stringify(raw),signal:AbortSignal.timeout(this.timeoutMs)});
   if(response.status!==429||attempt===2)break;this.failures.READ_RPC_HTTP_429=(this.failures.READ_RPC_HTTP_429??0)+1;const retry=Number(response.headers.get("retry-after"));await response.body?.cancel();await delay(Number.isFinite(retry)&&retry>0?Math.min(retry*1000,5000):1000*(attempt+1));
  }
  if(!response.ok||!response.body){const code="READ_RPC_HTTP_"+response.status;this.failures[code]=(this.failures[code]??0)+1;throw Error(code);}
  const reader=response.body.getReader(),chunks:Uint8Array[]=[];let size=0;
  try{while(true){const part=await reader.read();if(part.done)break;size+=part.value.length;if(size>8*1024*1024)throw Error("READ_RPC_RESPONSE_LIMIT");chunks.push(part.value);}}finally{await reader.cancel().catch(()=>{});}
  const body=JSON.parse(Buffer.concat(chunks).toString("utf8"));
  if(body.jsonrpc!=="2.0"||body.id!==raw.id||(!body.result&&!body.error))throw Error("READ_RPC_RESPONSE_INVALID");
  return body;
 }
 async listen():Promise<string>{
  if(this.server)throw Error("READ_GATE_ALREADY_RUNNING");
  this.server=createServer(async(request,response)=>{
   const address=this.server?.address(),port=address&&typeof address!=="string"?address.port:0;
   if(request.method!=="POST"||request.url!=="/"||request.headers.host!=="127.0.0.1:"+port){response.writeHead(405);response.end();return;}
   let raw:unknown;
   try{
    const chunks:Buffer[]=[];let size=0;for await(const chunk of request){size+=chunk.length;if(size>1024*1024)throw Error("READ_RPC_REQUEST_LIMIT");chunks.push(chunk);}
    raw=JSON.parse(Buffer.concat(chunks).toString("utf8"));const body=await this.forward(raw);response.writeHead(200,{"content-type":"application/json","cache-control":"no-store"});response.end(JSON.stringify(body));
   }catch{response.writeHead(403,{"content-type":"application/json","cache-control":"no-store"});response.end(JSON.stringify({jsonrpc:"2.0",id:(raw as ReadRpcEnvelope)?.id??null,error:{code:-32001,message:"read_only_gateway_rejected"}}));}
  });
  await new Promise<void>((resolve,reject)=>{this.server!.once("error",reject);this.server!.listen(0,"127.0.0.1",resolve);});
  const address=this.server.address();if(!address||typeof address==="string")throw Error("READ_GATE_ADDRESS");return "http://127.0.0.1:"+address.port;
 }
 async close():Promise<void>{if(this.server)await new Promise<void>(resolve=>this.server!.close(()=>resolve()));this.server=null;}
}
