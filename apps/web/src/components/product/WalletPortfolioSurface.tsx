"use client";
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { readStoredWalletPubkey } from '@/lib/operatorAccessClient';
import { loadManagedArkasPage } from '@/lib/catalog/api';
import { isPublicWalletAddress, loadWalletPositions, type WalletPositionsResult } from '@/lib/catalog/walletPositions';
import { resolveArkaDisplayName } from '@/lib/catalog/identity';
import { formatContractLabel, formatAssetAmount } from '@/lib/catalog/format';
import { UX_REVIEW_PREVIEW } from '@/lib/previewSafety';
import { estimateMaximumRedemption } from '@/lib/workflows/redemptionQuote';
import type { RankedArkaCatalogEntry } from '@/lib/catalog/types';
import {MANAGED_PRODUCT_LOCAL} from '@/lib/managedProduct';
import {GENERAL_MAINNET} from '@/lib/generalMainnet';
import ManagedPortfolioSurface from './ManagedProductSurface';

export default function WalletPortfolioSurface({ mode }: { mode: 'investor' | 'manager' }) {
  return (GENERAL_MAINNET||MANAGED_PRODUCT_LOCAL) ? <ManagedPortfolioSurface mode={mode}/> : <LegacyWalletPortfolioSurface mode={mode}/>;
}
function LegacyWalletPortfolioSurface({ mode }: { mode: 'investor' | 'manager' }) {
  const [wallet, setWallet] = useState('');
  const [address, setAddress] = useState('');
  const [lookup, setLookup] = useState('');
  const [positions, setPositions] = useState<WalletPositionsResult | null>(null);
  const [managed, setManaged] = useState<RankedArkaCatalogEntry[] | null>(null);
  const [status, setStatus] = useState<'idle'|'loading'|'ready'|'error'>('idle');
  const [error, setError] = useState('');
  const [refresh, setRefresh] = useState(0);
  const viewedAddress = address || wallet;
  useEffect(() => {
    const sync = () => setWallet(readStoredWalletPubkey());
    sync();
    const query = new URLSearchParams(window.location.search).get('address') || '';
    if (isPublicWalletAddress(query)) { setAddress(query); setLookup(query); }
    window.addEventListener('wallet:pubkey-changed', sync);
    window.addEventListener('storage', sync);
    return () => { window.removeEventListener('wallet:pubkey-changed', sync); window.removeEventListener('storage', sync); };
  }, []);
  useEffect(() => {
    setPositions(null); setManaged(null); setError('');
    if (!viewedAddress) { setStatus('idle'); return; }
    const controller = new AbortController();
    setStatus('loading');
    const task = mode === 'investor'
      ? loadWalletPositions(viewedAddress, controller.signal).then(setPositions)
      : loadManagedArkasPage(viewedAddress, controller.signal).then(page => { if (!controller.signal.aborted) setManaged(page.items); });
    void task.then(() => { if (!controller.signal.aborted) setStatus('ready'); }).catch(() => {
      if (!controller.signal.aborted) { setStatus('error'); setError('We could not check these funds. Your investments have not been treated as zero. Please retry.'); }
    });
    return () => controller.abort();
  }, [viewedAddress, mode, refresh]);
  const funds = mode === 'investor' ? positions?.positions.map(p => p.fund) ?? [] : managed ?? [];
  return <main className="surface-stack ux-portfolio" data-testid="wallet-portfolio">
    <header className="surface-panel ux-portfolio-heading">
      <span className="surface-eyebrow">{mode === 'investor' ? 'Investor' : 'Fund manager'}</span>
      <h1>{mode === 'investor' ? 'My investments' : 'Funds I manage'}</h1>
      <p>{mode === 'investor' ? 'Your holdings in funds, whether or not you manage them.' : 'Manage fund portfolios, change fund assets and review liquidity. This does not swap your personal wallet tokens.'}</p>
      <div className="surface-entry-actions"><Link className="surface-button surface-button-secondary" href={mode === 'investor' ? '/manage' : '/investments'}>{mode === 'investor' ? 'Funds I manage' : 'My investments'}</Link><Link className="surface-button surface-button-secondary" href="/discover">Explore funds</Link>{mode === 'manager' ? <Link className="surface-button surface-button-primary" href="/factory/create">Create Arka</Link> : null}</div>
    </header>
    {!viewedAddress ? <section className="surface-panel"><h2>Connect a wallet to see your {mode === 'investor' ? 'investments' : 'managed funds'}</h2><p>Use Connect wallet above. A disconnected wallet is not an empty portfolio.</p></section> : <p className="ux-address-context">{address ? 'Public address lookup · read-only · not a wallet connection' : 'Connected wallet'}<br/><span className="ux-wallet-address">{viewedAddress}</span>{address ? <button className="surface-button surface-button-secondary" onClick={() => { setAddress(''); window.history.replaceState(null,'',window.location.pathname); }}>Use connected wallet</button> : null}</p>}
    <details className="surface-panel ux-public-lookup" open={UX_REVIEW_PREVIEW && !viewedAddress}>
      <summary>Look up a public wallet without connecting</summary>
      <form onSubmit={event => { event.preventDefault(); if (!isPublicWalletAddress(lookup.trim())) { setError('Enter a valid Stellar public address beginning with G. Never enter a secret key.'); return; } setAddress(lookup.trim()); window.history.replaceState(null,'',`${window.location.pathname}?address=${encodeURIComponent(lookup.trim())}`); }}>
        <label htmlFor="portfolio-public-address">Stellar public address</label><input id="portfolio-public-address" className="ops-input" value={lookup} onChange={event=>setLookup(event.target.value)} placeholder="G… public address, never a secret key" autoComplete="off" />
        <button className="surface-button surface-button-secondary" type="submit">View holdings</button>
      </form>
    </details>
    {error ? <div className="ops-alert ops-alert-warning" role="alert">{error}<button onClick={()=>setRefresh(v=>v+1)} className="surface-button surface-button-secondary">Retry</button></div> : null}
    {status === 'loading' ? <p role="status">Checking {mode === 'investor' ? 'on-chain holdings across listed funds' : 'fund manager records'}…</p> : null}
    {positions && (positions.failed > 0 || positions.truncated) ? <div role="status" className="ops-alert ops-alert-warning">Incomplete results: {positions.failed} fund checks failed{positions.truncated ? '; catalog coverage is partial' : ''}. Missing funds may still hold your investment. <button className="surface-button surface-button-secondary" onClick={()=>setRefresh(v=>v+1)}>Retry checks</button></div> : null}
    {status === 'ready' && funds.length === 0 ? <section className="surface-panel"><h2>{positions && (positions.failed || positions.truncated) ? 'No holdings found in the funds checked' : mode === 'investor' ? 'No holdings found in listed funds' : 'No managed funds found'}</h2><p>{mode === 'investor' ? 'This checks canonical shares in the current catalog. A fund outside the catalog may not appear here.' : 'Managing a fund and investing in it are different roles. Check My investments for holdings.'}</p></section> : null}
    <div className="ux-fund-list">{funds.map(fund => {
      const position = positions?.positions.find(p=>p.fund.arkaId===fund.arkaId);
      const value = position && position.totalSharesBase && fund.nav !== null ? estimateMaximumRedemption({ navBase: Number(fund.nav), totalSharesBase: position.totalSharesBase, userSharesBase: position.sharesBase, redeemFeeBps: 0 }) : null;
      const symbol = fund.economics?.denominationAsset?.symbol || 'fund units';
      const actionHref = `/arkas/${fund.arkaId}?workspace=${mode==='investor'?'flow':'rebalance'}${address ? `&address=${encodeURIComponent(address)}` : ''}`;
      return <article className="surface-panel ux-position-card" key={fund.arkaId} data-testid="wallet-position-card"><div><h2>{resolveArkaDisplayName(fund)}</h2><p>Manager {formatContractLabel(fund.manager,8,5)}</p>{position ? <><strong>{value !== null ? `${formatAssetAmount(String(value))} ${symbol}` : 'Position value unavailable'}</strong><p>{formatAssetAmount(String(position.sharesBase))} shares · estimated value, not cash available to withdraw</p></> : <p>Changes affect this fund’s portfolio and its investors.</p>}</div><div className="surface-entry-actions"><Link className="surface-button surface-button-primary" href={actionHref}>{mode === 'investor' ? 'Deposit or withdraw' : 'Manage fund assets'}</Link><Link className="surface-button surface-button-secondary" href={`/vaults/${fund.arkaId}`}>Fund details</Link></div></article>;
    })}</div>
    {positions ? <p className="surface-note">Checked {positions.scanned} listed funds using on-chain shares. Values can change and withdrawals depend on fund cash and a fresh simulation.</p> : null}
  </main>;
}
