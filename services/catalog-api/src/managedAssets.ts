/** Keep physical cash visible, but remove fixed withdrawal reserves from NAV. */
export function managedLiquid(asset: {liquidBalance: string; reservedWithdrawalBalance?: string}): string {
  if(asset.reservedWithdrawalBalance===undefined)return asset.liquidBalance;
  const available=BigInt(asset.liquidBalance)-BigInt(asset.reservedWithdrawalBalance);
  if(available<0n)throw new Error("MANAGED_CASH_RECONCILIATION");return available.toString();
}
