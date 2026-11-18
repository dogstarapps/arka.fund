import { describe, expect, it } from "vitest";
import {
  formatBaseUnitAmount,
  formatAssetAmount,
  formatBpsAsPercent,
  formatCompactAmount,
  formatContractLabel,
  formatFeeSummary,
  formatHealthLabel,
  formatHumanAssetAmount,
  formatRelativeTime,
  formatSignedBpsAsPercent,
  formatUsdBaseUnitAmount,
  formatWeightLabel,
} from "@/lib/catalog/format";

describe("catalog format helpers", () => {
  it("formats compact amounts and contract labels", () => {
    expect(formatCompactAmount("11050000")).toBe("11.1M");
    expect(formatBaseUnitAmount("1000000000")).toBe("100.0000");
    expect(formatBaseUnitAmount("11050000")).toBe("1.1050");
    expect(formatUsdBaseUnitAmount("11050000")).toBe("$1.11");
    expect(formatUsdBaseUnitAmount("120000000000")).toBe("$12.00K");
    expect(formatContractLabel("CA7ALPHAQFK2MZKJY4R5S8N2P1T6V9W3X7Y2Z5ABCD1EFGH2345678IJ", 8, 6)).toBe(
      "CA7ALPHA...5678IJ",
    );
  });

  it("keeps asset amounts readable without hiding very small balances", () => {
    expect(formatAssetAmount("1993602")).toBe("0.1994");
    expect(formatAssetAmount("998000000")).toBe("99.8");
    expect(formatAssetAmount("1")).toBe("0.0000001");
    expect(formatHumanAssetAmount(0.9946193)).toBe("0.9946");
    expect(formatHumanAssetAmount(0.9697538)).toBe("0.9698");
    expect(formatHumanAssetAmount(0.0000001)).toBe("0.0000001");
  });

  it("keeps leaderboard contract labels deterministic for bounded rows", () => {
    const contract =
      "GCAALPHA7WCIFDLAEDHKSFQRNQLR3SQ6JTIVSMYYFUC5KRTA2KG2QJYDE";

    expect(formatContractLabel(contract, 12, 6)).toBe("GCAALPHA7WCI...2QJYDE");
    expect(formatContractLabel("GC07KAJ7", 12, 6)).toBe("GC07KAJ7");
    expect(formatContractLabel(undefined, 12, 6)).toBe("Unassigned");
  });

  it("formats basis points and fees", () => {
    expect(formatBpsAsPercent(513)).toBe("5.13%");
    expect(formatSignedBpsAsPercent(-42)).toBe("-0.42%");
    expect(formatSignedBpsAsPercent(42)).toBe("+0.42%");
    expect(formatWeightLabel(4389)).toBe("43.9%");
    expect(formatFeeSummary(200, 1200)).toBe("Management 2.00% · Performance 12.00%");
  });

  it("formats relative time and health states", () => {
    const now = new Date("2026-03-27T10:31:00.000Z");
    expect(formatRelativeTime("2026-03-27T10:30:00.000Z", now)).toBe("1 minute ago");
    expect(formatHealthLabel(true, false)).toBe("Healthy");
    expect(formatHealthLabel(true, true)).toBe("Delayed");
    expect(formatHealthLabel(false, false)).toBe("Unavailable");
  });
});
