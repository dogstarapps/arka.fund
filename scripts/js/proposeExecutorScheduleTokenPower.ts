import {
  getNetworkPassphrase,
  getRequiredEnv,
  getRpcUrl,
  loadDeployments,
  makeGovernorClient,
  signAndSendTx,
} from './governorCommon.ts'
import { buildTokenPowerScheduleProposalAction } from './executorScheduleCommon.ts'

async function main() {
  const deployments = loadDeployments()
  const signerSecret = getRequiredEnv('SIGNER_SECRET')
  const creator = getRequiredEnv('CREATOR_ADDRESS')
  const governorId = getRequiredEnv('GOV_ID')
  const executorId = getRequiredEnv('EXECUTOR_ID')
  const tokenId = getRequiredEnv('ARKA_TOKEN_ID')
  const lockedArkaId = getRequiredEnv('LOCKED_ARKA_ID')
  const beneficiary = process.env.BENEFICIARY_ADDRESS || creator
  const operationIdHex = getRequiredEnv('OPERATION_ID_HEX')
  const mintAmount = Number(process.env.MINT_AMOUNT || '120')
  const txFee = Number(process.env.TX_FEE || '5000000')

  const action = await buildTokenPowerScheduleProposalAction({
    beneficiary,
    executorId,
    governorId,
    mintAmount,
    operationIdHex,
    tokenId,
  }, deployments)

  const client = makeGovernorClient(deployments, governorId, creator)
  const assembled = await client.propose({
    creator,
    title: 'Queue token-power executor action',
    description: `Queue token mint for locked voting power growth on ${lockedArkaId}`,
    action,
  }, { simulate: true, fee: txFee })

  console.log(`PROPOSAL_ID=${assembled.result}`)
  const sent = await signAndSendTx(
    assembled,
    signerSecret,
    getNetworkPassphrase(deployments),
    getRpcUrl(deployments),
  )
  const txHash = (sent as { hash?: string }).hash
  if (txHash) {
    console.log(`TX_HASH=${txHash}`)
  }
  console.log(JSON.stringify(sent, null, 2))
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
