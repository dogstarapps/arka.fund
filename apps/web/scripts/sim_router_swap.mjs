import { Address, Contract, Keypair, TransactionBuilder, nativeToScVal, rpc, xdr } from '@stellar/stellar-sdk'
import fs from 'node:fs'

const NETWORK_PASSPHRASE = process.env.NEXT_PUBLIC_STELLAR_NETWORK ?? 'Test SDF Network ; September 2015'
const RPC_URL = process.env.NEXT_PUBLIC_SOROBAN_RPC_URL ?? 'https://soroban-testnet.stellar.org'
// Defaults from config; override via env if needed
const SOROSWAP_ROUTER = process.env.NEXT_PUBLIC_SOROSWAP_ROUTER ?? 'CCMAPXWVZD4USEKDWRYS7DA4Y3D7E2SDMGBFJUCEXTC7VN6CUBGWPFUS'
const ROUTING_ASSET_A = process.env.NEXT_PUBLIC_ROUTING_ASSET_A ?? 'CDJ7G22ETJ6PRUM5GDPUXYEY3JL6MDY35WMJYWSGX7U6DV5VMQEKH3PG'
const ROUTING_ASSET_B = process.env.NEXT_PUBLIC_ROUTING_ASSET_B ?? 'CCCLTACEMF33GJRJ2JXRQYXDBRLRZNK5GVPA2FVHLOE5TPP6NM7UIYV7'

function toBaseUnits(amount, decimals = 7) {
  return Math.floor(amount * 10 ** decimals)
}

async function ensureSourceAccount(pubKey) {
  const res = await fetch(`https://friendbot.stellar.org/?addr=${pubKey}`)
  // ignore failures if account already exists
  try { await res.text() } catch {}
}

async function main() {
  let pubKey = process.env.PUBKEY
  if (!pubKey) {
    const kp = Keypair.random()
    pubKey = kp.publicKey()
    await ensureSourceAccount(pubKey)
  }

  const server = new rpc.Server(RPC_URL, { allowHttp: true })
  const source = await server.getAccount(pubKey)
  const router = new Contract(SOROSWAP_ROUTER)
  const path = xdr.ScVal.scvVec([
    xdr.ScVal.scvAddress(Address.fromString(ROUTING_ASSET_A).toScAddress()),
    xdr.ScVal.scvAddress(Address.fromString(ROUTING_ASSET_B).toScAddress()),
  ])
  const deadline = Math.floor(Date.now() / 1000) + 1800

  const amountIn = toBaseUnits(1)
  const txBldr = new TransactionBuilder(source, { fee: '10000', networkPassphrase: NETWORK_PASSPHRASE })
    .addOperation(
      router.call(
        'swap_exact_tokens_for_tokens',
        nativeToScVal(amountIn, { type: 'i128' }),
        nativeToScVal(1, { type: 'i128' }),
        path,
        xdr.ScVal.scvAddress(Address.fromString(pubKey).toScAddress()),
        nativeToScVal(deadline, { type: 'u64' }),
      ),
    )
    .setTimeout(60)
  const built = txBldr.build()
  const txXdr = built.toXDR()
  fs.writeFileSync('/tmp/router_swap.xdr', txXdr)
  console.error('TX XDR (base64) written to /tmp/router_swap.xdr')
  try {
    const sim = await server.simulateTransaction(built)
    console.log(JSON.stringify(sim, null, 2))
  } catch (e) {
    console.error('simulateTransaction threw:', e?.message || e)
    console.log(txXdr)
  }
}

main().catch((e) => { console.error(e); process.exit(1) })

