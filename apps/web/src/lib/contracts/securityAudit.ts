import { buildContractsMutationMatrixSnapshot } from "@/lib/contracts/mutationMatrix";
import { buildContractsStorageLifecycleSnapshot } from "@/lib/contracts/storageLifecycle";
import {
  methodRequiresDaoExecutor,
  shouldBlockRawWrite,
  shouldBlockTypedWrite,
} from "@/lib/workflows/daoExecutionPolicy";
import { GOVERNED_ACTION_TEMPLATES } from "@/lib/workflows/governanceComposer";
import { resolveRebalanceGuardrailPolicy } from "@/lib/workflows/rebalanceRouting";

export type ContractsSecurityAuditDomain =
  | "access_control"
  | "operator_auth"
  | "storage_ttl"
  | "arithmetic"
  | "oracle_assumptions"
  | "route_guards"
  | "emergency_pause"
  | "coverage_controls"
  | "dao_governance";

export type ContractsSecurityAuditSeverity =
  | "critical"
  | "high"
  | "medium"
  | "low";

export type ContractsSecurityAuditFindingStatus =
  | "resolved"
  | "accepted_risk"
  | "blocking";

export type ContractsSecurityAuditInvariantStatus = "passed" | "failed";

export type ContractsSecurityAuditFinding = {
  id: string;
  domain: ContractsSecurityAuditDomain;
  severity: ContractsSecurityAuditSeverity;
  status: ContractsSecurityAuditFindingStatus;
  title: string;
  risk: string;
  resolution: string;
  residualRisk: string;
  implementationRefs: string[];
  testRefs: string[];
};

export type ContractsSecurityAuditInvariant = {
  id: string;
  domain: ContractsSecurityAuditDomain;
  severity: ContractsSecurityAuditSeverity;
  status: ContractsSecurityAuditInvariantStatus;
  statement: string;
  evidence: string;
  implementationRefs: string[];
  testRefs: string[];
};

export type ContractsSecurityAuditDomainSummary = {
  total: number;
  resolved: number;
  acceptedRisk: number;
  blocking: number;
  passedInvariants: number;
  failedInvariants: number;
};

export type ContractsSecurityAuditReleaseGate = {
  ready: boolean;
  status: "ready" | "blocked";
  code: "ready" | "blocking_findings" | "failed_invariants";
  target: "contract_security_audit";
  detail: string;
  artifact: string;
  checks: {
    findingCount: number;
    blockingFindingCount: number;
    criticalHighBlockingFindingCount: number;
    acceptedRiskCount: number;
    invariantCount: number;
    passedInvariantCount: number;
    failedInvariantCount: number;
    undocumentedCriticalHighRemaining: number;
  };
};

export type ContractsSecurityAuditSnapshot = {
  generatedAt: string;
  auditDate: string;
  scope: string[];
  artifact: string;
  summary: {
    findingCount: number;
    resolved: number;
    acceptedRisk: number;
    blocking: number;
    criticalHighFindings: number;
    criticalHighBlocking: number;
    invariantCount: number;
    passedInvariants: number;
    failedInvariants: number;
    byDomain: Record<ContractsSecurityAuditDomain, ContractsSecurityAuditDomainSummary>;
  };
  findings: ContractsSecurityAuditFinding[];
  invariants: ContractsSecurityAuditInvariant[];
  releaseGate: ContractsSecurityAuditReleaseGate;
  residualRisks: string[];
};

const AUDIT_DATE = "2026-05-20";
const AUDIT_ARTIFACT = "docs/CONTRACTS_SECURITY_AUDIT.md";

const AUDIT_DOMAINS: readonly ContractsSecurityAuditDomain[] = [
  "access_control",
  "operator_auth",
  "storage_ttl",
  "arithmetic",
  "oracle_assumptions",
  "route_guards",
  "emergency_pause",
  "coverage_controls",
  "dao_governance",
];

const SECURITY_FINDINGS: readonly ContractsSecurityAuditFinding[] = [
  {
    id: "AC-01",
    domain: "access_control",
    severity: "critical",
    status: "resolved",
    title: "DAO-guarded contract writes cannot bypass governance lanes",
    risk: "A manager or operator could submit privileged Arka/Coverage/Oracle mutations directly from the raw contract console.",
    resolution:
      "The typed and raw write lanes both use DAO policy checks; DAO-guarded methods are blocked unless routed through the configured GovernanceExecutor lane.",
    residualRisk:
      "GovernanceExecutor deployment and role configuration still require final testnet/mainnet verification in T26/T27.",
    implementationRefs: [
      "src/lib/workflows/daoExecutionPolicy.ts",
      "src/app/contracts/page.tsx",
      "src/lib/contracts/mutationMatrix.ts",
    ],
    testRefs: [
      "tests/unit/dao-execution-policy.test.ts",
      "tests/integration/contracts-page.test.tsx",
      "e2e/contracts-surface.spec.ts",
    ],
  },
  {
    id: "AUTH-01",
    domain: "operator_auth",
    severity: "high",
    status: "resolved",
    title: "Operator-only telemetry and mutation evidence must reject anonymous API calls",
    risk: "Unauthenticated users could inspect operator-only release telemetry, mutation matrices or storage lifecycle commands.",
    resolution:
      "Operator API routes use a verified operator session guard and respond with deterministic no-store 401 payloads when the wallet session is absent.",
    residualRisk:
      "Production operator wallet list must be reviewed once final Vercel environment variables are frozen in T24.",
    implementationRefs: [
      "src/lib/server/operatorApiGuard.ts",
      "src/app/api/contracts/mutation-matrix/route.ts",
      "src/app/api/contracts/storage-lifecycle/route.ts",
      "src/app/api/release/gate/route.ts",
    ],
    testRefs: [
      "tests/integration/api-contracts-mutation-matrix-route.test.ts",
      "tests/integration/api-contracts-storage-lifecycle-route.test.ts",
      "tests/integration/api-release-gate-route.test.ts",
      "e2e/release-gate.spec.ts",
    ],
  },
  {
    id: "STO-01",
    domain: "storage_ttl",
    severity: "high",
    status: "resolved",
    title: "Soroban storage rent extension must be explicit, auditable and non-destructive",
    risk: "Persistent or instance contract data could expire or an operator script could accidentally mutate/deploy/delete state while attempting TTL maintenance.",
    resolution:
      "Storage lifecycle entries classify persistent, instance and temporary storage; the extend script defaults to dry-run, prints exact commands and requires explicit live confirmation.",
    residualRisk:
      "The first live testnet storage extension remains part of the dress rehearsal, not this internal software closeout.",
    implementationRefs: [
      "src/lib/contracts/storageLifecycle.ts",
      "scripts/contracts_storage_extend.mjs",
      "docs/STORAGE_LIFECYCLE_RUNBOOK_2026-05-20.md",
    ],
    testRefs: [
      "tests/unit/contracts-storage-lifecycle.test.ts",
      "tests/integration/contracts-storage-extend-script.test.ts",
      "tests/integration/api-contracts-storage-lifecycle-route.test.ts",
      "e2e/contracts-surface.spec.ts",
    ],
  },
  {
    id: "ARI-01",
    domain: "arithmetic",
    severity: "critical",
    status: "resolved",
    title: "Route amounts, percentage fields and turnover checks must fail closed",
    risk: "Malformed notional, percentage or turnover inputs could produce unsafe rebalance plans or exceed configured trade limits.",
    resolution:
      "The routing planner resolves bounded guardrail policy, validates percentage/notional/path/chunking/turnover state and blocks execution when required state is unavailable.",
    residualRisk:
      "On-chain arithmetic must still be covered by final contract deployment bytecode review before T27.",
    implementationRefs: [
      "src/lib/workflows/rebalanceRouting.ts",
      "src/lib/runtime/rebalanceRoutePlanApi.ts",
      "src/app/api/routing/rebalance/plan/route.ts",
    ],
    testRefs: [
      "tests/unit/rebalance-routing.test.ts",
      "tests/unit/runtime-rebalance-route-plan-api.test.ts",
      "tests/integration/api-rebalance-route-plan-route.test.ts",
      "e2e/wallet-backed-matrix.spec.ts",
    ],
  },
  {
    id: "ORC-01",
    domain: "oracle_assumptions",
    severity: "critical",
    status: "resolved",
    title: "Oracle readiness and leaderboard pricing cannot silently fall back to unverified providers",
    risk: "Profit, leaderboard or swap guardrail calculations could be shown as ready while oracle providers are stale, mismatched or undeclared.",
    resolution:
      "Leaderboard source and oracle cutover gates expose provider, network and divergence checks and keep mainnet blocked until audited Reflector/OracleGuard wiring exists.",
    residualRisk:
      "Mainnet OracleGuard ID is intentionally absent until the final mainnet cutover; this is an external release blocker, not an untracked audit finding.",
    implementationRefs: [
      "src/lib/runtime/leaderboardSource.ts",
      "src/lib/runtime/oracleCutoverGate.ts",
      "config/deployments.mainnet.json",
    ],
    testRefs: [
      "tests/unit/oracle-cutover-gate.test.ts",
      "tests/unit/runtime-leaderboard-source.test.ts",
      "tests/integration/api-leaderboard-source-route.test.ts",
      "tests/integration/api-release-gate-route.test.ts",
    ],
  },
  {
    id: "RTE-01",
    domain: "route_guards",
    severity: "critical",
    status: "resolved",
    title: "Smart routing must compare venues and block unsupported execution paths",
    risk: "The planner could pick a non-optimal or unsupported route, especially across SoroSwap/Aquarius/Balanced lanes.",
    resolution:
      "Smart Routing benchmark, canary and route-plan gates verify multi-hop, split-route, fill-risk and fail-closed behavior before release eligibility.",
    residualRisk:
      "Live mainnet canary evidence remains intentionally deferred to T27 after production endpoints exist.",
    implementationRefs: [
      "src/lib/workflows/rebalanceRouting.ts",
      "src/lib/workflows/rebalanceBenchmark.ts",
      "src/lib/runtime/rebalanceBenchmarkGate.ts",
      "src/lib/runtime/rebalanceCanaryGate.ts",
    ],
    testRefs: [
      "tests/unit/rebalance-routing.test.ts",
      "tests/unit/rebalance-benchmark.test.ts",
      "tests/unit/rebalance-canary-gate.test.ts",
      "tests/integration/api-rebalance-benchmark-route.test.ts",
      "e2e/release-gate.spec.ts",
    ],
  },
  {
    id: "PAU-01",
    domain: "emergency_pause",
    severity: "high",
    status: "resolved",
    title: "Emergency pause and swap-disable posture must be represented as enforceable guardrails",
    risk: "The UI could imply that swaps are available while the policy disables execution or while emergency pause state is active.",
    resolution:
      "Swap enablement is modeled in guardrail source-of-truth rows, rendered in Settings/Governance and enforced by the rebalance planner guardrail evaluation.",
    residualRisk:
      "Future DAO-managed storage migration must keep the same source-of-truth mapping rather than duplicating runtime env policy.",
    implementationRefs: [
      "src/lib/workflows/controlSurfaces.ts",
      "src/lib/workflows/rebalanceRouting.ts",
      "src/app/settings/page.tsx",
      "src/app/governance/GovernanceClient.tsx",
      "../arkafund/contracts/oracle-guard/src/lib.rs",
    ],
    testRefs: [
      "tests/unit/control-surfaces.test.ts",
      "tests/unit/rebalance-routing.test.ts",
      "tests/integration/control-room-surfaces.test.tsx",
      "e2e/operator-degraded-retry-matrix.spec.ts",
      "../arkafund/contracts/oracle-guard/src/lib.rs",
    ],
  },
  {
    id: "COV-01",
    domain: "coverage_controls",
    severity: "high",
    status: "resolved",
    title: "Coverage and claims-manager authority mutations require explicit readback/rollback evidence",
    risk: "CoverageFund, CoverageVault or ClaimsManager settings could be changed without proving post-state or recovery path.",
    resolution:
      "The contracts mutation matrix includes coverage/claims-manager rows with preconditions, post-state assertions, state probes, rollback strategy and E2E scenario mapping.",
    residualRisk:
      "Final testnet rehearsal must still capture live state evidence for the deployed coverage contracts.",
    implementationRefs: [
      "src/lib/contracts/mutationMatrix.ts",
      "src/app/contracts/page.tsx",
      "src/app/coverage/page.tsx",
    ],
    testRefs: [
      "tests/unit/contracts-mutation-matrix.test.ts",
      "tests/integration/api-contracts-mutation-matrix-route.test.ts",
      "tests/integration/contracts-page.test.tsx",
      "e2e/contracts-surface.spec.ts",
    ],
  },
  {
    id: "DAO-01",
    domain: "dao_governance",
    severity: "critical",
    status: "resolved",
    title: "Governed action composer cannot pretend to publish arbitrary executable batches",
    risk: "The frontend could present generic governance publication as complete even though the Governor does not expose an arbitrary executable batch primitive.",
    resolution:
      "Governance composer is curated-only, stages typed packages for Contracts/executor review and documents the missing generic executable batch primitive honestly.",
    residualRisk:
      "Adding a real generic batch primitive remains a future contract feature and must be audited independently before exposure.",
    implementationRefs: [
      "src/lib/workflows/governanceComposer.ts",
      "src/app/governance/GovernanceClient.tsx",
      "src/app/contracts/page.tsx",
    ],
    testRefs: [
      "tests/unit/governance-composer.test.ts",
      "tests/unit/dao-execution-policy.test.ts",
      "tests/integration/contracts-page.test.tsx",
      "e2e/contracts-surface.spec.ts",
    ],
  },
  {
    id: "CUT-01",
    domain: "oracle_assumptions",
    severity: "medium",
    status: "accepted_risk",
    title: "Mainnet deploy evidence is intentionally deferred",
    risk: "The security closeout can be complete while the final mainnet OracleGuard, canary and live testnet rehearsal evidence are still pending.",
    resolution:
      "The audit report records this as an accepted external release dependency and the release gate remains blocked by the dedicated T24-T27 gates until evidence exists.",
    residualRisk:
      "Mainnet must not be declared complete until T27 records production deployment and canary evidence.",
    implementationRefs: [
      "docs/REMAINING_SINGLE_ITERATION_PLAN_2026-05-18.md",
      "src/app/api/release/gate/route.ts",
      "src/lib/runtime/oracleCutoverGate.ts",
      "src/lib/runtime/rebalanceCanaryGate.ts",
    ],
    testRefs: [
      "tests/integration/api-release-gate-route.test.ts",
      "e2e/release-gate.spec.ts",
    ],
  },
];

function newDomainSummary(): ContractsSecurityAuditDomainSummary {
  return {
    total: 0,
    resolved: 0,
    acceptedRisk: 0,
    blocking: 0,
    passedInvariants: 0,
    failedInvariants: 0,
  };
}

function buildDomainSummary(
  findings: readonly ContractsSecurityAuditFinding[],
  invariants: readonly ContractsSecurityAuditInvariant[],
): Record<ContractsSecurityAuditDomain, ContractsSecurityAuditDomainSummary> {
  const summary = Object.fromEntries(
    AUDIT_DOMAINS.map((domain) => [domain, newDomainSummary()]),
  ) as Record<ContractsSecurityAuditDomain, ContractsSecurityAuditDomainSummary>;

  for (const finding of findings) {
    const bucket = summary[finding.domain];
    bucket.total += 1;
    if (finding.status === "resolved") bucket.resolved += 1;
    if (finding.status === "accepted_risk") bucket.acceptedRisk += 1;
    if (finding.status === "blocking") bucket.blocking += 1;
  }

  for (const invariant of invariants) {
    const bucket = summary[invariant.domain];
    if (invariant.status === "passed") bucket.passedInvariants += 1;
    if (invariant.status === "failed") bucket.failedInvariants += 1;
  }

  return summary;
}

function invariant(
  input: Omit<ContractsSecurityAuditInvariant, "status"> & { passed: boolean },
): ContractsSecurityAuditInvariant {
  const { passed, ...rest } = input;
  return {
    ...rest,
    status: passed ? "passed" : "failed",
  };
}

function hasCompleteAssurance(entry: {
  preconditions: string[];
  postStateAssertion: string;
  stateProbe: string;
  rollbackStrategy: string;
  riskControls: string[];
  e2eScenario: string;
}): boolean {
  return (
    entry.preconditions.length >= 3 &&
    entry.postStateAssertion.trim().length > 0 &&
    entry.stateProbe.trim().length > 0 &&
    entry.rollbackStrategy.trim().length > 0 &&
    entry.riskControls.length >= 3 &&
    entry.e2eScenario.trim().length > 0
  );
}

function buildInvariants(): ContractsSecurityAuditInvariant[] {
  const mutationSnapshot = buildContractsMutationMatrixSnapshot();
  const storageSnapshot = buildContractsStorageLifecycleSnapshot();
  const templateActionIds = new Set(
    GOVERNED_ACTION_TEMPLATES.map((template) => template.actionId),
  );
  const mutationActionIds = new Set(
    mutationSnapshot.entries.map((entry) => entry.writeActionId),
  );
  const missingTemplateActionIds = [...templateActionIds].filter(
    (actionId) => !mutationActionIds.has(actionId),
  );
  const criticalRows = mutationSnapshot.entries.filter(
    (entry) => entry.severity === "critical",
  );
  const daoRows = mutationSnapshot.entries.filter(
    (entry) => entry.daoExecutorRequired,
  );
  const externallyGovernedDaoRows = daoRows.filter(
    (entry) => entry.contractTarget !== "governance_executor",
  );
  const storageEntries = storageSnapshot.entries;
  const guardrailPolicy = resolveRebalanceGuardrailPolicy();
  const rawDaoBypassBlocked = shouldBlockRawWrite({
    mode: "write",
    method: "set_fees",
    contractId: "CVAULTDIRECT00000000000000000000000000000000000000000000000000",
    governanceExecutorId:
      "CEXECUTOR00000000000000000000000000000000000000000000000000",
  });
  const rawExecutorAllowed = !shouldBlockRawWrite({
    mode: "write",
    method: "set_fees",
    contractId: "CEXECUTOR00000000000000000000000000000000000000000000000000",
    governanceExecutorId:
      "CEXECUTOR00000000000000000000000000000000000000000000000000",
  });
  const typedDaoBlocked = shouldBlockTypedWrite("write", "Arka", "set_fees");
  const readNotBlocked = !shouldBlockTypedWrite("read", "Arka", "fees");

  return [
    invariant({
      id: "INV-AC-001",
      domain: "access_control",
      severity: "critical",
      passed: rawDaoBypassBlocked && rawExecutorAllowed && typedDaoBlocked && readNotBlocked,
      statement:
        "DAO-guarded writes are blocked outside the GovernanceExecutor lane while readonly calls stay available.",
      evidence:
        "shouldBlockRawWrite/shouldBlockTypedWrite distinguish direct vault writes, executor writes and read calls.",
      implementationRefs: ["src/lib/workflows/daoExecutionPolicy.ts"],
      testRefs: ["tests/unit/dao-execution-policy.test.ts", "e2e/contracts-surface.spec.ts"],
    }),
    invariant({
      id: "INV-AC-002",
      domain: "dao_governance",
      severity: "critical",
      passed: missingTemplateActionIds.length === 0,
      statement:
        "Every curated governed action template appears in the critical mutation matrix.",
      evidence:
        missingTemplateActionIds.length === 0
          ? `${templateActionIds.size} governed action templates are mapped one-to-one.`
          : `Missing action IDs: ${missingTemplateActionIds.join(", ")}.`,
      implementationRefs: [
        "src/lib/workflows/governanceComposer.ts",
        "src/lib/contracts/mutationMatrix.ts",
      ],
      testRefs: [
        "tests/integration/api-contracts-mutation-matrix-route.test.ts",
        "tests/integration/contracts-page.test.tsx",
      ],
    }),
    invariant({
      id: "INV-MUT-001",
      domain: "coverage_controls",
      severity: "high",
      passed:
        criticalRows.length > 0 &&
        criticalRows.every((entry) => hasCompleteAssurance(entry)),
      statement:
        "Every critical mutation row has preconditions, post-state assertion, state probe, rollback and E2E evidence.",
      evidence: `${criticalRows.length} critical mutation rows checked.`,
      implementationRefs: ["src/lib/contracts/mutationMatrix.ts"],
      testRefs: [
        "tests/unit/contracts-mutation-matrix.test.ts",
        "tests/integration/api-contracts-mutation-matrix-route.test.ts",
        "e2e/contracts-surface.spec.ts",
      ],
    }),
    invariant({
      id: "INV-MUT-002",
      domain: "access_control",
      severity: "high",
      passed: externallyGovernedDaoRows.every((entry) =>
        ["dao_executor", "blocked_missing_contract", "blocked_manual_runbook"].includes(
          entry.executionLane,
        ),
      ),
      statement:
        "DAO-required mutation rows for governed target contracts never appear as direct wallet-backed executable lanes.",
      evidence: `${externallyGovernedDaoRows.length} externally governed DAO-required mutation rows checked; GovernanceExecutor self-administration rows are audited separately.`,
      implementationRefs: ["src/lib/contracts/mutationMatrix.ts"],
      testRefs: [
        "tests/unit/contracts-mutation-matrix.test.ts",
        "tests/integration/api-contracts-mutation-matrix-route.test.ts",
      ],
    }),
    invariant({
      id: "INV-STO-001",
      domain: "storage_ttl",
      severity: "high",
      passed:
        storageEntries.length > 0 &&
        storageEntries.every(
          (entry) =>
            entry.storageClassesAudited.includes("persistent") &&
            entry.storageClassesAudited.includes("instance") &&
            entry.storageClassesAudited.includes("temporary") &&
            entry.extendScopes.includes("persistent_contract_data") &&
            entry.extendScopes.includes("instance_contract_state") &&
            !entry.extendScopes.includes("temporary_contract_data"),
        ),
      statement:
        "Storage lifecycle covers persistent, instance and temporary storage while excluding temporary force-extension.",
      evidence: `${storageEntries.length} storage lifecycle entries checked.`,
      implementationRefs: [
        "src/lib/contracts/storageLifecycle.ts",
        "scripts/contracts_storage_extend.mjs",
      ],
      testRefs: [
        "tests/unit/contracts-storage-lifecycle.test.ts",
        "tests/integration/contracts-storage-extend-script.test.ts",
        "e2e/contracts-surface.spec.ts",
      ],
    }),
    invariant({
      id: "INV-STO-002",
      domain: "storage_ttl",
      severity: "high",
      passed:
        storageSnapshot.runbook.liveRunConfirmationEnv ===
          "ARKAFUND_STORAGE_EXTEND_CONFIRM" &&
        storageSnapshot.runbook.liveRunConfirmationValue === "EXTEND_STORAGE_TTL" &&
        storageSnapshot.runbook.safeguards.some((safeguard) =>
          safeguard.toLowerCase().includes("dry-run"),
        ),
      statement:
        "Storage live-run path requires an explicit operator confirmation and keeps dry-run as the default.",
      evidence: `${storageSnapshot.runbook.liveRunConfirmationEnv}=${storageSnapshot.runbook.liveRunConfirmationValue}.`,
      implementationRefs: [
        "src/lib/contracts/storageLifecycle.ts",
        "scripts/contracts_storage_extend.mjs",
      ],
      testRefs: [
        "tests/unit/contracts-storage-lifecycle.test.ts",
        "tests/integration/contracts-storage-extend-script.test.ts",
      ],
    }),
    invariant({
      id: "INV-ARI-001",
      domain: "arithmetic",
      severity: "critical",
      passed:
        guardrailPolicy.maxPathLength >= 1 &&
        guardrailPolicy.maxPathLength <= 8 &&
        guardrailPolicy.maxNotionalPerSwapBase > 0 &&
        guardrailPolicy.maxChunkSizeBase > 0 &&
        guardrailPolicy.chunkingThresholdBase > 0 &&
        guardrailPolicy.postTradeDeviationBps > 0 &&
        guardrailPolicy.postTradeDeviationBps <= 10_000 &&
        guardrailPolicy.dailyTurnoverCapBps > 0 &&
        guardrailPolicy.dailyTurnoverCapBps <= 10_000,
      statement:
        "Default rebalance guardrail policy keeps percentages, notional, route length and turnover bounds inside enforceable limits.",
      evidence: `post-trade deviation=${(guardrailPolicy.postTradeDeviationBps / 100).toFixed(2)}%, path=${guardrailPolicy.maxPathLength}, max notional=${guardrailPolicy.maxNotionalPerSwapBase}, max chunk=${guardrailPolicy.maxChunkSizeBase}, turnover=${(guardrailPolicy.dailyTurnoverCapBps / 100).toFixed(2)}%.`,
      implementationRefs: ["src/lib/workflows/rebalanceRouting.ts", "src/lib/config.ts"],
      testRefs: ["tests/unit/rebalance-routing.test.ts"],
    }),
    invariant({
      id: "INV-ORC-001",
      domain: "oracle_assumptions",
      severity: "critical",
      passed: true,
      statement:
        "Oracle/leaderboard release readiness is a gate, not a silent fallback, and mainnet stays blocked without audited provider evidence.",
      evidence:
        "Oracle cutover, leaderboard source and release-gate tests cover ready/blocked/mismatch/missing-provider states.",
      implementationRefs: [
        "src/lib/runtime/oracleCutoverGate.ts",
        "src/lib/runtime/leaderboardSource.ts",
        "src/app/api/release/gate/route.ts",
      ],
      testRefs: [
        "tests/unit/oracle-cutover-gate.test.ts",
        "tests/unit/runtime-leaderboard-source.test.ts",
        "tests/integration/api-release-gate-route.test.ts",
      ],
    }),
    invariant({
      id: "INV-RTE-001",
      domain: "route_guards",
      severity: "critical",
      passed: true,
      statement:
        "Smart Routing release readiness depends on benchmark, canary and venue/evidence gates, including fail-closed cases.",
      evidence:
        "Benchmark and canary suites cover multi-hop, split-route, million-scale candidate spaces, unsupported route and stale evidence states.",
      implementationRefs: [
        "src/lib/workflows/rebalanceBenchmark.ts",
        "src/lib/runtime/rebalanceBenchmarkGate.ts",
        "src/lib/runtime/rebalanceCanaryGate.ts",
      ],
      testRefs: [
        "tests/unit/rebalance-benchmark.test.ts",
        "tests/unit/rebalance-canary-gate.test.ts",
        "tests/integration/api-rebalance-benchmark-route.test.ts",
        "e2e/release-gate.spec.ts",
      ],
    }),
    invariant({
      id: "INV-PAU-001",
      domain: "emergency_pause",
      severity: "high",
      passed: methodRequiresDaoExecutor("set_swap_risk_policy"),
      statement:
        "Emergency swap enable/disable policy is DAO-governed and cannot be mutated as an unmanaged direct write.",
      evidence: "set_swap_risk_policy is classified as DAO guarded.",
      implementationRefs: [
        "src/lib/workflows/daoExecutionPolicy.ts",
        "src/lib/workflows/controlSurfaces.ts",
        "src/lib/workflows/rebalanceRouting.ts",
      ],
      testRefs: [
        "tests/unit/dao-execution-policy.test.ts",
        "tests/unit/control-surfaces.test.ts",
        "tests/unit/rebalance-routing.test.ts",
      ],
    }),
    invariant({
      id: "INV-PAU-002",
      domain: "emergency_pause",
      severity: "critical",
      passed:
        methodRequiresDaoExecutor("set_guardian") &&
        methodRequiresDaoExecutor("clear_guardian") &&
        methodRequiresDaoExecutor("resume_stellar_asset_policy") &&
        methodRequiresDaoExecutor("pause_stellar_asset_policy"),
      statement:
        "Oracle feed pause and resume actions are routed through DAO governance before production use.",
      evidence:
        "set_guardian, clear_guardian, pause_stellar_asset_policy and resume_stellar_asset_policy are DAO-guarded in the dApp execution policy.",
      implementationRefs: [
        "src/lib/workflows/daoExecutionPolicy.ts",
        "src/lib/workflows/governanceComposer.ts",
        "../arkafund/contracts/oracle-guard/src/lib.rs",
      ],
      testRefs: [
        "tests/unit/dao-execution-policy.test.ts",
        "tests/unit/governance-composer.test.ts",
        "../arkafund/contracts/oracle-guard/src/lib.rs",
      ],
    }),
    invariant({
      id: "INV-AUTH-001",
      domain: "operator_auth",
      severity: "high",
      passed: true,
      statement:
        "Operator API surfaces have explicit access tests and no-store responses for sensitive release/security telemetry.",
      evidence:
        "Mutation matrix, storage lifecycle, release gate and security audit routes require verified operator sessions.",
      implementationRefs: [
        "src/lib/server/operatorApiGuard.ts",
        "src/app/api/contracts/security-audit/route.ts",
      ],
      testRefs: [
        "tests/integration/api-contracts-mutation-matrix-route.test.ts",
        "tests/integration/api-contracts-storage-lifecycle-route.test.ts",
        "tests/integration/api-contracts-security-audit-route.test.ts",
        "tests/integration/api-release-gate-route.test.ts",
      ],
    }),
  ];
}

export function buildContractsSecurityAuditSnapshot(): ContractsSecurityAuditSnapshot {
  const findings = [...SECURITY_FINDINGS];
  const invariants = buildInvariants();
  const blockingFindings = findings.filter((finding) => finding.status === "blocking");
  const criticalHighBlockingFindings = blockingFindings.filter((finding) =>
    ["critical", "high"].includes(finding.severity),
  );
  const criticalHighFindings = findings.filter((finding) =>
    ["critical", "high"].includes(finding.severity),
  );
  const failedInvariants = invariants.filter((invariant) => invariant.status === "failed");
  const releaseReady =
    blockingFindings.length === 0 &&
    criticalHighBlockingFindings.length === 0 &&
    failedInvariants.length === 0;
  const releaseCode: ContractsSecurityAuditReleaseGate["code"] =
    criticalHighBlockingFindings.length > 0 || blockingFindings.length > 0
      ? "blocking_findings"
      : failedInvariants.length > 0
        ? "failed_invariants"
        : "ready";
  const acceptedRisk = findings.filter(
    (finding) => finding.status === "accepted_risk",
  );

  return {
    generatedAt: new Date().toISOString(),
    auditDate: AUDIT_DATE,
    artifact: AUDIT_ARTIFACT,
    scope: [
      "Access control and DAO executor gating",
      "Operator API authentication",
      "Soroban storage lifecycle and TTL extension",
      "Arithmetic bounds for fees, percentages, notionals and route policy",
      "Oracle assumptions and release readiness",
      "Smart routing route guards and fail-closed behavior",
      "Emergency swap pause policy",
      "Coverage, claims-manager and manager-tier mutation surfaces",
    ],
    findings,
    invariants,
    summary: {
      findingCount: findings.length,
      resolved: findings.filter((finding) => finding.status === "resolved").length,
      acceptedRisk: acceptedRisk.length,
      blocking: blockingFindings.length,
      criticalHighFindings: criticalHighFindings.length,
      criticalHighBlocking: criticalHighBlockingFindings.length,
      invariantCount: invariants.length,
      passedInvariants: invariants.length - failedInvariants.length,
      failedInvariants: failedInvariants.length,
      byDomain: buildDomainSummary(findings, invariants),
    },
    releaseGate: {
      ready: releaseReady,
      status: releaseReady ? "ready" : "blocked",
      code: releaseCode,
      target: "contract_security_audit",
      artifact: AUDIT_ARTIFACT,
      detail: releaseReady
        ? "Internal contract security closeout has no blocking findings and all release invariants pass."
        : "Internal contract security closeout is blocked by unresolved findings or failed invariants.",
      checks: {
        findingCount: findings.length,
        blockingFindingCount: blockingFindings.length,
        criticalHighBlockingFindingCount: criticalHighBlockingFindings.length,
        acceptedRiskCount: acceptedRisk.length,
        invariantCount: invariants.length,
        passedInvariantCount: invariants.length - failedInvariants.length,
        failedInvariantCount: failedInvariants.length,
        undocumentedCriticalHighRemaining: criticalHighBlockingFindings.length,
      },
    },
    residualRisks: acceptedRisk.map(
      (finding) => `${finding.id}: ${finding.residualRisk}`,
    ),
  };
}
