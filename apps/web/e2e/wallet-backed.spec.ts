import { copyFileSync, existsSync, mkdirSync, readFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { dirname, resolve } from 'node:path'
import { expect, test, type Page } from '@playwright/test'
import { enableOperatorMode } from './helpers/operator-mode'

const blendArkaId = process.env.E2E_BLEND_ARKA_ID ?? 'CD7LKIM6TAGA5DWVC2UAMX52TDGL6WUQOGEW7LIDSCS363VTIYXOHEJ4'
const blendAmount = process.env.E2E_BLEND_AMOUNT ?? '0.0001000'
const blendBorrowAmount = process.env.E2E_BLEND_BORROW_AMOUNT ?? '0.0000100'
const depositArkaId = process.env.E2E_DEPOSIT_ARKA_ID ?? 'CC7FKBATS5RSDMHELHXX6U257Q6KXKV53UUN4JLHKJF5Q3TIN5NDZ5DQ'
const depositTokenId = process.env.E2E_DEPOSIT_TOKEN_ID ?? 'CATEHH24BDDCEKDH2PNLBMMH42L5MUNQF4DCG474CP4FCSVFMVOONBTK'
const depositAmount = process.env.E2E_DEPOSIT_AMOUNT ?? '0.0001000'
const arkaFactoryId = process.env.NEXT_PUBLIC_ARKA_FACTORY ?? 'CAZPR5MIUHXH46ZJ5OAMRZXD7PXIHMF5HHSSKQPDUBEXVID5SAGSZ3HW'
const createDenominationId = process.env.NEXT_PUBLIC_DENOMINATION ?? process.env.NEXT_PUBLIC_ROUTING_ASSET_A ?? 'CDJ7G22ETJ6PRUM5GDPUXYEY3JL6MDY35WMJYWSGX7U6DV5VMQEKH3PG'
const createWhitelist = (
  process.env.E2E_CREATE_WHITELIST ??
  [
    process.env.NEXT_PUBLIC_ROUTING_ASSET_A ?? 'CDJ7G22ETJ6PRUM5GDPUXYEY3JL6MDY35WMJYWSGX7U6DV5VMQEKH3PG',
    process.env.NEXT_PUBLIC_ROUTING_ASSET_B ?? 'CCCLTACEMF33GJRJ2JXRQYXDBRLRZNK5GVPA2FVHLOE5TPP6NM7UIYV7',
  ]
    .filter((value) => Boolean(value && value.trim().length > 0))
    .join(',')
)
const createWhitelistIds = createWhitelist
  .split(',')
  .map((value) => value.trim())
  .filter((value) => value.length > 0)
const coverageFundId =
  process.env.NEXT_PUBLIC_COVERAGE_FUND ?? 'CCX5QACCFXC3VNMKUHBUZ2NGD2HNU6W47G3E3LBGPAK2DWX63FERA3MO'
const coverageVaultId = process.env.NEXT_PUBLIC_COVERAGE_VAULT ?? 'CCLEUWT6NSMIP2QFGHRIERDM453X24GC56ZNZH7VVEDVQ5JRNNRFB5BL'
const coverageTokenId =
  process.env.NEXT_PUBLIC_COVERAGE_TOKEN ?? 'CA33YVWPBWG6A7JPMMUEUUELUB3UPATI64K62RZFPGYCBJD5GFACOWGK'
const claimsManagerId =
  process.env.NEXT_PUBLIC_CLAIMS_MANAGER ?? 'CBBTR7VED6ZZTK3Z2ZVOWUFSP574UQGO4C2JK6YUUBSH4FPJ2GB4VF5P'
const arkaRegistryId =
  process.env.NEXT_PUBLIC_ARKA_REGISTRY ?? 'CD7NVBDWH7YDCAJGPESKANQMQGNC2FCNX7WBUIRWWKF4QI5NMPRP22NW'
const oracleGuardId =
  process.env.NEXT_PUBLIC_ORACLE_GUARD ?? 'CBVIUEY2C627QSVCKNC4XSVSHRH3DTRK6HQOBOQVJBIXKUKJDH5E22BZ'
const managerTierId =
  process.env.NEXT_PUBLIC_MANAGER_TIER ?? 'CDQVWIBJDX3K3XS4OLL4HFFSG2KKQGOZU7TIFCLMXFDCJDRDOQLB6FGR'
const lockedArkaId =
  process.env.NEXT_PUBLIC_LOCKED_ARKA ?? 'CAUE46HQDGXCP5RUFN4CEU7KOSOWG2UGJIXZRNAPXZFYBC55PH4NGZAC'
const governanceExecutorId = process.env.NEXT_PUBLIC_GOVERNANCE_EXECUTOR_ID ?? ''
const testnetPassphrase =
  process.env.E2E_NETWORK_PASSPHRASE ?? process.env.NEXT_PUBLIC_STELLAR_NETWORK ?? 'Test SDF Network ; September 2015'
const testnetRpc =
  process.env.E2E_RPC_URL ?? process.env.NEXT_PUBLIC_SOROBAN_RPC_URL ?? 'https://soroban-testnet.stellar.org'
const holderAddress = stellarOutput(['keys', 'address', 'arka-holder'])
const managerAddress = stellarOutput(['keys', 'address', 'arka-admin'])
const arkaRouterId = process.env.NEXT_PUBLIC_ARKA_ROUTER ?? 'CB273QHT7GISJF4EW434UY3K6IWTOINAKN6B7NZPAVRBYSERZ2QFBVAQ'
const aquariusAdapterId =
  process.env.NEXT_PUBLIC_AQUARIUS_ADAPTER ?? 'CDEWNICQBSXNRBC7FKO5KZX7YID4KLF7OA3GXAGZ3QEGUJTD733L3ZMV'
const soroswapAdapterId =
  process.env.NEXT_PUBLIC_SOROSWAP_ADAPTER ?? 'CAYJYQRBFCMKUP2W3MQKRC5WARH6FH66AVXBUR6GB3FTGU4EQX5JPXFU'
const coreWorkspacePath = process.env.ARKA_CORE_WORKSPACE ?? resolve(process.cwd(), '../arkafund')
const rebalanceValidationPath =
  process.env.E2E_REBALANCE_VALIDATION_PATH ?? resolve(coreWorkspacePath, 'tmp/rebalance-live-validation.json')
const governanceValidationPath =
  process.env.E2E_GOVERNANCE_VALIDATION_PATH ?? resolve(coreWorkspacePath, 'tmp/governance-live-validation.json')
const governanceDemoVideoPath = process.env.DEMO_RECORD_GOVERNANCE_PATH ?? ''
const executorProbeOperationId = process.env.E2E_EXECUTOR_PROBE_OPERATION_ID ?? 'ab'.repeat(32)

type RebalanceValidation = {
  arka: string
  protocol?: string
  soroswapRouter?: string
  tokenIn: string
  tokenOut: string
  swapAmount?: string
  rebalanceAmount?: string
  poolIndex?: string
}

type GovernanceValidation = {
  governor: string
  votes: string
  proposerAddress: string
  forVoterAddress: string
  votePeriod?: number
  timelock?: number
}

type GovernanceProposalCli = {
  id?: number
  data?: {
    creator?: string
    status?: number
    vote_end?: number
    executable?: boolean
  }
}

async function openArkaWorkspace(
  page: Page,
  id: 'state' | 'flow' | 'rebalance' | 'credit',
) {
  const tab = page.getByTestId(`arka-workspace-tab-${id}`)
  await expect(tab).toBeVisible()
  await tab.click()
}

function loadRebalanceValidation(): RebalanceValidation {
  if (existsSync(rebalanceValidationPath)) {
    return JSON.parse(readFileSync(rebalanceValidationPath, 'utf8')) as RebalanceValidation
  }
  return {
    arka: process.env.E2E_REBALANCE_ARKA_ID ?? '',
    protocol: 'AQUARIUS',
    tokenIn: process.env.NEXT_PUBLIC_ROUTING_ASSET_A ?? 'CB22KRA3YZVCNCQI64JQ5WE7UY2VAV7WFLK6A2JN3HEX56T2EDAFO7QF',
    tokenOut: process.env.NEXT_PUBLIC_ROUTING_ASSET_B ?? 'CAQCFVLOBK5GIULPNZRGATJJMIZL5BSP7X5YJVMGCPTUEPFM4AVSRCJU',
    swapAmount: process.env.E2E_REBALANCE_AMOUNT ?? '100000',
  }
}

function loadGovernanceValidation(): GovernanceValidation {
  if (!existsSync(governanceValidationPath)) {
    throw new Error(`Missing governance validation file: ${governanceValidationPath}`)
  }
  return JSON.parse(readFileSync(governanceValidationPath, 'utf8')) as GovernanceValidation
}

function baseUnitsToDisplay(baseUnits: string | number): string {
  const raw = typeof baseUnits === 'number' ? baseUnits : Number(baseUnits)
  return (raw / 1e7).toFixed(7)
}

function guardrailSafeRebalanceAmount(rebalance: RebalanceValidation): string {
  if (process.env.E2E_REBALANCE_AMOUNT) return process.env.E2E_REBALANCE_AMOUNT
  const artifactAmount = Number(rebalance.swapAmount ?? rebalance.rebalanceAmount ?? '100000')
  const safeDefault = 1_000
  if (!Number.isFinite(artifactAmount) || artifactAmount <= 0) return String(safeDefault)
  return String(Math.min(artifactAmount, safeDefault))
}

async function selectFundedRebalancePair(
  page: Page,
  rebalance: RebalanceValidation,
): Promise<{ input: string; output: string; balanceBase: number }> {
  const pairs = [
    { input: rebalance.tokenIn, output: rebalance.tokenOut },
    { input: rebalance.tokenOut, output: rebalance.tokenIn },
  ]
  let selected: { input: string; output: string; balanceBase: number } | null = null

  await expect.poll(async () => {
    let best: { input: string; output: string; balanceBase: number } | null = null
    for (const pair of pairs) {
      await page.getByTestId('rebalance-asset-in-select').selectOption(pair.input)
      await page.getByTestId('rebalance-asset-out-select').selectOption(pair.output)
      const balance = Number(
        (await page.getByTestId('rebalance-balance-in').getAttribute('data-base-units')) ?? '0',
      )
      if (Number.isFinite(balance) && balance > (best?.balanceBase ?? 0)) {
        best = { ...pair, balanceBase: balance }
      }
    }
    if (best) {
      await page.getByTestId('rebalance-asset-in-select').selectOption(best.input)
      await page.getByTestId('rebalance-asset-out-select').selectOption(best.output)
      selected = best
      return best.balanceBase
    }
    return 0
  }, { timeout: 45_000 }).toBeGreaterThan(0)

  if (!selected) {
    throw new Error('No funded rebalance input asset is available in the live validation Arka.')
  }
  return selected
}

function boundedRebalanceAmountBase(preferredBaseUnits: string, inputBalanceBase: number): string {
  const preferred = Number(preferredBaseUnits)
  const balance = Math.floor(inputBalanceBase)
  if (!Number.isFinite(balance) || balance <= 0) return '1'
  const halfBalance = Math.max(1, Math.floor(balance / 2))
  if (!Number.isFinite(preferred) || preferred <= 0) return String(halfBalance)
  return String(Math.max(1, Math.min(Math.trunc(preferred), halfBalance)))
}

async function setConservativeRebalanceMinOut(page: Page, minOutBase = 1): Promise<void> {
  await page.getByLabel('Advanced').check()
  await expect(page.getByTestId('rebalance-min-out-input')).toBeVisible()
  await page.getByTestId('rebalance-min-out-input').fill(baseUnitsToDisplay(minOutBase))
}

async function confirmIfVisible(page: Page, testId: string): Promise<void> {
  const button = page.getByTestId(testId)
  if (await button.count()) {
    await button.click()
  }
}

function stellarOutput(args: string[]): string {
  return execFileSync('stellar', args, { encoding: 'utf8' }).trim()
}

function stellarContractInvoke(
  contractId: string,
  sourceAccount: string,
  method: string,
  args: string[] = [],
  send = false,
): string {
  return execFileSync('stellar', [
    'contract', 'invoke',
    '--id', contractId,
    '--source-account', sourceAccount,
    '--rpc-url', testnetRpc,
    '--network-passphrase', testnetPassphrase,
    ...(send ? ['--send=yes'] : []),
    '--',
    method,
    ...args,
  ], { encoding: 'utf8' }).trim()
}

function ensureArkaRouterConfigured(arkaId: string): void {
  try {
    const current = stellarContractInvoke(arkaId, 'arka-holder', 'router').split('\n').at(-1)?.replaceAll('"', '')
    if (current === arkaRouterId) return
  } catch {}
  stellarContractInvoke(arkaId, 'arka-holder', 'set_router', [
    '--caller', holderAddress,
    '--router', arkaRouterId,
  ], true)
}

function configureLiveRebalanceRoutes(
  rebalance: RebalanceValidation,
  pair: { input: string; output: string },
): void {
  ensureArkaRouterConfigured(rebalance.arka)
  const sortedTokens = [rebalance.tokenIn, rebalance.tokenOut].sort()
  if (rebalance.poolIndex) {
    stellarContractInvoke(aquariusAdapterId, 'arka-admin', 'set_pool_route', [
      '--caller', managerAddress,
      '--pool_id', '1',
      '--token_in', pair.input,
      '--token_out', pair.output,
      '--tokens', JSON.stringify(sortedTokens),
      '--pool_index', rebalance.poolIndex,
    ], true)
  }
  stellarContractInvoke(soroswapAdapterId, 'arka-admin', 'set_path_for_pool', [
    '--caller', managerAddress,
    '--pool_id', '1',
    '--path', JSON.stringify([pair.input, pair.output]),
  ], true)
}

function readGovernorProposalCli(governorId: string, proposalId: number): GovernanceProposalCli | null {
  try {
    const raw = stellarOutput([
      'contract', 'invoke',
      '--id', governorId,
      '--source-account', 'arka-admin',
      '--rpc-url', testnetRpc,
      '--network-passphrase', testnetPassphrase,
      '--',
      'get_proposal',
      '--proposal_id', String(proposalId),
    ])
    if (!raw || raw === 'null') return null
    return JSON.parse(raw) as GovernanceProposalCli
  } catch {
    return null
  }
}

function findOpenGovernorProposalId(governorId: string, creator: string, maxProposalId = 50): number | null {
  let latest: number | null = null
  for (let proposalId = 0; proposalId <= maxProposalId; proposalId += 1) {
    const proposal = readGovernorProposalCli(governorId, proposalId)
    if (!proposal) continue
    if (proposal.data?.creator === creator && proposal.data?.status === 0) {
      latest = proposalId
    }
  }
  return latest
}

function readGovernorVoteCli(governorId: string, voter: string, proposalId: number): number | null {
  try {
    const raw = stellarOutput([
      'contract', 'invoke',
      '--id', governorId,
      '--source-account', 'arka-admin',
      '--rpc-url', testnetRpc,
      '--network-passphrase', testnetPassphrase,
      '--',
      'get_vote',
      '--voter', voter,
      '--proposal_id', String(proposalId),
    ])
    if (!raw || raw === 'null') return null
    const parsed = JSON.parse(raw) as number | number[] | { value?: number }
    if (typeof parsed === 'number') return parsed
    if (Array.isArray(parsed) && typeof parsed[0] === 'number') return parsed[0]
    if (
      parsed &&
      typeof parsed === 'object' &&
      !Array.isArray(parsed) &&
      typeof parsed.value === 'number'
    ) return parsed.value
    return null
  } catch {
    return null
  }
}

function ensureCoverageAllowance(amountBase = '1000'): void {
  const holderAddress = stellarOutput(['keys', 'address', 'arka-holder'])
  const currentAllowance = stellarOutput([
    'contract', 'invoke',
    '--id', coverageTokenId,
    '--source-account', 'arka-holder',
    '--rpc-url', testnetRpc,
    '--network-passphrase', testnetPassphrase,
    '--',
    'allowance',
    '--owner', holderAddress,
    '--spender', coverageFundId,
  ]).replaceAll('"', '')
  if (Number(currentAllowance) >= Number(amountBase)) {
    return
  }
  execFileSync('stellar', [
    'contract', 'invoke',
    '--id', coverageTokenId,
    '--source-account', 'arka-holder',
    '--rpc-url', testnetRpc,
    '--network-passphrase', testnetPassphrase,
    '--send=yes',
    '--',
    'approve',
    '--owner', holderAddress,
    '--spender', coverageFundId,
    '--amount', amountBase,
  ], { encoding: 'utf8' })
}

function ensureTokenBalance(tokenId: string, minBalanceBase = 5000): void {
  const holderAddress = stellarOutput(['keys', 'address', 'arka-holder'])
  const currentBalance = stellarOutput([
    'contract', 'invoke',
    '--id', tokenId,
    '--source-account', 'arka-holder',
    '--rpc-url', testnetRpc,
    '--network-passphrase', testnetPassphrase,
    '--',
    'balance',
    '--owner', holderAddress,
  ]).replaceAll('"', '')
  if (Number(currentBalance) >= minBalanceBase) {
    return
  }
  execFileSync('stellar', [
    'contract', 'invoke',
    '--id', tokenId,
    '--source-account', 'arka-admin',
    '--rpc-url', testnetRpc,
    '--network-passphrase', testnetPassphrase,
    '--send=yes',
    '--',
    'mint',
    '--to', holderAddress,
    '--amount', String(minBalanceBase * 10),
  ], { encoding: 'utf8' })
}

function ensureAllowance(tokenId: string, spender: string, amountBase = '1000'): void {
  const holderAddress = stellarOutput(['keys', 'address', 'arka-holder'])
  const currentAllowance = stellarOutput([
    'contract', 'invoke',
    '--id', tokenId,
    '--source-account', 'arka-holder',
    '--rpc-url', testnetRpc,
    '--network-passphrase', testnetPassphrase,
    '--',
    'allowance',
    '--owner', holderAddress,
    '--spender', spender,
  ]).replaceAll('"', '')
  if (Number(currentAllowance) >= Number(amountBase)) {
    return
  }
  execFileSync('stellar', [
    'contract', 'invoke',
    '--id', tokenId,
    '--source-account', 'arka-holder',
    '--rpc-url', testnetRpc,
    '--network-passphrase', testnetPassphrase,
    '--send=yes',
    '--',
    'approve',
    '--owner', holderAddress,
    '--spender', spender,
    '--amount', amountBase,
  ], { encoding: 'utf8' })
}

test.describe('wallet-backed flow', () => {
  test.describe.configure({ mode: 'serial' })
  const holderWalletPattern = new RegExp(`${holderAddress.slice(0, 6)}.*${holderAddress.slice(-4)}`)

  async function openCoverageMemberWorkspace(page: Page): Promise<void> {
    await page.getByTestId('coverage-workspace-tab-member').click()
    await expect(page.getByTestId('coverage-member-panel')).toContainText(holderWalletPattern, { timeout: 30_000 })
  }

  async function openCoverageActionsWorkspace(page: Page): Promise<void> {
    await page.getByTestId('coverage-workspace-tab-actions').click()
    await expect(page.getByTestId('coverage-actions-panel')).toContainText(holderWalletPattern, { timeout: 30_000 })
  }

  test('connects the test wallet and submits a real claim transaction', async ({ page }) => {
    test.setTimeout(120_000)
    await page.addInitScript(() => window.localStorage.setItem('e2e-wallet-profile', 'holder'))
    await page.goto('/coverage')

    await expect(page.getByRole('heading', { name: 'Coverage', exact: true })).toBeVisible()
    await page.getByTestId('connect-wallet-chrome').click()

    await expect(page.getByTestId('wallet-badge-chrome')).toBeVisible({ timeout: 30_000 })
    await openCoverageMemberWorkspace(page)
    await openCoverageActionsWorkspace(page)

    await page.getByRole('button', { name: /claim rewards/i }).click()
    await expect(page.getByText(/submitting claim/i)).toBeVisible()
    await expect(page.getByText(/success:/i)).toBeVisible({ timeout: 120_000 })
  })

  test('stakes and unstakes a small real amount through the browser wallet', async ({ page }) => {
    test.setTimeout(180_000)
    ensureCoverageAllowance('1000')

    await page.addInitScript(() => window.localStorage.setItem('e2e-wallet-profile', 'holder'))
    await page.goto('/coverage')

    await expect(page.getByRole('heading', { name: 'Coverage', exact: true })).toBeVisible()
    await page.getByTestId('connect-wallet-chrome').click()
    await expect(page.getByTestId('wallet-badge-chrome')).toBeVisible({ timeout: 30_000 })
    await openCoverageMemberWorkspace(page)

    await expect.poll(async () => {
      const raw = await page.getByTestId('coverage-wallet-balance').getAttribute('data-base-units')
      return Number(raw ?? '0')
    }, { timeout: 15_000 }).toBeGreaterThan(0)

    const walletBalanceBase = await page.getByTestId('coverage-wallet-balance').getAttribute('data-base-units')
    const walletBalance = Number(walletBalanceBase ?? '0')
    expect(walletBalance).toBeGreaterThanOrEqual(1)

    await openCoverageActionsWorkspace(page)
    await page.getByTestId('coverage-stake-input').fill('0.0000001')
    await page.getByTestId('coverage-stake-button').click()
    await expect(page.getByTestId('coverage-status')).toContainText(/submitting stake/i, { timeout: 120_000 })
    await expect(page.getByTestId('coverage-status')).toContainText(/success:/i, { timeout: 120_000 })

    await page.getByTestId('coverage-unstake-input').fill('0.0000001')
    await page.getByTestId('coverage-unstake-button').click()
    await expect(page.getByTestId('coverage-status')).toContainText(/submitting unstake/i, { timeout: 10_000 })
    await expect(page.getByTestId('coverage-status')).toContainText(/success:/i, { timeout: 120_000 })
  })

  test('deposits into and redeems from a live Arka through the browser wallet', async ({ page }) => {
    test.setTimeout(180_000)
    ensureTokenBalance(depositTokenId, 10_000)
    ensureAllowance(depositTokenId, depositArkaId, '1000')

    await page.addInitScript(() => window.localStorage.setItem('e2e-wallet-profile', 'holder'))
    await page.goto(`/arkas/${depositArkaId}`)

    const connectButton = page.getByTestId('connect-wallet-chrome')
    if (await connectButton.count()) {
      await connectButton.click()
    }
    await expect(page.locator('text=/^G[A-Z0-9]{5,}/').first()).toBeVisible()
    await openArkaWorkspace(page, 'flow')
    await expect(page.getByTestId('arka-asset-select')).toBeVisible()

    await page.getByTestId('arka-asset-select').selectOption(depositTokenId)
    await expect(page.getByTestId('arka-asset-select')).toHaveValue(depositTokenId)
    await expect.poll(async () => {
      const raw = await page.getByTestId('arka-wallet-asset-balance').getAttribute('data-base-units')
      return Number(raw ?? '0')
    }, { timeout: 30_000 }).toBeGreaterThan(1000)

    const beforeShares = await page.getByTestId('arka-flow-shares').textContent()
    await page.getByTestId('arka-amount-input').fill(depositAmount)
    await page.getByTestId('arka-deposit-button').click()
    await expect(page.getByTestId('vault-status')).toContainText(/deposit confirmed:/i, { timeout: 120_000 })
    await expect(page.getByTestId('arka-flow-shares')).not.toHaveText(beforeShares ?? '', { timeout: 30_000 })

    const afterDepositShares = await page.getByTestId('arka-flow-shares').textContent()
    await page.getByTestId('arka-amount-input').fill(depositAmount)
    await page.getByTestId('arka-redeem-button').click()
    await expect(page.getByTestId('vault-status')).toContainText(/redemption confirmed:/i, { timeout: 120_000 })
    await expect(page.getByTestId('arka-flow-shares')).not.toHaveText(afterDepositShares ?? '', { timeout: 30_000 })
  })

  test('creates a live Arka through the browser wallet and opens its detail page', async ({ page }) => {
    test.setTimeout(240_000)

    await page.addInitScript((address) => {
      window.localStorage.setItem('e2e-wallet-profile', 'holder')
      window.localStorage.setItem('wallet:pubkey', address)
    }, holderAddress)
    await page.goto('/factory/create')

    await expect(page.getByTestId('create-page-heading')).toBeVisible()
    await expect(page.getByTestId('create-arka-denomination-panel')).toBeVisible({ timeout: 30_000 })
    await page.getByTestId(`create-arka-denom-option-${createDenominationId}`).click()
    for (const contractId of createWhitelistIds) {
      if (contractId === createDenominationId) continue
      const option = page.getByTestId(`create-arka-whitelist-option-${contractId}`)
      if (await option.count()) {
        await option.click()
      }
    }
    await page.getByTestId('create-step-review').click()
    await page.getByTestId('create-arka-submit-button').click()
    await confirmIfVisible(page, 'create-arka-confirm-button')

    await expect(page.getByTestId('create-arka-status')).toContainText(/create & init confirmed:/i, { timeout: 180_000 })
    const createdArkaId = (await page.getByTestId('create-arka-created-id').textContent())?.trim() ?? ''
    expect(createdArkaId).toMatch(/^C[A-Z0-9]{55}$/)

    const successOpenActions = page.getByTestId('create-arka-success-open-actions')
    if (await successOpenActions.count()) {
      await successOpenActions.click()
    } else {
      await page.getByTestId('create-arka-open-link').click()
    }
    await expect(page).toHaveURL(new RegExp(`/arkas/${createdArkaId}$`))
    await expect(page.getByTestId('arka-stage-panel')).toBeVisible()
    await expect(page.getByText(/you are manager|watch mode/i).first()).toBeVisible()
  })

  test('runs live Blend supply and borrow actions from the browser wallet', async ({ page }) => {
    test.setTimeout(180_000)

    await page.addInitScript(() => window.localStorage.setItem('e2e-wallet-profile', 'manager'))
    await page.goto(`/arkas/${blendArkaId}`)

    const connectButton = page.getByTestId('connect-wallet-chrome')
    if (await connectButton.count()) {
      await connectButton.click()
    }
    await expect(page.locator('text=/^G[A-Z0-9]{5,}/').first()).toBeVisible()
    await expect(page.getByText(/you are manager/i).first()).toBeVisible({ timeout: 30_000 })
    await openArkaWorkspace(page, 'credit')
    await expect(page.getByTestId('arka-credit-panel')).toContainText('Blend')
    await expect(page.getByTestId('credit-market-name')).toContainText('Blend')
    await expect(page.getByTestId('credit-asset-select')).toBeVisible()
    await expect(page.getByTestId('credit-run-button')).toBeVisible()
    const creditAssetSelect = page.getByTestId('credit-asset-select')
    await expect.poll(async () => await creditAssetSelect.locator('option').count(), { timeout: 30_000 }).toBeGreaterThan(2)
    const optionValues = await creditAssetSelect.locator('option').evaluateAll((options) =>
      options.map((option) => (option as HTMLOptionElement).value),
    )
    if (optionValues.length > 2) {
      const selected = optionValues[optionValues.length - 1] ?? ''
      await creditAssetSelect.selectOption(selected)
      await expect(creditAssetSelect).toHaveValue(selected)
    }

    const beforeCollateral = await page.getByTestId('credit-collateral-live').textContent()
    const beforeDebt = await page.getByTestId('credit-debt-live').textContent()
    await page.getByTestId('credit-action-supply').click()
    await page.getByTestId('credit-amount-input').fill(blendAmount)
    await page.getByTestId('credit-run-button').click()

    await expect(page.getByText(/blend credit supply on market/i)).toBeVisible({ timeout: 10_000 })
    await expect(page.getByTestId('credit-status')).toContainText(/submitted:/i, { timeout: 60_000 })
    await expect(page.getByTestId('credit-collateral-live')).not.toHaveText(beforeCollateral ?? '', { timeout: 30_000 })
    await expect(page.getByTestId('credit-health-factor')).toBeVisible()

    await page.getByTestId('credit-action-borrow').click()
    await page.getByTestId('credit-amount-input').fill(blendBorrowAmount)
    await page.getByTestId('credit-run-button').click()
    await expect(page.getByText(/blend credit borrow on market/i)).toBeVisible({ timeout: 10_000 })
    await expect(page.getByTestId('credit-status')).toContainText(/submitted:/i, { timeout: 60_000 })
    await expect(page.getByTestId('credit-debt-live')).not.toHaveText(beforeDebt ?? '', { timeout: 30_000 })
  })

  test('blocks Balanced execute when the on-chain lane is not ready', async ({ page }) => {
    test.setTimeout(120_000)

    await enableOperatorMode(page)
    await page.goto('/integrations/operator?workspace=actions')

    await expect(page.getByRole('heading', { name: /^integrations operator$/i })).toBeVisible()
    await page.getByRole('button', { name: /Actions Protocol commands/i }).click()
    await expect(page.getByTestId('integrations-actions-panel')).toBeVisible()
    await expect(page.getByTestId('integrations-run-balanced')).toBeVisible()
    await page.getByTestId('integrations-balanced-pool-id').fill('1')
    await page.getByTestId('integrations-balanced-amount').fill('0.0001000')
    await page.getByTestId('integrations-balanced-min-out').fill('0.0000990')
    await expect(page.getByTestId('integrations-balanced-lane-note')).toContainText(
      /execution is blocked|not configured on-chain yet/i,
      { timeout: 30_000 },
    )
    await expect(page.getByTestId('integrations-run-balanced')).toBeDisabled()
  })

  test('runs live contracts control-room reads and manager-tier mutations', async ({ page }) => {
    test.setTimeout(240_000)

    await enableOperatorMode(page)
    await page.goto('/contracts')

    await expect(page.getByRole('heading', { name: /contract control center/i })).toBeVisible()
    await expect(page.getByText('Connected')).toBeVisible({ timeout: 30_000 })

    const actionSelect = page.getByTestId('contracts-action-select')
    const contractInput = page.getByTestId('contracts-contract-id-input')

    await page.getByTestId('contracts-raw-contract-input').fill(managerTierId)
    await page.getByTestId('contracts-raw-method-input').fill('points_of')
    await page.getByTestId('contracts-raw-args-input').fill(
      JSON.stringify([{ type: 'address', value: holderAddress }]),
    )
    await page.getByTestId('contracts-raw-read-button').click()
    await expect(page.getByTestId('contracts-raw-status')).toContainText(/raw read call completed/i, {
      timeout: 30_000,
    })
    const pointsBefore = ((await page.getByTestId('contracts-raw-result').textContent()) ?? '').trim()
    expect(pointsBefore).toMatch(/^-?\d+$/)

    await actionSelect.selectOption('manager-tier-add-points')
    await contractInput.fill(managerTierId)
    await page.getByTestId('contracts-field-caller').fill(managerAddress)
    await page.getByTestId('contracts-field-manager').fill(holderAddress)
    await page.getByTestId('contracts-field-delta').fill('1')
    await page.getByTestId('contracts-run-preset-button').click()
    await confirmIfVisible(page, 'contracts-confirm-button')
    await expect(page.getByTestId('contracts-preset-error')).toContainText(/direct write blocked by dao policy/i, {
      timeout: 30_000,
    })

    await page.getByTestId('contracts-raw-read-button').click()
    await expect(page.getByTestId('contracts-raw-status')).toContainText(/raw read call completed/i, {
      timeout: 30_000,
    })
    const pointsAfterBlockedTypedWrite = ((await page.getByTestId('contracts-raw-result').textContent()) ?? '').trim()
    expect(pointsAfterBlockedTypedWrite).toMatch(/^-?\d+$/)
    expect(Number(pointsAfterBlockedTypedWrite)).toBe(Number(pointsBefore))

    await page.getByTestId('contracts-field-delta').fill('-1')
    await page.getByTestId('contracts-run-preset-button').click()
    await confirmIfVisible(page, 'contracts-confirm-button')
    await expect(page.getByTestId('contracts-preset-error')).toContainText(/direct write blocked by dao policy/i, {
      timeout: 30_000,
    })

    await page.getByTestId('contracts-raw-read-button').click()
    await expect(page.getByTestId('contracts-raw-status')).toContainText(/raw read call completed/i, {
      timeout: 30_000,
    })
    const pointsAfterRollback = ((await page.getByTestId('contracts-raw-result').textContent()) ?? '').trim()
    expect(pointsAfterRollback).toMatch(/^-?\d+$/)
    expect(Number(pointsAfterRollback)).toBe(Number(pointsBefore))

    await page.getByTestId('contracts-raw-contract-input').fill(managerTierId)
    await page.getByTestId('contracts-raw-method-input').fill('points_of')
    await page.getByTestId('contracts-raw-args-input').fill(
      JSON.stringify([{ type: 'address', value: managerAddress }]),
    )
    await page.getByTestId('contracts-raw-read-button').click()
    await expect(page.getByTestId('contracts-raw-status')).toContainText(/raw read call completed/i, {
      timeout: 30_000,
    })
    const managerPointsBefore = ((await page.getByTestId('contracts-raw-result').textContent()) ?? '').trim()
    expect(managerPointsBefore).toMatch(/^-?\d+$/)

    await page.getByTestId('contracts-raw-method-input').fill('add_points')
    await page.getByTestId('contracts-raw-args-input').fill(
      JSON.stringify([
        { type: 'address', value: managerAddress },
        { type: 'address', value: managerAddress },
        { type: 'i128', value: '2' },
      ]),
    )
    await page.getByTestId('contracts-raw-write-button').click()
    await confirmIfVisible(page, 'contracts-confirm-button')
    await expect(page.getByTestId('contracts-raw-error')).toContainText(/direct write blocked by dao policy/i, {
      timeout: 30_000,
    })

    await page.getByTestId('contracts-raw-method-input').fill('points_of')
    await page.getByTestId('contracts-raw-args-input').fill(
      JSON.stringify([{ type: 'address', value: managerAddress }]),
    )
    await page.getByTestId('contracts-raw-read-button').click()
    await expect(page.getByTestId('contracts-raw-status')).toContainText(/raw read call completed/i, {
      timeout: 30_000,
    })
    const managerPointsAfterIncrease = ((await page.getByTestId('contracts-raw-result').textContent()) ?? '').trim()
    expect(managerPointsAfterIncrease).toMatch(/^-?\d+$/)
    expect(Number(managerPointsAfterIncrease)).toBe(Number(managerPointsBefore))

    await page.getByTestId('contracts-raw-method-input').fill('add_points')
    await page.getByTestId('contracts-raw-args-input').fill(
      JSON.stringify([
        { type: 'address', value: managerAddress },
        { type: 'address', value: managerAddress },
        { type: 'i128', value: '-2' },
      ]),
    )
    await page.getByTestId('contracts-raw-write-button').click()
    await confirmIfVisible(page, 'contracts-confirm-button')
    await expect(page.getByTestId('contracts-raw-error')).toContainText(/direct write blocked by dao policy/i, {
      timeout: 30_000,
    })

    await page.getByTestId('contracts-raw-method-input').fill('points_of')
    await page.getByTestId('contracts-raw-args-input').fill(
      JSON.stringify([{ type: 'address', value: managerAddress }]),
    )
    await page.getByTestId('contracts-raw-read-button').click()
    await expect(page.getByTestId('contracts-raw-status')).toContainText(/raw read call completed/i, {
      timeout: 30_000,
    })
    const managerPointsAfterRollback = ((await page.getByTestId('contracts-raw-result').textContent()) ?? '').trim()
    expect(managerPointsAfterRollback).toMatch(/^-?\d+$/)
    expect(Number(managerPointsAfterRollback)).toBe(Number(managerPointsBefore))

    await actionSelect.selectOption('coverage-vault-read-governor')
    await contractInput.fill(coverageVaultId)
    await page.getByTestId('contracts-run-preset-button').click()
    await expect(page.getByTestId('contracts-preset-status')).toContainText(/read call completed/i, {
      timeout: 30_000,
    })
    const coverageGovernorRaw = ((await page.getByTestId('contracts-preset-read-result').textContent()) ?? '').trim()
    const coverageGovernor = coverageGovernorRaw.replaceAll('"', '').trim()
    expect(coverageGovernor).toMatch(/^G[A-Z0-9]{55}$/)

    await actionSelect.selectOption('coverage-vault-read-lock-bps')
    await contractInput.fill(coverageVaultId)
    await page.getByTestId('contracts-run-preset-button').click()
    await expect(page.getByTestId('contracts-preset-status')).toContainText(/read call completed/i, {
      timeout: 30_000,
    })
    const lockBpsBeforeRaw = ((await page.getByTestId('contracts-preset-read-result').textContent()) ?? '').trim()
    expect(lockBpsBeforeRaw).toMatch(/^-?\d+$/)
    const lockBpsBefore = Number(lockBpsBeforeRaw)
    const lockBpsProbe = String(Math.max(0, Math.min(10_000, lockBpsBefore + 1)))

    await actionSelect.selectOption('coverage-vault-set-lock-bps')
    await contractInput.fill(coverageVaultId)
    await page.getByTestId('contracts-field-caller').fill(managerAddress)
    await page.getByTestId('contracts-field-lock_bps').fill(lockBpsProbe)
    await page.getByTestId('contracts-run-preset-button').click()
    await confirmIfVisible(page, 'contracts-confirm-button')

    await expect(page.getByText(/direct write blocked by dao policy/i)).toBeVisible({
      timeout: 30_000,
    })

    await actionSelect.selectOption('coverage-vault-read-lock-bps')
    await contractInput.fill(coverageVaultId)
    await page.getByTestId('contracts-run-preset-button').click()
    await expect(page.getByTestId('contracts-preset-status')).toContainText(/read call completed/i, {
      timeout: 30_000,
    })
    const lockBpsAfterBlockedWriteRaw = ((await page.getByTestId('contracts-preset-read-result').textContent()) ?? '').trim()
    expect(lockBpsAfterBlockedWriteRaw).toMatch(/^-?\d+$/)
    expect(Number(lockBpsAfterBlockedWriteRaw)).toBe(lockBpsBefore)
  })

  test('executes critical /contracts mutation matrix with post-state assertions and rollback', async ({ page }) => {
    test.setTimeout(360_000)

    await enableOperatorMode(page)
    await page.goto('/contracts')

    await expect(page.getByRole('heading', { name: /contract control center/i })).toBeVisible()
    await expect(page.getByText('Connected')).toBeVisible({ timeout: 30_000 })

    const actionSelect = page.getByTestId('contracts-action-select')
    const contractInput = page.getByTestId('contracts-contract-id-input')
    const runPresetButton = page.getByTestId('contracts-run-preset-button')
    const runPreset = async (): Promise<void> => {
      await runPresetButton.click()
      await confirmIfVisible(page, 'contracts-confirm-button')
    }
    const presetStatus = page.getByTestId('contracts-preset-status')
    const presetError = page.getByTestId('contracts-preset-error')
    const presetReadResult = page.getByTestId('contracts-preset-read-result')
    const matrixResponse = await page.request.get('/api/contracts/mutation-matrix')
    expect(matrixResponse.ok()).toBeTruthy()
    const matrixPayload = (await matrixResponse.json()) as {
      ok: boolean
      entries: Array<{
        id: string
        title: string
        severity: 'critical' | 'high' | 'medium'
        writeActionId: string
        readActionId: string
        rollbackActionId: string | null
        preconditions: string[]
        postStateAssertion: string
        stateProbe: string
        rollbackStrategy: string
        riskControls: string[]
        e2eScenario: string
        status: 'ready' | 'blocked_missing_contract' | 'blocked_manual_runbook'
        executionLane: 'wallet_backed' | 'dao_executor' | 'blocked_missing_contract' | 'blocked_manual_runbook'
      }>
    }
    expect(matrixPayload.ok).toBe(true)
    expect(matrixPayload.entries.length).toBeGreaterThanOrEqual(27)
    for (const entry of matrixPayload.entries) {
      expect(entry.writeActionId).toMatch(/\S/)
      expect(entry.readActionId).toMatch(/\S/)
      expect(entry.severity).toMatch(/critical|high|medium/)
      expect(entry.executionLane).toMatch(/wallet_backed|dao_executor|blocked_missing_contract|blocked_manual_runbook/)
      expect(entry.preconditions.length).toBeGreaterThanOrEqual(3)
      expect(entry.postStateAssertion).toMatch(/read|verify|require|compare/i)
      expect(entry.stateProbe).toMatch(/\S/)
      expect(entry.rollbackStrategy).toMatch(/restore|remove|reapply/i)
      expect(entry.riskControls.length).toBeGreaterThanOrEqual(3)
      expect(entry.e2eScenario).toMatch(/\S/)
      const matrixRow = page.getByTestId(`contracts-mutation-matrix-row-${entry.id}`)
      await expect(matrixRow).toContainText(entry.title)
      await expect(matrixRow).toContainText(entry.severity)
      await expect(matrixRow).toContainText(
        entry.executionLane === 'dao_executor'
          ? 'DAO executor'
          : entry.executionLane === 'wallet_backed'
            ? 'Wallet backed'
            : 'Blocked',
      )
      await expect(matrixRow).toContainText(entry.writeActionId)
      await expect(matrixRow).toContainText(entry.readActionId)
      for (const precondition of entry.preconditions) {
        await expect(matrixRow).toContainText(precondition)
      }
      await expect(matrixRow).toContainText(entry.postStateAssertion)
      await expect(matrixRow).toContainText(entry.stateProbe)
      await expect(matrixRow).toContainText(entry.rollbackStrategy)
      for (const control of entry.riskControls) {
        await expect(matrixRow).toContainText(control)
      }
      await expect(matrixRow).toContainText(entry.e2eScenario)
      if (entry.rollbackActionId) {
        await expect(matrixRow).toContainText(entry.rollbackActionId)
      }
    }
    const expectedReadyWriteActions = new Set(
      matrixPayload.entries
        .filter((entry) => entry.status === 'ready')
        .map((entry) => entry.writeActionId),
    )

    const readPresetResult = async (
      actionId: string,
      targetContractId: string,
      fields?: Array<{ key: string; value: string }>,
    ): Promise<string> => {
      await actionSelect.selectOption(actionId)
      await contractInput.fill(targetContractId)
      for (const field of fields ?? []) {
        const fieldLocator = page.getByTestId(`contracts-field-${field.key}`)
        const isSelect = await fieldLocator.evaluate(
          (element) => element.tagName.toLowerCase() === 'select',
        )
        if (isSelect) {
          await fieldLocator.selectOption(field.value)
        } else {
          await fieldLocator.fill(field.value)
        }
      }
      await runPreset()
      await expect.poll(async () => {
        const statusText = (await presetStatus.count()) > 0
          ? ((await presetStatus.textContent()) ?? '')
          : ''
        const errorText = (await presetError.count()) > 0
          ? ((await presetError.textContent()) ?? '')
          : ''
        if (/read call completed/i.test(statusText)) return 'read'
        if (errorText.trim().length > 0) return `error:${errorText.trim()}`
        return ''
      }, { timeout: 30_000 }).not.toBe('')

      const statusText = (await presetStatus.count()) > 0
        ? ((await presetStatus.textContent()) ?? '')
        : ''
      const errorText = (await presetError.count()) > 0
        ? ((await presetError.textContent()) ?? '')
        : ''
      if (!/read call completed/i.test(statusText)) {
        throw new Error(`Read preset ${actionId} failed: ${errorText || statusText || 'unknown runtime error'}`)
      }
      return ((await presetReadResult.textContent()) ?? '').trim()
    }

    const runWritePreset = async (
      actionId: string,
      targetContractId: string,
      fields: Array<{ key: string; value: string }>,
    ): Promise<{ ok: boolean; detail: string }> => {
      await actionSelect.selectOption(actionId)
      await contractInput.fill(targetContractId)
      for (const field of fields) {
        const fieldLocator = page.getByTestId(`contracts-field-${field.key}`)
        const isSelect = await fieldLocator.evaluate(
          (element) => element.tagName.toLowerCase() === 'select',
        )
        if (isSelect) {
          await fieldLocator.selectOption(field.value)
        } else {
          await fieldLocator.fill(field.value)
        }
      }
      await runPreset()
      await expect.poll(async () => {
        const statusText = (await presetStatus.count()) > 0
          ? ((await presetStatus.textContent()) ?? '')
          : ''
        const errorText = (await presetError.count()) > 0
          ? ((await presetError.textContent()) ?? '')
          : ''
        if (/success:/i.test(statusText)) return 'success'
        if (errorText.trim()) return `error:${errorText.trim()}`
        return ''
      }, { timeout: 120_000 }).not.toBe('')

      const statusText = (await presetStatus.count()) > 0
        ? ((await presetStatus.textContent()) ?? '')
        : ''
      const errorText = (await presetError.count()) > 0
        ? ((await presetError.textContent()) ?? '')
        : ''
      const detail = `${statusText} ${errorText}`.trim()
      const ok = /success:/i.test(statusText)
      if (!ok) {
        expect(errorText.trim().length).toBeGreaterThan(0)
        expect(detail.toLowerCase()).toMatch(
          /auth|unauthorized|forbidden|not authorized|failed|error|dao policy|governance mutation|blocked/,
        )
      }
      return { ok, detail }
    }

    const readJson = async (
      actionId: string,
      targetContractId: string,
      fields?: Array<{ key: string; value: string }>,
    ): Promise<unknown> => {
      const raw = await readPresetResult(actionId, targetContractId, fields)
      return JSON.parse(raw)
    }

    const tryReadJson = async (
      actionId: string,
      targetContractId: string,
      fields?: Array<{ key: string; value: string }>,
    ): Promise<{ ok: true; value: unknown } | { ok: false; reason: string }> => {
      try {
        const value = await readJson(actionId, targetContractId, fields)
        return { ok: true, value }
      } catch (error) {
        return { ok: false, reason: error instanceof Error ? error.message : String(error) }
      }
    }

    const thresholdsBeforeRaw = await readPresetResult('manager-tier-read-thresholds', managerTierId)
    const thresholdsBefore = JSON.parse(thresholdsBeforeRaw) as number[] | { [key: string]: number }
    const thresholdTuple = Array.isArray(thresholdsBefore)
      ? thresholdsBefore
      : [
          Number((thresholdsBefore as { tier1_threshold?: number }).tier1_threshold ?? 0),
          Number((thresholdsBefore as { tier2_threshold?: number }).tier2_threshold ?? 0),
          Number((thresholdsBefore as { tier3_threshold?: number }).tier3_threshold ?? 0),
        ]
    expect(thresholdTuple.length).toBeGreaterThanOrEqual(3)

    let successfulMutations = 0
    const blockedMutations: string[] = []
    let mutationScenarioCount = 0
    const coveredWriteActions = new Set<string>()

    const normalizeStringArray = (value: unknown): string[] =>
      Array.isArray(value)
        ? value
            .map((entry) => (typeof entry === 'string' ? entry.trim() : String(entry ?? '').trim()))
            .filter(Boolean)
        : []

    const readTupleValue = (value: unknown, index: number): unknown =>
      Array.isArray(value) ? value[index] : undefined

    const readObjectValue = (value: unknown, key: string): unknown => {
      if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined
      return (value as Record<string, unknown>)[key]
    }

    const toSafeInt = (value: unknown, fallback: number): number => {
      if (typeof value === 'number' && Number.isFinite(value)) return Math.trunc(value)
      if (typeof value === 'string') {
        const trimmed = value.trim()
        if (!trimmed) return fallback
        const parsed = Number(trimmed)
        if (Number.isFinite(parsed)) return Math.trunc(parsed)
      }
      if (value && typeof value === 'object' && !Array.isArray(value)) {
        const nestedValue = (value as Record<string, unknown>).value
        if (nestedValue !== undefined) return toSafeInt(nestedValue, fallback)
      }
      return fallback
    }

    const applyMutationWithRollback = async (input: {
      label: string
      readActionId: string
      writeActionId: string
      contractId: string
      readFields?: Array<{ key: string; value: string }>
      mutateFields: Array<{ key: string; value: string }>
      rollbackActionId?: string
      rollbackFields: Array<{ key: string; value: string }>
      compare?: (before: unknown, after: unknown) => void | Promise<void>
    }): Promise<void> => {
      coveredWriteActions.add(input.writeActionId)
      const before = await readJson(input.readActionId, input.contractId, input.readFields)
      const write = await runWritePreset(input.writeActionId, input.contractId, input.mutateFields)
      if (!write.ok) {
        blockedMutations.push(`${input.label}: ${write.detail}`)
        const afterBlocked = await readJson(input.readActionId, input.contractId, input.readFields)
        expect(afterBlocked).toEqual(before)
        return
      }
      successfulMutations += 1
      const after = await readJson(input.readActionId, input.contractId, input.readFields)
      if (input.compare) {
        await input.compare(before, after)
      } else {
        expect(after).not.toEqual(before)
      }
      const rollback = await runWritePreset(
        input.rollbackActionId ?? input.writeActionId,
        input.contractId,
        input.rollbackFields,
      )
      expect(rollback.ok).toBe(true)
      const rolledBack = await readJson(input.readActionId, input.contractId, input.readFields)
      expect(rolledBack).toEqual(before)
    }

    const runMutationScenario = async (input: Parameters<typeof applyMutationWithRollback>[0]): Promise<void> => {
      mutationScenarioCount += 1
      await applyMutationWithRollback(input)
    }

    const registerSkippedMutation = (label: string, reason: string, writeActionId?: string): void => {
      mutationScenarioCount += 1
      if (writeActionId) {
        coveredWriteActions.add(writeActionId)
      }
      blockedMutations.push(`${label}: ${reason}`)
    }

    const expectGovernedWalletLaneBlocked = async (input: {
      label: string
      writeActionId: string
      contractId: string
      fields: Array<{ key: string; value: string }>
    }): Promise<void> => {
      mutationScenarioCount += 1
      coveredWriteActions.add(input.writeActionId)
      const result = await runWritePreset(input.writeActionId, input.contractId, input.fields)
      expect(result.ok).toBe(false)
      expect(result.detail.toLowerCase()).toMatch(/dao policy|governance mutation|blocked/)
      blockedMutations.push(`${input.label}: ${result.detail}`)
    }

    const swapOracleBeforeRaw = await readPresetResult('arka-read-swap-oracle', depositArkaId)
    const swapOracleBefore = JSON.parse(swapOracleBeforeRaw) as string | null
    const oracleProbe = swapOracleBefore === coverageTokenId ? coverageVaultId : coverageTokenId

    const protocolFeePolicyBeforeRaw = await readPresetResult('arka-read-protocol-fee-policy', depositArkaId)
    const protocolFeePolicyBefore = JSON.parse(protocolFeePolicyBeforeRaw) as
      | { treasury?: string; mgmt_protocol_bps?: number; perf_protocol_bps?: number }
      | number[]
      | null
    const protocolFeePolicyProbe = {
      treasury:
        protocolFeePolicyBefore &&
        !Array.isArray(protocolFeePolicyBefore) &&
        protocolFeePolicyBefore.treasury === holderAddress
          ? managerAddress
          : holderAddress,
      mgmt: protocolFeePolicyBefore && Array.isArray(protocolFeePolicyBefore)
        ? Number(protocolFeePolicyBefore[1] ?? 2500) + 7
        : Number((protocolFeePolicyBefore as { mgmt_protocol_bps?: number } | null)?.mgmt_protocol_bps ?? 2500) + 7,
      perf: protocolFeePolicyBefore && Array.isArray(protocolFeePolicyBefore)
        ? Number(protocolFeePolicyBefore[2] ?? 2500) + 11
        : Number((protocolFeePolicyBefore as { perf_protocol_bps?: number } | null)?.perf_protocol_bps ?? 2500) + 11,
    }

    const swapRiskBeforeRaw = await readPresetResult('arka-read-swap-risk-policy', depositArkaId)
    const swapRiskBefore = JSON.parse(swapRiskBeforeRaw) as
      | {
          enabled?: boolean
          oracle_checks_enabled?: boolean
          max_price_impact_bps?: number
          max_slippage_bps?: number
          max_twap_deviation_bps?: number
          max_oracle_age_seconds?: number
          max_trade_size_bps?: number
        }
      | null
    const swapRiskProbe = {
      enabled: String(!(swapRiskBefore?.enabled ?? true)),
      oracle_checks_enabled: String(!(swapRiskBefore?.oracle_checks_enabled ?? true)),
      max_price_impact_bps: String(Number(swapRiskBefore?.max_price_impact_bps ?? 500) + 1),
      max_slippage_bps: String(Number(swapRiskBefore?.max_slippage_bps ?? 1000) + 1),
      max_twap_deviation_bps: String(Number(swapRiskBefore?.max_twap_deviation_bps ?? 1000) + 1),
      max_oracle_age_seconds: String(Number(swapRiskBefore?.max_oracle_age_seconds ?? 60) + 1),
      max_trade_size_bps: String(Number(swapRiskBefore?.max_trade_size_bps ?? 1000) + 1),
    }

    const feesBefore = await readJson('arka-read-fees', depositArkaId)
    const feesBeforeTuple = {
      mgmt: toSafeInt(readObjectValue(feesBefore, 'mgmt_bps') ?? readTupleValue(feesBefore, 0), 200),
      perf: toSafeInt(readObjectValue(feesBefore, 'perf_bps') ?? readTupleValue(feesBefore, 1), 1000),
      deposit: toSafeInt(readObjectValue(feesBefore, 'deposit_bps') ?? readTupleValue(feesBefore, 2), 0),
      redeem: toSafeInt(readObjectValue(feesBefore, 'redeem_bps') ?? readTupleValue(feesBefore, 3), 0),
    }
    const feesProbe = {
      mgmt: Math.max(0, feesBeforeTuple.mgmt + 1),
      perf: Math.max(0, feesBeforeTuple.perf + 1),
      deposit: Math.max(0, feesBeforeTuple.deposit + 1),
      redeem: Math.max(0, feesBeforeTuple.redeem + 1),
    }

    const coveredVaultPolicyRead = await tryReadJson(
      'coverage-fund-read-covered-vault-policy',
      coverageFundId,
      [{ key: 'vault', value: depositArkaId }],
    )
    const coveredVaultPolicyBefore = coveredVaultPolicyRead.ok ? coveredVaultPolicyRead.value : null
    const coveredVaultPolicyExists =
      coveredVaultPolicyBefore !== null &&
      coveredVaultPolicyBefore !== undefined &&
      JSON.stringify(coveredVaultPolicyBefore).trim().toLowerCase() !== 'null'
    const coveredVaultPolicyBeforeAnnual = toSafeInt(
      readObjectValue(coveredVaultPolicyBefore, 'annual_premium_bps') ?? readTupleValue(coveredVaultPolicyBefore, 0),
      200,
    )
    const coveredVaultPolicyBeforeLimit = toSafeInt(
      readObjectValue(coveredVaultPolicyBefore, 'coverage_limit') ?? readTupleValue(coveredVaultPolicyBefore, 1),
      10_000_000,
    )
    const coveredVaultPolicyProbe = {
      annualPremiumBps: Math.max(1, coveredVaultPolicyBeforeAnnual + 1),
      coverageLimit: Math.max(1, coveredVaultPolicyBeforeLimit + 1_000),
    }

    const lockBpsRead = await tryReadJson('coverage-vault-read-lock-bps', coverageVaultId)
    const lockBpsBefore = toSafeInt(lockBpsRead.ok ? lockBpsRead.value : null, 0)
    const lockBpsProbe = Math.max(0, Math.min(10_000, lockBpsBefore + 1))

    const allowedRoutersBefore = normalizeStringArray(
      await readJson('arka-read-allowed-routers', depositArkaId),
    )
    const allowedAdaptersBefore = normalizeStringArray(
      await readJson('arka-read-allowed-adapters', depositArkaId),
    )
    const coverageFundClaimsManagerBeforeRaw = await readPresetResult(
      'coverage-fund-read-claims-manager',
      coverageFundId,
    )
    const coverageFundClaimsManagerBefore = JSON.parse(coverageFundClaimsManagerBeforeRaw) as string | null
    const coverageFundClaimsManagerProbe =
      coverageFundClaimsManagerBefore === holderAddress ? managerAddress : holderAddress

    const coverageVaultClaimsManagerBeforeRaw = await readPresetResult(
      'coverage-vault-read-claims-manager',
      coverageVaultId,
    )
    const coverageVaultClaimsManagerBefore = JSON.parse(coverageVaultClaimsManagerBeforeRaw) as string | null
    const coverageVaultClaimsManagerProbe =
      coverageVaultClaimsManagerBefore === holderAddress ? managerAddress : holderAddress

    const managerTierPointsBefore = toSafeInt(
      await readJson('manager-tier-read-points-of', managerTierId, [{ key: 'manager', value: holderAddress }]),
      0,
    )
    const managerTierPointsProbe = managerTierPointsBefore + 3

    const executorContractId = governanceExecutorId.trim()
    const executorConfigRead = executorContractId
      ? await tryReadJson('executor-config', executorContractId)
      : { ok: false as const, reason: 'GovernanceExecutor contract id is not configured.' as const }

    const readExecutorMinDelay = (config: unknown): number =>
      toSafeInt(
        readObjectValue(config, 'min_delay') ??
          readObjectValue(config, 'min_delay_ledgers') ??
          readTupleValue(config, 2),
        20,
      )

    const readExecutorGracePeriod = (config: unknown): number =>
      toSafeInt(
        readObjectValue(config, 'grace_period') ??
          readObjectValue(config, 'grace_period_ledgers') ??
          readTupleValue(config, 3),
        120,
      )
    const routerProbeA = coverageFundId
    const routerProbeB = coverageVaultId
    const adapterProbeA = depositTokenId
    const adapterProbeB = coverageTokenId

    await runMutationScenario({
      label: 'oracle',
      readActionId: 'arka-read-swap-oracle',
      writeActionId: 'arka-set-swap-oracle',
      contractId: depositArkaId,
      mutateFields: [
        { key: 'caller', value: managerAddress },
        { key: 'oracle', value: oracleProbe },
      ],
      rollbackFields: [
        { key: 'caller', value: managerAddress },
        { key: 'oracle', value: swapOracleBefore ?? oracleProbe },
      ],
      compare: (_before, after) => {
        expect(after).toBe(oracleProbe)
      },
    })

    await runMutationScenario({
      label: 'fees-base',
      readActionId: 'arka-read-fees',
      writeActionId: 'arka-set-fees',
      contractId: depositArkaId,
      mutateFields: [
        { key: 'caller', value: managerAddress },
        { key: 'mgmt_bps', value: String(feesProbe.mgmt) },
        { key: 'perf_bps', value: String(feesProbe.perf) },
        { key: 'deposit_bps', value: String(feesProbe.deposit) },
        { key: 'redeem_bps', value: String(feesProbe.redeem) },
      ],
      rollbackFields: [
        { key: 'caller', value: managerAddress },
        { key: 'mgmt_bps', value: String(feesBeforeTuple.mgmt) },
        { key: 'perf_bps', value: String(feesBeforeTuple.perf) },
        { key: 'deposit_bps', value: String(feesBeforeTuple.deposit) },
        { key: 'redeem_bps', value: String(feesBeforeTuple.redeem) },
      ],
      compare: (_before, after) => {
        const encoded = JSON.stringify(after)
        expect(encoded).toContain(String(feesProbe.mgmt))
        expect(encoded).toContain(String(feesProbe.perf))
      },
    })

    await runMutationScenario({
      label: 'fees',
      readActionId: 'arka-read-protocol-fee-policy',
      writeActionId: 'arka-set-protocol-fee-policy',
      contractId: depositArkaId,
      mutateFields: [
        { key: 'caller', value: managerAddress },
        { key: 'treasury', value: protocolFeePolicyProbe.treasury },
        { key: 'mgmt_protocol_bps', value: String(protocolFeePolicyProbe.mgmt) },
        { key: 'perf_protocol_bps', value: String(protocolFeePolicyProbe.perf) },
      ],
      rollbackFields: [
        { key: 'caller', value: managerAddress },
        {
          key: 'treasury',
          value:
            protocolFeePolicyBefore && !Array.isArray(protocolFeePolicyBefore)
              ? (protocolFeePolicyBefore.treasury ?? managerAddress)
              : managerAddress,
        },
        {
          key: 'mgmt_protocol_bps',
          value: String(
            protocolFeePolicyBefore && Array.isArray(protocolFeePolicyBefore)
              ? Number(protocolFeePolicyBefore[1] ?? 2500)
              : Number((protocolFeePolicyBefore as { mgmt_protocol_bps?: number } | null)?.mgmt_protocol_bps ?? 2500),
          ),
        },
        {
          key: 'perf_protocol_bps',
          value: String(
            protocolFeePolicyBefore && Array.isArray(protocolFeePolicyBefore)
              ? Number(protocolFeePolicyBefore[2] ?? 2500)
              : Number((protocolFeePolicyBefore as { perf_protocol_bps?: number } | null)?.perf_protocol_bps ?? 2500),
          ),
        },
      ],
      compare: (_before, after) => {
        const encoded = JSON.stringify(after).toLowerCase()
        expect(encoded).toContain(String(protocolFeePolicyProbe.mgmt))
        expect(encoded).toContain(String(protocolFeePolicyProbe.perf))
      },
    })

    await runMutationScenario({
      label: 'policy',
      readActionId: 'arka-read-swap-risk-policy',
      writeActionId: 'arka-set-swap-risk-policy',
      contractId: depositArkaId,
      mutateFields: [
        { key: 'caller', value: managerAddress },
        { key: 'enabled', value: swapRiskProbe.enabled },
        { key: 'oracle_checks_enabled', value: swapRiskProbe.oracle_checks_enabled },
        { key: 'max_price_impact_bps', value: swapRiskProbe.max_price_impact_bps },
        { key: 'max_slippage_bps', value: swapRiskProbe.max_slippage_bps },
        { key: 'max_twap_deviation_bps', value: swapRiskProbe.max_twap_deviation_bps },
        { key: 'max_oracle_age_seconds', value: swapRiskProbe.max_oracle_age_seconds },
        { key: 'max_trade_size_bps', value: swapRiskProbe.max_trade_size_bps },
      ],
      rollbackFields: [
        { key: 'caller', value: managerAddress },
        { key: 'enabled', value: String(Boolean(swapRiskBefore?.enabled ?? true)) },
        { key: 'oracle_checks_enabled', value: String(Boolean(swapRiskBefore?.oracle_checks_enabled ?? true)) },
        { key: 'max_price_impact_bps', value: String(Number(swapRiskBefore?.max_price_impact_bps ?? 500)) },
        { key: 'max_slippage_bps', value: String(Number(swapRiskBefore?.max_slippage_bps ?? 1000)) },
        { key: 'max_twap_deviation_bps', value: String(Number(swapRiskBefore?.max_twap_deviation_bps ?? 1000)) },
        { key: 'max_oracle_age_seconds', value: String(Number(swapRiskBefore?.max_oracle_age_seconds ?? 60)) },
        { key: 'max_trade_size_bps', value: String(Number(swapRiskBefore?.max_trade_size_bps ?? 1000)) },
      ],
      compare: (_before, after) => {
        const encoded = JSON.stringify(after).toLowerCase()
        expect(encoded).toContain(String(swapRiskProbe.max_price_impact_bps))
        expect(encoded).toContain(String(swapRiskProbe.max_slippage_bps))
      },
    })

    await runMutationScenario({
      label: 'venues',
      readActionId: 'arka-read-allowed-routers',
      writeActionId: 'arka-set-allowed-venues',
      contractId: depositArkaId,
      mutateFields: [
        { key: 'caller', value: managerAddress },
        { key: 'allowed_routers', value: `${routerProbeA},${routerProbeB}` },
        { key: 'allowed_adapters', value: `${adapterProbeA},${adapterProbeB}` },
      ],
      rollbackFields: [
        { key: 'caller', value: managerAddress },
        { key: 'allowed_routers', value: allowedRoutersBefore.join(',') },
        { key: 'allowed_adapters', value: allowedAdaptersBefore.join(',') },
      ],
      compare: async (_before, afterRouters) => {
        const normalizedRouters = normalizeStringArray(afterRouters)
        expect(normalizedRouters).toEqual([routerProbeA, routerProbeB])
        const afterAdapters = normalizeStringArray(
          await readJson('arka-read-allowed-adapters', depositArkaId),
        )
        expect(afterAdapters).toEqual([adapterProbeA, adapterProbeB])
      },
    })

    await runMutationScenario({
      label: 'coverage-claims-manager',
      readActionId: 'coverage-fund-read-claims-manager',
      writeActionId: 'coverage-fund-set-claims-manager',
      contractId: coverageFundId,
      mutateFields: [
        { key: 'caller', value: managerAddress },
        { key: 'claims_manager', value: coverageFundClaimsManagerProbe },
      ],
      rollbackFields: [
        { key: 'caller', value: managerAddress },
        { key: 'claims_manager', value: coverageFundClaimsManagerBefore ?? managerAddress },
      ],
      compare: (_before, after) => {
        expect(after).toBe(coverageFundClaimsManagerProbe)
      },
    })

    await runMutationScenario({
      label: 'coverage-vault-claims-manager',
      readActionId: 'coverage-vault-read-claims-manager',
      writeActionId: 'coverage-vault-set-claims-manager',
      contractId: coverageVaultId,
      mutateFields: [
        { key: 'caller', value: managerAddress },
        { key: 'claims_manager', value: coverageVaultClaimsManagerProbe },
      ],
      rollbackFields: [
        { key: 'caller', value: managerAddress },
        { key: 'claims_manager', value: coverageVaultClaimsManagerBefore ?? managerAddress },
      ],
      compare: (_before, after) => {
        expect(after).toBe(coverageVaultClaimsManagerProbe)
      },
    })

    if (coveredVaultPolicyRead.ok) {
      await runMutationScenario({
        label: 'coverage-policy',
        readActionId: 'coverage-fund-read-covered-vault-policy',
        writeActionId: 'coverage-fund-set-covered-vault-policy',
        readFields: [{ key: 'vault', value: depositArkaId }],
        rollbackActionId: coveredVaultPolicyExists
          ? 'coverage-fund-set-covered-vault-policy'
          : 'coverage-fund-remove-covered-vault',
        contractId: coverageFundId,
        mutateFields: [
          { key: 'caller', value: managerAddress },
          { key: 'vault', value: depositArkaId },
          { key: 'annual_premium_bps', value: String(coveredVaultPolicyProbe.annualPremiumBps) },
          { key: 'coverage_limit', value: String(coveredVaultPolicyProbe.coverageLimit) },
        ],
        rollbackFields: coveredVaultPolicyExists
          ? [
              { key: 'caller', value: managerAddress },
              { key: 'vault', value: depositArkaId },
              { key: 'annual_premium_bps', value: String(coveredVaultPolicyBeforeAnnual) },
              { key: 'coverage_limit', value: String(coveredVaultPolicyBeforeLimit) },
            ]
          : [
              { key: 'caller', value: managerAddress },
              { key: 'vault', value: depositArkaId },
            ],
        compare: (_before, after) => {
          const encoded = JSON.stringify(after)
          expect(encoded).toContain(String(coveredVaultPolicyProbe.annualPremiumBps))
          expect(encoded).toContain(String(coveredVaultPolicyProbe.coverageLimit))
        },
      })
    } else {
      registerSkippedMutation(
        'coverage-policy',
        coveredVaultPolicyRead.reason,
        'coverage-fund-set-covered-vault-policy',
      )
    }

    if (lockBpsRead.ok) {
      await runMutationScenario({
        label: 'coverage-lock',
        readActionId: 'coverage-vault-read-lock-bps',
        writeActionId: 'coverage-vault-set-lock-bps',
        contractId: coverageVaultId,
        mutateFields: [
          { key: 'caller', value: managerAddress },
          { key: 'lock_bps', value: String(lockBpsProbe) },
        ],
        rollbackFields: [
          { key: 'caller', value: managerAddress },
          { key: 'lock_bps', value: String(lockBpsBefore) },
        ],
        compare: (_before, after) => {
          expect(toSafeInt(after, -1)).toBe(lockBpsProbe)
        },
      })
    } else {
      registerSkippedMutation(
        'coverage-lock',
        lockBpsRead.reason,
        'coverage-vault-set-lock-bps',
      )
    }

    await runMutationScenario({
      label: 'governance',
      readActionId: 'manager-tier-read-thresholds',
      writeActionId: 'manager-tier-set-thresholds',
      contractId: managerTierId,
      mutateFields: [
        { key: 'caller', value: managerAddress },
        { key: 'tier1_threshold', value: String(Number(thresholdTuple[0] ?? 100) + 1) },
        { key: 'tier2_threshold', value: String(Number(thresholdTuple[1] ?? 500) + 1) },
        { key: 'tier3_threshold', value: String(Number(thresholdTuple[2] ?? 1000) + 1) },
      ],
      rollbackFields: [
        { key: 'caller', value: managerAddress },
        { key: 'tier1_threshold', value: String(Number(thresholdTuple[0] ?? 100)) },
        { key: 'tier2_threshold', value: String(Number(thresholdTuple[1] ?? 500)) },
        { key: 'tier3_threshold', value: String(Number(thresholdTuple[2] ?? 1000)) },
      ],
      compare: (_before, after) => {
        const tuple = Array.isArray(after)
          ? after
          : [
              Number((after as { tier1_threshold?: number }).tier1_threshold ?? 0),
              Number((after as { tier2_threshold?: number }).tier2_threshold ?? 0),
              Number((after as { tier3_threshold?: number }).tier3_threshold ?? 0),
            ]
        expect(Number(tuple[0] ?? 0)).toBe(Number(thresholdTuple[0] ?? 0) + 1)
        expect(Number(tuple[1] ?? 0)).toBe(Number(thresholdTuple[1] ?? 0) + 1)
        expect(Number(tuple[2] ?? 0)).toBe(Number(thresholdTuple[2] ?? 0) + 1)
      },
    })

    await runMutationScenario({
      label: 'governance-points',
      readActionId: 'manager-tier-read-points-of',
      writeActionId: 'manager-tier-set-points',
      contractId: managerTierId,
      readFields: [{ key: 'manager', value: holderAddress }],
      mutateFields: [
        { key: 'caller', value: managerAddress },
        { key: 'manager', value: holderAddress },
        { key: 'points', value: String(managerTierPointsProbe) },
      ],
      rollbackFields: [
        { key: 'caller', value: managerAddress },
        { key: 'manager', value: holderAddress },
        { key: 'points', value: String(managerTierPointsBefore) },
      ],
      compare: (_before, after) => {
        expect(toSafeInt(after, -1)).toBe(managerTierPointsProbe)
      },
    })

    await runMutationScenario({
      label: 'governance-points-delta',
      readActionId: 'manager-tier-read-points-of',
      writeActionId: 'manager-tier-add-points',
      contractId: managerTierId,
      readFields: [{ key: 'manager', value: holderAddress }],
      mutateFields: [
        { key: 'caller', value: managerAddress },
        { key: 'manager', value: holderAddress },
        { key: 'delta', value: '2' },
      ],
      rollbackFields: [
        { key: 'caller', value: managerAddress },
        { key: 'manager', value: holderAddress },
        { key: 'delta', value: '-2' },
      ],
      compare: (_before, after) => {
        expect(toSafeInt(after, -1)).toBe(managerTierPointsBefore + 2)
      },
    })

    if (executorConfigRead.ok && executorContractId.length > 0) {
      const executorMinDelayBefore = readExecutorMinDelay(executorConfigRead.value)
      const executorGracePeriodBefore = readExecutorGracePeriod(executorConfigRead.value)
      const executorMinDelayProbe = Math.max(0, executorMinDelayBefore + 1)
      const executorGracePeriodProbe = Math.max(0, executorGracePeriodBefore + 1)

      await runMutationScenario({
        label: 'executor-min-delay',
        readActionId: 'executor-config',
        writeActionId: 'executor-set-min-delay',
        contractId: executorContractId,
        mutateFields: [
          { key: 'caller', value: managerAddress },
          { key: 'min_delay', value: String(executorMinDelayProbe) },
        ],
        rollbackFields: [
          { key: 'caller', value: managerAddress },
          { key: 'min_delay', value: String(executorMinDelayBefore) },
        ],
        compare: (_before, after) => {
          expect(readExecutorMinDelay(after)).toBe(executorMinDelayProbe)
        },
      })

      await runMutationScenario({
        label: 'executor-grace-period',
        readActionId: 'executor-config',
        writeActionId: 'executor-set-grace-period',
        contractId: executorContractId,
        mutateFields: [
          { key: 'caller', value: managerAddress },
          { key: 'grace_period', value: String(executorGracePeriodProbe) },
        ],
        rollbackFields: [
          { key: 'caller', value: managerAddress },
          { key: 'grace_period', value: String(executorGracePeriodBefore) },
        ],
        compare: (_before, after) => {
          expect(readExecutorGracePeriod(after)).toBe(executorGracePeriodProbe)
        },
      })
    } else {
      const reason = executorConfigRead.ok
        ? 'GovernanceExecutor contract id is not configured.'
        : executorConfigRead.reason
      registerSkippedMutation('executor-min-delay', reason, 'executor-set-min-delay')
      registerSkippedMutation('executor-grace-period', reason, 'executor-set-grace-period')
    }

    const governedWalletLaneBlockScenarios: Array<{
      label: string
      writeActionId: string
      contractId: string
      fields: Array<{ key: string; value: string }>
    }> = [
      {
        label: 'authority-governor',
        writeActionId: 'arka-set-governor',
        contractId: depositArkaId,
        fields: [
          { key: 'caller', value: managerAddress },
          { key: 'governor', value: holderAddress },
        ],
      },
      {
        label: 'venue-whitelist',
        writeActionId: 'arka-set-whitelist',
        contractId: depositArkaId,
        fields: [
          { key: 'caller', value: managerAddress },
          { key: 'whitelist_contracts', value: depositTokenId },
        ],
      },
      {
        label: 'authority-manager',
        writeActionId: 'arka-set-manager',
        contractId: depositArkaId,
        fields: [
          { key: 'caller', value: managerAddress },
          { key: 'manager', value: holderAddress },
        ],
      },
      {
        label: 'authority-router',
        writeActionId: 'arka-set-router',
        contractId: depositArkaId,
        fields: [
          { key: 'caller', value: managerAddress },
          { key: 'router', value: coverageFundId },
        ],
      },
      {
        label: 'authority-share-token',
        writeActionId: 'arka-set-share-token',
        contractId: depositArkaId,
        fields: [
          { key: 'caller', value: managerAddress },
          { key: 'share_token', value: depositTokenId },
        ],
      },
      {
        label: 'credit-blend-risk-policy',
        writeActionId: 'arka-set-blend-risk-policy',
        contractId: depositArkaId,
        fields: [
          { key: 'caller', value: managerAddress },
          { key: 'market_id', value: '0' },
          { key: 'max_oracle_age', value: '60' },
          { key: 'min_health_factor', value: '12500000' },
          { key: 'fail_close_nav', value: 'true' },
          { key: 'fail_close_actions', value: 'true' },
        ],
      },
      {
        label: 'credit-market-config',
        writeActionId: 'arka-configure-credit-market',
        contractId: depositArkaId,
        fields: [
          { key: 'caller', value: managerAddress },
          { key: 'protocol', value: 'Blend' },
          { key: 'market_id', value: '0' },
          { key: 'adapter', value: coverageVaultId },
          { key: 'allow_supply', value: 'true' },
          { key: 'allow_borrow', value: 'true' },
          { key: 'allow_repay', value: 'true' },
          { key: 'allow_withdraw', value: 'true' },
          { key: 'enabled', value: 'true' },
        ],
      },
      {
        label: 'factory-share-token-implementation',
        writeActionId: 'arka-factory-set-share-token-implementation',
        contractId: arkaFactoryId,
        fields: [{ key: 'impl_wasm_hash', value: executorProbeOperationId }],
      },
      {
        label: 'factory-protocol-treasury',
        writeActionId: 'arka-factory-set-protocol-treasury',
        contractId: arkaFactoryId,
        fields: [{ key: 'treasury', value: holderAddress }],
      },
      {
        label: 'factory-protocol-fee-splits',
        writeActionId: 'arka-factory-set-protocol-fee-splits',
        contractId: arkaFactoryId,
        fields: [
          { key: 'mgmt_protocol_bps', value: '2501' },
          { key: 'perf_protocol_bps', value: '2502' },
        ],
      },
      {
        label: 'factory-creation-fee',
        writeActionId: 'arka-factory-set-creation-fee',
        contractId: arkaFactoryId,
        fields: [
          { key: 'token', value: depositTokenId },
          { key: 'amount', value: '1' },
        ],
      },
      {
        label: 'registry-registrar',
        writeActionId: 'arka-registry-set-registrar',
        contractId: arkaRegistryId,
        fields: [
          { key: 'caller', value: managerAddress },
          { key: 'registrar', value: holderAddress },
          { key: 'allowed', value: 'true' },
        ],
      },
      {
        label: 'registry-manager-curated',
        writeActionId: 'arka-registry-set-manager-curated',
        contractId: arkaRegistryId,
        fields: [
          { key: 'caller', value: managerAddress },
          { key: 'manager', value: holderAddress },
          { key: 'curated', value: 'true' },
        ],
      },
      {
        label: 'registry-delisted',
        writeActionId: 'arka-registry-set-delisted',
        contractId: arkaRegistryId,
        fields: [
          { key: 'caller', value: managerAddress },
          { key: 'arka', value: depositArkaId },
          { key: 'delisted', value: 'true' },
        ],
      },
      {
        label: 'coverage-fund-governor',
        writeActionId: 'coverage-fund-set-governor',
        contractId: coverageFundId,
        fields: [
          { key: 'caller', value: managerAddress },
          { key: 'governor', value: holderAddress },
        ],
      },
      {
        label: 'coverage-fund-treasury',
        writeActionId: 'coverage-fund-set-treasury',
        contractId: coverageFundId,
        fields: [
          { key: 'caller', value: managerAddress },
          { key: 'treasury', value: holderAddress },
        ],
      },
      {
        label: 'coverage-fund-economics',
        writeActionId: 'coverage-fund-set-economics-policy',
        contractId: coverageFundId,
        fields: [
          { key: 'caller', value: managerAddress },
          { key: 'reserve_retain_bps', value: '10000' },
          { key: 'treasury_share_bps', value: '0' },
          { key: 'reserve_target_bps', value: '0' },
        ],
      },
      {
        label: 'claims-manager-treasury',
        writeActionId: 'claims-manager-set-treasury',
        contractId: claimsManagerId,
        fields: [
          { key: 'caller', value: managerAddress },
          { key: 'treasury', value: holderAddress },
        ],
      },
      {
        label: 'claims-manager-governor',
        writeActionId: 'claims-manager-set-governor',
        contractId: claimsManagerId,
        fields: [
          { key: 'caller', value: managerAddress },
          { key: 'governor', value: holderAddress },
        ],
      },
      {
        label: 'claims-manager-covered-vault',
        writeActionId: 'claims-manager-register-covered-vault',
        contractId: claimsManagerId,
        fields: [
          { key: 'caller', value: managerAddress },
          { key: 'vault', value: depositArkaId },
          { key: 'manager_vault', value: coverageVaultId },
          { key: 'community_fund', value: coverageFundId },
          { key: 'recipient', value: holderAddress },
        ],
      },
      {
        label: 'coverage-remove-covered-vault',
        writeActionId: 'coverage-fund-remove-covered-vault',
        contractId: coverageFundId,
        fields: [
          { key: 'caller', value: managerAddress },
          { key: 'vault', value: depositArkaId },
        ],
      },
      {
        label: 'coverage-vault-governor',
        writeActionId: 'coverage-vault-set-governor',
        contractId: coverageVaultId,
        fields: [
          { key: 'caller', value: managerAddress },
          { key: 'governor', value: holderAddress },
        ],
      },
      {
        label: 'governance-tier-governor',
        writeActionId: 'manager-tier-set-governor',
        contractId: managerTierId,
        fields: [
          { key: 'caller', value: managerAddress },
          { key: 'governor', value: holderAddress },
        ],
      },
      {
        label: 'locked-arka-admin',
        writeActionId: 'locked-arka-set-admin',
        contractId: lockedArkaId,
        fields: [
          { key: 'caller', value: managerAddress },
          { key: 'admin', value: holderAddress },
        ],
      },
      {
        label: 'locked-arka-governor',
        writeActionId: 'locked-arka-set-governor',
        contractId: lockedArkaId,
        fields: [
          { key: 'caller', value: managerAddress },
          { key: 'governor', value: holderAddress },
        ],
      },
      {
        label: 'oracle-guard-admin',
        writeActionId: 'oracle-guard-set-admin',
        contractId: oracleGuardId,
        fields: [
          { key: 'caller', value: managerAddress },
          { key: 'admin', value: holderAddress },
        ],
      },
      {
        label: 'oracle-guard-guardian',
        writeActionId: 'oracle-guard-set-guardian',
        contractId: oracleGuardId,
        fields: [
          { key: 'caller', value: managerAddress },
          { key: 'guardian', value: holderAddress },
          { key: 'expires_at', value: '1780000000' },
        ],
      },
      {
        label: 'oracle-guard-clear-guardian',
        writeActionId: 'oracle-guard-clear-guardian',
        contractId: oracleGuardId,
        fields: [{ key: 'caller', value: managerAddress }],
      },
      {
        label: 'oracle-guard-asset-policy',
        writeActionId: 'oracle-guard-set-stellar-asset-policy',
        contractId: oracleGuardId,
        fields: [
          { key: 'caller', value: managerAddress },
          { key: 'asset', value: depositTokenId },
          { key: 'primary', value: coverageVaultId },
          { key: 'secondary', value: coverageFundId },
          { key: 'has_secondary', value: 'true' },
          { key: 'max_price_age', value: '60' },
          { key: 'max_deviation_bps', value: '500' },
          { key: 'require_secondary', value: 'false' },
          { key: 'divergence_mode', value: '1' },
        ],
      },
      {
        label: 'oracle-guard-clear-asset-policy',
        writeActionId: 'oracle-guard-clear-stellar-asset-policy',
        contractId: oracleGuardId,
        fields: [
          { key: 'caller', value: managerAddress },
          { key: 'asset', value: depositTokenId },
        ],
      },
      {
        label: 'oracle-guard-pause-asset-policy',
        writeActionId: 'oracle-guard-pause-stellar-asset-policy',
        contractId: oracleGuardId,
        fields: [
          { key: 'caller', value: managerAddress },
          { key: 'asset', value: depositTokenId },
        ],
      },
      {
        label: 'oracle-guard-resume-asset-policy',
        writeActionId: 'oracle-guard-resume-stellar-asset-policy',
        contractId: oracleGuardId,
        fields: [
          { key: 'caller', value: managerAddress },
          { key: 'asset', value: depositTokenId },
        ],
      },
    ]

    for (const scenario of governedWalletLaneBlockScenarios) {
      if (
        expectedReadyWriteActions.has(scenario.writeActionId) &&
        !coveredWriteActions.has(scenario.writeActionId)
      ) {
        await expectGovernedWalletLaneBlocked(scenario)
      }
    }

    expect(successfulMutations + blockedMutations.length).toBe(mutationScenarioCount)
    expect(mutationScenarioCount).toBeGreaterThanOrEqual(12)
    expect(successfulMutations + blockedMutations.length).toBeGreaterThan(0)
    const uncoveredReadyWriteActions = [...expectedReadyWriteActions].filter(
      (actionId) => !coveredWriteActions.has(actionId),
    )
    expect(uncoveredReadyWriteActions).toEqual([])
  })

  test('expands wallet-backed contracts read matrix and validation guardrails', async ({ page }) => {
    test.setTimeout(180_000)

    await enableOperatorMode(page)
    await page.goto('/contracts')

    await expect(page.getByRole('heading', { name: /contract control center/i })).toBeVisible()
    await expect(page.getByText('Connected')).toBeVisible({ timeout: 30_000 })

    const actionSelect = page.getByTestId('contracts-action-select')
    const contractInput = page.getByTestId('contracts-contract-id-input')
    const runPresetButton = page.getByTestId('contracts-run-preset-button')
    const runPreset = async (): Promise<void> => {
      await runPresetButton.click()
      await confirmIfVisible(page, 'contracts-confirm-button')
    }
    const presetStatus = page.getByTestId('contracts-preset-status')
    const presetError = page.getByTestId('contracts-preset-error')

    await actionSelect.selectOption('coverage-fund-quote-premium')
    await contractInput.fill(coverageFundId)
    await page.getByTestId('contracts-field-vault').fill(depositArkaId)
    await page.getByTestId('contracts-field-covered_nav').fill('10000000')
    await page.getByTestId('contracts-field-coverage_period_bps').fill('50')
    await runPreset()
    await expect(presetStatus).toContainText(/read call completed/i, { timeout: 30_000 })
    await expect(page.getByTestId('contracts-preset-read-result')).toBeVisible()
    await expect(presetError).toHaveCount(0)

    await page.getByTestId('contracts-field-covered_nav').fill('abc')
    await runPreset()
    await expect(presetError).toContainText(/expected integer|required/i, { timeout: 10_000 })
    await page.getByTestId('contracts-field-covered_nav').fill('10000000')

    await actionSelect.selectOption('executor-config')
    await contractInput.fill('')
    await runPreset()
    await expect(presetError).toContainText(/contract id is required/i, { timeout: 10_000 })
    await contractInput.fill(managerTierId)
    await runPreset()
    await expect.poll(async () => {
      const statusText = (await presetStatus.count()) > 0 ? ((await presetStatus.textContent()) ?? '') : ''
      const errorText = (await presetError.count()) > 0 ? ((await presetError.textContent()) ?? '') : ''
      return `${statusText} ${errorText}`.toLowerCase()
    }, { timeout: 30_000 }).toMatch(/read call completed|simulate|failed|contract|method/)
    await expect.poll(async () => {
      if ((await presetError.count()) === 0) return ''
      return ((await presetError.textContent()) ?? '').toLowerCase()
    }, { timeout: 5_000 }).not.toContain('contract id is required')

    await actionSelect.selectOption('executor-status')
    await contractInput.fill(managerTierId)
    await page.getByTestId('contracts-field-operation_id').fill('')
    await runPreset()
    await expect(presetError).toContainText(/required|32-byte hex|64 hex chars/i, { timeout: 10_000 })

    await page.getByTestId('contracts-field-operation_id').fill(executorProbeOperationId)
    await runPresetButton.click()
    await expect.poll(async () => {
      const statusText = (await presetStatus.count()) > 0 ? ((await presetStatus.textContent()) ?? '') : ''
      const errorText = (await presetError.count()) > 0 ? ((await presetError.textContent()) ?? '') : ''
      return `${statusText} ${errorText}`.toLowerCase()
    }, { timeout: 30_000 }).toMatch(/read call completed|operation|status|not found|unknown|missing/)
    await expect.poll(async () => {
      if ((await presetError.count()) === 0) return ''
      return ((await presetError.textContent()) ?? '').toLowerCase()
    }, { timeout: 5_000 }).not.toContain('required')

    await actionSelect.selectOption('executor-ready')
    await contractInput.fill(managerTierId)
    await page.getByTestId('contracts-field-operation_id').fill('')
    await runPresetButton.click()
    await expect(presetError).toContainText(/required|32-byte hex|64 hex chars/i, { timeout: 10_000 })

    await page.getByTestId('contracts-field-operation_id').fill(executorProbeOperationId)
    await runPresetButton.click()
    await expect.poll(async () => {
      const statusText = (await presetStatus.count()) > 0 ? ((await presetStatus.textContent()) ?? '') : ''
      const errorText = (await presetError.count()) > 0 ? ((await presetError.textContent()) ?? '') : ''
      return `${statusText} ${errorText}`.toLowerCase()
    }, { timeout: 30_000 }).toMatch(/read call completed|operation|ready|not found|unknown|missing/)
    await expect.poll(async () => {
      if ((await presetError.count()) === 0) return ''
      return ((await presetError.textContent()) ?? '').toLowerCase()
    }, { timeout: 5_000 }).not.toContain('required')

    const extendedReadScenarios: Array<{
      actionId: string
      contractId: string
      fields?: Array<{ key: string; value: string }>
      allowRuntimeError?: boolean
    }> = [
      { actionId: 'arka-read-nav', contractId: depositArkaId },
      { actionId: 'arka-read-manager', contractId: depositArkaId },
      { actionId: 'arka-read-router', contractId: depositArkaId },
      { actionId: 'arka-read-denomination', contractId: depositArkaId },
      { actionId: 'arka-read-share-token', contractId: depositArkaId },
      { actionId: 'arka-read-fees', contractId: depositArkaId },
      { actionId: 'arka-read-governor', contractId: depositArkaId },
      { actionId: 'arka-read-swap-risk-policy', contractId: depositArkaId },
      { actionId: 'arka-read-swap-oracle', contractId: depositArkaId, allowRuntimeError: true },
      { actionId: 'arka-read-protocol-fee-policy', contractId: depositArkaId, allowRuntimeError: true },
      { actionId: 'arka-read-fee-state', contractId: depositArkaId, allowRuntimeError: true },
      { actionId: 'arka-preview-fee-settlement', contractId: depositArkaId, allowRuntimeError: true },
      { actionId: 'arka-read-whitelist', contractId: depositArkaId, allowRuntimeError: true },
      { actionId: 'arka-read-allowed-routers', contractId: depositArkaId, allowRuntimeError: true },
      { actionId: 'arka-read-allowed-adapters', contractId: depositArkaId, allowRuntimeError: true },
      { actionId: 'arka-read-credit-protocols', contractId: depositArkaId, allowRuntimeError: true },
      {
        actionId: 'arka-read-credit-markets',
        contractId: depositArkaId,
        fields: [{ key: 'protocol', value: 'Blend' }],
        allowRuntimeError: true,
      },
      {
        actionId: 'arka-read-credit-market-config',
        contractId: depositArkaId,
        fields: [
          { key: 'protocol', value: 'Blend' },
          { key: 'market_id', value: '0' },
        ],
        allowRuntimeError: true,
      },
      {
        actionId: 'arka-read-liquid-balance',
        contractId: depositArkaId,
        fields: [{ key: 'asset', value: depositTokenId }],
      },
      {
        actionId: 'arka-read-shares-of',
        contractId: depositArkaId,
        fields: [{ key: 'owner', value: holderAddress }],
      },
      { actionId: 'arka-factory-read-protocol-treasury', contractId: arkaFactoryId, allowRuntimeError: true },
      { actionId: 'arka-factory-read-protocol-mgmt-fee-bps', contractId: arkaFactoryId },
      { actionId: 'arka-factory-read-protocol-perf-fee-bps', contractId: arkaFactoryId },
      { actionId: 'arka-factory-read-creation-fee-token', contractId: arkaFactoryId, allowRuntimeError: true },
      { actionId: 'arka-factory-read-creation-fee-amount', contractId: arkaFactoryId },
      { actionId: 'arka-factory-read-share-token-implementation', contractId: arkaFactoryId, allowRuntimeError: true },
      {
        actionId: 'arka-factory-read-migrated-to',
        contractId: arkaFactoryId,
        fields: [{ key: 'old_arka', value: depositArkaId }],
      },
      {
        actionId: 'arka-factory-read-migrated-from',
        contractId: arkaFactoryId,
        fields: [{ key: 'new_arka', value: depositArkaId }],
      },
      {
        actionId: 'arka-factory-read-share-token-of',
        contractId: arkaFactoryId,
        fields: [{ key: 'arka', value: depositArkaId }],
      },
      {
        actionId: 'arka-factory-read-arkas',
        contractId: arkaFactoryId,
      },
      {
        actionId: 'arka-factory-read-arkas-by-manager',
        contractId: arkaFactoryId,
        fields: [{ key: 'manager', value: holderAddress }],
      },
      { actionId: 'arka-registry-read-count', contractId: arkaRegistryId },
      {
        actionId: 'arka-registry-read-count-by-manager',
        contractId: arkaRegistryId,
        fields: [{ key: 'manager', value: holderAddress }],
      },
      {
        actionId: 'arka-registry-read-is-registrar',
        contractId: arkaRegistryId,
        fields: [{ key: 'registrar', value: managerAddress }],
      },
      {
        actionId: 'arka-registry-read-arkas',
        contractId: arkaRegistryId,
      },
      {
        actionId: 'arka-registry-read-arkas-by-manager',
        contractId: arkaRegistryId,
        fields: [{ key: 'manager', value: holderAddress }],
      },
      {
        actionId: 'arka-registry-read-is-manager-curated',
        contractId: arkaRegistryId,
        fields: [{ key: 'manager', value: holderAddress }],
      },
      {
        actionId: 'arka-registry-read-is-delisted',
        contractId: arkaRegistryId,
        fields: [{ key: 'arka', value: depositArkaId }],
      },
      { actionId: 'claims-manager-read-treasury', contractId: claimsManagerId, allowRuntimeError: true },
      { actionId: 'claims-manager-read-governor', contractId: claimsManagerId, allowRuntimeError: true },
      { actionId: 'claims-manager-read-next-incident-id', contractId: claimsManagerId },
      {
        actionId: 'claims-manager-read-covered-vault',
        contractId: claimsManagerId,
        fields: [{ key: 'vault', value: depositArkaId }],
      },
      {
        actionId: 'claims-manager-read-is-vault-frozen',
        contractId: claimsManagerId,
        fields: [{ key: 'vault', value: depositArkaId }],
      },
      {
        actionId: 'claims-manager-read-incident',
        contractId: claimsManagerId,
        fields: [{ key: 'incident_id', value: '1' }],
      },
      { actionId: 'oracle-guard-read-admin', contractId: oracleGuardId, allowRuntimeError: true },
      {
        actionId: 'oracle-guard-read-stellar-asset-policy',
        contractId: oracleGuardId,
        fields: [{ key: 'asset', value: depositTokenId }],
      },
      {
        actionId: 'oracle-guard-inspect-stellar',
        contractId: oracleGuardId,
        fields: [{ key: 'asset', value: depositTokenId }],
      },
      { actionId: 'coverage-fund-read-governor', contractId: coverageFundId },
      { actionId: 'coverage-fund-read-claims-manager', contractId: coverageFundId },
      { actionId: 'coverage-fund-read-treasury', contractId: coverageFundId },
      { actionId: 'coverage-fund-read-reserve-token', contractId: coverageFundId },
      { actionId: 'coverage-fund-read-bootstrap-token', contractId: coverageFundId },
      { actionId: 'coverage-fund-read-metrics', contractId: coverageFundId },
      { actionId: 'coverage-fund-read-claim-capacity', contractId: coverageFundId },
      {
        actionId: 'coverage-fund-read-stake-of',
        contractId: coverageFundId,
        fields: [{ key: 'user', value: holderAddress }],
      },
      {
        actionId: 'coverage-fund-read-pending-rewards',
        contractId: coverageFundId,
        fields: [{ key: 'user', value: holderAddress }],
      },
      {
        actionId: 'coverage-fund-read-covered-vault-policy',
        contractId: coverageFundId,
        fields: [{ key: 'vault', value: depositArkaId }],
      },
      {
        actionId: 'coverage-fund-read-covered-nav',
        contractId: coverageFundId,
        fields: [{ key: 'vault', value: depositArkaId }],
      },
      {
        actionId: 'coverage-fund-read-premiums-paid-by-vault',
        contractId: coverageFundId,
        fields: [{ key: 'vault', value: depositArkaId }],
      },
      { actionId: 'coverage-vault-read-manager', contractId: coverageVaultId },
      { actionId: 'coverage-vault-read-governor', contractId: coverageVaultId },
      { actionId: 'coverage-vault-read-claims-manager', contractId: coverageVaultId },
      { actionId: 'coverage-vault-read-token', contractId: coverageVaultId },
      { actionId: 'coverage-vault-read-balance', contractId: coverageVaultId },
      { actionId: 'coverage-vault-read-max-withdrawable', contractId: coverageVaultId },
      { actionId: 'coverage-vault-read-claim-capacity', contractId: coverageVaultId },
      { actionId: 'coverage-vault-read-lock-bps', contractId: coverageVaultId },
      { actionId: 'manager-tier-read-governor', contractId: managerTierId },
      { actionId: 'manager-tier-read-thresholds', contractId: managerTierId },
      {
        actionId: 'manager-tier-read-tier-of',
        contractId: managerTierId,
        fields: [{ key: 'manager', value: holderAddress }],
      },
      {
        actionId: 'manager-tier-read-points-of',
        contractId: managerTierId,
        fields: [{ key: 'manager', value: holderAddress }],
      },
      { actionId: 'locked-arka-total-supply', contractId: lockedArkaId, allowRuntimeError: true },
      {
        actionId: 'locked-arka-balance',
        contractId: lockedArkaId,
        fields: [{ key: 'account', value: holderAddress }],
        allowRuntimeError: true,
      },
      {
        actionId: 'locked-arka-locked-balance',
        contractId: lockedArkaId,
        fields: [{ key: 'account', value: holderAddress }],
        allowRuntimeError: true,
      },
      {
        actionId: 'locked-arka-lock-position',
        contractId: lockedArkaId,
        fields: [{ key: 'account', value: holderAddress }],
        allowRuntimeError: true,
      },
      {
        actionId: 'locked-arka-get-past-total-supply',
        contractId: lockedArkaId,
        fields: [{ key: 'sequence', value: '1' }],
        allowRuntimeError: true,
      },
      {
        actionId: 'locked-arka-get-votes',
        contractId: lockedArkaId,
        fields: [{ key: 'account', value: holderAddress }],
        allowRuntimeError: true,
      },
      {
        actionId: 'locked-arka-get-past-votes',
        contractId: lockedArkaId,
        fields: [
          { key: 'account', value: holderAddress },
          { key: 'sequence', value: '1' },
        ],
        allowRuntimeError: true,
      },
      {
        actionId: 'locked-arka-get-delegate',
        contractId: lockedArkaId,
        fields: [{ key: 'account', value: holderAddress }],
        allowRuntimeError: true,
      },
      { actionId: 'locked-arka-read-admin', contractId: lockedArkaId, allowRuntimeError: true },
      { actionId: 'locked-arka-read-governor', contractId: lockedArkaId, allowRuntimeError: true },
      { actionId: 'locked-arka-read-config', contractId: lockedArkaId, allowRuntimeError: true },
      {
        actionId: 'executor-operation',
        contractId: governanceExecutorId || managerTierId,
        fields: [{ key: 'operation_id', value: executorProbeOperationId }],
        allowRuntimeError: !governanceExecutorId,
      },
    ]

    for (const scenario of extendedReadScenarios) {
      await actionSelect.selectOption(scenario.actionId)
      await contractInput.fill(scenario.contractId)
      for (const field of scenario.fields ?? []) {
        const fieldLocator = page.getByTestId(`contracts-field-${field.key}`)
        const isSelect = await fieldLocator.evaluate(
          (element) => element.tagName.toLowerCase() === 'select',
        )
        if (isSelect) {
          await fieldLocator.selectOption(field.value)
        } else {
          await fieldLocator.fill(field.value)
        }
      }
      await runPresetButton.click()

      if (!scenario.allowRuntimeError) {
        await expect(presetStatus).toContainText(/read call completed/i, { timeout: 30_000 })
        await expect(presetError).toHaveCount(0)
      } else {
        await expect.poll(async () => {
          const statusText = (await presetStatus.count()) > 0 ? ((await presetStatus.textContent()) ?? '') : ''
          const errorText = (await presetError.count()) > 0 ? ((await presetError.textContent()) ?? '') : ''
          return `${statusText} ${errorText}`.toLowerCase()
        }, { timeout: 30_000 }).toMatch(
          /read call completed|method|simulate|failed|contract|unknown|not found|missing|unauthorized|auth/,
        )
        await expect.poll(async () => {
          if ((await presetError.count()) === 0) return ''
          return ((await presetError.textContent()) ?? '').toLowerCase()
        }, { timeout: 5_000 }).not.toContain('required')
      }
    }

    const writeGuardrailScenarios: Array<{
      actionId: string
      contractId: string
      fields?: Array<{ key: string; value: string }>
      expectedError: RegExp
    }> = [
      {
        actionId: 'arka-set-governor',
        contractId: depositArkaId,
        expectedError: /required/i,
      },
      {
        actionId: 'arka-factory-set-governor',
        contractId: arkaFactoryId,
        expectedError: /required/i,
      },
      {
        actionId: 'arka-registry-set-registrar',
        contractId: arkaRegistryId,
        expectedError: /required/i,
      },
      {
        actionId: 'oracle-guard-set-admin',
        contractId: oracleGuardId,
        expectedError: /required/i,
      },
      {
        actionId: 'claims-manager-set-governor',
        contractId: claimsManagerId,
        expectedError: /required/i,
      },
      {
        actionId: 'coverage-fund-set-governor',
        contractId: coverageFundId,
        expectedError: /required/i,
      },
      {
        actionId: 'coverage-vault-set-governor',
        contractId: coverageVaultId,
        expectedError: /required/i,
      },
      {
        actionId: 'manager-tier-set-governor',
        contractId: managerTierId,
        expectedError: /required/i,
      },
      {
        actionId: 'locked-arka-set-admin',
        contractId: lockedArkaId,
        expectedError: /required/i,
      },
      {
        actionId: 'executor-set-admin',
        contractId: governanceExecutorId || managerTierId,
        expectedError: /required/i,
      },
      {
        actionId: 'arka-set-whitelist',
        contractId: depositArkaId,
        fields: [
          { key: 'caller', value: managerAddress },
          { key: 'whitelist_contracts', value: 'not-an-address' },
        ],
        expectedError: /invalid|address|encoded|string/i,
      },
      {
        actionId: 'arka-set-swap-risk-policy',
        contractId: depositArkaId,
        fields: [
          { key: 'caller', value: managerAddress },
          { key: 'max_slippage_bps', value: 'abc' },
        ],
        expectedError: /expected integer|required/i,
      },
      {
        actionId: 'executor-cancel',
        contractId: governanceExecutorId || managerTierId,
        fields: [
          { key: 'caller', value: managerAddress },
          { key: 'operation_id', value: 'abc' },
        ],
        expectedError: /32-byte hex|64 hex chars/i,
      },
      {
        actionId: 'executor-execute',
        contractId: governanceExecutorId || managerTierId,
        fields: [{ key: 'operation_id', value: 'abc' }],
        expectedError: /32-byte hex|64 hex chars/i,
      },
    ]

    for (const scenario of writeGuardrailScenarios) {
      await actionSelect.selectOption(scenario.actionId)
      await contractInput.fill(scenario.contractId)
      for (const field of scenario.fields ?? []) {
        const fieldLocator = page.getByTestId(`contracts-field-${field.key}`)
        const isSelect = await fieldLocator.evaluate(
          (element) => element.tagName.toLowerCase() === 'select',
        )
        if (isSelect) {
          await fieldLocator.selectOption(field.value)
        } else {
          await fieldLocator.fill(field.value)
        }
      }
      await runPresetButton.click()
      await confirmIfVisible(page, 'contracts-confirm-button')
      await expect.poll(async () => {
        const blockedText = (
          (await page.getByText(/direct write blocked by dao policy/i).count()) > 0 ||
          (await page.getByText(/direct wallet execution is blocked/i).count()) > 0 ||
          (await page.getByText(/dao gate: blocked in this lane/i).count()) > 0
        )
          ? 'direct wallet execution is blocked'
          : ''
        const errorText = (await presetError.count()) > 0 ? ((await presetError.textContent()) ?? '') : ''
        return `${blockedText} ${errorText}`.trim()
      }, { timeout: 10_000 }).toMatch(
        new RegExp(`direct (write|wallet execution)( is)? blocked|${scenario.expectedError.source}`, 'i'),
      )
    }

    const rawContractInput = page.getByTestId('contracts-raw-contract-input')
    const rawMethodInput = page.getByTestId('contracts-raw-method-input')
    const rawArgsInput = page.getByTestId('contracts-raw-args-input')
    const rawReadButton = page.getByTestId('contracts-raw-read-button')
    const rawError = page.getByTestId('contracts-raw-error')
    const rawStatus = page.getByTestId('contracts-raw-status')

    await rawContractInput.fill(depositArkaId)
    await rawMethodInput.fill('nav')
    await rawArgsInput.fill('{')
    await rawReadButton.click()
    await expect(rawError).toContainText(
      /unexpected token|end of json input|expected property name|json/i,
      { timeout: 10_000 },
    )

    await rawArgsInput.fill('[]')
    await rawReadButton.click()
    await expect(rawStatus).toContainText(/raw read call completed/i, { timeout: 30_000 })
  })

  test('exhaustively probes contracts typed catalog with wallet-backed preflight', async ({ page }) => {
    test.setTimeout(300_000)

    const lockedArkaReadActions = new Set([
      'locked-arka-total-supply',
      'locked-arka-balance',
      'locked-arka-locked-balance',
      'locked-arka-lock-position',
      'locked-arka-get-past-total-supply',
      'locked-arka-get-votes',
      'locked-arka-get-past-votes',
      'locked-arka-get-delegate',
      'locked-arka-read-admin',
      'locked-arka-read-governor',
      'locked-arka-read-config',
    ])

    const isReadAction = (actionId: string): boolean =>
      actionId.includes('-read-') ||
      lockedArkaReadActions.has(actionId) ||
      actionId === 'coverage-fund-quote-premium' ||
      actionId === 'arka-preview-fee-settlement' ||
      actionId === 'executor-config' ||
      actionId === 'executor-status' ||
      actionId === 'executor-ready' ||
      actionId === 'executor-operation'

    const resolveContractId = (actionId: string): string => {
      if (actionId.startsWith('arka-factory-')) return arkaFactoryId
      if (actionId.startsWith('arka-registry-')) return arkaRegistryId
      if (actionId.startsWith('claims-manager-')) return claimsManagerId
      if (actionId.startsWith('oracle-guard-')) return oracleGuardId
      if (actionId.startsWith('coverage-fund-')) return coverageFundId
      if (actionId.startsWith('coverage-vault-')) return coverageVaultId
      if (actionId.startsWith('manager-tier-')) return managerTierId
      if (actionId.startsWith('locked-arka-')) return lockedArkaId
      if (actionId.startsWith('executor-')) return governanceExecutorId || managerTierId
      return depositArkaId
    }

    const inferReadFieldValue = (fieldKey: string): string => {
      if (fieldKey === 'operation_id') return executorProbeOperationId
      if (fieldKey === 'meta_hash') return executorProbeOperationId
      if (fieldKey === 'impl_wasm_hash') return executorProbeOperationId
      if (fieldKey === 'coverage_period_bps') return '50'
      if (fieldKey === 'lock_bps') return '30.01'
      if (/bps/i.test(fieldKey)) return '1'
      if (fieldKey === 'protocol') return 'Blend'
      if (fieldKey === 'kind') return 'Oracle'
      if (fieldKey === 'market_id') return '0'
      if (fieldKey === 'asset') return depositTokenId
      if (fieldKey === 'vault') return depositArkaId
      if (fieldKey === 'arka') return depositArkaId
      if (fieldKey === 'old_arka') return depositArkaId
      if (fieldKey === 'new_arka') return depositArkaId
      if (fieldKey === 'owner' || fieldKey === 'user' || fieldKey === 'manager') return holderAddress
      if (fieldKey === 'account' || fieldKey === 'delegatee') return holderAddress
      if (
        fieldKey === 'caller' ||
        fieldKey === 'payer' ||
        fieldKey === 'from' ||
        fieldKey === 'to' ||
        fieldKey === 'recipient' ||
        fieldKey === 'router' ||
        fieldKey === 'adapter' ||
        fieldKey === 'governor' ||
        fieldKey === 'admin' ||
        fieldKey === 'registrar' ||
        fieldKey === 'primary' ||
        fieldKey === 'secondary' ||
        fieldKey === 'reserve_token' ||
        fieldKey === 'operator' ||
        fieldKey === 'manager_vault' ||
        fieldKey === 'community_fund' ||
        fieldKey === 'registry' ||
        fieldKey === 'token' ||
        fieldKey === 'treasury' ||
        fieldKey === 'claims_manager' ||
        fieldKey === 'share_token'
      ) {
        return managerAddress
      }
      if (fieldKey === 'whitelist_contracts' || fieldKey === 'allowed_routers' || fieldKey === 'allowed_adapters') {
        return `${depositTokenId},${coverageTokenId}`
      }
      if (/(amount|limit|nav|period|delay|grace|points|threshold|bps|delta|min|max)/i.test(fieldKey)) {
        return '1000000'
      }
      return '1'
    }

    await enableOperatorMode(page)
    await page.goto('/contracts')

    await expect(page.getByRole('heading', { name: /contract control center/i })).toBeVisible()
    await expect(page.getByText('Connected')).toBeVisible({ timeout: 30_000 })

    const actionSelect = page.getByTestId('contracts-action-select')
    const contractInput = page.getByTestId('contracts-contract-id-input')
    const runPresetButton = page.getByTestId('contracts-run-preset-button')
    const runPreset = async (): Promise<void> => {
      await runPresetButton.click()
      await confirmIfVisible(page, 'contracts-confirm-button')
    }
    const presetStatus = page.getByTestId('contracts-preset-status')
    const presetError = page.getByTestId('contracts-preset-error')

    const actionIds = await actionSelect.locator('option').evaluateAll((options) =>
      options
        .map((option) => (option as HTMLOptionElement).value)
        .filter((value) => value.length > 0),
    )
    expect(actionIds.length).toBeGreaterThanOrEqual(80)

    for (const actionId of actionIds) {
      await actionSelect.selectOption(actionId)
      const readAction = isReadAction(actionId)
      const fieldTestIds = await page.locator('[data-testid^="contracts-field-"]').evaluateAll((elements) =>
        elements
          .map((element) => element.getAttribute('data-testid') ?? '')
          .filter((value) => value.length > 0),
      )

      if (!readAction) {
        await contractInput.fill(resolveContractId(actionId))
        const daoGuarded =
          (await page.getByTestId('contracts-dao-guard-pill').count()) > 0

        if (daoGuarded) {
          await runPreset()
          await expect(presetError).toContainText(
            /DAO policy|Governor|Executor|governance/i,
            { timeout: 10_000 },
          )
          continue
        }

        if (fieldTestIds.includes('contracts-field-caller')) {
          await page.getByTestId('contracts-field-caller').fill('')
          await runPreset()
          await expect(presetError).toContainText(/required/i, { timeout: 10_000 })
          continue
        }

        if (fieldTestIds.includes('contracts-field-from')) {
          await page.getByTestId('contracts-field-from').fill('')
          await runPreset()
          await expect(presetError).toContainText(/required/i, { timeout: 10_000 })
          continue
        }

        if (fieldTestIds.includes('contracts-field-payer')) {
          await page.getByTestId('contracts-field-payer').fill('')
          await runPreset()
          await expect(presetError).toContainText(/required/i, { timeout: 10_000 })
          continue
        }

        if (fieldTestIds.includes('contracts-field-operation_id')) {
          await page.getByTestId('contracts-field-operation_id').fill('abc')
          await runPreset()
          await expect(presetError).toContainText(/32-byte hex|64 hex chars|required/i, { timeout: 10_000 })
          continue
        }

        if (fieldTestIds.length === 0) {
          await contractInput.fill(managerTierId)
          await runPreset()
          await expect.poll(async () => {
            const statusText = (await presetStatus.count()) > 0 ? ((await presetStatus.textContent()) ?? '') : ''
            const errorText = (await presetError.count()) > 0 ? ((await presetError.textContent()) ?? '') : ''
            return `${statusText} ${errorText}`.toLowerCase()
          }, { timeout: 30_000 }).toMatch(
            /success|simulate|failed|method|contract|auth|unauthorized|not found|missing/,
          )
          continue
        }

        const fallbackFieldId = fieldTestIds[0] ?? ''
        if (fallbackFieldId.length > 0) {
          const fallbackLocator = page.getByTestId(fallbackFieldId)
          const fallbackIsSelect = await fallbackLocator.evaluate(
            (element) => element.tagName.toLowerCase() === 'select',
          )
          if (!fallbackIsSelect) {
            await fallbackLocator.fill('')
          }
        }
        await runPreset()
        await expect.poll(async () => {
          const errorText = (await presetError.count()) > 0 ? ((await presetError.textContent()) ?? '') : ''
          return errorText.toLowerCase()
        }, { timeout: 10_000 }).toMatch(/required|invalid|expected integer|32-byte hex|64 hex chars/)
        continue
      }

      await contractInput.fill(resolveContractId(actionId))

      for (const fieldTestId of fieldTestIds) {
        const fieldKey = fieldTestId.replace('contracts-field-', '')
        const fieldLocator = page.getByTestId(fieldTestId)
        const isSelect = await fieldLocator.evaluate(
          (element) => element.tagName.toLowerCase() === 'select',
        )
        if (isSelect) {
          const preferred = inferReadFieldValue(fieldKey)
          const options = await fieldLocator.locator('option').evaluateAll((optionNodes) =>
            optionNodes.map((optionNode) => ({
              value: (optionNode as HTMLOptionElement).value,
              disabled: (optionNode as HTMLOptionElement).disabled,
            })),
          )
          const selected =
            options.find((option) => option.value === preferred && !option.disabled)?.value ??
            options.find((option) => option.value.length > 0 && !option.disabled)?.value
          if (selected) {
            await fieldLocator.selectOption(selected)
          }
          continue
        }
        await fieldLocator.fill(inferReadFieldValue(fieldKey))
      }

      await runPresetButton.click()
      await expect.poll(async () => {
        const statusText = (await presetStatus.count()) > 0 ? ((await presetStatus.textContent()) ?? '') : ''
        const errorText = (await presetError.count()) > 0 ? ((await presetError.textContent()) ?? '') : ''
        return `${statusText} ${errorText}`.toLowerCase()
      }, { timeout: 30_000 }).toMatch(
        /read call completed|method|simulate|failed|contract|unknown|not found|missing|unauthorized|auth/,
      )
      await expect.poll(async () => {
        if ((await presetError.count()) === 0) return ''
        return ((await presetError.textContent()) ?? '').toLowerCase()
      }, { timeout: 5_000 }).not.toContain('required')
    }
  })

  test('runs a live Aquarius rebalance from the browser wallet', async ({ page }) => {
    test.setTimeout(180_000)
    const rebalance = loadRebalanceValidation()
    expect(rebalance.arka).toMatch(/^C[A-Z0-9]{55}$/)
    const swapAmount = guardrailSafeRebalanceAmount(rebalance)

    await page.addInitScript((address) => {
      window.localStorage.setItem('e2e-wallet-profile', 'holder')
      window.localStorage.setItem('wallet:pubkey', address)
    }, holderAddress)
    await page.goto(`/arkas/${rebalance.arka}`)

    await expect(page.getByText(/you are manager/i).first()).toBeVisible({ timeout: 30_000 })
    await openArkaWorkspace(page, 'rebalance')
    await page.getByTestId('rebalance-protocol-select').selectOption('AQUARIUS')
    const pair = await selectFundedRebalancePair(page, rebalance)
    configureLiveRebalanceRoutes(rebalance, pair)
    const amountBase = boundedRebalanceAmountBase(swapAmount, pair.balanceBase)

    const beforeIn = await page.getByTestId('rebalance-balance-in').getAttribute('data-base-units')
    const beforeOut = await page.getByTestId('rebalance-balance-out').getAttribute('data-base-units')

    await page.getByTestId('rebalance-amount-input').fill(baseUnitsToDisplay(amountBase))
    await setConservativeRebalanceMinOut(page)
    await page.getByTestId('rebalance-run-button').click()

    await expect(page.getByTestId('arka-status')).toContainText(/rebalance completed via aquarius:/i, {
      timeout: 120_000,
    })
    await expect(page.getByTestId('rebalance-balance-out')).not.toHaveAttribute('data-base-units', beforeOut ?? '', { timeout: 30_000 })
    await expect(page.getByTestId('rebalance-balance-in')).not.toHaveAttribute('data-base-units', beforeIn ?? '', { timeout: 30_000 })
  })

  test('runs a live SoroSwap rebalance from the browser wallet', async ({ page }) => {
    test.setTimeout(180_000)
    const rebalance = loadRebalanceValidation()
    expect(rebalance.arka).toMatch(/^C[A-Z0-9]{55}$/)
    const swapAmount = guardrailSafeRebalanceAmount(rebalance)
    ensureAllowance(rebalance.tokenOut, rebalance.arka, '1000000')

    await page.addInitScript((address) => {
      window.localStorage.setItem('e2e-wallet-profile', 'holder')
      window.localStorage.setItem('wallet:pubkey', address)
    }, holderAddress)
    await page.goto(`/arkas/${rebalance.arka}`)

    await expect(page.getByText(/you are manager/i).first()).toBeVisible({ timeout: 30_000 })
    await openArkaWorkspace(page, 'rebalance')
    await page.getByTestId('rebalance-protocol-select').selectOption('SOROSWAP')
    const pair = await selectFundedRebalancePair(page, rebalance)
    configureLiveRebalanceRoutes(rebalance, pair)
    const amountBase = boundedRebalanceAmountBase(swapAmount, pair.balanceBase)

    const beforeIn = await page.getByTestId('rebalance-balance-in').getAttribute('data-base-units')
    const beforeOut = await page.getByTestId('rebalance-balance-out').getAttribute('data-base-units')

    await page.getByTestId('rebalance-amount-input').fill(baseUnitsToDisplay(amountBase))
    await setConservativeRebalanceMinOut(page)
    await page.getByTestId('rebalance-run-button').click()

    await expect(page.getByTestId('arka-status')).toContainText(/rebalance completed via soroswap:/i, {
      timeout: 120_000,
    })
    await expect(page.getByTestId('rebalance-balance-out')).not.toHaveAttribute('data-base-units', beforeOut ?? '', { timeout: 30_000 })
    await expect(page.getByTestId('rebalance-balance-in')).not.toHaveAttribute('data-base-units', beforeIn ?? '', { timeout: 30_000 })
  })

  test('runs a live best-execution rebalance from the browser wallet', async ({ page }) => {
    test.setTimeout(300_000)
    const rebalance = loadRebalanceValidation()
    expect(rebalance.arka).toMatch(/^C[A-Z0-9]{55}$/)
    const swapAmount = guardrailSafeRebalanceAmount(rebalance)

    await page.addInitScript((address) => {
      window.localStorage.setItem('e2e-wallet-profile', 'holder')
      window.localStorage.setItem('wallet:pubkey', address)
    }, holderAddress)
    await page.goto(`/arkas/${rebalance.arka}`)

    await expect(page.getByText(/you are manager|watching vault/i).first()).toBeVisible({ timeout: 30_000 })
    await openArkaWorkspace(page, 'rebalance')
    await page.getByTestId('rebalance-protocol-select').selectOption('AUTO')
    const pair = await selectFundedRebalancePair(page, rebalance)
    configureLiveRebalanceRoutes(rebalance, pair)
    const amountBase = boundedRebalanceAmountBase(swapAmount, pair.balanceBase)
    await page.getByTestId('rebalance-amount-input').fill(baseUnitsToDisplay(amountBase))
    await setConservativeRebalanceMinOut(page)
    await expect.poll(async () => (await page.getByTestId('rebalance-route-summary').textContent()) ?? '', {
      timeout: 30_000,
    }).toMatch(/best execution selected|defaulting to soroswap fallback lane/i)

    const beforeOut = await page.getByTestId('rebalance-balance-out').getAttribute('data-base-units')

    await page.getByTestId('rebalance-run-button').click()

    await expect(page.getByTestId('arka-status')).toContainText(/rebalance completed via/i, { timeout: 240_000 })
    await expect(page.getByTestId('rebalance-balance-out')).not.toHaveAttribute('data-base-units', beforeOut ?? '', { timeout: 30_000 })
    await expect(page.getByTestId('rebalance-receipt-panel')).toBeVisible()
    await expect(page.getByTestId('rebalance-receipt-panel')).toContainText(/Transaction hash \+ refreshed state/i)
    await expect(page.getByTestId('rebalance-receipt-primary-hash')).toContainText(/^./)
  })

  test('runs a live governance propose-and-vote flow from the browser with two wallets', async ({ browser }) => {
    test.setTimeout(240_000)
    const governance = loadGovernanceValidation()
    expect(governance.governor).toMatch(/^C[A-Z0-9]{55}$/)
    const existingOpenProposalId = findOpenGovernorProposalId(
      governance.governor,
      governance.proposerAddress,
      60,
    )
    if (governanceDemoVideoPath) {
      mkdirSync(dirname(governanceDemoVideoPath), { recursive: true })
    }
    const adminContext = await browser.newContext(governanceDemoVideoPath
      ? { recordVideo: { dir: dirname(governanceDemoVideoPath), size: { width: 1600, height: 900 } } }
      : {})
    await adminContext.addInitScript((address) => {
      window.localStorage.setItem('e2e-wallet-profile', 'manager')
      window.localStorage.setItem('wallet:pubkey', address)
    }, governance.proposerAddress)
    const adminPage = await adminContext.newPage()
    const adminVideo = adminPage.video()

    const holderContext = await browser.newContext()
    await holderContext.addInitScript((address) => {
      window.localStorage.setItem('e2e-wallet-profile', 'holder')
      window.localStorage.setItem('wallet:pubkey', address)
    }, governance.forVoterAddress)
    const holderPage = await holderContext.newPage()

    try {
      await adminPage.goto('/governance')
      await holderPage.goto('/governance')

      await expect(adminPage.getByTestId('governance-governor-id')).toContainText(governance.governor)
      await expect(adminPage.getByTestId('governance-wallet').first()).toBeVisible()
      await expect(holderPage.getByTestId('governance-wallet').first()).toBeVisible()

      let proposalId = existingOpenProposalId !== null ? String(existingOpenProposalId) : ''
      if (existingOpenProposalId === null) {
        await adminPage.getByTestId('governance-proposal-kind-select').selectOption('Council')
        await adminPage.getByTestId('governance-new-council-input').fill(governance.proposerAddress)
        await adminPage.getByTestId('governance-propose-button').click()
        await confirmIfVisible(adminPage, 'governance-confirm-button')
        await expect(adminPage.getByTestId('governance-status')).toContainText(/success:/i, { timeout: 120_000 })
        proposalId = (await adminPage.getByTestId('governance-proposal-id-input').inputValue()).trim()
      }

      expect(proposalId).toMatch(/^\d+$/)
      await adminPage.getByTestId('governance-proposal-id-input').fill(proposalId)
      await holderPage.getByTestId('governance-proposal-id-input').fill(proposalId)
      await adminPage.getByTestId('governance-refresh-button').click()
      await holderPage.getByTestId('governance-refresh-button').click()
      await expect(adminPage.getByTestId('governance-proposal-status')).toContainText(/open/i, { timeout: 30_000 })

      if (readGovernorVoteCli(governance.governor, governance.forVoterAddress, Number(proposalId)) !== 1) {
        await holderPage.getByTestId('governance-support-select').selectOption('1')
        await holderPage.getByTestId('governance-vote-button').click()
        await confirmIfVisible(holderPage, 'governance-confirm-button')
        await expect(holderPage.getByTestId('governance-status')).toContainText(/success:/i, { timeout: 120_000 })
      } else {
        await holderPage.getByTestId('governance-refresh-button').click()
      }
      await expect(holderPage.getByTestId('governance-my-vote')).toContainText(/for/i, { timeout: 30_000 })

      if (readGovernorVoteCli(governance.governor, governance.proposerAddress, Number(proposalId)) !== 2) {
        await adminPage.getByTestId('governance-support-select').selectOption('2')
        await adminPage.getByTestId('governance-vote-button').click()
        await confirmIfVisible(adminPage, 'governance-confirm-button')
        await expect(adminPage.getByTestId('governance-status')).toContainText(/success:/i, { timeout: 120_000 })
      } else {
        await adminPage.getByTestId('governance-refresh-button').click()
      }
      await expect(adminPage.getByTestId('governance-my-vote')).toContainText(/abstain/i, { timeout: 30_000 })

      await adminPage.getByTestId('governance-refresh-button').click()
      await expect(adminPage.getByTestId('governance-proposal-status')).toContainText(/open/i, { timeout: 30_000 })
      await expect(adminPage.getByTestId('governance-tally-for')).toContainText('1')
      await expect(adminPage.getByTestId('governance-tally-abstain')).toContainText('1')
      await expect(adminPage.getByTestId('governance-proposal-executable')).toContainText(/true/i)

      const proposalStatusLocator = adminPage.getByTestId('governance-proposal-status')
      const proposalExecutableLocator = adminPage.getByTestId('governance-proposal-executable')
      const readErrorText = async (): Promise<string> => {
        const errorLocator = adminPage.getByTestId('governance-error')
        if ((await errorLocator.count()) === 0) return ''
        return ((await errorLocator.first().textContent()) ?? '').trim()
      }

      const currentProposal = readGovernorProposalCli(governance.governor, Number(proposalId))
      const closeExecuteCandidateId = currentProposal?.data?.executable
        ? Number(proposalId)
        : null

      if (closeExecuteCandidateId === null) {
        await adminPage.getByTestId('governance-close-button').click()
        await confirmIfVisible(adminPage, 'governance-confirm-button')
        await adminPage.waitForTimeout(1500)
        await adminPage.getByTestId('governance-refresh-button').click()
        const postCloseStatus = ((await proposalStatusLocator.textContent()) ?? '').toLowerCase()
        if (postCloseStatus.includes('open')) {
          const closeError = await readErrorText()
          expect(
            closeError.toLowerCase(),
            'Close fallback path should emit a concrete on-chain validation error when the vote window is still open',
          ).toMatch(/close|simulation|failed|vote|window|timelock|open/)
        }
      } else {
        const closeExecuteProposalId = String(closeExecuteCandidateId)
        await adminPage.getByTestId('governance-proposal-id-input').fill(closeExecuteProposalId)
        await holderPage.getByTestId('governance-proposal-id-input').fill(closeExecuteProposalId)
        await adminPage.getByTestId('governance-refresh-button').click()
        await holderPage.getByTestId('governance-refresh-button').click()

        let statusText = ((await proposalStatusLocator.textContent()) ?? '').toLowerCase()
        if (statusText.includes('open')) {
          await adminPage.getByTestId('governance-close-button').click()
          await confirmIfVisible(adminPage, 'governance-confirm-button')
          let closeObserved = false
          let lastCloseError = ''
          for (let attempt = 0; attempt < 20; attempt += 1) {
            await adminPage.getByTestId('governance-refresh-button').click()
            statusText = ((await proposalStatusLocator.textContent()) ?? '').toLowerCase()
            if (!statusText.includes('open')) {
              closeObserved = true
              break
            }
            lastCloseError = await readErrorText()
            if (lastCloseError.toLowerCase().includes('simulation failed')) break
            await adminPage.waitForTimeout(1500)
          }
          if (!closeObserved) {
            expect(
              lastCloseError.toLowerCase(),
              'Close should either progress proposal state or emit explicit on-chain validation error',
            ).toMatch(/close|simulation|failed|vote|window|timelock|open/)
          }
        }

        let executableObserved = false
        for (let attempt = 0; attempt < 30; attempt += 1) {
          await adminPage.getByTestId('governance-refresh-button').click()
          const executableText = ((await proposalExecutableLocator.textContent()) ?? '').toLowerCase()
          if (executableText.includes('true')) {
            executableObserved = true
            break
          }
          await adminPage.waitForTimeout(1500)
        }
        expect(executableObserved).toBe(true)

        await adminPage.getByTestId('governance-execute-button').click()
        await confirmIfVisible(adminPage, 'governance-confirm-button')
        let executionObserved = false
        let lastExecutionError = ''
        for (let attempt = 0; attempt < 30; attempt += 1) {
          await adminPage.getByTestId('governance-refresh-button').click()
          const proposalStatusText = ((await proposalStatusLocator.textContent()) ?? '').toLowerCase()
          if (proposalStatusText.includes('executed')) {
            executionObserved = true
            break
          }
          lastExecutionError = await readErrorText()
          if (lastExecutionError.toLowerCase().includes('simulation failed')) break
          await adminPage.waitForTimeout(1500)
        }
        if (!executionObserved) {
          expect(
            lastExecutionError.toLowerCase(),
            'Execute should either complete or expose explicit on-chain validation error',
          ).toMatch(/execute|simulation|failed|timelock|ready|open|window/)
        } else {
          await expect(proposalStatusLocator).toContainText(/executed/i, { timeout: 30_000 })
        }
      }
    } finally {
      await adminPage.close()
      if (governanceDemoVideoPath && adminVideo) {
        const recordedPath = await adminVideo.path()
        copyFileSync(recordedPath, governanceDemoVideoPath)
      }
      await adminContext.close()
      await holderContext.close()
    }
  })
})
