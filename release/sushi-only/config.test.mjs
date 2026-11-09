import test from 'node:test';import assert from 'node:assert/strict';
import {validate,load} from './validate.mjs';
const root=new URL('../../',import.meta.url).pathname;
test('pinned Sushi-only draft validates while production remains unresolved',()=>assert.equal(validate(...load(root)).productionApplicable,false));
for(const [name,change] of [
 ['Phoenix admission',c=>c.creation.allowedAdapterRoles.push('adapter-phoenix')],
 ['Noah upgrade',c=>c.noah.version=3],['authority replacement',c=>c.authority.address='new'],
 ['fixture target promoted to production',c=>c.target.addresses={factory:'fixture'}],
 ['fee copied from replay',c=>c.target.creationFee.amountRaw='50000000'],
 ['unqualified backend approval',c=>c.backend.mainnetApproved=true],
 ['wrong guard code',c=>c.code.find(x=>x.role==='oracle-guard').sha256='0'.repeat(64)],
 ['automatic route enabled',c=>c.lifecycle.autoEnabled=true],
 ['legacy timelock copied',c=>c.target.timelock.minimumDelay=86400]
])test('rejects '+name,()=>{const args=load(root);change(args[0]);assert.throws(()=>validate(...args));});
test('both proxy flags and no test wallet are mandatory',()=>{for(const k of ['NEXT_PUBLIC_MAINNET_GENERAL_READONLY','NEXT_PUBLIC_MANAGED_CATALOG_READ_ONLY','NEXT_PUBLIC_E2E_WALLET']){const args=load(root);args[1][k]=args[1][k]==='1'?'0':'1';assert.throws(()=>validate(...args));}});
