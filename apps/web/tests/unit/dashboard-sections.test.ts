import { describe, expect, it } from "vitest";
import {
  buildDashboardSectionCommandDeck,
  buildDashboardSectionSignals,
  buildDashboardSectionState,
  DASHBOARD_SECTION_TABS,
  getDashboardSectionTab,
  resolveDashboardSectionId,
  type DashboardSectionId,
} from "@/lib/catalog/dashboardSections";
import { resolveCatalogFixture } from "@/lib/catalog/testFixtures";
import type {
  ArkaHistoryPoint,
  DashboardBundle,
  DashboardComposition,
  DashboardOverview,
  MonitoringStatus,
  Page,
  RankedArkaCatalogEntry,
  RankedManagerCatalogEntry,
} from "@/lib/catalog/types";

function buildDashboardBundle(): DashboardBundle {
  const arkas = resolveCatalogFixture(
    "/v1/arkas",
    new URLSearchParams(),
  ) as Page<RankedArkaCatalogEntry>;
  return {
    overview: resolveCatalogFixture(
      "/v1/dashboard/overview",
      new URLSearchParams(),
    ) as DashboardOverview,
    composition: resolveCatalogFixture(
      "/v1/dashboard/composition",
      new URLSearchParams(),
    ) as DashboardComposition,
    monitoring: resolveCatalogFixture(
      "/v1/monitoring/status",
      new URLSearchParams(),
    ) as MonitoringStatus,
    managers: resolveCatalogFixture(
      "/v1/managers",
      new URLSearchParams(),
    ) as Page<RankedManagerCatalogEntry>,
    arkas,
    featuredHistory: Object.fromEntries(
      arkas.items.map((entry) => [
        entry.arkaId,
        resolveCatalogFixture(
          `/v1/arkas/${entry.arkaId}/history`,
          new URLSearchParams([
            ["order", "asc"],
            ["limit", "24"],
          ]),
        ) as Page<ArkaHistoryPoint>,
      ]),
    ),
  };
}

describe("dashboardSections", () => {
  it("defines product workspaces as stateful tabs with real destinations", () => {
    expect(DASHBOARD_SECTION_TABS.map((tab) => tab.id)).toEqual([
      "arkas",
      "managers",
      "activity",
      "capital",
      "monitoring",
    ]);

    for (const tab of DASHBOARD_SECTION_TABS) {
      expect(tab.label).not.toHaveLength(0);
      expect(tab.eyebrow).not.toHaveLength(0);
      expect(tab.description).not.toMatch(/\b(fake|stub|placeholder|todo)\b/i);
      if (tab.route !== null) {
        expect(tab.route).toMatch(/^\//);
      }
      expect(tab.routeLabel).toMatch(/Open|Review/);
    }
  });

  it("resolves unknown dashboard section ids to the public Arka workspace", () => {
    expect(resolveDashboardSectionId("activity")).toBe("activity");
    expect(resolveDashboardSectionId("nope")).toBe("arkas");
    expect(resolveDashboardSectionId(null, "capital")).toBe("capital");
    expect(getDashboardSectionTab("monitoring")).toMatchObject({
      id: "monitoring",
      route: "/status",
    });
  });

  it.each<DashboardSectionId>([
    "arkas",
    "managers",
    "activity",
    "capital",
    "monitoring",
  ])("builds real summary signals for %s without invented copy", (section) => {
    const bundle = buildDashboardBundle();
    const state = buildDashboardSectionState(bundle, section);

    expect(state.tab.id).toBe(section);
    expect(state.signals).toHaveLength(3);
    for (const signal of state.signals) {
      expect(signal.label).not.toHaveLength(0);
      expect(signal.value).not.toMatch(
        /\b(undefined|NaN|fake|stub|placeholder)\b/i,
      );
      expect(signal.detail).not.toMatch(
        /\b(undefined|NaN|fake|stub|placeholder)\b/i,
      );
    }
  });

  it("uses bundle values for each dashboard section instead of hardcoded defaults", () => {
    const bundle = buildDashboardBundle();

    expect(buildDashboardSectionSignals(bundle, "arkas")[0]).toMatchObject({
      label: "Arkas",
      value: String(bundle.overview.totalArkas),
    });
    expect(buildDashboardSectionSignals(bundle, "managers")[0]).toMatchObject({
      label: "Managers",
      value: String(bundle.overview.totalManagers),
    });
    expect(buildDashboardSectionSignals(bundle, "activity")[0]).toMatchObject({
      label: "Events",
      value: String(bundle.overview.activity.totalEvents),
    });
    expect(buildDashboardSectionSignals(bundle, "capital")[0]).toMatchObject({
      label: "Tracked assets",
      value: String(bundle.composition.items.length),
    });
    expect(buildDashboardSectionSignals(bundle, "monitoring")[1]).toMatchObject(
      {
        label: "Latest update",
        value: "58s",
      },
    );
  });

  it("builds a data-backed command deck for routed and inline dashboard sections", () => {
    const bundle = buildDashboardBundle();
    const arkaDeck = buildDashboardSectionCommandDeck(bundle, "arkas");
    const activityDeck = buildDashboardSectionCommandDeck(bundle, "activity");
    const sourceCommand = arkaDeck.find((command) => command.id === "source");

    expect(arkaDeck).toHaveLength(3);
    expect(arkaDeck[0]).toMatchObject({
      id: "surface",
      value: "Arkas",
      href: null,
    });
    expect(arkaDeck[1]).toMatchObject({
      id: "route",
      value: "Linked page",
      href: "/vaults",
      ctaLabel: "Open Arka leaderboard",
    });
    expect(sourceCommand).toMatchObject({
      id: "source",
      value: "Live",
      href: "/status",
    });
    expect(sourceCommand?.detail).toContain(
      `${bundle.overview.totalArkas} Arkas`,
    );
    expect(sourceCommand?.detail).toContain(
      `${bundle.overview.totalAssets} assets`,
    );
    expect(sourceCommand?.detail).toContain("Latest Arka update");
    expect(sourceCommand?.detail).not.toMatch(
      /\b(undefined|NaN|fake|stub|placeholder)\b/i,
    );

    expect(activityDeck[1]).toMatchObject({
      id: "route",
      value: "Dashboard view",
      href: null,
      ctaLabel: "Stay in dashboard",
    });
    expect(activityDeck[1].detail).toContain("summarizes portfolio activity");
  });
});
