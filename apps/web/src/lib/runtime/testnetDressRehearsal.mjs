import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import crypto from "node:crypto";
import path from "node:path";

export const TESTNET_DRESS_REHEARSAL_REPORT_VERSION = 1;
export const DEFAULT_TESTNET_DRESS_REHEARSAL_REPORT_PATH =
  "docs/testnet-dress-rehearsal-evidence.json";

const STELLAR_CONTRACT_RE = /^C[A-Z0-9]{55}$/;
const STELLAR_ACCOUNT_RE = /^G[A-Z0-9]{55}$/;
const TX_HASH_RE = /^[a-f0-9]{64}$/i;
const DEFAULT_MAX_REPORT_AGE_DAYS = 120;

export const REQUIRED_TESTNET_REHEARSAL_STEPS = [
  {
    id: "deployment_manifest",
    label: "Deploy/redeploy canonical testnet contracts",
    description:
      "Canonical testnet deployments, contract IDs, module transaction hashes and registry posture are present.",
  },
  {
    id: "create_factory",
    label: "Create Arka through the factory",
    description:
      "Factory-created Arka is visible in the manager list and has denomination, router and whitelist readbacks.",
  },
  {
    id: "deposit_redeem",
    label: "Deposit and redeem through a live Arka",
    description:
      "Wallet-backed holder balance, shares, NAV and liquid balance prove deposit/redeem state after execution.",
  },
  {
    id: "route_rebalance",
    label: "Route and rebalance against live adapters",
    description:
      "Live rebalance evidence proves protocol selection, router wiring, input/output assets and output delta.",
  },
  {
    id: "coverage_claims",
    label: "Coverage reserve, claims and rewards",
    description:
      "Coverage economics and claims-circuit evidence prove reserve accounting, incident approval and payout state.",
  },
  {
    id: "governance_execution",
    label: "Governance voting, timelock and execution handoff",
    description:
      "Governor, votes, executor, lock and proposal transaction evidence prove governed execution posture.",
  },
  {
    id: "operator_protocols",
    label: "Operator, oracle, routing, protocol and indexer lanes",
    description:
      "Oracle guard, swap guardrails, Blend, Balanced/SODAX posture, tokenomics, off-chain catalog and indexer evidence are present.",
  },
];

function isRecord(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function stringValue(value) {
  return typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : null;
}

function positiveBaseUnits(value) {
  if (typeof value === "number") return Number.isFinite(value) && value > 0;
  const raw = stringValue(value);
  if (!raw) return false;
  try {
    return BigInt(raw) > 0n;
  } catch {
    const parsed = Number(raw);
    return Number.isFinite(parsed) && parsed > 0;
  }
}

function getPath(payload, dottedPath) {
  return dottedPath.split(".").reduce((current, part) => {
    if (!isRecord(current) && !Array.isArray(current)) return undefined;
    const match = part.match(/^([^\[]+)\[(\d+)\]$/);
    if (match) {
      const container = current[match[1]];
      return Array.isArray(container) ? container[Number(match[2])] : undefined;
    }
    return current[part];
  }, payload);
}

function summarize(value) {
  if (Array.isArray(value)) return `${value.length} entries`;
  if (isRecord(value)) return `${Object.keys(value).length} fields`;
  if (typeof value === "string") {
    return value.length > 96 ? `${value.slice(0, 36)}...${value.slice(-16)}` : value;
  }
  if (value === null || value === undefined) return null;
  return String(value);
}

function sha256(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function displayPath(filePath, cwd) {
  const relative = path.relative(cwd, filePath);
  return relative && !relative.startsWith(`..${path.sep}`) && relative !== ".."
    ? relative
    : relative || filePath;
}

function readJsonEvidence(label, filePath) {
  const evidence = {
    label,
    path: filePath,
    found: existsSync(filePath),
    readable: false,
    sha256: null,
    bytes: 0,
    payload: null,
    error: null,
  };

  if (!evidence.found) {
    evidence.error = "missing";
    return evidence;
  }

  try {
    const raw = readFileSync(filePath, "utf8");
    evidence.bytes = Buffer.byteLength(raw);
    evidence.sha256 = sha256(raw);
    evidence.payload = JSON.parse(raw);
    evidence.readable = true;
  } catch (error) {
    evidence.error = error instanceof Error ? error.message : String(error);
  }

  return evidence;
}

function collectStrings(value, prefix = "", out = []) {
  if (typeof value === "string") {
    out.push({ path: prefix, value });
    return out;
  }
  if (Array.isArray(value)) {
    value.forEach((item, index) => collectStrings(item, `${prefix}[${index}]`, out));
    return out;
  }
  if (isRecord(value)) {
    for (const [key, item] of Object.entries(value)) {
      collectStrings(item, prefix ? `${prefix}.${key}` : key, out);
    }
  }
  return out;
}

function uniqueEvidence(items) {
  const seen = new Set();
  return items.filter((item) => {
    const key = `${item.path}:${item.value}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function collectContracts(payload) {
  return uniqueEvidence(
    collectStrings(payload).filter((item) => STELLAR_CONTRACT_RE.test(item.value)),
  );
}

function collectAccounts(payload) {
  return uniqueEvidence(
    collectStrings(payload).filter((item) => STELLAR_ACCOUNT_RE.test(item.value)),
  );
}

function collectTransactionHashes(payload, mode = "named") {
  return uniqueEvidence(
    collectStrings(payload).filter((item) => {
      if (!TX_HASH_RE.test(item.value)) return false;
      if (mode === "all") return true;
      return /(^|\.|\[)(tx|txs|transaction|hash|proposalTxHash|eventHash)/i.test(
        item.path,
      );
    }),
  );
}

function makeStep(id) {
  const definition = REQUIRED_TESTNET_REHEARSAL_STEPS.find((step) => step.id === id);
  if (!definition) throw new Error(`Unknown testnet rehearsal step ${id}`);
  return {
    ...definition,
    status: "ready",
    evidenceFiles: [],
    contracts: [],
    accounts: [],
    transactionHashes: [],
    stateProofs: [],
    blockers: [],
    warnings: [],
  };
}

function addEvidence(step, evidence) {
  step.evidenceFiles.push({
    label: evidence.label,
    path: evidence.path,
    found: evidence.found,
    readable: evidence.readable,
    sha256: evidence.sha256,
    bytes: evidence.bytes,
    error: evidence.error,
  });
  if (!evidence.found) {
    step.blockers.push(`${evidence.label} evidence file is missing: ${evidence.path}`);
    return;
  }
  if (!evidence.readable) {
    step.blockers.push(
      `${evidence.label} evidence file is unreadable: ${evidence.error ?? "unknown error"}`,
    );
  }
}

function addProof(step, label, value, predicate = (candidate) => candidate !== undefined && candidate !== null) {
  const ok = predicate(value);
  if (!ok) {
    step.blockers.push(`${label} proof is missing or invalid.`);
    return;
  }
  step.stateProofs.push({ label, value: summarize(value) });
}

function addExtractedEvidence(step, payload, options = {}) {
  if (!payload) return;
  step.contracts.push(...collectContracts(payload));
  step.accounts.push(...collectAccounts(payload));
  step.transactionHashes.push(
    ...collectTransactionHashes(payload, options.txMode ?? "named"),
  );
}

function finalizeStep(step, options = {}) {
  step.contracts = uniqueEvidence(step.contracts);
  step.accounts = uniqueEvidence(step.accounts);
  step.transactionHashes = uniqueEvidence(step.transactionHashes);

  if ((options.minContracts ?? 0) > step.contracts.length) {
    step.blockers.push(
      `Expected at least ${options.minContracts} contract IDs, found ${step.contracts.length}.`,
    );
  }
  if ((options.minTransactionHashes ?? 0) > step.transactionHashes.length) {
    step.blockers.push(
      `Expected at least ${options.minTransactionHashes} transaction hashes, found ${step.transactionHashes.length}.`,
    );
  }
  if ((options.minStateProofs ?? 0) > step.stateProofs.length) {
    step.blockers.push(
      `Expected at least ${options.minStateProofs} state proofs, found ${step.stateProofs.length}.`,
    );
  }

  if (step.blockers.length > 0) {
    step.status = "blocked";
  }
  return step;
}

function requireContractKeys(step, payload, keys) {
  const contracts = isRecord(payload?.contracts) ? payload.contracts : {};
  for (const key of keys) {
    const value = contracts[key];
    if (!STELLAR_CONTRACT_RE.test(String(value ?? ""))) {
      step.blockers.push(`contracts.${key} is missing or is not a Stellar contract ID.`);
    }
  }
}

function requireNetwork(step, payload, label = "network") {
  const network = stringValue(payload?.network)?.toLowerCase();
  if (network !== "testnet") {
    step.blockers.push(`${label} must be testnet, received ${network ?? "unknown"}.`);
  } else {
    step.stateProofs.push({ label, value: "testnet" });
  }
}

function managerListIncludesNewArka(payload) {
  const newArka = stringValue(payload?.newArka);
  const before = Array.isArray(payload?.managerArkasBefore)
    ? payload.managerArkasBefore
    : [];
  const after = Array.isArray(payload?.managerArkasAfter)
    ? payload.managerArkasAfter
    : [];
  return Boolean(
    newArka &&
      after.includes(newArka) &&
      after.length >= before.length + 1 &&
      !before.includes(newArka),
  );
}

function evaluateDeploymentStep(evidence) {
  const step = makeStep("deployment_manifest");
  const deployment = evidence.deployment;
  const txManifest = evidence.txManifest;
  addEvidence(step, deployment);
  addEvidence(step, txManifest);
  addExtractedEvidence(step, deployment.payload);
  addExtractedEvidence(step, txManifest.payload, { txMode: "all" });

  if (deployment.payload) {
    requireNetwork(step, deployment.payload, "deployments.network");
    requireContractKeys(step, deployment.payload, [
      "arka",
      "arkaFactory",
      "arkaRegistry",
      "router",
      "governor",
      "votes",
      "coverageVault",
      "coverageFund",
      "adapterBlend",
      "oracleGuard",
    ]);
    addProof(
      step,
      "canonical testnet RPC",
      deployment.payload.rpcUrl,
      (value) => stringValue(value)?.includes("testnet"),
    );
    addProof(
      step,
      "validated module declarations",
      getPath(deployment.payload, "validatedModules"),
      (value) => isRecord(value) && Object.keys(value).length > 0,
    );
  }

  if (txManifest.payload) {
    const txs = isRecord(txManifest.payload.txs) ? txManifest.payload.txs : {};
    for (const namespace of [
      "coverageVault",
      "coverageFund",
      "adapterBlend",
      "governedPolicy",
      "managerTier",
      "arkaMigration",
    ]) {
      addProof(
        step,
        `tx namespace ${namespace}`,
        txs[namespace],
        (value) => isRecord(value) && Object.keys(value).length > 0,
      );
    }
  }

  return finalizeStep(step, {
    minContracts: 15,
    minTransactionHashes: 20,
    minStateProofs: 8,
  });
}

function evaluateCreateStep(evidence) {
  const step = makeStep("create_factory");
  addEvidence(step, evidence.create);
  addExtractedEvidence(step, evidence.create.payload);
  const payload = evidence.create.payload;
  if (payload) {
    addProof(step, "factory contract", payload.factory, (value) =>
      STELLAR_CONTRACT_RE.test(String(value ?? "")),
    );
    addProof(step, "new Arka contract", payload.newArka, (value) =>
      STELLAR_CONTRACT_RE.test(String(value ?? "")),
    );
    addProof(step, "router readback", payload.router, (value) =>
      STELLAR_CONTRACT_RE.test(String(value ?? "")),
    );
    addProof(
      step,
      "manager Arka list grew and includes new Arka",
      payload,
      managerListIncludesNewArka,
    );
    addProof(
      step,
      "on-chain denomination matches requested denomination",
      payload,
      (value) =>
        stringValue(value?.denomination) ===
        stringValue(getPath(value, "onchainDenomination.contract")),
    );
    addProof(
      step,
      "on-chain whitelist contains requested assets",
      payload.onchainWhitelist,
      (value) => Array.isArray(value) && value.length > 0,
    );
    if (step.transactionHashes.length === 0) {
      step.warnings.push(
        "Factory create legacy artifact proves state after execution but does not expose a direct Stellar transaction hash.",
      );
    }
  }
  return finalizeStep(step, { minContracts: 4, minStateProofs: 6 });
}

function evaluateDepositRedeemStep(evidence) {
  const step = makeStep("deposit_redeem");
  addEvidence(step, evidence.depositRedeem);
  addExtractedEvidence(step, evidence.depositRedeem.payload);
  const payload = evidence.depositRedeem.payload;
  if (payload) {
    addProof(step, "Arka contract", payload.arka, (value) =>
      STELLAR_CONTRACT_RE.test(String(value ?? "")),
    );
    addProof(step, "deposit token", payload.token, (value) =>
      STELLAR_CONTRACT_RE.test(String(value ?? "")),
    );
    addProof(step, "holder minted balance", payload.holderMintAmount, positiveBaseUnits);
    addProof(
      step,
      "validation deposit amount",
      payload.validationDepositAmount,
      positiveBaseUnits,
    );
    addProof(
      step,
      "validation redeem shares",
      payload.validationRedeemShares,
      positiveBaseUnits,
    );
    addProof(step, "holder balance after", payload.holderBalance, positiveBaseUnits);
    addProof(step, "holder shares after", payload.holderShares, positiveBaseUnits);
    addProof(step, "Arka NAV after", payload.arkaNav, positiveBaseUnits);
    addProof(step, "Arka liquid balance after", payload.arkaLiquidBalance, positiveBaseUnits);
    if (step.transactionHashes.length === 0) {
      step.warnings.push(
        "Deposit/redeem legacy artifact proves post-state balances but does not expose direct transaction hashes.",
      );
    }
  }
  return finalizeStep(step, { minContracts: 2, minStateProofs: 9 });
}

function evaluateRebalanceStep(evidence) {
  const step = makeStep("route_rebalance");
  addEvidence(step, evidence.rebalance);
  addExtractedEvidence(step, evidence.rebalance.payload);
  const payload = evidence.rebalance.payload;
  if (payload) {
    addProof(step, "Arka contract", payload.arka, (value) =>
      STELLAR_CONTRACT_RE.test(String(value ?? "")),
    );
    addProof(step, "selected protocol", payload.protocol, (value) =>
      ["AQUARIUS", "SOROSWAP", "BALANCED", "BLEND"].includes(
        String(value ?? "").toUpperCase(),
      ),
    );
    addProof(step, "router contract", payload.router, (value) =>
      STELLAR_CONTRACT_RE.test(String(value ?? "")),
    );
    addProof(step, "input asset", payload.tokenIn, (value) =>
      STELLAR_CONTRACT_RE.test(String(value ?? "")),
    );
    addProof(step, "output asset", payload.tokenOut, (value) =>
      STELLAR_CONTRACT_RE.test(String(value ?? "")),
    );
    addProof(step, "swap amount", payload.swapAmount, positiveBaseUnits);
    addProof(step, "wallet output delta", payload.walletOutDelta, positiveBaseUnits);
    addProof(step, "after output balance", payload.afterOutputBalance, positiveBaseUnits);
    if (step.transactionHashes.length === 0) {
      step.warnings.push(
        "Rebalance legacy artifact proves output delta and final balance but does not expose a direct transaction hash.",
      );
    }
  }
  return finalizeStep(step, { minContracts: 5, minStateProofs: 8 });
}

function evaluateCoverageStep(evidence) {
  const step = makeStep("coverage_claims");
  addEvidence(step, evidence.coverage);
  addExtractedEvidence(step, evidence.coverage.payload);
  addExtractedEvidence(step, evidence.txManifest.payload, { txMode: "all" });
  const payload = evidence.coverage.payload;
  if (payload) {
    requireNetwork(step, payload.coverageEconomics, "coverageEconomics.network");
    requireNetwork(step, payload.claimsCircuit, "claimsCircuit.network");
    addProof(
      step,
      "coverage premium receipt",
      getPath(payload, "coverageEconomics.results.premiumReceipt"),
      isRecord,
    );
    addProof(
      step,
      "coverage reward claim",
      getPath(payload, "coverageEconomics.results.rewardClaim"),
      isRecord,
    );
    addProof(
      step,
      "fund metrics after premium",
      getPath(payload, "coverageEconomics.results.fundMetricsAfterPremium"),
      isRecord,
    );
    addProof(
      step,
      "rejected claim state",
      getPath(payload, "claimsCircuit.results.rejectedIncident"),
      isRecord,
    );
    addProof(
      step,
      "approved claim plan",
      getPath(payload, "claimsCircuit.results.approvedPlan"),
      isRecord,
    );
    addProof(
      step,
      "executed claim state",
      getPath(payload, "claimsCircuit.results.executedIncident"),
      isRecord,
    );
  }
  return finalizeStep(step, {
    minContracts: 10,
    minTransactionHashes: 8,
    minStateProofs: 8,
  });
}

function evaluateGovernanceStep(evidence) {
  const step = makeStep("governance_execution");
  addEvidence(step, evidence.governance);
  addEvidence(step, evidence.governanceHandoff);
  addExtractedEvidence(step, evidence.governance.payload);
  addExtractedEvidence(step, evidence.governanceHandoff.payload);
  const governance = evidence.governance.payload;
  const handoff = evidence.governanceHandoff.payload;
  if (governance) {
    addProof(step, "governor contract", governance.governor, (value) =>
      STELLAR_CONTRACT_RE.test(String(value ?? "")),
    );
    addProof(step, "votes contract", governance.votes, (value) =>
      STELLAR_CONTRACT_RE.test(String(value ?? "")),
    );
    addProof(step, "proposal threshold", governance.proposalThreshold, (value) =>
      Number(value) >= 0,
    );
    addProof(step, "vote period", governance.votePeriod, positiveBaseUnits);
    addProof(step, "timelock", governance.timelock, (value) => Number(value) >= 0);
    addProof(step, "quorum bps", governance.quorumBps, positiveBaseUnits);
  }
  if (handoff) {
    requireNetwork(step, handoff, "governance handoff network");
    addProof(step, "proposal transaction hash", getPath(handoff, "proposal.proposalTxHash"), (value) =>
      TX_HASH_RE.test(String(value ?? "")),
    );
    addProof(step, "current votes after handoff", getPath(handoff, "results.currentVotes"), positiveBaseUnits);
    addProof(step, "locked balance after handoff", getPath(handoff, "results.lockedBalance"), positiveBaseUnits);
  }
  return finalizeStep(step, {
    minContracts: 6,
    minTransactionHashes: 1,
    minStateProofs: 9,
  });
}

function evaluateOperatorProtocolsStep(evidence) {
  const step = makeStep("operator_protocols");
  for (const key of [
    "oracleGuard",
    "swapGuardrails",
    "balancedReadiness",
    "blend",
    "indexer",
    "tokenomics",
    "offchainStack",
  ]) {
    addEvidence(step, evidence[key]);
    addExtractedEvidence(step, evidence[key].payload);
  }

  const oracle = evidence.oracleGuard.payload;
  const guardrails = evidence.swapGuardrails.payload;
  const balanced = evidence.balancedReadiness.payload;
  const blend = evidence.blend.payload;
  const indexer = evidence.indexer.payload;
  const tokenomics = evidence.tokenomics.payload;
  const offchain = evidence.offchainStack.payload;

  if (oracle) {
    requireNetwork(step, oracle, "oracle guard network");
    addProof(step, "oracle guard secondary selection", getPath(oracle, "results.secondarySelection"), isRecord);
    addProof(step, "oracle guard stale fallback", getPath(oracle, "results.staleFallback"), isRecord);
    addProof(step, "oracle guard fail-closed", getPath(oracle, "results.failClosed"), isRecord);
  }
  if (guardrails) {
    requireNetwork(step, guardrails, "swap guardrails network");
    addProof(step, "successful guarded rebalance", getPath(guardrails, "results.successfulRebalanceOut"), positiveBaseUnits);
    addProof(step, "blocked disallowed adapter", getPath(guardrails, "results.blockedDisallowedAdapter"), (value) => value === true);
    addProof(step, "blocked price impact", getPath(guardrails, "results.blockedPriceImpact"), (value) => value === true);
  }
  if (balanced) {
    requireNetwork(step, balanced, "Balanced readiness network");
    addProof(step, "Balanced support state declared", balanced.supportStatus, stringValue);
    addProof(step, "Balanced lane mode declared", balanced.laneMode, stringValue);
    if (balanced.readyForDappExecution === false) {
      step.warnings.push(
        "Balanced/SODAX testnet lane is honestly recorded as blocked because no official public Stellar testnet quote/status/confirm surface is available.",
      );
    }
  }
  if (blend) {
    addProof(step, "Blend Arka", blend.arka, (value) =>
      STELLAR_CONTRACT_RE.test(String(value ?? "")),
    );
    addProof(step, "Blend pool", blend.blendPool, (value) =>
      STELLAR_CONTRACT_RE.test(String(value ?? "")),
    );
    addProof(step, "Blend action amount", blend.actionAmount, positiveBaseUnits);
    addProof(step, "Blend minimum health factor", blend.blendMinHealthFactor, positiveBaseUnits);
  }
  if (indexer) {
    addProof(step, "indexer start ledger", indexer.startLedger, positiveBaseUnits);
    addProof(step, "indexer end ledger", indexer.endLedger, positiveBaseUnits);
    addProof(step, "registry events", indexer.registryEvents, (value) => Array.isArray(value) && value.length >= 4);
    addProof(step, "Arka events", indexer.arkaEvents, (value) => Array.isArray(value) && value.length >= 4);
  }
  if (tokenomics) {
    requireNetwork(step, tokenomics, "tokenomics network");
    addProof(step, "tokenomics grant", getPath(tokenomics, "results.grant"), isRecord);
    addProof(step, "tokenomics stream", getPath(tokenomics, "results.stream"), isRecord);
    addProof(step, "team votes final", getPath(tokenomics, "results.teamVotesFinal"), positiveBaseUnits);
  }
  if (offchain) {
    requireNetwork(step, offchain, "off-chain stack network");
    addProof(step, "catalog bootstrap health", offchain.catalogBootstrapHealth, (value) =>
      isRecord(value) || stringValue(value),
    );
    addProof(step, "dApp catalog health", getPath(offchain, "dappHealth.catalog.statusCode"), (value) => Number(value) === 200);
  }

  return finalizeStep(step, {
    minContracts: 18,
    minTransactionHashes: 8,
    minStateProofs: 24,
  });
}

function resolveInput(input = {}) {
  const env = input.env ?? process.env;
  const cwd = input.cwd ?? process.cwd();
  const evidenceRoot =
    input.evidenceRoot ??
    env.ARKAFUND_TESTNET_REHEARSAL_EVIDENCE_ROOT ??
    path.resolve(cwd, "../arkafund/tmp");
  return {
    cwd,
    env,
    reportPath: path.resolve(
      cwd,
      input.reportPath ??
        env.ARKAFUND_TESTNET_REHEARSAL_REPORT_PATH ??
        DEFAULT_TESTNET_DRESS_REHEARSAL_REPORT_PATH,
    ),
    evidenceRoot: path.resolve(cwd, evidenceRoot),
    deploymentsPath: path.resolve(
      cwd,
      input.deploymentsPath ??
        env.ARKAFUND_TESTNET_DEPLOYMENTS_PATH ??
        "config/deployments.testnet.json",
    ),
    txManifestPath: path.resolve(
      cwd,
      input.txManifestPath ??
        env.ARKAFUND_TESTNET_TX_MANIFEST_PATH ??
        "../arkafund/deployments.testnet.json",
    ),
    maxReportAgeDays: Number(
      input.maxReportAgeDays ??
        env.ARKAFUND_TESTNET_REHEARSAL_MAX_REPORT_AGE_DAYS ??
        DEFAULT_MAX_REPORT_AGE_DAYS,
    ),
    nowMs:
      typeof input.nowMs === "number"
        ? input.nowMs
        : Date.parse(env.ARKAFUND_TESTNET_REHEARSAL_NOW ?? "") || Date.now(),
  };
}

function buildEvidence(input) {
  const resolve = (name) => path.join(input.evidenceRoot, name);
  return {
    deployment: readJsonEvidence("dApp testnet deployments", input.deploymentsPath),
    txManifest: readJsonEvidence("contracts testnet transaction manifest", input.txManifestPath),
    create: readJsonEvidence("create live validation", resolve("create-live-validation.json")),
    depositRedeem: readJsonEvidence("deposit/redeem live validation", resolve("deposit-redeem-live-validation.json")),
    rebalance: readJsonEvidence("rebalance live validation", resolve("rebalance-live-validation.json")),
    coverage: readJsonEvidence("coverage claims live validation", resolve("coverage-claims-live-validation.json")),
    governance: readJsonEvidence("governance live validation", resolve("governance-live-validation.json")),
    governanceHandoff: readJsonEvidence("governance handoff live validation", resolve("governance-handoff-live-validation.json")),
    oracleGuard: readJsonEvidence("oracle guard live validation", resolve("oracle-guard-live-validation.json")),
    swapGuardrails: readJsonEvidence("swap guardrails live validation", resolve("swap-guardrails-live-validation.json")),
    balancedReadiness: readJsonEvidence("Balanced/SODAX readiness validation", resolve("balanced-readiness-validation.json")),
    blend: readJsonEvidence("Blend live validation", resolve("blend-live-validation.json")),
    indexer: readJsonEvidence("indexer event surface validation", resolve("indexer-event-surface-live-validation.json")),
    tokenomics: readJsonEvidence("tokenomics live validation", resolve("tokenomics-live-validation.json")),
    offchainStack: readJsonEvidence("off-chain testnet stack validation", resolve("offchain-testnet-stack.json")),
  };
}

function buildSummary(steps, input) {
  const blockers = steps.flatMap((step) =>
    step.blockers.map((blocker) => `${step.id}: ${blocker}`),
  );
  const warnings = steps.flatMap((step) =>
    step.warnings.map((warning) => `${step.id}: ${warning}`),
  );
  const transactionHashes = uniqueEvidence(
    steps.flatMap((step) => step.transactionHashes),
  );
  const contracts = uniqueEvidence(steps.flatMap((step) => step.contracts));
  const stateProofCount = steps.reduce(
    (total, step) => total + step.stateProofs.length,
    0,
  );
  const sourceFileCount = steps.reduce(
    (total, step) => total + step.evidenceFiles.filter((file) => file.found).length,
    0,
  );
  const readableSourceFileCount = steps.reduce(
    (total, step) => total + step.evidenceFiles.filter((file) => file.readable).length,
    0,
  );
  const readyStepCount = steps.filter((step) => step.status === "ready").length;

  return {
    requiredStepCount: REQUIRED_TESTNET_REHEARSAL_STEPS.length,
    readyStepCount,
    blockedStepCount: steps.length - readyStepCount,
    sourceFileCount,
    readableSourceFileCount,
    contractIdCount: contracts.length,
    transactionHashCount: transactionHashes.length,
    stateProofCount,
    blockerCount: blockers.length,
    warningCount: warnings.length,
    maxReportAgeDays: input.maxReportAgeDays,
  };
}

export function buildTestnetDressRehearsalReport(input = {}) {
  const resolved = resolveInput(input);
  const evidence = buildEvidence(resolved);
  const steps = [
    evaluateDeploymentStep(evidence),
    evaluateCreateStep(evidence),
    evaluateDepositRedeemStep(evidence),
    evaluateRebalanceStep(evidence),
    evaluateCoverageStep(evidence),
    evaluateGovernanceStep(evidence),
    evaluateOperatorProtocolsStep(evidence),
  ];
  const summary = buildSummary(steps, resolved);
  const blockers = steps.flatMap((step) =>
    step.blockers.map((blocker) => `${step.id}: ${blocker}`),
  );
  const warnings = steps.flatMap((step) =>
    step.warnings.map((warning) => `${step.id}: ${warning}`),
  );

  return {
    artifact: "arkafund-testnet-dress-rehearsal",
    version: TESTNET_DRESS_REHEARSAL_REPORT_VERSION,
    generatedAt: new Date(resolved.nowMs).toISOString(),
    network: "testnet",
    status: blockers.length === 0 ? "ready" : "blocked",
    paths: {
      reportPath: displayPath(resolved.reportPath, resolved.cwd),
      evidenceRoot: displayPath(resolved.evidenceRoot, resolved.cwd),
      deploymentsPath: displayPath(resolved.deploymentsPath, resolved.cwd),
      txManifestPath: displayPath(resolved.txManifestPath, resolved.cwd),
    },
    summary,
    blockers,
    warnings,
    steps: steps.map((step) => ({
      id: step.id,
      label: step.label,
      description: step.description,
      status: step.status,
      evidenceFiles: step.evidenceFiles.map((file) => ({
        ...file,
        path: displayPath(file.path, resolved.cwd),
      })),
      contractCount: step.contracts.length,
      accountCount: step.accounts.length,
      transactionHashCount: step.transactionHashes.length,
      stateProofCount: step.stateProofs.length,
      transactionHashes: step.transactionHashes.map((item) => ({
        path: item.path,
        value: item.value,
      })),
      stateProofs: step.stateProofs,
      blockers: step.blockers,
      warnings: step.warnings,
    })),
  };
}

function reportAgeDays(report, nowMs) {
  const generatedAt = Date.parse(report?.generatedAt ?? "");
  if (!Number.isFinite(generatedAt)) return null;
  return Math.max(0, (nowMs - generatedAt) / (24 * 60 * 60 * 1000));
}

export function deriveTestnetDressRehearsalGateFromReport(
  report,
  input = {},
) {
  const resolved = resolveInput(input);
  const ageDays = reportAgeDays(report, resolved.nowMs);
  const stepCountOk =
    Number(report?.summary?.requiredStepCount) ===
      REQUIRED_TESTNET_REHEARSAL_STEPS.length &&
    Number(report?.summary?.readyStepCount) ===
      REQUIRED_TESTNET_REHEARSAL_STEPS.length;
  const networkOk = report?.network === "testnet";
  const versionOk = report?.version === TESTNET_DRESS_REHEARSAL_REPORT_VERSION;
  const reportReady = report?.status === "ready";
  const ageOk = ageDays !== null && ageDays <= resolved.maxReportAgeDays;
  const blockerCount = Number(report?.summary?.blockerCount ?? 0);
  const txHashCount = Number(report?.summary?.transactionHashCount ?? 0);
  const stateProofCount = Number(report?.summary?.stateProofCount ?? 0);

  const blockers = [];
  if (!versionOk) blockers.push("Testnet rehearsal report version is unsupported.");
  if (!networkOk) blockers.push("Testnet rehearsal report does not target testnet.");
  if (!reportReady) blockers.push("Testnet rehearsal report is not ready.");
  if (!stepCountOk) blockers.push("Not all required testnet rehearsal steps are ready.");
  if (blockerCount > 0) blockers.push("Testnet rehearsal report contains blockers.");
  if (txHashCount < 30) {
    blockers.push(`Expected at least 30 transaction hashes in rehearsal evidence, found ${txHashCount}.`);
  }
  if (stateProofCount < 70) {
    blockers.push(`Expected at least 70 state proofs in rehearsal evidence, found ${stateProofCount}.`);
  }
  if (!ageOk) {
    blockers.push(
      ageDays === null
        ? "Testnet rehearsal report generatedAt is missing or invalid."
        : `Testnet rehearsal report is stale: ${ageDays.toFixed(1)} days old.`,
    );
  }

  const ready = blockers.length === 0;
  const code = ready
    ? "ready"
    : !versionOk
      ? "report_invalid"
      : !networkOk
        ? "network_mismatch"
        : !ageOk
          ? "report_stale"
          : !stepCountOk
            ? "step_incomplete"
            : "evidence_blocked";

  return {
    ready,
    status: ready ? "ready" : "blocked",
    code,
    target: "testnet_dress_rehearsal",
    detail: ready
      ? "Production-like testnet dress rehearsal evidence is complete, fresh and release-grade."
      : blockers.join(" "),
    reportPath: resolved.reportPath,
    generatedAt: report?.generatedAt ?? null,
    ageDays,
    checks: {
      versionOk,
      networkOk,
      reportReady,
      stepCountOk,
      ageOk,
      requiredStepCount: Number(report?.summary?.requiredStepCount ?? 0),
      readyStepCount: Number(report?.summary?.readyStepCount ?? 0),
      sourceFileCount: Number(report?.summary?.sourceFileCount ?? 0),
      readableSourceFileCount: Number(report?.summary?.readableSourceFileCount ?? 0),
      contractIdCount: Number(report?.summary?.contractIdCount ?? 0),
      transactionHashCount: txHashCount,
      stateProofCount,
      blockerCount,
      warningCount: Number(report?.summary?.warningCount ?? 0),
      maxReportAgeDays: resolved.maxReportAgeDays,
    },
    evidence: {
      reportVersion: report?.version ?? null,
      reportStatus: report?.status ?? "unknown",
      evidenceRoot: report?.paths?.evidenceRoot ?? null,
      deploymentsPath: report?.paths?.deploymentsPath ?? null,
      txManifestPath: report?.paths?.txManifestPath ?? null,
      warnings: Array.isArray(report?.warnings) ? report.warnings : [],
      stepStatuses: Array.isArray(report?.steps)
        ? report.steps.map((step) => ({
            id: step.id,
            status: step.status,
            transactionHashCount: step.transactionHashCount,
            stateProofCount: step.stateProofCount,
          }))
        : [],
    },
    blockers,
  };
}

export function readTestnetDressRehearsalReport(input = {}) {
  const resolved = resolveInput(input);
  if (input.forceLive) {
    return buildTestnetDressRehearsalReport(input);
  }
  if (!existsSync(resolved.reportPath)) {
    return buildTestnetDressRehearsalReport(input);
  }
  try {
    return JSON.parse(readFileSync(resolved.reportPath, "utf8"));
  } catch (error) {
    return {
      artifact: "arkafund-testnet-dress-rehearsal",
      version: TESTNET_DRESS_REHEARSAL_REPORT_VERSION,
      generatedAt: new Date(resolved.nowMs).toISOString(),
      network: "unknown",
      status: "blocked",
      paths: {
        reportPath: resolved.reportPath,
        evidenceRoot: resolved.evidenceRoot,
        deploymentsPath: resolved.deploymentsPath,
        txManifestPath: resolved.txManifestPath,
      },
      summary: {
        requiredStepCount: REQUIRED_TESTNET_REHEARSAL_STEPS.length,
        readyStepCount: 0,
        blockedStepCount: REQUIRED_TESTNET_REHEARSAL_STEPS.length,
        sourceFileCount: 0,
        readableSourceFileCount: 0,
        contractIdCount: 0,
        transactionHashCount: 0,
        stateProofCount: 0,
        blockerCount: 1,
        warningCount: 0,
        maxReportAgeDays: resolved.maxReportAgeDays,
      },
      blockers: [
        `Testnet rehearsal report is unreadable: ${
          error instanceof Error ? error.message : String(error)
        }`,
      ],
      warnings: [],
      steps: [],
    };
  }
}

export function readTestnetDressRehearsalGate(input = {}) {
  const report = readTestnetDressRehearsalReport(input);
  return deriveTestnetDressRehearsalGateFromReport(report, input);
}

export function writeTestnetDressRehearsalReport(outputPath, input = {}) {
  const report = buildTestnetDressRehearsalReport({
    ...input,
    reportPath: outputPath,
  });
  mkdirSync(path.dirname(outputPath), { recursive: true });
  writeFileSync(outputPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  return report;
}
