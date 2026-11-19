import {GET as general} from '../../mainnet-connector/[kind]/route';
export const runtime='nodejs';export const dynamic='force-dynamic';
export async function GET(request:Request,context:{params:Promise<{kind:string}>}){return general(request,context);}
