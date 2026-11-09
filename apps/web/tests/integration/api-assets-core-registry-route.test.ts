import { afterEach, describe, expect, it, vi } from "vitest";

describe("GET /api/assets/core-registry", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.resetModules();
  });

  it("resolves stellar.toml metadata for classic assets and falls back to png when unavailable", async () => {
    vi.spyOn(global, "fetch").mockImplementation(async (input) => {
      const url =
        typeof input === "string"
          ? input
          : input instanceof URL
            ? input.toString()
            : input.url;
      if (url === "https://circle.com/.well-known/stellar.toml") {
        return new Response(
          `
          [[CURRENCIES]]
          code="USDC"
          issuer="GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN"
          image="https://cdn.circle.com/usdc.png"
          name="USD Coin"
        `,
          { status: 200 },
        );
      }
      if (url === "https://aqua.network/.well-known/stellar.toml") {
        return new Response(
          `
          [[CURRENCIES]]
          code="AQUA"
          issuer="GBNZILSTVQZ4R7IKQDGHYGY2QXL5QOFJYQMXPKWRRM5PAV7Y4M67AQUA"
          image="https://cdn.aqua.network/aqua.png"
          name="Aqua"
        `,
          { status: 200 },
        );
      }
      if (url === "https://dogstarcoin.com/.well-known/stellar.toml") {
        return new Response(
          `
          [[CURRENCIES]]
          code="XTAR"
          issuer="GAORYJ3KBDGIM7FFSKVUJHJ5NEFWIRDIAGGBJBJS7TY6ECZS53257IG4"
          image="https://cdn.dogstarcoin.com/xtar.png"
          name="Dogstar"
        `,
          { status: 200 },
        );
      }
      return new Response("not found", { status: 404 });
    });

    const { GET } = await import("@/app/api/assets/core-registry/route");
    const response = await GET();
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.items).toHaveLength(10);
    expect(payload.items.map((item: { symbol: string }) => item.symbol)).toEqual([
      "XLM",
      "USDC",
      "EURC",
      "AQUA",
      "XTAR",
      "BLND",
      "SHX",
      "XRF",
      "VELO",
      "YBX",
    ]);
    expect(payload.items.find((item: { id: string }) => item.id === "usdc")).toMatchObject({
      label: "USD Coin",
      iconSource: "stellar_toml",
      tomlState: "resolved",
      iconUrl: "https://cdn.circle.com/usdc.png",
      iconProvenanceLabel: "Verified icon",
    });
    expect(payload.items.find((item: { id: string }) => item.id === "xtar")).toMatchObject({
      label: "Dogstar",
      iconSource: "stellar_toml",
      tomlState: "resolved",
      iconUrl: "https://cdn.dogstarcoin.com/xtar.png",
    });
    expect(payload.items.find((item: { id: string }) => item.id === "xlm")).toMatchObject({
      iconSource: "registry_png",
      tomlState: "not_applicable",
      fallbackIconUrl: "/assets/core/xlm.png",
      iconProvenanceLabel: "Native asset icon",
    });
    expect(payload.items.find((item: { id: string }) => item.id === "blnd")).toMatchObject({
      iconSource: "registry_png",
      tomlState: "missing_home_domain",
      fallbackIconUrl: "/assets/core/blnd.png",
      iconProvenanceLabel: "Registry icon",
    });
    expect(payload.items.find((item: { id: string }) => item.id === "eurc")).toMatchObject({
      symbol: "EURC",
      stablecoin: true,
      decimals: 7,
      oracleFeedIds: expect.arrayContaining(["reflector:EURC"]),
    });
  });

  it("rejects unsafe stellar.toml image URLs and exposes fallback state explicitly", async () => {
    vi.spyOn(global, "fetch").mockImplementation(async (input) => {
      const url =
        typeof input === "string"
          ? input
          : input instanceof URL
            ? input.toString()
            : input.url;
      if (url === "https://circle.com/.well-known/stellar.toml") {
        return new Response(
          `
          [[CURRENCIES]]
          code="USDC"
          issuer="GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN"
          image="http://cdn.circle.com/usdc.png"
          name="USD Coin"
        `,
          { status: 200 },
        );
      }
      return new Response("", { status: 404 });
    });

    const { GET } = await import("@/app/api/assets/core-registry/route");
    const response = await GET();
    const payload = await response.json();
    const usdc = payload.items.find((item: { id: string }) => item.id === "usdc");

    expect(usdc).toMatchObject({
      iconSource: "registry_png",
      tomlState: "invalid_icon",
      iconUrl: "/assets/core/usdc.png",
      iconProvenanceLabel: "Registry icon",
    });
  });
});
