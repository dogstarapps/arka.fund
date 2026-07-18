import { catalogOpenApiPaths } from "./paths.js";
import { catalogOpenApiSchemas } from "./schemas.js";

export const CATALOG_OPENAPI_DOCUMENT = Object.freeze({
  openapi: "3.1.0",
  info: {
    title: "Arka.fund Catalog and NAV API",
    version: "1.0.0",
    description:
      "Public, read-only indexed data for Arka discovery, NAV, assets, managers, activity and operational monitoring. Exact monetary values are returned as integer strings to preserve on-chain precision.",
    contact: {
      name: "Arka.fund",
      url: "https://arka.fund/",
    },
    license: {
      name: "Public API terms",
      url: "https://arka.fund/docs/",
    },
  },
  servers: [{ url: "https://catalog.arka.fund", description: "Stellar mainnet" }],
  tags: [
    { name: "Catalog", description: "Network-level indexed totals." },
    { name: "Arkas", description: "Arka vault discovery and portfolio data." },
    { name: "Assets", description: "Asset-level exposure data." },
    { name: "Managers", description: "Manager profiles and managed Arkas." },
    { name: "Activity", description: "Indexed on-chain activity." },
    { name: "History", description: "Persisted snapshots and time series." },
    { name: "Dashboard", description: "Aggregates used by the public app." },
    { name: "NAV", description: "Application-level aggregate NAV response." },
    { name: "Operations", description: "Health, sync and alert state." },
  ],
  paths: catalogOpenApiPaths,
  components: { schemas: catalogOpenApiSchemas },
});
