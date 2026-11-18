import type {
  ArkaCreditMarketStatus,
  ArkaCreditPositionValue,
  CreditPositionAction,
} from '@/lib/soroban'

// This is a UI gate, not a substitute for a fresh contract simulation. In
// particular, withdrawing debt-free collateral is not new borrowing. Require
// both market-wide and per-asset evidence; a rounded/unknown debt is not zero.
export function hasVerifiedDebtFreeCreditMarket(
  status: ArkaCreditMarketStatus | null,
  positions: ArkaCreditPositionValue[],
): boolean {
  return status?.debt_value === 0 && positions.every(
    (position) => position.debt_amount === 0 && position.debt_shares === 0,
  )
}

export function isCreditActionRiskBlocked(
  action: CreditPositionAction,
  status: ArkaCreditMarketStatus | null,
  positions: ArkaCreditPositionValue[],
): boolean {
  if (action !== 'Borrow' && action !== 'Withdraw') return false
  if (!status) return true
  // Frozen/invalid valuation must not be described as a usable debt-free exit.
  if (action === 'Withdraw' && status.nav_blocked !== false) return true
  if (!status.risky_actions_blocked) return false
  return action === 'Borrow' || !hasVerifiedDebtFreeCreditMarket(status, positions)
}
