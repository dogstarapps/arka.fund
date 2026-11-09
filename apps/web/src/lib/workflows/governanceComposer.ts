import { Address, nativeToScVal, xdr } from "@stellar/stellar-sdk";
import {
  ARKA_ID,
  ARKA_FACTORY,
  ARKA_REGISTRY,
  CLAIMS_MANAGER,
  COVERAGE_FUND,
  COVERAGE_VAULT,
  GOVERNANCE_EXECUTOR_ID,
  GOVERNOR_ID,
  LOCKED_ARKA,
  MANAGER_TIER,
  ORACLE_GUARD,
} from "@/lib/config";
import { scValBytesN32 } from "@/lib/soroban";

export type GovernanceComposerFieldKind =
  | "address"
  | "optional_address"
  | "i32"
  | "i128"
  | "u32"
  | "u64"
  | "u128"
  | "bytesn32"
  | "bool"
  | "credit_protocol"
  | "csv_addresses";

export type GovernanceComposerFieldSpec = {
  key: string;
  label: string;
  kind: GovernanceComposerFieldKind;
  defaultValue?: string;
  placeholder?: string;
  presentation?: "percent_bps";
};

export type GovernanceComposerTemplate = {
  id: string;
  actionId: string;
  title: string;
  domain:
    | "Arka"
    | "ArkaFactory"
    | "ArkaRegistry"
    | "ClaimsManager"
    | "GovernanceExecutor"
    | "CoverageFund"
    | "CoverageVault"
    | "LockedArka"
    | "ManagerTier"
    | "OracleGuard"
    | "System";
  contractDefault: string;
  method: string;
  description: string;
  fields: GovernanceComposerFieldSpec[];
};

export type GovernanceComposerRawArg =
  | { type: "address"; value: string }
  | { type: "void" }
  | { type: "symbol"; value: string }
  | { type: "i32" | "i128" | "u32" | "u64" | "u128" | "bytesn32"; value: string }
  | { type: "bool"; value: boolean }
  | { type: "vec"; value: GovernanceComposerRawArg[] };

export type GovernedComposerDraft = {
  version: 1;
  kind: "governed-composer-draft";
  templateId: string;
  contractId: string;
  fieldValues: Record<string, string>;
  generatedAt: string;
  origin: string;
};

export type GovernedActionPackage = {
  version: 1;
  kind: "governed-action-package";
  templateId: string;
  actionId: string;
  title: string;
  description: string;
  domain: GovernanceComposerTemplate["domain"];
  contractId: string;
  method: string;
  generatedAt: string;
  fieldValues: Record<string, string>;
  args: GovernanceComposerRawArg[];
  governancePath: {
    owner: "Governor / executor";
    governorId: string;
    executorId: string;
    publicationMode: "governance_lane_prep";
    note: string;
  };
  reviewBullets: string[];
};

export const GOVERNED_ACTION_DRAFT_STORAGE_KEY = "arkafund.governedActionDraft";
export const GOVERNED_ACTION_DRAFT_QUERY = "governed-action";
export const GOVERNED_COMPOSER_DRAFT_STORAGE_KEY =
  "arkafund.governedComposerDraft";
export const GOVERNED_COMPOSER_DRAFT_QUERY = "governed-composer";
export const GOVERNED_PUBLICATION_DRAFT_STORAGE_KEY =
  "arkafund.governedPublicationDraft";
export const GOVERNED_PUBLICATION_DRAFT_QUERY = "governed-publication";

export type GovernanceHandoffLane = "composer" | "publication";

export type GovernanceHandoffState = {
  enabled: boolean;
  href: string | null;
  label: string;
  reason: string;
};

export type GovernanceComposerProductDecision = {
  version: 1;
  mode: "curated-governed-packages";
  label: string;
  operatorSummary: string;
  supportedTemplateCount: number;
  supportedActionIds: string[];
  supportedDomains: GovernanceComposerTemplate["domain"][];
  publicationLane: {
    mode: "staged-review-candidate";
    contractBacked: false;
    destination: "Contracts / executor review";
    copy: string;
  };
  genericExecutableBatch: {
    supported: false;
    requiredPrimitive: string;
    reason: string;
  };
  migrationRequests: {
    representation: "operator-runbook-or-curated-contract-backed-proposal";
    copy: string;
  };
};

export const GOVERNANCE_COMPOSER_STAGING_NOTE =
  "The current frontend can stage curated governed packages inside Governance and hand them off to Contracts / executor review. It does not publish arbitrary calldata or generic executable batches because the governor contract does not expose that primitive.";

export const GOVERNANCE_COMPOSER_REQUIRED_BATCH_PRIMITIVE =
  "Governor executable batch primitive accepting target contracts, methods, typed arguments and timelock/executor execution semantics.";

export function deriveGovernanceHandoffState({
  lane,
  packageReady,
}: {
  lane: GovernanceHandoffLane;
  packageReady: boolean;
}): GovernanceHandoffState {
  if (packageReady) {
    return {
      enabled: true,
      href: `/contracts?draft=${GOVERNED_ACTION_DRAFT_QUERY}`,
      label:
        lane === "composer"
          ? "Composer handoff ready"
          : "Publication handoff ready",
      reason:
        lane === "composer"
          ? "Built package can be opened in Contracts for executor review."
          : "Queued publication candidate can be opened in Contracts for executor review.",
    };
  }

  return {
    enabled: false,
    href: null,
    label: lane === "composer" ? "Build required" : "Queue required",
    reason:
      lane === "composer"
        ? "Build a governed package before opening the Contracts handoff."
        : "Queue a governed publication candidate before opening the Contracts handoff.",
  };
}

export const GOVERNED_ACTION_TEMPLATES: GovernanceComposerTemplate[] = [
  {
    id: "fees",
    actionId: "arka-set-fees",
    title: "Vault fees",
    domain: "Arka",
    contractDefault: ARKA_ID,
    method: "set_fees",
    description: "Govern vault management, performance, deposit and redemption fee percentages.",
    fields: [
      { key: "caller", label: "Caller", kind: "address" },
      { key: "mgmt_bps", label: "Management fee (%)", kind: "i32", defaultValue: "2.00", presentation: "percent_bps" },
      { key: "perf_bps", label: "Performance fee (%)", kind: "i32", defaultValue: "10.00", presentation: "percent_bps" },
      { key: "deposit_bps", label: "Deposit fee (%)", kind: "i32", defaultValue: "0.00", presentation: "percent_bps" },
      { key: "redeem_bps", label: "Redemption fee (%)", kind: "i32", defaultValue: "0.00", presentation: "percent_bps" },
    ],
  },
  {
    id: "protocol-fee-policy",
    actionId: "arka-set-protocol-fee-policy",
    title: "Protocol fee split",
    domain: "Arka",
    contractDefault: ARKA_ID,
    method: "set_protocol_fee_policy",
    description: "Set treasury participation across management and performance fee settlement.",
    fields: [
      { key: "caller", label: "Caller", kind: "address" },
      { key: "treasury", label: "Treasury", kind: "address" },
      { key: "mgmt_protocol_bps", label: "Management protocol share (%)", kind: "i32", defaultValue: "25.00", presentation: "percent_bps" },
      { key: "perf_protocol_bps", label: "Performance protocol share (%)", kind: "i32", defaultValue: "25.00", presentation: "percent_bps" },
    ],
  },
  {
    id: "whitelist",
    actionId: "arka-set-whitelist",
    title: "Vault whitelist",
    domain: "Arka",
    contractDefault: ARKA_ID,
    method: "set_whitelist",
    description: "Overwrite the full vault whitelist with the approved token set.",
    fields: [
      { key: "caller", label: "Caller", kind: "address" },
      {
        key: "whitelist_contracts",
        label: "Whitelist contracts (CSV)",
        kind: "csv_addresses",
        placeholder: "CA...,CB...",
      },
    ],
  },
  {
    id: "swap-risk-policy",
    actionId: "arka-set-swap-risk-policy",
    title: "Swap risk policy",
    domain: "Arka",
    contractDefault: ARKA_ID,
    method: "set_swap_risk_policy",
    description: "Govern price impact, slippage, oracle freshness and trade-size guardrails.",
    fields: [
      { key: "caller", label: "Caller", kind: "address" },
      { key: "enabled", label: "Enabled", kind: "bool", defaultValue: "true" },
      { key: "oracle_checks_enabled", label: "Oracle checks", kind: "bool", defaultValue: "true" },
      { key: "max_price_impact_bps", label: "Max price impact (%)", kind: "i32", defaultValue: "5.00", presentation: "percent_bps" },
      { key: "max_slippage_bps", label: "Max slippage (%)", kind: "i32", defaultValue: "10.00", presentation: "percent_bps" },
      { key: "max_twap_deviation_bps", label: "Max TWAP deviation (%)", kind: "i32", defaultValue: "10.00", presentation: "percent_bps" },
      { key: "max_oracle_age_seconds", label: "Max oracle age seconds", kind: "u64", defaultValue: "60" },
      { key: "max_trade_size_bps", label: "Max trade size (%)", kind: "i32", defaultValue: "10.00", presentation: "percent_bps" },
    ],
  },
  {
    id: "swap-oracle",
    actionId: "arka-set-swap-oracle",
    title: "Swap oracle pinning",
    domain: "Arka",
    contractDefault: ARKA_ID,
    method: "set_swap_oracle",
    description: "Pin the oracle contract used during swap safety checks.",
    fields: [
      { key: "caller", label: "Caller", kind: "address" },
      { key: "oracle", label: "Oracle", kind: "address" },
    ],
  },
  {
    id: "allowed-venues",
    actionId: "arka-set-allowed-venues",
    title: "Allowed venues",
    domain: "Arka",
    contractDefault: ARKA_ID,
    method: "set_allowed_venues",
    description: "Define the routers and adapters admitted in live rebalance execution.",
    fields: [
      { key: "caller", label: "Caller", kind: "address" },
      {
        key: "allowed_routers",
        label: "Allowed routers (CSV)",
        kind: "csv_addresses",
        placeholder: "CA...,CB...",
      },
      {
        key: "allowed_adapters",
        label: "Allowed adapters (CSV)",
        kind: "csv_addresses",
        placeholder: "CA...,CB...",
      },
    ],
  },
  {
    id: "manager-rotation",
    actionId: "arka-set-manager",
    title: "Manager rotation",
    domain: "Arka",
    contractDefault: ARKA_ID,
    method: "set_manager",
    description: "Rotate the current manager authority for the selected vault.",
    fields: [
      { key: "caller", label: "Caller", kind: "address" },
      { key: "manager", label: "Manager", kind: "address" },
    ],
  },
  {
    id: "router-binding",
    actionId: "arka-set-router",
    title: "Router binding",
    domain: "Arka",
    contractDefault: ARKA_ID,
    method: "set_router",
    description: "Change the vault-level router binding used by the execution lane.",
    fields: [
      { key: "caller", label: "Caller", kind: "address" },
      { key: "router", label: "Router", kind: "address" },
    ],
  },
  {
    id: "share-token-binding",
    actionId: "arka-set-share-token",
    title: "Share token binding",
    domain: "Arka",
    contractDefault: ARKA_ID,
    method: "set_share_token",
    description: "Attach or rotate the share token contract bound to the vault.",
    fields: [
      { key: "caller", label: "Caller", kind: "address" },
      { key: "share_token", label: "Share token", kind: "address" },
    ],
  },
  {
    id: "blend-risk-policy",
    actionId: "arka-set-blend-risk-policy",
    title: "Blend risk policy",
    domain: "Arka",
    contractDefault: ARKA_ID,
    method: "set_blend_risk_policy",
    description: "Govern oracle age, health factor and fail-close posture for a Blend market.",
    fields: [
      { key: "caller", label: "Caller", kind: "address" },
      { key: "market_id", label: "Market id", kind: "u128", defaultValue: "1" },
      { key: "max_oracle_age", label: "Max oracle age (s)", kind: "u64", defaultValue: "60" },
      { key: "min_health_factor", label: "Min health factor", kind: "i128", defaultValue: "12500000" },
      { key: "fail_close_nav", label: "Fail-close NAV", kind: "bool", defaultValue: "true" },
      { key: "fail_close_actions", label: "Fail-close actions", kind: "bool", defaultValue: "true" },
    ],
  },
  {
    id: "credit-market-config",
    actionId: "arka-configure-credit-market",
    title: "Credit market configuration",
    domain: "Arka",
    contractDefault: ARKA_ID,
    method: "configure_credit_market",
    description: "Govern protocol, adapter and capability posture for the selected credit market.",
    fields: [
      { key: "caller", label: "Caller", kind: "address" },
      { key: "protocol", label: "Protocol", kind: "credit_protocol", defaultValue: "Blend" },
      { key: "market_id", label: "Market id", kind: "u128", defaultValue: "1" },
      { key: "adapter", label: "Adapter", kind: "address" },
      { key: "allow_supply", label: "Allow supply", kind: "bool", defaultValue: "true" },
      { key: "allow_borrow", label: "Allow borrow", kind: "bool", defaultValue: "true" },
      { key: "allow_repay", label: "Allow repay", kind: "bool", defaultValue: "true" },
      { key: "allow_withdraw", label: "Allow withdraw", kind: "bool", defaultValue: "true" },
      { key: "enabled", label: "Enabled", kind: "bool", defaultValue: "true" },
    ],
  },
  {
    id: "vault-governor",
    actionId: "arka-set-governor",
    title: "Vault governor",
    domain: "Arka",
    contractDefault: ARKA_ID,
    method: "set_governor",
    description: "Govern the vault governor authority for protected policy and admin updates.",
    fields: [
      { key: "caller", label: "Caller", kind: "address" },
      { key: "governor", label: "Governor", kind: "address" },
    ],
  },
  {
    id: "executor-min-delay",
    actionId: "executor-set-min-delay",
    title: "Executor minimum delay",
    domain: "GovernanceExecutor",
    contractDefault: GOVERNANCE_EXECUTOR_ID,
    method: "set_min_delay",
    description: "Set the minimum timelock delay for delayed governance execution.",
    fields: [
      { key: "caller", label: "Caller", kind: "address" },
      { key: "min_delay", label: "Min delay", kind: "u32", defaultValue: "20" },
    ],
  },
  {
    id: "executor-grace-period",
    actionId: "executor-set-grace-period",
    title: "Executor grace period",
    domain: "GovernanceExecutor",
    contractDefault: GOVERNANCE_EXECUTOR_ID,
    method: "set_grace_period",
    description: "Set the execution grace window after the operation becomes ready.",
    fields: [
      { key: "caller", label: "Caller", kind: "address" },
      { key: "grace_period", label: "Grace period", kind: "u32", defaultValue: "120" },
    ],
  },
  {
    id: "executor-admin",
    actionId: "executor-set-admin",
    title: "Executor admin",
    domain: "GovernanceExecutor",
    contractDefault: GOVERNANCE_EXECUTOR_ID,
    method: "set_admin",
    description: "Govern the governance-executor admin authority for delayed execution operations.",
    fields: [
      { key: "caller", label: "Caller", kind: "address" },
      { key: "admin", label: "Admin", kind: "address" },
    ],
  },
  {
    id: "executor-governor",
    actionId: "executor-set-governor",
    title: "Executor governor",
    domain: "GovernanceExecutor",
    contractDefault: GOVERNANCE_EXECUTOR_ID,
    method: "set_governor",
    description: "Govern or clear the governor binding on the executor lane from the same authoring flow.",
    fields: [
      { key: "caller", label: "Caller", kind: "address" },
      {
        key: "governor",
        label: "Governor (optional)",
        kind: "optional_address",
      },
    ],
  },
  {
    id: "contract-upgrade",
    actionId: "contract-upgrade",
    title: "Contract WASM upgrade",
    domain: "System",
    contractDefault: ARKA_ID,
    method: "upgrade",
    description: "Prepare a governed contract upgrade against an audited WASM hash.",
    fields: [
      { key: "caller", label: "Caller", kind: "address" },
      { key: "new_wasm_hash", label: "WASM hash (bytes32 hex)", kind: "bytesn32" },
    ],
  },
  {
    id: "contract-bootstrap-admin",
    actionId: "contract-set-bootstrap-admin",
    title: "Bootstrap admin window",
    domain: "System",
    contractDefault: ARKA_ID,
    method: "set_bootstrap_admin",
    description: "Set the temporary bootstrap admin and expiry for contracts that keep bootstrap authority separate from manager/admin.",
    fields: [
      { key: "caller", label: "Caller", kind: "address" },
      { key: "admin", label: "Bootstrap admin", kind: "address" },
      { key: "expires_at", label: "Expires at", kind: "u64", defaultValue: "0" },
    ],
  },
  {
    id: "contract-bootstrap-admin-expiry",
    actionId: "contract-set-bootstrap-admin-expiry",
    title: "Bootstrap expiry",
    domain: "System",
    contractDefault: GOVERNANCE_EXECUTOR_ID,
    method: "set_bootstrap_admin_expiry",
    description: "Set the temporary admin expiry for admin-governed contracts.",
    fields: [
      { key: "caller", label: "Caller", kind: "address" },
      { key: "expires_at", label: "Expires at", kind: "u64", defaultValue: "0" },
    ],
  },
  {
    id: "contract-clear-bootstrap-admin",
    actionId: "contract-clear-bootstrap-admin",
    title: "Clear bootstrap admin",
    domain: "System",
    contractDefault: ARKA_ID,
    method: "clear_bootstrap_admin",
    description: "Remove a separate bootstrap admin after DAO handoff.",
    fields: [{ key: "caller", label: "Caller", kind: "address" }],
  },
  {
    id: "contract-clear-bootstrap-admin-expiry",
    actionId: "contract-clear-bootstrap-admin-expiry",
    title: "Clear bootstrap expiry",
    domain: "System",
    contractDefault: GOVERNANCE_EXECUTOR_ID,
    method: "clear_bootstrap_admin_expiry",
    description: "Clear the temporary admin expiry through the governor.",
    fields: [{ key: "caller", label: "Caller", kind: "address" }],
  },
  {
    id: "factory-implementation",
    actionId: "arka-factory-set-implementation",
    title: "Factory implementation",
    domain: "ArkaFactory",
    contractDefault: ARKA_FACTORY,
    method: "set_implementation",
    description: "Govern the canonical Arka implementation hash used for factory-backed migrations and new deployments.",
    fields: [
      {
        key: "impl_wasm_hash",
        label: "Implementation hash (bytes32 hex)",
        kind: "bytesn32",
      },
    ],
  },
  {
    id: "factory-governor",
    actionId: "arka-factory-set-governor",
    title: "Factory governor",
    domain: "ArkaFactory",
    contractDefault: ARKA_FACTORY,
    method: "set_governor",
    description: "Govern the factory governor authority used to rotate canonical implementations and policy.",
    fields: [{ key: "governor", label: "Governor", kind: "address" }],
  },
  {
    id: "factory-share-token-implementation",
    actionId: "arka-factory-set-share-token-implementation",
    title: "Share token implementation",
    domain: "ArkaFactory",
    contractDefault: ARKA_FACTORY,
    method: "set_share_token_implementation",
    description: "Govern the canonical share-token implementation hash used during migration and factory provisioning.",
    fields: [
      {
        key: "impl_wasm_hash",
        label: "Share-token hash (bytes32 hex)",
        kind: "bytesn32",
      },
    ],
  },
  {
    id: "factory-registry-binding",
    actionId: "arka-factory-set-registry",
    title: "Factory registry binding",
    domain: "ArkaFactory",
    contractDefault: ARKA_FACTORY,
    method: "set_registry",
    description: "Govern the external registry binding used as the canonical discovery route for factory-backed Arkas.",
    fields: [{ key: "registry", label: "Registry", kind: "address" }],
  },
  {
    id: "factory-protocol-treasury",
    actionId: "arka-factory-set-protocol-treasury",
    title: "Factory protocol treasury",
    domain: "ArkaFactory",
    contractDefault: ARKA_FACTORY,
    method: "set_protocol_treasury",
    description: "Govern the protocol treasury receiver injected into new factory-created Arkas.",
    fields: [{ key: "treasury", label: "Treasury", kind: "address" }],
  },
  {
    id: "factory-protocol-fee-splits",
    actionId: "arka-factory-set-protocol-fee-splits",
    title: "Factory protocol fee splits",
    domain: "ArkaFactory",
    contractDefault: ARKA_FACTORY,
    method: "set_protocol_fee_splits",
    description: "Govern the canonical management/performance protocol fee split percentages for new Arkas.",
    fields: [
      {
        key: "mgmt_protocol_bps",
        label: "Management protocol share (%)",
        kind: "i32",
        defaultValue: "25.00",
        presentation: "percent_bps",
      },
      {
        key: "perf_protocol_bps",
        label: "Performance protocol share (%)",
        kind: "i32",
        defaultValue: "25.00",
        presentation: "percent_bps",
      },
    ],
  },
  {
    id: "factory-creation-fee",
    actionId: "arka-factory-set-creation-fee",
    title: "Factory creation fee",
    domain: "ArkaFactory",
    contractDefault: ARKA_FACTORY,
    method: "set_creation_fee",
    description: "Govern the token and amount charged when creating a new Arka through the factory.",
    fields: [
      { key: "token", label: "Fee token", kind: "address" },
      {
        key: "amount",
        label: "Fee amount",
        kind: "i128",
        defaultValue: "0",
      },
    ],
  },
  {
    id: "registry-registrar",
    actionId: "arka-registry-set-registrar",
    title: "Registry registrar",
    domain: "ArkaRegistry",
    contractDefault: ARKA_REGISTRY,
    method: "set_registrar",
    description: "Govern registrar write access for the canonical Arka registry.",
    fields: [
      { key: "caller", label: "Caller", kind: "address" },
      { key: "registrar", label: "Registrar", kind: "address" },
      { key: "allowed", label: "Allowed", kind: "bool", defaultValue: "true" },
    ],
  },
  {
    id: "registry-manager-curated",
    actionId: "arka-registry-set-manager-curated",
    title: "Registry manager curated",
    domain: "ArkaRegistry",
    contractDefault: ARKA_REGISTRY,
    method: "set_manager_curated",
    description: "Govern whether a manager is marked as curated in the registry surface.",
    fields: [
      { key: "caller", label: "Caller", kind: "address" },
      { key: "manager", label: "Manager", kind: "address" },
      { key: "curated", label: "Curated", kind: "bool", defaultValue: "true" },
    ],
  },
  {
    id: "registry-delisted",
    actionId: "arka-registry-set-delisted",
    title: "Registry Arka delisted",
    domain: "ArkaRegistry",
    contractDefault: ARKA_REGISTRY,
    method: "set_delisted",
    description: "Govern whether an Arka is marked as delisted inside the registry.",
    fields: [
      { key: "caller", label: "Caller", kind: "address" },
      { key: "arka", label: "Arka", kind: "address" },
      { key: "delisted", label: "Delisted", kind: "bool", defaultValue: "true" },
    ],
  },
  {
    id: "coverage-economics-policy",
    actionId: "coverage-fund-set-economics-policy",
    title: "Coverage economics policy",
    domain: "CoverageFund",
    contractDefault: COVERAGE_FUND,
    method: "set_economics_policy",
    description: "Govern reserve retain, treasury share and reserve target policy for the coverage fund.",
    fields: [
      { key: "caller", label: "Caller", kind: "address" },
      {
        key: "reserve_retain_bps",
        label: "Reserve retain (%)",
        kind: "i32",
        defaultValue: "100.00",
        presentation: "percent_bps",
      },
      {
        key: "treasury_share_bps",
        label: "Treasury share (%)",
        kind: "i32",
        defaultValue: "0.00",
        presentation: "percent_bps",
      },
      {
        key: "reserve_target_bps",
        label: "Reserve target (%)",
        kind: "i32",
        defaultValue: "0.00",
        presentation: "percent_bps",
      },
    ],
  },
  {
    id: "coverage-governor",
    actionId: "coverage-fund-set-governor",
    title: "Coverage governor",
    domain: "CoverageFund",
    contractDefault: COVERAGE_FUND,
    method: "set_governor",
    description: "Govern the coverage-fund governor authority for policy and claims posture changes.",
    fields: [
      { key: "caller", label: "Caller", kind: "address" },
      { key: "governor", label: "Governor", kind: "address" },
    ],
  },
  {
    id: "coverage-claims-manager",
    actionId: "coverage-fund-set-claims-manager",
    title: "Coverage claims manager",
    domain: "CoverageFund",
    contractDefault: COVERAGE_FUND,
    method: "set_claims_manager",
    description: "Govern the claims-manager address for the coverage fund, or clear it when the lane should be unset.",
    fields: [
      { key: "caller", label: "Caller", kind: "address" },
      {
        key: "claims_manager",
        label: "Claims manager (optional)",
        kind: "optional_address",
      },
    ],
  },
  {
    id: "coverage-treasury",
    actionId: "coverage-fund-set-treasury",
    title: "Coverage treasury",
    domain: "CoverageFund",
    contractDefault: COVERAGE_FUND,
    method: "set_treasury",
    description: "Govern the treasury receiver for the coverage fund, or clear it when the lane should be unset.",
    fields: [
      { key: "caller", label: "Caller", kind: "address" },
      {
        key: "treasury",
        label: "Treasury (optional)",
        kind: "optional_address",
      },
    ],
  },
  {
    id: "claims-manager-treasury",
    actionId: "claims-manager-set-treasury",
    title: "Claims-manager treasury",
    domain: "ClaimsManager",
    contractDefault: CLAIMS_MANAGER,
    method: "set_treasury",
    description: "Govern the treasury fallback recipient for claims execution, or clear it when unset is intended.",
    fields: [
      { key: "caller", label: "Caller", kind: "address" },
      {
        key: "treasury",
        label: "Treasury (optional)",
        kind: "optional_address",
      },
    ],
  },
  {
    id: "claims-manager-governor",
    actionId: "claims-manager-set-governor",
    title: "Claims-manager governor",
    domain: "ClaimsManager",
    contractDefault: CLAIMS_MANAGER,
    method: "set_governor",
    description: "Govern the claims-manager governor authority for approvals and incident policy.",
    fields: [
      { key: "caller", label: "Caller", kind: "address" },
      { key: "governor", label: "Governor", kind: "address" },
    ],
  },
  {
    id: "claims-manager-risk-operator",
    actionId: "claims-manager-set-risk-operator",
    title: "Claims-manager risk operator",
    domain: "ClaimsManager",
    contractDefault: CLAIMS_MANAGER,
    method: "set_risk_operator",
    description: "Govern whether an operator can trigger incident workflows in the claims-manager lane.",
    fields: [
      { key: "caller", label: "Caller", kind: "address" },
      { key: "operator", label: "Operator", kind: "address" },
      { key: "enabled", label: "Enabled", kind: "bool", defaultValue: "true" },
    ],
  },
  {
    id: "claims-manager-register-covered-vault",
    actionId: "claims-manager-register-covered-vault",
    title: "Claims-manager covered vault",
    domain: "ClaimsManager",
    contractDefault: CLAIMS_MANAGER,
    method: "register_covered_vault",
    description: "Govern the covered-vault binding across manager vault, community fund and payout recipient.",
    fields: [
      { key: "caller", label: "Caller", kind: "address" },
      { key: "vault", label: "Vault", kind: "address" },
      { key: "manager_vault", label: "Manager vault", kind: "address" },
      { key: "community_fund", label: "Community fund", kind: "address" },
      { key: "recipient", label: "Recipient", kind: "address" },
    ],
  },
  {
    id: "coverage-covered-vault-policy",
    actionId: "coverage-fund-set-covered-vault-policy",
    title: "Covered vault policy",
    domain: "CoverageFund",
    contractDefault: COVERAGE_FUND,
    method: "set_covered_vault_policy",
    description: "Govern annual premium and coverage limit for one vault inside the coverage fund.",
    fields: [
      { key: "caller", label: "Caller", kind: "address" },
      { key: "vault", label: "Vault", kind: "address" },
      {
        key: "annual_premium_bps",
        label: "Annual premium (%)",
        kind: "i32",
        defaultValue: "2.00",
        presentation: "percent_bps",
      },
      {
        key: "coverage_limit",
        label: "Coverage limit",
        kind: "i128",
        defaultValue: "10000000",
      },
    ],
  },
  {
    id: "coverage-remove-covered-vault",
    actionId: "coverage-fund-remove-covered-vault",
    title: "Coverage remove covered vault",
    domain: "CoverageFund",
    contractDefault: COVERAGE_FUND,
    method: "remove_covered_vault",
    description: "Govern removal of one covered-vault policy and its associated accounting lane.",
    fields: [
      { key: "caller", label: "Caller", kind: "address" },
      { key: "vault", label: "Vault", kind: "address" },
    ],
  },
  {
    id: "coverage-vault-governor",
    actionId: "coverage-vault-set-governor",
    title: "Coverage vault governor",
    domain: "CoverageVault",
    contractDefault: COVERAGE_VAULT,
    method: "set_governor",
    description: "Govern the coverage-vault governor authority for payout and lock controls.",
    fields: [
      { key: "caller", label: "Caller", kind: "address" },
      { key: "governor", label: "Governor", kind: "address" },
    ],
  },
  {
    id: "coverage-vault-claims-manager",
    actionId: "coverage-vault-set-claims-manager",
    title: "Coverage vault claims manager",
    domain: "CoverageVault",
    contractDefault: COVERAGE_VAULT,
    method: "set_claims_manager",
    description: "Govern the claims-manager address for the coverage vault, or clear it when the lane should be unset.",
    fields: [
      { key: "caller", label: "Caller", kind: "address" },
      {
        key: "claims_manager",
        label: "Claims manager (optional)",
        kind: "optional_address",
      },
    ],
  },
  {
    id: "coverage-lock-bps",
    actionId: "coverage-vault-set-lock-bps",
    title: "Coverage vault lock ratio",
    domain: "CoverageVault",
    contractDefault: COVERAGE_VAULT,
    method: "set_lock_bps",
    description: "Govern the manager lock ratio enforced by the coverage vault.",
    fields: [
      { key: "caller", label: "Caller", kind: "address" },
      { key: "lock_bps", label: "Lock ratio (%)", kind: "i32", defaultValue: "30.00", presentation: "percent_bps" },
    ],
  },
  {
    id: "manager-tier-governor",
    actionId: "manager-tier-set-governor",
    title: "Manager-tier governor",
    domain: "ManagerTier",
    contractDefault: MANAGER_TIER,
    method: "set_governor",
    description: "Govern the manager-tier governor authority for threshold and point policy.",
    fields: [
      { key: "caller", label: "Caller", kind: "address" },
      { key: "governor", label: "Governor", kind: "address" },
    ],
  },
  {
    id: "manager-tier-thresholds",
    actionId: "manager-tier-set-thresholds",
    title: "Manager-tier thresholds",
    domain: "ManagerTier",
    contractDefault: MANAGER_TIER,
    method: "set_thresholds",
    description: "Govern the tier1, tier2 and tier3 threshold cut-offs used by manager reputation.",
    fields: [
      { key: "caller", label: "Caller", kind: "address" },
      { key: "tier1_threshold", label: "Tier 1 threshold", kind: "i128", defaultValue: "100" },
      { key: "tier2_threshold", label: "Tier 2 threshold", kind: "i128", defaultValue: "500" },
      { key: "tier3_threshold", label: "Tier 3 threshold", kind: "i128", defaultValue: "1000" },
    ],
  },
  {
    id: "manager-tier-set-points",
    actionId: "manager-tier-set-points",
    title: "Manager-tier set points",
    domain: "ManagerTier",
    contractDefault: MANAGER_TIER,
    method: "set_points",
    description: "Govern the absolute point balance assigned to one manager.",
    fields: [
      { key: "caller", label: "Caller", kind: "address" },
      { key: "manager", label: "Manager", kind: "address" },
      { key: "points", label: "Points", kind: "i128", defaultValue: "0" },
    ],
  },
  {
    id: "manager-tier-add-points",
    actionId: "manager-tier-add-points",
    title: "Manager-tier add points",
    domain: "ManagerTier",
    contractDefault: MANAGER_TIER,
    method: "add_points",
    description: "Govern a signed delta applied to one manager point balance.",
    fields: [
      { key: "caller", label: "Caller", kind: "address" },
      { key: "manager", label: "Manager", kind: "address" },
      { key: "delta", label: "Delta", kind: "i128", defaultValue: "100" },
    ],
  },
  {
    id: "locked-arka-admin",
    actionId: "locked-arka-set-admin",
    title: "Locked ARKA admin",
    domain: "LockedArka",
    contractDefault: LOCKED_ARKA,
    method: "set_admin",
    description: "Govern the locked-ARKA admin authority used for vote-lock administration.",
    fields: [
      { key: "caller", label: "Caller", kind: "address" },
      { key: "admin", label: "Admin", kind: "address" },
    ],
  },
  {
    id: "locked-arka-governor",
    actionId: "locked-arka-set-governor",
    title: "Locked ARKA governor",
    domain: "LockedArka",
    contractDefault: LOCKED_ARKA,
    method: "set_governor",
    description: "Govern the locked-ARKA governor authority for vote-sequence management.",
    fields: [
      { key: "caller", label: "Caller", kind: "address" },
      { key: "governor", label: "Governor", kind: "address" },
    ],
  },
  {
    id: "oracle-guard-admin",
    actionId: "oracle-guard-set-admin",
    title: "Oracle-guard admin",
    domain: "OracleGuard",
    contractDefault: ORACLE_GUARD,
    method: "set_admin",
    description: "Govern the oracle-guard admin authority for source policy updates.",
    fields: [
      { key: "caller", label: "Caller", kind: "address" },
      { key: "admin", label: "Admin", kind: "address" },
    ],
  },
  {
    id: "oracle-guard-guardian",
    actionId: "oracle-guard-set-guardian",
    title: "Oracle-guard guardian",
    domain: "OracleGuard",
    contractDefault: ORACLE_GUARD,
    method: "set_guardian",
    description: "Govern the emergency guardian and its expiry for oracle feed pauses.",
    fields: [
      { key: "caller", label: "Caller", kind: "address" },
      { key: "guardian", label: "Guardian multisig", kind: "address" },
      { key: "expires_at", label: "Expires at", kind: "u64", defaultValue: "0" },
    ],
  },
  {
    id: "oracle-guard-clear-guardian",
    actionId: "oracle-guard-clear-guardian",
    title: "Oracle-guard clear guardian",
    domain: "OracleGuard",
    contractDefault: ORACLE_GUARD,
    method: "clear_guardian",
    description: "Remove the emergency guardian after DAO handoff or expiry replacement.",
    fields: [{ key: "caller", label: "Caller", kind: "address" }],
  },
  {
    id: "oracle-guard-stellar-asset-policy",
    actionId: "oracle-guard-set-stellar-asset-policy",
    title: "Oracle-guard stellar asset policy",
    domain: "OracleGuard",
    contractDefault: ORACLE_GUARD,
    method: "set_stellar_asset_policy",
    description: "Govern primary/secondary oracle policy for one Stellar asset.",
    fields: [
      { key: "caller", label: "Caller", kind: "address" },
      { key: "asset", label: "Asset", kind: "address" },
      { key: "primary", label: "Primary oracle", kind: "address" },
      { key: "secondary", label: "Secondary oracle", kind: "address" },
      { key: "has_secondary", label: "Has secondary", kind: "bool", defaultValue: "true" },
      { key: "max_price_age", label: "Max price age (s)", kind: "u64", defaultValue: "60" },
      { key: "max_deviation_bps", label: "Max deviation (%)", kind: "u32", defaultValue: "5.00", presentation: "percent_bps" },
      { key: "require_secondary", label: "Require secondary", kind: "bool", defaultValue: "false" },
      { key: "divergence_mode", label: "Divergence mode", kind: "u32", defaultValue: "1" },
    ],
  },
  {
    id: "oracle-guard-clear-stellar-asset-policy",
    actionId: "oracle-guard-clear-stellar-asset-policy",
    title: "Oracle-guard clear stellar asset policy",
    domain: "OracleGuard",
    contractDefault: ORACLE_GUARD,
    method: "clear_stellar_asset_policy",
    description: "Clear oracle policy for one Stellar asset feed.",
    fields: [
      { key: "caller", label: "Caller", kind: "address" },
      { key: "asset", label: "Asset", kind: "address" },
    ],
  },
  {
    id: "oracle-guard-resume-stellar-asset-policy",
    actionId: "oracle-guard-resume-stellar-asset-policy",
    title: "Oracle-guard resume stellar asset policy",
    domain: "OracleGuard",
    contractDefault: ORACLE_GUARD,
    method: "resume_stellar_asset_policy",
    description: "Reactivate one Stellar asset feed after DAO review of an emergency pause.",
    fields: [
      { key: "caller", label: "Caller", kind: "address" },
      { key: "asset", label: "Asset", kind: "address" },
    ],
  },
  {
    id: "oracle-guard-pause-stellar-asset-policy",
    actionId: "oracle-guard-pause-stellar-asset-policy",
    title: "Oracle-guard pause stellar asset policy",
    domain: "OracleGuard",
    contractDefault: ORACLE_GUARD,
    method: "pause_stellar_asset_policy",
    description: "Pause one Stellar asset feed during oracle incident response.",
    fields: [
      { key: "caller", label: "Caller", kind: "address" },
      { key: "asset", label: "Asset", kind: "address" },
    ],
  },
];

export function buildGovernanceComposerProductDecision(
  templates: GovernanceComposerTemplate[] = GOVERNED_ACTION_TEMPLATES,
): GovernanceComposerProductDecision {
  const supportedDomains = Array.from(
    new Set(templates.map((template) => template.domain)),
  ).sort() as GovernanceComposerTemplate["domain"][];

  return {
    version: 1,
    mode: "curated-governed-packages",
    label: "Curated governed packages only",
    operatorSummary:
      "Operators can author contract-backed governed actions from vetted templates, stage one candidate in Governance and hand it off to Contracts / executor review.",
    supportedTemplateCount: templates.length,
    supportedActionIds: templates.map((template) => template.actionId),
    supportedDomains,
    publicationLane: {
      mode: "staged-review-candidate",
      contractBacked: false,
      destination: "Contracts / executor review",
      copy:
        "The queue keeps one reviewed package in the Governance console. It is not an on-chain publish action.",
    },
    genericExecutableBatch: {
      supported: false,
      requiredPrimitive: GOVERNANCE_COMPOSER_REQUIRED_BATCH_PRIMITIVE,
      reason:
        "The governor contract currently exposes proposal lifecycle actions, but not a safe arbitrary target/method/args batch publication endpoint.",
    },
    migrationRequests: {
      representation: "operator-runbook-or-curated-contract-backed-proposal",
      copy:
        "Migration requests must either remain an operator runbook handoff or use one of the curated contract-backed proposal templates.",
    },
  };
}

export function inputModeForGovernedField(
  field: GovernanceComposerFieldSpec,
): "text" | "numeric" | "decimal" {
  if (field.presentation === "percent_bps") {
    return "decimal";
  }
  switch (field.kind) {
    case "i32":
    case "i128":
    case "u32":
    case "u64":
    case "u128":
      return "numeric";
    default:
      return "text";
  }
}

export function buildGovernedTemplateInitialValues(
  template: GovernanceComposerTemplate,
  fallbackCaller: string,
): Record<string, string> {
  const values: Record<string, string> = {};
  for (const field of template.fields) {
    if (field.key === "caller" && fallbackCaller) {
      values[field.key] = fallbackCaller;
      continue;
    }
    values[field.key] = field.defaultValue ?? "";
  }
  return values;
}

function parseInteger(raw: string, label: string): string {
  const value = raw.trim();
  if (!value) throw new Error(`${label}: required`);
  if (!/^-?\d+$/.test(value)) throw new Error(`${label}: expected integer`);
  return value;
}

function parsePercentBps(raw: string, label: string): string {
  const value = raw.trim().replace(/%$/, "").trim();
  if (!value) throw new Error(`${label}: required`);
  if (!/^\d+(\.\d{1,4})?$/.test(value)) {
    throw new Error(`${label}: expected percentage`);
  }
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric < 0 || numeric > 100) {
    throw new Error(`${label}: expected percentage between 0 and 100`);
  }
  return String(Math.round(numeric * 100));
}

function normalizePercentDisplay(raw: string, label: string): string {
  const value = raw.trim().replace(/%$/, "").trim();
  if (!value) throw new Error(`${label}: required`);
  if (!/^\d+(\.\d{1,4})?$/.test(value)) {
    throw new Error(`${label}: expected percentage`);
  }
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric < 0 || numeric > 100) {
    throw new Error(`${label}: expected percentage between 0 and 100`);
  }
  return numeric.toFixed(2);
}

function parseAddress(raw: string, label: string): string {
  const value = raw.trim();
  if (!value) throw new Error(`${label}: required`);
  return value;
}

function normalizeBytes32(raw: string, label: string): string {
  const value = raw.trim().replace(/^0x/, "");
  if (!/^[0-9a-fA-F]{64}$/.test(value)) {
    throw new Error(`${label}: expected 32-byte hex value`);
  }
  return value.toLowerCase();
}

function parseCsvAddresses(raw: string, label: string): string[] {
  const values = raw
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
  if (values.length === 0) {
    throw new Error(`${label}: add at least one address`);
  }
  return values;
}

function toMachineArg(
  field: GovernanceComposerFieldSpec,
  rawValue: string,
): GovernanceComposerRawArg {
  const machineValue =
    field.presentation === "percent_bps"
      ? parsePercentBps(rawValue, field.label)
      : rawValue;
  switch (field.kind) {
    case "address":
      return { type: "address", value: parseAddress(machineValue, field.label) };
    case "optional_address": {
      const value = machineValue.trim();
      return value ? { type: "address", value: parseAddress(value, field.label) } : { type: "void" };
    }
    case "i32":
      return { type: "i32", value: parseInteger(machineValue, field.label) };
    case "i128":
      return { type: "i128", value: parseInteger(machineValue, field.label) };
    case "u32":
      return { type: "u32", value: parseInteger(machineValue, field.label) };
    case "u64":
      return { type: "u64", value: parseInteger(machineValue, field.label) };
    case "u128":
      return { type: "u128", value: parseInteger(machineValue, field.label) };
    case "bytesn32":
      return { type: "bytesn32", value: normalizeBytes32(machineValue, field.label) };
    case "bool":
      return { type: "bool", value: machineValue.trim() === "true" };
    case "credit_protocol":
      return {
        type: "vec",
        value: [{ type: "symbol", value: machineValue.trim() || "Blend" }],
      };
    case "csv_addresses":
      return {
        type: "vec",
        value: parseCsvAddresses(machineValue, field.label).map((address) => ({
          type: "address",
          value: address,
        })),
      };
  }
}

export function governedRawArgToScVal(arg: GovernanceComposerRawArg): xdr.ScVal {
  switch (arg.type) {
    case "address":
      return xdr.ScVal.scvAddress(Address.fromString(arg.value).toScAddress());
    case "void":
      return xdr.ScVal.scvVoid();
    case "bool":
      return nativeToScVal(arg.value, { type: "bool" });
    case "symbol":
      return xdr.ScVal.scvSymbol(arg.value);
    case "i32":
      return nativeToScVal(Number(arg.value), { type: "i32" });
    case "u32":
      return nativeToScVal(Number(arg.value), { type: "u32" });
    case "u64":
      return nativeToScVal(BigInt(arg.value), { type: "u64" });
    case "i128":
      return nativeToScVal(BigInt(arg.value), { type: "i128" });
    case "u128":
      return nativeToScVal(BigInt(arg.value), { type: "u128" });
    case "bytesn32":
      return scValBytesN32(arg.value);
    case "vec":
      return xdr.ScVal.scvVec(arg.value.map((entry) => governedRawArgToScVal(entry)));
  }
}

export function governedArgsToScVals(
  args: GovernanceComposerRawArg[],
): xdr.ScVal[] {
  return args.map((arg) => governedRawArgToScVal(arg));
}

export function buildGovernedActionPackage(input: {
  template: GovernanceComposerTemplate;
  contractId: string;
  fieldValues: Record<string, string>;
}): GovernedActionPackage {
  const contractId = input.contractId.trim();
  if (!contractId) {
    throw new Error("Target contract: required");
  }

  const args = input.template.fields.map((field) =>
    toMachineArg(field, input.fieldValues[field.key] ?? ""),
  );

  const normalizedFieldValues = Object.fromEntries(
    input.template.fields.map((field) => [field.key, (input.fieldValues[field.key] ?? "").trim()]),
  );

  const reviewBullets = [
    `Template: ${input.template.title}`,
    `Action id: ${input.template.actionId}`,
    `Domain: ${input.template.domain}`,
    `Action: ${input.template.title}`,
    `Target contract: ${contractId}`,
    `Governance path: Governor ${GOVERNOR_ID} -> Executor ${GOVERNANCE_EXECUTOR_ID}`,
  ];

  return {
    version: 1,
    kind: "governed-action-package",
    templateId: input.template.id,
    actionId: input.template.actionId,
    title: input.template.title,
    description: input.template.description,
    domain: input.template.domain,
    contractId,
    method: input.template.method,
    generatedAt: new Date().toISOString(),
    fieldValues: normalizedFieldValues,
    args,
    governancePath: {
      owner: "Governor / executor",
      governorId: GOVERNOR_ID,
      executorId: GOVERNANCE_EXECUTOR_ID,
      publicationMode: "governance_lane_prep",
      note: GOVERNANCE_COMPOSER_STAGING_NOTE,
    },
    reviewBullets,
  };
}

export function serializeGovernedActionPackage(
  pkg: GovernedActionPackage,
): string {
  return JSON.stringify(pkg, null, 2);
}

export function writeGovernedActionDraft(pkg: GovernedActionPackage): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(
    GOVERNED_ACTION_DRAFT_STORAGE_KEY,
    serializeGovernedActionPackage(pkg),
  );
}

export function readGovernedActionDraft(): GovernedActionPackage | null {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(GOVERNED_ACTION_DRAFT_STORAGE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as GovernedActionPackage;
  } catch {
    return null;
  }
}

export function writeGovernedPublicationDraft(
  pkg: GovernedActionPackage,
): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(
    GOVERNED_PUBLICATION_DRAFT_STORAGE_KEY,
    serializeGovernedActionPackage(pkg),
  );
}

export function readGovernedPublicationDraft(): GovernedActionPackage | null {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(GOVERNED_PUBLICATION_DRAFT_STORAGE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as GovernedActionPackage;
  } catch {
    return null;
  }
}

export function clearGovernedPublicationDraft(): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(GOVERNED_PUBLICATION_DRAFT_STORAGE_KEY);
}

function normalizeDraftFieldValue(
  field: GovernanceComposerFieldSpec,
  rawValue: string,
): string {
  if (field.presentation === "percent_bps") {
    return normalizePercentDisplay(rawValue, field.label);
  }
  switch (field.kind) {
    case "address":
      return parseAddress(rawValue, field.label);
    case "optional_address":
      return rawValue.trim() ? parseAddress(rawValue, field.label) : "";
    case "i32":
    case "i128":
    case "u32":
    case "u64":
    case "u128":
      return parseInteger(rawValue, field.label);
    case "bool":
      return rawValue.trim() === "true" ? "true" : "false";
    case "credit_protocol":
      return rawValue.trim() || "Blend";
    case "bytesn32":
      return normalizeBytes32(rawValue, field.label);
    case "csv_addresses":
      return parseCsvAddresses(rawValue, field.label).join(",");
  }
}

export function buildGovernedComposerDraft(input: {
  template: GovernanceComposerTemplate;
  contractId: string;
  fieldValues: Record<string, string>;
  origin: string;
}): GovernedComposerDraft {
  const contractId = input.contractId.trim();
  if (!contractId) {
    throw new Error("Target contract: required");
  }

  const fieldValues = Object.fromEntries(
    input.template.fields.map((field) => [
      field.key,
      normalizeDraftFieldValue(field, input.fieldValues[field.key] ?? ""),
    ]),
  );

  return {
    version: 1,
    kind: "governed-composer-draft",
    templateId: input.template.id,
    contractId,
    fieldValues,
    generatedAt: new Date().toISOString(),
    origin: input.origin,
  };
}

export function buildGovernedComposerDraftFromPackage(
  pkg: GovernedActionPackage,
  origin: string,
): GovernedComposerDraft {
  const template = GOVERNED_ACTION_TEMPLATES.find(
    (entry) => entry.id === pkg.templateId,
  );
  if (!template) {
    throw new Error(`Unknown governed template ${pkg.templateId}.`);
  }
  return buildGovernedComposerDraft({
    template,
    contractId: pkg.contractId,
    fieldValues: pkg.fieldValues,
    origin,
  });
}

export function writeGovernedComposerDraft(
  draft: GovernedComposerDraft,
): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(
    GOVERNED_COMPOSER_DRAFT_STORAGE_KEY,
    JSON.stringify(draft),
  );
}

export function readGovernedComposerDraft(): GovernedComposerDraft | null {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(GOVERNED_COMPOSER_DRAFT_STORAGE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as GovernedComposerDraft;
  } catch {
    return null;
  }
}
