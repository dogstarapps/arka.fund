import { NextRequest, NextResponse } from 'next/server';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const MAX_BODY = 4096;
function allowed(req: NextRequest) {
  if (process.env.ARKA_MANAGED_PREVIEW !== '1' || process.env.NEXT_PUBLIC_UX_REVIEW_PREVIEW !== '1') return false;
  const host = req.headers.get('host') ?? '';
  if (!/^127\.0\.0\.1:\d+$/.test(host) || !process.env.ARKA_LOCAL_PREVIEW_TOKEN) return false;
  if (req.method === 'POST' && (req.headers.get('origin') !== `http://${host}` || req.headers.get('x-arka-local-preview') !== '1')) return false;
  return true;
}
function validAction(v: unknown): boolean {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return false;
  const x = v as Record<string, unknown>;
  const keys: Record<string, string[]> = { select:['action','index'],reset:['action'], settle:['action'], advance:['action','seconds'], request:['action','actor','sharesRaw'], cancel:['action','actor','id'], claim:['action','actor','id'], prepare:['action','actor','amountRaw'] };
  if (typeof x.action !== 'string' || !Object.hasOwn(keys, x.action)) return false;
  if (Object.keys(x).some(k => !keys[x.action as string].includes(k))) return false;
  const raw = (n: unknown) => typeof n === 'string' && /^[1-9]\d{0,37}$/.test(n) && BigInt(n) <= (BigInt(1) << BigInt(127)) - BigInt(1);
  switch (x.action) {
    case 'select': return process.env.ARKA_MANAGED_INTEGRATION==='1'&&Number.isSafeInteger(x.index)&&Number(x.index)>=0;
    case 'reset': case 'settle': return true;
    case 'advance': return Number.isSafeInteger(x.seconds) && Number(x.seconds) > 0 && Number(x.seconds) <= 604800;
    case 'request': return ['a','b'].includes(String(x.actor)) && raw(x.sharesRaw);
    case 'cancel': case 'claim': return ['a','b'].includes(String(x.actor)) && Number.isSafeInteger(x.id) && Number(x.id) > 0;
    case 'prepare': return ['manager','executor'].includes(String(x.actor)) && raw(x.amountRaw);
    default: return false;
  }
}
async function proxy(req: NextRequest, body?: string) {
  if (!allowed(req)) return NextResponse.json({error:'Local preview is unavailable.'},{status:404});
  try {
    const r = await fetch(`http://127.0.0.1:3468/${body ? 'action' : 'state'}`, {
      method: body ? 'POST' : 'GET', body, cache:'no-store', signal:AbortSignal.timeout(5000),
      headers:{'content-type':'application/json','x-arka-local-token':process.env.ARKA_LOCAL_PREVIEW_TOKEN!},
    });
    const data = await r.json();
    return NextResponse.json(data,{status:r.status,headers:{'cache-control':'no-store'}});
  } catch { return NextResponse.json({error:'The local contract simulator is not running. No action was sent to a blockchain.'},{status:503}); }
}
export async function GET(req: NextRequest) {
  if(!allowed(req))return NextResponse.json({error:'Local preview is unavailable.'},{status:404});
  if(process.env.ARKA_MANAGED_INTEGRATION==='1'){
    try{const {managedLocalState}=await import('@/lib/server/managedLocalBridge');return NextResponse.json({state:await managedLocalState()},{headers:{'cache-control':'no-store'}});}
    catch{return NextResponse.json({error:'The local factory/WASM host is not running. No blockchain action was sent.'},{status:503});}
  }
  return proxy(req);
}
export async function POST(req: NextRequest) {
  if (!allowed(req)) return NextResponse.json({error:'Local preview is unavailable.'},{status:404});
  if (Number(req.headers.get('content-length')) > MAX_BODY) return NextResponse.json({error:'Request too large.'},{status:413});
  const body = await req.text();
  if (body.length > MAX_BODY) return NextResponse.json({error:'Request too large.'},{status:413});
  try {
    const parsed=JSON.parse(body);
    if (!validAction(parsed)) return NextResponse.json({error:'Invalid simulation action.'},{status:400});
    if(process.env.ARKA_MANAGED_INTEGRATION==='1'&&!['reset','advance','select'].includes(parsed.action))return NextResponse.json({error:'Use the wallet review/sign/execute flow.'},{status:409});
  } catch { return NextResponse.json({error:'Invalid JSON.'},{status:400}); }
  return proxy(req,body);
}
