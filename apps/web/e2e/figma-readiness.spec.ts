import { expect, test } from "@playwright/test";
import { enableOperatorMode } from "./helpers/operator-mode";

test.describe("Figma visual readiness", () => {
  test("rejects visual readiness telemetry without an operator session", async ({
    request,
  }) => {
    const response = await request.get("/api/qa/figma-readiness");
    expect(response.status()).toBe(401);

    const payload = await response.json();
    expect(payload).toEqual(
      expect.objectContaining({
        ok: false,
        error: "operator_access_required",
      }),
    );
  });

  test("exposes frame-level reference/current/manual readiness for the pixel-tight gate", async ({
    page,
  }) => {
    await enableOperatorMode(page);
    const response = await page.request.get("/api/qa/figma-readiness");
    expect(response.status()).toBe(200);

    const payload = await response.json();
    expect(payload.ok).toBe(true);
    expect(payload).toEqual(
      expect.objectContaining({
        source: "figma_route_audit_manifest",
        generatedAt: expect.any(String),
      }),
    );
    expect(payload.summary).toEqual(
      expect.objectContaining({
        totalCaptures: expect.any(Number),
        figmaMappedCaptures: expect.any(Number),
        referencedCaptures: expect.any(Number),
        strictComparableCaptures: expect.any(Number),
        stateMappedCaptures: expect.any(Number),
        viewportMappedCaptures: expect.any(Number),
        auditRuleMappedCaptures: expect.any(Number),
        manifestContractIssueCount: 0,
      }),
    );
    expect(payload.summary.totalCaptures).toBeGreaterThanOrEqual(26);
    expect(payload.summary.strictComparableCaptures).toBeGreaterThanOrEqual(21);
    expect(payload.summary.stateMappedCaptures).toBe(payload.summary.totalCaptures);
    expect(payload.summary.viewportMappedCaptures).toBe(payload.summary.totalCaptures);
    expect(payload.summary.auditRuleMappedCaptures).toBe(payload.summary.totalCaptures);
    expect(payload.missing).toEqual(
      {
        references: [],
        current: [],
        manual: [],
        manifestContract: [],
      },
    );
    expect(payload.captures).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          key: "dashboard",
          frameFamily: "public-dashboard",
        }),
        expect.objectContaining({
          key: "create-review",
          frameFamily: "create-wizard",
        }),
        expect.objectContaining({
          key: "integrations",
          requiresOperator: true,
        }),
      ]),
    );
  });
});
