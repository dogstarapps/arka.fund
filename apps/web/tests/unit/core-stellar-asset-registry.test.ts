import { describe, expect, it } from "vitest";
import {
  CORE_STELLAR_ASSET_REGISTRY,
  buildCoreStellarAssetMetadata,
  findCoreStellarAssetByLookup,
  lookupCoreAssetMetadata,
  indexCoreAssetMetadata,
} from "@/lib/catalog/coreStellarAssetRegistry";

describe("coreStellarAssetRegistry", () => {
  it("keeps the initial Arka asset universe selectable from one canonical registry", () => {
    expect(CORE_STELLAR_ASSET_REGISTRY.map((asset) => asset.id)).toEqual([
      "xlm",
      "usdc",
      "eurc",
      "aqua",
      "xtar",
      "blnd",
      "shx",
      "xrf",
      "velo",
      "ybx",
    ]);

    for (const asset of CORE_STELLAR_ASSET_REGISTRY) {
      if (["xlm", "usdc", "aqua", "xtar", "blnd"].includes(asset.id)) {
        expect(asset.fallbackIconUrl).toBe(`/assets/core/${asset.id}.png`);
      }
      expect(asset.selectableContract).toBeTruthy();
      expect(asset.decimals).toBeGreaterThan(0);
      expect(asset.oracleFeedIds.length).toBeGreaterThan(0);
      expect(asset.description).not.toMatch(/network fees only/i);
    }

    const xlm = buildCoreStellarAssetMetadata(
      findCoreStellarAssetByLookup("XLM")!,
    );
    expect(xlm.description).toMatch(/Arka asset/i);
    expect(xlm.description).toMatch(/allocation|routing|protocol/i);
    expect(xlm.tomlState).toBe("not_applicable");
    expect(xlm.iconProvenanceLabel).toBe("Native asset icon");
    expect(
      findCoreStellarAssetByLookup(
        "CAS3J7GYLGXMF6TDJBBYYSE3HQ6BBSMLNUQ34T6TZMYMW2EVH34XOWMA",
      ),
    ).toMatchObject({ symbol: "XLM", kind: "native" });
  });

  it("indexes the newly required public Stellar assets by symbol, issuer and SAC contract", () => {
    expect(findCoreStellarAssetByLookup("EURC")).toMatchObject({
      symbol: "EURC",
      stablecoin: true,
      classicIssuer: "GDHU6WRG4IEQXM5NZ4BMPKOXHW76MZM4Y2IEMFDVXBSDP6SJY4ITNPP2",
      metadataContract: "CDTKPWPLOURQA2SGTKTUQOWRCBZEORB4BWBOMJ3D3ZTQQSGE5F6JBQLV",
    });
    expect(findCoreStellarAssetByLookup("SHX")).toMatchObject({
      symbol: "SHX",
      classicIssuer: "GDSTRSHXHGJ7ZIVRBXEYE5Q74XUVCUSEKEBR7UCHEUUEK72N7I7KJ6JH",
      metadataContract: "CCKCKCPHYVXQD4NECBFJTFSCU2AMSJGCNG4O6K4JVRE2BLPR7WNDBQIQ",
    });
    expect(findCoreStellarAssetByLookup("XRF")).toMatchObject({
      symbol: "XRF",
      classicIssuer: "GCHI6I3X62ND5XUMWINNNKXS2HPYZWKFQBZZYBSMHJ4MIP2XJXSZTXRF",
      metadataContract: "CBLLEW7HD2RWATVSMLAGWM4G3WCHSHDJ25ALP4DI6LULV5TU35N2CIZA",
    });
    expect(findCoreStellarAssetByLookup("VELO")).toMatchObject({
      symbol: "VELO",
      classicIssuer: "GDM4RQUQQUVSKQA7S6EM7XBZP3FCGH4Q7CL6TABQ7B2BEJ5ERARM2M5M",
      metadataContract: "CAESLMGW5LYTIEJI7FJHK6SFSWRELLNVX5Q4WR4UZEALMTRWQDBKDPAG",
    });
    expect(findCoreStellarAssetByLookup("YBX")).toMatchObject({
      symbol: "YBX",
      classicIssuer: "GBUYYBXWCLT2MOSSHRFCKMEDFOVSCAXNIEW424GLN666OEXHAAWBDYMX",
      metadataContract: "CBRP2VD3CZLEQIQZ4JMBXGA5AC2U6JE26YU5CCIOICIZCVWPGBO2QRUB",
    });
  });

  it("builds deterministic client-safe metadata from the curated registry", () => {
    const xtar = findCoreStellarAssetByLookup("XTAR");
    expect(xtar).not.toBeNull();

    const metadata = buildCoreStellarAssetMetadata(xtar!);

    expect(metadata).toMatchObject({
      id: "xtar",
      symbol: "XTAR",
      kind: "classic",
      classicIssuer: "GAORYJ3KBDGIM7FFSKVUJHJ5NEFWIRDIAGGBJBJS7TY6ECZS53257IG4",
      metadataContract: "CDCKFBZYF2AQCSM3JOF2ZM27O3Y6AJAI4OTCQKAFNZ3FHBYUTFOKICIY",
      selectableContract: "CDCKFBZYF2AQCSM3JOF2ZM27O3Y6AJAI4OTCQKAFNZ3FHBYUTFOKICIY",
      iconSource: "registry_png",
      tomlState: "unreachable",
      tomlUrl: "https://dogstarcoin.com/.well-known/stellar.toml",
      iconProvenanceLabel: "Registry icon",
    });
    expect(metadata.lookupKeys).toContain("xtar");
    expect(metadata.lookupKeys).toContain("CDCKFBZYF2AQCSM3JOF2ZM27O3Y6AJAI4OTCQKAFNZ3FHBYUTFOKICIY");
  });

  it("indexes generated metadata by symbol and contract aliases", () => {
    const blnd = findCoreStellarAssetByLookup("BLND");
    expect(blnd).not.toBeNull();

    const lookup = indexCoreAssetMetadata([buildCoreStellarAssetMetadata(blnd!)]);

    expect(lookupCoreAssetMetadata(lookup, "blnd")?.symbol).toBe("BLND");
    expect(lookupCoreAssetMetadata(lookup, "blend")?.symbol).toBe("BLND");
    expect(buildCoreStellarAssetMetadata(blnd!)).toMatchObject({
      tomlState: "missing_home_domain",
      tomlUrl: null,
      iconProvenanceLabel: "Registry icon",
    });
    expect(
      lookupCoreAssetMetadata(
        lookup,
        "CD25MNVTZDL4Y3XBCPCJXGXATV5WUHHOWMYFF4YBEGU5FCPGMYTVG5JY",
      )?.symbol,
    ).toBe("BLND");
  });

  it("does not expose lab placeholder contracts as selectable assets or lookup aliases", () => {
    const serialized = JSON.stringify(
      CORE_STELLAR_ASSET_REGISTRY.map(buildCoreStellarAssetMetadata),
    );

    expect(serialized).not.toMatch(/CXLMCORE|CDENOMUSDC|CYUSDCARC|CAQUAASST|CBLNDASSET/);
  });
});
