import test from'node:test';import assert from'node:assert/strict';
import {mkdtemp,mkdir,readFile,writeFile,readdir,stat}from'node:fs/promises';import{join,resolve}from'node:path';import{tmpdir}from'node:os';import{spawnSync}from'node:child_process';import{pathToFileURL}from'node:url';
import{DurableCatalogRepository,contentHash}from'../../src/durableCatalog.js';import{seedCatalogGenerations}from'../support/catalogGenerations.js';
import{DurableManagedRequests}from'../../src/managedHistory.js';import{READ_NETWORK}from'../../src/index.js';
import{V3,V3_HASH,request}from'../support/managedFixture.js';
const folder=async()=>{const root=process.env.ARKA_CATALOG_TEST_ARTIFACTS??tmpdir();await mkdir(root,{recursive:true});return mkdtemp(join(root,'catalog-continuity-'));};
test('generation 10001 stays readable, continues syncing after restart and restores every original byte',async()=>{
 const directory=await folder(),repo=new DurableCatalogRepository(join(directory,'source'),READ_NETWORK,V3),seed=await seedCatalogGenerations(repo.directory,9999,READ_NETWORK,V3,n=>({n,pad:'x'.repeat(4096)}));
 const at10000=await repo.commit({n:10000,rights:{pending:'20',reserved:'30',paid:'40'}},10000),at10001=await repo.commit({n:10001,rights:{pending:'10',reserved:'40',paid:'40'}},10001);
 assert.equal((await repo.current())!.generation.sequence,10001);assert.equal((await repo.current())!.hash,at10001);
 const restarted=new DurableCatalogRepository(repo.directory,READ_NETWORK,V3);const at10002=await restarted.commit({n:10002,rights:{pending:'0',reserved:'50',paid:'40'}},10002);assert.equal((await restarted.current())!.generation.sequence,10002);
 const backupFile=join(directory,'backup.json'),backup=await restarted.backup(backupFile);assert.equal(backup.objects,10002);assert.equal(contentHash(await readFile(backupFile,'utf8')),backup.hash);
 const restored=await DurableCatalogRepository.restore(backupFile,backup.hash,join(directory,'restored'),READ_NETWORK,V3);assert.equal((await restored.current())!.hash,at10002);
 const names=await readdir(join(repo.directory,'objects'));assert.equal(names.length,10002);assert.deepEqual((await readdir(join(restored.directory,'objects'))).sort(),names.sort());
 for(const name of names)assert.equal(await readFile(join(restored.directory,'objects',name),'utf8'),await readFile(join(repo.directory,'objects',name),'utf8'));
 await restored.commit({n:10003,rights:{pending:'0',reserved:'0',paid:'90'}},10003);assert.equal((await restored.current())!.generation.sequence,10003);assert.equal((await restarted.current())!.hash,at10002);
 // Traverse without materializing all raw and decoded historical payloads.
 const module=pathToFileURL(resolve('dist/src/durableCatalog.js')).href,source=`const{DurableCatalogRepository}=await import(${JSON.stringify(module)});const before=performance.now();const r=new DurableCatalogRepository(${JSON.stringify(repo.directory)},${JSON.stringify(READ_NETWORK)},${JSON.stringify(V3)});const c=await r.current();console.log(JSON.stringify({sequence:c.generation.sequence,milliseconds:performance.now()-before,heapUsed:process.memoryUsage().heapUsed,rss:process.memoryUsage().rss}));`;
 const child=spawnSync(process.execPath,['--max-old-space-size=48','--input-type=module','-e',source],{encoding:'utf8',timeout:30000,maxBuffer:1024*1024});assert.equal(child.status,0,child.stderr);const memory=JSON.parse(child.stdout);assert.equal(memory.sequence,10002);
 await writeFile(join(directory,'result.json'),JSON.stringify({passed:true,syntheticPrefix:9999,published10000:at10000,published10001:at10001,published10002:at10002,backup,originalObjects:10002,restoredByteIdentical:true,resumedSequence:10003,first:seed.first,memory},null,2)+'\n',{flag:'wx'});
});
test('same-ledger duplicate reads do not grow history, but later-ledger observations and live obligations remain recorded',async()=>{
 const directory=await folder(),reader=new DurableManagedRequests(directory,READ_NETWORK),repo=new DurableCatalogRepository(join(directory,V3),READ_NETWORK,V3),row=request(),transport={guard:async()=>{throw Error('UNEXPECTED_GUARD');},instance:async()=>{throw Error('UNEXPECTED_INSTANCE');},read:async()=>[row]};
 const input={id:V3,hash:V3_HASH,next:2n,ledger:100,transport};await reader.read(input);const first=(await repo.current())!;assert.equal(first.generation.sequence,1);await reader.read(input);assert.equal((await repo.current())!.hash,first.hash);
 row.pending_shares='0';row.settled_shares=row.requested_shares;row.claimable_assets='400000000';await reader.read({...input,ledger:101});const changed=(await repo.current())!;assert.equal(changed.generation.sequence,2);
 await reader.read({...input,ledger:102});assert.equal((await repo.current())!.generation.ledger,102);assert.equal((await repo.current())!.generation.sequence,3);await assert.rejects(reader.read({...input,ledger:101}),/LEDGER_REWIND/);
 const rows=(await repo.chain((await repo.current())!.hash)).map(r=>r.generation.data.requests as {rows:unknown[]});assert.equal(rows.length,3);assert.equal(rows[2].rows.length,1);
});
test('same-ledger real changes and simultaneous backups retain complete immutable history',async()=>{
 const directory=await folder(),repo=new DurableCatalogRepository(join(directory,'source'),READ_NETWORK,V3),first=await repo.commit({rights:'10'},100),second=await repo.commit({rights:'20'},100);assert.notEqual(first,second);assert.equal((await repo.current())!.generation.sequence,2);assert.equal(await repo.commit({rights:'20'},100),second);
 const file=join(directory,'raced-backup.json'),results=await Promise.allSettled([repo.backup(file),repo.backup(file)]);assert.equal(results.filter(r=>r.status==='fulfilled').length,1);const success=results.find(r=>r.status==='fulfilled')!;assert(success.status==='fulfilled');assert.equal(success.value.objects,2);const failed=results.find(r=>r.status==='rejected')!;assert(failed.status==='rejected');assert.equal(failed.reason.code,'EEXIST');
 const recovered=await DurableCatalogRepository.restore(file,success.value.hash,join(directory,'restored'),READ_NETWORK,V3);assert.equal((await recovered.current())!.hash,second);assert.deepEqual((await recovered.chain(second)).map(row=>row.generation.data.rights),['20','10']);
});
test('backup preserves the v1 byte format and never replaces an existing destination',async()=>{
 const directory=await folder(),repo=new DurableCatalogRepository(join(directory,'source'),READ_NETWORK,V3);await repo.commit({text:'Unicode — datos',rights:'10'},100);const hash=await repo.commit({text:'Unicode — datos',rights:'20'},101),chain=await repo.chain(hash),file=join(directory,'backup.json');
 const expected=JSON.stringify({kind:'arka-catalog-backup',schemaVersion:1,network:READ_NETWORK,registry:V3,current:hash,objects:chain.map(({hash,raw})=>({hash,raw}))})+'\n';const receipt=await repo.backup(file);assert.equal(await readFile(file,'utf8'),expected);assert.equal(receipt.hash,contentHash(expected));
 await assert.rejects(repo.backup(file),{code:'EEXIST'});assert.equal(await readFile(file,'utf8'),expected);
 const restored=await DurableCatalogRepository.restore(file,receipt.hash,join(directory,'old-v1-format'),READ_NETWORK,V3);assert.equal((await restored.current())!.hash,hash);
});
test('corrupt ancestors are rejected even after a successful read and on a duplicate commit; no backup is published',async()=>{
 const directory=await folder(),repo=new DurableCatalogRepository(join(directory,'source'),READ_NETWORK,V3),first=await repo.commit({n:1},1),head=await repo.commit({n:2},2);await repo.current();const pointer=await readFile(join(repo.directory,'CURRENT.json'),'utf8');
 await writeFile(join(repo.directory,'objects',first+'.json'),'corrupt');await assert.rejects(repo.current(),/HASH_MISMATCH/);await assert.rejects(repo.commit({n:2},2),/HASH_MISMATCH/);const file=join(directory,'corrupt-backup.json');await assert.rejects(repo.backup(file),/HASH_MISMATCH/);await assert.rejects(stat(file),{code:'ENOENT'});assert.equal(await readFile(join(repo.directory,'CURRENT.json'),'utf8'),pointer);assert.equal(JSON.parse(pointer).hash,head);
});
test('valid object hashes cannot hide sequence gaps, ledger reversals or a false root',async()=>{
 for(const mode of ['gap','rewind','root']){
  const directory=await folder(),repo=new DurableCatalogRepository(join(directory,'source'),READ_NETWORK,V3),first=await repo.commit({n:1},10),parent=mode==='root'?null:first,sequence=mode==='gap'?3:2,ledger=mode==='rewind'?9:11;
  const raw=JSON.stringify({kind:'arka-catalog-generation',schemaVersion:1,network:READ_NETWORK,registry:V3,sequence,parent,ledger,capturedAt:'2026-11-04T00:00:00.000Z',data:{n:2}})+'\n',hash=contentHash(raw);await writeFile(join(repo.directory,'objects',hash+'.json'),raw,{flag:'wx'});await writeFile(join(repo.directory,'CURRENT.json'),JSON.stringify({kind:'arka-catalog-pointer',schemaVersion:1,hash}));await assert.rejects(repo.current(),/CHAIN_INVALID/);await assert.rejects(repo.commit({n:3},12),/CHAIN_INVALID/);await assert.rejects(repo.backup(join(directory,'backup.json')),/CHAIN_INVALID/);
 }
});
