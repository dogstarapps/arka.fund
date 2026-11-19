// @vitest-environment node

import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, describe, expect, it } from "vitest";
import {
  buildTestnetDressRehearsalReport,
  deriveTestnetDressRehearsalGateFromReport,
} from "@/lib/runtime/testnetDressRehearsal.mjs";

const account = (seed: string) => `G${seed.repeat(55).slice(0, 55)}`;
const contract = (seed: string) => `C${seed.repeat(55).slice(0, 55)}`;
const tx = (index: number) => index.toString(16).padStart(64, "0");

function writeJson(path: string, payload: unknown): void {
  writeFileSync(path, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
}

function buildReadyFixture(root: string): {
  evidenceRoot: string;
  deploymentsPath: string;
  txManifestPath: string;
  reportPath: string;
} {
  const evidenceRoot = join(root, "tmp");
  const deploymentsPath = join(root, "deployments.testnet.json");
  const txManifestPath = join(root, "contract-deployments.testnet.json");
  const reportPath = join(root, "testnet-dress-rehearsal-evidence.json");

  const mk = (name: string) => join(evidenceRoot, name);
  rmSync(evidenceRoot, { recursive: true, force: true });
  writeFileSync(join(root, ".keep"), "", "utf8");
  mkdirSync(evidenceRoot, { recursive: true });

  writeJson(deploymentsPath, {
    network: "testnet",
    rpcUrl: "https://soroban-testnet.stellar.org",
    contracts: {
      arka: contract("A"),
      arkaFactory: contract("B"),
      arkaRegistry: contract("C"),
      router: contract("D"),
      governor: contract("E"),
      votes: contract("F"),
      coverageVault: contract("G"),
      coverageFund: contract("H"),
      adapterBlend: contract("I"),
      oracleGuard: contract("J"),
      adapterAquarius: contract("K"),
      adapterSoroswap: contract("L"),
      managerTier: contract("M"),
      aquariusRouter: contract("N"),
      soroswapRouter: contract("O"),
    },
    validatedModules: {
      arka: { status: "validated" },
      router: { status: "validated" },
      coverage: { status: "validated" },
    },
  });

  const txNamespaces = [
    "coverageVault",
    "coverageFund",
    "adapterBlend",
    "governedPolicy",
    "managerTier",
    "arkaMigration",
  ];
  writeJson(txManifestPath, {
    network: "testnet",
    txs: Object.fromEntries(
      txNamespaces.map((namespace, namespaceIndex) => [
        namespace,
        Object.fromEntries(
          Array.from({ length: 6 }, (_, offset) => [
            `op_${offset}`,
            tx(namespaceIndex * 6 + offset + 1),
          ]),
        ),
      ]),
    ),
  });

  writeJson(mk("create-live-validation.json"), {
    factory: contract("B"),
    manager: account("A"),
    salt: tx(88),
    newArka: contract("P"),
    router: contract("D"),
    denomination: contract("Q"),
    whitelist: [contract("Q"), contract("R")],
    onchainDenomination: { contract: contract("Q") },
    onchainWhitelist: [{ contract: contract("Q") }, { contract: contract("R") }],
    managerArkasBefore: [contract("S")],
    managerArkasAfter: [contract("S"), contract("P")],
  });

  writeJson(mk("deposit-redeem-live-validation.json"), {
    arka: contract("P"),
    token: contract("Q"),
    admin: account("A"),
    holder: account("B"),
    holderMintAmount: "5000000",
    validationDepositAmount: "100000",
    validationRedeemShares: "50000",
    holderBalance: "4950000",
    holderShares: "50000",
    arkaNav: "50000",
    arkaLiquidBalance: "50000",
  });

  writeJson(mk("rebalance-live-validation.json"), {
    arka: contract("P"),
    manager: account("B"),
    protocol: "AQUARIUS",
    router: contract("N"),
    aquariusRouter: contract("N"),
    soroswapRouter: contract("O"),
    tokenIn: contract("Q"),
    tokenOut: contract("R"),
    swapAmount: "100000",
    walletOutDelta: "97750",
    beforeInputBalance: "0",
    beforeOutputBalance: "0",
    afterInputBalance: "0",
    afterOutputBalance: "97750",
  });

  writeJson(mk("coverage-claims-live-validation.json"), {
    coverageEconomics: {
      validatedAt: "2026-05-21",
      network: "testnet",
      contracts: {
        reserveToken: contract("T"),
        bootstrapToken: contract("U"),
        coverageVault: contract("V"),
        coverageFund: contract("W"),
        claimsManager: contract("X"),
      },
      results: {
        premiumReceipt: { premium_amount: "240" },
        rewardClaim: { reserve_reward: "84" },
        fundMetricsAfterPremium: { reserve_ratio_bps: "945" },
      },
    },
    claimsCircuit: {
      validatedAt: "2026-05-21",
      network: "testnet",
      contracts: {
        reserveToken: contract("T"),
        bootstrapToken: contract("U"),
        coverageVault: contract("V"),
        coverageFund: contract("W"),
        claimsManager: contract("X"),
      },
      results: {
        rejectedIncident: { id: 1, status: 4 },
        approvedPlan: { approved_payout: "1000" },
        executedIncident: { id: 2, executed_at: 1 },
      },
    },
  });

  writeJson(mk("governance-live-validation.json"), {
    governor: contract("E"),
    votes: contract("F"),
    council: contract("B"),
    proposerAddress: account("A"),
    forVoterAddress: account("B"),
    proposalThreshold: 1,
    voteDelay: 0,
    votePeriod: 720,
    timelock: 5,
    gracePeriod: 17280,
    quorumBps: 100,
    countingType: 5,
    voteThresholdBps: 5100,
  });

  writeJson(mk("governance-handoff-live-validation.json"), {
    validatedAt: "2026-05-21",
    network: "testnet",
    contracts: {
      governor: contract("E"),
      governanceExecutor: contract("Y"),
      arkaToken: contract("Z"),
      lockedArka: contract("A"),
    },
    proposal: { proposalTxHash: tx(99) },
    results: { currentVotes: "220", liquidBalance: "1", lockedBalance: "220" },
  });

  writeJson(mk("oracle-guard-live-validation.json"), {
    validatedAt: "2026-05-21",
    network: "testnet",
    contracts: {
      oracleGuard: contract("J"),
      primaryOracle: contract("K"),
      secondaryOracle: contract("L"),
      validationAsset: contract("Q"),
    },
    results: {
      secondarySelection: { selected_source: 2 },
      staleFallback: { selected_source: 2 },
      failClosed: { price: "0" },
    },
  });

  writeJson(mk("swap-guardrails-live-validation.json"), {
    validatedAt: "2026-05-21",
    network: "testnet",
    contracts: {
      arka: contract("P"),
      token: contract("Q"),
      router: contract("D"),
      profitAdapter: contract("M"),
      swapOracle: contract("N"),
    },
    results: {
      successfulRebalanceOut: "100000",
      blockedDisallowedAdapter: true,
      blockedPriceImpact: true,
    },
  });

  writeJson(mk("balanced-readiness-validation.json"), {
    validatedAt: "2026-05-21",
    network: "testnet",
    contracts: {
      adapterBalanced: contract("O"),
      legacyCometRouter: contract("P"),
      legacyMockRouter: contract("Q"),
    },
    supportStatus: "blocked",
    readyForDappExecution: false,
    laneMode: "undeclared",
  });

  writeJson(mk("blend-live-validation.json"), {
    arka: contract("P"),
    adapterBlend: contract("I"),
    blendPool: contract("R"),
    asset: contract("S"),
    secondAsset: contract("T"),
    depositAmount: "10000000",
    actionAmount: "1000000",
    blendMaxOracleAge: "3600",
    blendMinHealthFactor: "12500000",
  });

  writeJson(mk("indexer-event-surface-live-validation.json"), {
    validatedAt: "2026-05-21T10:00:00.000Z",
    startLedger: 100,
    endLedger: 110,
    registryId: contract("C"),
    arkaId: contract("P"),
    registryEvents: Array.from({ length: 4 }, (_, index) => ({
      txHash: tx(120 + index),
      ledger: 100 + index,
    })),
    arkaEvents: Array.from({ length: 4 }, (_, index) => ({
      txHash: tx(130 + index),
      ledger: 105 + index,
    })),
  });

  writeJson(mk("tokenomics-live-validation.json"), {
    validatedAt: "2026-05-21",
    network: "testnet",
    contracts: {
      arkaToken: contract("U"),
      lockedArka: contract("V"),
      governanceExecutor: contract("W"),
      arkaVesting: contract("X"),
      emissionsController: contract("Y"),
    },
    results: {
      grant: { total_amount: "3000" },
      stream: { total_amount: "2400" },
      teamVotesFinal: "1000",
    },
  });

  writeJson(mk("offchain-testnet-stack.json"), {
    validatedAt: "2026-05-21",
    network: "testnet",
    rpcUrl: "https://soroban-testnet.stellar.org",
    registryContractId: contract("C"),
    catalogBootstrapHealth: { statusCode: 200 },
    dappHealth: { catalog: { statusCode: 200, error: null } },
  });

  return { evidenceRoot, deploymentsPath, txManifestPath, reportPath };
}

describe("testnet dress rehearsal gate", () => {
  let root: string | null = null;

  afterEach(() => {
    if (root) {
      rmSync(root, { recursive: true, force: true });
      root = null;
    }
  });

  it("passes only when all required testnet rehearsal lanes have transaction and state evidence", () => {
    root = mkdtempSync(join(tmpdir(), "arkafund-testnet-rehearsal-"));
    const fixture = buildReadyFixture(root);

    const report = buildTestnetDressRehearsalReport({
      ...fixture,
      nowMs: Date.parse("2026-05-21T10:00:00.000Z"),
    });
    const gate = deriveTestnetDressRehearsalGateFromReport(report, {
      ...fixture,
      nowMs: Date.parse("2026-05-21T10:00:00.000Z"),
    });

    expect(report.status).toBe("ready");
    expect(report.summary.readyStepCount).toBe(7);
    expect(report.summary.transactionHashCount).toBeGreaterThanOrEqual(30);
    expect(report.summary.stateProofCount).toBeGreaterThanOrEqual(70);
    expect(gate).toEqual(
      expect.objectContaining({
        ready: true,
        status: "ready",
        code: "ready",
        target: "testnet_dress_rehearsal",
      }),
    );
  });

  it("blocks when a required live validation artifact is missing", () => {
    root = mkdtempSync(join(tmpdir(), "arkafund-testnet-rehearsal-"));
    const fixture = buildReadyFixture(root);
    rmSync(join(fixture.evidenceRoot, "rebalance-live-validation.json"));

    const report = buildTestnetDressRehearsalReport({
      ...fixture,
      nowMs: Date.parse("2026-05-21T10:00:00.000Z"),
    });
    const gate = deriveTestnetDressRehearsalGateFromReport(report, {
      ...fixture,
      nowMs: Date.parse("2026-05-21T10:00:00.000Z"),
    });

    expect(report.status).toBe("blocked");
    expect(report.blockers.join(" ")).toContain("rebalance");
    expect(gate.ready).toBe(false);
    expect(gate.code).toBe("step_incomplete");
  });

  it("blocks on a network mismatch instead of accepting mainnet or unknown rehearsal evidence", () => {
    root = mkdtempSync(join(tmpdir(), "arkafund-testnet-rehearsal-"));
    const fixture = buildReadyFixture(root);
    writeJson(fixture.deploymentsPath, {
      network: "mainnet",
      rpcUrl: "https://soroban-rpc.mainnet.stellar.gateway.fm",
      contracts: {},
      validatedModules: {},
    });

    const report = buildTestnetDressRehearsalReport({
      ...fixture,
      nowMs: Date.parse("2026-05-21T10:00:00.000Z"),
    });

    expect(report.status).toBe("blocked");
    expect(report.blockers.join(" ")).toContain("deployments.network must be testnet");
  });
});
