const BPS_SCALE = BigInt(10_000);

function ceilDiv(value: bigint, divisor: bigint): bigint {
  return (value + divisor - BigInt(1)) / divisor;
}

function toSafeBaseUnits(value: number): bigint | null {
  if (!Number.isSafeInteger(value) || value < 0) return null;
  return BigInt(value);
}

export interface RedemptionQuote {
  sharesToRedeemBase: number;
  estimatedNetOutBase: number;
  maximumNetOutBase: number;
}

// An estimate only. Cash is shared and can change before the simulated transaction.
export function estimateWithdrawableNow(positionValueBase: number | null, fundCashBase: number | null): number | null {
  if (positionValueBase === null || fundCashBase === null || !Number.isSafeInteger(fundCashBase) || fundCashBase < 0) return null;
  return Math.max(0, Math.min(positionValueBase, fundCashBase));
}

export function quoteRedemptionByDenominationAmount(input: {
  requestedNetOutBase: number;
  navBase: number;
  totalSharesBase: number;
  userSharesBase: number;
  redeemFeeBps: number;
}): RedemptionQuote | null {
  const requested = toSafeBaseUnits(input.requestedNetOutBase);
  const nav = toSafeBaseUnits(input.navBase);
  const totalShares = toSafeBaseUnits(input.totalSharesBase);
  const userShares = toSafeBaseUnits(input.userSharesBase);
  const feeBps = Math.max(0, Math.min(9_999, Math.trunc(input.redeemFeeBps)));
  const netFactor = BPS_SCALE - BigInt(feeBps);
  if (!requested || !nav || !totalShares || !userShares) return null;
  if (requested <= BigInt(0) || nav <= BigInt(0) || totalShares <= BigInt(0) || userShares <= BigInt(0)) {
    return null;
  }

  const grossForAll = (userShares * nav) / totalShares;
  const maximumNetOut = (grossForAll * netFactor) / BPS_SCALE;
  if (requested > maximumNetOut) return null;

  const requiredGrossOut = ceilDiv(requested * BPS_SCALE, netFactor);
  const sharesToRedeem = ceilDiv(requiredGrossOut * totalShares, nav);
  if (sharesToRedeem <= BigInt(0) || sharesToRedeem > userShares) return null;

  const grossOut = (sharesToRedeem * nav) / totalShares;
  const estimatedNetOut = (grossOut * netFactor) / BPS_SCALE;
  if (estimatedNetOut < requested) return null;

  return {
    sharesToRedeemBase: Number(sharesToRedeem),
    estimatedNetOutBase: Number(estimatedNetOut),
    maximumNetOutBase: Number(maximumNetOut),
  };
}

export function estimateMaximumRedemption(input: {
  navBase: number;
  totalSharesBase: number;
  userSharesBase: number;
  redeemFeeBps: number;
}): number | null {
  const nav = toSafeBaseUnits(input.navBase);
  const totalShares = toSafeBaseUnits(input.totalSharesBase);
  const userShares = toSafeBaseUnits(input.userSharesBase);
  if (!nav || !totalShares || !userShares || nav <= BigInt(0) || totalShares <= BigInt(0)) return null;
  const feeBps = Math.max(0, Math.min(9_999, Math.trunc(input.redeemFeeBps)));
  const grossOut = (userShares * nav) / totalShares;
  return Number((grossOut * (BPS_SCALE - BigInt(feeBps))) / BPS_SCALE);
}
