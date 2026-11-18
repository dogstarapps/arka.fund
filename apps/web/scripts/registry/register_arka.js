/* eslint-disable @typescript-eslint/no-require-imports */
/*
 Register an Arka in ArkaRegistry via RPC (no CLI).
 Usage: node scripts/registry/register_arka.js <REGISTRY_ID> <MANAGER_PUBKEY> <ARKA_ID>
 Requires: NEXT_SK in .env.local (secret of MANAGER_PUBKEY)
*/
const fs = require('fs')
const path = require('path')
const sdk = require('@stellar/stellar-sdk')
const { rpc, xdr, Contract, Address, TransactionBuilder, Keypair } = sdk

function loadEnvLocal() {
  const p = path.resolve(process.cwd(), '.env.local')
  if (!fs.existsSync(p)) return
  const lines = fs.readFileSync(p, 'utf8').split(/\r?\n/)
  for (const line of lines) {
    if (!line || line.trim().startsWith('#')) continue
    const idx = line.indexOf('=')
    if (idx <= 0) continue
    const key = line.slice(0, idx).trim()
    let val = line.slice(idx + 1).trim()
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) val = val.slice(1, -1)
    if (!process.env[key]) process.env[key] = val
  }
}

async function main() {
  loadEnvLocal()
  const RPC = process.env.NEXT_PUBLIC_SOROBAN_RPC_URL || 'https://soroban-testnet.stellar.org'
  const PASS = process.env.NEXT_PUBLIC_STELLAR_NETWORK || 'Test SDF Network ; September 2015'
  const SK = process.env.NEXT_SK
  const [REGISTRY_ID, MANAGER, ARKA_ID] = process.argv.slice(2)
  if (!REGISTRY_ID || !MANAGER || !ARKA_ID) throw new Error('Usage: node scripts/registry/register_arka.js <REGISTRY_ID> <MANAGER_PUBKEY> <ARKA_ID>')
  if (!SK) throw new Error('Missing NEXT_SK in env or .env.local')
  const kp = Keypair.fromSecret(SK.trim())
  const server = new rpc.Server(RPC, { allowHttp: true })
  const source = await server.getAccount(kp.publicKey())
  const reg = new Contract(REGISTRY_ID)
  const tx = new TransactionBuilder(source, { fee: '10000', networkPassphrase: PASS })
    .addOperation(
      reg.call(
        'register',
        xdr.ScVal.scvAddress(Address.fromString(MANAGER).toScAddress()),
        xdr.ScVal.scvAddress(Address.fromString(ARKA_ID).toScAddress()),
      ),
    )
    .setTimeout(60)
    .build()
  const sim = await server.simulateTransaction(tx)
  if (rpc.Api.isSimulationError(sim)) throw new Error('Simulation failed')
  const prepared = rpc.assembleTransaction(tx, sim)
  let signedB64 = null
  try {
    // prepared may be an AssembledTransaction with signTransaction
    if (prepared.signTransaction) signedB64 = prepared.signTransaction(kp)
  } catch {}
  if (!signedB64) {
    // Fallback: decode to Transaction and sign
    const b64 = typeof prepared === 'string' ? prepared : (prepared.toXDR ? prepared.toXDR() : '')
    const txObj = sdk.TransactionBuilder.fromXDR(b64, PASS)
    txObj.sign(kp)
    signedB64 = txObj.toXDR().toString('base64')
  }
  const send = await fetch(RPC, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'sendTransaction', params: { transaction: signedB64 } }) })
  const json = await send.json()
  const hash = json?.result?.hash
  console.log('register_hash', hash || json)
}

main().catch((e) => { console.error('FATAL', e?.response?.data || e); process.exit(1) })

