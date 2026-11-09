import { describe, expect, it } from "vitest";
import {
  deriveCoverageCommandSignals,
  deriveCoverageSummary,
  deriveCreateCommandSignals,
  deriveCreateFlowSteps,
  deriveCreatePolicyPostureSteps,
  deriveCreateSummary,
  deriveBalancedLaneState,
  deriveMainnetOracleGateState,
  deriveGovernanceParticipationSignals,
  deriveGovernanceStageMetrics,
  deriveGovernanceSummary,
  deriveIntegrationHealth,
  deriveIntegrationShowcaseCards,
  deriveIntegrationRuntimeSignals,
  formatWalletStatus,
  formatCoverageAmount,
  proposalStatusLabel,
  supportLabel,
} from "@/lib/workflows/productFlows";

const MAINNET_REFLECTOR_DEX =
  "CALI2BYU2JE6WVRUFYTS6MSBNEHGJ35P4AVCZYF3B6QOE3QKOB2PLE6M";
const MAINNET_REFLECTOR_EXTERNAL =
  "CAFJZQWSED6YAWZU3GWRTOCNPPCGBN32L7QV43XX5LZLFTK6JLN34DLN";

describe("workflow product helpers", () => {
  it("derives coverage utilization, headroom and member position", () => {
    const summary = deriveCoverageSummary({
      vaultBalance: 1_000_000,
      vaultMaxWithdrawable: 250_000,
      fundStake: 120_000,
      fundPending: 30_000,
      walletTokenBalance: 400_000,
    });

    expect(summary.utilizationBps).toBe(7500);
    expect(summary.hasHeadroom).toBe(true);
    expect(summary.userPosition).toBe(150_000);
    expect(summary.idleWalletBalance).toBe(400_000);

    expect(
      deriveCoverageCommandSignals({
        pubKey: "GCFLOW",
        walletLabel: "GCFLOW...DEFG",
        stakeAmount: "12.5",
        unstakeAmount: "5",
        pendingRewards: 30_000,
        summary,
      }),
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "wallet",
          value: "GCFLOW...DEFG",
          tone: "positive",
        }),
        expect.objectContaining({
          id: "stake-plan",
          value: "12.5 / 5",
        }),
      ]),
    );
  });

  it("formats coverage balances using SAC decimals", () => {
    expect(formatCoverageAmount(1_234_567)).toBe("0.1234567");
    expect(formatCoverageAmount(123_456_789, 6)).toBe("123.46");
    expect(formatCoverageAmount(10_000_000)).toBe("1");
  });

  it("maps governance status and support labels", () => {
    expect(proposalStatusLabel(0)).toBe("Open");
    expect(proposalStatusLabel(4)).toBe("Executed");
    expect(proposalStatusLabel(9)).toBe("Status 9");
    expect(supportLabel(null)).toBe("No vote yet");
    expect(supportLabel(0)).toBe("Against");
    expect(supportLabel(1)).toBe("For");
    expect(supportLabel(2)).toBe("Abstain");
    expect(supportLabel(7)).toBe("Support 7");
  });

  it("derives governance summary from live proposal and vote state", () => {
    const summary = deriveGovernanceSummary({
      settings: {
        proposal_threshold: 10,
        vote_delay: 2,
        vote_period: 1440,
        timelock: 600,
        grace_period: 86_400,
        quorum: 100,
        counting_type: 0,
        vote_threshold: 51,
      },
      proposal: {
        id: 12,
        title: "Rotate council",
        description: "Update operational council",
        creator: "GOVERNOR",
        status: 1,
        vote_start: 100,
        vote_end: 200,
        eta: 240,
        executable: true,
        action: "council",
      },
      votes: {
        _for: 300,
        against: 12,
        abstain: 8,
      },
      voteState: 1,
    });

    expect(summary.totalVotes).toBe(320);
    expect(summary.proposalState).toBe("Successful");
    expect(summary.walletState).toBe("For");
    expect(summary.timelock).toBe(600);
    expect(summary.hasExecutableProposal).toBe(true);

    expect(
      deriveGovernanceParticipationSignals({
        pubKey: "GCFLOW",
        walletLabel: "GCFLOW...WXYZ",
        summary,
        proposal: {
          id: 12,
          title: "Rotate council",
          description: "Update operational council",
          creator: "GOVERNOR",
          status: 1,
          vote_start: 100,
          vote_end: 200,
          eta: 240,
          executable: true,
          action: "council",
        },
      }),
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "wallet",
          value: "GCFLOW...WXYZ",
          tone: "positive",
        }),
        expect.objectContaining({
          id: "execution-window",
          value: "Open",
          tone: "positive",
        }),
      ]),
    );

    expect(
      deriveGovernanceStageMetrics({
        summary,
        proposal: {
          id: 12,
          title: "Rotate council",
          description: "Update operational council",
          creator: "GOVERNOR",
          status: 1,
          vote_start: 100,
          vote_end: 200,
          eta: 240,
          executable: true,
          action: "council",
        },
        votes: {
          _for: 300,
          against: 12,
          abstain: 8,
        },
        walletLabel: "GCFLOW...WXYZ",
        pubKey: "GCFLOW",
      }),
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "proposals",
          value: "13",
        }),
        expect.objectContaining({
          id: "voting-power",
          value: "320",
          tone: "positive",
        }),
      ]),
    );
  });

  it("derives creation readiness and next operational step", () => {
    const summary = deriveCreateSummary({
      pubKey: "GCREATOR",
      routerId: "CROUTER",
      denominationInput: "",
      defaultDenomination: "CDENOM",
      feeToken: "CFEE",
      feeAmount: 5000000,
      whitelist: ["CA", "CB"],
      setupIntent: "BLEND",
      createdArkaId: "CARKA",
    });

    expect(summary.denomination).toBe("CDENOM");
    expect(summary.hasWallet).toBe(true);
    expect(summary.hasRouter).toBe(true);
    expect(summary.hasDenomination).toBe(true);
    expect(summary.feeRequired).toBe(true);
    expect(summary.whitelistCount).toBe(2);
    expect(summary.isReady).toBe(true);
    expect(summary.nextStep).toMatch(/Blend vault position/i);
    expect(summary.createdArkaId).toBe("CARKA");

    expect(
      deriveCreateCommandSignals({
        walletLabel: "GCREAT...WXYZ",
        summary,
        setupIntent: "BLEND",
      }),
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "wallet",
          value: "GCREAT...WXYZ",
        }),
        expect.objectContaining({
          id: "deployment",
          value: "Ready to sign",
          tone: "positive",
        }),
        expect.objectContaining({
          id: "handoff",
          value: "Credit",
        }),
      ]),
    );

    expect(
      deriveCreateFlowSteps({
        summary,
        setupIntent: "BLEND",
      }).map((step) => step.label),
    ).toEqual([
      "Before you start",
      "Basics",
      "Fees",
      "Deposits",
      "Redemptions",
      "Assets management",
      "Review",
    ]);

    expect(
      deriveCreatePolicyPostureSteps({
        summary,
        depositFeePct: "0.5",
        redeemFeePct: "1",
        setupIntent: "REBALANCE",
      }),
    ).toEqual([
      expect.objectContaining({
        id: "policy",
        label: "Fee policy",
        detail: "Deposit 0.50% / redeem 1%; factory mandate signs these values with the initial vault configuration.",
        state: "done",
      }),
      expect.objectContaining({
        id: "assets",
        label: "Asset universe",
        detail: "2 allowed assets in the initial mandate; future changes use governed controls.",
        state: "done",
      }),
      expect.objectContaining({
        id: "handoff",
        label: "Rebalance actions",
        detail: "Configure supported routing from the created Arka page after launch.",
        state: "done",
      }),
    ]);
  });

  it("maps router health and wallet display state for integration surfaces", () => {
    expect(deriveIntegrationHealth("CROUTER", "CROUTER")).toEqual({
      matched: true,
      label: "Healthy",
      tone: "positive",
    });
    expect(deriveIntegrationHealth("CROUTER", "COTHER")).toEqual({
      matched: false,
      label: "Mismatch",
      tone: "warning",
    });
    expect(deriveIntegrationHealth("CROUTER", null)).toEqual({
      matched: false,
      label: "Unavailable",
      tone: "critical",
    });
    expect(
      deriveIntegrationHealth("", "COTHER", {
        supportStatus: "blocked",
      }),
    ).toEqual({
      matched: false,
      label: "Pending",
      tone: "warning",
    });
    expect(
      deriveIntegrationHealth("", "COTHER", {
        supportStatus: "inactive",
      }),
    ).toEqual({
      matched: false,
      label: "Inactive",
      tone: "neutral",
    });
    expect(formatWalletStatus("GCFLOW1234567890ABCDEFG")).toBe("GCFLOW...DEFG");
    expect(formatWalletStatus("")).toBe("Offline");

    expect(
      deriveIntegrationRuntimeSignals({
        pubKey: "GCFLOW",
        walletLabel: "GCFLOW...DEFG",
        loadedRoutes: 4,
        balancedLane: deriveBalancedLaneState({
          health: { matched: true, label: "Healthy", tone: "positive" },
          pairConfigured: true,
          poolId: "1",
          amount: "0.2500",
          minOut: "0.2400",
          supportStatus: "ready",
          laneMode: "expected_router",
        }),
        blendAction: "Borrow",
        blendAmount: "0.2500",
        routes: [
          { matched: true, label: "Healthy", tone: "positive" },
          { matched: true, label: "Healthy", tone: "positive" },
          { matched: true, label: "Healthy", tone: "positive" },
          { matched: false, label: "Mismatch", tone: "warning" },
        ],
      }),
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "wallet",
          value: "GCFLOW...DEFG",
        }),
        expect.objectContaining({
          id: "routes",
          value: "3/4",
          tone: "warning",
        }),
        expect.objectContaining({
          id: "balanced",
          value: "Pool 1 · 0.2500",
          tone: "positive",
        }),
        expect.objectContaining({
          id: "blend",
          value: "Borrow 0.2500",
        }),
      ]),
    );

    expect(
      deriveIntegrationShowcaseCards({
        pubKey: "GCFLOW",
        walletLabel: "GCFLOW...DEFG",
        loadedRoutes: 3,
        balanced: { matched: true, label: "Healthy", tone: "positive" },
        aquarius: { matched: true, label: "Healthy", tone: "positive" },
        soroswap: { matched: true, label: "Healthy", tone: "positive" },
        blend: { matched: false, label: "Mismatch", tone: "warning" },
      }),
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "balanced",
          title: "Balanced",
          statusTone: "positive",
        }),
        expect.objectContaining({
          id: "blend",
          title: "Blend",
          statusTone: "warning",
        }),
        expect.objectContaining({
          id: "routing",
          statusLabel: "Attention",
        }),
        expect.objectContaining({
          id: "wallet",
          statusLabel: "Connected",
        }),
      ]),
    );

    expect(
      deriveBalancedLaneState({
        health: { matched: false, label: "Mismatch", tone: "warning" },
        pairConfigured: false,
        poolId: "1",
        amount: "0.25",
        minOut: "0.24",
        supportStatus: "blocked",
        laneMode: "legacy_comet",
      }),
    ).toEqual(
      expect.objectContaining({
        ready: false,
        tone: "warning",
      }),
    );
    expect(
      deriveBalancedLaneState({
        health: { matched: true, label: "Blocked", tone: "warning" },
        pairConfigured: false,
        poolId: "1",
        amount: "0.25",
        minOut: "0.24",
        supportStatus: "blocked",
        laneMode: "legacy_comet",
      }).detail,
    ).toMatch(/execution is blocked/i);
  });

  it("derives mainnet oracle publication gate state from runtime snapshot", () => {
    expect(
      deriveMainnetOracleGateState({
        source: "fallback",
        metrics: {
          ranking: "catalog_rank",
          nav: "catalog_nav",
          profit: "catalog_profit_or_activity",
          volume: "catalog_volume_or_activity",
          activityFallbackWindowEvents: 60,
        },
        oracle: {
          mode: "unverified",
          validatedAt: null,
          network: null,
          rpcUrl: null,
          oracleGuard: null,
          primaryOracle: null,
          secondaryOracle: null,
          validationAsset: null,
          selectedSourceUnderDivergence: null,
          source: "fallback",
        },
        deployment: {
          targetNetwork: "testnet",
          deploymentsPath: "/tmp/deployments.testnet.json",
          pathSource: "env_path",
          fileFound: true,
          networkMismatch: false,
          readError: null,
        },
      }),
    ).toMatchObject({
      targetNetwork: "testnet",
      ready: true,
      value: "Not required",
      tone: "neutral",
    });

    expect(
      deriveMainnetOracleGateState({
        source: "fallback",
        metrics: {
          ranking: "catalog_rank",
          nav: "catalog_nav",
          profit: "catalog_profit_or_activity",
          volume: "catalog_volume_or_activity",
          activityFallbackWindowEvents: 60,
        },
        oracle: {
          mode: "unverified",
          validatedAt: null,
          network: null,
          rpcUrl: null,
          oracleGuard: null,
          primaryOracle: null,
          secondaryOracle: null,
          validationAsset: null,
          selectedSourceUnderDivergence: null,
          source: "fallback",
        },
        deployment: {
          targetNetwork: "mainnet",
          deploymentsPath: "/tmp/deployments.mainnet.json",
          pathSource: "env_path",
          fileFound: false,
          networkMismatch: false,
          readError: "ENOENT",
        },
      }),
    ).toMatchObject({
      targetNetwork: "mainnet",
      ready: false,
      value: "Pending",
      tone: "warning",
    });

    expect(
      deriveMainnetOracleGateState({
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
          network: "mainnet",
          rpcUrl: "https://mainnet.example/rpc",
          oracleGuard: "CORACLEGUARD",
          primaryOracle: MAINNET_REFLECTOR_DEX,
          secondaryOracle: MAINNET_REFLECTOR_EXTERNAL,
          primaryProvider: "Reflector DEX Oracle",
          secondaryProvider: "Reflector External CEX/DEX Oracle",
          provider: "Reflector Network",
          validationAsset: "native:XLM",
          maxOracleAgeSeconds: 300,
          maxDivergenceBps: 100,
          minProviderCount: 2,
          selectedSourceUnderDivergence: 2,
          source: "deployments",
        },
        deployment: {
          targetNetwork: "mainnet",
          deploymentsPath: "/tmp/deployments.mainnet.json",
          pathSource: "env_path",
          fileFound: true,
          networkMismatch: false,
          readError: null,
        },
      }),
    ).toMatchObject({
      targetNetwork: "mainnet",
      ready: true,
      value: "Ready",
      tone: "positive",
    });
  });
});
