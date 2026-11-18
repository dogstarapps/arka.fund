import type { AppHealthPayload } from "@/lib/runtime/appHealth";

export interface SettingsEntry {
  key: string;
  value: string;
}

export interface ControlSurfaceRow {
  id: string;
  label: string;
  value: string;
  meta: string;
  state: string;
  sourceLabel?: string;
  mutabilityLabel?: string;
  governanceLabel?: string;
  evaluationLabel?: string;
}

export type GuardrailSourceKind = "contract_storage" | "runtime_env";

export type GuardrailMutability =
  | "dao_governed_contract"
  | "operator_runtime_config";

export interface GuardrailSourceOfTruth {
  id: string;
  label: string;
  source: GuardrailSourceKind;
  sourceLabel: string;
  sourceKey: string;
  mutability: GuardrailMutability;
  mutabilityLabel: string;
  governanceLabel: string;
  envKeys: string[];
  evaluationInputs: string[];
  contractStorageRequired: boolean;
  contractStoragePlan: string;
}

export interface SettingsGroup {
  id: string;
  title: string;
  items: SettingsEntry[];
}

export interface ControlSpotlight {
  id: string;
  label: string;
  value: string;
  meta: string;
  state: string;
  stripPct: number;
  tone: "neutral" | "positive" | "warning";
}

export interface ControlSignal {
  id: string;
  label: string;
  value: string;
  detail: string;
  tone: "neutral" | "positive" | "warning";
}

function formatBpsPercent(value: number): string {
  return `${(value / 100).toFixed(2)}%`;
}

const SETTINGS_GROUP_KEYS = [
  {
    id: "network",
    title: "Network",
    keys: ["NETWORK_PASSPHRASE", "SOROBAN_RPC_URL"],
  },
  {
    id: "contracts",
    title: "Contracts",
    keys: [
      "ARKA_FACTORY",
      "ARKA_REGISTRY",
      "ARKA_ROUTER",
      "ADAPTER_BALANCED",
      "BALANCED_EXPECTED_ROUTER",
      "BALANCED_SUPPORT_STATUS",
      "BALANCED_LANE_MODE",
      "BALANCED_VALIDATED_MODULE",
      "BALANCED_VALIDATED_ROUTER",
      "BALANCED_VALIDATED_AT",
      "AQUARIUS_ADAPTER",
      "SOROSWAP_ADAPTER",
      "SUSHI_ADAPTER",
      "SUSHI_POOL_ID",
      "SUSHI_POOL_ROUTING_PAIR",
      "ADAPTER_BLEND",
      "ROUTING_ASSET_A",
      "ROUTING_ASSET_B",
      "ROUTING_ASSET_A_LABEL",
      "ROUTING_ASSET_B_LABEL",
    ],
  },
  {
    id: "rebalancing",
    title: "Rebalance",
    keys: [
      "REBALANCE_SLIPPAGE_PROFILE",
      "DEFAULT_REBALANCE_SLIPPAGE_PCT",
      "MAX_REBALANCE_SLIPPAGE_PCT",
      "REBALANCE_EXTRA_BUFFER_PCT",
      "REBALANCE_FALLBACK_EXTRA_PCT",
      "REBALANCE_MAX_NOTIONAL_PER_SWAP_BASE",
      "REBALANCE_MAX_PATH_LENGTH",
      "REBALANCE_FORBID_ROUTE_CYCLES",
      "REBALANCE_CHUNKING_THRESHOLD_BASE",
      "REBALANCE_MAX_CHUNK_SIZE_BASE",
      "REBALANCE_POST_TRADE_DEVIATION_BPS",
      "REBALANCE_DAILY_TURNOVER_CAP_BPS",
      "REBALANCE_EMERGENCY_PAUSE_SWAP",
      "REBALANCE_DISABLED_PROTOCOLS",
      "REBALANCE_DISABLED_PROTOCOL_REASON",
    ],
  },
] as const;

const SETTINGS_KEY_LABELS: Record<string, string> = {
  NETWORK_PASSPHRASE: "Network passphrase",
  SOROBAN_RPC_URL: "Soroban RPC URL",
  ARKA_FACTORY: "Arka factory",
  ARKA_REGISTRY: "Arka registry",
  ARKA_ROUTER: "Arka router",
  ADAPTER_BALANCED: "Balanced adapter",
  BALANCED_EXPECTED_ROUTER: "Balanced expected router",
  BALANCED_SUPPORT_STATUS: "Balanced support status",
  BALANCED_LANE_MODE: "Balanced lane mode",
  BALANCED_VALIDATED_MODULE: "Balanced validated module",
  BALANCED_VALIDATED_ROUTER: "Balanced validated router",
  BALANCED_VALIDATED_AT: "Balanced validated at",
  AQUARIUS_ADAPTER: "Aquarius adapter",
  SOROSWAP_ADAPTER: "SoroSwap adapter",
  SUSHI_ADAPTER: "Sushi adapter",
  SUSHI_POOL_ID: "Sushi pool",
  SUSHI_POOL_ROUTING_PAIR: "Sushi routing pair",
  ADAPTER_BLEND: "Blend adapter",
  ROUTING_ASSET_A: "Routing asset A",
  ROUTING_ASSET_B: "Routing asset B",
  ROUTING_ASSET_A_LABEL: "Routing asset A label",
  ROUTING_ASSET_B_LABEL: "Routing asset B label",
  REBALANCE_SLIPPAGE_PROFILE: "Rebalance profile",
  DEFAULT_REBALANCE_SLIPPAGE_PCT: "Default slippage",
  MAX_REBALANCE_SLIPPAGE_PCT: "Maximum slippage",
  REBALANCE_EXTRA_BUFFER_PCT: "Primary buffer",
  REBALANCE_FALLBACK_EXTRA_PCT: "Fallback buffer",
  REBALANCE_MAX_NOTIONAL_PER_SWAP_BASE: "Max notional per swap",
  REBALANCE_MAX_PATH_LENGTH: "Max path length",
  REBALANCE_FORBID_ROUTE_CYCLES: "Route cycle policy",
  REBALANCE_CHUNKING_THRESHOLD_BASE: "Chunking threshold",
  REBALANCE_MAX_CHUNK_SIZE_BASE: "Max chunk size",
  REBALANCE_POST_TRADE_DEVIATION_BPS: "Post-trade deviation",
  REBALANCE_DAILY_TURNOVER_CAP_BPS: "Daily turnover cap",
  REBALANCE_EMERGENCY_PAUSE_SWAP: "Emergency pause",
  REBALANCE_DISABLED_PROTOCOLS: "Disabled protocols",
  REBALANCE_DISABLED_PROTOCOL_REASON: "Disabled protocol reason",
};

function labelForSettingsKey(key: string): string {
  return SETTINGS_KEY_LABELS[key] ?? key
    .toLowerCase()
    .split("_")
    .map((part) => part ? `${part[0]?.toUpperCase()}${part.slice(1)}` : "")
    .join(" ");
}

export const REBALANCE_GUARDRAIL_SOURCE_OF_TRUTH: GuardrailSourceOfTruth[] = [
  {
    id: "default-path",
    label: "Default path",
    source: "runtime_env",
    sourceLabel: "Runtime environment",
    sourceKey: "REBALANCE_SLIPPAGE_PROFILE",
    mutability: "operator_runtime_config",
    mutabilityLabel: "Operator deploy config",
    governanceLabel: "Not DAO-governed on-chain yet",
    envKeys: ["REBALANCE_SLIPPAGE_PROFILE"],
    evaluationInputs: ["route planner profile selection"],
    contractStorageRequired: true,
    contractStoragePlan:
      "Move the rebalance profile into a DAO-owned policy contract before exposing profile changes as executable governance proposals.",
  },
  {
    id: "default-slippage",
    label: "Default slippage",
    source: "runtime_env",
    sourceLabel: "Runtime environment",
    sourceKey: "DEFAULT_REBALANCE_SLIPPAGE_PCT",
    mutability: "operator_runtime_config",
    mutabilityLabel: "Operator deploy config",
    governanceLabel: "Not DAO-governed on-chain yet",
    envKeys: ["DEFAULT_REBALANCE_SLIPPAGE_PCT"],
    evaluationInputs: ["quote slippage envelope"],
    contractStorageRequired: true,
    contractStoragePlan:
      "Persist the default slippage ceiling in DAO-controlled storage before letting Governance mutate it.",
  },
  {
    id: "max-slippage",
    label: "Maximum slippage",
    source: "runtime_env",
    sourceLabel: "Runtime environment",
    sourceKey: "MAX_REBALANCE_SLIPPAGE_PCT",
    mutability: "operator_runtime_config",
    mutabilityLabel: "Operator deploy config",
    governanceLabel: "Not DAO-governed on-chain yet",
    envKeys: ["MAX_REBALANCE_SLIPPAGE_PCT"],
    evaluationInputs: ["quote slippage envelope", "planner hard ceiling"],
    contractStorageRequired: true,
    contractStoragePlan:
      "Persist the hard slippage ceiling in policy storage and route updates through timelock execution.",
  },
  {
    id: "buffers",
    label: "Buffers",
    source: "runtime_env",
    sourceLabel: "Runtime environment",
    sourceKey: "REBALANCE_EXTRA_BUFFER_PCT / REBALANCE_FALLBACK_EXTRA_PCT",
    mutability: "operator_runtime_config",
    mutabilityLabel: "Operator deploy config",
    governanceLabel: "Not DAO-governed on-chain yet",
    envKeys: ["REBALANCE_EXTRA_BUFFER_PCT", "REBALANCE_FALLBACK_EXTRA_PCT"],
    evaluationInputs: ["primary quote cushion", "fallback quote cushion"],
    contractStorageRequired: true,
    contractStoragePlan:
      "Store primary and fallback cushions as DAO policy values before surfacing mutable governance actions.",
  },
  {
    id: "max-notional-per-swap",
    label: "Max notional per swap",
    source: "runtime_env",
    sourceLabel: "Runtime environment",
    sourceKey: "REBALANCE_MAX_NOTIONAL_PER_SWAP_BASE",
    mutability: "operator_runtime_config",
    mutabilityLabel: "Operator deploy config",
    governanceLabel: "DAO storage migration required",
    envKeys: ["REBALANCE_MAX_NOTIONAL_PER_SWAP_BASE"],
    evaluationInputs: ["requested swap amount", "route split planner"],
    contractStorageRequired: true,
    contractStoragePlan:
      "Add DAO-owned storage for per-swap notional caps before allowing policy votes to update this value.",
  },
  {
    id: "path-constraints",
    label: "Path constraints",
    source: "runtime_env",
    sourceLabel: "Runtime environment",
    sourceKey: "REBALANCE_MAX_PATH_LENGTH / REBALANCE_FORBID_ROUTE_CYCLES",
    mutability: "operator_runtime_config",
    mutabilityLabel: "Operator deploy config",
    governanceLabel: "DAO storage migration required",
    envKeys: ["REBALANCE_MAX_PATH_LENGTH", "REBALANCE_FORBID_ROUTE_CYCLES"],
    evaluationInputs: ["route graph", "asset revisit checks"],
    contractStorageRequired: true,
    contractStoragePlan:
      "Move path depth and cycle policy into contract storage if Governance should tune solver boundaries.",
  },
  {
    id: "chunking",
    label: "Chunking",
    source: "runtime_env",
    sourceLabel: "Runtime environment",
    sourceKey: "REBALANCE_CHUNKING_THRESHOLD_BASE / REBALANCE_MAX_CHUNK_SIZE_BASE",
    mutability: "operator_runtime_config",
    mutabilityLabel: "Operator deploy config",
    governanceLabel: "DAO storage migration required",
    envKeys: ["REBALANCE_CHUNKING_THRESHOLD_BASE", "REBALANCE_MAX_CHUNK_SIZE_BASE"],
    evaluationInputs: ["requested swap amount", "chunk planner"],
    contractStorageRequired: true,
    contractStoragePlan:
      "Persist chunk threshold and max chunk size in policy storage before DAO mutation is considered live.",
  },
  {
    id: "post-trade-deviation",
    label: "Post-trade deviation",
    source: "runtime_env",
    sourceLabel: "Runtime environment",
    sourceKey: "REBALANCE_POST_TRADE_DEVIATION_BPS",
    mutability: "operator_runtime_config",
    mutabilityLabel: "Operator deploy config",
    governanceLabel: "DAO storage migration required",
    envKeys: ["REBALANCE_POST_TRADE_DEVIATION_BPS"],
    evaluationInputs: ["pre-sign allocation state", "post-trade allocation estimate"],
    contractStorageRequired: true,
    contractStoragePlan:
      "Store the deviation threshold on-chain; the measured allocation state remains derived at execution time.",
  },
  {
    id: "daily-turnover-cap",
    label: "Daily turnover cap",
    source: "runtime_env",
    sourceLabel: "Runtime environment",
    sourceKey: "REBALANCE_DAILY_TURNOVER_CAP_BPS",
    mutability: "operator_runtime_config",
    mutabilityLabel: "Operator deploy config",
    governanceLabel: "DAO storage migration required",
    envKeys: ["REBALANCE_DAILY_TURNOVER_CAP_BPS"],
    evaluationInputs: ["indexed catalog activity", "visible NAV", "24h execution window"],
    contractStorageRequired: true,
    contractStoragePlan:
      "Persist the turnover cap in DAO policy storage; consumed turnover remains derived from indexed activity.",
  },
  {
    id: "emergency-pause-swap",
    label: "Emergency pause",
    source: "runtime_env",
    sourceLabel: "Runtime environment",
    sourceKey: "REBALANCE_EMERGENCY_PAUSE_SWAP",
    mutability: "operator_runtime_config",
    mutabilityLabel: "Operator deploy config",
    governanceLabel: "DAO storage migration required",
    envKeys: ["REBALANCE_EMERGENCY_PAUSE_SWAP"],
    evaluationInputs: ["route admission gate"],
    contractStorageRequired: true,
    contractStoragePlan:
      "Add a DAO/timelock controlled pause flag before representing emergency pause as an on-chain governance switch.",
  },
  {
    id: "protocol-blocklist",
    label: "Protocol blocklist",
    source: "runtime_env",
    sourceLabel: "Runtime environment",
    sourceKey: "REBALANCE_DISABLED_PROTOCOLS",
    mutability: "operator_runtime_config",
    mutabilityLabel: "Operator deploy config",
    governanceLabel: "DAO storage migration required",
    envKeys: [
      "REBALANCE_DISABLED_PROTOCOLS",
      "REBALANCE_DISABLED_PROTOCOL_REASON",
    ],
    evaluationInputs: ["best-execution admission", "execution handoff"],
    contractStorageRequired: true,
    contractStoragePlan:
      "Mirror the runtime protocol blocklist with DAO-controlled allowed adapter/router storage before claiming the kill-switch is fully governed on-chain.",
  },
];

const GUARDRAIL_SOURCE_BY_ID = new Map(
  REBALANCE_GUARDRAIL_SOURCE_OF_TRUTH.map((entry) => [entry.id, entry]),
);

export function getGuardrailSourceOfTruth(
  id: string,
): GuardrailSourceOfTruth {
  const source = GUARDRAIL_SOURCE_BY_ID.get(id);
  if (!source) throw new Error(`Unknown guardrail source of truth: ${id}`);
  return source;
}

export function buildGuardrailSourceRows(): ControlSurfaceRow[] {
  return REBALANCE_GUARDRAIL_SOURCE_OF_TRUTH.map((source) => ({
    id: source.id,
    label: source.label,
    value: source.sourceLabel,
    meta: `Runtime setting · evaluates ${source.evaluationInputs.join(", ")}`,
    state: source.contractStorageRequired
      ? "Contract storage required"
      : "Contract stored",
    sourceLabel: source.sourceLabel,
    mutabilityLabel: source.mutabilityLabel,
    governanceLabel: source.governanceLabel,
    evaluationLabel: source.evaluationInputs.join(", "),
  }));
}

export function buildGuardrailSourceSummary(): ControlSignal[] {
  const runtimeCount = REBALANCE_GUARDRAIL_SOURCE_OF_TRUTH.filter(
    (source) => source.source === "runtime_env",
  ).length;
  const contractStoredCount = REBALANCE_GUARDRAIL_SOURCE_OF_TRUTH.filter(
    (source) => source.source === "contract_storage",
  ).length;
  const migrationRequiredCount = REBALANCE_GUARDRAIL_SOURCE_OF_TRUTH.filter(
    (source) => source.contractStorageRequired,
  ).length;

  return [
    {
      id: "runtime-source",
      label: "Runtime env",
      value: String(runtimeCount),
      detail: "current source of truth for live rebalance policy values",
      tone: runtimeCount > 0 ? "warning" : "positive",
    },
    {
      id: "contract-source",
      label: "Contract stored",
      value: String(contractStoredCount),
      detail: "guardrails currently mutable through DAO-owned storage",
      tone: contractStoredCount > 0 ? "positive" : "neutral",
    },
    {
      id: "dao-migration",
      label: "DAO migration",
      value: `${migrationRequiredCount} required`,
      detail: "must be moved on-chain before UI labels them DAO-governed",
      tone: migrationRequiredCount > 0 ? "warning" : "positive",
    },
  ];
}

function withGuardrailSource(row: ControlSurfaceRow): ControlSurfaceRow {
  const source = getGuardrailSourceOfTruth(row.id);
  return {
    ...row,
    sourceLabel: source.sourceLabel,
    mutabilityLabel: source.mutabilityLabel,
    governanceLabel: source.governanceLabel,
    evaluationLabel: source.evaluationInputs.join(", "),
  };
}

export function buildSettingsGroups(env: Record<string, string>): SettingsGroup[] {
  return SETTINGS_GROUP_KEYS.map((group) => ({
    id: group.id,
    title: group.title,
    items: group.keys
      .map((key) => ({
        key,
        value: env[key] ?? "",
      }))
      .filter((entry) => entry.value.length > 0),
  })).filter((group) => group.items.length > 0);
}

export function buildSettingsRows(group: SettingsGroup): ControlSurfaceRow[] {
  return group.items.map((item) => ({
    id: `${group.id}-${item.key}`,
    label: labelForSettingsKey(item.key),
    value: item.value,
    meta: `${group.title} configuration`,
    state: item.value.length > 0 ? "Configured" : "Missing",
  }));
}

export function buildGuardrailRows(input: {
  profile: string;
  defaultSlippagePct: number;
  maxSlippagePct: number;
  primaryBufferPct: number;
  fallbackBufferPct: number;
  maxNotionalPerSwapBase?: number;
  maxPathLength?: number;
  forbidRouteCycles?: boolean;
  chunkingThresholdBase?: number;
  maxChunkSizeBase?: number;
  postTradeDeviationBps?: number;
  dailyTurnoverCapBps?: number;
  emergencyPauseSwap?: boolean;
  disabledProtocols?: string;
}): ControlSurfaceRow[] {
  return [
    {
      id: "default-path",
      label: "Default path",
      value: input.profile,
      meta: "Baseline routing profile from runtime configuration",
      state: "standard",
    },
    {
      id: "default-slippage",
      label: "Default slippage",
      value: `${input.defaultSlippagePct}%`,
      meta: "Primary rebalance envelope from runtime configuration",
      state: "Guarded",
    },
    {
      id: "max-slippage",
      label: "Maximum slippage",
      value: `${input.maxSlippagePct}%`,
      meta: "Hard runtime ceiling before re-evaluation",
      state: "Guarded",
    },
    {
      id: "buffers",
      label: "Buffers",
      value: `${input.primaryBufferPct}% / ${input.fallbackBufferPct}%`,
      meta: "Primary and fallback runtime cushions",
      state: "Fallback ready",
    },
    {
      id: "max-notional-per-swap",
      label: "Max notional per swap",
      value:
        input.maxNotionalPerSwapBase !== undefined
          ? `${input.maxNotionalPerSwapBase.toLocaleString()} notional`
          : "not configured",
      meta: "Runtime input ceiling before planner handoff",
      state: "Guarded",
    },
    {
      id: "path-constraints",
      label: "Path constraints",
      value: `${input.maxPathLength ?? "n/a"} hops / ${
        input.forbidRouteCycles === false ? "cycles allowed" : "acyclic"
      }`,
      meta: "Runtime route depth and repeated-asset protection",
      state: "Guarded",
    },
    {
      id: "chunking",
      label: "Chunking",
      value:
        input.chunkingThresholdBase !== undefined &&
        input.maxChunkSizeBase !== undefined
          ? `${input.chunkingThresholdBase.toLocaleString()} / ${input.maxChunkSizeBase.toLocaleString()} notional`
          : "not configured",
      meta: "Runtime chunk threshold for bounded executable allocations",
      state: "Guarded",
    },
    {
      id: "post-trade-deviation",
      label: "Post-trade deviation",
      value:
        input.postTradeDeviationBps !== undefined
          ? formatBpsPercent(input.postTradeDeviationBps)
          : "state required",
      meta: "Runtime threshold evaluated against derived allocation state",
      state: "State checked",
    },
    {
      id: "daily-turnover-cap",
      label: "Daily turnover cap",
      value:
        input.dailyTurnoverCapBps !== undefined
          ? `${formatBpsPercent(input.dailyTurnoverCapBps)} of NAV`
          : "state required",
      meta: "Runtime threshold evaluated against indexed activity and NAV",
      state: "State checked",
    },
    {
      id: "emergency-pause-swap",
      label: "Emergency pause",
      value: input.emergencyPauseSwap ? "paused" : "open",
      meta: "Runtime emergency stop before route execution",
      state: input.emergencyPauseSwap ? "Blocked" : "Open",
    },
    {
      id: "protocol-blocklist",
      label: "Protocol blocklist",
      value: input.disabledProtocols?.trim() || "none",
      meta: "Runtime switch for best-execution admission and execution handoff",
      state: input.disabledProtocols?.trim() ? "Blocked venues" : "Open",
    },
  ].map(withGuardrailSource);
}

export function buildSettingsSpotlights(input: {
  env: Record<string, string>;
  groups: SettingsGroup[];
}): ControlSpotlight[] {
  const rpcConfigured = Boolean(input.env.SOROBAN_RPC_URL);
  const registryConfigured = Boolean(input.env.ARKA_REGISTRY);
  const factoryConfigured = Boolean(input.env.ARKA_FACTORY);
  const profile = input.env.REBALANCE_SLIPPAGE_PROFILE || "n/a";
  const defaultSlippage = input.env.DEFAULT_REBALANCE_SLIPPAGE_PCT || "n/a";
  const maxSlippage = input.env.MAX_REBALANCE_SLIPPAGE_PCT || "n/a";
  const configuredValues = Object.values(input.env).filter((value) => value.length > 0).length;
  const balancedSupport = input.env.BALANCED_SUPPORT_STATUS || "unknown";
  const balancedLaneMode = input.env.BALANCED_LANE_MODE || "undeclared";
  const balancedModule = input.env.BALANCED_VALIDATED_MODULE || "pending";

  return [
    {
      id: "rpc-lane",
      label: "RPC lane",
      value: rpcConfigured ? "Online" : "Missing",
      meta: rpcConfigured
        ? "Primary Soroban RPC is configured for live reads and execution."
        : "No Soroban RPC URL is configured in the current shell.",
      state: rpcConfigured ? "Operator ready" : "Needs action",
      stripPct: rpcConfigured ? 88 : 22,
      tone: rpcConfigured ? "positive" : "warning",
    },
    {
      id: "contract-map",
      label: "Contract map",
      value: `${input.groups.length} sections`,
      meta: `${configuredValues} configured values are currently grouped into network, contracts and rebalance decks. Balanced support is ${balancedSupport} via ${balancedLaneMode}, module ${balancedModule}.`,
      state: "Mapped",
      stripPct: Math.min(100, 34 + configuredValues * 5),
      tone: "neutral",
    },
    {
      id: "registry-route",
      label: "Registry route",
      value: registryConfigured && factoryConfigured ? "Canonical" : "Incomplete",
      meta:
        registryConfigured && factoryConfigured
          ? "Factory and registry discovery lanes are both configured."
          : "Discovery wiring is still missing either the factory or registry contract.",
      state: registryConfigured && factoryConfigured ? "Discovery ready" : "Review wiring",
      stripPct: registryConfigured && factoryConfigured ? 81 : 36,
      tone: registryConfigured && factoryConfigured ? "positive" : "warning",
    },
    {
      id: "guardrail-window",
      label: "Guardrail window",
      value: `${defaultSlippage}% / ${maxSlippage}%`,
      meta: `The active rebalance profile is ${profile}.`,
      state: "Policy active",
      stripPct: 66,
      tone: "neutral",
    },
  ];
}

export function buildSettingsControlSignals(input: {
  env: Record<string, string>;
  groups: SettingsGroup[];
}): ControlSignal[] {
  const configuredValues = Object.values(input.env).filter((value) => value.length > 0).length;
  const rpcConfigured = Boolean(input.env.SOROBAN_RPC_URL);
  const profile = input.env.REBALANCE_SLIPPAGE_PROFILE || "n/a";
  const balancedSupport = input.env.BALANCED_SUPPORT_STATUS || "unknown";
  const balancedLaneMode = input.env.BALANCED_LANE_MODE || "undeclared";
  const balancedModule = input.env.BALANCED_VALIDATED_MODULE || "pending";

  return [
    {
      id: "rpc",
      label: "RPC lane",
      value: rpcConfigured ? "Configured" : "Missing",
      detail: rpcConfigured
        ? "Soroban RPC is available for live reads and signing flows"
        : "no Soroban RPC URL is configured in the current shell",
      tone: rpcConfigured ? "positive" : "warning",
    },
    {
      id: "map",
      label: "Config map",
      value: `${input.groups.length} sections`,
      detail: `${configuredValues} configured values grouped into network, contracts and rebalance decks; Balanced is ${balancedSupport} via ${balancedLaneMode}, module ${balancedModule}`,
      tone: "neutral",
    },
    {
      id: "profile",
      label: "Guardrail profile",
      value: profile,
      detail: "active rebalance profile used by the control room",
      tone: "neutral",
    },
  ];
}

export function buildStatusSpotlights(input: {
  scopeCount: number;
  operatorCount: number;
  limitationCount: number;
  referenceCount: number;
  profile: string;
}): ControlSpotlight[] {
  return [
    {
      id: "validated-scope",
      label: "Validated scope",
      value: `${input.scopeCount} lanes`,
      meta: "Control-room baseline already validated on testnet.",
      state: "Live baseline",
      stripPct: Math.min(100, 28 + input.scopeCount * 14),
      tone: "positive",
    },
    {
      id: "operator-runbook",
      label: "Operator runbook",
      value: `${input.operatorCount} checks`,
      meta: `${input.profile} remains the default operational profile before live actions.`,
      state: "Required",
      stripPct: Math.min(100, 32 + input.operatorCount * 10),
      tone: "neutral",
    },
    {
      id: "watch-items",
      label: "Watch items",
      value: `${input.limitationCount} limits`,
      meta: "These are the known constraints that still need active operator awareness.",
      state: "Monitor closely",
      stripPct: Math.min(100, 30 + input.limitationCount * 12),
      tone: "warning",
    },
    {
      id: "reference-lane",
      label: "Reference lane",
      value: `${input.referenceCount} source`,
      meta: "Primary repository and deployment material used as source of truth.",
      state: "Linked",
      stripPct: Math.min(100, 36 + input.referenceCount * 18),
      tone: "positive",
    },
  ];
}

export function buildStatusControlSignals(input: {
  scopeCount: number;
  operatorCount: number;
  limitationCount: number;
  referenceCount: number;
  profile: string;
}): ControlSignal[] {
  return [
    {
      id: "baseline",
      label: "Validated scope",
      value: `${input.scopeCount} lanes`,
      detail: "testnet baseline already covered by the active runbook",
      tone: "positive",
    },
    {
      id: "operators",
      label: "Operator posture",
      value: `${input.operatorCount} checks`,
      detail: `${input.profile} remains the default live profile before execution`,
      tone: "neutral",
    },
    {
      id: "limits",
      label: "Watch items",
      value: `${input.limitationCount} limits`,
      detail: `${input.referenceCount} primary source links remain attached for escalation`,
      tone: "warning",
    },
  ];
}

export function buildStatusRows(
  items: readonly string[],
  config: {
    prefix: string;
    state: string;
    valueLabel: string;
  },
): ControlSurfaceRow[] {
  return items.map((item, index) => ({
    id: `${config.prefix}-${index + 1}`,
    label: `${config.prefix} ${index + 1}`,
    value: config.valueLabel,
    meta: item,
    state: config.state,
  }));
}

function formatControlContract(value: string | null): string {
  if (!value) return "not set";
  if (value.length <= 16) return value;
  return `${value.slice(0, 8)}…${value.slice(-6)}`;
}

function formatControlProvider(value: string | null | undefined): string {
  if (!value || value.trim().length === 0) return "not declared";
  return value.trim();
}

function deriveOracleCutoverState(snapshot: AppHealthPayload | null): {
  label: string;
  detail: string;
} {
  if (!snapshot) {
    return {
      label: "Unknown",
      detail: "Runtime health snapshot is not available yet.",
    };
  }
  const gate = snapshot.releaseGate?.oracleCutover;
  if (gate?.status === "not_required") {
    return {
      label:
        snapshot.oracle.deployment.targetNetwork === "testnet"
          ? "Testnet verified"
          : "Not required",
      detail:
        "Mainnet publication gate is not enforced for the active testnet runtime.",
    };
  }
  if (gate?.status === "ready") {
    return {
      label: "Mainnet ready",
      detail: `${gate.detail} Oracle guard lane is verified for the active runtime target.`,
    };
  }
  if (gate?.status === "blocked") {
    if (!snapshot.oracle.deployment.fileFound) {
      return {
        label: "Blocked",
        detail: "Target deployments manifest is missing, so mainnet cutover cannot be verified.",
      };
    }
    if (snapshot.oracle.deployment.networkMismatch) {
      return {
        label: "Blocked",
        detail: "Oracle validation network does not match the runtime target network.",
      };
    }
    return {
      label: "Blocked",
      detail: gate.detail,
    };
  }
  if (!snapshot.oracle.deployment.fileFound) {
    return {
      label: "Blocked",
      detail: "Target deployments manifest is missing, so mainnet cutover cannot be verified.",
    };
  }
  if (snapshot.oracle.deployment.networkMismatch) {
    return {
      label: "Blocked",
      detail: "Oracle validation network does not match the runtime target network.",
    };
  }
  if (snapshot.oracle.oracle.mode !== "oracle_guard") {
    return {
      label: "Blocked",
      detail: "Oracle lane is unverified for the active runtime target.",
    };
  }
  return {
    label: "Ready",
    detail: "Oracle guard lane is verified for the active runtime target.",
  };
}

export function buildStatusOracleRows(
  snapshot: AppHealthPayload | null,
): ControlSurfaceRow[] {
  const targetNetwork = snapshot?.oracle.deployment.targetNetwork ?? "testnet";
  const fileFound = snapshot?.oracle.deployment.fileFound ?? false;
  const manifestPath = snapshot?.oracle.deployment.deploymentsPath ?? "not resolved";
  const readError = snapshot?.oracle.deployment.readError;
  const networkMismatch = snapshot?.oracle.deployment.networkMismatch ?? false;
  const mode = snapshot?.oracle.oracle.mode ?? "unverified";
  const guard = formatControlContract(snapshot?.oracle.oracle.oracleGuard ?? null);
  const primary = formatControlContract(snapshot?.oracle.oracle.primaryOracle ?? null);
  const secondary = formatControlContract(snapshot?.oracle.oracle.secondaryOracle ?? null);
  const provider = formatControlProvider(snapshot?.oracle.oracle.provider);
  const primaryProvider = formatControlProvider(snapshot?.oracle.oracle.primaryProvider);
  const secondaryProvider = formatControlProvider(snapshot?.oracle.oracle.secondaryProvider);
  const selectedSource = snapshot?.oracle.oracle.selectedSourceUnderDivergence;
  const cutover = deriveOracleCutoverState(snapshot);

  return [
    {
      id: "oracle-target-network",
      label: "Target network",
      value: targetNetwork,
      meta: `Runtime target selected for deployments resolution (${snapshot?.oracle.deployment.pathSource ?? "network_default"}).`,
      state: "Resolved",
    },
    {
      id: "oracle-manifest",
      label: "Deployments manifest",
      value: fileFound ? "Found" : "Missing",
      meta: `${manifestPath}${readError ? ` (${readError})` : ""}`,
      state: fileFound ? "Loaded" : "Blocked",
    },
    {
      id: "oracle-lane",
      label: "Oracle lane",
      value: mode === "oracle_guard" ? "oracle_guard" : "unverified",
      meta: `guard ${guard} · primary ${primary} · secondary ${secondary}`,
      state: mode === "oracle_guard" ? "Verified" : "Blocked",
    },
    {
      id: "oracle-provider",
      label: "Oracle provider",
      value: provider,
      meta: `primary ${primaryProvider} · secondary ${secondaryProvider} · selected source ${selectedSource ?? "n/a"}`,
      state: provider === "not declared" ? "Undeclared" : "Declared",
    },
    {
      id: "oracle-cutover-gate",
      label: "Cutover gate",
      value: cutover.label,
      meta: networkMismatch
        ? `${cutover.detail} Runtime mismatch flag is active.`
        : cutover.detail,
      state:
        cutover.label === "Ready" || cutover.label === "Mainnet ready"
          ? "Ready"
          : cutover.label === "Blocked"
            ? "Blocked"
            : "Not required",
    },
  ];
}

export function buildStatusRoutingRows(
  snapshot: AppHealthPayload | null,
): ControlSurfaceRow[] {
  const routing = snapshot?.routing;
  const planner = routing?.balancedPlannerAdmission ?? "blocked";
  return [
    {
      id: "routing-solver-mode",
      label: "Solver mode",
      value: routing?.mode ?? "backend_solver_with_local_fallback",
      meta: `Backend planner endpoint ${routing?.planEndpoint ?? "/api/routing/rebalance/plan"} with ${routing?.fallbackMode ?? "local_workflow_solver"}.`,
      state: routing?.backendAvailable ? "Online" : "Fallback",
    },
    {
      id: "routing-balanced-admission",
      label: "Balanced best-execution status",
      value: planner,
      meta: `Support ${routing?.balancedSupportStatus ?? "blocked"} · lane ${routing?.balancedLaneMode ?? "undeclared"}.`,
      state:
        planner === "auto"
          ? "AUTO"
          : planner === "manual_only"
            ? "Manual"
            : "Blocked",
    },
    {
      id: "routing-balanced-quote-parity",
      label: "Balanced quote parity",
      value: routing?.balancedComparableQuote ? "Comparable" : "Not comparable",
      meta: routing?.balancedManualExecutionEligible
        ? "Manual execution lane is available."
        : "Manual execution lane is blocked.",
      state: routing?.balancedComparableQuote ? "Ready" : "Manual lane",
    },
    {
      id: "routing-balanced-auto-surface",
      label: "Balanced AUTO surface gate",
      value: routing?.balancedAutoSurfaceReady ? "Ready" : "Blocked",
      meta:
        routing?.balancedAutoSurfaceReason ??
        "Balanced AUTO surface readiness is unavailable.",
      state: routing?.balancedAutoSurfaceReady ? "Ready" : "Blocked",
    },
    {
      id: "routing-solver-note",
      label: "Solver note",
      value: routing?.generatedAt ?? "n/a",
      meta:
        routing?.note ??
        "Routing solver status snapshot is unavailable; local workflow fallback remains active.",
      state: routing?.backendAvailable ? "Live" : "Fallback",
    },
  ];
}

export const STATUS_SCOPE_ITEMS = [
  "Live testnet deployment across the main operator flows, including create, deposit, redeem, rebalance and governed execution paths.",
  "Catalog-backed views for dashboard, discovery, Arka profiles, managers and assets.",
  "Documented contract IDs, validation scripts and testnet evidence kept as the working source of truth.",
] as const;

export const STATUS_OPERATOR_STEPS = [
  "Use the configured Stellar network and connect a funded wallet before running any live flow.",
  "Confirm trustlines for tracked assets before using the creation, deposit or execution routes.",
  "Keep `standard` as the default slippage profile; `micro_liquidity` remains opt-in for targeted validation only.",
  "Create new Arkas from the Create route, then continue strategy activation from the vault execution page.",
] as const;

export function buildStatusOperatorSteps(
  networkLiveLabel: string,
  trackedAssets: readonly string[] = [],
): string[] {
  const normalized = networkLiveLabel.trim().toLowerCase();
  const networkName = normalized.includes("mainnet")
    ? "Stellar Mainnet"
    : normalized.includes("testnet")
      ? "Stellar Testnet"
      : "the configured Stellar network";
  const trackedAssetLabels = trackedAssets
    .map((asset) => asset.trim())
    .filter((asset) => asset.length > 0);
  const trackedAssetSummary =
    trackedAssetLabels.length > 1
      ? `${trackedAssetLabels.slice(0, -1).join(", ")} and ${trackedAssetLabels.at(-1)}`
      : trackedAssetLabels[0] ?? "tracked assets";
  return [
    `Use ${networkName} and connect a funded wallet before running any live flow.`,
    `Confirm trustlines for ${trackedAssetSummary} before using the creation, deposit or execution routes.`,
    ...STATUS_OPERATOR_STEPS.slice(2),
  ];
}

export const STATUS_LIMITATIONS = [
  "Rebalance orchestration still spans multiple transactions; the full root-owned on-chain path is not the default route yet.",
  "Single-hop swaps remain the default operational path while the routing stack is hardened further.",
  "Production denomination enforcement and additional modularization remain part of the remaining hardening pass.",
] as const;

export const STATUS_REFERENCE_LINKS = [
  {
    href: "https://github.com/dogstarapps/arka.fund",
    label: "Contracts repository (arka.fund)",
  },
] as const;
