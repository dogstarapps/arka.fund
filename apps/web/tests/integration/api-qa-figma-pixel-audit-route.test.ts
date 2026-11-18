// @vitest-environment node

import { createHash } from "node:crypto";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  OPERATOR_TEST_PUBLIC_KEY,
  OPERATOR_TEST_SECRET,
  operatorRequest,
} from "../helpers/operator-auth";
import type { FigmaPixelAuditReport } from "@/lib/qa/figmaPixelAuditGate";

type ReportOverrides = Omit<Partial<FigmaPixelAuditReport>, "summary"> & {
  summary?: Partial<FigmaPixelAuditReport["summary"]>;
};

describe("GET /api/qa/figma-pixel-audit", () => {
  const originalReportPath = process.env.ARKAFUND_FIGMA_PIXEL_REPORT_PATH;
  let tempDir: string | null = null;

  afterEach(() => {
    vi.resetModules();
    vi.unstubAllEnvs();
    if (originalReportPath === undefined) {
      delete process.env.ARKAFUND_FIGMA_PIXEL_REPORT_PATH;
    } else {
      process.env.ARKAFUND_FIGMA_PIXEL_REPORT_PATH = originalReportPath;
    }
    if (tempDir) {
      rmSync(tempDir, { recursive: true, force: true });
      tempDir = null;
    }
  });

  function configureOperatorAccess() {
    vi.stubEnv("OPERATOR_ACCESS_SECRET", OPERATOR_TEST_SECRET);
    vi.stubEnv("NEXT_PUBLIC_ARKA_MANAGER", OPERATOR_TEST_PUBLIC_KEY);
  }

  function writeReport(report: FigmaPixelAuditReport): string {
    tempDir = mkdtempSync(join(tmpdir(), "arkafund-pixel-api-"));
    const reportPath = join(tempDir, "report.json");
    writeFileSync(reportPath, JSON.stringify(report), "utf8");
    process.env.ARKAFUND_FIGMA_PIXEL_REPORT_PATH = reportPath;
    return reportPath;
  }

  function report(overrides: ReportOverrides = {}): FigmaPixelAuditReport {
    const manifestPath = resolve(process.cwd(), "docs/figma-route-audit-manifest.json");
    const actualManifestBytes = readFileSync(manifestPath);
    const actualManifest = JSON.parse(actualManifestBytes.toString("utf8")) as {
      captures: Array<{ referenceFile: string | null }>;
    };
    const manifestHash = createHash("sha256").update(actualManifestBytes).digest("hex");
    const expectedReferencedCaptures = actualManifest.captures.filter(
      (capture) => Boolean(capture.referenceFile),
    ).length;
    const base: FigmaPixelAuditReport = {
      ok: true,
      failureCount: 0,
      failures: [],
      diffIndex: "/tmp/pixel/diff-index.html",
      manifestHash,
      expectedReferencedCaptures,
      summary: {
        total: expectedReferencedCaptures,
        compared: expectedReferencedCaptures,
        missing: 0,
        errors: 0,
        belowThreshold: 0,
        rawBelowThreshold: 0,
        waivedBelowThreshold: 0,
        strictFailureCount: 0,
        ok: true,
        allThresholdsMet: true,
        needsReview: false,
        comparedViewports: ["desktop"],
        worstKey: "dashboard",
        worstSimilarity: 0.94,
        worstFrames: [
          {
            key: "dashboard",
            title: "Dashboard",
            route: "/dashboard",
            status: "tight",
            similarity: 0.94,
            threshold: 0.9,
            strictDelta: 0.04,
          },
        ],
      },
      comparisons: [],
    };
    return {
      ...base,
      ...overrides,
      summary: { ...base.summary, ...overrides.summary },
      failures: overrides.failures ?? base.failures,
      comparisons: overrides.comparisons ?? base.comparisons,
    };
  }

  it("requires a verified operator session", async () => {
    const { GET } = await import("@/app/api/qa/figma-pixel-audit/route");

    const response = await GET(new Request("http://localhost/api/qa/figma-pixel-audit"));
    const payload = await response.json();

    expect(response.status).toBe(401);
    expect(payload.error).toBe("operator_access_required");
  });

  it("returns ready when the strict pixel audit report clears every threshold", async () => {
    configureOperatorAccess();
    const reportPath = writeReport(report());
    const { GET } = await import("@/app/api/qa/figma-pixel-audit/route");

    const response = await GET(
      operatorRequest("http://localhost/api/qa/figma-pixel-audit"),
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.ok).toBe(true);
    expect(payload.source).toBe("figma_pixel_audit_report");
    expect(payload.gate).toMatchObject({
      ready: true,
      status: "ready",
      code: "ready",
      reportPath,
      target: "figma_pixel_tight",
    });
  });

  it("returns blocked when the pixel audit report contains visual drift", async () => {
    configureOperatorAccess();
    writeReport(
      report({
        summary: {
          allThresholdsMet: false,
          belowThreshold: 1,
          needsReview: true,
          worstKey: "create-assets",
          worstSimilarity: 0.627449,
          worstFrames: [
            {
              key: "create-assets",
              title: "Create wizard - assets management step",
              route: "/factory/create?step=assets",
              status: "drift",
              similarity: 0.627449,
              threshold: 0.84,
              strictDelta: -0.212551,
            },
          ],
        },
      }),
    );
    const { GET } = await import("@/app/api/qa/figma-pixel-audit/route");

    const response = await GET(
      operatorRequest("http://localhost/api/qa/figma-pixel-audit"),
    );
    const payload = await response.json();

    expect(response.status).toBe(503);
    expect(payload.ok).toBe(false);
    expect(payload.gate).toMatchObject({
      ready: false,
      status: "blocked",
      code: "threshold_drift",
    });
    expect(payload.gate.checks.worstKey).toBe("create-assets");
  });
});
