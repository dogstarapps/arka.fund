import { describe, expect, it } from "vitest";
import {
  buildLeaderboardSourceFallback,
  extractLeaderboardSourceSnapshot,
  readLeaderboardSourceSnapshot,
} from "@/lib/runtime/leaderboardSource";

describe("leaderboard source runtime helpers", () => {
  it("returns fallback snapshot for invalid payloads", () => {
    expect(extractLeaderboardSourceSnapshot(null)).toEqual(
      buildLeaderboardSourceFallback(),
    );
  });

  it("extracts oracle guard provenance from validated module data", () => {
    const snapshot = extractLeaderboardSourceSnapshot({
      validatedModules: {
        oracleSafety: {
          validatedAt: "2026-04-16",
          network: "testnet",
          rpcUrl: "https://soroban-testnet.stellar.org",
          providers: {
            primary: "reflector",
            secondary: "twap_guard",
          },
          contracts: {
            oracleGuard: "CORACLEGUARD",
            primaryOracle: "CPRIMARY",
            secondaryOracle: "CSECONDARY",
            validationAsset: "CASSET",
          },
          checks: {
            selectedSourceUnderDivergence: 2,
          },
        },
      },
    });

    expect(snapshot).toMatchObject({
      source: "deployments",
      metrics: {
        ranking: "catalog_rank",
        nav: "catalog_nav",
        profit: "catalog_profit_or_activity",
        volume: "catalog_volume_or_activity",
        activityFallbackWindowEvents: 60,
      },
      oracle: {
        mode: "oracle_guard",
        validatedAt: "2026-04-16",
        network: "testnet",
        rpcUrl: "https://soroban-testnet.stellar.org",
        oracleGuard: "CORACLEGUARD",
        primaryOracle: "CPRIMARY",
        secondaryOracle: "CSECONDARY",
        primaryProvider: "reflector",
        secondaryProvider: "twap_guard",
        provider: "twap_guard",
        validationAsset: "CASSET",
        selectedSourceUnderDivergence: 2,
        source: "deployments",
      },
    });
  });

  it("resolves provider names from env fallback when deployments do not declare them", async () => {
    const snapshot = await readLeaderboardSourceSnapshot(
      (async () =>
        JSON.stringify({
          validatedModules: {
            oracleSafety: {
              validatedAt: "2026-04-16",
              network: "mainnet",
              contracts: {
                oracleGuard: "CORACLEGUARD",
                primaryOracle: "CPRIMARY",
                secondaryOracle: "CSECONDARY",
              },
              checks: {
                selectedSourceUnderDivergence: 1,
              },
            },
          },
        })) as unknown as typeof import("node:fs/promises").readFile,
      {
        ARKAFUND_NETWORK_TARGET: "mainnet",
        ARKAFUND_ORACLE_PROVIDER_PRIMARY_MAINNET: "reflector",
        ARKAFUND_ORACLE_PROVIDER_SECONDARY_MAINNET: "alt_oracle",
      } as unknown as NodeJS.ProcessEnv,
    );

    expect(snapshot.oracle.primaryProvider).toBe("reflector");
    expect(snapshot.oracle.secondaryProvider).toBe("alt_oracle");
    expect(snapshot.oracle.provider).toBe("reflector");
  });

  it("marks source as unverified when deployment target mismatches oracle network", async () => {
    const snapshot = await readLeaderboardSourceSnapshot(
      (async () =>
        JSON.stringify({
          validatedModules: {
            oracleSafety: {
              validatedAt: "2026-04-16",
              network: "testnet",
              contracts: {
                oracleGuard: "CORACLEGUARD",
              },
            },
          },
        })) as unknown as typeof import("node:fs/promises").readFile,
      {
        ARKAFUND_NETWORK_TARGET: "mainnet",
      } as unknown as NodeJS.ProcessEnv,
    );

    expect(snapshot.oracle.mode).toBe("unverified");
    expect(snapshot.deployment.targetNetwork).toBe("mainnet");
    expect(snapshot.deployment.fileFound).toBe(true);
    expect(snapshot.deployment.networkMismatch).toBe(true);
  });

  it("returns fallback with deployment read error when manifest cannot be read", async () => {
    const snapshot = await readLeaderboardSourceSnapshot(
      (async () => {
        const error = new Error("ENOENT: no such file");
        (error as Error & { code?: string }).code = "ENOENT";
        throw error;
      }) as unknown as typeof import("node:fs/promises").readFile,
      {
        ARKAFUND_NETWORK_TARGET: "mainnet",
      } as unknown as NodeJS.ProcessEnv,
    );

    expect(snapshot.oracle.mode).toBe("unverified");
    expect(snapshot.source).toBe("fallback");
    expect(snapshot.deployment.targetNetwork).toBe("mainnet");
    expect(snapshot.deployment.fileFound).toBe(false);
    expect(snapshot.deployment.readError).toBe("ENOENT");
  });
});
