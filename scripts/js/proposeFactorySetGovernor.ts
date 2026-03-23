import { ProposalAction } from './generated/governor/src/index.ts'
import { Address, xdr } from '@stellar/stellar-sdk'
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

async function main() {
  const deployments = loadDeployments()
  const adminSecret = getRequiredEnv('ADMIN_SECRET')
  const creator = getRequiredEnv('CREATOR_ADDRESS')
  const currentGovernorId = getRequiredEnv('GOV_ID')
  const newGovernorId = getRequiredEnv('NEW_GOV_ID')
  const factoryId = process.env.FACTORY_ID || deployments.contracts.arkaFactory
  const txFee = Number(process.env.TX_FEE || '7000000')

  if (!factoryId) {
    throw new Error('Missing FACTORY_ID and deployments.contracts.arkaFactory')
  }

  const client = makeGovernorClient(deployments, currentGovernorId, creator)
  const action: ProposalAction = {
    tag: 'Calldata',
    values: [{
      contract_id: factoryId,
      function: 'set_governor',
      args: [scAddress(newGovernorId)],
      auths: [],
    }],
  }

  const assembled = await client.propose({
    creator,
    title: 'Rotate Factory Governor',
    description: `Transfer ArkaFactory governance for ${factoryId} to ${newGovernorId}`,
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
