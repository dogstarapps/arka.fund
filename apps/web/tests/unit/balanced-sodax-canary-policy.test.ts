import { describe, expect, it } from "vitest";
import { evaluateBalancedSodaxCanaryPolicy } from "@/lib/workflows/balancedSodaxCanaryPolicy";

const MAINNET_USDC_CONTRACT =
  "CCW67TSZV3SSS2HXMBQ5JFGCKJNXKZM7UQUWUZPUTHXSTZLEO7SJMI75";
const MAINNET_XLM_CONTRACT =
  "CAS3J7GYLGXMF6TDJBBYYSE3HQ6BBSMLNUQ34T6TZMYMW2EVH34XOWMA";

describe("Balanced/SODAX canary AUTO policy", () => {
  it("admits the mainnet USDC to XLM canary route at the proven floor", () => {
    expect(
      evaluateBalancedSodaxCanaryPolicy({
        tokenIn: MAINNET_USDC_CONTRACT,
        tokenOut: MAINNET_XLM_CONTRACT,
        amountBase: 2_000_000,
      }),
    ).toMatchObject({
      status: "passed",
      code: "canary_passed",
      autoEligible: true,
      assetIn: "USDC",
      assetOut: "XLM",
      policy: {
        minAmountBase: 2_000_000,
        recommendedMinOutBps: 9_000,
      },
    });
  });

  it("keeps XLM to USDC out of AUTO below the solved canary floor", () => {
    expect(
      evaluateBalancedSodaxCanaryPolicy({
        tokenIn: MAINNET_XLM_CONTRACT,
        tokenOut: MAINNET_USDC_CONTRACT,
        amountBase: 1_000_000,
      }),
    ).toMatchObject({
      status: "blocked",
      code: "amount_below_canary_floor",
      autoEligible: false,
      policy: {
        minAmountBase: 50_000_000,
        recommendedMinOutBps: 8_000,
      },
    });
  });

  it("blocks unknown pairs until a mainnet canary proves them", () => {
    expect(
      evaluateBalancedSodaxCanaryPolicy({
        tokenIn: "CAAA",
        tokenOut: "CBBB",
        amountBase: 10_000_000,
      }),
    ).toMatchObject({
      status: "blocked",
      code: "unsupported_pair",
      autoEligible: false,
      assetIn: "unknown",
      assetOut: "unknown",
      policy: null,
    });
  });
});
