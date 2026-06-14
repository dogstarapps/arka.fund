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
    return new OnChainCatalogSyncRunner({
      rpcUrl: required(env, "CATALOG_API_RPC_URL"),
      networkPassphrase: required(env, "CATALOG_API_NETWORK_PASSPHRASE"),
      registryContractId: required(env, "CATALOG_API_REGISTRY_CONTRACT_ID"),
      allowHttp: (env.CATALOG_API_RPC_URL ?? "").startsWith("http://"),
    });
  }

  if (backend === "graphql") {
    const authToken = env.CATALOG_API_GRAPHQL_AUTH_TOKEN;
    return new GraphqlCatalogSyncRunner({
      graphqlUrl: required(env, "CATALOG_API_GRAPHQL_URL"),
      profile: resolveGraphqlProfile(env),
      pageSize: optionalInteger(env.CATALOG_API_GRAPHQL_PAGE_SIZE),
      requestTimeoutMs: optionalInteger(env.CATALOG_API_GRAPHQL_TIMEOUT_MS),
      headers: authToken ? { authorization: `Bearer ${authToken}` } : undefined,
    });
  }

  throw new Error(`Unsupported catalog ingestion backend: ${backend}`);
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
