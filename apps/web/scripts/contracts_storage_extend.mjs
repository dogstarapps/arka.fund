#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { writeFileSync } from "node:fs";

const DEFAULT_LEDGER_EXTEND_WINDOW = 518_400;
const DEFAULT_CADENCE_DAYS = 14;
const WARNING_THRESHOLD_LEDGERS = 120_960;
const CRITICAL_THRESHOLD_LEDGERS = 17_280;
const LIVE_CONFIRM_ENV = "ARKAFUND_STORAGE_EXTEND_CONFIRM";
const LIVE_CONFIRM_VALUE = "EXTEND_STORAGE_TTL";
const STORAGE_CLASSES_AUDITED = ["persistent", "instance", "temporary"];
const EXTEND_SCOPES = ["persistent_contract_data", "instance_contract_state"];
const TEMPORARY_POLICY =
  "Temporary storage is audited for presence and intentionally excluded from the extend command; temporary entries must be recreated by the owning transaction path instead of force-extended.";

const CONTRACTS = [
  {
    id: "arka-factory",
    title: "Arka Factory",
    envKey: "NEXT_PUBLIC_ARKA_FACTORY",
    defaultContractId: "CAZPR5MIUHXH46ZJ5OAMRZXD7PXIHMF5HHSSKQPDUBEXVID5SAGSZ3HW",
    required: true,
    category: "core",
  },
  {
    id: "arka-registry",
    title: "Arka Registry",
    envKey: "NEXT_PUBLIC_ARKA_REGISTRY",
    defaultContractId: "CD7NVBDWH7YDCAJGPESKANQMQGNC2FCNX7WBUIRWWKF4QI5NMPRP22NW",
    required: true,
    category: "core",
  },
  {
    id: "arka-router",
    title: "Arka Router",
    envKey: "NEXT_PUBLIC_ARKA_ROUTER",
    defaultContractId: "CAARCDANGZNLDR7CF5MRUA32VUBD6KAZMTNTVJKA5ISQHHKYMP7YFTTI",
    required: true,
    category: "routing",
  },
  {
    id: "soroswap-adapter",
    title: "SoroSwap adapter",
    envKey: "NEXT_PUBLIC_SOROSWAP_ADAPTER",
    defaultContractId: "CAMK4EWIQIMLGVISSFRVLWIRABRNDTJ4HPIY6LEEFN6RUJMSNVUK7VDS",
    required: true,
    category: "routing",
  },
  {
    id: "aquarius-adapter",
    title: "Aquarius adapter",
    envKey: "NEXT_PUBLIC_AQUARIUS_ADAPTER",
    defaultContractId: "CANPOLXWOTJHKDMIECWZ66IRWX2EEXMTIBF7FFA2WH5DAJVSUDL243BM",
    required: true,
    category: "routing",
  },
  {
    id: "balanced-adapter",
    title: "Balanced adapter",
    envKey: "NEXT_PUBLIC_ADAPTER_BALANCED",
    defaultContractId: "CDYF5QMFETJPMJZVLO7ZRL2KA4B4Y7F24Z33HH62NJL3GEQQXXLCCRLC",
    required: true,
    category: "routing",
  },
  {
    id: "blend-adapter",
    title: "Blend adapter",
    envKey: "NEXT_PUBLIC_ADAPTER_BLEND",
    defaultContractId: "CADVUIKDYSEHWNWFMUACMUUVXA7GNNVFVIHO365FG2YGQU7OKEOUXCHX",
    required: true,
    category: "routing",
  },
  {
    id: "coverage-fund",
    title: "Coverage Fund",
    envKey: "NEXT_PUBLIC_COVERAGE_FUND",
    defaultContractId: "CCX5QACCFXC3VNMKUHBUZ2NGD2HNU6W47G3E3LBGPAK2DWX63FERA3MO",
    required: true,
    category: "coverage",
  },
  {
    id: "coverage-vault",
    title: "Coverage Vault",
    envKey: "NEXT_PUBLIC_COVERAGE_VAULT",
    defaultContractId: "CCLEUWT6NSMIP2QFGHRIERDM453X24GC56ZNZH7VVEDVQ5JRNNRFB5BL",
    required: true,
    category: "coverage",
  },
  {
    id: "claims-manager",
    title: "Claims Manager",
    envKey: "NEXT_PUBLIC_CLAIMS_MANAGER",
    defaultContractId: "CBBTR7VED6ZZTK3Z2ZVOWUFSP574UQGO4C2JK6YUUBSH4FPJ2GB4VF5P",
    required: true,
    category: "coverage",
  },
  {
    id: "locked-arka",
    title: "Locked Arka",
    envKey: "NEXT_PUBLIC_LOCKED_ARKA",
    defaultContractId: "CAUE46HQDGXCP5RUFN4CEU7KOSOWG2UGJIXZRNAPXZFYBC55PH4NGZAC",
    required: true,
    category: "governance",
  },
  {
    id: "manager-tier",
    title: "Manager Tier",
    envKey: "NEXT_PUBLIC_MANAGER_TIER",
    defaultContractId: "CDQVWIBJDX3K3XS4OLL4HFFSG2KKQGOZU7TIFCLMXFDCJDRDOQLB6FGR",
    required: true,
    category: "governance",
  },
  {
    id: "governor",
    title: "Governor",
    envKey: "NEXT_PUBLIC_GOVERNOR_ID",
    defaultContractId: "CBU6HR77QR3QYQCJI6K3F7YBR5NXBXJ33TFK7NUDTV6TE6SP672L5V6V",
    required: true,
    category: "governance",
  },
  {
    id: "votes",
    title: "Votes",
    envKey: "NEXT_PUBLIC_VOTES_ID",
    defaultContractId: "CADJC5R6DRD3SMDVQB7FGPTMO2FTYRHQNRV3G7YRE6B5VJNG7OM3FPTK",
    required: true,
    category: "governance",
  },
  {
    id: "governance-executor",
    title: "Governance Executor",
    envKey: "NEXT_PUBLIC_GOVERNANCE_EXECUTOR_ID",
    defaultContractId: "",
    required: false,
    category: "governance",
  },
  {
    id: "oracle-guard",
    title: "Oracle Guard",
    envKey: "NEXT_PUBLIC_ORACLE_GUARD",
    defaultContractId: "CBVIUEY2C627QSVCKNC4XSVSHRH3DTRK6HQOBOQVJBIXKUKJDH5E22BZ",
    required: true,
    category: "oracle",
  },
];

function printUsage() {
  console.log(`
Usage:
  node ./scripts/contracts_storage_extend.mjs [--dry-run] [--execute] [--json] [--ledgers-to-extend <n>] [--source-account <source>] [--only <id1,id2,...>] [--plan-json <path>] [--evidence-json <path>]

Behavior:
  - Defaults to dry-run. Live execution requires --execute and ${LIVE_CONFIRM_ENV}=${LIVE_CONFIRM_VALUE}.
  - Extends persistent Soroban storage TTL for configured contracts using:
      stellar contract extend --id <contractId> --durability persistent --ledgers-to-extend <n> --source-account <source>
  - Prints the exact plan and command list before any execution attempt.
  - Has no deploy, invoke, delete, reset or destructive mutation path.
  - Reads contract IDs from NEXT_PUBLIC_* env variables.
  - Exits non-zero if any required contract ID is missing or any extend command fails.

Environment fallbacks:
  - source-account: ARKAFUND_STORAGE_EXTEND_SOURCE_ACCOUNT -> STELLAR_ACCOUNT -> NEXT_PUBLIC_ARKA_MANAGER
  - ledgers-to-extend: ARKAFUND_STORAGE_EXTEND_LEDGERS -> ${DEFAULT_LEDGER_EXTEND_WINDOW}
  - rpc-url: STELLAR_RPC_URL -> NEXT_PUBLIC_SOROBAN_RPC_URL
  - network-passphrase: STELLAR_NETWORK_PASSPHRASE -> NEXT_PUBLIC_STELLAR_NETWORK
`.trim());
}

function parseArgs(argv) {
  const result = {
    dryRun: true,
    execute: false,
    json: false,
    ledgersToExtend: NaN,
    sourceAccount: "",
    only: null,
    confirm: "",
    planJsonPath: "",
    evidenceJsonPath: "",
  };

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === "--help" || token === "-h") {
      printUsage();
      process.exit(0);
    }
    if (token === "--dry-run") {
      result.dryRun = true;
      result.execute = false;
      continue;
    }
    if (token === "--execute") {
      result.execute = true;
      result.dryRun = false;
      continue;
    }
    if (token === "--json") {
      result.json = true;
      continue;
    }
    if (token === "--ledgers-to-extend") {
      result.ledgersToExtend = Number(argv[index + 1] ?? "");
      index += 1;
      continue;
    }
    if (token === "--source-account") {
      result.sourceAccount = String(argv[index + 1] ?? "");
      index += 1;
      continue;
    }
    if (token === "--only") {
      result.only = new Set(
        String(argv[index + 1] ?? "")
          .split(",")
          .map((value) => value.trim())
          .filter(Boolean),
      );
      index += 1;
      continue;
    }
    if (token === "--confirm") {
      result.confirm = String(argv[index + 1] ?? "");
      index += 1;
      continue;
    }
    if (token === "--plan-json") {
      result.planJsonPath = String(argv[index + 1] ?? "");
      index += 1;
      continue;
    }
    if (token === "--evidence-json") {
      result.evidenceJsonPath = String(argv[index + 1] ?? "");
      index += 1;
      continue;
    }
    throw new Error(`Unknown argument: ${token}`);
  }

  return result;
}

function resolveSourceAccount(args) {
  return (
    args.sourceAccount.trim() ||
    (process.env.ARKAFUND_STORAGE_EXTEND_SOURCE_ACCOUNT ?? "").trim() ||
    (process.env.STELLAR_ACCOUNT ?? "").trim() ||
    (process.env.NEXT_PUBLIC_ARKA_MANAGER ?? "").trim() ||
    ""
  );
}

function resolveLedgersToExtend(args) {
  if (Number.isFinite(args.ledgersToExtend) && args.ledgersToExtend > 0) {
    return Math.trunc(args.ledgersToExtend);
  }
  const envValue = Number(
    process.env.ARKAFUND_STORAGE_EXTEND_LEDGERS ?? String(DEFAULT_LEDGER_EXTEND_WINDOW),
  );
  if (Number.isFinite(envValue) && envValue > 0) {
    return Math.trunc(envValue);
  }
  return DEFAULT_LEDGER_EXTEND_WINDOW;
}

function buildCommandArgs(contractId, sourceAccount, ledgersToExtend) {
  const args = [
    "contract",
    "extend",
    "--id",
    contractId,
    "--durability",
    "persistent",
    "--ledgers-to-extend",
    String(ledgersToExtend),
    "--source-account",
    sourceAccount,
  ];
  const rpcUrl = (process.env.STELLAR_RPC_URL ?? process.env.NEXT_PUBLIC_SOROBAN_RPC_URL ?? "").trim();
  if (rpcUrl) {
    args.push("--rpc-url", rpcUrl);
  }
  const networkPassphrase = (
    process.env.STELLAR_NETWORK_PASSPHRASE ??
    process.env.NEXT_PUBLIC_STELLAR_NETWORK ??
    ""
  ).trim();
  if (networkPassphrase) {
    args.push("--network-passphrase", networkPassphrase);
  }
  return args;
}

function shellQuote(value) {
  if (/^[A-Za-z0-9_./:=,+-]+$/.test(value)) return value;
  return JSON.stringify(value);
}

function summarize(entries) {
  const summary = {
    total: entries.length,
    ready: 0,
    blocked: 0,
    optionalMissing: 0,
    byCategory: {},
    byStorageClass: Object.fromEntries(
      STORAGE_CLASSES_AUDITED.map((storageClass) => [
        storageClass,
        { audited: 0, extendable: 0, excluded: 0 },
      ]),
    ),
  };
  for (const entry of entries) {
    if (!summary.byCategory[entry.category]) {
      summary.byCategory[entry.category] = {
        total: 0,
        ready: 0,
        blocked: 0,
        optionalMissing: 0,
      };
    }
    summary.byCategory[entry.category].total += 1;
    if (entry.status === "ready") {
      summary.ready += 1;
      summary.byCategory[entry.category].ready += 1;
    } else if (entry.status === "optional_missing_contract") {
      summary.optionalMissing += 1;
      summary.byCategory[entry.category].optionalMissing += 1;
    } else {
      summary.blocked += 1;
      summary.byCategory[entry.category].blocked += 1;
    }
    for (const storageClass of entry.storageClassesAudited) {
      summary.byStorageClass[storageClass].audited += 1;
      const extendable =
        (storageClass === "persistent" &&
          entry.extendScopes.includes("persistent_contract_data")) ||
        (storageClass === "instance" &&
          entry.extendScopes.includes("instance_contract_state"));
      if (extendable) {
        summary.byStorageClass[storageClass].extendable += 1;
      } else {
        summary.byStorageClass[storageClass].excluded += 1;
      }
    }
  }
  return summary;
}

function commandAllowed(commandArgs) {
  return (
    commandArgs[0] === "contract" &&
    commandArgs[1] === "extend" &&
    commandArgs.includes("--durability") &&
    commandArgs.includes("persistent")
  );
}

function planHash(plan) {
  return createHash("sha256")
    .update(
      JSON.stringify({
        mode: plan.mode,
        ledgersToExtend: plan.ledgersToExtend,
        sourceAccount: plan.sourceAccount,
        entries: plan.entries.map((entry) => ({
          id: entry.id,
          contractId: entry.contractId,
          status: entry.status,
          commandArgs: entry.commandArgs,
        })),
      }),
    )
    .digest("hex");
}

function buildPlan(parsed) {
  const sourceAccount = resolveSourceAccount(parsed);
  const ledgersToExtend = resolveLedgersToExtend(parsed);
  const rpcUrl = (process.env.STELLAR_RPC_URL ?? process.env.NEXT_PUBLIC_SOROBAN_RPC_URL ?? "").trim();
  const networkPassphrase = (
    process.env.STELLAR_NETWORK_PASSPHRASE ??
    process.env.NEXT_PUBLIC_STELLAR_NETWORK ??
    ""
  ).trim();
  const selectedContracts =
    parsed.only && parsed.only.size > 0
      ? CONTRACTS.filter((entry) => parsed.only.has(entry.id))
      : CONTRACTS;
  const unknownSelected =
    parsed.only && parsed.only.size > 0
      ? Array.from(parsed.only).filter(
          (id) => !CONTRACTS.some((entry) => entry.id === id),
        )
      : [];

  if (selectedContracts.length === 0) {
    throw new Error("No contracts selected for extension.");
  }

  const entries = selectedContracts.map((entry) => {
    const contractId = (
      process.env[entry.envKey] ??
      entry.defaultContractId ??
      ""
    ).trim();
    let status = "ready";
    if (!contractId) {
      status = entry.required
        ? "blocked_missing_contract"
        : "optional_missing_contract";
    } else if (!sourceAccount) {
      status = "blocked_missing_source_account";
    }
    const commandArgs =
      status === "ready"
        ? buildCommandArgs(contractId, sourceAccount, ledgersToExtend)
        : [];
    const command =
      commandArgs.length > 0
        ? `stellar ${commandArgs.map(shellQuote).join(" ")}`
        : null;
    return {
      id: entry.id,
      title: entry.title,
      category: entry.category,
      envKey: entry.envKey,
      required: entry.required,
      contractId: contractId || null,
      status,
      storageClassesAudited: STORAGE_CLASSES_AUDITED,
      extendScopes: EXTEND_SCOPES,
      durability: "persistent",
      cadenceDays: DEFAULT_CADENCE_DAYS,
      warningThresholdLedgers: WARNING_THRESHOLD_LEDGERS,
      criticalThresholdLedgers: CRITICAL_THRESHOLD_LEDGERS,
      temporaryPolicy: TEMPORARY_POLICY,
      ledgersToExtend,
      sourceAccount: sourceAccount || null,
      rpcUrl: rpcUrl || null,
      networkPassphrase: networkPassphrase || null,
      commandArgs,
      command,
      commandAllowed: commandArgs.length === 0 || commandAllowed(commandArgs),
      destructive: false,
    };
  });

  const confirmation =
    parsed.confirm.trim() || (process.env[LIVE_CONFIRM_ENV] ?? "").trim();
  const liveRunConfirmMatched = confirmation === LIVE_CONFIRM_VALUE;
  const blockedEntries = entries.filter(
    (entry) =>
      entry.status === "blocked_missing_contract" ||
      entry.status === "blocked_missing_source_account",
  );
  const disallowedCommands = entries.filter((entry) => !entry.commandAllowed);
  const plan = {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    mode: parsed.execute ? "execute" : "dry_run",
    dryRun: !parsed.execute,
    selectedIds: selectedContracts.map((entry) => entry.id),
    unknownSelected,
    sourceAccount: sourceAccount || null,
    rpcUrl: rpcUrl || null,
    networkPassphrase: networkPassphrase || null,
    ledgersToExtend,
    runbook: {
      cadenceDays: DEFAULT_CADENCE_DAYS,
      warningThresholdLedgers: WARNING_THRESHOLD_LEDGERS,
      criticalThresholdLedgers: CRITICAL_THRESHOLD_LEDGERS,
      liveRunConfirmationEnv: LIVE_CONFIRM_ENV,
      liveRunConfirmationValue: LIVE_CONFIRM_VALUE,
    },
    safeguards: {
      defaultsToDryRun: true,
      requiresExplicitExecute: true,
      liveRunConfirmMatched,
      destructiveOperations: false,
      commandAllowlist: ["stellar contract extend"],
      blockedEntryCount: blockedEntries.length,
      disallowedCommandCount: disallowedCommands.length,
    },
    entries,
    summary: summarize(entries),
  };
  return { ...plan, planHash: planHash(plan) };
}

function printPlan(plan) {
  console.log(`[plan] Storage lifecycle ${plan.mode} plan`);
  console.log(`[plan] hash ${plan.planHash}`);
  console.log(
    `[plan] entries=${plan.summary.total} ready=${plan.summary.ready} blocked=${plan.summary.blocked} optional_missing=${plan.summary.optionalMissing}`,
  );
  console.log(
    `[plan] source=${plan.sourceAccount ?? "missing"} ledgers=${plan.ledgersToExtend} destructive=false`,
  );
  for (const entry of plan.entries) {
    console.log(`[entry] ${entry.id} ${entry.status} ${entry.contractId ?? "missing"}`);
    console.log(`  storage=${entry.storageClassesAudited.join(",")} scope=${entry.extendScopes.join(",")}`);
    if (entry.command) {
      console.log(`  ${entry.command}`);
    } else {
      console.log(`  no command: ${entry.status}`);
    }
  }
}

function writeJsonFile(path, payload) {
  if (!path) return;
  writeFileSync(path, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
}

function run() {
  const parsed = parseArgs(process.argv.slice(2));
  const plan = buildPlan(parsed);
  const failures = [];
  const executed = [];

  writeJsonFile(parsed.planJsonPath, plan);
  if (parsed.json) {
    console.log(JSON.stringify(plan, null, 2));
  } else {
    printPlan(plan);
  }

  if (plan.unknownSelected.length > 0) {
    throw new Error(`Unknown contract id(s) in --only: ${plan.unknownSelected.join(", ")}`);
  }
  if (!parsed.execute) {
    return;
  }
  if (!plan.safeguards.liveRunConfirmMatched) {
    throw new Error(
      `Live execution requires ${LIVE_CONFIRM_ENV}=${LIVE_CONFIRM_VALUE} or --confirm ${LIVE_CONFIRM_VALUE}.`,
    );
  }
  if (plan.safeguards.blockedEntryCount > 0) {
    throw new Error("Live execution blocked by missing required contract IDs or source account.");
  }
  if (plan.safeguards.disallowedCommandCount > 0) {
    throw new Error("Live execution blocked because a command fell outside the allowlist.");
  }

  for (const entry of plan.entries) {
    if (entry.status !== "ready") {
      continue;
    }
    try {
      execFileSync("stellar", entry.commandArgs, { stdio: "inherit" });
      executed.push(entry.id);
    } catch (error) {
      failures.push(`${entry.id}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  if (failures.length > 0) {
    throw new Error(
      `Failed to extend one or more contracts:\n${failures.join("\n")}`,
    );
  }

  const evidence = {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    planHash: plan.planHash,
    mode: plan.mode,
    executed,
    failures,
    destructiveOperations: false,
  };
  writeJsonFile(parsed.evidenceJsonPath, evidence);
  if (!parsed.json) {
    console.log(
      `[done] Storage lifecycle extend completed for ${executed.length} contract(s) with ${plan.ledgersToExtend} ledgers.`,
    );
  }
}

try {
  run();
} catch (error) {
  console.error(
    `[error] ${error instanceof Error ? error.message : String(error)}`,
  );
  process.exit(1);
}
