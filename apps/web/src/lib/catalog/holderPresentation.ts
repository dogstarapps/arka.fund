function decimalScale(exponent: number): bigint {
  let result = BigInt(1);
  for (let index = 0; index < exponent; index += 1) result *= BigInt(10);
  return result;
}

function formatExactBaseUnitAmount(
  value: bigint,
  decimals: number,
  fractionDigits: number,
): string {
  const safeDecimals = Math.max(0, Math.min(18, Math.trunc(decimals)));
  const safeFractionDigits = Math.max(0, Math.min(safeDecimals, Math.trunc(fractionDigits)));
  const inputScale = decimalScale(safeDecimals);
  const outputScale = decimalScale(safeFractionDigits);
  const negative = value < BigInt(0);
  const absolute = negative ? -value : value;
  const rounded = (absolute * outputScale + inputScale / BigInt(2)) / inputScale;
  const whole = rounded / outputScale;
  const fraction = safeFractionDigits > 0
    ? (rounded % outputScale).toString().padStart(safeFractionDigits, "0").replace(/0+$/, "")
    : "";
  return `${negative ? "-" : ""}${whole.toLocaleString("en-US")}${fraction ? `.${fraction}` : ""}`;
}

function calculateProRataValue(
  totalValue: string | null | undefined,
  holderShares: string,
  totalShares: string,
): bigint | null {
  try {
    if (totalValue === null || totalValue === undefined) return null;
    const total = BigInt(totalValue);
    const shares = BigInt(holderShares);
    const supply = BigInt(totalShares);
    if (total < BigInt(0) || shares < BigInt(0) || supply <= BigInt(0)) return null;
    return (total * shares) / supply;
  } catch {
    return null;
  }
}

export function formatHolderPositionValue(input: {
  holderShares: string;
  totalShares: string;
  navDenomination: string | null | undefined;
  denominationSymbol: string | null | undefined;
  denominationDecimals: number | null | undefined;
  navUsdEstimate: string | null | undefined;
}): { primary: string; secondary: string } {
  const denominationValue = calculateProRataValue(
    input.navDenomination,
    input.holderShares,
    input.totalShares,
  );
  const usdValue = calculateProRataValue(
    input.navUsdEstimate,
    input.holderShares,
    input.totalShares,
  );
  const denominationDecimals = input.denominationDecimals ?? 7;
  const denominationLabel = denominationValue !== null && input.denominationSymbol
    ? `${formatExactBaseUnitAmount(denominationValue, denominationDecimals, Math.min(4, denominationDecimals))} ${input.denominationSymbol}`
    : "";
  if (usdValue !== null) {
    return {
      primary: `$${formatExactBaseUnitAmount(usdValue, 7, 2)}`,
      secondary: denominationLabel,
    };
  }
  if (denominationLabel) return { primary: denominationLabel, secondary: "" };
  return { primary: "Value unavailable", secondary: "" };
}

export function formatInvestorCountLabel(
  total: number,
  complete: boolean,
): string {
  const safeTotal = Math.max(0, Math.trunc(total));
  const noun = safeTotal === 1 ? "investor" : "investors";
  return complete ? `${safeTotal} ${noun}` : `${safeTotal}+ ${noun}`;
}
