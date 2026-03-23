import {
  Address,
  Contract,
  Keypair,
  TransactionBuilder,
  nativeToScVal,
  rpc,
  scValToNative,
  xdr,
} from '@stellar/stellar-sdk'
import { Client as GovernorClient, ProposalAction } from './generated/governor/src/index.ts'
import {
  getNetworkPassphrase,
  getRpcUrl,
  getRequiredEnv,
  loadDeployments,
} from './governorCommon.ts'

function scAddress(value: string) {
  return xdr.ScVal.scvAddress(Address.fromString(value).toScAddress())
}

function scBytes(hex: string) {
  return xdr.ScVal.scvBytes(Buffer.from(hex, 'hex'))
}

function scAddressVec(values: string[]) {
  return xdr.ScVal.scvVec(values.map((value) => scAddress(value)))
}

async function main() {
  const deployments = loadDeployments()
  const adminSecret = getRequiredEnv('ADMIN_SECRET')
  const creator = getRequiredEnv('CREATOR_ADDRESS')
  const governorId = getRequiredEnv('GOV_ID')
  const factoryId = process.env.FACTORY_ID || deployments.contracts.arkaFactory
  const oldArka = getRequiredEnv('OLD_ARKA')
  const saltHex = getRequiredEnv('MIGRATION_SALT_HEX').replace(/^0x/i, '')
  const manager = getRequiredEnv('MANAGER_ADDRESS')
  const denomination = getRequiredEnv('DENOMINATION')
  const router = getRequiredEnv('ROUTER')
  const whitelist = (process.env.WHITELIST || denomination)
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
  const txFee = process.env.TX_FEE || '7000000'

  if (!factoryId) {
    throw new Error('Missing FACTORY_ID and deployments.contracts.arkaFactory')
  }

  const mgmtBps = Number(process.env.MGMT_BPS || '0')
  const perfBps = Number(process.env.PERF_BPS || '0')
  const depositBps = Number(process.env.DEPOSIT_BPS || '0')
  const redeemBps = Number(process.env.REDEEM_BPS || '0')
  const networkPassphrase = getNetworkPassphrase(deployments)
  const rpcUrl = getRpcUrl(deployments)

  const action: ProposalAction = {
    tag: 'Calldata',
    values: [{
      contract_id: factoryId,
      function: 'migrate_arka',
      args: [
        scAddress(oldArka),
        scBytes(saltHex),
        scAddress(manager),
        scAddress(denomination),
        nativeToScVal(mgmtBps, { type: 'i32' }),
        nativeToScVal(perfBps, { type: 'i32' }),
        nativeToScVal(depositBps, { type: 'i32' }),
        nativeToScVal(redeemBps, { type: 'i32' }),
        scAddressVec(whitelist),
        scAddress(router),
      ],
      auths: [],
    }],
  }

  const governor = new GovernorClient({
    contractId: governorId,
    networkPassphrase,
    rpcUrl,
    publicKey: creator,
  })

  const contract = new Contract(governorId)
  const server = new rpc.Server(rpcUrl)
  const sourceKeypair = Keypair.fromSecret(adminSecret)
  const source = await server.getAccount(sourceKeypair.publicKey())
  const args = governor.spec.funcArgsToScVals('propose', {
    creator,
    title: 'Migrate Arka',
    description: `Governed Arka migration for ${oldArka}`,
    action,
  })

  let tx = new TransactionBuilder(source, {
    fee: txFee,
    networkPassphrase,
  })
    .addOperation(contract.call('propose', ...args))
    .setTimeout(30)
    .build()

  tx = await server.prepareTransaction(tx)
  tx.sign(sourceKeypair)

  const send = await server.sendTransaction(tx)
  console.log(JSON.stringify(send, null, 2))
  if (send.status !== 'PENDING') {
    return
  }

  const hash = send.hash
  console.log(`TX_HASH=${hash}`)
  for (let i = 0; i < 60; i += 1) {
    const result = await fetch(rpcUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'getTransaction',
        params: { hash },
      }),
    }).then((response) => response.json())

    const status = (result as { result?: { status?: string } }).result?.status
    if (status && status !== 'NOT_FOUND') {
      const ledger = (result as { result?: { ledger?: number } }).result?.ledger
      if (status === 'SUCCESS' && ledger) {
        const events = await fetch(rpcUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            jsonrpc: '2.0',
            id: 1,
            method: 'getEvents',
            params: {
              startLedger: ledger,
              endLedger: ledger,
              filters: [{ type: 'contract', contractIds: [governorId] }],
              pagination: { limit: 50 },
            },
          }),
        }).then((response) => response.json())

        const proposalCreatedEvent = (events as {
          result?: { events?: Array<{ txHash?: string; topic?: string[] }> }
        }).result?.events?.find((event) => {
          return event.txHash === hash && event.topic?.[0] === 'AAAADwAAABBwcm9wb3NhbF9jcmVhdGVk'
        })
        const proposalTopic = proposalCreatedEvent?.topic?.[1]
        if (proposalTopic) {
          const proposalId = scValToNative(xdr.ScVal.fromXDR(proposalTopic, 'base64'))
          console.log(`PROPOSAL_ID=${proposalId}`)
        }
      }
      console.log(JSON.stringify(result, null, 2))
      return
    }
    await new Promise((resolve) => setTimeout(resolve, 1000))
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
