import {
  mkdtempSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  deriveFigmaPixelAuditGate,
  readFigmaPixelAuditGate,
  type FigmaPixelAuditReport,
} from "@/lib/qa/figmaPixelAuditGate";

const tempRoots: string[] = [];
const MANIFEST_HASH = "abc123";
type ReportOverrides = Omit<Partial<FigmaPixelAuditReport>, "summary"> & {
  summary?: Partial<FigmaPixelAuditReport["summary"]>;
};

function makeRoot(): string {
  const root = mkdtempSync(join(tmpdir(), "arkafund-pixel-gate-"));
  tempRoots.push(root);
  return root;
}

function makeReport(
  overrides: ReportOverrides = {},
): FigmaPixelAuditReport {
  const base: FigmaPixelAuditReport = {
      ok: true,
      failureCount: 0,
      failures: [],
      diffIndex: "/tmp/pixel/diff-index.html",
      manifestHash: MANIFEST_HASH,
      expectedReferencedCaptures: 2,
      summary: {
        total: 2,
        compared: 2,
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
    comparisons: [
      {
        key: "dashboard",
        title: "Dashboard",
        route: "/dashboard",
        frameFamily: "public-dashboard",
        requiresOperator: false,
        status: "tight",
        similarity: 0.94,
        threshold: 0.9,
        strictDelta: 0.04,
        passedStrict: true,
      },
    ],
  };

  return {
    ...base,
    ...overrides,
    summary: {
      ...base.summary,
      ...overrides.summary,
    },
    failures: overrides.failures ?? base.failures,
    comparisons: overrides.comparisons ?? base.comparisons,
  };
}

describe("figmaPixelAuditGate", () => {
  afterEach(() => {
    for (const root of tempRoots.splice(0)) {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("marks the pixel audit gate ready when every frame clears strict thresholds", () => {
    const gate = deriveFigmaPixelAuditGate({
      reportPath: "/tmp/pixel/report.json",
      report: makeReport(),
      manifestContract: {
        manifestHash: MANIFEST_HASH,
        referenceBackedCaptureCount: 2,
      },
    });

    expect(gate.ready).toBe(true);
    expect(gate.status).toBe("ready");
    expect(gate.code).toBe("ready");
    expect(gate.target).toBe("figma_pixel_tight");
    expect(gate.checks.allThresholdsMet).toBe(true);
    expect(gate.checks.belowThreshold).toBe(0);
    expect(gate.checks.manifestMatches).toBe(true);
    expect(gate.checks.coverageMatchesManifest).toBe(true);
    expect(gate.checks.comparedViewports).toEqual(["desktop"]);
  });

  it("blocks the pixel audit gate when the report shows threshold drift", () => {
    const gate = deriveFigmaPixelAuditGate({
      reportPath: "/tmp/pixel/report.json",
      report: makeReport({
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
      manifestContract: {
        manifestHash: MANIFEST_HASH,
        referenceBackedCaptureCount: 2,
      },
    });

    expect(gate.ready).toBe(false);
    expect(gate.status).toBe("blocked");
    expect(gate.code).toBe("threshold_drift");
    expect(gate.checks.worstKey).toBe("create-assets");
    expect(gate.detail).toContain("not strict-ready");
  });

  it("blocks the pixel audit gate when the report was generated from an old manifest", () => {
    const gate = deriveFigmaPixelAuditGate({
      reportPath: "/tmp/pixel/report.json",
      report: makeReport({ manifestHash: "stale-hash" }),
      manifestContract: {
        manifestHash: MANIFEST_HASH,
        referenceBackedCaptureCount: 2,
      },
    });

    expect(gate.ready).toBe(false);
    expect(gate.status).toBe("blocked");
    expect(gate.code).toBe("report_stale");
    expect(gate.checks.manifestHash).toBe("stale-hash");
    expect(gate.checks.expectedManifestHash).toBe(MANIFEST_HASH);
    expect(gate.checks.manifestMatches).toBe(false);
  });

  it("blocks the pixel audit gate when the report does not cover every referenced frame", () => {
    const gate = deriveFigmaPixelAuditGate({
      reportPath: "/tmp/pixel/report.json",
      report: makeReport({
        expectedReferencedCaptures: 1,
        summary: {
          total: 1,
          compared: 1,
        },
      }),
      manifestContract: {
        manifestHash: MANIFEST_HASH,
        referenceBackedCaptureCount: 2,
      },
    });

    expect(gate.ready).toBe(false);
    expect(gate.status).toBe("blocked");
    expect(gate.code).toBe("coverage_mismatch");
    expect(gate.checks.expectedReferencedCaptures).toBe(2);
    expect(gate.checks.reportReferencedCaptures).toBe(1);
    expect(gate.checks.coverageMatchesManifest).toBe(false);
  });

  it("blocks the pixel audit gate when the report is missing", () => {
    const root = makeRoot();
    const missingReport = join(root, "missing-report.json");

    const gate = readFigmaPixelAuditGate({ reportPath: missingReport });

    expect(gate.ready).toBe(false);
    expect(gate.status).toBe("blocked");
    expect(gate.code).toBe("report_missing");
    expect(gate.checks.reportFound).toBe(false);
    expect(gate.reportPath).toBe(missingReport);
  });

  it("blocks the pixel audit gate when report JSON is invalid", () => {
    const root = makeRoot();
    const invalidReport = join(root, "report.json");
    writeFileSync(invalidReport, "{not-json", "utf8");

    const gate = readFigmaPixelAuditGate({ reportPath: invalidReport });

    expect(gate.ready).toBe(false);
    expect(gate.status).toBe("blocked");
    expect(gate.code).toBe("report_invalid");
    expect(gate.checks.reportFound).toBe(true);
  });
});
