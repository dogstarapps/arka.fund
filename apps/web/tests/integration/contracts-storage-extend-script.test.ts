import { spawnSync } from "node:child_process";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = process.cwd();
const SCRIPT = join(ROOT, "scripts/contracts_storage_extend.mjs");
const SOURCE_ACCOUNT =
  "GCO7KAJ7WCIFDLAEDHKSFQRNQLR3SQ6JTIVSMYYFUC5KRTA2KG2QJYDE";

function runScript(args: string[], env: Record<string, string | undefined> = {}) {
  return spawnSync("node", [SCRIPT, ...args], {
    cwd: ROOT,
    env: {
      ...process.env,
      ...env,
      NEXT_PUBLIC_GOVERNANCE_EXECUTOR_ID: "",
      STELLAR_RPC_URL: "https://soroban-testnet.stellar.org",
      STELLAR_NETWORK_PASSPHRASE: "Test SDF Network ; September 2015",
    },
    encoding: "utf8",
  });
}

describe("contracts storage extend script", () => {
  it("prints an exact dry-run plan without executing a live command", () => {
    const result = runScript([
      "--dry-run",
      "--json",
      "--only",
      "arka-factory,oracle-guard",
      "--source-account",
      SOURCE_ACCOUNT,
      "--ledgers-to-extend",
      "200000",
    ]);

    expect(result.status).toBe(0);
    expect(result.stderr).toBe("");
    const payload = JSON.parse(result.stdout) as {
      mode: "dry_run";
      dryRun: boolean;
      planHash: string;
      safeguards: {
        defaultsToDryRun: boolean;
        requiresExplicitExecute: boolean;
        destructiveOperations: boolean;
        commandAllowlist: string[];
      };
      entries: Array<{
        id: string;
        status: string;
        command: string;
        commandArgs: string[];
        commandAllowed: boolean;
        destructive: boolean;
        storageClassesAudited: string[];
        extendScopes: string[];
        temporaryPolicy: string;
      }>;
    };

    expect(payload.mode).toBe("dry_run");
    expect(payload.dryRun).toBe(true);
    expect(payload.planHash).toMatch(/^[a-f0-9]{64}$/);
    expect(payload.safeguards.defaultsToDryRun).toBe(true);
    expect(payload.safeguards.requiresExplicitExecute).toBe(true);
    expect(payload.safeguards.destructiveOperations).toBe(false);
    expect(payload.safeguards.commandAllowlist).toEqual(["stellar contract extend"]);
    expect(payload.entries.map((entry) => entry.id)).toEqual([
      "arka-factory",
      "oracle-guard",
    ]);
    expect(
      payload.entries.every(
        (entry) =>
          entry.status === "ready" &&
          entry.command.startsWith("stellar contract extend") &&
          entry.commandArgs.includes("--durability") &&
          entry.commandArgs.includes("persistent") &&
          entry.commandArgs.includes("--ledgers-to-extend") &&
          entry.commandArgs.includes("200000") &&
          entry.commandAllowed &&
          !entry.destructive &&
          entry.storageClassesAudited.includes("persistent") &&
          entry.storageClassesAudited.includes("instance") &&
          entry.storageClassesAudited.includes("temporary") &&
          entry.extendScopes.includes("persistent_contract_data") &&
          entry.extendScopes.includes("instance_contract_state") &&
          entry.temporaryPolicy.includes("intentionally excluded"),
      ),
    ).toBe(true);
  });

  it("blocks live execution without explicit confirmation before invoking stellar", () => {
    const result = runScript([
      "--execute",
      "--json",
      "--only",
      "arka-factory",
      "--source-account",
      SOURCE_ACCOUNT,
    ]);

    expect(result.status).not.toBe(0);
    const payload = JSON.parse(result.stdout) as {
      mode: "execute";
      safeguards: {
        liveRunConfirmMatched: boolean;
        destructiveOperations: boolean;
      };
      entries: Array<{ id: string; command: string }>;
    };
    expect(payload.mode).toBe("execute");
    expect(payload.safeguards.liveRunConfirmMatched).toBe(false);
    expect(payload.safeguards.destructiveOperations).toBe(false);
    expect(payload.entries[0]?.command).toContain("stellar contract extend");
    expect(result.stderr).toContain("Live execution requires");
  });

  it("keeps dry-run non-destructive even when the source account is missing", () => {
    const result = runScript(["--dry-run", "--json", "--only", "arka-factory"], {
      ARKAFUND_STORAGE_EXTEND_SOURCE_ACCOUNT: "",
      STELLAR_ACCOUNT: "",
      NEXT_PUBLIC_ARKA_MANAGER: "",
    });

    expect(result.status).toBe(0);
    const payload = JSON.parse(result.stdout) as {
      dryRun: boolean;
      safeguards: {
        blockedEntryCount: number;
        destructiveOperations: boolean;
      };
      entries: Array<{ status: string; command: string | null }>;
    };
    expect(payload.dryRun).toBe(true);
    expect(payload.safeguards.blockedEntryCount).toBe(1);
    expect(payload.safeguards.destructiveOperations).toBe(false);
    expect(payload.entries[0]).toMatchObject({
      status: "blocked_missing_source_account",
      command: null,
    });
  });
});
