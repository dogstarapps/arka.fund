import { describe, expect, it } from "vitest";
import { buildContractsSecurityAuditSnapshot } from "@/lib/contracts/securityAudit";

describe("contracts security audit closeout", () => {
  it("closes every finding as resolved or accepted and leaves no critical/high blocker", () => {
    const snapshot = buildContractsSecurityAuditSnapshot();

    expect(snapshot.auditDate).toBe("2026-05-20");
    expect(snapshot.artifact).toBe("docs/CONTRACTS_SECURITY_AUDIT.md");
    expect(snapshot.summary.findingCount).toBeGreaterThanOrEqual(10);
    expect(snapshot.summary.blocking).toBe(0);
    expect(snapshot.summary.criticalHighBlocking).toBe(0);
    expect(snapshot.releaseGate.ready).toBe(true);
    expect(snapshot.releaseGate.status).toBe("ready");
    expect(snapshot.releaseGate.checks.undocumentedCriticalHighRemaining).toBe(0);

    for (const finding of snapshot.findings) {
      expect(["resolved", "accepted_risk"]).toContain(finding.status);
      expect(finding.title).toMatch(/\S/);
      expect(finding.risk).toMatch(/\S/);
      expect(finding.resolution).toMatch(/\S/);
      expect(finding.residualRisk).toMatch(/\S/);
      expect(finding.implementationRefs.length).toBeGreaterThanOrEqual(2);
      expect(finding.testRefs.length).toBeGreaterThanOrEqual(2);
    }
  });

  it("proves all release invariants with implementation and test references", () => {
    const snapshot = buildContractsSecurityAuditSnapshot();

    expect(snapshot.summary.invariantCount).toBeGreaterThanOrEqual(10);
    expect(snapshot.summary.failedInvariants).toBe(0);
    expect(snapshot.summary.passedInvariants).toBe(snapshot.summary.invariantCount);

    const invariantIds = new Set(snapshot.invariants.map((invariant) => invariant.id));
    expect([...invariantIds]).toEqual(
      expect.arrayContaining([
        "INV-AC-001",
        "INV-AC-002",
        "INV-MUT-001",
        "INV-STO-001",
        "INV-ARI-001",
        "INV-ORC-001",
        "INV-RTE-001",
        "INV-PAU-001",
        "INV-PAU-002",
        "INV-AUTH-001",
      ]),
    );

    for (const invariant of snapshot.invariants) {
      expect(invariant.status).toBe("passed");
      expect(invariant.statement).toMatch(/\S/);
      expect(invariant.evidence).toMatch(/\S/);
      expect(invariant.implementationRefs.length).toBeGreaterThanOrEqual(1);
      expect(invariant.testRefs.length).toBeGreaterThanOrEqual(1);
    }
  });

  it("summarizes every audited security domain", () => {
    const snapshot = buildContractsSecurityAuditSnapshot();
    const domains = Object.keys(snapshot.summary.byDomain);

    expect(domains).toEqual(
      expect.arrayContaining([
        "access_control",
        "operator_auth",
        "storage_ttl",
        "arithmetic",
        "oracle_assumptions",
        "route_guards",
        "emergency_pause",
        "coverage_controls",
        "dao_governance",
      ]),
    );

    for (const [domain, summary] of Object.entries(snapshot.summary.byDomain)) {
      expect(domain).toMatch(/\S/);
      expect(summary.blocking).toBe(0);
      expect(summary.failedInvariants).toBe(0);
      expect(summary.total + summary.passedInvariants).toBeGreaterThan(0);
    }
  });
});
