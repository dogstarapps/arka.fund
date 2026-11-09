// Verify the compiled, read-only localhost preview. Never uses signed XDR.
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
const origin = 'http://127.0.0.1:3127';
const checks = [];
async function check(path, body, status) {
  const response = await fetch(origin + path, {method:body===undefined?'GET':'POST',headers:body===undefined?{}:{'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body),signal:AbortSignal.timeout(30000)});
  assert.equal(response.status,status,`Unexpected response for ${path}`);
  const text = await response.text();
  if (status===403) assert.match(text,/Read-only UX preview/);
  checks.push({path,status:response.status});
  return text;
}
for (const path of ['/dashboard','/discover','/investments','/manage','/vaults','/assets','/managers','/integrations','/coverage','/factory/create','/governance','/status','/settings','/ops','/contracts','/tiers','/migrations','/integrations/operator','/governance/console']) {
  const html = await check(path,undefined,200);
  assert.match(html,/UX review preview/);
  assert.doesNotMatch(html,/Create a fund/);
}
const network = JSON.parse(await check('/api/soroban/rpc',{jsonrpc:'2.0',id:1,method:'getNetwork'},200));
assert.equal(network.result.passphrase,'Public Global Stellar Network ; September 2015');
await check('/api/soroban/rpc',{jsonrpc:'2.0',id:1,method:'sendTransaction',params:{transaction:'NOT_A_REAL_TRANSACTION'}},403);
await check('/api/soroban/rpc',[{jsonrpc:'2.0',id:1,method:'getNetwork'},{jsonrpc:'2.0',id:2,method:'sendTransaction'}],403);
for (const path of ['/api/intents/balanced/submit','/api/intents/balanced/build','/api/intents/balanced/relay','/api/intents/balanced/refund','/api/catalog/v1/arkas/NOT_A_CONTRACT/profile']) await check(path,{},403);
await check('/api/routing/rebalance/plan',{intentTxHash:'NOT_A_REAL_TRANSACTION'},403);
const report = {checkedAt:new Date().toISOString(),origin,mode:'compiled-local-read-only-preview',checks,financialTransactionsSent:0,signaturesProduced:0,network:network.result.passphrase,operatorInteriorsVerified:false};
await fs.writeFile(new URL('../preview-evidence/followup-local-verification.json',import.meta.url),JSON.stringify(report,null,2));
console.log(JSON.stringify(report));
