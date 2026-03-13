import { ProposalAction } from './generated/governor/src/index.ts'
import { Address, nativeToScVal, xdr } from '@stellar/stellar-sdk'
import {
  getNetworkPassphrase,
  getRpcUrl,
  getRequiredEnv,
  loadDeployments,
  makeGovernorClient,
  signAndSendTx,
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
  const txFee = Number(process.env.TX_FEE || '7000000')

  if (!factoryId) {
    throw new Error('Missing FACTORY_ID and deployments.contracts.arkaFactory')
  }

  const mgmtBps = Number(process.env.MGMT_BPS || '0')
  const perfBps = Number(process.env.PERF_BPS || '0')
  const depositBps = Number(process.env.DEPOSIT_BPS || '0')
  const redeemBps = Number(process.env.REDEEM_BPS || '0')

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

  const client = makeGovernorClient(deployments, governorId, creator)
  const assembled = await client.propose({
    creator,
    title: 'Migrate Arka',
    description: `Governed Arka migration for ${oldArka}`,
    action,
  }, { simulate: true, fee: txFee })

  console.log(`PROPOSAL_ID=${assembled.result}`)
  const sent = await signAndSendTx(assembled, adminSecret, getNetworkPassphrase(deployments), getRpcUrl(deployments))
  const txHash = (sent as { hash?: string }).hash
  if (txHash) {
    console.log(`TX_HASH=${txHash}`)
  }
  console.log(JSON.stringify(sent, null, 2))
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
