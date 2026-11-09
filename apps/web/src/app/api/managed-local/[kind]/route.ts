import {NextRequest,NextResponse} from 'next/server';
import {StrKey} from '@stellar/stellar-sdk';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export async function GET(request:NextRequest,{params}:{params:Promise<{kind:string}>}){
 const host=request.headers.get('host')??'';
 if(process.env.ARKA_MANAGED_PRODUCT_LOCAL!=='1'||process.env.NEXT_PUBLIC_MANAGED_PRODUCT_LOCAL!=='1'||!/^127\.0\.0\.1:\d+$/.test(host)||!process.env.ARKA_LOCAL_RUNTIME_TOKEN)return NextResponse.json({error:'Not found.'},{status:404});
 const {kind}=await params;
 const candidate=process.env.ARKA_MANAGED_CATALOG_CANDIDATE==='1';
 const real=process.env.ARKA_MANAGED_REAL_READS==='1';
 if(real&&!candidate)return NextResponse.json({error:'Read-only candidate flags required.'},{status:404});
 if(candidate&&process.env.NEXT_PUBLIC_MANAGED_CATALOG_READ_ONLY!=='1')return NextResponse.json({error:'Read-only candidate flags required.'},{status:404});
 if(real&&['fund','portfolio'].includes(kind)){
  const owners=request.nextUrl.searchParams.getAll('owner');
  if(owners.length!==1||!StrKey.isValidEd25519PublicKey(owners[0]))return NextResponse.json({error:'An explicit valid public owner is required. No personal position was assumed.'},{status:400});
 }
 if(!['fund','portfolio','status','creation',...(real?['catalog']:[])].includes(kind)||[...request.nextUrl.searchParams.keys()].some(k=>!['fund','owner'].includes(k))||(kind==='creation'&&request.nextUrl.searchParams.size))return NextResponse.json({error:'Not found.'},{status:404});
 const configuredPort=process.env.ARKA_ISOLATED_RECEIPT_PORT??'';
 const port=Number(configuredPort);
 if(!/^[1-9]\d{3,4}$/.test(configuredPort)||!Number.isSafeInteger(port)||port<1024||port>65535)return NextResponse.json({error:'Local service unavailable. No holdings have been treated as zero.'},{status:503});
 try{
  const response=await fetch(`http://127.0.0.1:${port}/${kind}?${request.nextUrl.searchParams}`,{cache:'no-store',redirect:'error',headers:{authorization:`Bearer ${process.env.ARKA_LOCAL_RUNTIME_TOKEN}`},signal:AbortSignal.timeout(25000)});
  return NextResponse.json(await response.json(),{status:response.status,headers:{'cache-control':'no-store'}});
 }catch{return NextResponse.json({error:'Local service unavailable. No holdings have been treated as zero.'},{status:503});}
}
