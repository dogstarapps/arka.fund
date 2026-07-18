export interface FeeSummary {
  mgmtBps: number;
  perfBps: number;
  depositBps: number;
  redeemBps: number;
}

export type CatalogValuationSource =
  | "usd_stablecoin_parity"
  | "oracle_verified"
  | "unavailable";

export type CatalogOracleStatus =
  | "verified"
  | "not_required_usd_stablecoin"
  | "missing_price";

export interface CatalogAssetIdentity {
  contract: string;
  symbol: string | null;
  label: string | null;
  decimals: number;
  usdPegged: boolean;
}

export interface CatalogPeriodMetric {
  amount: string | null;
  bps: number | null;
}

export interface CatalogFlowMetrics {
  depositVolume: string | null;
  redeemVolume: string | null;
  netUserFlow: string | null;
  activeUsers: number | null;
}

export interface CatalogPortfolioWeight {
  assetContract: string;
  weightBps: number;
  valueDenomination: string;
  valueUsdEstimate: string | null;
}

export interface CatalogEconomicMetrics {
  denominationAsset: CatalogAssetIdentity | null;
  navDenomination: string;
  navUsdEstimate: string | null;
  sharePrice: string | null;
  returns: Record<"1d" | "7d" | "30d" | "1y" | "all", CatalogPeriodMetric>;
  pnl: CatalogPeriodMetric;
  volume: CatalogPeriodMetric;
  flows: CatalogFlowMetrics;
  fees: FeeSummary;
  portfolioWeights: CatalogPortfolioWeight[];
  oracleStatus: CatalogOracleStatus;
  valuationSource: CatalogValuationSource;
  missingPriceReasons: string[];
}

export interface ArkaAssetExposure {
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

export interface ArkaCatalogEntry {
  arkaId: string;
  manager: string;
  curated: boolean;
  delisted: boolean;
  nav: string;
  denominationContract: string | null;
  whitelistContracts: string[];
  shareToken: string | null;
  fees: FeeSummary;
  assets: ArkaAssetExposure[];
  economics?: CatalogEconomicMetrics;
  identity?: ArkaIdentityMetadata | null;
  syncedAt: string;
}

export interface AssetCatalogEntry {
  assetContract: string;
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

export interface ManagerCatalogEntry {
  manager: string;
  arkaCount: number;
  curatedArkaCount: number;
  delistedArkaCount: number;
  totalNav: string;
  identity?: ManagerIdentityMetadata | null;
  syncedAt: string;
}

export type IdentityTrustState = "unverified" | "curated" | "verified" | "official";

export interface IdentityUpdatePayload {
  displayName?: string | null;
  description?: string | null;
  avatarUrl?: string | null;
  websiteUrl?: string | null;
  socialUrl?: string | null;
  nonce: string;
  issuedAt: string;
}

export interface IdentityUpdateRequest {
  signer: string;
  message: string;
  signature: string;
  payload: IdentityUpdatePayload;
}

interface IdentityMetadataBase {
  displayName: string | null;
  description: string | null;
  avatarUrl: string | null;
  websiteUrl: string | null;
  socialUrl: string | null;
  trustState: IdentityTrustState;
  updatedAt: string;
  updatedBy: string;
  pendingIndexation?: boolean;
}

export interface ArkaIdentityMetadata extends IdentityMetadataBase {
  arkaId: string;
  manager: string;
}

export interface ManagerIdentityMetadata extends IdentityMetadataBase {
  manager: string;
}

export interface IdentityArchive {
  schemaVersion: number;
  updatedAt: string;
  arkas: Record<string, ArkaIdentityMetadata>;
  managers: Record<string, ManagerIdentityMetadata>;
}

export interface CatalogSyncFailure {
  arkaId: string;
  message: string;
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

export interface CatalogSnapshot {
  schemaVersion: number;
  syncedAt: string;
  metrics: CatalogMetrics;
  arkas: ArkaCatalogEntry[];
  assets: AssetCatalogEntry[];
  managers: ManagerCatalogEntry[];
  failures: CatalogSyncFailure[];
}

export interface CatalogHistoryArchive {
  schemaVersion: number;
  retentionLimit: number;
  updatedAt: string;
  runs: CatalogSnapshot[];
}

export type SyncRunStatus = "success" | "failure";

export interface SyncRunRecord {
  runId: string;
  startedAt: string;
  finishedAt: string;
  durationMs: number;
  status: SyncRunStatus;
  indexedArkas: number;
  failedArkas: number;
  totalArkas: number;
  totalNav: string;
  errorMessage: string | null;
}

export interface MonitoringThresholds {
  maxSnapshotAgeSeconds: number;
  maxSyncDurationMs: number;
  maxFailureRatio: number;
  maxConsecutiveFailures: number;
}

export type MonitoringAlertKind =
  | "snapshot_missing"
  | "snapshot_stale"
  | "sync_failed"
  | "consecutive_failures"
  | "sync_slow"
  | "partial_sync_failures";

export type MonitoringAlertSeverity = "warning" | "critical";

export interface MonitoringAlert {
  kind: MonitoringAlertKind;
  severity: MonitoringAlertSeverity;
  message: string;
}

export interface MonitoringAlertState extends MonitoringAlert {
  active: boolean;
  firstTriggeredAt: string;
  lastTriggeredAt: string;
  lastResolvedAt: string | null;
}

export interface MonitoringArchive {
  schemaVersion: number;
  retentionLimit: number;
  updatedAt: string;
  runs: SyncRunRecord[];
  alerts: MonitoringAlertState[];
}

export interface MonitoringStatus {
  healthy: boolean;
  degraded: boolean;
  evaluatedAt: string;
  snapshotAgeSeconds: number | null;
  consecutiveFailures: number;
  lastRun: SyncRunRecord | null;
  activeAlerts: MonitoringAlert[];
  thresholds: MonitoringThresholds;
}

export interface AlertTransition {
  kind: MonitoringAlertKind;
  action: "triggered" | "resolved";
  alert: MonitoringAlertState;
}

export interface MonitoringNotificationEvent {
  eventId: string;
  sentAt: string;
  transitions: AlertTransition[];
  status: MonitoringStatus;
}

export type ActivityKind =
  | "deposit"
  | "redeem"
  | "profit"
  | "lend"
  | "borrow"
  | "repay"
  | "withdraw";

export interface ActivityEntry {
  eventId: string;
  cursor: string;
  arkaId: string;
  manager: string;
  kind: ActivityKind;
  ledger: number;
  ledgerClosedAt: string;
  txHash: string;
  transactionIndex: number;
  operationIndex: number;
  inSuccessfulContractCall: boolean;
  user: string | null;
  assetContract: string | null;
  marketId: string | null;
  amount: string | null;
  shares: string | null;
  netOut: string | null;
  stepCount: number | null;
}

export interface ActivityCountSummary {
  deposit: number;
  redeem: number;
  profit: number;
  lend: number;
  borrow: number;
  repay: number;
  withdraw: number;
}

export interface ActivitySummary {
  totalEvents: number;
  uniqueUsers: number;
  oldestLedger: number | null;
  latestLedger: number | null;
  counts: ActivityCountSummary;
  depositVolume: string;
  redeemVolume: string;
  profitVolume: string;
  netUserFlow: string;
}

export interface DashboardMonitoringSummary {
  healthy: boolean;
  degraded: boolean;
  snapshotAgeSeconds: number | null;
  consecutiveFailures: number;
  activeAlertCount: number;
  lastRunStatus: SyncRunStatus | null;
}

export interface DashboardOverview {
  syncedAt: string;
  totalNav: string;
  totalNavUsdEstimate: string | null;
  valuationSource: CatalogValuationSource;
  oracleStatus: CatalogOracleStatus;
  missingPriceReasons: string[];
  denominationTotals: Array<{
    denominationAsset: CatalogAssetIdentity | null;
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
  monitoring: DashboardMonitoringSummary;
  activity: ActivitySummary;
}

export interface DashboardCompositionItem {
  assetContract: string;
  rank: number;
  arkaCount: number;
  managerCount: number;
  denominationArkaCount: number;
  navContribution: string;
  weightBps: number;
  liquidBalance: string;
  collateralAmount: string;
  debtAmount: string;
  netPositionValue: string;
}

export interface DashboardComposition {
  syncedAt: string;
  totalNav: string;
  items: DashboardCompositionItem[];
}

export interface ArkaPortfolioItem {
  assetContract: string;
  rank: number;
  isDenomination: boolean;
  marketIds: string[];
  navContribution: string;
  weightBps: number;
  liquidBalance: string;
  collateralAmount: string;
  debtAmount: string;
  netPositionValue: string;
}

export interface ArkaPortfolio {
  arkaId: string;
  manager: string;
  shareToken: string | null;
  denominationContract: string | null;
  syncedAt: string;
  nav: string;
  totalNavContribution: string;
  items: ArkaPortfolioItem[];
}

export interface RankedArkaCatalogEntry extends ArkaCatalogEntry {
  rank: number;
}

export interface RankedManagerCatalogEntry extends ManagerCatalogEntry {
  rank: number;
}

export interface RankedAssetCatalogEntry extends AssetCatalogEntry {
  rank: number;
}

export interface ArkaHistoryPoint {
  arkaId: string;
  syncedAt: string;
  nav: string;
  manager: string;
  curated: boolean;
  delisted: boolean;
  shareToken: string | null;
  rank: number;
}

export interface ManagerHistoryPoint {
  manager: string;
  syncedAt: string;
  totalNav: string;
  arkaCount: number;
  curatedArkaCount: number;
  delistedArkaCount: number;
  rank: number;
}

export interface AssetHistoryPoint {
  assetContract: string;
  syncedAt: string;
  arkaCount: number;
  managerCount: number;
  denominationArkaCount: number;
  liquidBalance: string;
  collateralAmount: string;
  debtAmount: string;
  netManagedAmount: string;
  netPositionValue: string;
  rank: number;
}

export interface ArkaAssetHistoryPoint {
  arkaId: string;
  assetContract: string;
  syncedAt: string;
  isDenomination: boolean;
  liquidBalance: string;
  collateralAmount: string;
  debtAmount: string;
  netManagedAmount: string;
  netPositionValue: string;
  rank: number;
}

export interface Page<T> {
  total: number;
  offset: number;
  limit: number;
  items: T[];
}

export interface ArkaQuery {
  sort?: "nav" | "manager" | "syncedAt";
  order?: "asc" | "desc";
  curated?: boolean;
  delisted?: boolean;
  search?: string;
  offset?: number;
  limit?: number;
}

export interface AssetQuery {
  sort?: "netManagedAmount" | "arkaCount" | "syncedAt";
  order?: "asc" | "desc";
  search?: string;
  offset?: number;
  limit?: number;
}

export interface ManagerQuery {
  sort?: "totalNav" | "arkaCount" | "manager";
  order?: "asc" | "desc";
  search?: string;
  offset?: number;
  limit?: number;
}

export interface HistoryQuery {
  from?: string;
  to?: string;
  order?: "asc" | "desc";
  limit?: number;
}

export interface ActivityQuery {
  kind?: ActivityKind;
  fromLedger?: number;
  toLedger?: number;
  order?: "asc" | "desc";
  limit?: number;
}

export interface MonitoringRunQuery {
  status?: SyncRunStatus;
  order?: "asc" | "desc";
  limit?: number;
}

export interface CompositionQuery {
  limit?: number;
}

export interface DashboardOverviewQuery {
  activityLimit?: number;
}
