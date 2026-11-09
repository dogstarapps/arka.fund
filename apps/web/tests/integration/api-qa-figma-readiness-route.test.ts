// @vitest-environment node

import { afterEach, describe, expect, it, vi } from "vitest";
import {
  OPERATOR_TEST_PUBLIC_KEY,
  OPERATOR_TEST_SECRET,
  operatorRequest,
} from "../helpers/operator-auth";

describe("GET /api/qa/figma-readiness", () => {
  afterEach(() => {
    vi.resetModules();
    vi.unstubAllEnvs();
  });

  function configureOperatorAccess() {
    vi.stubEnv("OPERATOR_ACCESS_SECRET", OPERATOR_TEST_SECRET);
    vi.stubEnv("NEXT_PUBLIC_ARKA_MANAGER", OPERATOR_TEST_PUBLIC_KEY);
  }

  it("requires a verified operator session", async () => {
    const { GET } = await import("@/app/api/qa/figma-readiness/route");

    const response = await GET(new Request("http://localhost/api/qa/figma-readiness"));
    const payload = await response.json();

    expect(response.status).toBe(401);
    expect(payload.error).toBe("operator_access_required");
  });

  it("returns the machine-consumable Figma audit readiness surface", async () => {
    configureOperatorAccess();
    const { GET } = await import("@/app/api/qa/figma-readiness/route");

    const response = await GET(
      operatorRequest("http://localhost/api/qa/figma-readiness"),
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.ok).toBe(true);
    expect(payload.source).toBe("figma_route_audit_manifest");
    expect(payload.generatedAt).toEqual(expect.any(String));
    expect(payload.figmaFile).toContain("3RlH484r3hru8HUuqqM9e9");
    expect(payload.summary.totalCaptures).toBeGreaterThanOrEqual(26);
    expect(payload.summary.figmaMappedCaptures).toBeGreaterThanOrEqual(16);
    expect(payload.summary.referencedCaptures).toBeGreaterThanOrEqual(21);
    expect(payload.summary.stateMappedCaptures).toBe(payload.summary.totalCaptures);
    expect(payload.summary.viewportMappedCaptures).toBe(payload.summary.totalCaptures);
    expect(payload.summary.auditRuleMappedCaptures).toBe(payload.summary.totalCaptures);
    expect(payload.summary.manifestContractIssueCount).toBe(0);
    expect(payload.missing).toMatchObject({
      references: [],
      current: [],
      manual: [],
      manifestContract: [],
    });
    expect(payload.summary.frameFamilies).toEqual(
      expect.arrayContaining(["create-wizard", "assets-table", "integrations"]),
    );
    expect(payload.captures).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          key: "create-deposits",
          route: "/factory/create?step=deposits",
          frameFamily: "create-wizard",
          strictComparable: true,
          referenceDisposition: "figma-reference",
          states: ["loaded", "wizard-deposits"],
        }),
        expect.objectContaining({
          key: "integrations",
          route: "/integrations",
          requiresOperator: true,
        }),
      ]),
    );
  });
});
