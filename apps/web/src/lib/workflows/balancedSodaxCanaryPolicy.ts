const PUBLIC_USDC_CONTRACT =
  "CCW67TSZV3SSS2HXMBQ5JFGCKJNXKZM7UQUWUZPUTHXSTZLEO7SJMI75";
const PUBLIC_XLM_CONTRACT =
  "CAS3J7GYLGXMF6TDJBBYYSE3HQ6BBSMLNUQ34T6TZMYMW2EVH34XOWMA";

export type BalancedSodaxCanaryAsset = "USDC" | "XLM" | "unknown";

export type BalancedSodaxCanaryPolicy = {
  id: string;
  from: Exclude<BalancedSodaxCanaryAsset, "unknown">;
  to: Exclude<BalancedSodaxCanaryAsset, "unknown">;
  minAmountBase: number;
  recommendedMinOutBps: number;
  evidenceLabel: string;
};

export type BalancedSodaxCanaryPolicyEvaluation = {
  status: "passed" | "blocked";
  code:
    | "canary_passed"
    | "unsupported_pair"
    | "amount_below_canary_floor";
  autoEligible: boolean;
  assetIn: BalancedSodaxCanaryAsset;
  assetOut: BalancedSodaxCanaryAsset;
  policy: BalancedSodaxCanaryPolicy | null;
  detail: string;
};

const CANARY_POLICIES: BalancedSodaxCanaryPolicy[] = [
  {
    id: "balanced-sodax-usdc-xlm-mainnet-canary",
    from: "USDC",
    to: "XLM",
    minAmountBase: 2_000_000,
    recommendedMinOutBps: 9_000,
    evidenceLabel: "0.2 USDC -> XLM solved on mainnet canary",
  },
  {
    id: "balanced-sodax-xlm-usdc-mainnet-canary",
    from: "XLM",
    to: "USDC",
    minAmountBase: 50_000_000,
    recommendedMinOutBps: 8_000,
    evidenceLabel: "5 XLM -> USDC solved on mainnet canary",
  },
];

function normalizeContract(value: string): string {
  return value.trim().toUpperCase();
}

function classifyBalancedSodaxCanaryAsset(value: string): BalancedSodaxCanaryAsset {
  const normalized = normalizeContract(value);
  if (!normalized) return "unknown";
  if (normalized === PUBLIC_USDC_CONTRACT || normalized === "USDC") return "USDC";
  if (normalized === PUBLIC_XLM_CONTRACT || normalized === "XLM") return "XLM";
  return "unknown";
}

export function evaluateBalancedSodaxCanaryPolicy(input: {
  tokenIn: string;
  tokenOut: string;
  amountBase: number;
}): BalancedSodaxCanaryPolicyEvaluation {
  const assetIn = classifyBalancedSodaxCanaryAsset(input.tokenIn);
  const assetOut = classifyBalancedSodaxCanaryAsset(input.tokenOut);
  const policy =
    CANARY_POLICIES.find(
      (candidate) => candidate.from === assetIn && candidate.to === assetOut,
    ) ?? null;

  if (!policy) {
    return {
      status: "blocked",
      code: "unsupported_pair",
      autoEligible: false,
      assetIn,
      assetOut,
      policy: null,
      detail:
        assetIn === "unknown" || assetOut === "unknown"
          ? "Balanced/SODAX is available directly, but this AUTO pair has not been identified as a canary-green USDC/XLM route."
          : `Balanced/SODAX AUTO is not enabled for ${assetIn} -> ${assetOut} until a mainnet canary proves the route.`,
    };
  }

  if (input.amountBase < policy.minAmountBase) {
    return {
      status: "blocked",
      code: "amount_below_canary_floor",
      autoEligible: false,
      assetIn,
      assetOut,
      policy,
      detail: `Balanced/SODAX AUTO for ${policy.from} -> ${policy.to} starts at the current canary minimum. Smaller trades stay direct-only until more live evidence is available.`,
    };
  }

  return {
    status: "passed",
    code: "canary_passed",
    autoEligible: true,
    assetIn,
    assetOut,
    policy,
    detail: `Balanced/SODAX AUTO is canary-green for ${policy.from} -> ${policy.to}. ${policy.evidenceLabel}.`,
  };
}
