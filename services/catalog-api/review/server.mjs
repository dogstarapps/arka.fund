import fs from'node:fs';import http from'node:http';import path from'node:path';import assert from'node:assert/strict';
import {RpcCoordinator,VerifiedGateway,ObservationIndex,ReviewStore,validateConfig} from'./runtime.mjs';import{createHandler}from'./service.mjs';import * as operations from'../dist/src/reviewOperations.js';
import {catalogObservationLoader}from'./catalog.mjs';
// Pure read/review service. There is no secret-key, signing or sending interface.
// All deployment-specific paths and URLs are explicit; no archive is loaded.
const value=name=>{const i=process.argv.indexOf(name);assert(i>=0&&process.argv[i+1],name+' required');return process.argv[i+1];};
const config=validateConfig(JSON.parse(fs.readFileSync(value('--config'),'utf8'))),directory=path.resolve(value('--state')),port=Number(value('--port')),origin=new URL(value('--web-origin')).origin,catalog=new URL(value('--catalog-url'));
assert(Number.isSafeInteger(port)&&port>=1024&&port<=65535);assert(['https:','http:'].includes(catalog.protocol)&&!catalog.username&&!catalog.password&&!catalog.search&&!catalog.hash);if(catalog.protocol==='http:')assert(catalog.hostname==='127.0.0.1');
assert(config.preservation?.noah==='CCP7X4UYFSUNXWRUH7W25RQMEQEHXFIYHNHVGAYAGGOOHPMPJKZGOGPW');assert(config.legacyIds?.includes(config.preservation.noah),'NOAH_V2_IDENTITY_REQUIRED');
const index=new ObservationIndex(catalogObservationLoader(config,{catalogUrl:catalog}));
const metadata=async id=>{const u=new URL('v1/arkas/'+encodeURIComponent(id),catalog.href.endsWith('/')?catalog:new URL(catalog.href+'/'));const r=await fetch(u,{redirect:'error',signal:AbortSignal.timeout(5000)});if(!r.ok)return null;const e=await r.json();return e.arkaId===id?{name:e.identity?.displayName}:null;};
const gateway=new VerifiedGateway(config,{rpc:new RpcCoordinator(config),index,operations,metadata,store:new ReviewStore(path.join(directory,'reviews'),config,operations)});
http.createServer(createHandler(gateway,{origin,config})).listen(port,'127.0.0.1',()=>console.log(JSON.stringify({port,readOnly:true,canSign:false,canSubmit:false})));
