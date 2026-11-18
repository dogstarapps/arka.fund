import { describe, expect, it } from "vitest";
import type { LeaderboardDataSourceSnapshot } from "@/lib/catalog/types";
import { deriveOracleCutoverGate } from "@/lib/runtime/oracleCutoverGate";

const MAINNET_REFLECTOR_DEX =
  "CALI2BYU2JE6WVRUFYTS6MSBNEHGJ35P4AVCZYF3B6QOE3QKOB2PLE6M";
const MAINNET_REFLECTOR_EXTERNAL =
  "CAFJZQWSED6YAWZU3GWRTOCNPPCGBN32L7QV43XX5LZLFTK6JLN34DLN";
const TESTNET_REFLECTOR_DEX =
  "CAVLP5DH2GQ3T5DTCQEMYYT2CEBSXTV6THKFYGY6FJI7TGZCQHLESOAR";

function buildSnapshot(
  overrides?: Partial<LeaderboardDataSourceSnapshot>,
): LeaderboardDataSourceSnapshot {
  const rest = { ...(overrides ?? {}) };
  delete rest.oracle;
  delete rest.deployment;
  const oracle = {
    mode: "oracle_guard",
    validatedAt: "2026-04-16",
    network: "mainnet",
    rpcUrl: "https://rpc.invalid",
    oracleGuard: "CORACLEGUARD",
    primaryOracle: MAINNET_REFLECTOR_DEX,
    secondaryOracle: MAINNET_REFLECTOR_EXTERNAL,
    validationAsset: "native:XLM",
    maxOracleAgeSeconds: 300,
    maxDivergenceBps: 100,
    minProviderCount: 2,
    selectedSourceUnderDivergence: 1,
    source: "deployments",
    primaryProvider: "Reflector DEX Oracle",
    secondaryProvider: "Reflector External CEX/DEX Oracle",
    provider: "Reflector Network",
    ...(overrides?.oracle ?? {}),
  } as LeaderboardDataSourceSnapshot["oracle"];

  const deployment = {
    targetNetwork: "mainnet",
    deploymentsPath: "/tmp/deployments.mainnet.json",
    pathSource: "env_path",
    fileFound: true,
    networkMismatch: false,
    readError: null,
    ...(overrides?.deployment ?? {}),
  } as LeaderboardDataSourceSnapshot["deployment"];

  return {
    source: "deployments",
    metrics: {
      ranking: "catalog_rank",
      nav: "catalog_nav",
      profit: "catalog_profit_or_activity",
      volume: "catalog_volume_or_activity",
      activityFallbackWindowEvents: 60,
    },
    ...rest,
    oracle,
    deployment,
  };
}

describe("deriveOracleCutoverGate", () => {
  it("returns not_required when enforcing mainnet-only gate on testnet target", () => {
    const gate = deriveOracleCutoverGate(
      buildSnapshot({
        deployment: {
          targetNetwork: "testnet",
          deploymentsPath: "/tmp/deployments.testnet.json",
          pathSource: "env_path",
          fileFound: true,
          networkMismatch: false,
          readError: null,
        },
      }),
      { enforceMainnetOnly: true },
    );
    expect(gate.status).toBe("not_required");
    expect(gate.code).toBe("not_required");
    expect(gate.ready).toBe(true);
  });

  it("returns blocked manifest_missing when deployment manifest is absent", () => {
    const gate = deriveOracleCutoverGate(
      buildSnapshot({
        deployment: {
          targetNetwork: "mainnet",
          deploymentsPath: "/tmp/deployments.mainnet.json",
          pathSource: "env_path",
          fileFound: false,
          networkMismatch: false,
          readError: "ENOENT",
        },
      }),
      { enforceMainnetOnly: true },
    );
    expect(gate.status).toBe("blocked");
    expect(gate.code).toBe("manifest_missing");
    expect(gate.ready).toBe(false);
  });

  it("returns blocked network_mismatch when oracle validation network does not match runtime target", () => {
    const gate = deriveOracleCutoverGate(
      buildSnapshot({
        deployment: {
          targetNetwork: "mainnet",
          deploymentsPath: "/tmp/deployments.mainnet.json",
          pathSource: "env_path",
          fileFound: true,
          networkMismatch: true,
          readError: null,
        },
        oracle: {
          mode: "unverified",
          validatedAt: "2026-04-16",
          network: "testnet",
          rpcUrl: "https://rpc.invalid",
          oracleGuard: "CORACLEGUARD",
          primaryOracle: "CPRIMARY",
          secondaryOracle: "CSECONDARY",
          validationAsset: "CASSET",
          maxOracleAgeSeconds: 300,
          maxDivergenceBps: 100,
          minProviderCount: 2,
          selectedSourceUnderDivergence: 1,
          source: "deployments",
        },
      }),
      { enforceMainnetOnly: true },
    );
    expect(gate.status).toBe("blocked");
    expect(gate.code).toBe("network_mismatch");
    expect(gate.ready).toBe(false);
  });

  it("returns blocked contracts_incomplete when oracle contracts are missing", () => {
    const gate = deriveOracleCutoverGate(
      buildSnapshot({
        oracle: {
          mode: "oracle_guard",
          validatedAt: "2026-04-16",
          network: "mainnet",
          rpcUrl: "https://rpc.invalid",
          oracleGuard: "CORACLEGUARD",
          primaryOracle: null,
          secondaryOracle: MAINNET_REFLECTOR_EXTERNAL,
          validationAsset: "native:XLM",
          maxOracleAgeSeconds: 300,
          maxDivergenceBps: 100,
          minProviderCount: 2,
          selectedSourceUnderDivergence: 1,
          source: "deployments",
        },
      }),
      { enforceMainnetOnly: true },
    );
    expect(gate.status).toBe("blocked");
    expect(gate.code).toBe("contracts_incomplete");
    expect(gate.ready).toBe(false);
  });

  it("returns blocked provider_unverified when mainnet points to a testnet Reflector contract", () => {
    const gate = deriveOracleCutoverGate(
      buildSnapshot({
        oracle: {
          mode: "oracle_guard",
          validatedAt: "2026-05-20",
          network: "mainnet",
          rpcUrl: "https://rpc.invalid",
          oracleGuard: "CORACLEGUARD",
          primaryOracle: TESTNET_REFLECTOR_DEX,
          secondaryOracle: MAINNET_REFLECTOR_EXTERNAL,
          validationAsset: "native:XLM",
          maxOracleAgeSeconds: 300,
          maxDivergenceBps: 100,
          minProviderCount: 2,
          selectedSourceUnderDivergence: 1,
          source: "deployments",
          primaryProvider: "Reflector DEX Oracle",
          secondaryProvider: "Reflector External CEX/DEX Oracle",
          provider: "Reflector Network",
        },
      }),
      { enforceMainnetOnly: true },
    );
    expect(gate.status).toBe("blocked");
    expect(gate.code).toBe("provider_unverified");
    expect(gate.checks.noTestnetProviderFallback).toBe(false);
  });

  it("returns blocked thresholds_unconfigured when divergence policy is absent", () => {
    const gate = deriveOracleCutoverGate(
      buildSnapshot({
        oracle: {
          mode: "oracle_guard",
          validatedAt: "2026-05-20",
          network: "mainnet",
          rpcUrl: "https://rpc.invalid",
          oracleGuard: "CORACLEGUARD",
          primaryOracle: MAINNET_REFLECTOR_DEX,
          secondaryOracle: MAINNET_REFLECTOR_EXTERNAL,
          validationAsset: "native:XLM",
          maxOracleAgeSeconds: null,
          maxDivergenceBps: 100,
          minProviderCount: 2,
          selectedSourceUnderDivergence: 1,
          source: "deployments",
          primaryProvider: "Reflector DEX Oracle",
          secondaryProvider: "Reflector External CEX/DEX Oracle",
          provider: "Reflector Network",
        },
      }),
      { enforceMainnetOnly: true },
    );
    expect(gate.status).toBe("blocked");
    expect(gate.code).toBe("thresholds_unconfigured");
    expect(gate.checks.thresholdsConfigured).toBe(false);
  });

  it("returns ready when mainnet gate is fully satisfied", () => {
    const gate = deriveOracleCutoverGate(buildSnapshot(), {
      enforceMainnetOnly: true,
    });
    expect(gate.status).toBe("ready");
    expect(gate.code).toBe("ready");
    expect(gate.ready).toBe(true);
    expect(gate.checks.providersVerified).toBe(true);
    expect(gate.checks.thresholdsConfigured).toBe(true);
  });
});
