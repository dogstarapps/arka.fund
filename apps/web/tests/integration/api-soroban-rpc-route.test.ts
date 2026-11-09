import {afterEach,expect,it,vi}from 'vitest';
import {POST}from '@/app/api/soroban/rpc/route';
afterEach(()=>vi.unstubAllGlobals());
it.each(['getLatestLedger','sendTransaction'])('the release keeps direct RPC %s disabled without I/O',async method=>{const fetch=vi.fn();vi.stubGlobal('fetch',fetch);const response=await POST(new Request('http://localhost/api/soroban/rpc',{method:'POST',body:JSON.stringify({jsonrpc:'2.0',id:1,method})}) as never);expect(response.status).toBe(403);expect(fetch).not.toHaveBeenCalled();expect((await response.json()).error).toContain('disabled');});
