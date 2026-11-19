import { describe, expect, it } from "vitest";
import {
  buildExecutionAssetOptions,
  getExecutionAssetOption,
  resolveDistinctExecutionAsset,
  summarizeExecutionAssetUniverse,
} from "@/lib/workflows/assetSelection";
import { CORE_STELLAR_ASSET_REGISTRY } from "@/lib/catalog/coreStellarAssetRegistry";

const USDC_CONTRACT = "CCW67TSZV3SSS2HXMBQ5JFGCKJNXKZM7UQUWUZPUTHXSTZLEO7SJMI75";
const BLND_CONTRACT = "CD25MNVTZDL4Y3XBCPCJXGXATV5WUHHOWMYFF4YBEGU5FCPGMYTVG5JY";
const UNKNOWN_CONTRACT = "CUNKNOWNASSET7777777777777777777777777777777777777777777777";

describe("execution asset selection", () => {
  it("deduplicates vault contracts and enriches core Stellar assets", () => {
    const options = buildExecutionAssetOptions({
      contracts: [UNKNOWN_CONTRACT, USDC_CONTRACT, BLND_CONTRACT, USDC_CONTRACT],
      walletBalances: {
        [USDC_CONTRACT]: 12_500_000,
        [UNKNOWN_CONTRACT]: 0,
      },
      vaultBalances: {
        [USDC_CONTRACT]: 30_000_000,
        [BLND_CONTRACT]: 8_000_000,
      },
    });

    expect(options).toHaveLength(3);
    expect(options.map((option) => option.label)).toEqual([
      "USDC",
      "BLND",
      expect.stringMatching(/^Asset CUNKNOWN/i),
    ]);
    expect(options[0]).toMatchObject({
      source: "core_registry",
      kind: "classic",
      walletBalanceLabel: "1.2500000",
      vaultBalanceLabel: "3.0000000",
      selectableForWallet: true,
      selectableForVault: true,
    });
    expect(options[1]).toMatchObject({
      label: "BLND",
      source: "core_registry",
      selectableForWallet: false,
      selectableForVault: true,
    });
    expect(options[2]).toMatchObject({
      source: "vault_contract",
      kind: "contract",
      selectableForWallet: false,
    });
  });

  it("summarizes and resolves selected execution assets without inventing routes", () => {
    const options = buildExecutionAssetOptions({
      contracts: [USDC_CONTRACT, BLND_CONTRACT, UNKNOWN_CONTRACT],
      walletBalances: {
        [USDC_CONTRACT]: 1,
        [BLND_CONTRACT]: 1,
      },
      vaultBalances: {
        [UNKNOWN_CONTRACT]: 1,
      },
    });
    const summary = summarizeExecutionAssetUniverse(options);

    expect(summary).toMatchObject({
      totalAssets: 3,
      coreAssets: 2,
      walletFundedAssets: 2,
      vaultFundedAssets: 1,
    });
    expect(summary.routeAssetLabels).toEqual([
      "USDC",
      "BLND",
      expect.stringMatching(/^Asset CUNKNOWN/i),
    ]);
    expect(getExecutionAssetOption(options, BLND_CONTRACT)?.label).toBe("BLND");
    expect(resolveDistinctExecutionAsset(options, USDC_CONTRACT)).toBe(BLND_CONTRACT);
  });

  it("exposes every required core Stellar asset as a real selectable execution option", () => {
    const requiredSymbols = [
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
    ];
    expect(CORE_STELLAR_ASSET_REGISTRY.map((asset) => asset.symbol)).toEqual(
      requiredSymbols,
    );
    const xlmContract = CORE_STELLAR_ASSET_REGISTRY.find(
      (asset) => asset.symbol === "XLM",
    )?.selectableContract;
    expect(xlmContract).toBeTruthy();

    const options = buildExecutionAssetOptions({
      contracts: CORE_STELLAR_ASSET_REGISTRY.map(
        (asset) => asset.selectableContract!,
      ),
      walletBalances: {
        [xlmContract!]: 10_000_000,
      },
      vaultBalances: {},
    });

    expect(options.map((option) => option.label)).toEqual(requiredSymbols);
    expect(options.every((option) => option.source === "core_registry")).toBe(true);
    expect(getExecutionAssetOption(options, xlmContract!)).toMatchObject({
      label: "XLM",
      kind: "native",
      selectableForWallet: true,
    });
  });
});
