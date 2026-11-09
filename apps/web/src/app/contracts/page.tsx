"use client";

import type { StellarWalletsKit } from "@creit.tech/stellar-wallets-kit";
import { Address, nativeToScVal, xdr } from "@stellar/stellar-sdk";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ActionField,
  Panel,
  StatusPill,
  SurfaceTable,
  TransactionConfirmDialog,
  TransactionFeedbackRail,
  TransactionReviewCard,
} from "@/components/product/surfacePrimitives";
import { buildContractsMutationMatrixSnapshot } from "@/lib/contracts/mutationMatrix";
import { buildContractsSecurityAuditSnapshot } from "@/lib/contracts/securityAudit";
import { buildContractsStorageLifecycleSnapshot } from "@/lib/contracts/storageLifecycle";
import {
  ADAPTER_BLEND,
  ARKA_FACTORY,
  ARKA_ID,
  ARKA_REGISTRY,
  BLEND_MARKET_ID,
  CLAIMS_MANAGER,
  COVERAGE_FUND,
  COVERAGE_VAULT,
  DENOMINATION,
  GOVERNANCE_EXECUTOR_ID,
  LOCKED_ARKA,
  MANAGER_TIER,
  ORACLE_GUARD,
} from "@/lib/config";
import {
  buildContractInvokeRaw,
  scValBytesN32,
  scValToNative,
  simulateContractReadonly,
} from "@/lib/soroban";
import { signXdr, submitSignedTx, waitForTx } from "@/lib/tx";
import {
  connectWallet,
  getWalletsKit,
  persistWalletPubkey,
} from "@/lib/walletKit";
import {
  GOVERNED_ACTION_DRAFT_QUERY,
  GOVERNED_ACTION_DRAFT_STORAGE_KEY,
  readGovernedActionDraft,
  type GovernedActionPackage,
} from "@/lib/workflows/governanceComposer";
import { shouldBlockRawWrite, shouldBlockTypedWrite } from "@/lib/workflows/daoExecutionPolicy";

type FieldKind =
  | "address"
  | "optional_address"
  | "i128"
  | "u128"
  | "u64"
  | "u32"
  | "i32"
  | "bool"
  | "string"
  | "credit_protocol"
  | "incident_class"
  | "csv_addresses"
  | "bytesn32";

type FieldSpec = {
  key: string;
  label: string;
  kind: FieldKind;
  defaultValue?: string;
  placeholder?: string;
  presentation?: "percent_bps";
};

type ActionSpec = {
  id: string;
  title: string;
  domain:
    | "Arka"
    | "ArkaFactory"
    | "ArkaRegistry"
    | "CoverageFund"
    | "CoverageVault"
    | "ClaimsManager"
    | "LockedArka"
    | "ManagerTier"
    | "OracleGuard"
    | "GovernanceExecutor"
    | "System";
  contractDefault: string;
  method: string;
  mode: "write" | "read";
  description: string;
  fields: FieldSpec[];
};

type StatusPillTone = "neutral" | "positive" | "warning" | "critical";

function formatMutationLane(lane: string): string {
  if (lane === "dao_executor") return "DAO executor";
  if (lane === "wallet_backed") return "Wallet backed";
  if (lane === "blocked_missing_contract") return "Blocked";
  if (lane === "blocked_manual_runbook") return "Blocked runbook";
  return lane.replaceAll("_", " ");
}

function mutationSeverityTone(severity: string): StatusPillTone {
  if (severity === "critical") return "critical";
  if (severity === "high") return "warning";
  return "neutral";
}

function mutationLaneTone(lane: string): StatusPillTone {
  if (lane === "wallet_backed") return "positive";
  if (lane === "dao_executor") return "warning";
  return "critical";
}

function securityAuditSeverityTone(severity: string): StatusPillTone {
  if (severity === "critical") return "critical";
  if (severity === "high") return "warning";
  return "neutral";
}

function securityAuditStatusTone(status: string): StatusPillTone {
  if (status === "resolved" || status === "passed") return "positive";
  if (status === "accepted_risk") return "warning";
  return "critical";
}

const ACTIONS: ActionSpec[] = [
  {
    id: "arka-set-governor",
    title: "Set governor",
    domain: "Arka",
    contractDefault: ARKA_ID,
    method: "set_governor",
    mode: "write",
    description: "Assign policy governor for the vault.",
    fields: [
      { key: "caller", label: "Caller", kind: "address" },
      { key: "governor", label: "Governor", kind: "address" },
    ],
  },
  {
    id: "arka-set-fees",
    title: "Set fees",
    domain: "Arka",
    contractDefault: ARKA_ID,
    method: "set_fees",
    mode: "write",
    description: "Update management, performance, deposit and redemption fee percentages.",
    fields: [
      { key: "caller", label: "Caller", kind: "address" },
      { key: "mgmt_bps", label: "Management fee (%)", kind: "i32", defaultValue: "2.00", presentation: "percent_bps" },
      { key: "perf_bps", label: "Performance fee (%)", kind: "i32", defaultValue: "10.00", presentation: "percent_bps" },
      { key: "deposit_bps", label: "Deposit fee (%)", kind: "i32", defaultValue: "0.00", presentation: "percent_bps" },
      { key: "redeem_bps", label: "Redemption fee (%)", kind: "i32", defaultValue: "0.00", presentation: "percent_bps" },
    ],
  },
  {
    id: "arka-set-protocol-fee-policy",
    title: "Set protocol fee policy",
    domain: "Arka",
    contractDefault: ARKA_ID,
    method: "set_protocol_fee_policy",
    mode: "write",
    description: "Set treasury and protocol fee split percentages.",
    fields: [
      { key: "caller", label: "Caller", kind: "address" },
      { key: "treasury", label: "Treasury", kind: "address" },
      { key: "mgmt_protocol_bps", label: "Management protocol share (%)", kind: "i32", defaultValue: "25.00", presentation: "percent_bps" },
      { key: "perf_protocol_bps", label: "Performance protocol share (%)", kind: "i32", defaultValue: "25.00", presentation: "percent_bps" },
    ],
  },
  {
    id: "arka-set-whitelist",
    title: "Set whitelist",
    domain: "Arka",
    contractDefault: ARKA_ID,
    method: "set_whitelist",
    mode: "write",
    description: "Overwrite the full whitelist with a CSV of token contracts.",
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
    id: "arka-set-swap-risk-policy",
    title: "Set swap risk policy",
    domain: "Arka",
    contractDefault: ARKA_ID,
    method: "set_swap_risk_policy",
    mode: "write",
    description: "Set risk guardrails for rebalance swaps.",
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
    id: "arka-set-swap-oracle",
    title: "Set swap oracle",
    domain: "Arka",
    contractDefault: ARKA_ID,
    method: "set_swap_oracle",
    mode: "write",
    description: "Pin the oracle contract used for swap checks.",
    fields: [
      { key: "caller", label: "Caller", kind: "address" },
      { key: "oracle", label: "Oracle", kind: "address" },
    ],
  },
  {
    id: "arka-set-allowed-venues",
    title: "Set allowed venues",
    domain: "Arka",
    contractDefault: ARKA_ID,
    method: "set_allowed_venues",
    mode: "write",
    description: "Set allowed routers and adapters for on-chain execution.",
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
    id: "arka-set-manager",
    title: "Set manager",
    domain: "Arka",
    contractDefault: ARKA_ID,
    method: "set_manager",
    mode: "write",
    description: "Rotate manager authority for the vault.",
    fields: [
      { key: "caller", label: "Caller", kind: "address" },
      { key: "manager", label: "Manager", kind: "address" },
    ],
  },
  {
    id: "arka-set-router",
    title: "Set router",
    domain: "Arka",
    contractDefault: ARKA_ID,
    method: "set_router",
    mode: "write",
    description: "Set internal router contract used in rebalance.",
    fields: [
      { key: "caller", label: "Caller", kind: "address" },
      { key: "router", label: "Router", kind: "address" },
    ],
  },
  {
    id: "arka-set-share-token",
    title: "Set share token",
    domain: "Arka",
    contractDefault: ARKA_ID,
    method: "set_share_token",
    mode: "write",
    description: "Attach or rotate the share token contract.",
    fields: [
      { key: "caller", label: "Caller", kind: "address" },
      { key: "share_token", label: "Share token", kind: "address" },
    ],
  },
  {
    id: "arka-set-blend-risk-policy",
    title: "Set blend risk policy",
    domain: "Arka",
    contractDefault: ARKA_ID,
    method: "set_blend_risk_policy",
    mode: "write",
    description: "Set oracle age and health-factor guardrails for a Blend market.",
    fields: [
      { key: "caller", label: "Caller", kind: "address" },
      { key: "market_id", label: "Market id", kind: "u128", defaultValue: String(BLEND_MARKET_ID) },
      { key: "max_oracle_age", label: "Max oracle age (s)", kind: "u64", defaultValue: "60" },
      { key: "min_health_factor", label: "Min health factor", kind: "i128", defaultValue: "12500000" },
      { key: "fail_close_nav", label: "Fail-close NAV", kind: "bool", defaultValue: "true" },
      { key: "fail_close_actions", label: "Fail-close actions", kind: "bool", defaultValue: "true" },
    ],
  },
  {
    id: "arka-configure-credit-market",
    title: "Configure credit market",
    domain: "Arka",
    contractDefault: ARKA_ID,
    method: "configure_credit_market",
    mode: "write",
    description: "Configure market adapter and capabilities for the selected credit protocol.",
    fields: [
      { key: "caller", label: "Caller", kind: "address" },
      { key: "protocol", label: "Protocol", kind: "credit_protocol", defaultValue: "Blend" },
      { key: "market_id", label: "Market id", kind: "u128", defaultValue: String(BLEND_MARKET_ID) },
      { key: "adapter", label: "Adapter", kind: "address", defaultValue: ADAPTER_BLEND },
      { key: "allow_supply", label: "Allow supply", kind: "bool", defaultValue: "true" },
      { key: "allow_borrow", label: "Allow borrow", kind: "bool", defaultValue: "true" },
      { key: "allow_repay", label: "Allow repay", kind: "bool", defaultValue: "true" },
      { key: "allow_withdraw", label: "Allow withdraw", kind: "bool", defaultValue: "true" },
      { key: "enabled", label: "Enabled", kind: "bool", defaultValue: "true" },
    ],
  },
  {
    id: "arka-settle-fees",
    title: "Settle fees",
    domain: "Arka",
    contractDefault: ARKA_ID,
    method: "settle_fees",
    mode: "write",
    description: "Force fee settlement and mint manager/protocol shares according to policy.",
    fields: [],
  },
  {
    id: "arka-read-manager",
    title: "Read manager",
    domain: "Arka",
    contractDefault: ARKA_ID,
    method: "manager",
    mode: "read",
    description: "Read current manager address.",
    fields: [],
  },
  {
    id: "arka-read-denomination",
    title: "Read denomination",
    domain: "Arka",
    contractDefault: ARKA_ID,
    method: "denomination",
    mode: "read",
    description: "Read denomination token contract used by the vault.",
    fields: [],
  },
  {
    id: "arka-read-share-token",
    title: "Read share token",
    domain: "Arka",
    contractDefault: ARKA_ID,
    method: "share_token",
    mode: "read",
    description: "Read active share token contract for the vault.",
    fields: [],
  },
  {
    id: "arka-read-router",
    title: "Read router",
    domain: "Arka",
    contractDefault: ARKA_ID,
    method: "router",
    mode: "read",
    description: "Read active router contract.",
    fields: [],
  },
  {
    id: "arka-read-governor",
    title: "Read governor",
    domain: "Arka",
    contractDefault: ARKA_ID,
    method: "governor",
    mode: "read",
    description: "Read governance authority.",
    fields: [],
  },
  {
    id: "arka-read-fees",
    title: "Read fees",
    domain: "Arka",
    contractDefault: ARKA_ID,
    method: "fees",
    mode: "read",
    description: "Read current fee structure.",
    fields: [],
  },
  {
    id: "arka-read-protocol-fee-policy",
    title: "Read protocol fee policy",
    domain: "Arka",
    contractDefault: ARKA_ID,
    method: "protocol_fee_policy",
    mode: "read",
    description: "Read treasury split policy for protocol fees.",
    fields: [],
  },
  {
    id: "arka-read-fee-state",
    title: "Read fee state",
    domain: "Arka",
    contractDefault: ARKA_ID,
    method: "fee_state",
    mode: "read",
    description: "Read accumulated fee state.",
    fields: [],
  },
  {
    id: "arka-preview-fee-settlement",
    title: "Preview fee settlement",
    domain: "Arka",
    contractDefault: ARKA_ID,
    method: "preview_fee_settlement",
    mode: "read",
    description: "Preview settlement outputs without mutating state.",
    fields: [],
  },
  {
    id: "arka-read-whitelist",
    title: "Read whitelist",
    domain: "Arka",
    contractDefault: ARKA_ID,
    method: "whitelist",
    mode: "read",
    description: "Read whitelisted assets/contracts.",
    fields: [],
  },
  {
    id: "arka-read-swap-risk-policy",
    title: "Read swap risk policy",
    domain: "Arka",
    contractDefault: ARKA_ID,
    method: "swap_risk_policy",
    mode: "read",
    description: "Read active swap guardrails.",
    fields: [],
  },
  {
    id: "arka-read-swap-oracle",
    title: "Read swap oracle",
    domain: "Arka",
    contractDefault: ARKA_ID,
    method: "swap_oracle",
    mode: "read",
    description: "Read configured swap oracle address.",
    fields: [],
  },
  {
    id: "arka-read-allowed-routers",
    title: "Read allowed routers",
    domain: "Arka",
    contractDefault: ARKA_ID,
    method: "allowed_routers",
    mode: "read",
    description: "Read approved router allowlist.",
    fields: [],
  },
  {
    id: "arka-read-allowed-adapters",
    title: "Read allowed adapters",
    domain: "Arka",
    contractDefault: ARKA_ID,
    method: "allowed_adapters",
    mode: "read",
    description: "Read approved adapter allowlist.",
    fields: [],
  },
  {
    id: "arka-read-nav",
    title: "Read NAV",
    domain: "Arka",
    contractDefault: ARKA_ID,
    method: "nav",
    mode: "read",
    description: "Read live net asset value.",
    fields: [],
  },
  {
    id: "arka-read-liquid-balance",
    title: "Read liquid balance",
    domain: "Arka",
    contractDefault: ARKA_ID,
    method: "liquid_balance",
    mode: "read",
    description: "Read liquid balance for a specific asset.",
    fields: [{ key: "asset", label: "Asset", kind: "address", defaultValue: DENOMINATION }],
  },
  {
    id: "arka-read-shares-of",
    title: "Read shares of",
    domain: "Arka",
    contractDefault: ARKA_ID,
    method: "shares_of",
    mode: "read",
    description: "Read current share balance for a wallet.",
    fields: [{ key: "owner", label: "Owner", kind: "address" }],
  },
  {
    id: "arka-read-credit-protocols",
    title: "Read credit protocols",
    domain: "Arka",
    contractDefault: ARKA_ID,
    method: "credit_protocols",
    mode: "read",
    description: "Read enabled credit protocol enum set.",
    fields: [],
  },
  {
    id: "arka-read-credit-markets",
    title: "Read credit markets",
    domain: "Arka",
    contractDefault: ARKA_ID,
    method: "credit_markets",
    mode: "read",
    description: "Read configured market IDs for a protocol.",
    fields: [{ key: "protocol", label: "Protocol", kind: "credit_protocol", defaultValue: "Blend" }],
  },
  {
    id: "arka-read-credit-market-config",
    title: "Read credit market config",
    domain: "Arka",
    contractDefault: ARKA_ID,
    method: "credit_market_config",
    mode: "read",
    description: "Read one protocol market configuration.",
    fields: [
      { key: "protocol", label: "Protocol", kind: "credit_protocol", defaultValue: "Blend" },
      { key: "market_id", label: "Market id", kind: "u128", defaultValue: String(BLEND_MARKET_ID) },
    ],
  },
  {
    id: "contract-upgrade",
    title: "Contract WASM upgrade",
    domain: "System",
    contractDefault: ARKA_ID,
    method: "upgrade",
    mode: "write",
    description: "Prepare a governed contract upgrade against an audited WASM hash.",
    fields: [
      { key: "caller", label: "Caller", kind: "address" },
      { key: "new_wasm_hash", label: "WASM hash (bytes32 hex)", kind: "bytesn32" },
    ],
  },
  {
    id: "contract-read-last-wasm-hash",
    title: "Read last WASM hash",
    domain: "System",
    contractDefault: ARKA_ID,
    method: "last_wasm_hash",
    mode: "read",
    description: "Read the last recorded upgrade hash for contracts exposing upgrade metadata.",
    fields: [],
  },
  {
    id: "contract-set-bootstrap-admin",
    title: "Set bootstrap admin",
    domain: "System",
    contractDefault: ARKA_ID,
    method: "set_bootstrap_admin",
    mode: "write",
    description: "Set a temporary bootstrap admin and expiry for contracts that use separate bootstrap authority.",
    fields: [
      { key: "caller", label: "Caller", kind: "address" },
      { key: "admin", label: "Bootstrap admin", kind: "address" },
      { key: "expires_at", label: "Expires at", kind: "u64", defaultValue: "0" },
    ],
  },
  {
    id: "contract-set-bootstrap-admin-expiry",
    title: "Set bootstrap expiry",
    domain: "System",
    contractDefault: GOVERNANCE_EXECUTOR_ID,
    method: "set_bootstrap_admin_expiry",
    mode: "write",
    description: "Set the temporary admin expiry for admin-governed contracts.",
    fields: [
      { key: "caller", label: "Caller", kind: "address" },
      { key: "expires_at", label: "Expires at", kind: "u64", defaultValue: "0" },
    ],
  },
  {
    id: "contract-read-bootstrap-admin-expires-at",
    title: "Read bootstrap expiry",
    domain: "System",
    contractDefault: GOVERNANCE_EXECUTOR_ID,
    method: "bootstrap_admin_expires_at",
    mode: "read",
    description: "Read the configured temporary admin expiry.",
    fields: [],
  },
  {
    id: "contract-read-bootstrap-admin-active",
    title: "Read bootstrap active",
    domain: "System",
    contractDefault: GOVERNANCE_EXECUTOR_ID,
    method: "bootstrap_admin_active",
    mode: "read",
    description: "Read whether temporary admin authority is currently active.",
    fields: [],
  },
  {
    id: "contract-clear-bootstrap-admin",
    title: "Clear bootstrap admin",
    domain: "System",
    contractDefault: ARKA_ID,
    method: "clear_bootstrap_admin",
    mode: "write",
    description: "Remove separate bootstrap admin authority after DAO handoff.",
    fields: [{ key: "caller", label: "Caller", kind: "address" }],
  },
  {
    id: "contract-clear-bootstrap-admin-expiry",
    title: "Clear bootstrap expiry",
    domain: "System",
    contractDefault: GOVERNANCE_EXECUTOR_ID,
    method: "clear_bootstrap_admin_expiry",
    mode: "write",
    description: "Clear the temporary admin expiry through the governor.",
    fields: [{ key: "caller", label: "Caller", kind: "address" }],
  },
  {
    id: "arka-factory-set-governor",
    title: "Set governor",
    domain: "ArkaFactory",
    contractDefault: ARKA_FACTORY,
    method: "set_governor",
    mode: "write",
    description: "Set factory governor (first set or rotate with current governor auth).",
    fields: [{ key: "governor", label: "Governor", kind: "address" }],
  },
  {
    id: "arka-factory-set-implementation",
    title: "Set implementation",
    domain: "ArkaFactory",
    contractDefault: ARKA_FACTORY,
    method: "set_implementation",
    mode: "write",
    description: "Set Arka implementation wasm hash (bytes32 hex).",
    fields: [{ key: "impl_wasm_hash", label: "Implementation hash (bytes32 hex)", kind: "bytesn32" }],
  },
  {
    id: "arka-factory-set-share-token-implementation",
    title: "Set share token implementation",
    domain: "ArkaFactory",
    contractDefault: ARKA_FACTORY,
    method: "set_share_token_implementation",
    mode: "write",
    description: "Set share token implementation wasm hash (bytes32 hex).",
    fields: [{ key: "impl_wasm_hash", label: "Share token hash (bytes32 hex)", kind: "bytesn32" }],
  },
  {
    id: "arka-factory-set-registry",
    title: "Set registry",
    domain: "ArkaFactory",
    contractDefault: ARKA_FACTORY,
    method: "set_registry",
    mode: "write",
    description: "Set external Arka registry contract address.",
    fields: [{ key: "registry", label: "Registry", kind: "address" }],
  },
  {
    id: "arka-factory-set-protocol-treasury",
    title: "Set protocol treasury",
    domain: "ArkaFactory",
    contractDefault: ARKA_FACTORY,
    method: "set_protocol_treasury",
    mode: "write",
    description: "Set protocol treasury receiver for new Arkas.",
    fields: [{ key: "treasury", label: "Treasury", kind: "address" }],
  },
  {
    id: "arka-factory-set-protocol-fee-splits",
    title: "Set protocol fee splits",
    domain: "ArkaFactory",
    contractDefault: ARKA_FACTORY,
    method: "set_protocol_fee_splits",
    mode: "write",
    description: "Set protocol management and performance fee split percentages.",
    fields: [
      { key: "mgmt_protocol_bps", label: "Management protocol share (%)", kind: "i32", defaultValue: "25.00", presentation: "percent_bps" },
      { key: "perf_protocol_bps", label: "Performance protocol share (%)", kind: "i32", defaultValue: "25.00", presentation: "percent_bps" },
    ],
  },
  {
    id: "arka-factory-set-creation-fee",
    title: "Set creation fee",
    domain: "ArkaFactory",
    contractDefault: ARKA_FACTORY,
    method: "set_creation_fee",
    mode: "write",
    description: "Set factory creation fee token and amount.",
    fields: [
      { key: "token", label: "Fee token", kind: "address", defaultValue: DENOMINATION },
      { key: "amount", label: "Fee amount", kind: "i128", defaultValue: "0" },
    ],
  },
  {
    id: "arka-factory-read-migrated-to",
    title: "Read migrated_to",
    domain: "ArkaFactory",
    contractDefault: ARKA_FACTORY,
    method: "migrated_to",
    mode: "read",
    description: "Read new Arka address mapped from old Arka.",
    fields: [{ key: "old_arka", label: "Old Arka", kind: "address" }],
  },
  {
    id: "arka-factory-read-migrated-from",
    title: "Read migrated_from",
    domain: "ArkaFactory",
    contractDefault: ARKA_FACTORY,
    method: "migrated_from",
    mode: "read",
    description: "Read old Arka address mapped to new Arka.",
    fields: [{ key: "new_arka", label: "New Arka", kind: "address" }],
  },
  {
    id: "arka-factory-read-share-token-of",
    title: "Read share_token_of",
    domain: "ArkaFactory",
    contractDefault: ARKA_FACTORY,
    method: "share_token_of",
    mode: "read",
    description: "Read share token bound to one Arka.",
    fields: [{ key: "arka", label: "Arka", kind: "address" }],
  },
  {
    id: "arka-factory-read-arkas",
    title: "Read arkas",
    domain: "ArkaFactory",
    contractDefault: ARKA_FACTORY,
    method: "get_arkas",
    mode: "read",
    description: "Read factory-known Arkas with pagination.",
    fields: [
      { key: "offset", label: "Offset", kind: "u32", defaultValue: "0" },
      { key: "limit", label: "Limit", kind: "u32", defaultValue: "50" },
    ],
  },
  {
    id: "arka-factory-read-arkas-by-manager",
    title: "Read arkas by manager",
    domain: "ArkaFactory",
    contractDefault: ARKA_FACTORY,
    method: "get_arkas_by_manager",
    mode: "read",
    description: "Read factory-known Arkas by manager with pagination.",
    fields: [
      { key: "manager", label: "Manager", kind: "address" },
      { key: "offset", label: "Offset", kind: "u32", defaultValue: "0" },
      { key: "limit", label: "Limit", kind: "u32", defaultValue: "50" },
    ],
  },
  {
    id: "arka-factory-read-protocol-treasury",
    title: "Read protocol treasury",
    domain: "ArkaFactory",
    contractDefault: ARKA_FACTORY,
    method: "get_protocol_treasury",
    mode: "read",
    description: "Read configured protocol treasury receiver.",
    fields: [],
  },
  {
    id: "arka-factory-read-protocol-mgmt-fee-bps",
    title: "Read protocol management fee",
    domain: "ArkaFactory",
    contractDefault: ARKA_FACTORY,
    method: "get_protocol_mgmt_fee_bps",
    mode: "read",
    description: "Read configured protocol management fee split.",
    fields: [],
  },
  {
    id: "arka-factory-read-protocol-perf-fee-bps",
    title: "Read protocol performance fee",
    domain: "ArkaFactory",
    contractDefault: ARKA_FACTORY,
    method: "get_protocol_perf_fee_bps",
    mode: "read",
    description: "Read configured protocol performance fee split.",
    fields: [],
  },
  {
    id: "arka-factory-read-creation-fee-token",
    title: "Read creation fee token",
    domain: "ArkaFactory",
    contractDefault: ARKA_FACTORY,
    method: "get_creation_fee_token",
    mode: "read",
    description: "Read configured creation fee token contract.",
    fields: [],
  },
  {
    id: "arka-factory-read-creation-fee-amount",
    title: "Read creation fee amount",
    domain: "ArkaFactory",
    contractDefault: ARKA_FACTORY,
    method: "get_creation_fee_amount",
    mode: "read",
    description: "Read configured creation fee amount.",
    fields: [],
  },
  {
    id: "arka-factory-read-share-token-implementation",
    title: "Read share token implementation",
    domain: "ArkaFactory",
    contractDefault: ARKA_FACTORY,
    method: "get_share_token_implementation",
    mode: "read",
    description: "Read configured share token implementation hash.",
    fields: [],
  },
  {
    id: "arka-registry-init-admin",
    title: "Init admin",
    domain: "ArkaRegistry",
    contractDefault: ARKA_REGISTRY,
    method: "init_admin",
    mode: "write",
    description: "Initialize one-time admin authority for the registry.",
    fields: [{ key: "admin", label: "Admin", kind: "address" }],
  },
  {
    id: "arka-registry-set-registrar",
    title: "Set registrar",
    domain: "ArkaRegistry",
    contractDefault: ARKA_REGISTRY,
    method: "set_registrar",
    mode: "write",
    description: "Allow or revoke a registrar writer account.",
    fields: [
      { key: "caller", label: "Caller", kind: "address" },
      { key: "registrar", label: "Registrar", kind: "address" },
      { key: "allowed", label: "Allowed", kind: "bool", defaultValue: "true" },
    ],
  },
  {
    id: "arka-registry-register",
    title: "Register arka",
    domain: "ArkaRegistry",
    contractDefault: ARKA_REGISTRY,
    method: "register",
    mode: "write",
    description: "Register one Arka under a manager with writer auth.",
    fields: [
      { key: "caller", label: "Caller", kind: "address" },
      { key: "manager", label: "Manager", kind: "address" },
      { key: "arka", label: "Arka", kind: "address" },
    ],
  },
  {
    id: "arka-registry-register-admin",
    title: "Register arka (admin)",
    domain: "ArkaRegistry",
    contractDefault: ARKA_REGISTRY,
    method: "register_admin",
    mode: "write",
    description: "Register one legacy Arka under a manager with admin auth.",
    fields: [
      { key: "caller", label: "Caller", kind: "address" },
      { key: "manager", label: "Manager", kind: "address" },
      { key: "arka", label: "Arka", kind: "address" },
    ],
  },
  {
    id: "arka-registry-set-manager-curated",
    title: "Set manager curated",
    domain: "ArkaRegistry",
    contractDefault: ARKA_REGISTRY,
    method: "set_manager_curated",
    mode: "write",
    description: "Mark one manager as curated or not curated.",
    fields: [
      { key: "caller", label: "Caller", kind: "address" },
      { key: "manager", label: "Manager", kind: "address" },
      { key: "curated", label: "Curated", kind: "bool", defaultValue: "true" },
    ],
  },
  {
    id: "arka-registry-set-delisted",
    title: "Set arka delisted",
    domain: "ArkaRegistry",
    contractDefault: ARKA_REGISTRY,
    method: "set_delisted",
    mode: "write",
    description: "Mark one Arka as delisted or active.",
    fields: [
      { key: "caller", label: "Caller", kind: "address" },
      { key: "arka", label: "Arka", kind: "address" },
      { key: "delisted", label: "Delisted", kind: "bool", defaultValue: "true" },
    ],
  },
  {
    id: "arka-registry-read-is-registrar",
    title: "Read is registrar",
    domain: "ArkaRegistry",
    contractDefault: ARKA_REGISTRY,
    method: "is_registrar",
    mode: "read",
    description: "Read whether an address has registrar permissions.",
    fields: [{ key: "registrar", label: "Registrar", kind: "address" }],
  },
  {
    id: "arka-registry-read-arkas",
    title: "Read arkas",
    domain: "ArkaRegistry",
    contractDefault: ARKA_REGISTRY,
    method: "get_arkas",
    mode: "read",
    description: "Read active Arkas with offset/limit pagination.",
    fields: [
      { key: "offset", label: "Offset", kind: "u32", defaultValue: "0" },
      { key: "limit", label: "Limit", kind: "u32", defaultValue: "50" },
    ],
  },
  {
    id: "arka-registry-read-arkas-by-manager",
    title: "Read arkas by manager",
    domain: "ArkaRegistry",
    contractDefault: ARKA_REGISTRY,
    method: "get_arkas_by_manager",
    mode: "read",
    description: "Read active Arkas for one manager with pagination.",
    fields: [
      { key: "manager", label: "Manager", kind: "address" },
      { key: "offset", label: "Offset", kind: "u32", defaultValue: "0" },
      { key: "limit", label: "Limit", kind: "u32", defaultValue: "50" },
    ],
  },
  {
    id: "arka-registry-read-count",
    title: "Read count",
    domain: "ArkaRegistry",
    contractDefault: ARKA_REGISTRY,
    method: "count",
    mode: "read",
    description: "Read active Arka count.",
    fields: [],
  },
  {
    id: "arka-registry-read-count-by-manager",
    title: "Read count by manager",
    domain: "ArkaRegistry",
    contractDefault: ARKA_REGISTRY,
    method: "count_by_manager",
    mode: "read",
    description: "Read active Arka count for one manager.",
    fields: [{ key: "manager", label: "Manager", kind: "address" }],
  },
  {
    id: "arka-registry-read-is-manager-curated",
    title: "Read is manager curated",
    domain: "ArkaRegistry",
    contractDefault: ARKA_REGISTRY,
    method: "is_manager_curated",
    mode: "read",
    description: "Read whether a manager is curated.",
    fields: [{ key: "manager", label: "Manager", kind: "address" }],
  },
  {
    id: "arka-registry-read-is-delisted",
    title: "Read is delisted",
    domain: "ArkaRegistry",
    contractDefault: ARKA_REGISTRY,
    method: "is_delisted",
    mode: "read",
    description: "Read whether an Arka is marked as delisted.",
    fields: [{ key: "arka", label: "Arka", kind: "address" }],
  },
  {
    id: "coverage-fund-set-governor",
    title: "Set governor",
    domain: "CoverageFund",
    contractDefault: COVERAGE_FUND,
    method: "set_governor",
    mode: "write",
    description: "Set governance authority for coverage fund policy.",
    fields: [
      { key: "caller", label: "Caller", kind: "address" },
      { key: "governor", label: "Governor", kind: "address" },
    ],
  },
  {
    id: "coverage-fund-set-claims-manager",
    title: "Set claims manager",
    domain: "CoverageFund",
    contractDefault: COVERAGE_FUND,
    method: "set_claims_manager",
    mode: "write",
    description: "Set or clear claims manager (leave empty to clear).",
    fields: [
      { key: "caller", label: "Caller", kind: "address" },
      { key: "claims_manager", label: "Claims manager (optional)", kind: "optional_address" },
    ],
  },
  {
    id: "coverage-fund-set-treasury",
    title: "Set treasury",
    domain: "CoverageFund",
    contractDefault: COVERAGE_FUND,
    method: "set_treasury",
    mode: "write",
    description: "Set or clear treasury receiver (leave empty to clear).",
    fields: [
      { key: "caller", label: "Caller", kind: "address" },
      { key: "treasury", label: "Treasury (optional)", kind: "optional_address" },
    ],
  },
  {
    id: "coverage-fund-set-economics-policy",
    title: "Set economics policy",
    domain: "CoverageFund",
    contractDefault: COVERAGE_FUND,
    method: "set_economics_policy",
    mode: "write",
    description: "Set reserve retain, treasury share and reserve target percentages.",
    fields: [
      { key: "caller", label: "Caller", kind: "address" },
      { key: "reserve_retain_bps", label: "Reserve retain (%)", kind: "i32", defaultValue: "100.00", presentation: "percent_bps" },
      { key: "treasury_share_bps", label: "Treasury share (%)", kind: "i32", defaultValue: "0.00", presentation: "percent_bps" },
      { key: "reserve_target_bps", label: "Reserve target (%)", kind: "i32", defaultValue: "0.00", presentation: "percent_bps" },
    ],
  },
  {
    id: "coverage-fund-set-covered-vault-policy",
    title: "Set covered vault policy",
    domain: "CoverageFund",
    contractDefault: COVERAGE_FUND,
    method: "set_covered_vault_policy",
    mode: "write",
    description: "Enable and set annual premium plus coverage limit for one vault.",
    fields: [
      { key: "caller", label: "Caller", kind: "address" },
      { key: "vault", label: "Vault", kind: "address" },
      { key: "annual_premium_bps", label: "Annual premium (%)", kind: "i32", defaultValue: "2.00", presentation: "percent_bps" },
      { key: "coverage_limit", label: "Coverage limit", kind: "i128", defaultValue: "10000000" },
    ],
  },
  {
    id: "coverage-fund-remove-covered-vault",
    title: "Remove covered vault",
    domain: "CoverageFund",
    contractDefault: COVERAGE_FUND,
    method: "remove_covered_vault",
    mode: "write",
    description: "Remove vault coverage policy and accounting state.",
    fields: [
      { key: "caller", label: "Caller", kind: "address" },
      { key: "vault", label: "Vault", kind: "address" },
    ],
  },
  {
    id: "coverage-fund-fund-bootstrap-rewards",
    title: "Fund bootstrap rewards",
    domain: "CoverageFund",
    contractDefault: COVERAGE_FUND,
    method: "fund_bootstrap_rewards",
    mode: "write",
    description: "Fund bootstrap reward ledger from reward token.",
    fields: [
      { key: "caller", label: "Caller", kind: "address" },
      { key: "amount", label: "Amount", kind: "i128", defaultValue: "1000000" },
    ],
  },
  {
    id: "coverage-fund-pay-premium",
    title: "Pay premium",
    domain: "CoverageFund",
    contractDefault: COVERAGE_FUND,
    method: "pay_premium",
    mode: "write",
    description: "Collect premium and route retained/rewards/treasury accounting.",
    fields: [
      { key: "payer", label: "Payer", kind: "address" },
      { key: "vault", label: "Vault", kind: "address" },
      { key: "covered_nav", label: "Covered TVL", kind: "i128", defaultValue: "10000000" },
      { key: "coverage_period_bps", label: "Coverage period (%)", kind: "i32", defaultValue: "50.00", presentation: "percent_bps" },
    ],
  },
  {
    id: "coverage-fund-claim-from-community",
    title: "Claim from community",
    domain: "CoverageFund",
    contractDefault: COVERAGE_FUND,
    method: "claim_from_community",
    mode: "write",
    description: "Execute community reserve payout via claims manager lane.",
    fields: [
      { key: "caller", label: "Caller", kind: "address" },
      { key: "recipient", label: "Recipient", kind: "address" },
      { key: "amount", label: "Amount", kind: "i128", defaultValue: "1000000" },
    ],
  },
  {
    id: "coverage-fund-quote-premium",
    title: "Quote premium",
    domain: "CoverageFund",
    contractDefault: COVERAGE_FUND,
    method: "quote_premium",
    mode: "read",
    description: "Read-only premium quote for vault/nav/period.",
    fields: [
      { key: "vault", label: "Vault", kind: "address" },
      { key: "covered_nav", label: "Covered TVL", kind: "i128", defaultValue: "10000000" },
      { key: "coverage_period_bps", label: "Coverage period (%)", kind: "i32", defaultValue: "50.00", presentation: "percent_bps" },
    ],
  },
  {
    id: "coverage-fund-read-governor",
    title: "Read governor",
    domain: "CoverageFund",
    contractDefault: COVERAGE_FUND,
    method: "governor",
    mode: "read",
    description: "Read policy governor.",
    fields: [],
  },
  {
    id: "coverage-fund-read-claims-manager",
    title: "Read claims manager",
    domain: "CoverageFund",
    contractDefault: COVERAGE_FUND,
    method: "claims_manager",
    mode: "read",
    description: "Read claims manager.",
    fields: [],
  },
  {
    id: "coverage-fund-read-treasury",
    title: "Read treasury",
    domain: "CoverageFund",
    contractDefault: COVERAGE_FUND,
    method: "treasury",
    mode: "read",
    description: "Read treasury receiver.",
    fields: [],
  },
  {
    id: "coverage-fund-read-reserve-token",
    title: "Read reserve token",
    domain: "CoverageFund",
    contractDefault: COVERAGE_FUND,
    method: "reserve_token",
    mode: "read",
    description: "Read reserve token contract.",
    fields: [],
  },
  {
    id: "coverage-fund-read-bootstrap-token",
    title: "Read bootstrap token",
    domain: "CoverageFund",
    contractDefault: COVERAGE_FUND,
    method: "bootstrap_reward_token",
    mode: "read",
    description: "Read bootstrap reward token contract.",
    fields: [],
  },
  {
    id: "coverage-fund-read-metrics",
    title: "Read metrics",
    domain: "CoverageFund",
    contractDefault: COVERAGE_FUND,
    method: "metrics",
    mode: "read",
    description: "Read aggregated economics metrics.",
    fields: [],
  },
  {
    id: "coverage-fund-read-claim-capacity",
    title: "Read claim capacity",
    domain: "CoverageFund",
    contractDefault: COVERAGE_FUND,
    method: "claim_capacity",
    mode: "read",
    description: "Read available claimable reserve capacity.",
    fields: [],
  },
  {
    id: "coverage-fund-read-stake-of",
    title: "Read stake_of",
    domain: "CoverageFund",
    contractDefault: COVERAGE_FUND,
    method: "stake_of",
    mode: "read",
    description: "Read staked amount for a user.",
    fields: [{ key: "user", label: "User", kind: "address" }],
  },
  {
    id: "coverage-fund-read-pending-rewards",
    title: "Read pending rewards",
    domain: "CoverageFund",
    contractDefault: COVERAGE_FUND,
    method: "pending_rewards",
    mode: "read",
    description: "Read pending reserve/bootstrap rewards for a user.",
    fields: [{ key: "user", label: "User", kind: "address" }],
  },
  {
    id: "coverage-fund-read-covered-vault-policy",
    title: "Read covered vault policy",
    domain: "CoverageFund",
    contractDefault: COVERAGE_FUND,
    method: "covered_vault_policy",
    mode: "read",
    description: "Read policy for one covered vault.",
    fields: [{ key: "vault", label: "Vault", kind: "address" }],
  },
  {
    id: "coverage-fund-read-covered-nav",
    title: "Read covered nav",
    domain: "CoverageFund",
    contractDefault: COVERAGE_FUND,
    method: "covered_nav",
    mode: "read",
    description: "Read covered NAV for a vault.",
    fields: [{ key: "vault", label: "Vault", kind: "address" }],
  },
  {
    id: "coverage-fund-read-premiums-paid-by-vault",
    title: "Read premiums paid by vault",
    domain: "CoverageFund",
    contractDefault: COVERAGE_FUND,
    method: "premiums_paid_by_vault",
    mode: "read",
    description: "Read cumulative premiums paid by a covered vault.",
    fields: [{ key: "vault", label: "Vault", kind: "address" }],
  },
  {
    id: "coverage-vault-set-governor",
    title: "Set governor",
    domain: "CoverageVault",
    contractDefault: COVERAGE_VAULT,
    method: "set_governor",
    mode: "write",
    description: "Set governance authority for coverage vault policy.",
    fields: [
      { key: "caller", label: "Caller", kind: "address" },
      { key: "governor", label: "Governor", kind: "address" },
    ],
  },
  {
    id: "coverage-vault-set-claims-manager",
    title: "Set claims manager",
    domain: "CoverageVault",
    contractDefault: COVERAGE_VAULT,
    method: "set_claims_manager",
    mode: "write",
    description: "Set or clear vault claims manager (leave empty to clear).",
    fields: [
      { key: "caller", label: "Caller", kind: "address" },
      { key: "claims_manager", label: "Claims manager (optional)", kind: "optional_address" },
    ],
  },
  {
    id: "coverage-vault-set-lock-bps",
    title: "Set lock ratio",
    domain: "CoverageVault",
    contractDefault: COVERAGE_VAULT,
    method: "set_lock_bps",
    mode: "write",
    description: "Set vault minimum lock ratio.",
    fields: [
      { key: "caller", label: "Caller", kind: "address" },
      { key: "lock_bps", label: "Lock ratio (%)", kind: "i32", defaultValue: "30.00", presentation: "percent_bps" },
    ],
  },
  {
    id: "coverage-vault-deposit",
    title: "Deposit",
    domain: "CoverageVault",
    contractDefault: COVERAGE_VAULT,
    method: "deposit",
    mode: "write",
    description: "Deposit reserve tokens into manager lock vault.",
    fields: [
      { key: "from", label: "From", kind: "address" },
      { key: "amount", label: "Amount", kind: "i128", defaultValue: "1000000" },
    ],
  },
  {
    id: "coverage-vault-withdraw",
    title: "Withdraw",
    domain: "CoverageVault",
    contractDefault: COVERAGE_VAULT,
    method: "withdraw",
    mode: "write",
    description: "Policy-authorized withdrawal from manager lock vault.",
    fields: [
      { key: "caller", label: "Caller", kind: "address" },
      { key: "to", label: "Recipient", kind: "address" },
      { key: "amount", label: "Amount", kind: "i128", defaultValue: "1000000" },
    ],
  },
  {
    id: "coverage-vault-claim-payout",
    title: "Claim payout",
    domain: "CoverageVault",
    contractDefault: COVERAGE_VAULT,
    method: "claim_payout",
    mode: "write",
    description: "Claims-manager payout from manager lock reserve.",
    fields: [
      { key: "caller", label: "Caller", kind: "address" },
      { key: "recipient", label: "Recipient", kind: "address" },
      { key: "amount", label: "Amount", kind: "i128", defaultValue: "1000000" },
    ],
  },
  {
    id: "coverage-vault-read-manager",
    title: "Read manager",
    domain: "CoverageVault",
    contractDefault: COVERAGE_VAULT,
    method: "manager",
    mode: "read",
    description: "Read manager address.",
    fields: [],
  },
  {
    id: "coverage-vault-read-governor",
    title: "Read governor",
    domain: "CoverageVault",
    contractDefault: COVERAGE_VAULT,
    method: "governor",
    mode: "read",
    description: "Read policy governor.",
    fields: [],
  },
  {
    id: "coverage-vault-read-claims-manager",
    title: "Read claims manager",
    domain: "CoverageVault",
    contractDefault: COVERAGE_VAULT,
    method: "claims_manager",
    mode: "read",
    description: "Read claims manager.",
    fields: [],
  },
  {
    id: "coverage-vault-read-token",
    title: "Read token",
    domain: "CoverageVault",
    contractDefault: COVERAGE_VAULT,
    method: "token",
    mode: "read",
    description: "Read reserve token contract.",
    fields: [],
  },
  {
    id: "coverage-vault-read-lock-bps",
    title: "Read lock ratio",
    domain: "CoverageVault",
    contractDefault: COVERAGE_VAULT,
    method: "lock_bps",
    mode: "read",
    description: "Read lock ratio.",
    fields: [],
  },
  {
    id: "coverage-vault-read-balance",
    title: "Read balance",
    domain: "CoverageVault",
    contractDefault: COVERAGE_VAULT,
    method: "balance",
    mode: "read",
    description: "Read total vault reserve balance.",
    fields: [],
  },
  {
    id: "coverage-vault-read-max-withdrawable",
    title: "Read max withdrawable",
    domain: "CoverageVault",
    contractDefault: COVERAGE_VAULT,
    method: "max_withdrawable",
    mode: "read",
    description: "Read max withdrawable amount after lock checks.",
    fields: [],
  },
  {
    id: "coverage-vault-read-claim-capacity",
    title: "Read claim capacity",
    domain: "CoverageVault",
    contractDefault: COVERAGE_VAULT,
    method: "claim_capacity",
    mode: "read",
    description: "Read capacity available for claims payout.",
    fields: [],
  },
  {
    id: "manager-tier-set-governor",
    title: "Set governor",
    domain: "ManagerTier",
    contractDefault: MANAGER_TIER,
    method: "set_governor",
    mode: "write",
    description: "Set governance authority for manager tier policy.",
    fields: [
      { key: "caller", label: "Caller", kind: "address" },
      { key: "governor", label: "Governor", kind: "address" },
    ],
  },
  {
    id: "manager-tier-set-thresholds",
    title: "Set thresholds",
    domain: "ManagerTier",
    contractDefault: MANAGER_TIER,
    method: "set_thresholds",
    mode: "write",
    description: "Set tier1/tier2/tier3 thresholds.",
    fields: [
      { key: "caller", label: "Caller", kind: "address" },
      { key: "tier1_threshold", label: "Tier 1 threshold", kind: "i128", defaultValue: "100" },
      { key: "tier2_threshold", label: "Tier 2 threshold", kind: "i128", defaultValue: "500" },
      { key: "tier3_threshold", label: "Tier 3 threshold", kind: "i128", defaultValue: "1000" },
    ],
  },
  {
    id: "manager-tier-set-points",
    title: "Set points",
    domain: "ManagerTier",
    contractDefault: MANAGER_TIER,
    method: "set_points",
    mode: "write",
    description: "Set absolute points for a manager.",
    fields: [
      { key: "caller", label: "Caller", kind: "address" },
      { key: "manager", label: "Manager", kind: "address" },
      { key: "points", label: "Points", kind: "i128", defaultValue: "0" },
    ],
  },
  {
    id: "manager-tier-add-points",
    title: "Add points",
    domain: "ManagerTier",
    contractDefault: MANAGER_TIER,
    method: "add_points",
    mode: "write",
    description: "Apply signed delta to manager points.",
    fields: [
      { key: "caller", label: "Caller", kind: "address" },
      { key: "manager", label: "Manager", kind: "address" },
      { key: "delta", label: "Delta", kind: "i128", defaultValue: "100" },
    ],
  },
  {
    id: "manager-tier-read-points-of",
    title: "Read points_of",
    domain: "ManagerTier",
    contractDefault: MANAGER_TIER,
    method: "points_of",
    mode: "read",
    description: "Read points for one manager.",
    fields: [{ key: "manager", label: "Manager", kind: "address" }],
  },
  {
    id: "manager-tier-read-tier-of",
    title: "Read tier_of",
    domain: "ManagerTier",
    contractDefault: MANAGER_TIER,
    method: "tier_of",
    mode: "read",
    description: "Read computed tier for one manager.",
    fields: [{ key: "manager", label: "Manager", kind: "address" }],
  },
  {
    id: "manager-tier-read-thresholds",
    title: "Read thresholds",
    domain: "ManagerTier",
    contractDefault: MANAGER_TIER,
    method: "thresholds",
    mode: "read",
    description: "Read threshold tuple for tiers 1/2/3.",
    fields: [],
  },
  {
    id: "manager-tier-read-governor",
    title: "Read governor",
    domain: "ManagerTier",
    contractDefault: MANAGER_TIER,
    method: "governor",
    mode: "read",
    description: "Read governance authority.",
    fields: [],
  },
  {
    id: "locked-arka-init",
    title: "Init",
    domain: "LockedArka",
    contractDefault: LOCKED_ARKA,
    method: "init",
    mode: "write",
    description: "Initialize locked ARKA voting escrow token wrapper.",
    fields: [
      { key: "admin", label: "Admin", kind: "address" },
      { key: "token", label: "Underlying token", kind: "address", defaultValue: DENOMINATION },
      { key: "min_lock_ledgers", label: "Min lock ledgers", kind: "u32", defaultValue: "17280" },
      { key: "max_lock_ledgers", label: "Max lock ledgers", kind: "u32", defaultValue: "120960" },
      { key: "name", label: "Token name", kind: "string", defaultValue: "Locked ARKA" },
      { key: "symbol", label: "Token symbol", kind: "string", defaultValue: "lARKA" },
    ],
  },
  {
    id: "locked-arka-set-admin",
    title: "Set admin",
    domain: "LockedArka",
    contractDefault: LOCKED_ARKA,
    method: "set_admin",
    mode: "write",
    description: "Rotate locked ARKA admin authority.",
    fields: [
      { key: "caller", label: "Caller", kind: "address" },
      { key: "admin", label: "Admin", kind: "address" },
    ],
  },
  {
    id: "locked-arka-set-governor",
    title: "Set governor",
    domain: "LockedArka",
    contractDefault: LOCKED_ARKA,
    method: "set_governor",
    mode: "write",
    description: "Set governor authority for vote-sequence management.",
    fields: [
      { key: "caller", label: "Caller", kind: "address" },
      { key: "governor", label: "Governor", kind: "address" },
    ],
  },
  {
    id: "locked-arka-create-lock",
    title: "Create lock",
    domain: "LockedArka",
    contractDefault: LOCKED_ARKA,
    method: "create_lock",
    mode: "write",
    description: "Create a new locked position for one account.",
    fields: [
      { key: "account", label: "Account", kind: "address" },
      { key: "amount", label: "Amount", kind: "i128", defaultValue: "1000000" },
      { key: "unlock_ledger", label: "Unlock ledger", kind: "u32", defaultValue: "1" },
    ],
  },
  {
    id: "locked-arka-increase-amount",
    title: "Increase amount",
    domain: "LockedArka",
    contractDefault: LOCKED_ARKA,
    method: "increase_amount",
    mode: "write",
    description: "Increase locked amount for an existing position.",
    fields: [
      { key: "account", label: "Account", kind: "address" },
      { key: "amount", label: "Amount", kind: "i128", defaultValue: "1000000" },
    ],
  },
  {
    id: "locked-arka-extend-lock",
    title: "Extend lock",
    domain: "LockedArka",
    contractDefault: LOCKED_ARKA,
    method: "extend_lock",
    mode: "write",
    description: "Extend unlock ledger for an existing lock.",
    fields: [
      { key: "account", label: "Account", kind: "address" },
      { key: "unlock_ledger", label: "Unlock ledger", kind: "u32", defaultValue: "1" },
    ],
  },
  {
    id: "locked-arka-withdraw",
    title: "Withdraw",
    domain: "LockedArka",
    contractDefault: LOCKED_ARKA,
    method: "withdraw",
    mode: "write",
    description: "Withdraw matured locked position.",
    fields: [{ key: "account", label: "Account", kind: "address" }],
  },
  {
    id: "locked-arka-delegate",
    title: "Delegate",
    domain: "LockedArka",
    contractDefault: LOCKED_ARKA,
    method: "delegate",
    mode: "write",
    description: "Delegate voting power to a delegatee account.",
    fields: [
      { key: "account", label: "Account", kind: "address" },
      { key: "delegatee", label: "Delegatee", kind: "address" },
    ],
  },
  {
    id: "locked-arka-set-vote-sequence",
    title: "Set vote sequence",
    domain: "LockedArka",
    contractDefault: LOCKED_ARKA,
    method: "set_vote_sequence",
    mode: "write",
    description: "Insert a vote fence sequence for historical voting checkpoints.",
    fields: [{ key: "sequence", label: "Sequence", kind: "u32", defaultValue: "1" }],
  },
  {
    id: "locked-arka-total-supply",
    title: "Read total supply",
    domain: "LockedArka",
    contractDefault: LOCKED_ARKA,
    method: "total_supply",
    mode: "read",
    description: "Read total locked supply.",
    fields: [],
  },
  {
    id: "locked-arka-balance",
    title: "Read balance",
    domain: "LockedArka",
    contractDefault: LOCKED_ARKA,
    method: "balance",
    mode: "read",
    description: "Read account voting balance.",
    fields: [{ key: "account", label: "Account", kind: "address" }],
  },
  {
    id: "locked-arka-locked-balance",
    title: "Read locked balance",
    domain: "LockedArka",
    contractDefault: LOCKED_ARKA,
    method: "locked_balance",
    mode: "read",
    description: "Read currently locked principal for one account.",
    fields: [{ key: "account", label: "Account", kind: "address" }],
  },
  {
    id: "locked-arka-lock-position",
    title: "Read lock position",
    domain: "LockedArka",
    contractDefault: LOCKED_ARKA,
    method: "lock_position",
    mode: "read",
    description: "Read lock tuple for one account.",
    fields: [{ key: "account", label: "Account", kind: "address" }],
  },
  {
    id: "locked-arka-get-past-total-supply",
    title: "Read past total supply",
    domain: "LockedArka",
    contractDefault: LOCKED_ARKA,
    method: "get_past_total_supply",
    mode: "read",
    description: "Read total supply at historical sequence.",
    fields: [{ key: "sequence", label: "Sequence", kind: "u32", defaultValue: "1" }],
  },
  {
    id: "locked-arka-get-votes",
    title: "Read votes",
    domain: "LockedArka",
    contractDefault: LOCKED_ARKA,
    method: "get_votes",
    mode: "read",
    description: "Read current delegated votes for one account.",
    fields: [{ key: "account", label: "Account", kind: "address" }],
  },
  {
    id: "locked-arka-get-past-votes",
    title: "Read past votes",
    domain: "LockedArka",
    contractDefault: LOCKED_ARKA,
    method: "get_past_votes",
    mode: "read",
    description: "Read delegated votes for one account at historical sequence.",
    fields: [
      { key: "account", label: "Account", kind: "address" },
      { key: "sequence", label: "Sequence", kind: "u32", defaultValue: "1" },
    ],
  },
  {
    id: "locked-arka-get-delegate",
    title: "Read delegate",
    domain: "LockedArka",
    contractDefault: LOCKED_ARKA,
    method: "get_delegate",
    mode: "read",
    description: "Read current delegate for one account.",
    fields: [{ key: "account", label: "Account", kind: "address" }],
  },
  {
    id: "locked-arka-read-admin",
    title: "Read admin",
    domain: "LockedArka",
    contractDefault: LOCKED_ARKA,
    method: "admin",
    mode: "read",
    description: "Read locked ARKA admin.",
    fields: [],
  },
  {
    id: "locked-arka-read-governor",
    title: "Read governor",
    domain: "LockedArka",
    contractDefault: LOCKED_ARKA,
    method: "governor",
    mode: "read",
    description: "Read locked ARKA governor (optional).",
    fields: [],
  },
  {
    id: "locked-arka-read-config",
    title: "Read config",
    domain: "LockedArka",
    contractDefault: LOCKED_ARKA,
    method: "config",
    mode: "read",
    description: "Read full lock configuration.",
    fields: [],
  },
  {
    id: "claims-manager-init",
    title: "Init",
    domain: "ClaimsManager",
    contractDefault: CLAIMS_MANAGER,
    method: "init",
    mode: "write",
    description: "Initialize claims manager policy and reserve token.",
    fields: [
      { key: "admin", label: "Admin", kind: "address" },
      { key: "reserve_token", label: "Reserve token", kind: "address", defaultValue: DENOMINATION },
      { key: "treasury", label: "Treasury (optional)", kind: "optional_address" },
    ],
  },
  {
    id: "claims-manager-set-governor",
    title: "Set governor",
    domain: "ClaimsManager",
    contractDefault: CLAIMS_MANAGER,
    method: "set_governor",
    mode: "write",
    description: "Set policy governor for claims approvals.",
    fields: [
      { key: "caller", label: "Caller", kind: "address" },
      { key: "governor", label: "Governor", kind: "address" },
    ],
  },
  {
    id: "claims-manager-set-treasury",
    title: "Set treasury",
    domain: "ClaimsManager",
    contractDefault: CLAIMS_MANAGER,
    method: "set_treasury",
    mode: "write",
    description: "Set or clear treasury fallback recipient.",
    fields: [
      { key: "caller", label: "Caller", kind: "address" },
      { key: "treasury", label: "Treasury (optional)", kind: "optional_address" },
    ],
  },
  {
    id: "claims-manager-set-risk-operator",
    title: "Set risk operator",
    domain: "ClaimsManager",
    contractDefault: CLAIMS_MANAGER,
    method: "set_risk_operator",
    mode: "write",
    description: "Allow or revoke incident trigger operator.",
    fields: [
      { key: "caller", label: "Caller", kind: "address" },
      { key: "operator", label: "Operator", kind: "address" },
      { key: "enabled", label: "Enabled", kind: "bool", defaultValue: "true" },
    ],
  },
  {
    id: "claims-manager-register-covered-vault",
    title: "Register covered vault",
    domain: "ClaimsManager",
    contractDefault: CLAIMS_MANAGER,
    method: "register_covered_vault",
    mode: "write",
    description: "Bind covered vault to manager vault, community fund and payout recipient.",
    fields: [
      { key: "caller", label: "Caller", kind: "address" },
      { key: "vault", label: "Vault", kind: "address" },
      { key: "manager_vault", label: "Manager vault", kind: "address" },
      { key: "community_fund", label: "Community fund", kind: "address" },
      { key: "recipient", label: "Recipient", kind: "address" },
    ],
  },
  {
    id: "claims-manager-trigger-incident",
    title: "Trigger incident",
    domain: "ClaimsManager",
    contractDefault: CLAIMS_MANAGER,
    method: "trigger_incident",
    mode: "write",
    description: "Trigger a new incident with class, loss and metadata hash.",
    fields: [
      { key: "caller", label: "Caller", kind: "address" },
      { key: "vault", label: "Vault", kind: "address" },
      { key: "kind", label: "Incident class", kind: "incident_class", defaultValue: "Oracle" },
      { key: "reported_loss", label: "Reported loss", kind: "i128", defaultValue: "1000000" },
      { key: "covered_nav", label: "Covered NAV", kind: "i128", defaultValue: "10000000" },
      { key: "meta_hash", label: "Meta hash (bytes32 hex)", kind: "bytesn32" },
    ],
  },
  {
    id: "claims-manager-approve-incident",
    title: "Approve incident",
    domain: "ClaimsManager",
    contractDefault: CLAIMS_MANAGER,
    method: "approve_incident",
    mode: "write",
    description: "Approve incident payout and split plan.",
    fields: [
      { key: "caller", label: "Caller", kind: "address" },
      { key: "incident_id", label: "Incident id", kind: "u64", defaultValue: "1" },
      { key: "approved_payout", label: "Approved payout", kind: "i128", defaultValue: "1000000" },
      { key: "recipient", label: "Recipient (optional)", kind: "optional_address" },
      { key: "reason_code", label: "Reason code", kind: "u32", defaultValue: "0" },
    ],
  },
  {
    id: "claims-manager-reject-incident",
    title: "Reject incident",
    domain: "ClaimsManager",
    contractDefault: CLAIMS_MANAGER,
    method: "reject_incident",
    mode: "write",
    description: "Reject incident and release vault freeze.",
    fields: [
      { key: "caller", label: "Caller", kind: "address" },
      { key: "incident_id", label: "Incident id", kind: "u64", defaultValue: "1" },
      { key: "reason_code", label: "Reason code", kind: "u32", defaultValue: "0" },
    ],
  },
  {
    id: "claims-manager-execute-incident",
    title: "Execute incident",
    domain: "ClaimsManager",
    contractDefault: CLAIMS_MANAGER,
    method: "execute_incident",
    mode: "write",
    description: "Execute approved incident payouts.",
    fields: [{ key: "incident_id", label: "Incident id", kind: "u64", defaultValue: "1" }],
  },
  {
    id: "claims-manager-read-incident",
    title: "Read incident",
    domain: "ClaimsManager",
    contractDefault: CLAIMS_MANAGER,
    method: "incident",
    mode: "read",
    description: "Read full incident record by id.",
    fields: [{ key: "incident_id", label: "Incident id", kind: "u64", defaultValue: "1" }],
  },
  {
    id: "claims-manager-read-covered-vault",
    title: "Read covered vault",
    domain: "ClaimsManager",
    contractDefault: CLAIMS_MANAGER,
    method: "covered_vault",
    mode: "read",
    description: "Read covered vault mapping.",
    fields: [{ key: "vault", label: "Vault", kind: "address" }],
  },
  {
    id: "claims-manager-read-is-vault-frozen",
    title: "Read is vault frozen",
    domain: "ClaimsManager",
    contractDefault: CLAIMS_MANAGER,
    method: "is_vault_frozen",
    mode: "read",
    description: "Check whether a vault currently has an active incident.",
    fields: [{ key: "vault", label: "Vault", kind: "address" }],
  },
  {
    id: "claims-manager-read-treasury",
    title: "Read treasury",
    domain: "ClaimsManager",
    contractDefault: CLAIMS_MANAGER,
    method: "treasury",
    mode: "read",
    description: "Read treasury fallback recipient.",
    fields: [],
  },
  {
    id: "claims-manager-read-governor",
    title: "Read governor",
    domain: "ClaimsManager",
    contractDefault: CLAIMS_MANAGER,
    method: "governor",
    mode: "read",
    description: "Read policy governor.",
    fields: [],
  },
  {
    id: "claims-manager-read-next-incident-id",
    title: "Read next incident id",
    domain: "ClaimsManager",
    contractDefault: CLAIMS_MANAGER,
    method: "next_incident_id",
    mode: "read",
    description: "Read next assignable incident id.",
    fields: [],
  },
  {
    id: "oracle-guard-init",
    title: "Init",
    domain: "OracleGuard",
    contractDefault: ORACLE_GUARD,
    method: "init",
    mode: "write",
    description: "Initialize oracle guard admin authority.",
    fields: [{ key: "admin", label: "Admin", kind: "address" }],
  },
  {
    id: "oracle-guard-set-admin",
    title: "Set admin",
    domain: "OracleGuard",
    contractDefault: ORACLE_GUARD,
    method: "set_admin",
    mode: "write",
    description: "Rotate oracle guard admin.",
    fields: [
      { key: "caller", label: "Caller", kind: "address" },
      { key: "admin", label: "Admin", kind: "address" },
    ],
  },
  {
    id: "oracle-guard-set-guardian",
    title: "Set guardian",
    domain: "OracleGuard",
    contractDefault: ORACLE_GUARD,
    method: "set_guardian",
    mode: "write",
    description: "Set the emergency oracle guardian and expiry.",
    fields: [
      { key: "caller", label: "Caller", kind: "address" },
      { key: "guardian", label: "Guardian multisig", kind: "address" },
      { key: "expires_at", label: "Expires at", kind: "u64", defaultValue: "0" },
    ],
  },
  {
    id: "oracle-guard-clear-guardian",
    title: "Clear guardian",
    domain: "OracleGuard",
    contractDefault: ORACLE_GUARD,
    method: "clear_guardian",
    mode: "write",
    description: "Remove the emergency oracle guardian.",
    fields: [{ key: "caller", label: "Caller", kind: "address" }],
  },
  {
    id: "oracle-guard-set-stellar-asset-policy",
    title: "Set stellar asset policy",
    domain: "OracleGuard",
    contractDefault: ORACLE_GUARD,
    method: "set_stellar_asset_policy",
    mode: "write",
    description: "Set primary/secondary policy for one Stellar asset feed.",
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
    title: "Clear stellar asset policy",
    domain: "OracleGuard",
    contractDefault: ORACLE_GUARD,
    method: "clear_stellar_asset_policy",
    mode: "write",
    description: "Clear policy for one Stellar asset feed.",
    fields: [
      { key: "caller", label: "Caller", kind: "address" },
      { key: "asset", label: "Asset", kind: "address" },
    ],
  },
  {
    id: "oracle-guard-resume-stellar-asset-policy",
    title: "Resume stellar asset policy",
    domain: "OracleGuard",
    contractDefault: ORACLE_GUARD,
    method: "resume_stellar_asset_policy",
    mode: "write",
    description: "Reactivate one paused Stellar asset feed after DAO review.",
    fields: [
      { key: "caller", label: "Caller", kind: "address" },
      { key: "asset", label: "Asset", kind: "address" },
    ],
  },
  {
    id: "oracle-guard-pause-stellar-asset-policy",
    title: "Pause stellar asset policy",
    domain: "OracleGuard",
    contractDefault: ORACLE_GUARD,
    method: "pause_stellar_asset_policy",
    mode: "write",
    description: "Pause one Stellar asset feed during oracle incident response.",
    fields: [
      { key: "caller", label: "Caller", kind: "address" },
      { key: "asset", label: "Asset", kind: "address" },
    ],
  },
  {
    id: "oracle-guard-read-admin",
    title: "Read admin",
    domain: "OracleGuard",
    contractDefault: ORACLE_GUARD,
    method: "admin",
    mode: "read",
    description: "Read current oracle guard admin.",
    fields: [],
  },
  {
    id: "oracle-guard-read-guardian-config",
    title: "Read guardian config",
    domain: "OracleGuard",
    contractDefault: ORACLE_GUARD,
    method: "guardian_config",
    mode: "read",
    description: "Read emergency guardian, expiry and active state.",
    fields: [],
  },
  {
    id: "oracle-guard-read-stellar-asset-policy",
    title: "Read stellar asset policy",
    domain: "OracleGuard",
    contractDefault: ORACLE_GUARD,
    method: "stellar_asset_policy",
    mode: "read",
    description: "Read policy tuple for one Stellar asset.",
    fields: [{ key: "asset", label: "Asset", kind: "address" }],
  },
  {
    id: "oracle-guard-read-stellar-asset-policy-paused",
    title: "Read stellar asset policy paused",
    domain: "OracleGuard",
    contractDefault: ORACLE_GUARD,
    method: "stellar_asset_policy_paused",
    mode: "read",
    description: "Check whether one Stellar asset feed is currently paused.",
    fields: [{ key: "asset", label: "Asset", kind: "address" }],
  },
  {
    id: "oracle-guard-inspect-stellar",
    title: "Inspect stellar asset",
    domain: "OracleGuard",
    contractDefault: ORACLE_GUARD,
    method: "inspect_stellar",
    mode: "read",
    description: "Read current inspected price source for one Stellar asset.",
    fields: [{ key: "asset", label: "Asset", kind: "address" }],
  },
  {
    id: "executor-set-admin",
    title: "Set admin",
    domain: "GovernanceExecutor",
    contractDefault: GOVERNANCE_EXECUTOR_ID,
    method: "set_admin",
    mode: "write",
    description: "Rotate governance executor admin.",
    fields: [
      { key: "caller", label: "Caller", kind: "address" },
      { key: "admin", label: "Admin", kind: "address" },
    ],
  },
  {
    id: "executor-set-governor",
    title: "Set governor",
    domain: "GovernanceExecutor",
    contractDefault: GOVERNANCE_EXECUTOR_ID,
    method: "set_governor",
    mode: "write",
    description: "Set or clear governor (leave empty to clear).",
    fields: [
      { key: "caller", label: "Caller", kind: "address" },
      { key: "governor", label: "Governor (optional)", kind: "optional_address" },
    ],
  },
  {
    id: "executor-set-min-delay",
    title: "Set min delay",
    domain: "GovernanceExecutor",
    contractDefault: GOVERNANCE_EXECUTOR_ID,
    method: "set_min_delay",
    mode: "write",
    description: "Set executor minimum delay in ledgers.",
    fields: [
      { key: "caller", label: "Caller", kind: "address" },
      { key: "min_delay", label: "Min delay", kind: "u32", defaultValue: "20" },
    ],
  },
  {
    id: "executor-set-grace-period",
    title: "Set grace period",
    domain: "GovernanceExecutor",
    contractDefault: GOVERNANCE_EXECUTOR_ID,
    method: "set_grace_period",
    mode: "write",
    description: "Set executor grace period in ledgers.",
    fields: [
      { key: "caller", label: "Caller", kind: "address" },
      { key: "grace_period", label: "Grace period", kind: "u32", defaultValue: "120" },
    ],
  },
  {
    id: "executor-cancel",
    title: "Cancel operation",
    domain: "GovernanceExecutor",
    contractDefault: GOVERNANCE_EXECUTOR_ID,
    method: "cancel",
    mode: "write",
    description: "Cancel scheduled operation by operation id (bytes32 hex).",
    fields: [
      { key: "caller", label: "Caller", kind: "address" },
      { key: "operation_id", label: "Operation id (bytes32 hex)", kind: "bytesn32" },
    ],
  },
  {
    id: "executor-execute",
    title: "Execute operation",
    domain: "GovernanceExecutor",
    contractDefault: GOVERNANCE_EXECUTOR_ID,
    method: "execute",
    mode: "write",
    description: "Execute ready operation by operation id (bytes32 hex).",
    fields: [{ key: "operation_id", label: "Operation id (bytes32 hex)", kind: "bytesn32" }],
  },
  {
    id: "executor-config",
    title: "Read config",
    domain: "GovernanceExecutor",
    contractDefault: GOVERNANCE_EXECUTOR_ID,
    method: "config",
    mode: "read",
    description: "Read executor config (admin/governor/delays).",
    fields: [],
  },
  {
    id: "executor-status",
    title: "Read operation status",
    domain: "GovernanceExecutor",
    contractDefault: GOVERNANCE_EXECUTOR_ID,
    method: "current_operation_status",
    mode: "read",
    description: "Read status enum for one operation id.",
    fields: [{ key: "operation_id", label: "Operation id (bytes32 hex)", kind: "bytesn32" }],
  },
  {
    id: "executor-ready",
    title: "Read is_ready",
    domain: "GovernanceExecutor",
    contractDefault: GOVERNANCE_EXECUTOR_ID,
    method: "is_ready",
    mode: "read",
    description: "Check if operation is executable in current ledger window.",
    fields: [{ key: "operation_id", label: "Operation id (bytes32 hex)", kind: "bytesn32" }],
  },
  {
    id: "executor-operation",
    title: "Read operation",
    domain: "GovernanceExecutor",
    contractDefault: GOVERNANCE_EXECUTOR_ID,
    method: "operation",
    mode: "read",
    description: "Read full queued operation by operation id.",
    fields: [{ key: "operation_id", label: "Operation id (bytes32 hex)", kind: "bytesn32" }],
  },
];

type RawArg =
  | string
  | number
  | boolean
  | null
  | { type: string; value?: unknown }
  | RawArg[]
  | Record<string, unknown>;

const RAW_TEMPLATE = `[
  { "type": "address", "value": "G..." },
  { "type": "u32", "value": 1 }
]`;

function inputModeForField(field: FieldSpec): "text" | "numeric" | "decimal" {
  if (field.presentation === "percent_bps") {
    return "decimal";
  }
  switch (field.kind) {
    case "i32":
    case "u32":
    case "u64":
      return "numeric";
    case "i128":
    case "u128":
      return "numeric";
    default:
      return "text";
  }
}

function fieldHint(field: FieldSpec): string | undefined {
  if (field.presentation === "percent_bps") {
    return "Enter a percentage, e.g. 2.00";
  }
  return field.placeholder ? `Expected format: ${field.placeholder}` : undefined;
}

function parseInteger(raw: string, label: string): bigint {
  const value = raw.trim();
  if (!value) throw new Error(`${label}: required`);
  if (!/^-?\d+$/.test(value)) throw new Error(`${label}: expected integer`);
  return BigInt(value);
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

function parseAddress(raw: string, label: string): xdr.ScVal {
  const value = raw.trim();
  if (!value) throw new Error(`${label}: required`);
  return xdr.ScVal.scvAddress(Address.fromString(value).toScAddress());
}

function parseCsvAddresses(raw: string): string[] {
  return raw
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function parseField(field: FieldSpec, raw: string): xdr.ScVal {
  const value =
    field.presentation === "percent_bps"
      ? parsePercentBps(raw, field.label)
      : raw.trim();
  switch (field.kind) {
    case "address":
      return parseAddress(value, field.label);
    case "optional_address":
      return value ? parseAddress(value, field.label) : xdr.ScVal.scvVoid();
    case "i128":
      return nativeToScVal(parseInteger(value, field.label), { type: "i128" });
    case "u128":
      return nativeToScVal(parseInteger(value, field.label), { type: "u128" });
    case "u64":
      return nativeToScVal(parseInteger(value, field.label), { type: "u64" });
    case "u32":
      return nativeToScVal(Number(parseInteger(value, field.label)), { type: "u32" });
    case "i32":
      return nativeToScVal(Number(parseInteger(value, field.label)), { type: "i32" });
    case "bool":
      return nativeToScVal(value === "true", { type: "bool" });
    case "string":
      return nativeToScVal(value, { type: "string" });
    case "credit_protocol":
      return xdr.ScVal.scvVec([xdr.ScVal.scvSymbol(value || "Blend")]);
    case "incident_class":
      return xdr.ScVal.scvVec([xdr.ScVal.scvSymbol(value || "Oracle")]);
    case "csv_addresses":
      return xdr.ScVal.scvVec(
        parseCsvAddresses(value).map((address) =>
          xdr.ScVal.scvAddress(Address.fromString(address).toScAddress()),
        ),
      );
    case "bytesn32":
      return scValBytesN32(value);
  }
}

function rawToScVal(input: RawArg): xdr.ScVal {
  if (input === null) return xdr.ScVal.scvVoid();
  if (typeof input === "boolean") return nativeToScVal(input, { type: "bool" });
  if (typeof input === "number") return nativeToScVal(Math.trunc(input), { type: "i32" });
  if (typeof input === "string") return nativeToScVal(input, { type: "string" });

  if (Array.isArray(input)) {
    return xdr.ScVal.scvVec(input.map((entry) => rawToScVal(entry)));
  }

  const record = input as { type?: string; value?: unknown; key?: unknown; val?: unknown };
  const type = typeof record.type === "string" ? record.type : "";
  const value = record.value;

  if (!type) {
    throw new Error("Raw arg objects require a `type` field");
  }

  switch (type) {
    case "void":
      return xdr.ScVal.scvVoid();
    case "bool":
      return nativeToScVal(Boolean(value), { type: "bool" });
    case "address":
      return parseAddress(String(value ?? ""), "raw.address");
    case "symbol":
      return xdr.ScVal.scvSymbol(String(value ?? ""));
    case "string":
      return nativeToScVal(String(value ?? ""), { type: "string" });
    case "i32":
      return nativeToScVal(Number(value ?? 0), { type: "i32" });
    case "u32":
      return nativeToScVal(Number(value ?? 0), { type: "u32" });
    case "i128":
      return nativeToScVal(BigInt(String(value ?? "0")), { type: "i128" });
    case "u128":
      return nativeToScVal(BigInt(String(value ?? "0")), { type: "u128" });
    case "u64":
      return nativeToScVal(BigInt(String(value ?? "0")), { type: "u64" });
    case "bytesn32":
      return scValBytesN32(String(value ?? ""));
    case "vec": {
      if (!Array.isArray(value)) throw new Error("raw.vec expects an array value");
      return xdr.ScVal.scvVec(value.map((entry) => rawToScVal(entry as RawArg)));
    }
    case "map": {
      if (!Array.isArray(value)) throw new Error("raw.map expects an array value");
      const entries = (value as Array<{ key: RawArg; val: RawArg }>).map(
        (entry) =>
          new xdr.ScMapEntry({
            key: rawToScVal(entry.key),
            val: rawToScVal(entry.val),
          }),
      );
      return xdr.ScVal.scvMap(entries);
    }
    default:
      throw new Error(`Unsupported raw arg type: ${type}`);
  }
}

function buildInitialValues(spec: ActionSpec, fallbackCaller: string): Record<string, string> {
  const values: Record<string, string> = {};
  for (const field of spec.fields) {
    if (field.key === "caller" && fallbackCaller) {
      values[field.key] = fallbackCaller;
      continue;
    }
    if (field.key === "payer" && fallbackCaller) {
      values[field.key] = fallbackCaller;
      continue;
    }
    if (field.key === "from" && fallbackCaller) {
      values[field.key] = fallbackCaller;
      continue;
    }
    values[field.key] = field.defaultValue ?? "";
  }
  return values;
}

export default function ContractsPage() {
  const [walletsKit, setWalletsKit] = useState<StellarWalletsKit | null>(null);
  const [pubKey, setPubKey] = useState("");
  const [selectedId, setSelectedId] = useState(ACTIONS[0]?.id ?? "");
  const [contractId, setContractId] = useState(ACTIONS[0]?.contractDefault ?? "");
  const [formValues, setFormValues] = useState<Record<string, string>>({});
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [readResult, setReadResult] = useState("");

  const [rawContractId, setRawContractId] = useState("");
  const [rawMethod, setRawMethod] = useState("");
  const [rawArgs, setRawArgs] = useState(RAW_TEMPLATE);
  const [rawStatus, setRawStatus] = useState("");
  const [rawError, setRawError] = useState("");
  const [rawResult, setRawResult] = useState("");
  const [rawLoading, setRawLoading] = useState(false);
  const [confirmIntent, setConfirmIntent] = useState<"preset_write" | "raw_write" | null>(null);
  const pendingGovernedDraftRef = useRef<GovernedActionPackage | null>(null);
  const [governedDraftVersion, setGovernedDraftVersion] = useState(0);

  const selectedAction = useMemo(
    () => ACTIONS.find((action) => action.id === selectedId) ?? ACTIONS[0],
    [selectedId],
  );
  const selectedActionRequiresDao = useMemo(
    () =>
      selectedAction
        ? shouldBlockTypedWrite(selectedAction.mode, selectedAction.domain, selectedAction.method)
        : false,
    [selectedAction],
  );
  const rawWriteRequiresDao = useMemo(
    () =>
      shouldBlockRawWrite({
        mode: "write",
        method: rawMethod,
        contractId: rawContractId,
        governanceExecutorId: GOVERNANCE_EXECUTOR_ID,
      }),
    [rawMethod, rawContractId],
  );
  const typedReviewBullets = useMemo(
    () => [
      `Domain: ${selectedAction?.domain ?? "n/a"}`,
      `Mode: ${selectedAction?.mode === "read" ? "Read-only" : "Write"}`,
      `Action: ${selectedAction?.title ?? "n/a"}`,
      `Target: ${contractId.trim() || "missing contract id"}`,
      `DAO gate: ${selectedActionRequiresDao ? "blocked in this lane" : "not required"}`,
    ],
    [contractId, selectedAction, selectedActionRequiresDao],
  );
  const rawReviewBullets = useMemo(
    () => [
      `Method: ${rawMethod.trim() || "missing method"}`,
      `Target: ${rawContractId.trim() || "missing contract id"}`,
      `Args bytes: ${rawArgs.length}`,
      `DAO gate: ${rawWriteRequiresDao ? "blocked in this lane" : "not required"}`,
    ],
    [rawArgs.length, rawContractId, rawMethod, rawWriteRequiresDao],
  );

  useEffect(() => {
    setWalletsKit(getWalletsKit(["FREIGHTER", "ALBEDO", "XBULL"]));
    const saved = localStorage.getItem("wallet:pubkey");
    if (saved) {
      setPubKey(saved);
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("draft") !== GOVERNED_ACTION_DRAFT_QUERY) return;

    const draft = readGovernedActionDraft();
    window.history.replaceState({}, "", "/contracts");

    if (!draft) {
      setError("Governed action draft missing or invalid.");
      return;
    }

    const draftAction = ACTIONS.find((action) => action.id === draft.actionId);
    if (!draftAction) {
      setError(`Governed action draft targets unknown action ${draft.actionId}.`);
      return;
    }

    pendingGovernedDraftRef.current = draft;
    window.localStorage.removeItem(GOVERNED_ACTION_DRAFT_STORAGE_KEY);
    setSelectedId(draftAction.id);
    setGovernedDraftVersion((current) => current + 1);
  }, []);

  useEffect(() => {
    if (!selectedAction) return;
    const pendingDraft = pendingGovernedDraftRef.current;
    if (pendingDraft && pendingDraft.actionId === selectedAction.id) {
      setContractId(pendingDraft.contractId);
      setFormValues({
        ...buildInitialValues(selectedAction, pubKey),
        ...pendingDraft.fieldValues,
      });
      setReadResult("");
      setStatus(`Loaded governed action draft for ${selectedAction.method}.`);
      setError("");
      pendingGovernedDraftRef.current = null;
      return;
    }
    setContractId(selectedAction.contractDefault || contractId);
    setFormValues(buildInitialValues(selectedAction, pubKey));
    setReadResult("");
    setStatus("");
    setError("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [governedDraftVersion, selectedAction?.id, pubKey]);

  useEffect(() => {
    setRawContractId((current) => current || contractId);
  }, [contractId]);

  const actionGroups = useMemo(() => {
    const byDomain = new Map<ActionSpec["domain"], ActionSpec[]>();
    for (const action of ACTIONS) {
      const group = byDomain.get(action.domain) ?? [];
      group.push(action);
      byDomain.set(action.domain, group);
    }
    return Array.from(byDomain.entries());
  }, []);
  const [mutationMatrixSnapshot, setMutationMatrixSnapshot] = useState(() =>
    buildContractsMutationMatrixSnapshot(),
  );
  const [storageLifecycleSnapshot, setStorageLifecycleSnapshot] = useState(() =>
    buildContractsStorageLifecycleSnapshot(),
  );
  const [securityAuditSnapshot, setSecurityAuditSnapshot] = useState(() =>
    buildContractsSecurityAuditSnapshot(),
  );

  useEffect(() => {
    const controller = new AbortController();
    async function refreshRuntimeMatrices(): Promise<void> {
      try {
        const [mutationResponse, storageResponse, securityAuditResponse] = await Promise.all([
          fetch("/api/contracts/mutation-matrix", {
            cache: "no-store",
            signal: controller.signal,
          }),
          fetch("/api/contracts/storage-lifecycle", {
            cache: "no-store",
            signal: controller.signal,
          }),
          fetch("/api/contracts/security-audit", {
            cache: "no-store",
            signal: controller.signal,
          }),
        ]);
        if (mutationResponse.ok) {
          const mutationSnapshot = await mutationResponse.json();
          setMutationMatrixSnapshot({
            generatedAt: mutationSnapshot.generatedAt,
            entries: mutationSnapshot.entries,
            summary: mutationSnapshot.summary,
          });
        }
        if (storageResponse.ok) {
          const storageSnapshot = await storageResponse.json();
          setStorageLifecycleSnapshot({
            generatedAt: storageSnapshot.generatedAt,
            sourceAccount: storageSnapshot.sourceAccount,
            rpcUrl: storageSnapshot.rpcUrl,
            networkPassphrase: storageSnapshot.networkPassphrase,
            ledgersToExtend: storageSnapshot.ledgersToExtend,
            runbook: storageSnapshot.runbook,
            entries: storageSnapshot.entries,
            summary: storageSnapshot.summary,
          });
        }
        if (securityAuditResponse.ok) {
          const securityAuditSnapshot = await securityAuditResponse.json();
          setSecurityAuditSnapshot({
            generatedAt: securityAuditSnapshot.generatedAt,
            auditDate: securityAuditSnapshot.auditDate,
            scope: securityAuditSnapshot.scope,
            artifact: securityAuditSnapshot.artifact,
            summary: securityAuditSnapshot.summary,
            findings: securityAuditSnapshot.findings,
            invariants: securityAuditSnapshot.invariants,
            releaseGate: securityAuditSnapshot.releaseGate,
            residualRisks: securityAuditSnapshot.residualRisks,
          });
        }
      } catch {
        // Keep the build-time snapshot if the dynamic runtime API is unavailable.
      }
    }

    void refreshRuntimeMatrices();
    return () => controller.abort();
  }, []);

  const updateField = (key: string, value: string): void => {
    setFormValues((current) => ({ ...current, [key]: value }));
  };

  const connect = async (): Promise<void> => {
    try {
      setError("");
      if (!walletsKit) throw new Error("Wallets Kit not initialized");
      const key = await connectWallet(walletsKit);
      setPubKey(key);
      persistWalletPubkey(key);
      setStatus(`Connected ${key}`);
      setFormValues((current) => {
        const next = { ...current };
        if ("caller" in next && !next.caller) next.caller = key;
        if ("payer" in next && !next.payer) next.payer = key;
        if ("from" in next && !next.from) next.from = key;
        return next;
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Wallet connection failed");
    }
  };

  const executePreset = async (): Promise<void> => {
    try {
      if (!selectedAction) return;
      if (!contractId.trim()) throw new Error("Contract ID is required");
      setLoading(true);
      setError("");
      setStatus("");
      setReadResult("");

      if (selectedAction.mode === "write" && selectedActionRequiresDao) {
        throw new Error(
          "Direct write blocked by DAO policy. Queue and execute this mutation via /governance (Governor + Executor).",
        );
      }

      const parsedArgs = selectedAction.fields.map((field) => parseField(field, formValues[field.key] ?? ""));

      if (selectedAction.mode === "read") {
        const result = await simulateContractReadonly(
          contractId.trim(),
          selectedAction.method,
          parsedArgs,
          pubKey || undefined,
        );
        setReadResult(JSON.stringify(scValToNative(result), null, 2));
        setStatus("Read call completed");
        return;
      }

      if (!walletsKit || !pubKey) throw new Error("Connect wallet first");
      const tx = await buildContractInvokeRaw(pubKey, contractId.trim(), selectedAction.method, parsedArgs);
      const signed = await signXdr(walletsKit, tx);
      setStatus(`Submitting ${selectedAction.method}...`);
      const hash = await submitSignedTx(signed);
      await waitForTx(hash);
      setStatus(`Success: ${hash}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Preset action failed");
    } finally {
      setLoading(false);
    }
  };

  const executeRaw = async (mode: "write" | "read"): Promise<void> => {
    try {
      if (!rawContractId.trim()) throw new Error("Raw contract ID is required");
      if (!rawMethod.trim()) throw new Error("Raw method is required");
      setRawLoading(true);
      setRawError("");
      setRawStatus("");
      setRawResult("");
      const parsed = JSON.parse(rawArgs) as RawArg;
      if (!Array.isArray(parsed)) throw new Error("Raw args must be a JSON array");
      const parsedArgs = parsed.map((entry) => rawToScVal(entry));

      if (mode === "read") {
        const result = await simulateContractReadonly(
          rawContractId.trim(),
          rawMethod.trim(),
          parsedArgs,
          pubKey || undefined,
        );
        setRawResult(JSON.stringify(scValToNative(result), null, 2));
        setRawStatus("Raw read call completed");
        return;
      }

      if (
        shouldBlockRawWrite({
          mode,
          method: rawMethod.trim(),
          contractId: rawContractId.trim(),
          governanceExecutorId: GOVERNANCE_EXECUTOR_ID,
        })
      ) {
        throw new Error(
          "Direct write blocked by DAO policy. Queue and execute this mutation via /governance (Governor + Executor).",
        );
      }

      if (!walletsKit || !pubKey) throw new Error("Connect wallet first");
      const tx = await buildContractInvokeRaw(pubKey, rawContractId.trim(), rawMethod.trim(), parsedArgs);
      const signed = await signXdr(walletsKit, tx);
      setRawStatus(`Submitting ${rawMethod}...`);
      const hash = await submitSignedTx(signed);
      await waitForTx(hash);
      setRawStatus(`Success: ${hash}`);
    } catch (e) {
      setRawError(e instanceof Error ? e.message : "Raw call failed");
    } finally {
      setRawLoading(false);
    }
  };

  const runConfirmedAction = async (): Promise<void> => {
    const intent = confirmIntent;
    setConfirmIntent(null);
    if (intent === "preset_write") {
      await executePreset();
      return;
    }
    if (intent === "raw_write") {
      await executeRaw("write");
    }
  };

  return (
    <main className="surface-stack control-room-fidelity-shell contracts-fidelity-shell">
      <header className="surface-stage-header">
        <span className="surface-eyebrow">Contracts</span>
        <h1 className="surface-title">Contract Control Center</h1>
        <p className="surface-description">
          Full on-chain control lane for Arka, Coverage, Manager Tier and Governance Executor methods that were still outside the core operational routes.
        </p>
      </header>

      <section
        className="workflow-signal-grid control-room-signal-grid contracts-operator-summary"
        data-testid="contracts-stage-signals"
      >
        <article className="surface-signal-card workflow-signal-card">
          <span className="workflow-signal-label">Wallet</span>
          <strong className="workflow-signal-value">{pubKey ? "Connected" : "Missing"}</strong>
          <span className="workflow-signal-detail">
            {pubKey ? "Signer ready for write actions." : "Connect to unlock signed write calls."}
          </span>
        </article>
        <article className="surface-signal-card workflow-signal-card">
          <span className="workflow-signal-label">Preset actions</span>
          <strong className="workflow-signal-value">{ACTIONS.length}</strong>
          <span className="workflow-signal-detail">Typed contract action templates available in this control room.</span>
        </article>
        <article className="surface-signal-card workflow-signal-card">
          <span className="workflow-signal-label">Raw lane</span>
          <strong className="workflow-signal-value">Enabled</strong>
          <span className="workflow-signal-detail">Use JSON-typed ScVal arguments to execute methods not covered by templates.</span>
        </article>
      </section>

      <nav className="surface-section-tabs contracts-section-tabs" aria-label="Contracts sections">
        <a href="#contracts-typed-actions">Typed actions</a>
        <a href="#contracts-raw-lane">Raw invoke</a>
        <a href="#contracts-mutation-matrix">Mutation matrix</a>
        <a href="#contracts-storage-lifecycle">Storage lifecycle</a>
        <a href="#contracts-security-audit">Security audit</a>
      </nav>

      <section
        className="surface-grid control-room-single-column control-room-stage-grid contracts-execution-grid contracts-execution-frame-cutover"
        data-testid="contracts-execution-grid"
      >
        <Panel
          id="contracts-typed-actions"
          title="Typed actions"
          subtitle="Select a method template, validate inputs and execute write/read calls against target contracts"
          testId="contracts-preset-panel"
          className="contracts-workspace-panel contracts-command-frame-cutover contracts-typed-workspace-panel contracts-typed-frame-cutover"
          actions={
            <div className="surface-chip-wrap">
              <StatusPill label={selectedAction?.mode === "read" ? "Read call" : "Write call"} tone={selectedAction?.mode === "read" ? "neutral" : "positive"} />
              <StatusPill label={selectedAction?.domain ?? "Domain"} tone="neutral" />
              {selectedAction?.mode === "write" && selectedActionRequiresDao ? (
                <span data-testid="contracts-dao-guard-pill">
                  <StatusPill label="DAO executor required" tone="warning" />
                </span>
              ) : null}
            </div>
          }
        >
          <SurfaceTable
            testId="contracts-preset-table"
            className="contracts-preset-table contracts-control-table-cutover"
            columnsClassName="contracts-preset-table"
            headers={["Control", "Value"]}
          >
            <div className="surface-table-row contracts-preset-table">
              <div className="surface-table-cell surface-table-cell-strong">Action</div>
              <div className="surface-table-cell">
                <select
                  data-testid="contracts-action-select"
                  className="ops-select"
                  value={selectedId}
                  onChange={(event) => setSelectedId(event.target.value)}
                >
                  {actionGroups.map(([domain, items]) => (
                    <optgroup key={domain} label={domain}>
                      {items.map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.title} · {item.method}
                        </option>
                      ))}
                    </optgroup>
                  ))}
                </select>
              </div>
            </div>
            <div className="surface-table-row contracts-preset-table">
              <div className="surface-table-cell surface-table-cell-strong">Contract ID</div>
              <div className="surface-table-cell">
                <input
                  className="ops-input"
                  data-testid="contracts-contract-id-input"
                  value={contractId}
                  onChange={(event) => setContractId(event.target.value)}
                  placeholder="C..."
                />
              </div>
            </div>
            <div className="surface-table-row contracts-preset-table">
              <div className="surface-table-cell surface-table-cell-strong">Method</div>
              <div className="surface-table-cell">
                <code className="ops-mono">{selectedAction?.method}</code>
                <div className="surface-table-subtle">{selectedAction?.description}</div>
              </div>
            </div>
          </SurfaceTable>

          {selectedAction?.mode === "write" && selectedActionRequiresDao ? (
            <div className="surface-note" data-testid="contracts-dao-guard-note">
              Governance mutation: direct wallet execution is blocked in this lane. Use{" "}
              <Link href="/governance" className="surface-inline-link">
                Governance
              </Link>{" "}
              to queue and execute through Governor + Executor.
            </div>
          ) : null}

          <TransactionReviewCard
            title="Typed action review"
            body="This lane is the controlled on-chain surface for typed methods. Reads execute directly here; writes either route to the wallet signer or stay blocked when DAO execution is required."
            bullets={typedReviewBullets}
            tone={
              selectedAction?.mode === "read"
                ? "neutral"
                : selectedActionRequiresDao
                  ? "warning"
                  : "positive"
            }
            testId="contracts-typed-review-card"
          />

          <div className="ops-form-grid contracts-form-grid-cutover">
            {selectedAction?.fields.map((field) => (
              <ActionField
                key={field.key}
                label={field.label}
                hint={fieldHint(field)}
              >
                {field.kind === "bool" ? (
                  <select
                    className="ops-select"
                    value={formValues[field.key] ?? "false"}
                    onChange={(event) => updateField(field.key, event.target.value)}
                    data-testid={`contracts-field-${field.key}`}
                  >
                    <option value="true">true</option>
                    <option value="false">false</option>
                  </select>
                ) : field.kind === "credit_protocol" ? (
                  <select
                    className="ops-select"
                    value={formValues[field.key] ?? "Blend"}
                    onChange={(event) => updateField(field.key, event.target.value)}
                    data-testid={`contracts-field-${field.key}`}
                  >
                    <option value="Blend">Blend</option>
                  </select>
                ) : field.kind === "incident_class" ? (
                  <select
                    className="ops-select"
                    value={formValues[field.key] ?? "Oracle"}
                    onChange={(event) => updateField(field.key, event.target.value)}
                    data-testid={`contracts-field-${field.key}`}
                  >
                    <option value="Oracle">Oracle</option>
                    <option value="Integration">Integration</option>
                    <option value="Unauthorized">Unauthorized</option>
                    <option value="PolicyBreach">PolicyBreach</option>
                    <option value="Exceptional">Exceptional</option>
                  </select>
                ) : (
                  <input
                    className="ops-input"
                    value={formValues[field.key] ?? ""}
                    onChange={(event) => updateField(field.key, event.target.value)}
                    placeholder={field.placeholder ?? ""}
                    inputMode={inputModeForField(field)}
                    spellCheck={field.kind === "string" ? undefined : false}
                    autoCapitalize="none"
                    autoCorrect="off"
                    data-testid={`contracts-field-${field.key}`}
                  />
                )}
              </ActionField>
            ))}
          </div>

          <div className="ops-action-row contracts-action-row-cutover">
            {!pubKey ? (
              <button type="button" onClick={connect} className="surface-button surface-button-primary">
                Connect wallet
              </button>
            ) : (
              <div className="surface-note">
                Wallet <code className="ops-mono">{pubKey}</code>
              </div>
            )}
            <button
              type="button"
              onClick={() =>
                selectedAction?.mode === "write"
                  ? setConfirmIntent("preset_write")
                  : void executePreset()
              }
              disabled={loading || !selectedAction}
              className="surface-button surface-button-primary"
              data-testid="contracts-run-preset-button"
            >
              {selectedAction?.mode === "read" ? "Run read call" : "Run write call"}
            </button>
          </div>

          <TransactionFeedbackRail
            loading={loading}
            loadingLabel={`Executing ${selectedAction?.method ?? "action"}...`}
            status={status}
            error={error}
            statusTestId="contracts-preset-status"
            errorTestId="contracts-preset-error"
          />
          {readResult ? (
            <pre className="surface-code-block" data-testid="contracts-preset-read-result">
              {readResult}
            </pre>
          ) : null}
        </Panel>

        <Panel
          id="contracts-raw-lane"
          title="Raw invoke lane"
          subtitle="Machine-consumable method execution using JSON-typed ScVal arguments"
          testId="contracts-raw-panel"
          className="contracts-workspace-panel contracts-command-frame-cutover contracts-raw-workspace-panel contracts-raw-frame-cutover"
          actions={
            <div className="surface-chip-wrap">
              <StatusPill label="Advanced" tone="warning" />
              <StatusPill label="No placeholders" tone="positive" />
              {rawWriteRequiresDao ? <StatusPill label="DAO executor required" tone="warning" /> : null}
            </div>
          }
        >
          <SurfaceTable
            testId="contracts-raw-table"
            className="contracts-raw-table contracts-control-table-cutover"
            columnsClassName="contracts-raw-table"
            headers={["Raw control", "Value"]}
          >
            <div className="surface-table-row contracts-raw-table">
              <div className="surface-table-cell surface-table-cell-strong">Contract ID</div>
              <div className="surface-table-cell">
                <input
                  className="ops-input"
                  value={rawContractId}
                  onChange={(event) => setRawContractId(event.target.value)}
                  placeholder="C..."
                  data-testid="contracts-raw-contract-input"
                />
              </div>
            </div>
            <div className="surface-table-row contracts-raw-table">
              <div className="surface-table-cell surface-table-cell-strong">Method</div>
              <div className="surface-table-cell">
                <input
                  className="ops-input"
                  value={rawMethod}
                  onChange={(event) => setRawMethod(event.target.value)}
                  placeholder="method_name"
                  data-testid="contracts-raw-method-input"
                />
              </div>
            </div>
            <div className="surface-table-row contracts-raw-table">
              <div className="surface-table-cell surface-table-cell-strong">Args JSON</div>
              <div className="surface-table-cell">
                <textarea
                  className="ops-input ops-textarea"
                  value={rawArgs}
                  onChange={(event) => setRawArgs(event.target.value)}
                  rows={10}
                  data-testid="contracts-raw-args-input"
                />
                <div className="surface-table-subtle">
                  Supported arg types: <code>address</code>, <code>i128</code>, <code>u128</code>, <code>u64</code>, <code>u32</code>, <code>i32</code>, <code>bool</code>, <code>symbol</code>, <code>string</code>, <code>bytesn32</code>, <code>void</code>, <code>vec</code>, <code>map</code>.
                </div>
              </div>
            </div>
          </SurfaceTable>

          {rawWriteRequiresDao ? (
            <div className="surface-note" data-testid="contracts-raw-dao-guard-note">
              This raw write matches a governance mutation policy. Route it through{" "}
              <Link href="/governance" className="surface-inline-link">
                Governance
              </Link>{" "}
              for Governor + Executor execution.
            </div>
          ) : null}

          <TransactionReviewCard
            title="Raw invoke review"
            body="Raw mode accepts JSON-typed ScVal input and is intended for advanced operator use. Reads stay direct here; writes remain wallet-signed and are still blocked when they collide with DAO-governed methods."
            bullets={rawReviewBullets}
            tone={rawWriteRequiresDao ? "warning" : "neutral"}
            testId="contracts-raw-review-card"
          />

          <div className="ops-action-row contracts-action-row-cutover">
            <button
              type="button"
              onClick={() => void executeRaw("read")}
              disabled={rawLoading}
              className="surface-button surface-button-secondary"
              data-testid="contracts-raw-read-button"
            >
              Run raw read
            </button>
            <button
              type="button"
              onClick={() => setConfirmIntent("raw_write")}
              disabled={rawLoading}
              className="surface-button surface-button-primary"
              data-testid="contracts-raw-write-button"
            >
              Run raw write
            </button>
          </div>

          <TransactionFeedbackRail
            loading={rawLoading}
            loadingLabel={`Executing ${rawMethod || "raw call"}...`}
            status={rawStatus}
            error={rawError}
            statusTestId="contracts-raw-status"
            errorTestId="contracts-raw-error"
          />
          {rawResult ? (
            <pre className="surface-code-block" data-testid="contracts-raw-result">
              {rawResult}
            </pre>
          ) : null}
        </Panel>
      </section>
      <TransactionConfirmDialog
        open={confirmIntent !== null}
        title={confirmIntent === "raw_write" ? "Broadcast raw contract write" : "Broadcast typed contract write"}
        body={
          confirmIntent === "raw_write"
            ? "This will sign and submit a raw contract invocation using the current JSON ScVal payload."
            : "This will sign and submit the selected typed contract mutation against the target contract."
        }
        detail={
          confirmIntent === "raw_write"
            ? `${rawMethod.trim() || "missing method"} on ${rawContractId.trim() || "missing contract"}`
            : `${selectedAction?.method ?? "missing method"} on ${contractId.trim() || "missing contract"}`
        }
        bullets={confirmIntent === "raw_write" ? rawReviewBullets : typedReviewBullets}
        confirmLabel={confirmIntent === "raw_write" ? "Run raw write" : "Run typed write"}
        tone={
          confirmIntent === "raw_write"
            ? rawWriteRequiresDao
              ? "critical"
              : "warning"
            : selectedActionRequiresDao
              ? "critical"
              : "warning"
        }
        busy={loading || rawLoading}
        onCancel={() => setConfirmIntent(null)}
        onConfirm={() => void runConfirmedAction()}
        confirmTestId="contracts-confirm-button"
        cancelTestId="contracts-cancel-button"
      />

      <section
        className="contracts-matrix-grid contracts-audit-frame-cutover"
        data-testid="contracts-matrix-grid"
      >
        <Panel
          id="contracts-mutation-matrix"
          title="Critical mutation matrix"
          subtitle="Machine-consumable mutation coverage for wallet-backed /contracts execution and rollback assertions"
          testId="contracts-mutation-matrix-panel"
          className="contracts-workspace-panel contracts-audit-panel-cutover contracts-mutation-workspace-panel contracts-mutation-frame-cutover"
          actions={
            <div className="surface-chip-wrap">
              <StatusPill
                label={`${mutationMatrixSnapshot.summary.ready}/${mutationMatrixSnapshot.summary.total} ready`}
                tone={mutationMatrixSnapshot.summary.blocked > 0 ? "warning" : "positive"}
              />
              <StatusPill label={`${mutationMatrixSnapshot.summary.blocked} blocked`} tone="neutral" />
              <StatusPill
                label={`${mutationMatrixSnapshot.summary.daoExecutorRequired} DAO lane`}
                tone="warning"
              />
              <StatusPill
                label={`${mutationMatrixSnapshot.summary.walletBackedExecutable} wallet lane`}
                tone="positive"
              />
            </div>
          }
        >
          <SurfaceTable
            testId="contracts-mutation-matrix-table"
            className="contracts-mutation-matrix-table contracts-audit-table-cutover"
            columnsClassName="contracts-mutation-matrix-table"
            headers={["Mutation", "Category", "Write", "Readback", "Contract", "Status", "Assurance"]}
          >
            {mutationMatrixSnapshot.entries.map((entry) => (
              <div
                key={entry.id}
                className="surface-table-row contracts-mutation-matrix-table contracts-audit-row-cutover"
                data-testid={`contracts-mutation-matrix-row-${entry.id}`}
              >
                <div className="surface-table-cell">
                  <div className="surface-table-cell-strong">{entry.title}</div>
                  <div className="surface-table-subtle">{entry.description}</div>
                </div>
                <div className="surface-table-cell">
                  <div className="surface-chip-wrap">
                    <StatusPill label={entry.category} tone="neutral" />
                    <StatusPill
                      label={entry.severity}
                      tone={mutationSeverityTone(entry.severity)}
                    />
                    <StatusPill
                      label={formatMutationLane(entry.executionLane)}
                      tone={mutationLaneTone(entry.executionLane)}
                    />
                  </div>
                </div>
                <div className="surface-table-cell">
                  <code className="ops-mono">{entry.writeActionId}</code>
                </div>
                <div className="surface-table-cell">
                  <code className="ops-mono">{entry.readActionId}</code>
                </div>
                <div className="surface-table-cell">
                  {entry.contractRequirement === "runtime_input" ? (
                    <span className="surface-table-subtle">Runtime Arka input</span>
                  ) : (
                    <code className="ops-mono">{entry.contractId ?? "Missing"}</code>
                  )}
                </div>
                <div className="surface-table-cell">
                  <div className="surface-chip-wrap">
                    <StatusPill
                      label={entry.status === "ready" ? "ready" : "blocked"}
                      tone={entry.status === "ready" ? "positive" : "warning"}
                    />
                    {entry.daoExecutorRequired ? (
                      <StatusPill label="DAO" tone="warning" />
                    ) : null}
                  </div>
                </div>
                <div className="surface-table-cell contracts-mutation-assurance">
                  <div>
                    <span className="surface-table-hint">Preconditions</span>
                    <ul className="contracts-mutation-assurance-list">
                      {entry.preconditions.map((precondition) => (
                        <li key={precondition}>{precondition}</li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <span className="surface-table-hint">Post-state</span>
                    <div className="surface-table-subtle">{entry.postStateAssertion}</div>
                  </div>
                  <div>
                    <span className="surface-table-hint">State probe</span>
                    <div className="surface-table-subtle">{entry.stateProbe}</div>
                  </div>
                  <div>
                    <span className="surface-table-hint">Rollback</span>
                    <div className="surface-table-subtle">
                      {entry.rollbackActionId ? (
                        <>
                          <code className="ops-mono">{entry.rollbackActionId}</code>
                          {" · "}
                        </>
                      ) : null}
                      {entry.rollbackStrategy}
                    </div>
                  </div>
                  <div>
                    <span className="surface-table-hint">Risk controls</span>
                    <ul className="contracts-mutation-assurance-list">
                      {entry.riskControls.map((control) => (
                        <li key={control}>{control}</li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <span className="surface-table-hint">E2E</span>
                    <div className="surface-table-subtle">{entry.e2eScenario}</div>
                  </div>
                </div>
              </div>
            ))}
          </SurfaceTable>
        </Panel>
      </section>

      <section
        className="contracts-storage-grid contracts-audit-frame-cutover"
        data-testid="contracts-storage-grid"
      >
        <Panel
          id="contracts-storage-lifecycle"
          title="Storage lifecycle hardening"
          subtitle="Machine-consumable Soroban rent-extension surface for all runtime contracts"
          testId="contracts-storage-lifecycle-panel"
          className="contracts-workspace-panel contracts-audit-panel-cutover contracts-storage-workspace-panel contracts-storage-frame-cutover"
          actions={
            <div className="surface-chip-wrap">
              <StatusPill
                label={`${storageLifecycleSnapshot.summary.ready}/${storageLifecycleSnapshot.summary.total} ready`}
                tone={storageLifecycleSnapshot.summary.blocked > 0 ? "warning" : "positive"}
              />
              <StatusPill
                label={`${storageLifecycleSnapshot.summary.blocked} blocked`}
                tone={storageLifecycleSnapshot.summary.blocked > 0 ? "warning" : "neutral"}
              />
              <StatusPill
                label={`${storageLifecycleSnapshot.summary.optionalMissing} optional missing`}
                tone="neutral"
              />
            </div>
          }
        >
          <div className="surface-note">
            Extend window: <code className="ops-mono">{storageLifecycleSnapshot.ledgersToExtend}</code> ledgers ·
            source account{" "}
            <code className="ops-mono">
              {storageLifecycleSnapshot.sourceAccount ?? "Missing ARKAFUND_STORAGE_EXTEND_SOURCE_ACCOUNT"}
            </code>
          </div>
          <div className="surface-note" data-testid="contracts-storage-runbook-summary">
            Cadence: every {storageLifecycleSnapshot.runbook.defaultCadenceDays} days · warning at{" "}
            <code className="ops-mono">
              {storageLifecycleSnapshot.runbook.warningThresholdLedgers}
            </code>{" "}
            ledgers · live run requires{" "}
            <code className="ops-mono">
              {storageLifecycleSnapshot.runbook.liveRunConfirmationEnv}=
              {storageLifecycleSnapshot.runbook.liveRunConfirmationValue}
            </code>
          </div>
          <div className="surface-chip-wrap" data-testid="contracts-storage-class-coverage">
            {Object.entries(storageLifecycleSnapshot.summary.byStorageClass).map(
              ([storageClass, coverage]) => (
                <StatusPill
                  key={storageClass}
                  label={`${storageClass}: ${coverage.extendable}/${coverage.audited} extendable`}
                  tone={coverage.excluded > 0 ? "neutral" : "positive"}
                />
              ),
            )}
          </div>
          <ul className="surface-note-list" data-testid="contracts-storage-safeguards">
            {storageLifecycleSnapshot.runbook.safeguards.slice(0, 3).map((safeguard) => (
              <li key={safeguard}>{safeguard}</li>
            ))}
          </ul>
          <SurfaceTable
            testId="contracts-storage-lifecycle-table"
            className="contracts-storage-lifecycle-table contracts-audit-table-cutover"
            columnsClassName="contracts-storage-lifecycle-table"
            headers={["Contract", "Category", "Scope", "Env", "Status", "Extend command"]}
          >
            {storageLifecycleSnapshot.entries.map((entry) => (
              <div
                key={entry.id}
                className="surface-table-row contracts-storage-lifecycle-table contracts-audit-row-cutover"
                data-testid={`contracts-storage-lifecycle-row-${entry.id}`}
              >
                <div className="surface-table-cell">
                  <div className="surface-table-cell-strong">{entry.title}</div>
                  <div className="surface-table-subtle">
                    {entry.contractId ? (
                      <code className="ops-mono">{entry.contractId}</code>
                    ) : (
                      "Contract ID missing in runtime config"
                    )}
                  </div>
                </div>
                <div className="surface-table-cell">
                  <StatusPill label={entry.category} tone="neutral" />
                </div>
                <div className="surface-table-cell">
                  <div className="surface-table-cell-strong">
                    {entry.extendScopes.join(" + ")}
                  </div>
                  <div className="surface-table-subtle">
                    audited: {entry.storageClassesAudited.join(", ")}
                  </div>
                  <div className="surface-table-subtle">
                    cadence {entry.cadenceDays}d · warn {entry.warningThresholdLedgers}
                  </div>
                  <div className="surface-table-subtle">{entry.temporaryPolicy}</div>
                </div>
                <div className="surface-table-cell">
                  <code className="ops-mono">{entry.envKey}</code>
                </div>
                <div className="surface-table-cell">
                  <StatusPill
                    label={entry.status}
                    tone={
                      entry.status === "ready"
                        ? "positive"
                        : entry.status === "optional_missing_contract"
                          ? "neutral"
                          : "warning"
                    }
                  />
                </div>
                <div className="surface-table-cell">
                  {entry.command ? (
                    <code className="ops-mono">{entry.command}</code>
                  ) : (
                    <span className="surface-table-subtle">
                      {entry.status === "blocked_missing_source_account"
                        ? "Source account missing for extend command."
                        : entry.required
                          ? "Required contract is missing."
                          : "Optional contract is not configured."}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </SurfaceTable>
        </Panel>
      </section>

      <section
        className="contracts-security-grid contracts-audit-frame-cutover"
        data-testid="contracts-security-grid"
      >
        <Panel
          id="contracts-security-audit"
          title="Internal security audit closeout"
          subtitle="Release artifact for contract invariants, findings, residual risk and blocking status"
          testId="contracts-security-audit-panel"
          className="contracts-workspace-panel contracts-audit-panel-cutover contracts-security-workspace-panel contracts-security-frame-cutover"
          actions={
            <div className="surface-chip-wrap">
              <StatusPill
                label={securityAuditSnapshot.releaseGate.status}
                tone={securityAuditSnapshot.releaseGate.ready ? "positive" : "critical"}
              />
              <StatusPill
                label={`${securityAuditSnapshot.summary.resolved}/${securityAuditSnapshot.summary.findingCount} resolved`}
                tone="positive"
              />
              <StatusPill
                label={`${securityAuditSnapshot.summary.acceptedRisk} accepted risk`}
                tone={securityAuditSnapshot.summary.acceptedRisk > 0 ? "warning" : "neutral"}
              />
              <StatusPill
                label={`${securityAuditSnapshot.summary.failedInvariants} failed invariants`}
                tone={securityAuditSnapshot.summary.failedInvariants > 0 ? "critical" : "positive"}
              />
            </div>
          }
        >
          <div className="surface-note" data-testid="contracts-security-audit-summary">
            Artifact: <code className="ops-mono">{securityAuditSnapshot.artifact}</code> ·
            audit date {securityAuditSnapshot.auditDate} ·
            undocumented critical/high remaining{" "}
            <code className="ops-mono">
              {securityAuditSnapshot.releaseGate.checks.undocumentedCriticalHighRemaining}
            </code>
          </div>
          <div className="surface-chip-wrap" data-testid="contracts-security-domain-summary">
            {Object.entries(securityAuditSnapshot.summary.byDomain).map(([domain, summary]) => (
              <StatusPill
                key={domain}
                label={`${domain.replaceAll("_", " ")}: ${summary.blocking} blocking`}
                tone={summary.blocking > 0 ? "critical" : "positive"}
              />
            ))}
          </div>
          <ul className="surface-note-list" data-testid="contracts-security-scope">
            {securityAuditSnapshot.scope.map((scopeItem) => (
              <li key={scopeItem}>{scopeItem}</li>
            ))}
          </ul>
          <SurfaceTable
            testId="contracts-security-findings-table"
            className="contracts-security-findings-table contracts-audit-table-cutover"
            columnsClassName="contracts-security-findings-table"
            headers={["Finding", "Domain", "Status", "Resolution", "Evidence"]}
          >
            {securityAuditSnapshot.findings.map((finding) => (
              <div
                key={finding.id}
                className="surface-table-row contracts-security-findings-table contracts-audit-row-cutover"
                data-testid={`contracts-security-finding-${finding.id}`}
              >
                <div className="surface-table-cell">
                  <div className="surface-table-cell-strong">
                    {finding.id} · {finding.title}
                  </div>
                  <div className="surface-table-subtle">{finding.risk}</div>
                </div>
                <div className="surface-table-cell">
                  <div className="surface-chip-wrap">
                    <StatusPill label={finding.domain.replaceAll("_", " ")} tone="neutral" />
                    <StatusPill
                      label={finding.severity}
                      tone={securityAuditSeverityTone(finding.severity)}
                    />
                  </div>
                </div>
                <div className="surface-table-cell">
                  <StatusPill
                    label={finding.status.replaceAll("_", " ")}
                    tone={securityAuditStatusTone(finding.status)}
                  />
                </div>
                <div className="surface-table-cell">
                  <div className="surface-table-cell-strong">{finding.resolution}</div>
                  <div className="surface-table-subtle">{finding.residualRisk}</div>
                </div>
                <div className="surface-table-cell contracts-mutation-assurance">
                  <div>
                    <span className="surface-table-hint">Implementation</span>
                    <ul className="contracts-mutation-assurance-list">
                      {finding.implementationRefs.map((ref) => (
                        <li key={ref}>
                          <code className="ops-mono">{ref}</code>
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <span className="surface-table-hint">Tests</span>
                    <ul className="contracts-mutation-assurance-list">
                      {finding.testRefs.map((ref) => (
                        <li key={ref}>
                          <code className="ops-mono">{ref}</code>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            ))}
          </SurfaceTable>
          <SurfaceTable
            testId="contracts-security-invariants-table"
            className="contracts-security-invariants-table contracts-audit-table-cutover"
            columnsClassName="contracts-security-invariants-table"
            headers={["Invariant", "Domain", "Status", "Evidence", "Tests"]}
          >
            {securityAuditSnapshot.invariants.map((invariant) => (
              <div
                key={invariant.id}
                className="surface-table-row contracts-security-invariants-table contracts-audit-row-cutover"
                data-testid={`contracts-security-invariant-${invariant.id}`}
              >
                <div className="surface-table-cell">
                  <div className="surface-table-cell-strong">
                    {invariant.id} · {invariant.statement}
                  </div>
                </div>
                <div className="surface-table-cell">
                  <div className="surface-chip-wrap">
                    <StatusPill label={invariant.domain.replaceAll("_", " ")} tone="neutral" />
                    <StatusPill
                      label={invariant.severity}
                      tone={securityAuditSeverityTone(invariant.severity)}
                    />
                  </div>
                </div>
                <div className="surface-table-cell">
                  <StatusPill
                    label={invariant.status}
                    tone={securityAuditStatusTone(invariant.status)}
                  />
                </div>
                <div className="surface-table-cell">
                  <div className="surface-table-subtle">{invariant.evidence}</div>
                  <ul className="contracts-mutation-assurance-list">
                    {invariant.implementationRefs.map((ref) => (
                      <li key={ref}>
                        <code className="ops-mono">{ref}</code>
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="surface-table-cell">
                  <ul className="contracts-mutation-assurance-list">
                    {invariant.testRefs.map((ref) => (
                      <li key={ref}>
                        <code className="ops-mono">{ref}</code>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            ))}
          </SurfaceTable>
          <ul className="surface-note-list" data-testid="contracts-security-residual-risks">
            {securityAuditSnapshot.residualRisks.map((risk) => (
              <li key={risk}>{risk}</li>
            ))}
          </ul>
        </Panel>
      </section>
    </main>
  );
}
