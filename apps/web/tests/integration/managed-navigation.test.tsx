import React from 'react';
import {cleanup,render,screen,within} from '@testing-library/react';
import {beforeEach,afterEach,it,expect,vi} from 'vitest';
const navigation=vi.hoisted(()=>({pathname:'/investments',push:vi.fn()}));
vi.mock('next/navigation',()=>({usePathname:()=>navigation.pathname,useRouter:()=>({push:navigation.push})}));
vi.mock('@/components/ClientConnect',()=>({default:()=> <button>Connect wallet</button>}));
vi.mock('@/lib/previewSafety',()=>({UX_REVIEW_PREVIEW:true}));
import AppChrome from '@/components/product/AppChrome';
beforeEach(()=>{localStorage.clear();vi.stubEnv('NEXT_PUBLIC_MANAGED_PRODUCT_LOCAL','1');vi.stubGlobal('matchMedia',()=>({matches:true,addEventListener:vi.fn(),removeEventListener:vi.fn()}));navigation.pathname='/investments';});
afterEach(()=>{cleanup();vi.unstubAllEnvs();vi.unstubAllGlobals();});
it.each(['/investments','/manage'])('keeps the same full public navigation at %s without wallet authorization',path=>{
 navigation.pathname=path;render(<AppChrome><p>Portfolio</p></AppChrome>);
 const nav=within(screen.getByRole('navigation',{name:'Primary navigation'}));
 for(const name of ['Explore funds','My investments','Manage funds','Arkas','Governance','Assets','Managers','Integrations','Dashboard'])expect(nav.getByRole('link',{name})).toBeVisible();
 expect(nav.getByRole('link',{name:'Explore funds'})).toHaveAttribute('href','/discover');
 expect(screen.queryByTestId('advanced-console')).not.toBeInTheDocument();
 expect(screen.queryByTestId('operator-route-gate')).not.toBeInTheDocument();
});
it('distinguishes browsing public data from transacting in the local sandbox',()=>{
 navigation.pathname='/discover';render(<AppChrome><p>Public catalog</p></AppChrome>);
 expect(screen.getByTestId('ux-preview-banner')).toHaveTextContent('Public data preview · Read-only browsing · Live funds disabled');
});
it('keeps exploration visible on mobile without expanding the secondary menu over the portfolio',()=>{
 vi.stubGlobal('matchMedia',()=>({matches:false,addEventListener:vi.fn(),removeEventListener:vi.fn()}));render(<AppChrome><p>Mobile portfolio</p></AppChrome>);
 expect(screen.getByText('More from Arka').closest('details')).not.toHaveAttribute('open');
 expect(screen.getByRole('link',{name:'Explore funds'})).toBeVisible();
});
it('keeps the Standalone warning on managed withdrawal routes',()=>{
 render(<AppChrome><p>Local portfolio</p></AppChrome>);
 expect(screen.getByTestId('ux-preview-banner')).toHaveTextContent('Local sandbox · Fictitious assets · Standalone only · Live funds disabled');
});
it('does not change the normal-build navigation default',()=>{
 vi.stubEnv('NEXT_PUBLIC_MANAGED_PRODUCT_LOCAL','0');render(<AppChrome><p>Normal portfolio</p></AppChrome>);
 expect(screen.getByText('Platform & research').closest('details')).not.toHaveAttribute('open');
});
