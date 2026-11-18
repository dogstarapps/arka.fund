import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { defineConfig, devices } from '@playwright/test'

const PORT = 3005
const EXTERNAL_BASE_URL = process.env.PLAYWRIGHT_BASE_URL?.trim()
const BASE_URL = EXTERNAL_BASE_URL || `http://127.0.0.1:${PORT}`
const RUN_LIVE_TESTNET_MUTATIONS = process.env.E2E_ALLOW_TESTNET_MUTATIONS === '1'
const coreWorkspacePath = process.env.ARKA_CORE_WORKSPACE ?? resolve(process.cwd(), '../arkafund')
const rebalanceValidationPath =
  process.env.E2E_REBALANCE_VALIDATION_PATH ?? resolve(coreWorkspacePath, 'tmp/rebalance-live-validation.json')
const governanceValidationPath =
  process.env.E2E_GOVERNANCE_VALIDATION_PATH ?? resolve(coreWorkspacePath, 'tmp/governance-live-validation.json')

function safeReadJson<T>(filePath: string): T | null {
  if (!existsSync(filePath)) return null
  try {
    return JSON.parse(readFileSync(filePath, 'utf8')) as T
  } catch {
    return null
  }
}

const rebalanceValidation = safeReadJson<{ tokenIn?: string; tokenOut?: string; poolIndex?: string; soroswapRouter?: string }>(rebalanceValidationPath)
const governanceValidation = safeReadJson<{ governor?: string }>(governanceValidationPath)
const e2eTokenA = rebalanceValidation?.tokenIn ?? 'CB22KRA3YZVCNCQI64JQ5WE7UY2VAV7WFLK6A2JN3HEX56T2EDAFO7QF'
const e2eTokenB = rebalanceValidation?.tokenOut ?? 'CAQCFVLOBK5GIULPNZRGATJJMIZL5BSP7X5YJVMGCPTUEPFM4AVSRCJU'
const e2eAquariusPoolIndex = rebalanceValidation?.poolIndex ?? ''
const e2eSoroswapRouter = rebalanceValidation?.soroswapRouter ?? 'CCJUD55AG6W5HAI5LRVNKAE5WDP5XGZBUDS5WNTIVDU7O264UZZE7BRD'
const e2eGovernorId = governanceValidation?.governor ?? 'CBU6HR77QR3QYQCJI6K3F7YBR5NXBXJ33TFK7NUDTV6TE6SP672L5V6V'
const e2eManagerPublicKey = process.env.E2E_MANAGER_PUBLIC_KEY ?? 'GCO7KAJ7WCIFDLAEDHKSFQRNQLR3SQ6JTIVSMYYFUC5KRTA2KG2QJYDE'

export default defineConfig({
  testDir: './e2e',
  // Wallet-backed checks alter the dedicated Testnet environment. Keep them opt-in.
  testIgnore: RUN_LIVE_TESTNET_MUTATIONS ? undefined : ['**/wallet-backed.spec.ts'],
  // The public surface checks are CPU- and memory-intensive Next.js pages.
  // One worker keeps every assertion independent without starving the local
  // server that the checks are intended to validate.
  fullyParallel: false,
  workers: 1,
  timeout: 30_000,
  expect: {
    timeout: 5_000,
  },
  use: {
    baseURL: BASE_URL,
    trace: 'on-first-retry',
  },
  webServer: EXTERNAL_BASE_URL
    ? undefined
    : {
        command: `npm run build && PORT=${PORT} HOSTNAME=127.0.0.1 npm run start`,
        env: {
          ...process.env,
          NEXT_PUBLIC_E2E_WALLET: '1',
          E2E_WALLET_ENABLED: '1',
          OPERATOR_ACCESS_SECRET: 'arkafund-e2e-operator-access-secret',
          OPERATOR_WALLET_ALLOWLIST: e2eManagerPublicKey,
          NEXT_PUBLIC_OPERATOR_WALLET_ALLOWLIST: e2eManagerPublicKey,
          NEXT_PUBLIC_ARKA_MANAGER: e2eManagerPublicKey,
          NEXT_PUBLIC_SIM_ACCOUNT: e2eManagerPublicKey,
          NEXT_PUBLIC_STELLAR_NETWORK: 'Test SDF Network ; September 2015',
          NEXT_PUBLIC_SOROBAN_RPC_URL: 'https://soroban-testnet.stellar.org',
          NEXT_PUBLIC_ARKA_FACTORY: 'CAZPR5MIUHXH46ZJ5OAMRZXD7PXIHMF5HHSSKQPDUBEXVID5SAGSZ3HW',
          NEXT_PUBLIC_ARKA_ROUTER: 'CB273QHT7GISJF4EW434UY3K6IWTOINAKN6B7NZPAVRBYSERZ2QFBVAQ',
          NEXT_PUBLIC_ARKA_REGISTRY: 'CD7NVBDWH7YDCAJGPESKANQMQGNC2FCNX7WBUIRWWKF4QI5NMPRP22NW',
          NEXT_PUBLIC_GOVERNOR_ID: e2eGovernorId,
          NEXT_PUBLIC_DENOMINATION: e2eTokenA,
          NEXT_PUBLIC_ROUTING_ASSET_A: e2eTokenA,
          NEXT_PUBLIC_ROUTING_ASSET_B: e2eTokenB,
          NEXT_PUBLIC_SOROSWAP_ROUTER: e2eSoroswapRouter,
          NEXT_PUBLIC_SOROSWAP_ADAPTER: 'CAYJYQRBFCMKUP2W3MQKRC5WARH6FH66AVXBUR6GB3FTGU4EQX5JPXFU',
          NEXT_PUBLIC_AQUARIUS_ROUTER: 'CBCFTQSPDBAIZ6R6PJQKSQWKNKWH2QIV3I4J72SHWBIK3ADRRAM5A6GD',
          NEXT_PUBLIC_AQUARIUS_ADAPTER: 'CDEWNICQBSXNRBC7FKO5KZX7YID4KLF7OA3GXAGZ3QEGUJTD733L3ZMV',
          NEXT_PUBLIC_AQUARIUS_POOL_ROUTING_PAIR: e2eAquariusPoolIndex,
          NEXT_PUBLIC_ADAPTER_BLEND: 'CADVUIKDYSEHWNWFMUACMUUVXA7GNNVFVIHO365FG2YGQU7OKEOUXCHX',
          NEXT_PUBLIC_BLEND_MARKET_ID: '0',
          NEXT_PUBLIC_REBALANCE_SLIPPAGE_PROFILE: 'standard',
          NEXT_PUBLIC_DEFAULT_REBALANCE_SLIPPAGE_PCT: '1',
          NEXT_PUBLIC_MAX_REBALANCE_SLIPPAGE_PCT: '10',
          NEXT_PUBLIC_REBALANCE_EXTRA_BUFFER_PCT: '1.5',
          NEXT_PUBLIC_REBALANCE_FALLBACK_EXTRA_PCT: '2.5',
        },
        url: BASE_URL,
        reuseExistingServer: false,
        // Build + start can exceed 120s on local machines with heavy dependency graphs.
        timeout: 300_000,
      },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'firefox-surface-matrix',
      testMatch: [
        '**/smoke.spec.ts',
        '**/access-state.spec.ts',
        '**/public-product-truthfulness.spec.ts',
        '**/public-interaction-state-matrix.spec.ts',
        '**/public-degraded-retry-matrix.spec.ts',
        '**/public-surface-matrix.spec.ts',
        '**/public-responsive-matrix.spec.ts',
        '**/product-surfaces.spec.ts',
        '**/create-wizard-matrix.spec.ts',
        '**/operator-surface-matrix.spec.ts',
        '**/operator-degraded-retry-matrix.spec.ts',
        '**/contracts-surface.spec.ts',
        '**/wallet-backed-matrix.spec.ts',
      ],
      use: { ...devices['Desktop Firefox'] },
    },
    {
      name: 'webkit-surface-matrix',
      testMatch: [
        '**/smoke.spec.ts',
        '**/access-state.spec.ts',
        '**/public-product-truthfulness.spec.ts',
        '**/public-interaction-state-matrix.spec.ts',
        '**/public-degraded-retry-matrix.spec.ts',
        '**/public-surface-matrix.spec.ts',
        '**/public-responsive-matrix.spec.ts',
        '**/product-surfaces.spec.ts',
        '**/create-wizard-matrix.spec.ts',
        '**/operator-surface-matrix.spec.ts',
        '**/operator-degraded-retry-matrix.spec.ts',
        '**/contracts-surface.spec.ts',
        '**/wallet-backed-matrix.spec.ts',
      ],
      use: { ...devices['Desktop Safari'] },
    },
  ],
})
