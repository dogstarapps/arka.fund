import {
  Contract,
  TransactionBuilder,
  nativeToScVal,
  rpc,
  scValToNative,
} from '@stellar/stellar-sdk'
import {
  getNetworkPassphrase,
  getRequiredEnv,
  getRpcUrl,
  loadDeployments,
} from './governorCommon.ts'

async function main() {
  const deployments = loadDeployments()
  const governorId = getRequiredEnv('GOV_ID')
  const proposalId = Number(getRequiredEnv('PROPOSAL_ID'))
  const publicKey = getRequiredEnv('PUBLIC_KEY')

  const networkPassphrase = getNetworkPassphrase(deployments)
  const rpcUrl = getRpcUrl(deployments)
  const server = new rpc.Server(rpcUrl)
  const source = await server.getAccount(publicKey)
  const contract = new Contract(governorId)

  const tx = new TransactionBuilder(source, {
    fee: '1000000',
    networkPassphrase,
  })
    .addOperation(contract.call('get_proposal', nativeToScVal(proposalId, { type: 'u32' })))
    .setTimeout(30)
    .build()

  const simulation = await server.simulateTransaction(tx)
  if ('error' in simulation && simulation.error) {
    throw new Error(`Simulation failed: ${simulation.error}`)
  }

  if (!('result' in simulation) || !simulation.result) {
    throw new Error('Simulation did not return a proposal payload')
  }

  const proposal = scValToNative(simulation.result.retval)
  console.log(JSON.stringify(
    proposal,
    (_key, value) => (typeof value === 'bigint' ? value.toString() : value),
    2,
  ))
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
