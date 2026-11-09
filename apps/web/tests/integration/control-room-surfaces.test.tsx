import React from "react";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import SettingsPage from "@/app/settings/page";
import StatusPage from "@/app/status/page";

const LEGACY_MILESTONE_WORD = new RegExp(`tr${"anche"}`, "i");

function buildBenchmarkResponse() {
  return new Response(
    JSON.stringify({
      ok: true,
      source: "routing_benchmark",
      generatedAt: "2026-05-05T08:00:00.000Z",
      benchmark: {
        overallPassed: true,
        resultCount: 2,
        passedCount: 2,
        worstEfficiencyBps: 10_000,
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
            splitStatus: "single_route_optimal",
            splitAllocationCount: 1,
            candidateUniverseSize: 5_861,
            quotedPathCount: 64,
            exhaustivePathCount: 5_861,
            comparedRouteCount: 5_862,
            oracleModel: "exhaustive_route_enumeration",
            oraclePathCount: 5_861,
            quoteBudget: 64,
            maxHops: 5,
            maxIntermediaries: 10,
            quoteCoveragePpm: 10_920,
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
            note: "Benchmark fixture.",
          },
          {
            id: "chunked_split_route",
            label: "Chunked split-route benchmark",
            mode: "split_route",
            passed: true,
            minEfficiencyBps: 9_850,
            plannerEfficiencyBps: 10_000,
            amountBase: 1_000_000,
            plannerEstimatedOutBase: 1_190_000,
            oracleEstimatedOutBase: 1_190_000,
            plannerSelectedProtocol: "SOROSWAP",
            plannerSelectedPath: "CAAA -> CBBB",
            splitStatus: "recommended",
            splitAllocationCount: 3,
            candidateUniverseSize: 3,
            quotedPathCount: 3,
            exhaustivePathCount: 3,
            comparedRouteCount: 3,
            oracleModel: "exhaustive_chunk_assignment",
            oraclePathCount: 3,
            quoteBudget: 6,
            maxHops: 2,
            maxIntermediaries: 2,
            quoteCoveragePpm: 1_000_000,
            brokerGrade: true,
            failureCase: false,
            failClosed: false,
            venuesCompared: ["SOROSWAP", "AQUARIUS"],
            bestRawProtocol: "SOROSWAP",
            bestRawEstimatedOutBase: 1_190_000,
            selectedRawEfficiencyBps: 10_000,
            selectedRouteFillRiskPenaltyBps: 18,
            selectedRouteEffectivePenaltyBps: 223,
            worstComparedFillRiskPenaltyBps: 28,
            worstComparedEffectivePenaltyBps: 268,
            fillRiskModel: "split_allocation_penalty",
            note: "Benchmark fixture.",
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
          maxCandidateUniverseSize: 5_861,
          totalCandidateUniverseSize: 5_864,
          totalQuotedPathCount: 67,
          lowestQuoteCoveragePpm: 10_920,
          worstEfficiencyBps: 10_000,
          worstFillRiskPenaltyBps: 58,
          worstEffectivePenaltyBps: 403,
          allRequiredVenuesCovered: true,
          productionScaleReady: true,
          releaseEligible: true,
          notes: ["fixture"],
        },
      },
    }),
    { status: 200, headers: { "content-type": "application/json" } },
  );
}

function getFetchUrl(input: Parameters<typeof fetch>[0]): string {
  return input instanceof Request ? input.url : String(input);
}

describe("control room surfaces", () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("renders settings with grouped configuration and guardrails", async () => {
    const user = userEvent.setup();
    render(<SettingsPage />);

    expect(
      screen.getByRole("heading", { name: /^settings$/i }),
    ).toBeInTheDocument();
    expect(screen.getByTestId("settings-workspace-summary")).toHaveTextContent(
      "Configuration",
    );
    expect(screen.getByTestId("settings-workspace-summary")).toHaveClass(
      "secondary-operator-summary-cutover",
    );
    expect(screen.getByTestId("settings-workspace-tabs")).toHaveClass(
      "secondary-operator-tabs-cutover",
    );
    expect(screen.getByTestId("settings-utility-grid")).toHaveClass(
      "settings-utility-grid",
    );
    expect(screen.getByTestId("settings-utility-grid")).toHaveClass(
      "secondary-operator-stage-cutover",
    );
    expect(screen.getByTestId("settings-config-panel")).toHaveTextContent(
      "Control deck",
    );
    expect(screen.getByTestId("settings-config-panel")).toHaveClass(
      "settings-config-workspace-panel",
    );
    expect(screen.getByTestId("settings-config-panel")).toHaveClass(
      "secondary-operator-panel-cutover",
    );
    expect(screen.getByTestId("settings-config-panel")).toHaveTextContent(
      "Rebalance profile",
    );
    expect(screen.getByTestId("settings-config-panel")).toHaveTextContent(
      "Guardrail profile",
    );
    expect(screen.getByTestId("settings-network-table")).toHaveTextContent(
      "Network passphrase",
    );
    expect(screen.getByTestId("settings-network-table")).toHaveClass(
      "secondary-operator-table-cutover",
    );

    await user.click(screen.getByTestId("settings-workspace-tab-guardrails"));
    expect(screen.getByTestId("settings-guardrails-table")).toHaveTextContent(
      "Fallback ready",
    );
    expect(screen.getByTestId("settings-guardrails-table")).toHaveTextContent(
      "Max notional per swap",
    );
    expect(screen.getByTestId("settings-guardrails-table")).toHaveTextContent(
      "Path constraints",
    );
    expect(screen.getByTestId("settings-guardrails-table")).toHaveTextContent(
      "Daily turnover cap",
    );
    expect(screen.getByTestId("settings-guardrails-table")).toHaveTextContent(
      "Source: Runtime environment",
    );
    expect(screen.getByTestId("settings-guardrails-table")).not.toHaveTextContent(
      "DAO-governed input ceiling",
    );
    expect(
      screen.getByTestId("settings-guardrail-source-summary"),
    ).toHaveTextContent("11 required");
    expect(
      screen.getByTestId("settings-guardrail-source-table"),
    ).toHaveTextContent("Contract storage required");
    expect(
      screen.getByTestId("settings-guardrail-source-daily-turnover-cap"),
    ).toHaveTextContent("indexed catalog activity");
    expect(
      screen.getByTestId("settings-guardrail-source-emergency-pause-swap"),
    ).toHaveTextContent("DAO storage migration required");
    expect(screen.getByTestId("settings-guardrails-panel")).toHaveClass(
      "settings-guardrails-workspace-panel",
    );
    expect(screen.getByTestId("settings-guardrails-panel")).toHaveClass(
      "secondary-operator-panel-cutover",
    );
    expect(screen.getByTestId("settings-guardrails-table")).toHaveClass(
      "secondary-operator-table-cutover",
    );
    expect(screen.getByTestId("settings-guardrails-panel")).toHaveTextContent(
      "micro_liquidity",
    );

    await user.click(screen.getByTestId("settings-workspace-tab-raw"));
    expect(screen.getByTestId("settings-raw-panel")).toHaveTextContent(
      "MAX_REBALANCE_SLIPPAGE_PCT",
    );
    expect(screen.getByTestId("settings-raw-panel")).toHaveTextContent(
      "REBALANCE_MAX_PATH_LENGTH",
    );
    expect(screen.getByTestId("settings-raw-panel")).toHaveClass(
      "settings-raw-workspace-panel",
    );
    expect(screen.getByTestId("settings-raw-panel")).toHaveClass(
      "secondary-operator-code-panel-cutover",
    );
  });

  it("renders status without legacy milestone wording and with operator guidance", async () => {
    vi.spyOn(global, "fetch").mockImplementation(async (input) => {
      const url = getFetchUrl(input);
      if (url.includes("/api/routing/rebalance/benchmark")) {
        return buildBenchmarkResponse();
      }
      return new Response(
        JSON.stringify({
          app: "ok",
          catalog: {
            configured: false,
            reachable: false,
            healthy: false,
            degraded: false,
            statusCode: 0,
            evaluatedAt: null,
            error: "Catalog API base URL is not configured.",
          },
          protocols: {
            balanced: {
              supportStatus: "blocked",
            },
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
        }),
        {
          status: 503,
          headers: { "content-type": "application/json" },
        },
      );
    });

    const user = userEvent.setup();
    render(<StatusPage />);

    expect(
      screen.getByRole("heading", { name: /^status$/i }),
    ).toBeInTheDocument();
    expect(screen.getByTestId("status-workspace-tab-baseline")).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getByTestId("status-workspace-summary")).toHaveTextContent(
      "Operating scope",
    );
    expect(screen.getByTestId("status-workspace-summary")).toHaveClass(
      "secondary-operator-summary-cutover",
    );
    expect(screen.getByTestId("status-workspace-tabs")).toHaveClass(
      "secondary-operator-tabs-cutover",
    );
    expect(screen.getByTestId("status-utility-grid")).toHaveClass(
      "status-utility-grid",
    );
    expect(screen.getByTestId("status-utility-grid")).toHaveClass(
      "secondary-operator-stage-cutover",
    );
    expect(screen.getByTestId("status-baseline-panel")).toHaveTextContent(
      "Baseline deck",
    );
    expect(screen.getByTestId("status-baseline-panel")).toHaveClass(
      "status-baseline-workspace-panel",
    );
    expect(screen.getByTestId("status-baseline-panel")).toHaveClass(
      "secondary-operator-panel-cutover",
    );
    expect(screen.getByTestId("status-baseline-panel")).toHaveTextContent(
      /(Testnet|Mainnet|Custom network)\s+live/i,
    );
    expect(screen.getByTestId("status-baseline-panel")).toHaveTextContent(
      "Operator posture",
    );
    expect(screen.getByTestId("status-baseline-table")).toHaveTextContent(
      "Validated scope",
    );
    expect(screen.getByTestId("status-baseline-table")).toHaveClass(
      "secondary-operator-table-cutover",
    );

    await user.click(screen.getByTestId("status-workspace-tab-operator"));
    expect(screen.getByTestId("status-operator-table")).toHaveTextContent(
      "Operator check",
    );
    expect(screen.getByTestId("status-operator-panel")).toHaveClass(
      "status-operator-workspace-panel",
    );
    expect(screen.getByTestId("status-operator-panel")).toHaveClass(
      "secondary-operator-panel-cutover",
    );
    expect(screen.getByTestId("status-operator-table")).toHaveClass(
      "secondary-operator-table-cutover",
    );
    expect(screen.getByTestId("status-operator-panel")).toHaveTextContent(
      "micro_liquidity",
    );

    await user.click(screen.getByTestId("status-workspace-tab-limits"));
    expect(screen.getByTestId("status-limitations-table")).toHaveTextContent(
      "Known limit",
    );
    expect(screen.getByTestId("status-limitations-panel")).toHaveClass(
      "status-limits-workspace-panel",
    );
    expect(screen.getByTestId("status-limitations-panel")).toHaveClass(
      "secondary-operator-panel-cutover",
    );
    expect(screen.getByTestId("status-limitations-table")).toHaveClass(
      "secondary-operator-table-cutover",
    );

    await user.click(screen.getByTestId("status-workspace-tab-links"));
    expect(screen.getByTestId("status-links-table")).toHaveTextContent(
      "External",
    );
    expect(screen.getByTestId("status-links-panel")).toHaveClass(
      "status-links-workspace-panel",
    );
    expect(screen.getByTestId("status-links-panel")).toHaveClass(
      "secondary-operator-panel-cutover",
    );
    expect(screen.getByTestId("status-links-table")).toHaveClass(
      "secondary-operator-table-cutover",
    );
    expect(screen.getByTestId("status-links-panel")).toHaveTextContent(
      "Contracts repository",
    );

    await user.click(screen.getByTestId("status-workspace-tab-oracle"));
    await waitFor(() =>
      expect(screen.getByTestId("status-oracle-table")).toHaveTextContent(
        "Target network",
      ),
    );
    expect(screen.getByTestId("status-oracle-panel")).toHaveClass(
      "status-oracle-workspace-panel",
    );
    expect(screen.getByTestId("status-oracle-panel")).toHaveClass(
      "secondary-operator-panel-cutover",
    );
    expect(screen.getByTestId("status-oracle-table")).toHaveClass(
      "secondary-operator-table-cutover",
    );
    expect(screen.getByTestId("status-oracle-table")).toHaveTextContent(
      "mainnet",
    );
    expect(screen.getByTestId("status-oracle-table")).toHaveTextContent(
      "Missing",
    );
    expect(screen.getByTestId("status-oracle-table")).toHaveTextContent(
      "Oracle provider",
    );
    expect(screen.getByTestId("status-oracle-table")).toHaveTextContent(
      "not declared",
    );
    expect(screen.getByTestId("status-oracle-table")).toHaveTextContent(
      "Cutover gate",
    );

    await user.click(screen.getByTestId("status-workspace-tab-routing"));
    expect(screen.getByTestId("status-routing-solver-table")).toHaveTextContent(
      "Solver mode",
    );
    expect(screen.getByTestId("status-routing-solver-panel")).toHaveClass(
      "status-routing-workspace-panel",
    );
    expect(screen.getByTestId("status-routing-solver-table")).toHaveTextContent(
      "Balanced best-execution status",
    );
    expect(screen.getByTestId("status-routing-solver-table")).toHaveTextContent(
      "Balanced AUTO surface gate",
    );
    await waitFor(() =>
      expect(screen.getByTestId("status-routing-benchmark")).toHaveTextContent(
        "Benchmark passing",
      ),
    );
    expect(screen.getByTestId("status-routing-benchmark-table")).toHaveTextContent(
      "Bounded exhaustive deep-path benchmark",
    );
    expect(screen.getByTestId("status-routing-benchmark-table")).toHaveTextContent(
      "Chunked split-route benchmark",
    );
    expect(screen.getByTestId("status-routing-benchmark")).toHaveTextContent(
      "broker top tier",
    );
    expect(screen.getByTestId("status-routing-benchmark")).toHaveTextContent(
      "Fail-closed",
    );
    expect(screen.getByTestId("status-routing-benchmark-table")).toHaveTextContent(
      "route score penalty",
    );
    expect(screen.getByTestId("status-routing-benchmark-table")).toHaveTextContent(
      "split allocation penalty",
    );
    expect(screen.queryByText(LEGACY_MILESTONE_WORD)).not.toBeInTheDocument();
  });

  it("keeps status runtime health retryable when the health API degrades", async () => {
    const fetchMock = vi.spyOn(global, "fetch");
    let healthRequests = 0;
    fetchMock.mockImplementation(async (input) => {
      const url = getFetchUrl(input);
      if (url.includes("/api/routing/rebalance/benchmark")) {
        return buildBenchmarkResponse();
      }
      healthRequests += 1;
      if (healthRequests === 1) {
        return new Response(JSON.stringify({ error: "health offline" }), {
          status: 500,
          headers: { "content-type": "application/json" },
        });
      }
      return new Response(
        JSON.stringify({
            app: "ok",
            catalog: {
              configured: true,
              reachable: true,
              healthy: true,
              degraded: false,
              statusCode: 200,
              evaluatedAt: "2026-05-02T18:00:00.000Z",
            },
            protocols: {
              balanced: {
                supportStatus: "blocked",
                laneMode: "undeclared",
                blockingReasons: ["Balanced AUTO surface not wired."],
              },
            },
            routing: {
              mode: "backend_solver_with_local_fallback",
              planEndpoint: "/api/routing/rebalance/plan",
              fallbackMode: "local_workflow_solver",
              backendAvailable: true,
              generatedAt: "2026-05-02T18:00:00.000Z",
              balancedPlannerAdmission: "blocked",
              balancedManualExecutionEligible: false,
              balancedComparableQuote: false,
              balancedSupportStatus: "blocked",
              balancedLaneMode: "undeclared",
              balancedAutoSurfaceReady: false,
              balancedAutoSurfaceReason: "Not wired",
              note: "Backend solver reachable.",
            },
            oracle: {
              source: "deployments",
              metrics: {
                ranking: "catalog_rank",
                nav: "reflector_oracle_guard",
                profit: "reflector_oracle_guard",
                volume: "catalog_volume_or_activity",
                activityFallbackWindowEvents: 60,
              },
              oracle: {
                mode: "oracle_guard",
                validatedAt: "2026-05-02T18:00:00.000Z",
                network: "testnet",
                rpcUrl: "https://soroban-testnet.stellar.org",
                oracleGuard: "CORACLE",
                primaryOracle: "CREFLECTOR",
                secondaryOracle: null,
                primaryProvider: "Reflector",
                secondaryProvider: null,
                validationAsset: "XLM",
                selectedSourceUnderDivergence: null,
                source: "deployments",
              },
              deployment: {
                targetNetwork: "testnet",
                deploymentsPath: "/tmp/deployments.testnet.json",
                pathSource: "env_path",
                fileFound: true,
                networkMismatch: false,
                readError: null,
              },
            },
        }),
        {
          status: 200,
          headers: { "content-type": "application/json" },
        },
      );
    });

    const user = userEvent.setup();
    render(<StatusPage />);

    await waitFor(() =>
      expect(screen.getByTestId("status-health-error")).toHaveTextContent(
        /runtime health api is unavailable/i,
      ),
    );
    expect(screen.getByTestId("status-runtime-health-posture")).toHaveTextContent(
      "Runtime fallback active",
    );

    await user.click(screen.getByTestId("status-health-refresh-button"));

    await waitFor(() =>
      expect(screen.getByTestId("status-runtime-health-posture")).toHaveTextContent(
        "Runtime health loaded",
      ),
    );
    expect(screen.queryByTestId("status-health-error")).not.toBeInTheDocument();
    await user.click(screen.getByTestId("status-workspace-tab-routing"));
    expect(screen.getByTestId("status-routing-solver-table")).toHaveTextContent(
      "Online",
    );
    await waitFor(() =>
      expect(screen.getByTestId("status-routing-benchmark")).toHaveTextContent(
        "Benchmark passing",
      ),
    );
  });
});
