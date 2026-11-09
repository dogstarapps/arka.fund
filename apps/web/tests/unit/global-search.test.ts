import { describe, expect, it } from "vitest";
import { resolveGlobalSearchTarget } from "@/lib/workflows/globalSearch";

describe("resolveGlobalSearchTarget", () => {
  it("routes empty and free-text queries to Discover", () => {
    expect(resolveGlobalSearchTarget("   ")).toMatchObject({
      href: "/discover",
      intent: "empty",
    });
    expect(resolveGlobalSearchTarget("phoenix fund")).toMatchObject({
      href: "/discover?q=phoenix%20fund",
      intent: "discover",
    });
  });

  it("routes product keywords to real product surfaces", () => {
    expect(resolveGlobalSearchTarget("dashboard")).toMatchObject({
      href: "/dashboard",
      intent: "product_route",
    });
    expect(resolveGlobalSearchTarget("arkas")).toMatchObject({
      href: "/vaults",
      intent: "product_route",
    });
    expect(resolveGlobalSearchTarget("dao")).toMatchObject({
      href: "/governance",
      intent: "product_route",
    });
  });

  it("routes core Stellar asset symbols to asset detail surfaces", () => {
    expect(resolveGlobalSearchTarget("BLND")).toMatchObject({
      href: "/assets/CD25MNVTZDL4Y3XBCPCJXGXATV5WUHHOWMYFF4YBEGU5FCPGMYTVG5JY",
      intent: "asset_detail",
    });
    expect(resolveGlobalSearchTarget("asset:XTAR")).toMatchObject({
      href: "/assets/CDCKFBZYF2AQCSM3JOF2ZM27O3Y6AJAI4OTCQKAFNZ3FHBYUTFOKICIY",
      intent: "asset_detail",
    });
  });

  it("routes explicit vault, execution and manager prefixes to canonical detail routes", () => {
    expect(
      resolveGlobalSearchTarget(
        "vault:CCW67TSZV3SSS2HXMBQ5JFGCKJNXKZM7UQUWUZPUTHXSTZLEO7SJMI75",
      ),
    ).toMatchObject({
      href: "/vaults/CCW67TSZV3SSS2HXMBQ5JFGCKJNXKZM7UQUWUZPUTHXSTZLEO7SJMI75",
      intent: "vault_detail",
    });
    expect(
      resolveGlobalSearchTarget(
        "ops:CCW67TSZV3SSS2HXMBQ5JFGCKJNXKZM7UQUWUZPUTHXSTZLEO7SJMI75",
      ),
    ).toMatchObject({
      href: "/arkas/CCW67TSZV3SSS2HXMBQ5JFGCKJNXKZM7UQUWUZPUTHXSTZLEO7SJMI75",
      intent: "vault_execution",
    });
    expect(
      resolveGlobalSearchTarget(
        "manager:GDEMOUSER7RTH9KLMNOPQ2UVWX3YZ56789ABCDEFGHJKLMNPRSTUV",
      ),
    ).toMatchObject({
      href: "/managers/GDEMOUSER7RTH9KLMNOPQ2UVWX3YZ56789ABCDEFGHJKLMNPRSTUV",
      intent: "manager_detail",
    });
  });

  it("does not invent invalid prefixed detail routes", () => {
    expect(resolveGlobalSearchTarget("asset:not-a-contract")).toMatchObject({
      href: "/discover?q=asset%3Anot-a-contract",
      intent: "discover",
    });
  });
});
