#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import process from "node:process";

const ROOT = process.cwd();
const POLICY_PATH =
  process.env.ARKAFUND_PRODUCTION_AUDIT_POLICY ??
  path.join(ROOT, "config/production-audit-policy.json");
const SEVERITY_RANK = {
  info: 0,
  low: 1,
  moderate: 2,
  high: 3,
  critical: 4,
};

function readPolicy() {
  if (!existsSync(POLICY_PATH)) {
    throw new Error(`Production audit policy missing at ${POLICY_PATH}`);
  }
  const policy = JSON.parse(readFileSync(POLICY_PATH, "utf8"));
  if (!policy || !Array.isArray(policy.allowlist)) {
    throw new Error("Production audit policy must include an allowlist array.");
  }
  return policy;
}

function runNpmAuditJson() {
  try {
    return execFileSync(
      "npm",
      ["audit", "--omit=dev", "--json"],
      { cwd: ROOT, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] },
    );
  } catch (error) {
    if (error && typeof error === "object" && "stdout" in error) {
      const stdout = error.stdout;
      if (typeof stdout === "string" && stdout.trim()) return stdout;
      if (Buffer.isBuffer(stdout) && stdout.length > 0) return stdout.toString("utf8");
    }
    throw error;
  }
}

function severityAtLeast(value, minSeverity) {
  return (SEVERITY_RANK[value] ?? -1) >= (SEVERITY_RANK[minSeverity] ?? 3);
}

function allowlistKey(entry) {
  return `${entry.package ?? entry.name}:${entry.severity}`;
}

function validatePolicyEntry(entry, now) {
  if (!entry || typeof entry.package !== "string" || !entry.package.trim()) {
    return "allowlist entry missing package";
  }
  if (!severityAtLeast(entry.severity, "info")) {
    return `allowlist entry ${entry.package} has invalid severity`;
  }
  if (!entry.expiresAt || Number.isNaN(Date.parse(entry.expiresAt))) {
    return `allowlist entry ${entry.package} missing valid expiresAt`;
  }
  if (Date.parse(entry.expiresAt) < now.getTime()) {
    return `allowlist entry ${entry.package} expired at ${entry.expiresAt}`;
  }
  if (!entry.reason || String(entry.reason).trim().length < 40) {
    return `allowlist entry ${entry.package} missing detailed reason`;
  }
  if (!Array.isArray(entry.compensatingControls) || entry.compensatingControls.length === 0) {
    return `allowlist entry ${entry.package} missing compensating controls`;
  }
  return null;
}

function collectBlockingVulnerabilities(report, minSeverity) {
  return Object.entries(report.vulnerabilities ?? {})
    .map(([name, value]) => ({
      name,
      severity: value.severity,
      via: Array.isArray(value.via)
        ? value.via.map((item) =>
            typeof item === "string" ? item : item?.name ?? "unknown",
          )
        : [],
      fixAvailable: value.fixAvailable ?? null,
    }))
    .filter((item) => severityAtLeast(item.severity, minSeverity));
}

function main() {
  const now = new Date(process.env.ARKAFUND_AUDIT_NOW ?? Date.now());
  const policy = readPolicy();
  const minSeverity = policy.minBlockingSeverity ?? "high";
  const policyErrors = policy.allowlist
    .map((entry) => validatePolicyEntry(entry, now))
    .filter(Boolean);
  if (policyErrors.length > 0) {
    console.error("Production dependency audit policy is invalid:");
    for (const error of policyErrors) console.error(`- ${error}`);
    process.exit(1);
  }

  const allowlist = new Map(
    policy.allowlist.map((entry) => [allowlistKey(entry), entry]),
  );
  const report = JSON.parse(runNpmAuditJson());
  const blockingVulnerabilities = collectBlockingVulnerabilities(report, minSeverity);
  const unapproved = blockingVulnerabilities.filter(
    (item) => !allowlist.has(allowlistKey(item)),
  );

  const summary = {
    ok: unapproved.length === 0,
    minBlockingSeverity: minSeverity,
    rawVulnerabilityCounts: report.metadata?.vulnerabilities ?? null,
    blockingCount: blockingVulnerabilities.length,
    approvedBlockingCount: blockingVulnerabilities.length - unapproved.length,
    unapprovedBlockingCount: unapproved.length,
    approvedBlockingPackages: blockingVulnerabilities
      .filter((item) => allowlist.has(allowlistKey(item)))
      .map((item) => item.name)
      .sort(),
    unapprovedBlockingPackages: unapproved.map((item) => item.name).sort(),
  };

  console.log(JSON.stringify(summary, null, 2));

  if (unapproved.length > 0) {
    console.error("Production dependency audit failed with unapproved blockers:");
    for (const item of unapproved) {
      console.error(
        `- ${item.name} (${item.severity}) via ${item.via.join(", ") || "n/a"}`,
      );
    }
    process.exit(1);
  }
}

main();
