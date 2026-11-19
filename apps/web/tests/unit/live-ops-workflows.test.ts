import { describe, expect, it } from "vitest";
import {
  buildArkaExecutionSpotlights,
  buildArkaFlowSpotlights,
  buildArkasIndexSpotlights,
  buildOpsRunbookSpotlights,
  buildOpsSpotlights,
  deriveArkaDirectNavigationState,
  deriveArkaStageSummary,
  buildTierActionSpotlights,
  buildTierSpotlights,
  deriveOpsHealthSummary,
  deriveTierSummary,
  formatBaseUnits,
  isValidArkaContractId,
  normalizeArkaContractInput,
  tierLabel,
} from "@/lib/workflows/liveOps";

describe("liveOps workflows", () => {
  it("formats base-unit balances for operator displays", () => {
    expect(formatBaseUnits(12_345_678)).toBe("1.2346");
    expect(formatBaseUnits(null)).toBe("n/a");
  });

  it('does not turn missing or unselected coverage into an empty healthy reserve', () => {
    const summary = deriveOpsHealthSummary({
      governorOk: false, votesOk: false, coverageVaultBalance: null, coverageFundStaked: null,
      tierThresholds: null, balancedRouter: null, aquariusRouter: null, soroswapRouter: null, blendRouter: null,
      governorId: '', votesId: '', coverageVaultId: '', coverageFundId: '', managerTierId: '',
      balancedAdapterId: '', aquariusAdapterId: '', soroswapAdapterId: '', blendAdapterId: '',
      expectedBalancedRouter: null, balancedSupportStatus: 'blocked', balancedLaneMode: '',
      expectedAquariusRouter: '', expectedSoroswapRouter: '', expectedBlendRouter: '',
    });
    expect(summary.rows.find(row => row.id === 'coverage-vault')).toMatchObject({status:'Not selected',healthy:false});
    expect(summary.rows.find(row => row.id === 'coverage-fund')).toMatchObject({status:'Not verified',healthy:false});
    expect(summary.coverageVaultFormatted).toBe('n/a');
    expect(summary.coverageFundFormatted).toBe('n/a');
  });

  it("derives operations health rows and aggregate posture", () => {
    const summary = deriveOpsHealthSummary({
      governorOk: true,
      votesOk: true,
      coverageVaultBalance: 12_000_000,
      coverageFundStaked: 88_000_000,
      tierThresholds: [100, 500, 1000],
      balancedRouter: "CBALANCEDROUTER",
      aquariusRouter: "CAQUARIUSROUTER",
      soroswapRouter: "CSOROSWAPROUTER",
      blendRouter: "CBLENDROUTER",
      governorId: "CGOV",
      votesId: "CVOTES",
      coverageVaultId: "CCOVERAGEVAULT",
      coverageFundId: "CCOVERAGEFUND",
      managerTierId: "CTIER",
      balancedAdapterId: "CADAPTER0",
      aquariusAdapterId: "CADAPTER1",
      soroswapAdapterId: "CADAPTER2",
      blendAdapterId: "CADAPTER3",
      balancedSupportStatus: "ready",
      balancedLaneMode: "expected_router",
      expectedBalancedRouter: "CBALANCEDROUTER",
      expectedAquariusRouter: "CAQUARIUSROUTER",
      expectedSoroswapRouter: "CSOROSWAPROUTER",
      expectedBlendRouter: "CBLENDROUTER",
    });

    expect(summary.healthyCount).toBe(summary.totalChecks);
    expect(summary.degraded).toBe(false);
    expect(summary.thresholdSummary).toBe("100 / 500 / 1000");
    expect(summary.rows.find((row) => row.id === "balanced-adapter")?.status).toBe("OK");
    expect(summary.rows.find((row) => row.id === "aquarius-adapter")?.status).toBe("OK");
    expect(summary.rows.find((row) => row.id === "soroswap-adapter")?.status).toBe("OK");

    const spotlights = buildOpsSpotlights(summary);
    expect(spotlights.map((item) => item.id)).toEqual([
      "ops-health",
      "ops-coverage",
      "ops-routing",
      "ops-tiers",
    ]);
    expect(spotlights[0]).toMatchObject({
      state: "Healthy",
      tone: "positive",
    });

    const cadenceSpotlights = buildOpsRunbookSpotlights(summary);
    expect(cadenceSpotlights.map((item) => item.id)).toEqual([
      "ops-governance-baseline",
      "ops-reserve-gate",
      "ops-routing-lane",
    ]);
    expect(cadenceSpotlights[2]).toMatchObject({
      value: "All routes aligned",
      tone: "positive",
    });
  });

  it("keeps Balanced blocked in ops summaries while the legacy lane is still deployed", () => {
    const summary = deriveOpsHealthSummary({
      governorOk: true,
      votesOk: true,
      coverageVaultBalance: 12_000_000,
      coverageFundStaked: 88_000_000,
      tierThresholds: [100, 500, 1000],
      balancedRouter: "CCOMETLEGACY",
      aquariusRouter: "CAQUARIUSROUTER",
      soroswapRouter: "CSOROSWAPROUTER",
      blendRouter: "CBLENDROUTER",
      governorId: "CGOV",
      votesId: "CVOTES",
      coverageVaultId: "CCOVERAGEVAULT",
      coverageFundId: "CCOVERAGEFUND",
      managerTierId: "CTIER",
      balancedAdapterId: "CADAPTER0",
      aquariusAdapterId: "CADAPTER1",
      soroswapAdapterId: "CADAPTER2",
      blendAdapterId: "CADAPTER3",
      balancedSupportStatus: "blocked",
      balancedLaneMode: "legacy_comet",
      expectedBalancedRouter: null,
      expectedAquariusRouter: "CAQUARIUSROUTER",
      expectedSoroswapRouter: "CSOROSWAPROUTER",
      expectedBlendRouter: "CBLENDROUTER",
    });

    expect(summary.rows.find((row) => row.id === "balanced-adapter")).toMatchObject({
      status: "Blocked",
      healthy: false,
    });
    expect(summary.adapterSummary).toBe("Route mismatch detected");
  });

  it("derives tier progression and next milestone", () => {
    expect(tierLabel(3)).toBe("Tier 3");

    const summary = deriveTierSummary({
      pubKey: "GUSER",
      targetManager: "GMANAGER",
      points: 620,
      tier: 2,
      thresholds: [100, 500, 1000],
    });

    expect(summary.label).toBe("Tier 2");
    expect(summary.walletConnected).toBe(true);
    expect(summary.nextStep).toContain("Tier 3");
    expect(summary.stageRows[0]?.state).toBe("Unlocked");
    expect(summary.stageRows[2]?.state).toBe("Pending");

    const tierSpotlights = buildTierSpotlights(summary);
    expect(tierSpotlights.map((item) => item.id)).toEqual([
      "tier-wallet",
      "tier-rank",
      "tier-thresholds",
      "tier-next-step",
    ]);
    expect(tierSpotlights[1]).toMatchObject({
      value: "Tier 2",
      tone: "positive",
    });

    const actionSpotlights = buildTierActionSpotlights({
      walletConnected: true,
      canAct: true,
      targetLabel: summary.targetLabel,
      deltaLabel: "100",
      status: "",
    });
    expect(actionSpotlights.map((item) => item.id)).toEqual([
      "tier-action-wallet",
      "tier-action-target",
      "tier-action-delta",
    ]);
    expect(actionSpotlights[0]).toMatchObject({
      state: "Submission ready",
      tone: "positive",
    });
  });

  it("builds direct-execution and vault-execution spotlight decks", () => {
    const arkasSpotlights = buildArkasIndexSpotlights({
      recentCount: 2,
      registryCount: 18,
      registryState: "ready",
      showAll: false,
      activeId: "CDJ7G22ETJ6PRUM5GDPUXYEY3JL6MDY35WMJYWSGX7U6DV5VMQEKH3PG",
    });
    const executionSpotlights = buildArkaExecutionSpotlights({
      isManager: true,
      navLabel: "15.2000000",
      shareLabel: "1.3000000",
      protocol: "AQUARIUS",
      creditProtocol: "Blend",
      creditRiskBlocked: false,
    });

    expect(arkasSpotlights.map((item) => item.id)).toEqual([
      "arkas-recent",
      "arkas-registry",
      "arkas-direct",
    ]);
    expect(arkasSpotlights[2]).toMatchObject({
      state: "Ready to open",
      tone: "positive",
    });
    expect(executionSpotlights.map((item) => item.id)).toEqual([
      "arka-role",
      "arka-nav",
      "arka-shares",
      "arka-credit",
    ]);
    expect(executionSpotlights[0]).toMatchObject({
      value: "Manager",
      state: "Manager access",
    });

    const flowSpotlights = buildArkaFlowSpotlights({
      walletConnected: true,
      selectedAsset: "CARKAASSET",
      walletBalanceLabel: "10.0000000",
      shareLabel: "1.3000000",
    });
    expect(flowSpotlights.map((item) => item.id)).toEqual([
      "arka-flow-wallet",
      "arka-flow-asset",
      "arka-flow-shares",
    ]);
    expect(flowSpotlights[2]).toMatchObject({
      state: "Redeemable",
      tone: "positive",
    });

  });

  it("validates live Arka direct-open contract IDs and reports registry posture", () => {
    expect(
      normalizeArkaContractInput(
        " cdj7g22etj6prum5gdPuxyey3jl6mdy35wmjywsgx7u6dv5vmqekh3pg ",
      ),
    ).toBe("CDJ7G22ETJ6PRUM5GDPUXYEY3JL6MDY35WMJYWSGX7U6DV5VMQEKH3PG");
    expect(
      isValidArkaContractId(
        "CDJ7G22ETJ6PRUM5GDPUXYEY3JL6MDY35WMJYWSGX7U6DV5VMQEKH3PG",
      ),
    ).toBe(true);
    expect(isValidArkaContractId("not-a-contract")).toBe(false);
    expect(isValidArkaContractId("GDJ7G22ETJ6PRUM5GDPUXYEY3JL6MDY35WMJYWSGX7U6DV5VMQEKH3PG")).toBe(false);

    expect(deriveArkaDirectNavigationState("not-a-contract")).toMatchObject({
      normalizedId: "NOT-A-CONTRACT",
      hasInput: true,
      isValid: false,
      opsHref: null,
      profileHref: null,
      validationMessage: expect.stringContaining("Invalid Arka address"),
    });
    expect(
      deriveArkaDirectNavigationState(
        " cdj7g22etj6prum5gdPuxyey3jl6mdy35wmjywsgx7u6dv5vmqekh3pg ",
      ),
    ).toMatchObject({
      normalizedId: "CDJ7G22ETJ6PRUM5GDPUXYEY3JL6MDY35WMJYWSGX7U6DV5VMQEKH3PG",
      hasInput: true,
      isValid: true,
      opsHref: "/arkas/CDJ7G22ETJ6PRUM5GDPUXYEY3JL6MDY35WMJYWSGX7U6DV5VMQEKH3PG",
      profileHref: "/vaults/CDJ7G22ETJ6PRUM5GDPUXYEY3JL6MDY35WMJYWSGX7U6DV5VMQEKH3PG",
      validationMessage: expect.stringContaining("Valid Arka address"),
    });

    const failedRegistrySpotlights = buildArkasIndexSpotlights({
      recentCount: 0,
      registryCount: 0,
      registryState: "error",
      showAll: false,
      activeId: "not-a-contract",
    });

    expect(failedRegistrySpotlights[1]).toMatchObject({
      state: "Lookup failed",
      tone: "warning",
    });
    expect(failedRegistrySpotlights[2]).toMatchObject({
      state: "Invalid address",
      tone: "warning",
    });
  });

  it("derives a vault stage summary for live execution layouts", () => {
    const summary = deriveArkaStageSummary({
      trackedAssets: [
        { asset: "CTESTASSET111111", label: "XLM", liquidBalance: 40_000_000 },
        { asset: "CTESTASSET222222", label: "USDC", liquidBalance: 20_000_000 },
        { asset: "CTESTASSET333333", label: "AQUA", liquidBalance: 5_000_000 },
      ],
    });

    expect(summary.bars).toHaveLength(3);
    expect(summary.bars[0]).toMatchObject({
      label: "XLM",
      value: "4",
      widthPct: 100,
    });
    expect(summary.bars[1]).toMatchObject({ label: "USDC", value: "2" });
    expect(summary.bars[2]).toMatchObject({ label: "AQUA", value: "0.5" });
  });
});
