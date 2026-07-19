import { buildSnapshot, cloneSnapshot } from "./catalog.js";
import { setTimeout as delay } from "node:timers/promises";
import {
  createClientOptions,
  expectSimulationResult,
  mergeCallOptions,
  type NetworkConfig,
} from "./clientOptions.js";
import type {
  ArkaAssetExposure,
  ArkaCatalogEntry,
  CatalogSnapshot,
  CatalogAssetPrice,
  CatalogSyncFailure,
} from "./types.js";
import { isUsdStablecoinContract } from "./economics.js";
import {
  OracleGuardPriceReader,
  type OraclePriceReader,
  unavailableOraclePrice,
  usdParityPrice,
} from "./oraclePrices.js";
import { Contract, rpc, scValToNative, type xdr } from "@stellar/stellar-sdk";
import {
  Client as ArkaClient,
  type Asset,
  type FeeStructure,
} from "./generated/arka.js";
import { Client as RegistryClient } from "./generated/arka-registry.js";

export interface CatalogSyncRunner {
  run(): Promise<CatalogSnapshot>;
}

export class StaticCatalogSyncRunner implements CatalogSyncRunner {
  constructor(
    private readonly snapshotFactory:
      | CatalogSnapshot
      | (() => CatalogSnapshot | Promise<CatalogSnapshot>),
  ) {}

  async run(): Promise<CatalogSnapshot> {
    if (typeof this.snapshotFactory === "function") {
      return cloneSnapshot(await this.snapshotFactory());
    }
    return cloneSnapshot(this.snapshotFactory);
  }
}

export interface OnChainCatalogSyncRunnerOptions extends NetworkConfig {
  registryContractId: string;
  oracleGuardContractId?: string;
  oraclePriceReader?: OraclePriceReader;
  pageSize?: number;
  readConcurrency?: number;
  retryAttempts?: number;
  retryDelayMs?: number;
}

export class OnChainCatalogSyncRunner implements CatalogSyncRunner {
  private readonly registryClient: RegistryClient;
  private readonly rpcServer: rpc.Server;
  private readonly oraclePriceReader: OraclePriceReader | null;

  constructor(private readonly options: OnChainCatalogSyncRunnerOptions) {
    this.registryClient = new RegistryClient(
      createClientOptions(options, options.registryContractId),
    );
    this.rpcServer = new rpc.Server(options.rpcUrl, {
      allowHttp: options.allowHttp ?? options.rpcUrl.startsWith("http://"),
    });
    this.oraclePriceReader = options.oraclePriceReader ?? (
      options.oracleGuardContractId
        ? new OracleGuardPriceReader({
            ...options,
            oracleGuardContractId: options.oracleGuardContractId,
          })
        : null
    );
  }

  async run(): Promise<CatalogSnapshot> {
    const syncedAt = new Date().toISOString();
    const arkaIds = await this.listAllArkas();
    const results = await mapWithConcurrency(
      arkaIds,
      normalizedPositiveInteger(this.options.readConcurrency, 1),
      async (arkaId) => this.readArka(arkaId, syncedAt),
    );

    const arkas: ArkaCatalogEntry[] = [];
    const failures: CatalogSyncFailure[] = [];
    for (let index = 0; index < results.length; index += 1) {
      const result = results[index];
      if (result.ok) {
        arkas.push(result.value);
        continue;
      }
      failures.push({
        arkaId: arkaIds[index],
        message: errorMessage(result.error),
        syncedAt,
      });
    }

    const assetPrices = await this.readAssetPrices(arkas, syncedAt);
    return buildSnapshot(arkas, failures, syncedAt, assetPrices);
  }

  private async readAssetPrices(
    arkas: ArkaCatalogEntry[],
    observedAt: string,
  ): Promise<CatalogAssetPrice[]> {
    const assetContracts = [...new Set(
      arkas.flatMap((arka) => [
        ...(arka.denominationContract ? [arka.denominationContract] : []),
        ...arka.whitelistContracts,
      ]),
    )].sort();

    const results = await mapWithConcurrency(
      assetContracts,
      normalizedPositiveInteger(this.options.readConcurrency, 1),
      async (assetContract) => {
        if (isUsdStablecoinContract(assetContract)) {
          return usdParityPrice(assetContract, observedAt);
        }
        if (!this.oraclePriceReader) {
          return unavailableOraclePrice(assetContract, observedAt, "oracle_guard_not_configured");
        }
        return this.rpcRead(() => this.oraclePriceReader!.read(assetContract, observedAt));
      },
    );

    return results.map((result, index) =>
      result.ok
        ? result.value
        : unavailableOraclePrice(
            assetContracts[index],
            observedAt,
            `oracle_read_failed:${errorMessage(result.error)}`,
          ));
  }

  private async listAllArkas(): Promise<string[]> {
    const pageSize = this.options.pageSize ?? 50;
    const arkas: string[] = [];
    let offset = 0;

    while (true) {
      const assembled = await this.rpcRead(() =>
        this.registryClient.get_arkas(
          { offset, limit: pageSize },
          mergeCallOptions(undefined, true),
        ),
      );
      const page = expectSimulationResult(assembled, "get_arkas");
      if (page.length === 0) {
        break;
      }
      arkas.push(...page);
      if (page.length < pageSize) {
        break;
      }
      offset += page.length;
    }

    return arkas;
  }

  private async readArka(arkaId: string, syncedAt: string): Promise<ArkaCatalogEntry> {
    const vaultClient = new ArkaClient(createClientOptions(this.options, arkaId));
    let legacyStatePromise: Promise<LegacyArkaState> | null = null;
    const readLegacyState = () => {
      legacyStatePromise ??= this.readLegacyState(arkaId);
      return legacyStatePromise;
    };

    const manager = await this.readManager(vaultClient, readLegacyState);
    const nav = await this.readNav(vaultClient, readLegacyState);
    const denomination = await this.readDenomination(vaultClient, readLegacyState);
    const fees = await this.readFees(vaultClient, readLegacyState);
    const whitelist = await this.readWhitelist(vaultClient, readLegacyState);
    const shareToken = await this.readOptionalShareToken(vaultClient);
    const blendMarkets = await this.readOptionalBlendMarkets(vaultClient);

    const curatedTx = await this.rpcRead(() =>
      this.registryClient.is_manager_curated(
        { manager },
        mergeCallOptions(undefined, true),
      ),
    );
    const delistedTx = await this.rpcRead(() =>
      this.registryClient.is_delisted(
        { arka: arkaId },
        mergeCallOptions(undefined, true),
      ),
    );

    const assets = await this.readArkaAssets(
      vaultClient,
      denomination.contract,
      whitelist.map((asset) => asset.contract),
      blendMarkets.map((marketId) => marketId.toString()),
      syncedAt,
    );

    return {
      arkaId,
      manager,
      curated: expectSimulationResult(curatedTx, "is_manager_curated"),
      delisted: expectSimulationResult(delistedTx, "is_delisted"),
      nav: nav.toString(),
      denominationContract: denomination.contract,
      whitelistContracts: whitelist.map((asset) => asset.contract),
      shareToken: shareToken ?? null,
      fees: {
        mgmtBps: fees.mgmt_bps,
        perfBps: fees.perf_bps,
        depositBps: fees.deposit_bps,
        redeemBps: fees.redeem_bps,
      },
      assets,
      syncedAt,
    };
  }

  private async readManager(
    vaultClient: ArkaClient,
    readLegacyState: () => Promise<LegacyArkaState>,
  ): Promise<string> {
    try {
      const managerTx = await this.rpcRead(() =>
        vaultClient.manager(mergeCallOptions(undefined, true)),
      );
      return expectSimulationResult(managerTx, "manager");
    } catch (error) {
      if (isMissingContractFunction(error, "manager")) {
        const legacyState = await readLegacyState();
        if (legacyState.manager) {
          return legacyState.manager;
        }
      }
      throw error;
    }
  }

  private async readNav(
    vaultClient: ArkaClient,
    readLegacyState: () => Promise<LegacyArkaState>,
  ): Promise<bigint> {
    try {
      const navTx = await this.rpcRead(() =>
        vaultClient.nav(mergeCallOptions(undefined, true)),
      );
      return expectSimulationResult(navTx, "nav");
    } catch (error) {
      if (isMissingContractFunction(error, "nav")) {
        const legacyState = await readLegacyState();
        if (legacyState.nav !== null) {
          return legacyState.nav;
        }
      }
      throw error;
    }
  }

  private async readDenomination(
    vaultClient: ArkaClient,
    readLegacyState: () => Promise<LegacyArkaState>,
  ): Promise<Asset> {
    try {
      const denominationTx = await this.rpcRead(() =>
        vaultClient.denomination(mergeCallOptions(undefined, true)),
      );
      return expectSimulationResult(denominationTx, "denomination");
    } catch (error) {
      if (isMissingContractFunction(error, "denomination")) {
        const legacyState = await readLegacyState();
        if (legacyState.denomination) {
          return legacyState.denomination;
        }
      }
      throw error;
    }
  }

  private async readFees(
    vaultClient: ArkaClient,
    readLegacyState: () => Promise<LegacyArkaState>,
  ): Promise<FeeStructure> {
    try {
      const feesTx = await this.rpcRead(() =>
        vaultClient.fees(mergeCallOptions(undefined, true)),
      );
      return expectSimulationResult(feesTx, "fees");
    } catch (error) {
      if (isMissingContractFunction(error, "fees")) {
        const legacyState = await readLegacyState();
        if (legacyState.fees) {
          return legacyState.fees;
        }
      }
      throw error;
    }
  }

  private async readWhitelist(
    vaultClient: ArkaClient,
    readLegacyState: () => Promise<LegacyArkaState>,
  ): Promise<Asset[]> {
    try {
      const whitelistTx = await this.rpcRead(() =>
        vaultClient.whitelist(mergeCallOptions(undefined, true)),
      );
      return expectSimulationResult(whitelistTx, "whitelist");
    } catch (error) {
      if (isMissingContractFunction(error, "whitelist")) {
        const legacyState = await readLegacyState();
        if (legacyState.whitelist) {
          return legacyState.whitelist;
        }
      }
      throw error;
    }
  }

  private async readOptionalShareToken(vaultClient: ArkaClient): Promise<string | null> {
    try {
      const shareTokenTx = await this.rpcRead(() =>
        vaultClient.share_token(mergeCallOptions(undefined, true)),
      );
      return expectSimulationResult(shareTokenTx, "share_token") ?? null;
    } catch (error) {
      if (isMissingContractFunction(error, "share_token")) {
        return null;
      }
      throw error;
    }
  }

  private async readOptionalBlendMarkets(vaultClient: ArkaClient): Promise<bigint[]> {
    try {
      const blendMarketsTx = await this.rpcRead(() =>
        vaultClient.blend_markets(
          mergeCallOptions(undefined, true),
        ),
      );
      return expectSimulationResult(blendMarketsTx, "blend_markets");
    } catch (error) {
      if (isMissingContractFunction(error, "blend_markets")) {
        return [];
      }
      throw error;
    }
  }

  private async readArkaAssets(
    vaultClient: ArkaClient,
    denominationContract: string,
    whitelistContracts: string[],
    blendMarketIds: string[],
    syncedAt: string,
  ): Promise<ArkaAssetExposure[]> {
    const exposures = new Map<string, MutableAssetExposure>();
    const liquidBalances = [];
    for (const assetContract of whitelistContracts) {
      liquidBalances.push({
        assetContract,
        liquidBalance: await this.readOptionalLiquidBalance(vaultClient, assetContract),
      });
    }
    for (const { assetContract, liquidBalance } of liquidBalances) {
      const exposure = getOrCreateExposure(exposures, assetContract, denominationContract, syncedAt);
      exposure.liquidBalance += liquidBalance;
      exposure.netManagedAmount += liquidBalance;
    }

    const marketPositions = [];
    for (const marketId of blendMarketIds) {
      marketPositions.push({
        marketId,
        positions: await this.readOptionalBlendPositionValues(
          vaultClient,
          BigInt(marketId),
        ),
      });
    }
    for (const { marketId, positions } of marketPositions) {
      for (const position of positions) {
        const exposure = getOrCreateExposure(
          exposures,
          position.asset,
          denominationContract,
          syncedAt,
        );
        exposure.collateralAmount += position.collateral_amount;
        exposure.debtAmount += position.debt_amount;
        exposure.netManagedAmount += position.collateral_amount - position.debt_amount;
        exposure.netPositionValue += position.net_value;
        exposure.marketIds.add(marketId);
      }
    }

    return [...exposures.values()]
      .map((exposure) => ({
        assetContract: exposure.assetContract,
        isDenomination: exposure.isDenomination,
        liquidBalance: exposure.liquidBalance.toString(),
        collateralAmount: exposure.collateralAmount.toString(),
        debtAmount: exposure.debtAmount.toString(),
        netManagedAmount: exposure.netManagedAmount.toString(),
        netPositionValue: exposure.netPositionValue.toString(),
        marketIds: [...exposure.marketIds].sort(),
        syncedAt: exposure.syncedAt,
      }))
      .sort((left, right) => compareAssetExposure(left, right));
  }

  private async readOptionalLiquidBalance(
    vaultClient: ArkaClient,
    assetContract: string,
  ): Promise<bigint> {
    try {
      const liquidBalanceTx = await this.rpcRead(() =>
        vaultClient.liquid_balance(
          { asset: assetContract },
          mergeCallOptions(undefined, true),
        ),
      );
      return expectSimulationResult(liquidBalanceTx, "liquid_balance");
    } catch (error) {
      if (isMissingContractFunction(error, "liquid_balance")) {
        return 0n;
      }
      throw error;
    }
  }

  private async readOptionalBlendPositionValues(
    vaultClient: ArkaClient,
    marketId: bigint,
  ): Promise<
    Array<{
      asset: string;
      collateral_amount: bigint;
      debt_amount: bigint;
      net_value: bigint;
    }>
  > {
    try {
      const positionsTx = await this.rpcRead(() =>
        vaultClient.blend_position_values(
          { market_id: marketId },
          mergeCallOptions(undefined, true),
        ),
      );
      return expectSimulationResult(positionsTx, "blend_position_values");
    } catch (error) {
      if (isMissingContractFunction(error, "blend_position_values")) {
        return [];
      }
      throw error;
    }
  }

  private async readLegacyState(arkaId: string): Promise<LegacyArkaState> {
    const response = await this.rpcRead(() =>
      this.rpcServer.getLedgerEntries(new Contract(arkaId).getFootprint()),
    );
    const entry = response.entries[0];
    const storage = entry?.val.contractData().val().instance().storage() ?? [];

    const nativeEntries = storage.map((item) => ({
      key: scValToNative(item.key()) as unknown,
      value: scValToNative(item.val()) as unknown,
    }));
    return decodeLegacyInstanceStorage(nativeEntries);
  }

  private async rpcRead<T>(operation: () => Promise<T>): Promise<T> {
    return retryTransientRpc(operation, {
      attempts: normalizedPositiveInteger(this.options.retryAttempts, 4),
      baseDelayMs: normalizedPositiveInteger(this.options.retryDelayMs, 250),
    });
  }
}

type SettledResult<T> =
  | { ok: true; value: T }
  | { ok: false; error: unknown };

async function mapWithConcurrency<T, U>(
  items: T[],
  concurrency: number,
  worker: (item: T) => Promise<U>,
): Promise<Array<SettledResult<U>>> {
  const results: Array<SettledResult<U>> = new Array(items.length);
  let nextIndex = 0;
  const workers = Array.from(
    { length: Math.min(concurrency, items.length) },
    async () => {
      while (nextIndex < items.length) {
        const index = nextIndex;
        nextIndex += 1;
        try {
          results[index] = { ok: true, value: await worker(items[index]) };
        } catch (error) {
          results[index] = { ok: false, error };
        }
      }
    },
  );
  await Promise.all(workers);
  return results;
}

export async function retryTransientRpc<T>(
  operation: () => Promise<T>,
  options: { attempts: number; baseDelayMs: number },
): Promise<T> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= options.attempts; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      if (attempt >= options.attempts || !isTransientRpcError(error)) {
        throw error;
      }
      await delay(transientRpcRetryDelayMs(error, attempt, options.baseDelayMs));
    }
  }
  throw lastError;
}

export function isMissingContractFunction(error: unknown, functionName: string): boolean {
  const message = errorMessage(error).toLowerCase();
  const expectedFunction = functionName.toLowerCase();
  return (
    message.includes("trying to invoke non-existent contract function") &&
    message.includes(expectedFunction)
  );
}

export function isTransientRpcError(error: unknown): boolean {
  const message = errorMessage(error).toLowerCase();
  return (
    message.includes("status code 429") ||
    message.includes("too many requests") ||
    message.includes("timeout") ||
    message.includes("econnreset") ||
    message.includes("etimedout")
  );
}

export function transientRpcRetryDelayMs(
  error: unknown,
  attempt: number,
  baseDelayMs: number,
): number {
  const retryAfterSeconds = extractRetryAfterSeconds(error);
  if (retryAfterSeconds !== null) {
    return retryAfterSeconds * 1_000;
  }
  return baseDelayMs * attempt;
}

function extractRetryAfterSeconds(error: unknown): number | null {
  const shaped = error as {
    response?: {
      data?: { retry_after?: unknown };
      headers?: Record<string, unknown>;
    };
  };
  const dataValue = shaped.response?.data?.retry_after;
  const headerValue =
    shaped.response?.headers?.["retry-after"] ??
    shaped.response?.headers?.["Retry-After"];
  const parsed = Number(dataValue ?? headerValue);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

interface LegacyArkaState {
  nav: bigint | null;
  fees: FeeStructure | null;
  whitelist: Asset[] | null;
  denomination: Asset | null;
  manager: string | null;
}

interface LegacyStorageEntry {
  key: unknown;
  value: unknown;
}

export function decodeLegacyInstanceStorage(entries: LegacyStorageEntry[]): LegacyArkaState {
  const state: LegacyArkaState = {
    nav: null,
    fees: null,
    whitelist: null,
    denomination: null,
    manager: null,
  };

  for (const entry of entries) {
    const keyName = legacyStorageKeyName(entry.key);
    switch (keyName) {
      case "Aum":
        state.nav = coerceBigInt(entry.value);
        break;
      case "Fees":
        state.fees = entry.value as FeeStructure;
        break;
      case "Whitelist":
        state.whitelist = entry.value as Asset[];
        break;
      case "Denomination":
        state.denomination = entry.value as Asset;
        break;
      case "Manager":
        state.manager = typeof entry.value === "string" ? entry.value : null;
        break;
      default:
        break;
    }
  }

  return state;
}

export function legacyStorageKeyName(key: unknown): string | null {
  if (!Array.isArray(key) || key.length === 0) {
    return null;
  }
  return typeof key[0] === "string" ? key[0] : null;
}

function coerceBigInt(value: unknown): bigint {
  if (typeof value === "bigint") {
    return value;
  }
  if (typeof value === "number") {
    return BigInt(value);
  }
  if (typeof value === "string") {
    return BigInt(value);
  }
  throw new Error(`Cannot coerce legacy bigint value from ${String(value)}`);
}

function normalizedPositiveInteger(value: number | undefined, fallback: number): number {
  return typeof value === "number" && Number.isInteger(value) && value > 0
    ? value
    : fallback;
}

interface MutableAssetExposure {
  assetContract: string;
  isDenomination: boolean;
  liquidBalance: bigint;
  collateralAmount: bigint;
  debtAmount: bigint;
  netManagedAmount: bigint;
  netPositionValue: bigint;
  marketIds: Set<string>;
  syncedAt: string;
}

function getOrCreateExposure(
  exposures: Map<string, MutableAssetExposure>,
  assetContract: string,
  denominationContract: string,
  syncedAt: string,
): MutableAssetExposure {
  const current = exposures.get(assetContract);
  if (current) {
    return current;
  }
  const next: MutableAssetExposure = {
    assetContract,
    isDenomination: assetContract === denominationContract,
    liquidBalance: 0n,
    collateralAmount: 0n,
    debtAmount: 0n,
    netManagedAmount: 0n,
    netPositionValue: 0n,
    marketIds: new Set<string>(),
    syncedAt,
  };
  exposures.set(assetContract, next);
  return next;
}

function compareAssetExposure(left: ArkaAssetExposure, right: ArkaAssetExposure): number {
  const leftValue = BigInt(left.netManagedAmount);
  const rightValue = BigInt(right.netManagedAmount);
  if (leftValue !== rightValue) {
    return leftValue > rightValue ? -1 : 1;
  }
  return left.assetContract.localeCompare(right.assetContract);
}

function errorMessage(reason: unknown): string {
  if (reason instanceof Error) {
    return reason.message;
  }
  return String(reason);
}
