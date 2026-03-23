import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { Keypair, TransactionBuilder } from '@stellar/stellar-sdk'
import { Client as GovernorClient } from './generated/governor/src/index.ts'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

export interface Deployments {
  network?: string
  networkPassphrase?: string
  rpcUrl?: string
  contracts: Record<string, string | null | undefined>
  tokens?: Record<string, string | null | undefined>
}

export function loadDeployments(): Deployments {
  const deploymentsPath = path.resolve(__dirname, '..', '..', 'deployments.testnet.json')
  return JSON.parse(fs.readFileSync(deploymentsPath, 'utf8')) as Deployments
}

export function getNetworkPassphrase(deployments: Deployments): string {
  if (deployments.network === 'testnet') {
    return 'Test SDF Network ; September 2015'
  }
  return deployments.networkPassphrase || 'Test SDF Network ; September 2015'
}

export function getRpcUrl(deployments: Deployments): string {
  return deployments.rpcUrl || 'https://soroban-testnet.stellar.org'
}

export function getRequiredEnv(name: string): string {
  const value = process.env[name]
  if (!value) {
    throw new Error(`Missing required env var: ${name}`)
  }
  return value
}

export function makeGovernorClient(
  deployments: Deployments,
  governorId?: string,
  publicKey?: string,
): GovernorClient {
  const contractId = governorId || deployments.contracts.governor
  if (!contractId) {
    throw new Error('Missing governor contract id')
  }
  return new GovernorClient({
    contractId,
    networkPassphrase: getNetworkPassphrase(deployments),
    rpcUrl: getRpcUrl(deployments),
    publicKey,
  })
}

export function makeSignTransaction(secret: string, networkPassphrase: string) {
  const keypair = Keypair.fromSecret(secret)
  return async (xdr: string, opts?: { networkPassphrase?: string }) => {
    const tx = TransactionBuilder.fromXDR(
      xdr,
      opts?.networkPassphrase || networkPassphrase,
    )
    tx.sign(keypair)
    return {
      signedTxXdr: tx.toXDR(),
      signerAddress: keypair.publicKey(),
    }
  }
}

export async function signAndSendTx(
  assembled: { toXDR: () => string },
  secret: string,
  networkPassphrase: string,
  rpcUrl: string,
): Promise<{ hash?: string; sendResponse: unknown; getResponse: unknown }> {
  const keypair = Keypair.fromSecret(secret)
  const signTransaction = makeSignTransaction(secret, networkPassphrase)
  const { signedTxXdr } = await signTransaction(assembled.toXDR(), {
    networkPassphrase,
    address: keypair.publicKey(),
  })

  const sendReq = {
    jsonrpc: '2.0',
    id: 1,
    method: 'sendTransaction',
    params: { transaction: signedTxXdr },
  }
  const sendResponse = await fetch(rpcUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(sendReq),
  }).then((r) => r.json())

  const txHash = (sendResponse as { result?: { hash?: string } }).result?.hash
  if (!txHash) {
    return { sendResponse, getResponse: sendResponse }
  }

  let getResponse: unknown = null
  for (let i = 0; i < 60; i += 1) {
    const getReq = { jsonrpc: '2.0', id: 1, method: 'getTransaction', params: { hash: txHash } }
    getResponse = await fetch(rpcUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(getReq),
    }).then((r) => r.json())
    const status = (getResponse as { result?: { status?: string } }).result?.status
    if (status && status !== 'NOT_FOUND') {
      break
    }
    await new Promise((resolve) => setTimeout(resolve, 1000))
  }

  return { hash: txHash, sendResponse, getResponse }
}
