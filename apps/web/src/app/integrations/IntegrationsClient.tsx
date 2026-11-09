"use client";

import {protocolVenueAllowed} from '@/lib/workflows/protocolLifecycle';
import {NETWORK_PASSPHRASE} from '@/lib/config';
import type { StellarWalletsKit } from "@creit.tech/stellar-wallets-kit";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { assertFinancialActionsEnabled, UX_REVIEW_PREVIEW } from "@/lib/previewSafety";
import {
  ActionField,
  Panel,
  StatusPill,
  SurfaceTable,
  TransactionFeedbackRail,
  TransactionReviewCard,
} from "@/components/product/surfacePrimitives";
import {
  ADAPTER_BALANCED,
  ADAPTER_BLEND,
  ROUTING_ASSET_A,
  ROUTING_ASSET_A_LABEL,
  ROUTING_ASSET_B,
  ROUTING_ASSET_B_LABEL,
  AQUARIUS_ADAPTER,
  AQUARIUS_ROUTER,
  BALANCED_EXPECTED_ROUTER,
  BALANCED_LANE_MODE,
  BALANCED_POOL_ID,
  BALANCED_DEFAULT_TOKEN_IN_SYMBOL,
  BALANCED_DEFAULT_TOKEN_OUT_SYMBOL,
  BALANCED_SUPPORT_STATUS,
  BLEND_POOL_REAL,
  DENOMINATION,
  SUSHI_ADAPTER,
  SUSHI_FACTORY,
  PLATFORM_VENUE_REGISTRY,
  SUSHI_POOL_ID,
  SUSHI_POOL_ROUTING_PAIR,
  SOROSWAP_ADAPTER,
  SOROSWAP_ROUTER,
} from "../../lib/config";
import {
  buildAdapterBalancedExecute,
  buildAdapterBlendExecute,
  readAdapterRouterDiagnostic,
  readAdapterBalancedPoolSupport,
  readAquariusEstimateOut,
  readAquariusPoolIndex,
  readSushiEstimateOut,
  readRegistryVenueSnapshot,
  readSushiPoolRouteDiagnostic,
  readSoroswapAmountOut,
  type AdapterRouterDiagnostic,
  type SushiPoolRouteDiagnostic,
} from "../../lib/soroban";
import { signXdr, submitSignedTx, waitForTx } from "../../lib/tx";
import {
  connectWallet,
  getWalletsKit,
} from "../../lib/walletKit";
import {
  deriveMainnetOracleGateState,
  deriveBalancedLaneState,
  deriveIntegrationHealth,
  deriveIntegrationShowcaseCards,
  deriveIntegrationRuntimeSignals,
  formatWalletStatus,
} from "../../lib/workflows/productFlows";
import {
  buildExecutionVenueCatalog,
  type ExecutionVenueDescriptor,
  formatExecutionVenueConfirmationModelLabel,
  formatExecutionVenueFamilyLabel,
  formatExecutionVenuePlannerAdmissionLabel,
  formatExecutionVenuePathModelLabel,
  formatExecutionVenueQuoteModelLabel,
  formatExecutionVenueSettlementModelLabel,
} from "@/lib/workflows/executionVenues";
import {
  buildExecutionVenueReceipt,
  type ExecutionReceipt,
} from "@/lib/workflows/executionReceipts";
import {
  formatIntentVenueCapabilityStateLabel,
  formatIntentVenueSourceStatusLabel,
} from "@/lib/workflows/intentVenueSources";
import {
  buildBalancedIntentExecutionDriver,
  buildBalancedIntentExecutionDriverSummary,
  deriveBalancedIntentSurfaceActionStates,
  formatIntentExecutionDriverConfirmationCapabilityLabel,
  formatIntentExecutionDriverExecutionCapabilityLabel,
  formatIntentExecutionDriverQuoteCapabilityLabel,
  formatIntentExecutionSurfaceEndpoint,
} from "@/lib/workflows/intentExecutionDrivers";
import {
  buildBalancedIntentExecutionHandoff,
  formatIntentExecutionHandoffPostureLabel,
  formatIntentExecutionHandoffStepStateLabel,
} from "@/lib/workflows/intentExecutionHandoffs";
import {
  buildIntegrationProtocolCommandDeck,
  buildIntegrationProtocolCatalogCards,
  buildIntegrationPublicMetricDeck,
  buildIntegrationSurfaceAccessModel,
  buildIntegrationWorkspaceState,
  INTEGRATION_WORKSPACE_TABS,
  isIntegrationOperatorSurface,
  resolveIntegrationWorkspaceId,
  type IntegrationPublicMetricTile,
  type IntegrationSurfaceMode,
  type IntegrationWorkspaceId,
  type IntegrationWorkspaceSnapshot,
} from "@/lib/workflows/integrationWorkspaces";
import {
  type AppHealthPayload,
  buildBalancedFallbackPayload,
  normalizeProtocolSupportStatus,
  readAppHealthSnapshot,
  type BalancedProtocolHealthPayload,
} from "@/lib/runtime/appHealth";
import {
  loadBalancedIntentTokenCatalog,
  requestBalancedIntentBuild,
  requestBalancedIntentConfirm,
  requestBalancedIntentExpiry,
  requestBalancedIntentQuote,
  requestBalancedIntentReceipt,
  requestBalancedIntentRefund,
  requestBalancedIntentRelay,
  requestBalancedIntentStatus,
  requestBalancedIntentSubmit,
  type BalancedIntentBuildResult,
  type BalancedIntentCatalogToken,
  type BalancedIntentConfirmFailure,
  type BalancedIntentConfirmSuccess,
  type BalancedIntentExpiryResult,
  type BalancedIntentQuoteFailure,
  type BalancedIntentQuoteSuccess,
  type BalancedIntentReceiptResult,
  type BalancedIntentRefundResult,
  type BalancedIntentRelayResult,
  type BalancedIntentStatusFailure,
  type BalancedIntentStatusSuccess,
  type BalancedIntentSubmitResult,
} from "@/lib/runtime/balancedIntentApi";

const DECIMALS = 7;

type IntegrationRoutingView = "adapters" | "venues" | "balanced";

const INTEGRATION_ROUTING_VIEW_TABS: Array<{
  id: IntegrationRoutingView;
  label: string;
  eyebrow: string;
}> = [
  { id: "adapters", label: "Adapters", eyebrow: "Router wiring" },
  { id: "venues", label: "Venues", eyebrow: "Execution semantics" },
  { id: "balanced", label: "Balanced", eyebrow: "Intent source" },
];

type AmmPlannerProbe = {
  ready: boolean;
  detail: string;
};

const AMM_PLANNER_PROBE_AMOUNT_BASE = 1_000_000;
const ROUTING_PAIR_PROBE_LABEL = `${ROUTING_ASSET_A_LABEL} -> ${ROUTING_ASSET_B_LABEL}`;

function decimalTokenAmountToBaseUnits(value: string, decimals: number): string {
  const normalized = value.trim().replace(",", ".");
  if (!/^\d+(\.\d+)?$/.test(normalized)) return "";
  const [wholePart = "0", rawFractionalPart = ""] = normalized.split(".");
  const fractionalPart = rawFractionalPart.slice(0, decimals).padEnd(decimals, "0");
  const combined = `${wholePart}${fractionalPart}`.replace(/^0+(?=\d)/, "");
  return BigInt(combined || "0").toString();
}

function baseUnitsToDecimalTokenAmount(value: string, decimals: number): string {
  try {
    const parsed = BigInt(value);
    const base = BigInt(10) ** BigInt(decimals);
    const whole = parsed / base;
    const fraction = (parsed % base).toString().padStart(decimals, "0").replace(/0+$/, "");
    return fraction ? `${whole.toString()}.${fraction}` : whole.toString();
  } catch {
    return value;
  }
}

function findBalancedIntentToken(
  tokens: BalancedIntentCatalogToken[],
  address: string,
): BalancedIntentCatalogToken | null {
  const normalized = address.trim().toUpperCase();
  return tokens.find((token) => token.address.trim().toUpperCase() === normalized) ?? null;
}

function formatBalancedIntentQuoteAmount(
  value: string,
  token: BalancedIntentCatalogToken | null,
): string {
  if (!token) return value;
  return `${baseUnitsToDecimalTokenAmount(value, token.decimals)} ${token.symbol}`;
}

function formatComparableProbeAmount(value: number): string {
  return `${(value / 10 ** DECIMALS).toLocaleString("en", {
    maximumFractionDigits: DECIMALS,
  })} quoted amount`;
}

function formatAdapterDiagnosticDetail(
  diagnostic: AdapterRouterDiagnostic,
): string {
  return diagnostic.ok
    ? diagnostic.detail
    : `${diagnostic.status}: ${diagnostic.detail}`;
}

function formatSushiRouteDiagnosticDetail(
  diagnostic: SushiPoolRouteDiagnostic,
): string {
  return diagnostic.ok
    ? diagnostic.detail
    : `${diagnostic.status}: ${diagnostic.detail}`;
}

async function probeSoroswapPlanner(reader?: string): Promise<AmmPlannerProbe> {
  try {
    const amountOut = await readSoroswapAmountOut(
      AMM_PLANNER_PROBE_AMOUNT_BASE,
      ROUTING_ASSET_A,
      ROUTING_ASSET_B,
      reader,
    );
    if (amountOut > 0) {
      return {
        ready: true,
        detail: `SoroSwap returned a live comparable quote for ${ROUTING_PAIR_PROBE_LABEL} (${formatComparableProbeAmount(amountOut)}).`,
      };
    }
    return {
      ready: false,
      detail: `SoroSwap returned no live comparable quote for ${ROUTING_PAIR_PROBE_LABEL}.`,
    };
  } catch (error) {
    return {
      ready: false,
      detail:
        error instanceof Error
          ? error.message
          : "SoroSwap quote probe failed.",
    };
  }
}

async function probeAquariusPlanner(reader?: string): Promise<AmmPlannerProbe> {
  try {
    const poolIndex = await readAquariusPoolIndex(
      AQUARIUS_ROUTER,
      ROUTING_ASSET_A,
      ROUTING_ASSET_B,
      reader,
    );
    if (!poolIndex) {
      return {
        ready: false,
        detail: `Aquarius returned no pool index for ${ROUTING_PAIR_PROBE_LABEL}.`,
      };
    }
    const amountOut = await readAquariusEstimateOut(
      AQUARIUS_ROUTER,
      ROUTING_ASSET_A,
      ROUTING_ASSET_B,
      poolIndex,
      AMM_PLANNER_PROBE_AMOUNT_BASE,
      reader,
    );
    if (amountOut > 0) {
      return {
        ready: true,
        detail: `Aquarius returned a live comparable quote for ${ROUTING_PAIR_PROBE_LABEL} (${formatComparableProbeAmount(amountOut)}).`,
      };
    }
    return {
      ready: false,
      detail:
        `Aquarius pool discovery succeeded, but estimate_swap returned no quote for ${ROUTING_PAIR_PROBE_LABEL}.`,
    };
  } catch (error) {
    return {
      ready: false,
      detail:
        error instanceof Error
          ? error.message
          : "Aquarius quote probe failed.",
    };
  }
}

async function probeSushiPlanner(reader?: string): Promise<AmmPlannerProbe> {
  if (!SUSHI_ADAPTER || !SUSHI_FACTORY) {
    return {
      ready: false,
      detail:
        `Sushi pool is not configured for ${ROUTING_PAIR_PROBE_LABEL}; AUTO remains blocked.`,
    };
  }

  try {
    const amountOut = await readSushiEstimateOut(
      SUSHI_ADAPTER,
      SUSHI_POOL_ID,
      ROUTING_ASSET_A,
      ROUTING_ASSET_B,
      AMM_PLANNER_PROBE_AMOUNT_BASE,
      reader,
    );
    if (amountOut > 0) {
      return {
        ready: true,
        detail: `Sushi returned a live comparable pool quote for ${ROUTING_PAIR_PROBE_LABEL} (${formatComparableProbeAmount(amountOut)}).`,
      };
    }
    return {
      ready: false,
      detail: `Sushi pool returned no live comparable quote for ${ROUTING_PAIR_PROBE_LABEL}.`,
    };
  } catch (error) {
    return {
      ready: false,
      detail:
        error instanceof Error
          ? error.message
          : "Sushi quote probe failed.",
    };
  }
}

function toBaseUnits(input: string): number {
  const n = Number((input || "0").replace(",", "."));
  if (!Number.isFinite(n) || n <= 0) return 0;
  return Math.floor(n * 10 ** DECIMALS);
}

function pickPreferredBalancedToken(
  tokens: BalancedIntentCatalogToken[],
  preferredSymbol: string,
  fallbackAddress?: string,
): BalancedIntentCatalogToken | null {
  const normalizedPreferred = preferredSymbol.trim().toUpperCase();
  return (
    tokens.find(
      (token) => token.symbol.trim().toUpperCase() === normalizedPreferred,
    ) ??
    (fallbackAddress
      ? (tokens.find((token) => token.address !== fallbackAddress) ?? null)
      : (tokens[0] ?? null))
  );
}

function integrationPublicMetricTestId(
  tile: IntegrationPublicMetricTile,
): string {
  return `integrations-public-metric-${tile.id}`;
}

const INTEGRATION_FIGMA_BRAND_ASSETS: Record<string, string> = {
  AQUARIUS: "/figma/integrations/aquarius.png",
  BALANCED: "/figma/integrations/balanced.png",
  BLEND: "/figma/integrations/blend.png",
  SOROSWAP: "/figma/integrations/soroswap.png",
};

function integrationFigmaBrandAsset(id: string): string | null {
  return INTEGRATION_FIGMA_BRAND_ASSETS[id.toUpperCase()] ?? null;
}

function compactProtocolMapReason(value: string): string {
  const [firstSentence] = value.split(/(?<=\.)\s+/);
  return (firstSentence || value).trim().replace(/\.$/, "");
}

function formatProtocolMapNodeDetail(venue: ExecutionVenueDescriptor): string {
  if (venue.autoRoutingEligible) {
    return `AUTO-ready: ${formatExecutionVenueQuoteModelLabel(
      venue.quoteModel,
    )} -> ${formatExecutionVenueSettlementModelLabel(venue.settlementModel)}`;
  }

  if (venue.manualExecutionEligible) {
    return `Manual only: ${compactProtocolMapReason(venue.detail)}`;
  }

  if (venue.statusLabel === "Unavailable" && venue.family === "amm_router") {
    return `Unavailable: adapter router read did not return the configured ${venue.title} router`;
  }

  if (venue.statusLabel === "Mismatch" && venue.family === "amm_router") {
    return `Mismatch: adapter router differs from the configured ${venue.title} router`;
  }

  return `Blocked: ${compactProtocolMapReason(venue.detail)}`;
}

export function IntegrationsSurface({
  mode = "public",
}: {
  mode?: IntegrationSurfaceMode;
}) {
  const integrationAccessModel = useMemo(
    () => buildIntegrationSurfaceAccessModel(mode),
    [mode],
  );
  const operatorSurface = isIntegrationOperatorSurface(mode);
  const [walletsKit, setWalletsKit] = useState<StellarWalletsKit | null>(null);
  const [pubKey, setPubKey] = useState("");
  const [activeWorkspace, setActiveWorkspace] =
    useState<IntegrationWorkspaceId>("routing");
  const [routingView, setRoutingView] =
    useState<IntegrationRoutingView>("adapters");
  const [loading, setLoading] = useState(false);
  const [protocolChecks, setProtocolChecks] = useState<"loading" | "ready" | "error">("loading");
  const protocolCheckVersion = useRef(0);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [executionReceipt, setExecutionReceipt] =
    useState<ExecutionReceipt | null>(null);
  const [balancedSupport, setBalancedSupport] =
    useState<BalancedProtocolHealthPayload>(() =>
      buildBalancedFallbackPayload({
        adapterBalanced: ADAPTER_BALANCED,
        poolId: BALANCED_POOL_ID,
        supportStatus: BALANCED_SUPPORT_STATUS,
        laneMode: BALANCED_LANE_MODE,
        expectedRouter: BALANCED_EXPECTED_ROUTER || null,
      }),
    );
  const [appHealthSnapshot, setAppHealthSnapshot] =
    useState<AppHealthPayload | null>(null);

  const [aquariusRouter, setAquariusRouter] = useState<string | null>(null);
  const [soroswapRouter, setSoroswapRouter] = useState<string | null>(null);
  const [sushiPoolRoute, setSushiPoolRoute] = useState<string | null>(null);
  const [blendRouter, setBlendRouter] = useState<string | null>(null);
  const [balancedRouter, setBalancedRouter] = useState<string | null>(null);
  const [balancedPairConfigured, setBalancedPairConfigured] = useState(false);
  const [aquariusPlannerReady, setAquariusPlannerReady] = useState(false);
  const [soroswapPlannerReady, setSoroswapPlannerReady] = useState(false);
  const [sushiPlannerReady, setSushiPlannerReady] = useState(false);
  const [aquariusPlannerDetail, setAquariusPlannerDetail] = useState(
    "Aquarius quote probe has not run yet.",
  );
  const [soroswapPlannerDetail, setSoroswapPlannerDetail] = useState(
    "SoroSwap quote probe has not run yet.",
  );
  const [sushiPlannerDetail, setSushiPlannerDetail] = useState(
    "Sushi quote probe has not run yet.",
  );
  const [aquariusAdapterDetail, setAquariusAdapterDetail] = useState(
    "Aquarius adapter health has not been read yet.",
  );
  const [soroswapAdapterDetail, setSoroswapAdapterDetail] = useState(
    "SoroSwap adapter health has not been read yet.",
  );
  const [sushiAdapterDetail, setSushiAdapterDetail] = useState(
    "Sushi adapter route has not been read yet.",
  );

  useEffect(() => {
    setActiveWorkspace((current) =>
      resolveIntegrationWorkspaceId(
        new URLSearchParams(window.location.search).get("workspace"),
        current,
      ),
    );
  }, []);

  const [balancedPoolId, setBalancedPoolId] = useState(
    String(BALANCED_POOL_ID),
  );
  const [balancedAmount, setBalancedAmount] = useState("0.0001000");
  const [balancedMinOut, setBalancedMinOut] = useState("0.0000990");
  const [blendAmount, setBlendAmount] = useState("0.0001");
  const [blendAction, setBlendAction] = useState<
    "Lend" | "Borrow" | "Repay" | "Liquidate"
  >("Borrow");
  const [balancedIntentTokens, setBalancedIntentTokens] = useState<
    BalancedIntentCatalogToken[]
  >([]);
  const [balancedIntentTokenIn, setBalancedIntentTokenIn] = useState("");
  const [balancedIntentTokenOut, setBalancedIntentTokenOut] = useState("");
  const [balancedIntentAmountInput, setBalancedIntentAmountInput] =
    useState("1");
  const [balancedIntentMinOutputInput, setBalancedIntentMinOutputInput] =
    useState("0.99");
  const [balancedIntentQuote, setBalancedIntentQuote] = useState<
    BalancedIntentQuoteSuccess | BalancedIntentQuoteFailure | null
  >(null);
  const [balancedIntentBuild, setBalancedIntentBuild] =
    useState<BalancedIntentBuildResult | null>(null);
  const [balancedIntentSourceTxHash, setBalancedIntentSourceTxHash] =
    useState("");
  const [balancedIntentRelay, setBalancedIntentRelay] =
    useState<BalancedIntentRelayResult | null>(null);
  const [balancedIntentSubmit, setBalancedIntentSubmit] =
    useState<BalancedIntentSubmitResult | null>(null);
  const [balancedIntentStatusHash, setBalancedIntentStatusHash] = useState("");
  const [balancedIntentStatus, setBalancedIntentStatus] = useState<
    BalancedIntentStatusSuccess | BalancedIntentStatusFailure | null
  >(null);
  const [balancedIntentConfirm, setBalancedIntentConfirm] = useState<
    BalancedIntentConfirmSuccess | BalancedIntentConfirmFailure | null
  >(null);
  const [balancedIntentReceipt, setBalancedIntentReceipt] =
    useState<BalancedIntentReceiptResult | null>(null);
  const [balancedIntentExpiry, setBalancedIntentExpiry] =
    useState<BalancedIntentExpiryResult | null>(null);
  const [balancedIntentRefund, setBalancedIntentRefund] =
    useState<BalancedIntentRefundResult | null>(null);
  const [balancedIntentSurfaceBusy, setBalancedIntentSurfaceBusy] =
    useState(false);
  const [balancedIntentSurfaceError, setBalancedIntentSurfaceError] =
    useState("");

  const canAct = useMemo(
    () => Boolean(pubKey && walletsKit && !loading),
    [pubKey, walletsKit, loading],
  );
  const balancedHealth = useMemo(
    () =>
      deriveIntegrationHealth(
        balancedSupport.expectedRouter ?? "",
        balancedRouter,
        {
          supportStatus: normalizeProtocolSupportStatus(
            balancedSupport.supportStatus,
          ),
        },
      ),
    [balancedRouter, balancedSupport],
  );
  const aquariusHealth = useMemo(
    () => deriveIntegrationHealth(AQUARIUS_ROUTER, aquariusRouter),
    [aquariusRouter],
  );
  const soroswapHealth = useMemo(
    () => deriveIntegrationHealth(SOROSWAP_ROUTER, soroswapRouter),
    [soroswapRouter],
  );
  const sushiHealth = useMemo(() => {
    if (!SUSHI_ADAPTER || !SUSHI_POOL_ROUTING_PAIR) {
      return {
        matched: false,
        label: "Blocked",
        tone: "warning" as const,
      };
    }
    return deriveIntegrationHealth(SUSHI_POOL_ROUTING_PAIR, sushiPoolRoute);
  }, [sushiPoolRoute]);
  const blendHealth = useMemo(
    () => deriveIntegrationHealth(BLEND_POOL_REAL, blendRouter),
    [blendRouter],
  );
  const walletLabel = useMemo(() => formatWalletStatus(pubKey), [pubKey]);
  const selectedBalancedIntentTokenIn = useMemo(
    () => findBalancedIntentToken(balancedIntentTokens, balancedIntentTokenIn),
    [balancedIntentTokenIn, balancedIntentTokens],
  );
  const selectedBalancedIntentTokenOut = useMemo(
    () => findBalancedIntentToken(balancedIntentTokens, balancedIntentTokenOut),
    [balancedIntentTokenOut, balancedIntentTokens],
  );
  const balancedIntentAmountInBase = useMemo(
    () =>
      decimalTokenAmountToBaseUnits(
        balancedIntentAmountInput,
        selectedBalancedIntentTokenIn?.decimals ?? DECIMALS,
      ),
    [balancedIntentAmountInput, selectedBalancedIntentTokenIn?.decimals],
  );
  const balancedIntentMinOutputAmountBase = useMemo(
    () =>
      decimalTokenAmountToBaseUnits(
        balancedIntentMinOutputInput,
        selectedBalancedIntentTokenOut?.decimals ?? DECIMALS,
      ),
    [balancedIntentMinOutputInput, selectedBalancedIntentTokenOut?.decimals],
  );
  const loadedRoutes = useMemo(
    () =>
      [
        balancedRouter,
        aquariusRouter,
        soroswapRouter,
        sushiPoolRoute,
        blendRouter,
      ].filter(Boolean).length,
    [
      aquariusRouter,
      balancedRouter,
      blendRouter,
      sushiPoolRoute,
      soroswapRouter,
    ],
  );
  const balancedLane = useMemo(
    () =>
      deriveBalancedLaneState({
        health: balancedHealth,
        pairConfigured: balancedPairConfigured,
        poolId: balancedPoolId,
        amount: balancedAmount,
        minOut: balancedMinOut,
        supportStatus: normalizeProtocolSupportStatus(
          balancedSupport.supportStatus,
        ),
        laneMode: balancedSupport.laneMode,
      }),
    [
      balancedAmount,
      balancedHealth,
      balancedMinOut,
      balancedPairConfigured,
      balancedPoolId,
      balancedSupport.laneMode,
      balancedSupport.supportStatus,
    ],
  );
  const balancedModuleNote = useMemo(() => {
    if (balancedSupport.validatedModule.present) {
      return `Canonical module promoted${balancedSupport.validatedModule.validatedAt ? ` on ${balancedSupport.validatedModule.validatedAt}` : ""} via ${balancedSupport.validatedModule.sourceValidations.join(", ") || "balancedReadiness"}.`;
    }
    return "Validated module has not been promoted yet; this lane is still running below the canonical support threshold.";
  }, [balancedSupport.validatedModule]);
  const balancedOfficialSurfaceNote = useMemo(() => {
    if (balancedSupport.officialSurface.swapModel === "sodax_intents") {
      return "Official Balanced on Stellar uses SODAX Intents for swaps, and its liquidity surface is now legacy-only. No public Stellar testnet router contract id has been verified yet.";
    }
    return "Official Stellar topology for Balanced is still unverified from the current runtime snapshot.";
  }, [balancedSupport.officialSurface]);
  const balancedIntentCapabilityNote = useMemo(
    () =>
      [
        `Tokens ${balancedSupport.intentVenue.discoveryState}`,
        `Quote ${balancedSupport.intentVenue.quoteState}`,
        `Execution ${balancedSupport.intentVenue.executeState}`,
        `Best execution ${formatExecutionVenuePlannerAdmissionLabel(
          balancedSupport.intentVenue.plannerAdmission,
        )}`,
      ].join(" · "),
    [balancedSupport.intentVenue],
  );
  const balancedIntentDriver = useMemo(
    () => buildBalancedIntentExecutionDriver(balancedSupport),
    [balancedSupport],
  );
  const balancedSourceAdapter = balancedIntentDriver.source;
  const balancedIntentDriverNote = useMemo(
    () => buildBalancedIntentExecutionDriverSummary(balancedIntentDriver),
    [balancedIntentDriver],
  );
  const balancedIntentSurfaceEndpointSummary = useMemo(
    () => ({
      quote: formatIntentExecutionSurfaceEndpoint(
        balancedIntentDriver.publicQuoteEndpoint,
        "quote",
      ),
      build: formatIntentExecutionSurfaceEndpoint(
        balancedIntentDriver.publicBuildEndpoint,
        "build",
      ),
      relay: formatIntentExecutionSurfaceEndpoint(
        balancedIntentDriver.publicRelayEndpoint,
        "relay",
      ),
      submit: formatIntentExecutionSurfaceEndpoint(
        balancedIntentDriver.publicSubmitEndpoint,
        "submit",
      ),
      status: formatIntentExecutionSurfaceEndpoint(
        balancedIntentDriver.publicStatusEndpoint,
        "status",
      ),
      receipt: formatIntentExecutionSurfaceEndpoint(
        balancedIntentDriver.publicReceiptEndpoint,
        "receipt",
      ),
      expiry: formatIntentExecutionSurfaceEndpoint(
        balancedIntentDriver.publicExpiryEndpoint,
        "expiry",
      ),
      refund: formatIntentExecutionSurfaceEndpoint(
        balancedIntentDriver.publicRefundEndpoint,
        "refund",
      ),
    }),
    [
      balancedIntentDriver.publicBuildEndpoint,
      balancedIntentDriver.publicExpiryEndpoint,
      balancedIntentDriver.publicQuoteEndpoint,
      balancedIntentDriver.publicReceiptEndpoint,
      balancedIntentDriver.publicRefundEndpoint,
      balancedIntentDriver.publicRelayEndpoint,
      balancedIntentDriver.publicStatusEndpoint,
      balancedIntentDriver.publicSubmitEndpoint,
    ],
  );
  const balancedIntentActionStates = useMemo(
    () =>
      deriveBalancedIntentSurfaceActionStates({
        tokensLoaded: balancedIntentTokens.length > 0,
        tokenIn: balancedIntentTokenIn,
        tokenOut: balancedIntentTokenOut,
        amountInBase: balancedIntentAmountInBase,
        minOutputAmountBase: balancedIntentMinOutputAmountBase,
        sourceAccount: pubKey ?? "",
        sourceTxHash: balancedIntentSourceTxHash,
        intentTxHash: balancedIntentStatusHash,
        intentBuilt: Boolean(balancedIntentBuild?.ok),
        busy: balancedIntentSurfaceBusy,
      }),
    [
      balancedIntentBuild,
      balancedIntentAmountInBase,
      balancedIntentMinOutputAmountBase,
      balancedIntentSourceTxHash,
      balancedIntentStatusHash,
      balancedIntentSurfaceBusy,
      balancedIntentTokenIn,
      balancedIntentTokenOut,
      balancedIntentTokens.length,
      pubKey,
    ],
  );
  const balancedIntentHandoff = useMemo(
    () =>
      buildBalancedIntentExecutionHandoff(balancedIntentDriver, {
        amountLabel: balancedAmount || "0",
        minOutLabel: balancedMinOut || "0",
      }),
    [balancedAmount, balancedIntentDriver, balancedMinOut],
  );
  const runtimeSignals = useMemo(
    () =>
      deriveIntegrationRuntimeSignals({
        pubKey,
        walletLabel,
        loadedRoutes,
        balancedLane,
        blendAction,
        blendAmount,
        routes: [
          balancedHealth,
          aquariusHealth,
          soroswapHealth,
          sushiHealth,
          blendHealth,
        ],
      }),
    [
      aquariusHealth,
      balancedHealth,
      balancedLane,
      blendAction,
      blendAmount,
      blendHealth,
      loadedRoutes,
      sushiHealth,
      pubKey,
      soroswapHealth,
      walletLabel,
    ],
  );
  const showcaseCards = useMemo(
    () =>
      deriveIntegrationShowcaseCards({
        pubKey,
        walletLabel,
        loadedRoutes,
        balanced: balancedHealth,
        aquarius: aquariusHealth,
        sushi: sushiHealth,
        soroswap: soroswapHealth,
        blend: blendHealth,
      }),
    [
      aquariusHealth,
      balancedHealth,
      blendHealth,
      loadedRoutes,
      sushiHealth,
      pubKey,
      soroswapHealth,
      walletLabel,
    ],
  );
  const [venueStates,setVenueStates]=useState<Partial<Record<import('@/lib/workflows/protocolLifecycle').ProtocolId,import('@/lib/workflows/protocolLifecycle').VenueSnapshot>>>({});
  const executionVenues = useMemo(
    () =>
      buildExecutionVenueCatalog({
        venueStates,
        balancedSupport,
        aquariusHealth,
        sushiHealth,
        soroswapHealth,
        blendHealth,
        aquariusPlannerReady,
        sushiPlannerReady,
        soroswapPlannerReady,
        aquariusPlannerDetail,
        sushiPlannerDetail,
        soroswapPlannerDetail,
        aquariusAdapterDetail,
        sushiAdapterDetail,
        soroswapAdapterDetail,
      }),
    [
      aquariusAdapterDetail,
      aquariusHealth,
      aquariusPlannerDetail,
      aquariusPlannerReady,
      balancedSupport,
      blendHealth,
      venueStates,
      sushiAdapterDetail,
      sushiHealth,
      sushiPlannerDetail,
      sushiPlannerReady,
      soroswapAdapterDetail,
      soroswapHealth,
      soroswapPlannerDetail,
      soroswapPlannerReady,
    ],
  );
  const balancedVenue = useMemo(
    () => executionVenues.find((venue) => venue.id === "BALANCED") ?? null,
    [executionVenues],
  );
  const blendVenue = useMemo(
    () => executionVenues.find((venue) => venue.id === "BLEND") ?? null,
    [executionVenues],
  );
  const mainnetOracleGate = useMemo(
    () => deriveMainnetOracleGateState(appHealthSnapshot?.oracle),
    [appHealthSnapshot],
  );
  const integrationWorkspaceSnapshot = useMemo<IntegrationWorkspaceSnapshot>(
    () => ({
      walletLabel,
      canAct,
      loadedRoutes,
      totalRoutes: 5,
      balancedLabel: balancedHealth.label,
      balancedTone: balancedHealth.tone,
      aquariusLabel: aquariusHealth.label,
      aquariusTone: aquariusHealth.tone,
      soroswapLabel: soroswapHealth.label,
      soroswapTone: soroswapHealth.tone,
      sushiLabel: sushiHealth.label,
      sushiTone: sushiHealth.tone,
      blendLabel: blendHealth.label,
      blendTone: blendHealth.tone,
      balancedIntentTokensLoaded: balancedIntentTokens.length,
      balancedQuoteReason: balancedIntentActionStates.quote.reason,
      balancedStatusReason: balancedIntentActionStates.status.reason,
      balancedConfirmationReason:
        balancedIntentActionStates.confirmation.reason,
      balancedDriverSummary: balancedIntentDriverNote,
      balancedLaneReady: balancedLane.ready,
      balancedLaneDetail: balancedLane.detail,
      mainnetGateReady: mainnetOracleGate.ready,
      mainnetGateDetail: mainnetOracleGate.detail,
      blendAction,
      blendAmount,
      executionReceiptReady: Boolean(executionReceipt),
    }),
    [
      aquariusHealth.label,
      aquariusHealth.tone,
      balancedHealth.label,
      balancedHealth.tone,
      balancedIntentActionStates.confirmation.reason,
      balancedIntentActionStates.quote.reason,
      balancedIntentActionStates.status.reason,
      balancedIntentDriverNote,
      balancedIntentTokens.length,
      balancedLane.detail,
      balancedLane.ready,
      blendAction,
      blendAmount,
      blendHealth.label,
      blendHealth.tone,
      canAct,
      executionReceipt,
      loadedRoutes,
      mainnetOracleGate.detail,
      mainnetOracleGate.ready,
      sushiHealth.label,
      sushiHealth.tone,
      soroswapHealth.label,
      soroswapHealth.tone,
      walletLabel,
    ],
  );
  const integrationWorkspaceState = useMemo(
    () =>
      buildIntegrationWorkspaceState(
        integrationWorkspaceSnapshot,
        activeWorkspace,
      ),
    [activeWorkspace, integrationWorkspaceSnapshot],
  );
  const integrationProtocolCommands = useMemo(
    () =>
      buildIntegrationProtocolCommandDeck({
        venues: executionVenues,
        loadedRoutes,
        totalRoutes: 5,
        walletLabel,
      }),
    [executionVenues, loadedRoutes, walletLabel],
  );
  const integrationProtocolCatalogCards = useMemo(
    () => buildIntegrationProtocolCatalogCards(executionVenues),
    [executionVenues],
  );
  const integrationPublicMetricTiles = useMemo(
    () =>
      buildIntegrationPublicMetricDeck({
        snapshot: integrationWorkspaceSnapshot,
        venues: executionVenues,
      }),
    [executionVenues, integrationWorkspaceSnapshot],
  );
  const integrationProtocolVisualNodes = useMemo(
    () =>
      executionVenues.map((venue) => ({
        id: venue.id,
        title: venue.title,
        family: formatExecutionVenueFamilyLabel(venue.family),
        status: venue.statusLabel,
        posture: venue.autoRoutingEligible
          ? "AUTO"
          : venue.manualExecutionEligible
            ? "Manual"
            : "Blocked",
        reason: formatProtocolMapNodeDetail(venue),
        tone: venue.statusTone,
      })),
    [executionVenues],
  );
  const autoVenueCount = integrationProtocolVisualNodes.filter(
    (node) => node.posture === "AUTO",
  ).length;
  const admittedVenueCount = executionVenues.filter(
    (venue) => venue.plannerAdmission !== "blocked",
  ).length;

  useEffect(() => {
    setWalletsKit(getWalletsKit(["FREIGHTER", "ALBEDO", "XBULL"]));
    const saved = localStorage.getItem("wallet:pubkey");
    if (saved) setPubKey(saved);
  }, []);

  const refresh = useCallback(
    async (reader?: string): Promise<void> => {
      const version = ++protocolCheckVersion.current;
      setProtocolChecks("loading");
      setVenueStates({});
      try {
        setError("");
        const r = reader || pubKey || undefined;
        const poolId = Math.trunc(Number(balancedPoolId || "0"));
        const [
          balanced,
          aquarius,
          soroswap,
          sushi,
          blend,
          balancedPair,
          aquariusPlanner,
          soroswapPlanner,
          sushiPlanner,
        ] =
          await Promise.all([
            readAdapterRouterDiagnostic(
              ADAPTER_BALANCED,
              balancedSupport.expectedRouter ?? "",
              r,
            ),
            readAdapterRouterDiagnostic(AQUARIUS_ADAPTER, AQUARIUS_ROUTER, r),
            readAdapterRouterDiagnostic(SOROSWAP_ADAPTER, SOROSWAP_ROUTER, r),
            readSushiPoolRouteDiagnostic(
              SUSHI_ADAPTER,
              SUSHI_POOL_ID,
              SUSHI_POOL_ROUTING_PAIR,
              r,
            ),
            readAdapterRouterDiagnostic(ADAPTER_BLEND, BLEND_POOL_REAL, r),
            readAdapterBalancedPoolSupport(ADAPTER_BALANCED, poolId, r),
            probeAquariusPlanner(r),
            probeSoroswapPlanner(r),
            probeSushiPlanner(r),
          ]);
        if (version !== protocolCheckVersion.current) return;
        setBalancedRouter(balanced.router);
        setAquariusRouter(aquarius.router);
        setSoroswapRouter(soroswap.router);
        setSushiPoolRoute(sushi.pool);
        setBlendRouter(blend.router);
        setBalancedPairConfigured(Boolean(balancedPair));
        setAquariusAdapterDetail(formatAdapterDiagnosticDetail(aquarius));
        setSoroswapAdapterDetail(formatAdapterDiagnosticDetail(soroswap));
        setSushiAdapterDetail(formatSushiRouteDiagnosticDetail(sushi));
        setAquariusPlannerReady(aquariusPlanner.ready);
        setAquariusPlannerDetail(aquariusPlanner.detail);
        setSoroswapPlannerReady(soroswapPlanner.ready);
        setSoroswapPlannerDetail(soroswapPlanner.detail);
        setSushiPlannerReady(sushiPlanner.ready);
        setSushiPlannerDetail(sushiPlanner.detail);
        const states: typeof venueStates={};
        if(PLATFORM_VENUE_REGISTRY)await Promise.all(([['BALANCED',ADAPTER_BALANCED],['SOROSWAP',SOROSWAP_ADAPTER],['AQUARIUS',AQUARIUS_ADAPTER],['SUSHI',SUSHI_ADAPTER],['BLEND',ADAPTER_BLEND]] as const).map(async([protocol,adapter])=>{if(adapter)try{states[protocol]=await readRegistryVenueSnapshot(PLATFORM_VENUE_REGISTRY,adapter,r);}catch{}}));
        if(version!==protocolCheckVersion.current)return;
        setVenueStates(states);
        setProtocolChecks("ready");
      } catch (e) {
        if (version !== protocolCheckVersion.current) return;
        setProtocolChecks("error");
        setError(
          e instanceof Error ? e.message : "Failed to load integrations",
        );
      }
    },
    [balancedPoolId, balancedSupport.expectedRouter, pubKey],
  );

  useEffect(() => {
    const generation = protocolCheckVersion;
    void refresh();
    return () => { generation.current++; };
  }, [refresh]);

  useEffect(() => {
    const hydrateBalancedSupport = async (): Promise<void> => {
      const snapshot = await readAppHealthSnapshot().catch(() => null);
      setAppHealthSnapshot(snapshot);
      if (!snapshot?.protocols?.balanced) return;
      setBalancedSupport(snapshot.protocols.balanced);
    };
    void hydrateBalancedSupport();
  }, []);

  const connect = async (): Promise<void> => {
    try {
      setError("");
      if (!walletsKit) throw new Error("Wallets Kit not initialized");
      const key = await connectWallet(walletsKit);
      setPubKey(key);
      localStorage.setItem("wallet:pubkey", key);
      await refresh(key);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to connect");
    }
  };

  const execTx = async (
    xdrB64: string,
    pendingMessage: string,
  ): Promise<string> => {
    assertFinancialActionsEnabled();
    if (!walletsKit) throw new Error("Wallet not connected");
    const signed = await signXdr(walletsKit, xdrB64);
    setStatus(pendingMessage);
    const hash = await submitSignedTx(signed);
    await waitForTx(hash);
    setStatus(`Success: ${hash}`);
    return hash;
  };

  const runBlend = async (): Promise<void> => {
    try {
      if (!canAct) return;
      setLoading(true);
      setError("");
      setExecutionReceipt(null);
      const amount = toBaseUnits(blendAmount);
      if (amount <= 0) throw new Error("Invalid amount");
      const tx = await buildAdapterBlendExecute(
        pubKey,
        ADAPTER_BLEND,
        blendAction,
        7,
        amount,
        pubKey,
      );
      const hash = await execTx(
        tx,
        `Submitting Blend execute (${blendAction})...`,
      );
      if (blendVenue) {
        setExecutionReceipt(
          buildExecutionVenueReceipt({
            venue: blendVenue,
            actionLabel: `Blend ${blendAction}`,
            primaryHash: hash,
            steps: [{ id: "execute", label: "Execute lane", hash }],
          }),
        );
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Blend execute failed");
      setStatus("");
    } finally {
      setLoading(false);
    }
  };

  const runBalanced = async (): Promise<void> => {
    try {
      if (!canAct || !balancedLane.ready || !mainnetOracleGate.ready) {
        setError(
          !mainnetOracleGate.ready
            ? mainnetOracleGate.detail
            : balancedLane.detail,
        );
        setStatus("");
        return;
      }
      setLoading(true);
      setError("");
      setExecutionReceipt(null);
      const poolId = Math.trunc(Number(balancedPoolId || "0"));
      const amount = toBaseUnits(balancedAmount);
      const minOut = toBaseUnits(balancedMinOut);
      if (poolId <= 0) throw new Error("Invalid Balanced pool id");
      if (amount <= 0) throw new Error("Invalid Balanced amount");
      if (minOut <= 0) throw new Error("Invalid Balanced min out");
      const tx = await buildAdapterBalancedExecute(
        pubKey,
        ADAPTER_BALANCED,
        poolId,
        amount,
        minOut,
        pubKey,
      );
      const hash = await execTx(
        tx,
        `Submitting Balanced execute (pool ${poolId})...`,
      );
      if (balancedVenue) {
        setExecutionReceipt(
          buildExecutionVenueReceipt({
            venue: balancedVenue,
            actionLabel: `Balanced execute (pool ${poolId})`,
            primaryHash: hash,
            steps: [{ id: "execute", label: "Execute lane", hash }],
          }),
        );
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Balanced execute failed");
      setStatus("");
    } finally {
      setLoading(false);
    }
  };

  const loadBalancedIntentSurface = async (): Promise<void> => {
    try {
      setBalancedIntentSurfaceBusy(true);
      setBalancedIntentSurfaceError("");
      const catalog = await loadBalancedIntentTokenCatalog();
      setBalancedIntentTokens(catalog.tokens);
      const nextTokenIn =
        pickPreferredBalancedToken(
          catalog.tokens,
          BALANCED_DEFAULT_TOKEN_IN_SYMBOL,
        ) ??
        catalog.tokens[0] ??
        null;
      const preferredDenominationToken =
        DENOMINATION.trim() === ""
          ? null
          : (catalog.tokens.find(
              (token) =>
                token.address.trim().toUpperCase() ===
                DENOMINATION.trim().toUpperCase(),
            ) ?? null);
      const nextTokenOut =
        (preferredDenominationToken?.address !== nextTokenIn?.address
          ? preferredDenominationToken
          : null) ??
        pickPreferredBalancedToken(
          catalog.tokens,
          BALANCED_DEFAULT_TOKEN_OUT_SYMBOL,
          nextTokenIn?.address,
        ) ??
        catalog.tokens.find(
          (token) => token.address !== nextTokenIn?.address,
        ) ??
        null;
      setBalancedIntentTokenIn(nextTokenIn?.address ?? "");
      setBalancedIntentTokenOut(nextTokenOut?.address ?? "");
    } catch (e) {
      setBalancedIntentSurfaceError(
        e instanceof Error ? e.message : "Failed to load SODAX token catalog.",
      );
    } finally {
      setBalancedIntentSurfaceBusy(false);
    }
  };

  const requestBalancedIntentQuoteSurface = async (): Promise<void> => {
    try {
      if (!balancedIntentActionStates.quote.enabled) {
        throw new Error(balancedIntentActionStates.quote.reason);
      }
      setBalancedIntentSurfaceBusy(true);
      setBalancedIntentSurfaceError("");
      const result = await requestBalancedIntentQuote({
        tokenIn: balancedIntentTokenIn,
        tokenOut: balancedIntentTokenOut,
        amountInBase: balancedIntentAmountInBase,
      });
      setBalancedIntentQuote(result);
      if (result.ok) {
        setBalancedIntentMinOutputInput(
          baseUnitsToDecimalTokenAmount(result.quotedAmountBase, result.tokenOut.decimals),
        );
      }
    } catch (e) {
      setBalancedIntentSurfaceError(
        e instanceof Error ? e.message : "Failed to request SODAX quote.",
      );
    } finally {
      setBalancedIntentSurfaceBusy(false);
    }
  };

  const requestBalancedIntentBuildSurface = async (): Promise<void> => {
    try {
      if (!balancedIntentActionStates.build.enabled) {
        throw new Error(balancedIntentActionStates.build.reason);
      }
      if (!pubKey) throw new Error("Connect a Stellar wallet first.");
      setBalancedIntentSurfaceBusy(true);
      setBalancedIntentSurfaceError("");
      const result = await requestBalancedIntentBuild({
        tokenIn: balancedIntentTokenIn,
        tokenOut: balancedIntentTokenOut,
        amountInBase: balancedIntentAmountInBase,
        minOutputAmountBase: balancedIntentMinOutputAmountBase,
        sourceAccount: pubKey,
        destinationAccount: pubKey,
      });
      setBalancedIntentBuild(result);
      setBalancedIntentRelay(null);
      setBalancedIntentSubmit(null);
      if (result.ok) {
        setBalancedIntentExpiry({
          ok: true,
          provider: "sodax_sdk",
          intentTxHash: null,
          intent: result.intent,
          expiry: result.expiry,
        });
      }
    } catch (e) {
      setBalancedIntentSurfaceError(
        e instanceof Error ? e.message : "Failed to build SODAX intent.",
      );
    } finally {
      setBalancedIntentSurfaceBusy(false);
    }
  };

  const signBalancedIntentBuildSurface = async (): Promise<void> => {
    try {
      if (!balancedIntentBuild?.ok) {
        throw new Error("Build a SODAX intent before signing.");
      }
      if (!canAct) throw new Error("Connect a Stellar wallet first.");
      setBalancedIntentSurfaceBusy(true);
      setBalancedIntentSurfaceError("");
      const hash = await execTx(
        balancedIntentBuild.rawTransaction.xdr,
        "Submitting SODAX intent source transaction...",
      );
      setBalancedIntentSourceTxHash(hash);
    } catch (e) {
      setBalancedIntentSurfaceError(
        e instanceof Error
          ? e.message
          : "Failed to sign and submit SODAX intent.",
      );
    } finally {
      setBalancedIntentSurfaceBusy(false);
    }
  };

  const requestBalancedIntentRelaySurface = async (): Promise<void> => {
    try {
      if (!balancedIntentActionStates.relay.enabled) {
        throw new Error(balancedIntentActionStates.relay.reason);
      }
      setBalancedIntentSurfaceBusy(true);
      setBalancedIntentSurfaceError("");
      const result = await requestBalancedIntentRelay({
        sourceTxHash: balancedIntentSourceTxHash.trim(),
      });
      setBalancedIntentRelay(result);
      if (result.ok && result.canonicalIntentTxHash) {
        setBalancedIntentStatusHash(result.canonicalIntentTxHash);
        setBalancedIntentSubmit(null);
        setBalancedIntentStatus(null);
        setBalancedIntentConfirm(null);
        setBalancedIntentReceipt(null);
      }
    } catch (e) {
      setBalancedIntentSurfaceError(
        e instanceof Error
          ? e.message
          : "Failed to relay SODAX source transaction hash.",
      );
    } finally {
      setBalancedIntentSurfaceBusy(false);
    }
  };

  const requestBalancedIntentSubmitSurface = async (): Promise<void> => {
    try {
      if (!balancedIntentActionStates.submit.enabled) {
        throw new Error(balancedIntentActionStates.submit.reason);
      }
      setBalancedIntentSurfaceBusy(true);
      setBalancedIntentSurfaceError("");
      const result = await requestBalancedIntentSubmit({
        intentTxHash: balancedIntentStatusHash.trim(),
      });
      setBalancedIntentSubmit(result);
    } catch (e) {
      setBalancedIntentSurfaceError(
        e instanceof Error
          ? e.message
          : "Failed to submit SODAX post-execution notification.",
      );
    } finally {
      setBalancedIntentSurfaceBusy(false);
    }
  };

  const requestBalancedIntentStatusSurface = async (): Promise<void> => {
    try {
      if (!balancedIntentActionStates.status.enabled) {
        throw new Error(balancedIntentActionStates.status.reason);
      }
      setBalancedIntentSurfaceBusy(true);
      setBalancedIntentSurfaceError("");
      const result = await requestBalancedIntentStatus({
        intentTxHash: balancedIntentStatusHash.trim(),
      });
      setBalancedIntentStatus(result);
    } catch (e) {
      setBalancedIntentSurfaceError(
        e instanceof Error
          ? e.message
          : "Failed to request SODAX intent status.",
      );
    } finally {
      setBalancedIntentSurfaceBusy(false);
    }
  };

  const requestBalancedIntentReceiptSurface = async (): Promise<void> => {
    try {
      if (!balancedIntentActionStates.receipt.enabled) {
        throw new Error(balancedIntentActionStates.receipt.reason);
      }
      setBalancedIntentSurfaceBusy(true);
      setBalancedIntentSurfaceError("");
      const result = await requestBalancedIntentReceipt({
        intentTxHash: balancedIntentStatusHash.trim(),
      });
      setBalancedIntentReceipt(result);
    } catch (e) {
      setBalancedIntentSurfaceError(
        e instanceof Error ? e.message : "Failed to request SODAX receipt.",
      );
    } finally {
      setBalancedIntentSurfaceBusy(false);
    }
  };

  const requestBalancedIntentExpirySurface = async (): Promise<void> => {
    try {
      if (!balancedIntentActionStates.expiry.enabled && !balancedIntentBuild?.ok) {
        throw new Error(balancedIntentActionStates.expiry.reason);
      }
      setBalancedIntentSurfaceBusy(true);
      setBalancedIntentSurfaceError("");
      const result = await requestBalancedIntentExpiry(
        balancedIntentStatusHash.trim()
          ? { intentTxHash: balancedIntentStatusHash.trim() }
          : balancedIntentBuild?.ok
            ? { intent: balancedIntentBuild.intent }
            : {},
      );
      setBalancedIntentExpiry(result);
    } catch (e) {
      setBalancedIntentSurfaceError(
        e instanceof Error ? e.message : "Failed to request SODAX expiry.",
      );
    } finally {
      setBalancedIntentSurfaceBusy(false);
    }
  };

  const requestBalancedIntentRefundSurface = async (): Promise<void> => {
    try {
      if (!balancedIntentActionStates.refund.enabled) {
        throw new Error(balancedIntentActionStates.refund.reason);
      }
      if (!pubKey) throw new Error("Connect a Stellar wallet first.");
      setBalancedIntentSurfaceBusy(true);
      setBalancedIntentSurfaceError("");
      const result = await requestBalancedIntentRefund({
        sourceAccount: pubKey,
        ...(balancedIntentStatusHash.trim()
          ? { intentTxHash: balancedIntentStatusHash.trim() }
          : balancedIntentBuild?.ok
            ? { intent: balancedIntentBuild.intent }
            : {}),
      });
      setBalancedIntentRefund(result);
    } catch (e) {
      setBalancedIntentSurfaceError(
        e instanceof Error ? e.message : "Failed to build SODAX refund.",
      );
    } finally {
      setBalancedIntentSurfaceBusy(false);
    }
  };

  const signBalancedIntentRefundSurface = async (): Promise<void> => {
    try {
      if (!balancedIntentRefund?.ok) {
        throw new Error("Build a SODAX refund transaction before signing.");
      }
      if (!canAct) throw new Error("Connect a Stellar wallet first.");
      setBalancedIntentSurfaceBusy(true);
      setBalancedIntentSurfaceError("");
      await execTx(
        balancedIntentRefund.rawTransaction.xdr,
        "Submitting SODAX refund transaction...",
      );
    } catch (e) {
      setBalancedIntentSurfaceError(
        e instanceof Error
          ? e.message
          : "Failed to sign and submit SODAX refund.",
      );
    } finally {
      setBalancedIntentSurfaceBusy(false);
    }
  };

  const requestBalancedIntentConfirmSurface = async (): Promise<void> => {
    const normalizedHash = balancedIntentStatusHash.trim();
    try {
      if (!balancedIntentActionStates.confirmation.enabled) {
        throw new Error(balancedIntentActionStates.confirmation.reason);
      }
      setBalancedIntentSurfaceBusy(true);
      setBalancedIntentSurfaceError("");
      const result = await requestBalancedIntentConfirm({
        intentTxHash: normalizedHash,
      });
      setBalancedIntentConfirm(result);
    } catch (e) {
      const message =
        e instanceof Error
          ? e.message
          : "Failed to request SODAX confirmation.";
      setBalancedIntentConfirm({
        ok: false,
        provider: "sodax_sdk",
        intentTxHash: normalizedHash || "n/a",
        code: -1,
        message,
      });
      setBalancedIntentSurfaceError(message);
    } finally {
      setBalancedIntentSurfaceBusy(false);
    }
  };

  return (
    <main
      className="surface-stack integrations-fidelity-shell"
      data-testid={
        operatorSurface
          ? "integrations-operator-surface"
          : "integrations-public-surface"
      }
    >
      <header className="surface-stage-header">
        <span className="surface-eyebrow">Protocols</span>
        <h1 className="surface-title">
          {operatorSurface ? "Integrations operator" : "Integrations"}
        </h1>
        <p className="surface-description">
          {operatorSurface
            ? integrationAccessModel.operatorSummary
            : integrationAccessModel.publicSummary}
        </p>
      </header>
      <section
        className="integrations-product-catalog"
        data-testid="integrations-product-catalog"
        aria-label="Supported protocols"
      >
        <div className="integrations-product-catalog-head">
          <div>
            <span className="surface-eyebrow">Supported protocols</span>
            <h2>Protocols</h2>
          </div>
          <p>Manage protocols from your Arka. These checks are not a quote, a successful transaction or a guarantee of liquidity.</p>
        </div>
        <div className="ops-action-row ux-protocol-checks">
          <p role="status" className="surface-note" data-testid="integrations-public-check-status">{protocolChecks === "loading" ? "Checking protocol connections…" : protocolChecks === "error" ? "Connections could not be verified. No availability is assumed." : "Connection checks complete. Each fund, asset pair and amount needs its own checks."}</p>
          <button type="button" className="surface-button surface-button-secondary" disabled={protocolChecks === "loading"} onClick={() => void refresh()}>Refresh protocol checks</button>
        </div>
        <div
          className="integrations-product-card-grid"
          data-testid="integrations-product-card-grid"
        >
          {integrationProtocolCatalogCards.map((card) => (
            (() => {
              const brandAsset = integrationFigmaBrandAsset(card.id);

              return (
                <article
                  key={card.id}
                  className={`integrations-product-card integrations-product-card-${protocolChecks === "ready" ? card.statusTone : "neutral"}`}
                  data-testid={`integrations-product-card-${card.id.toLowerCase()}`}
                >
                  <div className="integrations-product-card-top">
                    <span
                      className={`integrations-product-brand integrations-product-brand-${card.id.toLowerCase()} ${
                        brandAsset ? "integrations-product-brand-has-asset" : ""
                      }`}
                      aria-hidden="true"
                      data-testid={`integrations-product-card-${card.id.toLowerCase()}-brand`}
                    >
                      {brandAsset ? (
                        <>
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={brandAsset}
                            alt=""
                            className="integrations-product-brand-asset"
                            data-testid={`integrations-product-card-${card.id.toLowerCase()}-asset`}
                            onError={(event) => {
                              event.currentTarget.style.display = "none";
                              const fallback =
                                event.currentTarget.nextElementSibling;
                              if (fallback instanceof HTMLElement) {
                                fallback.hidden = false;
                              }
                            }}
                          />
                          <span
                            className="integrations-product-brand-fallback"
                            hidden
                          >
                            {card.brandLabel}
                          </span>
                        </>
                      ) : (
                        card.brandLabel
                      )}
                    </span>
                    <StatusPill label={protocolChecks === "loading" ? "Checking…" : protocolChecks === "error" ? "Not verified" : card.postureLabel} tone={protocolChecks !== "ready" ? "neutral" : card.statusTone} />
                  </div>
                  <div className="integrations-product-card-copy">
                    <span>{card.eyebrow}</span>
                    <strong>{card.title}</strong>
                    <p>{protocolChecks === "loading" ? "Waiting for connection checks. No availability is assumed yet." : protocolChecks === "error" ? "Try refreshing the connection checks." : card.detail}</p>
                    {protocolChecks === "ready" && card.capability ? <small>{card.capability}</small> : null}
                  </div>
                  <div className="integrations-product-card-footer">
                    {card.href ? (
                      <Link
                        href={card.href}
                        className="surface-table-link integrations-product-card-action"
                        data-testid={`integrations-product-card-${card.id.toLowerCase()}-link`}
                      >
                        {card.ctaLabel}
                      </Link>
                    ) : operatorSurface ? (
                      <button
                        type="button"
                        className="surface-button surface-button-secondary integrations-product-card-action"
                        aria-controls={`integrations-workspace-panel-${card.workspace}`}
                        onClick={() => setActiveWorkspace(card.workspace)}
                        data-testid={`integrations-product-card-${card.id.toLowerCase()}-button`}
                      >
                        {card.ctaLabel}
                      </button>
                    ) : (
                      <Link
                        href={`${integrationAccessModel.operatorRoute}?workspace=${card.workspace}`}
                        className="surface-table-link integrations-product-card-action"
                        data-testid={`integrations-product-card-${card.id.toLowerCase()}-operator-link`}
                      >
                        Review status
                      </Link>
                    )}
                  </div>
                </article>
              );
            })()
          ))}
        </div>
        <section className="ux-sodax-explainer" aria-labelledby="sodax-how-it-works" data-testid="integrations-sodax-explainer">
          <h2 id="sodax-how-it-works">How Balanced / SODAX swaps work</h2>
          <p>SODAX uses an intent: an order describing what the fund pays and the minimum it must receive. A connection check alone does not mean this route is available for your fund.</p>
          <ol>
            <li><strong>Get a live quote.</strong> Check the assets, amount and minimum received.</li>
            <li><strong>Review and sign.</strong> Only the fund manager can authorize an order.</li>
            <li><strong>Wait for settlement.</strong> An accepted or submitted order is not a completed swap. Confirm delivery before treating it as complete.</li>
          </ol>
          <p>If an order expires or fails, check its status and refund eligibility; do not resubmit blindly. Fees, delays and refund conditions depend on the route.</p>
          <Link className="surface-button surface-button-secondary" href="/manage">Choose a fund I manage</Link>
        </section>
      </section>
      {operatorSurface ? <section
        className="public-figma-metric-deck integrations-public-metric-deck"
        data-testid="integrations-public-metric-deck"
        aria-label="Integration metrics"
      >
        {integrationPublicMetricTiles.map((tile) => (
          <article
            key={tile.id}
            className={`public-figma-metric-card public-figma-metric-card-${tile.tone} public-figma-metric-card-${tile.id}`}
            data-testid={integrationPublicMetricTestId(tile)}
          >
            <div className="public-figma-metric-head">
              <span className="public-figma-metric-icon" aria-hidden="true" />
              <strong>{tile.label}</strong>
            </div>
            <div className="public-figma-metric-value">{tile.value}</div>
            <p className="public-figma-metric-detail">{tile.detail}</p>
          </article>
        ))}
      </section> : null}
      {operatorSurface ? (
        <section
          className="integrations-protocol-visual"
          data-testid="integrations-protocol-visual"
          aria-label="Protocol readiness constellation"
        >
          <div className="integrations-protocol-copy">
            <span className="surface-eyebrow">Validated venue map</span>
            <h2>
              {loadedRoutes}/{integrationWorkspaceSnapshot.totalRoutes} adapter reads returned
            </h2>
            <p>
              Adapter readability, manager-reviewed actions and AUTO eligibility are reported
              separately so operator review never implies unsupported execution.
            </p>
            <div className="integrations-protocol-stats">
              <span>{autoVenueCount} AUTO-ready</span>
              <span>{admittedVenueCount} admitted venues</span>
              <span>{walletLabel}</span>
            </div>
          </div>
          <div className="integrations-protocol-orbit">
            <span>Planner</span>
            <strong>{autoVenueCount}/{integrationProtocolVisualNodes.length}</strong>
            <small>AUTO-ready venues</small>
          </div>
          <div className="integrations-protocol-nodes">
            {integrationProtocolVisualNodes.map((node) => (
              <article
                key={node.id}
                className={`integrations-protocol-node integrations-protocol-node-${node.tone}`}
                data-testid={`integrations-protocol-node-${node.id.toLowerCase()}`}
              >
                <div>
                  <span>{node.family}</span>
                  <strong>{node.title}</strong>
                </div>
                <StatusPill label={node.status} tone={node.tone} />
                <small>
                  {node.reason}
                </small>
              </article>
            ))}
          </div>
        </section>
      ) : null}
      {operatorSurface ? (
        <>
          <nav
            className="surface-section-tabs integrations-workspace-tabs"
            aria-label="Integration sections"
            data-testid="integrations-workspace-tabs"
          >
            {INTEGRATION_WORKSPACE_TABS.map((tab) => (
              <button
                key={tab.id}
                type="button"
                className={`surface-tab ${
                  activeWorkspace === tab.id ? "surface-tab-active" : ""
                }`}
                aria-pressed={activeWorkspace === tab.id}
                aria-controls={`integrations-workspace-panel-${tab.id}`}
                onClick={() => setActiveWorkspace(tab.id)}
                data-testid={`integrations-workspace-tab-${tab.id}`}
              >
                <span>{tab.label}</span>
                <small>{tab.eyebrow}</small>
              </button>
            ))}
          </nav>
          <section
            className="integrations-workspace-summary"
            id={`integrations-workspace-panel-${activeWorkspace}`}
            data-testid="integrations-workspace-summary"
          >
            <div className="integrations-workspace-summary-copy">
              <span className="surface-eyebrow">
                {integrationWorkspaceState.tab.eyebrow}
              </span>
              <strong>{integrationWorkspaceState.tab.label}</strong>
              <p>{integrationWorkspaceState.tab.description}</p>
            </div>
            <div
              className="integrations-workspace-summary-grid"
              data-testid="integrations-workspace-summary-grid"
            >
              {integrationWorkspaceState.signals.map((signal) => (
                <article
                  key={signal.id}
                  className={`surface-signal-card workflow-signal-card integrations-workspace-signal integrations-workspace-signal-${signal.tone}`}
                >
                  <span className="workflow-signal-label">{signal.label}</span>
                  <strong className="workflow-signal-value">
                    {signal.value}
                  </strong>
                  <span className="workflow-signal-detail">
                    {signal.detail}
                  </span>
                </article>
              ))}
            </div>
          </section>
          <section
            className="integrations-command-deck integrations-command-deck-cutover"
            aria-label="Protocol actions"
            data-testid="integrations-command-deck"
          >
            {integrationProtocolCommands.map((command) => (
              <article
                key={command.id}
                className={`integrations-command-card integrations-command-card-${command.tone}`}
                data-testid={`integrations-command-${command.id}`}
              >
                <div className="integrations-command-copy">
                  <span className="surface-list-label">{command.label}</span>
                  <strong>{command.title}</strong>
                  <span className="integrations-command-value">
                    {command.value}
                  </span>
                  <p>{command.detail}</p>
                </div>
                {command.href ? (
                  <Link
                    href={command.href}
                    className="surface-table-link integrations-command-action"
                    data-testid={`integrations-command-${command.id}-link`}
                  >
                    {command.ctaLabel}
                  </Link>
                ) : (
                  <button
                    type="button"
                    className="surface-button surface-button-secondary integrations-command-action"
                    aria-controls={`integrations-workspace-panel-${command.workspace}`}
                    onClick={() => setActiveWorkspace(command.workspace)}
                    data-testid={`integrations-command-${command.id}-button`}
                  >
                    {command.ctaLabel}
                  </button>
                )}
              </article>
            ))}
          </section>
        </>
      ) : null}
      {operatorSurface && activeWorkspace === "routing" ? (
        <Panel
          id="integrations-routing"
          title="Adapter routing"
          subtitle="Supported protocol surface and operator lanes"
          testId="integrations-routing-panel"
          className="integrations-workspace-frame-cutover integrations-routing-frame-cutover"
        >
          <div className="surface-chip-wrap integrations-stage-tabs">
            <StatusPill label="Balanced" tone="positive" />
            <StatusPill label="Blend" tone="positive" />
            <StatusPill label="SoroSwap" tone="neutral" />
            <StatusPill label="Aquarius" tone="neutral" />
            <StatusPill label="Sushi" tone="neutral" />
          </div>

          <div className="integrations-card-grid">
            {showcaseCards.map((card) => (
              <article
                key={card.id}
                className="surface-entry-card integrations-showcase-card"
              >
                <div className="surface-table-hint">{card.eyebrow}</div>
                <div className="surface-entry-title">{card.title}</div>
                <div className="surface-note">{card.detail}</div>
                <div className="surface-table-actions">
                  <StatusPill label={card.statusLabel} tone={card.statusTone} />
                </div>
              </article>
            ))}
          </div>

          <nav
            className="surface-section-tabs integrations-routing-view-tabs"
            aria-label="Routing detail views"
            data-testid="integrations-routing-view-tabs"
          >
            {INTEGRATION_ROUTING_VIEW_TABS.map((tab) => (
              <button
                key={tab.id}
                type="button"
                className={`surface-tab ${
                  routingView === tab.id ? "surface-tab-active" : ""
                }`}
                aria-pressed={routingView === tab.id}
                onClick={() => setRoutingView(tab.id)}
                data-testid={`integrations-routing-view-${tab.id}`}
              >
                <span>{tab.label}</span>
                <small>{tab.eyebrow}</small>
              </button>
            ))}
          </nav>

          {routingView === "adapters" ? (
            <SurfaceTable
              columnsClassName="integrations-routing-table"
              headers={[
                "Adapter",
                "Configured route",
                "Observed route",
                "Route status",
              ]}
              testId="integrations-routing-table"
              className="integrations-routing-table integrations-routing-table-cutover"
            >
              {[
                {
                  id: "balanced",
                  adapter: "Balanced adapter",
                  adapterId: ADAPTER_BALANCED,
                  configured:
                    balancedSupport.expectedRouter ||
                    `status: ${balancedSupport.supportStatus} (${balancedSupport.laneMode})`,
                  observed: balancedRouter,
                  observedDetail: balancedRouter
                    ? "Adapter router() returned a value."
                    : "Balanced remains governed by its readiness manifest.",
                  planner: "Intent route",
                  plannerDetail: "Balanced uses SODAX Intents rather than a classic AMM swap route.",
                },
                {
                  id: "aquarius",
                  adapter: "Aquarius adapter",
                  adapterId: AQUARIUS_ADAPTER,
                  configured: AQUARIUS_ROUTER,
                  observed: aquariusRouter,
                  observedDetail: aquariusAdapterDetail,
                  planner: aquariusPlannerReady ? "ready" : "blocked",
                  plannerDetail: aquariusPlannerDetail,
                },
                {
                  id: "soroswap",
                  adapter: "SoroSwap adapter",
                  adapterId: SOROSWAP_ADAPTER,
                  configured: SOROSWAP_ROUTER,
                  observed: soroswapRouter,
                  observedDetail: soroswapAdapterDetail,
                  planner: soroswapPlannerReady ? "ready" : "blocked",
                  plannerDetail: soroswapPlannerDetail,
                },
                {
                  id: "sushi",
                  adapter: "Sushi adapter",
                  adapterId: SUSHI_ADAPTER || "not configured",
	                  configured:
	                    SUSHI_POOL_ROUTING_PAIR ||
	                    `pool id ${SUSHI_POOL_ID} not configured`,
                  observed: sushiPoolRoute,
                  observedDetail: sushiAdapterDetail,
                  planner: sushiPlannerReady ? "ready" : "blocked",
                  plannerDetail: sushiPlannerDetail,
                },
                {
                  id: "blend",
                  adapter: "Blend adapter",
                  adapterId: ADAPTER_BLEND,
                  configured: BLEND_POOL_REAL,
                  observed: blendRouter,
                  observedDetail: blendRouter
                    ? "Blend adapter exposes the configured market router."
                    : "Blend adapter router health is unavailable.",
                  planner: "credit",
                  plannerDetail: "Blend is a credit command venue and stays outside swap quote comparison.",
                },
              ].map((entry) => (
                <div
                  key={entry.id}
                  className="surface-table-row integrations-routing-table integrations-routing-row-cutover"
                >
                  <div className="surface-table-cell surface-table-cell-stack">
                    <strong className="surface-table-cell-strong">
                      {entry.adapter}
                    </strong>
                    <span className="surface-table-subtle ops-mono">
                      {entry.adapterId}
                    </span>
                  </div>
                  <div className="surface-table-cell ops-mono">
                    {entry.configured}
                  </div>
                  <div className="surface-table-cell surface-table-cell-stack">
                    <strong className="surface-table-cell-strong ops-mono">
                      {entry.observed ?? "n/a"}
                    </strong>
                    <span className="surface-table-subtle">
                      {entry.observedDetail}
                    </span>
                  </div>
                  <div className="surface-table-cell surface-table-cell-stack">
                    <strong className="surface-table-cell-strong">
                      {entry.planner}
                    </strong>
                    <span className="surface-table-subtle">
                      {entry.plannerDetail}
                    </span>
                  </div>
                </div>
              ))}
            </SurfaceTable>
          ) : null}

          {routingView === "venues" ? (
            <SurfaceTable
              columnsClassName="integrations-routing-table"
              headers={["Venue", "Family", "Execution semantics"]}
              testId="integrations-venue-model-table"
              className="integrations-routing-table integrations-routing-table-cutover"
            >
              {executionVenues.map((venue) => (
                <div
                  key={venue.id}
                  className="surface-table-row integrations-routing-table integrations-routing-row-cutover"
                >
                  <div className="surface-table-cell surface-table-cell-stack">
                    <strong className="surface-table-cell-strong">
                      {venue.title}
                    </strong>
                    <span className="surface-table-subtle">
                      {venue.statusLabel} ·{" "}
                      {venue.autoRoutingEligible
                        ? "AUTO"
                        : venue.manualExecutionEligible
                          ? "Manual"
                          : "Blocked"}
                    </span>
                  </div>
                  <div className="surface-table-cell surface-table-cell-stack">
                    <strong className="surface-table-cell-strong">
                      {formatExecutionVenueFamilyLabel(venue.family)}
                    </strong>
                    <span className="surface-table-subtle">
                      {formatExecutionVenuePathModelLabel(venue.pathModel)}
                    </span>
                  </div>
                  <div className="surface-table-cell surface-table-cell-stack">
                    <strong className="surface-table-cell-strong">
                      {formatExecutionVenueQuoteModelLabel(venue.quoteModel)} ·{" "}
                      {formatExecutionVenueSettlementModelLabel(
                        venue.settlementModel,
                      )}
                    </strong>
                    <span className="surface-table-subtle">
                      {formatExecutionVenueConfirmationModelLabel(
                        venue.confirmationModel,
                      )}{" "}
                      ·{" "}
                      {formatExecutionVenuePlannerAdmissionLabel(
                        venue.plannerAdmission,
                      )}
                    </span>
                    <span className="surface-table-subtle">
                      {venue.capabilityDetail}
                    </span>
                  </div>
                </div>
              ))}
            </SurfaceTable>
          ) : null}

          {routingView === "balanced" ? (
            <>
              <SurfaceTable
            columnsClassName="integrations-routing-table"
	            headers={["Official source", "Capability state", "Best-execution status"]}
            testId="integrations-intent-source-table"
            className="integrations-routing-table integrations-routing-table-cutover"
          >
            <div className="surface-table-row integrations-routing-table integrations-routing-row-cutover">
              <div className="surface-table-cell surface-table-cell-stack">
                <strong className="surface-table-cell-strong">
                  {balancedSourceAdapter.title}
                </strong>
                <span className="surface-table-subtle">
                  {formatIntentVenueSourceStatusLabel(
                    balancedSourceAdapter.sourceStatus,
                  )}{" "}
                  official source
                </span>
              </div>
              <div className="surface-table-cell surface-table-cell-stack">
                <strong className="surface-table-cell-strong">
                  Discovery{" "}
                  {formatIntentVenueCapabilityStateLabel(
                    balancedSourceAdapter.discoveryState,
                  )}{" "}
                  · Quote{" "}
                  {formatIntentVenueCapabilityStateLabel(
                    balancedSourceAdapter.quoteState,
                  )}
                </strong>
                <span className="surface-table-subtle">
                  Execute{" "}
                  {formatIntentVenueCapabilityStateLabel(
                    balancedSourceAdapter.executionState,
                  )}{" "}
                  · Confirm{" "}
                  {formatIntentVenueCapabilityStateLabel(
                    balancedSourceAdapter.confirmationState,
                  )}
                </span>
              </div>
              <div className="surface-table-cell surface-table-cell-stack">
                <strong className="surface-table-cell-strong">
                  {balancedSourceAdapter.summary}
                </strong>
	                <span className="surface-table-subtle">
	                  {balancedSupport.intentVenue.plannerAdmission === "auto"
	                    ? "Available for best-execution comparison when quote and completion checks are live."
	                    : "Review manually until quote and completion checks are comparable with AMM routes."}
	                </span>
              </div>
            </div>
          </SurfaceTable>
          <SurfaceTable
            columnsClassName="integrations-routing-table"
            headers={[
	              "Intent execution",
	              "Quote / execute / confirm",
	              "Execution status",
            ]}
            testId="integrations-intent-driver-table"
            className="integrations-routing-table integrations-routing-table-cutover"
          >
            <div className="surface-table-row integrations-routing-table integrations-routing-row-cutover">
              <div className="surface-table-cell surface-table-cell-stack">
                <strong className="surface-table-cell-strong">
                  {balancedIntentDriver.title}
                </strong>
                <span className="surface-table-subtle">
	                  {formatExecutionVenuePlannerAdmissionLabel(
	                    balancedIntentDriver.plannerAdmission,
	                  )}{" "}
	                  best-execution status
                </span>
              </div>
              <div className="surface-table-cell surface-table-cell-stack">
                <strong className="surface-table-cell-strong">
                  {formatIntentExecutionDriverQuoteCapabilityLabel(
                    balancedIntentDriver.quoteCapability,
                  )}{" "}
                  ·{" "}
                  {formatIntentExecutionDriverExecutionCapabilityLabel(
                    balancedIntentDriver.executionCapability,
                  )}
                </strong>
                <span className="surface-table-subtle">
                  {formatIntentExecutionDriverConfirmationCapabilityLabel(
                    balancedIntentDriver.confirmationCapability,
                  )}
                </span>
              </div>
              <div className="surface-table-cell surface-table-cell-stack">
                <strong className="surface-table-cell-strong">
                  {balancedIntentDriver.summary}
                </strong>
	                <span className="surface-table-subtle">
	                  {balancedIntentDriver.comparableQuote
	                    ? "Quote and status are available for route review."
	                    : "Manual review only until quotes and completion checks are comparable."}
	                </span>
              </div>
            </div>
          </SurfaceTable>
          <SurfaceTable
            columnsClassName="integrations-routing-table"
            headers={[
              "Intent setup",
              "Execution route",
              "Readiness checks",
            ]}
            testId="integrations-intent-handoff-table"
            className="integrations-routing-table integrations-routing-table-cutover"
          >
            <div className="surface-table-row integrations-routing-table integrations-routing-row-cutover">
              <div className="surface-table-cell surface-table-cell-stack">
                <strong className="surface-table-cell-strong">
                  {balancedIntentHandoff.title}
                </strong>
                <span className="surface-table-subtle">
                  {formatIntentExecutionHandoffPostureLabel(
                    balancedIntentHandoff.posture,
                  )}
                </span>
              </div>
              <div className="surface-table-cell surface-table-cell-stack">
                <strong className="surface-table-cell-strong">
                  {balancedIntentHandoff.operatorRoute}
                </strong>
                <span className="surface-table-subtle">
                  {balancedIntentHandoff.routeContext}
                </span>
              </div>
              <div className="surface-table-cell surface-table-cell-stack">
                <strong className="surface-table-cell-strong">
                  {balancedIntentHandoff.steps
                    .map(
                      (step) =>
                        `${step.label}: ${formatIntentExecutionHandoffStepStateLabel(step.state)}`,
                    )
                    .join(" · ")}
                </strong>
                <span className="surface-table-subtle">
                  {balancedIntentHandoff.summary}
                </span>
              </div>
            </div>
          </SurfaceTable>
            </>
          ) : null}
        </Panel>
      ) : null}
      {operatorSurface && activeWorkspace === "sodax" ? (
        <Panel
          id="integrations-sodax"
          title="Balanced / SODAX public surface"
          subtitle="Machine-consumable quote, intent lifecycle and refund controls"
          testId="integrations-sodax-panel"
          className="integrations-workspace-frame-cutover integrations-sodax-frame-cutover"
        >
          <div
            className="surface-entry-card integrations-balanced-intent-card-cutover"
            data-testid="integrations-balanced-intent-surface-panel"
          >
            <div className="surface-entry-head">
              <div>
                <div className="surface-entry-title">
                  Balanced / SODAX public surface
                </div>
                <div className="surface-note">
                  Arka now consumes the public SODAX SDK surface for Stellar
                  token discovery, live quote retrieval, raw intent build,
                  relay submission, status, receipt, expiry and refund
                  recovery.
                </div>
              </div>
              <StatusPill
	                label={
	                  balancedSupport.officialSurface.intentAdapter
	                    .publicQuoteEndpoint
	                    ? "Public surface wired"
	                    : "Connection needed"
                }
                tone={
                  balancedSupport.officialSurface.intentAdapter
                    .publicQuoteEndpoint
                    ? "positive"
                    : "warning"
                }
              />
            </div>
            <div className="surface-note">
              Quote: {balancedIntentSurfaceEndpointSummary.quote} · Build:{" "}
              {balancedIntentSurfaceEndpointSummary.build} · Relay:{" "}
              {balancedIntentSurfaceEndpointSummary.relay} · Status:{" "}
              {balancedIntentSurfaceEndpointSummary.status} · Receipt:{" "}
              {balancedIntentSurfaceEndpointSummary.receipt} · Refund:{" "}
              {balancedIntentSurfaceEndpointSummary.refund}
            </div>
            <div className="ops-action-row integrations-intent-actions-cutover">
              <button
                type="button"
                onClick={() => void loadBalancedIntentSurface()}
                className="surface-button surface-button-secondary"
                data-testid="integrations-balanced-intent-load-button"
                disabled={balancedIntentSurfaceBusy}
              >
                Load SODAX token catalog
              </button>
            </div>
            <div className="ops-form-grid integrations-intent-form-cutover">
              <label className="ops-field">
                <span className="ops-field-label">Token in</span>
                <select
                  value={balancedIntentTokenIn}
                  onChange={(event) =>
                    setBalancedIntentTokenIn(event.target.value)
                  }
                  className="ops-input"
                  data-testid="integrations-balanced-intent-token-in"
                >
                  <option value="">Select token</option>
                  {balancedIntentTokens.map((token) => (
                    <option key={token.address} value={token.address}>
                      {token.symbol} · {token.address}
                    </option>
                  ))}
                </select>
              </label>
              <label className="ops-field">
                <span className="ops-field-label">Token out</span>
                <select
                  value={balancedIntentTokenOut}
                  onChange={(event) =>
                    setBalancedIntentTokenOut(event.target.value)
                  }
                  className="ops-input"
                  data-testid="integrations-balanced-intent-token-out"
                >
                  <option value="">Select token</option>
                  {balancedIntentTokens.map((token) => (
                    <option key={token.address} value={token.address}>
                      {token.symbol} · {token.address}
                    </option>
                  ))}
                </select>
              </label>
              <label className="ops-field">
                <span className="ops-field-label">
                  Amount ({selectedBalancedIntentTokenIn?.symbol ?? "token"})
                </span>
                <input
                  value={balancedIntentAmountInput}
                  onChange={(event) =>
                    setBalancedIntentAmountInput(event.target.value)
                  }
                  className="ops-input"
                  inputMode="decimal"
                  data-testid="integrations-balanced-intent-amount"
                />
              </label>
              <label className="ops-field">
                <span className="ops-field-label">
                  Minimum out ({selectedBalancedIntentTokenOut?.symbol ?? "token"})
                </span>
                <input
                  value={balancedIntentMinOutputInput}
                  onChange={(event) =>
                    setBalancedIntentMinOutputInput(event.target.value)
                  }
                  className="ops-input"
                  inputMode="decimal"
                  data-testid="integrations-balanced-intent-min-out"
                />
              </label>
            </div>
            <div className="ops-action-row integrations-intent-actions-cutover">
              <button
                type="button"
                onClick={() => void requestBalancedIntentQuoteSurface()}
                className="surface-button surface-button-primary"
                data-testid="integrations-balanced-intent-quote-button"
                disabled={!balancedIntentActionStates.quote.enabled}
                title={balancedIntentActionStates.quote.reason}
              >
                Request official quote
              </button>
              <button
                type="button"
                onClick={() => void requestBalancedIntentBuildSurface()}
                className="surface-button surface-button-secondary"
                data-testid="integrations-balanced-intent-build-button"
                disabled={UX_REVIEW_PREVIEW || !balancedIntentActionStates.build.enabled}
                title={balancedIntentActionStates.build.reason}
              >
                Build intent XDR
              </button>
              <button
                type="button"
                onClick={() => void signBalancedIntentBuildSurface()}
                className="surface-button surface-button-secondary"
                data-testid="integrations-balanced-intent-sign-button"
                disabled={UX_REVIEW_PREVIEW || !balancedIntentBuild?.ok || !canAct}
              >
                Sign built intent
              </button>
            </div>
            <div
              className="surface-note"
              data-testid="integrations-balanced-intent-action-readiness"
            >
              Quote: {balancedIntentActionStates.quote.reason} · Build:{" "}
              {balancedIntentActionStates.build.reason} · Relay:{" "}
              {balancedIntentActionStates.relay.reason} · Refund:{" "}
              {balancedIntentActionStates.refund.reason}
            </div>
            <div
              className="surface-note"
              data-testid="integrations-balanced-intent-token-catalog"
            >
              {balancedIntentTokens.length > 0
                ? `Catalog loaded: ${balancedIntentTokens
                    .map((token) => token.symbol)
                    .join(", ")}`
                : "Catalog not loaded yet."}
            </div>
            <div
              className="surface-note"
              data-testid="integrations-balanced-intent-quote-result"
            >
              {balancedIntentQuote
                ? balancedIntentQuote.ok
                  ? `Quote ready · ${balancedIntentQuote.tokenIn.symbol} -> ${balancedIntentQuote.tokenOut.symbol} · in ${formatBalancedIntentQuoteAmount(balancedIntentQuote.amountInBase, balancedIntentQuote.tokenIn)} · out ${formatBalancedIntentQuoteAmount(balancedIntentQuote.quotedAmountBase, balancedIntentQuote.tokenOut)}`
                  : `Quote not available · ${balancedIntentQuote.message}`
                : "No quote requested yet."}
            </div>
            <div
              className="surface-note"
              data-testid="integrations-balanced-intent-build-result"
            >
              {balancedIntentBuild
                ? balancedIntentBuild.ok
	                  ? `Build OK · XDR ${balancedIntentBuild.rawTransaction.xdr.slice(0, 18)}... · intent ${balancedIntentBuild.intent.intentHash ?? "waiting"} · expiry ${balancedIntentBuild.expiry.expiresAt ?? "n/a"}`
                  : `Build unavailable · ${balancedIntentBuild.message}`
                : "No intent build requested yet."}
            </div>
            <div className="ops-form-grid integrations-intent-form-cutover">
              <label className="ops-field">
                <span className="ops-field-label">Source transaction hash</span>
                <input
                  value={balancedIntentSourceTxHash}
                  onChange={(event) =>
                    setBalancedIntentSourceTxHash(event.target.value)
                  }
                  className="ops-input"
                  data-testid="integrations-balanced-intent-source-hash-input"
                />
              </label>
              <label className="ops-field">
                <span className="ops-field-label">Delivered intent tx hash</span>
                <input
                  value={balancedIntentStatusHash}
                  onChange={(event) =>
                    setBalancedIntentStatusHash(event.target.value)
                  }
                  className="ops-input"
                  data-testid="integrations-balanced-intent-status-input"
                />
              </label>
            </div>
            <div className="ops-action-row integrations-intent-actions-cutover">
              <button
                type="button"
                onClick={() => void requestBalancedIntentRelaySurface()}
                className="surface-button surface-button-secondary"
                data-testid="integrations-balanced-intent-relay-button"
                disabled={UX_REVIEW_PREVIEW || !balancedIntentActionStates.relay.enabled}
                title={balancedIntentActionStates.relay.reason}
              >
                Relay source hash
              </button>
              <button
                type="button"
                onClick={() => void requestBalancedIntentSubmitSurface()}
                className="surface-button surface-button-secondary"
                data-testid="integrations-balanced-intent-submit-button"
                disabled={UX_REVIEW_PREVIEW || !balancedIntentActionStates.submit.enabled}
                title={balancedIntentActionStates.submit.reason}
              >
                Post execution
              </button>
              <button
                type="button"
                onClick={() => void requestBalancedIntentStatusSurface()}
                className="surface-button surface-button-secondary"
                data-testid="integrations-balanced-intent-status-button"
                disabled={!balancedIntentActionStates.status.enabled}
                title={balancedIntentActionStates.status.reason}
              >
                Check intent status
              </button>
              <button
                type="button"
                onClick={() => void requestBalancedIntentConfirmSurface()}
                className="surface-button surface-button-secondary"
                data-testid="integrations-balanced-intent-confirm-button"
                disabled={!balancedIntentActionStates.confirmation.enabled}
                title={balancedIntentActionStates.confirmation.reason}
              >
                Check confirmation
              </button>
              <button
                type="button"
                onClick={() => void requestBalancedIntentReceiptSurface()}
                className="surface-button surface-button-secondary"
                data-testid="integrations-balanced-intent-receipt-button"
                disabled={!balancedIntentActionStates.receipt.enabled}
                title={balancedIntentActionStates.receipt.reason}
              >
                Check receipt
              </button>
              <button
                type="button"
                onClick={() => void requestBalancedIntentExpirySurface()}
                className="surface-button surface-button-secondary"
                data-testid="integrations-balanced-intent-expiry-button"
                disabled={
                  !balancedIntentActionStates.expiry.enabled &&
                  !balancedIntentBuild?.ok
                }
                title={balancedIntentActionStates.expiry.reason}
              >
                Check expiry
              </button>
              <button
                type="button"
                onClick={() => void requestBalancedIntentRefundSurface()}
                className="surface-button surface-button-secondary"
                data-testid="integrations-balanced-intent-refund-button"
                disabled={UX_REVIEW_PREVIEW || !balancedIntentActionStates.refund.enabled}
                title={balancedIntentActionStates.refund.reason}
              >
                Build refund
              </button>
              <button
                type="button"
                onClick={() => void signBalancedIntentRefundSurface()}
                className="surface-button surface-button-secondary"
                data-testid="integrations-balanced-intent-refund-sign-button"
                disabled={UX_REVIEW_PREVIEW || !balancedIntentRefund?.ok || !canAct}
              >
                Sign refund
              </button>
            </div>
            <div
              className="surface-note"
              data-testid="integrations-balanced-intent-relay-result"
            >
              {balancedIntentRelay
                ? balancedIntentRelay.ok
                  ? `Relay ${balancedIntentRelay.success ? "accepted" : "returned"} · chain ${balancedIntentRelay.relayChainId} · intent ${balancedIntentRelay.canonicalIntentTxHash ?? "pending"} · ${balancedIntentRelay.message}`
                  : `Relay unavailable · ${balancedIntentRelay.message}`
                : "No relay submission requested yet."}
            </div>
            <div
              className="surface-note"
              data-testid="integrations-balanced-intent-submit-result"
            >
              {balancedIntentSubmit
                ? balancedIntentSubmit.ok
                  ? `Order accepted for tracking — settlement not confirmed · solver intent ${balancedIntentSubmit.solverIntentHash}`
	                  : `Post action waiting · ${balancedIntentSubmit.message}`
                : "No post-execution notification requested yet."}
            </div>
            <div
              className="surface-note"
              data-testid="integrations-balanced-intent-status-result"
            >
              {balancedIntentStatus
                ? balancedIntentStatus.ok
                  ? `Status ${balancedIntentStatus.statusLabel} · terminal ${balancedIntentStatus.terminal ? "yes" : "no"} · fill ${balancedIntentStatus.fillTxHash ?? "n/a"}`
                  : `Status unavailable · ${balancedIntentStatus.message}`
                : "No status lookup requested yet."}
            </div>
            <div
              className="surface-note"
              data-testid="integrations-balanced-intent-confirm-result"
            >
              {balancedIntentConfirm
                ? balancedIntentConfirm.ok
                  ? `Confirm ${balancedIntentConfirm.confirmationState} · confirmed ${balancedIntentConfirm.confirmed ? "yes" : "no"} · terminal ${balancedIntentConfirm.terminal ? "yes" : "no"} · tx ${balancedIntentConfirm.confirmationTxHash ?? "n/a"}`
                  : `Confirmation unavailable · ${balancedIntentConfirm.message}`
                : "No confirmation lookup requested yet."}
            </div>
            <div
              className="surface-note"
              data-testid="integrations-balanced-intent-receipt-result"
            >
              {balancedIntentReceipt
                ? balancedIntentReceipt.ok
                  ? `Receipt ${balancedIntentReceipt.receipt.receiptState} · fill ${balancedIntentReceipt.receipt.fillTxHash ?? "n/a"} · refund ${balancedIntentReceipt.refund.refundMode}`
                  : `Receipt unavailable · ${balancedIntentReceipt.message}`
                : "No receipt lookup requested yet."}
            </div>
            <div
              className="surface-note"
              data-testid="integrations-balanced-intent-expiry-result"
            >
              {balancedIntentExpiry
                ? balancedIntentExpiry.ok
                  ? `Expiry ${balancedIntentExpiry.expiry.expired ? "expired" : "active"} · ${balancedIntentExpiry.expiry.expiresAt ?? "unknown"} · ${balancedIntentExpiry.expiry.detail}`
                  : `Expiry unavailable · ${balancedIntentExpiry.message}`
                : "No expiry lookup requested yet."}
            </div>
            <div
              className="surface-note"
              data-testid="integrations-balanced-intent-refund-result"
            >
              {balancedIntentRefund
                ? balancedIntentRefund.ok
                  ? `Refund XDR ready · mode ${balancedIntentRefund.refund.refundMode} · available ${balancedIntentRefund.refund.refundAvailable ? "yes" : "no"}`
                  : `Refund unavailable · ${balancedIntentRefund.message}`
                : "No refund build requested yet."}
            </div>
            {balancedIntentSurfaceError ? (
              <div
                className="ops-status ops-status-error"
                role="alert"
                data-testid="integrations-balanced-intent-error"
              >
                {balancedIntentSurfaceError}
              </div>
            ) : null}
          </div>
        </Panel>
      ) : null}

      {operatorSurface && activeWorkspace === "execution" ? (
        <Panel
          id="integrations-execution"
          title="Execution posture"
          subtitle="Wallet state, router refresh and canonical launch points"
          testId="integrations-controls-panel"
          className="integrations-workspace-frame-cutover integrations-execution-frame-cutover"
        >
          <div className="surface-chip-wrap integrations-stage-tabs">
            <StatusPill label="Wallet" tone="neutral" />
            <StatusPill label="Route checks" tone="positive" />
          </div>
          <div className="workflow-signal-grid">
            {runtimeSignals.map((signal) => (
              <article
                key={signal.id}
                className="surface-signal-card workflow-signal-card"
              >
                <span className="workflow-signal-label">{signal.label}</span>
                <strong className="workflow-signal-value">
                  {signal.value}
                </strong>
                <span className="workflow-signal-detail">{signal.detail}</span>
              </article>
            ))}
          </div>
          <div
            className="surface-spotlight-grid integrations-control-grid"
            data-testid="integrations-controls-table"
          >
            <article className="surface-entry-card surface-spotlight-card integrations-control-card">
              <div className="surface-spotlight-head">
                <div>
                  <div className="surface-table-hint">Wallet</div>
                  <div className="surface-spotlight-title">
                    Execution signs through the connected wallet
                  </div>
                </div>
                {pubKey ? (
                  <StatusPill label="Connected" tone="positive" />
                ) : (
                  <StatusPill label="Offline" tone="warning" />
                )}
              </div>
              <div className="surface-list">
                <div className="surface-list-row">
                  <div>
                    <div className="surface-table-cell-strong">Wallet</div>
                    <div className="surface-table-subtle">
                      {pubKey
                        ? "Ready for live actions"
                        : "Connect before submitting"}
                    </div>
                  </div>
                  <strong className="surface-table-cell-strong ops-mono">
                    {walletLabel}
                  </strong>
                </div>
              </div>
              <div className="surface-spotlight-footer">
                {!pubKey ? (
                  <button
                    onClick={connect}
                    className="surface-button surface-button-primary"
                    data-testid="integrations-connect-button"
                  >
                    Connect wallet
                  </button>
                ) : (
                  <StatusPill label="Connected" tone="positive" />
                )}
              </div>
            </article>

            <article className="surface-entry-card surface-spotlight-card integrations-control-card">
              <div className="surface-spotlight-head">
                <div>
                  <div className="surface-table-hint">Checks</div>
                  <div className="surface-spotlight-title">
                    Router refresh posture
                  </div>
                </div>
                <StatusPill
	                  label={loadedRoutes > 0 ? "Loaded" : "Refresh needed"}
                  tone={loadedRoutes > 0 ? "positive" : "warning"}
                />
              </div>
              <div className="surface-list">
                <div className="surface-list-row">
                  <div>
                    <div className="surface-table-cell-strong">Checks</div>
                    <div className="surface-table-subtle">
                      Re-read supported adapter wiring before launching a live
                      action.
                    </div>
                  </div>
                  <span className="surface-table-hint">
	                    {loadedRoutes > 0
	                      ? "On-chain routers loaded"
	                      : "Refresh route status"}
                  </span>
                </div>
              </div>
              <div className="surface-spotlight-footer">
                <button
                  onClick={() => void refresh()}
                  className="surface-button surface-button-secondary"
                  data-testid="integrations-refresh-button"
                >
                  Refresh checks
                </button>
              </div>
            </article>
          </div>
          <TransactionFeedbackRail
            loading={loading}
            loadingLabel="Submitting protocol execution..."
            status={status}
            error={error}
            statusTestId="integrations-status"
            errorTestId="integrations-error"
          />
          {executionReceipt ? (
            <div
              className="surface-entry-card"
              data-testid="integrations-execution-receipt-panel"
            >
              <div className="surface-entry-head">
                <div>
                  <div className="surface-entry-title">Execution receipt</div>
                  <div
                    className="surface-note"
                    data-testid="integrations-execution-receipt-summary"
                  >
                    {executionReceipt.summary}
                  </div>
                </div>
                <StatusPill
                  label={formatExecutionVenueFamilyLabel(
                    executionReceipt.venueFamily,
                  )}
                  tone="positive"
                />
              </div>
              <div className="surface-list">
                <div className="surface-list-row">
                  <div>
                    <div className="surface-table-cell-strong">Action</div>
                    <div className="surface-table-subtle">
                      {executionReceipt.actionLabel}
                    </div>
                  </div>
                  <span className="surface-table-hint">
                    {executionReceipt.venueTitle}
                  </span>
                </div>
                <div className="surface-list-row">
                  <div>
                    <div className="surface-table-cell-strong">Path model</div>
                    <div className="surface-table-subtle">
                      {formatExecutionVenuePathModelLabel(
                        executionReceipt.pathModel,
                      )}
                    </div>
                  </div>
                  <span className="surface-table-hint">
                    {formatExecutionVenueConfirmationModelLabel(
                      executionReceipt.confirmationModel,
                    )}
                  </span>
                </div>
                <div className="surface-list-row">
                  <div>
                    <div className="surface-table-cell-strong">
                      Primary hash
                    </div>
                    <div
                      className="surface-table-subtle ops-mono"
                      data-testid="integrations-execution-receipt-primary-hash"
                    >
                      {executionReceipt.primaryHash}
                    </div>
                  </div>
                  <span className="surface-table-hint">
                    {executionReceipt.submittedAt}
                  </span>
                </div>
              </div>
              <div className="surface-note">{executionReceipt.detail}</div>
            </div>
          ) : null}
        </Panel>
      ) : null}

      {operatorSurface && activeWorkspace === "actions" ? (
        <Panel
          id="integrations-actions"
          title="Canonical execution surfaces"
          subtitle="Run Balanced and Blend here and route Sushi, Aquarius or SoroSwap from the Arka execution workspace"
          testId="integrations-actions-panel"
        >
          <div
            className="surface-grid integrations-action-stack"
            data-testid="integrations-actions-table"
          >
            <div className="surface-entry-card">
              <div className="surface-entry-head">
                <div>
                  <div className="surface-entry-title">AMM routing surface</div>
                  <div className="surface-note">
                    Sushi, Aquarius and SoroSwap stay available through the
                    manager-owned Arka execution flow. Balanced is handled as
                    a SODAX intent venue.
                  </div>
                </div>
                <StatusPill label="Aquarius + SoroSwap" tone="positive" />
              </div>
              <div className="surface-list">
                <div className="surface-list-row">
                  <div>
                    <div className="surface-table-cell-strong">Sushi</div>
                    <div className="surface-table-subtle">
                      Live AMM route backed by the Sushi adapter when the configured pool is available.
                    </div>
                  </div>
                  <StatusPill
                    label={sushiHealth.label}
                    tone={sushiHealth.tone}
                  />
                </div>
                <div className="surface-list-row">
                  <div>
                    <div className="surface-table-cell-strong">Aquarius</div>
                    <div className="surface-table-subtle">
	                    Live AMM route backed by the Aquarius adapter.
                    </div>
                  </div>
                  <StatusPill
                    label={aquariusHealth.label}
                    tone={aquariusHealth.tone}
                  />
                </div>
                <div className="surface-list-row">
                  <div>
                    <div className="surface-table-cell-strong">SoroSwap</div>
                    <div className="surface-table-subtle">
	                      Live AMM route backed by the SoroSwap adapter.
                    </div>
                  </div>
                  <StatusPill
                    label={soroswapHealth.label}
                    tone={soroswapHealth.tone}
                  />
                </div>
              </div>
              <div className="ops-action-row">
                <Link
                  href="/arkas"
                  className="surface-button surface-button-primary"
                  data-testid="integrations-open-arkas"
                >
	                  Open Arka execution
                </Link>
              </div>
            </div>

            <div className="surface-entry-card">
              <div className="surface-entry-head">
                <div>
                  <div className="surface-entry-title">Balanced execute</div>
                  <div className="surface-note">
                    {balancedVenue?.summary ??
                      "Execute Balanced directly when the canonical support surface is live in this environment."}
                  </div>
                </div>
                <StatusPill
                  label={balancedHealth.label}
                  tone={balancedHealth.tone}
                />
              </div>
              <TransactionReviewCard
	                title="Intent-aware execution"
	                body="Balanced / SODAX uses intent execution. Review amount, route status and mainnet readiness before signing."
                bullets={[
                  `Pool: ${balancedPoolId || "1"}`,
                  `Amount in: ${balancedAmount || "0"}`,
                  `Min out: ${balancedMinOut || "0"}`,
                  `Gate: ${mainnetOracleGate.ready ? "ready" : "blocked"}`,
                ]}
                tone={
                  balancedLane.ready && mainnetOracleGate.ready
                    ? "positive"
                    : "warning"
                }
              />
              <div className="ops-form-grid">
                <ActionField
                  label="Pool ID"
	                  hint="Numeric pool index validated by the adapter."
                  error={
                    Math.trunc(Number(balancedPoolId || "0")) <= 0
                      ? "Pool ID must be a positive integer."
                      : undefined
                  }
                >
                  <input
                    value={balancedPoolId}
                    onChange={(e) => setBalancedPoolId(e.target.value)}
                    className="ops-input"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    aria-invalid={
                      Math.trunc(Number(balancedPoolId || "0")) <= 0
                    }
                    data-testid="integrations-balanced-pool-id"
                  />
                </ActionField>
                <ActionField
                  label="Amount in"
                  hint="Enter the amount to swap in the selected token."
                  error={
                    toBaseUnits(balancedAmount) <= 0
                      ? "Amount must be positive."
                      : undefined
                  }
                >
                  <input
                    value={balancedAmount}
                    onChange={(e) => setBalancedAmount(e.target.value)}
                    className="ops-input"
                    inputMode="decimal"
                    aria-invalid={toBaseUnits(balancedAmount) <= 0}
                    data-testid="integrations-balanced-amount"
                  />
                </ActionField>
                <ActionField
                  label="Min out"
                  hint="Execution floor enforced on-chain."
                  error={
                    toBaseUnits(balancedMinOut) <= 0
                      ? "Min out must be positive."
                      : undefined
                  }
                >
                  <input
                    value={balancedMinOut}
                    onChange={(e) => setBalancedMinOut(e.target.value)}
                    className="ops-input"
                    inputMode="decimal"
                    aria-invalid={toBaseUnits(balancedMinOut) <= 0}
                    data-testid="integrations-balanced-min-out"
                  />
                </ActionField>
              </div>
              <div className="surface-note">
                Ready to review: pool {balancedPoolId || "1"} · amount{" "}
                {balancedAmount || "0"} · min out {balancedMinOut || "0"}{" "}
	                through the Balanced adapter.
              </div>
              <div
                className="surface-note"
                data-testid="integrations-balanced-lane-note"
              >
                {balancedLane.detail}
              </div>
              <div
                className="surface-note"
                data-testid="integrations-balanced-module-note"
              >
                {balancedModuleNote}
              </div>
              <div
                className="surface-note"
                data-testid="integrations-balanced-official-note"
              >
                {balancedOfficialSurfaceNote}
              </div>
              <div
                className="surface-note"
                data-testid="integrations-balanced-capability-note"
              >
                {balancedIntentCapabilityNote}
              </div>
              <div
                className="surface-note"
                data-testid="integrations-balanced-driver-note"
              >
                {balancedIntentDriverNote}
              </div>
              <div
                className="surface-note"
                data-testid="integrations-balanced-quote-status-note"
              >
                Quote endpoint:{" "}
                {balancedIntentDriver.publicQuoteEndpoint ?? "not public"} ·{" "}
                Build endpoint:{" "}
                {balancedIntentDriver.publicBuildEndpoint ?? "not public"} ·{" "}
                Relay endpoint:{" "}
                {balancedIntentDriver.publicRelayEndpoint ?? "not public"} ·{" "}
                Status surface:{" "}
                {balancedIntentDriver.statusSurface === "recent_activity"
                  ? "Recent Activity"
                  : "unknown"}{" "}
                · Receipt endpoint:{" "}
                {balancedIntentDriver.publicReceiptEndpoint ?? "not public"}{" "}
                · Cancel window:{" "}
                {balancedIntentDriver.cancellationWindowSeconds
                  ? `${balancedIntentDriver.cancellationWindowSeconds}s`
                  : "n/a"}
              </div>
              <div
                className="surface-note"
                data-testid="integrations-balanced-handoff-note"
              >
                {balancedIntentHandoff.summary}
              </div>
              <div
                className="surface-note"
                data-testid="integrations-balanced-handoff-route"
              >
                {balancedIntentHandoff.operatorRoute} ·{" "}
                {balancedIntentHandoff.routeContext}
              </div>
              <div
                className="surface-note"
                data-testid="integrations-balanced-handoff-checks"
              >
                {balancedIntentHandoff.steps
                  .map(
                    (step) =>
                      `${step.label}: ${formatIntentExecutionHandoffStepStateLabel(step.state)}`,
                  )
                  .join(" · ")}
              </div>
              <div
                className="surface-note"
                data-testid="integrations-balanced-source-note"
              >
                {balancedSourceAdapter.detail}
              </div>
              <div
                className="surface-chip-wrap"
                data-testid="integrations-balanced-handoff-links"
              >
                {balancedIntentHandoff.primaryAction ||
                balancedIntentHandoff.supportingLinks.length > 0 ? (
                  <>
                    {balancedIntentHandoff.primaryAction ? (
                      <a
                        href={balancedIntentHandoff.primaryAction.href}
                        target="_blank"
                        rel="noreferrer"
                        className="surface-chip"
                      >
                        {balancedIntentHandoff.primaryAction.label}
                      </a>
                    ) : null}
                    {balancedIntentHandoff.supportingLinks.map((link) => (
                      <a
                        key={link.id}
                        href={link.href}
                        target="_blank"
                        rel="noreferrer"
                        className="surface-chip"
                      >
                        {link.label}
                      </a>
                    ))}
                  </>
                ) : (
                  <span className="surface-note">
                    No official links are available for this route in the
                    current setup.
                  </span>
                )}
              </div>
              <div
                className="surface-chip-wrap"
                data-testid="integrations-balanced-source-links"
              >
                {balancedSourceAdapter.links.length > 0 ? (
                  balancedSourceAdapter.links.map((link) => (
                    <a
                      key={link.id}
                      href={link.href}
                      target="_blank"
                      rel="noreferrer"
                      className="surface-chip"
                    >
                      {link.label}
                    </a>
                  ))
                ) : (
                  <span className="surface-note">
                    Official app, Stellar page and Trade blog links have not
                    been loaded into the current runtime snapshot yet.
                  </span>
                )}
              </div>
              <div
                className="surface-note"
                data-testid="integrations-balanced-confirmation-note"
              >
                {balancedVenue?.confirmationDetail ??
                  "Confirmation is tied to the execution venue model."}
              </div>
              <div
                className="surface-note"
                data-testid="integrations-mainnet-gate-note"
              >
                Mainnet publication gate ({mainnetOracleGate.targetNetwork}):{" "}
                {mainnetOracleGate.detail}
              </div>
              <div className="ops-action-row">
                <button
                  onClick={runBalanced}
                  disabled={
                    UX_REVIEW_PREVIEW || !canAct || !balancedLane.ready || !mainnetOracleGate.ready
                  }
                  className="surface-button surface-button-primary disabled:cursor-not-allowed disabled:opacity-50"
                  data-testid="integrations-run-balanced"
                >
                  Run Balanced
                </button>
              </div>
            </div>

            <div className="surface-entry-card">
              <div className="surface-entry-head">
                <div>
                  <div className="surface-entry-title">Blend execute</div>
                  <div className="surface-note">
                    Borrow, lend, repay or liquidate against the current Blend
                    market.
                  </div>
                </div>
                <StatusPill label={blendHealth.label} tone={blendHealth.tone} />
              </div>
              <TransactionReviewCard
                title="Validated credit adapter"
                body="Blend runs through the validated adapter. The app keeps the requested command visible before the wallet signer takes over."
                bullets={[
                  `Action: ${blendAction}`,
                  `Amount: ${blendAmount || "0"}`,
                  `Signer: ${pubKey ? "connected" : "wallet required"}`,
                ]}
                tone={canAct ? "positive" : "warning"}
              />
              <div className="ops-form-grid">
                <ActionField
                  label="Action"
                  hint="Select the credit command that will be wrapped by the Blend adapter."
                >
                  <select
                    value={blendAction}
                    onChange={(e) =>
                      setBlendAction(
                        e.target.value as
                          | "Lend"
                          | "Borrow"
                          | "Repay"
                          | "Liquidate",
                      )
                    }
                    className="ops-select"
                  >
                    <option value="Lend">Lend</option>
                    <option value="Borrow">Borrow</option>
                    <option value="Repay">Repay</option>
                    <option value="Liquidate">Liquidate</option>
                  </select>
                </ActionField>
                <ActionField
                  label="Amount"
                  hint="Enter the amount for the selected Blend action."
                  error={
                    toBaseUnits(blendAmount) <= 0
                      ? "Amount must be positive."
                      : undefined
                  }
                >
                  <input
                    value={blendAmount}
                    onChange={(e) => setBlendAmount(e.target.value)}
                    className="ops-input"
                    inputMode="decimal"
                    aria-invalid={toBaseUnits(blendAmount) <= 0}
                  />
                </ActionField>
              </div>
              <div className="surface-note">
                {protocolVenueAllowed('BLEND',venueStates.BLEND,blendAction==='Repay'?'repay':blendAction==='Borrow'?'borrow':'supply',NETWORK_PASSPHRASE) ? `Ready to review: ${blendAction} ${blendAmount || '0'}` : 'Protocol permissions are unavailable for this action.'}
              </div>
              <div className="ops-action-row">
                <button
                  onClick={runBlend}
                  disabled={UX_REVIEW_PREVIEW || !canAct || !protocolVenueAllowed('BLEND',venueStates.BLEND,blendAction==='Repay'?'repay':blendAction==='Borrow'?'borrow':'supply',NETWORK_PASSPHRASE)}
                  className="surface-button surface-button-primary disabled:cursor-not-allowed disabled:opacity-50"
                  data-testid="integrations-run-blend"
                >
                  Run Blend
                </button>
              </div>
            </div>
          </div>
          {executionReceipt ? (
            <div
              className="surface-entry-card"
              data-testid="integrations-execution-receipt-panel"
            >
              <div className="surface-entry-head">
                <div>
                  <div className="surface-entry-title">Execution receipt</div>
                  <div
                    className="surface-note"
                    data-testid="integrations-execution-receipt-summary"
                  >
                    {executionReceipt.summary}
                  </div>
                </div>
                <StatusPill
                  label={formatExecutionVenueFamilyLabel(
                    executionReceipt.venueFamily,
                  )}
                  tone="positive"
                />
              </div>
              <div className="surface-list">
                <div className="surface-list-row">
                  <div>
                    <div className="surface-table-cell-strong">Action</div>
                    <div className="surface-table-subtle">
                      {executionReceipt.actionLabel}
                    </div>
                  </div>
                  <span className="surface-table-hint">
                    {executionReceipt.venueTitle}
                  </span>
                </div>
                <div className="surface-list-row">
                  <div>
                    <div className="surface-table-cell-strong">Path model</div>
                    <div className="surface-table-subtle">
                      {formatExecutionVenuePathModelLabel(
                        executionReceipt.pathModel,
                      )}
                    </div>
                  </div>
                  <span className="surface-table-hint">
                    {formatExecutionVenueConfirmationModelLabel(
                      executionReceipt.confirmationModel,
                    )}
                  </span>
                </div>
                <div className="surface-list-row">
                  <div>
                    <div className="surface-table-cell-strong">
                      Primary hash
                    </div>
                    <div
                      className="surface-table-subtle ops-mono"
                      data-testid="integrations-execution-receipt-primary-hash"
                    >
                      {executionReceipt.primaryHash}
                    </div>
                  </div>
                  <span className="surface-table-hint">
                    {executionReceipt.submittedAt}
                  </span>
                </div>
              </div>
              <div className="surface-note">{executionReceipt.detail}</div>
            </div>
          ) : null}
        </Panel>
      ) : null}
    </main>
  );
}

export default IntegrationsSurface;
