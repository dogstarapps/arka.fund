import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import{createRequire}from'node:module';import{fileURLToPath}from'node:url';
import {spawnSync} from 'node:child_process';
const root=fileURLToPath(new URL('../../',import.meta.url)),{load}=createRequire(root+'apps/web/package.json')('js-yaml'),ci=load(fs.readFileSync(root+'.github/workflows/ci.yml','utf8'));
test('release verification accepts the current release branches with read-only GitHub permissions',()=>{assert(ci.on.push.branches.includes('release/**'));assert.deepEqual(ci.permissions,{contents:'read'});for(const job of Object.values(ci.jobs))assert(job.steps.some(s=>s.uses==='actions/checkout@v4'&&s.with['persist-credentials']===false));});
test('all selected artifact identities are rebuilt without uploading the compiler target',()=>{const job=ci.jobs['wasm-reproducibility'];assert.equal(job['runs-on'],'macos-26');assert(job.steps.some(s=>s.run==='node release/build-contracts.mjs'));const upload=job.steps.find(s=>s.uses==='actions/upload-artifact@v4');assert.equal(upload.with.path,job.env.ARKA_RELEASE_EVIDENCE_DIR);assert.notEqual(upload.with.path,job.env.CARGO_TARGET_DIR);assert.notEqual(upload.with.path,'artifacts/');});
test('the application gate requires the named cryptographic matrix and constructor binding tests',()=>{const check=fs.readFileSync(root+'release/check-local.mjs','utf8');assert.match(check,/release\/tests\/artifact-bindings.test.mjs/);assert.match(check,/release\/tests\/ci-configuration.test.mjs/);assert.match(check,/signature-check.mjs','--verify-existing/);assert(ci.jobs.application.steps.some(s=>s.run==='npm run release:check'));});
test('the release workflow never invokes the live mainnet health or deployment scripts',()=>{for(const job of Object.values(ci.jobs))for(const step of job.steps)if(step.run)assert(!/example:mainnet|build-platform-status|deploy-|sendTransaction|workflow.*dispatch/i.test(step.run));});
test('dependency scope guards supplement all strict npm audits and preserve their failure',()=>{const steps=ci.jobs.application.steps;assert(steps.some(s=>s.run==='node release/dependency-scope.mjs'));const audit=steps.find(s=>s.name==='Check dependency advisories');assert.equal(audit.if,'always()');for(const dir of ['apps/web','services/catalog-api','sdk/typescript'])assert(audit.run.includes('npm audit --prefix '+dir+' --json'));assert(audit.run.includes('exit "$arka_audit_failed"'));assert(!audit['continue-on-error']);assert(!/audit-level|omit=dev|\|\| true|--force/.test(audit.run));});
test('all npm audit reports are collected when the first and last audit fail',()=>{const parent=process.env.ARKA_RELEASE_EVIDENCE_DIR??root+'artifacts';fs.mkdirSync(parent,{recursive:true});const dir=fs.mkdtempSync(parent+'/ci-audit-');fs.mkdirSync(dir+'/bin');fs.mkdirSync(dir+'/evidence');const fake='#!/bin/sh\nprintf "%s\\n" "$3" >> "$ARKA_FAKE_NPM_LOG"\nprintf "{}\\n"\ncase "$3" in services/catalog-api) exit 0 ;; *) exit 1 ;; esac\n';fs.writeFileSync(dir+'/bin/npm',fake,{mode:0o700});const script=ci.jobs.application.steps.find(s=>s.name==='Check dependency advisories').run,result=spawnSync('/bin/bash',['--noprofile','--norc','-e','-o','pipefail','-c',script],{encoding:'utf8',env:{PATH:dir+'/bin:/usr/bin:/bin',ARKA_FAKE_NPM_LOG:dir+'/calls.log',ARKA_RELEASE_EVIDENCE_DIR:dir+'/evidence'}});assert.equal(result.status,1,result.stderr);assert.deepEqual(fs.readFileSync(dir+'/calls.log','utf8').trim().split('\n'),['apps/web','services/catalog-api','sdk/typescript']);for(const name of ['web','catalog','sdk'])assert.equal(fs.readFileSync(dir+'/evidence/npm-'+name+'.json','utf8'),'{}\n');});
test('both RustSec audits retain their raw reports and pass the exit code to the release gate', () => {
  const steps = ci.jobs.contracts.steps;
  assert(steps.some(step => step.run === 'node release/dependency-scope.mjs --rust'));
  const audits = steps.filter(step => step.name?.startsWith('Audit ') && step.run?.includes('cargo audit'));
  assert.equal(audits.length, 2);
  const locks = ['contracts/Cargo.lock', 'release/quote-adapter/Cargo.lock'];
  for (const [index, audit] of audits.entries()) {
    const lock = locks[index];
    assert.equal(audit.if, 'always()');
    assert(!audit['continue-on-error']);
    assert(!/--ignore|\|\| true/.test(audit.run));
    assert(audit.run.includes(`cargo audit --file ${lock} --json > "$report" || audit_exit=$?`));
    assert(audit.run.includes(`node release/rustsec-gate.mjs ${lock} "$report" "$audit_exit"`));
  }
});
