export interface CatalogPage<T> {
  total: number;
  offset: number;
  limit: number;
  items: T[];
  dataStatus?: "live" | "unavailable";
  unavailableReason?: string | null;
}

export interface CatalogFeeSummary {
  mgmtBps: number;
  perfBps: number;
  depositBps: number;
  redeemBps: number;
}

export interface CatalogIdentity {
  displayName: string | null;
  description: string | null;
  avatarUrl: string | null;
  websiteUrl: string | null;
  socialUrl: string | null;
  trustState: "unverified" | "curated" | "verified" | "official";
  updatedAt: string;
  updatedBy: string;
  pendingIndexation?: boolean;
}

export interface CatalogArkaIdentity extends CatalogIdentity {
  arkaId: string;
  manager: string;
}

export interface CatalogManagerIdentity extends CatalogIdentity {
  manager: string;
}

export interface CatalogIdentityUpdatePayload {
  displayName?: string | null;
  description?: string | null;
  avatarUrl?: string | null;
  websiteUrl?: string | null;
  socialUrl?: string | null;
  nonce: string;
  issuedAt: string;
}

export interface CatalogIdentityUpdateRequest {
  signer: string;
  message: string;
  signature: string;
  payload: CatalogIdentityUpdatePayload;
}

export interface CatalogAssetExposure {
  assetContract: string;
  isDenomination: boolean;
  liquidBalance: string;
  collateralAmount: string;
  debtAmount: string;
  netManagedAmount: string;
  netPositionValue: string;
  marketIds: string[];
  syncedAt: string;
}

export type CatalogValuationSource =
  | "usd_stablecoin_parity"
  | "oracle_verified"
  | "unavailable";

export type CatalogOracleStatus =
  | "verified"
  | "not_required_usd_stablecoin"
  | "stale_price"
  | "invalid_price"
  | "policy_paused"
  | "missing_price";

export interface CatalogAssetIdentity {
  contract: string;
  symbol: string | null;
  label: string | null;
  decimals: number;
  usdPegged: boolean;
}

export interface CatalogAssetPrice {
  assetContract: string;
  priceUsd: string | null;
  decimals: number;
  timestamp: string | null;
  oracleStatus: CatalogOracleStatus;
  valuationSource: CatalogValuationSource;
  primaryUsable: boolean | null;
  secondaryUsable: boolean | null;
  unavailableReason: string | null;
  observedAt: string;
}

export interface CatalogEconomicMetrics {
  denominationAsset: CatalogAssetIdentity | null;
  denominationPrice: CatalogAssetPrice | null;
  navDenomination: string;
  navUsdEstimate: string | null;
  sharePrice: string | null;
  returns: Record<string, { amount: string | null; bps: number | null }>;
  pnl: { amount: string | null; bps: number | null };
  volume: { amount: string | null; bps: number | null };
  flows: Record<string, string | number | null>;
  fees: CatalogFeeSummary;
  portfolioWeights: Array<{
    assetContract: string;
    weightBps: number;
    valueDenomination: string;
    valueUsdEstimate: string | null;
  }>;
  oracleStatus: CatalogOracleStatus;
  valuationSource: CatalogValuationSource;
  missingPriceReasons: string[];
}

export interface CatalogArka {
  rank?: number;
  arkaId: string;
  manager: string;
  curated: boolean;
  delisted: boolean;
  nav: string;
  denominationContract: string | null;
  whitelistContracts: string[];
  shareToken: string | null;
  fees: CatalogFeeSummary;
  assets: CatalogAssetExposure[];
  economics?: CatalogEconomicMetrics;
  identity?: CatalogIdentity | null;
  syncedAt: string;
}

export interface CatalogAsset {
  rank?: number;
  assetContract: string;
  identity?: CatalogAssetIdentity | null;
  price?: CatalogAssetPrice | null;
  arkaCount: number;
  managerCount: number;
  denominationArkaCount: number;
  liquidBalance: string;
  collateralAmount: string;
  debtAmount: string;
  netManagedAmount: string;
  netPositionValue: string;
  syncedAt: string;
}

export interface CatalogManager {
  rank?: number;
  manager: string;
  arkaCount: number;
  curatedArkaCount: number;
  delistedArkaCount: number;
  totalNav: string;
  identity?: CatalogIdentity | null;
  syncedAt: string;
}

export interface CatalogMetrics {
  totalArkas: number;
  indexedArkas: number;
  failedArkas: number;
  totalManagers: number;
  curatedArkas: number;
  delistedArkas: number;
  totalAssets: number;
  totalNav: string;
  syncedAt: string;
}

export type CatalogMonitoringAlertKind =
  | "snapshot_missing"
  | "snapshot_stale"
  | "sync_failed"
  | "consecutive_failures"
  | "sync_slow"
  | "partial_sync_failures";

export interface CatalogMonitoringAlert {
  kind: CatalogMonitoringAlertKind;
  severity: "warning" | "critical";
  message: string;
  active?: boolean;
  firstTriggeredAt?: string;
  lastTriggeredAt?: string;
  lastResolvedAt?: string | null;
}

export interface CatalogMonitoringRun {
  runId: string;
  startedAt: string;
  finishedAt: string;
  durationMs: number;
  status: "success" | "failure";
  indexedArkas: number;
  failedArkas: number;
  totalArkas: number;
  totalNav: string;
  errorMessage: string | null;
}

export interface CatalogMonitoringStatus {
  healthy: boolean;
  degraded: boolean;
  evaluatedAt: string;
  snapshotAgeSeconds: number | null;
  consecutiveFailures: number;
  lastRun: CatalogMonitoringRun | null;
  activeAlerts: CatalogMonitoringAlert[];
  thresholds: Record<string, number>;
}

export interface CatalogHealth {
  healthy: boolean;
  degraded: boolean;
  evaluatedAt: string;
  snapshotAgeSeconds: number | null;
  lastSyncedAt: string | null;
  indexedArkas: number;
  failedArkas: number;
  consecutiveFailures: number;
  activeAlerts: CatalogMonitoringAlert[];
}

export interface CatalogNavResponse {
  syncedAt: string;
  totalNav: string;
  totalNavUsdEstimate: string | null;
  valuationSource: CatalogValuationSource;
  oracleStatus: CatalogOracleStatus;
  missingPriceReasons: string[];
  denominationTotals: Array<{
    denominationAsset: {
      contract: string;
      symbol: string | null;
      label: string | null;
      decimals: number;
      usdPegged: boolean;
    } | null;
    totalNav: string;
    navUsdEstimate: string | null;
    arkaCount: number;
  }>;
  totalNavDelta: string | null;
  totalNavDeltaBps: number | null;
  totalArkas: number;
  totalManagers: number;
  totalAssets: number;
  curatedArkas: number;
  delistedArkas: number;
  largestAssetWeightBps: number | null;
  monitoring: {
    healthy: boolean;
    degraded: boolean;
    snapshotAgeSeconds: number | null;
    consecutiveFailures: number;
    activeAlertCount: number;
    lastRunStatus: "success" | "failure" | null;
  };
}

export type CatalogActivityKind =
  | "deposit"
  | "redeem"
  | "profit"
  | "lend"
  | "borrow"
  | "repay"
  | "withdraw";

export interface CatalogActivity {
  eventId: string;
  cursor: string;
  arkaId: string;
  manager: string;
  kind: CatalogActivityKind;
  ledger: number;
  ledgerClosedAt: string;
  txHash: string;
  user: string | null;
  assetContract: string | null;
  marketId: string | null;
  amount: string | null;
  shares: string | null;
  netOut: string | null;
  stepCount: number | null;
}

export interface CatalogListQuery {
  offset?: number;
  limit?: number;
  search?: string;
  order?: "asc" | "desc";
}

export interface CatalogArkaQuery extends CatalogListQuery {
  sort?: "nav" | "manager" | "syncedAt";
  curated?: boolean;
  delisted?: boolean;
}

export interface CatalogAssetQuery extends CatalogListQuery {
  sort?: "netManagedAmount" | "arkaCount" | "syncedAt";
}

export interface CatalogManagerQuery extends CatalogListQuery {
  sort?: "totalNav" | "arkaCount" | "manager";
}

export interface CatalogActivityQuery {
  kind?: CatalogActivityKind;
  fromLedger?: number;
  toLedger?: number;
  order?: "asc" | "desc";
  limit?: number;
}
