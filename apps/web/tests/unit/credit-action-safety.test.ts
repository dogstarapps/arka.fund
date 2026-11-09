import { describe, expect, it } from 'vitest'
import { hasVerifiedDebtFreeCreditMarket, isCreditActionRiskBlocked } from '@/lib/workflows/creditActionSafety'
import type { ArkaCreditMarketStatus, ArkaCreditPositionValue } from '@/lib/soroban'

const status = { debt_value: 0, risky_actions_blocked: true, nav_blocked: false, pool_status: 3 } as ArkaCreditMarketStatus
const position = { debt_amount: 0, debt_shares: 0 } as ArkaCreditPositionValue

describe('Blend action-specific risk gate', () => {
  it('permits review of an On-Ice debt-free exit, not new borrowing', () => {
    expect(isCreditActionRiskBlocked('Withdraw', status, [position])).toBe(false)
    expect(isCreditActionRiskBlocked('Borrow', status, [position])).toBe(true)
  })
  it('does not propagate borrowing restrictions into supply or repayment', () => {
    expect(isCreditActionRiskBlocked('Supply', status, [position])).toBe(false)
    expect(isCreditActionRiskBlocked('Repay', status, [position])).toBe(false)
  })
  it('requires zero debt across all assets, including debt rounded out of market value', () => {
    expect(isCreditActionRiskBlocked('Withdraw', status, [position, { ...position, debt_amount: 1 }])).toBe(true)
    expect(isCreditActionRiskBlocked('Withdraw', { ...status, debt_value: 1 }, [position])).toBe(true)
    expect(isCreditActionRiskBlocked('Withdraw', status, [{ ...position, debt_shares: 1 }])).toBe(true)
  })
  it.each([NaN, -1, undefined, Number.MAX_SAFE_INTEGER + 1])('unknown/unsafe per-asset debt is not zero: %s', debt => {
    expect(hasVerifiedDebtFreeCreditMarket(status, [{ ...position, debt_amount: debt as number }])).toBe(false)
  })
  it('accepts an actually empty position only alongside explicit market-wide zero debt', () => {
    expect(hasVerifiedDebtFreeCreditMarket(status, [])).toBe(true)
    expect(hasVerifiedDebtFreeCreditMarket(null, [])).toBe(false)
    expect(hasVerifiedDebtFreeCreditMarket({ ...status, debt_value: NaN }, [])).toBe(false)
  })
  it('does not allow missing status or frozen/invalid NAV even for debt-free exits', () => {
    expect(isCreditActionRiskBlocked('Withdraw', null, [])).toBe(true)
    expect(isCreditActionRiskBlocked('Withdraw', { ...status, nav_blocked: true, pool_status: 4 }, [])).toBe(true)
  })
  it('keeps ordinary healthy borrowing and debt-bearing exits subject to the contract simulation', () => {
    expect(isCreditActionRiskBlocked('Borrow', { ...status, risky_actions_blocked: false }, [position])).toBe(false)
    expect(isCreditActionRiskBlocked('Withdraw', { ...status, risky_actions_blocked: false, debt_value: 10 }, [{ ...position, debt_amount: 10 }])).toBe(false)
  })
})
