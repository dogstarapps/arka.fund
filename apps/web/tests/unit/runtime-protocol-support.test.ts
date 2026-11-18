import { describe, expect, it, vi } from "vitest";
import {
  extractBalancedProtocolHealth,
  inferArkafundNetworkTarget,
  readBalancedProtocolHealth,
  resolveArkafundDeployments,
  resolveArkafundDeploymentsPath,
} from "@/lib/runtime/protocolSupport";

describe("runtime protocol support helpers", () => {
  it("resolves bundled testnet deployments by default and keeps mainnet separate", () => {
    expect(
      resolveArkafundDeploymentsPath({} as unknown as NodeJS.ProcessEnv),
    ).toContain("/config/deployments.testnet.json");
    expect(
      resolveArkafundDeploymentsPath({
        ARKAFUND_DEPLOYMENTS_PATH: "/tmp/custom.json",
      } as unknown as NodeJS.ProcessEnv),
    ).toBe("/tmp/custom.json");

    expect(
      resolveArkafundDeploymentsPath({
        ARKAFUND_NETWORK_TARGET: "mainnet",
      } as unknown as NodeJS.ProcessEnv),
    ).toContain("/config/deployments.mainnet.json");

    expect(
      resolveArkafundDeploymentsPath({
        NEXT_PUBLIC_STELLAR_NETWORK: "Public Global Stellar Network ; September 2015",
      } as unknown as NodeJS.ProcessEnv),
    ).toContain("/config/deployments.mainnet.json");
  });

  it("infers network target from explicit override or passphrase", () => {
    expect(
      inferArkafundNetworkTarget({
        ARKAFUND_NETWORK_TARGET: "mainnet",
      } as unknown as NodeJS.ProcessEnv),
    ).toBe("mainnet");
    expect(
      inferArkafundNetworkTarget({
        NEXT_PUBLIC_STELLAR_NETWORK: "Public Global Stellar Network ; September 2015",
      } as unknown as NodeJS.ProcessEnv),
    ).toBe("mainnet");
    expect(inferArkafundNetworkTarget({} as unknown as NodeJS.ProcessEnv)).toBe("testnet");
  });

  it("returns deployments resolution metadata", () => {
    expect(
      resolveArkafundDeployments({
        ARKAFUND_NETWORK_TARGET: "testnet",
      } as unknown as NodeJS.ProcessEnv),
    ).toMatchObject({
      networkTarget: "testnet",
      pathSource: "bundled_testnet",
    });

    expect(
      resolveArkafundDeployments({
        ARKAFUND_NETWORK_TARGET: "mainnet",
      } as unknown as NodeJS.ProcessEnv),
    ).toMatchObject({
      networkTarget: "mainnet",
      pathSource: "bundled_mainnet",
      deploymentsPath: expect.stringContaining("/config/deployments.mainnet.json"),
    });

    expect(
      resolveArkafundDeployments({
        ARKAFUND_DEPLOYMENTS_PATH: "/tmp/deployments.custom.json",
        ARKAFUND_NETWORK_TARGET: "mainnet",
      } as unknown as NodeJS.ProcessEnv),
    ).toMatchObject({
      networkTarget: "mainnet",
      pathSource: "env_path",
      deploymentsPath: "/tmp/deployments.custom.json",
    });
  });

  it("extracts Balanced readiness from deployments payload", () => {
    const snapshot = extractBalancedProtocolHealth({
      validatedModules: {
        balancedExecution: {
          validatedAt: "2026-03-30",
          sourceValidations: ["balancedReadiness"],
          contracts: {
            router: "CROUTER",
          },
          checks: {
            poolId: 7,
          },
        },
      },
      validations: {
        balancedReadiness: {
          validatedAt: "2026-03-30",
          adapterBalanced: "CBALANCED",
          poolId: 7,
          supportStatus: "blocked",
          readyForDappExecution: false,
          laneMode: "legacy_comet",
          blockingReasons: ["legacy router"],
          observedRouter: "COBSERVED",
          expectedRouter: null,
          poolSupported: false,
          pairConfigured: true,
        },
        balancedOfficialSurface: {
          officialSources: {
            app: "https://app.balanced.network",
            bundle: "https://app.balanced.network/assets/index.js",
            stellarPage: "https://balanced.network/stellar/",
            swapDocs: "https://docs.balanced.network/swap-assets",
            tradeBlog: "https://blog.balanced.network/trade-cross-chain/",
            q3Blog: "https://blog.balanced.network/q3-2025/",
          },
          topology: "intent_based",
          swapModel: "sodax_intents",
          intentAdapter: {
            quoteProvider: "sodax",
            quoteVisibleInApp: true,
            quoteComparableForArka: false,
            publicQuoteEndpoint: null,
            statusSurface: "recent_activity",
            publicStatusEndpoint: null,
            publicReceiptEndpoint: null,
            cancellationWindowSeconds: 300,
          },
        },
      },
    });

    expect(snapshot).toMatchObject({
      validatedAt: "2026-03-30",
      adapterBalanced: "CBALANCED",
      poolId: 7,
      supportStatus: "blocked",
      laneMode: "legacy_comet",
      source: "deployments",
      pairConfigured: true,
      validatedModule: {
        present: true,
        router: "CROUTER",
        poolId: 7,
      },
      intentVenue: {
        discoveryState: "available",
        quoteState: "limited",
        executeState: "unavailable",
        plannerAdmission: "blocked",
      },
      officialSurface: {
        officialSources: {
          app: "https://app.balanced.network",
          bundle: "https://app.balanced.network/assets/index.js",
        },
        intentAdapter: {
          quoteVisibleInApp: true,
          statusSurface: "recent_activity",
          cancellationWindowSeconds: 300,
        },
      },
    });
  });

  it("infers canonical readiness from validatedModules when readiness validation is absent", () => {
    const snapshot = extractBalancedProtocolHealth({
      validatedModules: {
        balancedExecution: {
          validatedAt: "2026-04-16",
          sourceValidations: ["balancedReadiness"],
          contracts: {
            adapterBalanced: "CBALANCEDCANONICAL",
            router: "CROUTERCANONICAL",
          },
          checks: {
            poolId: 5,
          },
        },
      },
      validations: {
        balancedOfficialSurface: {
          topology: "intent_based",
          swapModel: "sodax_intents",
          intentAdapter: {
            quoteProvider: "sodax",
            quoteVisibleInApp: true,
            quoteComparableForArka: false,
            statusSurface: "recent_activity",
          },
        },
      },
    });

    expect(snapshot).toMatchObject({
      adapterBalanced: "CBALANCEDCANONICAL",
      poolId: 5,
      supportStatus: "ready",
      readyForDappExecution: true,
      laneMode: "expected_router",
      expectedRouter: "CROUTERCANONICAL",
      observedRouter: "CROUTERCANONICAL",
      poolSupported: true,
      pairConfigured: true,
      source: "deployments",
      validatedModule: {
        present: true,
        router: "CROUTERCANONICAL",
        poolId: 5,
      },
      intentVenue: {
        executeState: "available",
        plannerAdmission: "manual_only",
      },
    });
  });

  it("reads and normalizes Balanced readiness from the deployments file", async () => {
    const readFileMock = vi.fn(async () =>
      JSON.stringify({
        validations: {
          balancedOfficialSurface: {
            officialSources: {
              app: "https://app.balanced.network",
              bundle: "https://app.balanced.network/assets/index.js",
              stellarPage: "https://balanced.network/stellar/",
              swapDocs: "https://docs.balanced.network/swap-assets",
              tradeBlog: "https://blog.balanced.network/trade-cross-chain/",
              q3Blog: "https://blog.balanced.network/q3-2025/",
            },
            topology: "intent_based",
            swapModel: "sodax_intents",
            intentAdapter: {
              quoteProvider: "sodax",
              quoteVisibleInApp: true,
              quoteComparableForArka: false,
              publicQuoteEndpoint: null,
              statusSurface: "recent_activity",
              publicStatusEndpoint: null,
              publicReceiptEndpoint: null,
              cancellationWindowSeconds: 300,
            },
          },
          balancedReadiness: {
            validatedAt: "2026-03-30",
            adapterBalanced: "CBALANCED",
            poolId: 1,
            supportStatus: "ready",
            readyForDappExecution: true,
            laneMode: "expected_router",
            blockingReasons: [],
            observedRouter: "CROUTER",
            expectedRouter: "CROUTER",
            poolSupported: true,
            pairConfigured: false,
          },
        },
        validatedModules: {
          balancedExecution: {
            validatedAt: "2026-03-30",
            sourceValidations: ["balancedReadiness"],
            contracts: {
              router: "CROUTER",
            },
            checks: {
              poolId: 1,
            },
          },
        },
      }),
    );

    await expect(
      readBalancedProtocolHealth(
        readFileMock as unknown as typeof import("node:fs/promises").readFile,
        {
          ARKAFUND_DEPLOYMENTS_PATH: "/tmp/deployments.json",
        } as unknown as NodeJS.ProcessEnv,
      ),
    ).resolves.toMatchObject({
      supportStatus: "ready",
      readyForDappExecution: true,
      expectedRouter: "CROUTER",
      source: "deployments",
      intentVenue: {
        quoteState: "limited",
        quoteModel: "manual_only",
        manualExecutionEligible: true,
        plannerAdmission: "manual_only",
      },
      officialSurface: {
        officialSources: {
          app: "https://app.balanced.network",
        },
        intentAdapter: {
          quoteVisibleInApp: true,
          statusSurface: "recent_activity",
          cancellationWindowSeconds: 300,
        },
      },
      validatedModule: {
        present: true,
        router: "CROUTER",
      },
    });
  });
});
