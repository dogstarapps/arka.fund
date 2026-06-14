import { buildSnapshot } from "./catalog.js";
import {
  buildGraphqlPageDefinition,
  extractGraphqlArkaNodes,
  extractGraphqlConnectionNodes,
  type GraphqlProfile,
} from "./graphqlProfiles.js";
import type { CatalogSyncRunner } from "./runners.js";
import type {
  ArkaAssetExposure,
  ArkaCatalogEntry,
  CatalogSnapshot,
  FeeSummary,
} from "./types.js";

const DEFAULT_PAGE_SIZE = 100;
const DEFAULT_TIMEOUT_MS = 10_000;

export interface GraphqlCatalogSyncRunnerOptions {
  graphqlUrl: string;
  profile?: GraphqlProfile;
  pageSize?: number;
  requestTimeoutMs?: number;
  headers?: Record<string, string>;
}

interface GraphqlArkaNode {
  id?: unknown;
  arkaId?: unknown;
  manager?: unknown;
  curated?: unknown;
  delisted?: unknown;
  nav?: unknown;
  denominationContract?: unknown;
  whitelistContracts?: unknown;
  shareToken?: unknown;
  syncedAt?: unknown;
  fees?: unknown;
  assets?: unknown;
}

interface GraphqlEnvelope<T> {
  data?: T;
  errors?: Array<{ message?: string }>;
}

export class GraphqlCatalogSyncRunner implements CatalogSyncRunner {
  private readonly pageSize: number;
  private readonly requestTimeoutMs: number;
  private readonly headers: Record<string, string>;
  private readonly profile: GraphqlProfile;

  constructor(private readonly options: GraphqlCatalogSyncRunnerOptions) {
    this.pageSize = options.pageSize ?? DEFAULT_PAGE_SIZE;
    this.requestTimeoutMs = options.requestTimeoutMs ?? DEFAULT_TIMEOUT_MS;
    this.profile = options.profile ?? "generic";
    this.headers = {
      "content-type": "application/json",
      ...(options.headers ?? {}),
    };
  }

  async run(): Promise<CatalogSnapshot> {
    const syncedAt = new Date().toISOString();
    const arkas: ArkaCatalogEntry[] = [];
    const failures: Array<{ arkaId: string; message: string; syncedAt: string }> = [];
    let skip = 0;

    while (true) {
      const page = await this.fetchPage(skip);
      for (const node of page) {
        try {
          arkas.push(normalizeGraphqlArkaNode(node, syncedAt));
        } catch (error) {
          failures.push({
            arkaId: stringifyCandidate(node.arkaId) ?? stringifyCandidate(node.id) ?? `graphql:${skip}`,
            message: error instanceof Error ? error.message : String(error),
            syncedAt,
          });
        }
      }
      if (page.length < this.pageSize) {
        break;
      }
      skip += page.length;
    }

    return buildSnapshot(arkas, failures, syncedAt);
  }

  private async fetchPage(skip: number): Promise<GraphqlArkaNode[]> {
    const definition = buildGraphqlPageDefinition(this.profile, {
      first: this.pageSize,
      skip,
    });
    const response = await this.graphqlRequest<unknown>(definition);
    return extractGraphqlArkaNodes(this.profile, response) as GraphqlArkaNode[];
  }

  private async graphqlRequest<T>(body: { query: string; variables: Record<string, unknown> }): Promise<T> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.requestTimeoutMs);
    try {
      const response = await fetch(this.options.graphqlUrl, {
        method: "POST",
        headers: this.headers,
        body: JSON.stringify(body),
        signal: controller.signal,
      });
      if (!response.ok) {
        throw new Error(`GraphQL request failed with status ${response.status}`);
      }
      const payload = (await response.json()) as GraphqlEnvelope<T>;
      if (payload.errors && payload.errors.length > 0) {
        throw new Error(
          `GraphQL response contained errors: ${payload.errors.map((item) => item.message ?? "unknown").join("; ")}`,
        );
      }
      if (!payload.data) {
        throw new Error("GraphQL response did not include data");
      }
      return payload.data;
    } finally {
      clearTimeout(timeout);
    }
  }
}

export function normalizeGraphqlArkaNode(
  node: GraphqlArkaNode,
  fallbackSyncedAt: string,
): ArkaCatalogEntry {
  const arkaId = stringifyRequired(node.arkaId ?? node.id, "arkaId");
  const manager = stringifyRequired(node.manager, "manager");
  const syncedAt = stringifyCandidate(node.syncedAt) ?? fallbackSyncedAt;
  const whitelistContracts = arrayOfStrings(node.whitelistContracts, "whitelistContracts");
  const assets = arrayOfObjects(extractGraphqlConnectionNodes(node.assets), "assets").map((asset) =>
    normalizeGraphqlAssetExposure(asset, syncedAt),
  );

  return {
    arkaId,
    manager,
    curated: booleanOrDefault(node.curated, false),
    delisted: booleanOrDefault(node.delisted, false),
    nav: bigintToString(node.nav, "nav"),
    denominationContract: stringifyCandidate(node.denominationContract),
    whitelistContracts,
    shareToken: stringifyCandidate(node.shareToken),
    fees: normalizeGraphqlFeeSummary(node.fees),
    assets,
    syncedAt,
  };
}

function normalizeGraphqlFeeSummary(input: unknown): FeeSummary {
  if (!isRecord(input)) {
    throw new Error("Missing GraphQL fee summary");
  }
  return {
    mgmtBps: numberFromUnknown(input.mgmtBps, "fees.mgmtBps"),
    perfBps: numberFromUnknown(input.perfBps, "fees.perfBps"),
    depositBps: numberFromUnknown(input.depositBps, "fees.depositBps"),
    redeemBps: numberFromUnknown(input.redeemBps, "fees.redeemBps"),
  };
}

function normalizeGraphqlAssetExposure(
  input: Record<string, unknown>,
  fallbackSyncedAt: string,
): ArkaAssetExposure {
  return {
    assetContract: stringifyRequired(input.assetContract, "assets[].assetContract"),
    isDenomination: booleanOrDefault(input.isDenomination, false),
    liquidBalance: bigintToString(input.liquidBalance, "assets[].liquidBalance"),
    collateralAmount: bigintToString(input.collateralAmount, "assets[].collateralAmount"),
    debtAmount: bigintToString(input.debtAmount, "assets[].debtAmount"),
    netManagedAmount: bigintToString(input.netManagedAmount, "assets[].netManagedAmount"),
    netPositionValue: bigintToString(input.netPositionValue, "assets[].netPositionValue"),
    marketIds: arrayOfStrings(input.marketIds, "assets[].marketIds"),
    syncedAt: stringifyCandidate(input.syncedAt) ?? fallbackSyncedAt,
  };
}

function numberFromUnknown(value: unknown, field: string): number {
  if (typeof value === "number") {
    return value;
  }
  if (typeof value === "bigint") {
    return Number(value);
  }
  if (typeof value === "string" && value.trim() !== "") {
    return Number.parseInt(value, 10);
  }
  throw new Error(`Missing or invalid GraphQL number field: ${field}`);
}

function bigintToString(value: unknown, field: string): string {
  if (typeof value === "string" && value.trim() !== "") {
    return value;
  }
  if (typeof value === "number" || typeof value === "bigint") {
    return String(value);
  }
  throw new Error(`Missing or invalid GraphQL bigint field: ${field}`);
}

function stringifyRequired(value: unknown, field: string): string {
  const candidate = stringifyCandidate(value);
  if (!candidate) {
    throw new Error(`Missing or invalid GraphQL string field: ${field}`);
  }
  return candidate;
}

function stringifyCandidate(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function booleanOrDefault(value: unknown, fallback: boolean): boolean {
  return typeof value === "boolean" ? value : fallback;
}

function arrayOfStrings(value: unknown, field: string): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  const items = value.map((item) => stringifyCandidate(item));
  if (items.some((item) => item === null)) {
    throw new Error(`Invalid GraphQL string array field: ${field}`);
  }
  return items as string[];
}

function arrayOfObjects(value: unknown, field: string): Array<Record<string, unknown>> {
  if (!Array.isArray(value)) {
    return [];
  }
  const items = value.filter((item): item is Record<string, unknown> => isRecord(item));
  if (items.length !== value.length) {
    throw new Error(`Invalid GraphQL object array field: ${field}`);
  }
  return items;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
