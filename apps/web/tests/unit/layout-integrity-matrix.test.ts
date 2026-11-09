import { describe, expect, it } from "vitest";
import {
  getLayoutIntegrityCoverageSummary,
  getLayoutIntegrityRoutes,
  LAYOUT_INTEGRITY_BREAKPOINTS,
  LAYOUT_INTEGRITY_ROUTES,
} from "@/lib/qa/layoutIntegrityMatrix";

describe("layout integrity matrix", () => {
  it("covers public, create, governance, coverage and operator route families", () => {
    expect(getLayoutIntegrityCoverageSummary()).toMatchObject({
      routeCount: 29,
      publicRouteCount: 20,
      operatorRouteCount: 9,
      breakpointCount: 4,
      scenarioCount: 116,
    });

    expect(getLayoutIntegrityCoverageSummary().families.sort()).toEqual([
      "catalog",
      "coverage",
      "create-wizard",
      "governance",
      "operator-console",
      "profile",
      "public-dashboard",
    ]);
  });

  it("keeps all route keys unique and mapped to product paths", () => {
    const keys = LAYOUT_INTEGRITY_ROUTES.map((route) => route.key);
    const paths = LAYOUT_INTEGRITY_ROUTES.map((route) => route.path);

    expect(new Set(keys).size).toBe(keys.length);
    expect(new Set(paths).size).toBe(paths.length);
    expect(paths.every((path) => path.startsWith("/"))).toBe(true);
    expect(paths).toEqual(
      expect.arrayContaining([
        "/dashboard",
        "/discover",
        "/arkas",
        "/assets",
        "/managers",
        "/factory/create",
        "/factory/create?step=basics",
        "/factory/create?step=fees",
        "/factory/create?step=deposits",
        "/factory/create?step=redemptions",
        "/factory/create?step=assets",
        "/factory/create?step=review",
        "/vaults",
        "/vaults/CA7ALPHAQFK2MZKJY4R5S8N2P1T6V9W3X7Y2Z5ABCD1EFGH2345678IJ",
        "/assets/CCW67TSZV3SSS2HXMBQ5JFGCKJNXKZM7UQUWUZPUTHXSTZLEO7SJMI75",
        "/assets/CDCKFBZYF2AQCSM3JOF2ZM27O3Y6AJAI4OTCQKAFNZ3FHBYUTFOKICIY",
        "/managers/GCAALPHA7RTH9KLMNOPQ2UVWX3YZ56789ABCDEFGHJKLMNPRSTUV4WX",
        "/arkas/TEST_BLEND_VAULT",
        "/governance",
        "/coverage",
        "/integrations",
        "/ops",
        "/contracts",
        "/migrations",
        "/settings",
        "/status",
        "/tiers",
      ]),
    );
  });

  it("keeps every breakpoint explicit and mobile-first safe", () => {
    expect(LAYOUT_INTEGRITY_BREAKPOINTS.map((breakpoint) => breakpoint.key)).toEqual([
      "desktop-wide",
      "laptop",
      "tablet",
      "mobile",
    ]);
    expect(LAYOUT_INTEGRITY_BREAKPOINTS.at(-1)).toMatchObject({
      family: "mobile",
      width: 390,
    });
    expect(
      LAYOUT_INTEGRITY_BREAKPOINTS.every(
        (breakpoint) => breakpoint.width > 0 && breakpoint.height > 0,
      ),
    ).toBe(true);
  });

  it("separates public and operator lanes without hiding either from QA", () => {
    expect(getLayoutIntegrityRoutes("public").every((route) => route.access === "public")).toBe(
      true,
    );
    expect(
      getLayoutIntegrityRoutes("operator").every((route) => route.access === "operator"),
    ).toBe(true);
    expect(getLayoutIntegrityRoutes("operator").map((route) => route.path)).toContain(
      "/contracts",
    );
  });
});
