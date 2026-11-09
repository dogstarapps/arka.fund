// Test/preview containment only. No production runtime imports this module.
import http from 'node:http';
import https from 'node:https';
import net from 'node:net';
import tls from 'node:tls';
import {syncBuiltinESMExports} from 'node:module';
const RPC_PORTS=new Set([8000,8001,11625,11626,3142,3138]);
function allowed(input,second){
 let host,port;
 if(input instanceof URL||typeof input==='string'&&/^https?:/.test(input)){
  const u=new URL(input);host=u.hostname;port=Number(u.port|| (u.protocol==='https:'?443:80));
 }else if(typeof input==='number'){port=input;host=typeof second==='string'?second:'localhost';}
 else if(input&&typeof input==='object'){
  if(input.path&& !input.host&&!input.hostname&&!input.port&&String(input.path).startsWith('/'))return;
  host=input.hostname??input.host??'localhost';port=Number(input.port??80);
 }else{host='localhost';port=Number(second??80);}
 if(!['127.0.0.1','localhost','::1','[::1]'].includes(host)||RPC_PORTS.has(port))throw new Error('LOCAL_CATALOG_TEST_NETWORK_BLOCKED');
}
for(const module of [http,https])for(const name of ['request','get']){
 const original=module[name];module[name]=function(...args){allowed(args[0],args[1]);return Reflect.apply(original,this,args);};
}
for(const [module,name]of [[net,'connect'],[net,'createConnection'],[tls,'connect']]){
 const original=module[name];module[name]=function(...args){allowed(args[0],args[1]);return Reflect.apply(original,this,args);};
}
const fetch=globalThis.fetch;
globalThis.fetch=function(input,options){allowed(input instanceof Request?input.url:input);return fetch(input,options);};
syncBuiltinESMExports();
