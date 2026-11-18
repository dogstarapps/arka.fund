import { Address, Contract, TransactionBuilder, nativeToScVal, rpc, xdr } from '@stellar/stellar-sdk'

const NETWORK_PASSPHRASE = process.env.NEXT_PUBLIC_STELLAR_NETWORK ?? 'Test SDF Network ; September 2015'
const RPC_URL = process.env.NEXT_PUBLIC_SOROBAN_RPC_URL ?? 'https://soroban-testnet.stellar.org'
const TOKEN = process.env.NEXT_PUBLIC_ROUTING_ASSET_A
const SPENDER = process.env.NEXT_PUBLIC_SOROSWAP_ROUTER
const PUBKEY = process.env.PUBKEY

if (!PUBKEY || !TOKEN || !SPENDER) {
  console.error('Missing env: PUBKEY, NEXT_PUBLIC_ROUTING_ASSET_A, NEXT_PUBLIC_SOROSWAP_ROUTER')
  process.exit(2)
}

async function main() {
  const server = new rpc.Server(RPC_URL, { allowHttp: true })
  const source = await server.getAccount(PUBKEY)
  const token = new Contract(TOKEN)
  const latest = await server.getLatestLedger()
  const expiration = latest.sequence + 100000

  const txBldr = new TransactionBuilder(source, { fee: '10000', networkPassphrase: NETWORK_PASSPHRASE })
    .addOperation(
      token.call(
        'approve',
        xdr.ScVal.scvAddress(Address.fromString(PUBKEY).toScAddress()),
        xdr.ScVal.scvAddress(Address.fromString(SPENDER).toScAddress()),
        nativeToScVal(10_000_000, { type: 'i128' }),
        nativeToScVal(expiration, { type: 'u32' }),
      ),
    )
    .setTimeout(60)
  const built = txBldr.build()
  const sim = await server.simulateTransaction(built)
  console.log(JSON.stringify(sim, null, 2))
}

main().catch((e) => { console.error(e); process.exit(1) })





