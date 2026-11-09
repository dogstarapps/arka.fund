import { assertProtocolReviewCurrent, assertSameReviewedTransaction } from './workflows/protocolReviewRegistry'
import type { StellarWalletsKit } from '@creit.tech/stellar-wallets-kit'
import { assertFinancialActionsEnabled } from './previewSafety'
import { resolveRpcUrl, TESTNET } from './soroban'
import {
  describeWalletError,
  requireSignedTransactionXdr,
  withWalletSigningTimeout,
} from './workflows/walletProviderRejectionMatrix'

function resolveE2ESigningFailureOverride(): 'reject' | 'malformed' | 'timeout' | null {
  if (process.env.NEXT_PUBLIC_E2E_WALLET !== '1' || typeof window === 'undefined') return null
  try {
    const raw = window.localStorage.getItem('e2e-wallet-signing-failure')
    if (raw === 'reject' || raw === 'malformed' || raw === 'timeout') return raw
  } catch {
    return null
  }
  return null
}

export async function signXdr(walletsKit: StellarWalletsKit, xdrB64: string): Promise<string> {
  assertFinancialActionsEnabled()
  await assertProtocolReviewCurrent(xdrB64)
  const e2eFailureOverride = resolveE2ESigningFailureOverride()
  if (e2eFailureOverride === 'reject') {
    throw new Error('Wallet signature unavailable: E2E wallet signer unavailable')
  }
  if (e2eFailureOverride === 'malformed') {
    throw new Error('Wallet signature unavailable: E2E wallet signature missing')
  }
  if (e2eFailureOverride === 'timeout') {
    throw new Error('Wallet signature unavailable: Wallet signing timed out after 30000ms')
  }

  const maybeKit = walletsKit as unknown as {
    signTransaction?: (
      xdr: string,
      options: { networkPassphrase: string; submit: boolean },
    ) => Promise<unknown>
  }

  try {
    if (typeof maybeKit.signTransaction !== 'function') {
      throw new Error('Wallet kit signer is unavailable')
    }
    const res = await withWalletSigningTimeout(
      maybeKit.signTransaction(xdrB64, { networkPassphrase: TESTNET, submit: false }),
    )
    const signed = requireSignedTransactionXdr(res, 'Wallet kit')
    assertSameReviewedTransaction(xdrB64, signed)
    await assertProtocolReviewCurrent(signed)
    return signed
  } catch (error) {
    throw new Error(`Wallet signature unavailable: ${describeWalletError(error)}`)
  }
}

export async function submitSignedTx(signedXdr: string): Promise<string> {
  assertFinancialActionsEnabled()
  await assertProtocolReviewCurrent(signedXdr)
  type RpcSendTx = {
    jsonrpc: '2.0'
    id: number
    result?: {
      hash?: string
      status?: 'PENDING' | 'DUPLICATE' | 'TRY_AGAIN_LATER' | 'ERROR'
      errorResultXdr?: string
    }
    error?: { code: number; message: string }
  }
  const res = await fetch(resolveRpcUrl(), {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'sendTransaction', params: { transaction: signedXdr } }),
  })
  const json = (await res.json()) as RpcSendTx
  if (json.result?.status === 'ERROR') {
    const detail = json.result.errorResultXdr ? ` (${json.result.errorResultXdr})` : ''
    throw new Error(`sendTransaction failed with status ERROR${detail}`)
  }
  if (!json.result?.hash) throw new Error(json.error?.message || 'sendTransaction failed')
  return json.result.hash
}

export async function waitForTx(hash: string, timeoutMs = 90000): Promise<void> {
  const started = Date.now()
  while (true) {
    const res = await fetch(resolveRpcUrl(), {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'getTransaction', params: { hash } }),
    })
    const json = (await res.json()) as { result?: { status?: string } }
    const status = json.result?.status
    if (status === 'SUCCESS') return
    if (status === 'FAILED' || status === 'ERROR') throw new Error(`Tx failed: ${hash}`)
    if (Date.now() - started > timeoutMs) throw new Error(`Tx timeout: ${hash}`)
    await new Promise((r) => setTimeout(r, 1200))
  }
}
