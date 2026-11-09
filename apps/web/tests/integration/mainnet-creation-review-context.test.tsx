import React from 'react';
import {act,cleanup,fireEvent,render,screen,waitFor} from '@testing-library/react';
import {afterEach,it,expect,vi} from 'vitest';
import {account} from '../fixtures/managedState';
vi.mock('@/components/product/ManagedContextHelp',()=>({ManagedContextHelp:({children}:{children:React.ReactNode})=><div data-testid="context-help">{children}</div>}));
vi.mock('@/components/product/MainnetCreationExecution',()=>({MainnetCreationExecution:({review}:{review:unknown})=><div data-testid="execution-review">{review?'ready':'empty'}</div>}));
import Review from '@/components/product/V3DefaultCreationReview';
afterEach(()=>{cleanup();vi.unstubAllGlobals();vi.unstubAllEnvs();});
it.each(['manager','draft'])('discards a late creation review after the %s changes',async kind=>{
 const owner=account(1),releaseId='a'.repeat(64),draft={creatorPubKey:owner,name:'Original'};
 let resolve!:(value:Response)=>void;
 const fetch=vi.fn().mockResolvedValueOnce(Response.json({profile:{releaseId},defaultDraft:{creatorPubKey:''}})).mockImplementationOnce(()=>new Promise<Response>(r=>{resolve=r;}));vi.stubGlobal('fetch',fetch);
 const view=render(<Review draft={draft}/>);await waitFor(()=>expect(screen.getByRole('button',{name:'Check draft'})).not.toBeDisabled());fireEvent.click(screen.getByRole('button',{name:'Check draft'}));await waitFor(()=>expect(fetch).toHaveBeenCalledTimes(2));
 if(kind==='manager')fireEvent.change(screen.getByLabelText('Public account'),{target:{value:account(2)}});else view.rerender(<Review draft={{...draft,name:'Changed'}}/>);
 await act(async()=>{resolve(Response.json({releaseId,readyForSignature:false,canSubmit:false}));});
 expect(screen.queryByText('Draft checked. Nothing was created.')).not.toBeInTheDocument();expect(screen.getByTestId('execution-review')).toHaveTextContent('empty');
});

it('keeps the active creation action outside contextual help and invalidates its checked draft on edits',async()=>{vi.stubEnv('NEXT_PUBLIC_MAINNET_EXECUTION_ENABLED','1');const releaseId='a'.repeat(64),draft={creatorPubKey:account(1),name:'Original'};vi.stubGlobal('fetch',vi.fn().mockResolvedValueOnce(Response.json({profile:{releaseId,v3Wasm:'b'.repeat(64),network:'Public Global Stellar Network ; September 2015',mainnetApproved:true,executionEnabled:true},defaultDraft:{creatorPubKey:''}})).mockResolvedValueOnce(Response.json({releaseId,readyForSignature:false,canSubmit:false})));const view=render(<Review draft={draft}/>);await waitFor(()=>expect(screen.getByRole('button',{name:'Check draft'})).not.toBeDisabled());expect(screen.queryByTestId('context-help')).not.toBeInTheDocument();fireEvent.click(screen.getByRole('button',{name:'Check draft'}));await waitFor(()=>expect(screen.getByTestId('execution-review')).toHaveTextContent('ready'));view.rerender(<Review draft={{...draft,name:'Changed'}}/>);expect(screen.getByTestId('execution-review')).toHaveTextContent('empty');});
