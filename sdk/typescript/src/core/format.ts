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

/** Convert a human-readable decimal amount into an exact on-chain integer. */
export function parseAssetAmount(amount: string, decimals: number): bigint {
  if (!Number.isInteger(decimals) || decimals < 0 || decimals > 18) {
    throw new Error("decimals must be an integer between 0 and 18");
  }
  const normalized = amount.trim();
  const match = /^(-?)(\d+)(?:\.(\d+))?$/.exec(normalized);
  if (!match) {
    throw new Error("amount must be a decimal string without separators or exponent notation");
  }
  const fraction = match[3] ?? "";
  if (fraction.length > decimals) {
    throw new Error(`amount has more than ${decimals} decimal places`);
  }
  const scale = 10n ** BigInt(decimals);
  const units = BigInt(match[2]) * scale + BigInt(fraction.padEnd(decimals, "0") || "0");
  return match[1] === "-" ? -units : units;
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
