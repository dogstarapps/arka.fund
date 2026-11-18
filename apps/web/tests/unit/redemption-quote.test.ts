import { describe, expect, it } from "vitest";
import {
  estimateMaximumRedemption,
  estimateWithdrawableNow,
  quoteRedemptionByDenominationAmount,
} from "@/lib/workflows/redemptionQuote";

describe("redemption quotes", () => {
  it('caps estimated withdrawals at cash without turning unknown cash into zero',()=>{
    expect(estimateWithdrawableNow(100,70)).toBe(70);
    expect(estimateWithdrawableNow(20,70)).toBe(20);
    expect(estimateWithdrawableNow(100,0)).toBe(0);
    expect(estimateWithdrawableNow(100,null)).toBeNull();
    expect(estimateWithdrawableNow(null,70)).toBeNull();
  });
  it("converts a requested denomination amount into the required shares", () => {
    expect(quoteRedemptionByDenominationAmount({
      requestedNetOutBase: 3_000_000,
      navBase: 233_366_500,
      totalSharesBase: 95_132_400,
      userSharesBase: 4_077_100,
      redeemFeeBps: 0,
    })).toMatchObject({
      estimatedNetOutBase: 3_000_002,
      maximumNetOutBase: 10_001_414,
    });
  });

  it("includes the redemption fee and rejects requests above the position value", () => {
    expect(estimateMaximumRedemption({
      navBase: 100_000_000,
      totalSharesBase: 100_000_000,
      userSharesBase: 10_000_000,
      redeemFeeBps: 100,
    })).toBe(9_900_000);
    expect(quoteRedemptionByDenominationAmount({
      requestedNetOutBase: 10_000_000,
      navBase: 100_000_000,
      totalSharesBase: 100_000_000,
      userSharesBase: 10_000_000,
      redeemFeeBps: 100,
    })).toBeNull();
  });
});
