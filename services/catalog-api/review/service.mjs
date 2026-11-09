import assert from 'node:assert/strict';
import {creationFeeTerms} from './core.mjs';
import {sdk,predictCreatedFund} from './runtime.mjs';
export function createHandler(gateway,{origin,config}){return async(req,res)=>{const send=(status,value)=>{res.writeHead(status,{'content-type':'application/json','cache-control':'no-store'});res.end(JSON.stringify(value));};try{assert(req.method==='GET'&&req.headers.host==='127.0.0.1:'+req.socket.localPort&&(!req.headers.origin||req.headers.origin===origin),'READ_ONLY_ORIGIN_REQUIRED');const u=new URL(req.url,'http://127.0.0.1');assert(u.search.length<=8192);const q=u.searchParams,get=(key)=>{const value=q.get(key);assert(value,'EXPLICIT_'+key.toUpperCase()+'_REQUIRED');return value;};
 const profile={...config,defaultVersion:3,method:'create_managed_routes',mode:'mainnet-readonly',canSign:false,canSubmit:false,productionReady:false,executionEnabled:config.mainnetApproved===true&&config.executionEnabled===true};delete profile.preservation;delete profile.legacyIds;
 if(u.pathname==='/profile'){
  let fee=null;try{fee=creationFeeTerms(config);}catch{/* Missing creator configuration must not block withdrawal profiles. */}
  return send(200,{profile:{...profile,creationFeeConfigured:fee!==null},defaultDraft:{version:3,factoryId:config.factory,creatorPubKey:'',denominationContract:config.denomination,routerId:config.router,whitelistContracts:config.assets,fees:{mgmt_bps:0,perf_bps:0,deposit_bps:0,redeem_bps:0},templateHash:config.templateHash,...(fee?{creationFee:fee}:{})},...(fee?{}:{creationUnavailable:'Creation fee details are unavailable. Existing investments and withdrawals remain available.'})});
 }
 if(u.pathname==='/identity')return send(200,await gateway.identity(get('fund')));
 if(u.pathname==='/discover')return send(200,await gateway.discover());
 if(u.pathname==='/account')return send(200,await gateway.account(get('owner')));
 if(u.pathname==='/withdrawal-history')return send(200,await gateway.withdrawalHistory(get('fund'),get('owner'),get('observationId'),Number(get('offset'))));
 if(u.pathname==='/creation-fee')return send(200,await gateway.creationFee(get('factory'),get('owner')));
 if(u.pathname==='/status')return send(200,{mode:'manual',running:false,financialExecutionEnabled:false,keeperEnabled:false,transactionsSubmitted:0,readOnly:true});
 if(u.pathname==='/fund'||u.pathname==='/catalog'){const product=await gateway.readFund(get('fund'),get('owner'));return send(200,u.pathname==='/catalog'?{network:config.network,mode:'live',product,catalogVerified:true,canSubmit:false}:product);}
 if(u.pathname==='/portfolio')return send(200,await gateway.portfolio(get('owner')));
 if(u.pathname==='/quote'){const kind=get('kind');return send(200,await gateway.quote({fund:get('fund'),owner:get('owner'),kind,...(kind==='withdrawal'?{}:{asset:get('asset'),amountRaw:get('amountRaw'),sell:q.get('sell')==='true'})}));}
 if(u.pathname==='/prepare')return send(200,await gateway.prepare(JSON.parse(get('intent')),get('source'),get('network')));
 if(u.pathname==='/recheck')return send(200,await gateway.recheck(get('id'),get('source')));
 if(u.pathname==='/review'){const input=JSON.parse(get('draft')),source=input.creatorPubKey;assert(sdk.StrKey.isValidEd25519PublicKey(source),'EXPLICIT_SOURCE_REQUIRED');const {version,factoryId,creatorPubKey,...draft}=input;assert(version===3&&factoryId===config.factory);return send(200,await gateway.prepare({action:'create',fund:predictCreatedFund(config.factory,source,draft.saltHex),draft},source,config.network));}
 if(u.pathname==='/receipt')return send(200,await gateway.receipt(get('id'),get('source')));
 return send(404,{message:'Unavailable.'});
 }catch(e){const code=String(e.message),message=/COOLDOWN|429/.test(code)?'The read provider is cooling down. Wait before checking again.':/INDEX|COVERAGE/.test(code)?'The verified investment index is incomplete. Holdings have not been treated as zero.':/NOT_LIVE|CURRENT_V3|FACTORY|REGISTRY_NOT/.test(code)?'The required mainnet contracts are not active and verified. Nothing was signed or submitted.':/OWNER|SOURCE|owner|source/.test(code)?'Choose an explicit public account. No account has been assumed.':/DISK_RESERVE/.test(code)?'Local evidence storage is paused to preserve free disk space.':'This review could not be verified. Nothing was signed or submitted.';return send(/ORIGIN/.test(code)?403:409,{message,error:message,readyForSignature:false,canSubmit:false});}};}
