/** Convert an exact on-chain integer amount into a decimal display string. */
export function formatAssetAmount(
  amount: bigint | number | string,
  decimals: number,
  options: { trimTrailingZeros?: boolean } = {},
): string {
  if (!Number.isInteger(decimals) || decimals < 0 || decimals > 18) {
    throw new Error("decimals must be an integer between 0 and 18");
  }
  const value = BigInt(amount);
  const negative = value < 0n;
  const absolute = negative ? -value : value;
  if (decimals === 0) return `${negative ? "-" : ""}${absolute}`;

  const scale = 10n ** BigInt(decimals);
  const whole = absolute / scale;
  let fraction = (absolute % scale).toString().padStart(decimals, "0");
  if (options.trimTrailingZeros ?? true) {
    fraction = fraction.replace(/0+$/, "");
  }
  return `${negative ? "-" : ""}${whole}${fraction ? `.${fraction}` : ""}`;
}

/** Convert contract basis points into a human-readable percentage string. */
export function formatBasisPoints(bps: number, fractionDigits = 2): string {
  if (!Number.isFinite(bps) || !Number.isInteger(bps)) {
    throw new Error("bps must be a finite integer");
  }
  if (!Number.isInteger(fractionDigits) || fractionDigits < 0 || fractionDigits > 4) {
    throw new Error("fractionDigits must be an integer between 0 and 4");
  }
  return `${(bps / 100).toFixed(fractionDigits)}%`;
}
