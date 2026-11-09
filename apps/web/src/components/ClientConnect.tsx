'use client'

import type { StellarWalletsKit } from '@creit.tech/stellar-wallets-kit'
import { useEffect, useState } from 'react'
import {MANAGED_PRODUCT_LOCAL} from '@/lib/managedProduct'
import {GENERAL_MAINNET} from '@/lib/generalMainnet'
import ManagedLocalConnect from './product/ManagedLocalConnect'

export default function ClientConnect({ variant = 'chrome' }: { variant?: 'chrome' | 'rail' }) {
  return (GENERAL_MAINNET||MANAGED_PRODUCT_LOCAL) ? <ManagedLocalConnect variant={variant}/> : <LegacyClientConnect variant={variant}/>;
}
function LegacyClientConnect({ variant = 'chrome' }: { variant?: 'chrome' | 'rail' }) {
  const [kit, setKit] = useState<StellarWalletsKit | null>(null)
  const [pub, setPub] = useState('')
  const [err, setErr] = useState('')
  const [walletFns, setWalletFns] = useState<{
    getWalletsKit: (modules?: ('FREIGHTER'|'ALBEDO'|'XBULL')[]) => StellarWalletsKit
    connectWallet: (kit: StellarWalletsKit) => Promise<string>
    clearStoredWalletConnection: () => void
  } | null>(null)

  // Dynamically import wallet functions on client to avoid SSR window access
  useEffect(() => {
    (async () => {
      const mod = await import('../lib/walletKit')
      setWalletFns({
        getWalletsKit: mod.getWalletsKit,
        connectWallet: mod.connectWallet,
        clearStoredWalletConnection: mod.clearStoredWalletConnection,
      })
    })()
  }, [])

  useEffect(() => {
    if (!walletFns) return
    setKit(walletFns.getWalletsKit(['FREIGHTER','ALBEDO','XBULL']))
  }, [walletFns])
  // Rehydrate connection from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('wallet:pubkey')
    if (saved) setPub(saved)
    const onWalletChanged = (event: Event) => {
      const detail = (event as CustomEvent<string>).detail
      setPub(typeof detail === 'string' ? detail.trim() : localStorage.getItem('wallet:pubkey') ?? '')
    }
    const onStorage = (event: StorageEvent) => {
      if (event.key === 'wallet:pubkey') setPub(event.newValue ?? '')
    }
    window.addEventListener('wallet:pubkey-changed', onWalletChanged as EventListener)
    window.addEventListener('storage', onStorage)
    return () => {
      window.removeEventListener('wallet:pubkey-changed', onWalletChanged as EventListener)
      window.removeEventListener('storage', onStorage)
    }
  }, [])

  const onClick = async () => {
    try {
      setErr('')
      if (!kit || !walletFns) throw new Error('Wallets Kit not initialized')
      const key = await walletFns.connectWallet(kit)
      setPub(key)
      localStorage.setItem('wallet:pubkey', key)
      window.dispatchEvent(new CustomEvent('wallet:pubkey-changed', { detail: key }))
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Failed to connect')
    }
  }

  const onDisconnect = () => {
    walletFns?.clearStoredWalletConnection()
    setPub('')
    setErr('')
  }

  const short = (k: string) => (k ? `${k.slice(0,6)}…${k.slice(-4)}` : '')

  return (
    <div className={`chrome-connect-stack chrome-connect-stack-${variant}`}>
      {pub ? (
        <div className={`chrome-connect-connected chrome-connect-connected-${variant}`}>
          <span
            className={`chrome-connect-badge chrome-connect-badge-${variant}`}
            data-testid={`wallet-badge-${variant}`}
          >
            {short(pub)}
          </span>
          <button
            type="button"
            onClick={onDisconnect}
            className={`chrome-disconnect-button chrome-disconnect-button-${variant}`}
            data-testid={`disconnect-wallet-${variant}`}
          >
            Disconnect
          </button>
        </div>
      ) : (
        <button
          onClick={onClick}
          className={`chrome-connect-button chrome-connect-button-${variant}`}
          data-testid={`connect-wallet-${variant}`}
        >
          CONNECT WALLET
        </button>
      )}
      {err && <span className="chrome-connect-error">{err}</span>}
    </div>
  )
}
