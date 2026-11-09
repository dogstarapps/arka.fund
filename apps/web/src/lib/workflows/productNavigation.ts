export type ProductNavGroup = "primary" | "utility";
export type ProductAccessTier = "public" | "operator";

export interface ProductNavItem {
  href: string;
  label: string;
  icon:
    | "discover"
    | "vaults"
    | "governance"
    | "assets"
    | "managers"
    | "integrations"
    | "dashboard"
    | "create"
    | "coverage"
    | "ops"
    | "settings"
    | "status"
    | "tiers"
    | "contracts"
    | "migrations";
  group: ProductNavGroup;
  access: ProductAccessTier;
}

export const CREATE_ARKA_ROUTE = "/factory/create";

export const PRIMARY_PRODUCT_NAV: ProductNavItem[] = [
  {
    href: "/discover",
    label: "Explore funds",
    icon: "discover",
    group: "primary",
    access: "public",
  },
  { href: '/investments', label: 'My investments', icon: 'vaults', group: 'primary', access: 'public' },
  { href: '/manage', label: 'Manage funds', icon: 'managers', group: 'primary', access: 'public' },
  {
    href: "/vaults",
    label: "Arkas",
    icon: "vaults",
    group: "primary",
    access: "public",
  },
  {
    href: "/governance",
    label: "Governance",
    icon: "governance",
    group: "primary",
    access: "public",
  },
  {
    href: "/assets",
    label: "Assets",
    icon: "assets",
    group: "primary",
    access: "public",
  },
  {
    href: "/managers",
    label: "Managers",
    icon: "managers",
    group: "primary",
    access: "public",
  },
  {
    href: "/integrations",
    label: "Integrations",
    icon: "integrations",
    group: "primary",
    access: "public",
  },
  {
    href: "/dashboard",
    label: "Dashboard",
    icon: "dashboard",
    group: "primary",
    access: "public",
  },
];

export const UTILITY_PRODUCT_NAV: ProductNavItem[] = [
  {
    href: CREATE_ARKA_ROUTE,
    label: "Create",
    icon: "create",
    group: "utility",
    access: "public",
  },
  {
    href: "/coverage",
    label: "Coverage",
    icon: "coverage",
    group: "utility",
    access: "public",
  },
  {
    href: "/governance/console",
    label: "DAO Console",
    icon: "governance",
    group: "utility",
    access: "operator",
  },
  {
    href: "/integrations/operator",
    label: "Integration Ops",
    icon: "integrations",
    group: "utility",
    access: "operator",
  },
  {
    href: "/migrations",
    label: "Migrations",
    icon: "migrations",
    group: "utility",
    access: "operator",
  },
  {
    href: "/ops",
    label: "Ops",
    icon: "ops",
    group: "utility",
    access: "operator",
  },
  {
    href: "/contracts",
    label: "Contracts",
    icon: "contracts",
    group: "utility",
    access: "operator",
  },
  {
    href: "/settings",
    label: "Settings",
    icon: "settings",
    group: "utility",
    access: "operator",
  },
  {
    href: "/status",
    label: "Status",
    icon: "status",
    group: "utility",
    access: "operator",
  },
  {
    href: "/tiers",
    label: "Tiers",
    icon: "tiers",
    group: "utility",
    access: "operator",
  },
];

export const PUBLIC_UTILITY_PRODUCT_NAV: ProductNavItem[] = UTILITY_PRODUCT_NAV.filter(
  (item) => item.access === "public",
);

export const OPERATOR_CONSOLE_NAV: ProductNavItem[] = UTILITY_PRODUCT_NAV.filter(
  (item) => item.access === "operator",
);

export function resolveProductRoutePolicy(pathname: string): ProductNavItem | null {
  const normalized = normalizeProductPath(pathname);
  return (
    PRIMARY_PRODUCT_NAV.find((item) => item.href === normalized) ??
    UTILITY_PRODUCT_NAV.find((item) => item.href === normalized) ??
    null
  );
}

export function isUtilityProductPath(pathname: string): boolean {
  return resolveProductRoutePolicy(pathname)?.group === "utility";
}

export function resolveUtilityProductItem(pathname: string): ProductNavItem | null {
  const normalized = normalizeProductPath(pathname);
  return UTILITY_PRODUCT_NAV.find((item) => item.href === normalized) ?? null;
}

export function resolveOperatorConsoleItem(pathname: string): ProductNavItem | null {
  const normalized = normalizeProductPath(pathname);
  return OPERATOR_CONSOLE_NAV.find((item) => item.href === normalized) ?? null;
}

export function isOperatorOnlyProductPath(pathname: string): boolean {
  return resolveProductRoutePolicy(pathname)?.access === "operator";
}

export function isOperatorConsolePath(pathname: string): boolean {
  return resolveOperatorConsoleItem(pathname) !== null;
}

export function normalizeProductPath(pathname: string): string {
  if (!pathname || pathname === "/") {
    return "/dashboard";
  }
  if (pathname.startsWith("/vaults/")) {
    return "/vaults";
  }
  if (pathname.startsWith("/managers/")) {
    return "/managers";
  }
  if (pathname.startsWith("/assets/")) {
    return "/assets";
  }
  if (pathname.startsWith("/factory/")) {
    return CREATE_ARKA_ROUTE;
  }
  if (pathname.startsWith("/governance/console")) {
    return "/governance/console";
  }
  if (pathname.startsWith("/migrations")) {
    return "/migrations";
  }
  if (pathname.startsWith("/integrations/operator")) {
    return "/integrations/operator";
  }
  if (pathname.startsWith("/integrations")) {
    return "/integrations";
  }
  return pathname;
}

export function isProductNavActive(pathname: string, href: string): boolean {
  const normalized = normalizeProductPath(pathname);
  return normalized === href;
}

type CreateArkaSearchInput = URLSearchParams | string | null | undefined;

function normalizeSearchInput(searchParams: CreateArkaSearchInput): string {
  if (!searchParams) return "";
  if (typeof searchParams === "string") return searchParams.replace(/^\?/, "");
  return searchParams.toString();
}

export function buildPublicCreateArkaHref(
  pathname: string,
  searchParams?: CreateArkaSearchInput,
): string {
  const normalizedPath = normalizeProductPath(pathname || "/dashboard");
  const sourcePath = normalizedPath === CREATE_ARKA_ROUTE ? "/dashboard" : normalizedPath;
  const sourceQuery = normalizeSearchInput(searchParams);
  const params = new URLSearchParams();
  params.set("from", sourcePath);

  if (sourceQuery) {
    params.set("returnQuery", sourceQuery);
    const query = new URLSearchParams(sourceQuery).get("q")?.trim();
    if (query) {
      params.set("q", query);
    }
  }

  return `${CREATE_ARKA_ROUTE}?${params.toString()}`;
}
