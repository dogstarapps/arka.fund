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

async function main() {
  const deployments = loadDeployments()
  const adminSecret = getRequiredEnv('ADMIN_SECRET')
  const creator = getRequiredEnv('CREATOR_ADDRESS')
  const governorId = getRequiredEnv('GOV_ID')
  const arkaId = process.env.ARKA_ID || deployments.contracts.arka

  if (!arkaId) {
    throw new Error('Missing ARKA_ID and deployments.contracts.arka')
  }

  const mgmtBps = Number(process.env.MGMT_BPS || '50')
  const perfBps = Number(process.env.PERF_BPS || '100')
  const depositBps = Number(process.env.DEPOSIT_BPS || '20')
  const redeemBps = Number(process.env.REDEEM_BPS || '20')
  const txFee = Number(process.env.TX_FEE || '5000000')

  const client = makeGovernorClient(deployments, governorId, creator)
  const action: ProposalAction = {
    tag: 'Calldata',
    values: [{
      contract_id: arkaId,
      function: 'set_fees',
      args: [
        scAddress(governorId),
        nativeToScVal(mgmtBps, { type: 'i32' }),
        nativeToScVal(perfBps, { type: 'i32' }),
        nativeToScVal(depositBps, { type: 'i32' }),
        nativeToScVal(redeemBps, { type: 'i32' }),
      ],
      auths: [],
    }],
  }

  const assembled = await client.propose({
    creator,
    title: 'Set Arka Fees',
    description: `Governed Arka fee update for ${arkaId}`,
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
