import {mainnetReadBackendOrigin,trustedMainnetReadRequest} from '@/lib/server/mainnetReadBackend';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const kinds = new Set(['profile','creation-fee','identity','discover','account','status','fund','portfolio','catalog','quote','prepare','recheck','review','receipt','withdrawal-history']);
export async function GET(request: Request,context:{params:Promise<{kind:string}>}) {
 try{
  if(process.env.NEXT_PUBLIC_MAINNET_GENERAL_READONLY!=='1'||process.env.NEXT_PUBLIC_MANAGED_CATALOG_READ_ONLY!=='1'||!trustedMainnetReadRequest(request))throw Error('DISABLED_OR_ORIGIN');
  const {kind}=await context.params;if(!kinds.has(kind))return Response.json({message:'Unavailable.'},{status:404});
  const page=new URL(request.url),backendOrigin=mainnetReadBackendOrigin(process.env.ARKA_MAINNET_GENERAL_URL);
  const query=page.searchParams.toString();if(query.length>8192)throw Error('SIZE');
  const r=await fetch(backendOrigin+'/'+kind+'?'+query,{cache:'no-store',redirect:'error',signal:AbortSignal.timeout(45000)});
  return Response.json(await r.json(),{status:r.status,headers:{'cache-control':'no-store'}});
 }catch{return Response.json({message:'Verified review unavailable. Nothing was signed or submitted.',canSubmit:false},{status:503,headers:{'cache-control':'no-store'}});}
}
