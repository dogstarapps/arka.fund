import { existsSync, mkdirSync, readFileSync, rmSync } from 'node:fs'
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
const rawDir = resolve(videoDir, 'raw')
const clipsDir = resolve(videoDir, 'clips')
const port = 3017
const baseUrl = `http://127.0.0.1:${port}`
const rebalanceValidationPath = resolve(tmpDir, 'rebalance-live-validation.json')

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

async function installDemoOverlay(page) {
  await page.addInitScript(() => {
    const ensureOverlay = () => {
      if (document.getElementById('__demo_cursor__')) return

      const style = document.createElement('style')
      style.id = '__demo_overlay_style__'
      style.textContent = `
        #__demo_cursor__ {
          position: fixed;
          left: 0;
          top: 0;
          width: 22px;
          height: 22px;
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
      cursor.style.left = '80px'
      cursor.style.top = '80px'
      document.body.appendChild(cursor)

    }

    const ensureWhenReady = () => {
      if (document.body) {
        ensureOverlay()
      } else {
        document.addEventListener('DOMContentLoaded', ensureOverlay, { once: true })
      }
    }

    ensureWhenReady()
    ;(window).__demoMoveCursor = (x, y, clicking = false) => {
      ensureOverlay()
      const cursor = document.getElementById('__demo_cursor__')
      if (!cursor) return
      cursor.style.left = `${x}px`
      cursor.style.top = `${y}px`
      cursor.style.transform = clicking ? 'translate(-50%, -50%) scale(0.84)' : 'translate(-50%, -50%) scale(1)'
      cursor.style.background = clicking ? 'rgba(249, 115, 22, 0.96)' : 'rgba(56, 189, 248, 0.92)'
    }
  })
}

async function showLoadingCard(page, title, subtitle = '', durationMs = 1800) {
  await page.setContent(`
    <style>
      body { margin: 0; font-family: ui-sans-serif, system-ui, sans-serif; background: radial-gradient(circle at top, #1e293b 0%, #0f172a 55%, #020617 100%); color: #f8fafc; display: flex; align-items: center; justify-content: center; min-height: 100vh; }
      .wrap { display: flex; align-items: center; gap: 24px; padding: 34px 40px; border-radius: 22px; border: 1px solid rgba(255,255,255,0.12); background: rgba(15, 23, 42, 0.72); box-shadow: 0 20px 60px rgba(0,0,0,0.35); }
      .spinner { width: 52px; height: 52px; border-radius: 999px; border: 4px solid rgba(255,255,255,0.16); border-top-color: #38bdf8; animation: spin 1s linear infinite; }
      .title { font-size: 30px; font-weight: 700; }
      .subtitle { margin-top: 6px; font-size: 18px; color: rgba(248,250,252,0.8); }
      @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
    </style>
    <div class="wrap">
      <div class="spinner"></div>
      <div>
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
    const top = window.scrollY + element.getBoundingClientRect().top - 120
    window.scrollTo({ top: Math.max(0, top), behavior: 'smooth' })
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
  await page.waitForTimeout(120)
  if (box) {
    await page.evaluate(([x, y]) => window.__demoMoveCursor?.(x, y, false), [box.x + box.width / 2, box.y + box.height / 2]).catch(() => {})
  }
}

async function waitForText(page, locator, regex, timeout = 180_000) {
  await locator.waitFor({ timeout })
  const deadline = Date.now() + timeout
  while (Date.now() < deadline) {
    const text = (await locator.textContent().catch(() => '')) ?? ''
    if (regex.test(text)) return text
    await page.waitForTimeout(750)
  }
  throw new Error(`Timed out waiting for text ${regex}`)
}

async function connectWalletIfNeeded(page) {
  const connectButton = page.getByRole('button', { name: /connect wallet/i })
  if (await connectButton.isVisible().catch(() => false)) {
    await connectButton.click()
  }
}

async function setWalletProfile(page, profile, address) {
  await page.evaluate(([nextProfile, nextAddress]) => {
    window.localStorage.setItem('e2e-wallet-profile', nextProfile)
    window.localStorage.setItem('wallet:pubkey', nextAddress)
  }, [profile, address])
}

async function main() {
  const rebalanceValidation = readJson(rebalanceValidationPath)
  const holderAddress = stellarOutput(['keys', 'address', 'arka-holder'])
  const managerAddress = stellarOutput(['keys', 'address', 'arka-holder'])
  const rawPath = resolve(rawDir, 'rebalance-segment.webm')
  const mp4Path = resolve(clipsDir, '04-rebalance-segment.mp4')

  mkdirSync(rawDir, { recursive: true })
  mkdirSync(clipsDir, { recursive: true })
  rmSync(rawPath, { force: true })
  rmSync(mp4Path, { force: true })
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

  try {
    await waitForServer(baseUrl, 120_000)

    const browser = await chromium.launch({ headless: true, slowMo: 150 })
    const context = await browser.newContext({
      viewport: { width: 1600, height: 900 },
      recordVideo: { dir: rawDir, size: { width: 1600, height: 900 } },
    })
    const page = await context.newPage()
    const video = page.video()

    try {
      await installDemoOverlay(page)
      await page.addInitScript(([profile, address]) => {
        window.localStorage.setItem('e2e-wallet-profile', profile)
        window.localStorage.setItem('wallet:pubkey', address)
      }, ['holder', holderAddress])

      await showLoadingCard(page, 'Opening Rebalance Flow', 'Loading the live vault used for swap demonstrations.')
      await page.goto(`${baseUrl}/arkas/${rebalanceValidation.arka}`, { waitUntil: 'networkidle' })
      await setWalletProfile(page, 'manager', managerAddress)
      await page.reload({ waitUntil: 'networkidle' })
      await page.waitForTimeout(1200)
      await connectWalletIfNeeded(page)
      await revealLocator(page, page.getByTestId('rebalance-protocol-select'))
      await page.getByTestId('rebalance-protocol-select').selectOption('SOROSWAP')
      await page.getByTestId('rebalance-asset-in-select').selectOption(rebalanceValidation.tokenIn)
      await page.getByTestId('rebalance-asset-out-select').selectOption(rebalanceValidation.tokenOut)
      await page.getByTestId('rebalance-amount-input').fill('0.0100000')
      await page.waitForTimeout(1200)
      await clickVisible(page, page.getByTestId('rebalance-run-button'))
      await waitForText(page, page.getByTestId('arka-status'), /rebalance completed:/i, 180_000)
      await revealLocator(page, page.getByTestId('arka-status'), 1200)
      await page.waitForTimeout(2200)

      await showLoadingCard(page, 'Switching Rebalance Provider', 'The same vault will now use Aquarius.')
      await page.goto(`${baseUrl}/arkas/${rebalanceValidation.arka}`, { waitUntil: 'networkidle' })
      await page.waitForTimeout(1200)
      await revealLocator(page, page.getByTestId('rebalance-protocol-select'))
      await page.getByTestId('rebalance-protocol-select').selectOption('AQUARIUS')
      await page.getByTestId('rebalance-asset-in-select').selectOption(rebalanceValidation.tokenIn)
      await page.getByTestId('rebalance-asset-out-select').selectOption(rebalanceValidation.tokenOut)
      await page.getByTestId('rebalance-amount-input').fill('0.0100000')
      await page.waitForTimeout(1200)
      await clickVisible(page, page.getByTestId('rebalance-run-button'))
      await waitForText(page, page.getByTestId('arka-status'), /rebalance completed:/i, 180_000)
      await revealLocator(page, page.getByTestId('arka-status'), 1200)
      await page.waitForTimeout(2200)
    } finally {
      await page.close()
      const generatedPath = await video.path()
      execFileSync('cp', [generatedPath, rawPath])
      await context.close()
      await browser.close()
    }

    execFileSync('ffmpeg', [
      '-y',
      '-i', rawPath,
      '-c:v', 'libx264',
      '-pix_fmt', 'yuv420p',
      '-movflags', '+faststart',
      '-c:a', 'aac',
      mp4Path,
    ], { stdio: 'inherit' })

    console.log(`Rebalance segment written to ${mp4Path}`)
  } finally {
    cleanup()
  }
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
