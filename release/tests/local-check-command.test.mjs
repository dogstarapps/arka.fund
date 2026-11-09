import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';

const root=fileURLToPath(new URL('../../',import.meta.url));
function capture(args){
 const parent=process.env.ARKA_RELEASE_EVIDENCE_DIR??tmpdir();
 fs.mkdirSync(parent,{recursive:true});
 const directory=fs.mkdtempSync(path.join(parent,'arka-check-command-'));
 const log=path.join(directory,'commands.jsonl'),preload=path.join(directory,'capture.mjs');
 // Capture planned subprocess commands only. No build, signature test, key or chain call runs.
 fs.writeFileSync(preload,`import fs from 'node:fs';import cp from 'node:child_process';import{syncBuiltinESMExports}from'node:module';cp.spawnSync=(command,args)=>{fs.appendFileSync(process.env.ARKA_COMMAND_LOG,JSON.stringify({command,args})+'\\n');return{status:0};};syncBuiltinESMExports();`);
 const result=spawnSync(process.execPath,['--import',preload,root+'release/check-local.mjs',...args],{env:{PATH:path.dirname(process.execPath)+':/usr/bin:/bin',ARKA_RELEASE_EVIDENCE_DIR:directory,ARKA_COMMAND_LOG:log},encoding:'utf8'});
 assert.equal(result.status,0,result.stderr);
 return fs.readFileSync(log,'utf8').trim().split('\n').map(line=>JSON.parse(line));
}
test('default full local check does not opt any child job into signing',()=>{
 const commands=capture([]);
 assert.equal(commands.filter(c=>c.args[0]==='release/run-local.mjs').length,8);
 assert(!commands.some(c=>c.args.includes('--ephemeral-signatures')));
 assert.deepEqual(commands.find(c=>c.args[0]==='release/signature-check.mjs').args,
  ['release/signature-check.mjs','--verify-existing','--unsigned']);
});
test('explicit signature opt-in is forwarded only to the four eligible test jobs without executing them',()=>{
 const commands=capture(['--ephemeral-signatures']);
 const jobs=commands.filter(c=>c.args[0]==='release/run-local.mjs'&&c.args.includes('--ephemeral-signatures'));
 assert.deepEqual(commands.find(c=>c.args[0]==='release/signature-check.mjs').args,
  ['release/signature-check.mjs','--verify-existing','--ephemeral-signatures']);
 assert.deepEqual(jobs.map(c=>c.args[1]),['catalog-unit','catalog-integration','sdk-unit','web-test']);
});

