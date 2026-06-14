import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { Address, contract, nativeToScVal, xdr } from '@stellar/stellar-sdk'
import type { ProposalAction } from './generated/governor/src/index.ts'
import {
  type Deployments,
  getNetworkPassphrase,
  getRpcUrl,
  loadDeployments,
} from './governorCommon.ts'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const ROOT_DIR = path.resolve(__dirname, '..', '..')
const EXECUTOR_WASM_PATH = path.resolve(ROOT_DIR, 'artifacts', 'governance-executor.wasm')

export interface TokenPowerScheduleConfig {
  beneficiary: string
  executorId: string
  governorId: string
  mintAmount: number
  operationIdHex: string
  tokenId: string
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

export function normalizeOperationIdHex(operationIdHex: string): string {
  const normalized = operationIdHex.trim().replace(/^0x/i, '').toLowerCase()
  if (!/^[0-9a-f]{64}$/.test(normalized)) {
    throw new Error('OPERATION_ID_HEX must be exactly 64 hex characters')
  }
  return normalized
}

async function loadExecutorSpec(
  deployments: Deployments,
  executorId: string,
): Promise<contract.Client> {
  if (!fs.existsSync(EXECUTOR_WASM_PATH)) {
    throw new Error(`Missing governance executor wasm at ${EXECUTOR_WASM_PATH}`)
  }
  return contract.Client.fromWasm(fs.readFileSync(EXECUTOR_WASM_PATH), {
    contractId: executorId,
    networkPassphrase: getNetworkPassphrase(deployments),
    rpcUrl: getRpcUrl(deployments),
  })
}

export async function buildTokenPowerScheduleProposalAction(
  config: TokenPowerScheduleConfig,
  deployments: Deployments = loadDeployments(),
): Promise<ProposalAction> {
  const normalizedOperationId = normalizeOperationIdHex(config.operationIdHex)
  const executorClient = await loadExecutorSpec(deployments, config.executorId)
  const innerActions = [
    {
      contract_id: config.tokenId,
      function: 'mint',
      args: [scAddress(config.beneficiary), scI128(config.mintAmount)],
    },
  ]

  const scheduleArgs = executorClient.spec.funcArgsToScVals('schedule', {
    caller: config.governorId,
    operation_id: Buffer.from(normalizedOperationId, 'hex'),
    actions: innerActions,
  })

  return {
    tag: 'Calldata',
    values: [{
      contract_id: config.executorId,
      function: 'schedule',
      args: scheduleArgs,
      auths: [],
    }],
  }
}
