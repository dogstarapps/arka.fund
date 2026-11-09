// @vitest-environment node

import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, describe, expect, it } from "vitest";
import { deriveProductionEnvironmentGate, FRONTEND_SINGLE_SIGNER_RELEASE_EXCEPTION } from "@/lib/runtime/productionEnvironmentGate";
import type { ArkafundDeploymentsResolution } from "@/lib/runtime/protocolSupport";

const RELEASE_SCRIPTS = {
  "audit:prod": "node ./scripts/production_dependency_audit.mjs",
  "test:release-gate": "vitest run tests/unit/production-environment-gate.test.ts tests/integration/api-release-gate-route.test.ts",
  "release:gate": "npm run audit:prod && npm run test:release-gate && npm run build",
  "build:release": "npm run test:release-gate && npm run build",
};

describe("production environment gate", () => {
  let tempDir: string | null = null;

  afterEach(() => {
    if (tempDir) {
      rmSync(tempDir, { recursive: true, force: true });
      tempDir = null;
    }
  });

  function createManifestPath(): string {
    tempDir = mkdtempSync(join(tmpdir(), "arkafund-production-gate-"));
    const manifestPath = join(tempDir, "deployments.mainnet.json");
    writeFileSync(manifestPath, JSON.stringify({ network: "mainnet" }), "utf8");
    return manifestPath;
  }

  function deploymentResolution(
    networkTarget: "testnet" | "mainnet",
    deploymentsPath = createManifestPath(),
  ): ArkafundDeploymentsResolution {
    return {
      networkTarget,
      pathSource: networkTarget === "mainnet" ? "bundled_mainnet" : "bundled_testnet",
      deploymentsPath,
    };
  }

  it("keeps non-production testnet environments releasable when Vercel wiring is present", () => {
    const gate = deriveProductionEnvironmentGate({
      env: {
        VERCEL_ENV: "preview",
        ARKAFUND_NETWORK_TARGET: "testnet",
        VERCEL_URL: "arkafund-dapp-git-preview.vercel.app",
      },
      deploymentResolution: deploymentResolution("testnet"),
      packageScripts: RELEASE_SCRIPTS,
      vercelBuildCommand: "npm run release:gate",
    });

    expect(gate).toEqual(
      expect.objectContaining({
        ready: true,
        status: "not_required",
        code: "not_required",
        target: "production_environment",
      }),
    );
    expect(gate.checks).toEqual(
      expect.objectContaining({
        releaseScriptPresent: true,
        releaseTestScriptPresent: true,
        vercelBuildRunsReleaseGate: true,
        productionUsesMainnet: true,
      }),
    );
  });

  it("blocks preview deployments that point at mainnet without explicit rehearsal override", () => {
    const gate = deriveProductionEnvironmentGate({
      env: {
        VERCEL_ENV: "preview",
        ARKAFUND_NETWORK_TARGET: "mainnet",
        VERCEL_URL: "arkafund-dapp-git-preview.vercel.app",
      },
      deploymentResolution: deploymentResolution("mainnet"),
      packageScripts: RELEASE_SCRIPTS,
      vercelBuildCommand: "npm run release:gate",
    });

    expect(gate.ready).toBe(false);
    expect(gate.status).toBe("blocked");
    expect(gate.code).toBe("preview_mainnet_blocked");
    expect(gate.checks.previewMainnetBlocked).toBe(true);
    expect(gate.blockers.join(" ")).toMatch(/Preview deployments cannot point at mainnet/i);
  });

  it("allows a controlled preview mainnet rehearsal only with explicit override", () => {
    const gate = deriveProductionEnvironmentGate({
      env: {
        VERCEL_ENV: "preview",
        ARKAFUND_NETWORK_TARGET: "mainnet",
        ARKAFUND_ALLOW_PREVIEW_MAINNET: "1",
        VERCEL_URL: "arkafund-dapp-git-preview.vercel.app",
      },
      deploymentResolution: deploymentResolution("mainnet"),
      packageScripts: RELEASE_SCRIPTS,
      vercelBuildCommand: "npm run release:gate",
    });

    expect(gate.ready).toBe(true);
    expect(gate.status).toBe("not_required");
    expect(gate.code).toBe("not_required");
    expect(gate.evidence.previewMainnetOverride).toBe(true);
  });

  it("returns ready for production only when domain, mainnet, auth and release gates align", () => {
    const gate = deriveProductionEnvironmentGate({
      env: {
        VERCEL_ENV: "production",
        ARKAFUND_NETWORK_TARGET: "mainnet",
        VERCEL_PROJECT_PRODUCTION_URL: "app.arka.fund",
        OPERATOR_ACCESS_SECRET: "configured",
        ARKAFUND_ADMIN_MODE: "dao",
        NEXT_PUBLIC_GOVERNANCE_EXECUTOR_ID: "CEXECUTOR",
        ARKAFUND_GUARDIAN_MULTISIG_ID: "CGUARDIAN",
      },
      deploymentResolution: deploymentResolution("mainnet"),
      packageScripts: RELEASE_SCRIPTS,
      vercelBuildCommand: "npm run release:gate",
    });

    expect(gate.ready).toBe(true);
    expect(gate.status).toBe("ready");
    expect(gate.code).toBe("ready");
    expect(gate.environment.observedDomain).toBe("app.arka.fund");
    expect(gate.checks).toEqual(
      expect.objectContaining({
        domainConfigured: true,
        domainAllowed: true,
        productionUsesMainnet: true,
        e2eWalletDisabledInProduction: true,
        operatorSecretConfiguredInProduction: true,
        adminPolicyReadyInProduction: true,
        daoExecutorConfiguredInProduction: true,
        guardianMultisigConfigured: true,
        releaseScriptRunsGate: true,
        dependencyAuditScriptPresent: true,
      }),
    );
  });

  it("blocks production when admin mode is still a permanent EOA", () => {
    const gate = deriveProductionEnvironmentGate({
      env: {
        VERCEL_ENV: "production",
        ARKAFUND_NETWORK_TARGET: "mainnet",
        VERCEL_PROJECT_PRODUCTION_URL: "app.arka.fund",
        OPERATOR_ACCESS_SECRET: "configured",
        ARKAFUND_ADMIN_MODE: "permanent_eoa",
      },
      deploymentResolution: deploymentResolution("mainnet"),
      packageScripts: RELEASE_SCRIPTS,
      vercelBuildCommand: "npm run release:gate",
    });

    expect(gate.ready).toBe(false);
    expect(gate.code).toBe("admin_policy_blocked");
    expect(gate.checks.adminPolicyReadyInProduction).toBe(false);
    expect(gate.blockers.join(" ")).toMatch(/Permanent EOA admin mode is blocked/i);
  });

  it("blocks DAO production mode until the emergency guardian multisig is configured", () => {
    const gate = deriveProductionEnvironmentGate({
      env: {
        VERCEL_ENV: "production",
        ARKAFUND_NETWORK_TARGET: "mainnet",
        VERCEL_PROJECT_PRODUCTION_URL: "app.arka.fund",
        OPERATOR_ACCESS_SECRET: "configured",
        ARKAFUND_ADMIN_MODE: "dao",
        NEXT_PUBLIC_GOVERNANCE_EXECUTOR_ID: "CEXECUTOR",
      },
      deploymentResolution: deploymentResolution("mainnet"),
      packageScripts: RELEASE_SCRIPTS,
      vercelBuildCommand: "npm run release:gate",
    });

    expect(gate.ready).toBe(false);
    expect(gate.code).toBe("admin_policy_blocked");
    expect(gate.checks.daoExecutorConfiguredInProduction).toBe(true);
    expect(gate.checks.guardianMultisigConfigured).toBe(false);
  });

  it("blocks temporary EOA mode when the DAO executor is missing", () => {
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
    const gate = deriveProductionEnvironmentGate({
      env: {
        VERCEL_ENV: "production",
        ARKAFUND_NETWORK_TARGET: "mainnet",
        VERCEL_PROJECT_PRODUCTION_URL: "app.arka.fund",
        OPERATOR_ACCESS_SECRET: "configured",
        ARKAFUND_ADMIN_MODE: "temporary_eoa",
        ARKAFUND_TEMP_ADMIN_EXPIRES_AT: expiresAt,
        ARKAFUND_GUARDIAN_MULTISIG_ID: "CGUARDIAN",
      },
      deploymentResolution: deploymentResolution("mainnet"),
      packageScripts: RELEASE_SCRIPTS,
      vercelBuildCommand: "npm run release:gate",
    });

    expect(gate.ready).toBe(false);
    expect(gate.code).toBe("admin_policy_blocked");
    expect(gate.checks.daoExecutorConfiguredInProduction).toBe(false);
    expect(gate.checks.temporaryAdminWithinMaxDuration).toBe(true);
  });

  it("allows a temporary EOA only when expiry and guardian multisig are configured", () => {
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
    const gate = deriveProductionEnvironmentGate({
      env: {
        VERCEL_ENV: "production",
        ARKAFUND_NETWORK_TARGET: "mainnet",
        VERCEL_PROJECT_PRODUCTION_URL: "app.arka.fund",
        OPERATOR_ACCESS_SECRET: "configured",
        ARKAFUND_ADMIN_MODE: "temporary_eoa",
        NEXT_PUBLIC_GOVERNANCE_EXECUTOR_ID: "CEXECUTOR",
        ARKAFUND_TEMP_ADMIN_EXPIRES_AT: expiresAt,
        ARKAFUND_GUARDIAN_MULTISIG_ID: "CGUARDIAN",
      },
      deploymentResolution: deploymentResolution("mainnet"),
      packageScripts: RELEASE_SCRIPTS,
      vercelBuildCommand: "npm run release:gate",
    });

    expect(gate.ready).toBe(true);
    expect(gate.code).toBe("ready");
    expect(gate.checks.temporaryAdminHasExpiry).toBe(true);
    expect(gate.checks.temporaryAdminExpiryFuture).toBe(true);
    expect(gate.checks.temporaryAdminWithinMaxDuration).toBe(true);
    expect(gate.checks.daoExecutorConfiguredInProduction).toBe(true);
    expect(gate.checks.guardianMultisigConfigured).toBe(true);
    expect(gate.evidence.adminMode).toBe("temporary_eoa");
  });

  function approvedFrontendEnvironment(): Record<string, string> {
    return {
      VERCEL_ENV: "production",
      ARKAFUND_NETWORK_TARGET: "mainnet",
      VERCEL_PROJECT_PRODUCTION_URL: "app.arka.fund",
      OPERATOR_ACCESS_SECRET: "configured",
      ARKAFUND_ADMIN_MODE: "temporary_eoa",
      NEXT_PUBLIC_GOVERNANCE_EXECUTOR_ID: "CEXECUTOR",
      ARKAFUND_TEMP_ADMIN_EXPIRES_AT: new Date(Date.now() + 30 * 86_400_000).toISOString(),
      ARKAFUND_FRONTEND_SINGLE_SIGNER_EXCEPTION: FRONTEND_SINGLE_SIGNER_RELEASE_EXCEPTION,
    };
  }

  it("records the specific owner-approved frontend exception without pretending a multisig exists", () => {
    const gate = deriveProductionEnvironmentGate({
      env: approvedFrontendEnvironment(),
      deploymentResolution: deploymentResolution("mainnet"),
      packageScripts: RELEASE_SCRIPTS,
      vercelBuildCommand: "npm run release:gate",
    });
    expect(gate.ready).toBe(true);
    expect(gate.checks.guardianMultisigConfigured).toBe(false);
    expect(gate.evidence.guardianMultisigId).toBeNull();
    expect(gate.evidence.frontendSingleSignerException).toBe(FRONTEND_SINGLE_SIGNER_RELEASE_EXCEPTION);
    expect(gate.detail).toContain("No guardian multisig protection is claimed");
  });

  it.each([
    { name: "no exception", override: { ARKAFUND_FRONTEND_SINGLE_SIGNER_EXCEPTION: "" } },
    { name: "generic truthy flag", override: { ARKAFUND_FRONTEND_SINGLE_SIGNER_EXCEPTION: "1" } },
    { name: "DAO mode", override: { ARKAFUND_ADMIN_MODE: "dao" } },
    { name: "permanent EOA", override: { ARKAFUND_ADMIN_MODE: "permanent_eoa" } },
    { name: "expired admin", override: { ARKAFUND_TEMP_ADMIN_EXPIRES_AT: "2020-01-01T00:00:00Z" } },
    { name: "missing executor", override: { NEXT_PUBLIC_GOVERNANCE_EXECUTOR_ID: "" } },
    { name: "missing operator secret", override: { OPERATOR_ACCESS_SECRET: "" } },
    { name: "E2E enabled", override: { NEXT_PUBLIC_E2E_WALLET: "1" } },
    { name: "wrong production domain", override: { VERCEL_PROJECT_PRODUCTION_URL: "unrelated.example" } },
  ])("does not let the frontend exception bypass $name", ({ override }) => {
    const gate = deriveProductionEnvironmentGate({
      env: { ...approvedFrontendEnvironment(), ...override },
      deploymentResolution: deploymentResolution("mainnet"),
      packageScripts: RELEASE_SCRIPTS,
      vercelBuildCommand: "npm run release:gate",
    });
    expect(gate.ready).toBe(false);
    expect(gate.blockers.length).toBeGreaterThan(0);
  });

  it("blocks temporary EOA mode when the bootstrap window is too long", () => {
    const expiresAt = new Date(Date.now() + 400 * 24 * 60 * 60 * 1000).toISOString();
    const gate = deriveProductionEnvironmentGate({
      env: {
        VERCEL_ENV: "production",
        ARKAFUND_NETWORK_TARGET: "mainnet",
        VERCEL_PROJECT_PRODUCTION_URL: "app.arka.fund",
        OPERATOR_ACCESS_SECRET: "configured",
        ARKAFUND_ADMIN_MODE: "temporary_eoa",
        NEXT_PUBLIC_GOVERNANCE_EXECUTOR_ID: "CEXECUTOR",
        ARKAFUND_TEMP_ADMIN_EXPIRES_AT: expiresAt,
        ARKAFUND_GUARDIAN_MULTISIG_ID: "CGUARDIAN",
      },
      deploymentResolution: deploymentResolution("mainnet"),
      packageScripts: RELEASE_SCRIPTS,
      vercelBuildCommand: "npm run release:gate",
    });

    expect(gate.ready).toBe(false);
    expect(gate.code).toBe("admin_policy_blocked");
    expect(gate.checks.temporaryAdminWithinMaxDuration).toBe(false);
    expect(gate.blockers.join(" ")).toMatch(/within 365 days/i);
  });

  it("honors a stricter configured temporary admin max duration", () => {
    const expiresAt = new Date(Date.now() + 20 * 24 * 60 * 60 * 1000).toISOString();
    const gate = deriveProductionEnvironmentGate({
      env: {
        VERCEL_ENV: "production",
        ARKAFUND_NETWORK_TARGET: "mainnet",
        VERCEL_PROJECT_PRODUCTION_URL: "app.arka.fund",
        OPERATOR_ACCESS_SECRET: "configured",
        ARKAFUND_ADMIN_MODE: "temporary_eoa",
        NEXT_PUBLIC_GOVERNANCE_EXECUTOR_ID: "CEXECUTOR",
        ARKAFUND_TEMP_ADMIN_EXPIRES_AT: expiresAt,
        ARKAFUND_TEMP_ADMIN_MAX_DAYS: "14",
        ARKAFUND_GUARDIAN_MULTISIG_ID: "CGUARDIAN",
      },
      deploymentResolution: deploymentResolution("mainnet"),
      packageScripts: RELEASE_SCRIPTS,
      vercelBuildCommand: "npm run release:gate",
    });

    expect(gate.ready).toBe(false);
    expect(gate.code).toBe("admin_policy_blocked");
    expect(gate.checks.temporaryAdminWithinMaxDuration).toBe(false);
    expect(gate.evidence.temporaryAdminMaxDays).toBe(14);
  });

  it("blocks production when the network target still resolves to testnet", () => {
    const gate = deriveProductionEnvironmentGate({
      env: {
        VERCEL_ENV: "production",
        ARKAFUND_NETWORK_TARGET: "testnet",
        VERCEL_PROJECT_PRODUCTION_URL: "app.arka.fund",
        OPERATOR_ACCESS_SECRET: "configured",
      },
      deploymentResolution: deploymentResolution("testnet"),
      packageScripts: RELEASE_SCRIPTS,
      vercelBuildCommand: "npm run release:gate",
    });

    expect(gate.ready).toBe(false);
    expect(gate.status).toBe("blocked");
    expect(gate.code).toBe("production_network_mismatch");
    expect(gate.checks.productionUsesMainnet).toBe(false);
  });

  it("blocks production when domain is not canonical", () => {
    const gate = deriveProductionEnvironmentGate({
      env: {
        VERCEL_ENV: "production",
        ARKAFUND_NETWORK_TARGET: "mainnet",
        VERCEL_PROJECT_PRODUCTION_URL: "arkafund-dapp.vercel.app",
        OPERATOR_ACCESS_SECRET: "configured",
      },
      deploymentResolution: deploymentResolution("mainnet"),
      packageScripts: RELEASE_SCRIPTS,
      vercelBuildCommand: "npm run release:gate",
    });

    expect(gate.ready).toBe(false);
    expect(gate.code).toBe("production_domain_not_allowed");
    expect(gate.checks.domainAllowed).toBe(false);
  });

  it("blocks production when E2E wallet mode or operator secret are unsafe", () => {
    const gate = deriveProductionEnvironmentGate({
      env: {
        VERCEL_ENV: "production",
        ARKAFUND_NETWORK_TARGET: "mainnet",
        VERCEL_PROJECT_PRODUCTION_URL: "app.arka.fund",
        NEXT_PUBLIC_E2E_WALLET: "1",
      },
      deploymentResolution: deploymentResolution("mainnet"),
      packageScripts: RELEASE_SCRIPTS,
      vercelBuildCommand: "npm run release:gate",
    });

    expect(gate.ready).toBe(false);
    expect(gate.code).toBe("e2e_wallet_enabled");
    expect(gate.checks.e2eWalletDisabledInProduction).toBe(false);
    expect(gate.checks.operatorSecretConfiguredInProduction).toBe(false);
  });

  it("blocks when Vercel build is not wired to the release gate", () => {
    const gate = deriveProductionEnvironmentGate({
      env: {
        VERCEL_ENV: "preview",
        ARKAFUND_NETWORK_TARGET: "testnet",
        VERCEL_URL: "arkafund-dapp-git-preview.vercel.app",
      },
      deploymentResolution: deploymentResolution("testnet"),
      packageScripts: RELEASE_SCRIPTS,
      vercelBuildCommand: "npm run build",
    });

    expect(gate.ready).toBe(false);
    expect(gate.code).toBe("vercel_build_gate_missing");
    expect(gate.checks.vercelBuildRunsReleaseGate).toBe(false);
  });

  it("blocks when the production dependency audit policy is missing", () => {
    const gate = deriveProductionEnvironmentGate({
      env: {
        VERCEL_ENV: "preview",
        ARKAFUND_NETWORK_TARGET: "testnet",
        VERCEL_URL: "arkafund-dapp-git-preview.vercel.app",
        ARKAFUND_PRODUCTION_AUDIT_POLICY: "/tmp/missing-arkafund-audit-policy.json",
      },
      deploymentResolution: deploymentResolution("testnet"),
      packageScripts: RELEASE_SCRIPTS,
      vercelBuildCommand: "npm run release:gate",
    });

    expect(gate.ready).toBe(false);
    expect(gate.code).toBe("dependency_audit_gate_missing");
    expect(gate.checks.dependencyAuditScriptPresent).toBe(true);
    expect(gate.checks.dependencyAuditPolicyFound).toBe(false);
  });
});
