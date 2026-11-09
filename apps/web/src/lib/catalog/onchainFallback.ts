import { readFileSync } from "node:fs";
import { Address, Contract, TransactionBuilder, nativeToScVal, rpc, xdr } from "@stellar/stellar-sdk";
import mainnetDeployments from "../../../config/deployments.mainnet.json";
import testnetDeployments from "../../../config/deployments.testnet.json";
import type { NextRequest } from "next/server";
import { ARKA_REGISTRY, BLEND_MARKET_ID, SIM_ACCOUNT } from "@/lib/config";
import { resolveArkafundDeployments, type ArkafundNetworkTarget } from "@/lib/runtime/protocolSupport";
import { jsonNoStore, redactApiText } from "@/lib/server/apiHardening";
import { RPC_URL, TESTNET } from "@/lib/soroban";
import type {
  ActivityEntry,
  ArkaAssetExposure,
  ArkaHistoryPoint,
  ArkaPortfolio,
  ArkaPortfolioItem,
  AssetHistoryPoint,
  CatalogAssetIdentity,
  CatalogEconomicMetrics,
  CatalogOracleStatus,
  CatalogValuationSource,
  DashboardComposition,
  DashboardCompositionItem,
  DashboardOverview,
  FeeSummary,
  ManagerHistoryPoint,
  MonitoringStatus,
  Page,
  RankedArkaCatalogEntry,
  RankedAssetCatalogEntry,
  RankedManagerCatalogEntry,
} from "./types";
import { findCoreStellarAssetByContract } from "./coreStellarAssetRegistry";

const DEFAULT_REGISTRY_PAGE_SIZE = 50;
const DEFAULT_MAX_ARKAS = 100;
const DEFAULT_CACHE_TTL_MS = 60_000;
const DEFAULT_CONCURRENCY = 6;
const DEFAULT_HISTORY_LIMIT = 96;
const USD_PRICE_SCALE = 10_000_000;
const BLEND_PROTOCOL_SCVAL = xdr.ScVal.scvVec([xdr.ScVal.scvSymbol("Blend")]);
const CONTRACT_ID_RE = /^C[A-Z2-7]{55}$/;

type SnapshotFailure = {
  subject: string;
  message: string;
};

export interface OnchainCatalogSnapshot {
  source: "onchain_fallback";
  candidateSource: OnchainCatalogCandidateSource;
  syncedAt: string;
  arkas: RankedArkaCatalogEntry[];
  managers: RankedManagerCatalogEntry[];
  assets: RankedAssetCatalogEntry[];
  failures: SnapshotFailure[];
  observedHistory?: OnchainCatalogObservedHistory;
}

export type OnchainCatalogCandidateSource =
  | "registry"
  | "release_manifest"
  | "configured_runtime_arkas"
  | "configured_routing_assets";

export interface OnchainCatalogCandidateResolution {
  ids: string[];
  source: OnchainCatalogCandidateSource;
  warnings: SnapshotFailure[];
}

export interface OnchainCatalogObservedHistory {
  arkas: Record<string, ArkaHistoryPoint[]>;
  managers: Record<string, ManagerHistoryPoint[]>;
  assets: Record<string, AssetHistoryPoint[]>;
}

type SnapshotCache = {
  expiresAt: number;
  snapshot: OnchainCatalogSnapshot;
};

type RuntimeState = {
  cache: SnapshotCache | null;
  inFlight: Promise<OnchainCatalogSnapshot> | null;
  observedHistory: OnchainCatalogObservedHistory;
};

type ArkaCreditPositionValue = {
  marketId: number;
  asset: string;
  collateralAmount: number;
  debtAmount: number;
  netValue: number;
};

type OnchainValuationConfig = {
  oracleGuard: string | null;
  contractToSymbol: Map<string, string>;
};

type AssetUsdPrice = {
  assetContract: string;
  priceBase: number | null;
  source: "usd_stablecoin_parity" | "oracle_verified" | "unavailable";
  missingReason: string | null;
};

type ScValNumberReaders = {
  i32?: () => number;
  i64?: () => { toString: () => string } | number;
  u32?: () => number;
  u64?: () => { toString: () => string } | number;
  i128?: () => { lo: () => { toString: () => string } | number };
  u128?: () => { lo: () => { toString: () => string } | number };
};

declare global {
  var __arkafundOnchainCatalogState: RuntimeState | undefined;
  var __arkafundOnchainValuationConfig: OnchainValuationConfig | undefined;
}

function runtimeState(): RuntimeState {
  globalThis.__arkafundOnchainCatalogState ??= {
    cache: null,
    inFlight: null,
    observedHistory: {
      arkas: {},
      managers: {},
      assets: {},
    },
  };
  return globalThis.__arkafundOnchainCatalogState;
}

export async function readOnchainCatalogResponse(
  request: NextRequest,
  pathSegments: string[],
): Promise<Response> {
  if (request.method !== "GET") {
    return jsonNoStore(
      { error: "catalog_method_not_allowed", message: "Only GET is supported." },
      { status: 405 },
    );
  }

  try {
    const snapshot = await readOnchainCatalogSnapshot();
    const pathname = `/${pathSegments.join("/")}`;
    const resolved = resolveOnchainCatalogPayload(
      snapshot,
      pathname,
      request.nextUrl.searchParams,
    );
    if (resolved.status !== 200) {
      return jsonNoStore(resolved.body, { status: resolved.status });
    }
    return jsonNoStore(resolved.body, {
      status: 200,
      headers: {
        "x-arkafund-catalog-source": snapshot.source,
      },
    });
  } catch (error) {
    return jsonNoStore(
      {
        error: "catalog_onchain_fallback_failed",
        message: redactApiText(error, "Unable to read catalog from Soroban."),
      },
      { status: 503 },
    );
  }
}

export async function readOnchainCatalogSnapshot(
  nowMs = Date.now(),
): Promise<OnchainCatalogSnapshot> {
  const state = runtimeState();
  if (state.cache && state.cache.expiresAt > nowMs) {
    return state.cache.snapshot;
  }
  if (state.inFlight) {
    return state.inFlight;
  }

  state.inFlight = buildOnchainCatalogSnapshot()
    .then((snapshot) => {
      const observedSnapshot = attachObservedHistory(state, snapshot);
      state.cache = {
        expiresAt: Date.now() + readIntegerEnv("CATALOG_ONCHAIN_FALLBACK_TTL_MS", DEFAULT_CACHE_TTL_MS),
        snapshot: observedSnapshot,
      };
      return observedSnapshot;
    })
    .finally(() => {
      state.inFlight = null;
    });

  return state.inFlight;
}

export function resolveOnchainCatalogPayload(
  snapshot: OnchainCatalogSnapshot,
  pathname: string,
  searchParams: URLSearchParams,
): { status: number; body: unknown } {
  const normalizedPathname = normalizePathname(pathname);

  if (normalizedPathname === "/health") {
    return {
      status: 200,
      body: {
        healthy: snapshot.failures.length === 0,
        degraded: snapshot.failures.length > 0,
        evaluatedAt: snapshot.syncedAt,
        source: snapshot.source,
        indexedArkas: snapshot.arkas.length,
        failedArkas: snapshot.failures.length,
      },
    };
  }

  if (normalizedPathname === "/v1/metrics") {
    return { status: 200, body: buildMetrics(snapshot) };
  }

  if (normalizedPathname === "/v1/dashboard/overview") {
    return { status: 200, body: buildDashboardOverview(snapshot) };
  }

  if (normalizedPathname === "/v1/dashboard/composition") {
    return {
      status: 200,
      body: buildDashboardComposition(
        snapshot,
        parseBoundedInteger(searchParams.get("limit"), 8, 1, 100),
      ),
    };
  }

  if (normalizedPathname === "/v1/monitoring/status") {
    return { status: 200, body: buildMonitoringStatus(snapshot) };
  }

  if (normalizedPathname === "/v1/arkas") {
    return {
      status: 200,
      body: buildPage(
        applyArkaQuery(snapshot.arkas, searchParams),
        searchParams,
        24,
      ),
    };
  }

  if (normalizedPathname.startsWith("/v1/arkas/")) {
    return resolveArkaPayload(snapshot, normalizedPathname, searchParams);
  }

  if (normalizedPathname === "/v1/managers") {
    return {
      status: 200,
      body: buildPage(
        applyManagerQuery(snapshot.managers, searchParams),
        searchParams,
        24,
      ),
    };
  }

  if (normalizedPathname.startsWith("/v1/managers/")) {
    return resolveManagerPayload(snapshot, normalizedPathname, searchParams);
  }

  if (normalizedPathname === "/v1/assets") {
    return {
      status: 200,
      body: buildPage(
        applyAssetQuery(snapshot.assets, searchParams),
        searchParams,
        24,
      ),
    };
  }

  if (normalizedPathname.startsWith("/v1/assets/")) {
    return resolveAssetPayload(snapshot, normalizedPathname, searchParams);
  }

  return {
    status: 404,
    body: { error: "catalog_route_not_found", message: `Unsupported catalog path ${normalizedPathname}.` },
  };
}

async function buildOnchainCatalogSnapshot(): Promise<OnchainCatalogSnapshot> {
  const syncedAt = new Date().toISOString();
  const context = await createSorobanReadContext();
  const failures: SnapshotFailure[] = [];
  const registryId = resolveOnchainCatalogRegistryId();
  let registryReadSucceeded = Boolean(registryId);
  const registryArkas = registryId
    ? await readRegistryArkaIds(context, registryId).catch((error) => {
        registryReadSucceeded = false;
        failures.push({
          subject: registryId,
          message: `Unable to read Arka registry: ${describeError(error, "registry read failed")}`,
        });
        return [];
      })
    : [];
  if (!registryId) {
    failures.push({
      subject: "ARKA_REGISTRY",
      message: "ARKA_REGISTRY is not configured; using runtime Arka candidates when available.",
    });
  }
  const candidateResolution = resolveOnchainCatalogCandidateArkas(
    registryArkas,
    resolveOnchainCatalogCandidateEnv(),
  );
  if (candidateResolution.ids.length === 0) {
    if (registryId && registryReadSucceeded) {
      return {
        source: "onchain_fallback",
        candidateSource: "registry",
        syncedAt,
        arkas: [],
        managers: [],
        assets: [],
        failures,
      };
    }
    failures.push(...candidateResolution.warnings);
    throw new Error(
      "No Arka candidates are available for the catalog fallback. Configure ARKA_REGISTRY or CATALOG_FALLBACK_ARKAS with deployed Arka contract IDs.",
    );
  }
  failures.push(...candidateResolution.warnings);
  const maxArkas = readIntegerEnv("CATALOG_ONCHAIN_FALLBACK_MAX_ARKAS", DEFAULT_MAX_ARKAS);
  const selectedArkas = candidateResolution.ids.slice(0, maxArkas);
  const entries = await mapWithConcurrency(
    selectedArkas,
    readIntegerEnv("CATALOG_ONCHAIN_FALLBACK_CONCURRENCY", DEFAULT_CONCURRENCY),
    async (arkaId) => {
      try {
        const entry = await readArkaCatalogEntry(context, arkaId, syncedAt);
        if (entry.navUnavailableReason) failures.push({subject:arkaId,message:entry.navUnavailableReason});
        return entry;
      } catch (error) {
        failures.push({
          subject: arkaId,
          message: describeError(error, "Arka catalog read failed."),
        });
        return null;
      }
    },
  );

  const arkas = entries
    .filter((entry): entry is RankedArkaCatalogEntry => Boolean(entry))
    .sort(compareArkasByUsdThenNav)
    .map((entry, index) => ({ ...entry, rank: index + 1 }));
  const managers = buildManagerCatalog(arkas, syncedAt);
  const assets = buildAssetCatalog(arkas, syncedAt);

  return {
    source: "onchain_fallback",
    candidateSource: candidateResolution.source,
    syncedAt,
    arkas,
    managers,
    assets,
    failures,
  };
}

export function resolveOnchainCatalogCandidateArkas(
  registryArkas: string[],
  env: Pick<NodeJS.ProcessEnv, string> = process.env,
): OnchainCatalogCandidateResolution {
  const registryIds = normalizeCandidateIds(registryArkas);
  const explicitIds = normalizeCandidateIds([
    env.CATALOG_FALLBACK_ARKAS,
    env.NEXT_PUBLIC_CATALOG_FALLBACK_ARKAS,
    env.NEXT_PUBLIC_ARKA_ID,
  ]);
  const releaseIds = normalizeCandidateIds([
    ...explicitIds,
    ...readDeploymentReleaseArkaIds(env as NodeJS.ProcessEnv),
  ]);

  if (releaseIds.length > 0 && shouldPreferReleaseCatalog(env)) {
    return {
      ids: releaseIds,
      source: "release_manifest",
      warnings: [],
    };
  }

  if (registryIds.length > 0) {
    const ids =
      releaseIds.length > 0
        ? normalizeCandidateIds([...registryIds, ...releaseIds])
        : registryIds;
    return {
      ids,
      source: "registry",
      warnings: [],
    };
  }

  if (explicitIds.length > 0) {
    return {
      ids: explicitIds,
      source: "configured_runtime_arkas",
      warnings: [
        {
          subject: "CATALOG_CANDIDATES",
          message:
            "Registry returned no Arkas; catalog fallback is reading explicitly configured runtime Arka contracts.",
        },
      ],
    };
  }

  const routingCandidateIds = normalizeCandidateIds([
    env.NEXT_PUBLIC_ROUTING_ASSET_A,
    env.NEXT_PUBLIC_ROUTING_ASSET_B,
  ]);
  if (routingCandidateIds.length > 0) {
    return {
      ids: routingCandidateIds,
      source: "configured_routing_assets",
      warnings: [
        {
          subject: "CATALOG_CANDIDATES",
          message:
            "Registry returned no Arkas and no explicit catalog fallback list is configured; trying configured routing asset contracts as read-only candidates.",
        },
      ],
    };
  }

  return {
    ids: [],
    source: "configured_runtime_arkas",
    warnings: [
      {
        subject: "CATALOG_CANDIDATES",
        message:
          "Registry returned no Arkas and no runtime Arka candidates are configured.",
      },
    ],
  };
}

function shouldPreferReleaseCatalog(env: Pick<NodeJS.ProcessEnv, string>): boolean {
  const explicit = String(env.CATALOG_FALLBACK_PREFER_CONFIGURED_ARKAS ?? "")
    .trim()
    .toLowerCase();
  if (["1", "true", "yes"].includes(explicit)) return true;
  if (["0", "false", "no"].includes(explicit)) return false;
  return resolveArkafundDeployments(env as NodeJS.ProcessEnv).networkTarget === "mainnet";
}

function readDeploymentReleaseArkaIds(
  env: NodeJS.ProcessEnv = process.env,
): string[] {
  const resolution = resolveArkafundDeployments(env);
  if (resolution.networkTarget !== "mainnet") return [];

  if (resolution.pathSource !== "env_path") {
    return extractReleaseArkaIds(
      resolution.networkTarget === "mainnet" ? mainnetDeployments : testnetDeployments,
    );
  }

  try {
    return extractReleaseArkaIds(
      JSON.parse(readFileSync(resolution.deploymentsPath, "utf8")) as unknown,
    );
  } catch {
    return [];
  }
}

export function extractReleaseArkaIds(payload: unknown): string[] {
  if (!isRecord(payload)) return [];
  const candidates: unknown[] = [];
  const executionVenues = isRecord(payload.executionVenues)
    ? payload.executionVenues
    : {};
  for (const venue of Object.values(executionVenues)) {
    if (!isRecord(venue)) continue;
    const canary = isRecord(venue.mainnetCanary) ? venue.mainnetCanary : {};
    candidates.push(canary.arka);
  }

  const validations = isRecord(payload.validations) ? payload.validations : {};
  const postUpgrade = isRecord(validations.mainnetPostUpgradeCanary)
    ? validations.mainnetPostUpgradeCanary
    : {};
  candidates.push(
    postUpgrade.arka,
    ...(Array.isArray(postUpgrade.managerArkasBefore)
      ? postUpgrade.managerArkasBefore
      : []),
    ...(Array.isArray(postUpgrade.managerArkasAfter)
      ? postUpgrade.managerArkasAfter
      : []),
  );
  for (const key of ["routingCanary", "killSwitchCanary", "blendAccountingCanary"]) {
    const nested = isRecord(postUpgrade[key]) ? postUpgrade[key] : {};
    candidates.push(nested.arka);
  }

  const accountingPatch = isRecord(validations.mainnetArkaAccountingPatch)
    ? validations.mainnetArkaAccountingPatch
    : {};
  for (const key of ["upgradedExistingCanary", "freshBlendCanary"]) {
    const nested = isRecord(accountingPatch[key]) ? accountingPatch[key] : {};
    candidates.push(nested.arka);
  }

  return normalizeCandidateIds(candidates.map((candidate) => String(candidate ?? "")));
}

function normalizeCandidateIds(values: Array<string | null | undefined>): string[] {
  const seen = new Set<string>();
  const ids: string[] = [];
  for (const value of values) {
    for (const rawPart of String(value ?? "").split(",")) {
      const candidate = rawPart.trim();
      if (!candidate || !candidate.startsWith("C")) continue;
      const normalized = candidate.toUpperCase();
      if (seen.has(normalized)) continue;
      seen.add(normalized);
      ids.push(candidate);
    }
  }
  return ids;
}

function readBundledDeploymentContract(
  networkTarget: ArkafundNetworkTarget,
  contractName: string,
): string | null {
  const payload: unknown = networkTarget === "mainnet" ? mainnetDeployments : testnetDeployments;
  if (!isRecord(payload)) return null;
  const contracts = isRecord(payload.contracts) ? payload.contracts : {};
  return contractIdOrNull(contracts[contractName]);
}

function readDeploymentContract(
  contractName: string,
  env: NodeJS.ProcessEnv = process.env,
): string | null {
  const resolution = resolveArkafundDeployments(env);
  if (resolution.pathSource !== "env_path") {
    const bundledContract = readBundledDeploymentContract(
      resolution.networkTarget,
      contractName,
    );
    if (bundledContract) return bundledContract;
  }

  try {
    const payload = JSON.parse(readFileSync(resolution.deploymentsPath, "utf8")) as unknown;
    if (!isRecord(payload)) return null;
    const contracts = isRecord(payload.contracts) ? payload.contracts : {};
    return contractIdOrNull(contracts[contractName]);
  } catch {
    return null;
  }
}

export function resolveOnchainCatalogRegistryId(
  env: NodeJS.ProcessEnv = process.env,
): string | null {
  const deploymentRegistry = readDeploymentContract("arkaRegistry", env);
  const envRegistry = contractIdOrNull(env.NEXT_PUBLIC_ARKA_REGISTRY) ?? contractIdOrNull(ARKA_REGISTRY);
  const networkTarget = resolveArkafundDeployments(env).networkTarget;

  if (networkTarget === "mainnet") {
    return deploymentRegistry ?? envRegistry;
  }
  return envRegistry ?? deploymentRegistry;
}

function resolveOnchainCatalogCandidateEnv(): Pick<NodeJS.ProcessEnv, string> {
  if (resolveArkafundDeployments(process.env).networkTarget !== "mainnet") {
    return process.env;
  }

  return {
    CATALOG_FALLBACK_ARKAS: process.env.CATALOG_FALLBACK_ARKAS,
    NEXT_PUBLIC_CATALOG_FALLBACK_ARKAS: process.env.NEXT_PUBLIC_CATALOG_FALLBACK_ARKAS,
    CATALOG_FALLBACK_PREFER_CONFIGURED_ARKAS: process.env.CATALOG_FALLBACK_PREFER_CONFIGURED_ARKAS,
    ARKAFUND_NETWORK_TARGET: process.env.ARKAFUND_NETWORK_TARGET,
    NEXT_PUBLIC_ARKAFUND_NETWORK_TARGET: process.env.NEXT_PUBLIC_ARKAFUND_NETWORK_TARGET,
    ARKAFUND_DEPLOYMENTS_PATH: process.env.ARKAFUND_DEPLOYMENTS_PATH,
    NEXT_PUBLIC_STELLAR_NETWORK: process.env.NEXT_PUBLIC_STELLAR_NETWORK,
    STELLAR_NETWORK_PASSPHRASE: process.env.STELLAR_NETWORK_PASSPHRASE,
  };
}

function readOnchainValuationConfig(): OnchainValuationConfig {
  if (globalThis.__arkafundOnchainValuationConfig) {
    return globalThis.__arkafundOnchainValuationConfig;
  }

  const contractToSymbol = new Map<string, string>();
  let oracleGuard: string | null = contractIdOrNull(process.env.NEXT_PUBLIC_ORACLE_GUARD);

  try {
    const deploymentsPath = resolveArkafundDeployments(process.env).deploymentsPath;
    const payload = JSON.parse(readFileSync(deploymentsPath, "utf8")) as unknown;
    if (isRecord(payload)) {
      const contracts = isRecord(payload.contracts) ? payload.contracts : {};
      const oracle = isRecord(payload.oracle) ? payload.oracle : {};
      const validations = isRecord(payload.validations) ? payload.validations : {};
      const oracleGuardValidation = isRecord(validations.oracleGuard)
        ? validations.oracleGuard
        : {};
      const validationContracts = isRecord(oracleGuardValidation.contracts)
        ? oracleGuardValidation.contracts
        : {};

      oracleGuard =
        contractIdOrNull(process.env.NEXT_PUBLIC_ORACLE_GUARD) ??
        contractIdOrNull(contracts.oracleGuard) ??
        contractIdOrNull(oracle.oracleGuard) ??
        contractIdOrNull(validationContracts.oracleGuard);

      const assets = isRecord(payload.assets) ? payload.assets : {};
      const contractIds = isRecord(assets.contractIds) ? assets.contractIds : {};
      for (const [symbol, contract] of Object.entries(contractIds)) {
        if (typeof symbol === "string" && contractIdOrNull(contract)) {
          contractToSymbol.set(String(contract).toUpperCase(), symbol.toUpperCase());
        }
      }
      const tokens = Array.isArray(assets.tokens) ? assets.tokens : [];
      for (const token of tokens) {
        if (!isRecord(token)) continue;
        const symbol = typeof token.symbol === "string" ? token.symbol.toUpperCase() : null;
        const contract = contractIdOrNull(token.contractId);
        if (symbol && contract) {
          contractToSymbol.set(contract, symbol);
        }
      }
    }
  } catch {}

  const config = { oracleGuard, contractToSymbol };
  globalThis.__arkafundOnchainValuationConfig = config;
  return config;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function contractIdOrNull(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim().toUpperCase();
  return CONTRACT_ID_RE.test(normalized) ? normalized : null;
}

function formatAssetPriceLabel(assetContract: string): string {
  const identity = buildOnchainAssetIdentity(assetContract);
  return identity?.symbol ?? `${assetContract.slice(0, 6)}...${assetContract.slice(-4)}`;
}

function compareArkasByUsdThenNav(left: RankedArkaCatalogEntry, right: RankedArkaCatalogEntry): number {
  const leftValue = parseCatalogNumber(left.economics?.navUsdEstimate ?? left.nav);
  const rightValue = parseCatalogNumber(right.economics?.navUsdEstimate ?? right.nav);
  if (leftValue !== rightValue) return rightValue - leftValue;
  return left.arkaId.localeCompare(right.arkaId);
}

async function createSorobanReadContext(): Promise<{
  server: rpc.Server;
  source: Awaited<ReturnType<rpc.Server["getAccount"]>>;
}> {
  const server = new rpc.Server(RPC_URL, { allowHttp: true });
  const source = await server.getAccount(SIM_ACCOUNT);
  return { server, source };
}

async function readRegistryArkaIds(
  context: Awaited<ReturnType<typeof createSorobanReadContext>>,
  registryId: string,
): Promise<string[]> {
  const ids: string[] = [];
  const pageSize = readIntegerEnv("CATALOG_ONCHAIN_FALLBACK_PAGE_SIZE", DEFAULT_REGISTRY_PAGE_SIZE);
  const maxArkas = readIntegerEnv("CATALOG_ONCHAIN_FALLBACK_MAX_ARKAS", DEFAULT_MAX_ARKAS);

  for (let offset = 0; offset < maxArkas; offset += pageSize) {
    const retval = await simulateReadonly(context, registryId, "get_arkas", [
      xdr.ScVal.scvU32(offset),
      xdr.ScVal.scvU32(pageSize),
    ]);
    const page = parseAddressVec(retval);
    ids.push(...page);
    if (page.length < pageSize || ids.length >= maxArkas) {
      break;
    }
  }

  return ids.slice(0, maxArkas);
}

async function readArkaCatalogEntry(
  context: Awaited<ReturnType<typeof createSorobanReadContext>>,
  arkaId: string,
  syncedAt: string,
): Promise<RankedArkaCatalogEntry> {
  const [manager, valuation, denominationContract, shareToken, whitelistContracts, fees] =
    await Promise.all([
      readAddressMethod(context, arkaId, "manager"),
      readNumberMethod(context, arkaId, "nav").then(
        (value) => ({ nav: numberToCatalogString(value), reason: null as string | null }),
        () => ({ nav: null, reason: "nav_unavailable: on-chain NAV simulation failed" }),
      ),
      readAssetContractMethod(context, arkaId, "denomination"),
      readOptionalAddressMethod(context, arkaId, "share_token"),
      readWhitelist(context, arkaId),
      readFees(context, arkaId),
    ]);

  const [curated, delisted, creditValues] = await Promise.all([
    readRegistryBool(context, "is_manager_curated", manager),
    readRegistryBool(context, "is_delisted", arkaId),
    readCreditPositionValues(context, arkaId),
  ]);
  const assets = await buildArkaAssetExposures(
    context,
    arkaId,
    denominationContract,
    whitelistContracts,
    creditValues,
    syncedAt,
  );

  const entryWithoutEconomics: RankedArkaCatalogEntry = {
    rank: 0,
    arkaId,
    manager,
    curated,
    delisted,
    nav: valuation.nav,
    navUnavailableReason: valuation.reason,
    profitBase: null,
    volumeBase: null,
    denominationContract,
    whitelistContracts,
    shareToken,
    fees,
    assets,
    syncedAt,
  };
  const economics = await buildOnchainArkaEconomics(context, entryWithoutEconomics);
  return {
    ...entryWithoutEconomics,
    economics,
  };
}

function buildOnchainAssetIdentity(contract: string | null): CatalogAssetIdentity | null {
  if (!contract) return null;
  const registryAsset = findCoreStellarAssetByContract(contract);
  if (!registryAsset) {
    const symbol = readOnchainValuationConfig().contractToSymbol.get(contract.toUpperCase()) ?? null;
    return {
      contract,
      symbol,
      label: symbol,
      decimals: 7,
      usdPegged: symbol === "USDC",
    };
  }
  return {
    contract,
    symbol: registryAsset.symbol,
    label: registryAsset.label,
    decimals: registryAsset.decimals,
    usdPegged: registryAsset.symbol === "USDC",
  };
}

function buildEmptyPeriodMetric(): CatalogEconomicMetrics["returns"]["1d"] {
  return { amount: null, bps: null };
}

async function buildOnchainArkaEconomics(
  context: Awaited<ReturnType<typeof createSorobanReadContext>>,
  entry: RankedArkaCatalogEntry,
): Promise<CatalogEconomicMetrics> {
  const denominationAsset = buildOnchainAssetIdentity(entry.denominationContract);
  const assetPrices = await mapWithConcurrency(
    entry.assets,
    DEFAULT_CONCURRENCY,
    async (asset) => readAssetUsdPrice(context, asset.assetContract),
  );
  const priceByAsset = new Map(assetPrices.map((price) => [price.assetContract, price]));
  const assetUsdValues = new Map<string, string>();
  const missingPriceReasons = new Set<string>();
  let navUsdTotal = 0;
  let missingPricing = entry.nav === null;
  let usesOracle = false;

  if (entry.nav === null) {
    missingPriceReasons.add(entry.navUnavailableReason ?? "The on-chain NAV calculation is unavailable.");
  }

  if (!denominationAsset) {
    missingPriceReasons.add("No denomination asset is declared for this Arka.");
  }

  for (const asset of entry.assets) {
    const managedAmount = parseCatalogNumber(asset.netManagedAmount);
    if (managedAmount === 0) {
      assetUsdValues.set(asset.assetContract, "0");
      continue;
    }

    const price = priceByAsset.get(asset.assetContract);
    if (!price || price.priceBase === null) {
      missingPricing = true;
      missingPriceReasons.add(
        price?.missingReason ?? `USD price is missing for ${formatAssetPriceLabel(asset.assetContract)}.`,
      );
      continue;
    }

    usesOracle ||= price.source === "oracle_verified";
    const usdValue = Math.trunc((managedAmount * price.priceBase) / USD_PRICE_SCALE);
    navUsdTotal += usdValue;
    assetUsdValues.set(asset.assetContract, numberToCatalogString(usdValue));
  }

  const navUsdEstimate = missingPricing ? null : numberToCatalogString(navUsdTotal);
  const totalManagedUsd = navUsdEstimate
    ? sumNumbers([...assetUsdValues.values()].map((value) => parseCatalogNumber(value)))
    : 0;
  const totalManaged = sumNumbers(entry.assets.map((asset) => parseCatalogNumber(asset.netManagedAmount)));

  return {
    denominationAsset,
    navDenomination: entry.nav,
    navUsdEstimate,
    sharePrice: null,
    returns: {
      "1d": buildEmptyPeriodMetric(),
      "7d": buildEmptyPeriodMetric(),
      "30d": buildEmptyPeriodMetric(),
      "1y": buildEmptyPeriodMetric(),
      all: buildEmptyPeriodMetric(),
    },
    pnl: { amount: entry.profitBase ?? null, bps: null },
    volume: { amount: entry.volumeBase ?? null, bps: null },
    flows: {
      depositVolume: null,
      redeemVolume: null,
      netUserFlow: null,
      activeUsers: null,
    },
    fees: entry.fees,
    portfolioWeights: entry.assets.map((asset) => {
      const managedAmount = parseCatalogNumber(asset.netManagedAmount);
      const usdValue = assetUsdValues.get(asset.assetContract) ?? null;
      const usdAmount = usdValue === null ? 0 : parseCatalogNumber(usdValue);
      return {
        assetContract: asset.assetContract,
        weightBps:
          totalManagedUsd > 0
            ? Math.round((usdAmount / totalManagedUsd) * 10_000)
            : totalManaged > 0
              ? Math.round((managedAmount / totalManaged) * 10_000)
              : 0,
        valueDenomination: asset.netManagedAmount,
        valueUsdEstimate: usdValue,
      };
    }),
    oracleStatus: navUsdEstimate
      ? usesOracle
        ? "verified"
        : "not_required_usd_stablecoin"
      : "missing_price",
    valuationSource: navUsdEstimate
      ? usesOracle
        ? "oracle_verified"
        : "usd_stablecoin_parity"
      : "unavailable",
    missingPriceReasons: [...missingPriceReasons],
  };
}

async function readAssetUsdPrice(
  context: Awaited<ReturnType<typeof createSorobanReadContext>>,
  assetContract: string,
): Promise<AssetUsdPrice> {
  const identity = buildOnchainAssetIdentity(assetContract);
  const label = identity?.symbol ?? formatAssetPriceLabel(assetContract);
  if (identity?.usdPegged) {
    return {
      assetContract,
      priceBase: USD_PRICE_SCALE,
      source: "usd_stablecoin_parity",
      missingReason: null,
    };
  }

  const oracleGuard = readOnchainValuationConfig().oracleGuard;
  if (!oracleGuard) {
    return {
      assetContract,
      priceBase: null,
      source: "unavailable",
      missingReason: `USD oracle source is not configured for ${label}.`,
    };
  }

  try {
    const inspection = parseOracleInspection(
      await simulateReadonly(context, oracleGuard, "inspect_stellar", [
        xdr.ScVal.scvAddress(Address.fromString(assetContract).toScAddress()),
      ]),
    );
    if (inspection.price > 0 && inspection.timestamp > 0) {
      return {
        assetContract,
        priceBase: inspection.price,
        source: "oracle_verified",
        missingReason: null,
      };
    }
  } catch {}

  return {
    assetContract,
    priceBase: null,
    source: "unavailable",
    missingReason: `USD oracle price is not currently available for ${label}.`,
  };
}

function parseOracleInspection(retval: xdr.ScVal | null | undefined): {
  price: number;
  timestamp: number;
} {
  const entries = parseMapEntries(retval);
  let price = 0;
  let timestamp = 0;
  for (const entry of entries) {
    const key = parseSymbol(entry.key());
    if (key === "price") price = parseScValNumber(entry.val());
    if (key === "timestamp") timestamp = parseScValNumber(entry.val());
  }
  return { price, timestamp };
}

async function buildArkaAssetExposures(
  context: Awaited<ReturnType<typeof createSorobanReadContext>>,
  arkaId: string,
  denominationContract: string | null,
  whitelistContracts: string[],
  creditValues: ArkaCreditPositionValue[],
  syncedAt: string,
): Promise<ArkaAssetExposure[]> {
  const assetSet = new Set<string>();
  if (denominationContract) assetSet.add(denominationContract);
  whitelistContracts.forEach((asset) => assetSet.add(asset));
  creditValues.forEach((position) => assetSet.add(position.asset));

  const assets = await mapWithConcurrency([...assetSet], DEFAULT_CONCURRENCY, async (assetContract) => {
    const liquidBalance = await readLiquidBalance(context, arkaId, assetContract).catch(() => 0);
    const positions = creditValues.filter((position) => position.asset === assetContract);
    const collateralAmount = sumNumbers(positions.map((position) => position.collateralAmount));
    const debtAmount = sumNumbers(positions.map((position) => position.debtAmount));
    const netPositionValue = sumNumbers(positions.map((position) => position.netValue));
    const netManagedAmount = liquidBalance + netPositionValue;
    return {
      assetContract,
      isDenomination: Boolean(denominationContract && assetContract === denominationContract),
      liquidBalance: numberToCatalogString(liquidBalance),
      collateralAmount: numberToCatalogString(collateralAmount),
      debtAmount: numberToCatalogString(debtAmount),
      netManagedAmount: numberToCatalogString(netManagedAmount),
      netPositionValue: numberToCatalogString(netPositionValue),
      marketIds: [...new Set(positions.map((position) => String(position.marketId)))],
      syncedAt,
    } satisfies ArkaAssetExposure;
  });

  return assets.sort((left, right) => {
    if (left.isDenomination !== right.isDenomination) return left.isDenomination ? -1 : 1;
    return parseCatalogNumber(right.netManagedAmount) - parseCatalogNumber(left.netManagedAmount);
  });
}

async function simulateReadonly(
  context: Awaited<ReturnType<typeof createSorobanReadContext>>,
  contractId: string,
  method: string,
  args: xdr.ScVal[] = [],
): Promise<xdr.ScVal | null> {
  const contract = new Contract(contractId);
  const tx = new TransactionBuilder(context.source, {
    fee: "1000",
    networkPassphrase: TESTNET,
  })
    .addOperation(contract.call(method, ...args))
    .setTimeout(30)
    .build();
  const simulation = await context.server.simulateTransaction(tx);
  if (rpc.Api.isSimulationError(simulation)) {
    return null;
  }
  return (simulation as unknown as { result?: { retval?: xdr.ScVal } }).result?.retval ?? null;
}

async function readAddressMethod(
  context: Awaited<ReturnType<typeof createSorobanReadContext>>,
  contractId: string,
  method: string,
): Promise<string> {
  const value = await readOptionalAddressMethod(context, contractId, method);
  if (!value) throw new Error(`${method} returned no address.`);
  return value;
}

async function readOptionalAddressMethod(
  context: Awaited<ReturnType<typeof createSorobanReadContext>>,
  contractId: string,
  method: string,
): Promise<string | null> {
  return parseAddress(await simulateReadonly(context, contractId, method));
}

async function readAssetContractMethod(
  context: Awaited<ReturnType<typeof createSorobanReadContext>>,
  contractId: string,
  method: string,
): Promise<string | null> {
  const retval = await simulateReadonly(context, contractId, method);
  return parseAssetContract(retval) ?? parseAddress(retval);
}

async function readNumberMethod(
  context: Awaited<ReturnType<typeof createSorobanReadContext>>,
  contractId: string,
  method: string,
): Promise<number> {
  return parseScValNumber(await simulateReadonly(context, contractId, method));
}

async function readWhitelist(
  context: Awaited<ReturnType<typeof createSorobanReadContext>>,
  arkaId: string,
): Promise<string[]> {
  const retval = await simulateReadonly(context, arkaId, "whitelist");
  return (retval?.vec?.() ?? [])
    .map((item) => parseAssetContract(item) ?? parseAddress(item))
    .filter((asset): asset is string => Boolean(asset));
}

async function readFees(
  context: Awaited<ReturnType<typeof createSorobanReadContext>>,
  arkaId: string,
): Promise<FeeSummary> {
  const entries = parseMapEntries(await simulateReadonly(context, arkaId, "fees"));
  const byKey = new Map<string, number>();
  entries.forEach((entry) => {
    byKey.set(parseSymbol(entry.key()), parseScValNumber(entry.val()));
  });
  return {
    mgmtBps: byKey.get("mgmt_bps") ?? 0,
    perfBps: byKey.get("perf_bps") ?? 0,
    depositBps: byKey.get("deposit_bps") ?? 0,
    redeemBps: byKey.get("redeem_bps") ?? 0,
  };
}

async function readRegistryBool(
  context: Awaited<ReturnType<typeof createSorobanReadContext>>,
  method: string,
  address: string,
): Promise<boolean> {
  const retval = await simulateReadonly(context, ARKA_REGISTRY, method, [
    xdr.ScVal.scvAddress(Address.fromString(address).toScAddress()),
  ]);
  return parseBool(retval);
}

async function readLiquidBalance(
  context: Awaited<ReturnType<typeof createSorobanReadContext>>,
  arkaId: string,
  assetContract: string,
): Promise<number> {
  return parseScValNumber(
    await simulateReadonly(context, arkaId, "liquid_balance", [
      xdr.ScVal.scvAddress(Address.fromString(assetContract).toScAddress()),
    ]),
  );
}

async function readCreditPositionValues(
  context: Awaited<ReturnType<typeof createSorobanReadContext>>,
  arkaId: string,
): Promise<ArkaCreditPositionValue[]> {
  const retval = await simulateReadonly(context, arkaId, "credit_position_values", [
    BLEND_PROTOCOL_SCVAL,
    nativeToScVal(BigInt(Math.trunc(BLEND_MARKET_ID)), { type: "u128" }),
  ]);
  const items = retval?.vec?.() ?? [];
  return items
    .map((item) => parseCreditPositionValue(item, BLEND_MARKET_ID))
    .filter((item): item is ArkaCreditPositionValue => Boolean(item));
}

function parseCreditPositionValue(
  retval: xdr.ScVal | null | undefined,
  fallbackMarketId: number,
): ArkaCreditPositionValue | null {
  const entries = parseMapEntries(retval);
  if (entries.length === 0) return null;

  let marketId = fallbackMarketId;
  let asset = "";
  let collateralAmount = 0;
  let debtAmount = 0;
  let netValue = 0;

  for (const entry of entries) {
    const key = parseSymbol(entry.key());
    if (key === "market_id") marketId = parseScValNumber(entry.val());
    if (key === "asset") asset = parseAddress(entry.val()) ?? "";
    if (key === "collateral_amount") collateralAmount = parseScValNumber(entry.val());
    if (key === "debt_amount") debtAmount = parseScValNumber(entry.val());
    if (key === "net_value") netValue = parseScValNumber(entry.val());
  }

  if (!asset) return null;
  return {
    marketId,
    asset,
    collateralAmount,
    debtAmount,
    netValue,
  };
}

function buildManagerCatalog(
  arkas: RankedArkaCatalogEntry[],
  syncedAt: string,
): RankedManagerCatalogEntry[] {
  const managerMap = new Map<string, RankedManagerCatalogEntry>();
  for (const arka of arkas) {
    const existing =
      managerMap.get(arka.manager) ??
      ({
        rank: 0,
        manager: arka.manager,
        arkaCount: 0,
        curatedArkaCount: 0,
        delistedArkaCount: 0,
        totalNav: "0",
        syncedAt,
      } satisfies RankedManagerCatalogEntry);
    existing.arkaCount += 1;
    if (arka.curated) existing.curatedArkaCount += 1;
    if (arka.delisted) existing.delistedArkaCount += 1;
    existing.totalNav = numberToCatalogString(
      parseCatalogNumber(existing.totalNav) +
        parseCatalogNumber(arka.economics?.navUsdEstimate ?? arka.nav),
    );
    managerMap.set(arka.manager, existing);
  }
  return [...managerMap.values()]
    .sort(compareCatalogNumbers("totalNav", "desc"))
    .map((entry, index) => ({ ...entry, rank: index + 1 }));
}

function buildAssetCatalog(
  arkas: RankedArkaCatalogEntry[],
  syncedAt: string,
): RankedAssetCatalogEntry[] {
  const assetMap = new Map<
    string,
    RankedAssetCatalogEntry & { managers: Set<string> }
  >();

  for (const arka of arkas) {
    for (const asset of arka.assets) {
      const existing =
        assetMap.get(asset.assetContract) ??
        ({
          rank: 0,
          assetContract: asset.assetContract,
          arkaCount: 0,
          managerCount: 0,
          denominationArkaCount: 0,
          liquidBalance: "0",
          collateralAmount: "0",
          debtAmount: "0",
          netManagedAmount: "0",
          netPositionValue: "0",
          syncedAt,
          managers: new Set<string>(),
        } satisfies RankedAssetCatalogEntry & { managers: Set<string> });
      existing.arkaCount += 1;
      existing.managers.add(arka.manager);
      existing.managerCount = existing.managers.size;
      if (asset.isDenomination) existing.denominationArkaCount += 1;
      existing.liquidBalance = addCatalogStrings(existing.liquidBalance, asset.liquidBalance);
      existing.collateralAmount = addCatalogStrings(existing.collateralAmount, asset.collateralAmount);
      existing.debtAmount = addCatalogStrings(existing.debtAmount, asset.debtAmount);
      existing.netManagedAmount = addCatalogStrings(existing.netManagedAmount, asset.netManagedAmount);
      existing.netPositionValue = addCatalogStrings(existing.netPositionValue, asset.netPositionValue);
      assetMap.set(asset.assetContract, existing);
    }
  }

  return [...assetMap.values()]
    .sort(compareCatalogNumbers("netManagedAmount", "desc"))
    .map((entryWithManagers, index) => {
      const { managers, ...entry } = entryWithManagers;
      void managers;
      return { ...entry, rank: index + 1 };
    });
}

function attachObservedHistory(
  state: RuntimeState,
  snapshot: OnchainCatalogSnapshot,
): OnchainCatalogSnapshot {
  const limit = Math.max(
    1,
    readIntegerEnv("CATALOG_ONCHAIN_HISTORY_LIMIT", DEFAULT_HISTORY_LIMIT),
  );
  const observedHistory = {
    arkas: { ...state.observedHistory.arkas },
    managers: { ...state.observedHistory.managers },
    assets: { ...state.observedHistory.assets },
  };

  for (const arka of snapshot.arkas) {
    observedHistory.arkas[arka.arkaId] = appendHistoryPoint(
      observedHistory.arkas[arka.arkaId] ?? [],
      buildArkaHistoryPoint(arka),
      limit,
    );
  }

  for (const manager of snapshot.managers) {
    observedHistory.managers[manager.manager] = appendHistoryPoint(
      observedHistory.managers[manager.manager] ?? [],
      buildManagerHistoryPoint(manager),
      limit,
    );
  }

  for (const asset of snapshot.assets) {
    observedHistory.assets[asset.assetContract] = appendHistoryPoint(
      observedHistory.assets[asset.assetContract] ?? [],
      buildAssetHistoryPoint(asset),
      limit,
    );
  }

  state.observedHistory = observedHistory;
  return { ...snapshot, observedHistory };
}

function appendHistoryPoint<T extends { syncedAt: string }>(
  items: T[],
  nextPoint: T,
  limit: number,
): T[] {
  const byTimestamp = new Map<string, T>();
  for (const item of items) {
    byTimestamp.set(item.syncedAt, item);
  }
  byTimestamp.set(nextPoint.syncedAt, nextPoint);
  return [...byTimestamp.values()]
    .sort((left, right) => new Date(left.syncedAt).getTime() - new Date(right.syncedAt).getTime())
    .slice(Math.max(0, byTimestamp.size - limit));
}

function buildArkaHistoryPoint(arka: RankedArkaCatalogEntry): ArkaHistoryPoint {
  return {
    arkaId: arka.arkaId,
    syncedAt: arka.syncedAt,
    nav: arka.nav,
    manager: arka.manager,
    curated: arka.curated,
    delisted: arka.delisted,
    shareToken: arka.shareToken,
    rank: arka.rank,
  };
}

function buildManagerHistoryPoint(manager: RankedManagerCatalogEntry): ManagerHistoryPoint {
  return {
    manager: manager.manager,
    syncedAt: manager.syncedAt,
    totalNav: manager.totalNav,
    arkaCount: manager.arkaCount,
    curatedArkaCount: manager.curatedArkaCount,
    delistedArkaCount: manager.delistedArkaCount,
    rank: manager.rank,
  };
}

function buildAssetHistoryPoint(asset: RankedAssetCatalogEntry): AssetHistoryPoint {
  return {
    assetContract: asset.assetContract,
    syncedAt: asset.syncedAt,
    arkaCount: asset.arkaCount,
    managerCount: asset.managerCount,
    denominationArkaCount: asset.denominationArkaCount,
    liquidBalance: asset.liquidBalance,
    collateralAmount: asset.collateralAmount,
    debtAmount: asset.debtAmount,
    netManagedAmount: asset.netManagedAmount,
    netPositionValue: asset.netPositionValue,
    rank: asset.rank,
  };
}

function buildObservedAggregateNavHistory(
  snapshot: OnchainCatalogSnapshot,
): Array<{ syncedAt: string; totalNav: string }> {
  const arkaHistories = snapshot.arkas
    .map((entry) => snapshot.observedHistory?.arkas[entry.arkaId] ?? [])
    .filter((items) => items.length > 0)
    .map((items) =>
      [...items].sort(
        (left, right) => new Date(left.syncedAt).getTime() - new Date(right.syncedAt).getTime(),
      ),
    );

  if (arkaHistories.length === 0) {
    return [];
  }

  const timestamps = Array.from(
    new Set(arkaHistories.flatMap((items) => items.map((item) => item.syncedAt))),
  ).sort((left, right) => new Date(left).getTime() - new Date(right).getTime());

  return timestamps.map((syncedAt) => {
    const totalNav = arkaHistories.reduce((accumulator, items) => {
      const point = [...items]
        .reverse()
        .find((entry) => new Date(entry.syncedAt).getTime() <= new Date(syncedAt).getTime());
      return accumulator + BigInt(point?.nav ?? "0");
    }, BigInt(0));
    return { syncedAt, totalNav: totalNav.toString() };
  });
}

function buildMetrics(snapshot: OnchainCatalogSnapshot): Record<string, unknown> {
  const observedPointCount = Object.values(snapshot.observedHistory?.arkas ?? {})
    .reduce((total, items) => total + items.length, 0);
  return {
    source: snapshot.source,
    candidateSource: snapshot.candidateSource,
    syncedAt: snapshot.syncedAt,
    observedHistoryPoints: observedPointCount,
    totalArkas: snapshot.arkas.length,
    totalManagers: snapshot.managers.length,
    totalAssets: snapshot.assets.length,
    curatedArkas: snapshot.arkas.filter((entry) => entry.curated).length,
    delistedArkas: snapshot.arkas.filter((entry) => entry.delisted).length,
    totalNav: numberToCatalogString(sumNumbers(snapshot.arkas.map((entry) => parseCatalogNumber(entry.nav)))),
    failedArkas: snapshot.failures.length,
  };
}

function buildOnchainDenominationTotals(snapshot: OnchainCatalogSnapshot): DashboardOverview["denominationTotals"] {
  const totals = new Map<
    string,
    {
      denominationAsset: CatalogAssetIdentity | null;
      totalNav: number;
      navUsdEstimate: number | null;
      arkaCount: number;
    }
  >();

  snapshot.arkas.forEach((arka) => {
    const key = arka.economics?.denominationAsset?.contract ?? arka.denominationContract ?? "undeclared";
    const current = totals.get(key) ?? {
      denominationAsset: arka.economics?.denominationAsset ?? null,
      totalNav: 0,
      navUsdEstimate: 0,
      arkaCount: 0,
    };
    current.totalNav += parseCatalogNumber(arka.economics?.navDenomination ?? arka.nav);
    current.arkaCount += 1;
    if (arka.economics?.navUsdEstimate === null || arka.economics?.navUsdEstimate === undefined) {
      current.navUsdEstimate = null;
    } else if (current.navUsdEstimate !== null) {
      current.navUsdEstimate += parseCatalogNumber(arka.economics.navUsdEstimate);
    }
    totals.set(key, current);
  });

  return [...totals.values()].map((item) => ({
    denominationAsset: item.denominationAsset,
    totalNav: numberToCatalogString(item.totalNav),
    navUsdEstimate:
      item.navUsdEstimate === null ? null : numberToCatalogString(item.navUsdEstimate),
    arkaCount: item.arkaCount,
  }));
}

function buildOnchainTotalNavUsdEstimate(snapshot: OnchainCatalogSnapshot): string | null {
  let total = 0;
  for (const arka of snapshot.arkas) {
    const hasManagedExposure =
      parseCatalogNumber(arka.nav) > 0 ||
      arka.assets.some((asset) => parseCatalogNumber(asset.netManagedAmount) !== 0);
    if (!hasManagedExposure) continue;
    if (!arka.economics?.navUsdEstimate) return null;
    total += parseCatalogNumber(arka.economics.navUsdEstimate);
  }
  return numberToCatalogString(total);
}

function buildOnchainMissingPriceReasons(snapshot: OnchainCatalogSnapshot): string[] {
  return [
    ...new Set(snapshot.arkas.flatMap((arka) => arka.economics?.missingPriceReasons ?? [])),
  ];
}

function buildDashboardOverview(snapshot: OnchainCatalogSnapshot): DashboardOverview {
  const totalNav = sumNumbers(
    snapshot.arkas.map((entry) => parseCatalogNumber(entry.economics?.navUsdEstimate ?? entry.nav)),
  );
  const totalNavUsdEstimate = buildOnchainTotalNavUsdEstimate(snapshot);
  const missingPriceReasons = buildOnchainMissingPriceReasons(snapshot);
  const aggregateHistory = buildObservedAggregateNavHistory(snapshot);
  const [oldestHistoryPoint, latestHistoryPoint] =
    aggregateHistory.length >= 2
      ? [aggregateHistory[0], aggregateHistory[aggregateHistory.length - 1]]
      : [null, null];
  const historyDelta =
    oldestHistoryPoint && latestHistoryPoint
      ? parseCatalogNumber(latestHistoryPoint.totalNav) -
        parseCatalogNumber(oldestHistoryPoint.totalNav)
      : null;
  const historyDeltaBps =
    historyDelta !== null &&
    oldestHistoryPoint &&
    parseCatalogNumber(oldestHistoryPoint.totalNav) > 0
      ? Math.trunc(
          (historyDelta / parseCatalogNumber(oldestHistoryPoint.totalNav)) * 10_000,
        )
      : null;
  const largestAsset = snapshot.assets[0];
  const largestAssetWeightBps =
    largestAsset && totalNav > 0
      ? Math.round((parseCatalogNumber(largestAsset.netManagedAmount) / totalNav) * 10_000)
      : null;
  return {
    syncedAt: snapshot.syncedAt,
    totalNav: numberToCatalogString(totalNav),
    totalNavUsdEstimate,
    valuationSource: totalNavUsdEstimate ? buildOnchainAggregateValuationSource(snapshot) : "unavailable",
    oracleStatus: totalNavUsdEstimate ? buildOnchainAggregateOracleStatus(snapshot) : "missing_price",
    missingPriceReasons,
    denominationTotals: buildOnchainDenominationTotals(snapshot),
    totalNavDelta: historyDelta === null ? null : numberToCatalogString(historyDelta),
    totalNavDeltaBps: historyDeltaBps,
    totalArkas: snapshot.arkas.length,
    totalManagers: snapshot.managers.length,
    totalAssets: snapshot.assets.length,
    curatedArkas: snapshot.arkas.filter((entry) => entry.curated).length,
    delistedArkas: snapshot.arkas.filter((entry) => entry.delisted).length,
    largestAssetWeightBps,
    monitoring: {
      healthy: snapshot.failures.length === 0,
      degraded: snapshot.failures.length > 0,
      snapshotAgeSeconds: 0,
      consecutiveFailures: snapshot.failures.length > 0 ? 1 : 0,
      activeAlertCount: snapshot.failures.length,
      lastRunStatus: snapshot.failures.length === snapshot.arkas.length && snapshot.arkas.length > 0 ? "failure" : "success",
    },
    activity: emptyActivitySummary(),
  };
}

function buildOnchainAggregateValuationSource(snapshot: OnchainCatalogSnapshot): CatalogValuationSource {
  return snapshot.arkas.some((entry) => entry.economics?.valuationSource === "oracle_verified")
    ? "oracle_verified"
    : "usd_stablecoin_parity";
}

function buildOnchainAggregateOracleStatus(snapshot: OnchainCatalogSnapshot): CatalogOracleStatus {
  return snapshot.arkas.some((entry) => entry.economics?.oracleStatus === "verified")
    ? "verified"
    : "not_required_usd_stablecoin";
}

function buildDashboardComposition(
  snapshot: OnchainCatalogSnapshot,
  limit: number,
): DashboardComposition {
  const assetUsdContributions = buildAssetUsdContributionMap(snapshot);
  const canUseUsdContributions =
    assetUsdContributions.size > 0 &&
    snapshot.arkas.every((entry) => Boolean(entry.economics?.navUsdEstimate));
  const rankedAssets = canUseUsdContributions
    ? [...snapshot.assets].sort(
        (left, right) =>
          (assetUsdContributions.get(right.assetContract) ?? 0) -
          (assetUsdContributions.get(left.assetContract) ?? 0),
      )
    : snapshot.assets;
  const totalNav = canUseUsdContributions
    ? sumNumbers([...assetUsdContributions.values()])
    : sumNumbers(snapshot.assets.map((entry) => parseCatalogNumber(entry.netManagedAmount)));
  const items: DashboardCompositionItem[] = rankedAssets.slice(0, limit).map((asset, index) => {
    const navContribution = canUseUsdContributions
      ? assetUsdContributions.get(asset.assetContract) ?? 0
      : parseCatalogNumber(asset.netManagedAmount);
    return {
      assetContract: asset.assetContract,
      rank: index + 1,
      arkaCount: asset.arkaCount,
      managerCount: asset.managerCount,
      denominationArkaCount: asset.denominationArkaCount,
      navContribution: numberToCatalogString(navContribution),
      weightBps: totalNav > 0 ? Math.round((navContribution / totalNav) * 10_000) : 0,
      liquidBalance: asset.liquidBalance,
      collateralAmount: asset.collateralAmount,
      debtAmount: asset.debtAmount,
      netPositionValue: asset.netPositionValue,
    };
  });
  return {
    syncedAt: snapshot.syncedAt,
    totalNav: numberToCatalogString(totalNav),
    items,
  };
}

function buildAssetUsdContributionMap(snapshot: OnchainCatalogSnapshot): Map<string, number> {
  const values = new Map<string, number>();
  for (const arka of snapshot.arkas) {
    for (const weight of arka.economics?.portfolioWeights ?? []) {
      if (!weight.valueUsdEstimate) continue;
      values.set(
        weight.assetContract,
        (values.get(weight.assetContract) ?? 0) + parseCatalogNumber(weight.valueUsdEstimate),
      );
    }
  }
  return values;
}

function buildMonitoringStatus(snapshot: OnchainCatalogSnapshot): MonitoringStatus {
  const failedArkas = snapshot.failures.length;
  const healthy = failedArkas === 0;
  return {
    healthy,
    degraded: !healthy,
    evaluatedAt: snapshot.syncedAt,
    snapshotAgeSeconds: 0,
    consecutiveFailures: healthy ? 0 : 1,
    lastRun: {
      runId: `onchain-fallback-${snapshot.syncedAt}`,
      startedAt: snapshot.syncedAt,
      finishedAt: snapshot.syncedAt,
      durationMs: 0,
      status: healthy ? "success" : "failure",
      indexedArkas: snapshot.arkas.length,
      failedArkas,
      totalArkas: snapshot.arkas.length + failedArkas,
      totalNav: numberToCatalogString(sumNumbers(snapshot.arkas.map((entry) => parseCatalogNumber(entry.nav)))),
      errorMessage: failedArkas > 0 ? `${failedArkas} Arka reads failed during live fallback sync.` : null,
    },
    activeAlerts: snapshot.failures.map((failure) => ({
      kind: "onchain_fallback_read",
      severity: "warning",
      message: `${failure.subject}: ${failure.message}`,
    })),
    thresholds: {
      maxSnapshotAgeSeconds: Math.round(readIntegerEnv("CATALOG_ONCHAIN_FALLBACK_TTL_MS", DEFAULT_CACHE_TTL_MS) / 1000),
      maxSyncDurationMs: 30_000,
      maxFailureRatio: 0,
      maxConsecutiveFailures: 0,
    },
  };
}

function resolveArkaPayload(
  snapshot: OnchainCatalogSnapshot,
  pathname: string,
  searchParams: URLSearchParams,
): { status: number; body: unknown } {
  const suffix = pathname.slice("/v1/arkas/".length);
  if (suffix.endsWith("/history")) {
    const arkaId = decodeURIComponent(suffix.slice(0, -"/history".length));
    const arka = snapshot.arkas.find((entry) => entry.arkaId === arkaId);
    return arka
      ? {
          status: 200,
          body: buildHistoryPage(
            snapshot.observedHistory?.arkas[arkaId] ?? [buildArkaHistoryPoint(arka)],
            searchParams,
          ),
        }
      : notFound("arka_not_found", arkaId);
  }
  if (suffix.endsWith("/assets")) {
    const arkaId = decodeURIComponent(suffix.slice(0, -"/assets".length));
    const arka = snapshot.arkas.find((entry) => entry.arkaId === arkaId);
    return arka ? { status: 200, body: arka.assets } : notFound("arka_not_found", arkaId);
  }
  if (suffix.endsWith("/portfolio")) {
    const arkaId = decodeURIComponent(suffix.slice(0, -"/portfolio".length));
    const arka = snapshot.arkas.find((entry) => entry.arkaId === arkaId);
    return arka ? { status: 200, body: buildArkaPortfolio(arka, searchParams) } : notFound("arka_not_found", arkaId);
  }
  if (suffix.endsWith("/activity")) {
    return { status: 200, body: emptyPage<ActivityEntry>(searchParams) };
  }
  const arkaId = decodeURIComponent(suffix);
  const arka = snapshot.arkas.find((entry) => entry.arkaId === arkaId);
  return arka ? { status: 200, body: arka } : notFound("arka_not_found", arkaId);
}

function resolveManagerPayload(
  snapshot: OnchainCatalogSnapshot,
  pathname: string,
  searchParams: URLSearchParams,
): { status: number; body: unknown } {
  const suffix = pathname.slice("/v1/managers/".length);
  if (suffix.endsWith("/history")) {
    const manager = decodeURIComponent(suffix.slice(0, -"/history".length));
    const entry = snapshot.managers.find((item) => item.manager === manager);
    return entry
      ? {
          status: 200,
          body: buildHistoryPage(
            snapshot.observedHistory?.managers[manager] ?? [buildManagerHistoryPoint(entry)],
            searchParams,
          ),
        }
      : notFound("manager_not_found", manager);
  }
  if (suffix.endsWith("/arkas")) {
    const manager = decodeURIComponent(suffix.slice(0, -"/arkas".length));
    return {
      status: 200,
      body: buildPage(
        snapshot.arkas.filter((entry) => entry.manager === manager),
        searchParams,
        24,
      ),
    };
  }
  const manager = decodeURIComponent(suffix);
  const entry = snapshot.managers.find((item) => item.manager === manager);
  return entry ? { status: 200, body: entry } : notFound("manager_not_found", manager);
}

function resolveAssetPayload(
  snapshot: OnchainCatalogSnapshot,
  pathname: string,
  searchParams: URLSearchParams,
): { status: number; body: unknown } {
  const suffix = pathname.slice("/v1/assets/".length);
  if (suffix.endsWith("/history")) {
    const assetContract = decodeURIComponent(suffix.slice(0, -"/history".length));
    const entry = snapshot.assets.find((item) => item.assetContract === assetContract);
    return entry
      ? {
          status: 200,
          body: buildHistoryPage(
            snapshot.observedHistory?.assets[assetContract] ?? [buildAssetHistoryPoint(entry)],
            searchParams,
          ),
        }
      : notFound("asset_not_found", assetContract);
  }
  if (suffix.endsWith("/arkas")) {
    const assetContract = decodeURIComponent(suffix.slice(0, -"/arkas".length));
    return {
      status: 200,
      body: buildPage(
        snapshot.arkas.filter((entry) =>
          entry.assets.some((asset) => asset.assetContract === assetContract),
        ),
        searchParams,
        24,
      ),
    };
  }
  const assetContract = decodeURIComponent(suffix);
  const entry = snapshot.assets.find((item) => item.assetContract === assetContract);
  return entry ? { status: 200, body: entry } : notFound("asset_not_found", assetContract);
}

function buildArkaPortfolio(
  arka: RankedArkaCatalogEntry,
  searchParams: URLSearchParams,
): ArkaPortfolio {
  const limit = parseBoundedInteger(searchParams.get("limit"), 24, 1, 100);
  const totalNavContribution = sumNumbers(arka.assets.map((asset) => parseCatalogNumber(asset.netManagedAmount)));
  const items: ArkaPortfolioItem[] = arka.assets.slice(0, limit).map((asset, index) => {
    const navContribution = parseCatalogNumber(asset.netManagedAmount);
    return {
      assetContract: asset.assetContract,
      rank: index + 1,
      isDenomination: asset.isDenomination,
      marketIds: asset.marketIds,
      navContribution: asset.netManagedAmount,
      weightBps: totalNavContribution > 0 ? Math.round((navContribution / totalNavContribution) * 10_000) : 0,
      liquidBalance: asset.liquidBalance,
      collateralAmount: asset.collateralAmount,
      debtAmount: asset.debtAmount,
      netPositionValue: asset.netPositionValue,
    };
  });
  return {
    arkaId: arka.arkaId,
    manager: arka.manager,
    shareToken: arka.shareToken,
    denominationContract: arka.denominationContract,
    syncedAt: arka.syncedAt,
    nav: arka.nav,
    totalNavContribution: numberToCatalogString(totalNavContribution),
    items,
  };
}

function buildHistoryPage<T extends { syncedAt: string }>(
  items: T[],
  searchParams: URLSearchParams,
): Page<T> {
  const order = searchParams.get("order") === "desc" ? "desc" : "asc";
  const orderedItems = [...items].sort((left, right) => {
    const diff = new Date(left.syncedAt).getTime() - new Date(right.syncedAt).getTime();
    return order === "desc" ? -diff : diff;
  });
  return buildPage(orderedItems, searchParams, 24);
}

function applyArkaQuery(
  arkas: RankedArkaCatalogEntry[],
  searchParams: URLSearchParams,
): RankedArkaCatalogEntry[] {
  const search = searchParams.get("search")?.trim().toLowerCase() ?? "";
  const curated = parseOptionalBoolean(searchParams.get("curated"));
  const sort = searchParams.get("sort") ?? "rank";
  const order = resolveSortOrder(searchParams, sort);
  const hasCuratedRows = arkas.some((entry) => entry.curated);
  return arkas
    .filter((entry) => curated === null || (curated && !hasCuratedRows) || entry.curated === curated)
    .filter((entry) => {
      if (!search) return true;
      const haystack = `${entry.arkaId} ${entry.manager} ${entry.denominationContract ?? ""} ${entry.whitelistContracts.join(" ")}`.toLowerCase();
      return haystack.includes(search);
    })
    .sort(sort === "nav" ? compareCatalogNumbers("nav", order) : compareRank("rank", order));
}

function applyManagerQuery(
  managers: RankedManagerCatalogEntry[],
  searchParams: URLSearchParams,
): RankedManagerCatalogEntry[] {
  const search = searchParams.get("search")?.trim().toLowerCase() ?? "";
  const sort = searchParams.get("sort") ?? "rank";
  const order = resolveSortOrder(searchParams, sort);
  return managers
    .filter((entry) => {
      if (!search) return true;
      return entry.manager.toLowerCase().includes(search);
    })
    .sort(sort === "nav" ? compareCatalogNumbers("totalNav", order) : compareRank("rank", order));
}

function applyAssetQuery(
  assets: RankedAssetCatalogEntry[],
  searchParams: URLSearchParams,
): RankedAssetCatalogEntry[] {
  const search = searchParams.get("search")?.trim().toLowerCase() ?? "";
  const sort = searchParams.get("sort") ?? "rank";
  const order = resolveSortOrder(searchParams, sort);
  return assets
    .filter((entry) => {
      if (!search) return true;
      return entry.assetContract.toLowerCase().includes(search);
    })
    .sort(sort === "nav" ? compareCatalogNumbers("netManagedAmount", order) : compareRank("rank", order));
}

function buildPage<T>(
  items: T[],
  searchParams: URLSearchParams,
  defaultLimit: number,
): Page<T> {
  const offset = parseBoundedInteger(searchParams.get("offset"), 0, 0, Math.max(items.length, 0));
  const limit = parseBoundedInteger(searchParams.get("limit"), defaultLimit, 1, 100);
  return {
    total: items.length,
    offset,
    limit,
    items: items.slice(offset, offset + limit),
  };
}

function emptyPage<T>(searchParams: URLSearchParams): Page<T> {
  const limit = parseBoundedInteger(searchParams.get("limit"), 0, 0, 100);
  return {
    total: 0,
    offset: 0,
    limit,
    items: [],
  };
}

function notFound(error: string, id: string): { status: number; body: unknown } {
  return {
    status: 404,
    body: { error, message: `Catalog entry not found: ${id}` },
  };
}

function parseAddress(retval: xdr.ScVal | null | undefined): string | null {
  if (!retval || retval.switch().name !== "scvAddress") return null;
  return Address.fromScAddress(retval.address()).toString();
}

function parseAddressVec(retval: xdr.ScVal | null | undefined): string[] {
  return (retval?.vec?.() ?? [])
    .map((item) => parseAddress(item))
    .filter((address): address is string => Boolean(address));
}

function parseAssetContract(retval: xdr.ScVal | null | undefined): string | null {
  const entries = parseMapEntries(retval);
  for (const entry of entries) {
    if (parseSymbol(entry.key()) === "contract") {
      return parseAddress(entry.val());
    }
  }
  return null;
}

function parseMapEntries(retval: xdr.ScVal | null | undefined): xdr.ScMapEntry[] {
  const maybeMap = retval?.map?.();
  return maybeMap ? [...maybeMap] : [];
}

function parseSymbol(retval: xdr.ScVal): string {
  return retval.sym?.()?.toString?.() ?? "";
}

function parseScValNumber(retval: xdr.ScVal | null | undefined): number {
  if (!retval) return 0;
  const value = retval as unknown as ScValNumberReaders;
  const directReaders: Array<keyof Pick<ScValNumberReaders, "i32" | "i64" | "u32" | "u64">> = [
    "i32",
    "i64",
    "u32",
    "u64",
  ];
  for (const reader of directReaders) {
    try {
      const parsed = value[reader]?.();
      if (parsed !== undefined) {
        return Number(parsed.toString());
      }
    } catch {}
  }
  for (const reader of ["i128", "u128"] as const) {
    try {
      const parsed = value[reader]?.();
      const lo = parsed?.lo?.();
      if (lo !== undefined) return Number(lo.toString());
    } catch {}
  }
  return 0;
}

function parseBool(retval: xdr.ScVal | null | undefined): boolean {
  if (!retval) return false;
  try {
    return Boolean(retval.b());
  } catch {
    return false;
  }
}

function parseOptionalBoolean(value: string | null): boolean | null {
  if (value === "true" || value === "1") return true;
  if (value === "false" || value === "0") return false;
  return null;
}

function resolveSortOrder(searchParams: URLSearchParams, sort: string): "asc" | "desc" {
  const configured = searchParams.get("order");
  if (configured === "asc" || configured === "desc") return configured;
  return sort === "rank" ? "asc" : "desc";
}

function parseBoundedInteger(
  value: string | null,
  fallback: number,
  minValue: number,
  maxValue: number,
): number {
  if (!value) return fallback;
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(minValue, Math.min(maxValue, parsed));
}

function readIntegerEnv(name: string, fallback: number): number {
  const value = process.env[name];
  if (!value) return fallback;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

async function mapWithConcurrency<T, U>(
  items: T[],
  concurrency: number,
  mapper: (item: T) => Promise<U>,
): Promise<U[]> {
  const results: U[] = [];
  let nextIndex = 0;
  const workerCount = Math.max(1, Math.min(concurrency, items.length));
  await Promise.all(
    Array.from({ length: workerCount }, async () => {
      while (nextIndex < items.length) {
        const currentIndex = nextIndex;
        nextIndex += 1;
        results[currentIndex] = await mapper(items[currentIndex] as T);
      }
    }),
  );
  return results;
}

function compareCatalogNumbers<T extends object>(
  key: keyof T,
  order: "asc" | "desc",
): (left: T, right: T) => number {
  return (left, right) => {
    const leftValue = parseCatalogNumber(String(left[key] ?? "0"));
    const rightValue = parseCatalogNumber(String(right[key] ?? "0"));
    if (leftValue !== rightValue) {
      return order === "asc" ? leftValue - rightValue : rightValue - leftValue;
    }
    const leftRank = Number((left as { rank?: unknown }).rank ?? 0);
    const rightRank = Number((right as { rank?: unknown }).rank ?? 0);
    return leftRank - rightRank;
  };
}

function compareRank<T extends object>(
  key: keyof T,
  order: "asc" | "desc",
): (left: T, right: T) => number {
  return (left, right) => {
    const leftValue = Number(left[key] ?? 0);
    const rightValue = Number(right[key] ?? 0);
    return order === "asc" ? leftValue - rightValue : rightValue - leftValue;
  };
}

function addCatalogStrings(left: string, right: string): string {
  return numberToCatalogString(parseCatalogNumber(left) + parseCatalogNumber(right));
}

function parseCatalogNumber(value: string | null | undefined): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function numberToCatalogString(value: number): string {
  if (!Number.isFinite(value)) return "0";
  return String(Math.trunc(value));
}

function sumNumbers(values: number[]): number {
  return values.reduce((total, value) => total + (Number.isFinite(value) ? value : 0), 0);
}

function emptyActivitySummary(): DashboardOverview["activity"] {
  return {
    totalEvents: 0,
    uniqueUsers: 0,
    oldestLedger: null,
    latestLedger: null,
    counts: {
      deposit: 0,
      redeem: 0,
      profit: 0,
      lend: 0,
      borrow: 0,
      repay: 0,
      withdraw: 0,
    },
    depositVolume: "0",
    redeemVolume: "0",
    profitVolume: "0",
    netUserFlow: "0",
  };
}

function normalizePathname(pathname: string): string {
  return pathname.replace(/\/+$/, "") || "/";
}

function describeError(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message) {
    return error.message;
  }
  if (typeof error === "string" && error.trim().length > 0) {
    return error;
  }
  return fallback;
}
