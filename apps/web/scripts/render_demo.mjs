import { existsSync, mkdirSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { execFileSync } from 'node:child_process'

const dappRoot = resolve(new URL('..', import.meta.url).pathname)
const workspaceRoot = resolve(dappRoot, '..')
const arkafundRoot = resolve(workspaceRoot, 'arkafund')
const videoDir = resolve(arkafundRoot, 'tmp', 'demo-video')
const clipsDir = resolve(videoDir, 'clips')
const compositeDir = resolve(videoDir, 'composite')
const concatListPath = resolve(compositeDir, 'concat.txt')
const outputPath = resolve(videoDir, 'arka-dapp-product-tour.mp4')
const platformTourPath = resolve(videoDir, 'platform-tour-full.mp4')
const outputTestDir = resolve(dappRoot, 'test-results', 'demo')

const liveClips = [
  { name: '02-create', grep: 'creates a live Arka through the browser wallet and opens its detail page' },
  { name: '03-deposit-redeem', grep: 'deposits into and redeems from a live Arka through the browser wallet' },
  { name: '04-soroswap', grep: 'runs a live SoroSwap rebalance from the browser wallet' },
  { name: '05-aquarius', grep: 'runs a live Aquarius rebalance from the browser wallet' },
  { name: '06-blend-credit', grep: 'runs live Blend supply and borrow actions from the browser wallet' },
  { name: '07-coverage-claim', grep: 'connects the test wallet and submits a real claim transaction' },
  { name: '08-coverage-stake', grep: 'stakes and unstakes a small real amount through the browser wallet' },
  {
    name: '09-governance',
    grep: 'runs a live governance propose-and-vote flow from the browser with two wallets',
    fallbackCandidates: [
      resolve(clipsDir, '09-governance.mp4'),
      resolve(videoDir, 'final-v3', '09-governance-wallet.mp4'),
      resolve(videoDir, 'edited-v2', '09-governance.mp4'),
      resolve(videoDir, 'final-v3', '09-governance-live.mp4'),
    ],
  },
]

function latestVideoPath() {
  const matches = []
  const queue = [outputTestDir]
  while (queue.length) {
    const current = queue.pop()
    for (const entry of readdirSync(current, { withFileTypes: true })) {
      const fullPath = join(current, entry.name)
      if (entry.isDirectory()) {
        queue.push(fullPath)
      } else if (entry.isFile() && entry.name === 'video.webm') {
        matches.push(fullPath)
      }
    }
  }
  if (!matches.length) {
    throw new Error(`No Playwright video found in ${outputTestDir}`)
  }
  matches.sort((a, b) => {
    const aStat = Number(execFileSync('stat', ['-f', '%m', a], { encoding: 'utf8' }).trim())
    const bStat = Number(execFileSync('stat', ['-f', '%m', b], { encoding: 'utf8' }).trim())
    return bStat - aStat
  })
  return matches[0]
}

function logStep(message) {
  console.log(`[demo-render] ${message}`)
}

function renderTitleCard(filename, title, subtitle, seconds) {
  mkdirSync(compositeDir, { recursive: true })
  const target = resolve(compositeDir, filename)
  execFileSync('ffmpeg', [
    '-y',
    '-f', 'lavfi',
    '-i', `color=c=0x14091f:s=1600x900:d=${seconds}`,
    '-vf',
    [
      "drawbox=x=80:y=80:w=1440:h=740:color=0x2a0f40@0.88:t=fill",
      "drawbox=x=80:y=80:w=1440:h=740:color=0x39ff88@0.95:t=8",
      `drawtext=fontfile=/System/Library/Fonts/Supplemental/Arial Bold.ttf:text='${title.replaceAll(':', '\\:').replaceAll("'", "\\'")}':fontcolor=0x39ff88:fontsize=56:x=(w-text_w)/2:y=(h/2)-92`,
      `drawtext=fontfile=/System/Library/Fonts/Supplemental/Arial.ttf:text='${subtitle.replaceAll(':', '\\:').replaceAll("'", "\\'")}':fontcolor=white:fontsize=26:x=(w-text_w)/2:y=(h/2)+10`,
      "drawtext=fontfile=/System/Library/Fonts/Supplemental/Arial.ttf:text='arka.fund':fontcolor=0xff4fd8:fontsize=18:x=(w-text_w)/2:y=h-118",
    ].join(','),
    '-c:v', 'libx264',
    '-pix_fmt', 'yuv420p',
    '-movflags', '+faststart',
    '-an',
    target,
  ], { stdio: 'inherit' })
  return target
}

function convertToMp4(sourcePath, targetPath) {
  execFileSync('ffmpeg', [
    '-y',
    '-i', sourcePath,
    '-c:v', 'libx264',
    '-pix_fmt', 'yuv420p',
    '-movflags', '+faststart',
    '-c:a', 'aac',
    targetPath,
  ], { stdio: 'inherit' })
  return targetPath
}

function runClip(clip) {
  rmSync(outputTestDir, { recursive: true, force: true })
  execFileSync('npx', [
    'playwright',
    'test',
    '--config=playwright.demo.config.ts',
    '--grep',
    clip.grep,
  ], {
    cwd: dappRoot,
    stdio: 'inherit',
    env: process.env,
  })
  const videoPath = latestVideoPath()
  const rawTarget = resolve(clipsDir, `${clip.name}.webm`)
  const mp4Target = resolve(clipsDir, `${clip.name}.mp4`)
  execFileSync('cp', [videoPath, rawTarget])
  return convertToMp4(rawTarget, mp4Target)
}

function firstExisting(paths) {
  for (const path of paths) {
    if (existsSync(path)) return path
  }
  return null
}

function ensurePlatformTour() {
  mkdirSync(videoDir, { recursive: true })
  if (existsSync(platformTourPath) && process.env.DEMO_REFRESH_PLATFORM !== '1') {
    logStep('using existing stable platform tour')
    return platformTourPath
  }
  logStep('recording stable platform tour')
  execFileSync('node', ['./scripts/record_demo.mjs'], {
    cwd: dappRoot,
    stdio: 'inherit',
    env: {
      ...process.env,
      DEMO_TOUR_ONLY: '1',
      DEMO_OUTPUT_STEM: 'platform-tour-full',
    },
  })
  if (!existsSync(platformTourPath)) {
    throw new Error(`Platform tour was not created at ${platformTourPath}`)
  }
  return platformTourPath
}

function ensureLiveClip(clip) {
  mkdirSync(clipsDir, { recursive: true })
  const primaryPath = resolve(clipsDir, `${clip.name}.mp4`)
  const fallbackPath = firstExisting(clip.fallbackCandidates ?? [])
  if (process.env.DEMO_REFRESH_LIVE_CLIPS === '1') {
    logStep(`refreshing clip ${clip.name}`)
    return runClip(clip)
  }
  if (existsSync(primaryPath)) {
    return primaryPath
  }
  if (fallbackPath) {
    logStep(`using archived clip for ${clip.name}`)
    return fallbackPath
  }
  logStep(`recording missing clip ${clip.name}`)
  return runClip(clip)
}

function main() {
  mkdirSync(videoDir, { recursive: true })
  mkdirSync(compositeDir, { recursive: true })
  rmSync(outputPath, { force: true })
  rmSync(concatListPath, { force: true })

  const orderedSegments = []
  orderedSegments.push(renderTitleCard(
    '00-intro.mp4',
    'Arka.fund Product Tour',
    'Discover, create and operate managed on-chain portfolios on Stellar.',
    3,
  ))
  orderedSegments.push(ensurePlatformTour())
  orderedSegments.push(renderTitleCard(
    '01-live-title.mp4',
    'Wallet-Signed Actions',
    'Creation, capital movement, protocol routing, credit and governance.',
    3,
  ))

  for (const clip of liveClips) {
    orderedSegments.push(ensureLiveClip(clip))
  }

  orderedSegments.push(renderTitleCard(
    '10-outro.mp4',
    'Explore Arka.fund',
    'Public discovery and wallet-signed portfolio management from one application.',
    3,
  ))

  writeFileSync(
    concatListPath,
    orderedSegments.map((clipPath) => `file '${clipPath.replaceAll("'", "'\\''")}'`).join('\n'),
  )

  execFileSync('ffmpeg', [
    '-y',
    '-f', 'concat',
    '-safe', '0',
    '-i', concatListPath,
    '-c:v', 'libx264',
    '-pix_fmt', 'yuv420p',
    '-movflags', '+faststart',
    '-c:a', 'aac',
    outputPath,
  ], { stdio: 'inherit' })

  const duration = execFileSync('ffprobe', [
    '-v', 'error',
    '-show_entries', 'format=duration',
    '-of', 'default=nokey=1:noprint_wrappers=1',
    outputPath,
  ], { encoding: 'utf8' }).trim()
  console.log(`Product tour written to ${outputPath} (${duration}s)`)
}

main()
