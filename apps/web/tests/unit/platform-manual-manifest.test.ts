import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

type ManualManifest = {
  schemaVersion: number;
  manualPath: string;
  screenshotRoot: string;
  figmaAuditManifest: string;
  mainnetBlockers: Array<{
    key: string;
    evidenceRef: string;
  }>;
  claims: Array<{
    key: string;
    claim: string;
    implementationRefs: string[];
    testRefs: string[];
  }>;
  screens: Array<{
    key: string;
    classification: string;
    audience: string;
    purpose: string;
    reads: string[];
    actions: string[];
    boundary: string;
    implementationRefs: string[];
    testRefs: string[];
  }>;
};

type FigmaManifest = {
  captures: Array<{
    key: string;
    route: string;
    manualFile: string;
    requiresOperator: boolean;
  }>;
};

function readJson<T>(path: string): T {
  return JSON.parse(readFileSync(resolve(process.cwd(), path), "utf8")) as T;
}

function expectRefsExist(refs: string[], label: string) {
  for (const ref of refs) {
    expect(existsSync(resolve(process.cwd(), ref)), `${label}: ${ref}`).toBe(true);
  }
}

describe("platform manual manifest", () => {
  it("covers the same route capture contract as the Figma/design audit manifest", () => {
    const manual = readJson<ManualManifest>("docs/platform-manual-screen-manifest.json");
    const figma = readJson<FigmaManifest>(manual.figmaAuditManifest);

    expect(manual.schemaVersion).toBe(1);
    expect(manual.manualPath).toBe("docs/ARKAFUND_FINAL_PLATFORM_MANUAL_2026-05-21.md");
    expect(manual.screens).toHaveLength(29);
    expect(figma.captures).toHaveLength(29);

    const screenKeys = new Set(manual.screens.map((screen) => screen.key));
    const captureKeys = new Set(figma.captures.map((capture) => capture.key));
    expect([...screenKeys].sort()).toEqual([...captureKeys].sort());
    expect(screenKeys.size).toBe(manual.screens.length);
    expect(captureKeys.size).toBe(figma.captures.length);

    for (const capture of figma.captures) {
      expect(
        existsSync(resolve(process.cwd(), manual.screenshotRoot, capture.manualFile)),
        `${capture.key} screenshot must be committed/refreshed for the manual`,
      ).toBe(true);
    }
  });

  it("keeps every screen descriptive, traceable and backed by implementation/test files", () => {
    const manual = readJson<ManualManifest>("docs/platform-manual-screen-manifest.json");

    for (const screen of manual.screens) {
      expect(screen.key).toMatch(/^[a-z0-9-]+$/);
      expect(screen.classification.length, screen.key).toBeGreaterThan(4);
      expect(screen.audience.length, screen.key).toBeGreaterThan(12);
      expect(screen.purpose.length, screen.key).toBeGreaterThan(24);
      expect(screen.reads.length, screen.key).toBeGreaterThanOrEqual(2);
      expect(screen.actions.length, screen.key).toBeGreaterThanOrEqual(1);
      expect(screen.boundary.length, screen.key).toBeGreaterThan(24);
      expectRefsExist(screen.implementationRefs, `${screen.key} implementation`);
      expectRefsExist(screen.testRefs, `${screen.key} tests`);
    }
  });

  it("keeps platform claims and mainnet blockers honest and linked", () => {
    const manual = readJson<ManualManifest>("docs/platform-manual-screen-manifest.json");

    expect(manual.claims.map((claim) => claim.key)).toEqual([
      "product-operator-route-boundary",
      "dao-governed-write-boundary",
      "smart-routing-source-of-truth",
      "balanced-sodax-auto-boundary",
      "storage-lifecycle-hardening",
      "production-release-gate",
      "visual-screenshot-contract",
    ]);

    for (const claim of manual.claims) {
      expect(claim.claim).not.toMatch(/placeholder|stub|skeleton/i);
      expectRefsExist(claim.implementationRefs, `${claim.key} claim implementation`);
      expectRefsExist(claim.testRefs, `${claim.key} claim tests`);
    }

    expect(manual.mainnetBlockers.map((blocker) => blocker.key)).toEqual([
      "testnet-dress-rehearsal",
      "mainnet-cutover",
      "raw-audit-exceptions",
    ]);
    expectRefsExist(
      manual.mainnetBlockers.map((blocker) => blocker.evidenceRef),
      "mainnet blocker",
    );
  });
});
