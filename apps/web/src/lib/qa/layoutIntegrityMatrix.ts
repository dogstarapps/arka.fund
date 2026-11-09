export type LayoutIntegrityAccess = "public" | "operator";

export type LayoutIntegrityRoute = {
  key: string;
  label: string;
  path: string;
  access: LayoutIntegrityAccess;
  family:
    | "public-dashboard"
    | "create-wizard"
    | "catalog"
    | "profile"
    | "governance"
    | "coverage"
    | "operator-console";
};

export type LayoutIntegrityBreakpoint = {
  key: string;
  width: number;
  height: number;
  family: "desktop" | "laptop" | "tablet" | "mobile";
};

export const LAYOUT_INTEGRITY_BREAKPOINTS = [
  { key: "desktop-wide", width: 1440, height: 1100, family: "desktop" },
  { key: "laptop", width: 1280, height: 960, family: "laptop" },
  { key: "tablet", width: 900, height: 1100, family: "tablet" },
  { key: "mobile", width: 390, height: 960, family: "mobile" },
] as const satisfies readonly LayoutIntegrityBreakpoint[];

export const LAYOUT_INTEGRITY_ROUTES = [
  {
    key: "dashboard",
    label: "Dashboard",
    path: "/dashboard",
    access: "public",
    family: "public-dashboard",
  },
  {
    key: "discover",
    label: "Discover",
    path: "/discover",
    access: "public",
    family: "public-dashboard",
  },
  {
    key: "arkas",
    label: "Arkas leaderboard",
    path: "/arkas",
    access: "public",
    family: "catalog",
  },
  {
    key: "assets",
    label: "Assets",
    path: "/assets",
    access: "public",
    family: "catalog",
  },
  {
    key: "managers",
    label: "Managers",
    path: "/managers",
    access: "public",
    family: "catalog",
  },
  {
    key: "create",
    label: "Create Arka wizard",
    path: "/factory/create",
    access: "public",
    family: "create-wizard",
  },
  {
    key: "create-basics",
    label: "Create Arka - basics",
    path: "/factory/create?step=basics",
    access: "public",
    family: "create-wizard",
  },
  {
    key: "create-fees",
    label: "Create Arka - fees",
    path: "/factory/create?step=fees",
    access: "public",
    family: "create-wizard",
  },
  {
    key: "create-deposits",
    label: "Create Arka - deposits",
    path: "/factory/create?step=deposits",
    access: "public",
    family: "create-wizard",
  },
  {
    key: "create-redemptions",
    label: "Create Arka - redemptions",
    path: "/factory/create?step=redemptions",
    access: "public",
    family: "create-wizard",
  },
  {
    key: "create-assets",
    label: "Create Arka - assets management",
    path: "/factory/create?step=assets",
    access: "public",
    family: "create-wizard",
  },
  {
    key: "create-review",
    label: "Create Arka - review",
    path: "/factory/create?step=review",
    access: "public",
    family: "create-wizard",
  },
  {
    key: "vaults",
    label: "Vault ops index",
    path: "/vaults",
    access: "public",
    family: "catalog",
  },
  {
    key: "vault-profile",
    label: "Vault profile",
    path: "/vaults/CA7ALPHAQFK2MZKJY4R5S8N2P1T6V9W3X7Y2Z5ABCD1EFGH2345678IJ",
    access: "public",
    family: "profile",
  },
  {
    key: "asset-profile",
    label: "Asset profile",
    path: "/assets/CCW67TSZV3SSS2HXMBQ5JFGCKJNXKZM7UQUWUZPUTHXSTZLEO7SJMI75",
    access: "public",
    family: "profile",
  },
  {
    key: "asset-profile-core-registry",
    label: "Asset profile - core registry fallback",
    path: "/assets/CDCKFBZYF2AQCSM3JOF2ZM27O3Y6AJAI4OTCQKAFNZ3FHBYUTFOKICIY",
    access: "public",
    family: "profile",
  },
  {
    key: "manager-profile",
    label: "Manager profile",
    path: "/managers/GCAALPHA7RTH9KLMNOPQ2UVWX3YZ56789ABCDEFGHJKLMNPRSTUV4WX",
    access: "public",
    family: "profile",
  },
  {
    key: "arka-detail",
    label: "Arka execution detail",
    path: "/arkas/TEST_BLEND_VAULT",
    access: "public",
    family: "profile",
  },
  {
    key: "governance",
    label: "Governance",
    path: "/governance",
    access: "public",
    family: "governance",
  },
  {
    key: "governance-console",
    label: "Governance console",
    path: "/governance/console",
    access: "operator",
    family: "operator-console",
  },
  {
    key: "coverage",
    label: "Coverage",
    path: "/coverage",
    access: "public",
    family: "coverage",
  },
  {
    key: "integrations",
    label: "Integrations",
    path: "/integrations",
    access: "operator",
    family: "operator-console",
  },
  {
    key: "integrations-operator",
    label: "Integration Ops",
    path: "/integrations/operator",
    access: "operator",
    family: "operator-console",
  },
  {
    key: "ops",
    label: "Ops",
    path: "/ops",
    access: "operator",
    family: "operator-console",
  },
  {
    key: "contracts",
    label: "Contracts",
    path: "/contracts",
    access: "operator",
    family: "operator-console",
  },
  {
    key: "migrations",
    label: "Migrations",
    path: "/migrations",
    access: "operator",
    family: "operator-console",
  },
  {
    key: "settings",
    label: "Settings",
    path: "/settings",
    access: "operator",
    family: "operator-console",
  },
  {
    key: "status",
    label: "Status",
    path: "/status",
    access: "operator",
    family: "operator-console",
  },
  {
    key: "tiers",
    label: "Tiers",
    path: "/tiers",
    access: "operator",
    family: "operator-console",
  },
] as const satisfies readonly LayoutIntegrityRoute[];

export function getLayoutIntegrityRoutes(access?: LayoutIntegrityAccess): LayoutIntegrityRoute[] {
  if (!access) {
    return [...LAYOUT_INTEGRITY_ROUTES];
  }
  return LAYOUT_INTEGRITY_ROUTES.filter((route) => route.access === access);
}

export function getLayoutIntegrityCoverageSummary() {
  const routes = getLayoutIntegrityRoutes();
  const publicRoutes = getLayoutIntegrityRoutes("public");
  const operatorRoutes = getLayoutIntegrityRoutes("operator");

  return {
    routeCount: routes.length,
    publicRouteCount: publicRoutes.length,
    operatorRouteCount: operatorRoutes.length,
    breakpointCount: LAYOUT_INTEGRITY_BREAKPOINTS.length,
    scenarioCount: routes.length * LAYOUT_INTEGRITY_BREAKPOINTS.length,
    families: [...new Set(routes.map((route) => route.family))],
  };
}
