/** Public Catalog and NAV API client. */
export * from "./src/api/catalogClient.js";
export * from "./src/api/types.js";

/** Network configuration, signing, validation and presentation helpers. */
export * from "./src/core/config.js";
export * from "./src/core/extensions.js";
export * from "./src/core/format.js";
export * from "./src/core/rpc.js";
export * from "./src/core/signing.js";
export * from "./src/core/validation.js";
export * from "./src/networks/mainnet.js";

/** High-level contract modules used by integrations. */
export * from "./src/modules/factory.js";
export * from "./src/modules/oracleGuard.js";
export * from "./src/modules/registry.js";
export * from "./src/modules/router.js";
export * from "./src/modules/venueRegistry.js";
export * from "./src/modules/vault.js";
export * from "./src/sdk.js";

/** Contract value types returned by the high-level modules. */
export type {
  Asset,
  BlendMarketStatus,
  CreditMarketStatus,
  CreditProtocol,
  FeeStructure,
} from "./src/generated/arka.js";
export type { DefaultSwapRiskPolicy } from "./src/generated/arka-factory.js";
export type {
  AssetInspection,
  AssetPolicy,
  OracleAsset as OracleGuardAsset,
  OraclePriceData,
} from "./src/generated/oracle-guard.js";
export type { VenueConfig } from "./src/generated/venue-registry.js";
