import { getNetworkPassphrase, getRequiredEnv, getRpcUrl, loadDeployments, signAndSendTx } from './governorCommon.ts'
import { buildScheduleTx } from './tokenomicsExecutorCommon.ts'

function assertSendSucceeded(sent: { sendResponse?: { result?: { status?: string } } }) {
  const status = sent.sendResponse?.result?.status
  if (status === 'ERROR') {
    throw new Error(`Executor schedule transaction failed before inclusion`)
  }
}

async function main() {
  const deployments = loadDeployments()
  const signerSecret = getRequiredEnv('SIGNER_SECRET')
  const mode = (process.env.ACTION_MODE || 'initial') as 'initial' | 'unwind'

  if (mode === 'initial') {
    const assembled = await buildScheduleTx('initial', {
      ecosystem: getRequiredEnv('ECOSYSTEM_ADDRESS'),
      emissionAmount: Number(process.env.EMISSION_AMOUNT || '2400'),
      emissionEnd: BigInt(getRequiredEnv('EMISSION_END')),
      emissionStart: BigInt(getRequiredEnv('EMISSION_START')),
      emissionsId: getRequiredEnv('EMISSIONS_ID'),
      executorId: getRequiredEnv('EXECUTOR_ID'),
      grantAmount: Number(process.env.GRANT_AMOUNT || '3000'),
      grantCliff: BigInt(getRequiredEnv('GRANT_CLIFF')),
      grantEnd: BigInt(getRequiredEnv('GRANT_END')),
      grantStart: BigInt(getRequiredEnv('GRANT_START')),
      operationIdHex: getRequiredEnv('OPERATION_ID_HEX'),
      scheduler: getRequiredEnv('SCHEDULER_ADDRESS'),
      team: getRequiredEnv('TEAM_ADDRESS'),
      treasury: getRequiredEnv('TREASURY_ADDRESS'),
      vestingId: getRequiredEnv('VESTING_ID'),
    })
    const sent = await signAndSendTx(
      assembled,
      signerSecret,
      getNetworkPassphrase(deployments),
      getRpcUrl(deployments),
    )
    assertSendSucceeded(sent)
    if (sent.hash) {
      console.log(`TX_HASH=${sent.hash}`)
    }
    console.log(JSON.stringify(sent, null, 2))
    return
  }

  const assembled = await buildScheduleTx('unwind', {
    emissionsId: getRequiredEnv('EMISSIONS_ID'),
    executorId: getRequiredEnv('EXECUTOR_ID'),
    grantId: Number(process.env.GRANT_ID || '1'),
    operationIdHex: getRequiredEnv('OPERATION_ID_HEX'),
    refundRecipient: getRequiredEnv('REFUND_ADDRESS'),
    scheduler: getRequiredEnv('SCHEDULER_ADDRESS'),
    streamId: Number(process.env.STREAM_ID || '1'),
    vestingId: getRequiredEnv('VESTING_ID'),
  })
  const sent = await signAndSendTx(
    assembled,
    signerSecret,
    getNetworkPassphrase(deployments),
    getRpcUrl(deployments),
  )
  assertSendSucceeded(sent)
  if (sent.hash) {
    console.log(`TX_HASH=${sent.hash}`)
  }
  console.log(JSON.stringify(sent, null, 2))
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
