import { buildSnapshot, cloneSnapshot } from "./catalog.js";
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
  CatalogSyncFailure,
} from "./types.js";
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
  pageSize?: number;
}

export class OnChainCatalogSyncRunner implements CatalogSyncRunner {
  private readonly registryClient: RegistryClient;
  private readonly rpcServer: rpc.Server;

  constructor(private readonly options: OnChainCatalogSyncRunnerOptions) {
    this.registryClient = new RegistryClient(
      createClientOptions(options, options.registryContractId),
    );
    this.rpcServer = new rpc.Server(options.rpcUrl, {
      allowHttp: options.allowHttp ?? options.rpcUrl.startsWith("http://"),
    });
  }

  async run(): Promise<CatalogSnapshot> {
    const syncedAt = new Date().toISOString();
    const arkaIds = await this.listAllArkas();
    const results = await Promise.allSettled(
      arkaIds.map((arkaId) => this.readArka(arkaId, syncedAt)),
    );

    const arkas: ArkaCatalogEntry[] = [];
    const failures: CatalogSyncFailure[] = [];
    for (let index = 0; index < results.length; index += 1) {
      const result = results[index];
      if (result.status === "fulfilled") {
        arkas.push(result.value);
        continue;
      }
      failures.push({
        arkaId: arkaIds[index],
        message: errorMessage(result.reason),
        syncedAt,
      });
    }

    return buildSnapshot(arkas, failures, syncedAt);
  }

  private async listAllArkas(): Promise<string[]> {
    const pageSize = this.options.pageSize ?? 50;
    const arkas: string[] = [];
    let offset = 0;

    while (true) {
      const assembled = await this.registryClient.get_arkas(
        { offset, limit: pageSize },
        mergeCallOptions(undefined, true),
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

    const [manager, nav, denomination, fees, whitelist] = await Promise.all([
      this.readManager(vaultClient, readLegacyState),
      this.readNav(vaultClient, readLegacyState),
      this.readDenomination(vaultClient, readLegacyState),
      this.readFees(vaultClient, readLegacyState),
      this.readWhitelist(vaultClient, readLegacyState),
    ]);
    const shareToken = await this.readOptionalShareToken(vaultClient);
    const blendMarkets = await this.readOptionalBlendMarkets(vaultClient);

    const [curatedTx, delistedTx] = await Promise.all([
      this.registryClient.is_manager_curated(
        { manager },
        mergeCallOptions(undefined, true),
      ),
      this.registryClient.is_delisted(
        { arka: arkaId },
        mergeCallOptions(undefined, true),
      ),
    ]);

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
      const managerTx = await vaultClient.manager(mergeCallOptions(undefined, true));
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
      const navTx = await vaultClient.nav(mergeCallOptions(undefined, true));
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
      const denominationTx = await vaultClient.denomination(mergeCallOptions(undefined, true));
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
      const feesTx = await vaultClient.fees(mergeCallOptions(undefined, true));
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
      const whitelistTx = await vaultClient.whitelist(mergeCallOptions(undefined, true));
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
      const shareTokenTx = await vaultClient.share_token(mergeCallOptions(undefined, true));
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
      const blendMarketsTx = await vaultClient.blend_markets(
        mergeCallOptions(undefined, true),
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
    const liquidBalances = await Promise.all(
      whitelistContracts.map(async (assetContract) => {
        return {
          assetContract,
          liquidBalance: await this.readOptionalLiquidBalance(vaultClient, assetContract),
        };
      }),
    );
    for (const { assetContract, liquidBalance } of liquidBalances) {
      const exposure = getOrCreateExposure(exposures, assetContract, denominationContract, syncedAt);
      exposure.liquidBalance += liquidBalance;
      exposure.netManagedAmount += liquidBalance;
    }

    const marketPositions = await Promise.all(
      blendMarketIds.map(async (marketId) => {
        return {
          marketId,
          positions: await this.readOptionalBlendPositionValues(
            vaultClient,
            BigInt(marketId),
          ),
        };
      }),
    );
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
      const liquidBalanceTx = await vaultClient.liquid_balance(
        { asset: assetContract },
        mergeCallOptions(undefined, true),
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
      const positionsTx = await vaultClient.blend_position_values(
        { market_id: marketId },
        mergeCallOptions(undefined, true),
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
    const response = await this.rpcServer.getLedgerEntries(new Contract(arkaId).getFootprint());
    const entry = response.entries[0];
    const storage = entry?.val.contractData().val().instance().storage() ?? [];

    const nativeEntries = storage.map((item) => ({
      key: scValToNative(item.key()) as unknown,
      value: scValToNative(item.val()) as unknown,
    }));
    return decodeLegacyInstanceStorage(nativeEntries);
  }
}

export function isMissingContractFunction(error: unknown, functionName: string): boolean {
  const message = errorMessage(error).toLowerCase();
  const expectedFunction = functionName.toLowerCase();
  return (
    message.includes("trying to invoke non-existent contract function") &&
    message.includes(expectedFunction)
  );
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
