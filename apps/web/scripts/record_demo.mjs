import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { execFileSync, spawn } from 'node:child_process'
import { chromium } from '@playwright/test'
import ts from 'typescript'

const __dirname = dirname(fileURLToPath(import.meta.url))
const dappRoot = resolve(__dirname, '..')
const workspaceRoot = resolve(dappRoot, '..')
const arkafundRoot = resolve(workspaceRoot, 'arkafund')
const tmpDir = resolve(arkafundRoot, 'tmp')
const videoDir = resolve(tmpDir, 'demo-video')
const rawVideoDir = resolve(videoDir, 'raw')
const outputStem = process.env.DEMO_OUTPUT_STEM ?? 'arkafund-demo'
const outputMp4 = resolve(videoDir, `${outputStem}.mp4`)
const outputWebm = resolve(videoDir, `${outputStem}.webm`)
const tourOnly = process.env.DEMO_TOUR_ONLY === '1'
const port = 3015
const baseUrl = process.env.DEMO_BASE_URL ?? `http://127.0.0.1:${port}`
const directCatalog = process.env.DEMO_DIRECT_CATALOG === '1'
const testnetPassphrase = 'Test SDF Network ; September 2015'
const testnetRpc = 'https://soroban-testnet.stellar.org'
const rebalanceValidationPath = resolve(tmpDir, 'rebalance-live-validation.json')
const governanceValidationPath = resolve(tmpDir, 'governance-live-validation.json')

const blendArkaId = process.env.E2E_BLEND_ARKA_ID ?? 'CD7LKIM6TAGA5DWVC2UAMX52TDGL6WUQOGEW7LIDSCS363VTIYXOHEJ4'
const coverageFundId = 'CCX5QACCFXC3VNMKUHBUZ2NGD2HNU6W47G3E3LBGPAK2DWX63FERA3MO'
const coverageTokenId = 'CA33YVWPBWG6A7JPMMUEUUELUB3UPATI64K62RZFPGYCBJD5GFACOWGK'
const depositAmountDisplay = '0.0001000'
const blendSupplyAmountDisplay = '0.0001000'
const blendBorrowAmountDisplay = '0.0000100'
const coverageMutationAmountDisplay = '0.0000001'

function readJson(path) {
  if (!existsSync(path)) {
    throw new Error(`Missing required file: ${path}`)
  }
  return JSON.parse(readFileSync(path, 'utf8'))
}

async function loadCatalogFixtureResolver() {
  if (process.env.DEMO_USE_LIVE_CATALOG === '1') {
    const cache = new Map()
    return async (pathname, searchParams) => {
      const url = new URL(pathname, 'https://catalog.arka.fund')
      url.search = searchParams.toString()
      const key = url.toString()
      if (cache.has(key)) return structuredClone(cache.get(key))
      for (let attempt = 1; attempt <= 3; attempt += 1) {
        try {
          let result
          if (process.env.DEMO_CATALOG_RESOLVE_IP) {
            const body = execFileSync('curl', [
              '-fsS',
              '--max-time', '30',
              '--resolve', `catalog.arka.fund:443:${process.env.DEMO_CATALOG_RESOLVE_IP}`,
              key,
            ], { encoding: 'utf8' })
            result = JSON.parse(body)
          } else {
            const response = await fetch(url, {
              headers: { accept: 'application/json' },
              signal: AbortSignal.timeout(30_000),
            })
            if (!response.ok) {
              result = { error: response.status === 404 ? 'not_found' : 'catalog_error' }
            } else {
              result = await response.json()
            }
          }
          cache.set(key, result)
          return structuredClone(result)
        } catch (error) {
          if (attempt === 3) throw error
          await wait(attempt * 750)
        }
      }
    }
  }
  const fixtureSourcePath = resolve(dappRoot, 'src', 'lib', 'catalog', 'testFixtures.ts')
  const fixtureModulePath = resolve(rawVideoDir, 'catalog-testFixtures.compiled.mjs')
  const source = readFileSync(fixtureSourcePath, 'utf8')
  const compiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.ES2022,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText
  writeFileSync(fixtureModulePath, compiled, 'utf8')
  const moduleUrl = `${pathToFileURL(fixtureModulePath).href}?t=${Date.now()}`
  const imported = await import(moduleUrl)
  if (typeof imported.resolveCatalogFixture !== 'function') {
    throw new Error('Could not load resolveCatalogFixture from test fixtures')
  }
  return imported.resolveCatalogFixture
}

async function installCatalogFixtureMock(page, resolveCatalogFixture) {
  await page.route('**/api/catalog/**', async (route) => {
    const requestUrl = new URL(route.request().url())
    const pathname = requestUrl.pathname.replace(/^\/api\/catalog/, '') || '/'
    const payload = await resolveCatalogFixture(pathname, requestUrl.searchParams)
    const missing =
      payload &&
      typeof payload === 'object' &&
      !Array.isArray(payload) &&
      'error' in payload &&
      payload.error === 'not_found'

    await route.fulfill({
      status: missing ? 404 : 200,
      contentType: 'application/json; charset=utf-8',
      body: JSON.stringify(missing ? { message: `Catalog fixture not found for ${pathname}` } : payload),
    })
  })
}

const rebalanceValidation = readJson(rebalanceValidationPath)
const governanceValidation = readJson(governanceValidationPath)
const createDenominationId = process.env.NEXT_PUBLIC_DENOMINATION ?? rebalanceValidation.tokenIn ?? 'CB22KRA3YZVCNCQI64JQ5WE7UY2VAV7WFLK6A2JN3HEX56T2EDAFO7QF'
const createWhitelist = [
  rebalanceValidation.tokenIn ?? 'CB22KRA3YZVCNCQI64JQ5WE7UY2VAV7WFLK6A2JN3HEX56T2EDAFO7QF',
  rebalanceValidation.tokenOut ?? 'CAQCFVLOBK5GIULPNZRGATJJMIZL5BSP7X5YJVMGCPTUEPFM4AVSRCJU',
].join(',')

const holderAddress = stellarOutput(['keys', 'address', 'arka-holder'])
const managerAddress = rebalanceValidation.manager ?? stellarOutput(['keys', 'address', 'arka-manager'])

function stellarOutput(args) {
  return execFileSync('stellar', args, { encoding: 'utf8' }).trim()
}

function ensureTokenBalance(tokenId, minBalanceBase = 20_000) {
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
  if (Number(currentBalance) >= minBalanceBase) return
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
  ], { encoding: 'utf8', stdio: 'pipe' })
}

function ensureAllowance(tokenId, spender, amountBase = '1000') {
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
  if (Number(currentAllowance) >= Number(amountBase)) return
  const horizonLedger = JSON.parse(execFileSync('curl', [
    '-fsS',
    'https://horizon-testnet.stellar.org/ledgers?order=desc&limit=1',
  ], { encoding: 'utf8' }))._embedded.records[0].sequence
  const expirationLedger = String(Number(horizonLedger) + 100_000)
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
    '--expiration_ledger', expirationLedger,
  ], { encoding: 'utf8', stdio: 'pipe' })
}

function ensureCoverageAllowance(amountBase = '1000') {
  ensureAllowance(coverageTokenId, coverageFundId, amountBase)
}

function buildServerEnv() {
  const e2eTokenA = rebalanceValidation?.tokenIn ?? 'CB22KRA3YZVCNCQI64JQ5WE7UY2VAV7WFLK6A2JN3HEX56T2EDAFO7QF'
  const e2eTokenB = rebalanceValidation?.tokenOut ?? 'CAQCFVLOBK5GIULPNZRGATJJMIZL5BSP7X5YJVMGCPTUEPFM4AVSRCJU'
  const e2eAquariusPoolIndex = rebalanceValidation?.poolIndex ?? ''
  const e2eSoroswapRouter = rebalanceValidation?.soroswapRouter ?? 'CCJUD55AG6W5HAI5LRVNKAE5WDP5XGZBUDS5WNTIVDU7O264UZZE7BRD'
  const e2eGovernorId = governanceValidation?.governor ?? 'CBU6HR77QR3QYQCJI6K3F7YBR5NXBXJ33TFK7NUDTV6TE6SP672L5V6V'
  return {
    ...process.env,
    NEXT_PUBLIC_E2E_WALLET: '1',
    E2E_WALLET_ENABLED: '1',
    NEXT_PUBLIC_ARKA_FACTORY: 'CAZPR5MIUHXH46ZJ5OAMRZXD7PXIHMF5HHSSKQPDUBEXVID5SAGSZ3HW',
    NEXT_PUBLIC_ARKA_ROUTER: 'CAARCDANGZNLDR7CF5MRUA32VUBD6KAZMTNTVJKA5ISQHHKYMP7YFTTI',
    NEXT_PUBLIC_ARKA_REGISTRY: 'CD7NVBDWH7YDCAJGPESKANQMQGNC2FCNX7WBUIRWWKF4QI5NMPRP22NW',
    NEXT_PUBLIC_GOVERNOR_ID: e2eGovernorId,
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

function waitForServer(url, timeoutMs = 120_000) {
  const deadline = Date.now() + timeoutMs
  return new Promise((resolve, reject) => {
    const check = async () => {
      try {
        const res = await fetch(url)
        if (res.ok) {
          resolve()
          return
        }
      } catch {}
      if (Date.now() >= deadline) {
        reject(new Error(`Timed out waiting for server at ${url}`))
        return
      }
      setTimeout(check, 1000)
    }
    void check()
  })
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

function logStep(message) {
  console.log(`[demo] ${message}`)
}

async function connectWalletIfNeeded(page) {
  const connectButton = page.getByRole('button', { name: /connect wallet/i })
  if (await connectButton.isVisible().catch(() => false)) {
    await connectButton.click()
  }
}

async function installDemoCursor(page) {
  await page.addInitScript(() => {
    const ensureCursor = () => {
      if (document.getElementById('__demo_cursor__')) return

      const style = document.createElement('style')
      style.id = '__demo_cursor_style__'
      style.textContent = `
        #__demo_cursor__ {
          position: fixed;
          left: 64px;
          top: 64px;
          width: 20px;
          height: 20px;
          border-radius: 999px;
          border: 3px solid #0f172a;
          background: rgba(56, 189, 248, 0.92);
          transform: translate(-50%, -50%);
          z-index: 2147483647;
          pointer-events: none;
          box-shadow: 0 8px 24px rgba(0,0,0,0.28);
          transition: transform 120ms ease, background 120ms ease;
        }
      `
      document.documentElement.appendChild(style)

      const cursor = document.createElement('div')
      cursor.id = '__demo_cursor__'
      document.body.appendChild(cursor)
    }

    const onReady = () => {
      if (document.body) ensureCursor()
      else document.addEventListener('DOMContentLoaded', ensureCursor, { once: true })
    }

    onReady()
    window.__demoMoveCursor = (x, y, clicking = false) => {
      ensureCursor()
      const cursor = document.getElementById('__demo_cursor__')
      if (!cursor) return
      cursor.style.left = `${x}px`
      cursor.style.top = `${y}px`
      cursor.style.transform = clicking ? 'translate(-50%, -50%) scale(0.84)' : 'translate(-50%, -50%) scale(1)'
      cursor.style.background = clicking ? 'rgba(249, 115, 22, 0.96)' : 'rgba(56, 189, 248, 0.92)'
    }
  })
}

async function setWalletProfile(page, profile, address) {
  await page.evaluate(([nextProfile, nextAddress]) => {
    window.localStorage.setItem('e2e-wallet-profile', nextProfile)
    window.localStorage.setItem('wallet:pubkey', nextAddress)
  }, [profile, address])
}

async function showTitleCard(page, title, subtitle = '', durationMs = 2600) {
  await page.setContent(`
    <style>
      body {
        margin: 0;
        font-family: "Arial Narrow", "Trebuchet MS", ui-sans-serif, system-ui, sans-serif;
        background:
          radial-gradient(circle at top left, rgba(237, 0, 255, 0.18), transparent 34%),
          radial-gradient(circle at bottom right, rgba(0, 255, 170, 0.14), transparent 32%),
          linear-gradient(145deg, #120224 0%, #1b0840 42%, #090014 100%);
        color: #f6f5ff;
        display: flex;
        align-items: center;
        justify-content: center;
        min-height: 100vh;
        overflow: hidden;
      }
      .card {
        width: min(920px, 90vw);
        padding: 52px 60px;
        border: 1px solid rgba(170, 255, 98, 0.35);
        border-radius: 28px;
        background: linear-gradient(180deg, rgba(33, 8, 69, 0.88) 0%, rgba(12, 4, 29, 0.92) 100%);
        box-shadow:
          0 0 0 1px rgba(255, 255, 255, 0.04) inset,
          0 18px 80px rgba(0, 0, 0, 0.55),
          0 0 32px rgba(0, 255, 170, 0.12);
        position: relative;
      }
      .card::before {
        content: "";
        position: absolute;
        inset: 14px;
        border: 1px solid rgba(255, 61, 241, 0.24);
        border-radius: 20px;
        pointer-events: none;
      }
      h1 {
        margin: 0 0 16px;
        font-size: 54px;
        line-height: 1.1;
        letter-spacing: 0.08em;
        text-transform: uppercase;
        color: #b8ff58;
        text-shadow: 0 0 24px rgba(184, 255, 88, 0.18);
      }
      p {
        margin: 0;
        font-size: 22px;
        line-height: 1.45;
        color: rgba(246,245,255,0.84);
      }
    </style>
    <div class="card">
      <h1>${title}</h1>
      <p>${subtitle}</p>
    </div>
  `)
  await page.waitForTimeout(durationMs)
}

async function showLoadingCard(page, title, subtitle = '', durationMs = 1600) {
  await page.setContent(`
    <style>
      body {
        margin: 0;
        font-family: "Arial Narrow", "Trebuchet MS", ui-sans-serif, system-ui, sans-serif;
        background:
          radial-gradient(circle at top, rgba(255, 0, 230, 0.18) 0%, transparent 30%),
          linear-gradient(160deg, #130128 0%, #1a0838 42%, #090014 100%);
        color: #f6f5ff;
        display: flex;
        align-items: center;
        justify-content: center;
        min-height: 100vh;
      }
      .wrap {
        display: flex;
        align-items: center;
        gap: 24px;
        padding: 34px 40px;
        border-radius: 22px;
        border: 1px solid rgba(170, 255, 98, 0.28);
        background: rgba(20, 4, 42, 0.82);
        box-shadow: 0 20px 60px rgba(0,0,0,0.48);
      }
      .spinner {
        width: 52px;
        height: 52px;
        border-radius: 999px;
        border: 4px solid rgba(255,255,255,0.16);
        border-top-color: #b8ff58;
        animation: spin 1s linear infinite;
      }
      .text {
        display: flex;
        flex-direction: column;
        gap: 6px;
      }
      .title {
        font-size: 30px;
        font-weight: 700;
        letter-spacing: 0.08em;
        text-transform: uppercase;
      }
      .subtitle {
        font-size: 18px;
        color: rgba(246,245,255,0.8);
      }
      @keyframes spin {
        from { transform: rotate(0deg); }
        to { transform: rotate(360deg); }
      }
    </style>
    <div class="wrap">
      <div class="spinner"></div>
      <div class="text">
        <div class="title">${title}</div>
        <div class="subtitle">${subtitle}</div>
      </div>
    </div>
  `)
  await page.waitForTimeout(durationMs)
}

async function moveMouseToLocator(page, locator) {
  const box = await locator.boundingBox().catch(() => null)
  if (!box) return
  await page.mouse.move(80, 80, { steps: 6 })
  await page.evaluate(() => window.__demoMoveCursor?.(80, 80, false)).catch(() => {})
  await page.waitForTimeout(120)
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 18 })
  await page.evaluate(([x, y]) => window.__demoMoveCursor?.(x, y, false), [box.x + box.width / 2, box.y + box.height / 2]).catch(() => {})
  await page.waitForTimeout(180)
}

async function revealLocator(page, locator, settleMs = 900) {
  await locator.waitFor({ timeout: 60_000 })
  await locator.evaluate((element) => {
    element.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' })
  })
  await page.waitForTimeout(settleMs)
  await moveMouseToLocator(page, locator)
}

async function clickVisible(page, locator) {
  await revealLocator(page, locator)
  const box = await locator.boundingBox().catch(() => null)
  if (box) {
    await page.evaluate(([x, y]) => window.__demoMoveCursor?.(x, y, true), [box.x + box.width / 2, box.y + box.height / 2]).catch(() => {})
  }
  await locator.click()
  if (box) {
    await page.waitForTimeout(120)
    await page.evaluate(([x, y]) => window.__demoMoveCursor?.(x, y, false), [box.x + box.width / 2, box.y + box.height / 2]).catch(() => {})
  }
}

async function openRoute(page, path, readyLocator, settleMs = 2200) {
  await page.goto(`${baseUrl}${path}`, { waitUntil: 'networkidle' })
  if (readyLocator) {
    await readyLocator.waitFor({ timeout: 60_000 })
  }
  await page.waitForTimeout(settleMs)
}

async function waitForText(page, locator, regex, timeout = 120_000, errorLocator = null) {
  const deadline = Date.now() + timeout
  while (Date.now() < deadline) {
    const text = (await locator.textContent().catch(() => '')) ?? ''
    if (regex.test(text)) return text
    if (errorLocator) {
      const errorText = ((await errorLocator.textContent().catch(() => '')) ?? '').trim()
      if (errorText) {
        throw new Error(errorText)
      }
    }
    await page.waitForTimeout(750)
  }
  throw new Error(`Timed out waiting for text ${regex}`)
}

async function runDemo(page, resolveCatalogFixture) {
  const rebalanceArkaId = rebalanceValidation.arka
  const tokenIn = rebalanceValidation.tokenIn
  const tokenOut = rebalanceValidation.tokenOut
  const featuredArkaPage = await resolveCatalogFixture('/v1/arkas', new URLSearchParams('curated=true&limit=12'))
  const featuredManagersPage = await resolveCatalogFixture('/v1/managers', new URLSearchParams('limit=12'))
  const featuredAssetsPage = await resolveCatalogFixture('/v1/assets', new URLSearchParams('limit=12'))
  const featuredArka = featuredArkaPage.items?.find((item) => item.identity?.displayName)
    ?? featuredArkaPage.items?.[0]
  const featuredManager = featuredManagersPage.items?.find((item) => item.identity?.displayName)
    ?? featuredManagersPage.items?.[0]
  const featuredArkaId = featuredArka?.arkaId
  const featuredArkaSearch = featuredArka?.identity?.displayName ?? featuredArkaId
  const featuredManagerId = featuredManager?.manager
  const featuredManagerSearch = featuredManager?.identity?.displayName ?? featuredManagerId
  const featuredAssetId = featuredAssetsPage.items?.[0]?.assetContract

  if (!featuredArkaId || !featuredManagerId || !featuredAssetId) {
    throw new Error('Catalog fixtures are missing the primary Arka, manager or asset entries required for the demo')
  }

  if (!tourOnly) {
    ensureTokenBalance(createDenominationId, 20_000)
    ensureCoverageAllowance('1000')
    ensureAllowance(createDenominationId, rebalanceArkaId, '1000000')
    ensureAllowance(tokenOut, rebalanceArkaId, '1000000')
  }
  if (!directCatalog) {
    await installCatalogFixtureMock(page, resolveCatalogFixture)
  }
  await page.addInitScript(([profile, address]) => {
    window.localStorage.setItem('e2e-wallet-profile', profile)
    window.localStorage.setItem('wallet:pubkey', address)
  }, ['holder', holderAddress])

  await showTitleCard(
    page,
    'Arka.fund Product Tour',
    tourOnly
      ? 'A guided look at live portfolios, manager and asset discovery, protocol integrations, and the Create Arka experience.'
      : 'A full walkthrough of the product catalog, ranked profiles, manager and asset explorers, and live Stellar testnet execution from one interface.',
    3400,
  )

  logStep('dashboard')
  await showLoadingCard(page, 'Opening dashboard', 'Loading the indexed product shell and current operating posture.')
  await openRoute(page, '/dashboard', page.getByTestId('dashboard-fidelity-shell'))
  await revealLocator(page, page.getByTestId('dashboard-stage-panel'))
  await page.waitForTimeout(1200)
  await clickVisible(page, page.getByTestId('dashboard-section-tab-monitoring'))
  await revealLocator(page, page.getByTestId('dashboard-monitoring-panel'))
  await page.waitForTimeout(1200)
  await revealLocator(page, page.getByTestId('dashboard-arkas-panel'))
  await page.waitForTimeout(1800)

  logStep('discover')
  await showLoadingCard(page, 'Discovery lens', 'Screening the catalog before stepping into ranked vault views.')
  await openRoute(page, '/discover', page.getByTestId('discover-fidelity-shell'))
  await revealLocator(page, page.getByTestId('discover-search-input'))
  await page.getByTestId('discover-search-input').fill(featuredArkaSearch)
  await waitForText(page, page.getByTestId('discover-stage-copy'), /1 Arka\b/, 60_000)
  await revealLocator(page, page.getByTestId('discover-arkas-panel'))
  await page.waitForTimeout(1200)
  await clickVisible(page, page.getByTestId('discover-section-tab-assets'))
  await revealLocator(page, page.getByTestId('discover-assets-panel'))
  await page.waitForTimeout(1600)

  logStep('vault leaderboard')
  await showLoadingCard(page, 'Ranked Arkas', 'Comparing portfolio value, profit and activity across the public leaderboard.')
  await openRoute(page, '/vaults', page.getByTestId('vaults-leaderboard-panel'))
  await revealLocator(page, page.getByTestId('vaults-search-input'))
  await clickVisible(page, page.getByTestId('vaults-curated-toggle'))
  await waitForText(page, page.getByTestId('vaults-leaderboard-panel'), /5 of 5 Arkas/, 60_000)
  await revealLocator(page, page.getByTestId('vaults-leaderboard-panel'))
  await page.waitForTimeout(1200)
  await revealLocator(
    page,
    page.getByTestId('vault-leaderboard-card').or(page.getByTestId('vault-watchlist-card')).first(),
  )
  await page.waitForTimeout(1600)

  logStep('manager explorer')
  await showLoadingCard(page, 'Manager explorer', 'Comparing operator scale, managed value and current Arka coverage.')
  await openRoute(page, '/managers', page.getByTestId('managers-list'))
  await revealLocator(page, page.getByTestId('managers-search-input'))
  await page.getByTestId('managers-search-input').fill(featuredManagerSearch)
  await page.waitForTimeout(1200)
  await revealLocator(page, page.getByTestId('managers-list'))
  await page.waitForTimeout(1100)
  await revealLocator(page, page.getByTestId('manager-card').first())
  await page.waitForTimeout(1400)

  logStep('asset explorer')
  await showLoadingCard(page, 'Asset explorer', 'Reviewing portfolio exposure, concentration and supported Stellar assets.')
  await openRoute(page, '/assets', page.getByTestId('assets-list'))
  await revealLocator(page, page.getByTestId('assets-list'))
  await page.waitForTimeout(1200)
  await revealLocator(page, page.getByTestId('asset-card').first())
  await page.waitForTimeout(1600)

  logStep('integrations')
  await showLoadingCard(page, 'Integration catalog', 'Reviewing the supported protocol capabilities before moving into an Arka workspace.')
  await openRoute(page, '/integrations', page.getByTestId('integrations-product-catalog'))
  await revealLocator(page, page.getByTestId('integrations-product-card-grid'))
  await page.waitForTimeout(1000)
  await revealLocator(page, page.getByTestId('integrations-public-metric-deck'))
  await page.waitForTimeout(1600)

  logStep('vault ops index')
  await showLoadingCard(page, 'Opening Arkas', 'Reviewing available vaults before entering the create flow.')
  await openRoute(page, '/arkas', page.getByTestId('vault-ops-recent-panel'), 2600)
  await revealLocator(page, page.getByTestId('vault-ops-registry-panel'))
  await page.waitForTimeout(1500)

  logStep('create workspace')
  await showLoadingCard(page, 'Opening Create Arka', 'Moving from the homepage to the factory flow.')
  await openRoute(page, '/factory/create?step=basics', page.getByTestId('create-profile-panel'), 2000)
  await page.getByTestId('create-arka-display-name').fill('Stellar Core Strategy')
  await page.getByTestId('create-arka-description').fill('A diversified Stellar portfolio with governed execution controls.')
  await page.getByTestId('create-manager-display-name').fill('Arka Strategy Team')
  await page.getByTestId('create-manager-description').fill('Systematic allocation and risk-managed execution across approved Stellar venues.')
  const denominationOptions = page.locator('[data-testid^="create-arka-denom-option-"]')
  const usdcDenomination = denominationOptions.filter({ hasText: /USDC/i }).first()
  await clickVisible(
    page,
    (await usdcDenomination.count()) > 0 ? usdcDenomination : denominationOptions.first(),
  )
  for (const symbol of ['XLM', 'AQUA']) {
    const option = page
      .locator('[data-testid^="create-arka-whitelist-option-"]')
      .filter({ hasText: new RegExp(symbol, 'i') })
      .first()
    if (await option.count()) await clickVisible(page, option)
  }
  await revealLocator(page, page.getByTestId('create-arka-denomination-panel'))
  await page.waitForTimeout(1200)
  await revealLocator(page, page.getByTestId('create-arka-whitelist-panel'))
  await page.waitForTimeout(1400)
  await clickVisible(page, page.getByTestId('create-step-fees'))
  await revealLocator(page, page.getByTestId('create-fees-panel'))
  await page.waitForTimeout(1400)
  await clickVisible(page, page.getByTestId('create-step-assets'))
  await revealLocator(page, page.getByTestId('create-assets-management-panel'))
  await page.waitForTimeout(1400)
  await clickVisible(page, page.getByTestId('create-step-review'))
  await revealLocator(page, page.getByTestId('create-review-panel'))
  await page.waitForTimeout(1800)

  if (tourOnly) {
    logStep('tour complete')
    await showTitleCard(
      page,
      'Arka.fund Product Tour',
      'The walkthrough covered dashboard, discovery, ranked Arkas, manager and asset explorers, integrations, and the complete Arka creation workspace.',
      3200,
    )
    return
  }

  logStep('live vault deposit and redeem workspace')
  await showLoadingCard(page, 'Opening live vault ops', 'Switching from the creation workspace into an already deployed Arka for real execution.')
  await openRoute(page, `/arkas/${rebalanceArkaId}`, page.getByTestId('arka-workspace-tabs'), 2000)
  await connectWalletIfNeeded(page)
  await clickVisible(page, page.getByTestId('arka-workspace-tab-flow'))
  await page.getByTestId('arka-asset-select').waitFor({ timeout: 60_000 })
  await revealLocator(page, page.getByTestId('arka-asset-select'))
  await page.getByTestId('arka-asset-select').selectOption(createDenominationId)
  await page.getByTestId('arka-amount-input').fill(depositAmountDisplay)
  await page.waitForTimeout(1800)
  await revealLocator(page, page.getByTestId('arka-flow-panel'))
  await page.waitForTimeout(1800)

  await setWalletProfile(page, 'manager', managerAddress)
  logStep('soroswap rebalance')
  await showLoadingCard(page, 'Opening Rebalance Flow', 'Loading the live vault used for swap demonstrations.')
  await openRoute(page, `/arkas/${rebalanceArkaId}`, page.getByTestId('arka-workspace-tabs'), 1800)
  await connectWalletIfNeeded(page)
  await clickVisible(page, page.getByTestId('arka-workspace-tab-rebalance'))
  await page.getByTestId('rebalance-protocol-select').waitFor({ timeout: 60_000 })
  await revealLocator(page, page.getByTestId('rebalance-protocol-select'))
  await page.getByTestId('rebalance-protocol-select').selectOption('SOROSWAP')
  await page.getByTestId('rebalance-asset-in-select').selectOption(tokenIn)
  await page.getByTestId('rebalance-asset-out-select').selectOption(tokenOut)
  await page.getByTestId('rebalance-amount-input').fill('0.0100000')
  await page.waitForTimeout(1200)
  await clickVisible(page, page.getByTestId('rebalance-run-button'))
  await waitForText(page, page.getByTestId('arka-status'), /rebalance completed:/i, 180_000, page.getByTestId('rebalance-error'))
  await page.waitForTimeout(3000)
  logStep('soroswap rebalance complete')

  logStep('aquarius rebalance')
  await showLoadingCard(page, 'Switching Rebalance Provider', 'The same vault will now use Aquarius.')
  await openRoute(page, `/arkas/${rebalanceArkaId}`, page.getByTestId('arka-workspace-tabs'), 1800)
  await clickVisible(page, page.getByTestId('arka-workspace-tab-rebalance'))
  await page.getByTestId('rebalance-protocol-select').waitFor({ timeout: 60_000 })
  await revealLocator(page, page.getByTestId('rebalance-protocol-select'))
  await page.getByTestId('rebalance-protocol-select').selectOption('AQUARIUS')
  await page.getByTestId('rebalance-asset-in-select').selectOption(tokenIn)
  await page.getByTestId('rebalance-asset-out-select').selectOption(tokenOut)
  await page.getByTestId('rebalance-amount-input').fill('0.0100000')
  await page.waitForTimeout(1200)
  await clickVisible(page, page.getByTestId('rebalance-run-button'))
  await waitForText(page, page.getByTestId('arka-status'), /rebalance completed:/i, 180_000, page.getByTestId('rebalance-error'))
  await page.waitForTimeout(3000)
  logStep('aquarius rebalance complete')

  await setWalletProfile(page, 'manager', managerAddress)
  logStep('blend credit')
  await showLoadingCard(page, 'Opening Credit Position', 'Jumping into the Blend-powered vault strategy.')
  await openRoute(page, `/arkas/${blendArkaId}`, page.getByTestId('arka-workspace-tabs'), 1800)
  await connectWalletIfNeeded(page)
  await clickVisible(page, page.getByTestId('arka-workspace-tab-credit'))
  await page.getByTestId('credit-asset-select').waitFor({ timeout: 60_000 })
  const creditAssetSelect = page.getByTestId('credit-asset-select')
  await page.waitForFunction(() => {
    const select = document.querySelector('[data-testid="credit-asset-select"]')
    return Boolean(select && select.querySelectorAll('option').length > 2)
  }, { timeout: 60_000 })
  const selectedBlendAsset = await creditAssetSelect.locator('option').last().evaluate((option) => option.value)
  await revealLocator(page, creditAssetSelect)
  await creditAssetSelect.selectOption(selectedBlendAsset)
  await page.getByTestId('credit-action-select').selectOption('Supply')
  await page.getByTestId('credit-amount-input').fill(blendSupplyAmountDisplay)
  await page.waitForTimeout(800)
  await clickVisible(page, page.getByTestId('credit-run-button'))
  await waitForText(page, page.getByTestId('credit-status'), /credit action submitted:/i, 180_000, page.getByTestId('credit-error'))
  await page.waitForTimeout(2200)
  await page.getByTestId('credit-action-select').selectOption('Borrow')
  await page.getByTestId('credit-amount-input').fill(blendBorrowAmountDisplay)
  await page.waitForTimeout(800)
  await clickVisible(page, page.getByTestId('credit-run-button'))
  await waitForText(page, page.getByTestId('credit-status'), /credit action submitted:/i, 180_000, page.getByTestId('credit-error'))
  await page.waitForTimeout(3000)
  logStep('blend credit complete')

  await setWalletProfile(page, 'holder', holderAddress)
  logStep('coverage')
  await showLoadingCard(page, 'Opening Coverage', 'Switching to coverage rewards and stake management.')
  await openRoute(page, '/coverage', page.getByTestId('coverage-stake-input'), 1800)
  await connectWalletIfNeeded(page)
  await clickVisible(page, page.getByRole('button', { name: /claim rewards/i }))
  await waitForText(page, page.getByTestId('coverage-status'), /success:/i, 180_000, page.getByTestId('coverage-error'))
  await page.waitForTimeout(1500)
  await revealLocator(page, page.getByTestId('coverage-stake-input'))
  await page.getByTestId('coverage-stake-input').fill(coverageMutationAmountDisplay)
  await clickVisible(page, page.getByTestId('coverage-stake-button'))
  await waitForText(page, page.getByTestId('coverage-status'), /success:/i, 180_000, page.getByTestId('coverage-error'))
  await page.waitForTimeout(1200)
  await revealLocator(page, page.getByTestId('coverage-unstake-input'))
  await page.getByTestId('coverage-unstake-input').fill(coverageMutationAmountDisplay)
  await clickVisible(page, page.getByTestId('coverage-unstake-button'))
  await waitForText(page, page.getByTestId('coverage-status'), /success:/i, 180_000, page.getByTestId('coverage-error'))
  await page.waitForTimeout(2500)
  logStep('coverage complete')

  await setWalletProfile(page, 'manager', governanceValidation.proposerAddress)
  logStep('governance')
  await showLoadingCard(page, 'Opening Governance', 'Creating and voting on a live proposal from the browser.')
  await openRoute(page, '/governance', page.getByTestId('governance-proposal-kind-select'), 1800)
  await connectWalletIfNeeded(page)
  await revealLocator(page, page.getByTestId('governance-proposal-kind-select'))
  await page.getByTestId('governance-proposal-kind-select').selectOption('Council')
  await page.getByTestId('governance-new-council-input').fill(governanceValidation.proposerAddress)
  await page.waitForTimeout(1000)
  await clickVisible(page, page.getByTestId('governance-propose-button'))
  await waitForText(page, page.getByTestId('governance-status'), /success:/i, 180_000, page.getByTestId('governance-error'))
  const proposalId = (await page.getByTestId('governance-proposal-id-input').inputValue()).trim()
  await page.waitForTimeout(2000)

  await setWalletProfile(page, 'holder', governanceValidation.forVoterAddress)
  await page.reload({ waitUntil: 'networkidle' })
  await connectWalletIfNeeded(page)
  await revealLocator(page, page.getByTestId('governance-proposal-id-input'))
  await page.getByTestId('governance-proposal-id-input').fill(proposalId)
  await page.getByTestId('governance-support-select').selectOption('1')
  await page.waitForTimeout(1000)
  await clickVisible(page, page.getByTestId('governance-vote-button'))
  await waitForText(page, page.getByTestId('governance-status'), /success:/i, 180_000, page.getByTestId('governance-error'))
  await clickVisible(page, page.getByTestId('governance-refresh-button'))
  await page.waitForTimeout(2500)
  logStep('governance complete')

  await setWalletProfile(page, 'holder', holderAddress)
  logStep('redeem workspace')
  await showLoadingCard(page, 'Returning to the Live Vault', 'Closing the loop on the same operational Arka and revisiting the deposit and redeem workspace.')
  await openRoute(page, `/arkas/${rebalanceArkaId}`, page.getByTestId('arka-workspace-tabs'), 1800)
  await connectWalletIfNeeded(page)
  await clickVisible(page, page.getByTestId('arka-workspace-tab-flow'))
  await page.getByTestId('arka-amount-input').waitFor({ timeout: 60_000 })
  await revealLocator(page, page.getByTestId('arka-amount-input'))
  await page.getByTestId('arka-amount-input').fill(depositAmountDisplay)
  await page.waitForTimeout(1400)
  await revealLocator(page, page.getByTestId('arka-flow-panel'))
  await page.waitForTimeout(2200)
  logStep('redeem workspace complete')

  logStep('render outro')
  await showTitleCard(
    page,
    'Arka.fund Product Tour',
    'The walkthrough covered dashboard, discovery, ranked Arkas, manager and asset explorers, integrations, the Arka creation and deposit or redeem workspaces, plus live rebalances, Blend credit, coverage and governance on Stellar testnet.',
    3800,
  )
}

async function main() {
  mkdirSync(rawVideoDir, { recursive: true })
  rmSync(outputMp4, { force: true })
  rmSync(outputWebm, { force: true })
  if (process.env.DEMO_EXTERNAL_SERVER !== '1') freePort(port)

  if (!tourOnly && process.env.DEMO_SKIP_PREP !== '1') {
    execFileSync('npm', ['run', 'e2e:prep'], { cwd: dappRoot, stdio: 'inherit' })
  }
  if (process.env.DEMO_SKIP_BUILD !== '1') {
    execFileSync('npm', ['run', 'build'], { cwd: dappRoot, stdio: 'inherit' })
  }

  const server = process.env.DEMO_EXTERNAL_SERVER === '1'
    ? null
    : spawn('npm', ['run', 'start', '--', '--hostname', '127.0.0.1', '--port', String(port)], {
        cwd: dappRoot,
        env: buildServerEnv(),
        stdio: 'inherit',
        detached: false,
      })

  const cleanup = () => {
    try {
      if (server && !server.killed) {
        server.kill('SIGTERM')
      }
    } catch {}
    if (server) freePort(port)
  }

  process.on('exit', cleanup)
  process.on('SIGINT', () => {
    cleanup()
    process.exit(130)
  })
  try {
    if (process.env.DEMO_SKIP_SERVER_WAIT !== '1') {
      await waitForServer(baseUrl, 120_000)
    }
    const resolveCatalogFixture = await loadCatalogFixtureResolver()

    const browser = await chromium.launch({
      headless: true,
      slowMo: 150,
      args: process.env.DEMO_HOST_RESOLVER_RULES
        ? [`--host-resolver-rules=${process.env.DEMO_HOST_RESOLVER_RULES}`]
        : [],
    })
    const context = await browser.newContext({
      viewport: { width: 1600, height: 900 },
      recordVideo: {
        dir: rawVideoDir,
        size: { width: 1600, height: 900 },
      },
    })
    const page = await context.newPage()
    await installDemoCursor(page)
    const video = page.video()
    let rawVideoPath = ''

    try {
      await runDemo(page, resolveCatalogFixture)
    } finally {
      await page.close()
      rawVideoPath = await video.path()
      await context.close()
      await browser.close()
    }

    execFileSync('cp', [rawVideoPath, outputWebm])
    execFileSync('ffmpeg', [
      '-y',
      '-i', outputWebm,
      '-c:v', 'libx264',
      '-pix_fmt', 'yuv420p',
      '-movflags', '+faststart',
      '-c:a', 'aac',
      outputMp4,
    ], { stdio: 'inherit' })

    console.log(`Raw video: ${outputWebm}`)
    console.log(`MP4 video: ${outputMp4}`)
  } finally {
    cleanup()
  }
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
