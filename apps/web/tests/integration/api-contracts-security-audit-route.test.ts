// @vitest-environment node

import { afterEach, describe, expect, it, vi } from "vitest";
import {
  OPERATOR_TEST_PUBLIC_KEY,
  OPERATOR_TEST_SECRET,
  operatorRequest,
} from "../helpers/operator-auth";

describe("GET /api/contracts/security-audit", () => {
  afterEach(() => {
    vi.resetModules();
    vi.unstubAllEnvs();
  });

  function configureOperatorAccess() {
    vi.stubEnv("OPERATOR_ACCESS_SECRET", OPERATOR_TEST_SECRET);
    vi.stubEnv("NEXT_PUBLIC_ARKA_MANAGER", OPERATOR_TEST_PUBLIC_KEY);
  }

  it("requires a verified operator session", async () => {
    const { GET } = await import("@/app/api/contracts/security-audit/route");

    const response = await GET(
      new Request("http://localhost/api/contracts/security-audit"),
    );
    const payload = await response.json();

    expect(response.status).toBe(401);
    expect(payload.error).toBe("operator_access_required");
    expect(response.headers.get("cache-control")).toBe("no-store");
  });

  it("returns release-grade security closeout evidence", async () => {
    configureOperatorAccess();
    const { GET } = await import("@/app/api/contracts/security-audit/route");

    const response = await GET(
      operatorRequest("http://localhost/api/contracts/security-audit"),
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(payload.ok).toBe(true);
    expect(payload.source).toBe("api_contracts_security_audit");
    expect(payload.auditDate).toBe("2026-05-20");
    expect(payload.artifact).toBe("docs/CONTRACTS_SECURITY_AUDIT.md");
    expect(payload.releaseGate).toMatchObject({
      ready: true,
      status: "ready",
      code: "ready",
      target: "contract_security_audit",
    });
    expect(payload.releaseGate.checks).toMatchObject({
      blockingFindingCount: 0,
      criticalHighBlockingFindingCount: 0,
      failedInvariantCount: 0,
      undocumentedCriticalHighRemaining: 0,
    });
    expect(payload.summary.findingCount).toBe(payload.findings.length);
    expect(payload.summary.invariantCount).toBe(payload.invariants.length);
    expect(payload.summary.blocking).toBe(0);
    expect(payload.summary.failedInvariants).toBe(0);
    expect(payload.findings.length).toBeGreaterThanOrEqual(10);
    expect(payload.invariants.length).toBeGreaterThanOrEqual(10);

    for (const finding of payload.findings as Array<{
      status: string;
      severity: string;
      implementationRefs: string[];
      testRefs: string[];
      residualRisk: string;
    }>) {
      expect(["resolved", "accepted_risk"]).toContain(finding.status);
      expect(["critical", "high", "medium", "low"]).toContain(finding.severity);
      expect(finding.implementationRefs.length).toBeGreaterThanOrEqual(2);
      expect(finding.testRefs.length).toBeGreaterThanOrEqual(2);
      expect(finding.residualRisk).toMatch(/\S/);
    }

    for (const invariant of payload.invariants as Array<{
      status: string;
      implementationRefs: string[];
      testRefs: string[];
      evidence: string;
    }>) {
      expect(invariant.status).toBe("passed");
      expect(invariant.implementationRefs.length).toBeGreaterThanOrEqual(1);
      expect(invariant.testRefs.length).toBeGreaterThanOrEqual(1);
      expect(invariant.evidence).toMatch(/\S/);
    }
  });
});
