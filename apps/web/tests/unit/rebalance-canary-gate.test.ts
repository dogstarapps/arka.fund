import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, describe, expect, it } from "vitest";
import {
  readRebalanceCanaryGate,
  type RebalanceCanaryVenue,
} from "@/lib/runtime/rebalanceCanaryGate";
import type { ArkafundDeploymentsResolution } from "@/lib/runtime/protocolSupport";

describe("readRebalanceCanaryGate", () => {
  let tempDir: string | null = null;
  const canaryNow = "2026-05-20T10:00:00.000Z";

  afterEach(() => {
    if (tempDir) {
      rmSync(tempDir, { recursive: true, force: true });
      tempDir = null;
    }
  });

  function writeManifest(payload: unknown): string {
    tempDir = mkdtempSync(join(tmpdir(), "arkafund-routing-canary-"));
    const manifestPath = join(tempDir, "deployments.runtime.json");
    writeFileSync(manifestPath, JSON.stringify(payload), "utf8");
    return manifestPath;
  }

  function resolution(
    networkTarget: "testnet" | "mainnet",
    deploymentsPath: string,
  ): ArkafundDeploymentsResolution {
    return {
      networkTarget,
      deploymentsPath,
      pathSource: "env_path",
    };
  }

  function canaryCase(venue: RebalanceCanaryVenue) {
    return {
      id: `${venue.toLowerCase()}-xlm-usdc`,
      venue,
      tokenIn: "native:XLM",
      tokenOut: "USDC:GA5ZSEJYB37N...",
      amountBase: "10000000",
      quoteOutBase: "9812345",
      selectedPath: ["native:XLM", "USDC:GA5ZSEJYB37N..."],
      candidateUniverseSize: 1_204_441,
      quotedPathCount: 128,
      minEfficiencyBps: 9_850,
      plannerEfficiencyBps: 9_992,
      passed: true,
      evidence: {
        mode: "live_mainnet_quote_status",
        collectedAt: "2026-05-20T09:30:00.000Z",
        source: `mainnet-${venue.toLowerCase()}-quote-and-status`,
        liveMainnet: true,
      },
    };
  }

  function validMainnetManifest() {
    return {
      validations: {
        routingCanary: {
          network: "mainnet",
          validatedAt: "2026-05-20T09:45:00.000Z",
          maxAgeHours: 24,
          evidenceMode: "live_mainnet_quote_status",
          requiredVenues: ["SOROSWAP", "AQUARIUS", "BALANCED"],
          cases: [
            canaryCase("SOROSWAP"),
            canaryCase("AQUARIUS"),
            canaryCase("BALANCED"),
          ],
        },
      },
    };
  }

  it("does not require routing canary evidence for testnet lanes", () => {
    const manifestPath = join(tmpdir(), "arkafund-routing-canary-missing.json");
    const gate = readRebalanceCanaryGate(
      resolution("testnet", manifestPath),
      {} as unknown as NodeJS.ProcessEnv,
    );

    expect(gate.ready).toBe(true);
    expect(gate.required).toBe(false);
    expect(gate.status).toBe("not_required");
    expect(gate.code).toBe("not_required");
    expect(gate.checks.manifestFound).toBe(false);
  });

  it("blocks mainnet when the deployments manifest is missing", () => {
    const manifestPath = join(tmpdir(), "arkafund-mainnet-deployments-missing.json");
    const gate = readRebalanceCanaryGate(
      resolution("mainnet", manifestPath),
      { ARKAFUND_ROUTING_CANARY_NOW: canaryNow } as unknown as NodeJS.ProcessEnv,
    );

    expect(gate.ready).toBe(false);
    expect(gate.required).toBe(true);
    expect(gate.status).toBe("blocked");
    expect(gate.code).toBe("manifest_missing");
    expect(gate.checks.manifestFound).toBe(false);
  });

  it("blocks mainnet when routing canary evidence is absent", () => {
    const manifestPath = writeManifest({ validations: {} });
    const gate = readRebalanceCanaryGate(
      resolution("mainnet", manifestPath),
      { ARKAFUND_ROUTING_CANARY_NOW: canaryNow } as unknown as NodeJS.ProcessEnv,
    );

    expect(gate.ready).toBe(false);
    expect(gate.code).toBe("canary_missing");
    expect(gate.checks.manifestFound).toBe(true);
    expect(gate.checks.canaryFound).toBe(false);
  });

  it("blocks mainnet when required venue coverage is incomplete", () => {
    const manifestPath = writeManifest({
      validations: {
        routingCanary: {
          network: "mainnet",
          validatedAt: "2026-05-20T09:45:00.000Z",
          maxAgeHours: 24,
          evidenceMode: "live_mainnet_quote_status",
          requiredVenues: ["SOROSWAP", "AQUARIUS", "BALANCED"],
          cases: [canaryCase("SOROSWAP"), canaryCase("AQUARIUS")],
        },
      },
    });
    const gate = readRebalanceCanaryGate(
      resolution("mainnet", manifestPath),
      { ARKAFUND_ROUTING_CANARY_NOW: canaryNow } as unknown as NodeJS.ProcessEnv,
    );

    expect(gate.ready).toBe(false);
    expect(gate.code).toBe("venue_coverage_incomplete");
    expect(gate.checks.coveredVenues).toEqual(["SOROSWAP", "AQUARIUS"]);
    expect(gate.checks.missingVenues).toEqual(["BALANCED"]);
  });

  it("blocks mainnet when routing canary evidence is stale", () => {
    const manifest = validMainnetManifest();
    manifest.validations.routingCanary.validatedAt = "2026-05-18T09:45:00.000Z";
    const manifestPath = writeManifest(manifest);
    const gate = readRebalanceCanaryGate(
      resolution("mainnet", manifestPath),
      { ARKAFUND_ROUTING_CANARY_NOW: canaryNow } as unknown as NodeJS.ProcessEnv,
    );

    expect(gate.ready).toBe(false);
    expect(gate.code).toBe("canary_stale");
    expect(gate.checks.stale).toBe(true);
    expect(gate.checks.ageHours).toBeGreaterThan(24);
  });

  it("blocks mainnet when cases are not backed by live mainnet evidence", () => {
    const manifest = validMainnetManifest();
    manifest.validations.routingCanary.evidenceMode = "deterministic_benchmark";
    manifest.validations.routingCanary.cases = [
      {
        ...canaryCase("SOROSWAP"),
        evidence: {
          mode: "deterministic_benchmark",
          collectedAt: "2026-05-20T09:30:00.000Z",
          source: "local-benchmark",
          liveMainnet: false,
        },
      },
      canaryCase("AQUARIUS"),
      canaryCase("BALANCED"),
    ];
    const manifestPath = writeManifest(manifest);
    const gate = readRebalanceCanaryGate(
      resolution("mainnet", manifestPath),
      { ARKAFUND_ROUTING_CANARY_NOW: canaryNow } as unknown as NodeJS.ProcessEnv,
    );

    expect(gate.ready).toBe(false);
    expect(gate.code).toBe("evidence_unverified");
    expect(gate.checks.evidenceVerified).toBe(false);
  });

  it("marks mainnet ready only when all required canary cases are validated", () => {
    const manifestPath = writeManifest(validMainnetManifest());
    const gate = readRebalanceCanaryGate(
      resolution("mainnet", manifestPath),
      { ARKAFUND_ROUTING_CANARY_NOW: canaryNow } as unknown as NodeJS.ProcessEnv,
    );

    expect(gate.ready).toBe(true);
    expect(gate.status).toBe("ready");
    expect(gate.code).toBe("ready");
    expect(gate.checks.canaryNetwork).toBe("mainnet");
    expect(gate.checks.requiredVenues).toEqual([
      "SOROSWAP",
      "AQUARIUS",
      "BALANCED",
    ]);
    expect(gate.checks.readyCaseCount).toBe(3);
    expect(gate.checks.failedCaseIds).toEqual([]);
    expect(gate.checks.stale).toBe(false);
    expect(gate.checks.evidenceVerified).toBe(true);
    expect(gate.cases).toHaveLength(3);
  });
});
