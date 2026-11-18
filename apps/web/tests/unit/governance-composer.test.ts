import { describe, expect, it } from "vitest";
import {
  buildGovernedActionPackage,
  buildGovernedComposerDraft,
  buildGovernedComposerDraftFromPackage,
  buildGovernanceComposerProductDecision,
  deriveGovernanceHandoffState,
  governedArgsToScVals,
  GOVERNED_ACTION_TEMPLATES,
  GOVERNANCE_COMPOSER_REQUIRED_BATCH_PRIMITIVE,
  GOVERNANCE_COMPOSER_STAGING_NOTE,
} from "@/lib/workflows/governanceComposer";
import { scValToNative } from "@/lib/soroban";

const VALID_ADDRESS =
  "CAZPR5MIUHXH46ZJ5OAMRZXD7PXIHMF5HHSSKQPDUBEXVID5SAGSZ3HW";

describe("governanceComposer", () => {
  it("derives fail-closed Contracts handoff state before a package exists", () => {
    expect(
      deriveGovernanceHandoffState({
        lane: "composer",
        packageReady: false,
      }),
    ).toEqual({
      enabled: false,
      href: null,
      label: "Build required",
      reason: "Build a governed package before opening the Contracts handoff.",
    });

    expect(
      deriveGovernanceHandoffState({
        lane: "publication",
        packageReady: false,
      }),
    ).toMatchObject({
      enabled: false,
      href: null,
      label: "Queue required",
    });
  });

  it("derives real Contracts handoff routes only for prepared packages", () => {
    expect(
      deriveGovernanceHandoffState({
        lane: "composer",
        packageReady: true,
      }),
    ).toEqual({
      enabled: true,
      href: "/contracts?draft=governed-action",
      label: "Composer handoff ready",
      reason: "Built package can be opened in Contracts for executor review.",
    });

    expect(
      deriveGovernanceHandoffState({
        lane: "publication",
        packageReady: true,
      }),
    ).toMatchObject({
      enabled: true,
      href: "/contracts?draft=governed-action",
      label: "Publication handoff ready",
    });
  });

  it("declares the final composer product model as curated-only and not arbitrary batch publication", () => {
    const decision = buildGovernanceComposerProductDecision();

    expect(decision.mode).toBe("curated-governed-packages");
    expect(decision.genericExecutableBatch.supported).toBe(false);
    expect(decision.genericExecutableBatch.requiredPrimitive).toBe(
      GOVERNANCE_COMPOSER_REQUIRED_BATCH_PRIMITIVE,
    );
    expect(decision.publicationLane).toMatchObject({
      mode: "staged-review-candidate",
      contractBacked: false,
      destination: "Contracts / executor review",
    });
    expect(decision.migrationRequests.representation).toBe(
      "operator-runbook-or-curated-contract-backed-proposal",
    );
    expect(decision.supportedTemplateCount).toBe(
      GOVERNED_ACTION_TEMPLATES.length,
    );
    expect(decision.supportedActionIds).toContain("arka-set-allowed-venues");
    expect(decision.supportedDomains).toContain("OracleGuard");
  });

  it("keeps every composer template curated, named and contract-targeted", () => {
    const ids = new Set<string>();
    const actionIds = new Set<string>();

    for (const template of GOVERNED_ACTION_TEMPLATES) {
      expect(template.id).not.toMatch(/arbitrary|generic|calldata/i);
      expect(template.actionId).not.toMatch(/arbitrary|generic|calldata/i);
      expect(template.title).toBeTruthy();
      if (template.contractDefault) {
        expect(template.contractDefault).toMatch(/^C/);
      }
      expect(template.method).toMatch(
        /^(set_|register|configure_|clear_|add_|remove_|pause_|resume_|upgrade$)/,
      );
      expect(ids.has(template.id)).toBe(false);
      expect(actionIds.has(template.actionId)).toBe(false);
      ids.add(template.id);
      actionIds.add(template.actionId);
    }
  });

  it("keeps percentage controls user-facing while preserving machine payloads", () => {
    const visibleCopy = GOVERNED_ACTION_TEMPLATES.flatMap((template) => [
      template.title,
      template.description,
      template.domain,
      ...template.fields.map((field) => field.label),
    ]).join(" ");

    expect(visibleCopy).not.toMatch(/\bbps\b|basis points?/i);
    expect(
      GOVERNED_ACTION_TEMPLATES.find((entry) => entry.id === "fees")?.fields,
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          key: "mgmt_bps",
          label: "Management fee (%)",
          defaultValue: "2.00",
        }),
      ]),
    );
  });

  it("builds a machine-consumable package for allowed venues", () => {
    const template = GOVERNED_ACTION_TEMPLATES.find(
      (entry) => entry.id === "allowed-venues",
    );

    expect(template).toBeDefined();

    const pkg = buildGovernedActionPackage({
      template: template!,
      contractId: VALID_ADDRESS,
      fieldValues: {
        caller: VALID_ADDRESS,
        allowed_routers: `${VALID_ADDRESS},${VALID_ADDRESS}`,
        allowed_adapters: `${VALID_ADDRESS},${VALID_ADDRESS}`,
      },
    });

    expect(pkg.kind).toBe("governed-action-package");
    expect(pkg.actionId).toBe("arka-set-allowed-venues");
    expect(pkg.method).toBe("set_allowed_venues");
    expect(pkg.contractId).toBe(VALID_ADDRESS);
    expect(pkg.args).toEqual([
      { type: "address", value: VALID_ADDRESS },
      {
        type: "vec",
        value: [
          { type: "address", value: VALID_ADDRESS },
          { type: "address", value: VALID_ADDRESS },
        ],
      },
      {
        type: "vec",
        value: [
          { type: "address", value: VALID_ADDRESS },
          { type: "address", value: VALID_ADDRESS },
        ],
      },
    ]);
    expect(pkg.governancePath.publicationMode).toBe("governance_lane_prep");
  });

  it("builds a machine-consumable package for vault fees", () => {
    const template = GOVERNED_ACTION_TEMPLATES.find((entry) => entry.id === "fees");

    expect(template).toBeDefined();

    const pkg = buildGovernedActionPackage({
      template: template!,
      contractId: VALID_ADDRESS,
      fieldValues: {
        caller: VALID_ADDRESS,
        mgmt_bps: "2.10",
        perf_bps: "11.00",
        deposit_bps: "0.05",
        redeem_bps: "0.07",
      },
    });

    expect(pkg.actionId).toBe("arka-set-fees");
    expect(pkg.args).toEqual([
      { type: "address", value: VALID_ADDRESS },
      { type: "i32", value: "210" },
      { type: "i32", value: "1100" },
      { type: "i32", value: "5" },
      { type: "i32", value: "7" },
    ]);
    expect(pkg.reviewBullets).toContain("Action: Vault fees");
    expect(pkg.governancePath.note).toBe(GOVERNANCE_COMPOSER_STAGING_NOTE);
  });

  it("builds a coverage policy package with i128 payload values", () => {
    const template = GOVERNED_ACTION_TEMPLATES.find(
      (entry) => entry.id === "coverage-covered-vault-policy",
    );

    expect(template).toBeDefined();

    const pkg = buildGovernedActionPackage({
      template: template!,
      contractId: VALID_ADDRESS,
      fieldValues: {
        caller: VALID_ADDRESS,
        vault: VALID_ADDRESS,
        annual_premium_bps: "3.50",
        coverage_limit: "25000000",
      },
    });

    expect(pkg.domain).toBe("CoverageFund");
    expect(pkg.actionId).toBe("coverage-fund-set-covered-vault-policy");
    expect(pkg.method).toBe("set_covered_vault_policy");
    expect(pkg.args).toEqual([
      { type: "address", value: VALID_ADDRESS },
      { type: "address", value: VALID_ADDRESS },
      { type: "i32", value: "350" },
      { type: "i128", value: "25000000" },
    ]);
    expect(pkg.reviewBullets).toContain("Domain: CoverageFund");
  });

  it("builds a factory creation-fee package with address + i128 payload values", () => {
    const template = GOVERNED_ACTION_TEMPLATES.find(
      (entry) => entry.id === "factory-creation-fee",
    );

    expect(template).toBeDefined();

    const pkg = buildGovernedActionPackage({
      template: template!,
      contractId: VALID_ADDRESS,
      fieldValues: {
        token: VALID_ADDRESS,
        amount: "15000000",
      },
    });

    expect(pkg.domain).toBe("ArkaFactory");
    expect(pkg.actionId).toBe("arka-factory-set-creation-fee");
    expect(pkg.method).toBe("set_creation_fee");
    expect(pkg.args).toEqual([
      { type: "address", value: VALID_ADDRESS },
      { type: "i128", value: "15000000" },
    ]);
  });

  it("builds an optional-address governance package that clears the treasury lane", () => {
    const template = GOVERNED_ACTION_TEMPLATES.find(
      (entry) => entry.id === "coverage-treasury",
    );

    expect(template).toBeDefined();

    const pkg = buildGovernedActionPackage({
      template: template!,
      contractId: VALID_ADDRESS,
      fieldValues: {
        caller: VALID_ADDRESS,
        treasury: "",
      },
    });

    expect(pkg.actionId).toBe("coverage-fund-set-treasury");
    expect(pkg.method).toBe("set_treasury");
    expect(pkg.args).toEqual([
      { type: "address", value: VALID_ADDRESS },
      { type: "void" },
    ]);
    expect(pkg.reviewBullets).toContain("Action: Coverage treasury");
  });

  it("builds a credit-market governance package with protocol enum payload", () => {
    const template = GOVERNED_ACTION_TEMPLATES.find(
      (entry) => entry.id === "credit-market-config",
    );

    expect(template).toBeDefined();

    const pkg = buildGovernedActionPackage({
      template: template!,
      contractId: VALID_ADDRESS,
      fieldValues: {
        caller: VALID_ADDRESS,
        protocol: "Blend",
        market_id: "7",
        adapter: VALID_ADDRESS,
        allow_supply: "true",
        allow_borrow: "false",
        allow_repay: "true",
        allow_withdraw: "false",
        enabled: "true",
      },
    });

    expect(pkg.actionId).toBe("arka-configure-credit-market");
    expect(pkg.method).toBe("configure_credit_market");
    expect(pkg.args[1]).toEqual({
      type: "vec",
      value: [{ type: "symbol", value: "Blend" }],
    });
    expect(pkg.args[2]).toEqual({ type: "u128", value: "7" });
  });

  it("builds a manager-tier thresholds package with i128 ladder payload values", () => {
    const template = GOVERNED_ACTION_TEMPLATES.find(
      (entry) => entry.id === "manager-tier-thresholds",
    );

    expect(template).toBeDefined();

    const pkg = buildGovernedActionPackage({
      template: template!,
      contractId: VALID_ADDRESS,
      fieldValues: {
        caller: VALID_ADDRESS,
        tier1_threshold: "100",
        tier2_threshold: "500",
        tier3_threshold: "1000",
      },
    });

    expect(pkg.domain).toBe("ManagerTier");
    expect(pkg.actionId).toBe("manager-tier-set-thresholds");
    expect(pkg.method).toBe("set_thresholds");
    expect(pkg.args).toEqual([
      { type: "address", value: VALID_ADDRESS },
      { type: "i128", value: "100" },
      { type: "i128", value: "500" },
      { type: "i128", value: "1000" },
    ]);
  });

  it("builds an executor governor package that clears the governor binding", () => {
    const template = GOVERNED_ACTION_TEMPLATES.find(
      (entry) => entry.id === "executor-governor",
    );

    expect(template).toBeDefined();

    const pkg = buildGovernedActionPackage({
      template: template!,
      contractId: VALID_ADDRESS,
      fieldValues: {
        caller: VALID_ADDRESS,
        governor: "",
      },
    });

    expect(pkg.domain).toBe("GovernanceExecutor");
    expect(pkg.actionId).toBe("executor-set-governor");
    expect(pkg.method).toBe("set_governor");
    expect(pkg.args).toEqual([
      { type: "address", value: VALID_ADDRESS },
      { type: "void" },
    ]);
  });

  it("rejects an empty target contract", () => {
    const template = GOVERNED_ACTION_TEMPLATES[0]!;

    expect(() =>
      buildGovernedActionPackage({
        template,
        contractId: "   ",
        fieldValues: { caller: VALID_ADDRESS },
      }),
    ).toThrow("Target contract: required");
  });

  it("rejects an empty CSV allowlist", () => {
    const template = GOVERNED_ACTION_TEMPLATES.find(
      (entry) => entry.id === "allowed-venues",
    );

    expect(template).toBeDefined();

    expect(() =>
      buildGovernedActionPackage({
        template: template!,
        contractId: VALID_ADDRESS,
        fieldValues: {
          caller: VALID_ADDRESS,
          allowed_routers: "   ",
          allowed_adapters: VALID_ADDRESS,
        },
      }),
    ).toThrow("Allowed routers (CSV): add at least one address");
  });

  it("builds a governed composer draft for factory implementation bytes32 values", () => {
    const template = GOVERNED_ACTION_TEMPLATES.find(
      (entry) => entry.id === "factory-implementation",
    );

    expect(template).toBeDefined();

    const draft = buildGovernedComposerDraft({
      template: template!,
      contractId: VALID_ADDRESS,
      fieldValues: {
        impl_wasm_hash: "ab".repeat(32),
      },
      origin: "migration-workspace",
    });

    expect(draft.kind).toBe("governed-composer-draft");
    expect(draft.templateId).toBe("factory-implementation");
    expect(draft.fieldValues.impl_wasm_hash).toBe("ab".repeat(32));
  });

  it("rebuilds a governed composer draft from a staged publication package", () => {
    const template = GOVERNED_ACTION_TEMPLATES.find(
      (entry) => entry.id === "coverage-treasury",
    );

    expect(template).toBeDefined();

    const pkg = buildGovernedActionPackage({
      template: template!,
      contractId: VALID_ADDRESS,
      fieldValues: {
        caller: VALID_ADDRESS,
        treasury: "",
      },
    });
    const draft = buildGovernedComposerDraftFromPackage(
      pkg,
      "governance-publication-lane",
    );

    expect(draft.templateId).toBe("coverage-treasury");
    expect(draft.contractId).toBe(VALID_ADDRESS);
    expect(draft.fieldValues.caller).toBe(VALID_ADDRESS);
    expect(draft.fieldValues.treasury).toBe("");
    expect(draft.origin).toBe("governance-publication-lane");
  });

  it("builds an oracle-guard stellar asset policy package", () => {
    const template = GOVERNED_ACTION_TEMPLATES.find(
      (entry) => entry.id === "oracle-guard-stellar-asset-policy",
    );

    expect(template).toBeDefined();

    const pkg = buildGovernedActionPackage({
      template: template!,
      contractId: VALID_ADDRESS,
      fieldValues: {
        caller: VALID_ADDRESS,
        asset: VALID_ADDRESS,
        primary: VALID_ADDRESS,
        secondary: VALID_ADDRESS,
        has_secondary: "true",
        max_price_age: "60",
        max_deviation_bps: "5.00",
        require_secondary: "false",
        divergence_mode: "1",
      },
    });

    expect(pkg.actionId).toBe("oracle-guard-set-stellar-asset-policy");
    expect(pkg.method).toBe("set_stellar_asset_policy");
    expect(pkg.args).toEqual([
      { type: "address", value: VALID_ADDRESS },
      { type: "address", value: VALID_ADDRESS },
      { type: "address", value: VALID_ADDRESS },
      { type: "address", value: VALID_ADDRESS },
      { type: "bool", value: true },
      { type: "u64", value: "60" },
      { type: "u32", value: "500" },
      { type: "bool", value: false },
      { type: "u32", value: "1" },
    ]);
  });

  it("builds oracle guardian and resume packages as DAO actions", () => {
    const guardianTemplate = GOVERNED_ACTION_TEMPLATES.find(
      (entry) => entry.id === "oracle-guard-guardian",
    );
    const resumeTemplate = GOVERNED_ACTION_TEMPLATES.find(
      (entry) => entry.id === "oracle-guard-resume-stellar-asset-policy",
    );

    expect(guardianTemplate).toBeDefined();
    expect(resumeTemplate).toBeDefined();

    const guardianPkg = buildGovernedActionPackage({
      template: guardianTemplate!,
      contractId: VALID_ADDRESS,
      fieldValues: {
        caller: VALID_ADDRESS,
        guardian: VALID_ADDRESS,
        expires_at: "1780000000",
      },
    });
    const resumePkg = buildGovernedActionPackage({
      template: resumeTemplate!,
      contractId: VALID_ADDRESS,
      fieldValues: {
        caller: VALID_ADDRESS,
        asset: VALID_ADDRESS,
      },
    });

    expect(guardianPkg.method).toBe("set_guardian");
    expect(guardianPkg.args).toEqual([
      { type: "address", value: VALID_ADDRESS },
      { type: "address", value: VALID_ADDRESS },
      { type: "u64", value: "1780000000" },
    ]);
    expect(resumePkg.method).toBe("resume_stellar_asset_policy");
    expect(resumePkg.governancePath.publicationMode).toBe("governance_lane_prep");
  });

  it("converts governed machine args into ScVals for simulation and tx assembly", () => {
    const scVals = governedArgsToScVals([
      { type: "address", value: VALID_ADDRESS },
      { type: "i128", value: "15" },
      { type: "void" },
      {
        type: "vec",
        value: [
          { type: "address", value: VALID_ADDRESS },
          { type: "bool", value: true },
        ],
      },
    ]);

    expect(scVals).toHaveLength(4);
    expect(scValToNative(scVals[0])).toBe(VALID_ADDRESS);
    expect(scValToNative(scVals[1])).toBe(15);
    expect(scVals[2]?.switch().name).toBe("scvVoid");
    expect(scValToNative(scVals[3])).toEqual([VALID_ADDRESS, true]);
  });
});
