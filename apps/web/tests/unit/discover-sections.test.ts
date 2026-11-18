import { describe, expect, it } from "vitest";
import {
  buildDiscoverSectionCommandDeck,
  buildDiscoverSectionSignals,
  buildDiscoverSectionState,
  DISCOVER_SECTION_TABS,
  getDiscoverSectionTab,
  resolveDiscoverSectionId,
  type DiscoverSectionId,
} from "@/lib/catalog/discoverSections";
import { resolveCatalogFixture } from "@/lib/catalog/testFixtures";
import type {
  DiscoverBundle,
  DashboardOverview,
  Page,
  RankedArkaCatalogEntry,
  RankedAssetCatalogEntry,
  RankedManagerCatalogEntry,
} from "@/lib/catalog/types";

function buildDiscoverBundle(): DiscoverBundle {
  return {
    overview: resolveCatalogFixture(
      "/v1/dashboard/overview",
      new URLSearchParams(),
    ) as DashboardOverview,
    arkas: resolveCatalogFixture(
      "/v1/arkas",
      new URLSearchParams(),
    ) as Page<RankedArkaCatalogEntry>,
    managers: resolveCatalogFixture(
      "/v1/managers",
      new URLSearchParams(),
    ) as Page<RankedManagerCatalogEntry>,
    assets: resolveCatalogFixture(
      "/v1/assets",
      new URLSearchParams(),
    ) as Page<RankedAssetCatalogEntry>,
  };
}

describe("discoverSections", () => {
  it("defines the public Discover workspaces as actionable product tabs", () => {
    expect(DISCOVER_SECTION_TABS.map((tab) => tab.id)).toEqual([
      "arkas",
      "managers",
      "assets",
    ]);

    for (const tab of DISCOVER_SECTION_TABS) {
      expect(tab.label).not.toHaveLength(0);
      expect(tab.eyebrow).not.toHaveLength(0);
      expect(tab.description).not.toMatch(/\b(fake|stub|placeholder|todo)\b/i);
      expect(tab.route).toMatch(/^\//);
      expect(tab.routeLabel).toMatch(/^Open full/);
    }
  });

  it("resolves unknown Discover section ids to featured Arkas", () => {
    expect(resolveDiscoverSectionId("assets")).toBe("assets");
    expect(resolveDiscoverSectionId("unknown")).toBe("arkas");
    expect(resolveDiscoverSectionId(null, "managers")).toBe("managers");
    expect(getDiscoverSectionTab("managers")).toMatchObject({
      id: "managers",
      route: "/managers",
    });
  });

  it.each<DiscoverSectionId>(["arkas", "managers", "assets"])(
    "builds real summary signals for %s without unresolved copy",
    (section) => {
      const bundle = buildDiscoverBundle();
      const state = buildDiscoverSectionState(bundle, section, {
        curatedOnly: true,
        search: "",
      });

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
    },
  );

  it("uses current catalog totals and search context for section signals", () => {
    const bundle = buildDiscoverBundle();

    expect(
      buildDiscoverSectionSignals(bundle, "arkas", {
        curatedOnly: true,
        search: "gamma",
      })[0],
    ).toMatchObject({
      label: "Visible Arkas",
      value: String(bundle.arkas.total),
      detail: 'matching "gamma" in the current results',
    });
    expect(
      buildDiscoverSectionSignals(bundle, "managers", {
        curatedOnly: true,
        search: "",
      })[0],
    ).toMatchObject({
      label: "Visible managers",
      value: String(bundle.managers.total),
    });
    expect(
      buildDiscoverSectionSignals(bundle, "assets", {
        curatedOnly: true,
        search: "",
      })[0],
    ).toMatchObject({
      label: "Visible assets",
      value: String(bundle.assets.total),
    });
  });

  it("builds a command deck from current filters, route boundaries and catalog source", () => {
    const bundle = buildDiscoverBundle();
    const arkaDeck = buildDiscoverSectionCommandDeck(bundle, "arkas", {
      curatedOnly: true,
      search: "gamma",
    });
    const managerDeck = buildDiscoverSectionCommandDeck(bundle, "managers", {
      curatedOnly: false,
      search: "",
    });

    expect(arkaDeck).toHaveLength(3);
    expect(arkaDeck[0]).toMatchObject({
      id: "scope",
      value: 'Search "gamma"',
      href: null,
      ctaLabel: "Current window",
    });
    expect(arkaDeck[0].detail).toContain(
      `${bundle.arkas.total} featured arkas visible`,
    );
    expect(arkaDeck[1]).toMatchObject({
      id: "route",
      value: "/vaults",
      href: "/vaults",
      ctaLabel: "Open full Arka explorer",
    });
    expect(arkaDeck[2]).toMatchObject({
      id: "source",
      value: "Live",
      href: "/status",
    });
    expect(arkaDeck[2].detail).toContain(`${bundle.arkas.total} Arkas`);
    expect(arkaDeck[2].detail).toContain(`${bundle.managers.total} managers`);
    expect(arkaDeck[2].detail).toContain(`${bundle.assets.total} assets`);
    for (const command of arkaDeck) {
      expect(command.detail).not.toMatch(
        /\b(undefined|NaN|fake|stub|placeholder)\b/i,
      );
    }

    expect(managerDeck[0]).toMatchObject({
      id: "scope",
      value: "All",
    });
    expect(managerDeck[1]).toMatchObject({
      id: "route",
      value: "/managers",
      href: "/managers",
    });
  });
});
