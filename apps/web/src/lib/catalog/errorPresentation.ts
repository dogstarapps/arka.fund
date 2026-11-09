export type CatalogSurfaceKind =
  | "dashboard"
  | "discover"
  | "vaults"
  | "assets"
  | "assetTelemetry"
  | "managers"
  | "managerTelemetry";

const SURFACE_COPY: Record<CatalogSurfaceKind, { title: string; subject: string }> = {
  dashboard: {
    title: "Dashboard data is not available",
    subject: "Dashboard NAV, allocation and monitoring data",
  },
  discover: {
    title: "Discovery data is not available",
    subject: "Discovery, manager and asset screening data",
  },
  vaults: {
    title: "Arka leaderboard data is not available",
    subject: "Ranked Arka leaderboard data",
  },
  assets: {
    title: "Asset explorer data is not available",
    subject: "Asset concentration and balance-sheet posture",
  },
  assetTelemetry: {
    title: "Asset signals are not available",
    subject: "Asset telemetry and concentration summary data",
  },
  managers: {
    title: "Manager explorer data is not available",
    subject: "Manager ranking and reputation data",
  },
  managerTelemetry: {
    title: "Manager signals are not available",
    subject: "Manager telemetry and concentration summary data",
  },
};

export function buildCatalogFallbackUnavailableCopy(surface: CatalogSurfaceKind): {
  title: string;
  body: string;
} {
  const copy = SURFACE_COPY[surface];
  return {
    title: copy.title,
    body: `${copy.subject} could not be loaded right now. Retry, or check Status if the problem continues.`,
  };
}
