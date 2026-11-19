import { describe, expect, it } from "vitest";
import {
  STATUS_LIMITATIONS,
  STATUS_OPERATOR_STEPS,
  STATUS_SCOPE_ITEMS,
  REBALANCE_GUARDRAIL_SOURCE_OF_TRUTH,
  buildGuardrailRows,
  buildGuardrailSourceRows,
  buildGuardrailSourceSummary,
  buildSettingsControlSignals,
  buildSettingsGroups,
  buildSettingsRows,
  buildSettingsSpotlights,
  buildStatusControlSignals,
  buildStatusOracleRows,
  buildStatusOperatorSteps,
  buildStatusRows,
  buildStatusSpotlights,
} from "@/lib/workflows/controlSurfaces";

const LEGACY_MILESTONE_WORD = `tr${"anche"}`;

describe("controlSurfaces", () => {
  it("groups settings env keys into stable sections", () => {
    const groups = buildSettingsGroups({
      NETWORK_PASSPHRASE: "Testnet",
      SOROBAN_RPC_URL: "https://rpc.invalid",
      ARKA_FACTORY: "CFACTORY",
      ARKA_REGISTRY: "CREGISTRY",
      REBALANCE_SLIPPAGE_PROFILE: "standard",
      DEFAULT_REBALANCE_SLIPPAGE_PCT: "0.5",
    });

    expect(groups.map((group) => group.id)).toEqual(["network", "contracts", "rebalancing"]);
    expect(groups[0]?.items.map((entry) => entry.key)).toEqual(["NETWORK_PASSPHRASE", "SOROBAN_RPC_URL"]);
    expect(groups[1]?.items.map((entry) => entry.key)).toEqual(["ARKA_FACTORY", "ARKA_REGISTRY"]);
    expect(groups[2]?.items.map((entry) => entry.key)).toEqual([
      "REBALANCE_SLIPPAGE_PROFILE",
      "DEFAULT_REBALANCE_SLIPPAGE_PCT",
    ]);
  });

  it("keeps public control-surface copy free of legacy milestone wording", () => {
    const publicCopy = [...STATUS_SCOPE_ITEMS, ...STATUS_OPERATOR_STEPS, ...STATUS_LIMITATIONS].join(" ").toLowerCase();
    expect(publicCopy).not.toContain(LEGACY_MILESTONE_WORD);
    expect(publicCopy).not.toContain("demo deposit");
  });

  it("builds status operator steps around real creation, deposit and execution routes", () => {
    const steps = buildStatusOperatorSteps("Stellar Testnet", ["XLM", "USDC", "BLND"]);

    expect(steps[0]).toBe("Use Stellar Testnet and connect a funded wallet before running any live flow.");
    expect(steps[1]).toBe(
      "Confirm trustlines for XLM, USDC and BLND before using the creation, deposit or execution routes.",
    );
    expect(steps.join(" ").toLowerCase()).not.toContain("demo deposit");
  });

  it("maps settings, guardrails and status items into stable rows", () => {
    const group = buildSettingsGroups({
      NETWORK_PASSPHRASE: "Testnet",
      SOROBAN_RPC_URL: "https://rpc.invalid",
    })[0]!;
    const settingsRows = buildSettingsRows(group);
    const guardrailRows = buildGuardrailRows({
      profile: "standard",
      defaultSlippagePct: 0.5,
      maxSlippagePct: 5,
      primaryBufferPct: 0.25,
      fallbackBufferPct: 1,
      maxNotionalPerSwapBase: 100_000_000,
      maxPathLength: 6,
      forbidRouteCycles: true,
      chunkingThresholdBase: 25_000_000,
      maxChunkSizeBase: 5_000_000,
      postTradeDeviationBps: 250,
      dailyTurnoverCapBps: 1_000,
      emergencyPauseSwap: false,
    });
    const statusRows = buildStatusRows(["Live testnet deployment"], {
      prefix: "Step",
      state: "Required",
      valueLabel: "Checklist",
    });

    expect(settingsRows[0]).toMatchObject({
      id: "network-NETWORK_PASSPHRASE",
      label: "Network passphrase",
      state: "Configured",
    });
    expect(guardrailRows.map((row) => row.id)).toEqual([
      "default-path",
      "default-slippage",
      "max-slippage",
      "buffers",
      "max-notional-per-swap",
      "path-constraints",
      "chunking",
      "post-trade-deviation",
      "daily-turnover-cap",
      "emergency-pause-swap",
      "protocol-blocklist",
    ]);
    expect(guardrailRows.find((row) => row.id === "path-constraints")).toMatchObject({
      value: "6 hops / acyclic",
      state: "Guarded",
      sourceLabel: "Runtime environment",
      mutabilityLabel: "Operator deploy config",
    });
    expect(guardrailRows.find((row) => row.id === "max-notional-per-swap")).toMatchObject({
      meta: "Runtime input ceiling before planner handoff",
      governanceLabel: "DAO storage migration required",
    });
    expect(guardrailRows.find((row) => row.id === "emergency-pause-swap")).toMatchObject({
      meta: "Runtime emergency stop before route execution",
      governanceLabel: "DAO storage migration required",
    });
    expect(guardrailRows.find((row) => row.id === "protocol-blocklist")).toMatchObject({
      value: "none",
      state: "Open",
      governanceLabel: "DAO storage migration required",
    });
    expect(statusRows[0]).toMatchObject({
      id: "Step-1",
      label: "Step 1",
      value: "Checklist",
      state: "Required",
    });
  });

  it("enumerates one honest source of truth for every rebalance guardrail", () => {
    const guardrailRows = buildGuardrailRows({
      profile: "standard",
      defaultSlippagePct: 0.5,
      maxSlippagePct: 5,
      primaryBufferPct: 0.25,
      fallbackBufferPct: 1,
      maxNotionalPerSwapBase: 100_000_000,
      maxPathLength: 6,
      forbidRouteCycles: true,
      chunkingThresholdBase: 25_000_000,
      maxChunkSizeBase: 5_000_000,
      postTradeDeviationBps: 250,
      dailyTurnoverCapBps: 1_000,
      emergencyPauseSwap: false,
      disabledProtocols: "SUSHI",
    });
    const sourceRows = buildGuardrailSourceRows();
    const summary = buildGuardrailSourceSummary();

    expect(sourceRows.map((row) => row.id)).toEqual(
      guardrailRows.map((row) => row.id),
    );
    expect(REBALANCE_GUARDRAIL_SOURCE_OF_TRUTH).toHaveLength(11);
    expect(
      REBALANCE_GUARDRAIL_SOURCE_OF_TRUTH.every(
        (source) =>
          source.source === "runtime_env" &&
          source.mutability === "operator_runtime_config" &&
          source.contractStorageRequired,
      ),
    ).toBe(true);
    expect(
      REBALANCE_GUARDRAIL_SOURCE_OF_TRUTH.some((source) =>
        source.mutabilityLabel.toLowerCase().includes("dao"),
      ),
    ).toBe(false);
    const visibleGuardrailCopy = [...guardrailRows, ...sourceRows]
      .map((row) => `${row.label} ${row.value} ${row.meta} ${row.state}`)
      .join(" ");
    expect(visibleGuardrailCopy).not.toMatch(/\bbps\b|basis points?|_BPS|\bbase\b/i);
    expect(sourceRows.find((row) => row.id === "daily-turnover-cap")).toMatchObject({
      value: "Runtime environment",
      governanceLabel: "DAO storage migration required",
      evaluationLabel: "indexed catalog activity, visible NAV, 24h execution window",
    });
    expect(summary.map((item) => item.id)).toEqual([
      "runtime-source",
      "contract-source",
      "dao-migration",
    ]);
    expect(summary[0]).toMatchObject({
      value: "11",
      tone: "warning",
    });
    expect(summary[1]).toMatchObject({
      value: "0",
      tone: "neutral",
    });
    expect(summary[2]).toMatchObject({
      value: "11 required",
      tone: "warning",
    });
  });

  it("builds spotlight cards for settings and status control decks", () => {
    const env = {
      NETWORK_PASSPHRASE: "Testnet",
      SOROBAN_RPC_URL: "https://rpc.invalid",
      ARKA_FACTORY: "CFACTORY",
      ARKA_REGISTRY: "CREGISTRY",
      BALANCED_SUPPORT_STATUS: "blocked",
      BALANCED_LANE_MODE: "legacy_comet",
      REBALANCE_SLIPPAGE_PROFILE: "standard",
      DEFAULT_REBALANCE_SLIPPAGE_PCT: "0.5",
      MAX_REBALANCE_SLIPPAGE_PCT: "5",
    };

    const settingsSpotlights = buildSettingsSpotlights({
      env,
      groups: buildSettingsGroups(env),
    });
    const settingsSignals = buildSettingsControlSignals({
      env,
      groups: buildSettingsGroups(env),
    });
    const statusSpotlights = buildStatusSpotlights({
      scopeCount: STATUS_SCOPE_ITEMS.length,
      operatorCount: STATUS_OPERATOR_STEPS.length,
      limitationCount: STATUS_LIMITATIONS.length,
      referenceCount: 1,
      profile: "standard",
    });
    const statusSignals = buildStatusControlSignals({
      scopeCount: STATUS_SCOPE_ITEMS.length,
      operatorCount: STATUS_OPERATOR_STEPS.length,
      limitationCount: STATUS_LIMITATIONS.length,
      referenceCount: 1,
      profile: "standard",
    });

    expect(settingsSpotlights.map((item) => item.id)).toEqual([
      "rpc-lane",
      "contract-map",
      "registry-route",
      "guardrail-window",
    ]);
    expect(settingsSpotlights[0]).toMatchObject({
      value: "Online",
      state: "Operator ready",
      tone: "positive",
    });
    expect(settingsSignals.map((item) => item.id)).toEqual([
      "rpc",
      "map",
      "profile",
    ]);
    expect(settingsSignals[0]).toMatchObject({
      value: "Configured",
      tone: "positive",
    });
    expect(settingsSignals[1]?.detail).toContain("Balanced is blocked via legacy_comet");
    expect(statusSpotlights.map((item) => item.id)).toEqual([
      "validated-scope",
      "operator-runbook",
      "watch-items",
      "reference-lane",
    ]);
    expect(statusSpotlights[2]).toMatchObject({
      label: "Watch items",
      state: "Monitor closely",
      tone: "warning",
    });
    expect(statusSignals.map((item) => item.id)).toEqual([
      "baseline",
      "operators",
      "limits",
    ]);
    expect(statusSignals[2]).toMatchObject({
      value: "3 limits",
      tone: "warning",
    });
  });

  it("maps oracle cutover runtime state into stable status rows", () => {
    const rows = buildStatusOracleRows({
      app: "ok",
      catalog: {
        configured: true,
        reachable: true,
        healthy: true,
        degraded: false,
        statusCode: 200,
        evaluatedAt: "2026-04-16T08:00:00Z",
      },
      protocols: {
        balanced: {
          validatedAt: null,
          adapterBalanced: "",
          poolId: 0,
          supportStatus: "blocked",
          readyForDappExecution: false,
          laneMode: "undeclared",
          blockingReasons: [],
          observedRouter: null,
          expectedRouter: null,
          poolSupported: false,
          pairConfigured: false,
          source: "fallback",
          validatedModule: {
            present: false,
            validatedAt: null,
            router: null,
            poolId: 0,
            sourceValidations: [],
            source: "fallback",
          },
          officialSurface: {
            validatedAt: null,
            officialSources: {
              app: null,
              bundle: null,
              stellarPage: null,
              swapDocs: null,
              tradeBlog: null,
              q3Blog: null,
            },
            topology: "unknown",
            swapModel: "unknown",
            liquidityModel: "unknown",
            publicRouterContractId: null,
            supportsPublicStellarTestnet: false,
            canonicalRouterCutoverPossible: false,
            intentAdapter: {
              quoteProvider: "unknown",
              quoteVisibleInApp: false,
              quoteComparableForArka: false,
              publicQuoteEndpoint: null,
              publicBuildEndpoint: null,
              publicRelayEndpoint: null,
              publicSubmitEndpoint: null,
              statusSurface: "unknown",
              publicStatusEndpoint: null,
              publicReceiptEndpoint: null,
              publicExpiryEndpoint: null,
              publicRefundEndpoint: null,
              cancellationWindowSeconds: null,
            },
            stellarMainnetAddresses: {
              connection: null,
              assetManager: null,
              xTokenManager: null,
              rateLimit: null,
            },
            findings: [],
            source: "fallback",
          },
          intentVenue: {
            discoveryState: "unavailable",
            discoveryModel: "unavailable",
            quoteState: "unavailable",
            quoteModel: "official_surface_unverified",
            comparableQuote: false,
            executeState: "unavailable",
            executeModel: "unavailable",
            confirmModel: "transaction_hash_plus_refresh",
            autoRoutingEligible: false,
            manualExecutionEligible: false,
            plannerAdmission: "blocked",
            notes: [],
          },
        },
      },
      routing: {
        mode: "backend_solver_with_local_fallback",
        planEndpoint: "/api/routing/rebalance/plan",
        fallbackMode: "local_workflow_solver",
        backendAvailable: true,
        generatedAt: "2026-04-16T08:00:00Z",
        balancedPlannerAdmission: "blocked",
        balancedManualExecutionEligible: false,
        balancedComparableQuote: false,
        balancedSupportStatus: "blocked",
        balancedLaneMode: "undeclared",
        balancedAutoSurfaceReady: false,
        balancedAutoSurfaceReason: "official surface unavailable",
        note: "Fallback solver remains active while Balanced is blocked.",
      },
      oracle: {
        source: "fallback",
        metrics: {
          ranking: "catalog_rank",
          nav: "catalog_nav",
          profit: "catalog_profit_or_activity",
          volume: "catalog_volume_or_activity",
          activityFallbackWindowEvents: 60,
        },
        oracle: {
          mode: "unverified",
          validatedAt: null,
          network: null,
          rpcUrl: null,
          oracleGuard: null,
          primaryOracle: null,
          secondaryOracle: null,
          validationAsset: null,
          selectedSourceUnderDivergence: null,
          source: "fallback",
        },
        deployment: {
          targetNetwork: "mainnet",
          deploymentsPath: "/tmp/deployments.mainnet.json",
          pathSource: "env_path",
          fileFound: false,
          networkMismatch: false,
          readError: "ENOENT",
        },
      },
    });

    expect(rows.map((row) => row.id)).toEqual([
      "oracle-target-network",
      "oracle-manifest",
      "oracle-lane",
      "oracle-provider",
      "oracle-cutover-gate",
    ]);
    expect(rows[0]).toMatchObject({
      value: "mainnet",
      state: "Resolved",
    });
    expect(rows[1]).toMatchObject({
      value: "Missing",
      state: "Blocked",
    });
    expect(rows[3]).toMatchObject({
      value: "not declared",
      state: "Undeclared",
    });
    expect(rows[4]).toMatchObject({
      value: "Blocked",
      state: "Blocked",
    });
  });

  it("labels testnet oracle readiness without implying mainnet cutover", () => {
    const rows = buildStatusOracleRows({
      oracle: {
        source: "deployments",
        metrics: {
          ranking: "catalog_rank",
          nav: "catalog_nav",
          profit: "catalog_profit_or_activity",
          volume: "catalog_volume_or_activity",
          activityFallbackWindowEvents: 60,
        },
        oracle: {
          mode: "oracle_guard",
          validatedAt: "2026-03-28",
          network: "testnet",
          rpcUrl: "https://soroban-testnet.stellar.org",
          oracleGuard: "CORACLEGUARD",
          primaryOracle: "CPRIMARY",
          secondaryOracle: "CSECONDARY",
          primaryProvider: "test-oracle",
          secondaryProvider: "test-oracle",
          provider: "test-oracle",
          validationAsset: "CASSET",
          selectedSourceUnderDivergence: 2,
          source: "deployments",
        },
        deployment: {
          targetNetwork: "testnet",
          deploymentsPath: "/app/config/deployments.testnet.json",
          pathSource: "bundled_testnet",
          fileFound: true,
          networkMismatch: false,
          readError: null,
        },
      },
      releaseGate: {
        oracleCutover: {
          status: "not_required",
          code: "not_required",
          targetNetwork: "testnet",
          ready: true,
          detail: "Runtime target is testnet.",
          checks: {
            manifestFound: true,
            networkMismatch: false,
            oracleMode: "oracle_guard",
            hasOracleGuard: true,
            hasPrimaryOracle: true,
            hasSecondaryOracle: true,
            providersVerified: false,
            thresholdsConfigured: false,
            noTestnetProviderFallback: true,
          },
        },
      },
    } as Parameters<typeof buildStatusOracleRows>[0]);

    expect(rows[4]).toMatchObject({
      value: "Testnet verified",
      state: "Not required",
    });
    expect(rows[4]?.meta).toContain("Mainnet publication gate is not enforced");
  });
});
