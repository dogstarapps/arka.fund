import { describe, expect, it } from "vitest";
import {
  buildAssetHistoryBars,
  buildAssetTrendSummary,
  buildManagerHistoryBars,
  buildManagerTrendSummary,
} from "@/lib/catalog/explorers";
import { assetHistoryFixture, managerHistoryFixture } from "@/lib/catalog/testFixtures";

describe("catalog explorer helpers", () => {
  it("builds manager trend summaries and normalized history bars", () => {
    const points =
      managerHistoryFixture.GCAALPHA7RTH9KLMNOPQ2UVWX3YZ56789ABCDEFGHJKLMNPRSTUV4WX.items;
    const trend = buildManagerTrendSummary(points);
    const bars = buildManagerHistoryBars(points);

    expect(trend.currentValue).toBe("6150000");
    expect(trend.previousValue).toBe("6020000");
    expect(trend.deltaValue).toBe("130000");
    expect(trend.deltaBps).toBe(215);
    expect(bars).toHaveLength(3);
    expect(bars.at(-1)?.widthPct).toBe(100);
  });

  it("never presents native manager NAV history as USD history", () => {
    const points = [
      {
        manager: "GMANAGER",
        syncedAt: "2026-08-14T10:00:00.000Z",
        totalNav: "123000000",
        arkaCount: 1,
        curatedArkaCount: 1,
        delistedArkaCount: 0,
        rank: 1,
      },
    ];

    expect(buildManagerTrendSummary(points)).toMatchObject({
      currentValue: null,
      pointCount: 0,
    });
    expect(buildManagerHistoryBars(points)).toEqual([]);
  });

  it("builds asset trend summaries and normalized history bars", () => {
    const points =
      assetHistoryFixture.CD25MNVTZDL4Y3XBCPCJXGXATV5WUHHOWMYFF4YBEGU5FCPGMYTVG5JY.items;
    const trend = buildAssetTrendSummary(points);
    const bars = buildAssetHistoryBars(points);

    expect(trend.currentValue).toBe("2300000");
    expect(trend.previousValue).toBe("2170000");
    expect(trend.deltaValue).toBe("130000");
    expect(trend.deltaBps).toBe(599);
    expect(bars).toHaveLength(3);
    expect(bars.at(-1)?.widthPct).toBe(100);
  });
});
