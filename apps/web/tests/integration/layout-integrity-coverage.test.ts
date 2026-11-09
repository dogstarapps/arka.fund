import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  getLayoutIntegrityCoverageSummary,
  LAYOUT_INTEGRITY_ROUTES,
} from "@/lib/qa/layoutIntegrityMatrix";

type FigmaRouteAuditManifest = {
  captures: Array<{
    key: string;
    route: string;
    requiresOperator?: boolean;
  }>;
};

const manifest = JSON.parse(
  readFileSync(resolve(process.cwd(), "docs/figma-route-audit-manifest.json"), "utf8"),
) as FigmaRouteAuditManifest;

describe("layout integrity coverage", () => {
  it("keeps Discover's four-card metrics deck across the full inherited board", () => {
    const css = readFileSync(resolve(process.cwd(), "src/app/ux-priorities.css"), "utf8");
    expect(css).toMatch(/\.discover-stage-grid\[data-testid="discover-summary-grid"\]\s*\{\s*grid-column:\s*1\s*\/\s*-1\s*!important;/);
  });

  it("extends every Figma audit route with multi-breakpoint layout checks", () => {
    const layoutPaths = new Set<string>(
      LAYOUT_INTEGRITY_ROUTES.map((route) => route.path),
    );
    const missing = manifest.captures
      .map((capture) => capture.route)
      .filter((route) => !route.includes("["))
      .filter((route) => !layoutPaths.has(route));

    expect(missing).toEqual([]);
  });

  it("keeps operator routes in the same guarded lane used by visual screenshots", () => {
    const operatorLayoutPaths = new Set<string>(
      LAYOUT_INTEGRITY_ROUTES.filter((route) => route.access === "operator").map(
        (route) => route.path,
      ),
    );
    const operatorManifestPaths = manifest.captures
      .filter((capture) => capture.requiresOperator)
      .map((capture) => capture.route);

    for (const route of operatorManifestPaths) {
      expect(operatorLayoutPaths.has(route)).toBe(true);
    }
  });

  it("makes the intended QA scope explicit for release reporting", () => {
    expect(getLayoutIntegrityCoverageSummary()).toMatchObject({
      routeCount: 29,
      breakpointCount: 4,
      scenarioCount: 116,
    });
  });
});
