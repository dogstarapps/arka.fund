import { describe, expect, it, vi } from "vitest";
import {
  buildCreateReviewPreflight,
  buildCreateStepperRows,
  buildCreateWizardMandateVisual,
  buildCreateWizardEvidenceRail,
  buildCreateWizardVisualStages,
  deriveCreateStepReadiness,
  FIGMA_CREATE_WIZARD_FRAME_BINDINGS,
  FIGMA_CREATE_WIZARD_STEPS,
  formatCreationFeeDisplay,
  getCreateStepNavigation,
  getCreateWizardFrameBinding,
  getCreateWizardStageCopy,
  getCreateWizardStep,
  normalizeCreateSetupIntent,
  normalizeCreateWizardStep,
  normalizeCreateWizardUrlState,
  summarizeCreateWizardProgress,
  validateCreateFeeProfile,
  writeCreateWizardUrlState,
} from "@/lib/workflows/createWizardState";

describe("create wizard state", () => {
  it("normalizes Figma step labels and setup intent aliases", () => {
    expect(normalizeCreateWizardStep("Before your start")).toBe("start");
    expect(normalizeCreateWizardStep("assets management")).toBe("assets");
    expect(normalizeCreateWizardStep("deposits")).toBe("fees");
    expect(normalizeCreateWizardStep("redemptions")).toBe("fees");
    expect(normalizeCreateWizardStep("review")).toBe("review");
    expect(normalizeCreateWizardStep("unknown")).toBeNull();
    expect(normalizeCreateSetupIntent("blend")).toBe("BLEND");
    expect(normalizeCreateSetupIntent("auto")).toBe("REBALANCE");
    expect(normalizeCreateSetupIntent("unsupported", "BLEND")).toBe("BLEND");
  });

  it("reads and writes canonical URL state without dropping unrelated params", () => {
    const params = new URLSearchParams("denomination=BLND&step=assets-management&intent=blend");

    expect(normalizeCreateWizardUrlState(params)).toEqual({
      step: "assets",
      setupIntent: "BLEND",
    });

    const replaceSpy = vi.spyOn(window.history, "replaceState");
    window.history.replaceState({}, "", "/factory/create?denomination=BLND&asset=XTAR");

    writeCreateWizardUrlState({ step: "review", setupIntent: "BLEND" });

    expect(window.location.search).toContain("denomination=BLND");
    expect(window.location.search).toContain("asset=XTAR");
    expect(window.location.search).toContain("step=review");
    expect(window.location.search).toContain("intent=blend");
    expect(replaceSpy).toHaveBeenCalled();

    writeCreateWizardUrlState({ step: "basics", setupIntent: "REBALANCE" });

    expect(window.location.search).toContain("denomination=BLND");
    expect(window.location.search).not.toContain("step=");
    expect(window.location.search).not.toContain("intent=");
  });

  it("derives blocking reasons and stepper state from real readiness", () => {
    const blockedReadiness = deriveCreateStepReadiness({
      hasWallet: false,
      hasDenomination: false,
      whitelistCount: 0,
      hasRouter: false,
      feesValid: true,
      feeError: null,
      createdArkaId: null,
    });

    expect(blockedReadiness.start).toEqual({
      ready: false,
      reason: "Connect an authorized wallet before creation.",
    });
    expect(blockedReadiness.basics.reason).toMatch(/denomination/i);
    expect(blockedReadiness.assets.reason).toMatch(/router/i);
    expect(blockedReadiness.review.reason).toMatch(/wallet/i);

    const readyReadiness = deriveCreateStepReadiness({
      hasWallet: true,
      hasDenomination: true,
      whitelistCount: 2,
      hasRouter: true,
      feesValid: true,
      feeError: null,
      createdArkaId: null,
    });
    const rows = buildCreateStepperRows({
      activeStep: "assets",
      readiness: readyReadiness,
      createdArkaId: null,
    });

    expect(rows.map((row) => [row.id, row.state, row.ready])).toEqual([
      ["start", "done", true],
      ["basics", "done", true],
      ["fees", "done", true],
      ["assets", "current", true],
      ["review", "pending", true],
    ]);

    const afterCreate = buildCreateStepperRows({
      activeStep: "review",
      readiness: readyReadiness,
      createdArkaId: "CARKA",
    });
    expect(afterCreate.at(-1)).toMatchObject({ id: "review", state: "current", ready: true });
  });

  it("builds visual wizard metadata without inventing readiness", () => {
    const readiness = deriveCreateStepReadiness({
      hasWallet: true,
      hasDenomination: true,
      whitelistCount: 2,
      hasRouter: false,
      feesValid: true,
      feeError: null,
      createdArkaId: null,
    });
    const rows = buildCreateStepperRows({
      activeStep: "assets",
      readiness,
      createdArkaId: null,
    });

    const visualStages = buildCreateWizardVisualStages(rows);

    expect(visualStages).toHaveLength(5);
    expect(visualStages[0]).toMatchObject({
      id: "start",
      ordinal: 1,
      statusLabel: "Complete",
      connectorState: "complete",
    });
    expect(visualStages[3]).toMatchObject({
      id: "assets",
      ordinal: 4,
      statusLabel: "Complete this step",
      connectorState: "active",
    });
    expect(visualStages[3].ariaLabel).toContain(
      "Router and allowed asset universe must both be present.",
    );
    expect(visualStages[4]).toMatchObject({
      id: "review",
      statusLabel: "Pending",
      connectorState: "pending",
    });
  });

  it("keeps visible wizard copy free of internal fee units", () => {
    const visibleCopy = FIGMA_CREATE_WIZARD_STEPS
      .flatMap((step) => {
        const copy = getCreateWizardStageCopy(step.id);
        return [
          step.label,
          step.detail,
          copy.eyebrow,
          copy.title,
          copy.body,
          copy.primaryAction,
          copy.secondaryAction,
          ...copy.proofPoints,
        ];
      })
      .join(" ");

    expect(visibleCopy).not.toMatch(/\bbps\b|basis points?/i);
  });

  it("keeps Figma stage copy tied to the canonical wizard steps", () => {
    expect(getCreateWizardStageCopy("deposits")).toMatchObject({
      eyebrow: "Deposits",
      visualTone: "deposits",
      primaryAction: "Continue to redemptions",
    });
    expect(getCreateWizardStageCopy("assets").proofPoints).toEqual([
      "AUTO routing",
      "Blend",
      "Balanced/SODAX",
    ]);
    expect(getCreateWizardStageCopy("review").body).toMatch(/wallet-signed factory transaction/i);
  });

  it("binds every create wizard step to a documented Figma frame source and exported asset", () => {
    const bindings = Object.values(FIGMA_CREATE_WIZARD_FRAME_BINDINGS);

    expect(bindings.map((binding) => binding.stepId)).toEqual([
      "start",
      "basics",
      "fees",
      "deposits",
      "redemptions",
      "assets",
      "review",
    ]);
    expect(new Set(bindings.map((binding) => binding.frameFamily)).size).toBe(7);
    expect(bindings.every((binding) => binding.assetPath.startsWith("/figma/create/"))).toBe(
      true,
    );
    expect(
      bindings.filter((binding) => binding.source === "exported_figma_asset"),
    ).toEqual([
      expect.objectContaining({
        stepId: "deposits",
        assetPath: "/figma/create/deposits-wallet-permission.png",
      }),
    ]);
    expect(getCreateWizardFrameBinding("review")).toMatchObject({
      frameFamily: "create-review",
      assetVariant: "bottom",
      source: "documented_extension_frame",
    });
  });

  it("keeps fee errors in wizard readiness and progress summaries", () => {
    const readiness = deriveCreateStepReadiness({
      hasWallet: true,
      hasDenomination: true,
      whitelistCount: 2,
      hasRouter: true,
      feesValid: false,
      feeError: "Management fee cannot exceed 100%.",
      createdArkaId: null,
    });

    expect(readiness.fees).toEqual({
      ready: false,
      reason: "Management fee cannot exceed 100%.",
    });
    expect(readiness.review).toEqual({
      ready: false,
      reason: "Management fee cannot exceed 100%.",
    });

    const progress = summarizeCreateWizardProgress(readiness);
    expect(progress).toMatchObject({
      readyCount: 3,
      totalCount: 5,
      percent: 60,
      nextBlockingStep: expect.objectContaining({ id: "fees" }),
      nextBlockingReason: "Management fee cannot exceed 100%.",
      readyForSignature: false,
    });
  });

  it("builds a data-backed evidence rail for every Figma wizard step", () => {
    const readiness = deriveCreateStepReadiness({
      hasWallet: true,
      hasDenomination: true,
      whitelistCount: 3,
      hasRouter: true,
      feesValid: true,
      feeError: null,
      createdArkaId: null,
    });
    const rows = buildCreateStepperRows({
      activeStep: "review",
      readiness,
      createdArkaId: null,
    });

    const rail = buildCreateWizardEvidenceRail({
      rows,
      walletLabel: "GABC...WXYZ",
      denominationLabel: "USDC",
      whitelistCount: 3,
      setupIntent: "BLEND",
      routerLabel: "CROUTER...TEST",
      feeError: null,
      createdArkaId: null,
    });

    expect(rail).toHaveLength(5);
    expect(rail.map((item) => item.id)).toEqual([
      "start",
      "basics",
      "fees",
      "assets",
      "review",
    ]);
    expect(rail.find((item) => item.id === "basics")).toMatchObject({
      evidence: "USDC · 3 allowed",
      tone: "neutral",
      ready: true,
    });
    expect(rail.find((item) => item.id === "assets")?.evidence).toContain(
      "Blend credit",
    );
    expect(rail.find((item) => item.id === "review")).toMatchObject({
      statusLabel: "In review",
      actionLabel: "Current checkpoint",
      evidence: "Awaiting wallet signature",
    });
  });

  it("builds the Figma mandate visual deck from live create state instead of fixed display data", () => {
    const visual = buildCreateWizardMandateVisual({
      denominationLabel: "BLND",
      allowedAssetLabels: ["BLND", "XTAR", "USDC", "XTAR"],
      selectableAssetCount: 5,
      indexedAssetCount: 2,
      coreRegistryCount: 5,
      catalogState: "ready",
      setupIntent: "BLEND",
      walletLabel: "GABC...WXYZ",
      createdArkaId: null,
    });

    expect(visual).toMatchObject({
      title: "BLND mandate",
      sourceLabel: "2 available assets / 5 core assets",
      progressLabel: "3/5 asset universe",
      progressPercent: 60,
    });
    expect(visual.detail).toContain("3 allowed assets");
    expect(visual.detail).toContain("5 selectable assets");
    expect(visual.cards.map((card) => [card.id, card.value])).toEqual([
      ["base", "BLND"],
      ["universe", "3/5"],
      ["source", "Available"],
      ["execution", "Blend credit"],
      ["signer", "GABC...WXYZ"],
    ]);
    expect(visual.cards.find((card) => card.id === "universe")?.detail).toBe(
      "BLND, XTAR, USDC",
    );

    const fallback = buildCreateWizardMandateVisual({
      denominationLabel: "",
      allowedAssetLabels: [],
      selectableAssetCount: 0,
      indexedAssetCount: 0,
      coreRegistryCount: 2,
      catalogState: "error",
      setupIntent: "REBALANCE",
      walletLabel: "Offline",
      createdArkaId: "CARKA",
    });

    expect(fallback.title).toBe("Denomination pending mandate");
    expect(fallback.progressPercent).toBe(0);
    expect(fallback.cards.find((card) => card.id === "source")).toMatchObject({
      value: "Supported list",
      tone: "warning",
    });
    expect(fallback.cards.find((card) => card.id === "signer")).toMatchObject({
      value: "Offline",
      tone: "warning",
    });
  });

  it("surfaces final review preflight blockers without blocking queued result lanes", () => {
    const blocked = buildCreateReviewPreflight({
      hasWallet: false,
      hasFactory: true,
      hasRouter: true,
      hasDenomination: true,
      denominationLabel: "BLND",
      whitelistCount: 2,
      feesValid: false,
      feeError: "Management fee cannot exceed 100%.",
      feeToken: "",
      feeTokenLabel: "",
      feeAmount: 0,
      setupIntent: "REBALANCE",
      factoryLabel: "CFACT...TEST",
      routerLabel: "CROUT...TEST",
      createdArkaId: null,
    });

    expect(blocked.filter((item) => item.blocksSubmit && item.status === "blocked").map((item) => item.id)).toEqual([
      "wallet",
      "fees",
    ]);
    expect(blocked.find((item) => item.id === "result")).toMatchObject({
      status: "queued",
      blocksSubmit: false,
      value: "Awaiting signature",
    });

    const ready = buildCreateReviewPreflight({
      hasWallet: true,
      hasFactory: true,
      hasRouter: true,
      hasDenomination: true,
      denominationLabel: "XTAR",
      whitelistCount: 3,
      feesValid: true,
      feeError: null,
      feeToken: "CFEE",
      feeTokenLabel: "USDC",
      feeAmount: 100_000_000,
      setupIntent: "BLEND",
      factoryLabel: "CFACT...TEST",
      routerLabel: "CROUT...TEST",
      createdArkaId: "CARKA",
    });

    expect(ready.filter((item) => item.blocksSubmit && item.status === "blocked")).toEqual([]);
    expect(ready.find((item) => item.id === "creation-fee")).toMatchObject({
      status: "queued",
      value: "10.00 USDC",
    });
    expect(ready.find((item) => item.id === "creation-fee")?.detail).toContain(
      "XLM only covers network fees and account reserves.",
    );
    expect(ready.find((item) => item.id === "execution")).toMatchObject({
      status: "ready",
      value: "Blend credit",
    });
    expect(ready.find((item) => item.id === "result")).toMatchObject({
      status: "ready",
      value: "Created",
    });
  });

  it("formats creation fees in user-facing token units", () => {
    expect(formatCreationFeeDisplay(100_000_000, "USDC")).toBe("10.00 USDC");
    expect(formatCreationFeeDisplay(5_000_000, "USDC")).toBe("0.5 USDC");
    expect(formatCreationFeeDisplay(0, "USDC")).toBe("0 USDC");
  });

  it("resolves adjacent navigation and clamps unknown steps through the public helpers", () => {
    expect(getCreateWizardStep("start")).toMatchObject({ label: "Connect wallet" });
    expect(getCreateStepNavigation("start")).toMatchObject({
      previousStep: null,
      nextStep: expect.objectContaining({ id: "basics" }),
    });
    expect(getCreateStepNavigation("review")).toMatchObject({
      previousStep: expect.objectContaining({ id: "assets" }),
      nextStep: null,
    });
  });

  it("validates fee percentages before building a transaction", () => {
    expect(
      validateCreateFeeProfile({
        mgmt: "2.25",
        perf: "12",
        dep: "0,5",
        red: "",
      }),
    ).toMatchObject({
      valid: true,
      bps: {
        mgmt_bps: 225,
        perf_bps: 1200,
        deposit_bps: 50,
        redeem_bps: 0,
      },
      firstError: null,
    });

    const invalid = validateCreateFeeProfile({
      mgmt: "101",
      perf: "-1",
      dep: "abc",
      red: "0",
    });

    expect(invalid.valid).toBe(false);
    expect(invalid.firstError).toBe("Management fee cannot exceed 100%.");
    expect(invalid.fields.perf.error).toBe("Performance fee cannot be negative.");
    expect(invalid.fields.dep.error).toBe("Deposit fee must be a valid percentage.");
  });
});
