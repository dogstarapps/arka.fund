import { describe, expect, it } from "vitest";
import type { CatalogAssetPrice } from "@/lib/catalog/types";
import { isCatalogAssetPriceUsable } from "@/lib/catalog/valuation";

function price(
  overrides: Partial<CatalogAssetPrice> = {},
): CatalogAssetPrice {
  return {
    assetContract: "CASSET",
    priceUsd: "10000000",
    decimals: 7,
    timestamp: "2026-08-28T08:00:00.000Z",
    oracleStatus: "verified",
    valuationSource: "oracle_verified",
    primaryUsable: true,
    secondaryUsable: true,
    unavailableReason: null,
    observedAt: "2026-08-28T08:00:00.000Z",
    ...overrides,
  };
}

describe("catalog valuation availability", () => {
  it("accepts verified prices and USD stablecoin parity", () => {
    expect(isCatalogAssetPriceUsable(price())).toBe(true);
    expect(
      isCatalogAssetPriceUsable(
        price({ oracleStatus: "not_required_usd_stablecoin" }),
      ),
    ).toBe(true);
  });

  it("rejects missing, invalid, paused and zero prices", () => {
    expect(isCatalogAssetPriceUsable(price({ priceUsd: null, oracleStatus: "missing_price" }))).toBe(false);
    expect(isCatalogAssetPriceUsable(price({ oracleStatus: "invalid_price" }))).toBe(false);
    expect(isCatalogAssetPriceUsable(price({ oracleStatus: "policy_paused" }))).toBe(false);
    expect(isCatalogAssetPriceUsable(price({ priceUsd: "0" }))).toBe(false);
  });
});
