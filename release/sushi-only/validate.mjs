import fs from 'node:fs';
import assert from 'node:assert/strict';
export function validate(c, env, selection) {
 assert.equal(c.schema,1); assert.equal(c.mainnetApproved,false);
 assert.deepEqual(c.authority,{address:'GBHIT7TXZSRWT4QZXKINECMQWKC7NC7GBJAGK6XFOURI3T6ZHJDTHCMD',changed:false,newCouncil:false});
 assert.deepEqual(c.noah,{version:2,migrate:false,touch:false});
 assert.deepEqual(c.scope.protocols,['Sushi']);
 assert.deepEqual(c.creation.allowedAdapterRoles,['adapter-sushi']);
 assert.equal(c.creation.bootstrapAuxiliaries,false);assert.equal(c.creation.borrowEnabled,false);
 const roles=['governance-executor','arka-factory','arka-registry','venue-registry','router','oracle-guard','adapter-sushi','arka','share-token'];
 assert.deepEqual([...c.scope.shared,...c.scope.templates],roles);
 assert.deepEqual(c.code,roles.map(role=>selection.contracts.find(x=>x.role===role)));
 assert.equal(c.oracle.base,'USD');assert.equal(c.oracle.decimals,14);assert.equal(c.oracle.relaxAgeOrDivergence,false);
 assert.equal(c.target.status,'unqualified');
 for(const k of ['addresses','salts','constructorArguments','templateHash','rpcUrl','catalogUrl','liquidityAndTtlEvidence'])assert.equal(c.target[k],null,'UNQUALIFIED_TARGET '+k);
 assert.deepEqual(c.backend,{mainnetApproved:false,executionEnabled:false,targetRequiredBeforeApplication:true});
 assert.equal(c.target.timelock.unit,'ledger');assert.equal(c.target.timelock.minimumDelay,null);assert.equal(c.target.timelock.gracePeriod,null);
 assert.equal(c.target.creationFee.amountRaw,null);assert.equal(c.target.creationFee.treasury,null);assert.equal(c.target.creationFee.changeAuthorized,false);
 assert.equal(c.lifecycle.initialManualEnabled,false);assert.equal(c.lifecycle.autoEnabled,false);assert.equal(c.lifecycle.callerInitiallyAllowed,false);
 assert.equal(c.network,'Public Global Stellar Network ; September 2015');assert.equal(env.NEXT_PUBLIC_STELLAR_NETWORK,c.network);
 for(const k of ['NEXT_PUBLIC_MAINNET_GENERAL_READONLY','NEXT_PUBLIC_MANAGED_CATALOG_READ_ONLY','NEXT_PUBLIC_MAINNET_CONNECTOR_READONLY','NEXT_PUBLIC_V3_MAINNET_READONLY','NEXT_PUBLIC_MAINNET_EXECUTION_ENABLED'])assert.equal(env[k],'1',k);
 for(const k of ['NEXT_PUBLIC_E2E_WALLET','E2E_WALLET_ENABLED'])assert.equal(env[k],'0',k);
 assert.equal(env.NEXT_PUBLIC_SOROBAN_RPC_URL,'http://127.0.0.1:65534');
 assert.equal(c.productionAccess,false);return {configurationValidated:true,productionApplicable:false,noahVersion:2};
}
export function load(root){return [JSON.parse(fs.readFileSync(root+'/release/sushi-only/application.json')),JSON.parse(fs.readFileSync(root+'/release/sushi-only/frontend-build-env.json')),JSON.parse(fs.readFileSync(root+'/release/contract-selection.json'))];}
