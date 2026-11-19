import {NextRequest,NextResponse} from 'next/server';
import {prepareManagedLocal,signManagedLocal,executeManagedLocal,managedLocalReceipt} from '@/lib/server/managedLocalBridge';
import type {ManagedActor} from '@/lib/managedWithdrawals';
export const runtime='nodejs';export const dynamic='force-dynamic';
export async function POST(req:NextRequest){
 const host=req.headers.get('host')??'';
 if(process.env.ARKA_MANAGED_INTEGRATION!=='1'||process.env.ARKA_MANAGED_PREVIEW!=='1'||process.env.NEXT_PUBLIC_UX_REVIEW_PREVIEW!=='1'||!/^127\.0\.0\.1:\d+$/.test(host)||req.headers.get('origin')!==`http://${host}`||req.headers.get('x-arka-local-preview')!=='1')return NextResponse.json({error:'Local wallet preview is unavailable.'},{status:404});
 if(Number(req.headers.get('content-length'))>32768)return NextResponse.json({error:'Request too large.'},{status:413});
 try{
  const text=await req.text();if(text.length>32768)return NextResponse.json({error:'Request too large.'},{status:413});
  const v=JSON.parse(text);if(!v||typeof v!=='object'||Array.isArray(v))throw new Error('Invalid wallet request.');
  const shape:Record<string,string[]>={prepare:['stage','action'],sign:['stage','actor','xdr'],execute:['stage','id','signedXdr'],receipt:['stage','id']};
  if(!Object.hasOwn(shape,v.stage)||Object.keys(v).some(k=>!shape[v.stage].includes(k)))throw new Error('Unsupported wallet request.');
  if(v.stage==='prepare')return NextResponse.json({prepared:await prepareManagedLocal(v.action)});
  if(v.stage==='sign'){
   if(!['a','b','manager','executor'].includes(v.actor)||typeof v.xdr!=='string'||v.xdr.length>20000)throw new Error('Invalid local signer.');
   return NextResponse.json({signedXdr:signManagedLocal(v.actor as ManagedActor,v.xdr)});
  }
  if(typeof v.id!=='string'||!/^[a-f0-9-]{36}$/.test(v.id))throw new Error('Invalid draft id.');
  if(v.stage==='receipt')return NextResponse.json({receipt:await managedLocalReceipt(v.id)??null});
  if(typeof v.signedXdr!=='string'||v.signedXdr.length>20000)throw new Error('Invalid signed transaction.');
  return NextResponse.json(await executeManagedLocal(v.id,v.signedXdr));
 }catch(e){const error=e instanceof Error?e.message:'Local wallet operation failed.';return NextResponse.json({error},{status:/unknown|unavailable|not running|fetch failed/i.test(error)?503:400});}
}
