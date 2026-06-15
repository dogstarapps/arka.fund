import test from 'node:test'
import assert from 'node:assert/strict'
import { buildInitialInnerActions, buildUnwindInnerActions } from './tokenomicsExecutorCommon.ts'
import { loadDeployments } from './governorCommon.ts'

const deployments = loadDeployments()
const contractA = deployments.contracts.arka!
const contractB = deployments.contracts.arkaFactory!
const contractC = deployments.contracts.governor!
const contractD = deployments.contracts.router!
const accountA = deployments.contracts.adapterAquarius!
const accountB = deployments.contracts.adapterSoroswap!

test('buildInitialInnerActions creates vesting and emissions actions', () => {
  const actions = buildInitialInnerActions({
    ecosystem: accountB,
    emissionAmount: 2400,
    emissionEnd: 2000n,
    emissionStart: 1000n,
    emissionsId: contractB,
    executorId: contractC,
    grantAmount: 3000,
    grantCliff: 1100n,
    grantEnd: 1400n,
    grantStart: 1000n,
    operationIdHex: 'ab'.repeat(32),
    scheduler: accountA,
    team: accountA,
    treasury: accountB,
    vestingId: contractA,
  })

  assert.equal(actions.length, 2)
  assert.equal(actions[0].function, 'create_grant')
  assert.equal(actions[1].function, 'create_stream')
  assert.equal(actions[0].args.length, 8)
  assert.equal(actions[1].args.length, 6)
})

test('buildUnwindInnerActions creates revoke and cancel actions', () => {
  const actions = buildUnwindInnerActions({
    emissionsId: contractB,
    executorId: contractC,
    grantId: 1,
    operationIdHex: 'cd'.repeat(32),
    refundRecipient: accountA,
    scheduler: accountB,
    streamId: 1,
    vestingId: contractD,
  })

  assert.equal(actions.length, 2)
  assert.equal(actions[0].function, 'revoke')
  assert.equal(actions[1].function, 'cancel_stream')
  assert.equal(actions[0].args.length, 3)
  assert.equal(actions[1].args.length, 3)
})
