import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { Keypair, TransactionBuilder } from '@stellar/stellar-sdk'
import { NextResponse } from 'next/server'
import {
  apiErrorResponse,
  jsonNoStore,
  readJsonObjectBody,
} from '@/lib/server/apiHardening'

type WalletProfile = 'holder' | 'manager'

const SEP_53_PREFIX = Buffer.from('Stellar Signed Message:\n', 'utf8')

function createSep53MessageHash(message: string): Buffer {
  return createHash('sha256')
    .update(SEP_53_PREFIX)
    .update(Buffer.from(message, 'utf8'))
    .digest()
}

function isProductionDeployment(): boolean {
  return process.env.NODE_ENV === 'production' || [process.env.VERCEL_ENV, process.env.ARKAFUND_DEPLOYMENT_ENV, process.env.ARKAFUND_RELEASE_ENV].some(value => value?.trim().toLowerCase() === 'production')
}

function resolveIdentitySecret(name: string): string | null {
  try {
    const secret = execFileSync('stellar', ['keys', 'secret', name], { encoding: 'utf8' }).trim()
    return secret || null
  } catch {
    return null
  }
}

function getE2EWalletConfig(profile: WalletProfile): { enabled: boolean; secret: string | null } {
  const enabled = process.env.NEXT_PUBLIC_E2E_WALLET === '1' || process.env.E2E_WALLET_ENABLED === '1'
  if (isProductionDeployment() || !enabled) {
    return { enabled: false, secret: null }
  }

  const secretFromEnv =
    profile === 'manager'
      ? process.env.E2E_MANAGER_WALLET_SECRET ?? null
      : process.env.E2E_WALLET_SECRET ?? null
  const fallbackSecret = secretFromEnv ? null :
    profile === 'manager'
      ? resolveIdentitySecret(process.env.E2E_MANAGER_WALLET_IDENTITY ?? 'arka-admin')
      : resolveIdentitySecret(process.env.E2E_WALLET_IDENTITY ?? 'arka-holder')
  return {
    enabled,
    secret: secretFromEnv ?? fallbackSecret,
  }
}

function parseProfile(input: string | null): WalletProfile {
  return input === 'manager' ? 'manager' : 'holder'
}

function requireE2EWalletSecret(profile: WalletProfile): string {
  const { enabled, secret } = getE2EWalletConfig(profile)
  if (!enabled || !secret) {
    throw new Error('E2E wallet disabled')
  }
  return secret
}

export async function GET(request: Request): Promise<NextResponse> {
  try {
    const url = new URL(request.url)
    const profile = parseProfile(url.searchParams.get('profile'))
    const secret = requireE2EWalletSecret(profile)
    const address = Keypair.fromSecret(secret).publicKey()
    return jsonNoStore({ address, profile })
  } catch {
    return apiErrorResponse(
      'api_e2e_wallet',
      'not_found',
      'E2E wallet profile is not available in this environment.',
      { status: 404 },
    )
  }
}

export async function POST(request: Request): Promise<NextResponse> {
  try {
    const url = new URL(request.url)
    const profile = parseProfile(url.searchParams.get('profile'))
    const secret = requireE2EWalletSecret(profile)
    const body = await readJsonObjectBody<{
      xdr?: string
      message?: string
      networkPassphrase?: string
    }>(request)
    if (body.message) {
      const signature = Keypair.fromSecret(secret)
        .sign(createSep53MessageHash(body.message))
        .toString('base64')
      return jsonNoStore({ signedMessage: signature, profile })
    }

    if (!body.xdr) {
      return apiErrorResponse(
        'api_e2e_wallet',
        'missing_xdr',
        'Transaction XDR is required before signing.',
        { status: 400 },
      )
    }

    const tx = TransactionBuilder.fromXDR(
      body.xdr,
      body.networkPassphrase ?? 'Test SDF Network ; September 2015',
    )
    tx.sign(Keypair.fromSecret(secret))

    return jsonNoStore({ signedTxXdr: tx.toXDR(), profile })
  } catch {
    return apiErrorResponse(
      'api_e2e_wallet',
      'sign_failed',
      'E2E wallet signing failed.',
      { status: 500 },
    )
  }
}
