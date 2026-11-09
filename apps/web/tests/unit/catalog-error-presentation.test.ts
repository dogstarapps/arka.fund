import { describe, expect, it } from "vitest";
import { buildCatalogFallbackUnavailableCopy } from "@/lib/catalog/errorPresentation";

describe("catalog error presentation", () => {
  it("describes product surface outages without exposing implementation dependencies", () => {
    const vaults = buildCatalogFallbackUnavailableCopy("vaults");
    const dashboard = buildCatalogFallbackUnavailableCopy("dashboard");

    expect(vaults.title).toBe("Arka leaderboard data is not available");
    expect(vaults.body).toContain("could not be loaded right now");
    expect(vaults.body).not.toContain("configured catalog");
    expect(vaults.body).not.toContain("Soroban-backed on-chain catalog fallback");
    expect(vaults.body).not.toContain("requires the testnet catalog API");
    expect(dashboard.title).toBe("Dashboard data is not available");
    expect(dashboard.body).toContain("could not be loaded right now");
  });
});
