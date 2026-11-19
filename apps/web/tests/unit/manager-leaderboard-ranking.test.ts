import { describe, expect, it } from "vitest";
import {
  normalizeManagerSortMetric,
  normalizeManagerSortOrder,
  rankManagerLeaderboardEntries,
} from "@/lib/catalog/leaderboardManagers";
import { fixtureManagersPage } from "@/lib/catalog/testFixtures";

describe("manager leaderboard ranking helpers", () => {
  it("normalizes metric/order query params", () => {
    expect(normalizeManagerSortMetric("nav")).toBe("nav");
    expect(normalizeManagerSortMetric("invalid")).toBe("rank");
    expect(normalizeManagerSortOrder("rank", null)).toBe("asc");
    expect(normalizeManagerSortOrder("nav", null)).toBe("desc");
    expect(normalizeManagerSortOrder("nav", "asc")).toBe("asc");
  });

  it("ranks managers by nav, arka count and curated count", () => {
    const page = fixtureManagersPage({ limit: 24 });
    const byNav = rankManagerLeaderboardEntries(page.items, "nav", "desc");
    expect(byNav[0]?.manager).toContain("GCAALPHA");

    const byArkas = rankManagerLeaderboardEntries(page.items, "arkas", "desc");
    expect(byArkas[0]?.manager).toContain("GCAALPHA");

    const byCurated = rankManagerLeaderboardEntries(
      page.items,
      "curated",
      "desc",
    );
    expect(byCurated[0]?.manager).toContain("GCAALPHA");
  });
});
