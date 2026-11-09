import { expect, test } from "@playwright/test";
import { enableOperatorMode } from "./helpers/operator-mode";

test.describe("Figma pixel audit gate", () => {
  test("rejects strict pixel-audit telemetry without an operator session", async ({
    request,
  }) => {
    const response = await request.get("/api/qa/figma-pixel-audit");
    expect(response.status()).toBe(401);

    const payload = await response.json();
    expect(payload).toEqual(
      expect.objectContaining({
        ok: false,
        error: "operator_access_required",
      }),
    );
  });

  test("exposes the strict pixel-audit release posture", async ({ page }) => {
    await enableOperatorMode(page);
    const response = await page.request.get("/api/qa/figma-pixel-audit");
    expect([200, 503]).toContain(response.status());

    const payload = await response.json();
    expect(payload).toEqual(
      expect.objectContaining({
        ok: expect.any(Boolean),
        source: "figma_pixel_audit_report",
        generatedAt: expect.any(String),
      }),
    );
    expect(payload.gate).toEqual(
      expect.objectContaining({
        ready: expect.any(Boolean),
        status: expect.stringMatching(/^(ready|blocked)$/),
        code: expect.stringMatching(
          /^(ready|report_missing|report_invalid|report_stale|coverage_mismatch|threshold_drift|missing_or_error_frames|strict_failures)$/,
        ),
        target: "figma_pixel_tight",
        reportPath: expect.any(String),
      }),
    );
    expect(payload.gate.checks).toEqual(
      expect.objectContaining({
        reportFound: expect.any(Boolean),
        compared: expect.any(Number),
        total: expect.any(Number),
        belowThreshold: expect.any(Number),
        rawBelowThreshold: expect.any(Number),
        waivedBelowThreshold: expect.any(Number),
        allThresholdsMet: expect.any(Boolean),
        coverageMatchesManifest: expect.any(Boolean),
      }),
    );
    expect(
      typeof payload.gate.checks.manifestHash === "string" ||
        payload.gate.checks.manifestHash === null,
    ).toBe(true);
    expect(
      typeof payload.gate.checks.expectedManifestHash === "string" ||
        payload.gate.checks.expectedManifestHash === null,
    ).toBe(true);
    expect(
      typeof payload.gate.checks.expectedReferencedCaptures === "number" ||
        payload.gate.checks.expectedReferencedCaptures === null,
    ).toBe(true);
    expect(
      typeof payload.gate.checks.reportReferencedCaptures === "number" ||
        payload.gate.checks.reportReferencedCaptures === null,
    ).toBe(true);
  });
});
