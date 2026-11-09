// @vitest-environment node

import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  OPERATOR_TEST_PUBLIC_KEY,
  OPERATOR_TEST_SECRET,
  operatorRequest,
} from "../helpers/operator-auth";
import type { FigmaPixelAuditGate } from "@/lib/qa/figmaPixelAuditGate";
import type { RebalanceBenchmarkReport } from "@/lib/workflows/rebalanceBenchmark";

const MAINNET_REFLECTOR_DEX =
  "CALI2BYU2JE6WVRUFYTS6MSBNEHGJ35P4AVCZYF3B6QOE3QKOB2PLE6M";
const MAINNET_REFLECTOR_EXTERNAL =
  "CAFJZQWSED6YAWZU3GWRTOCNPPCGBN32L7QV43XX5LZLFTK6JLN34DLN";
const ROUTING_CANARY_NOW = "2026-05-20T10:00:00.000Z";

describe("GET /api/release/gate", () => {
  const originalDeployPath = process.env.ARKAFUND_DEPLOYMENTS_PATH;
  const originalNetworkTarget = process.env.ARKAFUND_NETWORK_TARGET;
  let tempDir: string | null = null;

  beforeEach(() => {
    // Tests of other gates must not depend on the age of checked-in rehearsal
    // evidence. This clock applies only to this test process, never deployment.
    vi.stubEnv("ARKAFUND_TESTNET_REHEARSAL_NOW", "2026-06-03T20:05:00.000Z");
  });

  it("still blocks expired rehearsal evidence at the real deployment date", async () => {
    configureOperatorAccess();
    vi.stubEnv("ARKAFUND_NETWORK_TARGET", "mainnet");
    vi.stubEnv("ARKAFUND_TESTNET_REHEARSAL_NOW", "2026-10-06T16:00:00.000Z");
    process.env.ARKAFUND_DEPLOYMENTS_PATH = writeDeployments(validMainnetDeployments());
    const {GET} = await import("@/app/api/release/gate/route");
    const response = await GET(releaseGateRequest());
    const payload = await response.json();
    expect(response.status).toBe(503);
    expect(payload.gates.testnetDressRehearsal.ready).toBe(false);
    expect(payload.gates.testnetDressRehearsal.detail).toMatch(/stale|blocked|not ready/i);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.resetModules();
    vi.unstubAllEnvs();
    vi.doUnmock("@/lib/workflows/rebalanceBenchmark");
    vi.doUnmock("@/lib/qa/figmaPixelAuditGate");
    if (originalDeployPath === undefined) {
      delete process.env.ARKAFUND_DEPLOYMENTS_PATH;
    } else {
      process.env.ARKAFUND_DEPLOYMENTS_PATH = originalDeployPath;
    }
    if (originalNetworkTarget === undefined) {
      delete process.env.ARKAFUND_NETWORK_TARGET;
    } else {
      process.env.ARKAFUND_NETWORK_TARGET = originalNetworkTarget;
    }
    if (tempDir) {
      rmSync(tempDir, { recursive: true, force: true });
      tempDir = null;
    }
  });

  function writeDeployments(payload: unknown): string {
    tempDir = mkdtempSync(join(tmpdir(), "arkafund-release-gate-"));
    const deployPath = join(tempDir, "deployments.runtime.json");
    writeFileSync(deployPath, JSON.stringify(payload), "utf8");
    return deployPath;
  }

  function validMainnetDeployments() {
    return {
      validations: {
        oracleGuard: {
          validatedAt: "2026-04-16",
          network: "mainnet",
          provider: "Reflector Network",
          providers: {
            primary: "Reflector DEX Oracle",
            secondary: "Reflector External CEX/DEX Oracle",
          },
          contracts: {
            oracleGuard: "CORACLEGUARD",
            primaryOracle: MAINNET_REFLECTOR_DEX,
            secondaryOracle: MAINNET_REFLECTOR_EXTERNAL,
            validationAsset: "native:XLM",
          },
          thresholds: {
            maxOracleAgeSeconds: 300,
            maxDivergenceBps: 100,
            minProviderCount: 2,
          },
        },
        balancedReadiness: {
          supportStatus: "ready",
          readyForDappExecution: true,
          laneMode: "expected_router",
          adapterBalanced: "CBALANCED",
          poolId: 3,
        },
        balancedOfficialSurface: {
          officialSources: {
            app: "https://app.balanced.network",
            bundle: "https://app.balanced.network/assets/index.js",
            stellarPage: "https://balanced.network/stellar/",
            swapDocs: "https://docs.sodax.com/developers/packages",
            tradeBlog: "https://blog.balanced.network/trade-cross-chain/",
            q3Blog: "https://blog.balanced.network/q3-2025/",
          },
          topology: "intent_based",
          swapModel: "sodax_intents",
          liquidityModel: "legacy_exchange_only",
          publicRouterContractId: null,
          supportsPublicStellarTestnet: false,
          canonicalRouterCutoverPossible: false,
          intentAdapter: {
            quoteProvider: "sodax",
            quoteVisibleInApp: true,
            quoteComparableForArka: true,
            publicQuoteEndpoint: "sdk:@sodax/sdk::swaps.getQuote",
            publicBuildEndpoint: "sdk:@sodax/sdk::swaps.createIntent",
            publicRelayEndpoint: "sdk:@sodax/sdk::swaps.submitIntent",
            publicSubmitEndpoint: "sdk:@sodax/sdk::swaps.postExecution",
            statusSurface: "recent_activity",
            publicStatusEndpoint: "sdk:@sodax/sdk::swaps.getStatus",
            publicReceiptEndpoint: "sdk:@sodax/sdk::swaps.getSolvedIntentPacket",
            publicExpiryEndpoint: "sdk:@sodax/sdk::swaps.getIntent",
            publicRefundEndpoint: "sdk:@sodax/sdk::swaps.cancelIntent",
            cancellationWindowSeconds: 300,
          },
        },
        routingCanary: {
          network: "mainnet",
          validatedAt: "2026-05-20T09:45:00.000Z",
          maxAgeHours: 24,
          evidenceMode: "live_mainnet_quote_status",
          requiredVenues: ["SOROSWAP", "AQUARIUS", "BALANCED"],
          cases: [
            {
              id: "soroswap-xlm-usdc-mainnet",
              venue: "SOROSWAP",
              tokenIn: "native:XLM",
              tokenOut: "USDC:GA5ZSEJYB37N...",
              amountBase: "10000000",
              quoteOutBase: "9876543",
              selectedPath: ["native:XLM", "USDC:GA5ZSEJYB37N..."],
              candidateUniverseSize: 24_440_401,
              quotedPathCount: 192,
              minEfficiencyBps: 9_850,
              plannerEfficiencyBps: 9_998,
              passed: true,
              evidence: {
                mode: "live_mainnet_quote_status",
                collectedAt: "2026-05-20T09:30:00.000Z",
                source: "mainnet-soroswap-quote-and-status",
                liveMainnet: true,
              },
            },
            {
              id: "aquarius-xlm-usdc-mainnet",
              venue: "AQUARIUS",
              tokenIn: "native:XLM",
              tokenOut: "USDC:GA5ZSEJYB37N...",
              amountBase: "10000000",
              quoteOutBase: "9876500",
              selectedPath: ["native:XLM", "USDC:GA5ZSEJYB37N..."],
              candidateUniverseSize: 3,
              quotedPathCount: 1,
              minEfficiencyBps: 9_850,
              plannerEfficiencyBps: 9_994,
              passed: true,
              evidence: {
                mode: "live_mainnet_quote_status",
                collectedAt: "2026-05-20T09:31:00.000Z",
                source: "mainnet-aquarius-quote-and-status",
                liveMainnet: true,
              },
            },
            {
              id: "balanced-intent-xlm-usdc-mainnet",
              venue: "BALANCED",
              tokenIn: "native:XLM",
              tokenOut: "USDC:GA5ZSEJYB37N...",
              amountBase: "10000000",
              quoteOutBase: "9876400",
              selectedPath: ["native:XLM", "balanced:intent", "USDC:GA5ZSEJYB37N..."],
              candidateUniverseSize: 1,
              quotedPathCount: 1,
              minEfficiencyBps: 9_850,
              plannerEfficiencyBps: 9_990,
              passed: true,
              evidence: {
                mode: "live_mainnet_quote_status",
                collectedAt: "2026-05-20T09:32:00.000Z",
                source: "mainnet-balanced-sodax-quote-and-status",
                liveMainnet: true,
              },
            },
          ],
        },
      },
    };
  }

  function failingBenchmarkReport(): RebalanceBenchmarkReport {
    return {
      overallPassed: false,
      resultCount: 2,
      passedCount: 1,
      worstEfficiencyBps: 9_100,
      results: [
        {
          id: "bounded_exhaustive_deep_path",
          label: "Bounded exhaustive deep-path benchmark",
          mode: "single_route",
          passed: true,
          minEfficiencyBps: 9_850,
          plannerEfficiencyBps: 10_000,
          amountBase: 1_000_000,
          plannerEstimatedOutBase: 1_300_000,
          oracleEstimatedOutBase: 1_300_000,
          plannerSelectedProtocol: "SOROSWAP",
          plannerSelectedPath: "CAAA -> C10 -> C09 -> C08 -> C07 -> CBBB",
          splitStatus: "idle",
          splitAllocationCount: 0,
          candidateUniverseSize: 5_862,
          quotedPathCount: 64,
          exhaustivePathCount: 5_862,
          comparedRouteCount: 5_863,
          oracleModel: "exhaustive_route_enumeration",
          oraclePathCount: 5_862,
          quoteBudget: 64,
          maxHops: 5,
          maxIntermediaries: 10,
          quoteCoveragePpm: 10_918,
          brokerGrade: true,
          failureCase: false,
          failClosed: false,
          venuesCompared: ["SOROSWAP", "AQUARIUS"],
          bestRawProtocol: "SOROSWAP",
          bestRawEstimatedOutBase: 1_300_000,
          selectedRawEfficiencyBps: 10_000,
          selectedRouteFillRiskPenaltyBps: 58,
          selectedRouteEffectivePenaltyBps: 403,
          worstComparedFillRiskPenaltyBps: 58,
          worstComparedEffectivePenaltyBps: 403,
          fillRiskModel: "route_score_penalty",
          note: "QA benchmark fixture for bounded global route search.",
        },
        {
          id: "chunked_split_route",
          label: "Chunked split-route benchmark",
          mode: "split_route",
          passed: false,
          minEfficiencyBps: 9_850,
          plannerEfficiencyBps: 9_100,
          amountBase: 1_000_000,
          plannerEstimatedOutBase: 1_119_300,
          oracleEstimatedOutBase: 1_230_000,
          plannerSelectedProtocol: "AUTO_SPLIT",
          plannerSelectedPath: "Split across AQUARIUS and SOROSWAP",
          splitStatus: "recommended",
          splitAllocationCount: 2,
          candidateUniverseSize: 4,
          quotedPathCount: 4,
          exhaustivePathCount: 5,
          comparedRouteCount: 4,
          oracleModel: "exhaustive_chunk_assignment",
          oraclePathCount: 5,
          quoteBudget: 6,
          maxHops: 2,
          maxIntermediaries: 2,
          quoteCoveragePpm: 800_000,
          brokerGrade: true,
          failureCase: false,
          failClosed: false,
          venuesCompared: ["SOROSWAP", "AQUARIUS"],
          bestRawProtocol: "SOROSWAP",
          bestRawEstimatedOutBase: 1_230_000,
          selectedRawEfficiencyBps: 9_100,
          selectedRouteFillRiskPenaltyBps: 18,
          selectedRouteEffectivePenaltyBps: 223,
          worstComparedFillRiskPenaltyBps: 28,
          worstComparedEffectivePenaltyBps: 268,
          fillRiskModel: "split_allocation_penalty",
          note: "QA benchmark fixture for split-route global allocation.",
        },
      ],
      brokerComparison: {
        profile: "broker_top_tier",
        corpusVersion: "test",
        corpusName: "test broker corpus",
        requiredResultCount: 2,
        requiredVenues: ["SOROSWAP", "AQUARIUS"],
        optionalVenues: ["BALANCED"],
        venuesCovered: ["SOROSWAP", "AQUARIUS"],
        optionalVenuesNotCovered: ["BALANCED"],
        oracleModelsCovered: [
          "exhaustive_route_enumeration",
          "exhaustive_chunk_assignment",
        ],
        highScaleScenarioCount: 1,
        millionScaleScenarioCount: 1,
        splitRouteScenarioCount: 1,
        failureCaseCount: 1,
        failClosedCaseCount: 1,
        maxCandidateUniverseSize: 5_862,
        totalCandidateUniverseSize: 5_866,
        totalQuotedPathCount: 68,
        lowestQuoteCoveragePpm: 10_918,
        worstEfficiencyBps: 9_100,
        worstFillRiskPenaltyBps: 58,
        worstEffectivePenaltyBps: 403,
        allRequiredVenuesCovered: true,
        productionScaleReady: true,
        releaseEligible: false,
        notes: ["fixture"],
      },
    };
  }

  function readyVisualPixelAuditGate(): FigmaPixelAuditGate {
    return {
      ready: true,
      status: "ready",
      code: "ready",
      target: "figma_pixel_tight",
      reportPath: "/tmp/pixel/report.json",
      diffIndex: "/tmp/pixel/diff-index.html",
      detail: "Figma pixel audit is strict-ready across 21/21 compared frames.",
      checks: {
        reportFound: true,
        compared: 21,
        total: 21,
        missing: 0,
        errors: 0,
        belowThreshold: 0,
        strictFailureCount: 0,
        rawBelowThreshold: 0,
        waivedBelowThreshold: 0,
        allThresholdsMet: true,
        manifestHash: "manifest-hash",
        expectedManifestHash: "manifest-hash",
        manifestMatches: true,
        expectedReferencedCaptures: 21,
        reportReferencedCaptures: 21,
        coverageMatchesManifest: true,
        comparedViewports: ["desktop"],
        worstKey: "dashboard",
        worstSimilarity: 0.94,
        worstFrames: [],
        structuralCompared: 0,
        structuralWorstKey: null,
        structuralWorstSimilarity: null,
        structuralWorstFrames: [],
      },
    };
  }

  function blockedVisualPixelAuditGate(): FigmaPixelAuditGate {
    return {
      ...readyVisualPixelAuditGate(),
      ready: false,
      status: "blocked",
      code: "threshold_drift",
      detail:
        "Figma pixel audit is not strict-ready: 1 below threshold, 0 missing, 0 errors. Worst frame is create-assets at 62.74%.",
      checks: {
        ...readyVisualPixelAuditGate().checks,
        belowThreshold: 1,
        rawBelowThreshold: 1,
        allThresholdsMet: false,
        worstKey: "create-assets",
        worstSimilarity: 0.627449,
        worstFrames: [
          {
            key: "create-assets",
            title: "Create wizard - assets management step",
            route: "/factory/create?step=assets",
            status: "drift",
            similarity: 0.627449,
            threshold: 0.84,
            strictDelta: -0.212551,
          },
        ],
      },
    };
  }

  function mockVisualPixelAuditGate(gate = readyVisualPixelAuditGate()) {
    vi.doMock("@/lib/qa/figmaPixelAuditGate", () => ({
      readFigmaPixelAuditGate: vi.fn(() => gate),
    }));
  }

  function configureOperatorAccess() {
    vi.stubEnv("OPERATOR_ACCESS_SECRET", OPERATOR_TEST_SECRET);
    vi.stubEnv("NEXT_PUBLIC_ARKA_MANAGER", OPERATOR_TEST_PUBLIC_KEY);
    vi.stubEnv("ARKAFUND_ROUTING_CANARY_NOW", ROUTING_CANARY_NOW);
    vi.stubEnv("VERCEL_ENV", "development");
    vi.stubEnv("ARKAFUND_ADMIN_MODE", "");
    vi.stubEnv("NEXT_PUBLIC_GOVERNANCE_EXECUTOR_ID", "");
    vi.stubEnv("GOVERNANCE_EXECUTOR_ID", "");
    vi.stubEnv("ARKAFUND_GUARDIAN_MULTISIG_ID", "");
    vi.stubEnv("NEXT_PUBLIC_GUARDIAN_MULTISIG_ID", "");
    vi.stubEnv("ARKAFUND_TEMP_ADMIN_EXPIRES_AT", "");
    vi.stubEnv("ARKAFUND_TEMP_ADMIN_MAX_DAYS", "");
  }

  function releaseGateRequest(): Request {
    return operatorRequest("http://localhost/api/release/gate");
  }

  it("requires a verified operator session", async () => {
    const { GET } = await import("@/app/api/release/gate/route");

    const response = await GET(new Request("http://localhost/api/release/gate"));
    const payload = await response.json();

    expect(response.status).toBe(401);
    expect(payload.error).toBe("operator_access_required");
  });

  it("keeps testnet preview releasable without enforcing mainnet cutover gates", async () => {
    configureOperatorAccess();
    delete process.env.ARKAFUND_DEPLOYMENTS_PATH;
    process.env.ARKAFUND_NETWORK_TARGET = "testnet";
    mockVisualPixelAuditGate();
    const { GET } = await import("@/app/api/release/gate/route");

    const response = await GET(releaseGateRequest());
    const payload = await response.json();

    if(response.status!==200)console.error('GATE_DIAGNOSTIC',JSON.stringify({blockers:payload.blockers,gates:Object.fromEntries(Object.entries(payload.gates??{}).map(([k,v]:[string,any])=>[k,{status:v.status,summary:v.summary,blockers:v.blockers,reason:v.reason}]))}));
    expect(response.status).toBe(200);
    expect(payload.ok).toBe(true);
    expect(payload.gates.oracleCutover.status).toBe("not_required");
    expect(payload.gates.oracleCutover.targetNetwork).toBe("testnet");
    expect(payload.gates.balancedAutoSurface.status).toBe("not_required");
    expect(payload.gates.balancedAutoSurface.targetNetwork).toBe("testnet");
    expect(payload.gates.routingBenchmark.status).toBe("ready");
    expect(payload.gates.routingBenchmark.code).toBe("ready");
    expect(payload.gates.routingBenchmark.target).toBe("smart_routing");
    expect(payload.gates.routingCanary.status).toBe("not_required");
    expect(payload.gates.routingCanary.targetNetwork).toBe("testnet");
    expect(payload.gates.securityAudit.status).toBe("ready");
    expect(payload.gates.securityAudit.code).toBe("ready");
    expect(payload.gates.securityAudit.checks.failedInvariantCount).toBe(0);
    expect(payload.gates.apiHardening.status).toBe("ready");
    expect(payload.gates.apiHardening.routeCount).toBe(32);
    expect(payload.gates.apiHardening.failedInvariantCount).toBe(0);
    expect(payload.gates.productionEnvironment.status).toBe("not_required");
    expect(payload.gates.productionEnvironment.code).toBe("not_required");
    expect(payload.gates.productionEnvironment.target).toBe("production_environment");
    expect(payload.gates.productionEnvironment.checks).toEqual(
      expect.objectContaining({
        releaseScriptPresent: true,
        releaseTestScriptPresent: true,
        vercelBuildRunsReleaseGate: true,
        e2eWalletDisabledInProduction: true,
      }),
    );
    expect(payload.gates.testnetDressRehearsal.status).toBe("ready");
    expect(payload.gates.testnetDressRehearsal.code).toBe("ready");
    expect(payload.gates.testnetDressRehearsal.checks.readyStepCount).toBe(7);
    expect(
      payload.gates.testnetDressRehearsal.checks.transactionHashCount,
    ).toBeGreaterThanOrEqual(30);
    expect(
      payload.gates.testnetDressRehearsal.checks.stateProofCount,
    ).toBeGreaterThanOrEqual(70);
    expect(payload.gates.visualPixelAudit.status).toBe("ready");
  });

  it("uses the bundled mainnet manifest and marks release ready when all gates pass", async () => {
    configureOperatorAccess();
    delete process.env.ARKAFUND_DEPLOYMENTS_PATH;
    process.env.ARKAFUND_NETWORK_TARGET = "mainnet";
    mockVisualPixelAuditGate();
    const { GET } = await import("@/app/api/release/gate/route");

    const response = await GET(releaseGateRequest());
    const payload = await response.json();

    if(response.status!==200)console.error('GATE_DIAGNOSTIC',JSON.stringify({blockers:payload.blockers,gates:Object.fromEntries(Object.entries(payload.gates??{}).map(([k,v]:[string,any])=>[k,{status:v.status,summary:v.summary,blockers:v.blockers,reason:v.reason}]))}));
    expect(response.status).toBe(200);
    expect(payload.ok).toBe(true);
    expect(payload.gates.oracleCutover.status).toBe("ready");
    expect(payload.gates.oracleCutover.code).toBe("ready");
    expect(payload.gates.oracleCutover.targetNetwork).toBe("mainnet");
    expect(payload.gates.oracleCutover.checks.manifestFound).toBe(true);
    expect(payload.gates.oracleCutover.checks.providersVerified).toBe(true);
    expect(payload.gates.oracleCutover.checks.noTestnetProviderFallback).toBe(true);
    expect(payload.gates.balancedAutoSurface.status).toBe("ready");
    expect(payload.gates.balancedAutoSurface.code).toBe("ready");
    expect(payload.gates.routingBenchmark.status).toBe("ready");
    expect(payload.gates.routingCanary.status).toBe("ready");
    expect(payload.gates.routingCanary.code).toBe("ready");
    expect(payload.gates.routingCanary.checks.coveredVenues).toEqual([
      "SOROSWAP",
      "AQUARIUS",
      "PHOENIX", // Historical bundled evidence is decoded, never promoted to Sushi proof.
    ]);
    expect(payload.gates.securityAudit.status).toBe("ready");
    expect(payload.gates.securityAudit.code).toBe("ready");
    expect(payload.gates.apiHardening.status).toBe("ready");
    expect(payload.gates.apiHardening.failedInvariantCount).toBe(0);
    expect(payload.gates.productionEnvironment.status).toBe("not_required");
    expect(payload.gates.productionEnvironment.code).toBe("not_required");
    expect(payload.gates.visualPixelAudit.status).toBe("ready");
  });

  it("blocks production deployment when Vercel production is still wired to testnet", async () => {
    configureOperatorAccess();
    vi.stubEnv("VERCEL_ENV", "production");
    vi.stubEnv("VERCEL_PROJECT_PRODUCTION_URL", "app.arka.fund");
    process.env.ARKAFUND_NETWORK_TARGET = "testnet";
    mockVisualPixelAuditGate();
    const { GET } = await import("@/app/api/release/gate/route");

    const response = await GET(releaseGateRequest());
    const payload = await response.json();

    expect(response.status).toBe(503);
    expect(payload.ok).toBe(false);
    expect(payload.gates.oracleCutover.status).toBe("not_required");
    expect(payload.gates.productionEnvironment.status).toBe("blocked");
    expect(payload.gates.productionEnvironment.code).toBe(
      "production_network_mismatch",
    );
    expect(payload.gates.productionEnvironment.environment).toEqual(
      expect.objectContaining({
        vercelEnv: "production",
        observedDomain: "app.arka.fund",
        networkTarget: "testnet",
        deploymentNetworkTarget: "testnet",
      }),
    );
    expect(payload.gates.productionEnvironment.checks).toEqual(
      expect.objectContaining({
        productionUsesMainnet: false,
        domainAllowed: true,
        vercelBuildRunsReleaseGate: true,
      }),
    );
  });

  it("blocks preview deployment when it points at mainnet without explicit rehearsal override", async () => {
    configureOperatorAccess();
    // This case explicitly tests the absence of the override, even when CI is
    // building an authorized, read-only mainnet preview that sets it globally.
    vi.stubEnv("ARKAFUND_ALLOW_PREVIEW_MAINNET", "");
    vi.stubEnv("VERCEL_ENV", "preview");
    vi.stubEnv("VERCEL_URL", "arkafund-dapp-git-feature.vercel.app");
    process.env.ARKAFUND_NETWORK_TARGET = "mainnet";
    process.env.ARKAFUND_DEPLOYMENTS_PATH = writeDeployments(validMainnetDeployments());
    mockVisualPixelAuditGate();
    const { GET } = await import("@/app/api/release/gate/route");

    const response = await GET(releaseGateRequest());
    const payload = await response.json();

    expect(response.status).toBe(503);
    expect(payload.ok).toBe(false);
    expect(payload.gates.productionEnvironment.status).toBe("blocked");
    expect(payload.gates.productionEnvironment.code).toBe("preview_mainnet_blocked");
    expect(payload.gates.productionEnvironment.checks.previewMainnetBlocked).toBe(
      true,
    );
    expect(payload.gates.oracleCutover.status).toBe("ready");
  });

  it("returns blocked when runtime target is mainnet and explicit manifest path is missing", async () => {
    configureOperatorAccess();
    process.env.ARKAFUND_DEPLOYMENTS_PATH = "/tmp/arkafund-missing-mainnet-manifest.json";
    process.env.ARKAFUND_NETWORK_TARGET = "mainnet";
    mockVisualPixelAuditGate();
    const { GET } = await import("@/app/api/release/gate/route");

    const response = await GET(releaseGateRequest());
    const payload = await response.json();

    expect(response.status).toBe(503);
    expect(payload.ok).toBe(false);
    expect(payload.gates.oracleCutover.status).toBe("blocked");
    expect(payload.gates.oracleCutover.code).toBe("manifest_missing");
    expect(payload.gates.oracleCutover.targetNetwork).toBe("mainnet");
    expect(payload.gates.oracleCutover.checks.manifestFound).toBe(false);
  });

  it("returns blocked when runtime target is mainnet and oracle validation network mismatches", async () => {
    configureOperatorAccess();
    process.env.ARKAFUND_NETWORK_TARGET = "mainnet";
    process.env.ARKAFUND_DEPLOYMENTS_PATH = writeDeployments({
      validations: {
        oracleGuard: {
          validatedAt: "2026-04-16",
          network: "testnet",
          contracts: {
            oracleGuard: "CORACLEGUARD",
            primaryOracle: MAINNET_REFLECTOR_DEX,
            secondaryOracle: MAINNET_REFLECTOR_EXTERNAL,
            validationAsset: "native:XLM",
          },
          thresholds: {
            maxOracleAgeSeconds: 300,
            maxDivergenceBps: 100,
            minProviderCount: 2,
          },
        },
      },
    });
    mockVisualPixelAuditGate();
    const { GET } = await import("@/app/api/release/gate/route");

    const response = await GET(releaseGateRequest());
    const payload = await response.json();

    expect(response.status).toBe(503);
    expect(payload.ok).toBe(false);
    expect(payload.gates.oracleCutover.status).toBe("blocked");
    expect(payload.gates.oracleCutover.code).toBe("network_mismatch");
    expect(payload.gates.oracleCutover.checks.networkMismatch).toBe(true);
    expect(payload.gates.balancedAutoSurface.status).toBe("blocked");
    expect(payload.gates.routingBenchmark.status).toBe("ready");
    expect(payload.gates.routingCanary.status).toBe("blocked");
    expect(payload.gates.routingCanary.code).toBe("canary_missing");
    expect(payload.gates.securityAudit.status).toBe("ready");
    expect(payload.gates.apiHardening.status).toBe("ready");
    expect(payload.gates.visualPixelAudit.status).toBe("ready");
  });

  it("returns ready when runtime target is mainnet and oracle guard contracts are fully validated", async () => {
    configureOperatorAccess();
    process.env.ARKAFUND_NETWORK_TARGET = "mainnet";
    process.env.ARKAFUND_DEPLOYMENTS_PATH = writeDeployments(validMainnetDeployments());
    mockVisualPixelAuditGate();
    const { GET } = await import("@/app/api/release/gate/route");

    const response = await GET(releaseGateRequest());
    const payload = await response.json();

    if(response.status!==200)console.error('GATE_DIAGNOSTIC',JSON.stringify({blockers:payload.blockers,gates:Object.fromEntries(Object.entries(payload.gates??{}).map(([k,v]:[string,any])=>[k,{status:v.status,summary:v.summary,blockers:v.blockers,reason:v.reason}]))}));
    expect(response.status).toBe(200);
    expect(payload.ok).toBe(true);
    expect(payload.gates.oracleCutover.status).toBe("ready");
    expect(payload.gates.oracleCutover.code).toBe("ready");
    expect(payload.gates.oracleCutover.targetNetwork).toBe("mainnet");
    expect(payload.gates.balancedAutoSurface.status).toBe("ready");
    expect(payload.gates.balancedAutoSurface.code).toBe("ready");
    expect(payload.gates.balancedAutoSurface.targetNetwork).toBe("mainnet");
    expect(payload.gates.balancedAutoSurface.checks).toMatchObject({
      officialEvidenceReady: true,
      officialAutoComparable: true,
      hasNoPublicRouterContractId: true,
      officialEvidenceCode: "verified_auto_ready",
    });
    expect(payload.gates.routingBenchmark.status).toBe("ready");
    expect(payload.gates.routingBenchmark.code).toBe("ready");
    expect(payload.gates.routingBenchmark.checks.passedCount).toBe(
      payload.gates.routingBenchmark.checks.resultCount,
    );
    expect(payload.gates.routingCanary.status).toBe("ready");
    expect(payload.gates.routingCanary.code).toBe("ready");
    expect(payload.gates.routingCanary.checks.coveredVenues).toEqual([
      "SOROSWAP",
      "AQUARIUS",
      "BALANCED",
    ]);
    expect(payload.gates.securityAudit.status).toBe("ready");
    expect(payload.gates.securityAudit.checks.criticalHighBlockingFindingCount).toBe(0);
    expect(payload.gates.securityAudit.checks.failedInvariantCount).toBe(0);
    expect(payload.gates.productionEnvironment.status).toBe("not_required");
    expect(payload.gates.productionEnvironment.code).toBe("not_required");
    expect(payload.gates.productionEnvironment.checks.vercelBuildRunsReleaseGate).toBe(
      true,
    );
    expect(payload.gates.testnetDressRehearsal.status).toBe("ready");
    expect(payload.gates.testnetDressRehearsal.code).toBe("ready");
    expect(payload.gates.visualPixelAudit.status).toBe("ready");
    expect(payload.gates.visualPixelAudit.code).toBe("ready");
  });

  it("returns ready for production only with DAO executor and guardian multisig policy", async () => {
    configureOperatorAccess();
    vi.stubEnv("VERCEL_ENV", "production");
    vi.stubEnv("VERCEL_PROJECT_PRODUCTION_URL", "app.arka.fund");
    vi.stubEnv("ARKAFUND_ADMIN_MODE", "dao");
    vi.stubEnv("NEXT_PUBLIC_GOVERNANCE_EXECUTOR_ID", "CEXECUTOR");
    vi.stubEnv("ARKAFUND_GUARDIAN_MULTISIG_ID", "CGUARDIAN");
    process.env.ARKAFUND_NETWORK_TARGET = "mainnet";
    process.env.ARKAFUND_DEPLOYMENTS_PATH = writeDeployments(validMainnetDeployments());
    mockVisualPixelAuditGate();
    const { GET } = await import("@/app/api/release/gate/route");

    const response = await GET(releaseGateRequest());
    const payload = await response.json();

    if(response.status!==200)console.error('GATE_DIAGNOSTIC',JSON.stringify({blockers:payload.blockers,gates:Object.fromEntries(Object.entries(payload.gates??{}).map(([k,v]:[string,any])=>[k,{status:v.status,summary:v.summary,blockers:v.blockers,reason:v.reason}]))}));
    expect(response.status).toBe(200);
    expect(payload.ok).toBe(true);
    expect(payload.gates.productionEnvironment.status).toBe("ready");
    expect(payload.gates.productionEnvironment.code).toBe("ready");
    expect(payload.gates.productionEnvironment.checks).toEqual(
      expect.objectContaining({
        adminPolicyReadyInProduction: true,
        daoExecutorConfiguredInProduction: true,
        guardianMultisigConfigured: true,
        productionUsesMainnet: true,
      }),
    );
    expect(payload.gates.productionEnvironment.evidence).toEqual(
      expect.objectContaining({
        adminMode: "dao",
        daoExecutorId: "CEXECUTOR",
        guardianMultisigId: "CGUARDIAN",
        temporaryAdminMaxDays: 365,
      }),
    );
  });

  it("blocks production temporary EOA mode when DAO executor is missing", async () => {
    configureOperatorAccess();
    vi.stubEnv("VERCEL_ENV", "production");
    vi.stubEnv("VERCEL_PROJECT_PRODUCTION_URL", "app.arka.fund");
    vi.stubEnv("ARKAFUND_ADMIN_MODE", "temporary_eoa");
    vi.stubEnv(
      "ARKAFUND_TEMP_ADMIN_EXPIRES_AT",
      new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    );
    vi.stubEnv("ARKAFUND_GUARDIAN_MULTISIG_ID", "CGUARDIAN");
    process.env.ARKAFUND_NETWORK_TARGET = "mainnet";
    process.env.ARKAFUND_DEPLOYMENTS_PATH = writeDeployments(validMainnetDeployments());
    mockVisualPixelAuditGate();
    const { GET } = await import("@/app/api/release/gate/route");

    const response = await GET(releaseGateRequest());
    const payload = await response.json();

    expect(response.status).toBe(503);
    expect(payload.ok).toBe(false);
    expect(payload.gates.oracleCutover.status).toBe("ready");
    expect(payload.gates.productionEnvironment.status).toBe("blocked");
    expect(payload.gates.productionEnvironment.code).toBe("admin_policy_blocked");
    expect(payload.gates.productionEnvironment.checks).toEqual(
      expect.objectContaining({
        daoExecutorConfiguredInProduction: false,
        temporaryAdminExpiryFuture: true,
        temporaryAdminWithinMaxDuration: true,
        guardianMultisigConfigured: true,
        adminPolicyReadyInProduction: false,
      }),
    );
  });

  it("blocks release when Balanced/SODAX is declared as a public router contract", async () => {
    configureOperatorAccess();
    process.env.ARKAFUND_NETWORK_TARGET = "mainnet";
    const deployments = validMainnetDeployments();
    (
      deployments.validations.balancedOfficialSurface as {
        publicRouterContractId: string | null;
      }
    ).publicRouterContractId = "CFAKEROUTER";
    process.env.ARKAFUND_DEPLOYMENTS_PATH = writeDeployments(deployments);
    mockVisualPixelAuditGate();
    const { GET } = await import("@/app/api/release/gate/route");

    const response = await GET(releaseGateRequest());
    const payload = await response.json();

    expect(response.status).toBe(503);
    expect(payload.ok).toBe(false);
    expect(payload.gates.oracleCutover.status).toBe("ready");
    expect(payload.gates.balancedAutoSurface.status).toBe("blocked");
    expect(payload.gates.balancedAutoSurface.code).toBe("router_contract_declared");
    expect(payload.gates.balancedAutoSurface.checks).toMatchObject({
      officialEvidenceReady: false,
      officialAutoComparable: false,
      hasNoPublicRouterContractId: false,
      publicRouterContractId: "CFAKEROUTER",
      officialEvidenceCode: "router_contract_declared",
    });
    expect(payload.gates.balancedAutoSurface.detail).toMatch(
      /cannot declare a public router contract ID/i,
    );
    expect(payload.gates.routingBenchmark.status).toBe("ready");
    expect(payload.gates.routingCanary.status).toBe("ready");
    expect(payload.gates.securityAudit.status).toBe("ready");
    expect(payload.gates.visualPixelAudit.status).toBe("ready");
  });

  it("blocks release when the Smart Routing benchmark gate fails", async () => {
    configureOperatorAccess();
    process.env.ARKAFUND_NETWORK_TARGET = "mainnet";
    process.env.ARKAFUND_DEPLOYMENTS_PATH = writeDeployments(validMainnetDeployments());
    mockVisualPixelAuditGate();
    vi.doMock("@/lib/workflows/rebalanceBenchmark", () => ({
      runRebalanceBenchmarkSuite: vi.fn(async () => failingBenchmarkReport()),
    }));
    const { GET } = await import("@/app/api/release/gate/route");

    const response = await GET(releaseGateRequest());
    const payload = await response.json();

    expect(response.status).toBe(503);
    expect(payload.ok).toBe(false);
    expect(payload.gates.oracleCutover.status).toBe("ready");
    expect(payload.gates.balancedAutoSurface.status).toBe("ready");
    expect(payload.gates.routingBenchmark.status).toBe("blocked");
    expect(payload.gates.routingBenchmark.code).toBe("benchmark_failed");
    expect(payload.gates.routingCanary.status).toBe("ready");
    expect(payload.gates.routingBenchmark.checks.failedResultIds).toEqual([
      "chunked_split_route",
    ]);
    expect(payload.gates.securityAudit.status).toBe("ready");
    expect(payload.gates.visualPixelAudit.status).toBe("ready");
  });

  it("blocks release when the mainnet routing canary evidence is stale", async () => {
    configureOperatorAccess();
    process.env.ARKAFUND_NETWORK_TARGET = "mainnet";
    const deployments = validMainnetDeployments();
    deployments.validations.routingCanary.validatedAt = "2026-05-18T09:45:00.000Z";
    process.env.ARKAFUND_DEPLOYMENTS_PATH = writeDeployments(deployments);
    mockVisualPixelAuditGate();
    const { GET } = await import("@/app/api/release/gate/route");

    const response = await GET(releaseGateRequest());
    const payload = await response.json();

    expect(response.status).toBe(503);
    expect(payload.ok).toBe(false);
    expect(payload.gates.oracleCutover.status).toBe("ready");
    expect(payload.gates.balancedAutoSurface.status).toBe("ready");
    expect(payload.gates.routingBenchmark.status).toBe("ready");
    expect(payload.gates.routingCanary.status).toBe("blocked");
    expect(payload.gates.routingCanary.code).toBe("canary_stale");
    expect(payload.gates.routingCanary.checks.stale).toBe(true);
    expect(payload.gates.securityAudit.status).toBe("ready");
    expect(payload.gates.visualPixelAudit.status).toBe("ready");
  });

  it("keeps Figma pixel drift as non-blocking visual QA advisory", async () => {
    configureOperatorAccess();
    process.env.ARKAFUND_NETWORK_TARGET = "mainnet";
    process.env.ARKAFUND_DEPLOYMENTS_PATH = writeDeployments(validMainnetDeployments());
    mockVisualPixelAuditGate(blockedVisualPixelAuditGate());
    const { GET } = await import("@/app/api/release/gate/route");

    const response = await GET(releaseGateRequest());
    const payload = await response.json();

    if(response.status!==200)console.error('GATE_DIAGNOSTIC',JSON.stringify({blockers:payload.blockers,gates:Object.fromEntries(Object.entries(payload.gates??{}).map(([k,v]:[string,any])=>[k,{status:v.status,summary:v.summary,blockers:v.blockers,reason:v.reason}]))}));
    expect(response.status).toBe(200);
    expect(payload.ok).toBe(true);
    expect(payload.gates.oracleCutover.status).toBe("ready");
    expect(payload.gates.balancedAutoSurface.status).toBe("ready");
    expect(payload.gates.routingBenchmark.status).toBe("ready");
    expect(payload.gates.routingCanary.status).toBe("ready");
    expect(payload.gates.securityAudit.status).toBe("ready");
    expect(payload.gates.visualPixelAudit.status).toBe("blocked");
    expect(payload.gates.visualPixelAudit.code).toBe("threshold_drift");
    expect(payload.gates.visualPixelAudit.checks.worstKey).toBe("create-assets");
    expect(payload.gates.visualPixelAudit.releaseBlocking).toBe(false);
    expect(payload.gates.visualPixelAudit.advisory).toBe(true);
  });
});
