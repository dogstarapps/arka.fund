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
const port = 3018
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

async function showSceneBanner(page, title, subtitle = '', durationMs = 1800) {
  await page.evaluate(([sceneTitle, sceneSubtitle]) => {
    const previous = document.getElementById('__demo_scene_banner__')
    previous?.remove()
    const root = document.createElement('div')
    root.id = '__demo_scene_banner__'
    root.style.position = 'fixed'
    root.style.top = '20px'
    root.style.right = '20px'
    root.style.zIndex = '999999'
    root.style.maxWidth = '420px'
    root.style.padding = '14px 18px'
    root.style.borderRadius = '16px'
    root.style.background = 'rgba(15,23,42,0.90)'
    root.style.color = '#f8fafc'
    root.style.fontFamily = 'ui-sans-serif, system-ui, sans-serif'
    root.style.boxShadow = '0 18px 50px rgba(0,0,0,0.35)'
    root.style.border = '1px solid rgba(255,255,255,0.12)'
    root.innerHTML = `<div style="font-size:18px;font-weight:700;margin-bottom:4px;">${sceneTitle}</div><div style="font-size:13px;line-height:1.4;color:rgba(248,250,252,0.82);">${sceneSubtitle}</div>`
    document.body.appendChild(root)
  }, [title, subtitle])
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

async function main() {
  const rebalanceValidation = readJson(rebalanceValidationPath)
  const holderAddress = stellarOutput(['keys', 'address', 'arka-holder'])
  const rawPath = resolve(rawDir, '01-arkas-index.webm')
  const mp4Path = resolve(clipsDir, '01-arkas-index.mp4')

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
      await page.addInitScript((address) => {
        window.localStorage.setItem('e2e-wallet-profile', 'holder')
        window.localStorage.setItem('wallet:pubkey', address)
      }, holderAddress)

      await showLoadingCard(page, 'Browsing Available Arkas', 'Users can select an existing managed vault from the registry.')
      await page.goto(`${baseUrl}/arkas`, { waitUntil: 'networkidle' })
      await page.evaluate((label) => window.__demoSetWallet?.(label), `Wallet connected: ${shortAddress(holderAddress)}`)
      await showSceneBanner(page, 'Available Arkas', 'The registry page lists live vaults and lets a depositor open any Arka directly.')
      const registryPanel = page.getByText('Registry').locator('..')
      await revealLocator(page, registryPanel)
      const firstOpen = registryPanel.locator('a', { hasText: 'Open' }).first()
      await moveMouseToLocator(page, firstOpen)
      await page.waitForTimeout(1600)
      await clickVisible(page, firstOpen)
      await page.waitForLoadState('networkidle')
      await page.waitForTimeout(1800)
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

    console.log(`Arkas index clip written to ${mp4Path}`)
  } finally {
    cleanup()
  }
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
