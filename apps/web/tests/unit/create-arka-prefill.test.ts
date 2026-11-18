import { describe, expect, it } from "vitest";
import {
  resolveCreateArkaPrefill,
  resolveCreateArkaPrefillAsset,
  type CreateArkaPrefillAssetOption,
} from "@/lib/workflows/createArkaPrefill";

const OPTIONS: CreateArkaPrefillAssetOption[] = [
  {
    key: "catalog-usdc",
    contract: "CCW67TSZV3SSS2HXMBQ5JFGCKJNXKZM7UQUWUZPUTHXSTZLEO7SJMI75",
    label: "USDC",
    registryId: "usdc",
    selectable: true,
  },
  {
    key: "catalog-unknown",
    contract: null,
    label: "Metadata Only",
    registryId: "metadata-only",
    selectable: false,
  },
];

describe("createArkaPrefill", () => {
  it("resolves query values against create options and core registry aliases", () => {
    expect(resolveCreateArkaPrefillAsset("USDC", OPTIONS)).toMatchObject({
      contract: "CCW67TSZV3SSS2HXMBQ5JFGCKJNXKZM7UQUWUZPUTHXSTZLEO7SJMI75",
      label: "USDC",
    });
    expect(resolveCreateArkaPrefillAsset("XTAR", OPTIONS)).toMatchObject({
      contract: "CDCKFBZYF2AQCSM3JOF2ZM27O3Y6AJAI4OTCQKAFNZ3FHBYUTFOKICIY",
      label: "XTAR",
    });
    expect(resolveCreateArkaPrefillAsset("Metadata Only", OPTIONS)).toBeNull();
  });

  it("builds denomination and allowed asset selections from URL params", () => {
    const result = resolveCreateArkaPrefill(
      new URLSearchParams("denomination=BLND&asset=XTAR&whitelist=USDC"),
      OPTIONS,
    );

    expect(result.applied).toBe(true);
    expect(result.denomination).toMatchObject({
      contract: "CD25MNVTZDL4Y3XBCPCJXGXATV5WUHHOWMYFF4YBEGU5FCPGMYTVG5JY",
      label: "BLND",
    });
    expect(result.whitelist.map((item) => item.label)).toEqual(["XTAR", "USDC"]);
    expect(result.unresolved).toEqual([]);
    expect(result.search).toBe("XTAR");
  });
});
