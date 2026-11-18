import { afterEach, describe, expect, it, vi } from 'vitest'

describe('coverage network isolation', () => {
  afterEach(() => { vi.unstubAllEnvs(); vi.resetModules() })
  it('does not use testnet manager vault or reserve token fallbacks on mainnet', async () => {
    vi.stubEnv('NEXT_PUBLIC_STELLAR_NETWORK', 'Public Global Stellar Network ; September 2015')
    vi.stubEnv('NEXT_PUBLIC_COVERAGE_VAULT', undefined)
    vi.stubEnv('NEXT_PUBLIC_COVERAGE_TOKEN', undefined)
    const config = await import('@/lib/config')
    expect(config.COVERAGE_VAULT).toBe('')
    expect(config.COVERAGE_TOKEN).toBe('')
  })
  it('preserves explicit mainnet configuration', async () => {
    vi.stubEnv('NEXT_PUBLIC_STELLAR_NETWORK', 'Public Global Stellar Network ; September 2015')
    vi.stubEnv('NEXT_PUBLIC_COVERAGE_VAULT', 'EXPLICIT_MANAGER_VAULT')
    vi.stubEnv('NEXT_PUBLIC_COVERAGE_TOKEN', 'EXPLICIT_RESERVE_TOKEN')
    const config = await import('@/lib/config')
    expect(config.COVERAGE_VAULT).toBe('EXPLICIT_MANAGER_VAULT')
    expect(config.COVERAGE_TOKEN).toBe('EXPLICIT_RESERVE_TOKEN')
  })
})
