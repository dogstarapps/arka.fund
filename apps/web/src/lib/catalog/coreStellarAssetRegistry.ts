import { NETWORK_PASSPHRASE } from "@/lib/config";
import type {
  CoreStellarAssetMetadata,
  CoreStellarAssetTomlState,
} from "./types";

export type CoreStellarAssetId =
  | "xlm"
  | "usdc"
  | "eurc"
  | "aqua"
  | "xtar"
  | "blnd"
  | "shx"
  | "xrf"
  | "velo"
  | "ybx";

export interface CoreStellarAssetDefinition {
  id: CoreStellarAssetId;
  label: string;
  symbol: string;
  kind: "native" | "classic";
  description: string;
  homeDomain: string | null;
  classicCode: string | null;
  classicIssuer: string | null;
  decimals: number;
  stablecoin: boolean;
  oracleFeedIds: string[];
  fallbackIconUrl: string;
  metadataContract: string | null;
  selectableContract: string | null;
  aliases: string[];
}

const TESTNET_PASSPHRASE = "Test SDF Network ; September 2015";
const TESTNET_NATIVE_XLM_CONTRACT =
  "CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC";
const PUBLIC_NATIVE_XLM_CONTRACT =
  "CAS3J7GYLGXMF6TDJBBYYSE3HQ6BBSMLNUQ34T6TZMYMW2EVH34XOWMA";

const RUNTIME_NATIVE_XLM_CONTRACT =
  process.env.NEXT_PUBLIC_XLM_ASSET_CONTRACT ??
  (NETWORK_PASSPHRASE === TESTNET_PASSPHRASE
    ? TESTNET_NATIVE_XLM_CONTRACT
    : PUBLIC_NATIVE_XLM_CONTRACT);

function runtimeAssetContract(symbol: string, testnetContract: string, publicContract: string): string {
  const envValue = process.env[`NEXT_PUBLIC_${symbol}_ASSET_CONTRACT`];
  if (envValue) return envValue;
  return NETWORK_PASSPHRASE === TESTNET_PASSPHRASE ? testnetContract : publicContract;
}

const PUBLIC_USDC_CONTRACT = "CCW67TSZV3SSS2HXMBQ5JFGCKJNXKZM7UQUWUZPUTHXSTZLEO7SJMI75";
const TESTNET_USDC_CONTRACT = "CA2E53VHFZ6YSWQIEIPBXJQGT6VW3VKWWZO555XKRQXYJ63GEBJJGHY7";
const PUBLIC_EURC_CONTRACT = "CDTKPWPLOURQA2SGTKTUQOWRCBZEORB4BWBOMJ3D3ZTQQSGE5F6JBQLV";
const TESTNET_EURC_CONTRACT = "CDX5MXVGC4MODCLWYSQKQXROK32QKK6VVFDSI7NMDIABJXTQXUXVF26G";
const PUBLIC_AQUA_CONTRACT = "CAUIKL3IYGMERDRUN6YSCLWVAKIFG5Q4YJHUKM4S4NJZQIA3BAS6OJPK";
const PUBLIC_XTAR_CONTRACT = "CDCKFBZYF2AQCSM3JOF2ZM27O3Y6AJAI4OTCQKAFNZ3FHBYUTFOKICIY";
const PUBLIC_BLND_CONTRACT = "CD25MNVTZDL4Y3XBCPCJXGXATV5WUHHOWMYFF4YBEGU5FCPGMYTVG5JY";
const PUBLIC_SHX_CONTRACT = "CCKCKCPHYVXQD4NECBFJTFSCU2AMSJGCNG4O6K4JVRE2BLPR7WNDBQIQ";
const TESTNET_SHX_CONTRACT = "CBJB2HDO54AUMZNDKLEZADJUDKDMQ4HA5X5ETVNG33JNKGYVAKFHCKJW";
const PUBLIC_XRF_CONTRACT = "CBLLEW7HD2RWATVSMLAGWM4G3WCHSHDJ25ALP4DI6LULV5TU35N2CIZA";
const TESTNET_XRF_CONTRACT = "CBULLEXCJPG2734I5V62IMZSCM3GOH3L55BHKNBIDRK2QIR5YH4SN6IJ";
const PUBLIC_VELO_CONTRACT = "CAESLMGW5LYTIEJI7FJHK6SFSWRELLNVX5Q4WR4UZEALMTRWQDBKDPAG";
const TESTNET_VELO_CONTRACT = "CDHI6B6HBY2Q7BVGQ74C23GN3TKPGLCCMOSSRTEQDTTX4ELO5V6A6IOM";
const PUBLIC_YBX_CONTRACT = "CBRP2VD3CZLEQIQZ4JMBXGA5AC2U6JE26YU5CCIOICIZCVWPGBO2QRUB";
const TESTNET_YBX_CONTRACT = "CBDTMENHHRW6PLA4KIWKTPHTB5OZNOVNAQENF4Q4WXPPSJDYWAJWIKRJ";

export const CORE_STELLAR_ASSET_REGISTRY: CoreStellarAssetDefinition[] = [
  {
    id: "xlm",
    label: "Stellar Lumens",
    symbol: "XLM",
    kind: "native",
    description: "Native Stellar asset available as an Arka asset for allocation, routing and protocol execution.",
    homeDomain: null,
    classicCode: "XLM",
    classicIssuer: null,
    decimals: 7,
    stablecoin: false,
    oracleFeedIds: ["reflector:native:XLM", "stellar:native:XLM"],
    fallbackIconUrl: "/assets/core/xlm.png",
    metadataContract: RUNTIME_NATIVE_XLM_CONTRACT || null,
    selectableContract: RUNTIME_NATIVE_XLM_CONTRACT || null,
    aliases: [
      "native",
      "xlm",
      PUBLIC_NATIVE_XLM_CONTRACT,
      TESTNET_NATIVE_XLM_CONTRACT,
    ],
  },
  {
    id: "usdc",
    label: "USD Coin",
    symbol: "USDC",
    kind: "classic",
    description: "Circle-issued dollar stablecoin on Stellar.",
    homeDomain: "circle.com",
    classicCode: "USDC",
    classicIssuer: "GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN",
    decimals: 7,
    stablecoin: true,
    oracleFeedIds: ["reflector:USDC", "circle:USDC"],
    fallbackIconUrl: "/assets/core/usdc.png",
    metadataContract: PUBLIC_USDC_CONTRACT,
    selectableContract: runtimeAssetContract("USDC", TESTNET_USDC_CONTRACT, PUBLIC_USDC_CONTRACT),
    aliases: [
      "usdc",
      "usd coin",
      "USDC:GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN",
      PUBLIC_USDC_CONTRACT,
      TESTNET_USDC_CONTRACT,
    ],
  },
  {
    id: "eurc",
    label: "Euro Coin",
    symbol: "EURC",
    kind: "classic",
    description: "Circle-issued euro stablecoin on Stellar for euro-denominated accounting and routing.",
    homeDomain: "circle.com",
    classicCode: "EURC",
    classicIssuer: "GDHU6WRG4IEQXM5NZ4BMPKOXHW76MZM4Y2IEMFDVXBSDP6SJY4ITNPP2",
    decimals: 7,
    stablecoin: true,
    oracleFeedIds: ["reflector:EURC", "circle:EURC"],
    fallbackIconUrl: "",
    metadataContract: PUBLIC_EURC_CONTRACT,
    selectableContract: runtimeAssetContract("EURC", TESTNET_EURC_CONTRACT, PUBLIC_EURC_CONTRACT),
    aliases: [
      "eurc",
      "euro coin",
      "EUROC",
      "EURC:GDHU6WRG4IEQXM5NZ4BMPKOXHW76MZM4Y2IEMFDVXBSDP6SJY4ITNPP2",
      PUBLIC_EURC_CONTRACT,
      TESTNET_EURC_CONTRACT,
    ],
  },
  {
    id: "aqua",
    label: "Aqua",
    symbol: "AQUA",
    kind: "classic",
    description: "Aquarius ecosystem token used across Stellar market making incentives.",
    homeDomain: "aqua.network",
    classicCode: "AQUA",
    classicIssuer: "GBNZILSTVQZ4R7IKQDGHYGY2QXL5QOFJYQMXPKWRRM5PAV7Y4M67AQUA",
    decimals: 7,
    stablecoin: false,
    oracleFeedIds: ["reflector:AQUA"],
    fallbackIconUrl: "/assets/core/aqua.png",
    metadataContract: PUBLIC_AQUA_CONTRACT,
    selectableContract: PUBLIC_AQUA_CONTRACT,
    aliases: ["aqua", PUBLIC_AQUA_CONTRACT],
  },
  {
    id: "xtar",
    label: "Dogstar",
    symbol: "XTAR",
    kind: "classic",
    description: "Dogstar token available for Arka selection and portfolio exposure.",
    homeDomain: "dogstarcoin.com",
    classicCode: "XTAR",
    classicIssuer: "GAORYJ3KBDGIM7FFSKVUJHJ5NEFWIRDIAGGBJBJS7TY6ECZS53257IG4",
    decimals: 7,
    stablecoin: false,
    oracleFeedIds: ["reflector:XTAR"],
    fallbackIconUrl: "/assets/core/xtar.png",
    metadataContract: PUBLIC_XTAR_CONTRACT,
    selectableContract: PUBLIC_XTAR_CONTRACT,
    aliases: ["xtar", "dogstar", PUBLIC_XTAR_CONTRACT],
  },
  {
    id: "blnd",
    label: "Blend",
    symbol: "BLND",
    kind: "classic",
    description: "Blend governance and protocol asset used across Stellar credit markets.",
    homeDomain: null,
    classicCode: "BLND",
    classicIssuer: "GDJEHTBE6ZHUXSWFI642DCGLUOECLHPF3KSXHPXTSTJ7E3JF6MQ5EZYY",
    decimals: 7,
    stablecoin: false,
    oracleFeedIds: ["reflector:BLND", "blend:BLND"],
    fallbackIconUrl: "/assets/core/blnd.png",
    metadataContract: PUBLIC_BLND_CONTRACT,
    selectableContract: PUBLIC_BLND_CONTRACT,
    aliases: [
      "blnd",
      "blend",
      "BLND:GDJEHTBE6ZHUXSWFI642DCGLUOECLHPF3KSXHPXTSTJ7E3JF6MQ5EZYY",
      PUBLIC_BLND_CONTRACT,
    ],
  },
  {
    id: "shx",
    label: "Stronghold SHx",
    symbol: "SHX",
    kind: "classic",
    description: "Stronghold ecosystem token issued on Stellar for payments, rewards and governance.",
    homeDomain: "stronghold.co",
    classicCode: "SHX",
    classicIssuer: "GDSTRSHXHGJ7ZIVRBXEYE5Q74XUVCUSEKEBR7UCHEUUEK72N7I7KJ6JH",
    decimals: 7,
    stablecoin: false,
    oracleFeedIds: ["reflector:SHX"],
    fallbackIconUrl: "",
    metadataContract: PUBLIC_SHX_CONTRACT,
    selectableContract: runtimeAssetContract("SHX", TESTNET_SHX_CONTRACT, PUBLIC_SHX_CONTRACT),
    aliases: [
      "shx",
      "stronghold",
      "stronghold shx",
      "SHX:GDSTRSHXHGJ7ZIVRBXEYE5Q74XUVCUSEKEBR7UCHEUUEK72N7I7KJ6JH",
      PUBLIC_SHX_CONTRACT,
      TESTNET_SHX_CONTRACT,
    ],
  },
  {
    id: "xrf",
    label: "Reflector",
    symbol: "XRF",
    kind: "classic",
    description: "Reflector DAO utility token for Stellar oracle network governance.",
    homeDomain: "reflector.network",
    classicCode: "XRF",
    classicIssuer: "GCHI6I3X62ND5XUMWINNNKXS2HPYZWKFQBZZYBSMHJ4MIP2XJXSZTXRF",
    decimals: 7,
    stablecoin: false,
    oracleFeedIds: ["reflector:XRF"],
    fallbackIconUrl: "",
    metadataContract: PUBLIC_XRF_CONTRACT,
    selectableContract: runtimeAssetContract("XRF", TESTNET_XRF_CONTRACT, PUBLIC_XRF_CONTRACT),
    aliases: [
      "xrf",
      "reflector",
      "reflector xrf",
      "XRF:GCHI6I3X62ND5XUMWINNNKXS2HPYZWKFQBZZYBSMHJ4MIP2XJXSZTXRF",
      PUBLIC_XRF_CONTRACT,
      TESTNET_XRF_CONTRACT,
    ],
  },
  {
    id: "velo",
    label: "Velo",
    symbol: "VELO",
    kind: "classic",
    description: "Velo Labs utility token used for digital credit issuance and settlement workflows.",
    homeDomain: "velo.org",
    classicCode: "VELO",
    classicIssuer: "GDM4RQUQQUVSKQA7S6EM7XBZP3FCGH4Q7CL6TABQ7B2BEJ5ERARM2M5M",
    decimals: 7,
    stablecoin: false,
    oracleFeedIds: ["reflector:VELO"],
    fallbackIconUrl: "",
    metadataContract: PUBLIC_VELO_CONTRACT,
    selectableContract: runtimeAssetContract("VELO", TESTNET_VELO_CONTRACT, PUBLIC_VELO_CONTRACT),
    aliases: [
      "velo",
      "velo labs",
      "VELO:GDM4RQUQQUVSKQA7S6EM7XBZP3FCGH4Q7CL6TABQ7B2BEJ5ERARM2M5M",
      PUBLIC_VELO_CONTRACT,
      TESTNET_VELO_CONTRACT,
    ],
  },
  {
    id: "ybx",
    label: "YieldBlox",
    symbol: "YBX",
    kind: "classic",
    description: "YieldBlox protocol utility token for lending, borrowing, collateral and governance.",
    homeDomain: null,
    classicCode: "YBX",
    classicIssuer: "GBUYYBXWCLT2MOSSHRFCKMEDFOVSCAXNIEW424GLN666OEXHAAWBDYMX",
    decimals: 7,
    stablecoin: false,
    oracleFeedIds: ["reflector:YBX", "yieldblox:YBX"],
    fallbackIconUrl: "",
    metadataContract: PUBLIC_YBX_CONTRACT,
    selectableContract: runtimeAssetContract("YBX", TESTNET_YBX_CONTRACT, PUBLIC_YBX_CONTRACT),
    aliases: [
      "ybx",
      "yieldblox",
      "YBX:GBUYYBXWCLT2MOSSHRFCKMEDFOVSCAXNIEW424GLN666OEXHAAWBDYMX",
      PUBLIC_YBX_CONTRACT,
      TESTNET_YBX_CONTRACT,
    ],
  },
];

function normalizeLookupValue(value: string): string {
  return value.trim().toLowerCase();
}

function buildLookupCandidates(entry: CoreStellarAssetDefinition): string[] {
  return [
    entry.id,
    entry.label,
    entry.symbol,
    entry.classicCode ?? "",
    entry.classicIssuer ? `${entry.classicCode}:${entry.classicIssuer}` : "",
    entry.metadataContract ?? "",
    entry.selectableContract ?? "",
    ...entry.aliases,
  ]
    .map((value) => value.trim())
    .filter(Boolean);
}

export function buildCoreStellarAssetTomlUrl(
  entry: Pick<CoreStellarAssetDefinition, "kind" | "homeDomain">,
): string | null {
  if (entry.kind !== "classic" || !entry.homeDomain) {
    return null;
  }
  return `https://${entry.homeDomain}/.well-known/stellar.toml`;
}

export function inferDefaultTomlState(
  entry: Pick<CoreStellarAssetDefinition, "kind" | "homeDomain">,
): CoreStellarAssetTomlState {
  if (entry.kind !== "classic") {
    return "not_applicable";
  }
  if (!entry.homeDomain) {
    return "missing_home_domain";
  }
  return "unreachable";
}

export function describeCoreAssetIconProvenance(
  iconSource: CoreStellarAssetMetadata["iconSource"],
  tomlState: CoreStellarAssetTomlState,
): string {
  if (iconSource === "stellar_toml" && tomlState === "resolved") {
    return "Verified icon";
  }
  if (iconSource === "symbol_glyph") {
    return "Symbol icon";
  }
  if (tomlState === "not_applicable") {
    return "Native asset icon";
  }
  if (tomlState === "missing_home_domain") {
    return "Registry icon";
  }
  if (tomlState === "asset_not_found") {
    return "Registry icon";
  }
  if (tomlState === "missing_icon") {
    return "Registry icon";
  }
  if (tomlState === "invalid_icon") {
    return "Registry icon";
  }
  return "Registry icon";
}

export function findCoreStellarAssetByLookup(
  value: string | null | undefined,
): CoreStellarAssetDefinition | null {
  if (!value) {
    return null;
  }
  const normalized = normalizeLookupValue(value);
  for (const entry of CORE_STELLAR_ASSET_REGISTRY) {
    if (
      buildLookupCandidates(entry).some(
        (candidate) => normalizeLookupValue(candidate) === normalized,
      )
    ) {
      return entry;
    }
  }
  return null;
}

export function findCoreStellarAssetByContract(
  contract: string | null | undefined,
): CoreStellarAssetDefinition | null {
  return findCoreStellarAssetByLookup(contract);
}

export function findCoreStellarAssetById(
  id: CoreStellarAssetId | string | null | undefined,
): CoreStellarAssetDefinition | null {
  return findCoreStellarAssetByLookup(id);
}

export function buildCoreStellarAssetMetadata(
  entry: CoreStellarAssetDefinition,
): CoreStellarAssetMetadata {
  const tomlState = inferDefaultTomlState(entry);
  const iconSource = entry.fallbackIconUrl ? "registry_png" : "symbol_glyph";
  return {
    id: entry.id,
    label: entry.label,
    symbol: entry.symbol,
    kind: entry.kind,
    description: entry.description,
    homeDomain: entry.homeDomain,
    classicCode: entry.classicCode,
    classicIssuer: entry.classicIssuer,
    decimals: entry.decimals,
    stablecoin: entry.stablecoin,
    oracleFeedIds: entry.oracleFeedIds,
    metadataContract: entry.metadataContract,
    selectableContract: entry.selectableContract,
    iconUrl: entry.fallbackIconUrl,
    fallbackIconUrl: entry.fallbackIconUrl,
    iconSource,
    tomlState,
    tomlUrl: buildCoreStellarAssetTomlUrl(entry),
    iconProvenanceLabel: describeCoreAssetIconProvenance(iconSource, tomlState),
    lookupKeys: buildLookupCandidates(entry),
  };
}

export function indexCoreAssetMetadata(
  items: CoreStellarAssetMetadata[],
): Record<string, CoreStellarAssetMetadata> {
  const lookup: Record<string, CoreStellarAssetMetadata> = {};
  for (const item of items) {
    const keys = [
      item.id,
      item.symbol,
      item.label,
      item.metadataContract ?? "",
      item.selectableContract ?? "",
      ...item.lookupKeys,
    ];
    for (const key of keys) {
      const trimmed = key.trim();
      if (!trimmed) continue;
      lookup[normalizeLookupValue(trimmed)] = item;
    }
  }
  return lookup;
}

export function lookupCoreAssetMetadata(
  lookup: Record<string, CoreStellarAssetMetadata>,
  value: string | null | undefined,
): CoreStellarAssetMetadata | null {
  if (!value) {
    return null;
  }
  return lookup[normalizeLookupValue(value)] ?? null;
}
