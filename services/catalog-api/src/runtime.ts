import { Networks } from "@stellar/stellar-sdk";
import { NoopHolderReader, RpcHolderReader, type HolderReader } from "./holders.js";
import { withVerifiedProfit } from "./profitSync.js";
import { createMainnetProfitSource } from "./profitRpc.js";
import { NoopActivityReader, RpcActivityReader, type ActivityReader } from "./activity.js";
import { GraphqlCatalogSyncRunner } from "./graphqlRunner.js";
import type { GraphqlProfile } from "./graphqlProfiles.js";
import { OnChainCatalogSyncRunner, type CatalogSyncRunner } from "./runners.js";

export type IngestionBackend = "native" | "graphql";
export type ActivityBackend = "rpc" | "none";

export function createCatalogSyncRunnerFromEnv(
  env: NodeJS.ProcessEnv = process.env,
): CatalogSyncRunner {
  const backend = (env.CATALOG_API_INGESTION_BACKEND ?? "native") as IngestionBackend;

  if (backend === "native") {
    const runner = new OnChainCatalogSyncRunner({
      rpcUrl: required(env, "CATALOG_API_RPC_URL"),
      networkPassphrase: required(env, "CATALOG_API_NETWORK_PASSPHRASE"),
      registryContractId: required(env, "CATALOG_API_REGISTRY_CONTRACT_ID"),
      oracleGuardContractId: env.CATALOG_API_ORACLE_GUARD_CONTRACT_ID,
      publicKey: env.CATALOG_API_READ_SOURCE,
      pageSize: optionalInteger(env.CATALOG_API_REGISTRY_PAGE_SIZE),
      readConcurrency: optionalInteger(env.CATALOG_API_READ_CONCURRENCY),
      retryAttempts: optionalInteger(env.CATALOG_API_RPC_RETRY_ATTEMPTS),
      retryDelayMs: optionalInteger(env.CATALOG_API_RPC_RETRY_DELAY_MS),
      allowHttp: (env.CATALOG_API_RPC_URL ?? "").startsWith("http://"),
    });
    return configureProfit(runner, env);
  }

  if (backend === "graphql") {
    const authToken = env.CATALOG_API_GRAPHQL_AUTH_TOKEN;
    return configureProfit(new GraphqlCatalogSyncRunner({
      graphqlUrl: required(env, "CATALOG_API_GRAPHQL_URL"),
      profile: resolveGraphqlProfile(env),
      pageSize: optionalInteger(env.CATALOG_API_GRAPHQL_PAGE_SIZE),
      requestTimeoutMs: optionalInteger(env.CATALOG_API_GRAPHQL_TIMEOUT_MS),
      headers: authToken ? { authorization: `Bearer ${authToken}` } : undefined,
    }), env);
  }

  throw new Error(`Unsupported catalog ingestion backend: ${backend}`);
}

function configureProfit(runner: CatalogSyncRunner, env: NodeJS.ProcessEnv): CatalogSyncRunner {
  const seed = env.CATALOG_API_PROFIT_SEED_FILE;
  const state = env.CATALOG_API_PROFIT_CHECKPOINT_FILE;
  if (!seed && !state) return runner;
  if (!seed || !state || env.CATALOG_API_NETWORK_PASSPHRASE !== Networks.PUBLIC) {
    throw new Error("Verified profit requires a mainnet RPC, seed file and checkpoint file");
  }
  return withVerifiedProfit(runner, createMainnetProfitSource(required(env, "CATALOG_API_RPC_URL")), { seed, state });
}

export function resolveGraphqlProfile(
  env: NodeJS.ProcessEnv = process.env,
): GraphqlProfile {
  return (env.CATALOG_API_GRAPHQL_PROFILE ?? "generic") as GraphqlProfile;
}

export function createActivityReaderFromEnv(
  env: NodeJS.ProcessEnv = process.env,
): ActivityReader {
  const backend = resolveActivityBackend(env);

  if (backend === "none") {
    return new NoopActivityReader();
  }

  return new RpcActivityReader({
    rpcUrl: required(env, "CATALOG_API_RPC_URL"),
    networkPassphrase: required(env, "CATALOG_API_NETWORK_PASSPHRASE"),
    allowHttp: (env.CATALOG_API_RPC_URL ?? "").startsWith("http://"),
    lookbackLedgers: optionalInteger(env.CATALOG_API_ACTIVITY_LOOKBACK_LEDGERS) ?? 10_000,
    pageSize: optionalInteger(env.CATALOG_API_ACTIVITY_PAGE_SIZE) ?? 100,
    maxPages: optionalInteger(env.CATALOG_API_ACTIVITY_MAX_PAGES) ?? 10,
    retryAttempts: optionalInteger(env.CATALOG_API_RPC_RETRY_ATTEMPTS),
    retryDelayMs: optionalInteger(env.CATALOG_API_RPC_RETRY_DELAY_MS),
  });
}

export function resolveActivityBackend(
  env: NodeJS.ProcessEnv = process.env,
): ActivityBackend {
  if (env.CATALOG_API_ACTIVITY_BACKEND) {
    return env.CATALOG_API_ACTIVITY_BACKEND as ActivityBackend;
  }
  return env.CATALOG_API_RPC_URL && env.CATALOG_API_NETWORK_PASSPHRASE ? "rpc" : "none";
}

export function createHolderReaderFromEnv(env: NodeJS.ProcessEnv = process.env): HolderReader {
  if (!env.CATALOG_API_RPC_URL || !env.CATALOG_API_NETWORK_PASSPHRASE) return new NoopHolderReader();
  return new RpcHolderReader({
    rpcUrl: env.CATALOG_API_RPC_URL,
    networkPassphrase: env.CATALOG_API_NETWORK_PASSPHRASE,
    archiveFile: env.CATALOG_API_HOLDER_FILE ?? "./var/catalog-holders.json",
    initialLedger: optionalInteger(env.CATALOG_API_HOLDER_INITIAL_LEDGER),
    pageSize: optionalInteger(env.CATALOG_API_HOLDER_PAGE_SIZE),
    maxPages: optionalInteger(env.CATALOG_API_HOLDER_MAX_PAGES),
    retryAttempts: optionalInteger(env.CATALOG_API_RPC_RETRY_ATTEMPTS),
    retryDelayMs: optionalInteger(env.CATALOG_API_RPC_RETRY_DELAY_MS),
  });
}

function optionalInteger(value: string | undefined): number | undefined {
  if (!value) {
    return undefined;
  }
  return Number.parseInt(value, 10);
}

function required(env: NodeJS.ProcessEnv, name: string): string {
  const value = env[name];
  if (!value) {
    throw new Error(`Missing required env var: ${name}`);
  }
  return value;
}
