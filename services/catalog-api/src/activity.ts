import { rpc, scValToNative, type xdr } from "@stellar/stellar-sdk";
import { createClientOptions, type NetworkConfig } from "./clientOptions.js";
import type {
  ActivityEntry,
  ActivityKind,
  ActivityQuery,
  ArkaCatalogEntry,
  Page,
} from "./types.js";

export interface ActivityReader {
  list(arkas: ArkaCatalogEntry[], query?: ActivityQuery): Promise<Page<ActivityEntry>>;
}

export class StaticActivityReader implements ActivityReader {
  constructor(
    private readonly entries:
      | ActivityEntry[]
      | ((arkas: ArkaCatalogEntry[], query: ActivityQuery) => ActivityEntry[] | Promise<ActivityEntry[]>),
  ) {}

  async list(arkas: ArkaCatalogEntry[], query: ActivityQuery = {}): Promise<Page<ActivityEntry>> {
    const entries = typeof this.entries === "function"
      ? await this.entries(arkas, query)
      : this.entries;
    const allowedArkas = new Set(arkas.map((arka) => arka.arkaId));
    return paginateActivity(
      entries.filter((entry) => allowedArkas.has(entry.arkaId)),
      query,
    );
  }
}

export interface RpcActivityReaderOptions extends NetworkConfig {
  lookbackLedgers?: number;
  pageSize?: number;
  maxPages?: number;
}

export class RpcActivityReader implements ActivityReader {
  private readonly server: rpc.Server;
  private readonly lookbackLedgers: number;
  private readonly pageSize: number;
  private readonly maxPages: number;

  constructor(private readonly options: RpcActivityReaderOptions) {
    this.server = new rpc.Server(options.rpcUrl, {
      allowHttp: options.allowHttp ?? options.rpcUrl.startsWith("http://"),
    });
    this.lookbackLedgers = options.lookbackLedgers ?? 2_000;
    this.pageSize = options.pageSize ?? 100;
    this.maxPages = options.maxPages ?? 10;
  }

  async list(arkas: ArkaCatalogEntry[], query: ActivityQuery = {}): Promise<Page<ActivityEntry>> {
    if (arkas.length === 0) {
      return {
        total: 0,
        offset: 0,
        limit: query.limit ?? 25,
        items: [],
      };
    }

    const arkaById = new Map(arkas.map((arka) => [arka.arkaId, arka]));
    const contractIds = [...arkaById.keys()];
    const health = await this.server.getHealth();
    const oldestLedger = health.oldestLedger ?? 1;
    const endLedger = query.toLedger ?? health.latestLedger;
    if (endLedger < oldestLedger) {
      return {
        total: 0,
        offset: 0,
        limit: query.limit ?? 25,
        items: [],
      };
    }
    const requestedStartLedger =
      query.fromLedger ?? Math.max(1, endLedger - this.lookbackLedgers + 1);
    const startLedger = Math.max(oldestLedger, requestedStartLedger);
    if (startLedger > endLedger) {
      return {
        total: 0,
        offset: 0,
        limit: query.limit ?? 25,
        items: [],
      };
    }
    const events = await this.fetchEvents(contractIds, startLedger, endLedger);
    const mapped = events
      .map((event) => mapRpcEvent(event, arkaById))
      .filter((entry): entry is ActivityEntry => entry !== null);

    return paginateActivity(mapped, query);
  }

  private async fetchEvents(
    contractIds: string[],
    startLedger: number,
    endLedger: number,
  ): Promise<rpc.Api.EventResponse[]> {
    const filters = [{ type: "contract" as const, contractIds }];
    const events: rpc.Api.EventResponse[] = [];
    let pages = 0;
    let response = await this.server.getEvents({
      startLedger,
      endLedger,
      filters,
      limit: this.pageSize,
    });

    while (true) {
      pages += 1;
      for (const event of response.events) {
        if (event.ledger > endLedger) {
          return events;
        }
        events.push(event);
      }
      if (response.events.length < this.pageSize || pages >= this.maxPages) {
        return events;
      }
      response = await this.server.getEvents({
        cursor: response.cursor,
        filters,
        limit: this.pageSize,
      });
      if (response.events.length === 0) {
        return events;
      }
    }
  }
}

export class NoopActivityReader implements ActivityReader {
  async list(_arkas: ArkaCatalogEntry[], query: ActivityQuery = {}): Promise<Page<ActivityEntry>> {
    return {
      total: 0,
      offset: 0,
      limit: query.limit ?? 25,
      items: [],
    };
  }
}

function paginateActivity(entries: ActivityEntry[], query: ActivityQuery): Page<ActivityEntry> {
  const filtered = entries.filter((entry) => {
    if (query.kind && entry.kind !== query.kind) {
      return false;
    }
    if (query.fromLedger !== undefined && entry.ledger < query.fromLedger) {
      return false;
    }
    if (query.toLedger !== undefined && entry.ledger > query.toLedger) {
      return false;
    }
    return true;
  });
  const sorted = [...filtered].sort((left, right) =>
    compareActivityEntries(left, right, query.order ?? "desc"),
  );
  const limit = query.limit && query.limit > 0 ? query.limit : 25;
  return {
    total: sorted.length,
    offset: 0,
    limit,
    items: sorted.slice(0, limit),
  };
}

function mapRpcEvent(
  event: rpc.Api.EventResponse,
  arkaById: Map<string, ArkaCatalogEntry>,
): ActivityEntry | null {
  const contractId = contractIdToString(event.contractId);
  if (!contractId) {
    return null;
  }
  const arka = arkaById.get(contractId);
  if (!arka || event.topic.length === 0) {
    return null;
  }

  const topic = scValToNative(event.topic[0]) as string | null;
  const value = scValToNative(event.value) as unknown;
  if (!topic) {
    return null;
  }

  if (topic === "deposit" && Array.isArray(value) && value.length >= 3) {
    return {
      eventId: event.id,
      cursor: event.id,
      arkaId: arka.arkaId,
      manager: arka.manager,
      kind: "deposit",
      ledger: event.ledger,
      ledgerClosedAt: event.ledgerClosedAt,
      txHash: event.txHash,
      transactionIndex: event.transactionIndex,
      operationIndex: event.operationIndex,
      inSuccessfulContractCall: event.inSuccessfulContractCall,
      user: nativeToString(value[0]),
      assetContract: arka.denominationContract,
      marketId: null,
      amount: nativeBigIntToString(value[1]),
      shares: nativeBigIntToString(value[2]),
      netOut: null,
      stepCount: null,
    };
  }

  if (topic === "redeem" && Array.isArray(value) && value.length >= 3) {
    return {
      eventId: event.id,
      cursor: event.id,
      arkaId: arka.arkaId,
      manager: arka.manager,
      kind: "redeem",
      ledger: event.ledger,
      ledgerClosedAt: event.ledgerClosedAt,
      txHash: event.txHash,
      transactionIndex: event.transactionIndex,
      operationIndex: event.operationIndex,
      inSuccessfulContractCall: event.inSuccessfulContractCall,
      user: nativeToString(value[0]),
      assetContract: arka.denominationContract,
      marketId: null,
      amount: null,
      shares: nativeBigIntToString(value[1]),
      netOut: nativeBigIntToString(value[2]),
      stepCount: null,
    };
  }

  if (topic === "profit" && Array.isArray(value) && value.length >= 2) {
    return {
      eventId: event.id,
      cursor: event.id,
      arkaId: arka.arkaId,
      manager: arka.manager,
      kind: "profit",
      ledger: event.ledger,
      ledgerClosedAt: event.ledgerClosedAt,
      txHash: event.txHash,
      transactionIndex: event.transactionIndex,
      operationIndex: event.operationIndex,
      inSuccessfulContractCall: event.inSuccessfulContractCall,
      user: null,
      assetContract: null,
      marketId: null,
      amount: nativeBigIntToString(value[0]),
      shares: null,
      netOut: null,
      stepCount: nativeNumber(value[1]),
    };
  }

  if (topic === "blend" && Array.isArray(value) && value.length >= 3) {
    const action = normalizeBlendKind(nativeToString(value[0]));
    if (!action) {
      return null;
    }
    return {
      eventId: event.id,
      cursor: event.id,
      arkaId: arka.arkaId,
      manager: arka.manager,
      kind: action,
      ledger: event.ledger,
      ledgerClosedAt: event.ledgerClosedAt,
      txHash: event.txHash,
      transactionIndex: event.transactionIndex,
      operationIndex: event.operationIndex,
      inSuccessfulContractCall: event.inSuccessfulContractCall,
      user: null,
      assetContract: null,
      marketId: nativeBigIntToString(value[1]),
      amount: nativeBigIntToString(value[2]),
      shares: null,
      netOut: null,
      stepCount: null,
    };
  }

  return null;
}

function compareActivityEntries(
  left: ActivityEntry,
  right: ActivityEntry,
  order: NonNullable<ActivityQuery["order"]>,
): number {
  const direction = order === "asc" ? 1 : -1;
  if (left.ledger !== right.ledger) {
    return (left.ledger - right.ledger) * direction;
  }
  if (left.transactionIndex !== right.transactionIndex) {
    return (left.transactionIndex - right.transactionIndex) * direction;
  }
  if (left.operationIndex !== right.operationIndex) {
    return (left.operationIndex - right.operationIndex) * direction;
  }
  return left.eventId.localeCompare(right.eventId) * direction;
}

function contractIdToString(contract: rpc.Api.EventResponse["contractId"]): string | null {
  if (!contract) {
    return null;
  }
  if (typeof contract === "string") {
    return contract;
  }
  if ("contractId" in contract && typeof contract.contractId === "function") {
    return contract.contractId();
  }
  return String(contract);
}

function normalizeBlendKind(value: string | null): ActivityKind | null {
  if (value === "lend") {
    return "lend";
  }
  if (value === "borrow") {
    return "borrow";
  }
  if (value === "repay") {
    return "repay";
  }
  if (value === "wdrw") {
    return "withdraw";
  }
  return null;
}

function nativeBigIntToString(value: unknown): string | null {
  if (typeof value === "bigint") {
    return value.toString();
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.trunc(value).toString();
  }
  if (typeof value === "string") {
    return value;
  }
  return null;
}

function nativeNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "bigint") {
    return Number(value);
  }
  return null;
}

function nativeToString(value: unknown): string | null {
  if (typeof value === "string") {
    return value;
  }
  return nativeBigIntToString(value);
}
