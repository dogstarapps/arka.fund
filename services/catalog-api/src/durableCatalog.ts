import {createHash,randomUUID} from "node:crypto";
import {mkdir,open,readFile,rename,stat,readdir,link,unlink} from "node:fs/promises";
import {join,dirname} from "node:path";
export type CatalogData=Record<string,unknown>;
export interface CatalogGeneration {kind:"arka-catalog-generation";schemaVersion:1;network:string;registry:string;sequence:number;parent:string|null;ledger:number;capturedAt:string;data:CatalogData;}
type GenerationRecord={hash:string;raw:string;generation:CatalogGeneration};
const HASH=/^[a-f0-9]{64}$/;
export const contentHash=(data:string)=>createHash("sha256").update(data).digest("hex");
function decode(raw:string,expected:string,network:string,registry:string):CatalogGeneration {
 if(contentHash(raw)!==expected)throw Error("GENERATION_HASH_MISMATCH");
 const value=JSON.parse(raw) as CatalogGeneration;
 if(value.kind!=="arka-catalog-generation"||value.schemaVersion!==1||value.network!==network||value.registry!==registry||!Number.isSafeInteger(value.sequence)||value.sequence<1||!Number.isSafeInteger(value.ledger)||value.ledger<1||!Number.isFinite(Date.parse(value.capturedAt))||(value.parent!==null&&!HASH.test(value.parent))||!value.data||typeof value.data!=="object"||Array.isArray(value.data))throw Error("GENERATION_INVALID");
 return value;
}
async function durableWrite(file:string,body:string):Promise<void>{const handle=await open(file,"wx",0o600);try{await handle.writeFile(body);await handle.sync();}finally{await handle.close();}}
async function syncDirectory(directory:string):Promise<void>{const handle=await open(directory,"r");try{await handle.sync();}finally{await handle.close();}}
/** Single local writer, immutable objects, one atomic publication pointer. */
export class DurableCatalogRepository {
 private operation:Promise<void>=Promise.resolve();
 constructor(readonly directory:string,readonly network:string,readonly registry:string){}
 private async currentHash():Promise<string|null>{
  let pointer:string;try{pointer=await readFile(join(this.directory,"CURRENT.json"),"utf8");}catch(error){if((error as NodeJS.ErrnoException).code!=="ENOENT")throw error;try{if((await readdir(join(this.directory,"objects"))).length)throw Error("GENERATION_POINTER_MISSING");}catch(cause){if((cause as NodeJS.ErrnoException).code!=="ENOENT")throw cause;}return null;}
  const ref=JSON.parse(pointer);if(ref.kind!=="arka-catalog-pointer"||ref.schemaVersion!==1||!HASH.test(ref.hash))throw Error("GENERATION_POINTER_INVALID");
  return ref.hash;
 }
 private async *walk(first:string):AsyncGenerator<GenerationRecord>{
  if(!HASH.test(first))throw Error("GENERATION_HASH_INVALID");let hash:string|null=first,newer:CatalogGeneration|undefined;const seen=new Set<string>();
  while(hash){
   if(seen.has(hash))throw Error("GENERATION_CHAIN_INVALID");seen.add(hash);
   const raw=await readFile(join(this.directory,"objects",hash+".json"),"utf8"),generation=decode(raw,hash,this.network,this.registry);
   if(newer&&(newer.sequence!==generation.sequence+1||newer.ledger<generation.ledger))throw Error("GENERATION_CHAIN_INVALID");
   yield {hash,raw,generation};newer=generation;hash=generation.parent;
  }
  if(newer?.sequence!==1)throw Error("GENERATION_CHAIN_INVALID");
 }
 async current():Promise<{hash:string;generation:CatalogGeneration}|null>{
  const hash=await this.currentHash();if(!hash)return null;
  let head:CatalogGeneration|undefined;for await(const row of this.walk(hash))head??=row.generation;
  return {hash,generation:head!};
 }
 async chain(first:string):Promise<GenerationRecord[]>{
  const result:GenerationRecord[]=[];for await(const row of this.walk(first))result.push(row);
  return result;
 }
 async commit(data:CatalogData,ledger:number,fault?:"after-object"):Promise<string>{
  const input=structuredClone(data);let result="";const operation=this.operation.then(async()=>{
   const previous=await this.current();if(previous&&ledger<previous.generation.ledger)throw Error("GENERATION_LEDGER_REWIND");
   // Validate the entire published history even for a no-op. A later ledger
   // remains a new checkpoint; only identical same-ledger writes are redundant.
   if(previous&&ledger===previous.generation.ledger&&JSON.stringify(input)===JSON.stringify(previous.generation.data)){result=previous.hash;return;}
   const generation:CatalogGeneration={kind:"arka-catalog-generation",schemaVersion:1,network:this.network,registry:this.registry,sequence:(previous?.generation.sequence??0)+1,parent:previous?.hash??null,ledger,capturedAt:new Date().toISOString(),data:input};
   const raw=JSON.stringify(generation)+"\n",hash=contentHash(raw);decode(raw,hash,this.network,this.registry);
   await mkdir(join(this.directory,"objects"),{recursive:true});await durableWrite(join(this.directory,"objects",hash+".json"),raw);await syncDirectory(join(this.directory,"objects"));
   if(fault==="after-object")throw Error("INJECTED_CRASH_AFTER_OBJECT");
   const temporary=join(this.directory,"CURRENT."+randomUUID()+".tmp");await durableWrite(temporary,JSON.stringify({kind:"arka-catalog-pointer",schemaVersion:1,hash})+"\n");await rename(temporary,join(this.directory,"CURRENT.json"));await syncDirectory(this.directory);result=hash;
  });this.operation=operation.then(()=>undefined,()=>undefined);await operation;return result;
 }
 async backup(file:string):Promise<{hash:string;objects:number}>{
  const current=await this.currentHash();if(!current)throw Error("GENERATION_NOT_AVAILABLE");
  const temporary=file+"."+randomUUID()+".tmp",handle=await open(temporary,"wx",0o600),digest=createHash("sha256");let objects=0;
  const append=async(body:string)=>{await handle.writeFile(body);digest.update(body);};
  try{
   await append(JSON.stringify({kind:"arka-catalog-backup",schemaVersion:1,network:this.network,registry:this.registry,current}).slice(0,-1)+',"objects":[');
   for await(const {hash,raw}of this.walk(current)){await append((objects?",":"")+JSON.stringify({hash,raw}));objects++;}
   await append("]}\n");await handle.sync();
  }finally{await handle.close();}
  // Publish a complete, validated v1 backup without replacing an existing file.
  // Failed staging files remain available for diagnosis. On success, only our
  // redundant staging link is removed; its bytes remain at the published path.
  await link(temporary,file);await syncDirectory(dirname(file));await unlink(temporary);await syncDirectory(dirname(file));
  return {hash:digest.digest("hex"),objects};
 }
 static async restore(file:string,expectedHash:string,target:string,network:string,registry:string):Promise<DurableCatalogRepository>{
  const raw=await readFile(file,"utf8");if(contentHash(raw)!==expectedHash)throw Error("BACKUP_HASH_MISMATCH");const backup=JSON.parse(raw);
  if(backup.kind!=="arka-catalog-backup"||backup.schemaVersion!==1||backup.network!==network||backup.registry!==registry||!HASH.test(backup.current)||!Array.isArray(backup.objects)||backup.objects.length<1)throw Error("BACKUP_INVALID");
  const objects=new Map<string,string>();for(const item of backup.objects){decode(item.raw,item.hash,network,registry);if(objects.has(item.hash))throw Error("BACKUP_DUPLICATE_OBJECT");objects.set(item.hash,item.raw);}
  const seen=new Set<string>();let hash:string|null=backup.current,sequence:number|null=null,ledger:number|null=null;
  while(hash){if(seen.has(hash)||!objects.has(hash))throw Error("BACKUP_CHAIN_INCOMPLETE");seen.add(hash);const generation=decode(objects.get(hash)!,hash,network,registry);if(sequence!==null&&(generation.sequence!==sequence-1||generation.ledger>ledger!))throw Error("BACKUP_CHAIN_INVALID");sequence=generation.sequence;ledger=generation.ledger;hash=generation.parent;}
  if(sequence!==1||seen.size!==objects.size)throw Error("BACKUP_CHAIN_INVALID");
  try{await stat(target);throw Error("RESTORE_TARGET_EXISTS");}catch(error){if((error as NodeJS.ErrnoException).code!=="ENOENT")throw error;}
  await mkdir(target);await mkdir(join(target,"objects"));for(const [digest,body]of objects)await durableWrite(join(target,"objects",digest+".json"),body);
  await syncDirectory(join(target,"objects"));await durableWrite(join(target,"CURRENT.json"),JSON.stringify({kind:"arka-catalog-pointer",schemaVersion:1,hash:backup.current})+"\n");await syncDirectory(target);
  const repository=new DurableCatalogRepository(target,network,registry);await repository.current();return repository;
 }
}
