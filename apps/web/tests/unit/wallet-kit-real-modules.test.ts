import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
const providers=vi.hoisted(()=>{vi.stubEnv('NEXT_PUBLIC_UX_REVIEW_PREVIEW','1');return ({
 freighter:{isConnected:vi.fn(async()=>({isConnected:true})),requestAccess:vi.fn(async()=>({address:'GFREIGHTER'})),getAddress:vi.fn(async()=>({address:'GFREIGHTER'})),getNetwork:vi.fn(async()=>({network:'PUBLIC',networkPassphrase:'Public Global Stellar Network ; September 2015'})),signTransaction:vi.fn(),signMessage:vi.fn(),signAuthEntry:vi.fn()},
 albedo:vi.fn(async()=>({pubkey:'GALBEDO'})),xbull:vi.fn(async()=> 'GXBULL'),close:vi.fn(),
});});
vi.mock('@stellar/freighter-api',()=>providers.freighter);
vi.mock('@albedo-link/intent',()=>({default:{publicKey:providers.albedo,tx:vi.fn()}}));
vi.mock('@creit.tech/xbull-wallet-connect',()=>({xBullWalletConnect:class{connect=providers.xbull;closeConnections=providers.close;}}));
// The kit, original modal, store and three modules are real. Only external wallet
// boundaries are stubbed: these tests never request or produce a real signature.
import {StellarWalletsKit,FreighterModule,AlbedoModule,xBullModule,WalletNetwork} from '@creit.tech/stellar-wallets-kit';
import {connectWallet,getWalletsKit,clearStoredWalletConnection} from '@/lib/walletKit';
function kit(){return new StellarWalletsKit({network:WalletNetwork.PUBLIC,modules:[new FreighterModule(),new AlbedoModule(),new xBullModule()]});}
describe('reviewed wallet subset with real module implementations',()=>{
 beforeEach(()=>{vi.clearAllMocks();window.localStorage.clear();document.body.innerHTML='';});
 afterEach(()=>{document.body.innerHTML='';vi.unstubAllEnvs();});
 it('retains exactly the three wallets offered by the application',async()=>{
  const k=kit();const wallets=await k.getSupportedWallets();expect(wallets.map(w=>w.id)).toEqual(['freighter','albedo','xbull']);expect(wallets.every(w=>w.isAvailable)).toBe(true);
  expect(()=>k.setWallet('hotwallet')).toThrow('not supported');expect(()=>k.setWallet('trezor')).toThrow('not supported');
 });
 it.each([['freighter','GFREIGHTER'],['albedo','GALBEDO'],['xbull','GXBULL']])('connects %s through its actual module',async(id,address)=>{
  const k=kit();k.setWallet(id);await expect(k.getAddress()).resolves.toEqual({address});expect(providers.freighter.signTransaction).not.toHaveBeenCalled();expect(providers.freighter.signMessage).not.toHaveBeenCalled();if(id==='xbull')expect(providers.close).toHaveBeenCalledOnce();
 });
 it('propagates provider rejection instead of inventing an address',async()=>{
  providers.freighter.getAddress.mockResolvedValueOnce({address:'',error:{code:-4,message:'Access rejected'}} as never);const k=kit();k.setWallet('freighter');await expect(k.getAddress()).rejects.toMatchObject({message:'Access rejected'});
 });
 it('keeps the configured public network and removes the stored connection',async()=>{
  const k=kit();k.setWallet('freighter');await expect(k.getNetwork()).resolves.toMatchObject({networkPassphrase:WalletNetwork.PUBLIC});await k.getAddress();await k.disconnect();clearStoredWalletConnection();expect(window.localStorage.getItem('wallet:pubkey')).toBeNull();expect(window.localStorage.getItem('wallet:module')).toBeNull();
 });
 it('uses the original rendered wallet selector and remembers the selected module',async()=>{
  const k=kit(),connected=connectWallet(k);await vi.waitFor(()=>expect(document.querySelector('stellar-wallets-modal')).not.toBeNull());
  const modal=document.querySelector('stellar-wallets-modal') as HTMLElement & {updateComplete:Promise<unknown>};await modal.updateComplete;
  const rows=modal.shadowRoot?.querySelectorAll('.wallets-body__item');expect(rows?.length).toBe(3);(Array.from(rows??[]).find(row=>row.textContent?.includes('Albedo')) as HTMLElement).click();
  await expect(connected).resolves.toBe('GALBEDO');expect(window.localStorage.getItem('wallet:module')).toBe('albedo');expect(document.querySelector('stellar-wallets-modal')).toBeNull();
 });
 it('rejects closing the actual selector and clears its timers',async()=>{
  const k=kit(),connected=connectWallet(k),rejection=expect(connected).rejects.toThrow('Wallet selection was closed');await vi.waitFor(()=>expect(document.querySelector('stellar-wallets-modal')).not.toBeNull());
  const modal=document.querySelector('stellar-wallets-modal') as HTMLElement & {updateComplete:Promise<unknown>};await modal.updateComplete;(modal.shadowRoot?.querySelector('.wallets-header__button') as HTMLElement).click();await rejection;expect(document.querySelector('stellar-wallets-modal')).toBeNull();
 });
 it('retains the financial preview guard before contacting a signer',async()=>{
  const k=getWalletsKit(['FREIGHTER']);k.setWallet('freighter');await expect(k.signTransaction('unsigned-review-only')).rejects.toThrow();expect(providers.freighter.signTransaction).not.toHaveBeenCalled();
 });
});
