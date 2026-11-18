import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { readFigmaAuditManifest, resolveFigmaAuditManifestPath } from "@/lib/qa/figmaAuditReadiness";

export type FigmaPixelAuditWorstFrame = {
  key: string;
  title?: string;
  route: string;
  status: string;
  similarity: number | null;
  threshold: number | null;
  strictDelta: number | null;
};

export type FigmaPixelAuditDynamicMaskRegion = {
  label: string;
  xPct: number;
  yPct: number;
  widthPct: number;
  heightPct: number;
};

export type FigmaPixelAuditComparison = {
  key: string;
  title: string;
  route: string;
  frameFamily: string;
  requiresOperator: boolean;
  status: string;
  similarity: number | null;
  structuralStatus?: string | null;
  structuralSimilarity?: number | null;
  structuralStrictDelta?: number | null;
  dynamicMaskRegions?: FigmaPixelAuditDynamicMaskRegion[];
  dynamicMaskCoverage?: number;
  threshold: number | null;
  strictDelta?: number | null;
  passedStrict?: boolean;
  reason?: string;
};

export type FigmaPixelAuditReport = {
  ok: boolean;
  failureCount: number;
  failures: string[];
  diffIndex: string;
  manifest?: string;
  manifestHash?: string;
  referenceRoot?: string;
  currentRoot?: string;
  expectedReferencedCaptures?: number;
  summary: {
    total: number;
    compared: number;
    missing: number;
    errors: number;
    belowThreshold: number;
    rawBelowThreshold?: number;
    waivedBelowThreshold?: number;
    strictFailureCount?: number;
    ok?: boolean;
    allThresholdsMet: boolean;
    needsReview: boolean;
    worstKey: string | null;
    worstSimilarity: number | null;
    structuralCompared?: number;
    structuralWorstKey?: string | null;
    structuralWorstSimilarity?: number | null;
    comparedViewports?: string[];
    structuralWorstFrames?: FigmaPixelAuditWorstFrame[];
    worstFrames: FigmaPixelAuditWorstFrame[];
  };
  comparisons: FigmaPixelAuditComparison[];
};

export type FigmaPixelAuditGate = {
  ready: boolean;
  status: "ready" | "blocked";
  code:
    | "ready"
    | "report_missing"
    | "report_invalid"
    | "threshold_drift"
    | "missing_or_error_frames"
    | "report_stale"
    | "coverage_mismatch"
    | "strict_failures";
  target: "figma_pixel_tight";
  reportPath: string;
  diffIndex: string | null;
  detail: string;
  checks: {
    reportFound: boolean;
    compared: number;
    total: number;
    missing: number;
    errors: number;
    belowThreshold: number;
    strictFailureCount: number;
    rawBelowThreshold: number;
    waivedBelowThreshold: number;
    allThresholdsMet: boolean;
    manifestHash: string | null;
    expectedManifestHash: string | null;
    manifestMatches: boolean;
    expectedReferencedCaptures: number | null;
    reportReferencedCaptures: number | null;
    coverageMatchesManifest: boolean;
    comparedViewports: string[];
    worstKey: string | null;
    worstSimilarity: number | null;
    worstFrames: FigmaPixelAuditWorstFrame[];
    structuralCompared: number;
    structuralWorstKey: string | null;
    structuralWorstSimilarity: number | null;
    structuralWorstFrames: FigmaPixelAuditWorstFrame[];
  };
};

function resolveManifestRelativePath(dappRoot: string, configured: string): string {
  return resolve(dappRoot, configured);
}

function deriveManifestContract(input?: {
  manifestPath?: string;
  dappRoot?: string;
}): {
  manifestPath: string;
  manifestHash: string;
  referenceBackedCaptureCount: number;
} {
  const dappRoot = input?.dappRoot ?? process.cwd();
  const manifestPath =
    input?.manifestPath ?? resolveFigmaAuditManifestPath(undefined, dappRoot);
  const manifestBytes = readFileSync(manifestPath);
  const manifest = JSON.parse(manifestBytes.toString("utf8")) as ReturnType<
    typeof readFigmaAuditManifest
  >;
  return {
    manifestPath,
    manifestHash: createHash("sha256").update(manifestBytes).digest("hex"),
    referenceBackedCaptureCount: manifest.captures.filter(
      (capture) => Boolean(capture.referenceFile),
    ).length,
  };
}

export function resolveFigmaPixelAuditReportPath(input?: {
  manifestPath?: string;
  dappRoot?: string;
  reportPath?: string;
}): string {
  if (input?.reportPath) return resolve(input.reportPath);
  if (process.env.ARKAFUND_FIGMA_PIXEL_REPORT_PATH) {
    return resolve(process.env.ARKAFUND_FIGMA_PIXEL_REPORT_PATH);
  }

  const dappRoot = input?.dappRoot ?? process.cwd();
  const manifestPath =
    input?.manifestPath ?? resolveFigmaAuditManifestPath(undefined, dappRoot);
  const manifest = readFigmaAuditManifest(manifestPath);
  const currentRoot = resolveManifestRelativePath(dappRoot, manifest.currentRoot);
  return resolve(dirname(currentRoot), "pixel", "report.json");
}

export function readFigmaPixelAuditReport(
  reportPath = resolveFigmaPixelAuditReportPath(),
): FigmaPixelAuditReport {
  return JSON.parse(readFileSync(reportPath, "utf8")) as FigmaPixelAuditReport;
}

function invalidGate(reportPath: string, error: string): FigmaPixelAuditGate {
  return {
    ready: false,
    status: "blocked",
    code: "report_invalid",
    target: "figma_pixel_tight",
    reportPath,
    diffIndex: null,
    detail: `Figma pixel audit report is invalid: ${error}`,
    checks: {
      reportFound: existsSync(reportPath),
      compared: 0,
      total: 0,
      missing: 0,
      errors: 0,
      belowThreshold: 0,
      strictFailureCount: 0,
      rawBelowThreshold: 0,
      waivedBelowThreshold: 0,
      allThresholdsMet: false,
      manifestHash: null,
      expectedManifestHash: null,
      manifestMatches: false,
      expectedReferencedCaptures: null,
      reportReferencedCaptures: null,
      coverageMatchesManifest: false,
      comparedViewports: [],
      worstKey: null,
      worstSimilarity: null,
      worstFrames: [],
      structuralCompared: 0,
      structuralWorstKey: null,
      structuralWorstSimilarity: null,
      structuralWorstFrames: [],
    },
  };
}

export function deriveFigmaPixelAuditGate(input: {
  reportPath: string;
  report: FigmaPixelAuditReport;
  manifestContract?: {
    manifestHash: string;
    referenceBackedCaptureCount: number;
  };
}): FigmaPixelAuditGate {
  const summary = input.report.summary;
  const strictFailureCount =
    summary.strictFailureCount ?? input.report.failureCount ?? 0;
  const manifestHash = input.report.manifestHash ?? null;
  const expectedManifestHash = input.manifestContract?.manifestHash ?? null;
  const manifestMatches =
    expectedManifestHash === null ? true : manifestHash === expectedManifestHash;
  const expectedReferencedCaptures =
    input.manifestContract?.referenceBackedCaptureCount ?? null;
  const reportReferencedCaptures =
    input.report.expectedReferencedCaptures ?? summary.total;
  const coverageMatchesManifest =
    expectedReferencedCaptures === null
      ? true
      : reportReferencedCaptures === expectedReferencedCaptures &&
        summary.total === expectedReferencedCaptures &&
        summary.compared + summary.missing + summary.errors === expectedReferencedCaptures;
  const hasMissingOrErrors = summary.missing > 0 || summary.errors > 0;
  const hasStrictFailures = strictFailureCount > 0 || input.report.failures.length > 0;
  const hasThresholdDrift = summary.belowThreshold > 0 || !summary.allThresholdsMet;
  const staleReport = !manifestMatches;
  const coverageMismatch = !coverageMatchesManifest;
  const ready =
    !staleReport &&
    !coverageMismatch &&
    !hasMissingOrErrors &&
    !hasStrictFailures &&
    !hasThresholdDrift;

  let code: FigmaPixelAuditGate["code"] = "ready";
  if (staleReport) code = "report_stale";
  else if (coverageMismatch) code = "coverage_mismatch";
  else if (hasMissingOrErrors) code = "missing_or_error_frames";
  else if (hasStrictFailures) code = "strict_failures";
  else if (hasThresholdDrift) code = "threshold_drift";

  const worstDetail =
    summary.worstKey && typeof summary.worstSimilarity === "number"
      ? ` Worst frame is ${summary.worstKey} at ${(summary.worstSimilarity * 100).toFixed(2)}%.`
      : "";

  return {
    ready,
    status: ready ? "ready" : "blocked",
    code,
    target: "figma_pixel_tight",
    reportPath: input.reportPath,
    diffIndex: input.report.diffIndex || null,
    detail: ready
      ? `Figma pixel audit is strict-ready across ${summary.compared}/${summary.total} compared frames.`
      : `Figma pixel audit is not strict-ready: ${summary.belowThreshold} below threshold, ${summary.missing} missing, ${summary.errors} errors.${worstDetail}`,
    checks: {
      reportFound: true,
      compared: summary.compared,
      total: summary.total,
      missing: summary.missing,
      errors: summary.errors,
      belowThreshold: summary.belowThreshold,
      strictFailureCount,
      rawBelowThreshold: summary.rawBelowThreshold ?? summary.belowThreshold,
      waivedBelowThreshold: summary.waivedBelowThreshold ?? 0,
      allThresholdsMet: summary.allThresholdsMet,
      manifestHash,
      expectedManifestHash,
      manifestMatches,
      expectedReferencedCaptures,
      reportReferencedCaptures,
      coverageMatchesManifest,
      comparedViewports: summary.comparedViewports ?? [],
      worstKey: summary.worstKey,
      worstSimilarity: summary.worstSimilarity,
      worstFrames: summary.worstFrames,
      structuralCompared: summary.structuralCompared ?? 0,
      structuralWorstKey: summary.structuralWorstKey ?? null,
      structuralWorstSimilarity: summary.structuralWorstSimilarity ?? null,
      structuralWorstFrames: summary.structuralWorstFrames ?? [],
    },
  };
}

export function readFigmaPixelAuditGate(input?: {
  manifestPath?: string;
  dappRoot?: string;
  reportPath?: string;
}): FigmaPixelAuditGate {
  const reportPath = resolveFigmaPixelAuditReportPath(input);
  if (!existsSync(reportPath)) {
    const manifestContract = deriveManifestContract(input);
    return {
      ready: false,
      status: "blocked",
      code: "report_missing",
      target: "figma_pixel_tight",
      reportPath,
      diffIndex: null,
      detail:
        "Figma pixel audit report is missing. Run `npm run design:audit:pixel:strict` before release.",
      checks: {
        reportFound: false,
        compared: 0,
        total: 0,
        missing: 0,
        errors: 0,
        belowThreshold: 0,
        strictFailureCount: 0,
        rawBelowThreshold: 0,
        waivedBelowThreshold: 0,
        allThresholdsMet: false,
        manifestHash: null,
        expectedManifestHash: manifestContract.manifestHash,
        manifestMatches: false,
        expectedReferencedCaptures: manifestContract.referenceBackedCaptureCount,
        reportReferencedCaptures: null,
        coverageMatchesManifest: false,
        comparedViewports: [],
        worstKey: null,
        worstSimilarity: null,
        worstFrames: [],
        structuralCompared: 0,
        structuralWorstKey: null,
        structuralWorstSimilarity: null,
        structuralWorstFrames: [],
      },
    };
  }

  try {
    const manifestContract = deriveManifestContract(input);
    return deriveFigmaPixelAuditGate({
      reportPath,
      report: readFigmaPixelAuditReport(reportPath),
      manifestContract,
    });
  } catch (error) {
    return invalidGate(reportPath, error instanceof Error ? error.message : String(error));
  }
}
