import { findCoreStellarAssetByLookup } from "@/lib/catalog/coreStellarAssetRegistry";

export type GlobalSearchIntent =
  | "empty"
  | "product_route"
  | "vault_detail"
  | "vault_execution"
  | "asset_detail"
  | "manager_detail"
  | "discover";

export interface GlobalSearchTarget {
  href: string;
  intent: GlobalSearchIntent;
  query: string;
}

const PRODUCT_ROUTE_ALIASES: Record<string, string> = {
  arka: "/vaults",
  arkas: "/vaults",
  assets: "/assets",
  asset: "/assets",
  contracts: "/contracts",
  console: "/contracts",
  coverage: "/coverage",
  create: "/factory/create",
  dao: "/governance",
  dashboard: "/dashboard",
  discover: "/discover",
  governance: "/governance",
  integrations: "/integrations",
  managers: "/managers",
  manager: "/managers",
  migrations: "/migrations",
  ops: "/ops",
  settings: "/settings",
  status: "/status",
  tiers: "/tiers",
  vault: "/vaults",
  vaults: "/vaults",
};

const PREFIX_ALIASES: Record<string, "vault" | "ops" | "asset" | "manager"> = {
  arka: "vault",
  execute: "ops",
  manager: "manager",
  ops: "ops",
  rebalance: "ops",
  token: "asset",
  asset: "asset",
  vault: "vault",
};

function normalizeToken(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

function encodePathSegment(value: string): string {
  return encodeURIComponent(value.trim());
}

function buildDiscoverTarget(query: string): GlobalSearchTarget {
  return {
    href: query ? `/discover?q=${encodeURIComponent(query)}` : "/discover",
    intent: query ? "discover" : "empty",
    query,
  };
}

function looksLikeContractId(value: string): boolean {
  return /^C[A-Z0-9]{8,}$/.test(value.trim().toUpperCase());
}

function looksLikeManagerAccount(value: string): boolean {
  return /^G[A-Z0-9]{8,}$/.test(value.trim().toUpperCase());
}

function resolveAssetDetailTarget(value: string): GlobalSearchTarget | null {
  const query = value.trim();
  const coreAsset = findCoreStellarAssetByLookup(query);
  const assetContract =
    coreAsset?.selectableContract ?? coreAsset?.metadataContract ?? null;

  if (assetContract) {
    return {
      href: `/assets/${encodePathSegment(assetContract)}`,
      intent: "asset_detail",
      query,
    };
  }

  if (looksLikeContractId(query)) {
    return {
      href: `/assets/${encodePathSegment(query.toUpperCase())}`,
      intent: "asset_detail",
      query,
    };
  }

  return null;
}

function resolvePrefixedSearchTarget(prefix: string, value: string): GlobalSearchTarget | null {
  const kind = PREFIX_ALIASES[normalizeToken(prefix)];
  const query = value.trim();
  if (!kind || !query) return null;

  if (kind === "asset") {
    return resolveAssetDetailTarget(query);
  }

  if (kind === "manager" && looksLikeManagerAccount(query)) {
    return {
      href: `/managers/${encodePathSegment(query.toUpperCase())}`,
      intent: "manager_detail",
      query,
    };
  }

  if (kind === "vault" && looksLikeContractId(query)) {
    return {
      href: `/vaults/${encodePathSegment(query.toUpperCase())}`,
      intent: "vault_detail",
      query,
    };
  }

  if (kind === "ops" && looksLikeContractId(query)) {
    return {
      href: `/arkas/${encodePathSegment(query.toUpperCase())}`,
      intent: "vault_execution",
      query,
    };
  }

  return null;
}

export function resolveGlobalSearchTarget(rawValue: string): GlobalSearchTarget {
  const query = rawValue.trim();
  if (!query) return buildDiscoverTarget("");

  const prefixMatch = query.match(/^([a-zA-Z][a-zA-Z -]{1,24}):(.+)$/);
  if (prefixMatch) {
    const prefixedTarget = resolvePrefixedSearchTarget(prefixMatch[1] ?? "", prefixMatch[2] ?? "");
    if (prefixedTarget) return prefixedTarget;
  }

  const normalized = normalizeToken(query);
  const route = PRODUCT_ROUTE_ALIASES[normalized];
  if (route) {
    return {
      href: route,
      intent: "product_route",
      query,
    };
  }

  const coreAssetTarget = resolveAssetDetailTarget(query);
  if (coreAssetTarget) return coreAssetTarget;

  if (looksLikeManagerAccount(query)) {
    return {
      href: `/managers/${encodePathSegment(query.toUpperCase())}`,
      intent: "manager_detail",
      query,
    };
  }

  if (looksLikeContractId(query)) {
    return {
      href: `/vaults/${encodePathSegment(query.toUpperCase())}`,
      intent: "vault_detail",
      query,
    };
  }

  return buildDiscoverTarget(query);
}
