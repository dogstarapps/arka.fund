/** Integer-only amounts. Never pass financial values through JavaScript Number. */
export const RAW_SCALE = BigInt(10_000_000);
const MAX_I128 = (BigInt(1) << BigInt(127)) - BigInt(1);
export function parseUnits(text: string): bigint {
  if (!/^(0|[1-9]\d*)(\.\d{1,7})?$/.test(text)) throw new Error('Use a positive amount with at most 7 decimals.');
  const [whole, fraction = ''] = text.split('.');
  const n = BigInt(whole) * RAW_SCALE + BigInt(fraction.padEnd(7, '0'));
  if (n <= BigInt(0) || n > MAX_I128) throw new Error('Amount is outside the supported range.');
  return n;
}
export function formatUnits(raw: string | bigint, decimals = 2): string {
  const n = BigInt(raw); const whole = n / RAW_SCALE;
  const fraction = (n % RAW_SCALE).toString().padStart(7, '0').slice(0, decimals);
  return whole.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',') + (decimals ? `.${fraction}` : '');
}
export function sharesForAssets(assets: bigint, nav: string, total: string): bigint {
  const n = BigInt(nav), t = BigInt(total);
  if (n <= BigInt(0) || t <= BigInt(0)) throw new Error('A valid fund valuation is required.');
  // Round shares up: the displayed asset amount is an estimate, not a fixed payout.
  const shares = (assets * t + n - BigInt(1)) / n;
  if (shares <= BigInt(0) || shares > MAX_I128) throw new Error('Share amount is outside the supported range.');
  return shares;
}
export type WithdrawalRow = {
  id: number; actor: string; requestedShares: string; pendingShares: string;
  settledShares: string; cancelledShares: string; claimableAssets: string; claimedAssets: string;
  createdAt: number; eligibleAt: number; lastSettledAt: number;
};
export type ManagedState = {
  engineId?: string; revision?: number; fund?: string; factory?: string; token?: string; router?: string;
  factoryTemplateHash?: string;
  wallets?: Record<ManagedActor,string>; funds?: {index:number;address:string;label:string}[];
  headEligibleAt?: number; headPendingShares?: string;
  engine: string; authorization: string; network: string; clock: number; decimals: number; currency: string;
  policy: { epochSeconds: number; managerWindow: number; bufferBps: number; minRequestShares: string; exitFeeBps: number };
  nav: string; totalShares: string; cash: string; settleCapacity: string; reserved: string;
  pendingShares: string; pendingCount: number; head: number; nextId: number;
  recoveryNeeded: string; recoveryAvailable: string; recoveryPublicAt: number; poolCash: string;
  accounts: { id: string; label: string; freeShares: string; walletCash: string }[];
  requests: WithdrawalRow[];
};
export function requestLabel(r: WithdrawalRow): string {
  if (BigInt(r.pendingShares) > BigInt(0)) return BigInt(r.claimableAssets) > BigInt(0) || BigInt(r.claimedAssets) > BigInt(0) ? 'Partially settled' : 'Waiting for settlement';
  if (BigInt(r.claimableAssets) > BigInt(0)) return 'Ready to claim';
  if (BigInt(r.claimedAssets) > BigInt(0)) return BigInt(r.cancelledShares) > BigInt(0) ? 'Paid · remainder cancelled' : 'Paid';
  return 'Cancelled';
}
export type PreviewAction =
  | { action: 'reset' | 'settle' }
  | { action: 'advance'; seconds: number }
  | { action: 'request'; actor: 'a' | 'b'; sharesRaw: string }
  | { action: 'cancel' | 'claim'; actor: 'a' | 'b'; id: number }
  | { action: 'prepare'; actor: 'manager' | 'executor'; amountRaw: string };
export type ManagedActor='a'|'b'|'manager'|'executor';
export type ManagedWalletAction=
  | Extract<PreviewAction,{action:'request'|'cancel'|'claim'|'prepare'}>
  | {action:'instant';actor:'a'|'b';sharesRaw:string}
  | {action:'approve';actor:'a';asset:string;amountRaw:string}
  | {action:'deposit';actor:'a';asset:string;amountRaw:string;minSharesRaw:string}
  | {action:'portfolio-swap';actor:'manager';step:import('./managedWithdrawalOperations').ManagedSpotStep}
  | {action:'recover-spot';actor:'manager'|'executor';step:import('./managedWithdrawalOperations').ManagedSpotStep}
  | {action:'settle';actor:ManagedActor}
  | {action:'create';actor:'manager';draft?:Record<string,unknown>};
