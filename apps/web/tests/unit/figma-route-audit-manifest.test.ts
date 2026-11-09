import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { findCoreStellarAssetByLookup } from "@/lib/catalog/coreStellarAssetRegistry";
import { resolveCatalogFixture } from "@/lib/catalog/testFixtures";
import { validateFigmaAuditManifest } from "@/lib/qa/figmaAuditReadiness";

type Capture = {
  key: string;
  title: string;
  route: string;
  figmaNode: string | null;
  frameFamily: string;
  states?: string[];
  viewports?: Array<{
    name: string;
    width: number;
    height: number;
  }>;
  currentFile: string;
  manualFile: string;
  referenceFile: string | null;
  referenceDisposition?:
    | "figma-reference"
    | "derived-from-figma-family"
    | "derived-without-figma-reference";
  sourceAsset?: string | null;
  auditRules?: string[];
  strictSimilarity: number | null;
  requiresOperator: boolean;
  dynamicMaskRegions?: Array<{
    label: string;
    xPct: number;
    yPct: number;
    widthPct: number;
    heightPct: number;
  }>;
};

type Manifest = {
  schemaVersion: number;
  figmaFile: string;
  referenceRoot: string;
  currentRoot: string;
  manualRoot: string;
  captures: Capture[];
};

function loadManifest(): Manifest {
  return JSON.parse(
    readFileSync(
      resolve(process.cwd(), "docs/figma-route-audit-manifest.json"),
      "utf8",
    ),
  ) as Manifest;
}

describe("figma route audit manifest", () => {
  it("is the single capture contract for product, detail and operator screenshots", () => {
    const manifest = loadManifest();

    expect(manifest.schemaVersion).toBe(2);
    expect(manifest.figmaFile).toContain("3RlH484r3hru8HUuqqM9e9");
    expect(manifest.captures.length).toBeGreaterThanOrEqual(24);

    const keys = new Set<string>();
    const currentFiles = new Set<string>();
    const manualFiles = new Set<string>();
    for (const capture of manifest.captures) {
      expect(capture.key, "Every capture needs a stable key").toMatch(
        /^[a-z0-9-]+$/,
      );
      expect(keys.has(capture.key), `${capture.key} key duplicated`).toBe(false);
      keys.add(capture.key);

      expect(capture.title).toBeTruthy();
      expect(capture.route).toMatch(/^\//);
      expect(capture.frameFamily).toBeTruthy();
      expect(capture.currentFile).toMatch(/\.png$/);
      expect(capture.manualFile).toMatch(/\.png$/);
      expect(
        currentFiles.has(capture.currentFile),
        `${capture.currentFile} current output duplicated`,
      ).toBe(false);
      expect(
        manualFiles.has(capture.manualFile),
        `${capture.manualFile} manual output duplicated`,
      ).toBe(false);
      currentFiles.add(capture.currentFile);
      manualFiles.add(capture.manualFile);

      if (capture.referenceFile) {
        expect(capture.strictSimilarity).toBeGreaterThan(0.8);
      }
    }
  });

  it("covers every Figma-critical route family called out in the cutover plan", () => {
    const manifest = loadManifest();
    const capturesByRoute = new Map(
      manifest.captures.map((capture) => [capture.route, capture]),
    );
    const capturesByKey = new Map(
      manifest.captures.map((capture) => [capture.key, capture]),
    );

    for (const route of [
      "/dashboard",
      "/discover",
      "/factory/create",
      "/factory/create?step=basics",
      "/factory/create?step=fees",
      "/factory/create?step=deposits",
      "/factory/create?step=redemptions",
      "/factory/create?step=assets",
      "/factory/create?step=review",
      "/vaults",
      "/assets",
      "/integrations",
    ]) {
      expect(capturesByRoute.get(route), `${route} must be captured`).toBeTruthy();
    }

    for (const key of ["vault-profile", "asset-profile", "manager-profile"]) {
      expect(capturesByKey.get(key), `${key} detail capture missing`).toBeTruthy();
    }

    const figmaCritical = manifest.captures.filter(
      (capture) => capture.figmaNode !== null,
    );
    expect(figmaCritical.length).toBeGreaterThanOrEqual(16);
    for (const capture of figmaCritical) {
      expect(
        capture.referenceFile,
        `${capture.key} maps to Figma and must declare a reference image`,
      ).toBeTruthy();
    }

    const createCaptures = manifest.captures.filter(
      (capture) => capture.frameFamily === "create-wizard",
    );
    expect(createCaptures.map((capture) => capture.key)).toEqual([
      "create",
      "create-basics",
      "create-fees",
      "create-deposits",
      "create-redemptions",
      "create-assets",
      "create-review",
    ]);
    for (const capture of createCaptures) {
      expect(capture.requiresOperator).toBe(false);
      expect(capture.referenceFile).toBeTruthy();
      expect(capture.strictSimilarity).toBeGreaterThan(0.83);
    }
  });

  it("keeps local reference roots explicit without requiring generated screenshots in unit tests", () => {
    const manifest = loadManifest();

    expect(manifest.referenceRoot).toBe("public/figma/references");
    expect(manifest.currentRoot).toBe("../arkafund/tmp/design-audit/current");
    expect(manifest.manualRoot).toBe("docs/screenshots/dapp-manual");
    expect(
      existsSync(resolve(process.cwd(), "docs/figma-route-audit-manifest.json")),
    ).toBe(true);
    expect(
      existsSync(resolve(process.cwd(), "public/figma/references/vaults screens(13).png")),
    ).toBe(true);
  });

  it("is a self-contained T15 contract with routes, states, viewports and audited dispositions", () => {
    const manifest = loadManifest();

    expect(validateFigmaAuditManifest({ manifest, dappRoot: process.cwd() })).toEqual([]);
    for (const capture of manifest.captures) {
      expect(capture.states?.length, `${capture.key} missing state mapping`).toBeGreaterThan(
        0,
      );
      expect(capture.viewports).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            name: "desktop",
            width: 1365,
            height: 768,
          }),
        ]),
      );
      expect(
        capture.auditRules?.length,
        `${capture.key} needs concrete audit rules`,
      ).toBeGreaterThanOrEqual(4);

      if (capture.referenceFile) {
        expect(
          existsSync(resolve(process.cwd(), manifest.referenceRoot, capture.referenceFile)),
          `${capture.key} reference must be committed in the repo`,
        ).toBe(true);
        expect(capture.sourceAsset).toBe(`${manifest.referenceRoot}/${capture.referenceFile}`);
        expect(capture.referenceDisposition).toBe(
          capture.figmaNode ? "figma-reference" : "derived-from-figma-family",
        );
      } else {
        expect(capture.referenceDisposition).toBe("derived-without-figma-reference");
      }
    }

    const derivedWithoutReference = manifest.captures
      .filter((capture) => !capture.referenceFile)
      .map((capture) => capture.key)
      .sort();
    expect(derivedWithoutReference).toEqual([
      "contracts",
      "coverage",
      "governance",
      "governance-console",
      "integrations-operator",
      "migrations",
      "settings",
      "status",
    ]);
  });

  it("keeps dynamic pixel masks explicit, bounded and limited to approved data/step regions", () => {
    const manifest = loadManifest();
    const maskedCaptures = manifest.captures.filter(
      (capture) => (capture.dynamicMaskRegions?.length ?? 0) > 0,
    );

    expect(maskedCaptures.map((capture) => capture.key).sort()).toEqual([
      "create",
      "create-assets",
      "create-basics",
      "create-deposits",
      "create-fees",
      "create-redemptions",
      "create-review",
      "dashboard",
      "discover",
    ]);

    for (const capture of maskedCaptures) {
      const coverage = (capture.dynamicMaskRegions ?? []).reduce(
        (total, region) => total + (region.widthPct * region.heightPct) / 10000,
        0,
      );
      expect(coverage, `${capture.key} masks must stay diagnostic`).toBeLessThan(
        0.3,
      );
      if (capture.frameFamily === "create-wizard") {
        expect(
          capture.dynamicMaskRegions?.map((region) => region.label).sort(),
        ).toEqual([
          "create-stage-copy",
          "create-step-card-copy",
          "create-stepper-state",
        ]);
      }
      for (const region of capture.dynamicMaskRegions ?? []) {
        expect(region.label).toMatch(/^[a-z0-9-]+$/);
        expect(region.xPct).toBeGreaterThanOrEqual(0);
        expect(region.yPct).toBeGreaterThanOrEqual(0);
        expect(region.widthPct).toBeGreaterThan(0);
        expect(region.heightPct).toBeGreaterThan(0);
        expect(region.xPct + region.widthPct).toBeLessThanOrEqual(100);
        expect(region.yPct + region.heightPct).toBeLessThanOrEqual(100);
      }
    }
  });

  it("keeps catalog detail captures pointed at resolvable fixture entities", () => {
    const manifest = loadManifest();
    const capturesByKey = new Map(
      manifest.captures.map((capture) => [capture.key, capture]),
    );
    const detailChecks = [
      {
        key: "vault-profile",
        routePrefix: "/vaults/",
        catalogPathPrefix: "/v1/arkas/",
      },
      {
        key: "asset-profile",
        routePrefix: "/assets/",
        catalogPathPrefix: "/v1/assets/",
      },
      {
        key: "manager-profile",
        routePrefix: "/managers/",
        catalogPathPrefix: "/v1/managers/",
      },
    ];

    for (const check of detailChecks) {
      const capture = capturesByKey.get(check.key);
      expect(capture, `${check.key} capture missing`).toBeTruthy();
      expect(capture?.route.startsWith(check.routePrefix)).toBe(true);
      const id = decodeURIComponent(capture?.route.slice(check.routePrefix.length) ?? "");
      const fixture = resolveCatalogFixture(
        `${check.catalogPathPrefix}${id}`,
        new URLSearchParams(),
      );
      expect(
        fixture,
        `${check.key} route ${capture?.route} must resolve to fixture-backed data`,
      ).not.toMatchObject({ error: "not_found" });
    }
  });

  it("keeps core-registry-only asset captures explicit and separate from indexed asset captures", () => {
    const manifest = loadManifest();
    const capturesByKey = new Map(
      manifest.captures.map((capture) => [capture.key, capture]),
    );
    const indexedAsset = capturesByKey.get("asset-profile");
    const coreFallbackAsset = capturesByKey.get("asset-profile-core-registry");

    expect(indexedAsset?.route).toMatch(/^\/assets\//);
    expect(coreFallbackAsset?.route).toMatch(/^\/assets\//);
    expect(coreFallbackAsset?.route).not.toBe(indexedAsset?.route);
    expect(coreFallbackAsset?.title).toMatch(/core registry fallback/i);
    expect(coreFallbackAsset?.strictSimilarity).toBeLessThanOrEqual(
      indexedAsset?.strictSimilarity ?? 1,
    );

    const fallbackId = decodeURIComponent(
      coreFallbackAsset?.route.slice("/assets/".length) ?? "",
    );
    const catalogResult = resolveCatalogFixture(
      `/v1/assets/${fallbackId}`,
      new URLSearchParams(),
    );
    expect(catalogResult).toMatchObject({ error: "not_found" });
    expect(findCoreStellarAssetByLookup(fallbackId)).toMatchObject({
      symbol: "XTAR",
    });
  });
});
