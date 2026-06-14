import test from 'node:test'
import assert from 'node:assert/strict'
import { buildTokenPowerScheduleProposalAction, normalizeOperationIdHex } from './executorScheduleCommon.ts'
import { loadDeployments } from './governorCommon.ts'

const deployments = loadDeployments()

test('normalizeOperationIdHex enforces bytes32 input', () => {
  assert.equal(
    normalizeOperationIdHex('0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'),
    'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
  )
  assert.throws(
    () => normalizeOperationIdHex('0x1234'),
    /64 hex characters/,
  )
})

test('buildTokenPowerScheduleProposalAction builds executor schedule calldata', async () => {
  const action = await buildTokenPowerScheduleProposalAction({
    beneficiary: deployments.contracts.arkaFactory!,
    executorId: deployments.contracts.arkaFactory!,
    governorId: deployments.contracts.governor!,
    mintAmount: 120,
    operationIdHex: 'ab'.repeat(32),
    tokenId: deployments.contracts.arka!,
  }, deployments)

  assert.equal(action.tag, 'Calldata')
  const [call] = action.values
  assert.equal(call.contract_id, deployments.contracts.arkaFactory!)
  assert.equal(call.function, 'schedule')
  assert.equal(call.auths.length, 0)
  assert.equal(call.args.length, 3)
})
