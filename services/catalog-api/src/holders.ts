import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { Account, Address, BASE_FEE, Contract, rpc, scValToNative, StrKey, TransactionBuilder, xdr } from "@stellar/stellar-sdk";
import type { NetworkConfig } from "./clientOptions.js";
import { retryTransientRpc } from "./runners.js";
import type { ArkaCatalogEntry, ArkaHolderPage, HolderQuery } from "./types.js";
import { cashFlowCursorThrough } from "./profitRpc.js";

const READ_SOURCE = "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF";
const EVENT_WINDOW = 1024;
const validAddress = (address: string) => StrKey.isValidEd25519PublicKey(address) || StrKey.isValidContract(address);

interface HolderCandidate {
  holder: string;
  firstSeenLedger: number | null;
  lastActivityLedger: number | null;
}

interface HolderArchiveEntry {
  arkaId: string;
  candidates: HolderCandidate[];
  lastIndexedLedger: number | null;
  coverageFromLedger: number | null;
  complete: boolean;
}

interface HolderArchive {
  schemaVersion: 1;
  updatedAt: string;
  entries: HolderArchiveEntry[];
}

export interface HolderReader {
  list(arka: ArkaCatalogEntry, query?: HolderQuery, options?: { fresh?: boolean }): Promise<ArkaHolderPage>;
}

export class NoopHolderReader implements HolderReader {
  async list(arka: ArkaCatalogEntry, query: HolderQuery = {}): Promise<ArkaHolderPage> {
    return emptyHolderPage(arka, query);
  }
}

export class StaticHolderReader implements HolderReader {
  constructor(private readonly pages: Record<string, ArkaHolderPage>) {}

  async list(arka: ArkaCatalogEntry, query: HolderQuery = {}): Promise<ArkaHolderPage> {
    const page = this.pages[arka.arkaId] ?? emptyHolderPage(arka, query);
    const offset = normalizeOffset(query.offset);
    const limit = normalizeLimit(query.limit);
    return {
      ...page,
      offset,
      limit,
      items: page.items.slice(offset, offset + limit),
    };
  }
}

export interface RpcHolderReaderOptions extends NetworkConfig {
  archiveFile: string;
  initialLedger?: number;
  pageSize?: number;
  maxPages?: number;
  retryAttempts?: number;
  retryDelayMs?: number;
  cacheTtlMs?: number;
  maxCacheAgeMs?: number;
  now?: () => Date;
}

export class RpcHolderReader implements HolderReader {
  private readonly server: rpc.Server;
  private readonly pageSize: number;
  private readonly maxPages: number;
  private readonly refreshes = new Map<string, Promise<ArkaHolderPage>>();
  private readonly verifiedPages = new Map<string, ArkaHolderPage>();
  private readonly refreshFailures = new Set<string>();
  private readonly cacheTtlMs: number;
  private readonly maxCacheAgeMs: number;
  private readonly now: () => Date;
  private archiveMutation: Promise<void> = Promise.resolve();

  constructor(private readonly options: RpcHolderReaderOptions) {
    this.server = options.rpcServer ?? new rpc.Server(options.rpcUrl, {
      allowHttp: options.allowHttp ?? options.rpcUrl.startsWith("http://"),
    });
    this.pageSize = normalizePositiveInteger(options.pageSize, 100);
    this.maxPages = normalizePositiveInteger(options.maxPages, 100);
    this.cacheTtlMs = normalizePositiveInteger(options.cacheTtlMs, 5_000);
    this.maxCacheAgeMs = Math.max(this.cacheTtlMs, normalizePositiveInteger(options.maxCacheAgeMs, 120_000));
    this.now = options.now ?? (() => new Date());
  }

  async list(arka: ArkaCatalogEntry, query: HolderQuery = {}, options?: { fresh?: boolean }): Promise<ArkaHolderPage> {
    const cached = this.verifiedPages.get(arka.arkaId);
    const age = cached ? this.now().getTime() - Date.parse(cached.indexedAt) : Number.POSITIVE_INFINITY;
    let page: ArkaHolderPage;
    if (!options?.fresh && cached && cached.shareToken === arka.shareToken && age >= 0 && age <= this.maxCacheAgeMs) {
      const stale = age > this.cacheTtlMs;
      if (stale) {
        // Only last on-chain verified data, bounded to two minutes. Never
        // relabel its indexedAt or invent balances when the RPC is slow.
        void this.beginRefresh(arka).catch(() => undefined);
      }
      page = { ...cached, stale, refreshFailed: this.refreshFailures.has(arka.arkaId) };
      if (page.stale || page.refreshFailed) delete page.currentBalancesLedger;
    } else {
      // Fresh observations and cold/expired caches both require a successful chain read.
      page = { ...await this.beginRefresh(arka), stale: false, refreshFailed: false };
    }
    const offset = normalizeOffset(query.offset);
    const limit = normalizeLimit(query.limit);
    return {
      ...page,
      offset,
      limit,
      items: page.items.slice(offset, offset + limit),
    };
  }

  private beginRefresh(arka: ArkaCatalogEntry): Promise<ArkaHolderPage> {
    let refresh = this.refreshes.get(arka.arkaId);
    if (!refresh) {
      refresh = this.refresh(arka).then(page => {
        this.verifiedPages.set(arka.arkaId, page);
        this.refreshFailures.delete(arka.arkaId);
        return page;
      }, error => {
        this.refreshFailures.add(arka.arkaId);
        throw error;
      }).finally(() => this.refreshes.delete(arka.arkaId));
      this.refreshes.set(arka.arkaId, refresh);
    }
    return refresh;
  }

  protected async refresh(arka: ArkaCatalogEntry): Promise<ArkaHolderPage> {
    const archive = await this.readArchive();
    const existing = archive.entries.find((entry) => entry.arkaId === arka.arkaId);
    const [network, health] = await Promise.all([
      this.rpcRead(() => this.server.getNetwork()),
      this.rpcRead(() => this.server.getHealth()),
    ]);
    if (network.passphrase !== this.options.networkPassphrase || health.status !== "healthy" ||
        !Number.isSafeInteger(health.oldestLedger) || health.oldestLedger < 1 ||
        !Number.isSafeInteger(health.latestLedger) || health.latestLedger < health.oldestLedger) {
      throw new Error("Holder archive RPC coverage is unavailable");
    }
    const oldestLedger = health.oldestLedger;
    const latestLedger = health.latestLedger;
    const requestedInitial = this.options.initialLedger;
    const desiredStartLedger = existing?.lastIndexedLedger !== null && existing?.lastIndexedLedger !== undefined
      ? existing.lastIndexedLedger + 1
      : requestedInitial ?? oldestLedger;
    const { startLedger, missedLedgerWindow } = resolveHolderRefreshWindow(
      desiredStartLedger,
      oldestLedger,
    );
    const candidateMap = new Map(
      (existing?.candidates ?? []).filter((candidate) => validAddress(candidate.holder)).map((candidate) => [candidate.holder, candidate]),
    );
    candidateMap.set(arka.manager, candidateMap.get(arka.manager) ?? {
      holder: arka.manager,
      firstSeenLedger: null,
      lastActivityLedger: null,
    });

    let coveredThrough = existing?.lastIndexedLedger ?? null;
    if (coveredThrough !== null && coveredThrough > latestLedger) throw new Error("Holder archive RPC head has rewound");
    if (startLedger <= latestLedger) {
      const result = await this.fetchEvents(arka, startLedger, latestLedger);
      coveredThrough = result.coveredThrough ?? coveredThrough;
      for (const event of result.events) {
        for (const holder of extractHolderCandidates(event, arka).filter(validAddress)) {
          const previous = candidateMap.get(holder);
          candidateMap.set(holder, {
            holder,
            firstSeenLedger: previous?.firstSeenLedger ?? event.ledger,
            lastActivityLedger: Math.max(previous?.lastActivityLedger ?? 0, event.ledger),
          });
        }
      }
    }

    const contract = new Contract(arka.arkaId);
    const [canonical, ...balances] = await Promise.all([
      this.readShares(contract, "total_shares").catch((error: unknown) => {
        if (isMissingTotalSharesMethod(error)) return null;
        throw error;
      }),
      ...[...candidateMap.values()].map(async (candidate) => ({
        ...candidate,
        ...await this.readShares(contract, "shares_of", [new Address(candidate.holder).toScVal()]),
      })),
    ]);
    const indexedTotalShares = balances.reduce((sum, entry) => sum + entry.shares, 0n);
    const totalShares = canonical?.shares ?? indexedTotalShares;
    if (canonical && (canonical.ledger < latestLedger || indexedTotalShares > totalShares || balances.some((balance) => balance.ledger !== canonical.ledger))) {
      throw new Error("Holder balances were not read at a common ledger");
    }
    const currentBalancesLedger = canonical && indexedTotalShares === totalShares ? canonical.ledger : undefined;
    const items = balances
      .filter((entry) => entry.shares > BigInt(0))
      .map((entry) => ({
        holder: entry.holder,
        shares: entry.shares.toString(),
        ownershipBps: totalShares > BigInt(0)
          ? Number((entry.shares * BigInt(10_000)) / totalShares)
          : 0,
        firstSeenLedger: entry.firstSeenLedger,
        lastActivityLedger: entry.lastActivityLedger,
      }))
      .sort((left, right) => {
        const difference = BigInt(right.shares) - BigInt(left.shares);
        return difference === BigInt(0)
          ? left.holder.localeCompare(right.holder)
          : difference > BigInt(0) ? 1 : -1;
      });

    const initialCoverageComplete = requestedInitial !== undefined && requestedInitial >= oldestLedger;
    const complete = Boolean(
      currentBalancesLedger !== undefined &&
      (existing?.complete ?? initialCoverageComplete) &&
      !missedLedgerWindow &&
      coveredThrough === latestLedger,
    );
    const archiveEntry: HolderArchiveEntry = {
      arkaId: arka.arkaId,
      candidates: [...candidateMap.values()],
      lastIndexedLedger: coveredThrough,
      coverageFromLedger: existing?.coverageFromLedger ?? startLedger,
      complete,
    };
    await this.upsertArchiveEntry(archiveEntry);

    return {
      arkaId: arka.arkaId,
      shareToken: arka.shareToken,
      totalShares: totalShares.toString(),
      indexedAt: this.now().toISOString(),
      complete,
      ...(currentBalancesLedger ? { currentBalancesLedger } : {}),
      coverageFromLedger: archiveEntry.coverageFromLedger,
      coverageToLedger: archiveEntry.lastIndexedLedger,
      total: items.length,
      offset: 0,
      limit: items.length,
      items,
    };
  }

  private async readShares(contract: Contract, method: "total_shares" | "shares_of", args: xdr.ScVal[] = []) {
    const transaction = new TransactionBuilder(new Account(READ_SOURCE, "0"), {
      fee: BASE_FEE, networkPassphrase: this.options.networkPassphrase,
    }).addOperation(contract.call(method, ...args)).setTimeout(0).build();
    const result = await this.rpcRead(() => this.server.simulateTransaction(transaction));
    if (!rpc.Api.isSimulationSuccess(result) || !result.result) {
      throw new Error(rpc.Api.isSimulationError(result) ? result.error : "Holder simulation unavailable");
    }
    const shares = scValToNative(result.result.retval);
    if (typeof shares !== "bigint" || shares < 0n || !Number.isSafeInteger(result.latestLedger) || result.latestLedger < 1) {
      throw new Error("Invalid holder balance or ledger");
    }
    return { shares, ledger: result.latestLedger };
  }

  private async fetchEvents(arka: ArkaCatalogEntry, startLedger: number, endLedger: number) {
    const filters: rpc.Api.EventFilter[] = [
      { type: "contract", contractIds: [arka.arkaId], topics: this.holderTopics(["deposit", "redeem"]) },
    ];
    if (arka.shareToken) {
      filters.push({ type: "contract", contractIds: [arka.shareToken], topics: this.holderTopics(["mint", "burn", "transfer"]) });
    }
    const events: rpc.Api.EventResponse[] = [];
    let coveredThrough: number | null = null;
    let pages = 0;
    for (let from = startLedger; from <= endLedger; from += EVENT_WINDOW) {
      const through = Math.min(from + EVENT_WINDOW - 1, endLedger);
      let cursor: string | undefined;
      let previousLedger = from;
      const seen = new Set<string>();
      while (pages < this.maxPages) {
        const response = await this.rpcRead(() => this.server.getEvents(cursor
          ? { cursor, filters, limit: this.pageSize }
          : { startLedger: from, endLedger: through + 1, filters, limit: this.pageSize }));
        pages++;
        if (!Number.isSafeInteger(response.oldestLedger) || !Number.isSafeInteger(response.latestLedger) ||
            response.oldestLedger > from || response.latestLedger < through) {
          throw new Error("Holder event interval is incomplete");
        }
        for (const event of response.events) {
          if (event.ledger > through) break;
          if (event.ledger < previousLedger || seen.has(event.id)) throw new Error("Invalid holder event sequence");
          previousLedger = event.ledger;
          seen.add(event.id);
          events.push(event);
        }
        if (cashFlowCursorThrough(response.cursor) >= through) {
          coveredThrough = through;
          break;
        }
        if (cursor === response.cursor) throw new Error("Holder event cursor stalled");
        cursor = response.cursor;
      }
      if (pages === this.maxPages) break;
    }
    return { events, coveredThrough };
  }

  private holderTopics(names: string[]) {
    return names.map(name => [xdr.ScVal.scvSymbol(name).toXDR("base64"), "**"]);
  }

  private async readArchive(): Promise<HolderArchive> {
    try {
      const value = JSON.parse(await readFile(this.options.archiveFile, "utf8")) as HolderArchive;
      if (value.schemaVersion !== 1 || !Array.isArray(value.entries)) {
        throw new Error("Unsupported holder archive");
      }
      return value;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
      return { schemaVersion: 1, updatedAt: new Date(0).toISOString(), entries: [] };
    }
  }

  private async writeArchive(archive: HolderArchive): Promise<void> {
    await mkdir(dirname(this.options.archiveFile), { recursive: true });
    const temporaryPath = `${this.options.archiveFile}.tmp`;
    await writeFile(temporaryPath, `${JSON.stringify(archive, null, 2)}\n`, "utf8");
    await rename(temporaryPath, this.options.archiveFile);
  }

  private async upsertArchiveEntry(entry: HolderArchiveEntry): Promise<void> {
    const mutation = this.archiveMutation.then(async () => {
      const current = await this.readArchive();
      await this.writeArchive({
        schemaVersion: 1,
        updatedAt: new Date().toISOString(),
        entries: [
          ...current.entries.filter((candidate) => candidate.arkaId !== entry.arkaId),
          entry,
        ],
      });
    });
    this.archiveMutation = mutation.catch(() => undefined);
    await mutation;
  }

  private async rpcRead<T>(operation: () => Promise<T>): Promise<T> {
    return retryTransientRpc(operation, {
      attempts: normalizePositiveInteger(this.options.retryAttempts, 4),
      baseDelayMs: normalizePositiveInteger(this.options.retryDelayMs, 250),
    });
  }
}

export function resolveHolderRefreshWindow(
  desiredStartLedger: number,
  oldestLedger: number,
): { startLedger: number; missedLedgerWindow: boolean } {
  return {
    startLedger: Math.max(desiredStartLedger, oldestLedger),
    missedLedgerWindow: desiredStartLedger < oldestLedger,
  };
}

function isMissingTotalSharesMethod(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return message.includes("trying to invoke non-existent contract function") &&
    message.includes("total_shares");
}

export function extractHolderCandidates(
  event: rpc.Api.EventResponse,
  arka: ArkaCatalogEntry,
): string[] {
  const contractId = typeof event.contractId === "string"
    ? event.contractId
    : event.contractId && "contractId" in event.contractId
      ? event.contractId.contractId()
      : event.contractId ? String(event.contractId) : null;
  if (!contractId || event.topic.length === 0) return [];
  const topic = String(scValToNative(event.topic[0]) ?? "");
  if (contractId === arka.arkaId && (topic === "deposit" || topic === "redeem")) {
    const value = scValToNative(event.value) as unknown;
    return Array.isArray(value) && typeof value[0] === "string" ? [value[0]] : [];
  }
  if (contractId !== arka.shareToken || !["mint", "burn", "transfer"].includes(topic)) {
    return [];
  }
  return event.topic
    .slice(1)
    .map((value) => scValToNative(value) as unknown)
    .filter((value): value is string => typeof value === "string");
}

function emptyHolderPage(
  arka: ArkaCatalogEntry,
  query: HolderQuery,
): ArkaHolderPage {
  return {
    arkaId: arka.arkaId,
    shareToken: arka.shareToken,
    totalShares: "0",
    indexedAt: new Date(0).toISOString(),
    complete: false,
    coverageFromLedger: null,
    coverageToLedger: null,
    total: 0,
    offset: normalizeOffset(query.offset),
    limit: normalizeLimit(query.limit),
    items: [],
  };
}

function normalizeOffset(value: number | undefined): number {
  return Number.isInteger(value) && (value ?? 0) >= 0 ? value! : 0;
}

function normalizeLimit(value: number | undefined): number {
  return Number.isInteger(value) && (value ?? 0) > 0 ? Math.min(value!, 100) : 25;
}

function normalizePositiveInteger(value: number | undefined, fallback: number): number {
  return Number.isInteger(value) && (value ?? 0) > 0 ? value! : fallback;
}
