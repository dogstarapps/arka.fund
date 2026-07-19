import type { CatalogAssetIdentity } from "./types.js";

const MAINNET_ASSETS: readonly CatalogAssetIdentity[] = [
  asset("CCW67TSZV3SSS2HXMBQ5JFGCKJNXKZM7UQUWUZPUTHXSTZLEO7SJMI75", "USDC", "USD Coin", true),
  asset("CAS3J7GYLGXMF6TDJBBYYSE3HQ6BBSMLNUQ34T6TZMYMW2EVH34XOWMA", "XLM", "Stellar Lumens"),
  asset("CDTKPWPLOURQA2SGTKTUQOWRCBZEORB4BWBOMJ3D3ZTQQSGE5F6JBQLV", "EURC", "Euro Coin"),
  asset("CAUIKL3IYGMERDRUN6YSCLWVAKIFG5Q4YJHUKM4S4NJZQIA3BAS6OJPK", "AQUA", "Aquarius"),
  asset("CDCKFBZYF2AQCSM3JOF2ZM27O3Y6AJAI4OTCQKAFNZ3FHBYUTFOKICIY", "XTAR", "Dogstar Token"),
  asset("CD25MNVTZDL4Y3XBCPCJXGXATV5WUHHOWMYFF4YBEGU5FCPGMYTVG5JY", "BLND", "Blend"),
  asset("CCKCKCPHYVXQD4NECBFJTFSCU2AMSJGCNG4O6K4JVRE2BLPR7WNDBQIQ", "SHX", "Stronghold"),
  asset("CBLLEW7HD2RWATVSMLAGWM4G3WCHSHDJ25ALP4DI6LULV5TU35N2CIZA", "XRF", "Reflector"),
  asset("CAESLMGW5LYTIEJI7FJHK6SFSWRELLNVX5Q4WR4UZEALMTRWQDBKDPAG", "VELO", "Velo"),
  asset("CBRP2VD3CZLEQIQZ4JMBXGA5AC2U6JE26YU5CCIOICIZCVWPGBO2QRUB", "YBX", "YieldBlox"),
];

const MAINNET_ASSET_MAP = new Map(
  MAINNET_ASSETS.map((entry) => [entry.contract, entry]),
);

export function mainnetAssetIdentities(): CatalogAssetIdentity[] {
  return MAINNET_ASSETS.map((entry) => ({ ...entry }));
}

export function findMainnetAsset(contract: string): CatalogAssetIdentity | null {
  const entry = MAINNET_ASSET_MAP.get(contract.trim().toUpperCase());
  return entry ? { ...entry } : null;
}

function asset(
  contract: string,
  symbol: string,
  label: string,
  usdPegged = false,
): CatalogAssetIdentity {
  return { contract, symbol, label, decimals: 7, usdPegged };
}
