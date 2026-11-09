import { rememberProtocolReview } from './workflows/protocolReviewRegistry'
import { protocolVenueAllowed, type ProtocolId, type VenueSnapshot } from './workflows/protocolLifecycle'
// Soroban (Stellar SDK) helpers for building swap transactions
import {GENERAL_MAINNET,generalRead} from './generalMainnet';
import { Account, Address, Contract, TransactionBuilder, nativeToScVal, scValToNative as sdkScValToNative, rpc, xdr } from '@stellar/stellar-sdk'
import { NETWORK_PASSPHRASE, SIM_ACCOUNT, SOROBAN_RPC_URL, SOROSWAP_ROUTER, SOROSWAP_ADAPTER, AQUARIUS_ADAPTER, ADAPTER_BALANCED, PHOENIX_ADAPTER, SUSHI_ADAPTER, SUSHI_FACTORY, ADAPTER_BLEND, PLATFORM_VENUE_REGISTRY } from './config'

export const TESTNET = NETWORK_PASSPHRASE
export const RPC_URL = SOROBAN_RPC_URL

export function resolveRpcUrl(): string {
  if (typeof window === 'undefined') return RPC_URL
  return `${window.location.origin}/api/soroban/rpc`
}

function createRpcServer(): rpc.Server {
  return new rpc.Server(resolveRpcUrl(), { allowHttp: true })
}

const READONLY_SOURCE_CACHE_MS = 5_000
const readonlySourceCache = new Map<string, {
  accountId: string
  sequence: string
  expiresAt: number
}>()

async function getReadonlySource(server: rpc.Server, sourceId: string): Promise<Account> {
  const cached = readonlySourceCache.get(sourceId)
  if (cached && cached.expiresAt > Date.now()) {
    return new Account(cached.accountId, cached.sequence)
  }

  const source = await server.getAccount(sourceId)
  const snapshot = {
    accountId: source.accountId(),
    sequence: source.sequenceNumber(),
    expiresAt: Date.now() + READONLY_SOURCE_CACHE_MS,
  }
  readonlySourceCache.set(sourceId, snapshot)
  return new Account(snapshot.accountId, snapshot.sequence)
}

export function toBaseUnits(amount: number, decimals = 7): number {
  return Math.floor(amount * 10 ** decimals)
}

type HasToXdr = { toXDR: () => string }
type HasBuildToXdr = { build: () => { toXDR: () => string } }

function toB64Xdr(prepared: unknown): string {
  if (typeof prepared === 'string') return prepared
  const maybeToXdr = prepared as HasToXdr | undefined
  if (maybeToXdr && typeof maybeToXdr.toXDR === 'function') return maybeToXdr.toXDR()
  const maybeBuild = prepared as HasBuildToXdr | undefined
  if (maybeBuild && typeof maybeBuild.build === 'function') return maybeBuild.build().toXDR()
  throw new Error('Unexpected prepared transaction type')
}

type ScValWithBytesN = typeof xdr.ScVal & {
  scvBytesN?: (value: Buffer | Uint8Array) => xdr.ScVal
}

function toScValBytesOrBytesN(raw: Buffer): xdr.ScVal {
  const scVal = xdr.ScVal as ScValWithBytesN
  return scVal.scvBytesN ? scVal.scvBytesN(raw) : xdr.ScVal.scvBytes(raw)
}

function describeSimulationFailure(
  sim: unknown,
  fallback = 'Simulation failed',
  options: { allowanceMessage?: string } = {},
): string {
  const rawError = typeof (sim as { error?: unknown })?.error === 'string'
    ? String((sim as { error?: string }).error)
    : ''
  if (/not enough allowance to spend/i.test(rawError)) {
    return options.allowanceMessage ?? 'Token approval is missing or has not confirmed yet. Approve the token allowance and retry.'
  }
  if (/not enough balance/i.test(rawError)) {
    return 'Insufficient token balance for this transaction.'
  }
  const contractError = rawError.match(/Error\(Contract,\s*#(\d+)\)/i)
  if (contractError) return `${fallback}: contract error #${contractError[1]}`
  return rawError.trim() ? `${fallback}: ${rawError.trim()}` : fallback
}

export async function buildTokenApprove(
  ownerPubKey: string,
  tokenContractId: string,
  spenderContractId: string,
  amountBaseUnits: number,
  expirationDeltaLedgers = 100000,
) {
  const server = createRpcServer()
  const source = await server.getAccount(ownerPubKey)
  const latest = await server.getLatestLedger()
  const expirationLedger = latest.sequence + expirationDeltaLedgers
  const token = new Contract(tokenContractId)
  const owner = xdr.ScVal.scvAddress(Address.fromString(ownerPubKey).toScAddress())
  const spender = xdr.ScVal.scvAddress(Address.fromString(spenderContractId).toScAddress())
  const amount = nativeToScVal(typeof amountBaseUnits === 'number' ? BigInt(Math.trunc(amountBaseUnits)) : BigInt(amountBaseUnits as unknown as bigint), { type: 'i128' })
  const expiration = nativeToScVal(expirationLedger, { type: 'u32' })

  const assembleApprove = async (args: xdr.ScVal[]): Promise<string> => {
    const built = new TransactionBuilder(source, { fee: '10000', networkPassphrase: TESTNET })
      .addOperation(token.call('approve', ...args))
      .setTimeout(60)
      .build()
    let lastError: Error | null = null
    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        const sim = await server.simulateTransaction(built)
        if (rpc.Api.isSimulationError(sim)) {
          throw new Error(sim.error || 'Simulation failed')
        }
        const prepared = rpc.assembleTransaction(built, sim)
        return toB64Xdr(prepared)
      } catch (error) {
        lastError = error instanceof Error ? error : new Error('Simulation failed')
        if (attempt < 2) {
          await new Promise((resolve) => setTimeout(resolve, 1200 * (attempt + 1)))
        }
      }
    }
    throw lastError ?? new Error('Simulation failed')
  }

  try {
    return await assembleApprove([owner, spender, amount, expiration])
  } catch (standardError) {
    try {
      return await assembleApprove([owner, spender, amount])
    } catch {
      throw standardError
    }
  }
}

export async function buildApproveAndArkaDeposit(
  pubKey: string,
  tokenContractId: string,
  arkaId: string,
  amountBaseUnits: number,
  expirationDeltaLedgers = 100000,
) {
  const server = createRpcServer()
  const source = await server.getAccount(pubKey)
  const latest = await server.getLatestLedger()
  const expirationLedger = latest.sequence + expirationDeltaLedgers
  const token = new Contract(tokenContractId)
  const arka = new Contract(arkaId)
  const owner = xdr.ScVal.scvAddress(Address.fromString(pubKey).toScAddress())
  const spender = xdr.ScVal.scvAddress(Address.fromString(arkaId).toScAddress())
  const amount = nativeToScVal(
    typeof amountBaseUnits === 'number' ? BigInt(Math.trunc(amountBaseUnits)) : BigInt(amountBaseUnits as unknown as bigint),
    { type: 'i128' },
  )
  const expiration = nativeToScVal(expirationLedger, { type: 'u32' })

  const assembleApproveAndDeposit = async (approveArgs: xdr.ScVal[]): Promise<string> => {
    const built = new TransactionBuilder(source, { fee: '20000', networkPassphrase: TESTNET })
      .addOperation(token.call('approve', ...approveArgs))
      .addOperation(
        arka.call(
          'deposit',
          owner,
          xdr.ScVal.scvMap([
            new xdr.ScMapEntry({
              key: xdr.ScVal.scvSymbol('contract'),
              val: xdr.ScVal.scvAddress(Address.fromString(tokenContractId).toScAddress()),
            }),
          ]),
          amount,
        ),
      )
      .setTimeout(60)
      .build()
    let lastError: Error | null = null
    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        const sim = await server.simulateTransaction(built)
        if (rpc.Api.isSimulationError(sim)) {
          throw new Error(sim.error || 'Simulation failed')
        }
        const prepared = rpc.assembleTransaction(built, sim)
        return toB64Xdr(prepared)
      } catch (error) {
        lastError = error instanceof Error ? error : new Error('Simulation failed')
        if (attempt < 2) {
          await new Promise((resolve) => setTimeout(resolve, 1200 * (attempt + 1)))
        }
      }
    }
    throw lastError ?? new Error('Simulation failed')
  }

  try {
    return await assembleApproveAndDeposit([owner, spender, amount, expiration])
  } catch (standardError) {
    try {
      return await assembleApproveAndDeposit([owner, spender, amount])
    } catch {
      throw standardError
    }
  }
}

export async function buildSoroswapRouterSwapForPath(
  pubKey: string,
  routerId: string,
  pathAssets: string[],
  amountIn: number,
  minOut: number,
) {
  if (pathAssets.length < 2) throw new Error('SoroSwap path requires at least two assets')
  const server = createRpcServer()
  const source = await server.getAccount(pubKey)
  const router = new Contract(routerId)
  const path = xdr.ScVal.scvVec(
    pathAssets.map((asset) => xdr.ScVal.scvAddress(Address.fromString(asset).toScAddress())),
  )
  const deadline = Math.floor(Date.now() / 1000) + 1800

  const txBldr = new TransactionBuilder(source, { fee: '10000', networkPassphrase: TESTNET })
    .addOperation(
      router.call(
        'swap_exact_tokens_for_tokens',
        nativeToScVal(typeof amountIn === 'number' ? BigInt(Math.trunc(amountIn)) : BigInt(amountIn as unknown as bigint), { type: 'i128' }),
        nativeToScVal(typeof minOut === 'number' ? BigInt(Math.trunc(minOut)) : BigInt(minOut as unknown as bigint), { type: 'i128' }),
        path,
        xdr.ScVal.scvAddress(Address.fromString(pubKey).toScAddress()),
        nativeToScVal(deadline, { type: 'u64' }),
      ),
    )
    .setTimeout(60)
  const built = txBldr.build()
  const sim = await server.simulateTransaction(built)
  if (rpc.Api.isSimulationError(sim)) {
    throw new Error(describeSimulationFailure(sim, 'SoroSwap simulation failed'))
  }
  const prepared = rpc.assembleTransaction(built, sim)
  return toB64Xdr(prepared)
}

export async function buildSoroswapRouterSwap(
  pubKey: string,
  routerId: string,
  tokenIn: string,
  tokenOut: string,
  amountIn: number,
  minOut: number,
) {
  return buildSoroswapRouterSwapForPath(pubKey, routerId, [tokenIn, tokenOut], amountIn, minOut)
}

// Aquarius router: swap(manager, pool_id: u128, amount_in: i128, min_out: i128)
// Discover Aquarius pool index (BytesN<32>) for a token pair
export async function readAquariusPoolIndex(
  routerId: string,
  tokenA: string,
  tokenB: string,
  readerPubKey?: string,
): Promise<string | null> {
  const server = createRpcServer()
  const source = await server.getAccount(readerPubKey || SIM_ACCOUNT)
  const router = new Contract(routerId)
  const toHex = (u8: Uint8Array): string => Array.from(u8).map((b) => b.toString(16).padStart(2, '0')).join('')
  // Enforce Aquarius-required lexicographic order (ascending by contract address)
  const tSorted = tokenA < tokenB ? [tokenA, tokenB] as const : [tokenB, tokenA] as const
  try { console.debug('[Aquarius] discover pools for', tSorted[0], '->', tSorted[1]) } catch {}
  try {
    const tokensVec = xdr.ScVal.scvVec([
      xdr.ScVal.scvAddress(Address.fromString(tSorted[0]).toScAddress()),
      xdr.ScVal.scvAddress(Address.fromString(tSorted[1]).toScAddress()),
    ])
    const tx = new TransactionBuilder(source, { fee: '1000', networkPassphrase: TESTNET })
      .addOperation(router.call('get_pools', tokensVec))
      .setTimeout(30)
      .build()
    const sim = await server.simulateTransaction(tx)
    if (rpc.Api.isSimulationError(sim)) return null
    // Prefer canonical decode from results[0].xdr (works reliably in browser)
    let canonical: xdr.ScVal | null = null
    try {
      const res0 = (sim as unknown as { results?: { xdr?: string }[] }).results?.[0]?.xdr
      try { console.debug('[Aquarius] res0.xdr len', res0 ? res0.length : null) } catch {}
      if (res0) canonical = xdr.ScVal.fromXDR(res0, 'base64')
    } catch {}
    if (!canonical) {
      try {
        const retval = (sim as unknown as { result?: { retval?: xdr.ScVal } }).result?.retval
        if (retval) {
          const b64 = (retval as unknown as { toXDR?: (fmt: 'base64') => string }).toXDR?.('base64')
          canonical = b64 ? xdr.ScVal.fromXDR(b64, 'base64') : retval
        }
      } catch {}
    }
    if (!canonical) return null
    const scMap = canonical.map?.()
    try { console.debug('[Aquarius] map length', scMap ? scMap.length : null) } catch {}
    if (!scMap || scMap.length === 0) { try { console.debug('[Aquarius] map empty') } catch {}; return null }
    // Try decode any entry key to Bytes/BytesN
    // Generic scanner to locate a 32-byte buffer anywhere in an object tree
    const maybeMethodResult = (obj: unknown, methodName: string): unknown => {
      if (!obj || typeof obj !== 'object') return undefined
      const rec = obj as Record<string, unknown>
      const fn = rec[methodName]
      if (typeof fn !== 'function') return undefined
      try {
        return (fn as () => unknown)()
      } catch {
        return undefined
      }
    }
    const maybeProperty = (obj: unknown, propName: string): unknown => {
      if (!obj || typeof obj !== 'object') return undefined
      const rec = obj as Record<string, unknown>
      return rec[propName]
    }
    const findBytes32 = (obj: unknown, depth = 0): Uint8Array | null => {
      if (!obj || depth > 6) return null
      try { if (obj instanceof Uint8Array && obj.length === 32) return obj } catch {}
      try {
        const b = maybeMethodResult(obj, 'bytes')
        if (b instanceof Uint8Array && b.length === 32) return b
      } catch {}
      try {
        const bn = maybeMethodResult(obj, 'bytesN')
        if (bn instanceof Uint8Array && bn.length === 32) return bn
      } catch {}
      try {
        const v = maybeMethodResult(obj, 'value')
        const hit = findBytes32(v, depth + 1)
        if (hit) return hit
      } catch {}
      try {
        const inner = maybeProperty(obj, '_value')
        const hit = findBytes32(inner, depth + 1)
        if (hit) return hit
      } catch {}
      try {
        const attrs = maybeProperty(obj, '_attributes')
        const hit = findBytes32(attrs, depth + 1)
        if (hit) return hit
      } catch {}
      try {
        for (const k of Object.keys(obj as Record<string, unknown>)) {
          const value = (obj as Record<string, unknown>)[k]
          const hit = findBytes32(value, depth + 1)
          if (hit) return hit
        }
      } catch {}
      return null
    }
    for (let i = 0; i < scMap.length; i++) {
      const entry = scMap[i] as unknown as xdr.ScMapEntry
      /* eslint-disable @typescript-eslint/no-explicit-any */
      const anyEntry = entry as any
      let keyVal: xdr.ScVal | undefined = undefined
      try { keyVal = anyEntry.key?.() as xdr.ScVal } catch {}
      if (!keyVal) { try { keyVal = anyEntry.key as xdr.ScVal } catch {} }
      if (!keyVal) { try { keyVal = (anyEntry._attributes?.key) as xdr.ScVal } catch {} }
      if (!keyVal) continue
      let raw = findBytes32(keyVal)
      if (!raw) {
        try {
          const b64 = (keyVal as any).toXDR?.('base64'); if (b64) {
            const kd = xdr.ScVal.fromXDR(b64, 'base64'); raw = findBytes32(kd)
          }
        } catch {}
      }
      if (!raw) { raw = findBytes32(anyEntry) }
      /* eslint-enable @typescript-eslint/no-explicit-any */
      if (raw && raw.length === 32) {
        const hex = toHex(raw)
        try { console.debug('[Aquarius] pool_index hex', hex) } catch {}
        return hex
      }
    }
    try { console.debug('[Aquarius] failed to decode pool_index from map') } catch {}
    return null
  } catch {
    return null
  }
}

export async function buildAquariusRouterSwap(
  pubKey: string,
  aquariusRouterId: string,
  tokenIn: string,
  tokenOut: string,
  poolIndexHex32: string,
  amountIn: number,
  minOut: number,
) {
  const server = createRpcServer()
  const source = await server.getAccount(pubKey)
  const router = new Contract(aquariusRouterId)
  const [t1, t2] = tokenIn < tokenOut ? [tokenIn, tokenOut] : [tokenOut, tokenIn]
  const tokens = xdr.ScVal.scvVec([
    xdr.ScVal.scvAddress(Address.fromString(t1).toScAddress()),
    xdr.ScVal.scvAddress(Address.fromString(t2).toScAddress()),
  ])
  // Validate and encode pool_index as BytesN<32>
  const hex = (poolIndexHex32 || '').toLowerCase().replace(/^0x/, '')
  if (hex.length !== 64) throw new Error('Invalid Aquarius pool_index (expect 32-byte hex)')
  const raw = Buffer.from(hex, 'hex')
  // Prefer fixed-size BytesN for routers expecting BytesN<32>
  const poolIndex = toScValBytesOrBytesN(raw)
  // Sanity: tokenIn/tokenOut must be one of the sorted tokens
  if (!(tokenIn === t1 || tokenIn === t2)) throw new Error('token_in not in tokens')
  if (!(tokenOut === t1 || tokenOut === t2)) throw new Error('token_out not in tokens')
  const txBldr = new TransactionBuilder(source, { fee: '10000', networkPassphrase: TESTNET })
    .addOperation(
      router.call(
        'swap',
        xdr.ScVal.scvAddress(Address.fromString(pubKey).toScAddress()),
        tokens,
        xdr.ScVal.scvAddress(Address.fromString(tokenIn).toScAddress()),
        xdr.ScVal.scvAddress(Address.fromString(tokenOut).toScAddress()),
        poolIndex,
        nativeToScVal(typeof amountIn === 'number' ? BigInt(Math.trunc(amountIn)) : BigInt(amountIn as unknown as bigint), { type: 'u128' }),
        // Use u128 for min_out to match most Aquarius router builds
        nativeToScVal(typeof minOut === 'number' ? BigInt(Math.trunc(minOut)) : BigInt(minOut as unknown as bigint), { type: 'u128' }),
      ),
    )
    .setTimeout(60)
  const built = txBldr.build()
  try { console.debug('[Aquarius/build] xdr len', built.toXDR().length) } catch {}
  const sim = await server.simulateTransaction(built)
  if (rpc.Api.isSimulationError(sim)) {
    try { console.error('[Aquarius/build] sim error', JSON.stringify(sim)) } catch {}
    throw new Error(describeSimulationFailure(sim, 'Aquarius simulation failed'))
  }
  const prepared = rpc.assembleTransaction(built, sim)
  return toB64Xdr(prepared)
}

export async function buildSoroswapAdapterSwap(
  pubKey: string,
  adapterId: string,
  poolId: number,
  amountIn: number,
  minOut: number,
) {
  const server = createRpcServer()
  const source = await server.getAccount(pubKey)
  const adapter = new Contract(adapterId)
  const txBldr = new TransactionBuilder(source, { fee: '10000', networkPassphrase: TESTNET })
    .addOperation(
      adapter.call(
        'execute',
        xdr.ScVal.scvAddress(Address.fromString(pubKey).toScAddress()),
        nativeToScVal(typeof poolId === 'number' ? BigInt(Math.trunc(poolId)) : BigInt(poolId as unknown as bigint), { type: 'u128' }),
        nativeToScVal(typeof amountIn === 'number' ? BigInt(Math.trunc(amountIn)) : BigInt(amountIn as unknown as bigint), { type: 'i128' }),
        nativeToScVal(typeof minOut === 'number' ? BigInt(Math.trunc(minOut)) : BigInt(minOut as unknown as bigint), { type: 'i128' }),
        xdr.ScVal.scvAddress(Address.fromString(pubKey).toScAddress()),
      ),
    )
    .setTimeout(60)
  const built = txBldr.build()
  const sim = await server.simulateTransaction(built)
  if (rpc.Api.isSimulationError(sim)) {
    throw new Error(describeSimulationFailure(sim, 'SoroSwap adapter simulation failed'))
  }
  const prepared = rpc.assembleTransaction(built, sim)
  return toB64Xdr(prepared)
}

// Off-chain orchestrated SoroSwap rebalance: approve->swap->approve->deposit
export async function buildSoroswapOffchainRebalance(
  managerPubKey: string,
  arkaId: string,
  routerId: string,
  tokenIn: string,
  tokenOut: string,
  amountIn: number,
  minOut: number,
) {
  const server = createRpcServer()
  const source = await server.getAccount(managerPubKey)
  const router = new Contract(routerId)
  const tokenInC = new Contract(tokenIn)
  const tokenOutC = new Contract(tokenOut)
  const arka = new Contract(arkaId)
  const path = xdr.ScVal.scvVec([
    xdr.ScVal.scvAddress(Address.fromString(tokenIn).toScAddress()),
    xdr.ScVal.scvAddress(Address.fromString(tokenOut).toScAddress()),
  ])
  const deadline = Math.floor(Date.now() / 1000) + 1800

  const txBldr = new TransactionBuilder(source, { fee: '30000', networkPassphrase: TESTNET })
    // 1) Approve tokenIn -> router
    .addOperation(
      tokenInC.call(
        'approve',
        xdr.ScVal.scvAddress(Address.fromString(managerPubKey).toScAddress()),
        xdr.ScVal.scvAddress(Address.fromString(routerId).toScAddress()),
        nativeToScVal(typeof amountIn === 'number' ? BigInt(Math.trunc(amountIn)) : BigInt(amountIn as unknown as bigint), { type: 'i128' }),
        nativeToScVal(3000000, { type: 'u32' }),
      ),
    )
    // 2) Swap exact-in
    .addOperation(
      router.call(
        'swap_exact_tokens_for_tokens',
        nativeToScVal(typeof amountIn === 'number' ? BigInt(Math.trunc(amountIn)) : BigInt(amountIn as unknown as bigint), { type: 'i128' }),
        nativeToScVal(typeof minOut === 'number' ? BigInt(Math.trunc(minOut)) : BigInt(minOut as unknown as bigint), { type: 'i128' }),
        path,
        xdr.ScVal.scvAddress(Address.fromString(managerPubKey).toScAddress()),
        nativeToScVal(deadline, { type: 'u64' }),
      ),
    )
    // 3) Approve tokenOut -> Arka (for at least minOut)
    .addOperation(
      tokenOutC.call(
        'approve',
        xdr.ScVal.scvAddress(Address.fromString(managerPubKey).toScAddress()),
        xdr.ScVal.scvAddress(Address.fromString(arkaId).toScAddress()),
        nativeToScVal(typeof minOut === 'number' ? BigInt(Math.trunc(minOut)) : BigInt(minOut as unknown as bigint), { type: 'i128' }),
        nativeToScVal(3000000, { type: 'u32' }),
      ),
    )
    // 4) Deposit minOut to Arka (sweeps at least minOut back)
    .addOperation(
      arka.call(
        'deposit',
        xdr.ScVal.scvAddress(Address.fromString(managerPubKey).toScAddress()),
        xdr.ScVal.scvMap([
          new xdr.ScMapEntry({ key: xdr.ScVal.scvSymbol('contract'), val: xdr.ScVal.scvAddress(Address.fromString(tokenOut).toScAddress()) }),
        ]),
        nativeToScVal(typeof minOut === 'number' ? BigInt(Math.trunc(minOut)) : BigInt(minOut as unknown as bigint), { type: 'i128' }),
      ),
    )
    .setTimeout(120)

  const built = txBldr.build()
  const sim = await server.simulateTransaction(built)
  if (rpc.Api.isSimulationError(sim)) {
    throw new Error(describeSimulationFailure(sim, 'Off-chain rebalance simulation failed'))
  }
  const prepared = rpc.assembleTransaction(built, sim)
  return toB64Xdr(prepared)
}

// Arka interactions (deposit/redeem)
export async function buildArkaDeposit(
  pubKey: string,
  arkaId: string,
  assetContract: string,
  amountBase: number,
) {
  const server = createRpcServer()
  const source = await server.getAccount(pubKey)
  const arka = new Contract(arkaId)
  const txBldr = new TransactionBuilder(source, { fee: '20000', networkPassphrase: TESTNET })
    .addOperation(
      arka.call(
        'deposit',
        xdr.ScVal.scvAddress(Address.fromString(pubKey).toScAddress()),
        xdr.ScVal.scvMap([
          new xdr.ScMapEntry({ key: xdr.ScVal.scvSymbol('contract'), val: xdr.ScVal.scvAddress(Address.fromString(assetContract).toScAddress()) }),
        ]),
        nativeToScVal(typeof amountBase === 'number' ? BigInt(Math.trunc(amountBase)) : BigInt(amountBase as unknown as bigint), { type: 'i128' }),
      ),
    )
    .setTimeout(60)
  const built = txBldr.build()
  const sim = await server.simulateTransaction(built)
  if (rpc.Api.isSimulationError(sim)) {
    throw new Error(describeSimulationFailure(sim, 'Deposit simulation failed'))
  }
  const prepared = rpc.assembleTransaction(built, sim)
  return toB64Xdr(prepared)
}

export async function buildArkaRedeem(
  pubKey: string,
  arkaId: string,
  sharesBase: number,
) {
  const server = createRpcServer()
  const source = await server.getAccount(pubKey)
  const arka = new Contract(arkaId)
  const txBldr = new TransactionBuilder(source, { fee: '20000', networkPassphrase: TESTNET })
    .addOperation(
      arka.call('redeem', xdr.ScVal.scvAddress(Address.fromString(pubKey).toScAddress()), nativeToScVal(typeof sharesBase === 'number' ? BigInt(Math.trunc(sharesBase)) : BigInt(sharesBase as unknown as bigint), { type: 'i128' })),
    )
    .setTimeout(60)
  const built = txBldr.build()
  const sim = await server.simulateTransaction(built)
  if (rpc.Api.isSimulationError(sim)) {
    throw new Error(describeSimulationFailure(sim, 'Redeem simulation failed'))
  }
  const prepared = rpc.assembleTransaction(built, sim)
  return toB64Xdr(prepared)
}

export type CreditProtocol = 'Blend'

export type CreditPositionAction = 'Supply' | 'Borrow' | 'Repay' | 'Withdraw'

export type ArkaCreditMarketConfig = {
  protocol: CreditProtocol
  market_id: number
  adapter: string
  allow_supply: boolean
  allow_borrow: boolean
  allow_repay: boolean
  allow_withdraw: boolean
  enabled: boolean
}

export type ArkaCreditBorrowPolicy = {
  protocol: CreditProtocol
  market_id: number
  asset: string
  max_borrow_per_action: number
  max_debt_for_asset: number
  enabled: boolean
}

export type ArkaCreditMarketRiskSource = {
  market_id: number
  pool_factory: string
}

function creditProtocolScVal(protocol: CreditProtocol): xdr.ScVal {
  return xdr.ScVal.scvVec([xdr.ScVal.scvSymbol(protocol)])
}

function creditPositionMethod(action: CreditPositionAction): string {
  switch (action) {
    case 'Supply':
      return 'credit_supply'
    case 'Borrow':
      return 'credit_borrow'
    case 'Repay':
      return 'credit_repay'
    case 'Withdraw':
      return 'credit_withdraw'
  }
}

export async function buildArkaCreditAction(
  pubKey: string,
  arkaId: string,
  protocol: CreditProtocol,
  action: CreditPositionAction,
  marketId: number,
  assetContract: string,
  amountBase: number,
) {
  const market = await readArkaCreditMarketConfig(arkaId,protocol,marketId,pubKey)
  if(!market||!market.enabled)throw new Error('The credit market is not available for this Arka.')
  const fingerprint=JSON.stringify(market,(_,v)=>typeof v==='bigint'?v.toString():v)
  const read = async () => {
    const current=await readArkaCreditMarketConfig(arkaId,protocol,marketId,pubKey)
    if(JSON.stringify(current,(_,v)=>typeof v==='bigint'?v.toString():v)!==fingerprint)throw new Error('Credit market configuration changed. Review again.')
    return readVenueSnapshot(arkaId,market.adapter,pubKey)
  }
  const before=await read(),venueAction=action.toLowerCase() as 'supply'|'borrow'|'withdraw'|'repay'
  if(!protocolVenueAllowed('BLEND',before,venueAction,TESTNET))throw new Error('This protocol does not allow the selected credit action.')
  const unsigned = await buildContractInvokeTx(pubKey, arkaId, creditPositionMethod(action), [
    xdr.ScVal.scvAddress(Address.fromString(pubKey).toScAddress()),
    creditProtocolScVal(protocol),
    nativeToScVal(BigInt(Math.trunc(marketId)), { type: 'u128' }),
    xdr.ScVal.scvAddress(Address.fromString(assetContract).toScAddress()),
    nativeToScVal(BigInt(Math.trunc(amountBase)), { type: 'i128' }),
  ])
  rememberProtocolReview(unsigned,[{protocol:'BLEND',action:venueAction,before,read}])
  return unsigned
}

function scValToI128Number(retval: xdr.ScVal | null | undefined): number {
  if (!retval) return 0
  const i128 = retval.i128?.()
  if (!i128) return 0
  const lo = i128.lo()
  return Number(lo ? lo.toString() : '0')
}

function scValToU128Number(retval: xdr.ScVal | null | undefined): number {
  if (!retval) return 0
  const u128 = retval.u128?.()
  if (!u128) return 0
  const lo = u128.lo()
  return Number(lo ? lo.toString() : '0')
}

function scValToUnsignedNumber(retval: xdr.ScVal | null | undefined): number {
  if (!retval) return 0
  try {
    const u32 = retval.u32?.()
    if (u32 !== undefined) return Number(u32)
  } catch {}
  try {
    const u64 = retval.u64?.()
    if (u64) return Number(u64.toString())
  } catch {}
  return scValToU128Number(retval)
}

function scValToBool(retval: xdr.ScVal | null | undefined): boolean {
  if (!retval) return false
  try {
    const value = retval.b()
    if (typeof value === 'boolean') return value
  } catch {}
  return false
}

function scValToAddressString(retval: xdr.ScVal | null | undefined): string | null {
  if (!retval || retval.switch().name !== 'scvAddress') return null
  return Address.fromScAddress(retval.address()).toString()
}

export async function readArkaManager(arkaId: string, readerPubKey?: string): Promise<string> {
  const server = createRpcServer()
  const source = await server.getAccount(readerPubKey || SIM_ACCOUNT)
  const arka = new Contract(arkaId)
  const tx = new TransactionBuilder(source, { fee: '1000', networkPassphrase: TESTNET })
    .addOperation(arka.call('manager'))
    .setTimeout(30)
    .build()
  const sim = await server.simulateTransaction(tx)
  if (rpc.Api.isSimulationError(sim)) throw new Error('Simulation failed')
  const retval = (sim as unknown as { result?: { retval?: xdr.ScVal } }).result?.retval
  if (!retval) throw new Error('No retval')
  // scvAddress → scAddress → Address string
  const scAddr = (retval as xdr.ScVal).address()
  const addr = Address.fromScAddress(scAddr).toString()
  return addr
}

export async function readArkaRouter(arkaId: string, readerPubKey?: string): Promise<string> {
  const server = createRpcServer()
  const source = await server.getAccount(readerPubKey || SIM_ACCOUNT)
  const arka = new Contract(arkaId)
  const tx = new TransactionBuilder(source, { fee: '1000', networkPassphrase: TESTNET })
    .addOperation(arka.call('router'))
    .setTimeout(30)
    .build()
  const sim = await server.simulateTransaction(tx)
  if (rpc.Api.isSimulationError(sim)) throw new Error('Simulation failed')
  const retval = (sim as unknown as { result?: { retval?: xdr.ScVal } }).result?.retval
  if (!retval) throw new Error('No retval')
  const scAddr = (retval as xdr.ScVal).address()
  return Address.fromScAddress(scAddr).toString()
}

export async function readArkaDenomination(arkaId: string, readerPubKey?: string): Promise<string> {
  const server = createRpcServer()
  const source = await server.getAccount(readerPubKey || SIM_ACCOUNT)
  const arka = new Contract(arkaId)
  const tx = new TransactionBuilder(source, { fee: '1000', networkPassphrase: TESTNET })
    .addOperation(arka.call('denomination'))
    .setTimeout(30)
    .build()
  const sim = await server.simulateTransaction(tx)
  if (rpc.Api.isSimulationError(sim)) throw new Error('Simulation failed')
  const retval = (sim as unknown as { result?: { retval?: xdr.ScVal } }).result?.retval
  const parsed = parseAssetContract(retval) ?? scValToAddressString(retval)
  if (!parsed) throw new Error('No denomination retval')
  return parsed
}

export async function readArkaShareToken(arkaId: string, readerPubKey?: string): Promise<string | null> {
  const server = createRpcServer()
  const source = await server.getAccount(readerPubKey || SIM_ACCOUNT)
  const arka = new Contract(arkaId)
  const tx = new TransactionBuilder(source, { fee: '1000', networkPassphrase: TESTNET })
    .addOperation(arka.call('share_token'))
    .setTimeout(30)
    .build()
  const sim = await server.simulateTransaction(tx)
  if (rpc.Api.isSimulationError(sim)) return null
  const retval = (sim as unknown as { result?: { retval?: xdr.ScVal } }).result?.retval
  if (!retval || retval.switch().name !== 'scvAddress') return null
  return Address.fromScAddress(retval.address()).toString()
}

export async function readArkaShares(arkaId: string, readerPubKey: string, wallet: string): Promise<number> {
  const server = createRpcServer()
  const source = await server.getAccount(readerPubKey)
  const arka = new Contract(arkaId)
  const tx = new TransactionBuilder(source, { fee: '1000', networkPassphrase: TESTNET })
    .addOperation(arka.call('shares_of', xdr.ScVal.scvAddress(Address.fromString(wallet).toScAddress())))
    .setTimeout(30)
    .build()
  const sim = await server.simulateTransaction(tx)
  if (rpc.Api.isSimulationError(sim)) throw new Error('Simulation failed')
  const retval = (sim as unknown as { result?: { retval?: xdr.ScVal } }).result?.retval
  if (!retval || retval.switch().name !== 'scvI128') throw new Error('Ownership unavailable: no valid shares result')
  const shares = sdkScValToNative(retval) as bigint
  if (shares < BigInt(0) || shares > BigInt(Number.MAX_SAFE_INTEGER)) throw new Error('Ownership unavailable: unsafe shares value')
  return Number(shares)
}

export async function readArkaTotalShares(
  arkaId: string,
  readerPubKey?: string,
): Promise<number | null> {
  try {
    return scValToI128Number(
      await simulateReadonly(arkaId, 'total_shares', [], readerPubKey),
    )
  } catch {
    // Existing Arkas do not expose this getter until their WASM is upgraded.
    return null
  }
}

export async function readArkaNav(arkaId: string, readerPubKey?: string): Promise<number> {
  const result = await simulateReadonlyDiagnostic(arkaId, 'nav', [], readerPubKey)
  if (result.error || !result.retval || result.retval.switch().name !== 'scvI128') {
    throw new Error(`Arka NAV unavailable: ${result.error || 'no valid i128 result'}`)
  }
  const value = sdkScValToNative(result.retval) as bigint
  if (value < BigInt(0) || value > BigInt(Number.MAX_SAFE_INTEGER)) {
    throw new Error('Arka NAV unavailable: value cannot be represented safely')
  }
  return Number(value)
}

export async function readArkaLiquidBalance(arkaId: string, asset: string, readerPubKey?: string): Promise<number> {
  const result = await simulateReadonlyDiagnostic(
    arkaId,
    'liquid_balance',
    [xdr.ScVal.scvAddress(Address.fromString(asset).toScAddress())],
    readerPubKey,
  )
  if (result.error || !result.retval || result.retval.switch().name !== 'scvI128') {
    throw new Error(`Fund cash unavailable: ${result.error || 'no valid i128 result'}`)
  }
  const value = sdkScValToNative(result.retval) as bigint
  if (value < BigInt(0) || value > BigInt(Number.MAX_SAFE_INTEGER)) throw new Error('Fund cash unavailable: unsafe value')
  return Number(value)
}

function parseAssetContract(retval: xdr.ScVal | null | undefined): string | null {
  const maybeMap = parseMapEntries(retval)
  if (maybeMap.length === 0) return null
  for (const entry of maybeMap) {
    const symbol = entry.key().sym?.()?.toString?.() ?? ''
    if (symbol === 'contract') {
      return scValToAddressString(entry.val())
    }
  }
  return null
}

export async function readArkaWhitelist(arkaId: string, readerPubKey?: string): Promise<string[]> {
  const retval = await simulateReadonly(arkaId, 'whitelist', [], readerPubKey)
  const items = retval?.vec?.() ?? []
  const assets: string[] = []
  for (const item of items) {
    const maybeAddress = parseAssetContract(item) ?? scValToAddressString(item)
    if (maybeAddress) assets.push(maybeAddress)
  }
  return assets
}

export type ArkaCreditPosition = {
  market_id: number
  asset: string
  collateral_amount: number
  debt_amount: number
}

export type ArkaCreditPositionValue = {
  market_id: number
  asset: string
  collateral_shares: number
  collateral_amount: number
  collateral_value: number
  debt_shares: number
  debt_amount: number
  debt_value: number
  net_value: number
  price: number
  health_factor: number
  c_factor: number
  oracle_timestamp: number
}

export type ArkaCreditMarketValue = {
  market_id: number
  collateral_value: number
  debt_value: number
  net_value: number
  health_factor: number
  oracle_timestamp: number
}

export type ArkaCreditRiskPolicy = {
  market_id: number
  max_oracle_age: number
  min_health_factor: number
  fail_close_nav: boolean
  fail_close_actions: boolean
}

export type ArkaCreditMarketStatus = {
  market_id: number
  has_live_pricing: boolean
  has_stale_oracle: boolean
  has_invalid_oracle_data: boolean
  has_future_oracle_timestamp: boolean
  has_disabled_reserve: boolean
  oracle_age: number
  max_oracle_age: number
  min_health_factor: number
  health_factor: number
  debt_value: number
  pool_status: number
  risky_actions_blocked: boolean
  nav_blocked: boolean
}

function parseCreditProtocol(retval: xdr.ScVal | null | undefined): CreditProtocol | null {
  const items = retval?.vec?.() ?? []
  const first = items[0]
  const sym = first?.sym?.()?.toString?.() ?? ''
  if (sym === 'Blend') return 'Blend'
  return null
}

function parseMapEntries(retval: xdr.ScVal | null | undefined): xdr.ScMapEntry[] {
  const maybeMap = retval?.map?.()
  return maybeMap ? [...maybeMap] : []
}

function parseCreditPositionMap(retval: xdr.ScVal | null | undefined): ArkaCreditPosition | null {
  const maybeMap = parseMapEntries(retval)
  if (maybeMap.length === 0) return null

  let parsedMarketId = 0
  let parsedAsset = ''
  let parsedCollateral = 0
  let parsedDebt = 0

  for (const entry of maybeMap) {
    const key = entry.key()
    const value = entry.val()
    const symbol = key.sym?.()?.toString?.() ?? ''
    if (symbol === 'market_id') parsedMarketId = scValToU128Number(value)
    if (symbol === 'asset') parsedAsset = scValToAddressString(value) ?? ''
    if (symbol === 'collateral_amount') parsedCollateral = scValToI128Number(value)
    if (symbol === 'debt_amount') parsedDebt = scValToI128Number(value)
  }

  if (!parsedAsset) return null
  return {
    market_id: parsedMarketId,
    asset: parsedAsset,
    collateral_amount: parsedCollateral,
    debt_amount: parsedDebt,
  }
}

function parseVerifiedCreditDebt(value: xdr.ScVal): number {
  if (value.switch().name !== 'scvI128') return Number.NaN
  const amount = sdkScValToNative(value) as bigint
  return amount >= BigInt(0) && amount <= BigInt(Number.MAX_SAFE_INTEGER) ? Number(amount) : Number.NaN
}

function parseCreditPositionValueMap(retval: xdr.ScVal | null | undefined): ArkaCreditPositionValue | null {
  const maybeMap = parseMapEntries(retval)
  if (maybeMap.length === 0) return null

  const parsed: ArkaCreditPositionValue = {
    market_id: 0,
    asset: '',
    collateral_shares: 0,
    collateral_amount: 0,
    collateral_value: 0,
    debt_shares: Number.NaN,
    debt_amount: Number.NaN,
    debt_value: Number.NaN,
    net_value: 0,
    price: 0,
    health_factor: 0,
    c_factor: 0,
    oracle_timestamp: 0,
  }

  for (const entry of maybeMap) {
    const key = entry.key()
    const value = entry.val()
    const symbol = key.sym?.()?.toString?.() ?? ''
    if (symbol === 'market_id') parsed.market_id = scValToU128Number(value)
    if (symbol === 'asset') parsed.asset = scValToAddressString(value) ?? ''
    if (symbol === 'collateral_shares') parsed.collateral_shares = scValToI128Number(value)
    if (symbol === 'collateral_amount') parsed.collateral_amount = scValToI128Number(value)
    if (symbol === 'collateral_value') parsed.collateral_value = scValToI128Number(value)
    if (symbol === 'debt_shares') parsed.debt_shares = parseVerifiedCreditDebt(value)
    if (symbol === 'debt_amount') parsed.debt_amount = parseVerifiedCreditDebt(value)
    if (symbol === 'debt_value') parsed.debt_value = parseVerifiedCreditDebt(value)
    if (symbol === 'net_value') parsed.net_value = scValToI128Number(value)
    if (symbol === 'price') parsed.price = scValToI128Number(value)
    if (symbol === 'health_factor') parsed.health_factor = scValToI128Number(value)
    if (symbol === 'c_factor') parsed.c_factor = scValToUnsignedNumber(value)
    if (symbol === 'oracle_timestamp') parsed.oracle_timestamp = scValToUnsignedNumber(value)
  }

  return parsed.asset && [parsed.debt_shares, parsed.debt_amount, parsed.debt_value].every(Number.isSafeInteger) ? parsed : null
}

function parseCreditMarketValueMap(retval: xdr.ScVal | null | undefined): ArkaCreditMarketValue | null {
  const maybeMap = parseMapEntries(retval)
  if (maybeMap.length === 0) return null

  const parsed: ArkaCreditMarketValue = {
    market_id: 0,
    collateral_value: 0,
    debt_value: 0,
    net_value: 0,
    health_factor: 0,
    oracle_timestamp: 0,
  }

  for (const entry of maybeMap) {
    const key = entry.key()
    const value = entry.val()
    const symbol = key.sym?.()?.toString?.() ?? ''
    if (symbol === 'market_id') parsed.market_id = scValToU128Number(value)
    if (symbol === 'collateral_value') parsed.collateral_value = scValToI128Number(value)
    if (symbol === 'debt_value') parsed.debt_value = scValToI128Number(value)
    if (symbol === 'net_value') parsed.net_value = scValToI128Number(value)
    if (symbol === 'health_factor') parsed.health_factor = scValToI128Number(value)
    if (symbol === 'oracle_timestamp') parsed.oracle_timestamp = scValToUnsignedNumber(value)
  }

  return parsed
}

function parseCreditRiskPolicyMap(retval: xdr.ScVal | null | undefined): ArkaCreditRiskPolicy | null {
  const maybeMap = parseMapEntries(retval)
  if (maybeMap.length === 0) return null

  const parsed: ArkaCreditRiskPolicy = {
    market_id: 0,
    max_oracle_age: 0,
    min_health_factor: 0,
    fail_close_nav: false,
    fail_close_actions: false,
  }

  for (const entry of maybeMap) {
    const key = entry.key()
    const value = entry.val()
    const symbol = key.sym?.()?.toString?.() ?? ''
    if (symbol === 'market_id') parsed.market_id = scValToU128Number(value)
    if (symbol === 'max_oracle_age') parsed.max_oracle_age = scValToUnsignedNumber(value)
    if (symbol === 'min_health_factor') parsed.min_health_factor = scValToI128Number(value)
    if (symbol === 'fail_close_nav') parsed.fail_close_nav = scValToBool(value)
    if (symbol === 'fail_close_actions') parsed.fail_close_actions = scValToBool(value)
  }

  return parsed
}

function parseCreditMarketStatusMap(retval: xdr.ScVal | null | undefined): ArkaCreditMarketStatus | null {
  const maybeMap = parseMapEntries(retval)
  if (maybeMap.length === 0) return null
  if (['risky_actions_blocked', 'nav_blocked'].some((name) =>
    maybeMap.find((entry) => entry.key().sym()?.toString() === name)?.val().switch().name !== 'scvBool',
  )) return null

  const parsed: ArkaCreditMarketStatus = {
    market_id: 0,
    has_live_pricing: false,
    has_stale_oracle: false,
    has_invalid_oracle_data: false,
    has_future_oracle_timestamp: false,
    has_disabled_reserve: false,
    oracle_age: 0,
    max_oracle_age: 0,
    min_health_factor: 0,
    health_factor: 0,
    debt_value: Number.NaN,
    pool_status: 0,
    risky_actions_blocked: false,
    nav_blocked: false,
  }

  for (const entry of maybeMap) {
    const key = entry.key()
    const value = entry.val()
    const symbol = key.sym?.()?.toString?.() ?? ''
    if (symbol === 'market_id') parsed.market_id = scValToU128Number(value)
    if (symbol === 'has_live_pricing') parsed.has_live_pricing = scValToBool(value)
    if (symbol === 'has_stale_oracle') parsed.has_stale_oracle = scValToBool(value)
    if (symbol === 'has_invalid_oracle_data') parsed.has_invalid_oracle_data = scValToBool(value)
    if (symbol === 'has_future_oracle_timestamp') parsed.has_future_oracle_timestamp = scValToBool(value)
    if (symbol === 'has_disabled_reserve') parsed.has_disabled_reserve = scValToBool(value)
    if (symbol === 'oracle_age') parsed.oracle_age = scValToUnsignedNumber(value)
    if (symbol === 'max_oracle_age') parsed.max_oracle_age = scValToUnsignedNumber(value)
    if (symbol === 'min_health_factor') parsed.min_health_factor = scValToI128Number(value)
    if (symbol === 'health_factor') parsed.health_factor = scValToI128Number(value)
    if (symbol === 'debt_value') parsed.debt_value = parseVerifiedCreditDebt(value)
    if (symbol === 'pool_status') parsed.pool_status = scValToUnsignedNumber(value)
    if (symbol === 'risky_actions_blocked') parsed.risky_actions_blocked = scValToBool(value)
    if (symbol === 'nav_blocked') parsed.nav_blocked = scValToBool(value)
  }

  return Number.isSafeInteger(parsed.debt_value) ? parsed : null
}

function parseCreditMarketConfigMap(retval: xdr.ScVal | null | undefined): ArkaCreditMarketConfig | null {
  const maybeMap = parseMapEntries(retval)
  if (maybeMap.length === 0) return null

  const parsed: ArkaCreditMarketConfig = {
    protocol: 'Blend',
    market_id: 0,
    adapter: '',
    allow_supply: false,
    allow_borrow: false,
    allow_repay: false,
    allow_withdraw: false,
    enabled: false,
  }

  for (const entry of maybeMap) {
    const key = entry.key()
    const value = entry.val()
    const symbol = key.sym?.()?.toString?.() ?? ''
    if (symbol === 'protocol') parsed.protocol = parseCreditProtocol(value) ?? 'Blend'
    if (symbol === 'market_id') parsed.market_id = scValToU128Number(value)
    if (symbol === 'adapter') parsed.adapter = scValToAddressString(value) ?? ''
    if (symbol === 'allow_supply') parsed.allow_supply = scValToBool(value)
    if (symbol === 'allow_borrow') parsed.allow_borrow = scValToBool(value)
    if (symbol === 'allow_repay') parsed.allow_repay = scValToBool(value)
    if (symbol === 'allow_withdraw') parsed.allow_withdraw = scValToBool(value)
    if (symbol === 'enabled') parsed.enabled = scValToBool(value)
  }

  return parsed.adapter ? parsed : null
}

function parseCreditBorrowPolicyMap(retval: xdr.ScVal | null | undefined): ArkaCreditBorrowPolicy | null {
  const maybeMap = parseMapEntries(retval)
  if (maybeMap.length === 0) return null

  const parsed: ArkaCreditBorrowPolicy = {
    protocol: 'Blend',
    market_id: 0,
    asset: '',
    max_borrow_per_action: 0,
    max_debt_for_asset: 0,
    enabled: false,
  }

  for (const entry of maybeMap) {
    const key = entry.key()
    const value = entry.val()
    const symbol = key.sym?.()?.toString?.() ?? ''
    if (symbol === 'protocol') parsed.protocol = parseCreditProtocol(value) ?? 'Blend'
    if (symbol === 'market_id') parsed.market_id = scValToU128Number(value)
    if (symbol === 'asset') parsed.asset = scValToAddressString(value) ?? ''
    if (symbol === 'max_borrow_per_action') parsed.max_borrow_per_action = scValToI128Number(value)
    if (symbol === 'max_debt_for_asset') parsed.max_debt_for_asset = scValToI128Number(value)
    if (symbol === 'enabled') parsed.enabled = scValToBool(value)
  }

  return parsed.asset ? parsed : null
}

function parseCreditMarketRiskSourceMap(retval: xdr.ScVal | null | undefined): ArkaCreditMarketRiskSource | null {
  const maybeMap = parseMapEntries(retval)
  if (maybeMap.length === 0) return null

  const parsed: ArkaCreditMarketRiskSource = {
    market_id: 0,
    pool_factory: '',
  }

  for (const entry of maybeMap) {
    const key = entry.key()
    const value = entry.val()
    const symbol = key.sym?.()?.toString?.() ?? ''
    if (symbol === 'market_id') parsed.market_id = scValToU128Number(value)
    if (symbol === 'pool_factory') parsed.pool_factory = scValToAddressString(value) ?? ''
  }

  return parsed.pool_factory ? parsed : null
}

export async function readArkaCreditProtocols(arkaId: string, readerPubKey?: string): Promise<CreditProtocol[]> {
  const retval = await simulateReadonly(arkaId, 'credit_protocols', [], readerPubKey)
  const items = retval?.vec?.() ?? []
  return items
    .map((item) => parseCreditProtocol(item))
    .filter((item): item is CreditProtocol => Boolean(item))
}

export async function readArkaCreditMarketConfig(
  arkaId: string,
  protocol: CreditProtocol,
  marketId: number,
  readerPubKey?: string,
): Promise<ArkaCreditMarketConfig | null> {
  const retval = await simulateReadonly(
    arkaId,
    'credit_market_config',
    [creditProtocolScVal(protocol), nativeToScVal(BigInt(Math.trunc(marketId)), { type: 'u128' })],
    readerPubKey,
  )
  return parseCreditMarketConfigMap(retval)
}

export async function readArkaCreditMarketConfigs(
  arkaId: string,
  protocol: CreditProtocol,
  readerPubKey?: string,
): Promise<ArkaCreditMarketConfig[]> {
  const retval = await simulateReadonly(
    arkaId,
    'credit_market_configs',
    [creditProtocolScVal(protocol)],
    readerPubKey,
  )
  const items = retval?.vec?.() ?? []
  return items
    .map((item) => parseCreditMarketConfigMap(item))
    .filter((item): item is ArkaCreditMarketConfig => Boolean(item))
}

export async function readArkaCreditBorrowPolicy(
  arkaId: string,
  protocol: CreditProtocol,
  marketId: number,
  asset: string,
  readerPubKey?: string,
): Promise<ArkaCreditBorrowPolicy | null> {
  const retval = await simulateReadonly(
    arkaId,
    'credit_borrow_policy',
    [
      creditProtocolScVal(protocol),
      nativeToScVal(BigInt(Math.trunc(marketId)), { type: 'u128' }),
      xdr.ScVal.scvAddress(Address.fromString(asset).toScAddress()),
    ],
    readerPubKey,
  )
  return parseCreditBorrowPolicyMap(retval)
}

export async function readArkaCreditMarketRiskSource(
  arkaId: string,
  marketId: number,
  readerPubKey?: string,
): Promise<ArkaCreditMarketRiskSource | null> {
  const retval = await simulateReadonly(
    arkaId,
    'blend_v2_risk_source',
    [nativeToScVal(BigInt(Math.trunc(marketId)), { type: 'u128' })],
    readerPubKey,
  )
  return parseCreditMarketRiskSourceMap(retval)
}

export async function readArkaCreditPosition(
  arkaId: string,
  protocol: CreditProtocol,
  marketId: number,
  asset: string,
  readerPubKey?: string,
): Promise<ArkaCreditPosition | null> {
  const retval = await simulateReadonly(
    arkaId,
    'credit_position',
    [
      creditProtocolScVal(protocol),
      nativeToScVal(BigInt(Math.trunc(marketId)), { type: 'u128' }),
      xdr.ScVal.scvAddress(Address.fromString(asset).toScAddress()),
    ],
    readerPubKey,
  )
  return parseCreditPositionMap(retval)
}

export async function readArkaCreditPositions(
  arkaId: string,
  protocol: CreditProtocol,
  marketId: number,
  readerPubKey?: string,
): Promise<ArkaCreditPosition[]> {
  const retval = await simulateReadonly(
    arkaId,
    'credit_positions',
    [creditProtocolScVal(protocol), nativeToScVal(BigInt(Math.trunc(marketId)), { type: 'u128' })],
    readerPubKey,
  )
  const items = retval?.vec?.() ?? []
  return items
    .map((item) => parseCreditPositionMap(item))
    .filter((item): item is ArkaCreditPosition => Boolean(item))
}

export async function readArkaCreditPositionValue(
  arkaId: string,
  protocol: CreditProtocol,
  marketId: number,
  asset: string,
  readerPubKey?: string,
): Promise<ArkaCreditPositionValue | null> {
  const retval = await simulateReadonly(
    arkaId,
    'credit_position_value',
    [
      creditProtocolScVal(protocol),
      nativeToScVal(BigInt(Math.trunc(marketId)), { type: 'u128' }),
      xdr.ScVal.scvAddress(Address.fromString(asset).toScAddress()),
    ],
    readerPubKey,
  )
  return parseCreditPositionValueMap(retval)
}

export async function readArkaCreditPositionValues(
  arkaId: string,
  protocol: CreditProtocol,
  marketId: number,
  readerPubKey?: string,
): Promise<ArkaCreditPositionValue[]> {
  const retval = await simulateReadonly(
    arkaId,
    'credit_position_values',
    [creditProtocolScVal(protocol), nativeToScVal(BigInt(Math.trunc(marketId)), { type: 'u128' })],
    readerPubKey,
  )
  if (!retval || retval.switch().name !== 'scvVec') throw new Error('Blend position unavailable: no valid position result')
  const items = retval.vec() ?? []
  if (items.some((item) => item.switch().name !== 'scvMap')) throw new Error('Blend position unavailable: incomplete position result')
  const positions = items.map((item) => parseCreditPositionValueMap(item))
  if (positions.some((item) => !item)) throw new Error('Blend position unavailable: incomplete position result')
  return positions as ArkaCreditPositionValue[]
}

export async function readArkaCreditMarketValue(
  arkaId: string,
  protocol: CreditProtocol,
  marketId: number,
  readerPubKey?: string,
): Promise<ArkaCreditMarketValue | null> {
  const retval = await simulateReadonly(
    arkaId,
    'credit_market_value',
    [creditProtocolScVal(protocol), nativeToScVal(BigInt(Math.trunc(marketId)), { type: 'u128' })],
    readerPubKey,
  )
  return parseCreditMarketValueMap(retval)
}

export async function readArkaCreditMarketAssets(
  arkaId: string,
  protocol: CreditProtocol,
  marketId: number,
  readerPubKey?: string,
): Promise<string[]> {
  const retval = await simulateReadonly(
    arkaId,
    'credit_market_assets',
    [creditProtocolScVal(protocol), nativeToScVal(BigInt(Math.trunc(marketId)), { type: 'u128' })],
    readerPubKey,
  )
  const items = retval?.vec?.() ?? []
  return items
    .map((item) => scValToAddressString(item))
    .filter((item): item is string => Boolean(item))
}

export async function readArkaCreditRiskPolicy(
  arkaId: string,
  protocol: CreditProtocol,
  marketId: number,
  readerPubKey?: string,
): Promise<ArkaCreditRiskPolicy | null> {
  const retval = await simulateReadonly(
    arkaId,
    'credit_risk_policy',
    [creditProtocolScVal(protocol), nativeToScVal(BigInt(Math.trunc(marketId)), { type: 'u128' })],
    readerPubKey,
  )
  return parseCreditRiskPolicyMap(retval)
}

export async function readArkaCreditMarketStatus(
  arkaId: string,
  protocol: CreditProtocol,
  marketId: number,
  readerPubKey?: string,
): Promise<ArkaCreditMarketStatus | null> {
  const retval = await simulateReadonly(
    arkaId,
    'credit_market_status',
    [creditProtocolScVal(protocol), nativeToScVal(BigInt(Math.trunc(marketId)), { type: 'u128' })],
    readerPubKey,
  )
  return parseCreditMarketStatusMap(retval)
}

export async function readBlendMarketAsset(
  adapterId: string,
  marketId: number,
  readerPubKey?: string,
): Promise<string | null> {
  const retval = await simulateReadonly(
    adapterId,
    'market_asset',
    [nativeToScVal(BigInt(Math.trunc(marketId)), { type: 'u128' })],
    readerPubKey,
  )
  if (!retval) return null
  const configured = retval.address?.()
  if (configured) return Address.fromScAddress(configured).toString()
  return scValToAddressString(retval)
}

export async function readBlendSupportedAssets(
  adapterId: string,
  candidateAssets: string[],
  readerPubKey?: string,
): Promise<string[]> {
  const router = await readAdapterRouter(adapterId, readerPubKey)
  if (!router) throw new Error('Blend pool is unavailable')

  const uniqueCandidates = candidateAssets.filter(
    (asset, index, assets) => Boolean(asset) && assets.indexOf(asset) === index,
  )
  const supported = await Promise.all(
    uniqueCandidates.map(async (asset) => {
      const { retval, error } = await simulateReadonlyDiagnostic(
        router,
        'get_reserve',
        [xdr.ScVal.scvAddress(Address.fromString(asset).toScAddress())],
        readerPubKey,
      )
      return !error && retval ? asset : null
    }),
  )
  return supported.filter((asset): asset is string => Boolean(asset))
}

// Read SAC token balance for a holder (address string)
export async function readTokenBalance(tokenId: string, holderAddress: string, readerPubKey?: string): Promise<number> {
  const server = createRpcServer()
  const source = await server.getAccount(readerPubKey || SIM_ACCOUNT)
  const token = new Contract(tokenId)
  const tx = new TransactionBuilder(source, { fee: '1000', networkPassphrase: TESTNET })
    .addOperation(token.call('balance', xdr.ScVal.scvAddress(Address.fromString(holderAddress).toScAddress())))
    .setTimeout(30)
    .build()
  const sim = await server.simulateTransaction(tx)
  if (rpc.Api.isSimulationError(sim)) return 0
  const retval = (sim as unknown as { result?: { retval?: xdr.ScVal } }).result?.retval
  if (!retval) return 0
  const i128 = retval.i128?.()
  if (!i128) return 0
  const lo = i128.lo()
  const str = lo ? lo.toString() : '0'
  return Number(str)
}

export async function readTokenAllowance(tokenId: string, ownerAddress: string, spenderAddress: string, readerPubKey?: string): Promise<number> {
  const server = createRpcServer()
  const source = await server.getAccount(readerPubKey || SIM_ACCOUNT)
  const token = new Contract(tokenId)
  const tx = new TransactionBuilder(source, { fee: '1000', networkPassphrase: TESTNET })
    .addOperation(
      token.call(
        'allowance',
        xdr.ScVal.scvAddress(Address.fromString(ownerAddress).toScAddress()),
        xdr.ScVal.scvAddress(Address.fromString(spenderAddress).toScAddress()),
      ),
    )
    .setTimeout(30)
    .build()
  const sim = await server.simulateTransaction(tx)
  if (rpc.Api.isSimulationError(sim)) return 0
  const retval = (sim as unknown as { result?: { retval?: xdr.ScVal } }).result?.retval
  if (!retval) return 0
  const i128 = retval.i128?.()
  if (!i128) return 0
  const lo = i128.lo()
  const str = lo ? lo.toString() : '0'
  return Number(str)
}

// Read quote from SoroSwap router: get_amounts_out(amount_in, path) -> Vec<i128>
export async function readSoroswapAmountOutForPath(
  amountInBase: number,
  pathAssets: string[],
  readerPubKey?: string,
): Promise<number> {
  if (pathAssets.length < 2) return 0
  const server = createRpcServer()
  const source = await server.getAccount(readerPubKey || SIM_ACCOUNT)
  const router = new Contract(SOROSWAP_ROUTER)
  const path = xdr.ScVal.scvVec(
    pathAssets.map((asset) => xdr.ScVal.scvAddress(Address.fromString(asset).toScAddress())),
  )
  const quoteMethods: Array<{ name: string; args: xdr.ScVal[] }> = [
    { name: 'router_get_amounts_out', args: [nativeToScVal(amountInBase, { type: 'i128' }), path] },
    { name: 'get_amounts_out', args: [nativeToScVal(amountInBase, { type: 'i128' }), path] },
  ]

  for (const method of quoteMethods) {
    const tx = new TransactionBuilder(source, { fee: '1000', networkPassphrase: TESTNET })
      .addOperation(router.call(method.name, ...method.args))
      .setTimeout(30)
      .build()
    const sim = await server.simulateTransaction(tx)
    if (rpc.Api.isSimulationError(sim)) {
      continue
    }
    const retval = (sim as unknown as { result?: { retval?: xdr.ScVal } }).result?.retval
    if (!retval) {
      continue
    }
    const vec = retval.vec()
    if (!vec || vec.length === 0) {
      continue
    }
    const last = vec[vec.length - 1]
    const i128 = last.i128?.()
    if (!i128) {
      continue
    }
    const lo = i128.lo()
    const str = lo ? lo.toString() : '0'
    return Number(str)
  }
  return 0
}

export async function readSoroswapAmountOut(amountInBase: number, tokenIn: string, tokenOut: string, readerPubKey?: string): Promise<number> {
  return readSoroswapAmountOutForPath(amountInBase, [tokenIn, tokenOut], readerPubKey)
}

// Read quote from Aquarius router: estimate_swap(tokens, token_in, token_out, pool_index, in_amount) -> u128
export async function readAquariusEstimateOut(
  routerId: string,
  tokenIn: string,
  tokenOut: string,
  poolIndexHex32: string,
  amountInBase: number,
  readerPubKey?: string,
): Promise<number> {
  const server = createRpcServer()
  const source = await server.getAccount(readerPubKey || SIM_ACCOUNT)
  const router = new Contract(routerId)
  const [t1, t2] = tokenIn < tokenOut ? [tokenIn, tokenOut] : [tokenOut, tokenIn]
  const tokens = xdr.ScVal.scvVec([
    xdr.ScVal.scvAddress(Address.fromString(t1).toScAddress()),
    xdr.ScVal.scvAddress(Address.fromString(t2).toScAddress()),
  ])
  const hex = (poolIndexHex32 || '').toLowerCase().replace(/^0x/, '')
  if (hex.length !== 64) return 0
  const raw = Buffer.from(hex, 'hex')
  const poolIndex = toScValBytesOrBytesN(raw)
  const tx = new TransactionBuilder(source, { fee: '1000', networkPassphrase: TESTNET })
    .addOperation(
      router.call(
        'estimate_swap',
        tokens,
        xdr.ScVal.scvAddress(Address.fromString(tokenIn).toScAddress()),
        xdr.ScVal.scvAddress(Address.fromString(tokenOut).toScAddress()),
        poolIndex,
        nativeToScVal(amountInBase, { type: 'u128' }),
      ),
    )
    .setTimeout(30)
    .build()
  const sim = await server.simulateTransaction(tx)
  if (rpc.Api.isSimulationError(sim)) return 0
  const retval = (sim as unknown as { result?: { retval?: xdr.ScVal } }).result?.retval
  if (!retval) return 0
  const u128 = retval.u128?.()
  if (!u128) return 0
  const lo = u128.lo()
  const str = lo ? lo.toString() : '0'
  return Number(str)
}

// Read quote from a Phoenix pool: simulate_swap(offer_asset, offer_amount) -> { ask_amount, ... }
export async function readPhoenixEstimateOut(
  poolId: string,
  tokenIn: string,
  amountInBase: number,
  readerPubKey?: string,
): Promise<number> {
  if (!poolId || !tokenIn || amountInBase <= 0) return 0
  const server = createRpcServer()
  const source = await server.getAccount(readerPubKey || SIM_ACCOUNT)
  const pool = new Contract(poolId)
  const tx = new TransactionBuilder(source, { fee: '1000', networkPassphrase: TESTNET })
    .addOperation(
      pool.call(
        'simulate_swap',
        xdr.ScVal.scvAddress(Address.fromString(tokenIn).toScAddress()),
        nativeToScVal(amountInBase, { type: 'i128' }),
      ),
    )
    .setTimeout(30)
    .build()
  const sim = await server.simulateTransaction(tx)
  if (rpc.Api.isSimulationError(sim)) return 0
  const retval = (sim as unknown as { result?: { retval?: xdr.ScVal } }).result?.retval
  if (!retval) return 0
  for (const entry of parseMapEntries(retval)) {
    const key = entry.key().sym?.()?.toString?.() ?? ''
    if (key === 'ask_amount') return scValToI128Number(entry.val())
  }
  const vec = retval.vec?.()
  if (vec && vec.length > 0) return scValToI128Number(vec[0])
  return 0
}

export type PhoenixPoolRouteDiagnosticStatus =
  | 'healthy'
  | 'mismatch'
  | 'unconfigured'
  | 'missing_route'
  | 'decode_error'
  | 'unavailable'

export interface PhoenixPoolRouteDiagnostic {
  adapterId: string
  poolId: number
  expectedPool: string
  pool: string | null
  tokenIn: string | null
  tokenOut: string | null
  ok: boolean
  status: PhoenixPoolRouteDiagnosticStatus
  detail: string
}

export async function readPhoenixPoolRouteDiagnostic(
  adapterId: string,
  poolId: number,
  expectedPool = '',
  readerPubKey?: string,
): Promise<PhoenixPoolRouteDiagnostic> {
  if (!adapterId) {
    return {
      adapterId,
      poolId,
      expectedPool,
      pool: null,
      tokenIn: null,
      tokenOut: null,
      ok: false,
      status: 'unconfigured',
      detail: 'Phoenix adapter id is not configured for this environment.',
    }
  }
  if (!Number.isFinite(poolId) || poolId <= 0) {
    return {
      adapterId,
      poolId,
      expectedPool,
      pool: null,
      tokenIn: null,
      tokenOut: null,
      ok: false,
      status: 'unconfigured',
      detail: 'Phoenix pool route id is not a positive integer.',
    }
  }

  const { retval, error } = await simulateReadonlyDiagnostic(
    adapterId,
    'pool_route',
    [nativeToScVal(BigInt(Math.trunc(poolId)), { type: 'u128' })],
    readerPubKey,
  )
  if (error || !retval) {
    const missingRoute = /pool_route_not_set|MissingValue/i.test(error ?? '')
    return {
      adapterId,
      poolId,
      expectedPool,
      pool: null,
      tokenIn: null,
      tokenOut: null,
      ok: false,
      status: missingRoute ? 'missing_route' : 'unavailable',
      detail: missingRoute
        ? `Phoenix adapter has no configured route for pool id ${poolId}.`
        : error || 'Phoenix adapter pool_route read returned no value.',
    }
  }

  let pool: string | null = null
  let tokenIn: string | null = null
  let tokenOut: string | null = null
  for (const entry of parseMapEntries(retval)) {
    const key = entry.key().sym?.()?.toString?.() ?? ''
    if (key === 'pool') pool = scValToAddressString(entry.val())
    if (key === 'token_in') tokenIn = scValToAddressString(entry.val())
    if (key === 'token_out') tokenOut = scValToAddressString(entry.val())
  }

  if (!pool) {
    return {
      adapterId,
      poolId,
      expectedPool,
      pool: null,
      tokenIn,
      tokenOut,
      ok: false,
      status: 'decode_error',
      detail: 'Phoenix adapter pool_route did not return a decodable pool address.',
    }
  }

  if (!expectedPool) {
    return {
      adapterId,
      poolId,
      expectedPool,
      pool,
      tokenIn,
      tokenOut,
      ok: false,
      status: 'unconfigured',
      detail:
        'Phoenix pool route is readable, but the matching environment pool is not configured for planner admission.',
    }
  }

  const ok = pool === expectedPool
  return {
    adapterId,
    poolId,
    expectedPool,
    pool,
    tokenIn,
    tokenOut,
    ok,
    status: ok ? 'healthy' : 'mismatch',
    detail: ok
      ? `Phoenix adapter pool id ${poolId} resolves to the configured pool.`
      : `Phoenix adapter pool id ${poolId} resolves to ${pool}, expected ${expectedPool}.`,
  }
}

// Read reserves for an Aquarius pool (tokens must be sorted lexicographically)
export async function readAquariusReserves(
  routerId: string,
  tokenA: string,
  tokenB: string,
  poolIndexHex32: string,
  readerPubKey?: string,
): Promise<[number, number] | null> {
  const server = createRpcServer()
  const source = await server.getAccount(readerPubKey || SIM_ACCOUNT)
  const router = new Contract(routerId)
  const [t1, t2] = tokenA < tokenB ? [tokenA, tokenB] : [tokenB, tokenA]
  const tokens = xdr.ScVal.scvVec([
    xdr.ScVal.scvAddress(Address.fromString(t1).toScAddress()),
    xdr.ScVal.scvAddress(Address.fromString(t2).toScAddress()),
  ])
  const hex = (poolIndexHex32 || '').toLowerCase().replace(/^0x/, '')
  if (hex.length !== 64) return null
  const raw = Buffer.from(hex, 'hex')
  const poolIndex = toScValBytesOrBytesN(raw)
  const tx = new TransactionBuilder(source, { fee: '1000', networkPassphrase: TESTNET })
    .addOperation(router.call('get_reserves', tokens, poolIndex))
    .setTimeout(30)
    .build()
  const sim = await server.simulateTransaction(tx)
  if (rpc.Api.isSimulationError(sim)) return null
  const retval = (sim as unknown as { result?: { retval?: xdr.ScVal } }).result?.retval
  const vec = retval?.vec?.()
  if (!vec || vec.length !== 2) return null
  const toNum = (u: xdr.ScVal): number => {
    const u128 = u?.u128?.()
    const lo = u128?.lo?.()
    const str = lo ? lo.toString() : '0'
    return Number(str)
  }
  return [toNum(vec[0]), toNum(vec[1])]
}

// Factory fee getters
export async function readFactoryCreationFeeToken(factoryId: string, readerPubKey: string): Promise<string | null> {
  if(GENERAL_MAINNET){const value=await generalRead('creation-fee',{factory:factoryId,owner:readerPubKey});if(value.verified!==true||value.factory!==factoryId||value.owner!==readerPubKey)throw Error('Creation fee could not be verified.');return value.token;}
  if(process.env.NEXT_PUBLIC_V3_DEFAULT_CREATION==='1'){const r=await fetch('/api/v3-release/profile',{cache:'no-store'});const data=await r.json();if(!r.ok||data.profile.factory!==factoryId)throw Error('Isolated V3 creation profile unavailable. No V2 fallback.');return data.profile.assets[1];}
  const server = createRpcServer()
  const source = await server.getAccount(readerPubKey)
  const factory = new Contract(factoryId)
  const tx = new TransactionBuilder(source, { fee: '1000', networkPassphrase: TESTNET })
    .addOperation(factory.call('get_creation_fee_token'))
    .setTimeout(30)
    .build()
  const sim = await server.simulateTransaction(tx)
  if (rpc.Api.isSimulationError(sim)) return null
  const retval = (sim as unknown as { result?: { retval?: xdr.ScVal } }).result?.retval
  if (!retval || !retval.address) return null
  try {
    const scAddr = (retval as xdr.ScVal).address()
    return Address.fromScAddress(scAddr).toString()
  } catch { return null }
}

export async function readFactoryCreationFeeAmount(factoryId: string, readerPubKey: string): Promise<number> {
  if(GENERAL_MAINNET){const value=await generalRead('creation-fee',{factory:factoryId,owner:readerPubKey});if(value.verified!==true||value.factory!==factoryId||value.owner!==readerPubKey||!/^\d+$/.test(value.amountRaw)||BigInt(value.amountRaw)>BigInt(Number.MAX_SAFE_INTEGER))throw Error('Creation fee could not be verified.');return Number(value.amountRaw);}
  if(process.env.NEXT_PUBLIC_V3_DEFAULT_CREATION==='1'){const r=await fetch('/api/v3-release/profile',{cache:'no-store'});const data=await r.json();if(!r.ok||data.profile.factory!==factoryId)throw Error('Isolated V3 creation profile unavailable. No V2 fallback.');return Number(data.profile.commercialFeeUsdcRaw);}
  const server = createRpcServer()
  const source = await server.getAccount(readerPubKey)
  const factory = new Contract(factoryId)
  const tx = new TransactionBuilder(source, { fee: '1000', networkPassphrase: TESTNET })
    .addOperation(factory.call('get_creation_fee_amount'))
    .setTimeout(30)
    .build()
  const sim = await server.simulateTransaction(tx)
  if (rpc.Api.isSimulationError(sim)) throw new Error('Creation fee unavailable: simulation failed')
  const retval = (sim as unknown as { result?: { retval?: xdr.ScVal } }).result?.retval
  if (!retval || retval.switch().name !== 'scvI128') throw new Error('Creation fee unavailable: no valid i128 result')
  const value = sdkScValToNative(retval) as bigint
  if (value < BigInt(0) || value > BigInt(Number.MAX_SAFE_INTEGER)) throw new Error('Creation fee unavailable: unsafe value')
  return Number(value)
}

export async function buildArkaFactoryCreate(
  factoryId: string,
  creatorPubKey: string,
  saltHex32: string,
): Promise<{ xdrB64: string; predictedAddress?: string }> {
  const server = createRpcServer()
  const source = await server.getAccount(creatorPubKey)
  const factory = new Contract(factoryId)
  const salt = xdr.ScVal.scvBytes(Buffer.from(saltHex32, 'hex'))
  const txBldr = new TransactionBuilder(source, { fee: '20000', networkPassphrase: TESTNET })
    .addOperation(
      factory.call(
        'create_arka',
        salt,
        xdr.ScVal.scvAddress(Address.fromString(creatorPubKey).toScAddress()),
      ),
    )
    .setTimeout(60)
  const built = txBldr.build()
  const sim = await server.simulateTransaction(built)
  if (rpc.Api.isSimulationError(sim)) {
    throw new Error(describeSimulationFailure(sim, 'Create Arka simulation failed', {
      allowanceMessage: 'Creation fee approval is missing or has not confirmed yet. Approve the creation fee and retry.',
    }))
  }
  let predictedAddress: string | undefined
  try {
    const retval = (sim as unknown as { result?: { retval?: xdr.ScVal } }).result?.retval
    if (retval) {
      const scAddr = (retval as xdr.ScVal).address()
      predictedAddress = Address.fromScAddress(scAddr).toString()
    }
  } catch {}
  const prepared = rpc.assembleTransaction(built, sim)
  return { xdrB64: toB64Xdr(prepared), predictedAddress }
}

export async function buildArkaFactoryCreateAndInit(
  factoryId: string,
  creatorPubKey: string,
  saltHex32: string,
  denominationContract: string,
  fees: { mgmt_bps: number; perf_bps: number; deposit_bps: number; redeem_bps: number },
  whitelistContracts: string[],
  routerId: string,
): Promise<{ xdrB64: string; predictedAddress?: string }> {
  const server = createRpcServer()
  const source = await server.getAccount(creatorPubKey)
  const factory = new Contract(factoryId)
  const salt = xdr.ScVal.scvBytes(Buffer.from(saltHex32, 'hex'))
  const wlVec = xdr.ScVal.scvVec(
    whitelistContracts.map((c) => xdr.ScVal.scvAddress(Address.fromString(c).toScAddress())),
  )
  const txBldr = new TransactionBuilder(source, { fee: '30000', networkPassphrase: TESTNET })
    .addOperation(
      factory.call(
        'create_and_init',
        salt,
        xdr.ScVal.scvAddress(Address.fromString(creatorPubKey).toScAddress()),
        xdr.ScVal.scvAddress(Address.fromString(denominationContract).toScAddress()),
        nativeToScVal(Math.trunc(fees.mgmt_bps), { type: 'i32' }),
        nativeToScVal(Math.trunc(fees.perf_bps), { type: 'i32' }),
        nativeToScVal(Math.trunc(fees.deposit_bps), { type: 'i32' }),
        nativeToScVal(Math.trunc(fees.redeem_bps), { type: 'i32' }),
        wlVec,
        xdr.ScVal.scvAddress(Address.fromString(routerId).toScAddress()),
      ),
    )
    .setTimeout(60)
  const built = txBldr.build()
  const sim = await server.simulateTransaction(built)
  if (rpc.Api.isSimulationError(sim)) {
    throw new Error(describeSimulationFailure(sim, 'Create Arka simulation failed', {
      allowanceMessage: 'Creation fee approval is missing or has not confirmed yet. Approve the creation fee and retry.',
    }))
  }
  let predictedAddress: string | undefined
  try {
    const retval = (sim as unknown as { result?: { retval?: xdr.ScVal } }).result?.retval
    if (retval) {
      const scAddr = (retval as xdr.ScVal).address()
      predictedAddress = Address.fromScAddress(scAddr).toString()
    }
  } catch {}
  const prepared = rpc.assembleTransaction(built, sim)
  return { xdrB64: toB64Xdr(prepared), predictedAddress }
}

// Build Arka.init and set_router
export async function buildArkaInit(
  callerPubKey: string,
  arkaId: string,
  denominationContract: string,
  fees: { mgmt_bps: number; perf_bps: number; deposit_bps: number; redeem_bps: number },
  whitelistContracts: string[],
  managerPubKey: string,
) {
  const server = createRpcServer()
  const source = await server.getAccount(callerPubKey)
  const arka = new Contract(arkaId)
  const wlVec = xdr.ScVal.scvVec(
    whitelistContracts.map((c) => xdr.ScVal.scvAddress(Address.fromString(c).toScAddress())),
  )
  const txBldr = new TransactionBuilder(source, { fee: '20000', networkPassphrase: TESTNET })
    .addOperation(
      arka.call(
        'init',
        xdr.ScVal.scvAddress(Address.fromString(denominationContract).toScAddress()),
        nativeToScVal(Math.trunc(fees.mgmt_bps), { type: 'i32' }),
        nativeToScVal(Math.trunc(fees.perf_bps), { type: 'i32' }),
        nativeToScVal(Math.trunc(fees.deposit_bps), { type: 'i32' }),
        nativeToScVal(Math.trunc(fees.redeem_bps), { type: 'i32' }),
        wlVec,
        xdr.ScVal.scvAddress(Address.fromString(managerPubKey).toScAddress()),
      ),
    )
    .setTimeout(60)
  const built = txBldr.build()
  const sim = await server.simulateTransaction(built)
  if (rpc.Api.isSimulationError(sim)) {
    throw new Error(describeSimulationFailure(sim, 'Arka init simulation failed'))
  }
  const prepared = rpc.assembleTransaction(built, sim)
  return toB64Xdr(prepared)
}

export async function buildArkaSetRouter(
  callerPubKey: string,
  arkaId: string,
  routerId: string,
) {
  const server = createRpcServer()
  const source = await server.getAccount(callerPubKey)
  const arka = new Contract(arkaId)
  const txBldr = new TransactionBuilder(source, { fee: '10000', networkPassphrase: TESTNET })
    .addOperation(
      arka.call(
        'set_router',
        xdr.ScVal.scvAddress(Address.fromString(callerPubKey).toScAddress()),
        xdr.ScVal.scvAddress(Address.fromString(routerId).toScAddress()),
      ),
    )
    .setTimeout(60)
  const built = txBldr.build()
  const sim = await server.simulateTransaction(built)
  if (rpc.Api.isSimulationError(sim)) {
    throw new Error(describeSimulationFailure(sim, 'Set router simulation failed'))
  }
  const prepared = rpc.assembleTransaction(built, sim)
  return toB64Xdr(prepared)
}

// Registry: register(manager, arka)
export async function buildRegistryRegister(
  callerPubKey: string,
  registryId: string,
  managerPubKey: string,
  arkaId: string,
) {
  const server = createRpcServer()
  const source = await server.getAccount(callerPubKey)
  const reg = new Contract(registryId)
  const txBldr = new TransactionBuilder(source, { fee: '10000', networkPassphrase: TESTNET })
    .addOperation(
      reg.call(
        'register',
        xdr.ScVal.scvAddress(Address.fromString(managerPubKey).toScAddress()),
        xdr.ScVal.scvAddress(Address.fromString(arkaId).toScAddress()),
      ),
    )
    .setTimeout(60)
  const built = txBldr.build()
  const sim = await server.simulateTransaction(built)
  if (rpc.Api.isSimulationError(sim)) {
    throw new Error(describeSimulationFailure(sim, 'Registry register simulation failed'))
  }
  const prepared = rpc.assembleTransaction(built, sim)
  return toB64Xdr(prepared)
}

// Helpers to build Arka.rebalance steps (struct-encoded as ScMap)
export function buildSwapStepScVal(params: {
  adapterAddress: string
  poolId: bigint | number | string
  assetInContract: string
  amountIn: bigint | number
  minOut: bigint | number
  assetOutContract: string
  routerAddress?: string
}): xdr.ScVal {
  // Match deployed Arka SwapStep ABI order:
  // adapter, amount_in, asset_in, asset_out, min_out, pool_id, router_addr
  const entries: xdr.ScMapEntry[] = [
    new xdr.ScMapEntry({ key: xdr.ScVal.scvSymbol('adapter'), val: xdr.ScVal.scvAddress(Address.fromString(params.adapterAddress).toScAddress()) }),
    new xdr.ScMapEntry({ key: xdr.ScVal.scvSymbol('amount_in'), val: nativeToScVal(typeof params.amountIn === 'bigint' ? (params.amountIn as bigint) : BigInt(Math.trunc(params.amountIn as number)), { type: 'i128' }) }),
    new xdr.ScMapEntry({
      key: xdr.ScVal.scvSymbol('asset_in'),
      val: xdr.ScVal.scvMap([
        new xdr.ScMapEntry({ key: xdr.ScVal.scvSymbol('contract'), val: xdr.ScVal.scvAddress(Address.fromString(params.assetInContract).toScAddress()) }),
      ]),
    }),
    new xdr.ScMapEntry({
      key: xdr.ScVal.scvSymbol('asset_out'),
      val: xdr.ScVal.scvMap([
        new xdr.ScMapEntry({ key: xdr.ScVal.scvSymbol('contract'), val: xdr.ScVal.scvAddress(Address.fromString(params.assetOutContract).toScAddress()) }),
      ]),
    }),
    new xdr.ScMapEntry({ key: xdr.ScVal.scvSymbol('min_out'), val: nativeToScVal(typeof params.minOut === 'bigint' ? (params.minOut as bigint) : BigInt(Math.trunc(params.minOut as number)), { type: 'i128' }) }),
    new xdr.ScMapEntry({ key: xdr.ScVal.scvSymbol('pool_id'), val: nativeToScVal(typeof params.poolId === 'bigint' ? (params.poolId as bigint) : typeof params.poolId === 'number' ? BigInt(Math.trunc(params.poolId as number)) : BigInt(params.poolId as string), { type: 'u128' }) }),
  ]
  if (params.routerAddress) {
    entries.push(new xdr.ScMapEntry({ key: xdr.ScVal.scvSymbol('router_addr'), val: xdr.ScVal.scvAddress(Address.fromString(params.routerAddress).toScAddress()) }))
  }
  return xdr.ScVal.scvMap(entries)
}

export async function buildArkaRebalance(
  managerPubKey: string,
  arkaId: string,
  steps: xdr.ScVal[],
) {
  const actualRouter = await readArkaRouter(arkaId, managerPubKey)
  const reviews = await Promise.all(steps.map(async step => {
    const raw = sdkScValToNative(step) as {adapter:string;router_addr:string;pool_id:bigint;asset_in:{contract:string};asset_out:{contract:string}}
    const effective = raw.router_addr === actualRouter ? raw.adapter : raw.router_addr
    const protocol = protocolForAdapter(raw.adapter)
    const method=protocol==='SOROSWAP'?'path_for_pool':'pool_route'
    const routeArgs=[nativeToScVal(raw.pool_id,{type:'u128'})]
    const routeValue=await simulateReadonly(raw.adapter,method,routeArgs,managerPubKey)
    if(!routeValue)throw new Error('Protocol route configuration could not be verified.')
    const route=sdkScValToNative(routeValue)
    const path=protocol==='SOROSWAP'?route:[route.token_in,route.token_out]
    if(!Array.isArray(path)||path[0]!==raw.asset_in.contract||path[path.length-1]!==raw.asset_out.contract)throw new Error('Protocol route differs from the reviewed assets.')
    const beforeRoute=routeValue.toXDR('base64')
    const read = async () => {
      if(protocol==='SUSHI'&&BigInt(await readSushiFundBinding(arkaId,raw.adapter,raw.asset_in.contract,raw.asset_out.contract,managerPubKey))!==raw.pool_id)throw new Error('Sushi fund permissions changed. Review again.')
      if(await readArkaRouter(arkaId,managerPubKey)!==actualRouter)throw new Error('The Arka router changed. Review again.')
      const current=await simulateReadonly(raw.adapter,method,routeArgs,managerPubKey)
      if(!current||current.toXDR('base64')!==beforeRoute)throw new Error('Protocol route changed. Review again.')
      return readVenueSnapshot(arkaId,effective,managerPubKey)
    }
    const before = await read()
    if(!protocolVenueAllowed(protocol,before,'manual_swap',TESTNET)) throw new Error('This protocol is unavailable for new swaps. Refresh the route.')
    return {protocol,action:'manual_swap' as const,before,read}
  }))
  const server = createRpcServer()
  const source = await server.getAccount(managerPubKey)
  const arka = new Contract(arkaId)
  const txBldr = new TransactionBuilder(source, { fee: '20000', networkPassphrase: TESTNET })
    .addOperation(
      arka.call(
        'rebalance',
        xdr.ScVal.scvAddress(Address.fromString(managerPubKey).toScAddress()),
        xdr.ScVal.scvVec(steps),
      ),
    )
    .setTimeout(60)
  const built = txBldr.build()
  const sim = await server.simulateTransaction(built)
  if (rpc.Api.isSimulationError(sim)) {
    throw new Error(describeSimulationFailure(sim, 'Rebalance simulation failed'))
  }
  const prepared = rpc.assembleTransaction(built, sim)
  const unsigned = toB64Xdr(prepared)
  rememberProtocolReview(unsigned, reviews)
  return unsigned
}

async function simulateReadonly(contractId: string, method: string, args: xdr.ScVal[] = [], readerPubKey?: string): Promise<xdr.ScVal | null> {
  const server = createRpcServer()
  const source = await getReadonlySource(server, readerPubKey || SIM_ACCOUNT)
  const contract = new Contract(contractId)
  const tx = new TransactionBuilder(source, { fee: '1000', networkPassphrase: TESTNET })
    .addOperation(contract.call(method, ...args))
    .setTimeout(30)
    .build()
  const sim = await server.simulateTransaction(tx)
  if (rpc.Api.isSimulationError(sim)) return null
  return (sim as unknown as { result?: { retval?: xdr.ScVal } }).result?.retval ?? null
}

type ReadonlySimulationDiagnostic = {
  retval: xdr.ScVal | null
  error: string | null
}

async function simulateReadonlyDiagnostic(
  contractId: string,
  method: string,
  args: xdr.ScVal[] = [],
  readerPubKey?: string,
): Promise<ReadonlySimulationDiagnostic> {
  try {
    const server = createRpcServer()
    const source = await getReadonlySource(server, readerPubKey || SIM_ACCOUNT)
    const contract = new Contract(contractId)
    const tx = new TransactionBuilder(source, { fee: '1000', networkPassphrase: TESTNET })
      .addOperation(contract.call(method, ...args))
      .setTimeout(30)
      .build()
    const sim = await server.simulateTransaction(tx)
    if (rpc.Api.isSimulationError(sim)) {
      return { retval: null, error: sim.error || `Simulation failed (${method})` }
    }
    return {
      retval: (sim as unknown as { result?: { retval?: xdr.ScVal } }).result?.retval ?? null,
      error: null,
    }
  } catch (error) {
    return {
      retval: null,
      error: error instanceof Error ? error.message : `Simulation failed (${method})`,
    }
  }
}

export async function buildCoverageFundStake(pubKey: string, fundId: string, amount: number) {
  return buildContractInvokeTx(pubKey, fundId, 'stake', [
    xdr.ScVal.scvAddress(Address.fromString(pubKey).toScAddress()),
    nativeToScVal(BigInt(Math.trunc(amount)), { type: 'i128' }),
  ])
}

export async function buildCoverageFundUnstake(pubKey: string, fundId: string, amount: number) {
  return buildContractInvokeTx(pubKey, fundId, 'unstake', [
    xdr.ScVal.scvAddress(Address.fromString(pubKey).toScAddress()),
    nativeToScVal(BigInt(Math.trunc(amount)), { type: 'i128' }),
  ])
}

export async function buildCoverageFundClaim(pubKey: string, fundId: string) {
  return buildContractInvokeTx(pubKey, fundId, 'claim', [
    xdr.ScVal.scvAddress(Address.fromString(pubKey).toScAddress()),
  ])
}

function requireCoverageAmount(retval: xdr.ScVal | null): number {
  if (!retval || retval.switch().name !== 'scvI128') throw new Error('Coverage balance unavailable: no valid result')
  const value = sdkScValToNative(retval) as bigint
  if (value < BigInt(0) || value > BigInt(Number.MAX_SAFE_INTEGER)) throw new Error('Coverage balance unavailable: unsafe value')
  return Number(value)
}

function requireCoverageNativeAmount(value: unknown): number {
  if (typeof value !== 'bigint' || value < BigInt(0) || value > BigInt(Number.MAX_SAFE_INTEGER)) {
    throw new Error('Coverage data unavailable: missing or unsafe amount')
  }
  return Number(value)
}

export type CoverageFundMetrics = {
  reserve_token: string
  bootstrap_token: string
  claims_manager: string | null
  reserve_capital: number
  total_staked: number
  retained_reserve: number
  total_covered_nav: number
  total_premiums: number
}

export async function readCoverageFundMetrics(fundId: string, readerPubKey?: string): Promise<CoverageFundMetrics> {
  const retval = await simulateReadonly(fundId, 'metrics', [], readerPubKey)
  if (!retval || retval.switch().name !== 'scvMap') throw new Error('Coverage data unavailable: missing metrics')
  const value = sdkScValToNative(retval) as Record<string, unknown>
  for (const key of ['reserve_token', 'bootstrap_token']) {
    if (typeof value[key] !== 'string' || !/^C[A-Z2-7]{55}$/.test(value[key] as string)) throw new Error('Coverage data unavailable: invalid token')
    Address.fromString(value[key] as string)
  }
  if (value.claims_manager !== null && (typeof value.claims_manager !== 'string' || !/^C[A-Z2-7]{55}$/.test(value.claims_manager))) {
    throw new Error('Coverage data unavailable: invalid claims manager')
  }
  if (value.claims_manager) Address.fromString(value.claims_manager as string)
  return {
    reserve_token: value.reserve_token as string,
    bootstrap_token: value.bootstrap_token as string,
    claims_manager: value.claims_manager as string | null,
    reserve_capital: requireCoverageNativeAmount(value.reserve_capital),
    total_staked: requireCoverageNativeAmount(value.total_staked),
    retained_reserve: requireCoverageNativeAmount(value.retained_reserve),
    total_covered_nav: requireCoverageNativeAmount(value.total_covered_nav),
    total_premiums: requireCoverageNativeAmount(value.total_premiums),
  }
}

export async function readCoverageFundPendingRewards(fundId: string, user: string, readerPubKey?: string): Promise<{ reserve_reward: number; bootstrap_reward: number }> {
  const retval = await simulateReadonly(fundId, 'pending_rewards', [Address.fromString(user).toScVal()], readerPubKey)
  if (!retval || retval.switch().name !== 'scvMap') throw new Error('Coverage data unavailable: missing rewards')
  const value = sdkScValToNative(retval) as Record<string, unknown>
  return { reserve_reward: requireCoverageNativeAmount(value.reserve_reward), bootstrap_reward: requireCoverageNativeAmount(value.bootstrap_reward) }
}

export async function readCoverageWalletBalance(tokenId: string, owner: string, readerPubKey?: string): Promise<number> {
  const retval = await simulateReadonly(tokenId, 'balance', [Address.fromString(owner).toScVal()], readerPubKey)
  return requireCoverageAmount(retval)
}

export async function readCoverageFundPending(fundId: string, user: string, readerPubKey?: string): Promise<number> {
  const retval = await simulateReadonly(
    fundId,
    'pending_reward',
    [xdr.ScVal.scvAddress(Address.fromString(user).toScAddress())],
    readerPubKey,
  )
  return requireCoverageAmount(retval)
}

export async function readCoverageFundStakeOf(fundId: string, user: string, readerPubKey?: string): Promise<number> {
  const retval = await simulateReadonly(
    fundId,
    'stake_of',
    [xdr.ScVal.scvAddress(Address.fromString(user).toScAddress())],
    readerPubKey,
  )
  return requireCoverageAmount(retval)
}

export async function readCoverageFundTotalStaked(fundId: string, readerPubKey?: string): Promise<number> {
  const retval = await simulateReadonly(fundId, 'total_staked', [], readerPubKey)
  return requireCoverageAmount(retval)
}

export async function readCoverageVaultBalance(vaultId: string, readerPubKey?: string): Promise<number> {
  const retval = await simulateReadonly(vaultId, 'balance', [], readerPubKey)
  return requireCoverageAmount(retval)
}

export async function readCoverageVaultMaxWithdrawable(vaultId: string, readerPubKey?: string): Promise<number> {
  const retval = await simulateReadonly(vaultId, 'max_withdrawable', [], readerPubKey)
  return requireCoverageAmount(retval)
}

export async function readManagerTierPoints(tierId: string, manager: string, readerPubKey?: string): Promise<number> {
  const retval = await simulateReadonly(
    tierId,
    'points_of',
    [xdr.ScVal.scvAddress(Address.fromString(manager).toScAddress())],
    readerPubKey,
  )
  const i128 = retval?.i128?.()
  const lo = i128?.lo?.()
  return Number(lo ? lo.toString() : '0')
}

export async function readManagerTierLevel(tierId: string, manager: string, readerPubKey?: string): Promise<number> {
  const retval = await simulateReadonly(
    tierId,
    'tier_of',
    [xdr.ScVal.scvAddress(Address.fromString(manager).toScAddress())],
    readerPubKey,
  )
  const u = retval?.u32?.()
  return Number(u ?? 0)
}

export async function readManagerTierThresholds(
  tierId: string,
  readerPubKey?: string,
): Promise<[number, number, number] | null> {
  const retval = await simulateReadonly(tierId, 'thresholds', [], readerPubKey)
  const asNum = (v: xdr.ScVal | undefined): number => {
    const i128 = v?.i128?.()
    const lo = i128?.lo?.()
    return Number(lo ? lo.toString() : '0')
  }
  const vec = retval?.vec?.()
  if (vec && vec.length >= 3) return [asNum(vec[0]), asNum(vec[1]), asNum(vec[2])]
  const maybeTuple = (retval as unknown as { _value?: xdr.ScVal[] })?._value
  if (Array.isArray(maybeTuple) && maybeTuple.length >= 3) {
    return [asNum(maybeTuple[0]), asNum(maybeTuple[1]), asNum(maybeTuple[2])]
  }
  return null
}

export async function buildManagerTierAddPoints(
  callerPubKey: string,
  tierId: string,
  manager: string,
  delta: number,
) {
  return buildContractInvokeTx(callerPubKey, tierId, 'add_points', [
    xdr.ScVal.scvAddress(Address.fromString(callerPubKey).toScAddress()),
    xdr.ScVal.scvAddress(Address.fromString(manager).toScAddress()),
    nativeToScVal(BigInt(Math.trunc(delta)), { type: 'i128' }),
  ])
}

export async function buildArkaSetGovernor(
  callerPubKey: string,
  arkaId: string,
  governor: string,
) {
  return buildContractInvokeTx(callerPubKey, arkaId, 'set_governor', [
    xdr.ScVal.scvAddress(Address.fromString(callerPubKey).toScAddress()),
    xdr.ScVal.scvAddress(Address.fromString(governor).toScAddress()),
  ])
}

export async function buildArkaSetFees(
  callerPubKey: string,
  arkaId: string,
  mgmtBps: number,
  perfBps: number,
  depositBps: number,
  redeemBps: number,
) {
  return buildContractInvokeTx(callerPubKey, arkaId, 'set_fees', [
    xdr.ScVal.scvAddress(Address.fromString(callerPubKey).toScAddress()),
    nativeToScVal(Math.trunc(mgmtBps), { type: 'i32' }),
    nativeToScVal(Math.trunc(perfBps), { type: 'i32' }),
    nativeToScVal(Math.trunc(depositBps), { type: 'i32' }),
    nativeToScVal(Math.trunc(redeemBps), { type: 'i32' }),
  ])
}

export async function buildArkaSetProtocolFeePolicy(
  callerPubKey: string,
  arkaId: string,
  treasury: string,
  mgmtProtocolBps: number,
  perfProtocolBps: number,
) {
  return buildContractInvokeTx(callerPubKey, arkaId, 'set_protocol_fee_policy', [
    xdr.ScVal.scvAddress(Address.fromString(callerPubKey).toScAddress()),
    xdr.ScVal.scvAddress(Address.fromString(treasury).toScAddress()),
    nativeToScVal(Math.trunc(mgmtProtocolBps), { type: 'i32' }),
    nativeToScVal(Math.trunc(perfProtocolBps), { type: 'i32' }),
  ])
}

export async function buildArkaSetWhitelist(
  callerPubKey: string,
  arkaId: string,
  whitelistContracts: string[],
) {
  return buildContractInvokeTx(callerPubKey, arkaId, 'set_whitelist', [
    xdr.ScVal.scvAddress(Address.fromString(callerPubKey).toScAddress()),
    xdr.ScVal.scvVec(
      whitelistContracts.map((contractId) =>
        xdr.ScVal.scvAddress(Address.fromString(contractId).toScAddress()),
      ),
    ),
  ])
}

export async function buildArkaSetSwapRiskPolicy(
  callerPubKey: string,
  arkaId: string,
  params: {
    enabled: boolean
    oracle_checks_enabled: boolean
    max_price_impact_bps: number
    max_slippage_bps: number
    max_twap_deviation_bps: number
    max_oracle_age_seconds: number
    max_trade_size_bps: number
  },
) {
  return buildContractInvokeTx(callerPubKey, arkaId, 'set_swap_risk_policy', [
    xdr.ScVal.scvAddress(Address.fromString(callerPubKey).toScAddress()),
    nativeToScVal(Boolean(params.enabled), { type: 'bool' }),
    nativeToScVal(Boolean(params.oracle_checks_enabled), { type: 'bool' }),
    nativeToScVal(Math.trunc(params.max_price_impact_bps), { type: 'i32' }),
    nativeToScVal(Math.trunc(params.max_slippage_bps), { type: 'i32' }),
    nativeToScVal(Math.trunc(params.max_twap_deviation_bps), { type: 'i32' }),
    nativeToScVal(BigInt(Math.trunc(params.max_oracle_age_seconds)), { type: 'u64' }),
    nativeToScVal(Math.trunc(params.max_trade_size_bps), { type: 'i32' }),
  ])
}

export async function buildArkaSetSwapOracle(
  callerPubKey: string,
  arkaId: string,
  oracle: string,
) {
  return buildContractInvokeTx(callerPubKey, arkaId, 'set_swap_oracle', [
    xdr.ScVal.scvAddress(Address.fromString(callerPubKey).toScAddress()),
    xdr.ScVal.scvAddress(Address.fromString(oracle).toScAddress()),
  ])
}

export async function buildArkaSetAllowedVenues(
  callerPubKey: string,
  arkaId: string,
  allowedRouters: string[],
  allowedAdapters: string[],
) {
  return buildContractInvokeTx(callerPubKey, arkaId, 'set_allowed_venues', [
    xdr.ScVal.scvAddress(Address.fromString(callerPubKey).toScAddress()),
    xdr.ScVal.scvVec(
      allowedRouters.map((routerId) =>
        xdr.ScVal.scvAddress(Address.fromString(routerId).toScAddress()),
      ),
    ),
    xdr.ScVal.scvVec(
      allowedAdapters.map((adapterId) =>
        xdr.ScVal.scvAddress(Address.fromString(adapterId).toScAddress()),
      ),
    ),
  ])
}

export async function buildArkaSetManager(
  callerPubKey: string,
  arkaId: string,
  manager: string,
) {
  return buildContractInvokeTx(callerPubKey, arkaId, 'set_manager', [
    xdr.ScVal.scvAddress(Address.fromString(callerPubKey).toScAddress()),
    xdr.ScVal.scvAddress(Address.fromString(manager).toScAddress()),
  ])
}

export async function buildArkaSetShareToken(
  callerPubKey: string,
  arkaId: string,
  shareToken: string,
) {
  return buildContractInvokeTx(callerPubKey, arkaId, 'set_share_token', [
    xdr.ScVal.scvAddress(Address.fromString(callerPubKey).toScAddress()),
    xdr.ScVal.scvAddress(Address.fromString(shareToken).toScAddress()),
  ])
}

export async function buildArkaConfigureCreditMarket(
  callerPubKey: string,
  arkaId: string,
  params: {
    protocol: CreditProtocol
    market_id: number
    adapter: string
    allow_supply: boolean
    allow_borrow: boolean
    allow_repay: boolean
    allow_withdraw: boolean
    enabled: boolean
  },
) {
  return buildContractInvokeTx(callerPubKey, arkaId, 'configure_credit_market', [
    xdr.ScVal.scvAddress(Address.fromString(callerPubKey).toScAddress()),
    creditProtocolScVal(params.protocol),
    nativeToScVal(BigInt(Math.trunc(params.market_id)), { type: 'u128' }),
    xdr.ScVal.scvAddress(Address.fromString(params.adapter).toScAddress()),
    nativeToScVal(Boolean(params.allow_supply), { type: 'bool' }),
    nativeToScVal(Boolean(params.allow_borrow), { type: 'bool' }),
    nativeToScVal(Boolean(params.allow_repay), { type: 'bool' }),
    nativeToScVal(Boolean(params.allow_withdraw), { type: 'bool' }),
    nativeToScVal(Boolean(params.enabled), { type: 'bool' }),
  ])
}

export async function buildArkaSettleFees(
  callerPubKey: string,
  arkaId: string,
) {
  return buildContractInvokeTx(callerPubKey, arkaId, 'settle_fees', [])
}

export async function buildCoverageFundSetGovernor(
  callerPubKey: string,
  fundId: string,
  governor: string,
) {
  return buildContractInvokeTx(callerPubKey, fundId, 'set_governor', [
    xdr.ScVal.scvAddress(Address.fromString(callerPubKey).toScAddress()),
    xdr.ScVal.scvAddress(Address.fromString(governor).toScAddress()),
  ])
}

export async function buildCoverageFundSetClaimsManager(
  callerPubKey: string,
  fundId: string,
  claimsManager: string | null,
) {
  return buildContractInvokeTx(callerPubKey, fundId, 'set_claims_manager', [
    xdr.ScVal.scvAddress(Address.fromString(callerPubKey).toScAddress()),
    claimsManager
      ? xdr.ScVal.scvAddress(Address.fromString(claimsManager).toScAddress())
      : xdr.ScVal.scvVoid(),
  ])
}

export async function buildCoverageFundSetTreasury(
  callerPubKey: string,
  fundId: string,
  treasury: string | null,
) {
  return buildContractInvokeTx(callerPubKey, fundId, 'set_treasury', [
    xdr.ScVal.scvAddress(Address.fromString(callerPubKey).toScAddress()),
    treasury
      ? xdr.ScVal.scvAddress(Address.fromString(treasury).toScAddress())
      : xdr.ScVal.scvVoid(),
  ])
}

export async function buildCoverageFundSetEconomicsPolicy(
  callerPubKey: string,
  fundId: string,
  reserveRetainBps: number,
  treasuryShareBps: number,
  reserveTargetBps: number,
) {
  return buildContractInvokeTx(callerPubKey, fundId, 'set_economics_policy', [
    xdr.ScVal.scvAddress(Address.fromString(callerPubKey).toScAddress()),
    nativeToScVal(Math.trunc(reserveRetainBps), { type: 'i32' }),
    nativeToScVal(Math.trunc(treasuryShareBps), { type: 'i32' }),
    nativeToScVal(Math.trunc(reserveTargetBps), { type: 'i32' }),
  ])
}

export async function buildCoverageFundSetCoveredVaultPolicy(
  callerPubKey: string,
  fundId: string,
  vault: string,
  annualPremiumBps: number,
  coverageLimit: number,
) {
  return buildContractInvokeTx(callerPubKey, fundId, 'set_covered_vault_policy', [
    xdr.ScVal.scvAddress(Address.fromString(callerPubKey).toScAddress()),
    xdr.ScVal.scvAddress(Address.fromString(vault).toScAddress()),
    nativeToScVal(Math.trunc(annualPremiumBps), { type: 'i32' }),
    nativeToScVal(BigInt(Math.trunc(coverageLimit)), { type: 'i128' }),
  ])
}

export async function buildCoverageFundRemoveCoveredVault(
  callerPubKey: string,
  fundId: string,
  vault: string,
) {
  return buildContractInvokeTx(callerPubKey, fundId, 'remove_covered_vault', [
    xdr.ScVal.scvAddress(Address.fromString(callerPubKey).toScAddress()),
    xdr.ScVal.scvAddress(Address.fromString(vault).toScAddress()),
  ])
}

export async function buildCoverageFundFundBootstrapRewards(
  callerPubKey: string,
  fundId: string,
  amount: number,
) {
  return buildContractInvokeTx(callerPubKey, fundId, 'fund_bootstrap_rewards', [
    xdr.ScVal.scvAddress(Address.fromString(callerPubKey).toScAddress()),
    nativeToScVal(BigInt(Math.trunc(amount)), { type: 'i128' }),
  ])
}

export async function buildCoverageFundPayPremium(
  callerPubKey: string,
  fundId: string,
  vault: string,
  coveredNav: number,
  coveragePeriodBps: number,
) {
  return buildContractInvokeTx(callerPubKey, fundId, 'pay_premium', [
    xdr.ScVal.scvAddress(Address.fromString(callerPubKey).toScAddress()),
    xdr.ScVal.scvAddress(Address.fromString(vault).toScAddress()),
    nativeToScVal(BigInt(Math.trunc(coveredNav)), { type: 'i128' }),
    nativeToScVal(Math.trunc(coveragePeriodBps), { type: 'i32' }),
  ])
}

export async function buildCoverageFundClaimFromCommunity(
  callerPubKey: string,
  fundId: string,
  recipient: string,
  amount: number,
) {
  return buildContractInvokeTx(callerPubKey, fundId, 'claim_from_community', [
    xdr.ScVal.scvAddress(Address.fromString(callerPubKey).toScAddress()),
    xdr.ScVal.scvAddress(Address.fromString(recipient).toScAddress()),
    nativeToScVal(BigInt(Math.trunc(amount)), { type: 'i128' }),
  ])
}

export async function buildCoverageVaultSetGovernor(
  callerPubKey: string,
  vaultId: string,
  governor: string,
) {
  return buildContractInvokeTx(callerPubKey, vaultId, 'set_governor', [
    xdr.ScVal.scvAddress(Address.fromString(callerPubKey).toScAddress()),
    xdr.ScVal.scvAddress(Address.fromString(governor).toScAddress()),
  ])
}

export async function buildCoverageVaultSetClaimsManager(
  callerPubKey: string,
  vaultId: string,
  claimsManager: string | null,
) {
  return buildContractInvokeTx(callerPubKey, vaultId, 'set_claims_manager', [
    xdr.ScVal.scvAddress(Address.fromString(callerPubKey).toScAddress()),
    claimsManager
      ? xdr.ScVal.scvAddress(Address.fromString(claimsManager).toScAddress())
      : xdr.ScVal.scvVoid(),
  ])
}

export async function buildCoverageVaultSetLockBps(
  callerPubKey: string,
  vaultId: string,
  lockBps: number,
) {
  return buildContractInvokeTx(callerPubKey, vaultId, 'set_lock_bps', [
    xdr.ScVal.scvAddress(Address.fromString(callerPubKey).toScAddress()),
    nativeToScVal(Math.trunc(lockBps), { type: 'i32' }),
  ])
}

export async function buildCoverageVaultDeposit(
  callerPubKey: string,
  vaultId: string,
  amount: number,
) {
  return buildContractInvokeTx(callerPubKey, vaultId, 'deposit', [
    xdr.ScVal.scvAddress(Address.fromString(callerPubKey).toScAddress()),
    nativeToScVal(BigInt(Math.trunc(amount)), { type: 'i128' }),
  ])
}

export async function buildCoverageVaultWithdraw(
  callerPubKey: string,
  vaultId: string,
  recipient: string,
  amount: number,
) {
  return buildContractInvokeTx(callerPubKey, vaultId, 'withdraw', [
    xdr.ScVal.scvAddress(Address.fromString(callerPubKey).toScAddress()),
    xdr.ScVal.scvAddress(Address.fromString(recipient).toScAddress()),
    nativeToScVal(BigInt(Math.trunc(amount)), { type: 'i128' }),
  ])
}

export async function buildCoverageVaultClaimPayout(
  callerPubKey: string,
  vaultId: string,
  recipient: string,
  amount: number,
) {
  return buildContractInvokeTx(callerPubKey, vaultId, 'claim_payout', [
    xdr.ScVal.scvAddress(Address.fromString(callerPubKey).toScAddress()),
    xdr.ScVal.scvAddress(Address.fromString(recipient).toScAddress()),
    nativeToScVal(BigInt(Math.trunc(amount)), { type: 'i128' }),
  ])
}

export async function buildManagerTierSetGovernor(
  callerPubKey: string,
  tierId: string,
  governor: string,
) {
  return buildContractInvokeTx(callerPubKey, tierId, 'set_governor', [
    xdr.ScVal.scvAddress(Address.fromString(callerPubKey).toScAddress()),
    xdr.ScVal.scvAddress(Address.fromString(governor).toScAddress()),
  ])
}

export async function buildManagerTierSetThresholds(
  callerPubKey: string,
  tierId: string,
  tier1Threshold: number,
  tier2Threshold: number,
  tier3Threshold: number,
) {
  return buildContractInvokeTx(callerPubKey, tierId, 'set_thresholds', [
    xdr.ScVal.scvAddress(Address.fromString(callerPubKey).toScAddress()),
    nativeToScVal(BigInt(Math.trunc(tier1Threshold)), { type: 'i128' }),
    nativeToScVal(BigInt(Math.trunc(tier2Threshold)), { type: 'i128' }),
    nativeToScVal(BigInt(Math.trunc(tier3Threshold)), { type: 'i128' }),
  ])
}

export async function buildManagerTierSetPoints(
  callerPubKey: string,
  tierId: string,
  manager: string,
  points: number,
) {
  return buildContractInvokeTx(callerPubKey, tierId, 'set_points', [
    xdr.ScVal.scvAddress(Address.fromString(callerPubKey).toScAddress()),
    xdr.ScVal.scvAddress(Address.fromString(manager).toScAddress()),
    nativeToScVal(BigInt(Math.trunc(points)), { type: 'i128' }),
  ])
}

export async function buildContractInvokeRaw(
  pubKey: string,
  contractId: string,
  method: string,
  args: xdr.ScVal[],
) {
  return buildContractInvokeTx(pubKey, contractId, method, args)
}

export async function simulateContractReadonly(
  contractId: string,
  method: string,
  args: xdr.ScVal[] = [],
  readerPubKey?: string,
) {
  return simulateReadonly(contractId, method, args, readerPubKey)
}

export function scValBytesN32(hexValue: string): xdr.ScVal {
  const normalized = hexValue.startsWith('0x') ? hexValue.slice(2) : hexValue
  if (!/^[0-9a-fA-F]{64}$/.test(normalized)) {
    throw new Error('Expected 32-byte hex value (64 hex chars)')
  }
  return toScValBytesOrBytesN(Buffer.from(normalized, 'hex'))
}

async function buildContractInvokeTx(
  pubKey: string,
  contractId: string,
  method: string,
  args: xdr.ScVal[],
) {
  const server = createRpcServer()
  const source = await server.getAccount(pubKey)
  const contract = new Contract(contractId)
  const txBldr = new TransactionBuilder(source, { fee: '20000', networkPassphrase: TESTNET })
    .addOperation(contract.call(method, ...args))
    .setTimeout(60)
  const built = txBldr.build()
  let sim: Awaited<ReturnType<typeof server.simulateTransaction>> | null = null
  for (let attempt = 0; attempt < 3; attempt += 1) {
    sim = await server.simulateTransaction(built)
    if (!rpc.Api.isSimulationError(sim)) break
    if (attempt < 2) {
      await new Promise((resolve) => setTimeout(resolve, 1200))
    }
  }
  if (!sim || rpc.Api.isSimulationError(sim)) {
    throw new Error(describeSimulationFailure(sim, `Simulation failed (${method})`))
  }
  const prepared = rpc.assembleTransaction(built, sim)
  return toB64Xdr(prepared)
}

export async function readAdapterRouter(adapterId: string, readerPubKey?: string): Promise<string | null> {
  const retval = await simulateReadonly(adapterId, 'router', [], readerPubKey)
  if (!retval) return null
  try {
    const scAddr = retval.address()
    return Address.fromScAddress(scAddr).toString()
  } catch {
    return null
  }
}

export type AdapterRouterDiagnosticStatus =
  | 'healthy'
  | 'mismatch'
  | 'missing_getter'
  | 'missing_storage'
  | 'decode_error'
  | 'unavailable'

export interface AdapterRouterDiagnostic {
  adapterId: string
  expectedRouter: string
  router: string | null
  ok: boolean
  status: AdapterRouterDiagnosticStatus
  detail: string
}

function classifyAdapterRouterError(error: string | null): Pick<AdapterRouterDiagnostic, 'status' | 'detail'> {
  const message = error?.trim() || 'No router value returned by adapter.'
  if (/non-existent contract function|unknown.*function|function.*not.*found/i.test(message)) {
    return {
      status: 'missing_getter',
      detail: 'Adapter deployment does not expose router(); redeploy with the common AMM adapter interface.',
    }
  }
  if (/MissingValue/i.test(message)) {
    return {
      status: 'missing_storage',
      detail: 'Adapter deployment has no router value in instance storage; reinitialise or redeploy it against the configured router.',
    }
  }
  return {
    status: 'unavailable',
    detail: message,
  }
}

export async function readAdapterRouterDiagnostic(
  adapterId: string,
  expectedRouter = '',
  readerPubKey?: string,
): Promise<AdapterRouterDiagnostic> {
  const { retval, error } = await simulateReadonlyDiagnostic(adapterId, 'router', [], readerPubKey)
  if (error || !retval) {
    const classified = classifyAdapterRouterError(error)
    return {
      adapterId,
      expectedRouter,
      router: null,
      ok: false,
      status: classified.status,
      detail: classified.detail,
    }
  }

  try {
    const router = Address.fromScAddress(retval.address()).toString()
    const ok = expectedRouter ? router === expectedRouter : true
    return {
      adapterId,
      expectedRouter,
      router,
      ok,
      status: ok ? 'healthy' : 'mismatch',
      detail: ok
        ? 'Adapter exposes the configured router through the common router() interface.'
        : `Adapter router ${router} does not match configured router ${expectedRouter}.`,
    }
  } catch {
    return {
      adapterId,
      expectedRouter,
      router: null,
      ok: false,
      status: 'decode_error',
      detail: 'Adapter router() returned a value that is not a Soroban address.',
    }
  }
}

export async function readAdapterBalancedPoolSupport(
  adapterId: string,
  poolId: number,
  readerPubKey?: string,
): Promise<boolean> {
  if (!Number.isFinite(poolId) || poolId <= 0) return false
  const supported = await simulateReadonly(
    adapterId,
    'pool_supported',
    [nativeToScVal(BigInt(Math.trunc(poolId)), { type: 'u128' })],
    readerPubKey,
  )
  if (supported) {
    const plain = scValToNative(supported)
    if (typeof plain === 'boolean') return plain
  }

  const retval = await simulateReadonly(
    adapterId,
    'pair_of',
    [nativeToScVal(BigInt(Math.trunc(poolId)), { type: 'u128' })],
    readerPubKey,
  )
  const plain = scValToNative(retval)
  const record = Array.isArray(plain) ? plain[0] : plain
  if (!record || typeof record !== 'object') return false
  const pair = record as Record<string, unknown>
  const tokenIn = typeof pair.token_in === 'string' ? pair.token_in : ''
  const tokenOut = typeof pair.token_out === 'string' ? pair.token_out : ''
  const maxPrice = Number(pair.max_price ?? 0)
  return Boolean(tokenIn && tokenOut && maxPrice > 0)
}

type BlendAction = 'Lend' | 'Borrow' | 'Repay' | 'Liquidate'

function blendActionScVal(action: BlendAction): xdr.ScVal {
  // Soroban enum encoding for a no-payload variant.
  return xdr.ScVal.scvVec([xdr.ScVal.scvSymbol(action)])
}

export async function buildAdapterBalancedExecute(
  callerPubKey: string,
  adapterId: string,
  poolId: number,
  amount: number,
  minOut: number,
  receiver: string,
) {
  if(adapterId!==ADAPTER_BALANCED||!PLATFORM_VENUE_REGISTRY)throw new Error('Protocol permissions are unavailable.')
  const reviewAction = 'manual_swap'
  const before=await readRegistryVenueSnapshot(PLATFORM_VENUE_REGISTRY,adapterId,callerPubKey)
  if(!protocolVenueAllowed('BALANCED',before,reviewAction,TESTNET))throw new Error('Protocol permissions do not allow this action.')
  const tx = await buildContractInvokeTx(callerPubKey, adapterId, 'execute', [
    xdr.ScVal.scvAddress(Address.fromString(callerPubKey).toScAddress()),
    nativeToScVal(BigInt(Math.trunc(poolId)), { type: 'u128' }),
    nativeToScVal(BigInt(Math.trunc(amount)), { type: 'i128' }),
    nativeToScVal(BigInt(Math.trunc(minOut)), { type: 'i128' }),
    xdr.ScVal.scvAddress(Address.fromString(receiver).toScAddress()),
  ])
  rememberProtocolReview(tx,[{protocol:'BALANCED',action:reviewAction,before,read:()=>readRegistryVenueSnapshot(PLATFORM_VENUE_REGISTRY,adapterId,callerPubKey)}])
  return tx
}

export async function buildAdapterBlendExecute(
  callerPubKey: string,
  adapterId: string,
  action: BlendAction,
  marketId: number,
  amount: number,
  receiver: string,
) {
  if(adapterId!==ADAPTER_BLEND||!PLATFORM_VENUE_REGISTRY)throw new Error('Protocol permissions are unavailable.')
  const reviewAction = action==='Repay'?'repay':action==='Borrow'?'borrow':'supply'
  const before=await readRegistryVenueSnapshot(PLATFORM_VENUE_REGISTRY,adapterId,callerPubKey)
  if(!protocolVenueAllowed('BLEND',before,reviewAction,TESTNET))throw new Error('Protocol permissions do not allow this action.')
  const tx = await buildContractInvokeTx(callerPubKey, adapterId, 'execute', [
    xdr.ScVal.scvAddress(Address.fromString(callerPubKey).toScAddress()),
    blendActionScVal(action),
    nativeToScVal(BigInt(Math.trunc(marketId)), { type: 'u128' }),
    nativeToScVal(BigInt(Math.trunc(amount)), { type: 'i128' }),
    xdr.ScVal.scvAddress(Address.fromString(receiver).toScAddress()),
  ])
  rememberProtocolReview(tx,[{protocol:'BLEND',action:reviewAction,before,read:()=>readRegistryVenueSnapshot(PLATFORM_VENUE_REGISTRY,adapterId,callerPubKey)}])
  return tx
}

export async function buildGovernorProposeSnapshotSelf(
  callerPubKey: string,
  governorId: string,
) {
  return buildContractInvokeTx(callerPubKey, governorId, 'propose_snapshot_self', [
    xdr.ScVal.scvAddress(Address.fromString(callerPubKey).toScAddress()),
  ])
}

export async function buildGovernorProposeCouncil(
  callerPubKey: string,
  governorId: string,
  newCouncil: string,
) {
  return buildContractInvokeTx(callerPubKey, governorId, 'propose_council', [
    xdr.ScVal.scvAddress(Address.fromString(callerPubKey).toScAddress()),
    xdr.ScVal.scvAddress(Address.fromString(newCouncil).toScAddress()),
  ])
}

export async function buildGovernorVote(
  callerPubKey: string,
  governorId: string,
  proposalId: number,
  support: number,
) {
  return buildContractInvokeTx(callerPubKey, governorId, 'vote', [
    xdr.ScVal.scvAddress(Address.fromString(callerPubKey).toScAddress()),
    nativeToScVal(Math.trunc(proposalId), { type: 'u32' }),
    nativeToScVal(Math.trunc(support), { type: 'u32' }),
  ])
}

export async function buildGovernorClose(
  callerPubKey: string,
  governorId: string,
  proposalId: number,
) {
  return buildContractInvokeTx(callerPubKey, governorId, 'close', [
    nativeToScVal(Math.trunc(proposalId), { type: 'u32' }),
  ])
}

export async function buildGovernorExecute(
  callerPubKey: string,
  governorId: string,
  proposalId: number,
) {
  return buildContractInvokeTx(callerPubKey, governorId, 'execute', [
    nativeToScVal(Math.trunc(proposalId), { type: 'u32' }),
  ])
}

export type GovernorSettings = {
  proposal_threshold: number
  vote_delay: number
  vote_period: number
  timelock: number
  grace_period: number
  quorum: number
  counting_type: number
  vote_threshold: number
}

export type GovernorProposal = {
  id: number
  title: string
  description: string
  creator: string
  status: number
  vote_start: number
  vote_end: number
  eta: number
  executable: boolean
  action: string
}

export type GovernorProposalVotes = {
  _for: number
  against: number
  abstain: number
}

export function scValToNative(retval: xdr.ScVal | null | undefined): unknown {
  if (!retval) return null
  const kind = retval.switch().name as string
  if (kind === 'scvBool') return scValToBool(retval)
  if (kind === 'scvAddress') return scValToAddressString(retval)
  if (kind === 'scvSymbol') {
    try { return retval.sym().toString() } catch { return null }
  }
  if (kind === 'scvString') {
    try { return retval.str().toString() } catch { return null }
  }
  if (kind === 'scvU32' || kind === 'scvU64' || kind === 'scvU128') return scValToUnsignedNumber(retval)
  if (kind === 'scvI32') {
    try {
      const value = retval.i32()
      return typeof value === 'number' ? value : 0
    } catch {
      return 0
    }
  }
  if (kind === 'scvI64' || kind === 'scvI128') return scValToI128Number(retval)
  if (kind === 'scvVec') {
    try {
      return (retval.vec?.() ?? []).map((item) => scValToNative(item))
    } catch {
      return []
    }
  }
  if (kind === 'scvMap') {
    const parsed: Record<string, unknown> = {}
    for (const entry of parseMapEntries(retval)) {
      const rawKey = scValToNative(entry.key())
      const key = typeof rawKey === 'string' ? rawKey : JSON.stringify(rawKey)
      parsed[key] = scValToNative(entry.val())
    }
    return parsed
  }
  if (kind === 'scvBytes' || kind === 'scvBytesN') {
    try {
      const maybeBytesN = retval as unknown as { bytesN?: () => Uint8Array }
      const bytes = kind === 'scvBytesN' && typeof maybeBytesN.bytesN === 'function'
        ? maybeBytesN.bytesN()
        : retval.bytes()
      return Buffer.from(bytes).toString('hex')
    } catch {
      return null
    }
  }
  if (kind === 'scvVoid') return null
  return null
}

function parseGovernorSettings(retval: xdr.ScVal | null | undefined): GovernorSettings | null {
  const plain = scValToNative(retval)
  if (!plain || typeof plain !== 'object') return null
  const record = plain as Record<string, unknown>
  return {
    proposal_threshold: Number(record.proposal_threshold ?? 0),
    vote_delay: Number(record.vote_delay ?? 0),
    vote_period: Number(record.vote_period ?? 0),
    timelock: Number(record.timelock ?? 0),
    grace_period: Number(record.grace_period ?? 0),
    quorum: Number(record.quorum ?? 0),
    counting_type: Number(record.counting_type ?? 0),
    vote_threshold: Number(record.vote_threshold ?? 0),
  }
}

function parseGovernorProposal(retval: xdr.ScVal | null | undefined): GovernorProposal | null {
  const plain = scValToNative(retval)
  if (!plain || typeof plain !== 'object') return null
  const record = plain as Record<string, unknown>
  const config = (record.config ?? {}) as Record<string, unknown>
  const data = (record.data ?? {}) as Record<string, unknown>
  return {
    id: Number(record.id ?? 0),
    title: String(config.title ?? ''),
    description: String(config.description ?? ''),
    creator: String(data.creator ?? ''),
    status: Number(data.status ?? 0),
    vote_start: Number(data.vote_start ?? 0),
    vote_end: Number(data.vote_end ?? 0),
    eta: Number(data.eta ?? 0),
    executable: Boolean(data.executable ?? false),
    action: JSON.stringify(config.action ?? {}),
  }
}

function parseGovernorProposalVotes(retval: xdr.ScVal | null | undefined): GovernorProposalVotes | null {
  const plain = scValToNative(retval)
  if (!plain || typeof plain !== 'object') return null
  const record = plain as Record<string, unknown>
  return {
    _for: Number(record._for ?? 0),
    against: Number(record.against ?? 0),
    abstain: Number(record.abstain ?? 0),
  }
}

export async function readGovernorVote(
  governorId: string,
  voter: string,
  proposalId: number,
  readerPubKey?: string,
): Promise<number | null> {
  const retval = await simulateReadonly(
    governorId,
    'get_vote',
    [
      xdr.ScVal.scvAddress(Address.fromString(voter).toScAddress()),
      nativeToScVal(Math.trunc(proposalId), { type: 'u32' }),
    ],
    readerPubKey,
  )
  // Option<u32>: null for None, embedded value for Some.
  if (!retval) return null
  const direct = retval.u32?.()
  if (typeof direct === 'number') return direct
  const vec = retval.vec?.()
  if (vec && vec.length > 0) return Number(vec[0].u32?.() ?? 0)
  return null
}

export async function readGovernorSettings(governorId: string, readerPubKey?: string): Promise<GovernorSettings | null> {
  return parseGovernorSettings(await simulateReadonly(governorId, 'settings', [], readerPubKey))
}

export async function readGovernorProposal(
  governorId: string,
  proposalId: number,
  readerPubKey?: string,
): Promise<GovernorProposal | null> {
  return parseGovernorProposal(await simulateReadonly(
    governorId,
    'get_proposal',
    [nativeToScVal(Math.trunc(proposalId), { type: 'u32' })],
    readerPubKey,
  ))
}

export async function readGovernorProposalVotes(
  governorId: string,
  proposalId: number,
  readerPubKey?: string,
): Promise<GovernorProposalVotes | null> {
  return parseGovernorProposalVotes(await simulateReadonly(
    governorId,
    'get_proposal_votes',
    [nativeToScVal(Math.trunc(proposalId), { type: 'u32' })],
    readerPubKey,
  ))
}

export async function findLatestGovernorProposalIdByCreator(
  governorId: string,
  creator: string,
  readerPubKey?: string,
  maxProposalId = 32,
): Promise<number | null> {
  let latest: number | null = null
  for (let proposalId = 0; proposalId <= maxProposalId; proposalId += 1) {
    const proposal = await readGovernorProposal(governorId, proposalId, readerPubKey)
    if (!proposal) continue
    if (proposal.creator === creator) latest = proposalId
  }
  return latest
}

export async function isGovernorReadable(governorId: string, readerPubKey?: string): Promise<boolean> {
  const retval = await simulateReadonly(governorId, 'settings', [], readerPubKey)
  return retval !== null
}

export async function isVotesReadable(votesId: string, readerPubKey?: string): Promise<boolean> {
  const retval = await simulateReadonly(votesId, 'name', [], readerPubKey)
  return retval !== null
}


export function protocolForAdapter(adapter:string):ProtocolId {
  if(adapter===PHOENIX_ADAPTER)throw new Error('Phoenix has been retired from new routes.')
  if(SUSHI_ADAPTER&&adapter===SUSHI_ADAPTER)return 'SUSHI'
  if(adapter===AQUARIUS_ADAPTER)return 'AQUARIUS'
  if(adapter===SOROSWAP_ADAPTER)return 'SOROSWAP'
  if(adapter===ADAPTER_BLEND)return 'BLEND'
  throw new Error('The selected protocol adapter is not configured.')
}

export async function readVenueSnapshot(fund:string,venue:string,readerPubKey?:string):Promise<VenueSnapshot> {
  const network=await createRpcServer().getNetwork()
  if(network.passphrase!==TESTNET)throw new Error('Protocol read network changed.')
  const registryValue=await simulateReadonly(fund,'venue_registry',[],readerPubKey)
  const registry=registryValue?sdkScValToNative(registryValue):null
  if(typeof registry!=='string')throw new Error('Protocol permissions are unavailable for this Arka.')
  return readRegistryVenueSnapshot(registry,venue,readerPubKey)
}
export async function readRegistryVenueSnapshot(registry:string,venue:string,readerPubKey?:string):Promise<VenueSnapshot>{
  new Contract(registry);new Contract(venue)
  const network=await createRpcServer().getNetwork()
  if(network.passphrase!==TESTNET)throw new Error('Protocol read network changed.')
  const value=await simulateReadonly(registry,'venue_config',[Address.fromString(venue).toScVal()],readerPubKey)
  const config=value?sdkScValToNative(value):null
  if(!config||![0,1,2,3].includes(config.status)||!/^\d+$/.test(String(config.updated_at))||typeof config.updated_by!=='string')throw new Error('Protocol permissions could not be verified.')
  return{registry,venue,network:TESTNET,status:config.status,updatedAt:String(config.updated_at),updatedBy:config.updated_by,observedAt:Date.now()}
}

export async function readSushiEstimateOut(adapter:string,poolId:number,tokenIn:string,tokenOut:string,amountBase:number,readerPubKey?:string):Promise<number> {
  if(!SUSHI_FACTORY||!adapter||!Number.isSafeInteger(poolId)||poolId<0||!Number.isSafeInteger(amountBase)||amountBase<=0)throw new Error('Sushi route is not configured for this amount.')
  if((await createRpcServer().getNetwork()).passphrase!==TESTNET)throw new Error('Sushi quote network changed.')
  const native=async(contract:string,method:string,args:xdr.ScVal[]=[])=>{const v=await simulateReadonly(contract,method,args,readerPubKey);if(!v)throw new Error('Sushi quote is unavailable.');return sdkScValToNative(v)}
  const factory=await native(adapter,'factory')
  if(factory!==SUSHI_FACTORY)throw new Error('Sushi factory identity changed.')
  const route=await native(adapter,'pool_route',[nativeToScVal(BigInt(poolId),{type:'u128'})])
  if(route.token_in!==tokenIn||route.token_out!==tokenOut)throw new Error('Sushi route does not match the reviewed pair.')
  const [poolFactory,token0,token1,fee,paused]=await Promise.all(['factory','token0','token1','fee','is_paused'].map(method=>native(route.pool,method)))
  if(poolFactory!==factory||Number(fee)!==Number(route.fee)||paused!==false||!((tokenIn===token0&&tokenOut===token1)||(tokenIn===token1&&tokenOut===token0)))throw new Error('Sushi pool identity or availability changed.')
  const registered=await native(factory,'get_pool',[Address.fromString(token0).toScVal(),Address.fromString(token1).toScVal(),nativeToScVal(Number(fee),{type:'u32'})])
  if(registered!==route.pool)throw new Error('Sushi pool is not registered in the configured factory.')
  const zeroForOne=tokenIn===token0,limit=zeroForOne?BigInt("4295128740"):BigInt("1461446703485210103287273052203988822378723970341")
  const result=await native(route.pool,'quote_exact_input',[nativeToScVal(zeroForOne,{type:'bool'}),nativeToScVal(BigInt(amountBase),{type:'i128'}),nativeToScVal(limit,{type:'u256'})])
  const spent=BigInt(zeroForOne?result.amount0:result.amount1),received=-BigInt(zeroForOne?result.amount1:result.amount0)
  if(spent!==BigInt(amountBase)||received<=BigInt(0)||received>BigInt(Number.MAX_SAFE_INTEGER))throw new Error('Sushi quote cannot fill this amount precisely.')
  return Number(received)
}


export type SushiPoolRouteDiagnostic = PhoenixPoolRouteDiagnostic
export async function readSushiPoolRouteDiagnostic(adapterId:string,poolId:number,expectedPool='',readerPubKey?:string):Promise<SushiPoolRouteDiagnostic>{
  const base={adapterId,poolId,expectedPool:'',pool:null,tokenIn:null,tokenOut:null,ok:false,status:'unconfigured' as PhoenixPoolRouteDiagnosticStatus,detail:'Sushi route is not configured.'}
  if(!adapterId||!SUSHI_FACTORY||!Number.isSafeInteger(poolId)||poolId<0)return base
  const [factoryValue,routeValue]=await Promise.all([simulateReadonly(adapterId,'factory',[],readerPubKey),simulateReadonly(adapterId,'pool_route',[nativeToScVal(BigInt(poolId),{type:'u128'})],readerPubKey)])
  if(!factoryValue||!routeValue)return {...base,status:'unavailable',detail:'Sushi configuration could not be verified.'}
  const factory=sdkScValToNative(factoryValue),route=sdkScValToNative(routeValue)
  const ok=(!expectedPool||route.pool===expectedPool)&&factory===SUSHI_FACTORY&&typeof route.pool==='string'&&typeof route.token_in==='string'&&typeof route.token_out==='string'
  return {...base,pool:route.pool??null,tokenIn:route.token_in??null,tokenOut:route.token_out??null,ok,status:ok?'healthy':'mismatch',detail:ok?'Sushi route and factory match the configured identities.':'Sushi route or factory identity differs from configuration.'}
}

export async function readSushiFundBinding(fund:string,adapter:string,tokenIn:string,tokenOut:string,readerPubKey?:string):Promise<number>{
  const allowed=await simulateReadonly(adapter,'is_caller',[Address.fromString(fund).toScVal()],readerPubKey)
  if(!allowed||sdkScValToNative(allowed)!==true)throw new Error('Sushi is not authorized for this Arka.')
  const value=await simulateReadonly(fund,'managed_routes',[],readerPubKey)
  const bindings=value?sdkScValToNative(value):null
  if(!Array.isArray(bindings))throw new Error('This Arka has no configured Sushi route.')
  const binding=bindings.find(b=>b.adapter===adapter&&(b.family==='Sushi'||b.family?.tag==='Sushi'||(Array.isArray(b.family)&&b.family[0]==='Sushi'))&&b.path?.[0]===tokenIn&&b.path?.[b.path.length-1]===tokenOut)
  if(!binding||!Number.isSafeInteger(Number(binding.pool_id))||BigInt(binding.pool_id)>BigInt(Number.MAX_SAFE_INTEGER))throw new Error('This pair has no configured Sushi route.')
  return Number(binding.pool_id)
}
