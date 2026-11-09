import {
  ARKA_FACTORY,
  ARKA_REGISTRY,
  CLAIMS_MANAGER,
  COVERAGE_FUND,
  COVERAGE_VAULT,
  GOVERNANCE_EXECUTOR_ID,
  LOCKED_ARKA,
  MANAGER_TIER,
  ORACLE_GUARD,
} from "@/lib/config";
import { methodRequiresDaoExecutor } from "@/lib/workflows/daoExecutionPolicy";

export type ContractsMutationCategory =
  | "oracle"
  | "fees"
  | "policy"
  | "venues"
  | "coverage"
  | "authority"
  | "credit"
  | "governance"
  | "executor";

export type ContractsMutationStatus = "ready" | "blocked_missing_contract" | "blocked_manual_runbook";

export type ContractsMutationSeverity = "critical" | "high" | "medium";

export type ContractsMutationExecutionLane =
  | "wallet_backed"
  | "dao_executor"
  | "blocked_missing_contract"
  | "blocked_manual_runbook";

type ContractTarget =
  | "runtime_arka"
  | "arka_factory"
  | "arka_registry"
  | "claims_manager"
  | "coverage_fund"
  | "coverage_vault"
  | "locked_arka"
  | "manager_tier"
  | "oracle_guard"
  | "governance_executor";

type ContractsMutationDefinition = {
  id: string;
  category: ContractsMutationCategory;
  severity: ContractsMutationSeverity;
  title: string;
  description: string;
  writeActionId: string;
  writeMethod: string;
  readActionId: string;
  rollbackActionId?: string;
  preconditions: readonly string[];
  postStateAssertion: string;
  stateProbe: string;
  rollbackStrategy: string;
  riskControls: readonly string[];
  e2eScenario: string;
  contractTarget: ContractTarget;
  manualRunbookOnly?: boolean;
};

export type ContractsMutationMatrixEntry = {
  id: string;
  category: ContractsMutationCategory;
  severity: ContractsMutationSeverity;
  title: string;
  description: string;
  writeActionId: string;
  writeMethod: string;
  readActionId: string;
  rollbackActionId: string | null;
  preconditions: string[];
  postStateAssertion: string;
  stateProbe: string;
  rollbackStrategy: string;
  riskControls: string[];
  e2eScenario: string;
  contractTarget: ContractTarget;
  contractId: string | null;
  contractRequirement: "runtime_input" | "configured";
  status: ContractsMutationStatus;
  daoExecutorRequired: boolean;
  executionLane: ContractsMutationExecutionLane;
};

export type ContractsMutationMatrixSummary = {
  total: number;
  ready: number;
  blocked: number;
  byCategory: Record<
    ContractsMutationCategory,
    {
      total: number;
      ready: number;
      blocked: number;
    }
  >;
  bySeverity: Record<
    ContractsMutationSeverity,
    {
      total: number;
      ready: number;
      blocked: number;
    }
  >;
  daoExecutorRequired: number;
  walletBackedExecutable: number;
};

export type ContractsMutationMatrixSnapshot = {
  generatedAt: string;
  entries: ContractsMutationMatrixEntry[];
  summary: ContractsMutationMatrixSummary;
};

const MUTATION_DEFINITIONS: readonly ContractsMutationDefinition[] = [
  {
    id: "oracle",
    category: "oracle",
    severity: "critical",
    title: "Swap oracle",
    description: "Validates oracle rotation with readback and rollback.",
    writeActionId: "arka-set-swap-oracle",
    writeMethod: "set_swap_oracle",
    readActionId: "arka-read-swap-oracle",
    preconditions: [
      "Runtime Arka contract is selected and readable.",
      "Replacement oracle address is a validated Soroban contract.",
      "Governance path is available because oracle rotation is DAO guarded.",
    ],
    postStateAssertion: "Read swap_oracle after mutation and require it to equal the submitted oracle address.",
    stateProbe: "arka-read-swap-oracle before write, after write and after rollback.",
    rollbackStrategy: "Restore the original oracle address captured before the mutation.",
    riskControls: [
      "DAO executor required for the write path.",
      "Rollback uses the exact pre-mutation oracle address.",
      "Post-state readback blocks silent oracle drift.",
    ],
    e2eScenario: "Wallet-backed matrix verifies UI/API exposure; live mutation path requires DAO/timelock execution.",
    contractTarget: "governance_executor",
  },
  {
    id: "fees-base",
    category: "fees",
    severity: "critical",
    title: "Base fee tuple",
    description: "Mutates management, performance, deposit and redemption fee percentages with full rollback.",
    writeActionId: "arka-set-fees",
    writeMethod: "set_fees",
    readActionId: "arka-read-fees",
    preconditions: [
      "Runtime Arka contract is selected and readable.",
      "Fee percentages are numeric and inside protocol guardrail bounds.",
      "Governance path is available because fee mutation is DAO guarded.",
    ],
    postStateAssertion: "Read the complete fee tuple and compare every fee field with the requested values.",
    stateProbe: "arka-read-fees captures management, performance, deposit and redemption fees before and after mutation.",
    rollbackStrategy: "Reapply the previously captured fee tuple.",
    riskControls: [
      "DAO executor required for fee changes.",
      "All fee fields are compared, not only the changed field.",
      "Rollback restores the entire tuple atomically.",
    ],
    e2eScenario: "Matrix row is exposed to operator E2E; live mutation scenario asserts readback and rollback when governance lane is available.",
    contractTarget: "governance_executor",
  },
  {
    id: "fees-policy",
    category: "fees",
    severity: "critical",
    title: "Protocol fee policy",
    description: "Mutates treasury split policy and restores original values.",
    writeActionId: "arka-set-protocol-fee-policy",
    writeMethod: "set_protocol_fee_policy",
    readActionId: "arka-read-protocol-fee-policy",
    preconditions: [
      "Runtime Arka contract is selected and readable.",
      "Treasury address and split percentages validate before submitting.",
      "Governance path is available because treasury split mutation is DAO guarded.",
    ],
    postStateAssertion: "Read the protocol fee policy and verify treasury plus split percentages match the request.",
    stateProbe: "arka-read-protocol-fee-policy confirms treasury destination and split percentages.",
    rollbackStrategy: "Restore the previous protocol treasury and split policy.",
    riskControls: [
      "DAO executor required for treasury policy changes.",
      "Treasury and split are treated as one policy tuple.",
      "Rollback restores prior treasury and split percentages together.",
    ],
    e2eScenario: "Operator E2E verifies matrix exposure and guarded execution posture for the policy write.",
    contractTarget: "governance_executor",
  },
  {
    id: "policy",
    category: "policy",
    severity: "critical",
    title: "Swap risk policy",
    description: "Mutates full risk guardrail policy and verifies post-state.",
    writeActionId: "arka-set-swap-risk-policy",
    writeMethod: "set_swap_risk_policy",
    readActionId: "arka-read-swap-risk-policy",
    preconditions: [
      "Runtime Arka contract is selected and readable.",
      "Every guardrail value is validated as percentage/count/amount before write.",
      "Governance path is available because swap policy mutation is DAO guarded.",
    ],
    postStateAssertion: "Read every risk guardrail field and require an exact match with the submitted policy.",
    stateProbe: "arka-read-swap-risk-policy verifies price impact, slippage, liquidity, path and chunk limits.",
    rollbackStrategy: "Reapply the original guardrail profile captured before the change.",
    riskControls: [
      "DAO executor required for risk guardrail changes.",
      "Post-state assertion covers the full policy surface.",
      "Rollback uses a full prior policy snapshot.",
    ],
    e2eScenario: "Wallet-backed E2E confirms policy mutation is surfaced as DAO guarded and readback/rollback definitions are present.",
    contractTarget: "runtime_arka",
  },
  {
    id: "venues",
    category: "venues",
    severity: "critical",
    title: "Allowed venues",
    description: "Mutates allowed router/adapter lists and verifies both lanes.",
    writeActionId: "arka-set-allowed-venues",
    writeMethod: "set_allowed_venues",
    readActionId: "arka-read-allowed-routers",
    preconditions: [
      "Runtime Arka contract is selected and readable.",
      "Router and adapter addresses come from the approved protocol registry.",
      "Governance path is available because venue mutation is DAO guarded.",
    ],
    postStateAssertion: "Read allowed routers and adapters and verify both lists match the submitted venue set.",
    stateProbe: "arka-read-allowed-routers plus adapter readback validates both routing lanes.",
    rollbackStrategy: "Restore the previous router and adapter allowlists.",
    riskControls: [
      "DAO executor required for venue allowlist changes.",
      "Routers and adapters are verified as separate lists.",
      "Rollback restores the exact pre-change allowlist.",
    ],
    e2eScenario: "Operator E2E covers the UI/API row and live testnet path can mutate venue lists only through the guarded lane.",
    contractTarget: "runtime_arka",
  },
  {
    id: "venue-whitelist",
    category: "venues",
    severity: "high",
    title: "Deposit whitelist",
    description: "Controls whether the Arka enforces restricted depositor access.",
    writeActionId: "arka-set-whitelist",
    writeMethod: "set_whitelist",
    readActionId: "arka-read-whitelist",
    preconditions: [
      "Runtime Arka contract is selected and readable.",
      "Whitelist mode is reviewed against the product deposit policy.",
      "Governance path is available because whitelist mutation is DAO guarded.",
    ],
    postStateAssertion: "Read whitelist posture and require enabled flag plus allowed wallet set to match the submitted policy.",
    stateProbe: "arka-read-whitelist confirms current deposit access policy.",
    rollbackStrategy: "Restore the previous whitelist enablement and wallet list.",
    riskControls: [
      "DAO executor required for depositor access changes.",
      "Readback prevents silently opening or closing deposits.",
      "Rollback restores the previous access posture.",
    ],
    e2eScenario: "Matrix E2E asserts whitelist mutation is visible, DAO guarded and paired with a readback action.",
    contractTarget: "runtime_arka",
  },
  {
    id: "authority-manager",
    category: "authority",
    severity: "critical",
    title: "Arka manager authority",
    description: "Rotates the manager authority for a live Arka with readback.",
    writeActionId: "arka-set-manager",
    writeMethod: "set_manager",
    readActionId: "arka-read-manager",
    preconditions: [
      "Runtime Arka contract is selected and readable.",
      "New manager address is validated and intended by governance.",
      "Governance path is available because manager rotation is DAO guarded.",
    ],
    postStateAssertion: "Read manager and require it to equal the submitted manager address.",
    stateProbe: "arka-read-manager captures the current and post-mutation manager authority.",
    rollbackStrategy: "Restore the previous manager address captured before the mutation.",
    riskControls: [
      "DAO executor required for authority rotation.",
      "Readback confirms the signer authority actually changed.",
      "Rollback restores the prior manager when recovery is needed.",
    ],
    e2eScenario: "Operator matrix E2E verifies authority rotation is not presented as a direct public action.",
    contractTarget: "runtime_arka",
  },
  {
    id: "authority-router",
    category: "authority",
    severity: "critical",
    title: "Arka router authority",
    description: "Rotates the Arka router contract used by execution lanes.",
    writeActionId: "arka-set-router",
    writeMethod: "set_router",
    readActionId: "arka-read-router",
    preconditions: [
      "Runtime Arka contract is selected and readable.",
      "New router address is validated against deployed router artifacts.",
      "Governance path is available because router rotation is DAO guarded.",
    ],
    postStateAssertion: "Read router and require it to equal the submitted router contract.",
    stateProbe: "arka-read-router confirms the execution router before and after mutation.",
    rollbackStrategy: "Restore the previous router contract captured before the mutation.",
    riskControls: [
      "DAO executor required for execution-router changes.",
      "Contract ID must match a known deployment artifact.",
      "Rollback restores the prior router if execution health regresses.",
    ],
    e2eScenario: "Matrix E2E validates router rotation appears as a guarded critical mutation with rollback instructions.",
    contractTarget: "runtime_arka",
  },
  {
    id: "authority-share-token",
    category: "authority",
    severity: "critical",
    title: "Arka share token",
    description: "Rotates the share-token binding for a live Arka.",
    writeActionId: "arka-set-share-token",
    writeMethod: "set_share_token",
    readActionId: "arka-read-share-token",
    preconditions: [
      "Runtime Arka contract is selected and readable.",
      "New share token contract is verified against issuance records.",
      "Governance path is available because share-token binding is DAO guarded.",
    ],
    postStateAssertion: "Read share_token and require it to equal the submitted token contract.",
    stateProbe: "arka-read-share-token verifies the vault share-token binding.",
    rollbackStrategy: "Restore the previous share-token contract captured before mutation.",
    riskControls: [
      "DAO executor required for share-token binding changes.",
      "Token contract is checked before proposing the mutation.",
      "Rollback returns the Arka to its previous accounting token.",
    ],
    e2eScenario: "Contracts E2E confirms the mutation has explicit authority risk metadata and readback coverage.",
    contractTarget: "runtime_arka",
  },
  {
    id: "credit-blend-risk-policy",
    category: "credit",
    severity: "high",
    title: "Blend risk policy",
    description: "Mutates Blend credit-market guardrails used by credit execution.",
    writeActionId: "arka-set-blend-risk-policy",
    writeMethod: "set_blend_risk_policy",
    readActionId: "arka-read-credit-markets",
    preconditions: [
      "Runtime Arka contract is selected and readable.",
      "Blend market risk parameters are validated before write.",
      "Governance path is available because credit risk policy is DAO guarded.",
    ],
    postStateAssertion: "Read credit market posture and require the Blend risk profile to reflect the submitted policy.",
    stateProbe: "arka-read-credit-markets confirms the current Blend market lane posture.",
    rollbackStrategy: "Restore the previous Blend risk policy snapshot.",
    riskControls: [
      "DAO executor required for credit-risk changes.",
      "Policy is verified against the configured credit-market lane.",
      "Rollback restores prior risk limits.",
    ],
    e2eScenario: "Matrix E2E exposes Blend credit policy as a guarded mutation, not a manual hidden operator tweak.",
    contractTarget: "runtime_arka",
  },
  {
    id: "credit-market-config",
    category: "credit",
    severity: "high",
    title: "Credit market configuration",
    description: "Registers or updates a credit-market lane for Blend-style execution.",
    writeActionId: "arka-configure-credit-market",
    writeMethod: "configure_credit_market",
    readActionId: "arka-read-credit-market-config",
    preconditions: [
      "Runtime Arka contract is selected and readable.",
      "Credit protocol, market asset and market contract are validated.",
      "Governance path is available because credit-market configuration is DAO guarded.",
    ],
    postStateAssertion: "Read the credit-market config and require protocol, market and limits to match the requested lane.",
    stateProbe: "arka-read-credit-market-config verifies one configured credit-market lane.",
    rollbackStrategy: "Restore the previous market config or disable the lane according to the captured pre-state.",
    riskControls: [
      "DAO executor required for credit-market registration.",
      "Protocol and market IDs are checked against the adapter registry.",
      "Rollback returns the lane to the prior config.",
    ],
    e2eScenario: "Operator E2E validates that credit market registration is surfaced as a governed package with readback.",
    contractTarget: "runtime_arka",
  },
  {
    id: "authority-governor",
    category: "authority",
    severity: "critical",
    title: "Arka governor authority",
    description: "Rotates the vault governor authority for a live Arka with readback.",
    writeActionId: "arka-set-governor",
    writeMethod: "set_governor",
    readActionId: "arka-read-governor",
    preconditions: [
      "Runtime Arka contract is selected and readable.",
      "New governor address is validated against governance deployment records.",
      "Governance path is available because vault governor rotation is DAO guarded.",
    ],
    postStateAssertion: "Read governor and require it to equal the submitted governor address.",
    stateProbe: "arka-read-governor captures the current and post-mutation vault governor.",
    rollbackStrategy: "Restore the previous governor address captured before the mutation.",
    riskControls: [
      "DAO executor required for vault governor rotation.",
      "Readback confirms the authority transfer before operators proceed.",
      "Rollback restores the prior governor when recovery is needed.",
    ],
    e2eScenario: "Wallet-backed matrix verifies this action is blocked from direct wallet execution and routed through governance.",
    contractTarget: "runtime_arka",
  },
  {
    id: "contract-wasm-upgrade",
    category: "authority",
    severity: "critical",
    title: "Contract WASM upgrade",
    description: "Updates a deployed contract to a new audited WASM hash through bootstrap admin or DAO governance.",
    writeActionId: "contract-upgrade",
    writeMethod: "upgrade",
    readActionId: "contract-read-last-wasm-hash",
    preconditions: [
      "Target contract exposes the governed upgrade surface.",
      "New WASM hash comes from a reproducible audited build.",
      "Bootstrap expiry, governor and rollback signer posture are recorded before execution.",
    ],
    postStateAssertion: "Read last_wasm_hash and require it to equal the submitted hash, then run the contract-specific smoke test.",
    stateProbe: "last_wasm_hash provides the on-chain upgrade hash while release artifacts provide source/build attestation.",
    rollbackStrategy: "Restore the prior audited WASM hash through the same governed upgrade path if smoke tests fail.",
    riskControls: [
      "DAO executor required outside the temporary bootstrap window.",
      "Artifact checksum and deployment manifest are mandatory for every upgrade.",
      "Post-upgrade readback and smoke tests must pass before the release is closed.",
    ],
    e2eScenario: "Contracts E2E exposes upgrade as a governed action and blocks direct wallet execution for non-executor targets.",
    contractTarget: "governance_executor",
    manualRunbookOnly: true,
  },
  {
    id: "contract-bootstrap-admin-window",
    category: "authority",
    severity: "critical",
    title: "Bootstrap admin window",
    description: "Sets the temporary bootstrap admin and expiry for contracts with separate bootstrap authority.",
    writeActionId: "contract-set-bootstrap-admin",
    writeMethod: "set_bootstrap_admin",
    readActionId: "contract-read-bootstrap-admin-expires-at",
    preconditions: [
      "Target contract exposes set_bootstrap_admin.",
      "Bootstrap admin address is approved for the stabilization window.",
      "Expiry is no more than the protocol maximum and is recorded in the release manifest.",
    ],
    postStateAssertion: "Read bootstrap_admin_expires_at and require it to equal the submitted expiry.",
    stateProbe: "bootstrap_admin_expires_at confirms the active handoff deadline.",
    rollbackStrategy: "Restore the previous bootstrap admin window or remove it through governor authority if the submitted window is wrong.",
    riskControls: [
      "Expiry is bounded on-chain.",
      "Governor can clear the bootstrap admin after handoff.",
      "The action is tracked as a governed release runbook.",
    ],
    e2eScenario: "Contracts E2E exposes bootstrap admin setup as a governed action with readback.",
    contractTarget: "governance_executor",
    manualRunbookOnly: true,
  },
  {
    id: "contract-bootstrap-expiry",
    category: "authority",
    severity: "critical",
    title: "Bootstrap expiry",
    description: "Sets the temporary admin expiry for admin-governed contracts.",
    writeActionId: "contract-set-bootstrap-admin-expiry",
    writeMethod: "set_bootstrap_admin_expiry",
    readActionId: "contract-read-bootstrap-admin-expires-at",
    preconditions: [
      "Target contract exposes set_bootstrap_admin_expiry.",
      "Current admin or governor authority is available for the handoff.",
      "Expiry is bounded and recorded in the deployment runbook.",
    ],
    postStateAssertion: "Read bootstrap_admin_expires_at and require it to equal the submitted expiry.",
    stateProbe: "bootstrap_admin_active and bootstrap_admin_expires_at confirm the configured window.",
    rollbackStrategy: "Restore the previous expiry or remove the expiry through governor authority after DAO handoff.",
    riskControls: [
      "Expiry is bounded on-chain.",
      "Expired admin can no longer mutate governed contracts.",
      "Governor remains the post-expiry authority.",
    ],
    e2eScenario: "Contracts E2E exposes bootstrap expiry setup as governed and blocks direct wallet execution.",
    contractTarget: "governance_executor",
    manualRunbookOnly: true,
  },
  {
    id: "contract-clear-bootstrap-admin",
    category: "authority",
    severity: "critical",
    title: "Clear bootstrap admin",
    description: "Removes separate bootstrap admin authority after DAO handoff.",
    writeActionId: "contract-clear-bootstrap-admin",
    writeMethod: "clear_bootstrap_admin",
    readActionId: "contract-read-bootstrap-admin-active",
    preconditions: [
      "Target contract exposes clear_bootstrap_admin.",
      "Governor authority is configured and available.",
      "DAO handoff has been verified against deployment records.",
    ],
    postStateAssertion: "Read bootstrap_admin_active and require it to be false.",
    stateProbe: "bootstrap_admin_active confirms the temporary authority is gone.",
    rollbackStrategy: "Restore a bootstrap admin through a follow-up governed runbook only if an audited emergency requires it.",
    riskControls: [
      "Only governor can clear the separate bootstrap admin.",
      "Readback confirms temporary authority removal.",
      "Any reactivation requires a new governed runbook.",
    ],
    e2eScenario: "Contracts E2E exposes clear-bootstrap as a governed post-handoff action.",
    contractTarget: "governance_executor",
    manualRunbookOnly: true,
  },
  {
    id: "contract-clear-bootstrap-expiry",
    category: "authority",
    severity: "critical",
    title: "Clear bootstrap expiry",
    description: "Clears the temporary admin expiry through governor authority.",
    writeActionId: "contract-clear-bootstrap-admin-expiry",
    writeMethod: "clear_bootstrap_admin_expiry",
    readActionId: "contract-read-bootstrap-admin-active",
    preconditions: [
      "Target contract exposes clear_bootstrap_admin_expiry.",
      "Governor authority is configured and available.",
      "Admin expiry removal is approved in the DAO handoff runbook.",
    ],
    postStateAssertion: "Read bootstrap_admin_active and require it to be false.",
    stateProbe: "bootstrap_admin_active confirms temporary admin authority is not active.",
    rollbackStrategy: "Restore a corrected expiry through a new governed action if release stabilization requires it.",
    riskControls: [
      "Only governor can clear the expiry.",
      "Readback confirms temporary authority is inactive.",
      "The action remains visible in the mutation matrix.",
    ],
    e2eScenario: "Contracts E2E exposes clear-bootstrap-expiry as a governed post-handoff action.",
    contractTarget: "governance_executor",
    manualRunbookOnly: true,
  },
  {
    id: "factory-implementation",
    category: "authority",
    severity: "critical",
    title: "Factory implementation hash",
    description: "Tracks canonical Arka implementation hash rotation for factory-created and migrated Arkas.",
    writeActionId: "arka-factory-set-implementation",
    writeMethod: "set_implementation",
    readActionId: "arka-factory-read-arkas",
    preconditions: [
      "ArkaFactory contract is configured and reachable.",
      "Implementation hash is produced by a reproducible audited build.",
      "Governance package includes the build artifact, checksum and migration impact note.",
    ],
    postStateAssertion: "Verify the implementation hash through deployment records and require post-upgrade factory-created Arkas to use the audited artifact.",
    stateProbe: "Factory discovery reads remain available while implementation hash verification is performed from deployment artifacts.",
    rollbackStrategy: "Restore the previous audited implementation hash through the same governance runbook if factory provisioning regresses.",
    riskControls: [
      "DAO executor required for implementation rotation.",
      "Manual artifact attestation is mandatory because no canonical readback method exists on this surface.",
      "Factory-created Arka smoke tests must pass before the runbook is closed.",
    ],
    e2eScenario: "Contracts E2E exposes the row as blocked_manual_runbook rather than a false-ready mutation.",
    contractTarget: "arka_factory",
    manualRunbookOnly: true,
  },
  {
    id: "factory-governor",
    category: "authority",
    severity: "critical",
    title: "Factory governor authority",
    description: "Tracks ArkaFactory governor rotation as a guarded operator runbook.",
    writeActionId: "arka-factory-set-governor",
    writeMethod: "set_governor",
    readActionId: "arka-factory-read-arkas",
    preconditions: [
      "ArkaFactory contract is configured and reachable.",
      "New governor address is approved by the DAO and matches deployment records.",
      "Fallback admin and rollback signer posture are documented before submission.",
    ],
    postStateAssertion: "Verify the factory governor rotation through governed execution records and require factory discovery reads to remain healthy.",
    stateProbe: "arka-factory-read-arkas remains the live health probe while authority readback is handled by the runbook.",
    rollbackStrategy: "Restore the previous governor address through a follow-up governed runbook if authority posture is incorrect.",
    riskControls: [
      "DAO executor required for factory governor rotation.",
      "Manual authority attestation is mandatory because the factory surface has no governor readback action.",
      "Post-change factory creation and registry discovery checks must pass.",
    ],
    e2eScenario: "Contracts matrix exposes the action but keeps it blocked_manual_runbook until a machine readback exists.",
    contractTarget: "arka_factory",
    manualRunbookOnly: true,
  },
  {
    id: "factory-share-token-implementation",
    category: "authority",
    severity: "critical",
    title: "Factory share-token implementation",
    description: "Rotates the canonical share-token implementation used by factory provisioning.",
    writeActionId: "arka-factory-set-share-token-implementation",
    writeMethod: "set_share_token_implementation",
    readActionId: "arka-factory-read-share-token-implementation",
    preconditions: [
      "ArkaFactory contract is configured and readable.",
      "Share-token implementation hash is produced by an audited reproducible build.",
      "Governance path is available because implementation rotation is DAO guarded.",
    ],
    postStateAssertion: "Read share_token_implementation and require it to match the submitted bytes32 hash.",
    stateProbe: "arka-factory-read-share-token-implementation verifies the factory's canonical token implementation.",
    rollbackStrategy: "Restore the previous share-token implementation hash captured before mutation.",
    riskControls: [
      "DAO executor required for implementation rotation.",
      "Readback prevents silent factory provisioning drift.",
      "Rollback restores the previously audited share-token implementation.",
    ],
    e2eScenario: "Wallet-backed matrix verifies direct wallet execution is blocked and readback metadata is present.",
    contractTarget: "arka_factory",
  },
  {
    id: "factory-registry-binding",
    category: "authority",
    severity: "critical",
    title: "Factory registry binding",
    description: "Tracks the canonical registry binding used by factory-backed discovery.",
    writeActionId: "arka-factory-set-registry",
    writeMethod: "set_registry",
    readActionId: "arka-factory-read-arkas",
    preconditions: [
      "ArkaFactory contract is configured and reachable.",
      "Registry contract is validated as the canonical Arka registry.",
      "Governance package includes registry migration and discovery impact notes.",
    ],
    postStateAssertion: "Verify registry binding through factory discovery and require newly listed Arkas to resolve from the canonical registry.",
    stateProbe: "arka-factory-read-arkas validates discovery health while registry binding is attested in the runbook.",
    rollbackStrategy: "Restore the previous registry binding through the governed runbook if discovery regresses.",
    riskControls: [
      "DAO executor required for registry binding changes.",
      "Manual registry attestation is mandatory because there is no dedicated factory registry readback action.",
      "Post-change registry and factory discovery smoke checks must pass.",
    ],
    e2eScenario: "Contracts matrix keeps the row visible but blocked_manual_runbook until direct readback is available.",
    contractTarget: "arka_factory",
    manualRunbookOnly: true,
  },
  {
    id: "factory-protocol-treasury",
    category: "fees",
    severity: "critical",
    title: "Factory protocol treasury",
    description: "Rotates the treasury receiver injected into newly created Arkas.",
    writeActionId: "arka-factory-set-protocol-treasury",
    writeMethod: "set_protocol_treasury",
    readActionId: "arka-factory-read-protocol-treasury",
    preconditions: [
      "ArkaFactory contract is configured and readable.",
      "Treasury address is validated against DAO treasury records.",
      "Governance path is available because protocol treasury rotation is DAO guarded.",
    ],
    postStateAssertion: "Read protocol_treasury and require it to equal the submitted treasury address.",
    stateProbe: "arka-factory-read-protocol-treasury confirms the factory-level fee destination.",
    rollbackStrategy: "Restore the previous protocol treasury address captured before mutation.",
    riskControls: [
      "DAO executor required for treasury destination changes.",
      "Readback prevents new-Arka fee destination drift.",
      "Rollback restores the prior protocol receiver.",
    ],
    e2eScenario: "Wallet-backed matrix verifies the action is governed and paired with direct readback.",
    contractTarget: "arka_factory",
  },
  {
    id: "factory-protocol-fee-splits",
    category: "fees",
    severity: "critical",
    title: "Factory protocol fee splits",
    description: "Mutates the management/performance protocol split percentages used by newly created Arkas.",
    writeActionId: "arka-factory-set-protocol-fee-splits",
    writeMethod: "set_protocol_fee_splits",
    readActionId: "arka-factory-read-protocol-mgmt-fee-bps",
    preconditions: [
      "ArkaFactory contract is configured and readable.",
      "Management and performance split percentages are validated against DAO fee bounds.",
      "Governance path is available because fee split mutation is DAO guarded.",
    ],
    postStateAssertion: "Read protocol management and performance fee splits and compare both values with the submitted split.",
    stateProbe: "Factory protocol fee readback validates both split fields.",
    rollbackStrategy: "Restore the previous management and performance protocol split percentages together.",
    riskControls: [
      "DAO executor required for factory fee split changes.",
      "Both split values are verified, not only the changed field.",
      "Rollback restores the entire protocol fee split tuple.",
    ],
    e2eScenario: "Operator E2E asserts this factory fee mutation is visible and blocked from direct wallet execution.",
    contractTarget: "arka_factory",
  },
  {
    id: "factory-creation-fee",
    category: "fees",
    severity: "high",
    title: "Factory creation fee",
    description: "Mutates the token and amount charged when creating a new Arka.",
    writeActionId: "arka-factory-set-creation-fee",
    writeMethod: "set_creation_fee",
    readActionId: "arka-factory-read-creation-fee-amount",
    preconditions: [
      "ArkaFactory contract is configured and readable.",
      "Fee token contract and amount are validated before write.",
      "Governance path is available because creation fee mutation is DAO guarded.",
    ],
    postStateAssertion: "Read creation fee token and amount and require both fields to match the submitted fee tuple.",
    stateProbe: "arka-factory-read-creation-fee-amount plus creation fee token readback validates the configured charge.",
    rollbackStrategy: "Restore the previous creation fee token and amount tuple.",
    riskControls: [
      "DAO executor required for creation fee changes.",
      "Token and amount are treated as one policy tuple.",
      "Rollback restores the exact pre-change creation charge.",
    ],
    e2eScenario: "Contracts E2E validates factory fee controls are represented as governed critical surface rows.",
    contractTarget: "arka_factory",
  },
  {
    id: "registry-registrar",
    category: "authority",
    severity: "critical",
    title: "Registry registrar authority",
    description: "Mutates registrar write access for the canonical Arka registry.",
    writeActionId: "arka-registry-set-registrar",
    writeMethod: "set_registrar",
    readActionId: "arka-registry-read-is-registrar",
    preconditions: [
      "ArkaRegistry contract is configured and readable.",
      "Registrar address is validated against operator and factory records.",
      "Governance path is available because registrar authorization is DAO guarded.",
    ],
    postStateAssertion: "Read is_registrar for the submitted address and require the allowed flag to match.",
    stateProbe: "arka-registry-read-is-registrar verifies canonical registry write access.",
    rollbackStrategy: "Restore the previous registrar authorization flag for the same address.",
    riskControls: [
      "DAO executor required for registry write authority changes.",
      "Readback is scoped to the exact registrar address.",
      "Rollback restores the prior authorization bit.",
    ],
    e2eScenario: "Wallet-backed matrix verifies registrar mutation is blocked from direct wallet execution.",
    contractTarget: "arka_registry",
  },
  {
    id: "registry-manager-curated",
    category: "policy",
    severity: "high",
    title: "Registry manager curated flag",
    description: "Mutates the curated status surfaced for a manager in registry-backed product views.",
    writeActionId: "arka-registry-set-manager-curated",
    writeMethod: "set_manager_curated",
    readActionId: "arka-registry-read-is-manager-curated",
    preconditions: [
      "ArkaRegistry contract is configured and readable.",
      "Manager address is validated and matches a known manager lane.",
      "Governance path is available because curation mutation is DAO guarded.",
    ],
    postStateAssertion: "Read is_manager_curated for the target manager and require the curated flag to match.",
    stateProbe: "arka-registry-read-is-manager-curated verifies the exact manager curation state.",
    rollbackStrategy: "Restore the previous manager curated flag captured before mutation.",
    riskControls: [
      "DAO executor required for curated manager flags.",
      "Readback is scoped to the target manager.",
      "Rollback restores the previous product curation posture.",
    ],
    e2eScenario: "Contracts E2E validates product curation is not an untracked UI-only toggle.",
    contractTarget: "arka_registry",
  },
  {
    id: "registry-delisted",
    category: "policy",
    severity: "high",
    title: "Registry Arka delisted flag",
    description: "Mutates whether an Arka is excluded from registry-backed discovery.",
    writeActionId: "arka-registry-set-delisted",
    writeMethod: "set_delisted",
    readActionId: "arka-registry-read-is-delisted",
    preconditions: [
      "ArkaRegistry contract is configured and readable.",
      "Arka address is validated against registry/factory discovery.",
      "Governance path is available because delisting mutation is DAO guarded.",
    ],
    postStateAssertion: "Read is_delisted for the target Arka and require the delisted flag to match.",
    stateProbe: "arka-registry-read-is-delisted verifies product discovery eligibility for one Arka.",
    rollbackStrategy: "Restore the previous delisted flag captured before mutation.",
    riskControls: [
      "DAO executor required for delisting decisions.",
      "Readback is scoped to the exact Arka.",
      "Rollback restores the previous discovery posture.",
    ],
    e2eScenario: "Operator E2E confirms delisting is visible as a governed policy mutation.",
    contractTarget: "arka_registry",
  },
  {
    id: "coverage-claims-manager",
    category: "coverage",
    severity: "critical",
    title: "Coverage fund claims manager",
    description: "Mutates CoverageFund claims manager and restores original owner.",
    writeActionId: "coverage-fund-set-claims-manager",
    writeMethod: "set_claims_manager",
    readActionId: "coverage-fund-read-claims-manager",
    preconditions: [
      "CoverageFund contract is configured and readable.",
      "New claims manager address is validated.",
      "Governance path is available because claims-manager rotation is DAO guarded.",
    ],
    postStateAssertion: "Read CoverageFund claims_manager and require it to equal the submitted manager.",
    stateProbe: "coverage-fund-read-claims-manager confirms the current claims authority.",
    rollbackStrategy: "Restore the previous CoverageFund claims manager.",
    riskControls: [
      "DAO executor required for claims authority changes.",
      "Readback confirms the fund-level recovery authority.",
      "Rollback restores the previous claims manager.",
    ],
    e2eScenario: "Matrix API/UI confirms coverage authority rotation is included in critical testnet mutation coverage.",
    contractTarget: "coverage_fund",
  },
  {
    id: "coverage-vault-claims-manager",
    category: "coverage",
    severity: "critical",
    title: "Coverage vault claims manager",
    description: "Mutates CoverageVault claims manager and restores original owner.",
    writeActionId: "coverage-vault-set-claims-manager",
    writeMethod: "set_claims_manager",
    readActionId: "coverage-vault-read-claims-manager",
    preconditions: [
      "CoverageVault contract is configured and readable.",
      "New vault claims manager address is validated.",
      "Governance path is available because vault claims-manager rotation is DAO guarded.",
    ],
    postStateAssertion: "Read CoverageVault claims_manager and require it to equal the submitted manager.",
    stateProbe: "coverage-vault-read-claims-manager confirms the vault-level claims authority.",
    rollbackStrategy: "Restore the previous CoverageVault claims manager.",
    riskControls: [
      "DAO executor required for vault claims authority changes.",
      "Readback confirms the vault authority after mutation.",
      "Rollback restores the previous vault claims manager.",
    ],
    e2eScenario: "Matrix E2E validates vault coverage authority mutation and rollback metadata.",
    contractTarget: "coverage_vault",
  },
  {
    id: "coverage-policy",
    category: "coverage",
    severity: "critical",
    title: "Covered vault policy",
    description: "Mutates covered-vault premium/limit policy with rollback support.",
    writeActionId: "coverage-fund-set-covered-vault-policy",
    writeMethod: "set_covered_vault_policy",
    readActionId: "coverage-fund-read-covered-vault-policy",
    rollbackActionId: "coverage-fund-remove-covered-vault",
    preconditions: [
      "CoverageFund contract is configured and readable.",
      "Covered vault ID and coverage limit are validated.",
      "Governance path is available because covered-vault policy is DAO guarded.",
    ],
    postStateAssertion: "Read the covered-vault policy and verify premium and coverage limit after mutation.",
    stateProbe: "coverage-fund-read-covered-vault-policy verifies premium and limit for the selected vault.",
    rollbackStrategy: "Remove the covered-vault policy when it did not exist before, otherwise restore the prior policy.",
    riskControls: [
      "DAO executor required for covered-vault policy changes.",
      "Rollback can remove newly-created coverage policy safely.",
      "Post-state readback checks both premium and limit.",
    ],
    e2eScenario: "Wallet-backed mutation scenario can assert policy readback and rollback where CoverageFund is configured.",
    contractTarget: "coverage_fund",
  },
  {
    id: "coverage-lock",
    category: "coverage",
    severity: "high",
    title: "Coverage lock ratio",
    description: "Mutates lock ratio on CoverageVault and validates rollback.",
    writeActionId: "coverage-vault-set-lock-bps",
    writeMethod: "set_lock_bps",
    readActionId: "coverage-vault-read-lock-bps",
    preconditions: [
      "CoverageVault contract is configured and readable.",
      "Lock ratio is numeric and inside DAO-approved bounds.",
      "Governance path is available because lock-ratio mutation is DAO guarded.",
    ],
    postStateAssertion: "Read lock ratio and require it to equal the submitted lock percentage.",
    stateProbe: "Coverage vault readback captures first-loss reserve lock percentage.",
    rollbackStrategy: "Restore the previous lock ratio.",
    riskControls: [
      "DAO executor required for lock percentage changes.",
      "Readback prevents reserve-lock drift.",
      "Rollback restores the previous lock percentage.",
    ],
    e2eScenario: "Coverage mutation matrix asserts lock-ratio mutation is paired with readback and rollback.",
    contractTarget: "coverage_vault",
  },
  {
    id: "coverage-fund-governor",
    category: "coverage",
    severity: "critical",
    title: "Coverage fund governor",
    description: "Rotates CoverageFund governance authority.",
    writeActionId: "coverage-fund-set-governor",
    writeMethod: "set_governor",
    readActionId: "coverage-fund-read-governor",
    preconditions: [
      "CoverageFund contract is configured and readable.",
      "New governor address is validated against governance deployment records.",
      "Governance path is available because governor rotation is DAO guarded.",
    ],
    postStateAssertion: "Read CoverageFund governor and require it to equal the submitted governor.",
    stateProbe: "coverage-fund-read-governor confirms coverage governance authority.",
    rollbackStrategy: "Restore the previous CoverageFund governor address.",
    riskControls: [
      "DAO executor required for governor rotation.",
      "Readback confirms authority transfer.",
      "Rollback restores prior coverage governance authority.",
    ],
    e2eScenario: "Matrix E2E confirms fund-governor rotation is tracked as critical coverage governance.",
    contractTarget: "coverage_fund",
  },
  {
    id: "coverage-fund-treasury",
    category: "coverage",
    severity: "critical",
    title: "Coverage fund treasury",
    description: "Rotates the CoverageFund treasury destination.",
    writeActionId: "coverage-fund-set-treasury",
    writeMethod: "set_treasury",
    readActionId: "coverage-fund-read-treasury",
    preconditions: [
      "CoverageFund contract is configured and readable.",
      "Treasury destination is validated and approved.",
      "Governance path is available because treasury rotation is DAO guarded.",
    ],
    postStateAssertion: "Read CoverageFund treasury and require it to equal the submitted treasury address.",
    stateProbe: "coverage-fund-read-treasury confirms reserve fee destination.",
    rollbackStrategy: "Restore the previous CoverageFund treasury address.",
    riskControls: [
      "DAO executor required for treasury rotation.",
      "Readback prevents fee destination drift.",
      "Rollback restores the prior treasury.",
    ],
    e2eScenario: "Operator E2E verifies treasury mutation is exposed with critical risk controls.",
    contractTarget: "coverage_fund",
  },
  {
    id: "coverage-fund-economics",
    category: "coverage",
    severity: "high",
    title: "Coverage economics policy",
    description: "Mutates reserve premium/economics settings for the coverage fund.",
    writeActionId: "coverage-fund-set-economics-policy",
    writeMethod: "set_economics_policy",
    readActionId: "coverage-fund-read-metrics",
    preconditions: [
      "CoverageFund contract is configured and readable.",
      "Economics percentage values are reviewed against DAO-approved reserve policy.",
      "Governance path is available because economics policy is DAO guarded.",
    ],
    postStateAssertion: "Read coverage metrics after mutation and require economics-dependent values to remain coherent.",
    stateProbe: "coverage-fund-read-metrics confirms reserve posture after economics update.",
    rollbackStrategy: "Restore the previous economics policy tuple.",
    riskControls: [
      "DAO executor required for reserve economics changes.",
      "Metrics readback validates no incoherent reserve state.",
      "Rollback restores prior economics policy.",
    ],
    e2eScenario: "Matrix E2E confirms economics policy has explicit guarded mutation coverage.",
    contractTarget: "coverage_fund",
  },
  {
    id: "claims-manager-treasury",
    category: "coverage",
    severity: "critical",
    title: "Claims manager treasury",
    description: "Rotates the treasury fallback recipient used by claims execution.",
    writeActionId: "claims-manager-set-treasury",
    writeMethod: "set_treasury",
    readActionId: "claims-manager-read-treasury",
    preconditions: [
      "ClaimsManager contract is configured and readable.",
      "Treasury address is validated against DAO reserve records.",
      "Governance path is available because claims treasury rotation is DAO guarded.",
    ],
    postStateAssertion: "Read ClaimsManager treasury and require it to equal the submitted treasury address.",
    stateProbe: "claims-manager-read-treasury confirms the claims payout fallback destination.",
    rollbackStrategy: "Restore the previous ClaimsManager treasury address captured before mutation.",
    riskControls: [
      "DAO executor required for claims treasury changes.",
      "Readback prevents payout destination drift.",
      "Rollback restores the prior treasury receiver.",
    ],
    e2eScenario: "Wallet-backed matrix validates treasury rotation is blocked from direct wallet execution.",
    contractTarget: "claims_manager",
  },
  {
    id: "claims-manager-governor",
    category: "coverage",
    severity: "critical",
    title: "Claims manager governor",
    description: "Rotates the ClaimsManager governor authority for incident policy.",
    writeActionId: "claims-manager-set-governor",
    writeMethod: "set_governor",
    readActionId: "claims-manager-read-governor",
    preconditions: [
      "ClaimsManager contract is configured and readable.",
      "New governor address is validated against governance deployment records.",
      "Governance path is available because claims governor rotation is DAO guarded.",
    ],
    postStateAssertion: "Read ClaimsManager governor and require it to equal the submitted governor.",
    stateProbe: "claims-manager-read-governor confirms incident-governance authority.",
    rollbackStrategy: "Restore the previous ClaimsManager governor address captured before mutation.",
    riskControls: [
      "DAO executor required for claims governor rotation.",
      "Readback confirms authority transfer.",
      "Rollback restores prior claims governance authority.",
    ],
    e2eScenario: "Contracts matrix keeps claims governance changes visible and DAO gated.",
    contractTarget: "claims_manager",
  },
  {
    id: "claims-manager-risk-operator",
    category: "coverage",
    severity: "high",
    title: "Claims manager risk operator",
    description: "Tracks incident risk-operator authorization for the claims lane.",
    writeActionId: "claims-manager-set-risk-operator",
    writeMethod: "set_risk_operator",
    readActionId: "claims-manager-read-next-incident-id",
    preconditions: [
      "ClaimsManager contract is configured and reachable.",
      "Risk operator address is validated against incident-response records.",
      "Governance package includes incident authority scope and rollback signer posture.",
    ],
    postStateAssertion: "Verify risk-operator authorization through governed execution records and require incident reads to remain healthy.",
    stateProbe: "claims-manager-read-next-incident-id remains the live health probe while operator authorization is attested.",
    rollbackStrategy: "Restore or remove the previous risk-operator authorization through a governed runbook.",
    riskControls: [
      "DAO executor required for risk-operator authorization.",
      "Manual authority attestation is mandatory because no exact risk-operator readback exists.",
      "Incident creation and readback smoke checks must pass after the runbook.",
    ],
    e2eScenario: "Matrix E2E exposes the action as blocked_manual_runbook rather than pretending direct readback exists.",
    contractTarget: "claims_manager",
    manualRunbookOnly: true,
  },
  {
    id: "claims-manager-covered-vault",
    category: "coverage",
    severity: "critical",
    title: "Claims manager covered vault",
    description: "Registers the covered-vault binding across manager vault, community fund and payout recipient.",
    writeActionId: "claims-manager-register-covered-vault",
    writeMethod: "register_covered_vault",
    readActionId: "claims-manager-read-covered-vault",
    preconditions: [
      "ClaimsManager contract is configured and readable.",
      "Vault, manager vault, community fund and recipient addresses are validated.",
      "Governance path is available because covered-vault registration is DAO guarded.",
    ],
    postStateAssertion: "Read covered-vault binding and verify manager vault, community fund and recipient match the submitted tuple.",
    stateProbe: "claims-manager-read-covered-vault validates the exact covered-vault accounting lane.",
    rollbackStrategy: "Restore the previous covered-vault binding or remove the lane through the coverage runbook when it was newly added.",
    riskControls: [
      "DAO executor required for covered-vault registration.",
      "Readback checks every address in the binding tuple.",
      "Rollback restores prior claims routing or removes the newly-created binding.",
    ],
    e2eScenario: "Operator E2E verifies claims coverage registration is a governed critical mutation.",
    contractTarget: "claims_manager",
  },
  {
    id: "coverage-remove-covered-vault",
    category: "coverage",
    severity: "critical",
    title: "Remove covered vault policy",
    description: "Removes one covered-vault policy from the coverage fund with rollback support.",
    writeActionId: "coverage-fund-remove-covered-vault",
    writeMethod: "remove_covered_vault",
    readActionId: "coverage-fund-read-covered-vault-policy",
    rollbackActionId: "coverage-fund-set-covered-vault-policy",
    preconditions: [
      "CoverageFund contract is configured and readable.",
      "Covered vault ID is validated against existing policy records.",
      "Governance path is available because coverage removal is DAO guarded.",
    ],
    postStateAssertion: "Read covered-vault policy and verify the policy is absent or returns the expected removed state.",
    stateProbe: "coverage-fund-read-covered-vault-policy confirms whether the selected vault still has coverage policy.",
    rollbackStrategy: "Reapply the previously captured covered-vault policy tuple when removal was not intended to be permanent.",
    riskControls: [
      "DAO executor required for coverage removal.",
      "Readback confirms the removed policy state.",
      "Rollback can reapply the captured premium and coverage limit.",
    ],
    e2eScenario: "Wallet-backed matrix validates removal is paired with a rollback action and direct wallet lane blocking.",
    contractTarget: "coverage_fund",
  },
  {
    id: "coverage-vault-governor",
    category: "coverage",
    severity: "critical",
    title: "Coverage vault governor",
    description: "Rotates CoverageVault governance authority.",
    writeActionId: "coverage-vault-set-governor",
    writeMethod: "set_governor",
    readActionId: "coverage-vault-read-governor",
    preconditions: [
      "CoverageVault contract is configured and readable.",
      "New governor address is validated against governance deployment records.",
      "Governance path is available because vault governor rotation is DAO guarded.",
    ],
    postStateAssertion: "Read CoverageVault governor and require it to equal the submitted governor.",
    stateProbe: "coverage-vault-read-governor confirms vault governance authority.",
    rollbackStrategy: "Restore the previous CoverageVault governor address.",
    riskControls: [
      "DAO executor required for vault governor rotation.",
      "Readback confirms authority transfer.",
      "Rollback restores prior vault governance authority.",
    ],
    e2eScenario: "Coverage E2E matrix validates vault-governor mutation risk metadata.",
    contractTarget: "coverage_vault",
  },
  {
    id: "governance-thresholds",
    category: "governance",
    severity: "critical",
    title: "Manager tier thresholds",
    description: "Mutates tier thresholds with post-state assertions and rollback.",
    writeActionId: "manager-tier-set-thresholds",
    writeMethod: "set_thresholds",
    readActionId: "manager-tier-read-thresholds",
    preconditions: [
      "ManagerTier contract is configured and readable.",
      "Threshold list is sorted and validated before write.",
      "Governance path is available because tier threshold mutation is DAO guarded.",
    ],
    postStateAssertion: "Read manager tier thresholds and compare all tier boundaries with the submitted list.",
    stateProbe: "manager-tier-read-thresholds confirms all tier boundaries.",
    rollbackStrategy: "Reapply the original tier threshold list.",
    riskControls: [
      "DAO executor required for tier threshold changes.",
      "Readback compares the complete threshold list.",
      "Rollback restores the prior tier map.",
    ],
    e2eScenario: "Manager-tier E2E confirms threshold changes are represented as governed critical mutations.",
    contractTarget: "manager_tier",
  },
  {
    id: "governance-points",
    category: "governance",
    severity: "high",
    title: "Manager points",
    description: "Mutates manager points with readback and rollback.",
    writeActionId: "manager-tier-set-points",
    writeMethod: "set_points",
    readActionId: "manager-tier-read-points-of",
    preconditions: [
      "ManagerTier contract is configured and readable.",
      "Target manager address and points value are validated.",
      "Governance path is available because direct points mutation is DAO guarded.",
    ],
    postStateAssertion: "Read manager points for the target manager and require the submitted points value.",
    stateProbe: "manager-tier-read-points-of checks the selected manager score.",
    rollbackStrategy: "Restore the previous manager points value.",
    riskControls: [
      "DAO executor required for direct points assignment.",
      "Readback is scoped to the exact manager.",
      "Rollback restores the prior manager points value.",
    ],
    e2eScenario: "Wallet-backed E2E checks manager points mutation is catalogued with a readback action and DAO guard.",
    contractTarget: "manager_tier",
  },
  {
    id: "governance-points-delta",
    category: "governance",
    severity: "high",
    title: "Manager points delta",
    description: "Applies a signed delta to one manager point balance with readback and rollback.",
    writeActionId: "manager-tier-add-points",
    writeMethod: "add_points",
    readActionId: "manager-tier-read-points-of",
    preconditions: [
      "ManagerTier contract is configured and readable.",
      "Target manager address and signed delta are validated.",
      "Operator wallet is authorized for the point delta lane or routed through governance policy.",
    ],
    postStateAssertion: "Read manager points for the target manager and compare the balance with the expected delta result.",
    stateProbe: "manager-tier-read-points-of checks the selected manager score before and after the delta.",
    rollbackStrategy: "Reapply the opposite signed delta to restore the previous manager points value.",
    riskControls: [
      "Signed delta is validated as an integer before execution.",
      "Readback is scoped to the exact manager.",
      "Rollback uses the exact inverse delta rather than a guessed absolute value.",
    ],
    e2eScenario: "Wallet-backed E2E executes add_points when authorized and verifies inverse-delta rollback.",
    contractTarget: "manager_tier",
  },
  {
    id: "governance-tier-governor",
    category: "governance",
    severity: "critical",
    title: "Manager tier governor",
    description: "Rotates ManagerTier governance authority.",
    writeActionId: "manager-tier-set-governor",
    writeMethod: "set_governor",
    readActionId: "manager-tier-read-governor",
    preconditions: [
      "ManagerTier contract is configured and readable.",
      "New governor address is validated against governance deployment records.",
      "Governance path is available because tier governor rotation is DAO guarded.",
    ],
    postStateAssertion: "Read ManagerTier governor and require it to equal the submitted governor.",
    stateProbe: "manager-tier-read-governor confirms the tier-governance authority.",
    rollbackStrategy: "Restore the previous ManagerTier governor address.",
    riskControls: [
      "DAO executor required for tier governor rotation.",
      "Readback confirms authority transfer.",
      "Rollback restores previous tier governance.",
    ],
    e2eScenario: "Governance E2E matrix validates tier governor rotation has critical mutation coverage.",
    contractTarget: "manager_tier",
  },
  {
    id: "locked-arka-admin",
    category: "authority",
    severity: "critical",
    title: "Locked ARKA admin",
    description: "Rotates the vote-lock admin authority used by the governance token lane.",
    writeActionId: "locked-arka-set-admin",
    writeMethod: "set_admin",
    readActionId: "locked-arka-read-admin",
    preconditions: [
      "LockedArka contract is configured and readable.",
      "New admin address is validated against governance operations records.",
      "Governance path is available because vote-lock admin rotation is DAO guarded.",
    ],
    postStateAssertion: "Read LockedArka admin and require it to equal the submitted admin address.",
    stateProbe: "locked-arka-read-admin confirms the vote-lock administrative authority.",
    rollbackStrategy: "Restore the previous LockedArka admin address captured before mutation.",
    riskControls: [
      "DAO executor required for locked-token admin changes.",
      "Readback confirms the active admin.",
      "Rollback restores the prior vote-lock administrator.",
    ],
    e2eScenario: "Wallet-backed matrix validates locked-token admin rotation is visible and DAO gated.",
    contractTarget: "locked_arka",
  },
  {
    id: "locked-arka-governor",
    category: "governance",
    severity: "critical",
    title: "Locked ARKA governor",
    description: "Rotates the governor authority used for vote-sequence management.",
    writeActionId: "locked-arka-set-governor",
    writeMethod: "set_governor",
    readActionId: "locked-arka-read-governor",
    preconditions: [
      "LockedArka contract is configured and readable.",
      "New governor address is validated against governance deployment records.",
      "Governance path is available because vote-lock governor rotation is DAO guarded.",
    ],
    postStateAssertion: "Read LockedArka governor and require it to equal the submitted governor address.",
    stateProbe: "locked-arka-read-governor confirms the vote-lock governance authority.",
    rollbackStrategy: "Restore the previous LockedArka governor address captured before mutation.",
    riskControls: [
      "DAO executor required for locked-token governor changes.",
      "Readback confirms the active governor.",
      "Rollback restores the prior vote-lock governor.",
    ],
    e2eScenario: "Contracts E2E verifies locked-token governance changes are covered by the mutation matrix.",
    contractTarget: "locked_arka",
  },
  {
    id: "oracle-guard-admin",
    category: "oracle",
    severity: "critical",
    title: "Oracle guard admin",
    description: "Rotates OracleGuard administrative authority.",
    writeActionId: "oracle-guard-set-admin",
    writeMethod: "set_admin",
    readActionId: "oracle-guard-read-admin",
    preconditions: [
      "OracleGuard contract is configured and readable.",
      "New admin address is validated against operator records.",
      "Governance path is available because OracleGuard admin rotation is guarded.",
    ],
    postStateAssertion: "Read OracleGuard admin and require it to equal the submitted admin address.",
    stateProbe: "oracle-guard-read-admin confirms the current oracle-guard authority.",
    rollbackStrategy: "Restore the previous OracleGuard admin address.",
    riskControls: [
      "DAO executor required for oracle guard admin changes unless executed by the guard authority.",
      "Readback confirms the active admin.",
      "Rollback restores the prior oracle authority.",
    ],
    e2eScenario: "Oracle cutover E2E validates the admin mutation is exposed and never hidden as an untracked raw write.",
    contractTarget: "oracle_guard",
  },
  {
    id: "oracle-guard-guardian",
    category: "oracle",
    severity: "critical",
    title: "Oracle guard guardian",
    description: "Sets the emergency oracle guardian multisig and expiry.",
    writeActionId: "oracle-guard-set-guardian",
    writeMethod: "set_guardian",
    readActionId: "oracle-guard-read-guardian-config",
    rollbackActionId: "oracle-guard-clear-guardian",
    preconditions: [
      "OracleGuard contract is configured and readable.",
      "Guardian address is a reviewed multisig, not an individual EOA.",
      "Expiry is future-dated and inside the approved bootstrap/emergency window.",
    ],
    postStateAssertion: "Read guardian_config and require guardian, expiry and active state to match the submitted policy.",
    stateProbe: "oracle-guard-read-guardian-config confirms guardian address, expiry and active flag.",
    rollbackStrategy: "Clear the guardian when the DAO removes emergency powers or replaces the guardian policy.",
    riskControls: [
      "DAO executor required for guardian assignment.",
      "Guardian can only pause feeds, not add providers or resume assets.",
      "Expiry prevents permanent emergency authority.",
    ],
    e2eScenario: "Release-gate and governance-composer tests verify guardian setup is a curated DAO package.",
    contractTarget: "oracle_guard",
  },
  {
    id: "oracle-guard-clear-guardian",
    category: "oracle",
    severity: "high",
    title: "Clear oracle guard guardian",
    description: "Removes emergency oracle guardian authority after DAO handoff or rotation.",
    writeActionId: "oracle-guard-clear-guardian",
    writeMethod: "clear_guardian",
    readActionId: "oracle-guard-read-guardian-config",
    rollbackActionId: "oracle-guard-set-guardian",
    preconditions: [
      "OracleGuard contract is configured and readable.",
      "DAO has reviewed that no emergency guardian is currently required.",
      "Current guardian config is captured before clearing.",
    ],
    postStateAssertion: "Read guardian_config and require guardian to be absent and active=false.",
    stateProbe: "oracle-guard-read-guardian-config before and after clearing confirms the emergency authority state.",
    rollbackStrategy: "Restore the captured guardian address and expiry if clearing was accidental.",
    riskControls: [
      "DAO executor required for removing guardian policy.",
      "Readback confirms emergency authority is no longer active.",
      "Rollback requires a fresh governed set_guardian package.",
    ],
    e2eScenario: "Governance composer can stage the clear-guardian package for Contracts/executor review.",
    contractTarget: "oracle_guard",
  },
  {
    id: "oracle-guard-pause-asset-policy",
    category: "oracle",
    severity: "critical",
    title: "Pause oracle asset policy",
    description: "Pauses one Stellar asset feed during oracle incident response.",
    writeActionId: "oracle-guard-pause-stellar-asset-policy",
    writeMethod: "pause_stellar_asset_policy",
    readActionId: "oracle-guard-read-stellar-asset-policy-paused",
    rollbackActionId: "oracle-guard-resume-stellar-asset-policy",
    preconditions: [
      "OracleGuard contract is configured and readable.",
      "The asset policy exists and the incident has a recorded owner.",
      "DAO authority is available for the emergency pause package.",
    ],
    postStateAssertion: "Read the asset pause flag and require it to be true before the asset is used for valuation or routing.",
    stateProbe: "oracle-guard-read-stellar-asset-policy-paused confirms the pause flag before and after the pause action.",
    rollbackStrategy: "Restore the asset policy by resuming it only after DAO review confirms the feed is safe.",
    riskControls: [
      "DAO executor required for pausing feeds.",
      "Pause is a negative-control safety action, not a pricing configuration change.",
      "Readback prevents pausing the wrong asset.",
      "Rollback uses the governed resume action instead of silently unpausing.",
    ],
    e2eScenario: "Mutation matrix validates oracle pause and resume as paired safety controls.",
    contractTarget: "oracle_guard",
  },
  {
    id: "oracle-guard-asset-policy",
    category: "oracle",
    severity: "critical",
    title: "Oracle asset policy",
    description: "Mutates per-asset oracle policy used by price/profit gates.",
    writeActionId: "oracle-guard-set-stellar-asset-policy",
    writeMethod: "set_stellar_asset_policy",
    readActionId: "oracle-guard-read-stellar-asset-policy",
    rollbackActionId: "oracle-guard-clear-stellar-asset-policy",
    preconditions: [
      "OracleGuard contract is configured and readable.",
      "Asset code/issuer pair and provider policy are validated.",
      "Governance path is available because asset oracle policy is guarded.",
    ],
    postStateAssertion: "Read the Stellar asset policy and require provider, freshness and status to match the submitted policy.",
    stateProbe: "oracle-guard-read-stellar-asset-policy confirms the selected asset's oracle policy.",
    rollbackStrategy: "Clear the policy when it did not exist before, otherwise restore the prior per-asset policy.",
    riskControls: [
      "DAO executor required for oracle policy changes.",
      "Rollback supports clearing newly-created asset policy.",
      "Readback ties profit/leaderboard pricing to declared providers.",
    ],
    e2eScenario: "Oracle E2E matrix validates asset policy mutation, status readback and rollback coverage.",
    contractTarget: "oracle_guard",
  },
  {
    id: "oracle-guard-clear-asset-policy",
    category: "oracle",
    severity: "high",
    title: "Clear oracle asset policy",
    description: "Clears one Stellar asset oracle policy used by profit, leaderboard and swap-safety gates.",
    writeActionId: "oracle-guard-clear-stellar-asset-policy",
    writeMethod: "clear_stellar_asset_policy",
    readActionId: "oracle-guard-read-stellar-asset-policy",
    rollbackActionId: "oracle-guard-set-stellar-asset-policy",
    preconditions: [
      "OracleGuard contract is configured and readable.",
      "Asset contract is validated and the previous policy snapshot is captured.",
      "Governance path is available because clearing oracle policy is DAO guarded.",
    ],
    postStateAssertion: "Read the Stellar asset policy and verify that the selected asset no longer has an active policy.",
    stateProbe: "oracle-guard-read-stellar-asset-policy checks the exact asset policy before and after clearing.",
    rollbackStrategy: "Restore the captured per-asset oracle policy when clearing was not intended to be permanent.",
    riskControls: [
      "DAO executor required for clearing price-source policy.",
      "Readback prevents silently removing pricing for the wrong asset.",
      "Rollback restores the captured primary, secondary and freshness configuration.",
    ],
    e2eScenario: "Wallet-backed matrix verifies clear policy is DAO gated and paired with a restore action.",
    contractTarget: "oracle_guard",
  },
  {
    id: "oracle-guard-resume-asset-policy",
    category: "oracle",
    severity: "critical",
    title: "Resume oracle asset policy",
    description: "Reactivates one paused Stellar asset feed after DAO review.",
    writeActionId: "oracle-guard-resume-stellar-asset-policy",
    writeMethod: "resume_stellar_asset_policy",
    readActionId: "oracle-guard-read-stellar-asset-policy-paused",
    rollbackActionId: "oracle-guard-pause-stellar-asset-policy",
    preconditions: [
      "OracleGuard contract is configured and readable.",
      "The asset pause reason has been reviewed and remediated.",
      "Governance path is available because resuming an oracle feed is DAO guarded.",
    ],
    postStateAssertion: "Read the asset pause flag and require it to be false before economic valuation resumes.",
    stateProbe: "oracle-guard-read-stellar-asset-policy-paused confirms the pause flag before and after the resume action.",
    rollbackStrategy: "Restore the emergency pause if the feed is still unsafe.",
    riskControls: [
      "DAO executor required for resuming feeds.",
      "Guardian cannot resume feeds; it only has negative pause authority.",
      "Readback prevents silently reactivating the wrong asset.",
    ],
    e2eScenario: "Governance composer and DAO policy tests verify pause and resume are curated DAO packages.",
    contractTarget: "oracle_guard",
  },
  {
    id: "executor-min-delay",
    category: "executor",
    severity: "critical",
    title: "Executor min delay",
    description: "Mutates governance executor min delay and restores prior value.",
    writeActionId: "executor-set-min-delay",
    writeMethod: "set_min_delay",
    readActionId: "executor-config",
    preconditions: [
      "GovernanceExecutor contract is configured and readable.",
      "New delay respects the DAO-approved safety window.",
      "Operator wallet is authorized for executor administration.",
    ],
    postStateAssertion: "Read executor config and require min_delay to equal the submitted value.",
    stateProbe: "executor-config confirms min_delay before and after mutation.",
    rollbackStrategy: "Restore the previous executor min_delay.",
    riskControls: [
      "Executor config readback is mandatory.",
      "Rollback restores prior timelock delay.",
      "Missing executor contract blocks the row entirely.",
    ],
    e2eScenario: "Wallet-backed E2E can run this when the executor contract is configured in testnet.",
    contractTarget: "governance_executor",
  },
  {
    id: "executor-grace-period",
    category: "executor",
    severity: "high",
    title: "Executor grace period",
    description: "Mutates governance executor grace period and restores prior value.",
    writeActionId: "executor-set-grace-period",
    writeMethod: "set_grace_period",
    readActionId: "executor-config",
    preconditions: [
      "GovernanceExecutor contract is configured and readable.",
      "New grace period respects the DAO-approved execution window.",
      "Operator wallet is authorized for executor administration.",
    ],
    postStateAssertion: "Read executor config and require grace_period to equal the submitted value.",
    stateProbe: "executor-config confirms grace_period before and after mutation.",
    rollbackStrategy: "Restore the previous executor grace_period.",
    riskControls: [
      "Executor config readback is mandatory.",
      "Rollback restores prior execution grace period.",
      "Missing executor contract blocks the row entirely.",
    ],
    e2eScenario: "Wallet-backed E2E can run this when executor administration is enabled for testnet.",
    contractTarget: "governance_executor",
  },
  {
    id: "executor-admin",
    category: "executor",
    severity: "critical",
    title: "Executor admin",
    description: "Rotates governance executor administrative authority.",
    writeActionId: "executor-set-admin",
    writeMethod: "set_admin",
    readActionId: "executor-config",
    preconditions: [
      "GovernanceExecutor contract is configured and readable.",
      "New admin address is validated against governance records.",
      "Operator wallet is authorized for executor administration.",
    ],
    postStateAssertion: "Read executor config and require admin to equal the submitted address.",
    stateProbe: "executor-config confirms admin authority.",
    rollbackStrategy: "Restore the previous executor admin address.",
    riskControls: [
      "Executor authority readback is mandatory.",
      "Rollback restores prior admin authority.",
      "Missing executor contract blocks the row entirely.",
    ],
    e2eScenario: "Executor E2E matrix validates admin rotation metadata and readiness gating.",
    contractTarget: "governance_executor",
    manualRunbookOnly: true,
  },
  {
    id: "executor-governor",
    category: "executor",
    severity: "critical",
    title: "Executor governor",
    description: "Rotates the governor that can schedule executor operations.",
    writeActionId: "executor-set-governor",
    writeMethod: "set_governor",
    readActionId: "executor-config",
    preconditions: [
      "GovernanceExecutor contract is configured and readable.",
      "New governor address is validated against Governor deployment records.",
      "Operator wallet is authorized for executor administration.",
    ],
    postStateAssertion: "Read executor config and require governor to equal the submitted address.",
    stateProbe: "executor-config confirms governor authority.",
    rollbackStrategy: "Restore the previous executor governor address.",
    riskControls: [
      "Executor governor readback is mandatory.",
      "Rollback restores prior scheduling authority.",
      "Missing executor contract blocks the row entirely.",
    ],
    e2eScenario: "Executor E2E matrix validates governor rotation readiness and authority metadata.",
    contractTarget: "governance_executor",
    manualRunbookOnly: true,
  },
];

const CATEGORIES: readonly ContractsMutationCategory[] = [
  "oracle",
  "fees",
  "policy",
  "venues",
  "coverage",
  "authority",
  "credit",
  "governance",
  "executor",
];

const SEVERITIES: readonly ContractsMutationSeverity[] = [
  "critical",
  "high",
  "medium",
];

function resolveContractTarget(target: ContractTarget): {
  contractId: string | null;
  contractRequirement: "runtime_input" | "configured";
  status: ContractsMutationStatus;
} {
  if (target === "runtime_arka") {
    return {
      contractId: null,
      contractRequirement: "runtime_input",
      status: "ready",
    };
  }

  const resolved =
    target === "arka_factory"
      ? ARKA_FACTORY
      : target === "arka_registry"
        ? ARKA_REGISTRY
        : target === "claims_manager"
          ? CLAIMS_MANAGER
          : target === "coverage_fund"
            ? COVERAGE_FUND
            : target === "coverage_vault"
              ? COVERAGE_VAULT
              : target === "locked_arka"
                ? LOCKED_ARKA
                : target === "manager_tier"
                  ? MANAGER_TIER
                  : target === "oracle_guard"
                    ? ORACLE_GUARD
                    : GOVERNANCE_EXECUTOR_ID;
  const contractId = resolved.trim();
  return {
    contractId: contractId.length > 0 ? contractId : null,
    contractRequirement: "configured",
    status: contractId.length > 0 ? "ready" : "blocked_missing_contract",
  };
}

function resolveExecutionLane(
  definition: ContractsMutationDefinition,
  status: ContractsMutationStatus,
  daoExecutorRequired: boolean,
): ContractsMutationExecutionLane {
  if (status !== "ready") {
    return status;
  }

  if (definition.contractTarget === "governance_executor") {
    return "wallet_backed";
  }

  return daoExecutorRequired ? "dao_executor" : "wallet_backed";
}

export function buildContractsMutationMatrixSnapshot(
  nowIso = new Date().toISOString(),
): ContractsMutationMatrixSnapshot {
  const entries = MUTATION_DEFINITIONS.map((definition) => {
    const target = resolveContractTarget(definition.contractTarget);
    const daoExecutorRequired = methodRequiresDaoExecutor(definition.writeMethod);
    const status =
      target.status === "ready" && definition.manualRunbookOnly
        ? "blocked_manual_runbook"
        : target.status;
    return {
      ...definition,
      rollbackActionId: definition.rollbackActionId ?? null,
      preconditions: [...definition.preconditions],
      riskControls: [...definition.riskControls],
      contractId: target.contractId,
      contractRequirement: target.contractRequirement,
      status,
      daoExecutorRequired,
      executionLane: resolveExecutionLane(definition, status, daoExecutorRequired),
    } satisfies ContractsMutationMatrixEntry;
  });

  const byCategory = Object.fromEntries(
    CATEGORIES.map((category) => [
      category,
      {
        total: 0,
        ready: 0,
        blocked: 0,
      },
    ]),
  ) as ContractsMutationMatrixSummary["byCategory"];

  const bySeverity = Object.fromEntries(
    SEVERITIES.map((severity) => [
      severity,
      {
        total: 0,
        ready: 0,
        blocked: 0,
      },
    ]),
  ) as ContractsMutationMatrixSummary["bySeverity"];

  for (const entry of entries) {
    byCategory[entry.category].total += 1;
    bySeverity[entry.severity].total += 1;
    if (entry.status === "ready") {
      byCategory[entry.category].ready += 1;
      bySeverity[entry.severity].ready += 1;
    } else {
      byCategory[entry.category].blocked += 1;
      bySeverity[entry.severity].blocked += 1;
    }
  }

  const ready = entries.filter((entry) => entry.status === "ready").length;
  const daoExecutorRequired = entries.filter((entry) => entry.executionLane === "dao_executor").length;
  const walletBackedExecutable = entries.filter((entry) => entry.executionLane === "wallet_backed").length;
  return {
    generatedAt: nowIso,
    entries,
    summary: {
      total: entries.length,
      ready,
      blocked: entries.length - ready,
      byCategory,
      bySeverity,
      daoExecutorRequired,
      walletBackedExecutable,
    },
  };
}

export function listCriticalMutationWriteActionIds(): string[] {
  return MUTATION_DEFINITIONS.map((entry) => entry.writeActionId);
}
