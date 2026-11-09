import './signature-policy.mjs';
import http from'node:http';import https from'node:https';import net from'node:net';import tls from'node:tls';import dgram from'node:dgram';import{syncBuiltinESMExports}from'node:module';
const local=process.env.ARKA_RELEASE_NETWORK==='loopback',rpcPorts=new Set([8000,8001,11625,11626,3142,3138]);
function allow(input,second){
 if(!local)throw Error('TARGET_PROFILE_ALL_NETWORK_DISABLED');let host,port;
 if(input instanceof URL||typeof input==='string'&&/^https?:/.test(input)){const u=new URL(input);host=u.hostname;port=Number(u.port||(u.protocol==='https:'?443:80));}
 else if(typeof input==='number'){port=input;host=typeof second==='string'?second:'localhost';}
 else if(input&&typeof input==='object'){if(input.path&&!input.host&&!input.hostname&&!input.port&&String(input.path).startsWith('/'))return;host=input.hostname??input.host??'localhost';port=Number(input.port??80);}
 else{host='localhost';port=Number(second??80);}
 if(!['127.0.0.1','localhost','::1','[::1]'].includes(host)||rpcPorts.has(port))throw Error('LOCAL_CATALOG_TEST_NETWORK_BLOCKED');
}
for(const m of[http,https])for(const n of['request','get']){const fn=m[n];m[n]=function(...args){allow(args[0],args[1]);return Reflect.apply(fn,this,args);};}
for(const[m,n]of[[net,'connect'],[net,'createConnection'],[tls,'connect']]){const fn=m[n];m[n]=function(...args){allow(args[0],args[1]);return Reflect.apply(fn,this,args);};}
dgram.createSocket=()=>{throw Error('LOCAL_CATALOG_TEST_NETWORK_BLOCKED');};const fetch=globalThis.fetch;globalThis.fetch=(input,options)=>{allow(input instanceof Request?input.url:input);return fetch(input,options);};syncBuiltinESMExports();
for(const k of Object.keys(process.env))if(/SECRET|TOKEN|PASSWORD|PRIVATE|_SK$|CREDENTIAL|API_KEY/i.test(k))delete process.env[k];
