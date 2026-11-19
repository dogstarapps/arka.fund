import {
  CORE_STELLAR_ASSET_REGISTRY,
  buildCoreStellarAssetTomlUrl,
  describeCoreAssetIconProvenance,
  inferDefaultTomlState,
  type CoreStellarAssetDefinition,
} from "@/lib/catalog/coreStellarAssetRegistry";
import type {
  CoreStellarAssetIconSource,
  CoreStellarAssetMetadata,
  CoreStellarAssetTomlState,
} from "@/lib/catalog/types";

interface ParsedTomlCurrency {
  code: string | null;
  issuer: string | null;
  image: string | null;
  name: string | null;
}

const MAX_TOML_BYTES = 256 * 1024;
async function readBoundedToml(response: Response): Promise<string> {
  const declared = Number(response.headers.get("content-length"));
  if (declared > MAX_TOML_BYTES) {
    await response.body?.cancel();
    throw new Error("TOML_BODY_TOO_LARGE");
  }
  if (!response.body) throw new Error("TOML_BODY_MISSING");
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let length = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      length += value.byteLength;
      if (length > MAX_TOML_BYTES) {
        await reader.cancel();
        throw new Error("TOML_BODY_TOO_LARGE");
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const body = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) { body.set(chunk, offset); offset += chunk.byteLength; }
  return new TextDecoder().decode(body);
}

const CACHE_TTL_MS = 30 * 60 * 1000;
const tomlMetadataCache = new Map<
  string,
  { expiresAt: number; value: CoreStellarAssetMetadata }
>();

interface TomlResolution {
  iconUrl: string | null;
  name: string | null;
  state: CoreStellarAssetTomlState;
  tomlUrl: string | null;
}

function stripTomlQuotes(value: string): string {
  return value.replace(/^['"]|['"]$/g, "").trim();
}

export function parseCurrencies(toml: string): ParsedTomlCurrency[] {
  const blocks = toml.split(/\[\[CURRENCIES\]\]/g).slice(1);
  return blocks.map((block) => {
    const parsed: ParsedTomlCurrency = {
      code: null,
      issuer: null,
      image: null,
      name: null,
    };
    for (const rawLine of block.split(/\r?\n/)) {
      const line = rawLine.trim();
      if (!line || line.startsWith("#")) continue;
      if (line.startsWith("[[")) break;
      if (line.startsWith("[")) break;
      const match = line.match(/^([A-Za-z0-9_]+)\s*=\s*(.+)$/);
      if (!match) continue;
      const [, rawKey, rawValue] = match;
      const key = rawKey.toLowerCase();
      const value = stripTomlQuotes(rawValue.split("#")[0] ?? rawValue);
      if (key === "code") parsed.code = value;
      if (key === "issuer") parsed.issuer = value;
      if (key === "image") parsed.image = value;
      if (key === "name") parsed.name = value;
    }
    return parsed;
  });
}

export function isTrustedTomlIconUrl(value: string | null): boolean {
  if (!value) return false;
  try {
    const parsed = new URL(value);
    if (parsed.protocol !== "https:") return false;
    const pathname = parsed.pathname.toLowerCase();
    return /\.(png|jpe?g|svg|webp|gif)$/.test(pathname);
  } catch {
    return false;
  }
}

async function fetchClassicAssetTomlImage(
  entry: CoreStellarAssetDefinition,
): Promise<TomlResolution> {
  const tomlUrl = buildCoreStellarAssetTomlUrl(entry);
  if (!entry.homeDomain || !entry.classicCode) {
    return {
      iconUrl: null,
      name: null,
      state: inferDefaultTomlState(entry),
      tomlUrl,
    };
  }

  try {
    const requestTomlUrl = tomlUrl ?? `https://${entry.homeDomain}/.well-known/stellar.toml`;
    const response = await fetch(requestTomlUrl, {
      headers: {
        accept: "text/plain, text/*, */*",
      },
      redirect: "error",
      signal: AbortSignal.timeout(6000),
      cache: "no-store",
    });
    if (!response.ok) {
      return { iconUrl: null, name: null, state: "unreachable", tomlUrl };
    }

    const body = await readBoundedToml(response);
    const currencies = parseCurrencies(body);
    const matched = currencies.find((currency) => {
      if ((currency.code ?? "").toUpperCase() !== entry.classicCode?.toUpperCase()) {
        return false;
      }
      if (!entry.classicIssuer) {
        return true;
      }
      return (currency.issuer ?? "").toUpperCase() === entry.classicIssuer.toUpperCase();
    });

    if (!matched) {
      return { iconUrl: null, name: null, state: "asset_not_found", tomlUrl };
    }
    if (!matched.image) {
      return { iconUrl: null, name: matched.name ?? null, state: "missing_icon", tomlUrl };
    }
    if (!isTrustedTomlIconUrl(matched.image)) {
      return { iconUrl: null, name: matched.name ?? null, state: "invalid_icon", tomlUrl };
    }

    return {
      iconUrl: matched.image,
      name: matched.name ?? null,
      state: "resolved",
      tomlUrl,
    };
  } catch {
    return { iconUrl: null, name: null, state: "unreachable", tomlUrl };
  }
}

function normalizeLookupKeys(entry: CoreStellarAssetDefinition): string[] {
  return [
    entry.id,
    entry.symbol,
    entry.label,
    entry.metadataContract ?? "",
    entry.selectableContract ?? "",
    ...entry.aliases,
  ]
    .map((value) => value.trim())
    .filter(Boolean);
}

export async function resolveCoreStellarAssetMetadata(
  entry: CoreStellarAssetDefinition,
): Promise<CoreStellarAssetMetadata> {
  const cacheKey = entry.id;
  const cached = tomlMetadataCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.value;
  }

  const tomlResolved = await fetchClassicAssetTomlImage(entry);
  const label = tomlResolved.name?.trim() || entry.label;
  const iconSource: CoreStellarAssetIconSource =
    tomlResolved.state === "resolved" && tomlResolved.iconUrl
      ? "stellar_toml"
      : entry.fallbackIconUrl
        ? "registry_png"
        : "symbol_glyph";
  const value: CoreStellarAssetMetadata = {
    id: entry.id,
    label,
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
    iconUrl: iconSource === "stellar_toml" ? tomlResolved.iconUrl! : entry.fallbackIconUrl,
    fallbackIconUrl: entry.fallbackIconUrl,
    iconSource,
    tomlState: tomlResolved.state,
    tomlUrl: tomlResolved.tomlUrl,
    iconProvenanceLabel: describeCoreAssetIconProvenance(iconSource, tomlResolved.state),
    lookupKeys: normalizeLookupKeys(entry),
  };

  tomlMetadataCache.set(cacheKey, {
    expiresAt: Date.now() + CACHE_TTL_MS,
    value,
  });
  return value;
}

export async function loadCoreStellarAssetMetadata(): Promise<CoreStellarAssetMetadata[]> {
  return Promise.all(CORE_STELLAR_ASSET_REGISTRY.map(resolveCoreStellarAssetMetadata));
}
