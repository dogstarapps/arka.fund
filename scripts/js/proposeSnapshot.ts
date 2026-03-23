import {
  getNetworkPassphrase,
  getRequiredEnv,
  loadDeployments,
  makeGovernorClient,
  signAndSendTx,
} from './governorCommon.ts'

async function main() {
  const deployments = loadDeployments()
  const adminSecret = getRequiredEnv('ADMIN_SECRET')
  const creator = getRequiredEnv('CREATOR_ADDRESS')
  const client = makeGovernorClient(deployments)

  // Use helper that avoids enum marshalling from CLI
  const assembled = await client.propose_snapshot({
    creator,
    title: 'Snapshot Test',
    description: 'No-op snapshot',
  }, { simulate: true })

  if (assembled.result === undefined || assembled.result === null) {
    throw new Error('Simulation did not return a result')
  }

  console.log(`PROPOSAL_ID=${assembled.result}`)

  const sent = await signAndSendTx(assembled, adminSecret, getNetworkPassphrase(deployments))
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
