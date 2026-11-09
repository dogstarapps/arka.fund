import React from 'react';
import {act,cleanup,fireEvent,render,screen} from '@testing-library/react';
import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';
import {account} from '../fixtures/managedState';
const mocks=vi.hoisted(()=>({connect:vi.fn()}));
vi.mock('@/lib/managedProductWallet',()=>({connectProductWallet:mocks.connect}));
import ManagedLocalConnect from '@/components/product/ManagedLocalConnect';
const owner=account(1);
beforeEach(()=>{vi.clearAllMocks();localStorage.clear();});
afterEach(cleanup);
describe('Local wallet connection recovery across tabs',()=>{
 it('clears an old error when another tab connects',async()=>{
  mocks.connect.mockRejectedValue(Error('Old connection timed out'));
  render(<ManagedLocalConnect/>);
  fireEvent.click(screen.getByRole('button',{name:'CONNECT WALLET'}));
  await screen.findByText('Old connection timed out');
  act(()=>{localStorage.setItem('wallet:pubkey',owner);window.dispatchEvent(new StorageEvent('storage',{key:'wallet:pubkey',newValue:owner}));});
  expect(screen.getByRole('button',{name:'Disconnect'})).toBeInTheDocument();
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
 });
 it('does not resurrect an old timeout after another tab connects',async()=>{
  let reject!:(reason:Error)=>void;mocks.connect.mockImplementation(()=>new Promise((_resolve,r)=>{reject=r;}));
  render(<ManagedLocalConnect/>);fireEvent.click(screen.getByRole('button',{name:'CONNECT WALLET'}));
  act(()=>{localStorage.setItem('wallet:pubkey',owner);window.dispatchEvent(new StorageEvent('storage',{key:'wallet:pubkey',newValue:owner}));});
  await act(async()=>{reject(Error('Late old timeout'));});
  expect(screen.getByRole('button',{name:'Disconnect'})).toBeInTheDocument();
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
 });
 it('does not reconnect after a disconnect supersedes an unfinished attempt',async()=>{
  let resolve!:(address:string)=>void;mocks.connect.mockImplementation(()=>new Promise(r=>{resolve=r;}));
  render(<ManagedLocalConnect/>);fireEvent.click(screen.getByRole('button',{name:'CONNECT WALLET'}));
  act(()=>window.dispatchEvent(new CustomEvent('wallet:pubkey-changed',{detail:''})));
  await act(async()=>{resolve(owner);});
  expect(localStorage.getItem('wallet:pubkey')).toBeNull();
  expect(screen.getByRole('button',{name:'CONNECT WALLET'})).toBeEnabled();
 });
 it('does not clear a real error for an unrelated storage event',async()=>{
  mocks.connect.mockRejectedValue(Error('Current wallet failure'));
  render(<ManagedLocalConnect/>);fireEvent.click(screen.getByRole('button',{name:'CONNECT WALLET'}));
  await screen.findByText('Current wallet failure');
  act(()=>window.dispatchEvent(new StorageEvent('storage',{key:'unrelated',newValue:'1'})));
  expect(screen.getByRole('alert')).toHaveTextContent('Current wallet failure');
 });
 it('updates display state and clears stale errors on the same-tab wallet event',async()=>{
  mocks.connect.mockRejectedValue(Error('Old error'));render(<ManagedLocalConnect/>);
  fireEvent.click(screen.getByRole('button',{name:'CONNECT WALLET'}));await screen.findByText('Old error');
  act(()=>{localStorage.setItem('wallet:pubkey',owner);window.dispatchEvent(new CustomEvent('wallet:pubkey-changed',{detail:owner}));});
  expect(screen.getByRole('button',{name:'Disconnect'})).toBeInTheDocument();expect(screen.queryByRole('alert')).not.toBeInTheDocument();
 });
});
