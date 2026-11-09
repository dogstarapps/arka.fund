import {
  mkdirSync,
  mkdtempSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  deriveFigmaAuditReadiness,
  type FigmaAuditManifest,
} from "@/lib/qa/figmaAuditReadiness";

const tempRoots: string[] = [];

function makeRoot(): string {
  const root = mkdtempSync(join(tmpdir(), "arkafund-figma-readiness-"));
  tempRoots.push(root);
  mkdirSync(join(root, "public/figma/references"), { recursive: true });
  mkdirSync(join(root, "current"), { recursive: true });
  mkdirSync(join(root, "manual"), { recursive: true });
  return root;
}

function touch(path: string): void {
  writeFileSync(path, "fixture", "utf8");
}

function makeManifest(): FigmaAuditManifest {
  return {
    schemaVersion: 2,
    date: "2026-05-05",
    figmaFile: "3RlH484r3hru8HUuqqM9e9/dogstar-value",
    referenceRoot: "public/figma/references",
    currentRoot: "current",
    manualRoot: "manual",
    defaultViewport: {
      width: 1365,
      height: 768,
    },
    captures: [
      {
        key: "dashboard",
        title: "Dashboard shell",
        route: "/dashboard",
        figmaNode: "1:2",
        frameFamily: "public-dashboard",
        states: ["public-loaded"],
        viewports: [{ name: "desktop", width: 1365, height: 768 }],
        currentFile: "dashboard-current.png",
        manualFile: "dashboard-current.png",
        referenceFile: "dashboard-reference.png",
        referenceDisposition: "figma-reference",
        sourceAsset: "public/figma/references/dashboard-reference.png",
        auditRules: [
          "pixel-compare-against-committed-figma-export",
          "typography-rhythm",
          "no-overlap-or-horizontal-overflow",
          "truthful-runtime-data-only",
        ],
        strictSimilarity: 0.9,
        requiresOperator: false,
      },
      {
        key: "coverage",
        title: "Coverage",
        route: "/coverage",
        figmaNode: null,
        frameFamily: "derived-coverage",
        states: ["public-loaded"],
        viewports: [{ name: "desktop", width: 1365, height: 768 }],
        currentFile: "coverage-current.png",
        manualFile: "coverage-current.png",
        referenceFile: null,
        referenceDisposition: "derived-without-figma-reference",
        sourceAsset: null,
        auditRules: [
          "derived-coverage-surface-layout",
          "coverage-balances-must-be-runtime-backed",
          "wallet-actions-require-confirmation-state",
          "no-overlap-or-horizontal-overflow",
        ],
        strictSimilarity: null,
        requiresOperator: false,
      },
      {
        key: "integrations",
        title: "Integrations",
        route: "/integrations",
        figmaNode: "87:15027",
        frameFamily: "integrations",
        states: ["operator-verified", "loaded"],
        viewports: [{ name: "desktop", width: 1365, height: 768 }],
        currentFile: "integrations-current.png",
        manualFile: "integrations-current.png",
        referenceFile: "integrations-reference.png",
        referenceDisposition: "figma-reference",
        sourceAsset: "public/figma/references/integrations-reference.png",
        auditRules: [
          "pixel-compare-against-committed-figma-export",
          "typography-rhythm",
          "no-overlap-or-horizontal-overflow",
          "truthful-runtime-data-only",
        ],
        strictSimilarity: 0.86,
        requiresOperator: true,
      },
    ],
  };
}

describe("figmaAuditReadiness", () => {
  afterEach(() => {
    for (const root of tempRoots.splice(0)) {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("marks the manifest ready when every referenced/current/manual screenshot exists", () => {
    const root = makeRoot();
    for (const file of [
      "public/figma/references/dashboard-reference.png",
      "public/figma/references/integrations-reference.png",
      "current/dashboard-current.png",
      "current/coverage-current.png",
      "current/integrations-current.png",
      "manual/dashboard-current.png",
      "manual/coverage-current.png",
      "manual/integrations-current.png",
    ]) {
      touch(join(root, file));
    }

    const readiness = deriveFigmaAuditReadiness({
      manifest: makeManifest(),
      dappRoot: root,
      manifestPath: join(root, "manifest.json"),
      generatedAt: "2026-05-05T08:00:00.000Z",
    });

    expect(readiness.ok).toBe(true);
    expect(readiness.source).toBe("figma_route_audit_manifest");
    expect(readiness.summary).toMatchObject({
      totalCaptures: 3,
      figmaMappedCaptures: 2,
      derivedCaptures: 1,
      referencedCaptures: 2,
      strictComparableCaptures: 2,
      stateMappedCaptures: 3,
      viewportMappedCaptures: 3,
      auditRuleMappedCaptures: 3,
      derivedDispositionCaptures: 1,
      manifestContractIssueCount: 0,
      publicCaptures: 2,
      operatorCaptures: 1,
      currentReadyCount: 3,
      manualReadyCount: 3,
      referenceReadyCount: 2,
      missingReferenceCount: 0,
      missingCurrentCount: 0,
      missingManualCount: 0,
      readyCaptureCount: 3,
      lowestStrictSimilarity: 0.86,
    });
    expect(readiness.missing).toEqual({
      references: [],
      current: [],
      manual: [],
      manifestContract: [],
    });
    expect(readiness.captures.map((capture) => capture.status)).toEqual([
      "ready",
      "derived_ready",
      "ready",
    ]);
  });

  it("identifies the exact frame keys blocking strict visual readiness", () => {
    const root = makeRoot();
    for (const file of [
      "public/figma/references/dashboard-reference.png",
      "current/dashboard-current.png",
      "current/coverage-current.png",
      "manual/dashboard-current.png",
      "manual/integrations-current.png",
    ]) {
      touch(join(root, file));
    }

    const readiness = deriveFigmaAuditReadiness({
      manifest: makeManifest(),
      dappRoot: root,
      manifestPath: join(root, "manifest.json"),
      generatedAt: "2026-05-05T08:00:00.000Z",
    });

    expect(readiness.ok).toBe(false);
    expect(readiness.summary).toMatchObject({
      missingReferenceCount: 1,
      missingCurrentCount: 0,
      missingManualCount: 1,
      manifestContractIssueCount: 0,
    });
    expect(readiness.missing.references).toEqual(["integrations"]);
    expect(readiness.missing.current).toEqual([]);
    expect(readiness.missing.manual).toEqual(["coverage"]);
    expect(
      readiness.captures.map((capture) => [capture.key, capture.status]),
    ).toEqual([
      ["dashboard", "ready"],
      ["coverage", "missing_manual"],
      ["integrations", "missing_reference"],
    ]);
  });
});
