import { ProposalAction } from './generated/governor/src/index.ts'
import {
  getNetworkPassphrase,
  getRpcUrl,
  getRequiredEnv,
  loadDeployments,
  makeGovernorClient,
  signAndSendTx,
} from './governorCommon.ts'

async function main() {
  const deployments = loadDeployments()
  const adminSecret = getRequiredEnv('ADMIN_SECRET')
  const creator = getRequiredEnv('CREATOR_ADDRESS')
  const governorId = getRequiredEnv('GOV_ID')
  const factoryId = process.env.FACTORY_ID || deployments.contracts.arkaFactory
  const implHashHex = getRequiredEnv('SHARE_TOKEN_IMPL_HASH_HEX').replace(/^0x/i, '')
  const txFee = Number(process.env.TX_FEE || '5000000')

  if (!factoryId) {
    throw new Error('Missing FACTORY_ID and deployments.contracts.arkaFactory')
  }

  const action: ProposalAction = {
    tag: 'Calldata',
    values: [{
      contract_id: factoryId,
      function: 'set_share_token_implementation',
      args: [Buffer.from(implHashHex, 'hex')],
      auths: [],
    }],
  }

  const client = makeGovernorClient(deployments, governorId, creator)
  const assembled = await client.propose({
    creator,
    title: 'Set Share Token Implementation',
    description: `Governed share token implementation update for ${factoryId}`,
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
