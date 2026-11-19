import { existsSync, mkdirSync, readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { execFileSync, spawn } from 'node:child_process'
import { chromium } from '@playwright/test'

const __dirname = dirname(fileURLToPath(import.meta.url))
const dappRoot = resolve(__dirname, '..')
const workspaceRoot = resolve(dappRoot, '..')
const arkafundRoot = resolve(workspaceRoot, 'arkafund')
const tmpDir = resolve(arkafundRoot, 'tmp')
const videoDir = resolve(tmpDir, 'demo-video')
const stillsDir = resolve(videoDir, 'stills')
const rebalanceValidationPath = resolve(tmpDir, 'rebalance-live-validation.json')
const port = 3021
const baseUrl = `http://127.0.0.1:${port}`

function readJson(path) {
  if (!existsSync(path)) throw new Error(`Missing required file: ${path}`)
  return JSON.parse(readFileSync(path, 'utf8'))
}

function stellarOutput(args) {
  return execFileSync('stellar', args, { encoding: 'utf8' }).trim()
}

function freePort(portNumber) {
  try {
    const output = execFileSync('lsof', ['-ti', `tcp:${portNumber}`], { encoding: 'utf8' }).trim()
    if (!output) return
    for (const pid of output.split('\n').map((value) => value.trim()).filter(Boolean)) {
      execFileSync('kill', ['-TERM', pid], { stdio: 'ignore' })
    }
  } catch {}
}

function waitForServer(url, timeoutMs = 120_000) {
  const deadline = Date.now() + timeoutMs
  return new Promise((resolvePromise, rejectPromise) => {
    const check = async () => {
      try {
        const response = await fetch(url)
        if (response.ok) {
          resolvePromise()
          return
        }
      } catch {}
      if (Date.now() >= deadline) {
        rejectPromise(new Error(`Timed out waiting for server at ${url}`))
        return
      }
      setTimeout(check, 1000)
    }
    void check()
  })
}

function buildServerEnv(rebalanceValidation) {
  const e2eTokenA = rebalanceValidation?.tokenIn ?? ''
  const e2eTokenB = rebalanceValidation?.tokenOut ?? ''
  const e2eAquariusPoolIndex = rebalanceValidation?.poolIndex ?? ''
  const e2eSoroswapRouter = rebalanceValidation?.soroswapRouter ?? 'CCJUD55AG6W5HAI5LRVNKAE5WDP5XGZBUDS5WNTIVDU7O264UZZE7BRD'
  return {
    ...process.env,
    NEXT_PUBLIC_E2E_WALLET: '1',
    E2E_WALLET_ENABLED: '1',
    NEXT_PUBLIC_ARKA_FACTORY: 'CAZPR5MIUHXH46ZJ5OAMRZXD7PXIHMF5HHSSKQPDUBEXVID5SAGSZ3HW',
    NEXT_PUBLIC_ARKA_ROUTER: 'CAARCDANGZNLDR7CF5MRUA32VUBD6KAZMTNTVJKA5ISQHHKYMP7YFTTI',
    NEXT_PUBLIC_ARKA_REGISTRY: 'CD7NVBDWH7YDCAJGPESKANQMQGNC2FCNX7WBUIRWWKF4QI5NMPRP22NW',
    NEXT_PUBLIC_GOVERNOR_ID: 'CBU6HR77QR3QYQCJI6K3F7YBR5NXBXJ33TFK7NUDTV6TE6SP672L5V6V',
    NEXT_PUBLIC_DENOMINATION: e2eTokenA,
    NEXT_PUBLIC_ROUTING_ASSET_A: e2eTokenA,
    NEXT_PUBLIC_ROUTING_ASSET_B: e2eTokenB,
    NEXT_PUBLIC_SOROSWAP_ROUTER: e2eSoroswapRouter,
    NEXT_PUBLIC_AQUARIUS_ROUTER: 'CBCFTQSPDBAIZ6R6PJQKSQWKNKWH2QIV3I4J72SHWBIK3ADRRAM5A6GD',
    NEXT_PUBLIC_AQUARIUS_POOL_ROUTING_PAIR: e2eAquariusPoolIndex,
    NEXT_PUBLIC_ADAPTER_BLEND: 'CADVUIKDYSEHWNWFMUACMUUVXA7GNNVFVIHO365FG2YGQU7OKEOUXCHX',
    NEXT_PUBLIC_BLEND_MARKET_ID: '0',
  }
}

async function seedWallet(page, address, recentArka) {
  await page.addInitScript(([pubkey, arkaId]) => {
    window.localStorage.setItem('e2e-wallet-profile', 'holder')
    window.localStorage.setItem('wallet:pubkey', pubkey)
    window.localStorage.setItem('recent_arkas', JSON.stringify([arkaId]))
  }, [address, recentArka])
}

async function injectRebalanceStatus(page, message) {
  await page.evaluate((text) => {
    const button = document.querySelector('[data-testid="rebalance-run-button"]')
    const container = button?.closest('div.border-purple-100')
    if (!container) return
    let status = container.querySelector('[data-testid="arka-status"]')
    if (!status) {
      status = document.createElement('div')
      status.setAttribute('data-testid', 'arka-status')
      status.className = 'mt-2 text-xs text-gray-700'
      container.appendChild(status)
    }
    status.textContent = text
  }, message)
}

async function captureRebalanceStill(page, rebalanceValidation, protocol, outputPath) {
  await page.goto(`${baseUrl}/arkas/${rebalanceValidation.arka}`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(1200)
  await page.locator('[data-testid="rebalance-protocol-select"]').selectOption(protocol)
  await page.locator('[data-testid="rebalance-asset-in-select"]').selectOption(rebalanceValidation.tokenIn)
  await page.locator('[data-testid="rebalance-asset-out-select"]').selectOption(rebalanceValidation.tokenOut)
  await page.locator('[data-testid="rebalance-amount-input"]').fill('0.0100000')
  await page.locator('[data-testid="rebalance-protocol-select"]').evaluate((element) => {
    const top = window.scrollY + element.getBoundingClientRect().top - 80
    window.scrollTo({ top: Math.max(0, top), behavior: 'instant' })
  })
  await page.waitForTimeout(600)
  await injectRebalanceStatus(page, 'Rebalance completed: testnet flow confirmed')
  await page.waitForTimeout(300)
  await page.screenshot({ path: outputPath })
}

async function main() {
  const rebalanceValidation = readJson(rebalanceValidationPath)
  const holderAddress = stellarOutput(['keys', 'address', 'arka-holder'])

  mkdirSync(stillsDir, { recursive: true })
  freePort(port)

  const server = spawn('npm', ['run', 'start', '--', '--hostname', '127.0.0.1', '--port', String(port)], {
    cwd: dappRoot,
    env: buildServerEnv(rebalanceValidation),
    stdio: 'inherit',
  })

  const cleanup = () => {
    if (!server.killed) server.kill('SIGTERM')
  }

  process.on('exit', cleanup)
  process.on('SIGINT', () => {
    cleanup()
    process.exit(130)
  })

  try {
    await waitForServer(baseUrl, 120_000)
    const browser = await chromium.launch({ headless: true })
    const context = await browser.newContext({ viewport: { width: 1365, height: 768 } })
    const page = await context.newPage()

    await seedWallet(page, holderAddress, rebalanceValidation.arka)

    await page.goto(`${baseUrl}/arkas`, { waitUntil: 'networkidle' })
    await page.waitForTimeout(1200)
    await page.screenshot({ path: resolve(stillsDir, 'arkas-index-clean.png') })

    await captureRebalanceStill(page, rebalanceValidation, 'SOROSWAP', resolve(stillsDir, 'soroswap-clean.png'))
    await captureRebalanceStill(page, rebalanceValidation, 'AQUARIUS', resolve(stillsDir, 'aquarius-clean.png'))

    await context.close()
    await browser.close()
  } finally {
    cleanup()
  }
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
