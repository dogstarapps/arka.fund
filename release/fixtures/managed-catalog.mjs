// Deterministic fictitious chain; the real candidate indexer/getter adapter is used.
// No LocalChain, wallet, keeper, signer, historical database or remote transport.
import fs from 'node:fs/promises';
import path from 'node:path';
import * as api from '../../services/catalog-api/dist/src/index.js';
import * as f from '../../services/catalog-api/dist/tests/support/managedFixture.js';
export {f};
export async function createIntegrationFixture(directory,{stage='partial'}={}){
 if(!['requested','partial','cancelled','cancelled-paid','reserved','paid'].includes(stage))throw Error('Unknown isolated fixture stage.');
 await fs.mkdir(directory,{recursive:true});
 const identity=new api.FileIdentityStore(path.join(directory,'identity.json')),history=new api.FileCatalogHistoryStore(path.join(directory,'history.json'));
 await identity.write(f.identities());
 const transport=new f.FixtureManagedTransport(),records=new api.FileManagedObservationStore(path.join(directory,'managed.json'));
 const source=new api.RpcManagedSnapshotSource(transport,f.legacyHolders(),{legacy:[f.LEGACY_HASH],v3:[f.V3_HASH]});
 const access=new api.ManagedCatalogAccess(records);
 const runner=new api.ManagedCatalogSyncRunner(new api.StaticCatalogSyncRunner(()=>api.buildSnapshot(f.baseEntries(transport.observation.observedAt),[],transport.observation.observedAt)),source,records);
 const service=new api.CatalogService(new api.FileCatalogStore(path.join(directory,'snapshot.json')),history,runner,{identityStore:identity,holderReader:new api.MixedHolderReader(f.legacyHolders(),access),managedWithdrawals:access});
 const app=api.createCatalogApp({service,readOnly:true});let ledger=100,tail=Promise.resolve();
 const refresh=()=>{const run=tail.then(async()=>{
  transport.observation=f.state(stage,ledger++);transport.observation.observedAt=new Date().toISOString();
  await service.sync();
 });tail=run.catch(()=>{});return run;};
 await refresh();
 async function product(owner=f.INVESTOR){
  const response=await app.inject({url:`/v1/arkas/${f.V3}/managed-position?owner=${owner}`});
  if(response.statusCode!==200)throw Error('Candidate catalog position unavailable.');
  const d=response.json();
  return {id:f.V3,name:'Managed V3 Arka · local fixture',manager:f.MANAGER,symbol:'test units',token:f.TOKEN,network:'Standalone Network ; February 2017',
   clock:Math.floor(Date.parse(d.indexedAt)/1000),ledger:d.ledger,freeShares:d.position.freeSharesRaw,totalShares:d.totalShares,
   policy:{epoch_seconds:'60',manager_window:'60',min_request_shares:'1',buffer_bps:1000},
   portfolioPolicy:{auto_payout:true,instant_cash:true,max_slippage_bps:100,cancel_lock_seconds:'3600',routes:[]},
   holdings:[{asset:f.TOKEN,symbol:'test units',cash:(BigInt(d.nav??0)+BigInt(d.reservedAssets)).toString()}],
   depositAssets:[{asset:f.TOKEN,symbol:'test units',balance:'10000000000',allowance:'0',native:false}],
   depositError:null,fees:{mgmt_bps:0,perf_bps:0,deposit_bps:0,redeem_bps:0},depositProtectionVersion:1,
   queue:{pending_shares:d.pendingShares,reserved_assets:d.reservedAssets},requests:[],requestsTruncated:false,
   status:d.nav===null?null:{nav:d.nav,total_shares:d.totalShares,cash:(BigInt(d.nav)+BigInt(d.reservedAssets)).toString(),settle_capacity:'0'},
   valuationError:d.nav===null?'Valuation unavailable. Reserved claims remain visible.':null,catalogPosition:d};
 }
 return {app,service,transport,records,access,refresh,product,scope:'fictitious-mixed-catalog',financialKeeperActive:false,transactionsSubmitted:0};
}
