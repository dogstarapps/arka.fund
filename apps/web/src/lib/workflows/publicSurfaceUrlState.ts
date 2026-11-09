import type {
  DashboardFeaturedMode,
  DashboardStageRange,
  DiscoverFeaturedMode,
} from "@/lib/catalog/dashboardDiscoverSurfaces";
import type {
  AssetSpotlightMode,
  ManagerSpotlightMode,
} from "@/lib/catalog/explorerSurfaces";
import type {
  ManagerSortMetric,
  ManagerSortOrder,
  VaultSortMetric,
  VaultSortOrder,
} from "@/lib/catalog/types";
import type { VaultLeaderboardWindow } from "@/lib/catalog/vaults";
import {
  resolveDashboardSectionId,
  type DashboardSectionId,
} from "@/lib/catalog/dashboardSections";
import {
  resolveDiscoverSectionId,
  type DiscoverSectionId,
} from "@/lib/catalog/discoverSections";

export type DashboardStageMode = "portfolio" | "activity" | "capital";
export type VaultFeaturedMode = "ranked" | "profit" | "volume";

export interface DashboardUrlState {
  stage: DashboardStageMode;
  range: DashboardStageRange;
  feature: DashboardFeaturedMode;
  section: DashboardSectionId;
}

export interface DiscoverUrlState {
  search: string;
  curatedOnly: boolean;
  feature: DiscoverFeaturedMode;
  section: DiscoverSectionId;
}

export interface VaultsUrlState {
  search: string;
  curatedOnly: boolean;
  sortMetric: VaultSortMetric;
  sortOrder: VaultSortOrder;
  feature: VaultFeaturedMode;
  window: VaultLeaderboardWindow;
}

export interface AssetsUrlState {
  search: string;
  spotlight: AssetSpotlightMode;
}

export interface ManagersUrlState {
  search: string;
  spotlight: ManagerSpotlightMode;
  sortMetric: ManagerSortMetric;
  sortOrder: ManagerSortOrder;
}

export type ProductQueryValue = string | boolean | null | undefined;

const DASHBOARD_STAGE_MODES = new Set<DashboardStageMode>([
  "portfolio",
  "activity",
  "capital",
]);
const DASHBOARD_RANGES = new Set<DashboardStageRange>([
  "1d",
  "1w",
  "6m",
  "1y",
  "all",
]);
const DASHBOARD_FEATURES = new Set<DashboardFeaturedMode>([
  "ranked",
  "curated",
  "fresh",
  "mine",
]);
const DISCOVER_FEATURES = new Set<DiscoverFeaturedMode>([
  "ranked",
  "profit",
  "search",
  "fresh",
]);
const VAULT_SORT_METRICS = new Set<VaultSortMetric>([
  "rank",
  "nav",
  "profit",
  "volume",
]);
const VAULT_SORT_ORDERS = new Set<VaultSortOrder>(["asc", "desc"]);
const VAULT_FEATURES = new Set<VaultFeaturedMode>([
  "ranked",
  "profit",
  "volume",
]);
const VAULT_WINDOWS = new Set<VaultLeaderboardWindow>([
  "latest",
  "7d",
  "30d",
  "all",
]);
const ASSET_SPOTLIGHT_ALIASES: Record<string, AssetSpotlightMode> = {
  core: "core",
  balancesheet: "balanceSheet",
  "balance-sheet": "balanceSheet",
  search: "search",
};
const MANAGER_SPOTLIGHTS = new Set<ManagerSpotlightMode>([
  "lead",
  "curated",
  "search",
]);
const MANAGER_SORT_METRICS = new Set<ManagerSortMetric>([
  "rank",
  "nav",
  "arkas",
  "curated",
]);
const MANAGER_SORT_ORDERS = new Set<ManagerSortOrder>(["asc", "desc"]);

function firstParam(
  params: URLSearchParams | Record<string, string | string[] | undefined>,
  key: string,
): string | null {
  if (params instanceof URLSearchParams) {
    return params.get(key);
  }

  const value = params[key];
  if (Array.isArray(value)) {
    return value[0] ?? null;
  }
  return value ?? null;
}

function normalizedLowerParam(
  params: URLSearchParams | Record<string, string | string[] | undefined>,
  key: string,
): string | null {
  const value = firstParam(params, key);
  const normalized = value?.trim().toLowerCase();
  return normalized ? normalized : null;
}

function normalizedSearchParam(
  params: URLSearchParams | Record<string, string | string[] | undefined>,
  key: string,
): string {
  return firstParam(params, key)?.trim() ?? "";
}

function normalizeFromSet<T extends string>(
  value: string | null,
  allowed: Set<T>,
  fallback: T,
): T {
  return value && allowed.has(value as T) ? (value as T) : fallback;
}

function normalizeAssetSpotlightParam(value: string | null): AssetSpotlightMode {
  return value ? (ASSET_SPOTLIGHT_ALIASES[value] ?? "core") : "core";
}

export function normalizeBooleanQueryParam(
  value: string | null | undefined,
  fallback: boolean,
): boolean {
  const normalized = value?.trim().toLowerCase();
  if (!normalized) return fallback;
  if (["1", "true", "yes", "on"].includes(normalized)) return true;
  if (["0", "false", "no", "off"].includes(normalized)) return false;
  return fallback;
}

export function normalizeDashboardUrlState(
  params: URLSearchParams | Record<string, string | string[] | undefined>,
): DashboardUrlState {
  return {
    stage: normalizeFromSet(
      normalizedLowerParam(params, "stage"),
      DASHBOARD_STAGE_MODES,
      "portfolio",
    ),
    range: normalizeFromSet(
      normalizedLowerParam(params, "range"),
      DASHBOARD_RANGES,
      "all",
    ),
    feature: normalizeFromSet(
      normalizedLowerParam(params, "feature"),
      DASHBOARD_FEATURES,
      "fresh",
    ),
    section: resolveDashboardSectionId(
      normalizedLowerParam(params, "section"),
      "arkas",
    ),
  };
}

export function normalizeDiscoverUrlState(
  params: URLSearchParams | Record<string, string | string[] | undefined>,
): DiscoverUrlState {
  return {
    search: normalizedSearchParam(params, "q"),
    curatedOnly: normalizeBooleanQueryParam(firstParam(params, "curated"), false),
    feature: normalizeFromSet(
      normalizedLowerParam(params, "feature"),
      DISCOVER_FEATURES,
      "ranked",
    ),
    section: resolveDiscoverSectionId(
      normalizedLowerParam(params, "section"),
      "arkas",
    ),
  };
}

export function normalizeVaultsUrlState(
  params: URLSearchParams | Record<string, string | string[] | undefined>,
): VaultsUrlState {
  const sortMetric = normalizeFromSet(
    normalizedLowerParam(params, "sort"),
    VAULT_SORT_METRICS,
    "rank",
  );
  return {
    search: normalizedSearchParam(params, "q"),
    curatedOnly: normalizeBooleanQueryParam(firstParam(params, "curated"), false),
    sortMetric,
    sortOrder: normalizeFromSet(
      normalizedLowerParam(params, "order"),
      VAULT_SORT_ORDERS,
      sortMetric === "rank" ? "asc" : "desc",
    ),
    feature: normalizeFromSet(
      normalizedLowerParam(params, "feature"),
      VAULT_FEATURES,
      "ranked",
    ),
    window: normalizeFromSet(
      normalizedLowerParam(params, "window"),
      VAULT_WINDOWS,
      "all",
    ),
  };
}

export function normalizeAssetsUrlState(
  params: URLSearchParams | Record<string, string | string[] | undefined>,
): AssetsUrlState {
  return {
    search: normalizedSearchParam(params, "q"),
    spotlight: normalizeAssetSpotlightParam(
      normalizedLowerParam(params, "spotlight"),
    ),
  };
}

export function normalizeManagersUrlState(
  params: URLSearchParams | Record<string, string | string[] | undefined>,
): ManagersUrlState {
  const sortMetric = normalizeFromSet(
    normalizedLowerParam(params, "sort"),
    MANAGER_SORT_METRICS,
    "rank",
  );
  return {
    search: normalizedSearchParam(params, "q"),
    spotlight: normalizeFromSet(
      normalizedLowerParam(params, "spotlight"),
      MANAGER_SPOTLIGHTS,
      "lead",
    ),
    sortMetric,
    sortOrder: normalizeFromSet(
      normalizedLowerParam(params, "order"),
      MANAGER_SORT_ORDERS,
      sortMetric === "rank" ? "asc" : "desc",
    ),
  };
}

export function replaceBrowserQueryState(
  values: Record<string, ProductQueryValue>,
): void {
  if (typeof window === "undefined") return;

  const nextUrl = applyProductQueryValuesToHref(window.location.href, values);
  const currentUrl = `${window.location.pathname}${window.location.search}${window.location.hash}`;
  if (nextUrl !== currentUrl) {
    window.history.replaceState(window.history.state, "", nextUrl);
  }
}

export function applyProductQueryValuesToHref(
  href: string,
  values: Record<string, ProductQueryValue>,
): string {
  const url = new URL(href, "https://arka.local");
  for (const [key, value] of Object.entries(values)) {
    if (value === null || value === undefined || value === "") {
      url.searchParams.delete(key);
      continue;
    }
    url.searchParams.set(key, String(value));
  }

  return `${url.pathname}${url.search}${url.hash}`;
}
