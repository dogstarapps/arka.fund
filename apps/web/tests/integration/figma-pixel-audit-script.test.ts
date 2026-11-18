import { execFileSync, spawnSync } from "node:child_process";
import {
  mkdtempSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

type PixelReport = {
  ok: boolean;
  failureCount: number;
  failures: string[];
  diffIndex: string;
  manifestHash?: string;
  expectedReferencedCaptures?: number;
  summary: {
    total: number;
    compared: number;
    missing: number;
    errors: number;
    belowThreshold: number;
    rawBelowThreshold?: number;
    waivedBelowThreshold?: number;
    allThresholdsMet: boolean;
    needsReview: boolean;
    comparedViewports?: string[];
    worstKey: string | null;
    worstSimilarity: number | null;
    structuralCompared?: number;
    structuralWorstKey?: string | null;
    structuralWorstSimilarity?: number | null;
    worstFrames: Array<{
      key: string;
      route: string;
      similarity: number | null;
      threshold: number | null;
      strictDelta: number | null;
    }>;
  };
  comparisons: Array<{
    key: string;
    route: string;
    frameFamily: string;
    requiresOperator: boolean;
    status: string;
    similarity: number | null;
    structuralSimilarity?: number | null;
    structuralStrictDelta?: number | null;
    dynamicMaskCoverage?: number;
    threshold: number | null;
    strictDelta?: number | null;
    currentOriginal?: string;
    current?: string;
    diff?: string | null;
    structuralDiff?: string | null;
    passedStrict?: boolean;
    waivedStrict?: boolean;
    viewports?: Array<{ name: string; width: number; height: number }>;
    waiver?: {
      key: string;
      owner: string;
      reason: string;
      expiresAt: string;
    };
    reason?: string;
  }>;
};

const scriptPath = resolve(process.cwd(), "scripts/figma_pixel_audit.py");
const tempRoots: string[] = [];

function makeTempRoot(): string {
  const root = mkdtempSync(join(tmpdir(), "arkafund-figma-pixel-"));
  tempRoots.push(root);
  return root;
}

function createPng(path: string, color: string): void {
  execFileSync(
    "ffmpeg",
    [
      "-y",
      "-v",
      "error",
      "-f",
      "lavfi",
      "-i",
      `color=c=${color}:s=16x16`,
      "-frames:v",
      "1",
      path,
    ],
    { stdio: "pipe" },
  );
}

function createPngWithBox(path: string, color: string, boxColor: string): void {
  execFileSync(
    "ffmpeg",
    [
      "-y",
      "-v",
      "error",
      "-f",
      "lavfi",
      "-i",
      `color=c=${color}:s=16x16`,
      "-vf",
      `drawbox=x=4:y=4:w=4:h=4:color=${boxColor}:t=fill`,
      "-frames:v",
      "1",
      path,
    ],
    { stdio: "pipe" },
  );
}

function writeManifest(
  root: string,
  captures: Array<{
    key: string;
    currentFile: string;
    referenceFile: string;
    strictSimilarity: number;
    dynamicMaskRegions?: Array<{
      label: string;
      xPct: number;
      yPct: number;
      widthPct: number;
      heightPct: number;
    }>;
  }>,
  strictWaivers: unknown[] = [],
): string {
  const manifestPath = join(root, "manifest.json");
  writeFileSync(
    manifestPath,
    JSON.stringify(
      {
        schemaVersion: 1,
        referenceRoot: join(root, "reference"),
        currentRoot: join(root, "current"),
        strictWaivers,
        captures: captures.map((capture) => ({
          ...capture,
          title: capture.key,
          route: `/${capture.key}`,
          figmaNode: "test:1",
          frameFamily: "test-fixture",
          states: ["test-loaded"],
          viewports: [{ name: "desktop", width: 16, height: 16 }],
          referenceDisposition: "figma-reference",
          manualFile: capture.currentFile,
          fullPage: false,
          requiresOperator: false,
        })),
      },
      null,
      2,
    ),
  );
  return manifestPath;
}

function runAudit(
  root: string,
  manifestPath: string,
  strict = true,
  extraArgs: string[] = [],
) {
  return spawnSync(
    "python3",
    [
      scriptPath,
      "--manifest",
      manifestPath,
      "--output-root",
      join(root, "pixel"),
      ...(strict ? ["--strict"] : []),
      ...extraArgs,
    ],
    {
      encoding: "utf8",
    },
  );
}

function readReport(root: string): PixelReport {
  return JSON.parse(readFileSync(join(root, "pixel/report.json"), "utf8")) as PixelReport;
}

describe("figma pixel audit script", () => {
  afterEach(() => {
    for (const root of tempRoots.splice(0)) {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("writes markdown and machine-readable JSON for passing strict comparisons", () => {
    const root = makeTempRoot();
    mkdirSync(join(root, "reference"), { recursive: true });
    mkdirSync(join(root, "current"), { recursive: true });
    createPng(join(root, "reference/perfect-reference.png"), "black");
    createPng(join(root, "current/perfect-current.png"), "black");
    const manifestPath = writeManifest(root, [
      {
        key: "perfect",
        currentFile: "perfect-current.png",
        referenceFile: "perfect-reference.png",
        strictSimilarity: 0.99,
      },
    ]);

    const result = runAudit(root, manifestPath);

    expect(result.status).toBe(0);
    const report = readReport(root);
    expect(report).toMatchObject({ ok: true, failureCount: 0 });
    expect(report.manifestHash).toEqual(expect.any(String));
    expect(report.expectedReferencedCaptures).toBe(1);
    expect(report.summary).toMatchObject({
      total: 1,
      compared: 1,
      missing: 0,
      errors: 0,
      belowThreshold: 0,
      allThresholdsMet: true,
      needsReview: false,
      comparedViewports: ["desktop"],
      worstKey: "perfect",
    });
    expect(report.comparisons[0]).toMatchObject({
      key: "perfect",
      route: "/perfect",
      frameFamily: "test-fixture",
      requiresOperator: false,
      status: "tight",
      threshold: 0.99,
      strictDelta: expect.any(Number),
      passedStrict: true,
      viewports: [{ name: "desktop", width: 16, height: 16 }],
    });
    expect(report.comparisons[0]!.similarity).toBeGreaterThanOrEqual(0.99);
    expect(readFileSync(join(root, "pixel/report.md"), "utf8")).toContain(
      "Pixel Audit Report",
    );
    const htmlIndex = readFileSync(join(root, "pixel/diff-index.html"), "utf8");
    expect(htmlIndex).toContain("Arka Fund Figma Pixel Audit");
    expect(htmlIndex).toContain("/perfect");
    expect(htmlIndex).toContain("perfect · test-fixture · public");
    expect(htmlIndex).toContain("perfect-diff.png");
  }, 20_000);

  it("fails strict mode when a current screenshot is missing", () => {
    const root = makeTempRoot();
    mkdirSync(join(root, "reference"), { recursive: true });
    mkdirSync(join(root, "current"), { recursive: true });
    createPng(join(root, "reference/missing-current-reference.png"), "black");
    const manifestPath = writeManifest(root, [
      {
        key: "missing-current",
        currentFile: "missing-current.png",
        referenceFile: "missing-current-reference.png",
        strictSimilarity: 0.99,
      },
    ]);

    const result = runAudit(root, manifestPath);

    expect(result.status).toBe(1);
    const report = readReport(root);
    expect(report.ok).toBe(false);
    expect(report.summary).toMatchObject({
      total: 1,
      compared: 0,
      missing: 1,
      errors: 0,
      belowThreshold: 0,
      allThresholdsMet: false,
      needsReview: true,
    });
    expect(report.failures.join("\n")).toContain("missing current image");
    expect(report.comparisons[0]).toMatchObject({
      key: "missing-current",
      route: "/missing-current",
      status: "missing",
      reason: "missing current image",
    });
    expect(readFileSync(join(root, "pixel/diff-index.html"), "utf8")).toContain(
      "not available",
    );
  });

  it("fails non-strict mode when the current screenshot set is partially written", () => {
    const root = makeTempRoot();
    mkdirSync(join(root, "reference"), { recursive: true });
    mkdirSync(join(root, "current"), { recursive: true });
    createPng(join(root, "reference/ready-reference.png"), "black");
    createPng(join(root, "reference/pending-reference.png"), "black");
    createPng(join(root, "current/ready-current.png"), "black");
    const manifestPath = writeManifest(root, [
      {
        key: "ready",
        currentFile: "ready-current.png",
        referenceFile: "ready-reference.png",
        strictSimilarity: 0.99,
      },
      {
        key: "pending",
        currentFile: "pending-current.png",
        referenceFile: "pending-reference.png",
        strictSimilarity: 0.99,
      },
    ]);

    const result = runAudit(root, manifestPath, false);

    expect(result.status).toBe(1);
    const report = readReport(root);
    expect(report.ok).toBe(false);
    expect(report.failureCount).toBe(1);
    expect(report.failures.join("\n")).toContain("current capture set incomplete");
    expect(report.failures.join("\n")).toContain("pending");
    expect(report.summary).toMatchObject({
      total: 2,
      compared: 1,
      missing: 1,
      errors: 0,
      allThresholdsMet: false,
      needsReview: true,
    });
    expect(report.comparisons.map((comparison) => comparison.status)).toEqual([
      "tight",
      "missing",
    ]);
  });

  it("allows explicit partial-current diagnostic reports without passing strict readiness", () => {
    const root = makeTempRoot();
    mkdirSync(join(root, "reference"), { recursive: true });
    mkdirSync(join(root, "current"), { recursive: true });
    createPng(join(root, "reference/ready-reference.png"), "black");
    createPng(join(root, "reference/pending-reference.png"), "black");
    createPng(join(root, "current/ready-current.png"), "black");
    const manifestPath = writeManifest(root, [
      {
        key: "ready",
        currentFile: "ready-current.png",
        referenceFile: "ready-reference.png",
        strictSimilarity: 0.99,
      },
      {
        key: "pending",
        currentFile: "pending-current.png",
        referenceFile: "pending-reference.png",
        strictSimilarity: 0.99,
      },
    ]);

    const result = runAudit(root, manifestPath, false, ["--allow-partial-current"]);

    expect(result.status).toBe(0);
    const report = readReport(root);
    expect(report).toMatchObject({ ok: true, failureCount: 0 });
    expect(report.summary).toMatchObject({
      total: 2,
      compared: 1,
      missing: 1,
      errors: 0,
      allThresholdsMet: false,
      needsReview: true,
    });
  });

  it("fails strict mode when similarity drops below the frame threshold", () => {
    const root = makeTempRoot();
    mkdirSync(join(root, "reference"), { recursive: true });
    mkdirSync(join(root, "current"), { recursive: true });
    createPng(join(root, "reference/drift-reference.png"), "black");
    createPng(join(root, "current/drift-current.png"), "white");
    const manifestPath = writeManifest(root, [
      {
        key: "drift",
        currentFile: "drift-current.png",
        referenceFile: "drift-reference.png",
        strictSimilarity: 0.99,
      },
    ]);

    const result = runAudit(root, manifestPath);

    expect(result.status).toBe(1);
    const report = readReport(root);
    expect(report.ok).toBe(false);
    expect(report.summary).toMatchObject({
      total: 1,
      compared: 1,
      missing: 0,
      errors: 0,
      belowThreshold: 1,
      rawBelowThreshold: 1,
      waivedBelowThreshold: 0,
      allThresholdsMet: false,
      needsReview: true,
      worstKey: "drift",
    });
    expect(report.failures.join("\n")).toContain("below threshold");
    expect(report.comparisons[0]).toMatchObject({
      key: "drift",
      status: "drift",
      threshold: 0.99,
      passedStrict: false,
    });
    expect(report.comparisons[0]!.strictDelta).toBeLessThan(0);
    expect(report.comparisons[0]!.similarity).toBeLessThan(0.99);
  });

  it("allows strict threshold drift only when a waiver is documented with owner and future expiry", () => {
    const root = makeTempRoot();
    mkdirSync(join(root, "reference"), { recursive: true });
    mkdirSync(join(root, "current"), { recursive: true });
    createPng(join(root, "reference/waived-reference.png"), "black");
    createPng(join(root, "current/waived-current.png"), "white");
    const manifestPath = writeManifest(
      root,
      [
        {
          key: "waived",
          currentFile: "waived-current.png",
          referenceFile: "waived-reference.png",
          strictSimilarity: 0.99,
        },
      ],
      [
        {
          key: "waived",
          owner: "design-review",
          reason: "Temporary accepted drift while final Figma replacement asset is reviewed.",
          expiresAt: "2099-01-01T00:00:00Z",
        },
      ],
    );

    const result = runAudit(root, manifestPath);

    expect(result.status).toBe(0);
    const report = readReport(root);
    expect(report.ok).toBe(true);
    expect(report.failureCount).toBe(0);
    expect(report.summary).toMatchObject({
      rawBelowThreshold: 1,
      waivedBelowThreshold: 1,
      belowThreshold: 0,
      allThresholdsMet: true,
      needsReview: true,
    });
    expect(report.comparisons[0]).toMatchObject({
      key: "waived",
      passedStrict: false,
      waivedStrict: true,
      waiver: {
        owner: "design-review",
        expiresAt: "2099-01-01T00:00:00Z",
      },
    });
  });

  it("fails strict mode when a visual waiver lacks a documented reason or expiry", () => {
    const root = makeTempRoot();
    mkdirSync(join(root, "reference"), { recursive: true });
    mkdirSync(join(root, "current"), { recursive: true });
    createPng(join(root, "reference/invalid-waiver-reference.png"), "black");
    createPng(join(root, "current/invalid-waiver-current.png"), "white");
    const manifestPath = writeManifest(
      root,
      [
        {
          key: "invalid-waiver",
          currentFile: "invalid-waiver-current.png",
          referenceFile: "invalid-waiver-reference.png",
          strictSimilarity: 0.99,
        },
      ],
      [
        {
          key: "invalid-waiver",
          owner: "",
          reason: "short",
          expiresAt: "2020-01-01T00:00:00Z",
        },
      ],
    );

    const result = runAudit(root, manifestPath);

    expect(result.status).toBe(1);
    const report = readReport(root);
    expect(report.ok).toBe(false);
    expect(report.failures.join("\n")).toContain("reason must explain");
    expect(report.failures.join("\n")).toContain("owner is required");
    expect(report.failures.join("\n")).toContain("expired");
  });

  it("reports masked structural similarity separately from raw dynamic-content drift", () => {
    const root = makeTempRoot();
    mkdirSync(join(root, "reference"), { recursive: true });
    mkdirSync(join(root, "current"), { recursive: true });
    createPng(join(root, "reference/dynamic-reference.png"), "black");
    createPngWithBox(join(root, "current/dynamic-current.png"), "black", "white");
    const manifestPath = writeManifest(root, [
      {
        key: "dynamic",
        currentFile: "dynamic-current.png",
        referenceFile: "dynamic-reference.png",
        strictSimilarity: 0.99,
        dynamicMaskRegions: [
          {
            label: "dynamic-value",
            xPct: 25,
            yPct: 25,
            widthPct: 25,
            heightPct: 25,
          },
        ],
      },
    ]);

    const result = runAudit(root, manifestPath, false);

    expect(result.status).toBe(0);
    const report = readReport(root);
    expect(report.summary.structuralCompared).toBe(1);
    expect(report.summary.structuralWorstKey).toBe("dynamic");
    expect(report.comparisons[0]!.similarity).toBeLessThan(0.99);
    expect(report.comparisons[0]!.structuralSimilarity).toBeGreaterThanOrEqual(0.99);
    expect(report.comparisons[0]!.structuralStrictDelta).toBeGreaterThanOrEqual(0);
    expect(report.comparisons[0]!.dynamicMaskCoverage).toBeCloseTo(0.0625, 5);
    expect(report.comparisons[0]!.diff).toContain("dynamic-diff.png");
    expect(report.comparisons[0]!.structuralDiff).toContain(
      "dynamic-structural-diff.png",
    );
    const markdown = readFileSync(join(root, "pixel/report.md"), "utf8");
    expect(markdown).toContain("Structural similarity");
    expect(markdown).toContain("dynamic-structural-diff.png");
    const htmlIndex = readFileSync(join(root, "pixel/diff-index.html"), "utf8");
    expect(htmlIndex).toContain("Structural diff");
  });
});
