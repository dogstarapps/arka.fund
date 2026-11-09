import { spawnSync } from "node:child_process";
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

const scriptPath = resolve(process.cwd(), "scripts/render_design_audit_report.mjs");
const tempRoots: string[] = [];

function makeTempRoot(): string {
  const root = mkdtempSync(join(tmpdir(), "arkafund-design-report-"));
  tempRoots.push(root);
  return root;
}

describe("design audit report script", () => {
  afterEach(() => {
    for (const root of tempRoots.splice(0)) {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("renders every manifest capture with route, status and review checklist", () => {
    const root = makeTempRoot();
    const referenceRoot = join(root, "reference");
    const currentRoot = join(root, "current");
    const manualRoot = join(root, "manual");
    const outputRoot = join(root, "report");
    mkdirSync(referenceRoot, { recursive: true });
    mkdirSync(currentRoot, { recursive: true });
    mkdirSync(manualRoot, { recursive: true });
    writeFileSync(join(referenceRoot, "public-reference.png"), "reference");
    writeFileSync(join(currentRoot, "public-current.png"), "current");
    writeFileSync(join(currentRoot, "operator-current.png"), "current");
    writeFileSync(join(manualRoot, "public-current.png"), "manual");
    writeFileSync(join(manualRoot, "operator-current.png"), "manual");

    const manifestPath = join(root, "manifest.json");
    writeFileSync(
      manifestPath,
      JSON.stringify(
        {
          schemaVersion: 1,
          referenceRoot,
          currentRoot,
          manualRoot,
          defaultViewport: { width: 1365, height: 768 },
          captures: [
            {
              key: "public",
              title: "Public surface",
              route: "/public",
              figmaNode: "1:2",
              frameFamily: "public",
              currentFile: "public-current.png",
              manualFile: "public-current.png",
              referenceFile: "public-reference.png",
              strictSimilarity: 0.9,
              requiresOperator: false,
            },
            {
              key: "operator",
              title: "Operator surface",
              route: "/operator",
              figmaNode: null,
              frameFamily: "operator",
              currentFile: "operator-current.png",
              manualFile: "operator-current.png",
              referenceFile: null,
              strictSimilarity: null,
              requiresOperator: true,
            },
          ],
        },
        null,
        2,
      ),
    );

    const result = spawnSync(
      "node",
      [
        scriptPath,
        "--manifest",
        manifestPath,
        "--output-root",
        outputRoot,
      ],
      { encoding: "utf8" },
    );

    expect(result.status).toBe(0);
    const report = readFileSync(join(outputRoot, "report.md"), "utf8");
    expect(report).toContain("Captures: 2");
    expect(report).toContain("Reference-backed captures: 1");
    expect(report).toContain("Operator-gated captures: 1");
    expect(report).toContain("## Public surface");
    expect(report).toContain("## Operator surface");
    expect(report).toContain("- Route: `/operator`");
    expect(report).toContain("Access surface: `operator-gated`");
    expect(report).toContain("Review checklist:");
    expect(report).toContain("All declared current/reference screenshots are present");
  });
});
