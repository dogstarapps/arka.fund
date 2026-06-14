import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { Address, contract, nativeToScVal, xdr } from '@stellar/stellar-sdk'
import { getNetworkPassphrase, getRpcUrl, loadDeployments } from './governorCommon.ts'
import { normalizeOperationIdHex } from './executorScheduleCommon.ts'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const ROOT_DIR = path.resolve(__dirname, '..', '..')
const EXECUTOR_WASM_PATH = path.resolve(ROOT_DIR, 'artifacts', 'governance-executor.wasm')

export interface InitialTokenomicsConfig {
  ecosystem: string
  emissionAmount: number
  emissionEnd: bigint
  emissionStart: bigint
  emissionsId: string
  executorId: string
  grantAmount: number
  grantCliff: bigint
  grantEnd: bigint
  grantStart: bigint
  operationIdHex: string
  scheduler: string
  team: string
  treasury: string
  vestingId: string
}

export interface UnwindTokenomicsConfig {
  emissionsId: string
  executorId: string
  grantId: number
  operationIdHex: string
  refundRecipient: string
  scheduler: string
  streamId: number
  vestingId: string
}

function scAddress(value: string) {
  return xdr.ScVal.scvAddress(Address.fromString(value).toScAddress())
}

function scI128(value: number) {
  return nativeToScVal(value, { type: 'i128' })
}

function scU32(value: number) {
  return nativeToScVal(value, { type: 'u32' })
}

function scU64(value: bigint) {
  return nativeToScVal(value, { type: 'u64' })
}

function scBool(value: boolean) {
  return nativeToScVal(value, { type: 'bool' })
}

async function loadExecutorClient(executorId: string, publicKey: string) {
  if (!fs.existsSync(EXECUTOR_WASM_PATH)) {
    throw new Error(`Missing governance executor wasm at ${EXECUTOR_WASM_PATH}`)
  }
  const deployments = loadDeployments()
  return contract.Client.fromWasm(fs.readFileSync(EXECUTOR_WASM_PATH), {
    contractId: executorId,
    networkPassphrase: getNetworkPassphrase(deployments),
    rpcUrl: getRpcUrl(deployments),
    publicKey,
  })
}

export function buildInitialInnerActions(config: InitialTokenomicsConfig) {
  return [
    {
      contract_id: config.vestingId,
      function: 'create_grant',
      args: [
        scAddress(config.executorId),
        scAddress(config.treasury),
        scAddress(config.team),
        scU64(config.grantStart),
        scU64(config.grantCliff),
        scU64(config.grantEnd),
        scI128(config.grantAmount),
        scBool(true),
      ],
    },
    {
      contract_id: config.emissionsId,
      function: 'create_stream',
      args: [
        scAddress(config.executorId),
        scAddress(config.treasury),
        scAddress(config.ecosystem),
        scU64(config.emissionStart),
        scU64(config.emissionEnd),
        scI128(config.emissionAmount),
      ],
    },
  ]
}

export function buildUnwindInnerActions(config: UnwindTokenomicsConfig) {
  return [
    {
      contract_id: config.vestingId,
      function: 'revoke',
      args: [
        scAddress(config.executorId),
        scU32(config.grantId),
        scAddress(config.refundRecipient),
      ],
    },
    {
      contract_id: config.emissionsId,
      function: 'cancel_stream',
      args: [
        scAddress(config.executorId),
        scU32(config.streamId),
        scAddress(config.refundRecipient),
      ],
    },
  ]
}

export async function buildScheduleTx(mode: 'initial' | 'unwind', config: InitialTokenomicsConfig | UnwindTokenomicsConfig) {
  const executorId = config.executorId
  const executorClient = await loadExecutorClient(executorId, config.scheduler)
  const actions = mode === 'initial'
    ? buildInitialInnerActions(config as InitialTokenomicsConfig)
    : buildUnwindInnerActions(config as UnwindTokenomicsConfig)

  return executorClient.schedule({
    caller: config.scheduler,
    operation_id: Buffer.from(normalizeOperationIdHex(config.operationIdHex), 'hex'),
    actions,
  }, { simulate: true, fee: 5_000_000 })
}
