import { AlbedoModule, FreighterModule, StellarWalletsKit, WalletNetwork, xBullModule } from '@creit.tech/stellar-wallets-kit'
import { NETWORK_PASSPHRASE } from './config'
import { assertFinancialActionsEnabled } from './previewSafety'
import { requireSignedTransactionXdr } from './workflows/walletProviderRejectionMatrix'

export type SupportedModule = 'FREIGHTER' | 'ALBEDO' | 'XBULL'

export const E2E_WALLET_ENABLED = process.env.NEXT_PUBLIC_E2E_WALLET === '1'
const WALLET_SELECTION_CLOSED_MESSAGE = 'Wallet selection was closed'
export const WALLET_PUBKEY_STORAGE_KEY = 'wallet:pubkey'
export const WALLET_MODULE_STORAGE_KEY = 'wallet:module'

type SignOptions = {
  networkPassphrase?: string
  submit?: boolean
}

type SignMessageOptions = {
  networkPassphrase?: string
  address?: string
}

function resolveWalletNetwork(passphrase = NETWORK_PASSPHRASE): WalletNetwork {
  switch (passphrase) {
    case WalletNetwork.PUBLIC:
      return WalletNetwork.PUBLIC
    case WalletNetwork.FUTURENET:
      return WalletNetwork.FUTURENET
    case WalletNetwork.SANDBOX:
      return WalletNetwork.SANDBOX
    case WalletNetwork.STANDALONE:
      return WalletNetwork.STANDALONE
    case WalletNetwork.TESTNET:
    default:
      return WalletNetwork.TESTNET
  }
}

function readStorageValue(key: string): string {
  if (typeof window === 'undefined') return ''
  try {
    return window.localStorage.getItem(key)?.trim() ?? ''
  } catch {
    return ''
  }
}

function writeStorageValue(key: string, value: string): void {
  if (typeof window === 'undefined') return
  try {
    if (value) window.localStorage.setItem(key, value)
    else window.localStorage.removeItem(key)
  } catch {}
}

function dispatchWalletPubkeyChanged(pubkey: string): void {
  if (typeof window === 'undefined') return
  try {
    window.dispatchEvent(new CustomEvent('wallet:pubkey-changed', { detail: pubkey }))
  } catch {}
}

export function readStoredWalletModule(): string {
  return readStorageValue(WALLET_MODULE_STORAGE_KEY)
}

export function persistWalletPubkey(pubkey: string): void {
  writeStorageValue(WALLET_PUBKEY_STORAGE_KEY, pubkey)
  dispatchWalletPubkeyChanged(pubkey)
}

export function clearStoredWalletConnection(): void {
  writeStorageValue(WALLET_PUBKEY_STORAGE_KEY, '')
  writeStorageValue(WALLET_MODULE_STORAGE_KEY, '')
  dispatchWalletPubkeyChanged('')
}

function rememberSelectedWalletModule(moduleId: unknown): void {
  const normalized = typeof moduleId === 'string' ? moduleId.trim() : ''
  if (!normalized) return
  writeStorageValue(WALLET_MODULE_STORAGE_KEY, normalized)
}

function restoreSelectedWalletModule(kit: StellarWalletsKit): void {
  const moduleId = readStoredWalletModule()
  if (!moduleId) return
  try {
    kit.setWallet(moduleId)
  } catch {}
}

export function isWalletSelectionClosedError(error: unknown): boolean {
  return error instanceof Error && error.message === WALLET_SELECTION_CLOSED_MESSAGE
}

function resolveE2EWalletProfile(): 'holder' | 'manager' {
  if (typeof window === 'undefined') return 'holder'
  try {
    const raw = window.localStorage.getItem('e2e-wallet-profile')
    return raw === 'manager' ? 'manager' : 'holder'
  } catch {
    return 'holder'
  }
}

function resolveE2EWalletFailureMode(): 'reject' | 'malformed' | 'timeout' | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.localStorage.getItem('e2e-wallet-signing-failure')
    if (raw === 'reject' || raw === 'malformed' || raw === 'timeout') return raw
  } catch {
    return null
  }
  return null
}

async function fetchE2EWalletAddress(): Promise<string> {
  const profile = resolveE2EWalletProfile()
  const res = await fetch(`/api/e2e-wallet?profile=${profile}`, { method: 'GET' })
  if (!res.ok) throw new Error('E2E wallet unavailable')
  const json = (await res.json()) as { address?: string }
  if (!json.address) throw new Error('E2E wallet address missing')
  return json.address
}

function encodeSignatureBytes(input: Uint8Array): string {
  let binary = ''
  input.forEach((byte) => {
    binary += String.fromCharCode(byte)
  })
  return btoa(binary)
}

function normalizeSignedMessage(input: unknown): string | null {
  if (typeof input === 'string') return input
  if (input instanceof Uint8Array) return encodeSignatureBytes(input)
  if (
    input &&
    typeof input === 'object' &&
    (input as { type?: unknown; data?: unknown }).type === 'Buffer' &&
    Array.isArray((input as { data?: unknown }).data)
  ) {
    return encodeSignatureBytes(new Uint8Array((input as { data: number[] }).data))
  }
  return null
}

function extractSignedMessage(input: unknown): string | null {
  const direct = normalizeSignedMessage(input)
  if (direct) return direct
  if (input && typeof input === 'object') {
    const value = input as {
      signedMessage?: unknown
      signedBlob?: unknown
      signature?: unknown
      error?: unknown
    }
    return (
      normalizeSignedMessage(value.signedMessage) ??
      normalizeSignedMessage(value.signedBlob) ??
      normalizeSignedMessage(value.signature)
    )
  }
  return null
}

export async function signWithE2EWallet(xdrB64: string, options?: SignOptions): Promise<string> {
  assertFinancialActionsEnabled()
  const failureMode = resolveE2EWalletFailureMode()
  if (failureMode === 'reject') {
    throw new Error('E2E wallet signer unavailable')
  }
  if (failureMode === 'malformed') {
    throw new Error('E2E wallet signature missing')
  }
  if (failureMode === 'timeout') {
    throw new Error('E2E wallet signing timed out')
  }

  const profile = resolveE2EWalletProfile()
  const res = await fetch(`/api/e2e-wallet?profile=${profile}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    credentials: 'same-origin',
    body: JSON.stringify({
      xdr: xdrB64,
      networkPassphrase: options?.networkPassphrase,
    }),
    cache: 'no-store',
  })
  if (!res.ok) throw new Error('E2E wallet signer unavailable')
  const json = (await res.json()) as { signedTxXdr?: string }
  return requireSignedTransactionXdr(json, 'E2E wallet')
}

export async function signMessageWithE2EWallet(message: string): Promise<string> {
  assertFinancialActionsEnabled()
  const profile = resolveE2EWalletProfile()
  const res = await fetch(`/api/e2e-wallet?profile=${profile}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    credentials: 'same-origin',
    body: JSON.stringify({ message }),
    cache: 'no-store',
  })
  if (!res.ok) throw new Error('E2E wallet message signer unavailable')
  const json = (await res.json()) as { signedMessage?: string }
  if (!json.signedMessage) throw new Error('E2E wallet message signature missing')
  return json.signedMessage
}

function createE2EWalletKit(): StellarWalletsKit {
  const fakeKit = {
    async getAddress() {
      return { address: await fetchE2EWalletAddress() }
    },
    async signTransaction(xdrB64: string, options?: SignOptions) {
      return { signedTxXdr: await signWithE2EWallet(xdrB64, options) }
    },
    async signMessage(message: string) {
      return { signedMessage: await signMessageWithE2EWallet(message), signerAddress: await fetchE2EWalletAddress() }
    },
    setWallet() {},
    openModal({ onWalletSelected }: { onWalletSelected?: (option: { id: string }) => void }) {
      onWalletSelected?.({ id: 'E2E' })
    },
  }

  return fakeKit as unknown as StellarWalletsKit
}

export async function signMessageWithWallet(
  kit: StellarWalletsKit,
  message: string,
  address?: string,
): Promise<string> {
  assertFinancialActionsEnabled()
  if (E2E_WALLET_ENABLED) {
    return signMessageWithE2EWallet(message)
  }

  const opts: SignMessageOptions = { networkPassphrase: NETWORK_PASSPHRASE, address }
  const maybeKit = kit as unknown as {
    signMessage?: (message: string, opts?: SignMessageOptions) => Promise<unknown>
  }

  if (typeof maybeKit.signMessage === 'function') {
    const signed = extractSignedMessage(await maybeKit.signMessage(message, opts))
    if (signed) return signed
  }

  throw new Error('Wallet message signature missing')
}

export function getWalletsKit(modules: SupportedModule[] = ['FREIGHTER', 'ALBEDO', 'XBULL']): StellarWalletsKit {
  if (E2E_WALLET_ENABLED) {
    return createE2EWalletKit()
  }

  const instances = modules.map((m) => {
    switch (m) {
      case 'FREIGHTER':
        return new FreighterModule()
      case 'ALBEDO':
        return new AlbedoModule()
      case 'XBULL':
        return new xBullModule()
      default:
        return undefined
    }
  }).filter(Boolean) as unknown as ConstructorParameters<typeof StellarWalletsKit>[0]['modules']

  const kit = new StellarWalletsKit({ network: resolveWalletNetwork(), modules: instances })
  if (typeof kit.signTransaction === 'function') {
    const signTransaction = kit.signTransaction.bind(kit)
    kit.signTransaction = async (...args) => {
      assertFinancialActionsEnabled()
      return signTransaction(...args)
    }
  }
  restoreSelectedWalletModule(kit)
  return kit
}

export async function connectWallet(kit: StellarWalletsKit): Promise<string> {
  if (E2E_WALLET_ENABLED) {
    return fetchE2EWalletAddress()
  }

  return await new Promise<string>((resolve, reject) => {
    let settled = false
    let walletSelected = false
    let modalSeen = false
    let modalClosedPoll: ReturnType<typeof setInterval> | null = null
    let modalTimeout: ReturnType<typeof setTimeout> | null = null

    const cleanup = () => {
      if (modalClosedPoll) clearInterval(modalClosedPoll)
      if (modalTimeout) clearTimeout(modalTimeout)
      modalClosedPoll = null
      modalTimeout = null
    }
    const resolveOnce = (value: string) => {
      if (settled) return
      settled = true
      cleanup()
      resolve(value)
    }
    const rejectOnce = (error: unknown) => {
      if (settled) return
      settled = true
      cleanup()
      reject(error instanceof Error ? error : new Error(String(error || 'Wallet connection failed')))
    }
    const closedError = () => new Error(WALLET_SELECTION_CLOSED_MESSAGE)

    const openModalResult = kit.openModal({
      onWalletSelected: async (option) => {
        try {
          walletSelected = true
          kit.setWallet(option.id)
          rememberSelectedWalletModule(option.id)
          // Prefer getPublicKey if available; fallback to getAddress
          const anyKit = kit as unknown as { getPublicKey?: () => Promise<string> }
          if (typeof anyKit.getPublicKey === 'function') {
            const pub = await anyKit.getPublicKey()
            if (pub) return resolveOnce(pub)
          }
          const { address } = await kit.getAddress()
          if (!address) throw new Error('Cannot retrieve public key')
          resolveOnce(address)
        } catch (err) {
          rejectOnce(err)
        }
      },
      onClosed: () => rejectOnce(closedError()),
    })
    void Promise.resolve(openModalResult).catch(rejectOnce)

    modalTimeout = setTimeout(() => {
      if (!walletSelected) rejectOnce(closedError())
    }, 120_000)
    modalClosedPoll = setInterval(() => {
      if (typeof document === 'undefined' || walletSelected || settled) return
      const modal = document.querySelector('stellar-wallets-modal')
      if (modal) {
        modalSeen = true
        const shadow = (modal as HTMLElement & { shadowRoot?: ShadowRoot | null }).shadowRoot
        const dialogOpen = Boolean(shadow?.querySelector('dialog[open]'))
        const showModal = modal.hasAttribute('showmodal') || modal.hasAttribute('showModal')
        if (!dialogOpen && !showModal) rejectOnce(closedError())
        return
      }
      if (modalSeen) rejectOnce(closedError())
    }, 100)
  })
}
