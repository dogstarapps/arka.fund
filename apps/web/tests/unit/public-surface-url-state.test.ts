import { describe, expect, it } from "vitest";
import {
  applyProductQueryValuesToHref,
  normalizeAssetsUrlState,
  normalizeBooleanQueryParam,
  normalizeDashboardUrlState,
  normalizeDiscoverUrlState,
  normalizeManagersUrlState,
  normalizeVaultsUrlState,
} from "@/lib/workflows/publicSurfaceUrlState";

describe("public surface URL state", () => {
  it("normalizes dashboard tabs, feature mode and history ranges", () => {
    const state = normalizeDashboardUrlState(
      new URLSearchParams("stage=activity&range=1w&feature=fresh&section=monitoring"),
    );

    expect(state).toEqual({
      stage: "activity",
      range: "1w",
      feature: "fresh",
      section: "monitoring",
    });
  });

  it("keeps the connected manager Arka view bookmarkable", () => {
    const state = normalizeDashboardUrlState(
      new URLSearchParams("feature=mine"),
    );
    expect(state.feature).toBe("mine");
  });

  it("falls back safely for invalid dashboard values", () => {
    const state = normalizeDashboardUrlState(
      new URLSearchParams("stage=made-up&range=bad&feature=none&section=ghost"),
    );

    expect(state).toEqual({
      stage: "portfolio",
      range: "all",
      feature: "fresh",
      section: "arkas",
    });
  });

  it("normalizes discover search, curated state and active section", () => {
    const state = normalizeDiscoverUrlState({
      q: "  aqua ",
      curated: "0",
      feature: "search",
      section: "assets",
    });

    expect(state).toEqual({
      search: "aqua",
      curatedOnly: false,
      feature: "search",
      section: "assets",
    });
  });

  it("normalizes vault leaderboard sorting, feature and window state", () => {
    const state = normalizeVaultsUrlState(
      new URLSearchParams("q=usdc&curated=false&sort=volume&order=asc&feature=profit&window=7d"),
    );

    expect(state).toEqual({
      search: "usdc",
      curatedOnly: false,
      sortMetric: "volume",
      sortOrder: "asc",
      feature: "profit",
      window: "7d",
    });
  });

  it("defaults vault sort order based on the selected metric", () => {
    expect(normalizeVaultsUrlState(new URLSearchParams("sort=profit")).sortOrder).toBe(
      "desc",
    );
    expect(normalizeVaultsUrlState(new URLSearchParams("sort=rank")).sortOrder).toBe(
      "asc",
    );
  });

  it("normalizes asset explorer query and spotlight state", () => {
    expect(
      normalizeAssetsUrlState(
        new URLSearchParams("q= BLND &spotlight=balanceSheet"),
      ),
    ).toEqual({
      search: "BLND",
      spotlight: "balanceSheet",
    });

    expect(
      normalizeAssetsUrlState(
        new URLSearchParams("q=USDC&spotlight=unsupported"),
      ),
    ).toEqual({
      search: "USDC",
      spotlight: "core",
    });
  });

  it("normalizes manager explorer query, spotlight and ranking state", () => {
    expect(
      normalizeManagersUrlState(
        new URLSearchParams("q= beta &spotlight=curated&sort=arkas&order=asc"),
      ),
    ).toEqual({
      search: "beta",
      spotlight: "curated",
      sortMetric: "arkas",
      sortOrder: "asc",
    });

    expect(normalizeManagersUrlState(new URLSearchParams("sort=nav")).sortOrder).toBe(
      "desc",
    );
    expect(
      normalizeManagersUrlState(
        new URLSearchParams("spotlight=bad&sort=bad&order=bad"),
      ),
    ).toEqual({
      search: "",
      spotlight: "lead",
      sortMetric: "rank",
      sortOrder: "asc",
    });
  });

  it("parses boolean query aliases without treating unknown values as true", () => {
    expect(normalizeBooleanQueryParam("yes", false)).toBe(true);
    expect(normalizeBooleanQueryParam("off", true)).toBe(false);
    expect(normalizeBooleanQueryParam("sometimes", true)).toBe(true);
    expect(normalizeBooleanQueryParam("sometimes", false)).toBe(false);
  });

  it("applies canonical query state without dropping path or hash", () => {
    expect(
      applyProductQueryValuesToHref(
        "https://arka.local/vaults?sort=rank&q=old#leaderboard",
        {
          q: "gamma",
          sort: "profit",
          curated: "0",
          order: null,
          empty: "",
        },
      ),
    ).toBe("/vaults?sort=profit&q=gamma&curated=0#leaderboard");
  });

  it("removes default query params while preserving unrelated state", () => {
    expect(
      applyProductQueryValuesToHref("/dashboard?stage=activity&debug=1", {
        stage: null,
        range: "1y",
        feature: undefined,
      }),
    ).toBe("/dashboard?debug=1&range=1y");
  });
});
