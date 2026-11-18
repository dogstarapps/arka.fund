import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, describe, expect, it, vi } from "vitest";

const MAINNET_REFLECTOR_DEX =
  "CALI2BYU2JE6WVRUFYTS6MSBNEHGJ35P4AVCZYF3B6QOE3QKOB2PLE6M";
const MAINNET_REFLECTOR_EXTERNAL =
  "CAFJZQWSED6YAWZU3GWRTOCNPPCGBN32L7QV43XX5LZLFTK6JLN34DLN";

describe("GET /api/leaderboard/source", () => {
  const originalDeployPath = process.env.ARKAFUND_DEPLOYMENTS_PATH;
  const originalNetworkTarget = process.env.ARKAFUND_NETWORK_TARGET;
  const originalOracleProviderMainnet = process.env.ARKAFUND_ORACLE_PROVIDER_MAINNET;
  let tempDir: string | null = null;

  afterEach(() => {
    vi.restoreAllMocks();
    vi.resetModules();
    if (originalDeployPath === undefined) {
      delete process.env.ARKAFUND_DEPLOYMENTS_PATH;
    } else {
      process.env.ARKAFUND_DEPLOYMENTS_PATH = originalDeployPath;
    }
    if (originalNetworkTarget === undefined) {
      delete process.env.ARKAFUND_NETWORK_TARGET;
    } else {
      process.env.ARKAFUND_NETWORK_TARGET = originalNetworkTarget;
    }
    if (originalOracleProviderMainnet === undefined) {
      delete process.env.ARKAFUND_ORACLE_PROVIDER_MAINNET;
    } else {
      process.env.ARKAFUND_ORACLE_PROVIDER_MAINNET = originalOracleProviderMainnet;
    }
    if (tempDir) {
      rmSync(tempDir, { recursive: true, force: true });
      tempDir = null;
    }
  });

  function writeDeployments(payload: unknown): string {
    tempDir = mkdtempSync(join(tmpdir(), "arkafund-dapp-leaderboard-source-"));
    const deployPath = join(tempDir, "deployments.testnet.json");
    writeFileSync(deployPath, JSON.stringify(payload), "utf8");
    return deployPath;
  }

  it("uses the bundled testnet manifest when no operator path is configured", async () => {
    delete process.env.ARKAFUND_DEPLOYMENTS_PATH;
    process.env.ARKAFUND_NETWORK_TARGET = "testnet";
    const { GET } = await import("@/app/api/leaderboard/source/route");

    const response = await GET();
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.source).toBe("deployments");
    expect(payload.oracle.mode).toBe("oracle_guard");
    expect(payload.oracle.provider).toBe("test-oracle");
    expect(payload.oracle.primaryProvider).toBe("test-oracle");
    expect(payload.oracle.secondaryProvider).toBe("test-oracle");
    expect(payload.deployment.targetNetwork).toBe("testnet");
    expect(payload.deployment.pathSource).toBe("bundled_testnet");
    expect(payload.deployment.fileFound).toBe(true);
    expect(payload.deployment.deploymentsPath).toContain(
      "/config/deployments.testnet.json",
    );
  });

  it("returns oracle guard provenance from deployments", async () => {
    process.env.ARKAFUND_DEPLOYMENTS_PATH = writeDeployments({
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
    const { GET } = await import("@/app/api/leaderboard/source/route");

    const response = await GET();
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.source).toBe("deployments");
    expect(payload.metrics.ranking).toBe("catalog_rank");
    expect(payload.metrics.profit).toBe("catalog_profit_or_activity");
    expect(payload.oracle.mode).toBe("oracle_guard");
    expect(payload.oracle.oracleGuard).toBe("CORACLEGUARD");
    expect(payload.oracle.primaryOracle).toBe("CPRIMARY");
    expect(payload.oracle.secondaryOracle).toBe("CSECONDARY");
    expect(payload.oracle.primaryProvider).toBe("reflector");
    expect(payload.oracle.secondaryProvider).toBe("twap_guard");
    expect(payload.oracle.provider).toBe("twap_guard");
    expect(payload.oracle.selectedSourceUnderDivergence).toBe(2);
    expect(payload.deployment.targetNetwork).toBe("testnet");
    expect(payload.deployment.fileFound).toBe(true);
    expect(payload.deployment.networkMismatch).toBe(false);
    expect(payload.deployment.readError).toBeNull();
  });

  it("uses the bundled mainnet manifest with real Reflector provider IDs and deployed guard state", async () => {
    delete process.env.ARKAFUND_DEPLOYMENTS_PATH;
    process.env.ARKAFUND_NETWORK_TARGET = "mainnet";
    const { GET } = await import("@/app/api/leaderboard/source/route");

    const response = await GET();
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.source).toBe("deployments");
    expect(payload.oracle.mode).toBe("oracle_guard");
    expect(payload.oracle.provider).toBe("Reflector Network");
    expect(payload.oracle.primaryProvider).toBe("Reflector DEX Oracle");
    expect(payload.oracle.secondaryProvider).toBe(
      "Reflector External CEX/DEX Oracle",
    );
    expect(payload.oracle.oracleGuard).toMatch(/^C/);
    expect(payload.oracle.primaryOracle).toBe(MAINNET_REFLECTOR_DEX);
    expect(payload.oracle.secondaryOracle).toBe(MAINNET_REFLECTOR_EXTERNAL);
    expect(payload.oracle.maxOracleAgeSeconds).toBe(900);
    expect(payload.oracle.maxDivergenceBps).toBe(300);
    expect(payload.oracle.minProviderCount).toBe(2);
    expect(payload.deployment.targetNetwork).toBe("mainnet");
    expect(payload.deployment.pathSource).toBe("bundled_mainnet");
    expect(payload.deployment.fileFound).toBe(true);
    expect(payload.deployment.deploymentsPath).toContain(
      "/config/deployments.mainnet.json",
    );
  });
});
