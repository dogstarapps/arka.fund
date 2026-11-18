import {mainnetReadBackendOrigin,trustedMainnetReadRequest} from '@/lib/server/mainnetReadBackend';
import type { NextRequest } from "next/server";
import { proxyCatalogRequest } from "@/lib/catalog/proxy";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ path: string[] }> },
): Promise<Response> {
  const { path } = await context.params;
  if(process.env.NEXT_PUBLIC_MAINNET_GENERAL_READONLY!=='1')return proxyCatalogRequest(request,path);
  if(process.env.NEXT_PUBLIC_MANAGED_CATALOG_READ_ONLY!=='1'||!trustedMainnetReadRequest(request))return Response.json({error:'Verified catalog unavailable.'},{status:503});
  let backendOrigin:string;try{backendOrigin=mainnetReadBackendOrigin(process.env.ARKA_MAINNET_GENERAL_URL);}catch{return Response.json({error:'Verified catalog unavailable.'},{status:503});}
  let listing:{ids:string[]};try{const registry=await fetch(backendOrigin+'/discover',{cache:'no-store',redirect:'error'});if(!registry.ok)throw Error('CATALOG_DISCOVERY');listing=await registry.json();if(!Array.isArray(listing.ids)||!listing.ids.every(id=>typeof id==='string'))throw Error('CATALOG_DISCOVERY');}catch{return Response.json({error:'The on-chain catalog could not be verified. No holdings were assumed.'},{status:503});}const ids=new Set<string>(listing.ids);
  const response=await proxyCatalogRequest(request,path);if(!response.ok)return response;const body=await response.json();
  function filter(value:unknown):unknown{if(Array.isArray(value))return value.map(filter).filter(x=>x!==null);if(value&&typeof value==='object'){const row=value as Record<string,unknown>;if(typeof row.arkaId==='string'&&!ids.has(row.arkaId))return null;return Object.fromEntries(Object.entries(row).map(([k,v])=>[k,filter(v)]));}return value;}
  const value=filter(body) as Record<string,unknown>;if(value&&Array.isArray(value.items)&&Array.isArray(body.items)&&typeof body.total==='number'){const removed=body.items.length-value.items.length;value.total=Math.max(value.items.length,body.total-removed);if(body.total<=body.items.length&&path.join('/')==='v1/arkas'&&listing.ids.some((id:string)=>!(value.items as {arkaId:string}[]).some(x=>x.arkaId===id)))return Response.json({error:'Catalog metadata is still catching up with the on-chain registry.'},{status:503});}
  return Response.json(value,{headers:{'cache-control':'no-store'}});
}

export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ path: string[] }> },
): Promise<Response> {
  const { path } = await context.params;
  return proxyCatalogRequest(request, path);
}
