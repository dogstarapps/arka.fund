import React from 'react';import{afterEach,beforeEach,expect,it,vi}from'vitest';import{act,cleanup,render,screen,waitFor}from'@testing-library/react';
const nav=vi.hoisted(()=>({id:'CCP7X4UYFSUNXWRUH7W25RQMEQEHXFIYHNHVGAYAGGOOHPMPJKZGOGPW'}));
vi.mock('next/navigation',()=>({useParams:()=>nav}));vi.mock('@/components/product/ManagedProductSurface',()=>({ManagedFundSurface:()=> <div>Managed fund view</div>}));
import Boundary from'@/components/product/V3VersionBoundary';
const A='CCP7X4UYFSUNXWRUH7W25RQMEQEHXFIYHNHVGAYAGGOOHPMPJKZGOGPW',B='CBH2GZKMH32S2XINRZJSW3PPD57VHPLDWL7BIOG7VCR6IIE2IDV34LGI';
beforeEach(()=>{nav.id=A;});afterEach(()=>{cleanup();vi.unstubAllGlobals();});
it('keeps the retained V2 identity on the legacy view',async()=>{vi.stubGlobal('fetch',vi.fn(async()=>Response.json({id:A,version:2})));render(<Boundary><div>Legacy fund view</div></Boundary>);expect(await screen.findByText('Legacy fund view')).toBeVisible();expect(screen.queryByText('Managed fund view')).toBeNull();});
it('selects the managed view only for a verified current V3 identity',async()=>{vi.stubGlobal('fetch',vi.fn(async()=>Response.json({id:A,version:3})));render(<Boundary><div>Legacy fund view</div></Boundary>);expect(await screen.findByText('Managed fund view')).toBeVisible();expect(screen.queryByText('Legacy fund view')).toBeNull();});
it.each([{id:B,version:2},{id:A,version:9}])('rejects a mismatched or unknown classification %j',async value=>{vi.stubGlobal('fetch',vi.fn(async()=>Response.json(value)));render(<Boundary><div>Legacy fund view</div></Boundary>);expect(await screen.findByRole('alert')).toHaveTextContent('could not be verified');expect(screen.queryByText('Legacy fund view')).toBeNull();});
it('an aborted old response cannot reveal legacy actions while the new fund is pending',async()=>{
 let late!:(value:unknown)=>void;const json=vi.fn(()=>new Promise(resolve=>{late=resolve;}));const fetch=vi.fn().mockResolvedValueOnce({ok:true,json}).mockReturnValueOnce(new Promise(()=>{}));vi.stubGlobal('fetch',fetch);
 const view=render(<Boundary><div>Legacy fund view</div></Boundary>);await waitFor(()=>expect(json).toHaveBeenCalledOnce());nav.id=B;view.rerender(<Boundary><div>Legacy fund view</div></Boundary>);await act(async()=>{late({id:A,version:2});});expect(screen.getByRole('status')).toHaveTextContent('Checking Arka');expect(screen.queryByText('Legacy fund view')).toBeNull();expect(fetch.mock.calls[0][1].signal.aborted).toBe(true);
});
