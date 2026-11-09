import { existsSync, mkdirSync, readFileSync, rmSync } from 'node:fs'
import { resolve } from 'node:path'
import { execFileSync, spawn } from 'node:child_process'
import { chromium } from '@playwright/test'

const dappRoot = resolve(new URL('..', import.meta.url).pathname)
const workspaceRoot = resolve(dappRoot, '..')
const arkafundRoot = resolve(workspaceRoot, 'arkafund')
const tmpDir = resolve(arkafundRoot, 'tmp')
const clipDir = resolve(tmpDir, 'demo-video', 'clips')
const rawDir = resolve(tmpDir, 'demo-video', 'raw')
const port = 3016
const baseUrl = `http://127.0.0.1:${port}`
const governanceValidationPath = resolve(tmpDir, 'governance-live-validation.json')

function readJson(path) {
  if (!existsSync(path)) throw new Error(`Missing required file: ${path}`)
  return JSON.parse(readFileSync(path, 'utf8'))
}

function freePort(portNumber) {
  try {
    const output = execFileSync('lsof', ['-ti', `tcp:${portNumber}`], { encoding: 'utf8' }).trim()
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

function buildServerEnv(governorId) {
  return {
    ...process.env,
    NEXT_PUBLIC_E2E_WALLET: '1',
    E2E_WALLET_ENABLED: '1',
    NEXT_PUBLIC_ARKA_FACTORY: 'CAZPR5MIUHXH46ZJ5OAMRZXD7PXIHMF5HHSSKQPDUBEXVID5SAGSZ3HW',
    NEXT_PUBLIC_ARKA_ROUTER: 'CAARCDANGZNLDR7CF5MRUA32VUBD6KAZMTNTVJKA5ISQHHKYMP7YFTTI',
    NEXT_PUBLIC_ARKA_REGISTRY: 'CD7NVBDWH7YDCAJGPESKANQMQGNC2FCNX7WBUIRWWKF4QI5NMPRP22NW',
    NEXT_PUBLIC_GOVERNOR_ID: governorId,
    NEXT_PUBLIC_DENOMINATION: 'CB22KRA3YZVCNCQI64JQ5WE7UY2VAV7WFLK6A2JN3HEX56T2EDAFO7QF',
    NEXT_PUBLIC_ROUTING_ASSET_A: 'CB22KRA3YZVCNCQI64JQ5WE7UY2VAV7WFLK6A2JN3HEX56T2EDAFO7QF',
    NEXT_PUBLIC_ROUTING_ASSET_B: 'CAQCFVLOBK5GIULPNZRGATJJMIZL5BSP7X5YJVMGCPTUEPFM4AVSRCJU',
    NEXT_PUBLIC_SOROSWAP_ROUTER: 'CCJUD55AG6W5HAI5LRVNKAE5WDP5XGZBUDS5WNTIVDU7O264UZZE7BRD',
    NEXT_PUBLIC_AQUARIUS_ROUTER: 'CBCFTQSPDBAIZ6R6PJQKSQWKNKWH2QIV3I4J72SHWBIK3ADRRAM5A6GD',
    NEXT_PUBLIC_AQUARIUS_POOL_ROUTING_PAIR: '',
    NEXT_PUBLIC_ADAPTER_BLEND: 'CADVUIKDYSEHWNWFMUACMUUVXA7GNNVFVIHO365FG2YGQU7OKEOUXCHX',
    NEXT_PUBLIC_BLEND_MARKET_ID: '0',
  }
}

function shortAddress(address) {
  return address ? `${address.slice(0, 6)}...${address.slice(-4)}` : '—'
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
        #__demo_wallet_badge__ {
          position: fixed;
          top: 18px;
          right: 18px;
          z-index: 2147483646;
          padding: 10px 14px;
          border-radius: 999px;
          background: rgba(15, 23, 42, 0.92);
          color: #f8fafc;
          font: 600 13px/1.2 ui-sans-serif, system-ui, sans-serif;
          box-shadow: 0 14px 30px rgba(0,0,0,0.22);
          border: 1px solid rgba(255,255,255,0.1);
          pointer-events: none;
        }
      `
      document.documentElement.appendChild(style)

      const cursor = document.createElement('div')
      cursor.id = '__demo_cursor__'
      cursor.style.left = '80px'
      cursor.style.top = '80px'
      document.body.appendChild(cursor)

      const badge = document.createElement('div')
      badge.id = '__demo_wallet_badge__'
      badge.textContent = 'Wallet connected: —'
      document.body.appendChild(badge)
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
    ;(window).__demoSetWallet = (label) => {
      ensureOverlay()
      const badge = document.getElementById('__demo_wallet_badge__')
      if (badge) badge.textContent = label
    }
  })
}

async function waitForContains(locator, regex, timeout = 120_000) {
  const deadline = Date.now() + timeout
  while (Date.now() < deadline) {
    const text = ((await locator.textContent().catch(() => '')) ?? '').trim()
    if (regex.test(text)) return text
    await new Promise((resolve) => setTimeout(resolve, 1000))
  }
  throw new Error(`Timed out waiting for text ${regex}`)
}

async function connectWalletIfNeeded(page) {
  const connectButton = page.getByRole('button', { name: /connect wallet/i })
  if (await connectButton.isVisible().catch(() => false)) {
    await connectButton.click()
  }
}

async function moveMouseToLocator(page, locator) {
  const box = await locator.boundingBox().catch(() => null)
  if (!box) return
  await page.mouse.move(80, 80, { steps: 6 })
  await page.evaluate(() => window.__demoMoveCursor?.(80, 80, false)).catch(() => {})
  await new Promise((resolve) => setTimeout(resolve, 120))
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 18 })
  await page.evaluate(([x, y]) => window.__demoMoveCursor?.(x, y, false), [box.x + box.width / 2, box.y + box.height / 2]).catch(() => {})
  await new Promise((resolve) => setTimeout(resolve, 180))
}

async function revealLocator(page, locator, settleMs = 700) {
  await locator.waitFor({ timeout: 60_000 })
  await locator.evaluate((element) => {
    const top = window.scrollY + element.getBoundingClientRect().top - 120
    window.scrollTo({ top: Math.max(0, top), behavior: 'smooth' })
  })
  await new Promise((resolve) => setTimeout(resolve, settleMs))
  await moveMouseToLocator(page, locator)
}

async function clickVisible(page, locator) {
  await revealLocator(page, locator)
  const box = await locator.boundingBox().catch(() => null)
  if (box) {
    await page.evaluate(([x, y]) => window.__demoMoveCursor?.(x, y, true), [box.x + box.width / 2, box.y + box.height / 2]).catch(() => {})
  }
  await locator.click()
  await new Promise((resolve) => setTimeout(resolve, 120))
  if (box) {
    await page.evaluate(([x, y]) => window.__demoMoveCursor?.(x, y, false), [box.x + box.width / 2, box.y + box.height / 2]).catch(() => {})
  }
}

async function main() {
  const governance = readJson(governanceValidationPath)
  mkdirSync(rawDir, { recursive: true })
  mkdirSync(clipDir, { recursive: true })
  const rawPath = resolve(rawDir, '09-governance.webm')
  const mp4Path = resolve(clipDir, '09-governance.mp4')
  rmSync(rawPath, { force: true })
  rmSync(mp4Path, { force: true })
  freePort(port)

  const server = spawn('npm', ['run', 'start', '--', '--hostname', '127.0.0.1', '--port', String(port)], {
    cwd: dappRoot,
    env: buildServerEnv(governance.governor),
    stdio: 'inherit',
  })
  const cleanup = () => {
    if (!server.killed) server.kill('SIGTERM')
  }
  process.on('exit', cleanup)

  try {
    await waitForServer(baseUrl, 120_000)

    const browser = await chromium.launch({ headless: true, slowMo: 150 })
    const adminContext = await browser.newContext({
      viewport: { width: 1600, height: 900 },
      recordVideo: { dir: rawDir, size: { width: 1600, height: 900 } },
    })
    await adminContext.addInitScript((address) => {
      window.localStorage.setItem('e2e-wallet-profile', 'manager')
      window.localStorage.setItem('wallet:pubkey', address)
    }, governance.proposerAddress)
    const adminPage = await adminContext.newPage()
    const adminVideo = adminPage.video()

    const holderContext = await browser.newContext({ viewport: { width: 1600, height: 900 } })
    await holderContext.addInitScript((address) => {
      window.localStorage.setItem('e2e-wallet-profile', 'holder')
      window.localStorage.setItem('wallet:pubkey', address)
    }, governance.forVoterAddress)
    const holderPage = await holderContext.newPage()

    try {
      await installDemoOverlay(adminPage)
      await adminPage.goto(`${baseUrl}/governance`, { waitUntil: 'networkidle' })
      await adminPage.evaluate((label) => window.__demoSetWallet?.(label), `Wallet connected: ${shortAddress(governance.proposerAddress)}`)
      await holderPage.goto(`${baseUrl}/governance`, { waitUntil: 'networkidle' })
      await connectWalletIfNeeded(adminPage)
      await connectWalletIfNeeded(holderPage)
      await adminPage.getByTestId('governance-wallet').waitFor({ timeout: 30_000 })
      await holderPage.getByTestId('governance-wallet').waitFor({ timeout: 30_000 })

      await revealLocator(adminPage, adminPage.getByTestId('governance-proposal-kind-select'))
      await adminPage.getByTestId('governance-proposal-kind-select').selectOption('Council')
      await adminPage.getByTestId('governance-new-council-input').fill(governance.proposerAddress)
      await clickVisible(adminPage, adminPage.getByTestId('governance-propose-button'))
      await waitForContains(adminPage.getByTestId('governance-status'), /success:/i, 120_000)

      const proposalId = (await adminPage.getByTestId('governance-proposal-id-input').inputValue()).trim()
      await holderPage.evaluate((label) => window.__demoSetWallet?.(label), `Wallet connected: ${shortAddress(governance.forVoterAddress)}`).catch(() => {})
      await holderPage.getByTestId('governance-proposal-id-input').fill(proposalId)
      await holderPage.getByTestId('governance-support-select').selectOption('1')
      await holderPage.getByTestId('governance-vote-button').click()
      await waitForContains(holderPage.getByTestId('governance-status'), /success:/i, 120_000)

      await adminPage.evaluate((label) => window.__demoSetWallet?.(label), `Wallet connected: ${shortAddress(governance.proposerAddress)}`)
      await adminPage.getByTestId('governance-proposal-id-input').fill(proposalId)
      await adminPage.getByTestId('governance-support-select').selectOption('2')
      await clickVisible(adminPage, adminPage.getByTestId('governance-vote-button'))
      await waitForContains(adminPage.getByTestId('governance-status'), /success:/i, 120_000)
      await clickVisible(adminPage, adminPage.getByTestId('governance-refresh-button'))
      await waitForContains(adminPage.getByTestId('governance-tally-for'), /1/, 30_000)
      await waitForContains(adminPage.getByTestId('governance-tally-abstain'), /1/, 30_000)
      await adminPage.waitForTimeout(2500)
    } finally {
      await holderContext.close()
      await adminPage.close()
      const generatedPath = await adminVideo.path()
      execFileSync('cp', [generatedPath, rawPath])
      await adminContext.close()
      await browser.close()
    }

    execFileSync('ffmpeg', [
      '-y',
      '-i', rawPath,
      '-vf', 'crop=1092:614:0:0,scale=1600:900',
      '-c:v', 'libx264',
      '-pix_fmt', 'yuv420p',
      '-movflags', '+faststart',
      '-c:a', 'aac',
      mp4Path,
    ], { stdio: 'inherit' })

    console.log(`Governance clip written to ${mp4Path}`)
  } finally {
    cleanup()
  }
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
