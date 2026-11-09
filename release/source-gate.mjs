import fs from'node:fs';import path from'node:path';import{fileURLToPath}from'node:url';import assert from'node:assert/strict';
import {sha,inventory,releaseId} from './source-inventory.mjs';
import {verifyArtifactBindings} from './artifact-bindings.mjs';
export {sha};
export function verifySources(root,manifest){
 assert.equal(manifest.schema,1);assert.equal(manifest.noah.version,2,'NOAH_VERSION_CHANGED');assert.equal(manifest.noah.address,'CCP7X4UYFSUNXWRUH7W25RQMEQEHXFIYHNHVGAYAGGOOHPMPJKZGOGPW');assert.equal(manifest.mainnetApproved,false,'UNREVIEWED_MAINNET_APPROVAL');
 for(const f of manifest.files){assert(!path.isAbsolute(f.path)&&!f.path.split('/').includes('..'),'OUTSIDE_RELEASE');assert.equal(sha(path.join(root,f.path)),f.sha256,'RELEASE_SOURCE_CHANGED '+f.path);}
 assert.deepEqual(inventory(root),manifest.files,'RELEASE_INVENTORY_CHANGED');assert.equal(releaseId(manifest.files),manifest.releaseId,'RELEASE_ID_CHANGED');
 const imported=JSON.parse(fs.readFileSync(path.join(root,'release/contract-selection.json')));for(const c of imported.contracts)assert.equal(sha(path.join(root,c.file)),c.sha256,'WASM_CHANGED '+c.role);
 verifyArtifactBindings(root,imported);
 return{sourcesVerified:true,files:manifest.files.length,wasmCount:imported.contracts.length,noahVersion:2,mainnetApproved:false};
}
export function inspectTargetEvidence(evidence,manifest,now=Date.now()){
 assert(evidence&&evidence.mode==='authorized-live-read','CURRENT_AUTHORIZED_READ_REQUIRED');const age=now-Date.parse(evidence.capturedAt);assert(Number.isFinite(age)&&age>=0&&age<=15*60*1000,'CURRENT_TARGET_EVIDENCE_REQUIRED');assert.equal(evidence.releaseId,manifest.releaseId,'TARGET_RELEASE_CHANGED');assert.equal(evidence.network,'Public Global Stellar Network ; September 2015');assert.equal(evidence.noahVersion,2,'NOAH_VERSION_CHANGED');
 for(const key of['contractIdentitiesVerified','permissionsVerified','oraclesAndRoutesVerified','completeCreationIndexVerified','restoreAndTtlPriced','completeBudgetPriced'])assert.equal(evidence[key],true,'TARGET_CHECK_MISSING '+key);
 return{currentTargetEvidenceStructurallyValid:true,deploymentAuthorized:false,sign:false,submit:false};
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const root=path.dirname(path.dirname(fileURLToPath(import.meta.url))),manifest=JSON.parse(fs.readFileSync(root+'/release/source-manifest.json'));console.log(JSON.stringify(verifySources(root,manifest)));
 if(process.argv.includes('--mainnet')){const i=process.argv.indexOf('--target-evidence');assert(i>=0&&process.argv[i+1],'MAINNET_BLOCKED_CURRENT_TARGET_EVIDENCE_MISSING');console.log(JSON.stringify(inspectTargetEvidence(JSON.parse(fs.readFileSync(process.argv[i+1])),manifest)));}
}
