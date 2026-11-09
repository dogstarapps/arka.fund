import fs from'node:fs';import path from'node:path';import os from'node:os';import{fileURLToPath}from'node:url';import{spawnSync}from'node:child_process';import{createHash}from'node:crypto';import assert from'node:assert/strict';
const root=path.dirname(path.dirname(fileURLToPath(import.meta.url))),evidence=process.env.ARKA_RELEASE_EVIDENCE_DIR??path.join(root,'artifacts','contract-build-'+Date.now()),profile=JSON.parse(fs.readFileSync(root+'/release/compiler-profile.json')),roles=JSON.parse(fs.readFileSync(root+'/release/contract-selection.json')).contracts;
const wanted=process.argv.slice(2),selected=wanted.length?roles.filter(r=>wanted.includes(r.role)):roles;assert(selected.length);const cache=process.env.CARGO_TARGET_DIR??path.join(root,'artifacts','wasm-target'),cargo=process.env.CARGO??'cargo',stellar=process.env.STELLAR_CLI??'stellar';
fs.mkdirSync(evidence,{recursive:true});
if (process.platform === 'darwin') {
  const hosted = process.env.GITHUB_ACTIONS === 'true' && process.env.RUNNER_ENVIRONMENT === 'github-hosted';
  if (hosted) {
    const disk = spawnSync('/bin/df', ['-Pk', cache], {encoding:'utf8'});
    assert.equal(disk.status, 0, disk.stderr);
    const availableKiB = Number(disk.stdout.trim().split('\n').at(-1).trim().split(/\s+/)[3]);
    const requiredKiB = 4 * 1024 * 1024;
    fs.writeFileSync(evidence+'/contracts-disk-'+Date.now()+'.json', JSON.stringify({availableKiB, requiredKiB})+'\n', {flag:'wx'});
    assert(availableKiB >= requiredKiB, 'HOSTED_WASM_DISK_BUDGET_EXCEEDED');
  } else {
    const gate = path.join(os.homedir(),'Documents/Codex/mac-maintenance/disk-budget.mjs');
    const disk = spawnSync(process.execPath,[gate,'--path',cache,'--growth-gib','4'],{encoding:'utf8'});
    assert.equal(disk.status,0,disk.stdout+disk.stderr);
    fs.writeFileSync(evidence+'/contracts-disk-'+Date.now()+'.json',disk.stdout,{flag:'wx'});
  }
}
const env={PATH:process.env.PATH,HOME:process.env.HOME,CARGO_INCREMENTAL:'0',CARGO_TARGET_DIR:cache,RUSTUP_TOOLCHAIN:process.env.ARKA_RUST_TOOLCHAIN??'nightly-2025-11-17',RUSTFLAGS:profile.rustflags,CARGO_PROFILE_RELEASE_OVERFLOW_CHECKS:'true'};
assert.equal(spawnSync('rustc',['--version'],{env,encoding:'utf8'}).stdout.trim(),profile.version);assert(spawnSync(stellar,['--version'],{env,encoding:'utf8'}).stdout.startsWith('stellar 26.1.0 '));
const hash=f=>createHash('sha256').update(fs.readFileSync(f)).digest('hex'),tool=path.join(root,'release/build-tools/node_modules/binaryen/bin/wasm-opt'),receipts=[];
function run(cmd,args,cwd,log,taskEnv=env){const fd=fs.openSync(log,'a'),q=spawnSync(cmd,args,{cwd,env:taskEnv,stdio:['ignore',fd,fd],timeout:180000});fs.closeSync(fd);assert.equal(q.status,0,cmd+' FAILED '+log);}
for(const role of selected){
 const dir=evidence+'/build-'+role.role+'-'+Date.now();fs.mkdirSync(dir);const quote=role.role==='xlm-normalizer',workspace=path.join(root,quote?'release/quote-adapter':'contracts'),pkg=quote?'arka-usdc-oracle-adapter-isolated':role.role,log=dir+'/build.log',args=['build',...(quote?[]:['-Zbuild-std=core,alloc']),'--release','--offline','--locked','--jobs','2','--target','wasm32v1-none','-p',pkg],taskEnv=quote?Object.fromEntries(Object.entries(env).filter(([k])=>k!=='RUSTFLAGS')):env;
 if(process.platform==='darwin')run('/usr/bin/sandbox-exec',['-p','(version 1) (allow default) (deny network*)',cargo,...args],workspace,log,taskEnv);else run(cargo,args,workspace,log,taskEnv);
 const raw=dir+'/raw.wasm';fs.copyFileSync(cache+'/wasm32v1-none/release/'+pkg.replaceAll('-','_')+'.wasm',raw);let output=raw;
 if(!quote){const first=dir+'/stellar.wasm';run(stellar,['contract','optimize','--wasm',raw,'--wasm-out',first],workspace,log);output=dir+'/optimized.wasm';run(process.execPath,[root+'/release/wasm-opt.cjs',tool,first,...profile.firstOptimizerFlags,'-o',output],workspace,log);const second=dir+'/second.wasm';run(process.execPath,[root+'/release/wasm-opt.cjs',tool,output,...profile.secondOptimizerFlags,'-o',second],workspace,log);if(fs.statSync(second).size<fs.statSync(output).size)output=second;}
 const actual=hash(output),receipt={role:role.role,wasm:output,sha256:actual,expected:role.sha256,bytes:fs.statSync(output).size,match:actual===role.sha256,workspaceLock:hash(workspace+'/Cargo.lock'),compiler:profile.version,log,networkDenied:true,signaturesCreated:0,transactionsSubmitted:0};fs.writeFileSync(dir+'/receipt.json',JSON.stringify(receipt,null,2)+'\n',{flag:'wx'});receipts.push(receipt);console.log(JSON.stringify({role:role.role,bytes:receipt.bytes,match:receipt.match}));assert(receipt.match,'REPRODUCIBLE_CODE_MISMATCH '+role.role);
}
fs.writeFileSync(evidence+'/reproducible-contracts-'+Date.now()+'.json',JSON.stringify({at:new Date().toISOString(),receipts},null,2)+'\n',{flag:'wx'});
