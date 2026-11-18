import { Account as OfflineAccount, StrKey as OfflineStrKey, TransactionBuilder as OfflineTransactionBuilder, Operation as OfflineOperation } from '@stellar/stellar-sdk';
const offlineXdr=()=>new OfflineTransactionBuilder(new OfflineAccount(OfflineStrKey.encodeEd25519PublicKey(new Uint8Array(32).fill(41)),"0"),{fee:"100",networkPassphrase:"Test SDF Network ; September 2015"}).addOperation(OfflineOperation.manageData({name:"boundary-fixture",value:"unsigned"})).setTimeout(0).build().toXDR();
import React from "react";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { resolveAssetDisplayLabel } from "@/lib/catalog/assetPresentation";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  AQUARIUS_ADAPTER,
  ARKA_ROUTER,
  SOROSWAP_ADAPTER,
} from "@/lib/config";

const navigationState = vi.hoisted(() => ({
  id: "TEST_BLEND_VAULT",
  search: "",
  replace: vi.fn(),
}));
const holderCacheState = { stale: false, refreshFailed: false };

const configMocks = vi.hoisted(() => ({
  routingAssetA: "CDJ7G22ETJ6PRUM5GDPUXYEY3JL6MDY35WMJYWSGX7U6DV5VMQEKH3PG",
  routingAssetB: "CCCLTACEMF33GJRJ2JXRQYXDBRLRZNK5GVPA2FVHLOE5TPP6NM7UIYV7",
}));

const sorobanMocks = vi.hoisted(() => ({
  buildAdapterBalancedExecute: vi.fn(),
  buildAquariusRouterSwap: vi.fn(),
  buildArkaCreditAction: vi.fn(),
  buildArkaDeposit: vi.fn(),
  buildArkaRebalance: vi.fn(),
  buildArkaRedeem: vi.fn(),
  buildSoroswapRouterSwap: vi.fn(),
  buildSoroswapRouterSwapForPath: vi.fn(),
  buildSwapStepScVal: vi.fn((params) => ({ kind: "swap-step", params })),
  buildTokenApprove: vi.fn(),
  readAquariusEstimateOut: vi.fn(),
  readAquariusPoolIndex: vi.fn(),
  readAquariusReserves: vi.fn(),
  readArkaCreditMarketConfigs: vi.fn(),
  readArkaCreditMarketAssets: vi.fn(),
  readArkaCreditBorrowPolicy: vi.fn(),
  readArkaCreditMarketRiskSource: vi.fn(),
  readArkaCreditMarketStatus: vi.fn(),
  readArkaCreditMarketValue: vi.fn(),
  readArkaCreditProtocols: vi.fn(),
  readArkaCreditPositionValues: vi.fn(),
  readArkaCreditRiskPolicy: vi.fn(),
  readBlendSupportedAssets: vi.fn(),
  readArkaDenomination: vi.fn(),
  readArkaLiquidBalance: vi.fn(),
  readArkaManager: vi.fn(),
  readArkaNav: vi.fn(),
  readArkaShareToken: vi.fn(),
  readArkaShares: vi.fn(),
  readArkaTotalShares: vi.fn(),
  readArkaWhitelist: vi.fn(),
  readPhoenixEstimateOut: vi.fn(),
  readSushiEstimateOut: vi.fn(async()=>0),
  readSushiFundBinding: vi.fn(async()=>1),
  readVenueSnapshot: vi.fn(async(_fund:string,venue:string)=>({registry:"registry",venue,network:"Test SDF Network ; September 2015",status:2,updatedAt:"1",updatedBy:"admin",observedAt:Date.now()})),
  readSoroswapAmountOutForPath: vi.fn(),
  readTokenAllowance: vi.fn(),
  readSoroswapAmountOut: vi.fn(),
  readTokenBalance: vi.fn(),
  toBaseUnits: vi.fn((value: number) => Math.round(value * 1e7)),
}));

const runtimeHealthState = vi.hoisted(() => ({
  balanced: {
    validatedAt: null,
    adapterBalanced: "",
    poolId: 1,
    supportStatus: "blocked",
    readyForDappExecution: false,
    laneMode: "legacy_comet",
    blockingReasons: ["Balanced lane is still blocked."],
    observedRouter: null,
    expectedRouter: null,
    poolSupported: false,
    pairConfigured: false,
    validatedModule: {
      present: false,
      validatedAt: null,
      router: null,
      poolId: 0,
      sourceValidations: [],
      source: "fallback",
    },
    source: "fallback",
  },
}));

const freighterMocks = vi.hoisted(() => ({
  signTransaction: vi.fn(async () => ({ signedTxXdr: offlineXdr() })),
}));

const walletKitMocks = vi.hoisted(() => {
  const managerAddress =
    "GMANAGER7777777777777777777777777777777777777777777777777777";
  const defaultKit = {
    getAddress: vi.fn(async () => {
      throw new Error("no active wallet");
    }),
    signTransaction: vi.fn(async () => ({ signedTxXdr: offlineXdr() })),
  };
  const providerDisconnectKit = {
    getAddress: vi.fn(async () => ({ address: managerAddress })),
    signTransaction: vi.fn(async () => {
      throw new Error("Selected wallet provider disconnected");
    }),
  };
  let activeKit: unknown = defaultKit;

  return {
    defaultKit,
    providerDisconnectKit,
    connectFreighterDirect: vi.fn(async () => null),
    getWalletsKit: vi.fn(() => activeKit),
    setActiveKit: (kit: unknown) => {
      activeKit = kit;
    },
    signWithE2EWallet: vi.fn(),
  };
});

const routePlanApiMocks = vi.hoisted(() => ({
  requestRebalanceRoutePlan: vi.fn(),
}));

const catalogPriceState = vi.hoisted(() => ({
  unavailableAssets: new Set<string>(),
}));

vi.mock("next/navigation", () => ({
  useParams: () => ({ id: navigationState.id }),
  useRouter: () => ({ replace: navigationState.replace }),
  useSearchParams: () => new URLSearchParams(navigationState.search),
}));

vi.mock("@creit.tech/stellar-wallets-kit", () => ({
  WalletNetwork: {
    TESTNET: "TESTNET",
  },
}));

vi.mock("@/lib/config", async () => {
  const actual = await vi.importActual<typeof import("@/lib/config")>(
    "@/lib/config",
  );
  return {
    ...actual,
    ROUTING_ASSET_A: configMocks.routingAssetA,
    ROUTING_ASSET_B: configMocks.routingAssetB,
    BLEND_MARKET_ASSETS: [configMocks.routingAssetA, configMocks.routingAssetB],
    ROUTING_ASSET_A_LABEL: "Input asset",
    ROUTING_ASSET_B_LABEL: "Output asset",
    ROUTING_PAIR_LABEL: "Input asset -> Output asset",
  };
});

vi.mock("@/lib/soroban", () => ({
  ADAPTER_BLEND: "BLEND_ADAPTER",
  RPC_URL: "https://rpc.test",
  TESTNET: "Test SDF Network ; September 2015",
  buildAdapterBalancedExecute: sorobanMocks.buildAdapterBalancedExecute,
  buildAquariusRouterSwap: sorobanMocks.buildAquariusRouterSwap,
  buildArkaCreditAction: sorobanMocks.buildArkaCreditAction,
  buildArkaDeposit: sorobanMocks.buildArkaDeposit,
  buildArkaRebalance: sorobanMocks.buildArkaRebalance,
  buildArkaRedeem: sorobanMocks.buildArkaRedeem,
  buildSoroswapRouterSwap: sorobanMocks.buildSoroswapRouterSwap,
  buildSoroswapRouterSwapForPath: sorobanMocks.buildSoroswapRouterSwapForPath,
  buildSwapStepScVal: sorobanMocks.buildSwapStepScVal,
  buildTokenApprove: sorobanMocks.buildTokenApprove,
  readAquariusEstimateOut: sorobanMocks.readAquariusEstimateOut,
  readAquariusPoolIndex: sorobanMocks.readAquariusPoolIndex,
  readAquariusReserves: sorobanMocks.readAquariusReserves,
  readArkaCreditMarketConfigs: sorobanMocks.readArkaCreditMarketConfigs,
  readArkaCreditMarketAssets: sorobanMocks.readArkaCreditMarketAssets,
  readArkaCreditBorrowPolicy: sorobanMocks.readArkaCreditBorrowPolicy,
  readArkaCreditMarketRiskSource: sorobanMocks.readArkaCreditMarketRiskSource,
  readArkaCreditMarketStatus: sorobanMocks.readArkaCreditMarketStatus,
  readArkaCreditMarketValue: sorobanMocks.readArkaCreditMarketValue,
  readArkaCreditProtocols: sorobanMocks.readArkaCreditProtocols,
  readArkaCreditPositionValues: sorobanMocks.readArkaCreditPositionValues,
  readArkaCreditRiskPolicy: sorobanMocks.readArkaCreditRiskPolicy,
  readBlendSupportedAssets: sorobanMocks.readBlendSupportedAssets,
  readArkaDenomination: sorobanMocks.readArkaDenomination,
  readArkaLiquidBalance: sorobanMocks.readArkaLiquidBalance,
  readArkaManager: sorobanMocks.readArkaManager,
  readArkaNav: sorobanMocks.readArkaNav,
  readArkaShareToken: sorobanMocks.readArkaShareToken,
  readArkaShares: sorobanMocks.readArkaShares,
  readArkaTotalShares: sorobanMocks.readArkaTotalShares,
  readArkaWhitelist: sorobanMocks.readArkaWhitelist,
  readPhoenixEstimateOut: sorobanMocks.readPhoenixEstimateOut,
  readSushiEstimateOut: sorobanMocks.readSushiEstimateOut,
  readSushiFundBinding: sorobanMocks.readSushiFundBinding,
  readVenueSnapshot: sorobanMocks.readVenueSnapshot,
  readSoroswapAmountOutForPath: sorobanMocks.readSoroswapAmountOutForPath,
  readTokenAllowance: sorobanMocks.readTokenAllowance,
  readSoroswapAmountOut: sorobanMocks.readSoroswapAmountOut,
  readTokenBalance: sorobanMocks.readTokenBalance,
  resolveRpcUrl: () => "https://rpc.test",
  toBaseUnits: sorobanMocks.toBaseUnits,
}));

vi.mock("@/lib/runtime/appHealth", async () => {
  const actual = await vi.importActual<typeof import("@/lib/runtime/appHealth")>(
    "@/lib/runtime/appHealth",
  );
  return actual;
});

vi.mock("@/lib/runtime/rebalanceRoutePlanApi", () => ({
  requestRebalanceRoutePlan: routePlanApiMocks.requestRebalanceRoutePlan,
}));

vi.mock("@/lib/walletKit", () => ({
  E2E_WALLET_ENABLED: false,
  getWalletsKit: walletKitMocks.getWalletsKit,
  connectFreighterDirect: walletKitMocks.connectFreighterDirect,
  isWalletSelectionClosedError: (event: unknown) =>
    event instanceof Error && event.message === "Wallet selection was closed",
  signWithE2EWallet: walletKitMocks.signWithE2EWallet,
}));

vi.mock("@stellar/freighter-api", () => ({
  signTransaction: freighterMocks.signTransaction,
}));

import ArkaDetailPage from "@/app/arkas/[id]/page";
import { formatHolderPositionValue } from "@/lib/catalog/holderPresentation";

describe("formatHolderPositionValue", () => {
  it("derives exact USD and denomination values from the holder ownership", () => {
    expect(
      formatHolderPositionValue({
        holderShares: "87000000",
        totalShares: "100000000",
        navDenomination: "100000000",
        denominationSymbol: "XLM",
        denominationDecimals: 7,
        navUsdEstimate: "50000000",
      }),
    ).toEqual({ primary: "$4.35", secondary: "8.7 XLM" });
  });

  it("does not invent a USD value when pricing is unavailable", () => {
    expect(
      formatHolderPositionValue({
        holderShares: "25000000",
        totalShares: "100000000",
        navDenomination: "100000000",
        denominationSymbol: "XLM",
        denominationDecimals: 7,
        navUsdEstimate: null,
      }),
    ).toEqual({ primary: "2.5 XLM", secondary: "" });
  });
});

const defaultRoutingAssetA = configMocks.routingAssetA;
const defaultRoutingAssetB = configMocks.routingAssetB;
const defaultMidAsset = "CMIDTOKEN33333333333333333333333333333333333333333333333333";

async function openWorkspace(
  user: ReturnType<typeof userEvent.setup>,
  id: "state" | "flow" | "rebalance" | "credit",
) {
  if (!screen.queryByTestId(`arka-workspace-tab-${id}`)) {
    await user.click(screen.getByRole('link', {name: id === 'rebalance' || id === 'credit' ? 'Manage fund portfolio' : 'Invest in this fund'}));
  }
  await waitFor(() =>
    expect(screen.getAllByTestId(`arka-workspace-tab-${id}`).length).toBeGreaterThan(0),
  );
  const tabs = screen.getAllByTestId(`arka-workspace-tab-${id}`);
  await user.click(tabs[tabs.length - 1]);
  if (id === 'rebalance') {
    const options = screen.getByRole('checkbox', {name: /advanced/i});
    if (!(options as HTMLInputElement).checked) await user.click(options);
  }
}

function countRpcMethod(method: string): number {
  const calls =
    (global.fetch as unknown as {
      mock?: { calls: Array<[RequestInfo | URL, RequestInit?]> };
    }).mock?.calls ?? [];

  return calls.filter(([, init]) => {
    if (typeof init?.body !== "string") return false;
    try {
      const payload = JSON.parse(init.body) as { method?: string };
      return payload.method === method;
    } catch {
      return false;
    }
  }).length;
}

async function reviewAndConfirmSwap(user: ReturnType<typeof userEvent.setup>) {
  if (!screen.queryByTestId('fund-swap-review')) {
    await user.click(screen.getByTestId('rebalance-run-button'));
  }
  await waitFor(() => expect(screen.getByTestId('rebalance-confirm-button')).toBeVisible());
  await user.click(screen.getByTestId('rebalance-confirm-button'));
}

const providerUnavailableError =
  /connected wallet is unavailable.*reconnect it and try again/i;

function useDisconnectedProvider() {
  walletKitMocks.setActiveKit(walletKitMocks.providerDisconnectKit);
  walletKitMocks.providerDisconnectKit.signTransaction.mockReset();
  walletKitMocks.providerDisconnectKit.signTransaction.mockRejectedValue(
    new Error("Selected wallet provider disconnected"),
  );
  freighterMocks.signTransaction.mockRejectedValue(
    new Error("Freighter not available"),
  );
}

function buildSoroswapMultiHopCandidate() {
  return {
    routeId: "SOROSWAP_MULTI_0",
    protocol: "SOROSWAP" as const,
    venueFamily: "amm_router" as const,
    quoteModel: "live_router_quote" as const,
    settlementModel: "onchain_router" as const,
    pathModel: "router_multi_hop" as const,
    confirmationModel: "transaction_hash_plus_refresh" as const,
    title: "SoroSwap multi-hop",
    estimatedOutBase: 11_400_000,
    minOutBase: 11_000_000,
    available: true,
    admitted: true,
    autoEligible: true,
    note: "Live router quote available for a three-asset path.",
    pathAssets: [defaultRoutingAssetA, defaultMidAsset, defaultRoutingAssetB],
    pathLabel: "Input asset -> USDC -> Output asset",
    hops: 2,
    routeScoreBase: 11_100_000,
    routeScoreLabel: "score = est. output",
    executionKind: "soroswap_path" as const,
    adapterId: SOROSWAP_ADAPTER,
    poolId: 7,
    steps: [
      {
        protocol: "SOROSWAP" as const,
        tokenIn: defaultRoutingAssetA,
        tokenOut: defaultMidAsset,
      },
      {
        protocol: "SOROSWAP" as const,
        tokenIn: defaultMidAsset,
        tokenOut: defaultRoutingAssetB,
      },
    ],
  };
}

function passedExecutionGuardrails() {
  return {
    status: "passed" as const,
    blockedReasons: [],
    checks: [
      {
        id: "post_trade_deviation_bps",
        status: "passed" as const,
        detail: "Projected allocation shift is within policy.",
      },
      {
        id: "daily_turnover_cap_bps",
        status: "passed" as const,
        detail: "Daily turnover is within policy.",
      },
    ],
  };
}

function mockSoroswapMultiHopRoutePlan(
  soroswapMultiHopCandidate = buildSoroswapMultiHopCandidate(),
) {
  routePlanApiMocks.requestRebalanceRoutePlan.mockResolvedValue({
    ok: true,
    source: "api_routing_solver",
    generatedAt: "2026-04-16T12:45:00.000Z",
    plan: {
      requestedProtocol: "AUTO",
      selectedProtocol: "SOROSWAP",
      selectedCandidate: soroswapMultiHopCandidate,
      estimatedOutBase: soroswapMultiHopCandidate.estimatedOutBase,
      minOutBase: soroswapMultiHopCandidate.minOutBase,
      note: "Auto-selected SoroSwap multi-hop from live routes.",
      candidates: [soroswapMultiHopCandidate],
      guardrails: passedExecutionGuardrails(),
    },
  });
  return soroswapMultiHopCandidate;
}

describe("ArkaDetailPage", () => {
  afterEach(() => {
    cleanup();
  });

  beforeEach(() => {
    vi.clearAllMocks();
    holderCacheState.stale = false;
    holderCacheState.refreshFailed = false;
    catalogPriceState.unavailableAssets.clear();
    navigationState.id = "TEST_BLEND_VAULT";
    navigationState.search = "";
    navigationState.replace.mockReset();
    walletKitMocks.setActiveKit(walletKitMocks.defaultKit);
    walletKitMocks.defaultKit.signTransaction.mockReset();
    walletKitMocks.defaultKit.signTransaction.mockResolvedValue({
      signedTxXdr: offlineXdr(),
    });
    walletKitMocks.providerDisconnectKit.signTransaction.mockReset();
    walletKitMocks.providerDisconnectKit.signTransaction.mockRejectedValue(
      new Error("Selected wallet provider disconnected"),
    );
    freighterMocks.signTransaction.mockReset();
    window.localStorage.clear();
    window.localStorage.setItem(
      "wallet:pubkey",
      "GMANAGER7777777777777777777777777777777777777777777777777777",
    );

    sorobanMocks.readArkaManager.mockResolvedValue(
      "GMANAGER7777777777777777777777777777777777777777777777777777",
    );
    sorobanMocks.readArkaShareToken.mockResolvedValue("CSHARETOKEN123456789");
    sorobanMocks.readArkaShares.mockResolvedValue(13_000_000);
    sorobanMocks.readArkaTotalShares.mockResolvedValue(100_000_000);
    sorobanMocks.readArkaCreditProtocols.mockResolvedValue(["Blend"]);
    sorobanMocks.readArkaCreditMarketConfigs.mockResolvedValue([
      {
        protocol: "Blend",
        market_id: 7,
        adapter: "CBLENDADAPTER777",
        allow_supply: true,
        allow_borrow: true,
        allow_repay: true,
        allow_withdraw: true,
        enabled: true,
      },
    ]);
    sorobanMocks.readArkaCreditBorrowPolicy.mockResolvedValue({
      protocol: "Blend",
      market_id: 7,
      asset: defaultRoutingAssetA,
      max_borrow_per_action: 25_000_000,
      max_debt_for_asset: 75_000_000,
      enabled: true,
    });
    sorobanMocks.readArkaCreditMarketRiskSource.mockResolvedValue({
      market_id: 7,
      pool_factory: "CBLENDPOOLFACTORY777",
    });
    sorobanMocks.readArkaNav.mockResolvedValue(152_000_000);
    sorobanMocks.readArkaDenomination.mockResolvedValue(defaultRoutingAssetA);
    sorobanMocks.readArkaWhitelist.mockResolvedValue([
      defaultRoutingAssetA,
      defaultRoutingAssetB,
      defaultMidAsset,
    ]);
    sorobanMocks.readArkaCreditMarketAssets.mockResolvedValue([
      defaultRoutingAssetA,
      defaultRoutingAssetB,
      defaultMidAsset,
    ]);
    sorobanMocks.readBlendSupportedAssets.mockImplementation(
      async (_adapter: string, assets: string[]) => assets,
    );
    sorobanMocks.readArkaCreditPositionValues.mockResolvedValue([
      {
        asset: defaultRoutingAssetB,
        collateral_amount: 50_000_000,
        debt_amount: 15_000_000,
        net_value: 35_000_000,
        price: 10_000_000,
      },
    ]);
    sorobanMocks.readArkaCreditMarketValue.mockResolvedValue({
      collateral_value: 50_000_000,
      debt_value: 15_000_000,
      net_value: 35_000_000,
      health_factor: 14_500_000,
    });
    sorobanMocks.readArkaCreditRiskPolicy.mockResolvedValue({
      min_health_factor: 12_000_000,
      max_oracle_age: 600,
      fail_close_nav: true,
      fail_close_actions: true,
    });
    sorobanMocks.readArkaCreditMarketStatus.mockResolvedValue({
      oracle_age: 52,
      max_oracle_age: 600,
      has_invalid_oracle_data: false,
      has_future_oracle_timestamp: false,
      has_disabled_reserve: false,
      has_stale_oracle: false,
      risky_actions_blocked: false,
      nav_blocked: false,
      pool_status: 0,
      debt_value: 15_000_000,
      health_factor: 14_500_000,
    });
    sorobanMocks.readArkaLiquidBalance.mockImplementation(async (_arkaId: string, asset: string) => {
      if (asset === defaultRoutingAssetA) return 40_000_000;
      if (asset === defaultRoutingAssetB) return 22_000_000;
      if (asset === defaultMidAsset) return 8_000_000;
      return 0;
    });
    sorobanMocks.readTokenBalance.mockImplementation(async (asset: string) => {
      if (asset === "CSHARETOKEN123456789") return 13_000_000;
      if (asset === defaultRoutingAssetA) return 18_000_000;
      if (asset === defaultRoutingAssetB) return 7_000_000;
      if (asset === defaultMidAsset) return 4_000_000;
      return 0;
    });
    sorobanMocks.readTokenAllowance.mockResolvedValue(0);
    sorobanMocks.readSoroswapAmountOut.mockResolvedValue(9_500_000);
    sorobanMocks.readSoroswapAmountOutForPath.mockResolvedValue(0);
    sorobanMocks.readAquariusPoolIndex.mockResolvedValue("ab".repeat(32));
    sorobanMocks.readAquariusEstimateOut.mockResolvedValue(10_300_000);
    sorobanMocks.buildAdapterBalancedExecute.mockResolvedValue(offlineXdr());
    sorobanMocks.buildAquariusRouterSwap.mockResolvedValue(offlineXdr());
    sorobanMocks.buildArkaCreditAction.mockResolvedValue(offlineXdr());
    sorobanMocks.buildArkaDeposit.mockResolvedValue(offlineXdr());
    sorobanMocks.buildArkaRebalance.mockResolvedValue(offlineXdr());
    sorobanMocks.buildArkaRedeem.mockResolvedValue(offlineXdr());
    sorobanMocks.buildSoroswapRouterSwap.mockResolvedValue(offlineXdr());
    sorobanMocks.buildSoroswapRouterSwapForPath.mockResolvedValue(
      offlineXdr(),
    );
    sorobanMocks.buildTokenApprove.mockResolvedValue(offlineXdr());
    walletKitMocks.defaultKit.signTransaction.mockResolvedValue({
      signedTxXdr: offlineXdr(),
    });
    routePlanApiMocks.requestRebalanceRoutePlan.mockReset();
    routePlanApiMocks.requestRebalanceRoutePlan.mockRejectedValue(
      new Error("backend solver unavailable"),
    );
    runtimeHealthState.balanced = {
      validatedAt: null,
      adapterBalanced: "",
      poolId: 1,
      supportStatus: "blocked",
      readyForDappExecution: false,
      laneMode: "legacy_comet",
      blockingReasons: ["Balanced lane is still blocked."],
      observedRouter: null,
      expectedRouter: null,
      poolSupported: false,
      pairConfigured: false,
      validatedModule: {
        present: false,
        validatedAt: null,
        router: null,
        poolId: 0,
        sourceValidations: [],
        source: "fallback",
      },
      source: "fallback",
    };
    global.fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      // These are legacy-view tests; the identity API fixture explicitly qualifies V2.
      const identityUrl=String(input);
      if(identityUrl.startsWith('/api/v3-release/identity?fund='))return new Response(JSON.stringify({id:decodeURIComponent(identityUrl.split('fund=')[1]),version:2}),{status:200,headers:{'content-type':'application/json'}});
      const url =
        typeof input === "string"
          ? input
          : input instanceof URL
            ? input.toString()
            : "url" in input
              ? input.url
              : String(input);
      if (url.includes("/api/health")) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            app: "ok",
            catalog: {
              configured: true,
              reachable: true,
              healthy: true,
              degraded: false,
              statusCode: 200,
              evaluatedAt: null,
            },
            protocols: {
              balanced: runtimeHealthState.balanced,
            },
          }),
        } as unknown as Response;
      }
      if (
        url.includes("/api/catalog/v1/arkas/") &&
        url.includes("/activity")
      ) {
        const now = new Date();
        return {
          ok: true,
          status: 200,
          headers: {
            get: () => "application/json",
          },
          json: async () => ({
            total: 5,
            offset: 0,
            limit: 200,
            items: [
              {
                eventId: "borrow-live",
                cursor: "borrow-live",
                arkaId: "TEST_BLEND_VAULT",
                manager:
                  "GMANAGER7777777777777777777777777777777777777777777777777777",
                kind: "borrow",
                ledger: 100,
                ledgerClosedAt: now.toISOString(),
                txHash: "TX_BORROW",
                transactionIndex: 0,
                operationIndex: 0,
                inSuccessfulContractCall: true,
                user: null,
                assetContract: defaultRoutingAssetA,
                marketId: "7",
                amount: "300000",
                shares: null,
                netOut: null,
                stepCount: 1,
              },
              {
                eventId: "withdraw-live",
                cursor: "withdraw-live",
                arkaId: "TEST_BLEND_VAULT",
                manager:
                  "GMANAGER7777777777777777777777777777777777777777777777777777",
                kind: "withdraw",
                ledger: 101,
                ledgerClosedAt: now.toISOString(),
                txHash: "TX_WITHDRAW",
                transactionIndex: 0,
                operationIndex: 1,
                inSuccessfulContractCall: true,
                user: null,
                assetContract: defaultRoutingAssetB,
                marketId: "7",
                amount: null,
                shares: null,
                netOut: "200000",
                stepCount: 1,
              },
              {
                eventId: "deposit-ignored",
                cursor: "deposit-ignored",
                arkaId: "TEST_BLEND_VAULT",
                manager:
                  "GMANAGER7777777777777777777777777777777777777777777777777777",
                kind: "deposit",
                ledger: 102,
                ledgerClosedAt: now.toISOString(),
                txHash: "TX_DEPOSIT",
                transactionIndex: 0,
                operationIndex: 2,
                inSuccessfulContractCall: true,
                user:
                  "GACCOUNT77777777777777777777777777777777777777777777777777",
                assetContract: defaultRoutingAssetA,
                marketId: null,
                amount: "99000000",
                shares: "99000000",
                netOut: null,
                stepCount: 1,
              },
              {
                eventId: "failed-ignored",
                cursor: "failed-ignored",
                arkaId: "TEST_BLEND_VAULT",
                manager:
                  "GMANAGER7777777777777777777777777777777777777777777777777777",
                kind: "borrow",
                ledger: 103,
                ledgerClosedAt: now.toISOString(),
                txHash: "TX_FAILED",
                transactionIndex: 0,
                operationIndex: 3,
                inSuccessfulContractCall: false,
                user: null,
                assetContract: defaultRoutingAssetA,
                marketId: "7",
                amount: "5000000",
                shares: null,
                netOut: null,
                stepCount: 1,
              },
              {
                eventId: "stale-ignored",
                cursor: "stale-ignored",
                arkaId: "TEST_BLEND_VAULT",
                manager:
                  "GMANAGER7777777777777777777777777777777777777777777777777777",
                kind: "repay",
                ledger: 104,
                ledgerClosedAt: new Date(
                  now.getTime() - 25 * 60 * 60 * 1000,
                ).toISOString(),
                txHash: "TX_STALE",
                transactionIndex: 0,
                operationIndex: 4,
                inSuccessfulContractCall: true,
                user: null,
                assetContract: defaultRoutingAssetA,
                marketId: "7",
                amount: "11000000",
                shares: null,
                netOut: null,
                stepCount: 1,
              },
            ],
          }),
        } as unknown as Response;
      }
      if (
        url.includes("/api/catalog/v1/arkas/") &&
        url.includes("/holders")
      ) {
        return {
          ok: true,
          status: 200,
          headers: {
            get: () => "application/json",
          },
          json: async () => ({
            arkaId: "TEST_BLEND_VAULT",
            shareToken: "CSHARETOKEN123456789",
            totalShares: "100000000",
            indexedAt: new Date().toISOString(),
            complete: false,
            ...holderCacheState,
            coverageFromLedger: 100,
            coverageToLedger: 200,
            total: 2,
            offset: 0,
            limit: 10,
            items: [
              {
                holder: "GMANAGER7777777777777777777777777777777777777777777777777777",
                shares: "13000000",
                ownershipBps: 1300,
                firstSeenLedger: 100,
                lastActivityLedger: 190,
              },
              {
                holder: "GACCOUNT77777777777777777777777777777777777777777777777777",
                shares: "87000000",
                ownershipBps: 8700,
                firstSeenLedger: 101,
                lastActivityLedger: 200,
              },
            ],
          }),
        } as unknown as Response;
      }
      if (url.includes("/api/catalog/v1/prices/")) {
        const assetContract = decodeURIComponent(url.split("/v1/prices/")[1] ?? "");
        const unavailable = catalogPriceState.unavailableAssets.has(assetContract);
        return {
          ok: true,
          status: 200,
          headers: {
            get: () => "application/json",
          },
          json: async () => ({
            assetContract,
            priceUsd: unavailable ? null : "10000000",
            decimals: 7,
            timestamp: new Date().toISOString(),
            oracleStatus: unavailable ? "missing_price" : "verified",
            valuationSource: unavailable ? "unavailable" : "oracle_verified",
            primaryUsable: unavailable ? false : true,
            secondaryUsable: unavailable ? false : true,
            unavailableReason: unavailable ? "No live valuation is available." : null,
            observedAt: new Date().toISOString(),
          }),
        } as unknown as Response;
      }
      const payload =
        typeof init?.body === "string" ? (JSON.parse(init.body) as { method?: string }) : {};
      if (payload.method === "sendTransaction") {
        return {
          ok: true,
          json: async () => ({ result: { hash: "TXHASH123" } }),
        } as Response;
      }
      if (payload.method === "getTransaction") {
        return {
          ok: true,
          json: async () => ({ result: { status: "SUCCESS" } }),
        } as Response;
      }
      return {
        ok: true,
        json: async () => ({}),
      } as Response;
    }) as unknown as typeof fetch;
  });

  it.each([false, true])("labels last-verified ownership honestly while refresh is delayed=%s", async (failed) => {
    holderCacheState.stale = true;
    holderCacheState.refreshFailed = failed;
    await renderVerifiedLegacyPage();
    await waitFor(() => expect(screen.getByTestId("arka-investors-table")).toBeInTheDocument());
    const note=screen.getByTestId("arka-investors-verification-note");
    expect(note).toHaveTextContent("Last on-chain verification:");
    expect(note).toHaveTextContent(failed ? "Balance refresh is delayed" : "Refreshing balances");
    expect(note).toHaveTextContent("showing the last verified balances");
    expect(screen.getByTestId("arka-investors-table")).toHaveTextContent("87%");
  });

  it("uses canonical vault ownership when the legacy share-token balance is zero", async () => {
    sorobanMocks.readArkaShares.mockResolvedValue(95_165_680);
    sorobanMocks.readArkaTotalShares.mockResolvedValue(96_242_762);
    const tokenReader=sorobanMocks.readTokenBalance.getMockImplementation()!;
    sorobanMocks.readTokenBalance.mockImplementation(async (...args) => args[0]==="CSHARETOKEN123456789" ? 0 : tokenReader(...args));
    await renderVerifiedLegacyPage();
    await waitFor(() => expect(screen.getByTestId("arka-stage-summary-list")).toHaveTextContent("98.88%"));
    expect(screen.getByTestId("arka-stage-summary-list")).toHaveTextContent("9.5166 shares");
    expect(sorobanMocks.readArkaShares).toHaveBeenCalled();
  });

  it("reports failed ownership reads as unavailable instead of zero shares", async () => {
    sorobanMocks.readArkaShares.mockRejectedValue(new Error("RPC unavailable"));
    await renderVerifiedLegacyPage();
    await waitFor(() => expect(screen.getByTestId("arka-investors-table")).toBeInTheDocument());
    await waitFor(()=>expect(screen.getByTestId("arka-stage-summary-list")).toHaveTextContent("My ownershipUnavailable"));
    expect(screen.getByTestId("arka-stage-summary-list")).not.toHaveTextContent("0 shares");
  });

  it("keeps an unavailable NAV distinct from a zero-value vault in the action stage", async () => {
    sorobanMocks.readArkaNav.mockRejectedValue(new Error("BlendNavUnavailable"));
    await renderVerifiedLegacyPage();
    await waitFor(() => expect(screen.getByTestId("arka-investors-table")).toBeInTheDocument());
    expect(screen.getByTestId("arka-stage-summary-list")).toHaveTextContent("Vault valueUnavailable");
    expect(screen.getByTestId("arka-stage-summary-list")).not.toHaveTextContent("Vault value0");
  });

  it("does not show no debt or available market checks when Blend reads fail", async () => {
    sorobanMocks.readArkaCreditMarketValue.mockResolvedValue(null);
    sorobanMocks.readArkaCreditMarketStatus.mockResolvedValue(null);
    sorobanMocks.readArkaCreditPositionValues.mockRejectedValue(new Error("RPC unavailable"));
    const user = userEvent.setup();
    await renderVerifiedLegacyPage();
    await openWorkspace(user, "credit");
    await waitFor(() => expect(screen.getByTestId("credit-read-status")).toHaveTextContent("Position data is incomplete"));
    expect(screen.getByTestId("credit-health-factor")).toHaveTextContent("Unavailable");
    expect(screen.getByTestId("credit-debt-live")).toHaveTextContent("Unavailable");
    expect(screen.getByTestId("credit-collateral-live")).toHaveTextContent("Unavailable");
    expect(screen.getByTestId("credit-oracle-age")).toHaveTextContent("Unavailable");
    expect(screen.getByTestId("credit-pool-status")).not.toHaveTextContent("Available");
    expect(screen.getByTestId("credit-run-button")).toBeDisabled();
  });

  it("keeps Blend balances in a checking state while reads are pending", async () => {
    let resolveRead!: (value: null) => void;
    sorobanMocks.readArkaCreditMarketValue.mockImplementation(() => new Promise((resolve) => { resolveRead = resolve; }));
    const user = userEvent.setup();
    await renderVerifiedLegacyPage();
    await openWorkspace(user, "credit");
    await waitFor(() => expect(sorobanMocks.readArkaCreditMarketValue).toHaveBeenCalled());
    expect(screen.getByTestId("credit-health-factor")).toHaveTextContent("Checking");
    expect(screen.getByTestId("credit-debt-live")).toHaveTextContent("Checking");
    expect(screen.queryByTestId("credit-run-button")).not.toBeInTheDocument();
    resolveRead(null);
    await waitFor(() => expect(screen.getByTestId("credit-health-factor")).toHaveTextContent("Unavailable"));
  });

  it("refreshes the selected Blend market instead of keeping the previous market position", async () => {
    const base = (await sorobanMocks.readArkaCreditMarketConfigs())[0];
    sorobanMocks.readArkaCreditMarketConfigs.mockResolvedValue([base, { ...base, market_id: 8 }]);
    const user = userEvent.setup();
    await renderVerifiedLegacyPage();
    await openWorkspace(user, "credit");
    await waitFor(() => expect(screen.getByTestId("credit-market-select")).toHaveValue("7"));
    await user.selectOptions(screen.getByTestId("credit-market-select"), "8");
    await waitFor(() => expect(sorobanMocks.readArkaCreditMarketValue).toHaveBeenCalledWith(expect.any(String), "Blend", 8, expect.anything()));
    await waitFor(() => expect(screen.getByTestId("credit-read-status")).toHaveTextContent("Position checked"));
    expect(screen.getByTestId("credit-market-select")).toHaveValue("8");
  });

  it("renders a Figma-aligned live vault stage plus stateful execution workspaces", async () => {
    const user = userEvent.setup();
    await renderVerifiedLegacyPage();

    await waitFor(() =>
      expect(
        screen.getByRole("heading", { name: /^TEST_BLEND_VAULT$/i }),
      ).toBeInTheDocument(),
    );

    expect(screen.getByTestId("arka-stage-panel")).toHaveTextContent("Arka");
    expect(screen.getByTestId("arka-stage-panel")).toHaveTextContent("Manager access");
    expect(screen.getByTestId("arka-workspace-tabs")).toHaveTextContent("Deposit & withdraw");
    expect(
      screen.getByRole("navigation", { name: "Arka actions" }),
    ).not.toHaveTextContent("Swap");
    expect(screen.getByTestId("arka-stage-summary-list")).toHaveTextContent("Vault value");
    expect(screen.getByTestId("arka-stage-summary-list")).toHaveTextContent("My ownership");
    await waitFor(()=>expect(screen.getByTestId("arka-stage-summary-list")).toHaveTextContent("shares"));
    expect(screen.getByTestId("arka-stage-summary-list")).not.toHaveTextContent(/\bunits\b/i);
    expect(screen.getByTestId("arka-stage-summary-list")).toHaveTextContent("My investments");
    expect(screen.getByTestId("arka-state-panel")).toHaveTextContent("Arka details");
    await waitFor(() => expect(screen.getByTestId("arka-investors-table")).toBeInTheDocument());
    expect(screen.getByTestId("arka-investors-table")).toHaveTextContent("87%");
    expect(screen.getByTestId("arka-investors-table")).toHaveTextContent("Position value");
    expect(screen.getByTestId("arka-investors-table")).toHaveTextContent("Value unavailable");
    expect(screen.getByTestId("arka-investors-indexing-note")).toHaveTextContent(
      "Balances shown below were verified on-chain",
    );
    expect(screen.getByTestId("arka-investors-verification-note")).toHaveTextContent("Last on-chain verification:");
    expect(screen.getByTestId("arka-investors-panel")).not.toHaveTextContent("BPS");
    expect(screen.queryByTestId("arka-flow-panel")).not.toBeInTheDocument();
    expect(screen.queryByTestId("arka-rebalance-panel")).not.toBeInTheDocument();
    expect(screen.queryByTestId("arka-credit-panel")).not.toBeInTheDocument();

    await openWorkspace(user, "flow");
    expect(screen.getByTestId("arka-flow-panel")).toHaveTextContent("Deposit or withdraw");
    expect(screen.queryByTestId("arka-state-panel")).not.toBeInTheDocument();
    const flowAssetSelect = screen.getByTestId("arka-asset-select") as HTMLSelectElement;
    expect(flowAssetSelect.options).toHaveLength(3);
    await user.selectOptions(flowAssetSelect, defaultMidAsset);
    expect(screen.getByTestId("arka-asset-select")).toHaveValue(defaultMidAsset);

    await openWorkspace(user, "rebalance");
    expect(screen.getByTestId("arka-rebalance-panel")).toHaveTextContent("Swap");
    expect(screen.queryByTestId("arka-flow-panel")).not.toBeInTheDocument();
    expect(screen.getByTestId("rebalance-asset-in-select")).toBeInTheDocument();
    expect(screen.getByTestId("rebalance-asset-out-select")).toBeInTheDocument();
    const swapAssetIn = screen.getByTestId("rebalance-asset-in-select") as HTMLSelectElement;
    const swapAssetOut = screen.getByTestId("rebalance-asset-out-select") as HTMLSelectElement;
    await user.selectOptions(swapAssetIn, defaultRoutingAssetB);
    await user.selectOptions(swapAssetOut, defaultRoutingAssetA);
    expect(swapAssetIn).toHaveValue(defaultRoutingAssetB);
    expect(swapAssetOut).toHaveValue(defaultRoutingAssetA);

    await openWorkspace(user, "credit");
    expect(screen.getByTestId("arka-credit-panel")).toHaveTextContent("Blend");
    expect(screen.getByTestId("credit-health-factor")).toHaveTextContent("1.45");
    expect(screen.getByTestId("credit-market-name")).toHaveTextContent("Blend");
    // The supplied token and the fund denomination differ in this fixture.
    expect(screen.getByTestId("credit-net-live")).toHaveTextContent(`3.5 ${resolveAssetDisplayLabel(defaultRoutingAssetA)}`);
    expect(screen.getByTestId("credit-net-live")).not.toHaveTextContent(`3.5 ${resolveAssetDisplayLabel(defaultRoutingAssetB)}`);
    expect(screen.getByTestId("credit-action-picker")).toHaveTextContent("Supply");
    expect(screen.queryByTestId("credit-protocol-select")).not.toBeInTheDocument();
    expect(screen.queryByTestId("credit-market-select")).not.toBeInTheDocument();
    expect(screen.getByTestId("credit-market-details")).not.toHaveAttribute("open");
    expect(screen.getByTestId("arka-credit-panel")).not.toHaveTextContent("Capability map");
    expect(screen.getByTestId("arka-credit-panel")).not.toHaveTextContent("Execution ready");
  });

  it("keeps approved assets visible but prevents deposits without live valuation", async () => {
    catalogPriceState.unavailableAssets.add(defaultMidAsset);
    const user = userEvent.setup();
    await renderVerifiedLegacyPage();

    await openWorkspace(user, "flow");
    const select = await screen.findByTestId("arka-asset-select");

    await waitFor(() => {
      const option = Array.from((select as HTMLSelectElement).options).find(
        (entry) => entry.value === defaultMidAsset,
      );
      expect(option).toBeDefined();
      expect(option).toBeDisabled();
      expect(option).toHaveTextContent(/pricing unavailable/i);
    });
    expect(screen.getByText(/available for deposit:/i)).toBeInTheDocument();
    expect(screen.getByTestId("arka-deposit-button")).toBeEnabled();
  });

  it("keeps the complete investor address list in the manager workspace", async () => {
    window.localStorage.setItem(
      "wallet:pubkey",
      "GVIEWER7777777777777777777777777777777777777777777777777777",
    );
    await renderVerifiedLegacyPage();

    await waitFor(() => expect(screen.getByTestId("arka-stage-panel")).toHaveTextContent("Investor"));
    await waitFor(() => expect(screen.getByTestId("arka-stage-panel")).toHaveTextContent("2+ investors"));
    expect(screen.queryByTestId("arka-investors-panel")).not.toBeInTheDocument();
  });

  it("lets investors request a redemption in the Arka denomination instead of shares", async () => {
    const user = userEvent.setup();
    await renderVerifiedLegacyPage();

    await openWorkspace(user, "flow");
    await waitFor(() =>
      expect(screen.getByTestId("arka-redeem-section")).toHaveTextContent(
        /your position value, estimated1\.976/i,
      ),
    );
    expect(screen.getByTestId("arka-redeem-amount-input")).toHaveAccessibleName(
      /amount to withdraw in/i,
    );
    expect(screen.getByTestId("arka-redemption-quote")).toHaveTextContent(
      /shares for about 1 /i,
    );

    await user.click(screen.getByTestId("arka-redeem-button"));

    await waitFor(() =>
      expect(sorobanMocks.buildArkaRedeem).toHaveBeenCalledWith(
        "GMANAGER7777777777777777777777777777777777777777777777777777",
        "TEST_BLEND_VAULT",
        6_578_948,
      ),
    );
    await waitFor(() =>
      expect(screen.getByTestId("vault-status")).toHaveTextContent(
        /redemption confirmed: about 1 .+shares/i,
      ),
    );
  });

  it('separates position value from shared cash and fills only the available estimate',async()=>{
    sorobanMocks.readArkaLiquidBalance.mockResolvedValue(5_000_000);
    const user=userEvent.setup();await renderVerifiedLegacyPage();await openWorkspace(user,'flow');
    await waitFor(()=>expect(screen.getByTestId('withdrawal-balances')).toHaveTextContent('0.5'));
    expect(screen.getByTestId('arka-redeem-button')).toBeDisabled();
    expect(screen.getByTestId('arka-redeem-all-button')).toBeDisabled();
    expect(screen.getByText(/fund has less cash than this amount/i)).toBeInTheDocument();
    await user.click(screen.getByTestId('arka-use-available-button'));
    expect(screen.getByTestId('arka-redeem-amount-input')).toHaveValue('0.5');
    expect(screen.getByTestId('arka-redeem-button')).toBeEnabled();
    expect(sorobanMocks.buildArkaRedeem).not.toHaveBeenCalled();
  });

  it('does not treat unavailable cash as zero or allow an unverified withdrawal',async()=>{
    sorobanMocks.readArkaLiquidBalance.mockRejectedValue(new Error('RPC unavailable'));
    const user=userEvent.setup();await renderVerifiedLegacyPage();await openWorkspace(user,'flow');
    await waitFor(()=>expect(screen.getByTestId('withdrawal-balances')).toHaveTextContent('Cash unavailable'));
    expect(screen.getByTestId('arka-redeem-button')).toBeDisabled();
    expect(screen.getByTestId('arka-redeem-all-button')).toBeDisabled();
  });

  it('keeps manager actions out of the investor tabs and does not grant authority by switching views',async()=>{
    window.localStorage.setItem('wallet:pubkey','GVIEWER7777777777777777777777777777777777777777777777777777');
    const user=userEvent.setup();await renderVerifiedLegacyPage();
    expect(screen.queryByTestId('arka-workspace-tab-rebalance')).not.toBeInTheDocument();
    await openWorkspace(user,'rebalance');
    expect(screen.getByText(/both the input and output belong to the fund/i)).toBeInTheDocument();
    expect(screen.queryByTestId('rebalance-confirm-button')).not.toBeInTheDocument();
    expect(screen.queryByTestId('arka-workspace-tab-flow')).not.toBeInTheDocument();
  });

  it("fails closed when the on-chain credit configuration cannot be read", async () => {
    sorobanMocks.readArkaCreditProtocols.mockRejectedValue(
      new Error("credit configuration RPC unavailable"),
    );
    const user = userEvent.setup();
    await renderVerifiedLegacyPage();

    await openWorkspace(user, "credit");

    await waitFor(() =>
      expect(screen.getByTestId("credit-configuration-unavailable")).toHaveTextContent(
        /temporarily unavailable/i,
      ),
    );
    expect(screen.queryByTestId("credit-protocol-select")).not.toBeInTheDocument();
    expect(screen.queryByTestId("credit-action-picker")).not.toBeInTheDocument();
    expect(screen.queryByTestId("credit-action-borrow")).not.toBeInTheDocument();
    expect(screen.queryByTestId("credit-market-select")).not.toBeInTheDocument();
    expect(screen.queryByTestId("credit-run-button")).not.toBeInTheDocument();
    expect(sorobanMocks.buildArkaCreditAction).not.toHaveBeenCalled();
  });

  it('stops before building or signing if a fresh quote falls below the reviewed minimum',async()=>{
    const user=userEvent.setup();
    const candidate=mockSoroswapMultiHopRoutePlan();
    await renderVerifiedLegacyPage();
    await openWorkspace(user,'rebalance');
    await waitFor(()=>expect(screen.getByTestId('rebalance-route-summary')).toHaveTextContent('Best execution selected SoroSwap multi-hop'));
    await user.click(screen.getByTestId('rebalance-run-button'));
    expect(screen.getByTestId('fund-swap-review')).toBeVisible();
    expect(walletKitMocks.defaultKit.signTransaction).not.toHaveBeenCalled();
    mockSoroswapMultiHopRoutePlan({...candidate,minOutBase:candidate.minOutBase-1});
    await user.click(screen.getByTestId('rebalance-confirm-button'));
    await waitFor(()=>expect(screen.getByTestId('rebalance-error')).toHaveTextContent(/no longer meets the minimum you reviewed/i));
    expect(sorobanMocks.buildArkaRebalance).not.toHaveBeenCalled();
    expect(sorobanMocks.buildSwapStepScVal).not.toHaveBeenCalled();
    expect(walletKitMocks.defaultKit.signTransaction).not.toHaveBeenCalled();
    expect(countRpcMethod('sendTransaction')).toBe(0);
  });

  it("shows human-readable borrowing limits and blocks Borrow without an on-chain policy", async () => {
    const user = userEvent.setup();
    await renderVerifiedLegacyPage();

    await openWorkspace(user, "credit");
    await user.click(screen.getByTestId("credit-action-borrow"));
    await waitFor(() =>
      expect(screen.getByTestId("credit-borrow-policy")).toHaveTextContent(
        /borrow up to 2\.5 .* per transaction/i,
      ),
    );

    sorobanMocks.readArkaCreditBorrowPolicy.mockResolvedValue(null);
    await user.selectOptions(screen.getByTestId("credit-asset-select"), defaultRoutingAssetB);

    await waitFor(() =>
      expect(screen.getByTestId("credit-borrow-policy-unavailable")).toHaveTextContent(
        /borrowing is not enabled for .* in this market/i,
      ),
    );
    expect(screen.getByTestId("credit-run-button")).toBeDisabled();
  });

  it("limits Blend actions to the configured XLM/USDC market assets", async () => {
    sorobanMocks.readArkaCreditMarketAssets.mockResolvedValue([]);
    sorobanMocks.readBlendSupportedAssets.mockResolvedValue([
      defaultRoutingAssetA,
      defaultRoutingAssetB,
    ]);
    const user = userEvent.setup();
    await renderVerifiedLegacyPage();

    await openWorkspace(user, "credit");

    const select = screen.getByTestId("credit-asset-select") as HTMLSelectElement;
    await waitFor(() => expect(select.options).toHaveLength(2));
    expect(Array.from(select.options).map((option) => option.value)).toEqual([
      defaultRoutingAssetA,
      defaultRoutingAssetB,
    ]);
    expect(screen.getByTestId("credit-market-name")).not.toHaveTextContent("CMIDTOKEN");
  });

  it("selects the Blend market asset that currently has funds in the Arka", async () => {
    sorobanMocks.readArkaLiquidBalance.mockImplementation(
      async (_arkaId: string, asset: string) =>
        asset === defaultRoutingAssetB ? 22_000_000 : 0,
    );
    const user = userEvent.setup();
    await renderVerifiedLegacyPage();

    await openWorkspace(user, "credit");

    await waitFor(() =>
      expect(screen.getByTestId("credit-asset-select")).toHaveValue(defaultRoutingAssetB),
    );
    expect(screen.getByTestId("arka-credit-panel")).toHaveTextContent(
      /Available in this Arka: 2\.2/i,
    );
  });

  it("blocks Borrow until Blend has a verified market risk source", async () => {
    sorobanMocks.readArkaCreditMarketRiskSource.mockResolvedValue(null);
    const user = userEvent.setup();
    await renderVerifiedLegacyPage();

    await openWorkspace(user, "credit");
    await user.click(screen.getByTestId("credit-action-borrow"));
    await waitFor(() =>
      expect(screen.getByTestId("credit-borrow-source-unavailable")).toHaveTextContent(
        /borrowing setup is not complete/i,
      ),
    );
    expect(screen.getByTestId("credit-borrow-policy")).toBeInTheDocument();
    expect(screen.getByTestId("credit-run-button")).toBeDisabled();
    expect(sorobanMocks.buildArkaCreditAction).not.toHaveBeenCalled();
  });

  it("fills Repay from the live outstanding debt and rejects an amount above it", async () => {
    const user = userEvent.setup();
    sorobanMocks.readArkaCreditPositionValues.mockResolvedValue([
      {
        asset: defaultRoutingAssetB,
        collateral_amount: 50_000_000,
        debt_amount: 15_000_000,
        net_value: 35_000_000,
        price: 10_000_000,
      },
    ]);
    await renderVerifiedLegacyPage();

    await openWorkspace(user, "credit");
    await user.selectOptions(screen.getByTestId("credit-asset-select"), defaultRoutingAssetB);
    await user.click(screen.getByTestId("credit-action-repay"));

    await waitFor(() =>
      expect(screen.getByTestId("credit-outstanding-debt")).toHaveTextContent(
        /outstanding debt: 1\.5/i,
      ),
    );
    await user.click(screen.getByTestId("credit-repay-full"));
    expect(screen.getByTestId("credit-amount-input")).toHaveValue("1.5");

    await user.clear(screen.getByTestId("credit-amount-input"));
    await user.type(screen.getByTestId("credit-amount-input"), "1.5000001");
    await user.click(screen.getByTestId("credit-run-button"));

    await waitFor(() =>
      expect(screen.getByTestId("credit-error")).toHaveTextContent(
        /enter no more than the outstanding debt: 1\.5/i,
      ),
    );
    expect(sorobanMocks.buildArkaCreditAction).not.toHaveBeenCalled();
  });

  function setDebtFreeOnIceMarket() {
    sorobanMocks.readArkaCreditPositionValues.mockResolvedValue([
      { asset: defaultRoutingAssetA, collateral_amount: 50_000_000, debt_amount: 0, debt_shares: 0, net_value: 50_000_000, price: 10_000_000 },
    ]);
    sorobanMocks.readArkaCreditMarketValue.mockResolvedValue({ collateral_value: 50_000_000, debt_value: 0, net_value: 50_000_000, health_factor: 0 });
    sorobanMocks.readArkaCreditMarketStatus.mockResolvedValue({
      pool_status: 3, risky_actions_blocked: true, nav_blocked: false, debt_value: 0,
      has_stale_oracle: false, has_invalid_oracle_data: false, has_future_oracle_timestamp: false, has_disabled_reserve: false,
    });
  }

  it('allows a debt-free On-Ice withdrawal to reach the exact-action simulation and selected wallet', async () => {
    setDebtFreeOnIceMarket();
    useDisconnectedProvider();
    const user = userEvent.setup();
    await renderVerifiedLegacyPage();
    await openWorkspace(user, 'credit');
    await user.click(screen.getByTestId('credit-action-withdraw'));
    await waitFor(() => expect(screen.getByTestId('credit-run-button')).toBeEnabled());
    expect(screen.getByTestId('credit-health-factor')).toHaveTextContent('No debt');
    expect(screen.getByTestId('credit-action-restriction')).toHaveTextContent('Returning assets to the fund can be reviewed');
    await user.click(screen.getByTestId('credit-run-button'));
    await waitFor(() => expect(walletKitMocks.providerDisconnectKit.signTransaction).toHaveBeenCalled());
    expect(sorobanMocks.buildArkaCreditAction).toHaveBeenCalledWith(expect.any(String), 'TEST_BLEND_VAULT', 'Blend', 'Withdraw', 7, defaultRoutingAssetA, 10_000_000);
    expect(sorobanMocks.readArkaCreditMarketStatus.mock.calls.length).toBeGreaterThan(1);
    expect(countRpcMethod('sendTransaction')).toBe(0);
  });

  it('keeps borrowing and debt-bearing On-Ice withdrawals blocked, including debt in another asset', async () => {
    setDebtFreeOnIceMarket();
    sorobanMocks.readArkaCreditPositionValues.mockResolvedValue([
      { asset: defaultRoutingAssetA, collateral_amount: 50_000_000, debt_amount: 0, net_value: 50_000_000 },
      { asset: defaultRoutingAssetB, collateral_amount: 0, debt_amount: 1, net_value: -1 },
    ]);
    const user = userEvent.setup();
    await renderVerifiedLegacyPage();
    await openWorkspace(user, 'credit');
    await user.click(screen.getByTestId('credit-action-withdraw'));
    await waitFor(() => expect(screen.getByTestId('credit-read-status')).toHaveTextContent('Position checked'));
    expect(screen.getByTestId('credit-run-button')).toBeDisabled();
    await user.click(screen.getByTestId('credit-action-borrow'));
    expect(screen.getByTestId('credit-run-button')).toBeDisabled();
    expect(sorobanMocks.buildArkaCreditAction).not.toHaveBeenCalled();
  });

  it.each(['new debt', 'RPC failure', 'frozen market'])('rechecks a debt-free withdrawal before build/sign and stops on %s', async reason => {
    setDebtFreeOnIceMarket();
    const user = userEvent.setup();
    await renderVerifiedLegacyPage();
    await openWorkspace(user, 'credit');
    await user.click(screen.getByTestId('credit-action-withdraw'));
    await waitFor(() => expect(screen.getByTestId('credit-run-button')).toBeEnabled());
    if (reason === 'RPC failure') sorobanMocks.readArkaCreditMarketStatus.mockRejectedValueOnce(new Error('RPC unavailable'));
    else if (reason === 'frozen market') sorobanMocks.readArkaCreditMarketStatus.mockResolvedValueOnce({ debt_value: 0, risky_actions_blocked: true, nav_blocked: true, pool_status: 4 });
    else sorobanMocks.readArkaCreditPositionValues.mockResolvedValueOnce([{ asset: defaultRoutingAssetB, debt_amount: 1 }]);
    await user.click(screen.getByTestId('credit-run-button'));
    await waitFor(() => expect(screen.getByTestId('credit-error')).not.toBeEmptyDOMElement());
    expect(sorobanMocks.buildArkaCreditAction).not.toHaveBeenCalled();
    expect(walletKitMocks.defaultKit.signTransaction).not.toHaveBeenCalled();
    expect(countRpcMethod('sendTransaction')).toBe(0);
  });

  it("keeps allowed deposit assets selectable when wallet balance reads as zero", async () => {
    sorobanMocks.readTokenBalance.mockImplementation(async (asset: string) => {
      if (asset === "CSHARETOKEN123456789") return 13_000_000;
      return 0;
    });

    const user = userEvent.setup();
    await renderVerifiedLegacyPage();

    await openWorkspace(user, "flow");

    const select = screen.getByTestId("arka-asset-select") as HTMLSelectElement;
    await waitFor(() => expect(select.options.length).toBe(3));
    for (const option of Array.from(select.options)) {
      expect(option.disabled).toBe(false);
    }

    await user.selectOptions(select, defaultMidAsset);
    expect(select).toHaveValue(defaultMidAsset);
  });

  it("keeps every whitelisted Arka asset available in the swap selectors", async () => {
    const whitelistedAssets = [
      defaultRoutingAssetA,
      defaultRoutingAssetB,
      defaultMidAsset,
      `C${"A".repeat(55)}`,
      `C${"B".repeat(55)}`,
      `C${"C".repeat(55)}`,
      `C${"D".repeat(55)}`,
    ];
    sorobanMocks.readArkaWhitelist.mockResolvedValue(whitelistedAssets);

    const user = userEvent.setup();
    await renderVerifiedLegacyPage();

    await openWorkspace(user, "rebalance");

    const assetIn = screen.getByTestId("rebalance-asset-in-select") as HTMLSelectElement;
    const assetOut = screen.getByTestId("rebalance-asset-out-select") as HTMLSelectElement;
    await waitFor(() => expect(assetIn.options.length).toBe(7));
    expect(assetOut.options.length).toBe(7);
    expect(Array.from(assetOut.options, (option) => option.value)).toEqual(whitelistedAssets);
  });

  it("shows all four enabled Blend actions without an unavailable warning", async () => {
    const user = userEvent.setup();
    await renderVerifiedLegacyPage();

    await openWorkspace(user, "credit");

    await waitFor(() => expect(screen.getByTestId("credit-action-supply")).toBeEnabled());
    expect(screen.getByTestId("credit-action-borrow")).toBeEnabled();
    expect(screen.getByTestId("credit-action-repay")).toBeEnabled();
    expect(screen.getByTestId("credit-action-withdraw")).toBeEnabled();
    expect(screen.queryByText(/Blend is not available for this Arka/i)).not.toBeInTheDocument();
  });

  it("opens deposits on the Arka denomination even when credit assets use another token", async () => {
    sorobanMocks.readArkaDenomination.mockResolvedValue(defaultMidAsset);
    sorobanMocks.readArkaCreditMarketAssets.mockResolvedValue([
      defaultRoutingAssetA,
      defaultRoutingAssetB,
    ]);

    const user = userEvent.setup();
    await renderVerifiedLegacyPage();

    await openWorkspace(user, "flow");

    const select = screen.getByTestId("arka-asset-select") as HTMLSelectElement;
    await waitFor(() => expect(select).toHaveValue(defaultMidAsset));
    expect(screen.getByTestId("arka-flow-panel")).toHaveTextContent(
      "Amount in",
    );
    expect(screen.getByTestId("arka-deposit-button")).toHaveTextContent(
      /Deposit 1/i,
    );
  });

  it("hydrates and writes workspace query parameters without hash anchors", async () => {
    navigationState.search = "workspace=credit";
    const user = userEvent.setup();
    await renderVerifiedLegacyPage();

    await waitFor(() =>
      expect(screen.getByTestId("arka-credit-panel")).toHaveTextContent("Blend"),
    );

    await openWorkspace(user, "rebalance");
    expect(navigationState.replace).toHaveBeenLastCalledWith(
      "/arkas/TEST_BLEND_VAULT?workspace=rebalance",
      { scroll: false },
    );
    expect(screen.getByTestId("arka-rebalance-workspace")).toBeInTheDocument();

    await openWorkspace(user, "state");
    expect(navigationState.replace).toHaveBeenLastCalledWith("/arkas/TEST_BLEND_VAULT", {
      scroll: false,
    });
    expect(screen.getByTestId("arka-state-workspace")).toBeInTheDocument();
  });

  it("resolves best execution quotes and surfaces the selected route", async () => {
    const user = userEvent.setup();
    await renderVerifiedLegacyPage();

    await waitFor(() =>
      expect(screen.getAllByTestId("arka-stage-panel").length).toBeGreaterThan(0),
    );

    await openWorkspace(user, "rebalance");
    await user.selectOptions(screen.getAllByTestId("rebalance-protocol-select")[0], "AUTO");
    expect(screen.getByRole('checkbox', {name: /advanced/i})).toBeChecked();

    await waitFor(() =>
      expect(screen.getAllByTestId("rebalance-route-summary")[0]).toHaveTextContent("Best execution selected Aquarius"),
    );

    expect(screen.getAllByTestId("rebalance-route-summary")[0]).toHaveTextContent("Aquarius direct");
    expect(screen.getAllByTestId("rebalance-route-summary")[0]).toHaveTextContent("Est. receive");
    expect(screen.getAllByTestId("rebalance-route-summary")[0]).toHaveTextContent("Minimum receive");
    expect(screen.getAllByTestId("rebalance-route-summary")[0]).not.toHaveTextContent(/\b\d+\.\d{5,}\b/);
    expect(screen.getAllByTestId("rebalance-route-summary")[0]).toHaveTextContent("Slippage");
    expect(screen.getAllByTestId("rebalance-route-summary")[0]).toHaveTextContent("Price impact");
    expect(screen.getAllByTestId("rebalance-route-summary")[0]).toHaveTextContent("Markets checked:");
    expect(screen.getAllByTestId("rebalance-route-summary")[0]).toHaveTextContent("Venues:");
    expect(screen.getAllByTestId("rebalance-route-search")[0]).toHaveTextContent(
      "Markets compared",
    );
    expect(screen.getAllByTestId("rebalance-route-search")[0]).toHaveTextContent(
      /venues checked/i,
    );
    expect(screen.getAllByTestId("rebalance-route-search")[0]).toHaveTextContent(
      /quoted/i,
    );
    expect(screen.getAllByTestId("rebalance-split-route")[0]).toHaveTextContent(
      "Execution plan",
    );
    expect(screen.getAllByTestId("rebalance-split-route")[0]).toHaveTextContent(
      /single route selected|recommended across/i,
    );
    expect(screen.getAllByTestId("rebalance-route-candidates")[0]).toHaveTextContent("SoroSwap");
    expect(screen.getAllByTestId("rebalance-route-candidates")[0]).toHaveTextContent("Aquarius");
    expect(screen.getAllByTestId("rebalance-route-candidates")[0]).toHaveTextContent("Quoted");
    expect(screen.getAllByTestId("rebalance-guardrail-evaluation")[0]).toHaveTextContent(
      "Trade limits",
    );
    expect(screen.getAllByTestId("rebalance-guardrail-evaluation")[0]).toHaveTextContent("OK");
    await waitFor(() => {
      expect(screen.getAllByTestId("rebalance-guardrail-state-source")[0]).toHaveTextContent(
        "Recent turnover",
      );
    });
    expect(screen.getAllByTestId("rebalance-guardrail-state-source")[0]).toHaveTextContent(
      "2/5 events counted",
    );
  });

  it("does not present an unresolved route as ready or as a zero-value quote", async () => {
    const pendingQuote = new Promise<number>(() => {});
    sorobanMocks.readSoroswapAmountOut.mockReturnValue(pendingQuote);
    sorobanMocks.readAquariusEstimateOut.mockReturnValue(pendingQuote);
    sorobanMocks.readPhoenixEstimateOut.mockReturnValue(pendingQuote);

    const user = userEvent.setup();
    await renderVerifiedLegacyPage();
    await openWorkspace(user, "rebalance");

    const summary = screen.getAllByTestId("rebalance-route-summary")[0];
    await waitFor(() => expect(summary).toHaveTextContent("Comparing available routes"));
    expect(summary).toHaveTextContent("Comparing...");
    expect(summary).not.toHaveTextContent("Ready");
    expect(summary).not.toHaveTextContent(/Est\. receive0\b/);
    expect(summary).not.toHaveTextContent(/Minimum receive0\b/);
  });

  it("explains why the wallet does not open when no swap route is available", async () => {
    sorobanMocks.readSoroswapAmountOut.mockResolvedValue(0);
    sorobanMocks.readSoroswapAmountOutForPath.mockResolvedValue(0);
    sorobanMocks.readAquariusEstimateOut.mockResolvedValue(0);
    sorobanMocks.readPhoenixEstimateOut.mockResolvedValue(0);

    const user = userEvent.setup();
    await renderVerifiedLegacyPage();
    await openWorkspace(user, "rebalance");

    await waitFor(() =>
      expect(screen.getByTestId("rebalance-route-unavailable-message")).toHaveTextContent(
        /no swap route is available.*wallet opens only when a route is ready to sign/i,
      ),
    );
    expect(screen.getByTestId("rebalance-run-button")).toBeDisabled();
    expect(walletKitMocks.defaultKit.signTransaction).not.toHaveBeenCalled();
  });

  it("surfaces Balanced as a first-class lane with a clear block reason until canonical readiness exists", async () => {
    const user = userEvent.setup();
    await renderVerifiedLegacyPage();

    await waitFor(() =>
      expect(screen.getAllByTestId("arka-stage-panel").length).toBeGreaterThan(0),
    );

    await openWorkspace(user, "rebalance");
    expect(screen.getAllByTestId("rebalance-protocol-select")[0]).toHaveTextContent("Balanced");
    await user.selectOptions(screen.getAllByTestId("rebalance-protocol-select")[0], "BALANCED");
    expect(screen.getByRole('checkbox', {name: /advanced/i})).toBeChecked();

    await waitFor(() =>
      expect(screen.getAllByTestId("rebalance-route-summary")[0]).toHaveTextContent(
        "Balanced has no executable quote",
      ),
    );

    expect(screen.getAllByTestId("rebalance-route-summary")[0]).toHaveTextContent(
      "Balanced: Review required",
    );
    expect(screen.getAllByTestId("rebalance-intent-handoff-summary")[0]).toHaveTextContent(
      /Balanced intent route/i,
    );
    expect(screen.getAllByTestId("rebalance-intent-handoff-route")[0]).toHaveTextContent(
      /Balanced uses intent execution/i,
    );
    expect(screen.getAllByTestId("rebalance-intent-handoff-steps")[0]).toHaveTextContent(
      /Official discovery:|Quote capture:|Execution:|Confirmation:/i,
    );
    expect(screen.getAllByTestId("rebalance-intent-handoff-links")[0]).toHaveTextContent(
      /Official app|Recent Activity|Stellar page|Trade blog|Balanced links are not available/i,
    );
    expect(screen.getAllByTestId("rebalance-route-candidates")[0]).toHaveTextContent(
      "Balanced direct",
    );
    expect(screen.getAllByTestId("rebalance-route-candidates")[0]).toHaveTextContent(
      "No quote",
    );
    expect(screen.getAllByTestId("rebalance-route-candidates")[0]).toHaveTextContent(
      "quote not available",
    );
    expect(screen.getAllByTestId("rebalance-route-candidates")[0]).toHaveTextContent(
      "No quote",
    );
  });

  it("executes AUTO using the backend-selected lane so planner and execution stay coherent", async () => {
    const user = userEvent.setup();
    const soroswapCandidate = {
      routeId: "SOROSWAP_0",
      protocol: "SOROSWAP" as const,
      venueFamily: "amm_router" as const,
      quoteModel: "live_router_quote" as const,
      settlementModel: "onchain_router" as const,
      pathModel: "router_direct" as const,
      confirmationModel: "transaction_hash_plus_refresh" as const,
      title: "SoroSwap direct",
      estimatedOutBase: 10_900_000,
      minOutBase: 10_600_000,
      available: true,
      admitted: true,
      autoEligible: true,
      note: "Live router quote available for direct path.",
      pathAssets: [defaultRoutingAssetA, defaultRoutingAssetB],
      pathLabel: "CAAA -> CBBB",
      hops: 1,
      routeScoreBase: 10_700_000,
      routeScoreLabel: "score = est. output",
      executionKind: "soroswap_path" as const,
      steps: [
        {
          protocol: "SOROSWAP" as const,
          tokenIn: defaultRoutingAssetA,
          tokenOut: defaultRoutingAssetB,
        },
      ],
    };
    routePlanApiMocks.requestRebalanceRoutePlan.mockResolvedValue({
      ok: true,
      source: "api_routing_solver",
      generatedAt: "2026-04-16T12:30:00.000Z",
      plan: {
        requestedProtocol: "AUTO",
        selectedProtocol: "SOROSWAP",
        selectedCandidate: soroswapCandidate,
        estimatedOutBase: soroswapCandidate.estimatedOutBase,
        minOutBase: soroswapCandidate.minOutBase,
        note: "Auto-selected SoroSwap direct from 3 live routes.",
        candidates: [soroswapCandidate],
        guardrails: passedExecutionGuardrails(),
      },
    });

    await renderVerifiedLegacyPage();

    await waitFor(() =>
      expect(screen.getAllByTestId("arka-stage-panel").length).toBeGreaterThan(0),
    );

    await openWorkspace(user, "rebalance");
    expect(screen.getAllByTestId("rebalance-protocol-select")[0]).toHaveTextContent(
      "Best execution",
    );
    await user.selectOptions(screen.getAllByTestId("rebalance-protocol-select")[0], "AUTO");
    await waitFor(() =>
      expect(screen.getAllByTestId("rebalance-route-summary")[0]).toHaveTextContent(
        "Best execution selected SoroSwap",
      ),
    );

    await reviewAndConfirmSwap(user);

    expect(routePlanApiMocks.requestRebalanceRoutePlan).toHaveBeenCalledWith(
      expect.objectContaining({
        requiredStatefulGuardrails: [
          "post_trade_deviation_bps",
          "daily_turnover_cap_bps",
        ],
      }),
    );
    await waitFor(
      () =>
        expect(sorobanMocks.buildArkaRebalance).toHaveBeenCalledWith(
          "GMANAGER7777777777777777777777777777777777777777777777777777",
          "TEST_BLEND_VAULT",
          [expect.objectContaining({ kind: "swap-step" })],
        ),
      { timeout: 12_000 },
    );
    expect(sorobanMocks.buildSwapStepScVal).toHaveBeenCalledWith(
      expect.objectContaining({
        adapterAddress: SOROSWAP_ADAPTER,
        poolId: 1,
        assetInContract: defaultRoutingAssetA,
        amountIn: 10_000_000,
        minOut: 10_600_000,
        assetOutContract: defaultRoutingAssetB,
        routerAddress: ARKA_ROUTER,
      }),
    );
    expect(sorobanMocks.buildSoroswapRouterSwap).not.toHaveBeenCalled();
    expect(sorobanMocks.buildAquariusRouterSwap).not.toHaveBeenCalled();
    expect(sorobanMocks.buildAdapterBalancedExecute).not.toHaveBeenCalled();
  }, 15_000);

  it("executes an AUTO split-route plan across SoroSwap and Aquarius allocations", async () => {
    const user = userEvent.setup();
    const soroswapCandidate = {
      routeId: "SOROSWAP_0",
      protocol: "SOROSWAP" as const,
      venueFamily: "amm_router" as const,
      quoteModel: "live_router_quote" as const,
      settlementModel: "onchain_router" as const,
      pathModel: "router_direct" as const,
      confirmationModel: "transaction_hash_plus_refresh" as const,
      title: "SoroSwap direct",
      estimatedOutBase: 1_030_000,
      minOutBase: 1_000_000,
      available: true,
      admitted: true,
      autoEligible: true,
      note: "Live router quote available for direct path.",
      pathAssets: [defaultRoutingAssetA, defaultRoutingAssetB],
      pathLabel: "Input asset -> Output asset",
      hops: 1,
      routeScoreBase: 1_020_000,
      routeScoreLabel: "score = est. output",
      executionKind: "soroswap_path" as const,
      steps: [
        {
          protocol: "SOROSWAP" as const,
          tokenIn: defaultRoutingAssetA,
          tokenOut: defaultRoutingAssetB,
        },
      ],
    };
    const aquariusCandidate = {
      ...soroswapCandidate,
      routeId: "AQUARIUS_DIRECT",
      protocol: "AQUARIUS" as const,
      title: "Aquarius direct",
      estimatedOutBase: 1_050_000,
      minOutBase: 1_020_000,
      routeScoreBase: 1_040_000,
      executionKind: "aquarius_single_pool" as const,
      poolIndexHex: "ab".repeat(32),
      steps: [
        {
          protocol: "AQUARIUS" as const,
          tokenIn: defaultRoutingAssetA,
          tokenOut: defaultRoutingAssetB,
          poolIndexHex: "ab".repeat(32),
        },
      ],
    };
    routePlanApiMocks.requestRebalanceRoutePlan.mockResolvedValue({
      ok: true,
      source: "api_routing_solver",
      generatedAt: "2026-04-16T12:30:00.000Z",
      plan: {
        requestedProtocol: "AUTO",
        selectedProtocol: "AQUARIUS",
        selectedCandidate: aquariusCandidate,
        estimatedOutBase: aquariusCandidate.estimatedOutBase,
        minOutBase: aquariusCandidate.minOutBase,
        note: "Auto-selected Aquarius direct from 2 live routes.",
        candidates: [aquariusCandidate, soroswapCandidate],
        guardrails: passedExecutionGuardrails(),
        splitRoute: {
          status: "recommended",
          strategy: "chunked_global_best_execution",
          executable: true,
          allocationCount: 2,
          chunkCount: 2,
          routeCountCompared: 2,
          totalAmountInBase: 1_000_000,
          totalEstimatedOutBase: 1_130_000,
          totalMinOutBase: 1_090_000,
          singleRouteEstimatedOutBase: 1_050_000,
          estimatedImprovementBase: 80_000,
          estimatedImprovementBps: 761,
          note: "Split-route optimizer globally evaluated 3 executable chunk distributions and recommends 2 allocations across 2 live AMM routes.",
          allocations: [
            {
              routeId: "SOROSWAP_0",
              protocol: "SOROSWAP",
              title: "SoroSwap direct",
              amountInBase: 500_000,
              amountShareBps: 5_000,
              estimatedOutBase: 570_000,
              minOutBase: 550_000,
              pathAssets: [defaultRoutingAssetA, defaultRoutingAssetB],
              pathLabel: "Input asset -> Output asset",
              hops: 1,
              routeScoreBase: 560_000,
              routeScoreLabel: "score 560,000",
              note: "Chunk routed through SoroSwap.",
            },
            {
              routeId: "AQUARIUS_DIRECT",
              protocol: "AQUARIUS",
              title: "Aquarius direct",
              amountInBase: 500_000,
              amountShareBps: 5_000,
              estimatedOutBase: 560_000,
              minOutBase: 540_000,
              pathAssets: [defaultRoutingAssetA, defaultRoutingAssetB],
              pathLabel: "Input asset -> Output asset",
              hops: 1,
              poolIndexHex: "ab".repeat(32),
              routeScoreBase: 552_000,
              routeScoreLabel: "score 552,000",
              note: "Chunk routed through Aquarius.",
            },
          ],
        },
      },
    });

    await renderVerifiedLegacyPage();

    await waitFor(() =>
      expect(screen.getAllByTestId("arka-stage-panel").length).toBeGreaterThan(0),
    );

    await openWorkspace(user, "rebalance");
    await user.selectOptions(screen.getAllByTestId("rebalance-protocol-select")[0], "AUTO");
    expect(screen.getByRole('checkbox', {name: /advanced/i})).toBeChecked();
    await waitFor(() =>
      expect(screen.getAllByTestId("rebalance-split-route")[0]).toHaveTextContent(
        "Execution plan",
      ),
    );
    expect(screen.getAllByTestId("rebalance-split-route")[0]).toHaveTextContent(
      "Recommended across 2 routes",
    );

    await reviewAndConfirmSwap(user);

    expect(routePlanApiMocks.requestRebalanceRoutePlan).toHaveBeenCalledWith(
      expect.objectContaining({
        requiredStatefulGuardrails: [
          "post_trade_deviation_bps",
          "daily_turnover_cap_bps",
        ],
      }),
    );
    await waitFor(
      () =>
        expect(sorobanMocks.buildArkaRebalance).toHaveBeenCalledWith(
          "GMANAGER7777777777777777777777777777777777777777777777777777",
          "TEST_BLEND_VAULT",
          [
            expect.objectContaining({ kind: "swap-step" }),
            expect.objectContaining({ kind: "swap-step" }),
          ],
        ),
      { timeout: 12_000 },
    );
    expect(sorobanMocks.buildSwapStepScVal).toHaveBeenCalledWith(
      expect.objectContaining({
        adapterAddress: SOROSWAP_ADAPTER,
        poolId: 1,
        assetInContract: defaultRoutingAssetA,
        amountIn: 500_000,
        minOut: 550_000,
        assetOutContract: defaultRoutingAssetB,
        routerAddress: ARKA_ROUTER,
      }),
    );
    expect(sorobanMocks.buildSwapStepScVal).toHaveBeenCalledWith(
      expect.objectContaining({
        adapterAddress: AQUARIUS_ADAPTER,
        poolId: 1,
        assetInContract: defaultRoutingAssetA,
        amountIn: 500_000,
        minOut: 540_000,
        assetOutContract: defaultRoutingAssetB,
        routerAddress: ARKA_ROUTER,
      }),
    );
    expect(sorobanMocks.buildSoroswapRouterSwap).not.toHaveBeenCalled();
    expect(sorobanMocks.buildAquariusRouterSwap).not.toHaveBeenCalled();
    expect(screen.getByTestId("rebalance-receipt-summary")).toHaveTextContent(
      "Split-route execution confirmed across 2 AMM allocations",
    );
  }, 15_000);

  it("keeps vault deposit signer rejection visible and retryable without submitting", async () => {
    const user = userEvent.setup();
    walletKitMocks.defaultKit.signTransaction.mockRejectedValueOnce(
      new Error("Wallet signature rejected by user"),
    );

    await renderVerifiedLegacyPage();

    await waitFor(() =>
      expect(screen.getAllByTestId("arka-stage-panel").length).toBeGreaterThan(0),
    );

    await openWorkspace(user, "flow");
    expect(screen.getByTestId("arka-amount-input")).toHaveAccessibleName(/amount in/i);
    expect(screen.getByText(/enter the amount in/i)).toBeInTheDocument();
    await user.click(screen.getAllByTestId("arka-deposit-button")[0]);

    await waitFor(() =>
      expect(screen.getByTestId("vault-error")).toHaveTextContent(
        /request was cancelled in your wallet/i,
      ),
    );
    expect(sorobanMocks.buildTokenApprove).toHaveBeenCalledWith(
      "GMANAGER7777777777777777777777777777777777777777777777777777",
      defaultRoutingAssetA,
      "TEST_BLEND_VAULT",
      10_000_000,
    );
    expect(sorobanMocks.buildArkaDeposit).not.toHaveBeenCalled();
    expect(countRpcMethod("sendTransaction")).toBe(0);
    expect(screen.getByTestId("arka-amount-input")).toHaveValue("1");

    walletKitMocks.defaultKit.signTransaction.mockRejectedValueOnce(
      new Error("Wallet signature rejected by user"),
    );
    await user.click(screen.getAllByTestId("arka-deposit-button")[0]);

    await waitFor(() =>
      expect(walletKitMocks.defaultKit.signTransaction).toHaveBeenCalledTimes(2),
    );
    expect(screen.getByTestId("vault-error")).toHaveTextContent(
      /request was cancelled in your wallet/i,
    );
    expect(countRpcMethod("sendTransaction")).toBe(0);
  });

  it("confirms vault deposit allowance before building the deposit transaction", async () => {
    const user = userEvent.setup();
    sorobanMocks.readTokenAllowance
      .mockResolvedValueOnce(0)
      .mockResolvedValue(10_000_000);

    await renderVerifiedLegacyPage();

    await waitFor(() =>
      expect(screen.getAllByTestId("arka-stage-panel").length).toBeGreaterThan(0),
    );

    await openWorkspace(user, "flow");
    await user.click(screen.getAllByTestId("arka-deposit-button")[0]);

    await waitFor(() =>
      expect(sorobanMocks.buildArkaDeposit).toHaveBeenCalledWith(
        "GMANAGER7777777777777777777777777777777777777777777777777777",
        "TEST_BLEND_VAULT",
        defaultRoutingAssetA,
        10_000_000,
      ),
    );
    expect(sorobanMocks.readTokenAllowance).toHaveBeenCalledTimes(2);
    expect(sorobanMocks.buildTokenApprove).toHaveBeenCalledWith(
      "GMANAGER7777777777777777777777777777777777777777777777777777",
      defaultRoutingAssetA,
      "TEST_BLEND_VAULT",
      10_000_000,
    );
    await waitFor(() =>
      expect(screen.getByTestId("vault-status")).toHaveTextContent(
        /deposit confirmed/i,
      ),
    );
    expect(screen.getByTestId("vault-status")).toHaveTextContent(/deposit confirmed: 1 /i);
    expect(screen.queryByTestId("vault-status")?.closest(".transaction-rail")?.textContent).not.toMatch(
      /transaction in progress/i,
    );
    expect(countRpcMethod("sendTransaction")).toBe(2);
  });

  it("runs only one deposit while the wallet signature is pending", async () => {
    const user = userEvent.setup();
    sorobanMocks.readTokenAllowance.mockResolvedValue(10_000_000);
    let releaseSignature: ((value: { signedTxXdr: string }) => void) | undefined;
    walletKitMocks.defaultKit.signTransaction.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          releaseSignature = resolve;
        }),
    );

    await renderVerifiedLegacyPage();

    await waitFor(() =>
      expect(screen.getAllByTestId("arka-stage-panel").length).toBeGreaterThan(0),
    );

    await openWorkspace(user, "flow");
    const depositButton = screen.getByTestId("arka-deposit-button");
    await user.click(depositButton);

    await waitFor(() => expect(depositButton).toBeDisabled());
    await user.click(depositButton);
    expect(walletKitMocks.defaultKit.signTransaction).toHaveBeenCalledTimes(1);
    expect(sorobanMocks.buildArkaDeposit).toHaveBeenCalledTimes(1);

    releaseSignature?.({ signedTxXdr: offlineXdr() });

    await waitFor(() =>
      expect(screen.getByTestId("vault-status")).toHaveTextContent(/deposit confirmed/i),
    );
    expect(screen.queryByTestId("vault-error")).not.toBeInTheDocument();
    expect(sorobanMocks.buildArkaDeposit).toHaveBeenCalledTimes(1);
  });

  it("replaces a previous deposit success with clear wallet timeout guidance", async () => {
    const user = userEvent.setup();
    sorobanMocks.readTokenAllowance.mockResolvedValue(10_000_000);

    await renderVerifiedLegacyPage();
    await openWorkspace(user, "flow");

    await user.click(screen.getByTestId("arka-deposit-button"));
    await waitFor(() =>
      expect(screen.getByTestId("vault-status")).toHaveTextContent(/deposit confirmed/i),
    );

    walletKitMocks.defaultKit.signTransaction.mockRejectedValueOnce(
      new Error("Wallet signing timed out after 30000ms"),
    );
    await user.click(screen.getByTestId("arka-deposit-button"));

    await waitFor(() =>
      expect(screen.getByTestId("vault-error")).toHaveTextContent(
        /wallet did not respond in time.*try again/i,
      ),
    );
    expect(screen.queryByTestId("vault-status")).not.toBeInTheDocument();
    expect(screen.getByTestId("vault-error")).not.toHaveTextContent(/30000ms|confirmed/i);
  });

  it("does not expose Soroban host details when a deposit cannot be prepared", async () => {
    const user = userEvent.setup();
    sorobanMocks.readTokenAllowance.mockResolvedValue(10_000_000);
    sorobanMocks.buildArkaDeposit.mockRejectedValueOnce(
      new Error(
        "Deposit simulation failed: HostError: Error(Budget, ExceededLimit) DebugInfo not available",
      ),
    );

    await renderVerifiedLegacyPage();
    await openWorkspace(user, "flow");
    await user.click(screen.getByTestId("arka-deposit-button"));

    await waitFor(() =>
      expect(screen.getByTestId("vault-error")).toHaveTextContent(
        /deposit could not be completed.*no funds were moved.*try again/i,
      ),
    );
    expect(screen.getByTestId("vault-error")).not.toHaveTextContent(
      /HostError|Budget|DebugInfo|simulation/i,
    );
  });

  it("explains blocked swaps and prevents signing until the amount is reduced", async () => {
    const user = userEvent.setup();
    const candidate = buildSoroswapMultiHopCandidate();
    routePlanApiMocks.requestRebalanceRoutePlan.mockResolvedValue({
      ok: true,
      source: "api_routing_solver",
      generatedAt: "2026-08-26T08:00:00.000Z",
      plan: {
        requestedProtocol: "AUTO",
        selectedProtocol: "SOROSWAP",
        selectedCandidate: candidate,
        estimatedOutBase: candidate.estimatedOutBase,
        minOutBase: candidate.minOutBase,
        note: "Auto-selected SoroSwap multi-hop from live routes.",
        candidates: [candidate],
        guardrails: {
          status: "blocked",
          blockedReasons: ["Daily turnover is above policy."],
          policy: {
            maxNotionalPerSwapBase: 100_000_000_000,
            maxPathLength: 6,
            forbidRouteCycles: true,
            chunkingThresholdBase: 25_000_000,
            maxChunkSizeBase: 5_000_000,
            postTradeDeviationBps: 250,
            dailyTurnoverCapBps: 1_000,
            emergencyPauseSwap: false,
          },
          checks: [
            {
              id: "daily_turnover_cap_bps",
              label: "Daily turnover",
              status: "blocked",
              value: "100,000,000 notional",
              limit: "20,000,000 notional",
              detail: "Daily turnover is above policy.",
              evidence: {
                source: "catalog_activity_nav",
                amountBase: 100_000_000,
                vaultNavBase: 200_000_000,
                dailyTurnoverUsedBase: 0,
                projectedTurnoverBase: 100_000_000,
                turnoverCapBase: 20_000_000,
              },
            },
          ],
        },
      },
    });

    await renderVerifiedLegacyPage();

    await waitFor(() =>
      expect(screen.getAllByTestId("arka-stage-panel").length).toBeGreaterThan(0),
    );
    await openWorkspace(user, "rebalance");

    await waitFor(() =>
      expect(screen.getByTestId("rebalance-limit-message")).toHaveTextContent(
        /maximum for this swap: 0\.5/i,
      ),
    );
    expect(screen.getByTestId("rebalance-limit-message")).toHaveTextContent(
      /2 .* remains available today/i,
    );
    expect(screen.getByTestId("rebalance-trade-limits")).toHaveTextContent(
      /per swap2\.5% · about 0\.5/i,
    );
    expect(screen.getByTestId("rebalance-trade-limits")).toHaveTextContent(
      /available today10% · 2 /i,
    );
    expect(screen.getAllByTestId("rebalance-route-summary")[0]).toHaveTextContent(
      "Reduce amount",
    );
    expect(screen.getAllByTestId("rebalance-run-button")[0]).toBeDisabled();
    expect(walletKitMocks.defaultKit.signTransaction).not.toHaveBeenCalled();
  });

  it("keeps the quoted route visible when the solver blocks the amount", async () => {
    const user = userEvent.setup();
    const candidate = buildSoroswapMultiHopCandidate();
    routePlanApiMocks.requestRebalanceRoutePlan.mockResolvedValue({
      ok: true,
      source: "api_routing_solver",
      generatedAt: "2026-08-26T08:00:00.000Z",
      plan: {
        requestedProtocol: "AUTO",
        selectedProtocol: "SOROSWAP",
        selectedCandidate: null,
        estimatedOutBase: 0,
        minOutBase: 0,
        note: "The route is quoted, but the amount exceeds this Arka's limits.",
        candidates: [candidate],
        guardrails: {
          status: "blocked",
          blockedReasons: ["The amount is too large for one execution."],
          policy: {
            maxNotionalPerSwapBase: 100_000_000_000,
            maxPathLength: 6,
            forbidRouteCycles: true,
            chunkingThresholdBase: 25_000_000,
            maxChunkSizeBase: 5_000_000,
            postTradeDeviationBps: 250,
            dailyTurnoverCapBps: 1_000,
            emergencyPauseSwap: false,
          },
          checks: [
            {
              id: "max_chunk_size",
              label: "Maximum execution size",
              status: "blocked",
              value: "100,000,000 notional",
              limit: "5,000,000 notional",
              detail: "The amount is too large for one execution.",
            },
          ],
        },
      },
    });

    await renderVerifiedLegacyPage();
    await waitFor(() =>
      expect(screen.getAllByTestId("arka-stage-panel").length).toBeGreaterThan(0),
    );
    await openWorkspace(user, "rebalance");

    await waitFor(() =>
      expect(screen.getByTestId("rebalance-estimate")).toHaveTextContent("Reduce amount"),
    );
    expect(screen.getByTestId("rebalance-estimate")).toHaveTextContent("1.14");
    expect(screen.getByTestId("rebalance-estimate")).not.toHaveTextContent("Not available");
    expect(screen.getByTestId("rebalance-limit-message")).toHaveTextContent(
      /orders above 2\.5 .* require split execution, with up to 0\.5 .* per part/i,
    );
    expect(screen.getByTestId("rebalance-run-button")).toBeDisabled();
  });

  it("keeps redeem-all signer rejection visible and retryable without submitting", async () => {
    const user = userEvent.setup();
    walletKitMocks.defaultKit.signTransaction.mockRejectedValueOnce(
      new Error("Wallet signature rejected by user"),
    );

    await renderVerifiedLegacyPage();

    await waitFor(() =>
      expect(screen.getAllByTestId("arka-stage-panel").length).toBeGreaterThan(0),
    );

    await openWorkspace(user, "flow");
    await user.click(screen.getByTestId("arka-redeem-all-button"));

    await waitFor(() =>
      expect(screen.getByTestId("vault-error")).toHaveTextContent(
        /request was cancelled in your wallet/i,
      ),
    );
    expect(sorobanMocks.buildArkaRedeem).toHaveBeenCalledWith(
      "GMANAGER7777777777777777777777777777777777777777777777777777",
      "TEST_BLEND_VAULT",
      13_000_000,
    );
    expect(countRpcMethod("sendTransaction")).toBe(0);
    expect(screen.getByTestId("arka-amount-input")).toHaveValue("1");

    walletKitMocks.defaultKit.signTransaction.mockRejectedValueOnce(
      new Error("Wallet signature rejected by user"),
    );
    await user.click(screen.getByTestId("arka-redeem-all-button"));

    await waitFor(() =>
      expect(walletKitMocks.defaultKit.signTransaction).toHaveBeenCalledTimes(2),
    );
    expect(sorobanMocks.buildArkaRedeem).toHaveBeenCalledTimes(2);
    expect(screen.getByTestId("vault-error")).toHaveTextContent(
      /request was cancelled in your wallet/i,
    );
    expect(countRpcMethod("sendTransaction")).toBe(0);
  });

  it("keeps vault-owned Aquarius rebalance signer rejection visible and retryable without submitting", async () => {
    const user = userEvent.setup();
    walletKitMocks.defaultKit.signTransaction.mockRejectedValueOnce(
      new Error("Wallet signature rejected by user"),
    );

    await renderVerifiedLegacyPage();

    await waitFor(() =>
      expect(screen.getAllByTestId("arka-stage-panel").length).toBeGreaterThan(0),
    );

    await openWorkspace(user, "rebalance");
    await user.clear(screen.getAllByTestId("rebalance-amount-input")[0]);
    await user.type(screen.getAllByTestId("rebalance-amount-input")[0], "0.1");
    await user.selectOptions(screen.getAllByTestId("rebalance-protocol-select")[0], "AQUARIUS");
    await waitFor(() =>
      expect(screen.getAllByTestId("rebalance-route-summary")[0]).toHaveTextContent(
        "Aquarius selected",
      ),
    );
    await reviewAndConfirmSwap(user);

    await waitFor(() =>
      expect(screen.getByTestId("rebalance-error")).toHaveTextContent(
        /request was cancelled in your wallet/i,
      ),
    );
    expect(sorobanMocks.buildArkaRebalance).toHaveBeenCalledWith(
      "GMANAGER7777777777777777777777777777777777777777777777777777",
      "TEST_BLEND_VAULT",
      [expect.objectContaining({ kind: "swap-step" })],
    );
    expect(sorobanMocks.buildTokenApprove).not.toHaveBeenCalled();
    expect(sorobanMocks.buildAquariusRouterSwap).not.toHaveBeenCalled();
    expect(countRpcMethod("sendTransaction")).toBe(0);

    walletKitMocks.defaultKit.signTransaction.mockRejectedValueOnce(
      new Error("Wallet signature rejected by user"),
    );
    await reviewAndConfirmSwap(user);

    await waitFor(() =>
      expect(walletKitMocks.defaultKit.signTransaction).toHaveBeenCalledTimes(2),
    );
    expect(screen.getByTestId("rebalance-error")).toHaveTextContent(
      /request was cancelled in your wallet/i,
    );
    expect(sorobanMocks.buildArkaRebalance).toHaveBeenCalledTimes(2);
    expect(sorobanMocks.buildAquariusRouterSwap).not.toHaveBeenCalled();
    expect(countRpcMethod("sendTransaction")).toBe(0);
  }, 15_000);

  it("executes SoroSwap multi-hop vault rebalance through the adapter path", async () => {
    const user = userEvent.setup();
    const soroswapMultiHopCandidate = buildSoroswapMultiHopCandidate();
    mockSoroswapMultiHopRoutePlan(soroswapMultiHopCandidate);

    await renderVerifiedLegacyPage();

    await waitFor(() =>
      expect(screen.getAllByTestId("arka-stage-panel").length).toBeGreaterThan(0),
    );

    await openWorkspace(user, "rebalance");
    await user.selectOptions(screen.getAllByTestId("rebalance-protocol-select")[0], "AUTO");
    await waitFor(() =>
      expect(screen.getAllByTestId("rebalance-route-summary")[0]).toHaveTextContent(
        "Best execution selected SoroSwap multi-hop",
      ),
    );

    await reviewAndConfirmSwap(user);

    await waitFor(() =>
      expect(sorobanMocks.buildArkaRebalance).toHaveBeenCalledWith(
        "GMANAGER7777777777777777777777777777777777777777777777777777",
        "TEST_BLEND_VAULT",
        [expect.objectContaining({ kind: "swap-step" })],
      ),
      { timeout: 12_000 },
    );
    expect(sorobanMocks.buildSwapStepScVal).toHaveBeenCalledWith(
      expect.objectContaining({
        adapterAddress: SOROSWAP_ADAPTER,
        poolId: soroswapMultiHopCandidate.poolId,
        assetInContract: defaultRoutingAssetA,
        amountIn: 10_000_000,
        minOut: soroswapMultiHopCandidate.minOutBase,
        assetOutContract: defaultRoutingAssetB,
        routerAddress: ARKA_ROUTER,
      }),
    );
    expect(sorobanMocks.buildTokenApprove).not.toHaveBeenCalled();
    expect(sorobanMocks.buildSoroswapRouterSwapForPath).not.toHaveBeenCalled();
    expect(sorobanMocks.buildSoroswapRouterSwap).not.toHaveBeenCalled();
    expect(sorobanMocks.buildArkaDeposit).not.toHaveBeenCalled();
    expect(walletKitMocks.defaultKit.signTransaction).toHaveBeenCalledWith(
      offlineXdr(),
      expect.objectContaining({ networkPassphrase: expect.any(String) }),
    );
  }, 15_000);

  it("keeps vault-owned credit signer rejection visible and retryable without submitting", async () => {
    const user = userEvent.setup();
    walletKitMocks.defaultKit.signTransaction.mockRejectedValueOnce(
      new Error("Wallet signature rejected by user"),
    );

    await renderVerifiedLegacyPage();

    await waitFor(() =>
      expect(screen.getAllByTestId("arka-stage-panel").length).toBeGreaterThan(0),
    );

    await openWorkspace(user, "credit");
    await user.click(screen.getByTestId("credit-action-borrow"));
    await user.click(screen.getByTestId("credit-run-button"));

    await waitFor(() =>
      expect(screen.getByTestId("credit-error")).toHaveTextContent(
        /request was cancelled in your wallet/i,
      ),
    );
    expect(sorobanMocks.buildArkaCreditAction).toHaveBeenCalledWith(
      "GMANAGER7777777777777777777777777777777777777777777777777777",
      "TEST_BLEND_VAULT",
      "Blend",
      "Borrow",
      7,
      defaultRoutingAssetA,
      10_000_000,
    );
    expect(countRpcMethod("sendTransaction")).toBe(0);

    walletKitMocks.defaultKit.signTransaction.mockRejectedValueOnce(
      new Error("Wallet signature rejected by user"),
    );
    await user.click(screen.getByTestId("credit-run-button"));

    await waitFor(() =>
      expect(walletKitMocks.defaultKit.signTransaction).toHaveBeenCalledTimes(2),
    );
    expect(screen.getByTestId("credit-error")).toHaveTextContent(
      /request was cancelled in your wallet/i,
    );
    expect(countRpcMethod("sendTransaction")).toBe(0);
  });

  it("keeps vault deposit fail-closed when the selected provider disconnects", async () => {
    const user = userEvent.setup();
    useDisconnectedProvider();

    await renderVerifiedLegacyPage();

    await waitFor(() =>
      expect(screen.getAllByTestId("arka-stage-panel").length).toBeGreaterThan(0),
    );

    await openWorkspace(user, "flow");
    await user.click(screen.getAllByTestId("arka-deposit-button")[0]);

    await waitFor(() =>
      expect(screen.getByTestId("vault-error")).toHaveTextContent(providerUnavailableError),
    );
    expect(walletKitMocks.providerDisconnectKit.signTransaction).toHaveBeenCalledWith(
      offlineXdr(),
      expect.objectContaining({ submit: false }),
    );
    expect(freighterMocks.signTransaction).not.toHaveBeenCalled();
    expect(sorobanMocks.buildArkaDeposit).not.toHaveBeenCalled();
    expect(countRpcMethod("sendTransaction")).toBe(0);
    expect(screen.getByTestId("arka-deposit-button")).toBeEnabled();
  });

  it("keeps redeem-all fail-closed when the selected provider disconnects", async () => {
    const user = userEvent.setup();
    useDisconnectedProvider();

    await renderVerifiedLegacyPage();

    await waitFor(() =>
      expect(screen.getAllByTestId("arka-stage-panel").length).toBeGreaterThan(0),
    );

    await openWorkspace(user, "flow");
    await user.click(screen.getByTestId("arka-redeem-all-button"));

    await waitFor(() =>
      expect(screen.getByTestId("vault-error")).toHaveTextContent(providerUnavailableError),
    );
    expect(walletKitMocks.providerDisconnectKit.signTransaction).toHaveBeenCalledWith(
      offlineXdr(),
      expect.objectContaining({ submit: false }),
    );
    expect(freighterMocks.signTransaction).not.toHaveBeenCalled();
    expect(sorobanMocks.buildArkaRedeem).toHaveBeenCalledWith(
      "GMANAGER7777777777777777777777777777777777777777777777777777",
      "TEST_BLEND_VAULT",
      13_000_000,
    );
    expect(countRpcMethod("sendTransaction")).toBe(0);
    expect(screen.getByTestId("arka-redeem-all-button")).toBeEnabled();
  });

  it("keeps vault-owned Aquarius rebalance provider disconnect fail-closed", async () => {
    const user = userEvent.setup();
    useDisconnectedProvider();

    await renderVerifiedLegacyPage();

    await waitFor(() =>
      expect(screen.getAllByTestId("arka-stage-panel").length).toBeGreaterThan(0),
    );

    await openWorkspace(user, "rebalance");
    await user.clear(screen.getAllByTestId("rebalance-amount-input")[0]);
    await user.type(screen.getAllByTestId("rebalance-amount-input")[0], "0.1");
    await user.selectOptions(screen.getAllByTestId("rebalance-protocol-select")[0], "AQUARIUS");
    await waitFor(() =>
      expect(screen.getAllByTestId("rebalance-route-summary")[0]).toHaveTextContent(
        "Aquarius selected",
      ),
    );
    await reviewAndConfirmSwap(user);

    await waitFor(() =>
      expect(screen.getByTestId("rebalance-error")).toHaveTextContent(providerUnavailableError),
    );
    expect(walletKitMocks.providerDisconnectKit.signTransaction).toHaveBeenCalledWith(
      offlineXdr(),
      expect.objectContaining({ submit: false }),
    );
    expect(freighterMocks.signTransaction).not.toHaveBeenCalled();
    expect(sorobanMocks.buildTokenApprove).not.toHaveBeenCalled();
    expect(sorobanMocks.buildAquariusRouterSwap).not.toHaveBeenCalled();
    expect(countRpcMethod("sendTransaction")).toBe(0);
    expect(screen.getAllByTestId("rebalance-run-button")[0]).toBeEnabled();
  }, 15_000);

  it("keeps SoroSwap multi-hop vault rebalance provider disconnect fail-closed", async () => {
    const user = userEvent.setup();
    const soroswapMultiHopCandidate = mockSoroswapMultiHopRoutePlan();
    useDisconnectedProvider();

    await renderVerifiedLegacyPage();

    await waitFor(() =>
      expect(screen.getAllByTestId("arka-stage-panel").length).toBeGreaterThan(0),
    );

    await openWorkspace(user, "rebalance");
    await user.selectOptions(screen.getAllByTestId("rebalance-protocol-select")[0], "AUTO");
    await waitFor(() =>
      expect(screen.getAllByTestId("rebalance-route-summary")[0]).toHaveTextContent(
        "Best execution selected SoroSwap multi-hop",
      ),
    );

    await reviewAndConfirmSwap(user);

    await waitFor(() =>
      expect(screen.getByTestId("rebalance-error")).toHaveTextContent(
        providerUnavailableError,
      ),
    );
    expect(sorobanMocks.buildSwapStepScVal).toHaveBeenCalledWith(
      expect.objectContaining({
        adapterAddress: SOROSWAP_ADAPTER,
        poolId: soroswapMultiHopCandidate.poolId,
        assetInContract: defaultRoutingAssetA,
        amountIn: 10_000_000,
        minOut: soroswapMultiHopCandidate.minOutBase,
        assetOutContract: defaultRoutingAssetB,
        routerAddress: ARKA_ROUTER,
      }),
    );
    expect(sorobanMocks.buildArkaRebalance).toHaveBeenCalledWith(
      "GMANAGER7777777777777777777777777777777777777777777777777777",
      "TEST_BLEND_VAULT",
      [expect.objectContaining({ kind: "swap-step" })],
    );
    expect(walletKitMocks.providerDisconnectKit.signTransaction).toHaveBeenCalledWith(
      offlineXdr(),
      expect.objectContaining({ submit: false }),
    );
    expect(freighterMocks.signTransaction).not.toHaveBeenCalled();
    expect(sorobanMocks.buildSoroswapRouterSwapForPath).not.toHaveBeenCalled();
    expect(sorobanMocks.buildArkaDeposit).not.toHaveBeenCalled();
    expect(countRpcMethod("sendTransaction")).toBe(0);
    expect(screen.getAllByTestId("rebalance-run-button")[0]).toBeEnabled();
    expect(soroswapMultiHopCandidate.pathAssets).toHaveLength(3);
  }, 15_000);

  it("keeps vault-owned credit fail-closed when the selected provider disconnects", async () => {
    const user = userEvent.setup();
    useDisconnectedProvider();

    await renderVerifiedLegacyPage();

    await waitFor(() =>
      expect(screen.getAllByTestId("arka-stage-panel").length).toBeGreaterThan(0),
    );

    await openWorkspace(user, "credit");
    await user.click(screen.getByTestId("credit-action-borrow"));
    await user.click(screen.getByTestId("credit-run-button"));

    await waitFor(() =>
      expect(screen.getByTestId("credit-error")).toHaveTextContent(providerUnavailableError),
    );
    expect(walletKitMocks.providerDisconnectKit.signTransaction).toHaveBeenCalledWith(
      offlineXdr(),
      expect.objectContaining({ submit: false }),
    );
    expect(freighterMocks.signTransaction).not.toHaveBeenCalled();
    expect(sorobanMocks.buildArkaCreditAction).toHaveBeenCalledWith(
      "GMANAGER7777777777777777777777777777777777777777777777777777",
      "TEST_BLEND_VAULT",
      "Blend",
      "Borrow",
      7,
      defaultRoutingAssetA,
      10_000_000,
    );
    expect(countRpcMethod("sendTransaction")).toBe(0);
    expect(screen.getByTestId("credit-run-button")).toBeEnabled();
  });

  it("records a structured receipt after an Aquarius rebalance execution", async () => {
    const user = userEvent.setup();
    await renderVerifiedLegacyPage();

    await waitFor(() =>
      expect(screen.getAllByTestId("arka-stage-panel").length).toBeGreaterThan(0),
    );

    await openWorkspace(user, "rebalance");
    await user.clear(screen.getAllByTestId("rebalance-amount-input")[0]);
    await user.type(screen.getAllByTestId("rebalance-amount-input")[0], "0.1");
    expect(screen.getAllByTestId("rebalance-protocol-select")[0]).toHaveTextContent("Aquarius");
    await user.selectOptions(screen.getAllByTestId("rebalance-protocol-select")[0], "AQUARIUS");
    await waitFor(() =>
      expect(screen.getAllByTestId("rebalance-route-summary")[0]).toHaveTextContent(
        "Aquarius selected",
      ),
    );
    await reviewAndConfirmSwap(user);

    await waitFor(() =>
      expect(screen.getByTestId("rebalance-receipt-panel")).toBeInTheDocument(),
    );

    expect(screen.getByTestId("rebalance-receipt-summary")).toHaveTextContent(
      /AMM router/i,
    );
    expect(screen.getByTestId("rebalance-receipt-panel")).toHaveTextContent(
      "Router-direct",
    );
    expect(screen.getByTestId("rebalance-receipt-panel")).toHaveTextContent(
      "Transaction hash + refreshed state",
    );
    expect(screen.getByTestId("rebalance-receipt-primary-hash")).toHaveTextContent(
      "TXHASH123",
    );
  });
});

async function renderVerifiedLegacyPage(){
 const transport=global.fetch;
 global.fetch=vi.fn(async(input:RequestInfo|URL,init?:RequestInit)=>{
  const url=String(input);
  if(url.startsWith('/api/v3-release/identity?fund='))return new Response(JSON.stringify({id:decodeURIComponent(url.split('fund=')[1]),version:2}),{status:200,headers:{'content-type':'application/json'}});
  return transport(input,init);
 }) as typeof fetch;
 const result=render(<ArkaDetailPage/>);
 await waitFor(()=>expect(screen.queryByText('Checking Arka…')).not.toBeInTheDocument());
 return result;
}
