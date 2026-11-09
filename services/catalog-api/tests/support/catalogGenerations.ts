import {mkdir,writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {contentHash,type CatalogData,type CatalogGeneration} from '../../src/durableCatalog.js';

/** Synthetic historical fixture; subsequent appends use the actual repository. */
export async function seedCatalogGenerations(directory:string,count:number,network:string,registry:string,data:(sequence:number)=>CatalogData){
 await mkdir(join(directory,'objects'),{recursive:true});let parent:string|null=null,first='';
 for(let sequence=1;sequence<=count;sequence++){
  const generation:CatalogGeneration={kind:'arka-catalog-generation',schemaVersion:1,network,registry,sequence,parent,ledger:sequence,capturedAt:'2026-11-04T00:00:00.000Z',data:data(sequence)},raw=JSON.stringify(generation)+'\n',hash=contentHash(raw);
  await writeFile(join(directory,'objects',hash+'.json'),raw,{flag:'wx'});if(!first)first=hash;parent=hash;
 }
 await writeFile(join(directory,'CURRENT.json'),JSON.stringify({kind:'arka-catalog-pointer',schemaVersion:1,hash:parent})+'\n',{flag:'wx'});
 return {first,current:parent!};
}
