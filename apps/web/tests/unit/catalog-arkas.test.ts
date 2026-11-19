import { describe, expect, it } from "vitest";
import {
  buildArkaHistoryBars,
  buildArkaTrendSummary,
  buildPortfolioBars,
  summarizeArkaActivity,
} from "@/lib/catalog/arkas";
import {
  arkaActivityFixture,
  arkaHistoryFixture,
  arkaPortfolioFixture,
} from "@/lib/catalog/testFixtures";

const ARKA_ID = "CA7ALPHAQFK2MZKJY4R5S8N2P1T6V9W3X7Y2Z5ABCD1EFGH2345678IJ";

describe("catalog arka helpers", () => {
  it("does not plot unavailable NAV as a zero balance or calculate a false loss", () => {
    const points = arkaHistoryFixture[ARKA_ID].items;
    const unavailable = { ...points[points.length - 1], nav: null };
    expect(buildArkaHistoryBars([points[0], unavailable])).toHaveLength(1);
    expect(buildArkaTrendSummary([points[0], unavailable])).toMatchObject({currentNav:null,deltaNav:null,deltaBps:null});
  });
  it("builds trend summaries and normalized history bars", () => {
    const points = arkaHistoryFixture[ARKA_ID].items;
    const trend = buildArkaTrendSummary(points);
    const bars = buildArkaHistoryBars(points);

    expect(trend.currentNav).toBe("5200000");
    expect(trend.previousNav).toBe("4980000");
    expect(trend.deltaNav).toBe("220000");
    expect(trend.deltaBps).toBe(441);
    expect(bars.at(-1)?.widthPct).toBe(100);
  });

  it("summarizes activity groups and portfolio bars", () => {
    const groups = summarizeArkaActivity(arkaActivityFixture[ARKA_ID].items);
    const bars = buildPortfolioBars(arkaPortfolioFixture[ARKA_ID]);

    expect(groups[0]).toEqual({ kind: "deposit", count: 1 });
    expect(groups).toHaveLength(4);
    expect(bars[0]?.value).toBe("40.4%");
    expect(bars[0]?.widthPct).toBeCloseTo(40.38, 2);
  });
});
