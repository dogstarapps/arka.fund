import { describe, expect, it } from "vitest";
import {
  resolveAssetDisplayLabel,
  resolveAssetGlyphText,
  resolveAssetPresentation,
} from "@/lib/catalog/assetPresentation";

describe("asset presentation", () => {
  it("resolves known aliases to readable labels and symbols", () => {
    const presentation = resolveAssetPresentation(
      "CCW67TSZV3SSS2HXMBQ5JFGCKJNXKZM7UQUWUZPUTHXSTZLEO7SJMI75",
    );

    expect(presentation.label).toBe("USDC");
    expect(presentation.symbol).toBe("USDC");
    expect(presentation.source).toBe("known_alias");
    expect(resolveAssetDisplayLabel(presentation.contract)).toBe("USDC");
    expect(resolveAssetGlyphText(presentation.contract)).toBe("USDC");
  });

  it("recognizes XTAR and XLM from the curated core Stellar registry", () => {
    expect(
      resolveAssetPresentation("CAS3J7GYLGXMF6TDJBBYYSE3HQ6BBSMLNUQ34T6TZMYMW2EVH34XOWMA"),
    ).toMatchObject({
      label: "XLM",
      symbol: "XLM",
      source: "known_alias",
    });
    expect(
      resolveAssetPresentation("CDCKFBZYF2AQCSM3JOF2ZM27O3Y6AJAI4OTCQKAFNZ3FHBYUTFOKICIY"),
    ).toMatchObject({
      label: "XTAR",
      symbol: "XTAR",
      source: "known_alias",
    });
  });

  it("recognizes BLND from the classic Stellar asset identifier", () => {
    expect(
      resolveAssetPresentation(
        "BLND:GDJEHTBE6ZHUXSWFI642DCGLUOECLHPF3KSXHPXTSTJ7E3JF6MQ5EZYY",
      ),
    ).toMatchObject({
      label: "BLND",
      symbol: "BLND",
      source: "known_alias",
    });
  });

  it("falls back to contract formatting for unknown assets", () => {
    const presentation = resolveAssetPresentation(
      "CUNKNOWNASSET7RTH9KLMNOPQ2UVWX3YZ56789ABCDEFGHJKLMNPRST",
    );

    expect(presentation.label).toMatch(/^Asset CUNKNOWN/i);
    expect(presentation.symbol).toBe("ASSE");
    expect(presentation.source).toBe("glyph_fallback");
  });
});
