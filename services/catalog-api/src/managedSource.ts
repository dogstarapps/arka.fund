import type { ArkaCatalogEntry } from "./types.js";
import type { HolderReader } from "./holders.js";
import type { ManagedSnapshotSource, ManagedCodeIdentity, ManagedObservation, ManagedRequest } from "./managedTypes.js";
import { projectManagedInvestors } from "./managedProjection.js";
import type {ResumableManagedRequests} from "./managedHistory.js";
export interface ManagedReadTransport {
  guard(): Promise<{sequence: number; time: number}>;
  instance(id: string): Promise<{wasmHash: string; ledger: number}>;
  read(id: string, method: string, args?: unknown[]): Promise<unknown>;
}
function text(value: unknown): string {
  if((typeof value!=="bigint"&&typeof value!=="string")||!/^(0|[1-9]\d*)$/.test(String(value)))throw new Error("MANAGED_AMOUNT_INVALID");return String(value);
}
function object(value: unknown): Record<string,unknown> {if(!value||typeof value!=="object"||Array.isArray(value))throw new Error("MANAGED_DATA_INVALID");return value as Record<string,unknown>;}
function stamp(value: unknown): string {return JSON.stringify(value,(_key,v)=>typeof v==="bigint"?String(v):v);}
/** managed_status previews managed_advance(...,16) without persisting its head.
 * Prove that exact preview from the complete canonical request history; never
 * ignore a head mismatch or relax any economic field/change-during-read guard.
 */
function reconcileStatusQueue(queue: Record<string,unknown>, statusQueue: unknown, requests: ManagedRequest[], next: bigint): void {
  if(BigInt(requests.length)!==next-1n||requests.some((r,i)=>BigInt(text(r.id))!==BigInt(i)+1n))throw new Error("MANAGED_HISTORY_GAP");
  const head=BigInt(text(queue.head));
  if(head<1n||head>next||requests.some(r=>BigInt(r.id)<head&&BigInt(r.pending_shares)>0n))throw new Error("MANAGED_QUEUE_CHANGED");
  let preview=head;
  for(let visited=0;visited<16&&preview<next;visited++){
    if(BigInt(text(requests[Number(preview-1n)].pending_shares))>0n)break;
    preview++;
  }
  if(stamp(object(statusQueue))!==stamp({...queue,head:preview}))throw new Error("MANAGED_QUEUE_CHANGED");
}
/** Actual getter adapter. The transport interface deliberately has no write/sign API. */
export class RpcManagedSnapshotSource implements ManagedSnapshotSource {
  private readonly legacy: ReadonlySet<string>;
  private readonly v3: ReadonlySet<string>;
  constructor(private readonly transport: ManagedReadTransport, private readonly holders: HolderReader, hashes: {legacy: string[]; v3: string[]}, private readonly limits={maxRequests:4096,maxHolders:4096,maxLedgerDrift:12},private readonly history?:ResumableManagedRequests,private readonly creation?:{read(arka:ArkaCatalogEntry,ledger:number):Promise<number>}) {
    if([...hashes.legacy,...hashes.v3].some(h=>!/^[a-f0-9]{64}$/.test(h))||hashes.v3.some(h=>hashes.legacy.includes(h)))throw new Error("MANAGED_CODE_ALLOWLIST_INVALID");
    this.legacy=new Set(hashes.legacy);this.v3=new Set(hashes.v3);
    for(const value of Object.values(limits))if(!Number.isSafeInteger(value)||value<1||value>32768)throw new Error("MANAGED_LIMIT_INVALID");
  }
  async identify(arka: ArkaCatalogEntry): Promise<ManagedCodeIdentity> {
    await this.transport.guard();const instance=await this.transport.instance(arka.arkaId);
    return {kind:this.v3.has(instance.wasmHash)?"v3":this.legacy.has(instance.wasmHash)?"legacy":"unknown",codeHash:instance.wasmHash,ledger:instance.ledger};
  }
  async read(arka: ArkaCatalogEntry, identity: ManagedCodeIdentity): Promise<ManagedObservation> {
    if(identity.kind!=="v3"||!this.v3.has(identity.codeHash))throw new Error("MANAGED_CODE_NOT_APPROVED");
    const begin=await this.transport.guard(),id=arka.arkaId;
    if((await this.transport.instance(id)).wasmHash!==identity.codeHash)throw new Error("MANAGED_CODE_CHANGED");
    let depositProtectionVersion: 1|null=null;
    try {if(await this.transport.read(id,"deposit_protection_version")===1)depositProtectionVersion=1;}catch{/* Deposit capability does not control withdrawal rights. */}
    if(!await this.transport.read(id,"managed_portfolio_policy"))throw new Error("MANAGED_POLICY_MISSING");
    const queue=object(await this.transport.read(id,"managed_queue_state")),next=BigInt(text(queue.next_id));
    if(!arka.denominationContract)throw new Error("MANAGED_DENOMINATION_MISSING");
    const available=BigInt(text(await this.transport.read(id,"liquid_balance",[arka.denominationContract]))),physical=BigInt(text(await this.transport.read(arka.denominationContract,"balance",[id])));
    if(physical<available+BigInt(text(queue.reserved_assets)))throw new Error("MANAGED_CASH_RECONCILIATION");
    if(next<1n||next>18446744073709551615n||(!this.history&&next-1n>BigInt(this.limits.maxRequests)))throw new Error("MANAGED_HISTORY_INCOMPLETE");
    let requests: ManagedRequest[]=[];
    if(this.history)requests=await this.history.read({id,hash:identity.codeHash,next,ledger:begin.sequence,transport:this.transport});
    else for(let start=1n;start<next;start+=32n){
      const limit=Number(next-start<32n?next-start:32n),rows=await this.transport.read(id,"withdrawal_requests",[start,limit]);
      if(!Array.isArray(rows)||rows.length!==limit)throw new Error("MANAGED_HISTORY_GAP");
      for(let index=0;index<rows.length;index++){
        const r=object(rows[index]);if(BigInt(text(r.id))!==start+BigInt(index)||typeof r.owner!=="string")throw new Error("MANAGED_REQUEST_INVALID");
        const request={owner:r.owner} as ManagedRequest;
        for(const key of ["id","requested_shares","pending_shares","settled_shares","cancelled_shares","claimable_assets","claimed_assets","created_at","eligible_at","last_settled_at"] as const)request[key]=text(r[key]);
        requests.push(request);
      }
    }
    const owners=new Set([id,arka.manager,...requests.map(r=>r.owner)]);let offset=0,coverage: number|null=null;
    while(true){
      const page=await this.holders.list(arka,{offset,limit:100});
      if(!page.complete||page.stale||page.refreshFailed||page.coverageFromLedger===null||page.total>this.limits.maxHolders)throw new Error("MANAGED_HOLDERS_INCOMPLETE");
      if(coverage!==null&&coverage!==page.coverageFromLedger)throw new Error("MANAGED_HOLDERS_CHANGED");coverage=page.coverageFromLedger;
      if(page.items.length!==Math.min(100,page.total-offset))throw new Error("MANAGED_HOLDERS_PAGE_GAP");
      for(const entry of page.items)owners.add(entry.holder);
      offset+=page.items.length;if(offset>=page.total)break;
    }
    if(owners.size>this.limits.maxHolders)throw new Error("MANAGED_HOLDERS_LIMIT");
    const balances=[];for(const owner of [...owners].sort())balances.push({owner,shares:text(await this.transport.read(id,"shares_of",[owner]))});
    const totalShares=text(await this.transport.read(id,"total_shares"));let nav: string|null=null,status: unknown=null;
    try{status=await this.transport.read(id,"withdrawal_status");}catch{/* Reserved claims do not require an available NAV. */}
    if(status!==null){const s=object(status);reconcileStatusQueue(queue,s.queue,requests,next);nav=text(s.nav);}
    if(stamp(await this.transport.read(id,"managed_queue_state"))!==stamp(queue)||(await this.transport.instance(id)).wasmHash!==identity.codeHash)throw new Error("MANAGED_SNAPSHOT_CHANGED");
    const end=await this.transport.guard();if(end.sequence<begin.sequence||end.sequence-begin.sequence>this.limits.maxLedgerDrift)throw new Error("MANAGED_LEDGER_DRIFT");
    const creationLedger=this.creation?await this.creation.read(arka,end.sequence):undefined;
    if(creationLedger!==undefined&&(coverage!>creationLedger||creationLedger>end.sequence))throw Error('MANAGED_CREATION_COVERAGE_GAP');
    const observation: ManagedObservation={schemaVersion:1,arkaId:id,wasmHash:identity.codeHash,ledger:end.sequence,observedAt:new Date(end.time*1000).toISOString(),fromLedger:coverage!,toLedger:end.sequence,totalShares,nav,reservedAssets:text(queue.reserved_assets),balances,requests,historyComplete:true,holdersComplete:true,depositProtectionVersion,...(creationLedger===undefined?{}:{creationLedger})};
    const projection=projectManagedInvestors({...observation,fundId:id});
    if(projection.excludedEscrowSharesRaw!==text(queue.pending_shares)||requests.filter(r=>BigInt(r.pending_shares)>0n).length!==queue.pending_count)throw new Error("MANAGED_QUEUE_RECONCILIATION");
    return observation;
  }
}
