import { expect, test } from "@playwright/test";
import { enableOperatorMode } from "./helpers/operator-mode";

test.describe("release gate", () => {
  test("rejects release gate telemetry without an operator session", async ({
    request,
  }) => {
    const response = await request.get("/api/release/gate");
    expect(response.status()).toBe(401);

    const payload = await response.json();
    expect(payload).toEqual(
      expect.objectContaining({
        ok: false,
        error: "operator_access_required",
      }),
    );
  });

  test("rejects routing benchmark telemetry without an operator session", async ({
    request,
  }) => {
    const response = await request.get("/api/routing/rebalance/benchmark");
    expect(response.status()).toBe(401);

    const payload = await response.json();
    expect(payload).toEqual(
      expect.objectContaining({
        ok: false,
        error: "operator_access_required",
      }),
    );
  });

  test("exposes Smart Routing and Figma pixel audit as release-blocking gates", async ({
    page,
  }) => {
    await enableOperatorMode(page);
    const response = await page.request.get("/api/release/gate");
    expect([200, 503]).toContain(response.status());

    const payload = await response.json();
    expect(payload).toEqual(
      expect.objectContaining({
        ok: expect.any(Boolean),
        generatedAt: expect.any(String),
      }),
    );
    expect(payload.gates.routingBenchmark).toEqual(
      expect.objectContaining({
        ready: true,
        status: "ready",
        code: "ready",
        target: "smart_routing",
      }),
    );
    expect(payload.gates.routingBenchmark.checks).toEqual(
      expect.objectContaining({
        overallPassed: true,
        passedCount: expect.any(Number),
        resultCount: expect.any(Number),
        worstEfficiencyBps: expect.any(Number),
        brokerProfile: "broker_top_tier",
        allRequiredVenuesCovered: true,
        productionScaleReady: true,
        releaseEligible: true,
        millionScaleScenarioCount: expect.any(Number),
        splitRouteScenarioCount: expect.any(Number),
        failureCaseCount: expect.any(Number),
        failClosedCaseCount: expect.any(Number),
        maxCandidateUniverseSize: expect.any(Number),
      }),
    );
    expect(payload.gates.routingBenchmark.checks.resultCount).toBeGreaterThan(0);
    expect(payload.gates.routingBenchmark.checks.resultCount).toBeGreaterThanOrEqual(4);
    expect(payload.gates.routingBenchmark.checks.passedCount).toBe(
      payload.gates.routingBenchmark.checks.resultCount,
    );
    expect(payload.gates.routingCanary).toEqual(
      expect.objectContaining({
        ready: expect.any(Boolean),
        status: expect.stringMatching(/^(ready|blocked|not_required)$/),
        targetNetwork: expect.stringMatching(/^(testnet|mainnet)$/),
        required: expect.any(Boolean),
      }),
    );
    if (payload.gates.routingCanary.targetNetwork === "testnet") {
      expect(payload.gates.routingCanary.ready).toBe(true);
      expect(payload.gates.routingCanary.status).toBe("not_required");
    }
    expect(payload.gates.securityAudit).toEqual(
      expect.objectContaining({
        ready: true,
        status: "ready",
        code: "ready",
        target: "contract_security_audit",
      }),
    );
    expect(payload.gates.securityAudit.checks).toEqual(
      expect.objectContaining({
        blockingFindingCount: 0,
        criticalHighBlockingFindingCount: 0,
        failedInvariantCount: 0,
        undocumentedCriticalHighRemaining: 0,
      }),
    );
    expect(payload.gates.apiHardening).toEqual(
      expect.objectContaining({
        ready: true,
        status: "ready",
        routeCount: 32,
        failedInvariantCount: 0,
        e2eOnlyRouteCount: 1,
      }),
    );
    expect(payload.gates.productionEnvironment).toEqual(
      expect.objectContaining({
        ready: true,
        status: expect.stringMatching(/^(ready|not_required)$/),
        code: expect.stringMatching(/^(ready|not_required)$/),
        target: "production_environment",
      }),
    );
    expect(payload.gates.productionEnvironment.checks).toEqual(
      expect.objectContaining({
        releaseScriptPresent: true,
        releaseTestScriptPresent: true,
        vercelBuildRunsReleaseGate: true,
        dependencyAuditScriptPresent: true,
      }),
    );
    expect(payload.gates.productionEnvironment.evidence).toEqual(
      expect.objectContaining({
        buildCommand: "npm run release:gate",
        requiredProductionNetwork: "mainnet",
      }),
    );
    expect(payload.gates.testnetDressRehearsal).toEqual(
      expect.objectContaining({
        ready: true,
        status: "ready",
        code: "ready",
        target: "testnet_dress_rehearsal",
      }),
    );
    expect(payload.gates.testnetDressRehearsal.checks).toEqual(
      expect.objectContaining({
        requiredStepCount: 7,
        readyStepCount: 7,
        transactionHashCount: expect.any(Number),
        stateProofCount: expect.any(Number),
      }),
    );
    expect(payload.gates.testnetDressRehearsal.checks.transactionHashCount).toBeGreaterThanOrEqual(30);
    expect(payload.gates.testnetDressRehearsal.checks.stateProofCount).toBeGreaterThanOrEqual(70);
    expect(payload.gates.visualPixelAudit).toEqual(
      expect.objectContaining({
        ready: expect.any(Boolean),
        status: expect.stringMatching(/^(ready|blocked)$/),
        code: expect.stringMatching(
          /^(ready|report_missing|report_invalid|report_stale|coverage_mismatch|threshold_drift|missing_or_error_frames|strict_failures)$/,
        ),
        target: "figma_pixel_tight",
      }),
    );
    expect(payload.gates.visualPixelAudit.checks).toEqual(
      expect.objectContaining({
        reportFound: expect.any(Boolean),
        belowThreshold: expect.any(Number),
        rawBelowThreshold: expect.any(Number),
        waivedBelowThreshold: expect.any(Number),
        allThresholdsMet: expect.any(Boolean),
        coverageMatchesManifest: expect.any(Boolean),
      }),
    );
  });

  test("exposes production-scale Smart Routing benchmark telemetry", async ({
    page,
  }) => {
    await enableOperatorMode(page);
    const response = await page.request.get("/api/routing/rebalance/benchmark");
    expect(response.status()).toBe(200);

    const payload = await response.json();
    expect(payload).toEqual(
      expect.objectContaining({
        ok: true,
        source: "routing_benchmark",
        generatedAt: expect.any(String),
        targetNetwork: expect.stringMatching(/^(testnet|mainnet)$/),
      }),
    );
    expect(payload.benchmark).toEqual(
      expect.objectContaining({
        overallPassed: true,
        resultCount: 7,
        passedCount: 7,
      }),
    );
    expect(payload.benchmark.brokerComparison).toEqual(
      expect.objectContaining({
        profile: "broker_top_tier",
        requiredResultCount: 7,
        allRequiredVenuesCovered: true,
        productionScaleReady: true,
        releaseEligible: true,
        millionScaleScenarioCount: 1,
        splitRouteScenarioCount: 2,
        failureCaseCount: 1,
        failClosedCaseCount: 1,
      }),
    );
    expect(payload.benchmark.results).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "cyclic_frontier_gap_profile",
          passed: true,
          oracleModel: "exhaustive_route_enumeration",
          plannerSelectedProtocol: "SOROSWAP",
          quotedPathCount: 18,
          quoteBudget: 18,
          maxIntermediaries: 16,
          maxHops: 4,
        }),
        expect.objectContaining({
          id: "production_scale_tail_path_profile",
          passed: true,
          oracleModel: "known_global_best_route",
          plannerSelectedProtocol: "SOROSWAP",
          quotedPathCount: 128,
          quoteBudget: 128,
          maxIntermediaries: 32,
          maxHops: 6,
        }),
        expect.objectContaining({
          id: "multi_venue_fill_risk_arbiter",
          passed: true,
          plannerSelectedProtocol: "AQUARIUS",
          bestRawProtocol: "SOROSWAP",
          fillRiskModel: "route_score_penalty",
        }),
        expect.objectContaining({
          id: "no_live_venue_fail_closed",
          passed: true,
          failureCase: true,
          failClosed: true,
          oracleModel: "fail_closed_no_live_route",
        }),
      ]),
    );
    expect(payload.routingCanary).toEqual(
      expect.objectContaining({
        ready: expect.any(Boolean),
        status: expect.stringMatching(/^(ready|blocked|not_required)$/),
        required: expect.any(Boolean),
      }),
    );

    const productionScale = payload.benchmark.results.find(
      (result: { id: string }) =>
        result.id === "production_scale_tail_path_profile",
    );
    expect(productionScale.candidateUniverseSize).toBeGreaterThan(20_000_000);
    expect(productionScale.quoteCoveragePpm).toBeGreaterThan(0);
    expect(productionScale.quoteCoveragePpm).toBeLessThan(10);
    expect(productionScale.plannerSelectedPath).toContain("C32");
    expect(productionScale.plannerSelectedPath).toContain("C28");
    expect(productionScale.plannerEstimatedOutBase).toBe(
      productionScale.oracleEstimatedOutBase,
    );

    const fillRisk = payload.benchmark.results.find(
      (result: { id: string }) =>
        result.id === "multi_venue_fill_risk_arbiter",
    );
    expect(fillRisk.bestRawEstimatedOutBase).toBeGreaterThan(
      fillRisk.plannerEstimatedOutBase,
    );
    expect(fillRisk.selectedRawEfficiencyBps).toBeGreaterThanOrEqual(9_850);
  });
});
