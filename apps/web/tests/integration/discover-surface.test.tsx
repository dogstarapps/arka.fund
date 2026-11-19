import React from "react";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import DiscoverSurface from "@/components/product/DiscoverSurface";
import { resolveCatalogFixture } from "@/lib/catalog/testFixtures";
import type { Page, RankedArkaCatalogEntry } from "@/lib/catalog/types";

function installCatalogFetchMock() {
  return vi.spyOn(global, "fetch").mockImplementation(async (input) => {
    const url =
      typeof input === "string"
        ? new URL(input, "http://localhost")
        : input instanceof URL
          ? input
          : new URL(input.url);
    const pathname = url.pathname.replace("/api/catalog", "");
    const body = resolveCatalogFixture(pathname, url.searchParams);
    return new Response(JSON.stringify(body), {
      status: pathname.startsWith("/v1/") ? 200 : 404,
      headers: { "content-type": "application/json" },
    });
  });
}

describe("DiscoverSurface", () => {
  afterEach(() => {
    cleanup();
    window.history.replaceState(null, "", "/");
    vi.restoreAllMocks();
  });

  it("keeps the new catalog controls available through an error and retry", async () => {
    const fetch = installCatalogFetchMock();
    const user = userEvent.setup();
    const fixtureFetch = fetch.getMockImplementation()!;
    fetch.mockImplementation(async () => new Response(JSON.stringify({
      message: "Catalog temporarily unavailable.",
    }), { status: 503 }));

    render(<DiscoverSurface redesign />);
    expect(screen.getByRole("heading", { name: "Arka Leaderboard" })).toBeVisible();
    expect(screen.getByRole("searchbox", { name: "Search Arkas" })).toBeVisible();
    expect(await screen.findByRole("alert")).toHaveTextContent("Try again");
    expect(screen.queryAllByTestId("explore-arka-card")).toHaveLength(0);

    fetch.mockImplementation(fixtureFetch);
    await user.click(screen.getByRole("button", { name: "Retry" }));
    await waitFor(() => expect(screen.getAllByTestId("explore-arka-card")).toHaveLength(4));
    expect(screen.getAllByRole("link", { name: /^View Arka/ })[0]).toHaveAttribute("href", expect.stringMatching(/^\/vaults\/C/));

    await user.type(screen.getByRole("searchbox", { name: "Search Arkas" }), "gamma");
    await waitFor(() => expect(screen.getAllByTestId("explore-arka-card")).toHaveLength(1));
    await user.selectOptions(screen.getByRole("combobox", { name: "Sort by" }), "fresh");
    expect(new URLSearchParams(location.search).get("feature")).toBe("fresh");
  });

  it("renders a focused public discovery board and filters real Arka cards", async () => {
    installCatalogFetchMock();
    const user = userEvent.setup();
    render(<DiscoverSurface />);

    await waitFor(() =>
      expect(screen.getByRole("heading", { name: /^discover$/i })).toBeInTheDocument(),
    );
    expect(screen.getByTestId("discover-fidelity-shell")).toHaveClass("public-screen-safe-zone");
    expect(screen.getByTestId("discover-command-board")).toHaveClass("public-hero-board-cutover");
    expect(screen.getByTestId("discover-public-metric-board")).toHaveClass("public-hero-metric-lane-cutover");
    expect(screen.getByTestId("discover-summary-grid")).toHaveClass("public-hero-metric-deck-cutover");
    expect(screen.getByTestId("discover-public-collection-board")).toHaveClass("public-hero-collection-lane-cutover");
    expect(screen.getByTestId("discover-figma-preview-grid")).toHaveClass("public-hero-card-grid-cutover");
    expect(screen.getAllByTestId("discover-figma-preview-card")).toHaveLength(3);
    expect(screen.getByTestId("discover-stage-metric-nav")).toHaveTextContent("TVL");
    expect(screen.getByTestId("discover-stage-metric-nav")).not.toHaveTextContent("base units");
    expect(screen.getByTestId("discover-stage-metric-managers")).toHaveTextContent("Managers");
    expect(screen.getByTestId("discover-stage-metric-assets")).toHaveTextContent("Assets");

    const firstCard = screen.getAllByTestId("discover-figma-preview-card")[0]!;
    expect(within(firstCard).getByText("Assets")).toBeInTheDocument();
    expect(within(firstCard).getByText("Manager")).toBeInTheDocument();
    expect(within(firstCard).getByText("Updated")).toBeInTheDocument();
    expect(within(firstCard).getByRole("link", { name: "Open profile" })).toHaveAttribute(
      "href",
      expect.stringMatching(/^\/vaults\/C/),
    );
    expect(screen.queryByTestId("discover-section-command-deck")).not.toBeInTheDocument();
    expect(screen.queryByTestId("discover-arkas-table")).not.toBeInTheDocument();

    await user.click(screen.getByTestId("discover-market-popular"));
    await user.click(screen.getByTestId("discover-feature-tab-profit"));
    expect(screen.getByTestId("discover-feature-tab-profit")).toHaveAttribute("aria-pressed", "true");

    await user.type(screen.getByTestId("discover-search-input"), "gamma");
    await waitFor(() =>
      expect(screen.getAllByTestId("discover-figma-preview-card")).toHaveLength(1),
    );
    expect(screen.getByTestId("discover-figma-preview-grid")).toHaveTextContent("CA7GAMMAQF");
    expect(window.location.search).toContain("q=gamma");
  });

  it("ranks the full catalog by TVL, profit or complete holder counts and charts only share prices", async () => {
    const fetch = installCatalogFetchMock();
    const fallback = fetch.getMockImplementation()!;
    const fixture = resolveCatalogFixture("/v1/arkas", new URLSearchParams("limit=4")) as Page<RankedArkaCatalogEntry>;
    const first = fixture.items[0];
    const second = { ...first, arkaId: fixture.items[1].arkaId, rank: 2, profitBase: "-10000000",
      economics: { ...first.economics!, navUsdEstimate: "90000000" } };
    fetch.mockImplementation(async (input, options) => {
      const url = new URL(String(input), "http://localhost");
      const isFirst = url.pathname.includes(first.arkaId);
      const json = (body: unknown) => Response.json(body);
      if (url.pathname === "/api/catalog/v1/arkas") {
        const offset = Number(url.searchParams.get("offset"));
        return json({ total: 2, offset, limit: 1, items: [offset ? second : first] });
      }
      if (url.pathname.endsWith("/holders")) return json({ complete: isFirst ? false : true, total: isFirst ? 20 : 4 });
      if (url.pathname.endsWith("/history")) return json({ items: [
        { syncedAt: "2026-03-01T00:00:00Z", nav: "10000000", shareToken: first.shareToken,
          denominationContract: first.denominationContract, ...(isFirst ? { sharePrice: "1000000000" } : {}) },
        { syncedAt: "2026-03-08T00:00:00Z", nav: "30000000", shareToken: first.shareToken,
          denominationContract: first.denominationContract, ...(isFirst ? { sharePrice: "1100000000" } : {}) },
      ] });
      return fallback(input, options);
    });
    const user = userEvent.setup();
    render(<DiscoverSurface redesign />);
    const cards = await screen.findAllByTestId("explore-arka-card");
    expect(cards).toHaveLength(2);
    const leadingHref = () => within(screen.getAllByTestId("explore-arka-card")[0]).getByRole("link").getAttribute("href");
    const sorting = screen.getByRole("combobox", { name: "Sort by" });
    expect(sorting).toHaveValue("profit");
    expect(leadingHref()).toBe(`/vaults/${first.arkaId}`);
    await user.selectOptions(sorting, "nav");
    expect(leadingHref()).toBe(`/vaults/${second.arkaId}`);
    expect(await screen.findByRole("img", { name: /share-price return/i })).toBeVisible();
    expect(screen.getByText("+10%")).toBeVisible();
    expect(screen.getAllByRole("img")).toHaveLength(1);
    await user.selectOptions(screen.getByRole("combobox", { name: "Sort by" }), "profit");
    expect(leadingHref()).toBe(`/vaults/${first.arkaId}`);
    await user.selectOptions(screen.getByRole("combobox", { name: "Sort by" }), "participants");
    await waitFor(() => expect(leadingHref()).toBe(`/vaults/${second.arkaId}`));
    expect(screen.queryByText("20")).not.toBeInTheDocument();
  });

  it("ranks funded Arkas in their shared denomination when a USD quote is unavailable", async () => {
    const fetch = installCatalogFetchMock();
    const fallback = fetch.getMockImplementation()!;
    const fixture = resolveCatalogFixture("/v1/arkas", new URLSearchParams("limit=4")) as Page<RankedArkaCatalogEntry>;
    const template = fixture.items[0];
    const denominationAsset = { ...template.economics!.denominationAsset!, symbol: "XLM", usdPegged: false };
    const empty = { ...template, rank: 1, nav: "0", economics: { ...template.economics!, denominationAsset, navUsdEstimate: "0" } };
    const funded = { ...template, rank: 2, arkaId: fixture.items[1].arkaId, nav: "90000000",
      economics: { ...template.economics!, denominationAsset, navUsdEstimate: null } };
    fetch.mockImplementation(async (input, options) => {
      const url = new URL(String(input), "http://localhost");
      if (url.pathname === "/api/catalog/v1/arkas") {
        return Response.json({ items: [empty, funded], total: 2, offset: 0, limit: 100 });
      }
      return fallback(input, options);
    });

    render(<DiscoverSurface redesign />);
    await screen.findAllByTestId("explore-arka-card");
    await userEvent.setup().selectOptions(screen.getByRole("combobox", { name: "Sort by" }), "nav");
    expect(within(screen.getAllByTestId("explore-arka-card")[0]).getByRole("link")).toHaveAttribute("href", `/vaults/${funded.arkaId}`);
    expect(screen.getByText(/Ranked in XLM/)).toBeVisible();
  });

  it("restores public filters from the URL without dropping search focus", async () => {
    installCatalogFetchMock();
    const user = userEvent.setup();
    window.history.replaceState(null, "", "/discover?q=gamma&curated=0&feature=search");
    render(<DiscoverSurface />);

    const searchInput = await screen.findByTestId("discover-search-input");
    await waitFor(() => expect(searchInput).toHaveValue("gamma"));
    expect(screen.getByTestId("discover-feature-tab-search")).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByTestId("discover-curated-toggle")).not.toBeChecked();

    await user.click(searchInput);
    await user.type(searchInput, "x");
    expect(searchInput).toHaveFocus();
    expect(window.location.search).toContain("q=gammax");
    expect(new URLSearchParams(window.location.search).has("curated")).toBe(false);
  });

  it("keeps current cards visible while a search refresh is in flight", async () => {
    const pendingResolvers: Array<() => void> = [];
    vi.spyOn(global, "fetch").mockImplementation(async (input) => {
      const url =
        typeof input === "string"
          ? new URL(input, "http://localhost")
          : input instanceof URL
            ? input
            : new URL(input.url);
      const pathname = url.pathname.replace("/api/catalog", "");
      const body = resolveCatalogFixture(pathname, url.searchParams);
      if (url.searchParams.get("search") === "gamma") {
        await new Promise<void>((resolve) => pendingResolvers.push(resolve));
      }
      return new Response(JSON.stringify(body), {
        status: pathname.startsWith("/v1/") ? 200 : 404,
        headers: { "content-type": "application/json" },
      });
    });
    render(<DiscoverSurface />);

    await waitFor(() =>
      expect(screen.getAllByTestId("discover-figma-preview-card")).toHaveLength(3),
    );
    fireEvent.change(screen.getByTestId("discover-search-input"), {
      target: { value: "gamma" },
    });
    await waitFor(() =>
      expect(screen.getByTestId("discover-refresh-status")).toHaveTextContent("Refreshing visible data"),
    );
    expect(screen.getByTestId("discover-fidelity-shell")).toHaveAttribute("aria-busy", "true");
    expect(screen.getAllByTestId("discover-figma-preview-card")).toHaveLength(3);

    pendingResolvers.splice(0).forEach((resolve) => resolve());
    await waitFor(() =>
      expect(screen.queryByTestId("discover-refresh-status")).not.toBeInTheDocument(),
    );
    expect(screen.getAllByTestId("discover-figma-preview-card")).toHaveLength(1);
    expect(screen.getByTestId("discover-figma-preview-grid")).toHaveTextContent("CA7GAMMAQF");
  });

  it("routes configuration failures to user-facing recovery copy", async () => {
    vi.spyOn(global, "fetch").mockImplementation(async () =>
      new Response(
        JSON.stringify({ error: "catalog_not_configured", message: "Catalog API base URL is not configured." }),
        { status: 503, headers: { "content-type": "application/json" } },
      ),
    );
    render(<DiscoverSurface />);

    await waitFor(() => expect(screen.getByTestId("discover-catalog-offline")).toBeInTheDocument());
    expect(screen.getByTestId("discover-catalog-offline")).toHaveTextContent("Discovery data is not available");
    expect(screen.getByTestId("discover-catalog-offline")).toHaveTextContent("could not be loaded right now");
    expect(screen.getByTestId("discover-catalog-offline")).not.toHaveTextContent("base URL");
  });
});
