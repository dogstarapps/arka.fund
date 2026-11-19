import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
const projectId='prj_m834a0nFQbbIxOjql7bohL7yl6Xo', teamId='team_4aK68vp8cg0UD6ikLjucBVtI';
const deploymentId=process.argv[2] || 'dpl_9aRmoxkGB8pKnr3oHjPMBf23zQjR';
async function vercel(path){const response=await fetch(`https://api.vercel.com${path}?teamId=${teamId}`,{headers:{Authorization:`Bearer ${process.env.VERCEL_TOKEN}`},signal:AbortSignal.timeout(30000)});assert.equal(response.status,200);return response.json();}
const [project,deployment]=await Promise.all([vercel(`/v9/projects/${projectId}`),vercel(`/v13/deployments/${deploymentId}`)]);
assert.equal(deployment.readyState,'READY');
assert.equal(deployment.projectId,projectId);
assert.notEqual(deployment.target,'production');
const origin=`https://${deployment.url}`;
assert.equal(project.targets.production.id,'dpl_E23KruB843cq9af69Vpis4tZTK8s');
assert(project.ssoProtection,'Existing deployment protection must remain enabled.');
// Reuse an existing automation credential. Never create, save or disclose one.
const bypass=Object.entries(project.protectionBypass||{}).find(([,v])=>v.scope==='automation-bypass')?.[0];
assert(bypass,'Existing automation authentication is required for remote checks.');
const checks=[];
async function check(path,body,expected){
  const response=await fetch(origin+path,{method:body===undefined?'GET':'POST',headers:{'x-vercel-protection-bypass':bypass,...(body===undefined?{}:{'content-type':'application/json'})},body:body===undefined?undefined:JSON.stringify(body),signal:AbortSignal.timeout(30000)});
  assert.equal(response.status,expected,`${path} unexpected status`);
  const text=await response.text();
  if(expected===403)assert.match(text,/Read-only UX preview/);
  checks.push({path,status:response.status});
  return text;
}
for(const path of ['/dashboard','/investments','/manage','/discover','/vaults','/assets','/managers','/integrations','/coverage','/governance','/factory/create','/status','/settings','/integrations/operator','/governance/console','/contracts','/tiers','/ops','/migrations']){
  const html=await check(path,undefined,200);
  assert.match(html,/UX review preview/);
  assert.match(html,/My investments/);
  if(path!=='/factory/create')assert.match(html,/Create Arka/);
  assert.doesNotMatch(html,/Create a fund/);
  if(path==='/integrations')assert.match(html,/An accepted or submitted order is not a completed swap/);
  if(path==='/coverage')assert.match(html,/not a guarantee against loss/);
  if(path==='/factory/create')assert.match(html,/Draft review only/);
}
const swapHtml=await check('/arkas/CCP7X4UYFSUNXWRUH7W25RQMEQEHXFIYHNHVGAYAGGOOHPMPJKZGOGPW?workspace=rebalance',undefined,200);
assert.match(swapHtml,/Review change/);
assert.match(swapHtml,/Estimated to the fund/);
const network=JSON.parse(await check('/api/soroban/rpc',{jsonrpc:'2.0',id:1,method:'getNetwork'},200));
assert.equal(network.result.passphrase,'Public Global Stellar Network ; September 2015');
// Inert invalid payloads: the middleware must reject them before an RPC or
// financial endpoint can receive them. No real signed transaction is used.
await check('/api/soroban/rpc',{jsonrpc:'2.0',id:1,method:'sendTransaction',params:{transaction:'NOT_A_REAL_TRANSACTION'}},403);
await check('/api/soroban/rpc',[{jsonrpc:'2.0',id:1,method:'getHealth'},{jsonrpc:'2.0',id:2,method:'sendTransaction'}],403);
await check('/api/intents/balanced/submit',{},403);
await check('/api/intents/balanced/build',{},403);
await check('/api/intents/balanced/relay',{},403);
await check('/api/intents/balanced/refund',{},403);
await check('/api/catalog/v1/arkas/NOT_A_CONTRACT/profile',{},403);
await check('/api/routing/rebalance/plan',{intentTxHash:'NOT_A_REAL_TRANSACTION'},403);
const after=await vercel(`/v9/projects/${projectId}`);
assert.equal(after.targets.production.id,project.targets.production.id);
const report={checkedAt:new Date().toISOString(),deploymentId,url:origin,readyState:deployment.readyState,target:'preview',productionUnchanged:true,productionId:after.targets.production.id,protectionUnchanged:true,existingAutomationCredentialReused:true,newCredentialsCreated:false,financialTransactionsSent:0,network:network.result.passphrase,checks,browserVerification:'Local browser evidence and exact checked states are recorded in followup-screen-matrix.json. This remote deployment is checked over authenticated HTTP, not visually certified by those local screenshots; existing Vercel browser login remains required.'};
await fs.writeFile(new URL('../preview-evidence/verification.json',import.meta.url),JSON.stringify(report,null,2));
console.log(JSON.stringify(report));
