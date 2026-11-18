import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import {
  inferArkafundNetworkTarget,
  resolveArkafundDeployments,
  type ArkafundDeploymentsResolution,
} from "@/lib/runtime/protocolSupport";

// Owner-approved risk acceptance for this frontend release only. This is a
// deployment record, NOT wallet authorization or evidence of a multisig.
// Supply only to this deployment; never set as a project-wide default.
export const FRONTEND_SINGLE_SIGNER_RELEASE_EXCEPTION = "2026-10-15-ui-owner-approved";

export type ProductionEnvironmentGateStatus = "ready" | "blocked" | "not_required";

export type ProductionEnvironmentGateCode =
  | "ready"
  | "not_required"
  | "production_environment_blocked"
  | "production_network_mismatch"
  | "production_domain_missing"
  | "production_domain_not_allowed"
  | "preview_mainnet_blocked"
  | "e2e_wallet_enabled"
  | "operator_secret_missing"
  | "admin_policy_blocked"
  | "release_script_missing"
  | "dependency_audit_gate_missing"
  | "vercel_build_gate_missing"
  | "deployment_manifest_missing";

export interface ProductionEnvironmentGateSnapshot {
  ready: boolean;
  status: ProductionEnvironmentGateStatus;
  code: ProductionEnvironmentGateCode;
  target: "production_environment";
  detail: string;
  environment: {
    vercelEnv: "production" | "preview" | "development" | "unknown";
    isProductionDeployment: boolean;
    isPreviewDeployment: boolean;
    networkTarget: "testnet" | "mainnet";
    deploymentNetworkTarget: "testnet" | "mainnet";
    deploymentPathSource: string;
    observedDomain: string | null;
    allowedProductionDomains: string[];
  };
  checks: {
    domainConfigured: boolean;
    domainAllowed: boolean;
    productionUsesMainnet: boolean;
    previewMainnetBlocked: boolean;
    e2eWalletDisabledInProduction: boolean;
    operatorSecretConfiguredInProduction: boolean;
    daoExecutorConfiguredInProduction: boolean;
    temporaryAdminHasExpiry: boolean;
    temporaryAdminExpiryFuture: boolean;
    temporaryAdminWithinMaxDuration: boolean;
    guardianMultisigConfigured: boolean;
    adminPolicyReadyInProduction: boolean;
    releaseScriptPresent: boolean;
    releaseScriptRunsGate: boolean;
    releaseTestScriptPresent: boolean;
    vercelBuildCommandPresent: boolean;
    vercelBuildRunsReleaseGate: boolean;
    deploymentManifestFound: boolean;
    dependencyAuditScriptPresent: boolean;
    dependencyAuditPolicyFound: boolean;
  };
  evidence: {
    buildCommand: string | null;
    releaseCommand: string | null;
    releaseTestCommand: string | null;
    dependencyAuditCommand: string | null;
    dependencyAuditPolicyPath: string;
    deploymentsPath: string;
    requiredProductionNetwork: "mainnet";
    previewMainnetOverride: boolean;
    adminMode: "dao" | "temporary_eoa" | "permanent_eoa" | "unknown";
    daoExecutorId: string | null;
    temporaryAdminExpiresAt: string | null;
    temporaryAdminMaxDays: number;
    guardianMultisigId: string | null;
    frontendSingleSignerException: string | null;
  };
  blockers: string[];
}

export interface ProductionEnvironmentGateInput {
  env?: Record<string, string | undefined>;
  cwd?: string;
  deploymentResolution?: ArkafundDeploymentsResolution;
  packageScripts?: Record<string, string> | null;
  vercelBuildCommand?: string | null;
}

const DEFAULT_ALLOWED_PRODUCTION_DOMAINS = [
  "arka.fund",
  "www.arka.fund",
  "app.arka.fund",
];

function normalizeVercelEnv(
  raw: string | undefined,
): ProductionEnvironmentGateSnapshot["environment"]["vercelEnv"] {
  const normalized = (raw ?? "").trim().toLowerCase();
  if (normalized === "production") return "production";
  if (normalized === "preview") return "preview";
  if (normalized === "development") return "development";
  return "unknown";
}

function isTruthyEnv(value: string | undefined): boolean {
  return ["1", "true", "yes", "on"].includes((value ?? "").trim().toLowerCase());
}

function normalizeAdminMode(
  value: string | undefined,
): ProductionEnvironmentGateSnapshot["evidence"]["adminMode"] {
  const normalized = (value ?? "").trim().toLowerCase();
  if (normalized === "dao") return "dao";
  if (normalized === "temporary_eoa" || normalized === "temporary-eoa") {
    return "temporary_eoa";
  }
  if (normalized === "permanent_eoa" || normalized === "permanent-eoa") {
    return "permanent_eoa";
  }
  return "unknown";
}

function isFutureIsoDate(value: string | null, nowMs = Date.now()): boolean {
  if (!value) return false;
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) && timestamp > nowMs;
}

function parsePositiveInteger(value: string | undefined, fallback: number): number {
  const parsed = Number.parseInt((value ?? "").trim(), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function isWithinMaxFutureDuration(
  value: string | null,
  maxDays: number,
  nowMs = Date.now(),
): boolean {
  if (!value) return false;
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp) || timestamp <= nowMs) return false;
  const maxMs = maxDays * 24 * 60 * 60 * 1000;
  return timestamp - nowMs <= maxMs;
}

function normalizeHost(value: string | undefined): string | null {
  const raw = (value ?? "").trim();
  if (!raw) return null;
  try {
    const url = raw.includes("://") ? new URL(raw) : new URL(`https://${raw}`);
    return url.hostname.toLowerCase();
  } catch {
    const host = raw.split("/")[0]?.trim().toLowerCase();
    return host || null;
  }
}

function resolveObservedDomain(env: Record<string, string | undefined>): string | null {
  return (
    normalizeHost(env.NEXT_PUBLIC_APP_URL) ??
    normalizeHost(env.NEXT_PUBLIC_SITE_URL) ??
    normalizeHost(env.VERCEL_PROJECT_PRODUCTION_URL) ??
    normalizeHost(env.VERCEL_URL)
  );
}

function resolveAllowedProductionDomains(
  env: Record<string, string | undefined>,
): string[] {
  const configured = (env.ARKAFUND_PRODUCTION_DOMAINS ?? "")
    .split(",")
    .map((domain) => normalizeHost(domain))
    .filter((domain): domain is string => Boolean(domain));
  return Array.from(
    new Set(configured.length > 0 ? configured : DEFAULT_ALLOWED_PRODUCTION_DOMAINS),
  );
}

function readPackageScripts(cwd: string): Record<string, string> | null {
  try {
    const packageJson = JSON.parse(
      readFileSync(path.join(cwd, "package.json"), "utf8"),
    ) as { scripts?: unknown };
    if (!packageJson.scripts || typeof packageJson.scripts !== "object") {
      return null;
    }
    return Object.fromEntries(
      Object.entries(packageJson.scripts as Record<string, unknown>).filter(
        (entry): entry is [string, string] => typeof entry[1] === "string",
      ),
    );
  } catch {
    return null;
  }
}

function readVercelBuildCommand(cwd: string): string | null {
  const vercelPath = path.join(cwd, "vercel.json");
  if (!existsSync(vercelPath)) return null;
  try {
    const payload = JSON.parse(readFileSync(vercelPath, "utf8")) as {
      buildCommand?: unknown;
    };
    return typeof payload.buildCommand === "string" ? payload.buildCommand : null;
  } catch {
    return null;
  }
}

function commandRunsReleaseGate(command: string | null | undefined): boolean {
  const normalized = (command ?? "").toLowerCase();
  return (
    normalized.includes("release:gate") ||
    normalized.includes("build:release") ||
    normalized.includes("test:release-gate")
  );
}

function commandRunsDependencyAudit(command: string | null | undefined): boolean {
  const normalized = (command ?? "").toLowerCase();
  return (
    normalized.includes("npm audit") ||
    normalized.includes("pnpm audit") ||
    normalized.includes("production_dependency_audit")
  );
}

function firstBlockingCode(
  checks: ProductionEnvironmentGateSnapshot["checks"],
): ProductionEnvironmentGateCode {
  if (checks.previewMainnetBlocked) return "preview_mainnet_blocked";
  if (!checks.productionUsesMainnet) return "production_network_mismatch";
  if (!checks.domainConfigured) return "production_domain_missing";
  if (!checks.domainAllowed) return "production_domain_not_allowed";
  if (!checks.e2eWalletDisabledInProduction) return "e2e_wallet_enabled";
  if (!checks.operatorSecretConfiguredInProduction) return "operator_secret_missing";
  if (!checks.adminPolicyReadyInProduction) return "admin_policy_blocked";
  if (!checks.releaseScriptPresent || !checks.releaseTestScriptPresent) {
    return "release_script_missing";
  }
  if (!checks.releaseScriptRunsGate || !checks.vercelBuildRunsReleaseGate) {
    return "vercel_build_gate_missing";
  }
  if (!checks.dependencyAuditScriptPresent || !checks.dependencyAuditPolicyFound) {
    return "dependency_audit_gate_missing";
  }
  if (!checks.deploymentManifestFound) return "deployment_manifest_missing";
  return "production_environment_blocked";
}

export function deriveProductionEnvironmentGate(
  input: ProductionEnvironmentGateInput = {},
): ProductionEnvironmentGateSnapshot {
  const env = input.env ?? process.env;
  const cwd = input.cwd ?? process.cwd();
  const vercelEnv = normalizeVercelEnv(env.VERCEL_ENV);
  const releaseEnv = (env.ARKAFUND_RELEASE_ENV ?? "").trim().toLowerCase();
  const isProductionDeployment =
    vercelEnv === "production" || releaseEnv === "production";
  const isPreviewDeployment = vercelEnv === "preview";
  const networkTarget = inferArkafundNetworkTarget(env as NodeJS.ProcessEnv);
  const deploymentResolution =
    input.deploymentResolution ?? resolveArkafundDeployments(env as NodeJS.ProcessEnv);
  const packageScripts = input.packageScripts ?? readPackageScripts(cwd) ?? {};
  const releaseCommand = packageScripts["release:gate"] ?? null;
  const releaseTestCommand = packageScripts["test:release-gate"] ?? null;
  const dependencyAuditCommand = packageScripts["audit:prod"] ?? null;
  const dependencyAuditPolicyPath = path.resolve(
    cwd,
    env.ARKAFUND_PRODUCTION_AUDIT_POLICY ??
      "config/production-audit-policy.json",
  );
  const vercelBuildCommand =
    input.vercelBuildCommand === undefined
      ? readVercelBuildCommand(cwd)
      : input.vercelBuildCommand;
  const observedDomain = resolveObservedDomain(env);
  const allowedProductionDomains = resolveAllowedProductionDomains(env);
  const previewMainnetOverride = isTruthyEnv(env.ARKAFUND_ALLOW_PREVIEW_MAINNET);
  const e2eWalletEnabled =
    isTruthyEnv(env.NEXT_PUBLIC_E2E_WALLET) || isTruthyEnv(env.E2E_WALLET_ENABLED);
  const adminMode = normalizeAdminMode(env.ARKAFUND_ADMIN_MODE);
  const daoExecutorId =
    (env.NEXT_PUBLIC_GOVERNANCE_EXECUTOR_ID ?? env.GOVERNANCE_EXECUTOR_ID ?? "")
      .trim() || null;
  const temporaryAdminExpiresAt =
    (env.ARKAFUND_TEMP_ADMIN_EXPIRES_AT ?? "").trim() || null;
  const temporaryAdminMaxDays = parsePositiveInteger(
    env.ARKAFUND_TEMP_ADMIN_MAX_DAYS,
    365,
  );
  const guardianMultisigId =
    (env.ARKAFUND_GUARDIAN_MULTISIG_ID ??
      env.NEXT_PUBLIC_GUARDIAN_MULTISIG_ID ??
      "")
      .trim() || null;
  const temporaryAdminExpiryFuture = isFutureIsoDate(temporaryAdminExpiresAt);
  const temporaryAdminWithinMaxDuration = isWithinMaxFutureDuration(
    temporaryAdminExpiresAt,
    temporaryAdminMaxDays,
  );
  const daoExecutorConfigured = Boolean(daoExecutorId);
  const guardianMultisigConfigured = Boolean(guardianMultisigId);
  const frontendSingleSignerException =
    isProductionDeployment &&
    adminMode === "temporary_eoa" &&
    !guardianMultisigConfigured &&
    env.ARKAFUND_FRONTEND_SINGLE_SIGNER_EXCEPTION === FRONTEND_SINGLE_SIGNER_RELEASE_EXCEPTION
      ? FRONTEND_SINGLE_SIGNER_RELEASE_EXCEPTION
      : null;
  const adminPolicyReady =
    !isProductionDeployment ||
    (adminMode === "dao" && daoExecutorConfigured && guardianMultisigConfigured) ||
    (adminMode === "temporary_eoa" &&
      daoExecutorConfigured &&
      Boolean(temporaryAdminExpiresAt) &&
      temporaryAdminExpiryFuture &&
      temporaryAdminWithinMaxDuration &&
      (guardianMultisigConfigured || Boolean(frontendSingleSignerException)));

  const checks: ProductionEnvironmentGateSnapshot["checks"] = {
    domainConfigured: !isProductionDeployment || Boolean(observedDomain),
    domainAllowed:
      !isProductionDeployment ||
      Boolean(observedDomain && allowedProductionDomains.includes(observedDomain)),
    productionUsesMainnet:
      !isProductionDeployment ||
      (networkTarget === "mainnet" &&
        deploymentResolution.networkTarget === "mainnet" &&
        deploymentResolution.pathSource !== "bundled_testnet"),
    previewMainnetBlocked:
      isPreviewDeployment &&
      deploymentResolution.networkTarget === "mainnet" &&
      !previewMainnetOverride,
    e2eWalletDisabledInProduction: !isProductionDeployment || !e2eWalletEnabled,
    operatorSecretConfiguredInProduction:
      !isProductionDeployment || Boolean((env.OPERATOR_ACCESS_SECRET ?? "").trim()),
    daoExecutorConfiguredInProduction:
      !isProductionDeployment || daoExecutorConfigured,
    temporaryAdminHasExpiry:
      !isProductionDeployment || Boolean(temporaryAdminExpiresAt),
    temporaryAdminExpiryFuture:
      !isProductionDeployment || temporaryAdminExpiryFuture,
    temporaryAdminWithinMaxDuration:
      !isProductionDeployment || temporaryAdminWithinMaxDuration,
    guardianMultisigConfigured:
      !isProductionDeployment || guardianMultisigConfigured,
    adminPolicyReadyInProduction: adminPolicyReady,
    releaseScriptPresent: Boolean(releaseCommand),
    releaseScriptRunsGate: commandRunsReleaseGate(releaseCommand),
    releaseTestScriptPresent: Boolean(releaseTestCommand),
    vercelBuildCommandPresent: Boolean(vercelBuildCommand),
    vercelBuildRunsReleaseGate: commandRunsReleaseGate(vercelBuildCommand),
    deploymentManifestFound:
      !isProductionDeployment || existsSync(deploymentResolution.deploymentsPath),
    dependencyAuditScriptPresent: commandRunsDependencyAudit(dependencyAuditCommand),
    dependencyAuditPolicyFound: existsSync(dependencyAuditPolicyPath),
  };

  const blockers: string[] = [];
  if (checks.previewMainnetBlocked) {
    blockers.push(
      "Preview deployments cannot point at mainnet unless ARKAFUND_ALLOW_PREVIEW_MAINNET=1 is explicitly set for a controlled rehearsal.",
    );
  }
  if (isProductionDeployment && !checks.productionUsesMainnet) {
    blockers.push(
      "Production deployment must resolve mainnet network target and mainnet deployments manifest.",
    );
  }
  if (isProductionDeployment && !checks.domainConfigured) {
    blockers.push("Production deployment must expose a canonical application domain.");
  }
  if (isProductionDeployment && !checks.domainAllowed) {
    blockers.push(
      `Production domain ${observedDomain ?? "unknown"} is not in ARKAFUND_PRODUCTION_DOMAINS.`,
    );
  }
  if (isProductionDeployment && !checks.e2eWalletDisabledInProduction) {
    blockers.push("E2E wallet mode must be disabled in production.");
  }
  if (isProductionDeployment && !checks.operatorSecretConfiguredInProduction) {
    blockers.push("OPERATOR_ACCESS_SECRET must be configured before production release.");
  }
  if (isProductionDeployment && !checks.adminPolicyReadyInProduction) {
    blockers.push(
      adminMode === "permanent_eoa"
        ? "Permanent EOA admin mode is blocked for production; use DAO executor or a guardian-limited temporary EOA with an expiry."
        : adminMode === "temporary_eoa"
          ? `Temporary EOA admin mode requires a governance executor, ARKAFUND_TEMP_ADMIN_EXPIRES_AT in the future within ${temporaryAdminMaxDays} days, and ARKAFUND_GUARDIAN_MULTISIG_ID.`
          : "Production admin policy must declare ARKAFUND_ADMIN_MODE=dao with governance executor and guardian multisig, or ARKAFUND_ADMIN_MODE=temporary_eoa with DAO executor, bounded expiry and guardian multisig.",
    );
  }
  if (!checks.releaseScriptPresent || !checks.releaseTestScriptPresent) {
    blockers.push("Release scripts must include release:gate and test:release-gate.");
  }
  if (!checks.releaseScriptRunsGate || !checks.vercelBuildRunsReleaseGate) {
    blockers.push("Vercel build command must execute the release gate before next build.");
  }
  if (!checks.dependencyAuditScriptPresent || !checks.dependencyAuditPolicyFound) {
    blockers.push(
      "Production dependency audit script and policy must be present before release.",
    );
  }
  if (isProductionDeployment && !checks.deploymentManifestFound) {
    blockers.push(`Deployments manifest is missing at ${deploymentResolution.deploymentsPath}.`);
  }

  const ready = blockers.length === 0;
  const status: ProductionEnvironmentGateStatus = ready
    ? isProductionDeployment
      ? "ready"
      : "not_required"
    : "blocked";
  const code: ProductionEnvironmentGateCode = ready
    ? isProductionDeployment
      ? "ready"
      : "not_required"
    : firstBlockingCode(checks);

  return {
    ready,
    status,
    code,
    target: "production_environment",
    detail: ready
      ? isProductionDeployment
        ? frontendSingleSignerException
          ? "Frontend-only release with explicit owner-approved single-signer exception. No guardian multisig protection is claimed. Mainnet, canonical domain, operator auth, bounded admin expiry and release build checks remain required."
          : "Production environment is locked to mainnet, canonical domain, operator auth and release-gated Vercel builds."
        : "This is not a production deployment; production-only checks are not required, but build gate wiring is present."
      : blockers.join(" "),
    environment: {
      vercelEnv,
      isProductionDeployment,
      isPreviewDeployment,
      networkTarget,
      deploymentNetworkTarget: deploymentResolution.networkTarget,
      deploymentPathSource: deploymentResolution.pathSource,
      observedDomain,
      allowedProductionDomains,
    },
    checks,
    evidence: {
      buildCommand: vercelBuildCommand,
      releaseCommand,
      releaseTestCommand,
      dependencyAuditCommand,
      dependencyAuditPolicyPath,
      deploymentsPath: deploymentResolution.deploymentsPath,
      requiredProductionNetwork: "mainnet",
      previewMainnetOverride,
      adminMode,
      daoExecutorId,
      temporaryAdminExpiresAt,
      temporaryAdminMaxDays,
      guardianMultisigId,
      frontendSingleSignerException,
    },
    blockers,
  };
}

export function readProductionEnvironmentGate(): ProductionEnvironmentGateSnapshot {
  return deriveProductionEnvironmentGate();
}
