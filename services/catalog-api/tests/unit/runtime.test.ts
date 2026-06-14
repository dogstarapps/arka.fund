import test from "node:test";
import assert from "node:assert/strict";
import {
  createActivityReaderFromEnv,
  createCatalogSyncRunnerFromEnv,
  resolveGraphqlProfile,
  resolveActivityBackend,
} from "../../src/runtime.js";
import { GraphqlCatalogSyncRunner } from "../../src/graphqlRunner.js";
import { NoopActivityReader, RpcActivityReader } from "../../src/activity.js";
import { OnChainCatalogSyncRunner } from "../../src/runners.js";

test("createCatalogSyncRunnerFromEnv builds the native runner by default", () => {
  const runner = createCatalogSyncRunnerFromEnv({
    CATALOG_API_RPC_URL: "http://127.0.0.1:8000",
    CATALOG_API_NETWORK_PASSPHRASE: "Standalone Network ; February 2017",
    CATALOG_API_REGISTRY_CONTRACT_ID: "CREGISTRY",
  });
  assert.ok(runner instanceof OnChainCatalogSyncRunner);
});

test("createCatalogSyncRunnerFromEnv builds the GraphQL runner when configured", () => {
  const runner = createCatalogSyncRunnerFromEnv({
    CATALOG_API_INGESTION_BACKEND: "graphql",
    CATALOG_API_GRAPHQL_URL: "http://127.0.0.1:4100/graphql",
    CATALOG_API_GRAPHQL_AUTH_TOKEN: "secret",
    CATALOG_API_GRAPHQL_PROFILE: "subquery",
  });
  assert.ok(runner instanceof GraphqlCatalogSyncRunner);
});

test("resolveGraphqlProfile defaults to generic and accepts subquery", () => {
  assert.equal(resolveGraphqlProfile({}), "generic");
  assert.equal(resolveGraphqlProfile({ CATALOG_API_GRAPHQL_PROFILE: "subquery" }), "subquery");
});

test("resolveActivityBackend infers rpc when rpc env is present", () => {
  assert.equal(
    resolveActivityBackend({
      CATALOG_API_RPC_URL: "http://127.0.0.1:8000",
      CATALOG_API_NETWORK_PASSPHRASE: "Standalone Network ; February 2017",
    }),
    "rpc",
  );
  assert.equal(resolveActivityBackend({}), "none");
});

test("createActivityReaderFromEnv builds either rpc or noop readers", () => {
  const rpcReader = createActivityReaderFromEnv({
    CATALOG_API_RPC_URL: "http://127.0.0.1:8000",
    CATALOG_API_NETWORK_PASSPHRASE: "Standalone Network ; February 2017",
  });
  assert.ok(rpcReader instanceof RpcActivityReader);

  const noopReader = createActivityReaderFromEnv({
    CATALOG_API_ACTIVITY_BACKEND: "none",
  });
  assert.ok(noopReader instanceof NoopActivityReader);
});
