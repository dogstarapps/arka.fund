import { expect, test, type Page } from '@playwright/test'

const PUBLIC_ROUTES = [
  { path: '/discover', anchor: 'discover-summary-grid' },
  { path: '/dashboard', anchor: 'dashboard-arkas-panel' },
  { path: '/vaults', anchor: 'vaults-leaderboard-panel' },
  { path: '/arkas', anchor: 'vaults-leaderboard-panel' },
  { path: '/assets', anchor: 'assets-list-panel' },
  { path: '/managers', anchor: 'managers-list-panel' },
] as const

async function expectNoHorizontalOverflow(page: Page): Promise<void> {
  await expect
    .poll(() =>
      page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth + 1,
      ),
    )
    .toBe(true)
}

test.describe('production public release checks', () => {
  test.describe.configure({ mode: 'serial' })
  test.skip(!process.env.PLAYWRIGHT_BASE_URL, 'Production checks require PLAYWRIGHT_BASE_URL.')

  test('serves fresh public NAV while explicitly reporting unavailable valuations', async ({
    request,
  }) => {
    const response = await request.get('/api/nav')
    expect(response.ok()).toBe(true)
    expect(response.headers()['access-control-allow-origin']).toBe('*')

    const payload = (await response.json()) as {
      totalArkas?: number
      curatedArkas?: number
      totalNavUsdEstimate?: string | null
      missingPriceReasons?: string[]
      monitoring?: {
        healthy?: boolean
        degraded?: boolean
        lastRunStatus?: string
      }
    }

    expect(payload.totalArkas).toBeGreaterThanOrEqual(5)
    expect(payload.curatedArkas).toBeGreaterThanOrEqual(5)
    expect(payload.monitoring).toMatchObject({
      healthy: true,
      lastRunStatus: 'success',
    })
    if (payload.monitoring?.degraded) {
      expect(payload.totalNavUsdEstimate).toBeNull()
      expect(payload.missingPriceReasons?.some(reason => reason.includes('nav_unavailable'))).toBe(true)
    }
  })

  for (const viewport of [
    { name: 'desktop', width: 1440, height: 1050 },
    { name: 'mobile', width: 390, height: 900 },
  ] as const) {
    test(`renders every public catalog surface at ${viewport.name}`, async ({ page }) => {
      test.setTimeout(120_000)
      await page.setViewportSize({ width: viewport.width, height: viewport.height })

      for (const route of PUBLIC_ROUTES) {
        await test.step(route.path, async () => {
          const response = await page.goto(route.path, {
            waitUntil: 'domcontentloaded',
            timeout: 45_000,
          })
          expect(response?.ok()).toBe(true)
          await expect(page.getByTestId(route.anchor)).toBeVisible({ timeout: 30_000 })
          await expect(page.getByText(/application error|internal server error/i)).toHaveCount(0)
          await expectNoHorizontalOverflow(page)
        })
      }
    })
  }

  test('exposes the complete Create Arka profile form without a test wallet', async ({
    page,
  }) => {
    const response = await page.goto('/factory/create?step=basics', {
      waitUntil: 'domcontentloaded',
      timeout: 45_000,
    })
    expect(response?.ok()).toBe(true)
    await expect(page.getByTestId('create-profile-panel')).toBeVisible({ timeout: 30_000 })
    await expect(page.getByTestId('create-arka-display-name')).toBeVisible()
    await expect(page.getByTestId('create-arka-description')).toBeVisible()
    await expect(page.getByTestId('create-manager-display-name')).toBeVisible()
    await expect(page.getByTestId('create-manager-description')).toBeVisible()
    await expectNoHorizontalOverflow(page)
  })
})
