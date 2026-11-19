import fs from 'node:fs';import {createHash} from 'node:crypto';
import {Address,StrKey,nativeToScVal,xdr} from '@stellar/stellar-sdk';
export function loadV3DefaultRuntime(){
 if(process.env.ARKA_V3_DEFAULT_CANDIDATE!=='1'||process.env.NEXT_PUBLIC_V3_DEFAULT_CREATION!=='1')throw Error('ISOLATED_V3_PROFILE_DISABLED');
 const file=process.env.ARKA_V3_DEFAULT_RUNTIME_FILE,expected=process.env.NEXT_PUBLIC_V3_DEFAULT_RUNTIME_SHA;if(!file||!expected)throw Error('ISOLATED_V3_PROFILE_UNAVAILABLE');
 const bytes=fs.readFileSync(file);if(createHash('sha256').update(bytes).digest('hex')!==expected)throw Error('ISOLATED_V3_PROFILE_CHANGED');const data=JSON.parse(bytes.toString());
 if(data.profile.defaultVersion!==3||data.profile.method!=='create_managed_routes'||data.profile.canSign!==false||data.profile.canSubmit!==false||data.profile.productionReady!==false)throw Error('ISOLATED_V3_PROFILE_INVALID');return data;
}
export function assertV3LocalRequest(request:Request){
 const u=new URL(request.url),host=request.headers.get('host')??u.host,origin=request.headers.get('origin');
 // Next normalizes a loopback URL internally. Authorize the explicit browser Host,
 // not that internal alias, while keeping the port and same-origin boundary exact.
 const match=/^127\.0\.0\.1:(\d+)$/.exec(host);
 if(!match||u.protocol!=='http:'||!['127.0.0.1','localhost','[::1]'].includes(u.hostname)||u.port!==match[1]||(origin&&origin!=='http://'+host))throw Error('LOOPBACK_ORIGIN_REQUIRED');
}
export function buildV3DefaultReview(body:Record<string,unknown>){
 const r=loadV3DefaultRuntime(),p=r.profile;
 for(const k of Object.keys(body))if(!['version','factoryId','creatorPubKey','saltHex','denominationContract','fees','whitelistContracts','routerId'].includes(k))throw Error('UNKNOWN_CREATION_FIELD');
 if(body.version!==undefined&&body.version!==3)throw Error('V3_REQUIRED_NO_V2_FALLBACK');
 if(body.factoryId!==p.factory)throw Error('FACTORY_DOES_NOT_MATCH_V3_RELEASE');
 if(typeof body.creatorPubKey!=='string'||!StrKey.isValidEd25519PublicKey(body.creatorPubKey))throw Error('EXPLICIT_PUBLIC_MANAGER_REQUIRED');
 if(typeof body.saltHex!=='string'||!/^[a-f0-9]{64}$/i.test(body.saltHex))throw Error('EXACT_32_BYTE_SALT_REQUIRED');
 if(body.denominationContract!==p.denomination||body.routerId!==p.router)throw Error('PROFILE_NOT_QUALIFIED_FOR_SELECTED_DENOMINATION_OR_ROUTER');
 const wl=body.whitelistContracts;if(!Array.isArray(wl)||wl.length!==p.assets.length||new Set(wl).size!==wl.length||JSON.stringify([...wl].sort())!==JSON.stringify([...p.assets].sort()))throw Error('PROFILE_ASSET_SET_MISMATCH');
 const f=body.fees as Record<string,number>;if(!f||Object.keys(f).sort().join(',')!=='deposit_bps,mgmt_bps,perf_bps,redeem_bps'||Object.values(f).some(v=>!Number.isInteger(v)||v<0||v>10000))throw Error('INVALID_EXISTING_FEE_BPS');
 if(f.redeem_bps!==0)throw Error('EXISTING_MANAGED_REDEEM_FEE_GUARD');
 const addr=(id:string)=>Address.fromString(id).toScVal(),config=xdr.ScVal.scvMap(Object.entries({denomination:addr(p.denomination),deposit_bps:nativeToScVal(f.deposit_bps,{type:'i32'}),mgmt_bps:nativeToScVal(f.mgmt_bps,{type:'i32'}),perf_bps:nativeToScVal(f.perf_bps,{type:'i32'}),router:addr(p.router),template_hash:xdr.ScVal.scvBytes(Buffer.from(r.templateHash,'hex'))}).map(([key,val])=>new xdr.ScMapEntry({key:nativeToScVal(key,{type:'symbol'}),val})));
 const invocation=xdr.HostFunction.hostFunctionTypeInvokeContract(new xdr.InvokeContractArgs({contractAddress:Address.fromString(p.factory).toScAddress(),functionName:p.method,args:[xdr.ScVal.scvBytes(Buffer.from(body.saltHex,'hex')),addr(body.creatorPubKey),config]}));
 const match=invocation.toXDR('base64')===r.witnessHostFunction;
 return {releaseId:p.releaseId,version:3,method:p.method,factory:p.factory,registry:p.registry,manager:body.creatorPubKey,invocationXdr:invocation.toXDR('base64'),matchingQualifiedReceipt:match,commercialFeeUsdcRaw:p.commercialFeeUsdcRaw,networkFeeReferenceRaw:p.creationReferenceRaw,referenceOnly:true,requiresFreshSimulation:true,requiresFreshAccountSequence:true,requiresRegistrarAndCodeHealthCheck:true,readyForSignature:false,canSubmit:false,signaturesCreated:0,transactionsSubmitted:0,notes:'Unsigned invocation draft only. Not a transaction, not a current simulation or deployment. No V2 fallback.'};
}
