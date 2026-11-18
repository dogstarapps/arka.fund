import {
  ADAPTER_BALANCED,
  ADAPTER_BLEND,
  AQUARIUS_ADAPTER,
  ARKA_FACTORY,
  ARKA_REGISTRY,
  ARKA_ROUTER,
  CLAIMS_MANAGER,
  COVERAGE_FUND,
  COVERAGE_VAULT,
  GOVERNANCE_EXECUTOR_ID,
  GOVERNOR_ID,
  LOCKED_ARKA,
  MANAGER_TIER,
  ORACLE_GUARD,
  SOROSWAP_ADAPTER,
  VOTES_ID,
} from "@/lib/config";

export type ContractsStorageLifecycleCategory =
  | "core"
  | "routing"
  | "coverage"
  | "governance"
  | "oracle";

export type ContractsStorageClass = "persistent" | "instance" | "temporary";

export type ContractsStorageLifecycleStatus =
  | "ready"
  | "blocked_missing_contract"
  | "blocked_missing_source_account"
  | "optional_missing_contract";

export type ContractsStorageExtendDurability = "persistent";

export type ContractsStorageExtendScope =
  | "persistent_contract_data"
  | "instance_contract_state"
  | "temporary_contract_data";

type ContractStorageLifecycleDefinition = {
  id: string;
  title: string;
  category: ContractsStorageLifecycleCategory;
  envKey: string;
  defaultContractId: string;
  required: boolean;
  storageClassesAudited: readonly ContractsStorageClass[];
  extendScopes: readonly ContractsStorageExtendScope[];
  temporaryPolicy: string;
};

export type ContractsStorageLifecycleEntry = {
  id: string;
  title: string;
  category: ContractsStorageLifecycleCategory;
  envKey: string;
  required: boolean;
  contractId: string | null;
  status: ContractsStorageLifecycleStatus;
  storageClassesAudited: ContractsStorageClass[];
  extendScopes: ContractsStorageExtendScope[];
  durability: ContractsStorageExtendDurability;
  cadenceDays: number;
  warningThresholdLedgers: number;
  criticalThresholdLedgers: number;
  temporaryPolicy: string;
  runbookStepIds: string[];
  ledgersToExtend: number;
  sourceAccount: string | null;
  rpcUrl: string | null;
  networkPassphrase: string | null;
  commandArgs: string[];
  command: string | null;
};

export type ContractsStorageLifecycleSummary = {
  total: number;
  ready: number;
  blocked: number;
  optionalMissing: number;
  byCategory: Record<
    ContractsStorageLifecycleCategory,
    {
      total: number;
      ready: number;
      blocked: number;
      optionalMissing: number;
    }
  >;
  byStorageClass: Record<
    ContractsStorageClass,
    {
      audited: number;
      extendable: number;
      excluded: number;
    }
  >;
};

export type ContractsStorageLifecycleRunbook = {
  title: string;
  defaultCadenceDays: number;
  warningThresholdLedgers: number;
  criticalThresholdLedgers: number;
  defaultLedgersToExtend: number;
  requiredSignerEnv: string;
  dryRunCommand: string;
  liveRunCommand: string;
  liveRunConfirmationEnv: string;
  liveRunConfirmationValue: string;
  rehearsalNetwork: "testnet";
  rehearsalEvidence: {
    status: "documented";
    date: string;
    artifact: string;
    command: string;
  };
  safeguards: string[];
};

export type ContractsStorageLifecycleSnapshot = {
  generatedAt: string;
  sourceAccount: string | null;
  rpcUrl: string | null;
  networkPassphrase: string | null;
  ledgersToExtend: number;
  runbook: ContractsStorageLifecycleRunbook;
  entries: ContractsStorageLifecycleEntry[];
  summary: ContractsStorageLifecycleSummary;
};

const STORAGE_CLASSES: readonly ContractsStorageClass[] = [
  "persistent",
  "instance",
  "temporary",
];

const EXTENDABLE_STORAGE_SCOPES: readonly ContractsStorageExtendScope[] = [
  "persistent_contract_data",
  "instance_contract_state",
];

const DEFAULT_LEDGER_EXTEND_WINDOW = 518_400;
const DEFAULT_CADENCE_DAYS = 14;
const DEFAULT_WARNING_THRESHOLD_LEDGERS = 120_960;
const DEFAULT_CRITICAL_THRESHOLD_LEDGERS = 17_280;

const DEFAULT_STORAGE_CLASSES_AUDITED = STORAGE_CLASSES;
const DEFAULT_EXTEND_SCOPES = EXTENDABLE_STORAGE_SCOPES;
const DEFAULT_TEMPORARY_POLICY =
  "Temporary storage is audited for presence and intentionally excluded from the extend command; temporary entries must be recreated by the owning transaction path instead of force-extended.";

const STORAGE_RUNBOOK: ContractsStorageLifecycleRunbook = {
  title: "Arka.fund Soroban storage lifecycle runbook",
  defaultCadenceDays: DEFAULT_CADENCE_DAYS,
  warningThresholdLedgers: DEFAULT_WARNING_THRESHOLD_LEDGERS,
  criticalThresholdLedgers: DEFAULT_CRITICAL_THRESHOLD_LEDGERS,
  defaultLedgersToExtend: DEFAULT_LEDGER_EXTEND_WINDOW,
  requiredSignerEnv: "ARKAFUND_STORAGE_EXTEND_SOURCE_ACCOUNT",
  dryRunCommand: "npm run contracts:extend-storage",
  liveRunCommand:
    "ARKAFUND_STORAGE_EXTEND_CONFIRM=EXTEND_STORAGE_TTL node ./scripts/contracts_storage_extend.mjs --execute --json",
  liveRunConfirmationEnv: "ARKAFUND_STORAGE_EXTEND_CONFIRM",
  liveRunConfirmationValue: "EXTEND_STORAGE_TTL",
  rehearsalNetwork: "testnet",
  rehearsalEvidence: {
    status: "documented",
    date: "2026-05-20",
    artifact: "docs/STORAGE_LIFECYCLE_RUNBOOK_2026-05-20.md",
    command:
      "node ./scripts/contracts_storage_extend.mjs --dry-run --json --only arka-factory,arka-registry,oracle-guard",
  },
  safeguards: [
    "The script defaults to dry-run; live execution requires --execute plus ARKAFUND_STORAGE_EXTEND_CONFIRM=EXTEND_STORAGE_TTL.",
    "Every planned row prints the exact stellar contract extend command before any execution attempt.",
    "Only stellar contract extend is allowed; the script has no deploy, invoke, restore, delete or reset path.",
    "Missing required contract IDs or missing source account block live execution.",
    "Temporary storage is never force-extended by this operator path; it is documented as recreate-on-use storage.",
  ],
};

const STORAGE_LIFECYCLE_DEFINITIONS: readonly ContractStorageLifecycleDefinition[] = [
  {
    id: "arka-factory",
    title: "Arka Factory",
    category: "core",
    envKey: "NEXT_PUBLIC_ARKA_FACTORY",
    defaultContractId: ARKA_FACTORY,
    required: true,
    storageClassesAudited: DEFAULT_STORAGE_CLASSES_AUDITED,
    extendScopes: DEFAULT_EXTEND_SCOPES,
    temporaryPolicy: DEFAULT_TEMPORARY_POLICY,
  },
  {
    id: "arka-registry",
    title: "Arka Registry",
    category: "core",
    envKey: "NEXT_PUBLIC_ARKA_REGISTRY",
    defaultContractId: ARKA_REGISTRY,
    required: true,
    storageClassesAudited: DEFAULT_STORAGE_CLASSES_AUDITED,
    extendScopes: DEFAULT_EXTEND_SCOPES,
    temporaryPolicy: DEFAULT_TEMPORARY_POLICY,
  },
  {
    id: "arka-router",
    title: "Arka Router",
    category: "routing",
    envKey: "NEXT_PUBLIC_ARKA_ROUTER",
    defaultContractId: ARKA_ROUTER,
    required: true,
    storageClassesAudited: DEFAULT_STORAGE_CLASSES_AUDITED,
    extendScopes: DEFAULT_EXTEND_SCOPES,
    temporaryPolicy: DEFAULT_TEMPORARY_POLICY,
  },
  {
    id: "soroswap-adapter",
    title: "SoroSwap adapter",
    category: "routing",
    envKey: "NEXT_PUBLIC_SOROSWAP_ADAPTER",
    defaultContractId: SOROSWAP_ADAPTER,
    required: true,
    storageClassesAudited: DEFAULT_STORAGE_CLASSES_AUDITED,
    extendScopes: DEFAULT_EXTEND_SCOPES,
    temporaryPolicy: DEFAULT_TEMPORARY_POLICY,
  },
  {
    id: "aquarius-adapter",
    title: "Aquarius adapter",
    category: "routing",
    envKey: "NEXT_PUBLIC_AQUARIUS_ADAPTER",
    defaultContractId: AQUARIUS_ADAPTER,
    required: true,
    storageClassesAudited: DEFAULT_STORAGE_CLASSES_AUDITED,
    extendScopes: DEFAULT_EXTEND_SCOPES,
    temporaryPolicy: DEFAULT_TEMPORARY_POLICY,
  },
  {
    id: "balanced-adapter",
    title: "Balanced adapter",
    category: "routing",
    envKey: "NEXT_PUBLIC_ADAPTER_BALANCED",
    defaultContractId: ADAPTER_BALANCED,
    required: true,
    storageClassesAudited: DEFAULT_STORAGE_CLASSES_AUDITED,
    extendScopes: DEFAULT_EXTEND_SCOPES,
    temporaryPolicy: DEFAULT_TEMPORARY_POLICY,
  },
  {
    id: "blend-adapter",
    title: "Blend adapter",
    category: "routing",
    envKey: "NEXT_PUBLIC_ADAPTER_BLEND",
    defaultContractId: ADAPTER_BLEND,
    required: true,
    storageClassesAudited: DEFAULT_STORAGE_CLASSES_AUDITED,
    extendScopes: DEFAULT_EXTEND_SCOPES,
    temporaryPolicy: DEFAULT_TEMPORARY_POLICY,
  },
  {
    id: "coverage-fund",
    title: "Coverage Fund",
    category: "coverage",
    envKey: "NEXT_PUBLIC_COVERAGE_FUND",
    defaultContractId: COVERAGE_FUND,
    required: true,
    storageClassesAudited: DEFAULT_STORAGE_CLASSES_AUDITED,
    extendScopes: DEFAULT_EXTEND_SCOPES,
    temporaryPolicy: DEFAULT_TEMPORARY_POLICY,
  },
  {
    id: "coverage-vault",
    title: "Coverage Vault",
    category: "coverage",
    envKey: "NEXT_PUBLIC_COVERAGE_VAULT",
    defaultContractId: COVERAGE_VAULT,
    required: true,
    storageClassesAudited: DEFAULT_STORAGE_CLASSES_AUDITED,
    extendScopes: DEFAULT_EXTEND_SCOPES,
    temporaryPolicy: DEFAULT_TEMPORARY_POLICY,
  },
  {
    id: "claims-manager",
    title: "Claims Manager",
    category: "coverage",
    envKey: "NEXT_PUBLIC_CLAIMS_MANAGER",
    defaultContractId: CLAIMS_MANAGER,
    required: true,
    storageClassesAudited: DEFAULT_STORAGE_CLASSES_AUDITED,
    extendScopes: DEFAULT_EXTEND_SCOPES,
    temporaryPolicy: DEFAULT_TEMPORARY_POLICY,
  },
  {
    id: "locked-arka",
    title: "Locked Arka",
    category: "governance",
    envKey: "NEXT_PUBLIC_LOCKED_ARKA",
    defaultContractId: LOCKED_ARKA,
    required: true,
    storageClassesAudited: DEFAULT_STORAGE_CLASSES_AUDITED,
    extendScopes: DEFAULT_EXTEND_SCOPES,
    temporaryPolicy: DEFAULT_TEMPORARY_POLICY,
  },
  {
    id: "manager-tier",
    title: "Manager Tier",
    category: "governance",
    envKey: "NEXT_PUBLIC_MANAGER_TIER",
    defaultContractId: MANAGER_TIER,
    required: true,
    storageClassesAudited: DEFAULT_STORAGE_CLASSES_AUDITED,
    extendScopes: DEFAULT_EXTEND_SCOPES,
    temporaryPolicy: DEFAULT_TEMPORARY_POLICY,
  },
  {
    id: "governor",
    title: "Governor",
    category: "governance",
    envKey: "NEXT_PUBLIC_GOVERNOR_ID",
    defaultContractId: GOVERNOR_ID,
    required: true,
    storageClassesAudited: DEFAULT_STORAGE_CLASSES_AUDITED,
    extendScopes: DEFAULT_EXTEND_SCOPES,
    temporaryPolicy: DEFAULT_TEMPORARY_POLICY,
  },
  {
    id: "votes",
    title: "Votes",
    category: "governance",
    envKey: "NEXT_PUBLIC_VOTES_ID",
    defaultContractId: VOTES_ID,
    required: true,
    storageClassesAudited: DEFAULT_STORAGE_CLASSES_AUDITED,
    extendScopes: DEFAULT_EXTEND_SCOPES,
    temporaryPolicy: DEFAULT_TEMPORARY_POLICY,
  },
  {
    id: "governance-executor",
    title: "Governance Executor",
    category: "governance",
    envKey: "NEXT_PUBLIC_GOVERNANCE_EXECUTOR_ID",
    defaultContractId: GOVERNANCE_EXECUTOR_ID,
    required: false,
    storageClassesAudited: DEFAULT_STORAGE_CLASSES_AUDITED,
    extendScopes: DEFAULT_EXTEND_SCOPES,
    temporaryPolicy: DEFAULT_TEMPORARY_POLICY,
  },
  {
    id: "oracle-guard",
    title: "Oracle Guard",
    category: "oracle",
    envKey: "NEXT_PUBLIC_ORACLE_GUARD",
    defaultContractId: ORACLE_GUARD,
    required: true,
    storageClassesAudited: DEFAULT_STORAGE_CLASSES_AUDITED,
    extendScopes: DEFAULT_EXTEND_SCOPES,
    temporaryPolicy: DEFAULT_TEMPORARY_POLICY,
  },
];

const CATEGORIES: readonly ContractsStorageLifecycleCategory[] = [
  "core",
  "routing",
  "coverage",
  "governance",
  "oracle",
];

function resolveSourceAccount(env: Record<string, string | undefined>): string {
  return (
    env.ARKAFUND_STORAGE_EXTEND_SOURCE_ACCOUNT ??
    env.STELLAR_ACCOUNT ??
    env.NEXT_PUBLIC_ARKA_MANAGER ??
    ""
  )
    .trim();
}

function resolveLedgersToExtend(env: Record<string, string | undefined>): number {
  const parsed = Number(
    env.ARKAFUND_STORAGE_EXTEND_LEDGERS ?? String(DEFAULT_LEDGER_EXTEND_WINDOW),
  );
  if (Number.isFinite(parsed) && parsed > 0) {
    return Math.trunc(parsed);
  }
  return DEFAULT_LEDGER_EXTEND_WINDOW;
}

function shellQuote(value: string): string {
  if (/^[A-Za-z0-9_./:=,+-]+$/.test(value)) {
    return value;
  }
  return JSON.stringify(value);
}

function buildExtendCommandArgs(input: {
  contractId: string;
  sourceAccount: string;
  ledgersToExtend: number;
  rpcUrl: string | null;
  networkPassphrase: string | null;
}): string[] {
  const args = [
    "contract",
    "extend",
    "--id",
    input.contractId,
    "--durability",
    "persistent",
    "--ledgers-to-extend",
    String(input.ledgersToExtend),
    "--source-account",
    input.sourceAccount,
  ];
  if (input.rpcUrl) {
    args.push("--rpc-url", input.rpcUrl);
  }
  if (input.networkPassphrase) {
    args.push("--network-passphrase", input.networkPassphrase);
  }
  return args;
}

export function buildContractsStorageLifecycleSnapshot(
  env: Record<string, string | undefined> = process.env,
  nowIso = new Date().toISOString(),
): ContractsStorageLifecycleSnapshot {
  const sourceAccount = resolveSourceAccount(env);
  const rpcUrl = (env.STELLAR_RPC_URL ?? env.NEXT_PUBLIC_SOROBAN_RPC_URL ?? "").trim();
  const networkPassphrase = (
    env.STELLAR_NETWORK_PASSPHRASE ??
    env.NEXT_PUBLIC_STELLAR_NETWORK ??
    ""
  ).trim();
  const ledgersToExtend = resolveLedgersToExtend(env);

  const entries = STORAGE_LIFECYCLE_DEFINITIONS.map((definition) => {
    const rawContractId =
      (env[definition.envKey] ?? definition.defaultContractId ?? "").trim();
    const contractId = rawContractId || null;
    let status: ContractsStorageLifecycleStatus;
    if (!contractId) {
      status = definition.required
        ? "blocked_missing_contract"
        : "optional_missing_contract";
    } else if (!sourceAccount) {
      status = "blocked_missing_source_account";
    } else {
      status = "ready";
    }

    const commandArgs =
      status === "ready"
        ? buildExtendCommandArgs({
            contractId: contractId ?? "",
            sourceAccount,
            ledgersToExtend,
            rpcUrl: rpcUrl || null,
            networkPassphrase: networkPassphrase || null,
          })
        : [];
    const command =
      commandArgs.length > 0
        ? `stellar ${commandArgs.map(shellQuote).join(" ")}`
        : null;
    return {
      id: definition.id,
      title: definition.title,
      category: definition.category,
      envKey: definition.envKey,
      required: definition.required,
      contractId,
      status,
      storageClassesAudited: [...definition.storageClassesAudited],
      extendScopes: [...definition.extendScopes],
      durability: "persistent",
      cadenceDays: STORAGE_RUNBOOK.defaultCadenceDays,
      warningThresholdLedgers: STORAGE_RUNBOOK.warningThresholdLedgers,
      criticalThresholdLedgers: STORAGE_RUNBOOK.criticalThresholdLedgers,
      temporaryPolicy: definition.temporaryPolicy,
      runbookStepIds: [
        "inspect-runtime-config",
        "dry-run-plan",
        "review-commands",
        "execute-with-explicit-confirmation",
        "record-evidence",
      ],
      ledgersToExtend,
      sourceAccount: sourceAccount || null,
      rpcUrl: rpcUrl || null,
      networkPassphrase: networkPassphrase || null,
      commandArgs,
      command,
    } satisfies ContractsStorageLifecycleEntry;
  });

  const byCategory = Object.fromEntries(
    CATEGORIES.map((category) => [
      category,
      {
        total: 0,
        ready: 0,
        blocked: 0,
        optionalMissing: 0,
      },
    ]),
  ) as ContractsStorageLifecycleSummary["byCategory"];

  for (const entry of entries) {
    byCategory[entry.category].total += 1;
    if (entry.status === "ready") {
      byCategory[entry.category].ready += 1;
    } else if (entry.status === "optional_missing_contract") {
      byCategory[entry.category].optionalMissing += 1;
    } else {
      byCategory[entry.category].blocked += 1;
    }
  }

  const ready = entries.filter((entry) => entry.status === "ready").length;
  const optionalMissing = entries.filter(
    (entry) => entry.status === "optional_missing_contract",
  ).length;
  const byStorageClass = Object.fromEntries(
    STORAGE_CLASSES.map((storageClass) => {
      const audited = entries.filter((entry) =>
        entry.storageClassesAudited.includes(storageClass),
      ).length;
      const extendable = entries.filter((entry) => {
        if (storageClass === "persistent") {
          return entry.extendScopes.includes("persistent_contract_data");
        }
        if (storageClass === "instance") {
          return entry.extendScopes.includes("instance_contract_state");
        }
        return false;
      }).length;
      return [
        storageClass,
        {
          audited,
          extendable,
          excluded: audited - extendable,
        },
      ];
    }),
  ) as ContractsStorageLifecycleSummary["byStorageClass"];

  return {
    generatedAt: nowIso,
    sourceAccount: sourceAccount || null,
    rpcUrl: rpcUrl || null,
    networkPassphrase: networkPassphrase || null,
    ledgersToExtend,
    runbook: STORAGE_RUNBOOK,
    entries,
    summary: {
      total: entries.length,
      ready,
      blocked: entries.length - ready - optionalMissing,
      optionalMissing,
      byCategory,
      byStorageClass,
    },
  };
}
