import { describe, expect, it } from "vitest";
import {
  CREATE_ARKA_ROUTE,
  OPERATOR_CONSOLE_NAV,
  PRIMARY_PRODUCT_NAV,
  PUBLIC_UTILITY_PRODUCT_NAV,
  UTILITY_PRODUCT_NAV,
  buildPublicCreateArkaHref,
  isOperatorConsolePath,
  isProductNavActive,
  isOperatorOnlyProductPath,
  isUtilityProductPath,
  normalizeProductPath,
  resolveOperatorConsoleItem,
  resolveProductRoutePolicy,
  resolveUtilityProductItem,
} from "@/lib/workflows/productNavigation";

describe("product navigation", () => {
  it("normalizes route groups to their chrome entrypoints", () => {
    expect(normalizeProductPath("/")).toBe("/dashboard");
    expect(normalizeProductPath("/vaults/CABC")).toBe("/vaults");
    expect(normalizeProductPath("/assets/CXYZ")).toBe("/assets");
    expect(normalizeProductPath("/managers/GMANAGER")).toBe("/managers");
    expect(normalizeProductPath("/factory/create")).toBe("/factory/create");
    expect(normalizeProductPath("/governance/console?draft=x")).toBe(
      "/governance/console",
    );
    expect(normalizeProductPath("/governance/console")).toBe(
      "/governance/console",
    );
  });

  it("marks only the normalized route as active", () => {
    expect(isProductNavActive("/vaults/CABC", "/vaults")).toBe(true);
    expect(isProductNavActive("/dashboard", "/discover")).toBe(false);
    expect(isProductNavActive("/dashboard", "/dashboard")).toBe(true);
    expect(isProductNavActive("/", "/dashboard")).toBe(true);
    expect(isProductNavActive("/factory/create", "/factory/create")).toBe(true);
    expect(isProductNavActive("/factory/create", "/discover")).toBe(false);
    expect(isUtilityProductPath("/governance")).toBe(false);
    expect(isUtilityProductPath("/governance/console")).toBe(true);
    expect(isUtilityProductPath("/migrations")).toBe(true);
    expect(isUtilityProductPath("/vaults/CABC")).toBe(false);
    expect(resolveUtilityProductItem("/governance/console")?.label).toBe(
      "DAO Console",
    );
    expect(resolveOperatorConsoleItem("/governance/console")?.label).toBe(
      "DAO Console",
    );
    expect(resolveUtilityProductItem("/contracts")?.label).toBe("Contracts");
    expect(resolveOperatorConsoleItem("/contracts")?.label).toBe("Contracts");
    expect(resolveUtilityProductItem("/factory/deploy")?.href).toBe("/factory/create");
    expect(resolveOperatorConsoleItem("/factory/deploy")).toBeNull();
    expect(resolveUtilityProductItem("/discover")).toBeNull();
    expect(resolveProductRoutePolicy("/contracts")?.access).toBe("operator");
    expect(resolveProductRoutePolicy("/vaults/CABC")?.access).toBe("public");
    expect(resolveProductRoutePolicy("/contracts")?.group).toBe("utility");
    expect(resolveProductRoutePolicy("/dashboard")?.group).toBe("primary");
    expect(isOperatorOnlyProductPath("/governance")).toBe(false);
    expect(isOperatorOnlyProductPath("/governance/console")).toBe(true);
    expect(isOperatorOnlyProductPath("/integrations")).toBe(false);
    expect(isOperatorOnlyProductPath("/integrations/operator")).toBe(true);
    expect(isOperatorOnlyProductPath("/discover")).toBe(false);
    expect(isOperatorConsolePath("/contracts")).toBe(true);
    expect(isOperatorConsolePath("/factory/create")).toBe(false);
    expect(isOperatorConsolePath("/coverage")).toBe(false);
  });

  it("keeps the expected primary and utility destinations", () => {
    expect(PRIMARY_PRODUCT_NAV.map((item) => item.href)).toEqual([
      "/discover",
      "/investments",
      "/manage",
      "/vaults",
      "/governance",
      "/assets",
      "/managers",
      "/integrations",
      "/dashboard",
    ]);
    expect(UTILITY_PRODUCT_NAV.map((item) => item.href)).toEqual([
      "/factory/create",
      "/coverage",
      "/governance/console",
      "/integrations/operator",
      "/migrations",
      "/ops",
      "/contracts",
      "/settings",
      "/status",
      "/tiers",
    ]);
    expect(
      UTILITY_PRODUCT_NAV.filter((item) =>
        ["/factory/create", "/coverage"].includes(item.href),
      ).map((item) => item.access),
    ).toEqual(["public", "public"]);
    expect(
      UTILITY_PRODUCT_NAV.filter(
        (item) => !["/factory/create", "/coverage"].includes(item.href),
      ).every((item) => item.access === "operator"),
    ).toBe(true);
    expect(PUBLIC_UTILITY_PRODUCT_NAV.map((item) => item.href)).toEqual([
      "/factory/create",
      "/coverage",
    ]);
    expect(OPERATOR_CONSOLE_NAV.map((item) => item.href)).toEqual([
      "/governance/console",
      "/integrations/operator",
      "/migrations",
      "/ops",
      "/contracts",
      "/settings",
      "/status",
      "/tiers",
    ]);
    expect(OPERATOR_CONSOLE_NAV.every((item) => item.access === "operator")).toBe(true);
  });

  it("builds a single public Create Arka entrypoint with source context", () => {
    expect(buildPublicCreateArkaHref("/")).toBe(
      `${CREATE_ARKA_ROUTE}?from=%2Fdashboard`,
    );
    expect(buildPublicCreateArkaHref("/vaults/CABC")).toBe(
      `${CREATE_ARKA_ROUTE}?from=%2Fvaults`,
    );

    const discoverHref = buildPublicCreateArkaHref(
      "/discover",
      "q=blend&section=assets",
    );
    const discoverUrl = new URL(discoverHref, "https://arka.fund");

    expect(discoverUrl.pathname).toBe(CREATE_ARKA_ROUTE);
    expect(discoverUrl.searchParams.get("from")).toBe("/discover");
    expect(discoverUrl.searchParams.get("returnQuery")).toBe(
      "q=blend&section=assets",
    );
    expect(discoverUrl.searchParams.get("q")).toBe("blend");
  });

  it("keeps Create Arka self-links from recursive source metadata", () => {
    const href = buildPublicCreateArkaHref(
      "/factory/create",
      "?step=review&q=legacy",
    );
    const url = new URL(href, "https://arka.fund");

    expect(url.pathname).toBe(CREATE_ARKA_ROUTE);
    expect(url.searchParams.get("from")).toBe("/dashboard");
    expect(url.searchParams.get("returnQuery")).toBe("step=review&q=legacy");
    expect(url.searchParams.get("q")).toBe("legacy");
  });
});
