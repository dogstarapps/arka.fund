import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

const SOURCE_ROOT = join(process.cwd(), "src");

const LEGACY_BLEND_DIRECT_METHODS = [
  "blend_lend",
  "blend_borrow",
  "blend_repay",
  "blend_withdraw",
  "blend_position",
  "blend_positions",
  "blend_position_value",
  "blend_position_values",
  "blend_market_value",
  "blend_market_assets",
  "blend_market_status",
  "blend_risk_policy",
];

const LEGACY_BLEND_SDK_SYMBOLS = [
  "ArkaBlend",
  "parseBlend",
  "readArkaBlend",
  "buildArkaBlend",
];

function sourceFiles(dir: string): string[] {
  const files: string[] = [];
  for (const entry of readdirSync(dir)) {
    const fullPath = join(dir, entry);
    const stat = statSync(fullPath);
    if (stat.isDirectory()) {
      files.push(...sourceFiles(fullPath));
      continue;
    }
    if (/\.(ts|tsx)$/.test(entry)) files.push(fullPath);
  }
  return files;
}

describe("contract API surface", () => {
  it("keeps frontend code on the protocol-agnostic credit API instead of direct Blend aliases", () => {
    const offenders: string[] = [];
    for (const file of sourceFiles(SOURCE_ROOT)) {
      const text = readFileSync(file, "utf8");
      for (const method of LEGACY_BLEND_DIRECT_METHODS) {
        if (text.includes(`'${method}'`) || text.includes(`"${method}"`)) {
          offenders.push(`${relative(process.cwd(), file)} -> ${method}`);
        }
      }
      for (const symbol of LEGACY_BLEND_SDK_SYMBOLS) {
        if (text.includes(symbol)) {
          offenders.push(`${relative(process.cwd(), file)} -> ${symbol}`);
        }
      }
    }

    expect(offenders).toEqual([]);
  });

  it("keeps manager credit writes routed through canonical credit methods", () => {
    const soroban = readFileSync(join(SOURCE_ROOT, "lib", "soroban.ts"), "utf8");

    expect(soroban).toContain("return 'credit_supply'");
    expect(soroban).toContain("return 'credit_borrow'");
    expect(soroban).toContain("return 'credit_repay'");
    expect(soroban).toContain("return 'credit_withdraw'");
    expect(soroban).not.toContain("buildArkaBlendAction");
  });
});
