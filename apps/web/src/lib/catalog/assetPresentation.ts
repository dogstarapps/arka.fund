import {
  DENOMINATION,
  DENOMINATION_LABEL,
  ROUTING_ASSET_A,
  ROUTING_ASSET_A_LABEL,
  ROUTING_ASSET_B,
  ROUTING_ASSET_B_LABEL,
} from "@/lib/config";
import { findCoreStellarAssetByContract, findCoreStellarAssetByLookup } from "./coreStellarAssetRegistry";

export type AssetPresentationSource = "known_alias" | "glyph_fallback";

export interface AssetPresentation {
  contract: string | null;
  label: string;
  symbol: string;
  source: AssetPresentationSource;
}

function normalizeTokenLabel(value: string): string {
  return value.replace(/[^A-Za-z0-9]/g, "").toUpperCase();
}

function formatUnknownAssetLabel(contract: string): string {
  const trimmed = contract.trim();
  if (trimmed.length <= 20) return `Asset ${trimmed}`;
  return `Asset ${trimmed.slice(0, 8)}...${trimmed.slice(-5)}`;
}

function meaningfulConfiguredLabel(value: string | null | undefined): string | null {
  const label = value?.trim();
  if (!label) return null;
  if (/^(input asset|output asset|routing asset [ab]|token_in|token_out)$/i.test(label)) {
    return null;
  }
  return label;
}

function inferKnownAssetLabel(contract: string): string | null {
  const registryEntry = findCoreStellarAssetByContract(contract);
  if (registryEntry) return registryEntry.symbol;
  if (contract === DENOMINATION) return meaningfulConfiguredLabel(DENOMINATION_LABEL);
  if (contract === ROUTING_ASSET_A) return meaningfulConfiguredLabel(ROUTING_ASSET_A_LABEL);
  if (contract === ROUTING_ASSET_B) return meaningfulConfiguredLabel(ROUTING_ASSET_B_LABEL);
  if (/USDC/i.test(contract)) return "USDC";
  if (/EURC|EUROC/i.test(contract)) return "EURC";
  if (/XLM/i.test(contract)) return "XLM";
  if (/BLND|BLEND/i.test(contract)) return "BLND";
  if (/SHX|STRONGHOLD/i.test(contract)) return "SHX";
  if (/XRF|REFLECTOR/i.test(contract)) return "XRF";
  if (/VELO/i.test(contract)) return "VELO";
  if (/YBX|YIELDBLOX/i.test(contract)) return "YBX";
  if (/BTC/i.test(contract)) return "BTC";
  if (/ETH/i.test(contract)) return "ETH";
  return null;
}

export function resolveAssetPresentation(
  contract: string | null | undefined,
): AssetPresentation {
  if (!contract) {
    return {
      contract: null,
      label: "Unassigned",
      symbol: "AST",
      source: "glyph_fallback",
    };
  }

  const registryEntry = findCoreStellarAssetByLookup(contract);
  const inferredLabel = inferKnownAssetLabel(contract);
  const label =
    registryEntry?.symbol ??
    inferredLabel ??
    formatUnknownAssetLabel(contract);
  const normalized = normalizeTokenLabel(label);
  let symbol = normalized.slice(0, Math.min(4, normalized.length));
  if (!symbol) {
    symbol = "AST";
  }
  if (/USDC/.test(normalized)) symbol = "USDC";
  if (/EURC|EUROC/.test(normalized)) symbol = "EURC";
  if (/BLND|BLEND/.test(normalized)) symbol = "BLND";
  if (/XLM/.test(normalized)) symbol = "XLM";
  if (/SHX|STRONGHOLD/.test(normalized)) symbol = "SHX";
  if (/XRF|REFLECTOR/.test(normalized)) symbol = "XRF";
  if (/VELO/.test(normalized)) symbol = "VELO";
  if (/YBX|YIELDBLOX/.test(normalized)) symbol = "YBX";
  if (/BTC/.test(normalized)) symbol = "BTC";
  if (/ETH/.test(normalized)) symbol = "ETH";

  return {
    contract,
    label,
    symbol,
    source: registryEntry || inferredLabel ? "known_alias" : "glyph_fallback",
  };
}

export function resolveAssetDisplayLabel(contract: string | null | undefined): string {
  return resolveAssetPresentation(contract).label;
}

export function resolveAssetGlyphText(contract: string | null | undefined): string {
  return resolveAssetPresentation(contract).symbol;
}

export function resolveAssetGlyphHue(contract: string | null | undefined): number {
  const source = contract ?? "asset";
  let hash = 0;
  for (const char of source) {
    hash = (hash * 33 + char.charCodeAt(0)) % 360;
  }
  return (hash + 360) % 360;
}
