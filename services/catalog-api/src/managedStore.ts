import { createHash, randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile, rename } from "node:fs/promises";
import { dirname } from "node:path";
import { projectManagedInvestors } from "./managedProjection.js";
import type { ManagedObservation } from "./managedTypes.js";
export interface ManagedRecord {id: string; observation: ManagedObservation;}
interface Archive {kind: "arka-managed-v3"; schemaVersion: 1; records: ManagedRecord[];}
function stable(value: unknown): string {
  if(Array.isArray(value)) return "["+value.map(stable).join(",")+"]";
  if(value!==null&&typeof value==="object")return "{"+Object.entries(value).sort(([a],[b])=>a<b?-1:a>b?1:0).map(([k,v])=>JSON.stringify(k)+":"+stable(v)).join(",")+"}";
  return JSON.stringify(value);
}
function identity(observation: ManagedObservation): string {
  const {observedAt: _time,...state}=observation;
  return createHash("sha256").update(stable(state)).digest("hex");
}
function validate(o: ManagedObservation): void {
  if(o.creationLedger!==undefined&&(!Number.isSafeInteger(o.creationLedger)||o.creationLedger<o.fromLedger||o.creationLedger>o.ledger))throw new Error('MANAGED_CREATION_COVERAGE_GAP');
  if(o.schemaVersion!==1||!Number.isSafeInteger(o.ledger)||o.ledger<1||!Number.isSafeInteger(o.fromLedger)||o.fromLedger<1||o.fromLedger>o.ledger||o.toLedger!==o.ledger||!Number.isFinite(Date.parse(o.observedAt))||!/^[a-f0-9]{64}$/.test(o.wasmHash))throw new Error("MANAGED_ARCHIVE_INVALID");
  projectManagedInvestors({...o,fundId:o.arkaId});
}
function forward(previous: ManagedObservation, next: ManagedObservation): void {
  if(previous.creationLedger!==undefined&&next.creationLedger!==previous.creationLedger)throw new Error('MANAGED_CREATION_IDENTITY_CHANGED');
  if(next.ledger<=previous.ledger)throw new Error("MANAGED_LEDGER_NONMONOTONIC");
  const current=new Map(next.requests.map(r=>[r.id,r]));
  for(const old of previous.requests){
    const row=current.get(old.id);if(!row)throw new Error("MANAGED_HISTORY_REMOVED");
    for(const key of ["owner","requested_shares","created_at","eligible_at"] as const)if(row[key]!==old[key])throw new Error("MANAGED_REQUEST_IDENTITY_CHANGED");
    for(const key of ["settled_shares","cancelled_shares","claimed_assets"] as const)if(BigInt(row[key])<BigInt(old[key]))throw new Error("MANAGED_REQUEST_STATE_REWOUND");
    if(BigInt(row.pending_shares)>BigInt(old.pending_shares)||BigInt(row.claimable_assets)+BigInt(row.claimed_assets)<BigInt(old.claimable_assets)+BigInt(old.claimed_assets))throw new Error("MANAGED_REQUEST_STATE_REWOUND");
  }
}
/** Separate append-only observations; never opens legacy identity/holder files. */
export class FileManagedObservationStore {
  private mutation: Promise<void> = Promise.resolve();
  constructor(private readonly file: string) {}
  async read(): Promise<Archive> {
    let raw: string;try{raw=await readFile(this.file,"utf8");}catch(error){if((error as NodeJS.ErrnoException).code==="ENOENT")return {kind:"arka-managed-v3",schemaVersion:1,records:[]};throw error;}
    const value=JSON.parse(raw) as Archive;
    if(value.kind!=="arka-managed-v3"||value.schemaVersion!==1||!Array.isArray(value.records))throw new Error("MANAGED_ARCHIVE_SCHEMA_MISMATCH");
    const ids=new Set<string>(),latest=new Map<string,ManagedObservation>();for(const record of value.records){validate(record.observation);if(record.id!==identity(record.observation)||ids.has(record.id))throw new Error("MANAGED_ARCHIVE_INTEGRITY");const previous=latest.get(record.observation.arkaId);if(previous)forward(previous,record.observation);latest.set(record.observation.arkaId,record.observation);ids.add(record.id);}
    return value;
  }
  async get(id: string): Promise<ManagedRecord | null> {return (await this.read()).records.find(r=>r.id===id)??null;}
  async history(arkaId: string): Promise<ManagedRecord[]> {return (await this.read()).records.filter(r=>r.observation.arkaId===arkaId);}
  async put(observation: ManagedObservation): Promise<ManagedRecord> {
    const input=structuredClone(observation);validate(input);let result!: ManagedRecord;
    const operation=this.mutation.then(async()=>{
      const archive=await this.read(),id=identity(input),same=archive.records.find(r=>r.id===id);
      if(same){result=same;return;}
      const previous=archive.records.filter(r=>r.observation.arkaId===input.arkaId).at(-1);
      if(previous)forward(previous.observation,input);
      result={id,observation:input};archive.records.push(result);
      await mkdir(dirname(this.file),{recursive:true});
      const temporary=this.file+"."+randomUUID()+".tmp";
      await writeFile(temporary,JSON.stringify(archive,null,2)+"\n",{flag:"wx",mode:0o600});await rename(temporary,this.file);
    });
    this.mutation=operation.then(()=>undefined,()=>undefined);await operation;return structuredClone(result);
  }
}
