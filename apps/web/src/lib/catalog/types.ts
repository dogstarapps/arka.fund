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
  denominationPrice?: CatalogAssetPrice | null;
  navDenomination: string | null;
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

export type IdentityTrustState = "unverified" | "curated" | "verified" | "official";

export interface IdentityUpdatePayload {
  displayName?: string | null;
  description?: string | null;
  strategy?: string | null;
  riskDisclosure?: string | null;
  targetReturn?: string | null;
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
  strategy?: string | null;
  riskDisclosure?: string | null;
  targetReturn?: string | null;
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

export interface RankedArkaCatalogEntry {
  rank: number;
  arkaId: string;
  manager: string;
  curated: boolean;
  delisted: boolean;
  nav: string | null;
  navUnavailableReason?: string | null;
  profitBase?: string | null;
  volumeBase?: string | null;
  denominationContract: string | null;
  whitelistContracts: string[];
  shareToken: string | null;
  fees: FeeSummary;
  assets: ArkaAssetExposure[];
  economics?: CatalogEconomicMetrics;
  identity?: ArkaIdentityMetadata | null;
  syncedAt: string;
}

export interface ArkaHolderEntry {
  holder: string;
  shares: string;
  ownershipBps: number;
  firstSeenLedger: number | null;
  lastActivityLedger: number | null;
}

export interface ArkaHolderPage extends Page<ArkaHolderEntry> {
  arkaId: string;
  shareToken: string | null;
  totalShares: string;
  indexedAt: string;
  complete: boolean;
  stale?: boolean;
  refreshFailed?: boolean;
  coverageFromLedger: number | null;
  coverageToLedger: number | null;
}

export interface RankedManagerCatalogEntry {
  rank: number;
  manager: string;
  arkaCount: number;
  curatedArkaCount: number;
  delistedArkaCount: number;
  totalNav: string;
  totalNavUsdEstimate?: string | null;
  identity?: ManagerIdentityMetadata | null;
  syncedAt: string;
}

export interface RankedAssetCatalogEntry {
  rank: number;
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
  netManagedUsdEstimate?: string | null;
  syncedAt: string;
}

export type CoreStellarAssetIconSource = "stellar_toml" | "registry_png" | "symbol_glyph";
export type CoreStellarAssetTomlState =
  | "not_applicable"
  | "missing_home_domain"
  | "resolved"
  | "unreachable"
  | "asset_not_found"
  | "missing_icon"
  | "invalid_icon";

export interface CoreStellarAssetMetadata {
  id: string;
  label: string;
  symbol: string;
  kind: "native" | "classic";
  description: string;
  homeDomain: string | null;
  classicCode: string | null;
  classicIssuer: string | null;
  decimals: number;
  stablecoin: boolean;
  oracleFeedIds: string[];
  metadataContract: string | null;
  selectableContract: string | null;
  iconUrl: string;
  fallbackIconUrl: string;
  iconSource: CoreStellarAssetIconSource;
  tomlState: CoreStellarAssetTomlState;
  tomlUrl: string | null;
  iconProvenanceLabel: string;
  lookupKeys: string[];
}

export interface CoreStellarAssetRegistryResponse {
  generatedAt: string;
  items: CoreStellarAssetMetadata[];
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

export interface ManagerHistoryPoint {
  manager: string;
  syncedAt: string;
  totalNav: string;
  totalNavUsdEstimate?: string | null;
  arkaCount: number;
  curatedArkaCount: number;
  delistedArkaCount: number;
  rank: number;
}

export interface ArkaHistoryPoint {
  arkaId: string;
  syncedAt: string;
  nav: string | null;
  manager: string;
  curated: boolean;
  delisted: boolean;
  shareToken: string | null;
  rank: number;
}

export interface ArkaPortfolioItem {
  assetContract: string;
  rank: number;
  isDenomination: boolean;
  marketIds: string[];
  navContribution: string;
  valueUsdEstimate?: string | null;
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
  nav: string | null;
  totalNavContribution: string;
  totalNavUsdEstimate?: string | null;
  items: ArkaPortfolioItem[];
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

export interface Page<T> {
  total: number;
  offset: number;
  limit: number;
  items: T[];
}

export type LeaderboardOracleMode = "oracle_guard" | "unverified";
export type LeaderboardTargetNetwork = "testnet" | "mainnet";
export type LeaderboardDeploymentsPathSource =
  | "env_path"
  | "network_default"
  | "bundled_testnet"
  | "bundled_mainnet";

export interface LeaderboardOracleSource {
  mode: LeaderboardOracleMode;
  validatedAt: string | null;
  network: string | null;
  rpcUrl: string | null;
  oracleGuard: string | null;
  primaryOracle: string | null;
  secondaryOracle: string | null;
  primaryProvider?: string | null;
  secondaryProvider?: string | null;
  provider?: string | null;
  validationAsset: string | null;
  maxOracleAgeSeconds?: number | null;
  maxDivergenceBps?: number | null;
  minProviderCount?: number | null;
  selectedSourceUnderDivergence: number | null;
  source: "deployments" | "fallback";
}

export interface LeaderboardMetricSource {
  ranking: "catalog_rank";
  nav: "catalog_nav";
  profit: "catalog_profit_or_activity";
  volume: "catalog_volume_or_activity";
  activityFallbackWindowEvents: number;
}

export interface LeaderboardDeploymentSource {
  targetNetwork: LeaderboardTargetNetwork;
  deploymentsPath: string | null;
  pathSource: LeaderboardDeploymentsPathSource;
  fileFound: boolean;
  networkMismatch: boolean;
  readError: string | null;
}

export interface LeaderboardDataSourceSnapshot {
  metrics: LeaderboardMetricSource;
  oracle: LeaderboardOracleSource;
  deployment: LeaderboardDeploymentSource;
  source: "deployments" | "fallback";
}

export type VaultSortMetric = "rank" | "nav" | "profit" | "volume";
export type VaultSortOrder = "asc" | "desc";
export type VaultResolvedMetricSource = "catalog" | "activity" | "unavailable";

export interface VaultResolvedMetricValue {
  value: number | null;
  source: VaultResolvedMetricSource;
}

export interface VaultResolvedMetrics {
  profit: VaultResolvedMetricValue;
  volume: VaultResolvedMetricValue;
}

export interface VaultLeaderboardResolvedQuery {
  search: string | null;
  curatedOnly: boolean;
  sortMetric: VaultSortMetric;
  sortOrder: VaultSortOrder;
  limit: number;
  offset: number;
  activityFallbackLimit: number;
}

export interface VaultLeaderboardResolvedPageResponse {
  ok: true;
  source: "api_vault_leaderboard";
  generatedAt: string;
  query: VaultLeaderboardResolvedQuery;
  page: Page<RankedArkaCatalogEntry>;
  derivedMetrics: Record<string, VaultResolvedMetrics>;
}

export type ManagerSortMetric = "rank" | "nav" | "arkas" | "curated";
export type ManagerSortOrder = "asc" | "desc";

export interface ManagerLeaderboardResolvedQuery {
  search: string | null;
  sortMetric: ManagerSortMetric;
  sortOrder: ManagerSortOrder;
  limit: number;
  offset: number;
}

export interface ManagerLeaderboardResolvedPageResponse {
  ok: true;
  source: "api_manager_leaderboard";
  generatedAt: string;
  query: ManagerLeaderboardResolvedQuery;
  page: Page<RankedManagerCatalogEntry>;
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
  dataStatus?: "live" | "unavailable";
  unavailableReason?: string | null;
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
  lastRunStatus: "success" | "failure" | null;
}

export interface DashboardOverview {
  syncedAt: string;
  totalNav: string;
  totalNavUsdEstimate?: string | null;
  valuationSource?: CatalogValuationSource;
  oracleStatus?: CatalogOracleStatus;
  missingPriceReasons?: string[];
  denominationTotals?: Array<{
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
  valueUsdEstimate?: string | null;
  weightBps: number;
  liquidBalance: string;
  collateralAmount: string;
  debtAmount: string;
  netPositionValue: string;
}

export interface DashboardComposition {
  syncedAt: string;
  totalNav: string;
  totalNavUsdEstimate?: string | null;
  items: DashboardCompositionItem[];
}

export interface MonitoringAlert {
  kind: string;
  severity: "warning" | "critical";
  message: string;
}

export interface MonitoringThresholds {
  maxSnapshotAgeSeconds: number;
  maxSyncDurationMs: number;
  maxFailureRatio: number;
  maxConsecutiveFailures: number;
}

export interface MonitoringStatus {
  healthy: boolean;
  degraded: boolean;
  evaluatedAt: string;
  snapshotAgeSeconds: number | null;
  consecutiveFailures: number;
  lastRun: {
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
  } | null;
  activeAlerts: MonitoringAlert[];
  thresholds: MonitoringThresholds;
}

export interface DashboardBundle {
  overview: DashboardOverview;
  composition: DashboardComposition;
  arkas: Page<RankedArkaCatalogEntry>;
  featuredHistory: Record<string, Page<ArkaHistoryPoint>>;
  managers: Page<RankedManagerCatalogEntry>;
  monitoring: MonitoringStatus;
}

export interface DiscoverBundle {
  overview: DashboardOverview;
  arkas: Page<RankedArkaCatalogEntry>;
  featuredHistory?: Record<string, Page<ArkaHistoryPoint>>;
  managers: Page<RankedManagerCatalogEntry>;
  assets: Page<RankedAssetCatalogEntry>;
}

export interface DiscoverQuery {
  search?: string;
  curated?: boolean;
}

export interface ExplorerQuery {
  search?: string;
}

export interface ManagerDetailBundle {
  manager: RankedManagerCatalogEntry;
  history: Page<ManagerHistoryPoint>;
  arkas: Page<RankedArkaCatalogEntry>;
}

export interface AssetDetailBundle {
  asset: RankedAssetCatalogEntry;
  history: Page<AssetHistoryPoint>;
  arkas: Page<RankedArkaCatalogEntry>;
}

export interface ArkaDetailBundle {
  arka: RankedArkaCatalogEntry;
  history: Page<ArkaHistoryPoint>;
  assets: ArkaAssetExposure[];
  portfolio: ArkaPortfolio;
  activity: Page<ActivityEntry>;
}
