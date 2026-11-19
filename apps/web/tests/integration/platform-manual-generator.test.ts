import { spawnSync } from "node:child_process";
import {
  mkdtempSync,
  readFileSync,
  rmSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

const scriptPath = resolve(process.cwd(), "scripts/generate_platform_manual.mjs");
const tempRoots: string[] = [];

function makeTempRoot(): string {
  const root = mkdtempSync(join(tmpdir(), "arkafund-platform-manual-"));
  tempRoots.push(root);
  return root;
}

describe("platform manual generator", () => {
  afterEach(() => {
    for (const root of tempRoots.splice(0)) {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("renders the route-complete final manual with screenshots, claims and blockers", () => {
    const root = makeTempRoot();
    const outputPath = join(root, "manual.md");

    const result = spawnSync("node", [scriptPath, "--output", outputPath], {
      encoding: "utf8",
    });

    expect(result.status, result.stderr).toBe(0);
    const manual = readFileSync(outputPath, "utf8");
    expect(manual).toContain("# Arka.fund Final Platform Manual");
    expect(manual).toContain("Captured screens: **29**");
    expect(manual).toContain("Public/read captures: **20**");
    expect(manual).toContain("Verified-operator captures: **9**");
    expect(manual).toContain("T26 testnet dress rehearsal is not yet complete");
    expect(manual).toContain("T27 final mainnet cutover is intentionally pending");
    expect(manual).toContain("### 1. Dashboard shell");
    expect(manual).toContain("### 29. Integration Ops");
    expect(manual).toContain("![DAO Console]");
    expect(manual).toContain("src/lib/runtime/productionEnvironmentGate.ts");
    expect(manual).toContain("e2e/design-audit.spec.ts");
    expect(manual).not.toMatch(/TODO|placeholder|stub|skeleton/i);
  });

  it("fails check mode when the committed manual drifts from the manifest", () => {
    const root = makeTempRoot();
    const outputPath = join(root, "missing.md");

    const result = spawnSync("node", [scriptPath, "--output", outputPath, "--check"], {
      encoding: "utf8",
    });

    expect(result.status).toBe(1);
    expect(result.stderr).toContain("manual_out_of_date");
  });
});
