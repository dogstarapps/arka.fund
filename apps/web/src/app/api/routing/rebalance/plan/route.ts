import { NextRequest } from "next/server";
import {
  SUSHI_ADAPTER,
  resolveSushiPoolId,
  AQUARIUS_ADAPTER,
  AQUARIUS_ROUTER,
  ROUTING_ASSET_A,
  ROUTING_ASSET_B,
  PHOENIX_ADAPTER,
  PHOENIX_POOL_ROUTING_PAIR,
  PHOENIX_POOL_ID,
  SOROSWAP_ADAPTER,
} from "@/lib/config";
import {
  readSushiEstimateOut,
  readSushiFundBinding,
  readVenueSnapshot,
  readAquariusEstimateOut,
  readAquariusPoolIndex,
  readPhoenixEstimateOut,
  readSoroswapAmountOut,
  readSoroswapAmountOutForPath,
} from "@/lib/soroban";
import { readBalancedProtocolHealth } from "@/lib/runtime/protocolSupport";
import {
  buildBalancedIntentExecutionDriver,
  deriveBalancedRouteLaneFromDriver,
} from "@/lib/workflows/intentExecutionDrivers";
import {
  requestBalancedIntentSurfaceLifecycle,
  requestBalancedIntentSurfaceQuote,
} from "@/lib/server/balancedIntentSurface";
import { deriveBalancedAutoSurfaceReadiness } from "@/lib/runtime/balancedAutoSurfaceGate";
import {
  buildRuntimeRebalanceProtocolPolicies,
  resolveRebalanceRoutePlan,
  type RebalanceGuardrailId,
  type RebalanceProtocol,
  type RebalanceRouteSearchConfig,
} from "@/lib/workflows/rebalanceRouting";
import { evaluateBalancedSodaxCanaryPolicy } from "@/lib/workflows/balancedSodaxCanaryPolicy";
import { jsonNoStore, readJsonObjectBody, redactApiText } from "@/lib/server/apiHardening";

export const dynamic = "force-dynamic";

type RebalancePlanRequestBody = {
  requestedProtocol?: RebalanceProtocol;
  fundId?: string;
  amountBase?: number | string;
  tokenIn?: string;
  tokenOut?: string;
  slippagePct?: number | string;
  manualMinOutBase?: number | string;
  configuredAquariusPoolIndex?: string;
  configuredPhoenixPool?: string;
  routingAssets?: string[];
  routingSearch?: Partial<Record<keyof RebalanceRouteSearchConfig, number | string>>;
  vaultNavBase?: number | string;
  dailyTurnoverUsedBase?: number | string;
  projectedPostTradeDeviationBps?: number | string;
  requiredStatefulGuardrails?: RebalanceGuardrailId[];
  readerPubKey?: string;
  intentTxHash?: string;
};

function toInteger(input: number | string | undefined, fallback = 0): number {
  if (typeof input === "number" && Number.isFinite(input)) {
    return Math.trunc(input);
  }
  if (typeof input === "string" && input.trim().length > 0) {
    const parsed = Number(input.trim());
    if (Number.isFinite(parsed)) {
      return Math.trunc(parsed);
    }
  }
  return fallback;
}

function toOptionalInteger(input: number | string | undefined): number | undefined {
  if (typeof input === "number" && Number.isFinite(input)) {
    return Math.trunc(input);
  }
  if (typeof input === "string" && input.trim().length > 0) {
    const parsed = Number(input.trim());
    if (Number.isFinite(parsed)) {
      return Math.trunc(parsed);
    }
  }
  return undefined;
}

function toNumber(input: number | string | undefined, fallback = 0): number {
  if (typeof input === "number" && Number.isFinite(input)) return input;
  if (typeof input === "string" && input.trim().length > 0) {
    const parsed = Number(input.trim());
    if (Number.isFinite(parsed)) return parsed;
  }
  return fallback;
}

function normalizeRequestedProtocol(value: unknown): RebalanceProtocol {
  if (
    value === "SOROSWAP" ||
    value === "AQUARIUS" ||
    value === "PHOENIX" ||
    value === "SUSHI" ||
    value === "BALANCED"
  ) {
    return value;
  }
  return "AUTO";
}

function parsePositiveBaseUnits(value: string): number {
  if (!/^\d+$/.test(value)) return 0;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 0;
  if (parsed <= 0) return 0;
  if (parsed > Number.MAX_SAFE_INTEGER) return 0;
  return Math.trunc(parsed);
}

function parseRoutingSearchConfig(
  input: RebalancePlanRequestBody["routingSearch"],
): RebalanceRouteSearchConfig | undefined {
  if (!input || typeof input !== "object") return undefined;
  return {
    maxIntermediaries: toOptionalInteger(input.maxIntermediaries),
    maxHops: toOptionalInteger(input.maxHops),
    quoteBudget: toOptionalInteger(input.quoteBudget),
    splitParts: toOptionalInteger(input.splitParts),
    beamWidth: toOptionalInteger(input.beamWidth),
    tailProbeCount: toOptionalInteger(input.tailProbeCount),
  };
}

function parseRequiredStatefulGuardrails(
  input: RebalancePlanRequestBody["requiredStatefulGuardrails"],
): RebalanceGuardrailId[] | undefined {
  if (!Array.isArray(input)) return undefined;
  const supported = new Set<RebalanceGuardrailId>([
    "post_trade_deviation_bps",
    "daily_turnover_cap_bps",
  ]);
  const guardrails = input.filter((id): id is RebalanceGuardrailId =>
    supported.has(id),
  );
  return guardrails.length > 0 ? [...new Set(guardrails)] : undefined;
}

export async function POST(request: NextRequest): Promise<Response> {
  try {
    const body = await readJsonObjectBody<RebalancePlanRequestBody & Record<string, unknown>>(request);
    const requestedProtocol = normalizeRequestedProtocol(body.requestedProtocol);
    if(requestedProtocol==='PHOENIX')return jsonNoStore({ok:false,source:'api_routing_solver',error:'Phoenix has been retired from new routes.'},{status:410});
    const amountBase = Math.max(0, toInteger(body.amountBase, 0));
    const tokenIn = typeof body.tokenIn === "string" ? body.tokenIn.trim() : "";
    const tokenOut = typeof body.tokenOut === "string" ? body.tokenOut.trim() : "";
    const slippagePct = Math.max(0, toNumber(body.slippagePct, 0));
    const manualMinOutBase = Math.max(0, toInteger(body.manualMinOutBase, 0));
    const configuredAquariusPoolIndex =
      typeof body.configuredAquariusPoolIndex === "string"
        ? body.configuredAquariusPoolIndex.trim()
        : "";
    const configuredPhoenixPoolFromBody =
      typeof body.configuredPhoenixPool === "string"
        ? body.configuredPhoenixPool.trim()
        : "";
    const configuredPhoenixPool =
      configuredPhoenixPoolFromBody ||
      (((tokenIn === ROUTING_ASSET_A && tokenOut === ROUTING_ASSET_B) ||
        (tokenIn === ROUTING_ASSET_B && tokenOut === ROUTING_ASSET_A))
        ? PHOENIX_POOL_ROUTING_PAIR
        : "");
    const routingAssets = Array.isArray(body.routingAssets)
      ? body.routingAssets.filter(
          (asset): asset is string =>
            typeof asset === "string" && asset.trim().length > 0,
        )
      : [];
    const routingSearch = parseRoutingSearchConfig(body.routingSearch);
    const vaultNavBase = toOptionalInteger(body.vaultNavBase);
    const dailyTurnoverUsedBase = toOptionalInteger(body.dailyTurnoverUsedBase);
    const projectedPostTradeDeviationBps = toOptionalInteger(
      body.projectedPostTradeDeviationBps,
    );
    const requiredStatefulGuardrails = parseRequiredStatefulGuardrails(
      body.requiredStatefulGuardrails,
    );
    const readerPubKey =
      typeof body.readerPubKey === "string" && body.readerPubKey.trim().length > 0
        ? body.readerPubKey.trim()
        : undefined;
    const intentTxHash =
      typeof body.intentTxHash === "string" && body.intentTxHash.trim().length > 0
        ? body.intentTxHash.trim()
        : null;

    const balancedSupport = await readBalancedProtocolHealth();
    const balancedIntentDriver = buildBalancedIntentExecutionDriver(balancedSupport);
    const balancedLane = deriveBalancedRouteLaneFromDriver(balancedIntentDriver);
    const balancedAutoSurface = deriveBalancedAutoSurfaceReadiness(balancedSupport);
    const balancedComparableLifecycleReady =
      balancedAutoSurface.officialEvidenceReady &&
      balancedAutoSurface.officialAutoComparable;
    const balancedLaneReady = balancedAutoSurface.laneReady;
    const balancedPlanningEnabled = balancedAutoSurface.autoReady;
    const balancedCanaryPolicy =
      amountBase > 0 && tokenIn && tokenOut
        ? evaluateBalancedSodaxCanaryPolicy({ tokenIn, tokenOut, amountBase })
        : undefined;

    let balancedComparableQuoteOutBase = 0;
    let balancedComparableQuoteProvider: string | undefined;
    let balancedComparableQuoteError: string | undefined;
    const shouldProbeBalancedQuote =
      balancedPlanningEnabled &&
      balancedLaneReady &&
      amountBase > 0 &&
      tokenIn &&
      tokenOut &&
      (requestedProtocol === "BALANCED" ||
        balancedCanaryPolicy?.autoEligible === true);
    if (shouldProbeBalancedQuote) {
      if (!balancedComparableLifecycleReady) {
        balancedComparableQuoteError = balancedAutoSurface.reason;
      } else {
        try {
          const quote = await requestBalancedIntentSurfaceQuote({
            tokenIn,
            tokenOut,
            amountInBase: String(amountBase),
          });
          if (quote.ok) {
            balancedComparableQuoteOutBase = parsePositiveBaseUnits(
              quote.quotedAmountBase,
            );
            balancedComparableQuoteProvider = quote.provider;
          } else {
            balancedComparableQuoteError = `${quote.code}: ${quote.message}`;
          }
        } catch (error) {
          balancedComparableQuoteError =
            error instanceof Error
              ? error.message
              : "Failed to request Balanced/SODAX quote.";
        }
      }
    }

    let balancedIntentLifecycle:
      | Awaited<ReturnType<typeof requestBalancedIntentSurfaceLifecycle>>
      | null = null;
    if (intentTxHash) {
      try {
        balancedIntentLifecycle = await requestBalancedIntentSurfaceLifecycle({
          intentTxHash,
        });
      } catch {
        balancedIntentLifecycle = null;
      }
    }

    const protocolPolicies = buildRuntimeRebalanceProtocolPolicies({
      base: {
        BALANCED: {
          planningEnabled: balancedPlanningEnabled,
          executionEnabled: balancedLaneReady,
          disabledReason:
            balancedAutoSurface.reason ||
            balancedIntentDriver.plannerDetail ||
            balancedSupport.blockingReasons[0] ||
            "Balanced stays blocked until canonical readiness is live.",
        },
      },
    });

    const plan = await resolveRebalanceRoutePlan(
      {
        requestedProtocol,
        fundId: typeof body.fundId==='string'?body.fundId:undefined,
        requireVenueState: true,
        sushiAdapterId: SUSHI_ADAPTER || undefined,
        sushiPoolId: resolveSushiPoolId(tokenIn, tokenOut),
        amountBase,
        tokenIn,
        tokenOut,
        slippagePct,
        manualMinOutBase,
        aquariusRouterId: AQUARIUS_ROUTER,
        aquariusAdapterId: AQUARIUS_ADAPTER,
        aquariusPoolId: 1,
        soroswapAdapterId: SOROSWAP_ADAPTER,
        phoenixAdapterId: PHOENIX_ADAPTER || undefined,
        phoenixPoolId: PHOENIX_POOL_ID,
        configuredPhoenixPool: configuredPhoenixPool || undefined,
        configuredAquariusPoolIndex: configuredAquariusPoolIndex || undefined,
        routingAssets,
        routingSearch,
        balancedLane,
        balancedLaneReady,
        balancedComparableLifecycleReady,
        balancedComparableQuoteOutBase,
        balancedComparableQuoteProvider,
        balancedComparableQuoteError,
        balancedCanaryPolicy,
        protocolPolicies,
        readerPubKey,
        guardrailState: {
          vaultNavBase,
          dailyTurnoverUsedBase,
          projectedPostTradeDeviationBps,
        },
        requiredStatefulGuardrails,
      },
      {
        readSushiEstimateOut,
        readSushiFundBinding,
        readVenueSnapshot,
        readSoroswapAmountOut,
        readSoroswapAmountOutForPath,
        readAquariusPoolIndex,
        readAquariusEstimateOut,
        readPhoenixEstimateOut,
      },
    );

    return jsonNoStore({
      ok: true,
      source: "api_routing_solver",
      generatedAt: new Date().toISOString(),
      plan,
      balancedIntentLifecycle,
    });
  } catch (error) {
    return jsonNoStore(
      {
        ok: false,
        source: "api_routing_solver",
        error: redactApiText(error, "Failed to resolve rebalance route plan."),
      },
      { status: 500 },
    );
  }
}
