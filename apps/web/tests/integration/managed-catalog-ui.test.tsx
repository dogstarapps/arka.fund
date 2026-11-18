// @vitest-environment jsdom
import React from 'react';
import {beforeAll,afterAll,beforeEach,afterEach,it,expect,vi} from 'vitest';
import {render,screen,cleanup} from '@testing-library/react';
import {mkdtemp} from 'node:fs/promises';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {execFileSync} from 'node:child_process';
import {tmpdir} from 'node:os';
import {V3,INVESTOR} from '../../../../services/catalog-api/dist/tests/support/managedFixture.js';
const mocks=vi.hoisted(()=>({sign:vi.fn(),prepare:vi.fn(),submit:vi.fn(),quote:vi.fn()}));
vi.mock('next/navigation',()=>({useParams:()=>({id:V3})}));
vi.mock('@/lib/managedProductWallet',()=>({productWallet:{signTransaction:mocks.sign,getAddress:async()=>INVESTOR,getNetworkPassphrase:async()=>'Standalone Network ; February 2017'}}));
vi.mock('@/lib/managedSorobanTransport',()=>({createManagedSorobanTransport:()=>({prepare:mocks.prepare,submit:mocks.submit,receipt:vi.fn()}),localPortfolioQuote:mocks.quote,localDepositQuote:mocks.quote}));
let Surface:React.ComponentType;
let wire:Record<string,unknown>;
beforeAll(async()=>{vi.stubEnv('NEXT_PUBLIC_MANAGED_CATALOG_READ_ONLY','1');({ManagedFundSurface:Surface}=await import('@/components/product/ManagedProductSurface'));});
afterAll(()=>vi.unstubAllEnvs());
beforeEach(async()=>{
 // Use the real Node loader for the API; jsdom rewrites import.meta URLs to HTTP.
 const fixture=pathToFileURL(join(process.cwd(),'../../release/fixtures/managed-catalog.mjs')).href;
 const directory=await mkdtemp(join(tmpdir(),'arka-integrated-ui-'));
 const code='const {createIntegrationFixture,f}=await import('+JSON.stringify(fixture)+');const m=await createIntegrationFixture('+JSON.stringify(directory)+');try{console.log(JSON.stringify(await m.product(f.INVESTOR)));}finally{await m.app.close();}';
 wire=JSON.parse(execFileSync(process.execPath,['--import',join(process.cwd(),'../../services/catalog-api/scripts/no-network.mjs'),'--input-type=module','-e',code],{encoding:'utf8',env:{PATH:'/usr/bin:/bin',NODE_ENV:'test'}}));
 localStorage.clear();localStorage.setItem('wallet:pubkey',INVESTOR);window.history.replaceState(null,'','/arkas/'+V3+'?address='+INVESTOR);
 vi.stubGlobal('fetch',vi.fn(async(input:RequestInfo|URL)=>new Response(JSON.stringify(String(input).includes('/status?')?{mode:'catalog-read-only',lastTick:null,alerts:[]}:wire),{status:200})));
 vi.clearAllMocks();
});
afterEach(()=>{cleanup();vi.unstubAllGlobals();});
it('renders the actual mixed-catalog response in the normal investment surface',async()=>{
 render(<Surface/>);
 expect(await screen.findByRole('heading',{name:'Managed V3 Arka · local fixture'})).toBeInTheDocument();
 expect(screen.getByRole('heading',{name:'Managed V3 Arka · local fixture'})).toBeInTheDocument();

 expect(screen.getByRole('button',{name:'Collect 20 test units'})).toBeDisabled();
 expect(screen.getByRole('button',{name:'Review withdrawal'})).toBeDisabled();
 expect(screen.getByLabelText('Amount to deposit (test units)')).toBeDisabled();
 expect(mocks.prepare).not.toHaveBeenCalled();expect(mocks.sign).not.toHaveBeenCalled();
 expect(mocks.sign).not.toHaveBeenCalled();expect(mocks.prepare).not.toHaveBeenCalled();expect(mocks.submit).not.toHaveBeenCalled();expect(mocks.quote).not.toHaveBeenCalled();
});
it('surfaces stale or malformed catalog data instead of inventing zero holdings',async()=>{
 (wire.catalogPosition as {stale:boolean}).stale=true;render(<Surface/>);
 expect(await screen.findByRole('alert')).toHaveTextContent('No holdings have been treated as zero');
 expect(screen.queryByRole('heading',{name:'Catalog and portfolio reconciled'})).not.toBeInTheDocument();
 expect(mocks.prepare).not.toHaveBeenCalled();expect(mocks.sign).not.toHaveBeenCalled();
});

